// Megara (the main place): the limestone wall + gate + towers, the city inside (street, houses, the pig pen, the pitch
// cauldron, the torch brazier, the acropolis temples), the plain outside (golden grass, olives, the road, rocks, hills,
// the sea). OWNER: city (city.ts + paintcity.ts). Built once (merged batches + instanced repeats); update(sid, f) only
// sets the door leaves, the flames and the glow light (a pure function of sid + f; f may be fractional).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, Ray, V, lam, Batch, setSight, inTheWay, quad, tri } from "./build";
import { NOINK } from "./ink";
import { twoTone } from "./shade";
import { rng, rep } from "./paint";
import * as P from "./paintcity";
import {
  SHOTS, WALL_H, WALL_T, PARAPET_H, GATE_W, GATE_HGT, TOWERS_X, PEN, PEN_GAP, CAULDRON, BRAZIER, doorDeg, storyF, rampF, smooth, clamp01,
  lerp, pigMegara, HERO_PIG, type V3,
} from "./story";

// ================================================================================================ layout
const WX = 80;                 // the south wall runs x -WX..WX, then the side walls run north to NZ
const NZ = -130;               // the north wall (outer face)
const SIDE_T = 4;
const GH = GATE_W / 2;         // gate half width (3)
const SILL = 0.65;             // breastwork height above the walkway (merlons from there to PARAPET_H)
const PAR_T = 0.6;             // parapet thickness
const TW_HALF = 3.5, TW_Z0 = -WALL_T, TW_Z1 = 2, TW_H = 12;   // the four gate-line towers: x c +- 3.5, z -4..2
const CORNER: [number, number][] = [[-WX + 2, -2], [WX - 2, -2], [-WX + 2, NZ + 2], [WX - 2, NZ + 2]];
const SIDE_TW: [number, number][] = [[-WX + 1, -48], [WX - 1, -48], [-WX + 1, -92], [WX - 1, -92], [-36, NZ + 1], [36, NZ + 1]];
const FRONT_X = 6;             // house fronts on the street at x = +-6 (the street paving is x -3..3)
/** the acropolis hills inside the walls (Megara had two: Alkathoos + Karia) */
const HILLS = [
  { x: -14, z: -96, rx: 40, rz: 30, h: 17, top: 0.32 },
  { x: 38, z: -106, rx: 24, rz: 18, h: 9, top: 0.3 },
];
const hillY = (x: number, z: number) => {
  let y = 0;
  for (const H of HILLS) {
    const q = Math.sqrt(((x - H.x) / H.rx) ** 2 + ((z - H.z) / H.rz) ** 2);
    if (q < 1) { const k = smooth((1 - q) / (1 - H.top)); y = Math.max(y, H.h * k * (1 + 0.04 * Math.sin(x * 0.3 + z * 0.2) * (1 - k))); }
  }
  return y;
};
/** the road south from the gate (centre x at z) */
const roadX = (z: number) => (z < 110 ? 0 : 9 * Math.sin((z - 110) / 80) * smooth((z - 110) / 70));
/** the coast: ground drops under the sea SSE of the city */
const coastD = (x: number, z: number) => 0.42 * x + 0.9 * z - (430 + 45 * Math.sin(x * 0.004 + 1) + 22 * Math.sin(x * 0.013));
const groundY = (x: number, z: number) => -5 * smooth(coastD(x, z) / 45);

