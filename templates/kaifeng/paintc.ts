// CAMP painted textures (owner: the "camp" agent): Canvas2D painted maps for the Mongol side: trebuchet timber and
// lashed poles, rope, leather, boulders, the millstone, patched cowhide, yurt felt + trims + doors, carpet, horse-hair
// tassels, pennants, cart wheels, the scorch. All cached through paint.ts ctex (drawn once).
import * as THREE from "three";
import { ctex, U, TAU, R, G, blotch, wrapX, wrap2, jit, pick } from "./paint";

/** long soft grain stroke along canvas y (vertical), seamless in y */
const grainV = (g: G, r: R, H: number, x: number, y: number, len: number, amp: number, lw: number, col: string) => {
  const n = Math.max(2, Math.round(len / 160));
  const dx = Array.from({ length: n + 1 }, () => (r() - 0.5) * 2 * amp);
  for (const oy of [0, -H, H]) {
    const yy = y + oy;
    if (yy + len < 0 || yy > H) continue;
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round";
    g.beginPath(); g.moveTo(x + dx[0], yy);
    for (let i = 1; i <= n; i++) {
      const y1 = yy + (len * i) / n;
      g.quadraticCurveTo(x + (dx[i - 1] + dx[i]) / 2 + (i % 2 ? 0.3 : -0.3) * amp, y1 - len / n / 2, x + dx[i], y1);
    }
    g.stroke();
  }
};

/** squared timber (trebuchet trestle, carts): grain runs along v (the timber's length). 256 x 1024 */
export const timberC = (key = "cTimber", fills = ["#b07c4a", "#a87446", "#b8854f", "#a06d40"]) => ctex(key, 256, 1024, (g, r) => {
  const W = 256, H = 1024;
  g.fillStyle = pick(r, fills); g.fillRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) { // broad tone drift
    const y = U(r, 0, H), rad = U(r, 60, 140), light = r() > 0.5;
    wrap2(W, H, U(r, 0, W), y, rad * 3, (xx, yy) => { g.save(); g.translate(xx, yy); g.scale(1, 3); g.translate(-xx, -yy); blotch(g, xx, yy, rad, 1, light ? "255,236,200" : "100,55,20", light ? 0.14 : 0.12); g.restore(); });
  }
  for (let k = 0; k < 16; k++) {
    const light = r() < 0.3;
    grainV(g, r, H, U(r, 6, W - 6), U(r, 0, H), U(r, 300, 900), U(r, 2, 6), U(r, 2, 3.5), light ? "rgba(255,232,195,0.22)" : "rgba(80,40,14,0.32)");
  }
  for (let k = 0; k < 2; k++) { // knots
    const kx = U(r, 50, W - 50), ky = U(r, 80, H - 80), rx = U(r, 10, 16), ry = rx * 1.8;
    g.fillStyle = "rgba(120,66,28,0.35)"; g.beginPath(); g.ellipse(kx, ky, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(70,35,12,0.6)"; g.lineWidth = 3; g.stroke();
    g.strokeStyle = "rgba(110,60,25,0.25)"; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, rx * 2.2, ry * 2.0, 0, 0, TAU); g.stroke();
  }
  // adze marks: short pale chips across the face
  for (let k = 0; k < 10; k++) { g.fillStyle = "rgba(255,235,200,0.12)"; g.fillRect(U(r, 0, W - 40), U(r, 0, H), U(r, 20, 40), 3); }
  // arris shading on the long edges (u = 0 / 1 meet the next face): a darker rim so the timbers read chunky
  const e = g.createLinearGradient(0, 0, W, 0);
  e.addColorStop(0, "rgba(60,28,8,0.28)"); e.addColorStop(0.08, "rgba(60,28,8,0)"); e.addColorStop(0.92, "rgba(60,28,8,0)"); e.addColorStop(1, "rgba(60,28,8,0.28)");
  g.fillStyle = e; g.fillRect(0, 0, W, H);
});

/** lashed beam poles: rounder, darker, bark streaks along v. 256 x 1024 */
export const poleC = () => ctex("cPole", 256, 1024, (g, r) => {
  const W = 256, H = 1024;
  g.fillStyle = "#8f5f37"; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 26; k++) {
    const light = r() < 0.35;
    grainV(g, r, H, U(r, 0, W), U(r, 0, H), U(r, 200, 700), U(r, 2, 5), U(r, 2, 5), light ? "rgba(235,190,130,0.25)" : "rgba(60,30,10,0.35)");
  }
  for (let k = 0; k < 7; k++) { // branch stubs / knots
    const kx = U(r, 20, W - 20), ky = U(r, 20, H - 20);
    g.fillStyle = "rgba(55,28,10,0.55)"; g.beginPath(); g.ellipse(kx, ky, 7, 11, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(220,170,110,0.4)"; g.beginPath(); g.ellipse(kx, ky, 3, 5, 0, 0, TAU); g.fill();
  }
});

