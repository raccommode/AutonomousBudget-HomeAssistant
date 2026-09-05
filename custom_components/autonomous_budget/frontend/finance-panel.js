import { BudgetLiveElement, baseCSS, esc, money } from "./shared.js?v=1.0.2";

const names = {
  overview: "Overview",
  stock: "Stock",
  etf: "ETF",
  fund: "Fund",
  bond: "Bond",
  crypto: "Cryptocurrency",
  transfer_in: "Security transfer in",
  transfer_out: "Security transfer out",
  budgets: "Budgets",
  accounts: "Accounts",
  investments: "Investments",
  assets: "Assets",
  reports: "Reports",
  settings: "Finance settings",
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit: "Credit card",
  loan: "Loan",
  investment: "Investment",
  unmarked: "Unmarked",
  cleared: "Cleared",
  reconciled: "Reconciled",
  pending: "Pending",
  average: "Average cost",
  fifo: "FIFO",
  buy: "Buy",
  sell: "Sell",
  opening: "Opening position",
  dividend: "Dividend",
  interest: "Interest",
  coupon: "Coupon",
  reinvest: "Reinvest",
  split: "Stock split",
  transfer: "Transfer",
  yahoo: "Yahoo Finance",
  coingecko: "CoinGecko",
  manual: "Manual",
  read: "Read",
  write: "Edit",
  none: "Private",
  monthly: "Monthly",
  biweekly: "Every two weeks",
  weekly: "Weekly",
  yearly: "Yearly",
  once: "One time",
};
const CSS = `${baseCSS}
:host{display:block;background:var(--ab-bg);min-height:100%;padding:28px 36px}.heading,.toolbar,.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.heading{justify-content:space-between;margin-bottom:24px}.toolbar{margin:16px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.box{border:1px solid var(--ab-line);border-radius:14px;background:var(--ab-surface);padding:22px;margin-bottom:18px}.metric{font-size:28px;margin:10px 0;overflow-wrap:anywhere}.muted{color:var(--ab-muted)}.badge{background:var(--ab-pale);border-radius:8px;padding:3px 8px;font-size:12px}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--ab-line);white-space:nowrap}th{color:var(--ab-muted)}.negative{color:#be5141}.positive{color:var(--ab-green)}input,select,textarea{background:var(--ab-surface);color:var(--ab-text);border:1px solid var(--ab-line);border-radius:7px;padding:10px;max-width:100%;min-width:0;font:inherit}label{display:grid;gap:6px;font-size:13px}.form{display:grid;grid-template-columns:1fr 1fr;gap:15px}.full{grid-column:1/-1}.dialog{border:1px solid var(--ab-line);border-radius:15px;background:var(--ab-surface);color:var(--ab-text);padding:25px;width:min(760px,calc(100% - 24px));max-height:90dvh;overflow:auto}.dialog::backdrop{background:#102d2377}.dialog h2{margin-bottom:20px}.dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.error{color:#be5141;margin:12px 0}.empty{padding:45px;text-align:center}.chart{display:flex;align-items:end;gap:14px;height:180px;margin:24px 0}.column{flex:1;min-width:24px;text-align:center;font-size:11px}.bar{background:var(--ab-green);border-radius:5px 5px 0 0;min-height:2px}.splits{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px}.numbers{text-align:right;font-variant-numeric:tabular-nums}.wrap{white-space:normal;max-width:320px}.danger{color:#be5141}.text-link{border:0;background:none;padding:3px;text-decoration:underline}.notice{padding:14px;background:var(--ab-pale);border-radius:8px;margin-bottom:15px}details{margin:15px 0}summary{cursor:pointer;font-weight:600}@media(max-width:650px){:host{padding:18px 12px}.form{grid-template-columns:1fr}.full{grid-column:auto}.splits{grid-template-columns:1fr 1fr}.metric{font-size:23px}}@media print{.toolbar,button,.dialog{display:none!important}:host{background:white;padding:0}.box{break-inside:avoid}.table{overflow:visible}table{font-size:10px}}`;

