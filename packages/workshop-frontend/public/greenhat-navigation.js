// Copyright (c) 2026 Green Hat Security.
// SPDX-License-Identifier: MIT
/** Greenhat navigation v1.0.0. Keep this asset identical across the app repositories.
 * Mount inside the signed-in app shell; the host app reserves 64px on the left.
 * This component only provides links. Each destination retains its own access rules.
 */
export const GREENHAT_NAVIGATION = [
  { label: 'Core', items: [
    { id: 'crm', label: 'GreenCRM (CRM)', href: 'https://crm.greenhatsec.com', icon: 'contacts' },
    { id: 'cal', label: 'Calendar (Cal)', href: 'https://cal.greenhatsec.com', icon: 'calendar' },
    { id: 'type', label: 'GreenType (Notes)', href: 'https://type.greenhatsec.com', icon: 'notes' },
    { id: 'pm', label: 'GreenPM (Project Management)', href: 'https://pm.greenhatsec.com', icon: 'projects' },
    { id: 'sign', label: 'GreenSign (Signature)', href: 'https://sign.greenhatsec.com', icon: 'signature' },
    { id: 'grc', label: 'GreenGRC', href: 'https://grc.greenhatsec.com', icon: 'shield' },
    { id: 'os', label: 'GreenOS', href: 'https://os.greenhatsec.com', icon: 'monitor' },
  ] },
  { label: 'Tools', items: [
    { id: 'pdf-merger', label: 'PDF Merger', href: 'https://tools.greenhatsec.com/pdf-merger', icon: 'merge' },
    { id: 'image-to-pdf', label: 'Image to PDF', href: 'https://tools.greenhatsec.com/image-to-pdf', icon: 'image' },
  ] },
  { label: 'SOC 2', items: [
    { id: 'ledger', label: 'Audit Ledger', href: 'https://ledger.greenhatsec.com', icon: 'ledger' },
    { id: 'soc2-section-3-qa', label: 'SOC 2 Section 3 QA Review', href: 'https://tools.greenhatsec.com/soc2-section-3-qa', icon: 'review' },
    { id: 'soc2-section-3-generator', label: 'SOC 2 Section 3 Generator', href: 'https://tools.greenhatsec.com/soc2-section-3-generator', icon: 'document' },
  ] },
  { label: 'Misc', items: [
    { id: 'cisa', label: 'CISA Study', href: 'https://cisa.greenhatsec.com', icon: 'study' },
    { id: 'qualitative-risk-generator', label: 'Qualitative Risk Generator', href: 'https://tools.greenhatsec.com/qualitative-risk-generator', icon: 'risk' },
  ] },
];

const ICONS = {
  contacts: [{"tag":"path","attributes":{"d":"M16 4h3v17H5V4h3M9 2h6v4H9z"}},{"tag":"circle","attributes":{"cx":"12","cy":"11","r":"2.5"}},{"tag":"path","attributes":{"d":"M8 19v-1a4 4 0 0 1 8 0v1"}}],
  calendar: [{"tag":"rect","attributes":{"x":"3","y":"5","width":"18","height":"16","rx":"2"}},{"tag":"path","attributes":{"d":"M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01"}}],
  notes: [{"tag":"path","attributes":{"d":"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"}}],
  projects: [{"tag":"rect","attributes":{"x":"3","y":"4","width":"18","height":"16","rx":"2"}},{"tag":"path","attributes":{"d":"M9 4v16M15 4v16M5.5 8h1M11.5 8h1M17.5 8h1M5.5 12h1M11.5 12h1"}}],
  signature: [{"tag":"path","attributes":{"d":"M11 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M14 6l4 4M10 14l1-4 8-8 3 3-8 8zM8 17h8"}}],
  shield: [{"tag":"path","attributes":{"d":"M12 3l8 4v5c0 5-8 9-8 9S4 17 4 12V7zM8.5 12l2.5 2.5 4.5-5"}}],
  monitor: [{"tag":"rect","attributes":{"x":"3","y":"3","width":"18","height":"14","rx":"2"}},{"tag":"path","attributes":{"d":"M8 21h8M12 17v4M7 8l3 2-3 2M13 12h4"}}],
  merge: [{"tag":"path","attributes":{"d":"M8 3H4a1 1 0 0 0-1 1v11h5M16 3h4a1 1 0 0 1 1 1v11h-5M8 7l4 4 4-4M12 3v8"}},{"tag":"rect","attributes":{"x":"8","y":"15","width":"8","height":"6","rx":"1"}}],
  image: [{"tag":"rect","attributes":{"x":"3","y":"3","width":"18","height":"18","rx":"2"}},{"tag":"circle","attributes":{"cx":"8","cy":"8","r":"1.5"}},{"tag":"path","attributes":{"d":"M21 15l-5-5L5 21M3 16l4-4 3 3"}}],
  ledger: [{"tag":"path","attributes":{"d":"M6 3h14v18H6a3 3 0 0 1 0-6h14M6 3a3 3 0 0 0-3 3v12M9 7h7M9 11h5"}}],
  review: [{"tag":"path","attributes":{"d":"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 14l2.5 2.5L16 11"}}],
  document: [{"tag":"path","attributes":{"d":"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6"}}],
  study: [{"tag":"path","attributes":{"d":"M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2zM12 6v15"}}],
  risk: [{"tag":"path","attributes":{"d":"M10.3 4.3L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0zM12 9v5M12 17h.01"}}],
};

