"""Deterministic position replay and loan projections; never place broker orders."""

import hashlib
import json
from datetime import date
from decimal import Decimal

from .finance import account, currency, day, get, money, number, objects, put, read_record, transaction, uid
from .model import ValidationError


def bank_positions(snapshot, account_id, when):
    """Read broker positions without inventing journal trades or missing costs."""
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get("holdings"), list):
        raise ValidationError("Unexpected holdings response.")
    rows = []
    for index, holding in enumerate(snapshot["holdings"]):
        if not isinstance(holding, dict) or not isinstance(holding.get("security"), dict):
            raise ValidationError("Unexpected holdings response.")
        security = holding["security"]
        unit = currency(holding.get("currency") or security.get("currency") or snapshot.get("currency"))
        quantity = number(holding.get("quantity"), True)
        price = number(holding["price"], True) if holding.get("price") is not None else None
        value = (
            number(holding["value"])
            if holding.get("value") is not None
            else quantity * price
            if price is not None
            else None
        )
        cost = number(holding["costBasis"], True) if holding.get("costBasis") is not None else None
        symbol = str(security.get("tickerSymbol") or "")[:100]
        name = str(security.get("name") or symbol or "Unknown instrument")[:500]
        identity = str(security.get("isin") or security.get("figi") or symbol or name) + ":" + unit + ":" + str(index)
        instrument_type = str(security.get("type") or security.get("assetType") or "").lower()
        if instrument_type not in ("stock", "etf", "fund", "bond", "crypto"):
            instrument_type = (
                "crypto"
                if symbol.upper() in ("BTC", "XBT", "ETH", "SOL", "ADA", "DOGE", "XRP", "LTC")
                or "bitcoin" in name.lower()
                else "stock"
            )
        instrument = {
            "id": "bank:" + account_id + ":" + hashlib.sha256(identity.encode()).hexdigest()[:20],
            "name": name,
            "symbol": symbol,
            "isin": security.get("isin"),
            "currency": unit,
            "instrument_type": instrument_type,
        }
        rows.append(
            {
                "instrument": instrument,
                "quantity": str(quantity),
                "cost": str(cost) if cost is not None else None,
                "value": str(value) if value is not None else None,
                "unrealized": str(value - cost) if value is not None and cost is not None else None,
                "realized": None,
                "income": None,
                "quote": {"date": when, "source": "Lunch Flow", "value": str(price) if price is not None else None},
                "source": "Lunch Flow",
            }
        )
    return rows


