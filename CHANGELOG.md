# Changelog

## 1.4.0 — 2026-09-07

- Personalize Overview to the signed-in Home Assistant user: include only explicitly assigned, active accounts and assigned budgets. Keep all household records accessible from Accounts, Budgets and Reports.
- Add optional Home Assistant user assignment when creating or editing a budget. Preserve assignments across edits, exports and restoration; existing budgets stay unassigned until selected.
- Use the latest received bank balance for connected accounts in Overview, and the journal balance for manual accounts. Keep historical Reports and budget funding based on the journal. Include investment holdings once, show missing/stale data as incomplete, and keep overview flows scoped to the current month.
- Explain unavailable bank balances and positions with safe provider failure reasons. Include optional-data failures in synchronization previews and mark applied synchronization as partial, preserving the last valid values.
- Show bank balance, ledger balance and connection actions in investment portfolios. Explain empty bank positions and transaction histories instead of presenting unexplained empty tables.
- Add English/French mobile and desktop assignment journeys, two-user overview checks, server-side filtering, backup round trips and provider recovery coverage.

## 1.3.0 — 2026-09-07

- Unify all seven modules around one navigation bar, page-header pattern, type scale, spacing system, buttons, dialogs, tables and financial status labels. Align dashboard cards with the same visual rules and Home Assistant themes.
- Give Overview its own compact financial summary with direct links to accounts and individual budgets; request a summary report instead of sending detailed report groups.
- Group accounts by type and add immediate name/institution search and type filtering. Add a visible journal search field while preserving advanced filters and pagination.
- Organize account forms into account details, optional bank connection, starting balance and advanced options. Show the cost method only for investment accounts; hide empty error messages and focus the first input.
- Group financial settings by purpose, show readable connection dates/statuses, and separate backup actions from display preferences.
- Make budget comparisons and investment report details expandable; include all sections when printing and restore their previous state afterward.
- Improve narrow-panel and mobile layouts, keep currency codes intact when amounts wrap, add bilingual labels and retain independently configurable card blocks.
- Add real Home Assistant regression checks for both languages, responsive navigation, account search/filtering, form accessibility, print sections and direct budget navigation. Budget calculations, ledger records and synchronization behavior are preserved.

## 1.2.1 — 2026-09-07

- Remove Unlink buttons from account cards and journals. Disconnect a Lunch Flow account in Edit account and save; cancelling keeps the link.
- Fetch the bank balance when linking an account, display it as the explicitly labeled bank balance on account pages and cards, and keep the ledger balance separate. Never rewrite opening balances or create balancing transactions.
- Refresh bank snapshots for accounts awaiting their first journal-import review. Provide Synchronize and Review transactions actions beside the account link; initial transaction imports still require confirmation.
- Keep investment account linking available when optional balances or holdings are unsupported, malformed or temporarily unavailable. Retain the last valid snapshot with a visible status; authentication errors still fail explicitly. If the provider supplies no currency, use the explicitly selected local currency and validate incoming amounts before displaying them.
- Isolate transaction-fetch failures to their account, report partial synchronization and keep refreshing bank snapshots and other accounts.
- Add regression coverage for Cash balances, CELIAPP-style provider failures, stale and zero balances, confirmation, authentication failures and English/French edit-to-disconnect flows.

## 1.2.0 — 2026-09-07

- Move Lunch Flow account selection into Accounts → Add account. Show optional connection and remote-account selectors only when a connection is enabled; create and link the account atomically. Support linking existing accounts through Edit account.
- Display saved links and Unlink controls on account cards and journals. Keep connection credentials, rename and synchronization in Finance settings.
- Share financial accounts, budgets, transactions, reports, exports and existing connections across authenticated Home Assistant users, including previously private records. Optional Home Assistant user assignment identifies the account holder without restricting access.
- Reserve creation of accounts, budgets, connections and other financial setup records, plus backup restoration, for Home Assistant administrators. Allow members to record transactions and edit existing data, with role checks on the server.
- Preserve existing budget calculations, native sensor opt-in and server-side connection secrets. Add account-link rollback coverage and real Home Assistant member-access and bilingual desktop/mobile checks.

## 1.1.0 — 2026-09-07

