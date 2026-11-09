// vfx.ts: frame-pure stylised-game VFX for the toon world (fxlab, 2026-11-09).
//
// WHAT: shaded "cotton ball" smoke puffs, puff bursts, explosions (HDR core flash + fireball + shockwave ring + sparks),
// dust trails, stylised fire (flame tongues + licks + embers) and rigid-body debris that tumbles, bounces and settles.
// Built for the shorts' pipeline: two-tone sun shading from shade.ts (TONE uniforms, sun = directional light 0 = the
// only shadow caster, its visibility captured by LFB), emissive values > 1 for bloom (threshold 1.0), linear HDR into
// the composer (NEUTRAL tone map + grade after). See VFX.md next to this file for the API, perf and lab paths.
//
// CONTRACT (every effect):
//   const fx = new SmokePlume({ ... });  world.root.add(fx.root);  ...  fx.update(f) once per rendered frame.
//   f = STORY FRAME at 30 fps, may be fractional (the 120 fps HQ render samples 4 sub-frames per frame).
//   update(f) is a PURE function of f and the constructor options: seeded RNG (mulberry32 / hashInt) only, no
//   Math.random, no clocks, no state carried between calls (Remotion renders frames out of order, in parallel tabs).
//   Physics (Debris) is a fixed-step simulation run ONCE in the constructor (240 Hz) and interpolated in update().
//   Particles are re-derived every call from their birth index k: birth time tb(k) = start + (k + jitter_k) / rate.
//
// LOOK:
//   - Puffs are opaque, depth-writing, lumpy noise-displaced icospheres (analytic normals) in ONE InstancedMesh per
//     effect. No sorted transparency anywhere: puffs dissolve by scale-down + a 3D noise-threshold discard (crisp
//     edges, no sorting flicker). The sun term is a soft two-tone terminator (lit side / shade side), the shade side
//     is lifted toward the lit colour (`lift`), puffs cast + receive the sun shadow (self-shadowing plumes).
//   - Heat (explosions) is an emissive black-body ramp up to ~6x (white-hot), so the bloom picks up only hot gas.
//   - Fire tongues are emissive lathe teardrops with an upward-scrolling noise erosion (licking tips), HDR gradient
//     white-yellow core -> orange -> dark red tips.
//   - Layers: puffs / fire / sparks / rings are on NOINK (no world ink, no rectangle lines); debris chunks stay on
//     layer 0 so the InkPass outlines them like every other world prop.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TONE, LFB, twoTone } from "./shade";
import { NOINK } from "./ink";

export type V3 = [number, number, number];
/** a fixed point or a moving one (story frame -> world position, metres) */
export type Src = V3 | ((f: number) => V3);
/** every effect: add `root` to the scene once, call update(f) every frame */
export interface Vfx { readonly root: THREE.Object3D; update(f: number): void; dispose(): void }

// ============================================================== small math + seeded randomness
const at = (s: Src, f: number): V3 => (typeof s === "function" ? s(f) : s);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

/** 32-bit integer hash of any number of integers (stateless) */
export function hashInt(...xs: number[]): number {
  let h = 0x811c9dc5;
  for (const x of xs) { h = Math.imul(h ^ (Math.floor(x) | 0), 0x01000193); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; }
  return h >>> 0;
}
/** mulberry32: tiny seeded PRNG, returns floats in [0, 1) */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** the private random stream of particle k of an effect (same numbers every call) */
const rngK = (seed: number, k: number, salt = 0) => mulberry32(hashInt(seed, k, salt));
const lin = (c: THREE.ColorRepresentation) => new THREE.Color(c); // three converts sRGB hex -> linear working space

// ============================================================== GLSL: value noise (+ analytic derivatives), puff shape
const GLSL_NOISE = /* glsl */ `
float vfxH(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
// value noise in [0,1] with its gradient (quintic fade): x = value, yzw = d/dp
vec4 vfxNoised(vec3 x) {
  vec3 i = floor(x); vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
  float a = vfxH(i), b = vfxH(i + vec3(1.0, 0.0, 0.0)), c = vfxH(i + vec3(0.0, 1.0, 0.0)), d = vfxH(i + vec3(1.0, 1.0, 0.0));
  float e = vfxH(i + vec3(0.0, 0.0, 1.0)), f = vfxH(i + vec3(1.0, 0.0, 1.0)), g = vfxH(i + vec3(0.0, 1.0, 1.0)), h = vfxH(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f, k7 = -a + b + c - d + e - f - g + h;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
float vfxNoise(vec3 x) {
  vec3 i = floor(x); vec3 w = fract(x); vec3 u = w * w * (3.0 - 2.0 * w);
  return mix(mix(mix(vfxH(i), vfxH(i + vec3(1.0, 0.0, 0.0)), u.x), mix(vfxH(i + vec3(0.0, 1.0, 0.0)), vfxH(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(vfxH(i + vec3(0.0, 0.0, 1.0)), vfxH(i + vec3(1.0, 0.0, 1.0)), u.x), mix(vfxH(i + vec3(0.0, 1.0, 1.0)), vfxH(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}
// cotton-ball radius offset (x) and its gradient (yzw) on the unit sphere: two octaves of BILLOW noise
// (|n| creases between rounded lobes = cauliflower / cumulus look)
vec4 vfxLump(vec3 n, vec3 off) {
  vec4 a = vfxNoised(n * 1.55 + off);
  vec4 b = vfxNoised(n * 2.7 + off.yzx * 1.37 + 11.0);
  float sa = a.x - 0.5, sb = b.x - 0.5;
  float d = 1.25 * abs(sa) + 0.32 * sb - 0.3;
  vec3 g = 1.25 * sign(sa) * a.yzw * 1.55 + 0.32 * b.yzw * 2.7;
  return vec4(d, g);
}
`;
const GLSL_HEAT = /* glsl */ `
vec3 vfxHeat(float h) {   // emissive black-body ramp (linear HDR): 0 none, .3 deep red, .55 orange, .9 yellow, 1.5 white-hot
  vec3 c = vec3(0.6, 0.05, 0.01) * smoothstep(0.0, 0.3, h);
  c = mix(c, vec3(2.2, 0.62, 0.07), smoothstep(0.25, 0.6, h));
  c = mix(c, vec3(3.6, 2.1, 0.5), smoothstep(0.55, 0.95, h));
  c = mix(c, vec3(6.5, 5.4, 3.4), smoothstep(0.95, 1.5, h));
  return c;
}
`;

