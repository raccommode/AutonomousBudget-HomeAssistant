import { test, expect } from "@playwright/test";
import fs from "node:fs";
const tokens = JSON.parse(fs.readFileSync(".dev-ha/tokens.json", "utf8"));
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(
    ({ tokens, language }) => {
      localStorage.setItem("hassTokens", JSON.stringify(tokens));
      localStorage.setItem("selectedLanguage", JSON.stringify(language));
    },
    { tokens, language: info.title.startsWith("French") ? "fr" : "en" },
  );
  await page.goto("/autonomous-budget");
  await expect(page.locator("autonomous-budget-panel h1")).toBeVisible();
});
test("finance journal, reconciliation and household card", async ({ page }) => {
  const app = page.locator("autonomous-budget-panel");
  await app.getByRole("button", { name: "Accounts", exact: true }).click();
  const finance = page.locator("autonomous-finance-panel");
  await expect(
    finance.getByRole("heading", { name: "Accounts", exact: true }),
  ).toBeVisible();
  const name = "Finance browser " + Date.now();
  await finance
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await finance.getByLabel("Name", { exact: true }).fill(name);
  await finance.getByLabel("Opening date", { exact: true }).fill("2026-01-01");
  await finance.getByLabel("Opening balance", { exact: true }).fill("1000");
  await finance.getByRole("button", { name: "Save", exact: true }).click();
  const box = finance.locator("section.box").filter({ hasText: name });
  await expect(box).toContainText("CAD 1,000.00");
  await box.getByRole("button", { name: "Transactions", exact: true }).click();
  await finance
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await finance.getByLabel("Date", { exact: true }).fill("2026-09-01");
  await finance.getByLabel("Amount", { exact: true }).fill("-25");
  await finance.getByLabel("Payee", { exact: true }).fill("Market");
  await finance.getByLabel("Status", { exact: true }).selectOption("cleared");
  await finance.getByRole("button", { name: "Save", exact: true }).click();
  await expect(finance.locator("tbody")).toContainText("Market");
  await expect(finance.locator(".metric")).toHaveText("CAD 975.00");
  await finance.getByRole("button", { name: "Reconcile", exact: true }).click();
  await finance.getByLabel("Statement date").fill("2026-09-02");
  await finance.getByLabel("Statement balance").fill("975");
  await finance.getByRole("button", { name: "Save", exact: true }).click();
  await expect(finance.locator("tbody")).toContainText("Reconciled");
  const snapshot = await finance.evaluate((el) => el.api("snapshot"));
  const account = snapshot.objects.find((o) => o.name === name);
  expect(account.publish_sensors).toBe(false);
  await app.evaluate(async (el, accountId) => {
    await customElements.whenDefined("autonomous-finance-card");
    const card = document.createElement("autonomous-finance-card");
    card.setConfig({
      type: "custom:autonomous-finance-card",
      account_id: accountId,
    });
    card.hass = el.hass;
    document.body.append(card);
  }, account.id);
  await expect(page.locator("autonomous-finance-card")).toContainText(
    "CAD 975.00",
  );
  await page.locator("autonomous-finance-card").evaluate((el) => el.remove());
  await finance.evaluate(async (el, account) => {
    await el.api("save", { ...account, name: "Everyday account" });
    await el.load();
  }, account);
  await page.screenshot({
    path: "docs/screenshot-accounts.png",
    fullPage: true,
  });
  await app.getByRole("button", { name: "Investments", exact: true }).click();
  await expect(
    finance.getByRole("heading", { name: "Investments", exact: true }),
  ).toBeVisible();
  await app.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(
    finance.getByRole("heading", { name: "Assets", exact: true }),
  ).toBeVisible();
  await app.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    finance.getByRole("heading", { name: "Net worth", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshot-reports.png",
    fullPage: true,
  });
  await app
    .getByRole("button", { name: "Finance settings", exact: true })
    .click();
  await expect(
    finance.getByRole("heading", { name: "Lunch Flow", exact: true }),
  ).toBeVisible();
  try {
    await finance
      .getByRole("button", { name: "Customize", exact: true })
      .click();
    await finance.getByLabel("Budgets", { exact: true }).uncheck();
    await finance.getByLabel("Accounts", { exact: true }).uncheck();
    await finance.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      app
        .getByRole("navigation", { name: "Finance navigation" })
        .getByRole("button", { name: "Budgets", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      app
        .getByRole("navigation", { name: "Finance navigation" })
        .getByRole("button", { name: "Accounts", exact: true }),
    ).toHaveCount(0);
    const saved = await app.evaluate((el) =>
      el.hass.callWS({
        type: "autonomous_budget/finance",
        command: "snapshot",
      }),
    );
    expect(saved.objects.some((o) => o.id === account.id)).toBe(true);
  } finally {
    await app.evaluate((el) =>
      el.hass.callWS({
        type: "autonomous_budget/finance",
        command: "save",
        payload: { kind: "preferences", currency: "CAD", modules: {} },
      }),
    );
  }
});
test("French finance forms and mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = page.locator("autonomous-budget-panel");
  await app.getByRole("button", { name: "Comptes", exact: true }).click();
  const f = page.locator("autonomous-finance-panel");
  await expect(
    f.getByRole("heading", { name: "Comptes", exact: true }),
  ).toBeVisible();
  await f
    .getByRole("button", { name: "Ajouter un compte", exact: true })
    .click();
  await expect(f.getByLabel("Solde initial", { exact: true })).toBeVisible();
  await expect(f.getByLabel("Devise", { exact: true })).toBeVisible();
  await f.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(f).toHaveJSProperty(
    "scrollWidth",
    await f.evaluate((el) => el.clientWidth),
  );
  await page.screenshot({
    path: "docs/screenshot-finance-fr.png",
    fullPage: true,
  });
});

