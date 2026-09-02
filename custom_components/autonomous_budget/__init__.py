"""Autonomous Budget: local, calendar-aware household budgets."""

from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change

from .const import DOMAIN, NAME, PANEL_PATH, SIGNAL_CHANGED, STATIC_PATH, VERSION
from .store import BudgetStore
from .websocket import async_register

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = [Platform.SENSOR]
CARD_URL = f"{STATIC_PATH}/autonomous-budget-card.js?v={VERSION}"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register versioned local assets and API endpoints once."""
    hass.data.setdefault(DOMAIN, {})
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_PATH, str(Path(__file__).parent / "frontend"), False)]
    )
    async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load stored budgets and expose the sidebar, card, and sensors."""
    store = BudgetStore(hass)
    await store.async_load(dict(entry.data))
    hass.data[DOMAIN]["store"] = store
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="autonomous-budget-panel",
        sidebar_title=NAME,
        sidebar_icon="mdi:wallet-outline",
        module_url=f"{STATIC_PATH}/autonomous-budget-panel.js?v={VERSION}",
    )
    frontend.add_extra_js_url(hass, CARD_URL)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def refresh(_now=None):
        async_dispatcher_send(hass, SIGNAL_CHANGED)

    # Local midnight, including DST changes, advances sensors without a restart.
    entry.async_on_unload(async_track_time_change(hass, refresh, hour=0, minute=0, second=0))
    refresh()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload UI and entities, preserving all stored financial data."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    frontend.async_remove_panel(hass, PANEL_PATH)
    frontend.remove_extra_js_url(hass, CARD_URL)
    hass.data[DOMAIN].pop("store", None)
    async_dispatcher_send(hass, SIGNAL_CHANGED)
    return True
