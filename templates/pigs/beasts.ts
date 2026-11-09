// The animals + flying props: toon war elephants (every elephant of every set from story.elephantsAt), toon pigs
// (story.pigsAt: walking, running, pitch-black, burning with HDR flames, carried, hanging), the spears + the arrow
// volley, the rope of the Edessa pig. OWNER: beast (beasts.ts + paintbeast.ts).
//
// Look (cartoon-3d-short toon language, toon3d.ts): chunky rounded superellipsoid volumes, toonMat two-tone shading,
// the weighted plum inverted hull (#2a1b26, 0.022 -> 0.05 of a head size, thin on the lit side), swapped Canvas2D face
// decals (white eyes, ink pupils + brows), no squash/stretch, holds dead still (stand = no idle).
// Everything is a pure function of (sid, f) (f fractional): gaits from EleState/PigState.phase with an amplitude from
// the animal's own speed (sampled from the contract at f +- 1.5, so starts/stops ease and never pop), flames and
// smoke from story.hash + st. Geometry is built once; per frame only transforms, instance matrices, maps, colours.
// Elephant local frame = story.ts: +z forward, rear pitch about REAR_PIVOT exactly as eleLocalToWorld (riders glue).
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TOON3D, INK3, toonMat } from "./toon3d";
import { NOINK } from "./ink";
import {
  elephantsAt, pigsAt, storyF, SHOTS, hash, clamp01, smooth, eleLocalToWorld, REAR_DEG, REAR_PIVOT, HOWDAH_FLOOR,
  TURRET_TOP, SPEARS, N_ARROW, arrowShot, eleMegara, pigMegara, BEAM_TIP, type EleState, type PigState, type V3,
} from "./story";
import { eleFaceTex, pigFaceTex, trunkTex, clothTex, plankTex, glossTex, glowTex, ELE_PATCH, PIG_PATCH, type Patch } from "./paintbeast";

const TAU = Math.PI * 2, toR = Math.PI / 180;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ================================================================ ink hull (same as toon3d.ts, which keeps it private)
const HULL_VERT = /* glsl */ `
uniform vec3 uSunW; uniform float uLitW; uniform float uShadW;
void main() {
  vec3 nW = normalize( mat3( modelMatrix ) * normal );
  float shade = smoothstep( -0.1, 0.8, -dot( nW, uSunW ) );
  vec3 nV = normalize( normalMatrix * normal );
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  mvPosition.xyz += nV * mix( uLitW, uShadW, shade );
  gl_Position = projectionMatrix * mvPosition;
}`;
const HULL_FRAG = /* glsl */ `
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4( uInk, 1.0 );
  #include <colorspace_fragment>
}`;
const hullMats = new Map<string, THREE.ShaderMaterial>();
const hullMat = (hh: number, k = 1) => {
  const key = `${hh}_${k}`;
  let m = hullMats.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uSunW: TOON3D.uSunW, uLitW: { value: 0.022 * hh * k }, uShadW: { value: 0.05 * hh * k }, uInk: { value: new THREE.Color(INK3) } },
      vertexShader: HULL_VERT, fragmentShader: HULL_FRAG, side: THREE.BackSide, fog: false,
    });
    hullMats.set(key, m);
  }
  return m;
};
/** hull geometry: positions welded (split normals at box edges / uv seams averaged), so the shell never cracks */
const hullGeos = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const hullGeo = (g: THREE.BufferGeometry) => {
  let h = hullGeos.get(g);
  if (!h) {
    const c = new THREE.BufferGeometry();
    c.setAttribute("position", g.attributes.position.clone());
    if (g.index) c.setIndex(g.index.clone());
    h = mergeVertices(c, 1e-4); h.computeVertexNormals();
    hullGeos.set(g, h);
  }
  return h;
};
const addHull = (m: THREE.Mesh, hh: number, k = 1, smoothNormals = true) => {
  // the hull is a CHILD of its mesh (identity transform): it follows any later position / rotation / scale / visibility
  // of the part (copying the transform at creation left the pig body's hull at the feet: a dark disc under every pig)
  const h = new THREE.Mesh(smoothNormals ? hullGeo(m.geometry) : m.geometry, hullMat(hh, k));
  h.renderOrder = -1;
  h.frustumCulled = m.frustumCulled;
  m.add(h);
  return h;
};

// ================================================================ geometry helpers
/** the surface point of the superellipsoid |x/a|^p + |y/b|^p + |z/c|^p = 1 along direction d (from its centre) + normal */
const superPt = (dx: number, dy: number, dz: number, a: number, b: number, c: number, p: number) => {
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  const t = Math.pow(Math.abs(dx / a) ** p + Math.abs(dy / b) ** p + Math.abs(dz / c) ** p, -1 / p);
  const X = dx * t, Y = dy * t, Z = dz * t;
  let nx = (Math.sign(X) * Math.abs(X / a) ** (p - 1)) / a, ny = (Math.sign(Y) * Math.abs(Y / b) ** (p - 1)) / b, nz = (Math.sign(Z) * Math.abs(Z / c) ** (p - 1)) / c;
  const nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-8) { nx = dx; ny = dy; nz = dz; } else { nx /= nl; ny /= nl; nz /= nl; }
  return { p: [X, Y, Z] as V3, n: [nx, ny, nz] as V3 };
};
/** sphere-parametrised superellipsoid (chunky toon volumes), analytic normals; the sphere sub-range args make matching
 *  decal patches; k pushes the surface out (decals) */
const superGeo = (a: number, b: number, c: number, p: number, ws = 40, hs = 28, k = 1,
  phiStart = 0, phiLen = TAU, thStart = 0, thLen = Math.PI) => {
  const g = new THREE.SphereGeometry(1, ws, hs, phiStart, phiLen, thStart, thLen);
  const P = g.attributes.position as THREE.BufferAttribute, N = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const s = superPt(P.getX(i), P.getY(i), P.getZ(i), a, b, c, p);
    P.setXYZ(i, s.p[0] * k, s.p[1] * k, s.p[2] * k); N.setXYZ(i, s.n[0], s.n[1], s.n[2]);
  }
  g.computeBoundingSphere();
  return g;
};
/** decal patch geometry over a superellipsoid head (Patch: lon +-, lat0..lat1 in degrees) */
const decalGeo = (a: number, b: number, c: number, p: number, P: Patch, k = 1.008) =>
  superGeo(a, b, c, p, 48, 32, k, Math.PI / 2 - P.lon * toR, 2 * P.lon * toR, (90 - P.lat0) * toR, (P.lat0 - P.lat1) * toR);
/** rounded column (lathe) from y = 0 down to -len: domed top, rounded foot edge */
const columnGeo = (len: number, rTop: number, rBot: number, dome = 0.6, seg = 18) => {
  const pts: THREE.Vector2[] = [], rr = Math.min(0.14, rBot * 0.35);
  pts.push(new THREE.Vector2(0.001, -len));
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(rBot - rr + rr * Math.cos(a), -len + rr + rr * Math.sin(a))); }
  for (let i = 1; i <= 4; i++) { const t = i / 4; pts.push(new THREE.Vector2(rBot + (rTop - rBot) * t, -len + rr + (len - rr) * t)); }
  for (let i = 1; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.001, rTop * Math.cos(a)), rTop * dome * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, seg);
};
const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const tinted = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
};
const merge = (gs: THREE.BufferGeometry[]) => {
  const n = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of n) { if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  return mergeGeometries(n, false)!;
};

