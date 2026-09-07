"""Lunch Flow account lifecycle, full history and broker position snapshots."""

import asyncio
from types import SimpleNamespace

import pytest
from test_finance import account

from custom_components.autonomous_budget import providers
from custom_components.autonomous_budget.database import connect, initialize
from custom_components.autonomous_budget.finance import Finance, get
from custom_components.autonomous_budget.model import ValidationError


@pytest.fixture
def engine(tmp_path):
    result = Finance(str(tmp_path / "ledger.sqlite"))
    initialize(result.path)
    return result


@pytest.fixture
def bank(engine, monkeypatch):
    connection = engine.mutate("alice", "save", {"kind": "connection", "name": "Original", "api_key": "fixture-key"})
    state = {"rows": [], "holdings": {"holdings": []}, "calls": []}

    async def executor(fn, *args):
        return await asyncio.to_thread(fn, *args)

    hass = SimpleNamespace(
        data={"autonomous_budget": {"store": SimpleNamespace(storage=SimpleNamespace(path=engine.path))}},
        async_add_executor_job=executor,
    )

    async def request(hass, url, headers=None, params=None, optional=False):
        state["calls"].append((url, params))
        assert headers == {"x-api-key": "fixture-key"}
        if url.endswith("/accounts"):
            return {"accounts": [{"id": 42, "name": "Broker account", "currency": "CAD"}]}
        if url.endswith("/transactions"):
            return {"transactions": state["rows"], "total": len(state["rows"])}
        if url.endswith("/balance"):
            return {"balance": {"amount": 800, "currency": "CAD"}}
        if url.endswith("/holdings"):
            return state["holdings"]
        raise AssertionError(url)

    monkeypatch.setattr(providers, "request", request)

    async def command(action, actor="alice", **payload):
        return await providers.provider_command(hass, actor, action, {"connection_id": connection["id"], **payload})

    return connection, state, command


async def test_full_history_preserves_opening_balance_reconciliation_and_restore(engine, bank, tmp_path):
    connection, state, command = bank
    acc = account(engine, opening_date="2026-01-01", opening_balance="1000")
    state["rows"] = [
        {"id": "old", "date": "2018-01-01", "amount": -50, "description": "Old purchase", "currency": "CAD"},
        {"id": "recent", "date": "2026-02-01", "amount": -200, "currency": "CAD"},
    ]
    mapping = await command("provider_map", account_id=acc["id"], remote_id="42", **{"from": "2026-09-01"})
    assert mapping["from"] is None and mapping["remote_name"] == "Broker account"
    preview = await command("provider_preview")
    assert preview["added"] == 2 and preview["conflicts"] == 0
    assert engine.query("alice", "transactions")["total"] == 0
    await command("provider_sync", confirm_initial=True)
    await command("provider_sync")
    assert all(params == {"include_pending": "true"} for url, params in state["calls"] if url.endswith("/transactions"))
    rows = engine.query("alice", "transactions")["rows"]
    assert len(rows) == 2
    historical = next(t for t in rows if t["historical"])
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["balance"] == "800.00"
    engine.mutate("alice", "transaction", historical | {"notes": "Categorized later"})
    statement = engine.mutate("alice", "reconcile", {"account_id": acc["id"], "date": "2026-03-01", "balance": "800"})
    assert historical["id"] not in statement["transaction_ids"]
    assert len(statement["transaction_ids"]) == 1
    state["rows"][0]["amount"] = -75
    await command("provider_sync")
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["balance"] == "800.00"
    restored = Finance(str(tmp_path / "restored.sqlite"))
    initialize(restored.path)
    restored.mutate("alice", "restore", {"backup": engine.query("alice", "export")})
    assert restored.query("alice", "transactions")["total"] == 2
    accounts = [o for o in restored.query("alice", "snapshot")["objects"] if o["kind"] == "account"]
    assert accounts[0]["balance"] == "800.00"
    assert (
        next(t for t in restored.query("alice", "transactions")["rows"] if t["historical"])["notes"]
        == "Categorized later"
    )


async def test_rename_unlink_preserve_key_history_and_reject_old_sync(engine, bank):
    connection, state, command = bank
    acc = account(engine)
    mapping = await command("provider_map", account_id=acc["id"], remote_id="42")
    rename = engine.mutate("alice", "save", {"kind": "connection", "id": connection["id"], "name": "My bank"})
    assert rename["name"] == "My bank" and "api_key" not in rename
    with connect(engine.path) as db:
        assert get(db, connection["id"])["api_key"] == "fixture-key"
    with pytest.raises(ValidationError, match="Access denied"):
        await command("provider_unmap", actor="bob", mapping_id=mapping["id"])
    await command("provider_unmap", mapping_id=mapping["id"])
    assert not any(o["kind"] == "mapping" for o in engine.query("alice", "snapshot")["objects"])
    new_mapping = await command("provider_map", account_id=acc["id"], remote_id="42")
    assert new_mapping["version"] != mapping["version"]
    with pytest.raises(ValidationError, match="mapping changed"):
        providers.apply_sync(
            engine.path, "alice", connection["id"], [{"mapping": mapping, "transactions": [], "balance": {}}]
        )
    await command("provider_disconnect")
    engine.mutate("alice", "save", {"kind": "connection", "id": connection["id"], "name": "Disconnected bank"})
    await command("provider_unmap", mapping_id=new_mapping["id"])
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["balance"] == acc["opening_balance"]


