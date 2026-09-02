<div align="center">

# Autonomous Budget

**Your money, on your schedule. Right inside Home Assistant.**

Create budgets, spread recurring commitments across paydays, and see what's left after planned reserves.

[![CI](https://github.com/raccommode/AutonomousBudget-HomeAssistant/actions/workflows/ci.yml/badge.svg)](https://github.com/raccommode/AutonomousBudget-HomeAssistant/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/raccommode/AutonomousBudget-HomeAssistant)](https://github.com/raccommode/AutonomousBudget-HomeAssistant/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5?logo=homeassistant&logoColor=white)](https://hacs.xyz/docs/faq/custom_repositories/)
[![License: MIT](https://img.shields.io/badge/License-MIT-21634d.svg)](LICENSE)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=raccommode&repository=AutonomousBudget-HomeAssistant&category=integration)
[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=autonomous_budget)

</div>

![Autonomous Budget running inside Home Assistant](docs/screenshot-desktop.png)

## A clear home for your finances

- **Multiple budgets.** Give each budget a name and currency: everyday life, a project, or a future plan.
- **Your own rhythm.** Daily, weekly, every two weeks, monthly, or yearly. Each budget can optionally set its own pay period and payday. Leave them empty to use the global defaults; two weeks is the initial default.
- **Income and expenses.** Every entry has a money-flow direction. Income has one of three categories: **Investment**, **Mandatory**, or **Optional**. Expenses have no category.
- **Recurring commitments.** Add Netflix, rent, a paycheck, or a savings contribution with its amount, currency, renewal date, and frequency. One-time entries, end dates, and pausing are supported too.
- **A plan for each payday.** Compare income and expenses on the same time scale, then switch to **Due dates** to see actual scheduled cash flow. Browse previous and upcoming periods.
- **Progressive reserves.** See the projected amount set aside for each recurring expense, its next renewal, and completed / remaining pay periods.
- **Optional available balance.** Enter an account balance and credit owed per budget to estimate what remains after projected reserves. Balances are manual and can be left empty.
- **Home Assistant dashboards.** A bundled visual card and eleven native monetary sensors per budget. No separate card download or manual resource registration.
- **Local storage.** Your budgets stay in Home Assistant. No account, cloud service, bank connection, telemetry, or runtime CDN dependency.
- **English and French.** The panel, forms, dashboard card, messages, and sensor names follow your Home Assistant language. Your own budget and entry names are never translated.
- **Export.** Download your budget definitions as a readable JSON file.

## Install with HACS

Requires **Home Assistant 2026.8.0 or newer** and a working [HACS installation](https://hacs.xyz/docs/use/).

1. Click **Open HACS repository** above, or add the repository manually in **HACS → ⋮ → Custom repositories**:
   - Repository: `https://github.com/raccommode/AutonomousBudget-HomeAssistant`
   - Type: **Integration**
2. Find **Autonomous Budget** in HACS and download it.
3. **Restart Home Assistant.**
4. Click **Add integration** above, or go to **Settings → Devices & services → Add integration → Autonomous Budget**.
5. Choose your default currency and budget period. The reference date is optional and defaults to today.
6. Open **Autonomous Budget** in the sidebar and create your first budget.

The buttons open the appropriate screen in your own Home Assistant; you still confirm installation there. The integration is available through a **HACS custom repository**. It is not yet included in HACS's default catalog. No YAML setup is required.

<details>
<summary>Manual installation</summary>

Copy the complete `custom_components/autonomous_budget` folder into your Home Assistant configuration directory:

```text
config/
└── custom_components/
    └── autonomous_budget/
        ├── __init__.py
        ├── manifest.json
        ├── frontend/
        └── …
```

Restart Home Assistant, then add the integration from **Settings → Devices & services**.

</details>

## Your first two-week budget

1. Create a budget named **Everyday life**, with your preferred currency.
2. Optionally select **Every two weeks** as this budget’s pay period and enter a payday as its reference date. You may leave either field empty to inherit its global default.
3. Add your paycheck: **Income**, your chosen category, amount, **Every two weeks**, and a payday as its first due date.
4. Add rent, Netflix, and savings contributions as expenses. Expenses do not ask for a category.
5. Set the amount and actual renewal date for each entry. **Per pay period** shows the regular budget; **Due dates** shows scheduled payments.
6. Review **Projected reserves** below your entries. Optionally enter an account balance and credit owed in **Edit budget** to see **Available after reserves**.

In **Due dates**, an August 28 payday starts a period running **August 28 through September 10**, inclusive. A Netflix renewal on September 3 is counted in that period; one on September 11 belongs to the next period.

The three category totals describe **income only**. Expenses have no category and contribute to total planned expenses. Savings contributions entered as expenses reduce the amount left to spend.

### How periods and recurring entries work

| Setting | Behavior |
| --- | --- |
| Daily | One calendar day in Home Assistant's timezone |
| Weekly | Seven days, aligned to the reference date |
| Every two weeks | Fourteen days, aligned to a payday or other reference date |
| Monthly | From the reference day to the same day next month |
| Yearly | From the reference month/day to the following year |

Use the first of the month or January 1 as the reference for calendar months or calendar years. Each budget can set its own period and reference date independently. Both fields are optional: an empty field uses the corresponding global default. Changing a default affects only budgets that inherit it. Each budget keeps its own currency.

Entry frequencies are **One time, Daily, Weekly, Every two weeks, Monthly, Quarterly, and Yearly**. Recurrence begins on the first due / renewal date and never creates earlier payments. An end date is inclusive. When a month has fewer days, the due date moves to that month's final day and returns to the original day when possible: January 31 → February 28/29 → March 31.

**Due dates** counts payments actually scheduled inside the selected period. Existing v0.1.0 sensors keep this calculation. Editing, pausing, or deleting entries changes past and future projections; these are not an immutable transaction history. Unspent money does not automatically roll over.

### A regular plan per payday

The default **Per pay period** view normalizes recurring income and expenses using the same convention as the ALVES budgeting system:

| Entry | Amount in a two-week plan |
| --- | --- |
| CAD 10 daily | CAD 140.00 |
| CAD 140 weekly | CAD 280.00 |
| CAD 2,000 every two weeks | CAD 2,000.00 |
| CAD 280 monthly | CAD 129.23 (`280 × 12 ÷ 26`) |
| CAD 130 quarterly | CAD 20.00 (`130 × 4 ÷ 26`) |
| CAD 520 yearly | CAD 20.00 (`520 ÷ 26`) |

The planning convention uses 364 daily periods, 52 weeks, 26 two-week periods, 12 months, 4 quarters, or 1 year. Calendar scheduling still uses real dates, including leap years and years with 27 paydays. For other pay periods, the same frequency ratios apply. Converted amounts are rounded per entry before totals are added.

Active recurring commitments enter the regular plan even before their first renewal, so you can prepare for future bills. They leave the plan once no occurrence remains on or after the selected period's start. **One-time entries** contribute their full amount only in the period when due. Paused entries contribute nothing. Income categories use the selected view's calculation; expenses remain uncategorized.

### Projected reserves and available money

Reserves follow ALVES's installment model, using each budget's effective pay period and reference date. They represent what should already be set aside, assuming earlier installments were saved and due bills were paid. They are **estimates, not tracked savings or bank transactions**.

For each recurring expense:

1. Find its next due date strictly after today. On the due date, the projection rolls forward to the following renewal; an ended expense has no remaining reserve.
2. Determine the planned installment count: the pay frequency divided by the expense frequency, rounded up to a whole number, with a minimum of one. Monthly bills with biweekly pay therefore have three planned installments; yearly bills have 26.
3. Count future paydays after today and **on or before** the next due date, capped at the planned count. Completed installments are the planned count minus those remaining.
4. Project the reserve as `expense amount × completed installments ÷ planned installments`, rounded in the budget currency. Rounding the final fraction prevents accumulated installment-rounding errors.

For example, a CAD 280 monthly bill due January 31, with biweekly pay anchored to January 31, has a CAD 93.33 reserve on February 1 toward February 28: one of three installments, with two future paydays left. Its regular two-week allocation is CAD 129.23. The regular allocation and the reserve installment differ because monthly cycles do not contain a fixed whole number of two-week pay periods. On rollover, the reserve can start partially funded when fewer future paydays remain than the planned count.

Daily, weekly, monthly, and yearly pay periods use the same method. The reference date may be in the past or future and is never forced to a particular weekday. One-time entries have no automatic reserve. Reserves cover the **next renewal of each recurring expense**, not every payment before the next payday. The reserve view always uses **today**, even when browsing another period.

Optionally enter **Account balance** and **Credit owed** in the budget currency:

`Available after reserves = account balance − credit owed − projected reserves`

Zero balances and negative available amounts are preserved; account overdrafts are allowed. Credit owed must be nonnegative. Leave the account balance empty to hide the estimate. Update these manual balances yourself after transactions; no bank synchronization or transfers are performed.

### Currencies

Choose a currency for each budget and each entry. When they differ, supply a manual exchange rate: **1 entry-currency unit = X budget-currency units**. For example, a USD 10 subscription with a rate of 1.35 contributes CAD 13.50 to a CAD budget. Rates are not fetched automatically.

Amounts use decimal arithmetic and the supported currency's minor units, including zero-decimal JPY and three-decimal KWD. Each converted payment is rounded before aggregation. You cannot change the currency of a budget containing entries; create another budget instead. See [`CURRENCIES`](custom_components/autonomous_budget/const.py) for the supported list.

## Add a dashboard card

The integration registers its card automatically, including on YAML dashboards. After initial installation, refresh the browser.

1. Edit a dashboard and choose **Add card**.
2. Search for **Autonomous Budget**.
3. Select a budget in the visual editor. Optionally customize the title and choose the calculation view, and show or hide income categories, upcoming payments, and projected reserves.

<img src="docs/screenshot-card.png" alt="Autonomous Budget dashboard card" width="390">

You can also open the grid button beside a budget's name to get its ready-to-paste YAML:

```yaml
type: custom:autonomous-budget-card
budget_id: YOUR_BUDGET_ID
view: plan # or cashflow
show_reserves: true
show_categories: true
show_upcoming: true
```

`budget_id` is optional and defaults to the first available budget. Use a specific ID to keep the card tied to that budget. Optional `title` overrides its heading. A deleted budget displays an explicit message instead of silently switching to another budget.

### Native sensors and automations

Each budget is a device with eleven monetary sensors:

| Sensor | Current-period value |
| --- | --- |
| Income | Scheduled incoming money |
| Expenses | All scheduled expenses |
| Remaining | Income minus expenses |
| Investment income | Incoming money categorized as Investment |
| Mandatory income | Incoming money categorized as Mandatory |
| Optional income | Incoming money categorized as Optional |
| Income per pay period | Normalized income in the regular plan |
| Expenses per pay period | Normalized expenses in the regular plan |
| Remaining per pay period | Normalized income minus normalized expenses |
| Projected reserve | Total projected reserve for recurring expenses as of today |
| Available after reserves | Manual account balance minus credit owed and projected reserves; unknown until an account balance is entered |

Find the exact entity IDs in **Settings → Devices & services → Autonomous Budget**. Each sensor includes `budget_id`, `metric`, `calculation`, `reserve_date`, effective `period`, `reference_date`, `period_start`, and exclusive `period_end` attributes. IDs remain stable when you rename a budget. Sensors update on edits and at local midnight, and can be used in built-in cards, templates, history, and automations.

```yaml
# Replace these example IDs with the entities from your installation.
type: entities
title: Household budget
entities:
  - sensor.everyday_life_income
  - sensor.everyday_life_expenses
  - sensor.everyday_life_remaining
```

See [dashboard and automation examples](docs/dashboards.md) for more.

## Language

The integration supports **English** and **French**. It automatically follows the language selected in your Home Assistant profile. Unsupported languages fall back to English. Monetary amounts and dates use the corresponding display format; changing language never changes stored amounts, currencies, or user-provided names.

<details>
<summary>French interface</summary>

![Autonomous Budget in French](docs/screenshot-french.png)

</details>

## Data and access

Budgets are shared across the Home Assistant household. **All authenticated Home Assistant users can view and export budgets; only administrators can create, edit, or delete them.** Dashboard visibility is not a separate financial-data permission boundary. Budget-specific sharing is not implemented.

Data is stored in `.storage/autonomous_budget` within the Home Assistant configuration directory and is included with normal Home Assistant configuration backups. Saves are serialized and durable before changes are shown; stale edits from another session are rejected rather than overwriting newer data.

Removing the integration keeps its stored budgets so reinstalling can restore them. Deleting a budget in the panel removes its entries and sensors. Use a Home Assistant backup before deleting data you may need again. The JSON export is for inspection and portability; an import UI is not included in this release.

## Updating from 0.1.0

Download 0.2.0 in HACS, restart Home Assistant, and refresh open browser tabs. Existing budgets, IDs, optional pay schedules, and the original six sensor calculations are preserved. Five new sensors are added to each budget. No storage reset or manual migration is needed.

The sidebar and custom card now default to **Per pay period**. Choose **Due dates**, or set `view: cashflow` on the card, for the earlier cash-flow display. The new balance fields are empty until you enter them.

## Troubleshooting

- **Integration not found:** check the folder is named `autonomous_budget` under `custom_components`, then restart Home Assistant.
- **Sidebar or card missing:** verify the integration loaded under Devices & services, then refresh the browser. Check Home Assistant logs for `autonomous_budget`.
- **Unexpected period:** check the budget’s optional pay period and reference date, its inherited defaults, and your Home Assistant timezone.
- **Different totals between views:** the regular plan normalizes recurring amounts; Due dates counts actual scheduled payments. Future commitments can appear in the plan before their first renewal.
- **Missing due-date amount:** check the entry is active and its renewal falls inside the period. Future first due dates do not backfill earlier payments.
- **Available balance unknown:** enter an optional account balance in Edit budget. Zero is a valid balance.
- **Another session changed the budget:** close the editor and reopen it to work from the latest saved data.

[Report a bug](https://github.com/raccommode/AutonomousBudget-HomeAssistant/issues/new?template=bug_report.yml) or [suggest a feature](https://github.com/raccommode/AutonomousBudget-HomeAssistant/issues/new?template=feature_request.yml).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the real Home Assistant test instance, automated checks, and architecture. The runtime uses Python and native browser modules, with no frontend build step or external runtime requirements.

Released under the [MIT License](LICENSE). This is an independent community integration.
