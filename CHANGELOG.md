# Changelog

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
