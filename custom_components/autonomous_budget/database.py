"""Transactional local storage, including a non-destructive legacy migration."""

import json
import os
import sqlite3
from pathlib import Path

from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_VERSION

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS objects_kind ON objects(kind, owner);
CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, date TEXT NOT NULL,
 external_id TEXT, transfer_id TEXT, status TEXT NOT NULL, amount TEXT NOT NULL, body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_account_date ON transactions(account_id, date, id);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external ON transactions(account_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_transfer ON transactions(transfer_id);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actor TEXT NOT NULL, action TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS metadata (id TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT OR IGNORE INTO metadata VALUES ('revision', 0);
CREATE INDEX IF NOT EXISTS trades_account_date ON objects(json_extract(body,'$.account_id'),json_extract(body,'$.date')) WHERE kind='trade';
CREATE TRIGGER IF NOT EXISTS journal_before_update BEFORE UPDATE ON transactions
BEGIN INSERT INTO audit(actor,action,body) VALUES (audit_actor(),'transaction_before_update',OLD.body); END;
CREATE TRIGGER IF NOT EXISTS journal_before_delete BEFORE DELETE ON transactions
BEGIN INSERT INTO audit(actor,action,body) VALUES (audit_actor(),'transaction_before_delete',OLD.body); END;
CREATE TRIGGER IF NOT EXISTS object_before_update BEFORE UPDATE ON objects WHEN OLD.kind!='connection'
BEGIN INSERT INTO audit(actor,action,body) VALUES (audit_actor(),'object_before_update',OLD.body); END;
CREATE TRIGGER IF NOT EXISTS object_before_delete BEFORE DELETE ON objects WHEN OLD.kind!='connection'
BEGIN INSERT INTO audit(actor,action,body) VALUES (audit_actor(),'object_before_delete',OLD.body); END;

"""


class LedgerConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def connect(path):
    """Use short lived connections exclusively in an executor thread."""
    db = sqlite3.connect(path, timeout=30, factory=LedgerConnection)
    db.row_factory = sqlite3.Row
    db.create_function("audit_actor", 0, lambda: "system")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=DELETE")
    return db


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript(SCHEMA)
    os.chmod(path, 0o600)


class DatabaseStore:
    """HA Store-compatible document persistence sharing the ledger database."""

    def __init__(self, hass):
        self.hass = hass
        self.path = hass.config.path(".storage", "autonomous_budget.sqlite")
        self.legacy = Store(hass, STORAGE_VERSION, DOMAIN, private=True)

    def _load(self):
        initialize(self.path)
        with connect(self.path) as db:
            row = db.execute("SELECT body FROM documents WHERE id='budgets'").fetchone()
            return json.loads(row[0]) if row else None

    async def async_load(self):
        loaded = await self.hass.async_add_executor_job(self._load)
        if loaded is not None:
            return loaded
        legacy = await self.legacy.async_load()
        if legacy is not None:
            # Keep the original HA Store untouched, plus a stable migration backup.
            await self.hass.async_add_executor_job(self._backup, legacy)
            await self.async_save(legacy)
        return legacy

    def _backup(self, data):
        destination = Path(self.path).with_suffix(".pre-v1.json")
        try:
            with destination.open("x") as stream:
                json.dump(data, stream, ensure_ascii=False)
            os.chmod(destination, 0o600)
        except FileExistsError:
            pass

    def _save(self, data):
        with connect(self.path) as db:
            db.execute("INSERT OR REPLACE INTO documents VALUES ('budgets', ?)", (json.dumps(data),))

    async def async_save(self, data):
        await self.hass.async_add_executor_job(self._save, data)
