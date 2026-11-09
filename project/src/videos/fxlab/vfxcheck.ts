// Headless checks for vfx.ts (node, no GPU): debris rests ON the ground (lowest vertex = groundY), no jitter after rest,
// update(f) is pure (out-of-order evaluation = in-order), instance counts. Run:
//   npx esbuild src/videos/fxlab/vfxcheck.ts --bundle --platform=node --outfile=D:/remotion-tmp/vfxcheck.cjs && node D:/remotion-tmp/vfxcheck.cjs
import * as THREE from "three";
import { Debris, SmokePlume, Explosion, Fire, DustTrail, PuffBurst } from "./vfx";
// 1. Debris: rest on the ground (lowest vertex of every chunk == groundY), no motion after restFrame
const d = new Debris({ pos: [10.2, 0.8, -2.9], at: 60, volume: [0.9, 0.7, 0.7], count: 30, speed: [2.5, 6], seed: 62 });
console.log("restFrame", d.restFrame.toFixed(2));
const lowest = (m: THREE.Mesh) => { m.updateMatrixWorld(true); const P = m.geometry.getAttribute("position"); let y = 1e9; const v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P as THREE.BufferAttribute, i).applyMatrix4(m.matrixWorld); y = Math.min(y, v.y); } return y; };
let minLow = 1e9, maxLow = -1e9;
const snap = (f: number) => { d.update(f); return d.chunks.map((m) => [m.position.x, m.position.y, m.position.z, m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w]); };
// during flight: never below ground
let worst = 1e9;
for (let f = 60; f < 240; f += 0.25) { d.update(f); for (const m of d.chunks) worst = Math.min(worst, lowest(m)); }
console.log("lowest point over the whole flight (m, should be >= -0.002):", worst.toFixed(4));
d.update(239); for (const m of d.chunks) { const y = lowest(m); minLow = Math.min(minLow, y); maxLow = Math.max(maxLow, y); }
console.log("at f239 lowest vertex per chunk: min", minLow.toFixed(5), "max", maxLow.toFixed(5));
const a = snap(d.restFrame + 1), b = snap(d.restFrame + 30);
let jit = 0; a.forEach((r, i) => r.forEach((x, k) => { jit = Math.max(jit, Math.abs(x - b[i][k])); }));
console.log("max change between restFrame+1 and +30 (jitter):", jit);
// 2. purity: evaluate frames out of order, compare with in-order
const mk = () => [new SmokePlume({ source: (f) => [Math.sin(f * 0.05), 1, 0], start: -100, seed: 3 }), new Explosion({ pos: [0, 0.5, 0], at: 10, seed: 4 }), new Fire({ pos: (f) => [f * 0.05, 0, 0], size: 0.6 }),
  new DustTrail({ pos: (f) => [f * 0.1, 0, 0] }), new PuffBurst({ pos: [0, 0, 0], at: 5 }), new Debris({ pos: [0, 0.5, 0], at: 5, count: 10 })];
const dump = (fx: any[]) => fx.map((e) => { const out: number[] = []; e.root.traverse((o: any) => { if (o.isInstancedMesh) { out.push(o.count); for (let i = 0; i < o.count * 16; i++) out.push(o.instanceMatrix.array[i]); } else if (o.isMesh) out.push(o.position.x, o.position.y, o.position.z, o.visible ? 1 : 0); }); return out; });
const A = mk(), B = mk();
const frames = [40.25, 12, 100.5, 7.75, 61, 40.25];
const ref = frames.map((f) => { A.forEach((e) => e.update(f)); return dump(A); });
const order = [3, 0, 5, 2, 4, 1];
let bad = 0;
for (const i of order) { B.forEach((e) => e.update(frames[i])); const got = dump(B); got.forEach((arr, j) => { if (arr.length !== ref[i][j].length || arr.some((x, k) => Math.abs(x - ref[i][j][k]) > 1e-9)) bad++; }); }
console.log("purity mismatches (should be 0):", bad);
// 3. instance counts per effect at a busy frame
const C = mk(); C.forEach((e) => e.update(30)); console.log("instances at f30:", dump(C).map((x) => x[0]));
// 4. CPU cost of update(f) per effect (ms per call, averaged over a busy window) and the peak instance count
const busy: [string, () => { update(f: number): void; root: THREE.Object3D }, number][] = [
  ["SmokePlume chimney", () => new SmokePlume({ source: [0, 4, 0], start: -400, rate: 0.42, life: 170, size: [0.2, 0.85] }), 100],
  ["SmokePlume burning", () => new SmokePlume({ source: [0, 1, 0], start: -400, rate: 0.5, life: 120, size: [0.3, 1.15] }), 100],
  ["PuffBurst", () => new PuffBurst({ pos: [0, 0, 0], at: 90 }), 100],
  ["Explosion", () => new Explosion({ pos: [0, 0.7, 0], at: 90, size: 1.6 }), 100],
  ["DustTrail", () => new DustTrail({ pos: (f) => [f * 0.1, 0, 0], start: -60, rate: 1.1 }), 100],
  ["Fire (brazier)", () => new Fire({ pos: [0, 1, 0], size: 0.75 }), 100],
  ["Debris (30)", () => new Debris({ pos: [0, 0.8, 0], at: 90, count: 30, volume: [0.9, 0.7, 0.7] }), 100],
];
for (const [name, make, f0] of busy) {
  const t0 = performance.now(); const e = make(); const tc = performance.now() - t0;
  let peak = 0; const t1 = performance.now(); let n = 0;
  for (let f = f0; f < f0 + 60; f += 0.25) { e.update(f); n++; let c = 0; e.root.traverse((o: any) => { if (o.isInstancedMesh) c += o.count; }); peak = Math.max(peak, c); }
  console.log(`${name.padEnd(20)} construct ${tc.toFixed(1).padStart(6)} ms   update ${((performance.now() - t1) / n).toFixed(3)} ms/call   peak instances ${peak}`);
}
