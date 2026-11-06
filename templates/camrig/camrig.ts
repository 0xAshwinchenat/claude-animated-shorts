// Continuous camera rig: ONE flowing path per place, the camera never parks.
//
// Why: the old key blend (`run()` + smootherstep `glide`) eased every move to zero speed at its key, so the camera braked,
// sat in a creep-push and started again on every move ("ours stopped between every move"). The reference camera never
// parks: velocities blend from one framing into the next (v_in = v_out at every key), one framing change every ~1.7 s,
// hard cuts 0-1 per short, place changes are portals (fly through an opening) or 7-frame dissolves.
//
// How:
//  - Every key is a framing the camera PASSES THROUGH at frame f (not the start of a glide).
//  - Path: centripetal Catmull-Rom (Barry-Goldman) through the keys in one 8-D space [pos, look, zoom, roll]. Centripetal
//    knots never loop, cusp or overshoot into walls between keys, and the curve is C1 (direction continuous).
//  - Timing: frame -> curve parameter through a monotone cubic (Fritsch-Butland PCHIP). The data is strictly increasing,
//    so the slope is > 0 everywhere: the speed never drops to zero and is continuous through every key.
//  - Holds are two keys a beat apart (`hold`): the camera keeps drifting/pushing through them and blends into the next
//    move with the same velocity. Make holds drift sideways a little (`drift`), not only push: that is what "never stops"
//    looks like.
//  - Tracking a moving subject: `track` adds an offset (evaluated at the current frame) to pos and look of that key.
//  - `join: "cut" | "dissolve"` starts a new path at that key (a new place). Everything else flows.
//  - Pitch is limited to +-80 deg so lookAt never spins round the vertical (the "chimney spin").
//
// Usage (story.ts):
//   import { flow, hold, drift, Cam, FlowKey } from "./camrig";
//   const BRIDGE = flow([
//     ...hold(283, 320, { pos: [1.1, 7.45, 20], look: [0, 7.3, 26.6], fov: 40 }, { push: 0.0025, side: 0.25 }),
//     { f: 352, at: { pos: [0.5, 6.36, 16], look: [0, 6.3, 20.4], fov: 36 }, track: column },
//     ...
//   ]);
//   export const camAt = (id: number, f: number) => BRIDGE(f);
// Then run the gates: `node scripts/cam_qa.mjs src/videos/<name>/story.ts` (13 gates, numbers vs the reference).

export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type Frame = { pos: V3; look: V3; fov?: number; roll?: number };
export type FlowKey = {
  /** frame the camera passes through this framing */
  f: number;
  /** the framing (static; use `track` for moving subjects) */
  at: Frame;
  /** offset added to pos and look at the current frame (subject motion), e.g. f => [0, 0, front(f) - front(KEY_F)] */
  track?: (f: number) => V3;
  /** how this key is reached: "flow" (default) continues the path; "cut" / "dissolve" start a new path here */
  join?: "flow" | "cut" | "dissolve";
};

const DIM = 8;
type X = number[]; // [px, py, pz, lx, ly, lz, zoom, roll]
const toRad = Math.PI / 180;
const zoomOf = (fov: number) => Math.log(Math.tan((fov * toRad) / 2));
const fovOf = (z: number) => (2 * Math.atan(Math.exp(z))) / toRad;
const vec = (fr: Frame, off?: V3): X => [
  fr.pos[0] + (off?.[0] ?? 0), fr.pos[1] + (off?.[1] ?? 0), fr.pos[2] + (off?.[2] ?? 0),
  fr.look[0] + (off?.[0] ?? 0), fr.look[1] + (off?.[1] ?? 0), fr.look[2] + (off?.[2] ?? 0),
  zoomOf(fr.fov ?? 40), fr.roll ?? 0,
];
/** distance used for the knot spacing: metres of camera + half the metres of look point + zoom/roll scaled to metres */
const W = [1, 1, 1, 0.5, 0.5, 0.5, 8, 8];
const dist = (a: X, b: X) => { let s = 0; for (let i = 0; i < DIM; i++) s += (W[i] * (a[i] - b[i])) ** 2; return Math.sqrt(s); };
const lerp = (a: X, b: X, ta: number, tb: number, t: number): X => {
  const d = tb - ta || 1e-9, u = (t - ta) / d;
  return a.map((v, i) => v + (b[i] - v) * u);
};

