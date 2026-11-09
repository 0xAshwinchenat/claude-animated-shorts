// Painted Canvas2D textures for Megara (owner: city): limestone ashlar (wall, plinth, towers), walkway + street
// flagstones, packed-earth town ground, dry golden grass, the dirt road, whitewashed plaster facades (small windows,
// wooden doors), Laconian terracotta roof tiles, dark oak gate planks, pen mud, dry-stone, straw, weathered wood,
// olive canopy, the sea. All tile seamlessly unless noted. Colours are ALBEDOS (the two-tone light lifts lit faces
// ~x1.5), so the pale stone is painted a little greyer than its on-screen target.
import * as THREE from "three";
import { ctex, jit, pick, wrapX, wrap2, blotch, rr, U, TAU, type R, type G } from "./paint";

const rgba = (c: string, a: number) => { const k = new THREE.Color(c); return `rgba(${Math.round(k.r * 255)},${Math.round(k.g * 255)},${Math.round(k.b * 255)},${a})`; };
const speck = (g: G, r: R, W: number, H: number, n: number, rad: [number, number], cols: string[]) => {
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, q = U(r, rad[0], rad[1]), c = cols[Math.floor(r() * cols.length)];
    g.fillStyle = c; wrap2(W, H, x, y, q, (X, Y) => { g.beginPath(); g.ellipse(X, Y, q, q * U(r, 0.6, 1), r() * 3, 0, TAU); g.fill(); });
  }
};
const mottle = (g: G, r: R, W: number, H: number, n: number, rad: [number, number], dark: string, light: string, a: [number, number]) => {
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, q = U(r, rad[0], rad[1]), d = r() < 0.55;
    const sx = U(r, 1, 1.8); wrap2(W, H, x, y, q * sx + 2, (X, Y) => blotch(g, X, Y, q, sx, d ? dark : light, d ? a[0] : a[1]));
  }
};

// ------------------------------------------------------------------------------------------- ashlar
/** Coursed limestone ashlar. tile metres per texture, course height ch (m), block length range bl (m). Each block: its
 *  own tone (+-), a soft top-left light / bottom-right shade bevel, tooling strokes, pits; dark painted seams. */
