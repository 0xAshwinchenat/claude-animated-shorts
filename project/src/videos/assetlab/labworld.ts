// Asset-kit test scene (2026-11-09): an ancient market street at midday, one continuous 3 s dolly. It exists to A/B the
// look upgrades against the reference measurements, not to tell a story:
//   mode.pbr  = glossy props (pbr.ts: two-tone diffuse + PBR specular + sky reflections) vs the old matte two-tone props
//   mode.kit  = imported asset-kit GLBs (public/assetkit, when present) placed as set dressing
//   (ink on/off and the env map are switched in Lab.tsx)
// Pure function of the frame: update(f) poses everything; nothing carries state between frames.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, house, kitClone, Kit } from "./build";
import { cobbleHD, planksHD, stoneHD, cloudHD, rep } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Toon3D, TOON3D, EXPR, WALK_CYCLE, blink, V3 } from "./toon3d";
import { gloss, Gloss, toneObject, pbrTone } from "./pbr";
import { Fire, SmokePlume, Debris, SMOKE_PRESETS, Vfx } from "./vfx";
import { GLOW } from "./shade";

export const LAB_FRAMES = 90;
/** direction TOWARD the sun (world): high, to the right of the street and a little ahead of the camera */
export const LAB_SUN = new THREE.Vector3(0.55, 0.74, -0.38).normalize();

// ---------------------------------------------------------------- assets
const KENNEY = ["stall-red", "stall-green", "stall-bench", "cart", "lantern", "banner-red", "banner-green", "tree_oak", "plant_bushLarge"];
export type GroundTex = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
export type LabKit = { kenney: Kit; extra: Kit; ak: Kit; tex: Record<string, GroundTex> };
/** the asset-kit models the kit street uses (public/assetkit/MANIFEST.json names) */
export const AK_NAMES = ["q_village/House_StonePlaster_4x4", "q_village/House_Plaster_4x6", "q_village/House_Stone_6x8", "q_village/House_Tall_4x4",
  "q_props/Stall_Empty", "q_props/Stall_Cart_Empty", "q_props/Table_Large", "q_props/Barrel", "q_props/Barrel_Apples", "q_props/FarmCrate_Apple",
  "q_props/FarmCrate_Carrot", "q_props/Crate_Wooden", "q_props/Bag", "q_props/Vase_2", "q_props/Vase_4", "q_props/Pot_1", "q_props/Cauldron",
  "q_props/Banner_1", "q_props/Banner_2", "q_props/Barrel_Holder", "q_props/Bench", "q_props/WeaponStand", "q_nature/CommonTree_1", "q_nature/Bush_Common"];
