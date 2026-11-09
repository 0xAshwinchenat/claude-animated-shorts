// The whole film as one three.js scene: sky, sun, Megara + its plain (city.ts), the elephants, pigs, spears, arrows
// (beasts.ts), the venues: the writer's room, the elephant stable, Edessa (venues.ts), the 3D toon cast (chars.ts)
// and the card cast + effect cards (cast.ts). update(id, f, camera) poses
// everything for shot `id` at story frame f (a pure function of id + f; f is fractional in the 120 fps HQ render).
// LEAD-OWNED glue: rig owners only touch their own files.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
/** render-cost profiling switches (inputProps `{ prof: { cards: false, cast3d: false, shadows: false, camp: false, siege: false } }`) */
const PROF: Record<string, boolean> = { cards: true, cast3d: true, shadows: true, beasts: true, city: true, venues: true, ...((getInputProps() as { prof?: Record<string, boolean> }).prof ?? {}) };
import { V, Kit, Ray, kitClone } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, GLOW, untone } from "./shade";
import { NOINK } from "./ink";
import { TOON3D } from "./toon3d";
import { Pool, Actor, Fx, stage, GEOS } from "./cast";
import { FPS, G, SHOTS, camAt, FOREGROUND, ShotDef, at, pathOf, SetName } from "./story";
import { CityRig } from "./city";
import { BeastRig } from "./beasts";
import { VenueRig } from "./venues";
import { CastRig } from "./chars";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-set fog (near, far) and per-shot overrides */
const FOG_SET: Record<SetName, [number, number]> = { megara: [140, 900], scroll: [40, 300], stable: [60, 420], edessa: [120, 900] };
const FOG_SHOT: Record<number, [number, number]> = { 2: [260, 1400] };
/** the city keeps ONE world-fixed sun (shadows agree across its camera paths): direction TOWARD the sun.
 *  Day: high in the south (~60 deg up): the battered east face is lit (its normal tilts up), and so is anyone facing
 *  south / south-east (Subutai in frame 0).
 *  Night: the moon from the north-west, high. */
const SUN_WORLD: Partial<Record<string, THREE.Vector3>> = {
  // Megara: high sun from the EAST, a little south: side light on the elephants' fronts (facing north) AND the pigs'
  // faces (running south); the camera works mostly from the east side, so it sees the lit side
  "megara:day": new THREE.Vector3(0.62, 0.74, 0.26).normalize(),
  // inside the city (shot 5 and shot 6 until the camera is in the gate passage, f < 768): the camera looks SOUTH at
  // north-facing walls, so the sun comes from the north-east there (the switch is hidden in the dark passage)
  "megara:inside": new THREE.Vector3(0.5, 0.78, -0.38).normalize(),
  // Edessa: a low golden sun in the south-west: the wall's outer face glows, the ending (looking south) is backlit
  "edessa:golden": new THREE.Vector3(-0.45, 0.32, 0.83).normalize(),
};
/** venues: camera-relative sun frozen per PATH (az / el degrees; az 0 = straight ahead = backlight) */
const SUN_PATH: Record<number, { az?: number; el?: number }> = { 3: { az: 168, el: 38 }, 4: { az: 125, el: 50 } };   // 3 = writer's room (sun behind the lens: his face lit), 4 = the stable