/** twisted rope: diagonal strands. 128 x 128 (repeat along the rope) */
export const ropeC = (key = "cRope", base = "#c9a873", dark = "#8a6a40") => ctex(key, 128, 128, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = -4; i < 8; i++) {
    const x = i * 32;
    g.strokeStyle = dark; g.lineWidth = 7;
    g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 128, 0); g.stroke();
    g.strokeStyle = "rgba(255,240,200,0.35)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + 12, 128); g.lineTo(x + 140, 0); g.stroke();
  }
});

/** leather (sling pouch, saddles, straps) */
export const leatherC = () => ctex("cLeather", 256, 256, (g, r) => {
  g.fillStyle = "#7a4a2a"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 40; k++) blotch(g, U(r, 0, 256), U(r, 0, 256), U(r, 10, 40), 1.4, r() > 0.5 ? "150,95,55" : "50,25,10", 0.2);
  g.strokeStyle = "rgba(240,210,160,0.5)"; g.lineWidth = 3; g.setLineDash([10, 8]);
  g.strokeRect(14, 14, 228, 228); g.setLineDash([]);
});

/** boulder: speckled warm grey-brown, a few lighter chips + dark pits. 256 x 256 */
export const boulderC = () => ctex("cBoulder", 256, 256, (g, r) => {
  g.fillStyle = "#a08f78"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 18; k++) wrap2(256, 256, U(r, 0, 256), U(r, 0, 256), 60, (x, y) => blotch(g, x, y, U(r, 25, 60), 1.2, r() > 0.5 ? "205,190,165" : "95,80,62", 0.28));
  for (let k = 0; k < 260; k++) { g.fillStyle = r() > 0.5 ? "rgba(70,58,46,0.45)" : "rgba(235,225,205,0.4)"; const s = U(r, 1.5, 3.5); g.fillRect(U(r, 0, 256), U(r, 0, 256), s, s); }
  for (let k = 0; k < 6; k++) { // hairline cracks
    g.strokeStyle = "rgba(60,48,38,0.45)"; g.lineWidth = 1.6; g.beginPath();
    let x = U(r, 0, 256), y = U(r, 0, 256); g.moveTo(x, y);
    for (let i = 0; i < 4; i++) { x += U(r, -22, 22); y += U(r, -22, 22); g.lineTo(x, y); }
    g.stroke();
  }
});

/** millstone top (planar cap uv, 512 = 2 R): grey grit stone, the eye, 8 harp sectors of dressing furrows */
export const millTopC = () => ctex("cMillTop", 512, 512, (g, r) => {
  const S = 512, c = S / 2, R0 = 250, eye = 46;
  g.fillStyle = "#a9a49b"; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 30; k++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 30, 80), 1, r() > 0.5 ? "205,200,190" : "110,105,98", 0.22);
  for (let k = 0; k < 900; k++) { g.fillStyle = r() > 0.5 ? "rgba(60,58,55,0.4)" : "rgba(240,236,228,0.35)"; const s = U(r, 1.5, 3); g.fillRect(U(r, 0, S), U(r, 0, S), s, s); }
  // harp dressing: in each of 8 sectors, furrows parallel to the sector's leading edge
  const N = 8;
  for (let s = 0; s < N; s++) {
    const a0 = (s / N) * TAU, a1 = ((s + 1) / N) * TAU;
    g.save(); g.beginPath(); g.moveTo(c, c); g.arc(c, c, R0 - 14, a0, a1); g.closePath(); g.clip();
    const lx = Math.cos(a0), ly = Math.sin(a0), nx = -ly, ny = lx; // leading edge dir + its normal (into the sector)
    for (let j = 0; j < 9; j++) {
      const off = 12 + j * 19, w = j === 0 ? 9 : 5;
      g.strokeStyle = j === 0 ? "rgba(55,52,50,0.85)" : "rgba(70,66,62,0.6)"; g.lineWidth = w;
      g.beginPath(); g.moveTo(c + nx * off - lx * 40, c + ny * off - ly * 40); g.lineTo(c + nx * off + lx * 300, c + ny * off + ly * 300); g.stroke();
      g.strokeStyle = "rgba(235,230,220,0.35)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(c + nx * (off + w * 0.7) - lx * 40, c + ny * (off + w * 0.7) - ly * 40); g.lineTo(c + nx * (off + w * 0.7) + lx * 300, c + ny * (off + w * 0.7) + ly * 300); g.stroke();
    }
    g.restore();
  }
  // flat skirt ring + the eye
  g.strokeStyle = "rgba(200,196,188,0.9)"; g.lineWidth = 18; g.beginPath(); g.arc(c, c, R0 - 9, 0, TAU); g.stroke();
  g.strokeStyle = "rgba(60,56,52,0.7)"; g.lineWidth = 4; g.beginPath(); g.arc(c, c, R0 - 1, 0, TAU); g.stroke();
  g.fillStyle = "#4a4540"; g.beginPath(); g.arc(c, c, eye + 10, 0, TAU); g.fill();
  g.fillStyle = "#2a2622"; g.beginPath(); g.arc(c, c, eye, 0, TAU); g.fill();
});

