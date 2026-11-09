// Our own flat 2D cartoon cast (riflemen, officer, townsfolk, kid, parent) + 2D effects, drawn on a canvas.
// Construction v2 (characters.md, our own cast): superellipse heads (pointed crown 1.75 / full jaw 2.3, chin taper,
// seeded side bulge + tilt), bean torsos, single-stroke limbs with ink-dot hands, a thick-thin plum outline weighted
// away from the light, soft painted crescents, deadpan lidded eyes, no blush, no catchlights.
// Design space 600 x 1000 units (soles at y = 975); the canvas transform scales it.
export const INK = "#241726";
export const SKIN = "#ffe2c2";
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
const TONGUE = "#e86e78";
type C3 = [number, number, number];
const SH_SKIN: C3 = [0.96, 0.86, 0.84]; // measured shadow/lit ratio on skin heads
const SH_CLOTH: C3 = [0.64, 0.66, 0.74]; // torsos: lit side -> far side ~0.65
const SH_FELT: C3 = [0.62, 0.62, 0.7];

export type Build = "adult" | "stout" | "kid" | "slim";
export type Outfit = {
  jacket: string; pants: string; boots: string; hat?: string | null; belt?: string | null; buttons?: string; rifle?: boolean;
  sash?: string; sword?: boolean; moustache?: string; beard?: string; skin?: string; head?: number; cap?: string; hair?: string; dress?: string;
  build?: Build;
  // ---- Egypt ----
  /** linen kilt (shendyt) colour, drawn over the legs from the hips to above the knees */
  kilt?: string; kiltTrim?: string;
  /** leather apron over the kilt front (embalmer) */
  apron?: string;
  /** broad bead collar (wesekh): this colour + turquoise + gold bands */
  collar?: string;
  /** linen shawl over one shoulder */
  shawl?: string;
  /** "jackal" = Anubis head (profile jackal head on the front body) */
  beast?: "jackal";
  /** arms drawn in skin colour instead of the jacket colour (sleeveless dresses) */
  bareArms?: boolean;
  /** short trimmed beard instead of the full one */
  shortBeard?: boolean;
  // ---- Gobekli ----
  /** animal-hide cloak over one shoulder (spotted) */
  hide?: string;
  /** bead necklace colour */
  beads?: string;
  /** bundle / pack on the back (colour) */
  pack?: string;
  glasses?: boolean; pockets?: boolean;
  /** holds a clipboard in the left hand */
  clip?: boolean;
  /** kilt hem as a fraction of hip -> sole (default .43) */
  kiltLen?: number;
  /** colour of what fills a held basket (berries by default; wheat gold) */
  cargo?: string;
  // ---- Skara Brae ----
  /** waistcoat colour (shows in the V of an open coat front) */
  vest?: string;
  /** shirt colour at the neck opening (default white) */
  shirt?: string;
  /** neckwear: white cravat / stock, bow tie, long tie (colours) */
  cravat?: string; bowtie?: string; tie?: string;
  /** coat skirt below the waist as a fraction of hip -> sole (lab coat ~0.55); `coatOpen` splits it at the front */
  coatLen?: number; coatOpen?: boolean;
  /** tailcoat: two tails hanging behind the legs to the knees */
  tails?: boolean;
  /** mutton-chop side-whiskers */
  whiskers?: string;
  /** tweed: a check over the jacket + trousers */
  tweed?: string;
  /** hi-vis: two silver reflective bands round the jacket */
  hivis?: boolean;
  /** fur / wool cape over the shoulders */
  cape?: string;
  /** knitted / woven wool: a few stitch marks on the tunic */
  wool?: boolean;
  /** glasses style when `glasses`: round wire (default), "round" thick, "big" 1970s */
  glassesK?: "round" | "big";
  /** 1970s sideburns */
  sideburns?: string;
};
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
/** deterministic per-character random in [0, 1) */
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** smooth curve from a through (near) k to b, as a polyline */
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

export const RIFLEMAN: Outfit = { jacket: "#357650", pants: "#3d4440", boots: INK, hat: "shako", belt: "#f1efe6", buttons: "#d9dde0", rifle: true };
export const OFFICER: Outfit = { ...RIFLEMAN, hat: "shako_tall", buttons: "#e8c45a", sash: "#c0353a", sword: true, moustache: "#4a3020", rifle: false, belt: null, build: "stout" };
export const KID: Outfit = { jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#e2453c", build: "kid" };
export const PARENT: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#5a3b2a" };
export const SKINS = [SKIN, "#f5c9a0", "#ecd0b6", "#c99067"];

export const soldier = (v = 0, extra: Partial<Outfit> = {}): Outfit => {
  const o: Outfit = { ...RIFLEMAN, skin: SKINS[v % 4] };
  if (v % 4 === 1) o.moustache = "#4a3426";
  if (v % 4 === 3) o.moustache = "#2a201a";
  return { ...o, ...extra };
};

// ---- Helike cast (373 BC), Athens (Plato) and today ----
const SANDAL = "#7a4f33";
/** Achaean townsfolk: knee-length chiton (jacket colour, bare legs = skin-coloured pants), sandals, dark hair */
export const greek = (v = 0): Outfit => {
  const tunic = ["#e9dcc0", "#c46a46", "#d8a95f", "#5b7fb0", "#7d8f4e", "#b5544c", "#e3cf9c"][v % 7];
  const skin = SKINS[v % 4], hair = ["#3a2618", "#1f1612", "#5a3b22", "#2b1d14"][v % 4];
  if (v % 3 === 1) return { jacket: tunic, pants: skin, boots: SANDAL, skin, hat: "hair", hair, dress: ["#d9c4a0", "#a85a4c", "#6f8fb8"][v % 3], belt: null, buttons: "none" };
  return { jacket: tunic, pants: skin, boots: SANDAL, skin, hat: "hair", hair, belt: null, buttons: "none", moustache: v % 4 === 2 ? hair : undefined, beard: v % 5 === 3 ? hair : undefined };
};
/** night clothes: pale wool, no belt */
export const greekNight = (v = 0): Outfit => ({ ...greek(v), jacket: ["#e9e1cf", "#d7cdb8", "#cfd6de"][v % 3], belt: null });
export const PLATO: Outfit = { jacket: "#f1ead8", pants: "#f1ead8", boots: SANDAL, skin: "#f2c9a2", hat: "hair", hair: "#e9e6df", beard: "#ebe7df", belt: null, buttons: "none", build: "stout" };
/** the bronze Poseidon: all bronze, darker bronze hair/beard, trident (o.cap = trident colour) */
export const POSEIDON: Outfit = { jacket: "#a8722e", pants: "#b8823a", boots: "#8a5a26", skin: "#c48d43", hat: "hair", hair: "#7a4e1e", beard: "#7a4e1e", belt: null, cap: "#6b4419", buttons: "none", build: "stout" };
export const FISHER = (v = 0): Outfit => ({ ...greek(v * 2), jacket: ["#8c6a4a", "#6f7f8a"][v % 2], belt: null, buttons: "none", hat: v % 2 ? "cap" : "hair", cap: "#c9a46a" });
export const KID_BEACH: Outfit = { jacket: "#2fa6c9", pants: "#f0b050", boots: "#ffe2c2", hat: "cap", cap: "#e2453c", build: "kid" };
/** archaeologists (2001): orange vest over a shirt, work trousers, boots, sun hat or cap; muddy boots */
export const ARCHAEO = (v = 0): Outfit => ({ jacket: ["#f07a2a", "#e8a23a", "#f07a2a"][v % 3], pants: ["#6a6f5a", "#4a5a7a", "#7a6a4f"][v % 3], boots: "#5a3b22",
  skin: SKINS[(v + 1) % 4], hat: v === 2 ? "hair" : "cap", cap: v === 0 ? "#efe7cf" : "#e8e0c8", hair: ["#3a2618", "#8a6a3a", "#1f1612"][v % 3], belt: null, moustache: v === 1 ? "#5a3b22" : undefined });

export const townsfolk = (v = 0): Outfit => {
  const coats = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"];
  const o: Outfit = { jacket: coats[v % 6], pants: "#3b3f52", boots: "#4a3426", skin: SKINS[v % 4] };
  return v % 2 ? { ...o, hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2"][v % 3] } : { ...o, hat: "tophat" };
};

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  /** [angle, cx, cy] rotation about (cx, cy), optional post-translation [.., dx, dy] */
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  /** filled shape with an ink outline; fill=null draws the outline only */
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  /** thick round-capped limb with an ink rim (effects, rope) */
  line(pts: P2[], fill: string, w: number, ink = true) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    if (ink) { this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * this.ol * 0.9; g.stroke(); }
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Radial ramp centred `shift` R toward the light: flat out to ~0.6 R on the far side, full shadow by ~0.8 R. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** broad gradient across a shape along the light: lit edge = base, far edge = shadow (torsos, coats) */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** thick-thin ink ring: w(θ) = w0 (1 + k cos(θ − thick)), θ from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  /** flat strap with a thin ink rim (cross belts, sash, rifle, handles) */
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const rrect = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

/** tapered stroke, thick end at a: brows, moustache halves */
const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ---------------- contours ----------------
export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };

/** superellipse "bean": separate crown / jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen). */
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.94, slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12, 8 % bulge to the facing side */
export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64 deg measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

// ---------------- faces ----------------
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick" | "cry" | "beg" | "proud" | "smug" | "bored"
  | "determined" | "baffled" | "shrug" | "hungry" | "stare" | "beam" | "squint" | "eureka" | "think"
  | "sheepish" | "strain" | "disgust" | "gawp" | "frown";
type EyeK = "dot" | "small" | "lid" | "slit" | "happy" | "dash" | "squeeze" | "shock" | "shockHalf" | "spiral" | "plead";
type MouthK = "dash" | "frown" | "smirk" | "smile" | "smileWide" | "grin" | "laugh" | "o" | "O" | "wave" | "teeth" | "lick"
  | "cryO" | "waveS" | "meh";
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-4, -4], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
  cry: { eye: ["squeeze", "squeeze"], brow: [-4, 3], mouth: "cryO" },
  beg: { eye: ["plead", "plead"], brow: [-9, 1], mouth: "waveS" },
  proud: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "smileWide" },
  smug: { eye: ["slit", "slit"], brow: [1, 0], mouth: "smirk" },
  bored: { eye: ["slit", "slit"], brow: [1, 1], mouth: "meh" },
  determined: { eye: ["dot", "dot"], brow: [4, -2], mouth: "dash" },
  baffled: { eye: ["small", "small"], brow: [-6, 2], mouth: "waveS" },
  shrug: { eye: ["lid", "lid"], brow: [-3, 1], mouth: "meh" },
  hungry: { eye: ["small", "small"], brow: [-4, 3], mouth: "lick" },
  stare: { eye: ["dot", "dot"], brow: [0, 0], mouth: "dash" },
  beam: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  squint: { eye: ["slit", "slit"], brow: [3, -1], mouth: "meh" },
  eureka: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "grin" },
  think: { eye: ["small", "small"], brow: [-3, 1], mouth: "dash" },
  sheepish: { eye: ["happy", "happy"], brow: [-6, 3], mouth: "teeth" },
  strain: { eye: ["squeeze", "squeeze"], brow: [5, -3], mouth: "teeth" },
  disgust: { eye: ["slit", "squeeze"], brow: [5, -3], mouth: "waveS" },
  gawp: { eye: ["shock", "shock"], brow: [-8, -7], mouth: "O" },
  frown: { eye: ["lid", "lid"], brow: [5, -3], mouth: "frown" },
};
const TEAR = "#7cc8ff";
const halfLid = (k: EyeK): EyeK => (k === "dot" || k === "small" || k === "plead" ? "lid" : k === "lid" ? "slit" : k === "shock" ? "shockHalf" : k);
const eyeKind = (k: EyeK, lid: number): EyeK =>
  lid >= 1 && k !== "happy" && k !== "squeeze" && k !== "spiral" ? "dash" : lid > 0 ? halfLid(k) : k;
const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, skin: string) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  switch (kind) {
    case "dot": p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case "small": p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case "plead": p.ell(x, ey, 8.5 * u, 9.5 * u, WHITE, 2.6 * u); p.dot(lx + side * 0.5 * u, ey - 2.5 * u, 3 * u); break;
    case "lid": p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case "slit": p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case "happy": p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case "dash": p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case "squeeze": p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case "shock": case "shockHalf":
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s: P2[] = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};

/** open "D" mouth with a white teeth band (+ tongue) */
const dmouth = (p: Pen, mx: number, y: number, rx: number, ry: number, u: number, tongue = false) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k = 1) => {
  const mw = 4 * u;
  switch (kind) {
    case "dash": p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, 11 * u, u, true); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 3.2 * u); break;
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], WHITE, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
    case "cryO": { // wavy top lip, open wailing mouth
      const s: P2[] = [];
      for (let i = 0; i <= 10; i++) s.push([mx - 11 * u * k + i * 2.2 * u * k, my - 2 * u + 1.6 * u * Math.sin(i * 1.5)]);
      for (let i = 0; i <= 12; i++) { const a = rad((180 * i) / 12); s.push([mx + 11 * u * k * Math.cos(a), my - 1 * u + 10 * u * Math.sin(a)]); }
      p.poly(s, MOUTH, 3 * u); break;
    }
    case "waveS": { const s: P2[] = []; for (let i = 0; i <= 8; i++) s.push([mx - 5.5 * u * k + i * 1.4 * u * k, my + 1.3 * u * Math.sin(i * 1.5)]); p.stroke(s, 3 * u); break; }
    case "meh": p.arc(mx, my + 3 * u, 6.5 * u * k, 1.8 * u, 200, 340, mw); break;
  }
};

/** face v2 (front / 3-4). u = 1 % of the head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u
 *  down, everything slid toward the facing side. No blush, no catchlights. */
export type FaceX = { glassesK?: "round" | "big"; whiskers?: string; sideburns?: string; pipe?: boolean; wet?: boolean };
export const faceFront = (p: Pen, cx: number, cy0: number, W: number, expr: Expr, facing: number, look: number, lid: number, brim: boolean,
  skin: string, moustache?: string, stout = false, beard?: string, nobrows = false, shortBeard = false, glasses = false, X: FaceX = {}) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing, cy = cy0 - (expr === "proud" ? 4 * u : 0);
  if (X.whiskers) for (const s of [-1, 1]) { // mutton chops: from the temple down the cheek, widest at the jaw
    const bx = cx + s * 36 * u + 4 * u * facing, pts: P2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = rad(-100 + 230 * t), r = (1 + 0.12 * (i % 2)), rx = 15 * u, ry = 25 * u;
      pts.push([bx + s * Math.cos(a) * rx * r * (t > 0.4 ? 1.15 : 0.8), cy0 + 12 * u + Math.sin(a) * ry * r]);
    }
    p.poly(pts, X.whiskers, 2.6 * u);
    p.poly([[bx - s * 6 * u, cy0 - 14 * u], [bx + s * 3 * u, cy0 - 14 * u], [bx + s * 6 * u, cy0 + 8 * u], [bx - s * 8 * u, cy0 + 4 * u]], X.whiskers, 0);
  }
  if (X.sideburns) for (const s of [-1, 1]) p.poly([[cx + s * 40 * u, cy0 - 18 * u], [cx + s * 48 * u, cy0 - 16 * u], [cx + s * 46 * u, cy0 + 16 * u], [cx + s * 36 * u, cy0 + 12 * u]], X.sideburns, 2 * u);
  if (beard && shortBeard) { // short trimmed beard (Aristotle)
    const bx = cx + 6 * u * facing;
    p.ell(bx, cy0 + 31 * u, 24 * u, 14 * u, beard, 3 * u);
    p.ell(bx - 19 * u, cy0 + 21 * u, 8 * u, 10 * u, beard, 0); p.ell(bx + 19 * u, cy0 + 21 * u, 8 * u, 10 * u, beard, 0);
    p.ell(bx, cy0 + 22 * u, 10 * u, 5 * u, skin, 0);
  } else if (beard) { // full beard round the jaw (Plato, the bronze Poseidon); the mouth is drawn on top
    const bx = cx + 6 * u * facing;
    p.ell(bx, cy + 31 * u, 31 * u, 25 * u, beard, 3 * u);
    p.ell(bx - 17 * u, cy + 14 * u, 11 * u, 12 * u, beard, 0); p.ell(bx + 17 * u, cy + 14 * u, 11 * u, 12 * u, beard, 0);
    p.ell(bx, cy + 20 * u, 11 * u, 6 * u, skin, 0);
  }
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x, ey, u, side, look, skin);
    let [dI, dO] = F.brow;
    const by = ey - (brim ? 17 : 20) * u;
    if (expr === "smug" && !(facing ? side === facing : side > 0)) { dI -= 6; dO -= 7; } // one brow raised
    if (nobrows) { /* shaved */ }
    else if (kind === "shock" || kind === "shockHalf") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
    if (expr === "cry") { // two tear streams down the cheeks
      const l: P2[] = [], r: P2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, y = ey + 5 * u + t * 33 * u, xc = x + side * 2.5 * u * t + 1.3 * u * Math.sin(t * 9), w = 2.2 * u + 1.6 * u * t;
        l.push([xc - w, y]); r.push([xc + w, y]);
      }
      p.poly([...l, ...r.reverse()], TEAR, 1.4 * u);
      p.ell(x + side * 2.5 * u, ey + 40 * u, 4 * u, 4.6 * u, TEAR, 1.4 * u);
    }
  }
  if (glasses && X.glassesK === "big") { // 1970s: huge squarish frames, faint brown tint
    for (const side of [-1, 1]) {
      const gx = fx + side * (ex + 2 * u);
      p.poly(rrect(gx - 19 * u, ey - 17 * u, gx + 19 * u, ey + 19 * u, 9 * u, 4), "rgba(190,150,90,0.30)", 0);
      p.poly(rrect(gx - 19 * u, ey - 17 * u, gx + 19 * u, ey + 19 * u, 9 * u, 4), null, 4.2 * u);
    }
    p.stroke([[fx - ex + 17 * u, ey - 6 * u], [fx + ex - 17 * u, ey - 6 * u]], 3.4 * u);
  } else if (glasses) { // round wire glasses over both eyes ("round": thicker tortoiseshell rims)
    const w = X.glassesK === "round" ? 3.8 * u : 2.8 * u;
    for (const side of [-1, 1]) p.ell(fx + side * ex, ey, 17 * u, 17 * u, "rgba(220,240,255,0.28)", w);
    p.stroke([[fx - ex + 17 * u, ey - 2 * u], [fx + ex - 17 * u, ey - 2 * u]], w);
    p.stroke([[fx - ex - 17 * u, ey - 3 * u], [fx - ex - 30 * u, ey - 6 * u]], 2.4 * u);
    p.stroke([[fx + ex + 17 * u, ey - 3 * u], [fx + ex + 30 * u, ey - 6 * u]], 2.4 * u);
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u;
  mouth(p, F.mouth, mx, my, u);
  if (moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (stout ? 19 : 15) * u, cy + (stout ? 10.5 : 15) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (X.pipe) { // briar pipe from the mouth corner: stem, then the bowl hanging below and out
    const s = facing || 1, m0: P2 = [mx + s * 7 * u, my + 1 * u], m1: P2 = [mx + s * 24 * u, my + 8 * u];
    p.band([m0, m1], "#2a1d18", 3 * u, 1.2 * u, "round");
    const bw = 7 * u, bx = m1[0] + s * 4 * u;
    p.poly([[bx - bw, m1[1] - 12 * u], [bx + bw, m1[1] - 12 * u], [bx + bw * 0.8, m1[1] + 6 * u], [bx - bw * 0.8, m1[1] + 6 * u]], "#7a4a2a", 2.2 * u);
    p.ell(bx, m1[1] - 12 * u, bw, 2.6 * u, "#3a2418", 1.6 * u);
    p.ell(bx, m1[1] - 12.5 * u, bw * 0.55, 1.4 * u, "#ff8a3a", 0);
  }
  if (X.wet) for (const [dx, dy, r] of [[-30, -26, 3.2], [24, -30, 2.6], [36, 4, 3.4], [-40, 10, 2.8], [8, 34, 2.4]] as const) { // water drops on the face
    p.poly([[cx + dx * u, cy + (dy - 2.4 * r) * u], [cx + (dx + r) * u, cy + dy * u], [cx + dx * u, cy + (dy + r) * u], [cx + (dx - r) * u, cy + dy * u]], "#bfe8ff", 1.2 * u);
  }
  if (expr === "nervous" || expr === "beg") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

/** profile face (facing screen-right): one eye, brow, nose tick, mouth near the front edge; no skin bump nose, no ear */
const faceSide = (p: Pen, hx: number, hy: number, W: number, expr: Expr, lid: number, brim: boolean, skin: string, moustache?: string, stout = false, glasses = false, beard?: string) => {
  const u = W / 100, F = FACE[expr], ex = hx + 27 * u, ey = hy;
  const kind = eyeKind(F.eye[1], lid);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === "shock" || kind === "shockHalf") p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 5 * u, 2.5 * u);
  if (beard) p.ell(hx + 22 * u, hy + 34 * u, 27 * u, 24 * u, beard, 3 * u);
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  mouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62);
  if (glasses) {
    p.ell(ex, ey, 17 * u, 17 * u, "rgba(220,240,255,0.28)", 2.8 * u);
    p.stroke([[ex - 16 * u, ey - 4 * u], [hx - 40 * u, ey - 8 * u]], 2.4 * u);
    p.stroke([[ex + 15 * u, ey], [ex + 22 * u, ey + 4 * u]], 2.4 * u);
  }
  if (moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (stout ? 11.5 : 16) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === "nervous" || expr === "beg") p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

// ---------------- hats ----------------
const BONNET = "#e9cf8f", BONNET_BRIM = "#d6b46a";
const NOBRIM = new Set(["hair", "bonnet", "cap", "wig", "bald", "pony", "braid", "bun", "balding", "hood", "mop"]);
/** parts of a hat that sit behind the head (bonnet) */
export const WIG = "#1c1820";
const hatBehind = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, light: number, thick: number, ow: number, side: boolean) => {
  if (o.hat === "hood") { // the back of the raised hood, bigger than the head
    const col = o.cap ?? "#f07a1a";
    const bb = blobPts(cx - (side ? 0.22 * H.a : 0), hc - 0.06 * H.b, { ...H, a: H.a * 1.24, b: H.b * 1.16, asym: 0, egg: -0.05, nTop: 1.9, nBot: 2.6, seed: H.seed + 4 });
    p.shadedFill(bb, col, mul(col, SH_CLOTH), light, H.a * 1.24);
    p.inkRing(bb, ow * 0.9, thick);
    return;
  }
  if (o.hat === "mop") { // 1970s mop of hair: falls behind the head to the collar
    const col = o.hair ?? WIG;
    const bb = blobPts(cx - (side ? 0.18 * H.a : 0), hc + 0.02 * H.b, { ...H, a: H.a * 1.14, b: H.b * 1.1, asym: 0, egg: 0.1, nTop: 2.2, nBot: 3.2, seed: H.seed + 6 });
    p.shadedFill(bb, col, mul(col, SH_FELT), light, H.a * 1.14);
    p.inkRing(bb, ow * 0.85, thick);
    return;
  }
  if (o.hat === "wig") { // Egyptian bob: hangs behind the head to about chin level, straight cut
    const col = o.hair ?? WIG, sx = side ? -0.16 * H.a : 0, u = ow / 5;
    const raw = blobPts(cx + sx, hc - 0.04 * H.b, { ...H, a: H.a * 1.16, b: H.b * 1.08, nTop: 1.9, nBot: 4, asym: 0, egg: 0.06, seed: H.seed + 5 });
    const cut = hc + 0.9 * H.b, front = side ? cx + 0.25 * H.a : Infinity;
    const bb = raw.map(([x, y]) => [Math.min(x, front), Math.min(y, cut)] as P2);
    p.shadedFill(bb, col, mul(col, SH_FELT), light, H.a * 1.16);
    p.clip(bb, () => { for (let i = -4; i <= 4; i++) p.stroke([[cx + sx + i * 0.26 * H.a, hc - 0.2 * H.b], [cx + sx + i * 0.28 * H.a, cut]], 1.3 * u, mix(col, "#8a8098", 0.22)); });
    p.inkRing(bb, ow * 0.85, thick);
    return;
  }
  if (o.hat === "pony" || o.hat === "braid") { // tail hanging behind the head (front view: out to one side)
    const col = o.hair ?? WIG, long = o.hat === "braid" ? 1.25 : 0.8, s = side ? -1 : (H.asym < 0 ? -1 : 1);
    const tx = cx + s * (side ? 0.95 : 0.78) * H.a, ty = hc - 0.1 * H.b;
    const pts: P2[] = spline([[tx, ty - 0.12 * H.b], [tx + s * 0.3 * H.a, ty + 0.2 * H.b], [tx + s * 0.28 * H.a, ty + long * H.b], [tx + s * 0.02 * H.a, ty + (long + 0.25) * H.b], [tx - s * 0.2 * H.a, ty + long * H.b * 0.75], [tx - s * 0.1 * H.a, ty + 0.2 * H.b]], true, 6);
    p.shadedFill(pts, col, mul(col, SH_FELT), light, H.a * 0.6);
    p.inkRing(pts, ow * 0.8, thick);
    p.stroke([[tx - s * 0.12 * H.a, ty + 0.1 * H.b], [tx + s * 0.18 * H.a, ty + 0.12 * H.b]], 1.8 * (ow / 5), mul(col, [1.7, 1.7, 1.7]));
    return;
  }
  if (o.hat !== "bonnet") return;
  const bb = blobPts(cx - (side ? 12 : 0) * (H.a / 50), hc - 0.07 * 2 * H.b, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
  p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
  p.inkRing(bb, ow * 0.85, thick);
};

const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number, side: boolean) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  if (o.hat === "pony" || o.hat === "braid" || o.hat === "bun") {
    hatOn(p, { ...o, hat: "hair" }, hp, H, cx, hc, light, seed, facing, side);
    const col = o.hair ?? WIG;
    if (o.hat === "bun") { // topknot
      const bp = ellC(cx + (side ? -0.15 * H.a : 0), crown - 0.02 * HH, 0.3 * H.a, 0.24 * H.b);
      p.shadedFill(bp, col, mul(col, SH_FELT), light, 0.3 * H.a);
      p.inkRing(bp, ow * 0.8, thickAngle(light));
    } else if (o.hat === "braid" && !side) { // braid over the shoulder in front
      const s = (facing || (H.asym < 0 ? -1 : 1)) * -1;
      for (let i = 0; i < 6; i++) {
        const bx = cx + s * (0.78 * H.a + 0.05 * H.a * Math.sin(i * 1.3)), by = hc + 0.82 * H.b + i * 0.3 * H.b;
        p.ell(bx, by, 0.2 * H.a, 0.2 * H.b, i % 2 ? mul(col, [1.25, 1.25, 1.25]) : col, ow * 0.5);
      }
    }
    return;
  }
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)); // tilt with the head, +-2 deg extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  const sag = (yb: number, wb: number): P2[] => {
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  if (o.hat === "shako" || o.hat === "shako_tall") {
    const tall = o.hat === "shako_tall", yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, "#3a3d47", "#24262d", light, wt, 0.4);
    if (tall) p.clip(body, () => p.band(R([[cx - wt - 5 * u, yb - ht + 0.07 * HH], [cx + wt + 5 * u, yb - ht + 0.07 * HH]]), "#e8c45a", 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    const deg = (a * 180) / Math.PI;
    if (side) {
      p.poly(R([[cx + 36 * u, yb - 1 * u], [cx + 60 * u, yb + 8 * u], [cx + 34 * u, yb + 6 * u]]), "#16171b", 2.5 * u);
      const [tx, ty] = R([[cx + 24 * u, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u);
    } else {
      const [px, py] = R([[cx + 3 * u * facing, yb + 3 * u]])[0];
      p.ell(px, py, 34 * u, 0.045 * HH, "#16171b", 2.5 * u, 0, 180, deg); // peak
      const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
      p.ell(bx, by, 7 * u, 6 * u, tall ? "#e8c45a" : "#c9ccd2", 2 * u, 0, 360, deg); // badge plate
      p.arc(bx, by, 3.5 * u, 2.8 * u, 200, 500, 1.6 * u);
      const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u); // green tuft
    }
  } else if (o.hat === "cap" || o.hat === "hair") {
    const cut = crown + (o.hat === "cap" ? 0.3 : 0.31) * HH;
    const keep = (x: number, y: number) => y < cut || (side && o.hat === "hair" && x < cx - 6 * u && y < hc + 0.42 * H.b);
    // start the arc at the first kept point after a dropped one, so the kept run is contiguous and the cut closes it
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length < 3) return;
    if (o.hat === "hair") { // scalloped lower edge
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    const col = o.hat === "cap" ? o.cap! : o.hair!;
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
    if (o.hat === "hair") {
      const s = side ? -1 : facing || 1;
      p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
    }
    if (o.hat === "cap") {
      const deg = (a * 180) / Math.PI;
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1), [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, deg);
      }
    }
  } else if (o.hat === "wig") { // straight-cut fringe over the brow; the sides hang behind (hatBehind)
    const col = o.hair ?? WIG, cut = crown + 0.17 * HH;
    const keep = (x: number, y: number) => y < cut || (side && x < cx - 6 * u && y < hc + 0.86 * H.b);
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.05, hc + (y - hc) * 1.05] as P2);
    if (arc.length < 3) return;
    if (side) arc.push([cx - 0.02 * H.a, cut + 0.04 * H.b], [cx - 0.22 * H.a, hc + 0.86 * H.b]);
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.clip(arc, () => {
      for (let i = -5; i <= 5; i++) p.stroke([[cx + i * 0.19 * H.a, crown - 4 * u], [cx + i * 0.2 * H.a, cut + 2 * u]], 1.3 * u, mix(col, "#8a8098", 0.22));
      const ld = (light * 180) / Math.PI; // soft sheen toward the light
      p.arc(cx, hc, H.a * 0.8, H.b * 0.8, ld - 22, ld + 22, 4 * u, mix(col, "#9a90a8", 0.35));
    });
    p.poly(arc, null, ow);
  } else if (o.hat === "hood") { // raised hood: a thick rim round the face from jaw to jaw over the brow, drawstrings
    const col = o.cap ?? "#f07a1a", top = hc + 0.5 * H.b;
    const n = hp.length, st = Math.max(0, hp.findIndex(([, y], i) => y < top && hp[(i + n - 1) % n][1] >= top));
    const rim = [...hp.slice(st), ...hp.slice(0, st)].filter(([, y]) => y < top).map(([x, y]) => [cx + (x - cx) * 0.98, hc + (y - hc) * 0.98] as P2);
    if (side) { // profile: the hood covers the back half of the head; the rim frames the face from the crown down the front
      while (rim.length > 3 && rim[0][0] < cx + 0.05 * H.a) rim.shift();
      p.clip(hp, () => { p.poly([[cx - 2 * H.a, hc - 2 * H.b], [cx + 0.12 * H.a, hc - 2 * H.b], [cx - 0.05 * H.a, hc + 2 * H.b], [cx - 2 * H.a, hc + 2 * H.b]], col, 0); });
      rim.unshift([cx - 0.1 * H.a, crown + 0.02 * HH]);
    }
    p.band(rim, INK, 0.2 * W, 0, "round");
    p.band(rim, col, 0.2 * W - 2 * ow * 0.8, 0, "round");
    p.stroke(rim.map(([x, y]) => [cx + (x - cx) * 0.9, hc + (y - hc) * 0.9] as P2), 1.6 * u, mul(col, SH_CLOTH));
    if (!side) for (const s of [-1, 1]) {
      p.stroke([[cx + s * 16 * u, hc + 0.96 * H.b], [cx + s * 13 * u, hc + 1.3 * H.b]], 1.8 * u, "#e8e2d0");
      p.ell(cx + s * 13 * u, hc + 1.33 * H.b, 2.6 * u, 3.4 * u, "#3a3d47", 1.2 * u);
    }
  } else if (o.hat === "trilby") { // pinched felt trilby with a band and a snap brim
    const col = o.cap ?? "#6a5238", yb = crown + 0.24 * HH, ht = 0.4 * HH, wb = 0.36 * W, wt = 0.29 * W;
    const body = R(spline([[cx - wb, yb], [cx - wt, yb - ht * 0.8], [cx - wt * 0.6, yb - ht], [cx, yb - ht * 0.84], [cx + wt * 0.6, yb - ht], [cx + wt, yb - ht * 0.8], [cx + wb, yb]], false, 6));
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wb - 4 * u, yb - 0.08 * HH], [cx + wb + 4 * u, yb - 0.08 * HH]]), mix(col, INK, 0.55), 0.1 * HH, 0));
    p.poly(body, null, ow);
    p.stroke(R([[cx, yb - ht * 0.82], [cx + (side ? -4 : 0) * u, yb - ht * 0.45]]), 1.6 * u, mul(col, SH_FELT));
    const [bx, by] = R([[cx + (side ? 8 * u : 0), yb + 1 * u]])[0], deg = (a * 180) / Math.PI;
    p.ell(bx, by, (side ? 0.5 : 0.46) * W, 0.065 * HH, shade(col, 0.88), ow, 0, 360, deg);
  } else if (o.hat === "balding") { // shiny dome, fluffy tufts over the ears
    const col = o.hair ?? "#8a5a34", ld = (light * 180) / Math.PI, sk = o.skin ?? SKIN;
    p.arc(cx, hc, H.a * 0.72, H.b * 0.72, ld - 20, ld + 20, 4.5 * u, mix(sk, WHITE, 0.45));
    for (const s of side ? [-1] : [-1, 1]) {
      const tx = cx + s * 0.86 * H.a, ty = hc - 0.22 * H.b, pts: P2[] = [];
      for (let i = 0; i <= 10; i++) { const t = rad(-90 + 180 * (i / 10)), r = 1 + 0.18 * (i % 2); pts.push([tx + s * Math.cos(t) * 0.2 * H.a * r, ty + Math.sin(t) * 0.36 * H.b * r]); }
      p.poly(pts, col, ow * 0.8);
    }
    p.stroke([[cx - 0.25 * H.a, crown + 0.1 * H.b], [cx + 0.05 * H.a, crown + 0.02 * H.b], [cx + 0.3 * H.a, crown + 0.12 * H.b]], 1.6 * u, col);
  } else if (o.hat === "mop") { // 1970s fringe over the brow (the rest falls behind: hatBehind)
    const col = o.hair ?? WIG, cut = crown + 0.27 * HH;
    const keep = (x: number, y: number) => y < cut || (side && x < cx - 6 * u && y < hc + 0.6 * H.b);
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y)).map(([x, y]) => [cx + (x - cx) * 1.06, hc + (y - hc) * 1.06] as P2);
    if (arc.length < 3) return;
    const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
    for (let i = 1; i < 8; i++) arc.push([x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8 + (i % 2 ? 7 * u : 0)]);
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
  } else if (o.hat === "bald") { // shaved head: a faint highlight toward the light
    const ld = (light * 180) / Math.PI, sk = o.skin ?? SKIN;
    p.arc(cx, hc, H.a * 0.76, H.b * 0.76, ld - 24, ld + 24, 4.5 * u, mix(sk, WHITE, 0.4));
    p.arc(cx, hc, H.a * 0.66, H.b * 0.66, ld - 8, ld + 6, 2.5 * u, mix(sk, WHITE, 0.55));
  } else if (o.hat === "tophat") {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W, col = "#2e2a36";
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.jacket, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, "#1d1b22", ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === "sunhat") { // wide-brim safari hat in o.cap
    const col = o.cap ?? "#d9c58a", yb = crown + 0.27 * HH;
    const dome = R(spline([[cx - 0.5 * W * 0.66, yb], [cx - 0.5 * W * 0.6, yb - 0.3 * HH], [cx, yb - 0.46 * HH], [cx + 0.5 * W * 0.6, yb - 0.3 * HH], [cx + 0.5 * W * 0.66, yb]], true, 6));
    p.shadedFill(dome, col, mul(col, SH_FELT), light, 0.4 * W, 0.4);
    p.clip(dome, () => p.band(R([[cx - 0.5 * W, yb - 0.06 * HH], [cx + 0.5 * W, yb - 0.06 * HH]]), mix(col, "#7a5a32", 0.6), 0.075 * HH, 0));
    p.poly(dome, null, ow);
    const [bx, by] = R([[cx, yb + 0.01 * HH]])[0];
    p.ell(bx, by, 0.7 * W, 0.1 * HH, col, ow, 0, 360, (a * 180) / Math.PI);
    p.arc(bx, by + 0.02 * HH, 0.55 * W, 0.07 * HH, 20, 160, 2 * u, mul(col, SH_CLOTH));
  } else if (o.hat === "bonnet") {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  }
};

// ---------------- bodies ----------------
export type Arms = [P2[], P2[]];
/** held prop; for the hammer the number is the strike 0 (raised) .. 1 (struck) */
export type Prop = null | "icecream" | "shako" | "trident" | "quill" | "shard" | "rope" | "write" | ["hammer", number]
  | "brain" | "hook" | "jug" | "razor" | "papyrus" | "book" | "chest" | "point" | "pat"
  | "spear" | "axe" | "basket" | "shrug" | "palms" | "cup" | "chin" | "scratch" | "ground" | "pole" | "shovel" | "trowel" | "skin" | "berry" | ["maul", number] | ["dig", number];
export type LeftHand = "clip" | "chisel" | "thumb" | "hold";

const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
  slim: { a: 112, torso: 1.12, legs: 1.45, tw: 0.68 },
};

export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand" | "sit" | "fall" | "kneel" | "crouch"; look?: number; blink?: boolean | number; lift?: number;
  prop?: Prop; tilt?: number; headTilt?: number; wave?: number;
  /** canvas angle the key light comes FROM (painted crescent + thick outline side) */
  light?: number; facing?: -1 | 0 | 1; seed?: number;
  /** no eyebrows (shaved) */
  nobrows?: boolean;
  /** left arm override (clipboard, chisel, thumbs-up, hand held at the chest) */
  left?: LeftHand;
  /** small motion parameter -1..1 (scratching hand, finger drawing in the dust) */
  reach?: number;
  /** seen from behind: hair instead of a face */
  back?: boolean;
  /** both arms raised above the head, 0 = down .. 1 = fully up and slightly out (overrides the prop) */
  armsUp?: number;
  /** filled with key points in box coords: handR, handL, head (centre), chin, and per prop: brain, hookTip, spout, razor */
  out?: Record<string, [number, number]>;
  // ---- posable arms (Skara Brae): override the prop arms ----
  /** hand target relative to its shoulder in head-heights: [outward (screen right for R, screen left for L), down] */
  armR?: [number, number]; armL?: [number, number];
  /** hand target in final canvas design units (e.g. a world point projected onto the card); wins over armR / armL */
  handR?: [number, number]; handL?: [number, number];
  /** what each hand holds, or one thing held between both hands (drawn at the midpoint) */
  holdR?: Held; holdL?: Held; holdBoth?: Held;
  /** draw that arm over the head (hand at the nose, the brow, the hat) */
  overR?: boolean; overL?: boolean;
  /** legs tucked up (jumping) 0..1 */
  tuck?: number;
  /** a pipe in the mouth corner */
  pipe?: boolean;
  /** dripping wet: drops on the face + flattened hair */
  wet?: boolean;
  /** hatless override: draw `hat` instead of the outfit's hat */
  hat?: string | null;
};
/** held item kinds (drawn at a hand, or between both) and an optional tilt in degrees */
export type HeldK = "hammer" | "spade" | "pot" | "tophat" | "shard" | "tablet" | "twig" | "fish" | "pipe" | "bundle" | "point" | "palm"
  | "pinch" | "fist" | "grip" | "bowl" | "trowel" | "clip" | "dspade";
