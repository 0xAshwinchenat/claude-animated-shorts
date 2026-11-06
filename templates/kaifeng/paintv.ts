// Painted Canvas2D textures of the three venues (VENUES owner): the yurt (felt, carpets, lacquer table, chest, the
// blue-and-white plate, the silk pillow), the rammed-earth block + the macro grain strata (one shared palette, so the
// portal into the dirt keeps its layer colours), the boulder, the dust puff, and the Great Wall (Ming bricks, the
// stone base course, the cut section with its pounded-earth heart, the watchtower face).
import { ctex, U, TAU, wrap2, blotch, rr, pick, jit, type G, type R } from "./paint";

// ---------------------------------------------------------------------------------------------------------------
// shared strata: the EBLOCK's 6 pounded layers (bottom -> top) = the macro bed's bands (25x scale, 1.5 m each)
export type Stratum = { cols: string[]; r: [number, number]; line: string };
export const STRATA: Stratum[] = [
  { cols: ["#c08850", "#c99257", "#b57d48", "#c58e54"], r: [0.3, 0.5], line: "#6e4626" },    // ochre
  { cols: ["#e2c9a0", "#e8d2ab", "#dbc095", "#eed9b4"], r: [0.16, 0.3], line: "#8f6a44" },   // pale cream, fine
  { cols: ["#93633f", "#9c6b45", "#875a38", "#a07048"], r: [0.38, 0.62], line: "#4e301c" },  // dark brown, coarse
  { cols: ["#d4a058", "#dcaa62", "#c99550", "#d8a660"], r: [0.26, 0.44], line: "#7e5428" },  // golden ochre
  { cols: ["#a8664a", "#b27050", "#9c5c42", "#ae6c4c"], r: [0.34, 0.56], line: "#5a3020" },  // red-brown, coarse
  { cols: ["#d6b588", "#dcbd92", "#ccab7e", "#e0c39a"], r: [0.16, 0.3], line: "#86603c" },   // pale tan, fine
];
const INK = "#2a1c22";

/** one grain painted like the macro's toon grains: flat fill, a darker lower-right crescent, a light top-left lip, ink rim */
const paintGrain = (g: G, x: number, y: number, rad: number, col: string, ink: number) => {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rad, rad * 0.9, 0, 0, TAU); g.fill();
  g.fillStyle = "rgba(70,40,20,0.22)"; g.beginPath(); g.ellipse(x + rad * 0.18, y + rad * 0.2, rad * 0.82, rad * 0.7, 0, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(x - rad * 0.08, y - rad * 0.08, rad * 0.78, rad * 0.68, 0, 0, TAU); g.fill();
  g.fillStyle = "rgba(255,240,215,0.35)"; g.beginPath(); g.ellipse(x - rad * 0.35, y - rad * 0.38, rad * 0.32, rad * 0.2, -0.5, 0, TAU); g.fill();
  if (ink > 0) { g.strokeStyle = `rgba(42,28,34,${ink})`; g.lineWidth = Math.max(1, rad * 0.16); g.beginPath(); g.ellipse(x, y, rad, rad * 0.9, 0, 0, TAU); g.stroke(); }
};

/** pounded layers for the block's side faces: 2048 px = 0.36 m (5.7 px/mm); six layers of 6 cm, bottom layer at the
 *  bottom. Each layer is PACKED GRAINS with dark voids, painted like the macro bed's toon grains (same strata colours,
 *  sizes ~1/4 of the macro's relative size), so the push into the face swaps into the macro bed without a change of look */
