import { BudgetLiveElement, baseCSS, esc } from "./shared.js?v=1.0.2";
class FinanceCard extends BudgetLiveElement {
  static getConfigElement() {
    return document.createElement("autonomous-finance-card-editor");
  }
  static getStubConfig() {
    return {
      view: "account",
      show_title: true,
      show_balance: true,
      show_income: true,
      show_expenses: true,
      show_status: true,
      show_link: true,
    };
  }
  setConfig(config) {
    this.config = { ...FinanceCard.getStubConfig(), ...config };
    if (this.hass) this.subscribe();
  }
  getCardSize() {
    return 3;
  }
  async subscribe() {
    if (!this.config || !this.hass) return;
    this._unsubscribe?.();
    const generation = ++this._generation;
    const update = async () => {
      const request = (this._request || 0) + 1;
      this._request = request;
      try {
        let data;
        if (this.config.view === "wealth")
          data = await this.hass.callWS({
            type: "autonomous_budget/finance",
            command: "reports",
            payload: { currency: this.config.currency || "CAD", summary: true },
          });
        else
          data = await this.hass.callWS({
            type: "autonomous_budget/finance",
            command: "account_summary",
            payload: { account_id: this.config.account_id },
          });
        if (generation !== this._generation || request !== this._request)
          return;
        this.data = data;
        this.error = null;
        this.render();
      } catch (e) {
        if (generation !== this._generation || request !== this._request)
          return;
        this.data = null;
        this.error = e.message;
        this.render();
      }
    };
    const unsub = await this.hass.connection.subscribeMessage(update, {
      type: "autonomous_budget/finance_subscribe",
    });
    if (generation !== this._generation) unsub();
    else this._unsubscribe = unsub;
  }
  render() {
    const c = this.config || {},
      d = this.data;
    this.shadowRoot.innerHTML = `<style>${baseCSS}ha-card{display:block;padding:22px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:18px;margin:16px 0}.value{font-size:25px;font-weight:600}.label{font-size:12px;color:var(--ab-muted)}a{display:inline-block;margin-top:15px;color:var(--ab-green)}</style><ha-card>${
      this.error
        ? `<p role="alert">${esc(this.error)}</p>`
        : !d
          ? "<p>Loading…</p>"
          : `${c.show_title ? `<h2 translate="no">${esc(c.title || d.name || this.t("Net worth"))}</h2>` : ""}<div class="metrics">${[
              [
                "show_balance",
                c.view === "wealth" ? "Net worth" : "Balance",
                c.view === "wealth" ? d.net_worth : d.balance,
              ],
              ["show_income", "Income", d.income],
              ["show_expenses", "Expenses", d.expenses],
            ]
              .filter(([flag, , value]) => c[flag] && value !== undefined)
              .map(
                ([, label, value]) =>
                  `<div><div class="label">${label}</div><div class="value">${this.money(value, d.currency)}</div></div>`,
              )
              .join(
                "",
              )}</div>${c.show_status ? `<p class="label">${d.complete === false ? "Incomplete valuation: add the missing exchange rates or prices." : d.bank_checked ? `${this.t("Last synchronization")} ${esc(d.bank_checked)}` : "Private account data"}</p>` : ""}${c.show_link ? '<a href="/autonomous-budget">Open Autonomous Budget</a>' : ""}`
    }</ha-card>`;
  }
}
class FinanceEditor extends BudgetLiveElement {
  async subscribe() {
    try {
      this.data = await this.hass.callWS({
        type: "autonomous_budget/finance",
        command: "snapshot",
      });
      this.render();
    } catch (e) {
      this.error = e.message;
      this.render();
    }
  }
  setConfig(config) {
    this.config = { ...FinanceCard.getStubConfig(), ...config };
    this.render();
  }
  render() {
    if (!this.config) return;
    const c = this.config;
    this.shadowRoot.innerHTML = `<style>${baseCSS}label{display:flex;gap:10px;margin:14px 0}select,input[type=text]{flex:1;padding:8px}</style><label>View<select name="view"><option value="account" ${c.view === "account" ? "selected" : ""}>Account</option><option value="wealth" ${c.view === "wealth" ? "selected" : ""}>Net worth</option></select></label><label>Account<select name="account_id"><option value="">—</option>${(
      this.data?.objects || []
    )
      .filter((o) => o.kind === "account")
      .map(
        (o) =>
          `<option value="${o.id}" ${c.account_id === o.id ? "selected" : ""} translate="no">${esc(o.name)}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Currency<input name="currency" value="${esc(c.currency || "CAD")}" type="text"></label><label>Title<input name="title" value="${esc(c.title || "")}" type="text"></label>${[
      ["show_title", "Show title"],
      ["show_balance", "Show balance"],
      ["show_income", "Show income"],
      ["show_expenses", "Show expenses"],
      ["show_status", "Show status"],
      ["show_link", "Show link"],
    ]
      .map(
        ([key, label]) =>
          `<label><input type="checkbox" name="${key}" ${c[key] ? "checked" : ""}>${label}</label>`,
      )
      .join("")}`;
    this.shadowRoot.onchange = (e) => {
      const target = e.target;
      this.config = {
        ...this.config,
        [target.name]:
          target.type === "checkbox" ? target.checked : target.value,
      };
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this.config },
          bubbles: true,
          composed: true,
        }),
      );
    };
  }
}
customElements.define("autonomous-finance-card", FinanceCard);
customElements.define("autonomous-finance-card-editor", FinanceEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "autonomous-finance-card",
  name: "Autonomous Finance",
  description:
    "Private accounts and net worth, respecting each Home Assistant user’s access.",
});