export const ashlarHD = (key: string, tile: number, ch: number, bl: [number, number], cols: string[], seam: string, S = 2048) => ctex(key, S, S, (g, r) => {
  const PPM = S / tile, rows = Math.round(tile / ch), RH = S / rows, J = Math.max(5, Math.round(0.022 * PPM));
  g.fillStyle = seam; g.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const y = row * RH, ws: number[] = []; let sum = 0;
    while (sum < S) { const w = U(r, bl[0], bl[1]) * PPM; ws.push(w); sum += w; }
    const k = S / sum; let x = U(r, 0, S);
    for (const w0 of ws) {
      const w = w0 * k, col = jit(r, pick(r, cols), 0.07, 4, 0.16), dl = U(r, -1, 1);
      const tool = Array.from({ length: 10 }, () => [r(), r(), U(r, 0.04, 0.12) * PPM, U(r, -0.4, 0.4)]);
      const pits = Array.from({ length: 22 }, () => [r(), r(), U(r, 1, 2.6), r() < 0.6 ? 1 : 0]);
      const chip = r() < 0.25 ? [r() < 0.5 ? 0 : 1, r() < 0.5 ? 0 : 1, U(r, 0.05, 0.1) * PPM] : null;
      wrapX(S, x % S, w, (xx) => {
        const X = xx + J / 2, Y = y + J / 2, BW = w - J, BH = RH - J;
        rr(g, X, Y, BW, BH, J * 0.8); g.fillStyle = col; g.fill();
        g.save(); rr(g, X, Y, BW, BH, J * 0.8); g.clip();
        g.fillStyle = dl > 0 ? `rgba(255,250,235,${0.08 * dl})` : `rgba(70,52,36,${-0.08 * dl})`; g.fillRect(X, Y, BW, BH);
        const gr = g.createLinearGradient(X, Y, X + BW * 0.25, Y + BH);
        gr.addColorStop(0, "rgba(255,250,235,0.16)"); gr.addColorStop(0.5, "rgba(255,250,235,0)"); gr.addColorStop(1, "rgba(80,60,40,0.14)");
        g.fillStyle = gr; g.fillRect(X, Y, BW, BH);
        g.fillStyle = "rgba(255,250,235,0.24)"; g.fillRect(X, Y, BW, J * 0.7);                  // top arris
        g.fillStyle = "rgba(70,50,35,0.22)"; g.fillRect(X, Y + BH - J * 0.8, BW, J * 0.8);       // bottom arris shade
        g.fillStyle = "rgba(70,50,35,0.12)"; g.fillRect(X + BW - J * 0.7, Y, J * 0.7, BH);
        g.lineCap = "round";
        for (const [u, v, l, a] of tool) {                                                       // claw-chisel tooling
          g.strokeStyle = "rgba(90,70,50,0.12)"; g.lineWidth = 2;
          const px = X + u * BW, py = Y + v * BH;
          for (let t = 0; t < 3; t++) { g.beginPath(); g.moveTo(px + t * 5, py); g.lineTo(px + t * 5 + l * Math.sin(a), py + l * Math.cos(a)); g.stroke(); }
        }
        for (const [u, v, s, d] of pits) { g.fillStyle = d ? "rgba(90,70,52,0.35)" : "rgba(255,252,240,0.35)"; g.beginPath(); g.arc(X + u * BW, Y + v * BH, s, 0, TAU); g.fill(); }
        if (chip) { g.fillStyle = rgba(seam, 0.55); g.beginPath(); const cx = X + chip[0] * BW, cy = Y + chip[1] * BH; g.moveTo(cx, cy); g.lineTo(cx + (chip[0] ? -1 : 1) * chip[2], cy); g.lineTo(cx, cy + (chip[1] ? -1 : 1) * chip[2] * 0.7); g.fill(); }
        g.restore();
      });
      x += w;
    }
  }
  mottle(g, r, S, S, 30, [0.4 * PPM, 1.3 * PPM], "110,85,55", "255,245,220", [0.07, 0.06]);
  for (let i = 0; i < 14; i++) { // rain streaks from the seams
    const x = U(r, 0, S), y = U(r, 0, S), w = U(r, 6, 20), h = U(r, 0.4, 1.4) * PPM;
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "rgba(100,80,60,0.12)"); gr.addColorStop(1, "rgba(100,80,60,0)");
    wrapX(S, x, w, (xx) => { g.fillStyle = gr; g.fillRect(xx, y, w, Math.min(h, S - y)); });
  }
});
export const WALL_TILE = 6;
const LIME = ["#d8c294", "#d1b98a", "#dcc89c", "#ccb27e", "#d9c497", "#cfb88a"];
export const wallHD = () => ashlarHD("mgWall", WALL_TILE, 0.6, [0.9, 1.7], LIME, "#6a5844");
export const plinthHD = () => ashlarHD("mgPlinth", WALL_TILE, 1.0, [1.4, 2.4], ["#ab9877", "#a28e6c", "#b39f7d", "#9d8a6a"], "#4e4232");
export const towerHD = () => ashlarHD("mgTower", WALL_TILE, 0.5, [0.8, 1.4], ["#dcc69a", "#d4bd8e", "#dfcba0", "#cfb687", "#d7c293"], "#6a5640");

