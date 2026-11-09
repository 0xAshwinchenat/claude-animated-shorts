// Painted Canvas2D textures of the pigs short's three venues (VENUE owner): the writer's room (terracotta floor,
// Pompeian plaster walls with a red dado + border band, papyrus, rolled scroll ends, the sunny window view), the
// elephant stable (packed earth + straw, thatch, hay, olive leaves, palm fronds) and Edessa (limestone/mudbrick
// courses, golden dust, tent cloth, Roman shields + banners, Persian pennants). No readable text anywhere.
import { ctex, U, TAU, wrap2, blotch, pick, jit, type G, type R } from "./paint";

export const INK = "#2a1c22";
const speck = (g: G, r: R, W: number, H: number, n: number, cols: string[], s0 = 0.8, s1 = 2.4) => {
  for (let i = 0; i < n; i++) { g.fillStyle = pick(r, cols); g.beginPath(); g.arc(U(r, 0, W), U(r, 0, H), U(r, s0, s1), 0, TAU); g.fill(); }
};
const blots = (g: G, r: R, W: number, H: number, n: number, r0: number, r1: number, rgbs: string[], a: number) => {
  for (let i = 0; i < n; i++) wrap2(W, H, U(r, 0, W), U(r, 0, H), r1 * 1.6, (x, y) => blotch(g, x, y, U(r, r0, r1), U(r, 0.8, 1.8), pick(r, rgbs), a));
};

// =====================================================================================================
// the writer's room
// =====================================================================================================
/** terracotta floor tiles: 1024 px = 2 m (0.4 m tiles, dark grout, per-tile jitter, worn patches) */
export const roomFloor = () => ctex("pv_roomFloor", 1024, 1024, (g, r) => {
  const S = 1024, T = S / 5, M = 7;
  g.fillStyle = "#8e5a3c"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const c = jit(r, pick(r, ["#c86a3e", "#bf6238", "#cf7446", "#b95c35", "#c46a40"]), 0.08, 4, 0.12);
    g.fillStyle = c; g.fillRect(i * T + M / 2, j * T + M / 2, T - M, T - M);
    g.fillStyle = "rgba(255,225,190,0.16)"; g.fillRect(i * T + M / 2, j * T + M / 2, T - M, 5);
    g.fillStyle = "rgba(70,30,15,0.16)"; g.fillRect(i * T + M / 2, j * T + T - M / 2 - 6, T - M, 6);
    for (let k = 0; k < 3; k++) blotch(g, i * T + U(r, 30, T - 30), j * T + U(r, 30, T - 30), U(r, 25, 70), U(r, 0.8, 1.6), pick(r, ["255,220,180", "110,50,25"]), 0.14);
  }
  speck(g, r, S, S, 1400, ["rgba(90,40,20,0.3)", "rgba(255,230,200,0.25)"]);
});
/** plastered wall, 1024 x 1638 px = 2 m wide x 3.2 m tall (canvas top = ceiling). Pompeian red dado 0-0.95 m with
 *  darker panels, a painted border band (cream stripe, teal + red lines, a running wave) at 0.95-1.15 m, warm ochre
 *  plaster above with soft blotches, a thin frieze under the ceiling. */
