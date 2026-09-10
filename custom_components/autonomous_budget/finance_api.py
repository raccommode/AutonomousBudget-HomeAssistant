"""Authenticated, paginated finance API and event delivery for the household."""

import sqlite3

import aiohttp
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.util import dt as dt_util

from .account_value import account_value
from .const import CURRENCIES, DOMAIN, SIGNAL_CHANGED
from .database import connect
from .finance import Finance, balance, convert, get, money, number, objects
from .model import ValidationError


def budget_context(path, budgets, today):
    """Small cached projections, never the transaction history."""
    with connect(path) as db:
        links = objects(db, "budget_link")
        access, funding = {}, {}
        for budget in budgets:
            selected = [o for o in links if o["budget_id"] == budget["id"]]
            if not selected:
                continue
            published = True
            cash, credit = number("0"), number("0")
            missing = False
            for link in selected:
                acc = get(db, link["account_id"], "account")
                published = published and bool(acc.get("publish_sensors"))
                value = convert(
                    db,
                    balance(db, acc, today) * number(link["percentage"]) / 100,
                    acc["currency"],
                    budget["currency"],
                    today,
                    acc["owner"],
                )
                if value is None:
                    missing = True
                elif acc["type"] == "credit":
                    credit += max(number("0"), -value)
                    cash += max(number("0"), value)
                else:
                    cash += value
            access[budget["id"]] = {"published": published}
            funding[budget["id"]] = {
                "account_balance": None if missing else money(cash, budget["currency"]),
                "credit_balance": money(credit, budget["currency"]),
                "linked_accounts": True,
                "conversion_missing": missing,
            }
        # Native projections require explicit publication throughout linked budgets.
        changed = True
        while changed:
            changed = False
            for source in budgets:
                for allocation in source.get("allocations", []):
                    ids = [source["id"], allocation["budget_id"]]
                    restricted = [access[k] for k in ids if k in access]
                    if not restricted:
                        continue
                    merged = {"published": all(a["published"] for a in restricted)}
                    for key in ids:
                        if access.get(key) != merged:
                            access[key] = merged.copy()
                            changed = True
        # Match account pages: connected accounts publish the last bank snapshot,
        # including zero or unknown; manual accounts publish their journal balance.
        bank_linked = {m["account_id"] for m in objects(db, "mapping")}
        sensors = [
            account_value(db, a, today, a["id"] in bank_linked)
            for a in objects(db, "account")
            if a.get("publish_sensors")
        ]
        return {"access": access, "funding": funding, "sensors": sensors}


async def refresh_context(hass):
    store = hass.data.get(DOMAIN, {}).get("store")
    if store:
        store.finance_context = await hass.async_add_executor_job(
            budget_context, store.storage.path, store.data["budgets"], dt_util.now().date().isoformat()
        )
        store._cache_key = None
        async_dispatcher_send(hass, SIGNAL_CHANGED)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/finance",
        vol.Required("command"): str,
        vol.Optional("payload", default={}): dict,
        vol.Optional("revision"): int,
    }
)
@websocket_api.async_response
async def websocket_finance(hass, connection, msg):
    store = hass.data.get(DOMAIN, {}).get("store")
    if not store:
        connection.send_error(msg["id"], "not_loaded", "Autonomous Budget is not loaded.")
        return
    actor = connection.user.id
    engine = Finance(store.storage.path)
    command = msg["command"]
    payload = msg["payload"]
    try:
        from .permissions import authorize_finance

        authorize_finance(command, payload, connection.user.is_admin)
        account_data = (
            payload.get("account", {})
            if command == "provider_create_account"
            else payload
            if command == "save" and payload.get("kind") == "account"
            else {}
        )
        if not isinstance(account_data, dict):
            raise ValidationError("Enter a new local account to link.")
        assigned = account_data.get("assigned_user_id")
        if assigned and not any(
            user.id == assigned and user.is_active and not user.system_generated
            for user in await hass.auth.async_get_users()
        ):
            raise ValidationError("Choose a valid Home Assistant user.")
        if command == "import_preview":
            from .imports import preview

            def parse():
                with connect(engine.path) as db:
                    return preview(db, actor, payload, True)

            result = await hass.async_add_executor_job(parse)
        elif command.startswith("provider_"):
            from .providers import provider_command

            result = await provider_command(hass, actor, command, payload)
            if command in ("provider_sync", "provider_map", "provider_create_account"):
                from .providers import refresh_account_rates

                await refresh_account_rates(hass)
            await refresh_context(hass)
        elif command == "users":
            result = [
                {"id": user.id, "name": user.name}
                for user in await hass.auth.async_get_users()
                if user.is_active and not user.system_generated
            ]
        elif command == "budgets":
            result = [
                {
                    "id": b["id"],
                    "name": b["name"],
                    "assigned_user_id": b.get("assigned_user_id"),
                    "items": [{"id": i["id"], "name": i["name"]} for i in b["items"] if not i.get("shared_source_id")],
                }
                for b in store.visible_snapshot(actor)["budgets"]
            ]
        elif command in (
            "account_summary",
            "calendar",
            "reconciliations",
            "snapshot",
            "transactions",
            "reports",
            "portfolio",
            "trades",
            "loan_schedule",
            "bond_schedule",
            "audit",
            "export",
            "csv",
        ):
            result = await hass.async_add_executor_job(
                engine.query, actor, command, payload | {"today": dt_util.now().date().isoformat()}
            )
            if command == "snapshot":
                result["currencies"] = sorted(CURRENCIES)
                result["default_view"] = getattr(store, "start_view", "budgets")
                users = {
                    u.id: u.name for u in await hass.auth.async_get_users() if u.is_active and not u.system_generated
                }
                for obj in result["objects"]:
                    if obj["kind"] == "account":
                        obj["assigned_user_name"] = users.get(obj.get("assigned_user_id"))
            if command == "export":
                permitted = {b["id"] for b in store.visible_snapshot(actor)["budgets"]}
                result["budgets"] = [b for b in store.data["budgets"] if b["id"] in permitted]
                result["budget_settings"] = store.data["settings"]
        else:
            async with store.lock:
                result = await hass.async_add_executor_job(engine.mutate, actor, command, payload, msg.get("revision"))
                if command == "restore":
                    store.data = await store.storage.async_load()
                if command == "save" and payload.get("kind") == "account":
                    from .providers import refresh_account_rates

                    await refresh_account_rates(hass, result["id"])
                await refresh_context(hass)
        connection.send_result(msg["id"], result)
    except (ValidationError, KeyError, ValueError, TypeError) as err:
        connection.send_error(msg["id"], "invalid_input", str(err))
    except TimeoutError, OSError, sqlite3.Error, aiohttp.ClientError:
        connection.send_error(
            msg["id"], "unavailable", "Could not complete this operation. Existing data was preserved."
        )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/finance_subscribe"})
@callback
def websocket_finance_subscribe(hass, connection, msg):
    @callback
    def changed():
        # Invalidation only; no household payload or actor IDs on the event bus.
        connection.send_event(msg["id"], {"refresh": True})

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_CHANGED, changed)
    connection.send_result(msg["id"])
    changed()


def register(hass):
    websocket_api.async_register_command(hass, websocket_finance)
    websocket_api.async_register_command(hass, websocket_finance_subscribe)
