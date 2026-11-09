// "The Burning Pigs That Beat an Army of Elephants" (Megara, 266 BC + Edessa, 544 AD): our original ~55 s short.
// THE CONTRACT between all owners: world layout constants, story beats (frames, from the voice's words.json), the
// shared trajectories (every elephant, every pig, spears, arrows, the hanging pig), shots, camera paths (camrig flow),
// kicks, depth of field, retention markers.
// Voice: pigs-short/voice/data/narration.wav (54.76 s, Kokoro am_michael). Word frames: pigs-short/voice/data/words.txt.
// Axes: +x = EAST, -z = NORTH (+z = south), +y = up. 1 unit = 1 m. Story frames are 30 fps (fractional in the HQ render).
//
// STORY TIME: every animated thing is driven by st = storyF(sid, f), NOT by f. The hook (shot 1) is a slow-motion
// flash-forward of the charge (st 812 -> 862 over film frames 0 -> 118); every other shot has st = f.
import { flow, type Flow, type FlowKey } from "./camrig";
import type { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 1645; // 54.8 s: last word "ran." ends at ~1630, then ~0.5 s of payoff image (loops to frame 0)
export const G = 0;
export const D0 = G;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
/** 0 before frame a, 1 after frame b, smooth between (frames) */
export const rampF = (f: number, a: number, b: number) => smooth((f - a) / Math.max(1e-6, b - a));
export const linF = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1e-6, b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];
/** deterministic hash 0..1 */
export const hash = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// ================= story time =================
export const HOOK_END = 118;
/** story frame for shot sid at film frame f: the hook replays the charge at 0.42x speed (st 812 -> 862: the hero pig
 *  bursts through the elephant line as E3 rears; it ends well short of the phalanx) */
export const storyF = (sid: number, f: number) => (sid === 1 ? 812 + 0.42 * f : f);

// ================= Megara, 266 BC (the main place, day) =================
// A Greek city wall of pale limestone ashlar running east-west along z = 0 (outer face z = 0 faces SOUTH, +z), inner
// face z = -4, walkway 8 m up with a crenellated parapet on the outer edge; square towers (12 m) at x = +-9 (flanking
// the gate) and x = +-42; the wall runs x = -80..80 then bends north. THE GATE at x = 0: a 6 m wide x 6 m high passage
// through the wall (z -4..0), two wooden leaves (3 m each) hinged at x = +-3 on the INNER face (z = -4), opening
// INWARD (north, toward -z) by doorDeg(st).
export const WALL_Z = 0, WALL_T = 4, WALL_H = 8, PARAPET_H = 1.4;
export const GATE: V3 = [0, 0, 0];
export const GATE_W = 6, GATE_HGT = 6;
export const TOWERS_X = [-42, -9, 9, 42];
// Inside the city: a straight street runs north from the gate (x -3..3, z -4..-60), whitewashed houses with
// terracotta roofs both sides. The PIG PEN: a low stone/wattle pen against the wall's inner face just EAST of the gate,
// x 5..12, z -12..-5 (its opening on its west side at PEN_GAP, z -9.3..-7.7), mud, a trough. The PITCH CAULDRON (a big
// black pot on a fire ring, ~1 m) at CAULDRON between the queue and the pen, a TORCH BRAZIER at BRAZIER west of the
// street. The pig QUEUE stands on the street behind the gate (two lanes, 10 rows; see queuePos). The inside camera works
// from NORTH of all this looking SOUTH (pen, queue, cauldron, gate in one view): keep x 3..9, z -12..-24 clear above
// 1 m (no houses east of the street closer than x 13 for z > -24) and the street clear.
export const PEN = { x0: 5, x1: 12, z0: -12, z1: -5 };
export const PEN_GAP: V3 = [5, 0, -8.5];
export const CAULDRON: V3 = [3.1, 0, -9.6];
export const BRAZIER: V3 = [-3.0, 0, -8.2];
// Outside: a dry plain (golden grass, olive trees, a dirt road running south from the gate). Megara's LAST DEFENDERS
// (a line of hoplites, round shields) stand across the road at DEF_LINE; the elephants smash through them at F_SMASH.
// The MACEDONIAN PHALANX (long spears = sarissas, red/bronze) follows the elephants; by st 700 it waits at PHALANX.
export const DEF_LINE = { x0: -16, x1: 16, z: 11.0 };
export const PHALANX = { x0: -26, x1: 26, z0: 34, z1: 52 };

// ================= Edessa, 544 AD (golden) =================
// Far away from Megara. A tall mudbrick-and-limestone wall along local z = 0 (outer face toward +z), 12 m high, with
// a SQUARE TOWER at local x = 0 (8 x 8 m, its front face projecting to local z = +2, platform 18 m up, crenellated).
// A stout wooden BEAM (crane arm) juts out from the tower top toward +z: its tip (a pulley) is BEAM_TIP. The Persian
// elephant EP is pushed up to the wall below it.
export const EDESSA: V3 = [1200, 0, 0];
export const ED_WALL_H = 12, ED_TOWER_H = 18;
export const BEAM_TIP: V3 = at(EDESSA, 0, 18.8, 5.6);
export const ROMAN_AT: V3 = at(EDESSA, 1.3, ED_TOWER_H, 1.3);   // the Roman defender on the tower platform, facing +z

