"""Authenticated file transport for backups larger than a websocket frame."""

import json
import sqlite3
from functools import partial

from homeassistant.components.http import KEY_HASS, HomeAssistantView

from .const import DOMAIN
from .finance import Finance
from .model import ValidationError


class FinanceFilesView(HomeAssistantView):
    url = "/api/autonomous_budget/finance_file"
    name = "api:autonomous_budget:finance_file"
    requires_auth = True

    async def post(self, request):
        from .finance_api import refresh_context

        hass = request.app[KEY_HASS]
        store = hass.data.get(DOMAIN, {}).get("store")
        if not store:
            return self.json({"message": "Autonomous Budget is not loaded."}, status_code=503)
        chunks, size = [], 0
        async for chunk in request.content.iter_chunked(65536):
            size += len(chunk)
            if size > 128_000_000:
                return self.json({"message": "This file exceeds the 128 MB upload limit."}, status_code=413)
            chunks.append(chunk)
        try:
            data = await hass.async_add_executor_job(json.loads, b"".join(chunks))
            actor = request["hass_user"]
            command, payload = data["command"], data["payload"]
            if command not in ("import_preview", "import", "restore"):
                raise ValidationError("Unsupported file operation.")
            if command == "restore" and payload.get("backup", {}).get("budgets") and not actor.is_admin:
                raise ValidationError("An administrator must restore budget definitions.")
            engine = Finance(store.storage.path)
            if command == "import_preview":
                from .database import connect
                from .imports import preview

                def inspect():
                    with connect(engine.path) as db:
                        return preview(db, actor.id, payload, True)

                result = await hass.async_add_executor_job(inspect)
            else:
                async with store.lock:
                    result = await hass.async_add_executor_job(
                        partial(engine.mutate, actor.id, command, payload, data.get("revision"))
                    )
                    if command == "restore":
                        store.data = await store.storage.async_load()
                    await refresh_context(hass)
            return self.json(result)
        except (ValidationError, ValueError, KeyError, TypeError) as err:
            return self.json({"message": str(err)}, status_code=400)
        except OSError, sqlite3.Error:
            return self.json({"message": "Could not save the file. Existing data was preserved."}, status_code=503)
