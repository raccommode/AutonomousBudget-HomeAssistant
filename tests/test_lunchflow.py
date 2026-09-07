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
    state = {
        "rows": [],
        "holdings": {"holdings": []},
        "calls": [],
        "balance": {"balance": {"amount": 800, "currency": "CAD"}},
    }

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
            return state["balance"]
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
    await command("provider_unmap", actor="bob", mapping_id=mapping["id"])
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
    assert len(engine.query("bob", "portfolio", {"account_id": acc["id"]})["positions"]) == 2
    assert engine.query("bob", "reports", {"currency": "CAD"})["net_worth"] == "300.00"
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
    acc = account(engine, type="investment", opening_balance="100", assigned_user_id="alice")
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
    assert engine.query("alice", "reports", {"overview": True})["net_worth"] == "900.00"
    assert engine.query("bob", "reports", {"overview": True})["net_worth"] == "0.00"
    assert len(engine.query("alice", "trades", {"account_id": acc["id"]})) == 1
    assert len(engine.query("alice", "portfolio", {"account_id": acc["id"]})["ledger_positions"]) == 1


async def test_mapping_cannot_silently_move_to_another_account(engine, bank):
    _, _, command = bank
    a, b = account(engine), account(engine)
    await command("provider_map", account_id=a["id"], remote_id="42")
    with pytest.raises(ValidationError, match="Unlink"):
        await command("provider_map", account_id=b["id"], remote_id="42")


async def test_foreign_holdings_require_conversion_and_invalid_refresh_preserves_positions(engine, bank):
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
    await command("provider_sync", confirm_initial=True)
    assert engine.query("alice", "transactions")["total"] == 1
    assert engine.query("alice", "reports", {"currency": "CAD"})["net_worth"] == "295.00"
    with connect(engine.path) as db:
        assert get(db, acc["id"])["bank_holdings_status"] == "unavailable"


def test_manual_requests_cannot_bypass_opening_date_with_historical_flag(engine):
    acc = account(engine, opening_date="2026-01-01")
    with pytest.raises(ValidationError, match="opening balance"):
        engine.mutate(
            "alice", "transaction", {"account_id": acc["id"], "date": "2010-01-01", "amount": "-5", "historical": True}
        )


async def test_create_account_and_lunchflow_link_are_atomic(engine, bank):
    _, state, command = bank
    data = {
        "name": "New brokerage",
        "type": "investment",
        "currency": "CAD",
        "opening_date": "2026-01-01",
        "opening_balance": "0",
    }
    state["holdings"] = {
        "holdings": [
            {
                "security": {"name": "Bitcoin", "tickerSymbol": "BTC", "currency": "CAD"},
                "quantity": "0.1",
                "price": 1000,
            }
        ]
    }
    mapping = await command("provider_create_account", remote_id="42", account=data)
    snapshot = engine.query("alice", "snapshot")
    acc = next(o for o in snapshot["objects"] if o["id"] == mapping["account_id"])
    assert acc["name"] == "New brokerage" and acc["owner"] == "alice"
    assert (
        engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"][0]["instrument"]["name"] == "Bitcoin"
    )
    assert mapping["from"] is None
    with pytest.raises(ValidationError, match="Unlink"):
        await command("provider_create_account", remote_id="42", account=data | {"name": "Duplicate"})
    assert len([o for o in engine.query("alice", "snapshot")["objects"] if o["kind"] == "account"]) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"currency": "USD"},
        {"opening_date": "bad-date"},
        {"opening_balance": "NaN"},
        {"id": "existing-id"},
        {"portfolio_id": "existing-id"},
    ],
)
async def test_invalid_linked_creation_leaves_no_local_account(engine, bank, changes):
    _, _, command = bank
    data = {"name": "Example", "currency": "CAD", "opening_date": "2026-01-01", "opening_balance": "0"} | changes
    with pytest.raises(ValidationError):
        await command("provider_create_account", remote_id="42", account=data)
    assert not any(o["kind"] in ("account", "mapping") for o in engine.query("alice", "snapshot")["objects"])