export type Held = HeldK | { k: HeldK; a?: number; s?: number };

const footStroke = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};

export const bodyFront = (p: Pen, o0: Outfit, opts: FrontOpts) => {
  const o: Outfit = opts.hat !== undefined ? { ...o0, hat: opts.hat } : o0;
  const { phase = 0, expr = "neutral", mode = "march", look = 0, blink = false, lift = 60, prop = null, tilt = 0, headTilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1, nobrows = false, out } = opts;
  const up = clamp(opts.armsUp ?? 0, 0, 1), kneel = mode === "kneel", crouch = mode === "crouch", tuck = clamp(opts.tuck ?? 0, 0, 1);
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  // body bob 5 % (march) / 3 % (stroll) of the height, lowest at contact (phase 0 and 0.5)
  const bob = mode === "march" ? 0.025 * tall * Math.cos(2 * two * phase) : mode === "stroll" ? 0.015 * tall * Math.cos(2 * two * phase) : 0;
  const torsoBot = mode === "sit" ? sole - 0.2 * HH : kneel ? sole - 0.62 * HH : crouch ? sole - 0.55 * Bd.legs * HH : sole - Bd.legs * HH + bob;
  const chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.bareArms ? skin : o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;
  // tailcoat tails hang behind the legs (drawn first, in the upper body's tilt)
  if (o.tails && mode !== "sit") {
    p.rot = tilt ? [rad(tilt), 300, hipY] : null;
    const low = crouch || kneel, Ta = ((Bd.tw / 2) * W) / 1.06, y0 = torsoBot - 0.3 * HH, y1 = low ? hipY + 0.2 * HH : hipY + 0.5 * (sole - hipY), sp = low ? 1.35 : 1;
    for (const s of [-1, 1]) {
      const tp: P2[] = [[300 + s * 0.15 * Ta, y0], [300 + s * 1.02 * Ta, y0], [300 + s * 0.98 * Ta * sp, y1 - 8 * u], [300 + s * 0.78 * Ta * sp, y1], [300 + s * 0.3 * Ta * sp, y1 - 4 * u]];
      p.gradFill(tp, shade(o.jacket, 0.82), mul(o.jacket, SH_CLOTH), light);
      p.poly(tp, null, ow * 0.85);
    }
  }
  // ---- legs + feet (not rotated) ----
  p.rot = null;
  if (crouch) { // deep squat: knees up and out, feet planted under the knees
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 58 * u, hipY - 0.1 * HH], f: P2 = [300 + side * 44 * u, sole - 4 * u];
      p.stroke([h, k, f], legW, legCol);
      footStroke(p, [f[0] - side * 3 * u, f[1]], [f[0] + side * 13 * u, f[1] + 0.5 * u], footW, footCol);
    }
  } else if (tuck > 0 && mode !== "sit" && mode !== "fall" && !kneel) { // jumping: knees up, feet lifted under the body
    for (const side of [-1, 1]) {
      const fy = sole - 4 * u - tuck * 0.42 * HH, fx = 300 + side * (22 + 6 * tuck) * u;
      const k: P2 = [300 + side * (20 + 26 * tuck) * u, (hipY + fy) / 2 - tuck * 0.16 * HH];
      p.stroke([[300 + side * 15 * u, hipY], k, [fx, fy]], legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 3 * u * tuck], footW, footCol);
    }
  } else if (mode === "sit") {
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 36 * u, hipY + 0.2 * HH], f: P2 = [300 + side * 44 * u, sole - 8 * u];
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
  } else if (mode === "fall") {
    const legs: [P2, P2, P2][] = [
      [[300 - 15 * u, hipY], [300 - 46 * u, hipY + 0.5 * HH], [300 - 70 * u, hipY + 0.72 * HH]],
      [[300 + 15 * u, hipY], [300 + 50 * u, hipY + 0.45 * HH], [300 + 76 * u, hipY + 0.22 * HH]],
    ];
    legs.forEach(([h, k, f], i) => {
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, f, [f[0] + (i ? 14 : -14) * u, f[1] + (i ? -6 : 4) * u], footW, footCol);
    });
  } else if (kneel) {
    // shins folded under (hidden behind the knees): only the splayed feet peek out behind, knees on the ground
    // toes peek out behind the knees, knees + shins are broad rounded pads on the ground (classic kneeling statue)
    if (!o.dress) for (const side of [-1, 1]) {
      const kc: P2 = [300 + side * 24 * u, sole - 15 * u], kp = ellC(kc[0], kc[1], 21 * u, 15 * u, side * 8);
      p.shadedFill(kp, o.pants, mul(o.pants, SH_SKIN), light, 17 * u);
      p.inkRing(kp, ow * 0.8, thick);
    }
  } else if (o.dress) {
    for (const side of [-1, 1]) {
      const fx = 300 + side * 12 * u, fy = sole - 4 * u;
      p.stroke([[fx, sole - 0.4 * HH], [fx + side * u, fy]], legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 12 * u, fy + u], footW, footCol);
    }
  } else {
    const L = mode === "march" ? lift * 1.25 : mode === "stroll" ? lift * 0.55 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
      const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u], footW, footCol);
    }
  }
  // ---- upper body: rotates about the hips (tilt + a small weight-shift sway on every step) ----
  const sway = mode === "march" ? 1.6 * Math.sin(two * phase) : mode === "stroll" ? 1.0 * Math.sin(two * phase) : 0;
  const A = tilt + sway;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const dress = !!o.dress && mode !== "sit" && mode !== "fall";
  const T: Blob = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: o.build === "stout" ? 0.17 : 0.12,
    asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const hang = (side: number, fwd: number): [P2, P2, P2] => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u]];
  };
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  // rifle at the order: butt by the right hip, held by the hanging right hand, muzzle past the crown
  const R0: P2 = [300 + 47 * u, torsoBot + 0.12 * HH], R1: P2 = [300 + 64 * u, crown - 0.32 * HH];
  const rifle = !!o.rifle && (mode === "march" || mode === "stand" || mode === "stroll");
  type Arm = { pts: [P2, P2, P2]; front: boolean; post?: boolean; tag?: string; held?: Held };
  const arms: Arm[] = [];
  let pr: Prop = prop;
  let digG: { Tp: P2; E: P2; d: P2 } | null = null;
  const posed = !!(opts.armR || opts.armL || opts.handR || opts.handL);
  if (posed) { // two-bone arms reaching for explicit targets; elbows bend outward and down
    pr = null;
    const th = -rad(A), l1 = 0.5 * HH, l2 = 0.5 * HH;
    for (const side of [-1, 1]) {
      const S0 = sh(side), abs = side > 0 ? opts.handR : opts.handL, rel = side > 0 ? opts.armR : opts.armL;
      let Tg: P2;
      if (abs) { const dx = abs[0] - 300, dy = abs[1] - hipY; Tg = [300 + dx * Math.cos(th) - dy * Math.sin(th), hipY + dx * Math.sin(th) + dy * Math.cos(th)]; }
      else if (rel) Tg = [S0[0] + side * rel[0] * HH, S0[1] + rel[1] * HH];
      else Tg = mode === "sit" ? [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH] : hang(side, side * sw)[2];
      let dx = Tg[0] - S0[0], dy = Tg[1] - S0[1], d = Math.hypot(dx, dy) || 1;
      const reach = 0.995 * (l1 + l2), dn = clamp(d, 0.25 * (l1 + l2), reach);
      dx *= dn / d; dy *= dn / d; d = dn;
      const Hd: P2 = [S0[0] + dx, S0[1] + dy], b = Math.atan2(dy, dx), al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
      const E1: P2 = [S0[0] + l1 * Math.cos(b + al), S0[1] + l1 * Math.sin(b + al)], E2: P2 = [S0[0] + l1 * Math.cos(b - al), S0[1] + l1 * Math.sin(b - al)];
      const sc = (E: P2) => side * (E[0] - S0[0]) + 0.45 * (E[1] - S0[1]);
      const free = !abs && !rel;
      arms.push({ pts: [S0, sc(E1) >= sc(E2) ? E1 : E2, Hd], front: !free || mode === "sit", post: side > 0 ? opts.overR : opts.overL,
        held: side > 0 ? opts.holdR : opts.holdL });
    }
  } else if (mode === "sit" && prop !== "ground") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.1 * T.a + 6 * u), sh(side)[1] + 0.4 * HH], [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
  else if (mode === "fall") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.15 * T.a + 12 * u), sh(side)[1] - 0.25 * HH], [tcx + side * (1.3 * T.a + 24 * u), sh(side)[1] - 0.68 * HH]], front: false });
  else if (up > 0) {
    pr = null;
    for (const side of [-1, 1]) {
      const [S, E0, H0] = hang(side, 0);
      const E1: P2 = [tcx + side * (1.15 * T.a + 20 * u), S[1] - 0.26 * HH], H1: P2 = [tcx + side * (0.95 * T.a + 38 * u), crown - 0.06 * HH];
      const e = up * up * (3 - 2 * up);
      arms.push({ pts: [S, lerp2(E0, E1, e), lerp2(H0, H1, e)], front: false });
    }
  } else if (kneel && !prop) { // hands clasped in front of the chest, raised (begging)
    for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.05 * T.a + 6 * u), sh(side)[1] + 0.42 * HH], [tcx + side * 3.5 * u, chin + 0.14 * HH]], front: true });
  } else if (prop === "papyrus" || prop === "book") { // both hands hold the sheet / book up in front of the chest
    const hy = chin + (prop === "papyrus" ? 0.42 : 0.5) * HH, hx = (prop === "papyrus" ? 0.84 : 0.8) * T.a;
    for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.12 * T.a + 6 * u), sh(side)[1] + 0.5 * HH], [tcx + side * hx, hy]], front: true });
  } else if (prop === "shrug" || prop === "palms" || prop === "cup") {
    for (const side of [-1, 1]) {
      const Sh = sh(side);
      const pts: [P2, P2, P2] = prop === "shrug" ? [Sh, [tcx + side * (1.2 * T.a + 12 * u), Sh[1] + 0.36 * HH], [tcx + side * (1.28 * T.a + 44 * u), Sh[1] + 0.02 * HH]]
        : prop === "palms" ? [Sh, [tcx + side * (1.12 * T.a + 6 * u), Sh[1] + 0.5 * HH], [tcx + side * 0.5 * T.a, chin + 0.8 * HH]]
        : [Sh, [tcx + side * (1.02 * T.a + 6 * u), Sh[1] + 0.42 * HH - 0.2 * HH * clamp(opts.reach ?? 0, 0, 1)], [tcx + side * 0.17 * T.a, chin + (0.4 - 0.5 * clamp(opts.reach ?? 0, 0, 1)) * HH]];
      arms.push({ pts, front: true, post: prop === "cup" });
    }
  } else {
    arms.push({ pts: prop === "shako" ? hang(-1, 0) : hang(-1, -sw), front: false });
    const lm = opts.left ?? (o.clip ? "clip" : undefined);
    if (lm) {
      const S0 = sh(-1);
      const hp2: P2 = lm === "clip" ? [tcx - 0.42 * T.a, chin + 0.7 * HH] : lm === "chisel" ? [tcx - 0.5 * T.a, chin + 0.5 * HH]
        : lm === "thumb" ? [tcx - 1.2 * T.a - 22 * u, S0[1] - 0.1 * HH] : [tcx - 0.5 * T.a, chin + 0.45 * HH];
      const el: P2 = lm === "thumb" ? [tcx - 1.2 * T.a - 14 * u, S0[1] + 0.3 * HH] : [tcx - 1.12 * T.a - 6 * u, S0[1] + 0.45 * HH];
      arms[0] = { pts: [S0, el, hp2], front: true, tag: lm };
    }
    const S = sh(1);
    if (rifle) {
      const G = lerp2(R0, R1, 0.1);
      arms.push({ pts: [sh(1), [tcx + 1.12 * T.a + 5 * u, sh(1)[1] + 0.45 * HH], G], front: false });
    } else if (wave !== undefined) {
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.6 * HH]], front: false });
    } else if (prop === "icecream") {
      arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.5 * T.a, S[1] + 0.4 * HH]], front: true });
    } else if (Array.isArray(prop) && prop[0] === "dig") {
      const k = clamp(prop[1], 0, 1), ph = rad(-32 + 118 * k), d: P2 = [Math.cos(ph), Math.sin(ph)];
      const H1: P2 = [tcx + 0.8 * T.a + 6 * u, chin + 0.6 * HH + 0.1 * HH * k];
      const Tp: P2 = [H1[0] - d[0] * 0.3 * HH, H1[1] - d[1] * 0.3 * HH], H2: P2 = [Tp[0] + d[0] * 0.8 * HH, Tp[1] + d[1] * 0.8 * HH];
      digG = { Tp, E: [Tp[0] + d[0] * 1.85 * HH, Tp[1] + d[1] * 1.85 * HH], d };
      const S0 = sh(-1);
      arms[0] = { pts: [S0, [tcx - 0.1 * T.a, S0[1] + 0.62 * HH], H2], front: true, tag: "dig" };
      arms.push({ pts: [S, [tcx + 1.18 * T.a + 8 * u, S[1] + 0.36 * HH], H1], front: true });
    } else if (prop === "spear" || prop === "shovel" || prop === "axe" || prop === "trowel") {
      arms.push({ pts: [S, [tcx + 1.18 * T.a + 8 * u, S[1] + 0.45 * HH], [tcx + 1.2 * T.a + 14 * u, chin + 0.78 * HH]], front: true });
    } else if (prop === "basket") {
      arms.push({ pts: [S, [tcx + 1.15 * T.a + 10 * u, S[1] + 0.42 * HH], [tcx + 1.0 * T.a + 22 * u, chin + 0.68 * HH]], front: true });
    } else if (prop === "pole") {
      arms.push({ pts: [S, [tcx + 1.16 * T.a + 14 * u, S[1] + 0.3 * HH], [tcx + 1.08 * T.a + 22 * u, S[1] - 0.12 * HH]], front: true });
    } else if (prop === "chin" || prop === "berry") {
      arms.push({ pts: [S, [tcx + 1.12 * T.a + 14 * u, S[1] + 0.3 * HH], [300 + 0.42 * H.a, chin - 0.1 * HH]], front: true, post: true });
    } else if (prop === "scratch") {
      const wg = opts.reach ?? 0;
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 24 * u, S[1] - 0.1 * HH], [300 + 0.62 * H.a + 7 * u * wg, hc - 0.92 * H.b + 3 * u * wg]], front: true, post: true });
    } else if (prop === "ground") {
      arms.push({ pts: [S, [tcx + 1.25 * T.a + 18 * u, S[1] + 0.5 * HH], [tcx + 0.95 * T.a + (30 + 55 * (opts.reach ?? 0)) * u, sole - 10 * u]], front: true });
    } else if (Array.isArray(prop)) {
      const k = clamp(prop[1], 0, 1);
      const E = lerp2([tcx + 1.1 * T.a + 10 * u, S[1] - 0.15 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
      const Hd = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] - 0.55 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else if (prop === "trident" || prop === "quill" || prop === "shard" || prop === "brain" || prop === "hook") {
      // raised forearm, hand at shoulder height in front of the body (holding the prop up)
      const hi = prop === "trident" ? 0.5 : prop === "shard" || prop === "brain" ? -0.12 : prop === "hook" ? 0.15 : 0.1;
      arms.push({ pts: [S, [tcx + 1.15 * T.a + 12 * u, S[1] + 0.3 * HH], [tcx + 1.1 * T.a + 16 * u, S[1] - hi * HH]], front: true });
    } else if (prop === "write") {
      // writing at a lectern to the side: forearm out, hand at lectern height
      arms.push({ pts: [S, [tcx + 1.25 * T.a + 14 * u, S[1] + 0.28 * HH], [tcx + 1.5 * T.a + 34 * u, S[1] + 0.2 * HH]], front: true });
    } else if (prop === "rope") {
      // both arms reach forward-right, pulling a line
      arms.push({ pts: [S, [tcx + 1.3 * T.a + 16 * u, S[1] + 0.12 * HH], [tcx + 1.5 * T.a + 40 * u, S[1] + 0.06 * HH]], front: true });
    } else if (prop === "jug" || prop === "skin") { // held forward at chest height, tilted to pour toward screen right
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 10 * u, S[1] + 0.42 * HH], [tcx + 1.3 * T.a + 22 * u, S[1] + 0.2 * HH]], front: true });
    } else if (prop === "razor") { // hand raised to the temple, blade at the brow (drawn over the head)
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 22 * u, S[1] + 0.2 * HH], [300 + 0.86 * H.a, hc - 0.12 * H.b]], front: true, post: true });
    } else if (prop === "chest") { // flat hand over the heart
      arms.push({ pts: [S, [tcx + 1.12 * T.a + 8 * u, S[1] + 0.42 * HH], [tcx + 0.32 * T.a, chin + 0.33 * HH]], front: true });
    } else if (prop === "point") { // index finger up beside the head
      arms.push({ pts: [S, [tcx + 1.18 * T.a + 18 * u, S[1] + 0.26 * HH], [tcx + 1.05 * T.a + 28 * u, S[1] - 0.36 * HH]], front: true });
    } else if (prop === "pat") { // reaching forward-right, hand flat at waist height (on a table in front)
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 12 * u, S[1] + 0.4 * HH], [tcx + 1.22 * T.a + 26 * u, chin + 0.755 * HH]], front: true });
    } else arms.push({ pts: hang(1, sw), front: false });
  }
  const drawArm = (a: Arm) => { p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol); p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u); };
  const armLine = (a: Arm) => p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol);
  const put = (k: string, q: P2) => { if (out) out[k] = p.P(q[0], q[1]); };
  if (out) {
    const R = arms.length > 1 ? arms[arms.length - 1] : arms[0], L = arms[0];
    put("handR", R.pts[2]); put("handL", L.pts[2]);
  }
  // behind the body: rifle, sword, arms
  if (rifle) {
    p.band([R0, R1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(R0, R1, 0.6), R1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  if (o.sword && mode !== "sit") {
    const s0: P2 = [tcx - 0.75 * T.a, torsoBot - 0.2 * HH];
    p.band([s0, [s0[0] - Math.sin(rad(25)) * 0.8 * HH, s0[1] + Math.cos(rad(25)) * 0.8 * HH]], "#c9ccd2", 3 * u, 1.2 * u, "round");
  }
  if (pr === "hook") { // the rod stands behind the fist
    const [hx, hy] = arms[1].pts[2];
    const tip = hookArt(p, hx, hy + 0.35 * HH, hy - 0.85 * HH, u);
    put("hookTip", tip);
  }
  for (const a of arms) if (!a.front) drawArm(a);
  if (o.pack && !opts.back) { // bundle peeking over the shoulders behind the torso
    packArt(p, tcx, chin + 0.02 * HH, 1.02 * T.a, 0.36 * HH, o.pack, light, u, thick);
  }
  // torso / dress: shaded fill -> clothing clipped to it -> thick-thin ink ring
  if (dress) {
    const dBot = kneel ? sole - 0.03 * HH : sole - 0.35 * HH;
    const D: Blob = { a: 0.5 * W * 0.98, b: 0.5 * (dBot - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0.03 * facing, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300, dBot - D.b, D);
    p.gradFill(dp, o.dress!, mul(o.dress!, SH_CLOTH), light);
    p.inkRing(dp, ow, thick);
    const Sw: Blob = { a: 0.37 * W, b: 0.3 * HH, nTop: 2.2, nBot: 2.4, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: seed + 8 };
    const sp = blobPts(300, chin + 0.12 * HH, Sw);
    p.gradFill(sp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    if (o.collar) p.clip(sp, () => collarArt(p, 300, chin - 0.03 * HH, 0.86 * T.a, 0.34 * HH, o.collar!, u));
    p.inkRing(sp, ow * 0.9, thick);
    if (o.wool) p.clip(sp, () => woolArt(p, 300, chin + 0.12 * HH, 0.7 * W, 0.5 * HH, o.jacket, u));
    if (o.cape) capeArt(p, tcx, T.a, chin, HH, o.cape, light, u, ow, thick);
    if (o.beads && !opts.back) beadsArt(p, 300, chin + 0.04 * HH, 0.5 * T.a, 0.22 * HH, o.beads, u);
  } else {
    if (o.coatLen) { // long coat skirt from the waist (over the legs), split at the front when open
      const waist = torsoBot - 0.2 * HH, hem = Math.min(sole - 30 * u, hipY + o.coatLen * (sole - hipY)), wt = 1.0 * T.a, wb = 1.22 * T.a;
      for (const s of o.coatOpen ? [-1, 1] : [0]) {
        const pts: P2[] = s === 0 ? [[tcx - wt, waist], [tcx + wt, waist], [tcx + wb, hem], [tcx - wb, hem]]
          : [[tcx + s * 0.08 * T.a, waist], [tcx + s * wt, waist], [tcx + s * wb, hem], [tcx + s * 0.2 * T.a, hem]];
        p.gradFill(pts, o.jacket, mul(o.jacket, SH_CLOTH), light);
        p.poly(pts, null, ow * 0.85);
        if (s) p.poly([[tcx + s * 0.5 * T.a, hipY + 0.05 * HH], [tcx + s * 0.85 * T.a, hipY + 0.05 * HH], [tcx + s * 0.86 * T.a, hipY + 0.26 * HH], [tcx + s * 0.52 * T.a, hipY + 0.26 * HH]], shade(o.jacket, 0.94), 1.6 * u);
      }
    }
    p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.clip(tp, () => {
      if (o.tweed) tweedArt(p, tcx, chin, T.a, HH, o.tweed, u);
      if (o.wool) woolArt(p, tcx, (chin + torsoBot) / 2, 1.8 * T.a, torsoBot - chin, o.jacket, u);
      if (o.hivis) for (const yk of [0.5, 0.78]) {
        const y = chin + yk * (torsoBot - chin);
        p.band([[tcx - 1.3 * T.a, y], [tcx + 1.3 * T.a, y]], "#dfe4e8", 0.07 * HH, 1.2 * u);
        p.stroke([[tcx - 1.3 * T.a, y - 0.012 * HH], [tcx + 1.3 * T.a, y - 0.012 * HH]], 1.2 * u, "#ffffff");
      }
      if (o.vest && !opts.back) tailorArt(p, o, tcx + 2 * u * facing, chin, torsoBot, T.a, HH, u, light);
      if (o.belt) {
        for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
        const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
        p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], "#d9dde0", 1.5 * u);
      }
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      for (let i = 0; i < 4; i++) {
        if (o.buttons === "none") break;
        const y = chin + 0.12 * HH + i * 0.2 * HH;
        if (o.sash && Math.abs(y - (torsoBot - 0.32 * HH)) < 0.08 * HH) continue;
        p.dot(tcx + 2 * u * facing, y, 2.2 * u + 0.8 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
      }
      if (o.shawl) { // linen shawl from the left shoulder across to the right hip
        const a0: P2 = [tcx - 0.95 * T.a, chin - 0.02 * HH], a1: P2 = [tcx + 1.05 * T.a, torsoBot - 0.2 * HH];
        p.band([a0, a1], o.shawl, 0.3 * HH, 1.6 * u);
        for (const k of [-0.3, 0.05, 0.35]) {
          const n: P2 = [-(a1[1] - a0[1]), a1[0] - a0[0]], l = Math.hypot(n[0], n[1]), d = k * 0.3 * HH;
          p.stroke([[a0[0] + (n[0] / l) * d + 0.2 * (a1[0] - a0[0]), a0[1] + (n[1] / l) * d + 0.2 * (a1[1] - a0[1])],
            [a0[0] + (n[0] / l) * d + 0.85 * (a1[0] - a0[0]), a0[1] + (n[1] / l) * d + 0.85 * (a1[1] - a0[1])]], 1.4 * u, mul(o.shawl, SH_CLOTH));
        }
      }
      if (o.collar) collarArt(p, tcx, chin - 0.03 * HH, 0.86 * T.a, 0.34 * HH, o.collar, u);
      if (o.pockets) for (const sx of [-1, 1]) {
        const px = tcx + sx * 0.42 * T.a, py = chin + 0.3 * HH;
        p.poly([[px - 15 * u, py], [px + 15 * u, py], [px + 15 * u, py + 30 * u], [px - 15 * u, py + 30 * u]], shade(o.jacket, 0.9), 1.8 * u);
        p.stroke([[px - 15 * u, py + 9 * u], [px + 15 * u, py + 9 * u]], 1.6 * u);
        p.dot(px, py + 9 * u, 2.4 * u, "#6a5a3a");
      }
      if (o.pack && !opts.back) for (const sx of [-1, 1]) p.band([[tcx + sx * 0.7 * T.a, chin - 0.05 * HH], [tcx + sx * 0.3 * T.a, torsoBot - 0.15 * HH]], shade(o.pack, 0.75), 5 * u, 1.5 * u);
    });
    if (o.beads && !opts.back) beadsArt(p, tcx, chin + 0.02 * HH, 0.62 * T.a, 0.3 * HH, o.beads, u);
    if (o.hide) hideFront(p, tcx, T.a, chin, HH, o.hide, light, u, ow, thick);
    if (o.pack && opts.back) packArt(p, tcx, chin + 0.15 * HH, 0.95 * T.a, 0.5 * HH, o.pack, light, u, thick);
    if (o.sash) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
    p.inkRing(tp, ow, thick);
    if (o.kilt) {
      const waist = torsoBot - 0.18 * HH;
      const hem = mode === "sit" ? hipY + 0.22 * HH : kneel || crouch ? Math.min(waist + 0.45 * HH, sole - 24 * u) : hipY + (o.kiltLen ?? 0.43) * (sole - hipY);
      const wb = mode === "sit" || kneel || crouch ? 1.28 * T.a : 1.14 * T.a;
      kiltArt(p, o, tcx, waist, hem, 0.95 * T.a, wb, u, light, thick, ow);
    }
    if (o.cape) capeArt(p, tcx, T.a, chin, HH, o.cape, light, u, ow, thick);
    if ((o.vest || o.cravat || o.bowtie || o.tie) && !opts.back) neckwearArt(p, o, tcx + 2 * u * facing, chin, HH, u);
  }
  // in front of the body: hands holding props
  if (pr === "papyrus" || pr === "book") {
    for (const a of arms) armLine(a);
    const [l, r] = [arms[0].pts[2], arms[1].pts[2]];
    if (pr === "papyrus") papyrusArt(p, l[0], r[0], chin + 0.15 * HH, chin + 0.67 * HH, u, light);
    else bookArt(p, tcx, l[0], r[0], chin + 0.2 * HH, chin + 0.58 * HH, u);
    for (const a of arms) p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u);
  } else for (const a of arms) if (a.front && !a.post) {
    const [hx, hy] = a.pts[2];
    if (a.tag) { drawArm(a); armTag(p, a.tag, hx, hy, u, skin); continue; }
    if (pr === "chest" || pr === "pat") { armLine(a); p.ell(hx, hy, 8 * u, 5 * u, INK, 0, 0, 360, pr === "pat" ? -8 : 20); continue; }
    drawArm(a);
    if (pr === "icecream") {
      p.poly([[hx - 8 * u, hy - 12 * u], [hx + 8 * u, hy - 12 * u], [hx, hy + 7 * u]], "#e0a35a", 1.8 * u);
      p.ell(hx, hy - 19 * u, 11 * u, 10 * u, "#f7c6d9", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "trident") {
      const top = hy - 1.15 * HH, bot = hy + 1.05 * HH, c = o.hat === "cap" ? "#6e4a22" : o.cap ?? "#6e4a22";
      p.band([[hx, bot], [hx, top]], c, 4.5 * u, 1.6 * u, "round");
      p.band([[hx - 16 * u, top + 6 * u], [hx + 16 * u, top + 6 * u]], c, 4 * u, 1.5 * u, "round");
      for (const dx of [-16, 0, 16]) {
        p.band([[hx + dx * u, top + 6 * u], [hx + dx * u, top - (dx ? 20 : 26) * u]], c, 4 * u, 1.5 * u, "round");
        p.poly([[hx + dx * u - 5 * u, top - (dx ? 18 : 24) * u], [hx + dx * u + 5 * u, top - (dx ? 18 : 24) * u], [hx + dx * u, top - (dx ? 31 : 38) * u]], c, 1.5 * u);
      }
      p.dot(hx, hy, 5.5 * u, skin);
    } else if (pr === "quill") {
      p.poly([[hx - 3 * u, hy], [hx + 9 * u, hy - 40 * u], [hx + 16 * u, hy - 34 * u], [hx + 2 * u, hy + 2 * u]], "#f6f1e4", 1.8 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "write") { // the quill, nib down on the scroll
      p.poly([[hx - 2 * u, hy], [hx - 26 * u, hy - 38 * u], [hx - 17 * u, hy - 42 * u], [hx + 3 * u, hy - 2 * u]], "#f6f1e4", 1.8 * u);
      p.stroke([[hx + 1 * u, hy + 1 * u], [hx + 9 * u, hy + 16 * u]], 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "shard") {
      p.poly([[hx - 20 * u, hy - 26 * u], [hx + 16 * u, hy - 32 * u], [hx + 22 * u, hy - 8 * u], [hx + 4 * u, hy + 2 * u], [hx - 18 * u, hy - 6 * u]], "#c0663e", 2 * u);
      p.stroke([[hx - 12 * u, hy - 20 * u], [hx + 12 * u, hy - 24 * u]], 1.5 * u, "#e9b48c");
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "brain") {
      brainArt(p, hx + 10 * u, hy - 24 * u, 31 * u, light, 2.6 * u, null);
      put("brain", [hx + 10 * u, hy - 24 * u]);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "jug") {
      const sp = jugArt(p, hx + 8 * u, hy - 6 * u, u, light);
      put("spout", sp);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "point") {
      p.stroke([[hx + 0.5 * u, hy - 2 * u], [hx + 1.5 * u, hy - 16 * u]], 3.4 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "spear") {
      const top = hy - 1.9 * HH;
      p.band([[hx + 4 * u, hy + 0.62 * HH], [hx + 8 * u, top]], "#8a5a34", 4.2 * u, 1.5 * u, "round");
      p.poly([[hx + 2 * u, top + 2 * u], [hx + 14 * u, top + 2 * u], [hx + 8 * u, top - 32 * u]], "#bdb6a2", 1.8 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "shovel") {
      p.band([[hx - 2 * u, hy - 0.9 * HH], [hx + 2 * u, sole - 34 * u]], "#8a5a34", 4.4 * u, 1.5 * u, "round");
      p.poly([[hx - 15 * u, sole - 38 * u], [hx + 17 * u, sole - 38 * u], [hx + 12 * u, sole - 4 * u], [hx + 1 * u, sole + 3 * u], [hx - 10 * u, sole - 4 * u]], "#ece3c9", 2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "axe") {
      p.band([[hx, hy + 14 * u], [hx + 2 * u, hy - 54 * u]], "#8a5a34", 4.6 * u, 1.5 * u, "round");
      p.poly([[hx - 16 * u, hy - 60 * u], [hx + 18 * u, hy - 66 * u], [hx + 12 * u, hy - 44 * u], [hx - 6 * u, hy - 40 * u]], "#aaa493", 2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "trowel") {
      p.band([[hx, hy + 4 * u], [hx + 22 * u, hy - 18 * u]], "#6a4a2a", 5 * u, 1.4 * u, "round");
      p.poly([[hx + 20 * u, hy - 16 * u], [hx + 48 * u, hy - 46 * u], [hx + 58 * u, hy - 36 * u], [hx + 30 * u, hy - 8 * u]], "#c9ced6", 1.8 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "basket") {
      const by = hy + 18 * u;
      p.stroke(curve([hx - 30 * u, by + 4 * u], [hx, by - 46 * u], [hx + 30 * u, by + 4 * u], 10), 3.2 * u, "#8a6a3a");
      const bk: P2[] = [[hx - 36 * u, by], [hx + 36 * u, by], [hx + 26 * u, by + 50 * u], [hx - 26 * u, by + 50 * u]];
      p.poly(bk, "#cfa05a", 2.4 * u);
      p.clip(bk, () => { for (let i = -3; i <= 3; i++) p.stroke([[hx + i * 11 * u, by], [hx + i * 8 * u, by + 50 * u]], 1.5 * u, "#9a6f35"); for (let j = 1; j < 4; j++) p.stroke([[hx - 40 * u, by + j * 12 * u], [hx + 40 * u, by + j * 12 * u]], 1.5 * u, "#9a6f35"); });
      p.poly(bk, null, 2.4 * u);
      for (const [dx, dy] of [[-18, -3], [-6, -7], [8, -4], [20, -2], [0, 0]]) { if (o.cargo) p.ell(hx + dx * u, by + dy * u - 6 * u, 3.4 * u, 11 * u, o.cargo, 1.4 * u, 0, 360, 12 * dx / 18); else p.ell(hx + dx * u, by + dy * u, 7 * u, 6 * u, "#b32f48", 1.6 * u); }
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "pole") {
      p.band([[hx - 24 * u, hy + 14 * u], [hx + 22 * u, hy - 12 * u]], "#8a5a34", 4.6 * u, 1.5 * u, "round");
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "palms" || pr === "shrug") {
      p.ell(hx, hy - 2 * u, 8.5 * u, 6.8 * u, skin, 2 * u);
      p.stroke([[hx - 4 * u, hy - 1 * u], [hx + 4 * u, hy - 2 * u]], 1.2 * u, mix(skin, INK, 0.45));
    } else if (pr === "skin") { // hide water-skin held tilted to pour toward screen right
      const R2 = (q: P2[]) => rotPts(q, rad(55), hx + 6 * u, hy - 8 * u);
      const bag = R2(spline([[hx - 20 * u, hy - 12 * u], [hx + 6 * u, hy - 34 * u], [hx + 34 * u, hy - 12 * u], [hx + 30 * u, hy + 18 * u], [hx + 6 * u, hy + 28 * u], [hx - 18 * u, hy + 16 * u]], true, 6));
      p.shadedFill(bag, "#9a6a3c", mul("#9a6a3c", SH_CLOTH), light, 34 * u, 0.4);
      p.inkRing(bag, 2.6 * u, thick);
      const sp = R2([[hx + 4 * u, hy - 34 * u], [hx + 16 * u, hy - 46 * u], [hx + 22 * u, hy - 40 * u], [hx + 14 * u, hy - 30 * u]]);
      p.poly(sp, "#6d4824", 2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (pr === "rope") {
      p.stroke([[hx - 30 * u, hy + 4 * u], [600, hy - 6 * u]], 3 * u, "#d8c08a");
      p.dot(hx, hy, 5.5 * u); p.dot(hx - 22 * u, hy + 3 * u, 5.5 * u);
    } else if (Array.isArray(pr) && pr[0] === "dig" && digG) {
      const { Tp, E, d } = digG;
      p.band([Tp, E], "#8a5a34", 4.4 * u, 1.5 * u, "round");
      const nx = -d[1], ny = d[0], B = (a: number, b: number): P2 => [E[0] + d[0] * a + nx * b, E[1] + d[1] * a + ny * b];
      p.poly([B(-46 * u, -13 * u), B(-46 * u, 13 * u), B(8 * u, 15 * u), B(24 * u, 0), B(8 * u, -15 * u)], "#ece3c9", 2 * u);
      p.stroke([B(-38 * u, 0), B(10 * u, 0)], 1.6 * u, "#bfb596");
      p.dot(hx, hy, 5.5 * u); p.dot(arms[0].pts[2][0], arms[0].pts[2][1], 5.5 * u);
    } else if (Array.isArray(pr) && pr[0] === "maul") {
      const ang = rad(-70 + 105 * clamp(pr[1], 0, 1));
      const Rh = (pts: P2[]) => rotPts(pts, ang, hx, hy);
      p.band(Rh([[hx, hy + 14 * u], [hx, hy - 52 * u]]), "#8a5a34", 5 * u, 1.5 * u, "round");
      p.poly(Rh(ellC(hx, hy - 62 * u, 19 * u, 14 * u)), "#a39d8c", 2.4 * u);
      p.stroke(Rh([[hx - 10 * u, hy - 66 * u], [hx + 8 * u, hy - 68 * u]]), 1.6 * u, "#c9c3b0");
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(pr)) {
      const ang = rad(-70 + 105 * clamp(pr[1], 0, 1));
      const Rh = (pts: P2[]) => rotPts(pts, ang, hx, hy);
      p.band(Rh([[hx, hy + 12 * u], [hx, hy - 44 * u]]), "#8a5a34", 5 * u, 1.5 * u, "round");
      p.poly(Rh([[hx - 12 * u, hy - 58 * u], [hx + 20 * u, hy - 58 * u], [hx + 20 * u, hy - 42 * u], [hx - 12 * u, hy - 42 * u]]), "#7d848c", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    }
  }
  if (posed) {
    for (const a of arms) if (a.front && !a.post && a.held) heldArt(p, a.held, a.pts[2][0], a.pts[2][1], u, light, skin, a === arms[0] ? -1 : 1);
    if (opts.holdBoth) {
      const [l, r] = [arms[0].pts[2], arms[arms.length - 1].pts[2]];
      heldArt(p, opts.holdBoth, (l[0] + r[0]) / 2, (l[1] + r[1]) / 2, u, light, skin, 0, Math.abs(r[0] - l[0]));
      for (const a of arms) if (!a.post) p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u);
    }
  }
  if (pr === "shako") { // carried by the left hand
    const [hx, hy] = arms[0].pts[2];
    p.poly([[hx - 14 * u, hy + 3 * u], [hx + 14 * u, hy + 3 * u], [hx + 16 * u, hy + 30 * u], [hx - 16 * u, hy + 30 * u]], "#3a3d47", 2.2 * u);
    p.ell(hx, hy + 31 * u, 3.5 * u, 3.5 * u, "#2b7a4b", 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  // ---- head: rotates with the body, plus its own tilt about the chin ----
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  put("head", [300, hc]); put("chin", [300, chin]);
  if (o.beast === "jackal") jackalHead(p, 300, hc, H.a, H.b, facing || 1, expr, lid, light, ow, skin);
  else {
    hatBehind(p, o, H, 300, hc, light, thick, ow, false);
    const hp = blobPts(300, hc, H);
    if (opts.back) {
      const hood = o.hat === "hood", bald = o.hat === "balding";
      const hcol = hood ? o.cap ?? "#f07a1a" : bald ? skin : o.hair ?? WIG;
      p.shadedFill(hp, hcol, mul(hcol, hood ? SH_CLOTH : bald ? SH_SKIN : SH_FELT), light, H.a);
      p.inkRing(hp, ow, thick);
      if (bald) hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
      else if (!hood) p.clip(hp, () => { for (let i = -3; i <= 3; i++) p.stroke([[300 + i * 0.22 * H.a, hc - 0.9 * H.b], [300 + i * 0.3 * H.a, hc + 0.8 * H.b]], 1.5 * u, mix(hcol, "#9a90a8", 0.3)); });
      if (!hood) for (const sx of [-1, 1]) p.ell(300 + sx * 0.97 * H.a, hc + 0.1 * H.b, 0.1 * H.a, 0.2 * H.b, skin, 2.2 * u); // ears
      if (o.hat === "sunhat" || o.hat === "bun" || o.hat === "tophat" || o.hat === "trilby" || o.hat === "cap") hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
    } else {
    p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
    p.inkRing(hp, ow, thick);
    hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
    const brim = !!o.hat && !NOBRIM.has(o.hat);
    faceFront(p, 300, hc, W, expr, facing, look, lid, brim, skin, o.moustache, o.build === "stout", o.beard, nobrows, o.shortBeard, o.glasses,
      { glassesK: o.glassesK, whiskers: o.whiskers, sideburns: o.sideburns, pipe: opts.pipe, wet: opts.wet });
    }
  }
  // arms that pass in front of the head (razor at the brow)
  p.rot = A ? [rad(A), 300, hipY] : null;
  for (const a of arms) if (a.post) {
    const [hx, hy] = a.pts[2];
    armLine(a);
    if (pr === "cup" && a === arms[1]) {
      const lh = arms[0].pts[2], mx0 = (lh[0] + hx) / 2, my0 = (lh[1] + hy) / 2;
      p.ell(mx0, my0 + 2 * u, 25 * u, 15 * u, skin, 2.4 * u, 0, 180);
      p.ell(mx0, my0 + 2 * u, 21 * u, 6 * u, "#8fd3ff", 1.6 * u, 0, 360);
      p.dot(lh[0], lh[1], 5.5 * u);
    }
    if (posed && a.held) { heldArt(p, a.held, hx, hy, u, light, skin, a === arms[0] ? -1 : 1); continue; }
    if (pr === "berry") p.ell(hx + 3 * u, hy - 3 * u, 7 * u, 7 * u, "#b32f48", 2 * u);
    if (pr === "razor") {
      const bl: P2[] = [[hx - 2 * u, hy - 3 * u], [hx - 15 * u, hy - 9 * u], [hx - 22 * u, hy - 4 * u], [hx - 16 * u, hy + 2 * u], [hx - 2 * u, hy + 2 * u]];
      p.poly(bl, "#c9944f", 1.8 * u);
      p.stroke([[hx - 20 * u, hy - 4.5 * u], [hx - 14 * u, hy - 7.5 * u]], 1.4 * u, "#f3d9a0");
      put("razor", [hx - 20 * u, hy - 4 * u]);
    }
    p.dot(hx, hy, 5.5 * u);
  }
  p.rot = null;
};

export type SideOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stand" | "swing" | "push"; blink?: boolean | number; stomp?: number; pose?: number;
  /** step length as a multiple of 0.8 m (370 units): matches 1.6 m/s at 2 steps/s; scale by the view's foreshortening */
  stride?: number; light?: number; seed?: number;
  /** extra forward lean (deg) */
  lean?: number;
  /** hauling a rope: 0..1 strain, both hands forward */
  rope?: number;
  /** carries a spear / digging stick in the near hand */
  spear?: boolean;
  /** carries a basket on the near arm */
  basket?: boolean;
  /** push mode: where the hands land at pose 1, in final canvas units (e.g. the swing kid's back) */
  hand?: [number, number];
  /** hatless override (see FrontOpts.hat) */
  hat?: string | null;
  /** something carried: "spade" over the shoulder, "bundle" on the back, "hammer" in the near hand, "tablet" held */
  carry?: "spade" | "bundle" | "hammer" | "tablet" | "pot" | "twig";
  /** walking speed-up for time-lapse streaks (no effect on the drawing yet) */
  pipe?: boolean;
};

/** two-bone leg, knee bending forward (+x) */
const ik = (hip: P2, ank: P2, l1: number, l2: number): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), k = Math.atan2(dy, dx) - A;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** hip height of the seated kid in `swing` mode (design units); swingKid seats the torso bottom on the plank */
const SWING_HIP = 733;

/** side view facing screen-right; march footfalls land at phase 0 (near foot) and 0.5 (far foot), like the front view.
 *  The stance foot is planted: it slides back at exactly the walking speed while the hip rises and falls over it. */
export const bodySide = (p: Pen, o0: Outfit, opts: SideOpts) => {
  const o: Outfit = opts.hat !== undefined ? { ...o0, hat: opts.hat } : o0;
  const { phase = 0, expr = "neutral", mode = "march", blink = false, stomp = 1, pose = 0, stride = 1, light = DEF_LIGHT, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H: Blob = { ...headBlob(seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u;
  const legLen = (Bd.legs + 0.12) * HH - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots;
  type LegS = { ank: P2; pitch: number; near: boolean };
  const legs: LegS[] = [];
  let hipY = ankY - legLen * 0.995, lean = 0, nearFwd = 0;
  if (mode === "march") {
    const S = 370 * stride, liftH = Math.max(22, 40 + 70 * (stomp - 1));
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5; // swing: cycloid in world space, so the foot leaves and lands at zero ground speed
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - 0.035 * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const)
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    lean = 4 + 3 * Math.cos(2 * two * phase) + (opts.lean ?? 0); // 7 deg at contact, 1 deg at passing
    nearFwd = nL.x / (S / 2);
  } else if (mode === "push") {
    hipY = ankY - 0.87 * legLen;
    legs.push({ ank: [300 - 0.5 * legLen, ankY], pitch: rad(-8), near: false }, { ank: [300 + 0.32 * legLen, ankY], pitch: 0, near: true });
    lean = 14 * pose;
  } else if (mode === "swing") {
    hipY = SWING_HIP;
    const a = rad(60 * pose);
    for (const [dx, near] of [[-6, false], [0, true]] as const) {
      const knee: P2 = [300 + l1 * 0.98 + dx * u, hipY + 6 * u];
      legs.push({ ank: [knee[0] + l2 * Math.sin(a), knee[1] + l2 * Math.cos(a)], pitch: -a * 0.5, near });
    }
  } else {
    legs.push({ ank: [300 - 4 * u, ankY], pitch: 0, near: false }, { ank: [300 + 4 * u, ankY], pitch: 0, near: true });
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hip: P2 = [300, hipY];
  p.rot = null;
  for (const L of legs) {
    const knee = mode === "swing" ? ([300 + l1 * 0.98 + (L.near ? 0 : -6 * u), hipY + 6 * u] as P2) : ik(hip, L.ank, l1, l2);
    const hp0: P2 = [300 + (L.near ? 0 : -5 * u), hipY];
    p.stroke([hp0, knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + 13 * u * c, L.ank[1] + 13 * u * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  // ---- upper body leans about the hip ----
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const T: Blob = { a: (o.build === "stout" ? 0.36 : 0.31) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5, egg: 0.1, asym: 0.06,
    rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const armCol = mix(o.bareArms ? skin : o.jacket, INK, 0.5), farArm = mix(o.bareArms ? skin : o.jacket, INK, 0.68);
  const S: P2 = [tcx + 0.05 * T.a, chin + 0.14 * HH], aLen = 0.95 * HH;
  const swingArm = (ang: number): [P2, P2, P2] => {
    const e: P2 = [S[0] + Math.sin(ang) * aLen * 0.5, S[1] + Math.cos(ang) * aLen * 0.5], a2 = ang + rad(16) * Math.sign(ang || 1);
    return [S, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };
  const rifle = !!o.rifle && (mode === "march" || mode === "stand");
  const hasRope = opts.rope !== undefined && mode === "march";
  const B0: P2 = [tcx + 0.72 * T.a, chin + 0.58 * HH], B1: P2 = [tcx - 0.95 * T.a - 22 * u, crown - 0.4 * HH];
  let near: [P2, P2, P2], far: [P2, P2, P2] | null;
  if (mode === "swing") { near = [S, [S[0] + 12 * u, S[1] - 0.16 * HH], [300 + 6 * u, chin - 0.3 * HH]]; far = [S, [S[0] + 8 * u, S[1] - 0.18 * HH], [300 + 2 * u, chin - 0.36 * HH]]; }
  else if (mode === "push") {
    const reach = 0.55 * HH + 0.45 * HH * pose;
    let hN: P2 = [S[0] + reach, S[1] + 0.06 * HH];
    if (opts.hand) {
      // target is in final canvas units; the arm is drawn inside the lean rotation, so undo it
      const th = -rad(lean), dx = opts.hand[0] - 300, dy = opts.hand[1] - hipY;
      const tg: P2 = [300 + dx * Math.cos(th) - dy * Math.sin(th), hipY + dx * Math.sin(th) + dy * Math.cos(th)];
      hN = [hN[0] + (tg[0] - hN[0]) * pose, hN[1] + (tg[1] - hN[1]) * pose];
    }
    near = [S, [(S[0] + hN[0]) / 2, (S[1] + hN[1]) / 2 + 0.06 * HH], hN];
    far = [S, [(S[0] + hN[0]) / 2 - 4 * u, (S[1] + hN[1]) / 2 - 0.02 * HH], [hN[0] - 6 * u, hN[1] - 0.08 * HH]];
  } else if (hasRope) {
    const r = opts.rope!, hN: P2 = [S[0] + (0.7 + 0.22 * r) * HH, S[1] + (0.34 - 0.12 * r) * HH];
    near = [S, [S[0] + 0.3 * HH, S[1] + 0.34 * HH], hN];
    far = [S, [S[0] + 0.28 * HH, S[1] + 0.3 * HH], [hN[0] - 14 * u, hN[1] - 0.04 * HH]];
  } else if (opts.spear || opts.basket) { near = [S, [S[0] + 0.12 * HH, S[1] + 0.46 * HH], [S[0] + 0.2 * HH, S[1] + 0.84 * HH]]; far = mode === "march" ? swingArm(rad(30) * nearFwd) : null; }
  else if (rifle) { near = [S, [S[0] - 4 * u, S[1] + 0.42 * HH], B0]; far = mode === "march" ? swingArm(rad(30) * nearFwd) : swingArm(0); }
  else { near = swingArm(rad(-30) * nearFwd); far = mode === "march" ? swingArm(rad(30) * nearFwd) : null; }
  if (opts.carry === "spade") near = [S, [S[0] + 0.08 * HH, S[1] + 0.42 * HH], [S[0] + 0.32 * HH, S[1] + 0.32 * HH]];
  else if (opts.carry === "tablet" || opts.carry === "pot") near = [S, [S[0] + 0.04 * HH, S[1] + 0.44 * HH], [S[0] + 0.42 * HH, S[1] + 0.34 * HH]];
  if (far) { p.stroke(curve(far[0], far[1], far[2]), 5.2 * u, farArm); p.dot(far[2][0], far[2][1], 5.5 * u); }
  if (o.pack || opts.carry === "bundle") packArt(p, tcx - 0.62 * T.a, chin + 0.42 * HH, 0.62 * T.a, 0.58 * HH, o.pack ?? "#9a7a4e", light, u, thick);
  if (opts.carry === "spade") { // over the shoulder: handle from the hand at the chest back over the shoulder, blade up behind
    const h0: P2 = [S[0] + 0.32 * HH, S[1] + 0.32 * HH], h1: P2 = [S[0] - 0.62 * HH, S[1] - 0.62 * HH];
    p.band([h0, h1], "#8a5a34", 4.4 * u, 1.5 * u, "round");
    const d: P2 = [(h1[0] - h0[0]) / Math.hypot(h1[0] - h0[0], h1[1] - h0[1]), (h1[1] - h0[1]) / Math.hypot(h1[0] - h0[0], h1[1] - h0[1])];
    const n: P2 = [-d[1], d[0]], B = (a: number, b: number): P2 => [h1[0] + d[0] * a + n[0] * b, h1[1] + d[1] * a + n[1] * b];
    p.poly([B(-6 * u, -14 * u), B(-6 * u, 14 * u), B(40 * u, 16 * u), B(52 * u, 0), B(40 * u, -16 * u)], "#9aa0a8", 2 * u);
  }
  if (o.tails) { // tailcoat tail hanging behind the legs
    const yk = hipY + 0.5 * (ankY - hipY);
    const tl: P2[] = [[tcx - 0.95 * T.a, torsoBot - 0.3 * HH], [tcx - 0.05 * T.a, torsoBot - 0.24 * HH], [tcx - 0.45 * T.a, yk], [tcx - 1.15 * T.a, yk - 6 * u]];
    p.gradFill(tl, shade(o.jacket, 0.85), mul(o.jacket, SH_CLOTH), light);
    p.poly(tl, null, ow * 0.85);
  }
  if (o.dress || o.coatLen) { // skirt / long coat over the legs
    const waist = torsoBot - 0.2 * HH, hem = o.dress ? ankY - 0.3 * HH : Math.min(ankY - 30 * u, hipY + o.coatLen! * (ankY - hipY)), col = o.dress ?? o.jacket;
    const sk: P2[] = [[tcx - 0.95 * T.a, waist], [tcx + 0.95 * T.a, waist], [tcx + 1.35 * T.a, hem], [tcx - 1.2 * T.a, hem + 4 * u]];
    p.gradFill(sk, col, mul(col, SH_CLOTH), light);
    p.poly(sk, null, ow * 0.9);
  }
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.tweed) tweedArt(p, tcx, chin, T.a, HH, o.tweed, u);
    if (o.wool) woolArt(p, tcx, (chin + torsoBot) / 2, 2 * T.a, torsoBot - chin, o.jacket, u);
    if (o.hivis) for (const yk of [0.5, 0.78]) { const y = chin + yk * (torsoBot - chin); p.band([[tcx - 1.3 * T.a, y], [tcx + 1.3 * T.a, y]], "#dfe4e8", 0.07 * HH, 1.2 * u); }
    if (o.vest) { // a sliver of waistcoat + shirt at the open front edge
      p.poly([[tcx + 0.55 * T.a, chin - 0.05 * HH], [tcx + 1.2 * T.a, chin - 0.05 * HH], [tcx + 1.2 * T.a, torsoBot], [tcx + 0.72 * T.a, torsoBot]], o.vest, 1.6 * u);
      p.poly([[tcx + 0.75 * T.a, chin - 0.05 * HH], [tcx + 1.2 * T.a, chin - 0.05 * HH], [tcx + 1.1 * T.a, chin + 0.22 * HH]], o.shirt ?? "#f6f3ea", 1.4 * u);
    }
    if (o.belt) p.band([[tcx - 0.65 * T.a, chin - 0.05 * HH], [tcx + 0.75 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (!o.dress && !o.kilt && !o.beast && !o.vest && !o.hivis && !o.wool) for (let i = 0; i < 3; i++) { const y = chin + 0.16 * HH + i * 0.24 * HH; p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7)); }
  });
  p.inkRing(tp, ow, thick);
  if (o.cravat || o.bowtie || o.tie) neckwearArt(p, o, tcx + 0.85 * T.a, chin, HH, u, true);
  if (o.cape) { // hump of fur over the shoulders
    const cp = spline([[tcx - 1.15 * T.a, chin + 0.3 * HH], [tcx - 0.6 * T.a, chin - 0.06 * HH], [tcx + 0.4 * T.a, chin - 0.04 * HH], [tcx + 1.05 * T.a, chin + 0.24 * HH], [tcx + 0.2 * T.a, chin + 0.36 * HH], [tcx - 0.7 * T.a, chin + 0.42 * HH]], true, 6);
    p.gradFill(cp, o.cape, mul(o.cape, SH_CLOTH), light);
    p.inkRing(cp, ow * 0.85, thick);
  }
  if (o.hide) hideSide(p, tcx, T.a, chin, HH, o.hide, light, u, ow, thick);
  if (o.kilt) {
    const waist = torsoBot - 0.18 * HH, hem = hipY + (o.kiltLen ?? 0.43) * (ankY - hipY);
    kiltArt(p, o, tcx - 2 * u, waist, hem, 1.02 * T.a, 1.3 * T.a, u, light, thick, ow, true);
  }
  if (rifle) {
    p.band([B0, B1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(B0, B1, 0.6), B1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  p.stroke(curve(near[0], near[1], near[2]), 5.2 * u, armCol); p.dot(near[2][0], near[2][1], 5.5 * u);
  if (opts.carry === "hammer" || opts.carry === "tablet" || opts.carry === "pot" || opts.carry === "twig") heldArt(p, opts.carry, near[2][0], near[2][1], u, light, skin, 1);
  if (opts.spear) {
    const [hx, hy] = near[2], top = hy - 1.75 * HH;
    p.band([[hx - 10 * u, hy + 0.55 * HH], [hx + 18 * u, top]], "#8a5a34", 4.2 * u, 1.5 * u, "round");
    p.poly([[hx + 12 * u, top + 6 * u], [hx + 24 * u, top + 2 * u], [hx + 19 * u, top - 30 * u]], "#bdb6a2", 1.8 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  if (opts.basket) {
    const [hx, hy] = near[2], by = hy + 2 * u, bk: P2[] = [[hx - 30 * u, by], [hx + 30 * u, by], [hx + 22 * u, by + 44 * u], [hx - 22 * u, by + 44 * u]];
    p.poly(bk, "#cfa05a", 2.4 * u);
    p.clip(bk, () => { for (let j = 1; j < 4; j++) p.stroke([[hx - 40 * u, by + j * 11 * u], [hx + 40 * u, by + j * 11 * u]], 1.4 * u, "#9a6f35"); });
    p.poly(bk, null, 2.4 * u);
    for (const [dx, dy] of [[-14, -3], [0, -6], [14, -3]]) p.ell(hx + dx * u, by + dy * u, 7 * u, 6 * u, "#b32f48", 1.6 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  if (o.beads) beadsArt(p, tcx + 0.15 * T.a, chin + 0.04 * HH, 0.4 * T.a, 0.22 * HH, o.beads, u, true);
  // ---- head ----
  const hx = 300 + 4 * u;
  hatBehind(p, o, H, hx, hc, light, thick, ow, true);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.whiskers) { // mutton chop in front of the ear
    const pts: P2[] = [];
    for (let i = 0; i <= 12; i++) { const a = rad(-90 + 180 * (i / 12)), r = 1 + 0.15 * (i % 2); pts.push([hx + 4 * u + Math.cos(a) * 14 * u * r * (i > 5 ? 1.2 : 0.8), hc + 12 * u + Math.sin(a) * 26 * u * r]); }
    p.poly(pts, o.whiskers, 2.4 * u);
  }
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true);
  const brim = !!o.hat && !NOBRIM.has(o.hat);
  faceSide(p, hx, hc, W, expr, lid, brim, skin, o.moustache, o.build === "stout", o.glasses, o.beard);
  if (o.sideburns) p.poly([[hx - 2 * u, hc - 16 * u], [hx + 8 * u, hc - 14 * u], [hx + 6 * u, hc + 16 * u], [hx - 4 * u, hc + 12 * u]], o.sideburns, 2 * u);
  if (opts.pipe) {
    const m0: P2 = [hx + 36 * u, hc + 22 * u], m1: P2 = [hx + 56 * u, hc + 30 * u];
    p.band([m0, m1], "#2a1d18", 3 * u, 1.2 * u, "round");
    p.poly([[m1[0] - 6 * u, m1[1] - 12 * u], [m1[0] + 8 * u, m1[1] - 12 * u], [m1[0] + 6 * u, m1[1] + 6 * u], [m1[0] - 4 * u, m1[1] + 6 * u]], "#7a4a2a", 2.2 * u);
  }
  p.rot = null;
};

/** rope + seat + seated kid on a 700 x 2300 canvas; the pivot is design (350, 20); kid drawn at 0.92 scale */
export const swingKid = (p: Pen, o: Outfit, kick: number, expr: Expr, light = DEF_LIGHT, blink: number = 0) => {
  const rope = 1830, k = 1.1, HH = 2 * headBlob(5, BUILD[o.build ?? "adult"].a, 1).b;
  // two ropes from the pivot to the ends of a wide plank, the kid framed between them: a single rope behind the kid
  // ended at the cap and read as a hanging. Far rope behind the kid, near rope drawn over (clear of the face).
  const seat = rope + 18, x0 = 150, x1 = 550;
  p.line([[350, 20], [x0 + 16, seat + 4]], "#a07a4c", 10);
  p.poly(rrect(x0, seat, x1, seat + 36, 10), "#b5653f", 9);
  const g = p.g;
  g.save();
  g.translate(350 - 300 * k, rope + 18 - (SWING_HIP + 0.12 * HH) * k);
  g.scale(k, k);
  bodySide(new Pen(g), o, { expr, mode: "swing", pose: kick, light, seed: 5, blink });
  g.restore();
  p.line([[350, 20], [x1 - 16, seat + 4]], "#a07a4c", 10);
};

// ---------------- effects ----------------
export const fxNote = (p: Pen, kind: number, col = "#1f2a44") => {
  p.ell(70, 200, 46, 34, col, 8, 0, 360, -20);
  p.stroke([[110, 190], [110, 40]], 14);
  if (kind === 0) p.poly([[110, 40], [170, 70], [170, 110], [110, 82]], col, 8);
  else {
    p.ell(150, 170, 40, 30, col, 8, 0, 360, -20);
    p.stroke([[186, 160], [186, 20]], 14);
    p.poly([[110, 40], [186, 20], [186, 50], [110, 70]], col, 8);
  }
};

/** spark / impact star on a 500 x 500 canvas; t in 0..1 */
export const fxBurst = (p: Pen, t: number, col = "#fff3b0", rays = 10, r0 = 40, r1 = 230) => {
  const c = 250, e = 1 - (1 - t) ** 3;
  for (let i = 0; i < rays; i++) {
    const a = rad((i * 360) / rays + 7 * (i % 2)), ra = r0 + (r1 - r0) * e * (0.75 + 0.25 * (i % 2));
    p.poly([[c + r0 * 0.5 * Math.cos(a + 0.18), c + r0 * 0.5 * Math.sin(a + 0.18)], [c + ra * Math.cos(a), c + ra * Math.sin(a)],
      [c + r0 * 0.5 * Math.cos(a - 0.18), c + r0 * 0.5 * Math.sin(a - 0.18)]], col, Math.max(3, 8 * (1 - t)));
  }
  if (t < 0.5) p.ell(c, c, r0 * (1.4 - t), r0 * (1.4 - t), WHITE, 8);
};

/** water splash crown on an 800 x 800 canvas; t in 0..1 */
export const fxSplash = (p: Pen, t: number) => {
  const c = 400, size = 800, rise = Math.sin(Math.min(1, t * 1.3) * Math.PI);
  const blue = "#bfe8ff", deep = "#6cc0f0";
  if (rise > 0.02) {
    const pts: P2[] = [];
    for (let i = 0; i < 19; i++) {
      const h = (i % 2 ? 260 : 130) * rise * (0.7 + 0.3 * Math.sin(i * 1.7));
      pts.push([c - 330 + (660 * i) / 18, size - 120 - h]);
    }
    p.poly([...pts, [c + 330, size - 90], [c - 330, size - 90]], blue, 10);
    p.ell(c, size - 100, 360, 46, deep, 10);
  }
  for (let i = 0; i < 8; i++) {
    const a = rad(200 + i * 18), d = 120 + 380 * t, y = size - 160 + d * Math.sin(a) + 520 * t * t, r = 26 * (1 - t) + 6;
    if (t > 0.08 && y < size - 40) p.ell(c + d * Math.cos(a), y, r, r * 1.25, blue, 7);
  }
};

/** dust puff on a 300 x 300 canvas; t in 0..1 */
export const fxPuff = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = rad(160 + i * 55), d = 40 + 70 * t, r = (34 + 20 * (i % 2)) * (1 - 0.6 * t);
    p.ell(150 + d * Math.cos(a), 180 + d * 0.45 * Math.sin(a), r, r * 0.8, `rgba(232,214,182,${(0.85 * (1 - t)).toFixed(3)})`, 0);
  }
};

/** circling stars on a 420 x 210 canvas */
export const fxStars = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI) / 2, x = 210 + 150 * Math.cos(a), y = 110 + 40 * Math.sin(a), pts: P2[] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, b = rad(k * 36 - 90); pts.push([x + r * Math.cos(b), y + r * Math.sin(b)]); }
    p.poly(pts, "#ffd84a", 6);
  }
};

/** three jittering strain ticks on a 300 x 300 canvas */
export const fxCreak = (p: Pen, t: number) => {
  const j = 6 * Math.sin(t * 40);
  for (const a of [-30, 0, 30]) {
    const b = rad(a - 90);
    p.stroke([[150 + 70 * Math.cos(b) + j, 230 + 70 * Math.sin(b)], [150 + 100 * Math.cos(b) + 10 + j, 230 + 100 * Math.sin(b)],
      [150 + 130 * Math.cos(b) + j, 230 + 130 * Math.sin(b)]], 10);
  }
};

/** flat water ring (drawn top-down) on a 600 x 600 canvas; t in 0..1 */
export const fxRing = (p: Pen, t: number) => {
  // thin light water rings (white crest, pale blue trailing rings), thinning as they spread
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = t - k * 0.22;
    if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.ellipse(300, 300, 60 + 230 * u, 60 + 230 * u, 0, 0, Math.PI * 2);
    g.strokeStyle = k === 0 ? "#f6fcff" : "#cfe8fa"; g.lineWidth = 9 * (1 - u) + 3; g.stroke();
  }
};

/** text-free sign on a 700 x 520 canvas: "no marching in step on the bridge". A bridge (deck + arch + piers), four
 *  identical pairs of marching legs in the same stride (in step), a bold red X over all of it. */
export const fxSign = (p: Pen) => {
  const g = p.g, RED = "#d42f2f";
  p.poly(rrect(14, 14, 686, 506, 40), "#f6ecd2", 0);
  p.poly(rrect(14, 14, 686, 506, 40), null, 14);
  // bridge: deck, stone arch underneath, two piers
  p.poly(rrect(70, 352, 630, 384, 8), "#8a5a3a", 9);
  g.beginPath(); g.moveTo(112, 470); g.quadraticCurveTo(350, 300, 588, 470);
  g.strokeStyle = INK; g.lineWidth = 16; g.lineCap = "round"; g.stroke();
  for (const x of [88, 612]) p.poly(rrect(x - 16, 384, x + 16, 470, 4), "#8a5a3a", 9);
  // four identical soldiers' legs mid-stride: same leg forward on every one = in step
  for (const x of [150, 278, 406, 534]) {
    p.poly(rrect(x - 30, 150, x + 30, 214, 14), "#357650", 9);                  // coat hem
    p.stroke([[x - 8, 210], [x + 34, 262], [x + 46, 338]], 15, INK);           // front leg
    p.stroke([[x + 6, 210], [x - 12, 274], [x - 36, 336]], 15, INK);           // back leg
    p.poly(rrect(x + 30, 330, x + 74, 350, 9), INK, 0);                          // boots point forward
    p.poly(rrect(x - 52, 328, x - 8, 348, 9), INK, 0);
  }
  // big red X
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [[number, number], [number, number]][]) {
    p.stroke([a, b], 58, "#ffffff");
    p.stroke([a, b], 42, RED);
  }
};

/** soft cartoon cloud on a 600 x 300 canvas */
export const fxCloud = (p: Pen, seed: number) => {
  const blobs: [number, number, number][] = [[150, 190, 80], [250, 150, 105], [360, 160, 95], [450, 195, 70], [300, 210, 90]];
  for (const [x, y, r] of blobs) p.ell(x + ((seed * 37) % 20) - 10, y, r, r * 0.8, "#ffffff", 0);
  p.ell(300, 235, 230, 40, "#ffffff", 0);
};

/** cast shadow on a 128 x 256 canvas: dark soft contact pool at the feet (y 205) and a softer tail that runs up the
 *  canvas = away from the sun, fading with distance; multiply colour (sRGB-encoded linear ratio), white = no change */
export const fxShadow = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 256);
  g.save(); g.filter = "blur(9px)";
  const lg = g.createLinearGradient(0, 205, 0, 22);
  lg.addColorStop(0, mix(col, WHITE, 0.08)); lg.addColorStop(0.55, mix(col, WHITE, 0.3)); lg.addColorStop(1, mix(col, WHITE, 0.85));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(40, 205); g.bezierCurveTo(36, 120, 46, 50, 64, 30); g.bezierCurveTo(82, 50, 92, 120, 88, 205); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(64, 205, 30, 17, 0, 0, Math.PI * 2); g.fill();
  g.restore();
};

/** tight contact shadow right under the feet on a 128 x 128 canvas: dark core, short fall-off (multiply colour) */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.32, 0.02], [0.5, 0.22], [0.66, 0.58], [0.82, 0.88], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

/** floating wooden plank, side-on, on a 320 x 110 canvas */
export const fxPlank = (p: Pen) => {
  p.poly(rrect(14, 30, 306, 78, 10), "#a8744a", 9);
  p.line([[40, 46], [150, 44], [270, 50]], "#7d5234", 4);
  p.line([[60, 62], [200, 64], [284, 60]], "#7d5234", 4);
  p.dot(36, 54, 5, INK); p.dot(284, 54, 5, INK);
};

/** floating marching drum (no text) on a 260 x 240 canvas: white shell, red hoops, ink zig-zag cord */
export const fxDrum = (p: Pen) => {
  p.poly(rrect(40, 70, 220, 190, 16), "#f1ece0", 9);
  p.poly(rrect(32, 58, 228, 86, 12), "#c9373a", 8);
  p.poly(rrect(32, 176, 228, 204, 12), "#c9373a", 8);
  p.line([[52, 88], [82, 172], [112, 88], [142, 172], [172, 88], [202, 172]], INK, 6);
  p.ell(130, 58, 98, 18, "#f7f3ea", 8);
};

/** soft ground contact blob on a 128 x 128 canvas, multiply colour (sRGB-encoded linear ratio) in the centre */
export const fxBlob = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  // soft contact shadow: flat core, then a long smooth (roughly gaussian) fall-off to white = no change
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.5, 0.04], [0.64, 0.18], [0.76, 0.42], [0.87, 0.72], [0.95, 0.92], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

// =====================================================================================================================
// ---------------- Egypt: helpers ----------------
const GOLD = "#e8b440", TURQ = "#2fa3a0", LINEN = "#f3eee0", BRONZE = "#b9874a", CLAY = "#c8743f", PAPY = "#efdcaa";
const BRAIN = "#f4a3b4", FOLD = "#c9667e", BAND = "#efe3c4", JACKAL = "#2a2430";

/** Catmull-Rom spline through the points (closed contour or open polyline) */
export const spline = (pts: P2[], closed = true, n = 8): P2[] => {
  const N = pts.length, out: P2[] = [];
  const at = (i: number) => (closed ? pts[((i % N) + N) % N] : pts[clamp(i, 0, N - 1)]);
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (j: 0 | 1) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
};
const ellC = (cx: number, cy: number, rx: number, ry: number, rot = 0): P2[] => ellPts(cx, cy, rx, ry, 0, 360, rot, 56).slice(0, -1);
const bbox = (pts: P2[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};
/** painted fill (crescent for round shapes, broad gradient for long ones) + thick-thin ink ring from the light */
const litFill = (p: Pen, pts: P2[], col: string, light: number, ow: number, shadow?: string, grad?: boolean) => {
  const b = bbox(pts), sh = shadow ?? mul(col, SH_CLOTH);
  if (grad ?? Math.max(b.w, b.h) > 1.7 * Math.min(b.w, b.h)) p.gradFill(pts, col, sh, light);
  else p.shadedFill(pts, col, sh, light, 0.25 * (b.w + b.h), 0.4);
  if (ow) p.inkRing(pts, ow, thickAngle(light));
};
const withAlpha = (p: Pen, a: number, fn: () => void) => { const g = p.g, o = g.globalAlpha; g.globalAlpha = o * clamp(a, 0, 1); fn(); g.globalAlpha = o; };

/** broad bead collar: half ring under the chin, 3 bands (gold, turquoise, `col`) + teardrop beads on the rim */
const collarArt = (p: Pen, cx: number, top: number, rx: number, ry: number, col: string, u: number) => {
  const ks = [0.42, 0.62, 0.81, 1.0], cols = [GOLD, TURQ, col];
  for (let a = 14; a <= 166; a += 12.6) {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    p.ell(cx + rx * c, top + ry * s + 3 * u, 2.6 * u, 4 * u, shade(col, 0.85), 1.1 * u, 0, 360, a - 90);
  }
  const seg = (k0: number, k1: number): P2[] => [...ellPts(cx, top, rx * k1, ry * k1, 0, 180), ...ellPts(cx, top, rx * k0, ry * k0, 180, 0)];
  for (let i = 0; i < 3; i++) {
    p.poly(seg(ks[i], ks[i + 1]), cols[i], 0);
    const km = (ks[i] + ks[i + 1]) / 2;
    for (let a = 8; a <= 172; a += 11) p.dot(cx + rx * km * Math.cos(rad(a)), top + ry * km * Math.sin(rad(a)), 1.2 * u, shade(cols[i], 0.72));
  }
  for (const k of ks) p.arc(cx, top, rx * k, ry * k, 0, 180, k === 1 ? 2.2 * u : 1.2 * u);
};

/** linen kilt: flared wrap skirt with a belt, 3 pleats and a front tab (or a leather apron) */
const kiltArt = (p: Pen, o: Outfit, cx: number, waist: number, hem: number, wt: number, wb: number, u: number, light: number, thick: number,
  ow: number, side = false) => {
  const col = o.kilt!, trim = o.kiltTrim ?? shade(col, 0.9), fold = mix(col, INK, 0.38);
  const pts = spline([[cx - wt, waist], [cx, waist - 1.5 * u], [cx + wt, waist], [cx + 0.5 * (wt + wb), (waist + hem) / 2], [cx + wb, hem - 3 * u],
    [cx + wb * 0.5, hem + 2 * u], [cx, hem + 3 * u], [cx - wb * 0.5, hem + 2 * u], [cx - wb, hem - 3 * u], [cx - 0.5 * (wt + wb), (waist + hem) / 2]], true, 6);
  p.gradFill(pts, col, mul(col, SH_CLOTH), light);
  const tx = side ? cx + 0.55 * wt : cx;
  p.clip(pts, () => {
    for (const k of side ? [-0.5, 0.0, 0.45] : [-0.6, 0.3, 0.62])
      p.stroke([[cx + k * wt + 2 * u, waist + 5 * u], [cx + k * wb + 0.18 * wb, hem + 2 * u]], 1.5 * u, fold);
    p.band([[cx - wt - 6 * u, waist + 3 * u], [cx + wt + 6 * u, waist + 3 * u]], trim, 5 * u, 1.2 * u);
  });
  if (o.apron) {
    const ap: P2[] = [[tx - 0.55 * wt, waist + 4 * u], [tx + 0.55 * wt, waist + 4 * u], [tx + 0.6 * wb, hem + 4 * u], [tx - 0.6 * wb, hem + 4 * u]];
    p.gradFill(ap, o.apron, mul(o.apron, SH_CLOTH), light);
    p.poly(ap, null, 2 * u);
    for (let i = 0; i < 5; i++) p.dot(tx - 0.42 * wt + (i * 0.84 * wt) / 4, waist + 9 * u, 1.3 * u, shade(o.apron, 0.6));
  } else if (!side) {
    p.poly([[tx - 7 * u, waist + 5 * u], [tx + 7 * u, waist + 5 * u], [tx + 13 * u, hem - 3 * u], [tx, hem + 2 * u], [tx - 13 * u, hem - 3 * u]], trim, 1.6 * u);
  }
  p.inkRing(pts, ow * 0.9, thick);
};

/** bronze rod standing up through the fist, curled hook at the top; returns the hook tip */
const hookArt = (p: Pen, x: number, yb: number, yt: number, u: number): P2 => {
  p.band([[x, yb], [x, yt]], BRONZE, 2.6 * u, 1.2 * u, "round");
  const r = 5 * u, pts: P2[] = [];
  for (let a = 180; a <= 420; a += 12) pts.push([x + r + r * Math.cos(rad(a)), yt + r * Math.sin(rad(a))]);
  p.band(pts, BRONZE, 2.4 * u, 1.1 * u, "round");
  return pts[pts.length - 1];
};

/** round clay jug tilted 60 deg (pouring to screen right); returns the spout tip */
const jugArt = (p: Pen, cx: number, cy: number, u: number, light: number): P2 => {
  const R = (q: P2[]) => rotPts(q, rad(60), cx, cy), th = thickAngle(light);
  p.band(R(curve([cx - 13 * u, cy - 8 * u], [cx - 23 * u, cy - 18 * u], [cx - 7 * u, cy - 21 * u], 8)), shade(CLAY, 0.85), 3 * u, 1.3 * u, "round");
  const neck = R([[cx - 7 * u, cy - 10 * u], [cx + 7 * u, cy - 10 * u], [cx + 8 * u, cy - 25 * u], [cx - 8 * u, cy - 25 * u]]);
  p.poly(neck, shade(CLAY, 0.9), 2 * u);
  const sp = R([[cx + 5 * u, cy - 23 * u], [cx + 17 * u, cy - 30 * u], [cx + 7 * u, cy - 18 * u]]);
  p.poly(sp, shade(CLAY, 0.9), 1.8 * u);
  const [lx, ly] = R([[cx, cy - 25 * u]])[0];
  p.ell(lx, ly, 9.5 * u, 3.5 * u, shade(CLAY, 0.6), 1.8 * u, 0, 360, 60);
  const body = R(ellC(cx, cy, 17 * u, 16 * u));
  p.shadedFill(body, CLAY, mul(CLAY, SH_CLOTH), light, 17 * u, 0.4);
  p.clip(body, () => p.band(R([[cx - 20 * u, cy - 4 * u], [cx + 20 * u, cy - 4 * u]]), "#7a3a22", 2.6 * u, 0));
  p.inkRing(body, 2.4 * u, th);
  return R([[cx + 17 * u, cy - 30 * u]])[0];
};

/** small hieroglyph-like pictograms (no letters): 0 eye, 1 bird, 2 water, 3 reed, 4 brain squiggle, 5 sun */
export const glyph = (p: Pen, k: number, x: number, y: number, s: number, col = INK) => {
  const w = 0.17 * s;
  switch (k % 6) {
    case 0:
      p.poly([...ellPts(x, y, s, 0.45 * s, 180, 360, 0, 12), ...ellPts(x, y, s, 0.4 * s, 0, 180, 0, 12)], null, w * 0.8);
      p.dot(x, y, 0.28 * s, col);
      p.stroke(curve([x - 0.1 * s, y + 0.4 * s], [x - 0.15 * s, y + 0.8 * s], [x + 0.3 * s, y + 0.95 * s], 6), w, col);
      p.stroke([[x - 0.9 * s, y - 0.7 * s], [x + 0.9 * s, y - 0.65 * s]], w, col);
      break;
    case 1:
      p.ell(x - 0.05 * s, y + 0.1 * s, 0.55 * s, 0.36 * s, col, 0);
      p.ell(x + 0.5 * s, y - 0.32 * s, 0.22 * s, 0.22 * s, col, 0);
      p.stroke([[x + 0.66 * s, y - 0.3 * s], [x + 0.95 * s, y - 0.24 * s]], w, col);
      p.stroke([[x - 0.5 * s, y + 0.05 * s], [x - 0.95 * s, y + 0.3 * s]], w * 1.2, col);
      p.stroke([[x - 0.1 * s, y + 0.4 * s], [x - 0.15 * s, y + 0.9 * s]], w * 0.8, col);
      p.stroke([[x + 0.15 * s, y + 0.4 * s], [x + 0.2 * s, y + 0.9 * s]], w * 0.8, col);
      break;
    case 2:
      for (const dy of [-0.3, 0.35]) {
        const z: P2[] = [];
        for (let i = 0; i <= 8; i++) z.push([x - s + (i * 2 * s) / 8, y + dy * s + (i % 2 ? -0.18 : 0.18) * s]);
        p.stroke(z, w, col);
      }
      break;
    case 3:
      p.stroke([[x, y + 0.95 * s], [x, y - 0.6 * s]], w * 1.2, col);
      p.poly([[x, y - 0.4 * s], [x + 0.45 * s, y - 0.95 * s], [x + 0.15 * s, y - 0.2 * s]], col, 0);
      p.stroke([[x, y + 0.2 * s], [x - 0.4 * s, y - 0.2 * s]], w, col);
      break;
    case 4: {
      const b: P2[] = [];
      for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2, r = 1 + 0.12 * Math.cos(5 * t); b.push([x + 0.85 * s * r * Math.cos(t), y + 0.6 * s * r * Math.sin(t)]); }
      p.poly(b, null, w * 0.8);
      p.stroke(curve([x - 0.5 * s, y + 0.1 * s], [x, y - 0.25 * s], [x + 0.45 * s, y + 0.15 * s], 6), w * 0.7, col);
      break;
    }
    default:
      p.ell(x, y, 0.7 * s, 0.7 * s, null, w);
      p.dot(x, y, 0.2 * s, col);
  }
};

const papyrusArt = (p: Pen, xl: number, xr: number, yt: number, yb: number, u: number, light: number) => {
  const sheet = rrect(xl, yt, xr, yb, 2 * u);
  p.gradFill(sheet, PAPY, mul(PAPY, [0.86, 0.84, 0.8]), light);
  p.poly(sheet, null, 2 * u);
  const rows = 3, cols = 4, cw = (xr - xl - 14 * u) / cols, rh = (yb - yt - 6 * u) / rows, s = Math.min(cw, rh) * 0.34;
  const seq = [0, 1, 2, 3, 4, 5, 3, 1, 2, 0, 4, 1];
  for (let r = 0; r < rows; r++) {
    if (r) p.stroke([[xl + 8 * u, yt + 3 * u + r * rh], [xr - 8 * u, yt + 3 * u + r * rh]], 0.9 * u, "#b5653f");
    for (let c = 0; c < cols; c++)
      glyph(p, seq[r * cols + c], xl + 7 * u + (c + 0.5) * cw, yt + 3 * u + (r + 0.5) * rh, s, (r + c) % 3 === 2 ? "#a3402c" : INK);
  }
  for (const x of [xl, xr]) {
    p.poly(rrect(x - 5 * u, yt - 4 * u, x + 5 * u, yb + 4 * u, 4 * u), shade(PAPY, 0.86), 2 * u);
    p.ell(x, yt - 2 * u, 3 * u, 1.6 * u, shade(PAPY, 0.7), 1.2 * u);
  }
};

const bookArt = (p: Pen, cx: number, xl: number, xr: number, yt: number, yb: number, u: number) => {
  const BOOK = "#3f6fb5";
  p.poly([[cx, yt + u], [xr + 4 * u, yt - 3 * u], [xr + 4 * u, yb + 3 * u], [cx, yb + 8 * u], [xl - 4 * u, yb + 3 * u], [xl - 4 * u, yt - 3 * u]], BOOK, 2 * u);
  for (const s of [-1, 1]) {
    const x = s < 0 ? xl : xr;
    p.poly([[cx, yt + 4 * u], [x, yt], [x, yb], [cx, yb + 4 * u]], "#f8f4ea", 1.6 * u);
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7, y = yt + 4 * u + t * (yb - yt - 4 * u);
      p.stroke([[cx + s * 5 * u, y + 1.5 * u], [x - s * 5 * u, y - 1.5 * u * 0]], 1.3 * u, "#b9bccb");
    }
  }
  p.stroke([[cx, yt + 4 * u], [cx, yb + 4 * u]], 1.8 * u);
};

/** pink cartoon brain, side view (frontal lobe to the left), folds as darker curvy lines */
export const brainArt = (p: Pen, cx: number, cy: number, rx: number, light: number, ow: number, face: Expr | null) => {
  const ry = rx * 0.74, sh = mix(BRAIN, FOLD, 0.6), fw = Math.max(1.2, 0.045 * rx);
  // brain stem + cerebellum behind
  p.poly(rrect(cx + 0.18 * rx, cy + 0.45 * ry, cx + 0.42 * rx, cy + 1.08 * ry, 0.1 * rx), shade(BRAIN, 0.85), ow * 0.8);
  const cb = ellC(cx + 0.5 * rx, cy + 0.62 * ry, 0.36 * rx, 0.3 * ry);
  litFill(p, cb, shade(BRAIN, 0.92), light, ow * 0.8, sh);
  for (const k of [-0.1, 0.08]) p.arc(cx + 0.5 * rx, cy + (0.62 + k) * ry, 0.28 * rx, 0.12 * ry, 10, 170, fw * 0.8, FOLD);
  const main: P2[] = [];
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2, r = 1 + 0.035 * Math.cos(11 * t + 1) + 0.02 * Math.cos(7 * t);
    main.push([cx + rx * r * Math.cos(t), cy + ry * r * Math.sin(t) * (Math.sin(t) > 0 ? 0.8 : 1)]);
  }
  litFill(p, main, BRAIN, light, 0, sh);
  p.clip(main, () => {
    const sq = (x0: number, y0: number, x1: number, y1: number, amp: number, n: number) => {
      const pts: P2[] = [], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      for (let i = 0; i <= 16; i++) { const t = i / 16, s = Math.sin(t * Math.PI * n) * amp; pts.push([x0 + dx * t - (dy / l) * s, y0 + dy * t + (dx / l) * s]); }
      p.stroke(pts, fw, FOLD);
    };
    // lateral fissure + central sulcus
    p.stroke(curve([cx - 0.55 * rx, cy + 0.42 * ry], [cx - 0.05 * rx, cy + 0.12 * ry], [cx + 0.55 * rx, cy - 0.05 * ry], 14), fw * 1.2, FOLD);
    p.stroke(curve([cx + 0.1 * rx, cy - 1.0 * ry], [cx - 0.02 * rx, cy - 0.5 * ry], [cx + 0.12 * rx, cy + 0.05 * ry], 14), fw * 1.1, FOLD);
    const many: [number, number, number, number, number, number][] = face
      ? [[-0.85, -0.3, -0.45, -0.75, 0.06, 3], [0.3, -0.85, 0.75, -0.4, 0.06, 3], [0.55, 0.05, 0.9, 0.2, 0.05, 2], [-0.5, 0.65, 0.1, 0.62, 0.05, 3]]
      : [[-0.85, -0.3, -0.45, -0.75, 0.06, 3], [-0.6, -0.05, -0.15, -0.45, 0.06, 3], [0.3, -0.85, 0.75, -0.4, 0.06, 3], [0.3, -0.35, 0.8, 0.0, 0.06, 3],
        [-0.75, 0.3, -0.3, 0.1, 0.05, 2], [0.55, 0.05, 0.9, 0.2, 0.05, 2], [-0.5, 0.65, 0.1, 0.62, 0.05, 3], [-0.3, -0.25, 0.0, -0.6, 0.05, 2]];
    for (const [a, b, c, d, amp, n] of many) sq(cx + a * rx, cy + b * ry, cx + c * rx, cy + d * ry, amp * rx, n);
  });
  p.inkRing(main, ow, thickAngle(light));
  if (face) faceFront(p, cx - 0.12 * rx, cy + 0.18 * ry, 0.95 * rx, face, 0, 0, 0, false, BRAIN);
};

/** jackal head in profile (Anubis), snout toward s = +1 (screen right) or -1; a, b = head half sizes */
export const jackalHead = (p: Pen, cx: number, cy: number, a: number, b: number, s: number, expr: Expr, lid: number, light: number,
  ow: number, skin = JACKAL) => {
  const Q = (x: number, y: number): P2 => [cx + s * x * a, cy + y * b], u = a / 50, th = thickAngle(light);
  const base = mix(skin, "#8a7a9a", 0.3), hi = mix(base, "#d8cce6", 0.3);
  const ear = (dx: number, col: string, inner: boolean) => {
    const b0 = Q(-0.6 + dx, -0.55), tip = Q(-0.3 + dx, -1.95), b1 = Q(0.12 + dx, -0.8);
    const pts = [...curve(b0, Q(-0.56 + dx, -1.3), tip, 10), ...curve(tip, Q(-0.02 + dx, -1.3), b1, 10).slice(1), Q(-0.2 + dx, -0.5)];
    p.shadedFill(pts, col, skin, light, 0.5 * a, 0.3);
    if (inner) p.poly([Q(-0.45 + dx, -0.7), Q(-0.31 + dx, -1.62), Q(-0.06 + dx, -0.8)], GOLD, 0);
    p.inkRing(pts, ow * 0.85, th);
  };
  ear(-0.32, mix(base, INK, 0.25), false);
  ear(0, base, true);
  const hp = spline([Q(-0.3, -0.86), Q(0.08, -0.9), Q(0.4, -0.62), Q(0.66, -0.3), Q(1.0, -0.14), Q(1.32, -0.02), Q(1.44, 0.12), Q(1.38, 0.3),
    Q(1.0, 0.38), Q(0.55, 0.52), Q(0.28, 0.78), Q(0.08, 1.0), Q(-0.5, 0.92), Q(-0.8, 0.3), Q(-0.72, -0.42)], true, 8);
  p.shadedFill(hp, base, skin, light, a, 0.45);
  p.stroke(spline([Q(0.45, -0.52), Q(0.85, -0.2), Q(1.26, -0.04)], false, 6), 2.2 * u, hi);
  p.inkRing(hp, ow, th);
  p.ell(...Q(1.37, 0.1), 0.09 * a, 0.08 * b, "#0c080e", 0); // nose
  const F = FACE[expr], kind = eyeKind(F.eye[1], lid), [ex, ey] = Q(0.42, -0.28), erx = 0.17 * a, ery = 0.1 * b;
  // gold kohl line running back from the eye + gold brow
  p.stroke([Q(0.26, -0.27), Q(0.02, -0.18)], 2.6 * u, GOLD);
  const [dI, dO] = F.brow;
  taper(p, [ex + s * 0.13 * a, ey - 0.25 * b + dI * u], [ex - s * 0.14 * a, ey - 0.24 * b + dO * u], 4.5 * u, 2.2 * u, GOLD);
  const pale = "#efe6d2";
  if (kind === "happy") p.arc(ex, ey + 3 * u, erx, ery * 1.4, 200, 340, 3.4 * u, pale);
  else if (kind === "squeeze") p.stroke([[ex + s * 6 * u, ey - 5 * u], [ex - s * 6 * u, ey], [ex + s * 6 * u, ey + 5 * u]], 3.4 * u, pale);
  else if (kind === "dash") p.stroke([[ex - erx, ey], [ex + erx, ey]], 3.4 * u, pale);
  else {
    const big = kind === "shock" || kind === "shockHalf" || kind === "plead" ? 1.35 : 1, al = ellC(ex, ey, erx * big, ery * big * 1.1, -8 * s);
    p.poly(al, WHITE, 0);
    p.dot(ex + s * 0.06 * a, ey + 0.01 * b, (kind === "small" ? 3 : 4) * u, INK);
    const cover = kind === "lid" ? 0.35 : kind === "slit" || kind === "shockHalf" ? 0.62 : 0;
    if (cover) p.clip(al, () => p.poly([[ex - 2 * erx, ey - 2 * ery], [ex + 2 * erx, ey - 2 * ery], [ex + 2 * erx, ey - ery * big + 2 * cover * ery * big], [ex - 2 * erx, ey - ery * big + 2 * cover * ery * big]], base, 0));
    p.g.save(); p.path(al, true); p.g.strokeStyle = GOLD; p.g.lineWidth = 3 * u; p.g.lineJoin = "round"; p.g.stroke(); p.g.restore();
  }
  // mouth along the lower snout
  const m0 = Q(0.6, 0.42), m1 = Q(1.25, 0.3), mk = F.mouth;
  if (mk === "grin" || mk === "laugh" || mk === "O" || mk === "cryO" || mk === "teeth") {
    const op = [Q(0.58, 0.36), Q(1.25, 0.28), Q(1.15, 0.5), Q(0.7, 0.62)];
    p.poly(op, MOUTH, 2.2 * u);
    p.poly([Q(0.66, 0.37), Q(1.2, 0.29), Q(1.18, 0.36), Q(0.68, 0.45)], WHITE, 1.4 * u);
  } else {
    p.stroke([m0, lerp2(m0, m1, 0.5), m1], 2.8 * u);
    if (mk === "smile" || mk === "smirk" || mk === "smileWide" || mk === "lick") p.stroke(curve(m0, Q(0.5, 0.34), Q(0.47, 0.24), 6), 2.8 * u);
    if (mk === "frown" || mk === "meh") p.stroke(curve(m0, Q(0.52, 0.48), Q(0.5, 0.56), 6), 2.8 * u);
  }
  if (expr === "cry") p.poly([Q(0.4, -0.15), Q(0.46, 0.4), Q(0.36, 0.4)], TEAR, 1.2 * u);
};

// ---------------- Egypt cast (ready-made outfits) ----------------
export const EG_SKINS = ["#c98d5e", "#b07a4f", "#d9a274", "#8f5e3c", "#e0b088"];
/** townsfolk: men bare-chested with a linen kilt and wig or shaved head; women in a pale sheath dress, collar, wig */
export const egyptian = (v = 0): Outfit => {
  const skin = EG_SKINS[v % 5], k = v % 6;
  const man = (hat: string, collar?: string, build?: Build): Outfit =>
    ({ jacket: skin, pants: skin, boots: SANDAL, skin, hat, kilt: LINEN, collar, belt: null, buttons: "none", build });
  const woman = (dress: string, collar: string): Outfit =>
    ({ jacket: dress, pants: skin, boots: SANDAL, skin, hat: "wig", dress, collar, bareArms: true, belt: null, buttons: "none" });
  return [man("wig", "#c0453a"), woman("#f4efe2", "#3f6fb5"), man("bald"), woman("#efe2b8", "#c0453a"), man("wig", undefined, "stout"),
    woman("#dde6ea", "#2fa3a0")][k];
};
export const EMBALMER = (v = 0): Outfit => ({ jacket: EG_SKINS[(v + 1) % 5], pants: EG_SKINS[(v + 1) % 5], boots: SANDAL, skin: EG_SKINS[(v + 1) % 5],
  hat: "bald", kilt: LINEN, apron: "#a9744a", belt: null, buttons: "none", build: v === 0 ? "stout" : "adult" });
export const SCRIBE: Outfit = { jacket: EG_SKINS[2], pants: EG_SKINS[2], boots: SANDAL, skin: EG_SKINS[2], hat: "wig", kilt: LINEN, collar: "#3f6fb5",
  belt: null, buttons: "none", build: "slim" };
export const ANUBIS: Outfit = { jacket: JACKAL, pants: JACKAL, boots: "#7a5a2a", skin: JACKAL, beast: "jackal", kilt: LINEN, kiltTrim: GOLD,
  collar: GOLD, belt: null, buttons: "none", build: "stout" };
export const MOURNER = (v = 0): Outfit => {
  const d = ["#8fa6c2", "#a3b4c9", "#7f93ad"][v % 3], skin = EG_SKINS[(v * 2 + 1) % 5];
  return { jacket: d, pants: skin, boots: SANDAL, skin, hat: "wig", dress: d, bareArms: true, belt: null, buttons: "none" };
};
export const DEAD_MAN: Outfit = { jacket: EG_SKINS[0], pants: EG_SKINS[0], boots: SANDAL, skin: EG_SKINS[0], hat: "wig", kilt: "#f7f4ec", shawl: "#f7f4ec",
  collar: "#c0453a", belt: null, buttons: "none" };
export const ARISTOTLE: Outfit = { ...PLATO, jacket: "#9fb2c8", pants: "#9fb2c8", skin: "#eac49c", hair: "#4a3020", beard: "#4a3020", shortBeard: true };
export const KID_MODERN: Outfit = { jacket: "#e2453c", pants: "#3b5b9a", boots: "#f4f1ea", skin: SKINS[1], hat: "hair", hair: "#5a3b22", buttons: "none",
  belt: null, build: "kid" };

// ---------------- Egypt: standalone lit cards ----------------
/** Egyptian cat on a 600 x 1000 box, ground y = 975. sit = upright seated (lower ~55 %), lie = curled asleep on a red cushion (lower ~30 %) */
export const catDraw = (p: Pen, opts: { pose: "sit" | "lie"; expr?: "sleep" | "neutral" | "smile"; light?: number; col?: string }) => {
  const { pose, light = DEF_LIGHT } = opts, col = opts.col ?? "#d9a45a", ex = opts.expr ?? (pose === "lie" ? "sleep" : "neutral");
  const ow = 10, th = thickAngle(light), str = mul(col, [0.7, 0.56, 0.44]), bib = mix(col, "#fff4dc", 0.6), sh = mul(col, SH_CLOTH);
  p.rot = null;
  const ear = (b0: P2, tip: P2, b1: P2) => {
    const pts = [...curve(b0, [(b0[0] + tip[0]) / 2 - 3, (b0[1] + tip[1]) / 2], tip, 8), ...curve(tip, [(tip[0] + b1[0]) / 2 + 3, (tip[1] + b1[1]) / 2], b1, 8).slice(1)];
    litFill(p, pts, col, light, 0, sh);
    const c: P2 = [(b0[0] + b1[0] + tip[0]) / 3, (b0[1] + b1[1] + tip[1]) / 3 + 6];
    p.poly([b0, tip, b1].map((q) => lerp2(c, q, 0.55)), "#e3a08c", 0);
    p.inkRing(pts, ow * 0.85, th);
  };
  const face = (cx: number, cy: number, u: number) => {
    for (const s of [-1, 1]) {
      const x = cx + s * 17 * u, y = cy - 2 * u;
      if (ex === "sleep") p.arc(x, y - 2 * u, 8 * u, 5 * u, 20, 160, 3.8 * u);
      else eye(p, ex === "smile" ? "happy" : "lid", x, y, u, s, 0, col);
      p.stroke([[cx + s * 18 * u, cy + 13 * u], [cx + s * 44 * u, cy + 9 * u]], 1.4 * u);
      p.stroke([[cx + s * 18 * u, cy + 17 * u], [cx + s * 43 * u, cy + 20 * u]], 1.4 * u);
    }
    p.poly([[cx - 5 * u, cy + 8 * u], [cx + 5 * u, cy + 8 * u], [cx, cy + 13 * u]], "#a8505a", 1.5 * u);
    const mw = ex === "smile" ? 6.5 : 5;
    p.arc(cx - mw * u, cy + 13 * u, mw * u, 4 * u, 10, 170, 2.8 * u);
    p.arc(cx + mw * u, cy + 13 * u, mw * u, 4 * u, 10, 170, 2.8 * u);
    for (const dx of [-8, 0, 8]) p.stroke([[cx + dx * u, cy - 31 * u], [cx + dx * 0.8 * u, cy - 21 * u]], 3 * u, str);
  };
  const head = (cx: number, cy: number, a: number, b: number, rot = 0) => {
    const hp = blobPts(cx, cy, { a, b, nTop: 2.3, nBot: 2.0, egg: -0.2, asym: 0, rot, noise: 0.006, seed: 31 });
    p.shadedFill(hp, col, mul(col, SH_SKIN), light, a);
    p.inkRing(hp, ow, th);
    face(cx, cy + 4, (2 * a) / 100);
  };
  if (pose === "sit") {
    const body = spline([[300, 590], [350, 602], [378, 660], [392, 750], [425, 860], [432, 935], [400, 968], [300, 974], [200, 968], [168, 935],
      [175, 860], [208, 750], [222, 660], [250, 602]]);
    litFill(p, body, col, light, 0, sh);
    p.clip(body, () => {
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++)
        p.stroke(curve([300 + s * 140, 770 + k * 46], [300 + s * 118, 786 + k * 46], [300 + s * 100, 808 + k * 46], 8), 8, str);
    });
    p.inkRing(body, ow, th);
    for (const s of [-1, 1]) {
      const x = 300 + s * 17, leg = rrect(x - 15, 690, x + 15, 960, 14);
      litFill(p, leg, col, light, 0, sh, true);
      p.clip(leg, () => { for (const y of [790, 840, 890]) p.stroke([[x - 16, y], [x + 16, y - 4]], 6, str); });
      p.inkRing(leg, ow * 0.7, th);
      p.ell(x + s * 3, 958, 21, 12, col, ow * 0.7);
      for (const d of [-6, 6]) p.stroke([[x + s * 3 + d, 952], [x + s * 3 + d, 964]], 2.2);
    }
    p.ell(300, 680, 46, 62, bib, 0);
    const tail = spline([[428, 900], [440, 948], [400, 968], [320, 971], [240, 966], [200, 950], [190, 928]], false, 6);
    p.band(tail, col, 20, 4.5, "round");
    p.band(tail.slice(-8), str, 20, 4.5, "round");
    p.band(ellPts(300, 606, 54, 20, 15, 165), GOLD, 7, 2);
    p.ell(300, 630, 8, 9, TURQ, 2.4);
    ear([228, 525], [228, 425], [282, 488]);
    ear([318, 488], [372, 425], [372, 525]);
    head(300, 545, 84, 68);
    p.arc(226, 516, 9, 11, -60, 250, 4, GOLD); // gold earring
  } else {
    const cush = rrect(105, 905, 495, 972, 34);
    litFill(p, cush, "#b8443a", light, ow, undefined, true);
    p.stroke(curve([135, 918], [300, 908], [465, 918], 12), 3, mix("#b8443a", WHITE, 0.3));
    for (const [x, y, s] of [[110, 915, -1], [490, 915, 1]] as const) p.poly([[x, y], [x + s * 18, y - 10], [x + s * 18, y + 12]], GOLD, 2.5);
    const body = spline([[260, 812], [340, 790], [420, 800], [470, 840], [470, 890], [420, 914], [300, 918], [220, 912], [185, 890], [190, 845]]);
    litFill(p, body, col, light, 0, sh);
    p.clip(body, () => { for (let k = 0; k < 5; k++) p.stroke(curve([300 + k * 34, 795], [310 + k * 34, 818], [300 + k * 34, 840], 6), 8, str); });
    p.inkRing(body, ow, th);
    p.arc(410, 868, 46, 36, 190, 330, 3);
    const tail = spline([[462, 872], [478, 905], [430, 925], [330, 930], [250, 925], [212, 912]], false, 6);
    p.band(tail, col, 18, 4.5, "round");
    p.band(tail.slice(-7), str, 18, 4.5, "round");
    p.ell(222, 902, 34, 13, col, ow * 0.7);
    ear([162, 836], [148, 770], [200, 806]);
    ear([222, 802], [258, 760], [264, 826]);
    head(210, 850, 64, 52, 0.12);
  }
};

const LY = { x: 792, y: 370, a: 104 }, lyU = (2 * LY.a) / 100;
/** box coords of the lying body's nostril tip and chest centre (see lyingBody) */
export const LYING_NOSE: [number, number] = [LY.x - 9 * lyU, LY.y - 62 * lyU];
export const LYING_CHEST: [number, number] = [596, 392];
const bandage = (p: Pen, pts: P2[], light: number, ow: number) => {
  litFill(p, pts, BAND, light, 0, "#cdbb92");
  const b = bbox(pts), h = b.h + 20;
  p.clip(pts, () => {
    let i = 0;
    for (let x = b.x0 - h; x < b.x1 + h; x += 17, i++) p.stroke([[x, b.y1 + 10], [x + 0.22 * h, b.y0 - 10]], 2.6, i % 2 ? "#c2ad80" : "#d3c196");
    for (let x = b.x0 - h; x < b.x1 + h; x += 75) p.stroke([[x, b.y0 - 10], [x + 0.8 * h, b.y1 + 10]], 3, "#b39d6e");
  });
  if (ow) p.inkRing(pts, ow, thickAngle(light));
};
/** person lying on the back (side view) on a 1000 x 500 box, table top y = 475; head at the right, face up, eyes closed.
 *  wrap 0 = bare skin under a linen sheet .. 1 = fully mummy-wrapped (wraps from the feet toward the head) */
export const lyingBody = (p: Pen, opts: { wrap: number; expr?: Expr; light?: number; skin?: string }) => {
  const { light = DEF_LIGHT } = opts, skin = opts.skin ?? EG_SKINS[0], w = clamp(opts.wrap, 0, 1), xw = w <= 0 ? -10 : 60 + w * 900;
  const ow = 10, ssh = mul(skin, [0.86, 0.78, 0.78]), expr = opts.expr ?? "neutral";
  p.rot = null;
  const legs = spline([[470, 396], [380, 404], [280, 414], [196, 422], [168, 430], [160, 472], [300, 474], [470, 474]], true, 6);
  const foot = spline([[192, 430], [168, 386], [148, 356], [118, 360], [106, 404], [112, 472], [172, 474]], true, 6);
  const torso = spline([[712, 380], [680, 352], [610, 334], [530, 342], [468, 368], [440, 410], [440, 474], [712, 474]], true, 6);
  const neck = spline([[700, 400], [728, 392], [736, 470], [700, 474]], true, 4);
  const parts = [legs, foot, torso, neck];
  const lclip = (fn: () => void) => p.clip([[-10, -10], [xw, -10], [xw, 510], [-10, 510]], fn);
  const rclip = (fn: () => void) => p.clip([[xw, -10], [1010, -10], [1010, 510], [xw, 510]], fn);
  for (const q of parts) litFill(p, q, skin, light, ow, ssh);
  if (w > 0) lclip(() => { for (const q of parts) bandage(p, q, light, ow); });
  // linen sheet over chest .. ankles (where not wrapped yet)
  const sheet = spline([[662, 330], [610, 320], [530, 328], [460, 354], [420, 384], [330, 398], [210, 410], [158, 418], [146, 478], [300, 485],
    [500, 482], [600, 486], [672, 478]], true, 8);
  rclip(() => {
    litFill(p, sheet, "#f6f3ea", light, ow, "#c9d0dc");
    p.clip(sheet, () => {
      for (const [a, k, b] of [[[600, 336], [590, 410], [605, 482]], [[500, 350], [515, 420], [500, 484]], [[380, 400], [398, 440], [384, 484]],
        [[260, 410], [252, 450], [265, 482]]] as [P2, P2, P2][]) p.stroke(curve(a, k, b, 10), 3, "#c3cad8");
      p.band([[654, 328], [668, 482]], "#fbfaf5", 10, 2);
    });
  });
  // head, in its own frame: local +x (face) -> screen up, local +y (chin) -> screen left
  const L = Math.atan2(-Math.cos(light), -Math.sin(light));
  const H = { ...headBlob(5, LY.a, 1), asym: 0.12, rot: 0 }, u = lyU, hp = blobPts(0, 0, H);
  const inHead = (fn: () => void) => { const g = p.g; g.save(); g.translate(LY.x, LY.y); g.transform(0, -1, -1, 0, 0, 0); fn(); g.restore(); };
  // closed-eyed profile, face up (drawn in box space so the eye and brow lie along the face, not across it)
  const lyFace = (mouthCurve: boolean) => {
    const X = LY.x, Y = LY.y;
    p.arc(X + 4 * u, Y - 36 * u, 8 * u, 4.5 * u, 20, 160, 3.8 * u);
    taper(p, [X + 13 * u, Y - 48 * u], [X + 28 * u, Y - 45 * u], 4.5 * u, 2.2 * u);
    if (mouthCurve || expr === "smile" || expr === "smile_closed" || expr === "relief") p.arc(X - 25 * u, Y - 40 * u, 5 * u, 4 * u, 100, 250, 3.2 * u);
    else p.stroke([[X - 25 * u, Y - 46 * u], [X - 23 * u, Y - 37 * u]], 3.4 * u);
  };
  const headSkin = () => {
    inHead(() => {
      p.ell(56 * u, 9 * u, 7.5 * u, 7 * u, skin, 4 * u); // nose bump
      p.shadedFill(hp, skin, mul(skin, SH_SKIN), L, H.a);
      p.inkRing(hp, 5 * u, thickAngle(L));
      p.ell(55 * u, 9 * u, 6 * u, 5.5 * u, skin, 0);
    });
    lyFace(false);
  };
  headSkin();
  if (xw > LY.x - H.b) lclip(() => inHead(() => {
    if (w >= 0.9) p.ell(56 * u, 9 * u, 7.5 * u, 7 * u, BAND, 4 * u);
    p.clip(hp, () => {
      p.shadedFill(hp, BAND, "#cdbb92", L, H.a);
      let i = 0;
      for (let y = -70; y < 70; y += 8, i++) p.stroke([[-70 * u, y * u], [70 * u, (y + 12) * u]], 2.6, i % 2 ? "#c2ad80" : "#d3c196");
      for (let y = -90; y < 70; y += 36) p.stroke([[-70 * u, y * u], [70 * u, (y + 60) * u]], 3, "#b39d6e");
      if (w < 0.9) p.ell(40 * u, 4 * u, 22 * u, 34 * u, skin, 2.5 * u); // face still showing through the opening
    });
    p.inkRing(hp, 5 * u, thickAngle(L));
    if (w >= 0.9) p.ell(55 * u, 9 * u, 6 * u, 5.5 * u, BAND, 0);
  }));
  if (xw > LY.x - H.b && w < 0.9) lclip(() => lyFace(false));
  if (w >= 0.95) withAlpha(p, (w - 0.95) / 0.05, () => lyFace(true)); // calm painted face on the wrapping
};

export const AMMIT_PARTS: { croc: [number, number]; lion: [number, number]; hippo: [number, number] } = { croc: [175, 270], lion: [440, 300], hippo: [760, 330] };
const CROC = "#5e8f4a";
/** crocodile head facing LEFT, hinge at (hx, hy), scale s; upA lifts the upper jaw, lowA drops the lower jaw (degrees) */
const crocArt = (p: Pen, hx: number, hy: number, s: number, upA: number, lowA: number, light: number, ow: number, lick: boolean, eyeK: "hungry" | "smile" | "neutral") => {
  const X = (pts: P2[], a: number): P2[] => pts.map(([x, y]) => [hx + s * (x * Math.cos(a) - y * Math.sin(a)), hy + s * (x * Math.sin(a) + y * Math.cos(a))]);
  const aU = rad(upA), aL = -rad(lowA), sh = mul(CROC, SH_CLOTH), belly = "#c9d38a", th = thickAngle(light);
  const upper = spline([[64, 10], [66, -42], [30, -64], [-60, -56], [-150, -44], [-232, -38], [-262, -52], [-294, -50], [-318, -22], [-312, 4], [-250, 7],
    [-150, 9], [-50, 10]], true, 6);
  const lower = spline([[62, 16], [-50, 13], [-150, 11], [-250, 9], [-306, 9], [-314, 24], [-292, 40], [-200, 46], [-80, 50], [30, 50], [66, 38]], true, 6);
  if (upA + lowA > 0.5) {
    const line = (y: number) => Array.from({ length: 13 }, (_, i) => [-305 + i * 30, y] as P2);
    p.poly([...X(line(8), aU), ...X(line(12), aL).reverse()], "#7a2a34", 0);
    p.poly(X(ellC(-140, 18, 90, 12), aL), TONGUE, 0);
  }
  const lw = X(lower, aL);
  litFill(p, lw, CROC, light, 0, sh);
  p.clip(lw, () => p.poly(X([[-330, 34], [80, 34], [80, 80], [-330, 80]], aL), belly, 0));
  p.inkRing(lw, ow, th);
  const up = X(upper, aU);
  litFill(p, up, CROC, light, ow, sh);
  for (let x = -280; x <= -50; x += 26) {
    p.poly(X([[x - 9, 5], [x + 9, 5], [x, 23]], aU), WHITE, 1.8 * s);
    p.poly(X([[x + 13 - 8, 11], [x + 13 + 8, 11], [x + 13, -6]], aL), WHITE, 1.8 * s);
  }
  for (const [a, b] of [[-210, -32], [-170, -36], [-130, -40], [-90, -46], [-190, -22], [-150, -26], [-110, -30]] as P2[])
    p.stroke(X([[a, b], [a + 16, b - 1]], aU), 3.5 * s, shade(CROC, 0.72));
  for (const x of [8, 34, 56]) p.ell(...X([[x, -50 + (x - 30) * 0.15]], aU)[0], 8 * s, 6 * s, shade(CROC, 0.85), 2 * s);
  const [nx, ny] = X([[-290, -50]], aU)[0];
  p.ell(nx, ny, 11 * s, 8 * s, CROC, 2.2 * s); p.dot(nx - 2 * s, ny - 1 * s, 3.5 * s);
  if (lick) {
    const tg = X(spline([[-200, 6], [-268, -2], [-322, -20], [-326, -50], [-300, -66]], false, 6), aU);
    p.band(tg, TONGUE, 20 * s, 2.8 * s, "round");
    p.stroke(tg.slice(4, -4), 2 * s, mix(TONGUE, INK, 0.35));
  }
  const [ex, ey] = X([[-20, -62]], aU)[0];
  p.ell(ex, ey, 31 * s, 27 * s, CROC, ow * 0.85);
  if (eyeK === "smile") p.arc(ex, ey + 4 * s, 15 * s, 11 * s, 200, 340, 6 * s);
  else {
    const wh = ellC(ex, ey - 2 * s, 20 * s, 18 * s);
    p.poly(wh, WHITE, 0);
    p.dot(ex - 5 * s, ey + 1 * s, 8 * s);
    if (eyeK === "hungry") p.clip(wh, () => p.poly([[ex - 30 * s, ey - 30 * s], [ex + 30 * s, ey - 30 * s], [ex + 30 * s, ey - 12 * s], [ex - 30 * s, ey - 4 * s]], CROC, 0));
    p.poly(wh, null, 3 * s);
    if (eyeK === "hungry") { p.stroke([[ex - 22 * s, ey - 4 * s], [ex + 21 * s, ey - 12 * s]], 4 * s); taper(p, [ex - 18 * s, ey - 26 * s], [ex + 20 * s, ey - 38 * s], 8 * s, 4 * s); }
  }
};

/** Ammit the devourer (side view facing LEFT) on a 1000 x 500 box, ground y = 475: croc head, lion forequarters + mane, hippo rump */
export const ammitDraw = (p: Pen, opts: { jaw: number; lick?: boolean; expr?: "hungry" | "smile"; light?: number }) => {
  const { lick = false, expr = "hungry", light = DEF_LIGHT } = opts, jaw = clamp(opts.jaw, 0, 1), ow = 11, th = thickAngle(light);
  const LION = "#d9a441", MANE = "#b8742e", HIPPO = "#8a7a9a";
  p.rot = null;
  const lionLeg = (x: number, top: number, col: string) => {
    const lg = rrect(x - 22, top, x + 22, 462, 18);
    litFill(p, lg, col, light, ow * 0.8, undefined, true);
    p.ell(x - 8, 461, 32, 13, col, ow * 0.7);
    for (const d of [-22, -8, 6]) p.stroke([[x + d, 452], [x + d, 466]], 2.5);
  };
  const hipLeg = (x: number, top: number, col: string) => {
    const lg = rrect(x - 40, top, x + 40, 470, 26);
    litFill(p, lg, col, light, ow * 0.8, undefined, true);
    for (const d of [-22, 0, 22]) p.arc(x + d, 466, 8, 6, 180, 360, 3, "#efe6d2");
  };
  hipLeg(860, 380, shade(HIPPO, 0.78));
  lionLeg(482, 360, shade(LION, 0.8));
  p.band(spline([[920, 300], [946, 318], [954, 342]], false, 5), HIPPO, 9, 3, "round");
  p.ell(956, 348, 10, 12, shade(HIPPO, 0.7), 3);
  const rump = spline([[560, 255], [650, 212], [760, 200], [860, 222], [918, 285], [930, 360], [900, 425], [820, 452], [700, 455], [590, 440], [550, 380]]);
  litFill(p, rump, HIPPO, light, ow, mul(HIPPO, [0.7, 0.68, 0.76]));
  p.arc(700, 330, 40, 30, 200, 300, 3, shade(HIPPO, 0.7));
  const body: P2[] = [[380, 205], [470, 212], [570, 230], [612, 236], [628, 262], [646, 280], [632, 304], [652, 330], [634, 356], [646, 384], [612, 404],
    [560, 420], [460, 425], [380, 400], [350, 330]];
  const bp = spline(body);
  litFill(p, bp, LION, light, ow);
  hipLeg(740, 400, HIPPO);
  lionLeg(405, 350, LION);
  const mane: P2[] = [];
  for (let i = 0; i < 26; i++) { const t = (i / 26) * Math.PI * 2, r = i % 2 ? 1.0 : 1.14; mane.push([382 + 98 * r * Math.cos(t), 268 + 122 * r * Math.sin(t)]); }
  const mp = spline(mane, true, 4);
  litFill(p, mp, MANE, light, ow, mul(MANE, [0.72, 0.66, 0.66]));
  p.clip(mp, () => { for (let i = 0; i < 9; i++) { const a = rad(i * 40 + 10); p.stroke(curve([382 + 50 * Math.cos(a), 268 + 62 * Math.sin(a)], [382 + 72 * Math.cos(a + 0.2), 268 + 88 * Math.sin(a + 0.2)], [382 + 96 * Math.cos(a), 268 + 118 * Math.sin(a)], 6), 3, shade(MANE, 0.72)); } });
  crocArt(p, 330, 288, 1, jaw * 5, jaw * 32, light, ow, lick, expr);
  if (expr === "hungry" && !lick && jaw < 0.5) { p.stroke([[52, 322], [50, 346]], 4, "#bfe8ff"); p.ell(50, 352, 7, 10, "#bfe8ff", 2.5); }
  void th;
};

/** painted anthropoid coffin on a wooden sledge, side view, head to the right; 1000 x 500 box, ground y = 475 */
export const coffinSledge = (p: Pen, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT, ow = 10, th = thickAngle(light), WOOD = "#a8744a", CG = "#d9a441", BLUE = "#2f4f9a";
  p.rot = null;
  const runner = spline([[70, 434], [900, 434], [948, 422], [966, 394], [986, 398], [972, 440], [930, 467], [70, 467], [56, 450]], true, 6);
  litFill(p, runner, WOOD, light, ow, undefined, true);
  p.clip(runner, () => { for (const y of [446, 456]) p.stroke([[80, y], [920, y + 2]], 2.5, shade(WOOD, 0.75)); });
  const C = spline([[112, 300], [150, 280], [190, 288], [350, 296], [560, 284], [700, 272], [752, 262], [782, 240], [796, 218], [812, 194], [830, 202],
    [856, 196], [896, 212], [926, 262], [934, 340], [920, 428], [118, 430], [102, 380]], true, 8);
  litFill(p, C, CG, light, 0);
  p.clip(C, () => {
    for (const x of [270, 400, 530]) { p.stroke([[x, 250], [x, 450]], 30, GOLD); p.stroke([[x, 250], [x, 450]], 20, BLUE); }
    for (const [k, c] of [[0, "#c0453a"], [1, TURQ], [2, GOLD], [3, BLUE], [4, "#c0453a"]] as [number, string][])
      p.stroke(curve([640 + k * 22, 250], [622 + k * 22, 345], [640 + k * 22, 440], 10), 20, c);
    const wig: P2[] = [[874, 160], [970, 160], [970, 450], [740, 450], [752, 352], [790, 288], [846, 262], [878, 226]];
    p.poly(wig, BLUE, 0);
    p.clip(wig, () => { for (let k = 0; k < 8; k++) p.stroke(curve([878 + k * 14, 220], [800 + k * 22, 320], [756 + k * 28, 450], 10), 6, GOLD); });
    p.stroke(spline([[878, 226], [846, 262], [790, 288], [752, 352]], false, 6), 4);
    p.ell(826, 236, 50, 34, "#efc660", 0);
    p.poly(ellC(842, 226, 15, 7, -6), WHITE, 2.4); p.dot(837, 226, 4.5);
    p.stroke([[828, 229], [800, 236]], 4); p.stroke([[826, 213], [858, 210]], 4);
    p.arc(800, 222, 6, 4, 90, 270, 3);
  });
  p.inkRing(C, ow, th);
  p.band([[770, 252], [748, 228]], BLUE, 11, 2.2, "round"); // false beard
  for (const x of [170, 400, 630, 860]) p.poly(rrect(x - 15, 428, x + 15, 446, 5), shade(WOOD, 0.8), 3);
};

/** canopic jar (600 x 1000 box, ground y = 975), lid head: 0 human, 1 baboon, 2 jackal, 3 falcon */
export const jarDraw = (p: Pen, kind: 0 | 1 | 2 | 3, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT, ow = 11, th = thickAngle(light), AL = "#efe6d2";
  p.rot = null;
  const body = spline([[300, 486], [384, 494], [430, 545], [452, 660], [440, 800], [405, 920], [378, 972], [300, 975], [222, 972], [195, 920], [160, 800],
    [148, 660], [170, 545], [216, 494]], true, 8);
  litFill(p, body, AL, light, 0, mul(AL, [0.8, 0.78, 0.76]));
  p.clip(body, () => {
    p.band([[140, 572], [460, 572]], "#3f6fb5", 14, 2); p.band([[140, 595], [460, 595]], GOLD, 8, 1.5);
    p.band([[140, 915], [460, 915]], "#3f6fb5", 10, 2);
    p.poly(rrect(262, 632, 338, 880, 8), "#f8f3e6", 3);
    glyph(p, 0, 300, 672, 18, INK); glyph(p, 1, 300, 735, 18, "#a3402c"); glyph(p, 2, 300, 790, 18, "#3f6fb5"); glyph(p, 3, 300, 842, 18, INK);
  });
  p.inkRing(body, ow, th);
  const lidc = ellC(300, 488, 116, 22);
  litFill(p, lidc, AL, light, ow * 0.8, mul(AL, [0.8, 0.78, 0.76]), true);
  if (kind === 0) {
    const o: Outfit = { jacket: AL, pants: AL, boots: AL, hat: "wig", hair: "#24366e", skin: "#e0b088" };
    const H = headBlob(4, 102, 0), hc = 374;
    hatBehind(p, o, H, 300, hc, light, th, 10, false);
    const hp = blobPts(300, hc, H);
    p.shadedFill(hp, o.skin!, mul(o.skin!, SH_SKIN), light, H.a); p.inkRing(hp, 10, th);
    hatOn(p, o, hp, H, 300, hc, light, 4, 0, false);
    faceFront(p, 300, hc, 2 * H.a, "neutral", 0, 0, 0, false, o.skin!);
  } else if (kind === 1) { // baboon (Hapi): smooth grey mane hood, long pink muzzle, close-set eyes under a heavy brow
    const G = "#8f9483", FC = "#c99c8c";
    const hood = blobPts(300, 372, { a: 122, b: 108, nTop: 2.1, nBot: 3.5, egg: 0.08, asym: 0, rot: 0, noise: 0.006, seed: 8 }).map(([x, y]) => [x, Math.min(y, 482)] as P2);
    litFill(p, hood, G, light, ow * 0.9, mul(G, SH_FELT));
    p.clip(hood, () => { for (let i = -4; i <= 4; i++) p.stroke(curve([300 + i * 22, 290], [300 + i * 30, 380], [300 + i * 32, 482], 8), 3, shade(G, 0.8)); });
    const fp = blobPts(300, 380, { a: 70, b: 80, nTop: 2.0, nBot: 2.0, egg: -0.1, asym: 0, rot: 0, noise: 0.006, seed: 9 });
    litFill(p, fp, FC, light, ow * 0.8, mul(FC, SH_SKIN));
    p.band(curve([248, 352], [300, 338], [352, 352], 10), shade(FC, 0.6), 14, 2.5, "round");
    p.dot(286, 372, 6.5); p.dot(314, 372, 6.5);
    const mz = blobPts(300, 425, { a: 40, b: 44, nTop: 2.2, nBot: 2.0, egg: 0.15, asym: 0, rot: 0, noise: 0.006, seed: 10 });
    litFill(p, mz, mix(FC, "#f0d0c4", 0.35), light, 4, mul(FC, SH_SKIN));
    p.ell(292, 452, 4.5, 3.5, INK, 0); p.ell(308, 452, 4.5, 3.5, INK, 0);
    p.stroke(curve([270, 466], [300, 474], [330, 466], 6), 3.5);
  } else if (kind === 2) {
    jackalHead(p, 262, 398, 86, 80, 1, "neutral", 0, light, ow * 0.9);
  } else { // falcon (Qebehsenuef): slate head, white cheek with the dark tear stripe, yellow eye ring, hooked beak
    const SL = "#55607a", WH = "#f2ecdc";
    const hp = blobPts(286, 380, { a: 100, b: 98, nTop: 2.1, nBot: 2.1, egg: 0.0, asym: 0.06, rot: 0, noise: 0.006, seed: 12 });
    const beak = spline([[350, 340], [404, 346], [432, 376], [432, 420], [420, 438], [410, 410], [384, 398], [352, 398]], true, 6);
    litFill(p, beak, "#3a4252", light, ow * 0.8);
    litFill(p, hp, SL, light, 0, mul(SL, SH_SKIN));
    p.clip(hp, () => {
      p.ell(318, 440, 76, 56, WH, 0);
      p.poly([[318, 386], [342, 392], [322, 472], [298, 466]], SL, 0);
    });
    p.inkRing(hp, ow * 0.9, th);
    p.poly([[350, 340], [380, 344], [378, 398], [352, 400]], GOLD, 3);
    p.ell(328, 366, 23, 23, GOLD, 3.5); p.dot(330, 366, 14); p.dot(325, 361, 3.5, "#8a96b0");
    p.stroke([[390, 368], [396, 374]], 3.5);
  }
};

/** kid in a bedsheet ghost costume on a 600 x 1000 box, ground y = 975; boo 0 = arms down .. 1 = arms flung up and out */
export const ghostKid = (p: Pen, opts: { boo: number; light?: number }) => {
  const light = opts.light ?? DEF_LIGHT, b = clamp(opts.boo, 0, 1), e = b * b * (3 - 2 * b), ow = 11;
  p.rot = null;
  for (const s of [-1, 1]) {
    p.stroke([[300 + s * 20, 890], [300 + s * 24, 958]], 14, mix("#3b5b9a", INK, 0.55));
    footStroke(p, [300 + s * 18, 962], [300 + s * 50, 964], 20, "#f4f1ea");
    p.stroke([[300 + s * 30, 960], [300 + s * 42, 960]], 3, "#e2453c");
  }
  const hand = (s: number): P2 => [300 + s * (150 + 125 * e), 720 - 340 * e];
  const hem = (s: number): P2 => [300 + s * (172 + 50 * e), 900];
  const pts: P2[] = [[300, 346]];
  pts.push([384, 366], [418, 420], [428 + 18 * e, 470 - 8 * e], hand(1), [lerp2(hand(1), hem(1), 0.5)[0] + 18 * e, lerp2(hand(1), hem(1), 0.5)[1]], hem(1));
  const n = 7;
  for (let i = 1; i < n; i++) { const t = i / n; pts.push([hem(1)[0] + (hem(-1)[0] - hem(1)[0]) * t, i % 2 ? 878 : 902]); }
  pts.push(hem(-1), [lerp2(hand(-1), hem(-1), 0.5)[0] - 18 * e, lerp2(hand(-1), hem(-1), 0.5)[1]], hand(-1), [172 - 18 * e, 470 - 8 * e], [182, 420], [216, 366]);
  const sp = spline(pts, true, 6);
  litFill(p, sp, "#f7f7f2", light, ow, "#c4cbd8", true);
  p.clip(sp, () => { for (const [x0, x1] of [[262, 240], [338, 362], [300, 300]] as P2[]) p.stroke(curve([x0, 600], [(x0 + x1) / 2 + 6, 760], [x1, 900], 10), 4, "#d3d8e2"); });
  for (const s of [-1, 1]) p.ell(300 + s * 38, 470, 17, 25, INK, 0);
  if (b > 0.15) p.ell(300, 548, 20 * e + 4, 26 * e + 4, INK, 0);
};

const heartPts = (cx: number, tipY: number, s: number, sx = 1, sy = 1): P2[] => {
  const pts: P2[] = [];
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + x * s * sx, tipY - (y + 17) * s * sy]);
  }
  return pts;
};
/** cartoon heart on a 600 x 600 box, ground y = 575; beat 0..1 = pulse size, optional face / crossed arms / yellow glow */
export const heartDraw = (p: Pen, opts: { face?: Expr | null; arms?: "crossed" | "none"; beat?: number; light?: number; glow?: number }) => {
  const { face = null, arms = "none", light = DEF_LIGHT } = opts, bt = clamp(opts.beat ?? 0, 0, 1), gl = clamp(opts.glow ?? 0, 0, 1);
  const RED = "#d8343f", tip = 566, s = 12.2, sx = 1 + 0.08 * bt, sy = 1 + 0.1 * bt, ow = 11;
  p.rot = null;
  const cy = tip - 0.62 * 29 * s * sy;
  if (gl > 0) {
    const g = p.g, gr = g.createRadialGradient(300, cy, 40, 300, cy, 300);
    gr.addColorStop(0, `rgba(255,236,140,${(0.85 * gl).toFixed(3)})`); gr.addColorStop(0.55, `rgba(255,230,120,${(0.45 * gl).toFixed(3)})`); gr.addColorStop(1, "rgba(255,230,120,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
  }
  const hp = heartPts(300, tip, s, sx, sy);
  p.shadedFill(hp, RED, "#9e1f33", light, 200 * sx, 0.4);
  const ld = light, [lx, ly] = [300 + Math.cos(ld) * 120 * sx, cy - 40 * sy + Math.sin(ld) * 70 * sy];
  p.ell(lx, ly, 34, 18, "#f2727a", 0, 0, 360, (ld * 180) / Math.PI + 90);
  p.ell(lx + Math.cos(ld) * 10, ly + Math.sin(ld) * 10, 12, 7, "#ffc4c4", 0, 0, 360, (ld * 180) / Math.PI + 90);
  p.inkRing(hp, ow, thickAngle(light));
  if (face) faceFront(p, 300, cy - 6, 230 * sx, face, 0, 0, 0, false, RED);
  if (arms === "crossed") {
    const ac = mix(RED, INK, 0.45), y = cy + 96 * sy;
    p.stroke(curve([300 - 186 * sx, cy + 8], [300 - 165 * sx, y + 12], [300 + 64 * sx, y - 4], 10), 13, ac);
    p.stroke(curve([300 + 186 * sx, cy + 8], [300 + 165 * sx, y + 24], [300 - 64 * sx, y + 10], 10), 13, ac);
    p.dot(300 + 64 * sx, y - 4, 14); p.dot(300 - 64 * sx, y + 10, 14);
  }
};

/** pink cartoon brain (side view) on a 600 x 600 box, ground y = 575 */
export const brainDraw = (p: Pen, opts: { face?: Expr | null; light?: number }) => {
  p.rot = null;
  brainArt(p, 300, 330, 225, opts.light ?? DEF_LIGHT, 11, opts.face ?? null);
};

/** Maat's ostrich feather standing on its quill, curling over at the top; 600 x 1000 box, ground y = 975 */
export const featherDraw = (p: Pen, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT, ow = 10;
  p.rot = null;
  const vane = spline([[300, 872], [276, 830], [248, 720], [232, 580], [228, 440], [240, 320], [270, 230], [320, 178], [385, 165], [440, 190], [468, 240],
    [466, 300], [444, 332], [424, 300], [410, 268], [384, 262], [368, 296], [362, 420], [358, 560], [350, 720], [328, 840]], true, 8);
  const shaft = spline([[300, 975], [300, 870], [296, 640], [292, 420], [304, 280], [345, 210], [400, 196], [440, 228], [446, 300]], false, 8);
  litFill(p, vane, "#f9f8f4", light, 0, "#c3d0e2");
  p.clip(vane, () => {
    for (let i = 4; i < shaft.length - 3; i += 2) {
      const [x, y] = shaft[i], [x2, y2] = shaft[i + 1], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      for (const sd of [-1, 1]) p.stroke([[x, y], [x + sd * nx * 140 + (dx / l) * 90, y + sd * ny * 140 + (dy / l) * 90]], 2.4, "#c9d6e6");
    }
  });
  p.inkRing(vane, ow, thickAngle(light));
  p.stroke(shaft.slice(8), 6, "#dcd6c8");
  p.band(shaft.slice(0, 10), "#efe6d2", 10, 3, "round");
};

/** green stone heart scarab (top view, tilted toward the viewer) on a 600 x 600 box, ground y = 575 */
export const scarabDraw = (p: Pen, opts: { light?: number; glow?: number }) => {
  const light = opts.light ?? DEF_LIGHT, gl = clamp(opts.glow ?? 0, 0, 1), ow = 10, th = thickAngle(light), GL = "#6fbf8f", GD = "#3f8f6a";
  p.rot = null;
  if (gl > 0) {
    const g = p.g, gr = g.createRadialGradient(300, 360, 40, 300, 360, 300);
    gr.addColorStop(0, `rgba(255,228,120,${(0.8 * gl).toFixed(3)})`); gr.addColorStop(1, "rgba(255,228,120,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
  }
  p.ol = 5;
  for (const s of [-1, 1]) for (const [y, dx, dy] of [[300, 190, -40], [380, 205, 10], [450, 180, 70]]) {
    p.line([[300 + s * 120, y], [300 + s * (dx - 20), y + dy * 0.6], [300 + s * dx, y + dy]], shade(GD, 0.7), 13);
  }
  p.ol = 12;
  litFill(p, ellC(300, 418, 168, 140), shade(GD, 0.62), light, ow);
  const rim = (pts: P2[], k: number) => {
    const b = bbox(pts), cx = b.x0 + b.w / 2, cy = b.y0 + b.h / 2;
    const big = pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as P2);
    litFill(p, big, GOLD, light, ow * 0.8, mul(GOLD, SH_CLOTH));
    litFill(p, pts, GL, light, 0, GD);
  };
  rim(ellC(300, 230, 62, 32), 1.12);
  rim([...ellPts(300, 300, 128, 70, 180, 360, 0, 30), [428, 318], [172, 318]], 1.06);
  const el = ellC(300, 400, 150, 125);
  rim(el, 1.04);
  p.stroke([[300, 318], [300, 522]], 5, GOLD);
  for (const s of [-1, 1]) p.arc(300 + s * 70, 400, 38, 70, s > 0 ? 200 : 260, s > 0 ? 280 : 340, 3.5, mix(GL, WHITE, 0.4));
  p.ell(260, 280, 30, 12, mix(GL, WHITE, 0.5), 0, 0, 360, -10);
};

// ---------------- Egypt: unlit effect cards ----------------
/** thin bronze rod with a wooden handle (left) and a small sharp hook curl (right); 1000 x 60 box */
export const hookRod = (p: Pen) => {
  p.rot = null;
  p.band([[190, 30], [935, 30]], BRONZE, 8, 2.5, "round");
  const pts: P2[] = [];
  for (let a = 90; a >= -210; a -= 15) pts.push([948 + 14 * Math.cos(rad(a)), 16 + 14 * Math.sin(rad(a))]);
  p.band([[935, 30], ...pts], BRONZE, 6, 2.2, "round");
  p.poly(rrect(12, 17, 196, 43, 12), "#8a5a34", 3);
  for (const x of [60, 100, 140]) p.stroke([[x, 19], [x - 6, 41]], 3, shade("#8a5a34", 0.7));
};

/** falling stream of clear water on a 200 x 600 box, u = animation phase 0..1 */
export const stream = (p: Pen, u: number) => {
  p.rot = null;
  const l: P2[] = [], r: P2[] = [], ph = u * Math.PI * 2;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, y = t * 575, w = 32 - 9 * t + 2.5 * Math.sin(t * 17 - ph * 3), c = 100 + 4 * Math.sin(t * 9 - ph * 2);
    l.push([c - w, y]); r.push([c + w, y]);
  }
  p.poly([...l, ...r.reverse()], "#bfe8ff", 3);
  for (let k = 0; k < 4; k++) {
    const y0 = (((k * 0.25 + u) % 1) * 640) - 60;
    p.stroke([[92 + 2 * Math.sin(k), Math.max(4, y0)], [90, Math.min(560, y0 + 70)]], 5, WHITE);
  }
  p.stroke([[110, 10], [108, 540]], 2, "#e8f8ff");
  for (let k = 0; k < 5; k++) {
    const t = (u * 2 + k * 0.2) % 1, x = 100 + (k - 2) * 28 * t, y = 560 + 30 * Math.sin(t * Math.PI) * -1 + 10 * t;
    p.ell(x, y, 7 * (1 - t) + 2, 9 * (1 - t) + 2, "#bfe8ff", 2.2);
  }
};

/** four-point twinkle with small dots on a 300 x 300 box, u = life 0..1 (grow, shine, fade) */
export const sparkle = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), e = Math.sin(Math.PI * Math.min(1, t * 1.25)), R = 125 * e, a0 = rad(t * 30);
  if (R < 1) return;
  withAlpha(p, t > 0.8 ? (1 - t) / 0.2 : 1, () => {
    const pts: P2[] = [];
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2 - Math.PI / 2, b = a + Math.PI / 2, tip: P2 = [150 + R * Math.cos(a), 150 + R * Math.sin(a)];
      pts.push(...curve(tip, [150 + 0.34 * R * Math.cos(a + Math.PI / 4), 150 + 0.34 * R * Math.sin(a + Math.PI / 4)], [150 + R * Math.cos(b), 150 + R * Math.sin(b)], 8).slice(0, -1));
    }
    p.poly(pts, "#fff6c0", 4);
    p.ell(150, 150, 0.16 * R, 0.16 * R, WHITE, 0);
    for (let k = 0; k < 4; k++) { const a = a0 + Math.PI / 4 + (k * Math.PI) / 2; p.ell(150 + 0.72 * R * Math.cos(a), 150 + 0.72 * R * Math.sin(a), 7 * e, 7 * e, "#fff6c0", 3); }
  });
};

/** thought bubble on a 600 x 500 box: cloud in the top 75 %, three circles trailing to the bottom-left; "pyramid" = pyramid + sun inside */
export const bubble = (p: Pen, kind: "pyramid" | "empty") => {
  p.rot = null;
  const pts: P2[] = [];
  for (let i = 0; i < 120; i++) { const t = (i / 120) * Math.PI * 2, r = 1 + 0.085 * Math.abs(Math.sin(5 * t)); pts.push([340 + 238 * r * Math.cos(t), 190 + 146 * r * Math.sin(t)]); }
  for (const [x, y, r] of [[68, 482, 12], [112, 450, 20], [172, 408, 30]]) p.ell(x, y, r, r, WHITE, 7);
  p.poly(pts, WHITE, 9);
  if (kind === "pyramid") {
    p.ell(455, 118, 32, 32, "#ffcc33", 5);
    for (let k = 0; k < 8; k++) { const a = rad(k * 45); p.stroke([[455 + 44 * Math.cos(a), 118 + 44 * Math.sin(a)], [455 + 58 * Math.cos(a), 118 + 58 * Math.sin(a)]], 5, "#f0a020"); }
    p.stroke([[190, 272], [500, 272]], 6, "#d9a441");
    p.poly([[230, 270], [340, 132], [372, 270]], "#e8b440", 0);
    p.poly([[340, 132], [452, 270], [372, 270]], "#c48a2a", 0);
    for (let k = 1; k < 5; k++) { const y = 132 + k * 27.6, f = k / 5; p.stroke([[340 - 110 * f, y], [340 + 112 * f, y]], 2, "#a8742a"); }
    p.poly([[230, 270], [340, 132], [452, 270]], null, 6);
  }
};

/** thump arcs either side of the centre (pounding heart) on a 600 x 600 box, u = phase 0..1 */
export const beatLines = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 1 - 0.7 * t, () => {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const r = 205 + i * 32 + 30 * t, sp = 24 - i * 5, c = s > 0 ? 0 : 180;
      p.arc(300, 300, r, r * 1.05, c - sp, c + sp, 12 - 2 * i);
    }
  });
};

