"""Private financial ledger. All mutations run in one SQLite transaction."""

import csv
import io
import json
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from .const import CURRENCIES
from .database import connect
from .model import ValidationError

ACCOUNT_TYPES = ("checking", "savings", "cash", "credit", "loan", "investment")
KINDS = (
    "account",
    "category",
    "rule",
    "recurring",
    "instrument",
    "trade",
    "asset",
    "valuation",
    "loan",
    "rate",
    "quote",
    "connection",
    "mapping",
    "conflict",
    "reconciliation",
    "budget_link",
    "preferences",
)


def number(value, positive=False):
    try:
        if len(str(value)) > 80:
            raise ValueError
        result = Decimal(str(value))
        if (
            not result.is_finite()
            or result.as_tuple().exponent < -40
            or abs(result) > Decimal("1e18")
            or (positive and result < 0)
        ):
            raise ValueError
        return result
    except InvalidOperation, ValueError, TypeError:
        raise ValidationError("Invalid amount.") from None


def currency(value):
    if value not in CURRENCIES:
        raise ValidationError("Unsupported currency.")
    return value


def money(value, unit):
    from decimal import ROUND_HALF_UP

    return format(number(value).quantize(Decimal(10) ** -CURRENCIES[currency(unit)], rounding=ROUND_HALF_UP), "f")


def day(value):
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError, TypeError:
        raise ValidationError("Invalid date.") from None


