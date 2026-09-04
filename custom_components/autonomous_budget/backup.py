"""Validated, atomic restoration into an empty private finance workspace."""

import json

from .finance import Finance, get, objects, put, transaction, uid
from .investments import portfolio
from .model import ValidationError


def restore(db, actor, backup):
    if backup.get("format") != "autonomous_budget_finance" or backup.get("version") != 1:
        raise ValidationError("Unsupported backup format.")
    if any(o["owner"] == actor and o["kind"] != "preferences" for o in objects(db)):
        raise ValidationError("Restore requires an empty finance workspace.")
    records = backup.get("objects")
    txs = backup.get("transactions")
    if not isinstance(records, list) or not isinstance(txs, list) or len(records) > 20000 or len(txs) > 1000000:
        raise ValidationError("Invalid backup contents.")
    budget_definitions = backup.get("budgets", [])
    ids = (
        [o.get("id") for o in records]
        + [o.get("id") for o in txs]
        + [b["id"] for b in budget_definitions]
        + [i["id"] for b in budget_definitions for i in b["items"]]
    )
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValidationError("Backup identifiers must be unique.")
    mapping = {key: uid() for key in ids}
    for tx in txs:
        if tx.get("transfer_id"):
            mapping.setdefault(tx["transfer_id"], uid())

    def rewrite(value):
        if isinstance(value, dict):
            return {k: rewrite(v) for k, v in value.items()}
        if isinstance(value, list):
            return [rewrite(v) for v in value]
        return mapping.get(value, value) if isinstance(value, str) else value

    records = [rewrite(o) | {"owner": actor, "sharing": {}, "publish_sensors": False} for o in records]
    if budget_definitions:
        from .model import validate_budget, validate_item, validate_settings
        from .sharing import validate_links

        row = db.execute("SELECT body FROM documents WHERE id='budgets'").fetchone()
        document = (
            json.loads(row[0])
            if row
            else {"revision": 0, "settings": validate_settings(backup["budget_settings"]), "budgets": []}
        )
        for raw in budget_definitions:
            budget = rewrite(raw)
            items = [validate_item(i, budget["currency"]) | {"id": i["id"]} for i in budget["items"]]
            document["budgets"].append(validate_budget(budget) | {"id": budget["id"], "items": items})
        validate_links(document["budgets"])
        document["revision"] += 1
        db.execute("INSERT OR REPLACE INTO documents VALUES ('budgets',?)", (json.dumps(document),))
    engine = Finance("")
    pending = records[:]
    deferred = []
    order = (
        "account",
        "category",
        "instrument",
        "asset",
        "preferences",
        "rate",
        "valuation",
        "rule",
        "recurring",
        "loan",
    )
    for kind in order:
        rows = [o for o in pending if o["kind"] == kind]
        for _attempt in range(len(rows) + 1):
            remaining = []
            for record in rows:
                parent = record.get("portfolio_id") or record.get("parent_id")
                if parent and not db.execute("SELECT 1 FROM objects WHERE id=?", (parent,)).fetchone():
                    remaining.append(record)
                    continue
                data = {k: v for k, v in record.items() if k != "id"}
                if kind == "account":
                    data["archived"] = False
                new = engine.save(db, actor, data)
                if kind == "rate" and record.get("source") in ("manual", "Frankfurter"):
                    new["source"] = record["source"]
                db.execute("DELETE FROM objects WHERE id=?", (new["id"],))
                put(db, new | {"id": record["id"]})
            if not remaining:
                break
            if len(remaining) == len(rows):
                raise ValidationError("Backup contains missing or cyclic references.")
            rows = remaining
    for obj in records:
        if obj["kind"] in ("quote", "trade", "reconciliation"):
            deferred.append(obj)
        elif obj["kind"] not in order and obj["kind"] not in ("connection", "mapping", "conflict", "budget_link"):
            raise ValidationError("Unexpected backup record type.")
    for obj in deferred:
        if obj["kind"] == "quote":
            from .finance import day, number

            instrument = get(db, obj["instrument_id"], "instrument")
            day(obj["date"])
            number(obj["value"], True)
            if obj["currency"] != instrument["currency"]:
                raise ValidationError("Invalid quote currency.")
        else:
            get(db, obj["account_id"], "account")
            if obj["kind"] == "trade":
                get(db, obj["instrument_id"], "instrument")
                from .finance import day, number

                day(obj["date"])
                for key in ("quantity", "price", "fee"):
                    number(obj[key], True)
                if (
                    obj["action"] in ("buy", "sell", "opening", "reinvest", "split", "transfer_in", "transfer_out")
                    and number(obj["quantity"]) <= 0
                ):
                    raise ValidationError("Quantity must be positive.")
                if obj.get("cost") is not None:
                    number(obj["cost"], True)
                if obj["action"] not in (
                    "buy",
                    "sell",
                    "opening",
                    "dividend",
                    "interest",
                    "coupon",
                    "reinvest",
                    "split",
                    "transfer_in",
                    "transfer_out",
                ):
                    raise ValidationError("Invalid investment operation.")
        put(db, obj)
    if budget_definitions:
        for obj in records:
            if obj["kind"] == "budget_link":
                raw = {k: v for k, v in obj.items() if k != "id"}
                fresh = engine.save(db, actor, raw)
                db.execute("DELETE FROM objects WHERE id=?", (fresh["id"],))
                put(db, fresh | {"id": obj["id"]})
    transfers = {}
    for raw in sorted(txs, key=lambda t: bool(t.get("refund_id"))):
        tx = rewrite(raw)
        if not budget_definitions:
            tx["splits"] = [s | {"budget_id": None, "item_id": None} for s in tx["splits"]]
        transaction(db, tx, actor, True)
        if tx.get("transfer_id"):
            transfers.setdefault(tx["transfer_id"], []).append(tx)
    for pair in transfers.values():
        if len(pair) != 2 or pair[0]["account_id"] == pair[1]["account_id"]:
            raise ValidationError("Invalid transfer pair in backup.")
    for record in records:
        if record["kind"] == "account" and record.get("archived"):
            put(db, get(db, record["id"], "account") | {"archived": True})
    for reconciliation in (o for o in deferred if o["kind"] == "reconciliation" and not o.get("reopened")):
        from .finance import balance, number

        acc = get(db, reconciliation["account_id"], "account")
        if balance(db, acc, reconciliation["date"], True) != number(reconciliation["balance"]):
            raise ValidationError("Invalid reconciled balance in backup.")
        for tx_id in reconciliation.get("transaction_ids", []):
            row = db.execute("SELECT body FROM transactions WHERE id=?", (tx_id,)).fetchone()
            if not row or json.loads(row[0])["account_id"] != acc["id"]:
                raise ValidationError("Invalid reconciliation references in backup.")
    for acc in objects(db, "account"):
        if acc["owner"] == actor and acc["type"] == "investment":
            portfolio(db, acc, "9999-12-31")
    return {"accounts": sum(o["kind"] == "account" for o in records), "transactions": len(txs)}
