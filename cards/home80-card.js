/* home80-card: a Home Assistant dashboard styled as an 80s CRT computer monitor.
 * Green or amber phosphor (tap the knob on the bezel, or set color: amber).
 * Every H80_DEFAULTS key can be overridden in YAML; bezel: false hides the monitor case.
 * https://github.com/sbirchfield70/ha-3d-dashboards  (MIT) */
const H80_VERSION = "1.0.1";
const H80_DEFAULTS = {
  title: "HOME-OS",                 // shown in the status bar and boot screen
  color: "green",                   // "green" or "amber" (the knob choice is remembered per browser)
  bezel: true,                      // false = screen only, no beige monitor case
  weather: "weather.home",          // any weather entity (forecast via weather/subscribe_forecast)
  outside_temp: null,               // optional sensor; falls back to the weather entity's temperature
  sun: "sun.sun",
  indoor: [],                       // climate.* entities averaged into "INSIDE AVG"
  calendars: [],                    // calendar.* entities for the SCHEDULE box
  // Up to 4 rooms. The first four light up the four windows of the ASCII house.
  // items: light.* / switch.* / fan.* toggle, climate.* gets a thermostat panel,
  // action: "restart" + script: asks for a second tap, then runs the script (e.g. power-cycle a TV).
  rooms: [
    { name: "Kitchen", temp_entity: "climate.downstairs",
      items: [
        { entity: "light.kitchen_ceiling", name: "Main Lights" },
        { entity: "light.kitchen_island", name: "Island" },
        { entity: "light.kitchen_strip", name: "Strip" },
      ] },
    { name: "Dining Room", temp_entity: "climate.downstairs",
      items: [
        { entity: "light.dining_chandelier", name: "Chandelier" },
        { entity: "switch.china_cabinet", name: "Cabinet" },
      ] },
    { name: "Living Room", temp_entity: "climate.downstairs",
      items: [
        { entity: "switch.tv_plug", name: "TV", action: "restart", script: "script.tv_restart" },
        { entity: "fan.ceiling_fan", name: "Fan" },
        { entity: "climate.downstairs", name: "Thermostat" },
      ] },
    { name: "Bedroom", temp_entity: "sensor.bedroom_temperature",
      items: [
        { entity: "light.lamp_left", name: "Left Lamp" },
        { entity: "light.lamp_right", name: "Right Lamp" },
        { entity: "light.night_light", name: "Night Light" },
      ] },
  ],
};

const H80_PAL = {
  green: { p: "#3dff72", pd: "#1e9c45", pg: "rgba(61,255,114,.55)", bg: "#021408", bg2: "#063a16" },
  amber: { p: "#ffb83d", pd: "#a86c10", pg: "rgba(255,184,61,.5)", bg: "#170c01", bg2: "#3a2204" },
};

/* ---------- ASCII art ---------- */
const H80_WX = {
  sunny: ["    \\   /    ", "     .-.     ", "  ― (   ) ―  ", "     `-'     ", "    /   \\    "],
  clear_night: ["      _..    ", "    .' .'    ", "   :  :   *  ", "    '. '.    ", " *    ``     "],
  partly: ["   \\  /      ", " _ /\"\".-.    ", "   \\_(   ).  ", "   /(___(__) ", "             "],
  cloudy: ["             ", "     .--.    ", "  .-(    ).  ", " (___.__)__) ", "             "],
  fog: ["             ", " _ - _ - _ - ", "  _ - _ - _  ", " _ - _ - _ - ", "             "],
  rain: ["     .-.     ", "    (   ).   ", "   (___(__)  ", "", ""],
  snow: ["     .-.     ", "    (   ).   ", "   (___(__)  ", "", ""],
  storm: ["     .-.     ", "    (   ).   ", "   (___(__)  ", "    /_  /_   ", "     /   /   "],
  wind: ["             ", "  ~~~~~~~>   ", "    ~~~~~~>  ", "  ~~~~~~~>   ", "             "],
};
function h80Wx(cond, night, frame) {
  const c = cond || "";
  let k = "cloudy";
  if (c === "sunny") k = night ? "clear_night" : "sunny";
  else if (c === "clear-night") k = "clear_night";
  else if (c === "partlycloudy") k = night ? "cloudy" : "partly";
  else if (c === "fog") k = "fog";
  else if (["rainy", "pouring", "snowy-rainy"].includes(c)) k = "rain";
  else if (c === "snowy") k = "snow";
  else if (["lightning", "lightning-rainy", "hail"].includes(c)) k = "storm";
  else if (["windy", "windy-variant"].includes(c)) k = "wind";
  const a = H80_WX[k].slice();
  if (k === "rain") { const o = frame % 2; a[3] = o ? "    ' ' ' '  " : "   ' ' ' '   "; a[4] = o ? "   ' ' ' '   " : "    ' ' ' '  "; }
  if (k === "snow") { const o = frame % 2; a[3] = o ? "    *  *  *  " : "   *  *  *   "; a[4] = o ? "   *  *  *   " : "    *  *  *  "; }
  return a.join("\n");
}
function h80Cond(c) {
  return (c || "unknown").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " ").toUpperCase();
}
const H80_WIN = (on) => on ? `<span class="lit">[##]</span>` : "[  ]";
function h80House(lit, night, cold, frame) {
  const smoke = cold ? (frame % 2 ? ["           (  )", "          (    "] : ["          (  ) ", "           (   "]) : ["", ""];
  const sky = night ? ["  *        .          *     .", "      .          *          "] : ["", ""];
  const L = [
    sky[0], sky[1], smoke[0], smoke[1],
    "       ___|=|_____________",
    "      /                   \\",
    "     /_____________________\\",
    `      |  ${H80_WIN(lit[0])}  ____  ${H80_WIN(lit[2])} |`,
    `      |  ${H80_WIN(lit[1])} |    | ${H80_WIN(lit[3])} |`,
    "      |       |   o|      |",
    "  ____|_______|____|______|____",
  ];
  return L.join("\n");
}
const h80Bar = (frac, n = 20) => { const f = Math.max(0, Math.min(n, Math.round((frac || 0) * n))); return "█".repeat(f) + "░".repeat(n - f); };

