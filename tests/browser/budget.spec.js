import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync('.dev-ha/tokens.json', 'utf8'));
test.beforeEach(async ({ page }, testInfo) => {
  page.on('pageerror', error => console.error('Frontend error:', error.message));
  const language = testInfo.title.startsWith("French") ? "fr" : "en";
  await page.addInitScript(({tokens, language}) => {
    localStorage.setItem('hassTokens', JSON.stringify(tokens));
    localStorage.setItem('selectedLanguage', JSON.stringify(language));
  }, {tokens, language});
  await page.goto('/autonomous-budget');
  await expect(page.locator('autonomous-budget-panel h1')).toHaveText(language === 'fr' ? 'Votre argent, en un regard.' : 'Your money, in view.');
  await expect(page.locator('#ha-launch-screen')).toHaveCount(0);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) console.log(await page.locator('body').ariaSnapshot());
});

test('desktop panel, period navigation, and dashboard card', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await expect(panel.getByRole('cell', {name: /Netflix/}).first()).toBeVisible();
  await expect(panel.getByText('CAD 1,352.16', {exact: true})).toBeVisible();
  await panel.getByRole('button', {name: 'Due dates', exact: true}).click();
  await expect(panel.getByText('CAD 783.02', {exact: true})).toBeVisible();
  await panel.getByRole('button', {name: 'Per pay period', exact: true}).click();
  await expect(panel.getByText('CAD 1,352.16', {exact: true})).toBeVisible();
  await expect(panel.getByRole('heading', {name: 'Projected reserves', exact: true})).toBeVisible();
  await expect(panel.getByRole('progressbar').first()).toBeVisible();
  await expect(panel.locator('.period-nav button')).toHaveCount(2);
  await expect(panel.locator('.period-nav').getByRole('button', {name:'Today'})).toHaveCount(0);
  expect(await panel.locator('tbody').evaluateAll(groups => groups.map(el => el.dataset.group))).toEqual(['income', 'expenses', 'investment', 'mandatory', 'optional']);
  await expect(panel.locator('tbody[data-group="income"] .entry-name > span')).toHaveText(['Paycheck']);
  await expect(panel.locator('tbody[data-group="investment"] .entry-name > span')).toHaveText(['Future fund']);
  await expect(panel.locator('tbody[data-group="mandatory"] .entry-name > span')).toHaveText(['Rent', 'Groceries', 'Internet']);
  await expect(panel.locator('tbody[data-group="optional"] .entry-name > span')).toHaveText(['Netflix', 'Coffee & little things']);
  await panel.getByRole('group', {name:'Filter entries'}).getByRole('button', {name:/^Income/}).click();
  await expect(panel.locator('tbody')).toHaveCount(1);
  await panel.getByRole('group', {name:'Filter entries'}).getByRole('button', {name:/^Expenses/}).click();
  await expect(panel.locator('tbody[data-group="income"]')).toHaveCount(0);
  await panel.getByRole('group', {name:'Filter entries'}).getByRole('button', {name:/^All entries/}).click();
  const period = await panel.locator('.period-title').innerText();
  await panel.getByRole('button', {name: 'Next period', exact: true}).click();
  await expect(panel.locator('.period-title')).not.toHaveText(period);
  await panel.getByRole('button', {name: 'Previous period', exact: true}).click();
  await expect(panel.locator('.period-title')).toHaveText(period);
  await page.screenshot({path: 'docs/screenshot-desktop.png', fullPage: true});
  await panel.getByRole('button', {name: 'Add budget to a dashboard'}).click();
  await expect(panel.locator('dialog pre')).toContainText('custom:autonomous-budget-card');
  await panel.getByRole('button', {name: 'Done', exact: true}).click();
  // Exercise the real registered card with the authenticated HA websocket client.
  await panel.evaluate(async (panel) => {
    await customElements.whenDefined('autonomous-budget-card');
    const card = document.createElement('autonomous-budget-card');
    card.setConfig({type: 'custom:autonomous-budget-card'});
    card.hass = panel.hass;
    const host = document.createElement('div');
    host.id = 'card-test-host'; host.style = 'position:fixed;right:30px;top:100px;width:390px;z-index:1000';
    host.append(card);document.body.append(host);
  });
  const card = page.locator('autonomous-budget-card');
  await expect(card.getByRole('heading', {name: 'Everyday life'})).toBeVisible();
  await expect(card.getByText('CAD 1,352.16', {exact: true})).toBeVisible();
  await expect(card.getByRole('heading', {name: 'Expenses by category'})).toBeVisible();
  await expect(card.locator('.category').filter({hasText:'Mandatory'})).toContainText('CAD 760.00');
  await card.screenshot({path: 'docs/screenshot-card.png'});
});

