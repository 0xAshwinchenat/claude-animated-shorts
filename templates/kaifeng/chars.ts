// CAST RIG (owner: the "char" agent): the 3D toon cast (toon3d.ts): Subutai, Mongol crewmen, Jin defenders, the
// starving defender, the cowhide-tent diggers, Cui Li at the gate; posed per frame from story beats (pose-to-pose,
// dead-still holds, 3-5 f attacks, strikeTrack contacts on the story's hit frames, an expression swap on most lines
// 0-3 f before the word, each swap hidden in a blink). update() is a pure function of (sid, f); f may be fractional.
import * as THREE from "three";
import { Toon3D, TOON3D, EXPR, blink, track, exprTrack, strikeTrack, WALK_CYCLE, type Expr, type V3, type ArmPose, type PropPose, type PropK, type Pose } from "./toon3d";
import {
  SHOTS, SUB_AT, SUB_YAW0, SUB_PEACE, SUB_POKE, POKE_DENT, LESSON_SUB, PLATE_HIT, PILLOW_TOP, pillowDentK, AMMO_AT, SUB_GATE, CUI_AT, MILL_AT, F_SMASH, F_PLATE, F_PUNCH,
  TOWER_HERO, DEF_TB, DEF_FIRE, BOMB_Z, WALL_H, TENTS, tentK, BOOM_F, FOOD_AT, lerp3, doorDeg, GATE, GATE_W, MILL_TREB, battTreb, BATTERIES,
} from "./story";

// ---------------------------------------------------------------- staging constants (world metres)
const PI = Math.PI, WEST = -PI / 2, EAST = PI / 2;
const Y = WALL_H;
/** shot 5: the empty ammo spot by the NE battery's front trebuchet + where crewmen A and B stand */
export const AMMO: V3 = AMMO_AT;
/** the night camera looks in from here (toward the millstone, north-west): the crew stands so their faces read 3/4 */
const CAM5: V3 = [114, 3, -57.5];
const c5 = (o: V3): V3 => { const dx = CAM5[0] - o[0], dz = CAM5[2] - o[2], l = Math.hypot(dx, dz); return [dx / l, 0, dz / l]; };
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const rot2 = (v: V3, a: number, d: number): V3 => [(v[0] * Math.cos(a) - v[2] * Math.sin(a)) * d, 0, (v[0] * Math.sin(a) + v[2] * Math.cos(a)) * d];
/** A peers into AMMO_AT from its far side, rotated off the camera -> millstone line */
const CREW_A: V3 = plus(AMMO_AT, rot2(c5(AMMO_AT).map((v) => -v) as V3, -0.7, 0.85));
/** B smashes the millstone from its far (north-west) side, facing it + the camera 3/4 */
const CREW_B: V3 = plus(MILL_AT, rot2(c5(MILL_AT).map((v) => -v) as V3, 0.6, 1.05));
/** A's toss spot: screen-left of the millstone (clear of the lens line) */
const A_TOSS: V3 = (() => { const fw = c5(MILL_AT).map((v) => -v) as V3, rt: V3 = [-fw[2], 0, fw[0]]; return [MILL_AT[0] - rt[0] * 1.0 - fw[0] * 0.1, 0, MILL_AT[2] - rt[2] * 1.0 - fw[2] * 0.1]; })();
/** top centre of the whole millstone (the sledgehammer head lands here on F_SMASH) */
export const MILL_TOP: V3 = [MILL_AT[0], 0.32, MILL_AT[2]];
/** shot 7: TOWER_HERO's south-east post (dung slaps), the straw drop, the felt throw */
export const DUNG_POST: V3 = [TOWER_HERO[0] + 2.25, Y + 1.15, TOWER_HERO[2] + 2.35];
const D1_AT: V3 = [55.45, Y, -45.05], D2_FROM: V3 = [51.2, Y, -44.2], D2_TO: V3 = [53.0, Y, -44.35], D3_AT: V3 = [51.1, Y, -43.05];
/** shot 8: where D4 sets the garden rock into DEF_TB's sling (west of the pivot), D5 on the rope (east) */
export const LOAD: V3 = [DEF_TB[0] - 2.6, Y + 0.35, DEF_TB[2]];
const D4_FROM: V3 = [51.35, Y, -38.2], D4_AT: V3 = [51.3, Y, -36.6], D5_AT: V3 = [55.6, Y, -36.4];
/** shot 9: the chain winch on the walkway at BOMB_Z (D6 cranks it, axle along z, hub at WINCH) */
export const WINCH: V3 = [55.5, Y + 0.95, BOMB_Z + 0.1];
const D6_AT: V3 = [54.55, Y, BOMB_Z - 0.45];
/** shot 11: cheering defenders by the parapet either side of the gate tower */
const CHEER: V3[] = [[56.0, Y, -11.2], [55.9, Y, -9.5], [55.9, Y, 9.5], [56.0, Y, 11.2]];
/** shot 12: the starving defender (holds his own small jar) */
const HUNGRY_AT: V3 = [FOOD_AT[0] + 1.05, 0, FOOD_AT[2] + 0.75];
/** shot 13: SUB_POKE is 1.85 m from the face at the dent's height (out of arm reach): he stands side-on to the wall
 *  here, facing south (3/4 to the shot-13 camera), the dent at his right hand */
export const SUB_POKE_STAND: V3 = SUB_POKE;
/** shot 16: the pillow is 0.93 m in front of LESSON_SUB: he leans over the table from 0.2 m closer */
const LESSON_PUNCH: V3 = [LESSON_SUB[0], 0, LESSON_SUB[2] + 0.2];
/** shot 18: Subutai's strut (m per frame) from SUB_GATE westward from frame 1984 */
const GATE_WALK0 = 1984, GATE_SPEED = 0.0635;
/** shot 5: the toss direction from the smash site toward MILL_TREB's resting sling (behind the trebuchet, away from its corner) */
const TOSS_DIR: V3 = (() => {
  const B = BATTERIES[0], t = battTreb(0, MILL_TREB), ux = B.corner[0] - B.c[0], uz = B.corner[2] - B.c[2], ul = Math.hypot(ux, uz);
  const sling: V3 = [t[0] - (ux / ul) * 4, 0, t[2] - (uz / ul) * 4];
  const dx = sling[0] - MILL_AT[0], dz = sling[2] - MILL_AT[2], l = Math.hypot(dx, dz) || 1;
  return [dx / l, 0, dz / l];
})();

