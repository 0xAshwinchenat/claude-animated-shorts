// Painted Canvas2D textures for the city of Kaifeng (owner: the "wall" agent): rammed-earth wall faces (pounded
// layers, putlog holes, weathering), walkway earth, loess plain, grey tube-tile roofs, palace-red wood, plank walls with
// slits, studded gate doors, dents, rubble, plaster house walls, palace walls, felt, straw, the Taihu rock, jars, sacks.
// All tile seamlessly (wrapX / wrap2) unless noted. Colours are ALBEDOS: the two-tone light (~x1.2 lit) and the grade
// lift saturation, so earth tones are painted a little greyer than their on-screen targets.
import * as THREE from "three";
import { ctex, rep, wrapX, wrap2, blotch, U, TAU, R, G } from "./paint";

export { rep };
const rgba = (c: string, a: number) => { const k = new THREE.Color(c); return `rgba(${Math.round(k.r * 255)},${Math.round(k.g * 255)},${Math.round(k.b * 255)},${a})`; };
/** periodic wobble across a tile of width W (integer wave numbers, so x = 0 and x = W match) */
const wob = (r: R, W: number, amp: number) => {
  const ks = [1 + Math.floor(r() * 3), 3 + Math.floor(r() * 4), 7 + Math.floor(r() * 6)], ph = ks.map(() => r() * TAU), am = [amp, amp * 0.45, amp * 0.18];
  return (x: number) => ks.reduce((s, k, i) => s + am[i] * Math.sin((TAU * k * x) / W + ph[i]), 0);
};
const speck = (g: G, r: R, S: number, n: number, rad: [number, number], cols: string[]) => {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, q = U(r, rad[0], rad[1]), c = cols[Math.floor(r() * cols.length)];
    g.fillStyle = c; wrap2(S, S, x, y, q, (X, Y) => { g.beginPath(); g.ellipse(X, Y, q, q * U(r, 0.6, 1), r() * 3, 0, TAU); g.fill(); });
  }
};

// ------------------------------------------------------------------------------------------- rammed-earth face
/** 2048 px = 4.8 m x 4.8 m (427 texels/m). Pounded layers 8-12 cm, alternating a touch lighter / darker, each a little
 *  lighter on top (pounded) and darker at its foot, faintly wavy boundaries; formwork lifts every 1.2 m with a row of
 *  square putlog (tie) holes and a few vertical form joints; pebbles; soft weathering streaks under the holes. */
