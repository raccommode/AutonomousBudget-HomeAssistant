# Version 1.0.0 validation

The release is published only after the GitHub CI jobs pass for its commit: Python/frontend checks, real Home Assistant browser tests, hassfest and HACS validation.

## Automated coverage

- 150 Python tests: existing budget calculations and identifiers; negative and income-day reserves; SQLite migration/rollback; private sharing and revocation; exact splits, transfers, refunds, reconciliation; dated exchange rates; average/FIFO positions and cost-preserving security transfers; loan projections/payments; imports and restoration; budget allocations; provider failures and synchronization conflicts.
- A 100,000-transaction fixture verifies indexed pagination and a small metadata snapshot instead of sending the journal to cards.
- 15 Playwright tests use a real disposable Home Assistant instance: the existing budget/card flows, desktop/mobile English/French interfaces, account entry/reconciliation, investment/cash updates, HTTP CSV import, private cards, a second authenticated user, revocation, and opt-in native sensor publication/removal.
- Python lint/format, syntax checks on all frontend modules, manifest validation and HACS custom-repository checks.

Tests use fictional financial data. Local validation ran on Home Assistant 2026.8.3; CI repeats it on Linux with Python 3.14 and Node.js 22.

## External provider verification

On September 4, 2026, direct keyless smoke requests succeeded for a dated Frankfurter USD/CAD rate, CoinGecko's Bitcoin/CAD quote, and Yahoo Finance's MSFT quote through the installed yfinance adapter. These checks establish that the adapters worked at that time; they do not guarantee provider availability or coverage.

Lunch Flow tests use representative Personal API payloads, including `isPending`, nullable external IDs, bank balances, optional holdings, repeated sync, edits, reconciliation conflicts, missing acquisition costs, timeouts and rate limits. No live Lunch Flow API key was available. Validation against an authorized bank connection remains a separate check and must not be described as completed.

## Backup and publication boundaries

Application exports omit connection keys. Home Assistant configuration backups include the server database and its audit history and may therefore contain keys. Restore validates into an empty financial workspace, preserves unrelated existing budgets and defaults restored records to private access.

Private cards enforce application permissions. Published native entities intentionally become visible through Home Assistant state access; removing publication cannot erase prior Recorder history or backups. The server administrator remains outside this application's privacy boundary.
