"""Optional personal data connectors. Credentials never leave the server."""

import asyncio
import hashlib
import json
import re
import time
from datetime import date, timedelta

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .database import connect
from .finance import Finance, account, day, get, money, number, objects, put, require, transaction, uid
from .model import ValidationError


async def error_response(response, headers, reason):
    """Keep bounded provider diagnostics for the account UI, without credentials."""
    result = {"unavailable": True, "reason": reason, "http_status": response.status}
    try:
        try:
            raw = await response.content.readexactly(4097)
        except asyncio.IncompleteReadError as err:
            raw = err.partial
        if len(raw) > 4096:
            return result
        data = json.loads(raw)
    except ValueError, UnicodeError, aiohttp.ClientError, TimeoutError, AttributeError:
        return result
    if not isinstance(data, dict):
        return result
    parts = []
    for value in (data.get("message"), data.get("error_description"), data.get("error")):
        if isinstance(value, dict):
            value = value.get("message")
        if isinstance(value, str) and value.strip() and value not in parts:
            parts.append(value)
    detail = " ".join(parts)
    for key, secret in (headers or {}).items():
        if key.lower() in ("x-api-key", "authorization") and secret:
            detail = detail.replace(secret, "[redacted]")
            if key.lower() == "authorization":
                detail = detail.replace(secret.split()[-1], "[redacted]")
    detail = re.sub(r"https?://\S+", "[redacted URL]", detail)
    detail = re.sub(r"(?i)(?:bearer\s+|(?:api[_ -]?key|token|secret)\s*[:=]\s*)[^\s,;]+", "[redacted]", detail)
    detail = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[redacted email]", detail)
    detail = re.sub(r"[A-Za-z0-9_=-]{24,}", "[redacted]", detail)
    detail = " ".join(detail.split())[:512]
    if detail:
        result["detail"] = detail
    return result


async def request(hass, url, headers=None, params=None, optional=False):
    try:
        return await _request(hass, url, headers, params, optional)
    except ValidationError:
        raise
    except aiohttp.ClientError, TimeoutError:
        if optional:
            return {"unavailable": True, "reason": "network"}
        raise
    except ValueError:
        if optional:
            return {"unavailable": True, "reason": "invalid_response"}
        raise


async def _request(hass, url, headers=None, params=None, optional=False):
    runtime = hass.data.setdefault(DOMAIN, {})
    cache = runtime.setdefault("provider_cache", {})
    cooldown = runtime.setdefault("provider_cooldown", {})
    origin = url.split("/")[2]
    now = time.monotonic()
    if cooldown.get(origin, 0) > now:
        if optional:
            return {"unavailable": True, "reason": "rate_limited"}
        raise ValidationError("The provider is rate limited. Try again later; the last values were preserved.")
    cache_key = url + json.dumps(params or {}, sort_keys=True)
    cached = cache.get(cache_key) if not headers else None
    if cached and cached[0] > now:
        return cached[1]
    session = async_get_clientsession(hass)
    async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=30)) as response:
        if optional and response.status in (404, 501):
            return await error_response(response, headers, "not_found" if response.status == 404 else "unsupported")
        if response.status == 429:
            try:
                delay = min(3600, max(60, int(response.headers.get("Retry-After", "60"))))
            except ValueError:
                delay = 60
            cooldown[origin] = now + delay
            if optional:
                return await error_response(response, headers, "rate_limited")
            raise ValidationError("The provider is rate limited. Try again later; the last values were preserved.")
        if response.status in (401, 403):
            if optional:
                return await error_response(
                    response, headers, "unauthorized" if response.status == 401 else "forbidden"
                )
            raise ValidationError("Connection authorization failed. Check your API key and account access.")
        if response.status != 200:
            if optional:
                return await error_response(
                    response, headers, "bad_request" if response.status in (400, 422) else "provider_error"
                )
            raise ValidationError("The provider is temporarily unavailable.")
        data = await response.json()
        if not headers:
            cache[cache_key] = (now + 300, data)
            if len(cache) > 500:
                cache.pop(next(iter(cache)))
        return data


