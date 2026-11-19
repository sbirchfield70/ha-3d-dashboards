/*!
 * Garage 3D Card — an animated, isometric "3D" garage / wall-monitor dashboard for Home Assistant (blue theme, display-only).
 * Designed on a 1400x875 canvas (16:10 monitor) and scaled to fit.
 * Clock, house with live weather, garage door, a retro TV (optional WeatherStar 4000+ iframe), two live cameras,
 * and a rotating appliance panel (fridge / washer / vacuums) driven by an input_select.
 * Every entity is set in the card config; see the README for the full option list.
 * License: MIT
 */
const GARAGE3D_VERSION = "1.0.0";

const GD = {
  weather: "weather.home",
  outside_temp: null,                          // optional sensor; falls back to the weather entity's temperature
  house: "climate.thermostat",                 // indoor temperature (climate.* current_temperature)
  sun: "sun.sun",
  garage: "cover.garage_door",
  middle: "input_select.garage_display_middle_panel", // options: fridge, washer, vacuum_main, vacuum_bedroom
  mode: "input_select.garage_display_panel",   // when its state is "network", a network overlay is shown
  fridge_name: "Fridge",
  fridge: "number.refrigerator_fridge_temperature",
  freezer: "number.refrigerator_freezer_temperature",
  fridge_door: "binary_sensor.refrigerator_door",
  water_filter: "sensor.refrigerator_water_filter",
  air_filter: "sensor.refrigerator_fresh_air_filter",
  ice_plus: "switch.refrigerator_ice_plus",
  washer: "sensor.washer_machine_state",
  washer_sub: "sensor.washer_sub_cycle",
  washer_left: "sensor.washer_time_remaining",
  vacs: {                                      // e = vacuum entity, p = prefix of its sensors (<p>battery_level, <p>status, ...)
    vacuum_main: { e: "vacuum.main_vacuum", p: "sensor.main_vacuum_", name: "Main Vacuum" },
    vacuum_bedroom: { e: "vacuum.bedroom_vacuum", p: "sensor.bedroom_vacuum_", name: "Bedroom Vacuum" },
  },
  lights: "switch.backyard_lights",
  tv: "media_player.living_room_tv",
  tv_name: "TV",
  trash: "sensor.next_trash_pickup_date",
  recycle: "sensor.next_recycling_pickup_date",
  summary: "sensor.today_weather_summary",
  summary_alt: "sensor.daily_weather_summary",
  high: "sensor.today_high_temperature",
  low: "sensor.today_low_temperature",
  rain_chance: "sensor.today_rain_chance",
  cams: [
    { entity: "camera.front_yard", name: "Front Yard" },
    { entity: "camera.back_yard", name: "Backyard" },
  ],
  weatherstar: "",                             // optional URL of a WeatherStar 4000+ (ws4kp) instance for the retro TV screen
};

const MIDP = {
  fridge: { t: "Fridge", i: "mdi:fridge" },
  washer: { t: "Washer / Dryer", i: "mdi:washing-machine" },
  vacuum_main: { t: "Main Vacuum", i: "mdi:robot-vacuum" },
  vacuum_bedroom: { t: "Bedroom Vacuum", i: "mdi:robot-vacuum-variant" },
};

