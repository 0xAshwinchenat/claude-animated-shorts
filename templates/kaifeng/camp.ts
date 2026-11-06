// CAMP RIG (owner: the "camp" agent): the Mongol side: 400 traction trebuchets in 4 batteries (beams swing on
// battFires / battShots), Subutai's hero trebuchet (beamK on HERO_FIRES), every projectile in flight (PROJ + the battery swarm),
// ammo piles, the millstone (whole -> 3 pieces at F_SMASH), the cowhide tents (tentK) + the explosion at BOOM_F,
// yurts, banners, horse lines.
//
// Traction trebuchet (砲), LOCAL frame: +X = toward the target, +Y up, pivot at (0, HERO_PIVOT_Y, 0), beam swings in
// the X-Y plane. Long arm angle a: A0 (rest: back / down, sling pouch on the ground under it) -> A1 (thrown: just past
// vertical). The pull-rope fan hangs from the short arm's rope bar to the crew's hands (y = YE) in front (+X).
// Battery trebuchets are the same model scaled by SB. Everything per frame is a pure function of (sid, f).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, Batch } from "./build";
import { twoTone } from "./shade";
import { NOINK } from "./ink";
import {
  SHOTS, V3, hash, smooth, clamp01, easeOut,
  HERO_TB, HERO_PIVOT_Y, HERO_LONG, HERO_SHORT, HERO_FIRES, beamK, battFires, battShots, battTreb, BATTERIES, BATT_N, MILL_TREB,
  PROJ, Proj, projAt, outerX, HALF, MILL_AT, AMMO_AT, F_SMASH, TENTS, tentK, BOOM_F, ARMY, CAMP, SUB_AT,
} from "./story";
import * as PC from "./paintc";

// ---------------------------------------------------------------------------------------------- constants
const DEG = Math.PI / 180;
const HPY = HERO_PIVOT_Y, HL = HERO_LONG, HS = HERO_SHORT;
const A0 = 222 * DEG, A1 = 80 * DEG;   // long-arm angle at rest / thrown
const SLN = 2.2;                       // sling length (local units)
const RB = 0.5;                        // boulder radius in the sling (local units)
const YE = 0.95;                       // crew hand height: rope ends
const SB = 0.85;                       // battery trebuchet scale
const GRAV = 9.8 / 900;                // m / frame^2
const SWARM_R = 0.42;                  // battery boulder radius (world)
const NB = BATTERIES.length, NT = BATT_N * BATT_N;
/** the NE-battery trebuchet nearest the millstone: it is loaded with the two millstone thirds and throws them */
const MILL_P = PROJ.find((p) => p.kind === "mill")!;
/** Subutai's nine-tailed white standard, behind him (beyond his trebuchet) in the frame-0 view */
export const STANDARD_AT: V3 = [90.6, 0, 1.6];
const UPV = new THREE.Vector3(0, 1, 0), ZV = new THREE.Vector3(0, 0, 1), ONE = new THREE.Vector3(1, 1, 1);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** night fires of the mill trebuchet are replaced by the millstone throw (contract note in the camp report) */

// ---------------------------------------------------------------------------------------------- materials
const lamCache = new Map<string, THREE.MeshLambertMaterial>();
const lamC = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = lamCache.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); lamCache.set(key, m); }
  return m;
};
const MAT = {
  timber: () => lamC("cTimber", () => ({ map: PC.timberC() })),
  timberD: () => lamC("cTimberD", () => ({ map: PC.timberC("cTimberD", ["#8e5f36", "#86592f", "#946538"]) })),
  pole: () => lamC("cPole", () => ({ map: PC.poleC() })),
  iron: () => lamC("cIron", () => ({ color: "#4f525a" })),
  gold: () => lamC("cGold", () => ({ color: "#d6a843" })),
  rope: () => lamC("cRope", () => ({ map: PC.repC(PC.ropeC(), 1, 3) })),
  ropeB: () => lamC("cRopeB", () => ({ map: PC.repC(PC.ropeC("cRopeBlue", "#3b6fb0", "#1f3f73"), 8, 1) })),
  ropeR: () => lamC("cRopeR", () => ({ map: PC.repC(PC.ropeC("cRopeRed", "#c04a32", "#7a2618"), 8, 1) })),
  leather: () => lamC("cLeather", () => ({ map: PC.leatherC(), side: THREE.DoubleSide })),
  boulder: () => lamC("cBoulder", () => ({ map: PC.boulderC() })),
  hide: () => lamC("cHide", () => ({ map: PC.hideC(), side: THREE.DoubleSide })),
  felt: () => lamC("cFelt", () => ({ map: PC.repC(PC.feltC(), 3, 1) })),
  feltRoof: () => lamC("cFeltRoof", () => ({ map: PC.repC(PC.feltC("cFeltR", "#e6dcc6"), 3, 1), side: THREE.DoubleSide })),
  feltDust: () => lamC("cFeltDust", () => ({ color: "#b9a582" })),
  keyBand: () => lamC("cKeyBand", () => ({ map: PC.repC(PC.keyBandC(), 9, 1) })),
  crown: () => lamC("cCrown", () => ({ color: "#c8642e" })),
  soot: () => lamC("cSoot", () => ({ color: "#3a2c24" })),
  door: (s: number) => lamC("cDoor" + (s % 3), () => ({ map: PC.doorC("cDoor", s % 3) })),
  carpet: () => lamC("cCarpet", () => ({ map: PC.carpetC() })),
  hairW: () => lamC("cHairW", () => ({ map: PC.hairC("cHairW", "#f1ede2", "#c8c0ae", "#ffffff"), side: THREE.DoubleSide })),
  hairK: () => lamC("cHairK", () => ({ map: PC.hairC("cHairK", "#2b2420", "#120e0c", "#6a5a4c"), side: THREE.DoubleSide })),
  hairC: () => lamC("cHairC", () => ({ map: PC.hairC("cHairC", "#7a3e22", "#4a220f", "#b8703c"), side: THREE.DoubleSide })),
  pennT: () => lamC("cPennT", () => ({ map: PC.pennantC("cPennT", "#2a8a86", "#e4b84a"), side: THREE.DoubleSide })),
  pennB: () => lamC("cPennB", () => ({ map: PC.pennantC("cPennB", "#2f5f9f", "#e8d6a0"), side: THREE.DoubleSide })),
  banB: () => lamC("cBanB", () => ({ map: PC.warBannerC("cBanB", "#2f5f9f", "#e4b84a"), side: THREE.DoubleSide })),
  banT: () => lamC("cBanT", () => ({ map: PC.warBannerC("cBanT", "#23807c", "#e8d6a0"), side: THREE.DoubleSide })),
  scarf: () => lamC("cScarf", () => ({ color: "#3f86c8", side: THREE.DoubleSide })),
  wheel: () => lamC("cWheel", () => ({ map: PC.wheelC(), alphaTest: 0.5, side: THREE.DoubleSide })),
  hay: () => lamC("cHay", () => ({ map: PC.hayC() })),
  sack: () => lamC("cSack", () => ({ color: "#cdb38a" })),
  millTop: () => {
    let m = lamCache.get("cMillTop");
    if (!m) {
      const t = PC.millTopC().clone(); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / (2 * MILL_R), 1 / (2 * MILL_R)); t.offset.set(0.5, 0.5); t.needsUpdate = true;
      m = twoTone(new THREE.MeshLambertMaterial({ map: t })); lamCache.set("cMillTop", m);
    }
    return m;
  },
  millSide: () => lamC("cMillSide", () => ({ map: PC.repC(PC.millSideC(), 2, 1) })),
  stone: () => lamC("cStone", () => ({ color: "#8d8577" })),
  dirt: () => lamC("cDirt", () => ({ color: "#a98a5c" })),
  basket: () => lamC("cBasket", () => ({ map: PC.repC(PC.hayC(), 3, 1), color: "#c79a5a", side: THREE.DoubleSide })),
};
const basic = (c: [number, number, number], extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), ...extra });

// ---------------------------------------------------------------------------------------------- geometry helpers
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
/** maps a unit geometry (length 1 along y, centred) onto the segment a -> b, cross-section scaled sx, sz */
const segM = (a: THREE.Vector3, b: THREE.Vector3, sx = 1, sz = 1, out = new THREE.Matrix4()) => {
  _d.subVectors(b, a); const L = _d.length();
  _q.setFromUnitVectors(UPV, _d.divideScalar(Math.max(L, 1e-6)));
  return out.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(sx, L, sz));
};
const at4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(UPV, ry), V(sx, sy, sz));
const clean = (g: THREE.BufferGeometry) => {
  const x = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(x.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") x.deleteAttribute(k);
  if (!x.attributes.normal) x.computeVertexNormals();
  if (!x.attributes.uv) x.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  x.morphAttributes = {};
  return x;
};
/** geometry pieces collected per material, merged at the end */
class Parts {
  m = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
    const g = clean(geo); if (m) g.applyMatrix4(m);
    const l = this.m.get(mat); if (l) l.push(g); else this.m.set(mat, [g]);
  }
  merged() { return [...this.m].map(([mat, l]) => [mat, mergeGeometries(l, false)] as const); }
}
const UBOX = new THREE.BoxGeometry(1, 1, 1);
const ucyl = (rt: number, rb: number, seg: number) => new THREE.CylinderGeometry(rt, rb, 1, seg);
/** lumpy boulder of radius 1: displaced sphere, smooth normals */
const lumpy = (seed: number, ws: number, hs: number) => {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = 1 + 0.11 * Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 3.3 + seed * 0.7)
      + 0.06 * Math.sin(v.x * 5.3 + v.z * 4.1 + seed * 2.1) - 0.08 * Math.max(0, v.y * Math.cos(seed) + v.x * Math.sin(seed) - 0.55) * 2.5;
    p.setXYZ(i, v.x * n, v.y * n * 0.9, v.z * n);
  }
  g.computeVertexNormals();
  return g;
};
const axisOf = (s: number) => V(hash(s, 31) - 0.5, hash(s, 32) - 0.5 + 0.2, hash(s, 33) - 0.5).normalize();