- Rename Lunch Flow connections without entering the key again, including disconnected connections.
- Show each remote/local account link below its connection, with an Unlink button that preserves imported history and rejects stale in-flight synchronization results.
- Request all available history for newly saved mappings and remove the start-date field. Keep transactions before the dated opening balance in the journal without counting them twice in balances or reconciliations.
- Automatically display supported broker holdings in Investments when linking an investment account, including stocks and cryptocurrencies. Use the latest dated bank positions for valuation without adding them on top of local positions or inventing trades, acquisition costs or historical prices.
- Preserve bank snapshots and historical journal rows through validated backup/restore; retain the last positions when the provider is unavailable.
- Hide closed finance dialogs explicitly to prevent an empty white bar. Add English/French connection controls and desktop/mobile browser coverage.

## 1.0.2 — 2026-09-05

- Restrict “Paid with income” reserve exclusions to expenses and positive income whose frequencies both match the budget’s effective pay period and whose payment dates coincide.
- Keep monthly, quarterly, annual and other differently scheduled bills in their normal fractional reserves even when they happen to fall on payday. One-time income no longer excludes recurring bills.
- Apply the rule consistently to projected reserves, available balances, cards and native sensors, preserving matching automatic common contributions and per-budget pay-period overrides.
- Add frequency/date regression coverage and a real Home Assistant check that changing a biweekly bill to monthly restores its installments and sensor reserve.

## 1.0.1 — 2026-09-04

- Fix Lunch Flow account linking when the account-list response omits its currency or returns null/blank. Resolve it from the account balance before checking the local account currency.
- Keep mismatched currencies blocked; show an actionable translated error if neither response provides a currency.
- Replace the undefined currency label in the account picker with a translated explanation.
- Add 11 regression cases covering missing currencies, fallback responses, normalization and mismatches.

## 1.0.0 — 2026-09-04

- Add optional accounts, investments, assets and reports beside the existing budget planner, with independent module visibility and English/French interfaces.
- Introduce an indexed SQLite ledger, atomic decimal transactions, optimistic concurrency and audit history; preserve legacy budgets and identifiers with a pre-migration backup.
- Add private accounts, named Read/Edit sharing, expense subcategories, exact splits, refunds, multicurrency transfers, recurring occurrences, classification rules, journal filters and statement reconciliation with explicit reopening.
- Add reviewable CSV/OFX/QFX/QIF imports, duplicate detection, journal/report CSV exports and validated JSON restoration without connection keys.
- Track portfolios with currency pockets, average/FIFO acquisition costs, coupled securities/cash operations, dividends, splits and cost-preserving transfers. Add optional Yahoo/CoinGecko quotes and Frankfurter rates.
- Add dated property valuations, ownership shares, bond coupons/maturity, loan projections with rate changes/prepayments, and actual principal/interest/fee payments.
- Add dated-currency reports, planned-versus-actual comparisons, private dashboard cards, explicit budget balance allocations and cross-currency common-budget planning rates.
- Add optional per-user Lunch Flow Personal API mappings, initial preview, daily/manual sync, pending operations, local-data preservation, conflicts, separate bank balances and validated opening holdings. Live bank validation still requires an authorized test connection.
- Keep negative budget reserves, income-day expense exclusion, existing card controls and entity IDs. Native account totals are opt-in; private account data restricts linked-budget audiences and sensor publication.


## 0.4.1 — 2026-09-03

- Exclude expenses due on a scheduled positive income date in the same budget from projected reserves, treating them as paid directly with that income.
- Apply the rule to automatic common contributions using their current pay-period payment date, independently of period navigation.
- Preserve original expense amounts, cash-flow and planning totals, categories, and common amounts. Show Paid with income instead of a zero expense value in the reserve list.
- Keep cards, native monetary sensors, and available balances synchronized. Respect paused, zero, future, ended, and one-time income, and actual month-end dates.
- Add English/French labels and regression coverage for date matching, unchanged amounts, live income changes, and persisted behavior.

## 0.4.0 — 2026-09-03

