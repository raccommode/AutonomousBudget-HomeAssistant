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
test("finance journal, reconciliation and private card", async ({ page }) => {
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
});

test("separate Home Assistant user cannot read private accounts and loses revoked access", async ({
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
        name: "Private privacy test",
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
    expect((await read()).denied).toContain("Access denied");
    await app.evaluate(
      async (el, { account, user }) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "save",
          payload: { ...account, sharing: { [user.id]: "read" } },
        }),
      fixture,
    );
    expect((await read()).total).toBe(0);
    const edit = await other.evaluate(async (el, id) => {
      try {
        await el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "transaction",
          payload: { account_id: id, date: "2026-09-01", amount: "1" },
        });
        return false;
      } catch {
        return true;
      }
    }, fixture.account.id);
    expect(edit).toBe(true);
    await app.evaluate(
      async (el, { account }) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "save",
          payload: { ...account, sharing: {} },
        }),
      fixture,
    );
    expect((await read()).denied).toContain("Access denied");
    const exportData = await other.evaluate((el) =>
      el.hass.callWS({ type: "autonomous_budget/finance", command: "export" }),
    );
    expect(JSON.stringify(exportData)).not.toContain(fixture.account.id);
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
      false,
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
    expect(Number(readerState.state)).toBe(321);
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
