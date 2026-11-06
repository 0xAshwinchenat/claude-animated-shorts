// Toon3D lab: a small cell-block set + two 3D toon characters, posed per frame. Tests what the 2026-11-06 reference
// study asked for: the turnaround on an orbit (face decal slides, back of the head shows), rubber-hose arms through
// a 2-bone IK, a 1-frame hammer snap after a 2-frame anticipation, lip-sync swaps every 3 f, a planted walk.
import * as THREE from "three";
import { TONE, twoTone } from "./shade";
import { LIGHTS, LOOK } from "./lights";
import { NOINK } from "./ink";
import { Toon3D, TOON3D, EXPR, blink, track, mouthRms, exprTrack, strikeTrack, WALK_CYCLE, TURN_F, type Key, type V3 } from "./toon3d";
import { flow, type FlowKey } from "./camrig";

export const LAB_FRAMES = 180;
export const F_HIT = 96;

const brickTex = (base: string, line: string) => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = line; g.lineWidth = 5;
  for (let r = 0; r < 8; r++) { const y = r * 64; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
    for (let x = (r % 2) * 64; x < 512; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

const CRATE: V3 = [0.12, 0, 0.85];
const A_POS: V3 = [-0.8, 0, 0];
const B_POS: V3 = [0.62, 0, 0.12];

// camera: one continuous path (camrig flow), orbit round A to show the turnaround
const orbitA = (deg: number, r = 2.5, y = 1.45): { pos: V3; look: V3; fov: number } => {
  const a = (deg * Math.PI) / 180;
  return { pos: [A_POS[0] + Math.sin(a) * r, y, A_POS[2] + Math.cos(a) * r], look: [A_POS[0], 1.12, A_POS[2]], fov: 40 };
};
const KEYS: FlowKey[] = [
  { f: 0, at: { pos: [0.1, 1.35, 4.5], look: [-0.1, 1.05, 0.3], fov: 40 } },
  { f: 40, at: { pos: [-0.2, 1.3, 3.65], look: [-0.35, 1.1, 0.3], fov: 40 } },
  { f: 72, at: { pos: [0.75, 1.3, 3.75], look: [0.35, 1.05, 0.5], fov: 40 } },
  { f: 96, at: { pos: [0.62, 1.2, 3.35], look: [0.32, 0.95, 0.6], fov: 40 } },
  { f: 114, at: { pos: [0.1, 1.32, 3.25], look: [-0.35, 1.02, 0.35], fov: 40 } },
  { f: 130, at: orbitA(-35) },
  { f: 148, at: orbitA(-92) },
  { f: 164, at: orbitA(-140) },
  { f: 180, at: orbitA(-168) },
];
export const CAM = flow(KEYS);

// lab only: a syllable-like RMS envelope over the spoken spans (a real short reads voice_rms.py output for voice.wav)
const fakeRms = (spans: [number, number][], n = LAB_FRAMES) => Array.from({ length: n }, (_, f) => {
  for (const [a, b] of spans) if (f >= a && f < b) { const t = f - a; return Math.max(0, 0.15 + 0.75 * Math.abs(Math.sin(t * 0.62 + a)) * (0.7 + 0.3 * Math.sin(t * 1.7))); }
  return 0.02;
});
const RMS_A = fakeRms([[3, 11], [12, 19], [21, 29], [30, 40], [43, 51], [52, 63], [118, 126], [127, 136]]);
const RMS_B = fakeRms([[64, 72], [73, 82]]);

export class LabWorld {
  root = new THREE.Group();
  sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  A: Toon3D; B: Toon3D;
  crate: THREE.Mesh; debris: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; p0: THREE.Vector3 }[] = [];
  constructor() {
    const L = LIGHTS.day;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uSat.value = LOOK.day.sat;
    const mat = (col: string, map?: THREE.Texture) => twoTone(new THREE.MeshLambertMaterial({ color: col, map: map ?? null }));
    // floor + two walls (a cell corner) + a window
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat("#9fb3b8"));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.root.add(floor);
    const bt = brickTex("#4f8f9c", "#3a6f7c"); bt.repeat.set(6, 2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.3), mat("#ffffff", bt)); back.position.set(0, 2, -2.2); back.receiveShadow = true; this.root.add(back);
    const bt2 = bt.clone(); bt2.repeat.set(5, 2); bt2.needsUpdate = true;
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 10), mat("#ffffff", bt2)); side.position.set(-4.2, 2, 2.6); side.receiveShadow = true; this.root.add(side);
    const pinkDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.1), mat("#e8559a")); pinkDoor.position.set(1.9, 1.05, -2.02); this.root.add(pinkDoor);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.1) })); win.position.set(-1.6, 2.7, -2.04); this.root.add(win);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.45), mat("#c9ccd2")); bench.position.set(-2.4, 0.48, -1.6); bench.castShadow = true; this.root.add(bench);
    for (const x of [-3.1, -1.7]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.35), mat("#8a8f98")); leg.position.set(x, 0.24, -1.6); this.root.add(leg); }
    // crate (smashed at F_HIT) + its debris
    this.crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat("#c9893f")); this.crate.position.set(CRATE[0], 0.25, CRATE[2]); this.crate.castShadow = true; this.root.add(this.crate);
    for (let i = 0; i < 18; i++) {
      const s = 0.035 + ((i * 37) % 11) / 220;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 0.35, s), mat(i % 5 ? "#c9893f" : "#8a5a26")); m.castShadow = true; m.visible = false;
      const a = (i / 18) * Math.PI * 2, up = 0.05 + ((i * 53) % 7) / 60;
      this.debris.push({ m, p0: new THREE.Vector3(CRATE[0], 0.3, CRATE[2]), v: new THREE.Vector3(Math.cos(a) * 0.05, up, Math.sin(a) * 0.04 + 0.01), w: new THREE.Vector3((i % 3) * 0.3, 0.2, 0.25) });
      this.root.add(m);
    }
    // characters
    this.A = new Toon3D({ build: "adult", outfit: { shirt: "#2f4f8f", buttons: "#e8c45a", badge: "#f2c94c", belt: "#1d1d2a", buckle: "#e8c45a" }, hat: { k: "cap", col: "#26345e", badge: "#f2c94c" } });
    this.B = new Toon3D({ build: "stout", outfit: { shirt: "#f4f1ea", vest: "#3aa58a", bowtie: "#d83a3a", pants: "#3b3f52" }, hat: { k: "hair", col: "#5a3b2a" }, prop: "hammer", propHand: "R", grip: "glove", blush: true });
    this.root.add(this.A.root, this.B.root);
    // sun (camera-independent here), hemisphere for unpatched materials
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias;
    const sunDir = new THREE.Vector3(-0.55, 0.78, 0.38).normalize();
    this.sun.position.copy(sunDir).multiplyScalar(14); this.sun.target.position.set(0, 0, 0);
    TOON3D.uSunW.value.copy(sunDir);
    this.root.add(this.sun, this.sun.target, new THREE.HemisphereLight("#dcecff", "#b49a78", 0.55));
  }

  /** world point -> a character's body space (ignores bob/lean: fine for hand targets) */
  local(c: Toon3D, w: V3): V3 {
    const v = new THREE.Vector3(...w).sub(c.root.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -c.root.rotation.y);
    return [v.x, v.y, v.z];
  }

  update(f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene, rollTest = 0): THREE.Vector3 {
    scene.background = new THREE.Color("#9cc3e6");
    scene.fog = new THREE.Fog("#b8d0ec", 25, 300);
    const A = this.A, B = this.B;
    // ---------------- A: the guard talks (lip-sync on ones from the voice RMS), points at the crate (4 f attack, DEAD-STILL
    // hold: only the camera moves), flinches at the hit, turns (3 f) to watch B walk off
    const xa = exprTrack(f, [[0, EXPR.stern], [20, EXPR.smug], [F_HIT, EXPR.shock], [112, EXPR.worried]]);
    const eA = blink(f, 7, mouthRms(f, RMS_A, xa.e), xa.swaps);
    const yawA = track(f, [{ f: 0, v: 0.25 }, { f: 120, v: 0.25 }, { f: 120 + TURN_F, v: 0.75, ease: "ease" }]);
    const hipL = A.hand("hip", "L").hand, point = A.hand("point", "L").hand, down = A.hand("down", "L").hand, chest = A.hand("chest", "L").hand;
    A.pose({ pos: A_POS, yaw: yawA, lean: track(f, [{ f: 0, v: 0 }, { f: F_HIT, v: 0 }, { f: F_HIT + 1, v: -6, ease: "snap" }, { f: 112, v: -6, ease: "hold" }, { f: 116, v: 0, ease: "ease" }]),
      head: { yaw: track(f, [{ f: 0, v: 0 }, { f: 18, v: 0 }, { f: 21, v: 0.2 }, { f: 60, v: 0.2, ease: "hold" }, { f: 63, v: 0 }]), roll: track(f, [{ f: 0, v: 0 }, { f: 18, v: 0 }, { f: 21, v: 0.08 }, { f: 50, v: 0.08, ease: "hold" }, { f: 54, v: 0 }]) },
      armR: A.hand("hip", "R"),
      armL: { hand: track(f, [{ f: 0, v: hipL }, { f: 16, v: hipL }, { f: 20, v: point }, { f: 48, v: point, ease: "hold" }, { f: 53, v: down }, { f: F_HIT, v: down, ease: "hold" }, { f: F_HIT + 1, v: chest, ease: "snap" }, { f: 118, v: chest, ease: "hold" }, { f: 123, v: hipL }] as Key<number[]>[]) as V3,
        pole: f < 53 ? [0.3, -1, 0] : [1, 0.1, -0.4] },
      face: eA,
    });
    // ---------------- B: strike = raise 8 f, ready, 3 f pull-back, ~6 f held back, CONTACT on F_HIT (no in-between),
    // hold, recover; then a 4 f turn and a planted strut (21 f per two steps)
    const xb = exprTrack(f, [[0, EXPR.smug], [80, EXPR.angry], [F_HIT, EXPR.happy], [118, EXPR.smug]]);
    const eB = blink(f, 3, mouthRms(f, RMS_B, xb.e), xb.swaps);
    const walkStart = 124, speed = 0.032;
    const WY = 2.57; // walks off to the pink door (a 3/4 side view from the orbit)
    const yawB = track(f, [{ f: 0, v: -0.35 }, { f: walkStart - 4, v: -0.35 }, { f: walkStart, v: WY, ease: "ease" }]);
    const walkD = Math.max(0, f - walkStart) * speed;
    const posB: V3 = [B_POS[0] + Math.sin(WY) * walkD, 0, B_POS[2] + Math.cos(WY) * walkD];
    B.root.position.set(...B_POS); B.root.rotation.set(0, -0.35, 0);
    const contact = this.local(B, [CRATE[0] + 0.1, 0.92, CRATE[2] - 0.3]);
    const aim = this.local(B, [CRATE[0], 0.12, CRATE[2] + 0.05]);
    const rest = B.hand("down", "R").hand, ready: V3 = [-0.22, 1.48, -0.08], wound: V3 = [-0.4, 1.38, -0.22]; // wound out to the SIDE: stays in silhouette
    const hand = strikeTrack(f, F_HIT, rest, ready, wound, contact) as V3;
    const restDir: V3 = [0, -1, 0.05], readyDir: V3 = [-0.2, 0.8, -0.55], woundDir: V3 = [-0.75, 0.35, -0.55];
    const hitDir: V3 = [aim[0] - contact[0], aim[1] - contact[1], aim[2] - contact[2]];
    const propDir = strikeTrack(f, F_HIT, restDir, readyDir, woundDir, hitDir) as V3;
    B.pose({ pos: posB, yaw: yawB,
      lean: strikeTrack(f, F_HIT, 0, -4, -9, 10),
      crouch: strikeTrack(f, F_HIT, 0, 0, 0.04, 0.12),
      armR: { hand, pole: [-1, -0.2, -0.3] },
      armL: f < 80 ? B.hand("hip", "L") : f < 118 ? B.hand("fist", "L") : B.hand("down", "L"),
      walk: f >= walkStart ? { phase: (f - walkStart) / WALK_CYCLE, stride: speed * WALK_CYCLE * 0.5 } : undefined,
      propDir, face: eB,
    });
    // ---------------- crate + debris (ballistic, gravity 0.012 m/f^2)
    this.crate.visible = f < F_HIT;
    for (const d of this.debris) {
      const t = f - F_HIT; d.m.visible = t >= 0;
      if (t < 0) continue;
      const tt = Math.min(t, 40);
      const y = Math.max(0.04, d.p0.y + d.v.y * tt - 0.006 * tt * tt);
      const land = d.v.y * tt - 0.006 * tt * tt + d.p0.y <= 0.04;
      d.m.position.set(d.p0.x + d.v.x * tt * (land ? 0.8 : 1), y, d.p0.z + d.v.z * tt * (land ? 0.8 : 1));
      d.m.rotation.set(d.w.x * tt, d.w.y * tt, d.w.z * tt);
    }
    // ---------------- camera + impact kick (flips sign each frame, decays over 7 f)
    const c = CAM(f);
    const kick = f >= F_HIT && f < F_HIT + 7 ? 0.035 * (1 - (f - F_HIT) / 7) * ((f - F_HIT) % 2 ? -1 : 1) : 0;
    cam.position.set(c.pos[0], c.pos[1] + kick, c.pos[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(c.look[0], c.look[1] + kick * 0.5, c.look[2]);
    // camrig roll is in RADIANS; rollTest (degrees) injects a known roll wave to validate roll_meter.py
    const roll = (c.roll ?? 0) + (rollTest ? (rollTest * Math.sin(f / 14) * Math.PI) / 180 : 0);
    if (roll) cam.rotateZ(roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 400; cam.updateProjectionMatrix();
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.layers.mask !== 1 << NOINK && !(o as THREE.Mesh).receiveShadow) (o as THREE.Mesh).receiveShadow = true; });
    // focus: the acting character's head
    const focusOn = f < 60 ? A : f < 116 ? B : A;
    return new THREE.Vector3().setFromMatrixPosition(focusOn.root.matrixWorld).add(new THREE.Vector3(0, 1.4, 0));
  }
}
