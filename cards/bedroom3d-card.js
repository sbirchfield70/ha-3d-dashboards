/*!
 * Bedroom 3D Card — an animated, isometric "3D" bedroom dashboard for Home Assistant (blue theme, touch).
 * Designed on a 1280x720 canvas (Nest Hub / tablet) and scaled to fit.
 * Left side: clock, house with live weather, gauges, forecast, calendar. Right side: a 3D bedroom
 * scene that reacts to your devices, plus 9 touch tiles with popups (purifier, vacuum, litter box, feeder).
 * Every entity is set in the card config; see the README for the full option list.
 * License: MIT
 */
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
/* ---------- house scene ---------- */
function houseSVG(night, cold) {
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
  const G = "#1d5c3d";
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
  const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `<svg viewBox="0 0 100 100" width="92" height="92">
    <defs><linearGradient id="calr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#d93b4a"/></linearGradient></defs>
    <rect x="14" y="20" width="76" height="72" rx="10" fill="#9fb3d1"/>
    <rect x="10" y="16" width="76" height="72" rx="10" fill="#ffffff"/>
    <path d="M10 26 a10 10 0 0 1 10 -10 h56 a10 10 0 0 1 10 10 v10 h-76 Z" fill="url(#calr)"/>
    <text x="48" y="32" font-size="11" text-anchor="middle" fill="#fff" font-weight="800" letter-spacing="1">${mon}</text>
    <g class="h3d-flip"><text x="48" y="74" font-size="34" text-anchor="middle" fill="#1d2d48" font-weight="800">${d.getDate()}</text></g>
    <rect x="26" y="9" width="6" height="14" rx="3" fill="#41557a"/><rect x="64" y="9" width="6" height="14" rx="3" fill="#41557a"/></svg>`;
}