export const WALL_TILE = 4.8;
export const earthWallHD = (key = "earthWallHD", base = "#c2a275") => ctex(key, 2048, 2048, (g, r) => {
  const S = 2048, PPM = S / WALL_TILE, B = new THREE.Color(base);
  const tone = (dl: number, ds = 0) => { const c = B.clone().offsetHSL(0, ds, dl); return "#" + c.getHexString(); };
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // layer thicknesses (8-12 cm), scaled to fill the tile exactly
  const th: number[] = []; let tot = 0;
  while (tot < S - 30) { const t = U(r, 0.08, 0.12) * PPM; th.push(t); tot += t; }
  const k = S / tot;
  let y = 0;
  const lines: ((x: number) => number)[] = [];
  for (let i = 0; i < th.length; i++) lines.push(wob(r, S, U(r, 1.5, 4.5)));
  lines.push(lines[0]);
  for (let i = 0; i < th.length; i++) {
    const t = th[i] * k, top = lines[i], bot = lines[i + 1], y0 = y, y1 = y + t;
    const dl = (i % 2 ? -0.028 : 0.022) + U(r, -0.015, 0.015);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, tone(dl + 0.03)); gr.addColorStop(0.5, tone(dl)); gr.addColorStop(1, tone(dl - 0.045, 0.02));
    for (const oy of [0, -S, S]) {
      g.save(); g.translate(0, oy);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, y0 + top(0));
      for (let x = 0; x <= S; x += 32) g.lineTo(x, y0 + top(x));
      for (let x = S; x >= 0; x -= 32) g.lineTo(x, y1 + bot(x));
      g.closePath(); g.fill();
      // boundary: a soft dark seam with a light lip under it
      g.strokeStyle = rgba(tone(-0.2, 0.05), U(r, 0.3, 0.5)); g.lineWidth = U(r, 1.6, 2.8);
      g.beginPath(); for (let x = 0; x <= S; x += 32) g.lineTo(x, y1 + bot(x)); g.stroke();
      g.strokeStyle = "rgba(255,240,210,0.16)"; g.lineWidth = 2;
      g.beginPath(); for (let x = 0; x <= S; x += 32) g.lineTo(x, y1 + bot(x) + 2.5); g.stroke();
      g.restore();
    }
    y = y1;
  }
  // broad mottling (low contrast)
  for (let i = 0; i < 40; i++) {
    const x = r() * S, yy = r() * S, rad = U(r, 80, 260), dark = r() < 0.5;
    wrap2(S, S, x, yy, rad * 2.2, (X, Y) => blotch(g, X, Y, rad, U(r, 1.2, 2.2), dark ? "90,60,35" : "250,230,190", dark ? 0.06 : 0.07));
  }
  // pebbles + pores
  speck(g, r, S, 2600, [1, 2.4], [rgba(tone(-0.16), 0.35), rgba(tone(-0.24), 0.25), "rgba(255,245,220,0.3)"]);
  for (let i = 0; i < 160; i++) {
    const x = r() * S, yy = r() * S, q = U(r, 3, 6);
    wrap2(S, S, x, yy, q + 3, (X, Y) => {
      g.fillStyle = rgba("#a39684", 0.6); g.beginPath(); g.ellipse(X, Y, q, q * 0.75, r(), 0, TAU); g.fill();
      g.fillStyle = "rgba(255,250,235,0.3)"; g.beginPath(); g.ellipse(X - q * 0.3, Y - q * 0.3, q * 0.35, q * 0.25, 0, 0, TAU); g.fill();
    });
  }
  // formwork lifts: every 1.2 m a faint step line, 2 vertical form joints per lift (staggered), putlog holes
  const LIFT = 1.2 * PPM, H = 0.12 * PPM;
  for (let L = 0; L < 4; L++) {
    const ly = L * LIFT + 6;
    g.fillStyle = rgba(tone(-0.25), 0.22); g.fillRect(0, ly, S, 3);
    for (let j = 0; j < 2; j++) {
      const jx = ((L * 0.37 + j * 0.5 + U(r, -0.05, 0.05)) % 1) * S;
      g.fillStyle = rgba(tone(-0.22), 0.16); wrapX(S, jx, 3, (X) => g.fillRect(X, ly, 3, LIFT));
    }
    const hy = ly + LIFT * U(r, 0.35, 0.6);
    const nH = 3, ph = r();
    for (let j = 0; j < nH; j++) {
      const roll = r();
      if (roll < 0.22) continue;                                               // missing (eroded / filled)
      const hx = ((j + ph + U(r, -0.18, 0.18)) / nH) * S, hh = H * U(r, 0.65, 0.95), yy = hy + U(r, -12, 12);
      // a short soft weathering stain under the hole (wraps in y), on some holes only
      if (r() < 0.6) {
        const sl = U(r, 80, 300), sw = hh * U(r, 0.4, 0.9);
        for (const oy of [0, -S]) {
          const gs = g.createLinearGradient(0, yy + hh + oy, 0, yy + hh + sl + oy);
          gs.addColorStop(0, rgba(tone(-0.22), 0.18)); gs.addColorStop(1, rgba(tone(-0.22), 0));
          g.fillStyle = gs; wrapX(S, hx - sw / 2, sw, (X) => g.fillRect(X, yy + hh + oy, sw, sl));
        }
      }
      wrapX(S, hx - hh / 2, hh, (X) => {
        g.fillStyle = "#4a3422"; g.beginPath(); g.moveTo(X + U(r, -3, 3), yy); g.lineTo(X + hh + U(r, -3, 3), yy + U(r, -3, 3));
        g.lineTo(X + hh + U(r, -3, 3), yy + hh); g.lineTo(X + U(r, -3, 3), yy + hh + U(r, -3, 3)); g.closePath(); g.fill();
        g.fillStyle = "rgba(15,8,4,0.6)"; g.fillRect(X + 2, yy + 1, hh - 4, hh * 0.3);                  // top inner shadow
        g.fillStyle = "rgba(255,236,200,0.3)"; g.fillRect(X - 2, yy + hh, hh + 4, 4);                  // lit lower lip
      });
    }
  }
  // long soft weathering streaks (rain wash) + a few lighter wash bands
  for (let i = 0; i < 34; i++) {
    const x = r() * S, w = U(r, 18, 70), y0 = r() * S, len = U(r, 300, 1200), dark = r() < 0.65;
    const col = dark ? "100,68,40" : "250,232,200", a = dark ? U(r, 0.05, 0.1) : U(r, 0.05, 0.09);
    for (const oy of [0, -S]) {
      const gs = g.createLinearGradient(0, y0 + oy, 0, y0 + len + oy);
      gs.addColorStop(0, `rgba(${col},${a})`); gs.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gs; wrapX(S, x, w, (X) => g.fillRect(X, y0 + oy, w, len));
    }
  }
});

