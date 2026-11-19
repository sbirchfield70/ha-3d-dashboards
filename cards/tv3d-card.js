/*!
 * TV 3D Card — an animated, isometric "3D" TV / living-room dashboard for Home Assistant (blue theme, display-only).
 * Designed on a 960x540 canvas (Fire TV / Fully Kiosk viewport) and scaled to fit.
 * Left: clock, house with live weather, a retro TV (optional WeatherStar 4000+ iframe), gauges, sun arc, forecast.
 * Right: a rotating panel driven by an input_select (photos, cameras, home, mower, vacuums, network, TV shows).
 * Every entity is set in the card config; see the README for the full option list.
 * License: MIT
 */
const TV3D_VERSION = "1.0.0";

const TV = {
  weather: "weather.home",
  outside_temp: null,                         // optional sensor; falls back to the weather entity's temperature
  sun: "sun.sun",
  panel: "input_select.tv_display_panel",     // options = panel keys below; rotate it with an automation
  photo: "image.tv_rotation_photo",           // any image.* entity (e.g. a rotating photo)
  garage: "cover.garage_door",
  vac_main: "vacuum.main_vacuum",
  vac_main_batt: "sensor.main_vacuum_battery_level",
  vac_main_name: "Main Vacuum",
  vac_bed: "vacuum.bedroom_vacuum",
  vac_bed_batt: "sensor.bedroom_vacuum_battery_level",
  vac_bed_name: "Bedroom Vacuum",
  lights: "switch.backyard_lights",
  washer: "sensor.washer_machine_state",        // shows a washer panel while the state is "Run"
  washer_sub: "sensor.washer_sub_cycle",
  washer_left: "sensor.washer_time_remaining",  // seconds
  wind: "sensor.wind_speed",
  gust: "sensor.wind_gust",
  rain_chance: "sensor.today_rain_chance",
  rain_today: "sensor.today_rain_accumulation",
  summary: "sensor.today_weather_summary",
  summary_alt: "sensor.daily_weather_summary",
  high: "sensor.today_high_temperature",
  low: "sensor.today_low_temperature",
  trash: "sensor.next_trash_pickup_date",       // state = YYYY-MM-DD
  recycle: "sensor.next_recycling_pickup_date",
  calendars: [],
  feeder_schedule_template: null,               // optional Jinja template returning [{"t":"7:00 AM","n":"Breakfast","a":2,"s":"done|next|later"}]
  mower: "lawn_mower.mower",
  mower_battery: "sensor.mower_battery",
  mower_charging: "binary_sensor.mower_charging",
  mower_mode: "sensor.mower_mode",
  mower_next_start: "sensor.mower_next_start",
  mower_error: "sensor.mower_error",
  mower_cutting_time: "sensor.mower_total_cutting_time",
  mower_drive_distance: "sensor.mower_total_drive_distance",
  mower_charging_cycles: "sensor.mower_number_of_charging_cycles",
  mower_charging_time: "sensor.mower_total_charging_time",
  cams: ["camera.front_yard", "camera.back_yard"], // Cameras panel
  embeds: {},                                   // override/add panels with any Lovelace card configs: { key: [cardConfig, ...] }
  weatherstar: "",                              // optional URL of a WeatherStar 4000+ (ws4kp) instance for the retro TV screen
};

const PANELS = {
  photos: { t: "Photos", i: "mdi:image-multiple" },
  camera: { t: "Cameras", i: "mdi:cctv" },
  home: { t: "Home", i: "mdi:home-heart" },
  mower: { t: "Mower", i: "mdi:robot-mower" },
  vacuum_main: { t: "Main Vacuum", i: "mdi:robot-vacuum" },
  vacuum_bedroom: { t: "Bedroom Vacuum", i: "mdi:robot-vacuum-variant" },
  network: { t: "Network", i: "mdi:lan" },
  tv_shows: { t: "Upcoming TV Shows", i: "mdi:television-classic" },
};

function defaultEmbeds(C) {
  const vac = (name, e, p) => [{ type: "custom:appliance-robot-vacuum-solo-card", name, entity: e, entity_battery: p + "battery_level", entity_area: p + "cleaned_area", entity_time: p + "cleaning_time", entity_status: p + "status", entity_filter: p + "filter_left", entity_brush: p + "main_brush_left", language: "en" }];
  const pre = (e) => "sensor." + (e || "").split(".")[1] + "_";
  return Object.assign({
    camera: (C.cams || []).map((entity) => ({ type: "picture-entity", entity, camera_view: "live", show_name: false, show_state: false, fit_mode: "contain", aspect_ratio: "16:9", tap_action: { action: "none" }, hold_action: { action: "none" } })),
    vacuum_main: vac(C.vac_main_name, C.vac_main, pre(C.vac_main)),
    vacuum_bedroom: vac(C.vac_bed_name, C.vac_bed, pre(C.vac_bed)),
    network: [{ type: "custom:silverfox-network-card", scale: 0.72 }],
  }, C.embeds || {});
}


/* ---------- helpers (same family as home3d-card) ---------- */
function shade(hex, pct) {
  let n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function mkIso(ox, oy, k) {
  const P = (x, y, z) => [ox + (x - y) * 0.8 * k, oy + (x + y) * 0.4 * k - z * 0.8 * k];
  const pts = (arr) => arr.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const poly = (arr, fill, extra = "") => `<polygon points="${pts(arr)}" fill="${fill}" ${extra}/>`;
  const box = (x, y, z, w, d, h, c, o = {}) => {
    const top = o.top || shade(c, 22), right = o.right || shade(c, -6), left = o.left || shade(c, -24), ex = o.extra || "";
    return poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right, ex) +
      poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left, ex) +
      poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top, ex);
  };
  return { P, pts, poly, box };
}
let UID = 0;
function cloud(cx, cy, s, fid, extra = "") {
  return `<g ${extra}><ellipse cx="${cx}" cy="${cy + 10 * s}" rx="${34 * s}" ry="${12 * s}" fill="url(#${fid})"/><circle cx="${cx - 16 * s}" cy="${cy + 2 * s}" r="${14 * s}" fill="url(#${fid})"/><circle cx="${cx + 4 * s}" cy="${cy - 6 * s}" r="${20 * s}" fill="url(#${fid})"/><circle cx="${cx + 22 * s}" cy="${cy + 4 * s}" r="${12 * s}" fill="url(#${fid})"/></g>`;
}
function weatherSVG(cond, night, size = 120) {
  const u = "tw" + ++UID;
  const defs = `<defs><radialGradient id="${u}s" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff6c9"/><stop offset=".55" stop-color="#ffd25e"/><stop offset="1" stop-color="#f4a62a"/></radialGradient>
    <radialGradient id="${u}m" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d6ee"/></radialGradient>
    <linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bccbe4"/></linearGradient>
    <linearGradient id="${u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d3e6"/><stop offset="1" stop-color="#7f93b5"/></linearGradient></defs>`;
  const sun = (cx, cy, r) => `<g class="rays" style="transform-origin:${cx}px ${cy}px">${Array.from({ length: 10 }, (_, i) => { const a = (i * 36 * Math.PI) / 180; return `<line x1="${cx + Math.cos(a) * (r + 7)}" y1="${cy + Math.sin(a) * (r + 7)}" x2="${cx + Math.cos(a) * (r + 17)}" y2="${cy + Math.sin(a) * (r + 17)}" stroke="#ffc94a" stroke-width="5" stroke-linecap="round"/>`; }).join("")}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u}s)" class="pulse" style="transform-origin:${cx}px ${cy}px"/>`;
  const moon = (cx, cy, r) => `<g class="float"><path d="M ${cx + r * 0.3} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r} ${cy + r * 0.45} A ${r * 0.8} ${r * 0.8} 0 1 1 ${cx + r * 0.3} ${cy - r} Z" fill="url(#${u}m)"/></g>${[[22, 24], [96, 18], [104, 70], [16, 80]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" class="twinkle" style="animation-delay:${i * 0.7}s"/>`).join("")}`;
  const drops = (n, c = "#7cc4ff") => Array.from({ length: n }, (_, i) => `<line x1="${40 + i * 14}" y1="78" x2="${36 + i * 14}" y2="90" stroke="${c}" stroke-width="4" stroke-linecap="round" class="drop" style="animation-delay:${(i * 0.23) % 1}s"/>`).join("");
  const flakes = (n) => Array.from({ length: n }, (_, i) => `<text x="${38 + i * 15}" y="88" font-size="14" fill="#fff" class="flake" style="animation-delay:${(i * 0.4) % 2}s">❄</text>`).join("");
  const c = (cond || "").toLowerCase();
  let b;
  if (c === "sunny" || c === "clear") b = sun(60, 60, 26);
  else if (c === "clear-night") b = moon(58, 58, 28);
  else if (c === "partlycloudy") b = (night ? `<g transform="translate(-14,-12) scale(.8)">${moon(58, 58, 26)}</g>` : sun(44, 44, 20)) + cloud(66, 66, 1, u + "c", 'class="drift"');
  else if (c === "cloudy") b = cloud(46, 48, 0.75, u + "d", 'class="drift2"') + cloud(66, 66, 1, u + "c", 'class="drift"');
  else if (c === "rainy") b = cloud(60, 52, 1, u + "d", 'class="drift"') + drops(4);
  else if (c === "pouring") b = cloud(60, 50, 1.05, u + "d", 'class="drift"') + drops(5, "#5aa8ff");
  else if (c === "snowy" || c === "snowy-rainy" || c === "hail") b = cloud(60, 50, 1, u + "c", 'class="drift"') + flakes(4);
  else if (c === "lightning" || c === "lightning-rainy") b = cloud(60, 48, 1.05, u + "d", 'class="drift"') + `<path d="M62 70 L50 92 L60 92 L54 112 L74 84 L63 84 L70 70 Z" fill="#ffd84a" class="flash"/>` + (c === "lightning-rainy" ? drops(3) : "");
  else if (c === "fog") b = cloud(60, 46, 0.9, u + "c") + [70, 82, 94].map((y, i) => `<line x1="${24 + i * 6}" y1="${y}" x2="${96 - i * 4}" y2="${y}" stroke="#d6e1f2" stroke-width="6" stroke-linecap="round" class="fog" style="animation-delay:${i * 0.6}s"/>`).join("");
  else if (c === "windy" || c === "windy-variant") b = cloud(64, 50, 0.9, u + "c", 'class="drift"') + [74, 88].map((y, i) => `<path d="M14 ${y} Q 50 ${y - 8} 86 ${y} T 112 ${y - 6}" stroke="#d6e1f2" stroke-width="5" fill="none" stroke-linecap="round" class="fog" style="animation-delay:${i * 0.5}s"/>`).join("");
  else b = night ? moon(58, 58, 28) : sun(60, 60, 26);
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="overflow:visible">${defs}${b}</svg>`;
}
function pedestal(w, h, top = "#3b679f", side = "#22426e") {
  const rx = w / 2 - 3, ry = rx * 0.32, id = "pd" + ++UID;
  return `<svg class="ped" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="${id}a" x1="0" x2="1"><stop offset="0" stop-color="${shade(side, -25)}"/><stop offset=".5" stop-color="${side}"/><stop offset="1" stop-color="${shade(side, -35)}"/></linearGradient><radialGradient id="${id}b" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(top, 25)}"/><stop offset="1" stop-color="${top}"/></radialGradient></defs>
    <path d="M ${w / 2 - rx} ${ry + 3} L ${w / 2 - rx} ${h - ry - 4} A ${rx} ${ry} 0 0 0 ${w / 2 + rx} ${h - ry - 4} L ${w / 2 + rx} ${ry + 3} Z" fill="url(#${id}a)"/><ellipse cx="${w / 2}" cy="${ry + 3}" rx="${rx}" ry="${ry}" fill="url(#${id}b)"/></svg>`;
}