const BASE_CSS = `
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

/* ================= bedroom-specific ================= */
const BR = {
  name: "Bedroom",                         // label under the 3D room
  weather: "weather.home",
  outside_temp: null,                      // optional sensor; falls back to the weather entity's temperature
  sun: "sun.sun",
  room_temp: "sensor.bedroom_temperature", // sensor.* or climate.*
  room_hum: "sensor.bedroom_humidity",
  high: "sensor.today_high_temperature",   // optional: today's high / low / rain chance sensors
  low: "sensor.today_low_temperature",
  rain_chance: "sensor.today_rain_chance",
  calendars: [],
  tv_lights: "light.bedroom_tv_lights",
  lamp_left: "light.bedroom_lamp_left",
  lamp_left_name: "Left Lamp",
  lamp_right: "light.bedroom_lamp_right",
  lamp_right_name: "Right Lamp",
  backyard: "switch.backyard_lights",
  backyard_name: "Backyard Lights",
  purifier: "fan.bedroom_air_purifier",
  purifier_speed: "select.bedroom_air_purifier",
  purifier_nl: "light.bedroom_air_purifier_night_light",
  purifier_scene: "select.bedroom_air_purifier_night_light_scene",
  purifier_aq: "sensor.bedroom_air_purifier_air_quality",
  purifier_filter: "sensor.bedroom_air_purifier_filter_life",
  vac: "vacuum.bedroom_vacuum",
  vac_name: "Vacuum",
  vac_batt: "sensor.bedroom_vacuum_battery_level",
  vac_status: "sensor.bedroom_vacuum_status",
  vac_area: "sensor.bedroom_vacuum_cleaned_area",
  vac_time: "sensor.bedroom_vacuum_cleaning_time",
  vac_segments: null,                      // Dreame only: room segment ids for "clean this room" (e.g. [1, 2]); null = vacuum.start
  litter: "vacuum.litter_robot",
  litter_code: "sensor.litter_robot_status_code",
  litter_drawer: "sensor.litter_robot_waste_drawer",
  litter_level: "sensor.litter_robot_litter_level",
  litter_weight: "sensor.litter_robot_pet_weight",
  litter_globe: "select.litter_robot_globe_light",
  feeder_feeding: "binary_sensor.cat_feeder_feeding",
  feeder_food: "binary_sensor.cat_feeder_food_level",
  feeder_error: "sensor.cat_feeder_error",
  feeder_desiccant: "sensor.cat_feeder_desiccant_left_days",
  feeder_dispensed: "sensor.cat_feeder_total_dispensed",
  feeder_planned: "sensor.cat_feeder_total_planned",
  feeder_manual: "text.cat_feeder_manual_feed",
  feeder_schedule_template: null,          // optional Jinja template returning [{"t":"7:00 AM","n":"Breakfast","a":2,"s":"done|next|later"}]
  goodnight: "script.goodnight",
};
const LR_CODES = { rdy: "Ready", ccp: "Cleaning", ccc: "Clean complete", cst: "Cat timer", cd: "Cat detected", ec: "Emptying", df1: "Drawer almost full", df2: "Drawer almost full", dfs: "Drawer full", csf: "Cat sensor fault", csi: "Cat sensor interrupted", sdf: "Drawer full", dhf: "Dump + home fault", dpf: "Dump position fault", hpf: "Home position fault", otf: "Over-torque fault", pd: "Pinch detected", p: "Paused", off: "Off", offline: "Offline", br: "Bonnet removed", pwrd: "Powering down", pwru: "Powering up", scf: "Cat sensor fault", spf: "Pinch fault" };

function rgbOf(s, fallback = "#7fd0ff") {
  const c = s && s.attributes && s.attributes.rgb_color;
  return c ? `rgb(${c[0]},${c[1]},${c[2]})` : fallback;
}

/* big bedroom scene */
function bedroomSVG(st, night, BR) {
  const I = mkIso(100, 92, 1), { P, poly, box, pts } = I;
  const on = (e) => st[e] === "on";
  const tvOn = on(BR.tv_lights), sl = on(BR.lamp_left), cl = on(BR.lamp_right), nl = on(BR.purifier_nl), pur = on(BR.purifier);
  const vacState = st[BR.vac] || "docked", cleaning = vacState === "cleaning", lrCycling = ["ccp", "ec"].includes(st[BR.litter_code]);
  const feeding = on(BR.feeder_feeding);
  let s = `<defs><filter id="bs" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="bs2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <radialGradient id="globe" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d9e4f3"/><stop offset="1" stop-color="#8ea3c4"/></radialGradient></defs>`;
  s += roomShell(I, "#2b4f8f", "#3460a8", "#a3bde0");
  s += windowOn(I, "y", 14, 38, 40, 72, night);
  // dresser + TV with LED backlight
  if (tvOn) {
    const [gx, gy] = P(72, 1, 50);
    s += `<ellipse cx="${gx}" cy="${gy}" rx="34" ry="20" fill="${st.tvColor}" opacity=".7" filter="url(#bs)" class="h3d-glow"/>`;
  }
  s += box(50, 0, 0, 42, 12, 20, "#e6edf7");
  s += box(52, 0, 30, 40, 2.5, 24, "#121a2b");
  s += poly([P(54, 2.5, 32), P(90, 2.5, 32), P(90, 2.5, 52), P(54, 2.5, 52)], "#0b1120");
  if (tvOn) s += `<polyline points="${pts([P(52, 2.6, 30), P(92, 2.6, 30), P(92, 2.6, 54), P(52, 2.6, 54), P(52, 2.6, 30)])}" fill="none" stroke="${st.tvColor}" stroke-width="1.6" class="h3d-glow"/>`;
  // vacuum dock under the window
  s += box(24, 0, 0, 12, 7, 18, "#2b3f5e", { top: "#3e5880" });
  s += `<circle cx="${P(30, 7, 12)[0]}" cy="${P(30, 7, 12)[1]}" r="1.4" fill="${vacState === "docked" ? "#5ef0a0" : "#6f86ad"}" class="${vacState === "docked" ? "h3d-pulse" : ""}"/>`;
  const puck = (cx, cy) => `<ellipse cx="${cx}" cy="${cy + 2}" rx="11" ry="5" fill="rgba(0,0,0,.25)"/><path d="M${cx - 10} ${cy - 2} v3 a10 4.5 0 0 0 20 0 v-3 Z" fill="#3a4f70"/><ellipse cx="${cx}" cy="${cy - 2}" rx="10" ry="4.5" fill="#eef3fa"/><ellipse cx="${cx}" cy="${cy - 3}" rx="3" ry="1.4" fill="#2b3f5e"/>`;
  if (!cleaning) { const [vx, vy] = P(30, 13, 0); s += puck(vx, vy); }
  // left nightstand + lamp
  const lamp = (y, o) => box(0, y, 0, 14, 12, 18, "#e6edf7") + box(5, y + 4, 18, 3, 3, 9, "#9fb3d1") +
    box(2, y + 1, 27, 9, 9, 8, o ? "#ffe7a8" : "#d6dfec", o ? { top: "#fff5d6", right: "#ffe39a", left: "#f5cf74" } : {}) +
    (o ? `<circle cx="${P(6, y + 6, 31)[0]}" cy="${P(6, y + 6, 31)[1]}" r="17" fill="${WARM}" opacity=".38" filter="url(#bs)" class="h3d-glow"/>` : "");
  s += glowPool(I, 12, 18, 30, sl) + glowPool(I, 12, 86, 30, cl);
  s += poly([P(20, 28, 0.2), P(74, 28, 0.2), P(74, 80, 0.2), P(20, 80, 0.2)], "#c4d4ec");
  s += lamp(14, sl);
  // bed
  s += box(0, 30, 0, 6, 44, 40, "#3b6db3");
  s += box(6, 30, 0, 54, 44, 15, "#eef3fa");
  s += box(9, 34, 15, 11, 17, 6, "#ffffff") + box(9, 53, 15, 11, 17, 6, "#ffffff");
  s += box(24, 29, 15, 37, 46, 4.5, "#5b8fd8");
  s += box(54, 29, 0, 7, 46, 19.5, "#4a7fca", { top: "#5b8fd8" });
  // purifier (front-right of TV)
  s += box(84, 16, 0, 11, 11, 28, "#f3f6fb");
  const [px, py] = P(89.5, 21.5, 28);
  s += `<ellipse cx="${px}" cy="${py}" rx="7.5" ry="3.3" fill="${nl ? "#7dffb0" : pur ? "#a9d8ff" : "#c3cfdf"}" class="${nl || pur ? "h3d-glow" : ""}"/>` +
    (nl ? `<ellipse cx="${px}" cy="${py + 6}" rx="20" ry="12" fill="#57f0a0" opacity=".32" filter="url(#bs)" class="h3d-glow"/>` : "") +
    (pur ? [0, 1, 2].map((i) => `<path d="M ${px - 6 + i * 6} ${py - 4} q 3 -5 0 -10" stroke="#cfe9ff" stroke-width="1.1" fill="none" opacity=".7" class="h3d-breeze" style="animation-delay:${i * 0.4}s"/>`).join("") : "");
  // feeder + cat
  s += box(78, 46, 0, 9, 9, 13, "#f1f5fb", { top: "#dfe7f3" });
  const [fx, fy] = P(84, 58, 1);
  s += `<ellipse cx="${fx}" cy="${fy}" rx="5" ry="2.2" fill="#9fb3cf"/><ellipse cx="${fx}" cy="${fy - .4}" rx="3.6" ry="1.4" fill="${feeding ? "#c98b4a" : "#7f8fa8"}"/>`;
  const [cx, cy] = P(88, 68, 0);
  s += `<g transform="translate(${cx - 6},${cy - 22})">
     <path d="M 15 22 q 10 -2 9 -12" stroke="#2c3346" stroke-width="2.6" fill="none" stroke-linecap="round" class="br-tail" style="transform-origin:15px 22px"/>
     <ellipse cx="9" cy="17" rx="7" ry="6" fill="#3b4258"/><circle cx="6" cy="8" r="4.6" fill="#3b4258"/>
     <path d="M 2.6 5.4 l .6 -4.2 2.6 3 Z M 9.4 5.4 l -.6 -4.2 -2.6 3 Z" fill="#3b4258"/>
     <circle cx="4.6" cy="8" r=".8" fill="#ffd36b"/><circle cx="7.4" cy="8" r=".8" fill="#ffd36b"/></g>`;
  // litter robot globe (front right)
  s += box(80, 80, 0, 14, 14, 6, "#2b3f5e");
  const [lx, ly] = P(87, 87, 16);
  s += `<g class="${lrCycling ? "br-roll" : ""}" style="transform-origin:${lx}px ${ly}px"><circle cx="${lx}" cy="${ly}" r="11" fill="url(#globe)"/><path d="M ${lx - 7} ${ly + 2} a 7 5 0 0 0 14 0" fill="#1d2d48"/></g>
    <ellipse cx="${lx}" cy="${ly - 9}" rx="5" ry="1.6" fill="${st.lrBad ? "#ff6a5a" : "#5ef0a0"}" class="h3d-pulse" style="transform-origin:${lx}px ${ly - 9}px"/>`;
  // right nightstand + lamp (front)
  s += lamp(78, cl);
  // vacuum cleaning: roam the floor
  if (cleaning) {
    const a = P(30, 20, 0), b = P(70, 24, 0), c = P(70, 70, 0), d = P(28, 84, 0);
    s += `<g>${puck(0, 0)}<animateMotion dur="14s" repeatCount="indefinite" path="M ${a} L ${b} L ${c} L ${d} Z"/></g>`;
  }
  return `<svg viewBox="8 2 184 188" class="bedsvg">${s}</svg>`;
}