// ------------------------------------------------------------------------------------------- flagstones
/** irregular flagstone paving (street, walkway, passage): rows of slabs of varying length, slightly skewed joints */
export const flagsHD = (key: string, tile: number, cols: string[], joint: string, S = 2048) => ctex(key, S, S, (g, r) => {
  const PPM = S / tile, rows = Math.round(tile / 0.7), RH = S / rows, J = Math.round(0.03 * PPM);
  g.fillStyle = joint; g.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const y = row * RH, ws: number[] = []; let sum = 0;
    while (sum < S) { const w = U(r, 0.5, 1.2) * PPM; ws.push(w); sum += w; }
    const k = S / sum; let x = U(r, 0, S);
    for (const w0 of ws) {
      const w = w0 * k, col = jit(r, pick(r, cols), 0.09, 5, 0.2), sk = U(r, -0.06, 0.06) * RH;
      wrapX(S, x % S, w, (xx) => {
        const X = xx + J / 2, Y = y + J / 2, BW = w - J, BH = RH - J;
        g.beginPath(); g.moveTo(X + 6, Y); g.lineTo(X + BW - 6 + sk, Y + 2); g.lineTo(X + BW - sk, Y + BH - 4); g.lineTo(X + 4, Y + BH); g.closePath();
        g.fillStyle = col; g.fill();
        g.save(); g.clip();
        const gr = g.createLinearGradient(X, Y, X + BW * 0.4, Y + BH);
        gr.addColorStop(0, "rgba(255,248,230,0.14)"); gr.addColorStop(1, "rgba(70,55,40,0.14)");
        g.fillStyle = gr; g.fillRect(X - 10, Y - 10, BW + 20, BH + 20);
        g.restore();
      });
      x += w;
    }
  }
  mottle(g, r, S, S, 36, [0.3 * PPM, 1.2 * PPM], "95,72,48", "255,240,215", [0.1, 0.06]);
  speck(g, r, S, S, 900, [1.2, 3], ["rgba(90,70,50,0.4)", "rgba(250,240,220,0.4)"]);
});
export const STREET_TILE = 6;
export const streetHD = () => flagsHD("mgStreet", STREET_TILE, ["#b9a98c", "#ad9d80", "#c2b293", "#a89679", "#b4a386"], "#6f5d47");
export const walkHD = () => flagsHD("mgWalk", 4, ["#c7b796", "#bdad8c", "#cdbd9c"], "#7a6850", 1024);

// ------------------------------------------------------------------------------------------- ground
/** packed earth inside the town: warm tan, foot-worn darker patches, pebbles, straw bits (8 m tile) */
export const earthHD = () => ctex("mgEarth", 1024, 1024, (g, r) => {
  const S = 1024, PPM = S / 8;
  g.fillStyle = "#a88e68"; g.fillRect(0, 0, S, S);
  mottle(g, r, S, S, 40, [0.5 * PPM, 2 * PPM], "100,74,46", "222,198,150", [0.16, 0.14]);
  speck(g, r, S, S, 1600, [0.8, 2.2], ["rgba(85,62,40,0.45)", "rgba(235,215,175,0.5)", "rgba(120,95,65,0.4)"]);
  speck(g, r, S, S, 90, [2.5, 5], ["rgba(190,175,150,0.9)", "rgba(150,135,112,0.9)"]);
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, a = r() * TAU, l = U(r, 4, 10); g.strokeStyle = "rgba(220,190,110,0.5)"; g.lineWidth = 1.2; wrap2(S, S, x, y, 12, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke(); }); }
});
/** dry golden grass of the plain (8 m tile): broad ochre/straw/olive patches + thousands of short blade strokes */
export const grassGoldHD = () => ctex("mgGrass", 2048, 2048, (g, r) => {
  const S = 2048, PPM = S / 8;
  g.fillStyle = "#c2a157"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, q = U(r, 0.8, 2.6) * PPM, k = r();
    wrap2(S, S, x, y, q * 1.5, (X, Y) => blotch(g, X, Y, q, 1.4, k < 0.35 ? "214,186,110" : k < 0.7 ? "160,128,62" : "140,140,70", 0.35));
  }
  g.lineCap = "round";
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, h = U(r, 8, 20), lean = U(r, -5, 5), k = r();
    const c = k < 0.4 ? "rgba(236,208,135,0.5)" : k < 0.75 ? "rgba(150,115,55,0.45)" : k < 0.9 ? "rgba(120,125,60,0.4)" : "rgba(250,230,170,0.55)";
    wrap2(S, S, x, y, 24, (X, Y) => { g.strokeStyle = c; g.lineWidth = U(r, 1.4, 2.6); g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + lean * 0.4, Y - h * 0.6, X + lean, Y - h); g.stroke(); });
  }
  speck(g, r, S, S, 400, [1.2, 3], ["rgba(110,85,50,0.45)", "rgba(245,235,200,0.5)"]);
  for (let i = 0; i < 40; i++) { // tiny wildflowers (thistle purple, chamomile white)
    const x = r() * S, y = r() * S, c = pick(r, ["#efe8d6", "#a77ab8", "#efe8d6", "#e8c450"]);
    wrap2(S, S, x, y, 6, (X, Y) => { g.fillStyle = c; g.beginPath(); g.arc(X, Y, 3.2, 0, TAU); g.fill(); });
  }
});
/** the dirt road: dusty pale tan, two darker wheel ruts along v (tile 6 m across the road width x 6 m along) */
export const roadHD = () => ctex("mgRoad", 1024, 1024, (g, r) => {
  const S = 1024, PPM = S / 6;
  g.fillStyle = "#b99d72"; g.fillRect(0, 0, S, S);
  for (const cx of [0.32, 0.68]) {
    const gr = g.createLinearGradient((cx - 0.06) * S, 0, (cx + 0.06) * S, 0);
    gr.addColorStop(0, "rgba(110,82,52,0)"); gr.addColorStop(0.5, "rgba(110,82,52,0.2)"); gr.addColorStop(1, "rgba(110,82,52,0)");
    g.fillStyle = gr; g.fillRect((cx - 0.06) * S, 0, 0.12 * S, S);
  }
  mottle(g, r, S, S, 30, [0.3 * PPM, 1.2 * PPM], "110,82,52", "235,215,175", [0.14, 0.14]);
  speck(g, r, S, S, 1400, [0.8, 2.4], ["rgba(95,70,45,0.45)", "rgba(240,225,190,0.5)"]);
  speck(g, r, S, S, 70, [2.5, 5], ["rgba(185,170,145,0.9)", "rgba(140,125,105,0.9)"]);
  // grass creeping in at the edges
  g.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const side = r() < 0.5, x = side ? U(r, 0, 0.12) * S : U(r, 0.88, 1) * S, y = r() * S, h = U(r, 6, 14);
    g.strokeStyle = r() < 0.5 ? "rgba(205,170,95,0.6)" : "rgba(150,120,60,0.5)"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + U(r, -3, 3), y - h); g.stroke();
  }
});