const PUFF_DECL_V = /* glsl */ `
attribute vec4 aPuffA;   // xyz = noise-domain offset (seed + boil drift), w = lumpiness
attribute vec4 aPuffB;   // x = dissolve 0..1, y = heat
varying vec3 vPObj; varying vec2 vPDH; varying vec3 vPWorld;
${GLSL_NOISE}`;
const PUFF_DISP = /* glsl */ `
  vec3 pN = normalize(position);
  vec4 pL = vfxLump(pN, aPuffA.xyz);
  float pR = 1.0 + aPuffA.w * pL.x;
  vec3 pG = aPuffA.w * pL.yzw;
  // dissolve = noise-driven EROSION of the surface: the puff shrinks to nothing, faster where an erosion noise is low,
  // so it breaks up into uneven lobes on the way (closed surface: no holes, no eggshell shards, crisp silhouette;
  // it never collapses to spikes). e = (1 - d^1.25) (1 + 1.3 d (m - 0.5)), product rule for the normal.
  float pD = aPuffB.x;
  if (pD > 0.0) {
    vec4 pE = vfxNoised(pN * 1.8 + aPuffA.zxy * 0.73 + 5.0);
    float base = 1.0 - pow(pD, 1.25);
    float e = max(base * (1.0 + 1.3 * pD * (pE.x - 0.5)), 0.0);
    pG = pG * e + pR * base * 1.3 * pD * pE.yzw * 1.8; pR *= e;
  }
  pG -= dot(pG, pN) * pN;
  vec3 vfxP = pN * pR;
  vPDH = aPuffB.xy; vPObj = vfxP;
`;
const PUFF_DECL_F = /* glsl */ `
varying vec3 vPObj; varying vec2 vPDH; varying vec3 vPWorld;
${GLSL_NOISE}`;
const PUFF_LIGHT = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;                       // view space, toward the sun
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float ndl = dot( geometryNormal, sunV );
  float sunTerm = mix( 1.0, sunVis, uPShadowK ) * smoothstep( uPTerm.x, uPTerm.y, ndl );   // soft two-tone terminator; cast shadows (incl. other puffs) at uPShadowK
  float skyK = mix( uSideK, 1.0, 0.5 + 0.5 * dot( geometryNormal, upV ) );
  vec3 lit = uLitCol * mix( 1.0, clamp( ndl * 0.5 + 0.5, 0.0, 1.0 ), uPLambert );
  vec3 shd = mix( uShadeCol, uLitCol, uPLift );                         // shade side lifted toward the lit colour
  vec3 alb = diffuseColor.rgb;
  reflectedLight.directDiffuse = alb * mix( shd, lit, sunTerm ) * skyK;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
  if ( uPGlowC.r + uPGlowC.g + uPGlowC.b > 0.0 ) {                      // under-light from a fire (optional)
    vec3 gd = uPGlowP - vPWorld; float gl = length( gd );
    vec3 gdv = normalize( ( viewMatrix * vec4( gd, 0.0 ) ).xyz );
    float gk = exp( -( gl * gl ) / ( uPGlowR * uPGlowR ) ) * ( 0.3 + 0.7 * max( dot( geometryNormal, gdv ), 0.0 ) );
    reflectedLight.directDiffuse += alb * uPGlowC * gk;
  }
  float facing = max( dot( geometryNormal, geometryViewDir ), 0.0 );
  totalEmissiveRadiance += vfxHeat( vPDH.y ) * uPHeatK * mix( 0.5, 1.0, facing * facing );
}
#endif
`;

const PUFF_GEO: Record<number, THREE.BufferGeometry> = {};
/** indexed unit icosphere (normals = positions; the shader replaces them with the displaced surface normal) */
function puffBase(detail: number) {
  if (!PUFF_GEO[detail]) {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute("normal"); g.deleteAttribute("uv");
    g = mergeVertices(g);
    g.setAttribute("normal", (g.getAttribute("position") as THREE.BufferAttribute).clone());
    PUFF_GEO[detail] = g;
  }
  return PUFF_GEO[detail];
}

export type PuffLook = {
  /** icosphere subdivision (4 = 2562 verts, the default; 3 = 642 verts for far / small puffs) */
  detail?: number;
  /** terminator: smoothstep range over N.L (soft two-tone edge); default [-0.1, 0.38] */
  term?: [number, number];
  /** shade side lifted toward the lit colour (0 = world shade colour, 1 = no shading); default 0.2 */
  lift?: number;
  /** cosine modelling kept inside the lit side (0..1); default 0.35 */
  lambert?: number;
  /** emissive multiplier for heat; default 1 */
  heatK?: number;
  /** how dark received sun shadows are (other puffs, buildings): 0 = ignored, 1 = full; default 0.6 (soft self-shadowing) */
  shadowK?: number;
  /** fraction of its view depth a puff is pulled toward the lens (ink / occlusion bias, invisible); default 0.03 */
  depthPull?: number;
  castShadow?: boolean; receiveShadow?: boolean;
  /** orange under-light from a fire (world position, linear colour x intensity, e-fold radius m) */
  glow?: { pos: V3; col: V3; r: number } | null;
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _v = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);

/** One InstancedMesh of shaded puffs. Effects fill it every frame: begin(); push(...) x n; end(). */
export class PuffField {
  readonly mesh: THREE.InstancedMesh;
  readonly u = {
    uPTerm: { value: new THREE.Vector2(-0.1, 0.38) }, uPLift: { value: 0.2 }, uPLambert: { value: 0.35 }, uPHeatK: { value: 1 }, uPShadowK: { value: 0.6 }, uPDepthK: { value: 0.97 },
    uPGlowP: { value: new THREE.Vector3() }, uPGlowC: { value: new THREE.Vector3() }, uPGlowR: { value: 2 },
  };
  private A: THREE.InstancedBufferAttribute; private B: THREE.InstancedBufferAttribute;
  private n = 0;
  constructor(readonly max: number, look: PuffLook = {}) {
    const base = puffBase(look.detail ?? 4);
    const g = new THREE.BufferGeometry();
    g.setIndex(base.getIndex()); g.setAttribute("position", base.getAttribute("position")); g.setAttribute("normal", base.getAttribute("normal"));
    this.A = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.A.setUsage(THREE.DynamicDrawUsage);
    this.B = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.B.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aPuffA", this.A); g.setAttribute("aPuffB", this.B);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    if (look.term) this.u.uPTerm.value.set(...look.term);
    if (look.lift !== undefined) this.u.uPLift.value = look.lift;
    if (look.lambert !== undefined) this.u.uPLambert.value = look.lambert;
    if (look.heatK !== undefined) this.u.uPHeatK.value = look.heatK;
    if (look.shadowK !== undefined) this.u.uPShadowK.value = look.shadowK;
    if (look.depthPull !== undefined) this.u.uPDepthK.value = 1 - look.depthPull;
    if (look.glow) this.setGlow(look.glow.pos, look.glow.col, look.glow.r);
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uLitCol: TONE.uLitCol, uShadeCol: TONE.uShadeCol, uSideK: TONE.uSideK }, this.u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uPDepthK;\n" + PUFF_DECL_V)
        .replace("#include <beginnormal_vertex>", PUFF_DISP + "\n  vec3 objectNormal = normalize(pN - pG / max(pR, 1e-3));")
        .replace("#include <begin_vertex>", "vec3 transformed = vfxP;")
        .replace("#include <project_vertex>", `#include <project_vertex>
  vec4 vfxW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  vfxW = instanceMatrix * vfxW;
  #endif
  vPWorld = (modelMatrix * vfxW).xyz;
  // depth pull: scale the view-space position toward the lens (same pixel, ~3 % nearer depth) so the InkPass sees a
  // puff wrapped round an object as clearly IN FRONT of it and does not draw that object's outline through the puff
  mvPosition.xyz *= uPDepthK; gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uLitCol; uniform vec3 uShadeCol; uniform float uSideK; uniform vec2 uPTerm; uniform float uPLift; uniform float uPLambert; uniform float uPHeatK; uniform float uPShadowK; uniform vec3 uPGlowP; uniform vec3 uPGlowC; uniform float uPGlowR;\n" + PUFF_DECL_F + GLSL_HEAT)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + PUFF_LIGHT);
    };
    mat.customProgramCacheKey = () => "vfxPuff4";
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + PUFF_DECL_V)
        .replace("#include <begin_vertex>", PUFF_DISP + "\n  vec3 transformed = vfxP;");
    };
    depth.customProgramCacheKey = () => "vfxPuffDepth4";
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.setRGB(1, 1, 1)); // allocates instanceColor (USE_INSTANCING_COLOR)
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.customDepthMaterial = depth;
    this.mesh.castShadow = look.castShadow ?? true;
    this.mesh.receiveShadow = look.receiveShadow ?? true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.layers.set(NOINK);
  }
  /** orange under-light from a fire; col = linear RGB x intensity (0 = off) */
  setGlow(pos: V3, col: V3, r: number) { this.u.uPGlowP.value.set(...pos); this.u.uPGlowC.value.set(...col); this.u.uPGlowR.value = r; }
  begin() { this.n = 0; }
  /** one puff: centre, radius (m), vertical squash, albedo (linear), dissolve 0..1, heat 0..1.5, noise offset (seed + boil), lumpiness */
  push(x: number, y: number, z: number, r: number, sy: number, col: THREE.Color, dis: number, heat: number, ox: number, oy: number, oz: number, lump: number) {
    if (this.n >= this.max || r <= 1e-4 || dis >= 0.999) return;
    const i = this.n++;
    _m.compose(_p.set(x, y, z), _q.identity(), _s.set(r, r * sy, r));
    this.mesh.setMatrixAt(i, _m);
    this.mesh.setColorAt(i, col);
    this.A.setXYZW(i, ox, oy, oz, lump);
    this.B.setXYZW(i, clamp01(dis), heat, 0, 0);
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.A.needsUpdate = true; this.B.needsUpdate = true;
  }
  get count() { return this.n; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.customDepthMaterial?.dispose(); this.mesh.dispose(); }
}

/** noise offset of puff k: a fixed random domain position + a slow drift (the lobes churn = "boil") */
const puffOff = (r: () => number, age: number, boil: number): V3 => [r() * 97 + age * boil * 0.6, r() * 97 - age * boil, r() * 97 + age * boil * 0.3];

/** birth-index window of a steady emitter: all k whose (jittered) birth can be alive at f */
const kRange = (f: number, start: number, end: number, rate: number, life: number): [number, number] => {
  const k0 = Math.max(0, Math.floor((f - life - start) * rate) - 1);
  const k1 = Math.floor((Math.min(f, end) - start) * rate);
  return [k0, k1];
};

// ============================================================== SmokePlume
export type SmokeOpts = {
  /** emitter position (chimney top, fire top), fixed or moving */
  source: Src;
  /** emission window (story frames); puffs born before `end` live out their life. A negative start pre-rolls. */
  start?: number; end?: number;
  /** puffs per frame (0.6) */
  rate?: number;
  /** puff lifetime in frames (110) */
  life?: number;
  /** initial rise speed m/frame (0.045); it slows to `riseEnd` x this by the end of life */
  rise?: number; riseEnd?: number;
  /** wind drift m/frame at full development (puffs pick it up over the first ~20 % of life) */
  wind?: V3;
  /** puff radius at birth and at end of life (m) */
  size?: [number, number];
  /** emitter disc radius (m) */
  spread?: number;
  /** lateral widening speed m/frame (the column opens up) */
  widen?: number;
  /** low-frequency wobble amplitude (m, reached at end of life) */
  turb?: number;
  /** albedo at birth / at end of life (sRGB hex); see SMOKE_PRESETS (steam / chimney / burning) for tested values */
  color?: THREE.ColorRepresentation; colorEnd?: THREE.ColorRepresentation;
  /** lumpiness of each puff (0.32), boil speed of the lobes (0.02) */
  lump?: number; boil?: number;
  /** fraction of life when the noise dissolve starts (0.5) */
  dissolveAt?: number;
  /** emitter heat: puffs leave the source glowing (0 = none; 0.6 = fire-lit dark smoke) for `heatLife` frames */
  heat?: number; heatLife?: number;
  seed?: number;
  look?: PuffLook;
  /** hard cap (default: rate x life x 1.2) */
  max?: number;
};
export const SMOKE_PRESETS = {
  steam: { color: "#ecebe8", colorEnd: "#f4f3f1", rise: 0.05, size: [0.16, 0.7], life: 80, rate: 0.7, dissolveAt: 0.4, look: { lift: 0.3 } },
  chimney: { color: "#d4d0cb", colorEnd: "#e2e0dc", rise: 0.042, size: [0.2, 0.85], life: 120, rate: 0.42, look: { lift: 0.22 } },
  burning: { color: "#5e5759", colorEnd: "#8c8684", rise: 0.06, size: [0.3, 1.15], life: 120, rate: 0.5, look: { lift: 0.24 } },
} satisfies Record<string, Partial<SmokeOpts>>;

