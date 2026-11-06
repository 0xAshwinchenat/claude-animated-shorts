// Kaifeng: the CARD cast (crowds > ~6 people, people > ~15 m away, effect cards: puffs, dust, splats, sparks, soot).
// the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by cardShade() (scene
// tint, bright floor, side gradient toward the sun, painted crescent in the drawing); standing ones get a soft
// multiply contact blob. Effects are unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink
// pass never outlines their quads. Three card boxes: "body" 600 x 1000 (ground y 975), "wide" 1000 x 500 (ground
// y 475), "square" 600 x 600 (ground y 575), all at SU metres per design unit.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxContact, fxShadow, fxRing, fxBurst, fxPuff, Outfit, Expr, FrontOpts, SideOpts, geomOf,
  folk, HUNTER, GATHERER, CHILD, CARVER, WORKER, FOREMAN, SCIENTIST, fan, VENDOR,
  gazelleDraw, gazelleCarcass, giraffeDraw, foxDraw, snakeDraw, scorpionDraw, vultureDraw, hawkDraw, slabDraw,
  qmarkDraw, growlDraw, chipsDraw, soilDraw, emberDraw, steamDraw, gustDraw, bubble2, soilBasket, trayDraw, stream, sparkle,
  MUM, DAD, KIDN, orc, builder, GEOLOGIST, PROFESSOR, LABTECH, COASTSCI, tourist, sheepDraw, cowDraw, gullDraw, potDraw, topHatDraw,
  flyDraw, stinkDraw, sandSpray, smokeDraw, drenchDraw, dripDraw, takeLines, fishFx, heldArt, Held,
} from "./toon";
import { FPS, G, SHOTS, V3, smooth, clamp01, camStatic, at, camAt, pathOf, PROJ, HERO_TB, HERO_FIRES, beamK, battFires, battTreb, BATTERIES, BATT_N,
  outerX, WALL_H, F_SMASH, BOOM_F, TENTS, F_PUNCH, PILLOW } from "./story";
import { mongolFig, jinFig, footDraw, bannerDraw, riderDraw, pullerDraw, PULL_HAND, dustBurst, splinterFx, splatFx, strawFx, sparkFx, fuseFx, sootFx, wispFx, featherFx } from "./toon";
import { bombAt, BOMB_TIP, battShots, AMMO_AT } from "./story";
import { DUNG_POST, MILL_TOP, SUB_POKE_STAND, sootyAt, WINCH } from "./chars";
import { NOINK } from "./ink";
import { LIGHTS } from "./lights";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

/** TEMP (char sandbox stills only): hide the stub's H1 south wall to judge interior poses. Must be false when merged. */
const DEBUG_CUT_SOUTH = false;

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
    if (DEBUG_CUT_SOUTH) parent.traverse((o) => { if ((o as THREE.Mesh).isMesh && Math.abs(o.position.x) < 0.01 && Math.abs(o.position.z + 3.6) < 0.01 && Math.abs(o.position.y - 1.2) < 0.01) o.visible = false; });
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

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: canvas scale k from the design units; sized for the 1440 x 2560 final */
const tierK = (d: number) => (d < 3.2 ? 3.0 : d < 6.5 ? 1.8 : d < 16 ? 0.8 : 0.4);

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** the scene sun exactly as world.ts shotSun() builds it (camera-relative, frozen per camera path): computed here so the
 *  very first frame of a render (before any card registered its root) already has the right light */
