// Pigs short: the CARD cast (crowds > ~6 people, people > ~15 m away, effect cards: puffs, dust, squeal rings, flung
// soldiers). STUB written by the lead: the CHAR owner rewrites stage(). Generic card machinery kept from Kaifeng
// (cast_kaifeng_ref.txt = the full Kaifeng file, a pattern library for crowds, effect cards and person() helpers).
import * as THREE from "three";
import { Pen, fxContact, fxShadow, dustBurst, pigFigDraw, pusherDraw, squealFx, tinkFx, pitchSplat, dripFx, whooshFx, steamPuff, smokeFx, hayFx, sweatFx, pitchStream, type PFig } from "./toon";
import * as S from "./story";
import type { V3 } from "./story";
import { eleBob } from "./beasts";
import { antHeadW, SMEAR_HITS, SMEAR_PT, IGNITE_PT, WATER_BKT } from "./chars";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export type BoxName = "body" | "wide" | "square";
export const BOX: Record<BoxName, { w: number; h: number; ground: number }> = {
  body: { w: 600, h: 1000, ground: 975 }, wide: { w: 1000, h: 500, ground: 475 }, square: { w: 600, h: 600, ground: 575 },
};
const boxGeo = (b: BoxName) => { const B = BOX[b], g = new THREE.PlaneGeometry(B.w * SU, B.h * SU); g.translate(0, (B.ground - B.h / 2) * SU, 0); return g; };
export const GEOS: Record<BoxName, THREE.BufferGeometry> = { body: boxGeo("body"), wide: boxGeo("wide"), square: boxGeo("square") };
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows, casts its silhouette when world.ts says so (golden) */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(GEOS.body, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: BoxName; roll?: number; size?: [number, number, number];
  /** who / what this card is (QA only: continuity + lens-clearance checks) */
  id?: string;
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };


export type Stage = { places: Place[]; fx: FxPlace[] };

// =====================================================================================================================
// ============================================== PIGS STAGING (char owner) ============================================
// =====================================================================================================================
const q = (v: number, n = 120) => Math.round(v * n) / n;
const hsh = S.hash;
/** drawing resolution by distance: canvas scale k from the design units; sized for the 1440 x 2560 final */
const tierK = (d: number) => (d < 3.2 ? 3.0 : d < 6.5 ? 1.8 : d < 16 ? 0.8 : d < 40 ? 0.4 : 0.25);
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
/** any lit drawing in one of the three boxes; `draw` gets the light angle */
const card = (cam: CamInfo, key: string, box: BoxName, draw: (p: Pen, light: number) => void, x: number, y: number, z: number, scale = 1, mirror = false, roll = 0, dScale = scale): Place => {
  const B = BOX[box], d = cam.pos.distanceTo(tmp.set(x, y + (B.h / 2) * SU * scale, z)) / dScale, k = tierK(d);
  const light = light2D(cam, mirror);
  return { key: `${box}|${key}|${q(light, 4)}`, x, y, z, scale, mirror, roll, geo: box, draw: (p) => draw(p, light), size: [B.w * k, B.h * k, k] };
};
/** ground shadow under a standing card: a tight contact pool + (day) a soft tail away from the sun */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = S.clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** an unlit effect card centred at p, w x h metres */
const fx = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, p: V3, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x: p[0], y: p[1], z: p[2], w, h, rot, soft });
const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3();
/** a camera-facing strip card from a to b (pitch stream) */
const strip = (out: Stage, cam: CamInfo, a: V3, b: V3, key: string, cw: number, ch: number, draw: (p: Pen) => void, thick: number) => {
  _a.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).sub(cam.pos).normalize();
  _up.crossVectors(cam.right, _a).normalize();
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const dx = _d.dot(cam.right), dy = _d.dot(_up), len = Math.hypot(dx, dy);
  out.fx.push({ key, cw, ch, draw, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, w: len, h: thick, rot: Math.atan2(dy, dx) });
};
/** a point nudged toward the camera by d metres */
const toward = (cam: CamInfo, p: V3, d: number): V3 => {
  const v = tmp.set(cam.pos.x - p[0], cam.pos.y - p[1], cam.pos.z - p[2]).normalize();
  return [p[0] + v.x * d, p[1] + v.y * d, p[2] + v.z * d];
};
/** progress u of an effect that starts at t0 and lasts dur frames (null outside) */
const prog = (st: number, t0: number, dur: number) => { const u = (st - t0) / dur; return u >= 0 && u < 1 ? u : null; };

