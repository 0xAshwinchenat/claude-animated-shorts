// "The Dirt Wall Genghis Khan's Best General Couldn't Break" (Mongol siege of Kaifeng, 1232): our original ~69 s short.
// THE CONTRACT between all owners: world layout constants, story beats (frames, from the voice's words.json), the
// shared projectile / impact schedule, shots, camera paths (camrig flow), kicks, depth of field, retention markers.
// Voice: kaifeng-short/voice/data/narration.wav (68.63 s, ElevenLabs "Jesse", x1.27). Word frames in SHOTPLAN.md.
// Axes: +x = EAST, -z = NORTH (+z = south), +y = up. 1 unit = 1 m. Story frames are 30 fps.
import { flow, type Flow, type FlowKey } from "./camrig";
import type { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 2070; // 69.0 s: last word "gate." ends at 2052, then ~0.5 s of payoff image (loops to frame 0)
export const G = 0;
export const D0 = G;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
/** 0 before frame a, 1 after frame b, smooth between (frames) */
export const rampF = (f: number, a: number, b: number) => smooth((f - a) / Math.max(1e-6, b - a));
export const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];
/** deterministic hash 0..1 */
export const hash = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// ================= the city of Kaifeng (Bianjing), Jin capital, 1232 =================
// A square city centred on the origin. Its wall is RAMMED EARTH (pounded loess in 8-12 cm layers, ochre, no bricks):
// battered faces, a 7 m walkway on top with a crenellated parapet on the outer edge, wooden towers on the walkway.
export const HALF = 60;            // outer face of the wall at its BASE: x = +-60, z = +-60 (a 120 m square)
export const WALL_H = 10;          // walkway level
export const BATTER = 0.3;         // the outer face leans in 0.3 m per m of height (60 at y = 0 -> 57 at y = 10)
export const WALL_BASE_T = 13;     // base thickness (inner face at 47 at y = 0 -> 50 at y = 10); walkway x 50..57
export const PARAPET_H = 1.5;      // crenellated parapet on the outer edge of the walkway (merlons 1.2 m wide, gaps 0.8 m)
/** outer face distance from the centre at height y (east wall: x = outerX(y); north wall: z = -outerX(y); ...) */
export const outerX = (y: number) => HALF - BATTER * Math.max(0, Math.min(WALL_H, y));
// East gate (the hook, the peace offer, the ending): passage z -3..3 through the wall, 7 m high, wooden doors (two
// leaves, 3 m each, hinged at z = +-3 on the OUTER face, opening INWARD), a 2-storey wooden gate tower on top
// (16 m along z x 8 m, red posts, grey tiled hip roofs) whose eaves overhang the outer face.
export const GATE: V3 = [HALF, 0, 0];
export const GATE_W = 6, GATE_HGT = 7;
// Wooden towers on the walkway (louver-walled lookout huts, palace timber, 5 x 5 m, 6 m tall to the roof ridge) every
// 24 m along each wall + bigger corner towers. Two are heroes on the EAST wall's north half:
export const TOWER_SMASH: V3 = [53.5, WALL_H, -24];  // shattered by a boulder at "lucky" (782)
export const TOWER_HERO: V3 = [53.5, WALL_H, -48];   // padded with dung, straw and felt (796-885)
export const CORNER_NE: V3 = [HALF, 0, -HALF];
// the defenders' own (traction) trebuchet on the east walkway, throwing OUT over the parapet (east), and its rock
export const DEF_TB: V3 = [53.0, WALL_H, -36];
// the iron bomb lowered on a chain over the parapet at z = BOMB_Z, down the east face to the cowhide tents
export const BOMB_Z = -22;
// the courtyard just inside the east gate: the granary jars (empty) at "run out of food"
export const FOOD_AT: V3 = [38, 0, 10];
// the rubble heap that grows against the east face by the NE corner (z -58..-36), up to ~8.6 m at heapK = 1
export const HEAP: V3 = [61, 0, -47];

// ================= the Mongol siege =================
// Subutai's command post 38 m east of the gate, his own (hero) traction trebuchet beside him. Traction trebuchet =
// A-frame ~6 m, beam ~10 m on a pivot at 6 m; ropes hang from the SHORT arm on the target (west) side where the rope
// crew stands; at rest the LONG arm + sling lies back/down to the east; a yank swings it up and over, releasing west.
// Frame 0: Subutai faces SOUTH-EAST (toward the camera, bellowing "fire!" at the rope crew behind the lens: Toon3D
// yaw = +PI/4), baton up; his trebuchet stands BEHIND him to the north-west and throws west; he turns west (3 f) at ~98
// to watch boulder 2. The camera sits south-east of him looking north-west, then pans 45 deg left to ride the boulder.
export const SUB_AT: V3 = [98.5, 0, 9.5];
export const SUB_YAW0 = Math.PI / 4;
export const HERO_TB: V3 = [95.0, 0, 6.0];     // pivot above this point, beam in the x-y plane, throws west
export const HERO_PIVOT_Y = 6.0, HERO_LONG = 7.0, HERO_SHORT = 2.6;
// four batteries of 100 trebuchets (10 x 10 grid, 6 m spacing, each grid rotated to face its wall corner), centred
// 42 m out from each corner on the diagonal
export const BATTERIES: { c: V3; corner: V3; yaw: number }[] = [
  { c: [HALF + 42, 0, -HALF - 42], corner: [HALF, 0, -HALF], yaw: Math.atan2(-1, 1) },   // NE (the night + millstone beats)
  { c: [HALF + 42, 0, HALF + 42], corner: [HALF, 0, HALF], yaw: Math.atan2(-1, -1) },    // SE
  { c: [-HALF - 42, 0, HALF + 42], corner: [-HALF, 0, HALF], yaw: Math.atan2(1, -1) },   // SW
  { c: [-HALF - 42, 0, -HALF - 42], corner: [-HALF, 0, -HALF], yaw: Math.atan2(1, 1) },  // NW
];
export const BATT_N = 10, BATT_SP = 6;
/** NE battery trebuchet that throws the millstone thirds (loaded 572-590, released 596): row 1, column 0 = on the
 *  battery's open SOUTH-EAST FLANK (the night beat is staged outside the grid, the camera looks in from the flank) */
