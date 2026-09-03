"""Validated budget data and calendar calculations, independent of Home Assistant."""

from calendar import monthrange
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from .const import CATEGORIES, CURRENCIES, PERIODS, RECURRENCES


class ValidationError(ValueError):
    """User-facing validation failure."""


def text(value: Any, label: str, limit: int = 100) -> str:
    """Validate a nonempty text field."""
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValidationError(f"{label} must contain 1–{limit} characters.")
    return value.strip()


def choice(value: Any, choices: Any, label: str) -> str:
    """Validate a string enum."""
    if not isinstance(value, str) or value not in choices:
        raise ValidationError(f"Choose a valid {label}.")
    return value


def parse_date(value: Any) -> date:
    """Accept an ISO date, within a safe scheduling range."""
    try:
        result = date.fromisoformat(value)
        if not 1900 <= result.year <= 2200:
            raise ValueError
        return result
    except ValueError, TypeError:
        raise ValidationError("Use a date between 1900-01-01 and 2200-12-31.") from None


def decimal(value: Any, label: str, maximum: str = "1000000000") -> Decimal:
    """Reject non-finite, negative, boolean, and excessively large amounts."""
    try:
        if isinstance(value, bool) or len(str(value)) > 40:
            raise InvalidOperation
        number = Decimal(str(value))
        if not number.is_finite() or number < 0 or number > Decimal(maximum):
            raise InvalidOperation
        return number
    except InvalidOperation, ValueError:
        raise ValidationError(f"{label} must be between 0 and {maximum}.") from None


def quantize(amount: Decimal, currency: str) -> Decimal:
    """Round to the target currency's minor units."""
    return amount.quantize(Decimal(10) ** -CURRENCIES[currency], rounding=ROUND_HALF_UP)


def validate_settings(data: dict) -> dict:
    """Normalize global defaults; the anchor determines period boundaries."""
    return {
        "currency": choice(data.get("currency"), CURRENCIES, "currency"),
        "period": choice(data.get("period"), PERIODS, "budget period"),
        "anchor": parse_date(data.get("anchor")).isoformat(),
    }


def validate_budget(data: dict) -> dict:
    """Normalize metadata and optional per-budget pay schedule overrides."""
    currency = choice(data.get("currency"), CURRENCIES, "currency")
    kind = choice(data.get("kind", "personal"), ("personal", "shared"), "budget type")
    allocations = data.get("allocations", [])
    if not isinstance(allocations, list) or len(allocations) > 50:
        raise ValidationError("Choose up to 50 personal budgets for the allocation.")
    normalized = []
    for allocation in allocations:
        if not isinstance(allocation, dict):
            raise ValidationError("Choose a personal budget and its percentage.")
        percentage = decimal(allocation.get("percentage"), "Percentage", "100")
        if percentage != percentage.quantize(Decimal("0.01")):
            raise ValidationError("Percentages allow at most 2 decimal places.")
        normalized.append({"budget_id": text(allocation.get("budget_id"), "Budget ID"), "percentage": str(percentage)})
    if kind == "personal" and normalized:
        raise ValidationError("Only shared budgets can have an allocation.")
    return {
        "name": text(data.get("name"), "Budget name"),
        "currency": currency,
        "kind": kind,
        "allocations": normalized,
        "period": choice(data["period"], PERIODS, "pay period") if data.get("period") else None,
        "anchor": parse_date(data["anchor"]).isoformat() if data.get("anchor") else None,
        "account_balance": optional_balance(data.get("account_balance"), currency),
        "credit_balance": optional_balance(data.get("credit_balance"), currency, debt=True)
        or str(quantize(Decimal(0), currency)),
    }