/** a period figure card: o = the drawing, facing (dx, dz) picks the back view; s < 1 = a small figure in a big card (sarissas) */
const fig = (cam: CamInfo, out: Stage, o: PFig, x: number, y: number, z: number, o2: { face?: [number, number]; scale?: number; s?: number; roll?: number; shadow?: boolean; mirror?: boolean } = {}) => {
  const sc = o2.scale ?? 1, s = o2.s ?? 1;
  let back = false;
  if (o2.face) { const tx = cam.pos.x - x, tz = cam.pos.z - z, l = Math.hypot(tx, tz) || 1; back = (tx * o2.face[0] + tz * o2.face[1]) / l < -0.35; }
  const oo: PFig = back ? { ...o, back: true, shield: undefined, eyes: undefined, mouth: undefined, sweat: false } : o;
  out.places.push(card(cam, `pf|${fkey(oo)}|${q(s, 20)}`, "body", (p, light) => pigFigDraw(p, oo, light, s), x, y, z, sc, !!o2.mirror, o2.roll ?? 0, sc * s));
  if (o2.shadow && cam.pos.distanceTo(tmp.set(x, y, z)) < 45) blob(out, x, y, z, sc * s);
};
/** a figure flung through the air spinning about its middle: centre c, roll r (the card pivots at the soles) */
const flungFig = (cam: CamInfo, out: Stage, o: PFig, c: V3, roll: number, scale = 1) => {
  const hc = 0.95 * scale, tx = cam.pos.x - c[0], tz = cam.pos.z - c[2], l = Math.hypot(tx, tz) || 1, rx = tz / l, rz = -tx / l;
  const ox = -Math.sin(roll) * hc, oy = Math.cos(roll) * hc;   // the card's up axis after the roll, times the centre height
  out.places.push(card(cam, `pf|${fkey(o)}|1`, "body", (p, light) => pigFigDraw(p, o, light, 1), c[0] + rx * ox, c[1] - oy, c[2] + rz * ox, scale, false, roll));
};
/** a ballistic tumble from p0 at t0: velocity v (m/f), gravity g, spin w (rad/f); lands at y = 0 then lies there */
const tumble = (st: number, t0: number, p0: V3, v: V3, w: number, g = 0.022) => {
  const tl = (v[1] + Math.sqrt(v[1] * v[1] + 2 * g * Math.max(0, p0[1]))) / g, t = Math.min(st - t0, tl);
  const p: V3 = [p0[0] + v[0] * t, Math.max(0, p0[1] + v[1] * t - 0.5 * g * t * t), p0[2] + v[2] * t];
  const landed = st - t0 >= tl, side = Math.sign(w) || 1;
  return { p, roll: landed ? side * Math.PI / 2 : w * t, landed, tl };
};

// ---------------- the casts (fixed layouts, story.ts positions) ----------------
const MEG_TUNIC = ["#3a6aa8", "#c8a24a", "#5a8a5a", "#a8483a", "#7a5aa0", "#d8c8a0"];
const MAC_CLOAK = ["#b8302a", "#a82a30", "#c0402e"];
const megarian = (v: number, extra: Partial<PFig> = {}): PFig => ({ tunic: MEG_TUNIC[v % 6], belt: "#5a3a20", hat: "greek", hatCol: "#c8963a", crest: v % 2 ? "#2a2228" : "#b8302a", ...extra });
const townsman = (v: number, extra: Partial<PFig> = {}): PFig => ({ tunic: ["#e2cfa4", "#c8b48a", "#d8a878", "#b8c0a0"][v % 4], belt: "#7a4a26", hat: v % 3 === 2 ? "cap" : "hair", hatCol: ["#6a4220", "#3a2418", "#8a5a3a"][v % 3], ...extra });
const macedon = (v: number, extra: Partial<PFig> = {}): PFig => ({ tunic: ["#efe6d2", "#d8c8a0", "#9a2a26"][v % 3], cloak: MAC_CLOAK[v % 3], belt: "#5a3a20", hat: "greek", hatCol: "#c8963a", crest: "#d2342a", ...extra });
const roman = (v: number, extra: Partial<PFig> = {}): PFig => ({ tunic: "#c0302a", belt: "#5a3a20", hat: "roman", ...extra, trim: v % 2 ? "#8a2020" : "#a9b0ba" });
const persian = (v: number, extra: Partial<PFig> = {}): PFig => ({ tunic: ["#8a3a3a", "#5a6a8a", "#7a6a3a"][v % 3], trousers: "#4a3a30", belt: "#3a2a20", hat: "persian", hatCol: ["#5a3a2a", "#c8a050", "#3a3a4a"][v % 3], ...extra });

