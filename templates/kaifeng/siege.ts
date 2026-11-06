// SIEGE RIG (owner: the "wall" agent): the city of Kaifeng: its rammed-earth wall (pounded layers, putlog holes,
// dents, crenellated parapet, walkway, ramps), the east gate (passage, timber frames, studded doors opening inward,
// 2-storey gate tower), the wooden towers (TOWER_SMASH shatters, TOWER_HERO gets dung / straw / felt), the corner
// towers, the city inside (houses, palace, trees, the courtyard with the empty jars), the defenders' traction
// trebuchet + the Taihu garden rock, the boom + chain + iron bomb, the rubble heap, the loess plain, night torches.
// Built once (merged batches + instanced repeats); update(sid, f) only sets transforms / visibility / instances.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, Ray, V, lam, Batch, setSight, inTheWay, prop, Strand, quad, tri } from "./build";
import { NOINK } from "./ink";
import { twoTone } from "./shade";
import { rng } from "./paint";
import * as P from "./paintw";
import {
  SHOTS, HALF, WALL_H, BATTER, WALL_BASE_T, PARAPET_H, outerX, GATE_W, GATE_HGT, TOWER_SMASH, TOWER_HERO, DEF_TB, BOMB_Z,
  FOOD_AT, HEAP, PROJ, projAt, pockK, heapK, towerSmashK, dungK, strawK, feltK, DEF_FIRE, beamK, chainK, BOOM_F, gateK,
  TENTS, POKE_DENT, BOMB_TIP, bombAt, hash, smooth, clamp01, type V3,
} from "./story";