// ================= venues =================
// The writer's room (warm interior): a desk (top 0.76 m) with an unrolled papyrus scroll whose INK DRAWING draws itself
// by drawK(st): a pig with squeal lines, then an elephant running away (pictures only, NO readable text). An oil lamp, a
// shelf of scroll cubbies, a window. The writer sits behind the desk facing +z.
export const SCROLL_ROOM: V3 = [-1200, 0, 0];
export const DESK: V3 = at(SCROLL_ROOM, 0, 0.76, 0);
export const SCROLL_AT: V3 = at(SCROLL_ROOM, 0, 0.765, 0.12);   // centre of the unrolled scroll (0.9 m wide, 0.4 m deep), drawing faces +y
export const WRITER_AT: V3 = at(SCROLL_ROOM, 0, 0, -0.72);
export const drawK = (st: number) => rampF(st, 1046, 1088);      // 0 blank -> 0.5 the pig + squeal lines -> 1 + the fleeing elephant
// The elephant stable (day): a dusty paddock (fence 18 x 12 m), a thatched open barn on the north side, hay, troughs.
export const STABLE: V3 = [0, 0, 1200];
export const ANT_STABLE: V3 = at(STABLE, -5.0, 0, 3.6);          // Antigonus stands here, points at "ordered" (1137)
export const TRAINERS: { from: V3; to: V3; piglet: number }[] = [
  { from: at(STABLE, -8.5, 0, 6.5), to: at(STABLE, -1.4, 0, 1.0), piglet: 0 },
  { from: at(STABLE, -9.5, 0, 5.0), to: at(STABLE, 2.2, 0, 0.2), piglet: 1 },
];
export const CARRY = [1146, 1192];                               // trainers walk in carrying piglets, set them down at 1194
export const BABY: V3[] = [at(STABLE, -0.2, 0, -0.6), at(STABLE, 3.6, 0, -1.2)];   // two baby elephants (scale 0.55)
export const MOTHER: V3 = at(STABLE, 6.5, 0, -4.5);              // an adult cow elephant eating hay (scale 1)

// ================= the elephants =================
// Toon war elephants: ~3.2 m at the shoulder, body ~4.6 m long, local +z = forward (the trunk end), standing on the
// ground at pos. howdah: "king" = a small fenced tower with Antigonus; "tower" = a war tower (2 soldiers);
// "siege" = the tall Persian wooden turret (top ~8.5 m) with archers; "none". eyes = the cartoon eye decal state.
export type Gait = "stand" | "walk" | "run";
export type EleState = {
  pos: V3; yaw: number; gait: Gait; phase: number; rear: number; trunk: number; ears: number;
  eyes: "calm" | "angry" | "shock" | "happy"; howdah: "none" | "tower" | "king" | "siege"; scale: number; vis: boolean;
};
/** rearing: the body pitches front-up by rear * REAR_DEG about the hind feet (local REAR_PIVOT) */
export const REAR_DEG = 38;
export const REAR_PIVOT: V3 = [0, 0, -1.7];
/** riders' anchor points in an elephant's LOCAL frame (scale 1): the howdah floor (Antigonus' feet / the tower
 *  soldiers' feet), the mahout's seat on the neck, the Persian turret's top platform (archers' feet) */
export const HOWDAH_FLOOR: V3 = [0, 3.45, -0.55];
export const MAHOUT_SEAT: V3 = [0, 3.1, 1.3];
export const TURRET_TOP: V3 = [0, 7.6, -0.4];
/** an elephant-local point -> world (yaw about +y, the rear pitch about REAR_PIVOT, scale): THE ONE transform every
 *  owner uses for riders, stuck arrows, spear contacts, the trunk tip, the hanging pig's eye line */
export const eleLocalToWorld = (e: EleState, l: V3): V3 => {
  const s = e.scale, a = (e.rear * REAR_DEG * Math.PI) / 180;
  const y0 = l[1] - REAR_PIVOT[1], z0 = l[2] - REAR_PIVOT[2];
  const y1 = y0 * Math.cos(a) + z0 * Math.sin(a) + REAR_PIVOT[1], z1 = -y0 * Math.sin(a) + z0 * Math.cos(a) + REAR_PIVOT[2];
  const x = l[0] * s, y = y1 * s, z = z1 * s, c = Math.cos(e.yaw), sn = Math.sin(e.yaw);
  return [e.pos[0] + x * c + z * sn, e.pos[1] + y, e.pos[2] - x * sn + z * c];
};
export const N_ELE = 8;
export const ELE_X = (i: number) => -24.5 + 7 * i;            // the line: x = -24.5 .. 24.5; the gate lane is x = 0
export const KING_ELE = 3;                                      // E3 (x = -3.5) carries Antigonus
/** the elephant line's z (body centres) while it advances on the city */
export const eleLineZ = (st: number) => {
  if (st < 120) return 50;
  if (st < 380) return 50 - 18 * linF(st, 120, 380);           // walk ~0.07 m/f (2 m/s)
  if (st < 445) return 32 - 19 * smooth((st - 380) / 65);       // the charge into the last defenders
  return 13;
};
/** phalanx front z at story frame st: 22 m behind the elephant line while they advance, then parked at PHALANX.z0 */
export const phalanxFront = (st: number) => (st < 445 ? eleLineZ(st) + 22 : Math.min(eleLineZ(445) + 22 + (st - 445) * 0.05, PHALANX.z0));
// beats on the elephants
export const F_SMASH = 428;          // first contact with DEF_LINE ("smash" 410 .. "defenders" 455)
export const F_FREEZE = 816;         // "freeze" 820
export const TURN = [866, 880];      // "spin around" 875-883 (big animals: 14 f)
export const F_STAMPEDE = 884;       // "stampede" 901
export const F_CRASH = 948;          // the elephants hit the phalanx ("crash" 950)
export const REAR = [820, 864];      // E3 rears up in panic (seen in the hook and at "freeze")
const STAMPEDE_V = 0.32;             // m/f once running
const stampD = (st: number) => (st < F_STAMPEDE ? 0 : st < F_STAMPEDE + 10 ? STAMPEDE_V * (st - F_STAMPEDE) ** 2 / 20 : STAMPEDE_V * (st - F_STAMPEDE - 5));
/** a Megara elephant at story frame st */
export const eleMegara = (i: number, st: number): EleState => {
  const jitZ = (hash(i, 3) - 0.5) * 2.4, x = ELE_X(i) + (hash(i, 5) - 0.5) * 0.8;
  const z0 = eleLineZ(st) + jitZ;
  const turned = rampF(st, TURN[0] + (i % 3), TURN[1] + (i % 3));
  const dir = i % 2 ? 1 : -1;                                   // spin direction alternates
  const yaw = Math.PI + dir * Math.PI * turned;                 // facing -z (the city) -> facing +z (away)
  const d = stampD(st);
  const z = z0 + d;
  const travelIn = 50 - eleLineZ(st);
  const gait: Gait = st >= F_STAMPEDE ? "run" : st >= 380 && st < 445 ? "run" : st < 380 && st >= 120 ? "walk" : "stand";
  const phase = gait === "walk" ? travelIn / 2.4 : gait === "run" ? (st >= F_STAMPEDE ? d / 3.4 : 18 / 2.4 + (travelIn - 18) / 3.4) : 0;   // continuous at the walk -> run switch (travel 18 m at st 380)
  const rear = i === KING_ELE ? rampF(st, REAR[0], REAR[0] + 9) * (1 - rampF(st, REAR[1] - 12, REAR[1])) : 0;
  const trunk = Math.max(rear, st >= F_FREEZE && st < F_STAMPEDE + 30 ? 0.8 : st >= 380 && st < 445 ? 0.5 : 0);
  const ears = st >= F_FREEZE ? 1 : st >= 380 && st < 445 ? 0.7 : 0.15;
  const eyes = st >= F_FREEZE - 2 ? "shock" : st >= 380 && st < 460 ? "angry" : "calm";
  return { pos: [x, 0, z], yaw, gait, phase, rear, trunk, ears, eyes, howdah: i === KING_ELE ? "king" : "tower", scale: 1, vis: st < 1005 };
};
// Edessa: the Persian elephant EP, pushed toward the wall (local z 44 -> 9.0, "pushed" 1367, arrives at "Edessa" 1405),
// faces the wall (-z). At the squeal (1572) it rears (1576-1598, the turret tilts back), turns (1600-1614) and runs (+z).
export const F_SQUEAL_ED = 1572, F_RUN_ED = 1614;
export const eleEdessa = (st: number): EleState => {
  const zIn = 44 - 34.1 * smooth(linF(st, 1300, 1404));   // stops at local z 9.9: face front ~6.7, the pig hangs ~1 m in front of it
  const turned = rampF(st, 1600, 1614);
  const run = st < F_RUN_ED ? 0 : 0.3 * (st - F_RUN_ED - 4 + 4 * Math.exp(-(st - F_RUN_ED) / 4));
  const rear = rampF(st, 1576, 1584) * (1 - rampF(st, 1592, 1600));
  const gait: Gait = st >= F_RUN_ED ? "run" : st >= 1300 && st < 1404 ? "walk" : "stand";
  return {
    pos: at(EDESSA, 0.3, 0, zIn + Math.max(0, run)), yaw: Math.PI - Math.PI * turned, gait,
    phase: gait === "walk" ? (44 - zIn) / 2.4 : gait === "run" ? run / 3.4 : 0, rear,
    trunk: st >= F_SQUEAL_ED ? 0.9 : 0.1, ears: st >= F_SQUEAL_ED ? 1 : 0.2,
    eyes: st >= F_SQUEAL_ED - 1 ? "shock" : "angry", howdah: "siege", scale: 1, vis: true,
  };
};
// the stable: two babies (scale 0.55, calm/happy) and the mother (eating). At "squeal" (1276) the piglet squeals right
// under baby 0's trunk and the baby just flaps its ears, happy (the contrast with Megara's shock).
export const eleStable = (k: number, st: number): EleState => {
  if (k === 2) return { pos: MOTHER, yaw: -2.5, gait: "stand", phase: 0, rear: 0, trunk: 0.25 + 0.15 * Math.sin(st / 14), ears: 0.2, eyes: "calm", howdah: "none", scale: 1, vis: true };
  const b = BABY[k];
  return { pos: b, yaw: k ? -0.45 : 0.25, gait: "stand", phase: 0, rear: 0, trunk: k === 0 && st > 1262 ? 0.55 : 0.2, ears: k === 0 && st > 1274 ? 0.6 : 0.2, eyes: k === 0 && st > 1270 ? "happy" : "calm", howdah: "none", scale: 0.55, vis: true };
};