def label(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 500:
        raise ValidationError("A name is required (maximum 500 characters).")
    return value.strip()


def uid():
    return uuid4().hex


def objects(db, kind=None):
    rows = (
        db.execute("SELECT body FROM objects WHERE kind=?", (kind,)) if kind else db.execute("SELECT body FROM objects")
    )
    return [json.loads(row[0]) for row in rows]


def include_category_parents(db, records):
    found = {o["id"] for o in records}
    for record in records:
        if record["kind"] == "category" and record.get("parent_id") and record["parent_id"] not in found:
            parent = get(db, record["parent_id"], "category")
            records.append(parent)
            found.add(parent["id"])
    return records


def get(db, object_id, kind=None):
    row = db.execute("SELECT body FROM objects WHERE id=?", (object_id,)).fetchone()
    if not row:
        raise ValidationError("Record no longer exists.")
    obj = json.loads(row[0])
    if kind and obj["kind"] != kind:
        raise ValidationError("Unexpected record type.")
    return obj


def allowed(obj, actor, write=False):
    return obj.get("owner") == actor or obj.get("sharing", {}).get(actor) in (
        ("write",) if write else ("read", "write")
    )


def require(obj, actor, write=False):
    if not allowed(obj, actor, write):
        raise ValidationError("Access denied.")
    return obj


def put(db, obj):
    db.execute(
        "INSERT INTO objects VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,owner=excluded.owner,body=excluded.body",
        (obj["id"], obj["kind"], obj["owner"], json.dumps(obj)),
    )
    return obj


def account(db, account_id, actor, write=False):
    obj = get(db, account_id, "account")
    if obj.get("portfolio_id"):
        parent = require(get(db, obj["portfolio_id"], "account"), actor, write)
        obj = obj | {"owner": parent["owner"], "sharing": parent.get("sharing", {})}
    return require(obj, actor, write)


def balance(db, acc, until=None, cleared=False):
    until = until or date.today().isoformat()
    if acc["opening_date"] > until:
        return Decimal(0)
    sql = "SELECT amount, status FROM transactions WHERE account_id=? AND date<=?"
    total = number(acc.get("opening_balance", "0"))
    for row in db.execute(sql, (acc["id"], until)):
        if row["status"] != "pending" and (not cleared or row["status"] in ("cleared", "reconciled")):
            total += number(row["amount"])
    return total


def rate(db, source, target, when, actor):
    if source == target:
        return Decimal(1)
    row = db.execute(
        """SELECT body FROM objects WHERE kind='rate'
      AND json_extract(body,'$.date')<=?
      AND ((json_extract(body,'$.base')=? AND json_extract(body,'$.currency')=?) OR (json_extract(body,'$.base')=? AND json_extract(body,'$.currency')=?))
      AND (owner=? OR json_extract(body,'$.public')=1 OR EXISTS (SELECT 1 FROM json_each(json_extract(objects.body,'$.sharing')) WHERE key=? AND value IN ('read','write')))
      ORDER BY json_extract(body,'$.date') DESC,(json_extract(body,'$.source')='manual') DESC LIMIT 1""",
        (when, source, target, target, source, actor, actor),
    ).fetchone()
    if not row:
        return None
    found = json.loads(row[0])
    value = number(found["value"], True)
    return (1 / value if found["base"] == target else value) if value else None


def convert(db, amount, source, target, when, actor):
    exchange = rate(db, source, target, when, actor)
    return number(amount) * exchange if exchange is not None else None


def visible(db, obj, actor):
    if obj["kind"] == "account" and obj.get("portfolio_id"):
        return allowed(get(db, obj["portfolio_id"], "account"), actor)
    for key, kind in (("asset_id", "asset"), ("instrument_id", "instrument"), ("connection_id", "connection")):
        if obj["kind"] in ("valuation", "quote", "mapping", "conflict") and obj.get(key):
            try:
                return visible(db, get(db, obj[key], kind), actor)
            except ValidationError:
                return False
    if obj["kind"] in ("trade", "reconciliation", "recurring", "rule", "budget_link", "loan") and obj.get("account_id"):
        try:
            return bool(account(db, obj["account_id"], actor))
        except ValidationError:
            return False
    if obj["kind"] in ("category", "instrument") and not allowed(obj, actor):
        accounts = [a["id"] for a in objects(db, "account") if visible(db, a, actor)]
        if not accounts:
            return False
        placeholders = ",".join("?" for _ in accounts)
        if obj["kind"] == "instrument":
            return bool(
                db.execute(
                    "SELECT 1 FROM objects WHERE kind='trade' AND json_extract(body,'$.account_id') IN ("
                    + placeholders
                    + ") AND json_extract(body,'$.instrument_id')=? LIMIT 1",
                    accounts + [obj["id"]],
                ).fetchone()
            )
        return bool(
            db.execute(
                "SELECT 1 FROM transactions t,json_each(json_extract(t.body,'$.splits')) s WHERE t.account_id IN ("
                + placeholders
                + ") AND json_extract(s.value,'$.category_id')=? LIMIT 1",
                accounts + [obj["id"]],
            ).fetchone()
        )
    return allowed(obj, actor) or obj.get("public", False)


def read_record(db, obj, actor):
    if not visible(db, obj, actor):
        raise ValidationError("Access denied.")
    return obj


def budget_access(db, budgets):
    """Apply account privacy to every connected common/personal budget."""
    access = {}
    for link in objects(db, "budget_link"):
        acc = get(db, link["account_id"], "account")
        users = {acc["owner"], *acc.get("sharing", {})}
        key = link["budget_id"]
        access[key] = users if key not in access else access[key] & users
    changed = True
    while changed:
        changed = False
        for budget in budgets:
            for allocation in budget.get("allocations", []):
                keys = (budget["id"], allocation["budget_id"])
                restricted = [access[k] for k in keys if k in access]
                if restricted:
                    common = set.intersection(*restricted)
                    for key in keys:
                        if access.get(key) != common:
                            access[key] = common.copy()
                            changed = True
    return access


def transaction(db, payload, actor, internal=False):
    data = dict(payload)
    acc = account(db, data.get("account_id"), actor, True)
    if acc.get("archived"):
        raise ValidationError("This account is archived.")
    old = None
    if data.get("id"):
        row = db.execute("SELECT body FROM transactions WHERE id=?", (data["id"],)).fetchone()
        if row:
            old = json.loads(row[0])
            account(db, old["account_id"], actor, True)
            if old["account_id"] != acc["id"]:
                raise ValidationError("A transaction cannot move between accounts.")
            if old["status"] == "reconciled":
                raise ValidationError("Reopen the reconciliation before editing this transaction.")
    amount = money(data.get("amount"), acc["currency"])
    if number(amount) != number(data.get("amount")):
        raise ValidationError("Too many decimal places for the account currency.")
    txdate = day(data.get("date"))
    if txdate < acc["opening_date"]:
        raise ValidationError("Transaction date precedes the opening balance.")
    closed = [r for r in objects(db, "reconciliation") if r["account_id"] == acc["id"] and not r.get("reopened")]
    if not old and data.get("status") not in ("pending", "reconciled") and any(txdate <= r["date"] for r in closed):
        raise ValidationError("Reopen the reconciliation before adding a transaction in this period.")
    status = data.get("status", "unmarked")
    if status not in ("unmarked", "cleared", "pending") and not (internal and status == "reconciled"):
        raise ValidationError("Invalid transaction status.")
    splits = data.get("splits") or [
        {
            "amount": amount,
            "category_id": data.get("category_id"),
            "budget_id": data.get("budget_id"),
            "item_id": data.get("item_id"),
        }
    ]
    if not isinstance(splits, list) or len(splits) > 100 or sum(number(s["amount"]) for s in splits) != number(amount):
        raise ValidationError("Split amounts must equal the transaction amount.")
    clean_splits = []
    budgets_row = db.execute("SELECT body FROM documents WHERE id='budgets'").fetchone()
    budgets = json.loads(budgets_row[0])["budgets"] if budgets_row else []
    for split in splits:
        cat = split.get("category_id")
        if cat:
            read_record(db, get(db, cat, "category"), actor)
        budget_id = split.get("budget_id")
        if budget_id:
            if not any(b["id"] == budget_id for b in budgets):
                raise ValidationError("Budget no longer exists.")
            links = [o for o in objects(db, "budget_link") if o["budget_id"] == budget_id]
            if actor not in budget_access(db, budgets).get(budget_id, {actor}):
                raise ValidationError("Access denied.")
            if not links or not any(o["account_id"] == acc["id"] for o in links):
                raise ValidationError("Link this account to the budget before assigning transactions.")
            item_id = split.get("item_id")
            if item_id and not any(i["id"] == item_id for b in budgets if b["id"] == budget_id for i in b["items"]):
                raise ValidationError("Budget entry no longer exists.")
        if number(split["amount"]) != number(money(split["amount"], acc["currency"])):
            raise ValidationError("Too many decimal places in a split.")
        clean_splits.append(
            {k: split.get(k) for k in ("category_id", "budget_id", "item_id")}
            | {"amount": money(split["amount"], acc["currency"])}
        )
    if old and (old.get("transfer_id") or old.get("trade_id")) and not internal:
        if amount != old["amount"] or txdate != old["date"] or clean_splits != old["splits"]:
            raise ValidationError("Edit the linked operation as a whole.")
    if old and any(min(old["date"], txdate) <= r["date"] for r in closed):
        if amount != old["amount"] or txdate != old["date"] or status != old["status"]:
            raise ValidationError("Reopen the reconciliation before editing this transaction.")
    tx = {k: data.get(k) for k in ("external_id", "transfer_id", "trade_id", "recurring_id", "refund_id", "asset_id")}
    if not internal:
        for key in ("external_id", "transfer_id", "trade_id", "recurring_id"):
            tx[key] = old.get(key) if old else None
    if tx.get("refund_id"):
        original = db.execute("SELECT body FROM transactions WHERE id=?", (tx["refund_id"],)).fetchone()
        if not original:
            raise ValidationError("Original transaction no longer exists.")
        original = json.loads(original[0])
        account(db, original["account_id"], actor)
        if number(original["amount"]) >= 0 or number(amount) <= 0:
            raise ValidationError("A refund must reference an expense.")
    if tx.get("asset_id"):
        require(get(db, tx["asset_id"], "asset"), actor)
    tx.update(
        id=data.get("id") or uid(),
        account_id=acc["id"],
        date=txdate,
        amount=amount,
        currency=acc["currency"],
        status=status,
        payee=str(data.get("payee", ""))[:500],
        description=str(data.get("description", ""))[:2000],
        notes=str(data.get("notes", ""))[:10000],
        fee=money(number(data.get("fee") or "0", True), acc["currency"]),
        splits=clean_splits,
        original_currency=currency(data.get("original_currency") or acc["currency"]),
        original_amount=str(number(data.get("original_amount", amount))),
        exchange_rate=str(number(data.get("exchange_rate", "1"), True)),
    )
    if number(tx["exchange_rate"]) <= 0:
        raise ValidationError("The exchange rate must be positive.")
    if not old and not any(s["category_id"] for s in tx["splits"]):
        for rule in objects(db, "rule"):
            if (
                rule["account_id"] == acc["id"]
                and rule.get("match", "").casefold() in (tx["payee"] + " " + tx["description"]).casefold()
            ):
                tx["splits"][0]["category_id"] = rule.get("category_id")
                break
    db.execute(
        "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,date=excluded.date,external_id=excluded.external_id,transfer_id=excluded.transfer_id,status=excluded.status,amount=excluded.amount,body=excluded.body",
        (tx["id"], acc["id"], txdate, tx.get("external_id"), tx.get("transfer_id"), status, amount, json.dumps(tx)),
    )
    return tx


class Finance:
    def __init__(self, path):
        self.path = path

    def query(self, actor, command, payload=None):
        p = payload or {}
        with connect(self.path) as db:
            db.execute("BEGIN")
            if command == "snapshot":
                records = [
                    o
                    for o in (
                        json.loads(row[0])
                        for row in db.execute("""SELECT body FROM (SELECT body,kind,ROW_NUMBER() OVER (
                        PARTITION BY kind,owner,CASE WHEN kind='quote' THEN json_extract(body,'$.instrument_id') WHEN kind='rate' THEN json_extract(body,'$.base')||':'||json_extract(body,'$.currency') ELSE id END
                        ORDER BY json_extract(body,'$.date') DESC,(json_extract(body,'$.source')='manual') DESC) AS row_number
                        FROM objects WHERE kind NOT IN ('trade','reconciliation')) WHERE kind NOT IN ('quote','rate') OR row_number=1""")
                    )
                    if visible(db, o, actor)
                ]
                records = include_category_parents(db, records)
                for obj in records:
                    obj.pop("api_key", None)
                    if obj["kind"] == "account":
                        obj["balance"] = money(balance(db, obj, p.get("today")), obj["currency"])
                        effective = account(db, obj["id"], actor)
                        obj["sharing"] = effective.get("sharing", {})
                        obj["can_write"] = allowed(effective, actor, True)
                return {
                    "revision": db.execute("SELECT value FROM metadata WHERE id='revision'").fetchone()[0],
                    "objects": records,
                    "today": p.get("today", date.today().isoformat()),
                }
            if command == "transactions":
                ids = [o["id"] for o in objects(db, "account") if visible(db, o, actor)]
                if p.get("account_id"):
                    account(db, p["account_id"], actor)
                    ids = [p["account_id"]]
                if not ids:
                    return {"rows": [], "total": 0}
                where = "account_id IN (" + ",".join("?" for _ in ids) + ")"
                args = ids[:]
                for key, operator in (("from", ">="), ("to", "<=")):
                    if p.get(key):
                        where += f" AND date{operator}?"
                        args.append(day(p[key]))
                if p.get("flows_only"):
                    where += " AND status!='pending' AND json_extract(body,'$.transfer_id') IS NULL AND json_extract(body,'$.trade_id') IS NULL"
                if p.get("status"):
                    where += " AND status=?"
                    args.append(p["status"])
                if p.get("search"):
                    where += " AND (json_extract(body,'$.payee') LIKE ? OR json_extract(body,'$.description') LIKE ?)"
                    args += ["%" + str(p["search"])[:200] + "%"] * 2
                if p.get("account_ids"):
                    selected = [i for i in p["account_ids"] if i in ids]
                    if not selected:
                        return {"rows": [], "total": 0}
                    where += " AND account_id IN (" + ",".join("?" for _ in selected) + ")"
                    args += selected
                if p.get("asset_id"):
                    if p["asset_id"] == "unassigned":
                        where += " AND json_extract(body,'$.asset_id') IS NULL"
                    else:
                        where += " AND json_extract(body,'$.asset_id')=?"
                        args.append(p["asset_id"])
                if p.get("payee") is not None:
                    where += " AND json_extract(body,'$.payee')=?"
                    args.append(str(p["payee"]))
                for key in ("category_id", "budget_id"):
                    if p.get(key):
                        if p[key] in ("uncategorized", "unassigned"):
                            where += f" AND EXISTS (SELECT 1 FROM json_each(json_extract(transactions.body,'$.splits')) s WHERE json_extract(s.value,'$.{key}') IS NULL)"
                        else:
                            where += f" AND EXISTS (SELECT 1 FROM json_each(json_extract(transactions.body,'$.splits')) s WHERE json_extract(s.value,'$.{key}')=?)"
                            args.append(p[key])
                total = db.execute("SELECT COUNT(*) FROM transactions WHERE " + where, args).fetchone()[0]
                limit = max(1, min(int(p.get("limit", 100)), 500))
                offset = max(0, int(p.get("offset", 0)))
                rows = db.execute(
                    "SELECT body FROM transactions WHERE " + where + " ORDER BY date DESC,id DESC LIMIT ? OFFSET ?",
                    args + [limit, offset],
                )
                return {"rows": [json.loads(r[0]) for r in rows], "total": total}
            if command == "account_summary":
                from .reports import report

                acc = account(db, p["account_id"], actor)
                totals = report(
                    db,
                    actor,
                    {
                        "currency": acc["currency"],
                        "account_ids": [acc["id"]],
                        "today": p.get("today", date.today().isoformat()),
                        "summary": True,
                    },
                )
                return {k: acc.get(k) for k in ("id", "name", "currency", "bank_checked")} | {
                    "balance": money(balance(db, acc, p.get("today")), acc["currency"]),
                    "income": totals["income"],
                    "expenses": totals["expenses"],
                    "complete": totals["complete"],
                }
            if command == "reports":
                from .reports import report

                return report(db, actor, p)
            if command == "trades":
                account(db, p["account_id"], actor)
                rows = db.execute(
                    "SELECT body FROM objects WHERE kind='trade' AND json_extract(body,'$.account_id')=? ORDER BY json_extract(body,'$.date') DESC,json_extract(body,'$.sequence') DESC LIMIT ? OFFSET ?",
                    (p["account_id"], min(500, max(1, int(p.get("limit", 100)))), max(0, int(p.get("offset", 0)))),
                )
                return [json.loads(r[0]) for r in rows]
            if command == "portfolio":
                from .investments import portfolio

                acc = account(db, p["account_id"], actor)
                return portfolio(db, acc, p.get("to") or p.get("today"))
            if command == "bond_schedule":
                from .investments import bond_schedule

                return bond_schedule(read_record(db, get(db, p["id"], "instrument"), actor))
            if command == "loan_schedule":
                from .investments import loan_schedule

                loan = get(db, p["id"], "loan")
                account(db, loan["account_id"], actor)
                return loan_schedule(loan)
            if command == "calendar":
                from datetime import timedelta

                from .model import occurrences

                start = day(p.get("from", p.get("today", date.today().isoformat())))
                end = min(
                    day(p.get("to", (date.fromisoformat(start) + timedelta(days=90)).isoformat())),
                    (date.fromisoformat(start) + timedelta(days=366)).isoformat(),
                )
                result = []
                for template in objects(db, "recurring"):
                    if not visible(db, template, actor):
                        continue
                    definition = {
                        "active": True,
                        "renewal_date": template["date"],
                        "recurrence": template["recurrence"],
                        "end_date": template.get("end_date"),
                    }
                    for due in occurrences(definition, date.fromisoformat(start), date.fromisoformat(end)):
                        when = due.isoformat()
                        posted = (
                            when in template.get("posted_dates", [])
                            or db.execute(
                                "SELECT 1 FROM transactions WHERE account_id=? AND (external_id=? OR (json_extract(body,'$.recurring_id')=? AND date=?))",
                                (
                                    template["account_id"],
                                    "recurring:" + template["id"] + ":" + when,
                                    template["id"],
                                    when,
                                ),
                            ).fetchone()
                        )
                        if not posted:
                            result.append(
                                {
                                    "id": template["id"],
                                    "date": when,
                                    "description": template.get("description", ""),
                                    "amount": template["amount"],
                                    "account_id": template["account_id"],
                                }
                            )
                return sorted(result, key=lambda r: r["date"])[:500]
            if command == "reconciliations":
                account(db, p["account_id"], actor)
                return [o for o in objects(db, "reconciliation") if o["account_id"] == p["account_id"]]
            if command == "audit":
                # Only changes made by this user; never expose others' private payloads.
                return [
                    dict(r)
                    for r in db.execute(
                        "SELECT id,at,action FROM audit WHERE actor=? ORDER BY id DESC LIMIT 100", (actor,)
                    )
                ]
            if command == "export":
                accounts = {o["id"] for o in objects(db, "account") if visible(db, o, actor)}
                data = [o for o in objects(db) if visible(db, o, actor) and o["kind"] != "connection"]
                data = include_category_parents(db, data)
                txs = [
                    json.loads(r[0])
                    for a in accounts
                    for r in db.execute("SELECT body FROM transactions WHERE account_id=? ORDER BY date,id", (a,))
                ]
                return {"format": "autonomous_budget_finance", "version": 1, "objects": data, "transactions": txs}
            if command == "csv":
                rows = self.query(actor, "transactions", p | {"limit": 500})["rows"]
                output = io.StringIO()
                writer = csv.DictWriter(
                    output,
                    fieldnames=["date", "payee", "description", "amount", "currency", "status"],
                    extrasaction="ignore",
                )
                writer.writeheader()
                writer.writerows(rows)
                return {"csv": output.getvalue()}
            raise ValidationError("Unknown query.")

    def mutate(self, actor, action, payload, revision=None):
        with connect(self.path) as db:
            db.create_function("audit_actor", 0, lambda: actor)
            db.execute("BEGIN IMMEDIATE")
            current = db.execute("SELECT value FROM metadata WHERE id='revision'").fetchone()[0]
            if revision is not None and revision != current:
                raise ValidationError("Data changed in another session. Refresh and try again.")
            result = self.apply(db, actor, action, payload)
            db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
            # Secrets never enter the audit trail.
            safe = {k: v for k, v in payload.items() if k not in ("api_key", "file", "backup")}
            db.execute("INSERT INTO audit(actor,action,body) VALUES (?,?,?)", (actor, action, json.dumps(safe)))
            return result

    def apply(self, db, actor, action, p):
        if action == "save":
            return self.save(db, actor, p)
        if action == "delete":
            obj = get(db, p["id"])
            if obj.get("account_id"):
                account(db, obj["account_id"], actor, True)
            else:
                require(obj, actor, True)
            if obj["kind"] == "budget_link" and obj["owner"] != actor:
                raise ValidationError("Only the account owner can link a budget.")
            if obj["kind"] not in ("rule", "budget_link", "recurring"):
                raise ValidationError("Archive this record to preserve its history.")
            db.execute("DELETE FROM objects WHERE id=?", (obj["id"],))
            return {}
        if action == "transaction":
            return transaction(db, p, actor)
        if action == "transaction_delete":
            row = db.execute("SELECT body FROM transactions WHERE id=?", (p["id"],)).fetchone()
            if not row:
                raise ValidationError("Transaction no longer exists.")
            tx = json.loads(row[0])
            account(db, tx["account_id"], actor, True)
            if tx["status"] == "reconciled" or tx.get("trade_id") or tx.get("external_id"):
                raise ValidationError("This operation cannot be deleted. Reopen or correct its source.")
            linked = (
                [
                    json.loads(r[0])
                    for r in db.execute("SELECT body FROM transactions WHERE transfer_id=?", (tx.get("transfer_id"),))
                ]
                if tx.get("transfer_id")
                else [tx]
            )
            for other in linked:
                account(db, other["account_id"], actor, True)
                if other["status"] == "reconciled":
                    raise ValidationError("Reopen the reconciliation first.")
            for other in linked:
                db.execute("DELETE FROM transactions WHERE id=?", (other["id"],))
            return {}
        if action == "bulk":
            if len(p["ids"]) > 500:
                raise ValidationError("Select at most 500 transactions.")
            for txid in p["ids"]:
                row = db.execute("SELECT body FROM transactions WHERE id=?", (txid,)).fetchone()
                if not row:
                    raise ValidationError("Transaction no longer exists.")
                tx = json.loads(row[0])
                changes = {k: p[k] for k in ("status", "notes") if k in p}
                if "category_id" in p:
                    changes["splits"] = [s | {"category_id": p["category_id"]} for s in tx["splits"]]
                transaction(db, tx | changes, actor)
            return {}
        if action == "transfer":
            source = account(db, p["account_id"], actor, True)
            destination = account(db, p["destination_id"], actor, True)
            if source["id"] == destination["id"]:
                raise ValidationError("Choose a different destination account.")
            debit, credit = number(p["amount"], True), number(p["received"], True)
            if not debit or not credit:
                raise ValidationError("Transfer amounts must be positive.")
            if source["currency"] == destination["currency"] and debit != credit:
                raise ValidationError("Use the fee field for transfer fees.")
            transfer_id = uid()
            for acc, value in ((source, -debit), (destination, credit)):
                transaction(
                    db,
                    {
                        "account_id": acc["id"],
                        "date": p["date"],
                        "amount": str(value),
                        "transfer_id": transfer_id,
                        "description": p.get("description", "Transfer"),
                        "exchange_rate": str(credit / debit) if acc["id"] == destination["id"] else "1",
                        "original_currency": source["currency"],
                        "original_amount": str(debit) if acc["id"] == destination["id"] else str(-debit),
                    },
                    actor,
                    True,
                )
            if number(p.get("fee", "0"), True):
                transaction(
                    db,
                    {
                        "account_id": source["id"],
                        "date": p["date"],
                        "amount": str(-number(p["fee"])),
                        "description": "Transfer fee",
                    },
                    actor,
                    True,
                )
            return {"id": transfer_id}
        if action == "reconcile":
            acc = account(db, p["account_id"], actor, True)
            end = day(p["date"])
            expected = number(money(p["balance"], acc["currency"]))
            actual = balance(db, acc, end, cleared=True)
            if actual != expected:
                raise ValidationError(f"Reconciliation difference: {money(actual - expected, acc['currency'])}")
            reconciliation = {
                "id": uid(),
                "kind": "reconciliation",
                "owner": acc["owner"],
                "account_id": acc["id"],
                "date": end,
                "balance": str(expected),
                "transaction_ids": [],
            }
            for row in db.execute(
                "SELECT body FROM transactions WHERE account_id=? AND date<=? AND status='cleared'", (acc["id"], end)
            ).fetchall():
                tx = json.loads(row[0])
                tx["status"] = "reconciled"
                db.execute(
                    "UPDATE transactions SET status=?,body=? WHERE id=?", ("reconciled", json.dumps(tx), tx["id"])
                )
                reconciliation["transaction_ids"].append(tx["id"])
            put(db, reconciliation)
            return reconciliation
        if action == "reopen":
            rec = get(db, p["id"], "reconciliation")
            account(db, rec["account_id"], actor, True)
            affected = [
                r
                for r in objects(db, "reconciliation")
                if r["account_id"] == rec["account_id"] and r["date"] >= rec["date"] and not r.get("reopened")
            ]
            for statement in affected:
                for txid in statement["transaction_ids"]:
                    row = db.execute("SELECT body FROM transactions WHERE id=?", (txid,)).fetchone()
                    if row:
                        tx = json.loads(row[0]) | {"status": "cleared"}
                        db.execute(
                            "UPDATE transactions SET status=?,body=? WHERE id=?", ("cleared", json.dumps(tx), txid)
                        )
                statement["reopened"] = True
                put(db, statement)
            rec["reopened"] = True
            return rec
        if action == "resolve_conflict":
            conflict = get(db, p["id"], "conflict")
            acc = account(db, conflict["account_id"], actor, True)
            incoming = conflict["incoming"]
            match_id = p.get("match_id")
            if match_id:
                if match_id not in conflict["matches"]:
                    raise ValidationError("Choose a suggested matching transaction.")
                row = db.execute("SELECT body FROM transactions WHERE id=?", (match_id,)).fetchone()
                old = json.loads(row[0])
                if old["status"] == "reconciled":
                    raise ValidationError("Reopen the reconciliation before resolving this conflict.")
                if old.get("external_id") and old["external_id"] != incoming["external_id"]:
                    raise ValidationError("This transaction is already linked to another bank operation.")
                if len(old["splits"]) > 1 and old["amount"] != incoming["amount"]:
                    raise ValidationError("Adjust the split amounts before matching this transaction.")
                splits = (
                    old["splits"] if len(old["splits"]) > 1 else [old["splits"][0] | {"amount": incoming["amount"]}]
                )
                transaction(
                    db,
                    old | {k: incoming[k] for k in ("amount", "date", "status", "external_id")} | {"splits": splits},
                    actor,
                    True,
                )
            elif p.get("keep_separate"):
                transaction(db, incoming | {"account_id": acc["id"]}, actor, True)
            else:
                raise ValidationError("Choose a match or keep a separate transaction.")
            db.execute("DELETE FROM objects WHERE id=?", (conflict["id"],))
            return {}
        if action == "restore":
            from .backup import restore

            return restore(db, actor, p["backup"])
        if action == "loan_payment":
            loan = get(db, p["loan_id"], "loan")
            debt_account = account(db, loan["account_id"], actor, True)
            source = account(db, p["account_id"], actor, True)
            if source["currency"] != debt_account["currency"]:
                raise ValidationError("Use a cash account in the loan currency for this payment.")
            principal, interest, fee = [number(p.get(k, "0"), True) for k in ("principal", "interest", "fee")]
            result = (
                self.apply(
                    db,
                    actor,
                    "transfer",
                    {
                        "account_id": source["id"],
                        "destination_id": debt_account["id"],
                        "date": p["date"],
                        "amount": str(principal),
                        "received": str(principal),
                    },
                )
                if principal
                else {}
            )
            for label, amount in (("Interest", interest), ("Loan fee", fee)):
                if amount:
                    transaction(
                        db,
                        {
                            "account_id": source["id"],
                            "date": p["date"],
                            "amount": str(-amount),
                            "description": label,
                            "category_id": p.get("category_id"),
                        },
                        actor,
                        True,
                    )
            return result
        if action in ("trade_update", "trade_delete"):
            original = get(db, p["id"], "trade")
            account(db, original["account_id"], actor, True)
            if original["action"] in ("transfer_in", "transfer_out"):
                raise ValidationError("Correct a security transfer by recording a reverse transfer.")
            cash_rows = [
                json.loads(r[0])
                for r in db.execute(
                    "SELECT body FROM transactions WHERE json_extract(body,'$.trade_id')=?", (original["id"],)
                )
            ]
            for cash_tx in cash_rows:
                account(db, cash_tx["account_id"], actor, True)
                if cash_tx["status"] == "reconciled":
                    raise ValidationError("Reopen the reconciliation before correcting this operation.")
            db.execute("DELETE FROM objects WHERE id=?", (original["id"],))
            for cash_tx in cash_rows:
                db.execute("DELETE FROM transactions WHERE id=?", (cash_tx["id"],))
            from .investments import portfolio, trade

            if action == "trade_update":
                data = original | p
                if cash_rows:
                    data.setdefault("cash_account_id", cash_rows[0]["account_id"])
                    data.setdefault("exchange_rate", cash_rows[0]["exchange_rate"])
                result = trade(db, actor, data, sequence=original["sequence"], event_id=original["id"])
                portfolio(db, get(db, original["account_id"], "account"), "9999-12-31")
                if original.get("import_id"):
                    put(db, result | {"import_id": original["import_id"]})
                return result
            portfolio(db, get(db, original["account_id"], "account"), "9999-12-31")
            return {}
        if action == "trade":
            from .investments import trade

            return trade(db, actor, p)
        if action == "import":
            from .imports import commit_import

            return commit_import(db, actor, p)
        if action == "recurring_post":
            template = get(db, p["id"], "recurring")
            account(db, template["account_id"], actor, True)
            from .planning import next_occurrence

            due = day(p["date"])
            definition = {
                "active": True,
                "renewal_date": template["date"],
                "recurrence": template["recurrence"],
                "end_date": template.get("end_date"),
            }
            if next_occurrence(definition, date.fromisoformat(due)) != date.fromisoformat(due):
                raise ValidationError("This is not a scheduled occurrence.")
            ext = "recurring:" + template["id"] + ":" + due
            if db.execute(
                "SELECT 1 FROM transactions WHERE account_id=? AND external_id=?", (template["account_id"], ext)
            ).fetchone():
                raise ValidationError("This occurrence is already recorded.")
            if due in template.get("posted_dates", []):
                raise ValidationError("This occurrence is already recorded.")
            matches = db.execute(
                "SELECT id FROM transactions WHERE account_id=? AND date=? AND amount=?",
                (template["account_id"], due, template["amount"]),
            ).fetchall()
            if matches:
                if p.get("match_id") not in [r[0] for r in matches]:
                    raise ValidationError("A matching transaction exists. Select it instead of creating another.")
                row = db.execute("SELECT body FROM transactions WHERE id=?", (p["match_id"],)).fetchone()
                tx = json.loads(row[0]) | {"recurring_id": template["id"]}
                db.execute("UPDATE transactions SET body=? WHERE id=?", (json.dumps(tx), tx["id"]))
                template.setdefault("posted_dates", []).append(due)
                put(db, template)
                return tx
            if due in template.get("posted_dates", []):
                raise ValidationError("This occurrence is already recorded.")
            return transaction(
                db,
                {k: v for k, v in template.items() if k != "id"}
                | {"date": due, "external_id": ext, "recurring_id": template["id"]},
                actor,
                True,
            )
        raise ValidationError("Unknown action.")

    def save(self, db, actor, p):
        kind = p.get("kind")
        if kind not in KINDS or kind in ("trade", "reconciliation", "conflict", "quote", "mapping"):
            raise ValidationError("Unsupported record type.")
        old = get(db, p["id"], kind) if p.get("id") else None
        if old:
            if old.get("account_id"):
                account(db, old["account_id"], actor, True)
            elif kind == "account":
                account(db, old["id"], actor, True)
            else:
                require(old, actor, True)
        obj = (old or {}) | p | {"id": p.get("id") or uid(), "kind": kind, "owner": old["owner"] if old else actor}
        obj.pop("public", None)
        if old and old["owner"] != actor:
            obj["sharing"] = old.get("sharing", {})
        else:
            sharing = obj.get("sharing", {})
            if not isinstance(sharing, dict) or any(v not in ("read", "write") for v in sharing.values()):
                raise ValidationError("Invalid sharing permissions.")
        if kind == "account":
            if old and old["owner"] != actor:
                obj["publish_sensors"] = old.get("publish_sensors", False)
            if old and old.get("portfolio_id") != obj.get("portfolio_id"):
                raise ValidationError("A cash pocket cannot move to another portfolio.")
            for field in ("bank_balance", "bank_holdings", "bank_checked"):
                if old and field in old:
                    obj[field] = old[field]
                else:
                    obj.pop(field, None)
            for field in ("publish_sensors", "archived"):
                if field in obj and not isinstance(obj[field], bool):
                    raise ValidationError("Choose a valid switch value.")
            obj["name"] = label(obj.get("name"))
            obj["currency"] = currency(obj.get("currency"))
            obj["type"] = obj.get("type", "checking")
            if obj["type"] not in ACCOUNT_TYPES:
                raise ValidationError("Invalid account type.")
            obj["opening_date"] = day(obj.get("opening_date"))
            obj["opening_balance"] = money(obj.get("opening_balance", "0"), obj["currency"])
            if old and (
                db.execute("SELECT 1 FROM transactions WHERE account_id=? LIMIT 1", (obj["id"],)).fetchone()
                or db.execute(
                    "SELECT 1 FROM objects WHERE kind='trade' AND json_extract(body,'$.account_id')=? LIMIT 1",
                    (obj["id"],),
                ).fetchone()
            ):
                if any(old.get(k) != obj.get(k) for k in ("currency", "opening_date", "opening_balance", "type")):
                    raise ValidationError("Opening details cannot change after transactions are recorded.")
            if obj.get("portfolio_id"):
                parent = account(db, obj["portfolio_id"], actor, True)
                if (
                    parent["type"] != "investment"
                    or parent["currency"] == obj["currency"]
                    or parent.get("portfolio_id")
                ):
                    raise ValidationError("Choose a main investment portfolio in another currency.")
                obj["owner"], obj["sharing"] = parent["owner"], parent.get("sharing", {})
            if obj.get("cost_method", "average") not in ("average", "fifo"):
                raise ValidationError("Invalid cost method.")
        elif kind == "category":
            obj["name"] = label(obj.get("name"))
            parent_id = obj.get("parent_id")
            visited = {obj["id"]}
            while parent_id:
                if parent_id in visited:
                    raise ValidationError("Category cycle.")
                visited.add(parent_id)
                parent = require(get(db, parent_id, "category"), actor)
                parent_id = parent.get("parent_id")
            if obj.get("budget_category") not in (None, "", "investment", "mandatory", "optional"):
                raise ValidationError("Invalid budget category.")
        elif kind in ("rule", "recurring", "budget_link", "loan"):
            acc = account(db, obj.get("account_id"), actor, True)
            obj["owner"], obj["sharing"] = acc["owner"], acc.get("sharing", {})
            if kind == "rule":
                obj["match"] = label(obj.get("match"))
                read_record(db, get(db, obj.get("category_id"), "category"), actor)
            if kind == "recurring":
                from .const import RECURRENCES

                obj["date"] = day(obj.get("date"))
                obj["amount"] = money(obj.get("amount"), acc["currency"])
                if obj.get("category_id"):
                    read_record(db, get(db, obj["category_id"], "category"), actor)
                if old:
                    obj["posted_dates"] = old.get("posted_dates", [])
                if obj.get("recurrence") not in RECURRENCES:
                    raise ValidationError("Invalid recurrence.")
            if kind == "budget_link":
                if acc.get("portfolio_id") or acc["type"] not in ("checking", "savings", "cash", "credit"):
                    raise ValidationError("Only cash and credit accounts can fund budgets.")
                share = number(obj.get("percentage"), True)
                links = [o for o in objects(db, kind) if o["account_id"] == acc["id"] and o["id"] != obj["id"]]
                if (
                    any(o["budget_id"] == obj.get("budget_id") for o in links)
                    or share <= 0
                    or share + sum(number(o["percentage"]) for o in links) > 100
                ):
                    raise ValidationError("Allocations must be unique and total at most 100%.")
                obj["percentage"] = str(share)
                row = db.execute("SELECT body FROM documents WHERE id='budgets'").fetchone()
                if not row or not any(b["id"] == obj.get("budget_id") for b in json.loads(row[0])["budgets"]):
                    raise ValidationError("Budget no longer exists.")
                # The owner must explicitly authorize linking; writes shared on an account do not widen its audience.
                if acc["owner"] != actor:
                    raise ValidationError("Only the account owner can link a budget.")
            if kind == "loan":
                from .investments import loan_schedule

                obj["currency"] = acc["currency"]
                loan_schedule(obj)
        elif kind in ("instrument", "asset"):
            obj["name"] = label(obj.get("name"))
            obj["currency"] = currency(obj.get("currency"))
            if kind == "instrument":
                if (
                    old
                    and obj["currency"] != old["currency"]
                    and db.execute(
                        "SELECT 1 FROM objects WHERE kind IN ('trade','quote') AND json_extract(body,'$.instrument_id')=? LIMIT 1",
                        (obj["id"],),
                    ).fetchone()
                ):
                    raise ValidationError("Instrument currency cannot change after operations or quotes are recorded.")
                if obj.get("instrument_type", "stock") not in ("stock", "etf", "fund", "bond", "crypto"):
                    raise ValidationError("Invalid instrument type.")
                if obj.get("instrument_type") == "bond":
                    obj["face_value"] = str(number(obj.get("face_value", "100"), True))
                    obj["coupon_rate"] = str(number(obj.get("coupon_rate", "0"), True))
                    obj["maturity"] = day(obj["maturity"])
                    obj["coupon_start"] = day(obj["coupon_start"])
                    if int(obj.get("coupon_frequency", 2)) not in (1, 2, 4, 12):
                        raise ValidationError("Invalid coupon frequency.")
            if kind == "asset":
                share = number(obj.get("ownership", "100"), True)
                if share > 100:
                    raise ValidationError("Ownership cannot exceed 100%.")
                obj["ownership"] = str(share)
        elif kind == "valuation":
            parent = require(get(db, obj.get("asset_id"), "asset"), actor, True)
            obj.update(owner=parent["owner"], sharing=parent.get("sharing", {}), currency=parent["currency"])
            obj["date"] = day(obj.get("date"))
            obj["value"] = money(number(obj.get("value"), True), obj["currency"])
        elif kind == "rate":
            obj["base"] = currency(obj.get("base"))
            obj["currency"] = currency(obj.get("currency"))
            obj["date"] = day(obj.get("date"))
            obj["value"] = str(number(obj.get("value"), True))
            if number(obj["value"]) <= 0:
                raise ValidationError("The exchange rate must be positive.")
            obj["source"] = "manual"
        elif kind == "connection":
            obj["name"] = label(obj.get("name", "Lunch Flow"))
            obj["provider"] = "lunchflow"
            if not isinstance(obj.get("api_key"), str) or not obj["api_key"].strip():
                raise ValidationError("A Lunch Flow API key is required.")
            obj["sharing"] = {}
        elif kind == "preferences":
            obj["id"] = "preferences:" + actor
            obj["currency"] = currency(obj.get("currency", "CAD"))
            obj["sharing"] = {}
        put(db, obj)
        return {k: v for k, v in obj.items() if k != "api_key"}
