// Painted Canvas2D textures for the animals (beasts.ts): the elephant face decal (calm / angry / shock / happy), the
// pig face decal (normal / squeal x 3 jaw sizes, ink or light lines for the pitch-black coat), trunk wrinkle rings,
// saddle cloths (Macedonian red + gold sun-star, plain brown, Persian teal), turret planks, the pitch gloss streaks and
// the fire glow. OWNER: beast. All cached; drawn once.
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const tex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) => {
  let t = cache.get(key);
  if (!t) {
    const c = mk(w, h); const g = c.getContext("2d")!;
    g.lineCap = "round"; g.lineJoin = "round";
    draw(g, w, h);
    t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    cache.set(key, t);
  }
  return t;
};
const INK = "#2b2430";

// ---------------------------------------------------------------- decal patch layout
/** a decal patch on a sphere-parametrised head: longitude lon0..lon1 (0 = forward), latitude lat1..lat0 (deg) */
export type Patch = { lon: number; lat0: number; lat1: number; w: number };
export const ELE_PATCH: Patch = { lon: 80, lat0: 55, lat1: -45, w: 512 };
export const PIG_PATCH: Patch = { lon: 80, lat0: 60, lat1: -70, w: 512 };
const patchH = (p: Patch) => Math.round((p.w * (p.lat0 - p.lat1)) / (2 * p.lon));
const pax = (p: Patch, lon: number) => ((lon + p.lon) / (2 * p.lon)) * p.w;
const pay = (p: Patch, lat: number) => ((p.lat0 - lat) / (p.lat0 - p.lat1)) * patchH(p);