test('create, edit, currency conversion, pause, reload, and delete', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await panel.getByRole('button', {name: 'New budget', exact: true}).click();
  await panel.getByLabel('Budget name', {exact:true}).fill('Browser test budget');
  await panel.getByRole('button', {name: 'Create budget', exact:true}).click();
  await expect(panel.getByRole('heading', {name: 'Browser test budget'})).toBeVisible();
  await expect(panel.locator('.period-bar .badge')).toHaveText('Every two weeks');
  await panel.getByRole('button', {name: 'Edit budget', exact:true}).click();
  await panel.getByLabel('Pay period (optional)').selectOption('weekly');
  await panel.getByRole('button', {name: 'Save changes', exact:true}).click();
  await expect(panel.locator('.period-bar .badge')).toHaveText('Weekly');
  await panel.getByRole('button', {name: 'Add entry', exact:true}).click();
  await expect(panel.getByLabel('Expense category')).toBeVisible();
  await panel.getByLabel('Money flow').selectOption('income');
  await expect(panel.getByLabel('Expense category')).toBeHidden();
  await panel.getByLabel('Money flow').selectOption('expense');
  await expect(panel.getByLabel('Expense category')).toBeVisible();
  await panel.getByLabel('Expense category').selectOption('optional');
  await panel.getByLabel('Entry name').fill('Foreign subscription');
  await panel.getByLabel('Amount', {exact:true}).fill('10.00');
  await panel.getByLabel('Currency', {exact:true}).selectOption('USD');
  await panel.getByLabel('Exchange rate to CAD').fill('1.35');
  await panel.getByRole('button', {name: 'Add entry', exact:true}).last().click();
  await expect(panel.locator('.stat .value').last()).toHaveText('CAD 3.12');
  await panel.getByRole('button', {name: 'Edit Foreign subscription'}).click();
  await panel.getByLabel('Active entry').uncheck();
  await panel.getByRole('button', {name: 'Save changes', exact:true}).click();
  await expect(panel.locator('.stat .value').last()).toHaveText('CAD 0.00');
  await page.reload();
  await panel.getByRole('button', {name: 'Browser test budget CAD'}).click();
  await expect(panel.getByText('Optional · Paused')).toBeVisible();
  await panel.getByRole('button', {name:'Edit budget',exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget',exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget',exact:true}).click();
  await expect(panel.getByRole('button', {name:'Browser test budget CAD'})).toHaveCount(0);
});

test('mobile layout and editable settings', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  const panel = page.locator('autonomous-budget-panel');
  // Close the HA drawer if it persisted from desktop.
  await expect(panel.getByRole('heading', {name:'Your money, in view.'})).toBeVisible();
  await page.screenshot({path:'docs/screenshot-mobile.png', fullPage:true});
  expect(await panel.evaluate((el) => el.shadowRoot.querySelector('.shell').scrollWidth <= el.clientWidth)).toBeTruthy();
  await expect(panel.locator('.period-nav button')).toHaveCount(2);
  await panel.getByRole('button', {name:'Settings', exact:true}).click();
  await expect(panel.getByLabel('Budget period')).toHaveValue('biweekly');
  await panel.getByLabel('Budget period').selectOption('weekly');
  await panel.getByRole('button', {name:'Save changes',exact:true}).click();
  await expect(panel.locator('.period-bar .badge')).toHaveText('Weekly');
  await panel.getByRole('button', {name:'Settings',exact:true}).click();
  await panel.getByLabel('Budget period').selectOption('biweekly');
  await panel.getByRole('button', {name:'Save changes',exact:true}).click();
});

