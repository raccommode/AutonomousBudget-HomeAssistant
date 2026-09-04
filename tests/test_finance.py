"""Financial invariants, privacy boundaries, historical values and import idempotence."""

import json
from decimal import Decimal

import pytest

from custom_components.autonomous_budget.database import connect, initialize
from custom_components.autonomous_budget.finance import Finance, balance, get
from custom_components.autonomous_budget.finance_api import budget_context
from custom_components.autonomous_budget.imports import parse_file, preview
from custom_components.autonomous_budget.model import ValidationError
from custom_components.autonomous_budget.providers import apply_sync


@pytest.fixture
def engine(tmp_path):
    path = str(tmp_path / "ledger.sqlite")
    initialize(path)
    return Finance(path)


def account(engine, name="Checking", currency="CAD", balance="1000", **extra):
    return engine.mutate(
        "alice",
        "save",
        {
            "kind": "account",
            "name": name,
            "currency": currency,
            "type": "checking",
            "opening_date": "2025-01-01",
            "opening_balance": balance,
            **extra,
        },
    )


def tx(engine, acc, amount, **extra):
    return engine.mutate(
        "alice", "transaction", {"account_id": acc["id"], "date": "2026-09-01", "amount": amount, **extra}
    )


def test_private_accounts_server_side_and_revocation(engine):
    acc = account(engine)
    tx(engine, acc, "-25")
    assert engine.query("bob", "snapshot")["objects"] == []
    assert engine.query("bob", "transactions")["total"] == 0
    with pytest.raises(ValidationError, match="Access denied"):
        engine.query("bob", "transactions", {"account_id": acc["id"]})
    engine.mutate("alice", "save", acc | {"sharing": {"bob": "read"}})
    assert engine.query("bob", "transactions")["total"] == 1
    with pytest.raises(ValidationError, match="Access denied"):
        engine.mutate("bob", "transaction", {"account_id": acc["id"], "date": "2026-09-01", "amount": "8"})
    engine.mutate("alice", "save", acc | {"sharing": {}})
    assert engine.query("bob", "reports")["accounts"] == []
    assert engine.query("bob", "export")["transactions"] == []


def test_split_conservation_atomicity_and_revision(engine):
    acc = account(engine)
    with pytest.raises(ValidationError, match="Split"):
        tx(engine, acc, "-10", splits=[{"amount": "-9"}])
    assert engine.query("alice", "transactions")["total"] == 0
    tx(engine, acc, "-10", splits=[{"amount": "-6"}, {"amount": "-4"}])
    assert engine.query("alice", "snapshot")["objects"][0]["balance"] == "990.00"
    with pytest.raises(ValidationError, match="another session"):
        engine.mutate("alice", "transaction", {"account_id": acc["id"]}, 0)


def test_multicurrency_transfer_no_income_no_double_count(engine):
    cad = account(engine)
    usd = account(engine, "USD", "USD", "0")
    engine.mutate(
        "alice",
        "transfer",
        {
            "account_id": cad["id"],
            "destination_id": usd["id"],
            "amount": "135",
            "received": "100",
            "fee": "2",
            "date": "2026-09-01",
        },
    )
    engine.mutate(
        "alice", "save", {"kind": "rate", "base": "USD", "currency": "CAD", "date": "2026-09-01", "value": "1.35"}
    )
    result = engine.query("alice", "reports", {"from": "2026-09-01", "to": "2026-09-02", "currency": "CAD"})
    assert result["income"] == "0.00"
    assert result["expenses"] == "2.00"
    assert result["net_worth"] == "998.00"
    assert result["complete"]
    balances = {o["name"]: o["balance"] for o in engine.query("alice", "snapshot")["objects"] if o["kind"] == "account"}
    assert balances == {"Checking": "863.00", "USD": "100.00"}


def test_missing_fx_and_historical_rates(engine):
    acc = account(engine, currency="USD")
    tx(engine, acc, "-10")
    p = {"currency": "CAD", "from": "2026-09-01", "to": "2026-09-03"}
    assert not engine.query("alice", "reports", p)["complete"]
    for when, value in [("2026-09-01", "1.3"), ("2026-09-02", "1.5")]:
        engine.mutate("alice", "save", {"kind": "rate", "base": "USD", "currency": "CAD", "date": when, "value": value})
    report = engine.query("alice", "reports", p)
    assert report["expenses"] == "13.00"
    assert report["net_worth"] == "1485.00"


