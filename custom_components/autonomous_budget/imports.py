"""Reviewable bank-file imports. Parsing never writes to the ledger."""

import csv
import hashlib
import io
import json
import re
from datetime import datetime

from .finance import account, money, number, transaction
from .model import ValidationError


def parse_file(content, format_name, options=None):
    options = options or {}
    if not isinstance(content, str) or len(content.encode()) > 10_000_000:
        raise ValidationError("Import files must be smaller than 10 MB.")
    if format_name in ("ofx", "qfx"):
        statements = re.findall(
            r"<(?:STMTTRNRS|CCSTMTTRNRS|INVSTMTTRNRS)>(.*?)</(?:STMTTRNRS|CCSTMTTRNRS|INVSTMTTRNRS)>",
            content,
            re.I | re.S,
        )
        if len(statements) > 1:
            combined = {"rows": [], "errors": []}
            for statement in statements:
                part = parse_file(statement, format_name, options)
                offset = len(combined["rows"]) + len(combined["errors"])
                for key in combined:
                    combined[key].extend(row | {"line": row["line"] + offset} for row in part[key])
            return combined
    rows, errors = [], []
    fmt = options.get("date_format", "%Y-%m-%d")

    def amount(value):
        value = str(value).strip().replace("\u00a0", "").replace(" ", "")
        if options.get("decimal", ".") == ",":
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
        return str(number(value))

    def add(raw, index, date_format=fmt):
        try:
            raw["date"] = datetime.strptime(raw["date"].strip(), date_format).date().isoformat()
            raw["amount"] = amount(raw["amount"])
            if raw.get("split_names"):
                for split in raw["split_names"]:
                    split["amount"] = amount(split["amount"])
            if raw.get("action"):
                if raw["action"] not in (
                    "buy",
                    "sell",
                    "opening",
                    "dividend",
                    "interest",
                    "coupon",
                    "reinvest",
                    "split",
                ):
                    raise ValidationError("Unsupported investment operation: " + raw["action"])
                raw["entry_type"] = "trade"
                for key in ("quantity", "price", "fee"):
                    raw[key] = amount(raw.get(key) or "0")
            raw["line"] = index
            rows.append(raw)
        except (KeyError, ValueError, ValidationError) as err:
            errors.append({"line": index, "message": str(err)})

    if format_name == "csv":
        mapping = options.get("columns", {})
        reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")), delimiter=options.get("delimiter", ","))
        for index, row in enumerate(reader, 2):
            add(
                {
                    key: row.get(mapping.get(key, key), "")
                    for key in (
                        "date",
                        "amount",
                        "payee",
                        "description",
                        "external_id",
                        "action",
                        "quantity",
                        "price",
                        "fee",
                        "instrument_ref",
                        "category_name",
                        "source_name",
                        "transfer_account_name",
                    )
                },
                index,
            )
    elif format_name in ("ofx", "qfx"):
        # OFX 1.x SGML and 2.x XML scalar tags; no XML entity expansion.
        def tag(block, name):
            match = re.search(r"<" + name + r">\s*([^<\r\n]+)", block, re.I)
            return match.group(1).strip() if match else ""

        for index, block in enumerate(re.findall(r"<STMTTRN>(.*?)</STMTTRN>", content, re.I | re.S), 1):
            add(
                {
                    "date": tag(block, "DTPOSTED")[:8],
                    "amount": tag(block, "TRNAMT"),
                    "payee": tag(block, "NAME"),
                    "description": tag(block, "MEMO"),
                    "external_id": tag(block, "FITID"),
                },
                index,
                "%Y%m%d",
            )
        supported = {
            "BUYSTOCK": "buy",
            "BUYMF": "buy",
            "BUYDEBT": "buy",
            "SEL LSTOCK": "sell",
            "SELLSTOCK": "sell",
            "SELLMF": "sell",
            "SELLDEBT": "sell",
            "REINVEST": "reinvest",
            "INCOME": "dividend",
            "SPLIT": "split",
        }
        pattern = r"<(BUYSTOCK|BUYMF|BUYDEBT|SELLSTOCK|SELLMF|SELLDEBT|REINVEST|INCOME|SPLIT|TRANSFER|BUYOTHER|SELLOTHER)>(.*?)</\1>"
        for index, (kind, block) in enumerate(re.findall(pattern, content, re.I | re.S), len(rows) + 1):
            kind = kind.upper()
            if kind not in supported:
                errors.append({"line": index, "message": "Unsupported investment operation: " + kind})
                continue
            action = supported[kind]
            if kind == "INCOME":
                action = "interest" if tag(block, "INCOMETYPE") == "INTEREST" else "dividend"
            try:
                quantity = tag(block, "UNITS") or "0"
                if action == "split":
                    denominator = number(tag(block, "DENOMINATOR") or "1")
                    if denominator <= 0:
                        errors.append({"line": index, "message": "Invalid split ratio."})
                        continue
                    quantity = str(number(tag(block, "NUMERATOR") or "1") / denominator)
                add(
                    {
                        "entry_type": "trade",
                        "action": action,
                        "date": (tag(block, "DTTRADE") or tag(block, "DTPOSTED"))[:8],
                        "amount": tag(block, "TOTAL") or "0",
                        "quantity": quantity,
                        "price": tag(block, "TOTAL")
                        if action in ("dividend", "interest")
                        else tag(block, "UNITPRICE") or "0",
                        "fee": str(number(tag(block, "COMMISSION") or "0") + number(tag(block, "FEES") or "0")),
                        "instrument_ref": tag(block, "UNIQUEID"),
                        "description": tag(block, "MEMO") or kind,
                        "external_id": tag(block, "FITID"),
                    },
                    index,
                    "%Y%m%d",
                )
            except (ValidationError, ValueError, KeyError) as err:
                errors.append({"line": index, "message": str(err)})
    elif format_name == "qif":
        section = ""
        block = {}
        splits = []
        source_name = ""
        for index, line in enumerate(content.splitlines(), 1):
            if line == "!Account":
                section = "account"
            elif line.startswith("!Type:"):
                section = line[6:].lower()
            elif line == "^":
                if section == "account":
                    source_name = block.get("N", "")
                elif section in ("bank", "cash", "ccard", "oth a", "oth l"):
                    raw = {
                        "date": block.get("D", ""),
                        "amount": block.get("T", ""),
                        "payee": block.get("P", ""),
                        "description": block.get("M", ""),
                        "category_name": block.get("L", ""),
                        "split_names": splits,
                        "source_name": source_name,
                    }
                    if block.get("C") in ("*", "X"):
                        raw["status"] = "cleared"
                    if raw["category_name"].startswith("["):
                        raw["transfer_account_name"] = raw["category_name"].strip("[]")
                    add(raw, index)
                elif section == "invst":
                    actions = {
                        "Buy": "buy",
                        "Sell": "sell",
                        "Div": "dividend",
                        "IntInc": "interest",
                        "ReinvDiv": "reinvest",
                        "ReinvInt": "reinvest",
                        "ShrsIn": "opening",
                        "StkSplit": "split",
                    }
                    action = actions.get(block.get("N"))
                    if not action:
                        errors.append(
                            {"line": index, "message": "Unsupported investment operation: " + block.get("N", "")}
                        )
                    else:
                        add(
                            {
                                "entry_type": "trade",
                                "action": action,
                                "date": block.get("D", ""),
                                "amount": block.get("T", "0"),
                                "quantity": block.get("Q", "0"),
                                "price": block.get("T", "0")
                                if action in ("dividend", "interest")
                                else block.get("I", "0"),
                                "fee": block.get("O", "0"),
                                "instrument_ref": block.get("Y", ""),
                                "source_name": source_name,
                                "description": block.get("N", "") + ": " + block.get("Y", ""),
                            },
                            index,
                        )
                block, splits = {}, []
            elif line and not line.startswith("!"):
                key, value = line[0], line[1:]
                if key == "S":
                    splits.append({"category_name": value})
                elif key == "$" and splits:
                    splits[-1]["amount"] = value
                else:
                    block[key] = value
    else:
        raise ValidationError("Choose CSV, OFX, QFX or QIF.")
    if not rows and not errors:
        errors.append({"line": 0, "message": "No transactions found. Check the file format and column mapping."})
    if format_name in ("ofx", "qfx"):
        match = re.search(r"<ACCTID>\s*([^<\r\n]+)", content, re.I)
        if match:
            for row in rows:
                row["source_name"] = match.group(1).strip()
    return {"rows": rows, "errors": errors}