def store_bank_snapshot(acc, balance_response, holdings=None):
    """Refresh provider values without adjusting the journal or opening balance."""
    when = dt_util.now().date().isoformat()
    acc["bank_attempted_at"] = dt_util.utcnow().isoformat()
    acc["bank_balance_http_status"] = (
        balance_response.get("http_status") if isinstance(balance_response, dict) else None
    )
    acc["bank_balance_detail"] = balance_response.get("detail") if isinstance(balance_response, dict) else None
    bank = balance_response.get("balance") if isinstance(balance_response, dict) else None
    try:
        valid = isinstance(bank, dict) and bank.get("currency", "").strip().upper() == acc["currency"]
        amount = money(bank["amount"], acc["currency"]) if valid else None
    except ValidationError, KeyError, TypeError, AttributeError:
        amount = None
    acc["bank_balance_status"] = "ok" if amount is not None else "unavailable"
    reason = balance_response.get("reason") if isinstance(balance_response, dict) else None
    if (
        amount is None
        and not reason
        and isinstance(bank, dict)
        and isinstance(bank.get("currency"), str)
        and bank["currency"].strip().upper() != acc["currency"]
    ):
        reason = "currency_mismatch"
    acc["bank_balance_reason"] = None if amount is not None else reason or "invalid_response"
    if amount is not None:
        acc["bank_balance"] = {"balance": {"amount": amount, "currency": acc["currency"]}}
        acc["bank_checked"] = when
        acc["bank_checked_at"] = dt_util.utcnow().isoformat()
    if holdings is not None:
        acc["bank_holdings_detail"] = holdings.get("detail") if isinstance(holdings, dict) else None
        acc["bank_holdings_http_status"] = holdings.get("http_status") if isinstance(holdings, dict) else None
        from .investments import bank_positions

        try:
            if not isinstance(holdings, dict) or holdings.get("unavailable"):
                raise ValidationError("Holdings unavailable.")
            bank_positions(holdings, acc["id"], when)
        except ValidationError, KeyError, TypeError, ValueError:
            acc["bank_holdings_status"] = "unavailable"
            acc["bank_holdings_reason"] = (
                holdings.get("reason", "invalid_response") if isinstance(holdings, dict) else "invalid_response"
            )
        else:
            acc["bank_holdings_reason"] = None
            acc.update(
                bank_holdings=holdings, bank_holdings_date=when, bank_positions_enabled=True, bank_holdings_status="ok"
            )


def context(path, actor, connection_id):
    with connect(path) as db:
        connection = require(get(db, connection_id, "connection"), actor, True)
        return connection, [m for m in objects(db, "mapping") if m["connection_id"] == connection_id]


def save_quote(path, actor, instrument_id, value, when, source):
    with connect(path) as db:
        db.create_function("audit_actor", 0, lambda: actor)
        db.execute("BEGIN IMMEDIATE")
        instrument = require(get(db, instrument_id, "instrument"), actor, True)
        obj = {
            "id": f"quote:{instrument_id}:{when}:{source}",
            "kind": "quote",
            "owner": instrument["owner"],
            "sharing": instrument.get("sharing", {}),
            "instrument_id": instrument_id,
            "date": day(when),
            "currency": instrument["currency"],
            "value": str(number(value, True)),
            "source": source,
        }
        put(db, obj)
        instrument["quote_status"] = "ok"
        instrument["quote_checked"] = dt_util.now().date().isoformat()
        put(db, instrument)
        db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
        return obj


def yahoo(symbol):
    import yfinance as yf

    ticker = yf.Ticker(symbol)
    history = ticker.history(period="5d", auto_adjust=False, actions=False)
    if history.empty:
        raise ValidationError("No quote is available for this instrument.")
    metadata = ticker.history_metadata
    return str(history["Close"].iloc[-1]), history.index[-1].date().isoformat(), metadata.get("currency")


def yahoo_search(query):
    import yfinance as yf

    return [
        {
            "symbol": q.get("symbol"),
            "name": q.get("longname") or q.get("shortname"),
            "exchange": q.get("exchange"),
            "type": q.get("quoteType"),
        }
        for q in yf.Search(query, max_results=12).quotes
    ]


def normalize_transaction(row, currency):
    # Personal API uses signed amounts and stable IDs, with optional pending data.
    amount = row.get("amount")
    unit = row.get("currency", currency)
    if isinstance(amount, dict):
        unit = amount.get("currency", unit)
        amount = amount.get("value", amount.get("amount"))
    if unit != currency:
        raise ValidationError("Provider transaction currency differs from the mapped account.")
    external = row.get("id") or row.get("transaction_id")
    unstable = external is None
    if unstable:
        external = "synthetic:" + hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
    return {
        "external_id": "lunchflow:" + str(external),
        "unstable_id": unstable,
        "date": day(str(row.get("date") or row.get("transaction_date"))[:10]),
        "amount": money(amount, currency),
        "payee": row.get("merchant") or row.get("payee") or "",
        "description": row.get("description") or row.get("name") or "",
        "status": "pending"
        if row.get("isPending") or row.get("is_pending") or row.get("pending") or row.get("status") == "pending"
        else "cleared",
    }


