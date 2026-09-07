"""Assignment personalizes the overview without changing shared household access."""

import pytest
from test_finance import account, tx

from custom_components.autonomous_budget.database import connect, initialize
from custom_components.autonomous_budget.finance import Finance, get, put


@pytest.fixture
def engine(tmp_path):
    path = str(tmp_path / "ledger.sqlite")
    initialize(path)
    return Finance(path)


def test_overview_uses_assignment_not_creator_and_never_falls_back_to_all(engine):
    alice = account(engine, balance="100", assigned_user_id="alice")
    bob = account(engine, balance="200", assigned_user_id="bob")
    account(engine, balance="300")
    account(engine, balance="400", assigned_user_id="alice", archived=True)
    account(engine, currency="USD", assigned_user_id="bob")
    tx(engine, alice, "-10")
    tx(engine, bob, "20")
    p = {"overview": True, "today": "2026-09-07", "currency": "CAD"}
    result = engine.query("alice", "reports", p)
    assert result["scope"] == "assigned_user"
    assert result["net_worth"] == "90.00" and result["expenses"] == "10.00"
    assert result["income"] == "0.00" and result["complete"]
    assert [a["id"] for a in result["accounts"]] == [alice["id"]]
    empty = engine.query("charlie", "reports", p)
    assert empty["net_worth"] == "0.00" and empty["accounts"] == [] and empty["complete"]
    household = engine.query("charlie", "reports", {"today": "2026-09-07"})
    assert len(household["accounts"]) == 5 and not household["complete"]
    assert engine.query("charlie", "transactions")["total"] == 2
    engine.mutate("charlie", "save", {"kind": "account", "id": alice["id"], "assigned_user_id": "bob"})
    assert engine.query("alice", "reports", p)["accounts"] == []


def test_personal_current_bank_values_keep_journal_reports_historical(engine):
    acc = account(engine, balance="100", assigned_user_id="alice")
    with connect(engine.path) as db:
        put(db, {"id": "mapping", "kind": "mapping", "account_id": acc["id"], "owner": "alice"})
        put(
            db,
            get(db, acc["id"])
            | {
                "bank_balance": {"balance": {"amount": "250", "currency": "CAD"}},
                "bank_balance_status": "ok",
                "bank_checked": "2026-09-07",
            },
        )
    tx(engine, acc, "-10")
    p = {"overview": True, "today": "2026-09-07", "from": "2025-01-01", "to": "2025-02-01"}
    personal = engine.query("alice", "reports", p)
    assert personal["from"] == "2026-09-01" and personal["to"] == "2026-09-07"
    assert personal["net_worth"] == "250.00" and personal["expenses"] == "10.00"
    assert personal["balance_basis"] == "bank_and_ledger" and personal["complete"]
    journal = engine.query("alice", "reports", {"today": "2026-09-07"})
    assert journal["net_worth"] == "90.00" and journal["balance_basis"] == "ledger"
    with connect(engine.path) as db:
        put(db, get(db, acc["id"]) | {"bank_balance_status": "unavailable"})
    stale = engine.query("alice", "reports", p)
    assert stale["net_worth"] == "250.00" and not stale["complete"]
    assert stale["missing"][0]["type"] == "bank_balance"
    with connect(engine.path) as db:
        put(db, get(db, acc["id"]) | {"bank_balance": None})
    missing = engine.query("alice", "reports", p)
    assert missing["accounts"][0]["balance"] is None and not missing["complete"]
