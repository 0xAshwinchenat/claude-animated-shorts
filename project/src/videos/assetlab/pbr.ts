// Glossy, game-quality props in the toon world (2026-11-09 asset-kit upgrade, after the newest-4 reference study:
// his worlds are stylised-PBR game assets with specular, clearcoat, reflections; ours were matte two-tone only).
//
// pbrTone(m): a MeshStandardMaterial / MeshPhysicalMaterial keeps three's physically based SPECULAR (the sun's highlight,
//   masked by the sun's shadow, plus image-based reflections of scene.environment, clearcoat, Fresnel at grazing
//   angles) while its DIFFUSE becomes exactly the world's two-tone light (shade.ts: same lit / shade colours, same soft
//   terminator, same shadow), so a glossy bronze pot sits in the same light as the painted walls around it.
// envFromSky(gl, light): the environment those reflections see = our own sky gradient (the same on-screen stops as
//   world.ts, tone-map inverted), a darker ground below the horizon and a soft bright patch round the sun. No HDRI is
//   needed and reflections always agree with the painted sky. (An HDRI from public/assetkit/hdri can replace it.)
// toneObject(o, opt): converts every material of an imported GLB (asset kit) to pbrTone, with per-name material rules
//   (metal / glass / glaze / wood / cloth ...) because stylised packs ship roughness 1 / metalness 0 everywhere.
import * as THREE from "three";
import { TONE, GLOW, LFB, DECL, TWO_TONE, untone } from "./shade";
import { LIGHTS, LOOK, LightName } from "./lights";

// the two-tone block, but on the METAL-AWARE albedo (three: material.diffuseColor = albedo x (1 - metalness)), so a
// metal is lit only through its specular + reflections, like a real metal
const TWO_TONE_PBR = TWO_TONE.split("diffuseColor.rgb").join("material.diffuseColor");
if (!TWO_TONE_PBR.includes("material.diffuseColor")) throw new Error("pbr.ts: shade.ts TWO_TONE changed");

/** PBR material -> two-tone diffuse + PBR specular. Call once per material. */
export function pbrTone<T extends THREE.MeshStandardMaterial>(m: T, liftK = 1): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TONE, GLOW);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL + `\n#define LIFT_K ${liftK.toFixed(3)}`)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + TWO_TONE_PBR);
  };
  m.customProgramCacheKey = () => "pbrTone1_" + liftK.toFixed(3); // not "twoTone*": Pigs.tsx bumpify skips these
  return m;
}

export type Gloss = { color: THREE.ColorRepresentation; metal?: number; rough?: number; coat?: number; coatRough?: number; env?: number;
  map?: THREE.Texture | null; normalMap?: THREE.Texture | null; side?: THREE.Side };
const glossCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** a cached glossy material (bronze: { color: "#b8763a", metal: 1, rough: 0.3 }; glaze: { color, rough: 0.35, coat: 1 }) */
export const gloss = (g: Gloss) => {
  const key = JSON.stringify({ ...g, map: g.map?.uuid, normalMap: g.normalMap?.uuid });
  let m = glossCache.get(key);
  if (!m) {
    m = pbrTone(new THREE.MeshPhysicalMaterial({ color: g.color, metalness: g.metal ?? 0, roughness: g.rough ?? 0.5,
      clearcoat: g.coat ?? 0, clearcoatRoughness: g.coatRough ?? 0.12, envMapIntensity: g.env ?? 1,
      map: g.map ?? null, normalMap: g.normalMap ?? null, side: g.side ?? THREE.FrontSide }));
    glossCache.set(key, m);
  }
  return m;
};

// ---------------------------------------------------------------- environment from our own sky
/** PMREM environment texture of the world's sky for a light preset (call once per preset per renderer).
 *  sunDir = direction TOWARD the sun (world space): a soft warm glow round it gives glossy surfaces a sun-side sheen
 *  (the sharp sun highlight itself comes from the directional light's specular, so the env holds no hard disc). */
