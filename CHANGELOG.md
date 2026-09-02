# Changelog

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