type ManEntry = { name: string; file: string; node: string | null; size_m: [number, number, number] };
/** asset-kit models by manifest name, each normalised: centred on x/z, standing on y = 0, height = manifest size */
const loadAssetKit = async (names: string[], ld: GLTFLoader): Promise<Kit> => {
  if (!names.length) return {};
  const man = (await (await fetch(staticFile("assetkit/MANIFEST.json"))).json()) as ManEntry[];
  const by = new Map(man.map((e) => [e.name, e]));
  const files = [...new Set(names.map((n) => by.get(n)?.file).filter(Boolean) as string[])];
  const scenes = new Map(await Promise.all(files.map(async (f) => [f, (await ld.loadAsync(staticFile(`assetkit/${f}`))).scene] as const)));
  const out: Kit = {};
  for (const n of names) {
    const e = by.get(n); if (!e) continue;
    const sc = scenes.get(e.file)!; const src = e.node ? sc.getObjectByName(e.node) : sc; if (!src) continue;
    const c = src.clone(true); c.position.set(0, 0, 0); c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c), sz = box.getSize(new THREE.Vector3()), k = e.size_m[1] / Math.max(sz.y, 1e-4);
    const g = new THREE.Group(), inner = new THREE.Group(); inner.add(c);
    inner.position.set(-(box.min.x + sz.x / 2), -box.min.y, -(box.min.z + sz.z / 2)); g.add(inner); g.scale.setScalar(Number.isFinite(k) ? k : 1);
    out[n] = g;
  }
  return out;
};
const loadGround = async (names: string[]) => {
  const tl = new THREE.TextureLoader(), out: Record<string, GroundTex> = {};
  for (const n of names) {
    const [map, normalMap, roughnessMap] = await Promise.all(["albedo", "normal", "rough"].map((k) => tl.loadAsync(staticFile(`assetkit/tex/${n}/${k}.jpg`))));
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    out[n] = { map, normalMap, roughnessMap };
  }
  return out;
};
let kitP: Promise<LabKit> | null = null;
/** extra = asset-kit GLBs by name (inputProps lab.kitFiles: ["pack/name", ...] under public/assetkit); ak = the kit street's models */
export const loadLabKit = (extraFiles: string[] = [], useKit = false) => {
  if (!kitP) {
    const ld = new GLTFLoader();
    const get = (url: string, n: string) => ld.loadAsync(url).then((g) => [n, g.scene] as const).catch(() => [n, null] as const);
    kitP = Promise.all([
      Promise.all(KENNEY.map((n) => get(staticFile(`bridge/kenney/${n}.glb`), n))),
      Promise.all(extraFiles.map((n) => get(staticFile(`assetkit/${n}.glb`), n))),
      loadAssetKit(useKit ? AK_NAMES : [], ld),
      useKit ? loadGround(["cobblestone"]) : Promise.resolve({} as Record<string, GroundTex>),
    ]).then(([a, b, ak, tex]) => ({
      kenney: Object.fromEntries(a.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit,
      extra: Object.fromEntries(b.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit, ak, tex,
    }));
  }
  return kitP;
};

// ---------------------------------------------------------------- small helpers
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const yawTo = (a: V3, b: V3) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** lathe profile [r, y] pairs -> geometry (smooth normals) */
const lathe = (pts: [number, number][], seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const AMPHORA = lathe([[0, 0], [0.05, 0], [0.07, 0.03], [0.15, 0.2], [0.17, 0.32], [0.155, 0.42], [0.1, 0.5], [0.055, 0.56], [0.05, 0.64], [0.07, 0.67], [0.072, 0.69], [0.05, 0.69]]);
const JUG = lathe([[0, 0], [0.07, 0], [0.1, 0.06], [0.11, 0.13], [0.08, 0.2], [0.05, 0.25], [0.06, 0.29], [0.055, 0.3]]);
const BOWL = lathe([[0, 0], [0.08, 0], [0.16, 0.04], [0.2, 0.1], [0.205, 0.11], [0.19, 0.11], [0.15, 0.06], [0, 0.03]]);
const CAULDRON = lathe([[0, 0.04], [0.12, 0], [0.24, 0.07], [0.28, 0.2], [0.27, 0.32], [0.3, 0.34], [0.29, 0.36], [0.25, 0.33], [0.24, 0.2], [0.2, 0.09], [0, 0.07]]);
const POT = lathe([[0, 0], [0.09, 0], [0.13, 0.08], [0.14, 0.16], [0.11, 0.24], [0.1, 0.26], [0.12, 0.28], [0.11, 0.29]]);
const BARREL = lathe([[0, 0], [0.26, 0], [0.3, 0.2], [0.315, 0.4], [0.3, 0.6], [0.26, 0.8], [0, 0.8]], 28);

export class LabWorld {
  root = new THREE.Group();
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.55);
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  fog = new THREE.Fog("#a8c6ee", 40, 460);
  private clouds: THREE.Mesh[] = [];
  private merchant: Toon3D; private hero: Toon3D; private soldier: Toon3D; private kid: Toon3D; private bg: Toon3D[];

  private sunW: THREE.Vector3;
  private fxs: Vfx[] = []; private fire: Fire | null = null;
  constructor(kit: LabKit, private mode: { pbr: boolean; kit: boolean; sun?: THREE.Vector3; fx?: boolean }) {
    this.sunW = (mode.sun ?? LAB_SUN).clone().normalize();
    const R = this.root;
    // ---- sky (world.ts gradient, tone-map inverted) + clouds ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const K = LOOK.day, L = LIGHTS.day;
    K.sky.c.forEach((h, i) => untone(h, this.skyMat.uniforms["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); this.skyMat.uniforms.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32, d = 700 + (i % 3) * 90;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, K.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 190 + (i % 4) * 50; m.scale.set(w, w / 2, 1);
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 40, Math.sin(a) * d); m.lookAt(0, m.position.y, 0);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    // ---- light (the sun = directional light 0 = the only shadow caster; TONE drives the two-tone world) ----
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI; this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 10; sc.far = 400; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (22 / 12);
    this.sun.target.position.set(0, 0, -6); this.sun.position.set(0, 0, -6).addScaledVector(this.sunW, 200);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    R.add(this.sun, this.sun.target, this.hemi);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    TOON3D.uSunW.value.copy(this.sunW);
    untone(L.fog, this.fog.color); this.fog.near = 60; this.fog.far = 520;

    if (this.mode.kit) this.kitStreet(kit, R);
    else {
      // ---- ground: cobbled street (8 m sett tile) + packed earth beyond ----
      const cob = rep(cobbleHD(), 14 / 8, 90 / 8);
      const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), twoTone(new THREE.MeshLambertMaterial({ map: cob })));
      street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -25); street.receiveShadow = true; R.add(street);
      const earth = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), twoTone(new THREE.MeshLambertMaterial({ color: "#b59a74" })));
      earth.rotation.x = -Math.PI / 2; earth.position.y = -0.02; earth.receiveShadow = true; R.add(earth);

      // ---- houses both sides (procedural two-tone facades, as in the shorts) ----
      const b = new Batch();
      let z = 14, si = 0;
      while (z > -60) { const w = 6 + ((si * 7) % 3); house(b, -7.2, z - w / 2, Math.PI / 2, w, 6, 4.6 + ((si * 5) % 3) * 1.1, si, 0, si % 2 === 0); z -= w + 0.3; si++; }
      z = 12; si = 3;
      while (z > -60) { const w = 6 + ((si * 5) % 3); house(b, 7.2, z - w / 2, -Math.PI / 2, w, 6, 4.4 + ((si * 3) % 3) * 1.2, si, 0, si % 3 === 0); z -= w + 0.3; si++; }
      b.build(R, true);

      // ---- market: stalls, tables of goods, barrels, a trough ----
      const M = (g: Gloss) => (this.mode.pbr ? gloss(g) : this.matte(g));
      const add = (geo: THREE.BufferGeometry, g: Gloss, x: number, y: number, z2: number, s = 1, ry = 0) => {
        const m = new THREE.Mesh(geo, M(g)); m.position.set(x, y, z2); m.scale.setScalar(s); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; R.add(m); return m;
      };
      const kclone = (n: string, h: number, x: number, z2: number, yaw: number) => {
        const o = this.mode.pbr ? this.kitPbr(kit.kenney, n, h) : kitClone(kit.kenney, n, h);
        if (!o) return null; o.position.set(x, 0, z2); o.rotation.y = yaw;
        o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        R.add(o); return o;
      };
      const WOOD: Gloss = { color: "#a8724a", rough: 0.7, map: planksHD() };
      const BRONZE: Gloss = { color: "#c8904e", metal: 1, rough: 0.3 };
      const COPPER: Gloss = { color: "#d0805a", metal: 1, rough: 0.36 };
      const IRON: Gloss = { color: "#5a5f68", metal: 1, rough: 0.45 };
      const GLAZE_B: Gloss = { color: "#1f6e93", rough: 0.32, coat: 0.9 };
      const GLAZE_G: Gloss = { color: "#3f8a4e", rough: 0.32, coat: 0.9 };
      const TERRA: Gloss = { color: "#c0653a", rough: 0.62 };
      const table = (x: number, z2: number, w: number, d: number, ry: number) => {
        const g = new THREE.Group(); g.position.set(x, 0, z2); g.rotation.y = ry; R.add(g);
        const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), M(WOOD)); top.position.y = 0.82; g.add(top);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), M({ ...WOOD, color: "#8a5a38" })); l.position.set(sx * (w / 2 - 0.08), 0.4, sz * (d / 2 - 0.08)); g.add(l); }
        g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        return g;
      };
      // left side, near: the potter's stall (glazed amphorae, bowls, jugs) under the red awning
      kclone("stall-red", 3.0, -3.9, -1.2, Math.PI / 2);
      table(-3.0, -1.2, 0.9, 2.6, 0);
      [[-3.15, -2.2, GLAZE_B, 1.0], [-2.85, -1.7, TERRA, 0.9], [-3.1, -1.15, GLAZE_G, 1.05], [-2.85, -0.55, GLAZE_B, 0.85], [-3.15, -0.2, TERRA, 0.95]]
        .forEach(([x, z2, g, s], i) => add(AMPHORA, g as Gloss, x as number, 0.855, z2 as number, (s as number) * 0.95, i));
      add(BOWL, GLAZE_G, -2.75, 0.855, -2.45, 1); add(JUG, COPPER, -2.75, 0.855, 0.0, 1.1, 1.2);
      for (const [x, z2, g] of [[-4.2, 0.7, TERRA], [-4.0, 1.1, GLAZE_B], [-4.35, 1.3, TERRA]] as [number, number, Gloss][]) add(AMPHORA, g, x, 0, z2, 1.6, x * 3);
      // left side, far: the bronze smith (cauldrons, a shield, jugs)
      kclone("stall-red", 3.0, -3.9, -7.0, Math.PI / 2);
      table(-3.0, -7.0, 0.9, 2.4, 0);
      add(CAULDRON, BRONZE, -3.0, 0.855, -7.7, 0.95); add(CAULDRON, COPPER, -3.05, 0.855, -6.9, 0.75, 1);
      add(JUG, BRONZE, -2.8, 0.855, -6.3, 1.2); add(JUG, COPPER, -3.2, 0.855, -6.1, 1.0, 2);
      const shield = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 48), M(BRONZE)); disc.rotation.x = Math.PI / 2; shield.add(disc);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(BRONZE)); boss.rotation.x = Math.PI / 2; boss.position.z = 0.02; shield.add(boss);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 10, 48), M({ ...BRONZE, color: "#b07a3c" })); shield.add(rim);
      shield.position.set(-3.55, 1.45, -7.0); shield.rotation.set(-0.15, Math.PI / 2, 0); shield.traverse((c) => { (c as THREE.Mesh).castShadow = true; }); R.add(shield);
      // right side: the fruit seller, barrels, the cart and the trough
      kclone("stall-green", 3.0, 3.9, -3.4, -Math.PI / 2);
      kclone("stall-bench", 0.45, -1.6, 2.0, 0.2);
      table(3.0, -3.4, 0.9, 2.2, 0);
      const rnd = mulberry(7);
      for (const [cx, cz, col] of [[3.0, -4.1, "#c8282a"], [3.0, -3.4, "#f08a1c"], [3.0, -2.7, "#7fbf3a"]] as [number, number, string][]) {
        add(BOWL, WOOD, cx, 0.855, cz, 1.25);
        for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 0.15, s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12), M({ color: col, rough: 0.33 }));
          s.position.set(cx + Math.cos(a) * r, 0.92 + (i > 5 ? 0.06 : 0), cz + Math.sin(a) * r); s.castShadow = true; R.add(s); }
      }
      for (const [x, z2] of [[4.1, -0.6], [4.35, 0.05], [3.9, 0.45], [4.2, -9.5], [4.4, -10.2]]) {
        const bg = new THREE.Group(); bg.position.set(x, 0, z2); R.add(bg);
        const body = new THREE.Mesh(BARREL, M(WOOD)); body.castShadow = true; body.receiveShadow = true; bg.add(body);
        for (const y of [0.12, 0.68]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, 40), M(IRON)); t.rotation.x = Math.PI / 2; t.position.y = y; t.castShadow = true; bg.add(t); }
      }
      kclone("cart", 1.6, 2.6, -12.5, -0.4);
      const trough = new THREE.Group(); trough.position.set(-2.2, 0, -13); R.add(trough);
      const ts = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.62, 0.9), twoTone(new THREE.MeshLambertMaterial({ map: stoneHD() }))); ts.position.y = 0.31; ts.castShadow = true; ts.receiveShadow = true; trough.add(ts);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.72), M({ color: "#1f4f5c", rough: 0.04, coat: 1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.6; trough.add(water);
      kclone("lantern", 1.0, -3.3, 2.2, 0.3); kclone("banner-red", 2.6, 4.2, -6.4, -Math.PI / 2);
      kclone("tree_oak", 6.5, 5.6, -18, 0.6); kclone("plant_bushLarge", 1.2, -4.6, 2.8, 0);
      // set dressing for density: a foreground crate + sack + barrel cluster (frames the opening), more stalls of goods
      // down both sides, a large building closing the end of the street
      const CLOTH: Gloss = { color: "#d8c49a", rough: 0.95 };
      const crate = (x: number, y: number, z2: number, s: number, ry: number) => add(new THREE.BoxGeometry(1, 1, 1), WOOD, x, y + s / 2, z2, s, ry);
      const sackGeo = lathe([[0, 0], [0.16, 0.01], [0.22, 0.1], [0.22, 0.28], [0.17, 0.4], [0.08, 0.46], [0.1, 0.5], [0.04, 0.52], [0, 0.52]], 20);
      crate(1.75, 0, 0.6, 0.62, 0.3); crate(1.7, 0.62, 0.65, 0.46, -0.2); add(sackGeo, CLOTH, 2.2, 0, 0.1, 1.2, 0.5); add(sackGeo, CLOTH, 1.25, 0, 1.25, 1.05, 2.0);
      const goods: [Gloss, number][] = [[GLAZE_B, 1], [TERRA, 0.9], [BRONZE, 0.8], [GLAZE_G, 1.0], [COPPER, 0.85]];
      for (const [sx, sz, st] of [[-1, -12.5, "stall-green"], [-1, -18.5, "stall-red"], [1, -9.0, "stall-red"], [1, -15.5, "stall-green"], [-1, -24, "stall-green"], [1, -22, "stall-red"]] as [number, number, string][]) {
        kclone(st, 3.0, sx * 3.9, sz, -sx * Math.PI / 2); table(sx * 3.0, sz, 0.9, 2.2, 0);
        for (let i = 0; i < 5; i++) { const [g, s] = goods[(i + Math.round(-sz)) % 5]; add(i % 2 ? AMPHORA : JUG, g, sx * (3.0 + ((i % 2) - 0.5) * 0.3), 0.855, sz - 0.9 + i * 0.45, s * (i % 2 ? 0.8 : 1.3), i); }
        crate(sx * 2.2, 0, sz + 1.4, 0.55, sz); add(sackGeo, CLOTH, sx * 2.3, 0, sz - 1.5, 1.1, sz * 2);
      }
      const b2 = new Batch();
      house(b2, -3.5, -52, 0, 9, 8, 8.5, 2, 0, true); house(b2, 6.0, -53, 0, 8, 8, 6.5, 5, 0, false);
      b2.build(R, true);
      // asset-kit models (lab.kit): placed along the facades, one every 1.6 m, alternating sides, scaled to a sane height
      if (this.mode.kit) {
        let i = 0;
        for (const [n, o] of Object.entries(kit.extra)) {
          const box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
          const c = toneObject(o.clone(true)), h = Math.max(sz.y, 0.01), s = Math.min(1.4 / h, 1.6 / Math.max(sz.x, sz.z, 0.01), 1);
          const g = new THREE.Group(); c.position.y = -box.min.y * s; c.scale.setScalar(s); g.add(c);
          const side = i % 2 ? 1 : -1; g.position.set(side * (4.6 + (i % 3) * 0.25), 0, 4 - Math.floor(i / 2) * 1.6); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          g.name = n; R.add(g); i++;
        }
      }
    }

    // ---- the cast (v2 outfits, own colours; no letters) ----
    this.merchant = new Toon3D({ build: "stout", scale: 1.15,
      outfit: { shirt: "#e8902a", robe: "#e8902a", robeLen: 0.6, trim: "#7a3410", hem: "key", hemCol: "#7a3410", fabric: "wool", stitch: "#f6e2b0", belt: "#5a2e1c", buckle: "#e8c45a" },
      hat: { k: "turban", col: "#f6f2ea", band: "#2f7a8c" }, beard: { col: "#2a1d16", stache: true } });
    this.hero = new Toon3D({ build: "slim", scale: 1.2,
      outfit: { shirt: "#e6d2a6", robe: "#e6d2a6", robeLen: 0.32, trim: "#b89a66", hem: "band", fabric: "linen", patches: "#b08c5c", rope: "#c9a46a" },
      hat: { k: "hair", col: "#6a4220", curly: true } });
    this.soldier = new Toon3D({ build: "adult", scale: 1.2,
      outfit: { shirt: "#c0302a", robe: "#c0302a", robeLen: 0.3, trim: "#8a2020", hem: "band", hemCol: "#e8c45a", fabric: "wool", segs: "#a9b0ba", belt: "#5a3a20", buckle: "#c9a24a" },
      hat: { k: "romhelm" } });
    this.kid = new Toon3D({ build: "kid", scale: 1.0,
      outfit: { shirt: "#4a7fc0", robe: "#4a7fc0", robeLen: 0.3, trim: "#2a4f80", hem: "dots", hemCol: "#f6f2ea", fabric: "linen" },
      hat: { k: "hair", col: "#2a1d16" } });
    // background shoppers down the street (cheap: standing / chatting, blinking)
    const BGO: [string, string, string, "adult" | "slim" | "stout"][] = [["#6a8a3a", "#f6f2ea", "#3a2418", "adult"], ["#8a4a9a", "#e8c45a", "#5a3a20", "slim"],
      ["#d8d0c0", "#4a6fb5", "#2a1d16", "stout"], ["#b8323a", "#f6f2ea", "#6a4220", "slim"], ["#2f7a8c", "#e8902a", "#2a1d16", "adult"]];
    this.bg = BGO.map(([c, tr, hair, bu]) => new Toon3D({ build: bu, scale: 1.12,
      outfit: { shirt: c, robe: c, robeLen: 0.55, trim: tr, hem: "band", hemCol: tr, fabric: "wool", belt: "#5a3a20" }, hat: { k: "hair", col: hair } }));
    for (const c of [this.merchant, this.hero, this.soldier, this.kid, ...this.bg]) R.add(c.root);
  }

  /** KIT street: Quaternius prefab houses + market props from the asset kit, a PBR cobblestone street (ambientCG CC0),
   *  the same cast, camera and glossy code-built amphorae (the kit has no amphora) */
  private kitStreet(kit: LabKit, R: THREE.Group) {
    const ak = kit.ak;
    const put = (n: string, x: number, z2: number, yaw = 0, s = 1, y = 0) => {
      const src = ak[n]; if (!src) return null;
      const c = toneObject(src.clone(true)); const g = new THREE.Group(); g.add(c);
      g.position.set(x, y, z2); g.rotation.y = yaw; g.scale.setScalar(s); R.add(g); return g;
    };
    // ground: PBR cobbles (2 m texture tile), normal-mapped, two-tone diffuse
    const T = kit.tex.cobblestone;
    if (T) {
      const rp = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(14 / 2, 90 / 2); c.needsUpdate = true; return c; };
      const gm = pbrTone(new THREE.MeshPhysicalMaterial({ map: rp(T.map), normalMap: rp(T.normalMap), roughnessMap: rp(T.roughnessMap), roughness: 1, metalness: 0 }));
      const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), gm); street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -25); street.receiveShadow = true; R.add(street);
    }
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), twoTone(new THREE.MeshLambertMaterial({ color: "#a58a66" })));
    earth.rotation.x = -Math.PI / 2; earth.position.y = -0.02; earth.receiveShadow = true; R.add(earth);
    // houses: facades 4.25 m off the street axis, doors to the street
    const HOUSES: [string, number, number][] = [["q_village/House_Plaster_4x6", 5.51, 7.59], ["q_village/House_StonePlaster_4x4", 5.51, 5.62],
      ["q_village/House_Tall_4x4", 5.51, 5.62], ["q_village/House_Stone_6x8", 8.25, 9.68]];
    for (const side of [-1, 1]) {
      let z = side < 0 ? 11 : 9.5, i = side < 0 ? 0 : 2;
      while (z > -58) { const [n, w, d] = HOUSES[i % 4]; put(n, side * (4.25 + d / 2), z - w / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2); z -= w + 0.35; i++; }
    }
    put("q_village/House_Stone_6x8", -1.5, -66, 0); put("q_village/House_Tall_4x4", 5.5, -64, 0);
    put("q_nature/CommonTree_1", 1.8, -59, 0.4, 1.2);
    // the potter's stall (the characters' stall): cart stall + large table of pots; glossy amphorae (code) on top
    put("q_props/Stall_Cart_Empty", -3.65, -1.2, Math.PI / 2);
    put("q_props/Table_Large", -2.95, -1.2, Math.PI / 2, 0.92);
    const top = 0.81 * 0.92;
    put("q_props/Vase_4", -2.9, -2.35, 0, 1.2, top); put("q_props/Vase_2", -3.05, -1.8, 0.5, 0.75, top); put("q_props/Pot_1", -2.8, -0.3, 1, 1, top);
    const GLZ: Gloss[] = [{ color: "#1f6e93", rough: 0.32, coat: 0.9 }, { color: "#c0653a", rough: 0.62 }, { color: "#3f8a4e", rough: 0.32, coat: 0.9 }];
    [[-3.0, -1.15, 0], [-2.8, -0.85, 1], [-3.1, -0.45, 2], [-2.85, 0.05, 0]].forEach(([x, z2, k], j) => {
      const m = new THREE.Mesh(AMPHORA, this.mode.pbr ? gloss(GLZ[k]) : this.matte(GLZ[k])); m.position.set(x, top, z2); m.scale.setScalar(0.95 - j * 0.06); m.rotation.y = j; m.castShadow = true; m.receiveShadow = true; R.add(m);
    });
    put("q_props/Vase_2", -4.1, 1.0, 0.3, 1.3); put("q_props/Vase_4", -3.75, 1.45, 1.2, 1.5); put("q_props/Bag", -3.9, -3.0, 0.4);
    // foreground right cluster (frames the opening)
    put("q_props/Crate_Wooden", 1.8, 0.55, 0.3, 0.75); put("q_props/Bag", 2.25, 0.05, 0.6); put("q_props/Barrel", 1.3, 1.35, 0); put("q_props/Crate_Wooden", 1.75, 0.6, -0.2, 0.55, 0.69);
    // down the street: more stalls, produce, barrels, the smith, benches, bushes
    put("q_props/Stall_Empty", 3.75, -4.6, -Math.PI / 2); put("q_props/FarmCrate_Apple", 3.0, -4.3, -Math.PI / 2); put("q_props/FarmCrate_Carrot", 3.05, -5.0, -Math.PI / 2 + 0.2);
    put("q_props/Barrel_Apples", 3.4, -3.4, 0); put("q_props/Barrel_Apples", 3.75, -2.75, 1);
    put("q_props/Bench", 3.75, -0.6, -Math.PI / 2, 0.9);
    put("q_props/Stall_Cart_Empty", -3.65, -8.8, Math.PI / 2); put("q_props/Cauldron", -2.8, -8.2, 0.4, 0.8); put("q_props/WeaponStand", -3.0, -10.4, Math.PI / 2, 0.9);
    put("q_props/Barrel_Holder", 3.75, -9.6, -Math.PI / 2); put("q_props/Stall_Empty", 3.75, -13.5, -Math.PI / 2); put("q_props/FarmCrate_Apple", 3.0, -13.2, -Math.PI / 2);
    put("q_props/Stall_Cart_Empty", -3.65, -16.5, Math.PI / 2); put("q_props/Barrel", -3.0, -18.2, 0); put("q_props/Barrel", -2.7, -18.8, 1);
    put("q_props/Stall_Empty", 3.75, -21.5, -Math.PI / 2); put("q_props/Stall_Cart_Empty", -3.65, -24, Math.PI / 2);
    put("q_props/Banner_1", -4.15, -6.2, Math.PI / 2, 1, 1.6); put("q_props/Banner_2", 4.15, -11.0, -Math.PI / 2, 1, 1.9);
    put("q_nature/Bush_Common", -3.9, 2.6, 0, 0.8); put("q_nature/Bush_Common", 3.95, 1.6, 1, 0.7); put("q_nature/Bush_Common", 3.95, -7.2, 2, 0.7);
    if (this.mode.fx) this.addFx(R);
  }

  /** VFX test (fxlab vfx.ts): a bronze brazier with fire + a little smoke, chimney smoke down the street, a crate that bursts */
  private addFx(R: THREE.Group) {
    const BR: Gloss = { color: "#b8763a", metal: 1, rough: 0.34 };
    const bx = -0.9, bz = -7.0, bowlY = 0.95;
    const brazier = new THREE.Group(); brazier.position.set(bx, 0, bz); R.add(brazier);
    const bowl = new THREE.Mesh(BOWL, this.mode.pbr ? gloss(BR) : this.matte(BR)); bowl.scale.setScalar(2.1); bowl.position.y = bowlY; brazier.add(bowl);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.05, 10), this.mode.pbr ? gloss({ ...BR, color: "#5a4a3c", rough: 0.5 }) : this.matte(BR));
      leg.position.set(Math.cos(a) * 0.28, 0.5, Math.sin(a) * 0.28); leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); brazier.add(leg); }
    brazier.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.fire = new Fire({ pos: [bx, bowlY + 0.16, bz], size: 0.75, start: -60, seed: 3 });
    const smoke = new SmokePlume({ ...SMOKE_PRESETS.chimney, source: [bx, bowlY + 0.75, bz], start: -300, rate: 0.12, size: [0.1, 0.42], life: 80, seed: 11 });
    const chimney = new SmokePlume({ ...SMOKE_PRESETS.chimney, source: [7.4, 10.2, -14.5], start: -400, seed: 21 });
    const crate = new Debris({ pos: [-1.35, 0.45, -11.5], at: 30, volume: [0.42, 0.42, 0.42], count: 18, size: [0.18, 0.42], colors: ["#a8724a", "#8a5a38", "#c08a5a"],
      dir: [0, 1, 0.3], cone: 55, speed: [2.2, 4.5], showBefore: true, seed: 5 });
    this.fxs.push(this.fire, smoke, chimney, crate);
    for (const e of this.fxs) R.add(e.root);
  }

  /** the old look: the same colour / map as a matte two-tone Lambert (what every prop was before this upgrade) */
  private mats = new Map<string, THREE.Material>();
  private matte(g: Gloss) {
    const k = JSON.stringify({ c: g.color, m: g.map?.uuid });
    let m = this.mats.get(k);
    if (!m) { m = twoTone(new THREE.MeshLambertMaterial({ color: g.color, map: g.map ?? null })); this.mats.set(k, m); }
    return m;
  }
  /** a Kenney model with its shipped materials kept as PBR (pbrTone) instead of build.ts's matte Lambert conversion */
  private kitPbr(kit: Kit, name: string, h: number) {
    const o = kit[name]; if (!o) return null;
    const box = new THREE.Box3().setFromObject(o), c = toneObject(o.clone(true)), s = h / Math.max(0.01, box.max.y - box.min.y);
    const g = new THREE.Group(); c.position.y = -box.min.y * s; c.scale.setScalar(s); g.add(c); return g;
  }

  /** camera + cast at frame f (fractional allowed); returns the focus point */
  update(f: number, cam: THREE.PerspectiveCamera) {
    const t = ease(f / (LAB_FRAMES - 1));
    // a slow push-in + slight arc on the potter's stall (medium shot, 5.6 -> 4.0 m), the street receding behind it
    const pos = lerp3([0.7, 1.22, 3.4], [0.25, 1.15, 1.2], t), look = lerp3([-1.25, 1.32, -2.4], [-1.4, 1.28, -3.1], t);
    cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...look); cam.fov = 58; cam.near = 0.1; cam.far = 2400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    this.sky.position.copy(cam.position);
    for (const e of this.fxs) e.update(f);
    if (this.fire) { const g = this.fire.light(f); GLOW.uGlowPos.value.set(...g.pos); GLOW.uGlowCol.value.set(...g.col); GLOW.uGlowR.value = g.r; }
    // merchant behind the potter's table, turned to the soldier, gesturing
    const mPos: V3 = [-2.06, 0, -1.76], sPos: V3 = [-0.54, 0, -2.24];
    const ff = Math.floor(f);  // acting on ones (the camera is the smooth layer)
    const talkUp = Math.sin(ff * 0.35) > 0.2;
    const mFace = blink(ff, 3, talkUp ? { ...EXPR.laugh } : { ...EXPR.smugBrow });
    this.merchant.pose({ pos: mPos, yaw: yawTo(mPos, sPos) - 0.55, lean: 4, face: mFace,
      armL: this.merchant.hand("hip", "L"), armR: this.merchant.hand(talkUp ? "wave" : "point", "R", 0.8), head: { yaw: -0.15, pitch: 0.05 } });
    // soldier in profile, haggling: hands on hips, sceptical
    this.soldier.pose({ pos: sPos, yaw: yawTo(sPos, mPos) + 0.55, face: blink(ff, 11, { ...EXPR.disgusted }),
      armL: this.soldier.hand("hip", "L"), armR: this.soldier.hand("hip", "R"), head: { yaw: 0.25 } });
    // hero walks toward the lens down the middle of the street, grinning
    const d = lerp(0, 3.6, f / (LAB_FRAMES - 1)), hPos: V3 = [0.35, 0, -9.0 + d];
    const sw = Math.sin((d / 1.8) * Math.PI * 2);
    this.hero.pose({ pos: hPos, yaw: 0.15, walk: { phase: d / 1.8, stride: 0.9, lift: 0.5 }, face: blink(ff, 5, { ...EXPR.happy }),
      armL: { hand: [0.3, 1.0, 0.18 * sw], pole: [1, -0.4, 0] }, armR: { hand: [-0.3, 1.0, -0.18 * sw], pole: [-1, -0.4, 0] }, head: { yaw: 0.2 } });
    // kid at the fruit stall, reaching for an apple, nervous
    const kPos: V3 = [-2.25, 0, -0.15];
    this.kid.pose({ pos: kPos, yaw: -Math.PI / 2 - 0.2, face: blink(ff, 9, { ...EXPR.nervous }), lean: 8,
      armR: this.kid.hand("point", "R", 0.9), armL: this.kid.hand("down", "L"), head: { yaw: 0.6 } });
    const BGP: [V3, number, string][] = [[[-2.0, 0, -12.0], -1.4, "happy"], [[-1.4, 0, -12.6], 2.2, "laugh"], [[2.1, 0, -9.4], 1.6, "smug"],
      [[1.2, 0, -16.0], 0.4, "neutral"], [[-2.2, 0, -18.0], -1.5, "worried"]];
    this.bg.forEach((c, i) => { const [p, yw, ex] = BGP[i];
      c.pose({ pos: p, yaw: yw, face: blink(ff, 20 + i, { ...EXPR[ex] }), armL: c.hand(i % 2 ? "hip" : "down", "L"), armR: c.hand(i === 1 ? "wave" : "down", "R", 0.7) }); });
    void WALK_CYCLE;
    return new THREE.Vector3(...lerp3([-1.3, 1.3, -2.0], [-1.3, 1.3, -2.0], t));
  }
}
