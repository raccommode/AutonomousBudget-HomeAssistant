"""Authenticated websocket API for the sidebar and dashboard card."""

import sqlite3

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SIGNAL_CHANGED
from .model import ValidationError

ACTIONS = ("settings", "budget_create", "budget_update", "budget_delete", "item_create", "item_update", "item_delete")


def get_store(hass, connection, msg):
    """Reject requests while the config entry is unloaded."""
    store = hass.data.get(DOMAIN, {}).get("store")
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "Autonomous Budget is not loaded.")
    return store


@websocket_api.websocket_command(
    {"type": f"{DOMAIN}/subscribe", vol.Optional("offset", default=0): vol.All(int, vol.Range(min=-120, max=120))}
)
@callback
def websocket_subscribe(hass, connection, msg):
    """Send the initial snapshot and updates; HA handles subscription cleanup."""
    if get_store(hass, connection, msg) is None:
        return

    @callback
    def changed():
        store = hass.data.get(DOMAIN, {}).get("store")
        connection.send_event(
            msg["id"], store.visible_snapshot(connection.user.id, msg["offset"]) if store else {"unavailable": True}
        )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_CHANGED, changed)
    connection.send_result(msg["id"])
    changed()


@websocket_api.websocket_command(
    {
        "type": f"{DOMAIN}/mutate",
        vol.Required("action"): vol.In(ACTIONS),
        vol.Required("payload"): dict,
        vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_mutate(hass, connection, msg):
    """Only administrators can modify household financial information."""
    if (store := get_store(hass, connection, msg)) is None:
        return
    try:
        budget_id = msg["payload"].get("budget_id")
        if (
            budget_id in store.finance_context["access"]
            and connection.user.id not in store.finance_context["access"][budget_id]["readers"]
        ):
            raise ValidationError("Access denied.")
        for allocation in msg["payload"].get("allocations", []):
            audience = store.finance_context["access"].get(allocation.get("budget_id"))
            if audience and connection.user.id not in audience["readers"]:
                raise ValidationError("Access denied.")
        result = await store.async_mutate(msg["action"], msg["payload"], msg["revision"])
    except ValidationError as err:
        connection.send_error(msg["id"], "invalid_input", str(err))
    except OSError, sqlite3.Error:
        connection.send_error(
            msg["id"], "save_failed", "Could not save budgets. Check available disk space and try again."
        )
    else:
        connection.send_result(msg["id"], result)


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register handlers once for the lifetime of Home Assistant."""
    websocket_api.async_register_command(hass, websocket_subscribe)
    websocket_api.async_register_command(hass, websocket_mutate)