const _sunP = new Map<number, THREE.Vector3>();
const sunFor = (sid: number) => {
  const path = pathOf(sid);
  let v = _sunP.get(path);
  if (v) return v;
  let fx = 0, fz = 0;
  for (const sh of SHOTS) if (pathOf(sh.id) === path) for (let f = sh.a; f < sh.b; f += 3) {
    const c = camAt(sh.id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
    fx += x / n; fz += z / n;
  }
  const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
  const L = LIGHTS[SHOTS[sid - 1].light], az = (L.az * Math.PI) / 180, el = (L.el * Math.PI) / 180;
  const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
  v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
  _sunP.set(path, v);
  return v;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks ----------------
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const who = (i: number, o: Outfit, okey: string): Who => ({ i, o, okey });
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, w: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale, k = tierK(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(w.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${w.okey}|${fkey(s2)}` : `F|${w.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, w.o, s2) : bodyFront(p, w.o, f2)), size: [600 * k, 1000 * k, k], geo: "body" };
};
/** any lit drawing in one of the three boxes; `draw` gets the light angle */
const card = (cam: CamInfo, key: string, box: BoxName, draw: (p: Pen, light: number) => void, x: number, y: number, z: number, scale = 1, mirror = false, roll = 0): Place => {
  const B = BOX[box], d = cam.pos.distanceTo(tmp.set(x, y + (B.h / 2) * SU * scale, z)) / scale, k = tierK(d);
  const light = light2D(cam, mirror);
  return { key: `${box}|${key}|${q(light, 4)}`, x, y, z, scale, mirror, roll, geo: box, draw: (p) => draw(p, light), size: [B.w * k, B.h * k, k] };
};
/** world point of design coords (bx, by) on a camera-facing card standing at (x, y, z) */
export const boxPt = (cam: CamInfo, box: BoxName, x: number, y: number, z: number, scale: number, bx: number, by: number, mirror = false): V3 => {
  const B = BOX[box], tx = cam.pos.x - x, tz = cam.pos.z - z, l = Math.hypot(tx, tz) || 1;
  const rx = tz / l, rz = -tx / l, s = SU * scale * (mirror ? -1 : 1);   // the card's +x axis (screen right)
  return [x + rx * (bx - B.w / 2) * s, y + (B.ground - by) * SU * scale, z + rz * (bx - B.w / 2) * s];
};
/** a lit card whose drawing centre (box centre) sits at world point c */
const centerCard = (cam: CamInfo, key: string, box: BoxName, draw: (p: Pen, light: number) => void, c: V3, scale: number) => {
  const B = BOX[box];
  return card(cam, key, box, draw, c[0], c[1] - (B.ground - B.h / 2) * SU * scale, c[2], scale);
};
/** a point nudged toward the camera by d metres (to stack a card in front of another) */
const toward = (cam: CamInfo, p: V3, d: number): V3 => {
  const v = tmp.set(cam.pos.x - p[0], cam.pos.y - p[1], cam.pos.z - p[2]).normalize();
  return [p[0] + v.x * d, p[1] + v.y * d, p[2] + v.z * d];
};

/** ground shadow under a standing card: a tight contact pool + (day) a soft tail away from the sun */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.12, 0.13, 0.24] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
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

export type Stage = { places: Place[]; fx: FxPlace[] };
const stand = (cam: CamInfo, out: Stage, w: Who, x: number, y: number, z: number, fo: FrontOpts, scale = 1, shadow = true, mirror = false) => {
  out.places.push({ ...person(cam, w, x, y, z, { side: false, mirror: false }, fo, {}, scale), mirror });
  if (shadow) blob(out, x, y, z, scale);
};
/** an unlit effect card centred at p, w x h metres */
const fx = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, p: V3, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x: p[0], y: p[1], z: p[2], w, h, rot, soft });
const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3();
/** a camera-facing strip card from a to b (rope, hook rod, stream) */
const strip = (out: Stage, cam: CamInfo, a: V3, b: V3, key: string, cw: number, ch: number, draw: (p: Pen) => void, thick: number, soft = false, vertical = false) => {
  _a.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).sub(cam.pos).normalize();
  _up.crossVectors(cam.right, _a).normalize();
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const dx = _d.dot(cam.right), dy = _d.dot(_up), len = Math.hypot(dx, dy);
  if (vertical) out.fx.push({ key, cw, ch, draw, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, w: thick, h: len, rot: Math.atan2(dy, dx) + Math.PI / 2, soft });
  else out.fx.push({ key, cw, ch, draw, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, w: len, h: thick, rot: Math.atan2(dy, dx), soft });
};
const sparkles = (out: Stage, t: number, t0: number, pts: V3[], s = 0.25) => pts.forEach((p, i) => {
  const u = clamp01((t - t0 - i * 0.07) / 0.6);
  if (u > 0 && u < 1) fx(out, `spark${q(u, 15)}`, 300, 300, (pp) => sparkle(pp, q(u, 15)), p, s, s);
});

