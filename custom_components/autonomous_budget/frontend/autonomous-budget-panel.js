import { BudgetLiveElement, baseCSS, esc, icon, labels, options } from "./shared.js?v=0.4.1";

const css = `
:host{height:100%;overflow:auto;background:var(--ab-bg)}.shell{max-width:1390px;margin:auto;padding:32px 42px 50px}.brand{gap:10px}.brand-mark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--ab-green);color:var(--ab-surface)}.brand-title{font-size:16px;font-weight:650;letter-spacing:-.5px}.topbar{padding-bottom:32px}.topbar .muted{font-size:12px}.heading{margin:8px 0 27px}.heading p{margin-top:5px}.budgets{display:flex;gap:9px;overflow-x:auto;padding:3px 0 20px;align-items:center}.budget-tab{white-space:nowrap;background:transparent;min-height:40px;padding:9px 16px}.budget-tab.active{color:var(--ab-green);border-color:var(--ab-green);background:var(--ab-pale)}.budget-tab small{color:var(--ab-muted);font-size:10px;letter-spacing:.8px}.period-bar{padding:18px 0 23px;border-top:1px solid var(--ab-line)}.period-title{font-size:16px;font-weight:600}.period-nav{display:flex;align-items:center;gap:5px}.period-nav button{background:transparent}.period-nav .prev svg{transform:rotate(180deg)}.stats{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-bottom:24px}.stat{border:1px solid var(--ab-line);border-radius:13px;background:var(--ab-surface);padding:24px}.stat .value{font-size:31px;font-weight:600;margin:12px 0 8px;line-height:1.3;overflow-wrap:anywhere}.stat.balance{background:#235d48;color:#fff;border-color:#235d48}.stat.balance .muted{color:#c8dfd1}.stat.balance .badge{background:#ffffff19;color:#e2f3e9}.stat.balance .negative{color:#ffd2c8}.stat-label{font-size:13px}.stat-icon{border-radius:8px;padding:7px;background:var(--ab-bg);color:var(--ab-muted);height:34px}.balance .stat-icon{background:#ffffff15;color:#e2f3e9}.layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:22px;align-items:start}.box{background:var(--ab-surface);border:1px solid var(--ab-line);border-radius:13px;overflow:hidden}.box-head{padding:22px 22px 18px}.tabs{display:flex;gap:20px;padding:0 22px;border-bottom:1px solid var(--ab-line)}.tabs button{border:0;border-radius:0;background:transparent;color:var(--ab-muted);padding:11px 0;font-size:12px;min-height:44px}.tabs button.active{color:var(--ab-green);box-shadow:inset 0 -2px var(--ab-green)}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}th{font-size:10px;color:var(--ab-muted);text-transform:uppercase;letter-spacing:1px;font-weight:550;padding:14px 22px;background:var(--ab-bg);white-space:nowrap}td{padding:16px 22px;border-top:1px solid var(--ab-line);font-size:12px;vertical-align:middle}td:first-child{min-width:180px}td:last-child,th:last-child{text-align:right;padding-left:0;padding-right:15px}td .entry-name{font-weight:600;font-size:13px;max-width:230px;overflow-wrap:anywhere}.entry-icon{width:35px;height:35px;border-radius:10px;display:grid;place-items:center;background:var(--ab-pale);color:var(--ab-green);flex-shrink:0;font-size:13px;font-weight:600}.entry-icon.income{background:#edf1e8;color:#5b7547}.entry-meta{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--ab-muted);margin-top:3px}.amount{white-space:nowrap;font-weight:600;font-size:13px}.small{font-size:11px}.table-foot{border-top:1px solid var(--ab-line);padding:13px 22px;font-size:11px;color:var(--ab-muted)}.side{display:grid;gap:20px}.category-list{padding:0 22px 22px;display:grid;gap:19px}.category-icon{width:35px;height:35px;background:var(--ab-pale);color:var(--ab-green);border-radius:10px;display:grid;place-items:center}.category-icon.mandatory{background:#f4eee5;color:#9a7955}.category-icon.optional{background:#efedf7;color:#877fa3}.category-list .amount{font-size:12px}.bar{height:5px;border-radius:10px;background:var(--ab-line);margin-top:11px;overflow:hidden}.bar span{display:block;height:100%;background:#78a18e;border-radius:10px}.bar .mandatory{background:#ab9475}.bar .optional{background:#9795bc}.schedule{padding:0 22px 10px}.due-row{padding:12px 0;border-bottom:1px solid var(--ab-line);gap:10px}.due-row:last-child{border:0}.date-tile{width:36px;text-align:center;flex-shrink:0;background:var(--ab-bg);border-radius:7px;line-height:1.3;padding:6px 2px}.date-tile b{display:block;font-size:14px}.date-tile span{font-size:8px;text-transform:uppercase}.due-name{max-width:130px;overflow-wrap:anywhere;font-size:12px}.due-row .amount{font-size:11px}.note{padding:3px 4px;color:var(--ab-muted);font-size:11px;line-height:1.8}.footer{margin-top:27px;font-size:11px;color:var(--ab-muted)}.mobile-menu{display:none}.no-budgets{max-width:680px;margin:60px auto}.toolbar{display:flex;gap:8px}.status{padding:50px}.dialog{padding:0;background:var(--ab-surface);color:var(--ab-text);border:1px solid var(--ab-line);border-radius:15px;max-width:550px;width:calc(100% - 32px);max-height:90dvh;box-shadow:0 24px 80px #0003}.dialog::backdrop{background:#102d2366;backdrop-filter:blur(3px)}.dialog header{padding:22px 24px 12px;display:flex;align-items:center;justify-content:space-between}.dialog form,.dialog-content{padding:8px 24px 24px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:550}.field.full{grid-column:1/-1}.field input,.field select{width:100%;min-height:43px;border:1px solid var(--ab-line);border-radius:8px;padding:10px 11px;background:var(--ab-bg);color:var(--ab-text);outline-offset:1px;min-width:0}.field small{font-size:11px;font-weight:400;color:var(--ab-muted)}.field input:disabled,.field select:disabled{opacity:.55}.checkbox{display:flex;align-items:center;gap:9px;font-size:13px}.checkbox input{accent-color:var(--ab-green);width:17px;height:17px}.dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}.form-error{font-size:12px;color:#b13d37;margin-top:14px}.help{padding:13px;background:var(--ab-bg);border-radius:8px;font-size:12px;color:var(--ab-muted);margin-bottom:18px}.dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:var(--ab-bg);border-radius:9px;font-size:12px;user-select:all}.dialog h3{margin:18px 0 8px}.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#235d48;color:white;border-radius:9px;padding:12px 22px;z-index:10;box-shadow:0 3px 20px #0002}.paused{opacity:.65}
.view-switch{display:flex;gap:5px;margin:-5px 0 18px}.view-switch button{font-size:12px;background:transparent}.view-switch .active{background:var(--ab-pale);border-color:var(--ab-green);color:var(--ab-green)}.main-column{display:grid;gap:22px;min-width:0}.reserve-list{padding:0 22px 8px}.reserve-entry{padding:15px 0;border-top:1px solid var(--ab-line)}.reserve-entry h3{overflow-wrap:anywhere}.reserve-entry .row{gap:8px}.reserve-total{font-size:23px}.reserve-amount{white-space:nowrap}.segments{display:flex;gap:2px;height:7px;margin:12px 0 7px}.segments span{flex:1;border-radius:4px;background:linear-gradient(to right,var(--ab-green) var(--fill),var(--ab-line) var(--fill))}.available-summary{padding:19px 22px;background:var(--ab-bg);border-top:1px solid var(--ab-line)}.available-summary p{margin:7px 0 0}.reserves .box-head{gap:12px}
.entry-group-heading th{text-transform:none;letter-spacing:0;padding:12px 22px;color:var(--ab-text)}.entry-group-heading.direction th{background:var(--ab-pale);font-weight:650}.entry-group-heading.direction h3{font-size:14px}.entry-group-heading.category h3{font-size:12px}.entry-group-heading.category th{font-size:12px;background:var(--ab-bg)}.group-count{font-size:10px;color:var(--ab-muted);font-weight:400;margin-left:6px}.period-nav{flex-shrink:0}
.sharing{margin-bottom:22px}.sharing-list{padding:0 22px 18px;display:grid;gap:10px}.share-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:var(--ab-bg);border-radius:9px}.share-row .share-person{min-width:0;overflow-wrap:anywhere}.share-row .share-amount{text-align:right;flex-shrink:0}.sharing-note{padding:0 22px 18px}.allocation-row{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:15px;align-items:center}.allocation-row span{overflow-wrap:anywhere}.allocation-total{grid-column:1/-1}.automatic{font-size:10px;color:var(--ab-green);margin-top:4px}.sharing .box-head{gap:10px;flex-wrap:wrap}
@media(max-width:1150px){.shell{padding:25px}.layout{grid-template-columns:minmax(0,1fr) 270px}td,th{padding-left:15px;padding-right:15px}.stat .value{font-size:25px}.hide-medium{display:none}}
@media(max-width:850px){.layout{grid-template-columns:1fr}.side{grid-template-columns:1fr 1fr}.side .note{grid-column:1/-1}.shell{padding:20px}.topbar{padding-bottom:23px}.topbar .desktop-label{display:none}.mobile-menu{display:inline-flex}.stat{padding:18px}.stat .value{font-size:23px}.heading{margin-bottom:20px}}
@media(max-width:560px){.shell{padding:16px 13px 35px}.brand-title{font-size:14px}.brand-mark{width:32px;height:32px}.topbar{gap:4px}.topbar .row{gap:5px}.heading{align-items:flex-start}.heading h1{font-size:25px}.heading p{font-size:12px;max-width:215px}.heading .primary{font-size:12px;padding:9px 11px}.stats{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.stat{padding:16px}.stat.balance{grid-column:1/-1}.stat .value{font-size:19px}.stat.balance .value{font-size:32px}.stat-label{font-size:11px}.stat-icon{display:none}.stat .muted{font-size:10px}.period-bar{padding:14px 0 18px;gap:8px}.period-title{font-size:13px}.period-bar .badge{font-size:9px}.period-nav button{padding:8px;min-width:32px}.side{grid-template-columns:1fr}.box-head{padding:18px 16px}.tabs{padding:0 16px}.hide-small{display:none}.entry-name{max-width:140px!important}.entry-icon{display:none}td:first-child{min-width:125px}td,th{padding:13px 14px}.amount{font-size:11px}.form-grid{gap:12px}.dialog header{padding:17px 18px 8px}.dialog form,.dialog-content{padding:8px 18px 20px}.footer{align-items:flex-start;gap:8px}.budget-tab{font-size:12px}.box-head .primary{font-size:12px}}
`;