/** a tube of rings along a polyline (parallel-transport frames), rewritten in place (the trunk) or built once */
class TubeBuf {
  geo = new THREE.BufferGeometry();
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  constructor(public n: number, public radial: number, public vRep = 1) {
    const nv = n * (radial + 1);
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3); this.uv = new Float32Array(nv * 2);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
    this.geo.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
    this.geo.setIndex(idx);
  }
  private T = V(0, 0, 0); private N = V(0, 0, 0); private B = V(0, 0, 0);
  /** pts: n points, rad: n radii (< 1e-3 = a closing tip ring), n0: the first ring's frame normal */
  set(pts: THREE.Vector3[], rad: number[], n0: THREE.Vector3) {
    const { T, N, B, n, radial } = this;
    let total = 0; const cum = [0];
    for (let i = 1; i < n; i++) { total += pts[i].distanceTo(pts[i - 1]); cum.push(total); }
    N.copy(n0);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      T.subVectors(b, a).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N);
      const tip = rad[i] < 1e-3;
      for (let j = 0; j <= radial; j++) {
        const ang = (j / radial) * TAU, c = Math.cos(ang), s = Math.sin(ang);
        const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z, o = (i * (radial + 1) + j) * 3;
        this.pos[o] = pts[i].x + rad[i] * nx; this.pos[o + 1] = pts[i].y + rad[i] * ny; this.pos[o + 2] = pts[i].z + rad[i] * nz;
        if (tip) { this.nor[o] = T.x; this.nor[o + 1] = T.y; this.nor[o + 2] = T.z; } else { this.nor[o] = nx; this.nor[o + 1] = ny; this.nor[o + 2] = nz; }
        const u = (i * (radial + 1) + j) * 2; this.uv[u] = j / radial; this.uv[u + 1] = (cum[i] / Math.max(total, 1e-6)) * this.vRep;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
    return this.geo;
  }
}
const staticTube = (pts: THREE.Vector3[], rad: number[], n0: THREE.Vector3, radial = 10) => {
  const t = new TubeBuf(pts.length, radial); const g = t.set(pts, rad, n0); g.computeBoundingSphere(); return g;
};

// ================================================================ the elephant
const ELE_SKIN = "#858ca3", ELE_EAR = "#8d92aa", IVORY = "#f1e8d2", NAIL = "#e9dfc6";
const ELE_HH = 1.1;                              // "head size" for the hull weight (0.024 -> 0.055 m)
/** body superellipsoid (elephant-local, scale 1): its top is the howdah floor height (3.45) */
const BODY = { c: [0, 2.2, -0.3] as V3, a: 1.3, b: 1.25, z: 2.2, p: 2.6 };
const HEAD = { c: [0, 2.95, 2.3] as V3, a: 0.92, b: 0.95, z: 0.86, p: 2.2 };
const HIPS: { x: number; z: number; front: boolean; off: number }[] = [
  { x: 0.78, z: -1.7, front: false, off: 0 }, { x: 0.78, z: 1.1, front: true, off: 0.25 },
  { x: -0.78, z: -1.7, front: false, off: 0.5 }, { x: -0.78, z: 1.1, front: true, off: 0.75 },
];
const HIP_Y = 2.0, UPPER = 1.04, LOWER = 0.96;
/** body bob (m, up) of a walking / running elephant: riders on the back (eleLocalToWorld) should add it to y */
export const eleBob = (e: EleState) =>
  e.gait === "walk" ? 0.045 * (0.5 - 0.5 * Math.cos(2 * TAU * e.phase)) : e.gait === "run" ? 0.075 * Math.abs(Math.sin(TAU * e.phase)) : 0;
/** a contract point (elephant-local, e.g. SPEARS[k].local, arrowShot(k).local) moved onto the drawn hide + its normal */
export const eleHidePoint = (l: V3): { p: V3; n: V3 } => {
  const s = superPt(l[0] - BODY.c[0], l[1] - BODY.c[1], l[2] - BODY.c[2], BODY.a, BODY.b, BODY.z, BODY.p);
  return { p: [BODY.c[0] + s.p[0] - s.n[0] * 0.03, BODY.c[1] + s.p[1] - s.n[1] * 0.03, BODY.c[2] + s.p[2] - s.n[2] * 0.03], n: s.n };
};