/** millstone rim / broken faces: grit stone speckle. 256 x 256 */
export const millSideC = () => ctex("cMillSide", 256, 256, (g, r) => {
  g.fillStyle = "#9d988f"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 400; k++) { g.fillStyle = r() > 0.5 ? "rgba(60,58,55,0.45)" : "rgba(240,236,228,0.35)"; const s = U(r, 1.5, 3.5); g.fillRect(U(r, 0, 256), U(r, 0, 256), s, s); }
  for (let k = 0; k < 10; k++) blotch(g, U(r, 0, 256), U(r, 0, 256), U(r, 20, 50), 1, r() > 0.5 ? "200,195,185" : "100,95,90", 0.25);
});

/** patched cowhide (tents): canvas x = along the shell (2.4 m), y = around the half barrel. 1024 x 512 */
export const hideC = () => ctex("cHide", 1024, 512, (g, r) => {
  const W = 1024, H = 512;
  const kinds = ["white", "brown", "tan", "white", "spotted", "brown"];
  // patch grid with jittered corners (stitched panels)
  const nx = 4, ny = 3, px: number[][] = [], py: number[][] = [];
  for (let j = 0; j <= ny; j++) { px.push([]); py.push([]); for (let i = 0; i <= nx; i++) {
    const ex = i === 0 || i === nx, ey = j === 0 || j === ny;
    px[j].push((i / nx) * W + (ex ? 0 : U(r, -50, 50))); py[j].push((j / ny) * H + (ey ? 0 : U(r, -35, 35)));
  } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = pick(r, kinds);
    g.save(); g.beginPath();
    g.moveTo(px[j][i], py[j][i]); g.lineTo(px[j][i + 1], py[j][i + 1]); g.lineTo(px[j + 1][i + 1], py[j + 1][i + 1]); g.lineTo(px[j + 1][i], py[j + 1][i]); g.closePath(); g.clip();
    const base = k === "white" || k === "spotted" ? jit(r, "#ece3d0", 0.04) : k === "brown" ? jit(r, "#8a5530", 0.08) : jit(r, "#c08a52", 0.08);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let q = 0; q < 8; q++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 40, 110), 1.3, k === "brown" ? "60,32,15" : "120,90,60", 0.14); // hair tone
    if (k === "white" || k === "spotted") { // cow spots: big irregular dark patches
      const n = k === "spotted" ? 6 : 3;
      for (let q = 0; q < n; q++) {
        const cx = U(r, 0, W), cy = U(r, 0, H), rad = U(r, 30, 75), col = r() > 0.4 ? "#2e2420" : "#6b3d22";
        g.fillStyle = col; g.beginPath();
        for (let a = 0; a < 12; a++) { const t = (a / 12) * TAU, rr2 = rad * U(r, 0.6, 1.25); const X = cx + Math.cos(t) * rr2 * 1.3, Y = cy + Math.sin(t) * rr2; if (a) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.closePath(); g.fill();
      }
    }
    // hair strokes
    for (let q = 0; q < 120; q++) { const x = U(r, 0, W), y = U(r, 0, H); g.strokeStyle = k === "brown" ? "rgba(40,20,8,0.18)" : "rgba(90,70,50,0.12)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + U(r, 6, 14), y + U(r, -3, 3)); g.stroke(); }
    g.restore();
  }
  // seams: dark overlap line + cross stitches
  const seam = (x0: number, y0: number, x1: number, y1: number) => {
    g.strokeStyle = "rgba(45,25,12,0.75)"; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / 16), tx = (x1 - x0) / L, ty = (y1 - y0) / L;
    g.strokeStyle = "#e9d7a8"; g.lineWidth = 2.5;
    for (let s = 0; s < n; s++) { const x = x0 + tx * (s + 0.5) * 16, y = y0 + ty * (s + 0.5) * 16; g.beginPath(); g.moveTo(x - ty * 7 - tx * 3, y + tx * 7 - ty * 3); g.lineTo(x + ty * 7 + tx * 3, y - tx * 7 + ty * 3); g.stroke(); }
  };
  for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) if (j > 0 && j < ny) seam(px[j][i], py[j][i], px[j][i + 1], py[j][i + 1]);
  for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) seam(px[j][i], py[j][i], px[j + 1][i], py[j + 1][i]);
  // ragged dark hem along the rims (canvas y = 0 and H are the two bottom edges of the half barrel)
  for (const y0 of [0, H - 16]) { g.fillStyle = "rgba(50,28,14,0.6)"; g.fillRect(0, y0, W, 16); }
});

