"""Current account values for optional native entities and their panel preview."""

from .finance import balance, bank_amount, convert, money, number
from .investments import portfolio


def account_positions(db, acc, today, linked):
    """Prefer bank positions as one complete set, never add them to ledger positions."""
    if acc["type"] != "investment":
        return [], False
    if linked and not acc.get("bank_positions_enabled"):
        return [], True
    holdings = portfolio(db, acc, today, include_bank=linked)
    return holdings["positions"], bool(holdings.get("bank_history_missing"))


def account_value(db, acc, today, linked):
    """Add cash and market values, converting each component before rounding once."""
    target = acc.get("sensor_currency") or acc["currency"]
    cash = bank_amount(acc) if linked else balance(db, acc, today)
    positions, missing_holdings = account_positions(db, acc, today, linked)
    missing = ["holdings"] if missing_holdings else []
    amounts = [(cash, acc["currency"], "cash")]
    amounts.extend(
        (pos["value"], pos["instrument"]["currency"], "market_value")
        for pos in positions
        if number(pos["quantity"]) != 0
    )
    total = number("0")
    for value, unit, source in amounts:
        if value is None:
            missing.append(source)
            continue
        if number(value) == 0:
            continue
        converted = convert(db, value, unit, target, today, acc["owner"])
        if converted is None:
            missing.append("rate:" + unit + ":" + target)
        else:
            total += converted
    return {
        "id": acc["id"],
        "name": acc["name"],
        "currency": target,
        "balance": None if missing else money(total, target),
        "account_currency": acc["currency"],
        "calculation": "cash_and_market_value" if acc["type"] == "investment" else "cash_balance",
        "balance_source": "bank" if linked else "ledger",
        "missing": sorted(set(missing)),
        "stale": bool(
            linked
            and (
                (cash is not None and acc.get("bank_balance_status") == "unavailable")
                or (
                    acc["type"] == "investment"
                    and acc.get("bank_positions_enabled")
                    and acc.get("bank_holdings_status") == "unavailable"
                )
            )
        ),
        "bank_checked": acc.get("bank_checked_at") or acc.get("bank_checked"),
    }