const H80_CSS = `
:host{display:block;--p:#3dff72;--pd:#1e9c45;--pg:rgba(61,255,114,.55);--bg:#021408;--bg2:#063a16}
*{box-sizing:border-box}
.outer{width:100%;overflow:hidden;background:#141210}
.stage{width:1280px;height:720px;transform-origin:0 0;position:relative;font-family:'VT323',monospace;color:var(--p)}
.case{position:absolute;inset:0;border-radius:26px;background:linear-gradient(180deg,#e4dcc6,#cfc5aa 70%,#bdb295);box-shadow:inset 0 3px 0 #f4eedd,inset 0 -6px 0 #a99e80}
.nobezel .case{display:none}
.screen{position:absolute;left:24px;top:20px;width:1232px;height:634px;border-radius:34px/30px;overflow:hidden;
  background:radial-gradient(ellipse at 50% 45%,var(--bg2) 0%,var(--bg) 70%,#000 100%);
  box-shadow:0 0 0 10px #2a2824,0 0 0 13px #8d8469,inset 0 0 60px rgba(0,0,0,.85)}
.nobezel .screen{left:0;top:0;width:1280px;height:720px;border-radius:0;box-shadow:inset 0 0 70px rgba(0,0,0,.85)}
.scan{position:absolute;inset:0;pointer-events:none;z-index:20;background:repeating-linear-gradient(to bottom,rgba(0,0,0,.28) 0 1px,transparent 1px 3px)}
.roll{position:absolute;left:0;right:0;height:120px;top:-130px;pointer-events:none;z-index:21;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.035),transparent);animation:roll 9s linear infinite}
@keyframes roll{to{top:760px}}
.glass{position:absolute;inset:0;pointer-events:none;z-index:22;background:radial-gradient(ellipse at 30% 15%,rgba(255,255,255,.07),transparent 45%),radial-gradient(ellipse at 50% 50%,transparent 60%,rgba(0,0,0,.55) 100%)}
.crt{position:absolute;inset:0;padding:14px 22px;text-shadow:0 0 3px var(--p),0 0 10px var(--pg);animation:flick 4s steps(1) infinite}
@keyframes flick{0%,100%{opacity:1}47%{opacity:.96}48%{opacity:1}83%{opacity:.975}}
.top{display:flex;justify-content:space-between;align-items:center;background:var(--p);color:var(--bg);text-shadow:none;font-size:28px;padding:0 12px;height:34px;box-shadow:0 0 12px var(--pg)}
.top span{white-space:pre}
.cols{display:grid;grid-template-columns:385px 390px minmax(0,1fr);gap:20px;margin-top:22px;height:500px}
.box{border:2px solid var(--p);box-shadow:0 0 6px var(--pg),inset 0 0 6px var(--pg);position:relative;padding:16px 14px 8px}
.tt{position:absolute;top:-15px;left:14px;background:var(--bg);padding:0 8px;font-size:24px;line-height:26px}
pre{margin:0;font-family:inherit;line-height:1;white-space:pre}
.clock{font-size:118px;line-height:92px;letter-spacing:2px}
.clock small{font-size:44px;margin-left:8px}
.date{font-size:30px;margin:6px 0 4px}
.house{font-size:27px;color:var(--p);margin-top:6px}
.house .lit{text-shadow:0 0 6px var(--p),0 0 18px var(--p),0 0 28px var(--pg)}
.left{display:flex;flex-direction:column}
.left .box{flex:1;margin-top:18px}
.wxart{font-size:30px;float:left;margin-right:10px}
.out{font-size:84px;line-height:76px}
.cond{font-size:26px}
.wxtop{overflow:hidden;margin-bottom:6px}
.meter{font-size:26px;line-height:26px;margin-top:8px}
.meter .bar{letter-spacing:-1px;color:var(--p)}
.meter .k{display:flex;justify-content:space-between}
.dim{color:var(--pd);text-shadow:0 0 4px var(--pg)}
.ins{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;font-size:26px}
.ins b{font-size:52px;font-weight:normal}
.right{display:flex;flex-direction:column;gap:22px;min-width:0}
.room{display:flex;justify-content:space-between;font-size:30px;line-height:42px;padding:0 8px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.room .n:before{content:"  ";white-space:pre}
.room.lit .n:before{content:"■ "}
.room:active,.room.sel{background:var(--p);color:var(--bg);text-shadow:none}
.fc .row,.ev{display:flex;justify-content:space-between;font-size:26px;line-height:30px}
.ev{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prompt{position:absolute;left:22px;right:22px;bottom:12px;font-size:30px;height:34px;white-space:pre;overflow:hidden}
.cur{display:inline-block;width:14px;height:26px;background:var(--p);vertical-align:-3px;box-shadow:0 0 8px var(--p);animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.badge{position:absolute;left:44px;bottom:16px;font:700 17px/1 Arial,sans-serif;letter-spacing:3px;color:#6f6650;text-shadow:0 1px 0 #f2ecda}
.badge i{font-style:normal;color:#b0402a}
.vents{position:absolute;left:330px;right:330px;bottom:20px;height:14px;background:repeating-linear-gradient(90deg,#a99f84 0 6px,transparent 6px 14px);border-radius:3px;opacity:.7}
.led{position:absolute;right:150px;bottom:22px;width:12px;height:12px;border-radius:50%;background:#56ff7a;box-shadow:0 0 10px #56ff7a}
.amber .led{background:#ffb83d;box-shadow:0 0 10px #ffb83d}
.knob{position:absolute;right:66px;bottom:9px;width:44px;height:44px;border-radius:50%;cursor:pointer;background:radial-gradient(circle at 40% 35%,#59544a,#25231f);box-shadow:0 2px 3px rgba(0,0,0,.5),inset 0 0 0 3px #3a3732;transition:transform .3s}
.knob:after{content:"";position:absolute;left:20px;top:4px;width:4px;height:14px;background:#d8d0b8;border-radius:2px}
.amber .knob{transform:rotate(70deg)}
.nobezel .badge,.nobezel .vents,.nobezel .led,.nobezel .knob{display:none}
/* popup */
.pop{position:absolute;inset:0;z-index:15;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center}
.pop.open{display:flex}
.win{width:860px;background:var(--bg);border:6px double var(--p);box-shadow:0 0 18px var(--pg);padding:0 0 14px}
.wt{display:flex;justify-content:space-between;background:var(--p);color:var(--bg);text-shadow:none;font-size:32px;padding:2px 14px}
.wt .x{cursor:pointer;padding:0 6px}
.it{display:flex;align-items:center;justify-content:space-between;font-size:34px;line-height:50px;padding:4px 18px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.it:active{background:var(--bg2)}
.it .s{min-width:250px;text-align:right}
.it.warn .s{animation:blink .5s steps(1) infinite}
.dimr{display:flex;align-items:center;gap:4px;padding:0 18px 6px 74px;font-size:40px;line-height:40px}
.dimr span{cursor:pointer;padding:0 1px}
.th{padding:6px 18px;font-size:32px;line-height:44px}
.th .r{display:flex;justify-content:space-between;align-items:center}
.btn{display:inline-block;border:2px solid var(--p);padding:0 14px;margin-left:8px;cursor:pointer;line-height:40px;min-width:52px;text-align:center}
.btn.sel,.btn:active{background:var(--p);color:var(--bg);text-shadow:none}
/* boot */
.boot{position:absolute;inset:0;z-index:14;background:var(--bg);padding:30px 40px;font-size:30px;line-height:34px;white-space:pre;transition:opacity .5s}
.boot.done{opacity:0;pointer-events:none}
`;

