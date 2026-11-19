/*!
 * Room 3D — two Home Assistant cards in the animated, isometric "3D" blue style:
 *   room3d-hero:  a per-page banner with clock, weather and a 3D scene (house, rooms, garage, office, shed,
 *                 yard/mower, appliances, pets, vacuums, servers, car) plus stat chips.
 *   room3d-tiles: big 3D touch tiles for lights / switches / locks / covers.
 * Works in any dashboard (sections or masonry). See the README for options.
 * License: MIT
 */
let H3D_LOCALE = "en-US";
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

/* ================= Room 3D (hero banners + 3D tiles) ================= */
const K3_VERSION = "1.0.0";
const moreInfo = (el, entityId) => el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));

/* ---------- a generic house: hip roof, attached garage, front porch ---------- */
function heroHouseSVG(o = {}) {
  const I = mkIso(200, 64, 2.0), { P, poly, box, pts } = I;
  const night = !!o.night, gOpen = !!o.garageOpen, gMoving = !!o.garageMoving;
  const SID = o.siding || "#c9b28c", SIDL = shade(SID, -18), ROOF = o.roof || "#5a4a42", TRIM = "#f3f4ef";
  let s = `<defs><filter id="kh" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    <radialGradient id="khs"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
  const [sx, sy] = P(50, 50, -20);
  s += `<ellipse cx="${sx}" cy="${sy + 30}" rx="200" ry="56" fill="url(#khs)"/>`;
  // lawn island
  s += box(0, 0, -9, 100, 100, 9, "#7cbf3f", { top: "#86c943", right: "#5e9e2a", left: "#4c8820" });
  for (let i = 10; i < 100; i += 10) s += `<line x1="${P(i, 0, 0)[0]}" y1="${P(i, 0, 0)[1]}" x2="${P(i, 100, 0)[0]}" y2="${P(i, 100, 0)[1]}" stroke="#9bd65a" stroke-width=".7" opacity=".55"/><line x1="${P(0, i, 0)[0]}" y1="${P(0, i, 0)[1]}" x2="${P(100, i, 0)[0]}" y2="${P(100, i, 0)[1]}" stroke="#9bd65a" stroke-width=".7" opacity=".55"/>`;
  // driveway + walkway
  s += poly([P(61, 58, 0.2), P(85, 58, 0.2), P(85, 100, 0.2), P(61, 100, 0.2)], "#dcdcd4");
  for (let y = 70; y < 100; y += 10) s += `<line x1="${P(61, y, 0.3)[0]}" y1="${P(61, y, 0.3)[1]}" x2="${P(85, y, 0.3)[0]}" y2="${P(85, y, 0.3)[1]}" stroke="#bdbdb4" stroke-width=".8"/>`;
  s += `<line x1="${P(73, 58, 0.3)[0]}" y1="${P(73, 58, 0.3)[1]}" x2="${P(73, 100, 0.3)[0]}" y2="${P(73, 100, 0.3)[1]}" stroke="#bdbdb4" stroke-width=".8"/>`;
  s += poly([P(46, 72, 0.25), P(52, 72, 0.25), P(52, 80, 0.25), P(61, 80, 0.25), P(61, 85, 0.25), P(46, 85, 0.25)], "#d6d6ce");
  // house body (main block, hip roof)
  s += box(34, 18, 0, 52, 40, 30, SID, { right: shade(SID, -10), left: SIDL, top: SID });
  for (let z = 3; z < 30; z += 3) {
    s += `<line x1="${P(86, 18, z)[0]}" y1="${P(86, 18, z)[1]}" x2="${P(86, 58, z)[0]}" y2="${P(86, 58, z)[1]}" stroke="${shade(SID, -26)}" stroke-width=".5" opacity=".7"/>`;
    s += `<line x1="${P(58, 58, z)[0]}" y1="${P(58, 58, z)[1]}" x2="${P(86, 58, z)[0]}" y2="${P(86, 58, z)[1]}" stroke="${shade(SID, -34)}" stroke-width=".5" opacity=".7"/>`;
  }
  // corner trim
  [[86, 58], [86, 18], [58, 58]].forEach(([x, y]) => (s += `<line x1="${P(x, y, 0)[0]}" y1="${P(x, y, 0)[1]}" x2="${P(x, y, 30)[0]}" y2="${P(x, y, 30)[1]}" stroke="${TRIM}" stroke-width="1.6"/>`));
  // garage door
  if (gOpen) {
    s += poly([P(62, 58, 0), P(82, 58, 0), P(82, 58, 19), P(62, 58, 19)], "#1d2622");
    s += `<polygon points="${pts([P(62, 58, 0.3), P(82, 58, 0.3), P(82, 70, 0.3), P(62, 70, 0.3)])}" fill="#ffd57a" opacity=".35" filter="url(#kh)" class="glow"/>`;
    s += poly([P(62, 58, 16.5), P(82, 58, 16.5), P(82, 58, 19), P(62, 58, 19)], TRIM);
  } else {
    s += `<g class="${gMoving ? "doorbob" : ""}">` + poly([P(62, 58, 0), P(82, 58, 0), P(82, 58, 19), P(62, 58, 19)], "#f6f6f2", `stroke="${TRIM}" stroke-width="1"`);
    for (let z = 4; z < 16; z += 4) s += `<line x1="${P(62, 58, z)[0]}" y1="${P(62, 58, z)[1]}" x2="${P(82, 58, z)[0]}" y2="${P(82, 58, z)[1]}" stroke="#cfd2cc" stroke-width=".7"/>`;
    for (let i = 0; i < 6; i++) { const x = 63.5 + i * 3.1; s += poly([P(x, 58, 15.5), P(x + 2.2, 58, 15.5), P(x + 2.2, 58, 17.5), P(x, 58, 17.5)], night ? "#ffd57a" : "#26313a"); }
    s += `</g>`;
  }
  s += poly([P(61, 58, 19), P(83, 58, 19), P(83, 58, 20.5), P(61, 58, 20.5)], TRIM);
  // garage carriage lights
  [[59.5, 58], [84.5, 58]].forEach(([x, y]) => {
    const [lx, ly] = P(x, y, 15), on = o.garageLights;
    s += (on ? `<circle cx="${lx}" cy="${ly}" r="9" fill="#ffd57a" opacity=".5" filter="url(#kh)" class="glow"/>` : "") + `<rect x="${lx - 1.6}" y="${ly - 3}" width="3.2" height="5" rx="1" fill="${on ? "#fff1b8" : "#2b2f2c"}"/>`;
  });
  // entry: front wall (left of garage), door + sidelight
  s += poly([P(34, 58, 0), P(58, 58, 0), P(58, 58, 30), P(34, 58, 30)], SIDL);
  s += poly([P(47, 58, 0), P(52, 58, 0), P(52, 58, 17), P(47, 58, 17)], "#2c3a30", `stroke="${TRIM}" stroke-width="1"`);
  s += poly([P(38, 58, 8), P(45, 58, 8), P(45, 58, 16), P(38, 58, 16)], night ? "#ffd57a" : "#8fd3f2", `stroke="${TRIM}" stroke-width="1.2" class="${night ? "flicker" : ""}"`);
  // hip roof
  const R1 = P(31, 15, 30), R2 = P(89, 15, 30), R3 = P(89, 61, 30), R4 = P(31, 61, 30), K1 = P(46, 38, 52), K2 = P(74, 38, 52);
  s += poly([R4, R3, K2, K1], ROOF);
  s += poly([R2, R3, K2], shade(ROOF, -14));
  for (let i = 1; i < 6; i++) { const t = i / 6; const a = [R4[0] + (K1[0] - R4[0]) * t, R4[1] + (K1[1] - R4[1]) * t], b = [R3[0] + (K2[0] - R3[0]) * t, R3[1] + (K2[1] - R3[1]) * t]; s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${shade(ROOF, 10)}" stroke-width=".6" opacity=".6"/>`; }
  s += `<polyline points="${pts([R4, R3, R2])}" fill="none" stroke="${TRIM}" stroke-width="1.8"/>`;
  // porch slab, stone-based columns, porch roof
  s += box(26, 58, 0, 34, 15, 1.5, "#e2e2dc");
  const col = (x, y) => box(x - 1.2, y - 1.2, 1.5, 2.4, 2.4, 21, TRIM, { left: "#dcdcd6", right: "#ececE6" });
  s += col(29, 71) + col(56, 71);
  if (o.porchLight || night) {
    const [px, py] = P(49, 62, 20);
    s += `<circle cx="${px}" cy="${py}" r="${o.porchLight ? 22 : 10}" fill="#ffd57a" opacity="${o.porchLight ? 0.45 : 0.18}" filter="url(#kh)" class="glow"/>`;
  }
  s += poly([P(25, 74, 22.5), P(61, 74, 22.5), P(61, 58, 30), P(25, 58, 30)], ROOF);
  s += poly([P(25, 74, 21), P(61, 74, 21), P(61, 74, 22.5), P(25, 74, 22.5)], TRIM);
  s += poly([P(61, 74, 21), P(61, 58, 28.5), P(61, 58, 30), P(61, 74, 22.5)], "#e4e4de");
  // a couple of shrubs by the porch
  [[22, 70], [24, 80]].forEach(([x, y]) => { const [bx, by] = P(x, y, 3); s += `<circle cx="${bx}" cy="${by}" r="7" fill="#2f7d3a"/><circle cx="${bx - 2}" cy="${by - 2}" r="3.5" fill="#4fa356"/>`; });
  if (night || o.cold) { const [cx, cy] = P(78, 30, 50); s += box(76, 28, 38, 4, 4, 14, "#5b5f5c") + [0, 1, 2].map((i) => `<circle cx="${cx}" cy="${cy}" r="${5 + i}" fill="#dfe8f5" opacity="0" class="smoke" style="animation-delay:${i * 1.3}s"/>`).join(""); }
  if (o.locked != null) {
    const [lx2, ly2] = P(49.5, 58, 22);
    s += `<g transform="translate(${lx2 - 7},${ly2 - 16})"><rect x="0" y="6" width="14" height="11" rx="2.5" fill="${o.locked ? "#5ef0a0" : "#ff8a6b"}"/><path d="M3 6 v-2.5 a4 4 0 0 1 8 0 ${o.locked ? "v2.5" : "v-1"}" fill="none" stroke="${o.locked ? "#5ef0a0" : "#ff8a6b"}" stroke-width="2"/></g>`;
  }
  const vb = o.crop === "garage" ? "112 70 196 160" : "40 40 330 236";
  return `<svg viewBox="${vb}" class="ksvg">${s}</svg>`;
}