/** walkway top: packed earth, 1024 px = 4 m, worn lighter + scuffed, small pebbles */
export const walkHD = () => ctex("walkHD", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#c7aa80"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 50; i++) {
    const x = r() * S, y = r() * S, rad = U(r, 40, 160), d = r() < 0.5;
    wrap2(S, S, x, y, rad * 2, (X, Y) => blotch(g, X, Y, rad, U(r, 1, 2.5), d ? "110,80,50" : "255,240,210", d ? 0.08 : 0.1));
  }
  for (let i = 0; i < 120; i++) { // scuffs (short curved strokes)
    const x = r() * S, y = r() * S, l = U(r, 10, 34);
    g.strokeStyle = r() < 0.5 ? "rgba(120,90,60,0.22)" : "rgba(255,245,220,0.25)"; g.lineWidth = U(r, 2, 4); g.lineCap = "round";
    wrap2(S, S, x, y, l, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + l / 2, Y + U(r, -6, 6), X + l, Y + U(r, -4, 4)); g.stroke(); });
  }
  speck(g, r, S, 1400, [1, 2.4], ["rgba(110,85,60,0.45)", "rgba(255,248,230,0.4)", "rgba(140,130,120,0.6)"]);
});

/** loess plain: 1024 px = 10 m, dusty ochre with dry grass tufts, pebbles, soft patches */
export const loessHD = () => ctex("loessHD", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#c4a77c"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = U(r, 30, 150), t = r();
    wrap2(S, S, x, y, rad * 2.5, (X, Y) => blotch(g, X, Y, rad, U(r, 1, 2.5), t < 0.4 ? "120,90,55" : t < 0.75 ? "255,240,205" : "150,150,90", t < 0.75 ? 0.09 : 0.1));
  }
  g.lineCap = "round";
  for (let i = 0; i < 160; i++) { // dry tufts
    const x = r() * S, y = r() * S, n = 4 + Math.floor(r() * 5);
    wrap2(S, S, x, y, 14, (X, Y) => {
      for (let k = 0; k < n; k++) {
        g.strokeStyle = r() < 0.5 ? "rgba(150,135,80,0.7)" : "rgba(196,180,115,0.7)"; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(X + U(r, -3, 3), Y); g.lineTo(X + U(r, -9, 9), Y - U(r, 5, 13)); g.stroke();
      }
    });
  }
  speck(g, r, S, 1300, [0.8, 2.2], ["rgba(110,85,60,0.5)", "rgba(255,248,230,0.45)", "rgba(130,125,118,0.6)"]);
});

/** rubble (heap core): grey stones + loess dust, 1024 px = 4 m */
export const rubbleHD = () => ctex("rubbleHD", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#8e8070"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) {
    const x = r() * S, y = r() * S, q = U(r, 8, 30), c = new THREE.Color().setHSL(U(r, 0.06, 0.11), U(r, 0.04, 0.12), U(r, 0.3, 0.5), THREE.SRGBColorSpace);
    wrap2(S, S, x, y, q + 4, (X, Y) => {
      g.fillStyle = "#" + c.getHexString(THREE.SRGBColorSpace); g.strokeStyle = "rgba(40,30,25,0.3)"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(X, Y, q, q * U(r, 0.55, 0.9), r() * 3, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,250,240,0.12)"; g.beginPath(); g.ellipse(X - q * 0.25, Y - q * 0.3, q * 0.45, q * 0.25, 0, 0, TAU); g.fill();
    });
  }
  speck(g, r, S, 900, [0.8, 2], ["rgba(60,45,35,0.5)", "rgba(250,240,220,0.4)"]);
});