def portfolio(db, acc, until=None, *, include_bank=False):
    until = until or date.today().isoformat()
    events = [
        json.loads(row[0])
        for row in db.execute(
            "SELECT body FROM objects WHERE kind='trade' AND json_extract(body,'$.account_id')=? AND json_extract(body,'$.date')<=? ORDER BY json_extract(body,'$.date'),json_extract(body,'$.sequence')",
            (acc["id"], until),
        )
    ]
    positions = {}
    flows = []
    transfers = {}
    for event in events:
        instrument = get(db, event["instrument_id"], "instrument")
        pos = positions.setdefault(
            instrument["id"],
            {
                "instrument": instrument,
                "quantity": Decimal(0),
                "cost": Decimal(0),
                "realized": Decimal(0),
                "income": Decimal(0),
                "lots": [],
            },
        )
        quantity, price, fee = (number(event.get(k, "0")) for k in ("quantity", "price", "fee"))
        action = event["action"]
        realized_before, income_before = pos["realized"], pos["income"]
        if action in ("buy", "opening", "reinvest", "transfer_in"):
            cost = number(event["cost"]) if "cost" in event else quantity * price + fee
            lots = event.get("lots") if action == "transfer_in" else None
            if lots:
                restored_lots = [[number(q, True), number(c, True), day(d)] for q, c, d in lots]
                if sum(q for q, c, d in restored_lots) != quantity or sum(c for q, c, d in restored_lots) != cost:
                    raise ValidationError("Invalid transferred acquisition lots.")
                pos["lots"].extend(restored_lots)
            else:
                pos["lots"].append([quantity, cost, event["date"]])
            if acc.get("cost_method") == "fifo":
                pos["lots"].sort(key=lambda lot: lot[2])
            pos["quantity"] += quantity
            pos["cost"] += cost
            if action == "reinvest":
                pos["income"] += quantity * price + fee
        elif action in ("sell", "transfer_out"):
            if quantity > pos["quantity"]:
                raise ValidationError("A sale or transfer exceeds the available position.")
            removed = Decimal(0)
            removed_lots = []
            remaining = quantity
            if acc.get("cost_method", "average") == "average":
                removed = pos["cost"] * quantity / pos["quantity"] if pos["quantity"] else Decimal(0)
                newq = pos["quantity"] - quantity
                pos["lots"] = [[newq, pos["cost"] - removed, event["date"]]] if newq else []
                removed_lots = [[str(quantity), str(removed), event["date"]]]
            else:
                while remaining:
                    lotq, lotcost, acquired = pos["lots"][0]
                    take = min(lotq, remaining)
                    used = lotcost * take / lotq
                    removed += used
                    remaining -= take
                    removed_lots.append([str(take), str(used), acquired])
                    if take == lotq:
                        pos["lots"].pop(0)
                    else:
                        pos["lots"][0] = [lotq - take, lotcost - used, acquired]
            pos["quantity"] -= quantity
            pos["cost"] -= removed
            if action == "transfer_out":
                transfers[event["id"]] = removed_lots
            if action == "sell":
                pos["realized"] += quantity * price - fee - removed
        elif action == "split":
            pos["quantity"] *= quantity
            pos["lots"] = [[q * quantity, c, d] for q, c, d in pos["lots"]]
        elif action in ("dividend", "interest", "coupon"):
            pos["income"] += price - fee
        if pos["realized"] != realized_before or pos["income"] != income_before:
            flows.append(
                {
                    "id": event["id"],
                    "date": event["date"],
                    "currency": instrument["currency"],
                    "realized": str(pos["realized"] - realized_before),
                    "income": str(pos["income"] - income_before),
                }
            )
    result = []
    for pos in positions.values():
        quotes = [
            q for q in objects(db, "quote") if q["instrument_id"] == pos["instrument"]["id"] and q["date"] <= until
        ]
        latest = max(quotes, key=lambda q: (q["date"], q.get("source") == "manual"), default=None)
        value = pos["quantity"] * number(latest["value"]) if latest else None
        result.append(
            {k: v for k, v in pos.items() if k != "lots"}
            | {
                "quantity": str(pos["quantity"]),
                "cost": str(pos["cost"]),
                "realized": str(pos["realized"]),
                "income": str(pos["income"]),
                "value": str(value) if value is not None else None,
                "unrealized": str(value - pos["cost"]) if value is not None else None,
                "quote": latest,
            }
        )
    response = {"positions": result, "flows": flows, "transfers": transfers}
    if include_bank and acc.get("bank_positions_enabled"):
        when = acc.get("bank_holdings_date") or acc.get("bank_checked")
        if when and when <= until and acc.get("bank_holdings", {}).get("holdings") is not None:
            response.update(
                positions=bank_positions(acc["bank_holdings"], acc["id"], when),
                ledger_positions=result,
                source="Lunch Flow",
                as_of=when,
            )
        else:
            response["bank_history_missing"] = True
    return response


