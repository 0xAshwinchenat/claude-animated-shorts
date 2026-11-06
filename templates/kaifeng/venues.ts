// VENUE RIG (owner: the "venues" agent). Three visiting sets, each in its own group at its story.ts origin, shown only
// while a shot of that set renders:
//  LESSON (shots 14 + 16): inside Subutai's yurt: felt wall + red khana lattice, roof poles to the toono with a shaft of
//    daylight, carpets, a chest, a bow + quiver; the red lacquer table with the blue-and-white PLATE on its stand (crack
//    F_PLATE+1..+10, then 3 shards tip over and fall on the table), the rammed-earth EBLOCK (6 pounded layers, the portal
//    face +z) and the silk PILLOW (deep dimple from F_PUNCH, recovers slowly: pillowDentK).
//  MACRO (shot 15): the grain bed as a cliff section (face +z at z = 0, top ~y 9): ~7k toon grains in 1.5 m strata that
//    repeat the block's 6 layer colours (25x scale: block layer k <-> band y 1.5k..1.5k+1.5); the boulder (r 3) lands at
//    MACRO_HIT on F_MACRO, crushes only the grains it touches, a few pop up and settle, a toon dust ring, then stillness.
//  GREAT (shot 17, golden): green ridges, a Ming brick wall on the crest + a watchtower; at cutK a 10 m slice of the
//    wall slides out sideways (away from the lens), exposing the cut: brick skins on both faces round a pounded-earth heart.
// update(sid, f, cam) is a pure function of (sid, f); f may be fractional.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, V } from "./build";
import { rng, rep, planksHD, grassHD, roofHD } from "./paint";
import * as PV from "./paintv";
import { twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { SHOTS, LESSON, PLATE, EBLOCK, PILLOW, MACRO, GREAT, F_PLATE, F_MACRO, F_PUNCH, cutK, hash, smooth, clamp01, easeOut, type V3 } from "./story";

const TAU = Math.PI * 2;
type C3 = [number, number, number];
const ss = (a: number, b: number, x: number) => smooth((x - a) / (b - a));
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const Q = (ax: THREE.Vector3, a: number) => new THREE.Quaternion().setFromAxisAngle(ax, a);
const M4 = (x: number, y: number, z: number, ry = 0, s: C3 = [1, 1, 1]) => new THREE.Matrix4().compose(V(x, y, z), Q(V(0, 1, 0), ry), V(...s));
const ME = (x: number, y: number, z: number, rx: number, ry: number, rz: number, s: C3 = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(...s));
const loc = (p: V3, o: V3): V3 => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];

// ---------------- materials ----------------
const mcache = new Map<string, THREE.Material>();
const lam = (key: string, p: THREE.MeshLambertMaterialParameters, liftK = 1) => {
  let m = mcache.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(p), liftK); mcache.set(key, m); }
  return m as THREE.MeshLambertMaterial;
};
const pho = (key: string, p: THREE.MeshPhongMaterialParameters) => {
  let m = mcache.get(key);
  if (!m) { m = twoTone(new THREE.MeshPhongMaterial(p)); mcache.set(key, m); }
  return m as THREE.MeshPhongMaterial;
};
const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], m?: THREE.Matrix4, cast = true) => {
  const o = new THREE.Mesh(geo, mat);
  if (m) o.applyMatrix4(m);
  o.castShadow = cast; o.receiveShadow = true;
  parent.add(o);
  return o;
};