def apply_sync(path, actor, connection_id, batches, preview_only=False):
    with connect(path) as db:
        db.create_function("audit_actor", 0, lambda: actor)
        db.execute("BEGIN IMMEDIATE")
        connection = require(get(db, connection_id, "connection"), actor, True)
        if not connection.get("enabled", True) or not connection.get("api_key"):
            raise ValidationError("This connection is disconnected.")
        summary = {"added": 0, "updated": 0, "conflicts": 0, "rows": [], "warnings": []}
        for batch in batches:
            mapping = get(db, batch["mapping"]["id"], "mapping")
            if any(
                mapping.get(k) != batch["mapping"].get(k)
                for k in ("connection_id", "account_id", "remote_id", "from", "version")
            ):
                raise ValidationError("Connection mapping changed. Preview again.")
            acc = account(db, batch["mapping"]["account_id"], actor, True)
            if batch.get("sync_error"):
                summary["warnings"].append(
                    {"account_id": acc["id"], "name": acc["name"], "message": batch["sync_error"]}
                )
            snapshot = dict(acc)
            store_bank_snapshot(snapshot, batch["balance"], batch.get("holdings"))
            for part, message in (
                ("balance", "Bank balance unavailable. The last received value is retained."),
                ("holdings", "Investment holdings unavailable. The account remains connected."),
            ):
                if (part == "balance" or batch.get("holdings") is not None) and snapshot.get(
                    f"bank_{part}_status"
                ) == "unavailable":
                    summary["warnings"].append(
                        {
                            "account_id": acc["id"],
                            "name": acc["name"],
                            "message": message,
                            "reason": snapshot.get(f"bank_{part}_reason"),
                            "detail": snapshot.get(f"bank_{part}_detail"),
                            "http_status": snapshot.get(f"bank_{part}_http_status"),
                        }
                    )
            for incoming in batch["transactions"]:
                tx = normalize_transaction(incoming, acc["currency"]) | {"account_id": acc["id"]}
                if mapping.get("from") and tx["date"] < mapping["from"]:
                    continue
                row = db.execute(
                    "SELECT body FROM transactions WHERE account_id=? AND external_id=?", (acc["id"], tx["external_id"])
                ).fetchone()
                old = json.loads(row[0]) if row else None
                matches = (
                    []
                    if old
                    else [
                        r[0]
                        for r in db.execute(
                            "SELECT id FROM transactions WHERE account_id=? AND amount=? AND date BETWEEN ? AND ?",
                            (
                                acc["id"],
                                tx["amount"],
                                (date.fromisoformat(tx["date"]) - timedelta(days=3)).isoformat(),
                                (date.fromisoformat(tx["date"]) + timedelta(days=3)).isoformat(),
                            ),
                        )
                    ]
                )
                differs = old and any(old[k] != tx[k] for k in ("amount", "date"))
                closed = (tx["date"] >= acc["opening_date"] or (old and old["date"] >= acc["opening_date"])) and any(
                    r["account_id"] == acc["id"]
                    and not r.get("reopened")
                    and min(tx["date"], old["date"] if old else tx["date"]) <= r["date"]
                    for r in objects(db, "reconciliation")
                )
                conflict = (
                    (not old and (tx.get("unstable_id") or closed))
                    or matches
                    or (old and closed and (differs or old["status"] != tx["status"]))
                    or (differs and old.get("original_currency", acc["currency"]) != acc["currency"])
                    or (differs and old["status"] == "reconciled")
                    or (differs and (old.get("transfer_id") or old.get("trade_id")))
                )
                if conflict:
                    summary["conflicts"] += 1
                    if not preview_only:
                        put(
                            db,
                            {
                                "id": f"conflict:{acc['id']}:{tx['external_id']}",
                                "kind": "conflict",
                                "owner": acc["owner"],
                                "sharing": acc.get("sharing", {}),
                                "account_id": acc["id"],
                                "incoming": tx,
                                "matches": matches or ([old["id"]] if old else []),
                                "connection_id": connection_id,
                            },
                        )
                elif old:
                    if old["status"] == "reconciled" or not differs and old["status"] == tx["status"]:
                        continue
                    summary["updated"] += 1
                    if not preview_only:
                        merged = old | {k: tx[k] for k in ("amount", "date", "status")}
                        if differs and len(old["splits"]) > 1:
                            put(
                                db,
                                {
                                    "id": f"conflict:{acc['id']}:{tx['external_id']}",
                                    "kind": "conflict",
                                    "owner": acc["owner"],
                                    "account_id": acc["id"],
                                    "incoming": tx,
                                    "matches": [old["id"]],
                                    "connection_id": connection_id,
                                },
                            )
                            summary["conflicts"] += 1
                            continue
                        if differs and old.get("original_currency", acc["currency"]) == acc["currency"]:
                            merged["original_amount"] = tx["amount"]
                        if differs:
                            merged["splits"] = [old["splits"][0] | {"amount": tx["amount"]}]
                        transaction(db, merged, actor, True, allow_history=True)
                else:
                    summary["added"] += 1
                    if not preview_only:
                        transaction(db, tx, actor, True, allow_history=True)
                if len(summary["rows"]) < 500:
                    summary["rows"].append(tx | {"possible_matches": matches, "conflict": bool(conflict)})
            if not preview_only:
                store_bank_snapshot(acc, batch["balance"], batch.get("holdings"))
                acc["bank_sync_error"] = batch.get("sync_error")
                put(db, acc)
                mapping = get(db, batch["mapping"]["id"], "mapping")
                if not batch.get("snapshot_only"):
                    mapping["initialized"] = True
                put(db, mapping)
        if not preview_only:
            connection["last_sync"] = dt_util.now().date().isoformat()
            connection["last_sync_at"] = dt_util.utcnow().isoformat()
            connection["status"] = "partial" if summary["warnings"] else "ok"
            put(db, connection)
            db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
            db.execute(
                "INSERT INTO audit(actor,action,body) VALUES (?,?,?)",
                (actor, "lunchflow_sync", json.dumps({k: summary[k] for k in ("added", "updated", "conflicts")})),
            )
        return summary