// ================= the cast (Gobekli helpers kept for reuse) =================
const FW: Who[] = Array.from({ length: 30 }, (_, v) => who(100 + v, folk(v), `f${v}`));
const PACKC = ["#8a6a3c", "#a9824a", "#7a5a3a", "#9b8664", "#b08350"];
const FWP: Who[] = Array.from({ length: 16 }, (_, v) => who(160 + v, { ...folk(v + 3), pack: PACKC[v % 5] }, `fp${v}`));
const FANW: Who[] = Array.from({ length: 16 }, (_, v) => who(200 + v, fan(v), `fan${v}`));
const WHW = who(9, { ...GATHERER, cargo: "#e8c050" }, "gathw"), WF1 = who(130, { ...folk(1), cargo: "#e8c050" }, "f1w"), SEEDW: Who[] = [0, 1, 2, 3].map((r) => who(140 + r, { ...folk((r * 5 + 2) % 30), cargo: "#d6c27a" }, `seed${r}`));
const HW = who(1, HUNTER, "hunter"), GW = who(2, GATHERER, "gath"), KW = who(3, CHILD, "child"), CW = who(4, CARVER, "carver");
const WKW = who(5, WORKER, "worker"), FMW = who(6, FOREMAN, "foreman"), SW = who(7, SCIENTIST, "sci"), VW = who(8, VENDOR, "vendor");

const nrmz = (x: number, z: number): [number, number] => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
const ramp = (t: number, a: number, d = 0.3) => smooth((t - a) / d);
const flip = (cam: CamInfo, dx: number, dz: number) => dx * cam.right.x + dz * cam.right.z < 0;
const GRAD = (a: number) => (a * Math.PI) / 180;
/** the shot-start camera of shot sid (fixed layout frame): returns a point moved `a` m to screen-right and `d` m toward the camera */
const _cs = new Map<number, { pos: V3; rx: number; rz: number }>();
const anch = (sid: number, p: V3, a: number, d = 0): V3 => {
  let c = _cs.get(sid);
  if (!c) {
    const k = camStatic(sid, SHOTS[sid - 1].a), [fx, fz] = nrmz(k.look[0] - k.pos[0], k.look[2] - k.pos[2]);
    c = { pos: k.pos, rx: -fz, rz: fx }; _cs.set(sid, c);
  }
  const [tx, tz] = nrmz(c.pos[0] - p[0], c.pos[2] - p[2]);
  return [p[0] + c.rx * a + tx * d, p[1], p[2] + c.rz * a + tz * d];
};
const ts = (sid: number) => SHOTS[sid - 1].a / FPS;

