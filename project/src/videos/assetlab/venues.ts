// VENUE RIG (owner: venue). Three visiting sets, each in its own group at its story.ts origin, shown only while a
// shot of that set renders:
//  SCROLL (shot 8): a warm Greek/Roman study: terracotta tiles, ochre plaster with a red dado + painted border band,
//    a window (sunny view, light shaft + floor patch + motes), a shelf of scroll cubbies behind the writer, the desk
//    with the unrolled papyrus (its ink drawing draws itself by drawK: a squealing pig, then an elephant running away),
//    an inkpot + reed pens, a bronze oil lamp (HDR flame + halo), the writer's stool, an amphora, a basket of scrolls.
//  STABLE (shot 9): a dusty paddock (rough rail fence ~18 x 14 m, gates at the SW corner + the south middle), a
//    thatched open-fronted barn on the north side, hay piles (the big one at the mother's trunk), troughs (a stone one
//    near baby 0), straw, olive + palm trees outside, distant hills.
//  EDESSA (shot 10, golden): the 12 m wall along local z = 0 (x -70..70, returns north), side towers at x +-28 / +-56,
//    the square 18 m tower at x 0 with the beam + pulley (tip = BEAM_TIP), the bucket on the platform, shields +
//    banners, the city behind the wall, the plain, the Persian camp (tents, pennants, 3 siege towers, smoke), hills.
// update(sid, f, cam) is a pure function of (sid, f); f may be fractional. Geometry is built once.
import * as THREE from "three";
import { Batch, V } from "./build";
import { rep, beamHD, planksHD, grassHD, water } from "./paint";
import * as PV from "./paintv";
import { twoTone } from "./shade";
import { NOINK } from "./ink";
import {
  SHOTS, SCROLL_ROOM, SCROLL_AT, WRITER_AT, STABLE, BABY, MOTHER, EDESSA, ED_WALL_H, ED_TOWER_H, BEAM_TIP, ROMAN_AT,
  drawK, storyF, hash, camStatic, type V3,
} from "./story";

const TAU = Math.PI * 2;
type C3 = [number, number, number];
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
const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], m?: THREE.Matrix4, cast = true, noInk = false) => {
  const o = new THREE.Mesh(geo, mat);
  if (m) o.applyMatrix4(m);
  o.castShadow = cast; o.receiveShadow = true;
  if (noInk) o.layers.set(NOINK);
  parent.add(o);
  return o;
};
const additive = (map: THREE.Texture, col: C3) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(...col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const spriteAdd = (col: C3, opacity = 1) => new THREE.Sprite(new THREE.SpriteMaterial({ map: PV.softDot(), color: new THREE.Color(...col), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));

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
/** a cylinder of radius rad from a to b (rad2 at b) */
const rod = (a: THREE.Vector3, b: THREE.Vector3, rad: number, seg = 8, rad2 = rad) => {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(rad2, rad, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
};
/** planar uv from world xz (or any two axes) in metres / tile */
const uvFrom = (g: THREE.BufferGeometry, fu: (p: THREE.Vector3) => number, fv: (p: THREE.Vector3) => number) => {
  const p = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2), t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { t.fromBufferAttribute(p, i); uv[i * 2] = fu(t); uv[i * 2 + 1] = fv(t); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};
/** a lumpy blob (icosphere with deterministic noise) */
const blob = (seed: number, detail = 2, amp = 0.16) => {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position as THREE.BufferAttribute;
  const merged = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = `${x.toFixed(3)}_${y.toFixed(3)}_${z.toFixed(3)}`;
    let n = merged.get(key);
    if (n === undefined) { n = 1 + amp * (Math.sin(x * 3.1 + seed) * 0.6 + Math.sin(y * 4.3 + seed * 1.7) * 0.5 + Math.sin(z * 5.7 + seed * 2.3) * 0.4); merged.set(key, n); }
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
};
/** smooth lathe from an (r, y) profile */
const lathe = (prof: [number, number][], seg = 28) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const shaftMat = (col: C3, k: number) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Vector3(...col) }, uK: { value: k } },
  vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uK; varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 3.0) * smoothstep(0.0, 0.3, vY) * (0.35 + 0.65 * vY) * uK; gl_FragColor = vec4(uCol, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

// =====================================================================================================
// THE SELF-DRAWING SCROLL: a pig with squeal arcs (drawK 0..0.5), then an elephant running away (0.5..1).
// Canvas 1792 x 2304 px over a 0.28 x 0.36 m decal centred on SCROLL_AT (6400 px/m); canvas top = north (-z), so the
// drawing reads upright for a camera on the +z side looking north / down. Pictures only, no letters.
// =====================================================================================================
export const DRAW_W = 0.28, DRAW_D = 0.36;
const CW = 1792, CH = 2304;
type Pt = [number, number];
type Stroke = { pts: Pt[]; cum: number[]; total: number; w: number; fill: boolean; knock: Pt[] | null; t0: number; t1: number };
const catmull = (c: Pt[], closed: boolean, step = 4): Pt[] => {
  const n = c.length, out: Pt[] = [];
  const P = (i: number) => (closed ? c[((i % n) + n) % n] : c[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? [c[0][0], c[0][1]] : [c[n - 1][0], c[n - 1][1]]);
  return out;
};
const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360): Pt[] => {
  const n = Math.max(12, Math.ceil(((Math.abs(a1 - a0) / 360) * TAU * Math.max(rx, ry)) / 4)), out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
};
type Spec = { pts: Pt[]; w: number; fill?: boolean; knock?: boolean; knockUp?: number; part: 0 | 1 };
let DRAWING: Stroke[] | null = null;
const drawing = (): Stroke[] => {
  if (DRAWING) return DRAWING;
  const S: Spec[] = [];
  const mir = (p: Pt[]): Pt[] => p.map(([x, y]) => [CW - x, y] as Pt);
  // ---- the pig (authored facing left, mirrored to face right, lower left of the sheet) ----
  const pig = (pts: Pt[], w: number, o: Partial<Spec> = {}) => S.push({ pts: mir(pts), w, part: 0, ...o });
  const C = (c: Pt[], closed = false) => catmull(c, closed);
  pig(ellPts(700, 1700, 170, 160), 13);                                                   // head
  pig(ellPts(522, 1668, 50, 70), 13, { knock: true });                                    // snout disc
  pig(ellPts(508, 1640, 9, 14), 6, { fill: true }); pig(ellPts(530, 1698, 9, 14), 6, { fill: true }); // nostrils
  pig(C([[760, 1552], [795, 1440], [870, 1530]]), 12);                                    // ears
  pig(C([[648, 1556], [630, 1450], [712, 1532]]), 12);
  pig(ellPts(650, 1640, 22, 30), 8, { fill: true });                                      // wide eye
  pig(C([[612, 1585], [650, 1568], [690, 1588]]), 10);                                    // raised brow
  pig(C([[572, 1735], [598, 1805], [655, 1832], [712, 1800], [690, 1758], [630, 1748]], true), 11, { fill: true }); // screaming mouth
  pig(ellPts(1080, 1830, 330, 210, -130, 150), 14);                                       // body
  pig(C([[794, 1935], [762, 1898], [732, 1860]]), 12);                                    // chin
  for (let i = 0; i < 5; i++) pig(C([[960 + 70 * i, 2004], [995 + 70 * i, 1970]]), 7);    // belly hatching
  pig(C([[850, 1985], [838, 2085], [892, 2092], [902, 2002]]), 12, { knock: true, knockUp: 30 }); // legs
  pig(C([[935, 2012], [935, 2097], [988, 2098], [990, 2024]]), 12, { knock: true, knockUp: 30 });
  pig(C([[1188, 2022], [1196, 2100], [1250, 2102], [1254, 2014]]), 12, { knock: true, knockUp: 30 });
  pig(C([[1290, 1998], [1318, 2082], [1368, 2072], [1345, 1982]]), 12, { knock: true, knockUp: 30 });
  pig(C([[1405, 1785], [1462, 1748], [1490, 1700], [1458, 1668], [1428, 1700], [1455, 1734], [1505, 1726]]), 10); // curly tail
  pig(C([[790, 2120], [1100, 2128], [1420, 2112]]), 9);                                   // ground
  for (const rad of [110, 190, 270]) S.push({ pts: ellPts(1330, 1700, rad, rad, -100, -10), w: 12, part: 0 }); // squeal arcs
  // ---- the elephant (running right, away from the pig; upper half): big flared ear, long raised trunk, tusk,
  //      pillar legs with toenails, dust puffs + speed lines behind ----
  const el = (pts: Pt[], w: number, o: Partial<Spec> = {}) => S.push({ pts, w, part: 1, ...o });
  el(ellPts(760, 650, 420, 255), 14);                                                     // body
  for (let i = 0; i < 6; i++) el(C([[560 + 70 * i, 862], [592 + 70 * i, 832]]), 7);      // belly hatching
  const leg = (c: Pt[], nails: Pt[]) => { el(C(c), 13, { knock: true, knockUp: 34 }); for (const [x, y] of nails) el(ellPts(x, y, 13, 10, 190, 350), 8); };
  leg([[960, 860], [1010, 960], [1070, 1060], [1080, 1092], [1150, 1098], [1215, 1072], [1205, 1040], [1150, 950], [1085, 818]], [[1108, 1084], [1143, 1088], [1178, 1080]]);
  leg([[870, 880], [860, 990], [850, 1085], [855, 1110], [915, 1114], [975, 1104], [975, 1080], [975, 990], [985, 872]], [[877, 1100], [913, 1104], [949, 1100]]);
  leg([[500, 840], [440, 940], [370, 1030], [345, 1060], [365, 1100], [430, 1100], [470, 1060], [545, 980], [620, 880]], [[380, 1088], [412, 1090]]);
  leg([[650, 890], [660, 1000], [650, 1090], [655, 1112], [720, 1116], [775, 1108], [775, 1085], [765, 990], [760, 895]], [[677, 1102], [712, 1106], [747, 1102]]);
  el(C([[343, 610], [280, 580], [230, 620], [180, 590]]), 11);                            // tail + tuft
  for (const e of [[142, 566], [146, 616], [134, 592]] as Pt[]) el(C([[180, 590], e]), 9);
  el(ellPts(1250, 500, 215, 200), 14, { knock: true });                                   // head
  el(C([[1170, 330], [1060, 250], [930, 270], [860, 400], [870, 560], [920, 700], [1000, 790], [1080, 760], [1130, 660], [1160, 520]], true), 14, { knock: true }); // flared ear
  el(C([[1110, 360], [990, 330], [930, 450], [960, 620], [1020, 700]]), 9);
  el(C([[1452, 430], [1560, 385], [1640, 265], [1625, 150]]), 14);                        // trunk, raised high
  el(C([[1440, 575], [1590, 535], [1700, 385], [1705, 170]]), 14);
  el(C([[1625, 150], [1662, 120], [1705, 170]]), 12);
  el(ellPts(1664, 150, 24, 11, 0, 360), 8);
  for (const w of [[[1515, 418], [1530, 470], [1540, 540]], [[1580, 368], [1608, 420], [1622, 492]], [[1630, 300], [1658, 345], [1682, 405]]] as Pt[][]) el(C(w), 8);
  el(C([[1395, 610], [1405, 680], [1460, 700], [1450, 630]], true), 10, { knock: true }); // open mouth
  el(C([[1440, 640], [1510, 690], [1575, 665]]), 11); el(C([[1450, 665], [1512, 712], [1575, 665]]), 11); // tusk
  el(ellPts(1320, 440, 32, 40), 10); el(ellPts(1306, 452, 14, 17), 4, { fill: true });    // wide eye, looking back
  el(C([[1272, 372], [1322, 350], [1370, 378]]), 10);
  el(C([[1425, 285], [1411, 327], [1426, 347], [1441, 327]], true), 8);                   // sweat drops
  el(C([[1478, 318], [1465, 351], [1478, 367], [1491, 351]], true), 8);
  for (const t of [[[1210, 268], [1198, 222]], [[1290, 258], [1295, 212]], [[1360, 275], [1385, 235]]] as Pt[][]) el(C(t), 9);
  const puff = (cx: number, cy: number, r: number) => {
    const c: Pt[] = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, rr = r * (1 + 0.14 * Math.cos(a * 7)); c.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.78]); }
    el(C(c, true), 10, { knock: true });
  };
  puff(300, 1060, 62); puff(190, 1000, 46); puff(110, 1075, 38); puff(460, 1112, 36);    // dust puffs
  for (const s of [[[320, 450], [130, 450]], [[320, 720], [90, 720]], [[330, 860], [150, 860]]] as Pt[][]) el(C(s), 9); // speed lines
  el(C([[500, 1126], [1000, 1134], [1400, 1120]]), 9);                                    // ground
  // ---- timing: within each half, time ~ stroke length + a pen lift ----
  const out: Stroke[] = [];
  for (const part of [0, 1] as const) {
    const list = S.filter((s) => s.part === part);
    const lens = list.map((s) => { let L = 0; for (let i = 1; i < s.pts.length; i++) L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); return L; });
    const weight = lens.map((L) => L + 140), W = weight.reduce((a, b) => a + b, 0);
    let acc = 0;
    list.forEach((s, i) => {
      const cum = [0]; for (let k = 1; k < s.pts.length; k++) cum.push(cum[k - 1] + Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]));
      let knock: Pt[] | null = null;
      if (s.knock) {
        knock = s.pts.slice();
        if (s.knockUp) { const a = s.pts[0], b = s.pts[s.pts.length - 1]; knock.push([b[0], b[1] - s.knockUp], [a[0], a[1] - s.knockUp]); }
      }
      const t0 = part * 0.5 + (0.5 * acc) / W, t1 = part * 0.5 + (0.5 * (acc + lens[i])) / W;
      out.push({ pts: s.pts, cum, total: lens[i], w: s.w * 1.35, fill: !!s.fill, knock, t0, t1 });
      acc += weight[i];
    });
  }
  DRAWING = out;
  return out;
};
const INKC = "#2e1c10";
class ScrollDrawing {
  cv = document.createElement("canvas");
  g: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  private k = -1;
  constructor() {
    this.cv.width = CW; this.cv.height = CH;
    this.g = this.cv.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
  }
  set(dk: number) {
    const q = Math.round(Math.max(0, Math.min(1, dk)) * 240) / 240;
    if (q === this.k) return;
    this.k = q;
    const g = this.g;
    g.clearRect(0, 0, CW, CH);
    g.lineCap = "round"; g.lineJoin = "round";
    for (const s of drawing()) {
      if (q <= s.t0) break;
      const rho = s.t1 > s.t0 ? Math.min(1, (q - s.t0) / (s.t1 - s.t0)) : 1;
      if (s.knock) {
        g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath();
        s.knock.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.restore();
      }
      if (s.fill && rho >= 1) {
        g.fillStyle = INKC; g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      }
      const lim = rho * s.total;
      g.strokeStyle = INKC;
      for (let i = 1; i < s.pts.length; i++) {
        if (s.cum[i - 1] >= lim) break;
        const sm = s.cum[i], taper = Math.min(1, 0.45 + Math.min(sm, s.total - sm, lim - s.cum[i - 1] + 20) / 50);
        let [x1, y1] = s.pts[i];
        if (s.cum[i] > lim) { const u = (lim - s.cum[i - 1]) / Math.max(1e-6, s.cum[i] - s.cum[i - 1]); x1 = s.pts[i - 1][0] + (x1 - s.pts[i - 1][0]) * u; y1 = s.pts[i - 1][1] + (y1 - s.pts[i - 1][1]) * u; }
        g.lineWidth = s.w * taper; g.beginPath(); g.moveTo(s.pts[i - 1][0], s.pts[i - 1][1]); g.lineTo(x1, y1); g.stroke();
      }
    }
    this.tex.needsUpdate = true;
  }
}
/** world point of the drawing's pen tip at story frame st (the writer's reed pen can follow it); null when idle */
export const scrollPenAt = (st: number): V3 | null => {
  const q = drawK(st);
  if (q <= 0 || q >= 1) return null;
  for (const s of drawing()) {
    if (q < s.t0) { const p = s.pts[0]; return [SCROLL_AT[0] + (p[0] / CW - 0.5) * DRAW_W, SCROLL_AT[1] + 0.001, SCROLL_AT[2] + (p[1] / CH - 0.5) * DRAW_D]; }
    if (q <= s.t1) {
      const lim = ((q - s.t0) / Math.max(1e-6, s.t1 - s.t0)) * s.total;
      let i = 1; while (i < s.cum.length - 1 && s.cum[i] < lim) i++;
      const p = s.pts[i];
      return [SCROLL_AT[0] + (p[0] / CW - 0.5) * DRAW_W, SCROLL_AT[1] + 0.001, SCROLL_AT[2] + (p[1] / CH - 0.5) * DRAW_D];
    }
  }
  return null;
};

