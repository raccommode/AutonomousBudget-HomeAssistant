import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync('.dev-ha/tokens.json', 'utf8'));
test.beforeEach(async ({ page }) => {
  await page.addInitScript((tokens) => {
    localStorage.setItem('hassTokens', JSON.stringify(tokens));
    localStorage.setItem('selectedLanguage', '"en"');
  }, tokens);
  await page.goto('/autonomous-budget');
  await expect(page.locator('autonomous-budget-panel h1')).toHaveText('Your money, in view.');
  await expect(page.locator('#ha-launch-screen')).toHaveCount(0);
});

test('desktop panel, period navigation, and dashboard card', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await expect(panel.getByRole('cell', {name: /Netflix/}).first()).toBeVisible();
  await expect(panel.getByText('CAD 783.02', {exact: true})).toBeVisible();
  const period = await panel.locator('.period-title').innerText();
  await panel.getByRole('button', {name: 'Next period', exact: true}).click();
  await expect(panel.locator('.period-title')).not.toHaveText(period);
  await panel.getByRole('button', {name: 'Today', exact: true}).click();
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
  await expect(card.getByText('CAD 783.02', {exact: true})).toBeVisible();
  await card.screenshot({path: 'docs/screenshot-card.png'});
});

test('create, edit, currency conversion, pause, reload, and delete', async ({ page }) => {
  const panel = page.locator('autonomous-budget-panel');
  await panel.getByRole('button', {name: 'New budget', exact: true}).click();
  await panel.getByLabel('Budget name', {exact:true}).fill('Browser test budget');
  await panel.getByRole('button', {name: 'Create budget', exact:true}).click();
  await expect(panel.getByRole('heading', {name: 'Browser test budget'})).toBeVisible();
  await panel.getByRole('button', {name: 'Add entry', exact:true}).click();
  await panel.getByLabel('Entry name').fill('Foreign subscription');
  await panel.getByLabel('Amount', {exact:true}).fill('10.00');
  await panel.getByLabel('Currency', {exact:true}).selectOption('USD');
  await panel.getByLabel('Exchange rate to CAD').fill('1.35');
  await panel.getByRole('button', {name: 'Add entry', exact:true}).last().click();
  await expect(panel.locator('.stat .value').last()).toHaveText('CAD 13.50');
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
  await panel.getByRole('button', {name:'Settings', exact:true}).click();
  await expect(panel.getByLabel('Budget period')).toHaveValue('biweekly');
  await panel.getByLabel('Budget period').selectOption('weekly');
  await panel.getByRole('button', {name:'Save changes',exact:true}).click();
  await expect(panel.locator('.period-bar .badge')).toHaveText('Weekly');
  await panel.getByRole('button', {name:'Settings',exact:true}).click();
  await panel.getByLabel('Budget period').selectOption('biweekly');
  await panel.getByRole('button', {name:'Save changes',exact:true}).click();
});