const walker = (cam: CamInfo, out: Stage, w: Who, x: number, y: number, z: number, dx: number, dz: number, phase: number, expr: Expr, t: number,
  extra: Partial<FrontOpts> = {}, sextra: Partial<SideOpts> = {}, scale = 1, shadow = true) => {
  const [ux, uz] = nrmz(dx, dz);
  const view = viewOf(cam, x, z, ux, uz);
  const tl = Math.hypot(cam.pos.x - x, cam.pos.z - z) || 1, c = ((cam.pos.x - x) * ux + (cam.pos.z - z) * uz) / tl;
  const back = c < -0.62, bl = lidAt(t, w.i);
  const fo: FrontOpts = { mode: "stroll", phase, expr, blink: bl, back, ...extra };
  const so: SideOpts = { mode: "march", phase, expr, stomp: 0.6, stride: view.fs, blink: bl, ...sextra };
  out.places.push(person(cam, w, x, y, z, back ? { side: false, mirror: false } : view, fo, so, scale));
  if (shadow) blob(out, x, y, z, scale);
};
const ropeDraw = (p: Pen) => { p.stroke([[0, 20], [1000, 20]], 12, "#cdb88a"); p.stroke([[0, 14], [1000, 14]], 3, "#e8d8b0"); };
const WHEAT_GOLD = "#e8b440";
/** a lit animal / prop card with optional scale ramp (never a pop) */
const prop = (cam: CamInfo, out: Stage, key: string, box: BoxName, draw: (p: Pen, light: number) => void, x: number, y: number, z: number, scale: number, mirror = false, shadow = 0) => {
  if (scale < 0.02) return;
  out.places.push(card(cam, key, box, draw, x, y, z, scale, mirror));
  if (shadow) blob(out, x, y, z, shadow * scale);
};
/** hammer cycle: k 1 -> 0 slowly (wind-up), quick strike 0 -> 1, rest. Returns [k, impact 0..1 since the strike] */
const strike = (t: number, per: number, off: number): [number, number] => {
  const n = (t - off) / per, u = n - Math.floor(n);
  const k = u < 0.55 ? 1 - smooth(u / 0.55) : u < 0.67 ? smooth((u - 0.55) / 0.12) : 1;
  return [q(k, 60), u >= 0.67 ? (u - 0.67) / (0.33) * (0.33 * per) : -1];
};
const chips = (out: Stage, cam: CamInfo, imp: number, p: V3, s = 0.8) => {
  if (imp < 0 || imp > 0.4) return;
  const u = q(imp / 0.4, 24);
  fx(out, `chips${u}`, 300, 300, (pp) => chipsDraw(pp, u), toward(cam, p, 0.15), s, s, 0, true);
};
const puffAt = (out: Stage, cam: CamInfo, t: number, t0: number, p: V3, s = 1.0) => {
  const u = (t - t0) / 0.5;
  if (u <= 0 || u >= 1) return;
  const uq = q(u, 24);
  fx(out, `puff${uq}`, 300, 300, (pp) => fxPuff(pp, uq), toward(cam, p, 0.1), s, s, 0, true);
};
const thoughtQ = (cam: CamInfo, out: Stage, t: number, t0: number, p: V3, s = 0.55) => { // question mark that grows, floats, stays
  const g = ramp(t, t0, 0.3);
  if (g <= 0) return;
  const u = q(g, 20);
  fx(out, `qm${u}`, 300, 300, (pp) => qmarkDraw(pp, u), [p[0], p[1] + 0.06 * Math.sin((t - t0) * 2.4) * g, p[2]], s * (0.3 + 0.7 * g), s * (0.3 + 0.7 * g));
};

// ---- gazelles ----
const gaz = (cam: CamInfo, out: Stage, x: number, y: number, z: number, dx: number, dz: number, ph: number, head: number, scale = 1) => {
  const mir = flip(cam, dx, dz);
  const phq = q(ph % 1, 30), hq = q(head, 6);
  prop(cam, out, `gaz${phq}|${hq}`, "wide", (p, light) => gazelleDraw(p, { phase: phq, light, head: hq }), x, y, z, scale, mir, 0.7);
};