async def provider_command(hass, actor, command, p):
    try:
        if command in ("provider_sync", "provider_preview"):
            locks = hass.data.setdefault(DOMAIN, {}).setdefault("sync_locks", {})
            async with locks.setdefault(p.get("connection_id"), asyncio.Lock()):
                return await _provider_command(hass, actor, command, p)
        return await _provider_command(hass, actor, command, p)
    except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError, TypeError:
        if command in ("provider_quote", "provider_sync", "provider_preview") and p.get("source") != "manual":

            def mark_failure():
                path = hass.data[DOMAIN]["store"].storage.path
                with connect(path) as db:
                    try:
                        record = require(get(db, p.get("instrument_id") or p.get("connection_id")), actor, True)
                    except ValidationError:
                        return
                    record["quote_status" if command == "provider_quote" else "status"] = "unavailable"
                    put(db, record)

            await hass.async_add_executor_job(mark_failure)
        raise


async def _provider_command(hass, actor, command, p):
    path = hass.data[DOMAIN]["store"].storage.path
    if command == "provider_search":
        if not isinstance(p.get("query"), str) or len(p["query"]) > 100:
            raise ValidationError("Enter an instrument name or symbol.")
        if p.get("provider") == "coingecko":
            data = await request(hass, "https://api.coingecko.com/api/v3/search", params={"query": p["query"]})
            return [
                {"symbol": c["id"], "name": c["name"], "exchange": "CoinGecko", "type": "crypto"}
                for c in data["coins"][:12]
            ]
        return await hass.async_add_executor_job(yahoo_search, p["query"])
    if command == "provider_quote":

        def load():
            with connect(path) as db:
                return require(get(db, p["instrument_id"], "instrument"), actor, True)

        instrument = await hass.async_add_executor_job(load)
        source = p.get("source", instrument.get("provider", "yahoo"))
        if source == "manual":
            value, when = p["value"], p["date"]
        elif source == "coingecko":
            data = await request(
                hass,
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": instrument["symbol"], "vs_currencies": instrument["currency"].lower()},
            )
            value, when = data[instrument["symbol"]][instrument["currency"].lower()], dt_util.now().date().isoformat()
        else:
            value, when, unit = await hass.async_add_executor_job(yahoo, instrument["symbol"])
            if (unit, instrument["currency"]) in (("GBp", "GBP"), ("GBX", "GBP"), ("ZAc", "ZAR")):
                value, unit = str(number(value) / 100), instrument["currency"]
            if unit != instrument["currency"]:
                raise ValidationError("Quote currency differs from the instrument. Check its market and currency.")
        return await hass.async_add_executor_job(save_quote, path, actor, instrument["id"], value, when, source)
    if command == "provider_rate_history":
        from .finance import currency

        base, quote = currency(p["base"]), currency(p["currency"])
        start, end = day(p["from"]), day(p["to"])
        data = await request(
            hass,
            "https://api.frankfurter.dev/v2/rates",
            params={"base": base, "quotes": quote, "from": start, "to": end},
        )
        if not isinstance(data, list) or len(data) > 100000:
            raise ValidationError("Unexpected exchange rate response.")

        def save_history():
            with connect(path) as db:
                db.execute("BEGIN IMMEDIATE")
                for row in data:
                    value = number(row["rate"], True)
                    if value <= 0 or row["base"] != base or row["quote"] != quote:
                        raise ValidationError("Unexpected exchange rate response.")
                    when = day(row["date"])
                    put(
                        db,
                        {
                            "id": f"rate:{actor}:{base}:{quote}:{when}",
                            "kind": "rate",
                            "owner": actor,
                            "base": base,
                            "currency": quote,
                            "date": when,
                            "value": str(value),
                            "source": "Frankfurter",
                        },
                    )
                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                return {"rates": len(data)}

        return await hass.async_add_executor_job(save_history)
    if command == "provider_rates":
        from .finance import currency

        base, quote = currency(p["base"]), currency(p["currency"])
        when = day(p.get("date", dt_util.now().date().isoformat()))
        data = await request(hass, f"https://api.frankfurter.dev/v2/rate/{base}/{quote}", params={"date": when})
        if (
            data.get("base") != base
            or data.get("quote") != quote
            or number(data.get("rate"), True) <= 0
            or day(data["date"]) > when
        ):
            raise ValidationError("Unexpected exchange rate response.")

        def save():
            with connect(path) as db:
                obj = {
                    "id": f"rate:{actor}:{base}:{quote}:{data['date']}",
                    "kind": "rate",
                    "owner": actor,
                    "base": base,
                    "currency": quote,
                    "date": data["date"],
                    "value": str(number(data["rate"], True)),
                    "source": "Frankfurter",
                }
                put(db, obj)
                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                return obj

        return await hass.async_add_executor_job(save)
    connection, mappings = await hass.async_add_executor_job(context, path, actor, p["connection_id"])
    if command not in ("provider_disconnect", "provider_unmap") and (
        not connection.get("enabled", True) or not connection.get("api_key")
    ):
        raise ValidationError("This connection is disconnected.")
    headers = {"x-api-key": connection["api_key"]}
    base = "https://lunchflow.app/api/v1"
    if command == "provider_accounts":
        return await request(hass, base + "/accounts", headers)
    if command == "provider_disconnect":

        def disconnect():
            with connect(path) as db:
                obj = require(get(db, p["connection_id"], "connection"), actor, True)
                obj["enabled"], obj["api_key"] = False, ""
                put(db, obj)
                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                return {}

        return await hass.async_add_executor_job(disconnect)
    if command == "provider_unmap":

        def unmap():
            with connect(path) as db:
                db.create_function("audit_actor", 0, lambda: actor)
                db.execute("BEGIN IMMEDIATE")
                mapping = require(get(db, p["mapping_id"], "mapping"), actor, True)
                if mapping["connection_id"] != connection["id"]:
                    raise ValidationError("Access denied.")
                db.execute("DELETE FROM objects WHERE id=?", (mapping["id"],))
                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                db.execute(
                    "INSERT INTO audit(actor,action,body) VALUES (?,?,?)",
                    (actor, "lunchflow_unmap", json.dumps({"mapping_id": mapping["id"]})),
                )
                return {}

        return await hass.async_add_executor_job(unmap)
    if command == "provider_holdings_open":

        def initialize_holdings():
            from .investments import portfolio, trade

            with connect(path) as db:
                db.execute("BEGIN IMMEDIATE")
                acc = account(db, p["account_id"], actor, True)
                if not any(m["account_id"] == acc["id"] for m in mappings):
                    raise ValidationError("Choose an account mapped to this connection.")
                if portfolio(db, acc)["positions"]:
                    raise ValidationError("Compare existing positions instead of replacing them.")
                holdings = (acc.get("bank_holdings") or {}).get("holdings", [])
                if not holdings:
                    raise ValidationError("No provider holdings are available.")
                result = []
                for index, holding in enumerate(holdings):
                    security = holding["security"]
                    instrument_id = p.get("instrument_mapping", {}).get(str(index))
                    if not instrument_id:
                        raise ValidationError("Map every holding to an instrument.")
                    instrument = require(get(db, instrument_id, "instrument"), actor)
                    if instrument["currency"] != (holding.get("currency") or security["currency"]):
                        raise ValidationError("Holding currency differs from the selected instrument.")
                    quantity = number(holding["quantity"], True)
                    if quantity == 0:
                        continue
                    cost = holding.get("costBasis")
                    if cost is None:
                        cost = p.get("cost_basis", {}).get(str(index))
                    if cost is None:
                        raise ValidationError("Enter the missing acquisition cost.")
                    event = trade(
                        db,
                        actor,
                        {
                            "account_id": acc["id"],
                            "instrument_id": instrument_id,
                            "action": "opening",
                            "date": p["date"],
                            "quantity": str(quantity),
                            "price": str(number(cost, True) / quantity),
                        },
                    )
                    result.append(event["id"])
                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                db.execute(
                    "INSERT INTO audit(actor,action,body) VALUES (?,?,?)",
                    (actor, "holdings_initialization", json.dumps({"account_id": acc["id"], "date": p["date"]})),
                )
                return {"positions": len(result)}

        return await hass.async_add_executor_job(initialize_holdings)
    if command in ("provider_map", "provider_create_account"):
        creating = command == "provider_create_account"
        remote = await request(hass, base + "/accounts", headers)
        remote_account = next((a for a in remote["accounts"] if str(a["id"]) == str(p["remote_id"])), None)
        if not remote_account:
            raise ValidationError("Remote account is unavailable.")

        remote_id = str(remote_account["id"])
        if not remote_id.isdigit():
            raise ValidationError("Invalid remote account identifier.")
        balance_response = await request(hass, f"{base}/accounts/{remote_id}/balance", headers, optional=True)
        remote_currency = remote_account.get("currency")
        if not isinstance(remote_currency, str) or not remote_currency.strip():
            bank_balance = balance_response.get("balance") if isinstance(balance_response, dict) else None
            remote_currency = bank_balance.get("currency") if isinstance(bank_balance, dict) else None
        remote_currency = remote_currency.strip().upper() if isinstance(remote_currency, str) else None

        def local_target():
            with connect(path) as db:
                return account(db, p["account_id"], actor, True)

        if creating:
            from .finance import currency

            account_data = p.get("account")
            if not isinstance(account_data, dict) or account_data.get("id") or account_data.get("portfolio_id"):
                raise ValidationError("Enter a new local account to link.")
            account_data = account_data | {"kind": "account"}
            target = account_data | {
                "owner": actor,
                "type": account_data.get("type", "checking"),
                "currency": currency(account_data.get("currency") or remote_currency),
            }
            account_data["currency"] = target["currency"]
        else:
            target = await hass.async_add_executor_job(local_target)
        holdings = None
        if remote_currency and target["currency"] != remote_currency:
            raise ValidationError("Use an account in the same currency.")
        if target["type"] == "investment":
            remote_id = str(remote_account["id"])
            if not remote_id.isdigit():
                raise ValidationError("Invalid remote account identifier.")
            holdings = await request(hass, f"{base}/accounts/{remote_id}/holdings", headers, optional=True)

        def map_account():
            with connect(path) as db:
                db.create_function("audit_actor", 0, lambda: actor)
                db.execute("BEGIN IMMEDIATE")
                fresh_connection = require(get(db, connection["id"], "connection"), actor, True)
                if (
                    not fresh_connection.get("enabled", True)
                    or fresh_connection.get("api_key") != connection["api_key"]
                ):
                    raise ValidationError("This connection is disconnected.")
                acc = (
                    Finance(path).save(db, actor, account_data)
                    if creating
                    else account(db, p["account_id"], actor, True)
                )
                if remote_currency and acc["currency"] != remote_currency:
                    raise ValidationError("Use an account in the same currency.")
                if any(
                    m["account_id"] == acc["id"]
                    and (m["connection_id"] != connection["id"] or str(m["remote_id"]) != str(p["remote_id"]))
                    for m in objects(db, "mapping")
                ):
                    raise ValidationError("This local account is already connected.")
                previous = next(
                    (
                        m
                        for m in objects(db, "mapping")
                        if m["connection_id"] == connection["id"] and str(m["remote_id"]) == str(p["remote_id"])
                    ),
                    None,
                )
                if previous and previous["account_id"] != acc["id"]:
                    raise ValidationError("Unlink this remote account before choosing another local account.")
                store_bank_snapshot(acc, balance_response, holdings)
                put(db, acc)
                result = put(
                    db,
                    {
                        "id": f"mapping:{connection['id']}:{p['remote_id']}",
                        "kind": "mapping",
                        "owner": actor,
                        "connection_id": connection["id"],
                        "account_id": acc["id"],
                        "remote_id": str(p["remote_id"]),
                        "from": None,
                        "remote_name": str(remote_account.get("name") or p["remote_id"])[:500],
                        "version": previous.get("version") if previous else uid(),
                        "initialized": previous.get("initialized", False) if previous else False,
                    },
                )

                db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
                db.execute(
                    "INSERT INTO audit(actor,action,body) VALUES (?,?,?)",
                    (actor, "lunchflow_map", json.dumps({"mapping_id": result["id"], "account_id": acc["id"]})),
                )
                return result

        return await hass.async_add_executor_job(map_account)
    if command not in ("provider_preview", "provider_sync"):
        raise ValidationError("Unknown provider operation.")
    batches = []
    for mapping in mappings:
        if p.get("account_id") and mapping["account_id"] != p["account_id"]:
            continue
        remote_id = mapping["remote_id"]
        if not remote_id.isdigit():
            raise ValidationError("Invalid remote account identifier.")
        snapshot_only = bool(p.get("automatic") and not mapping.get("initialized"))
        txs, sync_error = [], None
        if not snapshot_only:
            try:
                data = await request(
                    hass,
                    f"{base}/accounts/{remote_id}/transactions",
                    headers,
                    {"include_pending": "true"} | ({"from": mapping["from"]} if mapping.get("from") else {}),
                )
                txs = data.get("transactions", [])
                if not isinstance(txs, list) or int(data.get("total", len(txs))) > len(txs):
                    raise ValidationError("Unexpected transaction response.")
            except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError, TypeError:
                snapshot_only = True
                sync_error = "Transactions could not be retrieved. Try synchronizing again."
                txs = []
        bank_balance = await request(hass, f"{base}/accounts/{remote_id}/balance", headers, optional=True)

        def local_account(account_id=mapping["account_id"]):
            with connect(path) as db:
                return account(db, account_id, actor)

        local = await hass.async_add_executor_job(local_account)
        holdings = (
            await request(hass, f"{base}/accounts/{remote_id}/holdings", headers, optional=True)
            if local["type"] == "investment"
            else None
        )
        batches.append(
            {
                "mapping": mapping,
                "transactions": txs,
                "balance": bank_balance,
                "holdings": holdings,
                "snapshot_only": snapshot_only,
                "sync_error": sync_error,
            }
        )
    if (
        command == "provider_sync"
        and any(
            not m.get("initialized") for m in mappings if not p.get("account_id") or m["account_id"] == p["account_id"]
        )
        and not p.get("confirm_initial")
        and not p.get("automatic")
    ):
        raise ValidationError("Preview and confirm the first synchronization.")
    return await hass.async_add_executor_job(
        apply_sync, path, actor, connection["id"], batches, command == "provider_preview"
    )