def test_reconciliation_freezes_edits_and_reopens(engine):
    acc = account(engine)
    entry = tx(engine, acc, "-100", status="cleared")
    with pytest.raises(ValidationError, match="difference"):
        engine.mutate("alice", "reconcile", {"account_id": acc["id"], "date": "2026-09-02", "balance": "901"})
    rec = engine.mutate("alice", "reconcile", {"account_id": acc["id"], "date": "2026-09-02", "balance": "900"})
    with pytest.raises(ValidationError, match="Reopen"):
        engine.mutate("alice", "transaction", entry | {"amount": "-90"})
    engine.mutate("alice", "reopen", {"id": rec["id"]})
    engine.mutate("alice", "transaction", entry | {"notes": "Reviewed"})
    assert engine.query("alice", "transactions")["rows"][0]["notes"] == "Reviewed"


def test_import_preview_repeat_and_ambiguous_matches(engine):
    acc = account(engine)
    p = {
        "account_id": acc["id"],
        "format": "csv",
        "file": "date,amount,payee\n2026-09-01,-12,Coffee\n2026-09-02,-30,Shop\n",
    }
    with connect(engine.path) as db:
        result = preview(db, "alice", p)
    assert len(result["rows"]) == 2
    assert engine.query("alice", "transactions")["total"] == 0
    assert engine.mutate("alice", "import", p)["imported"] == 2
    assert engine.mutate("alice", "import", p)["imported"] == 0
    assert engine.query("alice", "transactions")["total"] == 2


def test_ofx_qif_and_localized_csv():
    ofx = "<OFX><STMTTRN><DTPOSTED>20260901120000<TRNAMT>-25.20<FITID>x<NAME>Store</STMTTRN></OFX>"
    assert parse_file(ofx, "ofx")["rows"][0]["amount"] == "-25.20"
    qif = "!Type:Bank\nD01/09/2026\nT-25,20\nPStore\n^\n"
    assert parse_file(qif, "qif", {"date_format": "%d/%m/%Y", "decimal": ","})["rows"][0]["amount"] == "-25.20"
    assert (
        parse_file(
            "date;amount\n01/09/2026;1.234,50\n", "csv", {"delimiter": ";", "date_format": "%d/%m/%Y", "decimal": ","}
        )["rows"][0]["amount"]
        == "1234.50"
    )


@pytest.mark.parametrize("method,expected", [("average", "150.0"), ("fifo", "100")])
def test_positions_cost_methods_backdated_oversell_and_cash(engine, method, expected):
    acc = account(engine, type="investment", cost_method=method)
    instrument = engine.mutate(
        "alice", "save", {"kind": "instrument", "name": "Example", "currency": "CAD", "symbol": "EX"}
    )
    for when, action, quantity, price in [
        ("2026-01-01", "buy", "10", "10"),
        ("2026-02-01", "buy", "10", "20"),
        ("2026-03-01", "sell", "10", "30"),
    ]:
        engine.mutate(
            "alice",
            "trade",
            {
                "account_id": acc["id"],
                "instrument_id": instrument["id"],
                "date": when,
                "action": action,
                "quantity": quantity,
                "price": price,
            },
        )
    pos = engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"][0]
    assert Decimal(pos["cost"]) == Decimal(expected if method == "average" else "200")
    assert Decimal(pos["realized"]) == Decimal("150" if method == "average" else "200")
    with pytest.raises(ValidationError, match="exceeds"):
        engine.mutate(
            "alice",
            "trade",
            {
                "account_id": acc["id"],
                "instrument_id": instrument["id"],
                "date": "2025-12-01",
                "action": "sell",
                "quantity": "1",
                "price": "30",
            },
        )
    assert engine.query("alice", "transactions")["total"] == 3