type HowdahK = "king" | "tower" | "siege";
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; hull: number };
class EleShared {
  skin = toonMat(ELE_SKIN); ear = toonMat(ELE_EAR); ivory = toonMat(IVORY); nail = toonMat(NAIL);
  trunkMat = toonMat(ELE_SKIN, (() => { const t = trunkTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })());
  tuft = toonMat("#3a3340");
  wood = toonMat("#8a5a36"); woodD = toonMat("#5e3b22"); red = toonMat("#b8302a"); gold = toonMat("#e2b443");
  planks = toonMat("#ffffff", (() => { const t = plankTex(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t; })());
  leather = toonMat("#5b3a26"); rope = toonMat("#c9a76a");
  cloth: Record<HowdahK, THREE.MeshLambertMaterial> = { king: toonMat("#ffffff", clothTex("king")), tower: toonMat("#ffffff", clothTex("tower")), siege: toonMat("#ffffff", clothTex("siege")) };
  body = superGeo(BODY.a, BODY.b, BODY.z, BODY.p, 48, 32);
  head = superGeo(HEAD.a, HEAD.b, HEAD.z, HEAD.p, 40, 28);
  face = decalGeo(HEAD.a, HEAD.b, HEAD.z, HEAD.p, ELE_PATCH);
  earG = superGeo(0.11, 0.92, 0.74, 2.3, 24, 16);
  upper = columnGeo(UPPER + 0.02, 0.47, 0.43, 0.7);
  lower = columnGeo(LOWER, 0.43, 0.48, 0.5);
  nails: THREE.BufferGeometry; tusks: THREE.BufferGeometry; tail: THREE.BufferGeometry; tuftG: THREE.BufferGeometry;
  clothG: THREE.BufferGeometry; girth: THREE.BufferGeometry; neckRope: THREE.BufferGeometry;
  how: Record<HowdahK, Part[]>;
  constructor() {
    // three ivory toenails round the front of each foot
    const ng: THREE.BufferGeometry[] = [];
    for (const a of [-0.55, 0, 0.55]) { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.13, 0.1, 0.07); g.translate(Math.sin(a) * 0.45, -LOWER + 0.1, Math.cos(a) * 0.45); ng.push(g); }
    this.nails = merge(ng);
    // tusks: short curved ivory cones from under the eyes, forward then up (head-local)
    const tg: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const pts = [V(s * 0.3, -0.52, 0.55), V(s * 0.36, -0.7, 0.82), V(s * 0.42, -0.72, 1.08), V(s * 0.46, -0.6, 1.3), V(s * 0.48, -0.42, 1.42)];
      tg.push(staticTube(pts, [0.11, 0.1, 0.085, 0.06, 0.0005], V(1, 0, 0), 12));
    }
    this.tusks = merge(tg);
    // tail (thin, hanging) + tuft
    const tp = [V(0, 0, 0), V(0, -0.22, -0.14), V(0, -0.55, -0.2), V(0, -0.9, -0.17), V(0, -1.15, -0.12)];
    this.tail = staticTube(tp, [0.075, 0.06, 0.05, 0.042, 0.036], V(1, 0, 0), 8);
    this.tuftG = new THREE.SphereGeometry(1, 12, 10); this.tuftG.scale(0.085, 0.2, 0.085); this.tuftG.translate(0, -1.3, -0.12);
    // saddle cloth: a band over the back between two body "latitudes" (directions round the z axis from +y)
    this.clothG = this.clothPatch(-1.95, 1.95, -0.5, 0.3, 1.03);
    // girth band + neck rope: closed rings on the hide
    this.girth = this.ring(-0.35, 1.035, 0.05);
    this.neckRope = this.ring(1.72, 1.03, 0.045);
    // howdahs (elephant-local, floor top at HOWDAH_FLOOR)
    const F = HOWDAH_FLOOR, fy = F[1], fz = F[2];
    const tower = (king: boolean): Part[] => {
      const wood: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [], gold: THREE.BufferGeometry[] = [];
      wood.push(boxAt(1.95, 0.16, 1.95, 0, fy - 0.08, fz));
      const H = 1.08, hw = 0.9;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        wood.push(boxAt(0.13, H, 0.13, sx * hw, fy + H / 2, fz + sz * hw));
        if (king) { const g = new THREE.SphereGeometry(0.1, 12, 8); g.translate(sx * hw, fy + H + 0.06, fz + sz * hw); gold.push(g); }
      }
      for (const y of [0.5, 1.0]) {
        const into = y > 0.9 && king ? trim : wood;
        into.push(boxAt(1.86, 0.09, 0.09, 0, fy + y, fz + hw), boxAt(1.86, 0.09, 0.09, 0, fy + y, fz - hw));
        into.push(boxAt(0.09, 0.09, 1.86, hw, fy + y, fz), boxAt(0.09, 0.09, 1.86, -hw, fy + y, fz));
      }
      // low balusters between the floor and the lower rail
      for (let i = -2; i <= 2; i++) {
        const u = i * 0.32;
        wood.push(boxAt(0.05, 0.5, 0.05, u, fy + 0.25, fz + hw), boxAt(0.05, 0.5, 0.05, u, fy + 0.25, fz - hw));
        wood.push(boxAt(0.05, 0.5, 0.05, hw, fy + 0.25, fz + u), boxAt(0.05, 0.5, 0.05, -hw, fy + 0.25, fz + u));
      }
      const out: Part[] = [{ geo: merge(wood), mat: king ? this.woodD : this.wood, hull: 0.45 }];
      if (trim.length) out.push({ geo: merge(trim), mat: this.red, hull: 0.45 });
      if (gold.length) out.push({ geo: merge(gold), mat: this.gold, hull: 0.4 });
      return out;
    };
    // Persian siege turret: a tapered planked box up to TURRET_TOP, crenellated rim, base beams
    const T = TURRET_TOP, h0 = 3.36, H = T[1] - h0, hb = 1.18, ht = 1.02;
    const box = new THREE.CylinderGeometry(ht * Math.SQRT2, hb * Math.SQRT2, H, 4, 1, false, Math.PI / 4);
    box.translate(T[0], h0 + H / 2, T[2]);
    const crn: THREE.BufferGeometry[] = [boxAt(2.24, 0.14, 2.24, T[0], T[1] + 0.02, T[2])];
    for (let i = 0; i < 3; i++) {
      const u = (i - 1) * 0.74;
      crn.push(boxAt(0.42, 0.62, 0.2, T[0] + u, T[1] + 0.4, T[2] + 1.02), boxAt(0.42, 0.62, 0.2, T[0] + u, T[1] + 0.4, T[2] - 1.02));
      crn.push(boxAt(0.2, 0.62, 0.42, T[0] + 1.02, T[1] + 0.4, T[2] + u), boxAt(0.2, 0.62, 0.42, T[0] - 1.02, T[1] + 0.4, T[2] + u));
    }
    const beams = [boxAt(2.5, 0.16, 0.16, T[0], h0 + 0.1, T[2] + 1.2), boxAt(2.5, 0.16, 0.16, T[0], h0 + 0.1, T[2] - 1.2),
      boxAt(0.16, 0.16, 2.5, T[0] + 1.2, h0 + 0.1, T[2]), boxAt(0.16, 0.16, 2.5, T[0] - 1.2, h0 + 0.1, T[2])];
    this.how = {
      king: tower(true), tower: tower(false),
      siege: [{ geo: box, mat: this.planks, hull: 0.5 }, { geo: merge(crn), mat: this.woodD, hull: 0.45 }, { geo: merge(beams), mat: this.woodD, hull: 0.4 }],
    };
  }
  private bodyPt(dx: number, dy: number, dz: number, k: number) {
    const s = superPt(dx, dy, dz, BODY.a, BODY.b, BODY.z, BODY.p);
    return { p: V(BODY.c[0] + s.p[0] * k, BODY.c[1] + s.p[1] * k, BODY.c[2] + s.p[2] * k), n: V(...s.n) };
  }
  private clothPatch(a0: number, a1: number, b0: number, b1: number, k: number) {
    const nu = 28, nv = 10, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = a0 + ((a1 - a0) * i) / nu, b = b0 + ((b1 - b0) * j) / nv;
      const q = this.bodyPt(Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b), k);
      pos.push(q.p.x, q.p.y, q.p.z); nor.push(q.n.x, q.n.y, q.n.z); uv.push(i / nu, j / nv);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
  /** a closed band round the body at elephant-local z */
  private ring(z: number, k: number, r: number) {
    const dz = z - BODY.c[2], pts: THREE.Vector3[] = [];
    const sl = Math.max(0.02, 1 - Math.abs(dz / BODY.z) ** BODY.p) ** (1 / BODY.p);
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU, sx = Math.sin(a), sy = Math.cos(a);
      const t = Math.pow(Math.abs(sx / BODY.a) ** BODY.p + Math.abs(sy / BODY.b) ** BODY.p, -1 / BODY.p) * sl;
      pts.push(V(BODY.c[0] + sx * t * k, BODY.c[1] + sy * t * k, z));
    }
    return staticTube(pts, pts.map(() => r), V(0, 0, 1), 8);
  }
}

const TRUNK_N = 18;
const PHI0: number[] = [], PHI1: number[] = [], PHI2: number[] = [];
for (let k = 0; k < TRUNK_N; k++) {
  const u = k / (TRUNK_N - 1);
  // hanging: out of the face, down, the tip curling forward (a soft J)
  PHI0.push(0.42 - 0.3 * u + 1.9 * Math.max(0, (u - 0.72) / 0.28) ** 2);
  // trumpeting: swept up and back over the forehead in an S, the tip flaring forward
  PHI1.push(0.55 + 2.75 * smooth(u / 0.72) - 1.0 * Math.max(0, (u - 0.72) / 0.28) ** 1.2);
  // reaching: out forward and curling up at the tip toward something hanging in front of the face (Edessa)
  PHI2.push(0.75 + 0.55 * u + 1.7 * Math.max(0, (u - 0.55) / 0.45) ** 1.4);
}

