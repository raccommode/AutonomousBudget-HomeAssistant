# Dashboards and automations

## Compact custom card

```yaml
type: custom:autonomous-budget-card
budget_id: YOUR_BUDGET_ID
title: This payday
show_categories: true
show_upcoming: false
```

The card follows the selected budget’s own pay period (or its inherited defaults) even when the sidebar is browsing a past or future period. Its data comes from the authenticated integration subscription, independently of entity naming.

`show_categories` controls the three **income** categories. Expenses are not categorized. Card labels, dates, and amounts follow the Home Assistant profile language (English or French).

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

## Notify when a plan exceeds income

```yaml
alias: Budget plan exceeds income
description: Notify when the current plan moves below zero.
triggers:
  - trigger: numeric_state
    entity_id: sensor.everyday_life_remaining
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