export class FinancePanel extends BudgetLiveElement {
  constructor() {
    super();
    this.page = "accounts";
    this.records = [];
    this.filters = {};
    this.selected = null;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><main></main><dialog class="dialog"></dialog>`;
    this.shadowRoot.addEventListener("click", (e) => this.click(e));
  }
  today() {
    return (
      this.data?.today ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: this.hass?.config?.time_zone,
      }).format(new Date())
    );
  }
  async api(command, payload = {}, mutate = false) {
    if (["import_preview", "import", "restore"].includes(command)) {
      const response = await this.hass.fetchWithAuth(
        "/api/autonomous_budget/finance_file",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command,
            payload,
            ...(mutate ? { revision: this.revision } : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "File operation failed.");
      return data;
    }

    return this.hass.callWS({
      type: "autonomous_budget/finance",
      command,
      payload,
      ...(mutate ? { revision: this.revision } : {}),
    });
  }
  async subscribe() {
    this._unsubscribe?.();
    const generation = ++this._generation;
    try {
      const unsub = await this.hass.connection.subscribeMessage(
        () => this.load(),
        { type: "autonomous_budget/finance_subscribe" },
      );
      if (generation !== this._generation) {
        unsub();
        return;
      }
      this._unsubscribe = unsub;
    } catch (e) {
      this.error = e.message;
      this.render();
    }
  }
  async load() {
    const generation = (this.loadGeneration || 0) + 1;
    this.loadGeneration = generation;
    try {
      const data = await this.api("snapshot");
      if (generation !== this.loadGeneration) return;
      this.records = data.objects;
      this.revision = data.revision;
      this.prefs = this.records.find((o) => o.kind === "preferences") || {};
      this.unit = this.prefs.currency || "CAD";
      this.data = data;
      this.budgets = await this.api("budgets");
      this.error = null;
      if (
        this.selected &&
        !this.list("account").some((a) => a.id === this.selected)
      )
        this.selected = null;
      await this.loadPage();
      this.dispatchEvent(
        new CustomEvent("finance-preferences", {
          detail: this.prefs,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e.message;
      this.render();
    }
  }
  async loadPage() {
    const generation = (this.pageGeneration || 0) + 1;
    this.pageGeneration = generation;
    const page = this.page,
      selected = this.selected;
    try {
      let data = {};
      if (page === "accounts" && selected)
        data.journal = await this.api("transactions", {
          account_id: selected,
          ...this.filters,
        });
      if (["overview", "reports", "assets"].includes(page))
        data.report = await this.api("reports", {
          currency: this.unit,
          ...this.reportFilters,
        });
      if (page === "investments" && selected) {
        data.positions = await this.api("portfolio", { account_id: selected });
        data.trades = await this.api("trades", {
          account_id: selected,
          offset: this.tradeOffset || 0,
          limit: 100,
        });
      }
      if (generation !== this.pageGeneration) return;
      Object.assign(this, data);
      this.render();
    } catch (e) {
      if (generation !== this.pageGeneration) return;
      this.error = e.message;
      this.render();
    }
  }
  setPage(page) {
    this.page = page;
    this.selected = null;
    this.filters = {};
    this.loadPage();
  }
  list(kind) {
    return this.records.filter((o) => o.kind === kind);
  }
  obj(id) {
    return this.records.find((o) => o.id === id);
  }
  m(value, unit = this.unit) {
    return value === null || value === undefined
      ? "—"
      : money(value, unit, this.language);
  }
  button(action, text, id = "", primary = false) {
    return `<button type="button" ${primary ? 'class="primary"' : ""} data-action="${action}" data-id="${esc(id)}">${esc(text)}</button>`;
  }
  opts(rows, selected, empty = true) {
    return `${empty ? '<option value="">—</option>' : ""}${rows
      .map((row) => {
        const [id, name] = Array.isArray(row) ? row : [row.id, row.name];
        return `<option value="${esc(id)}" ${id === selected ? "selected" : ""} translate="no">${esc(name)}</option>`;
      })
      .join("")}`;
  }
  field(
    key,
    text,
    value = "",
    type = "text",
    choices = null,
    required = false,
  ) {
    return `<label><span>${esc(text)}</span>${choices ? `<select name="${key}" aria-label="${esc(text)}">${this.opts(choices, value, !required)}</select>` : `<input name="${key}" aria-label="${esc(text)}" type="${type}" value="${esc(value ?? "")}" ${required ? "required" : ""} ${type === "number" ? 'step="any"' : ""}>`}</label>`;
  }
  check(key, text, value) {
    return `<label class="row"><input type="checkbox" name="${key}" ${value ? "checked" : ""}><span>${esc(text)}</span></label>`;
  }
  form(title, html, onSubmit, submit = "Save") {
    const dialog = this.shadowRoot.querySelector("dialog");
    dialog.innerHTML = `<h2>${esc(title)}</h2><form><div class="form">${html}</div><p class="error" role="alert"></p><footer><button type="button" data-action="close">Cancel</button><button class="primary" type="submit">${esc(submit)}</button></footer></form>`;
    dialog.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      form
        .querySelectorAll("input[type=checkbox]")
        .forEach((x) => (data[x.name] = x.checked));
      const button = form.querySelector("[type=submit]");
      button.disabled = true;
      try {
        await onSubmit(data, form);
        dialog.close();
        await this.load();
      } catch (err) {
        dialog.querySelector("[role=alert]").textContent = err.message;
        button.disabled = false;
      }
    };
    if (!dialog.open) dialog.showModal();
  }
  render() {
    const main = this.shadowRoot.querySelector("main");
    if (!main) return;
    main.innerHTML = `<div class="heading"><div><h1>${names[this.page] || "Accounts"}</h1><p class="muted">Your accounts, on your terms.</p></div>${this.button("refresh", "Refresh")}</div>${this.error ? `<p role="alert" class="error">${esc(this.error)}</p>` : ""}${!this.data ? "<p>Loading…</p>" : this.page === "accounts" ? this.accounts() : this.page === "investments" ? this.investments() : this.page === "assets" ? this.assets() : this.page === "settings" ? this.settings() : this.reports()}`;
  }
  accounts() {
    const acc = this.obj(this.selected);
    const all = this.list("account");
    if (!acc)
      return `<div class="toolbar">${this.button("account-new", "Add account", "", true)}${this.button("categories", "Categories")}${this.button("archives", this.showArchived ? "Hide archived" : "Show archived")}${this.button("recurrences", "Recurring transactions")}</div><div class="grid">${all
        .filter((a) => this.showArchived || !a.archived)
        .map(
          (a) =>
            `<section class="box"><span class="badge">${names[a.type]}</span><h2 translate="no">${esc(a.name)}</h2><p class="metric">${this.m(a.balance, a.currency)}</p><p class="muted" translate="no">${esc(a.institution || "")}</p>${this.button("account-open", "Transactions", a.id)}${a.can_write ? this.button("account-edit", "Edit", a.id) : ""}</section>`,
        )
        .join(
          "",
        )}</div>${!all.length ? '<section class="box empty">Create an account to start recording transactions. No budget is required.</section>' : ""}`;
    const journal = this.journal || { rows: [], total: 0 };
    return `<div class="toolbar">${this.button("accounts-back", "All accounts")}<h2 translate="no">${esc(acc.name)}</h2><strong class="metric">${this.m(acc.balance, acc.currency)}</strong></div><div class="toolbar">${acc.can_write ? this.button("transaction-new", "Add transaction", acc.id, true) + this.button("transfer", "Transfer", acc.id) + this.button("import", "Import", acc.id) + this.button("reconcile", "Reconcile", acc.id) + this.button("account-edit", "Edit account", acc.id) : ""}${this.button("csv", "Export CSV")}${this.button("filter", "Filter")}</div>${acc.bank_balance ? `<div class="notice"><span>Bank balance</span>: <span translate="no">${esc(this.bankBalance(acc.bank_balance, acc.currency))}</span> · <span>Last synchronization</span> ${esc(acc.bank_checked)}</div>` : ""}<section class="box table"><table><thead><tr><th><input type="checkbox" data-action="select-all" aria-label="Select all"></th><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${journal.rows.map((tx) => `<tr><td><input type="checkbox" name="selected-tx" value="${tx.id}" aria-label="Select transaction"></td><td>${esc(tx.date)}</td><td><span translate="no">${esc(tx.payee || tx.description)}</span><small class="muted" translate="no"> ${esc(tx.payee ? tx.description : "")}</small></td><td translate="no">${esc(tx.splits.map((s) => this.obj(s.category_id)?.name || "—").join(", "))}</td><td class="numbers ${Number(tx.amount) < 0 ? "negative" : "positive"}">${this.m(tx.amount, tx.currency)}</td><td>${names[tx.status]}</td><td>${acc.can_write ? this.button("transaction-edit", "Edit", tx.id) : ""}</td></tr>`).join("")}</tbody></table>${!journal.rows.length ? '<p class="empty">No transactions in this view.</p>' : ""}<div class="toolbar"><span>${journal.total}</span><span>transactions</span>${this.button("previous", "Previous")}${this.button("next", "Next")}${acc.can_write ? this.button("bulk", "Edit selection") : ""}</div></section>`;
  }
  investments() {
    const portfolios = this.list("account").filter(
      (a) => a.type === "investment" && !a.portfolio_id,
    );
    const acc = this.obj(this.selected);
    return `<div class="toolbar">${this.button("portfolio-new", "Add portfolio", "", true)}${this.button("instrument-new", "Add instrument")}${this.button("instrument-search", "Search markets")}${this.button("quote", "Set or refresh a quote")}</div><div class="toolbar">${portfolios.map((a) => this.button("portfolio-open", a.name, a.id)).join("")}</div>${acc ? `<section class="box"><h2 translate="no">${esc(acc.name)}</h2><p><span>Cash balance</span> ${this.m(acc.balance, acc.currency)}</p><div class="toolbar">${this.button("trade", "Record an operation", acc.id, true)}${this.button("pocket", "Add currency pocket", acc.id)}${acc.bank_holdings?.holdings?.length ? this.button("holdings", "Bank holdings", acc.id) : ""}</div><div class="table"><table><thead><tr><th>Instrument</th><th>Quantity</th><th>Cost</th><th>Market value</th><th>Unrealized gain</th><th>Realized gain</th><th>Quote date</th><th>Price source</th></tr></thead><tbody>${(this.positions?.positions || []).map((p) => `<tr><td translate="no">${esc(p.instrument.name)}</td><td>${esc(p.quantity)}</td><td>${this.m(p.cost, p.instrument.currency)}</td><td>${this.m(p.value, p.instrument.currency)}</td><td>${this.m(p.unrealized, p.instrument.currency)}</td><td>${this.m(p.realized, p.instrument.currency)}</td><td>${esc(p.quote?.date || "—")}</td><td>${esc(p.quote?.source || "—")}</td></tr>`).join("")}</tbody></table></div></section>` : '<section class="box empty">Choose a portfolio or create your first investment account.</section>'}${acc ? `<section class="box table"><h2>Investment history</h2><table><thead><tr><th>Date</th><th>Instrument</th><th>Operation</th><th>Quantity</th><th>Price</th><th></th></tr></thead><tbody>${(this.trades || []).map((t) => `<tr><td>${esc(t.date)}</td><td translate="no">${esc(this.obj(t.instrument_id)?.name)}</td><td>${esc(names[t.action] || t.action)}</td><td>${esc(t.quantity)}</td><td>${esc(t.price)}</td><td>${this.button("trade-edit", "Edit", t.id)}</td></tr>`).join("")}</tbody></table><div class="toolbar">${this.tradeOffset ? this.button("trades-previous", "Previous") : ""}${this.trades?.length === 100 ? this.button("trades-next", "Next") : ""}</div></section>` : ""}<section class="box"><h2>Instruments</h2>${this.list(
      "instrument",
    )
      .map(
        (i) =>
          `<div class="toolbar"><strong translate="no">${esc(i.name)}</strong><span translate="no">${esc(i.symbol || "")} · ${esc(i.currency)}</span><span>${esc(i.quote_status === "unavailable" ? "Unavailable" : i.quote_status || "")}</span>${this.button("instrument-edit", "Edit", i.id)}${i.instrument_type === "bond" ? this.button("bond-schedule", "Schedule", i.id) : ""}</div>`,
      )
      .join("")}</section>`;
  }
  assets() {
    return `<div class="toolbar">${this.button("asset-new", "Add asset", "", true)}${this.button("loan-new", "Add loan")}</div><div class="grid">${this.list(
      "asset",
    )
      .map(
        (a) =>
          `<section class="box"><h2 translate="no">${esc(a.name)}</h2><p class="metric">${this.m(this.report?.assets.find((v) => v.id === a.id)?.value)}</p><p>${esc(a.ownership)}% <span>ownership</span></p><div class="toolbar">${this.button("valuation", "Add valuation", a.id)}${this.button("asset-edit", "Edit", a.id)}</div></section>`,
      )
      .join("")}</div><section class="box"><h2>Loans</h2>${this.list("loan")
      .map(
        (l) =>
          `<div class="toolbar"><strong translate="no">${esc(l.name || this.obj(l.account_id)?.name)}</strong>${this.button("loan-schedule", "Schedule", l.id)}${this.button("loan-edit", "Edit", l.id)}${this.button("loan-change", "Rate change / extra payment", l.id)}</div>`,
      )
      .join("")}</section>`;
  }
  reports() {
    const r = this.report;
    if (!r) return "<p>Loading…</p>";
    const metric = (title, value) =>
      `<section class="box"><h2>${title}</h2><p class="metric">${this.m(value)}</p></section>`;
    const months = Object.entries(r.groups.month);
    const max = Math.max(1, ...months.map(([, v]) => Number(v.expenses)));
    return `<div class="toolbar">${this.button("report-filter", "Period and currency")}${this.button("print", "Print / PDF")}${this.button("report-export", "Export report")}${!r.complete ? this.button("report-rates", "Get missing exchange rates") : ""}</div>${!r.complete ? '<p class="notice">Incomplete valuation: add the missing exchange rates or prices.</p>' : ""}<p class="muted">${esc(r.from)} — ${esc(r.to)} · ${esc(r.currency)}</p><div class="grid">${metric("Net worth", r.net_worth)}${metric("Income", r.income)}${metric("Expenses", r.expenses)}${metric("Cash flow", r.cashflow)}${metric("Debt", r.debt)}${metric("Realized gains", r.realized_gains)}${metric("Investment income", r.investment_income)}</div><section class="box"><h2>Expenses over time</h2><div class="chart">${months.map(([month, v]) => `<div class="column"><div>${this.m(v.expenses)}</div><div class="bar" style="height:${Math.max(2, (Number(v.expenses) / max) * 130)}px"></div><span>${month}</span></div>`).join("")}</div></section><section class="box table"><h2>Planned versus actual</h2><table><thead><tr><th>Budget</th><th>Planned expenses</th><th>Actual expenses</th><th>Difference</th></tr></thead><tbody>${(r.budget_comparisons || []).map((b) => `<tr><td translate="no">${esc(b.name)}</td><td>${this.m(b.planned_expenses)}</td><td>${this.m(b.actual_expenses)}</td><td>${this.m(b.expense_difference)}</td></tr>`).join("")}</tbody></table></section><section class="box table"><h2>Planned entries</h2><table><thead><tr><th>Budget</th><th>Planned entry</th><th>Income / expense</th><th>Planned</th><th>Actual</th><th>Difference</th></tr></thead><tbody>${(r.item_comparisons || []).map((i) => `<tr><td translate="no">${esc(i.budget_name)}</td><td translate="no">${esc(i.name)}</td><td>${i.direction === "income" ? "Income" : "Expense"}</td><td>${this.m(i.planned)}</td><td>${this.m(i.actual)}</td><td>${this.m(i.difference)}</td></tr>`).join("")}</tbody></table></section><section class="box table"><h2>Investment allocation</h2><table><thead><tr><th>Instrument</th><th>Account</th><th>Market value</th><th>Quote date</th></tr></thead><tbody>${(r.investments || []).map((i) => `<tr><td translate="no">${esc(i.name)}</td><td translate="no">${esc(this.obj(i.account_id)?.name)}</td><td>${this.m(i.value)}</td><td>${esc(i.quote_date || "—")}</td></tr>`).join("")}</tbody></table></section>${[
      "category",
      "payee",
      "account",
      "budget",
      "asset",
    ]
      .map(
        (d) =>
          `<section class="box table"><h2>${{ category: "Categories", payee: "Payees", account: "Accounts", budget: "Budget actuals", asset: "Asset income and expenses" }[d]}</h2><table><thead><tr><th>Name</th><th>Income</th><th>Expenses</th><th></th></tr></thead><tbody>${Object.entries(
            r.groups[d],
          )
            .map(
              ([id, v]) =>
                `<tr><td translate="no">${esc(this.obj(id)?.name || (this.budgets || []).find((b) => b.id === id)?.name || this.t({ uncategorized: "Uncategorized", unassigned: "Unassigned" }[id] || id))}</td><td>${this.m(v.income)}</td><td>${this.m(v.expenses)}</td><td>${this.button("drill", "Transactions", d + ":" + id)}</td></tr>`,
            )
            .join("")}</tbody></table></section>`,
      )
      .join("")}`;
  }
  settings() {
    return `<section class="box"><h2>Modules and display</h2><p>Hide modules without deleting their data.</p><div class="toolbar">${this.button("preferences", "Customize")}${this.button("backup", "Download backup")}${this.button("restore", "Restore backup")}</div></section><section class="box"><h2>Currencies and rates</h2><div class="toolbar">${this.button("rate", "Add exchange rate")}${this.button("rate-fetch", "Get an exchange rate")}</div>${this.list(
      "rate",
    )
      .slice(-12)
      .map(
        (r) =>
          `<p translate="no">${esc(r.date)} · ${esc(r.base)} / ${esc(r.currency)} · ${esc(r.value)} · ${esc(r.source)}</p>`,
      )
      .join(
        "",
      )}</section><section class="box"><h2>Lunch Flow</h2><p>Optional bank synchronization. Your personal API key stays on this Home Assistant server.</p>${this.button("connection", "Connect Lunch Flow")} ${this.list(
      "connection",
    )
      .map(
        (c) =>
          `<div class="box"><h3 translate="no">${esc(c.name)}</h3><p>${esc(c.last_sync || "—")} · ${esc(c.status || "")}</p><div class="toolbar">${this.button("mapping", "Choose accounts", c.id)}${this.button("sync-preview", "Preview synchronization", c.id)}${this.button("sync", "Synchronize", c.id)}${this.button("disconnect", "Disconnect", c.id)}</div></div>`,
      )
      .join(
        "",
      )}</section><section class="box"><h2>Budget connections</h2><p>Distribute account balances between budgets. Transactions are assigned separately.</p>${this.button("budget-link", "Link an account")}${this.list(
      "budget_link",
    )
      .map(
        (l) =>
          `<div class="toolbar"><span translate="no">${esc(this.obj(l.account_id)?.name)} · ${esc(l.percentage)}%</span>${this.button("remove-link", "Remove", l.id)}</div>`,
      )
      .join(
        "",
      )}</section><section class="box"><h2>Review conflicts</h2>${this.list(
      "conflict",
    )
      .map(
        (c) =>
          `<div class="toolbar"><span translate="no">${esc(c.incoming?.date)} ${esc(c.incoming?.description)} ${esc(c.incoming?.amount)}</span>${this.button("conflict", "Review", c.id)}</div>`,
      )
      .join("")}</section>`;
  }
  async click(e) {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    try {
      await this.action(action, id, button);
    } catch (err) {
      this.error = err.message;
      this.render();
    }
  }
  async action(action, id, button) {
    const acc = this.obj(this.selected);
    const save = (p) => this.api("save", p, true);
    const enumRows = (values) => values.map((v) => [v, this.t(names[v] || v)]);
    if (action === "import-next" || action === "import-previous") {
      this.captureImport();
      const s = this.importSession;
      const offset = Math.max(
        0,
        s.preview.offset +
          (action === "import-next" ? s.preview.limit : -s.preview.limit),
      );
      const account_mapping = Object.fromEntries(
        (s.preview.source_accounts || [])
          .map((name, i) => [name, s.values["source:" + i]])
          .filter(([, v]) => v),
      );
      const preview = await this.api("import_preview", {
        ...s.payload,
        account_mapping,
        preview_offset: offset,
        preview_limit: s.preview.limit,
      });
      this.importPreview(s.payload, preview, s);
      return;
    }
    if (action === "close") {
      this.shadowRoot.querySelector("dialog").close();
      return;
    }
    if (action === "archives") {
      this.showArchived = !this.showArchived;
      this.render();
      return;
    }
    if (["trades-previous", "trades-next"].includes(action)) {
      this.tradeOffset = Math.max(
        0,
        (this.tradeOffset || 0) + (action === "trades-next" ? 100 : -100),
      );
      await this.loadPage();
      return;
    }
    if (action === "refresh") {
      await this.load();
      return;
    }
    if (["account-open", "portfolio-open"].includes(action)) {
      this.selected = id;
      this.tradeOffset = 0;
      this.filters = {};
      await this.loadPage();
      return;
    }
    if (action === "accounts-back") {
      this.selected = null;
      this.render();
      return;
    }
    if (["previous", "next"].includes(action)) {
      this.filters.offset = Math.max(
        0,
        (this.filters.offset || 0) + (action === "next" ? 100 : -100),
      );
      await this.loadPage();
      return;
    }
    if (action === "select-all") {
      this.shadowRoot
        .querySelectorAll("[name=selected-tx]")
        .forEach((c) => (c.checked = button.checked));
      return;
    }
    if (
      ["account-new", "account-edit", "portfolio-new", "pocket"].includes(
        action,
      )
    ) {
      const a =
        action === "account-edit"
          ? this.obj(id)
          : {
              currency: action === "pocket" ? "USD" : this.unit,
              type:
                action === "portfolio-new" || action === "pocket"
                  ? "investment"
                  : "checking",
              opening_date: this.today(),
              opening_balance: "0",
            };
      this.form(
        "Account",
        this.field("name", "Name", a.name) +
          this.field(
            "type",
            "Account type",
            a.type,
            "text",
            enumRows([
              "checking",
              "savings",
              "cash",
              "credit",
              "loan",
              "investment",
            ]),
            true,
          ) +
          this.field("currency", "Currency", a.currency) +
          this.field("institution", "Institution", a.institution) +
          this.field("opening_date", "Opening date", a.opening_date, "date") +
          this.field(
            "opening_balance",
            "Opening balance",
            a.opening_balance,
            "number",
          ) +
          this.field(
            "cost_method",
            "Cost method",
            a.cost_method || "average",
            "text",
            enumRows(["average", "fifo"]),
            true,
          ) +
          this.check("archived", "Archived", a.archived) +
          this.check(
            "publish_sensors",
            "Publish amounts as Home Assistant sensors",
            a.publish_sensors,
          ) +
          '<p class="full muted">Published sensor amounts can be read by other Home Assistant users.</p>' +
          (a.id ? this.button("sharing", "Sharing", a.id) : ""),
        (d) =>
          save({
            ...a,
            ...d,
            kind: "account",
            ...(action === "pocket" ? { portfolio_id: id } : {}),
          }),
      );
      return;
    }
    if (action === "sharing") {
      const a = this.obj(id);
      const users = await this.api("users");
      this.form(
        "Sharing",
        users
          .filter((u) => u.id !== a.owner)
          .map((u) =>
            this.field(
              "user:" + u.id,
              u.name,
              a.sharing?.[u.id] || "none",
              "text",
              enumRows(["none", "read", "write"]),
              true,
            ),
          )
          .join(""),
        (d) =>
          save({
            ...a,
            sharing: Object.fromEntries(
              Object.entries(d)
                .filter(([, v]) => v !== "none")
                .map(([k, v]) => [k.slice(5), v]),
            ),
          }),
      );
      return;
    }
    if (["transaction-new", "transaction-edit"].includes(action)) {
      const tx =
        action === "transaction-edit"
          ? this.journal.rows.find((t) => t.id === id)
          : {
              account_id: id,
              date: this.today(),
              amount: "",
              status: "unmarked",
              splits: [],
            };
      const splits = tx.splits.length ? tx.splits : [{ amount: tx.amount }];
      this.form(
        "Transaction",
        this.field("date", "Date", tx.date, "date") +
          this.field("amount", "Amount", tx.amount, "number") +
          this.field("fee", "Fee included in amount", tx.fee || "0", "number") +
          this.field("payee", "Payee", tx.payee) +
          this.field("description", "Description", tx.description) +
          this.field(
            "status",
            "Status",
            tx.status,
            "text",
            enumRows(["unmarked", "cleared", "pending"]),
            true,
          ) +
          this.field("notes", "Notes", tx.notes) +
          this.field(
            "original_currency",
            "Original currency",
            tx.original_currency || acc?.currency,
          ) +
          this.field(
            "original_amount",
            "Original amount",
            tx.original_amount || tx.amount,
            "number",
          ) +
          this.field(
            "exchange_rate",
            "Historical exchange rate",
            tx.exchange_rate || "1",
            "number",
          ) +
          this.field(
            "refund_id",
            "Refund of transaction",
            tx.refund_id,
            "text",
            (this.journal?.rows || [])
              .filter((t) => Number(t.amount) < 0)
              .map((t) => [
                t.id,
                `${t.date} ${t.payee || t.description} ${t.amount}`,
              ]),
          ) +
          this.field(
            "asset_id",
            "Related asset",
            tx.asset_id,
            "text",
            this.list("asset"),
          ) +
          `<div class="full"><h3>Split transaction</h3><div id="splits">${splits.map((s) => this.splitRow(s)).join("")}</div>${this.button("split-add", "Add split")}</div>` +
          (tx.id
            ? this.button("transaction-delete", "Delete transaction", tx.id)
            : ""),
        async (d, form) => {
          const splitRows = [...form.querySelectorAll(".splits")].map((row) =>
            Object.fromEntries(
              [...row.querySelectorAll("[data-key]")].map((x) => [
                x.dataset.key,
                x.value || null,
              ]),
            ),
          );
          if (splitRows.length === 1 && !splitRows[0].amount)
            splitRows[0].amount = d.amount;
          if (!d.original_amount) d.original_amount = d.amount;
          await this.api(
            "transaction",
            { ...tx, ...d, splits: splitRows },
            true,
          );
        },
      );
      return;
    }
    if (action === "split-add") {
      const host = this.shadowRoot.querySelector("#splits");
      host.insertAdjacentHTML("beforeend", this.splitRow({}));
      return;
    }
    if (action === "split-remove") {
      button.closest(".splits").remove();
      return;
    }
    if (action === "transaction-delete") {
      await this.api("transaction_delete", { id }, true);
      this.shadowRoot.querySelector("dialog").close();
      await this.load();
      return;
    }
    if (action === "transfer") {
      this.form(
        "Transfer",
        this.field(
          "destination_id",
          "Destination account",
          "",
          "text",
          this.list("account").filter((a) => a.id !== id && a.can_write),
          true,
        ) +
          this.field("date", "Date", this.today(), "date") +
          this.field("amount", "Amount sent", "", "number") +
          this.field("received", "Amount received", "", "number") +
          this.field("fee", "Fee", "0", "number") +
          this.field("description", "Description", ""),
        (d) => this.api("transfer", { ...d, account_id: id }, true),
      );
      return;
    }
    if (action === "filter") {
      this.form(
        "Filter",
        this.field("from", "From", this.filters.from, "date") +
          this.field("to", "To", this.filters.to, "date") +
          this.field("search", "Search", this.filters.search) +
          this.field(
            "status",
            "Status",
            this.filters.status,
            "text",
            enumRows(["unmarked", "cleared", "reconciled", "pending"]),
          ) +
          this.field(
            "category_id",
            "Category",
            this.filters.category_id,
            "text",
            this.list("category"),
          ),
        (d) => {
          this.filters = Object.fromEntries(
            Object.entries(d).filter(([, v]) => v),
          );
        },
      );
      return;
    }
    if (action === "bulk") {
      const ids = [
        ...this.shadowRoot.querySelectorAll("[name=selected-tx]:checked"),
      ].map((c) => c.value);
      this.form(
        "Edit selection",
        this.field(
          "status",
          "Status",
          "",
          "text",
          enumRows(["unmarked", "cleared"]),
        ) +
          this.field(
            "category_id",
            "Category",
            "",
            "text",
            this.list("category"),
          ),
        (d) =>
          this.api(
            "bulk",
            {
              ids,
              ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)),
            },
            true,
          ),
      );
      return;
    }
    if (action === "reconcile") {
      this.form(
        "Reconcile",
        this.field("date", "Statement date", this.today(), "date") +
          this.field("balance", "Statement balance", "", "number") +
          '<p class="full muted">Mark the statement transactions as cleared first. The difference must be zero.</p>' +
          this.button("reconciliations", "Previous reconciliations", id),
        (d) => this.api("reconcile", { ...d, account_id: id }, true),
      );
      return;
    }
    if (action === "reconciliations") {
      const list = await this.api("reconciliations", { account_id: id });
      this.form(
        "Previous reconciliations",
        `<div class="full">${list.map((r) => `<div class="toolbar"><span>${r.date} · ${r.balance}</span>${!r.reopened ? this.button("reopen", "Reopen", r.id) : ""}</div>`).join("")}</div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (action === "reopen") {
      await this.api("reopen", { id }, true);
      this.shadowRoot.querySelector("dialog").close();
      await this.load();
      return;
    }
    if (action === "categories") {
      this.form(
        "Categories",
        `<div class="full">${this.list("category")
          .map(
            (c) =>
              `<div class="toolbar"><span translate="no">${esc(c.name)}</span>${this.button("category-edit", "Edit", c.id)}</div>`,
          )
          .join("")}${this.button("category-new", "Add category")}</div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (["category-new", "category-edit"].includes(action)) {
      const c = this.obj(id) || {};
      this.form(
        "Category",
        this.field("name", "Name", c.name) +
          this.field(
            "parent_id",
            "Parent category",
            c.parent_id,
            "text",
            this.list("category").filter((o) => o.id !== id),
          ) +
          this.field(
            "budget_category",
            "Budget category",
            c.budget_category,
            "text",
            enumRows(["investment", "mandatory", "optional"]),
          ),
        (d) => save({ ...c, ...d, kind: "category" }),
      );
      return;
    }
    if (action === "recurrences") {
      const calendar = await this.api("calendar");
      this.form(
        "Recurring transactions",
        `<div class="full"><h3>Upcoming occurrences</h3>${calendar.map((r) => `<div class="toolbar"><span translate="no">${esc(r.date)} · ${esc(r.description)} · ${esc(r.amount)}</span>${this.button("calendar-post", "Record occurrence", r.id + ":" + r.date)}</div>`).join("")}<h3>Templates and rules</h3>${this.list(
          "recurring",
        )
          .map(
            (r) =>
              `<div class="toolbar"><span translate="no">${esc(r.description)} · ${esc(r.amount)}</span>${this.button("recurring-post", "Record occurrence", r.id)}${this.button("recurring-edit", "Edit", r.id)}${this.button("template-delete", "Delete", r.id)}</div>`,
          )
          .join(
            "",
          )}${this.button("recurring-new", "Add recurring transaction")}${this.button("rule", "Add classification rule")}${this.list(
          "rule",
        )
          .map(
            (r) =>
              `<div class="toolbar"><span translate="no">${esc(r.match)}</span>${this.button("rule", "Edit", r.id)}${this.button("template-delete", "Delete", r.id)}</div>`,
          )
          .join("")}</div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (action === "template-delete") {
      await this.api("delete", { id }, true);
      await this.load();
      await this.action("recurrences");
      return;
    }
    if (["recurring-new", "recurring-edit"].includes(action)) {
      const r = this.obj(id) || {};
      this.form(
        "Recurring transaction",
        this.field(
          "account_id",
          "Account",
          r.account_id,
          "text",
          this.list("account").filter((a) => a.can_write),
          true,
        ) +
          this.field("date", "First date", r.date || this.today(), "date") +
          this.field("amount", "Amount", r.amount, "number") +
          this.field("description", "Description", r.description) +
          this.field(
            "recurrence",
            "Frequency",
            r.recurrence || "monthly",
            "text",
            enumRows(["monthly", "biweekly", "weekly", "yearly", "once"]),
            true,
          ) +
          this.field(
            "category_id",
            "Category",
            r.category_id,
            "text",
            this.list("category"),
          ),
        (d) => save({ ...r, ...d, kind: "recurring" }),
      );
      return;
    }
    if (action === "recurring-post" || action === "calendar-post") {
      const [templateId, due] = id.split(":");
      this.form(
        "Record occurrence",
        this.field("date", "Occurrence date", due || this.today(), "date") +
          this.field("match_id", "Existing transaction ID", ""),
        (d) => this.api("recurring_post", { ...d, id: templateId }, true),
      );
      return;
    }
    if (action === "rule") {
      const r = this.obj(id) || {};
      this.form(
        "Classification rule",
        this.field(
          "account_id",
          "Account",
          r.account_id,
          "text",
          this.list("account").filter((a) => a.can_write),
          true,
        ) +
          this.field("match", "Payee or description contains", r.match) +
          this.field(
            "category_id",
            "Category",
            r.category_id,
            "text",
            this.list("category"),
            true,
          ),
        (d) => save({ ...r, ...d, kind: "rule" }),
      );
      return;
    }
    if (["instrument-new", "instrument-edit"].includes(action)) {
      const i = this.obj(id) || {};
      this.form(
        "Instrument",
        this.field("name", "Name", i.name) +
          this.field("symbol", "Symbol", i.symbol) +
          this.field("market", "Market", i.market) +
          this.field("isin", "ISIN", i.isin) +
          this.field(
            "instrument_type",
            "Instrument type",
            i.instrument_type || "stock",
            "text",
            [
              ["stock", this.t("Stock")],
              ["etf", "ETF"],
              ["fund", this.t("Fund")],
              ["bond", this.t("Bond")],
              ["crypto", this.t("Cryptocurrency")],
            ],
            true,
          ) +
          this.field("currency", "Currency", i.currency || this.unit) +
          this.field(
            "provider",
            "Price source",
            i.provider || "yahoo",
            "text",
            enumRows(["yahoo", "coingecko", "manual"]),
            true,
          ) +
          this.check(
            "auto_quotes",
            "Refresh prices automatically",
            i.auto_quotes,
          ) +
          `<details class="full"><summary>Bond terms</summary><div class="form">${this.field("face_value", "Face value", i.face_value || "100", "number")}${this.field("coupon_rate", "Annual coupon rate", i.coupon_rate || "0", "number")}${this.field(
            "coupon_frequency",
            "Coupons per year",
            String(i.coupon_frequency || 2),
            "text",
            ["1", "2", "4", "12"].map((v) => [v, v]),
            true,
          )}${this.field("coupon_start", "First coupon", i.coupon_start, "date")}${this.field("maturity", "Maturity", i.maturity, "date")}</div></details>`,
        (d) => save({ ...i, ...d, kind: "instrument" }),
      );
      return;
    }
    if (action === "instrument-search") {
      this.form(
        "Search markets",
        this.field("query", "Name or symbol", "") +
          this.field(
            "provider",
            "Price source",
            "yahoo",
            "text",
            enumRows(["yahoo", "coingecko"]),
            true,
          ),
        async (d) => {
          const results = await this.api("provider_search", d);
          this.searchResults = results;
          setTimeout(() => this.showSearch(results, d.provider), 0);
        },
        "Search",
      );
      return;
    }
    if (action === "search-use") {
      const i = this.searchResults[Number(id)];
      this.form(
        "Instrument",
        this.field("name", "Name", i.name) +
          this.field("symbol", "Symbol", i.symbol) +
          this.field("currency", "Currency", this.unit) +
          this.check("auto_quotes", "Refresh prices automatically", true),
        (d) =>
          save({
            ...d,
            kind: "instrument",
            market: i.exchange,
            provider: this.searchProvider,
          }),
      );
      return;
    }
    if (action === "quote") {
      this.form(
        "Quote",
        this.field(
          "instrument_id",
          "Instrument",
          "",
          "text",
          this.list("instrument"),
          true,
        ) +
          this.field(
            "source",
            "Price source",
            "manual",
            "text",
            enumRows(["manual", "yahoo", "coingecko"]),
            true,
          ) +
          this.field("date", "Date", this.today(), "date") +
          this.field("value", "Price", "", "number"),
        (d) => this.api("provider_quote", d),
      );
      return;
    }
    if (action === "trade-edit") {
      const original = this.trades.find((t) => t.id === id);
      this.form(
        "Correct investment operation",
        this.field("date", "Date", original.date, "date") +
          this.field("quantity", "Quantity", original.quantity, "number") +
          this.field(
            "price",
            "Price / income amount",
            original.price,
            "number",
          ) +
          this.field("fee", "Fee", original.fee, "number") +
          this.button("trade-delete", "Delete operation", id),
        (d) => this.api("trade_update", { ...d, id }, true),
      );
      return;
    }
    if (action === "trade-delete") {
      await this.api("trade_delete", { id }, true);
      this.shadowRoot.querySelector("dialog").close();
      await this.load();
      return;
    }
    if (action === "trade") {
      this.form(
        "Investment operation",
        this.field(
          "instrument_id",
          "Instrument",
          "",
          "text",
          this.list("instrument"),
          true,
        ) +
          this.field(
            "action",
            "Operation",
            "buy",
            "text",
            enumRows([
              "buy",
              "sell",
              "opening",
              "dividend",
              "interest",
              "coupon",
              "reinvest",
              "split",
              "transfer",
            ]),
            true,
          ) +
          this.field("date", "Date", this.today(), "date") +
          this.field("quantity", "Quantity", "0", "number") +
          this.field("price", "Price / income amount", "0", "number") +
          this.field("fee", "Fee", "0", "number") +
          this.field(
            "cash_account_id",
            "Cash pocket",
            id,
            "text",
            this.list("account").filter(
              (a) => a.id === id || a.portfolio_id === id,
            ),
            true,
          ) +
          this.field(
            "exchange_rate",
            "Historical exchange rate",
            "1",
            "number",
          ) +
          this.field(
            "destination_id",
            "Destination portfolio",
            "",
            "text",
            this.list("account").filter(
              (a) => a.type === "investment" && a.id !== id,
            ),
          ),
        (d) => this.api("trade", { ...d, account_id: id }, true),
      );
      return;
    }
    if (["asset-new", "asset-edit"].includes(action)) {
      const a = this.obj(id) || {};
      this.form(
        "Asset",
        this.field("name", "Name", a.name) +
          this.field("currency", "Currency", a.currency || this.unit) +
          this.field(
            "ownership",
            "Ownership percentage",
            a.ownership || "100",
            "number",
          ) +
          this.field("description", "Description", a.description),
        (d) => save({ ...a, ...d, kind: "asset" }),
      );
      return;
    }
    if (action === "valuation") {
      this.form(
        "Valuation",
        this.field("date", "Date", this.today(), "date") +
          this.field("value", "Full asset value", "", "number"),
        (d) => save({ ...d, kind: "valuation", asset_id: id }),
      );
      return;
    }
    if (["loan-new", "loan-edit"].includes(action)) {
      const l = this.obj(id) || {};
      this.form(
        "Loan",
        this.field("name", "Name", l.name) +
          this.field(
            "account_id",
            "Loan account",
            l.account_id,
            "text",
            this.list("account").filter((a) => a.type === "loan"),
            true,
          ) +
          this.field("date", "First payment", l.date || this.today(), "date") +
          this.field("principal", "Principal", l.principal, "number") +
          this.field(
            "interest_rate",
            "Annual interest rate",
            l.interest_rate || "0",
            "number",
          ) +
          this.field("payment", "Payment", l.payment, "number") +
          this.field(
            "payments",
            "Maximum payments",
            l.payments || 360,
            "number",
          ) +
          this.field(
            "frequency",
            "Payments per year",
            String(l.frequency || 12),
            "text",
            [
              ["12", "Monthly"],
              ["26", "Every two weeks"],
              ["52", "Weekly"],
            ],
            true,
          ) +
          this.field(
            "compounding",
            "Compounding per year",
            String(l.compounding || 12),
            "text",
            ["1", "2", "4", "12", "26", "52", "365"].map((v) => [v, v]),
            true,
          ),
        (d) => save({ ...l, ...d, kind: "loan" }),
      );
      return;
    }
    if (action === "loan-schedule") {
      const rows = await this.api("loan_schedule", { id });
      this.form(
        "Loan schedule",
        `<div class="full table"><table><thead><tr><th>Date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr>${["date", "payment", "principal", "interest", "balance"].map((k) => `<td>${esc(r[k])}</td>`).join("")}<td>${this.button("loan-pay", "Record payment", id + ":" + r.date + ":" + r.principal + ":" + r.interest)}</td></tr>`).join("")}</tbody></table></div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (action === "loan-pay") {
      const [loan_id, date, principal, interest] = id.split(":");
      this.form(
        "Record payment",
        this.field(
          "account_id",
          "Pay from",
          "",
          "text",
          this.list("account").filter((a) =>
            ["checking", "cash", "savings"].includes(a.type),
          ),
          true,
        ) +
          this.field("date", "Date", date, "date") +
          this.field("principal", "Principal", principal, "number") +
          this.field("interest", "Interest", interest, "number") +
          this.field("fee", "Fee", "0", "number") +
          this.field(
            "category_id",
            "Interest category",
            "",
            "text",
            this.list("category"),
          ),
        (d) => this.api("loan_payment", { ...d, loan_id }, true),
      );
      return;
    }
    if (action === "loan-change") {
      const loan = this.obj(id);
      this.form(
        "Loan changes",
        this.field("date", "Effective date", this.today(), "date") +
          this.field("rate", "New annual rate", "", "number") +
          this.field("extra", "Extra principal payment", "", "number"),
        (d) =>
          save({
            ...loan,
            rate_changes: [
              ...(loan.rate_changes || []),
              ...(d.rate ? [{ date: d.date, rate: d.rate }] : []),
            ],
            extra_payments: [
              ...(loan.extra_payments || []),
              ...(d.extra ? [{ date: d.date, amount: d.extra }] : []),
            ],
          }),
      );
      return;
    }
    if (action === "bond-schedule") {
      const rows = await this.api("bond_schedule", { id });
      this.form(
        "Bond schedule",
        `<div class="full table"><table><thead><tr><th>Date</th><th>Coupon</th><th>Principal</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.date}</td><td>${r.coupon}</td><td>${r.principal}</td></tr>`).join("")}</tbody></table></div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (action === "report-rates") {
      const currencies = [
        ...new Set(
          this.report.missing
            .filter((m) => m.type === "rate")
            .map((m) => m.currency),
        ),
      ];
      for (const base of currencies) {
        const dates = this.report.missing
          .filter((m) => m.type === "rate" && m.currency === base)
          .map((m) => m.date)
          .sort();
        await this.api("provider_rate_history", {
          base,
          currency: this.report.currency,
          from: dates[0],
          to: dates.at(-1),
        });
      }
      await this.loadPage();
      return;
    }
    if (action === "report-filter") {
      this.form(
        "Report filters",
        this.field("from", "From", this.report?.from, "date") +
          this.field("to", "To", this.report?.to, "date") +
          this.field("currency", "Currency", this.unit) +
          this.field("account_id", "Account", "", "text", this.list("account")),
        (d) => {
          this.reportFilters = {
            ...d,
            account_ids: d.account_id ? [d.account_id] : undefined,
          };
          this.unit = d.currency;
        },
      );
      return;
    }
    if (
      action === "drill" ||
      action === "drill-next" ||
      action === "drill-previous"
    ) {
      if (action === "drill") {
        this.drillId = id;
        this.drillOffset = 0;
      } else
        this.drillOffset = Math.max(
          0,
          this.drillOffset + (action === "drill-next" ? 100 : -100),
        );
      const [dimension, ...parts] = this.drillId.split(":");
      const filterKey = {
        category: "category_id",
        payee: "payee",
        account: "account_id",
        budget: "budget_id",
        asset: "asset_id",
      }[dimension];
      const data = await this.api("transactions", {
        ...this.reportFilters,
        [filterKey]: parts.join(":"),
        from: this.report.from,
        to: this.report.to,
        limit: 100,
        offset: this.drillOffset,
        flows_only: true,
      });
      this.form(
        "Transactions",
        `<div class="full table"><p>${data.total} <span>transactions</span></p><table>${data.rows.map((r) => `<tr><td>${r.date}</td><td translate="no">${esc(r.payee || r.description)}</td><td>${this.m(r.amount, r.currency)}</td></tr>`).join("")}</table><div class="toolbar">${this.drillOffset ? this.button("drill-previous", "Previous") : ""}${this.drillOffset + 100 < data.total ? this.button("drill-next", "Next") : ""}</div></div>`,
        async () => {},
        "Done",
      );
      return;
    }
    if (action === "print") {
      window.print();
      return;
    }
    if (action === "report-export") {
      this.download(
        "report.csv",
        [
          "Group,Name,Income,Expenses,Currency",
          ...Object.entries(this.report.groups).flatMap(([d, groups]) =>
            Object.entries(groups).map(([key, v]) =>
              [
                d,
                this.obj(key)?.name || key,
                v.income,
                v.expenses,
                this.report.currency,
              ]
                .map(this.csvCell)
                .join(","),
            ),
          ),
        ].join("\n"),
        "text/csv",
      );
      return;
    }
    if (action === "csv") {
      let offset = 0,
        rows = [];
      while (true) {
        const data = await this.api("transactions", {
          account_id: this.selected,
          ...this.filters,
          offset,
          limit: 500,
        });
        rows.push(...data.rows);
        offset += 500;
        if (offset >= data.total) break;
      }
      this.download(
        "transactions.csv",
        [
          ["date", "payee", "description", "amount", "currency", "status"].join(
            ",",
          ),
          ...rows.map((r) =>
            ["date", "payee", "description", "amount", "currency", "status"]
              .map((k) => this.csvCell(r[k]))
              .join(","),
          ),
        ].join("\n"),
        "text/csv",
      );
      return;
    }
    if (action === "preferences") {
      const p = this.prefs || {};
      this.form(
        "Modules and display",
        this.field("currency", "Reporting currency", p.currency || this.unit) +
          this.check(
            "auto_rates",
            "Refresh exchange rates automatically",
            p.auto_rates,
          ) +
          ["budgets", "accounts", "investments", "assets", "reports"]
            .map((k) => this.check(k, names[k], p.modules?.[k] !== false))
            .join(""),
        (d) =>
          save({
            ...p,
            kind: "preferences",
            currency: d.currency,
            auto_rates: d.auto_rates,
            modules: Object.fromEntries(
              ["budgets", "accounts", "investments", "assets", "reports"].map(
                (k) => [k, d[k]],
              ),
            ),
          }),
      );
      return;
    }
    if (["rate", "rate-fetch"].includes(action)) {
      this.form(
        "Exchange rate",
        this.field("base", "From currency", this.unit) +
          this.field("currency", "To currency", "USD") +
          this.field("date", "Date", this.today(), "date") +
          (action === "rate"
            ? this.field("value", "Exchange rate", "", "number")
            : ""),
        (d) =>
          action === "rate"
            ? save({ ...d, kind: "rate" })
            : this.api("provider_rates", d),
      );
      return;
    }
    if (action === "connection") {
      this.form(
        "Connect Lunch Flow",
        this.field("name", "Name", "Lunch Flow") +
          this.field("api_key", "Personal API key", "", "password") +
          '<p class="full muted">Create an API destination in Lunch Flow, then select the accounts you want to share with this integration.</p>',
        (d) => save({ ...d, kind: "connection", enabled: true }),
      );
      return;
    }
    if (action === "holdings") {
      const a = this.obj(id);
      const holdings = a.bank_holdings.holdings;
      const mapping = this.list("mapping").find((m) => m.account_id === id);
      this.form(
        "Bank holdings",
        this.field(
          "date",
          "Position date",
          a.bank_checked || this.today(),
          "date",
        ) +
          '<p class="full">Compare the bank snapshot with your journal. Initialize positions only in an empty portfolio.</p>' +
          holdings
            .map(
              (h, index) =>
                `<div class="full box"><strong translate="no">${esc(h.security.name)} · ${esc(h.quantity)}</strong><p>${this.m(h.value, h.currency || h.security.currency)}</p>${this.field("security:" + index, "Instrument", "", "text", this.list("instrument"), true)}${this.field("cost:" + index, "Acquisition cost", h.costBasis ?? "", "number")}</div>`,
            )
            .join(""),
        (d) =>
          this.api("provider_holdings_open", {
            account_id: id,
            connection_id: mapping.connection_id,
            date: d.date,
            instrument_mapping: Object.fromEntries(
              holdings.map((h, index) => [
                String(index),
                d["security:" + index],
              ]),
            ),
            cost_basis: Object.fromEntries(
              holdings.map((h, index) => [String(index), d["cost:" + index]]),
            ),
          }),
        "Initialize positions",
      );
      return;
    }
    if (action === "mapping") {
      const data = await this.api("provider_accounts", { connection_id: id });
      this.form(
        "Choose accounts",
        this.field(
          "remote_id",
          "Lunch Flow account",
          "",
          "text",
          data.accounts.map((a) => [String(a.id), `${a.name} (${a.currency || this.t("Currency checked when linking")})`]),
          true,
        ) +
          this.field(
            "account_id",
            "Local account",
            "",
            "text",
            this.list("account").filter((a) => a.can_write),
            true,
          ) +
          this.field("from", "Import from", this.today(), "date"),
        (d) => this.api("provider_map", { ...d, connection_id: id }),
      );
      return;
    }
    if (action === "sync-preview") {
      const data = await this.api("provider_preview", { connection_id: id });
      this.form(
        "Preview synchronization",
        `<p class="full">${data.added} <span>new transactions</span> · ${data.updated} <span>updates</span> · ${data.conflicts} <span>conflicts</span></p><div class="full table"><table>${data.rows.map((r) => `<tr><td>${r.date}</td><td translate="no">${esc(r.description)}</td><td>${esc(r.amount)}</td></tr>`).join("")}</table></div>`,
        () =>
          this.api("provider_sync", {
            connection_id: id,
            confirm_initial: true,
          }),
        "Synchronize",
      );
      return;
    }
    if (action === "sync") {
      await this.api("provider_sync", { connection_id: id });
      await this.load();
      return;
    }
    if (action === "disconnect") {
      await this.api("provider_disconnect", { connection_id: id });
      await this.load();
      return;
    }
    if (action === "budget-link") {
      const data = await this.hass.callWS({
        type: "autonomous_budget/finance",
        command: "budgets",
      });
      this.form(
        "Link an account",
        this.field(
          "account_id",
          "Account",
          "",
          "text",
          this.list("account").filter((a) =>
            ["cash", "checking", "savings", "credit"].includes(a.type),
          ),
          true,
        ) +
          this.field("budget_id", "Budget", "", "text", data, true) +
          this.field("percentage", "Balance percentage", "100", "number") +
          '<p class="full muted">Linked budget access is restricted to users who can read every linked account.</p>',
        (d) => save({ ...d, kind: "budget_link" }),
      );
      return;
    }
    if (action === "remove-link") {
      await this.api("delete", { id }, true);
      await this.load();
      return;
    }
    if (action === "conflict") {
      const c = this.obj(id);
      this.form(
        "Review conflict",
        `<p class="full" translate="no">${esc(c.incoming.description)} · ${esc(c.incoming.date)} · ${esc(c.incoming.amount)}</p>` +
          this.field(
            "match_id",
            "Match existing transaction",
            "",
            "text",
            c.matches.map((x) => [x, x]),
          ) +
          this.check("keep_separate", "Keep as a separate transaction", false),
        (d) => this.api("resolve_conflict", { ...d, id }, true),
      );
      return;
    }
    if (action === "import") {
      this.form(
        "Import transactions",
        '<label class="full"><span>File</span><input name="upload" type="file" accept=".csv,.ofx,.qfx,.qif" required></label>' +
          this.field(
            "format",
            "Format",
            "csv",
            "text",
            ["csv", "ofx", "qfx", "qif"].map((v) => [v, v.toUpperCase()]),
            true,
          ) +
          this.field("date_format", "Date format", "%Y-%m-%d") +
          this.field("delimiter", "CSV separator", ",") +
          this.field(
            "decimal",
            "Decimal separator",
            ".",
            "text",
            [
              [".", "."],
              [",", ","],
            ],
            true,
          ) +
          [
            "date",
            "amount",
            "payee",
            "description",
            "external_id",
            "action",
            "quantity",
            "price",
            "fee",
            "instrument_ref",
            "category_name",
            "source_name",
            "transfer_account_name",
          ]
            .map((k) => this.field("column_" + k, "Column: " + k, k))
            .join(""),
        async (d, form) => {
          const file = form.querySelector("[type=file]").files[0];
          if (file.size > 10000000)
            throw Error("Import files must be smaller than 10 MB.");
          const payload = {
            account_id: id,
            file: await file.text(),
            format: d.format,
            options: {
              date_format: d.date_format,
              delimiter: d.delimiter,
              decimal: d.decimal,
              columns: Object.fromEntries(
                [
                  "date",
                  "amount",
                  "payee",
                  "description",
                  "external_id",
                  "action",
                  "quantity",
                  "price",
                  "fee",
                  "instrument_ref",
                  "category_name",
                  "source_name",
                  "transfer_account_name",
                ].map((k) => [k, d["column_" + k]]),
              ),
            },
          };
          const preview = await this.api("import_preview", payload);
          setTimeout(() => this.importPreview(payload, preview), 0);
        },
        "Preview",
      );
      return;
    }
    if (action === "backup") {
      const data = await this.api("export");
      this.download(
        "autonomous-budget-finance.json",
        JSON.stringify(data, null, 2),
        "application/json",
      );
      return;
    }
    if (action === "restore") {
      this.form(
        "Restore backup",
        '<label class="full"><span>Backup file</span><input type="file" name="upload" accept=".json" required></label><p class="full">Restore into an empty finance workspace. Existing budgets are preserved; restored budgets are added separately.</p>',
        async (d, form) => {
          const backup = JSON.parse(
            await form.querySelector("[type=file]").files[0].text(),
          );
          await this.api("restore", { backup }, true);
        },
      );
      return;
    }
  }
  bankBalance(value, unit) {
    const data = value.balance ?? value;
    const amount =
      typeof data === "object"
        ? (data.amount ?? data.value ?? data.current)
        : data;
    return amount === undefined
      ? this.t("Unavailable")
      : this.m(amount, data.currency || value.currency || unit);
  }
  splitRow(s) {
    return `<div class="splits"><input data-key="amount" type="number" step="any" value="${esc(s.amount || "")}" aria-label="Split amount"><select data-key="category_id" aria-label="Split category">${this.opts(this.list("category"), s.category_id)}</select><select data-key="budget_id" aria-label="Split budget">${this.opts(this.budgets || [], s.budget_id)}</select><select data-key="item_id" aria-label="Planned entry">${this.opts(
      (this.budgets || []).flatMap((b) =>
        (b.items || []).map((i) => ({
          id: i.id,
          name: b.name + " · " + i.name,
        })),
      ),
      s.item_id,
    )}</select><button type="button" data-action="split-remove" aria-label="Remove split">×</button></div>`;
  }
  showSearch(results, provider) {
    this.searchProvider = provider;
    this.form(
      "Search results",
      `<div class="full">${results.map((r, i) => `<div class="toolbar"><span translate="no">${esc(r.symbol)} · ${esc(r.name)} · ${esc(r.exchange)}</span>${this.button("search-use", "Use", String(i))}</div>`).join("")}</div>`,
      async () => {},
      "Done",
    );
  }
  importPreview(payload, preview, session = null) {
    session ||= {
      payload,
      values: {},
      excluded: new Set(),
      separate: new Set(),
    };
    this.importSession = session;
    session.preview = preview;
    const categoryNames = preview.category_names || [];
    const securityNames = preview.security_names || [];
    const transferNames = preview.transfer_names || [];
    const accountNames = preview.source_accounts || [];
    const fields = (values, prefix, title, rows) =>
      values
        .map((name, index) =>
          this.field(
            prefix + index,
            `${this.t(title)}: ${name}`,
            "",
            "text",
            rows,
            true,
          ),
        )
        .join("");
    this.form(
      "Import preview",
      `<div class="full"><p>${preview.total} <span>transactions</span> · <span>Import includes selected rows from every page.</span></p><div class="toolbar">${preview.offset ? this.button("import-previous", "Previous") : ""}${preview.offset + preview.limit < Math.max(preview.total, preview.error_count) ? this.button("import-next", "Next") : ""}</div>${preview.errors.map((e) => `<p class="error" translate="no">${e.line}: ${esc(e.message)}</p>`).join("")}<div class="table"><table>${preview.rows.map((r) => `<tr><td><input name="line:${r.line}" type="checkbox" ${!r.duplicate && !session.excluded.has(r.line) && (!r.possible_matches.length || session.separate.has(r.line)) ? "checked" : ""} ${r.duplicate ? "disabled" : ""}></td><td>${r.date}</td><td translate="no">${esc(r.payee || r.description)}</td><td>${r.amount}</td><td>${r.duplicate ? "Duplicate" : r.possible_matches.length ? "Possible duplicate" : ""}</td></tr>`).join("")}</table></div></div>` +
        fields(categoryNames, "cat:", "Category", this.list("category")) +
        fields(
          securityNames,
          "security:",
          "Instrument",
          this.list("instrument"),
        ) +
        fields(
          transferNames,
          "transfer:",
          "Destination account",
          this.list("account"),
        ) +
        (accountNames.length > 1
          ? fields(accountNames, "source:", "Account", this.list("account"))
          : "") +
        preview.rows
          .filter((r) => r.transfer_account_name)
          .map((r) =>
            this.field(
              "other:" + r.line,
              "Amount in the other account",
              "",
              "number",
            ),
          )
          .join("") +
        preview.rows
          .filter((r) => r.entry_type === "trade")
          .map((r) =>
            this.field(
              "fx:" + r.line,
              "Historical exchange rate",
              "",
              "number",
            ),
          )
          .join("") +
        this.check(
          "accept_valid_rows",
          "Import valid rows despite reported errors",
          false,
        ),
      (d) => {
        this.captureImport();
        d = { ...session.values, ...d };
        const mapping = (values, prefix) =>
          Object.fromEntries(
            values
              .map((name, index) => [name, d[prefix + index]])
              .filter(([, value]) => value),
          );
        return this.api(
          "import",
          {
            ...payload,
            excluded_lines: [...session.excluded],
            keep_separate: [...session.separate],
            accept_valid_rows: d.accept_valid_rows,
            category_mapping: mapping(categoryNames, "cat:"),
            instrument_mapping: mapping(securityNames, "security:"),
            transfer_mapping: mapping(transferNames, "transfer:"),
            account_mapping: mapping(accountNames, "source:"),
            transfer_amounts: Object.fromEntries(
              Object.entries(d)
                .filter(([k, v]) => k.startsWith("other:") && v)
                .map(([k, v]) => [k.slice(6), v]),
            ),
            exchange_rates: Object.fromEntries(
              Object.entries(d)
                .filter(([k, v]) => k.startsWith("fx:") && v)
                .map(([k, v]) => [k.slice(3), v]),
            ),
          },
          true,
        );
      },
      "Import",
    );
    for (const input of this.shadowRoot.querySelectorAll(
      "dialog form input, dialog form select, dialog form textarea",
    )) {
      if (input.name in session.values) {
        if (input.type === "checkbox")
          input.checked = session.values[input.name];
        else input.value = session.values[input.name];
      }
    }
  }
  captureImport() {
    const session = this.importSession;
    const form = this.shadowRoot.querySelector("dialog form");
    if (!session || !form) return;
    for (const input of form.querySelectorAll("input, select, textarea")) {
      if (!input.name) continue;
      const value = input.type === "checkbox" ? input.checked : input.value;
      session.values[input.name] = value;
      if (input.name.startsWith("line:")) {
        const line = Number(input.name.slice(5));
        if (value) {
          session.excluded.delete(line);
          session.separate.add(line);
        } else {
          session.excluded.add(line);
          session.separate.delete(line);
        }
      }
    }
  }
  csvCell(value) {
    const text = String(value ?? "");
    return (
      '"' +
      (/^[=+@-]/.test(text) && !/^[-+]?\d+(\.\d+)?$/.test(text) ? "'" : "") +
      text.replaceAll('"', '""') +
      '"'
    );
  }
  download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
customElements.define("autonomous-finance-panel", FinancePanel);