/** yurt wall felt: cream wool felt, quilting stitch rows, dust toward the bottom (canvas top = wall top). 512 x 256 */
export const feltC = (key = "cFelt", base = "#eee4cf") => ctex(key, 512, 256, (g, r) => {
  const W = 512, H = 256;
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) wrap2(W, H, U(r, 0, W), U(r, 0, H), 50, (x, y) => blotch(g, x, y, U(r, 20, 50), 1.6, r() > 0.5 ? "255,250,238" : "175,160,130", 0.18));
  for (let k = 0; k < 500; k++) { g.fillStyle = "rgba(150,135,105,0.18)"; g.fillRect(U(r, 0, W), U(r, 0, H), U(r, 2, 6), 1.5); }
  g.strokeStyle = "rgba(140,120,90,0.45)"; g.lineWidth = 1.6; g.setLineDash([6, 6]);
  for (let y = 22; y < H; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.setLineDash([]);
  // panel seams (felt sheets) every quarter
  for (let i = 0; i < 4; i++) { const x = (i / 4) * W + 30; g.fillStyle = "rgba(120,100,70,0.25)"; g.fillRect(x, 0, 4, H); }
  const d = g.createLinearGradient(0, H * 0.6, 0, H);
  d.addColorStop(0, "rgba(150,115,70,0)"); d.addColorStop(1, "rgba(150,115,70,0.45)");
  g.fillStyle = d; g.fillRect(0, H * 0.6, W, H * 0.4);
});

/** decorative band (eave trim): blue field with a white key (meander) pattern, red edges. 512 x 64, repeat in u */
export const keyBandC = (key = "cKeyBand", field = "#2f5f9f", line = "#f2ead6", edge = "#b8402e") => ctex(key, 512, 64, (g) => {
  g.fillStyle = field; g.fillRect(0, 0, 512, 64);
  g.fillStyle = edge; g.fillRect(0, 0, 512, 9); g.fillRect(0, 55, 512, 9);
  g.strokeStyle = line; g.lineWidth = 5; g.lineCap = "square";
  for (let x = 0; x < 512; x += 32) { // key fret
    g.beginPath(); g.moveTo(x + 4, 46); g.lineTo(x + 4, 18); g.lineTo(x + 26, 18); g.lineTo(x + 26, 38); g.lineTo(x + 14, 38); g.lineTo(x + 14, 28); g.stroke();
    g.beginPath(); g.moveTo(x + 26, 46); g.lineTo(x + 36, 46); g.stroke();
  }
});