// ------------------------------------------------------------------------------------------- dents
/** the inside of a crater (a concave bowl; uv 0..1 spans 2.08 radii, so the rim r = 1 sits at 0.48 of the canvas):
 *  darker crushed floor, compaction streaks, a pale crushed ring just inside the rim and a dark inked rim line.
 *  Light and shade come from the bowl geometry. Never a crack. */
export const dentHD = () => ctex("dentHD", 512, 512, (g, r) => {
  const S = 512, c = S / 2, R1 = c * 0.962, rad = (k: number) => k * R1;
  let gr = g.createRadialGradient(c, c, 0, c, c, R1);
  gr.addColorStop(0, "#866443"); gr.addColorStop(0.55, "#937049"); gr.addColorStop(0.76, "#a7825a"); gr.addColorStop(0.86, "#d4b78c");
  gr.addColorStop(0.93, "#c9a97c"); gr.addColorStop(1, "#a88458");
  g.fillStyle = "#b89468"; g.fillRect(0, 0, S, S);
  g.fillStyle = gr; g.beginPath(); g.arc(c, c, R1, 0, TAU); g.fill();
  for (let i = 0; i < 700; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rad(0.8), q = U(r, 1.5, 4.5);
    g.fillStyle = r() < 0.6 ? "rgba(60,38,22,0.35)" : "rgba(235,210,170,0.28)";
    g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, q, q * 0.7, a, 0, TAU); g.fill();
  }
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, d = rad(U(r, 0.8, 0.94)), q = U(r, 3, 8);
    g.fillStyle = r() < 0.7 ? "rgba(240,220,185,0.45)" : "rgba(110,80,50,0.3)";
    g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, q, q * 0.7, a, 0, TAU); g.fill();
  }
  // the upper rim's cast shadow (the city sun is high): a crisp dark crescent across the top of the bowl
  g.save(); g.beginPath(); g.arc(c, c, R1 - 2, 0, TAU); g.clip();
  g.beginPath(); g.rect(0, 0, S, S); g.arc(c + rad(0.06), c + rad(0.4), rad(0.97), 0, TAU, true);
  g.fillStyle = "rgba(58,34,22,0.55)"; g.fill("evenodd");
  g.restore();
  // the inked rim: a dark line, a touch heavier on the upper (shaded) side, broken in a few places
  for (let k = 0; k < 64; k++) {
    const a0 = (k / 64) * TAU, a1 = ((k + 0.94) / 64) * TAU, up = Math.max(0, -Math.sin((a0 + a1) / 2));
    if (r() < 0.06) continue;
    g.strokeStyle = "rgba(38,24,16,0.9)"; g.lineWidth = 5 + 5 * up; g.lineCap = "round";
    g.beginPath(); g.arc(c, c, R1 - 3 - 2 * up, a0, a1); g.stroke();
  }
});

// ------------------------------------------------------------------------------------------- roofs + wood
/** grey tube-tile roof: 1024 px = 2.4 m across (rows of round tubes every 0.3 m running down the slope = canvas y),
 *  lit crowns, dark channels, staggered tile joints. v runs down the slope. */