// ---------------------------------------------------------------- tiny helpers
type Ez = "hold" | "snap" | "ease" | "linear";
const FI = (f: number) => Math.floor(f + 1e-6);
const smooth01 = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
const tv = (f: number, keys: [number, V3, Ez?][]): V3 => track(f, keys.map(([k, v, e]) => ({ f: k, v: v as number[], ease: e }))) as V3;
const tn = (f: number, keys: [number, number, Ez?][]): number => track(f, keys.map(([k, v, e]) => ({ f: k, v, ease: e })));
/** expression track on ones + blinks (a blink across every swap) */
const faceAt = (f: number, seed: number, keys: [number, Expr][]): Expr => { const fi = FI(f), x = exprTrack(fi, keys); return blink(fi, seed, x.e, x.swaps); };
const R = (hand: V3, pole?: V3): ArmPose => ({ hand, pole, root: true });
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const nrm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const X = (e: Partial<Expr> & Pick<Expr, "eyes" | "brows" | "mouth">): Expr => e as Expr;
// expressions used by the cast
const FX = {
  bellow: X({ eyes: "angry", brows: "angry", mouth: "open" }),
  fierce: X({ eyes: "lid", brows: "angry", mouth: "teeth" }),
  proud: X({ eyes: "happy", brows: "up", mouth: "grin" }),
  pointy: X({ eyes: "dot", brows: "angry", mouth: "open" }),
  grudge: X({ eyes: "lid", brows: "angry", mouth: "frown" }),
  forced: X({ eyes: "lid", brows: "angry", mouth: "teeth" }),
  puzzled: X({ eyes: "dot", brows: "raised1", mouth: "small" }),
  puzzled2: X({ eyes: "dot", brows: "worried", mouth: "frown" }),
  shrug: X({ eyes: "dot", brows: "up", mouth: "flat" }),
  effort: X({ eyes: "squint", brows: "angry", mouth: "grit" }),
  sad: X({ eyes: "dot", brows: "worried", mouth: "frown" }),
  scared: X({ eyes: "ring", brows: "up", mouth: "open" }),
  soot: X({ eyes: "ring", brows: "none", mouth: "flat" }),
  annoyed: X({ eyes: "lid", brows: "angry", mouth: "flat" }),
  surprised: X({ eyes: "dot", brows: "up", mouth: "o" }),
  nervous: X({ eyes: "dot", brows: "worried", mouth: "small" }),
  fawn: X({ eyes: "happy", brows: "up", mouth: "grin", blush: true }),
};

// ---------------------------------------------------------------- the cast
const MONGOL = (deel: string, trim: string, sash: string) => ({ shirt: deel, robe: deel, robeLen: 0.5, trim, closure: "diag" as const, sash });
const JIN = (robe: string) => ({ shirt: robe, robe, robeLen: 0.42, lamellar: "#7f7b72", trim: "#3a2a20", belt: "#3a2a20", buckle: "#c9a24a" });
const JIN_ROBES = ["#b23a2e", "#9a2f3a", "#c0562e", "#a8402a", "#8f3530", "#b8482e"];
const DEF_PROPS: { k: PropK; hand: "L" | "R" }[] = [{ k: "patty", hand: "L" }, { k: "straw", hand: "R" }, { k: "felt", hand: "R" }, { k: "rock", hand: "R" }, { k: "jar", hand: "R" }, { k: "grain", hand: "L" }];
const SOOT_HEAD = "#4a4550";

export class CastRig {
  group = new THREE.Group();
  sub: Toon3D; crewA: Toon3D; crewB: Toon3D; defs: Toon3D[]; diggers: Toon3D[]; sooty: Toon3D[]; cui: Toon3D;
  private all: Toon3D[];
  constructor(root: THREE.Group) {
    root.add(this.group);
    this.sub = new Toon3D({ build: "stout", scale: 1.3, outfit: MONGOL("#2f5fa8", "#e8c45a", "#c8442e"), hat: { k: "mongol", col: "#b8382e", fur: "#8a5c36", knob: "#e8c45a" },
      beard: { col: "#2a1d16", droop: true, goatee: true }, props: [{ k: "baton", hand: "R" }, { k: "scroll", hand: "L" }, { k: "hammer", hand: "R" }] });
    this.crewA = new Toon3D({ build: "adult", scale: 1.25, outfit: MONGOL("#b0763a", "#5a3a20", "#3a5a7a"), hat: { k: "mongol", col: "#3a6a8a", fur: "#6a4a2a", knob: "#c8442e" } });
    this.crewB = new Toon3D({ build: "stout", scale: 1.25, outfit: MONGOL("#4f8a86", "#2a4a48", "#c88a3a"), hat: { k: "mongol", col: "#8a3a2a", fur: "#5a4030", knob: "#e8c45a" },
      props: [{ k: "sledge", hand: "R" }] });
    this.defs = JIN_ROBES.map((c, i) => new Toon3D({ build: i === 4 ? "slim" : "adult", scale: 1.25, outfit: JIN(c), hat: { k: "jinhelm", col: i % 2 ? "#7d8794" : "#8d96a3" }, props: DEF_PROPS }));
    const DIG = ["#7a5a3a", "#8a6a44", "#6a5a48", "#7a6040", "#8a5a3a", "#6f5a40"];
    this.diggers = DIG.map((c, i) => new Toon3D({ build: "adult", scale: 1.25, outfit: MONGOL(c, "#3a2a1a", "#5a4a3a"), hat: { k: "mongol", col: i % 2 ? "#5a6a72" : "#6a5a52", fur: "#4a3a2a" } }));
    this.sooty = [0, 1].map((i) => new Toon3D({ build: "adult", scale: 1.25, outfit: MONGOL(["#4a3a2a", "#54402c"][i], "#2a2018", "#3a3028"), hat: { k: "frizz", col: "#2a2228" }, head: SOOT_HEAD }));
    this.cui = new Toon3D({ build: "slim", scale: 1.25, outfit: { shirt: "#6a3a8a", robe: "#6a3a8a", robeLen: 0.86, closure: "round", trim: "#2a1b26", belt: "#e8c45a", buckle: "#7fc0a0" },
      hat: { k: "futou" }, beard: { col: "#2a1d16", goatee: true } });
    this.all = [this.sub, this.crewA, this.crewB, ...this.defs, ...this.diggers, ...this.sooty, this.cui];
    for (const c of this.all) this.group.add(c.root);
  }

