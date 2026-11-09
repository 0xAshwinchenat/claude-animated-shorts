// CAST RIG (owner: char): the 3D toon cast (toon3d.ts): King Antigonus (Megara: in E3's tower; the stable: points at
// "ordered"), the Megarian hero (vaults into the pen, grabs P0, smears the pitch, lights the torch), the writer (raised
// finger, then writes the self-drawing scroll), two Indian trainers (carry the piglets in, pat them), the Roman defender
// (torch dunked, the pig hooked, the rope paid out, the grin). Pose-to-pose on ones: dead-still holds, 3-5 f attacks,
// strikeTrack contacts on the story frames, expression swaps 0-3 f before the word hidden in a blink. update() is a pure
// function of (sid, f); everything is driven by story time st = storyF(sid, f) (f may be fractional).
import * as THREE from "three";
import {
  Toon3D, TOON3D, EXPR, blink, track, exprTrack, strikeTrack, makeProp, MOP_L, TORCH_L, PEN_L,
  type Expr, type Mouth, type V3, type ArmPose, type Pose, type PropK, type PropPose,
} from "./toon3d";
import {
  SHOTS, storyF, lerp3, linF, rampF, clamp01, eleMegara, eleLocalToWorld, KING_ELE, HOWDAH_FLOOR, REAR, TURN, F_FREEZE, F_STAMPEDE,
  F_RAID, F_SMEAR, F_IGNITE, carryP0, penPos, queuePos, BRAZIER, HERO_PIG, ANT_STABLE, BABY, TRAINERS, CARRY, pigletAt,
  WRITER_AT, SCROLL_AT, drawK, ROMAN_AT, pigEdessa, camStatic, F_SQUEAL_ED, at,
} from "./story";
import { eleBob } from "./beasts";
import type { EleState } from "./story";
/** a rider point on an elephant: the contract transform + the drawn body bob */
const rideAt = (e: EleState, l: V3): V3 => { const w = eleLocalToWorld(e, l); return [w[0], w[1] + eleBob(e), w[2]]; };