def preview(db, actor, p):
    acc = account(db, p["account_id"], actor, True)
    parsed = parse_file(p["file"], p["format"], p.get("options"))
    seen = set()
    occurrences = {}
    valid = []
    for row in parsed["rows"]:
        try:
            row["account_id"] = p.get("account_mapping", {}).get(row.get("source_name")) or p["account_id"]
            acc = account(db, row["account_id"], actor, True)
            if row["date"] < acc["opening_date"]:
                raise ValidationError("Transaction date precedes the opening balance.")
            if row.get("entry_type") != "trade" and number(row["amount"]) != number(
                money(row["amount"], acc["currency"])
            ):
                raise ValidationError("Too many decimal places for the account currency.")
            if row.get("split_names") and sum(number(part["amount"]) for part in row["split_names"]) != number(
                row["amount"]
            ):
                raise ValidationError("Split amounts must equal the transaction amount.")
            ext = row.get("external_id")
            fingerprint = hashlib.sha256(
                (
                    row["date"]
                    + "|"
                    + money(row["amount"], acc["currency"])
                    + "|"
                    + row.get("payee", "")
                    + "|"
                    + row.get("description", "")
                    + "|"
                    + row.get("instrument_ref", "")
                    + "|"
                    + row.get("quantity", "")
                ).encode()
            ).hexdigest()
            key = (acc["id"], fingerprint)
            occurrences[key] = occurrences.get(key, 0) + 1
            suffix = (":" + str(occurrences[key])) if not ext and occurrences[key] > 1 else ""
            row["import_id"] = "file:" + (ext or fingerprint) + suffix
            row["duplicate"] = (acc["id"], row["import_id"]) in seen or bool(
                db.execute(
                    "SELECT 1 FROM transactions WHERE account_id=? AND external_id=?", (acc["id"], row["import_id"])
                ).fetchone()
            )
            if row.get("entry_type") == "trade":
                row["duplicate"] = row["duplicate"] or bool(
                    db.execute(
                        "SELECT 1 FROM objects WHERE kind='trade' AND json_extract(body,'$.account_id')=? AND json_extract(body,'$.import_id')=?",
                        (acc["id"], row["import_id"]),
                    ).fetchone()
                )
            row["possible_matches"] = [
                r[0]
                for r in db.execute(
                    "SELECT id FROM transactions WHERE account_id=? AND date=? AND amount=?",
                    (acc["id"], row["date"], money(row["amount"], acc["currency"])),
                )
            ]
            seen.add((acc["id"], row["import_id"]))
            valid.append(row)
        except (ValidationError, ValueError, KeyError) as err:
            parsed["errors"].append({"line": row["line"], "message": str(err)})
    parsed["rows"] = valid
    parsed["source_accounts"] = sorted({r.get("source_name") for r in parsed["rows"] if r.get("source_name")})
    return parsed