/* tile icon animations */
function tileIcon(kind, st) {
  const lit = (c) => `<svg viewBox="0 0 60 60" width="58" height="58"><circle cx="30" cy="26" r="20" fill="${c}" opacity=".35" class="h3d-glow"/><path d="M30 8 a14 14 0 0 1 8 25 v6 h-16 v-6 a14 14 0 0 1 8 -25 z" fill="${c}"/><rect x="23" y="41" width="14" height="4" rx="2" fill="#8ea3c4"/><rect x="25" y="47" width="10" height="4" rx="2" fill="#8ea3c4"/></svg>`;
  return { lit }[kind] ? lit(st) : "";
}

const BR_CSS = `
.hdr{top:22px;font-size:17px;color:#a9bfdf;font-weight:700}
.big{top:46px;font-size:80px;font-weight:900;line-height:1;text-shadow:0 1px 0 #c9d8ee,0 2px 0 #b6c8e3,0 3px 0 #a3b8d8,0 4px 0 #8fa7cc,0 5px 0 #7b96c0,0 10px 16px rgba(0,0,0,.5)}
.scene{left:446px;top:150px;width:330px;display:flex;flex-direction:column;align-items:center}
.bedsvg{width:330px;height:318px;filter:drop-shadow(0 16px 16px rgba(0,0,0,.4));animation:hfloat 7s ease-in-out infinite}
.scene .nm{font-size:21px;font-weight:900;margin-top:-6px}
.fc{left:446px;top:505px;width:330px;display:flex;justify-content:space-between}
.fday{width:106px;display:flex;flex-direction:column;align-items:center;position:relative}
.fday .ic{height:82px;display:flex;align-items:flex-end;z-index:2}
.fday .ped{position:absolute;top:66px}
.fday .dn{margin-top:40px;font-size:15px;font-weight:800;color:#b9cbe6}
.fday .tp{font-size:22px;font-weight:900}.fday .tp small{font-size:14px;color:#9fb5d6;margin-left:3px}
.tiles{left:792px;top:150px;width:470px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.t{height:126px;border-radius:24px;padding:12px 12px 10px;position:relative;cursor:pointer;display:flex;flex-direction:column;
  background:linear-gradient(160deg,#2d5c99,#1f467d);box-shadow:0 7px 0 #163460,0 14px 22px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.15);transition:transform .12s,box-shadow .12s,background .3s}
.t:active{transform:translateY(5px);box-shadow:0 2px 0 #163460,0 6px 12px rgba(0,0,0,.4)}
.t .ib{width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12)}
.t ha-icon{--mdc-icon-size:32px}
.t .tn{font-size:17px;font-weight:900;margin-top:auto;line-height:1.1}
.t .ts{font-size:13px;font-weight:800;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t .badge{position:absolute;top:12px;right:12px;font-size:12px;font-weight:900;padding:3px 8px;border-radius:10px;background:rgba(0,0,0,.25)}
.t.on{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 7px 0 #b97a22,0 14px 26px rgba(255,190,80,.35),inset 0 2px 0 rgba(255,255,255,.5)}
.t.on .ib{background:rgba(255,255,255,.45)}
.t.cool{background:linear-gradient(160deg,#7fe0ff,#3aa4e6);color:#06263d;box-shadow:0 7px 0 #1f6ea3,0 14px 26px rgba(90,200,255,.35),inset 0 2px 0 rgba(255,255,255,.5)}
.t.cool .ib{background:rgba(255,255,255,.45)}
.t.warn{background:linear-gradient(160deg,#ff8a7a,#e0524a);color:#fff;box-shadow:0 7px 0 #9e2f28}
.t.night{background:linear-gradient(160deg,#3a3f8f,#24275e);box-shadow:0 7px 0 #15173d,0 14px 22px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.12)}
.t .more{position:absolute;right:12px;bottom:10px;opacity:.6;font-size:18px;font-weight:900}
.t.on .spin ha-icon,.t.cool .spin ha-icon{animation:spin 2.4s linear infinite}
.t.on .bob ha-icon,.t.cool .bob ha-icon{animation:hfloat 1.6s ease-in-out infinite}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle;box-shadow:0 0 6px currentColor}
.cal2{left:792px;top:590px;width:470px;display:flex;gap:12px;align-items:center}
.cal2 .ics{flex:none;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35))}
.cal2 .evs{display:flex;flex-direction:column;gap:6px;min-width:0}
.cal2 .ev{display:flex;gap:8px;align-items:baseline;min-width:0}
.cal2 .ev .tt{font-size:13px;color:#9fb5d6;font-weight:800;flex:none;min-width:118px}
.cal2 .ev .s{font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* popups */
.pop{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(8,22,46,.72),rgba(3,10,22,.9));display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;z-index:20}
.pop.open{opacity:1;pointer-events:auto}
.panel{width:900px;max-height:640px;border-radius:34px;padding:24px 30px 28px;background:linear-gradient(160deg,#21497f,#142f58);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.12),inset 0 -6px 0 rgba(0,0,0,.25);transform:translateY(30px) scale(.94);transition:transform .3s cubic-bezier(.2,1.4,.4,1)}
.pop.open .panel{transform:none}
.ph{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.ph .pi{width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center}
.ph .pi ha-icon{--mdc-icon-size:40px;color:#ffd36b}
.ph h2{margin:0;font-size:32px;font-weight:900;flex:1}
.x{width:62px;height:62px;border-radius:50%;border:0;background:#2d5c99;color:#fff;font-size:30px;font-weight:900;box-shadow:0 6px 0 #1a3a66,0 10px 18px rgba(0,0,0,.4);cursor:pointer}
.x:active{transform:translateY(4px);box-shadow:0 2px 0 #1a3a66}
.stats{display:flex;gap:14px;margin-bottom:18px}
.stat{flex:1;border-radius:20px;padding:12px 14px;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.stat .v{font-size:30px;font-weight:900;line-height:1.1}.stat .l{font-size:13px;font-weight:800;color:#a9bfdf;letter-spacing:.4px}
.stat .meter{height:9px;border-radius:5px;background:rgba(0,0,0,.3);margin-top:8px;overflow:hidden}.stat .meter i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#5ef0a0,#7fe0ff)}
.stat .meter i.hi{background:linear-gradient(90deg,#ffbf4a,#ff6a5a)}
.lbl{font-size:14px;font-weight:900;color:#a9bfdf;letter-spacing:.6px;margin:2px 0 8px}
.btns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.b{flex:1;min-width:120px;height:74px;border-radius:20px;border:0;font-family:inherit;font-size:20px;font-weight:900;color:#eef4ff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
  background:linear-gradient(160deg,#2d5c99,#1f467d);box-shadow:0 6px 0 #163460,0 10px 16px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.15)}
.b ha-icon{--mdc-icon-size:28px}
.b:active{transform:translateY(5px);box-shadow:0 1px 0 #163460}
.b.sel{background:linear-gradient(160deg,#ffd67e,#f0a940);color:#3a2408;box-shadow:0 6px 0 #b97a22}
.b.go{background:linear-gradient(160deg,#6be3a4,#2fae6c);color:#063b22;box-shadow:0 6px 0 #1f7a4a}
.b.warn{background:linear-gradient(160deg,#ff8a7a,#e0524a);color:#fff;box-shadow:0 6px 0 #9e2f28}
.fi{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;margin-bottom:7px;background:rgba(255,255,255,.06);font-size:18px;font-weight:800}
.fi .tm{min-width:96px;color:#cfe0f5}.fi .am{margin-left:auto;color:#a9bfdf}
.fi.done{opacity:.5}.fi.next{background:linear-gradient(90deg,rgba(255,211,107,.35),rgba(255,211,107,.08));box-shadow:0 0 0 1px rgba(255,211,107,.5)}
.cols{display:flex;gap:22px}.cols > div{flex:1;min-width:0}
.br-tail{animation:tail 2.6s ease-in-out infinite}@keyframes tail{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(14deg)}}
.br-roll{animation:spin 6s linear infinite}
`;