/* ---------- small helper scenes ---------- */
function floorIsland(I, c1 = "#9db8dd") { return I.box(0, 0, -7, 100, 100, 7, c1, { top: c1, right: shade(c1, -30), left: shade(c1, -45) }); }
function catSVGat(x, y, color = "#3b4258", eye = "#ffd36b", flip = false) {
  return `<g transform="translate(${x},${y}) scale(${flip ? -1 : 1},1)">
     <path d="M 15 22 q 10 -2 9 -12" stroke="${shade(color, -15)}" stroke-width="2.6" fill="none" stroke-linecap="round" class="br-tail" style="transform-origin:15px 22px"/>
     <ellipse cx="9" cy="17" rx="7" ry="6" fill="${color}"/><circle cx="6" cy="8" r="4.6" fill="${color}"/>
     <path d="M 2.6 5.4 l .6 -4.2 2.6 3 Z M 9.4 5.4 l -.6 -4.2 -2.6 3 Z" fill="${color}"/>
     <circle cx="4.6" cy="8" r=".8" fill="${eye}"/><circle cx="7.4" cy="8" r=".8" fill="${eye}"/></g>`;
}
function petsSVG(st) {
  const I = mkIso(100, 70, 1), { P, box } = I;
  const feeding = st.feeding === "on", cycling = ["ccp", "ec"].includes(st.litter), low = st.food === "on";
  let s = floorIsland(I, "#a9c1e3");
  s += box(0, 0, 0, 3, 100, 60, "#2b4f8f", { right: "#2b4f8f" }) + box(0, 0, 0, 100, 3, 60, "#3460a8", { left: "#3460a8" });
  // feeder
  s += box(18, 10, 0, 16, 16, 24, "#f1f5fb", { top: "#dfe7f3" });
  const [fx, fy] = P(26, 32, 1);
  s += `<ellipse cx="${fx}" cy="${fy}" rx="9" ry="4" fill="#9fb3cf"/><ellipse cx="${fx}" cy="${fy - .6}" rx="6.5" ry="2.6" fill="${feeding ? "#c98b4a" : "#7f8fa8"}"/>`;
  if (low) s += `<text x="${P(26, 18, 30)[0]}" y="${P(26, 18, 30)[1]}" font-size="14" text-anchor="middle" class="pulse">⚠️</text>`;
  // litter robot
  s += box(62, 8, 0, 26, 26, 8, "#2b3f5e");
  const [lx, ly] = P(75, 21, 24);
  s += `<g class="${cycling ? "br-roll" : ""}" style="transform-origin:${lx}px ${ly}px"><circle cx="${lx}" cy="${ly}" r="19" fill="url(#globe2)"/><path d="M ${lx - 12} ${ly + 3} a 12 8 0 0 0 24 0" fill="#1d2d48"/></g>
    <ellipse cx="${lx}" cy="${ly - 16}" rx="7" ry="2" fill="${st.lrBad ? "#ff6a5a" : "#5ef0a0"}" class="pulse" style="transform-origin:${lx}px ${ly - 16}px"/>`;
  // three cats
  const c1 = P(34, 40, 0), c2 = P(50, 62, 0), c3 = P(70, 50, 0);
  s += catSVGat(c1[0] - 6, c1[1] - 22, "#3b4258") + catSVGat(c2[0] - 6, c2[1] - 22, "#c98b4a", "#5ef0a0", true) + catSVGat(c3[0] - 6, c3[1] - 22, "#e9eef5", "#7fd0ff");
  return `<svg viewBox="16 22 168 158" class="ksvg"><defs><radialGradient id="globe2" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#d9e4f3"/><stop offset="1" stop-color="#8ea3c4"/></radialGradient></defs>${s}</svg>`;
}
function vacuumsSVG(a, b) {
  return `<div class="pair"><div>${vacSVG(a.state, a.batt).replace('width="58" height="42"', 'width="260" height="190"')}<div class="cap">${a.name}</div></div><div>${vacSVG(b.state, b.batt).replace('width="58" height="42"', 'width="260" height="190"')}<div class="cap">${b.name}</div></div></div>`;
}
function serverSVG(nodes) {
  const I = mkIso(150, 70, 1.2), { P, box } = I;
  let s = floorIsland(I, "#7f9fcc");
  nodes.forEach((n, i) => {
    const x = 10 + i * 30, rack = n.kind === "rack";
    const h = rack ? 46 : 14, w = rack ? 22 : 20;
    s += box(x, 30, 0, w, 24, h, rack ? "#2a3240" : "#3a4458", { top: rack ? "#3a4458" : "#55627c" });
    const leds = rack ? 5 : 1;
    for (let k = 0; k < leds; k++) { const [lx, ly] = P(x + w, 34 + k * 0, (rack ? 8 + k * 8 : 7)); s += `<circle cx="${lx + 2}" cy="${ly}" r="1.8" fill="${n.on ? "#5ef0a0" : "#ff5a5a"}" class="blink" style="animation-delay:${(i * 0.37 + k * 0.21) % 1.3}s"/>`; }
    const [tx, ty] = P(x + w / 2, 54, 0);
    s += `<text x="${tx}" y="${ty + 14}" font-size="10" font-weight="900" fill="#eef4ff" text-anchor="middle">${n.name}</text>`;
  });
  return `<svg viewBox="40 40 220 170" class="ksvg">${s}</svg>`;
}
function carSVG(o) {
  // Boxy compact SUV: front faces +x (down-right), driver side faces +y (down-left)
  const I = mkIso(150, 56, 1.35), { P, box, poly, pts } = I;
  const BODY = o.color || "#3f6fb0", ROOF = "#f2f3ee", GLASS = "#1e2a36", TRIM = "#23272b";
  let s = `<defs><filter id="kcar" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  s += box(0, 0, -6, 100, 100, 6, "#b9c3cf", { top: "#c9d1db" });
  for (let x = 6; x < 100; x += 22) s += poly([P(x, 86, 0.2), P(x + 12, 86, 0.2), P(x + 12, 89, 0.2), P(x, 89, 0.2)], "#f4f1d0");
  const wheel = (x, y) => { const [wx, wy] = P(x, y, 7); return `<ellipse cx="${wx}" cy="${wy}" rx="10" ry="11" fill="#14181e"/><ellipse cx="${wx}" cy="${wy}" rx="5" ry="5.6" fill="#7d8796"/><ellipse cx="${wx}" cy="${wy}" rx="1.8" ry="2" fill="#2b313a"/>`; };
  // far-side wheels first
  s += wheel(30, 28) + wheel(74, 28);
  // lower body + black cladding
  s += box(14, 30, 4, 74, 40, 6, TRIM);
  s += box(14, 30, 10, 74, 40, 13, BODY, { top: shade(BODY, 10) });
  // hood (front, lower) and cabin
  s += box(62, 31, 23, 24, 38, 3, BODY, { top: shade(BODY, 16) });
  s += box(18, 31, 23, 44, 38, 16, BODY, { top: ROOF });
  // windshield (sloped, front of cabin) + side glass
  s += poly([P(62, 33, 24), P(62, 67, 24), P(57, 67, 38), P(57, 33, 38)], GLASS, `stroke="${TRIM}" stroke-width=".8"`);
  s += poly([P(22, 69, 26), P(40, 69, 26), P(40, 69, 36.5), P(22, 69, 36.5)], GLASS) + poly([P(42, 69, 26), P(58, 69, 26), P(56, 69, 36.5), P(42, 69, 36.5)], GLASS);
  s += `<line x1="${P(38, 70, 12)[0]}" y1="${P(38, 70, 12)[1]}" x2="${P(38, 70, 22)[0]}" y2="${P(38, 70, 22)[1]}" stroke="${shade(BODY, -30)}" stroke-width=".8"/>`;
  // roof rails
  [33, 67].forEach((y) => (s += `<line x1="${P(20, y, 40.5)[0]}" y1="${P(20, y, 40.5)[1]}" x2="${P(58, y, 40.5)[0]}" y2="${P(58, y, 40.5)[1]}" stroke="${TRIM}" stroke-width="2.2" stroke-linecap="round"/>`));
  // grille + headlights on the front face
  s += poly([P(88, 36, 12), P(88, 64, 12), P(88, 64, 21), P(88, 36, 21)], TRIM);
  const lit = o.running || o.flash;
  [[88, 38], [88, 62]].forEach(([x, y]) => { const [hx, hy] = P(x, y, 18); s += `<ellipse cx="${hx}" cy="${hy}" rx="4" ry="2.6" fill="${lit ? "#fff6c9" : "#d6dde6"}"/>`; });
  if (lit) { const [gx, gy] = P(108, 50, 0); s += `<ellipse cx="${gx}" cy="${gy}" rx="46" ry="16" fill="#fff1b8" opacity=".35" filter="url(#kcar)" class="glow"/>`; }
  // near-side wheels
  s += wheel(30, 72) + wheel(74, 72);
  if (o.running) { const [ex, ey] = P(12, 40, 8); s += [0, 1, 2].map((i) => `<circle cx="${ex}" cy="${ey}" r="${4 + i}" fill="#dfe8f5" opacity="0" class="smoke" style="animation-delay:${i * 1.1}s"/>`).join(""); }
  const c = o.locked ? "#5ef0a0" : "#ff8a6b";
  s += `<g transform="translate(141,8)" class="bob"><rect x="0" y="10" width="20" height="16" rx="4" fill="${c}"/><path d="M4.5 10 v-3.5 a5.5 5.5 0 0 1 11 0 ${o.locked ? "v3.5" : "v-2"}" fill="none" stroke="${c}" stroke-width="2.6"/></g>`;
  return `<svg viewBox="20 0 260 220" class="ksvg">${s}</svg>`;
}
function shedSVG(o) {
  const I = mkIso(150, 70, 1.25), { P, box, poly } = I;
  let s = box(0, 0, -8, 100, 100, 8, "#7cbf3f", { top: "#86c943", right: "#5e9e2a", left: "#4c8820" });
  s += box(25, 20, 0, 50, 44, 32, "#b8a27f", { right: "#a8916d", left: "#8f7a58" });
  s += poly([P(22, 17, 32), P(78, 17, 32), P(78, 42, 48), P(22, 42, 48)], "#4a4f55") + poly([P(22, 67, 32), P(78, 67, 32), P(78, 42, 48), P(22, 42, 48)], "#5b6168");
  s += poly([P(78, 17, 32), P(78, 67, 32), P(78, 42, 48)], "#9c8664");
  s += poly([P(40, 64, 0), P(56, 64, 0), P(56, 64, 24), P(40, 64, 24)], o.power ? "#5d4630" : "#3d2e20");
  s += poly([P(60, 64, 12), P(70, 64, 12), P(70, 64, 22), P(60, 64, 22)], o.power && o.lights ? "#ffd57a" : "#2b3742", `stroke="#eee" stroke-width="1"`);
  // mini split head inside window glow / outdoor unit on the right wall
  s += box(76, 30, 2, 10, 14, 10, "#e9eef5");
  const [fx, fy] = P(86, 37, 7);
  s += `<g transform="translate(${fx},${fy}) scale(.55,1)"><circle r="5" fill="#9fb3cf"/><g class="${o.ac ? "spinfast" : ""}">${[0, 120, 240].map((a) => `<ellipse cx="0" cy="-2.6" rx="1.4" ry="2.6" fill="#2b3f5e" transform="rotate(${a})"/>`).join("")}</g></g>`;
  // string lights
  const [a, b] = [P(24, 66, 30), P(76, 66, 30)];
  s += `<path d="M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 14} ${b[0]} ${b[1]}" stroke="#2b2f2c" stroke-width="1" fill="none"/>`;
  for (let i = 1; i < 8; i++) { const t = i / 8, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 7; s += `<circle cx="${x}" cy="${y + 2}" r="2.2" fill="${o.power && o.string_lights ? ["#ffd36b", "#ff8a6b", "#7fd0ff", "#9cf09a"][i % 4] : "#6f7f99"}" class="${o.power && o.string_lights ? "twinkle" : ""}" style="animation-delay:${i * 0.3}s"/>`; }
  if (!o.power) { const [tx, ty] = P(50, 42, 60); s += `<g class="pulse" style="transform-origin:${tx}px ${ty}px"><rect x="${tx - 46}" y="${ty - 13}" width="92" height="22" rx="11" fill="#e0524a"/><text x="${tx}" y="${ty + 3}" font-size="11" font-weight="900" fill="#fff" text-anchor="middle">⚡ NO POWER</text></g>`; }
  return `<svg viewBox="0 0 300 220" class="ksvg">${s}</svg>`;
}
function officeSVG(st, night) {
  const I = mkIso(100, 92, 1), { P, poly, box } = I;
  let s = `<defs><filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
  s += roomShell(I, "#2a5a96", "#3168ab", "#93b2db");
  s += windowOn(I, "x", 50, 82, 36, 70, night);
  // desk with two monitors (glow when the office TV / Fire TV is on)
  s += box(0, 10, 26, 22, 44, 3, "#d9b48a") + box(2, 12, 0, 3, 3, 26, "#9c7b55") + box(2, 50, 0, 3, 3, 26, "#9c7b55");
  [[18], [36]].forEach(([y]) => { s += box(3, y, 29, 3, 14, 12, "#121a2b") + (st.tv ? poly([P(6, y + 1, 30), P(6, y + 13, 30), P(6, y + 13, 40), P(6, y + 1, 40)], "#4fb3ff", 'class="glow"') : ""); });
  s += box(30, 22, 0, 12, 12, 14, "#3f74bd") + box(30, 22, 14, 12, 3, 14, "#3f74bd");
  // purifier
  s += box(80, 6, 0, 12, 12, 30, "#f3f6fb");
  const [px, py] = P(86, 12, 30);
  s += `<ellipse cx="${px}" cy="${py}" rx="8" ry="3.5" fill="${st.nl ? "#7dffb0" : st.pur ? "#a9d8ff" : "#c3cfdf"}" class="${st.nl || st.pur ? "h3d-glow" : ""}"/>` + (st.nl ? `<ellipse cx="${px}" cy="${py + 6}" rx="20" ry="12" fill="#57f0a0" opacity=".3" filter="url(#soft)" class="h3d-glow"/>` : "");
  // thermostat on wall
  const tc = st.act === "heating" ? "#ff9a4a" : st.act === "cooling" ? "#5ec8ff" : "#cfe0f5", [tx, ty] = P(30, 0, 48);
  s += `<circle cx="${tx}" cy="${ty}" r="5" fill="#eef3fa" stroke="#9fb3d1"/><circle cx="${tx}" cy="${ty}" r="3" fill="${tc}" class="${st.act && st.act !== "idle" ? "h3d-pulse" : ""}" style="transform-origin:${tx}px ${ty}px"/>`;
  s += poly([P(30, 50, 0.2), P(80, 50, 0.2), P(80, 90, 0.2), P(30, 90, 0.2)], "#c7d7ee");
  return `<svg viewBox="8 2 184 188" class="ksvg">${s}</svg>`;
}

