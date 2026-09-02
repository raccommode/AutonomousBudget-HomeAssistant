"""Onboard a disposable loopback-only HA instance and seed fictional budgets.

Run with .venv/bin/python scripts/setup_demo.py after starting the development HA.
Tokens stay in the ignored .dev-ha folder. Never run against a personal HA instance.
"""

import asyncio
import json
import secrets
import time
from datetime import date, timedelta
from pathlib import Path

import aiohttp

BASE = "http://127.0.0.1:8128"
CLIENT = BASE + "/"
TOKEN_FILE = Path(".dev-ha/tokens.json")


async def main():
    async with aiohttp.ClientSession() as session:
        for _ in range(120):
            try:
                async with session.get(BASE + "/api/onboarding") as response:
                    if response.status == 200:
                        break
            except aiohttp.ClientError:
                pass
            await asyncio.sleep(1)
        else:
            raise RuntimeError("Development Home Assistant did not start")
        if TOKEN_FILE.exists():
            stored = json.loads(TOKEN_FILE.read_text())
            async with session.post(
                BASE + "/auth/token",
                data={"grant_type": "refresh_token", "refresh_token": stored["refresh_token"], "client_id": CLIENT},
            ) as response:
                response.raise_for_status()
                tokens = stored | await response.json()
        else:
            async with session.post(
                BASE + "/api/onboarding/users",
                json={
                    "name": "Budget Demo",
                    "username": "budget-demo",
                    "password": secrets.token_urlsafe(32),
                    "client_id": CLIENT,
                    "language": "en",
                },
            ) as response:
                response.raise_for_status()
                code = (await response.json())["auth_code"]
            async with session.post(
                BASE + "/auth/token", data={"grant_type": "authorization_code", "code": code, "client_id": CLIENT}
            ) as response:
                response.raise_for_status()
                tokens = await response.json()
        tokens |= {
            "hassUrl": BASE,
            "clientId": CLIENT,
            "expires": int(time.time() * 1000) + tokens["expires_in"] * 1000,
        }
        TOKEN_FILE.write_text(json.dumps(tokens))
        TOKEN_FILE.chmod(0o600)
        headers = {"Authorization": "Bearer " + tokens["access_token"]}
        for step in ("core_config", "analytics", "integration"):
            async with session.post(
                BASE + "/api/onboarding/" + step,
                json={"client_id": CLIENT, "redirect_uri": CLIENT} if step == "integration" else {},
                headers=headers,
            ) as response:
                assert response.status in (200, 403), (step, response.status, await response.text())
        async with session.get(BASE + "/api/config/config_entries/entry", headers=headers) as response:
            entries = await response.json()
        integration = next((entry for entry in entries if entry["domain"] == "autonomous_budget"), None)
        today = date.today()
        anchor = today - timedelta(days=(today.weekday() - 4) % 7)
        if not integration:
            async with session.post(
                BASE + "/api/config/config_entries/flow",
                json={"handler": "autonomous_budget", "show_advanced_options": False},
                headers=headers,
            ) as response:
                flow = await response.json()
                assert flow["type"] == "form", flow
            async with session.post(
                BASE + "/api/config/config_entries/flow/" + flow["flow_id"],
                json={"currency": "CAD", "period": "biweekly", "anchor": anchor.isoformat()},
                headers=headers,
            ) as response:
                result = await response.json()
                assert result["type"] == "create_entry", result
        for _ in range(60):
            async with session.get(BASE + "/api/config/config_entries/entry", headers=headers) as response:
                integration = next(entry for entry in await response.json() if entry["domain"] == "autonomous_budget")
            if integration["state"] == "loaded":
                break
            await asyncio.sleep(1)
        assert integration["state"] == "loaded", integration
        async with session.ws_connect(BASE + "/api/websocket") as ws:
            await ws.receive_json()
            await ws.send_json({"type": "auth", "access_token": tokens["access_token"]})
            assert (await ws.receive_json())["type"] == "auth_ok"
            seq = 0
            snapshot = None

            async def call(message):
                nonlocal seq, snapshot
                seq += 1
                await ws.send_json({"id": seq} | message)
                while True:
                    result = await ws.receive_json()
                    if result["type"] == "event":
                        snapshot = result["event"]
                    if result["id"] == seq and result["type"] == "result":
                        assert result["success"], result
                        return result.get("result")

            http_config = await call({"type": "http/config"})
            if http_config["pending"]:
                await call({"type": "http/config/promote"})
            await call({"type": "autonomous_budget/subscribe"})
            snapshot = (await ws.receive_json())["event"]

            async def mutate(action, payload):
                nonlocal snapshot
                result = await call(
                    {
                        "type": "autonomous_budget/mutate",
                        "action": action,
                        "payload": payload,
                        "revision": snapshot["revision"],
                    }
                )
                # Dispatcher snapshots may arrive after the result.
                while snapshot["revision"] < revisions[0] + 1:
                    update = await ws.receive_json()
                    if update["type"] == "event":
                        snapshot = update["event"]
                revisions[0] = snapshot["revision"]
                return result

            revisions = [snapshot["revision"]]
            if not snapshot["budgets"]:
                budget_id = (await mutate("budget_create", {"name": "Everyday life", "currency": "CAD"}))["id"]
                for name, amount, category, direction, recurrence, days in [
                    ("Paycheck", "2450", "mandatory", "income", "biweekly", 0),
                    ("Rent", "975", "mandatory", "expense", "monthly", 4),
                    ("Groceries", "140", "mandatory", "expense", "weekly", 2),
                    ("Future fund", "250", "investment", "expense", "biweekly", 0),
                    ("Netflix", "16.99", "optional", "expense", "monthly", 6),
                    ("Internet", "64.99", "mandatory", "expense", "monthly", 8),
                    ("Coffee & little things", "40", "optional", "expense", "weekly", 1),
                ]:
                    await mutate(
                        "item_create",
                        {
                            "budget_id": budget_id,
                            "name": name,
                            "amount": amount,
                            "currency": "CAD",
                            "direction": direction,
                            "category": category,
                            "recurrence": recurrence,
                            "renewal_date": (anchor + timedelta(days=days)).isoformat(),
                        },
                    )
                await mutate("budget_create", {"name": "Future plans", "currency": "CAD"})
            panels = await call({"type": "get_panels"})
            assert "autonomous-budget" in panels
            states = await call({"type": "get_states"})
            sensors = [state for state in states if state["attributes"].get("budget_id")]
            assert len(sensors) == 6 * len(snapshot["budgets"]), len(sensors)
            assert all(state["state"] not in ("unknown", "unavailable") for state in sensors)
            # A duplicate setup is rejected by the real config flow.
            async with session.post(
                BASE + "/api/config/config_entries/flow",
                json={"handler": "autonomous_budget", "show_advanced_options": False},
                headers=headers,
            ) as response:
                duplicate = await response.json()
                assert duplicate.get("reason") in ("already_configured", "single_instance_allowed"), duplicate
            Path(".dev-ha/snapshot.json").write_text(json.dumps(snapshot, indent=2))
            Path(".dev-ha/entry-id").write_text(integration["entry_id"])
            print(
                f"Home Assistant {integration['state']}: sidebar registered; {len(snapshot['budgets'])} budgets; {len(sensors)} monetary sensors; duplicate setup rejected."
            )


if __name__ == "__main__":
    asyncio.run(main())
