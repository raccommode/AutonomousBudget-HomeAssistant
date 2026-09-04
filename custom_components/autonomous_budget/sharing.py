"""Shared expense allocation and contributions, derived without copying stored entries."""

from datetime import date, timedelta
from decimal import ROUND_FLOOR, Decimal

from .const import CURRENCIES
from .model import ValidationError, add_months, period_bounds, quantize, summarize
from .planning import FREQUENCIES, next_occurrence, period_index, planned_amount


def validate_links(budgets: list[dict]) -> None:
    """Keep allocations acyclic, unique, and in a single explicit currency."""
    by_id = {budget["id"]: budget for budget in budgets}
    for source in budgets:
        seen = set()
        total = Decimal(0)
        for allocation in source.get("allocations", []):
            target = by_id.get(allocation["budget_id"])
            if source.get("kind", "personal") != "shared":
                raise ValidationError("Only shared budgets can have an allocation.")
            if not target or target.get("kind", "personal") != "personal":
                raise ValidationError("Contributions must go to an existing personal budget.")
            if target["id"] in seen:
                raise ValidationError("Each personal budget can appear only once in an allocation.")
            if target["currency"] != source["currency"] and not allocation.get("exchange_rate"):
                raise ValidationError("An explicit planning exchange rate is required for different currencies.")
            seen.add(target["id"])
            total += Decimal(allocation["percentage"])
        if total > 100:
            raise ValidationError("The total allocation cannot exceed 100%.")


def split_amount(amount: Decimal, allocations: list[dict], currency: str) -> dict[str, Decimal]:
    """Distribute minor units fairly; a full allocation never loses or creates a cent."""
    unit = Decimal(10) ** -CURRENCIES[currency]
    exact = {row["budget_id"]: amount * Decimal(row["percentage"]) / 100 for row in allocations}
    rounded = {key: value.quantize(unit, rounding=ROUND_FLOOR) for key, value in exact.items()}
    remainder = int((quantize(sum(exact.values(), Decimal(0)), currency) - sum(rounded.values(), Decimal(0))) / unit)
    for key in sorted(exact, key=lambda key: (-(exact[key] - rounded[key]), key))[:remainder]:
        rounded[key] += unit
    return rounded


def contribution_amounts(source: dict, period: str, start: date, end: date) -> dict[str, Decimal]:
    """Share the expense plan only. Income never reduces a person's agreed contribution."""
    total = sum(
        (
            planned_amount(item, source["currency"], period, start, end)
            for item in source["items"]
            if item["direction"] == "expense"
        ),
        Decimal(0),
    )
    return split_amount(total, source.get("allocations", []), source["currency"])


