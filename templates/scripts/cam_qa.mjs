// Camera gates (1-17): measures a short's camera from its story module (no render needed) against the reference numbers.
// usage (from the Remotion project root):
//   node scripts/cam_qa.mjs src/videos/<name>/story.ts [--from F] [--to F] [--csv out/<name>/cam.csv]
// The module must export: TOTAL, camAt(id, f), layersAt(f) -> [{ id, alpha }]. Optional: FPS, FLASH_AT, kickAt(t),
// trackAt(id, f) -> world offset of a moving subject the camera rides with (e.g. a marching column), so riding along
// is not counted as motion of the subject plane,
// dofAt(f) -> { cInf, focus? }, actorsAt(f) -> [{ name, pos: [x,y,z], r, visible? }] for the clipping / pop gate.
// Speed = screen motion of a 3x3 grid on the subject plane at 720x1280: |translation| + |scale-1| * 734 + |rotation| * 734
// px/frame, the same measure as references/reports/motion.md, so the reference numbers apply directly.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const args = process.argv.slice(2);
const file = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.log("usage: node scripts/cam_qa.mjs <story.ts> [--from F] [--to F] [--csv file]"); process.exit(1); }
const res = await build({ entryPoints: [path.resolve(file)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "error", external: ["three", "remotion", "react"] });
const tmp = path.join(os.tmpdir(), `cam_qa_${process.pid}.mjs`);
fs.writeFileSync(tmp, res.outputFiles[0].text);
const M = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const FPS = M.FPS ?? 30, TOTAL = M.TOTAL, F0 = Number(opt("--from", 0)), F1 = Number(opt("--to", TOTAL - 1));
const W = 720, H = 1280, ASPECT = W / H, R = 734;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const basis = (c) => {
  const fw = norm(sub(c.look, c.pos)); let rt = norm(cross(fw, [0, 1, 0])); let up = cross(rt, fw);
  const r = c.roll ?? 0, cr = Math.cos(r), sr = Math.sin(r);
  [rt, up] = [rt.map((v, i) => v * cr + up[i] * sr), up.map((v, i) => v * cr - rt[i] * sr)];
  return { fw, rt, up, th: Math.tan(((c.fov ?? 40) * Math.PI) / 360) };
};
const GRID = []; for (const sx of [-0.6, 0, 0.6]) for (const sy of [-0.6, 0, 0.6]) GRID.push([sx, sy]);
/** screen motion between camera a (frame f) and camera b (frame f+1), 720p px: the mean of the subject plane (look
 *  distance) and a background plane at 3x that distance, so orbits and pans count like in a full-frame registration */
const motion = (a, b, dt) => {
  const D = Math.hypot(...sub(a.look, a.pos));
  // the subject plane moves with a tracked subject (optional export trackAt(id, f) -> world offset of the subject)
  const bs = dt ? { ...b, pos: sub(b.pos, dt), look: sub(b.look, dt) } : b;
  return 0.5 * (motionAt(a, bs, D) + motionAt(a, b, 3 * D));
};
const trackD = (id, f) => (M.trackAt ? sub(M.trackAt(id, f + 1), M.trackAt(id, f)) : null);
const motionAt = (a, b, D) => {
  const A = basis(a), B = basis(b);
  const P = [], Q = [];
  for (const [sx, sy] of GRID) {
    const X = a.pos.map((p, i) => p + A.fw[i] * D + A.rt[i] * sx * D * A.th * ASPECT + A.up[i] * sy * D * A.th);
    const d = sub(X, b.pos), z = dot(d, B.fw);
    if (z <= 1e-3) return Infinity;
    P.push([sx * W / 2, sy * H / 2]);
    Q.push([(dot(d, B.rt) / (z * B.th * ASPECT)) * W / 2, (dot(d, B.up) / (z * B.th)) * H / 2]);
  }
  const mean = (S) => [S.reduce((s, p) => s + p[0], 0) / S.length, S.reduce((s, p) => s + p[1], 0) / S.length];
  const pm = mean(P), qm = mean(Q);
  let sp = 0, sq = 0, cr = 0, dt = 0;
  for (let i = 0; i < P.length; i++) {
    const p = [P[i][0] - pm[0], P[i][1] - pm[1]], q = [Q[i][0] - qm[0], Q[i][1] - qm[1]];
    sp += p[0] ** 2 + p[1] ** 2; sq += q[0] ** 2 + q[1] ** 2; cr += p[0] * q[1] - p[1] * q[0]; dt += p[0] * q[0] + p[1] * q[1];
  }
  return Math.hypot(qm[0] - pm[0], qm[1] - pm[1]) + Math.abs(Math.sqrt(sq / sp) - 1) * R + Math.abs(Math.atan2(cr, dt)) * R;
};
const yawPitch = (c) => { const d = sub(c.look, c.pos); return [Math.atan2(d[0], d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))]; };
const dom = (L) => (L.length > 1 && L[1].alpha >= 0.5 ? L[1].id : L[0].id);
const deg = (r) => (r * 180) / Math.PI;