// ------------------------------------------------------------------------------------------- houses
/** whitewashed plaster facade (NOT tiling): wm x hm metres, 64 px/m. Small deep windows (dark recess, wooden shutter
 *  or bars), a wooden plank door when door = true, rising damp at the foot, patched limewash. Layout matches
 *  winLayout() so city.ts can add real sills / lintels. */
export const winLayout = (wm: number, hm: number, door: boolean) => {
  const floors = hm > 4.5 ? 2 : 1, n = Math.max(1, Math.floor(wm / 2.6)), out: { u: number; y: number; w: number; h: number; door: boolean }[] = [];
  for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    if (door && fl === 0 && i === Math.floor((n - 1) / 2)) { out.push({ u, y: 0, w: 1.1, h: 2.0, door: true }); continue; }
    if (fl === 0 && floors === 2 && i % 2 === 1) continue;
    out.push({ u, y: fl === 0 ? 1.3 : 3.3, w: 0.55, h: 0.6, door: false });
  }
  return out;
};
export const plasterHD = (key: string, wm: number, hm: number, wall: string, door: boolean, trim: string) => {
  const PX = 64, W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("mgPl" + key, W, H, (g, r) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    mottle(g, r, W, H, Math.round(wm * hm * 0.8), [m(0.3), m(1.1)], "150,125,95", "255,252,242", [0.09, 0.12]);
    for (let i = 0; i < wm * 2; i++) { // limewash brush strokes
      const x = r() * W, y = r() * H, l = U(r, m(0.4), m(1.2));
      g.strokeStyle = "rgba(255,252,245,0.12)"; g.lineWidth = U(r, 6, 14); g.lineCap = "round";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + U(r, -8, 8)); g.stroke();
    }
    // rising damp + splash at the foot
    const gr = g.createLinearGradient(0, H, 0, H - m(0.9));
    gr.addColorStop(0, "rgba(120,92,62,0.45)"); gr.addColorStop(1, "rgba(120,92,62,0)");
    g.fillStyle = gr; g.fillRect(0, H - m(0.9), W, m(0.9));
    for (let i = 0; i < wm; i++) { const x = r() * W; blotch(g, x, H - m(0.25), m(U(r, 0.3, 0.6)), 1.6, "110,85,58", 0.2); }
    // a few cracks + bare patches showing the mudbrick
    for (let i = 0; i < Math.ceil(wm / 4); i++) {
      const x = r() * W, y = U(r, 0.2, 0.7) * H, w = m(U(r, 0.25, 0.6)), h = m(U(r, 0.15, 0.35));
      g.fillStyle = "rgba(176,140,98,0.75)"; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, U(r, -0.3, 0.3), 0, TAU); g.fill();
      g.strokeStyle = "rgba(120,95,70,0.5)"; g.lineWidth = 1.5; g.stroke();
    }
    g.strokeStyle = "rgba(110,90,70,0.4)"; g.lineWidth = 1.4;
    for (let i = 0; i < Math.ceil(wm / 3); i++) { let x = r() * W, y = U(r, 0.1, 0.5) * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += U(r, -10, 10); y += U(r, 8, 22); g.lineTo(x, y); } g.stroke(); }
    // windows + door
    for (const w of winLayout(wm, hm, door)) {
      const cx = w.u * W, x0 = cx - m(w.w) / 2, y1 = H - m(w.y), y0 = y1 - m(w.h);
      if (w.door) {
        g.fillStyle = "#3a2618"; g.fillRect(x0 - 4, y0 - 4, m(w.w) + 8, m(w.h) + 4);               // reveal
        const pw = m(w.w) / 4;
        for (let k = 0; k < 4; k++) { g.fillStyle = jit(r, trim, 0.1, 4, 0.1); g.fillRect(x0 + k * pw + 1.5, y0, pw - 3, m(w.h)); }
        g.fillStyle = "rgba(30,18,10,0.55)"; g.fillRect(x0, y0 + m(0.45), m(w.w), 5); g.fillRect(x0, y0 + m(1.5), m(w.w), 5);
        g.fillStyle = "#2b2b2b"; g.beginPath(); g.arc(x0 + m(w.w) * 0.78, y0 + m(1.05), 4, 0, TAU); g.fill();
      } else {
        g.fillStyle = "#2c2230"; g.fillRect(x0, y0, m(w.w), m(w.h));                               // deep dark recess
        g.fillStyle = "rgba(90,70,90,0.6)"; g.fillRect(x0, y0, m(w.w), 5);
        if (r() < 0.55) { // half-open wooden shutter
          g.fillStyle = jit(r, trim, 0.1, 4, 0.1); g.fillRect(x0 + m(w.w) * 0.55, y0, m(w.w) * 0.45, m(w.h));
          g.fillStyle = "rgba(30,18,10,0.4)"; for (let k = 1; k < 3; k++) g.fillRect(x0 + m(w.w) * 0.55, y0 + (k * m(w.h)) / 3, m(w.w) * 0.45, 2.5);
        } else { g.fillStyle = "#5b3e28"; for (let k = 1; k < 3; k++) g.fillRect(x0 + (k * m(w.w)) / 3 - 2, y0, 4, m(w.h)); } // wooden bars
      }
    }
  });
};
/** Laconian terracotta roof: wide pan tiles with rounded cover tiles (ridges) running down the slope (canvas y = down
 *  the slope), courses every 0.5 m. 1024 px = 4 m. */