export function envFromSky(gl: THREE.WebGLRenderer, light: LightName, sunDir: THREE.Vector3, opt: { groundK?: number; glowK?: number } = {}) {
  const K = LOOK[light], L = LIGHTS[light];
  const c = K.sky.c.map((h) => untone(h));
  const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
  const ground = untone(L.ground).multiplyScalar(opt.groundK ?? 0.55);
  const sunC = new THREE.Color(L.sunCol).multiplyScalar(opt.glowK ?? 1.6);
  const mat = new THREE.ShaderMaterial({
    uniforms: { c0: { value: c[0] }, c1: { value: c[1] }, c2: { value: c[2] }, c3: { value: c[3] }, c4: { value: c[4] },
      e: { value: new THREE.Vector4(e[1], e[2], e[3], e[4]) }, gC: { value: ground }, sD: { value: sunDir.clone().normalize() }, sC: { value: sunC } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 c0, c1, c2, c3, c4, gC, sD, sC; uniform vec4 e; varying vec3 vP;
      void main(){ vec3 d = normalize(vP); float el = asin(clamp(d.y, -1.0, 1.0));
        vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
        c = mix(c, c2, smoothstep(e.x, e.y, el)); c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el));
        vec3 g = mix(c0 * 0.8, gC, smoothstep(0.0, 0.12, -el));             // horizon haze into the ground
        c = el < 0.0 ? g : c;
        float s = max(dot(d, sD), 0.0);
        c += sC * (0.55 * pow(s, 24.0) + 0.18 * pow(s, 4.0));                 // soft glow round the sun
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(scene, 0, 0.1, 200);
  pm.dispose(); mat.dispose();
  return rt.texture;
}

// ---------------------------------------------------------------- imported models (asset kit GLBs)
export type MatRule = { re: RegExp; metal?: number; rough?: number; coat?: number; env?: number };
/** matched against the material name AND the mesh name (first rule wins). Stylised packs mostly ship roughness 1. */
export const MAT_RULES: MatRule[] = [
  { re: /gold|brass|bronze|copper|coin/i, metal: 1, rough: 0.3 },
  { re: /metal|iron|steel|silver|chain|blade|sword|axe|nail|hinge|anvil|helmet|armou?r/i, metal: 1, rough: 0.38 },
  { re: /glass|window|crystal|gem|jewel/i, metal: 0, rough: 0.06, coat: 1 },
  { re: /water|liquid|wine|oil/i, metal: 0, rough: 0.04, coat: 1 },
  { re: /ceramic|glaze|porcelain|vase|lacquer|varnish|polish|leather_shiny/i, metal: 0, rough: 0.3, coat: 0.7 },
  { re: /pot|jar|amphora|clay|terracotta/i, metal: 0, rough: 0.62 },
  { re: /fruit|apple|tomato|cherry|grape/i, metal: 0, rough: 0.35 },
  { re: /wood|plank|bark|log|beam|barrel|crate/i, metal: 0, rough: 0.72 },
  { re: /cloth|fabric|leather|rope|straw|hay|wool|canvas|sack|banner|tent/i, metal: 0, rough: 0.92 },
  { re: /stone|rock|brick|plaster|wall|roof/i, metal: 0, rough: 0.85 },
];
const conv = new Map<string, THREE.Material>();
/** one imported material -> a pbrTone MeshPhysicalMaterial (cached by source uuid + rule) */
export const toneMaterial = (src: THREE.Material, meshName = "", envK = 1): THREE.Material => {
  const s = src as THREE.MeshStandardMaterial;
  const textured = !!(s.roughnessMap || s.metalnessMap); // shipped PBR maps win: name rules are for flat-colour packs
  const rule = textured ? undefined : MAT_RULES.find((r) => r.re.test(src.name) || r.re.test(meshName));
  const key = src.uuid + "|" + (rule ? MAT_RULES.indexOf(rule) : -1) + "|" + envK;
  let m = conv.get(key);
  if (m) return m;
  const p = new THREE.MeshPhysicalMaterial({
    name: src.name, color: s.color ?? new THREE.Color("#ffffff"), map: s.map ?? null, normalMap: s.normalMap ?? null,
    normalScale: s.normalScale ?? new THREE.Vector2(1, 1), roughnessMap: s.roughnessMap ?? null, metalnessMap: s.metalnessMap ?? null,
    aoMap: s.aoMap ?? null, emissive: s.emissive ?? new THREE.Color(0), emissiveMap: s.emissiveMap ?? null,
    emissiveIntensity: s.emissiveIntensity ?? 1, alphaMap: s.alphaMap ?? null, transparent: s.transparent, alphaTest: s.alphaTest,
    opacity: s.opacity, side: s.side, vertexColors: s.vertexColors,
    metalness: rule?.metal ?? (s.metalness ?? 0), roughness: rule?.rough ?? Math.min(s.roughness ?? 0.8, 0.95),
    clearcoat: rule?.coat ?? 0, clearcoatRoughness: 0.15, envMapIntensity: (rule?.env ?? 1) * envK,
  });
  m = pbrTone(p);
  conv.set(key, m);
  return m;
};
/** every mesh under o: materials -> pbrTone, shadows on (props cast crisp sun shadows like the reference) */
export const toneObject = (o: THREE.Object3D, opt: { cast?: boolean; envK?: number } = {}) => {
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((mm) => toneMaterial(mm, mesh.name, opt.envK)) : toneMaterial(mesh.material, mesh.name, opt.envK);
    mesh.castShadow = opt.cast ?? true; mesh.receiveShadow = true;
  });
  return o;
};