// ---------- per-frame series ----------
const rows = [];
const cutFrames = [], dissolves = [], whipJoins = [];
let inDis = 0, disStart = -1;
for (let f = F0; f < F1; f++) {
  const L0 = M.layersAt(f), L1 = M.layersAt(f + 1), ia = dom(L0), ib = dom(L1);
  const two = L0.length > 1;
  if (two && !inDis) { inDis = 1; disStart = f; } else if (!two && inDis) { inDis = 0; dissolves.push({ f: disStart, len: f - disStart }); }
  const ca = M.camAt(ia, f), cb = M.camAt(ia, f + 1);
  let v = motion(ca, cb, trackD(ia, f));
  const kick = M.kickAt ? M.kickAt(f / FPS) !== 0 || M.kickAt((f + 1) / FPS) !== 0 : false;
  const flash = M.FLASH_AT !== undefined && Math.abs(f + 1 - M.FLASH_AT) <= 1;
  let cut = false, place = false;
  if (ia !== ib && !two && L1.length === 1) { // the drawn shot changes without a dissolve: a cut unless the camera carries on
    const j = motion(ca, M.camAt(ib, f + 1));
    if (j > 40 && j > 3 * Math.max(v, 1) && !flash) {
      // a WHIP transition (the reference's whip pans with motion blur): both cameras are moving fast at the swap
      const vin = motion(M.camAt(ib, f + 1), M.camAt(ib, f + 2), trackD(ib, f + 1));
      if (v >= 25 && vin >= 25) whipJoins.push(f + 1); else { cut = true; place = true; }
    }
  }
  if (!cut && v > (kick ? 150 : 80)) { // a jump inside one shot's camera
    const vp = f > F0 ? motion(M.camAt(ia, f - 1), ca, trackD(ia, f - 1)) : 0, vn = motion(cb, M.camAt(ia, f + 2), trackD(ia, f + 1));
    if (v > 4 * Math.max(vp, vn, 1)) cut = true;
  }
  if (cut) cutFrames.push({ f: f + 1, place });
  const [y, p] = yawPitch(ca), [y2] = yawPitch(cb);
  let dy = Math.abs(y2 - y); if (dy > Math.PI) dy = 2 * Math.PI - dy;
  const D = Math.hypot(...sub(ca.look, ca.pos)), dpos = Math.hypot(...sub(cb.pos, ca.pos));
  rows.push({ f, v: cut || !isFinite(v) ? NaN : v, kick, flash, cut, two, yaw: deg(dy), pitch: deg(p), roll: deg(ca.roll ?? 0), par: dpos / D, id: ia });
}
if (inDis) dissolves.push({ f: disStart, len: F1 - disStart });
const ok = rows.filter((r) => !Number.isNaN(r.v));
const V = rows.map((r) => r.v);
const sm = V.map((_, i) => { let s = 0, n = 0; for (let k = -2; k <= 2; k++) { const x = V[i + k]; if (x !== undefined && !Number.isNaN(x)) { s += x; n++; } } return n ? s / n : NaN; });