  update(sid: number, f: number, _cam: THREE.PerspectiveCamera, sun: THREE.Vector3) {
    TOON3D.uSunW.value.copy(sun);   // world.ts sets it too: keep both the same (direction TOWARD the sun)
    const s = SHOTS[sid - 1];
    this.group.visible = s.set === "kaifeng" || s.set === "lesson";
    for (const c of this.all) c.root.visible = false;
    if (sid <= 4) this.subHook(f);
    else if (sid === 5) this.crew(f);
    else if (sid === 7 || sid === 8) { this.padders(f); this.loaders(f); }
    else if (sid === 9 || sid === 10) { this.diggersAct(f); this.winch(f); }
    else if (sid === 11) { this.subPeace(f); this.cheer(f); }
    else if (sid === 12) this.hungry(f);
    else if (sid === 13) this.subPoke(f);
    else if (sid === 14) this.subPlate(f);
    else if (sid === 16) this.subPunch(f);
    else if (sid === 18) { this.subGate(f); this.cuiLi(f); }
  }

  private show(c: Toon3D, p: Pose) { c.root.visible = true; c.pose(p); }

  // ================= SUBUTAI: frame 0 .. 500 (shots 1-4) =================
  private subHook(f: number) {
    const c = this.sub;
    const yaw = tn(f, [[0, SUB_YAW0], [96, SUB_YAW0], [99, WEST, "ease"]]);
    const face = faceAt(f, 11, [[0, FX.bellow], [18, FX.fierce], [56, EXPR.smug], [82, FX.proud], [97, FX.pointy], [168, EXPR.smug]]);
    // right hand + baton (root space): raised (frame 0, mid-action), creeps to WOUND, CHOP on 18 (no in-between),
    // rests, then a proud cross-chest hold, the point at the wall (100), back to proud
    const RAISED: V3 = [-0.42, 1.9, 0.06], WOUND: V3 = [-0.47, 1.96, -0.1], CHOP: V3 = [-0.6, 1.1, 0.34], REST: V3 = [-0.36, 0.78, 0.18];
    const PROUD: V3 = [-0.12, 1.05, 0.44], POINT: V3 = [-0.2, 1.56, 0.62];
    const hR = tv(f, [[0, RAISED], [12, WOUND, "ease"], [17, WOUND, "hold"], [18, CHOP, "snap"], [30, CHOP, "hold"], [35, REST, "ease"],
      [52, REST, "hold"], [56, PROUD, "ease"], [95, PROUD, "hold"], [99, POINT, "ease"], [164, POINT, "hold"], [169, PROUD, "ease"]]);
    const dR = tv(f, [[0, [-0.15, 0.9, -0.4]], [12, [-0.3, 0.72, -0.62], "ease"], [17, [-0.3, 0.72, -0.62], "hold"], [18, [-0.6, -0.42, 0.68], "snap"],
      [30, [-0.6, -0.42, 0.68], "hold"], [35, [0.05, -0.55, 0.83], "ease"], [52, [0.05, -0.55, 0.83], "hold"], [56, [0.75, 0.65, 0.1], "ease"],
      [95, [0.75, 0.65, 0.1], "hold"], [99, [0.04, 0.3, 0.95], "ease"], [164, [0.04, 0.3, 0.95], "hold"], [169, [0.75, 0.65, 0.1], "ease"]]);
    // left hand: points at the rope crew behind the lens while bellowing, then a fist on the hip
    const CUP: V3 = [0.62, 1.42, 0.38], HIP = c.hand("hip", "L");
    const hL = tv(f, [[0, CUP], [18, CUP, "hold"], [22, HIP.hand as V3, "ease"]]);
    const lean = tn(f, [[0, 6], [17, 4, "ease"], [18, 10, "snap"], [30, 10, "hold"], [35, 0, "ease"], [52, 0, "hold"], [56, -5, "ease"], [95, -5, "hold"], [99, 4, "ease"], [164, 4, "hold"], [169, -3, "ease"]]);
    const pitch = tn(f, [[0, -0.06], [52, -0.06, "hold"], [56, -0.16, "ease"], [95, -0.16, "hold"], [99, -0.14, "ease"], [164, -0.14, "hold"], [169, -0.08, "ease"]]);
    this.show(c, { pos: SUB_AT, yaw, lean, head: { pitch, roll: f >= 56 && f < 96 ? 0.06 : 0 },
      armR: R(hR, [-1, -0.3, -0.3]), armL: f < 20 ? R(hL, [1, -0.6, -0.2]) : { hand: hL, pole: HIP.pole }, face,
      props: { baton: { dir: dR, root: true } } });
  }