class AutonomousBudgetPanel extends BudgetLiveElement {
  constructor() {
    super();
    this.filter = "all";
    this.viewMode = "plan";
    this.shadowRoot.innerHTML = `<style>${baseCSS}${css}</style><main class="view"></main><dialog class="dialog" aria-labelledby="dialog-title"></dialog><div role="status" aria-live="polite" class="notifications"></div>`;
    this.shadowRoot.addEventListener("click", (event) => this.onClick(event));
    this.shadowRoot.addEventListener("submit", (event) => this.onSubmit(event));
    this.shadowRoot.addEventListener("change", (event) => { if (this.dialogKind === "item") { if (event.target.name === "currency") this.updateRate(); if (event.target.name === "direction") this.updateCategory(); } });
    this.shadowRoot.addEventListener("input", () => { if (this.dialogKind === "allocation") this.updateAllocationTotal(); });
    this.render();
  }
  get budget() { return this.data?.budgets.find((budget) => budget.id === this.selected) || this.data?.budgets[0]; }
  get admin() { return this.hass?.user?.is_admin; }
  render() {
    const view = this.shadowRoot.querySelector(".view");
    if (!this.data) { view.innerHTML = `<div class="status" role="status">${this.error ? `<p class="error">${esc(this.error)}</p><button data-action="retry">Retry</button>` : "Loading your budgets…"}</div>`; return; }
    const budget = this.budget;
    view.innerHTML = `<div class="shell">
      <div class="topbar row between"><div class="row"><button class="quiet icon mobile-menu" data-action="menu" aria-label="Open Home Assistant menu">${icon("menu")}</button><div class="brand row"><span class="brand-mark">${icon("wallet")}</span><span class="brand-title">Autonomous Budget</span></div></div><div class="row"><button class="quiet" data-action="export" aria-label="Export budgets" title="Export budgets">${icon("download")}<span class="desktop-label">Export</span></button>${this.admin ? `<button class="quiet" data-action="settings" aria-label="Settings">${icon("settings")}<span class="desktop-label">Settings</span></button>` : '<span class="badge">View only</span>'}</div></div>
      <div class="heading row between"><div><div class="eyebrow muted">A little clarity, every payday</div><h1>Your money, in view.</h1><p class="muted">Make room for what matters. Plan the rest.</p></div>${this.admin ? `<button class="primary" data-action="new-budget">${icon("plus")}New budget</button>` : ""}</div>
      ${budget ? `${this.renderBudgets(budget)}${this.renderBudget(budget)}` : `<section class="box no-budgets empty">${icon("wallet")}<h2>A fresh start for your finances</h2><p class="muted">Create your first budget, then add your income, everyday bills, and future plans.</p>${this.admin ? '<button class="primary" data-action="new-budget">Create your first budget</button>' : '<p class="muted">Ask a Home Assistant administrator to create a budget.</p>'}</section>`}
      <div class="footer row between"><span>Local to your home. In sync with your life.</span><span>Autonomous Budget · 0.4.1</span></div>
    </div>`;
  }
  renderBudgets(budget) {
    return `<nav class="budgets" aria-label="Budgets">${this.data.budgets.map((item) => `<button class="budget-tab ${item.id === budget.id ? "active" : ""}" data-action="select" data-id="${item.id}" aria-current="${item.id === budget.id ? "page" : "false"}">${icon("wallet")}<span translate="no">${esc(item.name)}</span><small>${item.currency}</small>${item.kind === "shared" ? '<span class="badge">Shared</span>' : ""}</button>`).join("")}</nav>`;
  }
  renderBudget(budget) {
    const planned = this.viewMode === "plan";
    const totals = planned ? budget.plan : budget.totals;
    const m = (value) => this.money(value, budget.currency);
    const items = budget.items.filter((item) => this.filter === "all" || item.direction === this.filter);
    const upcoming = budget.schedule.filter((item) => item.date >= this.data.today).slice(0, 5);
    return `<div class="period-bar row between"><div><div class="row wrap"><span class="period-title">${this.dateLabel(budget.period_start, true)} – ${this.dateLabel(budget.period_last_day, true)}</span><span class="badge">${labels[budget.effective_period]}</span></div><div class="muted small">${this.offset === 0 ? "Current period" : this.offset < 0 ? "Past period projection" : "Upcoming period projection"} · ${planned ? "Per pay period" : "Scheduled cash flow"}</div></div><div class="period-nav"><button class="quiet prev" data-action="previous" aria-label="Previous period" ${this.offset <= -120 ? "disabled" : ""}>${icon("chevron")}</button><button class="quiet" data-action="next" aria-label="Next period" ${this.offset >= 120 ? "disabled" : ""}>${icon("chevron")}</button></div></div>
    <div class="view-switch" role="group" aria-label="Calculation view">${["plan", "cashflow"].map((mode) => `<button data-action="view-mode" data-mode="${mode}" class="${this.viewMode === mode ? "active" : ""}" aria-pressed="${this.viewMode === mode}">${mode === "plan" ? "Per pay period" : "Due dates"}</button>`).join("")}</div>
    ${this.renderSharing(budget)}<section class="stats" aria-label="Period totals">
      <div class="stat balance"><div class="row between"><span class="stat-label">Left after expenses</span><span class="stat-icon">${icon("wallet")}</span></div><div class="value number ${Number(totals.balance) < 0 ? "negative" : ""}">${m(totals.balance)}</div><span class="muted small">${Number(totals.balance) < 0 ? "Planned expenses exceed income this period" : "Income minus everything you have planned"}</span></div>
      <div class="stat"><div class="row between"><span class="stat-label">${planned ? "Income per pay period" : "Expected income"}</span><span class="stat-icon">${icon("down")}</span></div><div class="value number">${m(totals.income)}</div><span class="muted small">${planned ? "Recurring income on the same time scale" : `${budget.schedule.filter((row) => row.direction === "income").length} scheduled payments this period`}</span></div>
      <div class="stat"><div class="row between"><span class="stat-label">${planned ? "Expenses per pay period" : "Planned expenses"}</span><span class="stat-icon">${icon("arrow")}</span></div><div class="value number">${m(totals.expenses)}</div><span class="muted small">${planned ? "A regular share of your commitments" : "All payments due this period"}</span></div>
    </section>
    <div class="layout"><div class="main-column"><section class="box"><div class="box-head row between"><div><h2><span translate="no">${esc(budget.name)}</span></h2><p class="muted small">All your income and commitments</p></div><div class="toolbar"><button class="quiet icon" data-action="dashboard" aria-label="Add budget to a dashboard" title="Dashboard card">${icon("grid")}</button>${this.admin ? `<button class="quiet icon" data-action="edit-budget" aria-label="Edit budget" title="Edit budget">${icon("settings")}</button><button class="primary" data-action="new-item">${icon("plus")}Add entry</button>` : ""}</div></div>
    <div class="tabs" role="group" aria-label="Filter entries">${["all", "income", "expense"].map((filter) => `<button class="${this.filter === filter ? "active" : ""}" data-action="filter" data-filter="${filter}" aria-pressed="${this.filter === filter}">${filter === "all" ? "All entries" : filter === "income" ? "Income" : "Expenses"} <span>${budget.items.filter((item) => filter === "all" || item.direction === filter).length}</span></button>`).join("")}</div>
    ${items.length ? this.renderEntries(budget, items, planned, totals) : `<div class="empty">${icon("calendar")}<h3>${budget.items.length ? "No entries in this view" : "Give your money a plan"}</h3><p class="muted">${budget.items.length ? "Try another filter or add a new entry." : "Start with a paycheck, a subscription, or a bill. Every entry has its own schedule."}</p>${this.admin ? '<button data-action="new-item">Add an entry</button>' : ""}</div>`}
    <div class="table-foot">${budget.items.filter((item) => item.active).length} active entries · ${planned ? "Recurring amounts are normalized to your pay period." : "Totals count payments due in the selected period."}</div></section>${this.renderReserves(budget)}</div>
    <aside class="side"><section class="box"><div class="box-head"><h2>Where your money goes</h2><p class="muted small">Expenses by category</p></div><div class="category-list">${["investment", "mandatory", "optional"].map((category) => { const pct = Number(totals.expenses) ? Number(totals[category]) / Number(totals.expenses) * 100 : 0; return `<div><div class="row"><span class="category-icon ${category}">${icon(category)}</span><div class="spacer"><h3>${labels[category]}</h3><span class="muted small">${Math.round(pct)}% of expenses</span></div><span class="amount number">${m(totals[category])}</span></div><div class="bar"><span class="${category}" style="width:${pct}%"></span></div></div>`; }).join("")}${budget.category_review.count ? `<div class="category-review"><h3>To categorize</h3><p class="muted small">${budget.category_review.count} expenses need a category. Edit each expense to choose one.</p><strong class="number">${m(budget.category_review[planned ? "planned_amount" : "scheduled_amount"])}</strong></div>` : ""}</div></section>
    <section class="box"><div class="box-head row between"><h2>Coming up</h2>${icon("calendar")}</div><div class="schedule">${upcoming.length ? upcoming.map((item) => `<div class="due-row row"><div class="date-tile"><span>${new Intl.DateTimeFormat(this.language, {month:"short"}).format(new Date(`${item.date}T12:00:00`))}</span><b>${Number(item.date.slice(-2))}</b></div><div class="spacer due-name"><span translate="no">${esc(item.name)}</span><div class="muted small">${labels[item.direction]}</div></div><span class="amount number ${item.direction === "income" ? "positive" : ""}">${item.direction === "income" ? "+ " : ""}${m(item.amount)}</span></div>`).join("") : '<p class="muted small" style="padding:0 0 18px">Nothing else is due in this period.</p>'}</div></section><p class="note">Switch between a regular plan per pay period and payments on their actual due dates. Reserves estimate what should already be set aside for recurring expenses; they do not track transfers or cleared payments.</p></aside></div>`;
  }
  renderSharing(budget) {
    if (budget.kind !== "shared") return "";
    const sharing = budget.sharing;
    return `<section class="box sharing" aria-label="Shared budget allocation"><div class="box-head row between"><div><h2>Shared budget</h2><p class="muted small">Automatic contributions to personal budgets</p></div>${this.admin ? '<button data-action="allocation">Manage allocation</button>' : ""}</div>
      <div class="sharing-list">${sharing.members.length ? sharing.members.map((member) => `<div class="share-row"><div class="share-person"><button class="quiet" data-action="select" data-id="${member.budget_id}"><span translate="no">${esc(member.name)}</span></button><div class="muted small">${esc(member.percentage)}% · ${labels[member.period]}</div></div><div class="share-amount"><strong class="number">${this.money(member.amount, budget.currency)}</strong><div class="muted small">Next contribution · ${this.dateLabel(member.next_due, true)}</div></div></div>`).join("") : '<p class="muted small">Choose the personal budgets and percentages to share these expenses.</p>'}</div>
      <div class="sharing-note small muted">${Number(sharing.unallocated_percentage) ? `<p><strong>${esc(sharing.unallocated_percentage)}% unallocated</strong></p>` : ""}<p>Each share covers this budget’s expenses. Income is not deducted. Contributions are added as mandatory expenses on each person’s payday.</p></div></section>`;
  }
  renderEntries(budget, items, planned, totals) {
    const m = (value) => this.money(value, budget.currency);
    const heading = (title, total, count, kind) => `<tr class="entry-group-heading ${kind}"><th colspan="5" scope="rowgroup"><div class="row between"><h3>${title} <span class="group-count">${count}</span></h3><span class="number">${m(total)}</span></div></th></tr>`;
    const income = items.filter((item) => item.direction === "income");
    const expenses = items.filter((item) => item.direction === "expense");
    const categories = ["investment", "mandatory", "optional"];
    const rows = (entries) => entries.map((item) => this.renderEntry(item, budget, planned)).join("");
    return `<div class="table-wrap"><table><thead><tr><th>Entry</th><th>${planned ? "Per pay period" : "Amount"}</th><th class="hide-small">Next due</th><th class="hide-medium">${planned ? "Original amount" : "This period"}</th><th><span class="muted">${this.admin ? "Edit" : ""}</span></th></tr></thead>
      ${income.length ? `<tbody data-group="income">${heading("Income", totals.income, income.length, "direction income")}${rows(income)}</tbody>` : ""}
      ${expenses.length ? `<tbody data-group="expenses">${heading("Expenses", totals.expenses, expenses.length, "direction")}</tbody>${[...categories, "uncategorized"].map((category) => {
        const entries = expenses.filter((item) => category === "uncategorized" ? !categories.includes(item.category) : item.category === category);
        const title = category === "uncategorized" ? "To categorize" : labels[category];
        const total = category === "uncategorized" ? budget.category_review[planned ? "planned_amount" : "scheduled_amount"] : totals[category];
        return entries.length ? `<tbody data-group="${category}">${heading(title, total, entries.length, "category")}${rows(entries)}</tbody>` : "";
      }).join("")}` : ""}</table></div>`;
  }
  renderEntry(item, budget, planned) {
    const m = (value) => this.money(value, budget.currency);
    return `<tr class="${item.active ? "" : "paused"}"><td><div class="row"><span class="entry-icon ${item.direction}">${item.direction === "income" ? icon("down") : esc(item.name.slice(0, 1).toUpperCase())}</span><div class="entry-name"><span translate="no">${esc(item.name)}</span><div class="entry-meta">${item.direction === "expense" ? (item.category ? `<span class="category-dot ${item.category}"></span>${labels[item.category]}` : "To categorize") : "Income"}${item.active ? "" : " · Paused"}</div>${item.reserve?.excluded_reason === "income_date" ? '<div class="automatic">Paid with income</div>' : ""}${item.shared_source_id ? `<div class="automatic">Automatic contribution · ${esc(item.shared_percentage)}%</div>` : ""}</div></div></td><td><div class="amount number ${item.direction === "income" ? "positive" : ""}">${item.direction === "income" ? "+ " : ""}${planned ? m(item.planned_amount) : this.money(item.amount, item.currency)}</div><div class="small muted">${planned ? `${this.money(item.amount, item.currency)} · ` : ""}${labels[item.recurrence]}${item.currency !== budget.currency ? ` · × ${esc(item.exchange_rate)}` : ""}</div></td><td class="hide-small"><span>${this.dateLabel(item.next_due, true)}</span></td><td class="hide-medium"><div class="amount number">${planned ? this.money(item.amount, item.currency) : m(item.period_amount)}</div><span class="muted small">${planned ? labels[item.recurrence] : `${item.occurrences} due`}</span></td><td>${item.shared_source_id ? `<button class="quiet icon" data-action="select" data-id="${item.shared_source_id}" aria-label="Open shared budget" title="Open shared budget">${icon("arrow")}</button>` : this.admin ? `<button class="quiet icon" data-action="edit-item" data-id="${item.id}" aria-label="Edit ${esc(item.name)}">${icon("edit")}</button>` : ""}</td></tr>`;
  }
  renderReserves(budget) {
    const m = (value) => this.money(value, budget.currency);
    const entries = budget.items.filter((item) => item.reserve).sort((a, b) => a.reserve.next_due.localeCompare(b.reserve.next_due) || a.name.localeCompare(b.name));
    return `<section class="box reserves" aria-label="Projected reserves"><div class="box-head row between wrap"><div><h2>Projected reserves</h2><p class="muted small">Today · ${this.dateLabel(budget.reserves.as_of, true)}</p></div><div class="row"><strong class="number reserve-total">${m(budget.reserves.amount)}</strong><button class="quiet icon" data-action="reserve-entity" aria-label="Home Assistant entity" title="Home Assistant entity">${icon("grid")}</button></div></div>
      <div class="reserve-list">${entries.length ? entries.map((item) => {
        const reserve = item.reserve;
        if (reserve.excluded_reason === "income_date") return `<div class="reserve-entry excluded"><div class="row between wrap"><div><h3><span translate="no">${esc(item.name)}</span></h3><span class="muted small">Payment date · ${this.dateLabel(reserve.payment_date, true)}</span></div><div class="reserve-amount"><span class="muted small">Amount </span><strong class="number">${m(reserve.required_amount)}</strong></div></div><p class="small"><span class="badge">Paid with income</span></p><p class="muted small">Not included in projected reserves.</p></div>`;
        const segments = Math.min(reserve.total_paychecks, 52);
        return `<div class="reserve-entry"><div class="row between wrap"><div><h3><span translate="no">${esc(item.name)}</span></h3><span class="muted small">${reserve.contribution ? "Next pay period" : "Next due"} · ${this.dateLabel(reserve.next_due, true)}</span></div><div class="reserve-amount"><strong class="number">${m(reserve.reserved_amount)}</strong><span class="muted small"> / ${m(reserve.required_amount)}</span></div></div><div class="segments" role="progressbar" aria-label="Reserve progress" aria-valuemin="0" aria-valuemax="${reserve.total_paychecks}" aria-valuenow="${reserve.completed_paychecks}">${Array.from({length: segments}, (_, i) => `<span style="--fill:${Math.max(0, Math.min(1, reserve.progress * segments - i)) * 100}%"></span>`).join("")}</div><div class="row between wrap small muted"><span>${reserve.completed_paychecks}/${reserve.total_paychecks} pay periods · ${reserve.remaining_paychecks} remaining</span><span>${reserve.contribution ? "Reserved for this pay period" : reserve.shared ? "Based on participants’ paydays" : `${m(reserve.amount_per_paycheck)} <span>per reserve installment</span>`}</span></div></div>`;
      }).join("") : '<p class="muted small">Add a recurring expense to see its projected reserve.</p>'}</div>
      <div class="available-summary"><div class="row between wrap"><h3>Available after reserves</h3><strong class="number ${Number(budget.available_balance) < 0 ? "negative" : "positive"}">${budget.available_balance === null ? "—" : m(budget.available_balance)}</strong></div><p class="muted small">${budget.available_balance === null ? "Add an account balance in Edit budget to see this estimate." : `<span>Account balance</span> ${m(budget.account_balance)} − <span>Credit owed</span> ${m(budget.credit_balance || "0")} + <span>Projected reserves</span> (${m(budget.reserves.amount)})`}</p><p class="muted small">Estimated amounts, assuming earlier installments were saved and due bills were paid. Update manual balances as needed.</p></div></section>`;
  }
  async onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "menu") { this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })); return; }
    if (action === "retry") { this.subscribe(); return; }
    if (action === "close") { this.shadowRoot.querySelector("dialog").close(); return; }
    if (action === "select") { this.selected = button.dataset.id; this.filter = "all"; this.render(); return; }
    if (action === "view-mode") { this.viewMode = button.dataset.mode; this.render(); return; }
    if (action === "filter") { this.filter = button.dataset.filter; this.render(); return; }
    if (["previous", "next"].includes(action)) { this.offset += action === "next" ? 1 : -1; this.subscribe(); return; }
    if (action === "export") { this.exportData(); return; }
    if (action === "dashboard") { this.openDashboard(); return; }
    if (action === "reserve-entity") { this.openReserveEntity(); return; }
    if (action === "show-entity") {
      this.shadowRoot.querySelector("dialog").close();
      this.dispatchEvent(new CustomEvent("hass-more-info", {detail: {entityId: button.dataset.entityId}, bubbles: true, composed: true}));
      return;
    }
    if (!this.admin) return;
    if (action === "settings") this.openSettings();
    if (action === "allocation") this.openAllocation();
    if (action === "new-budget" || action === "edit-budget") this.openBudget(action === "edit-budget");
    if (action === "new-item" || action === "edit-item") this.openItem(action === "edit-item" ? this.budget.items.find((item) => item.id === button.dataset.id) : null);
    if (action === "delete-item") this.confirmDelete("item", this.editing);
    if (action === "delete-budget") this.confirmDelete("budget", this.budget);
  }
  openDialog(title, content, kind) {
    this.dialogKind = kind;
    this.editRevision = this.data.revision;
    const dialog = this.shadowRoot.querySelector("dialog");
    dialog.innerHTML = `<header><h2 id="dialog-title">${esc(title)}</h2><button class="quiet icon" data-action="close" aria-label="Close dialog">${icon("close")}</button></header>${content}`;
    if (!dialog.open) dialog.showModal();
  }
  field(label, name, value, type = "text", full = false, extra = "") {
    return `<label class="field ${full ? "full" : ""}">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} /></label>`;
  }
  selectField(label, name, values, value, extra = "") { return `<label class="field">${label}<select name="${name}" aria-label="${esc(label)}" ${extra}>${options(values, value)}</select></label>`; }
  form(body, save = "Save changes", extra = "") { return `<form><div class="form-grid">${body}</div><div class="form-error" role="alert"></div><div class="dialog-actions">${extra}<span class="spacer"></span><button type="button" data-action="close">Cancel</button><button class="primary" type="submit">${save}</button></div></form>`; }
  openSettings() {
    const settings = this.data.settings;
    this.openDialog("Budget settings", `<div class="dialog-content" style="padding-bottom:0"><p class="help">These defaults apply when a budget has no pay schedule of its own. Each budget can optionally override the period and reference date. The currency below is the default for new budgets.</p></div>${this.form(this.selectField("Default currency", "currency", Object.keys(this.data.currencies).sort(), settings.currency) + this.selectField("Budget period", "period", ["daily", "weekly", "biweekly", "monthly", "yearly"], settings.period) + this.field("Default reference date", "anchor", settings.anchor, "date", true, 'required min="1900-01-01" max="2200-12-31"'))}`, "settings");
  }
  openAllocation() {
    this.editing = this.budget;
    const eligible = this.data.budgets.filter((budget) => budget.kind !== "shared" && budget.currency === this.budget.currency);
    const allocations = new Map(this.budget.allocations.map((row) => [row.budget_id, row.percentage]));
    const fields = `<p class="muted small full" style="grid-column:1/-1">Create a personal budget for each person first, using the same currency as the shared budget. Each person’s optional pay schedule determines their contribution dates.</p>` + eligible.map((budget) => `<div class="allocation-row"><div><span translate="no">${esc(budget.name)}</span><div class="muted small">${labels[budget.effective_period]} · ${this.dateLabel(budget.effective_anchor, true)}</div></div>${this.field("Share (%)", `share_${budget.id}`, allocations.get(budget.id) || "0", "number", false, `required min="0" max="100" step="0.01" data-budget-id="${budget.id}"`)}</div>`).join("") + '<p class="muted small allocation-total" aria-live="polite"></p><p class="muted small" style="grid-column:1/-1">Set a share to 0 to remove the contribution. Unallocated amounts remain in the shared budget.</p>';
    this.openDialog("Manage allocation", this.form(fields), "allocation");
    this.updateAllocationTotal();
  }
  updateAllocationTotal() {
    const form = this.shadowRoot.querySelector("dialog form");
    const total = [...form.querySelectorAll("input[data-budget-id]")].reduce((sum, input) => sum + Math.round(Number(input.value || 0) * 100), 0) / 100;
    form.querySelector(".allocation-total").textContent = `${total}% allocated · ${Math.max(0, Math.round((100 - total) * 100) / 100)}% unallocated`;
    const first = form.querySelector("input[data-budget-id]");
    if (first) first.setCustomValidity(total > 100 ? this.t("The total allocation cannot exceed 100%.") : "");
  }
  openBudget(edit) {
    this.editing = edit ? this.budget : null;
    this.openDialog(edit ? "Edit budget" : "Create a budget", this.form(this.field("Budget name", "name", edit ? this.budget.name : "", "text", true, 'required maxlength="100" placeholder="e.g. Everyday life"') + this.selectField("Budget type", "kind", ["personal", "shared"], edit ? this.budget.kind : "personal") + this.selectField("Currency", "currency", Object.keys(this.data.currencies).sort(), edit ? this.budget.currency : this.data.settings.currency, edit && this.budget.items.length ? "disabled" : "") + this.selectField("Pay period (optional)", "period", ["", "daily", "weekly", "biweekly", "monthly", "yearly"], edit ? this.budget.period || "" : "") + this.field("Payday / reference date (optional)", "anchor", edit ? this.budget.anchor || "" : "", "date", true, 'min="1900-01-01" max="2200-12-31"') + `<p class="muted small" style="grid-column:1/-1">Leave these fields blank to use the defaults: ${labels[this.data.settings.period]}, aligned to ${this.dateLabel(this.data.settings.anchor, true)}. A pay schedule is optional.</p>` + this.field("Account balance (optional)", "account_balance", edit ? this.budget.account_balance ?? "" : "", "number", false, 'min="-1000000000" max="1000000000" step="any" inputmode="decimal"') + this.field("Credit owed (optional)", "credit_balance", edit ? this.budget.credit_balance ?? "" : "", "number", false, 'min="0" max="1000000000" step="any" inputmode="decimal"') + '<p class="muted small" style="grid-column:1/-1">Enter balances manually in the budget currency. Available after reserves = account balance − credit owed + projected reserves (negative). Leave account balance blank to hide this estimate.</p>', edit ? "Save changes" : "Create budget", edit ? `<button type="button" class="quiet danger icon" data-action="delete-budget" aria-label="Delete budget">${icon("trash")}</button>` : ""), "budget");
  }
  openItem(item) {
    if (item?.shared_source_id) { this.selected = item.shared_source_id; this.render(); return; }
    this.editing = item;
    const entry = item || { name: "", direction: "expense", category: "", amount: "", currency: this.budget.currency, exchange_rate: "1", recurrence: "monthly", renewal_date: this.data.today, end_date: "", active: true };
    const fields = this.field("Entry name", "name", entry.name, "text", true, 'required maxlength="100" placeholder="e.g. Netflix, rent, or paycheck"') + this.selectField("Money flow", "direction", ["income", "expense"], entry.direction) + `<label class="field">Expense category<select name="category" aria-label="Expense category" required><option value="" disabled ${!entry.category ? "selected" : ""}>Choose a category</option>${options(["investment", "mandatory", "optional"], entry.category)}</select></label>` + this.field("Amount", "amount", entry.amount, "number", false, 'required min="0" max="1000000000" step="any" inputmode="decimal"') + this.selectField("Currency", "currency", Object.keys(this.data.currencies).sort(), entry.currency) + `<label class="field full fx">Exchange rate to ${this.budget.currency}<input type="number" name="exchange_rate" value="${esc(entry.exchange_rate)}" min="0.00000001" max="1000000" step="any" required/><small>1 unit of this entry's currency equals this many ${this.budget.currency}. Rates are set manually.</small></label>` + this.selectField("Repeats", "recurrence", ["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"], entry.recurrence) + this.field("First due / renewal date", "renewal_date", entry.renewal_date, "date", false, 'required min="1900-01-01" max="2200-12-31"') + this.field("End date (optional, inclusive)", "end_date", entry.end_date, "date", true, 'min="1900-01-01" max="2200-12-31"') + `<label class="checkbox"><input type="checkbox" name="active" ${entry.active ? "checked" : ""}/>Active entry</label><span class="muted small">Pause to exclude all occurrences.</span>`;
    this.openDialog(item ? "Edit entry" : "Add an entry", this.form(fields, item ? "Save changes" : "Add entry", item ? `<button type="button" class="quiet danger icon" data-action="delete-item" aria-label="Delete entry">${icon("trash")}</button>` : ""), "item");
    this.updateRate();
    this.updateCategory();
  }
  updateCategory() {
    const form = this.shadowRoot.querySelector("dialog form");
    const expense = form.elements.direction.value === "expense";
    form.elements.category.disabled = !expense;
    form.elements.category.closest("label").style.display = expense ? "flex" : "none";
    form.elements.direction.closest("label").style.gridColumn = expense ? "" : "1/-1";
  }
  updateRate() {
    const form = this.shadowRoot.querySelector("dialog form");
    const same = form.elements.currency.value === this.budget.currency;
    form.querySelector(".fx").style.display = same ? "none" : "flex";
    form.elements.exchange_rate.disabled = same;
    if (same) form.elements.exchange_rate.value = "1";
    form.elements.amount.step = String(10 ** -this.data.currencies[form.elements.currency.value]);
  }
  confirmDelete(kind, item) {
    this.editing = item;
    this.openDialog(`Delete ${kind}?`, `<form><p>Delete <strong><span translate="no">${esc(item.name)}</span></strong>${kind === "budget" ? " and all its entries" : ""}? This cannot be undone.</p>${kind === "budget" ? '<p class="muted small">Linked contributions will be removed. Other people’s percentages will not be increased.</p>' : ""}<div class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close">Cancel</button><button type="submit" class="danger">Delete ${kind}</button></div></form>`, `delete-${kind}`);
  }
  openReserveEntity() {
    const entity = Object.values(this.hass.states).find((state) => state.attributes.budget_id === this.budget.id && state.attributes.metric === "reserved");
    if (!entity) {
      this.openDialog("Reserve entity", '<div class="dialog-content"><p>The reserve entity is unavailable. In Settings → Devices & services → Autonomous Budget, open this budget and enable its Projected reserve sensor if disabled. Restart Home Assistant after updating the integration.</p><div class="dialog-actions"><button data-action="close">Done</button></div></div>', "reserve-entity");
      return;
    }
    const yaml = `type: entity\nentity: ${entity.entity_id}\nname: ${this.t("Projected reserves")}`;
    this.openDialog("Reserve entity", `<div class="dialog-content"><p class="muted">This sensor tracks the total projected reserve for this budget, in its currency. It updates after edits and at local midnight.</p><h3>Entity ID</h3><pre>${esc(entity.entity_id)}</pre><h3>Add to a dashboard</h3><pre>${esc(yaml)}</pre><div class="dialog-actions"><button data-action="close">Done</button><button class="primary" data-action="show-entity" data-entity-id="${esc(entity.entity_id)}">Open entity</button></div></div>`, "reserve-entity");
  }
  openDashboard() {
    const yaml = `type: custom:autonomous-budget-card\nbudget_id: ${this.budget.id}\nview: plan\nshow_categories: true\nshow_upcoming: true\nshow_reserves: true`;
    this.openDialog("Your budget, on any dashboard", `<div class="dialog-content"><p class="muted">The card is already registered with Home Assistant.</p><h3>Use the visual editor</h3><p>Edit a dashboard → Add card → search for <strong>Autonomous Budget</strong>, then select this budget.</p><h3>Or paste this YAML</h3><pre>${esc(yaml)}</pre><p class="muted small">Eleven native sensors are also available under Settings → Devices & services → Autonomous Budget.</p><div class="dialog-actions"><button data-action="close" class="primary">Done</button></div></div>`, "dashboard");
  }
  async onSubmit(event) {
    event.preventDefault();
    if (!this.admin || this.saving) return;
    const form = event.target;
    if (!form.reportValidity()) return;
    let payload = Object.fromEntries(new FormData(form));
    let action;
    if (this.dialogKind === "settings") action = "settings";
    else if (this.dialogKind === "budget") { action = this.editing ? "budget_update" : "budget_create"; if (this.editing) payload = { ...payload, budget_id: this.editing.id, currency: payload.currency || this.editing.currency }; }
    else if (this.dialogKind === "allocation") { action = "budget_update"; payload = { budget_id: this.editing.id, allocations: [...form.querySelectorAll("input[data-budget-id]")].filter((input) => Number(input.value) > 0).map((input) => ({budget_id: input.dataset.budgetId, percentage: input.value})) }; }
    else if (this.dialogKind === "item") { action = this.editing ? "item_update" : "item_create"; payload = { ...payload, budget_id: this.budget.id, item_id: this.editing?.id, active: form.elements.active.checked, exchange_rate: payload.exchange_rate || "1" }; }
    else if (this.dialogKind.startsWith("delete-")) { action = this.dialogKind === "delete-budget" ? "budget_delete" : "item_delete"; payload = { budget_id: this.budget.id, item_id: this.editing.id }; }
    else return;
    this.saving = true;
    form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const result = await this.hass.callWS({ type: "autonomous_budget/mutate", action, payload, revision: this.editRevision });
      if (action === "budget_create") this.selected = result.id;
      this.shadowRoot.querySelector("dialog").close();
      this.render();
      this.notify(action.includes("delete") ? "Deleted" : "Budget saved");
    } catch (error) { form.querySelector(".form-error").textContent = error.message || "Could not save. Please try again."; }
    finally { this.saving = false; form.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
  }
  notify(message) {
    const target = this.shadowRoot.querySelector(".notifications");
    target.innerHTML = `<div class="toast">${esc(message)}</div>`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { target.innerHTML = ""; }, 3500);
  }
  exportData() {
    const data = { format: "autonomous_budget", version: 1, exported_at: new Date().toISOString(), settings: this.data.settings, budgets: this.data.budgets.map(({ id, name, currency, kind, allocations, period, anchor, account_balance, credit_balance, items }) => ({ id, name, currency, kind, allocations, period: period || null, anchor: anchor || null, account_balance: account_balance ?? null, credit_balance: credit_balance ?? "0", items: items.filter((item) => !item.shared_source_id).map(({ period_amount, planned_amount, reserve, occurrences, next_due, ...item }) => item) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `autonomous-budget-${this.data.today}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
if (!customElements.get("autonomous-budget-panel")) customElements.define("autonomous-budget-panel", AutonomousBudgetPanel);
