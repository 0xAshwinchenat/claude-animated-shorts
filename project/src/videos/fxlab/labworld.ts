// FX lab world: a plain day scene (dirt/grass ground, sky gradient, sun with shadows, boxes, columns, a 1.7 m grey
// capsule per area for scale) and the vfx.ts effects, each in its own area with its own camera orbit ("stage").
// inputProps { fx: "all" | "smoke" | "burst" | "explosion" | "trail" | "fire" | "debris" | "empty" | "stress" | "stress3" } picks
// the stage (camera + which effects are built). "all" builds everything and frames the combined moment; "stress" is one
// ~2000-puff plume (perf ceiling, detail 4; stress3 = detail 3). `nofx` keeps the stage without effects (perf baseline).
import * as THREE from "three";
import { TONE, GLOW, twoTone, untone } from "./shade";
import { LIGHTS, LOOK } from "./lights";
import { NOINK } from "./ink";
import { SmokePlume, PuffBurst, Explosion, DustTrail, Fire, Debris, SMOKE_PRESETS, mulberry32, type Vfx, type V3 } from "./vfx";

export const LAB_FRAMES = 240;
export type StageName = "all" | "smoke" | "burst" | "explosion" | "trail" | "fire" | "debris" | "empty" | "stress" | "stress3";
type Stage = { look: V3; r: number; h: number; a0: number; da: number; fov: number; cInf: number; shadowR: number; follow?: (f: number) => V3 };
/** the cart's path (trail stage): x from -16 to 16 along z = 12, eases in and out */
const cartX = (f: number) => -16 + 32 * THREE.MathUtils.smootherstep(f, 0, LAB_FRAMES);
/** camera orbit per stage: look point, radius, height above the look point, start azimuth + total sweep (deg) */
export const STAGES: Record<StageName, Stage> = {
  all: { look: [3, 2.4, -1.2], r: 27, h: 4.5, a0: 84, da: 14, fov: 40, cInf: 3, shadowR: 24 },
  empty: { look: [3, 2.4, -1.2], r: 27, h: 4.5, a0: 84, da: 14, fov: 40, cInf: 3, shadowR: 24 },
  stress: { look: [-5.5, 5.2, -4.5], r: 22, h: -1.5, a0: 18, da: 30, fov: 40, cInf: 4, shadowR: 18 },
  stress3: { look: [-5.5, 5.2, -4.5], r: 22, h: -1.5, a0: 18, da: 30, fov: 40, cInf: 4, shadowR: 18 },
  smoke: { look: [-5.5, 5.2, -4.5], r: 17, h: -1.5, a0: 18, da: 30, fov: 40, cInf: 4, shadowR: 18 },
  burst: { look: [-7, 0.8, 7], r: 8.5, h: 1.6, a0: 10, da: 26, fov: 40, cInf: 4, shadowR: 10 },
  explosion: { look: [10, 2.6, -3], r: 15, h: 1.2, a0: 12, da: 18, fov: 40, cInf: 4, shadowR: 18 },
  debris: { look: [10, 0.9, -3], r: 10, h: 2.6, a0: 22, da: 24, fov: 40, cInf: 4, shadowR: 12 },
  trail: { look: [0, 0.8, 12], r: 9, h: 2.2, a0: 28, da: 30, fov: 40, cInf: 4, shadowR: 12, follow: (f) => [cartX(f) - 1.6, 0, 0] },
  fire: { look: [0.6, 1.25, 2.3], r: 7.2, h: 0.7, a0: 4, da: 34, fov: 40, cInf: 5, shadowR: 9 },
};

/** world-fixed sun (direction toward the sun): high, from the right of the default camera, a little behind it */
const SUN = new THREE.Vector3(0.62, 0.68, 0.39).normalize();
export const BOOM_AT = 60;     // explosion + crate debris
export const DROP_AT = [34, 92, 150]; // boulder impacts (burst stage)