def test_loan_and_assets(engine):
    acc = account(engine, type="loan", balance="-1200")
    loan = engine.mutate(
        "alice",
        "save",
        {
            "kind": "loan",
            "account_id": acc["id"],
            "date": "2026-01-01",
            "principal": "1200",
            "payment": "100",
            "interest_rate": "0",
            "payments": 12,
        },
    )
    schedule = engine.query("alice", "loan_schedule", {"id": loan["id"]})
    assert len(schedule) == 12
    assert schedule[-1]["balance"] == "0.00"
    asset = engine.mutate("alice", "save", {"kind": "asset", "name": "Home", "currency": "CAD", "ownership": "50"})
    engine.mutate(
        "alice", "save", {"kind": "valuation", "asset_id": asset["id"], "date": "2026-01-01", "value": "10000"}
    )
    assert engine.query("alice", "reports", {"currency": "CAD", "to": "2026-09-01"})["net_worth"] == "3800.00"


def test_linked_budget_splits_and_privacy(engine):
    acc = account(engine, sharing={"bob": "read"})
    budgets = [
        {"id": "b1", "name": "One", "currency": "CAD", "items": []},
        {"id": "b2", "name": "Two", "currency": "USD", "items": []},
    ]
    with connect(engine.path) as db:
        db.execute("INSERT INTO documents VALUES (?,?)", ("budgets", json.dumps({"budgets": budgets})))
    engine.mutate(
        "alice", "save", {"kind": "rate", "base": "CAD", "currency": "USD", "date": "2026-01-01", "value": "0.75"}
    )
    for bid, share in [("b1", "60"), ("b2", "40")]:
        engine.mutate(
            "alice", "save", {"kind": "budget_link", "account_id": acc["id"], "budget_id": bid, "percentage": share}
        )
    ctx = budget_context(engine.path, budgets, "2026-09-01")
    assert ctx["funding"]["b1"]["account_balance"] == "600.00"
    assert ctx["funding"]["b2"]["account_balance"] == "300.00"
    assert ctx["access"]["b1"]["readers"] == {"alice", "bob"}
    assert not ctx["access"]["b1"]["published"]
    with pytest.raises(ValidationError, match="100%"):
        engine.mutate(
            "alice", "save", {"kind": "budget_link", "account_id": acc["id"], "budget_id": "b1", "percentage": "1"}
        )


def test_lunchflow_repeat_correction_reconciled_conflict(engine):
    acc = account(engine)
    conn = engine.mutate("alice", "save", {"kind": "connection", "name": "Bank", "api_key": "test-secret"})
    with connect(engine.path) as db:
        from custom_components.autonomous_budget.finance import put

        mapping = put(
            db,
            {
                "id": "mapping",
                "kind": "mapping",
                "owner": "alice",
                "connection_id": conn["id"],
                "account_id": acc["id"],
            },
        )
    batches = [
        {
            "mapping": mapping,
            "balance": {"amount": "980"},
            "transactions": [
                {"id": "bank1", "date": "2026-09-01", "amount": "-20", "currency": "CAD", "description": "Coffee"}
            ],
        }
    ]
    assert apply_sync(engine.path, "alice", conn["id"], batches, True)["added"] == 1
    assert engine.query("alice", "transactions")["total"] == 0
    apply_sync(engine.path, "alice", conn["id"], batches)
    apply_sync(engine.path, "alice", conn["id"], batches)
    assert engine.query("alice", "transactions")["total"] == 1
    engine.mutate("alice", "reconcile", {"account_id": acc["id"], "date": "2026-09-02", "balance": "980"})
    batches[0]["transactions"][0]["amount"] = "-21"
    assert apply_sync(engine.path, "alice", conn["id"], batches)["conflicts"] == 1
    assert engine.query("alice", "transactions")["rows"][0]["amount"] == "-20.00"
    assert "test-secret" not in json.dumps(engine.query("alice", "snapshot"))
    assert "test-secret" not in json.dumps(engine.query("alice", "export"))


def test_backup_restore_and_rollback(engine, tmp_path):
    acc = account(engine)
    tx(engine, acc, "-12")
    backup = engine.query("alice", "export")
    path = str(tmp_path / "restored.sqlite")
    initialize(path)
    restored = Finance(path)
    restored.mutate("alice", "restore", {"backup": backup})
    assert restored.query("alice", "transactions")["rows"][0]["amount"] == "-12.00"
    with connect(path) as db:
        assert balance(db, get(db, restored.query("alice", "snapshot")["objects"][0]["id"])) == Decimal("988")