// =====================================================================================================
// SCROLL: the writer's room (local = SCROLL_ROOM)
// =====================================================================================================
const RX0 = -3.0, RX1 = 2.5, RZ0 = -2.6, RZ1 = 2.6, RH = 3.2;
const WIN = { x0: -2.65, x1: -1.95, y0: 1.25, y1: 2.35 };
export const LAMP_FLAME: V3 = at3(SCROLL_ROOM, -0.47, 0.835, -0.1);
function at3(o: V3, x: number, y: number, z: number): V3 { return [o[0] + x, o[1] + y, o[2] + z]; }
type RoomRig = { draw: ScrollDrawing; flame: THREE.Mesh; core: THREE.Mesh; halo: THREE.Sprite; halo2: THREE.Sprite; motes: THREE.Sprite[]; moteBase: THREE.Vector3[] };
const buildRoom = (g: THREE.Group): RoomRig => {
  const wood = lam("pv_wood", { map: beamHD(), color: "#b39276" });
  const woodDk = lam("pv_woodDk", { color: "#6e4428" });
  // ---- shell (NOINK: no lines on wall / floor joins; no shadows from the shell: the sun stands in for the room light)
  const floor = uvFrom(new THREE.PlaneGeometry(RX1 - RX0, RZ1 - RZ0).rotateX(-Math.PI / 2).translate((RX0 + RX1) / 2, 0, 0), (p) => p.x / 2, (p) => -p.z / 2);
  mesh(g, floor, lam("pv_floor", { map: PV.roomFloor() }), undefined, false, true);
  const wallM = lam("pv_wall", { map: PV.roomWall(), emissive: "#ffffff", emissiveMap: PV.roomWall(), emissiveIntensity: 0.16 });
  const wv = (p: THREE.Vector3) => p.y / RH;
  const back = new THREE.Shape([V(RX0, 0, 0), V(RX1, 0, 0), V(RX1, RH, 0), V(RX0, RH, 0)].map((v) => new THREE.Vector2(v.x, v.y)));
  back.holes.push(new THREE.Path([new THREE.Vector2(WIN.x0, WIN.y0), new THREE.Vector2(WIN.x0, WIN.y1), new THREE.Vector2(WIN.x1, WIN.y1), new THREE.Vector2(WIN.x1, WIN.y0)]));
  mesh(g, uvFrom(new THREE.ShapeGeometry(back).translate(0, 0, RZ0), (p) => p.x / 2, wv), wallM, undefined, false, true);
  mesh(g, uvFrom(new THREE.PlaneGeometry(RZ1 - RZ0, RH).rotateY(Math.PI / 2).translate(RX0, RH / 2, 0), (p) => p.z / 2, wv), wallM, undefined, false, true);
  mesh(g, uvFrom(new THREE.PlaneGeometry(RZ1 - RZ0, RH).rotateY(-Math.PI / 2).translate(RX1, RH / 2, 0), (p) => -p.z / 2, wv), wallM, undefined, false, true);
  mesh(g, uvFrom(new THREE.PlaneGeometry(RX1 - RX0, RH).rotateY(Math.PI).translate((RX0 + RX1) / 2, RH / 2, RZ1), (p) => -p.x / 2, wv), wallM, undefined, false, true);
  mesh(g, new THREE.PlaneGeometry(RX1 - RX0, RZ1 - RZ0).rotateX(Math.PI / 2).translate((RX0 + RX1) / 2, RH, 0), lam("pv_ceil", { color: "#e2c79a" }), undefined, false, true);
  for (let k = 0; k < 5; k++) mesh(g, rbox(RX1 - RX0, 0.16, 0.14, 0.02), woodDk, M4((RX0 + RX1) / 2, RH - 0.08, RZ0 + 0.5 + k * 1.05), false);
  // window: reveal, frame, sill, open shutters, the sunny view, the light shaft + floor patch + motes
  const wc = V((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, RZ0), ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
  const reveal = lam("pv_reveal", { color: "#e4b878" });
  mesh(g, new THREE.PlaneGeometry(0.34, wh).rotateY(Math.PI / 2).translate(WIN.x0, wc.y, RZ0 - 0.17), reveal, undefined, false, true);
  mesh(g, new THREE.PlaneGeometry(0.34, wh).rotateY(-Math.PI / 2).translate(WIN.x1, wc.y, RZ0 - 0.17), reveal, undefined, false, true);
  mesh(g, new THREE.PlaneGeometry(ww, 0.34).rotateX(Math.PI / 2).translate(wc.x, WIN.y1, RZ0 - 0.17), reveal, undefined, false, true);
  mesh(g, new THREE.PlaneGeometry(ww, 0.34).rotateX(-Math.PI / 2).translate(wc.x, WIN.y0, RZ0 - 0.17), reveal, undefined, false, true);
  mesh(g, rbox(ww + 0.24, 0.07, 0.3, 0.02), wood, M4(wc.x, WIN.y0 - 0.02, RZ0 + 0.06));
  mesh(g, rbox(ww + 0.2, 0.09, 0.08, 0.02), wood, M4(wc.x, WIN.y1 + 0.04, RZ0 + 0.03));
  for (const x of [WIN.x0 - 0.05, WIN.x1 + 0.05]) mesh(g, rbox(0.09, wh + 0.1, 0.08, 0.02), wood, M4(x, wc.y, RZ0 + 0.03));
  const shutter = lam("pv_shutter", { map: rep(planksHD(), 0.35, 1.1), color: "#5f8f7a" });
  for (const [hx, s] of [[WIN.x0 - 0.06, -1], [WIN.x1 + 0.06, 1]] as [number, number][]) {
    const a = s * (Math.PI / 2 - 0.42);
    const m = new THREE.Matrix4().makeTranslation(hx, wc.y, RZ0 + 0.04).multiply(new THREE.Matrix4().makeRotationY(-a)).multiply(new THREE.Matrix4().makeTranslation(s * 0.175, 0, 0));
    mesh(g, rbox(0.34, wh, 0.035, 0.012), shutter, m);
  }
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.9), new THREE.MeshBasicMaterial({ map: PV.windowView(), color: new THREE.Color(1.15, 1.15, 1.12), fog: false }));
  view.position.set(wc.x, wc.y - 0.3, RZ0 - 1.4); view.layers.set(NOINK); g.add(view);
  mesh(g, lathe([[0, 0], [0.07, 0], [0.09, 0.05], [0.08, 0.12], [0.1, 0.14], [0, 0.14]]), lam("pv_pot", { color: "#c4623a" }), M4(wc.x - 0.12, WIN.y0 + 0.015, RZ0 + 0.08));
  mesh(g, blob(3, 1, 0.25), lam("pv_basil", { map: PV.leafTex("basil", ["#4f9a3c", "#5fae46", "#3f8834"], "#9ed36a") }), M4(wc.x - 0.12, WIN.y0 + 0.24, RZ0 + 0.08, 0, [0.13, 0.11, 0.12]));
  const dir = V(0.12, -0.75, 0.65).normalize(), tFloor = wc.y / -dir.y, patch = wc.clone().addScaledVector(dir, tFloor);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0), shaftMat([1.25, 0.95, 0.6], 0.32));
  shaft.applyMatrix4(new THREE.Matrix4().compose(patch, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().negate()), V(ww * 0.48, tFloor, wh * 0.36)));
  shaft.layers.set(NOINK); shaft.renderOrder = 6; shaft.frustumCulled = false; g.add(shaft);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), additive(PV.softDot(), [0.75, 0.55, 0.3]));
  pool.scale.set(ww * 1.3, 1, wh / Math.abs(dir.y) * 0.95); pool.position.set(patch.x, 0.004, patch.z + 0.1); pool.layers.set(NOINK); pool.renderOrder = 5; g.add(pool);
  const motes: THREE.Sprite[] = [], moteBase: THREE.Vector3[] = [];
  for (let i = 0; i < 36; i++) {
    const s = spriteAdd([1.4, 1.15, 0.8]); s.scale.setScalar(0.012 + 0.012 * hash(i, 3)); s.layers.set(NOINK); s.renderOrder = 7; g.add(s); motes.push(s);
    moteBase.push(wc.clone().addScaledVector(dir, tFloor * (0.15 + 0.8 * hash(i, 5))).add(V((hash(i, 7) - 0.5) * ww * 0.8, (hash(i, 9) - 0.5) * 0.4, (hash(i, 11) - 0.5) * 0.4)));
  }
  // ---- the desk (top at 0.76) ----
  const DZ = 0.03;
  mesh(g, rbox(1.5, 0.06, 0.82, 0.016), wood, M4(0, 0.73, DZ));
  mesh(g, rbox(1.36, 0.07, 0.03, 0.01), woodDk, M4(0, 0.665, DZ + 0.37));
  for (const sx of [-1, 1]) mesh(g, rbox(0.03, 0.07, 0.68, 0.01), woodDk, M4(sx * 0.66, 0.665, DZ));
  for (const [x, z] of [[-0.68, -0.34], [0.68, -0.34], [-0.68, 0.38], [0.68, 0.38]]) {
    mesh(g, lathe([[0.03, 0], [0.045, 0.02], [0.034, 0.06], [0.03, 0.3], [0.04, 0.36], [0.03, 0.42], [0.032, 0.66], [0.045, 0.7], [0, 0.7]], 12), woodDk, M4(x, 0, z + DZ));
  }
  for (const sx of [-1, 1]) mesh(g, rbox(0.03, 0.03, 0.7, 0.008), woodDk, M4(sx * 0.68, 0.14, DZ));
  // ---- the scroll: sheet, two rolls on rods with knobs, the ink drawing decal ----
  const SA = loc(SCROLL_AT, SCROLL_ROOM);
  const pap = lam("pv_papyrusM", { map: PV.papyrus(), color: "#cfc8bc" });
  mesh(g, new THREE.PlaneGeometry(0.9, 0.4).rotateX(-Math.PI / 2), pap, M4(SA[0], SA[1] - 0.0015, SA[2]), false);
  const rollSide = lam("pv_rollSide", { map: PV.papyrus("pv_papRoll", 512, 256, false), color: "#d9ccb4" });
  const rollEnd = lam("pv_rollEnd", { map: PV.scrollEnd(), color: "#d9ccb4" });
  for (const sx of [-1, 1]) {
    const x = SA[0] + sx * 0.478, y = SA[1] + 0.028;
    mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 28).rotateX(Math.PI / 2), [rollSide, rollEnd, rollEnd], M4(x, y, SA[2]));
    mesh(g, new THREE.CylinderGeometry(0.009, 0.009, 0.5, 10).rotateX(Math.PI / 2), woodDk, M4(x, y, SA[2]));
    for (const sz of [-1, 1]) mesh(g, new THREE.SphereGeometry(0.019, 14, 10), woodDk, M4(x, y, SA[2] + sz * 0.255));
  }
  const draw = new ScrollDrawing();
  const decalM = twoTone(new THREE.MeshLambertMaterial({ map: draw.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const decal = mesh(g, new THREE.PlaneGeometry(DRAW_W, DRAW_D).rotateX(-Math.PI / 2), decalM, M4(SA[0], SA[1] - 0.0008, SA[2]), false, true);
  decal.renderOrder = 3;
  // ---- inkpot, reed pens, two closed scrolls, a cup ----
  mesh(g, lathe([[0, 0], [0.036, 0], [0.042, 0.02], [0.04, 0.05], [0.024, 0.062], [0.021, 0.075], [0.026, 0.08], [0, 0.08]], 20), pho("pv_inkpot", { color: "#2f4766", specular: "#8aa0c0", shininess: 50 }), M4(0.55, 0.76, 0.2));
  mesh(g, new THREE.CircleGeometry(0.018, 16).rotateX(-Math.PI / 2), lam("pv_inkS", { color: "#120c0a" }), M4(0.55, 0.835, 0.2), false);
  const reed = lam("pv_reed", { color: "#c9a25e" });
  mesh(g, rod(V(0.6, 0.765, 0.32), V(0.36, 0.765, 0.36), 0.005, 6), reed);
  mesh(g, rod(V(0.63, 0.766, 0.3), V(0.42, 0.768, 0.25), 0.005, 6), reed);
  const closedM = lam("pv_closed", { map: PV.papyrus("pv_papRoll", 512, 256, false), color: "#e0cfa8" });
  for (const [y, z, c] of [[0.792, -0.24, 0], [0.792, -0.17, 1], [0.84, -0.205, 2]] as [number, number, number][]) {
    mesh(g, new THREE.CylinderGeometry(0.031, 0.031, 0.3, 20).rotateZ(Math.PI / 2), [closedM, rollEnd, rollEnd], M4(0.46, y, z, 0.08 * c));
    if (c === 2) mesh(g, new THREE.TorusGeometry(0.033, 0.006, 6, 20).rotateY(Math.PI / 2), lam("pv_tie", { color: "#a83a2c" }), M4(0.46, y, z));
  }
  mesh(g, lathe([[0, 0], [0.03, 0], [0.034, 0.01], [0.05, 0.06], [0.052, 0.064], [0, 0.064]], 20), lam("pv_cup", { color: "#b8582f" }), M4(0.66, 0.76, -0.12));
  // ---- the bronze oil lamp (spout toward +x) with the HDR flame + halo ----
  const LF = loc(LAMP_FLAME, SCROLL_ROOM);
  const bronze = pho("pv_bronze", { color: "#b5803c", specular: "#ffd79a", shininess: 40 });
  const lx = LF[0] - 0.085, lz = LF[2];
  mesh(g, lathe([[0, 0], [0.03, 0], [0.034, 0.008], [0.03, 0.016], [0, 0.016]], 18), bronze, M4(lx, 0.76, lz));
  mesh(g, new THREE.SphereGeometry(1, 22, 14), bronze, M4(lx, 0.81, lz, 0, [0.066, 0.034, 0.05]));
  mesh(g, new THREE.CylinderGeometry(0.014, 0.019, 0.075, 12).rotateZ(-Math.PI / 2 + 0.25), bronze, M4(lx + 0.06, 0.818, lz));
  mesh(g, new THREE.TorusGeometry(0.022, 0.006, 6, 16), bronze, M4(lx - 0.075, 0.83, lz, 0));
  mesh(g, new THREE.CircleGeometry(0.014, 14).rotateX(-Math.PI / 2), lam("pv_lampHole", { color: "#2a1a10" }), M4(lx, 0.845, lz), false);
  const flame = new THREE.Mesh(lathe([[0, 0], [0.011, 0.008], [0.012, 0.018], [0.007, 0.034], [0, 0.05]], 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.6, 0.8), fog: false }));
  flame.position.set(LF[0], LF[1] - 0.012, LF[2]); flame.layers.set(NOINK); g.add(flame);
  const core = new THREE.Mesh(lathe([[0, 0], [0.005, 0.006], [0.0055, 0.012], [0, 0.024]], 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7, 4), fog: false }));
  core.position.set(LF[0], LF[1] - 0.01, LF[2]); core.layers.set(NOINK); g.add(core);
  const halo = spriteAdd([0.9, 0.48, 0.16], 0.6); halo.scale.setScalar(0.5); halo.position.set(LF[0], LF[1] + 0.02, LF[2]); halo.layers.set(NOINK); halo.renderOrder = 8; g.add(halo);
  const halo2 = spriteAdd([2.2, 1.3, 0.5], 0.8); halo2.scale.setScalar(0.11); halo2.position.set(LF[0], LF[1] + 0.012, LF[2]); halo2.layers.set(NOINK); halo2.renderOrder = 8; g.add(halo2);
  // ---- the writer's stool (seat top 0.46) at WRITER_AT ----
  const WA = loc(WRITER_AT, SCROLL_ROOM);
  mesh(g, new THREE.CylinderGeometry(0.21, 0.2, 0.05, 24), wood, M4(WA[0], 0.435, WA[2]));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    mesh(g, rod(V(WA[0] + Math.cos(a) * 0.15, 0.42, WA[2] + Math.sin(a) * 0.15), V(WA[0] + Math.cos(a) * 0.21, 0, WA[2] + Math.sin(a) * 0.21), 0.022, 8), woodDk);
  }
  // ---- the scroll cubbies (back wall, behind the writer): 6 x 4 pigeonholes with rolled scrolls ----
  const SH = { x0: -1.25, x1: 1.05, y0: 0.32, y1: 2.32, d: 0.38, cols: 6, rows: 4 };
  const cw = (SH.x1 - SH.x0) / SH.cols, ch = (SH.y1 - SH.y0) / SH.rows, sz = RZ0 + SH.d / 2;
  const shelfM = lam("pv_shelf", { map: beamHD(), color: "#a8744a", emissive: "#ffffff", emissiveMap: beamHD(), emissiveIntensity: 0.12 });
  const bt = new Batch();
  bt.add(rbox(SH.x1 - SH.x0 + 0.08, 0.3, SH.d + 0.04, 0.02), shelfM, M4((SH.x0 + SH.x1) / 2, 0.15, sz));
  for (let i = 0; i <= SH.cols; i++) bt.add(rbox(0.045, SH.y1 - SH.y0 + 0.04, SH.d, 0.012), shelfM, M4(SH.x0 + i * cw, (SH.y0 + SH.y1) / 2, sz));
  for (let j = 0; j <= SH.rows; j++) bt.add(rbox(SH.x1 - SH.x0 + 0.06, 0.045, SH.d, 0.012), shelfM, M4((SH.x0 + SH.x1) / 2, SH.y0 + j * ch, sz));
  bt.add(rbox(SH.x1 - SH.x0 + 0.16, 0.08, SH.d + 0.08, 0.02), shelfM, M4((SH.x0 + SH.x1) / 2, SH.y1 + 0.06, sz + 0.02));
  bt.add(rbox(SH.x1 - SH.x0, SH.y1 - SH.y0, 0.02, 0.005), lam("pv_shelfBack", { color: "#5a3a24" }), M4((SH.x0 + SH.x1) / 2, (SH.y0 + SH.y1) / 2, RZ0 + 0.012));
  bt.build(g);
  const slots: THREE.Matrix4[] = [], scols: THREE.Color[] = [], tags: THREE.Matrix4[] = [], tcols: THREE.Color[] = [];
  const TAGC = ["#b8392c", "#2f6f9a", "#d1a23a", "#3f8a55"];
  for (let i = 0; i < SH.cols; i++) for (let j = 0; j < SH.rows; j++) {
    const n = 2 + Math.floor(hash(i * 7 + j, 1) * 5), cx = SH.x0 + (i + 0.5) * cw, by = SH.y0 + j * ch + 0.022;
    const lay: [number, number][] = [[-0.105, 0], [0, 0], [0.105, 0], [-0.052, 1], [0.052, 1], [0, 2]];
    for (let k = 0; k < n; k++) {
      const r = 0.045 + 0.008 * hash(i * 13 + j * 5 + k, 2), [ox, row] = lay[k];
      const x = cx + ox + (hash(k, i + j) - 0.5) * 0.01, y = by + r + row * 0.085, z = sz + 0.02 + (hash(k + 3, i * 3 + j) - 0.5) * 0.05;
      slots.push(new THREE.Matrix4().compose(V(x, y, z), Q(V(0, 0, 1), hash(k, 9) * TAU), V(r / 0.045, 1, r / 0.045)));
      scols.push(new THREE.Color(["#f2e2bc", "#e8d3a2", "#f6ebcd", "#dcc290"][Math.floor(hash(i + k, j + 4) * 4) % 4]));
      if (hash(i * 5 + k, j * 3 + 8) < 0.3) { tags.push(M4(x + 0.012, y - r - 0.02, z + 0.18, 0)); tcols.push(new THREE.Color(TAGC[Math.floor(hash(k, i * j + 2) * 4) % 4])); }
    }
  }
  const sGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.34, 18).rotateX(Math.PI / 2);
  const scE = lam("pv_shScrollEnd", { map: PV.scrollEnd(), emissive: "#ffffff", emissiveMap: PV.scrollEnd(), emissiveIntensity: 0.25 });
  const sMat = [lam("pv_shScrollSide", { map: PV.papyrus("pv_papRoll", 512, 256, false), emissive: "#ffffff", emissiveMap: PV.papyrus("pv_papRoll", 512, 256, false), emissiveIntensity: 0.25 }), scE, scE];
  const inst = new THREE.InstancedMesh(sGeo, sMat, slots.length);
  slots.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, scols[i]); });
  inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
  const tagI = new THREE.InstancedMesh(rbox(0.03, 0.05, 0.006, 0.002), lam("pv_tag", { color: "#ffffff" }), Math.max(1, tags.length));
  tags.forEach((m, i) => { tagI.setMatrixAt(i, m); tagI.setColorAt(i, tcols[i]); });
  tagI.count = tags.length; g.add(tagI);
  // ---- amphora in the corner, a basket of scrolls, a floor rug ----
  mesh(g, lathe([[0, 0.02], [0.05, 0.0], [0.09, 0.1], [0.2, 0.36], [0.22, 0.5], [0.17, 0.72], [0.07, 0.8], [0.06, 0.92], [0.085, 0.96], [0, 0.96]], 28), lam("pv_amph", { color: "#c4683c" }), M4(-2.6, 0, -2.15));
  for (const s of [-1, 1]) mesh(g, tube([V(-2.6 + s * 0.065, 0.9, -2.15), V(-2.6 + s * 0.16, 0.9, -2.15), V(-2.6 + s * 0.17, 0.76, -2.15)], 0.016, 10, 6), lam("pv_amph", { color: "#c4683c" }));
  mesh(g, new THREE.CylinderGeometry(0.24, 0.2, 0.36, 22, 1, true), lam("pv_basket", { map: PV.hayTex(), color: "#b08a50", side: THREE.DoubleSide }), M4(-1.75, 0.18, -1.85));
  mesh(g, new THREE.CircleGeometry(0.2, 18).rotateX(-Math.PI / 2), lam("pv_basketIn", { color: "#5a3a20" }), M4(-1.75, 0.03, -1.85));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 14), [rollSide, rollEnd, rollEnd], ME(-1.75 + Math.cos(a) * 0.09, 0.36, -1.85 + Math.sin(a) * 0.09, Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18));
  }
  mesh(g, rbox(2.4, 0.012, 1.7, 0.004), lam("pv_rug", { color: "#a63c2c" }), M4(0, 0.006, 0.4), false);
  mesh(g, rbox(2.1, 0.014, 1.4, 0.004), lam("pv_rugIn", { color: "#d8a64a" }), M4(0, 0.008, 0.4), false);
  mesh(g, rbox(1.8, 0.016, 1.1, 0.004), lam("pv_rugC", { color: "#2f6f7a" }), M4(0, 0.01, 0.4), false);
  return { draw, flame, core, halo, halo2, motes, moteBase };
};