/** Barry-Goldman evaluation of the centripetal Catmull-Rom segment P1 -> P2 at parameter t in [t1, t2] */
const bg = (P0: X, P1: X, P2: X, P3: X, t0: number, t1: number, t2: number, t3: number, t: number): X => {
  const A1 = lerp(P0, P1, t0, t1, t), A2 = lerp(P1, P2, t1, t2, t), A3 = lerp(P2, P3, t2, t3, t);
  const B1 = lerp(A1, A2, t0, t2, t), B2 = lerp(A2, A3, t1, t3, t);
  return lerp(B1, B2, t1, t2, t);
};

/** monotone cubic through (xs, ys) with ys strictly increasing: returns y(x) and keeps dy/dx > 0 (Fritsch-Butland) */
const pchip = (xs: number[], ys: number[]) => {
  const n = xs.length, h: number[] = [], d: number[] = [], m: number[] = new Array(n);
  for (let k = 0; k < n - 1; k++) { h.push(xs[k + 1] - xs[k]); d.push((ys[k + 1] - ys[k]) / h[k]); }
  if (n === 2) { m[0] = m[1] = d[0]; }
  else {
    m[0] = d[0]; m[n - 1] = d[n - 2]; // constant speed at the ends: the path enters and leaves moving
    for (let k = 1; k < n - 1; k++) {
      const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
      m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let k = 0; while (k < n - 2 && x > xs[k + 1]) k++;
    const u = (x - xs[k]) / h[k], u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h[k] * m[k] + (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h[k] * m[k + 1];
  };
};

/** keeps the look direction within +-maxDeg of horizontal so lookAt(up = +y) never flips or spins */
export const limitPitch = (c: Cam, maxDeg = 80): Cam => {
  const d = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const hz = Math.hypot(d[0], d[2]), L = Math.hypot(hz, d[1]);
  if (L < 1e-6) return c;
  const pitch = Math.atan2(d[1], hz), lim = maxDeg * toRad;
  if (Math.abs(pitch) <= lim) return c;
  // keep yaw from the horizontal part (or +z if there is none) and clamp the pitch
  const yx = hz > 1e-6 ? d[0] / hz : 0, yz = hz > 1e-6 ? d[2] / hz : 1, p = Math.sign(pitch) * lim;
  return { ...c, look: [c.pos[0] + yx * Math.cos(p) * L, c.pos[1] + Math.sin(p) * L, c.pos[2] + yz * Math.cos(p) * L] };
};

type Path = { keys: FlowKey[]; base: X[]; knots: number[]; time: (f: number) => number };
const buildPath = (keys: FlowKey[]): Path => {
  const base = keys.map((k) => vec(k.at));
  // knot spacing: distance between neighbouring keys measured at one shared moment (the middle of their interval), so
  // a camera that rides with a moving subject (track) only counts its motion relative to that subject
  const at = (k: FlowKey, f: number) => vec(k.at, k.track?.(f));
  const knots = [0];
  for (let i = 1; i < keys.length; i++) {
    const fm = (keys[i - 1].f + keys[i].f) / 2;
    knots.push(knots[i - 1] + Math.max(1e-3, Math.sqrt(dist(at(keys[i - 1], fm), at(keys[i], fm)))));
  }
  const time = keys.length > 1 ? pchip(keys.map((k) => k.f), knots) : () => 0;
  return { keys, base, knots, time };
};
const evalPath = (p: Path, f: number): X => {
  const n = p.keys.length;
  const P = p.keys.map((k, i) => (k.track ? vec(k.at, k.track(f)) : p.base[i]));
  if (n === 1) return P[0];
  const t = p.time(f), K = p.knots;
  // outside the keys: carry on in a straight line with the end velocity (dissolve pre/post-roll never parks)
  if (t <= K[0] || t >= K[n - 1]) {
    const first = t <= K[0], i = first ? 0 : n - 2;
    const a = P[i], b = P[i + 1], q = first ? P[0] : P[n - 1], tq = first ? K[0] : K[n - 1];
    const v = a.map((ai, j) => (b[j] - ai) / (K[i + 1] - K[i]));
    return q.map((qi, j) => qi + v[j] * (t - tq));
  }
  let i = 0; while (i < n - 2 && t > K[i + 1]) i++;
  // reflected phantom end points keep the end tangents along the first / last chord
  const P0 = i > 0 ? P[i - 1] : P[0].map((v, j) => 2 * v - P[1][j]);
  const P3 = i + 2 < n ? P[i + 2] : P[n - 1].map((v, j) => 2 * v - P[n - 2][j]);
  const t0 = i > 0 ? K[i - 1] : K[0] - (K[1] - K[0]);
  const t3 = i + 2 < n ? K[i + 2] : K[n - 1] + (K[n - 1] - K[n - 2]);
  return bg(P0, P[i], P[i + 1], P3, t0, K[i], K[i + 1], t3, t);
};
const toCam = (x: X): Cam => limitPitch({ pos: [x[0], x[1], x[2]], look: [x[3], x[4], x[5]], fov: fovOf(x[6]), roll: x[7] });

export type Flow = ((f: number) => Cam) & {
  /** the place changes: frame of the new path's first key and how it joins ("cut" | "dissolve") */
  joins: { f: number; join: "cut" | "dissolve" }[];
  /** index of the path (place) active at frame f */
  pathAt: (f: number) => number;
  /** the camera of path i at frame f, also outside its keys (for the outgoing layer of a dissolve) */
  camOf: (i: number, f: number) => Cam;
};

/** builds the camera for a whole short (or one place): keys sorted by frame; cuts and dissolves split the paths */
export const flow = (keys: FlowKey[]): Flow => {
  const ks = [...keys].sort((a, b) => a.f - b.f);
  const groups: FlowKey[][] = [];
  for (const k of ks) (groups.length && (k.join ?? "flow") === "flow" ? groups[groups.length - 1].push(k) : groups.push([k]));
  const paths = groups.map(buildPath);
  const starts = groups.map((g) => g[0].f);
  const pathAt = (f: number) => { let i = 0; while (i + 1 < starts.length && f >= starts[i + 1]) i++; return i; };
  const camOf = (i: number, f: number) => toCam(evalPath(paths[i], f));
  const fn = ((f: number) => camOf(pathAt(f), f)) as Flow;
  fn.joins = groups.slice(1).map((g) => ({ f: g[0].f, join: g[0].join as "cut" | "dissolve" }));
  fn.pathAt = pathAt;
  fn.camOf = camOf;
  return fn;
};

/** layers for a 7-frame dissolve at each "dissolve" join: [outgoing path, incoming path] with the incoming alpha */
export const DISSOLVE_F = 7;
export const flowLayers = (cam: Flow, f: number): { path: number; alpha: number }[] => {
  for (const j of cam.joins) {
    if (j.join !== "dissolve") continue;
    const a = j.f - Math.floor(DISSOLVE_F / 2);
    if (f >= a && f < a + DISSOLVE_F) { const i = cam.pathAt(j.f); return [{ path: i - 1, alpha: 1 }, { path: i, alpha: (f - a + 1) / (DISSOLVE_F + 1) }]; }
  }
  return [{ path: cam.pathAt(f), alpha: 1 }];
};

/** dolly the camera toward its look point: k < 1 moves in (k = exp(-rate * frames)) */
export const push = (fr: Frame, k: number): Frame => ({
  ...fr, pos: [fr.look[0] + (fr.pos[0] - fr.look[0]) * k, fr.look[1] + (fr.pos[1] - fr.look[1]) * k, fr.look[2] + (fr.pos[2] - fr.look[2]) * k],
});
/** slide camera and look sideways (screen right = +side) by `m` metres: the lateral drift that keeps holds alive */
export const drift = (fr: Frame, m: number, up = 0): Frame => {
  const d = [fr.look[0] - fr.pos[0], fr.look[2] - fr.pos[2]], h = Math.hypot(d[0], d[1]) || 1;
  const r: V3 = [-d[1] / h, 0, d[0] / h]; // screen right on the ground plane (camera looking along d)
  const o: V3 = [r[0] * m, up, r[2] * m];
  return { ...fr, pos: [fr.pos[0] + o[0], fr.pos[1] + o[1], fr.pos[2] + o[2]], look: [fr.look[0] + o[0], fr.look[1] + o[1], fr.look[2] + o[2]] };
};
/** a held framing that keeps moving: two keys a beat apart, pushing in `push` per frame and drifting `side` metres.
 *  The camera arrives at f0 and leaves f1 with the velocity of the neighbouring moves (no brake, no restart). */
export const hold = (f0: number, f1: number, at: Frame, o: { push?: number; side?: number; rise?: number; track?: (f: number) => V3; join?: FlowKey["join"] } = {}): FlowKey[] => {
  const k = Math.exp(-(o.push ?? 0.002) * (f1 - f0));
  const end = drift(push(at, k), o.side ?? 0, o.rise ?? 0);
  return [{ f: f0, at, track: o.track, join: o.join }, { f: f1, at: end, track: o.track }];
};