export const earthSide = () => ctex("v_earthSide2", 2048, 2048, (g, r) => {
  const S = 2048, L = S / 6;
  for (let k = 0; k < 6; k++) {
    const st = STRATA[k], y0 = S - (k + 1) * L, y1 = S - k * L;
    g.fillStyle = "#4a2f1e"; g.fillRect(0, y0, S, L);
    const rmin = st.r[0] * 62, rmax = st.r[1] * 62, list: [number, number, number][] = [];
    for (let i = 0; i < 5200; i++) list.push([U(r, -10, S + 10), U(r, y0 + 4, y1 - 2), rmin + (rmax - rmin) * Math.pow(r(), 1.6)]);
    list.sort((a, b) => b[2] - a[2]);
    const CS = 48, cells = new Map<number, [number, number, number][]>(), kept: [number, number, number][] = [];
    for (const c of list) {
      const cx = Math.floor(c[0] / CS), cy = Math.floor(c[1] / CS);
      let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) for (const o of cells.get((cx + a) * 1000 + cy + b) ?? []) if (Math.hypot(o[0] - c[0], o[1] - c[1]) < 0.86 * (o[2] + c[2])) { ok = false; break; }
      if (!ok) continue;
      const key = cx * 1000 + cy; (cells.get(key) ?? cells.set(key, []).get(key)!).push(c); kept.push(c);
    }
    for (const [x, y, rad] of kept) paintGrain(g, x, y, rad, jit(r, pick(r, st.cols), 0.1, 4, 0.15), 0.7);
    // the pounded top of the layer: a course of small dark grains
    for (let x = 0; x < S; x += U(r, 7, 12)) paintGrain(g, x, y0 + U(r, 5, 13), U(r, 6, 9), jit(r, st.line, 0.12, 4, 0.2), 0.5);
    for (let i = 0; i < 1500; i++) { g.fillStyle = "rgba(60,38,22,0.25)"; g.fillRect(U(r, 0, S), U(r, y0, y1), 2, 2); }
  }
});
/** the block's pounded top: the top layer's colour with overlapping round tamper prints */
export const earthTop = () => ctex("v_earthTop", 1024, 1024, (g, r) => {
  const S = 1024, st = STRATA[5];
  g.fillStyle = st.cols[0]; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1800; i++) { g.fillStyle = jit(r, pick(r, st.cols), 0.12, 4, 0.2); g.beginPath(); g.arc(U(r, 0, S), U(r, 0, S), U(r, 0.8, 2.6), 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) {
    const x = U(r, 60, S - 60), y = U(r, 60, S - 60), rad = U(r, 70, 110);
    g.strokeStyle = "rgba(110,72,40,0.35)"; g.lineWidth = 6; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke();
    g.fillStyle = "rgba(255,236,200,0.12)"; g.beginPath(); g.arc(x - 6, y - 6, rad * 0.8, 0, TAU); g.fill();
  }
});

