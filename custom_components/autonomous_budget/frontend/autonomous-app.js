import "./autonomous-budget-panel.js?v=1.5.1";
import "./finance-panel.js?v=1.5.1";
import { baseCSS, esc, icon } from "./shared.js?v=1.5.1";
import { translate } from "./i18n.js?v=1.5.1";
class AutonomousApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.page = "budgets";
    this.shadowRoot.innerHTML = `<style>${baseCSS}
:host{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--ab-bg)}.app-chrome{flex:none;background:var(--ab-surface);border-bottom:1px solid var(--ab-line);z-index:5}.app-brand{max-width:1440px;margin:auto;display:flex;align-items:center;gap:10px;padding:16px 32px 10px;font-size:15px;font-weight:650}.app-brand>svg{color:var(--ab-green)}.app-brand small{font-size:11px;font-weight:400;margin-left:auto;color:var(--ab-muted)}nav{display:flex;gap:22px;padding:0 32px;max-width:1440px;margin:auto;overflow-x:auto;scrollbar-width:thin}nav button{border:0;border-radius:0;background:transparent;padding:12px 0 14px;white-space:nowrap;color:var(--ab-muted);font-size:13px;min-height:46px}nav button.active{color:var(--ab-green);box-shadow:inset 0 -2px var(--ab-green)}nav button:hover{color:var(--ab-text)}nav ha-icon{--mdc-icon-size:18px}.app-body{flex:1;min-height:0;overflow:auto;padding-bottom:env(safe-area-inset-bottom,0px)}.ha-menu{display:none!important}[hidden]{display:none!important}autonomous-budget-view{height:auto;overflow:visible}@media(max-width:650px){.app-brand{padding:12px 14px 4px;gap:8px}.app-brand small{display:none}.ha-menu{display:inline-flex!important;padding:6px;min-width:36px;min-height:36px;margin-left:-6px}nav{padding:0 14px;gap:22px}nav button{font-size:12px;min-height:46px}nav ha-icon{display:none}}@media print{.app-chrome{display:none}.app-body{overflow:visible}:host{display:block;height:auto}}</style><div class="app-chrome"><div class="app-brand"><button class="quiet icon ha-menu" data-menu aria-label="Open Home Assistant menu">${icon("menu")}</button>${icon("wallet")}<span>Autonomous Budget</span><small>Budgets · Accounts · Wealth</small></div><nav aria-label="Finance navigation"></nav></div><div class="app-body"><autonomous-budget-view></autonomous-budget-view><div id="finance-host" hidden></div></div>`;
    this.shadowRoot.querySelector("[data-menu]").onclick = () =>
      this.dispatchEvent(
        new Event("hass-toggle-menu", { bubbles: true, composed: true }),
      );
    this.addEventListener("finance-navigate", (e) => {
      this.navigate(e.detail.page);
      if (e.detail.budgetId) {
        const view = this.shadowRoot.querySelector("autonomous-budget-view");
        view.selected = e.detail.budgetId;
        view.filter = "all";
        view.render();
      }
    });
    this.shadowRoot.querySelector("nav").onclick = (e) => {
      if (e.target.closest("[data-menu]"))
        this.dispatchEvent(
          new Event("hass-toggle-menu", { bubbles: true, composed: true }),
        );
      const b = e.target.closest("[data-page]");
      if (b) this.navigate(b.dataset.page);
    };
    this.addEventListener("finance-preferences", (e) => {
      this.prefs = e.detail;
      const mods = this.prefs.modules || {};
      if (mods[this.page] === false) this.navigate("overview");
      this.nav();
    });
  }
  set hass(value) {
    const changed = this._hass?.connection !== value.connection;
    this._hass = value;
    this.toggleAttribute("data-dark", Boolean(value.themes?.darkMode));
    if (changed)
      value
        .callWS({ type: "autonomous_budget/finance", command: "snapshot" })
        .then((data) => {
          this.prefs = data.objects.find((o) => o.kind === "preferences") || {};
          if (data.default_view === "accounts" && !this.prefs.modules)
            this.navigate("accounts");
          if (this.prefs.modules?.[this.page] === false)
            this.navigate("overview");
          this.nav();
        })
        .catch(() => {});
    for (const el of this.shadowRoot.querySelectorAll(
      "autonomous-budget-view,autonomous-finance-panel",
    ))
      el.hass = value;
    this.nav();
  }
  get hass() {
    return this._hass;
  }
  nav() {
    const lang = this.hass?.language?.startsWith("fr") ? "fr" : "en";
    const names = {
      overview: "Overview",
      budgets: "Budgets",
      accounts: "Accounts",
      investments: "Investments",
      assets: "Assets",
      reports: "Reports",
      settings: "Finance settings",
    };
    this.shadowRoot
      .querySelector("nav")
      .setAttribute("aria-label", translate("Finance navigation", lang));
    this.shadowRoot
      .querySelector("[data-menu]")
      .setAttribute("aria-label", translate("Open Home Assistant menu", lang));
    this.shadowRoot.querySelector(".app-brand small").textContent = translate(
      "Budgets · Accounts · Wealth",
      lang,
    );
    const icons = {
      overview: "view-dashboard-outline",
      budgets: "wallet-outline",
      accounts: "bank-outline",
      investments: "chart-line",
      assets: "home-city-outline",
      reports: "chart-box-outline",
      settings: "cog-outline",
    };
    const navMarkup = Object.entries(names)
      .filter(([key]) => this.prefs?.modules?.[key] !== false)
      .map(
        ([key, label]) =>
          `<button class="${this.page === key ? "active" : ""}" data-page="${key}" aria-current="${this.page === key ? "page" : "false"}"><ha-icon icon="mdi:${icons[key]}" aria-hidden="true"></ha-icon>${esc(translate(label, lang))}</button>`,
      )
      .join("");
    if (navMarkup !== this.navMarkup) {
      this.navMarkup = navMarkup;
      this.shadowRoot.querySelector("nav").innerHTML = navMarkup;
    }
  }
  navigate(page) {
    this.page = page;
    this.shadowRoot.querySelector(".app-body").scrollTop = 0;
    this.shadowRoot.querySelector("autonomous-budget-view").hidden =
      page !== "budgets";
    const host = this.shadowRoot.querySelector("#finance-host");
    host.hidden = page === "budgets";
    if (page === "budgets") {
      host.replaceChildren();
    } else {
      let finance = host.querySelector("autonomous-finance-panel");
      if (!finance) {
        finance = document.createElement("autonomous-finance-panel");
        finance.hass = this.hass;
        host.append(finance);
      }
      finance.setPage(page);
    }
    this.nav();
  }
}
customElements.define("autonomous-budget-panel", AutonomousApp);