class EleRig {
  root = new THREE.Group(); private rearG = new THREE.Group(); private offG = new THREE.Group(); private bobG = new THREE.Group();
  private headG = new THREE.Group(); private faceMat: THREE.MeshBasicMaterial;
  private ears: THREE.Group[] = []; private tuskG = new THREE.Group(); private tailG = new THREE.Group();
  private legs: { hip: THREE.Group; knee: THREE.Group; front: boolean; side: number; off: number }[] = [];
  private trunk = new TubeBuf(TRUNK_N + 1, 12, 2.2); private trunkPts = Array.from({ length: TRUNK_N + 1 }, () => V(0, 0, 0)); private trunkRad: number[] = [];
  private clothG: Record<HowdahK, THREE.Group> = { king: new THREE.Group(), tower: new THREE.Group(), siege: new THREE.Group() };
  private howG: Record<HowdahK, THREE.Group> = { king: new THREE.Group(), tower: new THREE.Group(), siege: new THREE.Group() };
  private harness = new THREE.Group();
  constructor(S: EleShared, public idx: number) {
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, hull = 1, cast = true) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m);
      if (hull > 0) addHull(m, ELE_HH, hull);
      return m;
    };
    this.root.add(this.rearG); this.rearG.position.set(...REAR_PIVOT);
    this.rearG.add(this.offG); this.offG.position.set(-REAR_PIVOT[0], -REAR_PIVOT[1], -REAR_PIVOT[2]);
    this.offG.add(this.bobG);
    add(this.bobG, S.body, S.skin).position.set(...BODY.c);
    // head (+ face decal, ears, tusks, trunk) in its own group so a baby can have a bigger head
    this.headG.position.set(...HEAD.c); this.bobG.add(this.headG);
    add(this.headG, S.head, S.skin);
    this.faceMat = new THREE.MeshBasicMaterial({ map: eleFaceTex("calm"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const face = new THREE.Mesh(S.face, this.faceMat); face.renderOrder = 2; this.headG.add(face);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.74, 0.12, -0.22); this.headG.add(g); this.ears.push(g);
      add(g, S.earG, S.ear, 0.8).position.set(s * 0.04, -0.22, -0.62);
    }
    this.headG.add(this.tuskG); add(this.tuskG, S.tusks, S.ivory, 0.55);
    for (let i = 0; i <= TRUNK_N; i++) this.trunkRad.push(i === TRUNK_N ? 0.0005 : i === TRUNK_N - 1 ? 0.085 : 0.3 + (0.115 - 0.3) * Math.pow(i / (TRUNK_N - 2), 0.85));
    const tm = new THREE.Mesh(this.trunk.geo, S.trunkMat); tm.castShadow = true; tm.receiveShadow = true; tm.frustumCulled = false; this.headG.add(tm);
    addHull(tm, ELE_HH, 0.9, false);
    // tail
    this.tailG.position.set(0, 2.75, -2.36); this.bobG.add(this.tailG);
    add(this.tailG, S.tail, S.skin, 0.6); add(this.tailG, S.tuftG, S.tuft, 0.5);
    // legs: hip pivots on the rear group (not bobbed), knee pivots, toenails
    for (const h of HIPS) {
      const hip = new THREE.Group(); hip.position.set(h.x, HIP_Y, h.z); this.offG.add(hip);
      add(hip, S.upper, S.skin);
      const knee = new THREE.Group(); knee.position.set(0, -UPPER, 0); hip.add(knee);
      add(knee, S.lower, S.skin); add(knee, S.nails, S.nail, 0, false);
      this.legs.push({ hip, knee, front: h.front, side: Math.sign(h.x), off: h.off });
    }
    // cloths, harness, howdahs
    for (const k of ["king", "tower", "siege"] as HowdahK[]) {
      this.bobG.add(this.clothG[k]); add(this.clothG[k], S.clothG, S.cloth[k], 0.5);
      this.bobG.add(this.howG[k]);
      for (const p of S.how[k]) add(this.howG[k], p.geo, p.mat, p.hull);
    }
    this.bobG.add(this.harness); add(this.harness, S.girth, S.leather, 0.4); add(this.harness, S.neckRope, S.rope, 0.4);
  }
  update(e: EleState, gk: number, ph: number, mode: "walk" | "run", st: number) {
    const r = this.root;
    r.visible = e.vis;
    if (!e.vis) return;
    r.position.set(...e.pos); r.rotation.set(0, e.yaw, 0); r.scale.setScalar(e.scale);
    this.rearG.rotation.x = -e.rear * REAR_DEG * toR;
    this.bobG.position.y = eleBob(e);
    this.headG.scale.setScalar(e.scale < 0.8 ? 1.22 : 1);
    this.faceMat.map = eleFaceTex(e.eyes);
    // legs
    const run = mode === "run", A = (run ? 0.44 : 0.3) * gk, Fk = (run ? 1.05 : 0.6) * gk;
    for (const L of this.legs) {
      const u = TAU * (ph - L.off), sw = Math.sin(u), cw = Math.cos(u);
      let hx = -A * sw, kx = Fk * Math.max(0, cw) ** 1.5;
      if (L.front && e.rear > 0) { // rearing: forelegs up and pawing
        hx += -0.55 * e.rear; kx += e.rear * (1.0 + 0.35 * Math.sin(st * 0.55 + L.side * 1.7));
      }
      L.hip.rotation.x = hx; L.knee.rotation.x = kx;
    }
    // ears: flared by e.ears, panicked flapping, happy flapping (baby), a little swing with the gait
    const flap = (e.ears > 0.85 ? 0.16 * Math.sin(st * 0.95 + this.idx * 1.3) : 0) + (e.eyes === "happy" ? 0.3 * Math.sin(st * 0.42) : 0) + 0.07 * gk * Math.sin(2 * TAU * ph);
    this.ears.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.set(0.08, -s * (0.32 + 1.1 * e.ears + flap), s * 0.06); });
    this.tailG.rotation.z = 0.22 * gk * Math.sin(TAU * ph) + (e.eyes === "shock" ? 0.25 * Math.sin(st * 0.6 + this.idx) : 0);
    this.tailG.rotation.x = e.eyes === "shock" ? -0.5 : 0;
    // gear
    const war = e.howdah !== "none";
    this.tuskG.visible = war; this.harness.visible = war;
    for (const k of ["king", "tower", "siege"] as HowdahK[]) { this.clothG[k].visible = e.howdah === k; this.howG[k].visible = e.howdah === k; }
    // trunk: a chain of joints in the head's yz plane (phi from straight down toward forward), blended hang -> S
    const t = clamp01(e.trunk), N = TRUNK_N, seg = 2.45 / N, P = this.trunkPts;
    const panic = e.eyes === "shock" && t > 0.6 ? 1 : 0;
    P[0].set(0, -0.4, 0.62);
    for (let k = 0; k < N - 1; k++) {
      const u = k / (N - 1);
      const up = e.howdah === "siege" ? PHI2[k] : PHI1[k];
      const phi = PHI0[k] + (up - PHI0[k]) * t + panic * 0.09 * Math.sin(st * 0.8 + k * 0.45 + this.idx);
      const sway = (0.05 * gk * Math.sin(TAU * ph + 0.6) + panic * 0.04 * Math.sin(st * 0.5 + this.idx)) * u;
      P[k + 1].set(P[k].x + sway * seg * 3, P[k].y - Math.cos(phi) * seg, P[k].z + Math.sin(phi) * seg);
    }
    // blunt tip: one closing ring just beyond the last
    const d = V(0, 0, 0).subVectors(P[N - 1], P[N - 2]).normalize();
    P[N].copy(P[N - 1]).addScaledVector(d, 0.03);
    this.trunk.set(P, this.trunkRad, V(1, 0, 0));
  }
}