export class SmokePlume implements Vfx {
  readonly root = new THREE.Group();
  readonly field: PuffField;
  private o: Required<Omit<SmokeOpts, "look" | "max">>;
  private c0: THREE.Color; private c1: THREE.Color;
  constructor(opts: SmokeOpts) {
    const o = this.o = {
      start: 0, end: 1e9, rate: 0.6, life: 110, rise: 0.045, riseEnd: 0.25, wind: [0.012, 0, 0.004] as V3, size: [0.25, 1.1] as [number, number],
      spread: 0.12, widen: 0.006, turb: 0.35, color: "#d6d1cb", colorEnd: "#e8e6e2", lump: 0.32, boil: 0.02, dissolveAt: 0.5,
      heat: 0, heatLife: 6, seed: 1, ...opts,
    };
    this.c0 = lin(o.color); this.c1 = lin(o.colorEnd);
    this.field = new PuffField(opts.max ?? Math.ceil(o.rate * o.life * 1.2) + 4, opts.look);
    this.root.add(this.field.mesh);
  }
  update(f: number) {
    const o = this.o, F = this.field, L = o.life;
    F.begin();
    const [k0, k1] = kRange(f, o.start, o.end, o.rate, L);
    const tw = 0.2 * L, eL = 1 - Math.exp(-3);
    for (let k = k1; k >= k0; k--) {          // youngest first: if the cap is hit, the oldest puffs go
      const r = rngK(o.seed, k, 11);
      const tb = o.start + (k + r()) / o.rate;
      const a = f - tb;
      if (a < 0 || a >= L || tb > o.end) continue;
      const src = at(o.source, tb);
      const th = r() * TAU, rho = Math.sqrt(r()) * o.spread, wv = 0.6 + 0.8 * r();
      const ph1 = r() * TAU, ph2 = r() * TAU, sv = 0.78 + 0.44 * r(), bv = 0.9 + 0.18 * r();
      const off = puffOff(r, a, o.boil);
      const h = o.rise * (a - (0.5 * (1 - o.riseEnd) * a * a) / L);
      const wr = a - tw * (1 - Math.exp(-a / tw));
      const wid = o.widen * wv * Math.pow(a, 0.85), tu = o.turb * (a / L);
      const x = src[0] + Math.cos(th) * (rho + wid) + o.wind[0] * wr + tu * Math.sin(a * 0.07 + ph1);
      const y = src[1] + h + o.wind[1] * wr;
      const z = src[2] + Math.sin(th) * (rho + wid) + o.wind[2] * wr + tu * Math.cos(a * 0.06 + ph2);
      const g = (1 - Math.exp((-3 * a) / L)) / eL;
      const pop = 0.3 + 0.7 * easeOut(a / 5);
      const rad = lerp(o.size[0], o.size[1], g) * sv * pop * (1 - 0.3 * smooth(0.75 * L, L, a));
      const dis = smooth(o.dissolveAt * L, L, a);
      _c.copy(this.c0).lerp(this.c1, smooth(0, L, a)).multiplyScalar(bv);
      const heat = o.heat > 0 ? o.heat * Math.exp(-a / o.heatLife) : 0;
      F.push(x, y, z, rad, 0.92, _c, dis, heat, off[0], off[1], off[2], o.lump);
    }
    F.end();
  }
  dispose() { this.field.dispose(); }
}

// ============================================================== PuffBurst (impact dust / smoke burst)
export type BurstOpts = {
  pos: V3;
  /** frame of the impact */
  at: number;
  /** ring puffs (14) + centre puffs (3) */
  count?: number; inner?: number;
  /** outward speed m/frame at t0 (0.12; drag e-folds over 6 f), upward drift m/frame (0.012) */
  speed?: number; up?: number;
  /** puff radius at birth / fully grown (m) */
  size?: [number, number];
  life?: number;
  color?: THREE.ColorRepresentation;
  /** true = a flat ring hugging the ground (dust), false = a dome (smoke burst) */
  ring?: boolean;
  lump?: number;
  seed?: number;
  look?: PuffLook;
};
type BurstCfg = Required<Omit<BurstOpts, "look" | "pos" | "at">>;
const BURST_DEF: BurstCfg = { count: 14, inner: 3, speed: 0.12, up: 0.012, size: [0.16, 0.52], life: 38, color: "#c8b08c", ring: true, lump: 0.3, seed: 7 };
/** push the puffs of one burst (centre c, impact frame t0) for frame f */
function burstPuffs(F: PuffField, c: V3, t0: number, f: number, o: BurstCfg, col: THREE.Color, scale = 1) {
  const L = o.life, n = o.count + o.inner;
  if (f < t0 || f >= t0 + L + 2) return;
  for (let i = 0; i < n; i++) {
    const r = rngK(o.seed, i, 23);
    const tb = t0 + r() * 1.5;
    const a = f - tb;
    if (a < 0 || a >= L) continue;
    const inner = i >= o.count;
    const th = inner ? r() * TAU : ((i + 0.5 * r()) / o.count) * TAU;
    const el = inner ? 0.9 + 0.6 * r() : o.ring ? 0.05 + 0.25 * r() : 0.25 + 0.9 * r();
    const sp = o.speed * scale * (inner ? 0.25 : 0.7 + 0.6 * r());
    const sv = (inner ? 1.15 : 0.8 + 0.4 * r()) * scale, bv = 0.9 + 0.2 * r();
    const off = puffOff(r, a, 0.025);
    const d = sp * 6 * (1 - Math.exp(-a / 6));
    const ce = Math.cos(el);
    const x = c[0] + Math.cos(th) * ce * d, z = c[2] + Math.sin(th) * ce * d;
    const y = c[1] + Math.sin(el) * d + o.up * scale * a * (1 - a / (2 * L)) + o.size[0] * sv * 0.5;
    const rad = lerp(o.size[0], o.size[1], 1 - Math.exp(-a / (0.28 * L))) * sv * (0.35 + 0.65 * easeOut(a / 2.5)) * (1 - 0.35 * smooth(0.6 * L, L, a));
    _c.copy(col).multiplyScalar(bv);
    F.push(x, y, z, rad, o.ring ? 0.82 : 0.95, _c, smooth(0.35 * L, L, a), 0, off[0], off[1], off[2], o.lump);
  }
}

export class PuffBurst implements Vfx {
  readonly root = new THREE.Group();
  readonly field: PuffField;
  private o: BurstCfg; private col: THREE.Color;
  constructor(readonly opts: BurstOpts) {
    this.o = { ...BURST_DEF, ...opts };
    this.col = lin(this.o.color);
    this.field = new PuffField(this.o.count + this.o.inner, { lift: 0.24, ...opts.look });
    this.root.add(this.field.mesh);
  }
  update(f: number) { this.field.begin(); burstPuffs(this.field, this.opts.pos, this.opts.at, f, this.o, this.col); this.field.end(); }
  dispose() { this.field.dispose(); }
}

