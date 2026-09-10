import { BudgetLiveElement, baseCSS, esc, money } from "./shared.js?v=1.4.1";

import { pageHeader, workspaceCSS } from "./ui.js?v=1.4.1";

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
  ok: "Up to date",
  partial: "Partial synchronization",
  unavailable: "Unavailable",
};
const CSS = `${baseCSS}
:host{display:block;background:var(--ab-bg);min-height:100%;padding:28px 36px}.heading,.toolbar,.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.heading{justify-content:space-between;margin-bottom:24px}.toolbar{margin:16px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.box{border:1px solid var(--ab-line);border-radius:14px;background:var(--ab-surface);padding:22px;margin-bottom:18px}.metric{font-size:28px;margin:10px 0;overflow-wrap:anywhere}.muted{color:var(--ab-muted)}.badge{background:var(--ab-pale);border-radius:8px;padding:3px 8px;font-size:12px}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--ab-line);white-space:nowrap}th{color:var(--ab-muted)}.negative{color:#be5141}.positive{color:var(--ab-green)}input,select,textarea{background:var(--ab-surface);color:var(--ab-text);border:1px solid var(--ab-line);border-radius:7px;padding:10px;max-width:100%;min-width:0;font:inherit}label{display:grid;gap:6px;font-size:13px}.form{display:grid;grid-template-columns:1fr 1fr;gap:15px}.full{grid-column:1/-1}.dialog{border:1px solid var(--ab-line);border-radius:15px;background:var(--ab-surface);color:var(--ab-text);padding:25px;width:min(760px,calc(100% - 24px));max-height:90dvh;overflow:auto}.dialog:not([open]),[hidden]{display:none!important}.dialog::backdrop{background:#102d2377}.dialog h2{margin-bottom:20px}.dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.error{color:#be5141;margin:12px 0}.empty{padding:45px;text-align:center}.chart{display:flex;align-items:end;gap:14px;height:180px;margin:24px 0}.column{flex:1;min-width:24px;text-align:center;font-size:11px}.bar{background:var(--ab-green);border-radius:5px 5px 0 0;min-height:2px}.splits{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px}.numbers{text-align:right;font-variant-numeric:tabular-nums}.wrap{white-space:normal;max-width:320px}.danger{color:#be5141}.text-link{border:0;background:none;padding:3px;text-decoration:underline}.notice{padding:14px;background:var(--ab-pale);border-radius:8px;margin-bottom:15px}details{margin:15px 0}summary{cursor:pointer;font-weight:600}@media(max-width:650px){:host{padding:18px 12px}.form{grid-template-columns:1fr}.full{grid-column:auto}.splits{grid-template-columns:1fr 1fr}.metric{font-size:23px}}@media print{.toolbar,button,.dialog{display:none!important}:host{background:white;padding:0}.box{break-inside:avoid}.table{overflow:visible}table{font-size:10px}}`;

