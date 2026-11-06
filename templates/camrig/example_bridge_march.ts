// Worked example (bridge_flow, 2026-11-05): the bridge march 283-987 re-planned on the continuous rig. 10/10 camera
// gates, lens >= 0.83 m from rails/hangers. Lives inside story.ts (uses its front(), T(), D0, V3, Fz, run, CAMS, kickAt).
import { flow, FlowKey } from "./camrig";

// ---- continuous rig (camrig.ts) on the march, shots 3-7 (283-987): one path, no cuts, every framing is passed
// through with the velocity of its neighbours. Keys are the old framings frozen at their key frame, tracking the
// column (col); each move straddles its word (hold end ~12 f before the word, arrival ~10 f after). ----
const col = (fk: number) => (f: number): V3 => [0, 0, front(T(f)) - front(T(fk))];
/** a key relative to the front row (x, height over the deck, z behind the front row), riding with the column */
const R = (fk: number, p: V3, l: V3, fov = 40, roll = 0): FlowKey =>
  ({ f: fk, at: { pos: [p[0], D0 + p[1], front(T(fk)) + p[2]], look: [l[0], D0 + l[1], front(T(fk)) + l[2]], fov, roll }, track: col(fk) });
export const FLOW_A = 283, FLOW_B = 987;
// Planned as ONE path: every framing is a modest push / pull / pan / orbit / crane from the previous one (the old shot
// list jumped 13 m sideways in a cut; a flowing camera cannot). Words: every boot 353, Halfway 444, bouncing 497,
// A normal person 534, hilarious 600, whistle ~643, whole column 717, harder ~768, bounce gets bigger 823, chains 871,
// nobody 925.
// Speeds (720p px/f): drifts 0.5-2 between moves, moves 18-45 f reframing 1/4-1/2 frame (peak 14-25), big reframes
// spread over several beats. At 3 m from a face 0.15 m of drift is already ~2 px/f.
export const MARCH = flow([
  R(283, [1.1, 1.45, -6.2], [0, 1.3, 0.6]),                 // low front of the column, already creeping in
  R(334, [1.0, 1.36, -5.75], [0, 1.24, 0.6]),               //   push + sink
  R(362, [0.7, 0.6, -4.5], [0, 0.36, 0.4], 38),             // tilt down to the boots ("every boot" 353)
  R(390, [0.62, 0.57, -4.35], [-0.03, 0.36, 0.4], 38),      //   drift
  R(410, [0.45, 0.5, -3.75], [-0.05, 0.35, 0.4], 38),       //   punch push on the stomp
  R(428, [0.4, 0.5, -3.65], [-0.05, 0.35, 0.4], 38),        //   creep
  // the lens stays in the deck lane (|x| <= 1.6: >= 0.8 m from the rails at 2.42, >= 1 m from the hangers at 2.62);
  // a flight never threads the hangers (1.5 m apart) while riding with the column
  R(472, [1.5, 1.75, -6.2], [0, 1.1, 1.2], 42),             // pull up and back to a 3/4 front ("Halfway" 444)
  R(490, [1.6, 1.6, -5.6], [0, 1.05, 1.3], 42),             //   drift on toward the side
  R(515, [1.55, 1.0, -3.5], [0, 0.95, 1.6], 40, -0.035),    // low push on the bounce ("bouncing" 497)
  R(530, [1.45, 1.0, -3.3], [0, 0.95, 1.6], 40, 0.035),     //   roll through level
  R(558, [1.6, 1.7, -4.4], [0, 1.55, 1.0], 38),             // up and round to the faces ("A normal person" 534)
  R(585, [1.45, 1.7, -4.1], [0, 1.56, 0.9], 38),            //   drift + push
  R(606, [1.0, 1.7, -3.3], [0, 1.6, 0.6], 36, 0.04),        // closer faces
  R(630, [0.9, 1.72, -3.1], [0.05, 1.62, 0.55], 36, -0.035),//   "think it's hilarious" (600): roll back
  R(654, [0.8, 1.95, -2.5], [0.55, 1.85, 0], 34),           // the whistler CU (643)
  R(695, [0.74, 1.96, -2.4], [0.53, 1.85, 0], 34),          //   creep
  R(762, [1.2, 5.6, -9.0], [0, 0.9, 5.0], 44, -0.03),       // crane up and back over the column, inside the lane ("whole column" 717)
  R(786, [0.9, 4.3, -7.2], [0, 0.95, 4.2], 42, -0.02),      //   push down onto the column ("harder every step" ~768)
  R(820, [-0.6, 2.0, -9.0], [0, 1.5, 2.5], 44, 0.02),       // swing down to the wide ahead ("The bounce gets bigger" 823)
  R(842, [-0.85, 2.05, -8.65], [-0.1, 1.55, 2.4], 44),      //   drift
  R(890, [-1.2, 3.1, -4.6], [-2.6, 3.1, 1.5], 40, 0.02),    // rise and turn to the chain from inside the lane ("chains" 871)
  R(906, [-1.05, 2.85, -4.4], [-2.35, 2.85, 1.4], 40, 0.01),//   keeps drifting down along the chain (no brake)
  R(946, [-0.4, 1.85, -3.8], [0, 1.75, 0.3], 36),           // down to the nervous front row ("nobody" 925)
  R(995, [-0.2, 1.84, -3.5], [0, 1.74, 0.3], 36),           //   push
]);
/** world offset of the subject the camera rides with (cam_qa: riding along is not subject motion) */
export const trackAt = (id: number, f: number): V3 => (id >= 1 && id <= 7 ? [0, 0, Fz(id, f)] : [0, 0, 0]);
export const camAt = (id: number, f: number): Cam => {
  // ... rest of camAt (kicks) unchanged

// world.ts: freeze the sun per place (path), not per shot:
//     // one continuous camera path = one place = one frozen sun (a per-shot sun would jump at every invisible shot change)
//     const place = id >= 3 && id <= 7 ? 3 : id, fa = place === 3 ? SHOTS[2].a : s.a, fb = place === 3 ? SHOTS[6].b : s.b;
//     let v = this.sunCache.get(place);
//     if (v) return v;