// ---------- beats: framing changes = move bursts + cuts + dissolves + the flash ----------
const peaks = [];
for (let i = 1; i < sm.length - 1; i++) if (sm[i] >= 3 && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && !rows[i].kick) peaks.push(i);
const beats = [];
for (const i of peaks) {
  const last = beats[beats.length - 1];
  if (last !== undefined) {
    let lo = Infinity; for (let k = last; k <= i; k++) if (!Number.isNaN(sm[k])) lo = Math.min(lo, sm[k]);
    if (i - last < 12 || lo > 0.7 * Math.min(sm[i], sm[last])) { if (sm[i] > sm[last]) beats[beats.length - 1] = i; continue; }
  }
  beats.push(i);
}
const beatFrames = [...beats.map((i) => rows[i].f), ...cutFrames.map((c) => c.f), ...dissolves.map((d) => d.f + 3), ...(M.FLASH_AT !== undefined && M.FLASH_AT >= F0 && M.FLASH_AT <= F1 ? [M.FLASH_AT] : [])]
  .sort((a, b) => a - b).filter((f, i, a) => i === 0 || f - a[i - 1] >= 10);
const gaps = beatFrames.map((f, i) => f - (i ? beatFrames[i - 1] : F0)).concat([F1 - (beatFrames[beatFrames.length - 1] ?? F0)]);