/** small green cricket (side view, facing right) chirping, on a 300 x 200 box, u = phase */
export const cricketDraw = (p: Pen, u: number) => {
  p.rot = null;
  const G = "#5e9a3a", ch = 0.5 + 0.5 * Math.sin(u * Math.PI * 8);
  p.ol = 3;
  p.stroke(curve([226, 96], [160, 10], [40, 30], 12), 2.5);
  p.stroke(curve([232, 100], [190, 20], [90, 8], 12), 2.5);
  p.line([[118, 128], [76, 72], [44, 162], [70, 168]], shade(G, 0.8), 7, true);
  for (const x of [170, 200, 222]) p.line([[x, 136], [x + 8, 160], [x + 2, 176]], shade(G, 0.75), 4, true);
  p.poly(ellC(150, 126, 72, 26), G, 6);
  p.poly(rotPts(ellC(140, 108, 74, 15), rad(-4 - 14 * ch), 210, 112), mix(G, "#d9e88a", 0.35), 5);
  p.line([[96, 128], [70, 74], [40, 160]], G, 9, true);
  p.poly(ellC(226, 116, 24, 22), G, 6);
  p.dot(234, 108, 5);
  p.stroke([[244, 126], [250, 132]], 3);
  p.ol = 12;
};

/** the brain being thrown: no face, three speed lines trailing to the left; 300 x 300 box, u = phase */
export const brainFlung = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 3; k++) {
    const y = 108 + k * 44, j = 10 * Math.sin(u * Math.PI * 2 + k * 1.7);
    p.stroke([[78 - k * 6 + j, y], [14 + j, y]], 7);
  }
  p.rot = [0.3 * Math.sin(u * Math.PI * 2), 185, 150];
  brainArt(p, 185, 150, 92, DEF_LIGHT, 6, null);
  p.rot = null;
};