test('French panel, optional pay schedule, and untranslated user names', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await expect(panel.getByRole('button', {name:'Paramètres',exact:true})).toBeVisible();
  await expect(panel.getByText('Revenus par période de paie', {exact:true})).toBeVisible();
  await expect(panel.getByText('1\u202f352,16 CAD', {exact:true})).toBeVisible();
  await panel.getByRole('button', {name:'Nouveau budget',exact:true}).click();
  await panel.getByLabel('Nom du budget').fill('Income');
  await expect(panel.getByLabel('Période de paie (facultative)')).toHaveValue('');
  await expect(panel.getByLabel('Date de paie ou de référence (facultative)')).toHaveValue('');
  await panel.getByRole('button', {name:'Créer le budget',exact:true}).click();
  await expect(panel.getByRole('heading', {name:'Income',exact:true})).toBeVisible();
  await panel.getByRole('button', {name:'Ajouter une entrée',exact:true}).first().click();
  await expect(panel.getByLabel('Catégorie de dépense')).toBeVisible();
  await panel.getByLabel('Sens du mouvement').selectOption('income');
  await expect(panel.getByLabel('Catégorie de dépense')).toBeHidden();
  await panel.getByLabel('Sens du mouvement').selectOption('expense');
  await expect(panel.getByLabel('Catégorie de dépense')).toBeVisible();
  await expect(panel.getByRole('option', {name:'Investissement',exact:true})).toHaveCount(1);
  await panel.getByRole('button', {name:'Annuler',exact:true}).click();
  await panel.getByRole('button', {name:'Modifier le budget',exact:true}).click();
  await panel.getByRole('button', {name:'Supprimer le budget',exact:true}).click();
  await panel.getByRole('button', {name:'Supprimer le budget',exact:true}).click();
  await expect(panel.getByRole('heading', {name:'Income',exact:true})).toHaveCount(0);
  await expect(panel.locator('.toast')).toHaveCount(0);
  await expect(panel.locator('.table-foot')).toContainText('entrées actives');
  await expect(panel.locator('tbody[data-group="income"] h3')).toContainText('Revenus');
  await expect(panel.locator('tbody[data-group="expenses"] h3')).toContainText('Dépenses');
  await expect(panel.locator('tbody[data-group="investment"] h3')).toContainText('Investissement');
  await expect(panel.locator('.period-nav button')).toHaveCount(2);
  await expect(panel.locator('.period-nav')).not.toContainText('Aujourd’hui');
  await expect(panel.locator('.reserve-entry.excluded').filter({hasText:'Future fund'})).toContainText('Payé avec le revenu');
  await expect(panel.locator('.reserve-entry.excluded').filter({hasText:'Future fund'})).toContainText('250,00 CAD');
  await page.screenshot({path:'docs/screenshot-french.png',fullPage:true});
});