// =====================================================================================================
// STABLE (local = STABLE)
// =====================================================================================================
/** sample of the camera path of a set (local xz) so scatter never lands next to a lens */
const camPts = (sid: number, o: V3): [number, number][] => {
  const s = SHOTS[sid - 1], out: [number, number][] = [];
  for (let f = s.a - 6; f <= s.b + 6; f += 3) { const c = camStatic(sid, f); out.push([c.pos[0] - o[0], c.pos[2] - o[2]]); }
  return out;
};
const nearAny = (pts: [number, number][], x: number, z: number, d: number) => pts.some(([a, b]) => Math.hypot(a - x, b - z) < d);
const oliveTree = (g: THREE.Group, x: number, z: number, s: number, seed: number) => {
  const bark = lam("pv_oliveBark", { color: "#7d6650" }), leaf = lam("pv_oliveLeaf", { map: PV.leafTex("olive", ["#7e9a5a", "#90ab68", "#6c8a4e", "#a3b97c"], "#c8d6a0") });
  mesh(g, tube([V(0, 0, 0), V(0.15, 0.6, 0.05), V(-0.1, 1.2, 0.1), V(0.05, 1.8, 0)].map((v) => v.multiplyScalar(s).add(V(x, 0, z))), 0.2 * s, 16, 8), bark);
  for (let k = 0; k < 5; k++) {
    const a = hash(seed, k) * TAU, d = k ? 0.9 * s : 0, y = (2.1 + 0.4 * hash(seed + 1, k)) * s;
    mesh(g, blob(seed + k, 1, 0.18), leaf, M4(x + Math.cos(a) * d, y, z + Math.sin(a) * d, a, [1.1 * s, 0.8 * s, 1.0 * s]));
  }
};
const palmTree = (g: THREE.Group, x: number, z: number, h: number, lean: number, seed: number) => {
  const bark = lam("pv_palmBarkM", { map: PV.palmBark() }), frondM = lam("pv_frond", { map: PV.palmFrond(), alphaTest: 0.5, side: THREE.DoubleSide });
  const top = V(x + Math.cos(lean) * h * 0.18, h, z + Math.sin(lean) * h * 0.18);
  const pts = [V(x, 0, z), V(x + (top.x - x) * 0.25, h * 0.35, z + (top.z - z) * 0.25), V(x + (top.x - x) * 0.65, h * 0.7, z + (top.z - z) * 0.65), top];
  const tg = tube(pts, 0.2, 20, 8);
  const tp = tg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), u = Math.max(0, Math.min(1, y / h)), k = 1 - 0.35 * u; const cx = x + (top.x - x) * u ** 1.4, cz = z + (top.z - z) * u ** 1.4; tp.setX(i, cx + (tp.getX(i) - cx) * k); tp.setZ(i, cz + (tp.getZ(i) - cz) * k); }
  mesh(g, uvFrom(tg, (p) => Math.atan2(p.x - x, p.z - z) / Math.PI, (p) => p.y / 2), bark);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + hash(seed, k) * 0.4, L = 2.6 + 0.6 * hash(seed + 2, k);
    const pg = new THREE.PlaneGeometry(0.85, L, 1, 10), pp = pg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const v = (pp.getY(i) + L / 2) / L; pp.setXYZ(i, pp.getX(i) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, v + 0.1))), 0.6 * L * Math.sin(v * 1.2) - L * 0.75 * v * v, v * L); }
    pg.computeVertexNormals();
    mesh(g, pg, frondM, new THREE.Matrix4().compose(top, Q(V(0, 1, 0), a), V(1, 1, 1)));
  }
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + seed; mesh(g, blob(seed + k, 1, 0.1), lam("pv_dates", { color: "#d07a2a" }), M4(top.x + Math.cos(a) * 0.25, top.y - 0.35, top.z + Math.sin(a) * 0.25, 0, [0.2, 0.28, 0.2])); }
};
const hayPile = (g: THREE.Group, x: number, z: number, sx: number, sy: number, sz: number, seed: number) => {
  const geo = new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), n = 1 + 0.1 * Math.sin(X * 7 + seed) * Math.sin(Z * 6 + Y * 5) + 0.06 * Math.sin(X * 19 + Z * 13 + seed); p.setXYZ(i, X * n, Y * n, Z * n); }
  geo.computeVertexNormals();
  const hay = lam("pv_hayM", { map: rep(PV.hayTex(), 2, 1), color: "#f0dca0" });
  mesh(g, geo, hay, M4(x, -0.05, z, seed, [sx, sy, sz]));
  const st = lam("pv_straw", { color: "#f2d070" });
  for (let k = 0; k < 26; k++) {
    const a = hash(seed, k) * TAU, u = 0.4 + 0.6 * hash(seed + 3, k), px = x + Math.cos(a) * sx * u, pz = z + Math.sin(a) * sz * u, py = sy * Math.sqrt(Math.max(0, 1 - u * u)) - 0.04;
    mesh(g, rbox(0.4, 0.012, 0.025, 0.004), st, ME(px, py, pz, (hash(k, seed) - 0.5) * 1.2, a, (hash(k + 5, seed) - 0.5) * 1.2), false, true);
  }
};
const buildStable = (g: THREE.Group) => {
  const cams = camPts(9, STABLE);
  // ground: the paddock's packed earth inside a wobbly edge, dry grass outside
  const edge: THREE.Vector2[] = [];
  for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU, w = 1 + 0.06 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 11); edge.push(new THREE.Vector2(Math.cos(a) * 18 * w, 2 + Math.sin(a) * 15 * w)); }
  const dirt = new THREE.Shape(edge);
  mesh(g, uvFrom(new THREE.ShapeGeometry(dirt, 4).rotateX(-Math.PI / 2), (p) => p.x / 4, (p) => -p.z / 4), lam("pv_dirt", { map: PV.dirtStraw() }), undefined, false);
  const outer = new THREE.Shape([new THREE.Vector2(-300, -300), new THREE.Vector2(300, -300), new THREE.Vector2(300, 300), new THREE.Vector2(-300, 300)]);
  outer.holes.push(new THREE.Path(edge.slice().reverse()));
  mesh(g, uvFrom(new THREE.ShapeGeometry(outer, 4).rotateX(-Math.PI / 2), (p) => p.x / 3, (p) => -p.z / 3), lam("pv_grassS", { map: grassHD(), color: "#e6dc92" }), undefined, false);
  // the fence: rough posts + two rails per span (gaps: SW corner gate for the trainers, the south middle gateway)
  const fw = lam("pv_fence", { map: beamHD(), color: "#c8a07a" });
  const fb = new Batch();
  const spans: [number, number, number, number][] = [[-9, -8, -9, 3.5], [3.6, 6, 9, 6], [9, 6, 9, -8]];
  let pk = 0;
  for (const [x0, z0, x1, z1] of spans) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.3)), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, end = i === 0 || i === n;
      const ph = end ? 1.75 : 1.35;
      fb.add(rbox(0.17, ph, 0.17, 0.04), fw, ME(x, ph / 2 - 0.05, z, (hash(pk, 1) - 0.5) * 0.08, hash(pk, 2) * 1.5, (hash(pk, 3) - 0.5) * 0.08)); pk++;
      if (i < n) for (const y of [0.55, 1.05]) {
        const xm = x + ((x1 - x0) / n) * 0.5, zm = z + ((z1 - z0) / n) * 0.5;
        fb.add(rbox(0.1, 0.12, L / n + 0.25, 0.03, 0), fw, ME(xm, y + (hash(pk, 4) - 0.5) * 0.06, zm, (hash(pk, 5) - 0.5) * 0.05, yaw, (hash(pk, 6) - 0.5) * 0.04)); pk++;
      }
    }
  }
  // the open gate leaf of the south gateway, swung out along the fence (x 2.6 -> 5.3, z 6.4)
  for (const y of [0.35, 0.8, 1.25]) fb.add(rbox(2.6, 0.1, 0.07, 0.02), fw, M4(4.95, y, 6.4));
  for (const x of [3.75, 4.95, 6.15]) fb.add(rbox(0.1, 1.15, 0.07, 0.02), fw, M4(x, 0.8, 6.4));
  fb.add(rbox(0.08, 0.08, 2.7, 0.02), fw, ME(4.95, 0.8, 6.4, 0, Math.PI / 2, 0.38));
  fb.build(g);
  // the barn: open front at z = -8, back wall at z = -12.5, thatch roof sloping to the back
  const bw = lam("pv_barnWall", { map: planksHD(), color: "#b98d62", emissive: "#ffffff", emissiveMap: planksHD(), emissiveIntensity: 0.16 }), post = lam("pv_barnPost", { map: beamHD(), color: "#9a6a44" });
  const bb = new Batch();
  for (const x of [-9, -4.5, 0, 4.5, 9]) { bb.add(rbox(0.3, 4.7, 0.3, 0.05), post, M4(x, 2.35, -8.2)); bb.add(rbox(0.28, 3.9, 0.28, 0.05), post, M4(x, 1.95, -12.4)); }
  bb.add(rbox(18.3, 0.28, 0.3, 0.05), post, M4(0, 4.62, -8.2));
  bb.add(rbox(18.3, 0.26, 0.28, 0.05), post, M4(0, 3.82, -12.4));
  for (const x of [-9, -4.5, 0, 4.5, 9]) bb.add(rbox(0.22, 0.22, 4.6, 0.04), post, ME(x, 4.3, -10.3, -0.176, 0, 0));
  bb.add(rbox(18, 3.9, 0.12, 0.02, 2), bw, M4(0, 1.95, -12.55));
  for (const s of [-1, 1]) bb.add(rbox(0.12, 3.6, 4.2, 0.02, 2), bw, M4(s * 9.05, 1.8, -10.4));
  bb.build(g);
  const roofM = lam("pv_thatchM", { map: PV.thatch() });
  mesh(g, rbox(19.4, 0.5, 6.0, 0.18, 2), roofM, ME(0, 4.62, -10.3, -0.176, 0, 0));
  const fringe: THREE.Matrix4[] = [];
  for (let x = -9.6; x <= 9.6; x += 0.13) { const sy = 0.7 + 0.6 * hash(x * 10, 4); fringe.push(ME(x + (hash(x * 10, 1) - 0.5) * 0.05, 4.95 - 0.3 * sy, -7.42, (hash(x * 10, 3) - 0.5) * 0.25, 0, 0, [1, sy, 1])); }
  const fr = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.3, 5).translate(0, -0.15, 0).rotateX(Math.PI), lam("pv_fringe", { color: "#c39444" }), fringe.length);
  fringe.forEach((m, i) => fr.setMatrixAt(i, m)); fr.castShadow = true; fr.receiveShadow = true; g.add(fr);
  // inside the barn: hay bales, a loose mound, a manger
  const bale = lam("pv_bale", { map: PV.hayTex(), color: "#f4e0a4" });
  for (const [x, y, z, r] of [[-7.6, 0.28, -11.7, 0.05], [-6.4, 0.28, -11.75, -0.04], [-5.2, 0.28, -11.7, 0.08], [-7.0, 0.84, -11.72, 0.02], [-5.8, 0.84, -11.7, -0.06], [-6.4, 1.4, -11.75, 0.03], [-7.6, 0.28, -10.9, 1.5]] as [number, number, number, number][])
    mesh(g, rbox(1.1, 0.55, 0.6, 0.08), bale, M4(x, y, z, r));
  hayPile(g, 6.4, -11.1, 1.9, 1.3, 1.2, 4);
  mesh(g, rbox(3.6, 0.6, 0.7, 0.05), post, M4(-1.0, 0.65, -12.0));
  // the big hay pile at the mother's trunk + small heaps
  const MO = loc(MOTHER, STABLE);
  hayPile(g, MO[0] - 1.9, MO[2] - 2.5, 1.35, 0.9, 1.15, 1);
  hayPile(g, MO[0] - 0.6, MO[2] - 3.0, 0.7, 0.45, 0.6, 2);
  hayPile(g, -6.6, -5.6, 0.9, 0.55, 0.8, 3);
  hayPile(g, 7.7, 2.8, 0.8, 0.5, 0.7, 5);
  // tether posts (rope loops) by the mother and on the east side
  for (const [x, z] of [[MO[0] + 2.2, MO[2] - 0.7], [7.6, 0.2]]) {
    mesh(g, rbox(0.24, 1.3, 0.24, 0.05), post, M4(x, 0.62, z, 0.4));
    mesh(g, new THREE.TorusGeometry(0.16, 0.035, 6, 16).rotateX(Math.PI / 2), lam("pv_ropeS", { color: "#d8b77a" }), M4(x, 0.95, z));
    mesh(g, tube([V(x + 0.12, 0.95, z), V(x + 0.5, 0.25, z + 0.35), V(x + 0.9, 0.03, z + 0.2), V(x + 1.3, 0.03, z + 0.6)], 0.03, 16, 5), lam("pv_ropeS", { color: "#d8b77a" }), undefined, false);
  }
  // troughs: wooden (by the barn, west) and stone (near baby 0)
  const waterM = lam("pv_waterS", { map: water(), color: "#bfe4ff" });
  const trough = (x: number, z: number, yaw: number, L: number, W: number, H: number, mat: THREE.Material) => {
    const m0 = M4(x, 0, z, yaw), part = (w: number, h: number, d: number, px: number, py: number, pz: number) => mesh(g, rbox(w, h, d, 0.03), mat, m0.clone().multiply(M4(px, py, pz)));
    part(L, 0.1, W, 0, 0.05, 0); part(L, H, 0.1, 0, H / 2, W / 2 - 0.05); part(L, H, 0.1, 0, H / 2, -W / 2 + 0.05);
    part(0.1, H, W, L / 2 - 0.05, H / 2, 0); part(0.1, H, W, -L / 2 + 0.05, H / 2, 0);
    mesh(g, new THREE.PlaneGeometry(L - 0.2, W - 0.2).rotateX(-Math.PI / 2), waterM, m0.clone().multiply(M4(0, H * 0.8, 0)), false);
  };
  trough(-5.4, -6.6, 0.05, 2.2, 0.6, 0.5, post);
  const B0 = loc(BABY[0], STABLE);
  trough(B0[0] - 1.0, B0[2] - 2.7, 0.3, 1.7, 0.7, 0.55, lam("pv_trStone", { map: PV.edWall(), color: "#d6d0c4" }));
  // straw scattered over the paddock
  const straws: THREE.Matrix4[] = [];
  for (let i = 0; i < 420; i++) { const x = (hash(i, 21) - 0.5) * 20, z = -8 + hash(i, 23) * 15; straws.push(ME(x, 0.008, z, 0, hash(i, 25) * TAU, 0, [0.6 + hash(i, 27), 1, 1])); }
  const sI = new THREE.InstancedMesh(rbox(0.28, 0.012, 0.022, 0.004), lam("pv_strawG", { color: "#f0cd68" }), straws.length);
  straws.forEach((m, i) => sI.setMatrixAt(i, m)); sI.receiveShadow = true; sI.layers.set(NOINK); g.add(sI);
  // trees outside the fence + bushes
  for (const [x, z, s, k] of [[-13, -3, 1.2, 1], [12.5, -1.5, 1.1, 2], [-12.5, 9.5, 1.0, 3], [14, 8.5, 1.25, 4], [-15, -11, 1.3, 5], [16, -12, 1.1, 6]]) if (!nearAny(cams, x, z, 4)) oliveTree(g, x, z, s, k);
  for (const [x, z, h, l, k] of [[-11, -15, 8.5, 0.6, 1], [10.5, -15.5, 9.5, 2.4, 2], [3, -15.5, 7.5, 1.5, 3], [-17, 3, 8, 3.6, 4], [18, -6, 9, 0.2, 5], [-6, -16.5, 10, 1.0, 6], [-21, -7, 9, 0.5, 7]]) if (!nearAny(cams, x, z, 4)) palmTree(g, x, z, h, l, k);
  const bush = lam("pv_bushS", { map: PV.leafTex("bush", ["#5d9a3e", "#6fae48", "#4c8834", "#86bf58"], "#b6e07a") });
  for (let i = 0; i < 24; i++) {
    const a = hash(i, 31) * TAU, d = 19 + hash(i, 33) * 14, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (nearAny(cams, x, z, 5)) continue;
    mesh(g, blob(i, 1, 0.2), bush, M4(x, 0.3, z, a, [1.0 + hash(i, 35), 0.8, 1.0 + hash(i, 37)]));
  }
  // distant hills (mostly north)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.42, d = 110 + 50 * hash(i, 41), x = Math.cos(a) * d, z = Math.sin(a) * d;
    mesh(g, new THREE.SphereGeometry(1, 32, 12, 0, TAU, 0, Math.PI / 2), lam("pv_hillS", { map: PV.hillTex("s", "#9cae5a", ["120,150,70", "200,190,110", "90,120,60"]) }), M4(x, -2, z, a, [55 + 25 * hash(i, 43), 16 + 10 * hash(i, 45), 30]), false);
  }
};