// ================================================================ the pig
const PIG_PINK = new THREE.Color("#f4a7b4"), PITCH = new THREE.Color("#1c1a22");
const SNOUT_PINK = new THREE.Color("#e7899b"), SNOUT_PITCH = new THREE.Color("#5a4048");
const PIG_HH = 0.45;
const PB = { c: [0, 0.42, -0.05] as V3, a: 0.3, b: 0.27, z: 0.42, p: 2.3 };
const PH = { c: [0, 0.53, 0.42] as V3, a: 0.25, b: 0.235, z: 0.23, p: 2.1 };
const PIG_HIPS = [{ x: 0.15, z: 0.21, front: true }, { x: -0.15, z: 0.21, front: true }, { x: 0.15, z: -0.27, front: false }, { x: -0.15, z: -0.27, front: false }];
/** flame slots on the pig's back (bodyG local): x, z, height, width, outer(0) / hot core(1) */
const FLAMES: { x: number; z: number; h: number; w: number; core: number; s: number }[] = [];
for (let j = 0; j < 7; j++) { const a = (j / 7) * TAU + 0.3; FLAMES.push({ x: 0.15 * Math.cos(a), z: -0.06 + 0.25 * Math.sin(a), h: 0.5 + 0.16 * hash(j, 3), w: 0.85, core: 0, s: j }); }
FLAMES.push({ x: 0, z: -0.04, h: 0.78, w: 1.0, core: 0, s: 7 });
for (let j = 0; j < 4; j++) { const a = (j / 4) * TAU; FLAMES.push({ x: 0.08 * Math.cos(a), z: -0.05 + 0.13 * Math.sin(a), h: 0.4 + 0.1 * hash(j, 5), w: 0.85, core: 1, s: 10 + j }); }
const N_OUT = FLAMES.filter((x) => !x.core).length, N_CORE = FLAMES.length - N_OUT;
const BACK_Y = PB.c[1] + PB.b - 0.05;

class PigShared {
  body = tinted(superGeo(PB.a, PB.b, PB.z, PB.p, 32, 22), "#ffffff");
  head = tinted(superGeo(PH.a, PH.b, PH.z, PH.p, 28, 20), "#ffffff");
  face = decalGeo(PH.a, PH.b, PH.z, PH.p, PIG_PATCH, 1.012);
  snout: THREE.BufferGeometry; ear: THREE.BufferGeometry; leg: THREE.BufferGeometry; tail: THREE.BufferGeometry; harness: THREE.BufferGeometry;
  gloss = glossTex(); hmat = toonMat("#c9a76a");
  constructor() {
    const nos: THREE.BufferGeometry[] = [tinted(superGeo(0.115, 0.095, 0.06, 2.6, 20, 12), "#ffffff")];
    for (const s of [-1, 1]) { const g = new THREE.SphereGeometry(1, 10, 8); g.scale(0.022, 0.032, 0.014); g.translate(s * 0.042, 0, 0.054); nos.push(tinted(g, "#3a1820")); }
    this.snout = merge(nos);
    const ear = superGeo(0.11, 0.13, 0.035, 2.0, 16, 12); ear.translate(0, 0.11, 0); { const P = ear.attributes.position as THREE.BufferAttribute; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (1.15 - 0.75 * Math.max(0, y) / 0.24)); } ear.computeVertexNormals(); } this.ear = tinted(ear, "#ffffff");
    const leg = new THREE.CapsuleGeometry(0.066, 0.17, 6, 12); leg.translate(0, -0.15, 0); tinted(leg, "#ffffff");
    const tr = new THREE.SphereGeometry(1, 12, 8); tr.scale(0.074, 0.045, 0.084); tr.translate(0, -0.285, 0.006); tinted(tr, "#4a3238");
    this.leg = merge([leg, tr]);
    const tp: THREE.Vector3[] = [], tr2: number[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * 2.4 * TAU; tp.push(V(0.04 * Math.sin(a) * (1 - 0.3 * t), 0.04 * (1 - Math.cos(a)) * (1 - 0.3 * t) + 0.05 * t, -0.11 * t)); tr2.push(0.02 - 0.008 * t); }
    tr2[16] = 0.0005;
    this.tail = tinted(staticTube(tp, tr2, V(1, 0, 0), 6), "#ffffff");
    const h = new THREE.TorusGeometry(1, 0.075, 8, 32); h.scale(PB.a * 1.06, PB.b * 1.06, 0.3); h.translate(PB.c[0], PB.c[1], PB.c[2]);
    this.harness = h;
  }
}

