import { colors } from "../theme";
import type { CallSession, RoleScope, RoleRegion } from "../types";

export interface SidebarCallbacks {
  onRunQuote: () => void;
  onLockPrice: () => void;
  onGenerateJds: () => void;
  onResolveFlag: (index: number) => void;
  onSaveRole: (role: RoleScope) => void;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
const fmtPct = (n: number) => Math.round(n * 100) + "%";

/**
 * Renders the coaching sidebar into a Shadow DOM host, isolated from
 * Meet's own styles. Uses event delegation (one listener on the root)
 * instead of re-binding handlers on every render, since render() rebuilds
 * innerHTML wholesale — simplest correct approach without a framework.
 */
export class Sidebar {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private root: HTMLElement;
  private callbacks: SidebarCallbacks;

  private session: CallSession | null = null;
  private objectionSuggestions: string[] = [];
  private errorMessage: string | null = null;
  private bannerMessage: string | null = null;
  private editingRoleId: string | null = null;
  private busy = false;
  // Collapsed by default: a fixed 320px panel permanently covering the
  // right edge of the page is a bad time when a rep is screen-sharing —
  // it overlaps whatever they're presenting, since Meet has no idea our
  // panel exists and doesn't reflow around it. Starts collapsed to a
  // small tab; the rep expands it when they actually want to look at it.
  private collapsed = false;

  constructor(callbacks: SidebarCallbacks) {
    this.callbacks = callbacks;

    this.host = document.createElement("div");
    this.host.id = "deal-assistant-sidebar-host";
    this.host.style.cssText = "position: fixed; top: 0; right: 0; z-index: 2147483647; pointer-events: auto;";
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: "open" });
    this.root = document.createElement("div");
    this.shadow.appendChild(this.styleEl());
    this.shadow.appendChild(this.root);