export const MILL_TREB = 10;
/** world position of trebuchet i (0..99) of battery b (row = i / 10 counted from the front = nearest the corner) */
export const battTreb = (b: number, i: number): V3 => {
  const B = BATTERIES[b], r = Math.floor(i / BATT_N), c = i % BATT_N;
  const fx = (B.corner[0] - B.c[0]), fz = (B.corner[2] - B.c[2]), fl = Math.hypot(fx, fz);
  const ux = fx / fl, uz = fz / fl, vx = -uz, vz = ux;        // u = toward the corner, v = across
  const du = (BATT_N / 2 - 0.5 - r) * BATT_SP, dv = (c - (BATT_N / 2 - 0.5)) * BATT_SP;
  return [B.c[0] + ux * du + vx * dv, 0, B.c[2] + uz * du + vz * dv];
};
// the army: ranks of horsemen and foot soldiers with banners east of the camp (x 115..190, z -60..70), yurts behind
export const ARMY = { x0: 115, x1: 190, z0: -60, z1: 70 };
export const CAMP = { x0: 190, x1: 260, z0: -70, z1: 80 };
// cowhide tents (wheel-less hide shells, ~2.4 x 1.6 x 1.2 m, legs showing under the rim) creeping to the east face
export const TENTS: { from: V3; to: V3 }[] = [
  { from: [70.5, 0, -21], to: [61.4, 0, -22.2] },
  { from: [72.5, 0, -25.5], to: [64.8, 0, -24.8] },
  { from: [74, 0, -18.5], to: [66.5, 0, -19.4] },
];
export const tentK = (f: number) => rampF(f, 985, 1110);    // 0 at the start points -> 1 at the wall base (~2 m/s scuttle)
/** the iron bomb on its chain: hangs from the tip of a wooden boom that reaches out over TENTS[0].to from the parapet at
 *  z = BOMB_Z; lowered by chainK from the boom tip (y 12) to just above the tent (y 1.4); gone from BOOM_F */
export const BOMB_TIP: V3 = [61.4, 12.0, -22.2];
export const bombAt = (f: number): V3 => [BOMB_TIP[0], BOMB_TIP[1] - (BOMB_TIP[1] - 1.4) * chainK(f), BOMB_TIP[2]];
// the peace offer: Subutai in front of the gate holding up a scroll
export const SUB_PEACE: V3 = [70.5, 0, 4.5];
// the question: Subutai pokes a dent at hand height by the gate (0.75 m from the face: within arm's reach)
export const SUB_POKE: V3 = [60.2, 0, 11.9];
export const POKE_DENT: V3 = [59.45, 1.75, 12.3];

// ================= venues (far from the city; separate lighting) =================
export const LESSON: V3 = [0, 0, 900];      // inside Subutai's yurt: a low table with a plate, a rammed-earth block, a pillow
export const PLATE: V3 = at(LESSON, -0.45, 0.72, 0.05);
export const EBLOCK: V3 = at(LESSON, 0.1, 0.72, 0.0);     // 0.36 m cube of layered rammed earth, layer lines horizontal, face +z
export const PILLOW: V3 = at(LESSON, 0.62, 0.72, 0.08);
export const LESSON_SUB: V3 = at(LESSON, 0.05, 0, -0.85); // Subutai behind the table, facing +z (the camera side)
export const MACRO: V3 = [0, 0, 1500];      // inside the dirt: a bed of grains (r 0.2-0.6 m) in strata, face +z; a boulder (r 3) lands
export const GREAT: V3 = [-900, 0, 0];      // a Ming brick Great Wall on a ridge, cut open to show its pounded-earth heart