export const TILE_W = 2.4;
export const tileRoofHD = (key = "tileRoofHD", base = "#7f858d") => ctex(key, 1024, 1024, (g, r) => {
  const S = 1024, P = 128, B = new THREE.Color(base);
  const tone = (dl: number) => "#" + B.clone().offsetHSL(0, 0, dl).getHexString();
  g.fillStyle = tone(-0.2); g.fillRect(0, 0, S, S);
  for (let i = 0; i < S / P; i++) {
    const x0 = i * P;
    // channel (pan tiles) between tubes
    g.fillStyle = tone(-0.1); g.fillRect(x0, 0, P, S);
    for (let y = 0; y < S; y += 90) { g.fillStyle = rgba(tone(-0.28), 0.6); g.fillRect(x0 + 10, y + (i % 2) * 45, P - 20, 4); }
    // the tube: cylinder shading across
    const tw = P * 0.46, tx = x0 + P / 2 - tw / 2;
    const gr = g.createLinearGradient(tx, 0, tx + tw, 0);
    gr.addColorStop(0, tone(-0.16)); gr.addColorStop(0.3, tone(0.07)); gr.addColorStop(0.55, tone(0.02)); gr.addColorStop(1, tone(-0.2));
    g.fillStyle = gr; g.fillRect(tx, 0, tw, S);
    g.fillStyle = "rgba(20,22,28,0.55)"; g.fillRect(tx - 3, 0, 3, S); g.fillRect(tx + tw, 0, 4, S);
    for (let y = U(r, 0, 60); y < S; y += 120) { g.fillStyle = "rgba(20,22,28,0.45)"; g.fillRect(tx, y, tw, 3); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(tx, y + 3, tw, 3); }
  }
  for (let i = 0; i < 30; i++) {
    const x = r() * S, y = r() * S, rad = U(r, 30, 110);
    wrap2(S, S, x, y, rad * 2, (X, Y) => blotch(g, X, Y, rad, 1.4, r() < 0.5 ? "40,45,55" : "200,205,200", 0.08));
  }
});
/** palace-red lacquered wood (posts, rails), 512 px, vertical grain, worn edges */
export const redWoodHD = () => ctex("redWoodHD", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#a8402e"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, w = U(r, 2, 6);
    g.fillStyle = r() < 0.6 ? "rgba(90,25,15,0.22)" : "rgba(255,180,150,0.12)"; wrapX(S, x, w, (X) => g.fillRect(X, 0, w, S));
  }
  for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rad = U(r, 20, 60); wrap2(S, S, x, y, rad * 2, (X, Y) => blotch(g, X, Y, rad, 0.5, "70,30,20", 0.12)); }
});
/** weathered plank wall: horizontal boards 0.25 m, 1024 px = 2 m; slits = true paints 2 dark arrow slits per tile */
export const plankHD = (key: string, base: string, slits = false) => ctex(key, 1024, 1024, (g, r) => {
  const S = 1024, BH = 128, B = new THREE.Color(base);
  for (let i = 0; i < S / BH; i++) {
    const c = B.clone().offsetHSL(U(r, -0.01, 0.01), 0, U(r, -0.05, 0.05));
    g.fillStyle = "#" + c.getHexString(); g.fillRect(0, i * BH, S, BH);
    for (let k = 0; k < 9; k++) { const y = i * BH + U(r, 10, BH - 10); g.fillStyle = "rgba(60,35,20,0.16)"; g.fillRect(0, y, S, U(r, 1.5, 3)); }
    g.fillStyle = "rgba(255,240,210,0.18)"; g.fillRect(0, i * BH + 3, S, 4);
    g.fillStyle = "rgba(35,20,12,0.75)"; g.fillRect(0, i * BH + BH - 6, S, 6);
    for (let k = 0; k < 2; k++) { const x = U(r, 0, S); g.fillStyle = "rgba(35,20,12,0.55)"; wrapX(S, x, 5, (X) => g.fillRect(X, i * BH, 5, BH)); }
    for (let k = 0; k < 3; k++) { const x = U(r, 0, S); g.fillStyle = "#2c1d14"; g.beginPath(); g.arc(x, i * BH + BH / 2, 5, 0, TAU); g.fill(); }
  }
  if (slits) for (const x of [S * 0.25, S * 0.75]) {
    g.fillStyle = "#1e130c"; g.fillRect(x - 16, S * 0.18, 32, S * 0.5);
    g.fillStyle = "rgba(255,230,190,0.3)"; g.fillRect(x - 22, S * 0.18 + S * 0.5, 44, 6);
    g.strokeStyle = "rgba(20,10,5,0.8)"; g.lineWidth = 5; g.strokeRect(x - 20, S * 0.18 - 4, 40, S * 0.5 + 8);
  }
});
/** gate door leaf: red-brown lacquered planks with dark iron bands (studs are geometry). UV 0..1 over one leaf. */
export const doorHD = () => ctex("doorHD", 512, 1024, (g, r) => {
  const W = 512, H = 1024;
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Color("#7e3a26").offsetHSL(0, 0, U(r, -0.04, 0.03));
    g.fillStyle = "#" + c.getHexString(); g.fillRect((i * W) / 6, 0, W / 6, H);
    for (let k = 0; k < 8; k++) { g.fillStyle = "rgba(50,15,8,0.2)"; g.fillRect((i * W) / 6 + U(r, 4, W / 6 - 4), 0, 2, H); }
    g.fillStyle = "rgba(30,10,5,0.7)"; g.fillRect((i * W) / 6, 0, 4, H);
  }
  for (const y of [0.08, 0.5, 0.92]) { g.fillStyle = "#3a3634"; g.fillRect(0, y * H - 18, W, 36); g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(0, y * H - 18, W, 5); }
  for (let i = 0; i < 20; i++) { const x = r() * W, y = r() * H, rad = U(r, 30, 80); blotch(g, x, y, rad, 0.6, "40,15,10", 0.12); }
});

