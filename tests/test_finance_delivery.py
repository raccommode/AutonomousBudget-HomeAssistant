"""End-to-end financial contracts, restoration and connector failure boundaries."""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from test_finance import account, tx

from custom_components.autonomous_budget import providers
from custom_components.autonomous_budget.database import DatabaseStore, connect, initialize
from custom_components.autonomous_budget.finance import Finance
from custom_components.autonomous_budget.imports import parse_file
from custom_components.autonomous_budget.model import ValidationError


@pytest.fixture
def engine(tmp_path):
    path = str(tmp_path / "ledger.sqlite")
    initialize(path)
    return Finance(path)


def instrument(engine):
    return engine.mutate(
        "alice", "save", {"kind": "instrument", "name": "Example", "currency": "USD", "symbol": "EXAMPLE"}
    )


def test_historical_investment_income_and_sale_reporting(engine):
    acc = account(engine, currency="USD", type="investment")
    sec = instrument(engine)

    def trade(action, day, quantity="0", price="0"):
        return engine.mutate(
            "alice",
            "trade",
            {
                "account_id": acc["id"],
                "instrument_id": sec["id"],
                "action": action,
                "date": day,
                "quantity": quantity,
                "price": price,
            },
        )

    trade("opening", "2026-01-01", "10", "10")
    trade("dividend", "2026-02-01", price="10")
    sale = trade("sell", "2026-03-01", "5", "20")
    for day, value in [("2026-01-01", "1.1"), ("2026-02-01", "1.2"), ("2026-03-01", "1.3"), ("2026-09-01", "1.9")]:
        engine.mutate("alice", "save", {"kind": "rate", "base": "USD", "currency": "CAD", "date": day, "value": value})
    report = engine.query("alice", "reports", {"from": "2026-02-01", "to": "2026-09-01", "currency": "CAD"})
    assert report["realized_gains"] == "65.00"
    assert report["investment_income"] == "12.00"
    report = engine.query("alice", "reports", {"from": "2026-04-01", "to": "2026-09-01", "currency": "CAD"})
    assert report["realized_gains"] == report["investment_income"] == "0.00"
    engine.mutate("alice", "trade_update", sale | {"quantity": "4"})
    assert engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"][0]["quantity"] == "6"
    assert len(engine.query("alice", "transactions")["rows"]) == 2
    with pytest.raises(ValidationError, match="exceeds"):
        engine.mutate("alice", "trade_update", sale | {"quantity": "50"})
    # Failed replacement did not alter either the cash or security journal.
    assert engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"][0]["quantity"] == "6"


def test_revocation_covers_dependent_objects_and_publication(engine):
    acc = account(engine, sharing={"bob": "write"})
    cat = engine.mutate("alice", "save", {"kind": "category", "name": "Food", "sharing": {"bob": "read"}})
    rule = engine.mutate(
        "alice", "save", {"kind": "rule", "account_id": acc["id"], "match": "Shop", "category_id": cat["id"]}
    )
    loan = engine.mutate(
        "alice",
        "save",
        {
            "kind": "loan",
            "account_id": acc["id"],
            "date": "2026-09-01",
            "principal": "100",
            "payment": "10",
            "payments": 12,
        },
    )
    engine.mutate("bob", "save", acc | {"publish_sensors": True})
    assert not next(o for o in engine.query("alice", "snapshot")["objects"] if o["id"] == acc["id"])["publish_sensors"]
    engine.mutate("alice", "save", acc | {"sharing": {}})
    assert all(o["kind"] not in ("rule", "loan", "account") for o in engine.query("bob", "snapshot")["objects"])
    with pytest.raises(ValidationError, match="Access denied"):
        engine.mutate("bob", "delete", {"id": rule["id"]})
    with pytest.raises(ValidationError, match="Access denied"):
        engine.query("bob", "loan_schedule", {"id": loan["id"]})


def test_restore_refunds_independent_of_export_order_and_atomic_invalid_backup(engine, tmp_path):
    acc = account(engine)
    expense = tx(engine, acc, "-20")
    tx(engine, acc, "5", refund_id=expense["id"])
    backup = engine.query("alice", "export")
    backup["transactions"].reverse()
    restored = Finance(str(tmp_path / "restore.sqlite"))
    initialize(restored.path)
    restored.mutate("alice", "restore", {"backup": backup})
    rows = restored.query("alice", "transactions")["rows"]
    assert (
        next(t for t in rows if t["amount"] == "5.00")["refund_id"]
        == next(t for t in rows if t["amount"] == "-20.00")["id"]
    )
    invalid = Finance(str(tmp_path / "invalid.sqlite"))
    initialize(invalid.path)
    backup["transactions"][0]["splits"] = [{"amount": "123"}]
    with pytest.raises(ValidationError):
        invalid.mutate("alice", "restore", {"backup": backup})
    assert invalid.query("alice", "snapshot")["objects"] == []