/** water splash crown + drops (something landing in the river) on a 600 x 600 box, u = 0 start .. 1 end */
export const splashBig = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), rise = Math.sin(Math.min(1, t * 1.3) * Math.PI), blue = "#bfe8ff", deep = "#6cc0f0";
  if (rise > 0.02) {
    const pts: P2[] = [];
    for (let i = 0; i < 17; i++) {
      const h = (i % 2 ? 300 : 140) * rise * (0.7 + 0.3 * Math.sin(i * 1.7));
      pts.push([300 - 250 + (500 * i) / 16, 520 - h]);
    }
    p.poly([...pts, [550, 545], [50, 545]], blue, 8);
    p.ell(300, 540, 270, 36, deep, 8);
    p.ell(300, 534, 180, 18, "#e8f8ff", 0);
  }
  for (let i = 0; i < 9; i++) { // drops thrown from the crown tips, ballistic
    const vy = 1000 + 160 * ((i * 7) % 3), x = 300 + (i - 4) * (30 + 55 * t), y = 330 - vy * t + 1700 * t * t, r = 20 * (1 - t) + 6;
    if (t > 0.05 && y < 560 && y > 10) p.ell(x, y, r, r * 1.25, blue, 6);
  }
};

/** crocodile head + top of the back poking out of the water toward the LEFT; 800 x 400 box, waterline y = 300 */
export const crocHead = (p: Pen, opts: { jaw: number }) => {
  p.rot = null;
  const jaw = clamp(opts.jaw, 0, 1), WL = 300;
  p.clip([[0, 0], [800, 0], [800, WL], [0, WL]], () => {
    const back = spline([[500, 330], [560, 276], [640, 262], [730, 268], [810, 286], [810, 330]], true, 6);
    litFill(p, back, CROC, DEF_LIGHT, 12, mul(CROC, SH_CLOTH), true);
    for (let x = 570; x < 800; x += 36) p.ell(x, 268 + (x - 640) * 0.06 - 2, 14, 10, shade(CROC, 0.82), 3);
    crocArt(p, 480, 282, 1.25, jaw * 34, 0, DEF_LIGHT, 12, false, "neutral");
  });
  const wl: P2[] = [];
  for (let i = 0; i <= 40; i++) wl.push([60 + i * 19, WL + 3 * Math.sin(i * 1.3)]);
  p.band(wl, "#eaf8ff", 7, 2.5, "round");
  for (const [x0, x1, y] of [[90, 210, 322], [300, 460, 336], [560, 700, 322], [200, 330, 358], [480, 600, 366]] as const)
    p.band(curve([x0, y], [(x0 + x1) / 2, y + 5], [x1, y], 8), "#eaf8ff", 5, 2, "round");
};