// ================= the pigs =================
// Toon pigs: pink, ~1.1 m long, 0.6 m at the back; local +z = forward. pitch 0..1 = coated in black pitch;
// burn 0..1 = flames on the back (HDR, bloom); squeal = mouth open + squeal rings (FX cards by the char owner).
export type PigState = { pos: V3; yaw: number; gait: Gait; phase: number; pitch: number; burn: number; squeal: number; scale: number; carried: boolean; vis: boolean };
export const N_PIG = 20;
export const HERO_PIG = 0;
/** pigs 0..N_PEN-1 start in the pen (P0 grabbed, the rest herded out); the others wait in the street queue */
export const N_PEN = 8;                                      // P0: grabbed by the hero, first smeared, first lit, the hook's pig
export const F_RAID = 506;           // the hero grabs P0 in the pen ("raid" 502)
export const F_SMEAR = 565;          // the hero's brush CONTACT on P0 ("smear" 565)
export const F_IGNITE = 668;         // the torch touches P0 ("fire" 671); the flame runs down the queue 1.6 f per pig
export const GATE_OPEN = [699, 722]; // "gates swing open" 699-714
export const F_RUN = 735;            // the first pigs bolt (row 0), the rest follow 3 f per row
export const F_SHRIEK = 780;         // "shrieking": every pig squeals
/** the door leaves' opening angle (degrees, 0 = shut across the passage, 88 = flat against the passage wall) */
export const doorDeg = (st: number) => 88 * rampF(st, GATE_OPEN[0], GATE_OPEN[1]);
/** queue slot of pig i on the street behind the gate (lane 0 = east x +1.0, lane 1 = west x -1.0) */
export const queuePos = (i: number): V3 => [i % 2 ? -1.0 : 1.0, 0, -6.0 - Math.floor(i / 2) * 1.9];
export const penPos = (i: number): V3 => [PEN.x0 + 1.2 + 4.9 * hash(i, 11), 0, PEN.z0 + 1.0 + 4.0 * hash(i, 13)];
/** the hero carries P0 from the pen to the queue head (F_RAID -> 556): world position of P0 while carried */
export const carryP0 = (st: number): V3 => {
  const a: V3 = [penPos(0)[0], 0.6, penPos(0)[2]], m: V3 = [4.2, 0.7, -8.6], b: V3 = [queuePos(0)[0], 0.0, queuePos(0)[2]];   // held low (y 0.6): the hero's face stays clear
  const u = linF(st, F_RAID + 4, 556);
  const p = u < 0.5 ? lerp3(a, m, smooth(u * 2)) : lerp3(m, [b[0], 0.6, b[2]], smooth(u * 2 - 1));
  return st > 552 ? lerp3(p, b, rampF(st, 552, 558)) : p;
};
/** the lane each pig runs down after the gate: the gaps between the elephants (x = -21..21 step 7); P0 takes x = 0 */
export const pigGapX = (i: number) => (i === HERO_PIG ? 0 : -21 + 7 * ((i * 3 + 1) % 7) + (hash(i, 17) - 0.5) * 1.6);
const RUN_V = 0.3, CHASE_V = 0.17;
/** distance a pig has run since its start frame */
const runS = (i: number, st: number) => {
  const t0 = F_RUN + Math.floor(i / 2) * 3 + (i % 2);
  if (st < t0) return 0;
  const t = st - t0, acc = Math.min(t, 8);
  const s1 = 0.5 * (RUN_V / 8) * acc * acc + RUN_V * Math.max(0, t - 8);
  const S_CHASE = 26 + Math.abs(queuePos(i)[2]);
  return s1 < S_CHASE ? s1 : S_CHASE + (s1 - S_CHASE) * (CHASE_V / RUN_V) * Math.max(0, 1 - (st - 950) / 60);
};
/** point at distance s along pig i's run: queue slot -> the gate (z -1) -> its gap lane (z 9) -> straight south */
const runPath = (i: number, s: number): { p: V3; yaw: number } => {
  const q = queuePos(i), gx = pigGapX(i);
  const pts: V3[] = [q, [q[0] * 0.8, 0, -1], [gx, 0, 9], [gx, 0, 60]];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (s <= L || k === pts.length - 2) { const u = Math.min(1, s / L); return { p: lerp3(a, b, u), yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) }; }
    s -= L;
  }
  return { p: q, yaw: 0 };
};
export const pigMegara = (i: number, st: number): PigState => {
  const pitch = i === HERO_PIG ? rampF(st, F_SMEAR, F_SMEAR + 6) * 0.45 + rampF(st, 578, 600) * 0.55 : rampF(st, 572 + i * 3, 586 + i * 3);
  const ign = F_IGNITE + i * 1.6;
  const burn = rampF(st, ign, ign + 6) * (1 - rampF(st, 935 + hash(i, 21) * 20, 975 + hash(i, 21) * 20));   // the pitch burns off by ~995: sooty pigs
  const squeal = st >= F_SHRIEK - 2 && st < 990 ? 1 : i === HERO_PIG && st >= F_RAID && st < 560 ? 1 : 0;
  if (i === HERO_PIG && st >= F_RAID && st < 558) return { pos: carryP0(st), yaw: -Math.PI / 2, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: true, vis: true };
  const s = runS(i, st);
  if (s > 0) {
    const r = runPath(i, s);
    return { pos: r.p, yaw: r.yaw, gait: "run", phase: s / 1.4, pitch, burn, squeal, scale: 1, carried: false, vis: st < 1005 };
  }
  if (i === HERO_PIG) return { pos: st < F_RAID ? penPos(0) : queuePos(0), yaw: st < F_RAID ? 1.2 : Math.PI, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: false, vis: true };
  // pigs 8-19 already wait in the street queue; pigs 1-7 are in the pen with P0 and get herded through its gap to
  // their slots at ~0.16 m/f, leaving 8 f apart (1.3 m spacing: no nose-to-tail overlap)
  if (i >= N_PEN) return { pos: queuePos(i), yaw: Math.PI + (hash(i, 25) - 0.5) * 0.5, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: false, vis: true };
  const h0 = 512 + i * 8, a = penPos(i), q = queuePos(i);
  const path: V3[] = [a, PEN_GAP, [1.9, 0, Math.min(q[2] - 0.5, -12.0)], q];   // passes >= 1 m north of the cauldron
  const lens = path.slice(1).map((b, k) => Math.hypot(b[0] - path[k][0], b[2] - path[k][2])), tot = lens.reduce((x, y) => x + y, 0);
  let sh = Math.max(0, (st - h0) * 0.16);
  if (sh <= 0) return { pos: a, yaw: hash(i, 23) * 6.28, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: false, vis: true };
  if (sh >= tot) return { pos: q, yaw: Math.PI, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: false, vis: true };
  for (let k = 0; k < lens.length; k++) {
    if (sh <= lens[k]) { const p0 = path[k], p1 = path[k + 1]; return { pos: lerp3(p0, p1, sh / lens[k]), yaw: Math.atan2(p1[0] - p0[0], p1[2] - p0[2]), gait: "walk", phase: ((st - h0) * 0.16) / 0.9, pitch, burn, squeal, scale: 1, carried: false, vis: true }; }
    sh -= lens[k];
  }
  return { pos: q, yaw: Math.PI, gait: "stand", phase: 0, pitch, burn, squeal, scale: 1, carried: false, vis: true };
};
// Edessa: ONE pig. The Roman holds it (1480-1500), hooks it to the rope (1500-1506), pays the rope out 1508-1540 (the
// pig drops from the beam tip to the elephant's eye height, y ~4.7), a small pendulum swing, squeals at 1572.
export const ropeLen = (st: number) => 0.9 + 14.15 * rampF(st, 1508, 1558);
export const pigEdessa = (st: number): PigState => {
  const L = ropeLen(st), sw = 0.35 * Math.sin((st - 1508) / 7) * Math.exp(-Math.max(0, st - 1540) / 40) * (st > 1508 ? 1 : 0);
  const hang: V3 = [BEAM_TIP[0] + sw * 0.3, BEAM_TIP[1] - L - 0.45, BEAM_TIP[2] + sw];
  const held: V3 = at(ROMAN_AT, -0.2, 1.05, 0.55);
  const pos = st < 1500 ? held : st < 1506 ? lerp3(held, [BEAM_TIP[0], BEAM_TIP[1] - 1.35, BEAM_TIP[2]], rampF(st, 1500, 1506)) : hang;
  return { pos, yaw: Math.PI, gait: "stand", phase: st / 3, pitch: 0, burn: 0, squeal: st >= F_SQUEAL_ED - 1 ? 1 : 0, scale: 1, carried: true, vis: st >= 1480 };
};
// the stable: 6 piglets (scale 0.55); piglets 0 and 1 arrive carried by the trainers (CARRY), the rest play by baby 0
export const pigletAt = (k: number, st: number): PigState => {
  const play: V3[] = [at(BABY[0], 0.6, 0, 1.3), at(BABY[1], -0.9, 0, 1.1), at(BABY[0], -1.2, 0, 0.9), at(BABY[0], 1.5, 0, 0.3), at(BABY[1], 0.8, 0, 1.4), at(BABY[0], -0.2, 0, 1.9)];
  const base: PigState = { pos: play[k], yaw: hash(k, 31) * 6.28, gait: "stand", phase: 0, pitch: 0, burn: 0, squeal: k === 0 && st >= 1272 && st < 1292 ? 1 : 0, scale: 0.55, carried: false, vis: true };
  if (k > 1) { const w = Math.sin(st / 9 + k) * 0.25; return { ...base, pos: at(play[k], w, 0, 0), gait: Math.abs(Math.cos(st / 9 + k)) > 0.5 ? "walk" : "stand", phase: st / 6 }; }
  const T = TRAINERS[k];
  const down = rampF(st, CARRY[1] - 6, CARRY[1] + 2);   // lowered to the ground over 8 f (no pop)
  if (st < CARRY[1] + 2) return { ...base, pos: at(lerp3(T.from, T.to, linF(st, CARRY[0], CARRY[1])), 0, 1.05 * (1 - down), 0.45 * (1 - down)), carried: down < 0.95, squeal: 0 };
  return { ...base, pos: T.to };
};
/** squeal ring bursts (the char owner's FX cards; the audio's squeal cues): [shot set, story frame, which pig] */
export const SQUEALS: { set: SetName; st: number; pig: number }[] = [
  { set: "megara", st: 512, pig: 0 }, { set: "megara", st: 843, pig: 0 }, { set: "megara", st: 862, pig: 0 },
  { set: "megara", st: 780, pig: 0 }, { set: "megara", st: 782, pig: 3 }, { set: "megara", st: 785, pig: 6 },
  { set: "stable", st: 1276, pig: 0 }, { set: "edessa", st: F_SQUEAL_ED, pig: 0 }, { set: "edessa", st: 1590, pig: 0 },
];