  // ================= shot 5: the crewmen at the NE battery (night) =================
  private crew(f: number) {
    const A = this.crewA, B = this.crewB;
    // A: peers into the empty ammo spot (526-543), shrugs (544), hurries to the smash site (550-568), then both heave-TOSS
    // the two wedges toward MILL_TREB's sling (hands on them as they leave the ground at 572, release by 580), and watch
    const yA = yawTo(CREW_A, AMMO);
    const B_AT = CREW_B;
    const aFace = faceAt(f, 21, [[500, EXPR.neutral], [524, X({ eyes: "dot", brows: "flat", mouth: "small" })], [543, FX.shrug], [556, FX.surprised], [569, FX.effort], [581, EXPR.happy]]);
    const PEER_L: V3 = [0.2, 0.78, 0.36], PEER_R: V3 = [-0.2, 0.78, 0.36], SHRUG_L: V3 = [0.5, 1.08, 0.32], SHRUG_R: V3 = [-0.5, 1.08, 0.32];
    const go = smooth01((f - 550) / 18), aPos = lerp3(CREW_A, A_TOSS, go);
    const aWalk = f >= 550 && f < 568 ? { phase: (Math.hypot(A_TOSS[0] - CREW_A[0], A_TOSS[2] - CREW_A[2]) * go) / 1.2, stride: 0.6 } : undefined;
    const yToss = Math.atan2(TOSS_DIR[0], TOSS_DIR[2]);
    // the toss in each crewman's root space: hands low on a wedge (569-572), sweep up + forward along TOSS_DIR, release at 580
    const tossKeys = (c: Toon3D, pos: V3, yaw: number, side: number) => {
      const wedge = c.toRoot([MILL_AT[0] - TOSS_DIR[2] * 0.25 * side, 0.22, MILL_AT[2] + TOSS_DIR[0] * 0.25 * side], pos, yaw);
      const out = c.toRoot([MILL_AT[0] + TOSS_DIR[0] * 1.1 - TOSS_DIR[2] * 0.25 * side, 1.55, MILL_AT[2] + TOSS_DIR[2] * 1.1 + TOSS_DIR[0] * 0.25 * side], pos, yaw);
      return { wedge, out };
    };
    const tossHands = (t: { wedge: V3; out: V3 }, dx: number, f0: number): V3 => tv(f, [[f0, [t.wedge[0] + dx, t.wedge[1], t.wedge[2]]], [572, [t.wedge[0] + dx, t.wedge[1], t.wedge[2]], "hold"],
      [580, [t.out[0] + dx, t.out[1], t.out[2]], "ease"], [592, [t.out[0] + dx, t.out[1], t.out[2]], "hold"], [598, [dx * 1.6, 1.0, 0.3], "ease"]]);
    const tA = tossKeys(A, A_TOSS, yToss, 1);
    const downL = A.hand("down", "L").hand as V3, downR = A.hand("down", "R").hand as V3;
    const aL = f >= 566 ? tossHands(tA, 0.16, 569) : tv(f, [[500, downL], [522, downL, "hold"], [526, PEER_L, "ease"], [543, PEER_L, "hold"], [547, SHRUG_L, "ease"], [550, SHRUG_L, "hold"], [554, downL, "ease"]]);
    const aR = f >= 566 ? tossHands(tA, -0.16, 569) : tv(f, [[500, downR], [522, downR, "hold"], [526, PEER_R, "ease"], [543, PEER_R, "hold"], [547, SHRUG_R, "ease"], [550, SHRUG_R, "hold"], [554, downR, "ease"]]);
    const aYaw = f < 548 ? yA : tn(f, [[548, yA], [551, yawTo(CREW_A, A_TOSS), "ease"], [566, yawTo(CREW_A, A_TOSS), "hold"], [569, yToss, "ease"]]);
    const tossCrouch = (f0: number) => tn(f, [[f0, 0], [569, 0.6, "ease"], [572, 0.6, "hold"], [580, 0, "ease"]]);
    const tossLean = (f0: number) => tn(f, [[f0, 0], [569, 34, "ease"], [572, 34, "hold"], [580, -10, "ease"], [592, -10, "hold"], [598, -4, "ease"]]);
    const watch = { pitch: tn(f, [[580, 0], [592, -0.1, "ease"], [598, -0.35, "ease"]]), yaw: 0 };
    this.show(A, { pos: aPos, yaw: aYaw, walk: aWalk,
      crouch: f < 560 ? tn(f, [[500, 0], [522, 0, "hold"], [526, 0.3, "ease"], [543, 0.3, "hold"], [547, 0, "ease"]]) : tossCrouch(566),
      lean: f < 560 ? tn(f, [[500, 0], [522, 0, "hold"], [526, 28, "ease"], [543, 28, "hold"], [547, 0, "ease"]]) : tossLean(566),
      head: f < 580 ? { pitch: tn(f, [[500, 0], [522, 0, "hold"], [526, 0.42, "ease"], [543, 0.42, "hold"], [547, 0, "ease"]]), roll: f >= 545 && f < 550 ? 0.18 : 0 } : watch,
      armL: R(aL, [1, -0.4, -0.3]), armR: R(aR, [-1, -0.4, -0.3]), face: aFace });
    // B: sledgehammer CONTACT on F_SMASH: raise ~8 f, hold ready, wound 3 f, held ~6 f, contact, hold 8 f; lets go, tosses
    const yB = yawTo(B_AT, MILL_AT);
    const tgt = B.toRoot([MILL_TOP[0], MILL_TOP[1] + 0.12, MILL_TOP[2]], B_AT, yB), hd = 1.95 * B.hh;
    const hitDir = nrm([tgt[0] + 0.15, -0.72, 0.68]);
    const contact: V3 = [tgt[0] - hitDir[0] * hd, tgt[1] - hitDir[1] * hd, tgt[2] - hitDir[2] * hd];
    const rest: V3 = [-0.3, 0.92, 0.3], ready: V3 = [-0.32, 1.72, 0.0], wound: V3 = [-0.5, 1.62, -0.2];
    const dRest: V3 = [0.05, -0.55, 0.83], dReady: V3 = [-0.25, 0.85, -0.45], dWound: V3 = [-0.62, 0.42, -0.66];
    const hB = strikeTrack(f, F_SMASH, rest, ready, wound, contact, { stay: 8, recover: 6 }) as V3;
    const dB = strikeTrack(f, F_SMASH, dRest, dReady, dWound, hitDir, { stay: 8, recover: 6 }) as V3;
    const dn = nrm(dB), lowGrip: V3 = add3(hB, [dn[0] * 0.55 * B.hh, dn[1] * 0.55 * B.hh, dn[2] * 0.55 * B.hh]);
    const drop = f >= 568;   // lets go of the sledge, grabs the wedges
    const yBt = drop ? tn(f, [[568, yB], [571, yToss, "ease"]]) : yB;
    const tB = tossKeys(B, B_AT, yToss, -1);
    const bFace = faceAt(f, 23, [[500, EXPR.stern], [538, FX.effort], [F_SMASH, FX.fierce], [581, EXPR.happy]]);
    this.show(B, { pos: B_AT, yaw: yBt,
      lean: drop ? tossLean(568) : (strikeTrack(f, F_SMASH, 0, -5, -9, 14, { stay: 8, recover: 6 }) as number),
      crouch: drop ? tossCrouch(568) : (strikeTrack(f, F_SMASH, 0.05, 0, 0.05, 0.22, { stay: 8, recover: 6 }) as number),
      head: drop && f >= 580 ? watch : undefined,
      armR: R(drop ? tossHands(tB, -0.16, 568) : hB, [-1, -0.2, -0.3]), armL: R(drop ? tossHands(tB, 0.16, 568) : lowGrip, [1, -0.5, -0.2]), face: bFace,
      props: drop ? {} : { sledge: { dir: dB, root: true } } });
  }