async def test_linked_creation_rechecks_connection_after_provider_request(engine, bank, monkeypatch):
    connection, _, command = bank
    original = providers.request

    async def disconnect_during_fetch(*args, **kwargs):
        result = await original(*args, **kwargs)
        with connect(engine.path) as db:
            obj = get(db, connection["id"])
            obj["enabled"] = False
            from custom_components.autonomous_budget.finance import put

            put(db, obj)
        return result

    monkeypatch.setattr(providers, "request", disconnect_during_fetch)
    with pytest.raises(ValidationError, match="disconnected"):
        await command(
            "provider_create_account",
            remote_id="42",
            account={"name": "Example", "currency": "CAD", "opening_date": "2026-01-01"},
        )
    assert not any(o["kind"] in ("account", "mapping") for o in engine.query("alice", "snapshot")["objects"])


async def test_cash_balance_refreshes_before_initial_journal_confirmation(engine, bank):
    _, state, command = bank
    acc = account(engine, opening_balance="0")
    mapping = await command("provider_map", account_id=acc["id"], remote_id="42")
    snapshot = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    assert snapshot["balance"] == "0.00" and snapshot["bank_amount"] == "800.00"
    state["balance"] = {"balance": {"amount": 950, "currency": "CAD"}}
    state["rows"] = [{"id": "initial", "date": "2026-09-01", "amount": 50, "currency": "CAD"}]
    state["calls"].clear()
    await command("provider_sync", automatic=True)
    assert not any(url.endswith("/transactions") for url, _ in state["calls"])
    assert engine.query("alice", "transactions")["total"] == 0
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["bank_amount"] == "950.00"
    with connect(engine.path) as db:
        assert not get(db, mapping["id"])["initialized"]
    await command("provider_preview")
    await command("provider_sync", confirm_initial=True)
    await command("provider_sync", automatic=True)
    assert engine.query("alice", "transactions")["total"] == 1
    state["balance"] = {"unavailable": True}
    await command("provider_sync", automatic=True)
    summary = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    assert summary["bank_amount"] == "950.00" and summary["bank_balance_status"] == "unavailable"
    await command("provider_unmap", mapping_id=mapping["id"])
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["bank_amount"] is None


async def test_celiapp_links_when_optional_holdings_or_balance_are_unavailable(engine, bank):
    _, state, command = bank
    state["holdings"] = {"unavailable": True}
    state["balance"] = {"unavailable": True}
    result = await command(
        "provider_create_account",
        remote_id="42",
        account={"name": "CELIAPP", "type": "investment", "currency": "CAD", "opening_date": "2026-01-01"},
    )
    with connect(engine.path) as db:
        acc = get(db, result["account_id"])
    assert acc["bank_holdings_status"] == "unavailable" and acc["bank_balance_status"] == "unavailable"
    assert "bank_holdings" not in acc and "bank_balance" not in acc
    state["balance"] = {"balance": {"amount": 7000, "currency": "CAD"}}
    await command("provider_sync", automatic=True)
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]})["bank_amount"] == "7000.00"


@pytest.mark.parametrize("status", [400, 404, 422, 429, 500, 502, 503])
async def test_optional_provider_failure_does_not_block_account_link(monkeypatch, status):
    class Response:
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    response = Response()
    response.status = status
    session = SimpleNamespace(get=lambda *args, **kwargs: response)
    monkeypatch.setattr(providers, "async_get_clientsession", lambda hass: session)
    assert await providers.request(
        SimpleNamespace(data={}), "https://lunchflow.app/api/v1/accounts/42/holdings", optional=True
    ) == {"unavailable": True, "reason": {404: "not_found", 429: "rate_limited"}.get(status, "provider_error")}


@pytest.mark.parametrize("status", [401, 403])
async def test_optional_provider_request_still_rejects_invalid_credentials(monkeypatch, status):
    class Response:
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    response = Response()
    response.status = status
    monkeypatch.setattr(
        providers, "async_get_clientsession", lambda hass: SimpleNamespace(get=lambda *args, **kwargs: response)
    )
    with pytest.raises(ValidationError, match="authorization"):
        await providers.request(
            SimpleNamespace(data={}), "https://lunchflow.app/api/v1/accounts/42/holdings", optional=True
        )