/** yurt door: orange-red planks, blue + green geometric panels, gold studs. 256 x 384 */
export const doorC = (key = "cDoor", seed = 0) => ctex(key + seed, 256, 384, (g, r) => {
  const W = 256, H = 384;
  const field = ["#c8502e", "#d4622a", "#b8402e"][seed % 3], pan = ["#2f5f9f", "#2a7a78", "#2f5f9f"][seed % 3];
  g.fillStyle = field; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#5a2414"; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12);
  g.fillStyle = "#e4b84a"; g.fillRect(16, 16, W - 32, 8); g.fillRect(16, H - 24, W - 32, 8);
  for (const [y0, y1] of [[40, 170], [210, 350]]) {
    g.fillStyle = pan; g.fillRect(34, y0, W - 68, y1 - y0);
    g.strokeStyle = "#f2ead6"; g.lineWidth = 5; g.strokeRect(44, y0 + 10, W - 88, y1 - y0 - 20);
    // khee knot: interlocking square + diamond
    const cx = W / 2, cy = (y0 + y1) / 2, s = 30;
    g.strokeStyle = "#e4b84a"; g.lineWidth = 6;
    g.strokeRect(cx - s, cy - s, 2 * s, 2 * s);
    g.beginPath(); g.moveTo(cx, cy - s * 1.45); g.lineTo(cx + s * 1.45, cy); g.lineTo(cx, cy + s * 1.45); g.lineTo(cx - s * 1.45, cy); g.closePath(); g.stroke();
    g.fillStyle = "#c8502e"; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
  }
  for (const [x, y] of [[22, 30], [W - 22, 30], [22, H - 30], [W - 22, H - 30], [22, H / 2], [W - 22, H / 2]]) {
    g.fillStyle = "#e4b84a"; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
  }
  void r;
});

/** red carpet with blue + gold borders and a medallion (Subutai's post). 512 x 384 */
export const carpetC = () => ctex("cCarpet", 512, 384, (g, r) => {
  const W = 512, H = 384;
  g.fillStyle = "#a8322a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#1f3f73"; g.fillRect(0, 0, W, 44); g.fillRect(0, H - 44, W, 44); g.fillRect(0, 0, 44, H); g.fillRect(W - 44, 0, 44, H);
  g.strokeStyle = "#e4b84a"; g.lineWidth = 6; g.strokeRect(50, 50, W - 100, H - 100); g.strokeRect(22, 22, W - 44, H - 44);
  g.fillStyle = "#e4b84a";
  for (let x = 30; x < W; x += 34) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 9, 22); g.lineTo(x, 36); g.lineTo(x - 9, 22); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, H - 8); g.lineTo(x + 9, H - 22); g.lineTo(x, H - 36); g.lineTo(x - 9, H - 22); g.closePath(); g.fill(); }
  const cx = W / 2, cy = H / 2;
  g.fillStyle = "#1f3f73"; g.beginPath(); g.ellipse(cx, cy, 110, 80, 0, 0, TAU); g.fill();
  g.strokeStyle = "#e4b84a"; g.lineWidth = 6; g.stroke();
  g.fillStyle = "#e4b84a"; g.beginPath(); g.moveTo(cx, cy - 55); g.lineTo(cx + 55, cy); g.lineTo(cx, cy + 55); g.lineTo(cx - 55, cy); g.closePath(); g.fill();
  g.fillStyle = "#a8322a"; g.beginPath(); g.arc(cx, cy, 20, 0, TAU); g.fill();
  for (let k = 0; k < 30; k++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 20, 60), 1.3, "40,10,8", 0.08); // wear
});

/** horse-hair tassel strands (along v, canvas top = tassel top). 128 x 256 */
export const hairC = (key: string, base: string, dark: string, light: string) => ctex(key, 128, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 70; k++) {
    const x = U(r, 0, 128), light2 = r() < 0.35;
    g.strokeStyle = light2 ? light : dark; g.lineWidth = U(r, 1.5, 3.5);
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + U(r, -8, 8), 128, x + U(r, -10, 10), 256); g.stroke();
  }
});

/** pennant / war banner cloth: Mongol blue or teal with a contrasting border and a flame-disc emblem. 256 x 128 */
export const pennantC = (key: string, field: string, border: string) => ctex(key, 256, 128, (g, r) => {
  g.fillStyle = field; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 10; k++) blotch(g, U(r, 0, 256), U(r, 0, 128), U(r, 20, 50), 2, "255,255,255", 0.06);
  g.fillStyle = border; g.fillRect(0, 0, 256, 12); g.fillRect(0, 116, 256, 12); g.fillRect(0, 0, 14, 128);
  const cx = 70, cy = 64;
  g.fillStyle = "#f2ead6"; g.beginPath(); g.arc(cx, cy, 24, 0, TAU); g.fill();
  g.fillStyle = border; g.beginPath(); g.moveTo(cx, cy - 46); g.quadraticCurveTo(cx + 14, cy - 30, cx, cy - 22); g.quadraticCurveTo(cx - 14, cy - 30, cx, cy - 46); g.fill();
  g.fillStyle = field; g.beginPath(); g.arc(cx, cy, 11, 0, TAU); g.fill();
});

