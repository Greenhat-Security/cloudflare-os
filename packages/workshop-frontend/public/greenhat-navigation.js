// Copyright (c) 2026 Green Hat Security.
// SPDX-License-Identifier: MIT
/** Greenhat navigation v1.2.0. Keep this asset identical across the app repositories.
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

// Grant IDs remain compatible with the existing admin access controls.
const MODULE_KEYS = {
  crm: 'greenspot', cal: 'calendar', type: 'greentype', pm: 'exponential',
  sign: 'sign', grc: 'grc', 'pdf-merger': 'tools', 'image-to-pdf': 'tools',
  ledger: 'ledger', 'soc2-section-3-qa': 'soc2', 'soc2-section-3-generator': 'soc2',
  cisa: 'cisa', 'qualitative-risk-generator': 'security',
};

/** Fail closed on missing/malformed authority data. Native grants come only from the host BFF. */
export function visibleNavigation(payload) {
  if (!payload || typeof payload.restricted !== 'boolean' || !Array.isArray(payload.modules) ||
      payload.modules.length > 100 || !payload.modules.every(key => typeof key === 'string') ||
      typeof payload.user?.id !== 'string' || !payload.user.id) return [];
  const unrestricted = payload.restricted === false && payload.modules.includes('*');
  const grants = new Set(payload.restricted ? payload.modules.filter(key => key !== '*') : []);
  // CRM and OS also require the existing Green Hat staff entry policy.
  const staffEmail = typeof payload.user.email === 'string' && /@greenhatsec\.com$/i.test(payload.user.email);
  const native = new Set(Array.isArray(payload.nativeModules) ? payload.nativeModules : []);
  const denied = new Set(Array.isArray(payload.deniedModules) ? payload.deniedModules : []);
  return GREENHAT_NAVIGATION.map(group => ({ ...group, items: group.items.filter(item => {
    if (denied.has(MODULE_KEYS[item.id]) || denied.has(item.id)) return false;
    if (item.id === 'os') return native.has('os') || (unrestricted && staffEmail);
    if (item.id === 'grc' && native.has('grc')) return true;
    if (item.id === 'crm' && !staffEmail) return false;
    return unrestricted || grants.has(MODULE_KEYS[item.id]);
  }) })).filter(group => group.items.length);
}

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
  :host {
    all: initial; position: fixed; inset: 0 auto 0 0; width: 64px; height: 100vh; height: 100dvh;
    z-index: var(--greenhat-navigation-z-index, 30); color-scheme: inherit;
    font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --rail-background: light-dark(#f4f8f2, #0b2222);
    --rail-border: light-dark(#d8e3d5, #214242);
    --rail-text: light-dark(#46684d, #c4f1da);
    --rail-heading: light-dark(#52654d, #8bb6a4);
    --rail-hover-background: light-dark(#e4efdf, #10302e);
    --rail-hover-text: light-dark(#254d2d, #f2fff8);
    --rail-active-background: light-dark(#dcefd3, #16433e);
    --rail-active-text: light-dark(#286b29, #7de0ae);
    --rail-accent: light-dark(#32722f, #00bb66);
    --rail-brand-background: light-dark(#62ac4a, #16433e);
    --rail-brand-text: light-dark(#123227, #c4f1da);
    --rail-tooltip-background: light-dark(#243e29, #10302e);
    --rail-tooltip-text: light-dark(#fff, #f2fff8);
    --rail-tooltip-border: light-dark(#314b34, #2f5a51);
  }
  /* Inherited app tokens repaint with native theme changes, including inside this shadow root. */
  :host([current-app="crm"]) {
    --rail-background: var(--t-background-secondary, #0b2222);
    --rail-border: var(--t-border-color-light, #214242);
    --rail-text: var(--t-font-color-secondary, #c4f1da);
    --rail-heading: var(--t-font-color-tertiary, #8bb6a4);
    --rail-hover-background: var(--t-background-tertiary, #10302e);
    --rail-hover-text: var(--t-font-color-primary, #f2fff8);
    --rail-active-background: var(--t-background-quaternary, #16433e);
    --rail-active-text: var(--t-accent-tertiary, #7de0ae);
    --rail-accent: var(--t-accent-primary, #00bb66);
    --rail-brand-background: var(--rail-active-background);
    --rail-brand-text: var(--rail-text);
    --rail-tooltip-background: var(--rail-hover-background);
    --rail-tooltip-text: var(--rail-hover-text);
    --rail-tooltip-border: var(--t-border-color-medium, #2f5a51);
  }
  :host([current-app="grc"]) {
    --rail-background: var(--color-level-1, light-dark(#fff, #132018));
    --rail-border: var(--color-border-solid, light-dark(#e7ede7, #26332b));
    --rail-text: var(--color-txt-secondary, light-dark(#586b5d, #a9bbad));
    --rail-heading: var(--rail-text);
    --rail-hover-background: var(--color-subtle-hover, light-dark(#0f8a3d14, #dcf0de12));
    --rail-hover-text: var(--color-txt-primary, light-dark(#0f1a12, #f4f7f2));
    --rail-active-background: var(--color-active, light-dark(#dcf0de, #2e9a4e26));
    --rail-active-text: var(--color-txt-accent, light-dark(#0f7a35, #62ac4a));
    --rail-accent: var(--color-border-active, light-dark(#0f8a3d, #f4f7f2));
    --rail-brand-background: var(--rail-active-background);
    --rail-brand-text: var(--rail-hover-text);
    --rail-tooltip-background: var(--color-level-2, light-dark(#fff, #1b2a21));
    --rail-tooltip-text: var(--rail-hover-text);
    --rail-tooltip-border: var(--rail-border);
  }
  :host([current-app="os"]) {
    --rail-background: var(--color-kumo-elevated, light-dark(#fff, #0b2222));
    --rail-border: var(--color-kumo-line, light-dark(#13201814, #214242));
    --rail-text: var(--text-color-kumo-subtle, light-dark(#586b5d, #8bb6a4));
    --rail-heading: var(--rail-text);
    --rail-hover-background: var(--color-kumo-fill, light-dark(#e7ede7, #10302e));
    --rail-hover-text: var(--text-color-kumo-default, light-dark(#132018, #f2fff8));
    --rail-active-background: var(--color-kumo-fill-hover, light-dark(#d3dfd3, #16433e));
    --rail-active-text: var(--text-color-kumo-brand, light-dark(#0f8a3d, #7de0ae));
    --rail-accent: var(--color-kumo-brand, light-dark(#0f8a3d, #00bb66));
    --rail-brand-background: var(--rail-active-background);
    --rail-brand-text: var(--rail-hover-text);
    --rail-tooltip-background: var(--color-kumo-tint, light-dark(#f4f7f2, #10302e));
    --rail-tooltip-text: var(--rail-hover-text);
    --rail-tooltip-border: var(--rail-border);
  }
  :host([current-app="sign"]) {
    --rail-background: hsl(var(--background, 180 51.52% 6.47%));
    --rail-border: hsl(var(--border, 180 33.33% 19.41%));
    --rail-text: hsl(var(--muted-foreground, 154.88 22.75% 62.94%));
    --rail-heading: var(--rail-text);
    --rail-hover-background: hsl(var(--muted, 176.25 50% 12.55%));
    --rail-hover-text: hsl(var(--foreground, 147.69 100% 97.45%));
    --rail-active-background: color-mix(in srgb, hsl(var(--primary, 152.73 100% 36.67%)) 18%, var(--rail-background));
    --rail-active-text: hsl(var(--primary, 152.73 100% 36.67%));
    --rail-accent: var(--rail-active-text);
    --rail-brand-background: var(--rail-active-background);
    --rail-brand-text: var(--rail-hover-text);
    --rail-tooltip-background: hsl(var(--popover, 180 51.11% 8.82%));
    --rail-tooltip-text: var(--rail-hover-text);
    --rail-tooltip-border: var(--rail-border);
  }
  *, *::before, *::after { box-sizing: border-box; }
  nav { height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--rail-border) transparent; background: var(--greenhat-navigation-background, var(--rail-background)); border-right: 1px solid var(--rail-border); padding: 10px 5px max(12px, env(safe-area-inset-bottom)); }
  .brand { width: 42px; height: 42px; margin: 0 auto 10px; display: grid; place-items: center; border-radius: 13px; background: var(--rail-brand-background); color: var(--rail-brand-text); font-size: 13px; font-weight: 750; letter-spacing: .02em; user-select: none; }
  section { margin: 0; padding: 0; }
  section + section { margin-top: 9px; padding-top: 7px; border-top: 1px solid var(--rail-border); }
  h2 { margin: 0 0 3px; text-align: center; color: var(--rail-heading); font-size: 9px; font-weight: 750; line-height: 16px; letter-spacing: .035em; text-transform: uppercase; }
  a { position: relative; display: grid; place-items: center; width: 44px; height: 44px; margin: 0 auto; border-radius: 10px; color: var(--rail-text); text-decoration: none; outline-offset: -2px; -webkit-tap-highlight-color: transparent; }
  a:hover { background: var(--rail-hover-background); color: var(--rail-hover-text); }
  a[aria-current="page"] { background: var(--rail-active-background); color: var(--rail-active-text); }
  a[aria-current="page"]::before { content: ""; position: absolute; left: -4px; top: 12px; height: 20px; width: 3px; border-radius: 3px; background: var(--rail-accent); }
  a:focus-visible { outline: 2px solid var(--rail-accent); background: var(--rail-hover-background); }
  svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
  .tooltip { position: fixed; left: 72px; top: 0; z-index: 1; width: max-content; max-width: min(300px, calc(100vw - 84px)); padding: 9px 12px; border: 1px solid var(--rail-tooltip-border); border-radius: 8px; background: var(--rail-tooltip-background); color: var(--rail-tooltip-text); box-shadow: 0 4px 14px #00000026; font-size: 12px; font-weight: 550; line-height: 1.45; overflow-wrap: anywhere; }
  .tooltip[hidden] { display: none; }
  @media (forced-colors: active) { nav { border-right: 1px solid CanvasText; } a[aria-current="page"] { outline: 2px solid Highlight; } }
`;

if (typeof window !== 'undefined' && !customElements.get('greenhat-navigation')) {
  class GreenhatNavigation extends HTMLElement {
    static get observedAttributes() { return ['current-app', 'current-path', 'nonce', 'identity-key']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hideTimer = null;
      this._refresh = () => { this.updateActive(); this.hideTooltip(); };
      this._hide = () => this.hideTooltip();
      this._accessGroups = [];
      this._accessController = null;
      this._checkAccess = () => { void this.refreshAccess(); };
      this._visibility = () => {
        if (document.visibilityState === 'visible') this._checkAccess();
        else this.clearAccess();
      };
    }

    connectedCallback() {
      if (!this.shadowRoot.querySelector('nav')) this.render();
      this.updateActive();
      window.addEventListener('popstate', this._refresh);
      window.addEventListener('resize', this._hide);
      window.addEventListener('focus', this._checkAccess);
      window.addEventListener('pageshow', this._checkAccess);
      document.addEventListener('visibilitychange', this._visibility);
      this._accessTimer = setInterval(this._checkAccess, 60_000);
      this._checkAccess();
    }

    disconnectedCallback() {
      clearTimeout(this._hideTimer);
      window.removeEventListener('popstate', this._refresh);
      window.removeEventListener('resize', this._hide);
      window.removeEventListener('focus', this._checkAccess);
      window.removeEventListener('pageshow', this._checkAccess);
      document.removeEventListener('visibilitychange', this._visibility);
      clearInterval(this._accessTimer);
      this.clearAccess();
    }

    attributeChangedCallback(name) {
      if (name === 'nonce') {
        const style = this.shadowRoot.querySelector('style');
        if (style) style.nonce = this.nonce || this.getAttribute('nonce') || window.__webpack_nonce__ || '';
      } else if (name === 'identity-key') {
        this.clearAccess();
        if (this.isConnected) this._checkAccess();
      } else {
        this.updateActive();
      }
    }

    clearAccess() {
      this._accessController?.abort();
      this._accessController = null;
      this._accessGroups = [];
      this.hideTooltip();
      this.shadowRoot.replaceChildren();
      this.render();
    }

    async refreshAccess() {
      if (!this.isConnected || document.visibilityState === 'hidden' || this._accessController) return;
      let focusedId = this.shadowRoot.activeElement?.dataset.id;
      // Do not steal focus if the person moves elsewhere while the lookup is pending.
      const movedFocus = () => { focusedId = null; };
      this.clearAccess();
      for (const event of ['focusin', 'pointerdown', 'keydown']) document.addEventListener(event, movedFocus, true);
      const controller = new AbortController();
      this._accessController = controller;
      // Host authentication and authority lookups can take up to fifteen seconds together.
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch('/api/me/module-access', {
          credentials: 'same-origin', cache: 'no-store', redirect: 'error',
          headers: { accept: 'application/json' }, signal: controller.signal,
        });
        if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return;
        const reader = response.body?.getReader();
        if (!reader) return;
        let bytes = 0;
        let body = '';
        const decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 16_384) { await reader.cancel(); return; }
            body += decoder.decode(value, { stream: true });
          }
          body += decoder.decode();
        } finally { reader.releaseLock(); }
        if (controller.signal.aborted || this._accessController !== controller || !this.isConnected) return;
        this._accessGroups = visibleNavigation(JSON.parse(body));
        this.shadowRoot.replaceChildren();
        this.render();
        this.updateActive();
        if (focusedId && document.activeElement === document.body) {
          const link = [...this.shadowRoot.querySelectorAll('a')].find(link => link.dataset.id === focusedId);
          link?.focus({ preventScroll: true });
        }
      } catch {
        // Unverified access never falls back to the full catalog or a saved account's grants.
      } finally {
        clearTimeout(timeout);
        for (const event of ['focusin', 'pointerdown', 'keydown']) document.removeEventListener(event, movedFocus, true);
        if (this._accessController === controller) this._accessController = null;
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

      for (const [index, group] of this._accessGroups.entries()) {
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
