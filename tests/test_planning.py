"""ALVES reference cases, optional balances, and independent planning/cash flow."""

from datetime import date
from decimal import Decimal

import pytest

from custom_components.autonomous_budget.model import ValidationError, summarize, validate_budget, validate_item
from custom_components.autonomous_budget.planning import planned_amount, reserve_accrual
from custom_components.autonomous_budget.sensor import BudgetSensor


def expense(**values):
    return validate_item(
        {
            "name": "Insurance",
            "amount": "280",
            "currency": "CAD",
            "direction": "expense",
            "recurrence": "monthly",
            "renewal_date": "2026-01-31",
        }
        | values,
        "CAD",
    ) | {"id": "insurance"}


def summary(items, **values):
    return summarize(
        {"id": "home", "name": "Home", "currency": "CAD", "items": items} | values,
        {"period": "biweekly", "anchor": "2026-01-31"},
        date(2026, 2, 1),
    )


@pytest.mark.parametrize(
    ("period", "expected"),
    [
        ("daily", "9.23"),
        ("weekly", "64.62"),
        ("biweekly", "129.23"),
        ("monthly", "280.00"),
        ("yearly", "3360.00"),
    ],
)
def test_monthly_commitment_on_each_pay_scale(period, expected):
    assert planned_amount(expense(), "CAD", period, date(2026, 2, 1), date(2026, 2, 15)) == Decimal(expected)


def test_alves_annual_reserve_23_of_26_paychecks():
    reserve = reserve_accrual(
        expense(amount="365", recurrence="yearly", renewal_date="2026-10-24"),
        "CAD",
        "biweekly",
        date(2026, 10, 24),
        date(2026, 9, 13),
    )
    assert reserve["reserved_amount"] == "322.88"
    assert reserve["total_paychecks"] == 26
    assert reserve["completed_paychecks"] == 23
    assert reserve["remaining_paychecks"] == 3
    assert reserve["next_due"] == "2026-10-24"


def test_alves_annual_due_day_rolls_to_next_cycle():
    reserve = reserve_accrual(
        expense(amount="365", recurrence="yearly", renewal_date="2026-10-24"),
        "CAD",
        "biweekly",
        date(2026, 10, 24),
        date(2026, 10, 24),
    )
    assert reserve["reserved_amount"] == "0.00"
    assert reserve["next_due"] == "2027-10-24"
    assert reserve["completed_paychecks"] == 0


def test_alves_month_end_three_installment_reserve():
    result = summary([expense()])
    assert result["reserves"]["amount"] == "93.33"
    reserve = result["items"][0]["reserve"]
    assert reserve["next_due"] == "2026-02-28"
    assert reserve["completed_paychecks"] == 1
    assert reserve["remaining_paychecks"] == 2
    assert reserve["amount_per_paycheck"] == "93.33"
    assert result["plan"]["expenses"] == "129.23"
    assert result["totals"]["expenses"] == "280.00"


def test_reserve_changes_on_payday_and_counts_due_day_payday_as_remaining():
    item = expense()
    before = reserve_accrual(item, "CAD", "biweekly", date(2026, 1, 31), date(2026, 2, 13))
    on = reserve_accrual(item, "CAD", "biweekly", date(2026, 1, 31), date(2026, 2, 14))
    assert before["reserved_amount"] == "93.33"
    assert on["reserved_amount"] == "186.67"
    assert on["remaining_paychecks"] == 1  # Feb 28, the due date.


def test_manual_available_balance_keeps_negative_and_zero_values():
    result = summary([expense()], account_balance="50", credit_balance="20")
    assert result["available_balance"] == "-63.33"
    assert summary([], account_balance="0", credit_balance="20")["available_balance"] == "-20.00"
    assert summary([], account_balance="-25")["available_balance"] == "-25.00"
    assert summary([expense()])["available_balance"] is None


def test_one_off_stays_in_its_due_period_without_automatic_reserve():
    item = expense(recurrence="once", renewal_date="2026-02-05")
    result = summary([item])
    assert result["items"][0]["reserve"] is None
    assert result["plan"]["expenses"] == result["totals"]["expenses"] == "280.00"
    assert planned_amount(item, "CAD", "biweekly", date(2026, 2, 15), date(2026, 3, 1)) == 0