export const TILE_W = 4;
export const tileHD = (key: string, col: string) => ctex("mgTile" + key, 1024, 1024, (g, r) => {
  const S = 1024, PPM = S / TILE_W, PITCH = Math.round(0.42 * PPM), CO = Math.round(0.5 * PPM), n = Math.round(S / PITCH), P2 = S / n;
  g.fillStyle = col; g.fillRect(0, 0, S, S);
  for (let row = 0; row < S / CO; row++) {
    const y = row * CO;
    for (let i = 0; i < n; i++) {
      const x = i * P2, t = jit(r, col, 0.08, 5, 0.12);
      g.fillStyle = t; g.fillRect(x, y, P2, CO);                                       // pan tile
      const gr = g.createLinearGradient(0, y, 0, y + CO); gr.addColorStop(0, "rgba(60,25,15,0.18)"); gr.addColorStop(0.3, "rgba(60,25,15,0)"); gr.addColorStop(1, "rgba(255,230,200,0.08)");
      g.fillStyle = gr; g.fillRect(x, y, P2, CO);
      // cover tile over the joint (rounded: light left, shade right)
      const cw = P2 * 0.34, cx = x - cw / 2, ct = jit(r, col, 0.1, 6, 0.15);
      wrapX(S, cx, cw, (xx) => {
        const gc = g.createLinearGradient(xx, 0, xx + cw, 0);
        gc.addColorStop(0, "rgba(70,28,16,0.5)"); gc.addColorStop(0.15, ct); gc.addColorStop(0.45, "#" + new THREE.Color(ct).offsetHSL(0, 0, 0.07).getHexString()); gc.addColorStop(0.85, ct); gc.addColorStop(1, "rgba(60,22,12,0.6)");
        g.fillStyle = gc; g.fillRect(xx, y, cw, CO);
        g.fillStyle = "rgba(55,20,12,0.45)"; g.fillRect(xx + 2, y + CO - 7, cw - 4, 7);   // cover-tile lip shadow
      });
    }
    g.fillStyle = "rgba(50,18,10,0.35)"; g.fillRect(0, y + CO - 4, S, 4);
  }
  mottle(g, r, S, S, 22, [40, 140], "70,55,35", "255,220,180", [0.12, 0.06]);
  speck(g, r, S, S, 260, [1.5, 4], ["rgba(140,150,90,0.35)", "rgba(240,230,210,0.35)"]); // lichen
});

