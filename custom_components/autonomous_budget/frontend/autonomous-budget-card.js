import { BudgetLiveElement, baseCSS, esc, icon, labels } from "./shared.js?v=1.0.0";

// One definition keeps YAML defaults and the visual editor in sync.
const displayOptions = {
  show_title: "Show budget title",
  show_period: "Show period and dates",
  show_icon: "Show budget icon",
  show_balance: "Show remaining after expenses",
  show_calculation: "Show calculation label",
  show_income: "Show income",
  show_expenses: "Show expenses",
  show_shared: "Show common budget amount",
  show_categories: "Show expense categories",
  show_upcoming: "Show upcoming payments",
  show_reserves: "Show projected reserves",
  show_available_balance: "Show available after reserves",
  show_reserve_note: "Show reserve explanation",
  show_link: "Show link to Autonomous Budget",
};
const defaults = Object.fromEntries(Object.keys(displayOptions).map((key) => [key, true]));
function cardConfig(config) {
  return {view: "plan", ...defaults, ...config,
    // Older cards hid these together with reserves. New controls are independent.
    show_available_balance: config.show_available_balance ?? config.show_reserves ?? true,
    show_reserve_note: config.show_reserve_note ?? config.show_reserves ?? true,
  };
}

class AutonomousBudgetCard extends BudgetLiveElement {
  setConfig(config) { this.config = cardConfig(config); this.render(); }
  static getConfigElement() { return document.createElement("autonomous-budget-card-editor"); }
  static getStubConfig() { return cardConfig({}); }
  getCardSize() { return Math.max(1, Math.ceil(Object.keys(displayOptions).filter((key) => this.config?.[key]).length / 2)); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  render() {
    if (!this.config) return;
    const budget = this.config.budget_id ? this.data?.budgets.find((item) => item.id === this.config.budget_id) : this.data?.budgets[0];
    const css = `ha-card{display:block;padding:22px;border-radius:var(--ha-card-border-radius,14px);background:var(--ha-card-background,var(--ab-surface));border:1px solid var(--ab-line);overflow:hidden}header{margin-bottom:20px}.mark{color:var(--ab-green)}.value{font-size:32px;font-weight:600;margin:4px 0 2px;overflow-wrap:anywhere}.totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;padding:17px 0;border-bottom:1px solid var(--ab-line)}.totals b{display:block;margin-top:4px;font-size:16px;overflow-wrap:anywhere}.small{font-size:11px}.categories{display:flex;flex-wrap:wrap;gap:12px;margin-top:17px}.category{flex:1;min-width:85px}.category b{display:block;font-size:12px;margin:5px 0}.due{margin-top:18px;border-top:1px solid var(--ab-line);padding-top:15px}.due-row{padding:7px 0;gap:8px;font-size:12px}.due-row span:first-child{overflow-wrap:anywhere}.due-row .number{white-space:nowrap}a{display:flex;align-items:center;justify-content:space-between;text-decoration:none;font-size:12px;margin-top:20px}h2{font-size:16px}header .muted{font-size:11px}.reserve-note{margin-top:14px}`;
    if (!budget) { this.shadowRoot.innerHTML = `<style>${baseCSS}${css}</style><ha-card><h2>Autonomous Budget</h2><p class="muted" role="status">${esc(this.error || (this.data ? this.config.budget_id ? "This budget no longer exists. Choose another budget in the card editor." : "Create your first budget in the Autonomous Budget sidebar." : "Loading budgets…"))}</p></ha-card>`; return; }
    const planned = this.config.view !== "cashflow";
    const totals = planned ? budget.plan : budget.totals;
    const m = (value) => this.money(value, budget.currency);
    const due = budget.schedule.filter((item) => item.date >= this.data.today).slice(0, 3);
    const cfg = this.config;
    const shared = budget.kind === "shared" ? totals.expenses : budget.shared_contributions?.[planned ? "planned_amount" : "scheduled_amount"] || "0";
    const metric = (key, label, value) => `<div data-section="${key}"><span class="muted small">${label}</span><b class="number">${m(value)}</b></div>`;
    this.shadowRoot.innerHTML = `<style>${baseCSS}${css}</style><ha-card>
      ${cfg.show_title || cfg.show_period || cfg.show_icon ? `<header class="row between"><div>
        ${cfg.show_title ? `<h2 data-section="show_title"><span translate="no">${esc(cfg.title || budget.name)}</span></h2>` : ""}
        ${cfg.show_period ? `<span data-section="show_period" class="muted">${this.dateLabel(budget.period_start)} – ${this.dateLabel(budget.period_last_day, true)} · ${labels[budget.effective_period]}</span>` : ""}
      </div>${cfg.show_icon ? `<span data-section="show_icon" class="mark">${icon("wallet")}</span>` : ""}</header>` : ""}
      ${cfg.show_balance ? `<div data-section="show_balance"><div class="muted small">Left after expenses</div><div class="value number ${Number(totals.balance) < 0 ? "negative" : "positive"}">${m(totals.balance)}</div></div>` : ""}
      ${cfg.show_calculation ? `<div data-section="show_calculation" class="muted small">${planned ? "Per pay period" : "Scheduled for this period"}</div>` : ""}
      ${cfg.show_income || cfg.show_expenses || cfg.show_shared ? `<div class="totals">
        ${cfg.show_income ? metric("show_income", planned ? "Income per pay period" : "Expected income", totals.income) : ""}
        ${cfg.show_expenses ? metric("show_expenses", planned ? "Expenses per pay period" : "Planned expenses", totals.expenses) : ""}
        ${cfg.show_shared ? metric("show_shared", "Common budget amount", shared) : ""}
      </div>` : ""}
      ${cfg.show_categories ? `<section data-section="show_categories"><h3 style="margin-top:17px">Expenses by category</h3><div class="categories">${["investment", "mandatory", "optional"].map((category) => `<div class="category"><span class="small muted"><i class="category-dot ${category}"></i> ${labels[category]}</span><b class="number">${m(totals[category])}</b></div>`).join("")}</div>${budget.category_review.count ? `<p class="muted small">${budget.category_review.count} expenses need a category. Edit each expense to choose one.</p><div class="row between small"><span>To categorize</span><b>${m(budget.category_review[planned ? "planned_amount" : "scheduled_amount"])}</b></div>` : ""}</section>` : ""}
      ${cfg.show_reserves || (cfg.show_available_balance && budget.available_balance !== null) ? `<div class="due">
        ${cfg.show_reserves ? `<section data-section="show_reserves"><h3>Projected reserves</h3><div class="row between due-row"><span>Today</span><b class="number">${m(budget.reserves.amount)}</b></div></section>` : ""}
        ${cfg.show_available_balance && budget.available_balance !== null ? `<div data-section="show_available_balance" class="row between due-row"><span>Available after reserves</span><b class="number ${Number(budget.available_balance) < 0 ? "negative" : "positive"}">${m(budget.available_balance)}</b></div>` : ""}
      </div>` : ""}
      ${cfg.show_reserve_note ? '<p data-section="show_reserve_note" class="muted small reserve-note">Assumes earlier installments were saved and due bills were paid.</p>' : ""}
      ${cfg.show_upcoming ? `<section data-section="show_upcoming" class="due"><h3>Coming up</h3>${due.length ? due.map((item) => `<div class="row between due-row"><span><span translate="no">${esc(item.name)}</span> <span class="muted small">· ${this.dateLabel(item.date)}</span></span><span class="number">${item.direction === "income" ? "+ " : ""}${m(item.amount)}</span></div>`).join("") : '<p class="muted small">Nothing else is due this period.</p>'}</section>` : ""}
      ${cfg.show_link ? `<a data-section="show_link" href="/autonomous-budget">Open Autonomous Budget ${icon("chevron")}</a>` : ""}
    </ha-card>`;
  }
}

class AutonomousBudgetCardEditor extends BudgetLiveElement {
  constructor() {
    super();
    this.shadowRoot.addEventListener("change", (event) => {
      const target = event.target;
      this.config = { ...this.config, [target.name]: target.type === "checkbox" ? target.checked : target.value };
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
    });
  }
  setConfig(config) { this.config = cardConfig(config); this.render(); }
  render() {
    if (!this.config) return;
    this.shadowRoot.innerHTML = `<style>${baseCSS}label{display:block;margin:15px 0}select,input[type=text]{display:block;width:100%;padding:12px;margin-top:6px;border:1px solid var(--ab-line);border-radius:7px;background:var(--ab-surface);color:var(--ab-text)}input[type=checkbox]{accent-color:var(--ab-green);margin-right:8px}</style><label>Budget<select name="budget_id"><option value="">First available budget</option>${(this.data?.budgets || []).map((budget) => `<option translate="no" value="${budget.id}" ${budget.id === this.config.budget_id ? "selected" : ""}>${esc(budget.name)} (${budget.currency})</option>`).join("")}</select></label><label>Calculation view<select name="view"><option value="plan" ${this.config.view !== "cashflow" ? "selected" : ""}>Per pay period</option><option value="cashflow" ${this.config.view === "cashflow" ? "selected" : ""}>Due dates</option></select></label><label>Title (optional)<input name="title" type="text" value="${esc(this.config.title)}"/></label>${Object.entries(displayOptions).map(([key, label]) => `<label><input type="checkbox" name="${key}" ${this.config[key] ? "checked" : ""}/>${label}</label>`).join("")}${this.error ? `<p class="error">${esc(this.error)}</p>` : ""}`;
  }
}
if (!customElements.get("autonomous-budget-card")) customElements.define("autonomous-budget-card", AutonomousBudgetCard);
if (!customElements.get("autonomous-budget-card-editor")) customElements.define("autonomous-budget-card-editor", AutonomousBudgetCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "autonomous-budget-card")) window.customCards.push({ type: "autonomous-budget-card", name: "Autonomous Budget", description: "Your budget, categories, and upcoming payments.", preview: true, documentationURL: "https://github.com/raccommode/AutonomousBudget-HomeAssistant" });