/* ---------- hero card ---------- */
const K3_CSS = `
:host{display:block}
.k3{position:relative;width:100%;aspect-ratio:1280/340;overflow:hidden;border-radius:26px;font-family:Nunito,"Varela Round","Segoe UI",system-ui,sans-serif;color:#eef4ff;
  background:radial-gradient(700px 300px at 20% 30%,#1d4277 0%,rgba(29,66,119,0) 70%),radial-gradient(600px 300px at 90% 100%,#1a5f8c 0%,rgba(26,95,140,0) 70%),linear-gradient(160deg,#16325c,#0c1d3a);
  box-shadow:0 8px 0 #0a1a33,0 18px 30px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.1)}
.st{position:absolute;left:0;top:0;width:1280px;height:340px;transform-origin:top left}
.clock{position:absolute;left:28px;top:12px;font-size:78px;font-weight:900;line-height:1;letter-spacing:-2px;
  text-shadow:0 1px 0 #c9d8ee,0 2px 0 #b6c8e3,0 3px 0 #a3b8d8,0 4px 0 #8fa7cc,0 5px 0 #7b96c0,0 6px 0 #6886b4,0 12px 18px rgba(0,0,0,.55)}
.clock small{font-size:26px;margin-left:6px;letter-spacing:0}
.date{position:absolute;left:32px;top:100px;font-size:18px;font-weight:800;color:#b9cbe6}
.wx{position:absolute;left:24px;top:128px;display:flex;align-items:center;gap:10px}
.wx .t{font-size:56px;font-weight:900;text-shadow:0 2px 0 #a3b8d8,0 4px 0 #7b96c0,0 8px 12px rgba(0,0,0,.5)}
.wx .c{font-size:15px;font-weight:800;color:#a9bfdf;line-height:1.3}
.title{position:absolute;left:30px;bottom:16px;font-size:26px;font-weight:900;display:flex;align-items:center;gap:10px}
.title ha-icon{--mdc-icon-size:30px;color:#ffd36b}
.scene{position:absolute;left:300px;top:0;width:660px;height:340px;display:flex;align-items:center;justify-content:center;gap:4px}
.scene svg.ksvg{height:340px;max-width:100%;filter:drop-shadow(0 14px 14px rgba(0,0,0,.4));animation:hf 7s ease-in-out infinite}
.scene .two{display:flex;gap:4px}.scene .two svg{height:300px}
.scene .pair{display:flex;gap:20px}.scene .pair svg{height:240px;width:auto}.scene .cap{text-align:center;font-weight:900;font-size:18px;margin-top:-10px}
.scene .lbl{text-align:center;font-weight:900;font-size:17px;margin-top:-14px}
.wxo{position:absolute;left:760px;top:0;filter:drop-shadow(0 8px 10px rgba(0,0,0,.4))}
.stats{position:absolute;right:22px;top:20px;width:320px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:136px;gap:14px}
.chip{height:100%;box-sizing:border-box;border-radius:22px;padding:14px;cursor:pointer;display:flex;flex-direction:column;background:linear-gradient(160deg,#2d5c99,#1d4277);
  box-shadow:0 7px 0 #13305a,0 12px 18px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.15);transition:transform .12s}
.chip:active{transform:translateY(5px);box-shadow:0 2px 0 #13305a}
.chip ha-icon{--mdc-icon-size:34px}
.chip .v{margin-top:auto;font-size:22px;font-weight:900;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip .n{font-size:13px;font-weight:800;color:#a9bfdf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 7px 0 #b97a22,0 12px 22px rgba(255,190,80,.3)}
.chip.on .n{color:#5a3a10}
.chip.ok{background:linear-gradient(160deg,#6be3a4,#2fae6c);color:#063b22;box-shadow:0 7px 0 #1f7a4a}.chip.ok .n{color:#0b4d2c}
.chip.bad{background:linear-gradient(160deg,#ff8a7a,#e0524a);color:#fff;box-shadow:0 7px 0 #9e2f28}.chip.bad .n{color:#ffe1dc}
.chip.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 7px 0 #1f6ea3}.chip.cool .n{color:#0b3c5d}
@keyframes hf{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes spin{to{transform:rotate(360deg)}}
.rays,.h3d-rays{animation:spin 18s linear infinite}
.pulse,.h3d-pulse{animation:pulse 2.6s ease-in-out infinite}@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.8}}
.float,.h3d-float,.bob{animation:hf 4s ease-in-out infinite}
.twinkle,.h3d-twinkle{animation:tw 2.4s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.3}50%{opacity:1}}
.drift,.h3d-drift{animation:dr 7s ease-in-out infinite alternate}.drift2,.h3d-drift2{animation:dr 9s ease-in-out infinite alternate-reverse}@keyframes dr{0%{transform:translateX(-6px)}100%{transform:translateX(8px)}}
.drop,.h3d-drop{animation:df 1s linear infinite}@keyframes df{0%{transform:translateY(-6px);opacity:0}30%{opacity:1}100%{transform:translateY(16px);opacity:0}}
.flake,.h3d-flake{animation:fk 2.4s linear infinite}@keyframes fk{0%{transform:translate(0,-8px);opacity:0}30%{opacity:1}100%{transform:translate(5px,24px);opacity:0}}
.flash,.h3d-flash{animation:fl 2.6s steps(1) infinite}@keyframes fl{0%,100%{opacity:0}8%,14%{opacity:1}11%{opacity:.2}}
.fog,.h3d-fog{animation:fg 4s ease-in-out infinite alternate}@keyframes fg{0%{transform:translateX(-6px);opacity:.6}100%{transform:translateX(6px);opacity:1}}
.glow,.h3d-glow{animation:gl 3.5s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.3}50%{opacity:.55}}
.flicker,.h3d-flicker{animation:fli 5s ease-in-out infinite}@keyframes fli{0%,100%{opacity:1}45%{opacity:.82}55%{opacity:.9}}
.h3d-sway{animation:sw 4s ease-in-out infinite}@keyframes sw{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.tsway,.h3d-treesway{animation:ts 5s ease-in-out infinite}@keyframes ts{0%,100%{transform:skewX(-2deg)}50%{transform:skewX(2deg)}}
.smoke,.h3d-smoke{animation:sm 4s ease-out infinite}@keyframes sm{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:.7}100%{opacity:0;transform:translate(14px,-46px) scale(2)}}
.h3d-breeze{animation:br 1.2s ease-in-out infinite}@keyframes br{0%{opacity:0;transform:translateY(-4px)}50%{opacity:1}100%{opacity:0;transform:translateY(8px)}}
.spinfast{animation:spin .5s linear infinite}.spinslow{animation:spin 3s linear infinite}
.vroam{animation:vr 6s ease-in-out infinite}@keyframes vr{0%,100%{transform:translate(-10px,2px)}25%{transform:translate(4px,-3px)}50%{transform:translate(8px,3px)}75%{transform:translate(-4px,5px)}}
.vret{animation:vt 3s ease-in-out infinite alternate}@keyframes vt{to{transform:translateX(8px)}}
.doorbob{animation:hf 1.2s ease-in-out infinite}
.shake{animation:shk .25s linear infinite}@keyframes shk{0%,100%{transform:translate(0,0)}25%{transform:translate(.6px,-.4px)}75%{transform:translate(-.6px,.4px)}}
.br-tail{animation:tail 2.6s ease-in-out infinite}@keyframes tail{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(14deg)}}
.br-roll{animation:spin 6s linear infinite}
.blink{animation:blk 1.3s steps(2) infinite}@keyframes blk{50%{opacity:.25}}
.clip{animation:clip .9s ease-out infinite}@keyframes clip{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(-8px,-10px)}}
.zz{animation:hf 3s ease-in-out infinite}.h3dk{animation:tw 1.4s ease-in-out infinite}
.lid{animation:ld 2.2s ease-in-out infinite;transform-origin:50px 30px}@keyframes ld{0%,100%{transform:translateY(0)}40%{transform:translateY(-5px) rotate(-4deg)}}
.binhop{animation:bh 2.2s ease-in-out infinite}@keyframes bh{0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}55%{transform:translateY(0)}}
`;