async def test_optional_snapshot_timeout_is_non_blocking(monkeypatch):
    class Response:
        async def __aenter__(self):
            raise TimeoutError()

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(
        providers, "async_get_clientsession", lambda hass: SimpleNamespace(get=lambda *args, **kwargs: Response())
    )
    assert await providers.request(
        SimpleNamespace(data={}), "https://lunchflow.app/api/v1/accounts/42/balance", optional=True
    ) == {"unavailable": True, "reason": "network"}
    with pytest.raises(TimeoutError):
        await providers.request(SimpleNamespace(data={}), "https://lunchflow.app/api/v1/accounts/42/transactions")


async def test_one_account_transaction_outage_does_not_block_other_accounts(engine, bank, monkeypatch):
    _, _, command = bank
    first = account(engine, name="Cash")
    second = account(engine, name="CELIAPP", type="investment")
    original = providers.request

    async def request(hass, url, headers=None, params=None, optional=False):
        if url.endswith("/accounts"):
            return {
                "accounts": [
                    {"id": 42, "name": "Cash", "currency": "CAD"},
                    {"id": 43, "name": "CELIAPP", "currency": "CAD"},
                ]
            }
        if url.endswith("/43/transactions"):
            raise ValidationError("The provider is temporarily unavailable.")
        if url.endswith("/42/transactions"):
            return {"transactions": [{"id": "valid", "date": "2026-09-01", "amount": "-10", "currency": "CAD"}]}
        return await original(hass, url, headers, params, optional)

    monkeypatch.setattr(providers, "request", request)
    await command("provider_map", account_id=first["id"], remote_id="42")
    failing = await command("provider_map", account_id=second["id"], remote_id="43")
    result = await command("provider_sync", confirm_initial=True)
    assert result["added"] == 1 and result["warnings"][0]["account_id"] == second["id"]
    assert engine.query("alice", "transactions")["total"] == 1
    assert engine.query("alice", "account_summary", {"account_id": second["id"]})["bank_amount"] == "800.00"
    with connect(engine.path) as db:
        assert get(db, second["id"])["bank_sync_error"]
        assert not get(db, failing["id"])["initialized"]


async def test_zero_bank_balance_is_not_replaced_by_the_ledger(engine, bank):
    _, state, command = bank
    state["balance"] = {"balance": {"amount": 0, "currency": "CAD"}}
    acc = account(engine, opening_balance="100")
    await command("provider_map", account_id=acc["id"], remote_id="42")
    summary = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    assert summary["balance"] == "100.00" and summary["bank_amount"] == "0.00" and summary["bank_linked"]


async def test_optional_snapshot_warnings_are_previewed_and_clear_after_recovery(engine, bank):
    connection, state, command = bank
    acc = account(engine, type="investment", assigned_user_id="alice")
    await command("provider_map", account_id=acc["id"], remote_id="42")
    original = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    state["balance"] = {"unavailable": True, "reason": "provider_error"}
    state["holdings"] = {"unavailable": True, "reason": "unsupported"}
    preview = await command("provider_preview")
    assert {w["reason"] for w in preview["warnings"]} == {"provider_error", "unsupported"}
    assert engine.query("alice", "account_summary", {"account_id": acc["id"]}) == original
    result = await command("provider_sync", confirm_initial=True)
    assert len(result["warnings"]) == 2
    summary = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    assert (
        summary["bank_amount"] == "800.00"
        and next(o for o in engine.query("alice", "snapshot")["objects"] if o["id"] == acc["id"])["bank_balance_reason"]
        == "provider_error"
    )
    with connect(engine.path) as db:
        assert get(db, connection["id"])["status"] == "partial"
    personal = engine.query("alice", "reports", {"overview": True})
    assert not personal["complete"]
    assert {m["type"] for m in personal["missing"]} >= {"bank_balance", "holdings"}
    state["balance"] = {"balance": {"amount": 900, "currency": "CAD"}}
    state["holdings"] = {"holdings": []}
    result = await command("provider_sync")
    assert result["warnings"] == []
    summary = engine.query("alice", "account_summary", {"account_id": acc["id"]})
    assert summary["bank_amount"] == "900.00"
    snapshot = next(o for o in engine.query("alice", "snapshot")["objects"] if o["id"] == acc["id"])
    assert snapshot["bank_balance_reason"] is None and snapshot["bank_holdings_reason"] is None
    with connect(engine.path) as db:
        assert get(db, connection["id"])["status"] == "ok"
    assert engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"] == []
    assert engine.query("alice", "reports", {"overview": True})["complete"]