// ------------------------------------------------------------------------------------------- wood + gate
const grainStroke = (g: G, r: R, x: number, y0: number, y1: number, amp: number, col: string, lw: number) => {
  g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y0);
  const n = 6, ph = r() * TAU;
  for (let i = 1; i <= n; i++) g.lineTo(x + amp * Math.sin(ph + i * 1.3), y0 + ((y1 - y0) * i) / n);
  g.stroke();
};
/** dark oak gate leaf: vertical planks, grain, knots, soot + scuffs at the foot. 512 x 1024 = 3 m x 6 m (not tiling) */
export const gateHD = () => ctex("mgGate", 512, 1024, (g, r) => {
  const W = 512, H = 1024, N = 6, PW = W / N;
  g.fillStyle = "#1f140c"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < N; i++) {
    const x = i * PW, c = jit(r, pick(r, ["#7a5234", "#6f4a2e", "#83593a", "#69452b"]), 0.08, 4, 0.12);
    g.fillStyle = c; g.fillRect(x + 3, 0, PW - 6, H);
    const gr = g.createLinearGradient(x, 0, x + PW, 0); gr.addColorStop(0, "rgba(255,225,190,0.10)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(20,10,5,0.22)");
    g.fillStyle = gr; g.fillRect(x + 3, 0, PW - 6, H);
    for (let k = 0; k < 7; k++) grainStroke(g, r, x + U(r, 10, PW - 10), 0, H, U(r, 2, 6), r() < 0.5 ? "rgba(30,18,10,0.35)" : "rgba(160,120,80,0.18)", U(r, 1.2, 2.4));
    if (r() < 0.7) { const ky = U(r, 100, H - 100), kx = x + U(r, 20, PW - 20); g.fillStyle = "rgba(25,14,8,0.7)"; g.beginPath(); g.ellipse(kx, ky, 6, 11, 0, 0, TAU); g.fill(); g.strokeStyle = "rgba(25,14,8,0.4)"; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, 11, 20, 0, 0, TAU); g.stroke(); }
  }
  const gr = g.createLinearGradient(0, H, 0, H - 200); gr.addColorStop(0, "rgba(25,15,10,0.5)"); gr.addColorStop(1, "rgba(25,15,10,0)");
  g.fillStyle = gr; g.fillRect(0, H - 200, W, 200);
  speck(g, r, W, H, 200, [1, 3], ["rgba(200,170,130,0.25)", "rgba(15,8,4,0.4)"]);
});
/** weathered grey-brown planks (cart, trough, pen gate, shelves): 512 px = 2 m, boards along u */
export const woodHD = (key = "mgWood", base = "#8a6a4c") => ctex(key, 512, 512, (g, r) => {
  const S = 512, N = 4, BH = S / N;
  g.fillStyle = "#3b2a1c"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < N; i++) {
    const y = i * BH, c = jit(r, base, 0.1, 5, 0.15);
    g.fillStyle = c; g.fillRect(0, y + 3, S, BH - 6);
    g.save(); g.translate(0, 0);
    for (let k = 0; k < 6; k++) { const yy = y + U(r, 10, BH - 10); g.strokeStyle = r() < 0.5 ? "rgba(50,35,22,0.3)" : "rgba(220,200,170,0.18)"; g.lineWidth = U(r, 1, 2); g.beginPath(); g.moveTo(0, yy); for (let x = 0; x <= S; x += 64) g.lineTo(x, yy + 3 * Math.sin(x * 0.02 + k)); g.stroke(); }
    g.restore();
    g.fillStyle = "rgba(255,240,215,0.15)"; g.fillRect(0, y + 3, S, 4);
  }
  speck(g, r, S, S, 120, [1, 2.5], ["rgba(40,28,18,0.5)"]);
});

