"""Verify persistence, concurrent edits, and failure atomicity with real HA Store."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.autonomous_budget.model import ValidationError
from custom_components.autonomous_budget.store import BudgetStore

DEFAULTS = {"currency": "CAD", "period": "biweekly", "anchor": "2026-08-28"}


@pytest.fixture
async def store(tmp_path):
    hass = HomeAssistant(str(tmp_path))
    await hass.config.async_set_time_zone("America/Toronto")
    store = BudgetStore(hass)
    await store.async_load(DEFAULTS)
    yield store
    await hass.async_stop()


async def test_survives_a_new_store_instance_and_renaming(store):
    result = await store.async_mutate("budget_create", {"name": "Home", "currency": "CAD"}, 0)
    budget_id = result["id"]
    await store.async_mutate("budget_update", {"budget_id": budget_id, "name": "Household", "currency": "CAD"}, 1)
    fresh = BudgetStore(store.hass)
    await fresh.async_load(DEFAULTS | {"currency": "EUR"})
    assert fresh.data == store.data
    assert fresh.data["budgets"][0]["id"] == budget_id
    assert fresh.data["settings"]["currency"] == "CAD"
    assert fresh.data["revision"] == 2


async def test_failed_save_does_not_publish_or_change_memory(store):
    store.storage.async_save = AsyncMock(side_effect=OSError("disk full"))
    with pytest.raises(OSError):
        await store.async_mutate("budget_create", {"name": "Home", "currency": "CAD"}, 0)
    assert store.data["budgets"] == []
    assert store.data["revision"] == 0


async def test_simultaneous_writes_reject_stale_revision(store):
    results = await asyncio.gather(
        *[store.async_mutate("budget_create", {"name": name, "currency": "CAD"}, 0) for name in ("A", "B")],
        return_exceptions=True,
    )
    assert sum(isinstance(result, ValidationError) for result in results) == 1
    assert len(store.data["budgets"]) == 1


async def test_complete_entry_lifecycle_and_currency_guard(store):
    budget_id = (await store.async_mutate("budget_create", {"name": "Home", "currency": "CAD"}, 0))["id"]
    payload = {
        "budget_id": budget_id,
        "name": "Netflix",
        "amount": "15.99",
        "currency": "CAD",
        "direction": "expense",
        "category": "optional",
        "recurrence": "monthly",
        "renewal_date": "2026-09-03",
    }
    item_id = (await store.async_mutate("item_create", payload, 1))["id"]
    with pytest.raises(ValidationError):
        await store.async_mutate("budget_update", {"budget_id": budget_id, "name": "Home", "currency": "USD"}, 2)
    await store.async_mutate("item_update", payload | {"item_id": item_id, "amount": "17.99"}, 2)
    assert store.data["budgets"][0]["items"][0]["amount"] == "17.99"
    await store.async_mutate("item_delete", {"budget_id": budget_id, "item_id": item_id}, 3)
    assert store.data["budgets"][0]["items"] == []
    await store.async_mutate("budget_delete", {"budget_id": budget_id}, 4)
    assert store.data["budgets"] == []


async def test_snapshot_uses_home_assistant_timezone(store, monkeypatch):
    from datetime import UTC, datetime

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 9, 11, 2, tzinfo=UTC).astimezone(tz)

    monkeypatch.setattr(dt_util.dt, "datetime", FixedDateTime)
    assert store.snapshot()["today"] == "2026-09-10"


async def test_v010_store_loads_without_rewriting_and_balances_survive_edits(store):
    legacy = {
        "revision": 7,
        "settings": DEFAULTS,
        "budgets": [{"id": "old-budget", "name": "Original", "currency": "CAD", "items": []}],
    }
    await store.storage.async_save(legacy)
    fresh = BudgetStore(store.hass)
    await fresh.async_load(DEFAULTS)
    assert fresh.data == legacy
    snapshot = fresh.snapshot()["budgets"][0]
    assert snapshot["available_balance"] is None
    assert snapshot["plan"]["balance"] == "0.00"
    assert snapshot["effective_period"] == "biweekly"
    await fresh.async_mutate(
        "budget_update", {"budget_id": "old-budget", "account_balance": "200", "credit_balance": "20"}, 7
    )
    await fresh.async_mutate("budget_update", {"budget_id": "old-budget", "name": "Renamed"}, 8)
    assert fresh.snapshot()["budgets"][0]["available_balance"] == "180.00"
    reloaded = BudgetStore(store.hass)
    await reloaded.async_load(DEFAULTS)
    assert reloaded.data == fresh.data
    await reloaded.async_mutate("budget_update", {"budget_id": "old-budget", "account_balance": ""}, 9)
    assert reloaded.snapshot()["budgets"][0]["available_balance"] is None