test('paycheck reserves, manual available balance, native sensors, export, and card editor', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  const today = await panel.evaluate(el => el.data.today);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const due = tomorrow.toISOString().slice(0, 10);
  await panel.getByRole('button', {name: 'New budget', exact:true}).click();
  await panel.getByLabel('Budget name', {exact:true}).fill('Reserve browser test');
  await panel.getByLabel('Pay period (optional)').selectOption('biweekly');
  await panel.getByLabel('Payday / reference date (optional)').fill(today);
  await panel.getByLabel('Account balance (optional)').fill('100');
  await panel.getByLabel('Credit owed (optional)').fill('20');
  await panel.getByRole('button', {name: 'Create budget', exact:true}).click();
  await expect(panel.getByRole('heading', {name: 'Reserve browser test'})).toBeVisible();
  await panel.getByRole('button', {name: 'Add entry', exact:true}).click();
  await panel.getByLabel('Expense category').selectOption('mandatory');
  await panel.getByLabel('Entry name').fill('Insurance');
  await panel.getByLabel('Amount', {exact:true}).fill('120');
  await panel.getByLabel('First due / renewal date').fill(due);
  await panel.getByRole('button', {name: 'Add entry', exact:true}).last().click();
  await expect(panel.locator('.stat .value').last()).toHaveText('CAD 55.38');
  await expect(panel.locator('.reserve-total')).toHaveText('-CAD 120.00');
  await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await expect(panel.locator('.available-summary strong')).toHaveText('-CAD 40.00');
  await panel.getByRole('button', {name: 'Due dates', exact:true}).click();
  await expect(panel.locator('.stat .value').last()).toHaveText('CAD 120.00');
  const actual = await panel.evaluate(async el => (await el.hass.callWS({type: 'get_states'})).filter(state => state.attributes.budget_id === el.budget.id).map(state => ({metric: state.attributes.metric, state: state.state})));
  expect(actual).toEqual(expect.arrayContaining([
    {metric: 'expenses', state: '120.00'},
    {metric: 'mandatory', state: '120.00'},
    {metric: 'investment', state: '0.00'},
    {metric: 'optional', state: '0.00'},
    {metric: 'planned_expenses', state: '55.38'},
    {metric: 'reserved', state: '-120.00'},
    {metric: 'available_balance', state: '-40.00'},
  ]));
  const entityInfo = await panel.evaluate(async el => {
    const state = Object.values(el.hass.states).find(state => state.attributes.budget_id === el.budget.id && state.attributes.metric === 'reserved');
    const registry = await el.hass.callWS({type:'config/entity_registry/list'});
    return {state, registration: registry.find(entity => entity.entity_id === state.entity_id)};
  });
  expect(entityInfo.state.state).toBe('-120.00');
  expect(entityInfo.state.attributes.device_class).toBe('monetary');
  expect(entityInfo.state.attributes.unit_of_measurement).toBe('CAD');
  expect(entityInfo.registration.disabled_by).toBeNull();
  await panel.getByRole('button', {name:'Home Assistant entity',exact:true}).click();
  await expect(panel.locator('dialog pre').first()).toHaveText(entityInfo.state.entity_id);
  await expect(panel.locator('dialog pre').last()).toContainText(`entity: ${entityInfo.state.entity_id}`);
  await panel.getByRole('button', {name:'Open entity',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link', {name:'Show more'})).toHaveAttribute('href', new RegExp(entityInfo.state.entity_id));
  await page.getByRole('button', {name:'Close',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('button', {name:'Export budgets'}).click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  const saved = exported.budgets.find(budget => budget.name === 'Reserve browser test');
  expect(saved.account_balance).toBe('100.00');
  expect(saved.credit_balance).toBe('20.00');
  expect(saved.items[0].category).toBe('mandatory');
  expect(saved.items[0]).not.toHaveProperty('reserve');
  expect(saved.items[0]).not.toHaveProperty('planned_amount');
  await panel.evaluate(async el => {
    await customElements.whenDefined('autonomous-budget-card-editor');
    const editor = document.createElement('autonomous-budget-card-editor');
    editor.id = 'editor-test';
    editor.setConfig({type: 'custom:autonomous-budget-card', budget_id: el.budget.id});
    editor.hass = el.hass;
    editor.style = 'position:fixed;right:20px;top:80px;padding:20px;width:330px;max-height:80vh;overflow:auto;background:white;z-index:1000';
    document.body.append(editor);
  });
  const editor = page.locator('autonomous-budget-card-editor');
  await editor.getByLabel('Calculation view').selectOption('cashflow');
  await editor.getByLabel('Show projected reserves').uncheck();
  expect(await editor.evaluate(el => el.config)).toMatchObject({view:'cashflow', show_reserves:false});
  await editor.evaluate(el => el.remove());
  await page.reload();
  await panel.getByRole('button', {name:'Reserve browser test CAD'}).click();
  await expect(panel.locator('.available-summary strong')).toHaveText('-CAD 40.00');
  await panel.getByRole('button', {name:'Edit budget',exact:true}).click();
  await expect(panel.getByLabel('Account balance (optional)')).toHaveValue('100.00');
  await panel.getByLabel('Account balance (optional)').fill('');
  await panel.getByRole('button', {name:'Save changes',exact:true}).click();
  await expect(panel.locator('.available-summary strong')).toHaveText('—');
  await panel.getByRole('button', {name:'Edit budget',exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget',exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget',exact:true}).click();
  await expect(panel.getByRole('button', {name:'Reserve browser test CAD'})).toHaveCount(0);
});

test('income saves without category and changing direction requires an expense category', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await panel.getByRole('button', {name:'New budget', exact:true}).click();
  await panel.getByLabel('Budget name', {exact:true}).fill('Category correction test');
  await panel.getByRole('button', {name:'Create budget', exact:true}).click();
  await panel.getByRole('button', {name:'Add entry', exact:true}).click();
  await panel.getByLabel('Money flow').selectOption('income');
  await expect(panel.getByLabel('Expense category')).toBeHidden();
  await panel.getByLabel('Entry name').fill('Paycheck test');
  await panel.getByLabel('Amount', {exact:true}).fill('1000');
  await panel.getByLabel('Repeats').selectOption('biweekly');
  await panel.getByRole('button', {name:'Add entry', exact:true}).last().click();
  await expect(panel.locator('.stat .value').nth(1)).toHaveText('CAD 1,000.00');
  expect(await panel.evaluate(el => el.budget.items[0].category)).toBeNull();
  await expect(panel.locator('.category-list .amount')).toHaveText(['CAD 0.00', 'CAD 0.00', 'CAD 0.00']);
  await panel.getByRole('button', {name:'Edit Paycheck test'}).click();
  await panel.getByLabel('Money flow').selectOption('expense');
  await expect(panel.getByLabel('Expense category')).toHaveValue('');
  await panel.getByRole('button', {name:'Save changes', exact:true}).click();
  await expect(panel.locator('dialog')).toBeVisible();
  expect(await panel.getByLabel('Expense category').evaluate(el => el.validity.valueMissing)).toBe(true);
  await panel.getByLabel('Expense category').selectOption('investment');
  await panel.getByRole('button', {name:'Save changes', exact:true}).click();
  await expect(panel.locator('.category-list .amount')).toHaveText(['CAD 1,000.00', 'CAD 0.00', 'CAD 0.00']);
  await expect(panel.locator('.category-list').getByText('100% of expenses')).toBeVisible();
  // A newly added income moves above an expense created earlier.
  await panel.getByRole('button', {name:'Add entry',exact:true}).click();
  await panel.getByLabel('Money flow').selectOption('income');
  await panel.getByLabel('Entry name').fill('Bonus test');
  await panel.getByLabel('Amount', {exact:true}).fill('50');
  await panel.getByRole('button', {name:'Add entry',exact:true}).last().click();
  await expect(panel.locator('tbody').first()).toHaveAttribute('data-group', 'income');
  await expect(panel.locator('tbody').first().getByText('Bonus test', {exact:true})).toBeVisible();
  await expect(panel.locator('tbody[data-group="investment"]').getByText('Paycheck test', {exact:true})).toBeVisible();
  await page.reload();
  await panel.getByRole('button', {name:'Category correction test CAD'}).click();
  await panel.getByRole('button', {name:'Edit Paycheck test'}).click();
  await expect(panel.getByLabel('Expense category')).toHaveValue('investment');
  await panel.getByLabel('Money flow').selectOption('income');
  await expect(panel.getByLabel('Expense category')).toBeHidden();
  await panel.getByRole('button', {name:'Save changes', exact:true}).click();
  await expect(panel.locator('.category-list .amount')).toHaveText(['CAD 0.00', 'CAD 0.00', 'CAD 0.00']);
  expect(await panel.evaluate(el => el.budget.items[0].category)).toBeNull();
  await panel.getByRole('button', {name:'Edit budget', exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget', exact:true}).click();
  await panel.getByRole('button', {name:'Delete budget', exact:true}).click();
  await expect(panel.getByRole('button', {name:'Category correction test CAD'})).toHaveCount(0);
});

test('shared budget allocation synchronizes personal expenses, sensors, export, and removal', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  const created = [];
  async function create(name, kind = 'personal', period = 'biweekly', anchor = '2026-08-28') {
    await panel.getByRole('button', {name:'New budget', exact:true}).click();
    await panel.getByLabel('Budget name', {exact:true}).fill(name);
    await panel.getByLabel('Budget type').selectOption(kind);
    await panel.getByLabel('Pay period (optional)').selectOption(period);
    await panel.getByLabel('Payday / reference date (optional)').fill(anchor);
    await panel.getByRole('button', {name:'Create budget', exact:true}).click();
    await expect(panel.getByRole('heading', {name, exact:true})).toBeVisible();
    const id = await panel.evaluate(p => p.budget.id);
    created.push(id);
    return id;
  }
  try {
    const alex = await create('Alex');
    const sam = await create('Sam', 'personal', 'monthly', '2026-09-01');
    const common = await create('Shared household', 'shared');
    await expect(panel.getByText('100% unallocated', {exact:true})).toBeVisible();
    await panel.getByRole('button', {name:'Add entry', exact:true}).click();
    await panel.getByLabel('Entry name').fill('Shared rent');
    await panel.getByLabel('Expense category').selectOption('mandatory');
    await panel.getByLabel('Amount', {exact:true}).fill('2600');
    await panel.getByLabel('First due / renewal date').fill('2026-09-01');
    await panel.getByRole('button', {name:'Add entry', exact:true}).last().click();
    await panel.getByRole('button', {name:'Manage allocation', exact:true}).click();
    const alexRow = panel.locator('.allocation-row').filter({hasText:'Alex'});
    const samRow = panel.locator('.allocation-row').filter({hasText:'Sam'});
    await alexRow.getByLabel('Share (%)').fill('60');
    await samRow.getByLabel('Share (%)').fill('50');
    expect(await panel.locator('dialog form').evaluate(form => form.checkValidity())).toBe(false);
    await samRow.getByLabel('Share (%)').fill('40');
    await expect(panel.locator('.allocation-total')).toHaveText('100% allocated · 0% unallocated');
    await panel.getByRole('button', {name:'Save changes', exact:true}).click();
    await expect(panel.locator('.share-row').filter({hasText:'Alex'})).toContainText('CAD 720.00');
    await expect(panel.locator('.share-row').filter({hasText:'Sam'})).toContainText('CAD 1,040.00');
    await expect(panel.locator('.toast')).toHaveCount(0);
    await page.screenshot({path:'docs/screenshot-shared.png', fullPage:true});
    await panel.locator('.share-row').getByRole('button', {name:'Alex', exact:true}).click();
    await expect(panel.getByText('Automatic contribution · 60%', {exact:true})).toBeVisible();
    await expect(panel.locator('tbody[data-group="mandatory"]')).toContainText('CAD 720.00');
    await expect(panel.getByRole('button', {name:'Edit Shared household'})).toHaveCount(0);
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 720.00');
    await expect(panel.locator('.reserve-entry').filter({hasText:'Shared household'})).toContainText('-CAD 720.00');
    await expect(panel.getByText('Reserved for this pay period', {exact:true})).toBeVisible();
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'reserved')?.state, alex)).toBe('-720.00');
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'planned_expenses')?.state, alex)).toBe('720.00');
    await panel.getByRole('button', {name:'Open shared budget', exact:true}).click();
    await panel.getByRole('button', {name:'Edit Shared rent', exact:true}).click();
    await panel.getByLabel('Amount', {exact:true}).fill('5200');
    await panel.getByRole('button', {name:'Save changes', exact:true}).click();
    await expect(panel.locator('.share-row').filter({hasText:'Alex'})).toContainText('CAD 1,440.00');
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'planned_expenses')?.state, sam)).toBe('2080.00');
    // Native cards use the same live contribution totals.
    await panel.evaluate(async (p, id) => {
      await customElements.whenDefined('autonomous-budget-card');
      const card = document.createElement('autonomous-budget-card');
      card.setConfig({type:'custom:autonomous-budget-card', budget_id:id}); card.hass = p.hass;
      document.body.append(card);
    }, alex);
    await expect(page.locator('autonomous-budget-card .value')).toHaveText(/1,440.00/);
    await expect(page.locator('autonomous-budget-card [data-section="show_shared"]')).toContainText('CAD 1,440.00');
    await expect(page.locator('autonomous-budget-card .due-row').filter({hasText:'Today'})).toContainText('-CAD 1,440.00');
    await page.locator('autonomous-budget-card').evaluate(card => card.remove());
    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', {name:'Export budgets'}).click();
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(exported.budgets.find(b => b.id === common).allocations).toEqual([{budget_id:alex, percentage:'60'}, {budget_id:sam, percentage:'40'}]);
    expect(exported.budgets.find(b => b.id === alex).items).toEqual([]);
    await page.reload();
    await panel.locator('.budget-tab').filter({hasText:'Shared household'}).click();
    await expect(panel.locator('.share-row').filter({hasText:'Alex'})).toContainText('CAD 1,440.00');
    await panel.getByRole('button', {name:'Manage allocation', exact:true}).click();
    await panel.locator('.allocation-row').filter({hasText:'Sam'}).getByLabel('Share (%)').fill('0');
    await panel.getByRole('button', {name:'Save changes', exact:true}).click();
    await expect(panel.getByText('40% unallocated', {exact:true})).toBeVisible();
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'planned_expenses')?.state, sam)).toBe('0.00');
    await panel.getByRole('button', {name:'Edit budget', exact:true}).click();
    await panel.getByRole('button', {name:'Delete budget', exact:true}).click();
    await panel.getByRole('button', {name:'Delete budget', exact:true}).click();
    await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), common)).toBe(false);
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'planned_expenses')?.state, alex)).toBe('0.00');
  } finally {
    for (const id of created.reverse()) {
      await panel.evaluate(async (p, id) => {
        if (p.data.budgets.some(b => b.id === id)) await p.hass.callWS({type:'autonomous_budget/mutate', action:'budget_delete', payload:{budget_id:id}, revision:p.data.revision});
      }, id);
      await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)).toBe(false);
    }
  }
});