// ---------- gates ----------
const G = [];
const gate = (n, name, pass, val, target) => G.push({ n, name, pass, val, target });
// 1 never parks
let run = 0, worst = 0, slow = 0;
for (const r of rows) { if (!Number.isNaN(r.v) && r.v < 0.3 && !r.flash) { run++; slow++; worst = Math.max(worst, run); } else run = 0; }
gate(1, "never parks", worst < 4 && slow / ok.length <= 0.05, `longest <0.3 px/f run ${worst} f, ${(100 * slow / ok.length).toFixed(1)} % frames`, "< 4 f, <= 5 %");
// 2 framing change every ~1.7 s
const meanGap = (F1 - F0) / FPS / Math.max(1, beatFrames.length);
gate(2, "framing change ~1.7 s", meanGap >= 1.3 && meanGap <= 2.2, `${beatFrames.length} beats, one per ${meanGap.toFixed(2)} s`, "1.3-2.2 s (ref 1.7)");
// 3 first change, 4 two beats in the first 3 s (film start only)
const first = beatFrames.find((f) => f > F0 + 2);
const in3 = beatFrames.filter((f) => f - F0 <= 3 * FPS).length;
if (F0 === 0) {
  gate(3, "first change early", first !== undefined && first - F0 <= 1.5 * FPS, `${first === undefined ? "none" : ((first - F0) / FPS).toFixed(2) + " s"}`, "<= 1.5 s");
  gate(4, "2 beats in first 3 s", in3 >= 2, `${in3}`, ">= 2");
} else { gate(3, "first change early", null, "n/a (window does not start at frame 0)", ""); gate(4, "2 beats in first 3 s", null, "n/a (window does not start at frame 0)", ""); }
// 5 longest hold
const maxGap = Math.max(...gaps) / FPS;
gate(5, "longest hold", maxGap <= 5.17, `${maxGap.toFixed(2)} s`, "<= 5.17 s");
// 6 whips short
const whips = []; { let a = -1, pk = 0; rows.forEach((r, i) => { const fast = r.v >= 10; if (fast && a < 0) { a = i; pk = 0; } if (fast) pk = Math.max(pk, r.v); if ((!fast || i === rows.length - 1) && a >= 0) { if (pk >= 40) whips.push({ f: rows[a].f, len: i - a, pk }); a = -1; } }); }
gate(6, "whips <= 16 f", whips.every((w) => w.len <= 16), whips.length ? whips.map((w) => `${w.f}:${w.len}f/${w.pk.toFixed(0)}px`).join(" ") : "no whips", "each <= 16 f");
// 7 dissolves exactly 7 f
gate(7, "dissolves 7 f", dissolves.every((d) => d.len >= 6 && d.len <= 8), dissolves.length ? dissolves.map((d) => `${d.f}:${d.len}f`).join(" ") : "none", "6-8 f");
// 8 v_in = v_out: no brake between moves, smooth acceleration
const brakes = [];
for (let b = 1; b < beats.length; b++) {
  const i0 = beats[b - 1], i1 = beats[b]; if (i1 - i0 > 60) continue;
  // a whip in and a whip out of a short place is meant to be fast-slow-fast: only moves can brake
  const nearWhip = (i) => whips.some((w) => rows[i].f >= w.f - 2 && rows[i].f < w.f + w.len + 2) || whipJoins.some((j) => Math.abs(rows[i].f - j) <= 10);
  if (nearWhip(i0) || nearWhip(i1)) continue;
  let lo = Infinity, at = i0; for (let k = i0; k <= i1; k++) if (!Number.isNaN(sm[k]) && sm[k] < lo) { lo = sm[k]; at = k; }
  if (lo < 0.15 * Math.min(sm[i0], sm[i1])) brakes.push(rows[at].f);
}
let jerk = 0, jerkAt = -1;
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  if (Number.isNaN(a.v) || Number.isNaN(b.v) || a.kick || b.kick || a.two || b.two || a.flash || b.flash || a.v >= 40 || b.v >= 40 || whipJoins.some((j) => Math.abs(b.f - j) <= 10)) continue;
  const d = Math.abs(b.v - a.v); if (d > jerk) { jerk = d; jerkAt = b.f; }
}
gate(8, "v_in = v_out (no brake)", brakes.length === 0 && jerk <= 3, `${brakes.length} brake-restarts${brakes.length ? " @" + brakes.slice(0, 8).join(",") + (brakes.length > 8 ? ",..." : "") : ""}; max |dv| ${jerk.toFixed(2)} px/f2 @${jerkAt}`, "0 brakes, |dv| <= 3");
// 9 parallax: the camera translates (not only zooms / turns)
const par = ok.filter((r) => r.par >= 0.0005).length / ok.length;
gate(9, "parallax (camera travels)", par >= 0.7, `${(100 * par).toFixed(0)} % frames move >= 0.05 % of subject distance`, ">= 70 %");
// 10 DOF focus follows the subject (no jumps outside cuts)
if (M.dofAt) {
  let jumps = 0; const fd = (f) => { const d = M.dofAt(f); const id = dom(M.layersAt(f)); const c = M.camAt(id, f); const p = d.focus ? d.focus(f) : c.look; return Math.hypot(...sub(p, c.pos)); };
  // a focus jump only shows when there is blur to see (cInf > 0.5 px on either frame)
  // place changes (whip joins, the flash, shot changes onto another camera path) refocus with the cut: not a jump
  const jf = [];
  for (const r of rows) {
    if (r.cut || r.two || r.flash || whipJoins.some((j) => Math.abs(r.f + 1 - j) <= 1) || (M.dofAt(r.f).cInf <= 0.5 && M.dofAt(r.f + 1).cInf <= 0.5)) continue;
    const a = fd(r.f), b = fd(r.f + 1); if (Math.abs(b - a) / a > 0.3) { jumps++; jf.push(r.f + 1); }
  }
  gate(10, "focus follows subject", jumps === 0, `${jumps} focus jumps > 30 %/f${jf.length ? " @" + jf.slice(0, 10).join(",") : ""}`, "0");
} else gate(10, "focus follows subject", null, "n/a (no dofAt export)", "");
// 11 no spin
// whips (runs >= 10 px/f peaking >= 40, <= 16 f, gate 6) are allowed to turn fast; everything else must not spin
const inWhip = (f) => whips.some((w) => f >= w.f && f < w.f + w.len) || whipJoins.some((j) => Math.abs(f - j) <= 8);
const maxYaw = Math.max(...rows.filter((r) => !r.cut && !r.kick && !inWhip(r.f)).map((r) => r.yaw)), maxPitch = Math.max(...rows.map((r) => Math.abs(r.pitch))), maxRoll = Math.max(...rows.map((r) => Math.abs(r.roll)));
gate(11, "no spin", maxYaw <= 3 && maxPitch <= 80 && maxRoll <= 8.5, `yaw ${maxYaw.toFixed(2)} deg/f, pitch ${maxPitch.toFixed(0)}, roll ${maxRoll.toFixed(1)}`, "yaw <= 3 deg/f, |pitch| <= 80, |roll| <= 8.5");
// 12 hard cuts: at most one, never between places (places change by portal, dissolve or the hook flash)
const placeCuts = cutFrames.filter((c) => c.place);
gate(12, "<= 1 cut, places by portal/dissolve/whip", cutFrames.length <= 1 && placeCuts.length === 0, `${cutFrames.length} cuts (${placeCuts.length} between places)${cutFrames.length ? " @" + cutFrames.slice(0, 10).map((c) => c.f).join(",") + (cutFrames.length > 10 ? ",..." : "") : ""}; ${whipJoins.length} whip joins${whipJoins.length ? " @" + whipJoins.join(",") : ""}`, "<= 1, 0 between places");
// 13 actors: no interpenetration, no pops
if (M.actorsAt) {
  let hits = [], pops = [];
  let prev = null;
  for (let f = F0; f <= F1; f++) {
    const A = M.actorsAt(f).filter((a) => a.visible !== false);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const d = Math.hypot(A[i].pos[0] - A[j].pos[0], A[i].pos[2] - A[j].pos[2]);
      if (d < A[i].r + A[j].r) hits.push(`${f}:${A[i].name}/${A[j].name}`);
    }
    if (prev) for (const a of prev) if (!A.find((b) => b.name === a.name) && !a.exits) pops.push(`${f}:${a.name}`);
    prev = A;
  }
  gate(13, "no clipping / pops", hits.length === 0 && pops.length === 0, `${hits.length} overlaps ${hits.slice(0, 4).join(" ")} | ${pops.length} pops ${pops.slice(0, 4).join(" ")}`, "0 / 0");
} else gate(13, "no clipping / pops", null, "n/a (no actorsAt export): check renders", "");
// 14 retention window (the user's channel audit, 2026-11-06: viewers leave at 9-12 s when the hook resolves early).
// story.ts exports RETENTION = { setPiece: [fa, fb], resolve: f }: the strongest visual's frames and the frame where the
// hook's answer is first given. Checks: set piece starts 9.5-12 s, the answer comes at >= 15 s, the camera makes a
// real move (>= 10 px/f) inside the set piece, and the 8-15 s window keeps changing framing (>= 4 beats, gap <= 2.3 s).
if (F0 === 0 && M.RETENTION && TOTAL > 15 * FPS) {
  const { setPiece: [sa, sb], resolve } = M.RETENTION;
  const w0 = 8 * FPS, w1 = 15 * FPS;
  const wb = beatFrames.filter((f) => f >= w0 && f <= w1);
  const wg = Math.max(...[w0, ...wb, w1].map((f, i, a) => (i ? f - a[i - 1] : 0))) / FPS;
  let spk = 0; for (const r of rows) if (r.f >= sa && r.f <= sb && !Number.isNaN(r.v) && !r.kick) spk = Math.max(spk, r.v);
  const spOk = sa >= 9.5 * FPS && sa <= 12 * FPS, resOk = resolve >= 15 * FPS;
  gate(14, "retention: 8-15 s window", spOk && resOk && spk >= 10 && wb.length >= 4 && wg <= 2.3,
    `set piece @${(sa / FPS).toFixed(1)}-${(sb / FPS).toFixed(1)} s (peak ${spk.toFixed(0)} px/f), answer @${(resolve / FPS).toFixed(1)} s, ${wb.length} beats in 8-15 s, max gap ${wg.toFixed(2)} s`,
    "set piece starts 9.5-12 s & moves >= 10, answer >= 15 s, >= 4 beats, gap <= 2.3 s");
} else gate(14, "retention: 8-15 s window", null, F0 === 0 ? "n/a (no RETENTION export: REQUIRED for every new short)" : "n/a (window does not start at frame 0)", "");

