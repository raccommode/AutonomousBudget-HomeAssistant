import { test, expect } from "@playwright/test";
import fs from "node:fs";
const tokens = JSON.parse(fs.readFileSync(".dev-ha/tokens.json", "utf8"));

for (const language of ["en", "fr"]) {
  test(`${language} coherent workspace, account search and accessible forms`, async ({
    page,
  }) => {
    if (language === "fr")
      await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      ({ tokens, language }) => {
        localStorage.setItem("hassTokens", JSON.stringify(tokens));
        localStorage.setItem("selectedLanguage", JSON.stringify(language));
      },
      { tokens, language },
    );
    await page.goto("/autonomous-budget");
    const app = page.locator("autonomous-budget-panel");
    await expect(app.locator("h1")).toHaveText("Budgets");
    const labels =
      language === "fr"
        ? [
            "Vue d’ensemble",
            "Comptes",
            "Placements",
            "Patrimoine",
            "Rapports",
            "Paramètres financiers",
          ]
        : [
            "Overview",
            "Accounts",
            "Investments",
            "Assets",
            "Reports",
            "Finance settings",
          ];
    const pages = [
      "overview",
      "accounts",
      "investments",
      "assets",
      "reports",
      "settings",
    ];
    const nav = app.locator("nav[aria-label]");
    for (const [index, key] of pages.entries()) {
      await nav.locator(`[data-page="${key}"]`).click();
      const panel = app.locator("autonomous-finance-panel");
      await expect(panel.locator(".page-header h1")).toHaveText(labels[index]);
      await expect(nav.locator(`[data-page="${key}"]`)).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(panel.locator(".page-heading p")).not.toBeEmpty();
      expect(
        await panel.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    await nav.locator('[data-page="accounts"]').click();
    let panel = app.locator("autonomous-finance-panel");
    await panel.locator('[data-action="account-new"]').click();
    const dialog = panel.locator("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[name="name"]')).toBeFocused();
    await expect(dialog.locator(".error")).toBeHidden();
    await expect(dialog.locator('[name="cost_method"]')).toBeHidden();
    await dialog.locator('[name="type"]').selectOption("investment");
    await expect(dialog.locator('[name="cost_method"]')).toBeVisible();
    await dialog.locator('[name="type"]').selectOption("savings");
    await expect(dialog.locator('[name="cost_method"]')).toBeHidden();
    await expect(dialog.locator('[name="publish_sensors"]')).toBeHidden();
    await dialog.locator("summary").click();
    await expect(dialog.locator('[name="publish_sensors"]')).toBeVisible();
    await expect(dialog.locator('[name="publish_sensors"]')).not.toBeChecked();
    if (language === "fr") {
      await expect(dialog.getByLabel("Nom", { exact: true })).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Enregistrer", exact: true }),
      ).toBeVisible();
    }
    await dialog.locator("summary").click();
    await page.screenshot({
      path: `docs/screenshot-account-form-${language}.png`,
    });
    const name = `Workspace ${language} ${Date.now()}`;
    await dialog.locator('[name="name"]').fill(name);
    await dialog.locator('[name="opening_date"]').fill("2026-01-01");
    await dialog.locator('[name="opening_balance"]').fill("1234.56");
    await dialog.locator('[type="submit"]').click();
    await expect(dialog).not.toBeVisible();
    await expect(panel.locator(".toast")).toBeVisible();
    await panel.locator('[name="account-search"]').fill(name);
    await expect(panel.locator(".account-card")).toHaveCount(1);
    await panel
      .locator('[name="account-type-filter"]')
      .selectOption("checking");
    await expect(panel.locator(".account-card")).toHaveCount(0);
    await expect(panel.locator("[data-account-list] .empty")).toBeVisible();
    await panel.locator('[name="account-type-filter"]').selectOption("savings");
    await expect(panel.locator(".account-card")).toHaveCount(1);
    await panel.locator('[data-action="account-open"]').click();
    await expect(panel.locator(".account-detail h2")).toHaveText(name);
    await panel.locator('[name="journal-search"]').fill("no matching entry");
    await panel.locator('[name="journal-search"]').press("Enter");
    await expect(panel.locator("tbody tr")).toHaveCount(0);
    await expect(panel.locator(".table .empty")).toBeVisible();
    // The reports remain compact on screen, while printing includes all sections.
    await nav.locator('[data-page="reports"]').click();
    await expect(panel.locator(".report-details")).toHaveCount(3);
    await expect(panel.locator(".report-details[open]")).toHaveCount(1);
    await panel.locator(".report-details").first().locator("summary").click();
    await expect(panel.locator(".report-details[open]")).toHaveCount(2);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(panel.locator(".report-details[open]")).toHaveCount(3);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(panel.locator(".report-details[open]")).toHaveCount(2);
    await nav.locator('[data-page="overview"]').click();
    await expect(panel.locator(".overview-hero .metric")).toBeVisible();
    await expect(panel.locator(".report-details")).toHaveCount(0);
    // Household metadata only: retain this fixture but archive it after the check.
    await app.evaluate(async (el, name) => {
      const request = (command, payload = {}) =>
        el.hass.callWS({ type: "autonomous_budget/finance", command, payload });
      const snapshot = await request("snapshot");
      const account = snapshot.objects.find(
        (o) => o.kind === "account" && o.name === name,
      );
      await request("save", { ...account, archived: true });
    }, name);
  });
}

for (const language of ["en", "fr"]) {
  test(`${language} personal overview and optional budget assignment`, async ({
    page,
  }) => {
    if (language === "fr")
      await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      ({ tokens, language }) => {
        localStorage.setItem("hassTokens", JSON.stringify(tokens));
        localStorage.setItem("selectedLanguage", JSON.stringify(language));
      },
      { tokens, language },
    );
    await page.goto("/autonomous-budget");
    const app = page.locator("autonomous-budget-panel");
    const budget = app.locator("autonomous-budget-view");
    await expect(app.locator("h1")).toBeVisible();
    const fixture = await app.evaluate(async (el) => {
      const call = (command, payload) =>
        el.hass.callWS({ type: "autonomous_budget/finance", command, payload });
      const account = await call("save", {
        kind: "account",
        name: "Personal overview fixture",
        currency: "CAD",
        opening_date: "2026-01-01",
        opening_balance: "123",
        assigned_user_id: el.hass.user.id,
      });
      const unassigned = await call("save", {
        kind: "account",
        name: "Unassigned overview fixture",
        currency: "CAD",
        opening_date: "2026-01-01",
        opening_balance: "900",
      });
      return { account, unassigned, user: el.hass.user.id };
    });
    let id;
    try {
      await budget.locator('[data-action="new-budget"]').click();
      await budget
        .locator('dialog [name="name"]')
        .fill("Assigned budget fixture");
      const select = budget.locator('dialog [name="assigned_user_id"]');
      await expect(select).toHaveValue("");
      if (language === "fr")
        await expect(budget.locator("dialog")).toContainText(
          "L’affectation détermine",
        );
      await select.selectOption(fixture.user);
      await budget
        .locator("dialog")
        .screenshot({ path: test.info().outputPath("budget-assignment.png") });
      await budget.locator('dialog button[type="submit"]').click();
      await expect(budget.locator("dialog")).toBeHidden();
      id = await budget.evaluate((el) => el.budget.id);
      const nav = app.locator("nav[aria-label]");
      await nav.locator('[data-page="overview"]').click();
      const finance = app.locator("autonomous-finance-panel");
      await expect(
        finance.locator(
          `[data-action="overview-account"][data-id="${fixture.account.id}"]`,
        ),
      ).toBeVisible();
      await expect(
        finance.locator(
          `[data-action="overview-account"][data-id="${fixture.unassigned.id}"]`,
        ),
      ).toHaveCount(0);
      const link = finance.locator(
        `[data-action="overview-budget"][data-id="${id}"]`,
      );
      await expect(link).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath("personal-overview.png"),
        fullPage: true,
      });
      await link.click();
      await expect(
        budget.locator(`.budget-tab[data-id="${id}"]`),
      ).toHaveAttribute("aria-current", "page");
      await budget.locator('[data-action="edit-budget"]').click();
      await expect(select).toHaveValue(fixture.user);
      await select.selectOption("");
      await budget.locator('dialog button[type="submit"]').click();
      await expect(budget.locator("dialog")).toBeHidden();
      await nav.locator('[data-page="overview"]').click();
      await expect(finance.locator(".overview-hero .metric")).toBeVisible();
      await expect(
        finance.locator(`[data-action="overview-budget"][data-id="${id}"]`),
      ).toHaveCount(0);
      // Clearing an assignment personalizes the overview; the shared budget still exists.
      const all = await app.evaluate((el) =>
        el.hass.callWS({
          type: "autonomous_budget/finance",
          command: "budgets",
        }),
      );
      expect(all.find((b) => b.id === id).assigned_user_id).toBeNull();
    } finally {
      await app.evaluate(
        async (el, { fixture, id }) => {
          for (const account of [fixture.account, fixture.unassigned])
            await el.hass.callWS({
              type: "autonomous_budget/finance",
              command: "save",
              payload: { ...account, archived: true },
            });
          if (id) {
            const view = el.shadowRoot.querySelector("autonomous-budget-view");
            await el.hass.callWS({
              type: "autonomous_budget/mutate",
              action: "budget_delete",
              payload: { budget_id: id },
              revision: view.data.revision,
            });
          }
        },
        { fixture, id },
      );
    }
  });
}