  // ================= shot 7: padding TOWER_HERO (dung 835-846, straw 850-866, felt 866-886) =================
  private padders(f: number) {
    const [D1, D2, D3] = this.defs;
    // D1: three left-hand slaps on the post (contacts 835 / 840 / 846), a fresh patty before each
    const y1 = 1.04, post = D1.toRoot(DUNG_POST, D1_AT, y1);
    const SLAP: V3 = [post[0] - 0.08, post[1], post[2] + 0.02], COCK: V3 = [0.36, 1.28, 0.34], HOLD: V3 = [0.28, 1.02, 0.38];
    const h1 = tv(f, [[742, HOLD], [826, HOLD, "hold"], [830, COCK, "ease"], [834, COCK, "hold"], [835, SLAP, "snap"], [836, SLAP, "hold"], [838, COCK, "ease"],
      [839, COCK, "hold"], [840, SLAP, "snap"], [841, SLAP, "hold"], [843, COCK, "ease"], [845, COCK, "hold"], [846, SLAP, "snap"], [858, SLAP, "hold"], [863, D1.hand("down", "L").hand as V3, "ease"]]);
    const patty = f < 835 || (f >= 837 && f < 840) || (f >= 842 && f < 846);
    this.show(D1, { pos: D1_AT, yaw: y1, tilt: tn(f, [[742, 0], [830, 0, "hold"], [834, 3, "ease"], [835, -9, "snap"], [858, -9, "hold"], [863, 0, "ease"]]),
      armL: R(h1, [0.6, -1, -0.4]), armR: D1.hand("hip", "R"), face: faceAt(f, 31, [[742, EXPR.stern], [827, FX.effort], [848, EXPR.happy]]),
      props: patty ? { patty: { dir: [0.3, 0.2, 1], root: true } } : {} });
    // D2: carries a straw bundle in from the west (832-856), turns to the tower, sets it down (862), stands proud
    const go = Math.max(0, Math.min(1, (f - 832) / 24)), p2 = lerp3(D2_FROM, D2_TO, go);
    const w2 = f >= 832 && f < 856 ? { phase: (f - 832) / WALK_CYCLE, stride: (1.8 / 24) * WALK_CYCLE * 0.5 } : undefined;
    const y2 = tn(f, [[742, EAST], [855, EAST, "hold"], [858, PI, "ease"]]);
    const carry: V3 = [0, 1.02, 0.44], set: V3 = [0, 0.42, 0.62];
    const strawAt = tv(f, [[742, carry], [858, carry, "hold"], [862, set, "ease"]]);
    this.show(D2, { pos: p2, yaw: y2, walk: w2, crouch: tn(f, [[742, 0], [858, 0, "hold"], [862, 0.45, "ease"], [864, 0.45, "hold"], [868, 0, "ease"]]),
      lean: tn(f, [[742, 0], [858, 0, "hold"], [862, 26, "ease"], [864, 26, "hold"], [868, -3, "ease"]]),
      armL: f < 864 ? R(add3(strawAt, [0.3, -0.06, -0.04]), [1, -0.6, 0]) : D2.hand("hip", "L"), armR: f < 864 ? R(add3(strawAt, [-0.3, -0.06, -0.04]), [-1, -0.6, 0]) : D2.hand("hip", "R"),
      face: faceAt(f, 32, [[742, EXPR.neutral], [846, FX.effort], [865, EXPR.happy]]), props: f < 864 ? { straw: { at: strawAt } } : {} });
    // D3: lowers the folded felt (anticipation 862-866), throws it up onto the tower at 869, arms stay up
    const y3 = PI * 0.78;
    const target = D3.toRoot([TOWER_HERO[0] - 1.9, Y + 3.2, TOWER_HERO[2] + 2.4], D3_AT, y3);
    const fHold: V3 = [0, 0.98, 0.42], fLow: V3 = [0, 0.72, 0.46], fUp: V3 = [0.04, 2.25, 0.42];
    const feltAt = tv(f, [[742, fHold], [861, fHold, "hold"], [865, fLow, "ease"], [866, fLow, "hold"], [869, fUp, "ease"], [871, target, "linear"]]);
    const up = f >= 869;
    this.show(D3, { pos: D3_AT, yaw: y3, crouch: tn(f, [[742, 0], [861, 0, "hold"], [865, 0.3, "ease"], [866, 0.3, "hold"], [869, 0, "ease"]]),
      lean: tn(f, [[742, 0], [861, 0, "hold"], [865, 12, "ease"], [866, 12, "hold"], [869, -8, "ease"], [880, -8, "hold"], [885, 0, "ease"]]),
      armL: R(up ? tv(f, [[869, [0.28, 2.02, 0.3]], [880, [0.28, 2.02, 0.3], "hold"], [885, D3.hand("down", "L").hand as V3, "ease"]]) : add3(feltAt, [0.32, -0.05, -0.05]), [1, -0.5, -0.3]),
      armR: R(up ? tv(f, [[869, [-0.28, 2.02, 0.3]], [880, [-0.28, 2.02, 0.3], "hold"], [885, D3.hand("down", "R").hand as V3, "ease"]]) : add3(feltAt, [-0.32, -0.05, -0.05]), [-1, -0.5, -0.3]),
      face: faceAt(f, 33, [[742, EXPR.neutral], [861, FX.effort], [869, EXPR.happy]]), props: f < 871 ? { felt: { at: feltAt } } : {} });
  }

  // ================= shot 7-8: DEF_TB: D4 loads the garden rock (944), D5 yanks the rope (954-962, release DEF_FIRE) ==========
  private loaders(f: number) {
    const D4 = this.defs[3], D5 = this.defs[4];
    // D4 walks the rock south to the trebuchet (905-933), turns west (936), crouches and sets it into the sling (944)
    const go = Math.max(0, Math.min(1, (f - 905) / 28)), p4 = lerp3(D4_FROM, D4_AT, go);
    const w4 = f >= 905 && f < 933 ? { phase: (f - 905) / WALK_CYCLE, stride: (1.6 / 28) * WALK_CYCLE * 0.5 } : undefined;
    const y4 = tn(f, [[742, 0], [934, 0, "hold"], [937, WEST, "ease"]]);
    const load = D4.toRoot(LOAD, D4_AT, WEST);
    const rockCarry: V3 = [0, 1.0, 0.48];
    const rockAt = f < 937 ? rockCarry : tv(f, [[937, rockCarry], [944, [load[0], load[1] + 0.2, load[2]], "ease"]]);
    const rockVis = f < DEF_FIRE - 8;
    const hands = f < 950;
    this.show(D4, { pos: p4, yaw: y4, walk: w4, crouch: tn(f, [[742, 0], [937, 0, "hold"], [944, 0.5, "ease"], [950, 0.5, "hold"], [955, 0, "ease"]]),
      lean: tn(f, [[742, 0], [937, 0, "hold"], [944, 32, "ease"], [950, 32, "hold"], [955, -4, "ease"]]),
      armL: hands ? R(add3(rockAt, [0.36, -0.08, -0.06]), [1, -0.6, 0]) : D4.hand("hip", "L"), armR: hands ? R(add3(rockAt, [-0.36, -0.08, -0.06]), [-1, -0.6, 0]) : D4.hand("hip", "R"),
      face: faceAt(f, 34, [[742, EXPR.neutral], [905, FX.effort], [952, EXPR.happy]]), props: rockVis ? { rock: { at: rockAt } } : {} });
    // D5 on the rope: hands up on it, the yank (8 f hard ease into a deep lean-back), hold, recover with the beam
    const UP_L: V3 = [0.06, 2.0, 0.34], UP_R: V3 = [-0.06, 1.9, 0.36], PULL_L: V3 = [0.08, 1.12, 0.36], PULL_R: V3 = [-0.08, 1.02, 0.38];
    const k = tn(f, [[742, 0], [DEF_FIRE - 8, 0, "hold"], [DEF_FIRE, 1, "ease"], [DEF_FIRE + 16, 1, "hold"], [DEF_FIRE + 40, 0, "ease"]]);
    const mixV = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    this.show(D5, { pos: D5_AT, yaw: -0.25, lean: -20 * k, crouch: 0.3 * k, armL: R(mixV(UP_L, PULL_L), [1, -0.6, -0.2]), armR: R(mixV(UP_R, PULL_R), [-1, -0.6, -0.2]),
      face: faceAt(f, 35, [[742, EXPR.stern], [DEF_FIRE - 10, FX.effort], [DEF_FIRE + 4, EXPR.happy]]) });
  }