def trade(db, actor, p, *, sequence=None, event_id=None):
    acc = account(db, p["account_id"], actor, True)
    if acc["type"] != "investment":
        raise ValidationError("Choose an investment account.")
    instrument = read_record(db, get(db, p["instrument_id"], "instrument"), actor)
    action = p["action"]
    if action not in ("buy", "sell", "opening", "dividend", "interest", "coupon", "reinvest", "split", "transfer"):
        raise ValidationError("Unsupported investment operation.")
    when = day(p["date"])
    if when < acc["opening_date"]:
        raise ValidationError("Transaction date precedes the opening balance.")
    quantity = number(p.get("quantity", "0"), True)
    price = number(p.get("price", "0"), True)
    fee = number(p.get("fee", "0"), True)
    if action in ("buy", "sell", "opening", "reinvest", "split", "transfer") and quantity <= 0:
        raise ValidationError("Quantity must be positive.")
    event = {
        "id": event_id or uid(),
        "kind": "trade",
        "owner": acc["owner"],
        "account_id": acc["id"],
        "instrument_id": instrument["id"],
        "date": when,
        "action": action,
        "quantity": str(quantity),
        "price": str(price),
        "fee": str(fee),
        "sequence": db.execute("SELECT value FROM metadata WHERE id='revision'").fetchone()[0] * 1000
        + len(objects(db, "trade")),
    }
    if sequence is not None:
        event["sequence"] = sequence
    if action == "transfer":
        destination = account(db, p["destination_id"], actor, True)
        if destination["type"] != "investment" or destination["id"] == acc["id"]:
            raise ValidationError("Choose another investment account.")
        before = next(
            (pos for pos in portfolio(db, acc, when)["positions"] if pos["instrument"]["id"] == instrument["id"]), None
        )
        if not before or number(before["quantity"]) < quantity:
            raise ValidationError("Transfer exceeds the available position.")
        event["action"] = "transfer_out"
        put(db, event)
        state = portfolio(db, acc, when)
        after = next(pos for pos in state["positions"] if pos["instrument"]["id"] == instrument["id"])
        cost = number(before["cost"]) - number(after["cost"])
        put(
            db,
            event
            | {
                "id": uid(),
                "action": "transfer_in",
                "account_id": destination["id"],
                "owner": destination["owner"],
                "cost": str(cost),
                "lots": state["transfers"][event["id"]],
            },
        )
        portfolio(db, acc, "9999-12-31")
        portfolio(db, destination, "9999-12-31")
        if fee:
            cash = account(db, p.get("cash_account_id") or acc["id"], actor, True)
            if cash["id"] != acc["id"] and cash.get("portfolio_id") != acc["id"]:
                raise ValidationError("Choose a cash pocket in this portfolio.")
            exchange = number(p.get("exchange_rate", "1"), True)
            if exchange <= 0 or (cash["currency"] != instrument["currency"] and "exchange_rate" not in p):
                raise ValidationError("Enter the historical exchange rate.")
            transaction(
                db,
                {
                    "account_id": cash["id"],
                    "date": when,
                    "amount": money(-fee * exchange, cash["currency"]),
                    "original_amount": str(-fee),
                    "original_currency": instrument["currency"],
                    "exchange_rate": str(exchange),
                    "description": "Security transfer fee",
                },
                actor,
                True,
            )
        return event
    put(db, event)
    # Replay all later events as well: backdating cannot invalidate a later sale.
    portfolio(db, acc, "9999-12-31")
    if action != "opening" and (action != "split" or fee):
        cash = account(db, p.get("cash_account_id") or acc["id"], actor, True)
        if cash["id"] != acc["id"] and cash.get("portfolio_id") != acc["id"]:
            raise ValidationError("Choose a cash pocket in this portfolio.")
        unit = instrument["currency"]
        exchange = number(p.get("exchange_rate", "1"), True)
        if exchange <= 0 or (unit != cash["currency"] and "exchange_rate" not in p):
            raise ValidationError("Enter the historical exchange rate.")
        amount = (
            -(quantity * price + fee)
            if action == "buy"
            else quantity * price - fee
            if action == "sell"
            else price - fee
        )
        if action == "reinvest":
            amount = Decimal(0)
        if action == "split":
            amount = -fee
        transaction(
            db,
            {
                "account_id": cash["id"],
                "date": when,
                "amount": money(amount * exchange, cash["currency"]),
                "original_amount": str(amount),
                "original_currency": unit,
                "exchange_rate": str(exchange),
                "description": action + ": " + instrument["name"],
                "trade_id": event["id"],
            },
            actor,
            True,
        )
    return event