def test_large_journal_remains_paginated(engine):
    acc = account(engine)
    template = {
        "account_id": acc["id"],
        "date": "2026-01-01",
        "amount": "-0.01",
        "currency": "CAD",
        "status": "unmarked",
        "payee": "Scale fixture",
        "description": "",
        "splits": [{"amount": "-0.01"}],
    }
    with connect(engine.path) as db:
        db.executemany(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)",
            (
                (
                    f"scale-{i}",
                    acc["id"],
                    "2026-01-01",
                    None,
                    None,
                    "unmarked",
                    "-0.01",
                    json.dumps(template | {"id": f"scale-{i}"}),
                )
                for i in range(100000)
            ),
        )
    page = engine.query("alice", "transactions", {"account_id": acc["id"], "offset": 99950})
    assert page["total"] == 100000
    assert len(page["rows"]) == 50
    snapshot = engine.query("alice", "snapshot")
    assert snapshot["objects"][0]["balance"] == "0.00"
    assert len(json.dumps(snapshot)) < 1500


def test_qif_investment_mapping_and_reimport(engine):
    acc = account(engine, type="investment")
    instrument = engine.mutate("alice", "save", {"kind": "instrument", "name": "Example", "currency": "CAD"})
    payload = {
        "account_id": acc["id"],
        "format": "qif",
        "file": "!Type:Invst\nD2026-01-01\nNBuy\nYExample\nQ10\nI12\nT120\n^\n",
        "instrument_mapping": {"Example": instrument["id"]},
    }
    assert engine.mutate("alice", "import", payload)["imported"] == 1
    assert engine.mutate("alice", "import", payload)["imported"] == 0
    pos = engine.query("alice", "portfolio", {"account_id": acc["id"]})["positions"][0]
    assert pos["quantity"] == "10"
    assert pos["cost"] == "120"


def test_shared_budget_foreign_currency_explicit_plan_rate():
    from datetime import date

    from custom_components.autonomous_budget.sharing import summarize_budgets, validate_links

    budgets = [
        {
            "id": "common",
            "name": "Common",
            "kind": "shared",
            "currency": "CAD",
            "items": [
                {
                    "id": "bill",
                    "name": "Bill",
                    "direction": "expense",
                    "category": "mandatory",
                    "amount": "2600",
                    "currency": "CAD",
                    "exchange_rate": "1",
                    "recurrence": "monthly",
                    "renewal_date": "2026-09-01",
                    "active": True,
                }
            ],
            "allocations": [{"budget_id": "person", "percentage": "100", "exchange_rate": "0.75"}],
        },
        {"id": "person", "name": "Person", "kind": "personal", "currency": "USD", "items": []},
    ]
    validate_links(budgets)
    result = summarize_budgets(
        budgets, {"currency": "CAD", "period": "biweekly", "anchor": "2026-08-28"}, date(2026, 9, 1), 0
    )
    assert result[1]["plan"]["expenses"] == "900.00"
    assert result[0]["sharing"]["members"][0]["currency"] == "USD"


def test_loan_midperiod_extra_payment_reduces_interest(engine):
    acc = account(engine, type="loan", balance="-10000")
    raw = {
        "kind": "loan",
        "account_id": acc["id"],
        "date": "2026-02-01",
        "principal": "10000",
        "payment": "500",
        "interest_rate": "12",
        "payments": 24,
    }
    ordinary = engine.mutate("alice", "save", raw)
    accelerated = engine.mutate("alice", "save", raw | {"extra_payments": [{"date": "2026-01-15", "amount": "2000"}]})
    schedule = engine.query("alice", "loan_schedule", {"id": accelerated["id"]})
    assert schedule[0]["date"] == "2026-01-15"
    assert schedule[0]["principal"] == "2000.00"
    baseline = engine.query("alice", "loan_schedule", {"id": ordinary["id"]})
    assert Decimal(schedule[1]["interest"]) < Decimal(baseline[0]["interest"])