// ---------------- geometry helpers ----------------
const rbCache = new Map<string, THREE.BufferGeometry>();
/** bevelled box (chunky cartoon slab), centred; uv per face 0..1 (tile 0) or in metres / tile */
const rbox = (w: number, h: number, d: number, r = 0.02, tile = 0, k = 2) => {
  const key = `${w.toFixed(4)}_${h.toFixed(4)}_${d.toFixed(4)}_${r}_${tile}_${k}`;
  const hit = rbCache.get(key);
  if (hit) return hit;
  const half = [w / 2, h / 2, d / 2], rr = Math.min(r, ...half.map((v) => v * 0.9)), n = 2 * k + 1;
  const g = new THREE.BoxGeometry(2, 2, 2, n, n, n);
  const p = g.attributes.position as THREE.BufferAttribute, nr = g.attributes.normal as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  const map = (t: number, hf: number) => { const i = Math.round(((t + 1) / 2) * n); return i <= k ? -hf + (rr * i) / k : hf - (rr * (n - i)) / k; };
  const v = [0, 0, 0], q = [0, 0, 0], e = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    for (let a = 0; a < 3; a++) { v[a] = map(p.getComponent(i, a), half[a]); q[a] = Math.max(-(half[a] - rr), Math.min(half[a] - rr, v[a])); e[a] = v[a] - q[a]; }
    const fn = [nr.getX(i), nr.getY(i), nr.getZ(i)], L = Math.hypot(e[0], e[1], e[2]);
    if (L > 1e-6) { for (let a = 0; a < 3; a++) v[a] = q[a] + (e[a] / L) * rr; nr.setXYZ(i, e[0] / L, e[1] / L, e[2] / L); }
    p.setXYZ(i, v[0], v[1], v[2]);
    const ax = Math.abs(fn[0]) > 0.5 ? 0 : Math.abs(fn[1]) > 0.5 ? 1 : 2, [ua, va] = ax === 0 ? [2, 1] : ax === 1 ? [0, 2] : [0, 1];
    const flip = (ax === 0 && fn[0] < 0) || (ax === 2 && fn[2] < 0) ? -1 : 1;
    if (tile) uv.setXY(i, (flip * v[ua]) / tile, v[va] / tile);
    else uv.setXY(i, (flip * v[ua] + half[ua]) / (2 * half[ua]), (ax === 1 ? -v[va] : v[va]) / (2 * half[va]) + 0.5);
  }
  rbCache.set(key, g);
  return g;
};
const tube = (pts: THREE.Vector3[], rad: number, seg = 24, radial = 6, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, rad, radial, closed);
/** a cylinder of radius rad from a to b */
const rod = (a: THREE.Vector3, b: THREE.Vector3, rad: number, seg = 8, rad2 = rad) => {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(rad2, rad, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
};

// =====================================================================================================
// LESSON: the yurt
// =====================================================================================================
export const PLATE_R = 0.13, PLATE_TILT = (-12 * Math.PI) / 180;
const PL = loc(PLATE, LESSON), EB = loc(EBLOCK, LESSON), PW = loc(PILLOW, LESSON);
/** plate centre (lesson-local): its bottom rim rests on the stand lip just above the table top */
export const PLATE_C: V3 = [PL[0], PL[1] + 0.14, PL[2] - 0.003];
/** world point the hammer hits (the plate centre, on its face) */
export const PLATE_HIT: V3 = [LESSON[0] + PLATE_C[0], LESSON[1] + PLATE_C[1] + 0.002, LESSON[2] + PLATE_C[2] + 0.004];
const plateZ = (r: number) => 0.011 * ss(0.068, 0.112, r) - 0.007 * ss(0.123, 0.131, r);
const PLATE_T = 0.0045;
/** the three cracks (plate-local angle from +x, CCW, +y up): one right across (up + down) and a branch to the right */
const CRACK_A = [95, 268, 345].map((d) => (d * Math.PI) / 180);
const crackTheta = (k: number, r: number) => {
  const c = k % 3, j = (0.11 * Math.sin(r * 118 + c * 2.1) + 0.07 * Math.sin(r * 297 + c * 4.3) + 0.05 * Math.sign(Math.sin(r * 61 + c))) * ss(0, 0.028, r);
  return CRACK_A[c] + (k >= 3 ? TAU : 0) + j;
};
/** pillow dent depth 0..1 (the char owner's fist lands at F_PUNCH: 4 f in, held 8 f, then a slow recovery) */
export const pillowDentK = (f: number) => {
  if (f < F_PUNCH) return 0;
  const inK = easeOut((f - F_PUNCH) / 4);
  return inK * (1 - 0.8 * ss(F_PUNCH + 12, F_PUNCH + 75, f));
};
export const PILLOW_W = 0.44, PILLOW_D = 0.32, PILLOW_H = 0.13, DENT_MAX = 0.085;
/** world point at the top centre of the pillow (where the fist lands) */
export const PILLOW_TOP: V3 = [PILLOW[0], PILLOW[1] + 0.012 + PILLOW_H, PILLOW[2]];

type Shard = { m: THREE.Mesh; p0: THREE.Vector3; q0: THREE.Quaternion; p1: THREE.Vector3; q1: THREE.Quaternion; t0: number; dur: number };
type LessonRig = {
  shards: Shard[]; cracks: { m: THREE.Mesh; n: number }[];
  pTop: THREE.BufferGeometry; pBase: Float32Array; pBot: Float32Array; pD: number;
  shaft: THREE.Mesh; pool: THREE.Mesh; motes: THREE.Sprite[]; sky: THREE.Mesh;
};
const shaftMat = () => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Vector3(1.3, 1.0, 0.6) }, uK: { value: 0.55 } },
  vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uK; varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 5.0) * smoothstep(0.0, 0.22, vY) * (0.45 + 0.55 * vY) * uK; gl_FragColor = vec4(uCol, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

const buildPlate = (g: THREE.Group): { shards: Shard[]; cracks: { m: THREE.Mesh; n: number }[] } => {
  const R = PLATE_R, NR = 30;
  const face = pho("v_plateFace", { map: PV.plateFace(), color: "#ffffff", specular: "#9a9a9a", shininess: 60 });
  const glaze = pho("v_plateGlaze", { color: "#f2f1ec", specular: "#8a8a8a", shininess: 60, side: THREE.DoubleSide });
  const qP = Q(V(1, 0, 0), PLATE_TILT), cP = V(...PLATE_C);
  const dz = (r: number) => (plateZ(r + 1e-4) - plateZ(Math.max(0, r - 1e-4))) / (r < 1e-4 ? 1e-4 : 2e-4);
  const shards: Shard[] = [];
  const END: { xz: [number, number]; yaw: number; delay: number; dur: number }[] = [
    { xz: [-0.665, 0.15], yaw: 0.55, delay: 0, dur: 9 },
    { xz: [-0.39, 0.235], yaw: -0.45, delay: 2, dur: 10 },
    { xz: [-0.255, 0.13], yaw: 0.95, delay: 1, dur: 8 },
  ];
  for (let k = 0; k < 3; k++) {
    const span = (CRACK_A[(k + 1) % 3] + (k === 2 ? TAU : 0)) - CRACK_A[k], NA = Math.max(8, Math.round((span * 180) / Math.PI / 4));
    // shard k spans crack k .. crack k + 1 (k + 1 = 3 wraps round: crackTheta adds TAU)
    const th = (i: number, j: number) => { const r = (R * i) / NR, a = crackTheta(k, r), b = crackTheta(k + 1, r); return a + (b - a) * (j / NA); };
    const posF: number[] = [], nrmF: number[] = [], uvF: number[] = [], posB: number[] = [], nrmB: number[] = [], uvB: number[] = [], posW: number[] = [], uvW: number[] = [];
    const P = (i: number, j: number, back: boolean) => {
      const r = (R * i) / NR, a = th(i, j), x = r * Math.cos(a), y = r * Math.sin(a), z = plateZ(r) - (back ? PLATE_T : 0);
      const s = dz(r), n = V(-s * Math.cos(a), -s * Math.sin(a), 1).normalize();
      return { p: [x, y, z], n: back ? [-n.x, -n.y, -n.z] : [n.x, n.y, n.z], uv: [x / 0.27 + 0.5, y / 0.27 + 0.5] };
    };
    const push = (pa: number[], na: number[], ua: number[], v: { p: number[]; n: number[]; uv: number[] }) => { pa.push(...v.p); na.push(...v.n); ua.push(...v.uv); };
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = [i, j], b = [i + 1, j], c = [i + 1, j + 1], d = [i, j + 1];
      for (const tri of [[a, b, c], [a, c, d]]) {
        for (const [ii, jj] of tri) push(posF, nrmF, uvF, P(ii, jj, false));
        for (const [ii, jj] of [tri[0], tri[2], tri[1]]) push(posB, nrmB, uvB, P(ii, jj, true));
      }
    }
    const edge = (i0: number, j0: number, i1: number, j1: number) => {
      const a = P(i0, j0, false).p, b = P(i1, j1, false).p, c = P(i1, j1, true).p, d = P(i0, j0, true).p;
      posW.push(...a, ...b, ...c, ...a, ...c, ...d); uvW.push(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    };
    for (let i = 0; i < NR; i++) { edge(i, 0, i + 1, 0); edge(i, NA, i + 1, NA); }
    for (let j = 0; j < NA; j++) edge(NR, j, NR, j + 1);
    const mk = (p: number[], n: number[] | null, uv: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      if (n) geo.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3)); else geo.computeVertexNormals();
      return geo;
    };
    const geo = mergeGeometries([mk(posF, nrmF, uvF), mk(posB, nrmB, uvB), mk(posW, null, uvW)], true);
    // recentre on the shard centroid (front surface)
    const ctr = V(0, 0, 0); for (let i = 0; i < posF.length; i += 3) ctr.add(V(posF[i], posF[i + 1], posF[i + 2]));
    ctr.multiplyScalar(3 / posF.length);
    geo.translate(-ctr.x, -ctr.y, -ctr.z);
    const m = new THREE.Mesh(geo, [face, glaze, glaze]); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const p0 = cP.clone().add(ctr.clone().applyQuaternion(qP));
    const e = END[k], q1 = Q(V(0, 1, 0), e.yaw).multiply(Q(V(1, 0, 0), -Math.PI / 2));
    // rest height: lowest vertex after the end rotation sits on the table top
    let minY = 1e9; const pa = geo.attributes.position, tv = V(0, 0, 0);
    for (let i = 0; i < pa.count; i++) { tv.set(pa.getX(i), pa.getY(i), pa.getZ(i)).applyQuaternion(q1); minY = Math.min(minY, tv.y); }
    const p1 = V(e.xz[0], 0.72 + 0.0012 - minY, e.xz[1]);
    shards.push({ m, p0, q0: qP.clone(), p1, q1, t0: F_PLATE + 11 + e.delay, dur: e.dur });
  }
  // the inked cracks (grow from the hit point over F_PLATE+1..+10), in a frame that holds the whole plate
  const frame = new THREE.Group(); frame.position.copy(cP); frame.quaternion.copy(qP); g.add(frame);
  const cracks: { m: THREE.Mesh; n: number }[] = [];
  const inkM = new THREE.MeshBasicMaterial({ color: "#1c1418", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (let k = 0; k < 3; k++) {
    const N = 40, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) { const r = (R * 0.985 * i) / N, a = crackTheta(k, r); pts.push(V(r * Math.cos(a), r * Math.sin(a), plateZ(r) + 0.0016)); }
    const pos: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), w = 0.0013 * (1.25 - 0.6 * (i / N));
      const px = (-d.y / (d.length() || 1)) * w, py = (d.x / (d.length() || 1)) * w;
      const A = [a.x - px, a.y - py, a.z], B = [b.x - px, b.y - py, b.z], C = [b.x + px, b.y + py, b.z], D = [a.x + px, a.y + py, a.z];
      pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(geo, inkM); m.layers.set(NOINK); m.renderOrder = 2; frame.add(m);
    cracks.push({ m, n: N });
  }
  // the wooden plate stand: base, front lip, slanted back board
  const wood = lam("v_standWood", { color: "#6b4228" });
  mesh(g, rbox(0.2, 0.012, 0.13, 0.004), wood, M4(PL[0], 0.726, PLATE_C[2] - 0.012));
  mesh(g, rbox(0.2, 0.022, 0.012, 0.004), wood, M4(PL[0], 0.742, PLATE_C[2] + 0.047));
  const back = V(0, -0.0625, -PLATE_T - 0.0075).applyQuaternion(qP).add(cP);
  const bm = new THREE.Matrix4().compose(back, qP, V(1, 1, 1));
  mesh(g, rbox(0.11, 0.125, 0.012, 0.004), wood, bm);
  mesh(g, rod(V(PL[0], 0.732, PLATE_C[2] - 0.07), back.clone().add(V(0, -0.02, -0.006)), 0.006), wood);
  return { shards, cracks };
};

const buildPillow = (g: THREE.Group) => {
  const NU = 40, NW = 30, W = PILLOW_W, D = PILLOW_D;
  const silk = pho("v_silk", { map: PV.silk(), color: "#ffffff", specular: "#3a5050", shininess: 18 }), silkTop = pho("v_silkTop", { map: PV.silk(), color: "#ffffff", specular: "#3a5050", shininess: 18, vertexColors: true });
  const gold = pho("v_gold", { color: "#e2b04a", specular: "#a07a30", shininess: 40 });
  const P = (u: number, w: number, top: boolean): [number, number, number] => {
    const f = (1 - u * u) * (1 - w * w);
    return [u * (W / 2) * (1 + 0.05 * (1 - w * w)), top ? 0.012 + PILLOW_H * Math.pow(f, 0.45) : 0.012 - 0.012 * Math.pow(f, 0.3), w * (D / 2) * (1 + 0.05 * (1 - u * u))];
  };
  const grid = (top: boolean) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NW; j++) for (let i = 0; i <= NU; i++) {
      const u = -1 + (2 * i) / NU, w = -1 + (2 * j) / NW; pos.push(...P(u, w, top)); uv.push(i / NU, j / NW);
    }
    for (let j = 0; j < NW; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, d = a + NU + 1, c = d + 1;
      if (top) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };
  const top = grid(true), bot = grid(false);
  top.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(top.attributes.position.count * 3).fill(1), 3));
  const o = new THREE.Group(); o.position.set(PW[0], PW[1], PW[2]); g.add(o);
  const mt = mesh(o, top, silkTop); mt.frustumCulled = false;
  mesh(o, bot, silk);
  const loop: THREE.Vector3[] = [];
  for (let i = 0; i < NU; i++) loop.push(V(...P(-1 + (2 * i) / NU, -1, true)));
  for (let j = 0; j < NW; j++) loop.push(V(...P(1, -1 + (2 * j) / NW, true)));
  for (let i = NU; i > 0; i--) loop.push(V(...P(-1 + (2 * i) / NU, 1, true)));
  for (let j = NW; j > 0; j--) loop.push(V(...P(-1, -1 + (2 * j) / NW, true)));
  mesh(o, tube(loop, 0.0055, 280, 6, true), gold);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const c = V(...P(sx, sz, true)), out = V(sx, 0, sz).normalize();
    mesh(o, new THREE.SphereGeometry(0.011, 10, 8), gold, M4(c.x + out.x * 0.012, c.y, c.z + out.z * 0.012));
    const cone = new THREE.ConeGeometry(0.012, 0.045, 10); cone.rotateZ(Math.PI); cone.translate(0, -0.02, 0);
    mesh(o, cone, gold, M4(c.x + out.x * 0.022, c.y - 0.004, c.z + out.z * 0.022));
  }
  const pa = top.attributes.position.array as Float32Array;
  return { pTop: top, pBase: pa.slice(), pBot: (bot.attributes.position.array as Float32Array).slice() };
};