// ============================================================== shockwave ring (one flat soft-edged band)
const RING_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha; uniform float uIn;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  if (r > 1.0 || r < uIn) discard;
  float t = (r - uIn) / (1.0 - uIn);                       // 0 inner edge .. 1 shock front
  float band = smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(0.86, 1.0, t)) * mix(0.35, 1.0, t);
  gl_FragColor = vec4(uCol, band * uAlpha);
}`;
class Ring {
  readonly mesh: THREE.Mesh; private mat: THREE.ShaderMaterial;
  constructor(col: THREE.Color) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: col }, uAlpha: { value: 0 }, uIn: { value: 0.8 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const g = new THREE.PlaneGeometry(2, 2, 1, 1); g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 4; this.mesh.frustumCulled = false; this.mesh.layers.set(NOINK); this.mesh.visible = false;
  }
  set(pos: V3, R: number, width: number, alpha: number) {
    this.mesh.visible = alpha > 0.003 && R > 0.01;
    this.mesh.position.set(...pos); this.mesh.scale.set(R, 1, R);
    this.mat.uniforms.uAlpha.value = alpha; this.mat.uniforms.uIn.value = clamp01(1 - width / R);
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ============================================================== emissive streaks / embers (instanced, HDR instance colours)
class Glints {
  readonly mesh: THREE.InstancedMesh; private n = 0;
  constructor(readonly max: number, kind: "streak" | "ember") {
    let g: THREE.BufferGeometry;
    if (kind === "streak") { g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0, -0.5); } // head at z = 0, tail toward -z
    else g = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.setRGB(1, 1, 1)); this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.layers.set(NOINK);
  }
  begin() { this.n = 0; }
  /** streak: head position, velocity direction, length, width; ember: position, size */
  push(x: number, y: number, z: number, dir: THREE.Vector3 | null, len: number, w: number, col: THREE.Color, spin = 0) {
    if (this.n >= this.max || w <= 1e-4) return;
    if (dir) _q.setFromUnitVectors(_Z, dir); else _q.setFromAxisAngle(_v.set(0.3, 1, 0.2).normalize(), spin);
    _m.compose(_p.set(x, y, z), _q, dir ? _s.set(w, w, len) : _s.set(w, w * 1.3, w));
    this.mesh.setMatrixAt(this.n, _m); this.mesh.setColorAt(this.n, col); this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
/** HDR spark colour by temperature 1 (white-yellow) .. 0 (dull red) */
const sparkCol = (t: number, out: THREE.Color, k = 1) => {
  t = clamp01(t);
  if (t > 0.6) { const u = (t - 0.6) / 0.4; out.setRGB(lerp(2.8, 6.0, u), lerp(0.9, 4.2, u), lerp(0.12, 1.6, u)); }
  else { const u = t / 0.6; out.setRGB(lerp(0.9, 2.8, u), lerp(0.1, 0.9, u), lerp(0.03, 0.12, u)); }
  return out.multiplyScalar(k);
};

// ============================================================== Explosion
export type ExplosionOpts = {
  pos: V3;
  /** frame of the blast */
  at: number;
  /** fireball radius in m (1.5) */
  size?: number;
  groundY?: number;
  /** fireball puffs (30), lingering smoke-column puffs (26), sparks (44) */
  puffs?: number; smoke?: number; sparks?: number;
  /** the flat shockwave ring (true) and the ground dust ring (auto: when the blast is within 1.5 x size of the ground) */
  ring?: boolean; dust?: boolean;
  /** fireball albedo once it cools (sRGB), smoke colour, dust colour */
  soot?: THREE.ColorRepresentation; smokeColor?: THREE.ColorRepresentation; dustColor?: THREE.ColorRepresentation;
  seed?: number;
  look?: PuffLook;
};
export class Explosion implements Vfx {
  readonly root = new THREE.Group();
  readonly field: PuffField;
  private dustF: PuffField | null = null;
  private sparks: Glints; private ring: Ring;
  private o: Required<Omit<ExplosionOpts, "look">>;
  private cFire = lin("#e8862e"); private cSoot: THREE.Color; private cSmoke: THREE.Color; private dustCol: THREE.Color;
  private dustCfg: BurstCfg;
  constructor(opts: ExplosionOpts) {
    const o = this.o = { size: 1.5, groundY: 0, puffs: 30, smoke: 26, sparks: 44, ring: true, dust: opts.pos[1] - (opts.groundY ?? 0) < 1.5 * (opts.size ?? 1.5),
      soot: "#6a6062", smokeColor: "#858081", dustColor: "#c4ab86", seed: 3, ...opts };
    this.cSoot = lin(o.soot); this.cSmoke = lin(o.smokeColor); this.dustCol = lin(o.dustColor);
    this.field = new PuffField(5 + o.puffs + o.smoke, { lift: 0.26, ...opts.look });
    this.root.add(this.field.mesh);
    this.sparks = new Glints(o.sparks, "streak"); this.root.add(this.sparks.mesh);
    this.ring = new Ring(new THREE.Color(1.35, 1.3, 1.22)); this.root.add(this.ring.mesh);
    this.dustCfg = { ...BURST_DEF, count: 18, inner: 0, speed: 0.11 * o.size, up: 0.01 * o.size, size: [0.3 * o.size, 0.75 * o.size], life: 55, seed: o.seed + 101, lump: 0.3, color: o.dustColor, ring: true };
    if (o.dust) { this.dustF = new PuffField(18, { lift: 0.26 }); this.root.add(this.dustF.mesh); }
  }
  update(f: number) {
    const o = this.o, S = o.size, P = o.pos, F = this.field, t = f - o.at;
    F.begin();
    if (t >= 0) {
      // 1. core flash: white-hot, swells in 2 f, collapses + dissolves by 8 f
      for (let i = 0; i < 5; i++) {
        const r = rngK(o.seed, i, 31);
        if (t > 9) break;
        const off = puffOff(r, t, 0.05);
        const sat = i === 0 ? 0 : 0.55 * S;
        const th = r() * TAU, ph = r() * 0.8 - 0.2;
        const rad = S * (i === 0 ? 0.95 : 0.55) * easeOut((t + 1) / 2.5) * (1 - 0.55 * smooth(2, 8, t));
        F.push(P[0] + Math.cos(th) * sat * Math.cos(ph), P[1] + sat * Math.sin(ph) + 0.1 * S, P[2] + Math.sin(th) * sat * Math.cos(ph), rad, 1, _c.setRGB(1, 0.9, 0.7),
          smooth(3, 8.5, t), 1.65 - 0.5 * smooth(1, 6, t), off[0], off[1], off[2], 0.18);
      }
      // 2. fireball: puffs thrown out + up (drag), buoyant, glowing yellow -> orange -> sooty grey, then dissolving
      for (let i = 0; i < o.puffs; i++) {
        const r = rngK(o.seed, i, 41);
        const tb = r() * 3, a = t - tb, L = 55 + 35 * r();
        if (a < 0 || a >= L) continue;
        const th = r() * TAU, cy = 0.15 + 0.85 * r(), sy = Math.sqrt(1 - cy * cy);
        const sp = S * (0.55 + 0.6 * r()), sv = 0.75 + 0.5 * r(), th2 = 3 + 5 * r();
        const off = puffOff(r, a, 0.03);
        const d = sp * (1 - Math.exp(-a / 4.5));
        const buoy = 0.0011 * S * Math.pow(a, 1.45);
        const x = P[0] + Math.cos(th) * sy * d, z = P[2] + Math.sin(th) * sy * d;
        const y = Math.max(o.groundY + 0.2 * S, P[1] + cy * d * 0.8 + buoy);
        const rad = S * (0.32 + 0.42 * (1 - Math.exp(-a / 6))) * sv * (0.4 + 0.6 * easeOut(a / 2)) * (1 - 0.3 * smooth(0.7 * L, L, a));
        const heat = 1.25 * Math.exp(-a / th2);
        _c.copy(this.cFire).lerp(this.cSoot, smooth(3, 20, a));
        F.push(x, y, z, rad, 0.95, _c, smooth(0.5 * L, L, a), heat, off[0], off[1], off[2], 0.3);
      }
      // 3. smoke column: dark puffs keep rising out of the blast (mushroom stem + cap)
      for (let i = 0; i < o.smoke; i++) {
        const r = rngK(o.seed, i, 51);
        const tb = 4 + 34 * (i / o.smoke) + 1.5 * r(), a = t - tb, L = 85 + 30 * r();
        if (a < 0 || a >= L) continue;
        const th = r() * TAU, rho = S * 0.35 * Math.sqrt(r()), sv = 0.8 + 0.4 * r();
        const off = puffOff(r, a, 0.02);
        const rise = S * 0.05 * (a - (0.45 * a * a) / L);
        const cap = smooth(0.25 * L, L, a) * S * 0.9 * (0.5 + r());     // spreads out at the top
        const x = P[0] + Math.cos(th) * (rho + cap) + 0.006 * a, z = P[2] + Math.sin(th) * (rho + cap);
        const rad = S * (0.45 + 0.5 * (1 - Math.exp(-a / 25))) * sv * (0.3 + 0.7 * easeOut(a / 6)) * (1 - 0.3 * smooth(0.7 * L, L, a));
        _c.copy(this.cSmoke).multiplyScalar(0.9 + 0.2 * r());
        F.push(x, P[1] + 0.4 * S + rise, z, rad, 0.92, _c, smooth(0.5 * L, L, a), 0.5 * Math.exp(-a / 3), off[0], off[1], off[2], 0.32);
      }
    }
    F.end();
    // 4. shockwave ring: thin, fast (ease-out), fading in ~14 f
    if (o.ring && t >= 0 && t < 16) {
      const near = P[1] - o.groundY < 1.5 * S;
      const Rt = (u: number) => S * 6.5 * (1 - Math.exp(-u / 4.2)) + 0.3 * S;
      // band = base width + the ring's own expansion over half a frame (the HQ shutter span): the 4 sub-frame copies
      // overlap into one smeared front instead of 4 stacked thin rings
      const w = S * 0.55 * (0.5 + 0.5 * smooth(0, 6, t)) + 1.1 * (Rt(t + 0.5) - Rt(t));
      this.ring.set([P[0], near ? o.groundY + 0.06 : P[1], P[2]], Rt(t), w, Math.pow(1 - t / 16, 1.6) * 0.9);
    } else this.ring.set(P, 0, 0, 0);
    // 5. sparks: ballistic streaks (gravity 9.8 m/s^2 = 0.0109 m/f^2), one damped bounce, cooling white -> red
    const G = 0.0109, Sp = this.sparks; Sp.begin();
    if (t >= 0) for (let i = 0; i < o.sparks; i++) {
      const r = rngK(o.seed, i, 61);
      const a = t - r() * 2, L = 16 + 26 * r();
      if (a < 0 || a >= L) continue;
      const th = r() * TAU, cy = -0.1 + 1.1 * r(), sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      const sp = (0.22 + 0.4 * r()) * Math.sqrt(S);
      let vx = Math.cos(th) * sy * sp, vy = cy * sp, vz = Math.sin(th) * sy * sp;
      let x = P[0] + vx * 0.5 * S / sp * 0.4, y = P[1], z = P[2] + vz * 0.5 * S / sp * 0.4, aa = a;
      // first contact with the ground: y + vy t - G t^2 / 2 = groundY
      const dy = y - o.groundY, th1 = (vy + Math.sqrt(vy * vy + 2 * G * Math.max(dy, 0))) / G;
      if (a > th1) { x += vx * th1; z += vz * th1; y = o.groundY + 0.01; vy = -(vy - G * th1) * 0.3; vx *= 0.45; vz *= 0.45; aa = a - th1; }
      const px = x + vx * aa, py = Math.max(o.groundY + 0.01, y + vy * aa - 0.5 * G * aa * aa), pz = z + vz * aa;
      const cvy = vy - G * aa, spd = Math.hypot(vx, cvy, vz);
      _v.set(vx, cvy, vz).normalize();
      const temp = 1 - a / L, w = 0.03 * Math.sqrt(S) * (0.4 + 0.6 * temp);
      Sp.push(px, py, pz, _v, Math.min(0.9 * S, Math.max(0.06, spd * 1.4)), w, sparkCol(temp, _c));
    }
    Sp.end();
    if (this.dustF) { this.dustF.begin(); burstPuffs(this.dustF, [P[0], o.groundY, P[2]], o.at + 1, f, this.dustCfg, this.dustCol); this.dustF.end(); }
  }
  dispose() { this.field.dispose(); this.dustF?.dispose(); this.sparks.dispose(); this.ring.dispose(); }
}

// ============================================================== DustTrail
export type TrailOpts = {
  /** the moving point the dust comes off (wheel contact, hooves): story frame -> world position */
  pos: (f: number) => V3;
  start?: number; end?: number;
  /** puffs per frame at full speed (1.0) */
  rate?: number;
  /** speed (m/frame) below which nothing is kicked up, and the speed of full-size puffs */
  minSpeed?: number; fullSpeed?: number;
  life?: number;
  size?: [number, number];
  /** sideways scatter at birth (m), backward kick (m), upward drift m/frame */
  spread?: number; kick?: number; rise?: number;
  color?: THREE.ColorRepresentation;
  lump?: number;
  seed?: number;
  look?: PuffLook;
  max?: number;
};
export class DustTrail implements Vfx {
  readonly root = new THREE.Group();
  readonly field: PuffField;
  private o: Required<Omit<TrailOpts, "look" | "max">>; private col: THREE.Color;
  constructor(opts: TrailOpts) {
    const o = this.o = { start: 0, end: 1e9, rate: 1.0, minSpeed: 0.02, fullSpeed: 0.12, life: 42, size: [0.14, 0.5] as [number, number], spread: 0.15,
      kick: 0.35, rise: 0.008, color: "#c9b08a", lump: 0.3, seed: 5, ...opts };
    this.col = lin(o.color);
    this.field = new PuffField(opts.max ?? Math.ceil(o.rate * o.life * 1.15) + 4, { lift: 0.26, ...opts.look });
    this.root.add(this.field.mesh);
  }
  update(f: number) {
    const o = this.o, F = this.field, L = o.life;
    F.begin();
    const [k0, k1] = kRange(f, o.start, o.end, o.rate, L);
    for (let k = k1; k >= k0; k--) {
      const r = rngK(o.seed, k, 71);
      const tb = o.start + (k + r()) / o.rate, a = f - tb;
      if (a < 0 || a >= L || tb > o.end) continue;
      const p0 = o.pos(tb - 0.5), p1 = o.pos(tb + 0.5), p = o.pos(tb);
      const vx = p1[0] - p0[0], vz = p1[2] - p0[2], sp = Math.hypot(vx, vz);
      const amt = smooth(o.minSpeed, o.fullSpeed, sp);
      if (amt < 0.04) continue;
      const nx = sp > 1e-6 ? vx / sp : 0, nz = sp > 1e-6 ? vz / sp : 0;
      const side = (r() - 0.5) * 2, sv = 0.75 + 0.5 * r(), bv = 0.9 + 0.2 * r();
      const off = puffOff(r, a, 0.02);
      const kb = o.kick * (0.6 + 0.8 * r()) * (1 - Math.exp(-a / 5)) * amt;
      const lat = o.spread * side + 0.008 * side * a;
      const x = p[0] - nx * kb - nz * lat, z = p[2] - nz * kb + nx * lat;
      const rad = lerp(o.size[0], o.size[1], 1 - Math.exp(-a / (0.3 * L))) * sv * (0.45 + 0.55 * amt) * (0.3 + 0.7 * easeOut(a / 3)) * (1 - 0.3 * smooth(0.65 * L, L, a));
      const y = p[1] + o.rise * a * (1 - a / (2 * L)) + rad * 0.55;
      _c.copy(this.col).multiplyScalar(bv);
      F.push(x, y, z, rad, 0.85, _c, smooth(0.3 * L, L, a), 0, off[0], off[1], off[2], o.lump);
    }
    F.end();
  }
  dispose() { this.field.dispose(); }
}

// ============================================================== Fire
const FIRE_DECL_V = /* glsl */ `
attribute vec4 aFireA;   // x = temperature (0 outer tongue .. 1 core), y = noise seed, z = scroll time, w = extra erosion
attribute vec2 aFireB;   // bend (object units at the tip, x / z)
varying vec3 vFObj; varying vec4 vFA; varying vec3 vFN; varying vec3 vFV; varying vec3 vFW;`;
const FIRE_VERT = /* glsl */ `
  vec3 transformed = vec3(position);
  transformed.xz += aFireB * transformed.y * transformed.y;
  vFObj = position; vFA = aFireA;
  vec3 fN = normal;
  #ifdef USE_INSTANCING
  mat3 fim = mat3(instanceMatrix);
  fN /= vec3(dot(fim[0], fim[0]), dot(fim[1], fim[1]), dot(fim[2], fim[2]));
  fN = fim * fN;
  #endif
  vFN = normalize(normalMatrix * fN);
  vec4 fW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  fW = instanceMatrix * fW;
  #endif
  vFW = (modelMatrix * fW).xyz;
