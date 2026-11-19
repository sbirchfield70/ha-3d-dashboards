/*!
 * Home 3D Card — an animated, isometric "3D" home dashboard card for Home Assistant.
 *
 * Clock, an animated house with live weather, humidity / pressure / wind gauges,
 * outside + indoor temperatures, up to 4 tappable 3D rooms (kitchen, dining,
 * living, bedroom scenes that light up with your devices), a 3-day forecast,
 * and upcoming calendar events. Tap a room for big touch-friendly controls.
 *
 * Designed on a 1280x720 canvas and scaled to fit (great on a Nest Hub,
 * wall tablet or kiosk). No build step, no dependencies.
 *
 * Install: copy to /config/www/home3d-card.js, add the resource
 *   /local/home3d-card.js  (type: JavaScript module)
 * then add a card:  type: custom:home3d-card   (see README.md for options)
 *
 * License: MIT
 */
const H3D_VERSION = "1.0.0";
let H3D_LOCALE = "en-US";

const H3D_DEFAULTS = {
  weather: "weather.home",          // any weather entity (forecast via weather/subscribe_forecast)
  outside_temp: null,               // optional sensor; falls back to the weather entity's temperature
  sun: "sun.sun",
  indoor: [],                       // climate.* or sensor.* entities averaged into "Inside"
  indoor_label: "Inside average",
  calendars: [],                    // calendar.* entities for the events list
  roof_color: "#1d5c3d",            // house roof colour
  time_format: "12",                // "12" or "24"
  locale: "en-US",
  rooms: [],                        // up to 4 rooms, see README
};

/* ---------- colour + iso helpers ---------- */
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
    const top = o.top || shade(c, 22), right = o.right || shade(c, -6), left = o.left || shade(c, -24);
    const ex = o.extra || "";
    return (
      poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right, ex) +
      poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left, ex) +
      poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top, ex)
    );
  };
  return { P, pts, poly, box };
}

/* ---------- weather icon (animated SVG) ---------- */
let H3D_UID = 0;
function cloudShape(cx, cy, s, fillId, extra = "") {
  return `<g ${extra}><ellipse cx="${cx}" cy="${cy + 10 * s}" rx="${34 * s}" ry="${12 * s}" fill="url(#${fillId})"/>
    <circle cx="${cx - 16 * s}" cy="${cy + 2 * s}" r="${14 * s}" fill="url(#${fillId})"/>
    <circle cx="${cx + 4 * s}" cy="${cy - 6 * s}" r="${20 * s}" fill="url(#${fillId})"/>
    <circle cx="${cx + 22 * s}" cy="${cy + 4 * s}" r="${12 * s}" fill="url(#${fillId})"/></g>`;
}
function weatherSVG(cond, night, size = 120) {
  const u = "w" + ++H3D_UID;
  const defs = `<defs>
    <radialGradient id="${u}s" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff6c9"/><stop offset=".55" stop-color="#ffd25e"/><stop offset="1" stop-color="#f4a62a"/></radialGradient>
    <radialGradient id="${u}m" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d6ee"/></radialGradient>
    <linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bccbe4"/></linearGradient>
    <linearGradient id="${u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d3e6"/><stop offset="1" stop-color="#7f93b5"/></linearGradient>
  </defs>`;
  const sun = (cx, cy, r) => `<g class="h3d-rays" style="transform-origin:${cx}px ${cy}px">${Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 * Math.PI) / 180;
      return `<line x1="${cx + Math.cos(a) * (r + 7)}" y1="${cy + Math.sin(a) * (r + 7)}" x2="${cx + Math.cos(a) * (r + 17)}" y2="${cy + Math.sin(a) * (r + 17)}" stroke="#ffc94a" stroke-width="5" stroke-linecap="round"/>`;
    }).join("")}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u}s)" class="h3d-pulse" style="transform-origin:${cx}px ${cy}px"/>`;
  const moon = (cx, cy, r) => `<g class="h3d-float"><path d="M ${cx + r * 0.3} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r} ${cy + r * 0.45} A ${r * 0.8} ${r * 0.8} 0 1 1 ${cx + r * 0.3} ${cy - r} Z" fill="url(#${u}m)"/></g>
     ${[[22, 24], [96, 18], [104, 70], [16, 80]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" class="h3d-twinkle" style="animation-delay:${i * 0.7}s"/>`).join("")}`;
  const drops = (n, color = "#7cc4ff") => Array.from({ length: n }, (_, i) => `<line x1="${40 + i * 14}" y1="78" x2="${36 + i * 14}" y2="90" stroke="${color}" stroke-width="4" stroke-linecap="round" class="h3d-drop" style="animation-delay:${(i * 0.23) % 1}s"/>`).join("");
  const flakes = (n) => Array.from({ length: n }, (_, i) => `<text x="${38 + i * 15}" y="88" font-size="14" fill="#fff" class="h3d-flake" style="animation-delay:${(i * 0.4) % 2}s">❄</text>`).join("");
  let body = "";
  const c = (cond || "").toLowerCase();
  if (c === "sunny" || c === "clear") body = sun(60, 60, 26);
  else if (c === "clear-night") body = moon(58, 58, 28);
  else if (c === "partlycloudy") body = (night ? `<g transform="translate(-14,-12) scale(.8)">${moon(58, 58, 26)}</g>` : sun(44, 44, 20)) + cloudShape(66, 66, 1, u + "c", 'class="h3d-drift"');
  else if (c === "cloudy") body = cloudShape(46, 48, 0.75, u + "d", 'class="h3d-drift2"') + cloudShape(66, 66, 1, u + "c", 'class="h3d-drift"');
  else if (c === "rainy") body = cloudShape(60, 52, 1, u + "d", 'class="h3d-drift"') + drops(4);
  else if (c === "pouring") body = cloudShape(60, 50, 1.05, u + "d", 'class="h3d-drift"') + drops(5, "#5aa8ff");
  else if (c === "snowy" || c === "snowy-rainy" || c === "hail") body = cloudShape(60, 50, 1, u + "c", 'class="h3d-drift"') + flakes(4);
  else if (c === "lightning" || c === "lightning-rainy")
    body = cloudShape(60, 48, 1.05, u + "d", 'class="h3d-drift"') + `<path d="M62 70 L50 92 L60 92 L54 112 L74 84 L63 84 L70 70 Z" fill="#ffd84a" class="h3d-flash"/>` + (c === "lightning-rainy" ? drops(3) : "");
  else if (c === "fog")
    body = cloudShape(60, 46, 0.9, u + "c") + [70, 82, 94].map((y, i) => `<line x1="${24 + i * 6}" y1="${y}" x2="${96 - i * 4}" y2="${y}" stroke="#d6e1f2" stroke-width="6" stroke-linecap="round" class="h3d-fog" style="animation-delay:${i * 0.6}s"/>`).join("");
  else if (c === "windy" || c === "windy-variant")
    body = cloudShape(64, 50, 0.9, u + "c", 'class="h3d-drift"') + [74, 88].map((y, i) => `<path d="M14 ${y} Q 50 ${y - 8} 86 ${y} T 112 ${y - 6}" stroke="#d6e1f2" stroke-width="5" fill="none" stroke-linecap="round" class="h3d-fog" style="animation-delay:${i * 0.5}s"/>`).join("");
  else body = night ? moon(58, 58, 28) : sun(60, 60, 26);
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="overflow:visible">${defs}${body}</svg>`;
}

/* ---------- pedestal (3D disc) ---------- */
function pedestal(w = 110, h = 44, top = "#3b679f", side = "#22426e") {
  const rx = w / 2 - 4, ry = rx * 0.32;
  return `<svg class="ped" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs><linearGradient id="pg${w}${top.slice(1)}" x1="0" x2="1"><stop offset="0" stop-color="${shade(side, -25)}"/><stop offset=".5" stop-color="${side}"/><stop offset="1" stop-color="${shade(side, -35)}"/></linearGradient>
    <radialGradient id="pt${w}${top.slice(1)}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(top, 25)}"/><stop offset="1" stop-color="${top}"/></radialGradient></defs>
    <ellipse cx="${w / 2}" cy="${h - ry - 2}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,.35)" filter="blur(3px)" transform="translate(0,4)"/>
    <path d="M ${w / 2 - rx} ${ry + 4} L ${w / 2 - rx} ${h - ry - 6} A ${rx} ${ry} 0 0 0 ${w / 2 + rx} ${h - ry - 6} L ${w / 2 + rx} ${ry + 4} Z" fill="url(#pg${w}${top.slice(1)})"/>
    <ellipse cx="${w / 2}" cy="${ry + 4}" rx="${rx}" ry="${ry}" fill="url(#pt${w}${top.slice(1)})"/>
  </svg>`;
}