export const roomWall = () => ctex("pv_roomWall", 1024, 1638, (g, r) => {
  const W = 1024, H = 1638, ppm = 512, y = (m: number) => H - m * ppm;
  g.fillStyle = "#dca862"; g.fillRect(0, 0, W, H);
  blots(g, r, W, H, 50, 60, 180, ["255,236,190", "190,130,70", "230,170,90"], 0.16);
  speck(g, r, W, H, 2500, ["rgba(140,90,40,0.18)", "rgba(255,245,215,0.22)"]);
  g.fillStyle = "#a8432e"; g.fillRect(0, y(0.95), W, 0.95 * ppm);
  for (let i = 0; i < 20; i++) blotch(g, U(r, 0, W), U(r, y(0.95), H), U(r, 40, 120), 1.5, pick(r, ["220,110,80", "90,25,20"]), 0.14);
  g.strokeStyle = "rgba(70,20,15,0.55)"; g.lineWidth = 6;
  for (const x0 of [40, 552]) g.strokeRect(x0, y(0.82), 432, 0.62 * ppm);
  g.fillStyle = "#3f2a24"; g.fillRect(0, y(0.12), W, 0.12 * ppm);
  const b0 = y(1.15), b1 = y(0.95);
  g.fillStyle = "#efdcae"; g.fillRect(0, b0, W, b1 - b0);
  g.fillStyle = "#2f7d7a"; g.fillRect(0, b0, W, 12); g.fillRect(0, b1 - 12, W, 12);
  g.fillStyle = "#a8432e"; g.fillRect(0, b0 + 18, W, 6); g.fillRect(0, b1 - 24, W, 6);
  g.strokeStyle = "#2f7d7a"; g.lineWidth = 9; g.lineCap = "round";
  const mid = (b0 + b1) / 2, A = (b1 - b0) * 0.2;
  g.beginPath();
  for (let x = 0; x <= W; x += 4) { const yy = mid + A * Math.sin((x / 128) * TAU); if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
  g.stroke();
  g.fillStyle = "#a8432e";
  for (let x = 64; x < W; x += 128) { g.beginPath(); g.arc(x, mid - A * 0.2, 9, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 64, mid + A * 0.2, 9, 0, TAU); g.fill(); }
  g.fillStyle = "#a8432e"; g.fillRect(0, y(3.2), W, 0.12 * ppm);
  g.fillStyle = "#2f7d7a"; g.fillRect(0, y(3.08), W, 10);
});
/** papyrus sheet: cream with crossing fibre strips, darker long edges (default 2048 x 910 = 0.9 x 0.4 m) */
export const papyrus = (key = "pv_papyrus", W = 2048, H = 910, edge = true) => ctex(key, W, H, (g, r) => {
  g.fillStyle = "#f0e4c6"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = pick(r, ["rgba(190,150,85,0.07)", "rgba(255,248,220,0.12)", "rgba(160,120,60,0.05)"]);
    g.fillRect(0, U(r, 0, H), W, U(r, 3, 12));
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = pick(r, ["rgba(190,150,85,0.04)", "rgba(255,248,220,0.07)"]);
    g.fillRect(U(r, 0, W), 0, U(r, 3, 12), H);
  }
  for (let x = W / 5; x < W; x += W / 5) { g.fillStyle = "rgba(150,110,60,0.12)"; g.fillRect(x + U(r, -20, 20), 0, 6, H); }
  blots(g, r, W, H, 30, 60, 200, ["200,160,90", "255,245,215"], 0.12);
  speck(g, r, W, H, 900, ["rgba(130,90,40,0.25)", "rgba(255,250,230,0.3)"], 0.6, 1.8);
  if (edge) {
    const e = g.createLinearGradient(0, 0, 0, H);
    e.addColorStop(0, "rgba(150,100,45,0.35)"); e.addColorStop(0.05, "rgba(150,100,45,0)"); e.addColorStop(0.95, "rgba(150,100,45,0)"); e.addColorStop(1, "rgba(150,100,45,0.35)");
    g.fillStyle = e; g.fillRect(0, 0, W, H);
  }
});
/** end of a rolled scroll: cream disc with a brown spiral (256 px) */
export const scrollEnd = () => ctex("pv_scrollEnd", 256, 256, (g) => {
  g.fillStyle = "#e6cf98"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(120,80,40,0.8)"; g.lineWidth = 5;
  g.beginPath();
  for (let t = 0; t < 5.2 * TAU; t += 0.05) { const rad = 14 + t * 3.4; const x = 128 + Math.cos(t) * rad, y = 128 + Math.sin(t) * rad; if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = "#6b4426"; g.beginPath(); g.arc(128, 128, 14, 0, TAU); g.fill();
});
/** the sunny view through the window (portrait 512 x 768): sky, a cloud, hills with cypresses, a garden wall + vine */
export const windowView = () => ctex("pv_windowView", 512, 768, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 520); sky.addColorStop(0, "#5f9be0"); sky.addColorStop(1, "#bcd8f2");
  g.fillStyle = sky; g.fillRect(0, 0, 512, 768);
  g.fillStyle = "#fbf6ea"; for (const [x, y, rr] of [[120, 150, 50], [175, 130, 62], [235, 158, 46], [300, 140, 30]]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
  g.fillStyle = "#86b4d9"; g.beginPath(); g.moveTo(0, 470); g.quadraticCurveTo(200, 380, 512, 440); g.lineTo(512, 768); g.lineTo(0, 768); g.fill();
  g.fillStyle = "#7fb04a"; g.beginPath(); g.moveTo(0, 520); g.quadraticCurveTo(260, 450, 512, 540); g.lineTo(512, 768); g.lineTo(0, 768); g.fill();
  for (const [x, h] of [[90, 210], [140, 260], [380, 230], [430, 180]]) {
    g.fillStyle = "#2f6b3a"; g.beginPath(); g.ellipse(x, 540 - h / 2, 26, h / 2, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(160,220,120,0.35)"; g.beginPath(); g.ellipse(x - 8, 540 - h / 2, 10, h / 2.4, 0, 0, TAU); g.fill();
  }
  g.fillStyle = "#e9d6b0"; g.fillRect(0, 600, 512, 168);
  g.fillStyle = "#c0583a"; g.fillRect(0, 588, 512, 26);
  for (let x = 0; x < 512; x += 22) { g.fillStyle = "rgba(90,30,20,0.4)"; g.fillRect(x, 588, 3, 26); }
  for (let i = 0; i < 60; i++) { g.fillStyle = pick(r, ["#4f8f3a", "#6aa846", "#3d7a33"]); g.beginPath(); g.arc(U(r, 0, 512), U(r, 610, 768), U(r, 10, 22), 0, TAU); g.fill(); }
});

// =====================================================================================================
// the elephant stable
// =====================================================================================================
/** packed dusty earth with straw, pebbles and round foot prints: 1024 px = 4 m */
export const dirtStraw = () => ctex("pv_dirtStraw", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#c99d63"; g.fillRect(0, 0, S, S);
  blots(g, r, S, S, 60, 60, 190, ["232,196,140", "160,110,60", "214,170,108"], 0.22);
  for (let i = 0; i < 14; i++) {
    const x = U(r, 60, S - 60), y = U(r, 60, S - 60), rad = U(r, 34, 50);
    g.fillStyle = "rgba(120,80,40,0.22)"; g.beginPath(); g.ellipse(x, y, rad, rad * 0.86, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(245,215,165,0.35)"; g.lineWidth = 4; g.beginPath(); g.arc(x - 3, y - 3, rad, Math.PI, Math.PI * 1.7); g.stroke();
  }
  speck(g, r, S, S, 2600, ["rgba(110,70,35,0.35)", "rgba(250,225,180,0.35)", "rgba(150,105,60,0.3)"], 0.8, 3);
  for (let i = 0; i < 90; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), rad = U(r, 4, 10);
    g.fillStyle = pick(r, ["#a89478", "#bfae92", "#8f7c64"]); g.beginPath(); g.ellipse(x, y, rad, rad * 0.75, U(r, 0, 3), 0, TAU); g.fill();
    g.fillStyle = "rgba(255,245,225,0.4)"; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.35, 0, TAU); g.fill();
  }
  g.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), a = U(r, 0, TAU), l = U(r, 16, 46), c = pick(r, ["#f1cf6a", "#e3b94e", "#f7de8a", "#caa040"]), w = U(r, 2, 4);
    wrap2(S, S, x, y, l, (X, Y) => {
      g.strokeStyle = c; g.lineWidth = w;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke();
    });
  }
});
/** thatch: overlapping rows of golden straw bundles (1024 px = 2 m; rows run along x) */
export const thatch = () => ctex("pv_thatch", 1024, 1024, (g, r) => {
  const S = 1024, RH = 128;
  g.fillStyle = "#9c7434"; g.fillRect(0, 0, S, S);
  for (let row = 0; row < S / RH; row++) {
    const y0 = row * RH;
    for (let i = 0; i < 520; i++) {
      const x = U(r, 0, S), l = U(r, 70, 140), c = pick(r, ["#d9ad52", "#c99a40", "#e6bf66", "#b7883a", "#f0cd78"]), w = U(r, 2.5, 5), dx = U(r, -8, 8), y1 = y0 + U(r, -10, 16);
      for (const ox of [0, -S, S]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x + ox, y1); g.lineTo(x + ox + dx, y1 + l); g.stroke(); }
    }
    g.fillStyle = "rgba(80,50,20,0.3)"; g.fillRect(0, y0 + RH - 8, S, 10);
  }
});
/** loose hay: criss-cross golden strands (512 px) */
export const hayTex = () => ctex("pv_hay", 512, 512, (g, r) => {
  g.fillStyle = "#c79a3e"; g.fillRect(0, 0, 512, 512);
  g.lineCap = "round";
  for (let i = 0; i < 1500; i++) {
    const x = U(r, 0, 512), y = U(r, 0, 512), a = U(r, -0.9, 0.9) + (r() < 0.5 ? 0 : Math.PI / 2), l = U(r, 20, 70), c = pick(r, ["#e9c460", "#d6aa48", "#f3d888", "#a87c2c", "#e0b552"]), w = U(r, 1.5, 3.5);
    wrap2(512, 512, x, y, l, (X, Y) => {
      g.strokeStyle = c; g.lineWidth = w;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke();
    });
  }
});
/** foliage clump: overlapping leaf blobs (512 px) */
export const leafTex = (key: string, cols: string[], hi: string) => ctex("pv_leaf_" + key, 512, 512, (g, r) => {
  g.fillStyle = cols[0]; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const x = U(r, 0, 512), y = U(r, 0, 512), a = U(r, 0, TAU), l = U(r, 10, 22), c = pick(r, cols);
    wrap2(512, 512, x, y, l, (X, Y) => { g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, l, l * 0.38, a, 0, TAU); g.fill(); });
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = hi; g.beginPath(); g.ellipse(U(r, 0, 512), U(r, 0, 512), U(r, 6, 14), U(r, 2, 4), U(r, 0, TAU), 0, TAU); g.fill(); }
});
/** a palm frond (alpha): central rib + leaflets (256 x 1024, rib along y, base at the bottom) */
export const palmFrond = () => ctex("pv_palmFrond", 256, 1024, (g, r) => {
  g.clearRect(0, 0, 256, 1024);
  for (let y = 990; y > 30; y -= 20) {
    const t = 1 - y / 1024, l = 118 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.06)) + 8;
    for (const s of [-1, 1]) {
      g.fillStyle = pick(r, ["#3f8f3c", "#4ea245", "#367f35", "#5cb04c"]);
      g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(128 + s * l * 0.6, y - 26, 128 + s * l, y - 34); g.quadraticCurveTo(128 + s * l * 0.5, y - 4, 128, y + 14); g.fill();
    }
  }
  g.strokeStyle = "#7a6a2c"; g.lineWidth = 10; g.beginPath(); g.moveTo(128, 1024); g.quadraticCurveTo(132, 500, 128, 20); g.stroke();
});
/** rough palm trunk: stacked leaf-base rings (256 x 512) */
export const palmBark = () => ctex("pv_palmBark", 256, 512, (g, r) => {
  g.fillStyle = "#9a7448"; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) {
    g.fillStyle = "rgba(70,45,20,0.45)"; g.beginPath(); g.moveTo(0, y + 26);
    for (let x = 0; x < 256; x += 32) { g.lineTo(x + 16, y + 32 + U(r, -3, 3)); g.lineTo(x + 32, y + 26); }
    g.lineTo(256, y + 32); g.lineTo(0, y + 32); g.fill();
    g.fillStyle = "rgba(255,230,180,0.18)"; g.fillRect(0, y + 2, 256, 5);
  }
  speck(g, r, 256, 512, 400, ["rgba(60,40,20,0.3)", "rgba(240,210,160,0.25)"]);
});