class PigRig {
  root = new THREE.Group(); bodyG = new THREE.Group(); private headG = new THREE.Group();
  private skin: THREE.MeshLambertMaterial; private snoutMat: THREE.MeshLambertMaterial; private faceMat: THREE.MeshBasicMaterial;
  private ears: THREE.Group[] = []; private legs: { g: THREE.Group; front: boolean; side: number }[] = []; private tail: THREE.Mesh;
  private harness: THREE.Mesh;
  constructor(S: PigShared, public idx: number) {
    this.skin = toonMat(PIG_PINK.clone()); this.skin.vertexColors = true; this.skin.emissiveMap = S.gloss; this.skin.emissive.setRGB(0, 0, 0);
    this.snoutMat = toonMat(SNOUT_PINK.clone()); this.snoutMat.vertexColors = true;
    this.faceMat = new THREE.MeshBasicMaterial({ map: pigFaceTex(false, 0, false), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, hull = 1) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m);
      if (hull > 0) m.userData.hull = addHull(m, PIG_HH, hull);   // kept so a hidden part also hides its outline
      return m;
    };
    this.root.add(this.bodyG);
    add(this.bodyG, S.body, this.skin).position.set(...PB.c);
    this.headG.position.set(...PH.c); this.bodyG.add(this.headG);
    add(this.headG, S.head, this.skin);
    const face = new THREE.Mesh(S.face, this.faceMat); face.renderOrder = 2; this.headG.add(face);
    add(this.headG, S.snout, this.snoutMat, 0.7).position.set(0, -0.045, PH.z - 0.005);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.15, 0.17, -0.02); this.headG.add(g); this.ears.push(g);
      add(g, S.ear, this.skin, 0.8);
    }
    for (const h of PIG_HIPS) {
      const g = new THREE.Group(); g.position.set(h.x, 0.3, h.z); this.bodyG.add(g);
      add(g, S.leg, this.skin, 0.8); this.legs.push({ g, front: h.front, side: Math.sign(h.x) });
    }
    this.tail = add(this.bodyG, S.tail, this.skin, 0); this.tail.position.set(0, 0.56, -0.46);
    this.harness = add(this.bodyG, S.harness, S.hmat, 0.5); this.harness.visible = false; (this.harness.userData.hull as THREE.Mesh).visible = false;
  }
  update(p: PigState, gk: number, st: number, soot: number, hanging: boolean) {
    const r = this.root;
    r.visible = p.vis;
    if (!p.vis) return;
    r.position.set(...p.pos); r.rotation.set(0, p.yaw, 0); r.scale.setScalar(p.scale);
    const ph = p.phase, B = this.bodyG;
    let bob = 0, rock = 0, roll = 0, earFlop = 0;
    const legA = [0, 0, 0, 0];
    if (p.carried) {
      // dangling, paddling every few frames
      this.legs.forEach((L, i) => { legA[i] = 0.55 * Math.sin(st * 1.45 + i * 1.9 + this.idx) + (L.front ? -0.25 : 0.25); });
      roll = 0.09 * Math.sin(st * 0.7 + this.idx); rock = 0.06 * Math.sin(st * 0.9);
      earFlop = 0.25 * Math.sin(st * 1.1 + this.idx);
    } else if (p.gait === "run") {
      // gallop: the front pair together, the hind pair together, half a cycle apart; one bound per cycle
      const u = TAU * ph;
      this.legs.forEach((L, i) => { legA[i] = 0.8 * gk * Math.sin(u + (L.front ? 0 : Math.PI) + (L.side > 0 ? 0 : 0.35)); });
      bob = 0.085 * gk * (0.5 - 0.5 * Math.cos(u)); rock = 0.16 * gk * Math.sin(u + 0.6);
      earFlop = 0.45 * gk * (0.5 - 0.5 * Math.cos(u - 0.8));
    } else if (p.gait === "walk") {
      const u = TAU * ph;
      this.legs.forEach((L, i) => { const diag = (L.front ? 1 : -1) * L.side > 0 ? 0 : Math.PI; legA[i] = 0.42 * gk * Math.sin(u + diag); });
      bob = 0.02 * gk * (0.5 - 0.5 * Math.cos(2 * u)); earFlop = 0.12 * gk * Math.sin(2 * u);
    }
    B.position.y = bob; B.rotation.set(-rock * 0.5, 0, roll);
    this.legs.forEach((L, i) => { L.g.rotation.x = -legA[i]; });
    this.ears.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.set(1.45 + earFlop, 0, -s * 0.75); });
    this.tail.rotation.z = p.gait === "stand" && !p.carried ? 0 : 0.3 * Math.sin(st * 0.5 + this.idx);
    // squeal: the jaw cycles every ~3.5 frames, head tipped back
    const sq = p.squeal > 0.5;
    const jaw = sq ? Math.floor(st / 3.5 + this.idx * 0.7) % 3 : 0;
    this.faceMat.map = pigFaceTex(sq, jaw, p.pitch > 0.55);
    this.headG.rotation.x = sq ? -0.12 - 0.05 * Math.sin(st * 1.8) : 0;
    // pitch coat: pink -> glossy black; burnt off -> sooty matte
    const pk = clamp01(p.pitch);
    this.skin.color.copy(PIG_PINK).lerp(PITCH, pk);
    const gl = pk * (1 - 0.8 * soot) * 0.26;
    this.skin.emissive.setRGB(gl, gl, gl * 1.08);
    this.snoutMat.color.copy(SNOUT_PINK).lerp(SNOUT_PITCH, pk);
    this.harness.visible = hanging; (this.harness.userData.hull as THREE.Mesh).visible = hanging;   // the outline hull too (it drew a dark ring on every pig)
  }
}

// ================================================================ fire geometry (HDR vertex colours: bloom core, dark red tips)
const flameGeo = (core: boolean) => {
  const prof: [number, number][] = [[0.001, 0], [0.17, 0.04], [0.26, 0.13], [0.29, 0.25], [0.26, 0.4], [0.19, 0.57], [0.1, 0.76], [0.035, 0.92], [0.001, 1.0]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10);
  const P = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(P.count * 3);
  const lo = core ? [2.4, 1.45, 0.22] : [1.3, 0.46, 0.03], mid = core ? [2.0, 0.95, 0.08] : [1.05, 0.22, 0.015], hi = core ? [1.6, 0.55, 0.03] : [0.42, 0.035, 0.015];
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), a = y < 0.45 ? y / 0.45 : (y - 0.45) / 0.55, c0 = y < 0.45 ? lo : mid, c1 = y < 0.45 ? mid : hi;
    for (let k = 0; k < 3; k++) col[i * 3 + k] = c0[k] + (c1[k] - c0[k]) * a;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
};

// ================================================================ the rig
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
const _p = V(0, 0, 0), _s = V(1, 1, 1), _d = V(0, 0, 0), _a = V(0, 0, 0), _b = V(0, 0, 0), _Z = V(0, 0, 1);
const v3 = (a: V3) => V(a[0], a[1], a[2]);
const eleW = (e: EleState, l: V3) => v3(eleLocalToWorld(e, l));

