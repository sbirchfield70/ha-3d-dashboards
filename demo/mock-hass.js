/* Tiny fake Home Assistant "hass" object so the cards can be previewed in a plain browser.
 * Any entity id you ask for gets a plausible demo state, guessed from its domain and name.
 * Open demo/index.html?card=home (or bedroom, tv, garage, hero, tiles). Not needed in Home Assistant. */
(function () {
  const MDI = "https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css";
  const iso = (d) => d.toISOString();
  const dayStr = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const panelOverride = new URLSearchParams(location.search).get("panel");

  function guess(id) {
    const [domain, name] = id.split(".");
    const on = hash(id) % 3 !== 0;
    const A = { friendly_name: name.replace(/_/g, " ") };
    const st = (state, attrs = {}) => ({ entity_id: id, state: String(state), attributes: Object.assign(A, attrs), last_changed: iso(new Date()) });
    switch (domain) {
      case "weather": return st("partlycloudy", { temperature: 72, humidity: 58, pressure: 30.02, pressure_unit: "inHg", wind_speed: 9, wind_bearing: 215, temperature_unit: "°F" });
      case "sun": { const r = new Date(); r.setHours(30, 52, 0, 0); const s = new Date(); s.setHours(17, 34, 0, 0); if (s < new Date()) s.setDate(s.getDate() + 1); return st("above_horizon", { next_rising: iso(r), next_setting: iso(s), elevation: 32 }); }
      case "light": return st(on ? "on" : "off", { brightness: 190, rgb_color: [110, 170, 255] });
      case "switch": case "input_boolean": return st(on ? "on" : "off");
      case "fan": return st("on", { preset_mode: "auto", percentage: 40 });
      case "vacuum": return st(/litter/.test(name) ? "docked" : hash(id) % 2 ? "cleaning" : "docked", { battery_level: 86 });
      case "lawn_mower": return st("docked");
      case "cover": return st("closed");
      case "lock": return st("locked");
      case "climate": return st("heat", { current_temperature: 70, temperature: 68, hvac_action: "idle", hvac_modes: ["off", "heat", "cool", "auto"] });
      case "media_player": return st("on", { source: "Streaming" });
      case "number": return st(/freezer/.test(name) ? 0 : 37, { unit_of_measurement: "°F" });
      case "binary_sensor": return st(/online|status|charging|quorate/.test(name) ? "on" : "off");
      case "select": return st("auto", { options: ["auto", "sleep", "low", "high"] });
      case "input_select": return st(panelOverride || (/middle/.test(name) ? "fridge" : /garage_display_panel/.test(name) ? "photos" : "home"), { options: ["photos", "camera", "home", "mower", "vacuum_main", "vacuum_bedroom", "network", "tv_shows", "fridge", "washer"] });
      case "image": return st(iso(new Date()), { entity_picture: "photo.svg" });
      case "camera": return st("idle", { entity_picture: "photo.svg" });
      case "calendar": return st("off");
      case "sensor": {
        if (/pickup|date/.test(name)) return st(dayStr(/recycl/.test(name) ? 4 : 1));
        if (/status_code/.test(name)) return st("rdy");
        if (/humidity/.test(name)) return st(48, { unit_of_measurement: "%" });
        if (/rain_chance|precip_prob/.test(name)) return st(20, { unit_of_measurement: "%" });
        if (/rain|precip/.test(name)) return st(0.12, { unit_of_measurement: "in" });
        if (/high/.test(name)) return st(78);
        if (/low/.test(name)) return st(57);
        if (/temp/.test(name)) return st(71, { unit_of_measurement: "°F" });
        if (/battery/.test(name)) return st(86, { unit_of_measurement: "%" });
        if (/summary/.test(name)) return st("Partly cloudy until evening.");
        if (/machine_state/.test(name)) return st("Run");
        if (/sub_cycle/.test(name)) return st("rinse");
        if (/time_remaining/.test(name)) return st(1680);
        if (/wind|gust/.test(name)) return st(/gust/.test(name) ? 16 : 9);
        if (/filter|brush|desiccant|life/.test(name)) return st(72, { unit_of_measurement: "%" });
        if (/status$/.test(name)) return st("charging_completed");
        if (/error/.test(name)) return st("No error");
        if (/air_quality/.test(name)) return st(1);
        if (/drawer|level/.test(name)) return st(34, { unit_of_measurement: "%" });
        if (/area/.test(name)) return st(412, { unit_of_measurement: "ft²" });
        if (/mode/.test(name)) return st("main_area");
        if (/next_start/.test(name)) return st(iso(new Date(Date.now() + 864e5)));
        return st(42);
      }
    }
    return st(on ? "on" : "off");
  }

  const cache = {};
  const states = new Proxy(cache, { get: (t, id) => (typeof id !== "string" || !id.includes(".") ? undefined : (t[id] = t[id] || guess(id))) });
  const fc = ["sunny", "partlycloudy", "rainy", "cloudy", "sunny"].map((c, i) => ({ datetime: dayStr(i) + "T12:00:00", condition: c, temperature: 78 - i * 2, templow: 57 + i, precipitation_probability: i * 15 }));
  const at = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return iso(x); };
  const events = [
    { summary: "Dentist", start: { dateTime: at(0, 15, 30) } },
    { summary: "Soccer practice", start: { dateTime: at(1, 17, 0) } },
    { summary: "Trash day", start: { date: dayStr(2) } },
  ];

  window.loadCardHelpers = async () => ({
    createCardElement(cfg) {
      const el = document.createElement("div");
      el.style.cssText = "height:100%;min-height:120px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#cfe0ff;font:800 16px Nunito,sans-serif;background:linear-gradient(160deg,#35577f,#1b3354)";
      el.innerHTML = cfg.type === "picture-entity" ? `<img src="photo.svg" style="width:100%;border-radius:12px;display:block">` : `${(cfg.name || cfg.type || "").replace("custom:", "")}`;
      return el;
    },
  });
  if (!customElements.get("ha-icon")) customElements.define("ha-icon", class extends HTMLElement {
    static get observedAttributes() { return ["icon"]; }
    set icon(v) { this.setAttribute("icon", v); }
    attributeChangedCallback() { const i = (this.getAttribute("icon") || "").replace("mdi:", ""); const r = this.shadowRoot || this.attachShadow({ mode: "open" }); r.innerHTML = `<link rel="stylesheet" href="${MDI}"><i class="mdi mdi-${i}" style="font-size:var(--mdc-icon-size,24px);line-height:1;display:inline-block"></i>`; }
  });

  window.mockHass = {
    states,
    language: "en",
    locale: { language: "en" },
    themes: { darkMode: true },
    callService: (d, s, data) => console.log("callService", d, s, data),
    callApi: async (method, path) => (path.startsWith("calendars/") ? events : []),
    callWS: async (msg) => (msg.type === "weather/get_forecasts" ? {} : []),
    connection: {
      subscribeMessage: (cb, msg) => {
        setTimeout(() => { if (msg.type === "weather/subscribe_forecast") cb({ type: "daily", forecast: fc }); else if (msg.type === "render_template") cb({ result: "[]" }); }, 50);
        return Promise.resolve(() => {});
      },
      subscribeEvents: () => Promise.resolve(() => {}),
    },
  };
})();
