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
  await expect(panel.locator('.reserve-total')).toHaveText('CAD 120.00');
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
    {metric: 'reserved', state: '120.00'},
    {metric: 'available_balance', state: '-40.00'},
  ]));
  const entityInfo = await panel.evaluate(async el => {
    const state = Object.values(el.hass.states).find(state => state.attributes.budget_id === el.budget.id && state.attributes.metric === 'reserved');
    const registry = await el.hass.callWS({type:'config/entity_registry/list'});
    return {state, registration: registry.find(entity => entity.entity_id === state.entity_id)};
  });
  expect(entityInfo.state.state).toBe('120.00');
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
    editor.style = 'position:fixed;right:20px;top:80px;padding:20px;width:330px;background:white;z-index:1000';
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
