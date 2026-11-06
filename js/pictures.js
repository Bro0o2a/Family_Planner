// ---------- 🖼️ PICTURE QUESTIONS: a small drawing on a worksheet question, only where the question needs one ----------
// The AI server sends q.picture = { type, title, numbers, labels, svg, alt } (see the server's worksheet schema).
// The app draws the ready types itself (always neat, prints well in the 📄 PDF, costs the AI only a few words):
//   clock            numbers [hour, minute]
//   number_line      numbers [start, end, step, ...points to mark]  · labels: the marked points' names (e.g. "A", "?")
//   fraction_bar     numbers [parts, shaded, parts, shaded, ...]    (one bar for each pair, at most 4)
//   fraction_circle  numbers [parts, shaded, ...]                   (one circle for each pair, at most 4)
//   bar_chart        labels: the bars' names · numbers: their values · title: the chart's title
//   table            labels: the cells, row by row · numbers [columns] (the first row is the heading)
//   array            labels [emoji or word] · numbers [rows, columns]     (e.g. 3 rows of 4 🍎)
//   groups           labels [emoji or word] · numbers [groups, in each]   (e.g. 3 bags of 5 ⭐)
//   shape            labels [shape, side labels …] (rectangle, square, triangle, right_triangle, circle, parallelogram,
//                    trapezium, pentagon, hexagon, octagon, cube, cuboid, cylinder, cone, sphere, pyramid)
//   angle            numbers [degrees] · labels [the angle's label, e.g. "?" or "x"]
//   thermometer      numbers [lowest, highest, reading]
//   coordinate_grid  numbers [size, x1, y1, x2, y2, ...] · labels: the points' names
//   diagram          svg: a simple drawing made by the AI (science: a life cycle, a plant, a circuit …), cleaned before use
// alt says in words what the picture shows: the ✅ checker gets it with the answer key.
const PIC_TYPES = ["clock", "number_line", "fraction_bar", "fraction_circle", "bar_chart", "table", "array", "groups", "shape", "angle", "thermometer", "coordinate_grid", "diagram"];
const PIC_SVG_MAX = 12000;
// The picture as saved with the worksheet (null when there is none or it can't be drawn)
function cleanPic(p) {
  if (!p || typeof p !== "object" || !PIC_TYPES.includes(p.type)) return null;
  const numbers = aiArr(p.numbers, 40).map(Number).filter(Number.isFinite).map(n => Math.round(n * 1000) / 1000);
  const labels = aiArr(p.labels, 40).map(x => aiTxt(x, 40));
  const svg = p.type === "diagram" ? picSafeSvg(p.svg) : "";
  if (p.type === "diagram" && !svg) return null;
  const out = { type: p.type, title: aiTxt(p.title, 80), numbers, labels, alt: aiTxt(p.alt, 300), ...(svg ? { svg } : {}) };
  return picBody(out) ? out : null;   // (only a picture that really draws)
}
// 🧹 The AI's own SVG drawing: only shapes, lines and text are kept (no scripts, links, pictures from the web or styles)
const PIC_TAGS = ["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs", "marker", "title"];
const PIC_ATTRS = ["viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "stroke",
  "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill-opacity", "opacity", "transform", "font-size", "font-weight",
  "text-anchor", "dominant-baseline", "dx", "dy", "id", "markerWidth", "markerHeight", "refX", "refY", "orient", "marker-end", "marker-start", "xmlns"];