const CSS = `
  :host { all: initial; position: fixed; inset: 0 auto 0 0; width: 64px; height: 100vh; height: 100dvh; z-index: var(--greenhat-navigation-z-index, 30); color-scheme: light; font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  *, *::before, *::after { box-sizing: border-box; }
  nav { height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #b9ccb8 transparent; background: #f4f8f2; border-right: 1px solid #d8e3d5; padding: 10px 5px max(12px, env(safe-area-inset-bottom)); }
  .brand { width: 42px; height: 42px; margin: 0 auto 10px; display: grid; place-items: center; border-radius: 13px; background: #62ac4a; color: #fff; font-size: 13px; font-weight: 750; letter-spacing: .02em; user-select: none; }
  section { margin: 0; padding: 0; }
  section + section { margin-top: 9px; padding-top: 7px; border-top: 1px solid #dce7d8; }
  h2 { margin: 0 0 3px; text-align: center; color: #52654d; font-size: 9px; font-weight: 750; line-height: 16px; letter-spacing: .035em; text-transform: uppercase; }
  a { position: relative; display: grid; place-items: center; width: 44px; height: 44px; margin: 0 auto; border-radius: 10px; color: #46684d; text-decoration: none; outline-offset: -2px; -webkit-tap-highlight-color: transparent; }
  a:hover { background: #e4efdf; color: #254d2d; }
  a[aria-current="page"] { background: #dcefd3; color: #286b29; }
  a[aria-current="page"]::before { content: ""; position: absolute; left: -4px; top: 12px; height: 20px; width: 3px; border-radius: 3px; background: #62ac4a; }
  a:focus-visible { outline: 2px solid #32722f; background: #e4efdf; }
  svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
  .tooltip { position: fixed; left: 72px; top: 0; z-index: 1; width: max-content; max-width: min(300px, calc(100vw - 84px)); padding: 9px 12px; border: 1px solid #314b34; border-radius: 8px; background: #243e29; color: #fff; box-shadow: 0 4px 14px #17271926; font-size: 12px; font-weight: 550; line-height: 1.45; overflow-wrap: anywhere; }
  .tooltip[hidden] { display: none; }
  @media (forced-colors: active) { nav { border-right: 1px solid CanvasText; } a[aria-current="page"] { outline: 2px solid Highlight; } }
`;