def commit_import(db, actor, p):
    parsed = preview(db, actor, p)
    if parsed["errors"] and not p.get("accept_valid_rows"):
        raise ValidationError("Review import errors before importing valid rows.")
    if len(parsed["source_accounts"]) > 1 and any(
        name not in p.get("account_mapping", {}) for name in parsed["source_accounts"]
    ):
        raise ValidationError("Map each source account before importing a multi-account file.")
    selected = p.get("selected_lines")
    imported = 0
    for row in parsed["rows"]:
        if row["duplicate"] or (selected is not None and row["line"] not in selected):
            continue
        if row.get("entry_type") == "trade":
            from .finance import put
            from .investments import trade

            instrument_id = p.get("instrument_mapping", {}).get(row["instrument_ref"])
            if not instrument_id:
                raise ValidationError("Map each imported security to an instrument.")
            result = trade(
                db,
                actor,
                row
                | {
                    "instrument_id": instrument_id,
                    **(
                        {"exchange_rate": p["exchange_rates"][str(row["line"])]}
                        if p.get("exchange_rates", {}).get(str(row["line"]))
                        else {}
                    ),
                },
            )
            put(db, result | {"import_id": row["import_id"]})
            imported += 1
            continue
        if row.get("transfer_account_name"):
            from .finance import Finance

            destination_id = p.get("transfer_mapping", {}).get(row["transfer_account_name"])
            if not destination_id:
                raise ValidationError("Map the destination of each imported transfer.")
            amount = number(row["amount"])
            source_id, target_id = (
                (row["account_id"], destination_id) if amount < 0 else (destination_id, row["account_id"])
            )
            source, target = account(db, source_id, actor, True), account(db, target_id, actor, True)
            other = p.get("transfer_amounts", {}).get(str(row["line"]))
            if source["currency"] != target["currency"] and not other:
                raise ValidationError("Enter the other currency amount for the imported transfer.")
            sent, received = (
                (str(abs(amount)), other or str(abs(amount)))
                if amount < 0
                else (other or str(abs(amount)), str(abs(amount)))
            )
            # A transfer exported from both accounts has two rows but one linked operation.
            counterparts = [
                json.loads(r[0])
                for r in db.execute(
                    "SELECT t.body FROM transactions t JOIN transactions other ON other.transfer_id=t.transfer_id AND other.account_id=? WHERE t.account_id=? AND t.date=? AND t.amount=? AND other.amount=? AND t.external_id IS NULL",
                    (
                        destination_id,
                        row["account_id"],
                        row["date"],
                        money(amount, account(db, row["account_id"], actor)["currency"]),
                        money(
                            number(sent) * (-1 if amount > 0 else 1) if amount > 0 else number(received),
                            account(db, destination_id, actor)["currency"],
                        ),
                    ),
                )
            ]
            if len(counterparts) == 1:
                matched = counterparts[0] | {"external_id": row["import_id"]}
                db.execute(
                    "UPDATE transactions SET external_id=?,body=? WHERE id=?",
                    (row["import_id"], json.dumps(matched), matched["id"]),
                )
                continue
            if len(counterparts) > 1:
                raise ValidationError("Several matching transfers exist. Review them before importing.")
            linked = Finance("").apply(
                db,
                actor,
                "transfer",
                {
                    "account_id": source_id,
                    "destination_id": target_id,
                    "date": row["date"],
                    "amount": sent,
                    "received": received,
                },
            )
            record = db.execute(
                "SELECT body FROM transactions WHERE transfer_id=? AND account_id=?", (linked["id"], row["account_id"])
            ).fetchone()
            tx = json.loads(record[0]) | {"external_id": row["import_id"]}
            db.execute(
                "UPDATE transactions SET external_id=?,body=? WHERE id=?", (row["import_id"], json.dumps(tx), tx["id"])
            )
            imported += 1
            continue
        if row["possible_matches"] and row["line"] not in p.get("keep_separate", []):
            continue
        splits = None
        mapping = p.get("category_mapping", {})
        if row.get("split_names"):
            splits = [
                {"amount": s["amount"], "category_id": mapping.get(s["category_name"])} for s in row["split_names"]
            ]
        transaction(
            db,
            row
            | {
                "account_id": row["account_id"],
                "external_id": row["import_id"],
                "splits": splits,
                "category_id": mapping.get(row.get("category_name")),
            },
            actor,
            True,
        )
        imported += 1
    return {"imported": imported, "errors": parsed["errors"]}