const buildLesson = (g: THREE.Group): LessonRig => {
  const RL = 3.48, WH = 1.6;
  // floor, carpets
  mesh(g, new THREE.CircleGeometry(3.64, 72).rotateX(-Math.PI / 2), lam("v_yurtFloor", { map: rep(planksHD(), 3.6, 3.6), color: "#d8b48e" }), undefined, false);
  const rug = (key: string, tex: THREE.Texture, w: number, d: number, x: number, z: number, yaw: number, y: number) => {
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    mesh(g, geo, lam("v_rug" + key, { map: tex }), M4(x, y, z, yaw), false);
  };
  rug("A", PV.carpet("A", "#a83a30", "#24476e", "#e3b552", 1024, 720), 2.7, 1.9, 0, 0.1, 0, 0.004);
  rug("B", PV.carpet("B", "#2b5a7c", "#9a2f2a", "#e8c25e", 1024, 720), 2.1, 1.45, -1.75, -1.25, 0.55, 0.007);
  rug("C", PV.carpet("C", "#b5562e", "#2f5e4a", "#efd27a", 1024, 720), 2.0, 1.4, 1.75, -1.2, -0.5, 0.01);
  // felt wall + lattice (khana)
  const feltM = lam("v_felt", { map: rep(PV.felt(), 11, 1), color: "#c4ab86", side: THREE.DoubleSide });
  mesh(g, new THREE.CylinderGeometry(3.62, 3.62, 1.7, 96, 1, true), feltM, M4(0, 0.85, 0), false);
  const red = lam("v_lattice", { color: "#c4472c" }), redDark = lam("v_poleRed", { color: "#b8452a" });
  const b = new Batch();
  const NL = 72, dTh = (WH - 0.08) / RL;
  for (let i = 0; i < NL; i++) for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, a = (i / NL) * TAU + s * t * dTh, rr = RL - (s > 0 ? 0 : 0.03); pts.push(V(Math.cos(a) * rr, 0.06 + t * (WH - 0.08), Math.sin(a) * rr)); }
    b.add(tube(pts, 0.012, 8, 4), red);
  }
  for (const y of [0.06, WH - 0.02]) b.add(new THREE.TorusGeometry(RL - 0.015, 0.028, 6, 120).rotateX(Math.PI / 2), redDark, M4(0, y, 0));
  // roof poles (uni) to the crown (toono)
  const NP = 64;
  for (let i = 0; i < NP; i++) {
    const a = ((i + 0.5) / NP) * TAU;
    b.add(rod(V(Math.cos(a) * (RL - 0.04), WH, Math.sin(a) * (RL - 0.04)), V(Math.cos(a) * 0.68, 3.02, Math.sin(a) * 0.68), 0.024, 6, 0.019), redDark);
  }
  const ring = lam("v_toono", { color: "#c85a2e" });
  b.add(new THREE.TorusGeometry(0.68, 0.06, 8, 56).rotateX(Math.PI / 2), ring, M4(0, 3.04, 0));
  b.add(new THREE.TorusGeometry(0.5, 0.032, 8, 48).rotateX(Math.PI / 2), ring, M4(0, 3.1, 0));
  for (const yaw of [0, Math.PI / 2]) {
    const pts: THREE.Vector3[] = []; for (let k = 0; k <= 8; k++) { const t = -1 + k / 4; pts.push(V(t * 0.66, 3.06 + 0.16 * (1 - t * t), 0)); }
    b.add(tube(pts, 0.028, 16, 6), ring, M4(0, 0, 0, yaw));
  }
  // lattice + poles: no shadows from the roof structure (the sun stands in for the light inside)
  b.build(g, false);
  // felt roof (inner side) + collar round the crown + the sky disc in the opening
  mesh(g, new THREE.CylinderGeometry(0.7, 3.64, 1.42, 96, 1, true), lam("v_roofFelt", { map: rep(PV.felt(), 11, 1), color: "#b89c78", side: THREE.DoubleSide }), M4(0, 1.66 + 0.71, 0), false);
  mesh(g, new THREE.CylinderGeometry(0.7, 0.7, 0.3, 48, 1, true), lam("v_collar", { color: "#d4bf98", side: THREE.DoubleSide }), M4(0, 3.22, 0), false);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.45, 2.6), fog: false, side: THREE.DoubleSide }));
  sky.position.set(0, 3.36, 0); sky.layers.set(NOINK); g.add(sky);
  // the chest (back left), a bow + quiver on the lattice (back right), rolled felts (right)
  const chestM = lam("v_chest", { map: PV.chestTex() }), gold = pho("v_gold", { color: "#e2b04a", specular: "#a07a30", shininess: 40 });
  const cyaw = Math.atan2(1.4, 2.72);
  mesh(g, rbox(1.0, 0.52, 0.5, 0.025), chestM, M4(-1.4, 0.26, -2.72, cyaw));
  mesh(g, rbox(1.06, 0.08, 0.56, 0.025), lam("v_chestLid", { color: "#a8432a" }), M4(-1.4, 0.56, -2.72, cyaw));
  for (const sx of [-1, 1]) mesh(g, rbox(0.06, 0.6, 0.06, 0.01), gold, new THREE.Matrix4().makeRotationY(cyaw).setPosition(-1.4, 0.3, -2.72).multiply(M4(sx * 0.5, 0, 0.25)));
  const bowO = V(1.25, 1.3, -3.18), toC = V(-bowO.x, 0, -bowO.z).normalize(), hz = V(toC.z, 0, -toC.x);
  const A = hz.clone().multiplyScalar(Math.cos(0.42)).add(V(0, Math.sin(0.42), 0)), B = hz.clone().multiplyScalar(-Math.sin(0.42)).add(V(0, Math.cos(0.42), 0));
  const bp = (a: number, bb: number) => bowO.clone().addScaledVector(A, a).addScaledVector(B, bb).addScaledVector(toC, 0.02);
  const bowPts: [number, number][] = [[-0.66, -0.05], [-0.62, 0.04], [-0.48, 0.02], [-0.25, -0.09], [0, -0.12], [0.25, -0.09], [0.48, 0.02], [0.62, 0.04], [0.66, -0.05]];
  mesh(g, tube(bowPts.map(([a, bb]) => bp(a, bb)), 0.024, 48, 6), lam("v_bow", { color: "#7a4024" }), undefined, false);
  mesh(g, tube([bp(-0.62, 0.035), bp(0, 0.037), bp(0.62, 0.035)], 0.0065, 8, 4), lam("v_string", { color: "#f4ead2" }), undefined, false);
  mesh(g, tube([bp(-0.08, -0.115), bp(0, -0.12), bp(0.08, -0.115)], 0.034, 8, 6), gold, undefined, false);
  const qO = V(1.95, 0.95, -2.82), qyaw = Math.atan2(-qO.x, -qO.z);
  const quiverM = new THREE.Matrix4().makeRotationY(qyaw).setPosition(qO.x, qO.y, qO.z).multiply(new THREE.Matrix4().makeRotationZ(-0.25));
  mesh(g, rbox(0.15, 0.62, 0.09, 0.03), lam("v_quiver", { color: "#9a3326" }), quiverM, false);
  mesh(g, rbox(0.17, 0.06, 0.11, 0.02), gold, quiverM.clone().multiply(M4(0, 0.22, 0)));
  for (let k = 0; k < 5; k++) {
    const m = quiverM.clone().multiply(M4(-0.05 + k * 0.025, 0.31, (k % 2 ? 0.015 : -0.015)));
    mesh(g, rod(V(0, 0, 0), V(0, 0.16, 0), 0.004, 5), lam("v_shaft", { color: "#d8b07a" }), m);
    mesh(g, new THREE.ConeGeometry(0.014, 0.06, 4), lam("v_fletch", { color: k % 2 ? "#f2ead8" : "#3b4f7a" }), m.clone().multiply(M4(0, 0.17, 0)));
  }
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.9, 20).rotateZ(Math.PI / 2);
    mesh(g, geo, lam("v_roll" + k, { color: ["#c9b089", "#8f3b30", "#3d6f86"][k] }), M4(2.25 - k * 0.04, 0.15 + (k === 2 ? 0.27 : 0), -1.55 + (k === 1 ? 0.32 : k === 2 ? 0.16 : 0), -0.95));
  }
  // the table: lacquer top, apron, legs
  const topM = pho("v_tableTop", { map: PV.tableTop(), color: "#ffffff", specular: "#5a3a30", shininess: 34 });
  mesh(g, rbox(2.0, 0.055, 0.84, 0.014), topM, M4(0, 0.6925, 0));
  const apronM = lam("v_apron", { map: PV.tableApron() });
  mesh(g, rbox(1.88, 0.095, 0.74, 0.01), apronM, M4(0, 0.617, 0));
  const legM = lam("v_leg", { color: "#a9312a" });
  for (const [x, z] of [[-0.9, -0.33], [0.9, -0.33], [-0.9, 0.33], [0.9, 0.33]]) {
    mesh(g, rbox(0.075, 0.58, 0.075, 0.012), legM, M4(x, 0.29, z));
    mesh(g, rbox(0.11, 0.035, 0.11, 0.01), gold, M4(x, 0.018, z));
    mesh(g, rbox(0.085, 0.03, 0.085, 0.008), gold, M4(x, 0.5, z));
  }
  // the plate on its stand
  const pl = buildPlate(g);
  // the rammed-earth block on its board
  mesh(g, rbox(0.46, 0.02, 0.44, 0.006), lam("v_board", { color: "#8a5a36" }), M4(EB[0], 0.73, EB[2]));
  const bg = new THREE.BoxGeometry(0.36, 0.36, 0.36, 12, 12, 12), bp2 = bg.attributes.position;
  for (let i = 0; i < bp2.count; i++) {
    const x = bp2.getX(i), y = bp2.getY(i), z = bp2.getZ(i);
    const n = 0.0025 * Math.sin(x * 61 + y * 37) + 0.002 * Math.sin(z * 53 - y * 29 + 1) + 0.0015 * Math.sin(y * 140 + x * 9);
    bp2.setXYZ(i, x + n * Math.sign(x) * (Math.abs(x) > 0.17 ? 1 : 0.3), y + n * 0.4, z + n * Math.sign(z) * (Math.abs(z) > 0.17 ? 1 : 0.3));
  }
  bg.computeVertexNormals();
  const side = lam("v_earthSide", { map: PV.earthSide() }), topE = lam("v_earthTop", { map: PV.earthTop() });
  mesh(g, bg, [side, side, topE, side, side, side], M4(EB[0], 0.74 + 0.18, EB[2]));
  // the pillow
  const pw = buildPillow(g);
  // the light shaft from the crown, its pool on the floor, motes
  const shaftGeo = new THREE.CylinderGeometry(0.5, 0.62, 1, 40, 1, true).translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat()); shaft.layers.set(NOINK); shaft.renderOrder = 6; shaft.frustumCulled = false; g.add(shaft);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: PV.softDot(), color: new THREE.Color(0.9, 0.7, 0.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.layers.set(NOINK); pool.renderOrder = 5; g.add(pool);
  const motes: THREE.Sprite[] = [];
  for (let i = 0; i < 46; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: PV.softDot(), color: new THREE.Color(1.6, 1.35, 0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.layers.set(NOINK); s.renderOrder = 7; g.add(s); motes.push(s);
  }
  return { ...pl, pTop: pw.pTop, pBase: pw.pBase, pBot: pw.pBot, pD: -1, shaft, pool, motes, sky };
};

// =====================================================================================================
// MACRO: the grain bed (cliff section), the boulder, the dent
// =====================================================================================================
const BAND = 1.5, SINK = 1.05, BR = 3.0, PALE = new THREE.Color("#f1e2c2");
export const macroTopY = (x: number, z: number) => 9 + 0.35 * Math.sin(x * 0.31 + 1) + 0.25 * Math.sin(z * 0.45 + x * 0.13);
const HIT_XZ: [number, number] = [0, -1.0];
/** world point where the boulder first touches the bed's top (F_MACRO); it then sinks SINK m and stops */
export const MACRO_HIT: V3 = [MACRO[0] + HIT_XZ[0], MACRO[1] + macroTopY(...HIT_XZ), MACRO[2] + HIT_XZ[1]];
const bandOf = (y: number) => ((Math.floor(y / BAND) % 6) + 6) % 6;
type GrainT = { v: number; i: number; c: THREE.Color; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; p1?: THREE.Vector3; q1?: THREE.Quaternion; s1?: THREE.Vector3; s0?: number };
type Pop = GrainT & { f0: number; dur: number; land: THREE.Vector3; apex: number; ax: THREE.Vector3 };
type MacroRig = {
  inst: THREE.InstancedMesh[]; touched: GrainT[]; ring: GrainT[]; pops: Pop[];
  boulder: THREE.Mesh; bq: THREE.Quaternion; bax: THREE.Vector3; cc: THREE.Vector3; dust: { s: THREE.Sprite; a: number; k: number }[]; motes: THREE.Sprite[];
};
const lumpy = (seed: number) => {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.08 * Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 2) + 0.05 * Math.sin(z * 4.3 + x * 1.7 + seed * 3);
    p.setXYZ(i, x * k, y * k * 0.9, z * k);
  }
  g.computeVertexNormals();
  return g;
};
const buildMacro = (g: THREE.Group): MacroRig => {
  const r = rng(1232);
  // ---- dart-throw the grains (biggest first), only in the visible shell: front slab + top slab ----
  const X0 = -13, X1 = 13, YB = -11, ZB = -14, FD = 2.6, TD = 2.2;
  type Cand = { x: number; y: number; z: number; r: number; band: number; seam: boolean };
  const cands: Cand[] = [];
  const NC = 40000;
  for (let i = 0; i < NC; i++) {
    const front = r() < 0.66, x = U(r, X0, X1), skin = r() < 0.3, sk = U(r, 0.22, 0.6), u = r();
    let y: number, z: number;
    if (front) { z = skin ? 0 : U(r, -FD, 0); y = U(r, YB, macroTopY(x, 0)); }
    else { z = U(r, ZB, -FD); y = skin ? macroTopY(x, z) : U(r, macroTopY(x, z) - TD, macroTopY(x, z)); }
    const st = PV.STRATA[bandOf(y - 0.01)];
    const rad = st.r[0] + (st.r[1] - st.r[0]) * Math.pow(u, 1.6);
    if (skin && front) z = -rad * sk;
    if (skin && !front) y -= rad * sk;
    cands.push({ x, y, z, r: rad, band: bandOf(y), seam: false });
  }
  // the pounded seams: a thin course of small dark grains at the top of every band
  for (let i = 0; i < 14000; i++) {
    const x = U(r, X0, X1), k = Math.floor(U(r, Math.floor(YB / BAND), 6)), y = (k + 1) * BAND - U(r, 0.04, 0.3);
    const z = r() < 0.65 ? -U(r, 0.03, 0.08) : U(r, -FD, 0);
    if (y > macroTopY(x, z) - 0.1) continue;
    cands.push({ x, y, z, r: U(r, 0.15, 0.21), band: bandOf(y - 0.01), seam: true });
  }
  cands.sort((a, b) => b.r - a.r);
  const CS = 1.3, cells = new Map<string, number[]>(), kept: Cand[] = [];
  const key = (a: number, b: number, c: number) => `${a},${b},${c}`;
  for (const c of cands) {
    if (c.y + c.r * 0.2 > macroTopY(c.x, c.z) || c.z + c.r * 0.2 > 0 || c.y < YB) continue;
    const ix = Math.floor(c.x / CS), iy = Math.floor(c.y / CS), iz = Math.floor(c.z / CS);
    let ok = true;
    for (let a = -1; a <= 1 && ok; a++) for (let bb = -1; bb <= 1 && ok; bb++) for (let d = -1; d <= 1 && ok; d++) {
      const l = cells.get(key(ix + a, iy + bb, iz + d)); if (!l) continue;
      for (const j of l) { const o = kept[j]; if (Math.hypot(o.x - c.x, o.y - c.y, o.z - c.z) < 0.84 * (o.r + c.r)) { ok = false; break; } }
    }
    if (!ok) continue;
    const k = key(ix, iy, iz), l = cells.get(k);
    if (l) l.push(kept.length); else cells.set(k, [kept.length]);
    kept.push(c);
  }
  // ---- instanced meshes (3 lumpy variants), colours from the strata, darker deep inside ----
  const geos = [lumpy(1), lumpy(2.7), lumpy(4.1)];
  const mat = lam("v_grain", { color: "#ffffff" }, 0.35);
  const counts = [0, 0, 0], vOf = kept.map((_, i) => Math.floor(hash(i, 11) * 3) % 3);
  vOf.forEach((v) => counts[v]++);
  const inst = geos.map((geo, v) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, counts[v])); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m; });
  const fill = [0, 0, 0], all: GrainT[] = [], col = new THREE.Color(), m4 = new THREE.Matrix4();
  kept.forEach((c, i) => {
    const v = vOf[i], idx = fill[v]++;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(i, 1) * TAU, hash(i, 2) * TAU, hash(i, 3) * TAU));
    const s = V(c.r * (0.9 + 0.25 * hash(i, 4)), c.r * (0.85 + 0.2 * hash(i, 5)), c.r * (0.9 + 0.25 * hash(i, 6)));
    const p = V(c.x, c.y, c.z);
    inst[v].setMatrixAt(idx, m4.compose(p, q, s));
    const st = PV.STRATA[c.band];
    col.set(c.seam ? st.line : st.cols[Math.floor(hash(i, 7) * st.cols.length) % st.cols.length]);
    const hsl = { h: 0, s: 0, l: 0 }; col.getHSL(hsl);
    col.setHSL(hsl.h + (hash(i, 8) - 0.5) * 0.02, hsl.s * (0.9 + 0.2 * hash(i, 9)), hsl.l * (0.9 + 0.18 * hash(i, 10)));
    const deep = Math.min(-c.z, macroTopY(c.x, c.z) - c.y);
    col.multiplyScalar(1 - 0.32 * ss(0.4, 1.8, deep));
    inst[v].setColorAt(idx, col);
    all.push({ v, i: idx, c: col.clone(), p, q, s });
  });
  inst.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  // dark backing so the voids between grains read deep
  const backM = lam("v_grainBack", { color: "#4a2c1a" }, 0.15);
  mesh(g, new THREE.BoxGeometry(X1 - X0 + 0.6, 7.7 - YB, -ZB - 0.9), backM, M4(0, (7.7 + YB) / 2, (ZB - 0.9) / 2), false);
  // ---- the boulder ----
  let bgeo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 5);
  bgeo.deleteAttribute("normal"); bgeo.deleteAttribute("uv"); bgeo = mergeVertices(bgeo);
  const cuts = Array.from({ length: 9 }, (_, k) => ({ n: V(hash(k, 21) - 0.5, hash(k, 22) - 0.5, hash(k, 23) - 0.5).normalize(), d: 0.84 + 0.08 * hash(k, 24) }));
  const bpos = bgeo.attributes.position, bcol = new Float32Array(bpos.count * 3), tv = V(0, 0, 0);
  for (let i = 0; i < bpos.count; i++) {
    tv.set(bpos.getX(i), bpos.getY(i), bpos.getZ(i));
    let k = 1 + 0.07 * Math.sin(tv.x * 2.3 + 1) * Math.sin(tv.y * 3.1) + 0.05 * Math.sin(tv.z * 5.1 + tv.x * 2) + 0.025 * Math.sin(tv.y * 11 + tv.z * 7);
    tv.multiplyScalar(k);
    for (const c of cuts) { const dd = tv.dot(c.n); if (dd > c.d) tv.addScaledVector(c.n, c.d - dd); }
    tv.y *= 0.88; tv.multiplyScalar(BR);
    bpos.setXYZ(i, tv.x, tv.y, tv.z);
    k = 0.82 + 0.2 * (0.5 + 0.5 * Math.sin(tv.x * 1.7 + tv.z * 2.3) * Math.sin(tv.y * 2.1 + 1));
    bcol[i * 3] = k * 0.26; bcol[i * 3 + 1] = k * 0.265; bcol[i * 3 + 2] = k * 0.29;
  }
  bgeo.setAttribute("color", new THREE.Float32BufferAttribute(bcol, 3));
  bgeo.computeVertexNormals();
  const boulder = mesh(g, bgeo, lam("v_boulder", { color: "#ffffff", vertexColors: true }));
  boulder.frustumCulled = false;
  const cc = V(HIT_XZ[0], macroTopY(...HIT_XZ) + BR * 0.88, HIT_XZ[1]);           // centre at first contact (y-squashed rock)
  const cf = cc.clone().add(V(0, -SINK, 0));
  // ---- who gets crushed, who shifts, who pops ----
  const touched: GrainT[] = [], ring: GrainT[] = [], pops: Pop[] = [];
  const RX = BR, RY = BR * 0.88;
  const eDist = (p: THREE.Vector3, c: THREE.Vector3) => Math.hypot((p.x - c.x) / RX, (p.y - c.y) / RY, (p.z - c.z) / RX);   // 1 = on the rock's surface
  let popN = 0;
  all.forEach((gr, gi) => {
    const rr = gr.s.y, dN = eDist(gr.p, cf), reach = 1 + (rr * 0.9) / BR;
    if (dN > reach + 0.32) return;
    const e = gr.p.clone().sub(cf); e.y *= (RX / RY) ** 2; e.normalize();
    const hor = Math.hypot(gr.p.x - cf.x, gr.p.z - cf.z), topNear = gr.p.y > macroTopY(gr.p.x, gr.p.z) - 0.6;
    if (popN < 9 && topNear && hor > 1.9 && hor < 3.1 && gr.p.z - cf.z < 0.6 && hash(gi, 31) < 0.55 && dN < reach + 0.2) {
      const dir = V(gr.p.x - cf.x, 0, gr.p.z - cf.z).normalize().applyAxisAngle(V(0, 1, 0), (hash(gi, 32) - 0.5) * 0.7);
      const land = gr.p.clone().addScaledVector(dir, 1.3 + 1.3 * hash(gi, 33));
      land.z = Math.min(land.z, -0.5); land.y = macroTopY(land.x, land.z) + rr * 0.35;
      pops.push({ ...gr, f0: F_MACRO + 1 + (popN % 3), dur: 8 + (popN % 3), land, apex: Math.max(gr.p.y, land.y) + 1.0 + 0.8 * hash(gi, 34), ax: V(hash(gi, 35) - 0.5, hash(gi, 36) - 0.5, hash(gi, 37) - 0.5).normalize() });
      popN++;
      return;
    }
    if (dN < reach) {
      // crushed: pushed out to sit against the rock, flattened along the push direction
      const sq = 0.42 + 0.18 * hash(gi, 38);
      const p1 = cf.clone().add(V(e.x * (RX + rr * sq * 0.8), e.y * (RY + rr * sq * 0.8), e.z * (RX + rr * sq * 0.8)));
      p1.y -= 0.08;
      const q1 = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), e).multiply(Q(V(0, 1, 0), hash(gi, 39) * TAU));
      // the sink at which the rock first reaches this grain
      const d0 = gr.p.clone().sub(cc), R2 = (RX + rr * 0.9) ** 2, hz2 = d0.x * d0.x + d0.z * d0.z;
      const s0 = hz2 >= R2 ? SINK : Math.max(0, -d0.y - (RY / RX) * Math.sqrt(R2 - hz2));
      touched.push({ ...gr, p1, q1, s1: V(rr * 1.2, rr * sq, rr * 1.2), s0: Math.min(s0, SINK * 0.9) });
    } else {
      const k = 1 - (dN - reach) / 0.32, push = 0.16 * k;
      ring.push({ ...gr, p1: gr.p.clone().addScaledVector(e, push).add(V(0, -0.04 * k, 0)), q1: gr.q, s1: gr.s.clone().multiply(V(1.04, 1 - 0.1 * k, 1.04)), s0: 0 });
    }
  });
  // ---- the dust ring: toon puffs ----
  const dust: { s: THREE.Sprite; a: number; k: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: PV.puffTex(), color: new THREE.Color(1, 1, 1), alphaTest: 0.35, fog: false }));
    s.layers.set(NOINK); s.renderOrder = 6; s.visible = false; g.add(s);
    // round the back and sides only: the front of the dent stays clear for the lens
    dust.push({ s, a: ((160 + (i / 13) * 220) * Math.PI) / 180 + (hash(i, 41) - 0.5) * 0.2, k: hash(i, 42) });
  }
  // ---- the "inside the dirt" sky: warm dusty dome + slow motes ----
  const dc = [untone("#ecd3a6"), untone("#d9ab74"), untone("#a8764a")];
  const dome = new THREE.Mesh(new THREE.SphereGeometry(190, 40, 20), new THREE.ShaderMaterial({
    uniforms: { c0: { value: dc[0] }, c1: { value: dc[1] }, c2: { value: dc[2] } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 c0, c1, c2; varying vec3 vP;
      void main(){ float e = normalize(vP).y; vec3 c = mix(c0, c1, smoothstep(0.0, 0.25, e)); c = mix(c, c2, smoothstep(0.25, 0.8, e)); gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.layers.set(NOINK); dome.renderOrder = -0.9; dome.frustumCulled = false; dome.position.set(0, 8, -10); g.add(dome);
  const motes: THREE.Sprite[] = [];
  for (let i = 0; i < 36; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: PV.softDot(), color: new THREE.Color(1.0, 0.86, 0.62), transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
    s.layers.set(NOINK); s.renderOrder = 4; g.add(s); motes.push(s);
  }
  return { inst, touched, ring, pops, boulder, bq: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.1, -0.2)), bax: V(1, 0.2, 0.4).normalize(), cc, dust, motes };
};

// =====================================================================================================
// GREAT: the Ming wall on its ridge, the watchtower, the drawer cut
// =====================================================================================================
/** the cut plane through the wall (great-local origin); the slice (SLICE_L long) slides DRAWER_SLIDE m sideways at cutK */
export const DRAWER_SLIDE = 9;
const SECP: [number, number][] = [[-3.4, -1.6], [3.4, -1.6], [3.3, 1.4], [2.95, 7.0], [2.95, 8.0], [2.45, 8.0], [2.45, 7.0], [-2.55, 7.0], [-2.55, 8.0], [-2.95, 8.0], [-2.95, 7.0], [-3.3, 1.4]];
const CREST: [number, number][] = [[0, 0], [14, 0], [27, 3.0], [42, 1.0], [70, 9], [100, 16], [130, 12], [170, 24], [220, 30], [300, 42], [420, 50]];
const interp = (tab: [number, number][], x: number) => {
  for (let i = 0; i < tab.length - 1; i++) if (x <= tab[i + 1][0]) { const [x0, y0] = tab[i], [x1, y1] = tab[i + 1], u = clamp01((x - x0) / (x1 - x0)); return y0 + (y1 - y0) * (u * u * (3 - 2 * u)); }
  return tab[tab.length - 1][1];
};
type GreatRig = { drawer: THREE.Group; axis: THREE.Vector3; away: THREE.Vector3 };
/** length of the slice that comes out of the wall at cutK (from the cut plane along CUT_AXIS) */
export const SLICE_L = 10;
const buildGreat = (g: THREE.Group): GreatRig => {
  const r = rng(1368);
  // ---- the path of the main wall: from the cut, back along the ridge (curving away to the left and over the hills) ----
  const ctrl = [[0, 0], [-11.0, -4.7], [-24, -12], [-40, -26], [-52, -48], [-60, -76], [-78, -104], [-112, -122], [-150, -140], [-200, -170], [-260, -190], [-330, -215]]
    .map(([x, z]) => V(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
  const L = curve.getLength(), NS = Math.round(L / 1.5);
  const pts = curve.getSpacedPoints(NS);
  const sig = pts.map((_, i) => (i / NS) * L);
  const t0 = pts[1].clone().sub(pts[0]).normalize();
  const axis = t0.clone().negate();                                  // from the cut toward the drawer (camera-right)
  // ---- materials ----
  const brickM = lam("v_ming", { map: PV.mingBrick() });
  const stoneM = lam("v_baseStone", { map: PV.baseStone() });
  const capM = new THREE.MeshBasicMaterial({ map: PV.sectionTex(), color: new THREE.Color(1.0, 0.95, 0.9), side: THREE.DoubleSide });
  const plainCap = lam("v_capPlain", { color: "#8f8a80", side: THREE.DoubleSide });
  /** sweep the section along samples (P, crest y, horizontal normal N toward +u) into brick / stone geometry */
  const sweep = (P: THREE.Vector3[], Y: number[], S: number[], N: THREE.Vector3[]) => {
    const bb: number[][] = [[], []], ub: number[][] = [[], []];
    const vtx = (i: number, k: number) => P[i].clone().addScaledVector(N[i], SECP[k][0]).add(V(0, Y[i] + SECP[k][1], 0));
    const elen: number[] = []; let acc = 0;
    for (let k = 0; k < SECP.length; k++) { elen.push(acc); const a = SECP[k], b2 = SECP[(k + 1) % SECP.length]; acc += Math.hypot(b2[0] - a[0], b2[1] - a[1]); }
    for (let k = 1; k < SECP.length; k++) {
      const k2 = (k + 1) % SECP.length, stone = k === 1 || k === 11 ? 1 : 0;
      const a2 = SECP[k], b2 = SECP[k2], out = V(0, 0, 0);
      const len = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
      for (let i = 0; i < P.length - 1; i++) {
        const v00 = vtx(i, k), v01 = vtx(i, k2), v10 = vtx(i + 1, k), v11 = vtx(i + 1, k2);
        out.copy(N[i]).multiplyScalar(b2[1] - a2[1]).add(V(0, -(b2[0] - a2[0]), 0));
        const nrm = v10.clone().sub(v00).cross(v01.clone().sub(v00));
        const flip = nrm.dot(out) < 0;
        const tri = flip ? [v00, v01, v11, v00, v11, v10] : [v00, v10, v11, v00, v11, v01];
        const tl = stone ? 4 : 2;
        const uvOf = (v: THREE.Vector3) => (v === v00 ? [S[i] / tl, elen[k] / tl] : v === v10 ? [S[i + 1] / tl, elen[k] / tl] : v === v01 ? [S[i] / tl, (elen[k] + len) / tl] : [S[i + 1] / tl, (elen[k] + len) / tl]);
        for (const v of tri) { bb[stone].push(v.x, v.y, v.z); ub[stone].push(...uvOf(v)); }
      }
    }
    return [0, 1].map((s) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(bb[s], 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(ub[s], 2)); geo.computeVertexNormals(); return geo; });
  };
  const cap = (P: THREE.Vector3, y: number, N: THREE.Vector3, mat: THREE.Material, parent: THREE.Object3D) => {
    const sh = new THREE.Shape(SECP.map(([u, yy]) => new THREE.Vector2(u, yy)));
    const geo = new THREE.ShapeGeometry(sh);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), yy = p.getY(i);
      uv.setXY(i, (u + PV.SEC.half) / (2 * PV.SEC.half), Math.max(0, yy) / PV.SEC.top);
      const w = P.clone().addScaledVector(N, u).add(V(0, y + yy, 0)); p.setXYZ(i, w.x, w.y, w.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; parent.add(m);
    return m;
  };
  const merlons = (b: Batch, P: (s: number) => THREE.Vector3, Yf: (s: number) => number, T: (s: number) => THREE.Vector3, N: (s: number) => THREE.Vector3, s0: number, s1: number) => {
    for (let s = s0 + 1; s < s1 - 0.8; s += 2) {
      const p = P(s), t = T(s), n = N(s), yaw = Math.atan2(t.x, t.z);
      b.add(rbox(0.5, 0.9, 1.4, 0.04, 2), brickM, M4(p.x + n.x * 2.7, Yf(s) + 8.45, p.z + n.z * 2.7, yaw));
    }
  };
  // main wall
  const NM = pts.map((_, i) => { const a = pts[Math.max(0, i - 1)], b2 = pts[Math.min(pts.length - 1, i + 1)], t = b2.clone().sub(a).normalize(); return V(t.z, 0, -t.x); });
  const YM = sig.map((s) => interp(CREST, s));
  const [mb, ms] = sweep(pts, YM, sig, NM);
  mesh(g, mb, brickM); mesh(g, ms, stoneM);
  const b = new Batch();
  const sAt = (s: number) => Math.min(pts.length - 1, Math.max(0, Math.round((s / L) * NS)));
  merlons(b, (s) => pts[sAt(s)], (s) => interp(CREST, s), (s) => { const i = sAt(s); return pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(); }, (s) => NM[sAt(s)], 0, 23);
  merlons(b, (s) => pts[sAt(s)], (s) => interp(CREST, s), (s) => { const i = sAt(s); return pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(); }, (s) => NM[sAt(s)], 31, L);
  cap(pts[0], 0, NM[0], capM, g);
  cap(pts[pts.length - 1], YM[YM.length - 1], NM[NM.length - 1], plainCap, g);
  // the watchtower over the wall at sigma 27
  const it = sAt(27), tp = pts[it], tt = pts[it + 1].clone().sub(pts[it - 1]).normalize(), tyaw = Math.atan2(tt.x, tt.z), ty = interp(CREST, 27);
  const towerM = lam("v_tower", { map: PV.towerFace() });
  b.add(rbox(9.6, 14.6, 10, 0.08), towerM, M4(tp.x, ty - 1.6 + 7.3, tp.z, tyaw));
  b.add(rbox(10.2, 0.4, 10.6, 0.06, 2), stoneM, M4(tp.x, ty + 12.8, tp.z, tyaw));
  const tm = new THREE.Matrix4().makeRotationY(tyaw).setPosition(tp.x, ty, tp.z);
  for (let k = 0; k < 5; k++) for (const [sx, sz, rot] of [[-1, 0, 0], [1, 0, 0], [0, -1, 1], [0, 1, 1]] as [number, number, number][]) {
    const o = -4.0 + k * 2.0;
    b.add(rbox(rot ? 1.1 : 0.5, 0.9, rot ? 0.5 : 1.1, 0.04, 2), brickM, tm.clone().multiply(M4(sx ? sx * 4.55 : o, 13.45, sz ? sz * 4.75 : o)));
  }
  const postM = lam("v_post", { color: "#a8362c" });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(rbox(0.3, 2.6, 0.3, 0.04), postM, tm.clone().multiply(M4(sx * 2.4, 14.3, sz * 2.4)));
  const roofG = new THREE.ConeGeometry(4.8, 2.3, 4, 1).rotateY(Math.PI / 4);
  b.add(roofG, lam("v_towerRoof", { map: rep(roofHD("#6f7480"), 3, 1.5), color: "#d6d2cc" }), tm.clone().multiply(M4(0, 16.75, 0)));
  b.add(rbox(6.6, 0.25, 6.6, 0.06), lam("v_eave", { color: "#5d6068" }), tm.clone().multiply(M4(0, 15.55, 0)));
  b.build(g);
  // ---- the near wall along the axis (flat crest): the SLICE s 0..SLICE_L (pulled out sideways, away from the lens, at
  //      cutK like a slice of cake) and the rest s SLICE_L..70 (stays) ----
  const straight = (parent: THREE.Object3D, s0: number, s1: number, capA: THREE.Material, capB: THREE.Material) => {
    const DP: THREE.Vector3[] = [], DY: number[] = [], DS: number[] = [], DN: THREE.Vector3[] = [];
    for (let s = s0; s <= s1 + 1e-6; s += Math.min(2, s1 - s0)) { DP.push(axis.clone().multiplyScalar(s)); DY.push(0); DS.push(s); DN.push(NM[0].clone()); }
    const [db, ds2] = sweep(DP, DY, DS, DN);
    mesh(parent, db, brickM); mesh(parent, ds2, stoneM);
    const bd = new Batch();
    merlons(bd, (s) => axis.clone().multiplyScalar(s), () => 0, () => axis, () => NM[0], s0, s1);
    bd.build(parent);
    cap(axis.clone().multiplyScalar(s0), 0, NM[0], capA, parent);
    cap(axis.clone().multiplyScalar(s1), 0, NM[0], capB, parent);
  };
  const drawer = new THREE.Group(); g.add(drawer);
  straight(drawer, 0, SLICE_L, capM, capM);
  straight(g, SLICE_L, 70, capM, plainCap);
  // the bare footing left behind when the slice comes out (packed earth + stones)
  mesh(g, rbox(6.3, 0.1, SLICE_L, 0.03, 2), lam("v_footing", { map: rep(PV.earthTop(), 4, 4), color: "#d8c0a0" }), M4(axis.x * SLICE_L / 2, 0.02, axis.z * SLICE_L / 2, Math.atan2(axis.x, axis.z)), false);
  // ---- terrain: the ridge under the wall, rolling hills, far ranges ----
  const poly: { p: THREE.Vector3; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) poly.push({ p: pts[i], y: YM[i] });
  for (let s = 2; s <= 160; s += 2) poly.push({ p: axis.clone().multiplyScalar(s), y: s < 80 ? 0 : -6 * ss(80, 160, s) });
  /** ground height: the ridge crest under the wall (flat across its footing), slopes, rolling hills further out */
  const ground = (x: number, z: number) => {
    let best = 1e9, bi = 0;
    for (let k = 0; k < poly.length; k += 4) { const d = (poly[k].p.x - x) ** 2 + (poly[k].p.z - z) ** 2; if (d < best) { best = d; bi = k; } }
    for (let k = Math.max(0, bi - 4); k < Math.min(poly.length, bi + 5); k++) { const d = (poly[k].p.x - x) ** 2 + (poly[k].p.z - z) ** 2; if (d < best) { best = d; bi = k; } }
    // project on the neighbouring segments for a smooth crest
    let crest = poly[bi].y, dd = Math.sqrt(best);
    for (const bj of [bi - 1, bi + 1]) {
      if (bj < 0 || bj >= poly.length) continue;
      const a = poly[Math.min(bi, bj)], c = poly[Math.max(bi, bj)], ex = c.p.x - a.p.x, ez = c.p.z - a.p.z, L2 = ex * ex + ez * ez || 1;
      const t = clamp01(((x - a.p.x) * ex + (z - a.p.z) * ez) / L2), px = a.p.x + ex * t, pz = a.p.z + ez * t, d2 = Math.hypot(x - px, z - pz);
      if (d2 <= dd + 1e-6) { dd = d2; crest = a.y + (c.y - a.y) * t; }
    }
    const drop = 22 * (1 - Math.exp(-((Math.max(0, dd - 4.4) / 26) ** 2)));
    const hills = (7 * Math.sin(x * 0.021 + 0.7) * Math.sin(z * 0.017 + 0.3) + 3.5 * Math.sin(x * 0.05 + z * 0.031) + 1.2 * Math.sin(x * 0.13 - z * 0.11)) * ss(14, 45, dd);
    return { y: crest - drop + hills, d: dd };
  };
  const GX0 = -330, GX1 = 150, GZ0 = -330, GZ1 = 120, NX = 220, NZ = 210;
  const tg = new THREE.PlaneGeometry(GX1 - GX0, GZ1 - GZ0, NX, NZ).rotateX(-Math.PI / 2).translate((GX0 + GX1) / 2, 0, (GZ0 + GZ1) / 2);
  const tpp = tg.attributes.position, tuv = tg.attributes.uv;
  for (let i = 0; i < tpp.count; i++) {
    const x = tpp.getX(i), z = tpp.getZ(i);
    tpp.setY(i, ground(x, z).y - 0.02);
    tuv.setXY(i, x / 8, z / 8);
  }
  tg.computeVertexNormals();
  mesh(g, tg, lam("v_greatGrass", { map: grassHD(), color: "#c8d8a8" }), undefined, false).receiveShadow = true;
  // far ranges (fogged into the golden haze)
  const fb = new Batch(), dome = new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2);
  const farA = lam("v_farA", { color: "#7f9f6a" }), farB = lam("v_farB", { color: "#6f8f66" });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + U(r, -0.1, 0.1), d = U(r, 420, 760), w = U(r, 110, 240), h = U(r, 30, 80);
    fb.add(dome, i % 2 ? farA : farB, M4(Math.cos(a) * d - 80, -20, Math.sin(a) * d - 80, a, [w, h + 20, w * U(r, 0.5, 0.9)]));
  }
  fb.build(g, false);
  // toon trees on the slopes (kept off the camera's flight)
  const tb = new Batch(), leaf = lam("v_leaf", { color: "#5d9a46" }), leaf2 = lam("v_leaf2", { color: "#6aa84e" }), bark = lam("v_bark", { color: "#7a5236" });
  const blob = new THREE.IcosahedronGeometry(1, 1);
  let placed = 0;
  for (let i = 0; i < 400 && placed < 46; i++) {
    const x = U(r, -200, 120), z = U(r, -240, 100), gr = ground(x, z), d = gr.d;
    if (d < 13 || d > 90) continue;
    // keep the camera's side of the near wall clear (its flight GW(7.5,7.5,9.8) .. GW(30,14,40) looks at the cut)
    const camSide = -0.39 * x + 0.92 * z > 0;
    if (camSide && d < 28 && x > -60) continue;
    const along = (x - 7.5) * 0.597 + (z - 9.8) * 0.801, off = Math.abs((x - 7.5) * 0.801 - (z - 9.8) * 0.597);
    if (along > -20 && along < 60 && off < 22) continue;
    const y = gr.y, h = U(r, 3, 5.5);
    tb.add(rod(V(x, y - 0.3, z), V(x, y + h * 0.55, z), 0.22, 6, 0.16), bark);
    for (let k = 0; k < 3; k++) tb.add(blob, k % 2 ? leaf2 : leaf, M4(x + U(r, -0.9, 0.9), y + h * (0.65 + 0.12 * k), z + U(r, -0.9, 0.9), U(r, 0, 6), [h * 0.32, h * 0.28, h * 0.32]));
    placed++;
  }
  tb.build(g);
  return { drawer, axis, away: NM[0].clone().negate() };
};

// =====================================================================================================
export class VenueRig {
  group = new THREE.Group();
  private gL: THREE.Group; private gM: THREE.Group; private gG: THREE.Group;
  // each set is built once, the first time one of its shots renders (stills of the other places don't pay for it)
  private les: LessonRig | null = null; private mac: MacroRig | null = null; private grt: GreatRig | null = null;
  private c = new THREE.Color(); private m4 = new THREE.Matrix4(); private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private q1 = new THREE.Quaternion(); private s1 = new THREE.Vector3();
  constructor(root: THREE.Group) {
    root.add(this.group);
    const grp = (at: V3) => { const g = new THREE.Group(); g.position.set(...at); g.visible = false; this.group.add(g); return g; };
    this.gL = grp(LESSON); this.gM = grp(MACRO); this.gG = grp(GREAT);
  }
  update(sid: number, f: number, _cam: THREE.PerspectiveCamera) {
    const set = SHOTS[sid - 1].set;
    this.gL.visible = set === "lesson"; this.gM.visible = set === "macro"; this.gG.visible = set === "great";
    if (set === "lesson") this.poseLesson(f, (this.les ??= buildLesson(this.gL)));
    else if (set === "macro") this.poseMacro(f, (this.mac ??= buildMacro(this.gM)));
    else if (set === "great") this.poseGreat(f, (this.grt ??= buildGreat(this.gG)));
  }

  private poseLesson(f: number, k: LessonRig) {
    // plate: crack grows F_PLATE+1..+10, shards fall from F_PLATE+11
    const grow = clamp01((f - F_PLATE - 0.5) / 9.5), split = f >= F_PLATE + 10.5;
    for (const c of k.cracks) { c.m.visible = grow > 0 && !split; c.m.geometry.setDrawRange(0, 6 * Math.round(c.n * grow)); }
    for (const s of k.shards) {
      const u = clamp01((f - s.t0) / s.dur);
      this.v1.copy(s.p0).lerp(s.p1, u); this.v1.y = s.p0.y + (s.p1.y - s.p0.y) * u * u;
      const bt = f - (s.t0 + s.dur);
      if (bt > 0 && bt < 8) this.v1.y += 0.01 * Math.abs(Math.sin(bt * 1.1)) * Math.exp(-bt * 0.55);
      s.m.position.copy(this.v1);
      s.m.quaternion.copy(s.q0).slerp(s.q1, Math.pow(u, 1.25));
    }
    // pillow dent
    const D = DENT_MAX * pillowDentK(f);
    if (Math.abs(D - k.pD) > 1e-6) {
      k.pD = D;
      const p = k.pTop.attributes.position as THREE.BufferAttribute, a = p.array as Float32Array, sg = 0.08;
      const ca = (k.pTop.attributes.color as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < p.count; i++) {
        const x = k.pBase[i * 3], y = k.pBase[i * 3 + 1], z = k.pBase[i * 3 + 2], d = Math.hypot(x * 0.95, z - 0.01) / sg;
        // a cup (steep rim: the ink draws it) + a soft swell pushed out round it
        const cup = 1 - ss(0.5, 1.25, d), dy = -D * cup + 0.16 * D * Math.exp(-(((d - 1.5) / 0.45) ** 2));
        a[i * 3 + 1] = Math.max(y + dy, k.pBot[i * 3 + 1] + 0.012);
        a[i * 3] = x * (1 + 0.3 * D * Math.exp(-d * d * 0.2)); a[i * 3 + 2] = z * (1 + 0.3 * D * Math.exp(-d * d * 0.2));
        const ao = 1 - 0.5 * (D / DENT_MAX) * (1 - ss(0.2, 1.15, d));
        ca[i * 3] = ao * 0.92; ca[i * 3 + 1] = ao * 0.95; ca[i * 3 + 2] = ao;
      }
      (k.pTop.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      p.needsUpdate = true; k.pTop.computeVertexNormals();
    }
    // the light shaft: from the crown down to the floor behind Subutai's left (a column behind the plate in its close-ups);
    // it leans the same way as the sun's shadows, only steeper
    const sd = this.v2.set(0.9, 3.22, 2.0).normalize();
    const top = this.v1.set(0, 3.22, 0), len = top.y / sd.y;
    const foot = top.clone().addScaledVector(sd, -len);
    k.shaft.position.copy(foot); k.shaft.quaternion.setFromUnitVectors(V(0, 1, 0), sd); k.shaft.scale.set(1, len, 1);
    k.pool.position.set(foot.x, 0.02, foot.z); k.pool.rotation.set(0, Math.atan2(sd.x, sd.z), 0); k.pool.scale.set(1.5, 1, 1.5 / Math.max(0.35, sd.y));
    k.motes.forEach((m, i) => {
      const t = (hash(i, 51) + f * 0.0012) % 1, rad = 0.55 * Math.sqrt(hash(i, 52)), a = hash(i, 53) * TAU + f * 0.004 * (hash(i, 54) - 0.5);
      const p = top.clone().addScaledVector(sd, -len * (0.08 + 0.85 * t));
      p.x += Math.cos(a) * rad; p.z += Math.sin(a) * rad; p.y += 0.04 * Math.sin(f * 0.05 + i);
      m.position.copy(p); const sc = 0.012 + 0.012 * hash(i, 55); m.scale.set(sc, sc, 1);
      (m.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * t) * (0.5 + 0.5 * Math.sin(f * 0.11 + i * 2.3));
    });
  }

  private poseMacro(f: number, k: MacroRig) {
    const F = F_MACRO;
    // boulder: free fall from rest 22 f before the hit (2.35 m/f at contact), then sinks SINK m in 6 f and stops dead
    const T0 = 22 / 30, A = 96;
    let cy: number, spin = 0;
    if (f < F) { const tau = Math.min(T0, (F - f) / 30); cy = k.cc.y + A * T0 * tau - 0.5 * A * tau * tau; spin = (f - F) * 0.05; }
    else cy = k.cc.y - SINK * easeOut((f - F) / 6);
    const sink = f < F ? 0 : SINK * easeOut((f - F) / 6);
    k.boulder.visible = f >= F - 24;
    k.boulder.position.set(k.cc.x, cy, k.cc.z);
    k.boulder.quaternion.copy(k.bq).premultiply(this.q1.setFromAxisAngle(k.bax, spin));
    // crushed grains follow the rock in; the next ring shifts a little; pops fly and settle
    const set = (gr: GrainT, kk: number) => {
      this.v1.copy(gr.p).lerp(gr.p1!, kk); this.q1.copy(gr.q).slerp(gr.q1!, kk); this.s1.copy(gr.s).lerp(gr.s1!, kk);
      k.inst[gr.v].setMatrixAt(gr.i, this.m4.compose(this.v1, this.q1, this.s1));
    };
    for (const gr of k.touched) {
      const kk = clamp01((sink - gr.s0!) / Math.max(0.12, SINK - gr.s0!));
      set(gr, kk);
      k.inst[gr.v].setColorAt(gr.i, this.c.copy(gr.c).lerp(PALE, 0.5 * kk));
    }
    const ringK = sink / SINK;
    for (const gr of k.ring) set(gr, ringK);
    for (const p of k.pops) {
      const u = clamp01((f - p.f0) / p.dur);
      if (u <= 0) { k.inst[p.v].setMatrixAt(p.i, this.m4.compose(p.p, p.q, p.s)); continue; }
      this.v1.copy(p.p).lerp(p.land, u);
      const base = p.p.y + (p.land.y - p.p.y) * u, top = p.apex;
      this.v1.y = base + 4 * (top - (p.p.y + p.land.y) / 2) * u * (1 - u);
      const bt = f - (p.f0 + p.dur);
      if (bt > 0 && bt < 7) this.v1.y += 0.22 * Math.abs(Math.sin(bt * 0.9)) * Math.exp(-bt * 0.6);
      this.q1.copy(p.q).premultiply(Q(p.ax, Math.min(f - p.f0, p.dur) * 0.45));
      k.inst[p.v].setMatrixAt(p.i, this.m4.compose(this.v1, this.q1, p.s));
    }
    k.inst.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    // dust ring
    const du = (f - F) / 26;
    for (const d of k.dust) {
      d.s.visible = du >= 0 && du < 1;
      if (!d.s.visible) continue;
      const e = easeOut(du), rad = 2.7 + 3.4 * e * (0.8 + 0.4 * d.k);
      d.s.position.set(k.cc.x + Math.cos(d.a) * rad, macroTopY(k.cc.x, k.cc.z) + 0.35 + 0.8 * e + 0.3 * d.k, k.cc.z + Math.sin(d.a) * rad);
      // toon puffs: pop out in ~6 f, drift out, shrink away to nothing (no transparency)
      const sc = 3.2 * (0.8 + 0.4 * d.k) * easeOut(Math.min(1, (f - F + 0.6) / 6)) * (1 - ss(0.35, 1, du));
      d.s.visible = sc > 0.02; d.s.scale.set(sc, sc * 0.82, 1);
      (d.s.material as THREE.SpriteMaterial).rotation = d.a + du * 0.6;
    }
    // drifting motes in the amber air behind the bed
    k.motes.forEach((m, i) => {
      const x = (hash(i, 61) - 0.5) * 60 + Math.sin(f * 0.01 + i) * 1.5, y = 12 + hash(i, 62) * 22 + ((f * 0.02 + hash(i, 63) * 10) % 10) - 5, z = -8 - hash(i, 64) * 50;
      m.position.set(x, y, z); const sc = 0.3 + 0.9 * hash(i, 65); m.scale.set(sc, sc, 1);
    });
  }

  private poseGreat(f: number, k: GreatRig) {
    const c = cutK(f);
    // the slice slides out sideways (away from the lens) and settles a little down the far slope
    k.drawer.position.copy(k.away).multiplyScalar(DRAWER_SLIDE * c);
    k.drawer.position.y = -0.8 * c + 0.3 * Math.sin(Math.PI * c);
  }
}