// =====================================================================================================
// EDESSA (local = EDESSA)
// =====================================================================================================
const BOX = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // uv in metres / 4 per face (world-aligned), so the course texture lines up across boxes
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, x / 4, z / 4); else if (ax > 0.5) uv.setXY(i, z / 4, y / 4); else uv.setXY(i, x / 4, y / 4);
  }
  return g;
};
type EdRig = { smoke: { s: THREE.Sprite; base: THREE.Vector3; k: number }[]; banners: THREE.Object3D[] };
const buildEdessa = (g: THREE.Group): EdRig => {
  const cams = camPts(10, EDESSA);
  const stone = lam("pv_edStone", { map: PV.edWall() });
  const stoneDk = lam("pv_edStoneDk", { map: PV.edWall(), color: "#c4a888" });
  const H = ED_WALL_H, TH = ED_TOWER_H;
  // ground
  mesh(g, uvFrom(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2).translate(0, 0, 150), (p) => p.x / 8, (p) => -p.z / 8), lam("pv_dust", { map: PV.dustGround() }), undefined, false);
  // the wall (x -70..70, outer face z = 0), plinth, string course, parapet + merlons, inner walk parapet, returns north
  const wb = new Batch();
  wb.add(BOX(-70, 0, -5, 70, H, 0), stone);
  wb.add(BOX(-70.4, 0, -5, 70.4, 1.1, 0.4), stoneDk);
  wb.add(BOX(-70, H - 0.45, -0.2, 70, H - 0.2, 0.22), stoneDk);
  wb.add(BOX(-70, H, -0.6, 70, H + 0.9, 0), stone);
  wb.add(BOX(-70, H, -5, 70, H + 0.6, -4.6), stone);
  const towerXs = [-56, -28, 28, 56];
  const inTower = (x: number) => Math.abs(x) < 4.4 || towerXs.some((t) => Math.abs(x - t) < 3.9);
  for (let x = -69.5; x <= 69.5; x += 1.8) if (!inTower(x)) wb.add(BOX(x - 0.5, H + 0.9, -0.6, x + 0.5, H + 1.9, 0), stone);
  for (const s of [-1, 1]) {
    wb.add(BOX(s > 0 ? 70 : -75, 0, -180, s > 0 ? 75 : -70, H, 0), stone);
    for (let z = -2; z > -180; z -= 1.8) wb.add(BOX(s > 0 ? 74.4 : -75, H, z - 0.5, s > 0 ? 75 : -74.4, H + 1.0, z + 0.5), stone);
    wb.add(BOX(s > 0 ? 69 : -77, 0, -7, s > 0 ? 77 : -69, H + 4, 1), stone);   // corner towers
    for (const [a, b] of [[-7, -5.5], [-0.5, 1]]) wb.add(BOX(s > 0 ? 69 : -77, H + 4, a, s > 0 ? 77 : -69, H + 5, b), stone);
  }
  // side towers (7 x 7, 16 m)
  for (const tx of towerXs) {
    wb.add(BOX(tx - 3.5, 0, -6, tx + 3.5, 16, 1.5), stone);
    wb.add(BOX(tx - 3.7, H - 0.45, -6, tx + 3.7, H - 0.2, 1.72), stoneDk);
    wb.add(BOX(tx - 3.5, 16, 1.0, tx + 3.5, 16.8, 1.5), stone);
    for (let x = tx - 3.0; x <= tx + 3.01; x += 1.5) wb.add(BOX(x - 0.45, 16.8, 1.0, x + 0.45, 17.7, 1.5), stone);
    for (const s of [-1, 1]) for (let z = -5.5; z <= 0.6; z += 1.5) wb.add(BOX(tx + s * 3.5 - 0.25, 16, z - 0.45, tx + s * 3.5 + 0.25, 17.6, z + 0.45), stone);
  }
  // the main tower (x -4..4, z -6..2, platform at 18)
  wb.add(BOX(-4, 0, -6, 4, TH, 2), stone);
  wb.add(BOX(-4.4, 0, -6, 4.4, 1.1, 2.4), stoneDk);
  wb.add(BOX(-4.22, H - 0.45, -6, 4.22, H - 0.2, 2.22), stoneDk);
  wb.add(BOX(-4.25, TH - 0.35, -6.25, 4.25, TH, 2.25), stoneDk);
  wb.add(BOX(-4, TH, 1.5, 4, TH + 1.0, 2), stone);               // front parapet (top 19.0): the beam rests on it
  wb.add(BOX(-4, TH, -6, 4, TH + 1.0, -5.5), stone);
  wb.add(BOX(-4, TH, -5.5, -3.5, TH + 1.0, 1.5), stone);
  wb.add(BOX(3.5, TH, -5.5, 4, TH + 1.0, 1.5), stone);
  for (const [a, b] of [[-4, -2.8], [2.8, 4]]) wb.add(BOX(a, TH + 1.0, 1.5, b, TH + 2.0, 2), stone);   // front merlons only at the corners
  for (let x = -3.2; x <= 3.21; x += 1.6) wb.add(BOX(x - 0.5, TH + 1.0, -6, x + 0.5, TH + 2.0, -5.5), stone);
  for (const s of [-1, 1]) for (let z = -4.4; z <= 0.4; z += 1.6) wb.add(BOX(s * 3.75 - 0.25, TH + 1.0, z - 0.5, s * 3.75 + 0.25, TH + 2.0, z + 0.5), stone);
  wb.build(g);
  // arrow slits (dark recesses) on the tower's front + east/west faces and the side towers
  const slitM = lam("pv_slit", { color: "#2a1c22" });
  const sb = new Batch();
  for (const x of [-2, 2]) for (const y of [7.5, 14.2]) sb.add(rbox(0.28, 1.3, 0.06, 0.02), slitM, M4(x, y, 2.01));
  for (const s of [-1, 1]) for (const z of [-3.5, -0.5]) for (const y of [7.5, 14.2]) sb.add(rbox(0.06, 1.3, 0.28, 0.02), slitM, M4(s * 4.01, y, z));
  for (const tx of towerXs) for (const y of [8, 13.5]) sb.add(rbox(0.26, 1.2, 0.06, 0.02), slitM, M4(tx, y, 1.51));
  sb.build(g, false);
  // the beam (crane arm) on the front parapet, its brace + chock post + tie-down ropes, the pulley at BEAM_TIP
  const BT = loc(BEAM_TIP, EDESSA);
  const beamW = lam("pv_beamW", { map: beamHD(), color: "#9a6640" }), iron = lam("pv_iron", { color: "#4a4a52" }), rope = lam("pv_rope", { color: "#c9a66b" });
  const bz0 = 0.7, bz1 = BT[2] + 0.28;
  mesh(g, rbox(0.32, 0.32, bz1 - bz0, 0.04), beamW, M4(BT[0], TH + 1.16, (bz0 + bz1) / 2));
  mesh(g, rbox(0.26, 1.0, 0.26, 0.04), beamW, M4(BT[0], TH + 0.5, bz0 + 0.18));
  mesh(g, rod(V(BT[0], 15.9, 2.0), V(BT[0], TH + 1.0, BT[2] - 1.15), 0.12, 8), beamW);
  mesh(g, rbox(0.4, 0.5, 0.12, 0.03), iron, M4(BT[0], 15.9, 2.06));
  for (const z of [BT[2] - 0.12, 2.6, 1.75]) mesh(g, rbox(0.36, 0.36, 0.06, 0.02), iron, M4(BT[0], TH + 1.16, z));
  for (const s of [-1, 1]) mesh(g, tube([V(BT[0] + s * 0.16, TH + 1.2, bz0 + 0.05), V(BT[0] + s * 0.4, TH + 0.5, bz0 - 0.2), V(BT[0] + s * 0.55, TH + 0.03, bz0 - 0.45)], 0.025, 10, 5), rope);
  for (const s of [-1, 1]) mesh(g, new THREE.TorusGeometry(0.07, 0.018, 6, 14).rotateX(Math.PI / 2), iron, M4(BT[0] + s * 0.55, TH + 0.02, bz0 - 0.45));
  for (const s of [-1, 1]) mesh(g, rbox(0.03, 0.42, 0.24, 0.008), iron, M4(BT[0] + s * 0.075, BT[1] + 0.12, BT[2]));
  mesh(g, new THREE.CylinderGeometry(0.17, 0.17, 0.09, 24).rotateZ(Math.PI / 2), lam("pv_pulley", { color: "#7a5030" }), M4(BT[0], BT[1], BT[2]));
  mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10).rotateZ(Math.PI / 2), iron, M4(BT[0], BT[1], BT[2]));
  // the bucket of water near the Roman (he dunks his torch in it)
  const RA = loc(ROMAN_AT, EDESSA), BK = V(RA[0] + 1.2, TH, RA[2] - 0.85);
  const staves = lam("pv_staves", { map: beamHD(), color: "#a8784a", side: THREE.DoubleSide });
  mesh(g, new THREE.CylinderGeometry(0.21, 0.17, 0.36, 18, 1, true), staves, M4(BK.x, BK.y + 0.18, BK.z));
  mesh(g, new THREE.CircleGeometry(0.17, 18).rotateX(-Math.PI / 2), staves, M4(BK.x, BK.y + 0.01, BK.z));
  mesh(g, new THREE.CircleGeometry(0.195, 18).rotateX(-Math.PI / 2), pho("pv_bucketW", { color: "#4d8cc0", specular: "#ffffff", shininess: 60 }), M4(BK.x, BK.y + 0.3, BK.z), false);
  for (const y of [0.08, 0.28]) mesh(g, new THREE.TorusGeometry(0.19 + y * 0.11, 0.012, 6, 24).rotateX(Math.PI / 2), iron, M4(BK.x, BK.y + y, BK.z));
  mesh(g, tube([V(BK.x - 0.2, BK.y + 0.34, BK.z), V(BK.x, BK.y + 0.58, BK.z), V(BK.x + 0.2, BK.y + 0.34, BK.z)], 0.01, 12, 5), rope);
  // platform props outside the Roman's clear area: a heap of throwing stones, an amphora, a coil of rope
  const rockM = lam("pv_rock", { color: "#d2b48a" });
  for (let k = 0; k < 9; k++) mesh(g, blob(k, 1, 0.2), rockM, M4(-2.6 + (hash(k, 1) - 0.5) * 1.0, TH + 0.16 + (k > 5 ? 0.22 : 0), -4.4 + (hash(k, 2) - 0.5) * 0.9, k, [0.2, 0.17, 0.2]));
  mesh(g, lathe([[0, 0.02], [0.05, 0], [0.09, 0.1], [0.2, 0.36], [0.22, 0.5], [0.17, 0.72], [0.07, 0.8], [0.06, 0.92], [0.085, 0.96], [0, 0.96]], 22), lam("pv_amphE", { color: "#c06a3e" }), M4(2.7, TH, -4.7));
  mesh(g, new THREE.TorusGeometry(0.28, 0.07, 8, 24).rotateX(Math.PI / 2), rope, M4(-2.7, TH + 0.07, -1.6));
  // banners: two vexilla on the tower's back corners, cloth hangings on the wall face; shields along the parapet
  const banners: THREE.Object3D[] = [];
  const banM = lam("pv_banner", { map: PV.romanBanner(), side: THREE.DoubleSide });
  const cloth = (w: number, h: number, seg = 8) => { const pg = new THREE.PlaneGeometry(w, h, seg, 4), pp = pg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pp.count; i++) pp.setZ(i, 0.06 * w * Math.sin((pp.getX(i) / w) * TAU * 1.0) * (0.5 - pp.getY(i) / h)); pg.computeVertexNormals(); return pg; };
  for (const s of [-1, 1]) {
    const px = s * 3.75, pz = -5.75;
    mesh(g, rod(V(px, TH + 1.0, pz), V(px, TH + 6.4, pz), 0.06, 8), beamW);
    mesh(g, rod(V(px - 0.8, TH + 6.0, pz), V(px + 0.8, TH + 6.0, pz), 0.035, 6), beamW);
    mesh(g, new THREE.SphereGeometry(0.12, 12, 8), pho("pv_gold", { color: "#e2b04a", specular: "#fff0b0", shininess: 50 }), M4(px, TH + 6.5, pz));
    const b = mesh(g, cloth(1.5, 2.2), banM, M4(px, TH + 4.85, pz + 0.05), true);
    banners.push(b);
  }
  for (const x of [-42, -14, 14, 42]) mesh(g, cloth(2.2, 5.0, 10), banM, M4(x, H - 3.1, 0.12), true);
  const shieldM = lam("pv_shieldM", { map: PV.shieldFace() });
  const sh: THREE.Matrix4[] = [];
  for (let x = -66; x <= 66; x += 3.4) { if (Math.abs(x) < 6.5 || towerXs.some((t) => Math.abs(x - t) < 4.6)) continue; sh.push(ME(x, H + 0.35, 0.08, 0.08, 0, 0, [0.5, 0.75, 0.07])); }
  const shG = new THREE.SphereGeometry(1, 20, 12);
  uvFrom(shG, (p) => p.x * 0.5 + 0.5, (p) => p.y * 0.5 + 0.5);
  const shI = new THREE.InstancedMesh(shG, shieldM, sh.length);
  sh.forEach((m, i) => shI.setMatrixAt(i, m)); shI.castShadow = true; shI.receiveShadow = true; g.add(shI);
  // the city behind the wall: flat-roofed houses, a few domes, a basilica, the citadel hill
  const houses: THREE.Matrix4[] = [], hcol: THREE.Color[] = [], roofs: THREE.Matrix4[] = [];
  const HC = ["#e8d6b4", "#dcc196", "#efe3c8", "#d2ab7c", "#e4c79a", "#f2e8d4"];
  for (let i = 0; i < 360; i++) {
    const x = (hash(i, 51) - 0.5) * 290, z = -9 - hash(i, 53) * 220;
    if (Math.abs(x) > 140 || (Math.abs(x) > 66 && z > -14)) continue;
    const w = 5 + hash(i, 55) * 6, d = 5 + hash(i, 57) * 6, h = Math.min(4.5 + hash(i, 59) * 4 + (-z / 220) * 4, z > -20 ? 9 : 14), yaw = (hash(i, 61) - 0.5) * 0.3;
    houses.push(M4(x, h / 2, z, yaw, [w, h, d])); hcol.push(new THREE.Color(HC[Math.floor(hash(i, 63) * HC.length)]));
    roofs.push(M4(x, h + 0.15, z, yaw, [w + 0.3, 0.3, d + 0.3]));
  }
  const hI = new THREE.InstancedMesh(rbox(1, 1, 1, 0.03), lam("pv_house", { color: "#ffffff" }), houses.length);
  houses.forEach((m, i) => { hI.setMatrixAt(i, m); hI.setColorAt(i, hcol[i]); }); hI.castShadow = true; hI.receiveShadow = true; g.add(hI);
  const rI = new THREE.InstancedMesh(rbox(1, 1, 1, 0.03), lam("pv_houseRoof", { color: "#b7956e" }), roofs.length);
  roofs.forEach((m, i) => rI.setMatrixAt(i, m)); rI.castShadow = true; rI.receiveShadow = true; g.add(rI);
  const domeM = lam("pv_dome", { color: "#d9c6a2" }), drumM = lam("pv_drum", { color: "#e6d2ae" });
  for (const [x, z, r] of [[-24, -40, 6], [30, -70, 8], [-60, -110, 7], [8, -130, 10], [70, -150, 6]]) {
    mesh(g, new THREE.CylinderGeometry(r, r, r * 1.2, 24), drumM, M4(x, r * 0.6 + 6, z));
    mesh(g, new THREE.SphereGeometry(r, 24, 12, 0, TAU, 0, Math.PI / 2), domeM, M4(x, r * 1.2 + 6, z));
    mesh(g, BOX(x - r * 1.3, 0, z - r * 1.3, x + r * 1.3, 6.2, z + r * 1.3), stone);
  }
  mesh(g, BOX(-52, 0, -66, -22, 13, -52), drumM);
  mesh(g, new THREE.CylinderGeometry(8.6, 8.6, 30.6, 3, 1).rotateZ(Math.PI / 2).scale(1, 0.55, 1), lam("pv_tile", { color: "#b5533a" }), M4(-37, 15.2, -59));
  mesh(g, new THREE.SphereGeometry(1, 32, 14, 0, TAU, 0, Math.PI / 2), lam("pv_citHill", { map: PV.hillTex("c", "#b89a68", ["160,130,90", "210,180,130", "130,110,80"]) }), M4(40, -4, -300, 0, [110, 48, 70]), false);
  mesh(g, BOX(20, 40, -312, 64, 52, -290), stone);
  for (const x of [20, 64]) mesh(g, BOX(x - 4, 40, -316, x + 4, 58, -286), stone);
  // the plain: rocks + dry shrubs (never in the elephant's lane or next to a lens)
  const rocks: THREE.Matrix4[] = [], shrubs: THREE.Matrix4[] = [];
  for (let i = 0; i < 260; i++) {
    const x = (hash(i, 71) - 0.5) * 260, z = 3 + hash(i, 73) * 150;
    if ((Math.abs(x) < 16 && z < 110) || nearAny(cams, x, z, 9)) continue;
    if (z > 90 && hash(i, 95) < 0.6) continue;
    if (hash(i, 75) < 0.35) rocks.push(ME(x, 0.05, z, hash(i, 77), hash(i, 79) * TAU, 0, [0.25 + hash(i, 81) * 0.45, 0.18 + hash(i, 83) * 0.25, 0.25 + hash(i, 85) * 0.4]));
    else shrubs.push(M4(x, 0.25, z, hash(i, 87) * TAU, [0.6 + hash(i, 89) * 0.7, 0.45 + hash(i, 91) * 0.3, 0.6 + hash(i, 93) * 0.6]));
  }
  for (let i = 0; i < 70; i++) {   // rubble along the wall foot (outside the tower's lane)
    const x = (hash(i, 141) < 0.5 ? -1 : 1) * (10 + 58 * hash(i, 143)), z = 0.5 + 2.4 * hash(i, 145) ** 2;
    if (towerXs.some((t) => Math.abs(x - t) < 4.2)) continue;
    rocks.push(ME(x, 0.05, z, hash(i, 147), hash(i, 149) * TAU, 0, [0.2 + hash(i, 151) * 0.35, 0.15 + hash(i, 153) * 0.2, 0.2 + hash(i, 155) * 0.3]));
  }
  const rkI = new THREE.InstancedMesh(blob(4, 1, 0.22), rockM, rocks.length);
  rocks.forEach((m, i) => rkI.setMatrixAt(i, m)); rkI.castShadow = true; rkI.receiveShadow = true; g.add(rkI);
  const shI2 = new THREE.InstancedMesh(blob(7, 1, 0.28), lam("pv_dryShrub", { map: PV.leafTex("dry", ["#8f8a4a", "#a39a55", "#7a7640", "#b8a868"], "#d8c88a") }), shrubs.length);
  shrubs.forEach((m, i) => shI2.setMatrixAt(i, m)); shI2.castShadow = true; shI2.receiveShadow = true; g.add(shI2);
  // a few olive trees on the plain, away from the action
  for (const [x, z, s, k] of [[-34, 22, 1.3, 11], [-48, 40, 1.1, 12], [38, 30, 1.2, 13], [55, 52, 1.4, 14], [-26, 70, 1.0, 15], [30, 88, 1.2, 16]]) if (!nearAny(cams, x, z, 8)) oliveTree(g, x, z, s, k);
  // the Persian camp ~150-300 m south: tents, pennants, three siege towers, smoke
  const tents: THREE.Matrix4[] = [], walls: THREE.Matrix4[] = [], tc: THREE.Color[] = [];
  const TC = ["#f4ead6", "#e9d8b8", "#c94a36", "#7a4a8a", "#f0e2c0", "#3f6f9a"];
  for (let i = 0; i < 130; i++) {
    const x = (hash(i, 101) - 0.5) * 440, z = 150 + hash(i, 103) * 160, r = 2.4 + hash(i, 105) * 1.8, hc = 2.2 + hash(i, 107) * 1.6, yaw = hash(i, 109) * TAU;
    walls.push(M4(x, 0.75, z, yaw, [r, 1.5, r])); tents.push(M4(x, 1.5 + hc / 2, z, yaw, [r * 1.08, hc, r * 1.08])); tc.push(new THREE.Color(TC[Math.floor(hash(i, 111) * TC.length)]));
  }
  const tentM = lam("pv_tentM", { map: PV.tentCloth() });
  const tI = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 14), tentM, tents.length);
  const wI = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), tentM, walls.length);
  tents.forEach((m, i) => { tI.setMatrixAt(i, m); tI.setColorAt(i, tc[i]); wI.setMatrixAt(i, walls[i]); wI.setColorAt(i, tc[i]); });
  for (const o of [tI, wI]) { o.castShadow = true; o.receiveShadow = true; g.add(o); }
  const penM = lam("pv_pen", { map: PV.persPennant(), side: THREE.DoubleSide });
  for (let i = 0; i < 18; i++) {
    const x = (hash(i, 121) - 0.5) * 380, z = 140 + hash(i, 123) * 150;
    mesh(g, rod(V(x, 0, z), V(x, 9, z), 0.08, 6), beamW);
    mesh(g, cloth(3.2, 1.4, 6).translate(1.6, 0, 0), penM, M4(x, 8.1, z, hash(i, 125) * 0.6 - 0.3 + Math.PI / 2));
  }
  const planks = lam("pv_siege", { map: rep(planksHD(), 1, 1), color: "#b07e50" });
  for (const [x, z, yaw] of [[-58, 150, 0.1], [44, 168, -0.15], [104, 206, 0.2]]) {
    const m0 = M4(x, 0, z, yaw);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) => mesh(g, geo, mat, m0.clone().multiply(m));
    const tw = new THREE.CylinderGeometry(2.6 / Math.SQRT2, 4.0 / Math.SQRT2, 14, 4, 1).rotateY(Math.PI / 4);
    add(tw, planks, M4(0, 7.6, 0));
    add(rbox(4.2, 0.4, 4.2, 0.06), beamW, M4(0, 14.8, 0));
    for (const s of [-1, 1]) for (const s2 of [-1, 1]) add(rbox(0.3, 1.4, 0.3, 0.04), beamW, M4(s * 1.9, 15.6, s2 * 1.9));
    for (const s of [-1, 1]) for (const s2 of [-1, 1]) add(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 14).rotateZ(Math.PI / 2), beamW, M4(s * 2.1, 0.75, s2 * 1.4));
    add(rbox(2.2, 2.4, 0.15, 0.03), lam("pv_hide", { color: "#8a5a3a" }), M4(0, 11.5, -1.9));
  }
  const smoke: EdRig["smoke"] = [];
  const smM = (k: number) => new THREE.SpriteMaterial({ map: PV.smokeTex(), color: new THREE.Color(0.95, 0.82, 0.86), transparent: true, opacity: 0.55 - k * 0.04, depthWrite: false, fog: true });
  for (const [x, z] of [[-90, 190], [10, 230], [130, 260], [-30, 280]]) for (let k = 0; k < 9; k++) {
    const s = new THREE.Sprite(smM(k)); s.layers.set(NOINK); s.renderOrder = 4; g.add(s);
    smoke.push({ s, base: V(x, 3, z), k });
  }
  // hills to the south (behind the camp: the ending looks this way), east and west
  const hillM = lam("pv_hillE", { map: PV.hillTex("e", "#c99a64", ["170,120,80", "220,175,120", "150,110,90"]) });
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 + (i - 5.5) * 0.3, d = 430 + 160 * hash(i, 131), x = Math.cos(a) * d, z = Math.sin(a) * d;
    mesh(g, new THREE.SphereGeometry(1, 32, 12, 0, TAU, 0, Math.PI / 2), hillM, M4(x, -4, z, a, [120 + 80 * hash(i, 133), 26 + 26 * hash(i, 135), 60]), false);
  }
  for (const s of [-1, 1]) mesh(g, new THREE.SphereGeometry(1, 32, 12, 0, TAU, 0, Math.PI / 2), hillM, M4(s * 330, -4, -40, 0.3 * s, [90, 40, 180]), false);
  return { smoke, banners };
};