/** the elephants' stampede: z of elephant i per story frame (884..1005), cached once */
const STAMP0 = 884, STAMP1 = 1006;
let _ez: number[][] | null = null;
const eleZ = () => (_ez ??= Array.from({ length: S.N_ELE }, (_, i) => Array.from({ length: STAMP1 - STAMP0 }, (_, k) => S.eleMegara(i, STAMP0 + k).pos[2])));
const ELEX = Array.from({ length: S.N_ELE }, (_, i) => S.eleMegara(i, 900).pos[0]);
/** the first story frame an elephant's front reaches a soldier at (x, z) within `reach` m sideways, + which side he flies */
const hitBy = (x: number, z: number, reach: number, dirZ: 1 | -1, f0: number, f1: number, zAt: (i: number, st: number) => number) => {
  let best = Infinity, side = 1;
  for (let i = 0; i < S.N_ELE; i++) {
    if (Math.abs(x - ELEX[i]) > reach) continue;
    for (let st = f0; st < f1; st++) if ((zAt(i, st) + 2.3 * dirZ - z) * dirZ >= 0) { if (st < best) { best = st; side = x >= ELEX[i] ? 1 : -1; } break; }
  }
  return { t: best, side };
};
/** the Macedonian phalanx: files 2 m apart, 8 ranks 2.2 m deep behind phalanxFront */
type Pha = { x: number; r: number; v: number; hit: number; side: number };
let _pha: Pha[] | null = null;
const phalanx = () => (_pha ??= (() => {
  const out: Pha[] = [], ez = eleZ();
  for (let r = 0; r < 8; r++) for (let x = S.PHALANX.x0 + 1; x <= S.PHALANX.x1 - 1 + 1e-6; x += 2) {
    const xx = x + (hsh(r * 100 + x, 3) - 0.5) * 0.5, z = S.PHALANX.z0 + r * 2.2;
    const h = hitBy(xx, z, 2.5, 1, STAMP0, STAMP1, (i, st) => ez[i][st - STAMP0]);
    out.push({ x: xx, r, v: Math.floor(hsh(r * 31 + x, 5) * 12), hit: h.t, side: h.side });
  }
  return out;
})());
/** the last defenders across DEF_LINE (2 ranks): the elephant line hits them at ~F_SMASH */
type Def = { x: number; z: number; v: number; hit: number; side: number; flung: boolean };
const DEFS: Def[] = (() => {
  const out: Def[] = [];
  for (let r = 0; r < 2; r++) for (let x = S.DEF_LINE.x0 + 0.5; x <= S.DEF_LINE.x1 - 0.5 + 1e-6; x += 1.15) {
    const xx = x + (r ? 0.55 : 0) + (S.hash(r * 50 + x, 7) - 0.5) * 0.3, z = S.DEF_LINE.z - r * 1.1;
    const h = hitBy(xx, z + 0.4, 2.6, -1, 380, 470, (i, st) => S.eleMegara(i, st).pos[2]);
    const flung = h.t < 470;
    out.push({ x: xx, z, v: Math.floor(S.hash(r * 13 + x, 9) * 12), hit: flung ? h.t : 432 + Math.floor(S.hash(x, 11) * 6), side: flung ? h.side : (S.hash(x, 12) < 0.5 ? -1 : 1), flung });
  }
  return out;
})();
/** the wall-top defenders: 3 spear throwers (SPEARS), archers (one per arrow release spot), spearmen filling the walkway */
type WallMan = { x: number; kind: "thrower" | "archer" | "guard"; f0: number; v: number };
const WALLMEN: WallMan[] = (() => {
  const out: WallMan[] = S.SPEARS.map((s, k) => ({ x: s.from[0], kind: "thrower" as const, f0: s.f0, v: k }));
  for (let k = 0; k < S.N_ARROW; k++) {
    const a = S.arrowShot(k), x = a.from[0];
    const near = out.find((m) => Math.abs(m.x - x) < 1.0);
    if (near) { if (near.kind === "archer") near.f0 = Math.min(near.f0, a.f0); continue; }
    out.push({ x, kind: "archer", f0: a.f0, v: k });
  }
  const towers = [-42, -9, 9, 42];
  for (let x = -40; x <= 40; x += 2.3) {
    if (towers.some((t) => Math.abs(x - t) < 3.8) || out.some((m) => Math.abs(m.x - x) < 1.1)) continue;
    out.push({ x, kind: "guard", f0: 0, v: Math.floor(S.hash(x, 19) * 12) });
  }
  return out;
})();
const WALL_Z = -1.3;

// Edessa: Romans along the wall top; the Persian pushers; the turret archers
const ED_ROMANS = (() => { const out: { x: number; v: number }[] = []; for (let x = -34; x <= 34; x += 2.6) if (Math.abs(x) > 5.4) out.push({ x, v: Math.floor(S.hash(x, 23) * 12) }); return out; })();
/** a rider point on an elephant: the contract transform + the drawn body bob */
const rideAt = (e: S.EleState, l: V3): V3 => { const w = S.eleLocalToWorld(e, l); return [w[0], w[1] + eleBob(e), w[2]]; };
const PUSH_X = [-1.3, -0.75, -0.2, 0.35, 0.9, 1.45];

/** every card + effect card for shot sid at film frame f (fractional) */
export const stage = (sid: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const Sh = S.SHOTS[sid - 1], st = S.storyF(sid, f), si = Math.floor(st + 1e-6);
  LNAME = Sh.light === "golden" ? "golden" : "day";
  if (cam.sun) SUN.copy(cam.sun).normalize();
  if (Sh.set === "megara") megara(sid, st, si, cam, out);
  else if (Sh.set === "stable") stable(st, cam, out);
  else if (Sh.set === "edessa") edessa(st, si, cam, out);
  squeals(sid, f, st, cam, out);
  return out;
};