test('French shared budget allocation fits mobile and translates automatic contributions', async ({ page }) => {
  await page.setViewportSize({width:390, height:844});
  const panel = page.locator('autonomous-budget-panel');
  const ids = [];
  try {
    // Seed disposable personal and common budgets through the authenticated API.
    for (const payload of [{name:'Camille', currency:'CAD'}, {name:'Commun mobile', currency:'CAD', kind:'shared'}]) {
      const id = await panel.evaluate(async (p, payload) => (await p.hass.callWS({type:'autonomous_budget/mutate', action:'budget_create', payload, revision:p.data.revision})).id, payload);
      ids.push(id);
      await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)).toBe(true);
    }
    await panel.evaluate(async (p, id) => p.hass.callWS({type:'autonomous_budget/mutate', action:'item_create', payload:{budget_id:id, name:'Loyer partagé', direction:'expense', category:'mandatory', amount:'100', currency:'CAD', recurrence:'biweekly', renewal_date:'2026-09-01'}, revision:p.data.revision}), ids[1]);
    await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.find(b => b.id === id)?.items.length, ids[1])).toBe(1);
    await panel.locator('.budget-tab').filter({hasText:'Commun mobile'}).click();
    await expect(panel.getByRole('heading', {name:'Budget commun', exact:true})).toBeVisible();
    await panel.getByRole('button', {name:'Gérer la répartition', exact:true}).click();
    await panel.locator('.allocation-row').filter({hasText:'Camille'}).getByLabel('Part (%)').fill('100');
    await expect(panel.locator('.allocation-total')).toHaveText('100 % réparti · 0 % non réparti');
    await expect(panel.locator('dialog')).toBeVisible();
    const bounds = await panel.locator('dialog').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await panel.getByRole('button', {name:'Enregistrer', exact:true}).click();
    await panel.locator('.share-row').getByRole('button', {name:'Camille', exact:true}).click();
    await expect(panel.getByText('Contribution automatique · 100%', {exact:true})).toBeVisible();
    await expect(panel.locator('.reserve-total')).toHaveText('-100,00 CAD');
    await expect(panel.getByText('Réservé pour cette période de paie', {exact:true})).toBeVisible();
    await panel.getByRole('button', {name:'Ouvrir le budget commun', exact:true}).click();
    await expect(panel.getByRole('heading', {name:'Commun mobile', exact:true})).toBeVisible();
    expect(await panel.evaluate(p => p.shadowRoot.querySelector('.shell').scrollWidth <= p.clientWidth)).toBe(true);
  } finally {
    for (const id of ids.reverse()) {
      await panel.evaluate(async (p, id) => {
        if (p.data.budgets.some(b => b.id === id)) await p.hass.callWS({type:'autonomous_budget/mutate', action:'budget_delete', payload:{budget_id:id}, revision:p.data.revision});
      }, id);
      await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)).toBe(false);
    }
  }
});