// ------------------------------------------------------------------------------------------- city
/** house wall: lime plaster (white or ochre) over a dark timber sill band, a lattice window + a door. UV 0..1 per wall
 *  (4 x 3 m). */
export const plasterHD = (key: string, wall: string, door: boolean) => ctex(key, 512, 384, (g, r) => {
  const W = 512, H = 384;
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) blotch(g, r() * W, r() * H, U(r, 20, 70), 1.4, r() < 0.6 ? "120,95,70" : "255,250,235", 0.1);
  g.fillStyle = "#5a3d2b"; g.fillRect(0, H - 46, W, 46); g.fillRect(0, 0, W, 14);           // sill + top beam
  for (const x of [0, W - 14]) g.fillRect(x, 0, 14, H);                                       // corner posts
  const win = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = "#3a2a20"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#8a5a3a"; g.lineWidth = 4;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (k * w) / 4, y); g.lineTo(x + (k * w) / 4, y + h); g.stroke(); g.beginPath(); g.moveTo(x, y + (k * h) / 4); g.lineTo(x + w, y + (k * h) / 4); g.stroke(); }
    g.strokeStyle = "#4a2f20"; g.lineWidth = 8; g.strokeRect(x, y, w, h);
  };
  if (door) { win(70, 110, 110, 90); g.fillStyle = "#6a3424"; g.fillRect(300, 150, 120, H - 196); g.strokeStyle = "#3a2018"; g.lineWidth = 7; g.strokeRect(300, 150, 120, H - 196); g.beginPath(); g.moveTo(360, 150); g.lineTo(360, H - 46); g.stroke(); }
  else { win(80, 110, 120, 96); win(310, 110, 120, 96); }
});
/** palace enclosure wall: red plaster, darker foot, 512 px = 4 m x 4 m */
export const palaceWallHD = () => ctex("palaceWallHD", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#b04a36"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) { const x = r() * S, y = r() * S, rad = U(r, 30, 90); wrap2(S, S, x, y, rad * 2, (X, Y) => blotch(g, X, Y, rad, 1.5, r() < 0.6 ? "90,30,20" : "255,200,170", 0.1)); }
  speck(g, r, S, 300, [0.8, 2], ["rgba(80,25,15,0.4)", "rgba(255,220,200,0.3)"]);
});