export class BeastRig {
  group = new THREE.Group();
  private eles: EleRig[] = []; private pigs: PigRig[] = [];
  private iFlame: THREE.InstancedMesh; private iCore: THREE.InstancedMesh; private iGlow: THREE.InstancedMesh; private iSmoke: THREE.InstancedMesh;
  private spears: THREE.Mesh[] = []; private iArrow: THREE.InstancedMesh;
  private rope: THREE.Mesh;
  constructor(root: THREE.Group) {
    root.add(this.group);
    const ES = new EleShared();
    for (let i = 0; i < 8; i++) { const r = new EleRig(ES, i); this.eles.push(r); this.group.add(r.root); }
    const PS = new PigShared();
    for (let i = 0; i < 20; i++) { const r = new PigRig(PS, i); this.pigs.push(r); this.group.add(r.root); }
    // fire: outer flames + hot cores (HDR -> bloom), additive glow cards, smoke puffs
    const fmat = () => new THREE.MeshBasicMaterial({ color: "#ffffff", vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    this.iFlame = new THREE.InstancedMesh(flameGeo(false), fmat(), 20 * N_OUT);
    this.iCore = new THREE.InstancedMesh(flameGeo(true), fmat(), 20 * N_CORE);
    this.iCore.renderOrder = 1;
    this.iGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(1.0, 0.42, 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }), 20);
    this.iGlow.renderOrder = 3;
    this.iSmoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toonMat("#6f676f"), 20 * 8);
    for (let k = 0; k < 20; k++) this.iGlow.setColorAt(k, _c.setRGB(1, 1, 1));
    for (const m of [this.iFlame, this.iCore, this.iGlow, this.iSmoke]) { m.frustumCulled = false; m.count = 0; this.group.add(m); }
    // spears: ash shaft + bronze head, origin at the centre, tip toward +z (1.15 m)
    const shaft = new THREE.CylinderGeometry(0.032, 0.032, 2.2, 8); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, -0.1); tinted(shaft, "#a0703f");
    const head = new THREE.ConeGeometry(0.065, 0.32, 8); head.rotateX(Math.PI / 2); head.translate(0, 0, 1.15 - 0.16); tinted(head, "#d3994a");
    const butt = new THREE.ConeGeometry(0.04, 0.12, 8); butt.rotateX(-Math.PI / 2); butt.translate(0, 0, -1.24); tinted(butt, "#8a6a3a");
    const spearG = merge([shaft, head, butt]);
    const smat = toonMat("#ffffff"); smat.vertexColors = true;
    for (let k = 0; k < SPEARS.length; k++) {
      const m = new THREE.Mesh(spearG, smat); m.castShadow = true; m.visible = false; m.frustumCulled = false; this.group.add(m);
      addHull(m, 0.5, 0.7).frustumCulled = false;
      this.spears.push(m);
    }
    // arrows: origin at the TIP, shaft toward -z (0.78 m), iron head, white/red fletching
    const as = new THREE.CylinderGeometry(0.014, 0.014, 0.72, 6); as.rotateX(Math.PI / 2); as.translate(0, 0, -0.42); tinted(as, "#6e4a2c");
    const ah = new THREE.ConeGeometry(0.03, 0.1, 6); ah.rotateX(Math.PI / 2); ah.translate(0, 0, -0.05); tinted(ah, "#4a4650");
    const fl: THREE.BufferGeometry[] = [as, ah];
    for (let j = 0; j < 3; j++) { const f = new THREE.PlaneGeometry(0.075, 0.16); f.translate(0.045, 0, 0); f.rotateX(Math.PI / 2); f.rotateZ((j / 3) * TAU); f.translate(0, 0, -0.7); fl.push(tinted(f, j ? "#f2efe6" : "#c4302a")); }
    const amat = toonMat("#ffffff"); amat.vertexColors = true; amat.side = THREE.DoubleSide;
    this.iArrow = new THREE.InstancedMesh(merge(fl), amat, N_ARROW);
    this.iArrow.frustumCulled = false; this.iArrow.castShadow = true; this.iArrow.count = 0; this.group.add(this.iArrow);
    // the Edessa rope (unit cylinder along +y)
    const rg = new THREE.CylinderGeometry(1, 1, 1, 8); rg.translate(0, 0.5, 0);
    this.rope = new THREE.Mesh(rg, toonMat("#b08a58")); this.rope.castShadow = true; this.rope.visible = false; this.rope.frustumCulled = false; this.group.add(this.rope);
    this.group.traverse((o) => o.layers.set(NOINK));
  }

  update(sid: number, f: number, cam: THREE.PerspectiveCamera) {
    const set = SHOTS[sid - 1].set, st = storyF(sid, f);
    const dS = storyF(sid, f + 1.5) - storyF(sid, f - 1.5);
    // ---------------- elephants
    const E = elephantsAt(sid, f), Ea = elephantsAt(sid, f - 1.5), Eb = elephantsAt(sid, f + 1.5);
    this.eles.forEach((r, i) => {
      const e = E[i];
      if (!e) { r.root.visible = false; return; }
      const sp = Math.hypot(Eb[i].pos[0] - Ea[i].pos[0], Eb[i].pos[2] - Ea[i].pos[2]) / dS;
      let dy = Eb[i].yaw - Ea[i].yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const yr = Math.abs(dy) / dS;
      let gk = 0, ph = e.phase, mode: "walk" | "run" = e.gait === "run" ? "run" : "walk";
      if (e.gait === "walk") gk = clamp01(sp / (0.05 * e.scale));
      else if (e.gait === "run") gk = clamp01(sp / (0.14 * e.scale));
      if (yr > 0.01 && e.gait === "stand") { gk = Math.max(gk, clamp01(yr / 0.12)); ph = Math.abs(e.yaw - Math.PI) * 0.8; mode = "walk"; } // stepping round on the spot
      r.update(e, gk, ph, mode, st);
    });
    // ---------------- pigs
    const P = pigsAt(sid, f), Pa = pigsAt(sid, f - 1.5), Pb = pigsAt(sid, f + 1.5);
    const pigSp: number[] = [];
    this.pigs.forEach((r, i) => {
      const p = P[i];
      if (!p) { r.root.visible = false; pigSp.push(0); return; }
      const sp = Math.hypot(Pb[i].pos[0] - Pa[i].pos[0], Pb[i].pos[2] - Pa[i].pos[2]) / dS;
      pigSp.push(sp);
      const gk = p.gait === "run" ? clamp01(sp / (0.12 * p.scale)) : p.gait === "walk" ? clamp01(sp / (0.05 * p.scale)) : 0;
      const soot = set === "megara" && st > 925 ? clamp01(1 - p.burn) : 0;
      r.update(p, gk, st, soot, set === "edessa");
      r.root.updateMatrixWorld(true);
    });
    // ---------------- fire + smoke
    let nf = 0, nc = 0, ng = 0, ns = 0;
    this.pigs.forEach((r, i) => {
      const p = P[i];
      if (!p || !p.vis) return;
      const b = clamp01(p.burn);
      if (b > 0.001) {
        const lean = clamp01(pigSp[i] / 0.25);
        // a fire never swallows the lens: it shrinks away within ~2 m of the camera
        _a.set(0, BACK_Y, -0.05).applyMatrix4(r.bodyG.matrixWorld);
        const near = smooth((_a.distanceTo(cam.position) - 0.7) / 1.4);
        if (near < 0.01) return;
        for (const F of FLAMES) {
          const h1 = hash(i * 31 + F.s, 61), h2 = hash(i * 31 + F.s, 63), h3 = hash(i * 31 + F.s, 65);
          const fl = 1 + 0.2 * Math.sin(st * 1.9 + TAU * h1) + 0.12 * Math.sin(st * 3.3 + TAU * h2);
          const sw = 0.16 * Math.sin(st * 1.3 + TAU * h3) + 0.08 * Math.sin(st * 2.7 + TAU * h1);
          const grow = smooth((b - 0.05 * (F.s % 4)) / 0.6);
          const H = F.h * fl * grow * near * (F.core ? 1 : 1.05), W = F.w * H * (1.15 - 0.15 * fl);
          _e.set(-0.55 * lean + sw * 0.6 + (F.z + 0.05) * 1.4, 0, sw - F.x * 2.4);
          _q.setFromEuler(_e);
          _p.set(F.x, BACK_Y - 0.06 * (F.core ? 0 : 1), F.z); _s.set(W, H, W);
          _m.compose(_p, _q, _s).premultiply(r.bodyG.matrixWorld);
          if (F.core) this.iCore.setMatrixAt(nc++, _m); else this.iFlame.setMatrixAt(nf++, _m);
        }
        // glow card at the fire
        _a.set(0, BACK_Y + 0.35, -0.05).applyMatrix4(r.bodyG.matrixWorld);
        const gs = 2.3 * p.scale * b * near * (0.92 + 0.08 * Math.sin(st * 2.3 + i));
        _m.compose(_a, cam.quaternion, _s.set(gs, gs, gs)); this.iGlow.setMatrixAt(ng, _m);
        this.iGlow.setColorAt(ng++, _c.setRGB(0.32 * b, 0.32 * b, 0.32 * b));
      }
      // smoke puffs: emitted from where the pig WAS (pure: the contract at an earlier story frame)
      if (set === "megara" && !p.carried) {
        const L = 30, NP = 8;
        for (let k = 0; k < NP; k++) {
          const age = (((st + hash(i, 71) * L + (k * L) / NP) % L) + L) % L, te = st - age;
          const q = pigMegara(i, te);
          const amt = Math.max(clamp01(q.burn), te > 930 && te < 1004 ? 0.55 * clamp01((te - 930) / 20) : 0);
          if (amt < 0.02 || !q.vis) continue;
          const life = Math.sin((Math.PI * age) / L) ** 0.7;
          _p.set(q.pos[0] + 0.02 * age + (hash(i * 7 + k, 73) - 0.5) * 0.2, BACK_Y + 0.45 + 0.06 * age, q.pos[2] + (hash(i * 7 + k, 75) - 0.5) * 0.2);
          // never a big grey ball over the lens: puffs shrink away within ~4 m of the camera
          const near = smooth((_p.distanceTo(cam.position) - 1.8) / 2.5);
          const sz = amt * (0.12 + 0.014 * age) * life * near;
          if (sz < 0.01) continue;
          _m.compose(_p, _q.identity(), _s.set(sz, sz * 0.9, sz)); this.iSmoke.setMatrixAt(ns++, _m);
        }
      }
    });
    this.iFlame.count = nf; this.iCore.count = nc; this.iGlow.count = ng; this.iSmoke.count = ns;
    this.iFlame.instanceMatrix.needsUpdate = true; this.iCore.instanceMatrix.needsUpdate = true; this.iGlow.instanceMatrix.needsUpdate = true; this.iSmoke.instanceMatrix.needsUpdate = true;
    if (this.iGlow.instanceColor) this.iGlow.instanceColor.needsUpdate = true;
    // ---------------- spears + arrows (Megara)
    this.spearsAndArrows(set === "megara", st);
    // ---------------- the Edessa rope: beam tip -> the harness on the pig's back
    this.rope.visible = false;
    if (set === "edessa" && st >= 1500 && P[0]?.vis) {
      _b.set(0, PB.c[1] + PB.b * 1.06 + 0.02, PB.c[2]).applyMatrix4(this.pigs[0].bodyG.matrixWorld);
      _a.set(...BEAM_TIP);
      _d.subVectors(_b, _a); const len = _d.length();
      this.rope.position.copy(_a); this.rope.quaternion.setFromUnitVectors(V(0, 1, 0), _d.normalize()); this.rope.scale.set(0.028, len, 0.028);
      this.rope.visible = true;
    }
  }

  private spearsAndArrows(on: boolean, st: number) {
    // spears: arc from the wall to E3's flank, bounce off, one spin, lie on the ground ~1.6 m out
    SPEARS.forEach((S, k) => {
      const m = this.spears[k];
      m.visible = on && st >= S.f0;
      if (!m.visible) return;
      const eh = eleMegara(S.ele, S.hit), hp = eleHidePoint(S.local);
      const P = eleW(eh, hp.p), from = v3(S.from), H = 0.07 * P.distanceTo(from);
      const dirAt = (u: number, out: THREE.Vector3) => out.subVectors(P, from).add(V(0, H * 4 * (1 - 2 * u), 0)).normalize();
      if (st <= S.hit) {
        const u = clamp01((st - S.f0) / (S.hit - S.f0));
        dirAt(u, _d);
        _p.copy(from).lerp(P, u); _p.y += H * 4 * u * (1 - u);
        m.position.copy(_p).addScaledVector(_d, -1.15);
        m.quaternion.setFromUnitVectors(_Z, _d);
        return;
      }
      dirAt(1, _d);
      const nW = eleW(eh, [hp.p[0] + hp.n[0], hp.p[1] + hp.n[1], hp.p[2] + hp.n[2]]).sub(P); nW.y = 0; nW.normalize();
      const c0 = P.clone().addScaledVector(_d, -1.15);
      const u = clamp01((st - S.hit) / 15), eo = 1 - (1 - u) ** 2;
      m.position.copy(c0).addScaledVector(nW, 1.6 * eo + 0.15 * k);
      m.position.y = c0.y + 2.4 * u - (2.4 + c0.y - 0.07) * u * u;
      const yawEnd = Math.atan2(nW.x, nW.z) + Math.PI / 2 + (hash(k, 81) - 0.5) * 0.9;
      _q.setFromUnitVectors(_Z, _d); _q2.setFromEuler(_e.set(0, yawEnd, 0));
      m.quaternion.copy(_q).slerp(_q2, smooth(u));
      const axis = V(0, 1, 0).cross(nW).normalize();
      m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, -TAU * eo));
    });
    // arrows: light arc, then stuck in the hide (riding with that elephant) or in the ground
    let n = 0;
    if (on) for (let k = 0; k < N_ARROW; k++) {
      const A = arrowShot(k);
      if (st < A.f0) continue;
      let tipW: THREE.Vector3, dirW: THREE.Vector3;
      const eh = A.ele >= 0 ? eleMegara(A.ele, A.hit) : null;
      const hp = A.ele >= 0 ? eleHidePoint(A.local) : null;
      const T = eh && hp ? eleW(eh, hp.p) : v3(A.ground);
      const from = v3(A.from), H = 0.05 * T.distanceTo(from);
      if (st <= A.hit) {
        const u = clamp01((st - A.f0) / (A.hit - A.f0));
        tipW = from.clone().lerp(T, u); tipW.y += H * 4 * u * (1 - u);
        dirW = T.clone().sub(from).add(V(0, H * 4 * (1 - 2 * u), 0)).normalize();
      } else {
        const dEnd = T.clone().sub(from).add(V(0, -H * 4, 0)).normalize();
        if (eh && hp) {
          // stuck: the shaft mostly along the outward normal, tilted with the flight
          const c = Math.cos(-eh.yaw), s = Math.sin(-eh.yaw);
          const dl = V(dEnd.x * c + dEnd.z * s, dEnd.y, -dEnd.x * s + dEnd.z * c);
          const sd = dl.multiplyScalar(0.55).sub(V(...hp.n)).normalize();
          const tipL: V3 = [hp.p[0] + sd.x * 0.08, hp.p[1] + sd.y * 0.08, hp.p[2] + sd.z * 0.08];
          const tailL: V3 = [tipL[0] - sd.x * 0.7, tipL[1] - sd.y * 0.7, tipL[2] - sd.z * 0.7];
          const e = eleMegara(A.ele, st);
          if (!e.vis) continue;
          tipW = eleW(e, tipL); dirW = tipW.clone().sub(eleW(e, tailL)).normalize();
          tipW.y += eleBob(e);
        } else {
          tipW = T.clone().addScaledVector(dEnd, 0.14); dirW = dEnd;
        }
      }
      _q.setFromUnitVectors(_Z, dirW);
      _m.compose(tipW, _q, _s.set(1, 1, 1)); this.iArrow.setMatrixAt(n++, _m);
    }
    this.iArrow.count = n; this.iArrow.instanceMatrix.needsUpdate = true;
  }
}
