"""Home Assistant roles guard creation while household members can edit."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from homeassistant.core import HomeAssistant

from custom_components.autonomous_budget.finance import Finance
from custom_components.autonomous_budget.finance_api import websocket_finance
from custom_components.autonomous_budget.store import BudgetStore
from custom_components.autonomous_budget.websocket import websocket_mutate


@pytest.fixture
async def store(tmp_path):
    hass = HomeAssistant(str(tmp_path))
    result = BudgetStore(hass)
    await result.async_load({"currency": "CAD", "period": "biweekly", "anchor": "2026-08-28"})
    hass.data["autonomous_budget"] = {"store": result}
    yield result
    await hass.async_stop()


def connection(admin=False):
    return SimpleNamespace(user=SimpleNamespace(id="bob", is_admin=admin), send_error=Mock(), send_result=Mock())


async def test_non_admin_can_edit_budgets_but_cannot_create(store):
    budget = await store.async_mutate("budget_create", {"name": "Household", "currency": "CAD"}, 0)
    conn = connection()
    await websocket_mutate.__wrapped__(
        store.hass,
        conn,
        {"id": 1, "action": "budget_create", "payload": {"name": "Forbidden", "currency": "CAD"}, "revision": 1},
    )
    assert "administrator" in conn.send_error.call_args.args[2]
    conn.send_error.reset_mock()
    await websocket_mutate.__wrapped__(
        store.hass,
        conn,
        {
            "id": 2,
            "action": "budget_update",
            "payload": {"budget_id": budget["id"], "name": "Renamed by member"},
            "revision": 1,
        },
    )
    conn.send_error.assert_not_called()
    assert store.data["budgets"][0]["name"] == "Renamed by member"


@pytest.mark.parametrize(
    ("command", "payload"),
    [
        ("save", {"kind": "account", "name": "Forbidden", "currency": "CAD", "opening_date": "2026-01-01"}),
        ("save", {"kind": "connection", "name": "Forbidden", "api_key": "fixture-key"}),
        ("save", {"kind": "instrument", "name": "Forbidden", "currency": "CAD"}),
        ("provider_create_account", {"connection_id": "missing", "remote_id": "42", "account": {}}),
        ("restore", {"backup": {}}),
    ],
)
async def test_finance_websocket_rejects_non_admin_record_creation(store, command, payload):
    conn = connection()
    await websocket_finance.__wrapped__(store.hass, conn, {"id": 1, "command": command, "payload": payload})
    assert "administrator" in conn.send_error.call_args.args[2]
    assert Finance(store.storage.path).query("bob", "snapshot")["objects"] == []


async def test_non_admin_reads_and_edits_other_creator_account(store):
    engine = Finance(store.storage.path)
    acc = engine.mutate(
        "alice",
        "save",
        {
            "kind": "account",
            "name": "Household",
            "currency": "CAD",
            "opening_date": "2026-01-01",
            "opening_balance": "100",
        },
    )
    conn = connection()
    await websocket_finance.__wrapped__(
        store.hass,
        conn,
        {
            "id": 1,
            "command": "save",
            "payload": {"kind": "account", "id": acc["id"], "name": "Changed by Bob", "assigned_user_id": None},
        },
    )
    conn.send_error.assert_not_called()
    assert conn.send_result.call_args.args[1]["name"] == "Changed by Bob"
    await websocket_finance.__wrapped__(
        store.hass,
        conn,
        {"id": 2, "command": "transaction", "payload": {"account_id": acc["id"], "date": "2026-09-01", "amount": "-5"}},
    )
    conn.send_error.assert_not_called()
    assert engine.query("bob", "transactions")["total"] == 1