function picSafeSvg(src) {
  const text = typeof src === "string" ? src.trim() : "";
  if (!text || text.length > PIC_SVG_MAX || typeof DOMParser === "undefined") return "";
  let doc;
  try { doc = new DOMParser().parseFromString(text, "image/svg+xml"); } catch { return ""; }
  const root = doc && doc.documentElement;
  if (!root || root.nodeName !== "svg" || doc.getElementsByTagName("parsererror").length) return "";
  const walk = el => {
    [...el.children].forEach(c => { if (!PIC_TAGS.includes(c.nodeName)) c.remove(); else walk(c); });
    [...el.attributes].forEach(a => {
      const v = a.value;
      if (!PIC_ATTRS.includes(a.name) || /url\s*\(|javascript:|expression|data:/i.test(v) && !/^url\(#[\w-]+\)$/.test(v.trim())) el.removeAttribute(a.name);
    });
  };
  walk(root);
  if (!root.getAttribute("viewBox")) {
    const w = parseFloat(root.getAttribute("width")) || 300, hh = parseFloat(root.getAttribute("height")) || 200;
    root.setAttribute("viewBox", `0 0 ${w} ${hh}`);
  }
  root.removeAttribute("width"); root.removeAttribute("height");
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const out = new XMLSerializer().serializeToString(root);
  return out.length <= PIC_SVG_MAX ? out : "";
}

// ---------- Drawing (SVG text, black on white like the rest of the paper) ----------
const picEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const picNum = n => String(Math.round(n * 100) / 100);
const PIC_INK = "#222", PIC_SHADE = "#9a9a9a", PIC_LIGHT = "#e9e9e9";
const picSvg = (w, hh, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="${PIC_INK}" stroke-width="2">${body}</svg>`;
const picText = (x, y, t, size = 14, anchor = "middle", extra = "") => `<text x="${picNum(x)}" y="${picNum(y)}" font-size="${size}" text-anchor="${anchor}" fill="${PIC_INK}" stroke="none" ${extra}>${picEsc(t)}</text>`;

function picClock([hr = 3, mn = 0]) {
  const c = 90, r = 78, hrA = ((hr % 12) + mn / 60) * 30, mnA = mn * 6;
  const at = (a, len) => [c + len * Math.sin(a * Math.PI / 180), c - len * Math.cos(a * Math.PI / 180)];
  let s = `<circle cx="${c}" cy="${c}" r="${r}" stroke-width="3"/>`;
  for (let i = 0; i < 60; i++) { const [x1, y1] = at(i * 6, r), [x2, y2] = at(i * 6, i % 5 ? r - 5 : r - 10); s += `<line x1="${picNum(x1)}" y1="${picNum(y1)}" x2="${picNum(x2)}" y2="${picNum(y2)}" stroke-width="${i % 5 ? 1 : 2.5}"/>`; }
  for (let i = 1; i <= 12; i++) { const [x, y] = at(i * 30, r - 22); s += picText(x, y + 5, i, 15, "middle", 'font-weight="bold"'); }
  const [hx, hy] = at(hrA, 42), [mx, my] = at(mnA, 62);
  s += `<line x1="${c}" y1="${c}" x2="${picNum(hx)}" y2="${picNum(hy)}" stroke-width="6" stroke-linecap="round"/><line x1="${c}" y1="${c}" x2="${picNum(mx)}" y2="${picNum(my)}" stroke-width="3.5" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="5" fill="${PIC_INK}"/>`;
  return picSvg(180, 180, s);
}
function picNumberLine(nums, labels) {
  const [a = 0, b = 10, st0 = 1, ...marks] = nums;
  if (!(b > a)) return "";
  let step = st0 > 0 ? st0 : 1;
  while ((b - a) / step > 20) step *= 2;   // (at most about 20 ticks)
  const W = 420, L = 24, R = W - 24, y = 40, X = v => L + (v - a) / (b - a) * (R - L);
  let s = `<line x1="${L - 10}" y1="${y}" x2="${R + 10}" y2="${y}"/><path d="M${L - 10} ${y} l8 -5 v10 z M${R + 10} ${y} l-8 -5 v10 z" fill="${PIC_INK}"/>`;
  for (let v = a, k = 0; v <= b + 1e-9 && k < 60; v += step, k++) s += `<line x1="${picNum(X(v))}" y1="${y - 8}" x2="${picNum(X(v))}" y2="${y + 8}"/>` + picText(X(v), y + 26, picNum(v), 13);
  marks.slice(0, 6).forEach((v, i) => { if (v < a || v > b) return; const x = X(v);
    s += `<circle cx="${picNum(x)}" cy="${y}" r="6" fill="${PIC_INK}"/>` + picText(x, y - 14, labels[i] || "", 14, "middle", 'font-weight="bold"'); });
  return picSvg(W, 76, s);
}
function picPairs(nums) {
  const out = [];
  for (let i = 0; i + 1 < nums.length && out.length < 4; i += 2) { const p = Math.round(nums[i]), sh = Math.round(nums[i + 1]); if (p >= 1 && p <= 24 && sh >= 0 && sh <= p) out.push([p, sh]); }
  return out;
}
function picFractionBar(nums) {
  const bars = picPairs(nums);
  if (!bars.length) return "";
  const W = 380, bh = 34, gap = 14;
  const s = bars.map(([p, sh], k) => { const y = 4 + k * (bh + gap), cw = (W - 8) / p;
    return Array.from({ length: p }, (_, i) => `<rect x="${picNum(4 + i * cw)}" y="${y}" width="${picNum(cw)}" height="${bh}" fill="${i < sh ? PIC_SHADE : "#fff"}"/>`).join(""); }).join("");
  return picSvg(W, 8 + bars.length * (bh + gap) - gap, s);
}
function picFractionCircle(nums) {
  const pies = picPairs(nums);
  if (!pies.length) return "";
  const R = 52, D = 2 * R + 16;
  const s = pies.map(([p, sh], k) => { const cx = 8 + R + k * D, cy = 8 + R;
    if (p === 1) return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${sh ? PIC_SHADE : "#fff"}"/>`;
    return Array.from({ length: p }, (_, i) => { const a1 = i / p * 2 * Math.PI - Math.PI / 2, a2 = (i + 1) / p * 2 * Math.PI - Math.PI / 2;
      return `<path d="M${cx} ${cy} L${picNum(cx + R * Math.cos(a1))} ${picNum(cy + R * Math.sin(a1))} A${R} ${R} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${picNum(cx + R * Math.cos(a2))} ${picNum(cy + R * Math.sin(a2))} Z" fill="${i < sh ? PIC_SHADE : "#fff"}"/>`; }).join(""); }).join("");
  return picSvg(pies.length * D, 2 * R + 16, s);
}
function picBarChart(nums, labels, title) {
  const n = Math.min(nums.length, labels.length || nums.length, 10);
  if (!n) return "";
  const vals = nums.slice(0, n).map(v => Math.max(0, v)), top0 = Math.max(...vals, 1);
  const stepOf = m => { const raw = m / 5, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map(k => k * p).find(k => k >= raw) || raw; };
  const step = stepOf(top0), top = Math.ceil(top0 / step) * step;
  const W = 420, Hc = 170, L = 44, B = Hc + 20, T = title ? 30 : 12, bw = (W - L - 10) / n;
  const Y = v => B - v / top * (B - T);
  let s = title ? picText(W / 2, 18, title, 15, "middle", 'font-weight="bold"') : "";
  for (let v = 0; v <= top + 1e-9; v += step) s += `<line x1="${L}" y1="${picNum(Y(v))}" x2="${W - 6}" y2="${picNum(Y(v))}" stroke="#bbb" stroke-width="1"/>` + picText(L - 6, Y(v) + 4, picNum(v), 12, "end");
  vals.forEach((v, i) => { const x = L + i * bw + bw * 0.18;
    s += `<rect x="${picNum(x)}" y="${picNum(Y(v))}" width="${picNum(bw * 0.64)}" height="${picNum(B - Y(v))}" fill="${PIC_SHADE}"/>` + picText(L + (i + 0.5) * bw, B + 18, labels[i] || "", 12); });
  s += `<line x1="${L}" y1="${T - 4}" x2="${L}" y2="${B}"/><line x1="${L}" y1="${B}" x2="${W - 6}" y2="${B}"/>`;
  return picSvg(W, B + 28, s);
}
function picTable(nums, labels) {
  const cols = Math.max(1, Math.min(6, Math.round(nums[0] || 2))), rows = Math.min(10, Math.ceil(labels.length / cols));
  if (!labels.length || rows < 1) return "";
  const cw = Math.min(130, 420 / cols), rh = 30, W = cols * cw + 4;
  let s = `<rect x="2" y="2" width="${cols * cw}" height="${rh}" fill="${PIC_LIGHT}" stroke="none"/>`;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = 2 + c * cw, y = 2 + r * rh;
    s += `<rect x="${picNum(x)}" y="${y}" width="${picNum(cw)}" height="${rh}" stroke-width="1.5"/>` + picText(x + cw / 2, y + 20, labels[r * cols + c] || "", 13, "middle", r ? "" : 'font-weight="bold"');
  }
  return picSvg(W, rows * rh + 4, s);
}
function picItems(nums, labels, grouped) {
  const a = Math.max(1, Math.min(10, Math.round(nums[0] || 1))), b = Math.max(1, Math.min(12, Math.round(nums[1] || 1))), item = labels[0] || "●";
  const sz = 26;
  if (!grouped) {   // rows × columns
    let s = "";
    for (let r = 0; r < a; r++) for (let c = 0; c < b; c++) s += picText(14 + c * (sz + 6), 24 + r * (sz + 6), item, 22);
    return picSvg(b * (sz + 6) + 4, a * (sz + 6) + 6, s);
  }
  const per = Math.min(b, 4), lines = Math.ceil(b / per), gw = per * (sz + 2) + 18, gh = lines * (sz + 2) + 16, inRow = Math.min(a, Math.max(1, Math.floor(440 / (gw + 10))));
  let s = "";
  for (let g = 0; g < a; g++) { const gx = 2 + (g % inRow) * (gw + 10), gy = 2 + Math.floor(g / inRow) * (gh + 10);
    s += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="14" stroke-width="2"/>`;
    for (let i = 0; i < b; i++) s += picText(gx + 9 + (i % per) * (sz + 2) + sz / 2, gy + 8 + Math.floor(i / per) * (sz + 2) + sz - 4, item, 21); }
  const gRows = Math.ceil(a / inRow);
  return picSvg(inRow * (gw + 10), gRows * (gh + 10), s);
}
function picShape(labels) {
  const name = String(labels[0] || "").toLowerCase().replace(/[\s-]+/g, "_"), sides = labels.slice(1).map(String);
  const L = (x, y, t, a = "middle") => t ? picText(x, y, t, 14, a, 'font-weight="bold"') : "";
  const poly = (pts) => `<polygon points="${pts.map(p => p.map(picNum).join(",")).join(" ")}" fill="${PIC_LIGHT}"/>`;
  const reg = n => Array.from({ length: n }, (_, i) => [130 + 70 * Math.cos(i / n * 2 * Math.PI - Math.PI / 2), 90 + 70 * Math.sin(i / n * 2 * Math.PI - Math.PI / 2)]);
  switch (name) {
    case "square": return picSvg(260, 180, poly([[70, 20], [190, 20], [190, 140], [70, 140]]) + L(130, 162, sides[0]) + L(198, 84, sides[1] || "", "start"));
    case "rectangle": return picSvg(320, 170, poly([[40, 20], [260, 20], [260, 130], [40, 130]]) + L(150, 152, sides[0]) + L(268, 80, sides[1], "start"));
    case "triangle": return picSvg(300, 190, poly([[150, 18], [270, 150], [30, 150]]) + L(150, 172, sides[0]) + L(222, 76, sides[1], "start") + L(78, 76, sides[2], "end"));
    case "right_triangle": return picSvg(300, 190, poly([[50, 20], [50, 150], [250, 150]]) + `<path d="M50 132 h18 v18" stroke-width="1.5"/>` + L(150, 172, sides[0]) + L(42, 90, sides[1], "end") + L(160, 76, sides[2], "start"));
    case "circle": return picSvg(240, 180, `<circle cx="120" cy="90" r="74" fill="${PIC_LIGHT}"/><line x1="120" y1="90" x2="194" y2="90"/><circle cx="120" cy="90" r="3" fill="${PIC_INK}"/>` + L(157, 82, sides[0]));
    case "parallelogram": return picSvg(320, 170, poly([[80, 20], [290, 20], [240, 130], [30, 130]]) + L(135, 152, sides[0]) + L(274, 80, sides[1], "start"));
    case "trapezium": case "trapezoid": return picSvg(320, 170, poly([[90, 20], [230, 20], [290, 130], [30, 130]]) + L(160, 152, sides[0]) + L(160, 12, sides[1]) + L(268, 76, sides[2], "start"));
    case "pentagon": return picSvg(260, 180, poly(reg(5)) + L(130, 178, sides[0]));
    case "hexagon": return picSvg(260, 180, poly(reg(6)) + L(130, 178, sides[0]));
    case "octagon": return picSvg(260, 180, poly(reg(8)) + L(130, 178, sides[0]));
    case "cube": case "cuboid": { const w = name === "cube" ? 110 : 160, hh = 110, d = 45;
      return picSvg(340, 200, `<g transform="translate(40 0)"><polygon points="30,${50 + hh} ${30 + w},${50 + hh} ${30 + w},50 30,50" fill="${PIC_LIGHT}"/><polygon points="30,50 ${30 + d},${50 - d * 0.7} ${30 + w + d},${50 - d * 0.7} ${30 + w},50" fill="#f6f6f6"/><polygon points="${30 + w},50 ${30 + w + d},${50 - d * 0.7} ${30 + w + d},${50 + hh - d * 0.7} ${30 + w},${50 + hh}" fill="#d9d9d9"/></g>`
        + L(70 + w / 2, 50 + hh + 22, sides[0]) + L(62, 50 + hh / 2, sides[1], "end") + L(70 + w + d / 2 + 8, 50 + hh - d * 0.35 + 6, sides[2], "start")); }
    case "cylinder": return picSvg(240, 200, `<path d="M60 40 v120 a60 18 0 0 0 120 0 v-120" fill="${PIC_LIGHT}"/><ellipse cx="120" cy="40" rx="60" ry="18" fill="#f6f6f6"/><path d="M60 160 a60 18 0 0 1 120 0" stroke-dasharray="5 4" stroke-width="1.5"/>` + L(196, 104, sides[0], "start") + L(120, 196, sides[1]));
    case "cone": return picSvg(240, 200, `<path d="M120 20 L60 160 a60 18 0 0 0 120 0 Z" fill="${PIC_LIGHT}"/><path d="M60 160 a60 18 0 0 1 120 0" stroke-dasharray="5 4" stroke-width="1.5"/>` + L(166, 90, sides[0], "start"));
    case "sphere": return picSvg(220, 180, `<circle cx="110" cy="90" r="74" fill="${PIC_LIGHT}"/><ellipse cx="110" cy="90" rx="74" ry="20" stroke-dasharray="5 4" stroke-width="1.5"/>` + L(110, 178, sides[0]));
    case "pyramid": return picSvg(260, 200, `<polygon points="130,20 40,150 160,175" fill="${PIC_LIGHT}"/><polygon points="130,20 160,175 230,140" fill="#d9d9d9"/><path d="M40 150 L110 120 L230 140 M110 120 L130 20" stroke-dasharray="5 4" stroke-width="1.5"/>` + L(100, 194, sides[0]));
    default: return "";
  }
}
function picAngle([deg = 60], labels) {
  const d = Math.max(1, Math.min(359, deg)), cx = 60, cy = 150, len = 150, a = -d * Math.PI / 180;
  const ex = cx + len * Math.cos(a), ey = cy + len * Math.sin(a), r = 34;
  const big = d > 180 ? 1 : 0, ax = cx + r * Math.cos(a), ay = cy + r * Math.sin(a), mid = -d / 2 * Math.PI / 180;
  const W = d > 90 ? 320 : 240, xs = Math.min(0, ex - 20), shift = -xs;
  let s = `<g transform="translate(${picNum(shift)} 0)"><line x1="${cx}" y1="${cy}" x2="${cx + len}" y2="${cy}" stroke-width="3"/><line x1="${cx}" y1="${cy}" x2="${picNum(ex)}" y2="${picNum(ey)}" stroke-width="3"/>`;
  s += d === 90 ? `<path d="M${cx + 20} ${cy} v-20 h-20" stroke-width="2"/>` : `<path d="M${cx + r} ${cy} A${r} ${r} 0 ${big} 0 ${picNum(ax)} ${picNum(ay)}" stroke-width="2"/>`;
  s += picText(cx + (r + 18) * Math.cos(mid), cy + (r + 18) * Math.sin(mid) + 5, labels[0] || "", 15, "middle", 'font-weight="bold"') + "</g>";
  return picSvg(W + shift, d > 180 ? 320 : 170, s);
}
function picThermometer([lo = 0, hi = 40, val = 20]) {
  if (!(hi > lo)) return "";
  const T = 14, B = 214, Y = v => B - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (B - T);
  let step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5))); if ((hi - lo) / step > 12) step *= 2; if ((hi - lo) / step > 12) step *= 2.5;
  let s = `<rect x="40" y="6" width="24" height="216" rx="12" fill="#fff"/><circle cx="52" cy="236" r="20" fill="${PIC_SHADE}"/><rect x="46" y="${picNum(Y(val))}" width="12" height="${picNum(232 - Y(val))}" fill="${PIC_SHADE}" stroke="none"/>`;
  for (let v = Math.ceil(lo / step) * step, k = 0; v <= hi + 1e-9 && k < 30; v += step, k++) s += `<line x1="64" y1="${picNum(Y(v))}" x2="76" y2="${picNum(Y(v))}" stroke-width="1.5"/>` + picText(82, Y(v) + 5, picNum(v) + "°", 12, "start");
  return picSvg(130, 262, s);
}
function picGrid(nums, labels) {
  const n = Math.max(2, Math.min(12, Math.round(nums[0] || 6))), c = Math.min(26, 300 / n), O = 30, W = O + n * c + 20;
  let s = "";
  for (let i = 0; i <= n; i++) s += `<line x1="${picNum(O + i * c)}" y1="10" x2="${picNum(O + i * c)}" y2="${picNum(10 + n * c)}" stroke="#bbb" stroke-width="1"/><line x1="${O}" y1="${picNum(10 + i * c)}" x2="${picNum(O + n * c)}" y2="${picNum(10 + i * c)}" stroke="#bbb" stroke-width="1"/>`
    + picText(O + i * c, 10 + n * c + 18, i, 12) + (i ? picText(O - 8, 10 + (n - i) * c + 4, i, 12, "end") : "");
  s += `<line x1="${O}" y1="${picNum(10 + n * c)}" x2="${picNum(O + n * c)}" y2="${picNum(10 + n * c)}" stroke-width="2.5"/><line x1="${O}" y1="10" x2="${O}" y2="${picNum(10 + n * c)}" stroke-width="2.5"/>`;
  for (let i = 1, k = 0; i + 1 < nums.length && k < 8; i += 2, k++) { const x = O + Math.min(n, Math.max(0, nums[i])) * c, y = 10 + (n - Math.min(n, Math.max(0, nums[i + 1]))) * c;
    s += `<circle cx="${picNum(x)}" cy="${picNum(y)}" r="5" fill="${PIC_INK}"/>` + picText(x + 8, y - 7, labels[k] || "", 14, "start", 'font-weight="bold"'); }
  return picSvg(W, 10 + n * c + 28, s);
}
// The picture's SVG text ("" when it can't be drawn)
function picBody(p) {
  if (!p) return "";
  const n = p.numbers || [], l = p.labels || [];
  switch (p.type) {
    case "clock": return picClock(n);
    case "number_line": return picNumberLine(n, l);
    case "fraction_bar": return picFractionBar(n);
    case "fraction_circle": return picFractionCircle(n);
    case "bar_chart": return picBarChart(n, l, p.title);
    case "table": return picTable(n, l);
    case "array": return picItems(n, l, false);
    case "groups": return picItems(n, l, true);
    case "shape": return picShape(l);
    case "angle": return picAngle(n, l);
    case "thermometer": return picThermometer(n);
    case "coordinate_grid": return picGrid(n, l);
    case "diagram": return p.svg || "";
    default: return "";
  }
}
// 🖼️ The picture on the paper: an <img> of the SVG (prints the same in the 📄 PDF), with its title under it.
// (The 📄 PDF maker can't stretch pictures by CSS, so the SVG gets its own width/height and the <img> its exact size.)
function wsPicNode(p) {
  let svg = picBody(p);
  if (!svg) return null;
  const vb = (svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/) || []).slice(1).map(Number);
  const vw = vb[0] > 0 ? vb[0] : 300, vh = vb[1] > 0 ? vb[1] : 200;
  const big = p.type === "diagram" || p.type === "bar_chart" || p.type === "coordinate_grid";
  const k = Math.min((big ? 420 : 320) / vw, 260 / vh, p.type === "diagram" ? 3 : 1);
  const w = Math.round(vw * k), hh = Math.round(vh * k);
  svg = svg.replace(/^<svg\b([^>]*?)\s(width|height)="[^"]*"/, "<svg$1").replace(/^<svg\b([^>]*?)\s(width|height)="[^"]*"/, "<svg$1")
           .replace(/^<svg\b/, `<svg width="${w}" height="${hh}"`);
  return h("figure", { class: "ws-pic", dir: "ltr" },
    h("img", { src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), width: w, height: hh, alt: p.alt || p.title || "Picture" }),
    p.title && p.type !== "bar_chart" ? h("figcaption", null, p.title) : null);
}