// =====================================================================================================
// Edessa
// =====================================================================================================
/** the wall: warm tan limestone ashlar courses (0.5 m) with every 4th course a darker band of mudbricks:
 *  1024 px = 4 m x 4 m */
export const edWall = () => ctex("pv_edWall", 1024, 1024, (g, r) => {
  const S = 1024, ppm = 256, RH = 0.5 * ppm, M = 6;
  g.fillStyle = "#8f6d48"; g.fillRect(0, 0, S, S);
  for (let row = 0; row < S / RH; row++) {
    const y = row * RH;
    if (row % 4 === 1) {
      const bh = 0.125 * ppm, bw = 0.4 * ppm;
      for (let k = 0; k < 4; k++) for (let x = -((k % 2) * bw) / 2; x < S; x += bw) {
        g.fillStyle = jit(r, pick(r, ["#b0804f", "#a87848", "#b98a58"]), 0.07, 4, 0.15);
        g.fillRect(x + 2, y + k * bh + 2, bw - 4, bh - 4);
      }
      continue;
    }
    let x = -U(r, 0, 200);
    while (x < S) {
      const w = U(r, 0.7, 1.25) * ppm;
      g.fillStyle = jit(r, pick(r, ["#dcbb88", "#d4b07c", "#e3c595", "#cfa874"]), 0.07, 4, 0.15);
      g.fillRect(x + M / 2, y + M / 2, w - M, RH - M);
      g.fillStyle = "rgba(255,240,205,0.22)"; g.fillRect(x + M / 2, y + M / 2, w - M, 6);
      g.fillStyle = "rgba(90,60,30,0.2)"; g.fillRect(x + M / 2, y + RH - M / 2 - 7, w - M, 7);
      blotch(g, x + w / 2, y + RH / 2, U(r, 30, 60), 1.8, pick(r, ["255,240,210", "150,110,60"]), 0.14);
      x += w;
    }
  }
  speck(g, r, S, S, 2200, ["rgba(110,80,45,0.3)", "rgba(255,245,220,0.3)"], 0.8, 2.6);
  for (let i = 0; i < 8; i++) {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, "rgba(110,80,50,0.12)"); gr.addColorStop(1, "rgba(110,80,50,0)");
    g.fillStyle = gr; g.fillRect(U(r, 0, S), 0, U(r, 20, 60), S);
  }
});
/** golden dry plain: dust, cracks, pebbles, dry grass tufts: 1024 px = 8 m */
export const dustGround = () => ctex("pv_dustGround", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#d4b07e"; g.fillRect(0, 0, S, S);
  blots(g, r, S, S, 70, 70, 220, ["236,206,160", "170,130,90", "220,190,130", "190,160,110"], 0.22);
  speck(g, r, S, S, 3000, ["rgba(120,85,45,0.32)", "rgba(250,228,185,0.32)"], 0.8, 2.6);
  g.strokeStyle = "rgba(120,80,45,0.35)"; g.lineWidth = 2.5; g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    let x = U(r, 100, S - 100), y = U(r, 100, S - 100); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += U(r, -30, 30); y += U(r, -30, 30); g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 140; i++) {
    const x = U(r, 20, S - 20), y = U(r, 20, S - 20);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + U(r, -0.9, 0.9), l = U(r, 8, 20);
      g.strokeStyle = pick(r, ["#b8954a", "#e6c879", "#9c7b3c"]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }
  for (let i = 0; i < 70; i++) { const rad = U(r, 3, 8); g.fillStyle = pick(r, ["#a8906c", "#c4ae88"]); g.beginPath(); g.arc(U(r, 10, S - 10), U(r, 10, S - 10), rad, 0, TAU); g.fill(); }
});
/** tent cloth: vertical stripes (tinted by instance colour): 256 px */
export const tentCloth = () => ctex("pv_tent", 256, 256, (g, r) => {
  g.fillStyle = "#f4ead6"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 64) { g.fillStyle = "rgba(160,120,90,0.35)"; g.fillRect(x + 40, 0, 18, 256); }
  speck(g, r, 256, 256, 300, ["rgba(120,90,60,0.2)"]);
});
/** Roman red banner: red cloth, gold fringe + border, a gold laurel wreath round a disc (no text). 256 x 512 */
export const romanBanner = () => ctex("pv_romBanner", 256, 512, (g) => {
  g.fillStyle = "#b42b25"; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "#e8b64a"; g.lineWidth = 10; g.strokeRect(14, 14, 228, 440);
  g.fillStyle = "#e8b64a"; for (let x = 6; x < 256; x += 16) g.fillRect(x, 460, 8, 52);
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * (0.55 + k * 0.3), x = 128 + Math.cos(a) * 72, y = 220 + Math.sin(a) * 72;
    g.fillStyle = "#e8b64a"; g.beginPath(); g.ellipse(x, y, 17, 7, a + s * 1.2, 0, TAU); g.fill();
  }
  g.fillStyle = "#e8b64a"; g.beginPath(); g.arc(128, 220, 30, 0, TAU); g.fill();
  g.fillStyle = "#b42b25"; g.beginPath(); g.arc(128, 220, 15, 0, TAU); g.fill();
});
/** Roman shield (oval scutum face): red with a gold rim, gold boss, gold wing lines (no text). 256 x 384 */
export const shieldFace = () => ctex("pv_shield", 256, 384, (g) => {
  g.fillStyle = "#a8281f"; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#e7b54c"; g.lineWidth = 16; g.beginPath(); g.ellipse(128, 192, 112, 176, 0, 0, TAU); g.stroke();
  g.lineWidth = 9;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(128 + s * 34, 192); g.quadraticCurveTo(128 + s * 80, 140, 128 + s * 86, 70); g.stroke();
    g.beginPath(); g.moveTo(128 + s * 34, 192); g.quadraticCurveTo(128 + s * 80, 244, 128 + s * 86, 314); g.stroke();
  }
  g.fillStyle = "#e7b54c"; g.beginPath(); g.arc(128, 192, 34, 0, TAU); g.fill();
  g.fillStyle = "rgba(255,250,220,0.6)"; g.beginPath(); g.arc(118, 182, 10, 0, TAU); g.fill();
});
/** Persian pennant: deep purple, red edges, a gold sun disc (256 x 128, the pole edge on the left) */
export const persPennant = () => ctex("pv_persPen", 256, 128, (g) => {
  g.fillStyle = "#5b2a7a"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#c23a2c"; g.fillRect(0, 0, 256, 18); g.fillRect(0, 110, 256, 18);
  g.fillStyle = "#e8b64a"; g.beginPath(); g.arc(80, 64, 26, 0, TAU); g.fill();
});
/** distant hill: soft patches (512 px) */
export const hillTex = (key: string, base: string, cols: string[]) => ctex("pv_hill_" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) wrap2(512, 512, U(r, 0, 512), U(r, 0, 512), 110, (x, y) => blotch(g, x, y, U(r, 25, 70), U(r, 1, 2.4), pick(r, cols), 0.4));
});
/** soft round dot (light pools, halos, motes) */
export const softDot = () => ctex("pv_softDot", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
/** soft smoke puff (grey-violet, for the camp's fires) */
export const smokeTex = () => ctex("pv_smoke", 256, 256, (g, r) => {
  for (let i = 0; i < 9; i++) blotch(g, U(r, 80, 176), U(r, 80, 176), U(r, 50, 80), 1, pick(r, ["255,255,255", "235,235,240"]), 0.5);
});
