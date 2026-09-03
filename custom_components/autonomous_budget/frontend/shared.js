import { localize, translate } from "./i18n.js?v=0.4.0";
/** Local-only shared UI primitives. No remote fonts, scripts, or trackers. */
export const labels = {
  "": "Use default",
  daily: "Daily", weekly: "Weekly", biweekly: "Every two weeks", monthly: "Monthly",
  quarterly: "Quarterly", yearly: "Yearly", once: "One time",
  investment: "Investment", mandatory: "Mandatory", optional: "Optional",
  income: "Income", expense: "Expense", personal: "Personal budget", shared: "Shared budget",
};
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export const money = (value, currency, language = "en") => new Intl.NumberFormat(language, { style: "currency", currency, currencyDisplay: "code" }).format(Number(value));
export const dateLabel = (value, year = false, language = "en") => value ? new Intl.DateTimeFormat(language, { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) }).format(new Date(`${value}T12:00:00`)) : "—";
export const options = (values, selected) => values.map((value) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(labels[value] || value)}</option>`).join("");
const paths = {
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6m18 7h-5v4h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  down: '<path d="M7 7 17 17M7 17h10V7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  investment: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
  mandatory: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  optional: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  edit: '<path d="m14 5 5 5M3 21l5-1L21 7l-5-5L3 15v6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wallet}</svg>`;

export class BudgetLiveElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.offset = 0;
    this._generation = 0;
    this._originals = new WeakMap();
    this._observer = new MutationObserver(() => {
      this._observer.disconnect();
      localize(this.shadowRoot, this.language, this._originals);
      this._observer.observe(this.shadowRoot, { subtree: true, childList: true, characterData: true });
    });
    this._observer.observe(this.shadowRoot, { subtree: true, childList: true, characterData: true });
  }
  set hass(hass) {
    const languageChanged = this._hass?.language !== hass.language;
    const changed = this._hass?.connection !== hass.connection;
    this._hass = hass;
    this.toggleAttribute("data-dark", Boolean(hass.themes?.darkMode));
    if (changed && this.isConnected) this.subscribe();
    if (languageChanged && this.data) this.render();
  }
  get hass() { return this._hass; }
  get language() { return this._hass?.language?.startsWith("fr") ? "fr" : "en"; }
  money(value, currency) { return money(value, currency, this.language); }
  dateLabel(value, year = false) { return dateLabel(value, year, this.language); }
  t(value) { return translate(value, this.language); }
  connectedCallback() { if (this._hass) this.subscribe(); }
  disconnectedCallback() { this._generation++; this._unsubscribe?.(); this._unsubscribe = null; }
  async subscribe() {
    this._unsubscribe?.();
    this._unsubscribe = null;
    const generation = ++this._generation;
    try {
      const unsubscribe = await this._hass.connection.subscribeMessage((data) => {
        if (generation !== this._generation) return;
        this.error = data.unavailable ? "Autonomous Budget is unavailable. Check the integration in Settings." : null;
        this.data = data.unavailable ? null : data;
        this.render();
      }, { type: "autonomous_budget/subscribe", offset: this.offset });
      if (generation !== this._generation || !this.isConnected) unsubscribe();
      else this._unsubscribe = unsubscribe;
    } catch (error) {
      if (generation !== this._generation) return;
      this.error = error.message || "Could not load budgets. Check the integration and reload this page.";
      this.render();
    }
  }
}

export const baseCSS = `
:host{--ab-green:#21634d;--ab-pale:#e9f3ed;--ab-text:var(--primary-text-color,#24352d);--ab-muted:var(--secondary-text-color,#6e7c74);--ab-line:var(--divider-color,#e4e9e5);--ab-surface:var(--card-background-color,#fff);--ab-bg:var(--primary-background-color,#f6f8f5);display:block;color:var(--ab-text);font-family:var(--paper-font-body1_-_font-family,Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:14px;line-height:1.5;color-scheme:light}
*{box-sizing:border-box}button,input,select{font:inherit}button,a,input,select{touch-action:manipulation}button{cursor:pointer;border:1px solid var(--ab-line);background:var(--ab-surface);color:var(--ab-text);padding:10px 15px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;font-weight:550}button:hover{filter:brightness(.96)}button:disabled{cursor:wait;opacity:.5}button.primary{background:var(--ab-green);color:white;border-color:var(--ab-green)}button.icon{padding:9px;min-width:40px}button.quiet{border-color:transparent;background:transparent}button.danger{color:#b13d37}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #88bfa7;outline-offset:3px}h1,h2,h3,p{margin:0}h1{font-size:28px;letter-spacing:-1px;font-weight:650}h2{font-size:17px;letter-spacing:-.3px;font-weight:650}h3{font-size:14px;font-weight:600}.muted{color:var(--ab-muted)}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.8px;font-weight:650}.row{display:flex;align-items:center;gap:12px}.between{justify-content:space-between}.wrap{flex-wrap:wrap}.spacer{flex:1}.number{font-variant-numeric:tabular-nums;letter-spacing:-.6px}.positive{color:var(--ab-green)}.negative{color:#bb4c41}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:5px;background:var(--ab-pale);color:var(--ab-green);font-size:11px;font-weight:600}.error{padding:16px;border-radius:10px;background:#fff0ec;color:#9d352b}.empty{text-align:center;padding:52px 24px}.empty svg{width:36px;height:36px;color:var(--ab-green);margin-bottom:14px}.empty p{max-width:380px;margin:8px auto 20px}.category-dot{width:7px;height:7px;border-radius:100%;display:inline-block;background:#78a18e}.category-dot.mandatory{background:#ab9475}.category-dot.optional{background:#9795bc}a{color:var(--ab-green)}
:host([data-dark]){--ab-green:#82c6a6;--ab-pale:#233e31;color-scheme:dark}:host([data-dark]) button.primary{background:#28664e;border-color:#28664e;color:white}
`;
