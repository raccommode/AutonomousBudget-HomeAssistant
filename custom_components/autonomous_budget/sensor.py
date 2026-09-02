"""Native monetary sensors for dashboards, history, and automations."""

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN, NAME, SIGNAL_CHANGED, VERSION

METRICS = {
    "income": ("Income", "mdi:arrow-down-left"),
    "expenses": ("Expenses", "mdi:arrow-up-right"),
    "balance": ("Remaining", "mdi:wallet-outline"),
    "investment": ("Investment income", "mdi:chart-line"),
    "mandatory": ("Mandatory income", "mdi:shield-check-outline"),
    "optional": ("Optional income", "mdi:sparkles"),
}


async def async_setup_entry(hass, entry, async_add_entities):
    """Discover newly created budgets and clean up deleted budget entities."""
    store = hass.data[DOMAIN]["store"]
    known = set()

    @callback
    def sync():
        current = {budget["id"] for budget in store.data["budgets"]}
        added = current - known
        if added:
            async_add_entities([BudgetSensor(store, budget_id, metric) for budget_id in added for metric in METRICS])
        registry = er.async_get(hass)
        for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
            if entity.unique_id.split("_", 1)[0] not in current:
                registry.async_remove(entity.entity_id)
        devices = dr.async_get(hass)
        for device in dr.async_entries_for_config_entry(devices, entry.entry_id):
            if not any(domain == DOMAIN and budget_id in current for domain, budget_id in device.identifiers):
                devices.async_remove_device(device.id)
        known.clear()
        known.update(current)
        # Device names follow budget renames while entity IDs remain stable.
        for budget in store.data["budgets"]:
            device = devices.async_get_device(identifiers={(DOMAIN, budget["id"])})
            if device and device.name != budget["name"]:
                devices.async_update_device(device.id, name=budget["name"])

    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CHANGED, sync))
    sync()


class BudgetSensor(SensorEntity):
    """A total for the current budget period, with stable IDs across renames."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_device_class = SensorDeviceClass.MONETARY
    # No state_class: these are period projections, not cumulative transactions.

    def __init__(self, store, budget_id, metric):
        self.store = store
        self.budget_id = budget_id
        self.metric = metric
        self._attr_unique_id = f"{budget_id}_{metric}"
        self._attr_translation_key = metric
        self._attr_icon = METRICS[metric][1]
        self._snapshot = None
        self._refresh()

    def _refresh(self):
        self._snapshot = next(
            (budget for budget in self.store.snapshot()["budgets"] if budget["id"] == self.budget_id), None
        )

    @property
    def available(self):
        return self._snapshot is not None

    @property
    def native_value(self):
        return self._snapshot["totals"][self.metric] if self._snapshot else None

    @property
    def native_unit_of_measurement(self):
        return self._snapshot["currency"] if self._snapshot else None

    @property
    def device_info(self):
        return DeviceInfo(
            identifiers={(DOMAIN, self.budget_id)},
            name=self._snapshot["name"] if self._snapshot else NAME,
            manufacturer=NAME,
            model="Household budget",
            sw_version=VERSION,
            entry_type=dr.DeviceEntryType.SERVICE,
        )

    @property
    def extra_state_attributes(self):
        if not self._snapshot:
            return {}
        return {
            "budget_id": self.budget_id,
            "period_start": self._snapshot["period_start"],
            "period_end": self._snapshot["period_end"],
            "period": self._snapshot["effective_period"],
            "reference_date": self._snapshot["effective_anchor"],
        }

    async def async_added_to_hass(self):
        @callback
        def changed():
            self._refresh()
            self.async_write_ha_state()

        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_CHANGED, changed))