class Home80Card extends HTMLElement {
  setConfig(config) {
    this._cfg = Object.assign({}, H80_DEFAULTS, config || {});
    this._sig = {};
  }
  static getStubConfig() { return {}; }
  getCardSize() { return 12; }

  connectedCallback() {
    if (!document.getElementById("h80-font")) {
      const l = document.createElement("link");
      l.id = "h80-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=VT323&display=swap";
      document.head.appendChild(l);
    }
    this._tick = setInterval(() => this._clock(), 1000);
    this._evTimer = setInterval(() => this._loadEvents(), 15 * 60 * 1000);
    this._typeT = setInterval(() => this._type(), 55);
    this._ro = new ResizeObserver(() => this._fit());
    this._ro.observe(this);
    window.addEventListener("resize", (this._wr = () => this._fit()));
    if (this._hass && !this._unsubFc) this._subForecast();
  }
  disconnectedCallback() {
    clearInterval(this._tick); clearInterval(this._evTimer); clearInterval(this._typeT);
    this._ro && this._ro.disconnect();
    window.removeEventListener("resize", this._wr);
    if (this._unsubFc) { this._unsubFc.then((u) => u && u()).catch(() => {}); this._unsubFc = null; }
  }

  set hass(h) {
    this._hass = h;
    if (!this._built) this._build();
    if (!this._unsubFc && this.isConnected) this._subForecast();
    if (!this._evLoaded) { this._evLoaded = true; this._loadEvents(); }
    this._update();
  }

