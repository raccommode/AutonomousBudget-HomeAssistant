"""Shared contributions: money conservation, individual paydays, and durable links."""

from copy import deepcopy
from datetime import date
from decimal import Decimal

import pytest
from homeassistant.core import HomeAssistant

from custom_components.autonomous_budget.model import ValidationError, validate_budget, validate_item
from custom_components.autonomous_budget.sharing import shared_reserve, split_amount, summarize_budgets
from custom_components.autonomous_budget.store import BudgetStore

SETTINGS = {"period": "biweekly", "anchor": "2026-07-16", "currency": "CAD"}


@pytest.fixture
async def store(tmp_path):
    hass = HomeAssistant(str(tmp_path))
    await hass.config.async_set_time_zone("America/Toronto")
    instance = BudgetStore(hass)
    await instance.async_load(SETTINGS)
    yield instance
    await hass.async_stop()


def budget(identifier, **changes):
    return validate_budget({"name": identifier, "currency": "CAD"} | changes) | {"id": identifier, "items": []}


def bill(**changes):
    return validate_item(
        {
            "name": "Rent",
            "amount": "2600",
            "currency": "CAD",
            "direction": "expense",
            "category": "mandatory",
            "recurrence": "monthly",
            "renewal_date": "2026-01-01",
        }
        | changes,
        "CAD",
    ) | {"id": "rent"}


def household():
    return [
        budget("Axel", anchor="2026-07-16"),
        budget("Marie", anchor="2026-07-23"),
        budget(
            "Common",
            kind="shared",
            allocations=[
                {"budget_id": "Axel", "percentage": "60"},
                {"budget_id": "Marie", "percentage": "40"},
            ],
        )
        | {"items": [bill()]},
    ]


def test_automatic_mandatory_expenses_follow_each_person_payday_and_stay_derived():
    data = household()
    original = deepcopy(data)
    axel, marie, common = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0)
    assert axel["plan"]["mandatory"] == axel["totals"]["expenses"] == "720.00"
    assert marie["plan"]["mandatory"] == marie["totals"]["expenses"] == "480.00"
    assert axel["items"][0]["next_due"] == "2026-08-13"
    assert marie["items"][0]["next_due"] == "2026-08-06"
    assert axel["schedule"][0]["date"] == "2026-07-30"
    assert marie["schedule"][0]["date"] == "2026-07-23"
    assert axel["items"][0]["locked"] is True
    assert axel["items"][0]["shared_source_id"] == "Common"
    assert common["sharing"]["unallocated_percentage"] == "0"
    assert data == original  # No duplicates in persistence or on repeated refreshes.
    assert summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0) == [axel, marie, common]


def test_each_frequency_and_inherited_defaults_are_respected():
    data = household()
    data[0]["period"] = "weekly"
    data[1]["period"] = "monthly"
    axel, marie, _ = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0)
    assert axel["plan"]["expenses"] == "360.00"
    assert marie["plan"]["expenses"] == "1040.00"
    data[0]["period"] = None
    data[0]["anchor"] = None
    axel = summarize_budgets(data, SETTINGS | {"period": "yearly", "anchor": "2026-01-01"}, date(2026, 8, 1), 0)[0]
    assert axel["plan"]["expenses"] == "18720.00"
    assert axel["schedule"][0]["date"] == "2026-01-01"


def test_paused_ended_income_fx_and_one_off_source_entries():
    data = household()
    data[2]["items"] = [
        bill(amount="999", active=False),
        bill(amount="888", end_date="2026-01-31"),
        bill(amount="777", direction="income"),
        bill(amount="10", currency="USD", exchange_rate="1.3", recurrence="biweekly"),
        bill(amount="100", recurrence="once", renewal_date="2026-08-05"),
    ]
    axel, marie, _ = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0)
    assert axel["plan"]["expenses"] == "67.80"
    assert marie["plan"]["expenses"] == "45.20"
    future = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 1)
    assert future[0]["plan"]["expenses"] == "7.80"
    assert future[1]["plan"]["expenses"] == "5.20"
    data[2]["items"] = [bill(amount="100", recurrence="once", renewal_date="2026-08-05")]
    axel = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0)[0]
    assert axel["items"][0]["next_due"] is None  # Already allocated on July 30, never recurs.
    assert summarize_budgets(data, SETTINGS, date(2026, 8, 1), 1)[0]["plan"]["expenses"] == "0.00"