// ================= spears + arrows (Megara; the beast owner draws them) =================
/** spears thrown from the wall top at E3's east flank; they BOUNCE off ("bounce" 298-321) and fall to the ground.
 *  hit = contact frame; local = the contact point in E3's local frame (x = its left side when facing +z, y up, z forward). */
export const SPEARS: { f0: number; hit: number; from: V3; ele: number; local: V3 }[] = [
  { f0: 274, hit: 298, from: [-2.0, 9.2, 0.6], ele: KING_ELE, local: [-1.45, 2.3, 0.6] },
  { f0: 284, hit: 308, from: [1.5, 9.2, 0.6], ele: KING_ELE, local: [-1.5, 2.0, -0.6] },
  { f0: 294, hit: 318, from: [-5.0, 9.2, 0.6], ele: KING_ELE, local: [-1.4, 2.6, 1.2] },
];
/** the arrow volley ("Arrows barely sting them" 354-377): k = 0..N_ARROW-1, released from the parapet; they stick in
 *  an elephant's hide (ele >= 0: stay stuck at `local`, moving with that elephant) or land at `ground` */
export const N_ARROW = 48;
export const arrowShot = (k: number) => {
  const f0 = 336 + Math.floor(hash(k, 41) * 14), fl = 20 + Math.floor(hash(k, 43) * 6);
  const ele = Math.floor(hash(k, 45) * N_ELE), stick = hash(k, 47) < 0.75;
  const local: V3 = [(hash(k, 49) - 0.5) * 2.6, 2.2 + hash(k, 51) * 1.1, (hash(k, 53) - 0.5) * 3.2];
  return { k, f0, hit: f0 + fl, from: [(hash(k, 55) - 0.5) * 50, 9.4, 0.4] as V3, ele: stick ? ele : -1, local, ground: [ELE_X(ele) + (hash(k, 57) - 0.5) * 6, 0, eleLineZ(f0 + fl) + (hash(k, 59) - 0.5) * 8] as V3 };
};