class Room3DHero extends HTMLElement {
  setConfig(c) {
    if (!c || !c.scene) throw new Error("room3d-hero: 'scene' is required");
    this._c = Object.assign({ weather: "weather.home", outside_temp: null, sun: "sun.sun", stats: [] }, c);
    this._sig = {};
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() {
    if (!document.getElementById("h3d-font")) { const l = document.createElement("link"); l.id = "h3d-font"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap"; document.head.appendChild(l); }
    this._tick = setInterval(() => this._clock(), 1000);
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
  }
  disconnectedCallback() { clearInterval(this._tick); this._ro && this._ro.disconnect(); }
  set hass(h) { this._h = h; if (!this._b) this._build(); this._update(); }
  _s(e) { const s = this._h && e && this._h.states[e]; return s ? s.state : "unavailable"; }
  _a(e, a) { const s = this._h && e && this._h.states[e]; return s ? s.attributes[a] : undefined; }
  _build() {
    this._b = true;
    const r = this.attachShadow({ mode: "open" });
    r.innerHTML = `<style>${K3_CSS}</style><div class="k3"><div class="st"><div class="clock"></div><div class="date"></div><div class="wx"><div class="wi"></div><div><div class="t"></div><div class="c"></div></div></div>
      <div class="title"><ha-icon icon="${this._c.icon || "mdi:home"}"></ha-icon><span>${this._c.title || ""}</span></div>
      <div class="scene"></div><div class="wxo"></div><div class="stats"></div></div></div>`;
    this._$ = (q) => r.querySelector(q);
    this._$(".stats").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) moreInfo(this, c.dataset.e); });
    this._clock(); this._fit();
  }
  _fit() { if (!this._b) return; const w = this._$(".k3").clientWidth || 1280; this._$(".st").style.transform = `scale(${w / 1280})`; }
  _clock() {
    if (!this._b) return;
    const d = new Date(); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    const t = `${h}:${String(d.getMinutes()).padStart(2, "0")}<small>${ap}</small>`;
    if (this._lt !== t) { this._lt = t; this._$(".clock").innerHTML = t; this._sig.sc = null; }
    this._$(".date").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  _chip(st) {
    const e = st.entity, s = this._h.states[e];
    if (!s) return `<div class="chip bad" data-e="${e}"><ha-icon icon="mdi:alert"></ha-icon><div class="v">Missing</div><div class="n">${e}</div></div>`;
    const v = s.state, u = s.attributes.unit_of_measurement || "";
    let fmt = typeof this._h.formatEntityState === "function" ? this._h.formatEntityState(s) : v + (u ? " " + u : "");
    if (e.startsWith("climate.")) { const ct = s.attributes.current_temperature; const md = (s.attributes.hvac_action || v || "").replace(/_/g, " "); fmt = (ct != null ? Math.round(ct) + "° · " : "") + md.replace(/^\w/, (c) => c.toUpperCase()); }
    let cls = "";
    if (st.good && st.good.includes(v)) cls = "ok"; else if (st.bad && st.bad.includes(v)) cls = "bad";
    else if (["on", "open", "unlocked", "playing", "cleaning", "mowing", "heat", "heating"].includes(v)) cls = "on";
    else if (["cool", "cooling"].includes(v)) cls = "cool";
    else if (v === "unavailable") cls = "bad";
    const dom = e.split(".")[0];
    const icon = st.icon || s.attributes.icon || { lock: v === "locked" ? "mdi:lock" : "mdi:lock-open-variant", cover: v === "closed" ? "mdi:garage" : "mdi:garage-open", climate: "mdi:thermostat", light: "mdi:lightbulb", switch: "mdi:power-socket-us", fan: "mdi:fan", vacuum: "mdi:robot-vacuum", lawn_mower: "mdi:robot-mower", binary_sensor: "mdi:check-network-outline", media_player: "mdi:television" }[dom] || "mdi:information-outline";
    return `<div class="chip ${cls}" data-e="${e}"><ha-icon icon="${icon}"></ha-icon><div class="v">${fmt}</div><div class="n">${st.name || s.attributes.friendly_name || e}</div></div>`;
  }
  _update() {
    if (!this._b || !this._h) return;
    const C = this._c, W = this._h.states[C.weather], A = W ? W.attributes : {}, sun = this._h.states[C.sun];
    const night = sun ? sun.state === "below_horizon" : false;
    const ot = parseFloat(this._s(C.outside_temp)), outT = isNaN(ot) ? A.temperature : ot, cond = W ? W.state : "";
    const sW = [cond, night, Math.round(outT)].join();
    if (this._sig.w !== sW) {
      this._sig.w = sW;
      this._$(".wi").innerHTML = weatherSVG(cond, night, 92);
      this._$(".wx .t").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°";
      this._$(".wx .c").innerHTML = `Outside<br>${(cond || "").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())}`;
      this._$(".wxo").innerHTML = C.scene === "home" ? weatherSVG(cond, night, 120) : "";
    }
    const stats = (C.stats || []).slice(0, 4);
    const sS = JSON.stringify(stats.map((s) => { const x = this._h.states[s.entity]; return x ? [x.state, x.last_changed] : 0; }));
    if (this._sig.st !== sS) { this._sig.st = sS; this._$(".stats").innerHTML = stats.map((s) => this._chip(s)).join(""); }
    const sc = this._scene(night, cond, outT);
    if (this._sig.sc !== sc[0]) { this._sig.sc = sc[0]; this._$(".scene").innerHTML = sc[1]; }
  }
  _scene(night, cond, outT) {
    const C = this._c, s = (e) => this._s(e), E = C.entities || {};
    const keyOf = (o) => JSON.stringify(o);
    switch (C.scene) {
      case "home": case "garage": {
        const g = s(E.garage);
        const o = { night, cold: !isNaN(outT) && outT < 50, garageOpen: ["open", "opening"].includes(g), garageMoving: ["opening", "closing"].includes(g),
          porchLight: s(E.porch_light) === "on", garageLights: (E.garage_lights || []).some((e) => s(e) === "on"), locked: E.lock ? s(E.lock) === "locked" : null, crop: C.scene === "garage" ? "garage" : null, siding: C.house_color, roof: C.roof_color };
        return [keyOf(o), heroHouseSVG(o)];
      }
      case "rooms": {
        const rooms = C.rooms || [];
        const sts = rooms.map((rm) => { const st = {}; (rm.items || []).forEach((it) => { const v = s(it.entity); st[it.entity] = v; if (it.role) st["@" + it.role] = v; if (it.entity.startsWith("climate.")) st["@" + (it.role || "thermostat") + "#action"] = this._a(it.entity, "hvac_action"); }); return st; });
        const k = keyOf([sts, night]);
        return [k, `<div class="two">${rooms.map((rm, i) => `<div>${roomSVG(rm.scene, sts[i], night).replace('class="roomsvg"', 'class="ksvg"')}<div class="lbl">${rm.name}</div></div>`).join("")}</div>`];
      }
      case "office": {
        const st = { tv: ["on", "playing", "paused", "idle"].includes(s(E.tv)), nl: s(E.nightlight) === "on", pur: s(E.purifier) === "on", act: this._a(E.thermostat, "hvac_action") };
        return [keyOf([st, night]), officeSVG(st, night)];
      }
      case "shed": {
        const anyAvail = (E.power_probe || []).some((e) => !["unavailable", "unknown"].includes(s(e)));
        const o = { power: anyAvail, lights: s(E.lights) === "on", string_lights: s(E.string_lights) === "on", ac: ["cool", "heat", "dry", "fan_only", "auto"].includes(s(E.ac)) };
        return [keyOf(o), shedSVG(o)];
      }
      case "outdoor": { const st = s(E.mower), ch = s(E.mower_charging) === "on"; return [st + ch, mowerSVG(st, ch).replace("<svg ", '<svg class="ksvg" ')]; }
      case "appliances": { const run = s(E.washer) === "Run"; return ["w" + run, washerSVG(run).replace('width="104" height="104"', 'width="300" height="300" class="ksvg"').replace('width="76" height="76"', 'width="300" height="300" class="ksvg"')]; }
      case "pets": {
        const code = s(E.litter_code);
        const st = { feeding: s(E.feeding), food: s(E.food_level), litter: code, lrBad: /^(df1|df2|dfs|sdf|csf|csi|dhf|dpf|hpf|otf|pd|br|offline|scf|spf)$/.test(code) };
        return [keyOf(st), petsSVG(st)];
      }
      case "vacuums": {
        const v = (E.vacuums || []).map((x) => ({ name: x.name, state: s(x.entity), batt: parseFloat(s(x.battery)) }));
        return [keyOf(v), v.length >= 2 ? vacuumsSVG(v[0], v[1]) : ""];
      }
      case "system": {
        const n = (E.nodes || []).map((x) => ({ name: x.name, kind: x.kind, on: s(x.entity) === "on" }));
        return [keyOf(n), serverSVG(n)];
      }
      case "car": {
        const o = { locked: s(E.lock) === "locked", running: s(E.ignition) === "on" || /running|on/i.test(s(E.remote_start)), flash: false, color: C.car_color };
        return [keyOf(o), carSVG(o)];
      }
    }
    return ["none", ""];
  }
}
if (!customElements.get("room3d-hero")) customElements.define("room3d-hero", Room3DHero);