// ------------------------------------------------------------------------------------------- props
/** felt blanket: cream or grey wool with a darker stitched border (UV 0..1 over the blanket) */
export const feltHD = (key: string, base: string, edge: string) => ctex(key, 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) blotch(g, r() * S, r() * S, U(r, 15, 60), 1.3, r() < 0.5 ? "120,110,95" : "255,252,240", 0.1);
  speck(g, r, S, 900, [0.6, 1.6], ["rgba(110,100,85,0.35)", "rgba(255,255,250,0.3)"]);
  g.fillStyle = edge; g.fillRect(0, 0, S, 34); g.fillRect(0, S - 34, S, 34); g.fillRect(0, 0, 34, S); g.fillRect(S - 34, 0, 34, S);
  g.strokeStyle = "rgba(40,30,25,0.85)"; g.lineWidth = 3; g.setLineDash([12, 9]);
  g.strokeRect(46, 46, S - 92, S - 92); g.strokeRect(17, 17, S - 34, S - 34); g.setLineDash([]);
  g.strokeStyle = "rgba(60,45,35,0.5)"; g.lineWidth = 2; g.setLineDash([8, 10]);
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(46, (i * S) / 4); g.lineTo(S - 46, (i * S) / 4); g.stroke(); }
  g.setLineDash([]);
});
/** straw: golden stalks along u, 512 x 256 */
export const strawHD = () => ctex("strawHD", 512, 256, (g, r) => {
  g.fillStyle = "#c9a54e"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    const y = r() * 256, x = r() * 512, l = U(r, 60, 220);
    g.strokeStyle = r() < 0.5 ? "rgba(240,215,130,0.8)" : r() < 0.6 ? "rgba(150,110,40,0.7)" : "rgba(255,240,180,0.7)"; g.lineWidth = U(r, 1.2, 3);
    wrapX(512, x, l, (X) => { g.beginPath(); g.moveTo(X, y); g.lineTo(X + l, y + U(r, -5, 5)); g.stroke(); });
  }
});
/** Taihu limestone: pale grey, pitted with small dark holes, water-worn streaks (512 px, wraps) */
export const taihuHD = () => ctex("taihuHD", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#a9aba8"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, rad = U(r, 20, 70); wrap2(S, S, x, y, rad * 2, (X, Y) => blotch(g, X, Y, rad, U(r, 0.5, 2), r() < 0.5 ? "90,95,100" : "250,250,245", 0.14)); }
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, q = U(r, 4, 12);
    wrap2(S, S, x, y, q + 4, (X, Y) => {
      g.fillStyle = "rgba(240,242,238,0.5)"; g.beginPath(); g.ellipse(X + 1.5, Y + 2, q * 1.15, q * 0.9, 0, 0, TAU); g.fill();
      g.fillStyle = "rgba(70,74,80,0.75)"; g.beginPath(); g.ellipse(X, Y, q, q * 0.75, r() * 3, 0, TAU); g.fill();
    });
  }
  for (let i = 0; i < 30; i++) { const x = r() * S, l = U(r, 60, 200); g.strokeStyle = "rgba(90,95,100,0.25)"; g.lineWidth = U(r, 3, 8); wrapX(S, x, 8, (X) => { g.beginPath(); g.moveTo(X, r() * S); g.lineTo(X + U(r, -10, 10), l); g.stroke(); }); }
});
/** clay jar: brown glaze shoulder over raw ochre clay (u around, v up), 512 x 512 */
export const jarHD = () => ctex("jarHD", 512, 512, (g, r) => {
  const S = 512;
  g.fillStyle = "#a68a6e"; g.fillRect(0, 0, S, S);
  g.fillStyle = "#4e3a2c"; g.fillRect(0, 0, S, S * 0.45);
  for (let i = 0; i < 40; i++) { const x = r() * S, l = U(r, 20, 120); g.fillStyle = "#4e3a2c"; wrapX(S, x - 8, 16, (X) => { g.beginPath(); g.ellipse(X + 8, S * 0.45, 8, l / 2, 0, 0, TAU); g.fill(); }); }
  g.fillStyle = "rgba(255,230,200,0.2)"; g.fillRect(0, S * 0.12, S, 10);
  for (const y of [0.62, 0.7, 0.8]) { g.fillStyle = "rgba(80,45,25,0.3)"; g.fillRect(0, y * S, S, 4); }
  speck(g, r, S, 400, [0.8, 2], ["rgba(80,45,25,0.4)", "rgba(255,240,210,0.3)"]);
});
/** burlap sack */
export const sackHD = () => ctex("sackHD", 256, 256, (g, r) => {
  g.fillStyle = "#c4ad80"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) { g.fillStyle = "rgba(90,70,45,0.18)"; g.fillRect(i, 0, 1.5, 256); g.fillRect(0, i, 256, 1.5); }
  for (let i = 0; i < 12; i++) blotch(g, r() * 256, r() * 256, U(r, 15, 40), 1.3, "100,80,50", 0.12);
  g.strokeStyle = "rgba(60,40,25,0.6)"; g.lineWidth = 3; g.setLineDash([7, 6]); g.strokeRect(10, 10, 236, 236); g.setLineDash([]);
});
/** dung patty: dark brown with straw flecks */
export const dungHD = () => ctex("dungHD", 256, 256, (g, r) => {
  g.fillStyle = "#6b4a2c"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) blotch(g, r() * 256, r() * 256, U(r, 15, 45), 1.2, r() < 0.5 ? "50,32,18" : "150,115,70", 0.25);
  for (let i = 0; i < 70; i++) { const x = r() * 256, y = r() * 256, a = r() * 3; g.strokeStyle = "rgba(210,180,100,0.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
});