  // ================= shots 9-10: diggers under the cowhide shells; the sooty pair after BOOM_F =================
  private diggersAct(f: number) {
    const k = tentK(f);
    for (let i = 0; i < 3; i++) {
      const T = TENTS[i], dir = nrm([T.to[0] - T.from[0], 0, T.to[2] - T.from[2]]), yaw = Math.atan2(dir[0], dir[2]);
      const L = Math.hypot(T.to[0] - T.from[0], T.to[2] - T.from[2]), base = lerp3(T.from, T.to, k), d = k * L, S = 0.45;
      for (let j = 0; j < 2; j++) {
        const c = this.diggers[i * 2 + j];
        if (i === 0 && f >= BOOM_F) continue;
        const along = j ? -0.55 : 0.55, side = j ? 0.18 : -0.18;
        const pos: V3 = [base[0] + dir[0] * along - dir[2] * side, 0, base[2] + dir[2] * along + dir[0] * side];
        const moving = f > 985 && f < 1110;
        this.show(c, { pos, yaw, crouch: 0.85, lean: 30, walk: moving ? { phase: d / (2 * S) + j * 0.27 + i * 0.13, stride: S, lift: 0.3 } : undefined,
          armL: R([0.26, 1.02, 0.42], [1, -0.5, -0.2]), armR: R([-0.26, 1.02, 0.42], [-1, -0.5, -0.2]), face: EXPR.stern });
      }
    }
    if (f < BOOM_F) return;
    // the TENTS[0] pair: stand sooty and stiff (frizzled hair, dark face, white ring eyes), blink, then run east
    for (let j = 0; j < 2; j++) {
      const c = this.sooty[j], p0 = sootyAt(j, f), run = Math.max(0, f - 1150 - j * 2), x = p0[0];
      const fi = FI(f), shut = (fi >= 1141 + j && fi < 1144 + j) || (fi >= 1147 && fi < 1149);
      const e: Expr = run > 0 ? FX.scared : shut ? X({ eyes: fi === 1141 + j ? "half" : "closed", brows: "none", mouth: "flat" }) : FX.soot;
      const ph = run * 0.13 / (2 * 0.78);
      const swing = Math.sin(ph * PI * 2);
      this.show(c, { pos: [x, 0, p0[2]], yaw: EAST, headCol: SOOT_HEAD, lean: run > 0 ? 12 : 0,
        walk: run > 0 ? { phase: ph, stride: 0.78, lift: 0.5 } : undefined,
        armL: run > 0 ? R([0.3, 1.1 + 0.15 * swing, 0.3 * swing], [1, -0.5, 0]) : R([0.3, 0.72, 0.05], [1, 0, -0.3]),
        armR: run > 0 ? R([-0.3, 1.1 - 0.15 * swing, -0.3 * swing], [-1, -0.5, 0]) : R([-0.3, 0.72, 0.05], [-1, 0, -0.3]), face: e });
    }
  }

  // D6 cranks the chain winch (1062-1124), then peers over the parapet; BOOM_F knocks him back
  private winch(f: number) {
    const c = this.defs[5], yaw = EAST;
    const hub = c.toRoot(WINCH, D6_AT, yaw);
    const turns = Math.max(0, Math.min(1124, f) - 1062) / 16, a = -turns * PI * 2;
    const hp: V3 = [hub[0] + 0.0, hub[1] + 0.22 * Math.sin(a), hub[2] + 0.22 * Math.cos(a)];
    const crank = f < 1126;
    this.show(c, { pos: D6_AT, yaw, lean: f < 1126 ? 6 : f < BOOM_F ? 18 : -16, head: { pitch: f >= 1126 && f < BOOM_F ? 0.35 : 0 },
      armL: crank ? R([hp[0] + 0.08, hp[1], hp[2]], [1, -0.6, -0.2]) : R([0.3, 1.3, 0.45], [1, -0.6, 0]),
      armR: crank ? R([hp[0] - 0.08, hp[1], hp[2]], [-1, -0.6, -0.2]) : R([-0.3, 1.3, 0.45], [-1, -0.6, 0]),
      face: faceAt(f, 36, [[995, EXPR.stern], [1060, FX.effort], [1126, X({ eyes: "dot", brows: "flat", mouth: "small" })], [BOOM_F, FX.scared]]) });
  }

  // ================= shot 11: the peace offer (Subutai holds up the scroll toward the gate, grudging) =================
  private subPeace(f: number) {
    const c = this.sub, yaw = 2.79;   // faces NNE: 3/4 to the shot-11 camera, his LEFT side toward the gate
    const UP: V3 = [0.62, 1.78, 0.18];
    const hL = tv(f, [[1178, [0.6, 1.62, 0.2]], [1260, [0.6, 1.62, 0.2], "hold"], [1263, UP, "ease"]]);
    this.show(c, { pos: SUB_PEACE, yaw, lean: -2, head: { yaw: 0.28, pitch: -0.04 },
      armL: R(hL, [1, -0.5, -0.4]), armR: c.hand("hip", "R"),
      face: faceAt(f, 12, [[1178, FX.grudge], [1262, FX.forced]]),
      props: { scroll: { dir: [0, 1, 0], spin: PI / 2, root: true }, baton: { dir: [0.2, -0.6, -0.8], root: true } } });
  }
  private cheer(f: number) {
    for (let i = 0; i < 4; i++) {
      const c = this.defs[i], t0 = 1250 + i * 2, n = Math.floor(Math.max(0, f - t0) / 8), up = f >= t0;
      const hi = up && n % 2 === 0, hy = hi ? 2.1 : 1.85;
      this.show(c, { pos: CHEER[i], yaw: EAST + (i < 2 ? 0.25 : -0.25), bob: up ? (hi ? 0.06 : 0) : 0,
        armL: up ? R([0.36, hy, 0.12], [1, -0.4, -0.2]) : c.hand("down", "L"), armR: up ? R([-0.36, hy - (i % 2 ? 0.1 : 0), 0.12], [-1, -0.4, -0.2]) : c.hand("down", "R"),
        face: faceAt(f, 40 + i, [[1178, EXPR.neutral], [1248 + i, EXPR.happy]]) });
    }
  }