def test_mirrored_qif_transfers_and_csv_investments(engine):
    a = account(engine, name="A")
    b = account(engine, name="B")
    content = "!Account\nNA\nTBank\n^\n!Type:Bank\nD2026-09-01\nT-25\nL[B]\n^\n!Account\nNB\nTBank\n^\n!Type:Bank\nD2026-09-01\nT25\nL[A]\n^\n"
    payload = {
        "format": "qif",
        "file": content,
        "account_id": a["id"],
        "account_mapping": {"A": a["id"], "B": b["id"]},
        "transfer_mapping": {"A": a["id"], "B": b["id"]},
    }
    engine.mutate("alice", "import", payload)
    engine.mutate("alice", "import", payload)
    rows = engine.query("alice", "transactions")["rows"]
    assert len(rows) == 2 and rows[0]["transfer_id"] == rows[1]["transfer_id"]
    parsed = parse_file(
        "date,amount,action,quantity,price,instrument_ref\n2026-09-01,-50,buy,5,10,EXAMPLE\n2026-09-01,0,unsupported,1,2,X\n",
        "csv",
    )
    assert parsed["rows"][0]["entry_type"] == "trade"
    assert len(parsed["errors"]) == 1


async def test_legacy_migration_backs_up_before_persisting(tmp_path):
    async def executor(fn, *args):
        return fn(*args)

    hass = SimpleNamespace(async_add_executor_job=executor)
    store = object.__new__(DatabaseStore)
    store.hass = hass
    store.path = str(tmp_path / "autonomous_budget.sqlite")
    legacy = {"revision": 4, "budgets": [{"id": "stable-id", "items": []}], "settings": {}}
    store.legacy = SimpleNamespace(async_load=AsyncMock(return_value=legacy))
    assert await store.async_load() == legacy
    assert json.loads((tmp_path / "autonomous_budget.pre-v1.json").read_text()) == legacy
    assert await store.async_load() == legacy
    assert store.legacy.async_load.await_count == 1


async def test_personal_api_contract_preview_repeat_failure_disconnect(engine, monkeypatch):
    acc = account(engine)
    connection = engine.mutate(
        "alice", "save", {"kind": "connection", "name": "Example bank", "api_key": "fixture-key"}
    )

    async def executor(fn, *args):
        return await asyncio.to_thread(fn, *args)

    hass = SimpleNamespace(
        data={"autonomous_budget": {"store": SimpleNamespace(storage=SimpleNamespace(path=engine.path))}},
        async_add_executor_job=executor,
    )
    pending = True

    async def request(hass, url, headers=None, params=None, optional=False):
        assert url.startswith("https://lunchflow.app/api/v1/")
        assert headers == {"x-api-key": "fixture-key"}
        if url.endswith("/accounts"):
            return {"accounts": [{"id": 42, "currency": "CAD", "name": "Example", "institution_name": "Bank"}]}
        if url.endswith("/transactions"):
            assert params == {"from": "2026-01-01", "include_pending": "true"}
            return {
                "transactions": [
                    {
                        "id": "bank-42-1",
                        "accountId": 42,
                        "date": "2026-09-01",
                        "amount": -12.50,
                        "currency": "CAD",
                        "merchant": "Example shop",
                        "description": "Card purchase",
                        "isPending": pending,
                    }
                ],
                "total": 1,
            }
        if url.endswith("/balance"):
            return {"balance": {"amount": 987.50, "currency": "CAD"}}
        raise AssertionError(url)

    monkeypatch.setattr(providers, "request", request)
    await providers.provider_command(
        hass,
        "alice",
        "provider_map",
        {"connection_id": connection["id"], "remote_id": "42", "account_id": acc["id"], "from": "2026-01-01"},
    )
    result = await providers.provider_command(hass, "alice", "provider_preview", {"connection_id": connection["id"]})
    assert result["added"] == 1 and engine.query("alice", "transactions")["total"] == 0
    await providers.provider_command(
        hass, "alice", "provider_sync", {"connection_id": connection["id"], "confirm_initial": True}
    )
    assert engine.query("alice", "transactions")["rows"][0]["status"] == "pending"
    pending = False
    await providers.provider_command(hass, "alice", "provider_sync", {"connection_id": connection["id"]})
    assert engine.query("alice", "transactions")["rows"][0]["status"] == "cleared"

    async def failure(*args, **kwargs):
        raise TimeoutError

    monkeypatch.setattr(providers, "request", failure)
    with pytest.raises(TimeoutError):
        await providers.provider_command(hass, "alice", "provider_sync", {"connection_id": connection["id"]})
    assert engine.query("alice", "transactions")["total"] == 1
    await providers.provider_command(hass, "alice", "provider_disconnect", {"connection_id": connection["id"]})
    with pytest.raises(ValidationError, match="disconnected"):
        await providers.provider_command(hass, "alice", "provider_sync", {"connection_id": connection["id"]})
    assert "fixture-key" not in json.dumps(engine.query("alice", "export"))