// ---------------- placement anchors (adult build, seed 1, facing 0, no tilt; 600 x 1000 box) ----------------
/** "pat" prop: the flat reaching hand */
export const PAT_HAND: [number, number] = [470.0, 600.9];
/** "brain" prop: centre of the held brain */
export const BRAIN_HAND: [number, number] = [459.3, 433.9];
/** "hook" prop: the curled tip of the hook rod */
export const HOOK_TIP: [number, number] = [453.4, 260.6];


// =====================================================================================================================
// ================================================== GOBEKLI TEPE CAST ================================================
// =====================================================================================================================
// ---------------- helpers used by bodyFront / bodySide ----------------
/** left-hand extras: clipboard, chisel, thumbs-up */
const armTag = (p: Pen, tag: string, hx: number, hy: number, u: number, skin: string) => {
  const R = (q: P2[]) => rotPts(q, rad(-8), hx, hy);
  if (tag === "clip") {
    p.poly(R([[hx - 6 * u, hy - 34 * u], [hx + 46 * u, hy - 34 * u], [hx + 46 * u, hy + 36 * u], [hx - 6 * u, hy + 36 * u]]), "#a8814f", 2 * u);
    p.poly(R([[hx - 1 * u, hy - 28 * u], [hx + 41 * u, hy - 28 * u], [hx + 41 * u, hy + 31 * u], [hx - 1 * u, hy + 31 * u]]), "#fbf7ea", 1.2 * u);
    for (let i = 0; i < 4; i++) p.stroke(R([[hx + 5 * u, hy - 14 * u + i * 11 * u], [hx + 35 * u - (i % 2) * 9 * u, hy - 14 * u + i * 11 * u]]), 1.6 * u, "#8a8aa0");
    p.poly(R([[hx + 10 * u, hy - 38 * u], [hx + 30 * u, hy - 38 * u], [hx + 30 * u, hy - 27 * u], [hx + 10 * u, hy - 27 * u]]), "#b0b4ba", 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  } else if (tag === "chisel") { // flint chisel held up toward the stone (pointing right)
    p.band([[hx - 6 * u, hy + 10 * u], [hx + 40 * u, hy - 26 * u]], "#b6b09c", 6 * u, 1.6 * u, "round");
    p.poly([[hx + 34 * u, hy - 20 * u], [hx + 52 * u, hy - 38 * u], [hx + 46 * u, hy - 18 * u]], "#8f8a78", 1.6 * u);
    p.dot(hx, hy, 5.5 * u);
  } else if (tag === "thumb") { // fist + thumbs up
    p.ell(hx, hy, 9 * u, 8 * u, skin, 2.2 * u);
    p.ell(hx + 1 * u, hy - 11 * u, 3.8 * u, 8.5 * u, skin, 2 * u);
    p.stroke([[hx - 5 * u, hy + 1 * u], [hx + 5 * u, hy + 1 * u]], 1.2 * u, mix(skin, INK, 0.5));
  } else p.dot(hx, hy, 5.5 * u);
};

/** bead necklace hanging in a U */
const beadsArt = (p: Pen, cx: number, y0: number, rx: number, ry: number, col: string, u: number, side = false) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, k = 2 * t - 1; pts.push([cx + k * rx, y0 + ry * (1 - k * k)]); }
  p.stroke(pts, 1.8 * u, "#6a4a2a");
  const n = side ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, k = 2 * t - 1, bx = cx + k * rx, by = y0 + ry * (1 - k * k) + 2 * u;
    p.ell(bx, by, 4.6 * u, 5.2 * u, i % 3 === 1 ? mix(col, "#c9743f", 0.7) : col, 1.3 * u);
  }
};

const SPOT = (c: string) => mix(c, INK, 0.5);
/** spotted hide cloak over the left shoulder (front view) */
const hideFront = (p: Pen, tcx: number, Ta: number, chin: number, HH: number, col: string, light: number, u: number, ow: number, thick: number) => {
  const bot = chin + 0.74 * HH;
  for (let i = 0; i < 6; i++) { // fur tufts hanging from the lower edge
    const t = i / 5, x = tcx - 0.55 * Ta + t * 1.05 * Ta, y = chin + 0.7 * HH + 0.06 * HH * Math.sin(t * 3);
    p.poly([[x - 8 * u, y - 4 * u], [x + 8 * u, y - 4 * u], [x + 1 * u * (i % 2 ? 1 : -1), y + (13 + (i % 3) * 5) * u]], col, 1.6 * u);
  }
  const pts = spline([[tcx - 1.12 * Ta, chin + 0.0 * HH], [tcx - 0.35 * Ta, chin - 0.05 * HH], [tcx + 0.25 * Ta, chin + 0.16 * HH], [tcx + 0.55 * Ta, chin + 0.46 * HH],
    [tcx + 0.1 * Ta, bot], [tcx - 0.6 * Ta, bot - 0.06 * HH], [tcx - 1.18 * Ta, chin + 0.4 * HH]], true, 6);
  p.gradFill(pts, col, mul(col, SH_CLOTH), light);
  p.clip(pts, () => { for (const [dx, dy, r] of [[-0.8, 0.12, 9], [-0.3, 0.28, 11], [0.15, 0.2, 8], [-0.55, 0.5, 9], [0.1, 0.5, 10], [0.35, 0.34, 7]] as const) p.ell(tcx + dx * Ta, chin + dy * HH, r * u, 0.8 * r * u, SPOT(col), 0, 0, 360, 20 * dx); });
  p.inkRing(pts, ow * 0.85, thick);
  p.band([[tcx - 0.95 * Ta, chin + 0.02 * HH], [tcx - 0.2 * Ta, chin + 0.02 * HH]], mix(col, INK, 0.3), 5 * u, 0);
};
/** the same cloak in profile */
const hideSide = (p: Pen, tcx: number, Ta: number, chin: number, HH: number, col: string, light: number, u: number, ow: number, thick: number) => {
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = tcx - 0.8 * Ta + t * 1.0 * Ta, y = chin + 0.62 * HH - 0.1 * HH * Math.sin(t * 3.1) + 0.08 * HH;
    p.poly([[x - 7 * u, y - 4 * u], [x + 7 * u, y - 4 * u], [x + 1 * u * (i % 2 ? 1 : -1), y + (12 + (i % 3) * 4) * u]], col, 1.5 * u);
  }
  const pts = spline([[tcx - 0.9 * Ta, chin + 0.02 * HH], [tcx - 0.1 * Ta, chin - 0.04 * HH], [tcx + 0.5 * Ta, chin + 0.1 * HH], [tcx + 0.35 * Ta, chin + 0.45 * HH],
    [tcx - 0.2 * Ta, chin + 0.62 * HH], [tcx - 0.95 * Ta, chin + 0.5 * HH]], true, 6);
  p.gradFill(pts, col, mul(col, SH_CLOTH), light);
  p.clip(pts, () => { for (const [dx, dy, r] of [[-0.6, 0.18, 9], [-0.1, 0.3, 10], [0.2, 0.15, 7], [-0.5, 0.44, 8]] as const) p.ell(tcx + dx * Ta, chin + dy * HH, r * u, 0.8 * r * u, SPOT(col), 0); });
  p.inkRing(pts, ow * 0.85, thick);
};
/** bundle / pack with rope lashings */
const packArt = (p: Pen, cx: number, cy: number, rx: number, ry: number, col: string, light: number, u: number, thick: number) => {
  const bp = ellC(cx, cy, rx, ry, -4);
  for (const dx of [-0.5, 0.2]) p.stroke([[cx + dx * rx, cy - ry * 1.05], [cx + dx * rx + 8 * u, cy - ry * 1.3]], 3 * u, "#8a5a34"); // sticks
  p.shadedFill(bp, col, mul(col, SH_CLOTH), light, rx, 0.4);
  p.clip(bp, () => { for (const k of [-0.45, 0.25]) p.band([[cx + k * rx, cy - ry * 1.1], [cx + k * rx + 8 * u, cy + ry * 1.1]], mix(col, INK, 0.5), 4 * u, 0); });
  p.inkRing(bp, 4.2 * u, thick);
};

// ---------------- the people ----------------
export const GSKINS = ["#e6b88a", "#d9a273", "#cc9566", "#bd8559", "#e0ab7c", "#a9744b", "#efc79c", "#c58f60"];
const GHAIR = ["#1e140e", "#2c1b10", "#3b2415", "#4a2f1b", "#16110e", "#5a3b22", "#7a736c"];
const GLEATHER = ["#9a6a3c", "#8a5c34", "#a67a48", "#7c5430", "#b08350"];
const GHIDE = ["#8c6b45", "#a07a4a", "#7a5a3a", "#b38b58", "#6f5238", "#9b8664"];
const GBEAD = ["#efe6cf", "#e8d7a8", "#d9e4d2"];
/** a hunter-gatherer: bare skin, loincloth, hide cloak, beads; 12+ distinct variants by colour / hair / cloak (woman when `w`) */
export const folk = (v = 0, woman?: boolean): Outfit => {
  const sk = GSKINS[v % 8], hair = GHAIR[(v * 3 + 1) % 7], lea = GLEATHER[(v * 2) % 5], hid = GHIDE[(v * 5 + 2) % 6];
  const w = woman ?? (v % 4 === 1 || v % 7 === 3);
  const base: Outfit = { jacket: sk, pants: sk, boots: shade(sk, 0.82), skin: sk, hair, buttons: "none", belt: null };
  if (w) return { ...base, jacket: lea, pants: sk, dress: shade(lea, 1.05), bareArms: true, hat: (["braid", "bun", "pony"] as const)[v % 3], beads: GBEAD[v % 3] };
  return { ...base, hat: (["hair", "pony", "bun", "hair", "pony"] as const)[v % 5], kilt: lea, kiltLen: 0.27, kiltTrim: shade(lea, 0.7),
    hide: v % 3 === 2 ? undefined : hid, beads: v % 3 === 0 ? GBEAD[v % 3] : undefined, beard: v % 6 === 4 ? hair : undefined, shortBeard: v % 6 === 4 ? true : undefined,
    moustache: v % 6 === 5 ? hair : undefined };
};
const HUNTER_SK = "#d7a276";
/** the main hunter: lean, dark hair tied back, hide cloak over one shoulder, leather loincloth, bead necklace */
export const HUNTER: Outfit = { jacket: HUNTER_SK, pants: HUNTER_SK, boots: shade(HUNTER_SK, 0.8), skin: HUNTER_SK, hat: "pony", hair: "#241710", buttons: "none", belt: null,
  kilt: "#9a6a3c", kiltLen: 0.27, kiltTrim: "#6d4824", hide: "#8c6b45", beads: "#efe6cf", build: "slim" };
/** the gatherer: a woman with a braid, hide dress and bead strands */
export const GATHERER: Outfit = { jacket: "#a67a48", pants: "#e0ab7c", boots: "#c58f60", skin: "#e0ab7c", dress: "#b08350", bareArms: true, hat: "braid", hair: "#2a1a12", buttons: "none", belt: null, beads: "#e8d7a8" };
export const CHILD: Outfit = { jacket: "#e0ab7c", pants: "#e0ab7c", boots: "#c58f60", skin: "#e0ab7c", hat: "bun", hair: "#2c1b10", buttons: "none", belt: null, kilt: "#a67a48", kiltLen: 0.25, kiltTrim: "#7c5430", build: "kid", beads: "#efe6cf" };
export const CARVER: Outfit = { ...folk(10, false), jacket: "#c58f60", pants: "#c58f60", boots: "#a37246", skin: "#c58f60", hat: "hair", hair: "#2a1a12", hide: "#7a5a3a", kilt: "#7c5430", kiltTrim: "#4e341c", build: "stout", beard: "#2a1a12", shortBeard: true, beads: "#efe6cf" };
/** the hungry hauler: thin, ragged loincloth, rope-calloused */
export const WORKER: Outfit = { jacket: "#cc9566", pants: "#cc9566", boots: "#a87c52", skin: "#cc9566", hat: "hair", hair: "#3b2415", buttons: "none", belt: null,
  kilt: "#8a5c34", kiltLen: 0.24, kiltTrim: "#5e3d20", build: "slim" };
/** the foreman: stout, red-ochre cloak, bone beads */
export const FOREMAN: Outfit = { jacket: "#bd8559", pants: "#bd8559", boots: "#98693f", skin: "#bd8559", hat: "bun", hair: "#1c1410", buttons: "none", belt: null,
  kilt: "#7c5430", kiltLen: 0.27, kiltTrim: "#c94a2e", hide: "#b8492c", beads: "#efe6cf", build: "stout", moustache: "#1c1410" };
/** the modern archaeologist: sun hat, round glasses, beard, khaki shirt with pockets, clipboard */
export const SCIENTIST: Outfit = { jacket: "#c9b27a", pants: "#7a6a4f", boots: "#5a3b22", skin: "#f0c9a0", hat: "sunhat", cap: "#d8c690", hair: "#6a4a2a", beard: "#6a4a2a", shortBeard: true,
  glasses: true, pockets: true, clip: true, buttons: "none", belt: null, build: "stout" };
/** stadium fans (modern shirts) */
const FAN_J = ["#e2453c", "#2f6fd0", "#f2c230", "#2fa66a", "#f2f2f2", "#8a4fd0", "#ef8a2c", "#31b5c9"];
export const fan = (v = 0): Outfit => ({ jacket: FAN_J[v % 8], pants: ["#3b4a6a", "#2c2f3a", "#6a5a4a"][v % 3], boots: "#f4f1ea", skin: SKINS[v % 4], hat: v % 3 === 0 ? "cap" : "hair",
  cap: FAN_J[(v + 3) % 8], hair: GHAIR[v % 7], buttons: "none", belt: null, dress: v % 5 === 4 ? FAN_J[(v + 5) % 8] : undefined });
export const VENDOR: Outfit = { jacket: "#f4f1ea", pants: "#3b3f52", boots: "#2c2f3a", skin: "#e0ab7c", hat: "cap", cap: "#e2453c", hair: "#2c1b10", buttons: "none", belt: null, moustache: "#2c1b10" };