// ---- painted canvas textures (seeded, deterministic) ----
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep: [number, number]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8;
  return t;
};
const groundTex = () => canvasTex(1024, 1024, (g) => {
  const r = mulberry32(77);
  g.fillStyle = "#86a85c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { // dirt patches
    const x = r() * 1024, y = r() * 1024, rr = 30 + r() * 110;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(176,150,104,0.85)"); gr.addColorStop(1, "rgba(176,150,104,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 9000; i++) { // grass flecks
    const x = r() * 1024, y = r() * 1024, k = r();
    g.fillStyle = k < 0.5 ? "rgba(98,136,62,0.55)" : k < 0.85 ? "rgba(150,180,96,0.5)" : "rgba(120,100,70,0.4)";
    g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
  }
}, [24, 24]);
const roadTex = () => canvasTex(512, 512, (g) => {
  const r = mulberry32(78);
  g.fillStyle = "#b99d72"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { const k = r(); g.fillStyle = k < 0.5 ? "rgba(150,124,88,0.5)" : "rgba(212,192,152,0.5)"; g.fillRect(r() * 512, r() * 512, 2 + r() * 4, 2 + r() * 3); }
}, [10, 1]);
const crateTex = () => canvasTex(256, 256, (g) => {
  g.fillStyle = "#c08a50"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#7a5228"; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240);
  g.lineWidth = 4; for (let y = 64; y < 256; y += 64) { g.beginPath(); g.moveTo(10, y); g.lineTo(246, y); g.stroke(); }
  g.lineWidth = 12; g.beginPath(); g.moveTo(14, 14); g.lineTo(242, 242); g.stroke();
}, [1, 1]);

const mat = (col: string, map?: THREE.Texture) => twoTone(new THREE.MeshLambertMaterial({ color: col, map: map ?? null }));
const box = (w: number, h: number, d: number, col: string, map?: THREE.Texture) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col, map)); m.castShadow = m.receiveShadow = true; return m; };

/** the burning pig proxy: one lap of an ellipse round the torch + brazier */
const pigAt = (f: number): V3 => { const a = -1.2 + (f / LAB_FRAMES) * Math.PI * 2 * 0.9; return [0.6 + Math.cos(a) * 2.9, 0, 2.3 + Math.sin(a) * 1.8]; };
const pigYaw = (f: number) => { const p = pigAt(f - 0.5), q = pigAt(f + 0.5); return Math.atan2(q[0] - p[0], q[2] - p[2]); };
/** a boulder dropped from 4 m that lands at t (burst stage) */
const DROP_POS: V3[] = [[-7, 0, 7], [-5.6, 0, 5.4], [-8.4, 0, 5.9]];
const dropY = (f: number, t: number) => { const g = 0.0109, tf = Math.sqrt((2 * 3.6) / g); const a = f - (t - tf); return a < 0 ? 3.6 + 0.45 : Math.max(0.45, 3.6 + 0.45 - 0.5 * g * a * a); };

export class LabWorld {
  root = new THREE.Group();
  fx: Vfx[] = [];
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#a8c6ee", 60, 460);
  private crates: THREE.Mesh[] = [];
  private cart = new THREE.Group(); private wheels: THREE.Mesh[] = [];
  private pig = new THREE.Group();
  private boulders: THREE.Mesh[] = [];
  private brazierFire: Fire | null = null;
  readonly stage: Stage;