test("investment operation and CSV import use the real finance backend", async ({
  page,
}) => {
  const app = page.locator("autonomous-budget-panel");
  await app.getByRole("button", { name: "Accounts", exact: true }).click();
  const f = page.locator("autonomous-finance-panel");
  const fixture = await f.evaluate(async (el) => {
    const acc = await el.api("save", {
      kind: "account",
      name: "Investment example",
      type: "investment",
      currency: "CAD",
      opening_date: "2026-01-01",
      opening_balance: "1000",
    });
    const instrument = await el.api("save", {
      kind: "instrument",
      name: "Example ETF",
      symbol: "EXAMPLE",
      currency: "CAD",
      provider: "manual",
    });
    return { acc, instrument };
  });
  await app.getByRole("button", { name: "Investments", exact: true }).click();
  await f
    .locator(`[data-action="portfolio-open"][data-id="${fixture.acc.id}"]`)
    .click();
  await f
    .getByRole("button", { name: "Record an operation", exact: true })
    .click();
  await f
    .getByLabel("Instrument", { exact: true })
    .selectOption(fixture.instrument.id);
  await f.getByLabel("Date", { exact: true }).fill("2026-09-01");
  await f.getByLabel("Quantity", { exact: true }).fill("10");
  await f.getByLabel("Price / income amount", { exact: true }).fill("12");
  await f.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    f.getByRole("heading", { name: "Investment history" }),
  ).toBeVisible();
  await expect(f.locator("tbody").first()).toContainText("CAD 120.00");
  await f.evaluate(async (el, { instrument }) => {
    await el.api("provider_quote", {
      instrument_id: instrument.id,
      source: "manual",
      date: "2026-09-01",
      value: "15",
    });
    await el.load();
  }, fixture);
  await expect(f.locator("tbody").first()).toContainText("CAD 150.00");
  await page.screenshot({
    path: "docs/screenshot-investments.png",
    fullPage: true,
  });
  await app.getByRole("button", { name: "Accounts", exact: true }).click();
  await f
    .locator(`[data-action="account-open"][data-id="${fixture.acc.id}"]`)
    .click();
  await f.getByRole("button", { name: "Import", exact: true }).click();
  await f.locator("input[type=file]").setInputFiles({
    name: "sample.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,amount,payee\n2026-09-02,-5,Account fee\n"),
  });
  await f.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    f.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  await f
    .locator("dialog")
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await expect(
    f.getByRole("row").filter({ hasText: "Account fee" }),
  ).toBeVisible();
  await expect(f.locator("dialog")).not.toBeVisible();
  await f.getByRole("button", { name: "Import", exact: true }).click();
  await f.locator('input[type="file"]').setInputFiles({
    name: "paged.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date,amount,payee\n" +
        Array.from(
          { length: 205 },
          (_, i) => `2026-09-02,-0.01,Preview entry ${i}`,
        ).join("\n"),
    ),
  });
  await f.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = f.locator("dialog");
  await expect(dialog.locator('input[name^="line:"]')).toHaveCount(100);
  await dialog.locator('input[name="line:2"]').uncheck();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.locator('input[name="line:102"]').uncheck();
  await dialog.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(dialog.locator('input[name="line:2"]')).not.toBeChecked();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.locator('input[name^="line:"]')).toHaveCount(5);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const imported = await f.evaluate(
    (el, id) => el.api("transactions", { account_id: id, limit: 500 }),
    fixture.acc.id,
  );
  expect(imported.total).toBe(205);
  expect(
    imported.rows.some(
      (t) => t.payee === "Preview entry 0" || t.payee === "Preview entry 100",
    ),
  ).toBe(false);
});