const financeLayoutCSS = `
:host{padding:0;min-height:100%;container-type:inline-size}.grid{grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))}.box{padding:22px;margin-bottom:20px}.account-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(285px,100%),1fr));gap:16px}.account-card{display:flex;flex-direction:column;padding:20px;margin:0;min-width:0}.account-card-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}.account-symbol{width:40px;height:40px;border-radius:10px;background:var(--ab-pale);color:var(--ab-green);display:grid;place-items:center;flex:none}.account-symbol ha-icon{--mdc-icon-size:21px}.account-card h2{font-size:15px;overflow-wrap:anywhere}.account-card .institution{font-size:12px;color:var(--ab-muted);margin-top:3px}.account-card .metric{margin:4px 0 8px}.account-card>.muted,.account-card>small{font-size:12px}.account-card .balance-label{font-size:12px;color:var(--ab-muted)}.account-card .account-actions{display:flex;align-items:center;gap:8px;justify-content:space-between;border-top:1px solid var(--ab-line);padding-top:14px;margin-top:auto}.account-card .account-actions button{padding:7px 10px;min-height:36px}.account-card .account-actions button:last-child{background:transparent;border-color:transparent;color:var(--ab-muted)}.account-card .balance-block{margin-bottom:16px}.account-group{margin:0 0 28px}.account-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}.account-tools .search{flex:1;min-width:180px;max-width:400px}.account-tools select{width:auto;max-width:180px}.search{display:flex;align-items:center;gap:8px}.account-tools .toolbar{margin:0 0 0 auto}.mapping-row{font-size:12px;border-top:1px solid var(--ab-line);padding:12px 0;margin:8px 0}.mapping-row .toolbar{font-size:12px;gap:6px;margin:6px 0}.mapping-row button{padding:5px 8px;min-height:32px;font-size:12px}.mapping-row strong{font-weight:500}.mapping-row .link-description{color:var(--ab-muted)}.account-detail{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.account-detail .balance-block{text-align:right}.account-detail h2{font-size:22px}.account-detail>div{min-width:0}.account-detail .back{margin-bottom:14px}.journal-tools{justify-content:space-between}.journal-search{display:flex;flex-wrap:nowrap;gap:8px;align-items:center;min-width:240px}.journal-search input{min-width:140px;flex:1;width:auto}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}.settings-grid>.box{margin:0}.settings-grid>.wide{grid-column:1/-1}.settings-grid .description{color:var(--ab-muted);font-size:13px;margin:6px 0 18px}.connection-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px;margin-top:18px}.connection-item{border:1px solid var(--ab-line);border-radius:10px;padding:18px;background:var(--ab-surface-alt)}.connection-item .toolbar{margin:16px 0 0}.connection-item .toolbar button{font-size:12px;padding:7px 9px}.connection-item h3{margin-bottom:6px}.setting-row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--ab-line)}.setting-row:last-child{border:0}.setting-row p{font-size:12px;color:var(--ab-muted)}.overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.overview-hero{background:var(--ab-accent-solid);border-color:var(--ab-accent-solid);color:white}.overview-hero h2{color:#d5e9df;font-size:13px;font-weight:500}.overview-hero .metric{color:white;font-size:38px;margin:20px 0 12px}.overview-hero p:not(.metric),.overview-hero .muted{color:#d5e9df}.overview-hero button{color:white;background:transparent;border-color:#ffffff60;margin-top:22px}.overview-flow{display:grid;grid-template-columns:1fr 1fr;gap:16px}.overview-flow>.box{margin:0}.overview-flow .metric{font-size:24px}.overview-flow h2{font-size:13px;color:var(--ab-muted);font-weight:500}.overview-list{display:grid;gap:0}.overview-row{display:flex;align-items:center;gap:12px;justify-content:space-between;width:100%;border:0;border-radius:0;border-bottom:1px solid var(--ab-line);background:transparent;padding:14px 0;text-align:left;min-width:0}.overview-row>span{min-width:0}.overview-row strong{font-size:14px;font-weight:550;display:block;overflow-wrap:anywhere}.overview-row small{font-size:12px;color:var(--ab-muted);font-weight:400}.overview-row .value{white-space:nowrap;font-variant-numeric:tabular-nums;font-size:14px}.overview-list .overview-row:last-child{border:0}.overview-grid .box{margin:0}.overview-grid+.overview-grid{margin-top:20px}.report-metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin:20px 0}.report-metrics .box{margin:0;padding:20px}.report-metrics h2{font-size:13px;color:var(--ab-muted);font-weight:500}.report-metrics .metric{font-size:25px}.report-period{display:inline-flex;gap:8px;align-items:center;font-size:12px;background:var(--ab-surface-alt);padding:7px 10px;border-radius:6px}.chart{height:210px;padding-top:25px}.column{min-width:60px}.chart{overflow-x:auto}.chart .bar{max-width:80px;min-width:20px;margin:6px auto 8px}.report-details{padding:0;margin-bottom:20px}.report-details>summary{padding:18px 22px;cursor:pointer;font-size:14px;font-weight:600}.report-details[open]>summary{border-bottom:1px solid var(--ab-line);margin-bottom:20px}.report-details>.box{margin:0;border:0;border-radius:0}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ab-accent-solid);color:white;padding:12px 20px;z-index:20;box-shadow:0 6px 30px #0002}.portfolio-tabs{display:flex;gap:8px;overflow-x:auto;flex-wrap:nowrap}.portfolio-tabs button{flex:none}.portfolio-tabs button.active{background:var(--ab-pale);border-color:var(--ab-green);color:var(--ab-green)}
@container(max-width:850px){.overview-grid,.settings-grid{grid-template-columns:1fr}.settings-grid>.wide{grid-column:auto}.report-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.account-tools .toolbar{width:100%;margin-left:0}}
@media(max-width:900px){.overview-grid{grid-template-columns:1fr}.overview-flow{grid-template-columns:1fr 1fr}.settings-grid{grid-template-columns:1fr}.overview-hero .metric{font-size:32px}.account-tools .toolbar{width:100%;margin-left:0}}@media(max-width:650px){.account-grid{grid-template-columns:1fr}.account-card{padding:18px}.account-detail{display:block}.account-detail .balance-block{text-align:left;margin-top:20px}.account-tools .search{max-width:none}.account-tools select{max-width:none;flex:1}.account-tools .toolbar{gap:6px}.account-tools .toolbar button{font-size:12px}.account-actions button{min-height:44px!important}.mapping-row button{min-height:40px}.journal-search{width:100%}.journal-search input{flex:1}.settings-grid{gap:16px}.overview-flow{gap:12px}.overview-flow>.box{padding:16px}.overview-flow .metric{font-size:20px}.overview-row{align-items:flex-start}.report-metrics{grid-template-columns:1fr 1fr;gap:12px}.report-metrics .box{padding:16px}.report-metrics .metric{font-size:22px}.connection-item .toolbar button{min-height:40px}.box{padding:18px}.box.table{padding:0}.settings-grid>.wide{grid-column:auto}.account-group{margin-bottom:24px}}`;