// ================= the squeal rings (every SQUEALS entry + continuous small ones on the burning runners) =================
const squeals = (sid: number, f: number, st: number, cam: CamInfo, out: Stage) => {
  const set = S.SHOTS[sid - 1].set, pigs = S.pigsAt(sid, f);
  const mouth = (p: S.PigState): V3 => [p.pos[0] + Math.sin(p.yaw) * 0.85 * p.scale, p.pos[1] + 0.95 * p.scale, p.pos[2] + Math.cos(p.yaw) * 0.85 * p.scale];
  for (const s of S.SQUEALS) {
    if (s.set !== set) continue;
    const u = prog(st, s.st, 11), p = pigs[s.pig];
    if (u === null || !p || !p.vis) continue;
    const m = mouth(p), dist = Math.hypot(m[0] - cam.pos.x, m[1] - cam.pos.y, m[2] - cam.pos.z);
    const uq = q(u, 11), sz = Math.min(1.5 * Math.max(p.scale, 0.75), 0.3 * dist);   // capped by distance: never swamps a close face
    fx(out, `squeal|${uq}`, 300, 300, (pp) => squealFx(pp, uq), toward(cam, mouth(p), 0.25), sz, sz);
  }
  if (set === "megara" && st >= F_SHRIEK_RUN0 && st < 990) pigs.forEach((p, i) => {
    if (!p.vis || p.burn < 0.4 || p.gait !== "run") return;
    const per = 16, u = (((st + hsh(i, 61) * per) % per) / 10);   // a 10 f burst every 16 f
    if (u >= 1) return;
    const uq = q(u, 10);
    const m = mouth(p), dist = Math.hypot(m[0] - cam.pos.x, m[1] - cam.pos.y, m[2] - cam.pos.z), sz = Math.min(0.6, 0.14 * dist);
    fx(out, `squeal|${uq}`, 300, 300, (pp) => squealFx(pp, uq), toward(cam, m, 0.2), sz, sz);
  });
};
const F_SHRIEK_RUN0 = 780;