async def refresh_account_rates(hass, account_id=None):
    """Fetch only currency pairs needed by enabled account values; never send amounts."""
    from .account_value import account_positions

    store = hass.data.get(DOMAIN, {}).get("store")
    if not store:
        return
    today = dt_util.now().date().isoformat()

    def load_pairs():
        with connect(store.storage.path) as db:
            records = objects(db)
            linked = {r["account_id"] for r in records if r["kind"] == "mapping"}
            manual_pairs = {
                (r["base"], r["currency"])
                for r in records
                if r["kind"] == "rate" and r.get("source") == "manual" and r["date"] == today
            }
            pairs = set()
            for acc in records:
                if acc["kind"] != "account" or acc.get("archived"):
                    continue
                if account_id and acc["id"] != account_id:
                    continue
                if not (acc.get("sensor_currency") or acc.get("publish_sensors")):
                    continue
                target = acc.get("sensor_currency") or acc["currency"]
                positions, _ = account_positions(db, acc, today, acc["id"] in linked)
                units = {acc["currency"], *(p["instrument"]["currency"] for p in positions)}
                pairs.update(
                    (acc["owner"], unit, target)
                    for unit in units - {target}
                    if (unit, target) not in manual_pairs and (target, unit) not in manual_pairs
                )
            return sorted(pairs)

    checked = hass.data[DOMAIN].setdefault("account_rate_checks", {})
    for owner, base, target in await hass.async_add_executor_job(load_pairs):
        key = (owner, base, target)
        now = time.monotonic()
        if checked.get(key, 0) > now:
            continue
        try:
            await provider_command(hass, owner, "provider_rates", {"base": base, "currency": target})
        except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError, TypeError:
            checked[key] = now + 15 * 60
        else:
            checked[key] = now + 6 * 3600


