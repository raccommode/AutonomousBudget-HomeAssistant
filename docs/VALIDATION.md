# Version 1.4.0 validation

The release is published only after the GitHub CI jobs pass for its commit: Python/frontend checks, real Home Assistant browser tests, hassfest and HACS validation.

## Automated coverage

- 214 Python tests: existing budget calculations and identifiers; negative and income-day reserves; SQLite migration/rollback; household access and administrator creation guards; exact splits, transfers, refunds, reconciliation; dated exchange rates; average/FIFO positions and cost-preserving security transfers; loan projections/payments; imports and restoration; budget allocations; provider failures and synchronization conflicts.
- Personal overview checks cover explicit assignment rather than record creator, empty-user isolation, reassignment, current bank versus historical journal values, investment double-count prevention, optional budget assignment and backup/restoration. Provider checks cover preview-only warnings, partial status, retained snapshots and successful recovery.
- A 100,000-transaction fixture verifies indexed pagination and a small metadata snapshot instead of sending the journal to cards.
- 21 Playwright tests use a real disposable Home Assistant instance: the existing budget/card flows, desktop/mobile English/French interfaces, account entry/reconciliation, investment/cash updates, HTTP CSV import, household cards, a second authenticated user, member edits and rejected non-administrator creation, opt-in native sensor publication/removal, and English/French account-creation Lunch Flow selection, rename/link/edit-to-disconnect controls. Provider requests in the two connection UI tests are mocked; server tests separately verify provider contracts, atomic account/link creation, rollback, full-history imports, unlink races, immediate and pre-import bank balances, optional CELIAPP-style provider failures, partial sync, valuation and restoration.
- Two workspace journeys verify all seven page headings and responsive layouts, account search and type filtering, meaningful empty states, localized Save/Name labels, first-field focus, conditional investment controls, optional publication, journal search, report printing and localized forms. Two additional assignment journeys verify budget creation, editing, clearing, direct navigation and personal overview lists in English/desktop and French/mobile; the separate two-user journey verifies assigned-account totals and immediate removal when an assignment is cleared. Manual visual review compared the previous and current budgets, accounts, forms and financial settings in French/dark mode, with mobile checks at 390 × 844.
- Python lint/format, syntax checks on all frontend modules, manifest validation and HACS custom-repository checks.

Tests use fictional financial data. Local validation ran on Home Assistant 2026.8.3; CI repeats it on Linux with Python 3.14 and Node.js 22.

## External provider verification

On September 4, 2026, direct keyless smoke requests succeeded for a dated Frankfurter USD/CAD rate, CoinGecko's Bitcoin/CAD quote, and Yahoo Finance's MSFT quote through the installed yfinance adapter. These checks establish that the adapters worked at that time; they do not guarantee provider availability or coverage.

Lunch Flow tests use representative Personal API payloads, including `isPending`, nullable external IDs, bank balances, optional holdings, repeated sync, edits, reconciliation conflicts, missing acquisition costs, timeouts and rate limits. On September 7, the existing live integration was inspected through the user’s Safari session: one portfolio displayed bank holdings, while some linked accounts had unavailable balances or empty holdings. No bank records were changed. This inspection does not establish the upstream cause of missing data; the new failure reasons and recovery paths were validated with representative responses, not an end-to-end live resynchronization after upgrade.

## Backup and publication boundaries

Application exports omit connection keys. Home Assistant configuration backups include the server database and its audit history and may therefore contain keys. Restore validates into an empty financial workspace, preserves unrelated existing budgets and restores records with household access.

Financial cards are readable by all authenticated Home Assistant users; account assignment does not restrict access. Published native entities intentionally become visible through Home Assistant state access; removing publication cannot erase prior Recorder history or backups. The server administrator remains outside this application's privacy boundary.