// ================= Megara =================
const megara = (sid: number, st: number, si: number, cam: CamInfo, out: Stage) => {
  const outside = sid <= 4 || sid === 7 || sid === 1;
  const E = Array.from({ length: S.N_ELE }, (_, i) => S.eleMegara(i, st));
  const panic = st >= S.F_FREEZE - 2;
  // ---- the wall-top defenders (outside shots, until the city shots) ----
  if (sid >= 2 && sid <= 4) for (const m of WALLMEN) {
    let o: PFig;
    const dismay = st >= 300;
    if (m.kind === "thrower") o = megarian(m.v, { arms: st < m.f0 - 6 ? "spear" : st < m.f0 ? "throwBack" : st < m.f0 + 14 ? "throw" : "down", mouth: dismay ? "open" : "flat", eyes: st >= 428 ? "ring" : "dot" });
    else if (m.kind === "archer") o = megarian(m.v, { hat: m.v % 3 ? "hair" : "greek", arms: st < m.f0 - 10 ? "bowIdle" : st < m.f0 ? "bowDraw" : st < m.f0 + 8 ? "bowLoose" : "bowIdle", mouth: st >= 372 ? "open" : "flat", eyes: st >= 428 ? "ring" : "dot" });
    else o = megarian(m.v, { arms: st >= 428 && m.v % 2 ? "up2" : "spear", mouth: st >= 428 ? "open" : "flat", eyes: st >= 428 ? "ring" : "dot", shield: m.v % 3 === 0 ? "#c8963a" : undefined });
    fig(cam, out, o, m.x, S.WALL_H, WALL_Z, { face: [0, 1] });
  }
  // ---- the last defenders across the road: hit by the line at ~F_SMASH, flung back toward the gate, lie + scramble ----
  if (sid >= 2 && sid <= 4) for (const d of DEFS) {
    const base = megarian(d.v, { arms: "spear", shield: "#c8963a" });
    if (st < d.hit) {
      const fear = st >= 400;
      fig(cam, out, { ...base, eyes: fear ? "ring" : "dot", mouth: fear ? "open" : "flat", step: fear && d.v % 3 === 0 ? 1 : 0 }, d.x, 0, d.z, { face: [0, 1], shadow: true });
      continue;
    }
    if (d.flung) {
      const tb = tumble(st, d.hit, [d.x, 1.0, d.z], [d.side * (0.05 + 0.04 * hsh(d.v, 3)), 0.3 + 0.08 * hsh(d.x, 4), -(0.17 + 0.07 * hsh(d.x, 5))], d.side * (0.3 + 0.15 * hsh(d.x, 6)));
      const o: PFig = { ...base, arms: "flail", shield: undefined, eyes: "ring", mouth: "open", step: 2 };
      if (!tb.landed) flungFig(cam, out, o, tb.p, tb.roll);
      else { const crawl = Math.max(0, st - d.hit - tb.tl - 10) * 0.03; fig(cam, out, { ...o, arms: "up" }, tb.p[0], 0, tb.p[2] - crawl, { roll: tb.roll, shadow: false }); }
      if (st - d.hit < 18) { const uq = q((st - d.hit) / 18, 18); fx(out, `dust|${uq}|${d.v % 3}`, 300, 300, (pp) => dustBurst(pp, uq, d.v % 3), [d.x, 0.9, d.z + 0.3], 2.4, 2.4, 0, true); }
    } else { // knocked over by the shock wave: a stagger back, a fall, then scramble away toward the gate
      const t = st - d.hit, fall = S.clamp01(t / 6), roll = d.side * 1.45 * fall * fall;
      const back = 0.7 * S.clamp01(t / 6) + Math.max(0, t - 22) * 0.06;
      if (t < 22) fig(cam, out, { ...base, arms: "flail", eyes: "ring", mouth: "open", shield: undefined }, d.x, 0, d.z - back, { roll, face: [0, 1] });
      else fig(cam, out, { ...base, arms: "flail", eyes: "ring", mouth: "open", shield: undefined, step: Math.floor(t / 4) % 2 ? 1 : 3 }, d.x + d.side * 0.4, 0, d.z - back, { face: [0, -1], shadow: true });
    }
  }
  // ---- the Macedonian phalanx (sarissas up) behind the line; the stampede ploughs through it from F_CRASH ----
  if (outside) {
    const front = S.phalanxFront(st), marching = st < 445;
    for (const s of phalanx()) {
      const z = front + s.r * 2.2;
      if (Math.abs(cam.pos.x - s.x) + Math.abs(cam.pos.z - z) > 160) continue;
      if (Math.hypot(cam.pos.x - s.x, cam.pos.z - z) < (sid === 1 ? 7 : 3.2) && st < s.hit) continue;   // lens clearance (the hook camera runs into the ranks)
      const step = marching ? (Math.floor((st + s.x * 1.7) / 7) % 2 ? 1 : 3) : 0;
      const scared = st >= 905 && st < s.hit;
      if (st < s.hit) {
        const o = macedon(s.v, { arms: "sarissa", step: scared && s.v % 2 ? 1 : step, eyes: scared ? "ring" : "dot", mouth: scared ? "open" : "flat" });
        fig(cam, out, o, s.x, 0, z, { face: [0, -1], scale: 2.4, s: 1 / 2.4, shadow: cam.pos.distanceTo(tmp.set(s.x, 0, z)) < 26 });
      } else {
        const z0 = S.PHALANX.z0 + s.r * 2.2;
        const tb = tumble(st, s.hit, [s.x, 1.0, z0], [s.side * (0.08 + 0.06 * hsh(s.v, 7)), 0.3 + 0.12 * hsh(s.x, 8), 0.18 + 0.08 * hsh(s.x, 9)], s.side * (0.3 + 0.2 * hsh(s.x, 10)));
        const o = macedon(s.v, { arms: "flail", eyes: "ring", mouth: "open", step: 2 });
        if (!tb.landed) flungFig(cam, out, o, tb.p, tb.roll); else fig(cam, out, o, tb.p[0], 0, tb.p[2], { roll: tb.roll });
      }
    }
  }
  // ---- riders: a mahout on every elephant's neck; two soldiers in each war tower (E3's tower is Antigonus') ----
  E.forEach((e, i) => {
    if (!e.vis) return;
    const seat = rideAt(e, S.MAHOUT_SEAT), scared = panic;
    const mh: PFig = { tunic: "#f4efe4", belt: "#e8902a", hat: "turban", hatCol: i % 2 ? "#f4efe4" : "#e8902a", crest: i % 2 ? "#e8902a" : "#f4efe4", sit: true,
      arms: scared ? (Math.floor(st / 5 + i) % 2 ? "up" : "flail") : "grip", eyes: scared ? "ring" : "dot", mouth: scared ? "open" : "flat" };
    const ef: [number, number] = [Math.sin(e.yaw), Math.cos(e.yaw)];
    fig(cam, out, mh, seat[0], seat[1] - (975 - 740) * SU, seat[2], { face: ef });
    if (e.howdah !== "tower") return;
    for (const sx of [-0.45, 0.45]) {
      const w = rideAt(e, [sx, S.HOWDAH_FLOOR[1], S.HOWDAH_FLOOR[2]]), v = i * 2 + (sx > 0 ? 1 : 0);
      const o = macedon(v, { cloak: undefined, arms: scared ? (Math.floor(st / 6 + v) % 2 ? "up" : "up2") : "spear", eyes: scared ? "ring" : "dot", mouth: scared ? "open" : "flat" });
      fig(cam, out, o, w[0], w[1], w[2], { face: ef });
    }
  });
  // ---- inside the city (shots 5-6): herders behind the herded pigs, pitch pourers on the queue's west side ----
  if (sid === 5 || sid === 6) {
    [3, 6].forEach((pi, k) => {
      const p = S.pigMegara(pi, st);
      if (p.gait === "run") return;
      const a = p.yaw, q0 = S.queuePos(pi);
      let pos: V3 = [p.pos[0] - Math.sin(a) * 1.15, 0, p.pos[2] - Math.cos(a) * 1.15];
      // once the pig stands in its queue slot the herder steps aside to the west of the queue (out of the lanes)
      let tArr = 516 + pi * 3; while (tArr < 700 && S.pigMegara(pi, tArr).gait !== "walk") tArr += 2; while (tArr < 700 && S.pigMegara(pi, tArr).gait === "walk") tArr += 2;
      const aside = S.clamp01((st - tArr) / 10);
      if (st > tArr) pos = S.lerp3([q0[0], 0, q0[2] + 1.15], [-3.4, 0, q0[2] + 0.6], aside);
      const walk = p.gait === "walk" || (aside > 0 && aside < 1);
      if (Math.hypot(cam.pos.x - pos[0], cam.pos.z - pos[2]) < 4) return;   // lens clearance
      fig(cam, out, townsman(k, { arms: "herd", step: walk ? (Math.floor(st / 5) % 2 ? 1 : 3) : 0, mouth: walk ? "open" : "flat" }), pos[0], 0, pos[2], { shadow: true, mirror: Math.sin(a) * cam.right.x + Math.cos(a) * cam.right.z < 0 });
    });
    const POUR_Z = [-9.8, -13.6, -17.4];
    POUR_Z.forEach((z, k) => {
      const pouring = st >= 572 + k * 6 && st < 634 + k * 2;
      fig(cam, out, townsman(k + 1, { arms: pouring ? "pour" : "grip", mouth: pouring && Math.floor(st / 9 + k) % 2 ? "open" : "flat" }), -2.45, 0, z, { shadow: true });
      if (pouring && Math.floor(st / 3 + k) % 4 !== 3) strip(out, cam, [-2.05, 1.35, z], [-1.05, 0.62, z + 0.15], "pitchstream", 512, 40, pitchStream, 0.07);
    });
  }
  // ================= effects =================
  // dust at the smash: each elephant's front as it ploughs into the defenders (F_SMASH ..)
  if (sid >= 3 && sid <= 4) E.forEach((e, i) => {
    const u = prog(st, S.F_SMASH + (i % 3) * 2, 20);
    if (u === null) return;
    const uq = q(u, 20), fp = S.eleLocalToWorld(e, [0, 0.9, 2.4]);
    fx(out, `dust|${uq}|${i % 3}`, 300, 300, (pp) => dustBurst(pp, uq, i % 3), fp, 4.0, 4.0, 0, true);
  });
  // spear bounces: a white tink at each contact
  if (sid === 3 || sid === 2) for (const s of S.SPEARS) {
    const u = prog(st, s.hit, 7);
    if (u === null) continue;
    const p = S.eleLocalToWorld(S.eleMegara(s.ele, s.hit), s.local), uq = q(u, 7);
    fx(out, `tink|${uq}`, 300, 300, (pp) => tinkFx(pp, uq), toward(cam, p, 0.3), 0.9, 0.9);
  }
  // the pitch: splats at every brush stroke on P0, drips off the brush
  if (sid === 5) for (const h of SMEAR_HITS) {
    const u = prog(st, h, 8);
    if (u === null) continue;
    const uq = q(u, 8);
    fx(out, `psplat|${uq}`, 300, 300, (pp) => pitchSplat(pp, uq), toward(cam, [SMEAR_PT[0], SMEAR_PT[1] + 0.08, SMEAR_PT[2] + (h % 2 ? 0.2 : -0.15)], 0.3), 0.55, 0.55);
  }
  if (sid === 5 && st >= 566 && st < 600) for (let k = 0; k < 2; k++) {
    const t = (st - 566 + k * 9) % 18, y = 0.62 - 0.004 * t * t;
    if (y > 0.05) fx(out, "pdrip", 300, 300, dripFx, toward(cam, [SMEAR_PT[0] + 0.2 - k * 0.35, y, SMEAR_PT[2] + 0.1], 0.35), 0.1, 0.1);
  }
  // the ignite: a fire whoosh at P0 (F_IGNITE) and down the queue, 1.6 f per pig
  if (sid === 5 || sid === 6) for (let i = 0; i < S.N_PIG; i++) {
    const t0 = S.F_IGNITE + i * 1.6, u = prog(st, t0, 9);
    if (u === null) continue;
    const p = S.queuePos(i), uq = q(u, 9), s = i === 0 ? 1.15 : 0.9;
    fx(out, `whoosh|${uq}`, 300, 300, (pp) => whooshFx(pp, uq), toward(cam, i === 0 ? IGNITE_PT : [p[0], 0.85, p[2]], 0.35), s, s);
  }
  // smoke wisps behind every burning pig
  if (sid >= 5) S.pigsAt(sid, sid === 1 ? (st - 812) / 0.42 : st).forEach((p, i) => {
    if (!p.vis || p.burn < 0.3) return;
    const ph = q(((st / 26 + hsh(i, 71)) % 1), 12), back = p.gait === "run" ? 0.9 : 0.1;
    fx(out, `smoke|${ph}`, 300, 300, (pp) => smokeFx(pp, ph), [p.pos[0] - Math.sin(p.yaw) * back, p.pos[1] + 1.35, p.pos[2] - Math.cos(p.yaw) * back], 1.3, 1.6, 0, true);
  });
  if (sid === 1) S.pigsAt(1, (st - 812) / 0.42).forEach((p, i) => {
    if (!p.vis || p.burn < 0.3) return;
    const ph = q(((st / 26 + hsh(i, 71)) % 1), 12);
    fx(out, `smoke|${ph}`, 300, 300, (pp) => smokeFx(pp, ph), [p.pos[0] - Math.sin(p.yaw) * 0.9, p.pos[1] + 1.35, p.pos[2] - Math.cos(p.yaw) * 0.9], 1.3, 1.6, 0, true);
  });
  // dust under the stampeding feet + the crash into the phalanx
  if (outside && st >= S.F_STAMPEDE && st < 1004) E.forEach((e, i) => {
    if (!e.vis) return;
    for (let k = 0; k < 2; k++) {
      const per = 14, t0 = Math.floor((st - S.F_STAMPEDE + i * 3) / per) * per + S.F_STAMPEDE - i * 3 - k * 7, u = prog(st, t0, per);
      if (u === null) continue;
      const uq = q(u, 14), seed = (i + k) % 3, back = S.eleLocalToWorld(e, [k ? 0.9 : -0.9, 0.7, -1.6 - 3 * u]);
      fx(out, `dust|${uq}|${seed}`, 300, 300, (pp) => dustBurst(pp, uq, seed), back, 2.6, 2.6, 0, true);
    }
    const u = prog(st, S.F_CRASH + (i % 3), 22);
    if (u !== null) { const uq = q(u, 22); fx(out, `dust|${uq}|${i % 3}`, 300, 300, (pp) => dustBurst(pp, uq, i % 3), S.eleLocalToWorld(e, [0, 1.2, 2.6]), 5.0, 5.0, 0, true); }
  });
  // Antigonus' white anger steam (from F_STAMPEDE + 6): puffs from both sides of his purple head on a 12 f cycle
  if (outside && st >= 890 && st < 1000) {
    const h = antHeadW(st);
    for (const sx of [-1, 1]) {
      const u = ((st - 890 + (sx > 0 ? 6 : 0)) % 12) / 12, uq = q(u, 12);
      const p: V3 = [h[0] + cam.right.x * sx * (0.45 + 0.25 * u), h[1] + 0.15 + 0.35 * u, h[2] + cam.right.z * sx * (0.45 + 0.25 * u)];
      fx(out, `steam|${uq}`, 300, 300, (pp) => steamPuff(pp, uq), toward(cam, p, 0.2), 0.55, 0.55);
    }
  }
  void si;
};