// 15 opening density (newest-6 study 2026-11-06: 2-6 framings in the first 6 s, median ~5; 0 hard cuts in the first 10 s
// in 5 of 6 shorts): >= 4 beats in 0-6 s and no hard cut before 10 s (the white flash is not a cut).
if (F0 === 0) {
  const in6 = beatFrames.filter((f) => f <= 6 * FPS).length, early = cutFrames.filter((c) => c.f < 10 * FPS).map((c) => c.f);
  gate(15, "opening: >= 4 beats in 6 s, no cut < 10 s", in6 >= 4 && early.length === 0, `${in6} beats in 0-6 s; cuts before 10 s: ${early.length ? early.join(",") : "none"}`, ">= 4, 0");
} else gate(15, "opening: >= 4 beats in 6 s, no cut < 10 s", null, "n/a (window does not start at frame 0)", "");
// 16 drift-then-burst rhythm (motion.md: moves peak a median 14-16 px/f, overall median speed 3.6): the framing changes are
// REAL moves but not whips (median beat peak 10-30 px/f) and the camera calms between them (median speed 2-5 px/f).
// Skara Brae (2026-11-06) fails it: median 9.7 px/f, the camera never calms down between moves.
{
  const pk = beats.map((i) => sm[i]).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b), mp = pk.length ? pk[Math.floor((pk.length - 1) / 2)] : 0;
  const vv = ok.map((r) => r.v).sort((a, b) => a - b), md = vv[Math.floor((vv.length - 1) / 2)];
  gate(16, "rhythm: calm drift + real bursts", mp >= 10 && mp <= 30 && md >= 2 && md <= 5, `median beat peak ${mp.toFixed(1)} px/f, median speed ${md.toFixed(2)}`, "peak 10-30 (ref 14-16), median 2-5 (ref 3.6)");
}