class Bedroom3DCard extends HTMLElement {
  setConfig(c) { this._cfg = Object.assign({}, BR, c || {}); this._sig = {}; }
  static getStubConfig() { return {}; }
  getCardSize() { return 12; }
  connectedCallback() {
    if (!document.getElementById("h3d-font")) {
      const l = document.createElement("link"); l.id = "h3d-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap";
      document.head.appendChild(l);
    }
    this._tick = setInterval(() => this._clock(), 1000);
    this._evT = setInterval(() => this._loadEvents(), 15 * 60000);
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    window.addEventListener("resize", (this._wr = () => this._fit()));
    if (this._hass) this._subs();
  }
  disconnectedCallback() {
    clearInterval(this._tick); clearInterval(this._evT);
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
    if (!this._unFeed && this._cfg.feeder_schedule_template) { this._unFeed = c.subscribeMessage((m) => { const r = m.result; try { this._feed = typeof r === "string" ? JSON.parse(r) : Array.isArray(r) ? r : []; } catch (e) { this._feed = []; } this._sig.t = null; this._update(); }, { type: "render_template", template: this._cfg.feeder_schedule_template }); this._unFeed.catch(() => (this._unFeed = null)); }
  }
  _st(e) { return this._hass && this._hass.states[e]; }
  _s(e) { const s = this._st(e); return s ? s.state : "unavailable"; }
  _n(e, a) { const s = this._st(e); if (!s) return NaN; return parseFloat(a ? s.attributes[a] : s.state); }
  _call(d, sv, data) { this._hass.callService(d, sv, data); }

