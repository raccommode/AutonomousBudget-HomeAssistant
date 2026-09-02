"""Calendar and monetary edge cases with explicit expected outcomes."""

from datetime import date

import pytest

from custom_components.autonomous_budget.model import (
    ValidationError,
    occurrences,
    period_bounds,
    summarize,
    validate_item,
)


def entry(**changes):
    return validate_item(
        {
            "name": "Netflix",
            "direction": "expense",
            "category": "optional",
            "amount": "15.99",
            "currency": "CAD",
            "exchange_rate": "1",
            "recurrence": "monthly",
            "renewal_date": "2024-01-31",
            "active": True,
        }
        | changes,
        "CAD",
    ) | {"id": "netflix"}


def test_month_end_does_not_drift_after_february():
    assert occurrences(entry(), date(2024, 1, 1), date(2024, 5, 1)) == [
        date(2024, 1, 31),
        date(2024, 2, 29),
        date(2024, 3, 31),
        date(2024, 4, 30),
    ]


def test_leap_day_yearly_recurrence_recovers():
    assert occurrences(entry(recurrence="yearly", renewal_date="2024-02-29"), date(2025, 1, 1), date(2029, 1, 1)) == [
        date(2025, 2, 28),
        date(2026, 2, 28),
        date(2027, 2, 28),
        date(2028, 2, 29),
    ]


@pytest.mark.parametrize(
    ("today", "expected"),
    [
        (date(2026, 9, 2), (date(2026, 8, 28), date(2026, 9, 11))),
        (date(2026, 9, 11), (date(2026, 9, 11), date(2026, 9, 25))),
        (date(2026, 8, 27), (date(2026, 8, 14), date(2026, 8, 28))),
    ],
)
def test_two_week_periods_before_and_after_payday(today, expected):
    assert period_bounds(today, "biweekly", date(2026, 8, 28)) == expected


def test_anchor_on_31st_keeps_calendar_periods_contiguous():
    assert period_bounds(date(2025, 2, 28), "monthly", date(2025, 1, 31)) == (date(2025, 2, 28), date(2025, 3, 31))
    assert period_bounds(date(2025, 3, 30), "monthly", date(2025, 1, 31)) == (date(2025, 2, 28), date(2025, 3, 31))
    assert period_bounds(date(2025, 3, 31), "monthly", date(2025, 1, 31)) == (date(2025, 3, 31), date(2025, 4, 30))


@pytest.mark.parametrize("period,days", [("daily", 1), ("weekly", 7), ("biweekly", 14)])
def test_fixed_period_lengths(period, days):
    start, end = period_bounds(date(2026, 9, 2), period, date(2026, 1, 1))
    assert (end - start).days == days


def test_yearly_leap_anchor_and_offset():
    assert period_bounds(date(2025, 2, 28), "yearly", date(2024, 2, 29), 3) == (date(2028, 2, 29), date(2029, 2, 28))


def test_actual_cashflow_with_mixed_currencies_and_categories():
    items = [
        entry(
            name="Paycheck",
            direction="income",
            category="mandatory",
            amount="2000",
            recurrence="biweekly",
            renewal_date="2026-08-28",
        ),
        entry(name="Rent", category="mandatory", amount="800", renewal_date="2026-09-01"),
        entry(amount="10", currency="USD", exchange_rate="1.35", renewal_date="2026-09-03"),
        entry(name="Savings", amount="100", category="investment", recurrence="weekly", renewal_date="2026-08-28"),
        entry(name="Outside period", amount="999", renewal_date="2026-09-11"),
    ]
    result = summarize(
        {"id": "home", "name": "Home", "currency": "CAD", "items": items},
        {"period": "biweekly", "anchor": "2026-08-28"},
        date(2026, 9, 2),
    )
    assert result["totals"] == {
        "income": "2000.00",
        "expenses": "1013.50",
        "mandatory": "800.00",
        "investment": "200.00",
        "optional": "13.50",
        "balance": "986.50",
    }
    assert result["items"][-1]["period_amount"] == "0.00"
    assert result["items"][-1]["next_due"] == "2026-09-11"
    assert result["period_last_day"] == "2026-09-10"


def test_one_off_pause_and_inclusive_end_date():
    assert occurrences(entry(active=False), date(2024, 1, 1), date(2025, 1, 1)) == []
    one = entry(recurrence="once")
    assert occurrences(one, date(2024, 1, 31), date(2024, 2, 1)) == [date(2024, 1, 31)]
    assert occurrences(one, date(2024, 2, 1), date(2024, 3, 1)) == []
    assert occurrences(entry(end_date="2024-02-29"), date(2024, 1, 1), date(2025, 1, 1)) == [
        date(2024, 1, 31),
        date(2024, 2, 29),
    ]


def test_no_occurrences_before_start_date():
    assert occurrences(entry(renewal_date="2027-01-01"), date(2026, 1, 1), date(2027, 1, 1)) == []


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", "-1", "1e500", True, "", None, "0.001"])
def test_invalid_amounts_rejected(value):
    with pytest.raises(ValidationError):
        entry(amount=value)


@pytest.mark.parametrize(
    "changes",
    [
        {"currency": "FAKE"},
        {"direction": "out"},
        {"category": "other"},
        {"recurrence": "never"},
        {"name": "   "},
        {"renewal_date": "2026-02-30"},
        {"end_date": "2023-01-01"},
        {"active": "false"},
        {"currency": "USD", "exchange_rate": "0"},
        {"currency": "USD", "exchange_rate": "NaN"},
    ],
)
def test_invalid_fields_rejected(changes):
    with pytest.raises(ValidationError):
        entry(**changes)


def test_currency_precision_and_round_half_up():
    with pytest.raises(ValidationError):
        entry(currency="JPY", amount="100.5", exchange_rate="0.01")
    assert entry(currency="KWD", amount="10.123", exchange_rate="4.50")["amount"] == "10.123"
    result = summarize(
        {
            "id": "x",
            "name": "X",
            "currency": "CAD",
            "items": [entry(currency="USD", amount="0.05", exchange_rate="1.1", recurrence="once")],
        },
        {"period": "monthly", "anchor": "2024-01-01"},
        date(2024, 1, 1),
    )
    assert result["totals"]["expenses"] == "0.06"