// ================= the stable: hay dust =================
const stable = (st: number, cam: CamInfo, out: Stage) => {
  // drifting hay motes low over the paddock (slow, deterministic)
  for (let k = 0; k < 9; k++) {
    const u = ((st / 80 + hsh(k, 81)) % 1), x = S.STABLE[0] - 6 + 12 * hsh(k, 82) + 1.2 * Math.sin(st / 40 + k), z = S.STABLE[2] - 3 + 10 * hsh(k, 83);
    const uq = q(u, 16);
    fx(out, `hay|${q(0.25 + 0.5 * u, 16)}`, 300, 300, (pp) => hayFx(pp, 0.25 + 0.5 * u), [x, 0.4 + 0.9 * u, z], 0.9, 0.9, 0, true);
    void uq;
  }
  // a puff where each piglet is set down, and at the trainers' feet while they walk
  for (const T of S.TRAINERS) {
    const u = prog(st, 1194, 16);
    if (u !== null) { const uq = q(u, 16); fx(out, `hay|${uq}`, 300, 300, (pp) => hayFx(pp, uq), toward(cam, [T.to[0], 0.25, T.to[2]], 0.2), 1.2, 1.2, 0, true); }
    if (st > S.CARRY[0] && st < S.CARRY[1]) {
      const t0 = S.CARRY[0] + Math.floor((st - S.CARRY[0]) / 10) * 10, uu = (st - t0) / 10, p = S.lerp3(T.from, T.to, S.linF(t0, S.CARRY[0], S.CARRY[1]));
      const uq = q(uu, 10); fx(out, `hay|${uq}`, 300, 300, (pp) => hayFx(pp, uq), [p[0], 0.2, p[2] + 0.45], 0.7, 0.7, 0, true);
    }
  }
};