// ================================================================================================ layout helpers
const TAU = Math.PI * 2;
const PHI = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];           // side k: 0 E, 1 N, 2 W, 3 S (rotations of the east side)
/** side-local (r = outward distance, y, a = along) -> world, for side k */
const sideW = (k: number, r: number, y: number, a: number): V3 => {
  const c = Math.cos(PHI[k]), s = Math.sin(PHI[k]);
  return [r * c + a * s, y, -r * s + a * c];
};
const sideM = (k: number) => new THREE.Matrix4().makeRotationY(PHI[k]);
const innerX = (y: number) => HALF - WALL_BASE_T + BATTER * Math.max(0, Math.min(WALL_H, y));   // 47 -> 50
const TOP_O = outerX(WALL_H);              // 57: outer edge of the walkway
const PAR_T = 0.6, PAR_IN = TOP_O - PAR_T;  // parapet r 56.4..57
const SILL = 0.8;                           // crenel sill height above the walkway
const WALK_C = (innerX(WALL_H) + PAR_IN) / 2; // 53.2 walkway centre line
const TW = P.WALL_TILE;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
const UB = new THREE.BoxGeometry(1, 1, 1);
const boxM = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0));
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** raw triangle soup builder: positions / flat normals / uvs / colours, optional point transform */
class GB {
  p: number[] = []; n: number[] = []; u: number[] = []; c: number[] = [];
  tf: (v: V3) => V3 = (v) => v; tn: (v: V3) => V3 = (v) => v;
  quad(v: V3[], uv: [number, number][], face: V3, col: number[] = [1, 1, 1, 1]) {
    const cr = cross(sub(v[1], v[0]), sub(v[3], v[0])), ord = dot(cr, face) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const nn = this.tn(nrm(face));
    for (const i of ord) {
      const w = this.tf(v[i]);
      this.p.push(...w); this.n.push(...nn); this.u.push(...uv[i]); this.c.push(col[i], col[i], col[i]);
    }
  }
  geo(colours = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.u, 2));
    if (colours) g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
  side(k: number) {
    const c = Math.cos(PHI[k]), s = Math.sin(PHI[k]);
    this.tf = (v) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    this.tn = this.tf;
  }
}
/** box in side-local coords (r, y, a) with world-consistent uvs (tile t), 5 faces (no bottom) */
const boxL = (gb: GB, r0: number, r1: number, y0: number, y1: number, a0: number, a1: number, t = TW, bottom = false, col?: (y: number) => number) => {
  const cc = (y: number) => (col ? col(y) : 1);
  const C = (ys: number[]) => ys.map(cc);
  gb.quad([[r1, y0, a0], [r1, y0, a1], [r1, y1, a1], [r1, y1, a0]], [[a0 / t, y0 / t], [a1 / t, y0 / t], [a1 / t, y1 / t], [a0 / t, y1 / t]], [1, 0, 0], C([y0, y0, y1, y1]));
  gb.quad([[r0, y0, a0], [r0, y0, a1], [r0, y1, a1], [r0, y1, a0]], [[a0 / t, y0 / t], [a1 / t, y0 / t], [a1 / t, y1 / t], [a0 / t, y1 / t]], [-1, 0, 0], C([y0, y0, y1, y1]));
  gb.quad([[r0, y0, a1], [r1, y0, a1], [r1, y1, a1], [r0, y1, a1]], [[r0 / t, y0 / t], [r1 / t, y0 / t], [r1 / t, y1 / t], [r0 / t, y1 / t]], [0, 0, 1], C([y0, y0, y1, y1]));
  gb.quad([[r0, y0, a0], [r1, y0, a0], [r1, y1, a0], [r0, y1, a0]], [[r0 / t, y0 / t], [r1 / t, y0 / t], [r1 / t, y1 / t], [r0 / t, y1 / t]], [0, 0, -1], C([y0, y0, y1, y1]));
  gb.quad([[r0, y1, a0], [r1, y1, a0], [r1, y1, a1], [r0, y1, a1]], [[r0 / t, a0 / t], [r1 / t, a0 / t], [r1 / t, a1 / t], [r0 / t, a1 / t]], [0, 1, 0], C([y1, y1, y1, y1]));
  if (bottom) gb.quad([[r0, y0, a0], [r1, y0, a0], [r1, y0, a1], [r0, y0, a1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
};

// ================================================================================================ materials
const MAT = {
  wall: () => lam("kfWall", () => ({ map: P.earthWallHD(), vertexColors: true })),
  walk: () => lam("kfWalk", () => ({ map: P.walkHD() })),
  ground: () => lam("kfGround", () => ({ map: P.loessHD(), vertexColors: true })),
  rut: () => lam("kfRut", () => ({ color: "#8f7655", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  rubble: () => lam("kfRubble", () => ({ map: P.rubbleHD() })),
  rock: () => lam("kfRock", () => ({ color: "#8b8881" })),
  mill: () => lam("kfMill", () => ({ color: "#c2bcb0" })),
  dent: () => lam("kfDent", () => ({ map: P.dentHD() })),
  tile: () => lam("kfTile", () => ({ map: P.tileRoofHD() })),
  ridge: () => lam("kfRidge", () => ({ color: "#5d6168" })),
  fascia: () => lam("kfFascia", () => ({ color: "#6b3a28" })),
  soffit: () => lam("kfSoffit", () => ({ color: "#6e4630" })),
  red: () => lam("kfRed", () => ({ map: P.redWoodHD() })),
  plank: () => lam("kfPlank", () => ({ map: P.plankHD("kfPlankT", "#a27a52") })),
  slits: () => lam("kfSlits", () => ({ map: P.plankHD("kfSlitT", "#a27a52", true) })),
  beam: () => lam("kfBeam", () => ({ color: "#6e4a32" })),
  door: () => lam("kfDoor", () => ({ map: P.doorHD() })),
  stud: () => lam("kfStud", () => ({ color: "#d2a64c" })),
  iron: () => lam("kfIron", () => ({ color: "#45454b" })),
  stone: () => lam("kfStone", () => ({ color: "#a69f93" })),
  palW: () => lam("kfPalW", () => ({ map: P.palaceWallHD() })),
  felt0: () => lam("kfFelt0", () => ({ map: P.feltHD("kfFeltC", "#ece2c8", "#b8885a"), side: THREE.DoubleSide })),
  felt1: () => lam("kfFelt1", () => ({ map: P.feltHD("kfFeltG", "#a9a69e", "#5f6670"), side: THREE.DoubleSide })),
  straw: () => lam("kfStraw", () => ({ map: P.strawHD() })),
  dung: () => lam("kfDung", () => ({ map: P.dungHD() })),
  taihu: () => lam("kfTaihu", () => ({ map: P.taihuHD(), vertexColors: true, color: "#d8d8d4" })),
  jar: () => lam("kfJar", () => ({ map: P.jarHD(), vertexColors: true })),
  lid: () => lam("kfLid", () => ({ color: "#8a5a38" })),
  sack: () => lam("kfSack", () => ({ map: P.sackHD() })),
  broom: () => lam("kfBroom", () => ({ color: "#c8a35e" })),
  rope: () => lam("kfRope", () => ({ color: "#b39a68" })),
  bomb: () => lam("kfBomb", () => ({ color: "#3b3d44" })),
  torch: () => lam("kfTorch", () => ({ color: "#4a3426" })),
};
const PLASTER = [
  { wall: "#e7dfcf", key: "w" }, { wall: "#ddc9a1", key: "c" }, { wall: "#cfae7c", key: "o" },
];
const plasterMat = (i: number, door: boolean) => lam(`kfPl${i}${door ? "d" : "w"}`, () => ({ map: P.plasterHD(`kfPlT${i}${door ? "d" : "w"}`, PLASTER[i].wall, door) }));

// ================================================================================================ roofs
/** Chinese hip / pent roof (local: centre 0, eave at y = 0): rings from the eave rectangle (hw x hd) to the top
 *  rectangle (thw x thd; thd = 0 -> a ridge), concave profile (flat eaves, steep top), corners lifted by `curl`.
 *  Returns tiles (per-side strips, sharp hips), fascia (eave thickness) and soffit (under the eaves, to `inset`). */
const roofGeo = (hw: number, hd: number, H: number, thw: number, thd: number, curl: number, inset = 0.6, fas = 0.2) => {
  const SS = [0, 0.1, 0.24, 0.42, 0.62, 0.82, 1], N = 10, tiles: THREE.BufferGeometry[] = [];
  const pt = (q: number, t: number, a: number, b: number): [number, number] =>
    q === 0 ? [-a + 2 * a * t, -b] : q === 1 ? [a, -b + 2 * b * t] : q === 2 ? [a - 2 * a * t, b] : [-a, b - 2 * b * t];
  const lift = (t: number, s: number) => curl * (2 * t - 1) ** 4 * (1 - s) ** 2;
  const fasG = new GB(), sofG = new GB();
  for (let q = 0; q < 4; q++) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const slope = Math.hypot(q % 2 ? hw - thw : hd - thd, H);
    for (let j = 0; j < SS.length; j++) {
      const s = SS[j], a = lerp(hw, thw, s), b = lerp(hd, thd, s), y = H * s ** 1.6;
      for (let i = 0; i <= N; i++) {
        const t = i / N, [x, z] = pt(q, t, a, b);
        pos.push(x, y + lift(t, s), z);
        uv.push((q % 2 ? z : x) / P.TILE_W, (s * slope) / P.TILE_W);
      }
    }
    for (let j = 0; j < SS.length - 1; j++) for (let i = 0; i < N; i++) {
      const v0 = j * (N + 1) + i, v1 = v0 + 1, w0 = v0 + N + 1, w1 = w0 + 1;
      idx.push(v0, w0, v1, v1, w0, w1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    tiles.push(g.toNonIndexed());
    // fascia + soffit along this side's eave
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, [x0, z0] = pt(q, t0, hw, hd), [x1, z1] = pt(q, t1, hw, hd);
      const y0 = lift(t0, 0), y1 = lift(t1, 0), out: V3 = q === 0 ? [0, 0, -1] : q === 1 ? [1, 0, 0] : q === 2 ? [0, 0, 1] : [-1, 0, 0];
      fasG.quad([[x0, y0, z0], [x1, y1, z1], [x1, y1 - fas, z1], [x0, y0 - fas, z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], out);
      const [ix0, iz0] = pt(q, t0, hw - inset, hd - inset), [ix1, iz1] = pt(q, t1, hw - inset, hd - inset);
      sofG.quad([[x0, y0 - fas, z0], [x1, y1 - fas, z1], [ix1, -fas - 0.05, iz1], [ix0, -fas - 0.05, iz0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
    }
  }
  return { tiles: mergeGeometries(tiles, false), fascia: fasG.geo(), soffit: sofG.geo() };
};
type Add = (geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) => void;
/** a roof placed at matrix m (eave level at m's origin), + ridge cap with upturned ends when thd == 0 */
const addRoof = (add: Add, m: THREE.Matrix4, hw: number, hd: number, H: number, thw: number, thd: number, curl: number, inset = 0.6) => {
  const r = roofGeo(hw, hd, H, thw, thd, curl, inset);
  add(r.tiles, MAT.tile(), m); add(r.fascia, MAT.fascia(), m); add(r.soffit, MAT.soffit(), m);
  if (thd < 0.01) {
    const rw = Math.max(thw, 0.25), k = Math.min(1, hw / 6);
    add(UB, MAT.ridge(), m.clone().multiply(boxM(-rw - 0.1, rw + 0.1, H - 0.08, H + 0.26 * (0.5 + k / 2), -0.16, 0.16)));
    for (const s of [-1, 1]) add(UB, MAT.ridge(), m.clone().multiply(new THREE.Matrix4().compose(V(s * (rw + 0.1), H + 0.12 + 0.2 * k, 0),
      new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * 0.5), V(0.16 + 0.08 * k, 0.25 + 0.4 * k, 0.24))));
  }
};

// ================================================================================================ towers
type Part = "base" | "front" | "postF0" | "postF1" | "roof";
/** lookout hut from palace timber (local: walkway point, +x = outward front), ~5 x 5 m, ~6 m to the ridge.
 *  Lower plank walls with arrow slits, a cap beam, an open gallery with rail + balusters, a hipped tile roof. */
const towerParts = (add: (p: Part, g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => void, base: THREE.Matrix4, s = 1) => {
  const h = 2.3 * s, pw = 0.3 * s, WH = 2.4 * s, RT = 4.2 * s, RL = 3.25 * s;
  const B = (p: Part, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    add(p, UB, mat, base.clone().multiply(boxM(x0, x1, y0, y1, z0, z1)));
  // posts (front posts snap at 1.2 m: stump in base, upper part separate)
  for (const [px, pz] of [[-h, -h], [-h, h], [h, -h], [h, h]]) {
    if (px > 0) {
      B("base", MAT.red(), px - pw / 2, px + pw / 2, 0, 1.2 * s, pz - pw / 2, pz + pw / 2);
      B(pz < 0 ? "postF0" : "postF1", MAT.red(), px - pw / 2, px + pw / 2, 1.2 * s, RT, pz - pw / 2, pz + pw / 2);
    } else B("base", MAT.red(), px - pw / 2, px + pw / 2, 0, RT, pz - pw / 2, pz + pw / 2);
  }
  const t = 0.12 * s, e = h - pw / 2;
  // lower walls: front (slits), sides, back with a door gap
  add("front", UB, MAT.slits(), base.clone().multiply(boxM(h - t, h, 0, WH, -e, e)));
  for (const sz of [-1, 1]) add("base", UB, MAT.slits(), base.clone().multiply(boxM(-e, e, 0, WH, sz > 0 ? h - t : -h, sz > 0 ? h : -h + t)));
  for (const sz of [-1, 1]) B("base", MAT.plank(), -h, -h + t, 0, WH, sz < 0 ? -e : 0.65 * s, sz < 0 ? -0.65 * s : e);
  B("base", MAT.plank(), -h, -h + t, 2.05 * s, WH, -0.65 * s, 0.65 * s);
  // cap beam on top of the walls, rail + balusters (front in the "front" part), architrave under the roof
  const ring = (y0: number, y1: number, w: number, frontPart: Part) => {
    B(frontPart, MAT.red(), h - w, h + 0.02, y0, y1, -h, h);
    B("base", MAT.red(), -h - 0.02, -h + w, y0, y1, -h, h);
    for (const sz of [-1, 1]) B("base", MAT.red(), -h, h, y0, y1, sz < 0 ? -h - 0.02 : h - w, sz < 0 ? -h + w : h + 0.02);
  };
  ring(WH, WH + 0.16 * s, 0.2 * s, "front");
  ring(RL - 0.06 * s, RL + 0.06 * s, 0.12 * s, "front");
  ring(RT - 0.32 * s, RT, 0.22 * s, "roof");
  for (let i = 1; i < 7; i++) {
    const u = -h + (2 * h * i) / 7;
    B("front", MAT.red(), h - 0.08 * s, h, WH + 0.16 * s, RL, u - 0.04 * s, u + 0.04 * s);
    for (const sz of [-1, 1]) B("base", MAT.red(), u - 0.04 * s, u + 0.04 * s, WH + 0.16 * s, RL, sz * h - 0.04 * s, sz * h + 0.04 * s);
  }
  // floor boards inside (hides the walkway seam) + roof
  addRoof((g, m, mm) => add("roof", g, m, mm), base.clone().multiply(new THREE.Matrix4().makeTranslation(0, RT, 0)), 3.0 * s, 2.85 * s, 1.85 * s, 0.35 * s, 0, 0.32 * s, 0.75 * s);
};

// ================================================================================================ dents
/** unit crater (normal +z): a real CONCAVE bowl behind the face plane (depth 0.26 R), its rim on the plane at
 *  r = 1. The wall material (dentWallMat) cuts an elliptical hole over each live dent, so the bowl shows through:
 *  the high sun shades its upper inner wall and lights the lower one (reads as a dent, never as a bump). */
const dentGeo = () => {
  const RR = [0, 0.22, 0.42, 0.6, 0.74, 0.85, 0.93, 0.98, 1.04], NS = 26;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j < RR.length; j++) for (let i = 0; i <= NS; i++) {
    const a = (i / NS) * TAU, rr = RR[j], x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    const z = rr >= 1 ? -0.012 : -0.012 - 0.25 * (1 - rr * rr) ** 0.75 * (1 + 0.08 * Math.sin(a * 3 + 1) * rr);
    pos.push(x, y, z); uv.push(x / 2.08 + 0.5, y / 2.08 + 0.5);
  }
  for (let j = 0; j < RR.length - 1; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
    idx.push(a, d, b, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const MAX_DENTS = 600, NBIN = 24, BIN_W = 5, DTEX_W = 2048;
const DENT_U = { uDents: { value: null as THREE.DataTexture | null }, uDentN: { value: 0 } };
let dentWallM: THREE.MeshLambertMaterial | null = null;
/** the outer-wall material: the earth wall + an elliptical hole over every live dent (data texture: 3 texels per
 *  dent = centre + bound^2, X / rx, Y / ry) */
const dentWallMat = () => {
  if (dentWallM) return dentWallM;
  const m = twoTone(new THREE.MeshLambertMaterial({ map: P.earthWallHD(), vertexColors: true }));
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, rd) => {
    prev.call(m, sh, rd);
    Object.assign(sh.uniforms, DENT_U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vDW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uDents; uniform int uDentN; varying vec3 vDW;")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        float dm = max( abs( vDW.x ), abs( vDW.z ) );
        if ( uDentN > 0 && vDW.y < ${WALL_H.toFixed(2)} && dm > ${HALF.toFixed(2)} - ${BATTER.toFixed(3)} * vDW.y - 0.3 ) {
          bool ew = abs( vDW.x ) >= abs( vDW.z );
          int side = ew ? ( vDW.x > 0.0 ? 0 : 2 ) : ( vDW.z < 0.0 ? 1 : 3 );
          float a = ew ? ( vDW.x > 0.0 ? vDW.z : -vDW.z ) : ( vDW.z < 0.0 ? vDW.x : -vDW.x );
          int bin = side * ${NBIN} + int( clamp( floor( ( a + ${HALF.toFixed(1)} ) / ${BIN_W.toFixed(1)} ), 0.0, ${(NBIN - 1).toFixed(1)} ) );
          vec4 hd = texelFetch( uDents, ivec2( bin, 1 ), 0 );
          for ( int j = 0; j < 48; j ++ ) {
            if ( float( j ) >= hd.y ) break;
            int i = int( texelFetch( uDents, ivec2( int( hd.x ) + j, 2 ), 0 ).x );
            vec4 c = texelFetch( uDents, ivec2( i * 3, 0 ), 0 );
            vec3 d = vDW - c.xyz;
            if ( dot( d, d ) > c.w ) continue;
            vec3 X = texelFetch( uDents, ivec2( i * 3 + 1, 0 ), 0 ).xyz, Y = texelFetch( uDents, ivec2( i * 3 + 2, 0 ), 0 ).xyz;
            vec3 N = normalize( cross( X, Y ) );
            float u = dot( d, X ), v = dot( d, Y );
            if ( u * u + v * v < 1.0 && abs( dot( d, N ) ) < 0.12 ) discard;
          }
        }`);
  };
  m.customProgramCacheKey = () => "twoTone6_1.000_dentwall";
  dentWallM = m;
  return m;
};
type Dent = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; f?: number; t?: number };
/** a dent's pose on side k at (a, y): on the battered outer face, facing out */
const dentPose = (k: number, a: number, y: number, R: number, sx = 1, sy = 1): Dent => {
  const nL = nrm([1, BATTER, 0]), n = V(...sideW(k, nL[0], nL[1], nL[2])).sub(V(0, 0, 0));
  const [x, yy, z] = sideW(k, outerX(y), y, a);
  const X = V(0, 1, 0).cross(n).normalize(), Y = n.clone().cross(X).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n));
  return { p: V(x, yy, z).addScaledVector(n, 0.0), q, s: V(R * sx, R * sy, R) };
};

// ================================================================================================ the heap
const HEAP_H = 8.6, REPOSE = Math.tan((37 * Math.PI) / 180);
const heapT = (z: number) => { const u = (z - HEAP[2]) / 11.5; return Math.max(0, 1 - u * u) ** 0.55; };
const heapLump = (x: number, z: number) => 0.28 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 1.3 - x * 0.4) + 0.18 * Math.sin(x * 3.1 - z * 2.3);
/** heap surface height at (x, z) for heap state k (grows from the foot of the wall up, at the angle of repose) */
const heapH = (x: number, z: number, k: number) => {
  const Hk = HEAP_H * k, T = heapT(z);
  const h = T * Math.max(0, Hk - Math.max(0, x - (HALF - 0.2)) * REPOSE);
  return h > 0.05 ? h + heapLump(x, z) * Math.min(1, h / 1.2) : h;
};
/** the heap state at which the surface at (x, z) reaches height y */
const heapKAt = (x: number, z: number, y: number) => (y / Math.max(0.05, heapT(z)) + Math.max(0, x - (HALF - 0.2)) * REPOSE) / HEAP_H;

// ================================================================================================ the rig
type Plank = { p0: THREE.Vector3; v: THREE.Vector3; w: THREE.Vector3; q0: THREE.Quaternion; qEnd: THREE.Quaternion; tl: number; floor: number; s: THREE.Vector3 };
type Pop = { o: THREE.Object3D; k0: number; kind: number };

export class SiegeRig {
  group = new THREE.Group();
  /** soft point light (night torches); col = 0 means off */
  glow = { pos: new THREE.Vector3(), col: new THREE.Vector3(), r: 3 };
  private dents!: THREE.InstancedMesh; private dentList: Dent[] = []; private dentData!: Float32Array; private dentSide: number[][] = [];
  private heapMesh!: THREE.Mesh; private heapKey = -1; private heapXs: number[] = []; private heapZs: number[] = [];
  private rocks: { im: THREE.InstancedMesh; list: { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; b: number; r: number }[] }[] = [];
  private smash: Record<string, THREE.Group> = {};
  private planks!: THREE.InstancedMesh; private plankList: Plank[] = [];
  private dung!: THREE.InstancedMesh; private dungList: { m: THREE.Matrix4; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; k0: number }[] = [];
  private straw!: THREE.InstancedMesh; private strawList: { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; k0: number }[] = [];
  private felts: Pop[] = [];
  private tb!: { beam: THREE.Group; ropes: THREE.Mesh[]; anchors: THREE.Vector3[]; sling: THREE.Mesh[]; root: THREE.Group };
  private rock!: THREE.Mesh;
  private bombG!: THREE.Group; private bomb!: THREE.Group; private chain!: Strand;
  private doors: THREE.Group[] = [];
  private torches!: THREE.InstancedMesh; private torchPos: THREE.Vector3[] = [];
  private m4 = new THREE.Matrix4(); private q4 = new THREE.Quaternion(); private v3 = new THREE.Vector3(); private s3 = new THREE.Vector3();

  constructor(root: THREE.Group, kit: Kit, rays: Ray[]) {
    root.add(this.group);
    // sight lines for culling: aerial lenses (y > 40, the god's view) only skim the roofs, and every ray stops 2.5 m
    // short of its look point (a ray that ENDS on a roof or a tower is aimed at it, not blocked by it)
    const trim = (d: number) => rays.filter((r) => r.o.y < 40 && r.len > d + 0.5).map((r) => ({ ...r, len: r.len - d }));
    const raysHero = trim(5);
    setSight(raysHero);
    const blocked: string[] = [];
    const hero = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => { if (inTheWay(x0, x1, y0, y1, z0, z1, true)) blocked.push(name); };
    hero("TOWER_SMASH", TOWER_SMASH[0] - 2.6, TOWER_SMASH[0] + 2.6, WALL_H, WALL_H + 6, TOWER_SMASH[2] - 2.6, TOWER_SMASH[2] + 2.6);
    hero("TOWER_HERO", TOWER_HERO[0] - 2.6, TOWER_HERO[0] + 2.6, WALL_H, WALL_H + 6, TOWER_HERO[2] - 2.6, TOWER_HERO[2] + 2.6);
    hero("gate tower", 48.5, 57.6, WALL_H, WALL_H + 11.5, -10, 10);
    hero("DEF_TB", DEF_TB[0] - 2, DEF_TB[0] + 2, WALL_H, WALL_H + 6, DEF_TB[2] - 1, DEF_TB[2] + 1);
    setSight(trim(2.5));
    this.buildGround();
    this.buildWall();
    this.buildGate();
    this.buildTowers(blocked);
    this.buildCity(kit);
    this.buildDents();
    this.buildHeap();
    this.buildPadding();
    this.buildTrebuchet();
    this.buildBomb();
    this.buildTorches();
    if (blocked.length) console.warn("[siege] camera core rays pass through hero props:", blocked.join(", "));
    setSight([]);
  }

  // ---------------------------------------------------------------------------------------------- ground
  private buildGround() {
    const lines = (lim: number) => {
      const s: number[] = [];
      for (let v = -150; v <= 150; v += 3) s.push(v);
      let d = 3, v = 150; while (v < lim) { d *= 1.15; v += d; s.push(Math.min(v, lim)); s.unshift(-Math.min(v, lim)); }
      return s;
    };
    const xs = lines(1600), zs = lines(1600), nx = xs.length, nz = zs.length;
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3), idx: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i, x = xs[i], z = zs[j];
      pos[v * 3] = x; pos[v * 3 + 2] = z; uv[v * 2] = x / 10; uv[v * 2 + 1] = -z / 10;
      const m = Math.max(Math.abs(x), Math.abs(z)), dOut = m - HALF;
      let t = 1 + 0.07 * Math.sin(x * 0.031 + 1.3) * Math.sin(z * 0.027 - 0.4) + 0.04 * Math.sin(x * 0.11 + z * 0.07);
      if (dOut > 0) t *= 1 - (1 - smooth(dOut / 28)) * (0.13 + 0.09 * Math.sin(x * 0.37 + z * 0.21) * Math.sin(z * 0.29 - x * 0.13)); // trampled ring
      else if (m < HALF - WALL_BASE_T) t *= 1.06;                       // packed earth inside the city
      col[v * 3] = t; col[v * 3 + 1] = t * 0.99; col[v * 3 + 2] = t * 0.97;
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.ground()); m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
    // cart tracks: pairs of ruts from the gate out east (and down the main street inside)
    const gb = new GB();
    const track = (pts: [number, number][]) => {
      for (const off of [-0.8, 0.8]) for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx2 = -dz / l, nz2 = dx / l;
        const o0 = off - 0.14, o1 = off + 0.14;
        gb.quad([[x0 + nx2 * o0, 0.02, z0 + nz2 * o0], [x1 + nx2 * o0, 0.02, z1 + nz2 * o0], [x1 + nx2 * o1, 0.02, z1 + nz2 * o1], [x0 + nx2 * o1, 0.02, z0 + nz2 * o1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
      }
    };
    const curve = (x0: number, z0: number, x1: number, z1: number, bend: number) => Array.from({ length: 24 }, (_, i) => {
      const u = i / 23; return [lerp(x0, x1, u), lerp(z0, z1, u) + bend * Math.sin(u * Math.PI)] as [number, number];
    });
    const t1 = curve(60.5, 0.4, 400, 30, 14), at1 = (i: number) => t1[i];
    track(t1); track([at1(1), ...curve(at1(1)[0], at1(1)[1], 380, -70, -18).slice(1)]); track([at1(3), ...curve(at1(3)[0], at1(3)[1], 260, 110, 20).slice(1)]);
    track(curve(-40, 0.3, 47.5, 0.3, 0.4));
    const rm = new THREE.Mesh(gb.geo(), MAT.rut()); rm.receiveShadow = true; this.group.add(rm);
  }

  // ---------------------------------------------------------------------------------------------- wall
  private buildWall() {
    const wall = new GB(), walk = new GB();
    const ys = [0, 0.3, 0.7, 1.2, 1.8, 2.6, 3.6, 5, 6.2, 7, 8.4, 10];
    const seq = (a: number, b: number, st: number, extra: number[]) => [...Array.from({ length: Math.round((b - a) / st) + 1 }, (_, i) => a + i * st), ...extra].sort((p, q) => p - q).filter((v, i, l) => i === 0 || v - l[i - 1] > 1e-6);
    const colsO = seq(-56, 56, 2, [-3, 3]), colsI = seq(-46, 46, 2, [-3, 3]);
    const nO = nrm([1, BATTER, 0]), nI = nrm([-1, BATTER, 0]);
    for (let k = 0; k < 4; k++) {
      wall.side(k); walk.side(k);
      const tint = (a: number, y: number, outer: boolean) => {
        let t = 1 + 0.09 * Math.sin(a * 0.19 + k * 1.7) * Math.sin(y * 0.4 + a * 0.05) + 0.07 * Math.sin(a * 0.061 + k * 2.3) + 0.05 * Math.sin(a * 0.43 + y * 0.9 + k);
        t *= outer ? 0.6 + 0.4 * smooth(y / 1.4) : 0.72 + 0.28 * smooth(y / 1.1);
        if (k === 0 && Math.abs(a) < 4.5 && y < 8) t *= 0.9;   // grime round the gate
        return t;
      };
      for (const [cols, X, nn, outer] of [[colsO, outerX, nO, true], [colsI, innerX, nI, false]] as const) {
        for (let j = 0; j < ys.length - 1; j++) {
          const y0 = ys[j], y1 = ys[j + 1];
          const A0 = [-X(y0), ...cols, X(y0)], A1 = [-X(y1), ...cols, X(y1)];
          for (let i = 0; i < A0.length - 1; i++) {
            const am = (A0[i] + A0[i + 1]) / 2;
            if (k === 0 && Math.abs(am) < GATE_W / 2 && y0 < GATE_HGT - 0.01) continue;
            const v: V3[] = [[X(y0), y0, A0[i]], [X(y0), y0, A0[i + 1]], [X(y1), y1, A1[i + 1]], [X(y1), y1, A1[i]]];
            const sgn = outer ? -1 : 1;
            wall.quad(v, v.map((p) => [(sgn * p[2]) / TW, p[1] / TW] as [number, number]), nn as V3, v.map((p) => tint(p[2], p[1], outer)));
          }
        }
      }
      // walkway top (mitred trapezoid)
      const r0 = innerX(WALL_H), r1 = PAR_IN, y = WALL_H;
      walk.quad([[r0, y, -r0], [r1, y, -r1], [r1, y, r1], [r0, y, r0]], [[r0 / 4, -r0 / 4], [r1 / 4, -r1 / 4], [r1 / 4, r1 / 4], [r0 / 4, r0 / 4]], [0, 1, 0]);
      // parapet breast (sill), merlons, corner block
      const yS = WALL_H + SILL, yT = WALL_H + PARAPET_H;
      const ct = (yy: number) => 0.95 + 0.05 * smooth((yy - WALL_H) / 1.5);
      wall.quad([[TOP_O, y, -TOP_O], [TOP_O, y, TOP_O], [TOP_O, yS, TOP_O], [TOP_O, yS, -TOP_O]], [[TOP_O / TW, y / TW], [-TOP_O / TW, y / TW], [-TOP_O / TW, yS / TW], [TOP_O / TW, yS / TW]], [1, 0, 0]);
      wall.quad([[PAR_IN, y, -PAR_IN], [PAR_IN, y, PAR_IN], [PAR_IN, yS, PAR_IN], [PAR_IN, yS, -PAR_IN]], [[-PAR_IN / TW, y / TW], [PAR_IN / TW, y / TW], [PAR_IN / TW, yS / TW], [-PAR_IN / TW, yS / TW]], [-1, 0, 0], [0.9, 0.9, 1, 1]);
      wall.quad([[PAR_IN, yS, -PAR_IN], [TOP_O, yS, -TOP_O], [TOP_O, yS, TOP_O], [PAR_IN, yS, PAR_IN]], [[PAR_IN / TW, -PAR_IN / TW], [TOP_O / TW, -TOP_O / TW], [TOP_O / TW, TOP_O / TW], [PAR_IN / TW, PAR_IN / TW]], [0, 1, 0]);
      for (let c = -55; c <= 55; c += 2) boxL(wall, PAR_IN, TOP_O, yS, yT, c - 0.6, c + 0.6, TW, false, ct);
      boxL(wall, PAR_IN, TOP_O, yS, yT, PAR_IN, TOP_O, TW, false, ct);
      // ramps up the inner face (east wall north of the gate, west wall south of it: same local coords)
      if (k === 0 || k === 2) {
        const a0 = -36, a1 = -16, a2 = -13, rr0 = 43, rr1 = 50;
        walk.quad([[rr0, 0, a0], [rr1, 0, a0], [rr1, WALL_H, a1], [rr0, WALL_H, a1]], [[rr0 / 4, a0 / 4], [rr1 / 4, a0 / 4], [rr1 / 4, a1 / 4 + 2.5], [rr0 / 4, a1 / 4 + 2.5]], [-0.0, 1, -0.45]);
        walk.quad([[rr0, WALL_H, a1], [rr1, WALL_H, a1], [rr1, WALL_H, a2], [rr0, WALL_H, a2]], [[rr0 / 4, a1 / 4], [rr1 / 4, a1 / 4], [rr1 / 4, a2 / 4], [rr0 / 4, a2 / 4]], [0, 1, 0]);
        wall.quad([[rr0, 0, a0], [rr0, 0, a2], [rr0, WALL_H, a2], [rr0, WALL_H, a1]], [[a0 / TW, 0], [a2 / TW, 0], [a2 / TW, WALL_H / TW], [a1 / TW, WALL_H / TW]], [-1, 0, 0], [0.7, 0.7, 1, 1]);
        wall.quad([[rr0, 0, a2], [rr1, 0, a2], [rr1, WALL_H, a2], [rr0, WALL_H, a2]], [[rr0 / TW, 0], [rr1 / TW, 0], [rr1 / TW, WALL_H / TW], [rr0 / TW, WALL_H / TW]], [0, 0, 1], [0.7, 0.7, 1, 1]);
        boxL(wall, rr0 - 0.05, rr0 + 0.45, WALL_H, WALL_H + 0.6, a1, a2, TW);   // low curb on the landing
      }
    }
    const wm = new THREE.Mesh(wall.geo(true), dentWallMat()); wm.castShadow = wm.receiveShadow = true; this.group.add(wm);
    const km = new THREE.Mesh(walk.geo(), MAT.walk()); km.castShadow = km.receiveShadow = true; this.group.add(km);
  }

  // ---------------------------------------------------------------------------------------------- gate
  private buildGate() {
    const gw = GATE_W / 2, gh = GATE_HGT, b = new Batch(), wall = new GB();
    const add = (g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => b.add(g, m, mm);
    // passage side walls + ceiling (earth), darker inside
    for (const s of [-1, 1]) {
      const v: V3[] = [[innerX(0), 0, s * gw], [outerX(0), 0, s * gw], [outerX(gh), gh, s * gw], [innerX(gh), gh, s * gw]];
      wall.quad(v, v.map((p) => [p[0] / TW, p[1] / TW] as [number, number]), [0, 0, -s], [0.55, 0.55, 0.62, 0.62]);
    }
    // timber frame (Song-style): posts along both walls, a wall plate, cross beams + boards under the earth ceiling
    const rIn = innerX(gh) + 0.05, rOut = outerX(gh) - 0.05;
    for (let r = innerX(0) + 0.6; r < 54.2; r += 1.5) for (const s of [-1, 1]) add(UB, MAT.beam(), boxM(r - 0.17, r + 0.17, 0, gh - 0.55, s * gw - (s > 0 ? 0.32 : 0), s * gw + (s < 0 ? 0.32 : 0)));
    for (const s of [-1, 1]) add(UB, MAT.beam(), boxM(innerX(0) + 0.3, 54.4, gh - 0.55, gh - 0.25, s * gw - (s > 0 ? 0.36 : 0), s * gw + (s < 0 ? 0.36 : 0)));
    for (let r = rIn + 0.4; r < rOut; r += 1.1) add(UB, MAT.beam(), boxM(r - 0.16, r + 0.16, gh - 0.42, gh, -gw, gw));
    add(UB, MAT.soffit(), boxM(rIn, rOut, gh - 0.08, gh, -gw, gw));
    // lintel beam over the outer mouth + the doorway frame the leaves hang in
    const DX = outerX(gh) - 0.35;   // door plane (vertical), 57.55
    add(UB, MAT.beam(), boxM(DX - 0.25, outerX(gh) + 0.1, gh - 0.45, gh + 0.05, -gw - 0.4, gw + 0.4));
    for (const s of [-1, 1]) add(UB, MAT.beam(), boxM(DX - 0.25, DX + 0.25, 0, gh - 0.45, s * gw - 0.2, s * gw + 0.2));
    add(UB, MAT.stone(), boxM(DX - 0.3, DX + 0.3, 0, 0.22, -gw, gw));                       // threshold stone
    add(UB, MAT.stone(), boxM(innerX(0) - 0.4, outerX(0) + 0.5, -0.05, 0.03, -gw, gw));      // paved passage floor
    b.build(this.group);
    const wm = new THREE.Mesh(wall.geo(true), MAT.wall()); wm.receiveShadow = wm.castShadow = true; this.group.add(wm);
    // the two door leaves, hinged at z = +-3 on the door plane, opening inward (toward -x)
    const LW = gw - 0.02, LH = gh - 0.5, LT = 0.22;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(DX, 0, s * gw); this.group.add(pivot);
      const lb = new Batch(), z0 = -s * LW, zc = z0 / 2;
      // leaf body: local x across the thickness, z from the hinge (0) to the free edge (z0)
      lb.add(UB, MAT.door(), boxM(-LT / 2, LT / 2, 0.02, LH, Math.min(0, z0), Math.max(0, z0)));
      // outer studs (9 rows x 5) + smaller inner nail heads, iron straps on both faces, inner cross battens
      const sg = new THREE.SphereGeometry(0.075, 10, 6, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2);
      const sgI = new THREE.SphereGeometry(0.05, 8, 5, 0, TAU, 0, Math.PI / 2).rotateZ(Math.PI / 2);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) {
        const y = 0.75 + (r * (LH - 1.4)) / 8, z = zc + (c - 2) * (LW / 5.6);
        lb.add(sg, MAT.stud(), M4(LT / 2, y, z));
        lb.add(sgI, MAT.iron(), M4(-LT / 2, y, z));
      }
      for (const y of [0.45, LH / 2, LH - 0.45]) {
        lb.add(UB, MAT.iron(), boxM(LT / 2, LT / 2 + 0.03, y - 0.09, y + 0.09, Math.min(0, z0) + 0.05, Math.max(0, z0) - 0.05));
        lb.add(UB, MAT.beam(), boxM(-LT / 2 - 0.14, -LT / 2, y - 0.16, y + 0.16, Math.min(0, z0) + 0.1, Math.max(0, z0) - 0.1));
      }
      // diagonal brace on the inner face
      const dl = Math.hypot(LW - 0.4, LH / 2 - 0.9), da = Math.atan2(LH / 2 - 0.9, LW - 0.4);
      for (const yb of [0.45, LH / 2]) lb.add(UB, MAT.beam(), new THREE.Matrix4().compose(V(-LT / 2 - 0.07, yb + (LH / 2 - 0.45) / 2, zc),
        new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), s * da), V(0.12, 0.22, dl)));
      // bar brackets on the inner face
      lb.add(UB, MAT.iron(), boxM(-LT / 2 - 0.3, -LT / 2, 1.45, 1.75, z0 * 0.92 - 0.12, z0 * 0.92 + 0.12));
      lb.build(pivot);
      pivot.userData.s = s;
      this.doors.push(pivot);
    }
    // the drop bar across both leaves (lifted away and leant on the passage wall before the doors open)
    // the drop bar: already lifted out of its brackets, leaning on the north passage wall
    const bb = new Batch();
    bb.add(UB, MAT.beam(), new THREE.Matrix4().compose(V(52.3, 1.35, -2.72), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1.12)), V(5.8, 0.24, 0.22)));
    bb.build(this.group);
  }

  // ---------------------------------------------------------------------------------------------- towers
  private buildTowers(blocked: string[]) {
    const b = new Batch();
    const addAll = (_p: Part, g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => b.add(g, m, mm);
    for (let k = 0; k < 4; k++) for (const a of [-48, -24, 0, 24, 48]) {
      if (k === 0 && a === 0) continue;                                 // the gate tower
      if (k === 0 && (a === TOWER_SMASH[2] || a === TOWER_HERO[2])) continue;
      const [x, , z] = sideW(k, WALK_C, WALL_H, a);
      if (inTheWay(x - 3.2, x + 3.2, WALL_H, WALL_H + 6.5, z - 3.2, z + 3.2, true)) { blocked.push(`tower(${x.toFixed(0)},${z.toFixed(0)}) culled`); continue; }
      towerParts(addAll, sideM(k).setPosition(x, WALL_H, z), 1);
    }
    // corner towers (bigger)
    for (let k = 0; k < 4; k++) {
      const [x, , z] = sideW(k, WALK_C, WALL_H, WALK_C);
      towerParts(addAll, sideM(k).setPosition(x, WALL_H, z), 1.25);
    }
    // the gate tower: 2 storeys, 16 m along z x 6 m, red posts, plank walls, pent roof + top hip roof (east side)
    const gt = (g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => b.add(g, m, mm);
    const R0 = innerX(WALL_H) + 0.4, R1 = PAR_IN - 0.3, Rc = (R0 + R1) / 2, y0 = WALL_H;
    add2Storey(gt, Rc, R1 - R0, 16, y0);
    b.build(this.group);
    // hero towers: separate parts
    const parts = (name: string, at: V3) => {
      const grp: Record<string, THREE.Group> = {};
      const pb: Record<string, Batch> = {};
      const add = (p: Part, g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => { (pb[p] ??= new Batch()).add(g, m, mm); };
      towerParts(add, new THREE.Matrix4(), 1);
      const root = new THREE.Group(); root.position.set(at[0], at[1], at[2]); this.group.add(root);
      for (const p of Object.keys(pb)) {
        const g = new THREE.Group(); root.add(g); pb[p].build(g); grp[p] = g;
        g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.matrixAutoUpdate = false; });
      }
      grp.root = root;
      return grp;
    };
    this.smash = parts("smash", TOWER_SMASH);
    parts("hero", TOWER_HERO);
    // smash pivots: roof hinges on its rear eave, front posts on their snap points
    const sm = this.smash;
    const pivot = (g: THREE.Group, x: number, y: number, z: number) => {
      const p = new THREE.Group(); p.position.set(x, y, z); sm.root.add(p); p.add(g); g.position.set(-x, -y, -z); return p;
    };
    sm.roofP = pivot(sm.roof, -2.3, 4.2, 0);
    sm.post0P = pivot(sm.postF0, 2.3, 1.2, -2.3);
    sm.post1P = pivot(sm.postF1, 2.3, 1.2, 2.3);
    // flying planks (the front wall + rail)
    const pg = new THREE.BoxGeometry(1, 1, 1);
    this.planks = new THREE.InstancedMesh(pg, MAT.plank(), 34);
    this.planks.castShadow = true; this.planks.receiveShadow = true; this.planks.frustumCulled = false;
    this.group.add(this.planks);
    const hit = V(TOWER_SMASH[0] + 1.5, WALL_H + 3.2, TOWER_SMASH[2]);
    for (let i = 0; i < 34; i++) {
      const h1 = hash(i, 41), h2 = hash(i, 42), h3 = hash(i, 43), h4 = hash(i, 44);
      const p0 = V(TOWER_SMASH[0] + 2.25, WALL_H + 0.3 + h1 * 3.2, TOWER_SMASH[2] - 2.1 + h2 * 4.2);
      const d = p0.clone().sub(hit); d.x -= 1.2; d.normalize();
      const sp = 3.5 + h3 * 6;
      const v = V(d.x * sp - 2, 2.5 + h4 * 5.5, d.z * sp * 1.4);
      const w = V(hash(i, 45) - 0.5, hash(i, 46) - 0.5, hash(i, 47) - 0.5).multiplyScalar(14);
      const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2 * (h1 > 0.5 ? 1 : 0)));
      // landing: walkway (x 50..56.4) or the city ground
      const g = 9.8;
      const tAt = (floor: number) => { const dy = p0.y - floor; return (v.y + Math.sqrt(v.y * v.y + 2 * g * dy)) / g; };
      let floor = WALL_H + 0.04, tl = tAt(floor), xl = p0.x + v.x * tl;
      if (xl < innerX(WALL_H) || xl > PAR_IN) { floor = 0.04; tl = tAt(floor); }
      const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(i, 48) * TAU, 0));
      this.plankList.push({ p0, v, w, q0, qEnd, tl, floor, s: V(0.9 + h2 * 0.6, 0.05, 0.22 + h3 * 0.08) });
    }
  }

  // ---------------------------------------------------------------------------------------------- city
  private buildCity(kit: Kit) {
    const b = new Batch(), r = rng(77);
    const add = (g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => b.add(g, m, mm);
    const U = (a: number, c: number) => a + (c - a) * r();
    const PAL = { x0: -20, x1: 20, z0: -42, z1: -8 };
    const YARD = { x0: 30.5, x1: 44, z0: 4.2, z1: 18 };
    const inR = (x: number, z: number, R: { x0: number; x1: number; z0: number; z1: number }, m = 0) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
    // houses round each block, fronts to the street
    const segs: [number, number][] = [[-41, -23.5], [-20.5, -4.5], [4.5, 20.5], [23.5, 41]];
    let n = 0;
    for (const [bx0, bx1] of segs) for (const [bz0, bz1] of segs) {
      const blocks: [number, number, number, number, number][] = []; // x, z, yaw, w, d
      // four sides of the block
      for (const side of [0, 1, 2, 3]) {
        const len = side % 2 ? bz1 - bz0 : bx1 - bx0;
        let u = 0.3;
        while (u < len - 4) {
          const w = Math.min(len - u - 0.3, U(4.6, 7.2)), d = U(4.4, 5.6);
          if (w < 3.5) break;
          const c = u + w / 2;
          if (side === 0) blocks.push([bx0 + c, bz1 - d / 2, 0, w, d]);
          else if (side === 2) blocks.push([bx0 + c, bz0 + d / 2, Math.PI, w, d]);
          else if (side === 1) blocks.push([bx1 - d / 2, bz0 + c, Math.PI / 2, w, d]);
          else blocks.push([bx0 + d / 2, bz0 + c, -Math.PI / 2, w, d]);
          u += w + (r() < 0.2 ? 1.2 : 0.15);
        }
      }
      for (const [x, z, yaw, w, d] of blocks) {
        if (inR(x, z, PAL, 1) || inR(x, z, YARD, 2.5)) continue;
        // corner overlaps: keep houses whose centre is far enough from the block corners on the cross sides
        const sideOn = Math.abs(Math.sin(yaw)) > 0.5;
        if (sideOn && (z - (bz0) < 5.8 || bz1 - z < 5.8)) continue;
        const two = r() < 0.25, h = two ? U(5.2, 6) : U(2.9, 3.6);
        cnHouse(add, x, z, yaw, w, d, h, n++ % 3, r() < 0.3);
      }
      // the courtyard: a main house in the middle (half the blocks) or a tree
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      if (!inR(cx, cz, PAL, 1) && !inR(cx, cz, YARD, 4)) {
        if (r() < 0.55) cnHouse(add, cx + U(-1, 1), cz, r() < 0.5 ? 0 : Math.PI, U(6, 8), 4.2, U(3.4, 4.2), n++ % 3, true);
        else prop(b, kit, r() < 0.5 ? "tree_oak" : "tree_fat", cx + U(-2, 2), 0, cz + U(-2, 2), U(6, 8.5), r() * 6);
      }
    }
    // houses in the ring lane along the walls? (no: it stays a lane) -- trees along the main street
    for (let x = -38; x <= 28; x += 11) for (const s of [-1, 1]) prop(b, kit, "tree_default", x + U(-1, 1), 0, s * 5.6, U(5.5, 7), r() * 6);
    // ---- the palace: red enclosure wall with a gate on the south, main hall on a platform, side + rear halls
    const pw = MAT.palW(), WH = 3.6;
    const wallSeg = (x0: number, x1: number, z0: number, z1: number) => {
      if (inTheWay(x0, x1, 0, WH + 0.6, z0, z1)) return;
      add(UB, pw, boxM(x0, x1, 0, WH, z0, z1));
      add(UB, MAT.ridge(), boxM(x0 - 0.25, x1 + 0.25, WH, WH + 0.35, z0 - 0.25, z1 + 0.25));
    };
    wallSeg(PAL.x0, PAL.x1, PAL.z0, PAL.z0 + 0.8);
    wallSeg(PAL.x0, PAL.x0 + 0.8, PAL.z0, PAL.z1); wallSeg(PAL.x1 - 0.8, PAL.x1, PAL.z0, PAL.z1);
    wallSeg(PAL.x0, -3.2, PAL.z1 - 0.8, PAL.z1); wallSeg(3.2, PAL.x1, PAL.z1 - 0.8, PAL.z1);
    hall(add, 0, PAL.z1 - 0.4, 7, 3.2, 3.6, 0, 0, false);                 // gatehouse
    hall(add, 0, -27, 17, 10, 5.2, 1.4, 0, true);                        // main hall (double roof)
    hall(add, -12.5, -16, 6, 8, 3.6, 0.5, Math.PI / 2, false);
    hall(add, 12.5, -16, 6, 8, 3.6, 0.5, Math.PI / 2, false);
    hall(add, 0, -37.5, 13, 5, 3.6, 0.6, 0, false);
    for (const [x, z] of [[-14, -35], [14, -35], [-14, -24], [14, -24]]) prop(b, kit, "tree_cone", x, 0, z, 6.5, x);
    // ---- the courtyard by the east gate (FOOD_AT): granary shed, empty jars (lids off), flat sacks, a broom
    this.buildYard(add, YARD);
    b.build(this.group);
  }

  private buildYard(add: (g: THREE.BufferGeometry, m: THREE.Material, mm: THREE.Matrix4) => void, Y: { x0: number; x1: number; z0: number; z1: number }) {
    const pl = plasterMat(0, false);
    // low plastered courtyard walls with tile caps (north along the street, south); east side open
    for (const [x0, x1, z0, z1] of [[Y.x0, Y.x1 - 0.5, Y.z0, Y.z0 + 0.4], [Y.x0, Y.x1 - 0.5, Y.z1 - 0.4, Y.z1]] as const) {
      add(UB, pl, boxM(x0, x1, 0, 2.3, z0, z1));
      add(UB, MAT.ridge(), boxM(x0 - 0.15, x1 + 0.15, 2.3, 2.55, z0 - 0.2, z1 + 0.2));
    }
    // granary shed on the west side: back wall, posts, tile roof sloping back, open front facing east
    const sx0 = Y.x0, sx1 = Y.x0 + 4.4, sz0 = Y.z0 + 0.4, sz1 = Y.z1 - 0.4, sh = 3.6;
    add(UB, MAT.plank(), boxM(sx0, sx0 + 0.25, 0, sh, sz0, sz1));
    for (let z = sz0 + 0.3; z <= sz1 - 0.2; z += (sz1 - sz0 - 0.6) / 3) add(UB, MAT.red(), boxM(sx1 - 0.3, sx1, 0, sh - 0.3, z - 0.15, z + 0.15));
    add(UB, MAT.beam(), boxM(sx1 - 0.35, sx1 + 0.05, sh - 0.45, sh - 0.15, sz0, sz1));
    const rm = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition((sx0 + sx1) / 2 + 0.5, sh - 0.2, (sz0 + sz1) / 2);
    addRoof(add, rm, (sz1 - sz0) / 2 + 0.6, (sx1 - sx0) / 2 + 0.9, 1.9, (sz1 - sz0) / 2 - 2, 0, 0.25, 0.9);
    // an empty grain bin inside the shed + flat sacks on its floor
    add(UB, MAT.plank(), boxM(sx0 + 0.5, sx0 + 2.3, 0, 1.0, sz0 + 1, sz0 + 3.2));
    add(UB, MAT.beam(), boxM(sx0 + 0.65, sx0 + 2.15, 0.08, 0.12, sz0 + 1.15, sz0 + 3.05));
    // jars (lids off), lids on the ground
    const jarG = jarGeo(), lidG = new THREE.CylinderGeometry(0.3, 0.33, 0.07, 18).translate(0, 0.035, 0);
    const knob = new THREE.SphereGeometry(0.07, 8, 6).translate(0, 0.1, 0);
    const jars: [number, number, number][] = [[37.0, 8.3, 1.0], [38.4, 8.7, 1.05], [39.7, 9.5, 0.95], [36.5, 10.2, 1.05], [37.9, 10.9, 1.0], [39.2, 11.6, 1.1], [35.9, 12.2, 0.9]];
    jars.forEach(([x, z, s], i) => {
      add(jarG, MAT.jar(), M4(x, 0, z, i * 1.3, s));
      if (i % 2 === 0) { const a = i * 2.1; add(lidG, MAT.lid(), M4(x + Math.cos(a) * 0.75, 0, z + Math.sin(a) * 0.75, a)); add(knob, MAT.lid(), M4(x + Math.cos(a) * 0.75, 0, z + Math.sin(a) * 0.75)); }
    });
    // a lid leaning on a jar
    add(lidG, MAT.lid(), new THREE.Matrix4().compose(V(38.9, 0.36, 8.95), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0.4, 0)), V(1, 1, 1)));
    // flat empty sacks (gently rumpled cloth on the ground) + a small pile in the shed
    const sackG = sackGeo();
    for (const [x, z, a, y] of [[40.6, 12.8, 0.4, 0.02], [41.3, 9.0, -0.6, 0.02], [36.2, 14.2, 1.2, 0.02], [sx0 + 3.2, 13.5, 0.2, 0.02], [sx0 + 3.25, 13.45, 0.5, 0.07], [sx0 + 3.15, 13.6, -0.3, 0.12]] as const)
      add(sackG, MAT.sack(), M4(x, y, z, a));
    // a broom leaning on the front post
    const bx = sx1 + 0.25, bz = 13.8;
    const bq = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), 0.26);
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8).translate(0, 0.85, 0), MAT.beam(), new THREE.Matrix4().compose(V(bx + 0.45, 0.35, bz), bq, V(1, 1, 1)));
    add(new THREE.ConeGeometry(0.28, 0.55, 12, 1, true).rotateZ(Math.PI).translate(0, 0.27, 0).scale(1, 1, 0.35), MAT.broom(), new THREE.Matrix4().compose(V(bx + 0.45, 0.05, bz), bq, V(1, 1, 1)));
    void FOOD_AT;
  }

  // ---------------------------------------------------------------------------------------------- dents
  private buildDents() {
    // impact dents from the shared projectile schedule (all on the east face) + the poke dent + background dents
    for (const p of PROJ) if (p.dent) { const d = dentPose(0, p.to[2], p.to[1], 1.6 * p.r, 1.05, 0.92); d.f = p.f1; this.dentList.push(d); }
    { const d = dentPose(0, POKE_DENT[2], POKE_DENT[1], 0.7, 1.1, 0.9); d.f = 384; this.dentList.push(d); }
    const NB = 420, used: V3[] = this.dentList.map((d) => [d.p.x, d.p.y, d.p.z]);
    for (let i = 0; i < NB; i++) {
      const e = hash(i, 101), u = hash(i, 102), w = hash(i, 103), R = 0.36 + hash(i, 104) ** 1.4 * 0.5;
      let k = 0, a = 0, y = 0, t = hash(i, 105);
      if (e < 0.62) {
        const c = hash(i, 106);
        if (c < 0.38) { a = -14 + u * 44; y = 1 + w * 8; }                        // round the gate (south of it mostly)
        else if (c < 0.8) { a = -58 + u * 30; y = 3.5 + w * 6.2; t = 0.15 + t * 0.82; } // the NE end, above the heap
        else { a = -56 + u * 112; y = 1 + w * 8.4; }
      } else if (e < 0.82) { k = 1; a = 26 + u * 31; y = 1 + w * 8.4; }        // north face, its east end
      else if (e < 0.91) { k = 3; a = -57 + u * 30; y = 1 + w * 8.4; }        // south face, its east end
      else { k = 2; a = -55 + u * 110; y = 1 + w * 8.4; }
      if (k === 0 && Math.abs(a) < GATE_W / 2 + R + 0.3 && y < GATE_HGT + R) continue;
      y = Math.max(R * 0.95, Math.min(WALL_H - R * 0.95, y));
      a = Math.max(-outerX(y) + R + 0.3, Math.min(outerX(y) - R - 0.3, a));
      // keep the shot-2 close-up area (east face z 4..22) still while the camera sits on it
      if (k === 0 && a > 3 && a < 22 && y < 8 && t < 0.09) t += 0.09;
      const d = dentPose(k, a, y, R, 0.8 + hash(i, 107) * 0.45, 0.78 + hash(i, 108) * 0.38);
      if (used.some((q) => Math.hypot(q[0] - d.p.x, q[1] - d.p.y, q[2] - d.p.z) < R * 1.6)) continue;
      used.push([d.p.x, d.p.y, d.p.z]);
      d.t = t; this.dentList.push(d);
    }
    this.dents = new THREE.InstancedMesh(dentGeo(), MAT.dent(), this.dentList.length);
    this.dents.receiveShadow = false; this.dents.castShadow = false; this.dents.frustumCulled = false;
    // one data texture for every rig instance (crossfades build two worlds; dents depend on f only)
    if (!DENT_U.uDents.value) {
      const dd = new Float32Array(DTEX_W * 3 * 4), t = new THREE.DataTexture(dd as unknown as BufferSource, DTEX_W, 3, THREE.RGBAFormat, THREE.FloatType);
      t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; DENT_U.uDents.value = t;
    }
    this.dentData = DENT_U.uDents.value.image.data as unknown as Float32Array;
    this.dentSide = this.dentList.map((d) => { const x = d.p.x, z = d.p.z; return Math.abs(x) >= Math.abs(z) ? (x > 0 ? [0, z] : [2, -z]) : (z < 0 ? [1, x] : [3, -x]); });
    this.group.add(this.dents);
  }

  // ---------------------------------------------------------------------------------------------- heap
  private buildHeap() {
    for (let x = HALF - 2.8; x <= 73.5; x += 0.45) this.heapXs.push(x);
    for (let z = HEAP[2] - 12; z <= HEAP[2] + 12; z += 0.45) this.heapZs.push(z);
    const nx = this.heapXs.length, nz = this.heapZs.length, pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i; pos[v * 3] = this.heapXs[i]; pos[v * 3 + 2] = this.heapZs[j]; uv[v * 2] = this.heapXs[i] / 4; uv[v * 2 + 1] = this.heapZs[j] / 4;
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.heapMesh = new THREE.Mesh(g, MAT.rubble()); this.heapMesh.castShadow = this.heapMesh.receiveShadow = true; this.heapMesh.frustumCulled = false;
    this.group.add(this.heapMesh);
    // rocks: boulders (2 shapes) + broken millstone thirds, each born where the surface passes its spot
    const rockGeo = (seed: number) => {
      let g2: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 1);
      g2.deleteAttribute("normal"); g2.deleteAttribute("uv"); g2 = mergeVertices(g2);
      const p = g2.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * hash(i, seed); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
      g2.computeVertexNormals();
      return g2;
    };
    const millG = new THREE.CylinderGeometry(1, 1, 0.5, 20, 1, false, 0, (TAU / 3) * 1.05);
    const defs = [{ g: rockGeo(3), m: MAT.rock(), n: 820, mill: false }, { g: rockGeo(9), m: MAT.rock(), n: 820, mill: false }, { g: millG, m: MAT.mill(), n: 190, mill: true }];
    const col = new THREE.Color();
    defs.forEach((D, di) => {
      const im = new THREE.InstancedMesh(D.g, D.m, D.n); im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
      const list: (typeof this.rocks)[number]["list"] = [];
      let tries = 0;
      while (list.length < D.n && tries++ < D.n * 8) {
        const s = list.length + di * 5000 + tries * 0.37;
        const x = HALF - 2 + hash(s, 11) * 14, z = HEAP[2] - 11.5 + hash(s, 12) * 23, hf = heapH(x, z, 1);
        if (hf < 0.2) continue;
        const y = hash(s, 13) * hf, b = heapKAt(x, z, y);
        if (b > 1.01 || x < outerX(y) - 0.2) continue;
        const r = D.mill ? 0.5 + hash(s, 14) * 0.2 : 0.28 + hash(s, 14) ** 1.5 * 0.55;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(s, 15) * TAU, hash(s, 16) * TAU, hash(s, 17) * TAU));
        if (D.mill) q.setFromEuler(new THREE.Euler((hash(s, 15) - 0.5) * 1.6, hash(s, 16) * TAU, (hash(s, 17) - 0.5) * 1.6));
        list.push({ p: V(x, y + r * 0.25, z), q, s: D.mill ? V(r, r * 0.6, r) : V(r * (0.9 + hash(s, 18) * 0.4), r, r * (0.9 + hash(s, 19) * 0.3)), b, r });
        const v = D.mill ? 0.9 + hash(s, 20) * 0.1 : 0.62 + hash(s, 20) * 0.4;
        im.setColorAt(list.length - 1, col.setRGB(v, v * (0.97 + hash(s, 21) * 0.04), v * (0.93 + hash(s, 22) * 0.06)));
      }
      im.count = list.length;
      this.group.add(im); this.rocks.push({ im, list });
    });
  }

  // ---------------------------------------------------------------------------------------------- padding
  private buildPadding() {
    const T0 = V(...TOWER_HERO), up = V(0, 1, 0);
    // dung patties: on the front posts / front wall / side walls, a few at a time
    const dg = new THREE.SphereGeometry(1, 12, 8);
    this.dung = new THREE.InstancedMesh(dg, MAT.dung(), 30); this.dung.castShadow = true; this.dung.receiveShadow = true; this.dung.frustumCulled = false;
    this.group.add(this.dung);
    for (let i = 0; i < 30; i++) {
      const f = hash(i, 61), g2 = hash(i, 62), side = i % 3;
      let p: THREE.Vector3, n: THREE.Vector3;
      if (side === 0) { p = V(2.32, 0.4 + f * 2.0, -2.1 + g2 * 4.2); n = V(1, 0, 0); }
      else { const sz = side === 1 ? -1 : 1; p = V(-2.0 + f * 4.3, 0.4 + g2 * 2.0, sz * 2.32); n = V(0, 0, sz); }
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), f * 6));
      const r = 0.17 + hash(i, 63) * 0.09;
      this.dungList.push({ m: new THREE.Matrix4(), p: p.add(T0).addScaledVector(n, 0.03), q, s: V(r, r * 0.85, 0.07), k0: (Math.floor(i / 3) * 3) / 30 });
    }
    // straw bundles: stacked along the front + sides at the foot (lie along the wall), bottom layer first
    const sg = new THREE.LatheGeometry([[0, -0.66], [0.17, -0.64], [0.23, -0.5], [0.2, -0.08], [0.16, 0], [0.2, 0.08], [0.23, 0.5], [0.17, 0.64], [0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
    const uv = sg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) { const a = uv.getX(i); uv.setXY(i, uv.getY(i) * 2, a); }
    this.straw = new THREE.InstancedMesh(sg, MAT.straw(), 20); this.straw.castShadow = true; this.straw.receiveShadow = true; this.straw.frustumCulled = false;
    this.group.add(this.straw);
    let si = 0;
    const lay = (p: THREE.Vector3, axis: THREE.Vector3, k0: number) => {
      const q = new THREE.Quaternion().setFromUnitVectors(up, axis).multiply(new THREE.Quaternion().setFromAxisAngle(up, si));
      this.strawList.push({ p: p.add(T0), q, s: V(1, 1, 1), k0 }); si++;
    };
    for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) lay(V(2.6 + (row === 2 ? -0.05 : 0), 0.23 + row * 0.4, -1.45 + c * 1.45 + (row % 2) * 0.3), V(0, 0, 1), (row * 3 + c) / 20);
    for (const sz of [-1, 1]) for (let row = 0; row < 2; row++) for (let c = 0; c < 2; c++) lay(V(-0.9 + c * 1.45 + row * 0.25, 0.23 + row * 0.4, sz * 2.62), V(1, 0, 0), (9 + (sz > 0 ? 4 : 0) + row * 2 + c) / 20);
    for (const sz of [-1, 1]) lay(V(2.45, 1.0, sz * 1.9), V(0.15, 1, -sz * 0.25).normalize(), (17 + (sz > 0 ? 1 : 0)) / 20);
    this.straw.count = this.strawList.length;
    // felt blankets over the front + side rails and over the roof
    const RL = 3.25;
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, ry: number, k0: number) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      const o = new THREE.Group(); o.add(m); o.position.set(T0.x + pos[0], T0.y + pos[1], T0.z + pos[2]); o.rotation.y = ry; o.visible = false;
      this.group.add(o); this.felts.push({ o, k0, kind: 0 });
    };
    mk(drapeGeo(3.4, 1.5, 0.8, 1), MAT.felt0(), [2.3, RL, -0.6], 0, 0.0);
    mk(drapeGeo(2.6, 1.3, 0.7, 2), MAT.felt1(), [2.3, RL, 1.55], 0, 0.12);
    mk(drapeGeo(3.6, 1.4, 0.7, 3), MAT.felt1(), [0.2, RL, -2.3], Math.PI / 2, 0.25);
    mk(drapeGeo(3.4, 1.4, 0.7, 4), MAT.felt0(), [-0.1, RL, 2.3], -Math.PI / 2, 0.38);
    mk(roofFeltGeo(3.0, 2.85, 1.85, 0.35, -1.8, 0.2, 5), MAT.felt0(), [0, 4.2, 0], 0, 0.52);
    mk(roofFeltGeo(3.0, 2.85, 1.85, 0.35, 0.1, 1.9, 6), MAT.felt1(), [0, 4.2, 0], 0, 0.68);
  }

  // ---------------------------------------------------------------------------------------------- defenders' trebuchet
  private buildTrebuchet() {
    const root = new THREE.Group(); root.position.set(...DEF_TB); this.group.add(root);
    const b = new Batch(), PY = 5.4;
    const strut = (a: THREE.Vector3, c: THREE.Vector3, w: number, mat: THREE.Material) => {
      const d = c.clone().sub(a), L = d.length();
      b.add(UB, mat, new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(w, L, w)));
    };
    for (const z of [-0.75, 0.75]) {
      strut(V(-2.0, 0, z), V(-0.12, PY + 0.15, z), 0.26, MAT.beam());
      strut(V(2.0, 0, z), V(0.12, PY + 0.15, z), 0.26, MAT.beam());
      strut(V(-2.4, 0.13, z), V(2.4, 0.13, z), 0.26, MAT.beam());
      strut(V(-1.15, 2.4, z), V(1.15, 2.4, z), 0.18, MAT.beam());
    }
    strut(V(0, PY, -1.0), V(0, PY, 1.0), 0.2, MAT.iron());
    for (const x of [-2.2, 2.2]) strut(V(x, 0.13, -0.9), V(x, 0.13, 0.9), 0.22, MAT.beam());
    b.build(root);
    // the beam: long arm (4.2) + short arm (1.6), rotating about the pivot in the x-y plane
    const beam = new THREE.Group(); beam.position.set(0, PY, 0); root.add(beam);
    const bb = new Batch();
    bb.add(UB, MAT.beam(), boxM(-1.6, 4.2, -0.15, 0.15, -0.14, 0.14));
    for (const x of [-1.2, 0.6, 2.2, 3.6]) bb.add(UB, MAT.iron(), boxM(x - 0.06, x + 0.06, -0.17, 0.17, -0.16, 0.16));
    bb.add(UB, MAT.iron(), boxM(-1.65, -1.4, -0.22, 0.22, -0.2, 0.2));
    bb.build(beam);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
    const ropes: THREE.Mesh[] = [], anchors: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(cyl, MAT.rope()); m.castShadow = true; root.add(m); ropes.push(m);
      anchors.push(V(1.9 + (i % 4) * 0.42, 1.05 + hash(i, 71) * 0.2, -1.3 + Math.floor(i / 4) * 2.6 + (hash(i, 72) - 0.5) * 0.5));
    }
    const sling: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(cyl, MAT.rope()); root.add(m); sling.push(m); }
    this.tb = { beam, ropes, anchors, sling, root };
    // the Taihu rock: lumpy, pale, deep dark hollows (vertex colour) + a real through-hole (a handle lump)
    this.rock = new THREE.Mesh(taihuGeo(), MAT.taihu()); this.rock.castShadow = true; this.rock.receiveShadow = true;
    this.group.add(this.rock);
  }

  // ---------------------------------------------------------------------------------------------- bomb on a chain
  private buildBomb() {
    // a boom laid up through the crenel at BOMB_Z, its pulley right above BOMB_TIP (the bomb hangs at bombAt(f))
    this.bombG = new THREE.Group(); this.group.add(this.bombG);
    const b = new Batch(), z = BOMB_TIP[2], tip = V(BOMB_TIP[0] - 0.24, BOMB_TIP[1] + 0.75, z);
    const a = V(PAR_IN - 0.55, WALL_H + SILL + 0.14, z), c = tip.clone().add(V(0.25, 0.08, 0)), d = c.clone().sub(a);
    b.add(new THREE.CylinderGeometry(0.12, 0.15, d.length(), 10), MAT.beam(), new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(1, 1, 1)));
    b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16).rotateX(Math.PI / 2), MAT.iron(), M4(tip.x, tip.y, z));                  // pulley
    b.add(UB, MAT.stone(), boxM(a.x - 0.9, a.x + 0.1, WALL_H, WALL_H + 0.55, z - 0.4, z + 0.4));                                   // counterweight block
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), MAT.beam(), M4(a.x - 0.2, WALL_H + 0.6, z));                                // post lashing the butt
    for (const s2 of [-1, 1]) b.add(new THREE.TorusGeometry(0.19, 0.04, 6, 14), MAT.rope(), new THREE.Matrix4().compose(V(PAR_IN + 0.3, a.y + 0.12, z + s2 * 0.25), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2), V(1, 1, 1)));
    b.build(this.bombG);
    this.chain = new Strand(2, 0.09, 0.09, lam("chainHD", () => ({})));
    this.bombG.add(this.chain.mesh);
    this.bomb = new THREE.Group(); this.bombG.add(this.bomb);
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.4, 22, 16), MAT.bomb()); bm.castShadow = true; this.bomb.add(bm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), MAT.iron()); ring.position.y = 0.45; this.bomb.add(ring);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 26).rotateX(Math.PI / 2), MAT.iron()); this.bomb.add(band);
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), MAT.rope()); fuse.position.set(0.22, 0.43, 0); fuse.rotation.z = -0.7; this.bomb.add(fuse);
  }

  // ---------------------------------------------------------------------------------------------- torches
  private buildTorches() {
    const b = new Batch();
    for (let k = 0; k < 4; k++) for (let a = -54; a <= 54; a += 9) {
      if (k === 0 && Math.abs(a) < 9) continue;
      const [x, , z] = sideW(k, PAR_IN - 0.12, 0, a + 1);
      b.add(new THREE.CylinderGeometry(0.05, 0.04, 1.8, 6).translate(0, 0.9, 0), MAT.torch(), M4(x, WALL_H, z));
      b.add(new THREE.CylinderGeometry(0.11, 0.07, 0.3, 8).translate(0, 1.9, 0), MAT.iron(), M4(x, WALL_H, z));
      this.torchPos.push(V(x, WALL_H + 2.2, z));
    }
    b.build(this.group);
    const fg = mergeGeometries([new THREE.SphereGeometry(0.16, 10, 8).translate(0, 0.08, 0), new THREE.ConeGeometry(0.14, 0.42, 10).translate(0, 0.32, 0)], false);
    this.torches = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 2.4, 0.55) }), this.torchPos.length);
    this.torches.layers.set(NOINK); this.torches.frustumCulled = false; this.group.add(this.torches);
  }

  // ================================================================================================ per frame
  update(sid: number, f: number, cam: THREE.PerspectiveCamera) {
    const S = SHOTS[sid - 1];
    this.group.visible = S.set === "kaifeng";
    if (!this.group.visible) { this.glow.col.set(0, 0, 0); return; }
    const night = S.light === "night";
    const { m4, q4, v3, s3 } = this;
    // ---- dents
    const pk = pockK(f), DD = this.dentData, X = new THREE.Vector3(), Y = new THREE.Vector3();
    const bins: number[][] = Array.from({ length: 4 * NBIN }, () => []);
    let nd = 0;
    this.dentList.forEach((d, i) => {
      const g = d.f !== undefined ? clamp01((f - d.f) / 2) : clamp01((pk - (d.t ?? 2)) / 0.006);
      const e = g <= 0 ? 0 : 0.35 + 0.65 * smooth(g);
      this.dents.setMatrixAt(i, m4.compose(d.p, d.q, s3.copy(d.s).multiplyScalar(e)));
      if (e <= 0 || nd >= MAX_DENTS) return;
      X.set(1, 0, 0).applyQuaternion(d.q).divideScalar(d.s.x * e); Y.set(0, 1, 0).applyQuaternion(d.q).divideScalar(d.s.y * e);
      const o = nd * 12, bnd = Math.max(d.s.x, d.s.y) * e * 1.05;
      DD[o] = d.p.x; DD[o + 1] = d.p.y; DD[o + 2] = d.p.z; DD[o + 3] = bnd * bnd;
      DD[o + 4] = X.x; DD[o + 5] = X.y; DD[o + 6] = X.z; DD[o + 8] = Y.x; DD[o + 9] = Y.y; DD[o + 10] = Y.z;
      const [sd, a] = this.dentSide[i];
      const b0 = Math.max(0, Math.floor((a - bnd + HALF) / BIN_W)), b1 = Math.min(NBIN - 1, Math.floor((a + bnd + HALF) / BIN_W));
      for (let b = b0; b <= b1; b++) bins[sd * NBIN + b].push(nd);
      nd++;
    });
    let at = 0;
    bins.forEach((l, b) => {
      const o = (DTEX_W + b) * 4, n = Math.min(48, l.length, DTEX_W - at);
      DD[o] = at; DD[o + 1] = n;
      for (let j = 0; j < n; j++) DD[(2 * DTEX_W + at + j) * 4] = l[j];
      at += n;
    });
    this.dents.instanceMatrix.needsUpdate = true;
    DENT_U.uDentN.value = nd; DENT_U.uDents.value!.needsUpdate = true;
    // ---- heap
    const hk = heapK(f);
    this.heapMesh.visible = hk > 0.002;
    if (this.heapMesh.visible && Math.abs(hk - this.heapKey) > 1e-5) {
      this.heapKey = hk;
      const pos = this.heapMesh.geometry.attributes.position as THREE.BufferAttribute, nx = this.heapXs.length;
      for (let j = 0; j < this.heapZs.length; j++) for (let i = 0; i < nx; i++) pos.setY(j * nx + i, heapH(this.heapXs[i], this.heapZs[j], hk) - 0.06);
      pos.needsUpdate = true; this.heapMesh.geometry.computeVertexNormals();
    }
    for (const R of this.rocks) {
      R.list.forEach((rk, i) => {
        const g = clamp01((hk - rk.b) / 0.012);
        if (g <= 0) { R.im.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
        v3.copy(rk.p); v3.y -= (1 - smooth(g)) * rk.r * 1.2;
        R.im.setMatrixAt(i, m4.compose(v3, rk.q, rk.s));
      });
      R.im.instanceMatrix.needsUpdate = true;
    }
    // ---- TOWER_SMASH
    const sk = towerSmashK(f), sm = this.smash, fall = sk * sk;
    sm.roofP.rotation.z = -0.62 * fall; sm.roofP.position.set(-2.3 - 0.5 * fall, 4.2 - 1.0 * fall, 0); sm.roofP.rotation.x = 0.08 * fall;
    sm.post0P.rotation.set(-0.25 * fall, 0, 1.25 * fall); sm.post1P.rotation.set(0.2 * fall, 0, 1.1 * fall);
    sm.front.visible = f < 782;
    const tp = (f - 782) / 30;
    this.planks.visible = tp >= 0;
    if (tp >= 0) this.plankList.forEach((pl, i) => {
      const t = Math.min(tp, pl.tl);
      v3.set(pl.p0.x + pl.v.x * t, pl.p0.y + pl.v.y * t - 4.9 * t * t, pl.p0.z + pl.v.z * t);
      const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(pl.w.x * t, pl.w.y * t, pl.w.z * t)).multiply(pl.q0);
      const land = smooth((t / pl.tl - 0.7) / 0.3);
      q4.copy(spin).slerp(pl.qEnd, land);
      if (land > 0) v3.y = Math.max(v3.y, pl.floor + pl.s.y / 2);
      this.planks.setMatrixAt(i, m4.compose(v3, q4, pl.s));
    });
    this.planks.instanceMatrix.needsUpdate = true;
    // ---- TOWER_HERO padding
    const dk = dungK(f);
    this.dungList.forEach((d, i) => {
      const g = clamp01((dk - d.k0) / 0.08), sq = g <= 0 ? 0 : 1 + 0.5 * (1 - smooth(g));
      this.dung.setMatrixAt(i, m4.compose(d.p, d.q, s3.set(d.s.x * sq * Math.min(1, g * 3), d.s.y * sq * Math.min(1, g * 3), d.s.z * (g <= 0 ? 0 : 1 / sq))));
    });
    this.dung.instanceMatrix.needsUpdate = true;
    const stk = strawK(f);
    this.strawList.forEach((st, i) => {
      const g = clamp01((stk - st.k0) / 0.09);
      v3.copy(st.p); v3.y += (1 - smooth(g)) * 1.4;
      this.straw.setMatrixAt(i, m4.compose(v3, st.q, s3.setScalar(g <= 0 ? 0 : 1)));
    });
    this.straw.instanceMatrix.needsUpdate = true;
    const fk = feltK(f);
    for (const p of this.felts) {
      const g = clamp01((fk - p.k0) / 0.3);
      p.o.visible = g > 0;
      const ch = p.o.children[0];
      ch.position.y = (1 - smooth(g)) * 1.3; ch.scale.set(1, 0.35 + 0.65 * smooth(g), 1);
    }
    // ---- the defenders' trebuchet + the Taihu rock
    const bk = beamK(f, [DEF_FIRE]), th = THREE.MathUtils.degToRad(lerp(232, 75, bk));
    const tb = this.tb;
    tb.beam.rotation.z = th;
    const pv = V(0, 5.4, 0), tip = pv.clone().add(V(Math.cos(th) * 4.2, Math.sin(th) * 4.2, 0)), sht = pv.clone().add(V(-Math.cos(th) * 1.6, -Math.sin(th) * 1.6, 0));
    tb.ropes.forEach((r, i) => setRod(r, sht, tb.anchors[i], 0.025));
    const fromL = V(3.0, 7.5, 0), restS = V(-0.25, -1.4, 0), thrS = fromL.clone().sub(V(1.087, 5.4 + 4.057, 0));
    const sv = restS.clone().lerp(thrS, smooth(bk)), pouch = tip.clone().add(sv);
    tb.sling.forEach((r, i) => setRod(r, tip, pouch.clone().add(V(0, 0.5, i ? 0.25 : -0.25)), 0.02));
    const gp = PROJ.find((p) => p.kind === "garden")!;
    let rv = false;
    if (f >= 935 && f < DEF_FIRE) { this.rock.position.copy(pouch).add(V(...DEF_TB)).add(V(0, 0.15, 0)); this.rock.rotation.set(0, 0.4, 0); rv = true; }
    else if (f >= DEF_FIRE && f <= gp.f1) {
      const p = projAt(gp, f)!, u = (f - DEF_FIRE) / (gp.f1 - DEF_FIRE);
      this.rock.position.set(...p); this.rock.rotation.set(0.25 * u + 2.2 * Math.sin(Math.PI * u), 0.4 + 1.3 * u, -0.15 * u + 0.8 * Math.sin(Math.PI * u)); rv = true;
    } else if (f > gp.f1 && f < 1365) { this.rock.position.set(gp.to[0], gp.to[1], gp.to[2]); this.rock.rotation.set(0.25, 1.7, -0.15); rv = true; }
    this.rock.visible = rv;
    // ---- the boom, chain + bomb (centre = bombAt(f), the shared contract)
    this.bombG.visible = f >= 1044;   // set up off-screen (the camera is down at the tents, the parapet above frame) before "lowered" (1073)
    if (this.bombG.visible) {
      const bp = bombAt(f), z = BOMB_TIP[2], tipY = BOMB_TIP[1] + 0.75, alive = f < BOOM_F;
      this.bomb.visible = alive;
      this.bomb.position.set(...bp);
      const end = alive ? V(bp[0], bp[1] + 0.52, bp[2]) : V(BOMB_TIP[0], 2.3, z), px = BOMB_TIP[0] - 0.24;
      this.chain.set([V(PAR_IN - 0.45, WALL_H + SILL + 0.3, z), V(px - 0.17, tipY + 0.2, z), V(px, tipY + 0.25, z), V(px + 0.17, tipY + 0.18, z), V(BOMB_TIP[0], tipY, z), end]);
    }
    // ---- the gate (bar lifted 1938-1956, then the leaves swing inward with gateK)
    const gk = smooth(gateK(f)), ang = gk * THREE.MathUtils.degToRad(86);
    for (const d of this.doors) d.rotation.y = d.userData.s > 0 ? ang : -ang;
    // ---- night torches
    this.torches.visible = night;
    if (night) {
      this.torchPos.forEach((p, i) => {
        const fl = 0.85 + 0.3 * hash(Math.floor(f / 2) + i * 13, 3);
        this.torches.setMatrixAt(i, m4.compose(p, q4.identity(), s3.set(1, fl, 1)));
      });
      this.torches.instanceMatrix.needsUpdate = true;
      this.glow.pos.set(WALK_C, WALL_H + 3, -WALK_C); this.glow.col.set(2.4, 1.1, 0.3); this.glow.r = 9;
    } else if (cam.position.x > 44 && cam.position.x < 58 && Math.abs(cam.position.z) < GATE_W / 2 && cam.position.y < GATE_HGT) {
      // inside the gate passage: warm bounce from the sunlit ground in the opening
      this.glow.pos.set(53.5, 1.4, 0); this.glow.col.set(0.55, 0.42, 0.28); this.glow.r = 6.5;
    } else this.glow.col.set(0, 0, 0);
  }
}

// ================================================================================================ geometry makers
/** orient a unit cylinder (base at 0, height 1 along y) from a to b (local to its parent) */
const setRod = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const d = b.clone().sub(a), L = d.length();
  m.position.copy(a); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(L || 1)); m.scale.set(r, L, r);
};

/** Chinese house (front = local +z): plaster walls (door front), gable or hip tile roof with a ridge cap */
const cnHouse = (add: Add, x: number, z: number, yaw: number, w: number, d: number, h: number, st: number, hip: boolean) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6, rh = d * 0.36 + 0.4;
  if (inTheWay(x - hx, x + hx, 0, h + rh + 0.6, z - hz, z + hz)) return;
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const fw = plasterMat(st, true), sw = plasterMat(st, false), wc = lam("kfGab" + st, () => ({ color: PLASTER[st].wall }));
  const hw = w / 2, hd = d / 2, ov = 0.55;
  add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), fw, m);
  add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), sw, m);
  add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), sw, m);
  add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), sw, m);
  add(UB, MAT.stone(), m.clone().multiply(boxM(-hw - 0.08, hw + 0.08, -0.05, 0.35, -hd - 0.08, hd + 0.08)));
  if (hip) {
    addRoof(add, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h, 0)), hw + ov, hd + ov, rh, Math.max(0.3, hw - hd), 0, 0.22, ov + 0.1);
    return;
  }
  add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wc, m);
  add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wc, m);
  const rm = MAT.tile(), U1 = (w + 2 * ov) / P.TILE_W, V1 = Math.hypot(hd + ov, rh) / P.TILE_W;
  add(quad(V(-hw - ov, h - 0.2, hd + ov), V(hw + ov, h - 0.2, hd + ov), V(hw + ov, h + rh, 0), V(-hw - ov, h + rh, 0), U1, V1), rm, m);
  add(quad(V(hw + ov, h - 0.2, -hd - ov), V(-hw - ov, h - 0.2, -hd - ov), V(-hw - ov, h + rh, 0), V(hw + ov, h + rh, 0), U1, V1), rm, m);
  // underside of the eaves + eave edges + ridge with upturned ends
  add(quad(V(hw + ov, h - 0.2, hd + ov), V(-hw - ov, h - 0.2, hd + ov), V(-hw - ov, h - 0.02, hd), V(hw + ov, h - 0.02, hd)), MAT.soffit(), m);
  add(quad(V(-hw - ov, h - 0.2, -hd - ov), V(hw + ov, h - 0.2, -hd - ov), V(hw + ov, h - 0.02, -hd), V(-hw - ov, h - 0.02, -hd)), MAT.soffit(), m);
  for (const s of [-1, 1]) add(UB, MAT.fascia(), m.clone().multiply(boxM(-hw - ov, hw + ov, h - 0.36, h - 0.18, s * (hd + ov) - 0.08, s * (hd + ov) + 0.08)));
  add(UB, MAT.ridge(), m.clone().multiply(boxM(-hw - ov - 0.1, hw + ov + 0.1, h + rh - 0.1, h + rh + 0.24, -0.16, 0.16)));
  for (const s of [-1, 1]) add(UB, MAT.ridge(), m.clone().multiply(new THREE.Matrix4().compose(V(s * (hw + ov + 0.1), h + rh + 0.3, 0), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * 0.45), V(0.2, 0.5, 0.3))));
};

/** palace hall: stone platform, red columns, red-brown walls, hip roof (double roof for the main hall) */
const hall = (add: Add, x: number, z: number, w: number, d: number, h: number, plat: number, yaw: number, dbl: boolean) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z), hw = w / 2, hd = d / 2;
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? hd : hw) + 2, hz = (across ? hw : hd) + 2;
  if (inTheWay(x - hx, x + hx, 0, plat + h + 5, z - hz, z + hz)) return;
  const B = (mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => add(UB, mat, m.clone().multiply(boxM(x0, x1, y0, y1, z0, z1)));
  if (plat > 0) {
    B(MAT.stone(), -hw - 1.2, hw + 1.2, 0, plat, -hd - 1.2, hd + 1.2);
    B(MAT.stone(), -2, 2, 0, plat * 0.5, hd + 1.2, hd + 2.6);
  }
  const y0 = plat;
  B(lam("kfHallW", () => ({ color: "#9a4632" })), -hw + 0.6, hw - 0.6, y0, y0 + h - 0.3, -hd + 0.6, hd - 0.6);
  const nC = Math.max(2, Math.round(w / 3));
  for (let i = 0; i <= nC; i++) for (const s of [-1, 1]) {
    const cx = -hw + 0.3 + (i * (w - 0.6)) / nC;
    add(new THREE.CylinderGeometry(0.22, 0.24, h, 10).translate(0, h / 2, 0), MAT.red(), m.clone().multiply(new THREE.Matrix4().makeTranslation(cx, y0, s * (hd - 0.3))));
  }
  B(MAT.red(), -hw, hw, y0 + h - 0.45, y0 + h, -hd, hd);
  const rm = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, y0 + h, 0));
  if (dbl) {
    addRoof(add, rm, hw + 1.6, hd + 1.6, 1.3, hw - 0.6, hd - 0.6, 0.45, 2.2);
    B(lam("kfHallW", () => ({ color: "#9a4632" })), -hw + 0.6, hw - 0.6, y0 + h + 1.0, y0 + h + 2.4, -hd + 0.6, hd - 0.6);
    addRoof(add, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, y0 + h + 2.4, 0)), hw + 0.6, hd + 0.6, hd * 0.75, Math.max(0.5, hw - hd), 0, 0.45, 1.2);
  } else addRoof(add, rm, hw + 1.1, hd + 1.1, hd * 0.75 + 0.4, Math.max(0.4, hw - hd), 0, 0.35, 1.3);
};

/** the gate tower: lower hall (posts, plank walls), pent roof ring, upper hall with balcony rail, top hip roof */
const add2Storey = (add: Add, rc: number, D: number, W: number, y0: number) => {
  const B = (mat: THREE.Material, x0: number, x1: number, ya: number, yb: number, z0: number, z1: number) => add(UB, mat, boxM(rc + x0, rc + x1, y0 + ya, y0 + yb, z0, z1));
  const hd = D / 2, hw = W / 2, H1 = 4.2;
  const post = (x: number, z: number, h: number, yb = 0) => add(new THREE.CylinderGeometry(0.22, 0.24, h, 10).translate(0, h / 2, 0), MAT.red(), M4(rc + x, y0 + yb, z));
  for (let i = 0; i <= 5; i++) for (const s of [-1, 1]) post(s * hd, -hw + (i * W) / 5, H1);
  for (const s of [-1, 1]) post(0, s * hw, H1);
  // walls: plank panels between posts (front + back), door openings in the middle bay at the back, sides closed
  for (let i = 0; i < 5; i++) {
    const za = -hw + (i * W) / 5 + 0.2, zb = -hw + ((i + 1) * W) / 5 - 0.2;
    B(MAT.slits(), hd - 0.18, hd - 0.04, 0, 3.4, za, zb);
    if (i !== 2) B(MAT.plank(), -hd + 0.04, -hd + 0.18, 0, 3.4, za, zb);
  }
  for (const s of [-1, 1]) B(MAT.plank(), -hd, hd, 0, 3.4, s * hw - 0.09, s * hw + 0.09);
  B(MAT.red(), -hd - 0.15, hd + 0.15, 3.4, 3.65, -hw - 0.15, hw + 0.15);
  B(MAT.red(), -hd - 0.15, hd + 0.15, H1 - 0.35, H1, -hw - 0.15, hw + 0.15);
  // pent roof (eave ring) from the lower hall to the upper hall's wall line
  addRoof(add, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(rc, y0 + H1, 0), hw + 1.7, hd + 1.7, 1.3, hw - 1.3, hd - 1.3, 0.5, 1.9);
  // upper hall
  const uw = hw - 1.5, ud = hd - 1.4, H2 = 3.4, yu = H1 + 1.0;
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) post(s * ud, -uw + (i * 2 * uw) / 4, H2, yu);
  for (let i = 0; i < 4; i++) {
    const za = -uw + (i * 2 * uw) / 4 + 0.2, zb = -uw + ((i + 1) * 2 * uw) / 4 - 0.2;
    for (const s of [-1, 1]) B(MAT.plank(), s * ud - 0.07, s * ud + 0.07, yu, yu + H2 - 0.4, za, zb);
  }
  for (const s of [-1, 1]) B(MAT.plank(), -ud, ud, yu, yu + H2 - 0.4, s * uw - 0.07, s * uw + 0.07);
  B(MAT.red(), -ud - 0.12, ud + 0.12, yu + H2 - 0.4, yu + H2, -uw - 0.12, uw + 0.12);
  // balcony rail on the pent roof's top edge
  B(MAT.red(), -ud - 0.75, ud + 0.75, yu + 0.75, yu + 0.85, -uw - 0.75, -uw - 0.65);
  B(MAT.red(), -ud - 0.75, ud + 0.75, yu + 0.75, yu + 0.85, uw + 0.65, uw + 0.75);
  for (const s of [-1, 1]) B(MAT.red(), s * (ud + 0.7) - 0.05, s * (ud + 0.7) + 0.05, yu + 0.75, yu + 0.85, -uw - 0.75, uw + 0.75);
  addRoof(add, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(rc, y0 + yu + H2, 0), uw + 1.7, ud + 1.6, 2.6, uw - ud + 0.6, 0, 0.55, 1.7);
};

/** clay jar (lathe, open mouth, dark empty inside via vertex colour) */
const jarGeo = () => {
  const out = [[0.001, 0], [0.27, 0], [0.37, 0.1], [0.44, 0.36], [0.44, 0.62], [0.36, 0.88], [0.24, 1.0], [0.22, 1.08], [0.26, 1.12], [0.25, 1.16]];
  const inn = [[0.2, 1.14], [0.19, 1.04], [0.31, 0.86], [0.38, 0.6], [0.38, 0.36], [0.31, 0.14], [0.001, 0.1]];
  const pts = [...out, ...inn].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 22);
  const p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const j = i % pts.length, k = j >= out.length ? (j === out.length ? 0.45 : 0.28) : 1;
    c[i * 3] = k; c[i * 3 + 1] = k * 0.95; c[i * 3 + 2] = k * 0.9;
    uv.setY(i, j < out.length ? 1 - pts[j].y / 1.16 : 0.9);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
};
/** a flat, rumpled empty sack on the ground (0.65 x 0.95 m) */
const sackGeo = () => {
  const g = new THREE.PlaneGeometry(0.65, 0.95, 6, 8).rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.02 + 0.035 * Math.sin(x * 9 + z * 4) * Math.cos(z * 7)); }
  g.computeVertexNormals();
  return g;
};
/** felt blanket hung over a rail along local z: inner drop dIn (to -x), over the rail, outer drop dOut (to +x), folds */
const drapeGeo = (W: number, dOut: number, dIn: number, seed: number) => {
  const nu = 18, nv = 16, path: [number, number][] = [[-0.13, -dIn], [-0.14, -0.1], [-0.07, 0.07], [0.07, 0.07], [0.14, -0.1], [0.17, -dOut]];
  const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = cum[cum.length - 1], at = (s: number) => { let i = 1; while (i < path.length - 1 && cum[i] < s) i++; const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1]); return [lerp(path[i - 1][0], path[i][0], u), lerp(path[i - 1][1], path[i][1], u)]; };
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const z = (i / nu - 0.5) * W, s = (j / nv) * L, [x0, y0] = at(s), depth = Math.min(1, Math.max(0, -y0) / 0.6);
    const fold = 0.06 * Math.sin(z * 5.5 + seed * 1.7) * depth + 0.03 * Math.sin(z * 11 + seed) * depth;
    const hem = (j === 0 || j === nv) ? 0.05 * Math.sin(z * 4 + seed * 3) : 0;
    pos.push(x0 + Math.sign(x0 || 1) * fold, y0 + hem - 0.04 * depth * Math.cos(z * 2.2 + seed), z * (1 - 0.04 * depth));
    uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** felt blanket thrown over a hip roof (local: roof eave at y = 0), covering z0..z1, hanging over both eaves */
const roofFeltGeo = (hw: number, hd: number, H: number, thw: number, z0: number, z1: number, seed: number) => {
  const nu = 22, nv = 12, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const roofY = (x: number, z: number) => {
    const sx = (hw - Math.abs(x)) / (hw - thw), sz = (hd - Math.abs(z)) / hd, s = Math.max(0, Math.min(1, Math.min(sx, sz)));
    return H * s ** 1.6;
  };
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const x = (i / nu - 0.5) * 2 * (hw + 0.5), z = lerp(z0, z1, j / nv), over = Math.max(0, Math.abs(x) - hw);
    const y = (over > 0 ? -over * 2.2 : roofY(x, z)) + 0.1 + 0.04 * Math.sin(x * 3 + seed) * Math.sin(z * 4 + seed);
    pos.push(Math.sign(x) * Math.min(Math.abs(x), hw + 0.15), y, z); uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** the Taihu garden rock: water-worn limestone (~1.4 m tall) built from fat, lumpy rings (real see-through holes)
 *  and knobs, with darker hollows (vertex colour on the rings' inner sides) */
const taihuGeo = () => {
  const parts: THREE.BufferGeometry[] = [];
  const lump = (g0: THREE.BufferGeometry, seed: number, m: THREE.Matrix4, ring: number) => {
    let g = g0; g.deleteAttribute("normal"); g.deleteAttribute("uv"); g = mergeVertices(g);
    const p = g.attributes.position as THREE.BufferAttribute, n = p.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i)), d = v.clone().normalize();
      const k = 1 + 0.13 * Math.sin(v.x * 9 + seed) * Math.sin(v.y * 8 - seed) + 0.07 * Math.sin(v.z * 15 + v.x * 6);
      const inner = ring > 0 ? Math.max(0, 1 - Math.hypot(v.x, v.y) / ring) : 0;   // inside of the ring: darker
      const pv = ring > 0 ? V(v.x, v.y, v.z).multiplyScalar(1).add(V(v.x, v.y, 0).normalize().multiplyScalar((k - 1) * 0.25)).setZ(v.z * k) : v.multiplyScalar(k);
      p.setXYZ(i, pv.x, pv.y, pv.z);
      const c = 1 - 0.55 * Math.min(1, inner * 2.2); col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 1.03;
      uv[i * 2] = Math.atan2(d.z, d.x) / TAU + 0.5; uv[i * 2 + 1] = d.y * 0.5 + 0.5;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.applyMatrix4(m); g.computeVertexNormals();
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const E = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));
  lump(new THREE.IcosahedronGeometry(0.42, 4), 4, E(0, -0.42, 0, 0, 0, 0), 0);
  lump(new THREE.TorusGeometry(0.3, 0.24, 14, 26), 1, E(0.05, -0.05, 0.02, 0.2, 0.5, 0.15), 0.3);
  lump(new THREE.TorusGeometry(0.22, 0.17, 12, 22), 2, E(-0.08, 0.38, 0.0, 0.5, 1.6, -0.25), 0.22);
  lump(new THREE.TorusGeometry(0.15, 0.13, 10, 20), 3, E(0.14, 0.7, 0.05, -0.2, 0.3, 0.5), 0.15);
  lump(new THREE.IcosahedronGeometry(0.2, 3), 5, E(0.3, 0.18, -0.1, 0, 0, 0), 0);
  lump(new THREE.IcosahedronGeometry(0.17, 3), 6, E(-0.28, 0.12, 0.12, 0, 0, 0), 0);
  lump(new THREE.IcosahedronGeometry(0.13, 3), 7, E(-0.05, 0.92, -0.02, 0, 0, 0), 0);
  return mergeGeometries(parts, false);
};
