"""Durable storage with serialized writes and optimistic concurrency."""

import asyncio
from copy import deepcopy
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CURRENCIES, DOMAIN, SIGNAL_CHANGED, STORAGE_VERSION
from .model import ValidationError, summarize, validate_budget, validate_item, validate_settings


class BudgetStore:
    """Own shared household budgets. Publish changes only after a successful save."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.storage = Store(hass, STORAGE_VERSION, DOMAIN, private=True)
        self.lock = asyncio.Lock()
        self.data = {}
        self._cache_key = None
        self._cache_value = None

    async def async_load(self, defaults: dict) -> None:
        """Load local data; never replace an unreadable store with empty budgets."""
        loaded = await self.storage.async_load()
        self.data = (
            loaded if loaded is not None else {"revision": 0, "settings": validate_settings(defaults), "budgets": []}
        )

    def snapshot(self, offset: int = 0) -> dict:
        """Build a snapshot using Home Assistant's configured local date."""
        today = dt_util.now().date()
        key = (self.data["revision"], today, offset)
        if key == self._cache_key:
            return self._cache_value
        self._cache_key = key
        self._cache_value = {
            "revision": self.data["revision"],
            "settings": deepcopy(self.data["settings"]),
            "currencies": CURRENCIES,
            "today": today.isoformat(),
            "budgets": [summarize(budget, self.data["settings"], today, offset) for budget in self.data["budgets"]],
        }

        return self._cache_value

    async def async_mutate(self, action: str, payload: dict, revision: int) -> dict:
        """Apply one validated mutation, rejecting stale clients before any write."""
        async with self.lock:
            if revision != self.data["revision"]:
                raise ValidationError("Budgets changed in another session. Close this dialog and try again.")
            candidate = deepcopy(self.data)
            result = self._apply(candidate, action, payload)
            candidate["revision"] += 1
            await self.storage.async_save(candidate)
            self.data = candidate
        async_dispatcher_send(self.hass, SIGNAL_CHANGED)
        return result

    def _apply(self, data: dict, action: str, payload: dict) -> dict:
        if action == "settings":
            data["settings"] = validate_settings(payload)
            return data["settings"]
        if action == "budget_create":
            if len(data["budgets"]) >= 50:
                raise ValidationError("A maximum of 50 budgets is supported.")
            budget = validate_budget(payload) | {"id": uuid4().hex, "items": []}
            data["budgets"].append(budget)
            return {"id": budget["id"]}
        budget = next((item for item in data["budgets"] if item["id"] == payload.get("budget_id")), None)
        if budget is None:
            raise ValidationError("Budget no longer exists.")
        if action == "budget_delete":
            data["budgets"].remove(budget)
            return {}
        if action == "budget_update":
            update = validate_budget(payload)
            if budget["items"] and update["currency"] != budget["currency"]:
                raise ValidationError("A budget with entries cannot change currency. Create a new budget instead.")
            budget.update(update)
            return {"id": budget["id"]}
        if action == "item_create":
            if len(budget["items"]) >= 500:
                raise ValidationError("A maximum of 500 entries per budget is supported.")
            item = validate_item(payload, budget["currency"]) | {"id": uuid4().hex}
            budget["items"].append(item)
            return {"id": item["id"]}
        item = next((item for item in budget["items"] if item["id"] == payload.get("item_id")), None)
        if item is None:
            raise ValidationError("Entry no longer exists.")
        if action == "item_delete":
            budget["items"].remove(item)
            return {}
        if action == "item_update":
            item.update(validate_item(payload, budget["currency"]))
            return {"id": item["id"]}
        raise ValidationError("Unknown action.")