// ---------------------------------------------------------------- elephant face
export type EleEyes = "calm" | "angry" | "shock" | "happy";
export const eleFaceTex = (eyes: EleEyes) => tex("ele_" + eyes, ELE_PATCH.w, patchH(ELE_PATCH), (g) => {
  const P = ELE_PATCH, k = P.w / (2 * P.lon); // px per degree
  for (const s of [-1, 1]) {
    const x = pax(P, s * 38), y = pay(P, 13);
    const eye = (rx: number, ry: number, pr: number, px: number, py: number, lw = 1.3) => {
      g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = lw * k;
      g.beginPath(); g.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.ellipse(x + px * k, y + py * k, pr * k, pr * 1.18 * k, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + (px - pr * 0.35) * k, y + (py - pr * 0.45) * k, pr * 0.32 * k, 0, Math.PI * 2); g.fill();
    };
    const brow = (dy: number, tilt: number, arch: number, L = 8.5, lw = 2.6) => {
      // tilt > 0: the inner end (toward the trunk, lon -> 0) lower = angry
      const bx = x, by = y - dy * k, ix = bx - s * L * k, ox = bx + s * L * k;
      g.strokeStyle = INK; g.lineWidth = lw * k;
      g.beginPath(); g.moveTo(ix, by + tilt * k); g.quadraticCurveTo(bx, by - arch * k, ox, by - tilt * k); g.stroke();
    };
    switch (eyes) {
      case "calm":
        eye(5.6, 6.6, 2.4, -s * 1.2, 0.8);
        g.strokeStyle = INK; g.lineWidth = 1.5 * k; // relaxed upper lid over the top of the eye
        g.beginPath(); g.ellipse(x, y, 5.9 * k, 6.9 * k, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        brow(10.5, 0, 1.6);
        break;
      case "angry":
        eye(5.4, 6.0, 2.3, -s * 1.6, 1.4);
        // heavy lid: an ink wedge across the top of the eye, low at the inner end
        g.fillStyle = INK; g.beginPath();
        g.moveTo(x - s * 6.6 * k, y - 0.8 * k); g.lineTo(x + s * 6.6 * k, y - 5.6 * k); g.lineTo(x + s * 6.6 * k, y - 8 * k); g.lineTo(x - s * 6.6 * k, y - 8 * k); g.closePath();
        g.save(); g.beginPath(); g.ellipse(x, y, 5.5 * k, 6.1 * k, 0, 0, Math.PI * 2); g.clip();
        g.beginPath(); g.moveTo(x - s * 6.6 * k, y - 0.8 * k); g.lineTo(x + s * 6.6 * k, y - 5.0 * k); g.lineTo(x + s * 6.6 * k, y - 8 * k); g.lineTo(x - s * 6.6 * k, y - 8 * k); g.closePath(); g.fill();
        g.restore();
        brow(8.2, 3.6, 0.4, 8.5, 3.0);
        break;
      case "shock":
        eye(7.6, 8.6, 1.5, -s * 0.5, 0.3, 1.6);
        brow(15.5, -2.2, 3.4, 8, 2.6);
        break;
      case "happy":
        g.strokeStyle = INK; g.lineWidth = 2.2 * k;
        g.beginPath(); g.moveTo(x - 5.4 * k, y + 1.8 * k); g.quadraticCurveTo(x, y - 6.4 * k, x + 5.4 * k, y + 1.8 * k); g.stroke();
        brow(12.5, -1.0, 2.4, 7, 2.2);
        break;
    }
  }
});

// ---------------------------------------------------------------- pig face
/** squeal: 0 = normal (eyes open, small smile), 1 = squeal (eyes squeezed shut, mouth open by jaw 0..2); dark = the
 *  pitch coat (lines go light so they read on black) */
export const pigFaceTex = (squeal: boolean, jaw: number, dark: boolean) => tex(`pig_${+squeal}_${jaw}_${+dark}`, PIG_PATCH.w, patchH(PIG_PATCH), (g) => {
  const P = PIG_PATCH, k = P.w / (2 * P.lon);
  const line = dark ? "#f3e4e8" : INK;
  for (const s of [-1, 1]) {
    const x = pax(P, s * 30), y = pay(P, 24);
    if (!squeal) {
      g.fillStyle = "#ffffff"; g.strokeStyle = dark ? "#f3e4e8" : INK; g.lineWidth = 1.4 * k;
      g.beginPath(); g.ellipse(x, y, 7.2 * k, 8.4 * k, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.ellipse(x - s * 1.2 * k, y + 1.4 * k, 3.6 * k, 4.2 * k, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x - s * 2.2 * k, y - 0.2 * k, 1.2 * k, 0, Math.PI * 2); g.fill();
    } else {
      // squeezed shut: > <  chevrons, thick
      g.strokeStyle = line; g.lineWidth = 2.6 * k;
      g.beginPath(); g.moveTo(x + s * 6 * k, y - 5 * k); g.lineTo(x - s * 4.5 * k, y + 0.5 * k); g.lineTo(x + s * 6 * k, y + 5.5 * k); g.stroke();
      // worried brows
      g.lineWidth = 2.4 * k; g.beginPath(); g.moveTo(x - s * 6 * k, y - 12 * k); g.lineTo(x + s * 6 * k, y - 15.5 * k); g.stroke();
    }
  }
  const mx = pax(P, 0), my = pay(P, -44);
  if (!squeal) {
    g.strokeStyle = line; g.lineWidth = 1.8 * k;
    g.beginPath(); g.moveTo(mx - 8 * k, my - 1.5 * k); g.quadraticCurveTo(mx, my + 5 * k, mx + 8 * k, my - 1.5 * k); g.stroke();
  } else {
    const w = [11, 13, 9.5][jaw] * k, h = [10, 14, 7.5][jaw] * k;
    g.fillStyle = "#5b1222"; g.beginPath(); g.ellipse(mx, my, w, h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e86a80"; g.beginPath(); g.ellipse(mx, my + h * 0.5, w * 0.62, h * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.fillRect(mx - w * 0.55, my - h * 0.98, w * 1.1, h * 0.26); // top teeth
    g.strokeStyle = dark ? "#f0a8b8" : INK; g.lineWidth = 1.5 * k;
    g.beginPath(); g.ellipse(mx, my, w, h, 0, 0, Math.PI * 2); g.stroke();
  }
});

// ---------------------------------------------------------------- skins + cloths
/** trunk: soft wrinkle rings (multiplied onto the skin colour); v runs along the trunk */
export const trunkTex = () => tex("trunk", 64, 256, (g, w, h) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    const y = (i + 0.5) * (h / 8);
    g.strokeStyle = "rgba(70,72,96,0.55)"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 4, w * 0.7, y + 4, w, y); g.stroke();
  }
});
/** the Vergina sun: 16 rays (8 long, 8 short) round a disc */
const sunStar = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) => {
  g.fillStyle = col;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, L = i % 2 ? r * 0.72 : r, w = 0.11;
    g.beginPath(); g.moveTo(x + Math.cos(a - w) * r * 0.28, y + Math.sin(a - w) * r * 0.28); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.lineTo(x + Math.cos(a + w) * r * 0.28, y + Math.sin(a + w) * r * 0.28); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
};
/** saddle cloth: u runs over the back from one flank's hem to the other's, v along the body (tail -> head) */
export const clothTex = (kind: "king" | "tower" | "siege") => tex("cloth_" + kind, 512, 256, (g, w, h) => {
  const base = kind === "king" ? "#b3262a" : kind === "tower" ? "#8c4a2e" : "#1f7f86";
  const trim = kind === "king" ? "#e8b640" : kind === "tower" ? "#5c2f1c" : "#efe0b8";
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const b = 22;
  g.fillStyle = trim;
  g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h); g.fillRect(0, 0, w, b * 0.7); g.fillRect(0, h - b * 0.7, w, b * 0.7);
  if (kind === "king") {
    for (const u of [0.17, 0.83]) sunStar(g, u * w, h * 0.5, h * 0.3, trim);
    g.fillStyle = "#7d1418"; for (let x = b + 6; x < w - b; x += 18) { g.beginPath(); g.arc(x, b * 0.7 + 7, 3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, h - b * 0.7 - 7, 3, 0, Math.PI * 2); g.fill(); }
  } else if (kind === "siege") {
    g.fillStyle = trim;
    for (const u of [0.17, 0.83]) for (let j = -1; j <= 1; j++) {
      const x = u * w, y = h * 0.5 + j * h * 0.24, r = h * 0.075;
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill();
    }
    g.fillStyle = "#b8402a"; g.fillRect(b, b * 0.7, 8, h - 1.4 * b); g.fillRect(w - b - 8, b * 0.7, 8, h - 1.4 * b);
  }
});
/** turret planks: vertical boards with ink seams, two iron bands; one face per repeat */
export const plankTex = () => tex("planks", 256, 512, (g, w, h) => {
  const cols = ["#8a5a34", "#7d5130", "#93633a", "#845632"];
  const n = 6;
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % 4]; g.fillRect((i * w) / n, 0, w / n, h); }
  g.strokeStyle = "rgba(43,36,48,0.85)"; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, h); g.stroke(); }
  for (const y of [0.18, 0.72]) {
    g.fillStyle = "#4a4650"; g.fillRect(0, y * h, w, 16);
    g.fillStyle = "#2b2430"; for (let x = 12; x < w; x += 42) { g.beginPath(); g.arc(x, y * h + 8, 3.2, 0, Math.PI * 2); g.fill(); }
  }
});
/** pitch gloss: soft white streaks on black (an emissive map on the pig skin; sphere uv: u round y, v top = 1) */
export const glossTex = () => tex("gloss", 256, 128, (g, w, h) => {
  g.fillStyle = "#000000"; g.fillRect(0, 0, w, h);
  const streak = (u: number, v: number, rw: number, rh: number) => {
    const x = u * w, y = (1 - v) * h;
    const gr = g.createRadialGradient(x, y, 0, x, y, rw);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rw, 0, Math.PI * 2); g.fill(); g.restore();
  };
  streak(0.5, 0.74, 30, 7); streak(0.0, 0.74, 30, 7); streak(1.0, 0.74, 30, 7);
}, false);
/** radial fire glow (additive cards) */
export const glowTex = () => tex("glow", 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.45)"); gr.addColorStop(0.6, "rgba(255,255,255,0.1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);