// =====================================================================================================
export class VenueRig {
  group = new THREE.Group();
  /** the oil lamp's warm glow (world pos, linear colour x intensity, e-fold radius m): world.ts may feed it to
   *  shade.ts GLOW while the scroll set renders (currently GLOW comes from the city rig only) */
  glow = { pos: new THREE.Vector3(...LAMP_FLAME), col: new THREE.Vector3(), r: 1.5 };
  private sets: Record<string, THREE.Group> = { scroll: new THREE.Group(), stable: new THREE.Group(), edessa: new THREE.Group() };
  private room: RoomRig;
  private ed: EdRig;
  constructor(root: THREE.Group) {
    root.add(this.group);
    for (const g of Object.values(this.sets)) this.group.add(g);
    this.sets.scroll.position.set(...SCROLL_ROOM);
    this.sets.stable.position.set(...STABLE);
    this.sets.edessa.position.set(...EDESSA);
    this.room = buildRoom(this.sets.scroll);
    buildStable(this.sets.stable);
    this.ed = buildEdessa(this.sets.edessa);
  }
  update(sid: number, f: number, _cam: THREE.PerspectiveCamera) {
    const set = SHOTS[sid - 1].set;
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === set;
    const st = storyF(sid, f);
    this.glow.col.set(0, 0, 0);
    if (set === "scroll") {
      const R = this.room;
      R.draw.set(drawK(st));
      const fl = 1 + 0.08 * Math.sin(f * 0.9) + 0.05 * Math.sin(f * 2.3 + 1.3) + 0.03 * Math.sin(f * 5.1);
      R.flame.scale.set(1 / Math.sqrt(fl), fl, 1 / Math.sqrt(fl)); R.core.scale.set(1, fl, 1);
      R.flame.rotation.z = 0.06 * Math.sin(f * 0.7); R.core.rotation.z = R.flame.rotation.z;
      (R.halo.material as THREE.SpriteMaterial).opacity = 0.55 + 0.08 * (fl - 1) * 6;
      R.halo2.scale.setScalar(0.11 * fl);
      R.motes.forEach((m, i) => {
        const b = R.moteBase[i], t = f * 0.012 + hash(i, 13) * TAU;
        m.position.set(b.x + 0.05 * Math.sin(t + i), b.y + 0.04 * Math.sin(t * 0.7 + i * 2) + ((f * 0.0006 + hash(i, 15)) % 1) * 0.12, b.z + 0.05 * Math.cos(t * 0.8 + i));
      });
      this.glow.col.set(1.0, 0.55, 0.22).multiplyScalar(0.9 * fl);
    } else if (set === "edessa") {
      for (const { s, base, k } of this.ed.smoke) {
        const u = ((st * 0.004 + k / 9) % 1);
        s.position.set(base.x + 6 * u + 1.5 * Math.sin(k + st * 0.01), base.y + u * 46, base.z - 2 * u);
        s.scale.setScalar(5 + u * 16);
        (s.material as THREE.SpriteMaterial).opacity = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.1));
      }
      this.ed.banners.forEach((b, i) => { b.rotation.y = 0.12 * Math.sin(st * 0.05 + i * 1.7); });
    }
  }
}