/* ---------- 3D toggle tiles (for Lights & Plugs) ---------- */
const KT_CSS = `
:host{display:block}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;font-family:Nunito,"Varela Round","Segoe UI",system-ui,sans-serif}
.t{height:150px;border-radius:24px;padding:14px;position:relative;cursor:pointer;display:flex;flex-direction:column;color:#eef4ff;
  background:linear-gradient(160deg,#2d5c99,#1f467d);box-shadow:0 7px 0 #163460,0 14px 22px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.15);transition:transform .12s,box-shadow .12s,background .3s;user-select:none;-webkit-tap-highlight-color:transparent}
.t:active{transform:translateY(5px);box-shadow:0 2px 0 #163460,0 6px 12px rgba(0,0,0,.35)}
.t .ib{width:54px;height:54px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12)}
.t ha-icon{--mdc-icon-size:32px}
.t .n{font-size:17px;font-weight:900;margin-top:auto;line-height:1.15}
.t .s{font-size:13px;font-weight:800;opacity:.82}
.t.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 7px 0 #b97a22,0 14px 26px rgba(255,190,80,.35),inset 0 2px 0 rgba(255,255,255,.5)}
.t.on .ib{background:rgba(255,255,255,.45)}
.t.on ha-icon{animation:pop .45s}
.t.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 7px 0 #1f6ea3,0 14px 26px rgba(90,200,255,.35)}
.t.ok{background:linear-gradient(160deg,#6be3a4,#2fae6c);color:#063b22;box-shadow:0 7px 0 #1f7a4a}
.t.warn{background:linear-gradient(160deg,#ff8a7a,#e0524a);color:#fff;box-shadow:0 7px 0 #9e2f28}
.t.un{opacity:.55}
.t input[type=range]{position:absolute;left:12px;right:12px;bottom:8px;width:auto;height:22px;-webkit-appearance:none;appearance:none;background:transparent}
.t input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:rgba(0,0,0,.25)}
.t input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;margin-top:-7px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.t.dim .s{margin-bottom:24px}
@keyframes pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
`;
class Room3DTiles extends HTMLElement {
  setConfig(c) { if (!c || !Array.isArray(c.entities)) throw new Error("room3d-tiles: 'entities' list is required"); this._c = c; }
  getCardSize() { return Math.ceil(this._c.entities.length / 4) * 2; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  set hass(h) {
    this._h = h;
    if (!this._r) { this._r = this.attachShadow({ mode: "open" }); this._r.innerHTML = `<style>${KT_CSS}</style><div class="g"></div>`; this._r.querySelector(".g").addEventListener("click", (e) => this._tap(e)); }
    const sig = JSON.stringify(this._c.entities.map((x) => { const s = h.states[x.entity || x]; return s ? [s.state, s.attributes.brightness] : 0; }));
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }
  _ent(x) { return typeof x === "string" ? { entity: x } : x; }
  _render() {
    const g = this._r.querySelector(".g");
    if (g.querySelector("input:active")) return;
    g.innerHTML = this._c.entities.map((x0, i) => {
      const x = this._ent(x0), s = this._h.states[x.entity];
      if (!s) return `<div class="t warn" data-i="${i}"><div class="ib"><ha-icon icon="mdi:alert"></ha-icon></div><div class="n">${x.name || x.entity}</div><div class="s">Missing</div></div>`;
      const d = x.entity.split(".")[0], v = s.state;
      const on = ["on", "open", "unlocked", "opening"].includes(v);
      const cls = v === "unavailable" ? "un" : d === "lock" ? (v === "locked" ? "ok" : "warn") : d === "cover" ? (v === "closed" ? "ok" : "on") : on ? (d === "switch" && !/light|lamp|led/i.test((x.icon || s.attributes.icon || "") + (x.name || s.attributes.friendly_name || "")) ? "cool" : "on") : "";
      const dim = d === "light" && (s.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      const icon = x.icon || s.attributes.icon || { light: "mdi:lightbulb", switch: "mdi:power-socket-us", fan: "mdi:fan", lock: v === "locked" ? "mdi:lock" : "mdi:lock-open-variant", cover: v === "closed" ? "mdi:garage" : "mdi:garage-open" }[d] || "mdi:toggle-switch";
      let txt = this._h.formatEntityState ? this._h.formatEntityState(s) : v;
      if (d === "light" && on && s.attributes.brightness) txt = `On · ${Math.round(s.attributes.brightness / 2.55)}%`;
      return `<div class="t ${cls} ${dim ? "dim" : ""}" data-i="${i}"><div class="ib"><ha-icon icon="${icon}"></ha-icon></div><div class="n">${x.name || s.attributes.friendly_name}</div><div class="s">${txt}</div>${dim ? `<input type="range" min="1" max="100" value="${on && s.attributes.brightness ? Math.round(s.attributes.brightness / 2.55) : 1}" data-i="${i}">` : ""}</div>`;
    }).join("");
    g.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("click", (e) => e.stopPropagation());
      inp.addEventListener("change", (e) => { const x = this._ent(this._c.entities[+inp.dataset.i]); this._h.callService("light", "turn_on", { entity_id: x.entity, brightness_pct: +inp.value }); });
    });
  }
  _tap(e) {
    const t = e.target.closest(".t"); if (!t || e.target.tagName === "INPUT") return;
    const x = this._ent(this._c.entities[+t.dataset.i]), d = x.entity.split(".")[0], s = this._h.states[x.entity];
    if (!s) return;
    if (x.tap === "more-info" || ["sensor", "binary_sensor", "camera"].includes(d)) return moreInfo(this, x.entity);
    const go = () => {
      if (d === "lock") this._h.callService("lock", s.state === "locked" ? "unlock" : "lock", { entity_id: x.entity });
      else if (d === "cover") this._h.callService("cover", "toggle", { entity_id: x.entity });
      else if (d === "script") this._h.callService("script", "turn_on", { entity_id: x.entity });
      else if (["light", "switch", "fan", "input_boolean"].includes(d)) this._h.callService(d, "toggle", { entity_id: x.entity });
      else moreInfo(this, x.entity);
    };
    if (x.confirm || ["lock", "cover"].includes(d)) {
      if (!t._armed) { t._armed = true; t.classList.add("warn"); t.querySelector(".s").textContent = "Tap again to confirm"; setTimeout(() => { t._armed = false; this._sig = null; this.hass = this._h; }, 4000); return; }
      t._armed = false;
    }
    go();
  }
}
if (!customElements.get("room3d-tiles")) customElements.define("room3d-tiles", Room3DTiles);
window.customCards = window.customCards || [];
window.customCards.push({ type: "room3d-hero", name: "Room 3D Hero", description: "3D animated banner with clock, weather and a live scene" }, { type: "room3d-tiles", name: "Room 3D Tiles", description: "Big 3D touch tiles" });
console.info(`%c ROOM3D %c ${K3_VERSION} `, "background:#1d5c3d;color:#fff", "background:#2d5c99;color:#fff");