// ------------------------------------------------------------------------------------------- the pen
/** pen floor (8 x 6 m, not tiling, 128 px/m): churned dark mud, wetter darker patches, trotter prints, straw */
export const mudHD = () => ctex("mgMud", 1024, 768, (g, r) => {
  const W = 1024, H = 768;
  g.fillStyle = "#5e4630"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, q = U(r, 30, 120), d = r() < 0.6; blotch(g, x, y, q, U(r, 1, 2), d ? "40,28,18" : "130,100,68", d ? 0.4 : 0.3); }
  for (let i = 0; i < 160; i++) { // trotter prints: paired small cloven marks
    const x = r() * W, y = r() * H, a = r() * TAU;
    g.fillStyle = "rgba(30,20,12,0.55)";
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + Math.cos(a + Math.PI / 2) * 3 * s, y + Math.sin(a + Math.PI / 2) * 3 * s, 2.4, 4.5, a, 0, TAU); g.fill(); }
  }
  g.lineCap = "round";
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = U(r, 8, 22); g.strokeStyle = r() < 0.5 ? "rgba(225,190,105,0.75)" : "rgba(180,145,75,0.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  speck(g, r, W, H, 500, [1, 3], ["rgba(25,16,10,0.4)", "rgba(150,120,85,0.4)"]);
});
/** dry-stone: flat irregular slabs laid in rough courses (polygons, not pebbles), thin warm-brown voids, 512 px = 1.5 m */
export const dryStoneHD = () => ctex("mgDry", 512, 512, (g, r) => {
  const S = 512, ROWS = 6, RH = S / ROWS;
  g.fillStyle = "#6a5236"; g.fillRect(0, 0, S, S);
  for (let row = 0; row < ROWS; row++) {
    const y = row * RH; let x = U(r, 0, 60);
    while (x < S + 60) {
      const w = U(r, 70, 150), c = jit(r, pick(r, ["#c9ad78", "#bfa06a", "#d0b582", "#b39561", "#c6a774"]), 0.08, 5, 0.18);
      const pts = [[3, U(r, 2, 10)], [w * U(r, 0.3, 0.7), U(r, 0, 6)], [w - 3, U(r, 2, 12)], [w - U(r, 2, 8), RH - U(r, 3, 10)], [w * U(r, 0.3, 0.7), RH - U(r, 1, 5)], [U(r, 2, 8), RH - U(r, 3, 12)]];
      wrapX(S, x, w, (xx) => {
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(xx + px, y + py) : g.moveTo(xx + px, y + py))); g.closePath();
        g.fillStyle = c; g.fill();
        g.save(); g.clip();
        const gr = g.createLinearGradient(xx, y, xx, y + RH); gr.addColorStop(0, "rgba(255,248,225,0.22)"); gr.addColorStop(0.5, "rgba(255,248,225,0)"); gr.addColorStop(1, "rgba(80,55,30,0.22)");
        g.fillStyle = gr; g.fillRect(xx, y, w, RH);
        g.restore();
      });
      x += w + U(r, 2, 6);
    }
  }
  speck(g, r, S, S, 260, [1, 2.4], ["rgba(90,70,45,0.4)", "rgba(245,235,210,0.35)", "rgba(150,160,100,0.3)"]);
});
/** straw: dense yellow strokes, 512 px = 1 m */
export const strawHD = () => ctex("mgStraw", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#b8923f"; g.fillRect(0, 0, S, S);
  g.lineCap = "round";
  for (let i = 0; i < 2200; i++) {
    const x = r() * S, y = r() * S, a = U(r, -0.6, 0.6) + (r() < 0.5 ? 0 : Math.PI / 2), l = U(r, 14, 40);
    const c = pick(r, ["rgba(240,205,110,0.8)", "rgba(210,170,80,0.8)", "rgba(160,120,50,0.7)", "rgba(250,225,150,0.8)"]);
    wrap2(S, S, x, y, l, (X, Y) => { g.strokeStyle = c; g.lineWidth = U(r, 1.5, 3); g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke(); });
  }
});