// ---------------- animals (facing screen-right) ----------------
const GAZ = "#c8924f", GAZ_D = "#7a4d28", GAZ_W = "#f4ead2";
/** two-bone leg for quadrupeds: hip -> knee (bends fwd or back) -> foot; drawn with a thin ink rim */
const qLeg = (p: Pen, hx: number, hy: number, len: number, swing: number, lift: number, bendFwd: boolean, col: string, w: number, hoof: string) => {
  const fx = hx + len * 0.78 * swing, fy = Math.min(hy + len, 470) - lift;
  const mx = (hx + fx) / 2 + (bendFwd ? 1 : -1) * 0.1 * len, my = (hy + fy) / 2 + 0.02 * len;
  const sv = p.ol; p.ol = 5;
  p.line([[hx, hy], [mx, my], [fx, fy - 6]], col, w, true);
  p.ell(fx + 5, fy - 3, w * 0.8, w * 0.55, hoof, 3);
  p.ol = sv;
};
/** gazelle in profile, facing right, on a 1000 x 500 box (ground y 475). phase = walk cycle 0..1, head 0 = up, 1 = grazing */
export const gazelleDraw = (p: Pen, opts: { phase?: number; light?: number; head?: number; hang?: number }) => {
  const ph = opts.phase ?? 0, light = opts.light ?? DEF_LIGHT, hd = clamp(opts.head ?? 0, 0, 1), two = Math.PI * 2;
  p.rot = null;
  const bob = 5 * Math.cos(2 * two * ph);
  const L = (off: number, front: boolean): [number, number] => {
    const a = two * (ph + off); return [0.5 * Math.sin(a), 30 * Math.max(0, Math.cos(a))];
  };
  const legs: [number, number, boolean, number][] = [[330, 290, false, 0.5], [590, 285, true, 0], [345, 290, false, 0.0], [605, 285, true, 0.5]];
  legs.forEach(([hx, hy, fw, off], i) => {
    const [sw, lf] = L(off, fw), far = i < 2;
    qLeg(p, hx, hy + bob, 185, sw, lf, fw, far ? shade(GAZ, 0.72) : GAZ, 17, INK);
  });
  // tail
  p.poly([[270, 205 + bob], [232, 232 + bob], [248, 214 + bob]], GAZ_D, 3);
  const ang = rad(34 * hd);
  const root: P2 = [610, 205 + bob];
  const R = (q: P2[]) => rotPts(q, ang, root[0], root[1]);
  const neck = R([[585, 172 + bob], [668, 128 + bob], [738, 62 + bob], [790, 88 + bob], [700, 190 + bob], [620, 250 + bob]]);
  p.poly(neck, GAZ, 9);
  // body
  const body = spline([[250, 235], [300, 180], [440, 160], [570, 168], [640, 205], [630, 270], [520, 305], [380, 308], [290, 285]], true, 8).map(([x, y]) => [x, y + bob] as P2);
  p.shadedFill(body, GAZ, mul(GAZ, SH_CLOTH), light, 190, 0.4);
  p.clip(body, () => {
    p.ell(480, 330 + bob, 200, 46, GAZ_W, 0);
    p.stroke([[300, 262 + bob], [440, 252 + bob], [620, 262 + bob]], 14, GAZ_D);
    p.ell(262, 218 + bob, 34, 38, GAZ_W, 0);
  });
  p.inkRing(body, 9, thickAngle(light));
  // head
  const hp = R(spline([[690, 62 + bob], [760, 40 + bob], [840, 74 + bob], [868, 112 + bob], [836, 130 + bob], [760, 108 + bob]], true, 6));
  p.shadedFill(hp, GAZ, mul(GAZ, SH_CLOTH), light, 80, 0.4);
  p.inkRing(hp, 8, thickAngle(light));
  const [nx, ny] = R([[858, 112 + bob]])[0]; p.ell(nx, ny, 12, 9, INK, 0);
  const [ex, ey] = R([[788, 70 + bob]])[0]; p.ell(ex, ey, 10, 12, INK, 0); p.dot(ex + 3, ey - 3, 3.2, "#ffffff");
  p.stroke(R([[770, 90 + bob], [820, 110 + bob]]), 5, GAZ_D); // face stripe
  const ear = R([[722, 52 + bob]])[0]; p.ell(ear[0], ear[1], 30, 10, GAZ, 5, 0, 360, -40 + 34 * hd * 57.3 / 57.3);
  for (const [a, b] of [[718, 44], [742, 40]] as const) { // lyre horns
    const c = R([[a, b + bob], [a - 18 + (a - 718) * 0.7, b - 44 + bob], [a + 4 + (a - 718) * 0.5, b - 80 + bob]]);
    p.line(curve(c[0], c[1], c[2], 10), "#4a3626", 8, true);
  }
};
/** the dead gazelle slung under a pole (limp, eyes closed, legs tied up to the pole): 1000 x 500 box, pole from (40,40) to (960,140) */
export const gazelleCarcass = (p: Pen, opts: { light?: number; sway?: number }) => {
  const light = opts.light ?? DEF_LIGHT, yp = (x: number) => 40 + (x - 40) / 9.2;
  p.rot = null;
  p.band([[30, 38], [970, 142]], "#8a5a34", 14, 3.5, "round");
  p.rot = [rad(opts.sway ?? 0), 500, 90];
  const sv = p.ol; p.ol = 4;
  // four legs folded up to the pole, tied in pairs
  for (const [x0, x1, y0] of [[360, 330, 255], [410, 360, 258], [620, 650, 258], [670, 690, 256]] as const) {
    p.line([[x0, y0], [(x0 + x1) / 2 + (x1 - x0) * 0.5, (y0 + yp(x1)) / 2 + 6], [x1, yp(x1) + 10]], GAZ, 11, true);
    p.ell(x1, yp(x1) + 14, 8, 11, INK, 0);
  }
  p.ol = sv;
  for (const x of [345, 665]) p.ell(x, yp(x) + 8, 15, 11, "#a8845a", 3);   // lashings
  const body = spline([[290, 330], [340, 268], [480, 252], [620, 266], [700, 318], [650, 372], [490, 392], [340, 378]], true, 8);
  p.shadedFill(body, GAZ, mul(GAZ, SH_CLOTH), light, 200, 0.4);
  p.clip(body, () => { p.ell(490, 262, 220, 40, GAZ_W, 0); p.stroke([[330, 330], [490, 322], [670, 332]], 13, GAZ_D); });
  p.inkRing(body, 9, thickAngle(light));
  // head drooping at the left end
  const hp = spline([[170, 330], [236, 296], [310, 322], [316, 366], [250, 392], [176, 372]], true, 6);
  p.shadedFill(hp, GAZ, mul(GAZ, SH_CLOTH), light, 70, 0.4);
  p.inkRing(hp, 8, thickAngle(light));
  p.arc(246, 338, 11, 6, 190, 350, 4);  // closed eye
  p.ell(178, 350, 10, 8, INK, 0);
  p.line([[292, 318], [258, 282]], "#4a3626", 7, true);
  p.rot = null;
};
/** friendly giraffe in profile facing right, 600 x 1000 box (ground 975). look = head lowered toward the viewer -1..1, sway small neck motion */
export const giraffeDraw = (p: Pen, opts: { light?: number; look?: number; phase?: number; blink?: number }) => {
  const light = opts.light ?? DEF_LIGHT, GI = "#ecbb52", PATCH = "#b8742c", two = Math.PI * 2, ph = opts.phase ?? 0;
  p.rot = null;
  const sv = p.ol; p.ol = 7;
  const sway = rad(2.2 * Math.sin(two * ph) + 4 * (opts.look ?? 0));
  const leg = (x: number, col: string) => {
    p.line([[x, 600], [x + 2, 790], [x - 1, 955]], col, 26, true);
    p.poly([[x - 18, 944], [x + 14, 944], [x + 16, 974], [x - 20, 974]], "#3a2a20", 4);
  };
  leg(188, shade(GI, 0.8)); leg(366, shade(GI, 0.8));
  p.stroke(curve([108, 520], [64, 590], [86, 740], 8), 10, "#6a4020"); p.ell(86, 748, 12, 26, "#6a4020", 3); // tail
  const body = spline([[96, 520], [150, 440], [270, 430], [370, 460], [392, 540], [360, 620], [240, 650], [130, 620]], true, 8);
  p.shadedFill(body, GI, mul(GI, SH_CLOTH), light, 190, 0.4);
  p.clip(body, () => { for (const [x, y, r] of [[160, 500, 30], [240, 470, 28], [310, 520, 32], [200, 580, 30], [290, 590, 28], [370, 480, 26]] as const) p.ell(x, y, r, r * 0.85, PATCH, 0, 0, 360, x); });
  p.inkRing(body, 9, thickAngle(light));
  leg(130, GI); leg(310, GI);
  // neck + head swing about the shoulder
  const root: P2 = [340, 480];
  const R = (q: P2[]) => rotPts(q, sway, root[0], root[1]);
  const neck = R(spline([[300, 500], [352, 400], [378, 240], [396, 150], [460, 150], [436, 250], [430, 400], [410, 520]], true, 6));
  p.shadedFill(neck, GI, mul(GI, SH_CLOTH), light, 200, 0.4);
  p.clip(neck, () => { for (const [x, y, r] of [[378, 400, 24], [402, 320, 22], [400, 240, 20], [418, 170, 17], [372, 350, 18]] as const) { const q = R([[x, y]])[0]; p.ell(q[0], q[1], r, r * 0.8, PATCH, 0); } });
  p.inkRing(neck, 8, thickAngle(light));
  p.poly(R(spline([[388, 370], [400, 250], [420, 160], [430, 180], [418, 320], [404, 400]], true, 4)), "#8a5a22", 0); // mane
  const head = R(spline([[372, 110], [410, 62], [470, 56], [540, 82], [556, 112], [530, 148], [440, 156], [392, 144]], true, 6));
  p.shadedFill(head, GI, mul(GI, SH_CLOTH), light, 90, 0.4);
  p.inkRing(head, 8, thickAngle(light));
  const mz = R(spline([[500, 98], [548, 90], [568, 118], [540, 148], [500, 142]], true, 5));
  p.poly(mz, "#f3dfb0", 6);
  const E = (x: number, y: number): P2 => R([[x, y]])[0];
  for (const [x0, x1] of [[408, 396], [440, 452]] as const) { // ossicones
    const a = E(x0, 66), b = E(x1, 14);
    p.line([a, b], "#8a5a22", 8, true); p.dot(b[0], b[1], 11, "#6a4020");
  }
  const ear = E(384, 98); p.ell(ear[0], ear[1], 26, 11, GI, 5, 0, 360, -30 + sway * 57);
  const eye = E(466, 98), blk = opts.blink ?? 0;
  if (blk > 0.5) p.arc(eye[0], eye[1], 11, 5, 10, 170, 4); else { p.ell(eye[0], eye[1], 13, 15, "#ffffff", 3); p.dot(eye[0] + 3, eye[1] + 2, 7); }
  p.stroke([[eye[0] - 14, eye[1] - 18], [eye[0] - 22, eye[1] - 26]], 3);
  const nos = E(556, 108); p.ell(nos[0], nos[1], 6, 8, INK, 0);
  const sm = R(curve([510, 135], [530, 142], [552, 130], 6)); p.stroke(sm, 4);
  p.ol = sv;
};
/** red fox trotting/sitting, facing right, 1000 x 500 box */
export const foxDraw = (p: Pen, opts: { phase?: number; light?: number; sit?: boolean }) => {
  const ph = opts.phase ?? 0, light = opts.light ?? DEF_LIGHT, two = Math.PI * 2, FX = "#dc7a2e", W = "#f6efdf";
  p.rot = null;
  const bob = opts.sit ? 0 : 4 * Math.cos(2 * two * ph);
  // brush tail
  const tail = spline([[300, 280 + bob], [210, 250 + bob], [90, 270 + bob], [70, 330 + bob], [150, 360 + bob], [270, 340 + bob]], true, 6);
  p.shadedFill(tail, FX, mul(FX, SH_CLOTH), light, 120, 0.4);
  p.clip(tail, () => p.ell(80, 320 + bob, 50, 60, W, 0));
  p.inkRing(tail, 8, thickAngle(light));
  if (!opts.sit) for (const [hx, hy, fw, off] of [[330, 340, false, 0.5], [560, 340, true, 0], [345, 340, false, 0], [575, 340, true, 0.5]] as const) {
    const a = two * (ph + off);
    qLeg(p, hx, hy + bob, 130, 0.5 * Math.sin(a), 22 * Math.max(0, Math.cos(a)), fw, off === 0.5 ? shade("#2a1c18", 1) : "#2a1c18", 17, INK);
  }
  const body = spline([[290, 320], [330, 270], [450, 252], [560, 262], [620, 300], [590, 350], [470, 376], [350, 370]], true, 8).map(([x, y]) => [x, y + bob] as P2);
  p.shadedFill(body, FX, mul(FX, SH_CLOTH), light, 160, 0.4);
  p.clip(body, () => p.ell(530, 352 + bob, 100, 36, W, 0));
  p.inkRing(body, 8, thickAngle(light));
  const head = spline([[580, 236 + bob], [650, 206 + bob], [740, 250 + bob], [810, 280 + bob], [760, 312 + bob], [650, 316 + bob]], true, 6);
  p.shadedFill(head, FX, mul(FX, SH_CLOTH), light, 100, 0.4);
  p.clip(head, () => p.ell(720, 304 + bob, 90, 30, W, 0));
  p.inkRing(head, 8, thickAngle(light));
  p.poly([[640, 214 + bob], [668, 150 + bob], [700, 224 + bob]], FX, 6); p.poly([[650, 210 + bob], [668, 168 + bob], [688, 218 + bob]], "#2a1c18", 0);
  p.ell(812, 280 + bob, 12, 10, INK, 0);
  p.ell(724, 252 + bob, 7, 9, INK, 0); p.dot(726, 249 + bob, 2.4, "#ffffff");
  p.stroke([[736, 276 + bob], [775, 296 + bob]], 3.5);
};
/** a snake slithering to the right (sine body), 1000 x 500 box; u = phase 0..1, tongue flicks */
export const snakeDraw = (p: Pen, opts: { u?: number; light?: number }) => {
  const u = opts.u ?? 0, light = opts.light ?? DEF_LIGHT, SN = "#7aa23c", SD = "#4d6b25", two = Math.PI * 2;
  p.rot = null;
  const pts: P2[] = [], N = 40;
  for (let i = 0; i <= N; i++) { const t = i / N, x = 70 + t * 740, y = 330 + 70 * Math.sin(t * 6.4 - u * two) * (0.35 + 0.65 * t); pts.push([x, y]); }
  const wd = (t: number) => 14 + 24 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7 * (1 - 0.35 * t);
  const L: P2[] = [], Rr: P2[] = [];
  pts.forEach(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = wd(i / N);
    L.push([x - (dy / l) * w, y + (dx / l) * w]); Rr.push([x + (dy / l) * w, y - (dx / l) * w]);
  });
  const outline = [...L, ...Rr.reverse()];
  p.shadedFill(outline, SN, mul(SN, SH_CLOTH), light, 220, 0.4);
  p.clip(outline, () => { for (let i = 3; i < N; i += 4) { const [x, y] = pts[i]; p.poly([[x - 14, y], [x, y - 20], [x + 14, y], [x, y + 20]], SD, 0); } });
  p.inkRing(outline, 8, thickAngle(light));
  const [hx, hy] = pts[N];
  p.ell(hx + 22, hy - 4, 48, 30, SN, 8, 0, 360, -8);
  p.ell(hx + 34, hy - 12, 8, 10, "#ffffff", 3); p.dot(hx + 36, hy - 11, 4);
  const fl = Math.sin(u * two * 6) > 0.2;
  if (fl) { p.stroke([[hx + 68, hy - 2], [hx + 98, hy - 2], [hx + 112, hy - 14]], 4, "#c23a4a"); p.stroke([[hx + 98, hy - 2], [hx + 114, hy + 8]], 4, "#c23a4a"); }
};
/** cartoon scorpion facing right, 600 x 600 box (ground 575): chunky body, two claws, curled stinger tail */
export const scorpionDraw = (p: Pen, opts: { u?: number; light?: number }) => {
  const u = opts.u ?? 0, light = opts.light ?? DEF_LIGHT, SC = "#c9893a", two = Math.PI * 2, w = Math.sin(u * two * 2);
  p.rot = null;
  const sv = p.ol; p.ol = 7;
  for (let i = 0; i < 4; i++) { const x = 220 + i * 55, s = Math.sin(u * two * 2 + i * 1.7) * 12; p.line([[x, 470], [x + 20 + s, 520], [x + 14 + s, 570]], shade(SC, 0.8), 10, true); }
  const tail: P2[] = curve([180, 440], [60, 300], [170, 130], 14).concat(curve([170, 130], [260, 70], [330, 150], 8).slice(1));
  p.line(tail, SC, 34, true);
  p.poly([[318, 140], [350, 150], [346, 196]], "#6a3a1a", 5);
  for (const [cx, cy, s] of [[490, 410, 1], [470, 500, -1]] as const) { // claws
    const arm = [[400, 470], [440, 470 + s * 20], [cx, cy + s * 10]] as [P2, P2, P2];
    p.line(curve(arm[0], arm[1], arm[2], 6), SC, 20, true);
    p.poly([[cx - 10, cy - 24 + s * 8], [cx + 62, cy - 4 + s * 8 + 4 * w], [cx + 14, cy + 6 + s * 8], [cx + 66, cy + 30 + s * 8 - 4 * w], [cx - 10, cy + 30 + s * 8]], SC, 6);
  }
  const body = spline([[160, 450], [230, 410], [350, 410], [430, 450], [380, 520], [230, 520]], true, 8);
  p.shadedFill(body, SC, mul(SC, SH_CLOTH), light, 150, 0.4);
  p.clip(body, () => { for (const x of [210, 260, 310, 360]) p.stroke([[x, 400], [x + 4, 530]], 4, "#8a5a22"); });
  p.inkRing(body, 8, thickAngle(light));
  p.ell(420, 440, 7, 8, "#ffffff", 3); p.dot(422, 441, 3.2); p.ell(402, 436, 6, 7, "#ffffff", 3); p.dot(404, 437, 2.8);
  p.ol = sv;
};
/** vulture, perched in profile facing right, 1000 x 500 box (ground 475); flap 0..1 spreads the wings */
export const vultureDraw = (p: Pen, opts: { light?: number; flap?: number }) => {
  const light = opts.light ?? DEF_LIGHT, VD = "#4a3b34", fl = clamp(opts.flap ?? 0, 0, 1);
  p.rot = null;
  const sv = p.ol; p.ol = 8;
  p.line([[470, 380], [472, 462]], "#c9a35a", 14, true); p.line([[530, 380], [534, 462]], "#c9a35a", 14, true);
  p.poly([[440, 462], [500, 464], [490, 476], [438, 476]], "#c9a35a", 4); p.poly([[510, 462], [570, 464], [560, 476], [508, 476]], "#c9a35a", 4);
  if (fl > 0.02) { // wings thrown out/up behind the body
    for (const s of [-1, 1]) p.poly(rotPts([[500, 260], [500 + s * 190, 250], [500 + s * 330, 300 - 70 * fl], [500 + s * 270, 340 - 30 * fl], [500 + s * 150, 330]], s * rad(-20 * fl), 500, 260), shade(VD, 0.9), 8);
  }
  const body = spline([[400, 300], [450, 230], [550, 232], [600, 300], [580, 390], [500, 420], [420, 380]], true, 8);
  p.shadedFill(body, VD, mul(VD, SH_CLOTH), light, 140, 0.4);
  p.clip(body, () => { for (const [x, y] of [[470, 300], [520, 320], [490, 360], [540, 370]] as const) p.ell(x, y, 30, 14, mix(VD, "#a89c90", 0.4), 0); });
  p.inkRing(body, 8, thickAngle(light));
  p.poly([[560, 320], [650, 380], [620, 410], [520, 390]], shade(VD, 0.85), 6); // folded wing tip
  // ruff + bald head on a bare neck
  p.ell(556, 236, 56, 28, "#efe6d4", 6);
  p.line([[556, 232], [588, 170]], "#d98a8c", 24, true);
  const hp = spline([[566, 152], [610, 128], [660, 150], [668, 176], [620, 186], [578, 184]], true, 5);
  p.shadedFill(hp, "#d98a8c", mul("#d98a8c", SH_CLOTH), light, 60, 0.4);
  p.inkRing(hp, 7, thickAngle(light));
  p.poly([[660, 146], [718, 160], [702, 190], [664, 180]], "#e8d58a", 6);   // hooked beak
  p.poly([[700, 168], [720, 178], [702, 192]], "#a8883a", 3);
  p.ell(630, 152, 11, 12, "#ffffff", 3); p.dot(634, 153, 5.5); p.stroke([[618, 136], [646, 144]], 5);
  p.ol = sv;
};
/** small hawk crossing the sky, 1000 x 500 box, flap phase u 0..1 */
export const hawkDraw = (p: Pen, opts: { u?: number }) => {
  p.rot = null;
  const f = Math.sin((opts.u ?? 0) * Math.PI * 2), HW = "#6a4a30";
  const sv = p.ol; p.ol = 7;
  for (const s of [-1, 1]) {
    const w = [[500, 260], [500 + s * 120, 230 - 60 * f], [500 + s * 330, 250 - 130 * f], [500 + s * 400, 300 - 120 * f], [500 + s * 220, 300 - 20 * f], [500 + s * 90, 310]] as P2[];
    p.poly(spline(w, true, 5), HW, 8);
  }
  p.poly(spline([[450, 260], [520, 232], [590, 262], [560, 322], [480, 320]], true, 6), "#8a6040", 8);
  p.poly([[460, 310], [440, 380], [500, 380], [520, 316]], "#8a6040", 6);
  p.ell(580, 262, 26, 22, "#8a6040", 6);
  p.poly([[600, 262], [628, 272], [602, 282]], "#e8c040", 4); p.dot(584, 256, 4);
  p.ol = sv;
};
/** a pale limestone slab, standing (blank, a few chisel dents), 600 x 1000 box */
export const slabDraw = (p: Pen, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT, ST = "#e6d3a6";
  p.rot = null;
  const pts = spline([[130, 970], [118, 520], [140, 330], [250, 300], [420, 320], [468, 470], [470, 970]], true, 4).map(([x, y]) => [x, y] as P2);
  const pl: P2[] = [[130, 970], [124, 520], [148, 330], [260, 306], [420, 322], [464, 470], [470, 970]];
  void pts;
  p.gradFill(pl, ST, mul(ST, SH_CLOTH), light);
  p.clip(pl, () => { for (const [x, y, r] of [[200, 420, 16], [330, 560, 12], [260, 760, 14], [390, 700, 10], [210, 600, 9]] as const) p.ell(x, y, r, r * 0.6, shade(ST, 0.8), 0); for (const y of [480, 640, 820]) p.stroke([[150, y], [300, y + 6], [450, y - 4]], 3, shade(ST, 0.86)); });
  p.inkRing(pl, 9, thickAngle(light));
};

// ---------------- props + fx ----------------
export const qmarkDraw = (p: Pen, u: number) => { // question-mark symbol (drawn, no font) 300 x 300 box, u = grow 0..1
  p.rot = null;
  const k = 0.55 + 0.45 * smooth01(u * 1.6);
  p.rot = [0, 150, 150];
  const q = (v: number) => 150 + (v - 150) * k;
  const arc: P2[] = [];
  for (let a = -200; a <= 70; a += 14) arc.push([q(150 + 70 * Math.cos(rad(a))), q(95 + 62 * Math.sin(rad(a)))]);
  arc.push([q(150), q(190)], [q(150), q(205)]);
  p.stroke(arc, 40 * k + 14, INK); p.stroke(arc, 34 * k, "#ffd84a");
  p.ell(q(150), q(262), 24 * k, 24 * k, "#ffd84a", 8);
};
const smooth01 = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/** belly growl: three wobbly arcs radiating either side of the belly, 600 x 600 box, u = phase 0..1 */
export const growlDraw = (p: Pen, u: number) => {
  p.rot = null;
  const a = 1 - 0.5 * clamp(u, 0, 1);
  withAlpha(p, a, () => {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const r = 110 + i * 52 + 70 * u, pts: P2[] = [];
      for (let k = 0; k <= 12; k++) { const t = -30 + 60 * (k / 12); pts.push([300 + s * (r + 8 * Math.sin(k * 1.8 + u * 14)) * Math.cos(rad(t)), 300 + r * 0.8 * Math.sin(rad(t))]); }
      p.stroke(pts, 13 - 2.5 * i, INK);
    }
  });
};
/** flint chips + dust, 300 x 300 box, u = 0..1 (ballistic) */
export const chipsDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  for (let i = 0; i < 9; i++) {
    const a = rad(-160 + i * 17 + 9 * (i % 2)), v = 150 + 60 * (i % 3), x = 150 + Math.cos(a) * v * t * 0.9, y = 190 + Math.sin(a) * v * t + 210 * t * t, r = (12 - 6 * t) * (0.7 + 0.3 * (i % 2));
    if (r > 1.5) p.poly(rotPts([[x - r, y + r * 0.6], [x, y - r], [x + r * 1.1, y + r * 0.5]], i + t * 6, x, y), i % 2 ? "#efe5c8" : "#d8c9a0", 3);
  }
  withAlpha(p, 0.55 * (1 - t), () => p.ell(150, 200, 40 + 70 * t, 22 + 26 * t, "#efe3c8", 0));
};
/** soil clods flung from a shovel, 300 x 300 box, u 0..1 */
export const soilDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  for (let i = 0; i < 8; i++) {
    const a = rad(-140 + i * 12), v = 190 + 40 * (i % 3), x = 60 + Math.cos(a) * v * t * 0.9 + 100 * t, y = 220 + Math.sin(a) * v * t + 230 * t * t, r = 14 - 5 * t + (i % 3) * 3;
    p.ell(x, y, r, r * 0.8, i % 2 ? "#7a5a3a" : "#8f6b45", 3);
  }
  withAlpha(p, 0.5 * (1 - t), () => p.ell(160, 240, 50 + 60 * t, 20 + 20 * t, "#c9a77a", 0));
};
/** orange fire sparks rising, 300 x 400 box, u = 0..1 */
export const emberDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 1 - t * t, () => {
    for (let i = 0; i < 6; i++) {
      const x = 150 + 60 * Math.sin(i * 2.1 + t * 3) + (i - 3) * 14, y = 360 - t * (240 + 30 * i), r = 17 - 6 * t + (i % 2) * 3;
      p.ell(x, y, r, r, i % 2 ? "#ffb23a" : "#ff7a2a", 5);
    }
  });
};
/** steam curls over hot food, 200 x 300 box, soft, u = phase 0..1 */
export const steamDraw = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 3; k++) {
    const pts: P2[] = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([60 + k * 40 + 18 * Math.sin(t * 7 + u * 6.283 + k * 2), 280 - t * 250]); }
    withAlpha(p, 0.5, () => p.stroke(pts, 12, "#ffffff"));
  }
};
/** swirling gust (wind), 600 x 300 box, u 0..1 */
export const gustDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, Math.sin(Math.PI * t), () => {
    for (let k = 0; k < 3; k++) {
      const pts: P2[] = [];
      for (let i = 0; i <= 20; i++) { const s = i / 20, x = -40 + (t * 220 + s * 320) + k * 40, y = 70 + 60 * k + 22 * Math.sin(s * 9 + k) - (s > 0.8 ? (s - 0.8) * 120 : 0); pts.push([x, y]); }
      p.stroke(pts, 11 - 2 * k, "#f4f1ea");
    }
  });
};
/** thought bubble on a 600 x 500 box with a scene inside: "crowd" = tiny figures eating, "grave" = a gravestone (no text) */
export const bubble2 = (p: Pen, kind: "crowd" | "grave") => {
  p.rot = null;
  const pts: P2[] = [];
  for (let i = 0; i < 120; i++) { const t = (i / 120) * Math.PI * 2, r = 1 + 0.085 * Math.abs(Math.sin(5 * t)); pts.push([340 + 238 * r * Math.cos(t), 190 + 146 * r * Math.sin(t)]); }
  for (const [x, y, r] of [[68, 482, 12], [112, 450, 20], [172, 408, 30]]) p.ell(x, y, r, r, "#ffffff", 7);
  p.poly(pts, "#ffffff", 9);
  if (kind === "crowd") {
    p.clip(pts, () => {
      p.ell(340, 292, 220, 28, "#cfe6a8", 0);
      for (let i = 0; i < 12; i++) {
        const x = 170 + (i % 6) * 62 + (i >= 6 ? 30 : 0), y = i >= 6 ? 235 : 178, col = FAN_J[(i * 3) % 8];
        p.ol = 3;
        p.poly(ellC(x, y + 52, 20, 30), col, 3);
        p.ell(x, y + 12, 17, 17, GSKINS[i % 8], 3);
        p.ell(x + 17, y + 38, 8, 8, "#f2c230", 2); // food in hand
        p.ell(x + 4, y + 20, 4, 3, MOUTH, 0);
        p.ol = 12;
      }
    });
  } else {
    p.clip(pts, () => p.ell(340, 300, 200, 30, "#cfe6a8", 0));
    const slab = spline([[262, 290], [260, 140], [300, 96], [380, 96], [420, 140], [418, 290]], true, 6);
    p.poly(slab, "#bfb8ac", 7);
    p.stroke([[340, 130], [340, 220]], 11, "#7d776c"); p.stroke([[304, 160], [376, 160]], 11, "#7d776c"); // a cross
    p.poly([[250, 292], [430, 292], [440, 312], [240, 312]], "#8fbf66", 5);
    for (const x of [270, 300, 380, 410]) p.stroke([[x, 292], [x + 6, 268]], 5, "#5e9a3a");
  }
};
/** a woven basket of soil handed along the dig chain, 600 x 600 box (ground 575) */
export const soilBasket = (p: Pen, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT;
  p.rot = null;
  p.stroke(curve([150, 330], [300, 190], [450, 330], 10), 12, "#8a6a3a");
  const bk: P2[] = [[120, 330], [480, 330], [430, 560], [170, 560]];
  p.gradFill(bk, "#cfa05a", mul("#cfa05a", SH_CLOTH), light);
  p.clip(bk, () => { for (let j = 1; j < 5; j++) p.stroke([[100, 330 + j * 46], [500, 330 + j * 46]], 6, "#9a6f35"); for (let i = -4; i <= 4; i++) p.stroke([[300 + i * 52, 330], [300 + i * 38, 560]], 6, "#9a6f35"); });
  p.inkRing(bk, 11, thickAngle(light));
  p.ell(300, 330, 190, 40, "#7a5a3a", 9);
  p.ell(300, 312, 150, 26, "#8f6b45", 0);
};
/** hot food on a tray, 600 x 600 box (ground 575), lit */
export const trayDraw = (p: Pen, opts: { light?: number }) => {
  const light = opts.light ?? DEF_LIGHT;
  p.rot = null;
  p.poly([[40, 470], [560, 470], [520, 540], [80, 540]], "#c9ced6", 10);
  for (const [x, y] of [[150, 450], [300, 440], [450, 450]] as const) { // buns
    p.ell(x, y, 80, 54, "#e0a35a", 9, 180, 360);
    p.ell(x, y + 6, 80, 22, "#7a4a2a", 0);
    p.ell(x, y + 24, 80, 20, "#e0a35a", 9, 0, 180);
  }
  for (let i = 0; i < 6; i++) p.poly(rotPts([[60 + i * 16, 410], [74 + i * 16, 410], [74 + i * 16, 330], [60 + i * 16, 330]], 0.2 * (i - 3), 400, 400), "#f2c230", 4);
  void light;
};
/** small stone-age bone-bladed shovel / digging stick lying prop is part of bodyFront; a rope strip draws in cast.ts */
export const ropeStrip = (p: Pen) => { p.stroke([[0, 20], [1000, 20]], 12, "#cdb88a"); };

/** body anchors (design units, 600 x 1000 box, stand mode, no tilt) for placing fx on a character: chin, head centre, hands level... */
export const geomOf = (o: Outfit, seed = 1, facing: -1 | 0 | 1 = 0) => {
  const Bd = BUILD[o.build ?? "adult"], H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const torsoBot = 975 - Bd.legs * HH, chin = torsoBot - Bd.torso * HH, Ta = ((Bd.tw / 2) * W) / 1.06;
  return { W, HH, u, Ta, chin, hc: chin - H.b, crown: chin - HH, torsoBot, tcx: 300 + 3 * u * facing, Ha: H.a };
};

// =====================================================================================================================
// ================================================== SKARA BRAE CAST ==================================================
// =====================================================================================================================
// Neolithic Orkney villagers (~3000 BC: wool + hide, bone beads), the 1850 geologist, the 1920s professor, the 1970s lab
// tech, today's coast scientist and tourists; Orkney animals; props and effects. Everything drawn in the same
// construction as the rest of the cast (plum ink, painted crescent away from `light`).