/* ---------- helpers copied from tv3d-card (same family as home3d-card) ---------- */
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

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + "m " : ""}ago` : `${Math.floor(m / 1440)}d ago`;
};
const cap = (s) => (s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/* ---------- garage-only pieces ---------- */
function fridgeSVG(open) {
  const I = mkIso(70, 106, 0.9), { P, poly, box } = I;
  const L = (a, b, c = "#93a6c2", w = 1.2) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}"/>`;
  const [sx, sy] = P(30, 28, 0);
  let s = `<defs><filter id="fgl" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  s += `<ellipse cx="${sx}" cy="${sy + 14}" rx="66" ry="16" fill="rgba(0,0,0,.35)"/>`;
  s += box(0, 0, 0, 60, 56, 130, "#dfe6f0", { top: "#f4f7fb", right: "#c9d4e3", left: "#e6ecf5" });
  // front face = +y plane (y=56): freezer drawer z 0-44, french doors z 47-128
  s += L(P(0, 56, 45), P(60, 56, 45), "#8ea2bf", 1.6);
  s += L(P(30, 56, 45), P(30, 56, 130), "#8ea2bf", 1.6);
  s += poly([P(25.5, 56.3, 72), P(27.5, 56.3, 72), P(27.5, 56.3, 108), P(25.5, 56.3, 108)], "#7d90ad");
  s += poly([P(32.5, 56.3, 72), P(34.5, 56.3, 72), P(34.5, 56.3, 108), P(32.5, 56.3, 108)], "#7d90ad");
  s += poly([P(14, 56.3, 36), P(46, 56.3, 36), P(46, 56.3, 39), P(14, 56.3, 39)], "#7d90ad");
  // little display on the left door
  s += poly([P(8, 56.3, 98), P(20, 56.3, 98), P(20, 56.3, 112), P(8, 56.3, 112)], "#13243d");
  const [dx, dy] = P(14, 56.3, 106);
  s += `<circle cx="${dx}" cy="${dy}" r="1.6" fill="#5ef0a0" class="pulse" style="transform-origin:${dx}px ${dy}px"/>`;
  // frost sparkles near the freezer
  [[10, 20], [40, 12], [52, 30]].forEach(([x, z], i) => { const [fx, fy] = P(x, 56.4, z); s += `<text x="${fx}" y="${fy}" font-size="7" fill="#bfe6ff" class="twinkle" style="animation-delay:${i * 0.8}s">✦</text>`; });
  if (open) {
    const [gx, gy] = P(30, 76, 0);
    s += `<ellipse cx="${gx}" cy="${gy}" rx="48" ry="16" fill="#bfe8ff" opacity=".5" filter="url(#fgl)" class="glow"/>`;
    s += poly([P(30, 56, 47), P(30, 80, 47), P(30, 80, 128), P(30, 56, 128)], "#eef3fa", 'opacity=".9" stroke="#8ea2bf" stroke-width="1"');
  }
  return `<svg viewBox="0 0 140 162" width="150" height="174" class="bob">${s}</svg>`;
}
function tvSVG(on) {
  const I = mkIso(30, 40, 0.9), { P, poly, box } = I;
  let s = box(30, 20, 0, 30, 24, 3, "#2b3f5e") + box(43, 30, 3, 4, 4, 10, "#3a4f70");
  s += box(0, 30, 12, 90, 3, 52, "#1d2a40", { top: "#2b3f5e", left: "#141e30" });
  const scr = [P(3, 33.2, 15), P(87, 33.2, 15), P(87, 33.2, 61), P(3, 33.2, 61)];
  s += poly(scr, on ? "#2f7fd8" : "#0b1424");
  if (on) {
    s += poly([P(3, 33.3, 40), P(87, 33.3, 40), P(87, 33.3, 61), P(3, 33.3, 61)], "#7fd0ff", 'opacity=".35" class="flicker"');
    s += poly([P(10, 33.4, 22), P(30, 33.4, 22), P(30, 33.4, 34), P(10, 33.4, 34)], "#ffd36b", 'opacity=".8" class="twinkle"');
    s += poly([P(36, 33.4, 22), P(56, 33.4, 22), P(56, 33.4, 34), P(36, 33.4, 34)], "#ff8a6b", 'opacity=".8" class="twinkle" style="animation-delay:.8s"');
    s += poly([P(62, 33.4, 22), P(82, 33.4, 22), P(82, 33.4, 34), P(62, 33.4, 34)], "#5ef0a0", 'opacity=".8" class="twinkle" style="animation-delay:1.6s"');
  }
  const [lx, ly] = P(80, 33.3, 13.5);
  s += `<circle cx="${lx}" cy="${ly}" r="1.4" fill="${on ? "#5ef0a0" : "#ff5a5a"}"/>`;
  return `<svg viewBox="0 0 80 80" width="96" height="96">${s}</svg>`;
}
function thermoSVG(t, act) {
  const c = act === "heating" ? "#ff9a5a" : act === "cooling" ? "#5ac8ff" : "#8fa7cc";
  const live = act === "heating" || act === "cooling";
  return `<svg viewBox="0 0 100 100" width="86" height="86"><defs><radialGradient id="thf" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#3a6aa8"/><stop offset="1" stop-color="#13305a"/></radialGradient></defs>
    <circle cx="50" cy="55" r="40" fill="#0d2142"/><circle cx="50" cy="50" r="40" fill="url(#thf)" stroke="#6b8fc4" stroke-width="2"/>
    <g class="${live ? "pulse" : ""}" style="transform-origin:50px 50px"><circle cx="50" cy="50" r="31" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="150 60" stroke-linecap="round" transform="rotate(125 50 50)"/></g>
    <text x="50" y="59" font-size="25" font-weight="900" fill="#eef4ff" text-anchor="middle" font-family="Nunito,sans-serif">${isNaN(t) ? "--" : Math.round(t)}°</text></svg>`;
}
const big = (svg, w, h) => svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);