// ---------------------------------------------------------------------------------------------- trebuchet model
const LB = [2.0, 1.45], LT = [0.34, 0.62], TOPY = HPY - 0.32;
const legPt = (y: number, sx: number, sz: number) => V(sx * (LB[0] + ((LT[0] - LB[0]) * y) / TOPY), y, sz * (LB[1] + ((LT[1] - LB[1]) * y) / TOPY));
/** static trestle: four legs (two A-frames), crossbars, bearing blocks, sills, ties, iron axle */
const buildFrame = (P: Parts, hi: boolean) => {
  const T = MAT.timber(), I = MAT.iron(), R = MAT.rope(), c = hi ? 1 : 1.6; // battery: chunkier timbers (read at 250 m)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(T, UBOX, segM(legPt(0, sx, sz), legPt(TOPY + 0.12, sx, sz), 0.27 * c, 0.27 * c));
  for (const sz of [-1, 1]) {
    for (const y of [1.25, 3.4]) P.add(T, UBOX, segM(legPt(y, -1, sz).add(V(-0.12, 0, 0)), legPt(y, 1, sz).add(V(0.12, 0, 0)), 0.2 * c, 0.2 * c));
    P.add(T, UBOX, segM(legPt(0.45, -1, sz), legPt(3.3, 1, sz), 0.15 * c, 0.15 * c));
    P.add(T, UBOX, at4(0, HPY - 0.2, sz * 0.62, 0, 1.05, 0.36, 0.36));                         // bearing block
    P.add(T, UBOX, segM(V(-2.7, 0.14, sz * 1.45), V(2.7, 0.14, sz * 1.45), 0.3 * c, 0.28 * c));          // ground sill
    if (hi) {
      P.add(I, UBOX, at4(0, HPY - 0.2, sz * 0.62, 0, 0.09, 0.4, 0.4)); // iron strap
      for (const x of [-0.42, 0.42]) P.add(I, UBOX, at4(x, HPY - 0.2, sz * 0.62, 0, 0.06, 0.4, 0.4));
      for (const y of [1.25, 3.4]) for (const sx of [-1, 1]) {
        const p = legPt(y, sx, sz);
        P.add(R, new THREE.TorusGeometry(0.2, 0.04, 6, 12), at4(p.x, p.y, p.z, Math.PI / 2 * sx));
      }
      for (const sx of [-1, 1]) P.add(T, UBOX, segM(V(sx * 2.9, -0.3, sz * 1.45), V(sx * 2.9, 0.35, sz * 1.45), 0.12, 0.12)); // stakes
    }
  }
  for (const sx of [-1, 1]) P.add(T, UBOX, segM(V(sx * 2.2, 0.16, -1.65), V(sx * 2.2, 0.16, 1.65), 0.22 * c, 0.22 * c));   // ties
  P.add(I, ucyl(0.1, 0.1, hi ? 14 : 8), segM(V(0, HPY, -0.9), V(0, HPY, 0.9)));                                      // axle
  for (const z of [-0.92, 0.92]) P.add(I, ucyl(0.16, 0.16, hi ? 14 : 8), segM(V(0, HPY, z - 0.05), V(0, HPY, z + 0.05)));
};
/** beam in beam space (pivot at the origin, long arm along +x): three lashed tapered poles, rope lashings, iron hub,
 *  the sling hook at the long end, the rope bar (along z) at the short end */
const buildBeam = (P: Parts, hi: boolean) => {
  const PO = MAT.pole(), R = MAT.rope(), I = MAT.iron(), T = MAT.timberD();
  const seg = hi ? 12 : 7, c = hi ? 1 : 1.4;
  for (const [z, y] of [[-0.1, -0.055], [0.1, -0.055], [0, 0.11]]) {
    P.add(PO, ucyl(0.055 * c, 0.125 * c, seg), segM(V(0, y * c, z * c), V(HL, y * 0.55 * c, z * 0.55 * c)));
    P.add(PO, ucyl(0.085 * c, 0.125 * c, seg), segM(V(0, y * c, z * c), V(-HS - 0.12, y * 0.85 * c, z * 0.85 * c)));
  }
  const rad = (x: number) => c * (x >= 0 ? 0.11 * (1 - 0.45 * (x / HL)) + 0.125 - 0.07 * (x / HL) : 0.11 * (1 - 0.15 * (-x / HS)) + 0.125 - 0.04 * (-x / HS)) + 0.012;
  const lash = hi ? [-HS + 0.3, -HS * 0.5, -0.42, 0.42, HL * 0.22, HL * 0.42, HL * 0.62, HL * 0.82, HL - 0.25] : [-HS + 0.3, -0.42, 0.42, HL * 0.35, HL * 0.7];
  for (const x of lash) for (const dx of hi ? [-0.05, 0.05] : [0]) P.add(R, new THREE.TorusGeometry(rad(x), hi ? 0.03 : 0.04, 5, hi ? 14 : 8).rotateY(Math.PI / 2), at4(x + dx, 0, 0));
  for (const x of [-0.3, 0.3]) P.add(I, new THREE.TorusGeometry(rad(0) + 0.02, 0.045, 6, hi ? 16 : 8).rotateY(Math.PI / 2), at4(x, 0, 0));
  P.add(I, ucyl(0.17, 0.17, hi ? 14 : 8), segM(V(0, 0, -0.32), V(0, 0, 0.32)));                                         // hub
  P.add(I, new THREE.SphereGeometry(0.085, 10, 8), at4(HL + 0.02, -0.02, 0));
  P.add(I, new THREE.TorusGeometry(0.1, 0.028, 6, 12), at4(HL + 0.12, -0.04, 0));                                      // sling hook
  P.add(T, ucyl(0.075, 0.075, hi ? 10 : 6), segM(V(-HS, 0, -0.6), V(-HS, 0, 0.6)));                                     // rope bar
  if (hi) for (const z of [-0.45, -0.15, 0.15, 0.45]) P.add(R, new THREE.TorusGeometry(0.095, 0.025, 5, 10), at4(-HS, 0, z));
};
const T0X = -HS * Math.cos(A0), T0Y = HPY - HS * Math.sin(A0);   // rope bar centre at rest (treb space)
/** pull-rope fan in treb space: tops on the rope bar at rest, ends at the crew's hands (y = YE) in front */
const ropeFan = (nr: number, nc: number, x0: number, dx: number, zs: number, seed: number) => {
  const P = new Parts(), R = MAT.rope();
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const u = nc > 1 ? c / (nc - 1) : 0.5, h1 = hash(seed + r * 17 + c, 3), h2 = hash(seed + r * 17 + c, 4);
    const top = V(T0X, T0Y, -0.5 + u);
    const end = V(x0 + r * dx + (h1 - 0.5) * dx * 0.5, YE + (h2 - 0.5) * 0.25, (-1 + 2 * u) * zs + (h2 - 0.5) * 0.25);
    P.add(R, UBOX, segM(top, end, 0.034, 0.034));
  }
  return P.merged()[0][1];
};
/** shear (treb space) that moves the rope tops from the rest bar to bar point (bx, by), keeping the ends (y = YE) */
const shearM = (bx: number, by: number, out: THREE.Matrix4) => {
  const k = 1 / (T0Y - YE), dx = (bx - T0X) * k, dy = (by - T0Y) * k;
  return out.set(1, dx, 0, -dx * YE, 0, 1 + dy, 0, -dy * YE, 0, 0, 1, 0, 0, 0, 0, 1);
};