export class FinancePanel extends BudgetLiveElement {
  constructor() {
    super();
    this.page = "accounts";
    this.records = [];
    this.filters = {};
    this.selected = null;
    this.shadowRoot.innerHTML = `<style>${CSS}${workspaceCSS}${financeLayoutCSS}</style><main></main><dialog class="dialog" aria-labelledby="finance-dialog-title"></dialog><div data-notifications role="status" aria-live="polite"></div>`;
    this.shadowRoot.addEventListener("click", (e) => this.click(e));
    this.shadowRoot.addEventListener("input", (e) => {
      if (e.target.name === "account-search") {
        this.accountSearch = e.target.value;
        this.refreshAccountList();
      }
    });
    this.shadowRoot.addEventListener("change", (e) => {
      if (e.target.name === "account-type-filter") {
        this.accountType = e.target.value;
        this.refreshAccountList();
      }
      if (
        e.target.name === "type" &&
        this.shadowRoot.querySelector("[data-cost-method]")
      )
        this.shadowRoot.querySelector("[data-cost-method]").hidden =
          e.target.value !== "investment";
    });
    this.shadowRoot.addEventListener("submit", (e) => {
      if (!e.target.matches("[data-journal-search]")) return;
      e.preventDefault();
      this.filters.search = new FormData(e.target).get("journal-search");
      this.filters.offset = 0;
      this.loadPage();
    });
  }
  connectedCallback() {
    super.connectedCallback();
    this.beforePrint = () => {
      this.closedReports = [
        ...this.shadowRoot.querySelectorAll(
          "details.report-details:not([open])",
        ),
      ];
      this.closedReports.forEach((el) => (el.open = true));
    };
    this.afterPrint = () => {
      this.closedReports?.forEach((el) => (el.open = false));
      this.closedReports = [];
    };
    window.addEventListener("beforeprint", this.beforePrint);
    window.addEventListener("afterprint", this.afterPrint);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.toastTimer);
    window.removeEventListener("beforeprint", this.beforePrint);
    window.removeEventListener("afterprint", this.afterPrint);
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
          ...(page === "overview" ? {} : this.reportFilters),
          summary: page === "overview",
          overview: page === "overview",
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
    if (
      !this.hass?.user?.is_admin &&
      [
        "account-new",
        "portfolio-new",
        "pocket",
        "instrument-new",
        "asset-new",
        "loan-new",
        "connection",
        "budget-link",
        "restore",
      ].includes(action)
    )
      return "";
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
    return `<label><span>${esc(text)}</span>${choices ? `<select name="${key}" aria-label="${esc(text)}" ${required ? "required" : ""}>${this.opts(choices, value, !required)}</select>` : `<input name="${key}" aria-label="${esc(text)}" type="${type}" value="${esc(value ?? "")}" ${required ? "required" : ""} ${type === "number" ? 'step="any"' : ""}>`}</label>`;
  }
  check(key, text, value) {
    return `<label class="row"><input type="checkbox" name="${key}" ${value ? "checked" : ""}><span>${esc(text)}</span></label>`;
  }
  form(title, html, onSubmit, submit = "Save") {
    const dialog = this.shadowRoot.querySelector("dialog");
    dialog.innerHTML = `<header><h2 id="finance-dialog-title">${esc(title)}</h2><button type="button" class="quiet icon" data-action="dismiss" aria-label="${esc(this.t("Close"))}"><ha-icon icon="mdi:close" aria-hidden="true"></ha-icon></button></header><form><div class="form">${html}</div><p class="error" role="alert"></p><footer><button type="button" data-action="close">Cancel</button><button class="primary" type="submit">${esc(submit)}</button></footer></form>`;
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
        if (submit === "Save" || submit === "Synchronize")
          this.announce("Changes saved.");
      } catch (err) {
        dialog.querySelector("[role=alert]").textContent = err.message;
        button.disabled = false;
      }
    };
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("input:not([type=checkbox]),select,textarea")?.focus();
  }
  announce(message) {
    const host = this.shadowRoot.querySelector("[data-notifications]");
    host.innerHTML = `<div class="toast">${esc(this.t(message))}</div>`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => host.replaceChildren(), 3000);
  }
  render() {
    const main = this.shadowRoot.querySelector("main");
    if (!main) return;
    const descriptions = {
      overview: "Accounts and budgets assigned to you, in one place.",
      accounts: "Balances, transactions and bank connections, in one place.",
      investments: "Follow your positions, cash and investment activity.",
      assets: "Track the value of your property, assets and loans.",
      reports: "Understand your cash flow and compare your plans with reality.",
      settings: "Manage your connections, preferences and financial data.",
    };
    const actions =
      this.page === "accounts" && !this.selected
        ? this.button("account-new", "Add account", "", true)
        : this.page === "investments"
          ? this.button("portfolio-new", "Add portfolio", "", true)
          : this.page === "assets"
            ? this.button("asset-new", "Add asset", "", true)
            : this.page === "overview" &&
                this.prefs?.modules?.accounts !== false
              ? this.button("navigate", "View accounts", "accounts", true)
              : this.page === "reports"
                ? this.button("report-filter", "Period and currency", "", true)
                : "";
    main.innerHTML =
      pageHeader(
        names[this.page] || "Accounts",
        descriptions[this.page] || descriptions.accounts,
        this.button("refresh", "Refresh") + actions,
      ) +
      (this.error
        ? `<p role="alert" class="error">${esc(this.error)}</p>`
        : "") +
      (!this.data
        ? '<p class="empty" role="status">Loading…</p>'
        : this.page === "accounts"
          ? this.accounts()
          : this.page === "investments"
            ? this.investments()
            : this.page === "assets"
              ? this.assets()
              : this.page === "settings"
                ? this.settings()
                : this.page === "overview"
                  ? this.overview()
                  : this.reports());
  }
  overview() {
    const r = this.report;
    if (!r) return '<p role="status">Loading…</p>';
    const accounts = this.list("account").filter(
      (a) => !a.archived && a.assigned_user_id === this.hass.user.id,
    );
    const metric = (label, value) =>
      `<section class="box"><h2>${label}</h2><p class="metric">${this.m(value)}</p></section>`;
    return `${!r.complete ? '<p class="notice">Incomplete overview: a bank balance, exchange rate or investment value is unavailable.</p>' : ""}<p class="muted small">Latest bank balances for connected accounts; ledger balances for manual accounts.</p><div class="overview-grid"><section class="box overview-hero"><h2>Net worth</h2><p class="metric">${this.m(r.net_worth)}</p><p>Your account balances and investments, minus debts.</p><p class="small">${esc(r.to)} · ${esc(r.currency)}</p>${this.prefs?.modules?.reports !== false ? this.button("navigate", "Explore reports", "reports") : ""}</section><div class="overview-flow">${metric("Income", r.income)}${metric("Expenses", r.expenses)}${metric("Cash flow", r.cashflow)}${metric("Debt", r.debt)}</div></div><p class="muted small" style="margin:12px 0 22px"><span>Income and expenses from the journal</span> · <span>Reporting period</span> · ${esc(r.from)} — ${esc(r.to)}</p><div class="overview-grid"><section class="box" ${this.prefs?.modules?.accounts === false ? "hidden" : ""}><div class="section-heading"><h2>Accounts</h2>${this.button("navigate", "View all", "accounts")}</div><div class="overview-list">${
      accounts
        .slice(0, 6)
        .map(
          (a) =>
            `<button class="overview-row" data-action="overview-account" data-id="${esc(a.id)}"><span><strong translate="no">${esc(a.name)}</strong><small>${this.t(names[a.type])} · ${this.t(this.list("mapping").some((m) => m.account_id === a.id) ? "Bank balance" : "Ledger balance")}</small></span><span class="value">${this.m(this.list("mapping").some((m) => m.account_id === a.id) ? a.bank_amount : a.balance, a.currency)}</span></button>`,
        )
        .join("") ||
      '<p class="empty">No accounts assigned to you. Assign a Home Assistant user in Edit account.</p>'
    }</div></section><section class="box" ${this.prefs?.modules?.budgets === false ? "hidden" : ""}><div class="section-heading"><h2>Budgets</h2>${this.button("navigate", "View all", "budgets")}</div><p class="muted">Your assigned budgets. Shared contributions remain included in their calculations.</p><div class="overview-list">${
      (this.budgets || [])
        .filter((b) => b.assigned_user_id === this.hass.user.id)
        .slice(0, 6)
        .map(
          (b) =>
            `<button class="overview-row" data-action="overview-budget" data-id="${esc(b.id)}"><span><strong translate="no">${esc(b.name)}</strong><small>Open budget planning</small></span><ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></button>`,
        )
        .join("") ||
      '<p class="empty">No budgets assigned to you. Assign a Home Assistant user in Edit budget.</p>'
    }</div></section></div>`;
  }
  refreshAccountList() {
    const list = this.shadowRoot.querySelector("[data-account-list]");
    if (list) list.innerHTML = this.accountGroups();
  }
  accountGroups() {
    const all = this.list("account").filter(
      (a) =>
        (this.showArchived || !a.archived) &&
        (!this.accountType || a.type === this.accountType) &&
        `${a.name} ${a.institution || ""} ${a.assigned_user_name || ""}`
          .toLocaleLowerCase()
          .includes((this.accountSearch || "").toLocaleLowerCase()),
    );
    if (!all.length)
      return '<section class="box empty"><h2>No accounts to display</h2><p>Add an account or adjust your search and filters.</p></section>';
    const icons = {
      checking: "bank-outline",
      savings: "piggy-bank-outline",
      cash: "cash-multiple",
      credit: "credit-card-outline",
      loan: "hand-coin-outline",
      investment: "chart-line",
    };
    return ["checking", "savings", "cash", "credit", "loan", "investment"]
      .map((type) => {
        const accounts = all.filter((a) => a.type === type);
        return accounts.length
          ? `<section class="account-group"><div class="section-heading"><h2>${this.t(names[type])}<span class="count">${accounts.length}</span></h2></div><div class="account-grid">${accounts.map((a) => `<section class="box account-card"><div class="account-card-header"><span class="account-symbol"><ha-icon icon="mdi:${icons[a.type]}" aria-hidden="true"></ha-icon></span><div><h2 translate="no">${esc(a.name)}</h2><p class="institution" translate="no">${esc(a.institution || a.currency)}</p></div></div><div class="balance-block">${this.accountBalance(a)}${a.assigned_user_name ? `<p class="muted small"><span>Assigned to</span>: <span translate="no">${esc(a.assigned_user_name)}</span></p>` : ""}</div>${this.accountLink(a)}<footer class="account-actions">${this.button("account-open", "Transactions", a.id)}${a.can_write ? this.button("account-edit", "Edit", a.id) : ""}</footer></section>`).join("")}</div></section>`
          : "";
      })
      .join("");
  }
  accountLink(acc) {
    const mapping = this.list("mapping").find((m) => m.account_id === acc.id);
    if (!mapping) return "";
    return `<div class="mapping-row" data-mapping-id="${esc(mapping.id)}"><small translate="no">${esc(this.obj(mapping.connection_id)?.name || "Lunch Flow")}</small><div class="toolbar"><span translate="no">${esc(mapping.remote_name || mapping.remote_id)}</span><span>is linked to</span><strong translate="no">${esc(acc.name)}</strong>${this.button("account-sync", "Synchronize", mapping.id)}${!mapping.initialized ? this.button("account-preview", "Review transactions", mapping.id) : ""}</div></div>`;
  }
  providerReason(reason) {
    const messages = {
      network: "Lunch Flow could not be reached. Try synchronizing again.",
      invalid_response:
        "Lunch Flow returned incomplete or invalid data for this account.",
      not_found:
        "This account or data is no longer available from Lunch Flow. Check the connection and account access in Lunch Flow.",
      unsupported:
        "The bank provider does not support this data for this account.",
      rate_limited:
        "Lunch Flow is limiting requests. Wait before synchronizing again.",
      provider_error:
        "Lunch Flow could not retrieve this data from the bank. Check the bank connection in Lunch Flow and retry.",
      currency_mismatch:
        "The bank balance currency differs from the local account currency. Check the account mapping.",
    };
    return messages[reason] ? this.t(messages[reason]) : "";
  }
  accountBalance(acc) {
    const linked = this.list("mapping").some((m) => m.account_id === acc.id);
    if (!linked)
      return `<p class="metric">${this.m(acc.balance, acc.currency)}</p>`;
    return `<span class="muted">Bank balance</span><p class="metric">${this.m(acc.bank_amount, acc.currency)}</p><p class="muted"><span>Ledger balance</span>: ${this.m(acc.balance, acc.currency)}</p>${acc.bank_checked ? `<small><span>Last synchronization</span> ${esc(this.dateTime(acc.bank_checked))}</small>` : ""}${acc.bank_balance_status === "unavailable" ? `<p class="error"><span>Bank balance unavailable. The last received value is retained.</span> ${esc(this.providerReason(acc.bank_balance_reason))}</p>` : ""}${acc.bank_holdings_status === "unavailable" ? `<p class="muted"><span>Investment holdings unavailable. The account remains connected.</span> ${esc(this.providerReason(acc.bank_holdings_reason))}</p>` : ""}${acc.bank_sync_error ? '<p class="error">Transactions could not be retrieved. Try synchronizing again.</p>' : ""}`;
  }
  accountConnectionPicker() {
    const form = this.shadowRoot.querySelector("dialog form");
    const connection = form.querySelector('[name="lunchflow_connection"]');
    const target = form.querySelector("[data-lunchflow-account]");
    const submit = form.querySelector('[type="submit"]');
    let generation = 0;
    connection.onchange = async () => {
      const current = ++generation;
      const connectionId = connection.value;
      target.hidden = !connectionId;
      target.innerHTML = "";
      form.querySelector('[role="alert"]').textContent = "";
      submit.disabled = !!connectionId;
      if (!connectionId) return;
      target.textContent = this.t("Loading…");
      try {
        const data = await this.api("provider_accounts", {
          connection_id: connectionId,
        });
        if (current !== generation || !form.isConnected) return;
        const available = data.accounts.filter(
          (a) =>
            !this.list("mapping").some(
              (m) =>
                m.connection_id === connectionId &&
                m.remote_id === String(a.id),
            ),
        );
        target.innerHTML = this.field(
          "lunchflow_remote",
          "Lunch Flow account",
          "",
          "text",
          available.map((a) => [
            String(a.id),
            `${a.name}${a.currency ? ` (${a.currency})` : ""}`,
          ]),
        );
        const remote = target.querySelector("select");
        remote.required = true;
        remote.onchange = () => {
          const selected = available.find((a) => String(a.id) === remote.value);
          if (!selected) return;
          if (!form.querySelector('[name="name"]').value)
            form.querySelector('[name="name"]').value = selected.name;
          if (selected.currency)
            form.querySelector('[name="currency"]').value = selected.currency;
          if (!form.querySelector('[name="institution"]').value)
            form.querySelector('[name="institution"]').value =
              selected.institution_name || "";
        };
        submit.disabled = !available.length;
        if (!available.length)
          form.querySelector('[role="alert"]').textContent = this.t(
            "No unlinked accounts are available for this connection.",
          );
      } catch (err) {
        if (current !== generation || !form.isConnected) return;
        target.innerHTML = "";
        form.querySelector('[role="alert"]').textContent = err.message;
      }
    };
  }
  accounts() {
    const acc = this.obj(this.selected);
    if (!acc)
      return `<div class="account-tools"><label class="search"><input type="search" name="account-search" aria-label="${esc(this.t("Search accounts"))}" placeholder="${esc(this.t("Search accounts"))}" value="${esc(this.accountSearch || "")}"></label><select name="account-type-filter" aria-label="${esc(this.t("Account type"))}"><option value="">${this.t("All account types")}</option>${["checking", "savings", "cash", "credit", "loan", "investment"].map((t) => `<option value="${t}" ${this.accountType === t ? "selected" : ""}>${this.t(names[t])}</option>`).join("")}</select><div class="toolbar">${this.button("categories", "Categories")}${this.button("archives", this.showArchived ? "Hide archived" : "Show archived")}${this.button("recurrences", "Recurring transactions")}</div></div><div data-account-list>${this.accountGroups()}</div>`;
    const journal = this.journal || { rows: [], total: 0 };
    return `<section class="box account-detail"><div><div class="back">${this.button("accounts-back", "All accounts")}</div><h2 translate="no">${esc(acc.name)}</h2><p class="muted" translate="no">${esc(acc.institution || acc.currency)}</p></div><div class="balance-block">${this.accountBalance(acc)}</div></section><div class="toolbar">${acc.can_write ? this.button("transaction-new", "Add transaction", acc.id, true) + this.button("transfer", "Transfer", acc.id) + this.button("import", "Import", acc.id) + this.button("reconcile", "Reconcile", acc.id) + this.button("account-edit", "Edit account", acc.id) : ""}${this.button("csv", "Export CSV")}${this.button("filter", "Filter")}</div>${this.accountLink(acc)}<form data-journal-search class="journal-search toolbar"><input type="search" name="journal-search" aria-label="${esc(this.t("Search transactions"))}" placeholder="${esc(this.t("Search transactions"))}" value="${esc(this.filters.search || "")}"><button type="submit">Search</button></form><section class="box table"><table><thead><tr><th><input type="checkbox" data-action="select-all" aria-label="Select all"></th><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${journal.rows.map((tx) => `<tr><td><input type="checkbox" name="selected-tx" value="${tx.id}" aria-label="Select transaction"></td><td>${esc(tx.date)}</td><td><span translate="no">${esc(tx.payee || tx.description)}</span><small class="muted" translate="no"> ${esc(tx.payee ? tx.description : "")}</small></td><td translate="no">${esc(tx.splits.map((s) => this.obj(s.category_id)?.name || "—").join(", "))}</td><td class="numbers ${Number(tx.amount) < 0 ? "negative" : "positive"}">${this.m(tx.amount, tx.currency)}</td><td><span class="status-pill ${tx.status}">${names[tx.status]}</span>${tx.historical ? '<small class="muted"> · Before opening balance</small>' : ""}</td><td>${acc.can_write ? this.button("transaction-edit", "Edit", tx.id) : ""}</td></tr>`).join("")}</tbody></table>${!journal.rows.length ? '<p class="empty">No transactions in this view.</p>' : ""}<div class="toolbar"><span>${journal.total}</span><span>transactions</span>${this.button("previous", "Previous")}${this.button("next", "Next")}${acc.can_write ? this.button("bulk", "Edit selection") : ""}</div></section>`;
  }
  investments() {
    const portfolios = this.list("account").filter(
      (a) => a.type === "investment" && !a.portfolio_id,
    );
    const acc = this.obj(this.selected);
    return `<div class="toolbar">${this.button("instrument-new", "Add instrument")}${this.button("instrument-search", "Search markets")}${this.button("quote", "Set or refresh a quote")}</div><div class="toolbar portfolio-tabs">${portfolios.map((a) => `<button type="button" data-action="portfolio-open" data-id="${esc(a.id)}" class="${a.id === this.selected ? "active" : ""}" aria-pressed="${a.id === this.selected}" translate="no">${esc(a.name)}</button>`).join("")}</div>${acc ? `<section class="box"><h2 translate="no">${esc(acc.name)}</h2>${this.positions?.source === "Lunch Flow" ? `<p class="notice"><span>Positions synchronized from Lunch Flow</span> · ${esc(this.positions.as_of)}<br><span>Bank quantities and values are shown automatically. Missing acquisition costs remain unknown.</span></p>` : ""}${this.accountBalance(acc)}${this.accountLink(acc)}<div class="toolbar">${this.button("trade", "Record an operation", acc.id, true)}${this.button("pocket", "Add currency pocket", acc.id)}${acc.bank_holdings?.holdings?.length ? this.button("holdings", "Bank holdings", acc.id) : ""}</div><div class="table"><table><thead><tr><th>Instrument</th><th>Quantity</th><th>Cost</th><th>Market value</th><th>Unrealized gain</th><th>Realized gain</th><th>Quote date</th><th>Price source</th></tr></thead><tbody>${(this.positions?.positions || []).map((p) => `<tr><td translate="no">${esc(p.instrument.name)}</td><td class="numbers">${esc(p.quantity)}</td><td class="numbers">${this.m(p.cost, p.instrument.currency)}</td><td class="numbers">${this.m(p.value, p.instrument.currency)}</td><td class="numbers">${this.m(p.unrealized, p.instrument.currency)}</td><td class="numbers">${this.m(p.realized, p.instrument.currency)}</td><td>${esc(p.quote?.date || "—")}</td><td>${esc(p.quote?.source || "—")}</td></tr>`).join("")}</tbody></table></div>${!this.positions?.positions?.length ? `<p class="empty">${this.positions?.source === "Lunch Flow" ? "Lunch Flow returned no positions for this account." : "No positions recorded in this portfolio."}</p>` : ""}</section>` : '<section class="box empty">Choose a portfolio or create your first investment account.</section>'}${acc ? `<section class="box table"><h2>Investment history</h2><table><thead><tr><th>Date</th><th>Instrument</th><th>Operation</th><th>Quantity</th><th>Price</th><th></th></tr></thead><tbody>${(this.trades || []).map((t) => `<tr><td>${esc(t.date)}</td><td translate="no">${esc(this.obj(t.instrument_id)?.name)}</td><td>${esc(names[t.action] || t.action)}</td><td>${esc(t.quantity)}</td><td>${esc(t.price)}</td><td>${this.button("trade-edit", "Edit", t.id)}</td></tr>`).join("")}</tbody></table>${!this.trades?.length ? '<p class="empty">No investment operations recorded. Bank positions do not create purchases or sales.</p>' : ""}<div class="toolbar">${this.tradeOffset ? this.button("trades-previous", "Previous") : ""}${this.trades?.length === 100 ? this.button("trades-next", "Next") : ""}</div></section>` : ""}<section class="box"><h2>Instruments</h2>${this.list(
      "instrument",
    )
      .map(
        (i) =>
          `<div class="toolbar"><strong translate="no">${esc(i.name)}</strong><span translate="no">${esc(i.symbol || "")} · ${esc(i.currency)}</span><span>${esc(names[i.quote_status] || i.quote_status || "")}</span>${this.button("instrument-edit", "Edit", i.id)}${i.instrument_type === "bond" ? this.button("bond-schedule", "Schedule", i.id) : ""}</div>`,
      )
      .join("")}</section>`;
  }
  assets() {
    return `<div class="toolbar">${this.button("loan-new", "Add loan")}</div><div class="grid">${this.list(
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
    const html = `<div class="toolbar">${this.button("print", "Print / PDF")}${this.button("report-export", "Export report")}${!r.complete ? this.button("report-rates", "Get missing exchange rates") : ""}</div>${!r.complete ? '<p class="notice">Incomplete valuation: add the missing exchange rates or prices.</p>' : ""}<p class="report-period">${esc(r.from)} — ${esc(r.to)} · ${esc(r.currency)}</p><div class="grid report-metrics">${metric("Net worth", r.net_worth)}${metric("Income", r.income)}${metric("Expenses", r.expenses)}${metric("Cash flow", r.cashflow)}${metric("Debt", r.debt)}${metric("Realized gains", r.realized_gains)}${metric("Investment income", r.investment_income)}</div><section class="box"><h2>Expenses over time</h2><div class="chart">${months.map(([month, v]) => `<div class="column"><div>${this.m(v.expenses)}</div><div class="bar" style="height:${Math.max(2, (Number(v.expenses) / max) * 130)}px"></div><span>${month}</span></div>`).join("")}</div></section><details class="box report-details"><summary>Budget comparisons</summary><section class="box table"><h2>Planned versus actual</h2><table><thead><tr><th>Budget</th><th>Planned expenses</th><th>Actual expenses</th><th>Difference</th></tr></thead><tbody>${(r.budget_comparisons || []).map((b) => `<tr><td translate="no">${esc(b.name)}</td><td class="numbers">${this.m(b.planned_expenses)}</td><td class="numbers">${this.m(b.actual_expenses)}</td><td class="numbers">${this.m(b.expense_difference)}</td></tr>`).join("")}</tbody></table></section><section class="box table"><h2>Planned entries</h2><table><thead><tr><th>Budget</th><th>Planned entry</th><th>Income / expense</th><th>Planned</th><th>Actual</th><th>Difference</th></tr></thead><tbody>${(r.item_comparisons || []).map((i) => `<tr><td translate="no">${esc(i.budget_name)}</td><td translate="no">${esc(i.name)}</td><td>${i.direction === "income" ? "Income" : "Expense"}</td><td class="numbers">${this.m(i.planned)}</td><td class="numbers">${this.m(i.actual)}</td><td class="numbers">${this.m(i.difference)}</td></tr>`).join("")}</tbody></table></section></details><details class="box report-details"><summary>Investment details</summary><section class="box table"><h2>Investment allocation</h2><table><thead><tr><th>Instrument</th><th>Account</th><th>Market value</th><th>Quote date</th></tr></thead><tbody>${(r.investments || []).map((i) => `<tr><td translate="no">${esc(i.name)}</td><td translate="no">${esc(this.obj(i.account_id)?.name)}</td><td class="numbers">${this.m(i.value)}</td><td>${esc(i.quote_date || "—")}</td></tr>`).join("")}</tbody></table></section></details><details class="box report-details" open><summary>Detailed breakdowns</summary>${[
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
                `<tr><td translate="no">${esc(this.obj(id)?.name || (this.budgets || []).find((b) => b.id === id)?.name || this.t({ uncategorized: "Uncategorized", unassigned: "Unassigned" }[id] || id))}</td><td class="numbers">${this.m(v.income)}</td><td class="numbers">${this.m(v.expenses)}</td><td>${this.button("drill", "Transactions", d + ":" + id)}</td></tr>`,
            )
            .join("")}</tbody></table></section>`,
      )
      .join("")}</details>`;
    return html
      .replaceAll(
        "<tbody></tbody>",
        '<tbody><tr><td colspan="8" class="empty">No activity in this period.</td></tr></tbody>',
      )
      .replace(
        '<div class="chart"></div>',
        '<p class="empty">No activity in this period.</p>',
      );
  }
  settings() {
    const connections = this.list("connection"),
      conflicts = this.list("conflict");
    return `<div class="settings-grid"><section class="box"><h2>Modules and display</h2><p class="description">Hide modules without deleting their data.</p>${this.button("preferences", "Customize")}</section>
    <section class="box"><h2>Backup and restore</h2><p class="description">Keep a copy of your financial data. Connection keys are excluded.</p><div class="toolbar">${this.button("backup", "Download backup")}${this.button("restore", "Restore backup")}</div></section>
    <section class="box wide"><div class="section-heading"><h2>Lunch Flow</h2>${this.button("connection", "Connect Lunch Flow")}</div><p class="description">Optional bank synchronization. Your personal API key stays on this Home Assistant server.</p><p class="muted small">Choose a connection when adding or editing an account in Accounts.</p>
    ${connections.length ? `<div class="connection-grid">${connections.map((c) => `<article class="connection-item" data-connection-id="${esc(c.id)}"><h3 translate="no">${esc(c.name)}</h3><span class="status-pill ${c.enabled !== false ? "cleared" : ""}">${c.enabled !== false ? "Connected" : "Disconnected"}</span><p class="muted small"><span>Last synchronization</span> · ${c.last_sync ? esc(this.dateTime(c.last_sync)) : this.t("Not synchronized yet")}</p>${c.status ? `<p class="muted small">${esc(this.t(names[c.status] || c.status))}</p>` : ""}<div class="toolbar">${this.button("connection-rename", "Rename", c.id)}${c.enabled !== false ? this.button("sync-preview", "Preview synchronization", c.id) + this.button("sync", "Synchronize", c.id) + this.button("disconnect", "Disconnect", c.id) : ""}</div></article>`).join("")}</div>` : '<p class="empty">No bank connection. You can manage your accounts manually.</p>'}</section>
    <section class="box"><h2>Currencies and rates</h2><p class="description">Use dated exchange rates for accurate conversions.</p><div class="toolbar">${this.button("rate", "Add exchange rate")}${this.button("rate-fetch", "Get an exchange rate")}</div>${
      this.list("rate")
        .slice(-12)
        .map(
          (r) =>
            `<div class="setting-row"><div><strong translate="no">${esc(r.base)} / ${esc(r.currency)}</strong><p translate="no">${esc(r.date)} · ${esc(r.source)}</p></div><span class="number" translate="no">${esc(r.value)}</span></div>`,
        )
        .join("") || '<p class="muted small">No exchange rates recorded.</p>'
    }</section>
    <section class="box"><h2>Budget connections</h2><p class="description">Distribute account balances between budgets. Transactions are assigned separately.</p>${this.button("budget-link", "Link an account")}${
      this.list("budget_link")
        .map(
          (l) =>
            `<div class="setting-row"><div><strong translate="no">${esc(this.obj(l.account_id)?.name)}</strong><p translate="no">${esc((this.budgets || []).find((b) => b.id === l.budget_id)?.name || "")} · ${esc(l.percentage)}%</p></div>${this.button("remove-link", "Remove", l.id)}</div>`,
        )
        .join("") ||
      '<p class="muted small">No account balances linked to budgets.</p>'
    }</section>
    <section class="box wide"><div class="section-heading"><h2>Review conflicts<span class="count">${conflicts.length}</span></h2></div><p class="description">Review bank changes that need your decision.</p>${conflicts.map((c) => `<div class="setting-row"><span translate="no">${esc(c.incoming?.date)} ${esc(c.incoming?.description)} ${esc(c.incoming?.amount)}</span>${this.button("conflict", "Review", c.id)}</div>`).join("") || '<p class="muted small">Everything is up to date. No conflicts to review.</p>'}</section></div>`;
  }
  dateTime(value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return this.dateLabel(value, true);
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(this.language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
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
    if (action === "overview-budget") {
      this.dispatchEvent(
        new CustomEvent("finance-navigate", {
          detail: { page: "budgets", budgetId: id },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (action === "navigate") {
      this.dispatchEvent(
        new CustomEvent("finance-navigate", {
          detail: { page: id },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (action === "overview-account") {
      this.dispatchEvent(
        new CustomEvent("finance-navigate", {
          detail: { page: "accounts" },
          bubbles: true,
          composed: true,
        }),
      );
      this.selected = id;
      await this.loadPage();
      return;
    }
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
    if (action === "close" || action === "dismiss") {
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
      const users = await this.api("users");
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
      const linked =
        a.id && this.list("mapping").find((m) => m.account_id === a.id);
      const connections =
        action !== "pocket" && !linked
          ? this.list("connection").filter((c) => c.enabled !== false)
          : [];
      this.form(
        a.id
          ? "Edit account"
          : action === "pocket"
            ? "Add currency pocket"
            : action === "portfolio-new"
              ? "Add portfolio"
              : "Add account",
        '<fieldset class="form-section"><legend>Account details</legend>' +
          this.field("name", "Name", a.name, "text", null, true) +
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
          this.field("currency", "Currency", a.currency, "text", null, true) +
          this.field("institution", "Institution", a.institution) +
          this.field(
            "assigned_user_id",
            "Assigned Home Assistant user (optional)",
            a.assigned_user_id || "",
            "text",
            users,
          ) +
          '<p class="full muted small">All Home Assistant users can view and edit this account. Assignment does not restrict access.</p></fieldset>' +
          (linked || connections.length
            ? '<fieldset class="form-section"><legend>Bank connection</legend>' +
              (linked
                ? `<p class="full" translate="no">${esc(this.obj(linked.connection_id)?.name || "Lunch Flow")} · ${esc(linked.remote_name || linked.remote_id)}</p>` +
                  this.check(
                    "unlink_lunchflow",
                    "Disconnect this account from Lunch Flow",
                    false,
                  )
                : this.field(
                    "lunchflow_connection",
                    "Choose a Lunch Flow connection",
                    "",
                    "text",
                    connections,
                  ) + "<div data-lunchflow-account hidden></div>") +
              "</fieldset>"
            : "") +
          '<fieldset class="form-section"><legend>Starting balance</legend>' +
          this.field(
            "opening_date",
            "Opening date",
            a.opening_date,
            "date",
            null,
            true,
          ) +
          this.field(
            "opening_balance",
            "Opening balance",
            a.opening_balance,
            "number",
            null,
            true,
          ) +
          "</fieldset>" +
          `<div class="full" data-cost-method ${a.type === "investment" ? "" : "hidden"}>` +
          this.field(
            "cost_method",
            "Cost method",
            a.cost_method || "average",
            "text",
            enumRows(["average", "fifo"]),
            true,
          ) +
          "</div>" +
          '<details class="advanced"><summary>Advanced options</summary><div class="form-section">' +
          (a.id ? this.check("archived", "Archived", a.archived) : "") +
          this.check(
            "publish_sensors",
            "Publish amounts as Home Assistant sensors",
            a.publish_sensors,
          ) +
          '<p class="full muted small">Published sensor amounts can be read by other Home Assistant users.</p></div></details>',
        async (d) => {
          const {
            lunchflow_connection,
            lunchflow_remote,
            unlink_lunchflow,
            ...values
          } = d;
          const data = {
            ...a,
            ...values,
            kind: "account",
            ...(action === "pocket" ? { portfolio_id: id } : {}),
          };
          if (lunchflow_connection) {
            if (!lunchflow_remote)
              throw Error(this.t("Choose a Lunch Flow account."));
            if (a.id) {
              await save(data);
              await this.api("provider_map", {
                connection_id: lunchflow_connection,
                remote_id: lunchflow_remote,
                account_id: a.id,
              });
            } else {
              await this.api("provider_create_account", {
                connection_id: lunchflow_connection,
                remote_id: lunchflow_remote,
                account: data,
              });
            }
          } else {
            await save(data);
            if (linked && unlink_lunchflow)
              await this.api("provider_unmap", {
                connection_id: linked.connection_id,
                mapping_id: linked.id,
              });
          }
        },
      );
      if (connections.length) this.accountConnectionPicker();
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
        `<div class="full table"><p>${data.total} <span>transactions</span></p><table>${data.rows.map((r) => `<tr><td>${r.date}</td><td translate="no">${esc(r.payee || r.description)}</td><td class="numbers">${this.m(r.amount, r.currency)}</td></tr>`).join("")}</table><div class="toolbar">${this.drillOffset ? this.button("drill-previous", "Previous") : ""}${this.drillOffset + 100 < data.total ? this.button("drill-next", "Next") : ""}</div></div>`,
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
    if (action === "connection-rename") {
      const connection = this.obj(id);
      this.form(
        "Rename connection",
        this.field("name", "Name", connection.name),
        (d) => save({ kind: "connection", id, name: d.name }),
      );
      return;
    }
    if (action === "account-sync") {
      const mapping = this.obj(id);
      await this.api("provider_sync", {
        connection_id: mapping.connection_id,
        account_id: mapping.account_id,
        automatic: true,
      });
      await this.load();
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
    if (["sync-preview", "account-preview"].includes(action)) {
      const mapping = action === "account-preview" ? this.obj(id) : null;
      const payload = mapping
        ? {
            connection_id: mapping.connection_id,
            account_id: mapping.account_id,
          }
        : { connection_id: id };
      const data = await this.api("provider_preview", payload);
      this.form(
        "Preview synchronization",
        `<div class="full">${(data.warnings || []).map((w) => `<p class="error"><span translate="no">${esc(w.name)}</span>: ${esc(this.t(w.message))} ${esc(this.providerReason(w.reason))}</p>`).join("")}</div><p class="full">${data.added} <span>new transactions</span> · ${data.updated} <span>updates</span> · ${data.conflicts} <span>conflicts</span></p><div class="full table"><table>${data.rows.map((r) => `<tr><td>${r.date}</td><td translate="no">${esc(r.description)}</td><td>${esc(r.amount)}</td></tr>`).join("")}</table></div>`,
        () =>
          this.api("provider_sync", {
            ...payload,
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