// =====================================================================================================================
// ============================================== KAIFENG STAGING (char owner) ===========================================
// =====================================================================================================================
// ---- the Mongol army (ARMY area): formation blocks of horsemen + foot (spears), two banners per block, facing west ----
type Trooper = { x: number; z: number; k: 0 | 1 | 2; v: number; m: boolean };
const ARMY_PTS: Trooper[] = (() => {
  const out: Trooper[] = [];
  const BX = [124, 141, 158, 175], BZ = [-50, -27, -4, 19, 42, 62];
  BX.forEach((x0, i) => BZ.forEach((z0, j) => {
    const horse = (i + j) % 2 === 0, files = horse ? 7 : 10, sx = horse ? 3.0 : 2.0, sz = horse ? 2.4 : 1.6, n = i * 1000 + j * 100;
    for (let r = 0; r < 4; r++) for (let c = 0; c < files; c++) {
      const h = hh(n + r * 10 + c, 3);
      out.push({ x: x0 + r * sx + (h - 0.5) * 0.5, z: z0 + (c - (files - 1) / 2) * sz + (hh(n + r * 10 + c, 7) - 0.5) * 0.4, k: horse ? 1 : 0, v: Math.floor(h * 40), m: hh(n + c, 11) < 0.5 });
    }
    const w = (files * sz) / 2;
    out.push({ x: x0 - 1.6, z: z0 - w + 0.6, k: 2, v: i + j, m: false }, { x: x0 - 1.6, z: z0 + w - 0.6, k: 2, v: i + j + 1, m: false });
  }));
  return out;
})();
// ---- Jin defenders on the walkways (cards standing behind the parapet: heads + shoulders show), denser by the gate + NE ----
type Guard = { x: number; z: number; v: number; spear: boolean; east: boolean };
const GUARDS: Guard[] = (() => {
  const out: Guard[] = [], d = outerX(WALL_H) - 0.95, towers = [-48, -24, 24, 48];
  for (let i = 0; i < 4; i++) for (let a = -54; a <= 54; a += 2.1) {
    if (towers.some((t) => Math.abs(a - t) < 3.3)) continue;
    if (i === 0 && Math.abs(a) < 8.7) continue;                      // the gate tower
    const h = hh(i * 100 + Math.round(a * 10), 21);
    const keep = i === 0 ? (Math.abs(a) < 19 || a < -33 ? 1 : 0.5) : i === 1 ? (a > 30 ? 1 : 0.35) : 0.22;
    if (h > keep) continue;
    // 0 east (x = +d), 1 north (z = -d), 2 south (z = +d), 3 west (x = -d)
    const [x, z] = i === 0 ? [d, a] : i === 1 ? [a, -d] : i === 2 ? [a, d] : [-d, a];
    out.push({ x, z, v: Math.floor(hh(i * 7 + a, 5) * 12), spear: hh(i * 13 + a, 9) < 0.4, east: i === 0 });
  }
  return out;
})();
/** the battery swarm (story.battShots: the camp owner's boulders), flattened once */
const SWARM = Array.from({ length: 4 }, (_, b) => Array.from({ length: 100 }, (_, i) => battShots(b, i))).flat(2);
const qk = (k: number) => (k < 0.25 ? 0 : k < 0.75 ? 0.5 : 1);
/** where the short arm's rope tip of a trebuchet sits (pivot 6 m up, arm 2.6 m toward the target u): APPROXIMATION */
const ropeTip = (p: V3, ux: number, uz: number, k: number): V3 => { const a = GRAD(50 - 110 * k); return [p[0] + ux * 2.6 * Math.cos(a), 6 + 2.6 * Math.sin(a), p[2] + uz * 2.6 * Math.cos(a)]; };

/** a rope crew: n pullers in 2 columns on the target side (u) of a trebuchet at p; ropes when the camera is near */
const crew = (out: Stage, cam: CamInfo, p: V3, ux: number, uz: number, n: number, k: number, seed: number, ropes: boolean, clear?: (x: number, z: number) => boolean) => {
  const kq = qk(k), vx = -uz, vz = ux, mir = flip(cam, -ux, -uz) ? false : true;   // the drawing faces LEFT; mirror when facing -u reads to screen-right
  const tip = ropeTip(p, ux, uz, kq);
  const cols = Math.ceil(n / 2);
  for (let m = 0; m < n; m++) {
    const du = 3.0 + 1.25 * (m % 2) + 0.15 * hh(seed + m, 3), dv = (Math.floor(m / 2) - (cols - 1) / 2) * 0.95 + 0.25 * (m % 2);
    const x = p[0] + ux * du + vx * dv, z = p[2] + uz * du + vz * dv, v = (seed + m) % 40;
    if (clear && !clear(x, z)) continue;
    out.places.push(card(cam, `pull|${v % 8}|${kq}`, "body", (pp, light) => pullerDraw(pp, v % 8, kq, light), x, G, z, 0.95, mir));
    if (ropes) {
      const hd = PULL_HAND(kq), hp = boxPt(cam, "body", x, G, z, 0.95, hd[0], hd[1], mir);
      strip(out, cam, hp, tip, "rope", 512, 40, ropeDraw, 0.05);
    }
  }
};