  constructor(readonly name: StageName, withFx = true, cam: Partial<Stage> = {}) {
    this.stage = { ...STAGES[name], ...cam };
    const R = this.root, L = LIGHTS.day;
    // ---- sky (gradient sphere, NOINK) + sun + hemisphere
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el)); c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    LOOK.day.sky.c.forEach((h, i) => untone(h, this.skyMat.uniforms["c" + i].value));
    const e = LOOK.day.sky.e.map((d) => THREE.MathUtils.degToRad(d)); this.skyMat.uniforms.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = L.bias;
    R.add(this.sun, this.sun.target, new THREE.HemisphereLight(L.sky, L.ground, L.hemiI));
    untone(L.fog, this.fog.color);
    // ---- ground + road
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat("#ffffff", groundTex()));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; R.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 3.2), mat("#ffffff", roadTex()));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 12); road.receiveShadow = true; R.add(road);
    // ---- scale references: a 1.7 m grey capsule in every area
    for (const p of [[-2.6, -3.2], [-4.6, 7.4], [6.6, -1.2], [2.2, 13.8], [-0.9, 3.4], [12.6, -0.6]] as [number, number][]) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 6, 16), mat("#9a9ca3"));
      c.position.set(p[0], 0.85, p[1]); c.castShadow = c.receiveShadow = true; R.add(c);
    }
    // ---- smoke area: a hut with a chimney, a column
    const hut = box(3.2, 2.6, 3, "#d9c7a4"); hut.position.set(-5.5, 1.3, -4.5); R.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.5, 4), mat("#a0522d")); roof.rotation.y = Math.PI / 4; roof.position.set(-5.5, 3.35, -4.5); roof.castShadow = roof.receiveShadow = true; R.add(roof);
    const chim = box(0.55, 1.6, 0.55, "#8d7f72"); chim.position.set(-6.3, 3.6, -5.1); R.add(chim);
    const door = box(0.9, 1.7, 0.08, "#6b4a2e"); door.position.set(-5.2, 0.85, -2.98); R.add(door);
    for (const [x, z] of [[-1.2, -7], [-9.6, -2.4]]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4.5, 16), mat("#cfc6b6")); col.position.set(x, 2.25, z); col.castShadow = col.receiveShadow = true; R.add(col); }
    // burning log pile next to the hut (dark burning smoke)
    for (let i = 0; i < 6; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 10), mat(i % 2 ? "#5b3a22" : "#4a2e1a")); lg.rotation.set(0, (i / 6) * Math.PI, Math.PI / 2 - 0.35); lg.position.set(-1.8 + Math.cos(i) * 0.15, 0.25, -4.2 + Math.sin(i) * 0.15); lg.castShadow = lg.receiveShadow = true; R.add(lg); }
    // ---- fire area: a torch on a pole, a brazier; the burning pig proxy runs round them
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 10), mat("#6b4a2e")); pole.position.set(-0.6, 0.95, 2.3); pole.castShadow = pole.receiveShadow = true; R.add(pole);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.22, 12), mat("#4a4048")); cup.position.set(-0.6, 1.95, 2.3); cup.castShadow = true; R.add(cup);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, 0.85, 12), mat("#3d3640")); stand.position.set(1.6, 0.42, 2.0); stand.castShadow = stand.receiveShadow = true; R.add(stand);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#5a4c44")); bowl.position.set(1.6, 1.22, 2.0); bowl.castShadow = bowl.receiveShadow = true; (bowl.material as THREE.Material).side = THREE.DoubleSide; R.add(bowl);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.05) })); coals.position.set(1.6, 1.0, 2.0); R.add(coals);
    const body = box(0.95, 0.55, 0.5, "#e7a3a8"); body.position.set(0, 0.5, 0); this.pig.add(body);
    const head = box(0.35, 0.35, 0.36, "#e7a3a8"); head.position.set(0.0, 0.62, 0); this.pig.add(head);
    head.position.set(0, 0.62, 0.0); body.rotation.y = Math.PI / 2; head.position.z = 0.6;
    const straw = box(0.55, 0.22, 0.45, "#d9b25a"); straw.position.set(0, 0.88, -0.05); this.pig.add(straw);
    for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) { const lg = box(0.12, 0.25, 0.12, "#d98f96"); lg.position.set(x, 0.12, z); this.pig.add(lg); }
    R.add(this.pig);
    // ---- burst area: three boulders dropping
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), twoTone(new THREE.MeshLambertMaterial({ color: "#8f8a84", flatShading: true }))); b.castShadow = b.receiveShadow = true; b.scale.set(1, 0.9, 1.1); this.boulders.push(b); R.add(b); }
    // ---- explosion / debris area: a stack of crates (blown at BOOM_AT)
    const ct = crateTex();
    for (const [x, y, z] of [[10, 0.45, -3], [10.95, 0.45, -3.1], [10.45, 1.35, -3.05], [9.6, 0.45, -2.1]] as V3[]) { const c = box(0.9, 0.9, 0.9, "#ffffff", ct); c.position.set(x, y, z); this.crates.push(c); R.add(c); }
    for (const [x, z] of [[14.5, -6.5], [6.4, -7.5]]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4.5, 16), mat("#cfc6b6")); col.position.set(x, 2.25, z); col.castShadow = col.receiveShadow = true; R.add(col); }
    const wall = box(5, 1.6, 0.5, "#b9ad9a"); wall.position.set(9.5, 0.8, -8.5); R.add(wall);
    // ---- trail area: the cart (box + 2 wheels)
    const bed = box(1.8, 0.5, 1.1, "#9a6a3a"); bed.position.set(0, 0.85, 0); this.cart.add(bed);
    const shaft = box(1.4, 0.08, 0.08, "#7e5530"); shaft.position.set(1.5, 0.75, 0); this.cart.add(shaft);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20), mat("#6b4a2e")); w.rotation.x = Math.PI / 2; w.position.set(0, 0.5, s * 0.66); w.castShadow = w.receiveShadow = true; this.wheels.push(w); this.cart.add(w); }
    R.add(this.cart);
    for (let i = 0; i < 5; i++) { const b = box(0.8, 0.8 + (i % 2) * 0.6, 0.8, i % 2 ? "#c9b48e" : "#a8b8c8"); b.position.set(-12 + i * 6, 0.4 + (i % 2) * 0.3, 15.5); R.add(b); }

    // ---- effects for this stage
    const want = (s: StageName) => withFx && (name === "all" || name === s);
    if (want("smoke")) {
      this.fx.push(new SmokePlume({ ...SMOKE_PRESETS.chimney, source: [-6.3, 4.45, -5.1], start: -400, life: 170, wind: [0.024, 0, 0.007], seed: 21 }));
      const pile = new Fire({ pos: [-1.8, 0.3, -4.2], size: 1.1, seed: 22 });
      this.fx.push(pile);
      const ps = new SmokePlume({ ...SMOKE_PRESETS.burning, source: [-1.8, 1.25, -4.2], start: -400, wind: [0.014, 0, 0.006], seed: 23, look: { ...SMOKE_PRESETS.burning.look, glow: pile.light(0, 1.6) } });
      this.fx.push(ps);
    }
    // perf ceiling: ONE plume of ~2000 puffs (detail 4 / detail 3)
    if (withFx && (name === "stress" || name === "stress3")) this.fx.push(new SmokePlume({ ...SMOKE_PRESETS.chimney, source: [-6.3, 4.45, -5.1], start: -400, rate: 12, life: 170, spread: 1.2, widen: 0.02, size: [0.15, 0.5], wind: [0.024, 0, 0.007], seed: 99, max: 2100, look: { detail: name === "stress" ? 4 : 3 } }));
    if (want("fire")) {
      this.fx.push(new Fire({ pos: [-0.6, 2.04, 2.3], size: 0.38, seed: 31 }));
      this.brazierFire = new Fire({ pos: [1.6, 1.02, 2.0], size: 0.75, radius: 0.3, seed: 32 });
      this.fx.push(this.brazierFire);
      const back = (f: number): V3 => { const p = pigAt(f), y = pigYaw(f); return [p[0] - Math.sin(y) * 0.05, 0.98, p[2] - Math.cos(y) * 0.05]; };
      this.fx.push(new Fire({ pos: back, size: 0.55, radius: 0.2, seed: 33 }));
      this.fx.push(new SmokePlume({ ...SMOKE_PRESETS.burning, source: (f) => { const b = back(f); return [b[0], b[1] + 0.5, b[2]]; }, start: -200, rate: 0.3, size: [0.1, 0.42], life: 55, rise: 0.04, wind: [0.006, 0, 0.002], color: "#6a6466", colorEnd: "#9a9492", seed: 34 }));
      this.fx.push(new DustTrail({ pos: (f) => { const p = pigAt(f); return [p[0], 0, p[2]]; }, start: -60, rate: 0.9, size: [0.1, 0.36], kick: 0.25, seed: 35 }));
    }
    if (want("trail")) {
      for (const s of [-1, 1]) this.fx.push(new DustTrail({ pos: (f) => [cartX(f), 0, 12 + s * 0.66], rate: 1.1, seed: 40 + s }));
    }
    if (want("burst")) {
      DROP_AT.forEach((t, i) => this.fx.push(new PuffBurst({ pos: [DROP_POS[i][0], 0, DROP_POS[i][2]], at: t, seed: 50 + i })));
    }
    if (want("explosion")) this.fx.push(new Explosion({ pos: [10.2, 0.7, -3], at: BOOM_AT, size: 1.6, seed: 61 }));
    if (want("explosion") || want("debris")) {
      this.fx.push(new Debris({ pos: [10.2, 0.8, -2.9], at: BOOM_AT, volume: [0.9, 0.7, 0.7], count: 30, speed: name === "debris" ? [2.5, 6] : [3, 8], seed: 62 }));
    }
    for (const x of this.fx) R.add(x.root);
  }

  update(f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const S = this.stage, L = LIGHTS.day, K = LOOK.day;
    // ---- camera: slow orbit round the stage
    const a = THREE.MathUtils.degToRad(S.a0 + (S.da * f) / LAB_FRAMES);
    const tr = S.follow ? S.follow(f) : [0, 0, 0], lk: V3 = [S.look[0] + tr[0], S.look[1] + tr[1], S.look[2] + tr[2]];
    cam.position.set(lk[0] + Math.sin(a) * S.r, lk[1] + S.h, lk[2] + Math.cos(a) * S.r);
    cam.up.set(0, 1, 0); cam.lookAt(...lk);
    cam.fov = S.fov; cam.near = 0.1; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // ---- light rig (shade.ts uniforms from LIGHTS.day)
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    const focus = new THREE.Vector3(...lk);
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(SUN, 120); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera, Rr = S.shadowR;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 40; sc.far = 220; sc.updateProjectionMatrix();
    this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.sky.position.copy(cam.position);
    this.fog.near = L.fogNear + 20; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    // fire light on the world near the brazier (shade.ts GLOW)
    const gl = this.brazierFire ? this.brazierFire.light(f) : null;
    if (gl) { GLOW.uGlowPos.value.set(...gl.pos); GLOW.uGlowCol.value.set(...gl.col); GLOW.uGlowR.value = gl.r; } else GLOW.uGlowCol.value.set(0, 0, 0);
    // ---- props
    for (const c of this.crates) c.visible = f < BOOM_AT;
    const cx = cartX(f); this.cart.position.set(cx, 0, 12);
    for (const w of this.wheels) w.rotation.y = -(cx + 16) / 0.5;   // rolls without slipping (wheel r = 0.5)
    const pp = pigAt(f); this.pig.position.set(pp[0], 0.02 * Math.abs(Math.sin(f * 0.9)), pp[2]); this.pig.rotation.y = pigYaw(f);
    this.boulders.forEach((b, i) => { const y = dropY(f, DROP_AT[i]); b.visible = y < 4; b.position.set(DROP_POS[i][0], y, DROP_POS[i][2]); b.rotation.set(0.3 * i, i, 0); });
    // ---- effects
    for (const x of this.fx) x.update(f);
    return focus;
  }
}