  _st(e) { return this._hass && this._hass.states[e]; }
  _num(e, attr) { const s = this._st(e); if (!s) return NaN; return parseFloat(attr ? s.attributes[attr] : s.state); }

  _color() {
    let c = this._cfg.color;
    try { c = localStorage.getItem("h80-color") || c; } catch (e) { /* ignore */ }
    return H80_PAL[c] ? c : "green";
  }
  _applyColor(c) {
    const P = H80_PAL[c];
    Object.entries({ p: P.p, pd: P.pd, pg: P.pg, bg: P.bg, bg2: P.bg2 }).forEach(([k, v]) => this.style.setProperty("--" + k, v));
    this._$(".stage").classList.toggle("amber", c === "amber");
  }

  _build() {
    this._built = true;
    const r = this.attachShadow({ mode: "open" });
    const rooms = this._cfg.rooms.map((rm, i) => `<div class="room" data-room="${i}"><span class="n">${i + 1} ${rm.name.toUpperCase()}</span><span class="v"></span></div>`).join("");
    r.innerHTML = `<style>${H80_CSS}</style><div class="outer"><div class="stage${this._cfg.bezel === false ? " nobezel" : ""}">
      <div class="case"></div>
      <div class="screen">
        <div class="crt">
          <div class="top"><span class="tl"></span><span class="tr"></span></div>
          <div class="cols">
            <div class="left">
              <div class="clock"></div><div class="date"></div>
              <div class="box"><div class="tt">HOUSE.SYS</div><pre class="house"></pre></div>
            </div>
            <div class="box mid"><div class="tt">WEATHER</div>
              <div class="wxtop"><pre class="wxart"></pre><div class="out"></div><div class="cond"></div></div>
              <div class="meter"><div class="k"><span>HUMIDITY</span><span class="vh"></span></div><div class="bar bh"></div></div>
              <div class="meter"><div class="k"><span>PRESSURE</span><span class="vp"></span></div><div class="bar bp"></div></div>
              <div class="meter"><div class="k"><span>WIND</span><span class="vw"></span></div><div class="bar bw"></div></div>
              <div class="ins"><span>INSIDE AVG</span><b class="vin"></b></div>
            </div>
            <div class="right">
              <div class="box"><div class="tt">ROOMS - TOUCH TO SELECT</div>${rooms}</div>
              <div class="box fc"><div class="tt">FORECAST</div><div class="fcb"></div></div>
              <div class="box"><div class="tt">SCHEDULE</div><div class="evs"></div></div>
            </div>
          </div>
          <div class="prompt"></div>
        </div>
        <div class="pop"><div class="win"></div></div>
        <div class="boot"></div>
        <div class="scan"></div><div class="roll"></div><div class="glass"></div>
      </div>
      <div class="badge">HOMECOM <i>■</i> 64</div><div class="vents"></div><div class="led"></div><div class="knob" title="Green / amber"></div>
    </div></div>`;
    this._$ = (s) => r.querySelector(s);
    r.querySelectorAll(".room").forEach((el) => el.addEventListener("click", () => this._open(+el.dataset.room)));
    this._$(".pop").addEventListener("click", (e) => { if (e.target.classList.contains("pop")) this._close(); });
    this._$(".knob").addEventListener("click", () => {
      const c = this._color() === "green" ? "amber" : "green";
      try { localStorage.setItem("h80-color", c); } catch (e) { /* ignore */ }
      this._applyColor(c);
    });
    this._applyColor(this._color());
    this._frame = 0;
    this._clock();
    this._fit();
    this._boot();
    const m = (location.hash || "").match(/room=(\d)/); // preview aid: #room=N opens that room
    if (m) setTimeout(() => this._open(+m[1]), 2500);
  }

