<div align="center">

# Autonomous Budget

**Your money, on your schedule. Right inside Home Assistant.**

Create budgets, plan recurring income and expenses, and see what's left each payday.

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
- **Your own rhythm.** Daily, weekly, every two weeks, monthly, or yearly. Two weeks is the default. Set a payday as the reference date.
- **Income and expenses.** Every entry has a money-flow direction and one of three categories: **Investment**, **Mandatory**, or **Optional**.
- **Recurring commitments.** Add Netflix, rent, a paycheck, or a savings contribution with its amount, currency, renewal date, and frequency. One-time entries, end dates, and pausing are supported too.
- **An honest view of each period.** See expected income, planned expenses, remaining money, category totals, and upcoming payments. Browse previous and upcoming periods.
- **Home Assistant dashboards.** A bundled visual card and six native monetary sensors per budget. No separate card download or manual resource registration.
- **Local storage.** Your budgets stay in Home Assistant. No account, cloud service, bank connection, telemetry, or runtime CDN dependency.
- **Export.** Download your budget definitions as a readable JSON file.

## Install with HACS

Requires **Home Assistant 2026.8.0 or newer** and a working [HACS installation](https://hacs.xyz/docs/use/).

1. Click **Open HACS repository** above, or add the repository manually in **HACS → ⋮ → Custom repositories**:
   - Repository: `https://github.com/raccommode/AutonomousBudget-HomeAssistant`
   - Type: **Integration**
2. Find **Autonomous Budget** in HACS and download it.
3. **Restart Home Assistant.**
4. Click **Add integration** above, or go to **Settings → Devices & services → Add integration → Autonomous Budget**.
5. Choose your default currency, budget period, and reference date.
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

1. In **Settings**, select **Every two weeks** and enter a payday as the reference date.
2. Create a budget named **Everyday life**, with your preferred currency.
3. Add your paycheck: **Income**, your chosen category, amount, **Every two weeks**, and a payday as its first due date.
4. Add rent as a **Mandatory** expense, Netflix as an **Optional** expense, and a savings contribution as an **Investment** expense.
5. Set the amount and actual renewal date for each entry. The overview updates immediately.

For example, an August 28 payday starts a period running **August 28 through September 10**, inclusive. A Netflix renewal on September 3 is counted in that period; one on September 11 belongs to the next period.

The three category totals describe **expenses**. Income retains its category but contributes only to the income total, so it cannot inflate spending totals. Savings and investments entered as expenses reduce the amount left to spend.

### How periods and recurring entries work

| Setting | Behavior |
| --- | --- |
| Daily | One calendar day in Home Assistant's timezone |
| Weekly | Seven days, aligned to the reference date |
| Every two weeks | Fourteen days, aligned to a payday or other reference date |
| Monthly | From the reference day to the same day next month |
| Yearly | From the reference month/day to the following year |

Use the first of the month or January 1 as the reference for calendar months or calendar years. All budgets share the period setting; each keeps its own currency.

Entry frequencies are **One time, Daily, Weekly, Every two weeks, Monthly, Quarterly, and Yearly**. Recurrence begins on the first due / renewal date and never creates earlier payments. An end date is inclusive. When a month has fewer days, the due date moves to that month's final day and returns to the original day when possible: January 31 → February 28/29 → March 31.

Totals count the payments **actually scheduled inside the selected period**, not a monthly amount divided by two. They are planning projections, not bank balances, cleared transactions, or an immutable transaction history. Editing, pausing, or deleting an entry also changes past and future projections. Unspent money does not automatically roll over.

### Currencies

Choose a currency for each budget and each entry. When they differ, supply a manual exchange rate: **1 entry-currency unit = X budget-currency units**. For example, a USD 10 subscription with a rate of 1.35 contributes CAD 13.50 to a CAD budget. Rates are not fetched automatically.

Amounts use decimal arithmetic and the supported currency's minor units, including zero-decimal JPY and three-decimal KWD. Each converted payment is rounded before aggregation. You cannot change the currency of a budget containing entries; create another budget instead. See [`CURRENCIES`](custom_components/autonomous_budget/const.py) for the supported list.

## Add a dashboard card

The integration registers its card automatically, including on YAML dashboards. After initial installation, refresh the browser.

1. Edit a dashboard and choose **Add card**.
2. Search for **Autonomous Budget**.
3. Select a budget in the visual editor. Optionally customize the title and show or hide categories and upcoming payments.

<img src="docs/screenshot-card.png" alt="Autonomous Budget dashboard card" width="390">

You can also open the grid button beside a budget's name to get its ready-to-paste YAML:

```yaml
type: custom:autonomous-budget-card
budget_id: YOUR_BUDGET_ID
show_categories: true
show_upcoming: true
```

`budget_id` is optional and defaults to the first available budget. Use a specific ID to keep the card tied to that budget. Optional `title` overrides its heading. A deleted budget displays an explicit message instead of silently switching to another budget.

### Native sensors and automations

Each budget is a device with six monetary sensors:

| Sensor | Current-period value |
| --- | --- |
| Income | Scheduled incoming money |
| Expenses | All scheduled expenses |
| Remaining | Income minus expenses |
| Investment | Investment expenses |
| Mandatory | Mandatory expenses |
| Optional | Optional expenses |

Find the exact entity IDs in **Settings → Devices & services → Autonomous Budget**. Each sensor includes `budget_id`, `period`, `period_start`, and exclusive `period_end` attributes. IDs remain stable when you rename a budget. Sensors update on edits and at local midnight, and can be used in built-in cards, templates, history, and automations.

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

## Data and access

Budgets are shared across the Home Assistant household. **All authenticated Home Assistant users can view and export budgets; only administrators can create, edit, or delete them.** Dashboard visibility is not a separate financial-data permission boundary. Budget-specific sharing is not implemented.

Data is stored in `.storage/autonomous_budget` within the Home Assistant configuration directory and is included with normal Home Assistant configuration backups. Saves are serialized and durable before changes are shown; stale edits from another session are rejected rather than overwriting newer data.

Removing the integration keeps its stored budgets so reinstalling can restore them. Deleting a budget in the panel removes its entries and sensors. Use a Home Assistant backup before deleting data you may need again. The JSON export is for inspection and portability; an import UI is not included in this release.

## Troubleshooting

- **Integration not found:** check the folder is named `autonomous_budget` under `custom_components`, then restart Home Assistant.
- **Sidebar or card missing:** verify the integration loaded under Devices & services, then refresh the browser. Check Home Assistant logs for `autonomous_budget`.
- **Unexpected period:** check your Home Assistant timezone and the reference date in Autonomous Budget settings.
- **Missing amount:** check the entry is active and its renewal falls inside the period. Future first due dates do not backfill earlier periods.
- **Another session changed the budget:** close the editor and reopen it to work from the latest saved data.

[Report a bug](https://github.com/raccommode/AutonomousBudget-HomeAssistant/issues/new?template=bug_report.yml) or [suggest a feature](https://github.com/raccommode/AutonomousBudget-HomeAssistant/issues/new?template=feature_request.yml).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the real Home Assistant test instance, automated checks, and architecture. The runtime uses Python and native browser modules, with no frontend build step or external runtime requirements.

Released under the [MIT License](LICENSE). This is an independent community integration.
