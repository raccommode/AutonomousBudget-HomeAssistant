"""Explicitly published account totals; private accounts never become entities."""

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import SIGNAL_CHANGED


def setup_finance_sensors(hass, entry, store, async_add_entities):
    known = set()

    @callback
    def sync():
        current = {a["id"] for a in store.finance_context.get("sensors", [])}
        async_add_entities([FinanceSensor(store, key) for key in current - known])
        registry = er.async_get(hass)
        for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
            if entity.unique_id.startswith("finance_") and entity.unique_id[8:] not in current:
                registry.async_remove(entity.entity_id)
        known.clear()
        known.update(current)

    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CHANGED, sync))
    sync()


class FinanceSensor(SensorEntity):
    _attr_should_poll = False
    _attr_device_class = SensorDeviceClass.MONETARY

    def __init__(self, store, account_id):
        self.store = store
        self.account_id = account_id
        self._attr_unique_id = "finance_" + account_id
        self._refresh()

    def _refresh(self):
        self.account = next(
            (a for a in self.store.finance_context.get("sensors", []) if a["id"] == self.account_id), None
        )
        if self.account:
            self._attr_name = self.account["name"]
            self._attr_native_value = self.account["balance"]
            self._attr_native_unit_of_measurement = self.account["currency"]
        self._attr_available = self.account is not None

    async def async_added_to_hass(self):
        @callback
        def refresh():
            self._refresh()
            self.async_write_ha_state()

        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_CHANGED, refresh))