/* ---------- house ---------- */
function houseSVG(night, cold, garageOpen) {
  const I = mkIso(150, 104, 1.45), { P, poly, box } = I;
  let s = `<defs><filter id="hs" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter><radialGradient id="hsh"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
  const [sx, sy] = P(50, 50, -26);
  s += `<ellipse cx="${sx}" cy="${sy + 18}" rx="150" ry="42" fill="url(#hsh)"/>`;
  s += box(0, 0, -16, 100, 100, 16, "#3c6aa8", { top: "#5f8ccc", right: "#2b5288", left: "#1f3f6c" });
  s += poly([P(4, 4, 0.1), P(96, 4, 0.1), P(96, 96, 0.1), P(4, 96, 0.1)], "#4f8a76");
  [[52, 76], [55, 84], [52, 92]].forEach(([x, y]) => (s += poly([P(x, y, 0.3), P(x + 6, y, 0.3), P(x + 6, y + 5, 0.3), P(x, y + 5, 0.3)], "#c9d7ea")));
  s += poly([P(76, 40, 0.3), P(96, 40, 0.3), P(96, 58, 0.3), P(76, 58, 0.3)], "#9fb3cf"); // driveway
  const tree = (x, y, h, c = "#2f7a5b") => { const [bx, by] = P(x, y, 6), [tx, ty] = P(x, y, h); return box(x - 1.2, y - 1.2, 0, 2.4, 2.4, 7, "#7a5a44") + `<g class="tsway" style="transform-origin:${bx}px ${by}px"><polygon points="${bx - 13},${by} ${tx},${ty} ${bx},${by + 5}" fill="${shade(c, 12)}"/><polygon points="${bx},${by + 5} ${tx},${ty} ${bx + 13},${by}" fill="${shade(c, -18)}"/></g>`; };
  s += tree(12, 14, 34) + tree(86, 10, 30, "#2a6e52");
  s += box(30, 28, 0, 42, 40, 30, "#eef3fb", { right: "#dfe7f3", left: "#c6d3e6", top: "#eef3fb" });
  // garage door on +x face reflects real garage
  const gd = garageOpen ? "#1a2a44" : "#d5dfee";
  s += poly([P(72, 38, 0), P(72, 58, 0), P(72, 58, 17), P(72, 38, 17)], gd, 'stroke="#eef3fb" stroke-width="1"');
  if (!garageOpen) for (let z = 4; z < 17; z += 4) s += `<line x1="${P(72, 38, z)[0]}" y1="${P(72, 38, z)[1]}" x2="${P(72, 58, z)[0]}" y2="${P(72, 58, z)[1]}" stroke="#a9b9d2" stroke-width=".8"/>`;
  else s += `<polygon points="${I.pts([P(72, 38, 0), P(72, 58, 0), P(90, 58, 0), P(90, 38, 0)])}" fill="#ffd57a" opacity=".25" filter="url(#hs)" class="glow"/>`;
  const win = night ? "#ffd57a" : "#9fd2ff", wc = night ? 'class="flicker"' : "";
  s += poly([P(72, 62, 12), P(72, 66, 12), P(72, 66, 22), P(72, 62, 22)], win, wc + ' stroke="#fff" stroke-width="1.2"');
  s += poly([P(36, 68, 10), P(46, 68, 10), P(46, 68, 22), P(36, 68, 22)], win, wc + ' stroke="#fff" stroke-width="1.4"');
  s += poly([P(52, 68, 0), P(61, 68, 0), P(61, 68, 18), P(52, 68, 18)], "#1f5a3d", 'stroke="#eef3fb" stroke-width="1"');
  if (night) s += `<ellipse cx="${P(56, 80, 0)[0]}" cy="${P(56, 80, 0)[1]}" rx="34" ry="14" fill="#ffcf6b" opacity=".25" filter="url(#hs)" class="glow"/>`;
  const G = "#1d5c3d";
  s += poly([P(26, 24, 28), P(76, 24, 28), P(76, 48, 50), P(26, 48, 50)], shade(G, -25));
  s += box(36, 34, 38, 6, 6, 22, "#c3cfe0");
  s += poly([P(72, 28, 30), P(72, 68, 30), P(72, 48, 50)], "#e2e9f4");
  s += poly([P(26, 72, 28), P(76, 72, 28), P(76, 48, 50), P(26, 48, 50)], G);
  s += poly([P(76, 72, 28), P(76, 72, 26), P(76, 48, 48), P(76, 48, 50)], shade(G, -35));
  s += poly([P(26, 72, 28), P(76, 72, 28), P(76, 72, 26), P(26, 72, 26)], shade(G, -40));
  s += `<line x1="${P(26, 48, 50)[0]}" y1="${P(26, 48, 50)[1]}" x2="${P(76, 48, 50)[0]}" y2="${P(76, 48, 50)[1]}" stroke="${shade(G, 30)}" stroke-width="2"/>`;
  if (night || cold) { const [cx, cy] = P(39, 37, 62); s += [0, 1, 2].map((i) => `<circle cx="${cx}" cy="${cy}" r="${5 + i}" fill="#dfe8f5" opacity="0" class="smoke" style="animation-delay:${i * 1.3}s"/>`).join(""); }
  s += tree(14, 80, 26) + tree(84, 86, 24, "#357f60");
  [[40, 74], [62, 74]].forEach(([x, y]) => { const [bx, by] = P(x, y, 3); s += `<circle cx="${bx}" cy="${by}" r="6" fill="#3b8a66"/><circle cx="${bx + 5}" cy="${by + 1}" r="4.5" fill="#2f7356"/>`; });
  return `<svg viewBox="0 30 300 250" class="housesvg">${s}</svg>`;
}

/* ---------- gauges ---------- */
function dropSVG(h) {
  const lvl = Math.max(0, Math.min(100, h || 0)), y = 88 - (lvl / 100) * 72;
  return `<svg viewBox="0 0 80 100" width="44" height="55" class="bob"><defs><clipPath id="dc"><path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z"/></clipPath>
    <linearGradient id="dw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2a7bdc"/></linearGradient>
    <radialGradient id="dg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#d6e9ff" stop-opacity=".45"/><stop offset="1" stop-color="#9ec5f0" stop-opacity=".6"/></radialGradient></defs>
    <path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z" fill="url(#dg)"/>
    <g clip-path="url(#dc)"><g class="wave"><path d="M -40 ${y} q 10 -5 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 V 100 H -40 Z" fill="url(#dw)"/></g></g>
    <path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z" fill="none" stroke="#e8f3ff" stroke-width="2"/><ellipse cx="29" cy="52" rx="5" ry="10" fill="#fff" opacity=".55" transform="rotate(20 29 52)"/></svg>`;
}
function baroSVG(p, unit) {
  let inHg = p; if (unit === "hPa" || unit === "mbar") inHg = p * 0.02953; else if (unit === "psi") inHg = p * 2.03602;
  const ang = Math.max(-130, Math.min(130, ((inHg - 29.92) / 1.1) * 130));
  const ticks = Array.from({ length: 27 }, (_, i) => { const a = ((-130 + i * 10) * Math.PI) / 180, big = i % 5 === 0; return `<line x1="${50 + Math.sin(a) * 36}" y1="${50 - Math.cos(a) * 36}" x2="${50 + Math.sin(a) * (big ? 29 : 32)}" y2="${50 - Math.cos(a) * (big ? 29 : 32)}" stroke="#2b3f5e" stroke-width="${big ? 2 : 1}"/>`; }).join("");
  return `<svg viewBox="0 0 100 100" width="54" height="54"><defs><radialGradient id="bf" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d4deec"/></radialGradient><linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe8f5"/><stop offset=".5" stop-color="#7f95b8"/><stop offset="1" stop-color="#3d5478"/></linearGradient></defs>
    <circle cx="50" cy="50" r="46" fill="url(#br)"/><circle cx="50" cy="50" r="40" fill="url(#bf)"/>${ticks}
    <g style="transform:rotate(${ang}deg);transform-origin:50px 50px"><g class="needle" style="transform-origin:50px 50px"><path d="M 50 18 L 53 50 L 47 50 Z" fill="#e2453c"/><path d="M 50 62 L 52.5 50 L 47.5 50 Z" fill="#2b3f5e"/></g></g>
    <circle cx="50" cy="50" r="5" fill="#2b3f5e"/><ellipse cx="38" cy="30" rx="18" ry="9" fill="#fff" opacity=".35" transform="rotate(-25 38 30)"/></svg>`;
}
function sockHTML(speed, bearing) {
  const to = ((bearing || 0) + 180) % 360, droop = Math.max(0, 55 - (speed || 0) * 4), dur = Math.max(0.35, 1.6 - (speed || 0) * 0.07);
  const st = [0, 1, 2, 3, 4].map((i) => `<path d="M ${4 + i * 11} ${11 - i * 1.3} L ${15 + i * 11} ${11 - (i + 1) * 1.3} L ${15 + i * 11} ${25 + (i + 1) * 1.3} L ${4 + i * 11} ${25 + i * 1.3} Z" fill="${i % 2 ? "#fff" : "#ff6a3d"}"/>`).join("");
  return `<div class="sock-wrap"><div class="sock-pole"></div><div class="sock-rot" style="transform:rotateY(${-(to - 90)}deg)"><div class="sock-droop" style="transform:rotateZ(${droop}deg)"><svg viewBox="0 0 64 36" width="56" height="32" class="sock" style="animation-duration:${dur}s">${st}<ellipse cx="4" cy="18" rx="2.5" ry="7.5" fill="#c7d2e3"/></svg></div></div></div>`;
}

/* ---------- small animated status icons ---------- */
function windIcon() { return `<svg viewBox="0 0 60 40" width="44" height="30">${[10, 20, 30].map((y, i) => `<path d="M4 ${y} H ${40 - i * 6} q 8 0 8 -6 q 0 -5 -5 -5" stroke="#cfe6ff" stroke-width="3.2" fill="none" stroke-linecap="round" class="windl" style="animation-delay:${i * 0.3}s"/>`).join("")}</svg>`; }
function gustIcon() { return `<svg viewBox="0 0 60 40" width="44" height="30"><g class="spinslow" style="transform-origin:30px 20px">${[0, 120, 240].map((a) => `<path d="M30 20 q 6 -14 18 -10" stroke="#9fd0ff" stroke-width="3.4" fill="none" stroke-linecap="round" transform="rotate(${a} 30 20)"/>`).join("")}</g><circle cx="30" cy="20" r="3" fill="#e8f3ff"/></svg>`; }
function rainChanceIcon(p) {
  const n = Math.max(0, Math.min(5, Math.round((p || 0) / 20)));
  return `<svg viewBox="0 0 60 44" width="44" height="32"><defs><linearGradient id="rcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b6c6e0"/></linearGradient></defs>${cloud(30, 14, 0.55, "rcg")}${Array.from({ length: n }, (_, i) => `<line x1="${16 + i * 7}" y1="30" x2="${14 + i * 7}" y2="36" stroke="#7cc4ff" stroke-width="2.6" stroke-linecap="round" class="drop" style="animation-delay:${i * 0.2}s"/>`).join("")}</svg>`;
}
function gaugeIcon(inches) {
  const f = Math.max(0, Math.min(1, (inches || 0) / 1)), h = 26 * f;
  return `<svg viewBox="0 0 60 44" width="44" height="32"><rect x="22" y="6" width="16" height="32" rx="4" fill="rgba(220,235,255,.25)" stroke="#e8f3ff" stroke-width="1.6"/><rect x="24" y="${36 - h}" width="12" height="${h}" rx="2" fill="#4fa8ff" class="pulse" style="transform-origin:30px 36px"/>${[14, 20, 26, 32].map((y) => `<line x1="38" y1="${y}" x2="42" y2="${y}" stroke="#e8f3ff" stroke-width="1.2"/>`).join("")}<ellipse cx="30" cy="38" rx="10" ry="3" fill="#1d3a66"/></svg>`;
}
function garageSVG(state) {
  const I = mkIso(50, 34, 0.42), { P, poly, box } = I;
  const open = state === "open", moving = state === "opening" || state === "closing";
  let s = box(0, 0, 0, 100, 90, 56, "#e9eff8", { top: "#1d5c3d", right: "#d5dfee", left: "#bfcde2" });
  const door = [P(18, 90, 0), P(82, 90, 0), P(82, 90, 42), P(18, 90, 42)];
  s += poly(door, "#0f1c33");
  if (open) s += `<polygon points="${I.pts([P(18, 90, 0), P(82, 90, 0), P(82, 110, 0), P(18, 110, 0)])}" fill="#ffd57a" opacity=".35" class="glow"/>`;
  const dh = open ? 6 : 42;
  s += `<g class="${moving ? "doorbob" : ""}">` + poly([P(18, 90, 42 - dh), P(82, 90, 42 - dh), P(82, 90, 42), P(18, 90, 42)], "#d5dfee", 'stroke="#9fb3cf" stroke-width=".6"');
  if (!open) for (let z = 8; z < 42; z += 8) s += `<line x1="${P(18, 90, z)[0]}" y1="${P(18, 90, z)[1]}" x2="${P(82, 90, z)[0]}" y2="${P(82, 90, z)[1]}" stroke="#9fb3cf" stroke-width=".7"/>`;
  s += `</g>`;
  return `<svg viewBox="0 0 100 80" width="58" height="46">${s}</svg>`;
}
function vacSVG(state, batt) {
  const cleaning = state === "cleaning", ret = state === "returning", docked = state === "docked" || state === "charging", err = state === "error";
  const led = err ? "#ff5a5a" : cleaning ? "#5ef0a0" : docked ? (batt != null && batt < 100 ? "#ffc94a" : "#5ef0a0") : "#9fb3cf";
  const puck = `<g class="${cleaning ? "vroam" : ret ? "vret" : ""}">
    <ellipse cx="50" cy="56" rx="26" ry="10" fill="rgba(0,0,0,.35)"/>
    <path d="M24 46 v8 a26 10 0 0 0 52 0 v-8 Z" fill="#3a4f70"/>
    <ellipse cx="50" cy="46" rx="26" ry="10" fill="#eef3fa"/>
    <ellipse cx="50" cy="44" rx="8" ry="3.5" fill="#c9d6ea"/><ellipse cx="50" cy="42.5" rx="6" ry="2.5" fill="#2b3f5e"/>
    <circle cx="66" cy="47" r="1.8" fill="${led}" class="${docked || cleaning ? "pulse" : ""}" style="transform-origin:66px 47px"/>
    ${cleaning ? `<g transform="translate(30,56) scale(1,.4)"><g class="spinfast">${[0, 120, 240].map((a) => `<line x1="0" y1="0" x2="0" y2="-9" stroke="#9fb3cf" stroke-width="2" transform="rotate(${a})"/>`).join("")}</g></g>` : ""}</g>`;
  const dock = `<path d="M60 22 h22 v34 h-22 z" fill="#2b3f5e"/><path d="M60 22 l6 -4 h22 l-6 4 z" fill="#3e5880"/><path d="M82 22 l6 -4 v34 l-6 4 z" fill="#1d2d48"/><rect x="66" y="28" width="10" height="3" rx="1.5" fill="${docked ? "#5ef0a0" : "#6f86ad"}" class="${docked ? "pulse" : ""}"/>`;
  return `<svg viewBox="0 0 100 70" width="58" height="42">${dock}${docked ? `<g transform="translate(-6,0)">${puck}</g>` : puck}</svg>`;
}
function lightsSVG(on) {
  const cols = ["#ffd36b", "#ff8a6b", "#7fd0ff", "#9cf09a", "#ffd36b", "#c59bff", "#ff8a6b"];
  const bulbs = cols.map((c, i) => { const x = 8 + i * 14, y = 18 + Math.sin((i / 6) * Math.PI) * 12; return (on ? `<circle cx="${x}" cy="${y + 6}" r="7" fill="${c}" opacity=".45" class="twinkle" style="animation-delay:${i * 0.3}s"/>` : "") + `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 2}" stroke="#2b3f5e" stroke-width="1.6"/><ellipse cx="${x}" cy="${y + 6}" rx="3.4" ry="4.6" fill="${on ? c : "#6f7f99"}"/>`; }).join("");
  return `<svg viewBox="0 0 100 46" width="58" height="34"><path d="M2 14 Q 50 44 98 14" stroke="#2b3f5e" stroke-width="1.6" fill="none"/>${bulbs}</svg>`;
}
function washerSVG(running) {
  const I = mkIso(60, 30, 0.6), { P, box } = I;
  let s = box(0, 0, 0, 80, 70, 90, "#f1f5fb", { right: "#dfe7f3", left: "#c9d6ea", top: "#ffffff" });
  const [cx, cy] = P(40, 70, 45);
  s += `<g transform="translate(${cx},${cy}) skewY(-26.5) scale(.82,1)"><circle r="23" fill="#9fb3cf"/><circle r="19" fill="#1d2f52"/>
    <g class="${running ? "spinfast" : ""}" style="animation-duration:1.4s">${[0, 120, 240].map((a, i) => `<ellipse cx="0" cy="-9" rx="7" ry="4.5" fill="${["#ff8a6b", "#7fd0ff", "#ffd36b"][i]}" transform="rotate(${a})"/>`).join("")}</g>
    <circle r="19" fill="url(#wglass)"/></g>`;
  const [kx, ky] = P(66, 70, 80);
  s += `<circle cx="${kx}" cy="${ky}" r="3.4" fill="#9fb3cf"/><rect x="${P(10, 70, 82)[0]}" y="${P(10, 70, 82)[1] - 3}" width="16" height="4" rx="2" fill="#5ef0a0" class="${running ? "pulse" : ""}"/>`;
  return `<svg viewBox="0 0 120 120" width="76" height="76" class="${running ? "shake" : ""}"><defs><radialGradient id="wglass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#bfe3ff" stop-opacity=".08"/></radialGradient></defs>${s}</svg>`;
}
function binSVG(color, soon) {
  const I = mkIso(50, 26, 0.5), { box } = I;
  const c = color === "green" ? "#2f8a5a" : "#e8b730";
  return `<svg viewBox="0 -8 100 104" width="84" height="88" class="${soon ? "binhop" : "bob"}">${box(10, 10, 0, 70, 70, 80, c)}${`<g class="${soon ? "lid" : ""}">` + box(6, 6, 80, 78, 78, 8, shade(c, -15)) + `</g>`}${box(30, 80, 30, 30, 2, 20, "#ffffff")}</svg>`;
}
function calSVG(d) {
  const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `<svg viewBox="0 0 100 100" width="62" height="62"><rect x="14" y="20" width="76" height="72" rx="10" fill="#9fb3d1"/><rect x="10" y="16" width="76" height="72" rx="10" fill="#fff"/><path d="M10 26 a10 10 0 0 1 10 -10 h56 a10 10 0 0 1 10 10 v10 h-76 Z" fill="#e0454f"/><text x="48" y="32" font-size="11" text-anchor="middle" fill="#fff" font-weight="800">${mon}</text><text x="48" y="74" font-size="34" text-anchor="middle" fill="#1d2d48" font-weight="800">${d.getDate()}</text><rect x="26" y="9" width="6" height="14" rx="3" fill="#41557a"/><rect x="64" y="9" width="6" height="14" rx="3" fill="#41557a"/></svg>`;
}
function sunArc(sun, now) {
  if (!sun) return "";
  const nr = new Date(sun.attributes.next_rising), ns = new Date(sun.attributes.next_setting);
  const day = sun.state === "above_horizon";
  const start = day ? new Date(nr.getTime() - 864e5) : new Date(ns.getTime() - 864e5), end = day ? ns : nr;
  const f = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const W = 270, H = 40, cx = W / 2, r = 104, y0 = 38;
  const a = Math.PI * (1 - f), x = cx + Math.cos(a) * r, y = y0 - Math.sin(a) * r * 0.3;
  const tf = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const body = day ? `<circle cx="${x}" cy="${y}" r="13" fill="#ffd25e" opacity=".35" class="pulse" style="transform-origin:${x}px ${y}px"/><circle cx="${x}" cy="${y}" r="8" fill="#ffd25e"/>` : `<circle cx="${x}" cy="${y}" r="8" fill="#e8eefb"/><circle cx="${x + 3.5}" cy="${y - 2.5}" r="7" fill="#132c55"/>`;
  return `<svg viewBox="0 0 ${W} ${H + 14}" width="${W}" height="${H + 14}"><path d="M ${cx - r} ${y0} A ${r} ${r * 0.3} 0 0 1 ${cx + r} ${y0}" stroke="${day ? "#ffcf6b" : "#8fa7cc"}" stroke-width="2" stroke-dasharray="4 5" fill="none" opacity=".7"/>
    <line x1="${cx - r - 8}" y1="${y0}" x2="${cx + r + 8}" y2="${y0}" stroke="#4d6d9c" stroke-width="2"/>${body}
    <text x="${cx - r}" y="${y0 + 13}" font-size="11" fill="#b9cbe6" text-anchor="middle" font-weight="800">🌅 ${tf(day ? new Date(nr.getTime() - 864e5) : ns)}</text>
    <text x="${cx + r}" y="${y0 + 13}" font-size="11" fill="#b9cbe6" text-anchor="middle" font-weight="800">${day ? "🌇 " + tf(ns) : "🌅 " + tf(nr)}</text></svg>`;
}
/* ---------- 3D mower panel ---------- */
function mowerModel(cx, cy, k = 1) {
  return `<g transform="translate(${cx},${cy}) scale(${k})">
    <ellipse cx="0" cy="9" rx="24" ry="8" fill="rgba(0,0,0,.35)"/>
    <ellipse cx="-14" cy="5" rx="5" ry="6" fill="#1d2433"/><ellipse cx="14" cy="5" rx="5" ry="6" fill="#1d2433"/>
    <path d="M -22 4 Q -24 -10 -8 -14 L 10 -14 Q 24 -10 22 4 Q 0 12 -22 4 Z" fill="#3d4352"/>
    <path d="M -20 0 Q -21 -11 -7 -15 L 9 -15 Q 21 -11 20 0 Q 0 7 -20 0 Z" fill="#e9eef5"/>
    <path d="M -12 -12 Q 0 -17 12 -12 L 10 -8 Q 0 -11 -10 -8 Z" fill="#ff7a2f"/>
    <rect x="-3" y="-21" width="6" height="7" rx="2" fill="#3d4352"/><circle cx="0" cy="-21" r="2" fill="#ff4d4d"/>
    <ellipse cx="-17" cy="-2" rx="2" ry="1.4" fill="#ffd36b" class="h3dk"/></g>`;
}
function mowerSVG(state, charging) {
  const I = mkIso(170, 66, 1.45), { P, poly, box, pts } = I;
  const mowing = state === "mowing", returning = state === "returning", docked = state === "docked", err = state === "error";
  let s = `<defs><filter id="mw" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
  const [sx, sy] = P(50, 50, -30);
  s += `<ellipse cx="${sx}" cy="${sy + 22}" rx="150" ry="38" fill="rgba(0,0,0,.35)" filter="url(#mw)"/>`;
  s += box(0, 0, -14, 100, 100, 14, "#3c6aa8", { top: "#4f8a76", right: "#2b5288", left: "#1f3f6c" });
  for (let i = 0; i < 10; i++) s += poly([P(i * 10, 4, 0.2), P(i * 10 + 10, 4, 0.2), P(i * 10 + 10, 96, 0.2), P(i * 10, 96, 0.2)], i % 2 ? "#5a9a82" : "#4b866f");
  s += `<polygon points="${pts([P(3, 3, 0.4), P(97, 3, 0.4), P(97, 97, 0.4), P(3, 97, 0.4)])}" fill="none" stroke="#ffd36b" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>`;
  const tree = (x, y, h, c = "#2f7a5b") => { const [bx, by] = P(x, y, 6), [tx, ty] = P(x, y, h); return box(x - 1.5, y - 1.5, 0, 3, 3, 8, "#7a5a44") + `<g class="tsway" style="transform-origin:${bx}px ${by}px"><polygon points="${bx - 15},${by} ${tx},${ty} ${bx},${by + 6}" fill="${shade(c, 12)}"/><polygon points="${bx},${by + 6} ${tx},${ty} ${bx + 15},${by}" fill="${shade(c, -18)}"/></g>`; };
  s += tree(90, 8, 34) + tree(8, 90, 30, "#2a6e52");
  [[70, 92], [76, 94], [94, 60], [92, 70]].forEach(([x, y], i) => { const [fx, fy] = P(x, y, 1); s += `<circle cx="${fx}" cy="${fy}" r="2.4" fill="${["#ff8a6b", "#ffd36b", "#c59bff", "#ff8a6b"][i]}"/>`; });
  s += box(2, 36, 0, 8, 22, 4, "#2b3f5e") + box(2, 52, 4, 6, 6, 16, "#3a4f70", { top: "#4d6688" });
  const [lx, ly] = P(8, 55, 16);
  s += `<circle cx="${lx}" cy="${ly}" r="2.2" fill="${docked || charging ? "#5ef0a0" : "#6f86ad"}" class="${charging ? "pulse" : ""}" style="transform-origin:${lx}px ${ly}px"/>`;
  const [dx, dy] = P(10, 46, 0);
  if (mowing) {
    const path = [[18, 12], [88, 12], [88, 26], [18, 26], [18, 40], [88, 40], [88, 54], [20, 54], [20, 68], [88, 68], [88, 82], [20, 82]].map(([x, y]) => P(x, y, 0));
    s += `<g>${mowerModel(0, 0)}${[0, 1, 2, 3].map((i) => `<circle cx="${-10 + i * 6}" cy="6" r="1.4" fill="#9ce0b0" class="clip" style="animation-delay:${i * 0.25}s"/>`).join("")}<animateMotion dur="40s" repeatCount="indefinite" path="M ${path.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ")} Z"/></g>`;
  } else if (returning) {
    const a = P(70, 60, 0);
    s += `<g>${mowerModel(0, 0)}<animateMotion dur="8s" repeatCount="indefinite" path="M ${a[0]} ${a[1]} L ${dx + 22} ${dy}"/></g>`;
  } else if (docked) {
    s += mowerModel(dx + 16, dy - 2) + (charging ? `<text x="${dx + 30}" y="${dy - 26}" font-size="18" class="pulse" style="transform-origin:${dx + 34}px ${dy - 32}px">⚡</text>` : "");
  } else {
    const [mx, my] = P(52, 52, 0);
    s += mowerModel(mx, my) + (err ? `<path d="M ${mx} ${my - 46} l 12 20 h -24 z" fill="#ff6a5a" class="pulse" style="transform-origin:${mx}px ${my - 36}px"/><text x="${mx}" y="${my - 30}" font-size="13" text-anchor="middle" fill="#fff" font-weight="900">!</text>`
      : `<g class="zz"><text x="${mx + 14}" y="${my - 30}" font-size="16" fill="#cfe0f5" font-weight="900">z</text><text x="${mx + 24}" y="${my - 42}" font-size="12" fill="#cfe0f5" font-weight="900">z</text></g>`);
  }
  return `<svg viewBox="0 0 340 216" width="340" height="216">${s}</svg>`;
}

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + "m " : ""}ago` : `${Math.floor(m / 1440)}d ago`;
};
const cap = (s) => (s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const CSS = `
:host{display:block}*{box-sizing:border-box}
.outer{width:100%;display:flex;justify-content:center;overflow:hidden;background:#0a1a33}
.stage{position:relative;width:960px;height:540px;transform-origin:top left;font-family:Nunito,"Varela Round","Segoe UI",system-ui,sans-serif;color:#eef4ff;overflow:hidden;
  background:radial-gradient(520px 380px at 18% 30%,#21508c 0%,rgba(33,80,140,0) 70%),radial-gradient(520px 360px at 85% 90%,#1a5f8c 0%,rgba(26,95,140,0) 70%),radial-gradient(900px 600px at 40% 10%,#183a6c 0%,#0f2547 55%,#0a1a33 100%)}
.abs{position:absolute}
.clock{left:16px;top:2px;font-size:66px;font-weight:900;letter-spacing:-1.5px;line-height:1.05;
  text-shadow:0 1px 0 #c9d8ee,0 2px 0 #a3b8d8,0 3px 0 #7b96c0,0 4px 0 #5677a8,0 8px 12px rgba(0,0,0,.55)}
.clock small{font-size:20px;margin-left:5px;letter-spacing:0;text-shadow:0 2px 0 #7b96c0,0 4px 8px rgba(0,0,0,.5)}
.date{left:20px;top:76px;font-size:13px;font-weight:800;color:#b9cbe6}
.house{left:4px;top:86px;width:290px;height:242px}
.housesvg{width:290px;height:242px;filter:drop-shadow(0 12px 12px rgba(0,0,0,.35));animation:hf 7s ease-in-out infinite}
.wx{left:186px;top:84px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.4))}
.precip{position:absolute;left:20px;top:150px;width:260px;height:170px;overflow:hidden;pointer-events:none;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 55%,transparent 75%)}
.precip i{position:absolute;top:-14px;width:1.5px;height:10px;background:linear-gradient(rgba(207,233,255,0),#9fd3ff);animation:rain 1s linear infinite}
.precip i.sn{width:5px;height:5px;border-radius:50%;background:#fff;animation:snow 4s linear infinite}
@keyframes rain{to{transform:translateY(200px)}}@keyframes snow{50%{transform:translate(8px,100px)}100%{transform:translate(-4px,200px)}}
.summary{left:14px;top:326px;width:274px;padding:7px 10px;border-radius:14px;background:linear-gradient(160deg,rgba(45,92,153,.55),rgba(20,47,88,.55));box-shadow:0 5px 0 rgba(10,25,50,.6),0 10px 16px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.12)}
.summary .s1{font-size:12.5px;font-weight:800;line-height:1.2}
.summary .s2{font-size:12px;font-weight:900;color:#ffd36b;margin-top:3px}
.tvset{left:12px;top:392px;width:278px;height:144px;perspective:600px}
.tvbox{position:absolute;inset:0;border-radius:16px;background:linear-gradient(160deg,#3b6aa8,#1e3f6e);box-shadow:0 7px 0 #142d52,0 14px 22px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.18);transform:rotateY(5deg);transform-origin:left center}
.tvscreen{position:absolute;left:9px;top:8px;width:216px;height:122px;border-radius:10px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 3px #0c1830,inset 0 0 18px rgba(0,0,0,.8)}
.tvscreen iframe{border:0;width:216px;height:122px;display:block}
.tvscreen:after{content:"";position:absolute;inset:0;background:linear-gradient(130deg,rgba(255,255,255,.14),rgba(255,255,255,0) 40%);pointer-events:none}
.knobs{position:absolute;right:10px;top:14px;display:flex;flex-direction:column;gap:10px;align-items:center}
.knob{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#eef4ff,#8ea3c4 60%,#4d6688);box-shadow:0 3px 0 #0f2140}
.knob:before{content:"";display:block;width:3px;height:10px;margin:3px auto 0;border-radius:2px;background:#2b3f5e}
.knob.k1{animation:kn 9s ease-in-out infinite}.grill{width:30px;height:30px;border-radius:6px;background:repeating-linear-gradient(0deg,#16305a 0 3px,#2d5591 3px 6px)}
@keyframes kn{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(40deg)}}
/* middle */
.hdr{top:8px;font-size:11.5px;color:#a9bfdf;font-weight:800}
.big{top:20px;font-size:50px;font-weight:900;line-height:1;text-shadow:0 1px 0 #c9d8ee,0 2px 0 #a3b8d8,0 3px 0 #7b96c0,0 6px 10px rgba(0,0,0,.5)}
.hilo{top:22px;font-size:11px;font-weight:800;color:#b9cbe6;text-align:right;line-height:1.3}
.hilo b{color:#ffd36b;font-size:14px}
.row{display:flex;justify-content:space-between}
.g{width:90px;display:flex;flex-direction:column;align-items:center;position:relative}
.g .top{height:58px;display:flex;align-items:flex-end;justify-content:center;z-index:2}
.g .ped{position:absolute;top:46px}
.g .v{margin-top:16px;font-size:13.5px;font-weight:900;z-index:2;white-space:nowrap}
.g .l{font-size:9px;font-weight:800;color:#9fb5d6;letter-spacing:.6px}
.sock-wrap{position:relative;width:70px;height:58px;perspective:260px}
.sock-pole{position:absolute;left:33px;top:4px;width:3px;height:54px;border-radius:2px;background:linear-gradient(90deg,#8ea3c4,#eef4ff,#8ea3c4)}
.sock-rot{position:absolute;left:35px;top:6px;width:0;height:0;transform-style:preserve-3d;transition:transform 2.5s}
.sock-droop{position:absolute;left:0;top:-16px;transform-origin:0 16px;transform-style:preserve-3d}
.sock{display:block;transform-origin:0 16px;animation:flap 1s ease-in-out infinite alternate}
@keyframes flap{0%{transform:skewY(-4deg) scaleX(.96)}100%{transform:skewY(4deg) scaleX(1.03)}}
.chips{display:flex;justify-content:space-between}
.chip{width:64px;height:82px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:linear-gradient(160deg,#2d5c99,#1d4277);box-shadow:0 5px 0 #13305a,0 10px 14px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15)}
.chip .v{font-size:14px;font-weight:900;margin-top:2px;white-space:nowrap}.chip .l{font-size:8px;font-weight:800;color:#a9bfdf;letter-spacing:.2px;white-space:nowrap}
.chip.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 5px 0 #b97a22,0 10px 18px rgba(255,190,80,.3),inset 0 1px 0 rgba(255,255,255,.5)}
.chip.on .l{color:#5a3a10}.chip.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 5px 0 #1f6ea3,0 10px 18px rgba(90,200,255,.3)}
.chip.cool .l{color:#0b3c5d}
.washer{display:flex;align-items:center;gap:8px;height:82px;border-radius:14px;padding:0 10px;background:linear-gradient(160deg,#2d5c99,#1d4277);box-shadow:0 5px 0 #13305a,0 10px 14px rgba(0,0,0,.35)}
.washer .wt{font-size:17px;font-weight:900}.washer .ws{font-size:12px;font-weight:800;color:#a9bfdf}
.washer .bar{height:8px;border-radius:4px;background:rgba(0,0,0,.25);margin-top:6px;overflow:hidden;width:150px}.washer .bar i{display:block;height:100%;background:linear-gradient(90deg,#7fe0ff,#5ef0a0);border-radius:4px;transition:width 2s}
.fc{display:flex;justify-content:space-between}
.fd{width:88px;display:flex;flex-direction:column;align-items:center;position:relative}
.fd .ic{height:42px;display:flex;align-items:flex-end;z-index:2}.fd .ped{position:absolute;top:30px}
.fd .dn{margin-top:20px;font-size:11px;font-weight:800;color:#b9cbe6}.fd .tp{font-size:15px;font-weight:900}.fd .tp small{font-size:11px;color:#9fb5d6;margin-left:3px}
/* right panel */
.panel{left:590px;top:10px;width:362px;height:522px;perspective:1100px}
.pbox{position:absolute;inset:0;border-radius:22px;background:linear-gradient(160deg,#22497f,#132d55);box-shadow:0 8px 0 #0d2142,0 18px 30px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.12);transform:rotateY(-4deg);transform-origin:right center;overflow:hidden}
.ph{display:flex;align-items:center;gap:8px;height:42px;padding:0 14px;font-size:17px;font-weight:900;border-bottom:1px solid rgba(255,255,255,.07)}
.ph ha-icon{--mdc-icon-size:22px;color:#ffd36b}
.dots{margin-left:auto;display:flex;gap:4px}.dots i{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.22);transition:all .4s}.dots i.on{width:16px;background:#ffd36b}
.pc{position:absolute;left:0;right:0;top:42px;bottom:0;padding:10px}
.pin{animation:pin .7s cubic-bezier(.2,1.2,.4,1)}
@keyframes pin{0%{opacity:0;transform:translateX(30px) rotateY(-14deg)}100%{opacity:1;transform:none}}
.photo{position:absolute;inset:10px;border-radius:14px;overflow:hidden;background:#0b1730;box-shadow:inset 0 0 0 4px #e9eff8,0 8px 16px rgba(0,0,0,.4)}
.photo img{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);object-fit:contain;opacity:0;transition:opacity 1.2s}
.photo img.show{opacity:1;animation:kb 15s ease-out forwards}
.photo .bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(18px) brightness(.55);transform:scale(1.2);transition:background-image 1s}
@keyframes kb{0%{transform:scale(1)}100%{transform:scale(1.06)}}
.emb{width:100%;transform-origin:top left}
.emb > *{display:block;margin-bottom:10px}
.home{display:flex;flex-direction:column;gap:10px}
.bins{display:flex;justify-content:space-around}
.bin{display:flex;flex-direction:column;align-items:center}
.bin .n{font-size:14px;font-weight:900;margin-top:4px}.bin .d{font-size:12px;font-weight:800;color:#a9bfdf}
.bin .d.soon{color:#ffd36b}
.feed h3{margin:4px 0 6px;font-size:15px;font-weight:900}
.fi{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;margin-bottom:5px;background:rgba(255,255,255,.06);font-size:13px;font-weight:800}
.fi .tm{min-width:66px;color:#cfe0f5}.fi .am{margin-left:auto;color:#a9bfdf}
.fi.done{opacity:.5}.fi.next{background:linear-gradient(90deg,rgba(255,211,107,.35),rgba(255,211,107,.08));box-shadow:0 0 0 1px rgba(255,211,107,.5)}
.fi .ck{width:18px;text-align:center}
.shows .ev{display:flex;gap:10px;align-items:center;padding:7px 9px;border-radius:12px;margin-bottom:7px;background:rgba(255,255,255,.06)}
.shows .ev .day{width:44px;text-align:center;flex:none;border-radius:9px;padding:3px 0;background:#2d5c99;box-shadow:0 3px 0 #13305a}
.shows .ev .day b{display:block;font-size:17px;font-weight:900;line-height:1.1}.shows .ev .day span{font-size:9px;font-weight:800;color:#cfe0f5}
.shows .ev .t{font-size:11px;color:#9fb5d6;font-weight:800}.shows .ev .s{font-size:13.5px;font-weight:900;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:262px}
.shows .ev.today .day{background:#ffd36b;color:#3a2408;box-shadow:0 3px 0 #b97a22}
.ped{display:block}
.mow{display:flex;flex-direction:column;align-items:center;gap:6px}
.mow svg{filter:drop-shadow(0 10px 12px rgba(0,0,0,.35))}
.mstats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;width:100%}
.ms{border-radius:12px;padding:7px 8px;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ms .v{font-size:15px;font-weight:900;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ms .l{font-size:8px;font-weight:800;color:#a9bfdf;letter-spacing:.2px;white-space:nowrap}
.ms .meter{height:6px;border-radius:3px;background:rgba(0,0,0,.3);margin-top:4px;overflow:hidden}.ms .meter i{display:block;height:100%;background:linear-gradient(90deg,#5ef0a0,#7fe0ff);border-radius:3px}
.ms.bad{background:linear-gradient(160deg,#ff8a7a,#e0524a)}
.mhead{font-size:20px;font-weight:900}.mhead small{font-size:13px;color:#a9bfdf;font-weight:800;margin-left:6px}
.clip{animation:clip .9s ease-out infinite}@keyframes clip{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(-8px,-10px)}}
.zz{animation:hf 3s ease-in-out infinite}
.h3dk{animation:tw 1.4s ease-in-out infinite}
/* anims */
@keyframes hf{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.bob{animation:hf 4s ease-in-out infinite}
.rays{animation:spin 18s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.spinslow{animation:spin 3s linear infinite}.spinfast{animation:spin .5s linear infinite}
.pulse{animation:pulse 2.6s ease-in-out infinite}@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.75}}
.float{animation:hf 5s ease-in-out infinite}
.twinkle{animation:tw 2.4s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}
.drift{animation:dr 7s ease-in-out infinite alternate}.drift2{animation:dr 9s ease-in-out infinite alternate-reverse}@keyframes dr{0%{transform:translateX(-6px)}100%{transform:translateX(8px)}}
.drop{animation:df 1s linear infinite}@keyframes df{0%{transform:translateY(-6px);opacity:0}30%{opacity:1}100%{transform:translateY(16px);opacity:0}}
.flake{animation:fk 2.4s linear infinite}@keyframes fk{0%{transform:translate(0,-8px);opacity:0}30%{opacity:1}100%{transform:translate(5px,24px);opacity:0}}
.flash{animation:fl 2.6s steps(1) infinite}@keyframes fl{0%,100%{opacity:0}8%,14%{opacity:1}11%{opacity:.2}}
.fog{animation:fg 4s ease-in-out infinite alternate}@keyframes fg{0%{transform:translateX(-6px);opacity:.6}100%{transform:translateX(6px);opacity:1}}
.glow{animation:gl 3.5s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.25}50%{opacity:.5}}
.flicker{animation:fli 5s ease-in-out infinite}@keyframes fli{0%,100%{opacity:1}45%{opacity:.82}55%{opacity:.88}}
.tsway{animation:ts 5s ease-in-out infinite}@keyframes ts{0%,100%{transform:skewX(-2deg)}50%{transform:skewX(2deg)}}
.smoke{animation:sm 4s ease-out infinite}@keyframes sm{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:.7}100%{opacity:0;transform:translate(14px,-46px) scale(2)}}
.wave{animation:wv 2.4s linear infinite}@keyframes wv{to{transform:translateX(40px)}}
.needle{animation:nd 3s ease-in-out infinite}@keyframes nd{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
.windl{stroke-dasharray:60;animation:wl 2s ease-in-out infinite}@keyframes wl{0%{stroke-dashoffset:60;opacity:0}40%{opacity:1}100%{stroke-dashoffset:-60;opacity:0}}
.vroam{animation:vr 6s ease-in-out infinite}@keyframes vr{0%,100%{transform:translate(-10px,2px)}25%{transform:translate(4px,-3px)}50%{transform:translate(8px,3px)}75%{transform:translate(-4px,5px)}}
.vret{animation:vt 3s ease-in-out infinite alternate}@keyframes vt{to{transform:translateX(8px)}}
.doorbob{animation:hf 1.2s ease-in-out infinite}
.shake{animation:sh .25s linear infinite}@keyframes sh{0%,100%{transform:translate(0,0)}25%{transform:translate(.6px,-.4px)}75%{transform:translate(-.6px,.4px)}}
.binhop{animation:bh 2.2s ease-in-out infinite}@keyframes bh{0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}55%{transform:translateY(0)}}
.lid{animation:ld 2.2s ease-in-out infinite;transform-origin:50px 30px}@keyframes ld{0%,100%{transform:translateY(0)}40%{transform:translateY(-5px) rotate(-4deg)}}
`;

class TV3DCard extends HTMLElement {
  setConfig(c) { this._cfg = Object.assign({}, TV, c || {}); this._E = defaultEmbeds(this._cfg); this._sig = {}; this._emb = {}; }
  getCardSize() { return 12; }
  static getStubConfig() { return {}; }

  connectedCallback() {
    if (!document.getElementById("h3d-font")) {
      const l = document.createElement("link"); l.id = "h3d-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap";
      document.head.appendChild(l);
    }
    this._tick = setInterval(() => this._clock(), 1000);
    this._slow = setInterval(() => { this._sig.sun = null; this._sig.st = null; this._update(); }, 60000);
    this._evT = setInterval(() => this._loadEvents(), 15 * 60000);
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    window.addEventListener("resize", (this._wr = () => this._fit()));
    if (this._hass) this._subs();
  }
  disconnectedCallback() {
    clearInterval(this._tick); clearInterval(this._slow); clearInterval(this._evT);
    this._ro && this._ro.disconnect(); window.removeEventListener("resize", this._wr);
    for (const k of ["_unFc", "_unFeed"]) if (this[k]) { this[k].then((u) => u && u()).catch(() => {}); this[k] = null; }
  }
  set hass(h) {
    this._hass = h;
    if (!this._built) this._build();
    if (this.isConnected) this._subs();
    if (!this._evLoaded) { this._evLoaded = true; this._loadEvents(); }
    this._update();
  }
  _subs() {
    const c = this._hass && this._hass.connection; if (!c) return;
    if (!this._unFc) { this._unFc = c.subscribeMessage((m) => { this._fcast = m.forecast || []; this._sig.fc = null; this._update(); }, { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: this._cfg.weather }); this._unFc.catch(() => (this._unFc = null)); }
    if (!this._unFeed && this._cfg.feeder_schedule_template) { this._unFeed = c.subscribeMessage((m) => { try { this._feed = typeof m.result === "string" ? JSON.parse(m.result) : (Array.isArray(m.result) ? m.result : []); } catch (e) { this._feed = []; } this._sig.home = null; this._update(); }, { type: "render_template", template: this._cfg.feeder_schedule_template }); this._unFeed.catch(() => (this._unFeed = null)); }
  }
  _st(e) { return this._hass && this._hass.states[e]; }
  _s(e) { const s = this._st(e); return s ? s.state : "unavailable"; }
  _n(e, a) { const s = this._st(e); if (!s) return NaN; return parseFloat(a ? s.attributes[a] : s.state); }

  _build() {
    this._built = true;
    const r = this.attachShadow({ mode: "open" });
    r.innerHTML = `<style>${CSS}</style><div class="outer"><div class="stage">
      <div class="abs clock"></div><div class="abs date"></div>
      <div class="abs house"></div><div class="precip"></div><div class="abs wx"></div>
      <div class="abs summary"><div class="s1"></div><div class="s2"></div></div>
      <div class="abs tvset"><div class="tvbox"><div class="tvscreen">${this._cfg.weatherstar ? `<iframe src="${this._cfg.weatherstar}" scrolling="no"></iframe>` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#7fa3d6;font-weight:900;letter-spacing:.1em;font-size:14px">NO SIGNAL</div>`}</div>
        <div class="knobs"><div class="knob k1"></div><div class="knob"></div><div class="grill"></div></div></div></div>
      <div class="abs hdr" style="left:302px">Outside · <span class="cond"></span></div>
      <div class="abs big out" style="left:298px"></div>
      <div class="abs hilo" style="left:470px;width:108px"></div>
      <div class="abs row gauges" style="left:298px;top:86px;width:282px">
        <div class="g"><div class="top g-h"></div>${pedestal(76, 30)}<div class="v v-h"></div><div class="l">HUMIDITY</div></div>
        <div class="g"><div class="top g-b"></div>${pedestal(76, 30)}<div class="v v-b"></div><div class="l">PRESSURE</div></div>
        <div class="g"><div class="top g-w"></div>${pedestal(76, 30)}<div class="v v-w"></div><div class="l">WIND</div></div>
      </div>
      <div class="abs mid1" style="left:300px;top:198px;width:278px"></div>
      <div class="abs sunarc" style="left:302px;top:288px"></div>
      <div class="abs chips status" style="left:300px;top:344px;width:278px"></div>
      <div class="abs fc" style="left:296px;top:436px;width:286px"></div>
      <div class="abs panel"><div class="pbox"><div class="ph"><ha-icon></ha-icon><span class="pt"></span><div class="dots"></div></div><div class="pc"></div></div></div>
    </div></div>`;
    this._$ = (s) => r.querySelector(s);
    this._clock(); this._fit();
    this._helpers = window.loadCardHelpers ? window.loadCardHelpers() : null;
  }
  _fit() {
    if (!this._built) return;
    const stage = this._$(".stage"), outer = this._$(".outer");
    const w = this.clientWidth || this.getBoundingClientRect().width || 960;
    const top = Math.max(0, this.getBoundingClientRect().top);
    const k = Math.min(w / 960, Math.max(200, window.innerHeight - top) / 540);
    stage.style.transform = `scale(${k})`; outer.style.height = 540 * k + "px";
    stage.style.marginRight = 960 * k - 960 + "px"; stage.style.marginBottom = 540 * k - 540 + "px";
  }
  _clock() {
    if (!this._built) return;
    const d = new Date(); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    const t = `${h}:${String(d.getMinutes()).padStart(2, "0")}<small>${ap}</small>`;
    if (this._lt !== t) { this._lt = t; this._$(".clock").innerHTML = t; }
    const ds = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (this._ld !== ds) { this._ld = ds; this._$(".date").textContent = ds; }
  }
  async _loadEvents() {
    if (!this._hass) return;
    const s = new Date(), e = new Date(Date.now() + 8 * 864e5); let all = [];
    for (const c of this._cfg.calendars) {
      try {
        const ev = await this._hass.callApi("GET", `calendars/${c}?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`);
        all = all.concat(ev.map((x) => ({ s: x.summary, t: new Date(x.start.dateTime || x.start.date + "T00:00:00"), ad: !x.start.dateTime })));
      } catch (er) { /* ignore */ }
    }
    all.sort((a, b) => a.t - b.t);
    this._events = all.filter((x) => x.t > Date.now() - 3 * 3600e3).slice(0, 7);
    this._sig.shows = null; this._update();
  }

  _update() {
    if (!this._built || !this._hass) return;
    const C = this._cfg, W = this._st(C.weather), A = W ? W.attributes : {}, sun = this._st(C.sun);
    const night = sun ? sun.state === "below_horizon" : false;
    const outT = !isNaN(this._n(C.outside_temp)) ? this._n(C.outside_temp) : A.temperature;
    const cond = W ? W.state : "";
    const gstate = this._s(C.garage), gopen = gstate !== "closed";
    // header
    const hi = this._n(C.high), lo = this._n(C.low), rc = this._n(C.rain_chance);
    const sH = [Math.round(outT), cond, Math.round(hi), Math.round(lo), Math.round(rc)].join();
    if (this._sig.h !== sH) {
      this._sig.h = sH;
      this._$(".out").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°";
      this._$(".cond").textContent = cap((cond || "").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " "));
      this._$(".hilo").innerHTML = `High <b>${isNaN(hi) ? "--" : Math.round(hi)}°</b><br>Low <b>${isNaN(lo) ? "--" : Math.round(lo)}°</b><br>Rain <b>${isNaN(rc) ? "--" : Math.round(rc)}%</b>`;
    }
    // summary
    let sum = this._s(C.summary); if (["unknown", "unavailable"].includes(sum)) sum = this._s(C.summary_alt);
    const sS = sum + hi + lo + rc;
    if (this._sig.sum !== sS) {
      this._sig.sum = sS;
      this._$(".summary .s1").textContent = sum;
      this._$(".summary .s2").textContent = `High ${isNaN(hi) ? "--" : Math.round(hi)}° · Low ${isNaN(lo) ? "--" : Math.round(lo)}° · Rain ${isNaN(rc) ? "--" : Math.round(rc)}%`;
    }
    // house
    const cold = !isNaN(outT) && outT < 50, sW = [cond, night, cold, gopen].join();
    if (this._sig.w !== sW) {
      this._sig.w = sW;
      this._$(".house").innerHTML = houseSVG(night, cold, gopen);
      this._$(".wx").innerHTML = weatherSVG(cond, night, 92);
      const rainy = ["rainy", "pouring", "lightning-rainy"].includes(cond), snowy = ["snowy", "snowy-rainy"].includes(cond);
      this._$(".precip").innerHTML = rainy ? Array.from({ length: 26 }, () => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random()}s;animation-duration:${0.6 + Math.random() * 0.5}s"></i>`).join("")
        : snowy ? Array.from({ length: 22 }, () => `<i class="sn" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s"></i>`).join("") : "";
    }
    // gauges (weather entity)
    const sG = [A.humidity, A.pressure, A.wind_speed, A.wind_bearing].join();
    if (this._sig.g !== sG) {
      this._sig.g = sG;
      this._$(".g-h").innerHTML = dropSVG(A.humidity); this._$(".v-h").textContent = A.humidity != null ? Math.round(A.humidity) + "%" : "--";
      this._$(".g-b").innerHTML = baroSVG(+A.pressure || 29.92, A.pressure_unit); this._$(".v-b").textContent = A.pressure != null ? (+A.pressure).toFixed(2) + " in" : "--";
      this._$(".g-w").innerHTML = sockHTML(+A.wind_speed || 0, +A.wind_bearing || 0);
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      this._$(".v-w").textContent = A.wind_speed != null ? `${Math.round(A.wind_speed)} mph ${dirs[Math.round(((+A.wind_bearing || 0) % 360) / 45) % 8]}` : "--";
    }
    // middle row: washer when running, else the 4 weather chips
    const run = this._s(C.washer) === "Run";
    const wl = this._n(C.washer_left), sub = this._s(C.washer_sub);
    const ws = this._n(C.wind), gu = this._n(C.gust), rt = this._n(C.rain_today);
    const sM = run ? ["w", sub, Math.round(wl / 60)].join() : ["c", ws, gu, rc, rt].join();
    if (this._sig.m !== sM) {
      const was = this._sig.m && this._sig.m[0];
      this._sig.m = sM;
      const el = this._$(".mid1");
      if (run) {
        if (!this._wTotal || was !== "w") this._wTotal = Math.max(wl || 0, 60);
        if (wl > this._wTotal) this._wTotal = wl;
        const left = wl > 0 ? (wl >= 3600 ? Math.floor(wl / 3600) + "h " : "") + Math.round((wl % 3600) / 60) + "m left" : "Finishing…";
        const pct = this._wTotal ? Math.round(100 * (1 - (wl || 0) / this._wTotal)) : 0;
        el.innerHTML = `<div class="washer">${washerSVG(true)}<div><div class="wt">Washer / Dryer</div><div class="ws">${sub && !["---", "unknown", "unavailable"].includes(sub) ? cap(sub) + " · " : ""}${left}</div><div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
      } else {
        const f = (v, d = 0) => (isNaN(v) ? "--" : v.toFixed(d));
        el.innerHTML = `<div class="chips">
          <div class="chip">${windIcon()}<div class="v">${f(ws)} mph</div><div class="l">WIND</div></div>
          <div class="chip">${gustIcon()}<div class="v">${f(gu)} mph</div><div class="l">GUSTS</div></div>
          <div class="chip">${rainChanceIcon(rc)}<div class="v">${f(rc)}%</div><div class="l">RAIN ODDS</div></div>
          <div class="chip">${gaugeIcon(rt)}<div class="v">${f(rt, 2)}"</div><div class="l">RAIN TODAY</div></div></div>`;
      }
    }
    // sun arc (refreshed every minute by _slow)
    const sSun = sun ? sun.state + sun.attributes.next_rising + sun.attributes.next_setting + Math.floor(Date.now() / 300000) : "";
    if (this._sig.sun !== sSun) { this._sig.sun = sSun; this._$(".sunarc").innerHTML = sunArc(sun, new Date()); }
    // status row
    const gs = this._st(C.garage);
    const vm = this._s(C.vac_main), vb = this._s(C.vac_bed), li = this._s(C.lights);
    const bm = this._n(C.vac_main_batt), bb = this._n(C.vac_bed_batt);
    const sSt = [gstate, gs && gs.last_changed, vm, vb, li, bm, bb, Math.floor(Date.now() / 60000)].join();
    if (this._sig.st !== sSt) {
      this._sig.st = sSt;
      const vtxt = (s, b) => (s === "cleaning" ? "Cleaning" : s === "docked" ? (b < 100 ? `Charging ${b}%` : "Docked") : cap(s));
      this._$(".status").innerHTML = `
        <div class="chip ${gopen ? "on" : ""}">${garageSVG(gstate)}<div class="v" style="font-size:12px">${cap(gstate)}</div><div class="l">${gs ? ago(gs.last_changed) : ""}</div></div>
        <div class="chip ${vm === "cleaning" ? "cool" : ""}">${vacSVG(vm, bm)}<div class="v" style="font-size:11px">${vtxt(vm, bm)}</div><div class="l">MAIN VAC</div></div>
        <div class="chip ${vb === "cleaning" ? "cool" : ""}">${vacSVG(vb, bb)}<div class="v" style="font-size:11px">${vtxt(vb, bb)}</div><div class="l">BED VAC</div></div>
        <div class="chip ${li === "on" ? "on" : ""}">${lightsSVG(li === "on")}<div class="v" style="font-size:12px">${li === "on" ? "On" : "Off"}</div><div class="l">BACKYARD</div></div>`;
    }
    // forecast
    const fc = (this._fcast || []).slice(0, 3);
    const sF = JSON.stringify(fc.map((f) => [f.condition, Math.round(f.temperature), Math.round(f.templow), f.datetime]));
    if (this._sig.fc !== sF) {
      this._sig.fc = sF;
      this._$(".fc").innerHTML = fc.map((f, i) => `<div class="fd"><div class="ic">${weatherSVG(f.condition, false, 42)}</div>${pedestal(70, 28)}<div class="dn">${i === 0 ? "Today" : new Date(f.datetime).toLocaleDateString("en-US", { weekday: "short" })}</div><div class="tp">${Math.round(f.temperature)}°<small>${f.templow != null ? Math.round(f.templow) + "°" : ""}</small></div></div>`).join("");
    }
    this._panel();
  }

  /* ---------- right rotating panel ---------- */
  _panel() {
    const C = this._cfg, ps = this._st(C.panel);
    const forced = ((location.hash || "").match(/panel=(\w+)/) || [])[1]; // preview aid: #panel=name
    const cur = forced || (ps ? ps.state : "photos"), opts = ps ? ps.attributes.options || [] : [];
    const P = (cur === "vacuum_main" ? { t: C.vac_main_name, i: "mdi:robot-vacuum" } : cur === "vacuum_bedroom" ? { t: C.vac_bed_name, i: "mdi:robot-vacuum-variant" } : PANELS[cur]) || { t: cap(cur), i: "mdi:view-dashboard" };
    if (this._cur !== cur) {
      this._cur = cur;
      this._$(".ph ha-icon").setAttribute("icon", P.i);
      this._$(".pt").textContent = P.t;
      this._$(".dots").innerHTML = opts.map((o) => `<i class="${o === cur ? "on" : ""}"></i>`).join("");
      const pc = this._$(".pc");
      pc.classList.remove("pin"); void pc.offsetWidth; pc.classList.add("pin");
      pc.innerHTML = "";
      this._sig.home = this._sig.shows = this._sig.photo = this._sig.mower = null;
      if (cur === "photos") pc.innerHTML = `<div class="photo"><div class="bg"></div><img class="a"><img class="b"></div>`;
      else if (this._E[cur]) this._embed(cur, pc);
    }
    if (cur === "photos") this._photo();
    else if (cur === "home") this._home();
    else if (cur === "tv_shows") this._shows();
    else if (cur === "mower") this._mower();
    else if (this._E[cur] && this._emb[cur]) { this._emb[cur].forEach((e) => (e.hass = this._hass)); }
  }
  async _embed(key, pc) {
    const wrap = document.createElement("div"); wrap.className = "emb"; pc.appendChild(wrap);
    try {
      if (!this._emb[key]) {
        const h = await this._helpers;
        this._emb[key] = this._E[key].map((cfg) => { const el = h.createCardElement(cfg); el.hass = this._hass; return el; });
      }
      if (this._cur !== key) return;
      this._emb[key].forEach((el) => { el.hass = this._hass; wrap.appendChild(el); });
      // shrink to fit the panel height once rendered
      let n = 0;
      const fit = () => {
        wrap.style.zoom = 1;
        const avail = pc.clientHeight - 20, hgt = wrap.scrollHeight;
        if (hgt > avail && hgt > 0) wrap.style.zoom = (avail / hgt).toFixed(3);
        if (++n < 8 && this._cur === key) setTimeout(fit, 700);
      };
      setTimeout(fit, 300);
    } catch (e) { wrap.textContent = "Couldn't load this panel."; }
  }
  _photo() {
    const s = this._st(this._cfg.photo); if (!s) return;
    const url = s.attributes.entity_picture + (s.attributes.entity_picture.includes("?") ? "&" : "?") + "t=" + encodeURIComponent(s.state);
    if (this._sig.photo === url) return;
    this._sig.photo = url;
    const box = this._$(".photo"); if (!box) return;
    const imgs = box.querySelectorAll("img"), cur = box.querySelector("img.show"), nxt = cur === imgs[0] ? imgs[1] : imgs[0];
    nxt.onload = () => { if (cur) cur.classList.remove("show"); nxt.classList.add("show"); box.querySelector(".bg").style.backgroundImage = `url("${url}")`; };
    nxt.src = url;
  }
  _home() {
    const C = this._cfg, t = this._s(C.trash), r = this._s(C.recycle);
    const sig = [t, r, JSON.stringify(this._feed || []), new Date().toDateString()].join();
    if (this._sig.home === sig) return;
    this._sig.home = sig;
    const days = (d) => { const x = new Date(d + "T12:00:00"); if (isNaN(x)) return null; const t0 = new Date(); t0.setHours(12, 0, 0, 0); return Math.round((x - t0) / 864e5); };
    const lbl = (n) => (n == null ? "--" : n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);
    const dt = days(t), dr = days(r);
    const dstr = (d) => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? "" : x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
    const feed = (this._feed || []).map((i) => `<div class="fi ${i.s}"><span class="ck">${i.s === "done" ? "✅" : i.s === "next" ? "⏭️" : "🕒"}</span><span class="tm">${i.t}</span><span>${i.n}</span><span class="am">${i.a} g</span></div>`).join("") || `<div class="fi">No feedings planned today.</div>`;
    this._$(".pc").innerHTML = `<div class="home pin">
      <div class="bins"><div class="bin">${binSVG("green", dt != null && dt <= 1)}<div class="n">Garbage</div><div class="d ${dt != null && dt <= 1 ? "soon" : ""}">${lbl(dt)} · ${dstr(t)}</div></div>
      <div class="bin">${binSVG("yellow", dr != null && dr <= 1)}<div class="n">Recycling</div><div class="d ${dr != null && dr <= 1 ? "soon" : ""}">${lbl(dr)} · ${dstr(r)}</div></div></div>
      ${C.feeder_schedule_template ? `<div class="feed"><h3>🍽️ Feeding plan today</h3>${feed}</div>` : ""}</div>`;
  }
  _mower() {
    const C = this._cfg, g = (e) => this._s(e), n = (e) => this._n(e);
    const st = g(C.mower), bat = n(C.mower_battery), chg = g(C.mower_charging) === "on";
    const mode = g(C.mower_mode), nxt = g(C.mower_next_start), err = g(C.mower_error);
    const sig = [st, bat, chg, mode, nxt, err, g(C.mower_cutting_time)].join();
    if (this._sig.mower === sig) return;
    this._sig.mower = sig;
    const word = { mowing: "Mowing", docked: chg ? "Charging" : "Docked", paused: "Paused", returning: "Returning home", error: "Error", unavailable: "Offline" }[st] || cap(st);
    const sub = st === "paused" ? "parked for the season" : st === "mowing" ? "cutting the grass" : st === "docked" ? "in its charging station" : "";
    const nxtTxt = ["unavailable", "unknown", ""].includes(nxt) ? "Not scheduled" : new Date(nxt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
    const fmt = (v) => (isNaN(v) ? "--" : Math.round(v).toLocaleString("en-US"));
    const bad = err && !["no_error", "unknown", "unavailable"].includes(err);
    this._$(".pc").innerHTML = `<div class="mow pin"><div class="mhead">${word}<small>${sub}</small></div>${mowerSVG(st, chg)}
      <div class="mstats">
        <div class="ms"><div class="v">${isNaN(bat) ? "--" : bat + "%"}</div><div class="l">BATTERY</div><div class="meter"><i style="width:${isNaN(bat) ? 0 : bat}%"></i></div></div>
        <div class="ms"><div class="v">${cap(mode)}</div><div class="l">MODE</div></div>
        <div class="ms"><div class="v" style="font-size:12.5px">${nxtTxt}</div><div class="l">NEXT START</div></div>
        <div class="ms ${bad ? "bad" : ""}"><div class="v">${bad ? cap(err) : "None"}</div><div class="l">ERRORS</div></div>
        <div class="ms"><div class="v">${fmt(n(C.mower_cutting_time))} h</div><div class="l">CUTTING</div></div>
        <div class="ms"><div class="v">${fmt(n(C.mower_drive_distance))} mi</div><div class="l">DRIVEN</div></div>
        <div class="ms"><div class="v">${fmt(n(C.mower_charging_cycles))}</div><div class="l">CHARGES</div></div>
        <div class="ms"><div class="v">${fmt(n(C.mower_charging_time))} h</div><div class="l">CHARGING</div></div>
      </div></div>`;
  }
  _shows() {
    const sig = JSON.stringify(this._events || []) + new Date().toDateString();
    if (this._sig.shows === sig) return;
    this._sig.shows = sig;
    const today = new Date().toDateString();
    const html = (this._events || []).map((e) => `<div class="ev ${e.t.toDateString() === today ? "today" : ""}"><div class="day"><span>${e.t.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span><b>${e.t.getDate()}</b></div>
      <div style="min-width:0"><div class="t">${e.ad ? "All day" : e.t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div><div class="s">${e.s}</div></div></div>`).join("") || `<div class="ev"><div class="s">Nothing scheduled this week.</div></div>`;
    this._$(".pc").innerHTML = `<div class="shows pin">${html}</div>`;
  }
}

if (!customElements.get("tv3d-card")) customElements.define("tv3d-card", TV3DCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "tv3d-card", name: "TV 3D", description: "Animated isometric TV dashboard (display only)" });
console.info(`%c TV3D-CARD %c ${TV3D_VERSION} `, "background:#1d5c3d;color:#fff", "background:#2d5c99;color:#fff");
