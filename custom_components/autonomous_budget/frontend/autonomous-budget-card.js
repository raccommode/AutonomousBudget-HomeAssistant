import { BudgetLiveElement, baseCSS, dateLabel, esc, icon, labels, money } from "./shared.js?v=0.1.0";

class AutonomousBudgetCard extends BudgetLiveElement {
  setConfig(config) { this.config = { show_categories: true, show_upcoming: true, ...config }; this.render(); }
  static getConfigElement() { return document.createElement("autonomous-budget-card-editor"); }
  static getStubConfig() { return { show_categories: true, show_upcoming: true }; }
  getCardSize() { return this.config?.show_upcoming ? 6 : 4; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  render() {
    if (!this.config) return;
    const budget = this.config.budget_id ? this.data?.budgets.find((item) => item.id === this.config.budget_id) : this.data?.budgets[0];
    const css = `ha-card{display:block;padding:22px;border-radius:var(--ha-card-border-radius,14px);background:var(--ha-card-background,var(--ab-surface));border:1px solid var(--ab-line);overflow:hidden}header{margin-bottom:20px}.mark{color:var(--ab-green)}.value{font-size:32px;font-weight:600;margin:4px 0 2px;overflow-wrap:anywhere}.totals{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:17px 0;border-bottom:1px solid var(--ab-line)}.totals b{display:block;margin-top:4px;font-size:16px;overflow-wrap:anywhere}.small{font-size:11px}.categories{display:flex;flex-wrap:wrap;gap:12px;margin-top:17px}.category{flex:1;min-width:85px}.category b{display:block;font-size:12px;margin:5px 0}.due{margin-top:18px;border-top:1px solid var(--ab-line);padding-top:15px}.due-row{padding:7px 0;gap:8px;font-size:12px}.due-row span:first-child{overflow-wrap:anywhere}.due-row .number{white-space:nowrap}a{display:flex;align-items:center;justify-content:space-between;text-decoration:none;font-size:12px;margin-top:20px}h2{font-size:16px}header .muted{font-size:11px}`;
    if (!budget) { this.shadowRoot.innerHTML = `<style>${baseCSS}${css}</style><ha-card><h2>Autonomous Budget</h2><p class="muted" role="status">${esc(this.error || (this.data ? this.config.budget_id ? "This budget no longer exists. Choose another budget in the card editor." : "Create your first budget in the Autonomous Budget sidebar." : "Loading budgets…"))}</p></ha-card>`; return; }
    const m = (value) => money(value, budget.currency);
    const due = budget.schedule.filter((item) => item.date >= this.data.today).slice(0, 3);
    this.shadowRoot.innerHTML = `<style>${baseCSS}${css}</style><ha-card><header class="row between"><div><h2>${esc(this.config.title || budget.name)}</h2><span class="muted">${dateLabel(budget.period_start)} – ${dateLabel(budget.period_last_day, true)} · ${labels[this.data.settings.period]}</span></div><span class="mark">${icon("wallet")}</span></header><div class="muted small">Left after expenses</div><div class="value number ${Number(budget.totals.balance) < 0 ? "negative" : "positive"}">${m(budget.totals.balance)}</div><div class="muted small">Scheduled for this period</div><div class="totals"><div><span class="muted small">Expected income</span><b class="number">${m(budget.totals.income)}</b></div><div><span class="muted small">Planned expenses</span><b class="number">${m(budget.totals.expenses)}</b></div></div>${this.config.show_categories ? `<div class="categories">${["investment", "mandatory", "optional"].map((category) => `<div class="category"><span class="small muted"><i class="category-dot ${category}"></i> ${labels[category]}</span><b class="number">${m(budget.totals[category])}</b></div>`).join("")}</div>` : ""}${this.config.show_upcoming ? `<div class="due"><h3>Coming up</h3>${due.length ? due.map((item) => `<div class="row between due-row"><span>${esc(item.name)} <span class="muted small">· ${dateLabel(item.date)}</span></span><span class="number">${item.direction === "income" ? "+ " : ""}${m(item.amount)}</span></div>`).join("") : '<p class="muted small">Nothing else is due this period.</p>'}</div>` : ""}<a href="/autonomous-budget">Open Autonomous Budget ${icon("chevron")}</a></ha-card>`;
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
  setConfig(config) { this.config = { show_categories: true, show_upcoming: true, ...config }; this.render(); }
  render() {
    if (!this.config) return;
    this.shadowRoot.innerHTML = `<style>${baseCSS}label{display:block;margin:15px 0}select,input[type=text]{display:block;width:100%;padding:12px;margin-top:6px;border:1px solid var(--ab-line);border-radius:7px;background:var(--ab-surface);color:var(--ab-text)}input[type=checkbox]{accent-color:var(--ab-green);margin-right:8px}</style><label>Budget<select name="budget_id"><option value="">First available budget</option>${(this.data?.budgets || []).map((budget) => `<option value="${budget.id}" ${budget.id === this.config.budget_id ? "selected" : ""}>${esc(budget.name)} (${budget.currency})</option>`).join("")}</select></label><label>Title (optional)<input name="title" type="text" value="${esc(this.config.title)}"/></label><label><input type="checkbox" name="show_categories" ${this.config.show_categories ? "checked" : ""}/>Show expense categories</label><label><input type="checkbox" name="show_upcoming" ${this.config.show_upcoming ? "checked" : ""}/>Show upcoming payments</label>${this.error ? `<p class="error">${esc(this.error)}</p>` : ""}`;
  }
}
if (!customElements.get("autonomous-budget-card")) customElements.define("autonomous-budget-card", AutonomousBudgetCard);
if (!customElements.get("autonomous-budget-card-editor")) customElements.define("autonomous-budget-card-editor", AutonomousBudgetCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "autonomous-budget-card")) window.customCards.push({ type: "autonomous-budget-card", name: "Autonomous Budget", description: "Your budget, categories, and upcoming payments.", preview: true, documentationURL: "https://github.com/raccommode/AutonomousBudget-HomeAssistant" });