// ================= story beats (frames) =================
// hero trebuchet releases (beam yank ~8 f before, swing over ~10 f, slow return ~40 f)
export const HERO_FIRES = [24, 96];
/** beam angle state of a trebuchet whose release frames are `fires`: 0 = resting (long arm back/down), 1 = thrown */
export const beamK = (f: number, fires: number[]) => {
  let k = 0;
  for (const r of fires) {
    if (f < r - 8 || f > r + 60) continue;
    k = Math.max(k, f < r + 2 ? easeOut((f - (r - 8)) / 10) : 1 - smooth((f - (r + 14)) / 46));
  }
  return k;
};
// battery fire: a ragged opening volley at "every corner" (392-414) by 30 %, then ALL at "hundred catapults" (440-456,
// a wave front to back), then at night (500-612) the NE battery keeps firing (each ~ every 70 f)
export const battFires = (b: number, i: number): number[] => {
  const r = Math.floor(i / BATT_N), out: number[] = [];
  if (hash(i, b + 1) < 0.3) out.push(392 + Math.floor(hash(i, b + 9) * 22));
  out.push(438 + r * 2 + Math.floor(hash(i, b + 5) * 4));
  if (b === 0 && i === MILL_TREB) out.push(596);   // the millstone trebuchet: one night throw (the thirds, PROJ "mill")
  else if (b === 0) for (let f = 500 + Math.floor(hash(i, 7) * 70); f < 612; f += 66 + Math.floor(hash(i, 3) * 10)) out.push(f);
  return out;
};
/** THE battery swarm (single source of truth for the camp owner's boulders, the char owner's dust bursts and the audio):
 *  one shot per release in battFires(b, i): from the trebuchet's release point (4.5 m toward its corner, y 7.5) to a
 *  deterministic target by the corner: 35 % the x-face, 35 % the z-face (y 2-9.5, 2-40 m from the corner), 30 % over
 *  the wall into the city (y 0). ~1.1 m/frame, parabolic (projAt works on these). */
export type BattShot = { b: number; i: number; f0: number; f1: number; from: V3; to: V3; apex: number; r: number; over: boolean };
export const battShots = (b: number, i: number): BattShot[] => {
  const B = BATTERIES[b], p = battTreb(b, i), sx = Math.sign(B.corner[0]), sz = Math.sign(B.corner[2]);
  const ux = B.corner[0] - B.c[0], uz = B.corner[2] - B.c[2], ul = Math.hypot(ux, uz);
  const from: V3 = [p[0] + (ux / ul) * 4.5, 7.5, p[2] + (uz / ul) * 4.5];
  return battFires(b, i).map((f0, k) => {
    const h = hash(i * 7 + k, b + 31), d = 2 + 38 * hash(i * 13 + k, b + 41), y = 2 + 7.5 * hash(i * 17 + k, b + 51);
    let to: V3, over = false;
    if (h < 0.35) to = [sx * (outerX(y) + 0.05), y, sz * (HALF - d)];
    else if (h < 0.7) to = [sx * (HALF - d), y, sz * (outerX(y) + 0.05)];
    else { over = true; to = [sx * (HALF - 10 - d * 0.8), 0, sz * (HALF - 10 - 30 * hash(i * 19 + k, b + 61))]; }
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    return { b, i, f0, f1: f0 + Math.round(dist / 1.1), from, to, apex: 16 + 6 * hash(i + k, b + 71), r: 0.45, over };
  });
};
export type Proj = { kind: "boulder" | "mill" | "garden"; f0: number; f1: number; from: V3; to: V3; apex: number; r: number; dent: boolean };
const SLING = (p: V3): V3 => [p[0] - 4.5, 8.5, p[2]];      // release point of a trebuchet whose pivot sits above p (throwing west)
/** wall face point on the east face at height y, along z */
export const eastFace = (y: number, z: number): V3 => [outerX(y) + 0.05, y, z];
export const PROJ: Proj[] = [
  // the hook: Subutai's own trebuchet
  { kind: "boulder", f0: 24, f1: 72, from: SLING(HERO_TB), to: eastFace(5.6, 15.5), apex: 17, r: 0.5, dent: true },
  { kind: "boulder", f0: 96, f1: 148, from: SLING(HERO_TB), to: eastFace(5.2, 11.0), apex: 16, r: 0.5, dent: true },   // the camera rides it ("city wall" 143-149)
  // "for 16 days and nights": impacts along the face while the camera pans (from off-screen batteries)
  { kind: "boulder", f0: 120, f1: 166, from: [104, 9, -20], to: eastFace(6.8, 4.5), apex: 18, r: 0.45, dent: true },
  { kind: "boulder", f0: 136, f1: 181, from: [104, 9, 30], to: eastFace(3.9, 18.5), apex: 18, r: 0.45, dent: true },
  { kind: "boulder", f0: 148, f1: 194, from: [104, 9, -10], to: eastFace(7.5, -6.5), apex: 18, r: 0.45, dent: true },
  { kind: "boulder", f0: 160, f1: 207, from: [104, 9, 34], to: eastFace(5.0, 24.0), apex: 18, r: 0.45, dent: true },
  // "And it never broke" (270-280): one lands in the close-up and drops to the foot of the wall
  { kind: "boulder", f0: 226, f1: 272, from: SLING(HERO_TB), to: eastFace(4.3, 13.6), apex: 15, r: 0.5, dent: true },
  // night: the millstone thirds flung at the NE corner (after the smash at 562)
  { kind: "mill", f0: 596, f1: 646, from: [103.0, 8.5, -64.9], to: [outerX(6) + 0.05, 6, -56], apex: 18, r: 0.55, dent: true },
  // day: "The wall? Just dents." (692-725) on the east face above the heap
  { kind: "boulder", f0: 668, f1: 716, from: [104, 9, -60], to: eastFace(9.0, -40.5), apex: 17, r: 0.45, dent: true },
  // "weren't so lucky" (773-790): a boulder smashes TOWER_SMASH
  { kind: "boulder", f0: 738, f1: 782, from: [104, 9, -40], to: [TOWER_SMASH[0] + 1.5, WALL_H + 3.2, TOWER_SMASH[2]], apex: 19, r: 0.5, dent: false },
  // the old emperor's garden rock, thrown back out by DEF_TB, misses and lands by the tents
  { kind: "garden", f0: 962, f1: 998, from: [DEF_TB[0] + 3.0, WALL_H + 7.5, DEF_TB[2]], to: [73.5, 0.6, -23.5], apex: 20, r: 0.7, dent: false },
];
/** position of a projectile at frame f (null when not in flight): straight in x/z, parabola in y through the apex */
export const projAt = (p: Proj, f: number): V3 | null => {
  if (f < p.f0 || f > p.f1) return null;
  const u = (f - p.f0) / (p.f1 - p.f0), base = p.from[1] + (p.to[1] - p.from[1]) * u;
  const top = Math.max(p.apex, p.from[1], p.to[1]);
  return [p.from[0] + (p.to[0] - p.from[0]) * u, base + 4 * (top - (p.from[1] + p.to[1]) / 2) * u * (1 - u), p.from[2] + (p.to[2] - p.from[2]) * u];
};
/** background dent density on the walls (0 at the start -> 1 = pockmarked) for dents not in PROJ */
export const pockK = (f: number) => (f < 500 ? 0.15 * rampF(f, 140, 480) : 0.15 + 0.85 * rampF(f, 500, 690));
/** rubble heap against the east face by the NE corner: 0 none -> 1 ~8.6 m high (grows at night, visibly 616-674) */
export const heapK = (f: number) => (f < 520 ? 0 : 0.35 * rampF(f, 520, 612) + 0.6 * rampF(f, 612, 676));
// night: the millstone smash (a Mongol crewman's sledgehammer CONTACT frame, "smashed" 560)
export const F_SMASH = 560;
export const MILL_AT: V3 = [108.4, 0, -63.8];    // the millstone on open ground just OUTSIDE the NE battery's south-east flank, by MILL_TREB
export const AMMO_AT: V3 = [110.0, 0, -61.6];    // the (empty) ammo spot beside it ("ran out of rocks" 526-543)
// wall top
export const towerSmashK = (f: number) => rampF(f, 782, 790);  // TOWER_SMASH: 0 whole -> 1 shattered (roof + front posts down)
export const dungK = (f: number) => rampF(f, 833, 846);        // dung patties slapped on TOWER_HERO's posts
export const strawK = (f: number) => rampF(f, 848, 866);       // straw bundles stacked against it
export const feltK = (f: number) => rampF(f, 866, 886);        // felt blankets thrown over its rails + roof
export const DEF_FIRE = 962;                                   // the defenders' trebuchet release (loaded from 935)
// the bomb: lowered from the parapet (1060) to the tent (1124), explodes at BOOM_F
export const chainK = (f: number) => rampF(f, 1062, 1124);
export const BOOM_F = 1131;
// the ending (shot 18): the camera is INSIDE the gate passage looking east at the closed doors ("And the Mongols? A
// year later" 1924-1954); the doors swing open toward the camera at "walked right in" (1962-1982) revealing Subutai
// (waiting at SUB_GATE with his army); he strolls in past Cui Li (inside, holding the north door, bowing: "A general
// inside simply opened the gate" 2002-2047) and passes the lens 3/4 close (the payoff image matches frame 0)
export const gateK = (f: number) => (f < 1900 ? 0 : rampF(f, 1962, 1982));
/** each door leaf swings INWARD (toward -x) about its hinge at (GATE x - 0.5, z = +-GATE_W/2) by doorDeg(f) degrees
 *  (north leaf hinge z = -3 rotates clockwise seen from above, south leaf mirrored); 0 = shut across the passage */