// ================= Edessa =================
const edessa = (st: number, si: number, cam: CamInfo, out: Stage) => {
  const e = S.eleEdessa(st), ED = S.EDESSA;
  // Romans along the wall top: spears, then cheering at the run
  for (const r of ED_ROMANS) {
    const cheer = st >= 1620 + (r.v % 4) * 2, up = cheer && Math.floor((si - 1620) / 7 + r.v) % 2 === 0;
    const o = roman(r.v, { arms: cheer ? (up ? "up" : "up2") : st >= F_SQ ? "up2" : "spear", mouth: cheer || st >= F_SQ ? "open" : "flat", eyes: st >= F_SQ && !cheer ? "ring" : "dot",
      shield: r.v % 3 === 0 && !cheer ? "#c0302a" : undefined });
    fig(cam, out, o, ED[0] + r.x, S.ED_WALL_H, ED[2] - 0.9, { face: [0, 1] });
  }
  // Persian pushers leaning into EP's rump while it is pushed (1300-1404), then panting; they bolt at the squeal
  const rump = e.pos[2] + 2.55, faceMir = cam.right.z > 0;   // they face -z (the wall); drawn facing LEFT (sign checked on stills)
  PUSH_X.forEach((dx, k) => {
    const x = e.pos[0] + dx, z0 = rump + (k % 2) * 0.35;
    if (st < F_SQ + 4) {
      const pushing = st < 1408, ph = pushing ? Math.floor(((44 - (e.pos[2] - ED[2])) / 0.35) + k) : 0;
      out.places.push(card(cam, `push|${k % 6}|${pushing ? ph % 4 : 0}|${st >= F_SQ ? 1 : 0}`, "body", (p, light) => pusherDraw(p, k, pushing ? ph % 4 : 0, light, st >= F_SQ ? "open" : "flat"), x, 0, z0 + (pushing ? 0 : 0.6), 1, faceMir));
      blob(out, x, 0, z0, 1);
    } else { // run away south, arms up
      const t = st - F_SQ - 4, z = z0 + 0.6 + t * 0.16;
      fig(cam, out, persian(k, { arms: "flail", eyes: "ring", mouth: "open", step: Math.floor(t / 4) % 2 ? 1 : 3 }), x + (dx > 0 ? 1 : -1) * t * 0.03, 0, z, { face: [0, 1], shadow: true });
    }
  });
  // three archers on the siege turret: sweat + shock at the squeal, tumble off as EP rears (from 1580)
  [-0.6, 0, 0.6].forEach((lx, k) => {
    const T0 = 1580 + k * 2;
    const base = persian(k + 1, { arms: st >= F_SQ ? "flail" : k === 1 ? "bowDraw" : "bowIdle", eyes: st >= F_SQ ? "ring" : "dot", mouth: st >= F_SQ ? "open" : "flat", sweat: st >= F_SQ });
    if (st < T0) { const w = rideAt(e, [lx, S.TURRET_TOP[1], S.TURRET_TOP[2]]); fig(cam, out, base, w[0], w[1], w[2], { face: [0, -1] }); }
    else {
      const p0 = rideAt(S.eleEdessa(T0), [lx, S.TURRET_TOP[1] + 1.0, S.TURRET_TOP[2]]);
      const tb = tumble(st, T0, p0, [lx * 0.08 + (k - 1) * 0.04, 0.16, 0.13 + 0.03 * k], (k % 2 ? 1 : -1) * 0.28, 0.03);
      if (!tb.landed) flungFig(cam, out, base, tb.p, tb.roll); else fig(cam, out, base, tb.p[0], 0, tb.p[2], { roll: tb.roll });
    }
    if (st >= F_SQ && st < T0 + 14) { // the sweat drops fly off
      const w = rideAt(e, [lx + 0.35, S.TURRET_TOP[1] + 1.9, S.TURRET_TOP[2]]), u = ((st - F_SQ) % 8) / 8;
      fx(out, "sweat", 300, 300, sweatFx, toward(cam, [w[0] + 0.15 * u, w[1] + 0.1 * u, w[2]], 0.2), 0.3, 0.3);
    }
  });
  // the doused torch hisses: steam out of the Roman's bucket (1458-1480)
  for (let k = 0; k < 3; k++) {
    const u = prog(st, 1458 + k * 5, 16);
    if (u === null) continue;
    const uq = q(u, 16);
    fx(out, `steam|${uq}`, 300, 300, (pp) => steamPuff(pp, uq), toward(cam, [WATER_BKT[0], WATER_BKT[1] + 0.7 + 0.5 * u, WATER_BKT[2]], 0.3), 0.75, 0.75);
  }
  // dust as EP turns + bolts
  if (st >= S.F_RUN_ED - 2 && st < 1645) for (let k = 0; k < 2; k++) {
    const per = 12, t0 = Math.floor((st - S.F_RUN_ED + k * 6) / per) * per + S.F_RUN_ED - k * 6, u = prog(st, t0, per);
    if (u === null) continue;
    const uq = q(u, 12);
    fx(out, `dust|${uq}|${k}`, 300, 300, (pp) => dustBurst(pp, uq, k), S.eleLocalToWorld(e, [k ? 0.9 : -0.9, 0.7, -1.8 - 2 * u]), 3.0, 3.0, 0, true);
  }
};
const F_SQ = S.F_SQUEAL_ED;