if (typeof window !== 'undefined' && !customElements.get('greenhat-navigation')) {
  class GreenhatNavigation extends HTMLElement {
    static get observedAttributes() { return ['current-app', 'current-path', 'nonce']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hideTimer = null;
      this._refresh = () => { this.updateActive(); this.hideTooltip(); };
      this._hide = () => this.hideTooltip();
    }

    connectedCallback() {
      if (!this.shadowRoot.querySelector('nav')) this.render();
      this.updateActive();
      window.addEventListener('popstate', this._refresh);
      window.addEventListener('resize', this._hide);
    }

    disconnectedCallback() {
      clearTimeout(this._hideTimer);
      window.removeEventListener('popstate', this._refresh);
      window.removeEventListener('resize', this._hide);
    }

    attributeChangedCallback(name) {
      if (name === 'nonce') {
        const style = this.shadowRoot.querySelector('style');
        if (style) style.nonce = this.nonce || this.getAttribute('nonce') || window.__webpack_nonce__ || '';
      } else {
        this.updateActive();
      }
    }

    render() {
      const style = document.createElement('style');
      style.nonce = this.nonce || this.getAttribute('nonce') || window.__webpack_nonce__ || '';
      style.textContent = CSS;
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', 'Greenhat apps and tools');
      const brand = document.createElement('div');
      brand.className = 'brand';
      brand.textContent = 'GH';
      brand.setAttribute('aria-label', 'Greenhat');
      nav.append(brand);

      for (const [index, group] of GREENHAT_NAVIGATION.entries()) {
        const section = document.createElement('section');
        const heading = document.createElement('h2');
        heading.id = `group-${index}`;
        heading.textContent = group.label;
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading);
        for (const item of group.items) {
          const link = document.createElement('a');
          link.dataset.id = item.id;
          link.dataset.destination = item.href;
          link.href = item.href;
          link.setAttribute('aria-label', item.label);
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('aria-hidden', 'true');
          for (const shape of ICONS[item.icon]) {
            const element = document.createElementNS('http://www.w3.org/2000/svg', shape.tag);
            for (const [name, value] of Object.entries(shape.attributes)) element.setAttribute(name, value);
            svg.append(element);
          }
          link.append(svg);
          link.addEventListener('mouseenter', () => this.showTooltip(link));
          link.addEventListener('mouseleave', () => this.scheduleHide());
          link.addEventListener('focus', () => this.showTooltip(link));
          link.addEventListener('blur', () => this.hideTooltip());
          link.addEventListener('click', () => this.hideTooltip());
          section.append(link);
        }
        nav.append(section);
      }
      nav.addEventListener('scroll', () => {
        const focused = this.shadowRoot.activeElement;
        const rect = focused?.getBoundingClientRect();
        // Keyboard focus can scroll a link into view after its focus event.
        // Keep that label visible at its new position; pointer scrolling hides it.
        if (focused === this._tooltipLink && focused?.matches('a:focus-visible') && rect.top >= 0 && rect.bottom <= window.innerHeight) {
          this.showTooltip(focused);
        } else {
          this.hideTooltip();
        }
      }, { passive: true });
      nav.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.hideTooltip();
      });
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.hidden = true;
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.addEventListener('mouseenter', () => clearTimeout(this._hideTimer));
      tooltip.addEventListener('mouseleave', () => this.scheduleHide());
      this.shadowRoot.append(style, nav, tooltip);
    }

    updateActive() {
      const app = this.getAttribute('current-app') || location.hostname.split('.')[0];
      const path = (this.getAttribute('current-path') || location.pathname).replace(/\/$/, '') || '/';
      for (const link of this.shadowRoot.querySelectorAll('a')) {
        const destination = new URL(link.dataset.destination);
        const destinationApp = destination.hostname.split('.')[0];
        const sameApp = app === destinationApp;
        link.href = sameApp ? destination.pathname : link.dataset.destination;
        const active = sameApp && (destination.pathname === '/' || path === destination.pathname || path.startsWith(`${destination.pathname}/`));
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    }

    showTooltip(link) {
      clearTimeout(this._hideTimer);
      this._tooltipLink = link;
      const tooltip = this.shadowRoot.querySelector('.tooltip');
      tooltip.textContent = link.getAttribute('aria-label');
      tooltip.hidden = false;
      const rect = link.getBoundingClientRect();
      const top = Math.max(8, Math.min(rect.top + (rect.height - tooltip.offsetHeight) / 2, window.innerHeight - tooltip.offsetHeight - 8));
      tooltip.style.top = `${top}px`;
    }

    scheduleHide() {
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => this.hideTooltip(), 120);
    }

    hideTooltip() {
      clearTimeout(this._hideTimer);
      this._tooltipLink = null;
      const tooltip = this.shadowRoot.querySelector('.tooltip');
      if (tooltip) tooltip.hidden = true;
    }
  }
  customElements.define('greenhat-navigation', GreenhatNavigation);
}