const CSS = `
:host{display:block}*{box-sizing:border-box}
.outer{width:100%;display:flex;justify-content:center;overflow:hidden;background:#0a1a33}
.stage{position:relative;width:1400px;height:875px;transform-origin:top left;font-family:Nunito,"Varela Round","Segoe UI",system-ui,sans-serif;color:#eef4ff;overflow:hidden;
  background:radial-gradient(760px 560px at 14% 28%,#21508c 0%,rgba(33,80,140,0) 70%),radial-gradient(760px 520px at 88% 92%,#1a5f8c 0%,rgba(26,95,140,0) 70%),radial-gradient(1300px 900px at 40% 8%,#183a6c 0%,#0f2547 55%,#0a1a33 100%)}
.abs{position:absolute}
.clock{left:22px;top:0;font-size:96px;font-weight:900;letter-spacing:-2px;line-height:1.05;
  text-shadow:0 1px 0 #c9d8ee,0 2px 0 #a3b8d8,0 3px 0 #7b96c0,0 4px 0 #5677a8,0 5px 0 #3d5f93,0 10px 16px rgba(0,0,0,.55)}
.clock small{font-size:28px;margin-left:6px;letter-spacing:0;text-shadow:0 2px 0 #7b96c0,0 4px 8px rgba(0,0,0,.5)}
.date{left:26px;top:108px;font-size:18px;font-weight:800;color:#b9cbe6}
.house{left:6px;top:128px;width:410px;height:342px}
.housesvg{width:410px;height:342px;filter:drop-shadow(0 14px 14px rgba(0,0,0,.35));animation:hf 7s ease-in-out infinite}
.wx{left:284px;top:118px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.4))}
.precip{position:absolute;left:30px;top:220px;width:370px;height:240px;overflow:hidden;pointer-events:none;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 55%,transparent 75%)}
.precip i{position:absolute;top:-14px;width:2px;height:12px;background:linear-gradient(rgba(207,233,255,0),#9fd3ff);animation:rain 1s linear infinite}
.precip i.sn{width:6px;height:6px;border-radius:50%;background:#fff;animation:snow 4s linear infinite}
@keyframes rain{to{transform:translateY(270px)}}@keyframes snow{50%{transform:translate(8px,130px)}100%{transform:translate(-4px,270px)}}
.box3d{border-radius:16px;background:linear-gradient(160deg,rgba(45,92,153,.62),rgba(20,47,88,.62));box-shadow:0 5px 0 rgba(10,25,50,.65),0 10px 16px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.12)}
.summary{left:18px;top:470px;width:398px;padding:9px 14px}
.summary .s1{font-size:16px;font-weight:800;line-height:1.25}
.summary .s2{font-size:15px;font-weight:900;color:#ffd36b;margin-top:4px}
.tvset{left:18px;top:566px;width:398px;height:204px;perspective:800px}
.tvbox{position:absolute;inset:0;border-radius:18px;background:linear-gradient(160deg,#3b6aa8,#1e3f6e);box-shadow:0 8px 0 #142d52,0 16px 24px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.18);transform:rotateY(5deg);transform-origin:left center}
.tvscreen{position:absolute;left:12px;top:12px;width:320px;height:180px;border-radius:12px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 3px #0c1830,inset 0 0 18px rgba(0,0,0,.8)}
.tvscreen iframe{border:0;width:320px;height:180px;display:block}
.tvscreen:after{content:"";position:absolute;inset:0;background:linear-gradient(130deg,rgba(255,255,255,.14),rgba(255,255,255,0) 40%);pointer-events:none}
.knobs{position:absolute;right:14px;top:22px;display:flex;flex-direction:column;gap:14px;align-items:center}
.knob{width:32px;height:32px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#eef4ff,#8ea3c4 60%,#4d6688);box-shadow:0 3px 0 #0f2140}
.knob:before{content:"";display:block;width:3px;height:12px;margin:4px auto 0;border-radius:2px;background:#2b3f5e}
.knob.k1{animation:kn 9s ease-in-out infinite}.grill{width:36px;height:40px;border-radius:7px;background:repeating-linear-gradient(0deg,#16305a 0 3px,#2d5591 3px 6px)}
@keyframes kn{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(40deg)}}
.bins{left:18px;top:784px;width:398px;display:flex;gap:12px}
.bin{flex:1;display:flex;align-items:center;gap:4px;height:84px;padding:0 8px 0 2px;border-radius:16px;background:linear-gradient(160deg,#2d5c99,#1d4277);box-shadow:0 5px 0 #13305a,0 10px 14px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15)}
.bin.soon{box-shadow:0 5px 0 #13305a,0 0 0 2px rgba(255,211,107,.7),0 10px 18px rgba(255,190,80,.25)}
.bin .n{font-size:17px;font-weight:900}.bin .d{font-size:13px;font-weight:800;color:#a9bfdf;white-space:nowrap}.bin .d.soon{color:#ffd36b}
/* middle */
.hdr{top:12px;font-size:15px;color:#a9bfdf;font-weight:800;white-space:nowrap}
.big{top:30px;font-size:72px;font-weight:900;line-height:1;text-shadow:0 1px 0 #c9d8ee,0 2px 0 #a3b8d8,0 3px 0 #7b96c0,0 4px 0 #5677a8,0 8px 12px rgba(0,0,0,.5)}
.big.sm{font-size:56px;top:40px}
.hilo{top:26px;font-size:13px;font-weight:800;color:#b9cbe6;text-align:right;line-height:1.35}
.hilo b{color:#ffd36b;font-size:17px}
.row{display:flex;justify-content:space-between}
.g{width:124px;display:flex;flex-direction:column;align-items:center;position:relative}
.g .top{height:66px;display:flex;align-items:flex-end;justify-content:center;z-index:2;transform:scale(1.2);transform-origin:bottom center}
.g .ped{position:absolute;top:54px}
.g .v{margin-top:22px;font-size:16px;font-weight:900;z-index:2;white-space:nowrap}
.g .l{font-size:10px;font-weight:800;color:#9fb5d6;letter-spacing:.6px}
.sock-wrap{position:relative;width:70px;height:58px;perspective:260px}
.sock-pole{position:absolute;left:33px;top:4px;width:3px;height:54px;border-radius:2px;background:linear-gradient(90deg,#8ea3c4,#eef4ff,#8ea3c4)}
.sock-rot{position:absolute;left:35px;top:6px;width:0;height:0;transform-style:preserve-3d;transition:transform 2.5s}
.sock-droop{position:absolute;left:0;top:-16px;transform-origin:0 16px;transform-style:preserve-3d}
.sock{display:block;transform-origin:0 16px;animation:flap 1s ease-in-out infinite alternate}
@keyframes flap{0%{transform:skewY(-4deg) scaleX(.96)}100%{transform:skewY(4deg) scaleX(1.03)}}
.apanel{left:436px;top:250px;width:404px;height:292px;perspective:1100px}
.abox,.nbox,.cbox{position:absolute;inset:0;border-radius:22px;background:linear-gradient(160deg,#22497f,#132d55);box-shadow:0 8px 0 #0d2142,0 18px 30px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.12);overflow:hidden}
.abox{transform:rotateX(4deg);transform-origin:center bottom}
.ah,.nh,.ch{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;font-size:18px;font-weight:900;border-bottom:1px solid rgba(255,255,255,.07)}
.ah ha-icon,.nh ha-icon,.ch ha-icon{--mdc-icon-size:22px;color:#ffd36b}
.dots{margin-left:auto;display:flex;gap:4px}.dots i{width:7px;height:7px;border-radius:4px;background:rgba(255,255,255,.22);transition:all .4s}.dots i.on{width:18px;background:#ffd36b}
.ac{position:absolute;left:0;right:0;top:40px;bottom:0;padding:10px 12px}
.pin{animation:pin .7s cubic-bezier(.2,1.2,.4,1)}
@keyframes pin{0%{opacity:0;transform:translateX(30px) rotateY(-14deg)}100%{opacity:1;transform:none}}
.arow{display:flex;align-items:center;gap:8px;height:100%}
.arow > svg{flex:none;filter:drop-shadow(0 10px 12px rgba(0,0,0,.35))}
.agrid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:center}
.mhead{grid-column:1/-1;font-size:22px;font-weight:900;line-height:1.1}.mhead small{display:block;font-size:13px;color:#a9bfdf;font-weight:800;margin-top:2px}
.ms{border-radius:12px;padding:7px 9px;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ms .v{font-size:17px;font-weight:900;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ms .l{font-size:9px;font-weight:800;color:#a9bfdf;letter-spacing:.3px;white-space:nowrap}
.ms .meter{height:6px;border-radius:3px;background:rgba(0,0,0,.3);margin-top:4px;overflow:hidden}.ms .meter i{display:block;height:100%;background:linear-gradient(90deg,#5ef0a0,#7fe0ff);border-radius:3px}
.ms.bad{background:linear-gradient(160deg,#ff8a7a,#e0524a)}.ms.bad .l{color:#ffe1dc}
.ms.warn .meter i{background:linear-gradient(90deg,#ffb04a,#ffd36b)}
.chips{display:flex;justify-content:space-between}
.chip{width:94px;height:94px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:linear-gradient(160deg,#2d5c99,#1d4277);box-shadow:0 5px 0 #13305a,0 10px 14px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15)}
.chip .v{font-size:13.5px;font-weight:900;margin-top:2px;white-space:nowrap}.chip .l{font-size:9px;font-weight:800;color:#a9bfdf;letter-spacing:.2px;white-space:nowrap}
.chip.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 5px 0 #b97a22,0 10px 18px rgba(255,190,80,.3),inset 0 1px 0 rgba(255,255,255,.5)}
.chip.on .l{color:#5a3a10}.chip.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 5px 0 #1f6ea3,0 10px 18px rgba(90,200,255,.3)}
.chip.cool .l{color:#0b3c5d}
.fc{display:flex;justify-content:space-between}
.fd{width:80px;display:flex;flex-direction:column;align-items:center;position:relative}
.fd .ic{height:48px;display:flex;align-items:flex-end;z-index:2}.fd .ped{position:absolute;top:36px}
.fd .dn{margin-top:22px;font-size:12px;font-weight:800;color:#b9cbe6}.fd .tp{font-size:17px;font-weight:900}.fd .tp small{font-size:12px;color:#9fb5d6;margin-left:3px}
.sunarc{left:442px;top:786px;transform:scale(1.45);transform-origin:left top}
/* right: cameras */
.cam{left:846px;width:540px;height:350px;perspective:1300px}
.cbox{transform:rotateY(-3deg);transform-origin:right center}
.ch .live{margin-left:auto;font-size:11px;font-weight:900;color:#ffb3aa;display:flex;align-items:center;gap:6px;letter-spacing:.8px}
.ch .live i{width:9px;height:9px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 8px #ff4d4d}
.cv{position:absolute;left:10px;right:10px;top:46px;bottom:10px;border-radius:12px;overflow:hidden;background:#050b16;
  --ha-card-border-radius:0;--ha-card-box-shadow:none;--ha-card-border-width:0;--ha-card-background:#050b16;box-shadow:inset 0 0 0 2px rgba(255,255,255,.06)}
.cv > *{display:block;width:100%}
.cv .wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#6f86ad;pointer-events:none}
.bcards{left:846px;top:740px;width:540px;height:124px;display:flex;gap:14px}
.bc{flex:1;display:flex;align-items:center;gap:6px;padding:0 12px 0 6px;border-radius:18px;background:linear-gradient(160deg,#2d5c99,#1d4277);box-shadow:0 6px 0 #13305a,0 12px 18px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.15)}
.bc .t{font-size:20px;font-weight:900;line-height:1.1}.bc .s{font-size:13px;font-weight:800;color:#a9bfdf;margin-top:3px;white-space:nowrap}.bc .s b{color:#ffd36b}
/* network overlay (left + middle while input_select.garage_display_panel = network) */
.net{left:12px;top:8px;width:826px;height:860px;perspective:1300px;display:none;z-index:5}
.net.show{display:block}
.nc{position:absolute;left:0;right:0;top:40px;bottom:0;padding:12px;overflow:hidden}
.nemb{width:100%;transform-origin:top left}
.ped{display:block}
/* anims (shared with tv3d-card) */
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

class Garage3DCard extends HTMLElement {
  setConfig(c) { this._cfg = Object.assign({}, GD, c || {}); this._sig = {}; }
  getCardSize() { return 14; }
  static getStubConfig() { return {}; }

  connectedCallback() {
    if (!document.getElementById("h3d-font")) {
      const l = document.createElement("link"); l.id = "h3d-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap";
      document.head.appendChild(l);
    }
    this._t0 = Date.now();
    // re-fit for the first minute: the kiosk hides HA's top bar after the card has been laid out
    this._tick = setInterval(() => { this._clock(); if (Date.now() - this._t0 < 60000) this._fit(); }, 1000);
    this._slow = setInterval(() => { this._sig.sun = null; this._sig.st = null; this._sig.bins = null; this._fit(); this._update(); }, 60000);
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    window.addEventListener("resize", (this._wr = () => this._fit()));
    if (this._hass) this._subs();
  }
  disconnectedCallback() {
    clearInterval(this._tick); clearInterval(this._slow);
    this._ro && this._ro.disconnect(); window.removeEventListener("resize", this._wr);
    if (this._unFc) { this._unFc.then((u) => u && u()).catch(() => {}); this._unFc = null; }
  }
  set hass(h) {
    this._hass = h;
    if (!this._built) this._build();
    if (this.isConnected) this._subs();
    this._update();
  }
  _subs() {
    const c = this._hass && this._hass.connection; if (!c || this._unFc) return;
    this._unFc = c.subscribeMessage((m) => { this._fcast = m.forecast || []; this._sig.fc = null; this._update(); }, { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: this._cfg.weather });
    this._unFc.catch(() => (this._unFc = null));
  }
  _st(e) { return this._hass && this._hass.states[e]; }
  _s(e) { const s = this._st(e); return s ? s.state : "unavailable"; }
  _n(e, a) { const s = this._st(e); if (!s) return NaN; return parseFloat(a ? s.attributes[a] : s.state); }

  _build() {
    this._built = true;
    const C = this._cfg, r = this.attachShadow({ mode: "open" });
    const cam = (c, i) => `<div class="abs cam" style="top:${i ? 376 : 10}px"><div class="cbox"><div class="ch"><ha-icon icon="mdi:cctv"></ha-icon><span>${c.name}</span><span class="live"><i class="pulse"></i>LIVE</span></div><div class="cv"><div class="wait">Connecting…</div></div></div></div>`;
    r.innerHTML = `<style>${CSS}</style><div class="outer"><div class="stage">
      <div class="abs clock"></div><div class="abs date"></div>
      <div class="abs house"></div><div class="precip"></div><div class="abs wx"></div>
      <div class="abs summary box3d"><div class="s1"></div><div class="s2"></div></div>
      <div class="abs tvset"><div class="tvbox"><div class="tvscreen">${C.weatherstar ? `<iframe src="${C.weatherstar}" scrolling="no"></iframe>` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#7fa3d6;font-weight:900;letter-spacing:.1em;font-size:18px">NO SIGNAL</div>`}</div>
        <div class="knobs"><div class="knob k1"></div><div class="knob"></div><div class="grill"></div></div></div></div>
      <div class="abs bins"></div>
      <div class="abs hdr" style="left:440px">Yard · <span class="cond"></span></div>
      <div class="abs big out" style="left:436px"></div>
      <div class="abs hdr" style="left:612px">House · <span class="hact"></span></div>
      <div class="abs big sm in" style="left:610px"></div>
      <div class="abs hilo" style="left:748px;width:92px"></div>
      <div class="abs row gauges" style="left:436px;top:124px;width:404px">
        <div class="g"><div class="top g-h"></div>${pedestal(90, 34)}<div class="v v-h"></div><div class="l">HUMIDITY</div></div>
        <div class="g"><div class="top g-b"></div>${pedestal(90, 34)}<div class="v v-b"></div><div class="l">PRESSURE</div></div>
        <div class="g"><div class="top g-w"></div>${pedestal(90, 34)}<div class="v v-w"></div><div class="l">WIND</div></div>
      </div>
      <div class="abs apanel"><div class="abox"><div class="ah"><ha-icon></ha-icon><span class="at"></span><div class="dots"></div></div><div class="ac"></div></div></div>
      <div class="abs chips status" style="left:436px;top:560px;width:404px"></div>
      <div class="abs fc" style="left:432px;top:676px;width:412px"></div>
      <div class="abs sunarc"></div>
      ${C.cams.map(cam).join("")}
      <div class="abs bcards"><div class="bc tvc"></div><div class="bc hc"></div></div>
      <div class="abs net"><div class="nbox"><div class="nh"><ha-icon icon="mdi:lan"></ha-icon><span>Network</span></div><div class="nc"><div class="nemb"></div></div></div></div>
    </div></div>`;
    this._$ = (s) => r.querySelector(s);
    this._$$ = (s) => r.querySelectorAll(s);
    this._clock(); this._fit();
    this._helpers = window.loadCardHelpers ? window.loadCardHelpers() : null;
    this._mkCams();
  }
  async _mkCams() {
    try {
      const h = await this._helpers;
      const slots = this._$$(".cv");
      this._cams = this._cfg.cams.map((c, i) => {
        const el = h.createCardElement({ type: "picture-entity", entity: c.entity, camera_view: "live", show_name: false, show_state: false, fit_mode: "contain", aspect_ratio: "16:9", tap_action: { action: "none" }, hold_action: { action: "none" } });
        el.hass = this._hass; slots[i].appendChild(el); return el;
      });
    } catch (e) { this._$$(".cv .wait").forEach((w) => (w.textContent = "Camera unavailable")); }
  }
  _fit() {
    if (!this._built) return;
    const stage = this._$(".stage"), outer = this._$(".outer");
    const w = this.clientWidth || this.getBoundingClientRect().width || 1400;
    const top = Math.max(0, this.getBoundingClientRect().top);
    const k = Math.min(w / 1400, Math.max(200, window.innerHeight - top) / 875);
    if (this._k === k) return; this._k = k;
    stage.style.transform = `scale(${k})`; outer.style.height = 875 * k + "px";
    stage.style.marginRight = 1400 * k - 1400 + "px"; stage.style.marginBottom = 875 * k - 875 + "px";
  }
  _clock() {
    if (!this._built) return;
    const d = new Date(); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    const t = `${h}:${String(d.getMinutes()).padStart(2, "0")}<small>${ap}</small>`;
    if (this._lt !== t) { this._lt = t; this._$(".clock").innerHTML = t; }
    const ds = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (this._ld !== ds) { this._ld = ds; this._$(".date").textContent = ds; }
  }

  _update() {
    if (!this._built || !this._hass) return;
    const C = this._cfg, W = this._st(C.weather), A = W ? W.attributes : {}, sun = this._st(C.sun);
    const night = sun ? sun.state === "below_horizon" : false;
    const outT = !isNaN(this._n(C.outside_temp)) ? this._n(C.outside_temp) : A.temperature;
    const cond = W ? W.state : "";
    const gstate = this._s(C.garage), gopen = gstate !== "closed" && gstate !== "unavailable";
    const hi = this._n(C.high), lo = this._n(C.low), rc = this._n(C.rain_chance);
    const H = this._st(C.house), hT = H ? parseFloat(H.attributes.current_temperature) : NaN, hAct = H ? H.attributes.hvac_action || H.state : "";
    // header temps
    const sH = [Math.round(outT), cond, Math.round(hi), Math.round(lo), Math.round(rc), Math.round(hT), hAct].join();
    if (this._sig.h !== sH) {
      this._sig.h = sH;
      this._$(".out").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°";
      this._$(".cond").textContent = cap((cond || "").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " "));
      this._$(".in").textContent = isNaN(hT) ? "--" : Math.round(hT) + "°";
      this._$(".hact").textContent = cap(hAct);
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
    // house + weather icon + precipitation
    const cold = !isNaN(outT) && outT < 50, sW = [cond, night, cold, gopen].join();
    if (this._sig.w !== sW) {
      this._sig.w = sW;
      this._$(".house").innerHTML = houseSVG(night, cold, gopen);
      this._$(".wx").innerHTML = weatherSVG(cond, night, 120);
      const rainy = ["rainy", "pouring", "lightning-rainy"].includes(cond), snowy = ["snowy", "snowy-rainy"].includes(cond);
      this._$(".precip").innerHTML = rainy ? Array.from({ length: 34 }, () => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random()}s;animation-duration:${0.6 + Math.random() * 0.5}s"></i>`).join("")
        : snowy ? Array.from({ length: 28 }, () => `<i class="sn" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s"></i>`).join("") : "";
    }
    // gauges
    const sG = [A.humidity, A.pressure, A.wind_speed, A.wind_bearing].join();
    if (this._sig.g !== sG) {
      this._sig.g = sG;
      this._$(".g-h").innerHTML = dropSVG(A.humidity); this._$(".v-h").textContent = A.humidity != null ? Math.round(A.humidity) + "%" : "--";
      this._$(".g-b").innerHTML = baroSVG(+A.pressure || 29.92, A.pressure_unit); this._$(".v-b").textContent = A.pressure != null ? (+A.pressure).toFixed(2) + " in" : "--";
      this._$(".g-w").innerHTML = sockHTML(+A.wind_speed || 0, +A.wind_bearing || 0);
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      this._$(".v-w").textContent = A.wind_speed != null ? `${Math.round(A.wind_speed)} mph ${dirs[Math.round(((+A.wind_bearing || 0) % 360) / 45) % 8]}` : "--";
    }
    // trash bins
    const t = this._s(C.trash), rcy = this._s(C.recycle), sB = [t, rcy, new Date().toDateString()].join();
    if (this._sig.bins !== sB) {
      this._sig.bins = sB;
      const days = (d) => { const x = new Date(d + "T12:00:00"); if (isNaN(x)) return null; const t0 = new Date(); t0.setHours(12, 0, 0, 0); return Math.round((x - t0) / 864e5); };
      const lbl = (n) => (n == null ? "--" : n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);
      const dstr = (d) => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? "" : x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
      const bin = (name, color, d) => { const n = days(d), soon = n != null && n <= 1; return `<div class="bin ${soon ? "soon" : ""}">${big(binSVG(color, soon), 76, 80)}<div><div class="n">${name}</div><div class="d ${soon ? "soon" : ""}">${lbl(n)}</div><div class="d">${dstr(d)}</div></div></div>`; };
      this._$(".bins").innerHTML = bin("Garbage", "green", t) + bin("Recycling", "yellow", rcy);
    }
    // sun arc
    const sSun = sun ? sun.state + sun.attributes.next_rising + sun.attributes.next_setting + Math.floor(Date.now() / 300000) : "";
    if (this._sig.sun !== sSun) { this._sig.sun = sSun; this._$(".sunarc").innerHTML = sunArc(sun, new Date()); }
    // status chips
    const gs = this._st(C.garage), VM = C.vacs.vacuum_main, VB = C.vacs.vacuum_bedroom;
    const vm = this._s(VM.e), vb = this._s(VB.e), li = this._s(C.lights);
    const bm = this._n(VM.p + "battery_level"), bb = this._n(VB.p + "battery_level");
    const sSt = [gstate, gs && gs.last_changed, vm, vb, li, bm, bb, Math.floor(Date.now() / 60000)].join();
    if (this._sig.st !== sSt) {
      this._sig.st = sSt;
      const vtxt = (s, b) => (s === "cleaning" ? "Cleaning" : s === "docked" ? (b < 100 ? `Charging ${b}%` : "Docked") : cap(s));
      this._$(".status").innerHTML = `
        <div class="chip ${gopen ? "on" : ""}">${garageSVG(gstate)}<div class="v">${cap(gstate)}</div><div class="l">${gs ? ago(gs.last_changed) : ""}</div></div>
        <div class="chip ${vm === "cleaning" ? "cool" : ""}">${vacSVG(vm, bm)}<div class="v" style="font-size:12px">${vtxt(vm, bm)}</div><div class="l">MAIN VAC</div></div>
        <div class="chip ${vb === "cleaning" ? "cool" : ""}">${vacSVG(vb, bb)}<div class="v" style="font-size:12px">${vtxt(vb, bb)}</div><div class="l">BED VAC</div></div>
        <div class="chip ${li === "on" ? "on" : ""}">${lightsSVG(li === "on")}<div class="v">${li === "on" ? "On" : "Off"}</div><div class="l">BACKYARD</div></div>`;
    }
    // 5-day forecast
    const fc = (this._fcast || []).slice(0, 5);
    const sF = JSON.stringify(fc.map((f) => [f.condition, Math.round(f.temperature), Math.round(f.templow), f.datetime]));
    if (this._sig.fc !== sF) {
      this._sig.fc = sF;
      this._$(".fc").innerHTML = fc.map((f, i) => `<div class="fd"><div class="ic">${weatherSVG(f.condition, false, 48)}</div>${pedestal(72, 30)}<div class="dn">${i === 0 ? "Today" : new Date(f.datetime).toLocaleDateString("en-US", { weekday: "short" })}</div><div class="tp">${Math.round(f.temperature)}°<small>${f.templow != null ? Math.round(f.templow) + "°" : ""}</small></div></div>`).join("");
    }
    // bottom-right: TV + house thermostat
    const T = this._st(C.tv), tvOn = T && T.state === "on", src = T && T.attributes.source;
    const lo2 = H && H.attributes.target_temp_low, hi2 = H && H.attributes.target_temp_high, tgt = H && H.attributes.temperature;
    const sBC = [T && T.state, src, hT, hAct, lo2, hi2, tgt].join();
    if (this._sig.bc !== sBC) {
      this._sig.bc = sBC;
      this._$(".tvc").innerHTML = `${tvSVG(tvOn)}<div><div class="t">${C.tv_name || "TV"}</div><div class="s">${tvOn ? `On · <b>${src || "TV"}</b>` : T ? cap(T.state) : "Unavailable"}</div></div>`;
      const rng = lo2 != null && hi2 != null ? `${Math.round(lo2)}–${Math.round(hi2)}°` : tgt != null ? `${Math.round(tgt)}°` : "";
      this._$(".hc").innerHTML = `${thermoSVG(hT, hAct)}<div><div class="t">Downstairs</div><div class="s">${cap(hAct)}${rng ? ` · <b>${rng}</b>` : ""}</div></div>`;
    }
    this._apanel();
    this._net();
    if (this._cams) this._cams.forEach((el) => (el.hass = this._hass));
  }

  /* ---------- middle appliance panel (follows input_select.garage_display_middle_panel) ---------- */
  _apanel() {
    const C = this._cfg, ps = this._st(C.middle);
    const forced = ((location.hash || "").match(/mid=(\w+)/) || [])[1]; // preview aid: #mid=name
    const cur = forced || (ps ? ps.state : "fridge"), opts = ps ? ps.attributes.options || [] : [];
    const P = (cur === "fridge" ? { t: C.fridge_name, i: "mdi:fridge" } : C.vacs[cur] ? { t: C.vacs[cur].name, i: (MIDP[cur] || {}).i || "mdi:robot-vacuum" } : MIDP[cur]) || { t: cap(cur), i: "mdi:view-dashboard" };
    let sig, html;
    const f0 = (v, d = 0) => (isNaN(v) ? "--" : v.toFixed(d));
    const sv = (s) => (!s ? "--" : isNaN(parseFloat(s.state)) ? cap(s.state) : Math.round(parseFloat(s.state)) + (s.attributes.unit_of_measurement || ""));
    const meter = (v) => (isNaN(v) ? "" : `<div class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`);
    if (cur === "fridge") {
      const fT = this._n(C.fridge), zT = this._n(C.freezer), door = this._s(C.fridge_door) === "on", ice = this._s(C.ice_plus);
      const wf = this._st(C.water_filter), af = this._st(C.air_filter);
      const pw = wf && wf.attributes.unit_of_measurement === "%" ? parseFloat(wf.state) : NaN, pa = af && af.attributes.unit_of_measurement === "%" ? parseFloat(af.state) : NaN;
      sig = [cur, fT, zT, door, ice, wf && wf.state, af && af.state].join();
      html = `<div class="arow">${fridgeSVG(door)}<div class="agrid">
        <div class="ms"><div class="v">${f0(fT)}°F</div><div class="l">FRIDGE</div></div>
        <div class="ms"><div class="v">${f0(zT)}°F</div><div class="l">FREEZER</div></div>
        <div class="ms ${door ? "bad" : ""}"><div class="v">${door ? "Open!" : "Closed"}</div><div class="l">DOOR</div></div>
        <div class="ms"><div class="v">${ice === "on" ? "On" : "Off"}</div><div class="l">ICE PLUS</div></div>
        <div class="ms ${pw < 15 ? "warn" : ""}"><div class="v">${sv(wf)}</div><div class="l">WATER FILTER</div>${meter(pw)}</div>
        <div class="ms ${pa < 15 ? "warn" : ""}"><div class="v">${sv(af)}</div><div class="l">AIR FILTER</div>${meter(pa)}</div></div></div>`;
    } else if (cur === "washer") {
      const st = this._s(C.washer), run = st === "Run", sub = this._s(C.washer_sub), wl = this._n(C.washer_left);
      if (run) { if (!this._wTotal || this._wWas !== "run") this._wTotal = Math.max(wl || 0, 60); if (wl > this._wTotal) this._wTotal = wl; }
      this._wWas = run ? "run" : "idle";
      const left = run ? (wl > 0 ? (wl >= 3600 ? Math.floor(wl / 3600) + "h " : "") + Math.round((wl % 3600) / 60) + "m" : "Finishing…") : "--";
      const pct = run && this._wTotal ? Math.round(100 * (1 - (wl || 0) / this._wTotal)) : NaN;
      const word = run ? "Running" : ["Off", "unavailable", "unknown"].includes(st) ? "Idle" : cap(st);
      const subTxt = sub && !["---", "unknown", "unavailable"].includes(sub) ? cap(sub) : run ? "Washing" : "Nothing in progress";
      sig = [cur, st, sub, run ? Math.round(wl / 60) : 0].join();
      html = `<div class="arow">${big(washerSVG(run), 156, 156)}<div class="agrid">
        <div class="mhead">${word}<small>${subTxt}</small></div>
        <div class="ms"><div class="v">${cap(st)}</div><div class="l">MACHINE</div></div>
        <div class="ms"><div class="v">${left}</div><div class="l">TIME LEFT</div>${meter(pct)}</div></div></div>`;
    } else if (C.vacs[cur]) {
      const V = C.vacs[cur], s = this._s(V.e), stat = this._s(V.p + "status"), b = this._n(V.p + "battery_level");
      const area = this._n(V.p + "cleaned_area"), tm = this._n(V.p + "cleaning_time"), fl = this._n(V.p + "filter_left"), br = this._n(V.p + "main_brush_left");
      sig = [cur, s, stat, b, Math.round(area), tm, fl, br].join();
      const word = s === "cleaning" ? "Cleaning" : s === "returning" ? "Heading home" : s === "docked" ? (b < 100 ? "Charging" : "Docked") : cap(s);
      html = `<div class="arow">${big(vacSVG(s, b), 176, 128)}<div class="agrid">
        <div class="mhead">${word}<small>${cap(stat)}</small></div>
        <div class="ms"><div class="v">${f0(b)}%</div><div class="l">BATTERY</div>${meter(b)}</div>
        <div class="ms"><div class="v">${f0(area)} ft²</div><div class="l">LAST AREA</div></div>
        <div class="ms"><div class="v">${f0(tm)} min</div><div class="l">LAST RUN</div></div>
        <div class="ms ${fl < 10 ? "warn" : ""}"><div class="v">${f0(fl)}%</div><div class="l">FILTER</div>${meter(fl)}</div>
        <div class="ms ${br < 10 ? "warn" : ""}" style="grid-column:1/-1"><div class="v">${f0(br)}%${br < 10 ? " · replace soon" : ""}</div><div class="l">MAIN BRUSH</div>${meter(br)}</div></div></div>`;
    } else { sig = cur; html = `<div class="mhead">${cap(cur)}</div>`; }
    if (this._acur !== cur) {
      this._acur = cur;
      this._$(".ah ha-icon").setAttribute("icon", P.i);
      this._$(".at").textContent = P.t;
      this._$(".dots").innerHTML = opts.map((o) => `<i class="${o === cur ? "on" : ""}"></i>`).join("");
      const ac = this._$(".ac"); ac.classList.remove("pin"); void ac.offsetWidth; ac.classList.add("pin");
    }
    if (this._sig.a !== sig) { this._sig.a = sig; this._$(".ac").innerHTML = html; }
  }

  /* ---------- network overlay (follows input_select.garage_display_panel) ---------- */
  async _net() {
    const forced = /net=1/.test(location.hash || "");
    const show = forced || this._s(this._cfg.mode) === "network";
    const box = this._$(".net");
    if (show !== this._netShown) {
      this._netShown = show;
      box.classList.toggle("show", show);
      if (show) {
        const nb = this._$(".nbox"); nb.classList.remove("pin"); void nb.offsetWidth; nb.classList.add("pin");
        if (!this._netEl) {
          try { const h = await this._helpers; this._netEl = h.createCardElement({ type: "custom:silverfox-network-card" }); this._netEl.hass = this._hass; this._$(".nemb").appendChild(this._netEl); }
          catch (e) { this._$(".nemb").textContent = "Couldn't load the network card."; }
        }
        let n = 0; const wrap = this._$(".nemb"), nc = this._$(".nc");
        const fit = () => { wrap.style.zoom = 1; const avail = nc.clientHeight - 24, hgt = wrap.scrollHeight; if (hgt > avail && hgt > 0) wrap.style.zoom = (avail / hgt).toFixed(3); if (++n < 8 && this._netShown) setTimeout(fit, 700); };
        setTimeout(fit, 300);
      }
    }
    if (show && this._netEl) this._netEl.hass = this._hass;
  }
}

if (!customElements.get("garage3d-card")) customElements.define("garage3d-card", Garage3DCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "garage3d-card", name: "Garage 3D", description: "Animated isometric garage monitor dashboard (display only)" });
console.info(`%c GARAGE3D-CARD %c ${GARAGE3D_VERSION} `, "background:#1d5c3d;color:#fff", "background:#2d5c99;color:#fff");