for (const language of ['English', 'French']) {
  test(`${language} card blocks can each be shown alone, hidden, and restored from saved configuration`, async ({ page }) => {
    const panel = page.locator('autonomous-budget-panel');
    const id = await panel.evaluate(async p => (await p.hass.callWS({type:'autonomous_budget/mutate', action:'budget_create', payload:{name:'Card options test', currency:'CAD', account_balance:'1000'}, revision:p.data.revision})).id);
    await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)).toBe(true);
    try {
      await panel.evaluate(async (p, id) => {
        await customElements.whenDefined('autonomous-budget-card');
        await customElements.whenDefined('autonomous-budget-card-editor');
        const host = document.createElement('div');
        host.id = 'config-test-host';
        host.style = 'position:fixed;right:10px;top:10px;display:flex;gap:10px;z-index:2000;background:white;padding:12px';
        const card = document.createElement('autonomous-budget-card');
        card.style = 'width:380px;max-height:90vh;overflow:auto';
        const editor = document.createElement('autonomous-budget-card-editor');
        editor.style = 'width:330px;max-height:90vh;overflow:auto';
        const config = {type:'custom:autonomous-budget-card', budget_id:id, title:'My card'};
        card.setConfig(config); editor.setConfig(config);
        card.hass = editor.hass = p.hass;
        editor.addEventListener('config-changed', event => { host.saved = structuredClone(event.detail.config); card.setConfig(event.detail.config); });
        host.append(card, editor); document.body.append(host);
      }, id);
      const card = page.locator('autonomous-budget-card');
      const editor = page.locator('autonomous-budget-card-editor');
      await expect(card.getByRole('heading', {name:'My card'})).toBeVisible();
      await expect(card.locator('[data-section]')).toHaveCount(14);
      const keys = await editor.locator('input[type=checkbox]').evaluateAll(inputs => inputs.map(input => input.name));
      expect(keys).toHaveLength(14);
      expect(await editor.locator('input[type=checkbox]').evaluateAll((inputs, prefix) => inputs.every(input => input.parentElement.textContent.trim().startsWith(prefix)), language === 'French' ? 'Afficher' : 'Show')).toBe(true);
      for (const key of keys) await editor.locator(`input[name="${key}"]`).uncheck();
      await expect(card.locator('[data-section]')).toHaveCount(0);
      await expect(card.locator('ha-card')).toHaveText('');
      await card.evaluate(card => card.setConfig(JSON.parse(JSON.stringify(document.querySelector('#config-test-host').saved))));
      await expect(card.locator('[data-section]')).toHaveCount(0);
      for (const key of keys) {
        await editor.locator(`input[name="${key}"]`).check();
        await expect(card.locator('[data-section]')).toHaveCount(1);
        await expect(card.locator(`[data-section="${key}"]`)).toBeVisible();
        await editor.locator(`input[name="${key}"]`).uncheck();
      }
      for (const key of keys) await editor.locator(`input[name="${key}"]`).check();
      await expect(card.locator('[data-section]')).toHaveCount(14);
      await editor.locator('select[name="view"]').selectOption('cashflow');
      await expect(card.locator('[data-section="show_income"]')).toContainText(language === 'French' ? 'Revenus prévus' : 'Expected income');
      await expect(card.locator('[data-section="show_shared"]')).toContainText(language === 'French' ? 'Montant du commun' : 'Common budget amount');
      const saved = await page.locator('#config-test-host').evaluate(host => host.saved);
      expect(saved).toMatchObject({budget_id:id, title:'My card', view:'cashflow'});
      expect(keys.every(key => saved[key] === true)).toBe(true);
      // Old YAML that hid reserves must not unexpectedly reveal its child blocks.
      await card.evaluate((card, id) => card.setConfig({type:'custom:autonomous-budget-card', budget_id:id, show_reserves:false}), id);
      for (const key of ['show_reserves', 'show_available_balance', 'show_reserve_note']) await expect(card.locator(`[data-section="${key}"]`)).toHaveCount(0);
    } finally {
      await page.locator('#config-test-host').evaluate(host => host.remove()).catch(() => {});
      await panel.evaluate(async (p, id) => p.hass.callWS({type:'autonomous_budget/mutate', action:'budget_delete', payload:{budget_id:id}, revision:p.data.revision}), id);
      await expect.poll(() => panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)).toBe(false);
    }
  });
}

