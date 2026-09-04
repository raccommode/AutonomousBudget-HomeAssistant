import "./autonomous-budget-panel.js?v=1.0.0";
import "./finance-panel.js?v=1.0.0";
import { baseCSS, esc } from "./shared.js?v=1.0.0";
import { translate } from "./i18n.js?v=1.0.0";
class AutonomousApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.page = "budgets";
    this.shadowRoot.innerHTML = `<style>${baseCSS}:host{height:100%;overflow:auto;background:var(--ab-bg)}nav{display:flex;gap:6px;padding:12px 24px;border-bottom:1px solid var(--ab-line);overflow:auto;background:var(--ab-surface);position:sticky;top:0;z-index:2}nav button{white-space:nowrap;border:0;background:transparent}nav .ha-menu{display:none}@media(max-width:650px){nav{padding:8px}.ha-menu{display:inline-flex!important;position:sticky;left:0;background:var(--ab-surface);z-index:1}}nav button.active{background:var(--ab-pale);color:var(--ab-green)}[hidden]{display:none!important}autonomous-budget-view{height:auto;overflow:visible}</style><nav aria-label="Finance navigation"></nav><autonomous-budget-view></autonomous-budget-view><div id="finance-host" hidden></div>`;
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
    this.shadowRoot.querySelector("nav").innerHTML =
      `<button class="ha-menu" data-menu aria-label="${esc(translate("Open Home Assistant menu", lang))}">☰</button>` +
      Object.entries(names)
        .filter(([key]) => this.prefs?.modules?.[key] !== false)
        .map(
          ([key, label]) =>
            `<button class="${this.page === key ? "active" : ""}" data-page="${key}">${esc(translate(label, lang))}</button>`,
        )
        .join("");
  }
  navigate(page) {
    this.page = page;
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