    this.root.addEventListener("click", (e) => this.handleClick(e));
    this.loadCollapsedState();
    this.render();
  }

  private async loadCollapsedState(): Promise<void> {
    // Every fresh page load starts expanded regardless of what was saved
    // last time — a stale "collapsed" preference from a previous call must
    // never leave the rep with no visible way to open the panel again.
    // Manual minimizing during the current page's session still works via
    // setCollapsed(); we just don't carry a collapsed state across reloads.
    await chrome.storage.local.remove("dealAssistantSidebarCollapsed");
  }

  private setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.render();
  }

  update(session: CallSession): void {
    this.session = session;
    this.busy = false;
    this.render();
  }

  setObjectionSuggestions(suggestions: string[]): void {
    this.objectionSuggestions = suggestions;
    this.render();
  }

  setError(message: string | null): void {
    this.errorMessage = message;
    this.busy = false;
    this.render();
  }

  setBanner(message: string | null): void {
    this.bannerMessage = message;
    this.render();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.render();
  }

  hasSession(): boolean {
    return this.session !== null;
  }

  private handleClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "toggle-collapse") {
      this.setCollapsed(!this.collapsed);
    } else if (action === "dismiss-error") {
      this.setError(null);
    } else if (action === "run-quote") {
      this.setBusy(true);
      this.callbacks.onRunQuote();
    } else if (action === "lock-price") {
      this.setBusy(true);
      this.callbacks.onLockPrice();
    } else if (action === "generate-jds") {
      this.setBusy(true);
      this.callbacks.onGenerateJds();
    } else if (action === "resolve-flag") {
      const index = Number(target.dataset.flagIndex);
      this.callbacks.onResolveFlag(index);
    } else if (action === "edit-role") {
      this.editingRoleId = target.dataset.roleId ?? null;
      this.render();
    } else if (action === "cancel-edit") {
      this.editingRoleId = null;
      this.render();
    } else if (action === "save-role") {
      const roleId = target.dataset.roleId;
      const role = this.session?.roles.find((r) => r.id === roleId);
      if (!role) return;
      const container = this.root.querySelector(`[data-role-edit="${roleId}"]`);
      if (!container) return;
      const get = (name: string) =>
        (container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? "").trim();
      const updated: RoleScope = {
        ...role,
        title: get("title") || null,
        seniority: get("seniority") || null,
        region: (get("region") || null) as RoleRegion | null,
        mustHaves: get("mustHaves").split(",").map((s) => s.trim()).filter(Boolean),
        niceToHaves: get("niceToHaves").split(",").map((s) => s.trim()).filter(Boolean),
      };
      this.editingRoleId = null;
      this.callbacks.onSaveRole(updated);
    }
  }

  private styleEl(): HTMLStyleElement {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .panel { width: 320px; height: 100vh; background: ${colors.navy}; color: ${colors.cream};
        border-left: 1px solid ${colors.navyBorder}; overflow-y: auto; padding: 1rem; font-size: 13px; }
      .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
      .collapse-btn { background: transparent; border: 1px solid ${colors.navyMid}; color: ${colors.cream};
        border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 12px; cursor: pointer; margin: 0; }
      .tab { width: 44px; height: 44px; margin-top: 5rem; background: ${colors.navy};
        border: 1px solid ${colors.navyBorder}; border-right: none; border-radius: 10px 0 0 10px;
        display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; }
      .tab span { color: ${colors.orange}; font-weight: bold; font-size: 18px; }
      .tab .dot { position: absolute; top: 4px; right: 4px; width: 10px; height: 10px;
        border-radius: 50%; background: ${colors.redAccent}; }
      h2 { font-size: 15px; margin: 0; color: ${colors.cream}; }
      h3 { font-size: 12px; color: ${colors.orange}; margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.03em; }
      .card { background: ${colors.navyLight}; border: 1px solid ${colors.navyBorder}; border-radius: 10px;
        padding: 0.75rem; margin-bottom: 0.75rem; }
      .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 11px; font-weight: bold; }
      .field { margin-bottom: 0.4rem; }
      .field label { display: block; color: ${colors.beige}; font-size: 11px; margin-bottom: 0.15rem; }
      .field input, .field select { width: 100%; padding: 0.4rem; background: ${colors.navyMid};
        border: 1px solid ${colors.navyBorder}; border-radius: 6px; color: ${colors.cream}; font-size: 12px; }
      button { cursor: pointer; border-radius: 6px; font-weight: bold; font-size: 12px; padding: 0.45rem 0.75rem;
        border: 2px solid ${colors.orange}; background: ${colors.orange}; color: ${colors.navy}; margin-right: 0.4rem; margin-top: 0.4rem; }
      button.secondary { background: transparent; color: ${colors.cream}; border-color: ${colors.navyMid}; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .banner { background: ${colors.yellowAccent}22; border: 1px solid ${colors.yellowAccent}; color: ${colors.yellowAccent};
        border-radius: 8px; padding: 0.6rem; margin-bottom: 0.75rem; font-size: 12px; }
      .error { background: ${colors.redAccent}22; border: 1px solid ${colors.redAccent}; color: ${colors.redAccent};
        border-radius: 8px; padding: 0.6rem; margin-bottom: 0.75rem; font-size: 12px; }
      .muted { color: ${colors.beige}; font-size: 12px; }
      ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
      li { margin-bottom: 0.2rem; }
    `;
    return style;
  }

  private render(): void {
    if (this.collapsed) {
      this.root.innerHTML = `
        <div class="tab" data-action="toggle-collapse" title="Open Deal Assistant">
          <span>S</span>
          ${this.errorMessage ? '<div class="dot"></div>' : ""}
        </div>
      `;
      return;
    }

    const s = this.session;

    this.root.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2>Deal Assistant</h2>
          <button class="collapse-btn" data-action="toggle-collapse">Minimize</button>
        </div>
        ${this.bannerMessage ? `<div class="banner">${escapeHtml(this.bannerMessage)}</div>` : ""}
        ${this.errorMessage ? `<div class="error">${escapeHtml(this.errorMessage)} <span data-action="dismiss-error" style="cursor:pointer;float:right">&times;</span></div>` : ""}
        ${!s ? `<p class="muted">No active session for this call yet. Click the Deal Assistant icon in your toolbar to start one.</p>` : this.renderSession(s)}
      </div>
    `;
  }

  private renderSession(s: CallSession): string {
    return `
      <div class="card">
        <span class="badge" style="background:${colors.orange}22;color:${colors.orange};border:1px solid ${colors.orange}">${escapeHtml(s.status)}</span>
      </div>
      ${this.renderCallStructure(s)}
      ${this.renderRoles(s)}
      ${this.renderFlags(s)}
      ${this.renderObjections()}
      ${this.renderQuote(s)}
      ${this.renderJds(s)}
    `;
  }

  // Informational only — a soft nudge for the rep to glance at, never
  // blocks any action. Phases are order-free: a real call jumps around
  // based on what the client brings up, so this just tracks what's been
  // covered at all, not whether it happened in the "right" sequence.
  private renderCallStructure(s: CallSession): string {
    const roleScopingDone = s.roles.some(
      (r) => r.title && r.seniority && r.region && r.mustHaves.length > 0
    );
    const items: { label: string; done: boolean }[] = [
      { label: "Agenda set", done: s.callPhases.agendaSet },
      { label: "Discovery", done: s.callPhases.discoveryCovered },
      { label: "Role scoping", done: roleScopingDone },
      { label: "Consultative diagnosis", done: s.callPhases.consultativeDiagnosisGiven },
      { label: "Process explained", done: s.callPhases.processExplained },
      { label: "Pricing discussed", done: s.callPhases.pricingDiscussed },
      { label: "Close attempted", done: s.callPhases.closeAttempted },
    ];
    return `
      <div class="card">
        <h3>Call Structure</h3>
        <ul style="list-style:none;padding-left:0;margin:0">
          ${items
            .map(
              (item) => `
                <li style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem;color:${
                  item.done ? colors.cream : colors.beige
                }">
                  <span style="color:${item.done ? colors.greenAccent : colors.navyMid}">${item.done ? "✓" : "○"}</span>
                  ${escapeHtml(item.label)}
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
    `;
  }

  private renderRoles(s: CallSession): string {
    if (s.roles.length === 0) {
      return `<div class="card"><h3>Roles</h3><p class="muted">No roles detected yet — keep talking, captions must be on.</p></div>`;
    }
    return s.roles
      .map((role) => {
        if (this.editingRoleId === role.id) {
          return `
            <div class="card" data-role-edit="${role.id}">
              <h3>Editing role</h3>
              <div class="field"><label>Title</label><input name="title" value="${escapeAttr(role.title ?? "")}" /></div>
              <div class="field"><label>Seniority</label><input name="seniority" value="${escapeAttr(role.seniority ?? "")}" /></div>
              <div class="field"><label>Region</label>
                <select name="region">
                  <option value="" ${!role.region ? "selected" : ""}>Not set</option>
                  <option value="Africa" ${role.region === "Africa" ? "selected" : ""}>Africa</option>
                  <option value="LATAM" ${role.region === "LATAM" ? "selected" : ""}>LATAM</option>
                  <option value="Both" ${role.region === "Both" ? "selected" : ""}>Both (no preference)</option>
                </select>
              </div>
              <div class="field"><label>Must-haves (comma separated)</label><input name="mustHaves" value="${escapeAttr(role.mustHaves.join(", "))}" /></div>
              <div class="field"><label>Nice-to-haves (comma separated)</label><input name="niceToHaves" value="${escapeAttr(role.niceToHaves.join(", "))}" /></div>
              <button data-action="save-role" data-role-id="${role.id}">Save</button>
              <button class="secondary" data-action="cancel-edit">Cancel</button>
            </div>
          `;
        }
        return `
          <div class="card">
            <h3>${escapeHtml(role.title ?? "Untitled role")}</h3>
            <p class="muted">${escapeHtml(role.seniority ?? "Seniority unknown")} · ${escapeHtml(role.region ?? "Region unknown")}</p>
            ${role.mustHaves.length ? `<p class="muted">Must-haves: ${escapeHtml(role.mustHaves.join(", "))}</p>` : ""}
            ${role.niceToHaves.length ? `<p class="muted">Nice-to-haves: ${escapeHtml(role.niceToHaves.join(", "))}</p>` : ""}
            <button class="secondary" data-action="edit-role" data-role-id="${role.id}">Edit</button>
          </div>
        `;
      })
      .join("");
  }

  private renderFlags(s: CallSession): string {
    const unresolved = s.scopeFlags.filter((f) => !f.resolved);
    if (unresolved.length === 0) return "";
    return `
      <div class="card">
        <h3>Flags</h3>
        <ul>
          ${s.scopeFlags
            .map((f, i) =>
              f.resolved
                ? ""
                : `<li>${escapeHtml(f.message)} <button class="secondary" data-action="resolve-flag" data-flag-index="${i}" style="margin-top:0.2rem">Resolve</button></li>`
            )
            .join("")}
        </ul>
      </div>
    `;
  }

  private renderObjections(): string {
    if (this.objectionSuggestions.length === 0) return "";
    return `
      <div class="card">
        <h3>Objection handling</h3>
        <ul>${this.objectionSuggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      </div>
    `;
  }

  private renderQuote(s: CallSession): string {
    const { marginPct, dealWorthIt, finalPrice, tier, recommendations, monthlySavings, annualSavings, lockedAt } =
      s.quote;
    return `
      <div class="card">
        <h3>Pricing</h3>
        ${
          finalPrice !== null
            ? `<p>Price: <strong>${fmt(finalPrice)}</strong></p>
               <p class="muted">Margin: ${marginPct !== null ? fmtPct(marginPct) : "—"} ${tier ? `· ${escapeHtml(tier)}` : ""} ${dealWorthIt === false ? "(below floor)" : ""}</p>`
            : `<p class="muted">Not priced yet.</p>`
        }
        ${
          // typeof check (not !== null) because sessions quoted before this
          // field existed have no monthlySavings/annualSavings key at all —
          // undefined, not null — and fmt(undefined) renders as "$NaN".
          typeof monthlySavings === "number" && typeof annualSavings === "number"
            ? `<p style="color:${colors.greenAccent}">Client saves <strong>${fmt(monthlySavings)}/mo</strong> vs. a US hire (${fmt(annualSavings)}/yr)</p>`
            : ""
        }
        ${this.renderRecommendations(recommendations)}
        ${!lockedAt ? `<button data-action="run-quote" ${this.busy ? "disabled" : ""}>Calculate Price</button>` : ""}
        ${finalPrice !== null && !lockedAt ? `<button data-action="lock-price" ${this.busy ? "disabled" : ""}>Lock Price With Client</button>` : ""}
        ${lockedAt ? `<p class="muted">Locked ${new Date(lockedAt).toLocaleTimeString()}</p>` : ""}
      </div>
    `;
  }

  private renderRecommendations(recommendations: CallSession["quote"]["recommendations"]): string {
    if (!recommendations) return "";
    const { toSafeStrong, toHero, lowerSeniority } = recommendations;
    if (!toSafeStrong && !toHero && !lowerSeniority) return "";

    const lines: string[] = [];
    if (toSafeStrong) {
      lines.push(
        `To make this a <strong>Safe-Strong</strong> deal: raise the price to <strong>${fmt(toSafeStrong.priceNeeded)}</strong> (+${fmt(toSafeStrong.priceIncrease)}).`
      );
    }
    if (toHero) {
      lines.push(
        `To make this a <strong>Hero</strong> deal: raise the price to <strong>${fmt(toHero.priceNeeded)}</strong> (+${fmt(toHero.priceIncrease)}).`
      );
    }
    if (lowerSeniority) {
      lines.push(
        `Or scope ${escapeHtml(lowerSeniority.roleTitle ?? "this role")} as <strong>${escapeHtml(lowerSeniority.suggestedSeniority)}</strong> instead of ${escapeHtml(lowerSeniority.currentSeniority)}: margin becomes ${fmtPct(lowerSeniority.newMarginPct)} (${escapeHtml(lowerSeniority.newTier)}) at ${fmt(lowerSeniority.newFinalPrice)}.`
      );
    }

    return `
      <div class="banner" style="margin-top:0.5rem">
        <strong>Recommendations</strong>
        <ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>
      </div>
    `;
  }

  private renderJds(s: CallSession): string {
    if (!s.quote.lockedAt) return "";
    return `
      <div class="card">
        <h3>Job Descriptions</h3>
        ${s.jds.length === 0 ? `<button data-action="generate-jds" ${this.busy ? "disabled" : ""}>Generate JDs</button>` : ""}
        ${s.jds
          .map(
            (jd) =>
              `<p class="muted">JD generated for role ${escapeHtml(jd.roleId)} — <a href="#" style="color:${colors.orange}" data-action="none">view</a></p>`
          )
          .join("")}
      </div>
    `;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