/** every card + effect card for shot sid at story frame f (fractional) */
export const stage = (sid: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const S = SHOTS[sid - 1];
  LNAME = S.light === "golden" ? "golden" : S.light === "night" ? "night" : "day";
  findSun(cam, SUN);
  const fi = Math.floor(f + 1e-6), city = S.set === "kaifeng";
  const near = (x: number, z: number, r: number) => Math.hypot(cam.pos.x - x, cam.pos.z - z) < r;
  // ---------------- the army (set piece 303-500, the far plain in the hook and the ending) ----------------
  if (city && (sid <= 4 || sid === 18)) {
    const westMir = cam.right.x < 0;   // riders are drawn facing LEFT (west); mirror when west reads to screen-right
    for (const t of ARMY_PTS) {
      if (t.k === 1) out.places.push(card(cam, `rider|${t.v % 5}`, "body", (pp, light) => riderDraw(pp, t.v % 5, light), t.x, G, t.z, 1.35, westMir));
      else if (t.k === 2) out.places.push(card(cam, `banner|${t.v % 4}`, "body", (pp, light) => bannerDraw(pp, t.v % 4, light), t.x, G, t.z, 1.6));
      else { const v = t.v % 8; out.places.push(card(cam, `foot|${v}`, "body", (pp, light) => footDraw(pp, mongolFig(v, "spear"), light), t.x, G, t.z, 1, t.m)); }
      if (near(t.x, t.z, 26)) blob(out, t.x, G, t.z, t.k === 1 ? 1.6 : 1);
    }
  }
  // ---------------- rope crews: the hero trebuchet (18) + the front 3 rows of every battery ----------------
  if (city && sid <= 5) {
    // shot 5: keep pullers off the lens -> millstone line and clear of the 3D crewmen
    const cx = cam.pos.x, cz = cam.pos.z, mx = MILL_TOP[0] - cx, mz = MILL_TOP[2] - cz, ml = Math.hypot(mx, mz) || 1;
    const clear5 = (x: number, z: number) => {
      const t = ((x - cx) * mx + (z - cz) * mz) / (ml * ml), d = Math.abs((x - cx) * mz - (z - cz) * mx) / ml;
      if (t > -0.1 && t < 1.25 && d < 2.2) return false;
      return Math.hypot(x - MILL_TOP[0], z - MILL_TOP[2]) > 3.2 && Math.hypot(x - AMMO_AT[0], z - AMMO_AT[2]) > 2.4;
    };
    crew(out, cam, HERO_TB, -1, 0, 18, beamK(f, HERO_FIRES), 3, true);
    for (let b = 0; b < 4; b++) {
      const B = BATTERIES[b], fx0 = B.corner[0] - B.c[0], fz0 = B.corner[2] - B.c[2], fl = Math.hypot(fx0, fz0), ux = fx0 / fl, uz = fz0 / fl;
      for (let i = 0; i < 3 * BATT_N; i++) {
        const p = battTreb(b, i), r = Math.floor(i / BATT_N);
        crew(out, cam, p, ux, uz, r === 0 ? 6 : 4, beamK(f, battFires(b, i)), b * 400 + i * 7, near(p[0], p[2], 30), sid === 5 && b === 0 ? clear5 : undefined);
      }
    }
  }
  // ---------------- Jin defenders on the walls ----------------
  if (city && sid <= 13 && sid !== 12) {
    for (const g of GUARDS) {
      if (g.east && sid >= 7 && sid <= 10 && g.z > -53 && g.z < -17) continue;      // the 3D padders / loaders / winch
      if (g.east && sid === 11 && Math.abs(g.z) > 8.4 && Math.abs(g.z) < 12.9) continue; // the 3D cheering four
      const cheer = sid === 11 && g.east && Math.abs(g.z) < 22 && fi >= 1252 + (g.v % 4) * 2;
      const up = cheer && Math.floor((fi - 1252) / 8 + g.v) % 2 === 0;
      const o = jinFig(g.v, cheer ? (up ? "up" : "down") : g.spear ? "spear" : "down", cheer ? "open" : "flat");
      out.places.push(card(cam, `jin|${g.v % 4}|${o.arms}|${o.mouth}`, "body", (pp, light) => footDraw(pp, o, light), g.x, WALL_H, g.z, 1, g.v % 2 === 0));
    }
  }
  // ---------------- shot 18: a few Mongol soldiers wait behind Subutai outside the gate ----------------
  if (sid === 18) {
    const SOL: [number, number][] = [[64.6, -1.9], [65.4, 2.3], [66.6, -0.4], [67.4, 1.4], [68.2, -2.6], [68.9, 3.1]];
    SOL.forEach(([x, z], i) => { out.places.push(card(cam, `foot|${(i * 3) % 8}`, "body", (pp, light) => footDraw(pp, mongolFig((i * 3) % 8, "spear"), light), x, G, z, 1, i % 2 === 1)); blob(out, x, G, z); });
  }
  // ---------------- effects ----------------
  if (city) {
    // a dust burst at every projectile impact (splinters at the tower smash)
    PROJ.forEach((p, i) => {
      const u = (f - p.f1) / 22;
      if (u < 0 || u >= 1) return;
      const uq = q(u, 22), ground = p.to[1] < 1.2, pos: V3 = ground ? [p.to[0], p.to[1] + 0.9, p.to[2]] : [p.to[0] + 0.5, p.to[1], p.to[2]];
      const s = p.kind === "boulder" ? 3.2 : 4.2;
      fx(out, `dust|${uq}|${i % 3}`, 300, 300, (pp) => dustBurst(pp, uq, i % 3), toward(cam, pos, 0.4), s, s, 0, true);
      if (p.f1 === 782) fx(out, `splinter|${uq}`, 300, 300, (pp) => splinterFx(pp, uq), toward(cam, pos, 0.8), 4.5, 4.5);
    });
    // the battery swarm's impacts at each shot's `to` on its f1 (shots over the wall land in the city: a smaller ground puff)
    if (sid >= 3 && sid <= 6) for (const s of SWARM) {
      const u = (f - s.f1) / 20;
      if (u < 0 || u >= 1) continue;
      const uq = q(u, 20), k = (s.i + s.b) % 3, sz = s.over ? 2.2 : 3.4, xFace = Math.abs(s.to[0]) > Math.abs(s.to[2]);
      const pos: V3 = s.over ? [s.to[0], 0.8, s.to[2]] : [s.to[0] + (xFace ? Math.sign(s.to[0]) * 0.4 : 0), s.to[1], s.to[2] + (xFace ? 0 : Math.sign(s.to[2]) * 0.4)];
      fx(out, `dust|${uq}|${k}`, 300, 300, (pp) => dustBurst(pp, uq, k), pos, sz, sz, 0, true);
    }
    // the millstone smash: sparks + stone chips on F_SMASH
    if (sid === 5) {
      const u = (f - F_SMASH) / 12, u2 = (f - F_SMASH) / 18;
      if (u >= 0 && u < 1) { const uq = q(u, 12); fx(out, `spark|${uq}`, 300, 300, (pp) => sparkFx(pp, uq, 2), toward(cam, MILL_TOP, 0.5), 1.3, 1.3); }
      if (u2 >= 0 && u2 < 1) { const uq = q(u2, 18); fx(out, `chips|${uq}`, 300, 300, (pp) => chipsDraw(pp, uq), toward(cam, [MILL_TOP[0], MILL_TOP[1] + 0.3, MILL_TOP[2]], 0.4), 1.8, 1.8, 0, true); }
    }
    // the tower padding: dung splats on each slap, straw bits at the drop
    if (sid === 7) {
      for (const c of [835, 840, 846]) { const u = (f - c) / 6; if (u >= 0 && u < 1) { const uq = q(u, 6); fx(out, `splat|${uq}`, 300, 300, (pp) => splatFx(pp, uq), toward(cam, DUNG_POST, 0.12), 0.55, 0.55); } }
      const u = (f - 860) / 12;
      if (u >= 0 && u < 1) { const uq = q(u, 12); fx(out, `straw|${uq}`, 300, 300, (pp) => strawFx(pp, uq), toward(cam, [53.0, WALL_H + 0.5, -45.0], 0.3), 1.5, 1.5); }
    }
    // the bomb's fuse sputters on its way down; soot after BOOM_F; wisps over the sooty diggers
    if (sid === 9 || sid === 10) {
      // the winch man's chain: from his drum up to the boom tip (the boom + the chain down to the bomb are the wall owner's)
      if (f < BOOM_F) strip(out, cam, WINCH, BOMB_TIP, "chain", 512, 40, (pp) => { pp.stroke([[0, 20], [1000, 20]], 12, "#3a3640"); pp.stroke([[0, 15], [1000, 15]], 3, "#8a8690"); }, 0.045);
      if (f >= 1058 && f < BOOM_F) { const b = bombAt(f), n = fi % 4; fx(out, `fuse|${n}`, 300, 300, (pp) => fuseFx(pp, n), toward(cam, [b[0], b[1] + 0.48, b[2]], 0.2), 1.1, 1.1); }
      for (let k = 0; k < 3; k++) {
        const u = (f - BOOM_F - 2 - k * 4) / 34;
        if (u < 0 || u >= 1) continue;
        const uq = q(u, 34), T = TENTS[0].to, pos: V3 = [T[0] + (k - 1) * 1.1, 1.4 + 0.6 * k, T[2] + (k - 1) * 0.9];
        fx(out, `soot|${uq}|${k}`, 300, 300, (pp) => sootFx(pp, uq, k), pos, 3.6, 3.6, 0, true);
      }
      if (f >= BOOM_F + 3 && f < 1180) for (let j = 0; j < 2; j++) {
        const p = sootyAt(j, f), uq = q(((f - BOOM_F) / 24 + j * 0.5) % 1, 12);
        fx(out, `wisp|${uq}`, 300, 300, (pp) => wispFx(pp, uq), [p[0], 2.55, p[2]], 0.7, 0.7, 0, true);
      }
    }
    // shot 13: a question mark grows over Subutai's head as he scratches it
    if (sid === 13) thoughtQ(cam, out, f / FPS, 1428 / FPS, [SUB_POKE_STAND[0] + 0.25, 2.75, SUB_POKE_STAND[2]], 0.6);
  }
  // the lesson: feathers burst out of the pillow at F_PUNCH and drift down
  if (sid === 16 && f >= F_PUNCH) {
    const t = (f - F_PUNCH) / FPS;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4, v = 0.7 + 0.5 * hh(i, 4), up = 1.1 + 0.6 * hh(i, 6), tt = Math.min(t, 0.9);
      const x = PILLOW[0] + Math.cos(a) * v * tt * 0.6 + 0.04 * Math.sin(t * 5 + i), z = PILLOW[2] + Math.sin(a) * v * tt * 0.45;
      const y = PILLOW[1] + 0.1 + up * tt - 1.9 * tt * tt * 0.5 - Math.max(0, t - 0.9) * 0.12;
      if (y < PILLOW[1] - 0.05) continue;
      fx(out, "feather", 300, 300, featherFx, [x, y, z], 0.13, 0.13, i + t * (1.5 + i * 0.2));
    }
  }
  return out;
};
export { FPS, fxBurst, fxRing, WHEAT_GOLD, heldArt, stand, fx, strip, walker, prop, puffAt, card, person, who, anch, ts, G, at, camAt, pathOf, smooth };