`;
const FIRE_DECL_F = /* glsl */ `
uniform vec3 uFC; uniform float uFS; uniform float uFR;   // fire base centre (world), flame height, base radius
varying vec3 vFObj; varying vec4 vFA; varying vec3 vFN; varying vec3 vFV; varying vec3 vFW;
${GLSL_NOISE}`;
// colour: the fire is ONE body: a white-yellow heart around its axis (measured across the view, so it is centred
// from every angle) fading with height, orange outside, dark red tips; each tongue adds a little facing-based core.
// An upward-scrolling noise erodes the upper half into licking tips (discard: crisp edges, no sorting).
const FIRE_COLOR = /* glsl */ `
  float fh = clamp(vFObj.y, 0.0, 1.0);
  vec3 fq = vec3(vFObj.x * 2.4, vFObj.y * 1.6 - vFA.z, vFObj.z * 2.4) + vFA.y;
  float fn = 0.62 * vfxNoise(fq) + 0.38 * vfxNoise(fq * 2.3 + 3.1);
  float cut = smoothstep(0.3, 1.0, fh) * 0.62 + vFA.w;
  if (fn < cut) discard;
  float edge = smoothstep(cut, cut + 0.08, fn);
  vec3 rel = vFW - uFC;
  vec2 vh = normalize(cameraPosition.xz - vFW.xz + vec2(1e-4, 0.0));
  float perp = abs(rel.x * vh.y - rel.z * vh.x);             // distance from the fire axis across the view
  float hr = clamp(rel.y / uFS, 0.0, 1.5);
  float coreW = (uFR * 0.85 + 0.04 * uFS) * (1.0 - 0.55 * clamp(hr, 0.0, 1.0));
  float body = (1.0 - smoothstep(0.35 * coreW, coreW, perp)) * (1.0 - smoothstep(0.3, 0.8, hr));
  float facing = abs(dot(normalize(vFN), normalize(vFV)));
  float tongue = smoothstep(0.5, 0.95, facing) * (1.0 - smoothstep(0.2, 0.6, fh)) * 0.45;
  float core = clamp(max(body, tongue) + vFA.x * 0.3, 0.0, 1.0) * (1.0 - 0.8 * clamp(vFA.w * 2.0, 0.0, 1.0));
  float th = max(fh, hr * 0.8);                                // tips of tall tongues and licks go red
  vec3 rim = th < 0.4 ? mix(vec3(2.7, 1.0, 0.13), vec3(1.9, 0.42, 0.05), th / 0.4) : mix(vec3(1.9, 0.42, 0.05), vec3(0.62, 0.06, 0.02), clamp((th - 0.4) / 0.6, 0.0, 1.0));
  vec3 hot = mix(vec3(5.2, 4.1, 1.7), vec3(3.6, 2.0, 0.42), fh);
  vec3 fc = mix(rim, hot, core) * mix(0.6, 1.0, edge);
  diffuseColor.rgb = fc;
