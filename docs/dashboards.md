# Dashboards and automations

## Compact custom card

```yaml
type: custom:autonomous-budget-card
budget_id: YOUR_BUDGET_ID
title: This payday
view: plan
show_reserves: true
show_categories: true
show_upcoming: false
```

The card follows the selected budget’s own pay period (or its inherited defaults) even when the sidebar is browsing a past or future period. Its data comes from the authenticated integration subscription, independently of entity naming.

`view: plan` (default) shows normalized amounts per pay period. `view: cashflow` shows actual scheduled payments. Every content block has its own checkbox in the visual editor and its own YAML option. Hiding one block does not hide the others. All options default to `true`; an existing card with `show_reserves: false` continues hiding available balance and the reserve explanation unless their new options are explicitly enabled.

`show_categories` controls the three **expense** categories. Income has no category. Older expenses awaiting classification are shown separately as **To categorize** and remain included in expense totals. Card labels, dates, and amounts follow the Home Assistant profile language (English or French).

| Option | Content |
| --- | --- |
| `show_title` | Budget name or custom title |
| `show_period` | Date range and pay frequency |
| `show_icon` | Wallet icon |
| `show_balance` | Remaining after expenses |
| `show_calculation` | Per-pay-period / scheduled calculation label |
| `show_income` | Income total |
| `show_expenses` | Expense total |
| `show_shared` | Common budget amount: total automatic contributions for a personal budget, or total expenses for a shared budget, using the selected calculation view |
| `show_categories` | Expense category breakdown |
| `show_upcoming` | Upcoming payments |
| `show_reserves` | Today's negative projected reserve, including current common contributions |
| `show_available_balance` | Available money, when an account balance is configured |
| `show_reserve_note` | Reserve explanation |
| `show_link` | Link to open Autonomous Budget |

For a card showing only the common amount and projected reserve:

```yaml
type: custom:autonomous-budget-card
budget_id: YOUR_PERSONAL_BUDGET_ID
show_title: false
show_period: false
show_icon: false
show_balance: false
show_calculation: false
show_income: false
show_expenses: false
show_shared: true
show_categories: false
show_upcoming: false
show_reserves: true
show_available_balance: false
show_reserve_note: false
show_link: false
```

The common amount is already included in expenses; showing it separately does not add another expense. You can also turn all options off, leaving an empty card, then enable only the blocks you want.

## A built-in glance card

Replace the entity IDs with those in your installation.

```yaml
type: glance
title: This period
entities:
  - entity: sensor.everyday_life_income
    name: Income
  - entity: sensor.everyday_life_expenses
    name: Expenses
  - entity: sensor.everyday_life_remaining
    name: Left to spend
```

## Reserve and available-balance card

In the sidebar, click **Home Assistant entity** beside the **Projected reserves** total to get the exact reserve sensor ID and YAML for the selected budget. **Open entity** opens its native details. This sensor is enabled by default, uses the budget currency, and updates after edits and at local midnight. Its value always represents today, even when the sidebar is browsing another period.

```yaml
type: entities
title: Money set aside
entities:
  - sensor.everyday_life_projected_reserve
  - sensor.everyday_life_available_after_reserves
```

The available sensor is unknown until an account balance is entered. Reserve values are **negative deductions** (zero remains zero), based on the pay schedule rather than recorded transfers. The available amount adds this negative reserve to account balance minus credit owed, so changing the display sign does not add money back. Account balances and credit owed are updated manually in **Edit budget**.

## Notify when a plan exceeds income

```yaml
alias: Budget plan exceeds income
description: Notify when the current plan moves below zero.
triggers:
  - trigger: numeric_state
    entity_id: sensor.everyday_life_remaining_per_pay_period
    below: 0
actions:
  - action: persistent_notification.create
    data:
      title: Review your budget
      message: Planned expenses exceed income in the current budget period.
mode: single
```

A numeric-state trigger fires when the value crosses the threshold; it does not repeatedly notify while the state remains below it. Sensor values describe a plan, not a bank account. Decide which dashboards and notifications should display household financial information.

## Sensor history

The sensors use Home Assistant's monetary device class. They deliberately do not expose a long-term statistics state class: totals are recomputed period projections, not cumulative or measured transactions. Home Assistant Recorder can still keep normal entity history, subject to your own Recorder configuration.

## Common budgets and personal contributions

Choose a common budget in the same card editor to see its expense plan and projected reserve. Choose a personal budget to include its automatic mandatory contributions alongside its own expenses. Updates to the common budget or its allocation reach both cards and native sensors automatically.

Each sensor exposes a `budget_type` attribute (`personal` or `shared`) in addition to `budget_id` and `metric`. Existing entity IDs remain stable. Common reserves use participants' paydays when an allocation is configured; personal budgets reserve the full current common contribution and show it as a negative amount. Their reserves stay tied to today, including when navigating other periods. Common and personal budgets show different accounts; their reserve values should be interpreted per account. Do not sum common expense sensors with the linked personal contribution sensors to calculate a household expense total: they describe the same commitments from two perspectives.