export const DOOR_OPEN_DEG = 86;
export const doorDeg = (f: number) => DOOR_OPEN_DEG * gateK(f);
export const SUB_GATE: V3 = [61.8, 0, 0.4];       // Subutai waits just outside the closed gate (shot 18 start); walks in from ~1984
export const CUI_AT: V3 = [56.2, 0, -2.1];        // Cui Li inside the passage by the north door
// the lesson: hammer on the plate, the macro boulder, the punch
export const F_PLATE = 1556, F_MACRO = 1700, F_PUNCH = 1790;
// exact contact points measured by the venue owner (the hammer head and the fist land here)
export const PLATE_HIT: V3 = [-0.45, 0.862, 900.05];
export const PILLOW_TOP: V3 = [0.62, 0.862, 900.08];
/** the macro boulder's first contact (MACRO + (0, 9.19, -1)); it comes to rest centred 1.6 m higher (r 3) */
export const MACRO_HIT: V3 = [0, 9.19, 1499];
/** the pillow dent depth 0..1 (8.5 cm at 1): in over 4 f at the punch, recovering slowly */
export const pillowDentK = (f: number) => (f < F_PUNCH ? 0 : easeOut((f - F_PUNCH) / 4) * (1 - 0.8 * smooth((f - F_PUNCH - 12) / 63)));
// Great Wall: the cutaway opens to show the heart (0 closed -> 1 open)
export const cutK = (f: number) => rampF(f, 1858, 1884);