  _boot() {
    const b = this._$(".boot");
    if ((location.hash || "").includes("noboot")) { b.classList.add("done"); return; }
    const lines = [`${this._cfg.title} BIOS (C) 1984  HOMECOM SYSTEMS`, "", "MEMORY TEST ... 640K OK", "CHECKING SENSORS ......... OK",
      "LOADING HOUSE.SYS ........ OK", "CONNECTING HOME ASSISTANT  OK", "", "READY."];
    let i = 0;
    const step = () => {
      if (i < lines.length) { b.textContent += lines[i++] + "\n"; this._bootT = setTimeout(step, 170); }
      else this._bootT = setTimeout(() => b.classList.add("done"), 500);
    };
    step();
  }

  _fit() {
    if (!this._built) return;
    const stage = this._$(".stage"), outer = this._$(".outer");
    const w = this.clientWidth || this.getBoundingClientRect().width || 1280;
    const top = Math.max(0, this.getBoundingClientRect().top);
    const avail = Math.max(300, window.innerHeight - top - 4);
    const k = Math.min(w / 1280, avail / 720);
    stage.style.transform = `scale(${k})`;
    outer.style.height = 720 * k + "px";
    stage.style.marginLeft = Math.max(0, (w - 1280 * k) / 2) + "px";
    stage.style.marginRight = 1280 * k - 1280 + "px";
    stage.style.marginBottom = 720 * k - 720 + "px";
  }

  _clock() {
    if (!this._built) return;
    const d = new Date();
    let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    const t = `${h}:${m}<small>${ap}</small>`;
    if (this._lastT !== t) { this._lastT = t; this._$(".clock").innerHTML = t; }
    const ds = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    if (this._lastD !== ds) { this._lastD = ds; this._$(".date").textContent = ds; }
    const tl = ` ${this._cfg.title} v1.984   ■ ${this._lit || 0} LIGHT${this._lit === 1 ? "" : "S"} ON`;
    const tr = `${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })}  ${String(d.getHours()).padStart(2, "0")}:${m}:${String(d.getSeconds()).padStart(2, "0")} `;
    this._$(".tl").textContent = tl; this._$(".tr").textContent = tr;
    if (d.getSeconds() % 2 === 0) { this._frame++; this._sig.w = null; this._update(); }
  }

  _subForecast() {
    if (!this._hass || !this._hass.connection) return;
    try {
      this._unsubFc = this._hass.connection.subscribeMessage((msg) => { this._forecast = msg.forecast || []; this._sig.fc = null; this._update(); },
        { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: this._cfg.weather });
      this._unsubFc.catch(() => { this._unsubFc = null; });
    } catch (e) { this._unsubFc = null; }
  }