// 17 level horizon (roll study of the newest 6 reference shorts, 2026-11-06, roll_meter.py on trusted frames): the
// camera roll is ~0 (median 0.3 deg, p90 ~2 deg = the meter's noise floor); characters always stand upright in frame.
// Real roll only on ride-along follows of a fast object (bullet cam: banks to ~8-10 deg, unrolls to 0 before it lands on
// the subject). No dutch tilts on emphasis beats, no banking into pans (corr(roll, pan) ~0). Impact-kick rolls (+-0.35)
// are fine. Checks: >= 80 % of frames |roll| <= 1 deg (the reference measures 56-85 % INCLUDING the meter's noise, which
// alone gives 91 % on a level render, so >= 80 % is its floor), max <= 10 deg, and every frame > 3 deg sits within 12 f
// of a fast move (smoothed speed >= 10 px/f).
{
  const R = rows.map((r) => Math.abs(r.roll));
  const lvl = R.filter((x) => x <= 1).length / Math.max(1, R.length), mx = Math.max(0, ...R);
  const off = [];
  rows.forEach((r, i) => { if (R[i] <= 3) return; let fast = false; for (let k = Math.max(0, i - 12); k <= Math.min(rows.length - 1, i + 12); k++) if (sm[k] >= 10) { fast = true; break; } if (!fast) off.push(r.f); });
  gate(17, "level horizon (roll only on ride-alongs)", lvl >= 0.8 && mx <= 10 && off.length === 0,
    `${(100 * lvl).toFixed(0)} % frames |roll| <= 1 deg, max ${mx.toFixed(1)} deg, ${off.length} frames > 3 deg off a fast move${off.length ? " @" + off.slice(0, 6).join(",") + (off.length > 6 ? ",..." : "") : ""}`,
    ">= 80 %, <= 10 deg, 0");
}

// ---------- report ----------
const vs = ok.map((r) => r.v).sort((a, b) => a - b), q = (p) => vs[Math.floor(p * (vs.length - 1))];
console.log(`\ncamera gates: ${file}  frames ${F0}-${F1}  (${((F1 - F0) / FPS).toFixed(1)} s)`);
console.log(`speed 720p px/f: median ${q(0.5).toFixed(2)} (ref 3.6)  p90 ${q(0.9).toFixed(1)} (ref 16.9)  max ${vs[vs.length - 1].toFixed(1)}  holds<0.3 ${(100 * slow / ok.length).toFixed(0)} %`);
for (const g of G) console.log(`${g.pass === null ? " -- " : g.pass ? "PASS" : "FAIL"}  ${String(g.n).padStart(2)} ${g.name.padEnd(36)} ${g.val}${g.target ? `   [${g.target}]` : ""}`);
const scored = G.filter((g) => g.pass !== null);
console.log(`\n${scored.filter((g) => g.pass).length}/${scored.length} gates pass`);
const csv = opt("--csv");
if (csv) {
  fs.mkdirSync(path.dirname(csv), { recursive: true });
  fs.writeFileSync(csv, "f,v,sm,yaw,pitch,roll,par,cut,two,kick,id,beat\n" + rows.map((r, i) => [r.f, Number.isNaN(r.v) ? "" : r.v.toFixed(3), Number.isNaN(sm[i]) ? "" : sm[i].toFixed(3), r.yaw.toFixed(3), r.pitch.toFixed(2), r.roll.toFixed(2), r.par.toFixed(5), +r.cut, +r.two, +r.kick, r.id, beatFrames.includes(r.f) ? 1 : 0].join(",")).join("\n"));
  console.log(`per-frame series: ${csv}`);
}