def test_audit_retains_previous_transaction(engine):
    acc = account(engine)
    original = tx(engine, acc, "-20", notes="Before correction")
    engine.mutate("alice", "transaction", original | {"amount": "-21", "splits": [{"amount": "-21"}]})
    with connect(engine.path) as db:
        before = json.loads(db.execute("SELECT body FROM audit WHERE action='transaction_before_update'").fetchone()[0])
    assert before["amount"] == "-20.00" and before["notes"] == "Before correction"


def test_fifo_security_transfer_keeps_acquisition_lots(engine):
    source = account(engine, currency="USD", type="investment", cost_method="fifo")
    target = account(engine, name="Destination", currency="USD", type="investment", cost_method="fifo")
    sec = instrument(engine)

    def trade(acc, action, when, quantity, price="0", **extra):
        return engine.mutate(
            "alice",
            "trade",
            {
                "account_id": acc["id"],
                "instrument_id": sec["id"],
                "action": action,
                "date": when,
                "quantity": quantity,
                "price": price,
                **extra,
            },
        )

    trade(source, "opening", "2026-01-01", "10", "10")
    trade(source, "buy", "2026-02-01", "10", "20")
    trade(target, "opening", "2026-02-15", "2", "30")
    trade(source, "transfer", "2026-03-01", "15", destination_id=target["id"])
    trade(target, "sell", "2026-04-01", "10", "40")
    position = engine.query("alice", "portfolio", {"account_id": target["id"]})["positions"][0]
    assert position["realized"] == "300"  # Original January lots, not the newer destination lot.
    assert position["cost"] == "160"
    assert engine.query("alice", "portfolio", {"account_id": source["id"]})["positions"][0]["cost"] == "100"


def test_transfer_legs_can_be_pointed_then_reconciled(engine):
    source = account(engine)
    target = account(engine, name="Savings", balance="0")
    engine.mutate(
        "alice",
        "transfer",
        {
            "account_id": source["id"],
            "destination_id": target["id"],
            "date": "2026-09-01",
            "amount": "25",
            "received": "25",
        },
    )
    rows = engine.query("alice", "transactions")["rows"]
    engine.mutate("alice", "bulk", {"ids": [r["id"] for r in rows], "status": "cleared"})
    engine.mutate("alice", "reconcile", {"account_id": source["id"], "date": "2026-09-01", "balance": "975"})
    assert (
        next(r for r in engine.query("alice", "transactions")["rows"] if r["account_id"] == source["id"])["status"]
        == "reconciled"
    )


async def test_quote_currency_units_holdings_and_rate_limit_preserve_data(engine, monkeypatch):
    async def executor(fn, *args):
        return await asyncio.to_thread(fn, *args)

    hass = SimpleNamespace(
        data={"autonomous_budget": {"store": SimpleNamespace(storage=SimpleNamespace(path=engine.path))}},
        async_add_executor_job=executor,
    )
    sec = engine.mutate(
        "alice", "save", {"kind": "instrument", "name": "London example", "currency": "GBP", "symbol": "EXAMPLE.L"}
    )
    monkeypatch.setattr(providers, "yahoo", lambda symbol: ("1234", "2026-09-01", "GBp"))
    quote = await providers.provider_command(
        hass, "alice", "provider_quote", {"instrument_id": sec["id"], "source": "yahoo"}
    )
    assert quote["value"] == "12.34" and quote["currency"] == "GBP"

    def unavailable(symbol):
        raise TimeoutError

    monkeypatch.setattr(providers, "yahoo", unavailable)
    with pytest.raises(TimeoutError):
        await providers.provider_command(
            hass, "alice", "provider_quote", {"instrument_id": sec["id"], "source": "yahoo"}
        )
    assert next(o for o in engine.query("alice", "snapshot")["objects"] if o["kind"] == "quote")["value"] == "12.34"
    # Representative Personal API holdings initialize only validated opening positions.
    acc = account(engine, currency="GBP", type="investment")
    conn = engine.mutate("alice", "save", {"kind": "connection", "api_key": "fixture-only"})
    with connect(engine.path) as db:
        from custom_components.autonomous_budget.finance import get, put

        put(
            db,
            {
                "id": "holding-map",
                "kind": "mapping",
                "owner": "alice",
                "connection_id": conn["id"],
                "account_id": acc["id"],
            },
        )
        put(
            db,
            get(db, acc["id"])
            | {
                "bank_holdings": {
                    "holdings": [
                        {
                            "security": {
                                "name": "London example",
                                "currency": "GBP",
                                "tickerSymbol": "EXAMPLE.L",
                                "isin": "GBEXAMPLE",
                            },
                            "quantity": 10,
                            "price": 12.34,
                            "value": 123.4,
                            "costBasis": 100,
                            "currency": "GBP",
                        }
                    ],
                    "totalValue": 123.4,
                    "currency": "GBP",
                }
            },
        )
    result = await providers.provider_command(
        hass,
        "alice",
        "provider_holdings_open",
        {
            "connection_id": conn["id"],
            "account_id": acc["id"],
            "date": "2026-09-01",
            "instrument_mapping": {"0": sec["id"]},
        },
    )
    assert result["positions"] == 1
    assert engine.query("alice", "transactions")["rows"] == []
    with pytest.raises(ValidationError, match="existing positions"):
        await providers.provider_command(
            hass,
            "alice",
            "provider_holdings_open",
            {
                "connection_id": conn["id"],
                "account_id": acc["id"],
                "date": "2026-09-01",
                "instrument_mapping": {"0": sec["id"]},
            },
        )