async def test_auto_holdings_in_portfolio_and_wealth_without_fake_trades(engine, bank, tmp_path):
    _, state, command = bank
    acc = account(engine, type="investment", opening_balance="100")
    state["holdings"] = {
        "holdings": [
            {
                "security": {"name": "Example stock", "tickerSymbol": "EX", "isin": "CA123", "currency": "CAD"},
                "quantity": 5,
                "price": 20,
                "value": 100,
                "costBasis": 80,
            },
            {
                "security": {"name": "Bitcoin", "tickerSymbol": "BTC", "currency": "CAD"},
                "quantity": "0.1",
                "price": 1000,
                "value": 100,
                "costBasis": None,
            },
        ]
    }
    await command("provider_map", account_id=acc["id"], remote_id="42")
    result = engine.query("alice", "portfolio", {"account_id": acc["id"]})
    assert result["source"] == "Lunch Flow" and len(result["positions"]) == 2
    assert result["positions"][1]["instrument"]["instrument_type"] == "crypto"
    assert result["positions"][1]["cost"] is None and result["positions"][1]["unrealized"] is None
    assert engine.query("alice", "trades", {"account_id": acc["id"]}) == []
    assert engine.query("alice", "transactions")["total"] == 0
    report = engine.query("alice", "reports", {"currency": "CAD"})
    assert report["net_worth"] == "300.00"
    with pytest.raises(ValidationError, match="Access denied"):
        engine.query("bob", "portfolio", {"account_id": acc["id"]})
    assert engine.query("bob", "reports", {"currency": "CAD"})["net_worth"] == "0.00"
    await command("provider_sync", confirm_initial=True)
    state["holdings"]["holdings"][1]["quantity"] = "0.2"
    state["holdings"]["holdings"][1]["value"] = 200
    await command("provider_sync")
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "400.00"
    restored = Finance(str(tmp_path / "restored.sqlite"))
    initialize(restored.path)
    restored.mutate("alice", "restore", {"backup": engine.query("alice", "export")})
    assert restored.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "400.00"
    state["holdings"] = {"unavailable": True}
    await command("provider_sync")
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "400.00"
    assert not engine.query("alice", "reports", {"currency": "CAD", "from": "2026-01-01", "to": "2026-01-01"})[
        "complete"
    ]


async def test_broker_values_do_not_double_count_journal_positions(engine, bank):
    _, state, command = bank
    acc = account(engine, type="investment", opening_balance="100")
    sec = engine.mutate("alice", "save", {"kind": "instrument", "name": "Example", "currency": "CAD", "symbol": "EX"})
    engine.mutate(
        "alice",
        "trade",
        {
            "account_id": acc["id"],
            "instrument_id": sec["id"],
            "date": "2026-01-01",
            "action": "opening",
            "quantity": "5",
            "price": "10",
        },
    )
    state["holdings"] = {
        "holdings": [
            {"security": {"name": "Example", "tickerSymbol": "EX", "currency": "CAD"}, "quantity": 5, "price": 20}
        ]
    }
    await command("provider_map", account_id=acc["id"], remote_id="42")
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "200.00"
    assert len(engine.query("alice", "trades", {"account_id": acc["id"]})) == 1
    assert len(engine.query("alice", "portfolio", {"account_id": acc["id"]})["ledger_positions"]) == 1


async def test_mapping_cannot_silently_move_to_another_account(engine, bank):
    _, _, command = bank
    a, b = account(engine), account(engine)
    await command("provider_map", account_id=a["id"], remote_id="42")
    with pytest.raises(ValidationError, match="Unlink"):
        await command("provider_map", account_id=b["id"], remote_id="42")


async def test_foreign_holdings_require_conversion_and_invalid_refresh_rolls_back(engine, bank):
    _, state, command = bank
    acc = account(engine, type="investment", opening_balance="100")
    state["holdings"] = {
        "holdings": [{"security": {"name": "European stock", "currency": "EUR"}, "quantity": 5, "price": 20}]
    }
    await command("provider_map", account_id=acc["id"], remote_id="42")
    report = engine.query("alice", "reports", {"currency": "CAD"})
    assert report["complete"] is False and report["net_worth"] == "100.00"
    engine.mutate(
        "alice", "save", {"kind": "rate", "base": "EUR", "currency": "CAD", "date": "2026-01-01", "value": "2"}
    )
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "300.00"
    state["rows"] = [{"id": "new", "date": "2026-09-01", "amount": -5, "currency": "CAD"}]
    state["holdings"]["holdings"][0]["quantity"] = "NaN"
    with pytest.raises(ValidationError):
        await command("provider_sync", confirm_initial=True)
    assert engine.query("alice", "transactions")["total"] == 0
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "300.00"


def test_manual_requests_cannot_bypass_opening_date_with_historical_flag(engine):
    acc = account(engine, opening_date="2026-01-01")
    with pytest.raises(ValidationError, match="opening balance"):
        engine.mutate(
            "alice", "transaction", {"account_id": acc["id"], "date": "2010-01-01", "amount": "-5", "historical": True}
        )