def summarize_budgets(budgets: list[dict], settings: dict, today: date, offset: int) -> list[dict]:
    """Build personal contribution rows and common summaries from a single revision."""
    by_id = {budget["id"]: budget for budget in budgets}
    generated = {budget["id"]: [] for budget in budgets}
    shares = {}
    amounts_cache = {}

    def amounts(source, period, start, end):
        key = (source["id"], period, start, end)
        if key not in amounts_cache:
            amounts_cache[key] = contribution_amounts(source, period, start, end)
        return amounts_cache[key]

    for source in budgets:
        if source.get("kind") != "shared":
            continue
        members = []
        for allocation in source.get("allocations", []):
            target = by_id[allocation["budget_id"]]
            period = target.get("period") or settings["period"]
            anchor = date.fromisoformat(target.get("anchor") or settings["anchor"])
            start, end = period_bounds(today, period, anchor, offset)
            fx = (
                Decimal(allocation.get("exchange_rate", "1"))
                if source["currency"] != target["currency"]
                else Decimal(1)
            )
            amount = quantize(amounts(source, period, start, end)[target["id"]] * fx, target["currency"])
            current_start, current_end = period_bounds(today, period, anchor)
            reserved_amount = quantize(
                amounts(source, period, current_start, current_end)[target["id"]] * fx, target["currency"]
            )
            next_date = max(start, current_start if current_start == today else current_end)
            next_start, next_end = period_bounds(next_date, period, anchor)
            next_amount = quantize(amounts(source, period, next_start, next_end)[target["id"]] * fx, target["currency"])
            members.append(
                allocation
                | {
                    "name": target["name"],
                    "currency": target["currency"],
                    "period": period,
                    "anchor": anchor.isoformat(),
                    "amount": str(amount),
                    "next_due": next_date.isoformat() if next_amount else None,
                }
            )
            if Decimal(allocation["percentage"]) == 0:
                continue
            generated[target["id"]].append(
                {
                    "id": f"shared:{source['id']}:{target['id']}",
                    "name": source["name"],
                    "direction": "expense",
                    "category": "mandatory",
                    "currency": target["currency"],
                    "amount": str(amount),
                    "exchange_rate": "1",
                    "recurrence": period,
                    "renewal_date": start.isoformat(),
                    "end_date": None,
                    "active": True,
                    "shared_source_id": source["id"],
                    "shared_percentage": allocation["percentage"],
                    "shared_next_due": next_date.isoformat() if next_amount else None,
                    "contribution_reserve": contribution_reserve(reserved_amount, current_start, current_end),
                    "locked": True,
                }
            )
        shares[source["id"]] = {
            "members": members,
            "unallocated_percentage": str(100 - sum((Decimal(row["percentage"]) for row in members), Decimal(0))),
        }
    results = []
    for budget in budgets:
        targets = [
            (by_id[row["budget_id"]], Decimal(row["percentage"]))
            for row in budget.get("allocations", [])
            if Decimal(row["percentage"]) > 0
        ]
        result = summarize(
            budget | {"items": budget["items"] + generated[budget["id"]]},
            settings,
            today,
            offset,
            shared_targets=targets,
        )
        result["kind"] = budget.get("kind", "personal")
        result["allocations"] = budget.get("allocations", [])
        if budget["id"] in shares:
            result["sharing"] = shares[budget["id"]]
        results.append(result)
    return results


def contribution_reserve(amount: Decimal, period_start: date, period_end: date) -> dict | None:
    """Hold the current personal contribution in full until the next pay period."""
    if not amount:
        return None
    return {
        "next_due": period_end.isoformat(),
        "payment_date": period_start.isoformat(),
        "required_amount": str(amount),
        "reserved_amount": str(amount),
        "amount_per_paycheck": str(amount),
        "total_paychecks": 1,
        "completed_paychecks": 1,
        "remaining_paychecks": 0,
        "progress": 1,
        "contribution": True,
    }


def previous_due(item: dict, due: date) -> date:
    """Previous theoretical bill date, preserving the original month-end anchor."""
    recurrence = item["recurrence"]
    if recurrence in ("daily", "weekly", "biweekly"):
        return due - timedelta(days={"daily": 1, "weekly": 7, "biweekly": 14}[recurrence])
    anchor = date.fromisoformat(item["renewal_date"])
    months = (due.year - anchor.year) * 12 + due.month - anchor.month
    return add_months(anchor, months - {"monthly": 1, "quarterly": 3, "yearly": 12}[recurrence])


def shared_reserve(item: dict, currency: str, targets: list, settings: dict, today: date) -> dict | None:
    """ALVES-style reserve advanced by each person's own contribution paydays."""
    if item["direction"] != "expense" or item["recurrence"] == "once":
        return None
    due = next_occurrence(item, today + timedelta(days=1))
    amount = quantize(Decimal(item["amount"]) * Decimal(item["exchange_rate"]), currency)
    if not due or not amount:
        return None
    previous = previous_due(item, due)
    reserved = Decimal(0)
    completed = total = 0
    for target, percentage in targets:
        period = target.get("period") or settings["period"]
        anchor = date.fromisoformat(target.get("anchor") or settings["anchor"])
        installment = amount * FREQUENCIES[item["recurrence"]] / FREQUENCIES[period] * percentage / 100
        previous_index = period_index(previous, period, anchor)
        count = max(0, period_index(due - timedelta(days=1), period, anchor) - previous_index)
        saved = min(count, max(0, period_index(today, period, anchor) - previous_index))
        total += count
        completed += saved
        reserved += installment * saved
    reserved = quantize(min(amount, reserved), currency)
    total = max(1, total)
    return {
        "next_due": due.isoformat(),
        "required_amount": str(amount),
        "reserved_amount": str(reserved),
        "amount_per_paycheck": None,
        "total_paychecks": total,
        "completed_paychecks": completed,
        "remaining_paychecks": total - completed,
        "progress": float(reserved / amount),
        "shared": True,
    }