// ---------------- clothing details ----------------
/** coat front opening: waistcoat panel + shirt V + lapel edges (inside the torso clip) */
const tailorArt = (p: Pen, o: Outfit, cx: number, chin: number, torsoBot: number, Ta: number, HH: number, u: number, light: number) => {
  const full = !!(o.tails || o.coatOpen), y0 = chin - 0.12 * HH;
  const w0 = 0.46 * Ta, w1 = full ? 0.3 * Ta : 0.02 * Ta, yV = full ? torsoBot + 4 * u : chin + 0.52 * HH;
  if (o.vest) {
    const vp: P2[] = [[cx - w0, y0], [cx + w0, y0], [cx + w1, yV], [cx - w1, yV]];
    p.gradFill(vp, o.vest, mul(o.vest, SH_CLOTH), light);
    if (o.tweed && o.vest === o.jacket) tweedArt(p, cx, chin, Ta, HH, o.tweed, u);
    if (full) for (let i = 0; i < 4; i++) p.dot(cx, chin + (0.4 + i * 0.17) * HH, 2.4 * u, shade(o.vest, 0.55));
  }
  const sh = o.shirt ?? "#f6f3ea";
  p.poly([[cx - 0.26 * Ta, y0], [cx + 0.26 * Ta, y0], [cx, chin + (full ? 0.34 : 0.3) * HH]], sh, 1.4 * u);
  for (const s of [-1, 1]) { // lapel edges
    const a: P2 = [cx + s * w0, y0], b: P2 = [cx + s * w1, yV];
    p.band([[a[0] + s * 3 * u, a[1]], [b[0] + s * 3 * u, b[1]]], shade(o.jacket, 0.8), 5 * u, 1.1 * u);
  }
};
/** cravat / bow tie / long tie at the collar (drawn over the torso outline) */
const neckwearArt = (p: Pen, o: Outfit, cx: number, chin: number, HH: number, u: number, side = false) => {
  const y = chin + 0.02 * HH;
  if (o.cravat) {
    p.ell(cx, y + 2 * u, side ? 7 * u : 13 * u, 8 * u, o.cravat, 1.8 * u);
    if (!side) for (const s of [-1, 1]) p.poly([[cx + s * 2 * u, y + 6 * u], [cx + s * 9 * u, y + 7 * u], [cx + s * 6 * u, y + 22 * u], [cx + s * 1 * u, y + 20 * u]], o.cravat, 1.6 * u);
  } else if (o.bowtie) {
    const w = side ? 6 : 13;
    for (const s of side ? [1] : [-1, 1]) p.poly([[cx, y + 4 * u], [cx + s * w * u, y - 3 * u], [cx + s * w * u, y + 11 * u]], o.bowtie, 1.8 * u);
    p.ell(cx, y + 4 * u, 3.4 * u, 4 * u, shade(o.bowtie, 0.8), 1.4 * u);
  } else if (o.tie) {
    const L = 0.62 * HH;
    p.poly([[cx - 4 * u, y], [cx + 4 * u, y], [cx + 3 * u, y + 7 * u], [cx - 3 * u, y + 7 * u]], shade(o.tie, 0.85), 1.4 * u);
    if (!side) p.poly([[cx - 3 * u, y + 7 * u], [cx + 3 * u, y + 7 * u], [cx + 9 * u, y + L - 8 * u], [cx, y + L], [cx - 9 * u, y + L - 8 * u]], o.tie, 1.6 * u);
  }
};
/** tweed check (inside a clip) */
const tweedArt = (p: Pen, cx: number, chin: number, Ta: number, HH: number, col: string, u: number) => {
  withAlpha(p, 0.45, () => {
    for (let i = -6; i <= 6; i++) p.stroke([[cx + i * 15 * u, chin - 0.4 * HH], [cx + i * 15 * u, chin + 1.6 * HH]], 1.5 * u, col);
    for (let j = -2; j <= 12; j++) p.stroke([[cx - 2 * Ta, chin + j * 15 * u], [cx + 2 * Ta, chin + j * 15 * u]], 1.5 * u, col);
  });
  withAlpha(p, 0.25, () => { for (let i = -6; i <= 6; i++) p.stroke([[cx + i * 15 * u + 7 * u, chin - 0.4 * HH], [cx + i * 15 * u + 7 * u, chin + 1.6 * HH]], 0.9 * u, "#c9442e"); });
};
/** knitted / woven wool: rows of small v stitches */
const woolArt = (p: Pen, cx: number, cy: number, w: number, h: number, col: string, u: number) => {
  const c = mul(col, [0.84, 0.82, 0.8]);
  for (let j = -3; j <= 3; j++) for (let i = -4; i <= 4; i++) {
    const x = cx + (i * w) / 8 + ((j & 1) * w) / 16, y = cy + (j * h) / 6.5;
    p.stroke([[x - 3 * u, y - 2.5 * u], [x, y + 1.5 * u], [x + 3 * u, y - 2.5 * u]], 1.3 * u, c);
  }
};
/** fur / woven cape over both shoulders (front view) with a bone pin */
const capeArt = (p: Pen, cx: number, Ta: number, chin: number, HH: number, col: string, light: number, u: number, ow: number, thick: number) => {
  const pts = spline([[cx - 1.28 * Ta, chin + 0.38 * HH], [cx - 1.08 * Ta, chin + 0.0 * HH], [cx - 0.45 * Ta, chin - 0.07 * HH], [cx + 0.45 * Ta, chin - 0.07 * HH],
    [cx + 1.08 * Ta, chin + 0.0 * HH], [cx + 1.28 * Ta, chin + 0.38 * HH], [cx + 0.62 * Ta, chin + 0.32 * HH], [cx, chin + 0.27 * HH], [cx - 0.62 * Ta, chin + 0.32 * HH]], true, 6);
  p.gradFill(pts, col, mul(col, SH_CLOTH), light);
  p.clip(pts, () => { for (let i = -5; i <= 5; i++) p.stroke([[cx + i * 0.22 * Ta, chin + 0.2 * HH], [cx + i * 0.25 * Ta + 3 * u, chin + 0.36 * HH]], 1.6 * u, mul(col, [0.8, 0.78, 0.76])); });
  p.inkRing(pts, ow * 0.85, thick);
  p.ell(cx + 0.18 * Ta, chin + 0.12 * HH, 7 * u, 3.4 * u, "#efe6cf", 1.4 * u, 0, 360, -20);
};
// ---------------- held things (drawn at a hand; side = -1 for the left hand) ----------------
const GROOVE = "#7a5434", POT = "#b88a5c";
/** Grooved Ware pot (flat base, straight flaring walls, incised grooves + a zig-zag band) centred at (cx, cy), rim width w */
export const potArt = (p: Pen, cx: number, cy: number, w: number, light: number) => {
  const h = 0.86 * w, top = cy - h / 2, bot = cy + h / 2, wb = 0.36 * w, ow = Math.max(2, 0.045 * w);
  const body: P2[] = [[cx - w / 2, top], [cx + w / 2, top], [cx + wb + 0.02 * w, bot - 0.05 * h], [cx + wb, bot], [cx - wb, bot], [cx - wb - 0.02 * w, bot - 0.05 * h]];
  p.gradFill(body, POT, mul(POT, SH_CLOTH), light);
  p.clip(body, () => {
    for (const k of [0.16, 0.3, 0.74, 0.86]) p.stroke([[cx - w, top + k * h], [cx + w, top + k * h]], 0.03 * w, GROOVE);
    const zz: P2[] = [];
    for (let i = 0; i <= 10; i++) zz.push([cx - 0.6 * w + i * 0.12 * w, top + (i % 2 ? 0.4 : 0.62) * h]);
    p.stroke(zz, 0.035 * w, GROOVE);
  });
  p.inkRing(body, ow, thickAngle(light));
  p.ell(cx, top, w / 2, 0.1 * w, "#5a3a22", ow * 0.9);
};
/** top hat (crown up) whose brim centre is at (cx, by), crown width w */
export const topHatArt = (p: Pen, cx: number, by: number, w: number, light: number, band = "#4a3a4a") => {
  const ht = 1.2 * w, col = "#2e2a36";
  const body: P2[] = [[cx - 0.47 * w, by], [cx - 0.5 * w, by - ht], [cx + 0.5 * w, by - ht], [cx + 0.47 * w, by]];
  p.shadedFill(body, col, mul(col, SH_FELT), light, 0.5 * w, 0.4);
  p.clip(body, () => p.band([[cx - w, by - 0.18 * ht], [cx + w, by - 0.18 * ht]], band, 0.16 * ht, 0));
  p.poly(body, null, Math.max(2, 0.05 * w));
  p.ell(cx, by - ht, 0.5 * w, 0.09 * w, shade(col, 1.15), Math.max(2, 0.04 * w));
  p.ell(cx, by, 0.72 * w, 0.12 * w, "#1d1b22", Math.max(2, 0.05 * w));
};
export const heldArt = (p: Pen, h: Held, hx: number, hy: number, u: number, light: number, skin: string, side: number, span = 0) => {
  const sz = typeof h === "string" ? 1 : h.s ?? 1;
  if (sz !== 1) { // scaled about the hand
    const g = p.g, [cx, cy] = p.P(hx, hy);
    g.save(); g.translate(cx, cy); g.scale(sz, sz); g.translate(-cx, -cy);
    heldArt(p, typeof h === "string" ? h : { ...h, s: 1 }, hx, hy, u, light, skin, side, span);
    g.restore(); p.dot(hx, hy, 5.5 * u);
    return;
  }
  const k = typeof h === "string" ? h : h.k, a = rad(typeof h === "string" ? 0 : h.a ?? 0), s = side || 1;
  const R = (q: P2[]) => rotPts(q, a, hx, hy);
  const fist = () => p.dot(hx, hy, 5.5 * u);
  switch (k) {
    case "hammer": { // geologist's hammer: wooden shaft up from the fist, small steel head with a pick end
      const tx = hx + s * 4 * u;
      p.band(R([[hx, hy + 10 * u], [tx, hy - 46 * u]]), "#9a6a3a", 4.4 * u, 1.4 * u, "round");
      p.poly(R([[tx - s * 13 * u, hy - 52 * u], [tx + s * 9 * u, hy - 54 * u], [tx + s * 26 * u, hy - 47 * u], [tx + s * 9 * u, hy - 43 * u], [tx - s * 13 * u, hy - 42 * u]]), "#8d949c", 1.8 * u);
      fist(); break;
    }
    case "spade": case "dspade": { // iron spade, the hand on the shaft ("dspade": shorter, gripped at the T for digging)
      const d = k === "dspade" ? -0.32 : 1, top = k === "dspade" ? -6 : -40, L = (k === "dspade" ? 86 : 120) * u, B = L + (k === "dspade" ? 30 : 36) * u;
      void d;
      p.band(R([[hx, hy + top * u], [hx, hy + L]]), "#8a5a34", 4.6 * u, 1.5 * u, "round");
      p.band(R([[hx - 9 * u, hy + (top - 2) * u], [hx + 9 * u, hy + (top - 2) * u]]), "#8a5a34", 4 * u, 1.4 * u, "round");
      p.poly(R([[hx - 16 * u, hy + L - 4 * u], [hx + 16 * u, hy + L - 4 * u], [hx + 14 * u, hy + B - 6 * u], [hx, hy + B], [hx - 14 * u, hy + B - 6 * u]]), "#9aa0a8", 2 * u);
      fist(); break;
    }
    case "pot": potArt(p, hx, hy - 6 * u, Math.max(52 * u, span * 0.92), light); break;
    case "tophat": topHatArt(p, hx, hy + 6 * u, 66 * u, light); fist(); break;
    case "clip": armTag(p, "clip", hx, hy, u, skin); break;
    case "shard": { // a curved potsherd: jagged broken edges, the pot's thickness showing, incised grooves
      const sh: P2[] = [[hx - 26 * u, hy - 34 * u], [hx - 8 * u, hy - 44 * u], [hx + 6 * u, hy - 36 * u], [hx + 24 * u, hy - 42 * u], [hx + 30 * u, hy - 18 * u],
        [hx + 20 * u, hy - 10 * u], [hx + 24 * u, hy + 2 * u], [hx + 2 * u, hy + 6 * u], [hx - 14 * u, hy - 2 * u], [hx - 28 * u, hy - 12 * u]];
      p.poly(R(sh.map(([x, y]) => [x + 3 * u, y + 4 * u] as P2)), "#7a4424", 2 * u);       // the broken thickness
      p.gradFill(R(sh), POT, mul(POT, SH_CLOTH), light);
      p.clip(R(sh), () => { for (const k of [-30, -21, -12]) p.stroke(R([[hx - 34 * u, hy + k * u - 4 * u], [hx, hy + k * u + 3 * u], [hx + 34 * u, hy + k * u - 3 * u]]), 2 * u, GROOVE);
        p.stroke(R([[hx - 24 * u, hy - 2 * u], [hx - 14 * u, hy - 10 * u], [hx - 4 * u, hy - 2 * u], [hx + 6 * u, hy - 10 * u], [hx + 16 * u, hy - 2 * u]]), 1.8 * u, GROOVE); });
      p.poly(R(sh), null, 2.2 * u);
      fist(); break;
    }
    case "tablet": { // slate with a glowing screen: a falling red line on a pale chart (no text)
      const w = Math.max(64 * u, span * 1.05), hh = 0.68 * w, x0 = hx - w / 2, y0 = hy - hh * 0.62;
      p.poly(R(rrect(x0, y0, x0 + w, y0 + hh, 6 * u)), "#2a2f3a", 2.2 * u);
      p.poly(R(rrect(x0 + 5 * u, y0 + 5 * u, x0 + w - 5 * u, y0 + hh - 5 * u, 3 * u)), "#bfe6ea", 0);
      p.stroke(R([[x0 + 10 * u, y0 + 0.3 * hh], [x0 + 0.35 * w, y0 + 0.36 * hh], [x0 + 0.55 * w, y0 + 0.5 * hh], [x0 + 0.72 * w, y0 + 0.46 * hh], [x0 + w - 10 * u, y0 + 0.82 * hh]]), 2.6 * u, "#d8402e");
      p.stroke(R([[x0 + 10 * u, y0 + hh - 12 * u], [x0 + w - 10 * u, y0 + hh - 12 * u]]), 1.4 * u, "#6a8a90");
      if (!span) fist();
      break;
    }
    case "twig": { // the only "tree": a tiny twig with three leaves
      const g = "#6d4a2a", L = "#5aa83c";
      p.stroke(R([[hx, hy], [hx + s * 2 * u, hy - 34 * u]]), 2.6 * u, g);
      p.stroke(R([[hx + s * 1 * u, hy - 18 * u], [hx + s * 12 * u, hy - 28 * u]]), 2 * u, g);
      p.stroke(R([[hx + s * 2 * u, hy - 26 * u], [hx - s * 8 * u, hy - 36 * u]]), 1.8 * u, g);
      for (const [dx, dy, r] of [[13, -31, 30], [-9, -39, -30], [3, -38, 0]] as const) { const [lx, ly] = R([[hx + s * dx * u, hy + dy * u]])[0]; p.ell(lx, ly, 5 * u, 3 * u, L, 1.4 * u, 0, 360, r * s); }
      fist(); break;
    }
    case "fish": fishArt(p, hx, hy + 30 * u, 54 * u, a + rad(90)); fist(); break;
    case "pipe":
      p.band(R([[hx - s * 4 * u, hy], [hx + s * 16 * u, hy - 6 * u]]), "#2a1d18", 3 * u, 1.2 * u, "round");
      p.poly(R([[hx + s * 14 * u, hy - 18 * u], [hx + s * 26 * u, hy - 18 * u], [hx + s * 24 * u, hy - 2 * u], [hx + s * 16 * u, hy - 2 * u]]), "#7a4a2a", 2 * u);
      fist(); break;
    case "bundle": {
      const w = Math.max(60 * u, span * 0.9), bp = ellC(hx, hy - 4 * u, w / 2, 0.36 * w, -6);
      p.shadedFill(bp, "#9a7a4e", mul("#9a7a4e", SH_CLOTH), light, w / 2, 0.4);
      p.clip(bp, () => { for (const kx of [-0.2, 0.18]) p.band([[hx + kx * w, hy - w], [hx + kx * w + 6 * u, hy + w]], "#6a4a2a", 3.4 * u, 0); });
      p.inkRing(bp, 2.4 * u, thickAngle(light));
      break;
    }
    case "point": p.stroke(R([[hx, hy], [hx + s * 15 * u, hy - 4 * u]]), 3.6 * u); fist(); break;
    case "palm": p.ell(hx, hy - 2 * u, 8.5 * u, 6.8 * u, skin, 2 * u); break;
    case "pinch": p.ell(hx, hy, 6.5 * u, 6 * u, skin, 1.8 * u); p.stroke([[hx - 3 * u, hy - 1 * u], [hx + 3 * u, hy - 2 * u]], 1.4 * u, mix(skin, INK, 0.5)); break;
    case "grip": p.dot(hx, hy, 6.2 * u); break;
    case "bowl": {
      const w = Math.max(56 * u, span * 0.95);
      p.ell(hx, hy - 4 * u, w / 2, 0.42 * w, "#8a5e36", 2.2 * u, 0, 180);
      p.ell(hx, hy - 4 * u, w / 2, 0.16 * w, "#6a4a2a", 2 * u);
      p.ell(hx, hy - 4 * u, w * 0.42, 0.11 * w, "#d8c08a", 0);
      break;
    }
    case "trowel":
      p.band(R([[hx, hy + 4 * u], [hx + s * 22 * u, hy - 18 * u]]), "#6a4a2a", 5 * u, 1.4 * u, "round");
      p.poly(R([[hx + s * 20 * u, hy - 16 * u], [hx + s * 48 * u, hy - 46 * u], [hx + s * 58 * u, hy - 36 * u], [hx + s * 30 * u, hy - 8 * u]]), "#c9ced6", 1.8 * u);
      fist(); break;
    default: fist();
  }
};

/** fish skeleton: head (cross eye), spine, ribs, tail; along angle a (radians) through (cx, cy), length L */
export const fishArt = (p: Pen, cx: number, cy: number, L: number, a = 0) => {
  const R = (q: P2[]) => rotPts(q, a, cx, cy), B = "#f2ecdc", w = Math.max(1.4, L * 0.03);
  const hx = cx - 0.38 * L;
  p.poly(R(spline([[hx - 0.14 * L, cy], [hx - 0.02 * L, cy - 0.13 * L], [hx + 0.1 * L, cy - 0.1 * L], [hx + 0.12 * L, cy + 0.08 * L], [hx, cy + 0.12 * L]], true, 5)), B, w * 1.2);
  p.stroke(R([[hx - 0.05 * L, cy - 0.05 * L], [hx - 0.01 * L, cy - 0.01 * L]]), w); p.stroke(R([[hx - 0.05 * L, cy - 0.01 * L], [hx - 0.01 * L, cy - 0.05 * L]]), w);
  p.stroke(R([[hx + 0.1 * L, cy], [cx + 0.36 * L, cy]]), w * 2.2, INK); p.stroke(R([[hx + 0.1 * L, cy], [cx + 0.36 * L, cy]]), w * 1.1, B);
  for (let i = 0; i < 6; i++) {
    const x = hx + 0.2 * L + i * 0.085 * L, r = 0.12 * L * (1 - i * 0.11);
    for (const s of [-1, 1]) { p.stroke(R([[x, cy], [x + 0.04 * L, cy + s * r]]), w * 2, INK); p.stroke(R([[x, cy], [x + 0.04 * L, cy + s * r]]), w * 0.9, B); }
  }
  p.poly(R([[cx + 0.34 * L, cy], [cx + 0.52 * L, cy - 0.14 * L], [cx + 0.47 * L, cy], [cx + 0.52 * L, cy + 0.14 * L]]), B, w * 1.2);
};
// ---------------- the people ----------------
const ORK_SK = ["#f0c8a2", "#e8bb92", "#f3d0ae", "#dcae84", "#ecc29a"], ORK_HAIR = ["#8a3f22", "#5a3a22", "#b5823e", "#3a2618", "#9a4a26", "#2a1d14"];
const ORK_WOOL = ["#a8523a", "#8a6544", "#c9b07a", "#6f7a52", "#9a7a5a", "#7a5a6a", "#b08a5a"];
/** the Skara Brae mum: russet wool dress, oatmeal wool cape, bone beads, auburn bun */
export const MUM: Outfit = { jacket: "#b85c3c", dress: "#a24e37", pants: "#efc6a0", boots: "#6d4a2e", skin: "#efc6a0", hat: "bun", hair: "#8a3f22",
  beads: "#efe6cf", cape: "#dccaa4", wool: true, buttons: "none", belt: null };
/** dad: brown wool tunic, hide cape, leather leggings, red beard */
export const DAD: Outfit = { jacket: "#8a6544", pants: "#5e4b38", boots: "#4a3524", skin: "#e8bb92", hat: "hair", hair: "#9a4a26", beard: "#9a4a26",
  kilt: "#74563a", kiltLen: 0.36, kiltTrim: "#4e3824", cape: "#7a5a3e", wool: true, buttons: "none", belt: null, build: "stout" };
/** the kid: oatmeal tunic, bare legs, messy blond topknot */
export const KIDN: Outfit = { jacket: "#d9c493", pants: "#f0c9a2", boots: "#7a5534", skin: "#f0c9a2", hat: "bun", hair: "#c08a40", kilt: "#c4a46e", kiltLen: 0.32,
  kiltTrim: "#8a6a3e", buttons: "none", belt: null, build: "kid", beads: "#efe6cf" };
/** Orkney villagers: wool tunics in earth dyes, some caped */
export const orc = (v = 0, woman?: boolean, kid = false): Outfit => {
  const sk = ORK_SK[v % 5], hair = ORK_HAIR[(v * 2 + 1) % 6], wl = ORK_WOOL[(v * 3) % 7], w = woman ?? v % 3 === 1;
  const base: Outfit = { jacket: wl, pants: kid ? sk : shade(wl, 0.7), boots: "#5a3e26", skin: sk, hair, buttons: "none", belt: null, wool: v % 2 === 0, build: kid ? "kid" : undefined };
  if (w && !kid) return { ...base, pants: sk, dress: shade(wl, 0.9), hat: (["bun", "braid", "pony"] as const)[v % 3], beads: "#efe6cf", cape: v % 2 ? ORK_WOOL[(v + 2) % 7] : undefined };
  return { ...base, hat: kid ? "bun" : (["hair", "hair", "pony", "bun"] as const)[v % 4], kilt: shade(wl, 0.82), kiltLen: kid ? 0.3 : 0.36, kiltTrim: shade(wl, 0.6),
    cape: !kid && v % 3 === 0 ? "#7a5a3e" : undefined, beard: !kid && v % 4 === 2 ? hair : undefined, shortBeard: v % 8 === 6 ? true : undefined };
};
/** builders: burly, sleeves rolled (bare arms), leather aprons */
export const builder = (v = 0): Outfit => ({ ...orc(v * 2 + 4, false), bareArms: true, build: "stout", cape: undefined, apron: v % 2 ? "#6d4a2e" : "#7a5534" });
/** the 1850 laird-geologist: top hat, black tailcoat, mustard waistcoat, white stock, ginger side-whiskers (balding under the hat) */
export const GEOLOGIST: Outfit = { jacket: "#2f2c3a", pants: "#5d5850", boots: "#231c20", skin: "#f2cfae", hat: "tophat", hair: "#a3602e", whiskers: "#a3602e",
  vest: "#c9a23e", shirt: "#f6f3ea", cravat: "#f6f3ea", tails: true, buttons: "none", belt: null };
/** the 1920s professor: tweed three-piece, red bow tie, round glasses, trilby, grey moustache */
export const PROFESSOR: Outfit = { jacket: "#8f7a54", pants: "#7d6a4a", boots: "#4a3324", skin: "#f0c8a2", hat: "trilby", cap: "#5a4632", hair: "#d6cec0",
  glasses: true, glassesK: "round", moustache: "#d6cec0", tweed: "#4e4230", vest: "#8f7a54", shirt: "#f4efe2", bowtie: "#c0392e", buttons: "none", belt: null, build: "stout" };
/** the 1970s lab tech: long white coat, mustard shirt + brown kipper tie, huge glasses, moustache, mop + sideburns */
export const LABTECH: Outfit = { jacket: "#f3f3ee", pants: "#6a4a2e", boots: "#3a2a1e", skin: "#f2cfae", hat: "mop", hair: "#5e3c1e", sideburns: "#5e3c1e",
  moustache: "#5e3c1e", glasses: true, glassesK: "big", vest: "#d39a3a", shirt: "#d39a3a", tie: "#7a3a1e", coatLen: 0.56, coatOpen: true, buttons: "none", belt: null };
/** today's coast scientist: orange hi-vis waterproof, hood up, dark trousers, green wellies */
export const COASTSCI: Outfit = { jacket: "#f47a1c", pants: "#2c3340", boots: "#3d6b3a", skin: "#f0c8a4", hat: "hood", cap: "#f47a1c", hair: "#5a3a26",
  hivis: true, coatLen: 0.22, buttons: "none", belt: null };
/** tourists: rain jackets */
const TOUR_J = ["#2f6fd0", "#e2453c", "#2fa66a", "#f2c230", "#8a4fd0"];
export const tourist = (v = 0, kid = false): Outfit => ({ ...fan(v), jacket: TOUR_J[v % 5], hat: kid ? "cap" : v % 2 ? "hair" : "cap", cap: kid ? "#f2c230" : "#3b4a6a",
  build: kid ? "kid" : undefined, dress: undefined, coatLen: kid ? undefined : 0.2 });
// ---------------- animals (facing screen-right, 1000 x 500 box, ground 475) ----------------
/** woolly Orkney sheep: cream / brown / grey fleece, dark face + legs. head 0 = up, 1 = grazing */
export const sheepDraw = (p: Pen, opts: { phase?: number; light?: number; head?: number; wool?: string; blink?: number; bleat?: number }) => {
  const ph = opts.phase ?? 0, light = opts.light ?? DEF_LIGHT, hd = clamp(opts.head ?? 0, 0, 1), two = Math.PI * 2, WOOL = opts.wool ?? "#efe6d2", FACE = "#3a2f2c";
  p.rot = null;
  const bob = 4 * Math.cos(2 * two * ph);
  const legs: [number, number, number][] = [[380, 300, 0.5], [600, 300, 0], [400, 300, 0], [620, 300, 0.5]];
  legs.forEach(([hx, hy, off], i) => {
    const sw = 0.45 * Math.sin(two * (ph + off)), lf = 26 * Math.max(0, Math.cos(two * (ph + off)));
    qLeg(p, hx, hy + bob, 172, sw, lf, i % 2 === 1, i < 2 ? shade(FACE, 0.75) : FACE, 15, "#1e1816");
  });
  const pts: P2[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * two, r = 1 + 0.07 * Math.abs(Math.sin(t * 9));
    pts.push([495 + 172 * Math.cos(t) * r, 245 + 92 * Math.sin(t) * r + bob]);
  }
  p.shadedFill(pts, WOOL, mul(WOOL, SH_CLOTH), light, 180, 0.4);
  p.clip(pts, () => { for (const [x, y] of [[420, 220], [500, 200], [560, 250], [460, 270], [380, 250], [600, 220]] as const) p.arc(x, y + bob, 18, 12, 200, 340, 3, mul(WOOL, [0.82, 0.8, 0.78])); });
  p.inkRing(pts, 8, thickAngle(light));
  p.ell(318, 236 + bob, 16, 12, WOOL, 5); // tail tuft
  const ang = rad(52 * hd), root: P2 = [640, 220 + bob], R = (q: P2[]) => rotPts(q, ang, root[0], root[1]);
  const head = R(spline([[640, 196 + bob], [700, 150 + bob], [760, 160 + bob], [790, 214 + bob], [762, 246 + bob], [700, 236 + bob]], true, 6));
  p.shadedFill(head, FACE, mul(FACE, SH_CLOTH), light, 70, 0.4);
  p.inkRing(head, 7, thickAngle(light));
  p.poly(R(spline([[660, 170 + bob], [700, 136 + bob], [736, 150 + bob], [716, 178 + bob]], true, 4)), WOOL, 5); // woolly topknot
  const ear = R([[690, 186 + bob]])[0]; p.ell(ear[0], ear[1], 26, 9, FACE, 4, 0, 360, 20 + 52 * hd);
  const eye = R([[746, 190 + bob]])[0];
  if ((opts.blink ?? 0) > 0.5) p.arc(eye[0], eye[1], 8, 4, 10, 170, 3, "#f4ead8");
  else { p.ell(eye[0], eye[1], 9, 9, "#f4ead8", 2.5); p.dot(eye[0] + 2, eye[1] + 1, 4.2); }
  const bl = opts.bleat ?? 0, mo = R([[780, 228 + bob]])[0];
  if (bl > 0.3) p.ell(mo[0] - 4, mo[1] + 4, 7, 9 * bl, "#c4636e", 2.5);
  else p.stroke(R([[768, 230 + bob], [784, 226 + bob]]), 3, "#f4ead8");
};
/** small Neolithic cow: dark brown, short up-curved horns, tail; head 0 up .. 1 grazing */
export const cowDraw = (p: Pen, opts: { phase?: number; light?: number; head?: number; col?: string; blink?: number }) => {
  const ph = opts.phase ?? 0, light = opts.light ?? DEF_LIGHT, hd = clamp(opts.head ?? 0, 0, 1), two = Math.PI * 2, C = opts.col ?? "#6b4630", D = mul(C, [0.7, 0.68, 0.66]);
  p.rot = null;
  const bob = 4 * Math.cos(2 * two * ph);
  const legs: [number, number, number][] = [[270, 300, 0.5], [600, 300, 0], [295, 300, 0], [625, 300, 0.5]];
  legs.forEach(([hx, hy, off], i) => {
    const sw = 0.4 * Math.sin(two * (ph + off)), lf = 24 * Math.max(0, Math.cos(two * (ph + off)));
    qLeg(p, hx, hy + bob, 172, sw, lf, i % 2 === 1, i < 2 ? shade(C, 0.72) : C, 26, "#2a1e18");
  });
  p.stroke(curve([200, 170 + bob], [170, 240 + bob], [186, 330 + bob], 8), 8, D); p.ell(188, 340 + bob, 10, 20, "#2a1e18", 3);
  const body = spline([[200, 170], [300, 128], [480, 132], [640, 140], [700, 200], [680, 300], [560, 330], [330, 330], [215, 290]], true, 8).map(([x, y]) => [x, y + bob] as P2);
  p.shadedFill(body, C, mul(C, SH_CLOTH), light, 260, 0.4);
  p.clip(body, () => { p.ell(430, 330 + bob, 140, 40, mix(C, "#f4ead8", 0.35), 0); p.ell(560, 180 + bob, 60, 36, mix(C, "#f4ead8", 0.18), 0); });
  p.inkRing(body, 9, thickAngle(light));
  const ang = rad(46 * hd), root: P2 = [680, 190 + bob], R = (q: P2[]) => rotPts(q, ang, root[0], root[1]);
  for (const x of [728, 756]) { const c = R([[x, 132 + bob], [x - 12, 100 + bob], [x + 8, 80 + bob]]); p.line(curve(c[0], c[1], c[2], 8), "#efe6cf", 9, true); }
  const head = R(spline([[668, 150 + bob], [740, 120 + bob], [800, 150 + bob], [850, 230 + bob], [820, 270 + bob], [748, 244 + bob], [690, 214 + bob]], true, 6));
  p.shadedFill(head, C, mul(C, SH_CLOTH), light, 90, 0.4);
  p.inkRing(head, 8, thickAngle(light));
  p.poly(R(spline([[800, 214 + bob], [852, 222 + bob], [856, 266 + bob], [818, 274 + bob]], true, 4)), "#e0b0a0", 6); // muzzle
  const ns = R([[842, 246 + bob]])[0]; p.dot(ns[0], ns[1], 4);
  const ear = R([[714, 150 + bob]])[0]; p.ell(ear[0], ear[1], 28, 11, C, 5, 0, 360, -20 + 46 * hd);
  const eye = R([[778, 168 + bob]])[0];
  if ((opts.blink ?? 0) > 0.5) p.arc(eye[0], eye[1], 9, 5, 10, 170, 3.5); else { p.ell(eye[0], eye[1], 10, 11, "#ffffff", 3); p.dot(eye[0] + 3, eye[1] + 2, 5); }
};
/** herring gull, 600 x 600 box (ground 575): "stand" (beak open 0..1) or "fly" (flap phase 0..1), facing right */
export const gullDraw = (p: Pen, opts: { mode: "stand" | "fly"; flap?: number; light?: number; beak?: number }) => {
  const light = opts.light ?? DEF_LIGHT, W = "#f6f4ee", G = "#9aa4ae", Y = "#f2c230";
  p.rot = null;
  const sv = p.ol; p.ol = 7;
  if (opts.mode === "fly") {
    const f = Math.sin((opts.flap ?? 0) * Math.PI * 2);
    for (const s of [-1, 1]) {
      const wing = spline([[300, 300], [300 + s * 110, 290 - 80 * f], [300 + s * 250, 300 - 150 * f], [300 + s * 210, 330 - 60 * f], [300 + s * 80, 330]], true, 5);
      p.poly(wing, G, 7);
      p.poly([[300 + s * 250, 300 - 150 * f], [300 + s * 210, 330 - 60 * f], [300 + s * 195, 300 - 105 * f]], "#2a2a30", 0);
    }
    p.poly(spline([[200, 312], [300, 290], [400, 300], [430, 318], [300, 340]], true, 6), W, 7);
    p.ell(420, 300, 30, 24, W, 6); p.poly([[446, 300], [490, 308], [446, 314]], Y, 4); p.dot(428, 294, 4.5);
  } else {
    p.line([[290, 470], [286, 568]], "#e8a07a", 8, true); p.line([[330, 470], [336, 568]], "#e8a07a", 8, true);
    const body = spline([[160, 380], [240, 330], [360, 320], [420, 380], [380, 470], [250, 480], [180, 440]], true, 8);
    p.shadedFill(body, W, mul(W, SH_CLOTH), light, 140, 0.4);
    p.inkRing(body, 7, thickAngle(light));
    p.poly(spline([[160, 380], [240, 350], [350, 360], [330, 430], [220, 440], [120, 420]], true, 6), G, 6);
    p.poly([[120, 420], [170, 400], [160, 440]], "#2a2a30", 4);
    p.ell(400, 300, 52, 46, W, 7);
    const bo = (opts.beak ?? 0) * 14;
    p.poly([[444, 292], [520, 298 - bo * 0.2], [444, 308]], Y, 4); p.poly([[444, 308], [516, 304 + bo], [444, 316]], Y, 4); p.dot(506, 304, 4.5, "#d8402e");
    p.ell(414, 288, 9, 9, "#ffffff", 3); p.dot(416, 289, 4.5); p.stroke([[400, 274], [426, 280]], 4);
  }
  p.ol = sv;
};

// ---------------- props (lit cards) ----------------
/** a Grooved Ware pot standing on its base, 600 x 600 box (ground 575): rim 185 units */
export const potDraw = (p: Pen, opts: { light?: number }) => { p.rot = null; potArt(p, 300, 575 - 0.43 * 185, 185, opts.light ?? DEF_LIGHT); };
/** the geologist's top hat sitting on a shelf, 600 x 600 box (ground 575): crown 104 units wide */
export const topHatDraw = (p: Pen, opts: { light?: number }) => { p.rot = null; topHatArt(p, 300, 560, 104, opts.light ?? DEF_LIGHT, shade(GEOLOGIST.jacket, 0.9)); };

// ---------------- effects (unlit) ----------------
/** a buzzing fly, 300 x 300 box, u = phase (wings flicker) */
export const flyDraw = (p: Pen, u: number) => {
  p.rot = null;
  const f = Math.sin(u * Math.PI * 2 * 6) > 0;
  withAlpha(p, 0.6, () => { p.ell(140, 128 - (f ? 14 : 4), 30, 16, "#dfeef8", 3, 0, 360, f ? -30 : -10); p.ell(168, 128 - (f ? 14 : 4), 30, 16, "#dfeef8", 3, 0, 360, f ? 30 : 10); });
  p.ell(154, 150, 26, 18, "#1e1a22", 0);
  p.ell(182, 146, 12, 12, "#1e1a22", 0);
  p.dot(188, 142, 4, "#b8302e");
};
/** stink lines: three wavy green wisps rising, 300 x 400 box, u = phase 0..1 */
export const stinkDraw = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 3; k++) {
    const t = (u + k / 3) % 1, pts: P2[] = [];
    for (let i = 0; i <= 14; i++) { const s = i / 14; pts.push([80 + k * 70 + 22 * Math.sin(s * 8 + u * 12 + k * 2), 380 - 300 * s - 60 * t]); }
    withAlpha(p, Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)), () => { p.stroke(pts, 16, "#3b5a1e"); p.stroke(pts, 9, "#9acd4a"); });
  }
};
/** sand thrown back from a spade: grains + clods on arcs, 400 x 400 box (launch at the bottom left), u 0..1 */
export const sandSpray = (p: Pen, u: number, seed = 0) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 0.6 * (1 - t), () => p.ell(90 + 140 * t, 330 - 120 * t, 60 + 80 * t, 34 + 40 * t, "#ecd9a6", 0));
  for (let i = 0; i < 14; i++) {
    const a = rad(-80 + i * 5 + 10 * rnd(seed, i)), v = 330 + 90 * rnd(seed, i + 20), x = 60 + Math.cos(a) * v * t + 120 * t, y = 360 + Math.sin(a) * v * t + 420 * t * t, r = (i % 3 ? 7 : 13) * (1 - 0.4 * t);
    if (y < 395) p.ell(x, y, r, r * 0.85, i % 3 ? "#e3c88e" : "#c9a86a", i % 3 ? 2 : 3);
  }
};
/** pipe smoke: three soft puffs rising and growing, 200 x 300 box, u = phase */
export const smokeDraw = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 3; k++) {
    const t = (u + k / 3) % 1, r = 14 + 30 * t;
    withAlpha(p, 0.75 * (1 - t), () => p.ell(100 + 22 * Math.sin(t * 5 + k), 270 - 230 * t, r, r * 0.85, "#f2f0ec", 4));
  }
};
/** sea spray from a wave on the wall: a jagged water plume shoots up (u < .35), bursts into drops and falls, 600 x 1000 box */
export const sprayDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), up = 1 - (1 - Math.min(1, t / 0.35)) ** 2, fall = clamp((t - 0.35) / 0.65, 0, 1), FO = "#eef9ff", BL = "#a9daf2";
  withAlpha(p, 1 - fall ** 1.4, () => {
    const top = 990 - 840 * up + 420 * fall * fall, wTop = 150 + 90 * up, wBot = 70;
    const L: P2[] = [], R: P2[] = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12, y = 990 - (990 - top) * k, w = wBot + (wTop - wBot) * k ** 1.5, wob = 14 * Math.sin(i * 1.9 + t * 9);
      L.push([300 - w + wob, y]); R.push([300 + w + wob, y]);
    }
    const crown: P2[] = [];
    for (let i = 0; i <= 14; i++) { const k = i / 14, x = 300 - wTop * 1.15 + 2.3 * wTop * k; crown.push([x, top - (i % 2 ? 120 : 30) * (0.6 + 0.4 * Math.sin(i * 2.7)) * (1 - 0.5 * fall)]); }
    const body = [...L, ...crown.slice(1, -1).reverse().reverse(), ...R.reverse()];
    p.poly(body, FO, 7);
    p.clip(body, () => {
      for (let i = -2; i <= 2; i++) p.stroke([[300 + i * 46, 990], [300 + i * 70, top + 60]], 16, BL);
      p.stroke([[300 - wTop, top + 40], [300 + wTop, top + 40]], 22, "#ffffff");
    });
    p.poly(body, null, 7);
  });
  for (let i = 0; i < 24; i++) { // drops thrown out of the burst, ballistic
    const s = (i % 2 ? 1 : -1) * (0.25 + 0.75 * rnd(5, i)), vx = 380 * s, vy = -420 - 420 * rnd(7, i), tt = Math.max(0, t - 0.22) * 1.3;
    const x = 300 + vx * tt, y = 180 + vy * tt + 1500 * tt * tt, r = 10 + 10 * rnd(9, i);
    if (tt > 0 && y < 995 && y > 0) p.poly([[x, y - 1.6 * r], [x + r, y], [x, y + r], [x - r, y]], i % 3 ? FO : BL, 3.5);
  }
};
/** a curtain of water falling over a character (drenching), 600 x 1000 box, u 0..1 */
export const drenchDraw = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), y0 = -200 + 1300 * t;
  withAlpha(p, 0.8 * (1 - t * 0.6), () => {
    for (let i = 0; i < 26; i++) {
      const x = 40 + ((i * 97) % 520), y = y0 - ((i * 173) % 700), L = 40 + (i % 4) * 22;
      if (y > -60 && y < 1060) p.stroke([[x, y - L], [x + 3, y]], 9 + (i % 3) * 3, i % 2 ? "#e6f6ff" : "#bfe2f4");
    }
    for (let i = 0; i < 10; i++) { const x = 60 + ((i * 131) % 480), y = y0 + 40 - ((i * 211) % 500); if (y > 0 && y < 1000) p.ell(x, y, 16, 20, "#e6f6ff", 3); }
  });
};
/** drips falling off a soaked character, 300 x 300 box, u = phase */
export const dripDraw = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 5; k++) {
    const t = (u * 1.5 + k * 0.23) % 1, x = 40 + k * 55 + 6 * Math.sin(k * 3), y = 30 + 250 * t * t;
    withAlpha(p, 1 - t * 0.6, () => p.poly([[x, y - 18], [x + 9, y], [x, y + 9], [x - 9, y]], "#bfe8ff", 3));
  }
};
/** surprise "take" lines round a head, 400 x 400 box, u 0..1 (pop out then fade) */
export const takeLines = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), g = Math.min(1, t * 4), a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  withAlpha(p, a, () => {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const ang = rad((s > 0 ? -30 : 210) + (s > 0 ? 1 : -1) * i * 30), r0 = 120 + 20 * g, r1 = r0 + 60 * g;
      p.stroke([[200 + r0 * Math.cos(ang), 200 + r0 * Math.sin(ang)], [200 + r1 * Math.cos(ang), 200 + r1 * Math.sin(ang)]], 12);
    }
  });
};
/** a flying fish skeleton (unlit fx), 400 x 200 box, spin angle in radians */
export const fishFx = (p: Pen, spin: number) => { p.rot = null; fishArt(p, 200, 100, 300, spin); };

// =====================================================================================================================
// ====================== Kaifeng 1232: crowd cards (Mongol army, rope crews, Jin wall defenders) + effects ==============
// Drawn to match the 3D toon cast (toon3d.ts): white heads with a lavender crescent, plum ink, ink-stick limbs, ball
// hands, robes as flared skirts. Body box 600 x 1000 (soles at y 975); effects on 300 x 300 boxes.
// =====================================================================================================================
const LAV = "#c9c6e4", FEAT = "#2b2430";
/** white toon head + tiny face (dot eyes, mouth) */
const kHead = (p: Pen, cx: number, cy: number, rw: number, rh: number, light: number, mouth: "flat" | "open" = "flat", look = 0) => {
  const pts = ellPts(cx, cy, rw, rh, 0, 360, 0, 40);
  p.shadedFill(pts, "#ffffff", LAV, light, rw, 0.5);
  p.poly(pts, null, 10);
  const ex = rw * 0.26, ey = cy + rh * 0.08;
  for (const s of [-1, 1]) p.ell(cx + s * ex + look * rw * 0.25, ey, rw * 0.06, rh * 0.08, FEAT, 0);
  if (mouth === "open") p.ell(cx + look * rw * 0.12, cy + rh * 0.42, rw * 0.1, rh * 0.09, "#3a1e2a", 4);
  else p.stroke([[cx - rw * 0.12 + look * rw * 0.12, cy + rh * 0.4], [cx + rw * 0.12 + look * rw * 0.12, cy + rh * 0.4]], 6, FEAT);
};
/** Mongol felt hat: rounded cone crown, fur brim, knob; ear flaps */
const kMongolHat = (p: Pen, cx: number, by: number, rw: number, crown: string, fur: string, light: number) => {
  const cr: P2[] = [[cx - rw * 0.86, by], [cx - rw * 0.8, by - rw * 0.42], [cx - rw * 0.5, by - rw * 0.82], [cx, by - rw * 0.98], [cx + rw * 0.5, by - rw * 0.82], [cx + rw * 0.8, by - rw * 0.42], [cx + rw * 0.86, by]];
  const crs = spline(cr, true, 6);
  p.shadedFill(crs, crown, shade(crown, 0.68), light, rw, 0.4); p.poly(crs, null, 10);
  for (const s of [-1, 1]) p.ell(cx + s * rw * 1.0, by + rw * 0.42, rw * 0.2, rw * 0.42, fur, 9);
  p.poly(rrect(cx - rw * 1.08, by - rw * 0.2, cx + rw * 1.08, by + rw * 0.2, rw * 0.18), fur, 10);
  p.ell(cx, by - rw * 1.0, rw * 0.13, rw * 0.13, "#e8c45a", 7);
};
/** Jin round iron helmet with a red tassel and neck flaps */
const kJinHelm = (p: Pen, cx: number, by: number, rw: number, light: number) => {
  for (const s of [-1, 1]) p.poly([[cx + s * rw * 0.85, by], [cx + s * rw * 1.12, by + rw * 0.75], [cx + s * rw * 0.7, by + rw * 0.8], [cx + s * rw * 0.62, by]], "#5b4636", 8);
  const dome = ellPts(cx, by, rw * 1.04, rw * 0.92, 180, 360, 0, 30);
  p.shadedFill(dome, "#8d96a3", "#5e6672", light, rw, 0.4); p.poly(dome, null, 10);
  p.poly(rrect(cx - rw * 1.08, by - rw * 0.08, cx + rw * 1.08, by + rw * 0.1, rw * 0.08), "#c9a24a", 8);
  p.ell(cx, by - rw * 0.98, rw * 0.36, rw * 0.2, "#d23a2e", 8);
  p.ell(cx, by - rw * 1.18, rw * 0.09, rw * 0.09, "#c9a24a", 6);
};
/** a robed toon figure in front view; s scales it about the soles at (cx, gy) */
export type KFig = { robe: string; trim: string; sash: string; hat: "mongol" | "jin"; crown?: string; fur?: string; lamellar?: boolean;
  arms?: "down" | "spear" | "up" | "pole"; mouth?: "flat" | "open"; look?: number };