/** sling + beam state at frame f (treb space): a = long-arm angle, (tx, ty) = sling hook, (qx, qy) = pouch centre */
type SL = { a: number; tx: number; ty: number; qx: number; qy: number };
const slingLocal = (f: number, fires: number[], o: SL) => {
  const k = beamK(f, fires), a = A0 + (A1 - A0) * k;
  const tx = (HL + 0.12) * Math.cos(a), ty = HPY + (HL + 0.12) * Math.sin(a);
  let r = -1e9;
  for (const x of fires) if (f >= x - 8 && x > r) r = x;
  const t = f - r;
  let th: number;
  if (r < -1e8 || t > 90) th = -Math.PI / 2;
  else if (t < 0) { // the sling trails the swing, then whips over the top
    const w = (t + 8) / 8, rho = w < 0.55 ? 116 + 14 * smooth(w / 0.55) : 130 - 175 * smooth((w - 0.55) / 0.45);
    th = a + rho * DEG;
  } else th = (-90 + 125 * Math.exp(-t / 3.5) * Math.cos(0.35 * t)) * DEG; // released: the empty sling flips over and swings down
  let qx = tx + SLN * Math.cos(th), qy = ty + SLN * Math.sin(th);
  if (qy < RB) { const dy = ty - RB; if (dy < SLN) qx = tx + Math.sqrt(SLN * SLN - dy * dy); qy = RB; } // lies on the ground
  o.a = a; o.tx = tx; o.ty = ty; o.qx = qx; o.qy = qy;
  return o;
};
/** is a boulder sitting in the sling? (reloaded 40 f after a release, or just before the next one) */
const loadedAt = (f: number, fires: number[]) => {
  let prev = -1e9, next = 1e9;
  for (const x of fires) { if (x <= f) prev = Math.max(prev, x); else next = Math.min(next, x); }
  return prev < -1e8 || f >= Math.min(prev + 40, next - 9);
};
const trebM = (p: V3, dx: number, dz: number, s: number) => {
  const n = Math.hypot(dx, dz) || 1;
  return new THREE.Matrix4().compose(V(p[0], p[1], p[2]), new THREE.Quaternion().setFromAxisAngle(UPV, Math.atan2(-dz / n, dx / n)), V(s, s, s));
};
const BOWL = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const _L = new THREE.Matrix4(), _W = new THREE.Matrix4(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _qq = new THREE.Quaternion(), _Z = new THREE.Matrix4().makeScale(0, 0, 0);
/** treb-space matrices for the sling cord (hook -> pouch rim, offset z), the pouch bowl and the boulder in it */
const slingMats = (S: SL, z: number, cord: THREE.Matrix4, bowl: THREE.Matrix4 | null, rock: THREE.Matrix4 | null, rockScale: number) => {
  _v1.set(S.tx - S.qx, S.ty - S.qy, 0).normalize();               // pouch -> hook
  segM(_v2.set(S.tx, S.ty, 0), V(S.qx + _v1.x * 0.12, S.qy + _v1.y * 0.12, z), 1, 1, cord);
  if (bowl) bowl.compose(V(S.qx - _v1.x * 0.12, S.qy - _v1.y * 0.12, 0), _qq.setFromUnitVectors(UPV, _v1), V(0.56, 0.34, 0.46));
  if (rock) rock.compose(V(S.qx, S.qy, 0), _qq.setFromAxisAngle(ZV, S.a * 0.3), V(rockScale, rockScale, rockScale));
};

// ---------------------------------------------------------------------------------------------- millstone
const MILL_R = 0.66, MILL_T = 0.24, MILL_EYE = 0.11;
/** whole millstone, and three broken thirds (each recentred; .c = its centre offset from the stone's centre) */
const millGeos = () => {
  const ext = (sh: THREE.Shape) => {
    const g = new THREE.ExtrudeGeometry(sh, { depth: MILL_T, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 36 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0.03, 0);
    return g;
  };
  const whole = new THREE.Shape(); whole.absarc(0, 0, MILL_R, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, MILL_EYE, 0, Math.PI * 2, true); whole.holes.push(hole);
  const wg = ext(whole);
  const pieces: { g: THREE.BufferGeometry; c: THREE.Vector3; dir: number }[] = [];
  for (let w = 0; w < 3; w++) {
    const a0 = (w * 120 + 8 + 6 * hash(w, 5)) * DEG, a1 = ((w + 1) * 120 + 8 + 6 * hash(w + 1, 5)) * DEG - 0.03;
    const sh = new THREE.Shape();
    // broken radial edges: zigzag from the eye to the rim
    const edge = (a: number, s: number, rev: boolean) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 4; i++) { const r = MILL_EYE + ((MILL_R - MILL_EYE) * i) / 4, j = i > 0 && i < 4 ? (hash(s * 7 + i, 9) - 0.5) * 0.12 : 0; pts.push([Math.cos(a + j) * r, Math.sin(a + j) * r]); }
      return rev ? pts.reverse() : pts;
    };
    const e0 = edge(a0, w, false), e1 = edge(a1, w + 1, true);
    sh.moveTo(e0[0][0], e0[0][1]);
    for (const [x, y] of e0.slice(1)) sh.lineTo(x, y);
    sh.absarc(0, 0, MILL_R, a0 + 0.001, a1 - 0.001, false);
    for (const [x, y] of e1.slice(1)) sh.lineTo(x, y);
    sh.absarc(0, 0, MILL_EYE, a1, a0, true);
    const g = ext(sh); g.computeBoundingBox();
    const c = new THREE.Vector3(); g.boundingBox!.getCenter(c); c.y = 0;
    g.translate(-c.x, 0, -c.z);
    pieces.push({ g, c, dir: Math.atan2(c.z, c.x) });
  }
  return { whole: wg, pieces };
};

// ---------------------------------------------------------------------------------------------- cowhide tent
const TL = 2.4, TW = 0.8, TSK = 0.35, TLIFT = 0.7;
/** half-barrel hide shell (u along x, v around the profile), hide sags between 5 ribs; rim at y = TLIFT */
const shellGeo = () => {
  const nu = 40, nv = 24, prof: [number, number][] = [];
  const arcN = nv - 4;
  prof.push([-TW, 0], [-TW, TSK * 0.5]);
  for (let i = 0; i <= arcN; i++) { const t = Math.PI - (i / arcN) * Math.PI; prof.push([Math.cos(t) * TW, TSK + Math.sin(t) * TW]); }
  prof.push([TW, TSK * 0.5], [TW, 0]);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], n = prof.length;
  let tot = 0; const sl = [0];
  for (let i = 1; i < n; i++) { tot += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); sl.push(tot); }
  for (let iu = 0; iu <= nu; iu++) {
    const u = iu / nu, x = -TL / 2 + u * TL, sag = 0.045 * Math.abs(Math.sin(u * Math.PI * 4));
    for (let iv = 0; iv < n; iv++) {
      const [z, y] = prof[iv], k = iv === 0 || iv === n - 1 ? 0 : 1, rl = Math.hypot(z, y - TSK * 0.6) || 1;
      pos.push(x, TLIFT + y - sag * k * ((y - TSK * 0.6) / rl), z - sag * k * (z / rl) * 0.5);
      uv.push(u, sl[iv] / tot);
    }
  }
  for (let iu = 0; iu < nu; iu++) for (let iv = 0; iv < n - 1; iv++) {
    const a = iu * n + iv, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // end caps (hide aprons) at both ends
  const sh = new THREE.Shape(); sh.moveTo(prof[0][0], prof[0][1]);
  for (const [z, y] of prof.slice(1)) sh.lineTo(z, y);
  const cap = new THREE.ShapeGeometry(sh, 8); const cuv = cap.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 0.3 + 0.5, cuv.getY(i) * 0.3 + 0.2);
  const parts = [clean(g)];
  for (const s of [-1, 1]) parts.push(clean(cap.clone().rotateY(s * Math.PI / 2).translate(s * (TL / 2 - 0.12), TLIFT, 0)));
  return mergeGeometries(parts, false);
};
const tentFrame = () => {
  const P = new Parts(), T = MAT.timber(), R = MAT.rope();
  for (const s of [-1, 1]) P.add(T, ucyl(0.045, 0.045, 7), segM(V(-TL / 2 - 0.35, TLIFT + 0.02, s * (TW + 0.03)), V(TL / 2 + 0.3, TLIFT + 0.02, s * (TW + 0.03))));
  for (const x of [-TL / 2 + 0.06, -0.3, 0.6, TL / 2 - 0.06]) { // ribs (outside the hide at the ends, bumps elsewhere)
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 8; i++) {
      const t = Math.PI - (i / 8) * Math.PI, p = V(x, TLIFT + TSK + Math.sin(t) * (TW + 0.03), Math.cos(t) * (TW + 0.03));
      if (prev) P.add(T, ucyl(0.035, 0.035, 6), segM(prev, p));
      prev = p;
    }
    for (const s of [-1, 1]) P.add(T, ucyl(0.035, 0.035, 6), segM(V(x, TLIFT, s * (TW + 0.03)), V(x, TLIFT + TSK, s * (TW + 0.03))));
  }
  for (const s of [-1, 1]) for (const x of [-TL / 2 - 0.3, TL / 2 + 0.25]) P.add(R, new THREE.TorusGeometry(0.06, 0.02, 5, 8).rotateY(Math.PI / 2), at4(x - 0.1 * Math.sign(x), TLIFT + 0.02, s * (TW + 0.03)));
  return P.merged();
};

// ---------------------------------------------------------------------------------------------- the rig
type Treb = { b: number; i: number; M: THREE.Matrix4; fires: number[] };
type Shot = { f0: number; f1: number; from: V3; to: V3; top: number; seed: number };
type Rub = { f: number; m: THREE.Matrix4 };
type PB = { p: Proj; meshes: THREE.Mesh[]; off: V3; seed: number };

export class CampRig {
  group = new THREE.Group();
  private S: SL = { a: 0, tx: 0, ty: 0, qx: 0, qy: 0 };
  // hero
  private heroM: THREE.Matrix4;
  private heroBeam = new THREE.Group();
  private heroRopes!: THREE.Mesh;
  private heroCords: THREE.Mesh[] = [];
  private heroBowl!: THREE.Mesh;
  private heroRock!: THREE.Mesh;
  private heroLoadFires: number[];
  // batteries
  private tb: Treb[] = [];
  private iBeam: THREE.InstancedMesh[] = [];
  private iRopes!: THREE.InstancedMesh; private iCord!: THREE.InstancedMesh; private iBowl!: THREE.InstancedMesh; private iLoad!: THREE.InstancedMesh;
  private iStack!: THREE.InstancedMesh; private iPeb!: THREE.InstancedMesh; private nStackDay = 0; private nStackNight = 0;
  private stackFull: THREE.Matrix4[] = []; private stackEmpty: THREE.Matrix4[] = []; private stackNE: boolean[] = [];
  private emptySpot = new THREE.Group();
  // projectiles
  private shots: Shot[] = [];
  private iSwarm!: THREE.InstancedMesh;
  private rubs: Rub[] = []; private iRub!: THREE.InstancedMesh;
  private pbs: PB[] = [];
  // millstone
  private millWhole!: THREE.Mesh; private wedges: THREE.Mesh[] = []; private wedgeInfo: { c: THREE.Vector3; dir: number }[] = [];
  private millOff: V3 = [0, 0, 0];
  // tents + boom
  private tents: THREE.Group[] = [];
  private fireball: THREE.Mesh[] = []; private fbCol: THREE.Color[] = [];
  private halo!: THREE.Sprite;
  private iSmoke!: THREE.InstancedMesh; private iShred!: THREE.InstancedMesh; private scorch!: THREE.Mesh;
  // fires
  private flames: { x: number; y: number; z: number; s: number }[] = [];
  private iFlameO!: THREE.InstancedMesh; private iFlameI!: THREE.InstancedMesh; private glows: THREE.Sprite[] = [];

  constructor(root: THREE.Group, _kit: Kit) {
    root.add(this.group);
    this.heroLoadFires = [...new Set([...HERO_FIRES, ...PROJ.filter((p) => this.isHero(p)).map((p) => p.f0)])].sort((a, b) => a - b);
    this.heroM = trebM(HERO_TB, -1, 0, 1);
    this.buildHero();
    this.buildBatteries();
    this.buildShots();
    this.buildProj();
    this.buildMill();
    this.buildTents();
    this.buildBoom();
    this.buildCamp();
  }

  private isHero(p: Proj) { return Math.abs(p.from[0] - (HERO_TB[0] - 4.5)) < 0.01 && Math.abs(p.from[2] - HERO_TB[2]) < 0.01; }
  /** world position of a trebuchet's pouch at frame f */
  private pouchW(M: THREE.Matrix4, fires: number[], f: number): V3 {
    slingLocal(f, fires, this.S);
    const v = V(this.S.qx, this.S.qy, 0).applyMatrix4(M);
    return [v.x, v.y, v.z];
  }