@pytest.mark.parametrize("currency,amount", [("CAD", "0.01"), ("JPY", "1"), ("KWD", "0.001")])
def test_largest_remainder_preserves_minor_units(currency, amount):
    allocations = [{"budget_id": "B", "percentage": "50"}, {"budget_id": "A", "percentage": "50"}]
    result = split_amount(Decimal(amount), allocations, currency)
    assert sum(result.values()) == Decimal(amount)
    assert result["A"] == Decimal(amount)
    assert result["B"] == 0
    assert split_amount(Decimal(amount), allocations[::-1], currency) == result


def test_partial_allocation_and_multiple_shared_budgets():
    data = household()
    data[2]["allocations"] = [{"budget_id": "Axel", "percentage": "60"}]
    data.append(
        budget("Holiday", kind="shared", allocations=[{"budget_id": "Axel", "percentage": "100"}])
        | {
            "items": [bill(amount="100", recurrence="biweekly")],
        }
    )
    axel, marie, common, _ = summarize_budgets(data, SETTINGS, date(2026, 8, 1), 0)
    assert axel["plan"]["expenses"] == "820.00"
    assert len(axel["items"]) == 2
    assert len({row["id"] for row in axel["items"]}) == 2
    assert marie["items"] == []
    assert common["sharing"]["unallocated_percentage"] == "40"


def test_alves_alternating_paydays_reserve_is_only_in_common_account():
    data = household()
    data[2]["items"] = [bill(amount="100", recurrence="biweekly", renewal_date="2026-07-16")]
    data[0]["account_balance"] = data[1]["account_balance"] = data[2]["account_balance"] = "500.00"
    assert summarize_budgets(data, SETTINGS, date(2026, 7, 16), 0)[2]["reserves"]["amount"] == "0.00"
    axel, marie, common = summarize_budgets(data, SETTINGS, date(2026, 7, 23), 0)
    assert axel["reserves"]["amount"] == marie["reserves"]["amount"] == "0.00"
    assert axel["available_balance"] == marie["available_balance"] == "500.00"
    assert common["reserves"]["amount"] == "40.00"
    assert common["available_balance"] == "460.00"
    reserve = common["items"][0]["reserve"]
    assert reserve["completed_paychecks"] == 1
    assert reserve["progress"] == 0.4
    assert reserve["shared"] is True
    assert summarize_budgets(data, SETTINGS, date(2026, 7, 23), 10)[2]["reserves"] == common["reserves"]
    assert summarize_budgets(data, SETTINGS, date(2026, 7, 30), 0)[2]["reserves"]["amount"] == "0.00"


def test_month_end_reserve_and_annual_daily_schedule_are_bounded():
    item = bill(amount="100", renewal_date="2026-01-31")
    target = budget("A", period="monthly", anchor="2026-01-31")
    result = shared_reserve(item, "CAD", [(target, Decimal(100))], SETTINGS, date(2026, 3, 30))
    assert result["reserved_amount"] == "0.00"  # Feb 28 payday consumed, March 31 still due.
    item = bill(amount="364", recurrence="yearly", renewal_date="2026-12-31")
    target = budget("A", period="daily", anchor="2026-01-01")
    result = shared_reserve(item, "CAD", [(target, Decimal(100))], SETTINGS, date(2026, 12, 30))
    assert result["reserved_amount"] == "364.00"
    assert result["completed_paychecks"] == 364


@pytest.mark.parametrize("percentage", ["-1", "100.01", "NaN", True, "0.001"])
def test_invalid_percentages_rejected(percentage):
    with pytest.raises(ValidationError):
        budget("Common", kind="shared", allocations=[{"budget_id": "A", "percentage": percentage}])


async def mutate(store, action, payload):
    return await store.async_mutate(action, payload, store.data["revision"])


