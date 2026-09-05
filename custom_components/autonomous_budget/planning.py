"""Pay-period planning and theoretical reserves for recurring commitments."""

from datetime import date, timedelta
from decimal import ROUND_CEILING, Decimal

from .model import add_months, occurrences, quantize

# A planning year uses 52 weeks / 26 paychecks, matching ALVES. This also keeps
# daily-to-biweekly conversion exactly 14, independently of calendar due dates.
FREQUENCIES = {"daily": 364, "weekly": 52, "biweekly": 26, "monthly": 12, "quarterly": 4, "yearly": 1}


def next_occurrence(item: dict, on_or_after: date) -> date | None:
    """Find one future occurrence without expanding a daily schedule into a year."""
    if not item["active"]:
        return None
    anchor = date.fromisoformat(item["renewal_date"])
    start = max(anchor, on_or_after)
    recurrence = item["recurrence"]
    if recurrence == "once":
        due = anchor if anchor >= start else None
    elif recurrence in ("daily", "weekly", "biweekly"):
        days = {"daily": 1, "weekly": 7, "biweekly": 14}[recurrence]
        index = ((start - anchor).days + days - 1) // days
        due = anchor + timedelta(days=index * days)
    else:
        months = {"monthly": 1, "quarterly": 3, "yearly": 12}[recurrence]
        index = ((start.year - anchor.year) * 12 + start.month - anchor.month) // months
        due = add_months(anchor, index * months)
        if due < start:
            due = add_months(anchor, (index + 1) * months)
    if due and item.get("end_date") and due > date.fromisoformat(item["end_date"]):
        return None
    return due


def planned_amount(item: dict, currency: str, period: str, start: date, end: date) -> Decimal:
    """Normalize live recurring commitments; count one-offs only when due."""
    amount = Decimal(item["amount"]) * Decimal(item["exchange_rate"])
    if item["recurrence"] == "once":
        return quantize(amount, currency) * len(occurrences(item, start, end))
    if next_occurrence(item, start) is None:
        return quantize(Decimal(0), currency)
    return quantize(amount * FREQUENCIES[item["recurrence"]] / FREQUENCIES[period], currency)


def income_on_date(items: list[dict], currency: str, day: date, period: str) -> bool:
    """Match a positive income on this date with the budget's pay frequency."""
    return any(
        item["direction"] == "income"
        and item["recurrence"] == period
        and quantize(Decimal(item["amount"]) * Decimal(item["exchange_rate"]), currency) > 0
        and next_occurrence(item, day) == day
        for item in items
    )


def period_index(day: date, period: str, anchor: date) -> int:
    """Index of the last payday on or before a date, including before the anchor."""
    if period in ("daily", "weekly", "biweekly"):
        return (day - anchor).days // {"daily": 1, "weekly": 7, "biweekly": 14}[period]
    months = 12 if period == "yearly" else 1
    index = ((day.year - anchor.year) * 12 + day.month - anchor.month) // months
    return index - (add_months(anchor, index * months) > day)


def reserve_accrual(item: dict, currency: str, period: str, anchor: date, today: date) -> dict | None:
    """ALVES-style reserve, rolled forward on the due date and advanced on paydays.

    The current due date is treated as paid for this projection. A payday on the
    next due date counts as still remaining. No bank transactions are inferred.
    One-offs are included in cash flow but have no automatic reserve schedule.
    """
    if item["direction"] != "expense" or item["recurrence"] == "once":
        return None
    due = next_occurrence(item, today + timedelta(days=1))
    amount = quantize(Decimal(item["amount"]) * Decimal(item["exchange_rate"]), currency)
    if due is None or amount == 0:
        return None
    ratio = Decimal(FREQUENCIES[period]) / FREQUENCIES[item["recurrence"]]
    total = max(1, int(ratio.to_integral_value(rounding=ROUND_CEILING)))
    remaining = min(total, max(0, period_index(due, period, anchor) - period_index(today, period, anchor)))
    completed = total - remaining
    return {
        "next_due": due.isoformat(),
        "required_amount": str(amount),
        "reserved_amount": str(quantize(amount * completed / total, currency)),
        "amount_per_paycheck": str(quantize(amount / total, currency)),
        "total_paychecks": total,
        "completed_paychecks": completed,
        "remaining_paychecks": remaining,
        "progress": completed / total,
    }