  // ================= shot 12: the starving defender: peers into his jar, tips it, one grain falls =================
  private hungry(f: number) {
    const c = this.defs[4], yaw = 1.35;
    const jarC: V3 = [0, 0.9, 0.5];
    const tip = tn(f, [[1292, 0], [1325, 0, "hold"], [1331, 1, "ease"]]);
    const ang = tip * PI * 0.92, dir: V3 = [0, Math.cos(ang), Math.sin(ang)];
    const lift = tn(f, [[1292, 0], [1325, 0, "hold"], [1331, 0.12, "ease"]]);
    const base: V3 = [jarC[0], jarC[1] + lift - dir[1] * 0.25, jarC[2] - dir[2] * 0.25];
    const mouth: V3 = [base[0] + dir[0] * 0.5, base[1] + dir[1] * 0.5, base[2] + dir[2] * 0.5];
    const palm: V3 = [0.06, 0.72, 0.55];
    // the grain: drops out of the mouth at 1338, lands in the open left palm at 1345
    const g = f < 1338 ? null : lerp3(mouth, [palm[0], palm[1] + 0.06, palm[2]], Math.min(1, ((f - 1338) / 7) ** 2));
    const jc = add3(base, [dir[0] * 0.25, dir[1] * 0.25, dir[2] * 0.25]);
    this.show(c, { pos: HUNGRY_AT, yaw, lean: tn(f, [[1292, 8], [1350, 8, "hold"], [1354, 14, "ease"]]),
      head: { pitch: tn(f, [[1292, 0.42], [1325, 0.42, "hold"], [1331, 0.18, "ease"], [1345, 0.3, "ease"], [1350, 0.3, "hold"], [1354, 0.4, "ease"]]), roll: f >= 1350 ? 0.12 : 0 },
      armR: R(f < 1328 ? add3(jc, [-0.3, -0.02, 0]) : add3(jc, [-0.08, 0.1, -0.2]), [-1, -0.6, -0.2]),
      armL: R(f < 1328 ? add3(jc, [0.3, -0.02, 0]) : palm, [1, -0.6, -0.3]),
      face: faceAt(f, 37, [[1292, FX.nervous], [1333, EXPR.neutral], [1346, FX.sad]]),
      props: { jar: { at: base, dir }, ...(g ? { grain: { at: g } } : {}) } as Partial<Record<PropK, PropPose>> });
  }

  // ================= shot 13: Subutai pokes the dent, then scratches his head =================
  private subPoke(f: number) {
    const c = this.sub, pos = SUB_POKE_STAND, yawPoke = 0, yawTurn = 0.6;
    const yaw = tn(f, [[1365, yawPoke], [1408, yawPoke, "hold"], [1411, yawTurn, "ease"]]), yawK = f < 1409 ? yawPoke : yawTurn;
    const dent = c.toRoot([POKE_DENT[0] + 0.04, POKE_DENT[1], POKE_DENT[2]], pos, yawPoke);
    const back: V3 = [dent[0] + 0.12, dent[1] - 0.05, dent[2] + 0.05];
    const DOWN = c.hand("down", "R").hand as V3, HEAD_L: V3 = [0.36, 1.98, 0.02], HEAD_L2: V3 = [0.34, 2.04, -0.02];
    const hR = tv(f, [[1365, DOWN], [1369, DOWN, "hold"], [1373, back, "ease"], [1376, back, "hold"], [1377, dent, "snap"], [1380, dent, "hold"], [1381, back, "snap"],
      [1383, back, "hold"], [1384, dent, "snap"], [1404, dent, "hold"], [1409, DOWN, "ease"]]);
    // scratch: two positions alternating on threes (pose-to-pose on ones, no smooth loop)
    const scratching = f >= 1414 && f < 1440, sc = Math.floor((f - 1414) / 3) % 2;
    const hL = scratching ? (sc ? HEAD_L2 : HEAD_L) : tv(f, [[1365, c.hand("down", "L").hand as V3], [1409, c.hand("down", "L").hand as V3, "hold"], [1414, HEAD_L, "ease"], [1440, HEAD_L, "hold"], [1446, c.hand("hip", "L").hand as V3, "ease"]]);
    void yawK;
    this.show(c, { pos, yaw, tilt: f < 1409 ? tn(f, [[1365, 0], [1373, -7, "ease"]]) : 0, lean: f < 1409 ? tn(f, [[1365, 0], [1373, 9, "ease"]]) : 0,
      head: { yaw: tn(f, [[1365, -0.45], [1408, -0.45, "hold"], [1411, 0, "ease"]]), roll: tn(f, [[1365, 0], [1410, 0, "hold"], [1414, -0.16, "ease"]]), pitch: -0.05 },
      armR: R(hR, [-1, -0.4, -0.3]), armL: R(hL, [1, -0.2, -0.6]),
      face: faceAt(f, 13, [[1365, EXPR.stern], [1376, { ...FX.puzzled, look: -1 }], [1414, FX.puzzled2], [1441, FX.puzzled]]) });
  }

  // ================= shots 14 / 16: the lesson: the hammer hits the plate (F_PLATE), the fist hits the pillow (F_PUNCH) ==
  private subPlate(f: number) {
    const c = this.sub, pos = LESSON_SUB, yaw = 0;
    const tgt = c.toRoot([PLATE_HIT[0], PLATE_HIT[1] + 0.11 * c.hh, PLATE_HIT[2]], pos, yaw), hd = 1.12 * c.hh;   // the head's underside on PLATE_HIT
    const hitDir = nrm([0.08, -0.8, 0.6]);
    const contact: V3 = [tgt[0] - hitDir[0] * hd, tgt[1] - hitDir[1] * hd, tgt[2] - hitDir[2] * hd];
    const rest: V3 = [-0.36, 1.02, 0.36], ready: V3 = [-0.42, 1.92, 0.12], wound: V3 = [-0.6, 1.86, -0.08];
    const h = strikeTrack(f, F_PLATE, rest, ready, wound, contact) as V3;
    const d = strikeTrack(f, F_PLATE, [0, 1, 0.15] as V3, [-0.15, 0.75, -0.62] as V3, [-0.55, 0.45, -0.7] as V3, hitDir) as V3;
    this.show(c, { pos, yaw, lean: strikeTrack(f, F_PLATE, 0, -4, -8, 12) as number, crouch: strikeTrack(f, F_PLATE, 0, 0, 0.03, 0.1) as number,
      armR: R(h, [-1, -0.2, -0.3]), armL: c.hand("hip", "L"),
      face: faceAt(f, 14, [[1458, EXPR.smug], [1540, FX.effort], [F_PLATE, FX.fierce], [1580, EXPR.smug]]),
      props: { hammer: { dir: d, root: true } } });
  }
  private subPunch(f: number) {
    const c = this.sub, pos = LESSON_PUNCH, yaw = 0;
    const tgt = c.toRoot([PILLOW_TOP[0], PILLOW_TOP[1] + c.B.handR * c.hh, PILLOW_TOP[2]], pos, yaw);   // the fist's underside on PILLOW_TOP
    const rest: V3 = [0.36, 1.12, 0.32], ready: V3 = [0.4, 1.5, 0.12], wound: V3 = [0.5, 1.42, -0.06];
    const h0 = strikeTrack(f, F_PUNCH, rest, ready, wound, tgt, { raise: 6, held: 5, stay: 12 }) as V3;
    const h: V3 = f >= F_PUNCH && f < F_PUNCH + 12 ? [h0[0], h0[1] - 0.085 * pillowDentK(f), h0[2]] : h0;
    this.show(c, { pos, yaw, lean: strikeTrack(f, F_PUNCH, 8, 4, 0, 34, { raise: 6, held: 5, stay: 12 }) as number,
      crouch: strikeTrack(f, F_PUNCH, 0, 0, 0, 0.12, { raise: 6, held: 5, stay: 12 }) as number,
      armL: R(h, [1, -0.3, -0.3]), armR: c.hand("hip", "R"),
      face: faceAt(f, 15, [[1772, EXPR.smug], [1781, FX.effort], [F_PUNCH, FX.surprised], [1801, EXPR.smug]]) });
  }