// ---------------------------------------------------------------- tiny helpers
type Ez = "hold" | "snap" | "ease" | "linear";
const PI = Math.PI;
const FI = (f: number) => Math.floor(f + 1e-6);
const tv = (f: number, keys: [number, V3, Ez?][]): V3 => track(f, keys.map(([k, v, e]) => ({ f: k, v: v as number[], ease: e }))) as V3;
const tn = (f: number, keys: [number, number, Ez?][]): number => track(f, keys.map(([k, v, e]) => ({ f: k, v, ease: e })));
/** expression track on ones + blinks (a blink across every swap) */
const faceAt = (f: number, seed: number, keys: [number, Expr][]): Expr => { const fi = FI(f), x = exprTrack(fi, keys); return blink(fi, seed, x.e, x.swaps); };
const R = (hand: V3, pole?: V3): ArmPose => ({ hand, pole, root: true });
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const nrm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const midYaw = (a: number, b: number, k = 0.5) => a + wrap(b - a) * k;
const fwdOf = (yaw: number): V3 => [Math.sin(yaw), 0, Math.cos(yaw)];
/** the character's RIGHT in world (local -x) */
const rightOf = (yaw: number): V3 => [-Math.cos(yaw), 0, Math.sin(yaw)];
const X = (e: Partial<Expr> & Pick<Expr, "eyes" | "brows" | "mouth">): Expr => e as Expr;
const hardEase = (u: number) => { const t = clamp01(u); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
/** walk along waypoints between frames t0 -> t1 (short ease in/out): position, facing (quick turns at corners), distance */
const pathWalk = (st: number, pts: V3[], t0: number, t1: number) => {
  const lens = pts.slice(1).map((b, k) => Math.hypot(b[0] - pts[k][0], b[2] - pts[k][2])), tot = lens.reduce((a, b) => a + b, 0);
  const u = clamp01((st - t0) / (t1 - t0));
  const e = u < 0.15 ? (u / 0.15) ** 2 * 0.075 : u > 0.85 ? 1 - ((1 - u) / 0.15) ** 2 * 0.075 : 0.075 + ((u - 0.15) / 0.7) * 0.85;
  const d = tot * e;
  let s = d, k = 0;
  while (k < lens.length - 1 && s > lens[k]) { s -= lens[k]; k++; }
  const a = pts[k], b = pts[k + 1], p = lerp3(a, b, Math.min(1, s / (lens[k] || 1)));
  let yaw = yawTo(a, b);
  const speed = tot / ((t1 - t0) * 0.85);
  if (k < lens.length - 1 && lens[k] - s < speed * 1.5) yaw = midYaw(yaw, yawTo(b, pts[k + 2]), 0.5 * hardEase(1 - (lens[k] - s) / (speed * 1.5)));
  if (k > 0 && s < speed * 1.5) yaw = midYaw(yawTo(pts[k - 1], a), yaw, 0.5 + 0.5 * hardEase(s / (speed * 1.5)));
  return { p, yaw, d, moving: st > t0 && st < t1 };
};

// expressions (v2 2026-11-09: the bolder toon3d faces + the new expressions on the existing key frames; no timing changed)
/** the furious king's 3D steam (toon3d FaceFX). cast.ts still draws the OLD 2D steam cards from F_STAMPEDE + 6 (the
 *  "Antigonus' white anger steam" block): to use the 3D puffs, delete that block and set this true (never both). */
const KING_STEAM_3D = false;
/** rage = the furious expression (purple-red head tint ramping in over 3 f, anger vein) with a chosen mouth */
const fury = (mouth: Mouth): Expr => ({ ...EXPR.furious, mouth, steam: KING_STEAM_3D });
const FX = {
  smug: EXPR.smug,
  smugGrin: X({ eyes: "lid", brows: "raised1", mouth: "grin" }),
  command: X({ eyes: "dot", brows: "angry", mouth: "open" }),
  fierce: X({ eyes: "lid", brows: "angry", mouth: "teeth" }),
  shock: X({ eyes: "ring", brows: "up", mouth: "open" }),
  /** NEW: the king at "freeze" - wide eyes, both teeth rows bared */
  shockTeeth: EXPR.shockTeeth,
  rage: fury("grit"),
  rage2: fury("shout"),
  effort: X({ eyes: "squint", brows: "angry", mouth: "grit" }),
  determined: X({ eyes: "dot", brows: "angry", mouth: "flat" }),
  grimace: X({ eyes: "squint", brows: "worried", mouth: "grit" }),
  /** concentration: the tongue poking out of the mouth corner (was an open mouth with the tongue) */
  tongue: X({ eyes: "lid", brows: "flat", mouth: "tongueOut" }),
  happy: EXPR.happy,
  /** NEW: big open laugh (the hero as the burning pigs charge out) */
  laugh: EXPR.laugh,
  /** NEW: the hero's leap back from the flare-up */
  scream: EXPR.scream,
  /** NEW: a trainer patting the piglet */
  blush: EXPR.blush,
  scared: X({ eyes: "ring", brows: "up", mouth: "o" }),
  proclaim: X({ eyes: "dot", brows: "up", mouth: "open" }),
  ponder: X({ eyes: "lid", brows: "raised1", mouth: "small" }),
  pleased: X({ eyes: "happy", brows: "flat", mouth: "smirk" }),
  deadpan: X({ eyes: "lid", brows: "flat", mouth: "flat" }),
  /** NEW: the Roman dunking the torch ("this time, the Romans don't light anything") */
  bored: EXPR.bored,
  smirk: X({ eyes: "lid", brows: "raised1", mouth: "smirk" }),
  /** NEW: the Roman's shrug - smug side-eye, one raised brow */
  smugBrow: EXPR.smugBrow,
  grin: X({ eyes: "happy", brows: "up", mouth: "teeth" }),
  /** NEW: the Roman cracking up at the squeal (><, open laugh, tears jetting out) */
  laughCry: EXPR.laughCry,
  neutral: EXPR.neutral,
};

// ---------------------------------------------------------------- staging constants (world metres)
/** the hero's spot at the queue head: east-north-east of P0, off the north camera's line of sight to P0 */
const P0Q = queuePos(HERO_PIG);
const AWAY: V3 = nrm([0.92, 0, -0.38]);
export const HERO_Q: V3 = [P0Q[0] + AWAY[0] * 1.3, 0, P0Q[2] + AWAY[2] * 1.3];
const camSmear = camStatic(5, 570).pos;
const HERO_Q_YAW = midYaw(yawTo(HERO_Q, P0Q), yawTo(HERO_Q, camSmear), 0.68);
/** the pitch bucket (with the long brush standing in it) at the hero's right */
export const PITCH_BKT: V3 = add3(HERO_Q, mul3(rightOf(HERO_Q_YAW), 0.55));
/** the brush's contact points on P0's back (the smear CONTACT at F_SMEAR, then strokes along the back) */
export const SMEAR_PT: V3 = [P0Q[0], 0.64, P0Q[2]];
const STROKE_A: V3 = [P0Q[0], 0.64, P0Q[2] + 0.28], STROKE_B: V3 = [P0Q[0], 0.64, P0Q[2] - 0.28];
/** brush stroke arrivals after the contact (pitch splats in cast.ts) */
export const SMEAR_HITS = [F_SMEAR, 578, 583, 588, 593];
/** the hero's run to the brazier and back (between the queue lanes, round P0's tail) */
const BRZ_STAND: V3 = [BRAZIER[0] + 0.75, 0, BRAZIER[2] + 0.45];
const BRZ_PATH: V3[] = [HERO_Q, [0.0, 0, -6.85], BRZ_STAND];
/** where the torch's flame touches P0 at F_IGNITE */
export const IGNITE_PT: V3 = [P0Q[0] + 0.05, 0.72, P0Q[2] + 0.1];
/** the hero's leap back after the ignite */
const LEAP_TO: V3 = add3(HERO_Q, mul3(AWAY, 1.25));
/** the run in, the vault over the pen's north wall, the grab spot east of P0 */
const PEN0 = penPos(HERO_PIG);
const RUN_FROM: V3 = [4.6, 0, -13.6], VAULT_A: V3 = [7.9, 0, -12.9], VAULT_B: V3 = [7.85, 0, -10.1];
const CARRY_M: V3 = [4.2, 0, -8.6];
/** Antigonus' head centre (world) on E3 at story frame st (the anger steam in cast.ts) */
export const antHeadW = (st: number): V3 => rideAt(eleMegara(KING_ELE, st), [HOWDAH_FLOOR[0], HOWDAH_FLOOR[1] + 1.6, HOWDAH_FLOOR[2]]);
/** the Roman's rope grip (world): beside the beam's root on the tower top (the beast owner's rope runs from here over BEAM_TIP) */
export const ROPE_HAND: V3 = at(ROMAN_AT, -0.62, 1.15, 0.42);
/** the Roman's water bucket on the platform (to his right) */
export const WATER_BKT: V3 = at(ROMAN_AT, -0.62, 0, -0.1);

export class CastRig {
  group = new THREE.Group();
  ant: Toon3D; hero: Toon3D; writer: Toon3D; trainers: Toon3D[]; roman: Toon3D;
  private all: Toon3D[];
  private mopStand: THREE.Group; private pitchBkt: THREE.Group; private waterBkt: THREE.Group;
  constructor(root: THREE.Group) {
    root.add(this.group);
    // v2 outfits (2026-11-09): wool / linen weave, stitched seams + hems, period trims, an emblem on the king, a mended
    // tunic + rope belt on the hero, a bordered himation on the writer, a jacket + lotus on the mahouts (shapes, no letters)
    this.ant = new Toon3D({ build: "stout", scale: 1.25,
      outfit: { shirt: "#b8323a", robe: "#b8323a", robeLen: 0.42, trim: "#e8c45a", hem: "key", hemCol: "#8a1f2a", fabric: "wool", stitch: "#f2cf5a",
        belt: "#5a2e1c", buckle: "#f2cf5a", cloak: "#6a2a86", cloakTrim: "#e8c45a", torc: "#e8c45a", emblem: { shape: "sun", col: "#f2cf5a" } },
      hat: { k: "kausia", col: "#6a2a86", diadem: "#f8f4ea" }, beard: { col: "#3a2418", curl: true } });
    this.hero = new Toon3D({ build: "slim", scale: 1.3,
      outfit: { shirt: "#e6d2a6", robe: "#e6d2a6", robeLen: 0.3, trim: "#b89a66", hem: "band", fabric: "linen", patches: "#b08c5c", rope: "#c9a46a" },
      hat: { k: "hair", col: "#6a4220", curly: true }, props: [{ k: "mop", hand: "R" }, { k: "torch", hand: "R" }] });
    this.writer = new Toon3D({ build: "adult", scale: 1.15,
      outfit: { shirt: "#f6f2ea", robe: "#f6f2ea", robeLen: 0.86, toga: "#ffffff", togaBand: "#4a6fb5", trim: "#d8d0c0", hem: "key", hemCol: "#4a6fb5", fabric: "linen" },
      hat: { k: "laurel", col: "#eeeae4" }, beard: { col: "#d6d2de", full: true }, props: [{ k: "pen", hand: "R" }] });
    this.trainers = [0, 1].map((i) => new Toon3D({ build: i ? "slim" : "adult", scale: 1.15,
      outfit: { shirt: "#f6f2ea", robe: i ? "#f6f2ea" : "#e8902a", robeLen: 0.45, sash: i ? "#e8902a" : "#f6f2ea", trim: "#c8762a", hem: "dots", hemCol: i ? "#e8902a" : "#7a3410",
        fabric: "linen", vest: i ? undefined : "#2f7a8c", emblem: i ? { shape: "lotus", col: "#e8902a" } : undefined },
      hat: { k: "turban", col: i ? "#e8902a" : "#f6f2ea", band: i ? "#f6f2ea" : "#e8902a" }, beard: i ? undefined : { col: "#2a1d16", stache: true } }));
    this.roman = new Toon3D({ build: "adult", scale: 1.2,
      outfit: { shirt: "#c0302a", robe: "#c0302a", robeLen: 0.3, trim: "#8a2020", hem: "band", hemCol: "#e8c45a", fabric: "wool", segs: "#a9b0ba", belt: "#5a3a20", buckle: "#c9a24a" },
      hat: { k: "romhelm" }, props: [{ k: "torch", hand: "R" }, { k: "torch0", hand: "R" }, { k: "rope", hand: "L" }] });
    this.all = [this.ant, this.hero, this.writer, ...this.trainers, this.roman];
    for (const c of this.all) this.group.add(c.root);
    // set dressing the cast handles: the long brush standing in the pitch bucket, the Roman's water bucket
    this.mopStand = makeProp("mop", this.hero.hh); this.pitchBkt = makeProp("bucket", this.hero.hh * 1.5); this.waterBkt = makeProp("bucket", this.roman.hh * 1.5);
    this.pitchBkt.position.set(PITCH_BKT[0], 0.64 * this.hero.hh * 1.5, PITCH_BKT[2]);
    this.mopStand.position.set(PITCH_BKT[0], 0.3 + MOP_L * this.hero.hh, PITCH_BKT[2]); this.mopStand.rotation.set(PI + 0.12, 0, 0.1);
    this.waterBkt.position.set(WATER_BKT[0], WATER_BKT[1] + 0.64 * this.roman.hh * 1.5, WATER_BKT[2]);
    this.group.add(this.mopStand, this.pitchBkt, this.waterBkt);
  }

  update(sid: number, f: number, _cam: THREE.PerspectiveCamera, sun: THREE.Vector3) {
    TOON3D.uSunW.value.copy(sun);   // world.ts sets it too (direction TOWARD the sun)
    const s = SHOTS[sid - 1], st = storyF(sid, f);
    this.group.visible = true;
    for (const c of this.all) c.root.visible = false;
    this.mopStand.visible = this.pitchBkt.visible = this.waterBkt.visible = false;
    if (s.set === "megara") {
      this.antMegara(st);
      if (sid === 5 || sid === 6) this.heroAct(st);
    } else if (s.set === "scroll") this.writerAct(st);
    else if (s.set === "stable") { this.antStable(st); this.trainersAct(st); }
    else if (s.set === "edessa") this.romanAct(st);
  }

  private show(c: Toon3D, p: Pose) { c.root.visible = true; c.pose(p); }

  // ================= ANTIGONUS on E3 (Megara, every shot; the hook replays 826-885) =================
  private antMegara(st: number) {
    const e = eleMegara(KING_ELE, st);
    if (!e.vis) return;
    const c = this.ant, pos = rideAt(e, HOWDAH_FLOOR);
    // the look back over his RIGHT shoulder at the camera (200-262), then the snap forward + the point at the city (262-266)
    const turnK = tn(st, [[118, 0], [200, 0, "hold"], [203, 1, "ease"], [262, 1, "hold"], [265, 0, "ease"]]);
    const yaw = e.yaw - 0.95 * turnK;
    const RAIL_L: V3 = [0.24, 1.02, 0.44], RAIL_R: V3 = [-0.24, 1.02, 0.44];
    const HIP_L = c.hand("hip", "L");
    const POINT: V3 = [-0.42, 1.72, 0.78], FIST_HI: V3 = [-0.36, 2.15, 0.28], FIST_LO: V3 = [-0.4, 1.86, 0.46];
    let armL: ArmPose = HIP_L, armR: ArmPose = { hand: RAIL_R, pole: [-1, -0.4, -0.3] };
    if (st >= 262 && st < 760) { // the point: 4 f hard attack, dead-still hold, back to the rail
      const hp = tv(st, [[262, RAIL_R], [266, POINT, "ease"], [330, POINT, "hold"], [335, RAIL_R, "ease"]]);
      armR = { hand: hp, pole: [-1, -0.5, -0.2] };
    }
    const rearing = st >= REAR[0] - 1 && st < REAR[1] + 2;
    if (rearing || (st >= TURN[0] && st < F_STAMPEDE)) { armL = { hand: RAIL_L, pole: [1, -0.4, -0.3] }; armR = { hand: RAIL_R, pole: [-1, -0.4, -0.3] }; }
    if (st >= F_STAMPEDE) { // the fist waves on fours (pose to pose), the left hand grips the rail
      armL = { hand: RAIL_L, pole: [1, -0.4, -0.3] };
      const n = Math.floor((st - F_STAMPEDE) / 4);
      armR = { hand: st < F_STAMPEDE + 4 ? tv(st, [[F_STAMPEDE, RAIL_R], [F_STAMPEDE + 4, FIST_HI, "ease"]]) : n % 2 ? FIST_LO : FIST_HI, pole: [-1, -0.3, -0.2] };
    }
    const lean = -30 * e.rear + (st >= F_STAMPEDE ? 8 : 0) + (st >= 262 && st < 335 ? 6 : 0);
    const head = { yaw: -0.95 * turnK, pitch: turnK > 0.5 ? -0.16 : rearing ? -0.12 : st >= F_STAMPEDE ? 0.06 : -0.05, roll: st >= F_STAMPEDE ? (Math.floor(st / 6) % 2 ? 0.08 : -0.06) : 0 };
    const face = faceAt(st, 41, [[118, FX.smug], [199, FX.smugGrin], [263, FX.command], [336, FX.smug], [407, FX.fierce], [470, FX.smug],
      [F_FREEZE - 2, FX.shockTeeth], [F_STAMPEDE, FX.rage], [930, FX.rage2], [962, FX.rage]]);
    this.show(c, { pos, yaw, lean, head, armL, armR, face }); // the purple-red rage head is the furious expression's tint
  }

  // ================= ANTIGONUS in the stable (shot 9): POINTS at "ordered" (1137) =================
  private antStable(st: number) {
    const c = this.ant, pos = ANT_STABLE;
    const tgt: V3 = [BABY[0][0], 1.4, BABY[0][2]];
    const cam = camStatic(9, 1140).pos;
    const yP = yawTo(pos, tgt), yC = yawTo(pos, cam), yaw = midYaw(yC, yP, 0.3);
    const headYaw = Math.max(-1, Math.min(1, wrap(yC - yaw))) * 0.8;
    // left arm points at the paddock: 4 f hard attack onto 1137, dead-still hold, then the fist back on the hip
    const sh: V3 = [(c.B.topW / 2 - 0.06) * c.hh, (c.B.legL - 0.1 + c.B.torsoH - 0.2) * c.hh, 0];
    const rel = Math.min(1.2, Math.max(-1.2, wrap(yP - yaw))), d = nrm([Math.sin(rel), 0.18, Math.cos(rel)]);
    const POINT = add3(sh, mul3(d, 0.66)), HIP = c.hand("hip", "L").hand as V3, CROSS: V3 = [0.06, 1.02, 0.42];
    const hL = tv(st, [[1100, CROSS], [1133, CROSS, "hold"], [1137, POINT, "ease"], [1215, POINT, "hold"], [1220, HIP, "ease"]]);
    const hR = tv(st, [[1100, [-0.06, 1.0, 0.44]], [1133, [-0.06, 1.0, 0.44], "hold"], [1137, c.hand("hip", "R").hand as V3, "ease"]]);
    const face = faceAt(st, 42, [[1100, FX.smug], [1134, FX.command], [1150, FX.smug], [1270, FX.smugGrin]]);
    this.show(c, { pos, yaw, lean: tn(st, [[1100, -3], [1133, -3, "hold"], [1137, 6, "ease"], [1215, 6, "hold"], [1220, -3, "ease"]]),
      head: { yaw: headYaw, pitch: -0.08 },
      armL: st >= 1220 ? { hand: hL, pole: c.hand("hip", "L").pole } : R(hL, st < 1133 ? [1, -0.6, -0.2] : [1, 0, -0.6]),
      armR: st < 1137 ? R(hR, [-1, -0.6, -0.2]) : c.hand("hip", "R"), face });
  }

  // ================= THE HERO (shots 5-6) =================
  private heroAct(st: number) {
    const c = this.hero, hh = c.hh;
    this.pitchBkt.visible = true;
    const mopInHand = st >= 559 && st < 601;
    this.mopStand.visible = !mopInHand;
    let pose: Pose;
    const props: Partial<Record<PropK, PropPose>> = {};
    const face = faceAt(st, 51, [[470, FX.determined], [490, FX.effort], [505, FX.effort], [511, FX.grimace], [530, FX.effort], [556, FX.determined],
      [564, FX.effort], [576, FX.tongue], [600, FX.determined], [646, FX.fierce], [668, FX.scream], [690, FX.laugh]]);
    if (st < 492) { // the run in from the street
      const w = pathWalk(st, [RUN_FROM, VAULT_A], 470, 492), sw = Math.sin(w.d * 3.5);
      pose = { pos: w.p, yaw: w.yaw, lean: 12, walk: { phase: w.d / 1.8, stride: 0.9, lift: 0.55 },
        armL: R([0.28, 1.2, 0.2 + 0.25 * sw], [1, -0.4, 0]), armR: R([-0.28, 1.2, 0.2 - 0.25 * sw], [-1, -0.4, 0]), face };
    } else if (st < 506) { // the vault over the pen's north wall (492-502), the landing + the step to the grab (502-506)
      const u = clamp01((st - 492) / 10), gp = lerp3(VAULT_A, VAULT_B, u);
      const grabAt: V3 = add3([PEN0[0], 0, PEN0[2]], mul3(fwdOf(yawTo(PEN0, CARRY_M)), -0.45));
      const p: V3 = st < 502 ? [gp[0], 0.95 * Math.sin(PI * u), gp[2]] : lerp3(VAULT_B, grabAt, hardEase((st - 502) / 4));
      const yaw = st < 502 ? yawTo(VAULT_A, VAULT_B) : tn(st, [[502, yawTo(VAULT_A, VAULT_B)], [505, yawTo(grabAt, PEN0), "ease"]]);
      const tuck = st < 502 ? Math.sin(PI * u) : tn(st, [[502, 0.6], [506, 0.35, "ease"]]);
      pose = { pos: p, yaw, crouch: tuck * 0.7, lean: 18 + 10 * tuck, feet: st < 502 ? { L: [0.1, 0.25 * tuck, 0.15], R: [-0.1, 0.3 * tuck, -0.05] } : undefined,
        armL: R([0.3, 1.25 + 0.3 * tuck, 0.4], [1, -0.3, 0]), armR: R([-0.3, 1.25 + 0.3 * tuck, 0.4], [-1, -0.3, 0]), face };
    } else if (st < 559) { // GRAB at F_RAID: hands on P0 (carryP0); the carry to the queue head; the set-down (552-558)
      const pig = carryP0(st), a = PEN0, m = CARRY_M, b = P0Q;
      const y1 = yawTo(a, m), y2 = yawTo(m, b);
      const yaw = tn(st, [[506, y1], [529, y1, "hold"], [532, y2, "ease"]]);
      const hp: V3 = [pig[0], 0, pig[2]];
      const pos = st < 552 ? add3(hp, mul3(fwdOf(yaw), -0.45)) : add3([b[0], 0, b[2]], mul3(fwdOf(y2), -0.45));
      const pr = c.toRoot([pig[0], pig[1] + 0.26, pig[2]], pos, yaw);
      const dist = st < 531 ? Math.hypot(pig[0] - a[0], pig[2] - a[2]) : Math.hypot(m[0] - a[0], m[2] - a[2]) + Math.hypot(pig[0] - m[0], pig[2] - m[2]);
      const walking = st > F_RAID + 4 && st < 551;
      const down = rampF(st, 552, 558);
      pose = { pos, yaw, lean: 4 + 26 * down, crouch: 0.75 * down + (st < 509 ? tn(st, [[506, 0.45], [509, 0, "ease"]]) : 0),
        walk: walking ? { phase: dist / 0.9, stride: 0.45, lift: 0.45 } : undefined,
        armL: R([pr[0] + 0.21, pr[1] - 0.04, pr[2] - 0.02], [1, -0.6, -0.2]), armR: R([pr[0] - 0.21, pr[1] - 0.04, pr[2] - 0.02], [-1, -0.6, -0.2]), face };
    } else if (st < 601) { // the long brush: grabbed from the bucket (559-561), wound, CONTACT on F_SMEAR, then strokes
      const from = add3([P0Q[0], 0, P0Q[2]], mul3(fwdOf(yawTo(CARRY_M, P0Q)), -0.45));
      const pos = st < 563 ? lerp3(from, HERO_Q, hardEase((st - 559) / 4)) : HERO_Q, yaw = HERO_Q_YAW;
      let tgtW = SMEAR_PT;
      if (st >= 575) {
        const k = Math.floor((st - 575) / 5), fr = (st - 575) / 5 - k, A = k % 2 ? STROKE_B : STROKE_A, B = k % 2 ? STROKE_A : STROKE_B;
        tgtW = st >= 598 ? STROKE_A : lerp3(A, B, hardEase((fr * 5) / 3));
      }
      const L = MOP_L * hh, G0: V3 = [-0.12, 1.05, 0.38], tgt = c.toRoot(tgtW, HERO_Q, yaw);
      const dC = nrm(sub3(tgt, G0)), hC = sub3(tgt, mul3(dC, L));
      const rest: V3 = [-0.1, 1.2, 0.3], ready: V3 = [-0.12, 1.32, 0.28], wound: V3 = [-0.18, 1.5, 0.08];
      const dRest = nrm([0.3, 1, 0.3]), dReady = nrm([0.45, 1, 0.3]), dWound = nrm([0.2, 1, -0.4]);
      const o = { raise: 2, wind: 2, held: 2, readyHold: 0, stay: 10, recover: 4 };
      let h = strikeTrack(st, F_SMEAR, rest, ready, wound, hC, o) as V3, d = nrm(strikeTrack(st, F_SMEAR, dRest, dReady, dWound, dC, o) as V3);
      if (st >= F_SMEAR) { h = hC; d = dC; }
      if (st >= 598) { const k = hardEase((st - 598) / 3), bk = c.toRoot([PITCH_BKT[0], 1.25, PITCH_BKT[2]], HERO_Q, yaw); h = lerp3(hC, bk, k); d = nrm(lerp3(dC, [0, -1, 0.1], k)); }
      props.mop = { dir: d, root: true };
      const contactK = st >= F_SMEAR ? 1 : 0;
      pose = { pos, yaw, lean: 6 + 14 * contactK, crouch: 0.12 * contactK, walk: st < 563 ? { phase: (st - 559) / 8, stride: 0.3 } : undefined,
        armR: R(h, [-1, -0.5, -0.3]), armL: R(add3(h, mul3(d, 0.42)), [1, -0.6, -0.2]), face, props };
    } else if (st < 649) { // the run to the brazier (603-619), grab a torch (619-623), back (623-645)
      const out = st < 621;
      const w = out ? pathWalk(st, BRZ_PATH, 603, 619) : pathWalk(st, [...BRZ_PATH].reverse(), 623, 645);
      const atBrz = st >= 619 && st < 623, yaw = atBrz ? yawTo(BRZ_STAND, BRAZIER) : st >= 645 ? tn(st, [[645, w.yaw], [648, HERO_Q_YAW, "ease"]]) : w.yaw;
      const reach = c.toRoot([BRAZIER[0], 1.1, BRAZIER[2]], BRZ_STAND, yawTo(BRZ_STAND, BRAZIER));
      const swing = Math.sin(w.d * 3.4);
      const hR: V3 = atBrz ? tv(st, [[619, [-0.25, 1.1, 0.3]], [621, reach, "ease"], [623, [-0.3, 1.45, 0.25], "ease"]]) : st >= 623 ? [-0.3, 1.5, 0.2] : [-0.28, 1.15, 0.2 - 0.25 * swing];
      if (st >= 621) props.torch = { dir: [0.05, 1, 0.1], root: true };
      pose = { pos: w.p, yaw, lean: w.moving ? 12 : 4, walk: w.moving ? { phase: w.d / 1.6, stride: 0.8, lift: 0.5 } : undefined,
        armR: R(hR, [-1, -0.4, -0.2]), armL: R([0.28, 1.15, 0.2 + 0.25 * swing], [1, -0.4, 0]), face, props };
    } else { // IGNITE: strike with the torch, CONTACT on F_IGNITE, then the leap back + duck (672-690), then cheer
      const yaw = HERO_Q_YAW, tgt = c.toRoot(IGNITE_PT, HERO_Q, yaw);
      const SH: V3 = [-0.13, 1.3, 0.1], dC = nrm(sub3(tgt, SH)), hC = sub3(tgt, mul3(dC, (TORCH_L + 0.08) * hh));
      const rest: V3 = [-0.3, 1.5, 0.2], ready: V3 = [-0.28, 1.75, 0.22], wound: V3 = [-0.42, 1.78, -0.08];
      const dRest: V3 = [0.05, 1, 0.1], dReady = nrm([0.1, 1, 0.25]), dWound = nrm([-0.25, 0.9, -0.45]);
      const o = { raise: 6, wind: 3, held: 6, readyHold: 2, stay: 4, recover: 4 };
      let h = strikeTrack(st, F_IGNITE, rest, ready, wound, hC, o) as V3, d = nrm(strikeTrack(st, F_IGNITE, dRest, dReady, dWound, dC, o) as V3);
      let pos = HERO_Q, lean = strikeTrack(st, F_IGNITE, 4, -2, -6, 24, o) as number, crouch = strikeTrack(st, F_IGNITE, 0, 0, 0.05, 0.15, o) as number;
      let armL: ArmPose = R([0.3, 1.1, 0.3], [1, -0.4, -0.2]);
      if (st >= 672) { // leap back (672-682), duck (682-690), up + cheer from 692
        const u = clamp01((st - 672) / 10), g = lerp3(HERO_Q, LEAP_TO, hardEase(u));
        pos = st < 682 ? [g[0], 0.4 * Math.sin(PI * u), g[2]] : LEAP_TO;
        crouch = st < 682 ? 0.3 : tn(st, [[682, 0.6], [690, 0.6, "hold"], [694, 0, "ease"]]);
        lean = st < 690 ? -6 : 0;
        h = st < 690 ? [-0.18, 1.85, 0.32] : tv(st, [[690, [-0.18, 1.85, 0.32]], [694, [-0.3, 2.05, 0.15], "ease"]]);
        d = st < 690 ? nrm([-0.5, 0.6, -0.3]) : [0, 1, 0.05];
        armL = R(st < 690 ? [0.2, 1.85, 0.34] : tv(st, [[690, [0.2, 1.85, 0.34]], [694, [0.32, 1.95, 0.15], "ease"]]), [1, -0.3, -0.2]);
      }
      props.torch = { dir: d, root: true };
      pose = { pos, yaw, lean, crouch, armR: R(h, [-1, -0.4, -0.2]), armL, face, head: { pitch: st >= 672 && st < 690 ? 0.25 : 0 }, props };
    }
    this.show(c, pose);
  }

  // ================= THE WRITER (shot 8): raised finger at "swore" (1036), then writes as the drawing appears =================
  private writerAct(st: number) {
    const c = this.writer, pos = WRITER_AT, yaw = 0, hh = c.hh;
    const crouch = 1.12, feet = { L: [0.11, 0.02, 0.42] as V3, R: [-0.11, 0.02, 0.4] as V3 };
    const nibAt = (u: number, wig: number): V3 => [SCROLL_AT[0] - 0.3 + 0.6 * u, SCROLL_AT[1] + 0.004, SCROLL_AT[2] + 0.05 * wig];
    const writing = st >= 1046 && st < 1090;
    const k = drawK(st), slot = Math.floor(st / 2), wig = writing ? Math.sin(slot * 1.7) : 0;
    const nib = writing ? nibAt(k, wig) : nibAt(st < 1046 ? 0 : 1, 0);
    const lift = writing ? 0.0 : st < 1046 ? 0.08 : tn(st, [[1090, 0.0], [1094, 0.12, "ease"]]);
    const dPen = nrm([0.12, 1, -0.35]);
    const nibR = c.toRoot([nib[0], nib[1] + lift, nib[2]], pos, yaw), hR = add3(nibR, mul3(dPen, PEN_L * hh));
    const DESK_L: V3 = [0.32, 0.86, 0.5], FINGER: V3 = [0.5, 1.42, 0.28];
    const hL = tv(st, [[1000, DESK_L], [1031, DESK_L, "hold"], [1035, FINGER, "ease"], [1043, FINGER, "hold"], [1047, DESK_L, "ease"]]);
    const face = faceAt(st, 61, [[1000, FX.ponder], [1033, FX.proclaim], [1045, FX.tongue], [1089, FX.pleased]]);
    const pitch = tn(st, [[1000, 0.18], [1031, 0.18, "hold"], [1035, -0.12, "ease"], [1043, -0.12, "hold"], [1047, 0.38, "ease"], [1089, 0.38, "hold"], [1093, 0.05, "ease"]]);
    this.show(c, { pos, yaw, crouch, feet, lean: tn(st, [[1000, 8], [1031, 8, "hold"], [1035, -2, "ease"], [1043, -2, "hold"], [1047, 16, "ease"], [1089, 16, "hold"], [1093, 4, "ease"]]),
      head: { pitch, roll: st >= 1033 && st < 1044 ? 0.06 : 0 }, armR: R(hR, [-1, -0.5, -0.4]), armL: R(hL, [1, -0.6, -0.3]), face,
      props: { pen: { dir: dPen, root: true } } });
  }

  // ================= THE TRAINERS (shot 9): carry piglets in (CARRY), set them down (~1194), crouch + pat =================
  private trainersAct(st: number) {
    for (let k = 0; k < 2; k++) {
      const c = this.trainers[k], T = TRAINERS[k], fwd = nrm([T.to[0] - T.from[0], 0, T.to[2] - T.from[2]]), yaw = Math.atan2(fwd[0], fwd[2]);
      const pig = pigletAt(T.piglet, st), carried = pig.carried;
      const L = Math.hypot(T.to[0] - T.from[0], T.to[2] - T.from[2]), u = linF(st, CARRY[0], CARRY[1]);
      const pos: V3 = carried ? [pig.pos[0] - fwd[0] * 0.42, 0, pig.pos[2] - fwd[2] * 0.42] : [T.to[0] - fwd[0] * 0.5, 0, T.to[2] - fwd[2] * 0.5];
      const walking = st > CARRY[0] && st < CARRY[1];
      const stride = k ? 1.1 : 0.9;
      const face = faceAt(st, 70 + k, [[1100, FX.neutral], [1138 + k, FX.determined], [1196 + k, k ? FX.happy : FX.blush]]);
      if (carried) {
        const pr = c.toRoot([pig.pos[0], pig.pos[1] + 0.12, pig.pos[2]], pos, yaw);
        const nod = st >= 1138 && st < 1144 ? 0.3 : 0;
        this.show(c, { pos, yaw, walk: walking ? { phase: (u * L) / (2 * stride), stride, lift: 0.5 } : undefined, lean: walking ? 8 : 2,
          crouch: tn(st, [[1180, 0], [1188, 0, "hold"], [1193, 0.5, "ease"]]),
          head: { pitch: nod, yaw: st < 1138 ? -0.5 + k * 0.2 : 0 },
          armL: R([pr[0] + 0.15, pr[1] - 0.02, pr[2]], [1, -0.6, -0.2]), armR: R([pr[0] - 0.15, pr[1] - 0.02, pr[2]], [-1, -0.6, -0.2]), face });
      } else { // steps round to the piglet's camera side (north of it, facing south), crouches, pats its back on fives
        const camP = camStatic(9, 1215).pos, toCam = nrm([camP[0] - T.to[0], 0, camP[2] - T.to[2]]);
        const side: V3 = [T.to[0] - toCam[0] * 0.55 + toCam[2] * 0.25 * (k ? 1 : -1), 0, T.to[2] - toCam[2] * 0.55 - toCam[0] * 0.25 * (k ? 1 : -1)];
        const go = hardEase((st - 1194) / 6), p2 = lerp3(pos, side, go), y2 = midYaw(yaw, yawTo(side, T.to), go);
        const top = c.toRoot([T.to[0], 0.36, T.to[2]], p2, y2), n = Math.floor((st - 1202) / 5), up = st >= 1202 && n % 2 === 0;
        this.show(c, { pos: p2, yaw: y2, crouch: 0.4 + 0.6 * go, lean: 8 + 16 * go, head: { pitch: 0.15 }, walk: go < 1 ? { phase: go * 0.5, stride: 0.4 } : undefined,
          armR: R([top[0] - 0.02, top[1] + (up ? 0.14 : 0.02), top[2]], [-1, -0.6, -0.2]), armL: R([0.3, 0.9, 0.35], [1, -0.6, -0.2]), face });
      }
    }
  }

  // ================= THE ROMAN (shot 10, Edessa) =================
  private romanAct(st: number) {
    const c = this.roman, pos = ROMAN_AT, yaw = 0, hh = c.hh;
    this.waterBkt.visible = true;
    const props: Partial<Record<PropK, PropPose>> = {};
    const bk = c.toRoot([WATER_BKT[0], WATER_BKT[1] + 0.3, WATER_BKT[2]], pos, yaw);
    const UP: V3 = [-0.34, 1.78, 0.28], HIP_L = c.hand("hip", "L");
    const face = faceAt(st, 81, [[1290, FX.determined], [1441, FX.smirk], [1459, FX.bored], [1466, FX.smugBrow], [1479, FX.happy], [1508, FX.effort],
      [1559, FX.neutral], [F_SQUEAL_ED - 2, FX.laughCry]]);
    let armL: ArmPose = HIP_L, armR: ArmPose = R(UP, [-1, -0.4, -0.2]), lean = 0, head: Pose["head"] = { pitch: 0 };
    if (st < 1466) { // the lit torch held up; at "light" (1458) it is dunked head-first into the bucket (contact 1458), lifted out dead
      const DUNK: V3 = [bk[0], bk[1] + (TORCH_L + 0.05) * hh, bk[2]];
      const h = strikeTrack(st, 1458, UP, [-0.36, 1.86, 0.24] as V3, [-0.5, 1.6, 0.2] as V3, DUNK, { raise: 4, wind: 3, held: 4, readyHold: 2, stay: 5, recover: 3 }) as V3;
      const dunked = st >= 1458;
      armR = R(st >= 1463 ? tv(st, [[1463, DUNK], [1466, [-0.4, 1.3, 0.3], "ease"]]) : h, [-1, -0.4, -0.2]);
      if (!dunked) props.torch = { dir: [0.05, 1, 0.12], root: true }; else props.torch0 = { dir: [0, -1, 0.05], root: true };
      lean = dunked && st < 1463 ? 14 : 0;
      head = { pitch: dunked ? 0.3 : 0.05, yaw: dunked ? -0.3 : 0 };
    } else if (st < 1478) { // the shrug (no torch)
      const k = hardEase((st - 1466) / 4);
      armL = R(lerp3(HIP_L.hand as V3, [0.55, 1.42, 0.32], k), [1, -0.6, -0.2]); armR = R(lerp3([-0.4, 1.3, 0.3], [-0.55, 1.42, 0.32], k), [-1, -0.6, -0.2]);
      head = { roll: 0.16 * k, pitch: -0.05 };
    } else if (st < 1508) { // hands on the pig (pigEdessa held 1480-1500), then the toss onto the hook (1500-1506)
      const pig = pigEdessa(Math.min(st, 1499.9)).pos, pr = c.toRoot([pig[0], pig[1] + 0.2, pig[2]], pos, yaw);
      const toss = rampF(st, 1500, 1504), out: V3 = [pr[0], pr[1] + 0.35, pr[2] + 0.35];
      const hp = lerp3(pr, out, toss), reach = st < 1480 ? hardEase((st - 1478) / 2) : 1;
      armL = R(lerp3([0.55, 1.42, 0.32], [hp[0] + 0.21, hp[1], hp[2]], reach), [1, -0.6, -0.2]); armR = R(lerp3([-0.55, 1.42, 0.32], [hp[0] - 0.21, hp[1], hp[2]], reach), [-1, -0.6, -0.2]);
      lean = 6 + 10 * toss; head = { pitch: 0.12 };
    } else { // pays out the rope hand over hand at the beam (1508-1558), then leans over the parapet + grins at the squeal
      const rp = c.toRoot(ROPE_HAND, pos, yaw), paying = st < 1558;
      const n = Math.floor((st - 1508) / 5), a: V3 = rp, b: V3 = [rp[0] + 0.08, rp[1] - 0.12, rp[2] - 0.24];
      const hA = paying ? (n % 2 ? b : a) : a, hB = paying ? (n % 2 ? a : b) : b;
      armR = R(hA, [-1, -0.4, -0.3]); armL = R([hB[0] + 0.12, hB[1], hB[2]], [1, -0.5, -0.3]);
      props.rope = { dir: nrm([0.1, 0.2, 1]), root: true };
      const over = rampF(st, 1561, 1567);
      lean = paying ? -8 : -8 + 30 * over;
      head = { pitch: paying ? 0.15 : 0.15 + 0.4 * over, yaw: paying ? -0.35 : -0.2 };
      if (st >= 1618) armL = R(tv(st, [[1618, [hB[0] + 0.12, hB[1], hB[2]]], [1622, [0.3, 2.05, 0.18], "ease"]]), [1, -0.3, -0.2]);
    }
    this.show(c, { pos, yaw, lean, head, armL, armR, face, props });
  }
}