  async _loadEvents() {
    if (!this._hass) return;
    const start = new Date(), end = new Date(Date.now() + 10 * 864e5);
    let all = [];
    for (const c of this._cfg.calendars || []) {
      try {
        const ev = await this._hass.callApi("GET", `calendars/${c}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
        all = all.concat(ev.map((e) => ({ s: e.summary, t: new Date(e.start.dateTime || e.start.date + "T00:00:00"), allDay: !e.start.dateTime })));
      } catch (e) { /* ignore */ }
    }
    all.sort((a, b) => a.t - b.t);
    this._events = all.filter((e) => e.t > Date.now() - 3 * 3600e3).slice(0, 3);
    this._sig.ev = null; this._update();
  }

  _roomState(rm) {
    const toggles = rm.items.filter((it) => /^(light|switch|fan)\./.test(it.entity));
    const on = toggles.filter((it) => { const s = this._st(it.entity); return s && s.state === "on"; });
    const lit = on.some((it) => it.entity.startsWith("light."));
    const tmp = !rm.temp_entity ? NaN : rm.temp_entity.startsWith("climate.") ? this._num(rm.temp_entity, "current_temperature") : this._num(rm.temp_entity);
    return { n: on.length, lit, tmp };
  }

  _update() {
    if (!this._built || !this._hass) return;
    const C = this._cfg, W = this._st(C.weather), sun = this._st(C.sun);
    const night = sun ? sun.state === "below_horizon" : false;
    const a = W ? W.attributes : {};
    const outT = !isNaN(this._num(C.outside_temp)) ? this._num(C.outside_temp) : a.temperature;
    const cond = W ? W.state : "";
    const rs = C.rooms.map((rm) => this._roomState(rm));
    const lights = new Set();
    C.rooms.forEach((rm) => rm.items.forEach((it) => { const s = this._st(it.entity); if (it.entity.startsWith("light.") && s && s.state === "on") lights.add(it.entity); }));
    this._lit = lights.size;
    // weather + house (also re-drawn every 2 s for the rain/smoke frames)
    const cold = !isNaN(outT) && outT < 50;
    const sigW = [cond, night, cold, rs.map((x) => x.lit).join(), this._frame].join();
    if (this._sig.w !== sigW) {
      this._sig.w = sigW;
      this._$(".house").innerHTML = h80House(rs.map((x) => x.lit), night, cold, this._frame);
      this._$(".wxart").textContent = h80Wx(cond, night, this._frame);
    }
    const sigH = [Math.round(outT), cond].join();
    if (this._sig.h !== sigH) {
      this._sig.h = sigH;
      this._$(".out").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°F";
      this._$(".cond").textContent = h80Cond(cond);
    }
    const hum = a.humidity, pres = a.pressure, ws = a.wind_speed, wb = a.wind_bearing;
    const sigG = [hum, pres, ws, wb].join();
    if (this._sig.g !== sigG) {
      this._sig.g = sigG;
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      this._$(".vh").textContent = hum != null ? Math.round(hum) + "%" : "--";
      this._$(".bh").textContent = h80Bar((+hum || 0) / 100);
      const pu = a.pressure_unit || "inHg";
      const pv = +pres || 0, pf = pu === "inHg" ? (pv - 29) / 2 : (pv - 980) / 70;
      this._$(".vp").textContent = pres != null ? (+pres).toFixed(pu === "inHg" ? 2 : 0) + " " + pu.toUpperCase() : "--";
      this._$(".bp").textContent = h80Bar(pf);
      this._$(".vw").textContent = ws != null ? `${Math.round(ws)} MPH ${dirs[Math.round(((+wb || 0) % 360) / 45) % 8]}` : "--";
      this._$(".bw").textContent = h80Bar((+ws || 0) / 40);
    }
    const ins = (C.indoor || []).map((e) => this._num(e, "current_temperature")).filter((v) => !isNaN(v));
    const avg = ins.length ? ins.reduce((p, c) => p + c, 0) / ins.length : NaN;
    const avgTxt = isNaN(avg) ? "--" : (Math.round(avg * 2) / 2).toFixed(1).replace(".0", "") + "°F";
    if (this._sig.in !== avgTxt) { this._sig.in = avgTxt; this._$(".vin").textContent = avgTxt; }
    // rooms
    rs.forEach((x, i) => {
      const el = this._$(`.room[data-room="${i}"]`);
      const v = `${isNaN(x.tmp) ? "" : Math.round(x.tmp) + "° "} ${x.n ? x.n + " ON " : "OFF"}`;
      if (el._v !== v) { el._v = v; el.querySelector(".v").textContent = v; }
      el.classList.toggle("lit", x.lit);
    });
    // forecast
    const fc = (this._forecast || []).slice(0, 3);
    const sigF = JSON.stringify(fc.map((f) => [f.condition, Math.round(f.temperature), Math.round(f.templow), f.datetime]));
    if (this._sig.fc !== sigF) {
      this._sig.fc = sigF;
      this._$(".fcb").innerHTML = fc.map((f, i) => {
        const dn = i === 0 ? "TODAY" : new Date(f.datetime).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        const c = h80Cond(f.condition).slice(0, 13);
        return `<div class="row"><span>${dn.padEnd(6, " ")} ${c}</span><span>${Math.round(f.temperature)}°/${f.templow != null ? Math.round(f.templow) + "°" : "--"}</span></div>`;
      }).join("") || `<div class="row dim">NO DATA</div>`;
    }
    // schedule
    const sigE = JSON.stringify(this._events || []) + (sun ? sun.attributes.next_setting : "");
    if (this._sig.ev !== sigE) {
      this._sig.ev = sigE;
      const tf = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const fmt = (e) => {
        const d = e.t, today = new Date(); const tm = new Date(today); tm.setDate(today.getDate() + 1);
        const day = d.toDateString() === today.toDateString() ? "TODAY" : d.toDateString() === tm.toDateString() ? "TMRW" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        return e.allDay ? day : `${day} ${tf(d)}`;
      };
      let html = (this._events || []).map((e) => `<div class="ev">${fmt(e)} <span class="dim">${e.s.toUpperCase()}</span></div>`).join("");
      if (sun && (this._events || []).length < 3) {
        const ns = new Date(sun.attributes.next_setting), nr = new Date(sun.attributes.next_rising);
        html += `<div class="ev">${night ? "SUNRISE" : "SUNSET"} <span class="dim">${tf(night ? nr : ns)}</span></div>`;
      }
      this._$(".evs").innerHTML = html;
      this._sunTxt = sun ? `${night ? "SUNRISE" : "SUNSET"} AT ${tf(new Date(night ? sun.attributes.next_rising : sun.attributes.next_setting))}` : "";
    }
    this._msgs = [
      "ALL SYSTEMS NOMINAL",
      `${this._lit} LIGHT${this._lit === 1 ? "" : "S"} ON IN THE HOUSE`,
      `OUTSIDE ${isNaN(outT) ? "--" : Math.round(outT)}°F  ${h80Cond(cond)}`,
      `INSIDE ${avgTxt}`,
      this._sunTxt,
      (this._events || [])[0] ? `NEXT UP: ${this._events[0].s.toUpperCase()}` : "",
      "TOUCH A ROOM TO CONTROL IT",
    ].filter(Boolean);
    if (this._openIdx != null) this._updatePopup();
  }

  /* typing prompt at the bottom */
  _type() {
    if (!this._built || !this._msgs) return;
    const p = this._$(".prompt");
    if (!this._tw) this._tw = { i: 0, n: 0, hold: 0 };
    const w = this._tw, msg = "C:\\HOME> " + (this._msgs[w.i % this._msgs.length] || "");
    if (w.n < msg.length) w.n++;
    else if (++w.hold > 70) { w.i++; w.n = 9; w.hold = 0; }
    const txt = msg.slice(0, w.n).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    if (p._t !== txt) { p._t = txt; p.innerHTML = txt + '<span class="cur"></span>'; }
  }

  /* ---------- room window ---------- */
  _open(i) {
    this._openIdx = i;
    const rm = this._cfg.rooms[i];
    this._$$rooms().forEach((el) => el.classList.toggle("sel", +el.dataset.room === i));
    const rows = rm.items.map((it, j) => {
      if (it.entity.startsWith("climate.")) return `<div class="th" data-j="${j}"></div>`;
      return `<div class="it" data-j="${j}"><span class="n"></span><span class="s"></span></div><div class="dimr" data-j="${j}" style="display:none"></div>`;
    }).join("");
    const win = this._$(".win");
    win.innerHTML = `<div class="wt"><span>${rm.name.toUpperCase()}</span><span class="x">[X]</span></div>${rows}`;
    win.querySelector(".x").addEventListener("click", () => this._close());
    win.querySelectorAll(".it").forEach((t) => t.addEventListener("click", () => this._tap(rm.items[+t.dataset.j], t)));
    win.querySelectorAll(".th").forEach((t) => this._buildTherm(t, rm.items[+t.dataset.j]));
    win.querySelectorAll(".dimr").forEach((d) => {
      d.innerHTML = Array.from({ length: 10 }, (_, k) => `<span data-k="${k}"></span>`).join("") + `<span class="pct" style="font-size:30px;margin-left:12px"></span>`;
      d.querySelectorAll("span[data-k]").forEach((s) => s.addEventListener("click", () => {
        this._bump();
        this._hass.callService("light", "turn_on", { entity_id: rm.items[+d.dataset.j].entity, brightness_pct: (+s.dataset.k + 1) * 10 });
      }));
    });
    this._$(".pop").classList.add("open");
    this._updatePopup();
    this._bump();
  }
  _$$rooms() { return this.shadowRoot.querySelectorAll(".room"); }
  _close() { this._openIdx = null; this._$(".pop").classList.remove("open"); this._$$rooms().forEach((el) => el.classList.remove("sel")); clearTimeout(this._idle); }
  _bump() { clearTimeout(this._idle); this._idle = setTimeout(() => this._close(), 60000); }

  _tap(it, t) {
    this._bump();
    const [dom] = it.entity.split(".");
    if (it.action === "restart") {
      if (!t._armed) {
        t._armed = true; t.classList.add("warn"); t.querySelector(".s").textContent = "TAP AGAIN TO RESTART";
        setTimeout(() => { t._armed = false; t.classList.remove("warn"); this._updatePopup(); }, 4000);
        return;
      }
      t._armed = false; t.classList.remove("warn");
      if (it.script) this._hass.callService("script", "turn_on", { entity_id: it.script });
      t._restarting = Date.now();
      this._updatePopup();
      return;
    }
    this._hass.callService(dom === "light" ? "light" : dom === "fan" ? "fan" : "switch", "toggle", { entity_id: it.entity });
  }

  _updatePopup() {
    const rm = this._cfg.rooms[this._openIdx]; if (!rm) return;
    const win = this._$(".win");
    win.querySelectorAll(".it").forEach((t) => {
      const it = rm.items[+t.dataset.j], s = this._st(it.entity);
      const state = s ? s.state : "unavailable", on = state === "on";
      t.querySelector(".n").textContent = `[${on ? "X" : " "}] ${it.name.toUpperCase()}`;
      const d = win.querySelector(`.dimr[data-j="${t.dataset.j}"]`);
      const dimmable = s && it.entity.startsWith("light.") && (s.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      d.style.display = dimmable ? "" : "none";
      if (dimmable) {
        const pct = on && s.attributes.brightness ? Math.round((s.attributes.brightness / 255) * 100) : 0;
        d.querySelectorAll("span[data-k]").forEach((x) => { x.textContent = pct >= (+x.dataset.k + 1) * 10 - 5 ? "█" : "░"; });
        d.querySelector(".pct").textContent = on ? pct + "%" : "";
      }
      if (t._armed) return;
      let txt = state === "unavailable" ? "OFFLINE" : on ? "ON" : "OFF";
      if (it.action === "restart") txt = t._restarting && Date.now() - t._restarting < 20000 ? "RESTARTING..." : on ? "ON  (TAP=RESTART)" : "OFF (TAP=RESTART)";
      t.querySelector(".s").textContent = txt;
    });
    win.querySelectorAll(".th").forEach((t) => this._updTherm(t, rm.items[+t.dataset.j]));
  }

  _buildTherm(t, it) {
    t.innerHTML = `<div class="r"><span class="cu"></span><span class="ac dim"></span></div>
      <div class="r sp-lo"><span class="l"></span><span><span class="btn" data-d="lo:-1">-</span><span class="v" style="display:inline-block;width:90px;text-align:center"></span><span class="btn" data-d="lo:1">+</span></span></div>
      <div class="r sp-hi"><span>COOL TO</span><span><span class="btn" data-d="hi:-1">-</span><span class="v" style="display:inline-block;width:90px;text-align:center"></span><span class="btn" data-d="hi:1">+</span></span></div>
      <div class="r"><span>MODE</span><span>${["auto", "heat", "cool", "off"].map((m) => `<span class="btn mb" data-m="${m}">${m.toUpperCase()}</span>`).join("")}</span></div>`;
    t.querySelectorAll(".btn[data-d]").forEach((b) => b.addEventListener("click", () => {
      this._bump();
      const [which, d] = b.dataset.d.split(":");
      const s = this._st(it.entity), A = s.attributes;
      const p = t._pend || { lo: A.target_temp_low, hi: A.target_temp_high, t: A.temperature };
      if (s.state === "auto") { p[which] = (p[which] || 70) + +d; if (p.hi - p.lo < 3) { if (which === "lo") p.hi = p.lo + 3; else p.lo = p.hi - 3; } }
      else p.t = (p.t || 70) + +d;
      t._pend = p; this._updTherm(t, it);
      clearTimeout(t._deb);
      t._deb = setTimeout(() => {
        const data = { entity_id: it.entity };
        if (s.state === "auto") { data.target_temp_low = p.lo; data.target_temp_high = p.hi; } else data.temperature = p.t;
        this._hass.callService("climate", "set_temperature", data);
        setTimeout(() => { t._pend = null; this._updTherm(t, it); }, 4000);
      }, 1200);
    }));
    t.querySelectorAll(".mb").forEach((b) => b.addEventListener("click", () => {
      this._bump();
      this._hass.callService("climate", "set_hvac_mode", { entity_id: it.entity, hvac_mode: b.dataset.m });
    }));
  }
  _updTherm(t, it) {
    const s = this._st(it.entity); if (!s) return;
    const A = s.attributes, p = t._pend;
    t.querySelector(".cu").textContent = `${it.name.toUpperCase()}  ${A.current_temperature != null ? Math.round(A.current_temperature) + "°F" : "--"}`;
    t.querySelector(".ac").textContent = (A.hvac_action || s.state || "").toUpperCase();
    const auto = s.state === "auto";
    const lo = p ? (auto ? p.lo : p.t) : auto ? A.target_temp_low : A.temperature;
    const hi = p ? p.hi : A.target_temp_high;
    t.querySelector(".sp-lo .l").textContent = auto ? "HEAT TO" : "SET TO";
    t.querySelector(".sp-lo .v").textContent = lo != null ? Math.round(lo) + "°" : "--";
    t.querySelector(".sp-hi").style.display = auto ? "" : "none";
    t.querySelector(".sp-hi .v").textContent = hi != null ? Math.round(hi) + "°" : "--";
    t.querySelector(".sp-lo").style.visibility = s.state === "off" ? "hidden" : "";
    t.querySelectorAll(".mb").forEach((b) => b.classList.toggle("sel", b.dataset.m === s.state));
  }
}

if (!customElements.get("home80-card")) customElements.define("home80-card", Home80Card);
window.customCards = window.customCards || [];
window.customCards.push({ type: "home80-card", name: "Home 80s", description: "Home dashboard styled as an 80s CRT monitor" });
console.info(`%c HOME80-CARD %c ${H80_VERSION} `, "background:#021408;color:#3dff72", "background:#cfc5aa;color:#333");