  // ================= shot 18: the ending: Subutai waits outside, struts in; Cui Li opens the north leaf, bows =================
  private subGate(f: number) {
    const c = this.sub, run = Math.max(0, f - GATE_WALK0), x = SUB_GATE[0] - run * GATE_SPEED;
    // foot tap during "A year later" (1946-1954): the right foot's toe lifts on threes
    const tap = f >= 1940 && f < 1960 && Math.floor((f - 1940) / 3) % 2 === 0;
    const hh = c.hh, fl: V3 = [c.B.hipX * hh * 0.9, 0.04 * hh, 0.02 * hh], fr: V3 = [-c.B.hipX * hh * 0.9, 0.04 * hh + (tap ? 0.07 : 0), 0.02 * hh + (tap ? 0.03 : 0)];
    const walking = run > 0;
    const SHOULDER: V3 = [-0.38, 0.9, 0.2];
    this.show(c, { pos: [x, 0, SUB_GATE[2]], yaw: WEST, lean: walking ? -2 : 0,
      walk: walking ? { phase: (run * GATE_SPEED) / (2 * (GATE_SPEED * WALK_CYCLE * 0.5)), stride: GATE_SPEED * WALK_CYCLE * 0.5, lift: 0.5 } : undefined,
      feet: walking ? undefined : { L: fl, R: fr },
      head: { yaw: tn(f, [[1920, 0], [2036, 0, "hold"], [2040, 0.38, "ease"]]), pitch: walking ? -0.08 : 0 },
      armL: c.hand("hip", "L"), armR: walking ? R(SHOULDER, [-1, -0.6, 0]) : c.hand("hip", "R"),
      face: faceAt(f, 16, [[1920, FX.annoyed], [1962, FX.surprised], [1979, EXPR.smug], [2038, X({ eyes: "lid", brows: "raised1", mouth: "smirk", look: 1 })]]),
      props: walking ? { baton: { dir: [-0.1, -0.35, 0.93], root: true } } : { baton: { dir: [0.1, -0.5, -0.85], root: true } } });
  }
  private cuiLi(f: number) {
    const c = this.cui;
    // the north leaf: hinged at (60, -3) on the outer face, its free edge swings inward: tip(th) = (60 - 3 sin th, -3 + 3 cos th)
    const th = (doorDeg(f) * PI) / 180, hx = GATE[0] - 0.5, L = GATE_W / 2, tip: V3 = [hx - L * Math.sin(th), 1.15, -L + L * Math.cos(th)];
    const pulling = f < 1984;
    const bodyPull: V3 = [tip[0] - 0.62, 0, tip[2] + 0.18];
    const pos: V3 = pulling ? bodyPull : lerp3(bodyPull, CUI_AT, Math.min(1, (f - 1984) / 8));
    const yawPull = yawTo(pos, [tip[0], 0, tip[2]]);
    const yaw = pulling ? yawPull : tn(f, [[1984, yawPull], [1992, 0.55, "ease"]]);
    const edge = c.toRoot(tip, pos, yaw);
    const walkBack = f >= 1962 && f < 1984 ? { phase: -(th / (PI / 2)) * 1.6, stride: 0.32 } : undefined;
    const BOW_R: V3 = [-0.1, 0.95, 0.4], SWEEP_R: V3 = [-0.62, 1.05, 0.34], BOW_L: V3 = [0.12, 0.95, 0.4];
    const after = f >= 1990;
    this.show(c, { pos, yaw, walk: walkBack,
      lean: after ? tn(f, [[1990, 0], [2002, 0, "hold"], [2006, 32, "ease"], [2016, 32, "hold"], [2021, 6, "ease"]]) : pulling && f >= 1962 ? -8 : 0,
      head: { pitch: after ? tn(f, [[1990, 0], [2002, 0, "hold"], [2006, 0.25, "ease"], [2016, 0.25, "hold"], [2021, 0, "ease"]]) : 0 },
      armR: after ? R(tv(f, [[1990, BOW_R], [2016, BOW_R, "hold"], [2022, SWEEP_R, "ease"]]), [-1, -0.4, -0.2]) : R([edge[0] - 0.05, edge[1], edge[2] - 0.05], [-1, -0.4, -0.3]),
      armL: after ? R(tv(f, [[1990, BOW_L], [2016, BOW_L, "hold"], [2022, c.hand("down", "L").hand as V3, "ease"]]), [1, -0.4, -0.2]) : R([edge[0] + 0.05, edge[1] + 0.05, edge[2] - 0.05], [1, -0.4, -0.3]),
      face: faceAt(f, 17, [[1920, FX.nervous], [1995, FX.fawn]]) });
  }
}

/** retired: the camp owner flies the two wedges into MILL_TREB's sling itself (the crew tosses them 572-580) */
export const crewPieceAt = (_f: number): V3 | null => null;

/** shots 10: feet position of sooty digger j (0, 1) at frame f (they run east from 1150) */
export const sootyAt = (j: number, f: number): V3 => [TENTS[0].to[0] + 0.1 + Math.max(0, f - 1150 - j * 2) * 0.13, 0, TENTS[0].to[2] + (j ? 0.55 : -0.55)];