// ================= shots =================
export type SetName = "megara" | "scroll" | "stable" | "edessa";
export type Light = LightName;
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName };
const SH: [number, Light, SetName][] = [
  [0, "day", "megara"],       // 1  L0 hook (slow-mo flash-forward): a burning pig sprints at the lens, E3 rears behind it
  [118, "day", "megara"],     // 2  L1 "Greece, 266 BC": the wide; push onto Antigonus on E3
  [288, "day", "megara"],     // 3  L2 spears bounce off E3's flank; the arrow volley; crane up (SET PIECE from 330)
  [392, "day", "megara"],     // 4  L3 SET PIECE: the line smashes the last defenders
  [478, "day", "megara"],     // 5  L4-L6 (dissolve) inside the city: the pig pen, the pitch, the fire
  [690, "day", "megara"],     // 6  L7 the gate opens; ride out with the burning pigs
  [800, "day", "megara"],     // 7  L8-L10 freeze, spin, stampede, crash through the phalanx
  [1005, "day", "scroll"],    // 8  L11 the writer's room: the drawing of the squeal
  [1108, "day", "stable"],    // 9  L12-L13 the stable: piglets raised with baby elephants
  [1295, "golden", "edessa"], // 10 L14-L17 Edessa: the pushed elephant, the Romans, the hanging pig, the run (loop)
];
export const SHOTS: ShotDef[] = SH.map(([a, light, set], i) => ({ id: i + 1, a, b: i + 1 < SH.length ? SH[i + 1][0] : TOTAL, light, set }));
/** 7-frame dissolves at place / time changes (shot id -> frames) */
// shot 5 is a hard CUT (2026-11-08): a dissolve there laid the pen's brick wall over the city wall (cross-hatched walls)
export const XFADE: Record<number, number> = { 2: 7, 8: 7, 9: 7, 10: 7 };
export const FLASH_AT = -100;   // no white flash in this short
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - Math.floor(x / 2) && f < s.a - Math.floor(x / 2) + x) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - Math.floor(x / 2)) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** retention markers for cam_qa gate 14: the set piece (the arrow volley crane -> the line smashing the defenders)
 *  and the first answer frame ("So the Megarians raid their own pig pens") */
export const RETENTION = { setPiece: [330, 470] as [number, number], resolve: 483 };