test("Home Assistant members see and edit accounts while creation requires admin", async ({
  page,
  browser,
  request,
}) => {
  const app = page.locator("autonomous-budget-panel");
  const fixture = await app.evaluate(async (el) => {
    const user = (
      await el.hass.callWS({
        type: "config/auth/create",
        name: "Finance reader test",
        group_ids: ["system-users"],
        local_only: true,
      })
    ).user;
    const username = "finance-reader-" + user.id;
    const password = crypto.randomUUID();
    await el.hass.callWS({
      type: "config/auth_provider/homeassistant/create",
      user_id: user.id,
      username,
      password,
    });
    const account = await el.hass.callWS({
      type: "autonomous_budget/finance",
      command: "save",
      payload: {
        kind: "account",
        name: "Household access test",
        assigned_user_id: user.id,
        type: "checking",
        currency: "CAD",
        opening_date: "2026-01-01",
        opening_balance: "321",
      },
    });
    return { user, username, password, account };
  });
  let context, linkedBudget;
  try {
    const base = "http://127.0.0.1:8128";
    const client = base + "/";
    let response = await request.post(base + "/auth/login_flow", {
      data: {
        client_id: client,
        redirect_uri: client,
        handler: ["homeassistant", null],
      },
    });
    const flow = await response.json();
    response = await request.post(base + "/auth/login_flow/" + flow.flow_id, {
      data: {
        client_id: client,
        username: fixture.username,
        password: fixture.password,
      },
    });
    const login = await response.json();
    response = await request.post(base + "/auth/token", {
      form: {
        grant_type: "authorization_code",
        client_id: client,
        code: login.result,
      },
    });
    const readerTokens = {
      ...(await response.json()),
      hassUrl: base,
      clientId: client,
    };
    readerTokens.expires = Date.now() + readerTokens.expires_in * 1000;
    context = await browser.newContext();
    await context.addInitScript((tokens) => {
      localStorage.setItem("hassTokens", JSON.stringify(tokens));
      localStorage.setItem("selectedLanguage", '"en"');
    }, readerTokens);
    const reader = await context.newPage();
    await reader.goto(base + "/autonomous-budget");
    const other = reader.locator("autonomous-budget-panel");
    await expect(other.locator("h1")).toBeVisible();
    const read = () =>
      other.evaluate(async (el, id) => {
        try {
          return await el.hass.callWS({
            type: "autonomous_budget/finance",
            command: "transactions",
            payload: { account_id: id },
          });
        } catch (e) {
          return { denied: e.message };
        }
      }, fixture.account.id);
    expect((await read()).total).toBe(0);
    await other.getByRole("button", { name: "Accounts", exact: true }).click();
    const memberPanel = reader.locator("autonomous-finance-panel");
    await expect(
      memberPanel.locator('[data-action="account-new"]'),
    ).toHaveCount(0);
    await memberPanel
      .locator(`[data-action="account-edit"][data-id="${fixture.account.id}"]`)
      .click();
    await expect(
      memberPanel.locator('dialog [name="assigned_user_id"]'),
    ).toHaveValue(fixture.user.id);
    await memberPanel.locator('dialog [data-action="close"]').click();
    const restoreDenied = await memberPanel.evaluate(async (el) => {
      try {
        await el.api("restore", { backup: {} });
        return false;
      } catch (error) {
        return error.message.includes("administrator");
      }
    });
    expect(restoreDenied).toBe(true);
    const access = await other.evaluate(async (el, account) => {
      const call = (command, payload) =>
        el.hass.callWS({ type: "autonomous_budget/finance", command, payload });
      await call("transaction", {
        account_id: account.id,
        date: "2026-09-01",
        amount: "1",
      });
      const updated = await call("save", {
        kind: "account",
        id: account.id,
        name: "Member edited account",
        assigned_user_id: null,
      });
      const denied = [];
      for (const [command, payload] of [
        [
          "save",
          {
            kind: "account",
            name: "Forbidden",
            currency: "CAD",
            opening_date: "2026-01-01",
          },
        ],
        [
          "provider_create_account",
          { connection_id: "missing", remote_id: "42", account: {} },
        ],
        [
          "save",
          { kind: "connection", name: "Forbidden", api_key: "fictional" },
        ],
      ]) {
        try {
          await call(command, payload);
          denied.push(false);
        } catch (e) {
          denied.push(e.message.includes("administrator"));
        }
      }
      return { updated, denied };
    }, fixture.account);
    expect(access.updated.name).toBe("Member edited account");
    expect(access.updated.assigned_user_id).toBeNull();
    expect(access.denied).toEqual([true, true, true]);
    expect((await read()).total).toBe(1);
    const exportData = await other.evaluate((el) =>
      el.hass.callWS({ type: "autonomous_budget/finance", command: "export" }),
    );
    expect(JSON.stringify(exportData)).toContain(fixture.account.id);
    linkedBudget = await app.evaluate(async (el, account) => {
      const view = el.shadowRoot.querySelector("autonomous-budget-view");
      const budget = await el.hass.callWS({
        type: "autonomous_budget/mutate",
        action: "budget_create",
        payload: { name: "Private linked test", currency: "CAD" },
        revision: view.data.revision,
      });
      return { budget, account };
    }, fixture.account);
    const reserveEntity = () =>
      app.evaluate(
        (el, budgetId) =>
          Object.values(el.hass.states).find(
            (s) =>
              s.attributes.budget_id === budgetId &&
              s.attributes.metric === "reserved",
          )?.entity_id,
        linkedBudget.budget.id,
      );
    await expect.poll(reserveEntity).toBeTruthy();
    linkedBudget.entity = await reserveEntity();
    linkedBudget.link = await app.evaluate(
      (el, data) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "save",
          payload: {
            kind: "budget_link",
            account_id: data.account.id,
            budget_id: data.budget.id,
            percentage: "100",
          },
        }),
      linkedBudget,
    );
    await expect
      .poll(() =>
        app.evaluate(
          (el, id) => el.hass.states[id]?.state,
          linkedBudget.entity,
        ),
      )
      .toBe("unavailable");
    const visibleBudgets = await other.evaluate((el) =>
      el.hass.callWS({ type: "autonomous_budget/finance", command: "budgets" }),
    );
    expect(visibleBudgets.some((b) => b.id === linkedBudget.budget.id)).toBe(
      true,
    );
    const hiddenState = await other.evaluate(
      (el, id) => el.hass.states[id],
      linkedBudget.entity,
    );
    expect(hiddenState.attributes.budget_id).toBeUndefined();
    const publishedEntity = () =>
      app.evaluate(async (el, id) => {
        const registry = await el.hass.callWS({
          type: "config/entity_registry/list",
        });
        return registry.find((e) => e.unique_id === "finance_" + id)?.entity_id;
      }, fixture.account.id);
    expect(await publishedEntity()).toBeUndefined();
    await app.evaluate(
      (el, account) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "save",
          payload: { ...account, publish_sensors: true },
        }),
      fixture.account,
    );
    await expect.poll(publishedEntity).toBeTruthy();
    const entity = await publishedEntity();
    const readerState = await other.evaluate(
      async (el, id) =>
        (await el.hass.callWS({ type: "get_states" })).find(
          (s) => s.entity_id === id,
        ),
      entity,
    );
    expect(Number(readerState.state)).toBe(322);
    await app.evaluate(
      (el, account) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "save",
          payload: { ...account, publish_sensors: false },
        }),
      fixture.account,
    );
    await expect.poll(publishedEntity).toBeUndefined();
  } finally {
    if (linkedBudget)
      await app.evaluate(async (el, data) => {
        if (data.link)
          await el.hass.callWS({
            type: "autonomous_budget/finance",
            command: "delete",
            payload: { id: data.link.id },
          });
        const view = el.shadowRoot.querySelector("autonomous-budget-view");
        await el.hass.callWS({
          type: "autonomous_budget/mutate",
          action: "budget_delete",
          payload: { budget_id: data.budget.id },
          revision: view.data.revision,
        });
      }, linkedBudget);
    await context?.close();
    await app.evaluate(
      (el, userId) =>
        el.hass.callWS({ type: "config/auth/delete", user_id: userId }),
      fixture.user.id,
    );
  }
});