// ------------------------------------------------------------------------------------------- olives + sea
/** olive canopy (unit sphere, 256 x 128): silvery grey-green, darker belly, lance-leaf dabs light + dark */
export const oliveTex = (i: number) => ctex("mgOlive" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(["#8a9662", "#7f8c5a", "#94a06e"][i % 3]);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + base.clone().offsetHSL(0, -0.02, 0.09).getHexString()); gr.addColorStop(0.45, "#" + base.getHexString()); gr.addColorStop(1, "#" + base.clone().offsetHSL(0.01, 0, -0.1).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.lineCap = "round";
  for (let k = 0; k < 220; k++) {
    const x = r() * 256, y = 6 + r() * 116, a = U(r, -0.9, 0.9), l = U(r, 4, 8), light = y < 64 ? r() < 0.6 : r() < 0.25;
    for (const ox of [-256, 0, 256]) { g.strokeStyle = light ? "rgba(215,225,190,0.5)" : "rgba(45,60,30,0.35)"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
});
export const barkHD = () => ctex("mgBark", 256, 256, (g, r) => {
  g.fillStyle = "#6e6050"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) grainStroke(g, r, r() * 256, 0, 256, U(r, 3, 9), r() < 0.5 ? "rgba(40,32,25,0.45)" : "rgba(170,155,135,0.3)", U(r, 1.5, 4));
});
export const seaHD = () => ctex("mgSea", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#4f86b8"; g.fillRect(0, 0, S, S);
  mottle(g, r, S, S, 30, [60, 200], "40,90,140", "130,180,220", [0.3, 0.25]);
  g.lineCap = "round";
  for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S, l = U(r, 8, 30); g.strokeStyle = r() < 0.7 ? "rgba(225,240,255,0.55)" : "rgba(255,255,255,0.9)"; g.lineWidth = U(r, 1.5, 3); wrap2(S, S, x, y, l, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + l, Y); g.stroke(); }); }
});
/** distant hill: dry scrub (macchia) over ochre ground (512 px, tiles at ~40 m) */
export const hillHD = () => ctex("mgHill", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#a99560"; g.fillRect(0, 0, S, S);
  mottle(g, r, S, S, 30, [20, 80], "90,95,50", "210,190,130", [0.4, 0.25]);
  for (let i = 0; i < 500; i++) { const x = r() * S, y = r() * S, q = U(r, 3, 9); g.fillStyle = r() < 0.7 ? "rgba(92,104,58,0.75)" : "rgba(70,82,45,0.75)"; wrap2(S, S, x, y, q, (X, Y) => { g.beginPath(); g.arc(X, Y, q, 0, TAU); g.fill(); }); }
});
/** amphora / pithos terracotta with a dark painted band pattern (no figures), 256 x 256 (u around, v up) */
export const potHD = (key: string, base: string) => ctex("mgPot" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  mottle(g, r, 256, 256, 10, [20, 60], "110,60,35", "250,210,170", [0.12, 0.1]);
  g.fillStyle = "rgba(40,22,15,0.8)"; g.fillRect(0, 96, 256, 7); g.fillRect(0, 110, 256, 3); g.fillRect(0, 170, 256, 5);
});