/** every visible elephant of shot sid at film frame f (st = storyF) */
export const elephantsAt = (sid: number, f: number): EleState[] => {
  const st = storyF(sid, f), s = SHOTS[sid - 1];
  if (s.set === "megara") return Array.from({ length: N_ELE }, (_, i) => eleMegara(i, st));
  if (s.set === "edessa") return [eleEdessa(st)];
  if (s.set === "stable") return [0, 1, 2].map((k) => eleStable(k, st));
  return [];
};
export const pigsAt = (sid: number, f: number): PigState[] => {
  const st = storyF(sid, f), s = SHOTS[sid - 1];
  if (s.set === "megara") return Array.from({ length: N_PIG }, (_, i) => pigMegara(i, st));
  if (s.set === "edessa") return [pigEdessa(st)];
  if (s.set === "stable") return Array.from({ length: 6 }, (_, k) => pigletAt(k, st));
  return [];
};

// ================= camera: one continuous flight per place (camrig.ts) =================
// FIRST PASS (rough): the lead refines these on stills once the sets exist. Keep >= 0.8 m from every structure.
// The camera stays LEVEL (gate 17): roll only on the ride-along out of the gate (shot 6).
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const K = (f: number, pos: V3, look: V3, fov = 44, roll = 0): FlowKey => ({ f, at: { pos, look, fov, roll } });
/** a look point `d` m down the ray from pos through `near` (same framing; far look points interpolate as clean rotations) */
const far = (pos: V3, near: V3, d = 40): V3 => {
  const v: V3 = [near[0] - pos[0], near[1] - pos[1], near[2] - pos[2]], l = Math.hypot(...v) || 1;
  return [pos[0] + (v[0] / l) * d, pos[1] + (v[1] / l) * d, pos[2] + (v[2] / l) * d];
};
const KF = (f: number, pos: V3, near: V3, fov = 44, roll = 0) => K(f, pos, far(pos, near), fov, roll);
const SR = (x: number, y: number, z: number): V3 => at(SCROLL_ROOM, x, y, z);
const STB = (x: number, y: number, z: number): V3 => at(STABLE, x, y, z);
const ED = (x: number, y: number, z: number): V3 => at(EDESSA, x, y, z);
/** where the hero pig is in film frame f of the hook (for the hook camera) */
const hookPigZ = (f: number) => pigMegara(HERO_PIG, storyF(1, f)).pos[2];
/** path of each shot (shots on one path share one continuous camera) */
export const PATH_OF = [0, 1, 1, 1, 2, 2, 2, 3, 4, 5];
export const pathOf = (sid: number) => PATH_OF[sid - 1];
/** a ride-along key: offset from the hero pig at film frame f of shot sid (pos + look relative to the pig) */
const RA = (sid: number, f: number, dp: V3, dl: V3, fov = 46, roll = 0) => { const p = pigMegara(HERO_PIG, storyF(sid, f)).pos; return K(f, at(p, dp[0], dp[1], dp[2]), at(p, dl[0], dl[1], dl[2]), fov, roll); };
const PATHS: Flow[] = [
  // 0: the hook. Low at pig height ~4.5 m ahead of the hero pig (running at us down the x = 0 lane), looking north
  //    back at it; E3 rears up behind-left. Beats: tilt up to the rearing E3 ("war elephants"), back down to the pig
  //    ("until pigs"), push in on its scream (88).
  flow([
    KF(0, [0.7, 0.55, hookPigZ(0) + 4.6], [-0.4, 1.6, hookPigZ(0) - 6], 46),
    KF(16, [0.65, 0.58, hookPigZ(16) + 4.1], [-1.6, 3.3, hookPigZ(16) - 8], 46),
    KF(34, [0.66, 0.58, hookPigZ(34) + 4.0], [-1.7, 3.4, hookPigZ(34) - 8], 46),
    KF(52, [0.7, 0.55, hookPigZ(52) + 3.7], [-0.3, 1.1, hookPigZ(52) - 6], 45),
    KF(70, [0.68, 0.55, hookPigZ(70) + 3.6], [-0.3, 1.05, hookPigZ(70) - 6], 45),
    KF(90, [0.45, 0.55, hookPigZ(90) + 2.5], [0.0, 0.75, hookPigZ(90) - 4], 42),
    KF(124, [0.43, 0.55, hookPigZ(124) + 2.4], [0.0, 0.75, hookPigZ(124) - 4], 42),
  ]),
  // 1: Megara outside: over Antigonus' shoulder toward the city -> push in on him -> down to E3's flank (spears) ->
  //    SET PIECE: crane up + back east over the volley and the charge into the last defenders
  flow([
    KF(112, [6.8, 7.6, 60.5], [-3, 3.5, 10], 44),                // "Greece, 266 BC": behind-right of E3, the line + Megara ahead
    KF(160, [6.4, 7.4, 57.6], [-3, 3.6, 10], 44),                //   drift with the walking line
    KF(212, [1.3, 5.9, 50.3], [-3.5, 4.8, 44.6], 42),            // "King Antigonus" (203-226): push in, he looks back at us
    KF(240, [1.1, 5.8, 48.4], [-3.5, 4.8, 42.7], 42),            //   drift
    KF(274, [1.0, 4.6, 44.6], [-3.3, 3.4, 37.5], 44),            // "Megara" (266): he points at the city; we start down his flank
    KF(304, [0.9, 2.7, 39.3], [-3.0, 2.4, 37.0], 46),            // "Spears bounce off" (291-321): low on E3's east flank
    KF(326, [0.8, 2.65, 38.0], [-3.0, 2.45, 35.7], 46),          //   ride along (bounces 298 / 308 / 318)
    KF(362, [8.0, 8.5, 38.0], [-1.5, 2.5, 26.0], 47),            // SET PIECE: crane up + back as the volley flies (336-372)
    KF(392, [9.0, 9.4, 37.0], [-1.0, 2.4, 25.0], 47),            //   drift: arrows sticking ("barely sting" 354-377)
    KF(424, [17.5, 21.5, 37.0], [0, 0.5, 14], 52),               //   up + back over the charge: "smash" (410), contact F_SMASH 428
    KF(460, [18.2, 22.6, 36.4], [0, 0.3, 11], 52),               //   the defenders fly ("defenders" 455)
    KF(486, [18.6, 23.2, 35.9], [0, 0.3, 10], 52),               //   drift (hard cut out at 478)
  ]),
  // 2: inside the city, from NORTH of the action looking SOUTH (pen, queue, cauldron, gate) -> ride out of the gate
  //    with the hero pig -> the frozen elephants -> pull up over the stampede into the phalanx
  flow([
    KF(472, [7.0, 3.7, -20.0], [7.8, 0.6, -9.0], 44),            // (hard cut in at 478) the pen, the queue lanes, the gate beyond
    KF(488, [6.9, 3.65, -19.7], [7.8, 0.6, -9.0], 44),           //   drift
    KF(526, [7.3, 2.95, -16.3], [8.1, 0.78, -9.2], 43),          // "raid" (502): the hero grabs P0 (F_RAID 506): SLOW push in
                                                                 //   (38 f, little drop: the 16 f push strobed the brick wall)
    KF(542, [7.2, 2.88, -16.05], [7.6, 0.8, -9.2], 42),          //   drift: the carry starts, pigs herded out of the gap
    KF(570, [5.4, 2.2, -14.0], [1.3, 0.6, -6.8], 42),            // "smear" (565): pan to the queue head + cauldron
    KF(604, [5.2, 2.15, -13.6], [1.3, 0.6, -7.0], 42),           //   drift: the queue turns black ("sticky black pitch" 593-611)
    KF(644, [2.3, 1.95, -11.9], [1.0, 0.6, -6.4], 40),           // "set" (643): the hero with the torch, push in (west of the cauldron)
    KF(670, [1.95, 1.75, -10.8], [1.0, 0.65, -6.3], 40),         //   "fire" (671): P0 lights (668)
    KF(698, [5.0, 3.1, -15.8], [0.3, 1.5, -3.0], 44),            // pull back + up: the burning queue + the gate
    KF(724, [4.4, 2.8, -14.6], [0.3, 1.6, -2.0], 44),            //   drift: "gates swing open" (699-722): daylight, elephants beyond
    RA(6, 752, [0.6, 1.75, -3.4], [0, 0.7, 14], 46, 0.02),      // RIDE-ALONG with the hero pig (roll <= ~6 deg, back to 0 before landing)
    RA(6, 768, [0.6, 1.7, -3.5], [0, 0.8, 14], 48, 0.04),       //   through the gate ("charge out" 760-770)
    RA(6, 784, [0.7, 1.7, -3.6], [0, 1.4, 14], 48, 0.05),        //   onto the plain ("shrieking" 780)
    K(798, at(pigMegara(HERO_PIG, 798).pos, 0.8, 1.6, -3.8), [-1.2, 2.8, 15.5], 46, 0.01),   //   the line ahead: look up at E3
    KF(818, [2.6, 1.6, 5.6], [-1.6, 3.4, 14.5], 46),             // "freeze" (820): stop, look up at E3 (rears 820-864)
    KF(846, [2.8, 1.65, 5.2], [-1.7, 3.6, 14.5], 46),            //   drift (>= 6 m from every elephant)
    KF(892, [6.5, 6.0, 6.5], [0, 2.4, 20], 47),                  // "spin around" (875-883): rise + pull back east
    KF(920, [8.5, 9.5, 8.5], [0, 1.2, 28], 49),                  // "stampede" (901): they flee south
    KF(960, [9.0, 15.0, 16.0], [0, 0, 42], 51),                  // "crash" (950): into the phalanx
    KF(1006, [8.6, 16.0, 19.0], [0, 0, 50], 51),                 //   soldiers flung ("army" 992)
  ]),
  // 3: the writer's room: the writer at the desk -> push down into the scroll as the drawing draws itself
  flow([
    KF(1000, SR(1.6, 1.55, 2.2), SR(0, 1.05, -0.5), 42),
    KF(1030, SR(1.45, 1.5, 2.0), SR(0, 1.05, -0.5), 42),          //   drift
    KF(1046, SR(1.15, 1.5, 1.65), SR(0, 1.0, -0.45), 40),         // "swore" (1036): the writer's raised finger
    KF(1072, SR(0.62, 1.62, 0.78), SR(0.02, 0.77, 0.08), 40),     // "elephants panic" (1052-1066): rise + tip down onto the scroll
    KF(1094, SR(0.14, 1.2, 0.58), SR(0, 0.77, 0.12), 40),         // "squeal" (1090): the drawing fills the frame
    KF(1112, SR(0.12, 1.16, 0.53), SR(0, 0.77, 0.12), 40),
  ]),
  // 4: the stable: Antigonus points -> follow the trainers + piglets -> the baby elephant with the squealing piglet
  flow([
    KF(1080, STB(-9.6, 2.75, 11.9), STB(-5.0, 1.5, 3.6), 42),
    KF(1104, STB(-9.1, 2.62, 11.1), STB(-5.0, 1.5, 3.6), 42),
    KF(1126, STB(-8.6, 2.48, 10.3), STB(-5.0, 1.5, 3.6), 42),     //   drift
    KF(1142, STB(-7.9, 2.2, 9.1), STB(-5.0, 1.6, 3.6), 40),       // "ordered" (1137): Antigonus points
    KF(1182, STB(-5.0, 2.4, 9.6), STB(-2.0, 1.2, 2.2), 42),       // the trainers carry the piglets in ("raise pigs" 1172-1180)
    KF(1214, STB(-2.4, 2.1, 7.8), STB(-0.6, 0.8, 0.8), 42),       //   set them down by the babies
    KF(1252, STB(0.6, 1.45, 5.2), STB(0.2, 0.7, 0.3), 40),        // "grew up" (1249): the baby + piglets, low
    KF(1280, STB(0.6, 1.25, 4.5), STB(0.3, 0.7, 0.4), 38),        // "squeal" (1276): the baby just flaps its ears
    KF(1302, STB(0.45, 1.12, 3.9), STB(0.3, 0.7, 0.4), 38),
  ]),
  // 5: Edessa (golden): the wide with the elephant pushed in -> up the tower to the Roman -> follow the pig down the rope
  //    while orbiting to the tower's east side -> the squeal + the run, ending with the pig at the lens and the elephant
  //    behind it (the loop: matches frame 0)
  flow([
    KF(1290, ED(10.5, 6.2, 71), ED(0, 6, 10), 46),               // "Eight hundred years later": behind the elephant, the tower ahead
    KF(1336, ED(9.6, 5.8, 66), ED(0, 5.5, 12), 46),              //   drift (the elephant walks in toward the tower)
    KF(1374, ED(9.5, 3.1, 36), ED(0.3, 2.6, 24), 42),            // "pushed" (1367): the Persians shoving behind it
    KF(1408, ED(13, 9, 28), ED(0, 9, 6), 46),                    // "Edessa" (1405): it arrives under the tower
    KF(1442, ED(6.2, 20.7, 8.8), ED(1.0, 19.3, 1.4), 44),        // crane up to the Roman on the tower ("Romans" 1436)
    KF(1474, ED(5.8, 20.5, 8.4), ED(1.0, 19.3, 1.4), 44),        //   "light" (1458): the torch, then dunked
    KF(1508, ED(6.8, 20.2, 12.0), ED(0.3, 17.9, 5.4), 42),       // "hung" (1514): the pig on the hook
    KF(1536, ED(6.0, 13.0, 8.8), ED(0.1, 9.5, 5.6), 42),         //   follow it down the rope, orbiting east
    KF(1562, ED(3.4, 4.1, 4.2), ED(0, 3.4, 6.8), 42),            //   at the elephant's eye (the pig stops at y ~3.3)
    KF(1592, ED(0.45, 3.55, 2.75), ED(0.1, 3.3, 8.0), 44),       // "squealed" (1572): the pig at the lens, the elephant right behind it
    KF(1620, ED(0.38, 3.52, 2.7), ED(0.15, 3.25, 8.4), 45),      // "ran" (1620): it flees straight away behind the pig
    KF(1650, ED(0.32, 3.5, 2.65), ED(0.2, 3.2, 8.8), 45),        //   payoff (= frame 0: the pig at lens height, the elephant behind)
  ]),
];