for (const language of ["English", "French"]) {
  test(`${language} Lunch Flow linking belongs to account creation`, async ({
    page,
  }) => {
    if (language === "French")
      await page.setViewportSize({ width: 390, height: 844 });
    const app = page.locator("autonomous-budget-panel");
    const navigation = (key) =>
      app.getByRole("button", {
        name:
          language === "French"
            ? { accounts: "Comptes", settings: "Paramètres financiers" }[key]
            : { accounts: "Accounts", settings: "Finance settings" }[key],
        exact: true,
      });
    await navigation("accounts").click();
    const f = page.locator("autonomous-finance-panel");
    // With no connected provider, account creation has no Lunch Flow fields.
    await f.evaluate((el) => {
      el.records = el.records.filter((o) => o.kind !== "connection");
      el.render();
    });
    await f.locator('[data-action="account-new"]').click();
    await expect(f.locator("dialog")).toBeVisible();
    await expect(f.locator('dialog [name="assigned_user_id"]')).toBeVisible();
    await expect(f.locator('dialog [name="lunchflow_connection"]')).toHaveCount(
      0,
    );
    await f.locator('dialog [data-action="close"]').click();
    const ids = await f.evaluate(async (el) => {
      const original = el.api.bind(el);
      const first = await original("save", {
        kind: "connection",
        name: "First bank",
        api_key: "fictional-browser-key",
      });
      const second = await original("save", {
        kind: "connection",
        name: "Second bank",
        api_key: "fictional-browser-key",
      });
      el.testMappings = [];
      el.testProviderCalls = [];
      el.testAccount = null;
      el.api = async (command, payload, mutate) => {
        if (command === "provider_accounts") {
          el.testProviderCalls.push({ command, payload });
          return {
            accounts: [
              {
                id: payload.connection_id === first.id ? 41 : 42,
                name:
                  payload.connection_id === first.id
                    ? "Remote first"
                    : "Remote second",
                currency: "CAD",
                institution_name: "Example institution",
              },
            ],
          };
        }
        if (command === "provider_create_account") {
          el.testProviderCalls.push({ command, payload });
          const account = await original("save", payload.account);
          el.testAccount = account;
          const mapping = {
            id: "browser-mapping",
            kind: "mapping",
            connection_id: payload.connection_id,
            account_id: account.id,
            remote_id: payload.remote_id,
            remote_name: "Remote second",
          };
          el.testMappings = [mapping];
          return mapping;
        }
        if (command === "provider_unmap") {
          el.testProviderCalls.push({ command, payload });
          el.testMappings = [];
          return {};
        }
        const result = await original(command, payload, mutate);
        if (command === "snapshot") {
          result.objects = result.objects.filter(
            (o) =>
              o.kind !== "connection" || [first.id, second.id].includes(o.id),
          );
          result.objects.push(...el.testMappings);
          for (const mapping of el.testMappings) {
            const acc = result.objects.find((o) => o.id === mapping.account_id);
            if (acc)
              Object.assign(acc, {
                bank_amount: "800.00",
                bank_checked: "2026-09-07",
                bank_balance_status: "ok",
              });
          }
        }
        return result;
      };
      await el.load();
      return { first: first.id, second: second.id };
    });
    await navigation("settings").click();
    await expect(f.locator('[data-action="mapping"]')).toHaveCount(0);
    const connection = f.locator(`[data-connection-id="${ids.second}"]`);
    await connection.locator('[data-action="connection-rename"]').click();
    await f.locator('dialog [name="name"]').fill("Renamed second bank");
    await f.locator('dialog [type="submit"]').click();
    await expect(connection.locator("h3")).toHaveText("Renamed second bank");
    await navigation("accounts").click();
    await f.locator('[data-action="account-new"]').click();
    const selector = f.locator('dialog [name="lunchflow_connection"]');
    await expect(selector.locator("option")).toHaveCount(3);
    await expect(f.locator('dialog [name="lunchflow_remote"]')).toHaveCount(0);
    await selector.selectOption(ids.first);
    await f.locator('dialog [name="lunchflow_remote"]').selectOption("41");
    await expect(f.locator('dialog [name="name"]')).toHaveValue("Remote first");
    await selector.selectOption(ids.second);
    await expect(f.locator('dialog [name="lunchflow_remote"]')).toHaveValue("");
    await expect(
      f.locator('dialog [name="lunchflow_remote"] option[value="41"]'),
    ).toHaveCount(0);
    await f.locator('dialog [name="lunchflow_remote"]').selectOption("42");
    await f.locator('dialog [name="name"]').fill("Local brokerage");
    await f.locator('dialog [name="type"]').selectOption("investment");
    await expect(f.locator('dialog [name="from"]')).toHaveCount(0);
    await f.locator('dialog [type="submit"]').click();
    await expect(f.locator("dialog")).not.toBeVisible();
    const mapping = f.locator(
      '.mapping-row[data-mapping-id="browser-mapping"]',
    );
    await expect(mapping).toContainText("Renamed second bank");
    await expect(mapping).toContainText("Remote second");
    await expect(mapping).toContainText("Local brokerage");
    const calls = await f.evaluate((el) => el.testProviderCalls);
    const created = calls.find((c) => c.command === "provider_create_account");
    expect(created.payload).toMatchObject({
      connection_id: ids.second,
      remote_id: "42",
      account: { name: "Local brokerage", type: "investment" },
    });
    expect(created.payload.account).not.toHaveProperty("lunchflow_connection");
    await mapping.screenshot({
      path: `/tmp/autonomous-account-link-${language.toLowerCase()}.png`,
    });
    await expect(mapping.locator('[data-action="mapping-remove"]')).toHaveCount(
      0,
    );
    const accountBox = f.locator("section.box").filter({
      has: page.locator('.mapping-row[data-mapping-id="browser-mapping"]'),
    });
    await expect(accountBox.locator(".metric")).toContainText("800");
    await expect(accountBox).toContainText(
      language === "French" ? "Solde du journal" : "Ledger balance",
    );
    await accountBox.locator('[data-action="account-edit"]').click();
    await expect(f.locator("dialog")).toBeVisible();
    await f.locator('dialog [name="unlink_lunchflow"]').check();
    await f.locator('dialog [data-action="close"]').click();
    await expect(mapping).toBeVisible();
    await accountBox.locator('[data-action="account-edit"]').click();
    await expect(f.locator("dialog")).toBeVisible();
    await f.locator('dialog [name="unlink_lunchflow"]').check();
    await f.locator('dialog [type="submit"]').click();
    await expect(f.locator("dialog")).not.toBeVisible();
    await expect(mapping).toHaveCount(0);
    await f.evaluate(async (el, ids) => {
      for (const id of [ids.first, ids.second])
        await el.api("provider_disconnect", { connection_id: id });
      await el.load();
    }, ids);
    await f.locator('[data-action="account-new"]').click();
    await expect(f.locator("dialog")).toBeVisible();
    await expect(f.locator('dialog [name="assigned_user_id"]')).toBeVisible();
    await expect(f.locator('dialog [name="lunchflow_connection"]')).toHaveCount(
      0,
    );
    await f.locator('dialog [data-action="close"]').click();
  });
}