async def test_links_persist_sync_rename_and_delete_without_changing_other_peoples_shares(store):
    a = (await mutate(store, "budget_create", {"name": "A", "currency": "CAD"}))["id"]
    b = (await mutate(store, "budget_create", {"name": "B", "currency": "CAD"}))["id"]
    common = (
        await mutate(
            store,
            "budget_create",
            {
                "name": "Common",
                "currency": "CAD",
                "kind": "shared",
                "allocations": [
                    {"budget_id": a, "percentage": "60"},
                    {"budget_id": b, "percentage": "40"},
                ],
            },
        )
    )["id"]
    item = (await mutate(store, "item_create", bill(recurrence="biweekly", amount="100") | {"budget_id": common}))["id"]
    assert store.snapshot()["budgets"][0]["plan"]["expenses"] == "60.00"
    fresh = BudgetStore(store.hass)
    await fresh.async_load(SETTINGS)
    assert fresh.data == store.data
    assert fresh.data["budgets"][0]["items"] == []
    original_id = fresh.snapshot()["budgets"][0]["items"][0]["id"]
    await mutate(fresh, "budget_update", {"budget_id": common, "name": "Household"})
    await mutate(
        fresh, "item_update", bill(recurrence="biweekly", amount="200") | {"budget_id": common, "item_id": item}
    )
    assert fresh.snapshot()["budgets"][0]["items"][0]["id"] == original_id
    assert fresh.snapshot()["budgets"][0]["items"][0]["name"] == "Household"
    assert fresh.snapshot()["budgets"][0]["plan"]["expenses"] == "120.00"
    with pytest.raises(ValidationError, match="Automatic contributions"):
        await mutate(fresh, "item_delete", {"budget_id": a, "item_id": original_id})
    with pytest.raises(ValidationError, match="Automatic contributions"):
        await mutate(fresh, "item_update", bill() | {"budget_id": a, "item_id": original_id})
    await mutate(fresh, "budget_delete", {"budget_id": b})
    assert fresh.snapshot()["budgets"][1]["sharing"]["unallocated_percentage"] == "40"
    assert fresh.snapshot()["budgets"][0]["plan"]["expenses"] == "120.00"
    await mutate(fresh, "budget_delete", {"budget_id": common})
    assert fresh.snapshot()["budgets"][0]["items"] == []


async def test_link_validation_rejects_cycles_duplicates_missing_currency_and_overallocation_atomically(store):
    a = (await mutate(store, "budget_create", {"name": "A", "currency": "CAD"}))["id"]
    foreign = (await mutate(store, "budget_create", {"name": "USD", "currency": "USD"}))["id"]
    common = (await mutate(store, "budget_create", {"name": "Common", "currency": "CAD", "kind": "shared"}))["id"]
    for rows in [
        [{"budget_id": common, "percentage": "50"}],
        [{"budget_id": "missing", "percentage": "50"}],
        [{"budget_id": foreign, "percentage": "50"}],
        [{"budget_id": a, "percentage": "50"}] * 2,
    ]:
        original = deepcopy(store.data)
        with pytest.raises(ValidationError):
            await mutate(store, "budget_update", {"budget_id": common, "allocations": rows})
        assert store.data == original
        assert await store.storage.async_load() == original
    b = (await mutate(store, "budget_create", {"name": "B", "currency": "CAD"}))["id"]
    with pytest.raises(ValidationError, match="100%"):
        await mutate(
            store,
            "budget_update",
            {
                "budget_id": common,
                "allocations": [
                    {"budget_id": a, "percentage": "60"},
                    {"budget_id": b, "percentage": "60"},
                ],
            },
        )
    await mutate(store, "budget_update", {"budget_id": common, "allocations": [{"budget_id": a, "percentage": "100"}]})
    for update in [
        {"budget_id": a, "currency": "USD"},
        {"budget_id": a, "kind": "shared"},
        {"budget_id": common, "kind": "personal"},
    ]:
        with pytest.raises(ValidationError):
            await mutate(store, "budget_update", update)
    await mutate(store, "budget_update", {"budget_id": common, "allocations": []})
    assert store.snapshot()["budgets"][0]["items"] == []