def test_provider_pending_null_id_and_closed_period(engine):
    from custom_components.autonomous_budget.providers import normalize_transaction

    pending = normalize_transaction(
        {"id": "p", "date": "2026-09-01", "amount": -12, "currency": "CAD", "merchant": "Shop", "isPending": True},
        "CAD",
    )
    assert pending["status"] == "pending"
    assert normalize_transaction({"id": None, "date": "2026-09-01", "amount": -12, "currency": "CAD"}, "CAD")[
        "unstable_id"
    ]
    acc = account(engine)
    engine.mutate("alice", "reconcile", {"account_id": acc["id"], "date": "2026-09-01", "balance": "1000"})
    with pytest.raises(ValidationError, match="Reopen"):
        tx(engine, acc, "-10")


def test_pocket_access_follows_parent_after_revocation(engine):
    parent = account(engine, type="investment", sharing={"bob": "read"})
    account(engine, "Dollar pocket", "USD", "100", type="investment", portfolio_id=parent["id"])
    assert len([o for o in engine.query("bob", "snapshot")["objects"] if o["kind"] == "account"]) == 2
    engine.mutate("alice", "save", parent | {"sharing": {}})
    assert engine.query("bob", "snapshot")["objects"] == []
    assert engine.query("bob", "reports")["accounts"] == []
    assert engine.query("bob", "export")["transactions"] == []


def test_same_currency_transfer_and_split_rounding_guard(engine):
    a, b = account(engine), account(engine, "Other")
    with pytest.raises(ValidationError, match="fee"):
        engine.mutate(
            "alice",
            "transfer",
            {"account_id": a["id"], "destination_id": b["id"], "amount": "10", "received": "9", "date": "2026-09-01"},
        )
    with pytest.raises(ValidationError, match="decimal"):
        tx(engine, a, "-0.01", splits=[{"amount": "-0.005"}, {"amount": "-0.005"}])


def test_budget_plan_actual_and_full_backup(engine, tmp_path):
    acc = account(engine)
    budget = {
        "id": "sample-budget",
        "name": "Plan",
        "currency": "CAD",
        "items": [
            {
                "id": "sample-item",
                "name": "Bill",
                "direction": "expense",
                "category": "mandatory",
                "amount": "100",
                "currency": "CAD",
                "exchange_rate": "1",
                "recurrence": "monthly",
                "renewal_date": "2026-09-01",
                "active": True,
            }
        ],
    }
    defaults = {"currency": "CAD", "period": "biweekly", "anchor": "2026-08-28"}
    with connect(engine.path) as db:
        db.execute(
            "INSERT INTO documents VALUES (?,?)",
            ("budgets", json.dumps({"revision": 0, "budgets": [budget], "settings": defaults})),
        )
    engine.mutate(
        "alice",
        "save",
        {"kind": "budget_link", "account_id": acc["id"], "budget_id": budget["id"], "percentage": "100"},
    )
    tx(engine, acc, "-80", budget_id=budget["id"], item_id="sample-item")
    report = engine.query("alice", "reports", {"currency": "CAD", "from": "2026-09-01", "to": "2026-09-30"})
    assert report["budget_comparisons"][0]["expense_difference"] == "20.00"
    backup = engine.query("alice", "export") | {"budgets": [budget], "budget_settings": defaults}
    path = str(tmp_path / "full.sqlite")
    initialize(path)
    restored = Finance(path)
    restored.mutate("alice", "restore", {"backup": backup})
    assert (
        restored.query("alice", "reports", {"currency": "CAD", "from": "2026-09-01", "to": "2026-09-30"})[
            "budget_comparisons"
        ][0]["expense_difference"]
        == "20.00"
    )


def test_loan_actual_payment_is_capital_transfer_plus_interest(engine):
    cash = account(engine)
    debt = account(engine, "Loan", balance="-1000", type="loan")
    loan = engine.mutate(
        "alice",
        "save",
        {
            "kind": "loan",
            "account_id": debt["id"],
            "date": "2026-09-01",
            "principal": "1000",
            "payment": "100",
            "interest_rate": "0",
        },
    )
    engine.mutate(
        "alice",
        "loan_payment",
        {
            "loan_id": loan["id"],
            "account_id": cash["id"],
            "date": "2026-09-01",
            "principal": "100",
            "interest": "10",
            "fee": "2",
        },
    )
    report = engine.query("alice", "reports", {"currency": "CAD", "from": "2026-09-01", "to": "2026-09-02"})
    assert report["expenses"] == "12.00"
    assert report["debt"] == "900.00"
    assert report["net_worth"] == "-12.00"