const kFigure = (p: Pen, o: KFig, cx: number, gy: number, s: number, light: number) => {
  const Y = (y: number) => gy - (975 - y) * s, Xc = (x: number) => cx + (x - 300) * s, U = (v: number) => v * s;
  for (const sx of [-1, 1]) { p.stroke([[Xc(300 + sx * 42), Y(740)], [Xc(300 + sx * 48), Y(955)]], U(17), INK); p.ell(Xc(300 + sx * 58), Y(960), U(30), U(16), INK, 0); }
  const body: P2[] = spline([[Xc(196), Y(780)], [Xc(206), Y(560)], [Xc(222), Y(420)], [Xc(300), Y(372)], [Xc(378), Y(420)], [Xc(394), Y(560)], [Xc(404), Y(780)]], true, 6);
  p.gradFill(body, o.robe, shade(o.robe, 0.66), light, 0.3);
  if (o.lamellar) p.clip(body, () => {
    p.poly(rrect(Xc(190), Y(390), Xc(410), Y(600), U(6)), "#7f7b72", 0);
    for (let y = 400; y < 600; y += 26) p.stroke([[Xc(190), Y(y)], [Xc(410), Y(y)]], U(4), "#3a3238");
    for (let y = 400, r = 0; y < 600; y += 26, r++) for (let x = 200 + (r % 2) * 12; x < 410; x += 24) p.stroke([[Xc(x), Y(y)], [Xc(x), Y(y + 22)]], U(3), "#4a4248");
  });
  else p.stroke([[Xc(318), Y(380)], [Xc(262), Y(500)], [Xc(262), Y(780)]], U(14), o.trim);
  p.poly(rrect(Xc(206), Y(560), Xc(394), Y(600), U(8)), o.sash, U(8));
  p.stroke([[Xc(198), Y(770)], [Xc(402), Y(770)]], U(14), o.trim);
  p.poly(body, null, U(11));
  const arm = (sx: number, hx: number, hy: number) => { p.stroke(curve([Xc(300 + sx * 88), Y(420)], [Xc(300 + sx * 128), Y((420 + hy) / 2)], [Xc(hx), Y(hy)]), U(15), INK); p.dot(Xc(hx), Y(hy), U(18), INK); };
  const a = o.arms ?? "down";
  if (a === "up") { arm(-1, 150, 210); arm(1, 450, 210); }
  else if (a === "spear" || a === "pole") { arm(-1, 168, 600); arm(1, 440, 520); }
  else { arm(-1, 176, 640); arm(1, 424, 640); }
  if (a === "spear") {
    p.band([[Xc(440), Y(960)], [Xc(440), Y(60)]], "#8a5a2e", U(12), U(4), "round");
    p.poly([[Xc(424), Y(70)], [Xc(440), Y(-10)], [Xc(456), Y(70)]], "#c8ced6", U(6));
    p.ell(Xc(440), Y(96), U(20), U(16), "#d23a2e", U(5));
  }
  const hy = 245, hw = 128, hh2 = 116;
  kHead(p, Xc(300), Y(hy), U(hw), U(hh2), light, o.mouth ?? "flat", o.look ?? 0);
  if (o.hat === "mongol") kMongolHat(p, Xc(300), Y(hy - 72), U(hw), o.crown ?? "#3a6a8a", o.fur ?? "#6a4a2a", light);
  else kJinHelm(p, Xc(300), Y(hy - 62), U(hw), light);
};
const MONGOL_DEELS = ["#b0763a", "#4f8a86", "#7a5a3a", "#2f5fa8", "#8a3a2a", "#6a7a3a", "#9a6a44", "#3a5a7a"];
const MONGOL_CROWNS = ["#3a6a8a", "#8a3a2a", "#5a6a72", "#b8382e", "#2a3a5a", "#6a4a2a"];
export const mongolFig = (v: number, arms: KFig["arms"] = "spear"): KFig => ({ robe: MONGOL_DEELS[v % 8], trim: shade(MONGOL_DEELS[v % 8], 0.55), sash: ["#c88a3a", "#3a5a7a", "#c8442e", "#e8c45a"][v % 4],
  hat: "mongol", crown: MONGOL_CROWNS[(v * 5) % 6], fur: ["#6a4a2a", "#7a5233", "#5a4030"][v % 3], arms });
export const jinFig = (v: number, arms: KFig["arms"] = "down", mouth: "flat" | "open" = "flat"): KFig => ({ robe: ["#b23a2e", "#9a2f3a", "#c0562e", "#a8402a"][v % 4], trim: "#3a2a20", sash: "#3a2a20", hat: "jin", lamellar: true, arms, mouth });
/** a standing figure card (body box) */
export const footDraw = (p: Pen, o: KFig, light = DEF_LIGHT) => { p.rot = null; kFigure(p, o, 300, 975, 1, light); };
/** banner bearer: tall pole, a tongued flag, a horsetail tuft; drawn for a card scale of 1.6 (figure at 1/1.6) */
export const bannerDraw = (p: Pen, v: number, light = DEF_LIGHT) => {
  p.rot = null;
  const fc = ["#2f5fa8", "#f2efe6", "#b8382e", "#2a8a86"][v % 4], ec = ["#e8c45a", "#2f5fa8", "#e8c45a", "#f2efe6"][v % 4];
  p.band([[372, 975], [372, 40]], "#6a4a2a", 10, 4, "round");
  const fl: P2[] = [[378, 70], [560, 82], [530, 120], [575, 150], [535, 185], [570, 220], [378, 240]];
  p.poly(fl, fc, 8); p.stroke([[388, 90], [520, 100]], 6, ec); p.ell(455, 158, 34, 34, ec, 6);
  for (let i = 0; i < 7; i++) p.stroke(curve([372, 46], [372 + (i - 3) * 9, 70], [372 + (i - 3) * 16, 118]), 6, "#3a2a20");
  p.ell(372, 40, 12, 12, "#e8c45a", 5);
  kFigure(p, mongolFig(v + 2, "pole"), 300, 975, 1 / 1.6, light);
};
/** horse + rider, 3/4 side view facing LEFT (body box, card scale ~1.35) */
export const riderDraw = (p: Pen, v: number, light = DEF_LIGHT) => {
  p.rot = null;
  const hc = ["#8a5a32", "#c08a52", "#4a3428", "#e8e2d6", "#6a4a3a"][v % 5], mane = v % 5 === 3 ? "#9a9088" : "#2a1d16";
  const o = mongolFig(v + 1, "spear");
  for (const [x, d] of [[178, 0], [222, 8], [396, -6], [440, 4]] as [number, number][]) { p.stroke([[x, 760], [x + d, 950]], 20, INK); p.ell(x + d - 6, 958, 22, 13, INK, 0); }
  p.stroke(curve([500, 660], [548, 720], [530, 840]), 26, mane);
  const bd = ellPts(310, 705, 205, 98, 0, 360, -4, 40);
  p.shadedFill(bd, hc, shade(hc, 0.7), light, 205, 0.4); p.poly(bd, null, 11);
  const nk: P2[] = spline([[150, 690], [92, 540], [130, 505], [236, 640]], true, 6);
  p.poly(nk, hc, 11);
  const hd = ellPts(80, 548, 72, 40, 0, 360, 32, 30);
  p.shadedFill(hd, hc, shade(hc, 0.7), light, 72, 0.4); p.poly(hd, null, 10);
  p.poly([[112, 500], [126, 462], [140, 506]], hc, 8);
  p.dot(78, 530, 7, FEAT);
  for (let i = 0; i < 5; i++) p.stroke([[118 + i * 22, 520 + i * 28], [146 + i * 22, 512 + i * 28]], 12, mane);
  p.poly(rrect(250, 600, 400, 680, 14), "#c8442e", 9);
  p.stroke([[318, 640], [300, 770]], 16, INK); p.ell(296, 778, 22, 13, INK, 0);
  const tb: P2[] = spline([[248, 640], [262, 520], [320, 470], [378, 520], [392, 640]], true, 6);
  p.gradFill(tb, o.robe, shade(o.robe, 0.66), light, 0.3); p.stroke([[332, 478], [290, 560], [290, 640]], 12, o.trim); p.poly(tb, null, 10);
  p.band([[402, 820], [402, 110]], "#8a5a2e", 11, 4, "round"); p.poly([[388, 120], [402, 46], [416, 120]], "#c8ced6", 6); p.ell(402, 142, 18, 14, "#d23a2e", 5);
  p.stroke(curve([370, 520], [404, 560], [402, 590]), 14, INK); p.dot(402, 590, 17, INK);
  kHead(p, 316, 395, 92, 84, light, "flat", -0.6);
  kMongolHat(p, 316, 343, 92, o.crown!, o.fur!, light);
};
/** rope puller in side view facing LEFT (toward the trebuchet); k 0 = arms up on the rope, 1 = leaning back, pulled down */
export const pullerDraw = (p: Pen, v: number, k: number, light = DEF_LIGHT) => {
  p.rot = null;
  const o = mongolFig(v, "down"), lean = rad(-24 * k), hip: P2 = [300, 600];
  const R2 = (q: P2): P2 => rotAbout(q, lean, hip);
  p.stroke([hip, [250 - 30 * k, 790], [200 - 40 * k, 955]], 17, INK); p.ell(186 - 40 * k, 960, 32, 15, INK, 0);
  p.stroke([hip, [345, 790], [372 + 20 * k, 955]], 17, INK); p.ell(362 + 20 * k, 960, 32, 15, INK, 0);
  const body = spline([R2([215, 770]), R2([222, 560]), R2([250, 420]), R2([310, 380]), R2([360, 430]), R2([380, 560]), R2([392, 770])], true, 6);
  p.gradFill(body, o.robe, shade(o.robe, 0.66), light, 0.3);
  p.poly([R2([214, 560]), R2([386, 560]), R2([388, 600]), R2([212, 600])], o.sash, 8);
  p.poly(body, null, 11);
  const sh = R2([290, 430]), hand = PULL_HAND(k);
  p.stroke(curve(sh, [(sh[0] + hand[0]) / 2 - 20, (sh[1] + hand[1]) / 2], hand), 15, INK); p.dot(hand[0], hand[1], 18, INK);
  p.stroke(curve(R2([320, 430]), [(sh[0] + hand[0]) / 2 + 10, (sh[1] + hand[1]) / 2 + 20], [hand[0] + 24, hand[1] + 20]), 15, INK); p.dot(hand[0] + 24, hand[1] + 20, 18, INK);
  const hc = R2([300, 255]);
  kHead(p, hc[0], hc[1], 118, 110, light, k > 0.5 ? "open" : "flat", -0.8);
  kMongolHat(p, hc[0], hc[1] - 68, 118, o.crown!, o.fur!, light);
};
/** the (front) hand on a puller card in design units, for a rope strip */
export const PULL_HAND = (k: number): P2 => (k < 0.5 ? [180 + 40 * k, 150 + 500 * k] : [230, 470 + 40 * (k - 0.5)]);

// ---- effects (300 x 300, u 0..1) ----
/** earth dust burst at an impact: loess puffs + flying clods */
export const dustBurst = (p: Pen, u: number, seed = 0) => {
  p.rot = null;
  const t = clamp(u, 0, 1), e = 1 - (1 - t) ** 2;
  withAlpha(p, 0.92 * (1 - t) ** 0.8, () => {
    for (let i = 0; i < 8; i++) {
      const a = rad(-180 + i * 26 + 14 * rnd(seed, i)), d = 30 + 95 * e * (0.7 + 0.3 * rnd(seed, i + 9)), r = (30 + 16 * rnd(seed, i + 3)) * (0.7 + 0.6 * e);
      p.ell(150 + d * Math.cos(a), 175 + d * 0.8 * Math.sin(a) - 30 * e, r, r * 0.85, i % 3 ? "#e6cc96" : "#d6b67a", 0);
    }
  });
  for (let i = 0; i < 9; i++) {
    const a = rad(-170 + i * 20), v = 120 + 50 * rnd(seed, i + 30), x = 150 + Math.cos(a) * v * t, y = 170 + Math.sin(a) * v * t + 190 * t * t, r = 9 - 4 * t;
    if (y < 290 && r > 2) p.ell(x, y, r, r * 0.8, i % 2 ? "#8f6b45" : "#b08850", 3);
  }
};
/** wood splinters flying from a smashed tower */
export const splinterFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  for (let i = 0; i < 11; i++) {
    const a = rad(-175 + i * 17 + 7 * rnd(4, i)), v = 110 + 40 * rnd(5, i), x = 150 + Math.cos(a) * v * t, y = 160 + Math.sin(a) * v * t + 160 * t * t, L = 26 + 10 * (i % 3);
    if (y < 295) p.poly(rotPts([[x - L, y - 4], [x + L, y - 2], [x + L - 4, y + 4], [x - L + 3, y + 5]], i * 1.3 + t * 9, x, y), i % 3 ? "#b07a42" : "#8a5a2e", 4);
  }
};
/** a dung patty squish: brown splat + flecks */
export const splatFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), pts: P2[] = [];
  for (let i = 0; i < 14; i++) { const a = rad(i * (360 / 14)), r = (i % 2 ? 52 : 70) * (0.8 + 0.3 * Math.min(1, t * 3)); pts.push([150 + r * Math.cos(a), 150 + r * Math.sin(a) * 0.85]); }
  p.poly(spline(pts, true, 4), "#6b4a2a", 6);
  for (let i = 0; i < 7; i++) { const a = rad(i * 51 + 20), d = 80 + 70 * t; if (t > 0.05 && t < 0.9) p.ell(150 + d * Math.cos(a), 150 + d * Math.sin(a) + 60 * t * t, 9, 8, "#5a3c22", 3); }
};
/** straw bits scattering */
export const strawFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  for (let i = 0; i < 14; i++) {
    const a = rad(-170 + i * 12), v = 90 + 40 * rnd(8, i), x = 150 + Math.cos(a) * v * t, y = 200 + Math.sin(a) * v * t + 150 * t * t, an = i * 0.7 + t * 4;
    if (y < 295) p.stroke([[x - 16 * Math.cos(an), y - 16 * Math.sin(an)], [x + 16 * Math.cos(an), y + 16 * Math.sin(an)]], 5, i % 3 ? "#e8c860" : "#c9a040");
  }
};
/** sparks: hot yellow-orange streaks radiating from a hit, white core early */
export const sparkFx = (p: Pen, u: number, seed = 0) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  for (let i = 0; i < 12; i++) {
    const a = rad(-180 + i * 15 + 10 * rnd(seed, i)), d0 = 20 + 110 * t, d1 = d0 + 34 * (1 - t) + 8, g = 60 * t * t;
    p.stroke([[150 + d0 * Math.cos(a), 160 + d0 * Math.sin(a) + g], [150 + d1 * Math.cos(a), 160 + d1 * Math.sin(a) + g]], 7 * (1 - t) + 2, i % 3 ? "#ffd23a" : "#ff8a2a");
  }
  if (t < 0.25) p.ell(150, 160, 20 * (1 - t), 20 * (1 - t), "#fff6c8", 0);
};
/** a sputtering fuse spark (variant n 0..3, swapped on ones) */
export const fuseFx = (p: Pen, n: number) => {
  p.rot = null;
  p.ell(150, 150, 22, 22, "#fff6c8", 0);
  for (let i = 0; i < 7; i++) { const a = rad(i * 51 + n * 23), L = 50 + 45 * rnd(n + 1, i); p.stroke([[150 + 18 * Math.cos(a), 150 + 18 * Math.sin(a)], [150 + L * Math.cos(a), 150 + L * Math.sin(a)]], 6, i % 2 ? "#ffd23a" : "#ff8a2a"); }
};
/** dark soot puffs after the blast */
export const sootFx = (p: Pen, u: number, seed = 0) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 0.85 * (1 - t), () => {
    for (let i = 0; i < 6; i++) {
      const a = rad(-160 + i * 28), d = 25 + 80 * t, r = (34 + 14 * rnd(seed, i)) * (0.6 + 0.7 * t);
      p.ell(150 + d * Math.cos(a), 190 + d * 0.6 * Math.sin(a) - 70 * t, r, r * 0.85, i % 2 ? "#4a4550" : "#5e5862", 0);
    }
  });
};
/** a thin grey smoke wisp curling up (u = phase 0..1) */
export const wispFx = (p: Pen, u: number) => {
  p.rot = null;
  for (let k = 0; k < 2; k++) {
    const pts: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([130 + k * 40 + 16 * Math.sin(t * 6 + u * 6.283 + k * 2.5), 280 - t * 240]); }
    withAlpha(p, 0.7, () => p.stroke(pts, 13 - k * 3, "#6a6470"));
  }
};
/** one white feather (the card's rot turns it) */
export const featherFx = (p: Pen) => {
  p.rot = null;
  const v: P2[] = spline([[150, 30], [190, 90], [196, 170], [160, 250], [150, 262], [118, 200], [110, 110], [130, 50]], true, 5);
  p.poly(v, "#ffffff", 8);
  p.stroke([[150, 40], [150, 285]], 6, "#b8b2c0");
  for (let y = 80; y < 240; y += 32) { p.stroke([[150, y], [182, y - 18]], 3, "#d6d0dc"); p.stroke([[150, y + 10], [122, y - 6]], 3, "#d6d0dc"); }
};

// =====================================================================================================================
// ====================== Pigs short (Megara 266 BC / Edessa 544 AD): crowd cards + effect cards ========================
// Same toon language as the Kaifeng cards (white heads, lavender crescent, plum ink, ink-stick limbs, ball hands).
// Body box 600 x 1000 (soles at y 975). Effects on 300 x 300 boxes (u = progress 0..1).
// =====================================================================================================================
export type PFig = {
  tunic: string; trim?: string; belt?: string; cloak?: string; trousers?: string;
  hat: "greek" | "roman" | "turban" | "cap" | "hair" | "persian";
  hatCol?: string; crest?: string;
  arms?: "down" | "up" | "up2" | "spear" | "sarissa" | "throwBack" | "throw" | "bowIdle" | "bowDraw" | "bowLoose" | "pour" | "herd" | "flail" | "grip";
  shield?: string; step?: 0 | 1 | 2 | 3; sit?: boolean;
  eyes?: "dot" | "ring" | "angry"; mouth?: "flat" | "open" | "grin"; back?: boolean; sweat?: boolean; look?: number;
};
/** white toon head with a few face states; back = the back of the head (no face) */
const pHead = (p: Pen, cx: number, cy: number, rw: number, rh: number, light: number, o: PFig) => {
  const pts = ellPts(cx, cy, rw, rh, 0, 360, 0, 40);
  p.shadedFill(pts, "#ffffff", LAV, light, rw, 0.5);
  p.poly(pts, null, 10);
  if (o.back) return;
  const ex = rw * 0.27, ey = cy + rh * 0.08, lk = (o.look ?? 0) * rw * 0.25;
  for (const s of [-1, 1]) {
    if (o.eyes === "ring") { p.ell(cx + s * ex + lk, ey, rw * 0.15, rh * 0.17, "#ffffff", 5); p.dot(cx + s * ex + lk, ey, rw * 0.045, FEAT); }
    else p.ell(cx + s * ex + lk, ey, rw * 0.06, rh * 0.08, FEAT, 0);
    if (o.eyes === "angry") p.stroke([[cx + s * ex * 1.6 + lk, ey - rh * 0.26], [cx + s * ex * 0.4 + lk, ey - rh * 0.14]], 7, FEAT);
  }
  const m = o.mouth ?? "flat";
  if (m === "open") p.ell(cx + lk * 0.5, cy + rh * 0.44, rw * 0.13, rh * 0.13, "#3a1e2a", 4);
  else if (m === "grin") p.poly([[cx - rw * 0.22 + lk * 0.5, cy + rh * 0.36], [cx + rw * 0.22 + lk * 0.5, cy + rh * 0.36], [cx + lk * 0.5, cy + rh * 0.56]], "#3a1e2a", 4);
  else p.stroke([[cx - rw * 0.12 + lk * 0.5, cy + rh * 0.4], [cx + rw * 0.12 + lk * 0.5, cy + rh * 0.4]], 6, FEAT);
  if (o.sweat) { const x = cx + rw * 0.78, y = cy - rh * 0.25; p.poly(spline([[x, y - 34], [x + 16, y + 6], [x, y + 18], [x - 16, y + 6]], true, 5), "#8fd3ff", 5); }
};
/** hats on a head of half-width rw whose brow line is at `by` */
const pHat = (p: Pen, o: PFig, cx: number, by: number, rw: number, light: number) => {
  if (o.hat === "greek" || o.hat === "roman") {
    const metal = o.hatCol ?? (o.hat === "roman" ? "#a9b0ba" : "#c8963a"), crest = o.crest ?? (o.hat === "roman" ? "#d2342a" : "#b8302a");
    // crest (front-to-back horsehair: seen from the front as a tall narrow fan)
    p.poly(spline([[cx - rw * 0.2, by - rw * 0.9], [cx - rw * 0.32, by - rw * 1.45], [cx, by - rw * 1.7], [cx + rw * 0.32, by - rw * 1.45], [cx + rw * 0.2, by - rw * 0.9]], true, 5), crest, 8);
    for (const s of [-1, 1]) p.poly([[cx + s * rw * 0.82, by], [cx + s * rw * 1.05, by + rw * 0.72], [cx + s * rw * 0.62, by + rw * 0.66], [cx + s * rw * 0.55, by]], metal, 8);
    const dome = ellPts(cx, by, rw * 1.06, rw * 0.98, 180, 360, 0, 30);
    p.shadedFill(dome, metal, shade(metal, 0.66), light, rw, 0.4); p.poly(dome, null, 10);
    p.poly(rrect(cx - rw * 1.1, by - rw * 0.08, cx + rw * 1.1, by + rw * 0.1, rw * 0.08), o.hat === "roman" ? "#c9a24a" : shade(metal, 0.8), 8);
  } else if (o.hat === "turban") {
    const c = o.hatCol ?? "#f4efe4";
    const t = ellPts(cx, by - rw * 0.2, rw * 1.12, rw * 0.78, 180, 360, 0, 30);
    p.shadedFill(t, c, shade(c, 0.75), light, rw, 0.4); p.poly(t, null, 10);
    for (let i = 0; i < 3; i++) p.stroke([[cx - rw * (1.0 - i * 0.18), by - rw * (0.12 + i * 0.26)], [cx + rw * (1.0 - i * 0.18), by - rw * (0.3 + i * 0.26)]], 7, shade(c, 0.7));
    p.ell(cx + rw * 0.1, by - rw * 0.9, rw * 0.22, rw * 0.18, o.crest ?? "#e8902a", 7);
  } else if (o.hat === "persian") {
    const c = o.hatCol ?? "#8a5a3a";
    const t = spline([[cx - rw * 1.04, by + rw * 0.05], [cx - rw * 0.9, by - rw * 0.7], [cx - rw * 0.2, by - rw * 1.12], [cx + rw * 0.5, by - rw * 1.0], [cx + rw * 0.2, by - rw * 0.7], [cx + rw * 1.04, by + rw * 0.05]], true, 5);
    p.shadedFill(t, c, shade(c, 0.7), light, rw, 0.4); p.poly(t, null, 10);
  } else if (o.hat === "cap") {
    const c = o.hatCol ?? "#7a5a3a", t = ellPts(cx, by, rw * 1.04, rw * 0.7, 180, 360, 0, 24);
    p.shadedFill(t, c, shade(c, 0.7), light, rw, 0.4); p.poly(t, null, 10);
  } else { // curly hair
    const c = o.hatCol ?? "#5a3a20";
    for (let i = 0; i < 7; i++) { const a = rad(190 + i * 26.6); p.ell(cx + Math.cos(a) * rw * 0.82, by + rw * 0.25 + Math.sin(a) * rw * 0.8, rw * 0.32, rw * 0.3, c, 7); }
  }
};
/** a period toon figure in front view (or the back), soles at (cx, gy), scaled by s */
const pFigure = (p: Pen, o: PFig, cx: number, gy: number, s: number, light: number) => {
  const Y = (y: number) => gy - (975 - y) * s, Xc = (x: number) => cx + (x - 300) * s, U = (v: number) => v * s;
  const st = o.step ?? 0;
  if (o.sit) for (const sx of [-1, 1]) { p.stroke([[Xc(300 + sx * 42), Y(740)], [Xc(300 + sx * 130), Y(800)], [Xc(300 + sx * 120), Y(905)]], U(17), INK); p.ell(Xc(300 + sx * 132), Y(910), U(28), U(15), INK, 0); }
  else for (const sx of [-1, 1]) {
    const fx = st === 2 ? sx * 120 : st === 1 ? sx * (sx > 0 ? 70 : 30) : st === 3 ? sx * (sx > 0 ? 30 : 70) : sx * 48, fy = st === 1 && sx > 0 ? 925 : st === 3 && sx < 0 ? 925 : 955;
    p.stroke([[Xc(300 + sx * 42), Y(740)], [Xc(300 + fx), Y(fy)]], U(17), o.trousers ?? INK); p.ell(Xc(300 + fx + sx * 10), Y(fy + 5), U(30), U(16), INK, 0);
  }
  if (o.cloak) { const c = spline([[Xc(210), Y(410)], [Xc(168), Y(600)], [Xc(150), Y(800)], [Xc(300), Y(830)], [Xc(450), Y(800)], [Xc(432), Y(600)], [Xc(390), Y(410)]], true, 6); p.gradFill(c, o.cloak, shade(o.cloak, 0.62), light, 0.3); p.poly(c, null, U(10)); }
  const body: P2[] = spline([[Xc(206), Y(770)], [Xc(212), Y(560)], [Xc(226), Y(420)], [Xc(300), Y(372)], [Xc(374), Y(420)], [Xc(388), Y(560)], [Xc(394), Y(770)]], true, 6);
  const bc = o.back && o.cloak ? o.cloak : o.tunic;
  p.gradFill(body, bc, shade(bc, 0.66), light, 0.3);
  if (!o.back) p.stroke([[Xc(208), Y(760)], [Xc(392), Y(760)]], U(12), o.trim ?? shade(o.tunic, 0.7));
  if (o.belt) p.poly(rrect(Xc(210), Y(565), Xc(390), Y(600), U(8)), o.belt, U(7));
  p.poly(body, null, U(11));
  const arm = (sx: number, hx: number, hy: number, ex?: number, ey?: number) => {
    const sh: P2 = [Xc(300 + sx * 80), Y(425)], el: P2 = ex !== undefined && ey !== undefined ? [Xc(ex), Y(ey)] : [Xc(300 + sx * 128), Y((425 + hy) / 2)];
    p.stroke(curve(sh, el, [Xc(hx), Y(hy)]), U(15), INK); p.dot(Xc(hx), Y(hy), U(18), INK);
  };
  const shaft = (x0: number, y0: number, x1: number, y1: number, tip = true) => {
    p.band([[Xc(x0), Y(y0)], [Xc(x1), Y(y1)]], "#8a5a2e", U(11), U(4), "round");
    if (tip) { const a = Math.atan2(y1 - y0, x1 - x0), L = 70, w = 18; p.poly([[Xc(x1 - Math.sin(a) * w), Y(y1 + Math.cos(a) * w)], [Xc(x1 + Math.cos(a) * L), Y(y1 + Math.sin(a) * L)], [Xc(x1 + Math.sin(a) * w), Y(y1 - Math.cos(a) * w)]], "#c8ced6", U(6)); }
  };
  const bow = (x: number, y: number, drawn: boolean) => {
    p.stroke(curve([Xc(x), Y(y - 190)], [Xc(x - 70), Y(y)], [Xc(x), Y(y + 190)]), U(12), "#6a4220");
    p.stroke(drawn ? [[Xc(x), Y(y - 190)], [Xc(330), Y(y)], [Xc(x), Y(y + 190)]] : [[Xc(x), Y(y - 190)], [Xc(x), Y(y + 190)]], U(3), "#e8e2d6");
  };
  const a = o.arms ?? "down";
  if (a === "up") { arm(-1, 150, 210); arm(1, 450, 210); }
  else if (a === "up2") { arm(-1, 170, 250); arm(1, 440, 300); }
  else if (a === "flail") { arm(-1, 110, 300, 170, 330); arm(1, 500, 250, 440, 300); }
  else if (a === "spear") { shaft(440, 960, 440, 80); arm(-1, 176, 640); arm(1, 440, 520); }
  else if (a === "sarissa") { p.band([[Xc(440), Y(975)], [Xc(440), Y(-1300)]], "#8a5a2e", U(12), U(4), "round"); p.poly([[Xc(424), Y(-1290)], [Xc(440), Y(-1380)], [Xc(456), Y(-1290)]], "#c8ced6", U(6)); arm(-1, 420, 560, 240, 520); arm(1, 440, 500); }
  else if (a === "throwBack") { shaft(520, 380, 300, 280); arm(-1, 200, 420, 150, 520); arm(1, 470, 340, 470, 440); }
  else if (a === "throw") { arm(-1, 210, 600); arm(1, 330, 300, 430, 330); }
  else if (a === "bowIdle") { arm(-1, 176, 640); arm(1, 424, 640); bow(150, 620, false); }
  else if (a === "bowDraw") { arm(-1, 120, 420, 160, 420); arm(1, 340, 430, 290, 470); bow(120, 420, true); p.stroke([[Xc(120), Y(420)], [Xc(360), Y(430)]], U(5), "#8a5a2e"); }
  else if (a === "bowLoose") { arm(-1, 120, 420, 160, 420); arm(1, 420, 380, 400, 470); bow(120, 420, false); }
  else if (a === "pour") { arm(-1, 230, 470, 190, 520); arm(1, 370, 470, 410, 520);
    p.poly(rotPts(rrect(Xc(250), Y(410), Xc(350), Y(500), U(10)), 0.9, Xc(300), Y(455)), "#8a5a2e", U(8)); }
  else if (a === "herd") { shaft(440, 640, 600, 760, false); arm(-1, 176, 640); arm(1, 440, 640); }
  else if (a === "grip") { arm(-1, 230, 500, 190, 560); arm(1, 370, 500, 410, 560); }
  else { arm(-1, 176, 640); arm(1, 424, 640); }
  if (o.shield && !o.back) { // round bronze aspis on the left arm, a simple painted emblem (a ring + a star)
    const sx = 214, sy = 600, r = 118, pts = ellPts(Xc(sx), Y(sy), U(r), U(r), 0, 360, 0, 36);
    p.shadedFill(pts, o.shield, shade(o.shield, 0.62), light, U(r), 0.4); p.poly(pts, null, U(10));
    p.ell(Xc(sx), Y(sy), U(r * 0.84), U(r * 0.84), null, U(6));
    const star: P2[] = []; for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * 0.22 : r * 0.52, aa = (i / 16) * Math.PI * 2; star.push([Xc(sx) + U(rr) * Math.cos(aa), Y(sy) + U(rr) * Math.sin(aa)]); }
    p.poly(star, "#2a1b26", 0);
  }
  const hy = 245, hw = 126, hh2 = 114;
  pHead(p, Xc(300), Y(hy), U(hw), U(hh2), light, o);
  pHat(p, o, Xc(300), Y(hy - 50), U(hw), light);
};
/** a standing / acting figure card (body box); s < 1 draws a smaller figure (tall props like the sarissa fit above) */
export const pigFigDraw = (p: Pen, o: PFig, light = DEF_LIGHT, s = 1) => { p.rot = null; pFigure(p, o, 300, 975, s, light); };
/** a Persian pusher in side view facing LEFT, leaning into the elephant's rump, legs on 4 step poses */
export const pusherDraw = (p: Pen, v: number, ph: number, light = DEF_LIGHT, mouth: "flat" | "open" = "flat") => {
  p.rot = null;
  const tunic = ["#8a3a3a", "#5a6a8a", "#7a6a3a", "#6a4a6a", "#3a6a5a", "#9a5a2a"][v % 6], lean = rad(-38), hip: P2 = [330, 640];
  const R2 = (q: P2): P2 => rotAbout(q, lean, hip);
  const k = ((ph % 4) + 4) % 4, back = [440, 470, 500, 470][k], front = [250, 230, 260, 290][k], lift = [0, 30, 0, 0][k];
  p.stroke([hip, [back - 20, 800], [back + 30, 955]], 17, "#4a3a30"); p.ell(back + 20, 960, 32, 15, INK, 0);
  p.stroke([hip, [front + 40, 800 - lift], [front, 950 - lift]], 17, "#4a3a30"); p.ell(front - 12, 955 - lift, 32, 15, INK, 0);
  const body = spline([R2([240, 780]), R2([246, 560]), R2([270, 420]), R2([330, 380]), R2([390, 430]), R2([410, 560]), R2([416, 780])], true, 6);
  p.gradFill(body, tunic, shade(tunic, 0.66), light, 0.3); p.poly([R2([244, 560]), R2([412, 560]), R2([414, 600]), R2([242, 600])], "#3a2a20", 8); p.poly(body, null, 11);
  const sh = R2([320, 440]), hand: P2 = [120, 360];
  p.stroke(curve(sh, [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 30], hand), 15, INK); p.dot(hand[0], hand[1], 18, INK);
  p.stroke(curve(R2([345, 440]), [(sh[0] + hand[0]) / 2 + 20, (sh[1] + hand[1]) / 2 + 60], [hand[0] + 10, hand[1] + 70]), 15, INK); p.dot(hand[0] + 10, hand[1] + 70, 18, INK);
  const hc = R2([330, 260]);
  pHead(p, hc[0], hc[1], 112, 104, light, { tunic, hat: "persian", eyes: "dot", mouth, look: -0.8 });
  pHat(p, { tunic, hat: "persian", hatCol: ["#5a3a2a", "#c8a050", "#3a3a4a"][v % 3] }, hc[0], hc[1] - 50, 112, light);
};

// ---- effects ----
/** squeal rings: 3 concentric broken white/pink arcs + "!" spikes radiating (no text) */
export const squealFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
  withAlpha(p, fade, () => {
    for (let k = 0; k < 3; k++) {
      const r = 30 + 38 * k + 46 * t, col = k === 1 ? "#ff9ec4" : "#ffffff";
      for (let d = 0; d < 6; d++) { const a0 = d * 60 + 8 + k * 20, a1 = a0 + 38; p.arc(150, 150, r, r * 0.9, a0, a1, 15 - 3 * k, INK); p.arc(150, 150, r, r * 0.9, a0, a1, 9 - 2 * k, col); }
    }
    for (let i = 0; i < 6; i++) { // "!" spikes: a wedge + a dot
      const a = rad(i * 60 + 32), d0 = 92 + 40 * t, d1 = d0 + 30, px = (d: number): P2 => [150 + d * Math.cos(a), 150 + d * 0.9 * Math.sin(a)];
      const n: P2 = [-Math.sin(a) * 6, Math.cos(a) * 6], b = px(d0), e = px(d1);
      p.poly([[b[0] - n[0] * 0.5, b[1] - n[1] * 0.5], [e[0] - n[0], e[1] - n[1]], [e[0] + n[0], e[1] + n[1]], [b[0] + n[0] * 0.5, b[1] + n[1] * 0.5]], "#ffffff", 4);
      const dd = px(d1 + 12); p.ell(dd[0], dd[1], 5, 5, "#ffffff", 3);
    }
  });
};
/** white "tink": a 4-point star flash + short rays */
export const tinkFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), r = 110 * (1 - 0.5 * t);
  p.poly([[150, 150 - r], [166, 134], [150 + r, 150], [166, 166], [150, 150 + r], [134, 166], [150 - r, 150], [134, 134]], "#ffffff", 6);
  for (let i = 0; i < 4; i++) { const a = rad(45 + i * 90), d0 = 60 + 60 * t; p.stroke([[150 + d0 * Math.cos(a), 150 + d0 * Math.sin(a)], [150 + (d0 + 30) * Math.cos(a), 150 + (d0 + 30) * Math.sin(a)]], 9, "#fffbe0"); }
};
/** a black pitch splat + flying drops */
export const pitchSplat = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), pts: P2[] = [];
  for (let i = 0; i < 14; i++) { const a = rad(i * (360 / 14)), r = (i % 2 ? 40 : 62) * (0.7 + 0.4 * Math.min(1, t * 3)); pts.push([150 + r * Math.cos(a), 160 + r * Math.sin(a) * 0.6]); }
  p.poly(spline(pts, true, 4), "#1e1a22", 5);
  p.ell(132, 146, 14, 7, "#5a5662", 0);
  for (let i = 0; i < 6; i++) { const a = rad(-160 + i * 28), d = 70 + 80 * t; if (t > 0.05 && t < 0.95) p.ell(150 + d * Math.cos(a), 150 + d * Math.sin(a) + 140 * t * t, 9, 11, "#1e1a22", 3); }
};
/** a falling pitch drip (teardrop) */
export const dripFx = (p: Pen) => { p.rot = null; p.poly(spline([[150, 60], [185, 190], [150, 240], [115, 190]], true, 5), "#1e1a22", 6); p.ell(140, 180, 9, 14, "#5a5662", 0); };
/** fire whoosh: an orange/yellow burst of flame tongues + a white core early */
export const whooshFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1), e = 1 - (1 - t) ** 3;
  const burst = (R: number, col: string, ol: number, seed: number) => {
    const pts: P2[] = [];
    for (let i = 0; i < 14; i++) { const a = rad(i * (360 / 14) - 90 + seed * 9), up = Math.max(0, -Math.sin(a)), r = R * (i % 2 ? 0.62 : 1 + 0.35 * up) * (0.85 + 0.3 * rnd(seed, i)); pts.push([150 + r * Math.cos(a), 170 + r * Math.sin(a) * 0.9]); }
    p.poly(spline(pts, true, 3), col, ol);
  };
  withAlpha(p, t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, () => {
    burst(60 + 70 * e, "#ff7a1a", 7, 1);
    burst(42 + 50 * e, "#ffc23a", 0, 2);
    if (t < 0.45) burst(26 + 26 * e, "#fff3b8", 0, 3);
  });
};
/** a soft white steam puff (anger steam / a doused torch) rising and growing */
export const steamPuff = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 0.95 * (1 - t) ** 0.7, () => {
    for (let i = 0; i < 5; i++) { const a = rad(i * 72 + 20), d = 28 * (0.5 + t), r = (40 + 10 * (i % 2)) * (0.6 + 0.8 * t); p.ell(150 + d * Math.cos(a), 190 - 90 * t + d * 0.7 * Math.sin(a), r, r * 0.86, "#ffffff", 6); }
  });
};
/** a grey smoke column behind a burning pig (soft; u = phase) */
export const smokeFx = (p: Pen, u: number) => {
  p.rot = null;
  withAlpha(p, 0.75, () => {
    for (let i = 0; i < 4; i++) {
      const t = (u + i * 0.25) % 1, r = 26 + 46 * t;
      withAlpha(p, 1 - t, () => p.ell(150 + 18 * Math.sin(t * 6 + i), 270 - 230 * t, r, r * 0.9, i % 2 ? "#5e5862" : "#7a7480", 0));
    }
  });
};
/** hay bits + dust (stable) */
export const hayFx = (p: Pen, u: number) => {
  p.rot = null;
  const t = clamp(u, 0, 1);
  withAlpha(p, 0.85 * (1 - t), () => { for (let i = 0; i < 5; i++) { const a = rad(-160 + i * 35), d = 30 + 70 * t; p.ell(150 + d * Math.cos(a), 200 + d * 0.5 * Math.sin(a) - 30 * t, 34 * (0.6 + t), 26 * (0.6 + t), "#e8d6a0", 0); } });
  for (let i = 0; i < 8; i++) {
    const a = rad(-170 + i * 22), v = 90 + 30 * rnd(3, i), x = 150 + Math.cos(a) * v * t, y = 190 + Math.sin(a) * v * t + 120 * t * t, an = i * 0.8 + t * 3;
    if (y < 295) p.stroke([[x - 14 * Math.cos(an), y - 14 * Math.sin(an)], [x + 14 * Math.cos(an), y + 14 * Math.sin(an)]], 5, i % 2 ? "#e8c860" : "#c9a040");
  }
};
/** a sweat drop */
export const sweatFx = (p: Pen) => { p.rot = null; p.poly(spline([[150, 40], [200, 180], [150, 250], [100, 180]], true, 5), "#8fd3ff", 9); p.ell(132, 170, 12, 22, "#ffffff", 0); };
/** a black pitch stream poured from a bucket (strip art, along x) */
export const pitchStream = (p: Pen) => { p.rot = null; p.stroke([[0, 20], [1000, 20]], 22, INK); p.stroke([[0, 20], [1000, 20]], 14, "#1e1a22"); p.stroke([[0, 15], [1000, 15]], 3, "#5a5662"); };
