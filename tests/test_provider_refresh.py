"""Scheduler cadence, isolation, rate refresh, cancellation and settings persistence."""

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from test_finance import account

from custom_components.autonomous_budget import finance_api, providers
from custom_components.autonomous_budget.database import initialize
from custom_components.autonomous_budget.finance import Finance
from custom_components.autonomous_budget.model import ValidationError


@pytest.fixture
def engine(tmp_path):
    engine = Finance(str(tmp_path / "finance.sqlite"))
    initialize(engine.path)
    return engine


def runtime(engine):
    async def executor(fn, *args):
        return await asyncio.to_thread(fn, *args)

    return SimpleNamespace(
        data={
            "autonomous_budget": {
                "store": SimpleNamespace(storage=SimpleNamespace(path=engine.path), data={"budgets": []})
            }
        },
        async_add_executor_job=executor,
    )


async def test_refresh_starts_immediately_repeats_same_day_and_obeys_settings(engine, monkeypatch):
    first = engine.mutate(
        "alice", "save", {"kind": "connection", "name": "First", "api_key": "fixture", "refresh_interval": 15}
    )
    second = engine.mutate(
        "alice", "save", {"kind": "connection", "name": "Second", "api_key": "fixture", "refresh_interval": 60}
    )
    engine.mutate("alice", "save", {"kind": "connection", "name": "Off", "api_key": "fixture", "auto_refresh": False})
    hass = runtime(engine)
    callbacks, tasks, unload = [], [], []
    now = [datetime(2026, 9, 10, 12, tzinfo=UTC)]
    monkeypatch.setattr(providers.dt_util, "utcnow", lambda: now[0])

    def timer(hass, callback, interval):
        assert interval == timedelta(minutes=1)
        callbacks.append(callback)
        return lambda: None

    def start(coro, name):
        task = asyncio.create_task(coro)
        tasks.append(task)
        return task

    hass.async_create_background_task = start
    monkeypatch.setattr(providers, "async_track_time_interval", timer)
    monkeypatch.setattr(finance_api, "refresh_context", AsyncMock())
    calls = []

    async def command(hass, actor, action, payload):
        calls.append(payload["connection_id"])
        assert payload["automatic"]
        if payload["connection_id"] == first["id"]:
            raise ValidationError("Temporary failure")

    monkeypatch.setattr(providers, "provider_command", command)
    providers.setup_refresh(hass, SimpleNamespace(async_on_unload=unload.append))
    await tasks[0]
    assert calls == [first["id"], second["id"]]
    await callbacks[0](now[0])
    assert len(calls) == 2
    now[0] += timedelta(minutes=15)
    await callbacks[0](now[0])
    assert calls == [first["id"], second["id"], first["id"]]
    engine.mutate("alice", "save", {"kind": "connection", "id": first["id"], "auto_refresh": False})
    now[0] += timedelta(minutes=45)
    await callbacks[0](now[0])
    assert calls[-1] == second["id"] and len(calls) == 4
    for cancel in unload:
        cancel()


async def test_startup_refresh_cancels_on_unload_and_overlapping_ticks_are_skipped(engine, monkeypatch):
    engine.mutate("alice", "save", {"kind": "connection", "name": "Bank", "api_key": "fixture"})
    hass = runtime(engine)
    callbacks, unload, tasks = [], [], []

    def timer(hass, callback, interval):
        callbacks.append(callback)
        return lambda: None

    def start(coro, name):
        tasks.append(asyncio.create_task(coro))
        return tasks[-1]

    hass.async_create_background_task = start
    monkeypatch.setattr(providers, "async_track_time_interval", timer)
    entered = asyncio.Event()

    async def pending(*args):
        entered.set()
        await asyncio.Future()

    mock = AsyncMock(side_effect=pending)
    monkeypatch.setattr(providers, "provider_command", mock)
    providers.setup_refresh(hass, SimpleNamespace(async_on_unload=unload.append))
    await entered.wait()
    await callbacks[0](datetime.now(UTC))
    assert mock.await_count == 1
    for cancel in unload:
        cancel()
    with pytest.raises(asyncio.CancelledError):
        await tasks[0]


async def test_conversion_fetches_rate_without_global_preference_and_throttles_retries(engine, monkeypatch):
    acc = account(engine, currency="EUR", opening_balance="100", sensor_currency="CAD", publish_sensors=True)
    account(engine, currency="EUR", sensor_currency="CAD", publish_sensors=True)
    hass = runtime(engine)
    now = [1000.0]
    monkeypatch.setattr(providers.time, "monotonic", lambda: now[0])
    request = AsyncMock(return_value={"base": "EUR", "quote": "CAD", "rate": 1.5, "date": "2026-01-01"})
    monkeypatch.setattr(providers, "request", request)
    await providers.refresh_account_rates(hass)
    await providers.refresh_account_rates(hass)
    assert request.await_count == 1
    assert finance_api.budget_context(engine.path, [], "2026-09-10")["sensors"][0]["balance"] == "150.00"
    now[0] += 6 * 3600
    request.side_effect = TimeoutError
    await providers.refresh_account_rates(hass)
    await providers.refresh_account_rates(hass)
    assert request.await_count == 2
    assert finance_api.budget_context(engine.path, [], "2026-09-10")["sensors"][0]["balance"] == "150.00"
    engine.mutate("alice", "save", {"kind": "account", "id": acc["id"], "sensor_currency": None})
    assert finance_api.budget_context(engine.path, [], "2026-09-10")["sensors"][0]["currency"] == "EUR"


@pytest.mark.parametrize("interval", [0, -1, True, "soon", 14, 1441])
def test_refresh_interval_validation(engine, interval):
    with pytest.raises(ValidationError, match="interval"):
        engine.mutate(
            "alice", "save", {"kind": "connection", "name": "Bank", "api_key": "fixture", "refresh_interval": interval}
        )


def test_conversion_settings_survive_restore_and_reject_invalid_currency(engine, tmp_path):
    acc = account(engine, sensor_currency="USD")
    with pytest.raises(ValidationError):
        engine.mutate("alice", "save", acc | {"sensor_currency": "NOPE"})
    restored = Finance(str(tmp_path / "restore.sqlite"))
    initialize(restored.path)
    restored.mutate("alice", "restore", {"backup": engine.query("alice", "export")})
    obj = next(o for o in restored.query("alice", "snapshot")["objects"] if o["kind"] == "account")
    assert obj["sensor_currency"] == "USD" and obj["currency"] == "CAD"