test('income-day expenses and common contributions stay visible but leave reserves, cards, and sensors', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  const ids = [];
  const today = await panel.evaluate(p => p.data.today);
  const shifted = days => { const day = new Date(`${today}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + days); return day.toISOString().slice(0, 10); };
  async function mutate(action, payload) {
    const {result, revision} = await panel.evaluate(async (p, {action, payload}) => {
      const revision = p.data.revision;
      const result = await p.hass.callWS({type:'autonomous_budget/mutate', action, payload, revision});
      return {result, revision};
    }, {action, payload});
    await expect.poll(() => panel.evaluate(p => p.data.revision)).toBeGreaterThan(revision);
    return result;
  }
  try {
    const personal = (await mutate('budget_create', {name:'Income date test', currency:'CAD', period:'biweekly', anchor:today, account_balance:'500', credit_balance:'20'})).id;
    ids.push(personal);
    const common = (await mutate('budget_create', {name:'Shared income date test', currency:'CAD', kind:'shared', allocations:[{budget_id:personal, percentage:'60'}]})).id;
    ids.push(common);
    const base = {direction:'expense', category:'mandatory', currency:'CAD', recurrence:'biweekly', renewal_date:today};
    await mutate('item_create', {...base, budget_id:common, name:'Common bill', amount:'100'});
    await mutate('item_create', {...base, budget_id:personal, name:'Direct debit', amount:'180', renewal_date:shifted(1)});
    await mutate('item_create', {...base, budget_id:personal, name:'Other bill', amount:'80', renewal_date:shifted(2)});
    const salary = (await mutate('item_create', {...base, budget_id:personal, name:'Salary', amount:'1000', direction:'income'})).id;
    const bonus = (await mutate('item_create', {...base, budget_id:personal, name:'Bonus', amount:'50', direction:'income', recurrence:'once', renewal_date:shifted(1)})).id;
    await panel.locator(`.budget-tab[data-id="${personal}"]`).click();
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 80.00');
    await expect(panel.locator('.available-summary strong')).toHaveText('CAD 400.00');
    const direct = panel.locator('.reserve-entry').filter({hasText:'Direct debit'});
    await expect(direct).toHaveClass(/excluded/);
    await expect(direct).toContainText('Paid with income');
    await expect(direct.locator('.reserve-amount')).toContainText('CAD 180.00');
    await expect(direct.getByRole('progressbar')).toHaveCount(0);
    await expect(panel.locator('.reserve-entry.excluded').filter({hasText:'Shared income date test'})).toContainText('CAD 60.00');
    await expect(panel.locator('tbody[data-group="mandatory"]')).toContainText('CAD 320.00');
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'reserved')?.state, personal)).toBe('-80.00');
    await panel.evaluate(async (p, id) => {
      await customElements.whenDefined('autonomous-budget-card');
      const card = document.createElement('autonomous-budget-card');
      card.setConfig({type:'custom:autonomous-budget-card', budget_id:id}); card.hass = p.hass;
      document.body.append(card);
    }, personal);
    const card = page.locator('autonomous-budget-card');
    await expect(card.locator('[data-section="show_reserves"]')).toContainText('-CAD 80.00');
    await expect(card.locator('[data-section="show_shared"]')).toContainText('CAD 60.00');
    await expect(card.locator('[data-section="show_available_balance"]')).toContainText('CAD 400.00');
    await expect(card.locator('[data-section="show_expenses"]')).toContainText('CAD 320.00');
    await card.evaluate(card => card.remove());
    await panel.getByRole('button', {name:'Next period', exact:true}).click();
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 80.00');
    await expect(direct).toContainText('Paid with income');
    await panel.getByRole('button', {name:'Previous period', exact:true}).click();
    await page.reload();
    await panel.locator(`.budget-tab[data-id="${personal}"]`).click();
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 80.00');
    await mutate('item_update', {...base, budget_id:personal, item_id:bonus, name:'Bonus', amount:'50', direction:'income', recurrence:'once', renewal_date:shifted(1), active:false});
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 260.00');
    await expect(direct).not.toHaveClass(/excluded/);
    await mutate('item_update', {...base, budget_id:personal, item_id:salary, name:'Salary', amount:'1000', direction:'income', active:false});
    await expect(panel.locator('.reserve-total')).toHaveText('-CAD 320.00');
    await expect(panel.locator('.available-summary strong')).toHaveText('CAD 160.00');
    await expect.poll(() => panel.evaluate((p, id) => Object.values(p.hass.states).find(s => s.attributes.budget_id === id && s.attributes.metric === 'reserved')?.state, personal)).toBe('-320.00');
  } finally {
    await page.locator('autonomous-budget-card').evaluateAll(cards => cards.forEach(card => card.remove()));
    for (const id of ids.reverse()) if (await panel.evaluate((p, id) => p.data.budgets.some(b => b.id === id), id)) await mutate('budget_delete', {budget_id:id});
  }
});