`;
let FLAME_GEO: THREE.BufferGeometry | null = null;
const flameGeo = () => {
  if (!FLAME_GEO) {
    // teardrop: round belly low, long tapering tip; height 1, max radius ~0.3 at y = 0.22
    const prof: [number, number][] = [[0.001, 0], [0.13, 0.025], [0.24, 0.09], [0.295, 0.2], [0.285, 0.32], [0.235, 0.46], [0.165, 0.62], [0.095, 0.78], [0.04, 0.91], [0.001, 1.0]];
    FLAME_GEO = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  }
  return FLAME_GEO;
};

export type FireOpts = {
  /** base centre of the fire (fixed or moving, e.g. a pig's back) */
  pos: Src;
  /** flame height in m: torch 0.35, burning straw pack 0.55, brazier 0.75, bonfire 1.6 */
  size?: number;
  /** base disc radius (m), default 0.32 x size */
  radius?: number;
  /** flame tongues (default 5 + 6 x size, max 24) */
  tongues?: number;
  /** burning window: ignites over `grow` frames from start, dies over `fade` frames after end */
  start?: number; end?: number; grow?: number; fade?: number;
  /** detached flame licks per frame (0.5), embers per frame (0.3 + 0.3 x size) */
  licks?: number; embers?: number;
  /** wind lean (m per frame equivalent, like SmokePlume.wind); movement of `pos` adds lean automatically */
  wind?: V3;
  seed?: number;
};
export class Fire implements Vfx {
  readonly root = new THREE.Group();
  private mesh: THREE.InstancedMesh; private A: THREE.InstancedBufferAttribute; private B: THREE.InstancedBufferAttribute;
  private embers: Glints; private o: Required<FireOpts>; private T: { x: number; z: number; hf: number; core: number; s: number[] }[] = [];
  private maxLicks: number;
  private u = { uFC: { value: new THREE.Vector3() }, uFS: { value: 1 }, uFR: { value: 0.3 } };
  constructor(opts: FireOpts) {
    const size = opts.size ?? 0.6;
    const o = this.o = { size, radius: 0.32 * size, tongues: Math.min(24, Math.round(5 + 6 * size)), start: -1e9, end: 1e9, grow: 6, fade: 8, licks: 0.5,
      embers: 0.3 + 0.3 * size, wind: [0, 0, 0] as V3, seed: 9, ...opts };
    const r = mulberry32(hashInt(o.seed, 91));
    const nCore = Math.max(2, Math.round(o.tongues / 3));
    for (let j = 0; j < o.tongues + nCore; j++) {
      const core = j >= o.tongues ? 1 : 0;
      const th = (j / Math.max(1, core ? nCore : o.tongues)) * TAU + r() * 0.9, rho = o.radius * (core ? 0.35 : 0.25 + 0.75 * Math.sqrt(r()));
      this.T.push({ x: Math.cos(th) * rho, z: Math.sin(th) * rho, hf: core ? 0.62 + 0.1 * r() : 1 - 0.45 * (rho / o.radius) ** 2 + 0.08 * r(), core, s: [r(), r(), r(), r(), r(), r()] });
    }
    this.maxLicks = Math.ceil(o.licks * 12) + 2;
    const n = this.T.length + this.maxLicks;
    const base = flameGeo();
    const g = new THREE.BufferGeometry();
    g.setIndex(base.getIndex()); g.setAttribute("position", base.getAttribute("position")); g.setAttribute("normal", base.getAttribute("normal")); g.setAttribute("uv", base.getAttribute("uv"));
    this.A = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); this.A.setUsage(THREE.DynamicDrawUsage);
    this.B = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); this.B.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aFireA", this.A); g.setAttribute("aFireB", this.B);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + FIRE_DECL_V)
        .replace("#include <begin_vertex>", FIRE_VERT)
        .replace("#include <project_vertex>", "#include <project_vertex>\n  vFV = -mvPosition.xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FIRE_DECL_F)
        .replace("#include <color_fragment>", "#include <color_fragment>\n" + FIRE_COLOR);
    };
    mat.customProgramCacheKey = () => "vfxFire4";
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.layers.set(NOINK);
    this.embers = new Glints(Math.ceil(o.embers * 60) + 4, "ember");
    this.root.add(this.mesh, this.embers.mesh);
  }
  /** how alive the fire is at f (0..1) */
  amount(f: number) { const o = this.o; return smooth(o.start, o.start + o.grow, f) * (1 - smooth(o.end, o.end + o.fade, f)); }
  /** the fire's light for the world (shade.ts GLOW / PuffLook.glow): position, linear colour x intensity, radius */
  light(f: number, k = 1): { pos: V3; col: V3; r: number } {
    const p = at(this.o.pos, f), a = this.amount(f) * k * (0.9 + 0.06 * Math.sin(f * 1.7 + 1) + 0.04 * Math.sin(f * 3.1));
    return { pos: [p[0], p[1] + 0.45 * this.o.size, p[2]], col: [1.25 * a, 0.5 * a, 0.12 * a], r: 1.2 + 3.2 * this.o.size };
  }
  update(f: number) {
    const o = this.o, S = o.size, amt = this.amount(f);
    const p = at(o.pos, f), pa = at(o.pos, f - 0.75), pb = at(o.pos, f + 0.75);
    const vx = (pb[0] - pa[0]) / 1.5, vz = (pb[2] - pa[2]) / 1.5;
    // lean (m at the tip per m of height): against the motion + with the wind, capped
    this.u.uFC.value.set(p[0], p[1], p[2]); this.u.uFS.value = S * Math.max(amt, 0.05); this.u.uFR.value = o.radius * Math.max(amt, 0.05);
    let lx = -vx * 5 + o.wind[0] * 18, lz = -vz * 5 + o.wind[2] * 18;
    const lm = Math.hypot(lx, lz); if (lm > 0.9) { lx *= 0.9 / lm; lz *= 0.9 / lm; }
    let n = 0;
    if (amt > 0.01) for (const T of this.T) {
      const s = T.s;
      const fl = 1 + 0.2 * Math.sin(f * (0.5 + 0.25 * s[0]) + TAU * s[1]) + 0.12 * Math.sin(f * (1.25 + 0.4 * s[2]) + TAU * s[3]) + 0.07 * Math.sin(f * 2.9 + TAU * s[4]);
      const H = S * T.hf * fl * amt, W = (H * (0.6 - 0.08 * (fl - 1)) + o.radius * 0.55 * amt) * (T.core ? 0.85 : 1);
      const sw = 0.1 * Math.sin(f * 0.37 + TAU * s[5]) + 0.06 * Math.sin(f * 0.83 + TAU * s[2]);
      _m.compose(_p.set(p[0] + T.x * amt, p[1] - 0.02 * S, p[2] + T.z * amt), _q.identity(), _s.set(W, H, W));
      this.mesh.setMatrixAt(n, _m);
      this.A.setXYZW(n, T.core ? 0.85 : 0.0, s[0] * 50 + s[1] * 7, f * (0.16 + 0.06 * s[3]), 0);
      this.B.setXY(n, ((lx + sw + T.x * 0.6 / Math.max(o.radius, 0.01) * 0.15) * H) / W, ((lz + sw * 0.7 + T.z * 0.6 / Math.max(o.radius, 0.01) * 0.15) * H) / W);
      n++;
    }
    // licks: flame blobs that break off the top, rise, shrink and erode (left behind when the fire moves)
    const lifeL = 10;
    if (o.licks > 0) {
      const [k0, k1] = kRange(f, o.start, o.end, o.licks, lifeL);
      let nl = 0;
      for (let k = k1; k >= k0 && nl < this.maxLicks; k--) {
        const r = rngK(o.seed, k, 97);
        const tb = o.start + (k + r()) / o.licks, a = f - tb, L = 6 + 5 * r();
        if (a < 0 || a >= L) continue;
        const am = this.amount(tb); if (am < 0.2) continue;
        const q = at(o.pos, tb), th = r() * TAU, rho = o.radius * 0.5 * Math.sqrt(r());
        const u = a / L, H = S * (0.3 + 0.15 * r()) * am * Math.pow(1 - u, 0.6), W = H * 0.62;
        const y = q[1] + S * (0.45 + 0.2 * r()) * am + S * 0.07 * a + S * 0.004 * a * a;
        _m.compose(_p.set(q[0] + Math.cos(th) * rho + o.wind[0] * a * 3, y, q[2] + Math.sin(th) * rho + o.wind[2] * a * 3), _q.identity(), _s.set(W, H, W));
        this.mesh.setMatrixAt(n, _m);
        this.A.setXYZW(n, 0, r() * 60, f * 0.2, 0.15 + 0.45 * u);
        this.B.setXY(n, lx * 0.5 * H / W, lz * 0.5 * H / W);
        n++; nl++;
      }
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.A.needsUpdate = true; this.B.needsUpdate = true;
    // embers: tiny HDR sparks rising on a wobble, cooling and shrinking
    const E = this.embers; E.begin();
    if (o.embers > 0) {
      const lifeE = 55;
      const [k0, k1] = kRange(f, o.start, o.end, o.embers, lifeE);
      for (let k = k1; k >= k0; k--) {
        const r = rngK(o.seed, k, 101);
        const tb = o.start + (k + r()) / o.embers, a = f - tb, L = 25 + 30 * r();
        if (a < 0 || a >= L) continue;
        const am = this.amount(tb); if (am < 0.2) continue;
        const q = at(o.pos, tb), th = r() * TAU, rho = o.radius * Math.sqrt(r());
        const up = (0.025 + 0.035 * r()) * Math.sqrt(S + 0.2), ph = r() * TAU, wob = 0.05 + 0.1 * r() * S;
        const y = q[1] + S * 0.4 + up * a * (1 - 0.3 * a / L);
        const x = q[0] + Math.cos(th) * rho + o.wind[0] * a * 2.5 + wob * Math.sin(a * 0.21 + ph);
        const z = q[2] + Math.sin(th) * rho + o.wind[2] * a * 2.5 + wob * Math.cos(a * 0.17 + ph);
        const temp = 1 - a / L, w = (0.012 + 0.012 * r()) * Math.max(1, Math.sqrt(S)) * (0.3 + 0.7 * temp);
        E.push(x, y, z, null, 0, w, sparkCol(0.25 + 0.6 * temp, _c, 1.1), a * 0.3 + ph);
      }
    }
    E.end();
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); this.embers.dispose(); }
}

// ============================================================== Debris (rigid bodies, precomputed)
export type ChunkShape = "box" | "plank" | "wedge" | "stone";
export type DebrisPart = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; mass?: number };
export type DebrisOpts = {
  /** launch centre (the crate / wall / cart that breaks) */
  pos: V3;
  /** launch frame */
  at: number;
  /** chunks start scattered inside this half-size box around pos (m), e.g. the crate's half extents */
  volume?: V3;
  count?: number;
  /** built-in shapes, cycled (default box, plank, plank, wedge, stone) */
  shapes?: ChunkShape[];
  /** OR your own parts (geometry centred on its centre of mass + material); overrides shapes/count when given */
  parts?: DebrisPart[];
  /** chunk size range (m): the longest edge of a box, the length of a plank is ~2x */
  size?: [number, number];
  /** albedo per chunk (sRGB hex, cycled); stones use stoneColors */
  colors?: string[]; stoneColors?: string[];
  /** launch cone: axis, half-angle (deg), speed range m/s, how much the direction points away from pos (0..1) */
  dir?: V3; cone?: number; speed?: [number, number]; radial?: number;
  /** tumble rate (rad/s, random axis) */
  spin?: number;
  groundY?: number;
  restitution?: number; friction?: number; gravity?: number;
  /** seconds simulated (after that the pile is frozen) */
  simSeconds?: number;
  /** dust puff on the first hard ground impact of chunks larger than dustMin (m); false = off */
  dust?: boolean; dustMin?: number; dustColor?: THREE.ColorRepresentation;
  /** chunks visible before `at` at their start pose (false = they appear at launch; hide the intact object yourself) */
  showBefore?: boolean;
  seed?: number;
};
const DT = 1 / 240, SUB = 8; // 8 sim steps per story frame at 30 fps

function chunkGeo(shape: ChunkShape, s: number, r: () => number): { g: THREE.BufferGeometry; ext: V3 } {
  if (shape === "box") { const a = s * (0.7 + 0.3 * r()), b = s * (0.55 + 0.35 * r()), c = s * (0.6 + 0.4 * r()); return { g: new THREE.BoxGeometry(a, b, c), ext: [a, b, c] }; }
  if (shape === "plank") { const a = s * (1.6 + 0.9 * r()), b = s * (0.12 + 0.06 * r()), c = s * (0.32 + 0.16 * r()); return { g: new THREE.BoxGeometry(a, b, c), ext: [a, b, c] }; }
  if (shape === "wedge") {
    const a = s * (0.8 + 0.3 * r()), b = s * (0.6 + 0.3 * r()), c = s * (0.35 + 0.25 * r());
    const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a, 0), new THREE.Vector2(0, b)]);
    const g = new THREE.ExtrudeGeometry(tri, { depth: c, bevelEnabled: false });
    g.translate(-a / 3, -b / 3, -c / 2); // centroid of the triangle prism at the origin
    return { g, ext: [a, b, c] };
  }
  // stone: a jittered, flattened icosahedron (flat-shaded facets)
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(s * 0.5, 0);
  g.deleteAttribute("normal"); g.deleteAttribute("uv"); g = mergeVertices(g);
  const P = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) { const k = 0.78 + 0.4 * r(); P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.72, P.getZ(i) * k); }
  g = g.toNonIndexed(); g.computeVertexNormals();
  g.computeBoundingBox(); const bb = g.boundingBox!;
  return { g, ext: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z] };
}
/** contact points of a chunk: its distinct vertices (<= 64; more = extreme points along 26 directions) */
function hullOf(g: THREE.BufferGeometry): number[] {
  const P = g.getAttribute("position") as THREE.BufferAttribute, seen = new Map<string, V3>();
  for (let i = 0; i < P.count; i++) { const v: V3 = [P.getX(i), P.getY(i), P.getZ(i)]; seen.set(v.map((x) => x.toFixed(4)).join(","), v); }
  let pts = [...seen.values()];
  if (pts.length > 64) {
    const dirs: V3[] = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) dirs.push([x, y, z]);
    const pick = new Set<V3>();
    for (const d of dirs) { let best = pts[0], bv = -1e9; for (const p of pts) { const v = p[0] * d[0] + p[1] * d[1] + p[2] * d[2]; if (v > bv) { bv = v; best = p; } } pick.add(best); }
    pts = [...pick];
  }
  return pts.flat();
}

type Body = { hull: number[]; invM: number; invI: V3; size: number; track: Float32Array; steps: number; hit: { t: number; p: V3; v: number } | null };

/** one rigid body, simulated once: sequential-impulse contacts against the ground plane (restitution, Coulomb friction),
 *  full positional projection (never below the ground), rolling damping and sleep (frozen = no jitter). */
function simulate(b: Body, x: THREE.Vector3, q: THREE.Quaternion, v: THREE.Vector3, w: THREE.Vector3, o: { groundY: number; e: number; mu: number; g: number }, nSteps: number) {
  const R = new THREE.Matrix3(), RT = new THREE.Matrix3(), m4 = new THREE.Matrix4();
  const r = new THREE.Vector3(), vp = new THREE.Vector3(), tmp = new THREE.Vector3(), imp = new THREE.Vector3(), dq = new THREE.Quaternion();
  const nH = b.hull.length / 3;
  const rs: THREE.Vector3[] = Array.from({ length: nH }, () => new THREE.Vector3());
  const jn = new Float32Array(nH), jx = new Float32Array(nH), jz = new Float32Array(nH), tgt = new Float32Array(nH);
  const applyInvI = (vec: THREE.Vector3) => { vec.applyMatrix3(RT); vec.set(vec.x * b.invI[0], vec.y * b.invI[1], vec.z * b.invI[2]); return vec.applyMatrix3(R); };
  let sleepT = 0, asleep = false;
  b.track = new Float32Array((nSteps + 1) * 7); b.steps = nSteps;
  const rec = (i: number) => { const T = b.track; T[i * 7] = x.x; T[i * 7 + 1] = x.y; T[i * 7 + 2] = x.z; T[i * 7 + 3] = q.x; T[i * 7 + 4] = q.y; T[i * 7 + 5] = q.z; T[i * 7 + 6] = q.w; };
  rec(0);
  for (let s = 1; s <= nSteps; s++) {
    if (asleep) { rec(s); continue; }
    v.y -= o.g * DT;
    x.addScaledVector(v, DT);
    dq.set(w.x * DT * 0.5, w.y * DT * 0.5, w.z * DT * 0.5, 0).multiply(q);
    q.set(q.x + dq.x, q.y + dq.y, q.z + dq.z, q.w + dq.w).normalize();
    m4.makeRotationFromQuaternion(q); R.setFromMatrix4(m4); RT.copy(R).transpose();
    // contacts
    const contacts: number[] = [];
    let minY = 1e9;
    for (let i = 0; i < nH; i++) {
      rs[i].set(b.hull[i * 3], b.hull[i * 3 + 1], b.hull[i * 3 + 2]).applyMatrix3(R);
      const y = x.y + rs[i].y; minY = Math.min(minY, y);
      if (y < o.groundY + 0.002) contacts.push(i);
    }
    if (contacts.length) {
      for (const i of contacts) {
        vp.copy(w).cross(rs[i]).add(v);
        jn[i] = 0; jx[i] = 0; jz[i] = 0;
        tgt[i] = vp.y < -0.9 ? -o.e * vp.y : 0; // bounce only off hard hits: resting contacts get no restitution
        if (!b.hit && vp.y < -1.2) b.hit = { t: s * DT, p: [x.x + rs[i].x, o.groundY, x.z + rs[i].z], v: -vp.y };
      }
      for (let it = 0; it < 6; it++) for (const i of contacts) {
        const ri = rs[i];
        // normal (y)
        vp.copy(w).cross(ri).add(v);
        tmp.set(0, 1, 0); r.copy(ri).cross(tmp); applyInvI(r); r.cross(ri);
        const kn = b.invM + r.y;
        let d = (tgt[i] - vp.y) / kn;
        const jn0 = jn[i]; jn[i] = Math.max(0, jn0 + d); d = jn[i] - jn0;
        if (d !== 0) { imp.set(0, d, 0); v.addScaledVector(imp, b.invM); tmp.copy(ri).cross(imp); w.add(applyInvI(tmp)); }
        // friction (x and z), clamped to mu * normal impulse
        for (const ax of [0, 2]) {
          vp.copy(w).cross(ri).add(v);
          const vt = ax === 0 ? vp.x : vp.z;
          tmp.set(ax === 0 ? 1 : 0, 0, ax === 2 ? 1 : 0); r.copy(ri).cross(tmp); applyInvI(r); r.cross(ri);
          const kt = b.invM + (ax === 0 ? r.x : r.z);
          const acc = ax === 0 ? jx : jz, lim = o.mu * jn[i];
          const a0 = acc[i]; acc[i] = Math.max(-lim, Math.min(lim, a0 - vt / kt)); const dj = acc[i] - a0;
          if (dj !== 0) { imp.set(ax === 0 ? dj : 0, 0, ax === 2 ? dj : 0); v.addScaledVector(imp, b.invM); tmp.copy(ri).cross(imp); w.add(applyInvI(tmp)); }
        }
      }
      // rolling / spinning resistance while touching the ground
      w.multiplyScalar(Math.max(0, 1 - 1.6 * DT * contacts.length));
      if (contacts.length >= 3) v.multiplyScalar(1 - 1.5 * DT);
    }
    if (minY < o.groundY) x.y += o.groundY - minY; // projection: nothing ever sinks
    // sleep: slow and resting on >= 3 points (or nearly still) for 0.25 s -> frozen
    const slow = v.length() < 0.06 && w.length() < 0.2;
    if (contacts.length >= 3 && slow) sleepT += DT; else if (contacts.length && v.length() < 0.02 && w.length() < 0.05) sleepT += DT; else sleepT = 0;
    if (sleepT > 0.25) {
      asleep = true; v.set(0, 0, 0); w.set(0, 0, 0);
      // settle exactly onto the plane
      let mY = 1e9; for (let i = 0; i < nH; i++) mY = Math.min(mY, x.y + rs[i].y);
      x.y += o.groundY - mY;
    }
    rec(s);
  }
}

export class Debris implements Vfx {
  readonly root = new THREE.Group();
  readonly chunks: THREE.Mesh[] = [];
  private bodies: Body[] = [];
  private dustF: PuffField | null = null; private dustCol: THREE.Color; private dustCfg: BurstCfg;
  private o: Required<Omit<DebrisOpts, "parts">> & { parts?: DebrisPart[] };
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  constructor(opts: DebrisOpts) {
    const o = this.o = { volume: [0.3, 0.3, 0.3] as V3, count: 24, shapes: ["box", "plank", "plank", "wedge", "stone"] as ChunkShape[], size: [0.12, 0.34] as [number, number],
      colors: ["#b8834c", "#9a6a3a", "#c99a62", "#7e5530"], stoneColors: ["#9a958e", "#7d7872", "#b0aaa2"], dir: [0, 1, 0] as V3, cone: 55, speed: [3, 7.5] as [number, number],
      radial: 0.6, spin: 9, groundY: 0, restitution: 0.32, friction: 0.62, gravity: 9.8, simSeconds: 6, dust: true, dustMin: 0.2, dustColor: "#c4ab86",
      showBefore: false, seed: 13, ...opts };
    const r = mulberry32(hashInt(o.seed, 131));
    const n = o.parts ? o.parts.length : o.count;
    const nSteps = Math.ceil(o.simSeconds / DT);
    const axis = new THREE.Vector3(...o.dir).normalize();
    for (let i = 0; i < n; i++) {
      let geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], ext: V3, mass: number;
      if (o.parts) {
        const P = o.parts[i]; geo = P.geometry; mat = P.material;
        geo.computeBoundingBox(); const bb = geo.boundingBox!; ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
        mass = P.mass ?? ext[0] * ext[1] * ext[2] * 600;
      } else {
        const shape = o.shapes[i % o.shapes.length], s = lerp(o.size[0], o.size[1], r() ** 1.5);
        const cg = chunkGeo(shape, s, r); geo = cg.g; ext = cg.ext;
        const pal = shape === "stone" ? o.stoneColors : o.colors, hex = pal[Math.floor(r() * pal.length) % pal.length];
        mat = this.mat(hex, shape === "stone");
        mass = ext[0] * ext[1] * ext[2] * (shape === "stone" ? 2400 : 600) * (shape === "wedge" ? 0.5 : shape === "stone" ? 0.55 : 1);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false; mesh.matrixAutoUpdate = true;
      this.chunks.push(mesh); this.root.add(mesh);
      // inertia of the bounding box (solid box approximation)
      const [a, b, c] = ext, I: V3 = [(mass / 12) * (b * b + c * c), (mass / 12) * (a * a + c * c), (mass / 12) * (a * a + b * b)];
      const body: Body = { hull: hullOf(geo), invM: 1 / mass, invI: [1 / I[0], 1 / I[1], 1 / I[2]], size: Math.max(a, b, c), track: new Float32Array(0), steps: 0, hit: null };
      // launch state
      const x = new THREE.Vector3(o.pos[0] + (r() * 2 - 1) * o.volume[0], o.pos[1] + (r() * 2 - 1) * o.volume[1], o.pos[2] + (r() * 2 - 1) * o.volume[2]);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU));
      const ca = Math.cos(THREE.MathUtils.degToRad(o.cone)), cz = lerp(ca, 1, r()), ph = r() * TAU, sz = Math.sqrt(1 - cz * cz);
      const dir = new THREE.Vector3(Math.cos(ph) * sz, cz, Math.sin(ph) * sz).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis));
      const out = x.clone().sub(new THREE.Vector3(...o.pos)); out.y = Math.max(out.y, 0);
      if (out.lengthSq() > 1e-6) dir.lerp(out.normalize(), o.radial * 0.5).normalize();
      const sp = lerp(o.speed[0], o.speed[1], r()) * (0.75 + 0.25 * (o.size[1] / Math.max(body.size, 0.01)) ** 0.3);
      const v = dir.multiplyScalar(sp);
      const w = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(o.spin * (0.5 + r()));
      // start above the ground
      const m4 = new THREE.Matrix4().makeRotationFromQuaternion(q);
      let minY = 1e9; for (let k = 0; k < body.hull.length; k += 3) minY = Math.min(minY, _v.set(body.hull[k], body.hull[k + 1], body.hull[k + 2]).applyMatrix4(m4).y + x.y);
      if (minY < o.groundY) x.y += o.groundY - minY;
      simulate(body, x, q, v, w, { groundY: o.groundY, e: o.restitution, mu: o.friction, g: o.gravity }, nSteps);
      this.bodies.push(body);
    }
    this.dustCol = lin(o.dustColor);
    this.dustCfg = { ...BURST_DEF, count: 7, inner: 1, speed: 0.06, up: 0.006, size: [0.1, 0.32], life: 34, color: o.dustColor, ring: true, lump: 0.3, seed: o.seed + 7 };
    if (o.dust) { this.dustF = new PuffField(this.bodies.filter((b) => b.hit && b.size >= o.dustMin).length * 8 + 1, { lift: 0.26 }); this.root.add(this.dustF.mesh); }
  }
  private mat(hex: string, flat: boolean) {
    const key = hex + (flat ? "f" : "");
    let m = this.mats.get(key);
    if (!m) { m = twoTone(new THREE.MeshLambertMaterial({ color: hex, flatShading: flat })); this.mats.set(key, m); }
    return m;
  }
  update(f: number) {
    const o = this.o, t = f - o.at;
    const st = Math.max(0, t / 30 / DT);
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i], m = this.chunks[i];
      m.visible = t >= 0 || o.showBefore;
      if (!m.visible) continue;
      const s0 = Math.min(b.steps, Math.floor(st)), s1 = Math.min(b.steps, s0 + 1), u = Math.min(1, st - s0);
      const T = b.track, A = s0 * 7, B = s1 * 7;
      m.position.set(lerp(T[A], T[B], u), lerp(T[A + 1], T[B + 1], u), lerp(T[A + 2], T[B + 2], u));
      m.quaternion.set(T[A + 3], T[A + 4], T[A + 5], T[A + 6]);
      _q.set(T[B + 3], T[B + 4], T[B + 5], T[B + 6]);
      m.quaternion.slerp(_q, u);
    }
    if (this.dustF) {
      this.dustF.begin();
      this.bodies.forEach((b, i) => {
        if (!b.hit || b.size < o.dustMin) return;
        burstPuffs(this.dustF!, b.hit.p, o.at + b.hit.t * 30, f, { ...this.dustCfg, seed: o.seed * 31 + i }, this.dustCol, Math.min(1.3, 0.45 + b.size * 1.4) * Math.min(1.1, 0.5 + b.hit.v / 8));
      });
      this.dustF.end();
    }
  }
  /** frame at which every chunk is at rest (frozen) */
  get restFrame() {
    let last = 0;
    for (const b of this.bodies) {
      const T = b.track; let s = b.steps;
      while (s > 0 && T[s * 7] === T[(s - 1) * 7] && T[s * 7 + 1] === T[(s - 1) * 7 + 1] && T[s * 7 + 2] === T[(s - 1) * 7 + 2] && T[s * 7 + 6] === T[(s - 1) * 7 + 6]) s--;
      last = Math.max(last, s);
    }
    return this.o.at + (last * DT) * 30;
  }
  dispose() {
    for (const m of this.chunks) m.geometry.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.dustF?.dispose();
  }
}

/** convenience: update a list of effects */
export const updateAll = (fx: Vfx[], f: number) => { for (const e of fx) e.update(f); };