def optional_balance(value: Any, currency: str, *, debt: bool = False) -> str | None:
    """Validate manually entered balances, including overdrafts, without rounding input."""
    if value is None or value == "":
        return None
    try:
        if isinstance(value, bool) or len(str(value)) > 40:
            raise InvalidOperation
        amount = Decimal(str(value))
        minimum = 0 if debt else -1_000_000_000
        if not amount.is_finite() or not minimum <= amount <= 1_000_000_000:
            raise InvalidOperation
        if amount != quantize(amount, currency):
            raise InvalidOperation
    except InvalidOperation, ValueError:
        raise ValidationError("Enter a valid balance in the budget currency. Credit owed cannot be negative.") from None
    return str(quantize(amount, currency))


def validate_item(data: dict, budget_currency: str) -> dict:
    """Validate a recurring income or expense, including an explicit FX rate."""
    direction = choice(data.get("direction"), ("income", "expense"), "direction")
    currency = choice(data.get("currency"), CURRENCIES, "currency")
    amount = decimal(data.get("amount"), "Amount")
    if amount != quantize(amount, currency):
        raise ValidationError(f"{currency} amounts allow {CURRENCIES[currency]} decimal places.")
    rate = Decimal(1) if currency == budget_currency else decimal(data.get("exchange_rate"), "Exchange rate", "1000000")
    if rate <= 0 or rate.as_tuple().exponent < -8:
        raise ValidationError("Exchange rate must be positive, with at most 8 decimal places.")
    active = data.get("active", True)
    if not isinstance(active, bool):
        raise ValidationError("Active must be true or false.")
    start = parse_date(data.get("renewal_date"))
    end = parse_date(data["end_date"]) if data.get("end_date") else None
    if end and end < start:
        raise ValidationError("End date cannot precede the first due date.")
    return {
        "name": text(data.get("name"), "Entry name"),
        "direction": direction,
        "category": choice(data.get("category"), CATEGORIES, "expense category") if direction == "expense" else None,
        "amount": str(quantize(amount, currency)),
        "currency": currency,
        "exchange_rate": str(rate),
        "recurrence": choice(data.get("recurrence"), RECURRENCES, "recurrence"),
        "renewal_date": start.isoformat(),
        "end_date": end.isoformat() if end else None,
        "active": active,
    }


def add_months(anchor: date, months: int) -> date:
    """Always calculate from the original date, preserving Jan 31 / leap-day intent."""
    year, month = divmod(anchor.year * 12 + anchor.month - 1 + months, 12)
    return date(year, month + 1, min(anchor.day, monthrange(year, month + 1)[1]))


def period_bounds(today: date, period: str, anchor: date, offset: int = 0) -> tuple[date, date]:
    """Return a half-open interval containing today, shifted by whole periods."""
    if period in ("daily", "weekly", "biweekly"):
        days = {"daily": 1, "weekly": 7, "biweekly": 14}[period]
        index = (today - anchor).days // days + offset
        start = anchor + timedelta(days=index * days)
        return start, start + timedelta(days=days)
    months = 12 if period == "yearly" else 1
    index = ((today.year - anchor.year) * 12 + today.month - anchor.month) // months
    if add_months(anchor, index * months) > today:
        index -= 1
    index += offset
    return add_months(anchor, index * months), add_months(anchor, (index + 1) * months)