// impact kicks (frame, strength): flip sign each frame, decay over 7 f
const KICKS: [number, number][] = [[F_SMASH, 0.6], [F_IGNITE, 0.3], [722, 0.35], [F_CRASH, 0.6], [F_SQUEAL_ED, 0.45], [88, 0.3]];
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) {
    const n = Math.floor(f - f0 + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
/** the bare camera of a shot (no kick): staging code uses it for fixed facing directions */
export const camStatic = (sid: number, f: number): Cam => PATHS[pathOf(sid)](f);
export const camAt = (sid: number, f: number): Cam => {
  const c = camStatic(sid, f);
  const a = kickAt(f);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const Ld = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ld * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m] };
};
export const keyEnd = (sid: number, f: number) => Math.max(f, SHOTS[sid - 1].a);
/** the subject the camera rides with (gates 10 / QA) */
export const trackAt = (sid: number, f: number): V3 => {
  const st = storyF(sid, f);
  if (sid === 1 || sid === 6) return pigMegara(HERO_PIG, st).pos;
  if (sid <= 4 || sid === 7) return eleMegara(KING_ELE, st).pos;
  if (sid === 10) return eleEdessa(st).pos;
  return camStatic(sid, f).look;
};

// ================= lens: depth of field (cInf px at 1080; 0 on wides) =================
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const pigHead = (sid: number) => (f: number): V3 => { const p = pigMegara(HERO_PIG, storyF(sid, f)).pos; return [p[0], 0.55, p[2] + 0.5]; };
export const DOF: Dof[] = [
  { f: 0, cInf: 12, focus: pigHead(1) },
  { f: 118, dur: 1, cInf: 3, focus: (f) => at(eleMegara(KING_ELE, f).pos, 0, 4.6, 0) },
  { f: 200, dur: 14, cInf: 7, focus: (f) => at(eleMegara(KING_ELE, f).pos, 0, 4.8, 0.3) },
  { f: 288, dur: 16, cInf: 7, focus: (f) => at(eleMegara(KING_ELE, f).pos, 1.4, 2.4, 0) },
  { f: 330, dur: 24, cInf: 0 },
  { f: 478, dur: 1, cInf: 5, focus: () => [8.5, 0.8, -9.0] },
  { f: 545, dur: 22, cInf: 7, focus: () => [queuePos(0)[0], 0.6, queuePos(0)[2]] },
  { f: 690, dur: 14, cInf: 4, focus: () => [0.6, 1.0, -5.0] },
  { f: 740, dur: 14, cInf: 6, focus: pigHead(6) },
  { f: 806, dur: 14, cInf: 6, focus: (f) => at(eleMegara(KING_ELE, f).pos, 0, 3.2, -1.5) },
  { f: 870, dur: 18, cInf: 0 },
  { f: 1005, dur: 1, cInf: 8, focus: () => at(WRITER_AT, 0, 1.2, 0) },
  { f: 1056, dur: 16, cInf: 10, focus: () => SCROLL_AT },
  { f: 1108, dur: 1, cInf: 6, focus: () => at(ANT_STABLE, 0, 1.6, 0) },
  { f: 1160, dur: 16, cInf: 6, focus: (f) => lerp3(TRAINERS[0].from, TRAINERS[0].to, linF(f, CARRY[0], CARRY[1])) },
  { f: 1215, dur: 16, cInf: 10, focus: () => at(BABY[0], 0.3, 0.7, 0.8) },
  { f: 1295, dur: 1, cInf: 0 },
  { f: 1430, dur: 14, cInf: 6, focus: () => at(ROMAN_AT, 0, 1.6, 0) },
  { f: 1520, dur: 16, cInf: 6, focus: (f) => pigEdessa(f).pos },
  { f: 1576, dur: 10, cInf: 12, focus: (f) => pigEdessa(f).pos },
];
/** blur and focus glide between entries (a focus pull over `dur`, default 10 frames), never a one-frame focus jump */
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = smooth((f - d.f) / (d.dur ?? 10));
  const lookOf = (g: number) => camStatic(shotAt(g).id, g).look;
  const fp = p.focus ?? lookOf, fd = d.focus ?? lookOf;
  const focus = k < 1 ? (g: number) => lerp3(fp(g), fd(g), k) : fd;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus };
};
export const focusAt = (sid: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(sid, f).look; };

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts kitClone() */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