// ---------------------------------------------------------------------------------------------------------------
// the yurt
/** cream felt lining with quilted diamond stitching: 1024 x 512 = 2 m x 1 m */
export const felt = () => ctex("v_felt", 1024, 512, (g, r) => {
  g.fillStyle = "#dcc8a6"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) wrap2(1024, 512, U(r, 0, 1024), U(r, 0, 512), 140, (x, y) => blotch(g, x, y, U(r, 50, 130), 1.6, pick(r, ["255,245,225", "150,120,85"]), 0.13));
  for (let i = 0; i < 2600; i++) { g.fillStyle = pick(r, ["rgba(255,250,235,0.25)", "rgba(140,110,80,0.18)"]); g.fillRect(U(r, 0, 1024), U(r, 0, 512), U(r, 1, 4), 1); }
  g.strokeStyle = "rgba(120,80,55,0.55)"; g.lineWidth = 3; g.setLineDash([10, 9]);
  for (let k = -8; k < 16; k++) {
    g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128 + 512, 512); g.stroke();
    g.beginPath(); g.moveTo(k * 128 + 512, 0); g.lineTo(k * 128, 512); g.stroke();
  }
  g.setLineDash([]);
});
const hook = (g: G, x: number, y: number, s: number, flip: number) => {
  // a square spiral key ("alhan hee") of size s
  const p: [number, number][] = [[0, 1], [0, 0], [1, 0], [1, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25], [0.75, 0.5], [0.5, 0.5]];
  g.beginPath(); p.forEach(([a, b], i) => { const X = x + (flip ? 1 - a : a) * s, Y = y + b * s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke();
};
/** an endless-knot-ish medallion (ulzii): interlaced loops around a lozenge */
const knot = (g: G, cx: number, cy: number, s: number, col: string, lw: number) => {
  g.save(); g.translate(cx, cy); g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath(); g.ellipse(s * 0.55, 0, s * 0.42, s * 0.22, 0, 0, TAU); g.stroke();
  }
  g.rotate(Math.PI / 4); rr(g, -s * 0.36, -s * 0.36, s * 0.72, s * 0.72, s * 0.12); g.stroke();
  g.restore();
};
/** Mongol rug: border of hooks, red / blue field, central medallion + corner quarters */
export const carpet = (key: string, field: string, border: string, accent: string, W = 1024, H = 1024) => ctex("v_carpet" + key, W, H, (g, r) => {
  g.fillStyle = border; g.fillRect(0, 0, W, H);
  const b = Math.round(W * 0.11);
  g.fillStyle = field; g.fillRect(b, b, W - 2 * b, H - 2 * b);
  for (let i = 0; i < 30; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 60, 160), 1.3, pick(r, ["255,230,200", "60,20,20"]), 0.08);
  g.strokeStyle = accent; g.lineWidth = 7; g.lineCap = "square";
  const s = b * 0.5, step = s * 1.25;
  for (let x = b * 0.25; x < W - s; x += step) { hook(g, x, b * 0.25, s, 0); hook(g, x, H - b * 0.25 - s, s, 1); }
  for (let y = b + step * 0.2; y < H - b - s; y += step) { hook(g, b * 0.25, y, s, 1); hook(g, W - b * 0.25 - s, y, s, 0); }
  g.strokeStyle = accent; g.lineWidth = 6; g.strokeRect(b - 10, b - 10, W - 2 * b + 20, H - 2 * b + 20);
  g.strokeStyle = "#f3e4c0"; g.lineWidth = 3; g.strokeRect(b + 6, b + 6, W - 2 * b - 12, H - 2 * b - 12);
  // medallion
  const cx = W / 2, cy = H / 2, m = Math.min(W, H) * 0.24;
  g.fillStyle = border; g.beginPath(); g.moveTo(cx, cy - m * 1.1); g.lineTo(cx + m * 1.1, cy); g.lineTo(cx, cy + m * 1.1); g.lineTo(cx - m * 1.1, cy); g.closePath(); g.fill();
  g.strokeStyle = accent; g.lineWidth = 6; g.stroke();
  knot(g, cx, cy, m * 0.75, accent, 8);
  g.fillStyle = field; g.beginPath(); g.arc(cx, cy, m * 0.14, 0, TAU); g.fill();
  for (const [x, y] of [[b, b], [W - b, b], [b, H - b], [W - b, H - b]]) { g.save(); g.beginPath(); g.rect(b, b, W - 2 * b, H - 2 * b); g.clip(); knot(g, x, y, m * 0.55, accent, 6); g.restore(); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = pick(r, ["rgba(255,255,255,0.06)", "rgba(0,0,0,0.07)"]); g.fillRect(U(r, 0, W), U(r, 0, H), 2, 2); }
});
/** cloud scroll (ugalz) curl */
const curl = (g: G, x: number, y: number, s: number, dir: number) => {
  g.beginPath(); g.arc(x, y, s, Math.PI, Math.PI + dir * 1.8 * Math.PI, dir < 0); g.stroke();
  g.beginPath(); g.arc(x + dir * s * 0.45, y, s * 0.45, 0, TAU); g.stroke();
};
/** red lacquer table top: 2048 x 860 = 2.0 x 0.84 m: gold borders, cloud scrolls, central knot medallion */
export const tableTop = () => ctex("v_tableTop", 2048, 860, (g, r) => {
  const W = 2048, H = 860;
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#b8392e"); gr.addColorStop(1, "#a42f28");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 80, 220), 2, "255,200,170", 0.07);
  g.strokeStyle = "#e2b552"; g.lineWidth = 10; g.strokeRect(40, 40, W - 80, H - 80);
  g.lineWidth = 4; g.strokeRect(70, 70, W - 140, H - 140);
  g.lineWidth = 6; g.strokeStyle = "#e2b552";
  for (let x = 130; x < W - 120; x += 120) { curl(g, x, 104, 18, 1); curl(g, x + 60, H - 104, 18, -1); }
  g.fillStyle = "#2f6d8c"; g.beginPath(); g.ellipse(W / 2, H / 2, 210, 170, 0, 0, TAU); g.fill();
  g.strokeStyle = "#e2b552"; g.lineWidth = 8; g.stroke();
  knot(g, W / 2, H / 2, 130, "#e2b552", 10);
  g.strokeStyle = "#3f8a64"; g.lineWidth = 7;
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) curl(g, W / 2 + sx * (330 + k * 150), H / 2 + (k % 2 ? 60 : -60), 34, sx);
  // a few lacquer scuffs (light, the plate stand / block board leave no marks)
  for (let i = 0; i < 60; i++) { g.strokeStyle = "rgba(255,220,200,0.08)"; g.lineWidth = 2; const x = U(r, 0, W), y = U(r, 0, H); g.beginPath(); g.moveTo(x, y); g.lineTo(x + U(r, 20, 90), y + U(r, -6, 6)); g.stroke(); }
});
/** apron / leg band: red with gold + blue swirls (1024 x 96) */
export const tableApron = () => ctex("v_tableApron", 1024, 96, (g) => {
  g.fillStyle = "#a8302a"; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = "#e2b552"; g.fillRect(0, 6, 1024, 6); g.fillRect(0, 84, 1024, 6);
  g.lineWidth = 5;
  for (let x = 30; x < 1024; x += 64) { g.strokeStyle = (x / 64) % 2 < 1 ? "#e2b552" : "#4a9ac0"; curl(g, x, 48, 16, (x / 64) % 2 < 1 ? 1 : -1); }
});
/** painted chest front / sides: orange-red with framed panels and knots */
export const chestTex = () => ctex("v_chest", 1024, 640, (g, r) => {
  g.fillStyle = "#c2552c"; g.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 10; i++) blotch(g, U(r, 0, 1024), U(r, 0, 640), U(r, 80, 200), 1.5, "255,210,170", 0.08);
  g.strokeStyle = "#e9c060"; g.lineWidth = 12; g.strokeRect(24, 24, 976, 592);
  for (const [x, w] of [[70, 400], [554, 400]] as [number, number][]) {
    g.fillStyle = "#2c6c8e"; rr(g, x, 80, w, 480, 40); g.fill(); g.strokeStyle = "#e9c060"; g.lineWidth = 8; g.stroke();
    knot(g, x + w / 2, 320, 110, "#e9c060", 9);
    g.strokeStyle = "#5fae7c"; g.lineWidth = 6; for (const [cx, cy] of [[x + 50, 130], [x + w - 50, 130], [x + 50, 510], [x + w - 50, 510]]) curl(g, cx, cy, 20, cx < x + w / 2 ? 1 : -1);
  }
});
/** blue-and-white porcelain plate face: 1024 px = the plate's 0.27 m square (centre = plate centre) */
export const plateFace = () => ctex("v_plate", 1024, 1024, (g, r) => {
  const C = 512, px = 1024 / 0.27; // px per m
  g.fillStyle = "#f4f3ee"; g.fillRect(0, 0, 1024, 1024);
  const ring = (rad: number, lw: number, col = "#2c4f9e") => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(C, C, rad * px, 0, TAU); g.stroke(); };
  // rim band of scrolling waves
  g.fillStyle = "#3058a8"; g.beginPath(); g.arc(C, C, 0.124 * px, 0, TAU); g.arc(C, C, 0.103 * px, 0, TAU, true); g.fill();
  g.strokeStyle = "#f4f3ee"; g.lineWidth = 7;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, rm = 0.1135 * px, x = C + Math.cos(a) * rm, y = C + Math.sin(a) * rm;
    g.beginPath(); g.arc(x, y, 18, a + 0.6, a + 0.6 + 4.2); g.stroke();
  }
  ring(0.128, 5); ring(0.098, 6); ring(0.092, 3); ring(0.072, 5);
  // well: a lotus spray
  g.fillStyle = "#3a63b4"; g.strokeStyle = "#1f3f86"; g.lineWidth = 5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    g.save(); g.translate(C, C); g.rotate(a);
    g.beginPath(); g.ellipse(0, -0.034 * px, 0.012 * px, 0.03 * px, 0, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }
  g.fillStyle = "#f4f3ee"; g.beginPath(); g.arc(C, C, 0.016 * px, 0, TAU); g.fill(); g.strokeStyle = "#2c4f9e"; g.lineWidth = 6; g.stroke();
  g.fillStyle = "#2c4f9e"; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.beginPath(); g.arc(C + Math.cos(a) * 0.009 * px, C + Math.sin(a) * 0.009 * px, 5, 0, TAU); g.fill(); }
  g.strokeStyle = "#3a63b4"; g.lineWidth = 6;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.6; g.beginPath(); g.arc(C + Math.cos(a) * 0.058 * px, C + Math.sin(a) * 0.058 * px, 22, a, a + 3.5); g.stroke(); }
  for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(90,110,160,0.05)"; g.beginPath(); g.arc(U(r, 0, 1024), U(r, 0, 1024), U(r, 2, 8), 0, TAU); g.fill(); }
});
/** teal silk with gold embroidery (pillow top / bottom), 1024 x 1024 over the pillow's u, w in -1..1 */
export const silk = () => ctex("v_silk", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#1d8584"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) { g.strokeStyle = pick(r, ["rgba(120,230,220,0.07)", "rgba(0,40,50,0.07)"]); g.lineWidth = U(r, 4, 14); const x = U(r, -200, S); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 260, S); g.stroke(); }
  g.strokeStyle = "#e8c35a"; g.lineWidth = 12; g.strokeRect(70, 70, S - 140, S - 140);
  g.lineWidth = 5; g.strokeRect(100, 100, S - 200, S - 200);
  g.fillStyle = "#e8c35a"; for (let x = 120; x < S - 100; x += 34) for (const y of [85, S - 85]) { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.beginPath(); g.arc(y, x, 6, 0, TAU); g.fill(); }
  g.fillStyle = "#9b2b2e"; g.beginPath(); g.arc(S / 2, S / 2, 210, 0, TAU); g.fill();
  g.strokeStyle = "#e8c35a"; g.lineWidth = 12; g.stroke();
  knot(g, S / 2, S / 2, 150, "#e8c35a", 12);
  g.lineWidth = 8; for (const [x, y] of [[230, 230], [S - 230, 230], [230, S - 230], [S - 230, S - 230]]) { curl(g, x, y, 34, x < S / 2 ? 1 : -1); }
});