def test_paused_ended_and_income_entries_do_not_accrue_expense_reserves():
    for item in [
        expense(active=False),
        expense(end_date="2026-01-31"),
        expense(direction="income", category="mandatory"),
    ]:
        assert summary([item])["reserves"]["amount"] == "0.00"
    assert summary([expense(active=False)])["plan"]["expenses"] == "0.00"
    # No future occurrence on/after this period's start, even if end_date is later.
    item = expense(renewal_date="2025-12-01", end_date="2026-02-01", recurrence="yearly")
    assert summary([item])["plan"]["expenses"] == "0.00"


def test_first_renewal_is_saving_target_without_backfilling_cashflow():
    result = summary([expense(renewal_date="2029-01-01")])
    assert result["plan"]["expenses"] == "129.23"
    assert result["totals"]["expenses"] == "0.00"
    assert result["reserves"]["amount"] == "0.00"
    assert result["items"][0]["reserve"]["next_due"] == "2029-01-01"


def test_mixed_fx_income_and_expenses_round_per_entry():
    result = summary(
        [
            expense(amount="2000", recurrence="biweekly", direction="income", category="mandatory"),
            expense(amount="10", currency="USD", exchange_rate="1.35"),
            expense(amount="52", recurrence="yearly"),
            expense(amount="10", recurrence="daily"),
            expense(amount="130", recurrence="quarterly"),
        ]
    )
    assert result["plan"]["income"] == "2000.00"
    assert result["plan"]["mandatory"] == "2000.00"
    assert result["plan"]["expenses"] == "168.23"  # 6.23 + 2 + 140 + 20
    assert result["plan"]["balance"] == "1831.77"


def test_each_budget_payday_override_controls_reserve_independently():
    a = summary([expense()], anchor="2026-01-31")
    b = summary([expense()], anchor="2026-02-01")
    assert a["reserves"]["amount"] == "93.33"
    assert b["reserves"]["amount"] == "186.67"
    assert a["plan"] == b["plan"]


def test_monthly_and_leap_year_paydays_keep_original_anchor():
    item = expense(amount="1200", recurrence="yearly", renewal_date="2026-12-31")
    reserve = reserve_accrual(item, "CAD", "monthly", date(2026, 1, 31), date(2026, 2, 28))
    assert reserve["remaining_paychecks"] == 10
    assert reserve["reserved_amount"] == "200.00"
    leap = reserve_accrual(
        expense(renewal_date="2024-02-29", recurrence="yearly"), "CAD", "yearly", date(2024, 2, 29), date(2025, 2, 28)
    )
    assert leap["next_due"] == "2026-02-28"
    assert leap["remaining_paychecks"] == 1


def test_navigation_never_shifts_today_reserves_or_manual_available():
    budget = {"id": "home", "name": "Home", "currency": "CAD", "items": [expense()], "account_balance": "1000"}
    defaults = {"period": "biweekly", "anchor": "2026-01-31"}
    now = summarize(budget, defaults, date(2026, 2, 1))
    future = summarize(budget, defaults, date(2026, 2, 1), 10)
    assert now["reserves"] == future["reserves"]
    assert now["available_balance"] == future["available_balance"]
    assert now["period_start"] != future["period_start"]


@pytest.mark.parametrize(
    "values",
    [
        {"account_balance": "NaN"},
        {"account_balance": True},
        {"account_balance": "Infinity"},
        {"account_balance": "1000000001"},
        {"account_balance": "-1000000001"},
        {"account_balance": "1.001"},
        {"credit_balance": "-1"},
        {"credit_balance": "NaN"},
    ],
)
def test_manual_balances_reject_invalid_values(values):
    with pytest.raises(ValidationError):
        validate_budget({"name": "Home", "currency": "CAD"} | values)


def test_optional_balances_and_currency_precision():
    budget = validate_budget({"name": "Home", "currency": "CAD", "account_balance": "-12.34", "credit_balance": ""})
    assert budget["account_balance"] == "-12.34"
    assert budget["credit_balance"] == "0.00"
    assert validate_budget({"name": "Home", "currency": "CAD"})["account_balance"] is None
    with pytest.raises(ValidationError):
        validate_budget({"name": "Home", "currency": "JPY", "account_balance": "0.01"})


def test_native_sensor_values_keep_legacy_cashflow_and_add_planning_metrics():
    class SnapshotStore:
        def snapshot(self):
            return {"budgets": [summary([expense()], account_balance="50", credit_balance="20")]}

    store = SnapshotStore()
    assert BudgetSensor(store, "home", "expenses").native_value == "280.00"
    assert BudgetSensor(store, "home", "planned_expenses").native_value == "129.23"
    assert BudgetSensor(store, "home", "reserved").native_value == "93.33"
    assert BudgetSensor(store, "home", "available_balance").native_value == "-63.33"