// ================================================================================================ helpers
const TAU = Math.PI * 2;
const UB = new THREE.BoxGeometry(1, 1, 1);
const boxM = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0));
const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
type Tint = (x: number, y: number, z: number) => number;
/** triangle soup with world-consistent uvs and a grey vertex-colour tint (for the stone: big blocks of variation) */
class GB {
  p: number[] = []; n: number[] = []; u: number[] = []; c: number[] = [];
  constructor(public T: number, public tint: Tint = () => 1, public cu = 3, public cv = 2) {}
  /** rect o + a*ua + b*va (a in [0, lu], b in [0, lv]); outward normal = ua x va */
  rect(o: V3, ua: V3, va: V3, lu: number, lv: number, uo = 0, vo = 0) {
    const nn = cross(ua, va), nu = Math.max(1, Math.ceil(lu / this.cu - 1e-6)), nv = Math.max(1, Math.ceil(lv / this.cv - 1e-6));
    const pt = (i: number, j: number): V3 => { const a = (i / nu) * lu, b = (j / nv) * lv; return [o[0] + ua[0] * a + va[0] * b, o[1] + ua[1] * a + va[1] * b, o[2] + ua[2] * a + va[2] * b]; };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const w = q[k];
        this.p.push(...w); this.n.push(...nn); this.u.push(dot(w, ua) / this.T + uo, dot(w, va) / this.T + vo);
        const t = this.tint(w[0], w[1], w[2]); this.c.push(t, t * 0.99, t * 0.97);
      }
    }
  }
  /** axis box, faces chosen by letters: s (+z) n (-z) e (+x) w (-x) t (top) b (bottom) */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces = "snewt") {
    const W = x1 - x0, H = y1 - y0, D = z1 - z0;
    if (faces.includes("s")) this.rect([x0, y0, z1], [1, 0, 0], [0, 1, 0], W, H);
    if (faces.includes("n")) this.rect([x1, y0, z0], [-1, 0, 0], [0, 1, 0], W, H);
    if (faces.includes("e")) this.rect([x1, y0, z1], [0, 0, -1], [0, 1, 0], D, H);
    if (faces.includes("w")) this.rect([x0, y0, z0], [0, 0, 1], [0, 1, 0], D, H);
    if (faces.includes("t")) this.rect([x0, y1, z1], [1, 0, 0], [0, 0, -1], W, D);
    if (faces.includes("b")) this.rect([x0, y0, z0], [1, 0, 0], [0, 0, 1], W, D);
  }
  mesh(mat: THREE.Material, parent: THREE.Object3D, cast = true) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    parent.add(m); return m;
  }
}
/** a chunky stone: icosahedron with jittered vertices, flat shaded (the ink gets its facets) */
const stoneGeo = (seed: number, detail = 0) => {
  const r = rng(seed), g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(), p = g.attributes.position as THREE.BufferAttribute;
  const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, off = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    if (!off.has(k)) off.set(k, 0.78 + 0.32 * r());
    const s = off.get(k)!; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
};
const HDR = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
/** flame tongue: a lathe teardrop, base at y = 0, height 1 */
const flameGeo = () => new THREE.LatheGeometry([[0, 0], [0.5, 0.12], [0.62, 0.3], [0.48, 0.55], [0.22, 0.82], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 12);

// ================================================================================================ materials
const MAT = {
  wall: () => lam("mgWallM", () => ({ map: P.wallHD(), vertexColors: true })),
  plinth: () => lam("mgPlinthM", () => ({ map: P.plinthHD(), vertexColors: true })),
  tower: () => lam("mgTowerM", () => ({ map: P.towerHD(), vertexColors: true })),
  walk: () => lam("mgWalkM", () => ({ map: P.walkHD(), vertexColors: true })),
  lintel: () => lam("mgLintelM", () => ({ color: "#ddd0b0" })),
  dark: () => lam("mgDarkM", () => ({ color: "#2a1f24" })),
  grass: () => lam("mgGrassM", () => ({ map: P.grassGoldHD(), vertexColors: true })),
  earth: () => lam("mgEarthM", () => ({ map: P.earthHD(), vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })),
  street: () => lam("mgStreetM", () => ({ map: P.streetHD(), vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  road: () => lam("mgRoadM", () => ({ map: P.roadHD(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  gate: () => lam("mgGateM", () => ({ map: P.gateHD() })),
  iron: () => lam("mgIron", () => ({ color: "#3c3a3c" })),
  stud: () => lam("mgStud", () => ({ color: "#5c5650" })),
  wood: () => lam("mgWoodM", () => ({ map: P.woodHD() })),
  beam: () => lam("mgBeam", () => ({ color: "#6a4a30" })),
  fascia: () => lam("mgFascia", () => ({ color: "#5e3f28" })),
  ridge: () => lam("mgRidge", () => ({ color: "#a4482c" })),
  plinthH: () => lam("mgHPlinth", () => ({ color: "#a89a82" })),
  mud: () => lam("mgMudM", () => ({ map: P.mudHD(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })),
  dry: () => lam("mgDryM", () => ({ map: P.dryStoneHD(), vertexColors: true })),
  cap: () => lam("mgCapM", () => ({ color: "#ab9c80" })),
  straw: () => lam("mgStrawM", () => ({ map: P.strawHD() })),
  rock: () => lam("mgRock", () => ({ color: "#ada38f" })),
  hearth: () => lam("mgHearth", () => ({ color: "#7a7268" })),
  char: () => lam("mgChar", () => ({ color: "#2a2220" })),
  pot: () => lam("mgPotM", () => ({ color: "#3a3430" })),
  bark: () => lam("mgBarkM", () => ({ map: P.barkHD() })),
  marble: () => lam("mgMarble", () => ({ color: "#e4dbc6" })),
  cypress: () => lam("mgCypress", () => ({ color: "#4a6438" })),
  hill: () => lam("mgHillM", () => ({ map: rep(P.hillHD(), 14, 4) })),
  sea: () => lam("mgSeaM", () => ({ map: rep(P.seaHD(), 60, 60) })),
};
let pitchM: THREE.Material | null = null, wetM: THREE.Material | null = null;
const pitchMat = () => (pitchM ??= twoTone(new THREE.MeshPhongMaterial({ color: "#100d0e", specular: "#6a6670", shininess: 55 })));
const wetMat = () => (wetM ??= twoTone(new THREE.MeshPhongMaterial({ color: "#3a2a1e", specular: "#8a8a90", shininess: 70, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })));
// whitewash / cream / ochre plaster, wooden trim, terracotta roof
const HSTY = [
  { wall: "#ece4d0", trim: "#6a4a30", roof: "#c0643e" },
  { wall: "#e8dcc0", trim: "#4f6a7a", roof: "#b85a3a" },
  { wall: "#efe8d8", trim: "#7a4a2a", roof: "#c8714a" },
  { wall: "#dcc8a0", trim: "#5a4030", roof: "#b05436" },
  { wall: "#e9d9b8", trim: "#3f5f6a", roof: "#c4683f" },
];
const tileMat = (si: number) => lam("mgTileM" + (si % HSTY.length), () => ({ map: P.tileHD(String(si % HSTY.length), HSTY[si % HSTY.length].roof), side: THREE.DoubleSide }));

/** distance along a camera ray (in its own parameter) to the solid south wall / gate towers, Infinity if none */
const wallHit = (r: Ray) => {
  const o = r.o, d = r.d;
  let best = Infinity;
  const slab = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, gate: boolean) => {
    let t0 = 0, t1 = Infinity;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) return; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 > t1) return;
    if (gate) { const x = o.x + d.x * t0, y = o.y + d.y * t0; if (Math.abs(x) < GH && y < GATE_HGT) return; }
    best = Math.min(best, t0);
  };
  slab(-WX, WX, 0, WALL_H + PARAPET_H, -WALL_T, 0, true);
  for (const c of TOWERS_X) slab(c - TW_HALF, c + TW_HALF, 0, TW_H + PARAPET_H, TW_Z0, TW_Z1, false);
  return best;
};

// ================================================================================================ the rig
type Flame = { m: THREE.Mesh; k: number; s: number; base: THREE.Vector3 };
export class CityRig {
  group = new THREE.Group();
  /** a point light the shade.ts GLOW uniforms read (fire light on nearby surfaces); r = 0 = off */
  glow = { pos: new THREE.Vector3(), col: new THREE.Vector3(0, 0, 0), r: 0 };
  private doors: THREE.Group[] = [];
  private flames: Flame[] = [];
  private emberMat = HDR(3.4, 1.0, 0.18);
  private coalMat = HDR(4.2, 1.5, 0.3);
  private blocked: string[] = [];

  constructor(root: THREE.Group, _kit: Kit, rays: Ray[]) {
    root.add(this.group);
    // sight lines: every ray stops where it meets the city wall (a house behind the wall never blocks a lens outside
    // it) and 2.5 m short of its look point; aerial lenses (y > 45) only skim the roofs
    const clipped = rays.filter((r) => r.o.y < 45).map((r) => ({ ...r, len: Math.min(r.len - 2.5, wallHit(r)) })).filter((r) => r.len > 0.5);
    setSight(clipped);
    this.buildGround();
    this.buildWall();
    this.buildTowers();
    this.buildGate();
    this.buildStreet();
    this.buildHouses();
    this.buildAcropolis();
    this.buildPen();
    this.buildCauldron();
    this.buildBrazier();
    this.buildPlain();
    this.buildFar();
    if (this.blocked.length) console.warn("[city] culled for camera rays:", this.blocked.join(", "));
    setSight([]);
  }

  // ---------------------------------------------------------------------------------------------- ground
  private buildGround() {
    const lines = (lim: number) => {
      const s: number[] = [];
      for (let v = -160; v <= 160; v += 4) s.push(v);
      let d = 4, v = 160; while (v < lim) { d *= 1.12; v += d; s.push(Math.min(v, lim)); s.unshift(-Math.min(v, lim)); }
      return s;
    };
    const xs = lines(1700), zs = lines(1700), nx = xs.length, nz = zs.length;
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3), idx: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i, x = xs[i], z = zs[j];
      // the grass sinks a little under the road ribbon and inside the walls (the earth plane covers it there), so
      // overlaid ground layers never z-fight in the ink / lens depth buffers
      const dip = Math.max(Math.abs(x) <= WX - SIDE_T && z <= -WALL_T && z >= NZ + SIDE_T ? 1 : 0, z > -1 ? 1 - smooth((Math.abs(x - roadX(z)) - 3.4) / 1.6) : 0);
      pos[v * 3] = x; pos[v * 3 + 1] = groundY(x, z) - 0.3 * dip; pos[v * 3 + 2] = z; uv[v * 2] = x / 8; uv[v * 2 + 1] = -z / 8;
      let t = 1 + 0.09 * Math.sin(x * 0.031 + 1.3) * Math.sin(z * 0.027 - 0.4) + 0.05 * Math.sin(x * 0.11 + z * 0.07) + 0.04 * Math.sin(x * 0.23 - z * 0.19);
      // trampled, dustier ground where the armies stand + at the wall foot
      const tr = z > 2 && z < 95 && Math.abs(x) < 40 ? 0.08 * smooth((40 - Math.abs(x)) / 10) * smooth((z - 2) / 6) : 0;
      const foot = z > -1 && z < 5 && Math.abs(x) < WX ? 0.1 * (1 - smooth((z - 1) / 4)) : 0;
      const beach = clamp01(1 - Math.abs(coastD(x, z) + 6) / 18);
      t *= 1 - tr - foot * 0.5;
      col[v * 3] = t * (1 + beach * 0.15); col[v * 3 + 1] = t * (0.98 - tr * 0.4 + beach * 0.12); col[v * 3 + 2] = t * (0.94 - tr * 0.6 + beach * 0.1);
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.grass()); m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
    // packed earth inside the walls
    const e = new GB(8, (x, _y, z) => 1 + 0.07 * Math.sin(x * 0.07 + z * 0.05) + 0.05 * Math.sin(x * 0.21 - z * 0.17) + (Math.abs(x) < 7 && z > -64 ? -0.05 : 0), 6, 6);
    // (in pieces round the street + square: they sit on top, no overlap)
    const er = (xa: number, xb: number, za: number, zb: number) => e.rect([xa, 0.0, za], [1, 0, 0], [0, 0, -1], xb - xa, za - zb);
    const XI = WX - SIDE_T, ZI = NZ + SIDE_T;
    er(-XI, -7, -WALL_T, ZI); er(7, XI, -WALL_T, ZI); er(-7, -GH - 0.2, -WALL_T, -64); er(GH + 0.2, 7, -WALL_T, -64); er(-7, 7, -70, ZI);
    e.mesh(MAT.earth(), this.group, false);
    // the dirt road south from the gate: a ribbon with the road texture across it (u) and along it (v)
    const rp: number[] = [], ru: number[] = [], ri: number[] = [];
    const zsR: number[] = []; for (let z = 0; z <= 120; z += 2) zsR.push(z); for (let z = 124; z <= 900; z += 6) zsR.push(z);
    zsR.forEach((z, k) => {
      const cx = roadX(z), hw = z < 6 ? lerp(3.4, 3.6, z / 6) : 3.6 + 0.4 * Math.sin(z * 0.05), dx = roadX(z + 1) - cx, l = Math.hypot(dx, 1);
      for (const s of [-1, 1]) { const x = cx + (s * hw) / l, zz = z - (s * hw * dx) / l; rp.push(x, groundY(x, zz) + 0.02, zz); ru.push(s < 0 ? 0 : 1, z / 6); }
      if (k) { const a = (k - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(ru, 2)); rg.setIndex(ri); rg.computeVertexNormals();
    const rm = new THREE.Mesh(rg, MAT.road()); rm.receiveShadow = true; rm.matrixAutoUpdate = false; this.group.add(rm);
  }

  // ---------------------------------------------------------------------------------------------- the wall
  private buildWall() {
    const tint: Tint = (x, y, z) => {
      let t = 1 + 0.07 * Math.sin(x * 0.13 + z * 0.11) * Math.sin(y * 0.5 + x * 0.03) + 0.05 * Math.sin(x * 0.041 + z * 0.037 + 1.7) + 0.04 * Math.sin(x * 0.37 + y * 0.8 + z * 0.29);
      t *= 0.86 + 0.14 * smooth((y - 0.6) / 2.4);                                  // dust + damp at the foot
      if (Math.abs(x) < 6 && y < 7 && z > -4.2 && z < 0.3) t *= 0.9 + 0.1 * smooth((Math.abs(x) - 3) / 3); // worn round the gate
      t *= 1 - 0.06 * smooth((y - 6.8) / 1.6);                                     // weathered top courses
      return t;
    };
    const w = new GB(P.WALL_TILE, tint), pl = new GB(P.WALL_TILE, (x, y, z) => 0.92 + 0.08 * Math.sin(x * 0.17 + z * 0.13) - 0.06 * (1 - smooth(y / 0.6))), wk = new GB(4, (x, _y, z) => 0.95 + 0.05 * Math.sin(x * 0.3 + z * 0.4), 4, 4);
    const top = WALL_H, mH = WALL_H + PARAPET_H, sH = WALL_H + SILL;
    const towerSpans: [number, number][] = TOWERS_X.map((c) => [c - TW_HALF, c + TW_HALF]);
    // ---- the south wall (outer face z = 0)
    for (const [x0, x1] of [[-WX, -GH], [GH, WX]] as const) {
      w.box(x0, x1, 0, top, -WALL_T, 0, "snew");
      wk.box(x0, x1, top, top, -WALL_T, 0, "t");
      pl.box(x0 - (x0 < 0 ? 0.3 : 0), x1 + (x1 > 0 ? 0.3 : 0), 0, 0.95, 0, 0.3, x0 < 0 ? "ste" : "stw");     // outer plinth course
      pl.box(x0, x1, 0, 0.6, -WALL_T - 0.2, -WALL_T, x0 < 0 ? "nte" : "ntw");                                // inner plinth
    }
    w.box(-GH, GH, GATE_HGT, top, -WALL_T, 0, "snb");                       // over the gate (its bottom = the passage ceiling)
    wk.box(-GH, GH, top, top, -WALL_T, 0, "t");
    w.box(-WX, WX, top - 0.24, top + 0.02, 0, 0.14, "stb");                // string course under the parapet
    // parapet: breastwork + merlons (outer edge), coping on the merlons
    const parapet = (x0: number, x1: number, z0: number, z1: number, along: "x" | "z", skip: [number, number][]) => {
      w.box(x0, x1, top, sH, z0, z1, "snewt");
      const a0 = along === "x" ? x0 : z0, a1 = along === "x" ? x1 : z1, L = a1 - a0, n = Math.floor((L + 0.8) / 2.0);
      const s0 = a0 + (L - (n * 2.0 - 0.8)) / 2;
      for (let i = 0; i < n; i++) {
        const b0 = s0 + i * 2.0, b1 = b0 + 1.2;
        if (skip.some(([c0, c1]) => b1 > c0 - 0.2 && b0 < c1 + 0.2)) continue;
        if (along === "x") { w.box(b0, b1, sH, mH, z0, z1, "snewt"); pl.box(b0 - 0.06, b1 + 0.06, mH, mH + 0.12, z0 - 0.06, z1 + 0.06, "snewtb"); }
        else { w.box(x0, x1, sH, mH, b0, b1, "snewt"); pl.box(x0 - 0.06, x1 + 0.06, mH, mH + 0.12, b0 - 0.06, b1 + 0.06, "snewtb"); }
      }
    };
    const cornerSpans = CORNER.map(([cx]) => [cx - 4, cx + 4] as [number, number]);
    parapet(-WX, WX, -PAR_T, 0, "x", [...towerSpans, ...cornerSpans]);
    // ---- the side walls (outer faces x = +-WX) and the north wall (outer face z = NZ)
    for (const s of [-1, 1]) {
      const xo = s * WX, xi = s * (WX - SIDE_T);
      w.box(Math.min(xo, xi), Math.max(xo, xi), 0, top, NZ, -WALL_T, s > 0 ? "ewn" : "wen");
      wk.box(Math.min(xo, xi), Math.max(xo, xi), top, top, NZ, -WALL_T, "t");
      pl.box(s > 0 ? xo : xo - 0.3, s > 0 ? xo + 0.3 : xo, 0, 0.95, NZ, 0, s > 0 ? "et" : "wt");
      parapet(s > 0 ? xo - PAR_T : xo, s > 0 ? xo : xo + PAR_T, NZ, -WALL_T, "z", SIDE_TW.filter(([x]) => Math.sign(x) === s).map(([, z]) => [z - 4, z + 4] as [number, number]).concat([[NZ - 1, NZ + 6], [-8, 0]]));
    }
    w.box(-WX + SIDE_T, WX - SIDE_T, 0, top, NZ, NZ + SIDE_T, "snt");
    pl.box(-WX, WX, 0, 0.95, NZ - 0.3, NZ, "nt");
    parapet(-WX + SIDE_T, WX - SIDE_T, NZ, NZ + PAR_T, "x", SIDE_TW.filter(([, z]) => z < NZ + 5).map(([x]) => [x - 4, x + 4] as [number, number]).concat(cornerSpans));
    // ---- stairs up to the walkway against the inner face (west: x -17 -> -27 descending; east: x 27 -> 37)
    for (const [xTop, dir] of [[-17, -1], [27, 1]] as const) {
      for (let k = 0; k < 20; k++) {
        const y1 = top - k * 0.4, xa = xTop + dir * k * 0.5, xb = xa + dir * 0.5;
        w.box(Math.min(xa, xb), Math.max(xa, xb), 0, y1, -WALL_T - 1.6, -WALL_T, dir > 0 ? "netw".replace("w", "") : "netw".replace("e", ""));
      }
    }
    w.mesh(MAT.wall(), this.group); pl.mesh(MAT.plinth(), this.group); wk.mesh(MAT.walk(), this.group, false);
  }

  // ---------------------------------------------------------------------------------------------- towers
  private buildTowers() {
    const tint: Tint = (x, y, z) => (1 + 0.06 * Math.sin(x * 0.29 + z * 0.23 + y * 0.31) + 0.04 * Math.sin(x * 0.9 + y * 0.7)) * (0.86 + 0.14 * smooth((y - 0.6) / 2.4)) * (1 - 0.05 * smooth((y - 10) / 2));
    const t = new GB(P.WALL_TILE, tint), pl = new GB(P.WALL_TILE, () => 0.9), wk = new GB(4, () => 0.95, 4, 4), b = new Batch();
    const dark = MAT.dark(), lin = MAT.lintel();
    const tower = (cx: number, cz0: number, cz1: number, hx: number, H: number, name: string, hero: boolean) => {
      const hit = inTheWay(cx - hx, cx + hx, WALL_H, H + 1.5, cz0, cz1, true);
      if (hit && !hero) { this.blocked.push(name); return; }
      if (hit) this.blocked.push(name + " (kept: hero)");
      t.box(cx - hx, cx + hx, 0, H, cz0, cz1, "snew");
      wk.box(cx - hx, cx + hx, H, H, cz0, cz1, "t");
      pl.box(cx - hx - 0.3, cx + hx + 0.3, 0, 0.95, cz0 - 0.3, cz1 + 0.3, "snewt");
      t.box(cx - hx - 0.12, cx + hx + 0.12, WALL_H - 0.24, WALL_H + 0.02, cz0 - 0.12, cz1 + 0.12, "snewtb");   // string courses
      t.box(cx - hx - 0.16, cx + hx + 0.16, H - 0.3, H, cz0 - 0.16, cz1 + 0.16, "snewtb");
      // parapet round the top + merlons
      const sh = H + SILL, mh = H + PARAPET_H;
      t.box(cx - hx, cx + hx, H, sh, cz1 - PAR_T, cz1, "snewt"); t.box(cx - hx, cx + hx, H, sh, cz0, cz0 + PAR_T, "snewt");
      t.box(cx - hx, cx - hx + PAR_T, H, sh, cz0 + PAR_T, cz1 - PAR_T, "ewt"); t.box(cx + hx - PAR_T, cx + hx, H, sh, cz0 + PAR_T, cz1 - PAR_T, "ewt");
      const mer = (a0: number, a1: number, f0: number, f1: number, along: "x" | "z") => {
        const L = a1 - a0, n = Math.max(2, Math.round((L + 0.75) / 1.85)), mw = (L - (n - 1) * 0.75) / n;
        for (let i = 0; i < n; i++) {
          const b0 = a0 + i * (mw + 0.75), b1 = b0 + mw;
          if (along === "x") { t.box(b0, b1, sh, mh, f0, f1, "snewt"); pl.box(b0 - 0.06, b1 + 0.06, mh, mh + 0.12, f0 - 0.06, f1 + 0.06, "snewtb"); }
          else { t.box(f0, f1, sh, mh, b0, b1, "snewt"); pl.box(f0 - 0.06, f1 + 0.06, mh, mh + 0.12, b0 - 0.06, b1 + 0.06, "snewtb"); }
        }
      };
      mer(cx - hx, cx + hx, cz1 - PAR_T, cz1, "x"); mer(cx - hx, cx + hx, cz0, cz0 + PAR_T, "x");
      mer(cz0 + PAR_T + 0.75, cz1 - PAR_T - 0.75, cx - hx, cx - hx + PAR_T, "z"); mer(cz0 + PAR_T + 0.75, cz1 - PAR_T - 0.75, cx + hx - PAR_T, cx + hx, "z");
      // arrow slits: a dark slot + a stone sill and lintel standing proud (real edges for the ink); M places a
      // slit-local frame (x along the face, +z out of it) on the face
      const slit = (M: THREE.Matrix4, y: number) => {
        b.add(quad(V(-0.13, y, 0.006), V(0.13, y, 0.006), V(0.13, y + 1.25, 0.006), V(-0.13, y + 1.25, 0.006)), dark, M);
        b.add(UB, lin, M.clone().multiply(boxM(-0.35, 0.35, y - 0.16, y, 0, 0.1)));
        b.add(UB, lin, M.clone().multiply(boxM(-0.35, 0.35, y + 1.25, y + 1.42, 0, 0.1)));
      };
      const onFace = (x: number, z: number, yaw: number) => new THREE.Matrix4().makeRotationY(yaw).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
      const zm = (cz0 + cz1) / 2;
      for (const dx of [-1.6, 1.6]) slit(onFace(cx + dx, cz1, 0), 4.2);
      slit(onFace(cx, cz1, 0), 9.0);
      slit(onFace(cx + hx, zm + 0.6, Math.PI / 2), 4.6); slit(onFace(cx - hx, zm + 0.6, -Math.PI / 2), 4.6);
      // doorways where the walkway meets a gate-line tower (dark openings with a lintel)
      if (cz0 <= -WALL_T + 0.01 && cz1 > 0) for (const s of [-1, 1]) {
        const M = onFace(cx + s * hx, -2.4, s * Math.PI / 2);
        b.add(quad(V(-0.6, WALL_H, 0.006), V(0.6, WALL_H, 0.006), V(0.6, WALL_H + 2.1, 0.006), V(-0.6, WALL_H + 2.1, 0.006)), dark, M);
        b.add(UB, lin, M.clone().multiply(boxM(-0.85, 0.85, WALL_H + 2.1, WALL_H + 2.4, 0, 0.14)));
      }
    };
    for (const cx of TOWERS_X) tower(cx, TW_Z0, TW_Z1, TW_HALF, TW_H, `tower x=${cx}`, true);
    for (const [cx, cz] of CORNER) tower(cx, cz - 4, cz + 4, 4, 12.5, `corner tower (${cx},${cz})`, false);
    for (const [cx, cz] of SIDE_TW) {
      if (Math.abs(cz - NZ) < 3) tower(cx, cz - 3.5, cz + 2.5, 3.5, 11.5, `north tower x=${cx}`, false);
      else tower(cx + Math.sign(cx) * 0.5, cz - 3.5, cz + 3.5, 3.5, 11.5, `side tower (${cx},${cz})`, false);
    }
    t.mesh(MAT.tower(), this.group); pl.mesh(MAT.plinth(), this.group); wk.mesh(MAT.walk(), this.group, false);
    b.build(this.group);
  }

  // ---------------------------------------------------------------------------------------------- the gate
  private buildGate() {
    const b = new Batch(), lin = MAT.lintel();
    // outer + inner frame: jamb stones standing proud and a big lintel block over the passage
    for (const [z0, z1] of [[0, 0.22], [-WALL_T - 0.22, -WALL_T]] as const) {
      for (const s of [-1, 1]) b.add(UB, lin, boxM(s > 0 ? GH : -GH - 0.7, s > 0 ? GH + 0.7 : -GH, 0.95, GATE_HGT, z0, z1));
      b.add(UB, lin, boxM(-GH - 0.9, GH + 0.9, GATE_HGT, GATE_HGT + 1.0, z0 - (z0 < -1 ? 0.06 : 0), z1 + (z0 > -1 ? 0.06 : 0)));
    }
    // the relieving triangle over the outer lintel (a dark recess framed by two raking stones)
    b.add(tri(V(-1.6, GATE_HGT + 1.05, 0.03), V(1.6, GATE_HGT + 1.05, 0.03), V(0, GATE_HGT + 1.85, 0.03)), MAT.dark());
    for (const s of [-1, 1]) b.add(UB, lin, new THREE.Matrix4().compose(V(s * 0.95, GATE_HGT + 1.45, 0.1), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * 0.46), V(2.2, 0.3, 0.2)));
    // threshold stones (nearly flush, a pale band across the passage at both ends)
    b.add(UB, lin, boxM(-GH, GH, -0.02, 0.035, -0.5, 0));
    b.add(UB, lin, boxM(-GH, GH, -0.02, 0.035, -WALL_T, -WALL_T + 0.5));
    b.build(this.group);
    // ---- the two leaves: hinged at x = +-3 on the inner face; shut = across the passage end (z -4..-3.72)
    const T = 0.28, L = GH;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * GH, 0, -WALL_T); pivot.userData.s = s; this.group.add(pivot);
      const lb = new Batch(), cx = -s * L / 2;
      lb.add(new THREE.BoxGeometry(L - 0.04, GATE_HGT - 0.06, T), MAT.gate(), new THREE.Matrix4().makeTranslation(cx, GATE_HGT / 2, T / 2));
      for (const by of [0.85, 3.0, 5.15]) for (const fz of [-0.02, T + 0.02]) {           // iron bands (both faces) + studs
        lb.add(UB, MAT.iron(), boxM(cx - L / 2 + 0.06, cx + L / 2 - 0.06, by - 0.09, by + 0.09, fz - 0.025, fz + 0.025));
        for (let k = 0; k < 9; k++) lb.add(new THREE.SphereGeometry(0.05, 8, 6), MAT.stud(), new THREE.Matrix4().makeTranslation(cx - L / 2 + 0.25 + (k * (L - 0.5)) / 8, by, fz + (fz < 0 ? -0.03 : 0.03)));
      }
      for (const by of [1.4, 4.6]) lb.add(UB, MAT.iron(), boxM(s > 0 ? -1.1 : 0, s > 0 ? 0 : 1.1, by - 0.07, by + 0.07, -0.05, T + 0.05));   // hinge straps
      for (let k = 0; k < 12; k++) for (const fz of [-0.03, T + 0.03]) lb.add(new THREE.SphereGeometry(0.045, 8, 6), MAT.stud(), new THREE.Matrix4().makeTranslation(-s * (L - 0.18), 0.4 + k * 0.48, fz));
      lb.build(pivot);
      this.doors.push(pivot);
    }
  }

  // ---------------------------------------------------------------------------------------------- the street
  private buildStreet() {
    const st = new GB(P.STREET_TILE, (x, _y, z) => (1 + 0.06 * Math.sin(z * 0.21 + x * 0.4) + 0.04 * Math.sin(z * 0.53)) * (1 - 0.1 * smooth((Math.abs(x) - 2.2) / 1)), 3, 4);
    st.rect([-GH - 0.2, 0.03, 0.4], [1, 0, 0], [0, 0, -1], GATE_W + 0.4, 64.4);            // passage + street to z -64
    st.rect([-7, 0.03, -64], [1, 0, 0], [0, 0, -1], 14, 6);                                  // the little square at its end
    st.mesh(MAT.street(), this.group, false);
    const b = new Batch(), r = rng(71);
    for (const s of [-1, 1]) for (let z = -4.6; z > -63; z -= 0.9 + r() * 0.3) {          // kerb stones (5 cm: pigs trot over)
      if (s > 0 && z > -27) continue;          // the yard side stays open (the herd path from the pen)
      b.add(UB, MAT.plinthH(), boxM(s * GH - 0.18, s * GH + 0.18, 0, 0.05, z - 0.42, z + 0.02));
    }
    b.build(this.group, false);
  }

  // ---------------------------------------------------------------------------------------------- houses
  private buildHouses() {
    const b = new Batch(), r = rng(23), U = (a: number, c: number) => a + (c - a) * r();
    const house = (x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, door = true) => {
      const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.5, hz = (across ? w : d) / 2 + 0.5, rh = d * 0.19;
      if (inTheWay(x - hx, x + hx, 0, h + rh + 0.4, z - hz, z + hz)) { this.blocked.push(`house(${x.toFixed(0)},${z.toFixed(0)})`); return false; }
      const k0 = si % HSTY.length, sty = HSTY[k0], m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
      const kf = `${k0}_${w}_${h}_${door ? 1 : 0}`, ks = `${k0}_${d}_${h}_0`, kb = `${k0}_${w}_${h}_0`;
      const fm = lam("mgHF" + kf, () => ({ map: P.plasterHD("f" + kf, w, h, sty.wall, door, sty.trim) }));
      const sm = lam("mgHF" + ks, () => ({ map: P.plasterHD("f" + ks, d, h, sty.wall, false, sty.trim) }));
      const bm = lam("mgHF" + kb, () => ({ map: P.plasterHD("f" + kb, w, h, sty.wall, false, sty.trim) }));
      const gm = lam("mgGab" + sty.wall, () => ({ color: sty.wall }));
      const hw = w / 2, hd = d / 2, o = 0.42, og = 0.3, yE = h - rh * (o / hd);
      b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), fm, m);
      b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), bm, m);
      b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), sm, m);
      b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), sm, m);
      b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), gm, m);
      b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), gm, m);
      const tm = tileMat(si), ru = (w + 2 * og) / P.TILE_W, rv = Math.hypot(hd + o, rh + rh * (o / hd)) / P.TILE_W;
      b.add(quad(V(-hw - og, yE, hd + o), V(hw + og, yE, hd + o), V(hw + og, h + rh, 0), V(-hw - og, h + rh, 0), ru, rv), tm, m);
      b.add(quad(V(hw + og, yE, -hd - o), V(-hw - og, yE, -hd - o), V(-hw - og, h + rh, 0), V(hw + og, h + rh, 0), ru, rv), tm, m);
      const B = (mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => b.add(UB, mat, m.clone().multiply(boxM(x0, x1, y0, y1, z0, z1)));
      for (const s of [-1, 1]) B(MAT.fascia(), -hw - og, hw + og, yE - 0.16, yE + 0.02, s * (hd + o) - 0.07, s * (hd + o) + 0.07);
      b.add(new THREE.CylinderGeometry(0.15, 0.15, w + 2 * og + 0.1, 10).rotateZ(Math.PI / 2), MAT.ridge(), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h + rh + 0.02, 0)));
      B(MAT.plinthH(), -hw - 0.06, hw + 0.06, -0.05, 0.4, -hd - 0.06, hd + 0.06);
      // window lintels + sills / door lintel + step (follow paintcity.winLayout)
      const face = (len: number, dr: boolean, at: (u: number) => [number, number], out: [number, number]) => {
        for (const wn of P.winLayout(len, h, dr)) {
          const [px, pz] = at(wn.u), yT = wn.y + wn.h, half = wn.w / 2 + (wn.door ? 0.22 : 0.12), dep = wn.door ? 0.16 : 0.09;
          const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
          const BB = (mat: THREE.Material, y0: number, y1: number, dp: number) => B(mat, Math.min(ax, bx, ax + out[0] * dp), Math.max(ax, bx, ax + out[0] * dp), y0, y1, Math.min(az, bz, az + out[1] * dp), Math.max(az, bz, az + out[1] * dp));
          BB(MAT.beam(), yT, yT + (wn.door ? 0.2 : 0.13), dep);
          if (wn.door) {
            const s2 = 0.75, cx2 = px - out[1] * s2, cz2 = pz + out[0] * s2, dx2 = px + out[1] * s2, dz2 = pz - out[0] * s2;
            B(MAT.plinthH(), Math.min(cx2, dx2, cx2 + out[0] * 0.42), Math.max(cx2, dx2, cx2 + out[0] * 0.42), 0, 0.14, Math.min(cz2, dz2, cz2 + out[1] * 0.42), Math.max(cz2, dz2, cz2 + out[1] * 0.42));
          } else BB(MAT.beam(), wn.y - 0.08, wn.y, 0.07);
        }
      };
      face(w, door, (u) => [-hw + u * w, hd], [0, 1]);
      face(w, false, (u) => [hw - u * w, -hd], [0, -1]);
      face(d, false, (u) => [-hw, -hd + u * d], [-1, 0]);
      face(d, false, (u) => [hw, hd - u * d], [1, 0]);
      return true;
    };
    /** a courtyard wall segment (whitewash, tile coping) along z at x, from z0 to z1 */
    const yardWall = (x: number, z0: number, z1: number, si: number) => {
      if (z1 - z0 < 0.4 || inTheWay(x - 0.4, x + 0.4, 0, 2.6, z0, z1)) return;
      const sty = HSTY[si % HSTY.length];
      b.add(UB, lam("mgGab" + sty.wall, () => ({ color: sty.wall })), boxM(x - 0.25, x + 0.25, 0, 2.3, z0, z1));
      b.add(UB, MAT.ridge(), boxM(x - 0.36, x + 0.36, 2.3, 2.45, z0 - 0.05, z1 + 0.05));
    };
    const pots: { x: number; z: number; k: number }[] = [];
    // ---- street rows: fronts at x = -+FRONT_X; the east row starts north of the yard (z < -27)
    for (const s of [-1, 1]) {
      let z = s < 0 ? -4.6 : -27.5, si = s < 0 ? 0 : 2;
      while (z > -62) {
        const w = [6, 7.5, 9][Math.floor(r() * 3)], d = 7, near = Math.hypot(s * 9, z - w / 2) < 16;
        const h = near || r() < 0.6 ? 3.6 : 5.6, cz = z - w / 2;
        house(s * (FRONT_X + d / 2), cz, s < 0 ? Math.PI / 2 : -Math.PI / 2, w, d, h, si++, true);
        if (r() < 0.55) pots.push({ x: s * (FRONT_X - 0.5), z: cz + (r() < 0.5 ? 1 : -1) * (w / 2 - 0.7), k: Math.floor(r() * 3) });
        const gap = r() < 0.35 ? U(1.6, 2.6) : 0.25;
        if (gap > 1) yardWall(s * (FRONT_X + 0.25), z - w - gap, z - w, si);
        z -= w + gap;
      }
    }
    // the yard's east side (x >= 13: the inside camera works x 3..9 looking south): a house + a low shed
    house(19.5, -18.5, -Math.PI / 2, 7, 6, 3.4, 4, true);
    house(18.5, -8.8, -Math.PI / 2, 7, 5, 3.2, 1, false);
    // ---- the rest of the town: instanced houses on a jittered grid (walls + roofs; colours per instance)
    const list: { x: number; y: number; z: number; w: number; d: number; h: number; yaw: number; c: number }[] = [];
    for (let gx = -72; gx <= 72; gx += 10) for (let gz = -12; gz >= NZ + 9; gz -= 9.5) {
      const x = gx + U(-2, 2), z = gz + U(-1.6, 1.6);
      if (Math.abs(x) < 15 && z > -66) continue;            // street rows + square
      if (x > 1 && x < 26 && z > -30) continue;              // the yard / pen / east houses
      if (z > -9) continue;                                  // the lane along the wall
      if (HILLS.some((H) => Math.hypot((x - H.x) / H.rx, (z - H.z) / H.rz) < H.top + 0.08)) continue;   // hilltops (temples)
      if (r() < 0.14) continue;
      const w = U(6, 9.5), d = U(6, 8), h = r() < 0.3 ? U(5, 6) : U(3.3, 4.2), yaw = (r() < 0.5 ? 0 : Math.PI / 2) + U(-0.08, 0.08);
      const hy = hillY(x, z), y = hy - (hy > 0.3 ? 1.2 : 0);
      const hx = Math.max(w, d) / 2 + 0.6;
      if (inTheWay(x - hx, x + hx, y, y + h + 2, z - hx, z + hx)) { this.blocked.push(`town house(${x.toFixed(0)},${z.toFixed(0)})`); continue; }
      list.push({ x, y, z, w, d, h: h + (hy > 0.3 ? 1.2 : 0), yaw, c: Math.floor(r() * HSTY.length) });
    }
    const wallG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const roofG = (() => {
      const slopes = mergeGeometries([quad(V(-0.5, 0, 0.5), V(0.5, 0, 0.5), V(0.5, 1, 0), V(-0.5, 1, 0), 2, 1), quad(V(0.5, 0, -0.5), V(-0.5, 0, -0.5), V(-0.5, 1, 0), V(0.5, 1, 0), 2, 1)], false);
      const gab = mergeGeometries([tri(V(-0.46, 0, -0.44), V(-0.46, 0, 0.44), V(-0.46, 0.94, 0)), tri(V(0.46, 0, 0.44), V(0.46, 0, -0.44), V(0.46, 0.94, 0))], false);
      return mergeGeometries([slopes, gab], true);
    })();
    const instWall = lam("mgInstWall", () => ({ map: P.plasterHD("inst", 8, 4, "#f2ece0", true, "#6a4a30") }));
    const instRoof = lam("mgInstRoof", () => ({ map: rep(P.tileHD("inst", "#c4683f"), 2, 1), side: THREE.DoubleSide }));
    const instGab = lam("mgInstGab", () => ({ color: "#ffffff" }));
    const wim = new THREE.InstancedMesh(wallG, instWall, list.length), rim = new THREE.InstancedMesh(roofG, [instRoof, instGab], list.length);
    const col = new THREE.Color();
    list.forEach((L, i) => {
      const rh = L.d * 0.2;
      wim.setMatrixAt(i, M4(L.x, L.y, L.z, L.yaw, 1).multiply(new THREE.Matrix4().makeScale(L.w, L.h, L.d)));
      rim.setMatrixAt(i, M4(L.x, L.y + L.h - 0.1, L.z, L.yaw, 1).multiply(new THREE.Matrix4().makeScale(L.w + 0.6, rh, L.d + 0.8)));
      col.set(HSTY[L.c].wall).multiplyScalar(1 / 0.93); wim.setColorAt(i, col);
      col.set(HSTY[L.c].roof).lerp(new THREE.Color("#ffffff"), 0.5).multiplyScalar(1.6); rim.setColorAt(i, col);
    });
    for (const im of [wim, rim]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); }
    // ---- dressing: storage jars + amphorae at the doors, a cart + amphorae by the wall east of the pen, a woodpile
    const amph = new THREE.LatheGeometry([[0, 0], [0.08, 0.02], [0.17, 0.2], [0.26, 0.5], [0.24, 0.72], [0.12, 0.86], [0.09, 1.0], [0.12, 1.04], [0, 1.04]].map(([a, c]) => new THREE.Vector2(a, c)), 14);
    const pithos = new THREE.LatheGeometry([[0, 0], [0.22, 0.02], [0.4, 0.3], [0.46, 0.62], [0.36, 0.95], [0.26, 1.08], [0.3, 1.14], [0.24, 1.16], [0, 1.16]].map(([a, c]) => new THREE.Vector2(a, c)), 16);
    const potM = [lam("mgAmphA", () => ({ map: P.potHD("a", "#c27a4e") })), lam("mgAmphB", () => ({ map: P.potHD("b", "#b8693f") })), lam("mgAmphC", () => ({ map: P.potHD("c", "#d08a5a") }))];
    for (const p of pots) {
      if (inTheWay(p.x - 0.6, p.x + 0.6, 0, 1.2, p.z - 0.6, p.z + 0.6, true)) continue;
      b.add(pithos, potM[p.k], M4(p.x, 0, p.z, p.k, 0.9 + 0.1 * p.k));
      if (p.k !== 1) b.add(amph, potM[(p.k + 1) % 3], M4(p.x, 0, p.z + 0.85, p.k * 2, 0.8));
    }
    for (let k = 0; k < 6; k++) b.add(amph, potM[k % 3], new THREE.Matrix4().compose(V(18.0 + k * 0.58, 0, -4.55), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.16, k * 0.7, 0.04 * (k % 2 ? 1 : -1))), V(1, 1, 1)));
    // the cart (two big wheels, a plank bed, shafts resting on the ground) parked along the wall at x 13..17
    const cart = new THREE.Matrix4().makeTranslation(15.0, 0, -5.4);
    const C = (mat: THREE.Material, g: THREE.BufferGeometry, mm: THREE.Matrix4) => b.add(g, mat, cart.clone().multiply(mm));
    C(MAT.wood(), UB, boxM(-1.1, 1.1, 0.72, 0.84, -0.7, 0.7));
    for (const s of [-1, 1]) C(MAT.wood(), UB, boxM(-1.1, 1.1, 0.84, 1.14, s * 0.7 - 0.05, s * 0.7 + 0.05));
    for (const s of [-1, 1]) {
      C(MAT.beam(), new THREE.TorusGeometry(0.55, 0.06, 6, 20), new THREE.Matrix4().makeTranslation(0, 0.58, s * 0.86));
      for (let k = 0; k < 4; k++) C(MAT.beam(), new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), new THREE.Matrix4().compose(V(0, 0.58, s * 0.86), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), (k * Math.PI) / 4), V(1, 1, 1)));
      C(MAT.beam(), new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0.58, s * 0.86));
      C(MAT.beam(), UB, new THREE.Matrix4().compose(V(2.0, 0.42, s * 0.45), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), 0.33), V(2.1, 0.09, 0.09)));
    }
    C(MAT.beam(), new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0.58, 0));
    const log = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 8).rotateX(Math.PI / 2);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) b.add(log, MAT.bark(), M4(14.2 + k * 0.23 + row * 0.115, 0.11 + row * 0.19, -13.2, U(-0.08, 0.08)));
    b.build(this.group);
  }

  // ---------------------------------------------------------------------------------------------- acropolis
  private buildAcropolis() {
    const b = new Batch();
    for (const H of HILLS) {
      const nx = 40, nz = 32, pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = H.x - H.rx + (2 * H.rx * i) / nx, z = H.z - H.rz + (2 * H.rz * j) / nz, y = hillY(x, z);
        pos.push(x, y > 0 ? y - 0.1 : -0.3, z); uv.push(x / 8, -z / 8);
        const k = smooth(y / H.h), t = (1 + 0.06 * Math.sin(x * 0.3 + z * 0.2)) * (1 - 0.36 * k * (1 - k));
        col.push(t, t * 0.98, t * 0.95);
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, c = a + nx + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, lam("mgHillEarth", () => ({ map: P.earthHD(), vertexColors: true }))); m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
    }
    // Doric temples on the hilltops (long axis east-west), a painted frieze band, tiled pediment roofs
    const temple = (cx: number, cz: number, w: number, d: number, nF: number, nS: number, ch: number) => {
      const y0 = hillY(cx, cz), mar = MAT.marble();
      if (inTheWay(cx - w / 2 - 2, cx + w / 2 + 2, y0, y0 + ch + 5, cz - d / 2 - 2, cz + d / 2 + 2)) { this.blocked.push("temple"); return; }
      for (let k = 0; k < 3; k++) b.add(UB, mar, boxM(cx - w / 2 - 1.2 + k * 0.4, cx + w / 2 + 1.2 - k * 0.4, y0 - 1 + k * 0.35, y0 + 0.35 * (k + 1), cz - d / 2 - 1.2 + k * 0.4, cz + d / 2 + 1.2 - k * 0.4));
      const yb = y0 + 1.05, colG = new THREE.CylinderGeometry(0.42, 0.5, ch, 12).translate(0, ch / 2, 0), capG = new THREE.BoxGeometry(1.15, 0.28, 1.15);
      const put = (x: number, z: number) => { b.add(colG, mar, new THREE.Matrix4().makeTranslation(x, yb, z)); b.add(capG, mar, new THREE.Matrix4().makeTranslation(x, yb + ch + 0.14, z)); };
      for (let i = 0; i < nF; i++) for (const s of [-1, 1]) put(cx - w / 2 + 0.6 + (i * (w - 1.2)) / (nF - 1), cz + s * (d / 2 - 0.6));
      for (let i = 1; i < nS - 1; i++) for (const s of [-1, 1]) put(cx + s * (w / 2 - 0.6), cz - d / 2 + 0.6 + (i * (d - 1.2)) / (nS - 1));
      b.add(UB, lam("mgCella", () => ({ color: "#d9cdb2" })), boxM(cx - w / 2 + 2.2, cx + w / 2 - 2.2, yb, yb + ch, cz - d / 2 + 2.6, cz + d / 2 - 2.6));
      const ye = yb + ch + 0.28;
      b.add(UB, mar, boxM(cx - w / 2, cx + w / 2, ye, ye + 0.55, cz - d / 2, cz + d / 2));                              // architrave
      b.add(UB, lam("mgFrieze", () => ({ color: "#5a6f8f" })), boxM(cx - w / 2 + 0.05, cx + w / 2 - 0.05, ye + 0.55, ye + 1.1, cz - d / 2 + 0.05, cz + d / 2 - 0.05));
      b.add(UB, mar, boxM(cx - w / 2 - 0.2, cx + w / 2 + 0.2, ye + 1.1, ye + 1.35, cz - d / 2 - 0.2, cz + d / 2 + 0.2));  // cornice
      const yr = ye + 1.35, rh = d * 0.22, tm = tileMat(0);
      // ridge along x (the long axis): slopes face north / south, pediments at the east + west ends
      b.add(quad(V(cx - w / 2 - 0.3, yr, cz + d / 2 + 0.3), V(cx + w / 2 + 0.3, yr, cz + d / 2 + 0.3), V(cx + w / 2 + 0.3, yr + rh, cz), V(cx - w / 2 - 0.3, yr + rh, cz), w / 4, d / 8), tm);
      b.add(quad(V(cx + w / 2 + 0.3, yr, cz - d / 2 - 0.3), V(cx - w / 2 - 0.3, yr, cz - d / 2 - 0.3), V(cx - w / 2 - 0.3, yr + rh, cz), V(cx + w / 2 + 0.3, yr + rh, cz), w / 4, d / 8), tm);
      for (const s of [-1, 1]) b.add(tri(V(cx + s * (w / 2 + 0.05), yr, cz + s * (d / 2 + 0.2)), V(cx + s * (w / 2 + 0.05), yr, cz - s * (d / 2 + 0.2)), V(cx + s * (w / 2 + 0.05), yr + rh, cz)), mar);
    };
    temple(HILLS[0].x, HILLS[0].z, 24, 12, 11, 6, 5.4);
    temple(HILLS[1].x, HILLS[1].z, 12, 7, 6, 4, 3.8);
    b.build(this.group);
    // cypresses round the sanctuaries
    const cyp = mergeGeometries([0, 1, 2, 3].map((k) => new THREE.SphereGeometry(1, 12, 9).scale(0.9 - k * 0.17, 1.3, 0.9 - k * 0.17).translate(0, 1.4 + k * 1.5, 0)), false);
    const cb = new Batch(), r = rng(91);
    for (const H of HILLS) for (let k = 0; k < 7; k++) {
      const a = r() * TAU, q = H.top + 0.06 + r() * 0.15, x = H.x + Math.cos(a) * H.rx * q, z = H.z + Math.sin(a) * H.rz * q, s = 0.9 + r() * 0.5;
      if (inTheWay(x - 1.2, x + 1.2, 0, 8, z - 1.2, z + 1.2)) continue;
      cb.add(cyp, MAT.cypress(), M4(x, hillY(x, z) - 0.3, z, 0, s));
    }
    cb.build(this.group);
  }

  // ---------------------------------------------------------------------------------------------- the pig pen
  private buildPen() {
    const { x0, x1, z0, z1 } = PEN, Hh = 0.82, T2 = 0.25, r = rng(41), gz0 = PEN_GAP[2] - 0.8, gz1 = PEN_GAP[2] + 0.8;
    const ds = new GB(1.5, (x, y, z) => 0.9 + 0.1 * Math.sin(x * 3.1 + z * 2.3 + y * 5), 1, 1);
    const seg = (ax0: number, ax1: number, az0: number, az1: number) => ds.box(ax0, ax1, 0, Hh, az0, az1, "snewt");
    seg(x0 - T2, x1 + T2, z0 - T2, z0 + T2);                 // north
    seg(x0 - T2, x1 + T2, z1 - T2, z1 + T2);                 // south (against the city wall)
    seg(x1 - T2, x1 + T2, z0 + T2, z1 - T2);                 // east
    seg(x0 - T2, x0 + T2, z0 + T2, gz0);                     // west, north of the gap
    seg(x0 - T2, x0 + T2, gz1, z1 - T2);                     // west, south of the gap
    ds.mesh(MAT.dry(), this.group);
    // capstones: chunky stones along the top (real facets for the ink)
    const sg = stoneGeo(5), caps: THREE.Matrix4[] = [];
    const along = (ax: number, az: number, bx: number, bz: number) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 0.42));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
        caps.push(new THREE.Matrix4().compose(V(x, Hh + 0.04, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.3, Math.atan2(bx - ax, bz - az) + r() * 0.5, r() * 0.3)), V(0.2 + r() * 0.05, 0.1 + r() * 0.05, 0.24 + r() * 0.06)));
      }
    };
    along(x0, z0, x1, z0); along(x0, z1, x1, z1); along(x1, z0 + 0.3, x1, z1 - 0.3); along(x0, z0 + 0.3, x0, gz0 - 0.1); along(x0, gz1 + 0.1, x0, z1 - 0.3);
    const cim = new THREE.InstancedMesh(sg, MAT.cap(), caps.length);
    caps.forEach((m, i) => cim.setMatrixAt(i, m)); cim.castShadow = cim.receiveShadow = true; cim.frustumCulled = false; this.group.add(cim);
    const b = new Batch();
    // gap posts + the wattle hurdle (the pen gate) leaning open against the east wall outside
    for (const z of [gz0 - 0.12, gz1 + 0.12]) b.add(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 8).translate(0, 0.575, 0), MAT.beam(), new THREE.Matrix4().makeTranslation(x0, 0, z));
    const hurdle = new THREE.Matrix4().compose(V(x1 + 0.62, 0.02, (z0 + z1) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0))), V(1, 1, 1));
    for (let k = 0; k < 8; k++) b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6).translate(0, 0.52, 0), MAT.beam(), hurdle.clone().multiply(new THREE.Matrix4().makeTranslation(-0.95 + k * 0.27, 0, 0)));
    for (let k = 0; k < 5; k++) b.add(UB, MAT.wood(), hurdle.clone().multiply(boxM(-1.0, 1.0, 0.15 + k * 0.18, 0.25 + k * 0.18, -0.03, 0.03)));
    // the mud floor, puddles, a mud tongue out of the gap
    b.add(new THREE.PlaneGeometry(x1 - x0 - 2 * T2, z1 - z0 - 2 * T2).rotateX(-Math.PI / 2), MAT.mud(), new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.05, (z0 + z1) / 2));
    b.add(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), MAT.mud(), new THREE.Matrix4().compose(V(x0 - 0.9, 0.05, PEN_GAP[2]), new THREE.Quaternion(), V(1.3, 1, 0.8)));
    for (const [u, v, sx, sz] of [[0.3, 0.75, 0.9, 0.55], [0.75, 0.25, 0.7, 0.45], [0.55, 0.5, 0.45, 0.3]] as const)
      b.add(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), wetMat(), new THREE.Matrix4().compose(V(lerp(x0 + 0.6, x1 - 0.6, u), 0.07, lerp(z0 + 0.6, z1 - 0.6, v)), new THREE.Quaternion(), V(sx, 1, sz)));
    b.add(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), wetMat(), new THREE.Matrix4().compose(V(x0 - 1.0, 0.07, PEN_GAP[2] + 0.1), new THREE.Quaternion(), V(0.5, 1, 0.35)));
    // the trough (along the east wall inside): two sides, two ends, a bottom, dark slop inside
    const tx0 = x1 - 0.85, tx1 = x1 - 0.28, tz0 = (z0 + z1) / 2 - 1.3, tz1 = (z0 + z1) / 2 + 1.2, th = 0.38;
    b.add(UB, MAT.wood(), boxM(tx0, tx1, 0, 0.08, tz0, tz1));
    for (const [a0, a1] of [[tx0, tx0 + 0.07], [tx1 - 0.07, tx1]] as const) b.add(UB, MAT.wood(), boxM(a0, a1, 0, th, tz0, tz1));
    for (const [c0, c1] of [[tz0, tz0 + 0.08], [tz1 - 0.08, tz1]] as const) b.add(UB, MAT.wood(), boxM(tx0 - 0.04, tx1 + 0.04, 0, th + 0.03, c0, c1));
    b.add(UB, wetMat(), boxM(tx0 + 0.07, tx1 - 0.07, 0.08, 0.26, tz0 + 0.08, tz1 - 0.08));
    // straw: a heap in the south-east corner inside, bales outside the north-east corner (x >= 13)
    const lump = new THREE.SphereGeometry(1, 12, 8);
    for (const [px, pz, s] of [[x1 - 0.65, z1 - 0.65, 0.55], [x1 - 1.3, z1 - 0.55, 0.42], [x1 - 0.55, z1 - 1.4, 0.4]] as const) b.add(lump, MAT.straw(), new THREE.Matrix4().compose(V(px, 0, pz), new THREE.Quaternion(), V(s * 1.2, s * 0.6, s)));
    for (const [px, py, pz] of [[13.6, 0.3, z0 + 0.4], [13.6, 0.3, z0 - 0.6], [13.65, 0.9, z0 - 0.1]] as const) b.add(UB, MAT.straw(), M4(px, py, pz, 0.05, 1).multiply(new THREE.Matrix4().makeScale(0.9, 0.6, 1.0)));
    b.build(this.group);
  }

  // ---------------------------------------------------------------------------------------------- the pitch cauldron
  private buildCauldron() {
    const [cx, , cz] = CAULDRON, b = new Batch(), r = rng(57);
    const sg = [stoneGeo(11), stoneGeo(12), stoneGeo(13)];
    for (let k = 0; k < 11; k++) {          // ring of hearth stones
      const a = (k / 11) * TAU + 0.2, x = cx + Math.cos(a) * 0.66, z = cz + Math.sin(a) * 0.66;
      b.add(sg[k % 3], MAT.hearth(), new THREE.Matrix4().compose(V(x, 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), V(0.2, 0.15, 0.17)));
    }
    for (let k = 0; k < 3; k++) b.add(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 7).rotateZ(Math.PI / 2), MAT.char(), M4(cx, 0.07, cz, (k * Math.PI) / 3 + 0.3));
    // the pot: lathe (outer belly, rim lip, inner wall down to the pitch), rim at 0.96 m
    const prof: [number, number][] = [[0, 0.1], [0.26, 0.12], [0.44, 0.22], [0.55, 0.4], [0.57, 0.6], [0.53, 0.8], [0.52, 0.88], [0.58, 0.91], [0.59, 0.96], [0.5, 0.97], [0.47, 0.9], [0.46, 0.82]];
    b.add(new THREE.LatheGeometry(prof.map(([a, c]) => new THREE.Vector2(a, c)), 28), MAT.pot(), new THREE.Matrix4().makeTranslation(cx, 0, cz));
    for (const a of [0.4, 2.5, 4.6]) b.add(new THREE.SphereGeometry(0.07, 8, 6), MAT.pot(), new THREE.Matrix4().makeTranslation(cx + Math.cos(a) * 0.57, 0.66, cz + Math.sin(a) * 0.57)); // lugs
    const pm = pitchMat();
    b.add(new THREE.CircleGeometry(0.465, 28).rotateX(-Math.PI / 2), pm, new THREE.Matrix4().makeTranslation(cx, 0.84, cz));
    for (const [dx, dz, s] of [[0.12, 0.05, 0.06], [-0.18, 0.1, 0.045], [0.02, -0.2, 0.05]] as const) b.add(new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2), pm, new THREE.Matrix4().compose(V(cx + dx, 0.835, cz + dz), new THREE.Quaternion(), V(s, s * 0.6, s)));
    for (const a of [0.9, 3.4, 5.2]) b.add(new THREE.CapsuleGeometry(0.03, 0.18, 3, 6), pm, new THREE.Matrix4().makeTranslation(cx + Math.cos(a) * 0.59, 0.82, cz + Math.sin(a) * 0.59));   // drips
    // the long-handled brush leaning on the rim: foot on the ground to the south (toward the gate, away from the
    // inside camera), head black with pitch over the rim
    const foot = V(cx - 0.2, 0, cz + 1.45), top = V(cx - 0.08, 0.97, cz + 0.52), dir = top.clone().sub(foot), Lh = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    b.add(new THREE.CylinderGeometry(0.028, 0.032, Lh, 8).translate(0, Lh / 2, 0), MAT.beam(), new THREE.Matrix4().compose(foot, q, V(1, 1, 1)));
    b.add(new THREE.BoxGeometry(1, 1, 1), MAT.beam(), new THREE.Matrix4().compose(top.clone().addScaledVector(dir.normalize(), 0.02), q, V(0.2, 0.06, 0.07)));          // brush back
    b.add(new THREE.CapsuleGeometry(0.5, 1, 3, 8), pm, new THREE.Matrix4().compose(top.clone().addScaledVector(dir, 0.1), q, V(0.11, 0.14, 0.11)));     // pitch-soaked bristles
    b.build(this.group);
    const eg = mergeGeometries(Array.from({ length: 9 }, (_, k) => {        // embers between the stones (HDR)
      const a = (k / 9) * TAU + r(), d = 0.15 + r() * 0.3;
      return new THREE.IcosahedronGeometry(0.04 + r() * 0.03, 0).translate(cx + Math.cos(a) * d, 0.04, cz + Math.sin(a) * d);
    }), false);
    const em = new THREE.Mesh(eg, this.emberMat); em.layers.set(NOINK); this.group.add(em);
  }

  // ---------------------------------------------------------------------------------------------- the torch brazier
  private buildBrazier() {
    const [bx, , bz] = BRAZIER, b = new Batch(), H = 1.15;
    for (let k = 0; k < 3; k++) {          // tripod legs + feet
      const a = (k / 3) * TAU + 0.5, foot = V(bx + Math.cos(a) * 0.5, 0, bz + Math.sin(a) * 0.5), top = V(bx + Math.cos(a) * 0.2, H - 0.12, bz + Math.sin(a) * 0.2);
      const d = top.clone().sub(foot), L = d.length();
      b.add(new THREE.CylinderGeometry(0.03, 0.035, L, 8).translate(0, L / 2, 0), MAT.iron(), new THREE.Matrix4().compose(foot, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
      b.add(new THREE.SphereGeometry(0.06, 8, 6), MAT.iron(), new THREE.Matrix4().makeTranslation(foot.x, 0.04, foot.z));
    }
    b.add(new THREE.TorusGeometry(0.22, 0.025, 6, 16).rotateX(Math.PI / 2), MAT.iron(), new THREE.Matrix4().makeTranslation(bx, H - 0.35, bz));
    b.add(new THREE.LatheGeometry([[0, H - 0.2], [0.18, H - 0.17], [0.32, H - 0.06], [0.4, H + 0.06], [0.43, H + 0.08], [0.41, H + 0.1], [0.36, H + 0.02]].map(([a, c]) => new THREE.Vector2(a, c)), 20), MAT.iron(), new THREE.Matrix4().makeTranslation(bx, 0, bz));
    b.build(this.group);
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.25, 1), this.coalMat);
    coal.position.set(bx, H + 0.01, bz); coal.layers.set(NOINK); this.group.add(coal);
    const fg = flameGeo(), outer = HDR(5.0, 1.7, 0.32), core = HDR(6.5, 4.6, 1.6);   // flames (flicker in update)
    const add = (m: THREE.Material, dx: number, dz: number, s: number, k: number) => {
      const mesh = new THREE.Mesh(fg, m); mesh.layers.set(NOINK); this.group.add(mesh);
      this.flames.push({ m: mesh, k, s, base: V(bx + dx, H + 0.03, bz + dz) });
    };
    add(outer, 0.1, 0.04, 0.95, 0); add(outer, -0.11, 0.07, 0.8, 1); add(outer, 0.02, -0.12, 0.85, 2); add(outer, -0.04, 0.0, 1.15, 3);
    add(core, 0.02, 0.02, 0.6, 4);
  }

  // ---------------------------------------------------------------------------------------------- the plain
  private buildPlain() {
    const r = rng(83), U = (a: number, c: number) => a + (c - a) * r();
    const clearZone = (x: number, z: number, m = 0) => x > -36 - m && x < 36 + m && z > 2 && z < 165;
    // ---- olive trees: 3 templates (gnarled trunk + lumpy silver-green canopy), instanced
    const tmpl = [0, 1, 2].map((k) => {
      const rr2 = rng(300 + k), trunk: THREE.BufferGeometry[] = [], canopy: THREE.BufferGeometry[] = [];
      let p = V(0, 0, 0), rad = 0.34;
      for (let s = 0; s < 4; s++) {
        const nxt = p.clone().add(V((rr2() - 0.5) * 0.7, 0.36, (rr2() - 0.5) * 0.7)), d = nxt.clone().sub(p), L = d.length();
        trunk.push(new THREE.CylinderGeometry(rad * 0.82, rad, L * 1.08, 9).translate(0, L / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())).translate(p.x, p.y, p.z));
        p = nxt; rad *= 0.86;
      }
      for (let br = 0; br < 3; br++) {
        const a = (br / 3) * TAU + rr2(), e = p.clone().add(V(Math.cos(a) * 0.9, 0.7 + rr2() * 0.3, Math.sin(a) * 0.9)), d = e.clone().sub(p), L = d.length();
        trunk.push(new THREE.CylinderGeometry(0.08, 0.15, L, 7).translate(0, L / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())).translate(p.x, p.y, p.z));
      }
      const top = p.y + 0.9;
      canopy.push(new THREE.SphereGeometry(1, 16, 11).scale(1.7, 1.25, 1.7).translate(0, top + 0.5, 0));
      for (let l = 0; l < 7; l++) {
        const a = (l / 7) * TAU + rr2() * 0.6, d = 1.3 + rr2() * 0.35, s = 0.9 + rr2() * 0.35;
        canopy.push(new THREE.SphereGeometry(1, 14, 10).scale(s * 1.05, s * 0.9, s * 1.05).translate(Math.cos(a) * d, top + rr2() * 0.6 - (l % 2) * 0.35, Math.sin(a) * d));
      }
      canopy.push(new THREE.SphereGeometry(1, 14, 10).scale(1.1, 0.9, 1.1).translate(0.3, top + 1.5, -0.2));
      return { trunk: mergeGeometries(trunk.map((g) => g.toNonIndexed()), false), canopy: mergeGeometries(canopy.map((g) => g.toNonIndexed()), false), h: top + 1.2 };
    });
    const trees: { x: number; z: number; s: number; yaw: number; k: number }[] = [];
    const tryTree = (x: number, z: number, s: number) => {
      if (clearZone(x, z, 2) || Math.abs(x - roadX(z)) < 7) return;
      if (z < 3 && z > NZ - 4 && Math.abs(x) < WX + 4) return;                        // inside / on the walls
      if (coastD(x, z) > -15) return;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 5.5)) return;
      const k = Math.floor(r() * 3), rad = 2.6 * s, h = tmpl[k].h * s;
      if (inTheWay(x - rad, x + rad, 0, h, z - rad, z + rad)) { this.blocked.push(`olive(${x.toFixed(0)},${z.toFixed(0)})`); return; }
      trees.push({ x, z, s, yaw: r() * TAU, k });
    };
    for (const [gx, gz, nx, nz] of [[44, 14, 6, 7], [-78, 20, 5, 6], [52, 96, 5, 5], [-64, 120, 6, 4], [96, 40, 4, 6], [-120, 60, 4, 5]] as const)
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (r() < 0.82) tryTree(gx + i * 7.5 + U(-1.2, 1.2), gz + j * 7.5 + U(-1.2, 1.2), U(0.8, 1.15));
    for (let i = 0; i < 160; i++) { const a = U(0, TAU), d = U(30, 320); tryTree(Math.cos(a) * d, Math.abs(Math.sin(a)) * d * (r() < 0.8 ? 1 : -1) + 4, U(0.75, 1.25)); }
    for (let k = 0; k < 3; k++) {
      const list = trees.filter((t) => t.k === k), n = Math.max(1, list.length);
      const it = new THREE.InstancedMesh(tmpl[k].trunk, MAT.bark(), n), ic = new THREE.InstancedMesh(tmpl[k].canopy, lam("mgOliveM" + k, () => ({ map: P.oliveTex(k) })), n);
      list.forEach((t, i) => { const m = M4(t.x, groundY(t.x, t.z) - 0.1, t.z, t.yaw, t.s); it.setMatrixAt(i, m); ic.setMatrixAt(i, m); });
      it.count = ic.count = list.length;
      for (const im of [it, ic]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); }
    }
    // ---- rocks (outside the elephant ground)
    const rockG = [stoneGeo(21, 1), stoneGeo(22, 1), stoneGeo(23, 0)], rocks: THREE.Matrix4[][] = [[], [], []];
    for (let i = 0; i < 140; i++) {
      const a = U(0, TAU), d = U(20, 260), x = Math.cos(a) * d, z = Math.abs(Math.sin(a)) * d + 3;
      if (clearZone(x, z, 1) || Math.abs(x - roadX(z)) < 4.5 || coastD(x, z) > -10) continue;
      const s = U(0.3, 1.4) * (r() < 0.1 ? 2.2 : 1);
      if (inTheWay(x - s, x + s, 0, s, z - s, z + s, true)) continue;
      rocks[i % 3].push(new THREE.Matrix4().compose(V(x, -0.25 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), V(s * U(1, 1.5), s * U(0.5, 0.8), s * U(0.9, 1.3))));
    }
    rocks.forEach((L, k) => { const im = new THREE.InstancedMesh(rockG[k], MAT.rock(), Math.max(1, L.length)); L.forEach((m, i) => im.setMatrixAt(i, m)); im.count = L.length; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); });
    // ---- dry grass tufts (NOINK blade clusters, golden -> olive per instance), dense near the gate + road
    const blades: number[] = [], nrm: number[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + 0.3, lean = 0.25 + 0.2 * Math.sin(k * 2.1), hh = 0.7 + 0.3 * Math.cos(k * 1.7), bw = 0.05;
      const bx = Math.cos(a) * 0.06, bz = Math.sin(a) * 0.06, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean, px = -Math.sin(a) * bw, pz = Math.cos(a) * bw;
      blades.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, hh, tz);
      for (let v = 0; v < 3; v++) nrm.push(0, 1, 0);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(blades, 3)); tg.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    tg.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((blades.length / 3) * 2).fill(0), 2));
    const tm = lam("mgTuft", () => ({ color: "#ffffff", side: THREE.DoubleSide }));
    const tufts: { m: THREE.Matrix4; c: THREE.Color }[] = [], TC = ["#c9a457", "#b48f45", "#d8b86a", "#9c8f4a", "#c0a050"];
    for (let i = 0; i < 9000; i++) {
      const near = i < 5000, x = near ? U(-60, 60) : U(-220, 220), z = near ? U(-2, 90) : U(-40, 260);
      if (Math.abs(x - roadX(z)) < 4.3) continue;
      if (z < 3 && z > NZ - 3 && Math.abs(x) < WX + 1 && !(z > 0.4)) continue;   // inside the walls: none (the wall foot only)
      if (coastD(x, z) > -12) continue;
      if (TOWERS_X.some((c) => Math.abs(x - c) < TW_HALF + 0.6 && z < TW_Z1 + 0.6)) continue;
      const s = U(0.35, 0.75) * (r() < 0.12 ? 1.5 : 1);
      tufts.push({ m: M4(x, groundY(x, z) - 0.02, z, U(0, TAU), s, s * U(0.8, 1.2), s), c: new THREE.Color(TC[Math.floor(r() * TC.length)]) });
    }
    const tim = new THREE.InstancedMesh(tg, tm, tufts.length);
    tufts.forEach((t, i) => { tim.setMatrixAt(i, t.m); tim.setColorAt(i, t.c); });
    tim.layers.set(NOINK); tim.frustumCulled = false; tim.receiveShadow = true; this.group.add(tim);
  }

  // ---------------------------------------------------------------------------------------------- hills + sea
  private buildFar() {
    const b = new Batch();
    const hill = new THREE.SphereGeometry(1, 40, 14, 0, TAU, 0, Math.PI / 2);
    // the Gerania range to the north-west, lower ridges north / north-east, the hills of the Megarid west
    for (const [x, z, sx, sy, sz] of [[-420, -380, 260, 80, 160], [-180, -520, 240, 62, 140], [-640, -120, 220, 70, 200], [80, -560, 260, 44, 130], [340, -470, 220, 50, 140],
      [-560, 200, 200, 40, 160], [620, -220, 180, 36, 150]] as const)
      b.add(hill, MAT.hill(), new THREE.Matrix4().compose(V(x, -3, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), x * 0.001), V(sx, sy, sz)));
    b.build(this.group, false);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2), MAT.sea());
    sea.position.set(700, -1.4, 1300); sea.layers.set(NOINK); this.group.add(sea);
  }

  // ================================================================================================ per frame
  update(sid: number, f: number, _cam: THREE.PerspectiveCamera) {
    const S = SHOTS[sid - 1];
    this.group.visible = S.set === "megara";
    if (!this.group.visible) { this.glow.col.set(0, 0, 0); this.glow.r = 0; return; }
    const st = storyF(sid, f);
    const deg = THREE.MathUtils.degToRad(doorDeg(st));
    for (const d of this.doors) d.rotation.y = -(d.userData.s as number) * deg;
    for (const fl of this.flames) {          // flames: smooth flicker (pure in st)
      const k = fl.k, a = 1 + 0.16 * Math.sin(st * 0.93 + k * 1.7) + 0.09 * Math.sin(st * 2.37 + k * 2.9) + 0.05 * Math.sin(st * 5.1 + k);
      fl.m.position.set(fl.base.x + 0.03 * Math.sin(st * 0.71 + k), fl.base.y, fl.base.z + 0.03 * Math.cos(st * 0.83 + k * 2));
      fl.m.scale.set(0.2 * fl.s * (1.05 - 0.1 * (a - 1)), 0.62 * fl.s * a, 0.2 * fl.s);
      fl.m.rotation.set(0.12 * Math.sin(st * 0.6 + k), st * 0.05 + k, 0.12 * Math.cos(st * 0.55 + k * 1.3));
    }
    const fk = 1 + 0.1 * Math.sin(st * 0.9) + 0.06 * Math.sin(st * 2.3 + 1) + 0.03 * Math.sin(st * 4.9 + 2);
    this.emberMat.color.setRGB(3.4 * fk, 1.0 * fk, 0.18);
    this.coalMat.color.setRGB(4.2 * fk, 1.5 * fk, 0.3);
    // the glow: the brazier while the camera is inside (shot 5), then the burning queue (from F_IGNITE 668), then it
    // rides out with the hero pig through the gate and fades as the pitch burns off (~940-992)
    const w = rampF(st, 668, 684), out = rampF(st, 738, 764), fade = 1 - rampF(st, 940, 992);
    const p0 = pigMegara(HERO_PIG, st).pos;
    const qx = lerp(0, p0[0], out), qy = lerp(0.8, 0.9, out), qz = lerp(-10, p0[2] + 0.3, out);
    const bOn = sid === 5 ? 1 : 0, bx = BRAZIER[0], by = 1.6, bz = BRAZIER[2];
    if (w <= 0) {
      this.glow.pos.set(bx, by, bz); this.glow.col.set(1.5 * fk, 0.72 * fk, 0.24 * fk).multiplyScalar(bOn); this.glow.r = 4.5;
    } else {
      const cb = (1 - w) * bOn;
      this.glow.pos.set(lerp(bx, qx, w), lerp(by, qy, w), lerp(bz, qz, w));
      this.glow.col.set((2.2 * w * fade + 1.5 * cb) * fk, (1.0 * w * fade + 0.72 * cb) * fk, (0.35 * w * fade + 0.24 * cb) * fk);
      this.glow.r = lerp(4.5, 9, w);
    }
    if (this.glow.col.x + this.glow.col.y + this.glow.col.z < 1e-4) this.glow.r = 0;
  }
}