// ---------------------------------------------------------------------------------------------------------------
// macro
/** grey rough boulder: speckles, blotches, a few inked cracks (512 px, tiled twice round the rock) */
export const boulderTex = () => ctex("v_boulder", 512, 512, (g, r) => {
  g.fillStyle = "#9a9b9f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) wrap2(512, 512, U(r, 0, 512), U(r, 0, 512), 100, (x, y) => blotch(g, x, y, U(r, 30, 90), 1.3, pick(r, ["255,250,240", "60,62,72", "120,110,95"]), 0.16));
  for (let i = 0; i < 3000; i++) { g.fillStyle = pick(r, ["rgba(60,60,70,0.35)", "rgba(250,248,240,0.3)", "rgba(110,100,90,0.3)"]); g.beginPath(); g.arc(U(r, 0, 512), U(r, 0, 512), U(r, 0.8, 2.6), 0, TAU); g.fill(); }
  g.strokeStyle = "rgba(42,30,36,0.7)"; g.lineWidth = 3; g.lineCap = "round";
  for (let i = 0; i < 7; i++) { let x = U(r, 0, 512), y = U(r, 0, 512); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += U(r, -30, 30); y += U(r, 8, 26); g.lineTo(x, y); } g.stroke(); }
});
/** toon dust puff: overlapping cream-tan balls, shaded underside, painted plum ink rim */
export const puffTex = () => ctex("v_puff", 256, 256, (g, r) => {
  const balls: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + U(r, -0.3, 0.3), d = U(r, 30, 52); balls.push([128 + Math.cos(a) * d, 136 + Math.sin(a) * d * 0.75, U(r, 34, 50)]); }
  balls.push([128, 126, 62]);
  g.fillStyle = INK; for (const [x, y, rad] of balls) { g.beginPath(); g.arc(x, y, rad + 5, 0, TAU); g.fill(); }
  g.fillStyle = "#d9bf96"; for (const [x, y, rad] of balls) { g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  g.fillStyle = "#f2e2c4"; for (const [x, y, rad] of balls) { g.beginPath(); g.arc(x - rad * 0.18, y - rad * 0.22, rad * 0.78, 0, TAU); g.fill(); }
});
/** soft round dot (motes, light pools) */
export const softDot = () => ctex("v_softDot", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

// ---------------------------------------------------------------------------------------------------------------
// the Great Wall
/** Ming wall bricks (grey, ~0.40 x 0.10 m with light lime mortar): 1024 px = 2 m x 2 m */
const brickRows = (g: G, r: R, W: number, H: number, ppm: number, cols: string[], mortar: string) => {
  g.fillStyle = mortar; g.fillRect(0, 0, W, H);
  const bh = 0.1 * ppm, bw = 0.4 * ppm, m = Math.max(2, 0.012 * ppm);
  for (let row = 0, y = 0; y < H; row++, y += bh) {
    for (let x = -((row % 2) * bw) / 2; x < W; x += bw) {
      const c = jit(r, pick(r, cols), 0.08, 4, 0.2);
      g.fillStyle = c; g.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      g.fillStyle = "rgba(255,248,235,0.14)"; g.fillRect(x + m / 2, y + m / 2, bw - m, m * 1.2);
      g.fillStyle = "rgba(30,30,40,0.14)"; g.fillRect(x + m / 2, y + bh - m * 1.8, bw - m, m * 1.2);
      if (r() < 0.06) { g.fillStyle = "rgba(40,40,50,0.18)"; g.fillRect(x + U(r, 0, bw * 0.6), y + m, U(r, 6, bw * 0.4), bh - 2 * m); }
    }
  }
};
export const mingBrick = () => ctex("v_mingBrick", 1024, 1024, (g, r) => {
  brickRows(g, r, 1024, 1024, 512, ["#8e9096", "#999a9c", "#868a92", "#a3a19b", "#94948f"], "#c9c3b4");
  for (let i = 0; i < 14; i++) wrap2(1024, 1024, U(r, 0, 1024), U(r, 0, 1024), 220, (x, y) => blotch(g, x, y, U(r, 80, 200), 1.5, pick(r, ["60,58,62", "190,170,140"]), 0.12));
});
/** dressed stone base course: big pale granite blocks, 1024 x 512 = 4 m x 2 m */
export const baseStone = () => ctex("v_baseStone", 1024, 512, (g, r) => {
  g.fillStyle = "#6f6a62"; g.fillRect(0, 0, 1024, 512);
  const ppm = 256, bh = 0.7 * ppm;
  for (let row = 0, y = 0; y < 512; row++, y += bh) {
    let x = -U(r, 0, 120);
    while (x < 1024) {
      const w = U(r, 0.9, 1.6) * ppm, c = jit(r, pick(r, ["#b9b19f", "#aea691", "#c2b9a6", "#a79f8b"]), 0.07, 5, 0.2);
      g.fillStyle = c; rr(g, x + 4, y + 4, w - 8, bh - 8, 10); g.fill();
      g.fillStyle = "rgba(255,250,235,0.18)"; g.fillRect(x + 10, y + 6, w - 20, 8);
      for (let i = 0; i < 90; i++) { g.fillStyle = pick(r, ["rgba(70,65,60,0.25)", "rgba(255,255,250,0.25)"]); g.fillRect(x + U(r, 6, w - 6), y + U(r, 6, bh - 6), 2, 2); }
      x += w;
    }
  }
});
/** the cut section (u across -SEC.half..+SEC.half, y 0..SEC.top): brick skins, stone base course, brick paving +
 *  parapets, and the layered pounded-earth heart with some rubble. Painted lit (the cap is self-lit). */
export const SEC = { half: 3.4, top: 8.9, base: 1.4, walk: 7.0, skin: 0.8, pave: 0.4 };
/** the wall's outer face distance from the axis at height y (both sides) */
export const secFace = (y: number) => (y < SEC.base ? 3.4 - (0.1 / SEC.base) * y : 3.3 - (0.35 / (SEC.walk - SEC.base)) * (y - SEC.base));
export const sectionTex = () => ctex("v_section", 1024, 1340, (g, r) => {
  const W = 1024, H = 1340, ppm = W / (2 * SEC.half);           // ~150 px / m
  const X = (u: number) => (u + SEC.half) * ppm, Y = (y: number) => H - y * ppm;
  g.fillStyle = "#b98b5a"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = pick(r, ["#a87a4c", "#c89a66", "#9c7048"]); g.beginPath(); g.arc(U(r, 0, W), U(r, Y(SEC.base), H), U(r, 1, 3.5), 0, TAU); g.fill(); }
  // the heart: pounded earth layers (~0.2 m) with darker seams, slightly wavy
  const cols = ["#c99a62", "#d4a66c", "#be8d58", "#d0a268", "#c4925c", "#d8ad74"];
  for (let k = 0, y = SEC.base; y < SEC.walk; k++, y += 0.2) {
    g.fillStyle = cols[k % cols.length]; g.fillRect(0, Y(y + 0.2) - 1, W, 0.2 * ppm + 2);
    for (let i = 0; i < 160; i++) { g.fillStyle = jit(r, cols[(k + 2) % cols.length], 0.14, 5, 0.2); g.beginPath(); g.arc(U(r, 0, W), U(r, Y(y + 0.2), Y(y)), U(r, 1, 3.2), 0, TAU); g.fill(); }
    g.strokeStyle = "rgba(110,70,40,0.75)"; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x <= W; x += 24) { const yy = Y(y) + 2 * Math.sin(x * 0.03 + k * 2); if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke();
  }
  // rubble in the lower core and in the base
  for (let i = 0; i < 46; i++) {
    const u = U(r, -2.4, 2.4), y = i < 26 ? U(r, 0.15, SEC.base + 0.5) : U(r, SEC.base + 0.5, SEC.walk - 0.6), rad = U(r, 0.07, i < 26 ? 0.2 : 0.12) * ppm;
    g.fillStyle = jit(r, pick(r, ["#9d978c", "#8c877e", "#aaa294"]), 0.08, 5, 0.2); g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU, q = rad * U(r, 0.75, 1.1); const px = X(u) + Math.cos(a) * q * 1.3, py = Y(y) + Math.sin(a) * q; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); g.fill(); g.stroke();
  }
  // lower core under the base course: rubble + earth
  // brick skins (both faces), the paving and the parapets: cut brick ends
  const brickCut = (path: () => void) => {
    g.save(); path(); g.clip();
    g.fillStyle = "#cfc8b8"; g.fillRect(0, 0, W, H);
    const bh = 0.1 * ppm, bw = 0.2 * ppm;
    for (let row = 0, y = 0; y < H; row++, y += bh) for (let x = -((row % 2) * bw) / 2; x < W; x += bw) {
      g.fillStyle = jit(r, pick(r, ["#8e9096", "#999a9c", "#868a92", "#a3a19b"]), 0.08, 4, 0.2); g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
    g.restore();
  };
  const skinPath = (side: number) => () => {
    g.beginPath();
    const pts: [number, number][] = [];
    for (let y = SEC.base; y <= SEC.walk; y += 0.25) pts.push([side * secFace(y), y]);
    for (let y = SEC.walk; y >= SEC.base; y -= 0.25) pts.push([side * (secFace(y) - SEC.skin), y]);
    pts.forEach(([u, y], i) => (i ? g.lineTo(X(u), Y(y)) : g.moveTo(X(u), Y(y)))); g.closePath();
  };
  brickCut(skinPath(1)); brickCut(skinPath(-1));
  brickCut(() => { g.beginPath(); g.rect(0, Y(SEC.top), W, (SEC.top - SEC.walk + SEC.pave) * ppm); });
  // stone base course: two dressed blocks per side + rubble core between
  g.fillStyle = "#b5ad9b";
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const y0 = k * 0.7, uo = side * secFace(y0 + 0.35), ui = side * (Math.abs(uo) - 1.1);
    g.fillStyle = jit(r, "#b5ad9b", 0.06, 4, 0.2); g.fillRect(Math.min(X(uo), X(ui)) + 2, Y(y0 + 0.7) + 2, Math.abs(X(uo) - X(ui)) - 4, 0.7 * ppm - 4);
  }
  // ink seams: skin / heart boundary, base / heart, paving / heart
  g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = "round";
  for (const side of [-1, 1]) {
    g.beginPath(); for (let y = SEC.base; y <= SEC.walk - SEC.pave + 0.01; y += 0.25) { const u = side * (secFace(y) - SEC.skin); if (y === SEC.base) g.moveTo(X(u), Y(y)); else g.lineTo(X(u), Y(y)); } g.stroke();
  }
  g.beginPath(); g.moveTo(X(-secFace(SEC.walk - SEC.pave) + SEC.skin), Y(SEC.walk - SEC.pave)); g.lineTo(X(secFace(SEC.walk - SEC.pave) - SEC.skin), Y(SEC.walk - SEC.pave)); g.stroke();
  g.beginPath(); g.moveTo(0, Y(SEC.base)); g.lineTo(W, Y(SEC.base)); g.stroke();
  // soft warm "lit from the upper left" over everything (the cap is unlit)
  const lg = g.createLinearGradient(0, 0, W, H); lg.addColorStop(0, "rgba(255,225,170,0.16)"); lg.addColorStop(1, "rgba(80,40,60,0.12)");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
});
/** watchtower face: Ming bricks, base course, two rows of arched windows: 1024 x 1365 = 10 m x 13.3 m */
export const towerFace = () => ctex("v_towerFace", 1024, 1365, (g, r) => {
  const W = 1024, H = 1365, ppm = W / 10;
  brickRows(g, r, W, H, ppm * 1.4, ["#8e9096", "#999a9c", "#868a92", "#a3a19b"], "#c9c3b4");
  for (let i = 0; i < 8; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 80, 200), 1.5, pick(r, ["60,58,62", "190,170,140"]), 0.12);
  const win = (cx: number, yb: number, w: number, h: number) => {
    g.fillStyle = "#cfc6b2"; g.beginPath(); g.moveTo(cx - w / 2 - 12, yb + 10); g.lineTo(cx - w / 2 - 12, yb - h + w / 2); g.arc(cx, yb - h + w / 2, w / 2 + 12, Math.PI, 0); g.lineTo(cx + w / 2 + 12, yb + 10); g.closePath(); g.fill();
    g.fillStyle = "#2e2742"; g.beginPath(); g.moveTo(cx - w / 2, yb); g.lineTo(cx - w / 2, yb - h + w / 2); g.arc(cx, yb - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, yb); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  };
  for (const k of [0, 1, 2]) win(W * (0.22 + 0.28 * k), H - 4.6 * ppm, 1.0 * ppm, 2.0 * ppm);
  for (const k of [0, 1, 2]) win(W * (0.22 + 0.28 * k), H - 9.0 * ppm, 0.8 * ppm, 1.6 * ppm);
  g.fillStyle = "#b5ad9b"; g.fillRect(0, H - 1.6 * ppm, W, 1.6 * ppm);
  g.strokeStyle = "rgba(60,55,50,0.6)"; g.lineWidth = 4;
  for (let y = H - 1.6 * ppm; y < H; y += 0.8 * ppm) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (y / ppm) % 2 ? 0 : 60; x < W; x += 1.4 * ppm) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 0.8 * ppm); g.stroke(); } }
  g.fillStyle = "#a9a39a"; g.fillRect(0, H - 11.6 * ppm, W, 0.25 * ppm);
});
