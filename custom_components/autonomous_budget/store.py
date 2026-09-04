"""Durable storage with serialized writes and optimistic concurrency."""

import asyncio
from copy import deepcopy
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import dt as dt_util

from .const import CURRENCIES, SIGNAL_CHANGED
from .database import DatabaseStore
from .model import ValidationError, validate_budget, validate_item, validate_settings
from .sharing import summarize_budgets, validate_links


class BudgetStore:
    """Own shared household budgets. Publish changes only after a successful save."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.storage = DatabaseStore(hass)
        self.lock = asyncio.Lock()
        self.data = {}
        self.finance_context = {"access": {}, "funding": {}}
        self._cache_key = None
        self._cache_value = None

    async def async_load(self, defaults: dict) -> None:
        """Load local data; never replace an unreadable store with empty budgets."""
        loaded = await self.storage.async_load()
        if loaded is not None:
            candidate = deepcopy(loaded)
            for budget in candidate["budgets"]:
                for item in budget["items"]:
                    if item["direction"] == "income":
                        item["category"] = None
            if candidate != loaded:
                candidate["revision"] += 1
                await self.storage.async_save(candidate)
                loaded = candidate
        self.data = (
            loaded if loaded is not None else {"revision": 0, "settings": validate_settings(defaults), "budgets": []}
        )

        if loaded is None:
            await self.storage.async_save(self.data)

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
            "budgets": summarize_budgets(
                [b | self.finance_context["funding"].get(b["id"], {}) for b in self.data["budgets"]],
                self.data["settings"],
                today,
                offset,
            ),
        }

        return self._cache_value

    def visible_snapshot(self, actor=None, offset=0):
        snapshot = self.snapshot(offset)
        access = self.finance_context["access"]
        return snapshot | {
            "budgets": [
                b
                for b in snapshot["budgets"]
                if b["id"] not in access
                or (access[b["id"]]["published"] if actor is None else actor in access[b["id"]]["readers"])
            ]
        }

    async def async_mutate(self, action: str, payload: dict, revision: int) -> dict:
        """Apply one validated mutation, rejecting stale clients before any write."""
        async with self.lock:
            if revision != self.data["revision"]:
                raise ValidationError("Budgets changed in another session. Close this dialog and try again.")
            candidate = deepcopy(self.data)
            result = self._apply(candidate, action, payload)
            validate_links(candidate["budgets"])
            candidate["revision"] += 1
            from .finance_api import budget_context

            context = await self.hass.async_add_executor_job(
                budget_context, self.storage.path, candidate["budgets"], dt_util.now().date().isoformat()
            )
            await self.storage.async_save(candidate)
            self.finance_context = context
            self._cache_key = None
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
            for source in data["budgets"]:
                if source.get("allocations"):
                    source["allocations"] = [row for row in source["allocations"] if row["budget_id"] != budget["id"]]
            return {}
        if action == "budget_update":
            update = validate_budget(budget | payload)
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
        if isinstance(payload.get("item_id"), str) and payload["item_id"].startswith("shared:"):
            raise ValidationError("Automatic contributions are managed in the shared budget.")
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