def loan_schedule(loan):
    from .model import add_months

    start = date.fromisoformat(day(loan["date"]))
    principal = number(loan["principal"], True)
    payment = number(loan["payment"], True)
    interest = number(loan.get("interest_rate", "0"), True)
    count = int(loan.get("payments", 360))
    frequency = int(loan.get("frequency", 12))
    compounding = int(loan.get("compounding", 12))
    if (
        not 1 <= count <= 1200
        or frequency not in (12, 26, 52)
        or compounding not in (1, 2, 4, 12, 26, 52, 365)
        or payment <= 0
    ):
        raise ValidationError("Invalid loan schedule parameters.")
    changes = sorted(loan.get("rate_changes", []), key=lambda x: day(x["date"]))
    extras = loan.get("extra_payments", [])
    for row in changes:
        number(row["rate"], True)
    for row in extras:
        day(row["date"])
        number(row["amount"], True)
    from datetime import timedelta

    due_dates = [
        add_months(start, index) if frequency == 12 else start + timedelta(days=index * (14 if frequency == 26 else 7))
        for index in range(count)
    ]
    previous = add_months(start, -1) if frequency == 12 else start - timedelta(days=14 if frequency == 26 else 7)
    if any(date.fromisoformat(e["date"]) <= previous for e in extras):
        raise ValidationError("Extra payments must follow the beginning of the first loan period.")
    rows = []
    for due in due_dates:
        cycle_days = Decimal((due - previous).days)
        events = sorted(
            {
                due,
                *(date.fromisoformat(e["date"]) for e in extras if previous.isoformat() < e["date"] <= due.isoformat()),
                *(date.fromisoformat(c["date"]) for c in changes if previous.isoformat() < c["date"] < due.isoformat()),
            }
        )
        cursor = previous
        accrued = Decimal(0)
        for event in events:
            current_rate = interest
            for change in changes:
                if change["date"] <= cursor.isoformat():
                    current_rate = number(change["rate"], True)
            periodic = (1 + current_rate / 100 / compounding) ** (Decimal(compounding) / frequency) - 1
            accrued += principal * periodic * Decimal((event - cursor).days) / cycle_days
            extra = sum(number(e["amount"]) for e in extras if e["date"] == event.isoformat())
            if event == due:
                charge = number(money(accrued, loan["currency"]))
                paid = min(payment + extra, principal + charge)
                capital = paid - charge
                if capital <= 0 and principal > 0:
                    raise ValidationError("The payment does not cover interest.")
                principal = max(Decimal(0), principal - capital)
                rows.append(
                    {
                        "date": event.isoformat(),
                        "payment": money(paid, loan["currency"]),
                        "principal": money(capital, loan["currency"]),
                        "interest": money(charge, loan["currency"]),
                        "balance": money(principal, loan["currency"]),
                    }
                )
            elif extra:
                paid = min(extra, principal)
                principal -= paid
                rows.append(
                    {
                        "date": event.isoformat(),
                        "payment": money(paid, loan["currency"]),
                        "principal": money(paid, loan["currency"]),
                        "interest": money(0, loan["currency"]),
                        "balance": money(principal, loan["currency"]),
                    }
                )
            cursor = event
        previous = due
        if principal == 0:
            break
    return rows


def bond_schedule(instrument):
    """Coupon projections per bond; maturity repayment is separate from interest."""
    from .model import add_months

    if instrument.get("instrument_type") != "bond":
        raise ValidationError("Choose a bond.")
    start = date.fromisoformat(day(instrument["coupon_start"]))
    maturity = date.fromisoformat(day(instrument["maturity"]))
    frequency = int(instrument.get("coupon_frequency", 2))
    face = number(instrument.get("face_value", "100"), True)
    coupon = face * number(instrument.get("coupon_rate", "0"), True) / 100 / frequency
    rows = []
    for index in range(1200):
        due = add_months(start, index * (12 // frequency))
        if due > maturity:
            break
        rows.append({"date": due.isoformat(), "coupon": money(coupon, instrument["currency"]), "principal": "0"})
    rows.append({"date": maturity.isoformat(), "coupon": "0", "principal": money(face, instrument["currency"])})
    return rows
