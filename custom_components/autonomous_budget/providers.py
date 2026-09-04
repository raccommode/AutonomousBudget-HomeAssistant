"""Optional personal data connectors. Credentials never leave the server."""

import asyncio
import hashlib
import json
import time
from datetime import date, timedelta

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .database import connect
from .finance import account, day, get, money, number, objects, put, require, transaction
from .model import ValidationError


async def request(hass, url, headers=None, params=None, optional=False):
    runtime = hass.data.setdefault(DOMAIN, {})
    cache = runtime.setdefault("provider_cache", {})
    cooldown = runtime.setdefault("provider_cooldown", {})
    origin = url.split("/")[2]
    now = time.monotonic()
    if cooldown.get(origin, 0) > now:
        raise ValidationError("The provider is rate limited. Try again later; the last values were preserved.")
    cache_key = url + json.dumps(params or {}, sort_keys=True)
    cached = cache.get(cache_key) if not headers else None
    if cached and cached[0] > now:
        return cached[1]
    session = async_get_clientsession(hass)
    async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=30)) as response:
        if optional and response.status in (404, 501):
            return {"unavailable": True}
        if response.status == 429:
            try:
                delay = min(3600, max(60, int(response.headers.get("Retry-After", "60"))))
            except ValueError:
                delay = 60
            cooldown[origin] = now + delay
            raise ValidationError("The provider is rate limited. Try again later; the last values were preserved.")
        if response.status in (401, 403):
            raise ValidationError("Connection authorization failed. Check your API key and account access.")
        if response.status != 200:
            raise ValidationError("The provider is temporarily unavailable.")
        data = await response.json()
        if not headers:
            cache[cache_key] = (now + 300, data)
            if len(cache) > 500:
                cache.pop(next(iter(cache)))
        return data


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
        summary = {"added": 0, "updated": 0, "conflicts": 0, "rows": []}
        for batch in batches:
            mapping = get(db, batch["mapping"]["id"], "mapping")
            if any(
                mapping.get(k) != batch["mapping"].get(k) for k in ("connection_id", "account_id", "remote_id", "from")
            ):
                raise ValidationError("Connection mapping changed. Preview again.")
            acc = account(db, batch["mapping"]["account_id"], actor, True)
            for incoming in batch["transactions"]:
                tx = normalize_transaction(incoming, acc["currency"]) | {"account_id": acc["id"]}
                if tx["date"] < batch["mapping"].get("from", acc["opening_date"]):
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
                closed = tx["date"] < acc["opening_date"] or any(
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
                        transaction(db, merged, actor, True)
                else:
                    summary["added"] += 1
                    if not preview_only:
                        transaction(db, tx, actor, True)
                if len(summary["rows"]) < 500:
                    summary["rows"].append(tx | {"possible_matches": matches, "conflict": bool(conflict)})
            if not preview_only:
                acc["bank_balance"] = batch["balance"]
                acc["bank_holdings"] = batch.get("holdings")
                acc["bank_checked"] = dt_util.now().date().isoformat()
                put(db, acc)
                mapping = get(db, batch["mapping"]["id"], "mapping")
                mapping["initialized"] = True
                put(db, mapping)
        if not preview_only:
            connection["last_sync"] = dt_util.now().date().isoformat()
            connection["status"] = "ok"
            put(db, connection)
            db.execute("UPDATE metadata SET value=value+1 WHERE id='revision'")
            db.execute(
                "INSERT INTO audit(actor,action,body) VALUES (?,?,?)",
                (actor, "lunchflow_sync", json.dumps({k: summary[k] for k in ("added", "updated", "conflicts")})),
            )
        return summary


async def provider_command(hass, actor, command, p):
    try:
        return await _provider_command(hass, actor, command, p)
    except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError:
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
    if command != "provider_disconnect" and (not connection.get("enabled", True) or not connection.get("api_key")):
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
    if command == "provider_map":
        remote = await request(hass, base + "/accounts", headers)
        remote_account = next((a for a in remote["accounts"] if str(a["id"]) == str(p["remote_id"])), None)
        if not remote_account:
            raise ValidationError("Remote account is unavailable.")

        remote_currency = remote_account.get("currency")
        if not isinstance(remote_currency, str) or not remote_currency.strip():
            remote_id = str(remote_account["id"])
            if not remote_id.isdigit():
                raise ValidationError("Invalid remote account identifier.")
            balance_response = await request(hass, f"{base}/accounts/{remote_id}/balance", headers)
            bank_balance = balance_response.get("balance") if isinstance(balance_response, dict) else None
            remote_currency = bank_balance.get("currency") if isinstance(bank_balance, dict) else None
        if not isinstance(remote_currency, str) or not remote_currency.strip():
            raise ValidationError(
                "Lunch Flow did not provide this account's currency. Refresh the account in Lunch Flow and try again."
            )
        remote_currency = remote_currency.strip().upper()

        def map_account():
            with connect(path) as db:
                acc = account(db, p["account_id"], actor, True)
                if acc["owner"] != actor or acc["currency"] != remote_currency:
                    raise ValidationError("Use your own account in the same currency.")
                if any(
                    m["account_id"] == acc["id"]
                    and (m["connection_id"] != connection["id"] or str(m["remote_id"]) != str(p["remote_id"]))
                    for m in objects(db, "mapping")
                ):
                    raise ValidationError("This local account is already connected.")
                return put(
                    db,
                    {
                        "id": f"mapping:{connection['id']}:{p['remote_id']}",
                        "kind": "mapping",
                        "owner": actor,
                        "connection_id": connection["id"],
                        "account_id": acc["id"],
                        "remote_id": str(p["remote_id"]),
                        "from": day(p.get("from") or acc["opening_date"]),
                        "initialized": False,
                    },
                )

        return await hass.async_add_executor_job(map_account)
    if command not in ("provider_preview", "provider_sync"):
        raise ValidationError("Unknown provider operation.")
    batches = []
    for mapping in mappings:
        if p.get("automatic") and not mapping.get("initialized"):
            continue
        remote_id = mapping["remote_id"]
        if not remote_id.isdigit():
            raise ValidationError("Invalid remote account identifier.")
        data = await request(
            hass,
            f"{base}/accounts/{remote_id}/transactions",
            headers,
            {"from": mapping["from"], "include_pending": "true"},
        )
        txs = data.get("transactions", [])
        if not isinstance(txs, list) or int(data.get("total", len(txs))) > len(txs):
            raise ValidationError("Unexpected transaction response.")
        bank_balance = await request(hass, f"{base}/accounts/{remote_id}/balance", headers)

        def local_account(account_id=mapping["account_id"]):
            with connect(path) as db:
                return account(db, account_id, actor)

        local = await hass.async_add_executor_job(local_account)
        holdings = (
            await request(hass, f"{base}/accounts/{remote_id}/holdings", headers, optional=True)
            if local["type"] == "investment"
            else None
        )
        batches.append({"mapping": mapping, "transactions": txs, "balance": bank_balance, "holdings": holdings})
    if (
        command == "provider_sync"
        and any(not m.get("initialized") for m in mappings)
        and not p.get("confirm_initial")
        and not p.get("automatic")
    ):
        raise ValidationError("Preview and confirm the first synchronization.")
    return await hass.async_add_executor_job(
        apply_sync, path, actor, connection["id"], batches, command == "provider_preview"
    )


def setup_refresh(hass, entry):
    running = asyncio.Lock()

    async def refresh(_now):
        if running.locked():
            return
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
                    and obj.get("last_sync") != today
                ):
                    jobs.append((obj, "provider_sync", {"connection_id": obj["id"], "automatic": True}))
                if obj["kind"] == "instrument" and obj.get("auto_quotes") and obj.get("quote_checked") != today:
                    jobs.append((obj, "provider_quote", {"instrument_id": obj["id"]}))
            for preferences in records:
                if preferences["kind"] == "preferences" and preferences.get("auto_rates"):
                    owner, target = preferences["owner"], preferences["currency"]
                    currencies = {
                        r["currency"]
                        for r in records
                        if r["kind"] in ("account", "instrument", "asset") and r["owner"] == owner
                    }
                    for base in currencies - {target}:
                        jobs.append((preferences, "provider_rates", {"base": base, "currency": target, "date": today}))
            for obj, command, payload in jobs:
                try:
                    await provider_command(hass, obj["owner"], command, payload)
                except ValidationError, aiohttp.ClientError, TimeoutError, KeyError, ValueError:

                    def failed(record=obj):
                        with connect(store.storage.path) as db:
                            fresh = get(db, record["id"])
                            fresh["status" if fresh["kind"] == "connection" else "quote_status"] = "unavailable"
                            put(db, fresh)

                    await hass.async_add_executor_job(failed)
            from .finance_api import refresh_context

            await refresh_context(hass)

    entry.async_on_unload(async_track_time_interval(hass, refresh, timedelta(hours=6)))