def setup_refresh(hass, entry):
    running = asyncio.Lock()
    active_tasks = set()
    quote_attempts = {}

    async def refresh(_now=None):
        if running.locked():
            return
        task = asyncio.current_task()
        active_tasks.add(task)
        try:
            await run_refresh(_now)
        finally:
            active_tasks.discard(task)

    async def run_refresh(_now):
        async with running:
            store = hass.data.get(DOMAIN, {}).get("store")
            if not store:
                return

            def load():
                with connect(store.storage.path) as db:
                    return objects(db)

            records = await hass.async_add_executor_job(load)
            today = dt_util.now().date().isoformat()
            jobs = []
            for obj in records:
                if (
                    obj["kind"] == "connection"
                    and obj.get("enabled", True)
                    and obj.get("api_key")
                    and obj.get("auto_refresh", True)
                ):
                    last = dt_util.parse_datetime(obj.get("last_auto_attempt", ""))
                    due = (
                        not last
                        or (dt_util.utcnow() - dt_util.as_utc(last)).total_seconds()
                        >= obj.get("refresh_interval", 60) * 60
                    )
                    if _now is None or due:
                        jobs.append((obj, "provider_sync", {"connection_id": obj["id"], "automatic": True}))
                if (
                    obj["kind"] == "instrument"
                    and obj.get("auto_quotes")
                    and obj.get("quote_checked") != today
                    and quote_attempts.get(obj["id"], 0) <= time.monotonic()
                ):
                    quote_attempts[obj["id"]] = time.monotonic() + 3600
                    jobs.append((obj, "provider_quote", {"instrument_id": obj["id"]}))
            # Global reports keep their opt-in rate refresh; run this part at most every six hours.
            runtime = hass.data[DOMAIN]
            now = time.monotonic()
            if runtime.get("report_rates_after", 0) <= now:
                runtime["report_rates_after"] = now + 6 * 3600
                for preferences in records:
                    if preferences["kind"] == "preferences" and preferences.get("auto_rates"):
                        owner, target = preferences["owner"], preferences["currency"]
                        currencies = {
                            r["currency"]
                            for r in records
                            if r["kind"] in ("account", "instrument", "asset") and r["owner"] == owner
                        }
                        for base in currencies - {target}:
                            jobs.append((preferences, "provider_rates", {"base": base, "currency": target}))
            for obj, command, payload in jobs:
                if command == "provider_sync":

                    def mark_attempt(record=obj):
                        with connect(store.storage.path) as db:
                            fresh = get(db, record["id"])
                            fresh["last_auto_attempt"] = dt_util.utcnow().isoformat()
                            put(db, fresh)

                    await hass.async_add_executor_job(mark_attempt)
                try:
                    await provider_command(hass, obj["owner"], command, payload)
                except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError, TypeError:
                    # provider_command records failures; keep processing other connections.
                    continue
            await refresh_account_rates(hass)
            from .finance_api import refresh_context

            await refresh_context(hass)

    entry.async_on_unload(async_track_time_interval(hass, refresh, timedelta(minutes=1)))
    task = hass.async_create_background_task(refresh(), "autonomous_budget_provider_refresh")
    entry.async_on_unload(task.cancel)
    entry.async_on_unload(lambda: [task.cancel() for task in active_tasks])