  _build() {
    this._built = true;
    const r = this.attachShadow({ mode: "open" });
    r.innerHTML = `<style>${BASE_CSS}${BR_CSS}</style><div class="outer"><div class="stage">
      <div class="bokeh" style="left:-80px;top:380px;width:420px;height:420px;background:#2e6bc4"></div>
      <div class="bokeh" style="left:760px;top:-120px;width:520px;height:380px;background:#3a5fb8;animation-delay:-8s"></div>
      <div class="abs clock"></div><div class="abs date"></div>
      <div class="abs house"></div><div class="precip"></div><div class="abs wx"></div>
      <div class="abs gauges">
        <div class="gauge"><div class="g-top g-hum"></div>${pedestal(112, 46)}<div class="val v-hum"></div><div class="lbl">HUMIDITY</div></div>
        <div class="gauge"><div class="g-top g-bar"></div>${pedestal(112, 46)}<div class="val v-bar"></div><div class="lbl">PRESSURE</div></div>
        <div class="gauge"><div class="g-top g-wind"></div>${pedestal(112, 46)}<div class="val v-wind"></div><div class="lbl">WIND</div></div>
      </div>
      <div class="abs hdr" style="left:458px">Outside · <span class="cond"></span></div><div class="abs big out" style="left:450px"></div>
      <div class="abs hdr" style="left:800px">Bedroom</div><div class="abs big in" style="left:792px"></div><div class="abs hdr inh" style="left:800px;top:128px;font-size:14px;color:#9fd0ff"></div>
      <div class="abs hdr hilo" style="left:1010px;top:60px;line-height:1.5;text-align:right;width:250px"></div>
      <div class="abs scene"><div class="bs"></div><div class="nm">${this._cfg.name}</div></div>
      <div class="abs fc"></div>
      <div class="abs tiles"></div>
      <div class="abs cal2"><div class="ics"></div><div class="evs"></div></div>
      <div class="pop"><div class="panel"></div></div>
    </div></div>`;
    this._$ = (s) => r.querySelector(s);
    // tiles
    const T = [
      ["tv", "TV Lights", "mdi:television-ambient-light"], ["lamp_left", this._cfg.lamp_left_name, "mdi:lamp"], ["lamp_right", this._cfg.lamp_right_name, "mdi:lamp"],
      ["purifier", "Air Purifier", "mdi:air-purifier"], ["vac", this._cfg.vac_name, "mdi:robot-vacuum"], ["backyard", this._cfg.backyard_name, "mdi:string-lights"],
      ["litter", "Litter-Robot", "mdi:cat"], ["feeder", "Cat Feeder", "mdi:bowl-mix"], ["goodnight", "Goodnight", "mdi:weather-night"],
    ];
    this._$(".tiles").innerHTML = T.map(([k, n, i]) => `<div class="t" data-k="${k}"><div class="ib ${k === "purifier" ? "spin" : k === "vac" ? "bob" : ""}"><ha-icon icon="${i}"></ha-icon></div><div class="tn">${n}</div><div class="ts"></div>${["purifier", "litter", "feeder"].includes(k) ? '<div class="more">›</div>' : ""}<div class="badge" style="display:none"></div></div>`).join("");
    this._$(".tiles").querySelectorAll(".t").forEach((t) => t.addEventListener("click", () => this._tap(t.dataset.k, t)));
    this._$(".pop").addEventListener("click", (e) => { if (e.target.classList.contains("pop")) this._close(); });
    this._clock(); this._fit();
    const m = (location.hash || "").match(/pop=(\w+)/); // preview aid: #pop=purifier|vac|litter|feeder
    if (m) setTimeout(() => this._open(m[1]), 1500);
  }
  _fit() {
    if (!this._built) return;
    const stage = this._$(".stage"), outer = this._$(".outer");
    const w = this.clientWidth || this.getBoundingClientRect().width || 1280;
    const top = Math.max(0, this.getBoundingClientRect().top);
    const k = Math.min(w / 1280, Math.max(300, window.innerHeight - top - 4) / 720);
    stage.style.transform = `scale(${k})`; outer.style.height = 720 * k + "px";
    stage.style.marginRight = 1280 * k - 1280 + "px"; stage.style.marginBottom = 720 * k - 720 + "px";
  }
  _clock() {
    if (!this._built) return;
    const d = new Date(); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    const t = `${h}:${String(d.getMinutes()).padStart(2, "0")}<small>${ap}</small>`;
    if (this._lt !== t) { this._lt = t; this._$(".clock").innerHTML = t; this._sig.t = null; this._update(); }
    const ds = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (this._ld !== ds) { this._ld = ds; this._$(".date").textContent = ds; this._$(".ics").innerHTML = calSVG(d); }
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
    this._events = all.filter((x) => x.t > Date.now() - 3 * 3600e3).slice(0, 3);
    this._sig.ev = null; this._update();
  }