- Include each personal budget's full current common-budget contribution in projected reserves, using its own optional pay period and payday. Keep today's reserve unchanged when browsing other periods.
- Show projected reserves as negative deductions in the panel, dashboard card, and native Home Assistant sensors. Keep available-balance arithmetic correct and zero unsigned.
- Add a common-budget amount to the dashboard card without counting the contribution twice in expenses.
- Add 14 independent visual-editor and YAML controls for the card's title, period, icon, remaining amount, calculation label, income, expenses, common amount, categories, upcoming payments, reserves, available balance, explanation, and navigation link.
- Preserve existing reserve sensor IDs and prior card settings. Update English/French controls and add coverage for isolated blocks, saved configurations, reserve signs, and pay-period rollover.

## 0.3.0 — 2026-09-03

- Add personal and shared budget types with percentage allocations inspired by ALVES.
- Automatically add one locked mandatory contribution per common budget to each participant's personal budget, using their own optional pay period and payday.
- Keep contributions synchronized with common expenses, pauses, end dates, one-time expenses, manual exchange rates, allocation changes, and deletions.
- Calculate common reserves from participants' paydays without adding a duplicate reserve to personal budgets.
- Support partial allocations, deterministic currency rounding, several common budgets per person, and validation against duplicate links, cycles, incompatible currencies, or totals above 100%.
- Include common budgets and personal contributions in existing native sensors and dashboard cards. Export only source entries and allocation definitions.
- Add English/French allocation screens, mobile coverage, durable storage tests, and real Home Assistant sensor verification. Existing budgets remain personal with no allocation by default.

## 0.2.2 — 2026-09-03

- Simplify period navigation to the previous and next arrow buttons, removing the Today button.
- Group budget entries with income first, then expenses by Investment, Mandatory, and Optional, with group totals and a separate group for older expenses awaiting classification.
- Add direct access to each budget's existing native projected-reserve sensor, including its actual entity ID, dashboard YAML, and Home Assistant entity details.
- Verify reserve entities are enabled by default, monetary, and consistent with the panel. Update English/French UI, screenshots, and dashboard instructions.

## 0.2.1 — 2026-09-03

Correct which entries have categories.

- Income has no category; expenses require Investment, Mandatory, or Optional.
- Correct expense breakdowns, percentages, dashboard-card options, native sensor names, and English/French labels.
- Remove existing income categories automatically while preserving amounts, schedules, balances, and reserves.
- Flag older uncategorized expenses for the user to classify. Continue including their amounts in financial totals without guessing a category.
- Preserve sensor entity IDs; category sensor values now represent expenses.
- Add regression coverage for validation, direction changes, migration, persistence, and dashboard behavior.

## 0.2.0 — 2026-09-02

Pay-period planning inspired by the ALVES budget system.

- Add a regular plan that converts recurring income and expenses to each budget's effective pay period, with a separate Due dates view for scheduled cash flow.
- Add projected reserves per recurring expense, next renewal dates, installment progress, and completed / remaining pay periods.
- Add optional manual account and credit balances, including negative available amounts after projected reserves.
- Add five native sensors for normalized income, expenses, remaining money, projected reserves, and available balance. Preserve the original six sensors and their calculations.
- Add dashboard-card calculation and reserve options, including visual-editor controls.
- Extend English and French UI, preserve optional per-budget pay schedules and uncategorized expenses, and export optional balances without derived projections.
- Load existing 0.1.0 data without a storage reset. Update screenshots and document calculation examples and upgrade behavior.
- Validate ALVES reserve examples, currency rounding, calendar boundaries, old-store compatibility, and real Home Assistant browser flows.

## 0.1.0 — 2026-09-02

First public release.

- Home Assistant config flow and Autonomous Budget sidebar.
- Multiple named budgets, income and expenses, and Investment / Mandatory / Optional income categories. Expenses have no category.
- Daily, weekly, biweekly, monthly, and yearly budget periods with optional per-budget pay schedules and reference dates.
- Recurring and one-time entries, renewal dates, end dates, pausing, and manual currency conversion.
- Actual due-date projections, category breakdowns, and upcoming payments.
- Bundled dashboard card with visual editor and six monetary sensors per budget.
- Local persistence, administrator-only writes, conflict detection, and JSON export.
- Responsive English and French UI, installation buttons, HACS custom-repository support, and automated checks.