// ================= shots =================
export type SetName = "kaifeng" | "lesson" | "macro" | "great";
export type Light = LightName;
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName };
const SH: [number, Light, SetName][] = [
  [0, "day", "kaifeng"],      // 1  L0 hook: Subutai + his trebuchet, ride the boulder to the wall, impacts along it
  [215, "day", "kaifeng"],    // 2  L1 "made of dirt ... never broke": the layered face, dents
  [303, "day", "kaifeng"],    // 3  L2 SET PIECE starts: turn + rise over the army
  [384, "day", "kaifeng"],    // 4  L3 god's view: 4 batteries, the volley
  [500, "night", "kaifeng"],  // 5  L4b-L5 night at the NE battery, millstones
  [612, "day", "kaifeng"],    // 6  L6-L7 the rubble heap, "Just dents"
  [742, "day", "kaifeng"],    // 7  L8 the wall top: smashed tower, padding
  [901, "day", "kaifeng"],    // 8  L9 garden rocks
  [995, "day", "kaifeng"],    // 9  L10 cowhide tents, the bomb on a chain
  [1132, "day", "kaifeng"],   // 10 L11 boom
  [1178, "day", "kaifeng"],   // 11 L12 peace offer at the gate
  [1292, "day", "kaifeng"],   // 12 L13 over the wall: the empty food jars
  [1365, "day", "kaifeng"],   // 13 L14 Subutai pokes a dent
  [1458, "day", "lesson"],    // 14 L15 the plate
  [1612, "day", "macro"],     // 15 L16-L17 inside the dirt: grains, the boulder, the dent
  [1772, "day", "lesson"],    // 16 L17 end: fist in a pillow
  [1813, "golden", "great"],  // 17 L18 brick Great Wall, its heart of pounded dirt
  [1920, "day", "kaifeng"],   // 18 L19-L20 frame-0 framing: the gate opens, Subutai walks in (loop)
];
export const SHOTS: ShotDef[] = SH.map(([a, light, set], i) => ({ id: i + 1, a, b: i + 1 < SH.length ? SH[i + 1][0] : TOTAL, light, set }));
/** 7-frame dissolves at place / light changes that are not portals (shot id -> frames) */
export const XFADE: Record<number, number> = { 5: 7, 6: 7, 13: 7, 14: 7, 15: 7, 16: 7, 17: 7, 18: 7 };
export const FLASH_AT = -100;   // no white flash in this short
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - Math.floor(x / 2) && f < s.a - Math.floor(x / 2) + x) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - Math.floor(x / 2)) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** retention markers for cam_qa gate 14: the set piece (army reveal -> god's view volley) and the first answer frame */
export const RETENTION = { setPiece: [303, 470] as [number, number], resolve: 1462 };

// ================= camera: one continuous flight per place (camrig.ts) =================
// FIRST PASS (rough): the lead refines these on stills once the sets exist. Keep >= 0.8 m from every structure.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const K = (f: number, pos: V3, look: V3, fov = 44, roll = 0): FlowKey => ({ f, at: { pos, look, fov, roll } });
/** a look point `d` m down the ray from pos through `near` (same framing; far look points interpolate as clean rotations) */
const far = (pos: V3, near: V3, d = 40): V3 => {
  const v: V3 = [near[0] - pos[0], near[1] - pos[1], near[2] - pos[2]], l = Math.hypot(...v) || 1;
  return [pos[0] + (v[0] / l) * d, pos[1] + (v[1] / l) * d, pos[2] + (v[2] / l) * d];
};
/** key looking at `near` but with a far look point on the same ray */
const KF = (f: number, pos: V3, near: V3, fov = 44, roll = 0) => K(f, pos, far(pos, near), fov, roll);
const LS = (x: number, y: number, z: number): V3 => at(LESSON, x, y, z);
const MC = (x: number, y: number, z: number): V3 => at(MACRO, x, y, z);
const GW = (x: number, y: number, z: number): V3 => at(GREAT, x, y, z);
/** path of each shot (shots on one path share one continuous camera) */
export const PATH_OF = [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 3, 4, 5, 4, 6, 7];
export const pathOf = (sid: number) => PATH_OF[sid - 1];
const PATHS: Flow[] = [
  // 0: hook -> the wall -> SET PIECE (turn east over the army, rise to the god's view of the 4 batteries)
  flow([
    KF(0, [102.5, 1.3, 11.9], [98.35, 2.55, 9.45], 46),         // low angle: Subutai (3/4, facing us), baton up; the giant trebuchet above + behind him
    KF(12, [102.25, 1.32, 11.75], [98.35, 2.6, 9.45], 46),      //   a quick push as he chops
    KF(30, [102.3, 1.3, 11.85], [98.1, 2.95, 9.2], 49),         // tilt up a little + widen: the beam swings over his head (release 24), face stays in
    KF(58, [101.4, 1.62, 11.2], [98.4, 1.98, 9.45], 38),        // push on his proud face ("greatest general" 59-64)
    KF(84, [101.6, 1.86, 11.45], [98.45, 1.74, 9.45], 37),      //   drift ("Subutai" 85)
    KF(102, [101.5, 2.2, 11.9], [62, 6.6, 11.2], 42),           // WHIP-pan 30 deg left onto boulder 2 (released 96; "threw" 100)
    KF(110, [101.2, 2.4, 12.0], [62, 6.6, 11.3], 42),           //   settle (the whip ends)
    K(150, [77, 6.3, 12.4], [58.6, 5.2, 11.0], 44),             // ride after it; it hits at 148 ("city wall" 143-149)
    K(182, [73.5, 6.0, 15.0], [58.6, 5.6, 10.5], 46),           // drift along the face: impacts ("16 days and nights")
    K(214, [69.5, 5.0, 17.6], [58.6, 4.9, 12.0], 44),
    KF(246, [69.0, 5.2, 18.0], [58.6, 6.6, 12.8], 46),          // "made of dirt" (244): the layered face up to the battlements, dents
    KF(264, [68.7, 5.1, 18.1], [58.6, 6.3, 13.0], 46),          //   drift
    KF(284, [68.3, 4.6, 18.2], [58.6, 4.6, 13.3], 45),          // "never broke" (270-280): tilt down after the dropping boulder
    KF(298, [68.5, 4.7, 18.35], [58.6, 4.7, 13.2], 45),         //   drift
    K(326, [73, 7.2, 19.8], [50, 4.0, 9], 46),                  // SET PIECE burst 1: pull back off the wall
    K(340, [75.5, 7.9, 20.6], [48.5, 3.7, 8.7], 47),            //   drift
    K(376, [184, 37, 30], [20, 0, 0], 52),                      // burst 2: back over Subutai's post and the army ("Russia" 364)
    K(392, [205, 58, 30.4], [16, 0, 0], 52),                    //   drift: ranks fill the frame bottom, the city far
    K(436, [112, 415, 2], [0, 0, 0], 60),                       // burst 3: rise to the god's view, 4 batteries ("every corner" 391-414)
    K(446, [110, 404, -1], [0, 0, -1], 60),                     //   drift
    K(470, [104, 330, -16], [2, 0, -8], 58),                    // burst 4: push in as all 400 fire ("hundred catapults" 445-456)
    K(500, [104, 300, -26], [6, 0, -14], 57),                   //   drift (night dissolve at 497-503)
  ]),
  // 1: night at the NE battery: trebuchets against the moon, the empty ammo pile, the millstone smash, fire those
  flow([
    // from OUTSIDE the battery's south-east flank looking north-west into the firing rows (the moon above them)
    KF(494, [121, 7.5, -50.5], [104, 4.5, -70], 46),            // the battery firing at night ("night" 508)
    KF(528, [114.6, 3.1, -57.3], [110.0, 0.9, -61.6], 42),      // "ran out of rocks" (536-543): the empty spot, crewman A
    KF(546, [114.2, 2.9, -57.7], [109.6, 0.9, -62.2], 41),      //   drift
    KF(562, [113.3, 2.45, -58.3], [108.4, 0.75, -63.8], 40),    // "smashed millstones" (560-568): CONTACT 560
    KF(580, [113.5, 2.6, -58.0], [108.1, 1.2, -64.3], 41),      //   the heave-toss into MILL_TREB's sling (572-582)
    KF(602, [114.6, 3.9, -56.9], [104.5, 6.8, -68.5], 44),      // "fired those" (590-600): the thirds fly (596)
    KF(618, [115.2, 4.8, -56.4], [101, 8.5, -70], 46),
  ]),
  // 2: day: the heap by the NE corner -> up to the walkway -> towers -> garden rock -> tents + bomb -> boom -> the
  //    peace offer at the gate -> over the gate tower into the city: the empty jars
  flow([
    KF(606, [80, 3.2, -30], [62, 3.0, -48], 44),                // the heap of rubble against the face
    KF(646, [74, 7.2, -33], [61, 6.4, -48], 44),                // crane up the heap ("piled up" 628-637)
    KF(680, [69, 10.6, -35], [59, 8.6, -46], 42),               // "as high as the wall" (660-674)
    KF(712, [66.5, 10.2, -37], [58.6, 8.8, -41.5], 40),         // "The wall? Just dents." (692-725)
    KF(752, [72.0, 17.5, -36.0], [54, 12.4, -34.5], 44),        // pull back + up: the walkway, both wooden towers ("wooden towers" 745)
    KF(786, [72.6, 17.8, -33.5], [54, 12.8, -26.5], 44),        //   drift onto TOWER_SMASH as it shatters (782)
    KF(800, [72.7, 17.85, -33.4], [54, 12.6, -27.0], 44),       //   hold: planks rain down ("so lucky" 784)
    KF(832, [69.0, 17.0, -38.5], [54.2, 11.8, -44.6], 43),      // pan + push to TOWER_HERO's defenders ("padded them" 813-825)
    KF(878, [64.2, 15.2, -40.1], [54.0, 11.5, -45.4], 41),      //   push in: dung 835, straw 850, felt 869-874
    KF(892, [63.6, 14.9, -40.3], [53.95, 11.45, -45.5], 41),    //   drift
    KF(926, [65.5, 10.6, -8.5], [53.8, 13.2, -35.5], 43),       // swing south along the face: the defenders' trebuchet side-on
    KF(958, [65.9, 10.0, -5.3], [54.2, 13.6, -35.5], 42),       //   drift: they load the garden rock ("emperor's" 937), release 962
    KF(998, [68.0, 6.0, 0.0], [72.5, 2.0, -23.0], 42),          //   follow its arc out east: it lands by the tents (998)
    KF(1010, [68.4, 5.8, -0.6], [72.0, 1.8, -23.0], 42),        //   drift
    KF(1038, [79, 4.4, -9.5], [66.5, 1.0, -21.5], 42),          // "crept up under cowhide tents" (1008-1040)
    KF(1056, [78.6, 4.5, -9.8], [66.0, 1.3, -21.8], 42),        //   drift
    KF(1080, [76.5, 6.0, -10.5], [62.0, 8.8, -22.2], 44),       // tilt up the face to the boom: "lowered" (1073)
    KF(1092, [76.3, 5.9, -10.7], [62.0, 8.0, -22.2], 44),       //   drift
    KF(1122, [76.0, 4.8, -11.0], [61.8, 3.0, -22.2], 44),       // "bombs on chains" (1094-1109): follow it down onto the tent
    KF(1140, [79.5, 5.8, -8.8], [62.0, 3.2, -22.4], 46),        // BOOM 1131 (kick): ease back
    KF(1170, [79, 3.6, -11.0], [64.5, 1.5, -21.0], 42),         // "No more tent" (1147-1159): sooty diggers run
    KF(1206, [80.5, 2.5, 9.6], [70.4, 2.0, 4.6], 40),           // Subutai with the peace scroll, the gate behind him ("offered peace" 1265)
    KF(1226, [80.2, 2.55, 9.7], [70.4, 2.05, 4.6], 40),         //   drift
    KF(1258, [75.5, 13.5, 10.5], [56.2, 11.8, 10.2], 42),       //   crane up to the defenders cheering over the parapet south of the gate tower
    KF(1276, [75.0, 13.8, 10.6], [56.2, 11.9, 10.2], 42),       //   drift
    KF(1308, [62.0, 23.0, 15.0], [44.0, 6.0, 12.0], 46),        // "Unluckily" (1292): up over the walkway SOUTH of the gate tower
    KF(1336, [44.6, 4.6, 14.6], [38.2, 0.8, 10.0], 42),         // down into the courtyard: the empty jars ("food" 1349)
    KF(1372, [43.6, 3.9, 13.9], [38.2, 0.9, 10.0], 40),
  ]),
  // 3: Subutai pokes a dent by the gate: push in on the puzzle
  flow([
    K(1360, [67.5, 2.6, 17.5], [60.5, 1.6, 12.6], 42),
    K(1400, [65.3, 2.2, 15.4], [60.5, 1.6, 12.6], 40),          // "a wall of dirt" (1384-1398)
    K(1444, [63.9, 1.95, 14.2], [60.2, 1.65, 12.6], 36),        // "best siege army on Earth?" (1417-1445)
    K(1466, [63.6, 1.9, 14.0], [60.2, 1.65, 12.6], 35),
  ]),
  // 4: the lesson (the plate, then the portal into the earth block; later the pillow)
  flow([
    KF(1452, LS(-0.05, 1.62, 3.2), LS(0.0, 1.45, -0.4), 40),    // the table: plate, earth block, pillow; Subutai (face in frame) behind it
    KF(1500, LS(-0.2, 1.5, 2.7), LS(-0.2, 1.3, -0.2), 40),      // drift toward the plate ("like a plate" 1523-1530)
    KF(1540, LS(-0.42, 1.3, 1.9), LS(-0.43, 0.84, 0.05), 38),   //   push in
    KF(1562, LS(-0.42, 1.27, 1.78), LS(-0.43, 0.83, 0.05), 38), // the hammer hits (1556), "cracks right through" (1566-1587)
    KF(1580, LS(-0.36, 1.25, 1.72), LS(-0.38, 0.83, 0.05), 38), //   drift
    KF(1614, LS(0.08, 1.06, 1.05), LS(0.1, 0.9, 0.18), 38),     // glide + push toward the block's layered face ("Pounded dirt" 1608)
    KF(1772, LS(0.56, 1.06, 1.18), LS(0.62, 0.86, 0.08), 40),   // (dissolve back in at 1772) on the pillow, waiting
    KF(1792, LS(0.55, 1.03, 1.02), LS(0.62, 0.85, 0.08), 39),   // "like a fist in a pillow" (1788-1800): punch 1790, push
    KF(1818, LS(0.53, 1.1, 1.25), LS(0.6, 0.86, 0.06), 40),
  ]),
  // 5: inside the dirt: the grain bed (a cliff of strata, face +z), the boulder lands, the dent, pull out
  flow([
    KF(1606, MC(-0.5, 8.0, 22.6), MC(-0.5, 4.0, 0), 38),         // (dissolve in at 1612: matches the lesson framing) the block's face, magnified
    KF(1640, MC(-0.3, 8.5, 20.4), MC(-0.3, 4.6, 0), 40),         //   push: a cliff of grains ("billions of tiny grains" 1628-1656)
    KF(1664, MC(1.6, 11.0, 24.0), MC(0, 8.6, 0), 42),            // rise: the bed's top comes into view
    KF(1690, MC(4.6, 14.6, 29.0), MC(0, 11.2, -1), 44),          // "A boulder" (1678): it falls into view, lands 1700
    KF(1716, MC(4.9, 14.8, 28.4), MC(0, 10.6, -1), 44),          // "crushes the grains it touches" (1697-1721)
    KF(1750, MC(3.6, 14.0, 26.0), MC(0, 10.4, -1), 43),          // "dies in a dent" (1744-1769)
    KF(1778, MC(3.0, 13.7, 25.2), MC(0, 10.4, -1), 42),          //   drift (dissolve to the pillow at 1772)
  ]),
  // 6: the Great Wall on its ridge (golden): along the brick wall to the cut, the earth heart inside
  flow([
    // the cut face is centred at GW(0, 4.5, 0), 6.8 m wide x 8.9 m tall, facing (0.92, 0, 0.39); the 10 m slice slides
    // 9 m away along the wall (0.39, 0, -0.92). Arrive along the ridge, end square on to the cut face.
    KF(1806, GW(34, 17, 2), GW(0, 6.5, 0), 46),                  // golden ridge, the brick wall snaking along it
    KF(1846, GW(21, 9.5, 5.5), GW(0, 5.2, 0), 43),               // "China's walls" (1858-1864): closer, the slice starts to slide (1858)
    KF(1884, GW(14.2, 6.6, 6.0), GW(0, 4.6, 0), 40),             // "a heart" (1882): square on to the cut, the pounded-earth core
    KF(1926, GW(13.0, 6.3, 5.5), GW(0, 4.5, 0), 39),             // "pounded dirt" (1894-1904): push
  ]),
  // 7: the ending, INSIDE the gate passage looking east: the closed doors; they swing open toward us (1962-1982),
  //    Subutai outside; Cui Li holding the north door; Subutai strolls in and passes the lens front-left 3/4 (= frame 0)
  flow([
    KF(1914, [48.6, 2.2, 1.3], [60, 2.6, -0.3], 46),
    KF(1950, [50.2, 2.0, 1.0], [60, 2.5, -0.3], 44),             // "A year later" (1946-1954): the doors, closed
    KF(1984, [51.2, 1.9, 0.8], [62, 1.9, 0.3], 44),              // "walked right in" (1968-1984): they swing open: Subutai
    KF(2014, [51.1, 1.86, 1.1], [56.2, 1.55, -1.6], 42),         // "A general inside" (2002-2009): Cui Li bows
    KF(2044, [52.3, 1.8, 1.4], [58, 1.65, 0.2], 40),             // "simply opened the gate" (2020-2047): Subutai strolls in
    KF(2070, [53.4, 1.75, 1.55], [57.0, 1.62, 0.35], 37),        // payoff: Subutai 3/4 close (matches frame 0)
  ]),
];

// impact kicks (frame, strength): flip sign each frame, decay over 7 f
const KICKS: [number, number][] = [[148, 0.55], [272, 0.6], [F_SMASH, 0.5], [716, 0.5], [782, 0.7], [998, 0.4], [BOOM_F, 1.0], [F_PLATE, 0.5], [F_MACRO, 0.8], [F_PUNCH, 0.3]];
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

// ================= lens: depth of field (light: cInf <= 6; 0 on wides) =================
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 5, focus: () => [SUB_AT[0], 1.75, SUB_AT[2]] },
  { f: 92, dur: 20, cInf: 0 },
  { f: 236, dur: 12, cInf: 4, focus: () => eastFace(4.2, 12.8) }, { f: 300, dur: 15, cInf: 0 },
  { f: 500, dur: 1, cInf: 3, focus: () => MILL_AT }, { f: 600, cInf: 0 },
  { f: 612, dur: 1, cInf: 0 }, { f: 800, cInf: 3, focus: () => [TOWER_HERO[0], WALL_H + 1.5, TOWER_HERO[2]] }, { f: 900, cInf: 0 },
  { f: 1180, cInf: 3, focus: () => [SUB_PEACE[0], 1.7, SUB_PEACE[2]] }, { f: 1300, cInf: 0 }, { f: 1336, cInf: 4, focus: () => [FOOD_AT[0] + 1.05, 1.5, FOOD_AT[2] + 0.75] },
  { f: 1365, dur: 1, cInf: 4, focus: () => [SUB_POKE[0], 1.7, SUB_POKE[2]] },
  { f: 1458, dur: 1, cInf: 5, focus: () => PLATE }, { f: 1596, cInf: 4, focus: () => EBLOCK },
  { f: 1612, dur: 1, cInf: 0 }, { f: 1772, dur: 1, cInf: 5, focus: () => PILLOW },
  { f: 1813, dur: 1, cInf: 0 }, { f: 1920, dur: 1, cInf: 2, focus: () => [GATE[0] - 0.5, 2.5, 0] },
  { f: 1984, dur: 14, cInf: 4, focus: (f) => [SUB_GATE[0] + (56.4 - SUB_GATE[0]) * clamp01((f - 1984) / 85), 1.65, SUB_GATE[2]] },
  { f: 2002, dur: 8, cInf: 4, focus: () => [CUI_AT[0], 1.6, CUI_AT[2]] },
  { f: 2024, dur: 12, cInf: 4, focus: (f) => [SUB_GATE[0] + (56.4 - SUB_GATE[0]) * clamp01((f - 1984) / 85), 1.65, SUB_GATE[2]] },
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
