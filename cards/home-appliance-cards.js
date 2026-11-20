/*
 * home-appliance-cards.js — animated appliance & bin cards for Home Assistant (MIT, github.com/sbirchfield70/ha-3d-dashboards)
 * One self-contained file: no build step, no dependencies, no updates to chase.
 * Config keys match the popular "Animated Appliance & Energy Cards" and "Poubelle Card", so switching is a type rename.
 *
 *   home-fridge-card        home-washer-card       home-tv-card
 *   home-ceiling-fan-card   home-fan-card          home-ac-split-card
 *   home-garage-door-card   home-mower-card        home-vacuum-card
 *   home-mini-pc-card       home-server-rack-card  home-bin-card
 */
(() => {
  const VERSION = "1.1.2";
  const OFFS = ["off", "standby", "unavailable", "unknown", "idle", "none", ""];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap = (s) => { s = String(s ?? "").replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };
  const fmtNum = (v, d = 0) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  const fmtMin = (m) => {
    if (m == null || isNaN(m)) return "—";
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim();
  };
  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min. ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  };
  const clock = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const BASE_CSS = `
    :host{display:block;min-width:0}
    ha-card{padding:12px 12px 14px;color:var(--primary-text-color);overflow:hidden;box-sizing:border-box;height:100%}
    .hd{display:flex;align-items:flex-start;gap:8px;min-height:22px}
    .tt{font-weight:600;font-size:15px;flex:1;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sub{font-size:12px;color:var(--secondary-text-color);margin-top:2px}
    .stt{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--secondary-text-color);white-space:nowrap}
    .dot{width:8px;height:8px;border-radius:50%;background:#8a9bb5;flex:none}
    .dot.on{background:#ffbf47;box-shadow:0 0 6px #ffbf47}
    .dot.ok{background:#4cd38a;box-shadow:0 0 6px #4cd38a}
    .dot.bad{background:#ff6a5a;box-shadow:0 0 6px #ff6a5a}
    .dot.cool{background:#6cc4ff;box-shadow:0 0 6px #6cc4ff}
    .chip{font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;border:1px solid currentColor;display:inline-flex;align-items:center;gap:3px}
    .chip.good{color:#5fe39a;background:rgba(95,227,154,.12)}
    .chip.warn{color:#ff8a7a;background:rgba(255,106,90,.14)}
    .chip.dim{color:var(--secondary-text-color);background:rgba(255,255,255,.06)}
    .chip ha-icon{--mdc-icon-size:12px}
    .pw{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:var(--secondary-text-color);display:flex;align-items:center;justify-content:center;cursor:pointer;margin-left:6px;flex:none}
    .pw.on{background:#e6ebf2;color:#10223f}
    .pw ha-icon{--mdc-icon-size:18px}
    .body{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:10px}
    .art{width:120px;min-height:130px;border-radius:14px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}
    .art svg{width:100%;height:auto;display:block}
    .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;flex:1 1 140px;min-width:0;align-content:center}
    .tiles:empty{display:none}
    .tile{background:rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;cursor:pointer;min-width:0}
    .tv{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tl{font-size:11px;color:var(--secondary-text-color);display:flex;align-items:center;gap:4px;margin-top:2px}
    .tl ha-icon{--mdc-icon-size:13px}
    .btns{display:flex;gap:8px;margin-top:10px}
    .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:9px 6px;border-radius:999px;border:none;cursor:pointer;
         background:rgba(255,255,255,.08);color:var(--primary-text-color);font:600 13px/1 inherit}
    .btn ha-icon{--mdc-icon-size:16px}
    .btn.act{background:#e6ebf2;color:#10223f}
    .btn:disabled{opacity:.45;cursor:default}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-top:10px}
    .stat{background:rgba(255,255,255,.06);border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer;min-width:0}
    .stat .v{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stat .l{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);margin-top:2px}
    .info{margin-top:10px;background:rgba(255,255,255,.06);border-radius:10px;padding:8px;text-align:center}
    .info .l{font-size:11px;color:var(--secondary-text-color);display:flex;align-items:center;justify-content:center;gap:4px}
    .info .l ha-icon{--mdc-icon-size:12px}
    .info .v{font-weight:700;font-size:15px;margin-top:2px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
    @keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}
  `;

  class Base extends HTMLElement {
    setConfig(c) {
      if (!c) throw new Error("Invalid configuration");
      this._c = { ...c };
      this._built = false;
      if (this._h) this._render();
    }
    set hass(h) { this._h = h; this._render(); }
    get hass() { return this._h; }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 12, rows: "auto" }; }
    _render() {
      if (!this._h || !this._c) return;
      if (!this._built) {
        if (!this.shadowRoot) this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<style>${BASE_CSS}${this.css ? this.css() : ""}</style><ha-card>${this.html()}</ha-card>`;
        this.$ = (s) => this.shadowRoot.querySelector(s);
        this.shadowRoot.querySelectorAll("[data-more]").forEach((el) =>
          el.addEventListener("click", () => this.more(this._c[el.dataset.more] || el.dataset.more)));
        this.wire && this.wire();
        this._built = true;
      }
      this.update();
    }
    st(id) { return id ? this._h.states[id] : undefined; }
    val(id) { const s = this.st(id); return s ? s.state : undefined; }
    num(id) { const v = parseFloat(this.val(id)); return isNaN(v) ? null : v; }
    unit(id, d = "") { const s = this.st(id); return (s && s.attributes.unit_of_measurement) || d; }
    nm(def) { const s = this.st(this._c.entity); return this._c.name || (s && s.attributes.friendly_name) || def; }
    call(d, s, data) { return this._h.callService(d, s, data); }
    more(id) { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true })); }
    set(sel, txt) { const e = this.$(sel); if (e && e.textContent !== String(txt)) e.textContent = txt; }
    cls(sel, name, on) { const e = this.$(sel); if (e) e.classList.toggle(name, !!on); }
    dot(kind) { const d = this.$(".dot"); if (d) d.className = "dot" + (kind ? " " + kind : ""); }
    head(extra = "") {
      return `<div class="hd"><div style="flex:1;min-width:0"><div class="tt"></div><div class="sub" hidden></div></div>
              <div class="stt"><span class="dot"></span><span class="sv"></span>${extra}</div></div>`;
    }
    toggleOf() { return this._c.switch || this._c.entity; }
    togglePower() {
      const id = this.toggleOf(); if (!id) return;
      this.call("homeassistant", OFFS.includes(this.val(id)) ? "turn_on" : "turn_off", { entity_id: id });
    }
  }

  const def = (tag, cls, name, desc) => {
    if (!customElements.get(tag)) customElements.define(tag, cls);
    window.customCards = window.customCards || [];
    if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description: desc + " (local)" });
  };

  /* ---------------- Fridge ---------------- */
  class Fridge extends Base {
    css() { return `
      .door{transform-box:fill-box;transform-origin:left center;transition:transform .5s ease}
      .open .door{transform:scaleX(.16)}
      .inner{opacity:0;transition:opacity .4s}.open .inner{opacity:1}
      .frost{animation:pulse 3s ease-in-out infinite}`; }
    html() { return `${this.head(`<span class="chip good tchip"><ha-icon icon="mdi:thermometer"></ha-icon><span class="cv"></span></span>`)}
      <div class="body"><div class="art" data-more="door"><svg viewBox="0 0 80 130">
        <defs><linearGradient id="fg" x1="0" x2="1"><stop offset="0" stop-color="#f5f7fa"/><stop offset=".55" stop-color="#dde3ea"/><stop offset="1" stop-color="#b4bdc9"/></linearGradient></defs>
        <ellipse cx="40" cy="126" rx="30" ry="3" fill="rgba(0,0,0,.35)"/>
        <rect x="10" y="4" width="60" height="120" rx="6" fill="url(#fg)" stroke="#97a2b0"/>
        <g class="inner"><rect x="11" y="5" width="58" height="72" rx="5" fill="#fff4d6"/>
          <rect x="14" y="28" width="52" height="2" fill="#e6d7b0"/><rect x="14" y="50" width="52" height="2" fill="#e6d7b0"/>
          <circle cx="26" cy="22" r="5" fill="#ff8a7a"/><rect x="40" y="38" width="9" height="12" rx="2" fill="#7fd1ff"/><circle cx="56" cy="44" r="5" fill="#9be38a"/></g>
        <g class="door"><rect x="10" y="4" width="60" height="74" rx="6" fill="url(#fg)" stroke="#97a2b0"/>
          <rect x="60" y="18" width="3.5" height="44" rx="1.7" fill="#a7b0bc"/>
          <rect x="17" y="16" width="27" height="11" rx="2" fill="#0d1b2a"/>
          <text class="lcd frost" x="30.5" y="24.5" font-size="7.5" font-weight="700" fill="#5ad1ff" text-anchor="middle" font-family="monospace"></text></g>
        <line x1="10" y1="79" x2="70" y2="79" stroke="#97a2b0"/>
        <rect x="60" y="86" width="3.5" height="30" rx="1.7" fill="#a7b0bc"/>
      </svg></div>
      <div class="tiles"><div class="tile" data-more="temperature"><div class="tv t1"></div><div class="tl"><ha-icon icon="mdi:thermometer"></ha-icon>Fridge</div></div>
        <div class="tile" data-more="freezer_temperature"><div class="tv t2"></div><div class="tl"><ha-icon icon="mdi:snowflake"></ha-icon>Freezer</div></div></div></div>`; }
    update() {
      const c = this._c, u = this.unit(c.temperature, "°" + (c.temperature_unit || "F"));
      const t = this.num(c.temperature), f = this.num(c.freezer_temperature);
      const open = this.val(c.door) === "on";
      this.set(".tt", c.name || "Fridge");
      this.set(".sv", open ? "Door open" : "Standby");
      this.dot(open ? "bad" : "");
      this.cls("svg", "open", open);
      this.set(".lcd", t == null ? "--" : `${fmtNum(t)}°`);
      this.set(".t1", t == null ? "—" : `${fmtNum(t)} ${u}`);
      this.set(".t2", f == null ? "—" : `${fmtNum(f)} ${this.unit(c.freezer_temperature, u)}`);
      this.set(".cv", t == null ? "—" : `${fmtNum(t)} ${u}`);
      const hot = t != null && c.max_temperature != null && t > c.max_temperature;
      const ch = this.$(".tchip"); ch.className = "chip tchip " + (t == null ? "dim" : hot ? "warn" : "good");
    }
  }

  /* ---------------- Washer ---------------- */
  class Washer extends Base {
    css() { return `
      .drum{transform-box:view-box;transform-origin:50px 70px}
      .run .drum{animation:spin 1.4s linear infinite}
      .run .wb{animation:shake .22s linear infinite}
      .water{opacity:0;transition:opacity .6s}.run .water{opacity:.85}
      .wave{animation:wave 2s linear infinite}
      @keyframes shake{0%,100%{transform:translate(0,0)}25%{transform:translate(.6px,-.4px)}75%{transform:translate(-.6px,.4px)}}
      @keyframes wave{to{transform:translateX(-20px)}}`; }
    html() { return `${this.head()}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 100 124">
        <defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e0e8"/></linearGradient>
          <clipPath id="glass"><circle cx="50" cy="70" r="25"/></clipPath></defs>
        <ellipse cx="50" cy="120" rx="40" ry="3" fill="rgba(0,0,0,.35)"/>
        <g class="wb"><rect x="6" y="4" width="88" height="112" rx="8" fill="url(#wg)" stroke="#a2acb9"/>
          <line x1="6" y1="25" x2="94" y2="25" stroke="#c3cad4"/>
          <rect x="12" y="12" width="15" height="3.5" rx="1.7" fill="#c3cad4"/>
          <rect x="38" y="9" width="27" height="11" rx="2" fill="#0d1b2a"/>
          <text class="lcd" x="51.5" y="17.6" font-size="7" font-weight="700" fill="#5ad1ff" text-anchor="middle" font-family="monospace"></text>
          <circle cx="81" cy="14.5" r="5.5" fill="#d3d9e1" stroke="#9aa4b2"/><line x1="81" y1="14.5" x2="84" y2="11.5" stroke="#6b7684" stroke-width="1.2"/>
          <circle cx="50" cy="70" r="33" fill="#d5dbe3" stroke="#9aa4b2" stroke-width="2"/>
          <circle cx="50" cy="70" r="25" fill="#1b2a3a"/>
          <g clip-path="url(#glass)">
            <g class="water"><path class="wave" d="M10 78 q5 -3 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V100 H10Z" fill="#4da3ff"/></g>
            <g class="drum"><circle cx="50" cy="70" r="24" fill="none" stroke="#3a4b5e" stroke-dasharray="2 3"/>
              <circle cx="42" cy="62" r="7" fill="#ff6b6b"/><circle cx="58" cy="64" r="6" fill="#ffd166"/>
              <circle cx="46" cy="79" r="6.5" fill="#4dabf7"/><circle cx="59" cy="78" r="5" fill="#69db7c"/></g>
            <path d="M33 58 A22 22 0 0 1 56 47" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/></g>
          <rect x="16" y="108" width="68" height="3" rx="1.5" fill="#c3cad4"/></g>
      </svg></div>
      <div class="tiles"><div class="tile" data-more="remaining"><div class="tv rem"></div><div class="tl"><ha-icon icon="mdi:timer-sand"></ha-icon>Remaining</div></div></div></div>`; }
    update() {
      const c = this._c, raw = String(this.val(c.entity) ?? "unavailable"), s = raw.toLowerCase();
      const prog = this.val(c.program);
      let rem = this.num(c.remaining);
      if (rem != null && this.unit(c.remaining, "min") === "s") rem = rem / 60;
      if (rem != null && this.unit(c.remaining, "min") === "h") rem = rem * 60;
      const running = !["idle", "off", "stop", "standby", "unavailable", "unknown", "end", "done", "finished", "complete", "completed", "none", ""].includes(s);
      const label = !running ? (["end", "done", "finished", "complete", "completed"].includes(s) ? "Done" : s === "unavailable" ? "Unavailable" : cap(raw))
        : /dry/i.test(raw + " " + (prog || "")) && !/wash/i.test(raw) ? "Drying" : s === "pause" || s === "paused" ? "Paused" : "Washing";
      this.set(".tt", c.name || "Washer");
      this.set(".sv", running && prog && !OFFS.includes(String(prog).toLowerCase()) ? `${label} · ${prog}` : label);
      this.dot(running ? "on" : label === "Done" ? "ok" : "");
      this.cls("svg", "run", running && label !== "Paused");
      const sub = this.$(".sub");
      if (running && rem > 0) { sub.hidden = false; this.set(".sub", `Ends at ${clock(new Date(Date.now() + rem * 60000))}`); } else sub.hidden = true;
      this.set(".lcd", running && rem != null ? `${Math.floor(rem / 60)}:${String(Math.round(rem % 60)).padStart(2, "0")}` : "--:--");
      this.set(".rem", running && rem != null ? fmtMin(rem) : "—");
    }
  }

  /* ---------------- TV ---------------- */
  class TV extends Base {
    css() { return `
      .scr{opacity:0;transition:opacity .6s}.on .scr{opacity:1}
      .sel{animation:sel 6s steps(1) infinite}
      .sun{animation:pulse 4s ease-in-out infinite}
      @keyframes sel{0%{transform:translateX(0)}20%{transform:translateX(19px)}40%{transform:translateX(38px)}60%{transform:translateX(57px)}80%{transform:translateX(76px)}}`; }
    html() { return `${this.head()}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 140 104">
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2366"/><stop offset=".7" stop-color="#8a3f86"/><stop offset="1" stop-color="#d9637a"/></linearGradient></defs>
        <rect x="4" y="6" width="132" height="78" rx="4" fill="#15181d" stroke="#3b414b"/>
        <rect x="8" y="10" width="124" height="70" fill="#05070a"/>
        <path d="M8 10 L60 10 L8 60Z" fill="#fff" opacity=".04"/>
        <g class="scr"><rect x="8" y="10" width="124" height="70" fill="url(#sky)"/>
          <circle class="sun" cx="104" cy="26" r="8" fill="#ffb067"/>
          <path d="M8 58 L34 38 L52 52 L74 34 L100 54 L132 40 V80 H8Z" fill="#3a2b5c" opacity=".9"/>
          <rect x="14" y="16" width="34" height="4" rx="1" fill="#fff" opacity=".9"/><rect x="14" y="23" width="22" height="3" rx="1" fill="#fff" opacity=".6"/>
          <g transform="translate(14 60)"><rect width="16" height="10" rx="1.5" fill="#e45c7a"/><rect x="19" width="16" height="10" rx="1.5" fill="#3fb6a8"/>
            <rect x="38" width="16" height="10" rx="1.5" fill="#f2b33d"/><rect x="57" width="16" height="10" rx="1.5" fill="#5b8def"/><rect x="76" width="16" height="10" rx="1.5" fill="#9b6bd8"/>
            <rect class="sel" x="-1" y="-1" width="18" height="12" rx="2" fill="none" stroke="#fff" stroke-width="1.2"/></g></g>
        <path d="M60 84 L56 96 H84 L80 84Z" fill="#2a2f37"/><rect x="44" y="96" width="52" height="4" rx="2" fill="#3b414b"/>
      </svg></div>
      <div class="tiles"><div class="tile" data-more="entity"><div class="tv use">—</div><div class="tl"><ha-icon icon="mdi:timer-outline"></ha-icon>Usage today</div></div></div></div>`; }
    update() {
      const c = this._c, s = this.val(c.entity) ?? "unavailable", on = !OFFS.includes(s);
      const src = this.st(c.entity)?.attributes?.source;
      this.set(".tt", this.nm("TV"));
      this.set(".sv", on ? (src ? `On · ${src}` : "On") : cap(s));
      this.dot(on ? "on" : "");
      this.cls("svg", "on", on);
      const now = Date.now();
      if (!this._lastFetch || now - this._lastFetch > 300000 || this._lastState !== s) { this._lastFetch = now; this._lastState = s; this._usage(); }
    }
    async _usage() {
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const r = await this._h.callApi("GET", `history/period/${start.toISOString()}?filter_entity_id=${this._c.entity}&minimal_response&no_attributes`);
        const rows = (r && r[0]) || []; let ms = 0;
        rows.forEach((row, i) => {
          const t0 = Math.max(start.getTime(), new Date(row.last_changed).getTime());
          const t1 = i + 1 < rows.length ? new Date(rows[i + 1].last_changed).getTime() : Date.now();
          if (!OFFS.includes(row.state)) ms += Math.max(0, t1 - t0);
        });
        const m = Math.round(ms / 60000);
        this.set(".use", m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);
      } catch (e) { /* history not available */ }
    }
  }

  /* ---------------- Ceiling fan ---------------- */
  class CeilingFan extends Base {
    css() { return `.bl{transform-box:view-box;transform-origin:0 0}.on .bl{animation:spin .45s linear infinite}`; }
    html() { return `${this.head(`<button class="pw"><ha-icon icon="mdi:power"></ha-icon></button>`)}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 120 92">
        <defs><linearGradient id="cm" x1="0" x2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#aeb7c3"/></linearGradient></defs>
        <rect x="47" y="0" width="26" height="4" rx="2" fill="#cfd5dd"/><rect x="58.5" y="3" width="3" height="20" fill="#c3cad4"/>
        <g transform="translate(60 30) scale(1 .26)"><g class="bl">
          <rect x="8" y="-6" width="50" height="12" rx="6" fill="#b37a43"/><rect x="8" y="-6" width="50" height="12" rx="6" fill="#a86f3a" transform="rotate(90)"/>
          <rect x="8" y="-6" width="50" height="12" rx="6" fill="#b37a43" transform="rotate(180)"/><rect x="8" y="-6" width="50" height="12" rx="6" fill="#a86f3a" transform="rotate(270)"/></g></g>
        <ellipse cx="60" cy="28" rx="13" ry="7" fill="url(#cm)" stroke="#9aa4b2" stroke-width=".6"/>
        <ellipse cx="60" cy="38" rx="7" ry="5" fill="#f6f7f9" stroke="#c9cfd8" stroke-width=".6"/>
        <ellipse cx="60" cy="86" rx="34" ry="3" fill="rgba(0,0,0,.25)"/>
      </svg></div><div class="tiles"></div></div>`; }
    wire() { this.$(".pw").addEventListener("click", () => this.togglePower()); }
    update() {
      const s = this.val(this.toggleOf()) ?? "unavailable", on = !OFFS.includes(s);
      this.set(".tt", this.nm("Ceiling fan"));
      this.set(".sv", cap(s)); this.dot(on ? "on" : "");
      this.cls("svg", "on", on); this.cls(".pw", "on", on);
    }
  }

  /* ---------------- Pedestal fan ---------------- */
  class Fan extends Base {
    css() { return `.bl{transform-box:view-box;transform-origin:50px 44px}.on .bl{animation:spin .35s linear infinite}
      .head{transform-box:view-box;transform-origin:50px 44px}.on .head{animation:sway 7s ease-in-out infinite alternate}
      @keyframes sway{from{transform:scaleX(1)}to{transform:scaleX(.8)}}`; }
    html() { return `${this.head(`<button class="pw"><ha-icon icon="mdi:power"></ha-icon></button>`)}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 100 132">
        <ellipse cx="50" cy="124" rx="24" ry="5" fill="#2a2f37"/><rect x="47.5" y="78" width="5" height="46" rx="2" fill="#aeb7c3"/>
        <g class="head"><circle cx="50" cy="44" r="36" fill="rgba(255,255,255,.07)" stroke="#c9d2de" stroke-width="2"/>
          <g class="bl"><path d="M50 44 C58 20 74 22 72 34 C70 42 58 44 50 44Z" fill="#c9d4e2" opacity=".9"/>
            <path d="M50 44 C58 20 74 22 72 34 C70 42 58 44 50 44Z" fill="#c9d4e2" opacity=".9" transform="rotate(120 50 44)"/>
            <path d="M50 44 C58 20 74 22 72 34 C70 42 58 44 50 44Z" fill="#c9d4e2" opacity=".9" transform="rotate(240 50 44)"/></g>
          <circle cx="50" cy="44" r="26" fill="none" stroke="#c9d2de" stroke-opacity=".5"/><circle cx="50" cy="44" r="15" fill="none" stroke="#c9d2de" stroke-opacity=".4"/>
          <g stroke="#c9d2de" stroke-opacity=".45">${[0, 30, 60, 90, 120, 150].map((a) => `<line x1="14" y1="44" x2="86" y2="44" transform="rotate(${a} 50 44)"/>`).join("")}</g>
          <circle cx="50" cy="44" r="6" fill="#e9edf2" stroke="#9aa4b2"/></g>
      </svg></div><div class="tiles"></div></div>`; }
    wire() { this.$(".pw").addEventListener("click", () => this.togglePower()); }
    update() {
      const s = this.val(this.toggleOf()) ?? "unavailable", on = !OFFS.includes(s);
      this.set(".tt", this.nm("Fan"));
      this.set(".sv", cap(s)); this.dot(on ? "on" : "");
      this.cls("svg", "on", on); this.cls(".pw", "on", on);
    }
  }

  /* ---------------- Mini-split AC ---------------- */
  class ACSplit extends Base {
    css() { return `.louver{transform-box:fill-box;transform-origin:top center;transition:transform .6s}
      .run .louver{transform:rotate(-14deg) translateY(2px)}
      .air{opacity:0;transition:opacity .6s}.run .air{opacity:1}
      .air path{stroke:var(--air,#6cc4ff);stroke-dasharray:6 6;animation:flow 1.2s linear infinite}
      @keyframes flow{to{stroke-dashoffset:-24}}`; }
    html() { return `${this.head()}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 160 96">
        <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset="1" stop-color="#c9d2de"/></linearGradient></defs>
        <rect x="6" y="8" width="148" height="40" rx="10" fill="url(#ag)" stroke="#9aa4b2"/>
        <rect x="14" y="40" width="132" height="5" rx="2.5" fill="#8f9bab"/>
        <rect class="louver" x="16" y="43" width="128" height="3.5" rx="1.7" fill="#e9edf2" stroke="#9aa4b2" stroke-width=".5"/>
        <rect x="114" y="16" width="30" height="11" rx="2" fill="#0d1b2a"/>
        <text class="lcd" x="129" y="24.5" font-size="7.5" font-weight="700" fill="#5ad1ff" text-anchor="middle" font-family="monospace">---</text>
        <circle class="led" cx="24" cy="21" r="2" fill="#8a9bb5"/>
        <g class="air" fill="none" stroke-width="2.2" stroke-linecap="round">
          <path d="M40 54 q-6 8 0 16 t0 16"/><path d="M80 54 q-6 8 0 16 t0 16"/><path d="M120 54 q-6 8 0 16 t0 16"/></g>
      </svg></div><div class="tiles"></div></div>`; }
    update() {
      const c = this._c, e = this.st(c.entity), s = e ? e.state : "unavailable";
      const action = e?.attributes?.hvac_action;
      const mode = action ? { cooling: "cool", heating: "heat", drying: "dry", fan: "fan_only", idle: "idle", off: "off" }[action] || action : s;
      const run = !["off", "idle", "unavailable", "unknown"].includes(mode);
      const AIR = { cool: "#6cc4ff", heat: "#ff9f5a", dry: "#5fd3c4", fan_only: "#cfd8e3", auto: "#a8d8ff", heat_cool: "#a8d8ff" };
      const LBL = { cool: "Cooling", heat: "Heating", dry: "Drying", fan_only: "Fan", auto: "Auto", heat_cool: "Auto", idle: "Idle", off: "Off" };
      this.set(".tt", this.nm("Air conditioner"));
      this.set(".sv", LBL[mode] || cap(mode));
      this.dot(run ? (mode === "heat" ? "on" : "cool") : "");
      const svg = this.$("svg"); svg.classList.toggle("run", run); svg.style.setProperty("--air", AIR[mode] || "#6cc4ff");
      this.$(".led").setAttribute("fill", run ? AIR[mode] || "#6cc4ff" : s === "off" ? "#ff6a5a" : "#8a9bb5");
      const tgt = e?.attributes?.temperature;
      this.set(".lcd", tgt != null && s !== "off" && s !== "unavailable" ? `${fmtNum(tgt)}°` : "---");
      const tiles = [];
      const tSrc = c.temperature || c.entity;
      const cur = c.temperature ? this.num(c.temperature) : e?.attributes?.current_temperature;
      if (cur != null) tiles.push([`${fmtNum(cur, 1)} ${c.temperature ? this.unit(c.temperature, "°") : "°"}`, "mdi:thermometer", "Temperature", tSrc]);
      if (tgt != null && s !== "off" && s !== "unavailable") tiles.push([`${fmtNum(tgt)}°`, "mdi:target", "Target", c.entity]);
      const key = JSON.stringify(tiles);
      if (key !== this._tk) {
        this._tk = key;
        const box = this.$(".tiles");
        box.innerHTML = tiles.map(([v, i, l]) => `<div class="tile"><div class="tv">${esc(v)}</div><div class="tl"><ha-icon icon="${i}"></ha-icon>${l}</div></div>`).join("");
        [...box.children].forEach((el, n) => el.addEventListener("click", () => this.more(tiles[n][3])));
      }
    }
  }

  /* ---------------- Garage door ---------------- */
  class Garage extends Base {
    css() { return `.art{width:100%;min-height:0;background:none;cursor:pointer}
      .art svg{max-width:260px;margin:4px auto 0}
      .body{display:block}
      .door{transition:transform var(--tt,14s) linear}
      .kled{transition:fill .3s}
      .stt .chip{font-size:11px}`; }
    html() { return `<div class="hd"><div class="tt" style="flex:1"></div><span class="chip dim schip"><span class="sv"></span></span></div>
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 200 122">
        <defs><clipPath id="op"><rect x="34" y="24" width="132" height="86"/></clipPath></defs>
        <rect x="8" y="8" width="184" height="6" fill="#4a4f57"/>
        <rect x="12" y="14" width="176" height="96" fill="#e8dfd0"/>
        <rect x="32" y="22" width="136" height="88" fill="#9aa3ae"/>
        <rect x="34" y="24" width="132" height="86" fill="#1c232d"/>
        <g opacity=".75"><path d="M62 104 q2 -14 20 -16 l36 0 q18 2 22 16Z" fill="#2f3a48"/><rect x="70" y="92" width="60" height="8" rx="2" fill="#3a4757"/></g>
        <g clip-path="url(#op)"><g class="door">
          <rect x="34" y="24" width="132" height="86" fill="#f1f3f6"/>
          ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="34" x2="166" y1="${35 + i * 10.6}" y2="${35 + i * 10.6}" stroke="#c8ced6"/>`).join("")}
          ${[0, 1, 2, 3, 4].map((i) => `<rect x="${44 + i * 24}" y="28" width="18" height="5" rx="1" fill="#2a313c"/>`).join("")}
          <rect x="92" y="103" width="16" height="2" rx="1" fill="#9aa3ae"/></g></g>
        <rect x="174" y="52" width="9" height="15" rx="2" fill="#30353d"/><circle class="kled" cx="178.5" cy="62" r="1.8" fill="#ff5a4a"/>
        <rect x="4" y="110" width="192" height="6" fill="#3a3f47"/>
      </svg></div>
      <div class="btns" style="max-width:260px;margin:8px auto 0">
        <button class="btn bo"><ha-icon icon="mdi:garage-open-variant"></ha-icon>Open</button>
        <button class="btn bc"><ha-icon icon="mdi:garage-variant"></ha-icon>Close</button></div>
      <div class="info since"><div class="l"><ha-icon icon="mdi:history"></ha-icon>Last change</div><div class="v ago"></div></div></div>`; }
    wire() {
      this.$(".bo").addEventListener("click", () => this.call("cover", "open_cover", { entity_id: this._c.entity }));
      this.$(".bc").addEventListener("click", () => this.call("cover", "close_cover", { entity_id: this._c.entity }));
      this._tick = setInterval(() => this._h && this.update(), 30000);
    }
    disconnectedCallback() { clearInterval(this._tick); this._built = false; }
    update() {
      const c = this._c, e = this.st(c.entity), s = e ? e.state : "unavailable";
      const travel = Number(c.travel_time) || 14;
      this.set(".tt", this.nm("Garage door"));
      this.set(".sv", cap(s));
      this.$(".schip").className = "chip schip " + (s === "closed" ? "dim" : s === "unavailable" ? "dim" : "warn");
      const pos = e?.attributes?.current_position;
      let up = s === "open" || s === "opening" ? 0.88 : 0;
      if (pos != null && s !== "opening" && s !== "closing") up = (pos / 100) * 0.88;
      const door = this.$(".door");
      door.style.setProperty("--tt", (s === "opening" || s === "closing" ? travel : 0.8) + "s");
      door.style.transform = `translateY(${-up * 86}px)`;
      this.$(".kled").setAttribute("fill", s === "closed" ? "#ff5a4a" : s === "unavailable" ? "#6b7684" : "#4cd38a");
      const bo = this.$(".bo"), bc = this.$(".bc");
      bo.classList.toggle("act", s === "closed" || s === "closing"); bc.classList.toggle("act", s === "open" || s === "opening");
      bo.disabled = s === "open" || s === "opening" || s === "unavailable"; bc.disabled = s === "closed" || s === "closing" || s === "unavailable";
      const since = this.$(".since"); since.hidden = c.show_since === false || !e;
      if (e) this.set(".ago", ago(e.last_changed));
    }
  }

  /* ---------------- Robot mower ---------------- */
  class Mower extends Base {
    css() { return `.art{width:100%;min-height:0;background:rgba(255,255,255,.03)}
      .art svg{max-width:420px;margin:0 auto}
      .body{display:block}
      .bot{transition:transform 2.5s ease-in-out}
      .wh{transform-box:fill-box;transform-origin:center}
      .mow .bot{animation:patrol 10s ease-in-out infinite alternate}
      .mow .wh{animation:spin 1s linear infinite}
      .clip{opacity:0}.mow .clip{opacity:1;animation:clip .8s linear infinite}
      .bolt{opacity:0}.chg .bolt{opacity:1;animation:pulse 1.6s ease-in-out infinite}
      .zz{opacity:0}.zzz .zz{opacity:1;animation:float 3s ease-in-out infinite}
      .ret .bot{transform:translateX(30px)}.ret .wh{animation:spin 1s linear infinite}
      .err .led{animation:blink .8s steps(1) infinite}
      @keyframes patrol{from{transform:translateX(-6px)}to{transform:translateX(44px)}}
      @keyframes clip{from{transform:translate(0,0);opacity:1}to{transform:translate(-14px,-10px);opacity:0}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`; }
    html() { return `${this.head()}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 200 104">
        <rect x="0" y="78" width="200" height="26" fill="#3d8b39"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="${i * 40}" y="78" width="20" height="26" fill="#4a9c45"/>`).join("")}
        <path d="M0 79 ${Array.from({ length: 50 }, (_, i) => `l2 -3 l2 3`).join(" ")}" fill="none" stroke="#5db357" stroke-width="1.2"/>
        <g transform="translate(150 0)"><path d="M-14 80 L40 80 L34 74 L-8 74Z" fill="#2b2f36"/>
          <rect x="16" y="40" width="18" height="36" rx="4" fill="#30353d" stroke="#4a515c"/><circle cx="25" cy="48" r="2" fill="#4cd38a"/>
          <path class="bolt" d="M24 22 l-6 10 h5 l-3 9 l8 -12 h-5 l3 -7Z" fill="#ffd34d"/></g>
        <g class="bot">
          <g class="clip" fill="#7ad36f"><rect x="18" y="66" width="2" height="2"/><rect x="22" y="70" width="2" height="2"/><rect x="16" y="72" width="2" height="2"/></g>
          <path d="M22 72 Q24 52 52 50 L92 50 Q116 52 118 72 Z" fill="#4a5058" stroke="#2b2f36"/>
          <path d="M40 54 L100 54 Q108 56 110 62 L32 62 Q34 56 40 54Z" fill="#ff8a1f"/>
          <circle class="led" cx="98" cy="58" r="2" fill="#4cd38a"/>
          <g class="wh"><circle cx="40" cy="74" r="9" fill="#1d2126"/><path d="M40 66 V82 M32 74 H48" stroke="#4a515c" stroke-width="2"/></g>
          <g class="wh"><circle cx="102" cy="74" r="9" fill="#1d2126"/><path d="M102 66 V82 M94 74 H110" stroke="#4a515c" stroke-width="2"/></g>
          <text class="zz" x="112" y="40" font-size="12" font-weight="700" fill="#c3d2e8">z z</text></g>
      </svg></div>
      <div class="btns"><button class="btn b1"><ha-icon icon="mdi:play"></ha-icon>Start</button>
        <button class="btn b2"><ha-icon icon="mdi:pause"></ha-icon>Pause</button>
        <button class="btn b3"><ha-icon icon="mdi:home-import-outline"></ha-icon>Dock</button></div>
      <div class="stats"><div class="stat" data-more="entity_battery"><div class="v bat"></div><div class="l">Battery</div></div>
        <div class="stat" data-more="entity"><div class="v sta"></div><div class="l">Status</div></div>
        <div class="stat" data-more="entity_next_start"><div class="v nxt"></div><div class="l">Next start</div></div></div></div>`; }
    wire() {
      const e = () => ({ entity_id: this._c.entity });
      this.$(".b1").addEventListener("click", () => this.call("lawn_mower", "start_mowing", e()));
      this.$(".b2").addEventListener("click", () => this.call("lawn_mower", "pause", e()));
      this.$(".b3").addEventListener("click", () => this.call("lawn_mower", "dock", e()));
    }
    update() {
      const c = this._c, s = this.val(c.entity) ?? "unavailable";
      const bat = this.num(c.entity_battery) ?? this.st(c.entity)?.attributes?.battery_level;
      const docked = s === "docked", mowing = s === "mowing";
      this.set(".tt", this.nm("Robot mower"));
      this.set(".sv", cap(s));
      this.dot(mowing ? "on" : s === "error" ? "bad" : docked ? "ok" : "");
      const svg = this.$("svg");
      svg.classList.toggle("mow", mowing); svg.classList.toggle("ret", s === "returning");
      svg.classList.toggle("chg", docked && (bat == null || bat < 100));
      svg.classList.toggle("zzz", s === "paused" || (docked && bat >= 100));
      svg.classList.toggle("err", s === "error");
      this.$(".bot").style.transform = docked ? "translateX(62px)" : mowing ? "" : s === "returning" ? "translateX(40px)" : "translateX(10px)";
      this.$(".led").setAttribute("fill", s === "error" ? "#ff5a4a" : mowing ? "#4cd38a" : docked ? "#5ad1ff" : "#ffbf47");
      this.cls(".b1", "act", mowing); this.cls(".b2", "act", s === "paused"); this.cls(".b3", "act", docked || s === "returning");
      this.set(".bat", bat == null ? "—" : `${fmtNum(bat)} %`);
      this.set(".sta", cap(s));
      const n = this.val(c.entity_next_start);
      let nx = "—";
      if (n && !OFFS.includes(n)) {
        const d = new Date(n);
        if (!isNaN(d)) { const today = new Date().toDateString() === d.toDateString(); nx = (today ? "Today " : d.toLocaleDateString([], { weekday: "short" }) + " ") + clock(d); }
      }
      this.set(".nxt", nx);
    }
  }

  /* ---------------- Robot vacuum ---------------- */
  class Vacuum extends Base {
    css() { return `.art{width:100%;min-height:0;background:none}
      .art svg{max-width:420px;margin:0 auto}
      .body{display:block}
      .bot{transform-box:view-box}
      .cln .bot{animation:roam 14s ease-in-out infinite}
      .ring{stroke-dasharray:300 40;transition:stroke .4s}
      .cln .ring{animation:ring 2.4s linear infinite}
      .brush{transform-box:fill-box;transform-origin:center}.cln .brush{animation:spin .4s linear infinite}
      .lid{opacity:.25}.cln .lid{opacity:1;animation:blink 1s steps(1) infinite}
      .bolt{opacity:0}.chg .bolt{opacity:1;animation:pulse 1.6s ease-in-out infinite}.full .bolt{opacity:.35}
      .ret .ring{animation:blink 1.2s ease-in-out infinite}
      .err .ring{animation:blink .6s steps(1) infinite}
      @keyframes ring{to{stroke-dashoffset:-340}}
      @keyframes roam{0%,100%{transform:translate(0,0)}25%{transform:translate(-14px,3px)}50%{transform:translate(8px,6px)}75%{transform:translate(16px,1px)}}`; }
    html() { return `${this.head()}
      <div class="body"><div class="art" data-more="entity"><svg viewBox="0 0 220 140">
        <defs><linearGradient id="vs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9edf2"/><stop offset="1" stop-color="#9aa4b2"/></linearGradient></defs>
        <path class="bolt" d="M182 10 l-9 15 h7 l-5 14 l13 -18 h-8 l5 -11Z" fill="#c9a43a"/>
        <g class="bot"><ellipse cx="110" cy="116" rx="94" ry="14" fill="rgba(0,0,0,.28)"/>
          <g class="brush" transform="translate(0 0)"><g stroke="#cfd6df" stroke-width="1.5"><line x1="30" y1="112" x2="44" y2="104"/><line x1="30" y1="112" x2="22" y2="100"/><line x1="30" y1="112" x2="18" y2="118"/></g></g>
          <ellipse cx="110" cy="100" rx="88" ry="26" fill="#2b2f36"/>
          <ellipse cx="110" cy="92" rx="88" ry="26" fill="url(#vs)"/>
          <ellipse cx="110" cy="86" rx="84" ry="24" fill="#f4f6f9"/>
          <ellipse class="ring" cx="110" cy="86" rx="64" ry="17" fill="none" stroke="#8a9bb5" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="110" cy="66" rx="19" ry="6" fill="#3a3f47"/><rect x="91" y="60" width="38" height="6" fill="#2b2f36"/><ellipse cx="110" cy="60" rx="19" ry="6" fill="#383d45"/>
          <rect x="98" y="62" width="24" height="3" rx="1.5" fill="#0d1b2a"/><circle class="lid" cx="104" cy="63.5" r="1.4" fill="#5ad1ff"/>
          <circle cx="94" cy="96" r="3" fill="none" stroke="#b4bdc9"/><circle cx="126" cy="96" r="3" fill="none" stroke="#b4bdc9"/></g>
      </svg></div>
      <div class="btns"><button class="btn b1"><ha-icon icon="mdi:play"></ha-icon>Start</button>
        <button class="btn b2"><ha-icon icon="mdi:pause"></ha-icon>Pause</button>
        <button class="btn b3"><ha-icon icon="mdi:home"></ha-icon>Dock</button></div>
      <div class="stats"></div></div>`; }
    wire() {
      const e = () => ({ entity_id: this._c.entity });
      this.$(".b1").addEventListener("click", () => this.call("vacuum", "start", e()));
      this.$(".b2").addEventListener("click", () => this.call("vacuum", "pause", e()));
      this.$(".b3").addEventListener("click", () => this.call("vacuum", "return_to_base", e()));
    }
    update() {
      const c = this._c, e = this.st(c.entity), s = e ? e.state : "unavailable", a = e?.attributes || {};
      const bat = this.num(c.entity_battery) ?? a.battery_level ?? a.battery;
      const cln = s === "cleaning", dock = s === "docked";
      this.set(".tt", c.name || "Robot vacuum");
      const status = this.val(c.entity_status);
      this.set(".sv", cap(status && !OFFS.includes(status) ? status : s));
      this.dot(cln ? "on" : s === "error" ? "bad" : dock ? "ok" : "");
      const svg = this.$("svg");
      svg.classList.toggle("cln", cln); svg.classList.toggle("ret", s === "returning");
      svg.classList.toggle("err", s === "error");
      svg.classList.toggle("chg", dock && (bat == null || bat < 100)); svg.classList.toggle("full", dock && bat >= 100);
      this.$(".ring").setAttribute("stroke", s === "error" ? "#ff5a4a" : cln ? "#36c26b" : s === "returning" ? "#5ad1ff" : s === "paused" ? "#ffbf47" : dock ? "#8fd3a4" : "#8a9bb5");
      this.cls(".b1", "act", cln); this.cls(".b2", "act", s === "paused"); this.cls(".b3", "act", dock || s === "returning");
      const stats = [[bat == null ? "—" : `${fmtNum(bat)} %`, "Battery", c.entity_battery || c.entity],
        [cap(status && !OFFS.includes(status) ? status : s), "Status", c.entity_status || c.entity]];
      if (c.entity_area) stats.push([`${fmtNum(this.num(c.entity_area))} ${this.unit(c.entity_area, "m²")}`, "Area", c.entity_area]);
      if (c.entity_time) stats.push([fmtMin(this.num(c.entity_time)), "Time", c.entity_time]);
      const suction = a.suction_level || a.fan_speed;
      if (suction && !cln) stats.push([String(suction).toLowerCase(), "Suction", c.entity]);
      if (c.entity_filter) stats.push([`${fmtNum(this.num(c.entity_filter))} %`, "Filter", c.entity_filter]);
      if (c.entity_brush) stats.push([`${fmtNum(this.num(c.entity_brush))} %`, "Brush", c.entity_brush]);
      const box = this.$(".stats");
      if (box.children.length !== stats.length) {
        box.innerHTML = stats.map(() => `<div class="stat"><div class="v"></div><div class="l"></div></div>`).join("");
        [...box.children].forEach((el, n) => el.addEventListener("click", () => this.more(this._stats[n][2])));
      }
      this._stats = stats;
      stats.forEach(([v, l], n) => { const el = box.children[n]; if (el.firstChild.textContent !== v) el.firstChild.textContent = v; el.lastChild.textContent = l; });
    }
  }

  /* ---------------- Mini PC ---------------- */
  class MiniPC extends Base {
    css() { return `ha-card{padding:8px}
      .tt{font-size:13px}.stt .chip{font-size:10px;padding:1px 6px}
      .art{width:100%;min-height:0;height:48px;background:none;margin-top:4px}
      .art svg{height:44px;width:auto}
      .led{animation:blink var(--sp,2s) steps(1) infinite}.off .led{animation:none;fill:#ff5a4a}
      .bar{transition:height .8s,y .8s}
      .g{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}
      .m{background:rgba(255,255,255,.06);border-radius:8px;padding:3px 4px;text-align:center;cursor:pointer;min-width:0}
      .m .l{font-size:9px;color:var(--secondary-text-color);display:flex;align-items:center;justify-content:center;gap:2px;white-space:nowrap;overflow:hidden}
      .m .l ha-icon{--mdc-icon-size:10px}.m .v{font-size:12px;font-weight:700;white-space:nowrap}`; }
    html() { return `<div class="hd"><div class="tt"></div><span class="chip schip"><span class="sv"></span></span></div>
      <div class="art" data-more="entity"><svg viewBox="0 0 90 44">
        <path d="M10 14 L50 8 L80 14 L40 20Z" fill="#4a515c"/><path d="M10 14 L40 20 L40 36 L10 30Z" fill="#23272e"/><path d="M40 20 L80 14 L80 30 L40 36Z" fill="#30353d"/>
        <circle class="led" cx="16" cy="24" r="1.6" fill="#4cd38a"/>
        ${[0, 1, 2, 3].map((i) => `<line x1="${22 + i * 4}" y1="${24 + i * .8}" x2="${22 + i * 4}" y2="${29 + i * .8}" stroke="#5a6270"/>`).join("")}
        <rect x="84" y="6" width="4" height="30" rx="1" fill="rgba(255,255,255,.08)"/><rect class="bar" x="84" y="30" width="4" height="6" rx="1" fill="#5ad1ff"/>
      </svg></div><div class="g"></div>`; }
    update() {
      const c = this._c, s = this.val(c.entity) ?? "unavailable", on = s === "on" || s === "running" || s === "online";
      const cpu = this.num(c.entity_cpu);
      this.set(".tt", c.name || "Mini PC");
      const busy = cpu != null && cpu >= 50;
      this.set(".sv", !on ? (s === "unavailable" ? "Unavailable" : "Offline") : cpu == null ? "Online" : busy ? "Busy" : "Idle");
      this.$(".schip").className = "chip schip " + (!on ? "warn" : busy ? "dim" : "good");
      const svg = this.$("svg"); svg.classList.toggle("off", !on);
      svg.style.setProperty("--sp", cpu == null ? "2s" : Math.max(0.2, 2 - cpu / 50) + "s");
      const h = cpu == null ? 6 : Math.max(2, (cpu / 100) * 30); const b = this.$(".bar"); b.setAttribute("height", h); b.setAttribute("y", 36 - h);
      const items = [];
      const pct = (id, l, i) => id && items.push([`${fmtNum(this.num(id))} ${this.unit(id, "%")}`, l, i, id]);
      pct(c.entity_cpu, "CPU", "mdi:cpu-64-bit"); pct(c.entity_ram, "RAM", "mdi:memory"); pct(c.entity_disk, "Disk", "mdi:harddisk");
      if (c.entity_uptime) {
        const v = this.val(c.entity_uptime); let up = "—";
        const d = new Date(v);
        if (v && !isNaN(d) && /\d{4}-\d\d-\d\d/.test(v)) { const sec = (Date.now() - d) / 1000; up = `${Math.floor(sec / 86400)} d ${Math.floor((sec % 86400) / 3600)} h`; }
        else if (!isNaN(parseFloat(v))) { const sec = parseFloat(v); up = `${Math.floor(sec / 86400)} d ${Math.floor((sec % 86400) / 3600)} h`; }
        items.push([up, "Uptime", "mdi:timer-outline", c.entity_uptime]);
      }
      (c.extra_tiles || []).forEach((t) => items.push([`${this.val(t.entity) ?? "—"}${this.unit(t.entity) ? " " + this.unit(t.entity) : ""}`, t.name || t.entity, t.icon || "mdi:information-outline", t.entity]));
      const g = this.$(".g");
      if (g.children.length !== items.length) {
        g.innerHTML = items.map(([, l, i]) => `<div class="m"><div class="l"><ha-icon icon="${i}"></ha-icon>${esc(l)}</div><div class="v"></div></div>`).join("");
        [...g.children].forEach((el, n) => el.addEventListener("click", () => this.more(this._items[n][3])));
      }
      this._items = items;
      items.forEach(([v], n) => { const el = g.children[n].lastChild; if (el.textContent !== v) el.textContent = v; });
    }
    getGridOptions() { return { columns: 4, rows: "auto" }; }
  }

  /* ---------------- Server rack ---------------- */
  class Rack extends Base {
    css() { return `ha-card{padding:8px}.tt{font-size:14px}
      .art{width:100%;min-height:0;background:none;margin-top:6px}.art svg{height:110px;width:auto}
      .l1{animation:blink 1.1s steps(1) infinite}.l2{animation:blink .7s steps(1) infinite}.l3{animation:blink 1.7s steps(1) infinite}
      .off .l1,.off .l2,.off .l3{animation:none;fill:#7a2a2a}`; }
    html() {
      const rows = [0, 1, 2, 3, 4, 5].map((i) => {
        const y = 12 + i * 15, d = (i * 0.37).toFixed(2);
        return `<rect x="15" y="${y}" width="44" height="11" rx="1.5" fill="#2a3039" stroke="#3d4553" stroke-width=".5"/>
          ${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${18 + k * 4}" y="${y + 3}" width="2.5" height="5" fill="#1b2027"/>`).join("")}
          <circle class="l1" cx="47" cy="${y + 5.5}" r="1.3" fill="#4cd38a" style="animation-delay:${d}s"/>
          <circle class="l2" cx="51" cy="${y + 5.5}" r="1.3" fill="#5ad1ff" style="animation-delay:${(d * 1.7).toFixed(2)}s"/>
          <circle class="l3" cx="55" cy="${y + 5.5}" r="1.3" fill="#4cd38a" style="animation-delay:${(d * 0.6).toFixed(2)}s"/>`;
      }).join("");
      return `${this.head()}<div class="art" data-more="entity"><svg viewBox="0 0 74 112">
        <rect x="9" y="4" width="56" height="102" rx="3" fill="#161a20" stroke="#3a4150"/>${rows}
        <rect x="9" y="4" width="56" height="102" rx="3" fill="url(#gl)" opacity=".35"/>
        <defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        <rect x="14" y="106" width="6" height="4" fill="#2a2f37"/><rect x="54" y="106" width="6" height="4" fill="#2a2f37"/></svg></div>`;
    }
    update() {
      const c = this._c, s = this.val(c.entity) ?? "unavailable", on = s === "on" || s === "running" || s === "online";
      this.set(".tt", c.name || "Server");
      this.set(".sv", on ? "Online" : s === "unavailable" ? "Unavailable" : "Offline");
      this.dot(on ? "on" : "bad");
      this.cls("svg", "off", !on);
    }
    getGridOptions() { return { columns: 4, rows: "auto" }; }
  }

  /* ---------------- Garbage / recycling bin ---------------- */
  const BIN_COLORS = { green: ["#2fae4a", "#22843a"], yellow: ["#f2c230", "#c99a12"], blue: ["#2f7de1", "#2260b0"], grey: ["#8a94a3", "#6b7584"],
    gray: ["#8a94a3", "#6b7584"], brown: ["#8b5a2b", "#6b431f"], black: ["#3a3f47", "#2b2f36"], red: ["#d94b3d", "#ad3529"] };
  class Bin extends Base {
    css() { return `ha-card{display:grid;justify-items:center;gap:6px;padding:12px 12px 14px;transition:box-shadow .6s}
      ha-card.jour{box-shadow:0 0 0 2px #ffbf47,0 0 22px rgba(255,191,71,.45)}
      .hd{width:100%;align-items:center}
      .art{width:auto;min-height:0;background:none}
      .art svg{width:auto;display:block;overflow:visible}
      .lbl{font-weight:700;font-size:13px;text-align:center}
      .bin{transform-box:view-box;transform-origin:50px 120px}
      .jour .bin{animation:hop 1.1s ease-in-out infinite}
      .veille .bin{animation:binshake 1.8s ease-in-out infinite}
      .lid{transform-box:view-box;transform-origin:12px 26px;transition:transform .6s}
      .plein .lid{transform:rotate(-12deg)}
      .trash{opacity:0;transition:opacity .6s;transform-box:view-box;transform-origin:50px 30px}
      .plein .trash{opacity:1;animation:wobble 2.6s ease-in-out infinite}
      .stink,.fly{opacity:0}
      .plein .stink{animation:rise 2.8s ease-in infinite}
      .plein .fly{opacity:1}
      .f1{transform-box:view-box;transform-origin:50px 8px;animation:spin 3.2s linear infinite}
      .f2{transform-box:view-box;transform-origin:44px 12px;animation:spin 2.6s linear infinite reverse}
      .spark{opacity:0}.videe .spark{animation:twinkle 2.4s ease-in-out infinite}
      @keyframes hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-9px)}60%{transform:translateY(0)}70%{transform:translateY(-3px)}}
      @keyframes binshake{0%,60%,100%{transform:rotate(0)}66%{transform:rotate(-4deg)}74%{transform:rotate(4deg)}82%{transform:rotate(-3deg)}90%{transform:rotate(2deg)}}
      @keyframes wobble{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
      @keyframes rise{0%{opacity:0;transform:translateY(6px)}30%{opacity:.8}100%{opacity:0;transform:translateY(-14px)}}
      @keyframes twinkle{0%,100%{opacity:0;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}}`; }
    html() {
      const star = (x, y, d) => `<path class="spark" style="animation-delay:${d}s;transform-box:fill-box;transform-origin:center" d="M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z" fill="#fff6c2"/>`;
      return `<div class="hd"><div class="tt"></div><span class="chip dim bdg"></span></div>
      <div class="art" data-more="entity"><svg viewBox="-10 -14 120 146">
        <ellipse cx="50" cy="124" rx="36" ry="4" fill="rgba(0,0,0,.3)"/>
        <g class="stink" fill="none" stroke="#a6c46a" stroke-width="2" stroke-linecap="round">
          <path d="M34 8 q-4 -6 0 -12 t0 -12" style="animation-delay:0s"/><path d="M50 4 q-4 -6 0 -12 t0 -12"/><path d="M66 8 q-4 -6 0 -12 t0 -12"/></g>
        <g class="fly"><g class="f1"><circle cx="62" cy="8" r="1.6" fill="#1b1f24"/></g><g class="f2"><circle cx="34" cy="12" r="1.4" fill="#1b1f24"/></g></g>
        ${star(4, 30, 0)}${star(96, 40, 0.8)}${star(10, 86, 1.6)}${star(92, 92, 0.4)}
        <g class="bin">
          <g class="trash"></g>
          <path class="bbody" d="M16 32 L84 32 L78 112 L22 112Z"/>
          <path d="M22 46 Q22 42 26 42 L74 42 Q78 42 78 46 L76 56 L64 56 L64 50 L36 50 L36 56 L24 56Z" fill="rgba(0,0,0,.14)"/>
          <path d="M38 74 L62 74 L62 82 L70 82 L67 108 L33 108 L30 82 L38 82Z" fill="rgba(0,0,0,.12)"/>
          <rect x="38" y="80" width="24" height="2.6" rx="1.3" fill="#c9ced6"/>
          <path class="shade" d="M70 32 L84 32 L78 112 L66 112Z" opacity=".18" fill="#000"/>
          <text class="sym" x="50" y="68" font-size="15" text-anchor="middle" fill="rgba(255,255,255,.85)"></text>
          <rect class="rim" x="13" y="31" width="74" height="6" rx="2"/>
          <g class="lid"><rect class="lidc" x="10" y="23" width="80" height="9" rx="3"/><rect class="lidc2" x="20" y="19" width="60" height="6" rx="3"/></g>
          <rect x="20" y="110" width="60" height="4" rx="2" fill="#2b2f36"/>
          <circle cx="27" cy="116" r="8" fill="#22262c"/><circle cx="27" cy="116" r="3" fill="#5a6270"/>
          <circle cx="73" cy="116" r="8" fill="#22262c"/><circle cx="73" cy="116" r="3" fill="#5a6270"/></g>
      </svg></div><div class="lbl"></div>`;
    }
    wire() {
      const c = this._c, col = BIN_COLORS[c.bin] || [c.bin || "#2fae4a", c.bin_dark || "rgba(0,0,0,.25)"];
      const full = c.full_color !== false;
      const body = c.body_color || (full ? col[0] : "#5c6573");
      const lid = c.lid_color || (full ? col[1] : col[0]);
      this.$(".bbody").setAttribute("fill", body);
      this.$(".rim").setAttribute("fill", body); this.$(".rim").setAttribute("stroke", "rgba(0,0,0,.22)");
      this.$(".lidc").setAttribute("fill", lid); this.$(".lidc2").setAttribute("fill", lid);
      this.$(".lidc2").setAttribute("stroke", "rgba(0,0,0,.18)");
      const recy = /recyc|paper|papier|plastic|verre|glass/i.test(c.content || c.name || "");
      this.$(".sym").textContent = recy ? "♻" : "";
      this.$(".trash").innerHTML = recy
        ? `<rect x="24" y="16" width="16" height="12" rx="1" fill="#d8c7a0" transform="rotate(-12 32 22)"/><rect x="44" y="12" width="7" height="18" rx="3" fill="#6cc4ff"/>
           <rect x="56" y="18" width="18" height="10" rx="1" fill="#f2f2f2" transform="rotate(10 64 23)"/>`
        : `<ellipse cx="34" cy="24" rx="12" ry="9" fill="#1f2a24"/><ellipse cx="52" cy="20" rx="13" ry="11" fill="#28352d"/><ellipse cx="68" cy="25" rx="11" ry="8" fill="#1f2a24"/>
           <path d="M50 10 l2 -5 l2 5" stroke="#1f2a24" stroke-width="2" fill="none"/>`;
      this.$(".art svg").style.height = Math.round(245 * (Number(c.scale) || 0.47)) + "px";
      this._tick = setInterval(() => this._h && this.update(), 600000);
    }
    disconnectedCallback() { clearInterval(this._tick); this._built = false; }
    update() {
      const c = this._c, raw = this.val(c.entity), now = new Date();
      const interval = Number(c.interval) || 7, hour = c.hour == null ? 12 : Number(c.hour);
      this.set(".tt", c.name || "Bin");
      const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(raw || "");
      const card = this.$("ha-card"), bdg = this.$(".bdg");
      if (!m) { this.set(".bdg", "—"); this.set(".lbl", "No pickup date"); card.className = ""; return; }
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((d - today) / 86400000);
      const jour = days === 0 && now.getHours() < hour;
      const videe = (days === 0 && !jour) || (days - interval >= -1 && days - interval <= 0 && days > 1);
      const veille = days === 1;
      const fill = videe ? 0 : Math.max(0, Math.min(1, (interval - days) / interval));
      const plein = !videe && fill >= 0.7;
      card.className = [jour && "jour", veille && "veille", plein && "plein", videe && "videe"].filter(Boolean).join(" ");
      this.set(".bdg", days < 0 ? "Late" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} d`);
      bdg.className = "chip bdg " + (days <= 1 ? "warn" : "dim");
      const wk = d.toLocaleDateString([], { weekday: "long" });
      this.set(".lbl", jour ? "Pickup today 🚛" : days === 0 ? "Picked up today ✅" : veille ? "Pickup tomorrow" : days < 7 && days > 0 ? `Pickup on ${wk}` : `Pickup on ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`);
    }
    getCardSize() { return 3; }
    getGridOptions() { return { columns: 6, rows: "auto" }; }
  }

  def("home-bin-card", Bin, "Home Garbage Bin", "Animated garbage / recycling bin with pickup countdown");
  def("home-fridge-card", Fridge, "Home Fridge", "Animated fridge");
  def("home-washer-card", Washer, "Home Washer", "Animated washer / dryer");
  def("home-tv-card", TV, "Home TV", "Animated TV");
  def("home-ceiling-fan-card", CeilingFan, "Home Ceiling Fan", "Animated ceiling fan");
  def("home-fan-card", Fan, "Home Fan", "Animated pedestal fan");
  def("home-ac-split-card", ACSplit, "Home Mini-split AC", "Animated mini-split AC");
  def("home-garage-door-card", Garage, "Home Garage Door", "Animated garage door");
  def("home-mower-card", Mower, "Home Robot Mower", "Animated robot mower");
  def("home-vacuum-card", Vacuum, "Home Robot Vacuum", "Animated robot vacuum");
  def("home-mini-pc-card", MiniPC, "Home Mini PC", "Animated mini PC");
  def("home-server-rack-card", Rack, "Home Server Rack", "Animated server rack");
  console.info(`%c HOME-APPLIANCE-CARDS %c ${VERSION} `, "background:#1d4277;color:#fff", "background:#e6ebf2;color:#10223f");
})();