/* ---------- room scenes ---------- */
const WARM = "#ffd27a";
function roomShell(I, wallL, wallR, floor) {
  const { P, poly, box } = I;
  let s = "";
  s += box(0, 0, -7, 100, 100, 7, floor, { top: floor, right: shade(floor, -30), left: shade(floor, -45) });
  // floor planks
  for (let i = 1; i < 6; i++) s += `<line x1="${P(i * 16.6, 0, 0)[0]}" y1="${P(i * 16.6, 0, 0)[1]}" x2="${P(i * 16.6, 100, 0)[0]}" y2="${P(i * 16.6, 100, 0)[1]}" stroke="${shade(floor, -10)}" stroke-width=".6" opacity=".7"/>`;
  s += box(-5, -5, -7, 5, 5, 97, wallL, { top: shade(wallL, 40) });
  s += box(-5, 0, -7, 5, 100, 97, wallL, { right: wallL, top: shade(wallL, 40), left: shade(wallL, -30) });
  s += box(0, -5, -7, 100, 5, 97, wallR, { left: wallR, top: shade(wallR, 40), right: shade(wallR, -30) });
  return s;
}
function windowOn(I, plane, a, b, z0, z1, night) {
  const { P, poly } = I;
  const glass = night ? "#1d2f57" : "#bfe3ff";
  const q = plane === "x" ? [P(0, a, z0), P(0, b, z0), P(0, b, z1), P(0, a, z1)] : [P(a, 0, z0), P(b, 0, z0), P(b, 0, z1), P(a, 0, z1)];
  const m = plane === "x" ? [P(0, (a + b) / 2, z0), P(0, (a + b) / 2, z1)] : [P((a + b) / 2, 0, z0), P((a + b) / 2, 0, z1)];
  return poly(q, glass, `stroke="#eef4ff" stroke-width="2"`) + `<line x1="${m[0][0]}" y1="${m[0][1]}" x2="${m[1][0]}" y2="${m[1][1]}" stroke="#eef4ff" stroke-width="1.5"/>` +
    (night ? `<circle cx="${(q[0][0] + q[2][0]) / 2 + 3}" cy="${(q[0][1] + q[2][1]) / 2 - 4}" r="1.3" fill="#fff" class="h3d-twinkle"/>` : `<polygon points="${I.pts([q[0], q[1], q[2]])}" fill="#fff" opacity=".18"/>`);
}
function glowPool(I, x, y, r, on, color = WARM) {
  if (!on) return "";
  const [cx, cy] = I.P(x, y, 0);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="${r * 0.55}" fill="${color}" opacity=".32" class="h3d-glow" filter="url(#soft)"/>`;
}
function pendant(I, x, y, zTop, zBulb, on, sway = true, big = false) {
  const [tx, ty] = I.P(x, y, zTop), [bx, by] = I.P(x, y, zBulb);
  const r = big ? 7 : 4.2;
  return `<g class="${sway ? "h3d-sway" : ""}" style="transform-origin:${tx}px ${ty}px">
    <line x1="${tx}" y1="${ty}" x2="${bx}" y2="${by}" stroke="#dfe8f6" stroke-width="1"/>
    ${on ? `<circle cx="${bx}" cy="${by + r}" r="${r * 3.2}" fill="${WARM}" opacity=".35" filter="url(#soft)" class="h3d-glow"/>` : ""}
    <path d="M ${bx - r} ${by + r} Q ${bx} ${by - r * 0.8} ${bx + r} ${by + r} Z" fill="${on ? "#fff1c4" : "#c9d6ea"}" stroke="#7d93b8" stroke-width=".6"/>
    <circle cx="${bx}" cy="${by + r}" r="${r * 0.45}" fill="${on ? "#fff7d6" : "#8ea3c4"}"/></g>`;
}
function roomSVG(key, st, night) {
  const I = mkIso(100, 92, 1);
  const { P, poly, box, pts } = I;
  const on = (e) => st[e] === "on";
  let s = `<defs><filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="soft2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`;
  if (key === "kitchen") {
    const main = on("@main"), bar = on("@pendants"), strip = on("@strip");
    s += roomShell(I, "#2a5a96", "#3168ab", "#8aa9d4");
    s += windowOn(I, "y", 42, 82, 38, 72, night);
    s += glowPool(I, 55, 55, 52, main);
    s += box(0, 0, 0, 20, 20, 76, "#d7e2f1"); // fridge
    s += `<line x1="${P(20, 4, 44)[0]}" y1="${P(20, 4, 44)[1]}" x2="${P(20, 16, 44)[0]}" y2="${P(20, 16, 44)[1]}" stroke="#8ea3c4" stroke-width="1"/>`;
    s += box(0, 22, 58, 13, 66, 17, "#e7eef8"); // upper cabinets
    if (strip) s += `<line x1="${P(13, 23, 57)[0]}" y1="${P(13, 23, 57)[1]}" x2="${P(13, 87, 57)[0]}" y2="${P(13, 87, 57)[1]}" stroke="#8fe6ff" stroke-width="3" filter="url(#soft2)" class="h3d-glow"/>
      <line x1="${P(13, 23, 57)[0]}" y1="${P(13, 23, 57)[1]}" x2="${P(13, 87, 57)[0]}" y2="${P(13, 87, 57)[1]}" stroke="#e6fbff" stroke-width="1"/>`;
    s += box(0, 22, 0, 19, 66, 30, "#e9eff8"); // base cabinets
    s += box(0, 22, 30, 21, 66, 3, "#5d7ea8"); // counter
    s += box(4, 30, 33, 8, 10, 2, "#c9d6ea"); // sink
    s += box(46, 36, 0, 28, 40, 28, "#2f5b94"); // island
    s += box(44, 34, 28, 32, 44, 3.5, "#f1f5fb");
    s += pendant(I, 60, 46, 92, 62, bar) + pendant(I, 60, 66, 92, 62, bar);
    s += box(82, 42, 0, 7, 7, 20, "#cfdcee") + box(82, 62, 0, 7, 7, 20, "#cfdcee");
    const [cx, cy] = P(50, 20, 89);
    s += `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="4" fill="${main ? "#fff4cf" : "#c8d4e8"}"/>` + (main ? `<ellipse cx="${cx}" cy="${cy + 6}" rx="26" ry="10" fill="${WARM}" opacity=".35" filter="url(#soft)" class="h3d-glow"/>` : "");
  } else if (key === "dining") {
    const din = on("@chandelier"), cab = on("@cabinet"), km = on("@doorway");
    s += roomShell(I, "#264f86", "#2d62a3", "#9db8dd");
    // doorway to kitchen on left wall
    s += poly([P(0, 18, 0), P(0, 40, 0), P(0, 40, 58), P(0, 18, 58)], km ? "#ffe2a0" : "#16294a");
    if (km) s += `<polygon points="${pts([P(0, 18, 0), P(0, 40, 0), P(26, 46, 0), P(20, 22, 0)])}" fill="${WARM}" opacity=".35" filter="url(#soft2)" class="h3d-glow"/>`;
    s += windowOn(I, "x", 58, 86, 36, 70, night);
    // hutch / cabinet on right wall
    s += box(52, 0, 0, 38, 15, 62, "#e3ebf6");
    const gl = cab ? "#ffe39c" : "#6e86ad";
    [[55, 70], [72, 87]].forEach(([a, b]) => {
      s += poly([P(a, 15, 26), P(b, 15, 26), P(b, 15, 58), P(a, 15, 58)], gl, cab ? 'class="h3d-flicker"' : "");
      s += `<line x1="${P(a, 15, 42)[0]}" y1="${P(a, 15, 42)[1]}" x2="${P(b, 15, 42)[0]}" y2="${P(b, 15, 42)[1]}" stroke="#fff" stroke-width="1"/>`;
    });
    if (cab) s += `<ellipse cx="${P(71, 22, 30)[0]}" cy="${P(71, 22, 30)[1]}" rx="30" ry="16" fill="${WARM}" opacity=".3" filter="url(#soft)" class="h3d-glow"/>`;
    s += glowPool(I, 50, 56, 44, din);
    s += poly([P(26, 34, 0.2), P(78, 34, 0.2), P(78, 80, 0.2), P(26, 80, 0.2)], "#7f9fcc");
    // chairs back row
    s += box(40, 30, 0, 8, 7, 14, "#f0f4fa") + box(40, 30, 14, 8, 2, 14, "#f0f4fa") + box(58, 30, 0, 8, 7, 14, "#f0f4fa") + box(58, 30, 14, 8, 2, 14, "#f0f4fa");
    s += box(34, 42, 0, 3, 3, 24, "#b98c5c") + box(70, 42, 0, 3, 3, 24, "#b98c5c") + box(34, 66, 0, 3, 3, 24, "#b98c5c") + box(70, 66, 0, 3, 3, 24, "#b98c5c");
    s += box(32, 40, 24, 43, 30, 3.5, "#d9b48a");
    s += box(41, 74, 0, 8, 7, 14, "#f0f4fa") + box(41, 79, 14, 8, 2, 14, "#f0f4fa") + box(59, 74, 0, 8, 7, 14, "#f0f4fa") + box(59, 79, 14, 8, 2, 14, "#f0f4fa");
    s += pendant(I, 53, 55, 92, 58, din, true, true);
  } else if (key === "living") {
    const tv = on("@tv"), fan = on("@fan");
    const act = st["@thermostat#action"] || "idle";
    s += roomShell(I, "#285894", "#2f66aa", "#93b2db");
    s += windowOn(I, "x", 56, 84, 36, 72, night);
    s += poly([P(26, 30, 0.2), P(84, 30, 0.2), P(84, 74, 0.2), P(26, 74, 0.2)], "#c7d7ee");
    s += poly([P(32, 36, 0.4), P(78, 36, 0.4), P(78, 68, 0.4), P(32, 68, 0.4)], "#a9c1e3");
    s += box(26, 0, 0, 50, 13, 15, "#e5ecf6"); // tv stand
    s += box(46, 4, 15, 6, 5, 2, "#1b2233") + `<circle cx="${P(52, 7, 16)[0]}" cy="${P(52, 7, 16)[1]}" r="1" fill="${tv ? "#ffb347" : "#3a4458"}"/>`;
    s += box(28, 0, 30, 46, 3, 28, "#121a2b");
    const scr = [P(30, 3, 32), P(72, 3, 32), P(72, 3, 56), P(30, 3, 56)];
    s += tv ? `<defs><linearGradient id="tvg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4fb3ff"><animate attributeName="stop-color" values="#4fb3ff;#7be0c3;#a98bff;#4fb3ff" dur="6s" repeatCount="indefinite"/></stop><stop offset="1" stop-color="#1d3f8f"><animate attributeName="stop-color" values="#1d3f8f;#2b6f8f;#4a2f8f;#1d3f8f" dur="6s" repeatCount="indefinite"/></stop></linearGradient></defs>` +
      poly(scr, "url(#tvg)") + `<ellipse cx="${P(51, 30, 0)[0]}" cy="${P(51, 30, 0)[1]}" rx="40" ry="16" fill="#6fc3ff" opacity=".2" filter="url(#soft)" class="h3d-glow"/>`
      : poly(scr, "#0b1120");
    // thermostat on left wall
    const tc = act === "heating" ? "#ff9a4a" : act === "cooling" ? "#5ec8ff" : "#cfe0f5";
    const [tx, ty] = P(0, 30, 48);
    s += `<circle cx="${tx}" cy="${ty}" r="5" fill="#eef3fa" stroke="#9fb3d1" stroke-width="1"/><circle cx="${tx}" cy="${ty}" r="3" fill="${tc}" class="${act !== "idle" ? "h3d-pulse" : ""}" style="transform-origin:${tx}px ${ty}px"/>`;
    s += box(40, 42, 0, 26, 14, 9, "#e9eff8"); // coffee table
    s += box(48, 46, 9, 5, 5, 3, "#7fb6e8");
    // sofa
    s += box(24, 72, 0, 58, 22, 12, "#3f74bd") + box(24, 72, 12, 7, 22, 9, "#3f74bd") + box(75, 72, 12, 7, 22, 9, "#3f74bd");
    s += box(31, 74, 12, 21, 13, 4, "#5c90d8") + box(53, 74, 12, 21, 13, 4, "#5c90d8");
    s += box(24, 88, 12, 58, 7, 18, "#356aaf");
    // ceiling fan
    const [fx, fy] = P(54, 46, 82), [rx, ry] = P(54, 46, 92);
    s += `<line x1="${rx}" y1="${ry}" x2="${fx}" y2="${fy}" stroke="#dfe8f6" stroke-width="1.6"/>
      <g transform="translate(${fx},${fy}) scale(1,.5)"><g>
      ${[0, 90, 180, 270].map((a) => `<ellipse cx="0" cy="-14" rx="4.5" ry="14" fill="#e9f0fa" stroke="#9fb3d1" stroke-width=".6" transform="rotate(${a})"/>`).join("")}
      ${fan ? `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".7s" repeatCount="indefinite"/>` : ""}</g></g>
      <circle cx="${fx}" cy="${fy}" r="3.4" fill="#c8d6ea" stroke="#7d93b8" stroke-width=".6"/>`;
    if (fan) s += `<g opacity=".5">${[0, 1, 2].map((i) => `<path d="M ${fx - 20 + i * 18} ${fy + 22} q 4 6 0 12" stroke="#cfe9ff" stroke-width="1.2" fill="none" class="h3d-breeze" style="animation-delay:${i * 0.35}s"/>`).join("")}</g>`;
  } else if (key === "bedroom") {
    const sl = on("@lamp_left"), cl = on("@lamp_right"), nl = on("@nightlight");
    s += roomShell(I, "#2b4f8f", "#3460a8", "#a3bde0");
    s += windowOn(I, "y", 30, 62, 38, 72, night);
    s += glowPool(I, 12, 20, 30, sl) + glowPool(I, 12, 84, 30, cl);
    s += poly([P(20, 28, 0.2), P(78, 28, 0.2), P(78, 80, 0.2), P(20, 80, 0.2)], "#c4d4ec");
    // purifier back-right corner
    s += box(80, 4, 0, 12, 12, 30, "#f3f6fb");
    const [px, py] = P(86, 10, 30);
    s += `<ellipse cx="${px}" cy="${py}" rx="8" ry="3.5" fill="${nl ? "#7dffb0" : "#c3cfdf"}" class="${nl ? "h3d-glow" : ""}"/>` + (nl ? `<ellipse cx="${px}" cy="${py + 6}" rx="20" ry="12" fill="#57f0a0" opacity=".3" filter="url(#soft)" class="h3d-glow"/>` : "");
    // nightstand + lamp (lamp_left)
    const lamp = (y, onx) => box(0, y, 0, 14, 12, 18, "#e6edf7") + box(5, y + 4, 18, 3, 3, 9, "#9fb3d1") +
      box(2, y + 1, 27, 9, 9, 8, onx ? "#ffe7a8" : "#d6dfec", onx ? { top: "#fff5d6", right: "#ffe39a", left: "#f5cf74" } : {}) +
      (onx ? `<circle cx="${P(6, y + 6, 31)[0]}" cy="${P(6, y + 6, 31)[1]}" r="16" fill="${WARM}" opacity=".35" filter="url(#soft)" class="h3d-glow"/>` : "");
    s += lamp(14, sl);
    // bed
    s += box(0, 30, 0, 6, 44, 40, "#3b6db3");
    s += box(6, 30, 0, 56, 44, 15, "#eef3fa");
    s += box(9, 34, 15, 11, 17, 6, "#ffffff") + box(9, 53, 15, 11, 17, 6, "#ffffff");
    s += box(24, 29, 15, 39, 46, 4.5, "#5b8fd8");
    s += box(56, 29, 0, 7, 46, 19.5, "#4a7fca", { top: "#5b8fd8" });
    s += lamp(78, cl);
  }
  return `<svg viewBox="8 2 184 188" class="roomsvg">${s}</svg>`;
}