  _update() {
    if (!this._built || !this._hass) return;
    const C = this._cfg, W = this._st(C.weather), a = W ? W.attributes : {}, sun = this._st(C.sun);
    const night = sun ? sun.state === "below_horizon" : false;
    const outT = C.outside_temp && !isNaN(this._n(C.outside_temp)) ? this._n(C.outside_temp) : a.temperature;
    const cond = W ? W.state : "";
    const rt = (C.room_temp || "").startsWith("climate.") ? this._n(C.room_temp, "current_temperature") : this._n(C.room_temp);
    const rh = this._n(C.room_hum);
    const hi = this._n(C.high), lo = this._n(C.low), rc = this._n(C.rain_chance);
    const sH = [Math.round(outT), cond, rt, rh, hi, lo, rc].join();
    if (this._sig.h !== sH) {
      this._sig.h = sH;
      this._$(".out").textContent = isNaN(outT) ? "--" : Math.round(outT) + "°";
      this._$(".cond").textContent = (cond || "").replace("partlycloudy", "partly cloudy").replace("clear-night", "clear").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      this._$(".in").textContent = isNaN(rt) ? "--" : Math.round(rt) + "°";
      this._$(".inh").textContent = isNaN(rh) ? "" : `💧 ${Math.round(rh)}% humidity`;
      this._$(".hilo").innerHTML = `High <b style="color:#ffd36b;font-size:20px">${isNaN(hi) ? "--" : Math.round(hi)}°</b><br>Low <b style="color:#ffd36b;font-size:20px">${isNaN(lo) ? "--" : Math.round(lo)}°</b><br>Rain <b style="color:#ffd36b;font-size:20px">${isNaN(rc) ? "--" : Math.round(rc)}%</b>`;
    }
    const cold = !isNaN(outT) && outT < 50, sW = [cond, night, cold].join();
    if (this._sig.w !== sW) {
      this._sig.w = sW;
      this._$(".house").innerHTML = houseSVG(night, cold);
      this._$(".wx").innerHTML = weatherSVG(cond, night, 150);
      const rainy = ["rainy", "pouring", "lightning-rainy"].includes(cond), snowy = ["snowy", "snowy-rainy"].includes(cond);
      this._$(".precip").innerHTML = rainy ? Array.from({ length: 34 }, () => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random()}s;animation-duration:${0.6 + Math.random() * 0.5}s"></i>`).join("")
        : snowy ? Array.from({ length: 30 }, () => `<i class="sn" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s;animation-duration:${3 + Math.random() * 3}s"></i>`).join("") : "";
    }
    const sG = [a.humidity, a.pressure, a.wind_speed, a.wind_bearing].join();
    if (this._sig.g !== sG) {
      this._sig.g = sG;
      this._$(".g-hum").innerHTML = dropSVG(a.humidity); this._$(".v-hum").textContent = a.humidity != null ? Math.round(a.humidity) + "%" : "--";
      this._$(".g-bar").innerHTML = baroSVG(+a.pressure || 29.92, a.pressure_unit); this._$(".v-bar").textContent = a.pressure != null ? (+a.pressure).toFixed(2) + " " + (a.pressure_unit || "") : "--";
      this._$(".g-wind").innerHTML = sockHTML(+a.wind_speed || 0, +a.wind_bearing || 0);
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      this._$(".v-wind").textContent = a.wind_speed != null ? `${Math.round(a.wind_speed)} mph ${dirs[Math.round(((+a.wind_bearing || 0) % 360) / 45) % 8]}` : "--";
    }
    const fc = (this._fcast || []).slice(0, 3);
    const sF = JSON.stringify(fc.map((f) => [f.condition, Math.round(f.temperature), Math.round(f.templow), f.datetime]));
    if (this._sig.fc !== sF) {
      this._sig.fc = sF;
      this._$(".fc").innerHTML = fc.map((f, i) => `<div class="fday"><div class="ic">${weatherSVG(f.condition, false, 80)}</div>${pedestal(100, 40)}<div class="dn">${i === 0 ? "Today" : new Date(f.datetime).toLocaleDateString("en-US", { weekday: "short" })}</div><div class="tp">${Math.round(f.temperature)}°<small>${f.templow != null ? Math.round(f.templow) + "°" : ""}</small></div></div>`).join("");
    }
    // events
    const sE = JSON.stringify(this._events || []) + (sun ? sun.attributes.next_setting : "");
    if (this._sig.ev !== sE) {
      this._sig.ev = sE;
      const today = new Date(), tm = new Date(today); tm.setDate(today.getDate() + 1);
      const fmt = (e) => { const day = e.t.toDateString() === today.toDateString() ? "Today" : e.t.toDateString() === tm.toDateString() ? "Tomorrow" : e.t.toLocaleDateString("en-US", { weekday: "short" }); return e.ad ? day : `${day} ${e.t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`; };
      let html = (this._events || []).map((e) => `<div class="ev"><span class="tt">${fmt(e)}</span><span class="s">${e.s}</span></div>`).join("");
      if (!html && sun) html = `<div class="ev"><span class="tt">${night ? "Sunrise" : "Sunset"}</span><span class="s">${new Date(night ? sun.attributes.next_rising : sun.attributes.next_setting).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></div>`;
      this._$(".cal2 .evs").innerHTML = html;
    }
    // scene + tiles
    const ids = [C.tv_lights, C.lamp_left, C.lamp_right, C.backyard, C.purifier, C.purifier_nl, C.vac, C.litter, C.litter_code, C.feeder_feeding, C.feeder_food, C.feeder_error, C.vac_batt, C.litter_drawer, C.purifier_speed, C.feeder_dispensed, C.feeder_planned];
    const st = {}; ids.forEach((e) => (st[e] = this._s(e)));
    st.tvColor = rgbOf(this._st(C.tv_lights));
    st.lrBad = /fault|full|removed|offline|interrupt|pinch/i.test(LR_CODES[st[C.litter_code]] || "");
    const sigS = JSON.stringify(st) + night;
    if (this._sig.s !== sigS) { this._sig.s = sigS; this._$(".bs").innerHTML = bedroomSVG(st, night, C); }
    const sigT = sigS + JSON.stringify(this._feed || []) + this._lt;
    if (this._sig.t !== sigT) { this._sig.t = sigT; this._tiles(st); }
    if (this._open_k) this._renderPop(this._open_k);
  }