/** every lens ray of the city shots (the siege rig culls roofs / towers / props that block a camera) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) {
    if (s.set !== "megara") continue;
    for (let f = s.a - 8; f < s.b + 8; f += 2) {
      const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
      const fw = look.clone().sub(o), len = fw.length();
      fw.normalize();
      const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
      const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
      for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
        out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
    }
  }
  return out;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "night" | "storm", THREE.Texture[]>;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private clouds: THREE.Mesh[] = [];
  private city!: CityRig; private beasts!: BeastRig; private venues!: VenueRig; private cast3d!: CastRig;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = PROF.shadows;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)), storm: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.storm.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 820 + (i % 3) * 70;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 170 + (i % 4) * 40;
      m.userData.off = new THREE.Vector3(Math.cos(a) * d, 160 + (i % 4) * 46, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // ---- places + the 3D cast ----
    this.city = new CityRig(R, kit, sightLines());
    this.beasts = new BeastRig(R);
    this.venues = new VenueRig(R);
    this.cast3d = new CastRig(R);
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** the sun direction (toward the sun) for shot id: world-fixed in the city, camera-relative + frozen per path elsewhere */
  sunFor(id: number): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light];
    const w = SUN_WORLD[`${s.set}:${s.light}`];
    if (w) return w;
    const path = pathOf(id);
    let v = this.sunCache.get(path);
    if (v) return v;
    let fx = 0, fz = 0;
    for (const sh of SHOTS) if (pathOf(sh.id) === path) for (let f = sh.a; f < sh.b; f += 3) {
      const c = camAt(sh.id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_PATH[path]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_PATH[path]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(path, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s: ShotDef = SHOTS[id - 1], L: LightPreset = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.set === "scroll" ? 0.05 : 0.12; cam.far = 2400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = id === 5 || (id === 6 && f < 768) ? SUN_WORLD["megara:inside"]! : this.sunFor(id);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, s.set === "megara" || s.set === "edessa" ? 260 : 60);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 420); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 900; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    TOON3D.uSunW.value.copy(sunDir);
    // ---- sky, fog, sun / moon disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); const fg = FOG_SHOT[id] ?? FOG_SET[s.set]; this.fog.near = fg?.[0] ?? L.fogNear; this.fog.far = fg?.[1] ?? L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" || s.light === "night";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      const night = s.light === "night";
      const mdir = night ? V(0, 0, -1).applyQuaternion(cam.quaternion).addScaledVector(V(0, 1, 0).applyQuaternion(cam.quaternion), 0.32)
        .addScaledVector(V(1, 0, 0).applyQuaternion(cam.quaternion), -0.12).normalize() : sunDir;
      this.sunDisc.position.copy(cam.position).addScaledVector(mdir, 1200);
      this.sunDisc.scale.setScalar(2 * 1200 * Math.tan(THREE.MathUtils.degToRad(night ? 1.5 : 1.7)));
      (this.sunDisc.material as THREE.SpriteMaterial).color.set(night ? new THREE.Color(2.3, 2.45, 2.8) : new THREE.Color(6.0, 4.4, 2.4));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 1200 * Math.tan(THREE.MathUtils.degToRad(night ? 9 : 24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(night ? 0.22 : 1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.position.copy(cam.position).add(m.userData.off as THREE.Vector3); m.position.y = (m.userData.off as THREE.Vector3).y;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
      const ck = s.light === "night" ? 0.42 : s.light === "storm" ? 0.8 : 1.1; mat.color.setRGB(ck, ck, ck * (s.light === "night" ? 1.15 : 1));
      m.visible = s.set !== "scroll";
    }
    // ---- places ----
    this.city.update(id, f, cam); if (!PROF.city) this.city.group.visible = false;

    this.beasts.update(id, f, cam); if (!PROF.beasts) this.beasts.group.visible = false;
    this.venues.update(id, f, cam); if (!PROF.venues) this.venues.group.visible = false;
    // the fire light: the city's (brazier, burning queue) or the writer's oil lamp
    const gl = s.set === "scroll" ? this.venues.glow : this.city.glow;
    GLOW.uGlowPos.value.copy(gl.pos); GLOW.uGlowCol.value.copy(gl.col); GLOW.uGlowR.value = gl.r;
    if (PROF.cast3d) this.cast3d.update(id, f, cam, sunDir); else this.cast3d.group.visible = false;
    for (const fgo of this.fgs) fgo.o.visible = f >= fgo.a && f < fgo.b;
    // ---- card cast + effect cards ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = PROF.cards ? stage(id, f, { pos: cam.position, right, sun: sunDir }) : { places: [], fx: [] };
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2 + 0.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.geometry = GEOS[p.geo ?? "body"];
      a.mesh.position.set(p.x, p.y, p.z);
      // cards hold DEAD STILL (no idle sway: the camera supplies the motion)
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }
}

export { at, G, FPS };