def test_recurring_calendar_and_posting_do_not_duplicate_manual_match(engine):
    acc = account(engine)
    template = engine.mutate(
        "alice",
        "save",
        {
            "kind": "recurring",
            "account_id": acc["id"],
            "date": "2026-09-01",
            "amount": "-10",
            "description": "Example bill",
            "recurrence": "monthly",
        },
    )
    existing = tx(engine, acc, "-10")
    with pytest.raises(ValidationError, match="matching transaction"):
        engine.mutate("alice", "recurring_post", {"id": template["id"], "date": "2026-09-01"})
    engine.mutate("alice", "recurring_post", {"id": template["id"], "date": "2026-09-01", "match_id": existing["id"]})
    with pytest.raises(ValidationError, match="already recorded"):
        engine.mutate(
            "alice", "recurring_post", {"id": template["id"], "date": "2026-09-01", "match_id": existing["id"]}
        )
    calendar = engine.query("alice", "calendar", {"from": "2026-09-01", "to": "2026-11-02"})
    assert [r["date"] for r in calendar] == ["2026-10-01", "2026-11-01"]


async def test_provider_cooldown_and_optional_unsupported_holdings(monkeypatch):
    class Response:
        status = 429
        headers = {"Retry-After": "120"}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class Session:
        calls = 0

        def get(self, *args, **kwargs):
            self.calls += 1
            return Response()

    session = Session()
    monkeypatch.setattr(providers, "async_get_clientsession", lambda hass: session)
    hass = SimpleNamespace(data={})
    for _ in range(2):
        with pytest.raises(ValidationError, match="rate limited"):
            await providers.request(hass, "https://api.coingecko.com/api/v3/simple/price")
    assert session.calls == 1
    Response.status = 501
    assert await providers.request(hass, "https://lunchflow.app/api/v1/accounts/1/holdings", optional=True) == {
        "unavailable": True
    }


def test_import_preserves_identical_real_rows_and_reports_invalid_lines(engine):
    from custom_components.autonomous_budget.imports import preview

    acc = account(engine)
    p = {
        "account_id": acc["id"],
        "format": "csv",
        "file": "date,amount,payee\n2026-09-01,-10,Shop\n2026-09-01,-10,Shop\n2026-09-01,-1.001,Invalid precision\n",
    }
    with connect(engine.path) as db:
        result = preview(db, "alice", p)
    assert len(result["rows"]) == 2 and len(result["errors"]) == 1
    engine.mutate("alice", "import", p | {"accept_valid_rows": True})
    engine.mutate("alice", "import", p | {"accept_valid_rows": True})
    assert engine.query("alice", "transactions")["total"] == 2


def test_shared_journal_metadata_is_readable_and_restorable(engine, tmp_path):
    parent = engine.mutate("alice", "save", {"kind": "category", "name": "Home"})
    child = engine.mutate("alice", "save", {"kind": "category", "name": "Food", "parent_id": parent["id"]})
    acc = account(engine, sharing={"bob": "read"})
    tx(engine, acc, "-10", category_id=child["id"])
    snapshot = engine.query("bob", "snapshot")
    assert {o["name"] for o in snapshot["objects"] if o["kind"] == "category"} == {"Home", "Food"}
    destination = Finance(str(tmp_path / "copy.sqlite"))
    initialize(destination.path)
    destination.mutate("bob", "restore", {"backup": engine.query("bob", "export")})
    assert destination.query("bob", "transactions")["total"] == 1
    engine.mutate("alice", "save", acc | {"sharing": {}})
    assert engine.query("bob", "snapshot")["objects"] == []