  _setTile(k, cls, ts, badge) {
    const t = this._$(`.t[data-k="${k}"]`); if (!t || t._armed) return;
    t.className = "t " + (cls || "");
    t.querySelector(".ts").innerHTML = ts;
    const b = t.querySelector(".badge"); b.style.display = badge ? "" : "none"; b.textContent = badge || "";
  }
  _tiles(st) {
    const C = this._cfg;
    const lightTxt = (e) => { const s = this._st(e); if (!s) return "Unavailable"; if (s.state !== "on") return s.state === "unavailable" ? "Unavailable" : "Off"; const b = s.attributes.brightness; return b ? `On · ${Math.round((b / 255) * 100)}%` : "On"; };
    const tv = this._st(C.tv_lights);
    this._setTile("tv", st[C.tv_lights] === "on" ? "cool" : "", (st[C.tv_lights] === "on" ? `<span class="dot" style="color:${st.tvColor};background:${st.tvColor}"></span>` : "") + lightTxt(C.tv_lights));
    this._setTile("lamp_left", st[C.lamp_left] === "on" ? "on" : "", lightTxt(C.lamp_left));
    this._setTile("lamp_right", st[C.lamp_right] === "on" ? "on" : "", lightTxt(C.lamp_right));
    this._setTile("backyard", st[C.backyard] === "on" ? "on" : "", st[C.backyard] === "on" ? "On" : st[C.backyard] === "unavailable" ? "Unavailable" : "Off");
    const pf = this._st(C.purifier);
    this._setTile("purifier", st[C.purifier] === "on" ? "cool" : "", st[C.purifier] === "on" ? `On · ${(pf.attributes.preset_mode || "").replace(/^\w/, (c) => c.toUpperCase())}${st[C.purifier_nl] === "on" ? " · 🌙" : ""}` : "Off");
    const vs = st[C.vac], vb = this._n(C.vac_batt);
    const vst = this._s(C.vac_status), busy = !["docked", "idle", "unavailable"].includes(vs);
    const vtxt = busy ? (vst && !["unknown", "unavailable"].includes(vst) ? vst.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : vs.replace(/^\w/, (c) => c.toUpperCase())) : (vst && !["unknown", "unavailable", "idle"].includes(vst) ? vst.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) + " · tap to start" : "Docked · tap to start");
    this._setTile("vac", vs === "cleaning" || vs === "returning" ? "cool" : vs === "error" ? "warn" : "", vtxt, isNaN(vb) ? "" : vb + "%");
    const code = st[C.litter_code], dr = this._n(C.litter_drawer);
    this._setTile("litter", st.lrBad ? "warn" : ["ccp", "ec"].includes(code) ? "cool" : "", LR_CODES[code] || code, isNaN(dr) ? "" : `🗑 ${Math.round(dr)}%`);
    const err = st[C.feeder_error], low = st[C.feeder_food] === "on";
    const nxt = (this._feed || []).find((i) => i.s === "next");
    this._setTile("feeder", err && err !== "No error" && err !== "unavailable" ? "warn" : st[C.feeder_feeding] === "on" ? "on" : "", err && err !== "No error" && err !== "unavailable" ? err : low ? "Food low!" : nxt ? `Next ${nxt.t}` : "Done for today",
      `${this._s(C.feeder_dispensed)}/${this._s(C.feeder_planned)} g`);
    this._setTile("goodnight", "night", "Lights off · lock up");
  }

  _arm(t, msg, fn) {
    if (t._armed) { t._armed = false; clearTimeout(t._at); fn(); this._sig.t = null; this._update(); return; }
    t._armed = true; t.className = "t warn"; t.querySelector(".ts").textContent = msg;
    t._at = setTimeout(() => { t._armed = false; this._sig.t = null; this._update(); }, 4000);
  }
  _tap(k, t) {
    const C = this._cfg;
    if (k === "tv") this._call("light", "toggle", { entity_id: C.tv_lights });
    else if (k === "lamp_left") this._call("light", "toggle", { entity_id: C.lamp_left });
    else if (k === "lamp_right") this._call("light", "toggle", { entity_id: C.lamp_right });
    else if (k === "backyard") this._call("switch", "toggle", { entity_id: C.backyard });
    else if (k === "vac") {
      const vs = this._s(C.vac);
      if (["docked", "idle", "paused"].includes(vs)) this._arm(t, "Tap again to clean", () => C.vac_segments ? this._call("dreame_vacuum", "vacuum_clean_segment", { entity_id: C.vac, segments: C.vac_segments }) : this._call("vacuum", "start", { entity_id: C.vac }));
    }
    else if (k === "goodnight") this._arm(t, "Tap again for goodnight", () => this._call("script", "turn_on", { entity_id: C.goodnight }));
    else this._open(k);
  }

  /* ---------- popups ---------- */
  _open(k) { this._open_k = k; this._renderPop(k, true); this._$(".pop").classList.add("open"); this._bump(); }
  _close() { this._open_k = null; this._$(".pop").classList.remove("open"); clearTimeout(this._idle); }
  _bump() { clearTimeout(this._idle); this._idle = setTimeout(() => this._close(), 60000); }
  _renderPop(k, force) {
    const C = this._cfg, p = this._$(".panel");
    const cap = (s) => (s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    const stat = (v, l, pct, hiBad) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div>${pct != null && !isNaN(pct) ? `<div class="meter"><i class="${hiBad && pct >= 80 ? "hi" : ""}" style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>` : ""}</div>`;
    let title = "", icon = "", body = "";
    if (k === "purifier") {
      const f = this._st(C.purifier), on = f && f.state === "on", pm = f ? f.attributes.preset_mode : "", sp = this._s(C.purifier_speed), nl = this._s(C.purifier_nl) === "on", sc = this._s(C.purifier_scene);
      const aq = this._n(C.purifier_aq), fl = this._n(C.purifier_filter);
      const aqT = { 1: "Excellent", 2: "Good", 3: "Moderate", 4: "Poor" }[aq] || (isNaN(aq) ? "--" : aq);
      title = "Air Purifier"; icon = "mdi:air-purifier";
      body = `<div class="stats">${stat(on ? "On" : "Off", "POWER")}${stat(aqT, "AIR QUALITY")}${stat(isNaN(fl) ? "--" : fl + "%", "FILTER LIFE", fl)}</div>
        <div class="btns"><button class="b ${on ? "go" : ""}" data-a="pw"><ha-icon icon="mdi:power"></ha-icon>${on ? "Turn off" : "Turn on"}</button>
        ${["auto", "sleep", "normal", "turbo"].map((m) => `<button class="b ${on && pm === m ? "sel" : ""}" data-a="pm:${m}">${cap(m)}</button>`).join("")}</div>
        <div class="lbl">FAN SPEED (NORMAL MODE)</div><div class="btns">${["Low", "Medium", "High"].map((m) => `<button class="b ${sp === m ? "sel" : ""}" data-a="sp:${m}">${m}</button>`).join("")}</div>
        <div class="lbl">NIGHT LIGHT</div><div class="btns"><button class="b ${nl ? "sel" : ""}" data-a="nl"><ha-icon icon="mdi:weather-night"></ha-icon>${nl ? "On" : "Off"}</button>
        ${["Forest", "Ocean", "Wetland", "Leisurely", "Asleep"].map((m) => `<button class="b ${sc === m ? "sel" : ""}" data-a="sc:${m}" style="min-width:96px;font-size:17px">${m}</button>`).join("")}</div>`;
    } else if (k === "vac") {
      const v = this._st(C.vac), vs = v ? v.state : "unavailable", b = this._n(C.vac_batt);
      title = C.vac_name; icon = "mdi:robot-vacuum";
      body = `<div class="stats">${stat(cap(vs), "STATE")}${stat(isNaN(b) ? "--" : b + "%", "BATTERY", b)}${stat(cap(this._s(C.vac_status)), "STATUS")}${stat(`${this._s(C.vac_area)} m² · ${this._s(C.vac_time)} min`, "LAST CLEAN")}</div>
        <div class="btns"><button class="b go" data-a="vs"><ha-icon icon="mdi:play"></ha-icon>Start</button><button class="b" data-a="vp"><ha-icon icon="mdi:pause"></ha-icon>Pause</button><button class="b" data-a="vd"><ha-icon icon="mdi:home-import-outline"></ha-icon>Dock</button></div>`;
    } else if (k === "litter") {
      const code = this._s(C.litter_code), dr = this._n(C.litter_drawer), lv = this._n(C.litter_level), w = this._n(C.litter_weight), g = this._s(C.litter_globe);
      title = "Litter-Robot"; icon = "mdi:cat";
      body = `<div class="stats">${stat(LR_CODES[code] || code, "STATUS")}${stat(isNaN(dr) ? "--" : Math.round(dr) + "%", "WASTE DRAWER", dr, true)}${stat(isNaN(lv) ? "--" : Math.round(lv) + "%", "LITTER LEVEL", lv)}${stat(isNaN(w) ? "--" : w.toFixed(1) + " lb", "CAT WEIGHT")}</div>
        <div class="btns"><button class="b go" data-a="lc"><ha-icon icon="mdi:rotate-3d-variant"></ha-icon>Clean now</button></div>
        <div class="lbl">GLOBE LIGHT</div><div class="btns">${["auto", "on", "off"].map((m) => `<button class="b ${g === m ? "sel" : ""}" data-a="gl:${m}">${cap(m)}</button>`).join("")}</div>`;
    } else if (k === "feeder") {
      const err = this._s(C.feeder_error), low = this._s(C.feeder_food) === "on", ds = this._n(C.feeder_desiccant);
      title = "Cat Feeder"; icon = "mdi:bowl-mix";
      const feed = (this._feed || []).map((i) => `<div class="fi ${i.s}"><span>${i.s === "done" ? "✅" : i.s === "next" ? "⏭️" : "🕒"}</span><span class="tm">${i.t}</span><span>${i.n}</span><span class="am">${i.a} g</span></div>`).join("") || `<div class="fi">No feedings planned today.</div>`;
      body = `<div class="stats">${stat(low ? "Low!" : "OK", "FOOD LEVEL")}${stat(`${this._s(C.feeder_dispensed)} / ${this._s(C.feeder_planned)} g`, "FED TODAY")}${stat(isNaN(ds) ? "--" : ds + " d", "DESICCANT LEFT")}${stat(err === "No error" ? "None" : err, "ERRORS")}</div>
        <div class="cols"><div><div class="lbl">TODAY'S PLAN</div>${feed}</div><div><div class="lbl">FEED NOW (TAP TWICE)</div><div class="btns">${[10, 20, 30].map((g) => `<button class="b go" data-a="fd:${g}">${g} g</button>`).join("")}</div></div></div>`;
    }
    const key = k + body;
    if (!force && this._popKey === key) return;
    this._popKey = key;
    p.innerHTML = `<div class="ph"><div class="pi"><ha-icon icon="${icon}"></ha-icon></div><h2>${title}</h2><button class="x">✕</button></div>${body}`;
    p.querySelector(".x").addEventListener("click", () => this._close());
    p.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._bump(); this._act(b.dataset.a, b); }));
  }
  _act(a, btn) {
    const C = this._cfg, [x, v] = a.split(":");
    const twice = (msg, fn) => {
      if (btn._armed) { btn._armed = false; fn(); btn.classList.remove("warn"); btn.textContent = "Sent ✓"; return; }
      btn._armed = true; const old = btn.innerHTML; btn.classList.add("warn"); btn.textContent = msg;
      setTimeout(() => { if (btn._armed) { btn._armed = false; btn.classList.remove("warn"); btn.innerHTML = old; } }, 4000);
    };
    if (x === "pw") this._call("fan", "toggle", { entity_id: C.purifier });
    else if (x === "pm") this._call("fan", "set_preset_mode", { entity_id: C.purifier, preset_mode: v });
    else if (x === "sp") this._call("select", "select_option", { entity_id: C.purifier_speed, option: v });
    else if (x === "nl") this._call("light", "toggle", { entity_id: C.purifier_nl });
    else if (x === "sc") this._call("select", "select_option", { entity_id: C.purifier_scene, option: v });
    else if (x === "vs") this._call("vacuum", "start", { entity_id: C.vac });
    else if (x === "vp") this._call("vacuum", "pause", { entity_id: C.vac });
    else if (x === "vd") this._call("vacuum", "return_to_base", { entity_id: C.vac });
    else if (x === "lc") twice("Tap again to clean", () => this._call("vacuum", "start", { entity_id: C.litter }));
    else if (x === "gl") this._call("select", "select_option", { entity_id: C.litter_globe, option: v });
    else if (x === "fd") twice(`Tap again: ${v} g`, () => this._call("text", "set_value", { entity_id: C.feeder_manual, value: String(v) }));
  }
}

if (!customElements.get("bedroom3d-card")) customElements.define("bedroom3d-card", Bedroom3DCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bedroom3d-card", name: "Bedroom 3D", description: "Animated isometric bedroom dashboard" });
console.info("%c BEDROOM3D-CARD %c 1.0.0 ", "background:#1d5c3d;color:#fff", "background:#2d5c99;color:#fff");