/** hanging war banner (vertical cloth, canvas top = crossbar): Mongol blue field, gold border, white disc + flame. 128 x 256 */
export const warBannerC = (key: string, field: string, border: string) => ctex(key, 128, 256, (g, r) => {
  g.fillStyle = field; g.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 8; k++) blotch(g, U(r, 0, 128), U(r, 0, 256), U(r, 20, 50), 0.6, "255,255,255", 0.06);
  for (let x = 0; x < 128; x++) { const s = Math.sin((x / 128) * 4 * TAU); g.fillStyle = s > 0 ? `rgba(255,255,255,${0.07 * s})` : `rgba(0,10,30,${-0.1 * s})`; g.fillRect(x, 0, 1, 256); }
  g.fillStyle = border; g.fillRect(0, 0, 128, 18); g.fillRect(0, 0, 10, 256); g.fillRect(118, 0, 10, 256);
  g.strokeStyle = border; g.lineWidth = 4; g.strokeRect(18, 28, 92, 200);
  const cx = 64, cy = 100;
  g.fillStyle = "#f2ead6"; g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.fill();
  g.fillStyle = border; g.beginPath(); g.moveTo(cx, cy - 18); g.quadraticCurveTo(cx + 15, cy, cx, cy + 14); g.quadraticCurveTo(cx - 15, cy, cx, cy - 18); g.fill();
  g.fillStyle = field; g.beginPath(); g.arc(cx, cy + 3, 5, 0, TAU); g.fill();
  for (let i = 0; i < 3; i++) { g.fillStyle = "#f2ead6"; g.fillRect(cx - 18 + i * 14, 160, 8, 8); }
});

/** cart wheel: spoked disc with alpha (cut-out), 256 x 256 */
export const wheelC = () => ctex("cWheel", 256, 256, (g) => {
  const c = 128;
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "#6e4526"; g.lineWidth = 26; g.beginPath(); g.arc(c, c, 112, 0, TAU); g.stroke();
  g.strokeStyle = "#3a2010"; g.lineWidth = 4; g.beginPath(); g.arc(c, c, 124, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, 99, 0, TAU); g.stroke();
  g.strokeStyle = "#8a5a32"; g.lineWidth = 13;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 24, c + Math.sin(a) * 24); g.lineTo(c + Math.cos(a) * 104, c + Math.sin(a) * 104); g.stroke(); }
  g.fillStyle = "#5a3418"; g.beginPath(); g.arc(c, c, 30, 0, TAU); g.fill();
  g.fillStyle = "#2a2a2e"; g.beginPath(); g.arc(c, c, 13, 0, TAU); g.fill();
});

/** ground scorch: dark soot centre, ragged edge, soft alpha. 256 x 256 */
export const scorchC = () => ctex("cScorch", 256, 256, (g, r) => {
  const c = 128;
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = "rgba(30,22,18,0.85)"; g.beginPath();
  for (let a = 0; a <= 28; a++) { const t = (a / 28) * TAU, rr2 = U(r, 70, 118); const X = c + Math.cos(t) * rr2, Y = c + Math.sin(t) * rr2; if (a) g.lineTo(X, Y); else g.moveTo(X, Y); }
  g.closePath(); g.fill();
  const gr = g.createRadialGradient(c, c, 0, c, c, 90);
  gr.addColorStop(0, "rgba(10,8,8,0.9)"); gr.addColorStop(1, "rgba(10,8,8,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 18; k++) { // soot spikes
    const t = U(r, 0, TAU), r0 = U(r, 80, 100), r1 = U(r, 110, 126);
    g.strokeStyle = "rgba(30,22,18,0.6)"; g.lineWidth = U(r, 4, 10); g.lineCap = "round";
    g.beginPath(); g.moveTo(c + Math.cos(t) * r0, c + Math.sin(t) * r0); g.lineTo(c + Math.cos(t) * r1, c + Math.sin(t) * r1); g.stroke();
  }
});

/** straw / hay */
export const hayC = () => ctex("cHay", 256, 256, (g, r) => {
  g.fillStyle = "#d9b45a"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 260; k++) {
    const x = U(r, 0, 256), y = U(r, 0, 256), a = U(r, -0.6, 0.6), l = U(r, 14, 34);
    g.strokeStyle = r() > 0.5 ? "rgba(140,100,30,0.55)" : "rgba(255,235,160,0.6)"; g.lineWidth = U(r, 1.5, 3);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
});

/** soft radial glow sprite (fires at night, the fireball halo) */
export const glowC = () => ctex("cGlow", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

/** a texture clone with its own repeat (wrap on) */
export const repC = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.repeat.set(x, y); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c; };
void wrapX;
