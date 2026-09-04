"""Currency-aware reports with drill-down identifiers and explicit missing values."""

import json
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .finance import balance, budget_access, convert, currency, day, money, objects, visible
from .investments import portfolio


def report(db, actor, p):
    unit = currency(p.get("currency", "CAD"))
    today = date.fromisoformat(p.get("today", date.today().isoformat()))
    start = day(p.get("from", today.replace(day=1).isoformat()))
    end = day(p.get("to", today.isoformat()))
    if start > end:
        from .model import ValidationError

        raise ValidationError("The end date must follow the start date.")
    accounts = [
        a
        for a in objects(db, "account")
        if visible(db, a, actor) and (not p.get("account_ids") or a["id"] in p["account_ids"])
    ]
    groups = {
        key: defaultdict(lambda: {"income": Decimal(0), "expenses": Decimal(0), "transactions": set()})
        for key in ("category", "payee", "account", "month", "budget", "asset", "item")
    }
    income = expenses = net_worth = debt = realized = dividends = Decimal(0)
    missing = []
    account_values = []
    investments = []
    for acc in accounts:
        actual_balance = balance(db, acc, end)
        value = convert(db, actual_balance, acc["currency"], unit, end, actor)
        if value is None:
            missing.append({"type": "rate", "currency": acc["currency"], "date": end, "account_id": acc["id"]})
        else:
            net_worth += value
            debt += min(Decimal(0), value) if acc["type"] in ("credit", "loan") else 0
        account_values.append(
            {
                "id": acc["id"],
                "name": acc["name"],
                "balance": money(actual_balance, acc["currency"]),
                "currency": acc["currency"],
                "value": money(value, unit) if value is not None else None,
            }
        )
        rows = db.execute(
            "SELECT body FROM transactions WHERE account_id=? AND date>=? AND date<=? AND status!=?",
            (acc["id"], start, end, "pending"),
        )
        for row in rows:
            tx = json.loads(row[0])
            if tx.get("transfer_id") or tx.get("trade_id"):
                continue
            converted = convert(db, tx["amount"], tx["currency"], unit, tx["date"], actor)
            if converted is None:
                missing.append(
                    {"type": "rate", "currency": tx["currency"], "date": tx["date"], "transaction_id": tx["id"]}
                )
                continue
            is_refund = bool(tx.get("refund_id"))
            if converted >= 0 and not is_refund:
                income += converted
            else:
                expenses -= converted
            for split in tx["splits"]:
                amount = convert(db, split["amount"], tx["currency"], unit, tx["date"], actor)
                for dimension, key in (
                    ("category", split.get("category_id") or "uncategorized"),
                    ("payee", tx["payee"]),
                    ("account", acc["id"]),
                    ("month", tx["date"][:7]),
                    ("budget", split.get("budget_id") or "unassigned"),
                    ("asset", tx.get("asset_id") or "unassigned"),
                    ("item", split.get("item_id") or "unassigned"),
                ):
                    bucket = groups[dimension][key]
                    bucket["income" if amount >= 0 and not is_refund else "expenses"] += (
                        amount if amount >= 0 and not is_refund else -amount
                    )
                    bucket["transactions"].add(tx["id"])
        if acc["type"] == "investment":
            holdings = portfolio(db, acc, end)
            for pos in holdings["positions"]:
                instrument = pos["instrument"]
                value = (
                    convert(db, pos["value"], instrument["currency"], unit, end, actor)
                    if pos["value"] is not None
                    else None
                )
                if value is None and Decimal(pos["quantity"]):
                    missing.append({"type": "quote_or_rate", "instrument_id": instrument["id"], "date": end})
                elif value is not None:
                    net_worth += value
                investments.append(
                    {
                        "id": instrument["id"],
                        "name": instrument["name"],
                        "type": instrument.get("instrument_type", "stock"),
                        "account_id": acc["id"],
                        "value": money(value, unit) if value is not None else None,
                        "quantity": pos["quantity"],
                        "quote_date": pos["quote"]["date"] if pos["quote"] else None,
                    }
                )
            for flow in holdings["flows"]:
                if not start <= flow["date"] <= end:
                    continue
                gain = convert(db, flow["realized"], flow["currency"], unit, flow["date"], actor)
                dividend = convert(db, flow["income"], flow["currency"], unit, flow["date"], actor)
                if gain is None or dividend is None:
                    missing.append(
                        {"type": "rate", "currency": flow["currency"], "date": flow["date"], "trade_id": flow["id"]}
                    )
                else:
                    realized += gain
                    dividends += dividend
    assets = []
    for asset in objects(db, "asset"):
        if p.get("account_ids") or not visible(db, asset, actor):
            continue
        valuations = [v for v in objects(db, "valuation") if v["asset_id"] == asset["id"] and v["date"] <= end]
        latest = max(valuations, key=lambda v: v["date"], default=None)
        value = (
            convert(
                db,
                Decimal(latest["value"]) * Decimal(asset.get("ownership", "100")) / 100,
                asset["currency"],
                unit,
                end,
                actor,
            )
            if latest
            else None
        )
        if value is None:
            missing.append({"type": "valuation_or_rate", "asset_id": asset["id"], "date": end})
        else:
            net_worth += value
        assets.append(
            {
                "id": asset["id"],
                "name": asset["name"],
                "value": money(value, unit) if value is not None else None,
                "valuation": latest,
            }
        )
    budget_comparisons = []
    item_comparisons = []
    document = db.execute("SELECT body FROM documents WHERE id='budgets'").fetchone()
    if document:
        from .model import occurrences, period_bounds
        from .sharing import contribution_amounts

        source = json.loads(document[0])
        links = objects(db, "budget_link")
        access = budget_access(db, source["budgets"])
        for budget in source["budgets"]:
            linked = [link for link in links if link["budget_id"] == budget["id"]]
            if not linked or actor not in access.get(budget["id"], {actor}):
                continue
            planned_income = planned_expenses = Decimal(0)
            for item in budget["items"]:
                item_planned = Decimal(0)
                for due in occurrences(item, date.fromisoformat(start), date.fromisoformat(end) + timedelta(days=1)):
                    original = Decimal(item["amount"]) * Decimal(item["exchange_rate"])
                    value = convert(db, original, budget["currency"], unit, due.isoformat(), actor)
                    if value is None:
                        missing.append(
                            {
                                "type": "rate",
                                "budget_id": budget["id"],
                                "date": due.isoformat(),
                                "currency": budget["currency"],
                            }
                        )
                    elif item["direction"] == "income":
                        planned_income += value
                        item_planned += value
                    else:
                        planned_expenses += value
                        item_planned += value
                actual_item = groups["item"].get(item["id"], {})
                realized_item = actual_item.get("income" if item["direction"] == "income" else "expenses", Decimal(0))
                item_comparisons.append(
                    {
                        "id": item["id"],
                        "name": item["name"],
                        "budget_name": budget["name"],
                        "direction": item["direction"],
                        "planned": money(item_planned, unit),
                        "actual": money(realized_item, unit),
                        "difference": money(item_planned - realized_item, unit),
                    }
                )
            for common in source["budgets"]:
                allocation = next((a for a in common.get("allocations", []) if a["budget_id"] == budget["id"]), None)
                if not allocation:
                    continue
                settings = source["settings"]
                period = budget.get("period") or settings["period"]
                anchor = date.fromisoformat(budget.get("anchor") or settings["anchor"])
                pay_start, pay_end = period_bounds(date.fromisoformat(start), period, anchor)
                while pay_start <= date.fromisoformat(end):
                    if pay_start >= date.fromisoformat(start):
                        share = contribution_amounts(common, period, pay_start, pay_end)[budget["id"]]
                        share *= Decimal(allocation.get("exchange_rate", "1"))
                        value = convert(db, share, budget["currency"], unit, pay_start.isoformat(), actor)
                        if value is None:
                            missing.append(
                                {
                                    "type": "rate",
                                    "budget_id": budget["id"],
                                    "date": pay_start.isoformat(),
                                    "currency": budget["currency"],
                                }
                            )
                        else:
                            planned_expenses += value
                    pay_start, pay_end = period_bounds(pay_end, period, anchor)
            actual = groups["budget"].get(
                budget["id"], {"income": Decimal(0), "expenses": Decimal(0), "transactions": set()}
            )
            budget_comparisons.append(
                {
                    "id": budget["id"],
                    "name": budget["name"],
                    "planned_income": money(planned_income, unit),
                    "planned_expenses": money(planned_expenses, unit),
                    "actual_income": money(actual["income"], unit),
                    "actual_expenses": money(actual["expenses"], unit),
                    "expense_difference": money(planned_expenses - actual["expenses"], unit),
                    "transaction_count": len(actual["transactions"]),
                }
            )
    for dimension in groups.values():
        for bucket in dimension.values():
            bucket["transaction_count"] = len(bucket.pop("transactions"))
            bucket["income"] = money(bucket["income"], unit)
            bucket["expenses"] = money(bucket["expenses"], unit)
    return {
        "currency": unit,
        "from": start,
        "to": end,
        "income": money(income, unit),
        "expenses": money(expenses, unit),
        "cashflow": money(income - expenses, unit),
        "net_worth": money(net_worth, unit),
        "debt": money(-debt, unit),
        "realized_gains": money(realized, unit),
        "investment_income": money(dividends, unit),
        "complete": not missing,
        "missing": missing,
        "groups": {} if p.get("summary") else groups,
        "budget_comparisons": [] if p.get("summary") else budget_comparisons,
        "item_comparisons": [] if p.get("summary") else item_comparisons,
        "accounts": [] if p.get("summary") else account_values,
        "investments": [] if p.get("summary") else investments,
        "assets": [] if p.get("summary") else assets,
    }