/* ---------- house scene ---------- */
function houseSVG(night, cold, roof) {
  const I = mkIso(150, 104, 1.45);
  const { P, poly, box, pts } = I;
  let s = `<defs><filter id="hsoft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    <radialGradient id="hshadow"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
  const [sx, sy] = P(50, 50, -26);
  s += `<ellipse cx="${sx}" cy="${sy + 18}" rx="150" ry="42" fill="url(#hshadow)"/>`;
  s += box(0, 0, -16, 100, 100, 16, "#3c6aa8", { top: "#5f8ccc", right: "#2b5288", left: "#1f3f6c" });
  s += poly([P(4, 4, 0.1), P(96, 4, 0.1), P(96, 96, 0.1), P(4, 96, 0.1)], "#4f8a76"); // lawn
  // path stones
  [[52, 76], [55, 84], [52, 92]].forEach(([x, y]) => (s += poly([P(x, y, 0.3), P(x + 6, y, 0.3), P(x + 6, y + 5, 0.3), P(x, y + 5, 0.3)], "#c9d7ea")));
  const tree = (x, y, h, c = "#2f7a5b") => {
    const [bx, by] = P(x, y, 6), [tx, ty] = P(x, y, h);
    return box(x - 1.2, y - 1.2, 0, 2.4, 2.4, 7, "#7a5a44") +
      `<g class="h3d-treesway" style="transform-origin:${bx}px ${by}px"><polygon points="${bx - 13},${by} ${tx},${ty} ${bx},${by + 5}" fill="${shade(c, 12)}"/><polygon points="${bx},${by + 5} ${tx},${ty} ${bx + 13},${by}" fill="${shade(c, -18)}"/></g>`;
  };
  s += tree(12, 14, 34) + tree(86, 10, 30, "#2a6e52");
  // house body
  s += box(30, 28, 0, 42, 40, 30, "#eef3fb", { right: "#dfe7f3", left: "#c6d3e6", top: "#eef3fb" });
  // windows
  const win = night ? "#ffd57a" : "#9fd2ff";
  const wcls = night ? 'class="h3d-flicker"' : "";
  s += poly([P(72, 34, 10), P(72, 44, 10), P(72, 44, 22), P(72, 34, 22)], win, wcls + ' stroke="#fff" stroke-width="1.4"');
  s += poly([P(72, 52, 10), P(72, 62, 10), P(72, 62, 22), P(72, 52, 22)], win, wcls + ' stroke="#fff" stroke-width="1.4"');
  s += poly([P(36, 68, 10), P(46, 68, 10), P(46, 68, 22), P(36, 68, 22)], win, wcls + ' stroke="#fff" stroke-width="1.4"');
  s += poly([P(52, 68, 0), P(61, 68, 0), P(61, 68, 18), P(52, 68, 18)], "#1f5a3d", 'stroke="#eef3fb" stroke-width="1"');
  s += `<circle cx="${P(59, 68, 9)[0]}" cy="${P(59, 68, 9)[1]}" r="1" fill="#ffd57a"/>`;
  if (night) s += `<ellipse cx="${P(56, 80, 0)[0]}" cy="${P(56, 80, 0)[1]}" rx="34" ry="14" fill="#ffcf6b" opacity=".25" filter="url(#hsoft)" class="h3d-glow"/>`;
  // roof (dark green), ridge along x
  const G = roof || "#1d5c3d";
  s += poly([P(26, 24, 28), P(76, 24, 28), P(76, 48, 50), P(26, 48, 50)], shade(G, -25));
  s += box(36, 34, 38, 6, 6, 22, "#c3cfe0"); // chimney
  s += poly([P(72, 28, 30), P(72, 68, 30), P(72, 48, 50)], "#e2e9f4");
  s += poly([P(26, 72, 28), P(76, 72, 28), P(76, 48, 50), P(26, 48, 50)], G);
  s += poly([P(76, 72, 28), P(76, 72, 26), P(76, 48, 48), P(76, 48, 50)], shade(G, -35));
  s += poly([P(26, 72, 28), P(76, 72, 28), P(76, 72, 26), P(26, 72, 26)], shade(G, -40));
  s += `<line x1="${P(26, 48, 50)[0]}" y1="${P(26, 48, 50)[1]}" x2="${P(76, 48, 50)[0]}" y2="${P(76, 48, 50)[1]}" stroke="${shade(G, 30)}" stroke-width="2"/>`;
  if (night || cold) {
    const [cx, cy] = P(39, 37, 62);
    s += [0, 1, 2].map((i) => `<circle cx="${cx}" cy="${cy}" r="${5 + i}" fill="#dfe8f5" opacity="0" class="h3d-smoke" style="animation-delay:${i * 1.3}s"/>`).join("");
  }
  // front bushes and trees
  s += tree(14, 80, 26, "#2f7a5b") + tree(84, 84, 24, "#357f60");
  [[40, 74], [66, 74]].forEach(([x, y]) => {
    const [bx, by] = P(x, y, 3);
    s += `<circle cx="${bx}" cy="${by}" r="6" fill="#3b8a66"/><circle cx="${bx + 5}" cy="${by + 1}" r="4.5" fill="#2f7356"/>`;
  });
  return `<svg viewBox="0 0 300 300" class="housesvg">${s}</svg>`;
}

/* ---------- gauges ---------- */
function dropSVG(h) {
  const lvl = Math.max(0, Math.min(100, h || 0));
  const y = 88 - (lvl / 100) * 72;
  return `<svg viewBox="0 0 80 100" width="80" height="100" class="dropsvg">
    <defs><clipPath id="dclip"><path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z"/></clipPath>
    <linearGradient id="dwater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2a7bdc"/></linearGradient>
    <radialGradient id="dglass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".5" stop-color="#d6e9ff" stop-opacity=".45"/><stop offset="1" stop-color="#9ec5f0" stop-opacity=".6"/></radialGradient></defs>
    <path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z" fill="url(#dglass)"/>
    <g clip-path="url(#dclip)"><g class="h3d-wave"><path d="M -40 ${y} q 10 -5 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 V 100 H -40 Z" fill="url(#dwater)"/></g></g>
    <path d="M40 8 C 40 8 12 44 12 62 a 28 28 0 0 0 56 0 C 68 44 40 8 40 8 Z" fill="none" stroke="#e8f3ff" stroke-width="2"/>
    <ellipse cx="29" cy="52" rx="5" ry="10" fill="#fff" opacity=".55" transform="rotate(20 29 52)"/></svg>`;
}
function baroSVG(p, unit) {
  let inHg = p;
  if (unit === "hPa" || unit === "mbar") inHg = p * 0.02953;
  else if (unit === "psi") inHg = p * 2.03602;
  const ang = Math.max(-130, Math.min(130, ((inHg - 29.92) / 1.1) * 130));
  const ticks = Array.from({ length: 27 }, (_, i) => {
    const a = ((-130 + i * 10) * Math.PI) / 180, big = i % 5 === 0;
    return `<line x1="${50 + Math.sin(a) * 36}" y1="${50 - Math.cos(a) * 36}" x2="${50 + Math.sin(a) * (big ? 29 : 32)}" y2="${50 - Math.cos(a) * (big ? 29 : 32)}" stroke="#2b3f5e" stroke-width="${big ? 2 : 1}"/>`;
  }).join("");
  return `<svg viewBox="0 0 100 100" width="96" height="96">
    <defs><radialGradient id="bface" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4deec"/></radialGradient>
    <linearGradient id="brim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe8f5"/><stop offset=".5" stop-color="#7f95b8"/><stop offset="1" stop-color="#3d5478"/></linearGradient></defs>
    <circle cx="50" cy="53" r="46" fill="rgba(0,0,0,.35)" filter="blur(2px)"/>
    <circle cx="50" cy="50" r="46" fill="url(#brim)"/><circle cx="50" cy="50" r="40" fill="url(#bface)"/>
    <path d="M ${50 + Math.sin(-2.27) * 38} ${50 - Math.cos(-2.27) * 38} A 38 38 0 0 1 ${50 + Math.sin(-0.6) * 38} ${50 - Math.cos(-0.6) * 38}" stroke="#5aa8ff" stroke-width="3" fill="none" opacity=".7"/>
    <path d="M ${50 + Math.sin(0.6) * 38} ${50 - Math.cos(0.6) * 38} A 38 38 0 0 1 ${50 + Math.sin(2.27) * 38} ${50 - Math.cos(2.27) * 38}" stroke="#ffbf4a" stroke-width="3" fill="none" opacity=".7"/>
    ${ticks}
    <text x="50" y="72" font-size="8" text-anchor="middle" fill="#2b3f5e" font-weight="700">${inHg.toFixed(2)}</text>
    <g style="transform:rotate(${ang}deg);transform-origin:50px 50px;transition:transform 2s cubic-bezier(.3,1.6,.5,1)"><g class="h3d-needle" style="transform-origin:50px 50px">
      <path d="M 50 18 L 53 50 L 47 50 Z" fill="#e2453c"/><path d="M 50 62 L 52.5 50 L 47.5 50 Z" fill="#2b3f5e"/></g></g>
    <circle cx="50" cy="50" r="4.5" fill="#2b3f5e"/><circle cx="49" cy="49" r="1.5" fill="#9fb3d1"/>
    <ellipse cx="38" cy="30" rx="18" ry="9" fill="#fff" opacity=".35" transform="rotate(-25 38 30)"/></svg>`;
}
function sockHTML(speed, bearing) {
  // wind FROM bearing -> sock points to bearing+180. Screen: north = away from viewer.
  const to = ((bearing || 0) + 180) % 360;
  const droop = Math.max(0, 55 - (speed || 0) * 4); // degrees down
  const dur = Math.max(0.35, 1.6 - (speed || 0) * 0.07);
  const stripes = [0, 1, 2, 3, 4].map((i) => `<path d="M ${4 + i * 11} ${11 - i * 1.3} L ${15 + i * 11} ${11 - (i + 1) * 1.3} L ${15 + i * 11} ${25 + (i + 1) * 1.3} L ${4 + i * 11} ${25 + i * 1.3} Z" fill="${i % 2 ? "#ffffff" : "#ff6a3d"}"/>`).join("");
  return `<div class="sock-wrap">
    <div class="sock-dial"><span style="transform:rotate(0deg) translateY(-34px)">N</span></div>
    <div class="sock-pole"></div>
    <div class="sock-rot" style="transform:rotateY(${-(to - 90)}deg)">
      <div class="sock-droop" style="transform:rotateZ(${droop}deg)">
        <svg viewBox="0 0 64 36" width="100" height="56" class="sock" style="animation-duration:${dur}s">${stripes}
        <ellipse cx="4" cy="18" rx="2.5" ry="7.5" fill="#c7d2e3"/></svg></div></div></div>`;
}
function calSVG(d) {
  const mon = d.toLocaleString(H3D_LOCALE, { month: "short" }).toUpperCase();
  return `<svg viewBox="0 0 100 100" width="92" height="92">
    <defs><linearGradient id="calr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#d93b4a"/></linearGradient></defs>
    <rect x="14" y="20" width="76" height="72" rx="10" fill="#9fb3d1"/>
    <rect x="10" y="16" width="76" height="72" rx="10" fill="#ffffff"/>
    <path d="M10 26 a10 10 0 0 1 10 -10 h56 a10 10 0 0 1 10 10 v10 h-76 Z" fill="url(#calr)"/>
    <text x="48" y="32" font-size="11" text-anchor="middle" fill="#fff" font-weight="800" letter-spacing="1">${mon}</text>
    <g class="h3d-flip"><text x="48" y="74" font-size="34" text-anchor="middle" fill="#1d2d48" font-weight="800">${d.getDate()}</text></g>
    <rect x="26" y="9" width="6" height="14" rx="3" fill="#41557a"/><rect x="64" y="9" width="6" height="14" rx="3" fill="#41557a"/></svg>`;
}

const CSS = `
:host{display:block}
*{box-sizing:border-box}
.outer{width:100%;display:flex;justify-content:center;align-items:flex-start;overflow:hidden;background:#0a1a33}
.stage{position:relative;width:1280px;height:720px;transform-origin:top left;font-family:Nunito,"Varela Round","Segoe UI",system-ui,sans-serif;color:#eef4ff;overflow:hidden;
  background:radial-gradient(1200px 700px at 30% 20%,#1d4277 0%,#122c55 45%,#0a1a33 100%);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.bokeh{position:absolute;border-radius:50%;filter:blur(40px);opacity:.35;animation:bok 24s ease-in-out infinite alternate}
@keyframes bok{0%{transform:translate(0,0)}100%{transform:translate(80px,-40px)}}
.abs{position:absolute}
.clock{left:40px;top:18px;font-size:118px;font-weight:900;letter-spacing:-2px;line-height:1;
  text-shadow:0 1px 0 #c9d8ee,0 2px 0 #b6c8e3,0 3px 0 #a3b8d8,0 4px 0 #8fa7cc,0 5px 0 #7b96c0,0 6px 0 #6886b4,0 7px 0 #5677a8,0 12px 18px rgba(0,0,0,.55)}
.clock small{font-size:34px;font-weight:800;margin-left:8px;letter-spacing:0;text-shadow:0 2px 0 #7b96c0,0 6px 10px rgba(0,0,0,.5)}
.date{left:46px;top:146px;font-size:22px;font-weight:700;color:#b9cbe6}
.house{left:10px;top:150px;width:420px;height:420px}
.housesvg{width:420px;height:420px;filter:drop-shadow(0 18px 18px rgba(0,0,0,.35));animation:hfloat 7s ease-in-out infinite}
@keyframes hfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.wx{left:250px;top:158px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.4))}
.precip{position:absolute;left:40px;top:250px;width:360px;height:260px;overflow:hidden;pointer-events:none;
  -webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 55%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 40%,#000 55%,transparent 75%)}
.precip i{position:absolute;top:-20px;width:2px;height:14px;background:linear-gradient(#cfe9ff00,#9fd3ff);border-radius:2px;animation:rain 1s linear infinite}
.precip i.sn{width:7px;height:7px;border-radius:50%;background:#fff;animation:snow 4s linear infinite}
@keyframes rain{to{transform:translateY(300px)}}
@keyframes snow{0%{transform:translate(0,0)}50%{transform:translate(12px,150px)}100%{transform:translate(-6px,300px)}}
.gauges{left:24px;top:516px;display:flex;gap:16px}
.gauge{width:118px;display:flex;flex-direction:column;align-items:center;position:relative}
.gauge .ped{position:absolute;top:84px}
.gauge .g-top{height:104px;display:flex;align-items:flex-end;justify-content:center;position:relative;z-index:2}
.gauge .val{margin-top:30px;font-size:20px;font-weight:800;z-index:2}
.gauge .lbl{font-size:13px;color:#9fb5d6;font-weight:700;letter-spacing:.5px}
.dropsvg{filter:drop-shadow(0 8px 8px rgba(0,0,0,.35));animation:hfloat 4s ease-in-out infinite}
.sock-wrap{position:relative;width:110px;height:104px;perspective:380px}
.sock-dial{position:absolute;left:15px;top:78px;width:80px;height:80px;border-radius:50%;transform:rotateX(72deg);border:2px dashed rgba(200,220,255,.35)}
.sock-dial span{position:absolute;left:34px;top:30px;font-size:13px;font-weight:900;color:#ffb36b;display:block}
.sock-pole{position:absolute;left:53px;top:12px;width:4px;height:90px;border-radius:2px;background:linear-gradient(90deg,#8ea3c4,#eef4ff,#8ea3c4)}
.sock-rot{position:absolute;left:55px;top:12px;width:0;height:0;transform-style:preserve-3d;transition:transform 2.5s ease}
.sock-droop{position:absolute;left:0;top:-28px;transform-origin:0 28px;transition:transform 2s ease;transform-style:preserve-3d}
.sock{display:block;transform-origin:0 28px;animation:flap 1s ease-in-out infinite alternate;filter:drop-shadow(0 4px 4px rgba(0,0,0,.35))}
@keyframes flap{0%{transform:skewY(-4deg) scaleX(.96)}100%{transform:skewY(4deg) scaleX(1.03)}}
.hdr{top:22px;font-size:17px;color:#a9bfdf;font-weight:700;letter-spacing:.3px}
.big{top:46px;font-size:84px;font-weight:900;line-height:1;
  text-shadow:0 1px 0 #c9d8ee,0 2px 0 #b6c8e3,0 3px 0 #a3b8d8,0 4px 0 #8fa7cc,0 5px 0 #7b96c0,0 10px 16px rgba(0,0,0,.5)}
.rooms{left:450px;top:176px;display:flex;gap:14px}
.room{width:194px;cursor:pointer;display:flex;flex-direction:column;align-items:center;animation:rfloat 6s ease-in-out infinite;transition:transform .2s}
.room:active{transform:scale(.94)}
.room .roomsvg{width:194px;height:196px;filter:drop-shadow(0 14px 14px rgba(0,0,0,.4));transition:filter .3s}
.room.lit .roomsvg{filter:drop-shadow(0 14px 14px rgba(0,0,0,.4)) drop-shadow(0 0 14px rgba(255,210,122,.35))}
.room .nm{font-size:19px;font-weight:800;margin-top:2px}
.room .st{font-size:26px;font-weight:900;margin-top:0}
.room .st small{font-size:15px;color:#a9bfdf;font-weight:700}
@keyframes rfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.fc{left:458px;top:488px;display:flex;gap:6px}
.fday{width:116px;display:flex;flex-direction:column;align-items:center;position:relative}
.fday .ic{height:92px;display:flex;align-items:flex-end;z-index:2}
.fday .ped{position:absolute;top:74px}
.fday .dn{margin-top:42px;font-size:16px;font-weight:800;color:#b9cbe6}
.fday .tp{font-size:24px;font-weight:900}.fday .tp small{font-size:15px;color:#9fb5d6;margin-left:4px}
.cal{left:836px;top:494px;display:flex;flex-direction:column;align-items:center;position:relative;width:116px}
.cal .ped{position:absolute;top:70px}
.cal svg{z-index:2;filter:drop-shadow(0 8px 8px rgba(0,0,0,.35))}
.events{left:968px;top:500px;width:290px;display:flex;flex-direction:column;gap:12px}
.ev{display:flex;gap:10px;align-items:flex-start}
.ev .dot{width:11px;height:11px;border-radius:50%;margin-top:6px;flex:none;background:#ffbf4a;box-shadow:0 0 8px #ffbf4a}
.ev .t{font-size:14px;color:#9fb5d6;font-weight:700}
.ev .s{font-size:18px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:262px}
/* popup */
.pop{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(8,22,46,.72),rgba(3,10,22,.9));display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;z-index:20}
.pop.open{opacity:1;pointer-events:auto}
.panel{width:860px;min-height:420px;border-radius:34px;padding:26px 30px 30px;background:linear-gradient(160deg,#21497f,#142f58);
  box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.12),inset 0 -6px 0 rgba(0,0,0,.25);transform:translateY(30px) scale(.94);transition:transform .3s cubic-bezier(.2,1.4,.4,1)}
.pop.open .panel{transform:none}
.ph{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.ph .mini{width:96px;height:96px;margin:-18px 0 -18px -10px}
.ph .mini svg{width:96px;height:96px}
.ph h2{margin:0;font-size:34px;font-weight:900;flex:1}
.x{width:62px;height:62px;border-radius:50%;border:0;background:#2d5c99;color:#fff;font-size:30px;font-weight:900;box-shadow:0 6px 0 #1a3a66,0 10px 18px rgba(0,0,0,.4);cursor:pointer}
.x:active{transform:translateY(4px);box-shadow:0 2px 0 #1a3a66}
.grid{display:flex;gap:20px;flex-wrap:wrap}
.tile{flex:1 1 220px;min-height:190px;border-radius:26px;padding:18px;cursor:pointer;position:relative;
  background:linear-gradient(160deg,#2d5c99,#1f467d);box-shadow:0 8px 0 #163460,0 16px 24px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.15);
  transition:transform .12s,box-shadow .12s,background .3s;display:flex;flex-direction:column}
.tile:active{transform:translateY(6px);box-shadow:0 2px 0 #163460,0 6px 12px rgba(0,0,0,.4)}
.tile.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 8px 0 #b97a22,0 16px 30px rgba(255,190,80,.35),inset 0 2px 0 rgba(255,255,255,.5)}
.tile.on.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 8px 0 #1f6ea3,0 16px 30px rgba(90,200,255,.35),inset 0 2px 0 rgba(255,255,255,.5)}
.tile .ib{width:70px;height:70px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);margin-bottom:auto}
.tile.on .ib{background:rgba(255,255,255,.45)}
.tile ha-icon{--mdc-icon-size:44px}
.tile.on ha-icon{animation:iconpop .5s}
.tile.on .spin ha-icon{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes iconpop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.tile .tn{font-size:22px;font-weight:900;margin-top:14px}
.tile .ts{font-size:17px;font-weight:700;opacity:.8}
.tile input[type=range]{width:100%;margin-top:12px;height:34px;-webkit-appearance:none;appearance:none;background:transparent}
.tile input[type=range]::-webkit-slider-runnable-track{height:12px;border-radius:6px;background:rgba(0,0,0,.25)}
.tile input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:34px;height:34px;border-radius:50%;margin-top:-11px;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.tile.warn{background:linear-gradient(160deg,#ff8a7a,#e0524a);color:#fff}
.therm{flex:1 1 100%;cursor:default;flex-direction:row;align-items:center;gap:26px;min-height:200px}
.therm:active{transform:none}
.therm .cur{font-size:72px;font-weight:900;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.25)}
.therm .act{font-size:18px;font-weight:800;opacity:.85;text-transform:capitalize}
.sp{display:flex;flex-direction:column;align-items:center;gap:6px}
.sp .l{font-size:15px;font-weight:800;opacity:.8}
.sp .row{display:flex;align-items:center;gap:12px}
.sp .v{font-size:40px;font-weight:900;min-width:70px;text-align:center}
.rb{width:58px;height:58px;border-radius:50%;border:0;font-size:32px;font-weight:900;color:#fff;cursor:pointer;background:#3f78c4;box-shadow:0 5px 0 #24508c,0 8px 14px rgba(0,0,0,.35)}
.rb:active{transform:translateY(4px);box-shadow:0 1px 0 #24508c}
.modes{display:flex;flex-direction:column;gap:8px;margin-left:auto}
.mb{padding:10px 16px;border-radius:14px;border:0;font-size:16px;font-weight:800;color:#dbe7f8;background:#25518e;cursor:pointer;box-shadow:0 4px 0 #173a6a}
.mb.sel{background:#ffd67e;color:#3a2408;box-shadow:0 4px 0 #b97a22}
/* svg anims */
.h3d-rays{animation:spin 18s linear infinite}
.h3d-pulse{animation:pulse 3s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.h3d-float{animation:hfloat 5s ease-in-out infinite}
.h3d-twinkle{animation:tw 2.4s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:1}}
.h3d-drift{animation:drift 7s ease-in-out infinite alternate}
.h3d-drift2{animation:drift 9s ease-in-out infinite alternate-reverse}
@keyframes drift{0%{transform:translateX(-6px)}100%{transform:translateX(8px)}}
.h3d-drop{animation:dropf 1s linear infinite}
@keyframes dropf{0%{transform:translateY(-6px);opacity:0}30%{opacity:1}100%{transform:translateY(22px);opacity:0}}
.h3d-flake{animation:flk 2.4s linear infinite}
@keyframes flk{0%{transform:translate(0,-8px);opacity:0}30%{opacity:1}100%{transform:translate(5px,24px);opacity:0}}
.h3d-flash{animation:flash 2.6s steps(1) infinite}
@keyframes flash{0%,100%{opacity:0}8%,14%{opacity:1}11%{opacity:.2}}
.h3d-fog{animation:fogm 4s ease-in-out infinite alternate}
@keyframes fogm{0%{transform:translateX(-6px);opacity:.6}100%{transform:translateX(6px);opacity:1}}
.h3d-glow{animation:glow 3.5s ease-in-out infinite}
@keyframes glow{0%,100%{opacity:.28}50%{opacity:.48}}
.h3d-flicker{animation:flick 5s ease-in-out infinite}
@keyframes flick{0%,100%{opacity:1}45%{opacity:.82}50%{opacity:.95}55%{opacity:.85}}
.h3d-sway{animation:sway 4s ease-in-out infinite}
@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.h3d-treesway{animation:tsway 5s ease-in-out infinite}
@keyframes tsway{0%,100%{transform:skewX(-2deg)}50%{transform:skewX(2deg)}}
.h3d-smoke{animation:smoke 4s ease-out infinite}
@keyframes smoke{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:.7}100%{opacity:0;transform:translate(14px,-46px) scale(2)}}
.h3d-breeze{animation:breeze 1.2s ease-in-out infinite}
@keyframes breeze{0%{opacity:0;transform:translateY(-4px)}50%{opacity:1}100%{opacity:0;transform:translateY(8px)}}
.h3d-wave{animation:wave 2.4s linear infinite}
@keyframes wave{to{transform:translateX(40px)}}
.h3d-needle{animation:needle 3s ease-in-out infinite}
@keyframes needle{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
.h3d-flip{animation:flipin 1.2s ease-out}
@keyframes flipin{0%{transform:scaleY(0);opacity:0}100%{transform:scaleY(1);opacity:1}}
.h3d-flip{transform-origin:48px 60px}
`;

class Home3DCard extends HTMLElement {
  setConfig(config) {
    this._cfg = Object.assign({}, H3D_DEFAULTS, config || {});
    if (!this._cfg.weather) throw new Error("home3d-card: 'weather' entity is required");
    if ((this._cfg.rooms || []).length > 4) throw new Error("home3d-card: at most 4 rooms fit on the canvas");
    H3D_LOCALE = this._cfg.locale || "en-US";
    this._sig = {};
  }
  static getStubConfig() { return {}; }
  getCardSize() { return 12; }

  connectedCallback() {
    if (!document.getElementById("h3d-font")) {
      const l = document.createElement("link");
      l.id = "h3d-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap";
      document.head.appendChild(l);
    }
    this._tick = setInterval(() => this._clock(), 1000);
    this._evTimer = setInterval(() => this._loadEvents(), 15 * 60 * 1000);
    this._ro = new ResizeObserver(() => this._fit());
    this._ro.observe(this);
    window.addEventListener("resize", (this._wr = () => this._fit()));
    if (this._hass && !this._unsubFc) this._subForecast();
  }
  disconnectedCallback() {
    clearInterval(this._tick); clearInterval(this._evTimer);
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
  _num(e, attr) {
    const s = this._st(e); if (!s) return NaN;
    return parseFloat(attr ? s.attributes[attr] : s.state);
  }

  _build() {
    this._built = true;
    const r = this.attachShadow({ mode: "open" });
    const rooms = this._cfg.rooms.map((rm, i) => `<div class="room" data-room="${i}" style="animation-delay:${i * 0.8}s"><div class="rsvg"></div><div class="nm">${rm.name}</div><div class="st"></div></div>`).join("");
    r.innerHTML = `<style>${CSS}</style><div class="outer"><div class="stage">
      <div class="bokeh" style="left:-80px;top:380px;width:420px;height:420px;background:#2e6bc4"></div>
      <div class="bokeh" style="left:760px;top:-120px;width:520px;height:380px;background:#3a5fb8;animation-delay:-8s"></div>
      <div class="bokeh" style="left:900px;top:460px;width:380px;height:300px;background:#1f8bb8;animation-delay:-14s"></div>
      <div class="abs clock"></div><div class="abs date"></div>
      <div class="abs house"></div><div class="precip"></div><div class="abs wx"></div>
      <div class="abs gauges">
        <div class="gauge"><div class="g-top g-hum"></div>${pedestal(112, 46)}<div class="val v-hum"></div><div class="lbl">HUMIDITY</div></div>
        <div class="gauge"><div class="g-top g-bar"></div>${pedestal(112, 46)}<div class="val v-bar"></div><div class="lbl">PRESSURE</div></div>
        <div class="gauge"><div class="g-top g-wind"></div>${pedestal(112, 46)}<div class="val v-wind"></div><div class="lbl">WIND</div></div>
      </div>
      <div class="abs hdr" style="left:460px">Outside · <span class="cond"></span></div><div class="abs big out" style="left:452px"></div>
      <div class="abs hdr" style="left:800px">${this._cfg.indoor_label}</div><div class="abs big in" style="left:792px"></div>
      <div class="abs rooms">${rooms}</div>
      <div class="abs fc"></div>
      <div class="abs cal"><div class="calic"></div>${pedestal(108, 44)}</div>
      <div class="abs events"></div>
      <div class="pop"><div class="panel"></div></div>
    </div></div>`;
    this._$ = (s) => r.querySelector(s);
    r.querySelectorAll(".room").forEach((el) => el.addEventListener("click", () => this._open(+el.dataset.room)));
    this._$(".pop").addEventListener("click", (e) => { if (e.target.classList.contains("pop")) this._close(); });
    this._clock();
    this._fit();
    const m = (location.hash || "").match(/room=(\d)/); // preview/testing aid: #room=N opens that room
    if (m) setTimeout(() => this._open(+m[1]), 1500);
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
    stage.style.marginRight = 1280 * k - 1280 + "px";
    stage.style.marginBottom = 720 * k - 720 + "px";
  }

  _clock() {
    if (!this._built) return;
    const d = new Date();
    const m = String(d.getMinutes()).padStart(2, "0");
    let t;
    if (String(this._cfg.time_format) === "24") t = `${String(d.getHours()).padStart(2, "0")}:${m}`;
    else { let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; t = `${h}:${m}<small>${ap}</small>`; }
    if (this._lastT !== t) { this._lastT = t; this._$(".clock").innerHTML = t; }
    const ds = d.toLocaleDateString(H3D_LOCALE, { weekday: "long", month: "long", day: "numeric" });
    if (this._lastD !== ds) {
      this._lastD = ds; this._$(".date").textContent = ds;
      this._$(".calic").innerHTML = calSVG(d);
    }
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

  _update() {
    if (!this._built || !this._hass) return;
    const C = this._cfg, W = this._st(C.weather), sun = this._st(C.sun);
    const night = sun ? sun.state === "below_horizon" : false;
    const a = W ? W.attributes : {};
    const outT = !isNaN(this._num(C.outside_temp)) ? this._num(C.outside_temp) : a.temperature;
    const cond = W ? W.state : "";
    // header temps
    const sigH = [Math.round(outT), cond].join();
    if (this._sig.h !== sigH) {
      this._sig.h = sigH;
      this._$(".out").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°";
      this._$(".cond").textContent = (cond || "").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    }
    const ins = (C.indoor || []).map((e) => (e.startsWith("climate.") ? this._num(e, "current_temperature") : this._num(e))).filter((v) => !isNaN(v));
    const avg = ins.length ? ins.reduce((p, c) => p + c, 0) / ins.length : NaN;
    const avgTxt = isNaN(avg) ? "--" : (Math.round(avg * 2) / 2).toFixed(1).replace(".0", "") + "°";
    if (this._sig.in !== avgTxt) { this._sig.in = avgTxt; this._$(".in").textContent = avgTxt; }
    // house + weather
    const cold = !isNaN(outT) && outT < 50;
    const sigW = [cond, night, cold].join();
    if (this._sig.w !== sigW) {
      this._sig.w = sigW;
      this._$(".house").innerHTML = houseSVG(night, cold, this._cfg.roof_color);
      this._$(".wx").innerHTML = weatherSVG(cond, night, 150);
      const pr = this._$(".precip");
      const rainy = ["rainy", "pouring", "lightning-rainy"].includes(cond), snowy = ["snowy", "snowy-rainy"].includes(cond);
      pr.innerHTML = rainy ? Array.from({ length: cond === "pouring" ? 60 : 34 }, () => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random()}s;animation-duration:${0.6 + Math.random() * 0.5}s"></i>`).join("")
        : snowy ? Array.from({ length: 30 }, () => `<i class="sn" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s;animation-duration:${3 + Math.random() * 3}s"></i>`).join("") : "";
    }
    // gauges
    const hum = a.humidity, pres = a.pressure, ws = a.wind_speed, wb = a.wind_bearing;
    const sigG = [hum, pres, ws, wb].join();
    if (this._sig.g !== sigG) {
      this._sig.g = sigG;
      this._$(".g-hum").innerHTML = dropSVG(hum);
      this._$(".v-hum").textContent = hum != null ? Math.round(hum) + "%" : "--";
      this._$(".g-bar").innerHTML = baroSVG(+pres || 29.92, a.pressure_unit);
      this._$(".v-bar").textContent = pres != null ? (+pres).toFixed(2) + " " + (a.pressure_unit || "") : "--";
      this._$(".g-wind").innerHTML = sockHTML(+ws || 0, +wb || 0);
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      this._$(".v-wind").textContent = ws != null ? `${Math.round(ws)} mph ${dirs[Math.round(((+wb || 0) % 360) / 45) % 8]}` : "--";
    }
    // forecast
    const fc = (this._forecast || []).slice(0, 3);
    const sigF = JSON.stringify(fc.map((f) => [f.condition, Math.round(f.temperature), Math.round(f.templow), f.datetime]));
    if (this._sig.fc !== sigF) {
      this._sig.fc = sigF;
      this._$(".fc").innerHTML = fc.map((f, i) => {
        const d = new Date(f.datetime);
        const dn = i === 0 ? "Today" : d.toLocaleDateString(H3D_LOCALE, { weekday: "short" });
        return `<div class="fday"><div class="ic">${weatherSVG(f.condition, false, 84)}</div>${pedestal(104, 42)}<div class="dn">${dn}</div><div class="tp">${Math.round(f.temperature)}°<small>${f.templow != null ? Math.round(f.templow) + "°" : ""}</small></div></div>`;
      }).join("");
    }
    // events
    const sigE = JSON.stringify(this._events || []) + (sun ? sun.attributes.next_setting : "");
    if (this._sig.ev !== sigE) {
      this._sig.ev = sigE;
      const fmt = (e) => {
        const d = e.t, today = new Date(); const tm = new Date(today); tm.setDate(today.getDate() + 1);
        const day = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === tm.toDateString() ? "Tomorrow" : d.toLocaleDateString(H3D_LOCALE, { weekday: "short" });
        return e.allDay ? `${day} · all day` : `${day} · ${d.toLocaleTimeString(H3D_LOCALE, { hour: "numeric", minute: "2-digit" })}`;
      };
      let html = (this._events || []).map((e) => `<div class="ev"><div class="dot"></div><div><div class="t">${fmt(e)}</div><div class="s">${e.s}</div></div></div>`).join("");
      if (sun) {
        const ns = new Date(sun.attributes.next_setting), nr = new Date(sun.attributes.next_rising);
        const tf = (d) => d.toLocaleTimeString(H3D_LOCALE, { hour: "numeric", minute: "2-digit" });
        if ((this._events || []).length < 3) html += `<div class="ev"><div class="dot" style="background:#7fd0ff;box-shadow:0 0 8px #7fd0ff"></div><div><div class="t">${night ? "Sunrise" : "Sunset"}</div><div class="s">${tf(night ? nr : ns)}</div></div></div>`;
      }
      this._$(".events").innerHTML = html;
    }
    // rooms
    C.rooms.forEach((rm, i) => {
      const st = {};
      rm.items.forEach((it) => { const s = this._st(it.entity); const v = s ? s.state : "unavailable"; st[it.entity] = v; if (it.role) st["@" + it.role] = v; if (s && it.entity.startsWith("climate.")) { st[it.entity + "#action"] = s.attributes.hvac_action; if (it.role) st["@" + it.role + "#action"] = s.attributes.hvac_action; } });
      const tmp = !rm.temp_entity ? NaN : rm.temp_entity.startsWith("climate.") ? this._num(rm.temp_entity, "current_temperature") : this._num(rm.temp_entity);
      const sig = JSON.stringify(st) + night + tmp;
      if (this._sig["r" + i] === sig) return;
      this._sig["r" + i] = sig;
      const el = this._$(`.room[data-room="${i}"]`);
      el.querySelector(".rsvg").innerHTML = roomSVG(rm.scene || rm.key, st, night);
      const toggles = rm.items.filter((it) => /^(light|switch|fan)\./.test(it.entity));
      const n = toggles.filter((it) => st[it.entity] === "on").length;
      el.classList.toggle("lit", toggles.some((it) => it.entity.startsWith("light.") && st[it.entity] === "on"));
      el.querySelector(".st").innerHTML = !isNaN(tmp) ? `${Math.round(tmp)}° <small>${n ? n + " on" : "all off"}</small>` : `${n ? n + " on" : "<small>all off</small>"}`;
    });
    if (this._openIdx != null) this._updatePopup();
  }

  /* ---------- popup ---------- */
  _open(i) {
    this._openIdx = i;
    const rm = this._cfg.rooms[i];
    const tiles = rm.items.map((it, j) => {
      if (it.entity.startsWith("climate.")) return `<div class="tile therm" data-j="${j}"></div>`;
      return `<div class="tile" data-j="${j}"><div class="ib"><ha-icon icon="${it.icon || "mdi:power"}"></ha-icon></div><div class="tn">${it.name}</div><div class="ts"></div></div>`;
    }).join("");
    const p = this._$(".panel");
    p.innerHTML = `<div class="ph"><div class="mini">${this._$(`.room[data-room="${i}"] .rsvg`).innerHTML}</div><h2>${rm.name}</h2><button class="x">✕</button></div><div class="grid">${tiles}</div>`;
    p.querySelector(".x").addEventListener("click", () => this._close());
    p.querySelectorAll(".tile").forEach((t) => {
      const it = rm.items[+t.dataset.j];
      if (it.entity.startsWith("climate.")) { this._buildTherm(t, it); return; }
      t.addEventListener("click", (e) => { if (e.target.tagName === "INPUT") return; this._tap(it, t); });
    });
    this._$(".pop").classList.add("open");
    this._updatePopup();
    this._bump();
  }
  _close() { this._openIdx = null; this._$(".pop").classList.remove("open"); clearTimeout(this._idle); }
  _bump() { clearTimeout(this._idle); this._idle = setTimeout(() => this._close(), 60000); }

  _tap(it, t) {
    this._bump();
    const [dom] = it.entity.split(".");
    if (it.action === "restart") {
      if (!t._armed) {
        t._armed = true; t.classList.add("warn"); t.querySelector(".ts").textContent = "Tap again to restart";
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
    this._$(".panel").querySelectorAll(".tile").forEach((t) => {
      const it = rm.items[+t.dataset.j], s = this._st(it.entity);
      if (it.entity.startsWith("climate.")) { this._updTherm(t, it); return; }
      if (t._armed) return;
      const state = s ? s.state : "unavailable", on = state === "on";
      t.classList.toggle("on", on);
      t.classList.toggle("cool", on && !it.entity.startsWith("light."));
      t.querySelector(".ib").classList.toggle("spin", on && /fan/i.test(it.icon || ""));
      let txt = state === "unavailable" ? "Unavailable" : on ? "On" : "Off";
      if (on && s.attributes.brightness != null) txt = `On · ${Math.round((s.attributes.brightness / 255) * 100)}%`;
      if (it.action === "restart") txt = t._restarting && Date.now() - t._restarting < 20000 ? "Restarting…" : on ? "On · tap to restart" : "Off · tap to restart";
      t.querySelector(".ts").textContent = txt;
      const dimmable = s && it.entity.startsWith("light.") && (s.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      let sl = t.querySelector("input");
      if (dimmable && !sl) {
        sl = document.createElement("input"); sl.type = "range"; sl.min = 1; sl.max = 100;
        sl.addEventListener("click", (e) => e.stopPropagation());
        sl.addEventListener("pointerdown", (e) => { e.stopPropagation(); t._drag = true; this._bump(); });
        sl.addEventListener("change", () => { t._drag = false; this._hass.callService("light", "turn_on", { entity_id: it.entity, brightness_pct: +sl.value }); });
        t.appendChild(sl);
      }
      if (sl && !t._drag) sl.value = on && s.attributes.brightness ? Math.round((s.attributes.brightness / 255) * 100) : 1;
    });
  }

  _buildTherm(t, it) {
    t.innerHTML = `<div><div class="cur"></div><div class="act"></div></div>
      <div class="sp sp-lo"><div class="l">HEAT TO</div><div class="row"><button class="rb" data-d="lo:-1">−</button><div class="v"></div><button class="rb" data-d="lo:1">+</button></div></div>
      <div class="sp sp-hi"><div class="l">COOL TO</div><div class="row"><button class="rb" data-d="hi:-1">−</button><div class="v"></div><button class="rb" data-d="hi:1">+</button></div></div>
      <div class="modes">${["auto", "heat", "cool", "off"].map((m) => `<button class="mb" data-m="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>`;
    t.querySelectorAll(".rb").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(); this._bump();
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
    t.querySelectorAll(".mb").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(); this._bump();
      this._hass.callService("climate", "set_hvac_mode", { entity_id: it.entity, hvac_mode: b.dataset.m });
    }));
  }
  _updTherm(t, it) {
    const s = this._st(it.entity); if (!s) return;
    const A = s.attributes, p = t._pend;
    t.querySelector(".cur").textContent = A.current_temperature != null ? Math.round(A.current_temperature) + "°" : "--";
    const act = A.hvac_action || s.state;
    t.querySelector(".act").textContent = `${it.name} · ${act}`;
    t.classList.toggle("on", act === "heating" || act === "cooling");
    t.classList.toggle("cool", act === "cooling");
    const auto = s.state === "auto";
    const lo = p ? (auto ? p.lo : p.t) : auto ? A.target_temp_low : A.temperature;
    const hi = p ? p.hi : A.target_temp_high;
    t.querySelector(".sp-lo .l").textContent = auto ? "HEAT TO" : s.state === "off" ? "OFF" : "SET TO";
    t.querySelector(".sp-lo .v").textContent = lo != null ? Math.round(lo) + "°" : "--";
    t.querySelector(".sp-hi").style.display = auto ? "" : "none";
    t.querySelector(".sp-hi .v").textContent = hi != null ? Math.round(hi) + "°" : "--";
    t.querySelector(".sp-lo").style.visibility = s.state === "off" ? "hidden" : "";
    t.querySelectorAll(".mb").forEach((b) => b.classList.toggle("sel", b.dataset.m === s.state));
  }
}

if (!customElements.get("home3d-card")) customElements.define("home3d-card", Home3DCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "home3d-card", name: "Home 3D", description: "Animated isometric home dashboard" });
console.info(`%c HOME3D-CARD %c ${H3D_VERSION} `, "background:#1d5c3d;color:#fff", "background:#2d5c99;color:#fff");