  // ---------------- hero trebuchet ----------------
  private buildHero() {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(this.heroM); this.group.add(g);
    const fp = new Parts(); buildFrame(fp, true);
    for (const [mat, geo] of fp.merged()) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); }
    const bp = new Parts(); buildBeam(bp, true);
    for (const [mat, geo] of bp.merged()) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; this.heroBeam.add(m); }
    this.heroBeam.matrixAutoUpdate = false; g.add(this.heroBeam);
    this.heroRopes = new THREE.Mesh(ropeFan(4, 8, 3.1, 1.15, 1.45, 11), MAT.rope());
    this.heroRopes.matrixAutoUpdate = false; this.heroRopes.castShadow = true; g.add(this.heroRopes);
    const cordG = ucyl(0.028, 0.028, 6);
    for (let k = 0; k < 2; k++) { const c = new THREE.Mesh(cordG, MAT.rope()); c.matrixAutoUpdate = false; c.castShadow = true; this.heroCords.push(c); g.add(c); }
    this.heroBowl = new THREE.Mesh(BOWL, MAT.leather()); this.heroBowl.matrixAutoUpdate = false; this.heroBowl.castShadow = true; g.add(this.heroBowl);
    this.heroRock = new THREE.Mesh(lumpy(3.3, 22, 16), MAT.boulder()); this.heroRock.matrixAutoUpdate = false; this.heroRock.castShadow = true; g.add(this.heroRock);
    // ammo pile beside it (north side) + a ground sledge of spare rope
    const b = new Batch(), rk = lumpy(1.7, 16, 12), R = MAT.boulder();
    const pile: [number, number, number, number][] = [[-0.55, 0.45, -0.4, 0.48], [0.45, 0.45, -0.45, 0.5], [-0.5, 0.45, 0.5, 0.47], [0.5, 0.44, 0.45, 0.46], [0, 1.18, 0, 0.47], [1.3, 0.42, 0.2, 0.44], [-1.3, 0.4, 0, 0.42]];
    pile.forEach(([x, y, z, r], k) => b.add(rk, R, new THREE.Matrix4().compose(V(x - 1.0, y, z + 2.9).applyMatrix4(this.heroM), new THREE.Quaternion().setFromAxisAngle(axisOf(k), k * 1.7), V(r, r, r))));
    b.build(this.group);
  }

  // ---------------- batteries ----------------
  private buildBatteries() {
    for (let b = 0; b < NB; b++) for (let i = 0; i < NT; i++) {
      const p = battTreb(b, i), C = BATTERIES[b].corner;
      this.tb.push({ b, i, M: trebM(p, C[0] - p[0], C[2] - p[2], SB), fires: battFires(b, i) });
    }
    const N = this.tb.length;
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, cast = true, stat = false) => {
      const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = cast; m.receiveShadow = true;
      m.instanceMatrix.setUsage(stat ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage); m.frustumCulled = false;
      this.group.add(m); return m;
    };
    const fp = new Parts(); buildFrame(fp, false);
    for (const [mat, geo] of fp.merged()) { const m = inst(geo, mat, N, true, true); this.tb.forEach((t, k) => m.setMatrixAt(k, t.M)); m.computeBoundingSphere(); m.frustumCulled = true; }
    const bp = new Parts(); buildBeam(bp, false);
    for (const [mat, geo] of bp.merged()) this.iBeam.push(inst(geo, mat, N));
    this.iRopes = inst(ropeFan(3, 6, 2.3, 0.95, 1.05, 5), MAT.rope(), N);
    this.iCord = inst(ucyl(0.035, 0.035, 5), MAT.rope(), N);
    this.iBowl = inst(BOWL, MAT.leather(), N);
    this.iLoad = inst(lumpy(2.1, 14, 10), MAT.boulder(), N);
    // ammo stacks (6 rocks) + pebbles (4) beside each trebuchet, on its local +Z side (keeps the NE battery's south-east flank clear)
    const qa = new THREE.Quaternion();
    this.tb.forEach((t, k) => {
      const c = V(-0.7, 0, 2.6).applyMatrix4(t.M), s0 = k * 7.3;
      const rocks: [number, number, number, number][] = [[-0.43, 0.36, -0.4, 0.42], [0.42, 0.36, -0.42, 0.42], [-0.4, 0.36, 0.43, 0.41], [0.44, 0.35, 0.4, 0.4], [0, 0.98, -0.02, 0.41], [0.95, 0.33, 0.1, 0.37]];
      rocks.forEach(([x, y, z, r], j) => this.stackFull.push(new THREE.Matrix4().compose(V(c.x + x, y, c.z + z), qa.setFromAxisAngle(axisOf(s0 + j), s0 + j), V(r, r * (0.9 + 0.2 * hash(s0 + j, 2)), r))));
      for (let j = 0; j < 4; j++) {
        const a = hash(s0 + j, 6) * 6.28, d = 0.25 + 0.6 * hash(s0 + j, 7), r = 0.06 + 0.07 * hash(s0 + j, 8);
        this.stackEmpty.push(new THREE.Matrix4().compose(V(c.x + Math.cos(a) * d, r * 0.7, c.z + Math.sin(a) * d), qa.setFromAxisAngle(axisOf(s0 + j + 50), j), V(r, r * 0.8, r)));
      }
      this.stackNE.push(t.b === 0);
    });
    // full stacks: the other batteries first, the NE battery last (count trims it at night); pebbles: NE only
    const order = [...this.tb.keys()].sort((a, b) => Number(this.stackNE[a]) - Number(this.stackNE[b]));
    this.iStack = inst(lumpy(4.2, 10, 7), MAT.boulder(), N * 6, true, true);
    order.forEach((n, k) => { for (let j = 0; j < 6; j++) this.iStack.setMatrixAt(k * 6 + j, this.stackFull[n * 6 + j]); });
    this.nStackDay = N * 6; this.nStackNight = order.filter((n) => !this.stackNE[n]).length * 6;
    const ne = order.filter((n) => this.stackNE[n]);
    this.iPeb = inst(lumpy(4.9, 8, 6), MAT.boulder(), ne.length * 4, false, true);
    ne.forEach((n, k) => { for (let j = 0; j < 4; j++) this.iPeb.setMatrixAt(k * 4 + j, this.stackEmpty[n * 4 + j]); });
    // the empty ammo spot beside the millstone: a worn patch + an overturned basket (pebbles come from the stack slots)
    const ec = V(AMMO_AT[0], 0, AMMO_AT[2]);
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.04, 20), MAT.dirt()); patch.position.set(ec.x, 0.0, ec.z); patch.receiveShadow = true;
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 14, 1, true), MAT.basket());
    bk.position.set(ec.x + 0.9, 0.3, ec.z - 0.55); bk.rotation.set(0.2, 0.6, Math.PI / 2 - 0.12); bk.castShadow = true;
    this.emptySpot.add(patch, bk); this.group.add(this.emptySpot);
    const peb = lumpy(4.9, 8, 6);
    for (let j = 0; j < 6; j++) {
      const a = hash(j, 81) * 6.28, d = 0.2 + 0.85 * hash(j, 82), r = 0.06 + 0.08 * hash(j, 83), m = new THREE.Mesh(peb, MAT.boulder());
      m.position.set(ec.x + Math.cos(a) * d, r * 0.7, ec.z + Math.sin(a) * d); m.scale.set(r, r * 0.8, r); m.rotation.set(j, j * 2, 0); m.castShadow = true;
      this.emptySpot.add(m);
    }
  }
  /** world position of the empty ammo spot (the mill trebuchet's stack) */
  emptyAt(): V3 { return AMMO_AT; }

  // ---------------- battery swarm ----------------
  private buildShots() {
    for (const t of this.tb) {
      const C = BATTERIES[t.b].corner, sx = Math.sign(C[0]), sz = Math.sign(C[2]);
      // targets / impact frames / over-the-wall from the contract (story.ts battShots); the release point is this
      // trebuchet's own sling pouch at the release frame, the arc height is ours
      battShots(t.b, t.i).forEach((bs, k) => {
        const r = bs.f0, to = bs.to, f1 = bs.f1, over = bs.over;
        if (t.b === 0 && t.i === MILL_TREB && r === MILL_P.f0) return; // the millstone throw
        const seed = t.b * 1000 + t.i * 10 + k;
        const from = this.pouchW(t.M, t.fires, r);
        const ew = Math.abs(Math.abs(to[0]) - (outerX(to[1]) + 0.05)) < 1e-6; // hits the x-face (east / west wall)
        const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
        if (!over && hash(seed, 5) < 0.14) { // a few stay as rubble at the wall foot
          const out = HALF + SWARM_R + 0.2 + 0.9 * hash(seed, 6), rr = SWARM_R * (0.85 + 0.3 * hash(seed, 7));
          const pos = ew ? V(sx * out, rr * 0.85, to[2]) : V(to[0], rr * 0.85, sz * out);
          this.rubs.push({ f: f1, m: new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(axisOf(seed), seed), V(rr, rr, rr)) });
        }
        this.shots.push({ f0: r, f1, from, to, top: Math.max(from[1], to[1]) + (over ? 13 : 5) + 0.12 * dist, seed });
      });
    }
    this.rubs.sort((a, b) => a.f - b.f);
    this.iSwarm = new THREE.InstancedMesh(lumpy(5.5, 11, 8), MAT.boulder(), this.shots.length);
    this.iSwarm.castShadow = true; this.iSwarm.frustumCulled = false; this.iSwarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.iSwarm.count = 0;
    this.iRub = new THREE.InstancedMesh(lumpy(6.1, 12, 9), MAT.boulder(), Math.max(1, this.rubs.length));
    this.rubs.forEach((r, k) => this.iRub.setMatrixAt(k, r.m));
    this.iRub.castShadow = true; this.iRub.receiveShadow = true; this.iRub.frustumCulled = false; this.iRub.count = 0;
    this.group.add(this.iSwarm, this.iRub);
  }

  // ---------------- PROJ boulders ----------------
  private buildProj() {
    PROJ.forEach((p, k) => {
      if (p.kind !== "boulder") return;
      const m = new THREE.Mesh(lumpy(7 + k * 1.3, 20, 14), MAT.boulder()); m.castShadow = true; m.receiveShadow = true; m.visible = false; m.scale.setScalar(p.r);
      this.group.add(m);
      let off: V3 = [0, 0, 0];
      if (this.isHero(p) && HERO_FIRES.includes(p.f0)) { const q = this.pouchW(this.heroM, HERO_FIRES, p.f0); off = [q[0] - p.from[0], q[1] - p.from[1], q[2] - p.from[2]]; }
      this.pbs.push({ p, meshes: [m], off, seed: 100 + k });
    });
  }
  /** a boulder after a dent:true impact: stuck 2 f, drops down the battered face, rolls out a little, rests */
  private dropAt(to: V3, r: number, t: number, seed: number, side: number, pos: THREE.Vector3, q: THREE.Quaternion) {
    const ew = Math.abs(to[0]) >= Math.abs(to[2]), sg = Math.sign(ew ? to[0] : to[2]) || 1;
    const tf = Math.max(0, t - 2), T = Math.sqrt((2 * Math.max(0, to[1] - r)) / GRAV);
    const y = tf < T ? to[1] - 0.5 * GRAV * tf * tf : r;
    const roll = tf > T ? (0.6 + 0.6 * hash(seed, 9)) * (1 - Math.exp(-(tf - T) / 7)) : 0;
    const d = outerX(Math.max(0, y)) + r + 0.12 + 0.015 * Math.min(tf, T) + roll;
    const along = (ew ? to[2] : to[0]) + side;
    pos.set(ew ? sg * d : along, Math.max(r, y), ew ? along : sg * d);
    q.setFromAxisAngle(axisOf(seed), 0.12 * Math.min(tf, T) + roll / r + seed);
  }

  // ---------------- millstone ----------------
  private buildMill() {
    const { whole, pieces } = millGeos(), mats = [MAT.millTop(), MAT.millSide()];
    this.millWhole = new THREE.Mesh(whole, mats); this.millWhole.position.set(MILL_AT[0], 0, MILL_AT[2]); this.millWhole.castShadow = this.millWhole.receiveShadow = true;
    this.group.add(this.millWhole);
    for (const pc of pieces) {
      const m = new THREE.Mesh(pc.g, mats); m.castShadow = m.receiveShadow = true; m.visible = false; m.rotation.order = "YXZ";
      this.wedges.push(m); this.wedgeInfo.push({ c: pc.c, dir: pc.dir }); this.group.add(m);
    }
    const t = this.tb[MILL_TREB], q = this.pouchW(t.M, t.fires, MILL_P.f0);
    this.millOff = [q[0] - MILL_P.from[0], q[1] - MILL_P.from[1], q[2] - MILL_P.from[2]];
  }

  // ---------------- tents ----------------
  private buildTents() {
    const shell = shellGeo(), frame = tentFrame();
    for (let i = 0; i < TENTS.length; i++) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(shell, MAT.hide()); s.castShadow = s.receiveShadow = true; g.add(s);
      for (const [mat, geo] of frame) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
      this.tents.push(g); this.group.add(g);
    }
  }

  // ---------------- explosion ----------------
  private buildBoom() {
    const ball = new THREE.IcosahedronGeometry(1, 3);
    for (let k = 0; k < 7; k++) {
      const core = k < 2, col = new THREE.Color(...(core ? [2.6, 1.9, 0.45] : k < 4 ? [1.2, 0.3, 0.02] : [0.9, 0.16, 0.02]) as [number, number, number]);
      const m = new THREE.Mesh(ball, basic([1, 1, 1])); m.layers.set(NOINK); m.visible = false; m.renderOrder = 2;
      this.fireball.push(m); this.fbCol.push(col); this.group.add(m);
    }
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: PC.glowC(), color: new THREE.Color(0.7, 0.3, 0.05), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.halo.layers.set(NOINK); this.halo.visible = false; this.group.add(this.halo);
    const puff = new THREE.SphereGeometry(1, 18, 12);
    this.iSmoke = new THREE.InstancedMesh(puff, lamC("cSmoke", () => ({ color: "#ffffff" })), 40);
    const c = new THREE.Color(1, 1, 1);
    for (let k = 0; k < 40; k++) { this.iSmoke.setColorAt(k, c); this.iSmoke.setMatrixAt(k, _Z); }
    this.iSmoke.castShadow = true; this.iSmoke.frustumCulled = false; this.iSmoke.count = 0; this.group.add(this.iSmoke);
    const sh = new THREE.Shape(); // ragged hide scrap
    for (let a = 0; a < 9; a++) { const t = (a / 9) * Math.PI * 2, r = 0.22 + 0.14 * hash(a, 12); if (a) sh.lineTo(Math.cos(t) * r * 1.3, Math.sin(t) * r); else sh.moveTo(Math.cos(t) * r * 1.3, Math.sin(t) * r); }
    const sg = new THREE.ShapeGeometry(sh); const su = sg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < su.count; i++) su.setXY(i, su.getX(i) * 0.9 + 0.35, su.getY(i) * 1.4 + 0.45);
    this.iShred = new THREE.InstancedMesh(sg, MAT.hide(), 20);
    this.iShred.castShadow = true; this.iShred.frustumCulled = false; this.iShred.count = 0; this.group.add(this.iShred);
    this.scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: PC.scorchC(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    twoTone(this.scorch.material as THREE.MeshLambertMaterial);
    this.scorch.position.set(TENTS[0].to[0], 0.03, TENTS[0].to[2]); this.scorch.visible = false; this.scorch.layers.set(NOINK); this.scorch.receiveShadow = true;
    this.group.add(this.scorch);
  }

  // ---------------- the camp, the army's banners, Subutai's post ----------------
  private buildCamp() {
    const b = new Batch();
    // Subutai's command post: carpet, the nine-tailed white standard, two small tugs, a kettle drum
    b.add(UBOX, MAT.carpet(), at4(SUB_AT[0] - 0.2, 0.015, SUB_AT[2] + 0.1, 0, 3.2, 0.03, 2.2));
    this.nineTail(b, STANDARD_AT[0], STANDARD_AT[2]);
    b.add(ucyl(0.38, 0.32, 16), MAT.timberD(), at4(SUB_AT[0] + 1.4, 0.3, SUB_AT[2] - 1.9, 0, 1, 0.6, 1));
    b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), MAT.leather(), at4(SUB_AT[0] + 1.4, 0.61, SUB_AT[2] - 1.9));
    // army: tugs + war banners spaced along the ranks (ground props only; the crowd cards are the char owner's)
    let k = 0;
    for (let x = ARMY.x0 + 8; x < ARMY.x1 - 4; x += 15) for (let z = ARMY.z0 + 5; z < ARMY.z1 - 2; z += 13) {
      k++;
      if (hash(k, 21) < 0.28) continue;
      const px = x + (hash(k, 22) - 0.5) * 4, pz = z + (hash(k, 23) - 0.5) * 4, h = 5.2 + 1.4 * hash(k, 24);
      if (px < 130 && pz < -44) continue; // keep the NE battery's south-east flank (night camera) clear
      if (hash(k, 25) < 0.6) this.tug(b, px, pz, h, hash(k, 26) < 0.6 ? MAT.hairK() : MAT.hairC(), hash(k, 27) < 0.5 ? MAT.pennT() : MAT.pennB(), k);
      else this.warBanner(b, px, pz, h, hash(k, 28) < 0.6 ? MAT.banB() : MAT.banT());
    }
    // yurts in loose rows (doors to the south-west), a big ger, wagons in the gaps, fire pits between
    const big: V3 = [206, 0, 4];
    this.yurt(b, big[0], big[2], 9.2, 0.75 * Math.PI, 99, true);
    let s = 0;
    for (let cx = 0; cx < 6; cx++) for (let rz = 0; rz < 13; rz++) {
      s++;
      const x = CAMP.x0 + 7 + cx * 11 + (hash(s, 8) - 0.5) * 3.5, z = CAMP.z0 + 7 + rz * 11.5 + (hash(s, 9) - 0.5) * 3;
      if (Math.hypot(x - big[0], z - big[2]) < 10) continue;
      if (hash(s, 7) < 0.17) { this.wagon(b, x, z, hash(s, 11) * 6.28, s); continue; }
      this.yurt(b, x, z, 4.8 + 1.7 * hash(s, 10), 0.75 * Math.PI + (hash(s, 12) - 0.5) * 0.7, s, false);
      if (hash(s, 13) < 0.3) this.wagon(b, x + 4.2, z + 3.6, hash(s, 14) * 6.28, s + 500);
    }
    for (let a = 0; a < 3; a++) for (let c = 0; c < 4; c++) this.firePit(b, CAMP.x0 + 12.5 + a * 22, CAMP.z0 + 18 + c * 34.5, a * 4 + c);
    // horse lines: posts + picket rope along the camp's west edge and its north / south ends, hay piles
    const line = (x0: number, z0: number, x1: number, z1: number) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 6));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
        b.add(ucyl(0.07, 0.09, 7), MAT.timberD(), at4(x, 0.7, z, 0, 1, 1.4, 1));
        if (i < n) b.add(UBOX, MAT.rope(), segM(V(x, 1.18, z), V(x0 + ((x1 - x0) * (i + 1)) / n, 1.18, z0 + ((z1 - z0) * (i + 1)) / n), 0.04, 0.04));
        if (i % 3 === 1) b.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hay(), at4(x + 2.2, 0, z + 1.5, i, 1.0, 0.6, 0.8));
      }
    };
    line(CAMP.x0 + 1, CAMP.z0 + 8, CAMP.x0 + 1, CAMP.z1 - 8);
    line(CAMP.x0 + 8, CAMP.z0 + 1, CAMP.x1 - 6, CAMP.z0 + 1);
    line(CAMP.x0 + 8, CAMP.z1 - 1, CAMP.x1 - 6, CAMP.z1 - 1);
    // torches by the NE battery (night): in the lanes between columns
    for (const [u, v] of [[18, -18], [24.5, -12], [6, -24]]) {
      const B = BATTERIES[0], fx = B.corner[0] - B.c[0], fz = B.corner[2] - B.c[2], fl = Math.hypot(fx, fz), ux = fx / fl, uz = fz / fl;
      const x = B.c[0] + ux * u - uz * v, z = B.c[2] + uz * u + ux * v;
      b.add(ucyl(0.05, 0.065, 7), MAT.timberD(), at4(x, 1.3, z, 0, 1, 2.6, 1));
      b.add(new THREE.CylinderGeometry(0.2, 0.12, 0.3, 8, 1, true), MAT.iron(), at4(x, 2.7, z));
      this.flames.push({ x, y: 2.75, z, s: 0.55 });
    }
    b.build(this.group);
    // flames (HDR, no ink) + night glow sprites
    const fg = new THREE.ConeGeometry(0.3, 1, 9, 1, true).translate(0, 0.5, 0);
    this.iFlameO = new THREE.InstancedMesh(fg, basic([3.2, 1.3, 0.3], { side: THREE.DoubleSide }), this.flames.length * 3);
    this.iFlameI = new THREE.InstancedMesh(fg, basic([4.5, 3.2, 1.0], { side: THREE.DoubleSide }), this.flames.length * 2);
    for (const m of [this.iFlameO, this.iFlameI]) { m.layers.set(NOINK); m.frustumCulled = false; this.group.add(m); }
    for (const fl of this.flames) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: PC.glowC(), color: new THREE.Color(1.3, 0.62, 0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(fl.x, fl.y + 0.4, fl.z); sp.scale.setScalar(5.5 * fl.s / 0.8); sp.layers.set(NOINK); sp.visible = false;
      this.glows.push(sp); this.group.add(sp);
    }
  }
  private tug(b: Batch, x: number, z: number, h: number, hair: THREE.Material, pen: THREE.Material, s: number) {
    b.add(ucyl(0.045, 0.06, 8), MAT.timberD(), at4(x, h / 2, z, 0, 1, h, 1));
    b.add(new THREE.ConeGeometry(0.09, 0.5, 8), MAT.iron(), at4(x, h + 0.25, z));
    b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), MAT.gold(), at4(x, h - 0.02, z));
    // horse-hair tassel: shaggy open cone
    const tg = new THREE.CylinderGeometry(0.09, 0.24, 1.0, 16, 4, true), tp = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); if (y < -0.45) tp.setY(i, y - 0.3 * hash((i % 17) + s, 13)); else if (y < 0.2) { const k = 1 + 0.18 * Math.sin(i * 2.7); tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } }
    tg.computeVertexNormals();
    b.add(tg, hair, at4(x, h - 0.62, z, s));
    // pennant streaming north (-z), below the tassel
    const pg = new THREE.PlaneGeometry(1.5, 0.62, 12, 2), pp = pg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const u = (pp.getX(i) + 0.75) / 1.5; pp.setY(i, pp.getY(i) * (1 - 0.8 * u) - 0.12 * u * u); pp.setZ(i, 0.07 * Math.sin(u * 9 + s)); }
    pg.translate(0.75, 0, 0); pg.computeVertexNormals();
    b.add(pg, pen, at4(x, h - 1.65, z, Math.PI / 2));
  }
  private warBanner(b: Batch, x: number, z: number, h: number, cloth: THREE.Material) {
    b.add(ucyl(0.05, 0.065, 8), MAT.timberD(), at4(x, h / 2, z, 0, 1, h, 1));
    b.add(new THREE.ConeGeometry(0.1, 0.45, 8), MAT.gold(), at4(x, h + 0.22, z));
    b.add(ucyl(0.035, 0.035, 6), MAT.timberD(), segM(V(x, h - 0.25, z - 0.65), V(x, h - 0.25, z + 0.65)));
    const g = new THREE.PlaneGeometry(1.15, 2.2, 10, 12).translate(0, -1.1, 0), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const X = p.getX(i), t = -p.getY(i) / 2.2; p.setY(i, p.getY(i) + 0.4 * (1 - Math.abs(X) / 0.575) * t * t); p.setZ(i, (0.03 + 0.06 * t) * Math.sin((X / 0.29) * Math.PI)); }
    g.computeVertexNormals();
    b.add(g, cloth, at4(x - 0.07, h - 0.28, z, -Math.PI / 2));
  }
  /** Subutai's standard: a tall pole, gold spear, a ring with nine white horse-hair tails, a blue scarf */
  private nineTail(b: Batch, x: number, z: number) {
    const H = 7.4;
    b.add(ucyl(0.07, 0.09, 10), MAT.timberD(), at4(x, H / 2, z, 0, 1, H, 1));
    b.add(new THREE.ConeGeometry(0.16, 0.8, 10), MAT.gold(), at4(x, H + 0.4, z));
    b.add(new THREE.SphereGeometry(0.15, 12, 8), MAT.gold(), at4(x, H, z));
    b.add(new THREE.TorusGeometry(0.62, 0.05, 6, 24).rotateX(Math.PI / 2), MAT.gold(), at4(x, H - 0.35, z));
    for (let k = 0; k < 4; k++) b.add(ucyl(0.025, 0.025, 5), MAT.gold(), segM(V(x, H - 0.1, z), V(x + Math.cos(k * 1.57) * 0.62, H - 0.35, z + Math.sin(k * 1.57) * 0.62)));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, r = k === 8 ? 0 : 0.6, aa = k === 8 ? 0 : a;
      const prof: THREE.Vector2[] = []; // a horse tail: thin at the ring, full in the middle, pointed at the end
      for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.03 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.8, 0.95 - 2.0 * t)); }
      const tg = new THREE.LatheGeometry(prof.reverse(), 10), tp = tg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), t = (0.95 - y) / 2.0; tp.setX(i, tp.getX(i) + 0.2 * t * t); }
      tg.computeVertexNormals();
      b.add(tg, MAT.hairW(), at4(x + Math.cos(aa) * r, H - 0.35 - 0.95, z + Math.sin(aa) * r, -aa));
    }
    const sc = new THREE.PlaneGeometry(0.2, 1.3, 1, 6).translate(0, -0.65, 0), sp = sc.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.12 * Math.sin(-sp.getY(i) * 3));
    sc.computeVertexNormals();
    b.add(sc, MAT.scarf(), at4(x + 0.1, H - 0.5, z + 0.05, 0.6));
  }
  private yurt(b: Batch, x: number, z: number, D: number, doorA: number, s: number, big: boolean) {
    const R = D / 2, Hw = (big ? 2.4 : 1.85) + 0.15 * hash(s, 1), Hr = (big ? 2.3 : 1.45) + 0.25 * hash(s, 2), seg = big ? 36 : 26;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, y: number, ry = 0) => b.add(g, m, at4(x, y, z, ry));
    add(new THREE.CylinderGeometry(R, R, Hw, seg, 1, true), MAT.felt(), Hw / 2, s);
    add(new THREE.CylinderGeometry(R + 0.04, R + 0.07, 0.3, seg, 1, true), MAT.feltDust(), 0.15);
    const prof: THREE.Vector2[] = []; // convex felt dome: rises steeply at the eave, flattens toward the crown
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(R + 0.2 - (R + 0.2 - 0.62) * t, Hr * (1 - (1 - t) ** 1.7))); }
    add(new THREE.LatheGeometry(prof, seg), MAT.feltRoof(), Hw - 0.08, s);
    add(new THREE.CylinderGeometry(R + 0.22, R + 0.22, big ? 0.34 : 0.24, seg, 1, true), MAT.keyBand(), Hw - 0.1);
    const rb = hash(s, 3) < 0.5;
    add(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.09, seg, 1, true), rb ? MAT.ropeB() : MAT.ropeR(), Hw * 0.33);
    add(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.09, seg, 1, true), rb ? MAT.ropeR() : MAT.ropeB(), Hw * 0.72);
    const top = Hw - 0.08 + Hr;
    add(new THREE.CylinderGeometry(0.6, 0.64, 0.18, 20), MAT.crown(), top + 0.05);
    add(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 16), MAT.soot(), top + 0.15);
    for (let k = 0; k < 4; k++) { // roof ropes
      const a = doorA + Math.PI / 4 + (k * Math.PI) / 2;
      for (let i = 0; i < 4; i++) {
        const P = (t: number) => { const r = R + 0.24 - (R + 0.24 - 0.66) * t; return V(x + Math.cos(a) * r, Hw - 0.06 + Hr * (1 - (1 - t) ** 1.7) + 0.03, z + Math.sin(a) * r); };
        b.add(UBOX, rb ? MAT.ropeR() : MAT.ropeB(), segM(P(i / 4), P((i + 1) / 4), 0.08, 0.06));
      }
    }
    // door + frame + step on the doorA side
    const ca = Math.cos(doorA), sa = Math.sin(doorA), ry = Math.atan2(ca, sa);
    const Md = new THREE.Matrix4().makeRotationY(ry).setPosition(x + ca * (R + 0.04), 0, z + sa * (R + 0.04));
    const dw = big ? 1.4 : 0.95, dh = big ? 1.75 : 1.32;
    b.add(UBOX, MAT.door(s), Md.clone().multiply(at4(0, dh / 2 + 0.05, 0.02, 0, dw, dh, 0.1)));
    for (const sx of [-1, 1]) b.add(UBOX, MAT.crown(), Md.clone().multiply(at4(sx * (dw / 2 + 0.06), (dh + 0.2) / 2, 0.04, 0, 0.13, dh + 0.2, 0.16)));
    b.add(UBOX, MAT.crown(), Md.clone().multiply(at4(0, dh + 0.14, 0.04, 0, dw + 0.25, 0.14, 0.16)));
    b.add(UBOX, MAT.timberD(), Md.clone().multiply(at4(0, 0.05, 0.25, 0, dw + 0.3, 0.1, 0.5)));
  }
  private wagon(b: Batch, x: number, z: number, yaw: number, s: number) {
    const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z), A = (m: THREE.Matrix4) => M.clone().multiply(m);
    b.add(UBOX, MAT.timberD(), A(at4(0, 0.95, 0, 0, 2.4, 0.14, 1.3)));
    for (const sz of [-1, 1]) b.add(UBOX, MAT.timber(), A(at4(0, 1.2, sz * 0.62, 0, 2.4, 0.36, 0.08)));
    b.add(UBOX, MAT.timber(), A(at4(-1.16, 1.2, 0, 0, 0.08, 0.36, 1.3)));
    b.add(ucyl(0.06, 0.06, 7), MAT.iron(), A(segM(V(0, 0.8, -0.85), V(0, 0.8, 0.85))));
    for (const sz of [-1, 1]) b.add(new THREE.CircleGeometry(0.8, 28), MAT.wheel(), A(at4(0, 0.8, sz * 0.78, 0)));
    for (const sz of [-1, 1]) b.add(ucyl(0.05, 0.06, 6), MAT.timberD(), A(segM(V(1.1, 0.95, sz * 0.4), V(3.3, 0.12, sz * 0.32))));
    const kind = hash(s, 15);
    if (kind < 0.4) b.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.felt(), A(at4(-0.05, 1.02, 0, 0, 1.15, 0.85, 0.66)));
    else if (kind < 0.75) for (let k = 0; k < 4; k++) b.add(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8).rotateZ(Math.PI / 2), MAT.sack(), A(at4(-0.6 + (k % 2) * 0.8, 1.27 + Math.floor(k / 2) * 0.3, (k % 2 ? 0.25 : -0.25), k * 0.4)));
    else b.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hay(), A(at4(0, 1.0, 0, 0, 1.2, 0.75, 0.68)));
  }
  private firePit(b: Batch, x: number, z: number, s: number) {
    const rk = lumpy(11 + s, 10, 8);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, r = 0.16 + 0.06 * hash(s * 9 + k, 16); b.add(rk, MAT.stone(), at4(x + Math.cos(a) * 0.78, r * 0.7, z + Math.sin(a) * 0.78, a, r * 1.2, r, r)); }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI + s; b.add(ucyl(0.08, 0.09, 7), MAT.soot(), segM(V(x - Math.cos(a) * 0.55, 0.08, z - Math.sin(a) * 0.55), V(x + Math.cos(a) * 0.55, 0.2, z + Math.sin(a) * 0.55))); }
    this.flames.push({ x, y: 0.15, z, s: 0.8 });
  }

  // ================================================================================================== per frame
  update(sid: number, f: number, cam: THREE.PerspectiveCamera) {
    const shot = SHOTS[sid - 1];
    this.group.visible = shot.set === "kaifeng";
    if (!this.group.visible) return;
    const night = shot.light === "night";
    this.updHero(f);
    this.updBatteries(f);
    this.updSwarm(f, cam);
    this.updProj(f);
    this.updMill(f);
    this.updTents(f);
    this.updBoom(f);
    this.updFires(f, night);
  }

  private updHero(f: number) {
    const S = slingLocal(f, HERO_FIRES, this.S);
    this.heroBeam.matrix.compose(_p.set(0, HPY, 0), _qq.setFromAxisAngle(ZV, S.a), ONE);
    shearM(-HS * Math.cos(S.a), HPY - HS * Math.sin(S.a), this.heroRopes.matrix);
    slingMats(S, 0.2, this.heroCords[0].matrix, this.heroBowl.matrix, this.heroRock.matrix, RB);
    _L.copy(this.heroRock.matrix);
    slingMats(S, -0.2, this.heroCords[1].matrix, null, null, RB);
    // the boulder rolls in the pouch with the swing (spin about its own axis)
    this.heroRock.matrix.compose(_p.setFromMatrixPosition(_L), _qq.setFromAxisAngle(axisOf(5), S.a * 1.4), _s.set(RB, RB, RB));
    this.heroRock.visible = loadedAt(f, this.heroLoadFires);
  }

  private updBatteries(f: number) {
    const S = this.S, sh = new THREE.Matrix4(), cord = new THREE.Matrix4(), bowl = new THREE.Matrix4(), rock = new THREE.Matrix4();
    for (let n = 0; n < this.tb.length; n++) {
      const t = this.tb[n];
      slingLocal(f, t.fires, S);
      _L.compose(_p.set(0, HPY, 0), _qq.setFromAxisAngle(ZV, S.a), ONE);
      _W.multiplyMatrices(t.M, _L);
      for (const m of this.iBeam) m.setMatrixAt(n, _W);
      shearM(-HS * Math.cos(S.a), HPY - HS * Math.sin(S.a), sh);
      this.iRopes.setMatrixAt(n, _W.multiplyMatrices(t.M, sh));
      slingMats(S, 0, cord, bowl, rock, RB);
      this.iCord.setMatrixAt(n, _W.multiplyMatrices(t.M, cord));
      this.iBowl.setMatrixAt(n, _W.multiplyMatrices(t.M, bowl));
      let load = loadedAt(f, t.fires);
      if (t.b === 0 && t.i === MILL_TREB && f > F_SMASH - 10 && f < MILL_P.f1) load = false; // the millstone thirds ride instead
      this.iLoad.setMatrixAt(n, load ? _W.multiplyMatrices(t.M, rock) : _Z);
    }
    for (const m of [...this.iBeam, this.iRopes, this.iCord, this.iBowl, this.iLoad]) m.instanceMatrix.needsUpdate = true;
    // ammo stacks: the NE battery has run out at night (only pebbles left)
    const out = f >= 500;
    this.iStack.count = out ? this.nStackNight : this.nStackDay;
    this.iPeb.visible = this.emptySpot.visible = out;
  }

  private updSwarm(f: number, cam: THREE.PerspectiveCamera) {
    let k = 0;
    const cp = cam.position;
    for (const s of this.shots) {
      if (f < s.f0 || f > s.f1) continue;
      const u = (f - s.f0) / (s.f1 - s.f0), base = s.from[1] + (s.to[1] - s.from[1]) * u;
      _p.set(s.from[0] + (s.to[0] - s.from[0]) * u, base + 4 * (s.top - (s.from[1] + s.to[1]) / 2) * u * (1 - u), s.from[2] + (s.to[2] - s.from[2]) * u);
      const d = _p.distanceTo(cp), sc = SWARM_R * (0.9 + 0.2 * hash(s.seed, 8)) * (1 + 2.2 * clamp01((d - 50) / 300));
      _W.compose(_p, _qq.setFromAxisAngle(axisOf(s.seed), (f - s.f0) * 0.15 + s.seed), _s.set(sc, sc, sc));
      this.iSwarm.setMatrixAt(k++, _W);
    }
    this.iSwarm.count = k; this.iSwarm.instanceMatrix.needsUpdate = true;
    let r = 0; while (r < this.rubs.length && this.rubs[r].f <= f) r++;
    this.iRub.count = r;
  }

  private updProj(f: number) {
    for (const pb of this.pbs) {
      const p = pb.p, m = pb.meshes[0];
      if (f < p.f0 || (!p.dent && f > p.f1)) { m.visible = false; continue; }
      m.visible = true;
      if (f <= p.f1) {
        const q = projAt(p, f)!, k = 1 - smooth((f - p.f0) / 16);
        m.position.set(q[0] + pb.off[0] * k, q[1] + pb.off[1] * k, q[2] + pb.off[2] * k);
        m.quaternion.setFromAxisAngle(axisOf(pb.seed), (f - p.f0) * 0.13);
      } else {
        this.dropAt(p.to, p.r, f - p.f1, pb.seed, 0, m.position, m.quaternion);
        m.quaternion.multiply(_qq.setFromAxisAngle(axisOf(pb.seed), (p.f1 - p.f0) * 0.13));
      }
    }
  }

  private updMill(f: number) {
    const smashed = f >= F_SMASH;
    this.millWhole.visible = !smashed;
    for (let w = 0; w < 3; w++) {
      const m = this.wedges[w], info = this.wedgeInfo[w];
      m.visible = smashed;
      if (!smashed) continue;
      const t = f - F_SMASH, k = clamp01(t / 8), dir = info.dir;
      // jump apart: outward 0.3 m, a 0.2 m hop, a little tilt that settles
      const ox = Math.cos(dir) * 0.3 * easeOut(k), oz = Math.sin(dir) * 0.3 * easeOut(k), hop = 0.22 * 4 * k * (1 - k);
      const rx = MILL_AT[0] + info.c.x + ox, rz = MILL_AT[2] + info.c.z + oz;
      const tilt = 0.35 * Math.sin(Math.PI * k) * (1 - k) + 0.04;
      m.position.set(rx, hop, rz); m.rotation.set(tilt * Math.sin(dir), (w - 1) * 0.12 * easeOut(k), -tilt * Math.cos(dir));
      if (w === 2) continue; // the third stays on the ground
      const T = this.tb[MILL_TREB], side = w === 0 ? -0.22 : 0.22;
      if (f < 572) continue;
      if (f < MILL_P.f0) {
        // carried (572-590) then riding in the sling until the release
        const q = this.pouchW(T.M, T.fires, f), c = smooth((f - 572) / 18);
        const lift = 1.1 * Math.sin(Math.PI * Math.min(1, c * 1.15)) * (c < 1 ? 1 : 0);
        m.position.set(rx + (q[0] - rx) * c, hop + (q[1] - 0.05 + w * 0.22 - hop) * c + lift, rz + (q[2] + side - rz) * c);
        m.rotation.set(1.2 * c * (w ? 1 : -1), (w - 1) * 0.12 + 0.8 * c, 0.3 * c);
      } else if (f <= MILL_P.f1) {
        const q = projAt(MILL_P, f)!, k2 = 1 - smooth((f - MILL_P.f0) / 16), sp = (w ? 0.5 : -0.5) * Math.min(1, (f - MILL_P.f0) / 10);
        m.position.set(q[0] + this.millOff[0] * k2 + sp * 0.7, q[1] + this.millOff[1] * k2 + sp * 0.4, q[2] + this.millOff[2] * k2 + sp);
        m.rotation.set(1.2 * (w ? 1 : -1) + (f - MILL_P.f0) * 0.11 * (w ? 1 : -1), 0.8 + (f - MILL_P.f0) * 0.07, 0.3 + (f - MILL_P.f0) * 0.05);
      } else {
        const rr = 0.33, tt = f - MILL_P.f1;
        this.dropAt(MILL_P.to, rr, tt, 900 + w, w ? 0.6 : -0.6, m.position, m.quaternion);
        const landed = m.position.y <= rr + 1e-4;
        m.position.y += (landed ? (w ? 0.02 : 0.33) : 0) - rr;
        if (landed) m.rotation.set(w ? 0.05 : Math.PI - 0.08, w * 2.1 + 0.4, 0);
      }
    }
  }

  private updTents(f: number) {
    const kk = tentK(f), spd = clamp01(((tentK(f + 0.5) - tentK(f - 0.5)) * 110) / 1.5);
    const boom = f >= BOOM_F, kb = boom ? easeOut(clamp01((f - BOOM_F) / 6)) : 0;
    const E = TENTS[0].to;
    TENTS.forEach((T, i) => {
      const g = this.tents[i];
      g.visible = !(i === 0 && boom);
      const dx = T.to[0] - T.from[0], dz = T.to[2] - T.from[2], L = Math.hypot(dx, dz), yaw = Math.atan2(-dz / L, dx / L);
      const s = kk * L, ph = (s / 0.42) * Math.PI + i;
      let x = T.from[0] + dx * kk, z = T.from[2] + dz * kk;
      const roll = 0.045 * spd * Math.sin(ph), pitch = 0.02 * spd * Math.sin(2 * ph), bob = 0.035 * spd * Math.abs(Math.sin(ph));
      const qy = new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, yaw, pitch, "YXZ"));
      let y = bob;
      if (i > 0 && kb > 0) { // knocked away from the blast, dropped by the diggers
        const bx = x - E[0], bz = z - E[2], bl = Math.hypot(bx, bz) || 1, ux = bx / bl, uz = bz / bl;
        const th = (i === 1 ? 0.55 : 1.3) * kb;
        const qk = new THREE.Quaternion().setFromAxisAngle(V(uz, 0, -ux), th);
        qy.premultiply(qk);
        x += ux * 0.9 * kb; z += uz * 0.9 * kb;
        let minY = 1e9;
        for (const px of [-TL / 2, TL / 2]) for (let a = 0; a <= 8; a++) {
          const t2 = (a / 8) * Math.PI, p = V(px, TLIFT + TSK + Math.sin(t2) * TW, Math.cos(t2) * TW).applyQuaternion(qy);
          minY = Math.min(minY, p.y, V(px, TLIFT, Math.cos(t2) > 0 ? TW : -TW).applyQuaternion(qy).y);
        }
        y = -minY * kb + 0.02 * kb;
      }
      g.position.set(x, y, z); g.quaternion.copy(qy);
    });
  }

  private updBoom(f: number) {
    const t = f - BOOM_F, E = TENTS[0].to;
    // fireball: 7 HDR lobes growing over 5 f, fading over ~12 f
    const grow = easeOut(clamp01((t + 0.5) / 5)), fade = 1 - smooth((t - 3) / 12);
    for (let k = 0; k < this.fireball.length; k++) {
      const m = this.fireball[k], on = t >= 0 && fade > 0.06;
      m.visible = on;
      if (!on) continue;
      const a = k * 2.4, rr = k < 2 ? 0 : 0.85 + 0.3 * hash(k, 41), up = k < 2 ? 0.2 : 0.35 * hash(k, 42);
      const sc = (k < 2 ? 1.2 : 1.05 + 0.4 * hash(k, 43)) * grow * (0.75 + 0.25 * fade) * (1 + 0.15 * t / 15);
      m.position.set(E[0] + 0.4 + Math.cos(a) * rr * grow, 1.0 + up + Math.sin(a) * rr * 0.6 * grow + 0.05 * t, E[2] + Math.sin(a) * rr * grow);
      m.scale.setScalar(sc);
      (m.material as THREE.MeshBasicMaterial).color.copy(this.fbCol[k]).multiplyScalar(0.2 + 0.8 * fade);
    }
    this.halo.visible = t >= 0 && t < 14;
    if (this.halo.visible) { this.halo.position.set(E[0] + 0.6, 1.4, E[2]); this.halo.scale.setScalar(11 * grow); this.halo.material.opacity = 1 - smooth(t / 14); }
    // smoke: 28 toon puffs that grow and rise ~40 f, then shrink away; 10 low dust puffs rolling out over the ground
    let n = 0;
    if (t >= 0 && t < 80) {
      const c = new THREE.Color();
      for (let j = 0; j < 38; j++) {
        const dust = j >= 28, h1 = hash(j, 51), h2 = hash(j, 52), h3 = hash(j, 53), h4 = hash(j, 54), h5 = hash(j, 55);
        const t0 = dust ? 0.5 + 2 * h1 : 1.5 + 5 * h1, tau = t - t0;
        if (tau <= 0) continue;
        let r: number;
        if (dust) {
          const a = (h2 - 0.5) * 2.6, d = (1.2 + 2.6 * h3) * easeOut(tau / 16);
          _p.set(E[0] + 0.5 + Math.cos(a) * d, 0.3 + 0.25 * h4, E[2] + Math.sin(a) * d * 1.4);
          r = (0.45 + 0.45 * h5) * easeOut(tau / 8) * (1 - smooth((tau - 18) / 14));
          c.setRGB(0.56, 0.43, 0.28);
        } else {
          const a = h2 * Math.PI * 2, hd = (0.6 + 1.6 * h3) * easeOut(tau / 22);
          _p.set(E[0] + 0.9 + Math.abs(Math.cos(a)) * hd + 0.04 * tau, 0.9 + (0.8 + 4.8 * h4) * (1 - Math.exp(-tau / 20)) + 0.035 * tau, E[2] + Math.sin(a) * hd);
          r = (0.55 + 0.95 * h5) * easeOut(tau / 10) * (1 - smooth((tau - (28 + 14 * h1)) / 14));
          const lk = smooth(tau / 34); c.setRGB(0.11 + 0.3 * lk, 0.095 + 0.28 * lk, 0.085 + 0.27 * lk);
        }
        if (r <= 0.01) continue;
        _W.compose(_p, _qq.setFromAxisAngle(axisOf(j + 60), j + tau * 0.02), _s.set(r, r * 0.88, r));
        this.iSmoke.setMatrixAt(n, _W); this.iSmoke.setColorAt(n, c); n++;
      }
    }
    this.iSmoke.count = n; this.iSmoke.instanceMatrix.needsUpdate = true; if (this.iSmoke.instanceColor) this.iSmoke.instanceColor.needsUpdate = true;
    // shredded hide: ballistic scraps that flutter down and lie flat on the ground
    let m2 = 0;
    if (t >= 0) {
      const g = GRAV * 0.55;
      for (let j = 0; j < 20; j++) {
        const h1 = hash(j, 61), h2 = hash(j, 62), h3 = hash(j, 63), h4 = hash(j, 64);
        const vx = 0.04 + 0.16 * h1, vz = (h2 - 0.5) * 0.3, vy = 0.13 + 0.2 * h3, y0 = 1.2 + 0.5 * h4;
        const T = (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g, tt = Math.min(t, T), dr = 26 * (1 - Math.exp(-tt / 26));
        _p.set(E[0] + 0.3 + vx * dr, Math.max(0.03 + j * 0.002, y0 + vy * tt - 0.5 * g * tt * tt), E[2] + (h2 - 0.5) * 0.8 + vz * dr);
        if (t < T) _qq.setFromAxisAngle(axisOf(j + 70), t * (0.2 + 0.25 * h4));
        else _qq.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, h2 * 6.28));
        const sc = 0.7 + 0.8 * h4;
        _W.compose(_p, _qq, _s.set(sc, sc, sc));
        this.iShred.setMatrixAt(m2++, _W);
      }
    }
    this.iShred.count = m2; this.iShred.instanceMatrix.needsUpdate = true;
    this.scorch.visible = t >= 1;
    if (this.scorch.visible) this.scorch.scale.setScalar(0.4 + 0.6 * easeOut(clamp01((t - 1) / 4)));
  }

  private updFires(f: number, night: boolean) {
    const kO = night ? 1.35 : 0.75;
    (this.iFlameO.material as THREE.MeshBasicMaterial).color.setRGB(3.2 * kO, 1.3 * kO, 0.3 * kO);
    (this.iFlameI.material as THREE.MeshBasicMaterial).color.setRGB(4.5 * kO, 3.2 * kO, 1.0 * kO);
    let a = 0, b = 0;
    this.flames.forEach((fl, i) => {
      for (let j = 0; j < 3; j++) {
        const ph = f * (0.55 + 0.1 * j) + i * 2.1 + j * 1.7, h = fl.s * (0.9 + 0.25 * Math.sin(ph) + 0.12 * Math.sin(ph * 2.3)), w = fl.s * (0.7 + 0.1 * Math.sin(ph * 1.7));
        const ang = (j / 3) * Math.PI * 2 + i, ox = Math.cos(ang) * 0.14 * fl.s, oz = Math.sin(ang) * 0.14 * fl.s;
        _W.compose(_p.set(fl.x + ox, fl.y, fl.z + oz), _qq.setFromEuler(new THREE.Euler(0.12 * Math.sin(ph * 0.7), 0, 0.12 * Math.cos(ph * 0.9))), _s.set(w, h, w));
        this.iFlameO.setMatrixAt(a++, _W);
        if (j < 2) {
          _W.compose(_p.set(fl.x + ox * 0.5, fl.y, fl.z + oz * 0.5), _qq, _s.set(w * 0.55, h * 0.62, w * 0.55));
          this.iFlameI.setMatrixAt(b++, _W);
        }
      }
      this.glows[i].visible = night;
      if (night) (this.glows[i].material as THREE.SpriteMaterial).opacity = 0.75 + 0.15 * Math.sin(f * 0.8 + i);
    });
    this.iFlameO.instanceMatrix.needsUpdate = true; this.iFlameI.instanceMatrix.needsUpdate = true;
  }
}