def occurrences(item: dict, start: date, end: date) -> list[date]:
    """Dates in [start, end), never before the configured first due date."""
    if not item["active"]:
        return []
    anchor = date.fromisoformat(item["renewal_date"])
    if item.get("end_date"):
        end = min(end, date.fromisoformat(item["end_date"]) + timedelta(days=1))
    if end <= start or anchor >= end:
        return []
    recurrence = item["recurrence"]
    if recurrence == "once":
        return [anchor] if start <= anchor < end else []
    dates = []
    if recurrence in ("daily", "weekly", "biweekly"):
        days = {"daily": 1, "weekly": 7, "biweekly": 14}[recurrence]
        index = max(0, ((start - anchor).days + days - 1) // days)
        current = anchor + timedelta(days=index * days)
        while current < end:
            dates.append(current)
            current += timedelta(days=days)
    else:
        months = {"monthly": 1, "quarterly": 3, "yearly": 12}[recurrence]
        index = max(0, ((start.year - anchor.year) * 12 + start.month - anchor.month) // months)
        current = add_months(anchor, index * months)
        while current < end:
            if current >= start:
                dates.append(current)
            index += 1
            current = add_months(anchor, index * months)
    return dates


def summarize(
    budget: dict, settings: dict, today: date, offset: int = 0, *, shared_targets: list | None = None
) -> dict:
    """Summarize scheduled cash flow; this is not a bank account balance."""
    from .planning import next_occurrence, planned_amount, reserve_accrual

    period = budget.get("period") or settings["period"]
    anchor = budget.get("anchor") or settings["anchor"]
    start, end = period_bounds(today, period, date.fromisoformat(anchor), offset)
    currency = budget["currency"]
    totals = dict.fromkeys(("income", "expenses", *CATEGORIES), Decimal(0))
    plan = totals.copy()
    reserved = Decimal(0)
    review_count = 0
    review_amount = Decimal(0)
    review_planned = Decimal(0)
    entries = []
    due = []
    for item in budget["items"]:
        dates = occurrences(item, start, end)
        converted = quantize(Decimal(item["amount"]) * Decimal(item["exchange_rate"]), currency)
        amount = converted * len(dates)
        planned = planned_amount(item, currency, period, start, end)
        if item.get("shared_source_id"):
            # This money is contributed on payday. Its reserve belongs to the
            # common budget, never to both the person and the common account.
            reserve = None
        elif shared_targets:
            from .sharing import shared_reserve

            reserve = shared_reserve(item, currency, shared_targets, settings, today)
        else:
            reserve = reserve_accrual(item, currency, period, date.fromisoformat(anchor), today)
        reserved += Decimal(reserve["reserved_amount"]) if reserve else Decimal(0)
        totals["income" if item["direction"] == "income" else "expenses"] += amount
        plan["income" if item["direction"] == "income" else "expenses"] += planned
        if item["direction"] == "expense":
            if item.get("category") in CATEGORIES:
                totals[item["category"]] += amount
                plan[item["category"]] += planned
            else:
                # Older versions never stored expense categories. Keep their full
                # financial contribution while asking the user to classify them.
                review_count += 1
                review_amount += amount
                review_planned += planned
        # Include next renewal even when it falls outside the selected period.
        next_start = max(today, start, date.fromisoformat(item["renewal_date"]))
        upcoming = next_occurrence(item, next_start)
        entries.append(
            item
            | {
                "period_amount": str(amount),
                "planned_amount": str(planned),
                "reserve": reserve,
                "occurrences": len(dates),
                "next_due": item.get("shared_next_due")
                if item.get("shared_source_id")
                else upcoming.isoformat()
                if upcoming
                else None,
            }
        )
        due.extend(
            {
                "id": item["id"],
                "name": item["name"],
                "date": day.isoformat(),
                "amount": str(converted),
                "direction": item["direction"],
                "category": item["category"],
            }
            for day in dates
        )
    totals["balance"] = totals["income"] - totals["expenses"]
    plan["balance"] = plan["income"] - plan["expenses"]
    account = budget.get("account_balance")
    available = (
        Decimal(account) - Decimal(budget.get("credit_balance") or "0") - reserved if account is not None else None
    )
    return budget | {
        "items": entries,
        "effective_period": period,
        "effective_anchor": anchor,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "period_last_day": (end - timedelta(days=1)).isoformat(),
        "totals": {key: str(quantize(value, currency)) for key, value in totals.items()},
        "plan": {key: str(quantize(value, currency)) for key, value in plan.items()},
        "category_review": {
            "count": review_count,
            "scheduled_amount": str(quantize(review_amount, currency)),
            "planned_amount": str(quantize(review_planned, currency)),
        },
        "reserves": {"amount": str(quantize(reserved, currency)), "as_of": today.isoformat()},
        "available_balance": str(quantize(available, currency)) if available is not None else None,
        "schedule": sorted(due, key=lambda row: (row["date"], row["name"])),
    }
