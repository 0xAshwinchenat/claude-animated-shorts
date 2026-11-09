// 3D toon cast: real 3D stick figures that replace the camera-facing cards (toon.ts / cast.ts) when an orbit or a
// turn would give the card away. Measured on the reference channel (cartoon-3d-short references + the 2026-11-06
// six-short frame study): on an orbit the face decal slides round the head and the back of the head shows, so the
// characters are 3D toon models, built like this:
//   head   white squashed sphere, h/w 0.92, features = a swapped DECAL low on the front (eyes on the equator,
//          brows +15 deg, mouth -17 deg), dark-grey features, optional pink blush
//   torso  bean (lathe, wider at the bottom, rounded ends), clothing colour + painted details (tie, buttons, badge,
//          belt) wrapped round it; the head sits on it with no neck
//   limbs  plum INK TUBES, width 0.06 head heights (HH), one smooth rubber-hose curve through a 2-bone IK elbow/knee;
//          ink BALL hands (r 0.055 HH, ~1.8x the limb width), small ink ellipsoid feet
//   ink    plum #2a1b26 inverted hull, weighted by light: 0.022 HH on the lit side -> 0.05 HH on the shadow side
//   light  two-tone toon ramp (lavender shade), mild cast-shadow floor, thin warm rim on the sun side
//   acting (references/reports/motion.md + newest-6 study): on ones; holds DEAD STILL (only the camera moves); attacks
//          3-5 f hard ease; strikes = 3 f pull-back, ~6 f held back, contact on the next frame; turns 1-4 f; mouth on
//          ones from the voice RMS, leading 0-1 f; blinks half/shut/shut/half every 0.5-2.3 s + across every expression
//          swap; walk 9-12 f per step, body lowest at contact (3-7 % of height), lean 1 -> 6 deg, high-knee strut;
//          no squash/stretch, no smears, no idle loops
// Everything lives on the NOINK layer (the world ink pass never outlines a character; the hull does).
// Units: metres, root at the feet, character faces local +z, +x = the character's LEFT (screen right seen from the front).
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LFB } from "./shade";
import { NOINK } from "./ink";

export type V3 = [number, number, number];
export const INK3 = "#2a1b26";
export const FEATURE = "#2b2430";

// ------------------------------------------------------------------ proportions (head heights, HH)
export type Build = {
  hh: number; headW: number; torsoH: number; topW: number; botW: number; depth: number;
  legL: number; upperArm: number; foreArm: number; limbW: number; handR: number; footL: number; hipX: number;
};
export const BUILDS: Record<"adult" | "stout" | "slim" | "kid", Build> = {
  adult: { hh: 0.5, headW: 1 / 0.92, torsoH: 0.98, topW: 0.66, botW: 0.8, depth: 0.72, legL: 1.42, upperArm: 0.56, foreArm: 0.56, limbW: 0.06, handR: 0.055, footL: 0.22, hipX: 0.17 },
  stout: { hh: 0.5, headW: 1 / 0.92, torsoH: 1.02, topW: 0.78, botW: 1.02, depth: 0.78, legL: 1.24, upperArm: 0.55, foreArm: 0.55, limbW: 0.064, handR: 0.058, footL: 0.23, hipX: 0.2 },
  slim: { hh: 0.48, headW: 1 / 0.94, torsoH: 1.02, topW: 0.58, botW: 0.66, depth: 0.66, legL: 1.55, upperArm: 0.6, foreArm: 0.6, limbW: 0.056, handR: 0.052, footL: 0.22, hipX: 0.14 },
  kid: { hh: 0.44, headW: 1 / 0.93, torsoH: 0.72, topW: 0.6, botW: 0.7, depth: 0.7, legL: 0.95, upperArm: 0.45, foreArm: 0.42, limbW: 0.062, handR: 0.058, footL: 0.2, hipX: 0.14 },
};

// ------------------------------------------------------------------ shared uniforms (set once per frame)
/** world-space direction TOWARD the sun; the lab / world sets it every frame (hull weighting) */
export const TOON3D = {
  uSunW: { value: new THREE.Vector3(-0.5, 0.75, 0.45).normalize() },
  uLitC: { value: new THREE.Vector3(1.0, 0.985, 0.96) },
  uShadeC: { value: new THREE.Vector3(0.7, 0.68, 0.86) },  // lavender form shade (white head -> ~#c9c6e4 on screen)
  uFloor: { value: 0.45 },                                  // cast shadows on a character keep 45 % of the key
  uRimC: { value: new THREE.Vector3(0.42, 0.3, 0.12) },     // thin warm rim on the sun side
  uTerm: { value: 0.18 },                                   // terminator softness
};

// toon ramp on a Lambert material: albedo x mix(shade, lit, smooth N.L x shadow) + rim. Same light loop hook as
// shade.ts twoTone (sunVis is three's own shadow-map visibility of directional light 0 = the sun).
const TOON_END = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;
  float ndl = dot( geometryNormal, sunV );
  float form = smoothstep( -0.04, uTerm, ndl );
  float lit = form * mix( uFloor, 1.0, sunVis );
  vec3 col = diffuseColor.rgb * mix( uShadeC, uLitC, lit );
  float fres = smoothstep( 0.82, 0.97, 1.0 - max( dot( geometryNormal, geometryViewDir ), 0.0 ) );
  col += uRimC * fres * smoothstep( 0.1, 0.6, ndl ) * sunVis;
  reflectedLight.directDiffuse = col;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
}
#endif
`;
const TOON_DECL = "#include <common>\nuniform vec3 uLitC; uniform vec3 uShadeC; uniform float uFloor; uniform vec3 uRimC; uniform float uTerm;";
export function toonMat(color: THREE.ColorRepresentation, map?: THREE.Texture): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color, map: map ?? null });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TOON3D);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", TOON_DECL)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + TOON_END);
  };
  m.customProgramCacheKey = () => "toon3d_1";
  return m;
}

// weighted inverted hull: thin on the lit side, thick on the shadow side (view-space metres, so it scales with the
// character, as measured: 0.022 HH lit / 0.05 HH shadow)
const HULL_VERT = /* glsl */ `
uniform vec3 uSunW; uniform float uLitW; uniform float uShadW;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec3 nW = normalize( mat3( modelMatrix ) * normal );
  float shade = smoothstep( -0.1, 0.8, -dot( nW, uSunW ) );
  vec3 nV = normalize( normalMatrix * normal );
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  mvPosition.xyz += nV * mix( uLitW, uShadW, shade );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const HULL_FRAG = /* glsl */ `
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4( uInk, 1.0 );
  #include <colorspace_fragment>
}`;
const hullMat = (hh: number, k = 1) => new THREE.ShaderMaterial({
  uniforms: { uSunW: TOON3D.uSunW, uLitW: { value: 0.022 * hh * k }, uShadW: { value: 0.05 * hh * k }, uInk: { value: new THREE.Color(INK3) } },
  vertexShader: HULL_VERT.replace("#include <fog_pars_vertex>", "").replace("#include <fog_vertex>", ""), fragmentShader: HULL_FRAG, side: THREE.BackSide, fog: false,
});

const inkBasic = () => new THREE.MeshBasicMaterial({ color: INK3 });
/** an ink inverted hull for a standalone prop mesh (same weighting as the characters'): add it next to the mesh */
export const inkHullOf = (m: THREE.Mesh, hh: number, k = 0.6) => { const h = new THREE.Mesh(m.geometry, hullMat(hh, k)); h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale); h.renderOrder = -1; return h; };

// ------------------------------------------------------------------ faces (decal on the head front)
// v2 (2026-11-09 character upgrade): the decal is drawn at 3x the old resolution (1536 px over 150 deg, crisp on a ~1100 px
// head in a 2K close-up), features are ~1.3x bigger with ~1.4x heavier ink (reference weight: thick brow strokes, big
// eyes, wide mouths with a WHITE TEETH band split by thin lines), and the face carries secondary FX: tear streams /
// laugh-cry spray, a sweat drop, blush hatching, an anger vein, gloom lines (all on the decal), plus a whole-head tint,
// 3D steam puffs, 3D dizzy stars and 3D tear droplets (FaceFX, driven by Expr.t). Proportions are unchanged: eyes on the
// equator 0.26 head widths apart, brows above, mouth at -18 deg.
export type Eyes = "lid" | "dot" | "ring" | "happy" | "closed" | "half" | "squint" | "angry"
  /** "><" squeezed shut (laugh-cry, effort) */ | "xx"
  /** dizzy spirals (stunned after a hit) */ | "spiral"
  /** heavy droopy lids, pupils peeking under them (sleepy / bored) */ | "sleepy"
  /** big white eyes with pinpoint pupils (terror, shock with teeth) */ | "wide"
  /** tight sad arcs (crying) */ | "cry"
  /** heavy half-lids + pupils to the side (smug side-eye, scheming) */ | "sly";
export type Brows = "flat" | "up" | "angry" | "worried" | "raised1" | "none"
  /** steep, low, pulled together (rage) */ | "furious"
  /** both raised high and arched (shock / terror) */ | "high"
  /** one down-angled, one raised (disgust) */ | "disgust"
  /** low and heavy (sleepy) */ | "low";
export type Mouth = "smirk" | "flat" | "small" | "open" | "o" | "grin" | "grit" | "frown" | "teeth" | "tongue"
  /** huge open D with the teeth band + tongue (laughing) */ | "laugh"
  /** tall open yell, teeth top and bottom */ | "shout"
  /** wide grimace, both teeth rows bared (shock with teeth) */ | "shock"
  /** wavy nervous line */ | "wavy"
  /** lopsided sneer, teeth on the raised side (disgust) */ | "sneer"
  /** open crying frown */ | "wail"
  /** short slanted "meh" line */ | "meh"
  /** lopsided toothy grin (scheming) */ | "slygrin"
  /** concentration: a closed line with the tongue poking out of one corner */ | "tongueOut";
export type Expr = {
  eyes: Eyes; brows: Brows; mouth: Mouth; look?: number; blush?: boolean; sweat?: boolean;
  /** tears on the decal: "stream" runs down both cheeks (crying), "spray" jets out of the eye corners (laugh-cry; also 3D droplets) */
  tears?: "stream" | "spray";
  /** anger vein (the cross-popping mark) on the forehead */
  vein?: boolean;
  /** dread: blue-violet gloom lines over the upper face */
  gloom?: boolean;
  /** whole-head tint (pose() ramps the head colour to it over 3 f from the expression's start) */
  tint?: string;
  /** 3D steam puffs venting from both sides of the head */
  steam?: boolean;
  /** 3D stars orbiting the head (dizzy) */
  stars?: boolean;
  /** frames since this expression started (exprTrack sets it; 9 if absent). Drives the 3D FX and the tear boil only. */
  t?: number;
};
/** furious head tint (purple-red, measured on the reference's anger shots: the whole head goes purple) */
export const FURY = "#cf5a92";
export const EXPR: Record<string, Expr> = {
  neutral: { eyes: "lid", brows: "flat", mouth: "flat" },
  smug: { eyes: "lid", brows: "raised1", mouth: "smirk" },
  stern: { eyes: "dot", brows: "angry", mouth: "flat" },
  shock: { eyes: "ring", brows: "up", mouth: "o" },
  happy: { eyes: "happy", brows: "up", mouth: "grin", blush: true },
  angry: { eyes: "angry", brows: "angry", mouth: "grit" },
  worried: { eyes: "dot", brows: "worried", mouth: "frown", sweat: true },
  grin: { eyes: "lid", brows: "flat", mouth: "teeth" },
  // ---- v2 (2026-11-09)
  laugh: { eyes: "happy", brows: "up", mouth: "laugh" },
  laughCry: { eyes: "xx", brows: "up", mouth: "laugh", tears: "spray" },
  crying: { eyes: "cry", brows: "worried", mouth: "wail", tears: "stream" },
  nervous: { eyes: "dot", brows: "worried", mouth: "wavy", sweat: true },
  smugBrow: { eyes: "sly", brows: "raised1", mouth: "smirk" },
  sly: { eyes: "sly", brows: "angry", mouth: "slygrin" },
  shockTeeth: { eyes: "wide", brows: "high", mouth: "shock" },
  scream: { eyes: "wide", brows: "high", mouth: "shout", sweat: true },
  disgusted: { eyes: "squint", brows: "disgust", mouth: "sneer" },
  sleepy: { eyes: "sleepy", brows: "low", mouth: "meh" },
  bored: { eyes: "sleepy", brows: "flat", mouth: "flat" },
  furious: { eyes: "angry", brows: "furious", mouth: "shout", tint: FURY, steam: true, vein: true },
  dizzy: { eyes: "spiral", brows: "worried", mouth: "wavy", stars: true },
  blush: { eyes: "happy", brows: "worried", mouth: "small", blush: true },
  dread: { eyes: "wide", brows: "worried", mouth: "wavy", gloom: true, sweat: true },
  focus: { eyes: "dot", brows: "angry", mouth: "tongueOut" },
};
/** mouths the lip-sync cycles through while a word is spoken */
export const TALK: Mouth[] = ["open", "small", "o", "open", "teeth", "small"];

// decal = sphere patch lon -75..75, lat -55..+50 (degrees); canvas pixel <-> angle. FW 1536 = 10.2 px per degree.
const LON = 75, LAT0 = 50, LAT1 = -55, FW = 1536, FH = Math.round((FW * (LAT0 - LAT1)) / (2 * LON));
const ax = (lon: number) => ((lon + LON) / (2 * LON)) * FW;
const ay = (lat: number) => ((LAT0 - lat) / (LAT0 - LAT1)) * FH;
/** face textures cached per (expression, beard, boil phase); LRU, evicted textures are disposed (each ~8.8 MB with mips) */
const FACE_MAX = 32;
const faceCache = new Map<string, THREE.CanvasTexture>();
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
/** feature ink (a touch darker than FEATURE: the reference's features are near-black) */
export const FACE_INK = "#1b141e";
const MOUTH_IN = "#3d1522", TONGUE = "#e6697d", TONGUE_D = "#b94a5e", TEAR = "#7cc9ff", TEAR_D = "#3f9ee6";
const TAU = Math.PI * 2;
/** the boil phase (0/1, every 4 f) for animated decal FX (tears, spirals) */
const facePhase = (e: Expr) => (e.tears || e.eyes === "spiral" ? Math.floor((e.t ?? 0) / 4) % 2 : 0);

function drawFace(g: CanvasRenderingContext2D, e: Expr, beard: Beard | undefined, ph: number) {
  const k = (FW / 150) * 1.45; // px per feature unit (1 unit = 1.45 deg of longitude)
  const ink = FACE_INK;
  g.lineCap = "round"; g.lineJoin = "round";
  const look = (e.look ?? 0) * 4;
  const EX = 16.5, EY = 2; // eye longitude / latitude (eyes ~0.29 head widths apart, on the equator)
  const mx = ax(look * 0.5), my = ay(-18);
  const line = (lw: number, col = ink) => { g.lineWidth = lw * k; g.strokeStyle = col; };
  // ---------- under the features: blush, gloom
  if (e.blush) for (const s of [-1, 1]) {
    const cx = ax(s * 25 + look * 0.3), cy = ay(-9);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 7 * k);
    gr.addColorStop(0, "rgba(255,98,128,0.55)"); gr.addColorStop(0.65, "rgba(255,98,128,0.38)"); gr.addColorStop(1, "rgba(255,98,128,0)");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 7 * k, 4.2 * k, 0, 0, TAU); g.fill();
    line(0.8, "rgba(205,52,86,0.8)");
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + (i * 2.5 - 0.9) * k, cy + 1.4 * k); g.lineTo(cx + (i * 2.5 + 0.9) * k, cy - 1.4 * k); g.stroke(); }
  }
  if (e.gloom) { // a soft violet shadow over the brow (an ellipse fading out) + hanging gloom lines
    const cx = ax(0), cy = ay(36), rx = ax(38) - cx, ry = ay(8) - cy;
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, "rgba(92,74,178,0.45)"); gr.addColorStop(0.6, "rgba(92,74,178,0.3)"); gr.addColorStop(1, "rgba(92,74,178,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
    line(0.9, "rgba(70,52,150,0.75)");
    for (let i = 0; i < 9; i++) { const lo = -24 + i * 6, x = ax(lo); g.beginPath(); g.moveTo(x, ay(40)); g.lineTo(x, ay(25 - (i % 3) * 4 + Math.abs(lo) * 0.25)); g.stroke(); }
  }
  // ---------- mouth (open shapes: dark inside, white teeth band(s) split by thin lines, tongue, ink rim)
  if (beard?.full) { // a short full beard hugging the jaw (from the cheeks round the chin); its moustache goes over the mouth below
    const x0 = ax(look * 0.5), bc = beard.col;
    g.fillStyle = bc; g.beginPath(); g.moveTo(ax(-30), ay(-6)); g.quadraticCurveTo(ax(-28), ay(-34), x0, ay(-44)); g.quadraticCurveTo(ax(28), ay(-34), ax(30), ay(-6));
    g.quadraticCurveTo(ax(22), ay(-16), ax(10 + look * 0.5), ay(-24)); g.quadraticCurveTo(x0, ay(-28), ax(-10 + look * 0.5), ay(-24)); g.quadraticCurveTo(ax(-22), ay(-16), ax(-30), ay(-6)); g.fill();
    // only the OUTER jaw contour gets a line (a ring round the mouth reads as a giant grin): scalloped = fluffy, in a darker beard tone
    const dk = mixHex(bc, FACE_INK, 0.5), q = (a: number[], b: number[], c: number[], t: number) => [0, 1].map((i) => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * b[i] + t * t * c[i]);
    const segs = [[[-30, -6], [-28, -34], [0, -44]], [[0, -44], [28, -34], [30, -6]]].map((s) => s.map(([lo, la]) => [ax(lo + (lo ? 0 : look * 0.5)), ay(la)]));
    const pts: number[][] = []; for (const [a, b, c] of segs) for (let i = 0; i < 40; i++) pts.push(q(a, b, c, i / 40));
    pts.push(segs[1][2]);
    line(1.0, dk); g.beginPath();
    pts.forEach(([x, y], i) => { const [nx0, ny0] = pts[Math.min(i + 1, pts.length - 1)], [px, py] = pts[Math.max(i - 1, 0)], tx = nx0 - px, ty = ny0 - py, l = Math.hypot(tx, ty) || 1;
      const bump = Math.abs(Math.sin((i / pts.length) * Math.PI * 13)) * 0.9 * k, ox = (ty / l) * bump, oy = (-tx / l) * bump; if (i) g.lineTo(x - ox, y - oy); else g.moveTo(x - ox, y - oy); });
    g.stroke();
    line(0.75, dk); g.globalAlpha = 0.45;
    for (let i = 0; i < 8; i++) { const lo = -21 + i * 6; g.beginPath(); g.moveTo(ax(lo), ay(-27 - Math.abs(lo) * 0.05)); g.quadraticCurveTo(ax(lo * 0.92 + 1), ay(-32), ax(lo * 0.8), ay(-37 + Math.abs(lo) * 0.3)); g.stroke(); }
    g.globalAlpha = 1;
  }
  const teethBand = (x0: number, x1: number, yTop: number, h: number, cols = 6) => { // inside a clip: white band + dividers
    g.fillStyle = "#ffffff"; g.fillRect(x0, yTop, x1 - x0, h);
    line(0.55); g.beginPath();
    for (let i = 1; i < cols; i++) { const xx = x0 + ((x1 - x0) * i) / cols; g.moveTo(xx, yTop); g.lineTo(xx, yTop + h); }
    g.stroke(); line(0.7); g.beginPath(); g.moveTo(x0, yTop + h); g.lineTo(x1, yTop + h); g.stroke();
  };
  const openMouth = (path: () => void, box: [number, number, number, number], o: { top?: number; bot?: number; tongue?: [number, number, number] }) => {
    const [x0, y0, x1, y1] = box.map((v, i) => (i % 2 ? my + v * k : mx + v * k)) as [number, number, number, number];
    g.save(); path(); g.fillStyle = MOUTH_IN; g.fill(); g.clip();
    if (o.tongue) { const [tx, ty, tw] = o.tongue; g.fillStyle = TONGUE; g.beginPath(); g.ellipse(mx + tx * k, my + ty * k, tw * k, tw * 0.62 * k, 0, 0, TAU); g.fill();
      line(0.55, TONGUE_D); g.beginPath(); g.moveTo(mx + tx * k, my + (ty - tw * 0.45) * k); g.lineTo(mx + tx * k, my + (ty + tw * 0.1) * k); g.stroke(); }
    if (o.top) teethBand(x0, x1, y0 - 2 * k, o.top * k + 2 * k, Math.max(4, Math.round((x1 - x0) / (2.2 * k))));
    if (o.bot) { g.fillStyle = "#ffffff"; g.fillRect(x0, y1 - o.bot * k, x1 - x0, o.bot * k + 2 * k);
      line(0.55); g.beginPath(); const n = Math.max(4, Math.round((x1 - x0) / (2.4 * k)));
      for (let i = 1; i < n; i++) { const xx = x0 + ((x1 - x0) * i) / n; g.moveTo(xx, y1 - o.bot * k); g.lineTo(xx, y1 + 2 * k); }
      g.stroke(); line(0.7); g.beginPath(); g.moveTo(x0, y1 - o.bot * k); g.lineTo(x1, y1 - o.bot * k); g.stroke(); }
    g.restore();
    path(); line(1.8); g.stroke();
  };
  const P = (x: number, y: number): [number, number] => [mx + x * k, my + y * k];
  const D = (hw: number, top: number, depth: number, lift = 0) => () => { // a "D" mouth: gently curved top lip, round bottom
    g.beginPath(); g.moveTo(...P(-hw, top - lift)); g.quadraticCurveTo(...P(0, top - 0.8), ...P(hw, top - lift));
    g.bezierCurveTo(...P(hw * 1.02, top + depth * 0.62), ...P(hw * 0.5, top + depth), ...P(0, top + depth));
    g.bezierCurveTo(...P(-hw * 0.5, top + depth), ...P(-hw * 1.02, top + depth * 0.62), ...P(-hw, top - lift)); g.closePath();
  };
  switch (e.mouth) {
    case "flat": line(1.9); g.beginPath(); g.moveTo(...P(-4.6, 0)); g.lineTo(...P(4.6, 0)); g.stroke(); break;
    case "smirk": line(1.9); g.beginPath(); g.moveTo(...P(-4.6, 0.4)); g.quadraticCurveTo(...P(1.4, 2.5), ...P(5.6, -2.1)); g.stroke();
      line(1.1); g.beginPath(); g.moveTo(...P(5.1, -3.1)); g.lineTo(...P(6.1, -1.3)); g.stroke(); break;
    case "frown": line(1.9); g.beginPath(); g.moveTo(...P(-5.2, 1.8)); g.quadraticCurveTo(...P(0, -2.6), ...P(5.2, 1.8)); g.stroke(); break;
    case "meh": line(1.9); g.beginPath(); g.moveTo(...P(-3.8, 0.2)); g.quadraticCurveTo(...P(0, 0.9), ...P(3.6, -0.6)); g.stroke(); break;
    case "wavy": line(1.9); g.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40, xx = -5.8 + 11.6 * t, yy = Math.sin(t * Math.PI * 5) * 0.95; if (i) g.lineTo(...P(xx, yy)); else g.moveTo(...P(xx, yy)); }
      g.stroke(); break;
    case "small": openMouth(() => { g.beginPath(); g.ellipse(mx, my + 0.3 * k, 3.2 * k, 2.1 * k, 0, 0, TAU); }, [-3.2, -1.8, 3.2, 2.4], { tongue: [0, 1.9, 2.0] }); break;
    case "o": openMouth(() => { g.beginPath(); g.ellipse(mx, my + 0.4 * k, 2.9 * k, 3.8 * k, 0, 0, TAU); }, [-2.9, -3.4, 2.9, 4.2], { tongue: [0, 3.4, 1.9] }); break;
    case "open": openMouth(D(5.4, -1.8, 6.6), [-5.4, -2.4, 5.4, 4.8], { top: 1.7, tongue: [0, 4.0, 3.2] }); break;
    case "tongue": openMouth(D(5.2, -1.8, 6.8), [-5.2, -2.4, 5.2, 5], { top: 1.4, tongue: [0, 3.0, 4.2] }); break;
    case "grin": openMouth(D(7.6, -2.0, 8.6, 0.6), [-7.6, -2.8, 7.6, 6.6], { top: 2.3, tongue: [0, 5.6, 4.0] }); break;
    case "laugh": openMouth(D(9.6, -2.8, 11.6, 1.4), [-9.6, -4.2, 9.6, 8.8], { top: 2.8, tongue: [0, 7.8, 5.4] }); break;
    case "wail": openMouth(() => { g.beginPath(); g.moveTo(...P(-6.2, 3.6)); g.bezierCurveTo(...P(-5.8, -4.2), ...P(5.8, -4.2), ...P(6.2, 3.6)); g.quadraticCurveTo(...P(0, 4.8), ...P(-6.2, 3.6)); g.closePath(); },
      [-6.2, -2.4, 6.2, 4.4], { top: 1.6, tongue: [0, 3.6, 3.4] }); break;
    case "shout": openMouth(() => { g.beginPath(); g.roundRect(mx - 5.4 * k, my - 3.4 * k, 10.8 * k, 10.4 * k, [4.6 * k, 4.6 * k, 5.2 * k, 5.2 * k]); },
      [-5.4, -3.4, 5.4, 7.0], { top: 1.9, bot: 1.5, tongue: [0, 4.8, 3.3] }); break;
    case "shock": openMouth(() => { g.beginPath(); g.roundRect(mx - 7.8 * k, my - 3.2 * k, 15.6 * k, 7.8 * k, 3.2 * k); },
      [-7.8, -3.2, 7.8, 4.6], { top: 2.2, bot: 2.0 }); break;
    case "sneer": { // lopsided: the screen-right corner pulled up, teeth bared on that side
      const path = () => { g.beginPath(); g.moveTo(...P(-5.6, 0.8)); g.quadraticCurveTo(...P(0.5, -0.6), ...P(5.8, -2.8)); g.quadraticCurveTo(...P(2.4, 3.2), ...P(-5.6, 0.8)); g.closePath(); };
      g.save(); path(); g.fillStyle = MOUTH_IN; g.fill(); g.clip(); teethBand(mx - 1 * k, mx + 6 * k, my - 3.6 * k, 2.4 * k, 4); g.restore();
      path(); line(1.8); g.stroke();
      line(1.1); g.beginPath(); g.moveTo(...P(4.4, -4.6)); g.quadraticCurveTo(...P(6.4, -4.2), ...P(6.6, -2.4)); g.stroke(); break;
    }
    case "slygrin": { // lopsided closed toothy grin
      const path = () => { g.beginPath(); g.moveTo(...P(-6, -0.4)); g.quadraticCurveTo(...P(0, 1.2), ...P(7, -2.8)); g.quadraticCurveTo(...P(1.8, 4.8), ...P(-6, -0.4)); g.closePath(); };
      g.save(); path(); g.fillStyle = "#ffffff"; g.fill(); g.clip();
      line(0.55); g.beginPath(); for (let i = 1; i < 7; i++) { const xx = -6 + i * 1.85; g.moveTo(...P(xx, -4)); g.lineTo(...P(xx, 5)); } g.stroke();
      line(0.7); g.beginPath(); g.moveTo(...P(-6, -0.2)); g.quadraticCurveTo(...P(0.5, 2.4), ...P(7, -2.4)); g.stroke(); g.restore();
      path(); line(1.8); g.stroke(); break;
    }
    case "teeth": case "grit": { // clenched teeth bar: white with an ink rim, a mid line and dividers
      const w = e.mouth === "grit" ? 7.6 : 6.4, h = e.mouth === "grit" ? 4.4 : 3.8;
      g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(mx - w * k, my - h * 0.5 * k, 2 * w * k, h * k, 1.5 * k); g.fill();
      line(0.6); g.beginPath(); g.moveTo(mx - w * k, my); g.lineTo(mx + w * k, my);
      const n = e.mouth === "grit" ? 7 : 6; for (let i = 1; i < n; i++) { const xx = mx - w * k + (2 * w * k * i) / n; g.moveTo(xx, my - h * 0.5 * k); g.lineTo(xx, my + h * 0.5 * k); }
      g.stroke(); line(1.8); g.beginPath(); g.roundRect(mx - w * k, my - h * 0.5 * k, 2 * w * k, h * k, 1.5 * k); g.stroke(); break;
    }
    case "tongueOut": { // concentration: a closed line + the tongue out of the screen-right corner
      g.fillStyle = TONGUE; g.beginPath(); g.ellipse(...P(3.4, 1.8), 2.1 * k, 2.6 * k, 0.35, 0, TAU); g.fill();
      line(1.2); g.stroke(); line(0.55, TONGUE_D); g.beginPath(); g.moveTo(...P(3.1, 0.6)); g.lineTo(...P(3.6, 2.6)); g.stroke();
      line(1.9); g.beginPath(); g.moveTo(...P(-4.4, 0.2)); g.quadraticCurveTo(...P(0, 1.1), ...P(5, -0.4)); g.stroke(); break;
    }
  }
  if (beard) { // moustaches (over the mouth)
    const bc = beard.col;
    const tp = (pts: [number, number][], w0: number, w1: number) => { // tapered stroke along lon/lat points
      const Q = pts.map(([lo, la]) => [ax(lo + look * 0.5), ay(la)] as [number, number]);
      g.fillStyle = bc; g.strokeStyle = bc; g.lineCap = "round";
      for (let i = 0; i < Q.length - 1; i++) { const t = i / (Q.length - 1); g.lineWidth = (w0 + (w1 - w0) * t) * k; g.beginPath(); g.moveTo(Q[i][0], Q[i][1]); g.lineTo(Q[i + 1][0], Q[i + 1][1]); g.stroke(); }
    };
    if (beard.droop) for (const s of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; const lo = s * (1.2 + 9.5 * Math.min(1, t * 1.9)), la = -10.5 - 3.5 * Math.min(1, t * 2.2) - 24 * Math.max(0, (t - 0.42) / 0.58) ** 1.3; pts.push([lo + s * 1.2 * Math.max(0, t - 0.5), la]); }
      tp(pts, 5.2, 2.2);
    }
    if (beard.goatee) { const x = ax(look * 0.5); g.fillStyle = bc; g.beginPath(); g.moveTo(x - 3.2 * k, ay(-27)); g.quadraticCurveTo(x, ay(-25.5), x + 3.2 * k, ay(-27)); g.quadraticCurveTo(x + 1.5 * k, ay(-36), x, ay(-41)); g.quadraticCurveTo(x - 1.5 * k, ay(-36), x - 3.2 * k, ay(-27)); g.fill(); }
    if (beard.full) for (const s of [-1, 1]) { g.fillStyle = bc; g.beginPath(); g.ellipse(ax(s * 5 + look * 0.5), ay(-12.5), 6 * k, 2.6 * k, s * -0.18, 0, TAU); g.fill(); }
    if (beard.curl) for (const s of [-1, 1]) { // proud moustache: thick from under the nose, ends curling UP
      const x0 = ax(look * 0.5), L = (lo: number) => ax(lo + look * 0.5);
      g.fillStyle = bc; g.beginPath(); g.moveTo(x0, ay(-9)); g.quadraticCurveTo(L(s * 10), ay(-7), L(s * 17), ay(-12)); g.quadraticCurveTo(L(s * 23), ay(-11), L(s * 23), ay(-4));
      g.quadraticCurveTo(L(s * 20), ay(-3), L(s * 20), ay(-7)); g.quadraticCurveTo(L(s * 15), ay(-16), x0, ay(-14)); g.fill();
      line(0.9); g.stroke();
      line(0.6, "rgba(255,255,255,0.28)"); g.beginPath(); g.moveTo(L(s * 4), ay(-10.2)); g.quadraticCurveTo(L(s * 10), ay(-9), L(s * 15), ay(-11.5)); g.stroke();
    }
    if (beard.stache) for (const s of [-1, 1]) { // big drooping Gaulish moustache
      g.fillStyle = bc; g.beginPath(); const x0 = ax(look * 0.5);
      g.moveTo(x0, ay(-10)); g.quadraticCurveTo(ax(s * 12 + look * 0.5), ay(-6), ax(s * 20 + look * 0.5), ay(-20)); g.quadraticCurveTo(ax(s * 22 + look * 0.5), ay(-30), ax(s * 17 + look * 0.5), ay(-31));
      g.quadraticCurveTo(ax(s * 14 + look * 0.5), ay(-17), x0, ay(-15)); g.fill();
    }
  }
  // ---------- eyes + brows (after the mouth + moustaches: big shock eyes sit over a curled moustache's ends)
  for (const s of [-1, 1]) {
    const x = ax(s * EX + look), y = ay(EY);
    const inner = -s; // toward the nose
    g.fillStyle = ink; g.strokeStyle = ink;
    switch (e.eyes) {
      case "dot": g.beginPath(); g.ellipse(x, y, 2.5 * k, 3.2 * k, 0, 0, TAU); g.fill(); break;
      case "lid": // half-lidded: pupil tucked under a heavy lid line (the default smug/deadpan look)
        g.save(); g.beginPath(); g.rect(x - 8 * k, y - 0.7 * k, 16 * k, 8 * k); g.clip();
        g.beginPath(); g.ellipse(x, y + 0.8 * k, 2.4 * k, 2.4 * k, 0, 0, TAU); g.fill(); g.restore();
        line(2.1); g.beginPath(); g.moveTo(x - 5.4 * k, y - 0.7 * k); g.lineTo(x + 5.4 * k, y - 0.7 * k); g.stroke(); break;
      case "sly": { // heavy lid sloping down to the outer corner, pupils shifted to the screen right (side-eye)
        const lidIn = y - 0.9 * k, lidOut = y + 0.2 * k, xi = x + inner * 5.4 * k, xo = x - inner * 5.4 * k;
        g.save(); g.beginPath(); g.moveTo(xi, lidIn); g.lineTo(xo, lidOut); g.lineTo(xo, y + 8 * k); g.lineTo(xi, y + 8 * k); g.closePath(); g.clip();
        g.beginPath(); g.ellipse(x + 1.6 * k, y + 1.0 * k, 2.3 * k, 2.3 * k, 0, 0, TAU); g.fill(); g.restore();
        line(2.4); g.beginPath(); g.moveTo(xi, lidIn); g.lineTo(xo, lidOut); g.stroke(); break;
      }
      case "squint": line(2.2); g.beginPath(); g.moveTo(x - 5.2 * k, y + 0.3 * k); g.quadraticCurveTo(x, y - 0.4 * k, x + 5.2 * k, y + 0.3 * k); g.stroke(); break;
      case "half": // blink in-between: lid line through the middle, lower half of the pupil
        g.beginPath(); g.ellipse(x, y + 0.7 * k, 2.5 * k, 2.2 * k, 0, 0, Math.PI); g.fill();
        line(2.1); g.beginPath(); g.moveTo(x - 5 * k, y + 0.7 * k); g.lineTo(x + 5 * k, y + 0.7 * k); g.stroke(); break;
      case "closed": line(2.0); g.beginPath(); g.moveTo(x - 5 * k, y + 0.6 * k); g.quadraticCurveTo(x, y + 3 * k, x + 5 * k, y + 0.6 * k); g.stroke(); break;
      case "happy": line(2.2); g.beginPath(); g.moveTo(x - 5 * k, y + 2 * k); g.quadraticCurveTo(x, y - 4.2 * k, x + 5 * k, y + 2 * k); g.stroke(); break;
      case "cry": // tight sad arch, the inner end lifted
        line(2.2); g.beginPath(); g.moveTo(x - inner * 5 * k, y + 2.2 * k); g.quadraticCurveTo(x, y - 2.4 * k, x + inner * 5 * k, y - 0.4 * k); g.stroke(); break;
      case "xx": // "><": chevrons pointing at the nose
        line(2.4); g.beginPath(); g.moveTo(x - inner * 3.4 * k, y - 3 * k); g.lineTo(x + inner * 2.8 * k, y + 0.1 * k); g.lineTo(x - inner * 3.4 * k, y + 3.2 * k); g.stroke(); break;
      case "spiral": { // dizzy spiral, the two eyes turn opposite ways; boils (rotates) every 4 f
        line(1.25); g.beginPath();
        for (let i = 0; i <= 90; i++) { const t = i / 90, a = s * (t * 2.7 * TAU + ph * Math.PI * 0.6), r = 5.2 * k * t; const px = x + Math.cos(a) * r, py = y + 0.3 * k + Math.sin(a) * r * 1.08; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke(); break;
      }
      case "sleepy": { // heavy droopy lid, the pupil peeking under it, a small bag line
        const lidY = y + 0.9 * k;
        g.save(); g.beginPath(); g.rect(x - 8 * k, lidY, 16 * k, 8 * k); g.clip();
        g.beginPath(); g.ellipse(x, lidY + 0.6 * k, 2.4 * k, 2.1 * k, 0, 0, TAU); g.fill(); g.restore();
        line(2.3); g.beginPath(); g.moveTo(x - 5.2 * k, lidY + 0.5 * k); g.quadraticCurveTo(x, lidY - 1.4 * k, x + 5.2 * k, lidY + 0.5 * k); g.stroke();
        line(0.9); g.beginPath(); g.moveTo(x - 2.6 * k, lidY + 4.4 * k); g.quadraticCurveTo(x, lidY + 5.4 * k, x + 2.6 * k, lidY + 4.4 * k); g.stroke(); break;
      }
      case "ring": // shock: white disc + ink ring + small pupil
        g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x, y, 6.4 * k, 7 * k, 0, 0, TAU); g.fill();
        line(1.8); g.stroke();
        g.fillStyle = ink; g.beginPath(); g.ellipse(x + look * 0.5, y + 0.6 * k, 2.2 * k, 2.5 * k, 0, 0, TAU); g.fill(); break;
      case "wide": // terror: bigger white eye, pinpoint pupil
        g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x, y + 0.3 * k, 7 * k, 7.8 * k, 0, 0, TAU); g.fill();
        line(1.9); g.stroke();
        g.fillStyle = ink; g.beginPath(); g.ellipse(x + look * 0.4, y + 0.6 * k, 1.35 * k, 1.55 * k, 0, 0, TAU); g.fill(); break;
      case "angry": { // pupil under a lid line sloping DOWN toward the nose
        const yi = y + 0.5 * k, yo = y - 2.2 * k, xi = x + inner * 5.4 * k, xo = x - inner * 5 * k;
        g.save(); g.beginPath(); g.moveTo(xi, yi); g.lineTo(xo, yo); g.lineTo(xo, y + 8 * k); g.lineTo(xi, y + 8 * k); g.closePath(); g.clip();
        g.beginPath(); g.ellipse(x, y + 1.0 * k, 2.6 * k, 2.6 * k, 0, 0, TAU); g.fill(); g.restore();
        line(2.3); g.beginPath(); g.moveTo(xi, yi); g.lineTo(xo, yo); g.stroke(); break;
      }
    }
    // brows: thick rounded strokes (bushy white brows: the colour with an ink rim, following the same angle)
    if (e.brows !== "none") {
      const by0 = ay(EY + 16.5), bx0 = ax(s * (EX + 0.5) + look * 0.3);
      const ang: Record<Brows, number> = { flat: 0, up: -0.12, angry: 0.44, worried: -0.4, raised1: s < 0 ? -0.24 : 0.06, none: 0, furious: 0.62, high: -0.2, disgust: s < 0 ? 0.42 : -0.28, low: 0.08 };
      const dyU: Partial<Record<Brows, number>> = { up: -2.6, raised1: s < 0 ? -3.4 : 0.4, furious: 1.6, high: -4.6, disgust: s < 0 ? 1.0 : -2.6, low: 1.8, angry: 0.4 };
      const arch: Partial<Record<Brows, number>> = { raised1: s < 0 ? -2.6 : -1.2, high: -2.4, up: -1.8, worried: -0.6 };
      const a = ang[e.brows] * -s, by = by0 + (dyU[e.brows] ?? 0) * k, bx = bx0 + (e.brows === "furious" ? inner * 1.4 * k : 0);
      const L = (e.brows === "furious" ? 6.6 : 6.0) * k, c = (arch[e.brows] ?? -1.4) * k;
      const p0x = bx - L * Math.cos(a), p0y = by - L * Math.sin(a) * s * -1, p1x = bx + L * Math.cos(a), p1y = by + L * Math.sin(a) * s * -1;
      const path = () => { g.beginPath(); g.moveTo(p0x, p0y); g.quadraticCurveTo(bx, by + c, p1x, p1y); };
      if (beard?.brows) { line(4.6); path(); g.stroke(); line(3.2, beard.brows); path(); g.stroke(); }
      else { line(3.2); path(); g.stroke(); }
    }
  }
  if (beard?.glasses) for (const s of [-1, 1]) { // round glasses over the eyes
    line(1.6); g.beginPath(); g.ellipse(ax(s * EX), ay(EY), 7.6 * k, 7.2 * k, 0, 0, TAU); g.stroke();
    if (s < 0) { g.beginPath(); g.moveTo(ax(-EX) + 7.6 * k, ay(3)); g.quadraticCurveTo(ax(0), ay(5.5), ax(EX) - 7.6 * k, ay(3)); g.stroke(); }
  }
  // ---------- over everything: vein, sweat, tears
  if (e.vein) { // the cross-popping anger mark on the temple, screen right (below a hat brim / hairline)
    const cx = ax(31), cy = ay(22);
    line(1.5, "#d2334f");
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, ox = cx + Math.cos(a) * 3.6 * k, oy = cy + Math.sin(a) * 3.6 * k;
      g.beginPath(); g.arc(ox, oy, 2.4 * k, a + Math.PI - 0.8, a + Math.PI + 0.8); g.stroke(); }
  }
  const drop = (x: number, y: number, s: number) => { // a teardrop (point up), light blue, ink rim, highlight
    g.beginPath(); g.moveTo(x, y - 4.2 * s * k); g.quadraticCurveTo(x + 3.3 * s * k, y + 0.6 * s * k, x, y + 2.7 * s * k); g.quadraticCurveTo(x - 3.3 * s * k, y + 0.6 * s * k, x, y - 4.2 * s * k); g.closePath();
    g.fillStyle = TEAR; g.fill(); line(1.0 * s); g.stroke();
    line(0.6 * s, "rgba(255,255,255,0.9)"); g.beginPath(); g.moveTo(x - 1.1 * s * k, y - 0.4 * s * k); g.quadraticCurveTo(x - 1.4 * s * k, y + 1.2 * s * k, x - 0.4 * s * k, y + 1.8 * s * k); g.stroke();
  };
  if (e.sweat) drop(ax(32), ay(22), 1.25);
  if (e.tears === "stream") for (const s of [-1, 1]) { // a band from the eye's lower outer corner down the cheek, boiling on 4 f
    const pts: [number, number][] = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([ax(s * (EX + 3.2 + 4 * t + 1.6 * t * t)), ay(EY - 3.6 - 34 * t)]); }
    const band = (w: number) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.lineWidth = w * k; g.stroke(); };
    const bul = [0.28, 0.62].map((t0) => pts[Math.round((t0 + ph * 0.14) * 14)]);
    g.strokeStyle = FACE_INK; band(3.6);
    g.fillStyle = FACE_INK; for (const [x, y] of bul) { g.beginPath(); g.ellipse(x, y, 2.55 * k, 2.85 * k, 0, 0, TAU); g.fill(); }
    g.strokeStyle = TEAR; band(2.3);
    g.fillStyle = TEAR; for (const [x, y] of bul) { g.beginPath(); g.ellipse(x, y, 1.9 * k, 2.2 * k, 0, 0, TAU); g.fill(); }
    const [ex, ey] = pts[14]; drop(ex, ey + (1.6 + ph * 1.4) * k, 0.62);
    line(0.55, "rgba(255,255,255,0.85)"); g.beginPath(); pts.slice(1, 12).forEach(([x, y], i) => (i ? g.lineTo(x - s * 0.5 * k, y) : g.moveTo(x - s * 0.5 * k, y))); g.stroke();
  }
  if (e.tears === "spray") for (const s of [-1, 1]) { // laugh-cry: a jet arcing out of the outer eye corner (+ 3D droplets beyond)
    const x0 = ax(s * (EX + 6.4)), y0 = ay(EY + 0.6), L = 10 + ph * 1.6;
    const arc = () => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + s * L * 0.6 * k, y0 - 5 * k, x0 + s * L * k, y0 + 3.4 * k); };
    g.strokeStyle = FACE_INK; g.lineWidth = 3.4 * k; arc(); g.stroke(); g.strokeStyle = TEAR; g.lineWidth = 2.2 * k; arc(); g.stroke();
    line(0.55, "rgba(255,255,255,0.9)"); g.beginPath(); g.moveTo(x0 + s * 1.5 * k, y0 - 1.6 * k); g.quadraticCurveTo(x0 + s * L * 0.5 * k, y0 - 4.6 * k, x0 + s * L * 0.78 * k, y0 - 1.4 * k); g.stroke();
    drop(x0 + s * L * k, y0 + 5.6 * k, 0.6);
  }
}
/** the face decal texture for an expression (+ beard). headCol is accepted for the old signature and unused (the decal is
 *  transparent where there are no features, so the head material's own colour / tint shows through) */
export const faceTex = (e: Expr, headCol = "#ffffff", beard?: Beard) => {
  void headCol;
  const ph = facePhase(e);
  const key = [e.eyes, e.brows, e.mouth, e.look ?? 0, e.blush ? 1 : 0, e.sweat ? 1 : 0, e.tears ?? "", e.vein ? 1 : 0, e.gloom ? 1 : 0, ph].join("|") + (beard ? JSON.stringify(beard) : "");
  let t = faceCache.get(key);
  if (t) { faceCache.delete(key); faceCache.set(key, t); return t; } // LRU touch
  const c = mk(FW, FH); const g = c.getContext("2d")!;
  drawFace(g, e, beard, ph);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  faceCache.set(key, t);
  while (faceCache.size > FACE_MAX) { const [k0, old] = faceCache.entries().next().value as [string, THREE.CanvasTexture]; faceCache.delete(k0); old.dispose(); }
  return t;
};

// ------------------------------------------------------------------ clothes (wrapped round the lathe torso)
// v2 (2026-11-09): every cloth canvas is drawn at 3x (CS) in the old 512 x 256 units, with a FABRIC WEAVE over each cloth
// layer (linen / wool / twill / leather, so flat colours read as cloth under the scene light), dashed STITCHING along the
// seams (side seams, neckline, hems, pocket edges, belt edges, trims), buttons with an ink rim + highlight, framed belt
// buckles, a chest EMBLEM (a shape, never letters), period hem bands (Greek key / wave / dots / zigzag), patches, a rope
// belt, rivets on armour. Torso canvas: u 0 = back, .25 = wearer's right side, .5 = front, .75 = left side; y 0 = torso
// top (the head hides y < ~36 at the front), a robe skirt covers y > ~212.
export type Fabric = "linen" | "wool" | "twill" | "leather" | "none";
export type HemPat = "key" | "wave" | "dots" | "zigzag" | "band";
export type Emblem = { shape: "sun" | "star" | "lotus" | "wheel" | "leaf" | "crescent"; col: string };
export type Outfit = {
  shirt: string; tie?: string; collar?: string; buttons?: string; belt?: string; buckle?: string; badge?: string;
  vest?: string; pants?: string; bowtie?: string; stripes?: string;
  // ---- robes (Kaifeng 1232) ----
  /** robe skirt colour: a flared skirt from the waist down over the legs (the legs show below the hem) */
  robe?: string;
  /** hem height as a fraction of the leg (0.5 = knee-length deel, 0.85 = ankle-length official robe) */
  robeLen?: number;
  /** trim colour along the diagonal closure, the collar and the hem */
  trim?: string;
  /** "diag" = Mongol deel flap from the neck to the wearer's right side; "round" = round collar (official robe) */
  closure?: "diag" | "round";
  /** wide cloth sash round the waist (knot on the wearer's left) */
  sash?: string;
  /** lamellar armour vest (rows of small laced plates) over the robe, in this colour */
  lamellar?: string;
  // ---- Skull short (Ullastret) ----
  /** leather apron: a bib + front panel over the torso and the skirt front, with a neck strap */
  apron?: string;
  /** a cloak hanging from the shoulders down the back (a half shell behind the torso) */
  cloak?: string;
  /** two chest pockets with flaps (khaki field shirt) */
  pockets?: string;
  /** rolled sleeves: little cloth cuffs round the upper arms (colour) */
  sleeves?: string;
  // ---- Pigs short (Megara 266 BC / Edessa 544 AD) ----
  /** a toga / himation drape: a broad band from the wearer's left shoulder across the chest to the right hip (colour) */
  toga?: string;
  /** segmented armour hint: horizontal metal bands across the torso (lorica), in this colour */
  segs?: string;
  /** a gold necklace / torc line at the collar */
  torc?: string;
  // ---- v2 detail (2026-11-09 character upgrade) ----
  /** fabric weave over the cloth layers (default "linen"; "none" = flat paint) */
  fabric?: Fabric;
  /** stitching thread colour (default: a contrasting tone of each cloth layer); "none" = no stitching */
  stitch?: string;
  /** decorative pattern in the trim bands (robe hem, cloak border) */
  hem?: HemPat;
  /** pattern colour on the trim bands (default: a darker tone of the trim) */
  hemCol?: string;
  /** chest emblem (a shape, never letters) on the wearer's left chest */
  emblem?: Emblem;
  /** stitched cloth patches (colour) on the tunic + skirt: a humble, mended look */
  patches?: string;
  /** a twisted rope belt with a knot + hanging ends (colour) */
  rope?: string;
  /** cloak border colour (down both front edges + along the hem, with the hem pattern) */
  cloakTrim?: string;
  /** cloak fabric (default "wool") */
  cloakFabric?: Fabric;
  /** a border stripe along the toga drape's edge */
  togaBand?: string;
  /** round brooches pinning the garment at both shoulders (colour) */
  fibula?: string;
  /** a front placket with stitched edges + buttons (modern shirts): button colour */
  placket?: string;
};
const CS = 3; // cloth canvas scale: 1536 x 768 px, drawn in 512 x 256 units
const clothCache = new Map<string, THREE.CanvasTexture>();
// ---- colour helpers (sRGB hex)
const rgbOf = (hex: string): [number, number, number] => { const n = new THREE.Color(hex).getHex(); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a: string, b: string, t: number) => { const A = rgbOf(a), B = rgbOf(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const lumOf = (hex: string) => { const [r, g, b] = rgbOf(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
/** a stitching thread that reads on the cloth: lighter on dark cloth, darker on light cloth */
const threadOf = (col: string, o?: Outfit) => (o?.stitch && o.stitch !== "none" ? o.stitch : lumOf(col) < 0.42 ? mixHex(col, "#fff4dc", 0.5) : mixHex(col, "#2a1b26", 0.34));
// ---- seeded random for the weave tiles (deterministic in every render tab)
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const tileCache = new Map<string, HTMLCanvasElement>();
/** a 128 px repeat tile of alpha-only threads / flecks (device pixels), multiplied over any colour by being dark+light */
const weaveTile = (kind: Exclude<Fabric, "none">) => {
  let c = tileCache.get(kind);
  if (c) return c;
  const N = 128; c = mk(N, N); const g = c.getContext("2d")!, r = rng(kind.length * 977 + kind.charCodeAt(0));
  const dot = (x: number, y: number, w: number, h: number, a: number) => { g.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.fillRect(x, y, w, h); };
  if (kind === "linen") { // plain weave: warp + weft threads at a 4 px pitch, uneven, plus slubs
    for (let y = 0; y < N; y += 4) { const a = (r() - 0.5) * 0.06; dot(0, y, N, 1.4, a); }
    for (let x = 0; x < N; x += 4) { const a = (r() - 0.5) * 0.06; dot(x, 0, 1.4, N, a); }
    for (let i = 0; i < 40; i++) dot(Math.floor(r() * N), Math.floor(r() * N / 4) * 4, 6 + r() * 14, 1.4, (r() - 0.5) * 0.12);
    for (let i = 0; i < 500; i++) dot(r() * N, r() * N, 1.2, 1.2, (r() - 0.5) * 0.1);
  } else if (kind === "wool") { // felted: soft mottling + flecks
    for (let i = 0; i < 70; i++) { const x = r() * N, y = r() * N, rr = 4 + r() * 10, a = (r() - 0.5) * 0.07; g.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    for (let i = 0; i < 900; i++) dot(r() * N, r() * N, 1 + r() * 1.6, 1 + r() * 1.6, (r() - 0.5) * 0.22);
  } else if (kind === "twill") { // diagonal twill ribs (denim / heavy cotton)
    g.save(); g.lineWidth = 1.6;
    for (let x = -N; x < N * 2; x += 4) { const a = (r() - 0.5) * 0.12; g.strokeStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + N, N); g.stroke(); }
    g.restore(); for (let i = 0; i < 300; i++) dot(r() * N, r() * N, 1.2, 1.2, (r() - 0.5) * 0.16);
  } else { // leather: broad mottling + fine creases
    for (let i = 0; i < 60; i++) { const x = r() * N, y = r() * N, rr = 6 + r() * 14, a = (r() - 0.5) * 0.08; g.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    g.lineWidth = 1; for (let i = 0; i < 50; i++) { const x = r() * N, y = r() * N; g.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 6); g.stroke(); }
  }
  tileCache.set(kind, c);
  return c;
};
/** the weave over the whole canvas, or inside a clip path given in cloth units */
const weave = (g: CanvasRenderingContext2D, kind: Fabric | undefined, clip?: () => void) => {
  const k = kind ?? "linen";
  if (k === "none") return;
  g.save(); if (clip) { g.beginPath(); clip(); g.clip(); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = g.createPattern(weaveTile(k), "repeat")!; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
};
/** dashed stitching along a path (cloth units) */
const stitch = (g: CanvasRenderingContext2D, col: string, path: () => void, lw = 1.25, dash: [number, number] = [3.2, 3.4]) => {
  g.save(); g.setLineDash(dash); g.lineCap = "round"; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); path(); g.stroke(); g.restore();
};
/** a seam: a thin dark crease + a stitch row beside it */
const seam = (g: CanvasRenderingContext2D, thread: string, x0: number, y0: number, x1: number, y1: number, side = 3) => {
  g.save(); g.strokeStyle = "rgba(30,18,30,0.32)"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * side, ny = (dx / l) * side;
  stitch(g, thread, () => { g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); });
};
/** a button: colour, ink rim, two holes, a highlight */
const button = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) => {
  g.fillStyle = col; g.strokeStyle = INK3; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.stroke();
  g.fillStyle = INK3; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * r * 0.26, y, r * 0.13, 0, TAU); g.fill(); }
  g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = r * 0.24; g.lineCap = "round"; g.beginPath(); g.arc(x, y, r * 0.72, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
};
/** a rivet / stud: a small domed metal dot */
const rivet = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) => {
  g.fillStyle = col; g.strokeStyle = INK3; g.lineWidth = 0.9; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); g.fill();
};
/** a belt band across the canvas with stitched edges, a framed buckle at the front and holes */
const beltBand = (g: CanvasRenderingContext2D, col: string, buckle: string | undefined, y0: number, h: number, cx: number, W: number) => {
  g.fillStyle = col; g.fillRect(0, y0, W, h); weave(g, "leather", () => g.rect(0, y0, W, h));
  g.strokeStyle = INK3; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.moveTo(0, y0 + h); g.lineTo(W, y0 + h); g.stroke();
  const th = threadOf(col); stitch(g, th, () => { g.moveTo(0, y0 + 2.6); g.lineTo(W, y0 + 2.6); g.moveTo(0, y0 + h - 2.6); g.lineTo(W, y0 + h - 2.6); }, 1.0, [2.6, 2.8]);
  g.fillStyle = "rgba(20,12,20,0.75)"; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx + 26 + i * 10, y0 + h / 2, 1.6, 2.2, 0, 0, TAU); g.fill(); }
  if (buckle) {
    const bw = Math.max(18, h * 1.5), bh = h + 7;
    g.fillStyle = buckle; g.strokeStyle = INK3; g.lineWidth = 1.5; g.beginPath(); g.roundRect(cx - bw / 2, y0 - 3.5, bw, bh, 3); g.fill(); g.stroke();
    g.fillStyle = col; g.beginPath(); g.roundRect(cx - bw / 2 + 4, y0 + 0.5, bw - 8, h - 1, 1.5); g.fill(); g.stroke();
    g.strokeStyle = buckle; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - bw / 2 + 2, y0 + h / 2); g.lineTo(cx + 2, y0 + h / 2); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - bw / 2 + 2, y0 - 1.5); g.lineTo(cx + bw / 2 - 3, y0 - 1.5); g.stroke();
  }
};
/** a decorative pattern inside a trim band */
const hemBand = (g: CanvasRenderingContext2D, pat: HemPat, col: string, x0: number, x1: number, y0: number, y1: number) => {
  const h = y1 - y0, m = h * 0.2, a = y0 + m, b = y1 - m, hi = b - a;
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, h); g.clip();
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = "square"; g.lineJoin = "miter";
  if (pat === "key") { // Greek key (meander) hooks on a baseline
    const U = hi * 1.3; g.lineWidth = Math.max(1.4, hi * 0.15);
    for (let x = x0 - U; x < x1 + U; x += U) { g.beginPath(); g.moveTo(x, b); g.lineTo(x, a); g.lineTo(x + 0.74 * U, a); g.lineTo(x + 0.74 * U, a + 0.64 * hi); g.lineTo(x + 0.36 * U, a + 0.64 * hi); g.lineTo(x + 0.36 * U, a + 0.3 * hi); g.stroke(); }
    g.beginPath(); g.moveTo(x0, b); g.lineTo(x1, b); g.stroke();
  } else if (pat === "wave") { // running wave scroll
    const U = hi * 1.6; g.lineWidth = Math.max(1.3, hi * 0.16); g.lineCap = "round";
    g.beginPath(); g.moveTo(x0, b);
    for (let x = x0 - U; x < x1 + U; x += U) { g.lineTo(x, b); g.bezierCurveTo(x + 0.2 * U, a - 0.1 * hi, x + 0.75 * U, a, x + 0.62 * U, a + 0.48 * hi); g.arc(x + 0.5 * U, a + 0.48 * hi, 0.12 * U, 0, Math.PI * 1.4); }
    g.stroke(); g.beginPath(); g.moveTo(x0, b); g.lineTo(x1, b); g.stroke();
  } else if (pat === "dots") {
    const U = hi * 1.1; for (let x = x0 + U / 2; x < x1; x += U) { g.beginPath(); g.arc(x, (a + b) / 2, hi * 0.26, 0, TAU); g.fill(); }
    g.lineWidth = Math.max(1, hi * 0.1); g.beginPath(); g.moveTo(x0, a - m * 0.3); g.lineTo(x1, a - m * 0.3); g.moveTo(x0, b + m * 0.3); g.lineTo(x1, b + m * 0.3); g.stroke();
  } else if (pat === "zigzag") {
    const U = hi * 1.0; g.lineWidth = Math.max(1.4, hi * 0.16); g.lineJoin = "round";
    g.beginPath(); g.moveTo(x0, b); for (let x = x0, i = 0; x < x1 + U; x += U / 2, i++) g.lineTo(x, i % 2 ? a : b); g.stroke();
  } else { g.lineWidth = Math.max(1, hi * 0.14); g.beginPath(); g.moveTo(x0, a); g.lineTo(x1, a); g.moveTo(x0, b); g.lineTo(x1, b); g.stroke(); }
  g.restore();
};
/** an emblem shape (no letters), centre x, y, radius r */
const emblemAt = (g: CanvasRenderingContext2D, em: Emblem, x: number, y: number, r: number) => {
  g.save(); g.fillStyle = em.col; g.strokeStyle = INK3; g.lineWidth = 1.1; g.lineJoin = "round";
  if (em.shape === "sun") { // a 16-ray star round a disc
    g.beginPath(); for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.48 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.32, 0, TAU); g.fill(); g.stroke();
  } else if (em.shape === "star") {
    g.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.55 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
  } else if (em.shape === "lotus") {
    for (const [a, s] of [[0, 1], [-0.62, 0.86], [0.62, 0.86], [-1.15, 0.7], [1.15, 0.7]] as const) { g.save(); g.translate(x, y + r * 0.45); g.rotate(a); g.beginPath(); g.ellipse(0, -r * 0.55 * s, r * 0.26, r * 0.58 * s, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    g.beginPath(); g.ellipse(x, y + r * 0.55, r * 0.7, r * 0.2, 0, 0, TAU); g.fill(); g.stroke();
  } else if (em.shape === "wheel") {
    g.lineWidth = r * 0.16; g.strokeStyle = em.col; g.beginPath(); g.arc(x, y, r * 0.82, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.stroke(); }
    g.lineWidth = 1.1; g.strokeStyle = INK3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.stroke();
    g.fillStyle = em.col; g.beginPath(); g.arc(x, y, r * 0.2, 0, TAU); g.fill(); g.stroke();
  } else if (em.shape === "leaf") { // two crossed sprigs
    for (const s of [-1, 1]) { g.save(); g.translate(x, y + r * 0.7); g.rotate(s * 0.45);
      for (let i = 0; i < 4; i++) for (const t of [-1, 1]) { g.save(); g.translate(0, -r * (0.25 + i * 0.36)); g.rotate(t * 0.9); g.beginPath(); g.ellipse(t * r * 0.16, 0, r * 0.2, r * 0.1, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
      g.restore(); }
  } else { g.beginPath(); g.arc(x, y, r, 0.5, TAU - 0.5); g.arc(x + r * 0.45, y, r * 0.78, TAU - 0.75, 0.75, true); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
};
/** a stitched patch (rotated), centre x, y */
const patchAt = (g: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number, rot: number) => {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = col; g.strokeStyle = "rgba(30,18,30,0.55)"; g.lineWidth = 1.2; g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
  weave(g, "twill", () => g.rect(-w / 2, -h / 2, w, h));
  const th = threadOf(col); stitch(g, th, () => g.rect(-w / 2 + 2.6, -h / 2 + 2.6, w - 5.2, h - 5.2), 1.1, [2.6, 2.6]);
  g.strokeStyle = th; g.lineWidth = 1.0; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = sx * (w / 2 - 2.6), py = sy * (h / 2 - 2.6); g.beginPath(); g.moveTo(px - 1.8, py - 1.8); g.lineTo(px + 1.8, py + 1.8); g.moveTo(px + 1.8, py - 1.8); g.lineTo(px - 1.8, py + 1.8); g.stroke(); }
  g.restore();
};
/** a twisted rope band across the canvas */
const ropeBand = (g: CanvasRenderingContext2D, col: string, y0: number, h: number, W: number) => {
  g.fillStyle = col; g.fillRect(0, y0, W, h);
  g.strokeStyle = mixHex(col, "#2a1b26", 0.42); g.lineWidth = 1.5; for (let x = -h; x < W + h; x += 5) { g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + h * 0.25, y0 + h * 0.5, x + h * 0.6, y0 + h); g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; for (let x = -h + 2; x < W + h; x += 5) { g.beginPath(); g.moveTo(x, y0 + 1); g.quadraticCurveTo(x + h * 0.25, y0 + h * 0.4, x + h * 0.45, y0 + h * 0.7); g.stroke(); }
  g.strokeStyle = INK3; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.moveTo(0, y0 + h); g.lineTo(W, y0 + h); g.stroke();
};
/** rows of laced lamellar plates over a region of the cloth canvas */
const lamellarRows = (g: CanvasRenderingContext2D, col: string, x0: number, x1: number, y0: number, y1: number) => {
  g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const pw = 15, ph = 24;
  for (let r = 0, y = y0; y < y1; r++, y += ph - 4) for (let x = x0 - (r % 2) * pw * 0.5; x < x1; x += pw) {
    g.fillStyle = r % 2 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
    g.beginPath(); g.roundRect(x + 1, y + 1, pw - 2, ph - 3, 4); g.fill();
    g.strokeStyle = "rgba(30,20,30,0.75)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x + 4, y + 4, 2, ph - 12);
  }
  g.strokeStyle = "#7a2a2a"; g.lineWidth = 2.5;      // red lacing rows
  for (let y = y0 + ph - 5; y < y1; y += ph - 4) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
};
const scaledCanvas = () => { const c = mk(512 * CS, 256 * CS), g = c.getContext("2d")!; g.setTransform(CS, 0, 0, CS, 0, 0); g.lineCap = "round"; g.lineJoin = "round"; return { c, g }; };
const clothOut = (c: HTMLCanvasElement, key: string) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.wrapS = THREE.RepeatWrapping;
  clothCache.set(key, t); return t;
};
const clothTex = (o: Outfit) => {
  const key = JSON.stringify(o);
  const hit = clothCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256, { c, g } = scaledCanvas(), fab = o.fabric ?? "linen", noStitch = o.stitch === "none";
  // u: 0 = back-left .. 0.5 = front .. 1 = back; v (canvas y): 0 = torso top .. H = bottom
  g.fillStyle = o.shirt; g.fillRect(0, 0, W, H);
  if (o.stripes) { g.fillStyle = o.stripes; for (let y = 6; y < H; y += 22) g.fillRect(0, y, W, 9); }
  weave(g, fab);
  const cx = W / 2, th = threadOf(o.shirt, o);
  // garment construction: side seams, the neckline, raglan seams on modern shirts
  if (!noStitch && !o.segs && !o.lamellar) {
    for (const x of [W * 0.25, W * 0.75]) seam(g, th, x, 44, x, H, 3);
    if (!o.collar && !o.closure && !o.torc) { g.strokeStyle = "rgba(30,18,30,0.4)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, -12, 78, 58, 0, 0.1, Math.PI - 0.1); g.stroke(); stitch(g, th, () => g.ellipse(cx, -12, 82, 62, 0, 0.12, Math.PI - 0.12)); }
    if (o.collar || o.placket || o.pockets) for (const s of [-1, 1]) seam(g, th, cx + s * 46, 38, cx + s * 124, 86, -3 * s);
  }
  // canvas x < cx = the wearer's RIGHT side (u > .5 = +x = the character's left)
  if (o.lamellar) { // vest over the robe: robe colour shows in a V at the neck
    lamellarRows(g, o.lamellar, 0, W, 10, H);
    g.fillStyle = o.shirt; g.beginPath(); g.moveTo(cx - 46, 0); g.lineTo(cx, 46); g.lineTo(cx + 46, 0); g.fill();
    g.strokeStyle = INK3; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 46, 0); g.lineTo(cx, 46); g.lineTo(cx + 46, 0); g.stroke();
    g.fillStyle = "#c9a24a"; g.fillRect(0, 6, W, 7);   // brass edge at the shoulders
  }
  if (o.closure === "diag") { // deel: the front flap crosses from the neck to the wearer's right side
    const tr = o.trim ?? INK3;
    g.fillStyle = "rgba(0,0,0,0.08)"; g.beginPath(); g.moveTo(cx + 18, 0); g.lineTo(cx - 70, H * 0.46); g.lineTo(cx - 70, H); g.lineTo(0, H); g.lineTo(0, 0); g.fill();
    g.strokeStyle = tr; g.lineWidth = 11; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx + 18, 0); g.lineTo(cx - 70, H * 0.46); g.lineTo(cx - 70, H); g.stroke();
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + 24, 0); g.lineTo(cx - 63, H * 0.46); g.lineTo(cx - 63, H); g.stroke();
    if (!noStitch) stitch(g, threadOf(tr, o), () => { g.moveTo(cx + 13, 0); g.lineTo(cx - 75, H * 0.46); g.lineTo(cx - 75, H); });
    g.fillStyle = tr; g.fillRect(0, 0, W, 9);                                   // collar band
    g.fillStyle = tr; g.strokeStyle = INK3; g.lineWidth = 2;                       // toggle knots along the flap
    for (const k of [0.3, 0.62]) { const x = cx + 18 - 88 * k, y = H * 0.46 * k; g.beginPath(); g.arc(x - 4, y + 4, 6, 0, 7); g.fill(); g.stroke(); }
  }
  if (o.closure === "round") { // official robe: round collar
    const tr = o.trim ?? INK3;
    g.strokeStyle = tr; g.lineWidth = 10; g.beginPath(); g.ellipse(cx, -6, 60, 40, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, -6, 66, 46, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.moveTo(cx - 64, 26); g.lineTo(cx - 64, H); g.stroke();
    if (!noStitch) stitch(g, threadOf(o.shirt, o), () => { g.moveTo(cx - 69, 30); g.lineTo(cx - 69, H); });
  }
  if (o.sash) {
    g.fillStyle = o.sash; g.fillRect(0, H * 0.74, W, H * 0.16); weave(g, fab, () => g.rect(0, H * 0.74, W, H * 0.16));
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, H * 0.75); g.lineTo(x + 10, H * 0.89); g.stroke(); }
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.strokeRect(-4, H * 0.74, W + 8, H * 0.16);
    if (!noStitch) stitch(g, threadOf(o.sash, o), () => { g.moveTo(0, H * 0.74 + 3); g.lineTo(W, H * 0.74 + 3); g.moveTo(0, H * 0.9 - 3); g.lineTo(W, H * 0.9 - 3); }, 1.0);
    g.fillStyle = o.sash; g.beginPath(); g.ellipse(cx + 70, H * 0.82, 16, 13, 0, 0, 7); g.fill(); g.stroke();   // knot
    g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + 62, H * 0.78); g.quadraticCurveTo(cx + 70, H * 0.83, cx + 78, H * 0.78); g.stroke();
  }
  if (o.vest) { // open vest: shirt panel in front, vest colour round the rest
    const vp = () => { g.moveTo(0, 0); g.lineTo(cx - 40, 0); g.lineTo(cx - 4, H * 0.62); g.lineTo(cx - 4, H); g.lineTo(0, H); g.closePath(); g.moveTo(W, 0); g.lineTo(cx + 40, 0); g.lineTo(cx + 4, H * 0.62); g.lineTo(cx + 4, H); g.lineTo(W, H); g.closePath(); };
    g.fillStyle = o.vest; g.beginPath(); vp(); g.fill(); weave(g, "wool", vp);
    g.strokeStyle = INK3; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 40, 0); g.lineTo(cx - 4, H * 0.62); g.lineTo(cx - 4, H);
    g.moveTo(cx + 40, 0); g.lineTo(cx + 4, H * 0.62); g.lineTo(cx + 4, H); g.stroke();
    if (!noStitch) stitch(g, threadOf(o.vest, o), () => { g.moveTo(cx - 46, 0); g.lineTo(cx - 10, H * 0.62); g.lineTo(cx - 10, H); g.moveTo(cx + 46, 0); g.lineTo(cx + 10, H * 0.62); g.lineTo(cx + 10, H); });
    for (let y = H * 0.68; y < H * 0.9; y += 22) button(g, cx - 18, y, 4.6, "#e8c45a");
  }
  if (o.collar) { g.fillStyle = o.collar; g.beginPath(); g.moveTo(cx - 34, 0); g.lineTo(cx, 30); g.lineTo(cx + 34, 0); g.fill(); g.strokeStyle = INK3; g.lineWidth = 2.5; g.stroke();
    if (!noStitch) stitch(g, threadOf(o.collar, o), () => { g.moveTo(cx - 27, 0); g.lineTo(cx, 23); g.lineTo(cx + 27, 0); }, 1.0); }
  if (o.placket) { // button stand down the front
    g.strokeStyle = "rgba(30,18,30,0.4)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 9, 30); g.lineTo(cx - 9, H); g.moveTo(cx + 9, 30); g.lineTo(cx + 9, H); g.stroke();
    if (!noStitch) stitch(g, th, () => { g.moveTo(cx - 6, 32); g.lineTo(cx - 6, H); g.moveTo(cx + 6, 32); g.lineTo(cx + 6, H); }, 1.0);
    for (let y = 52; y < H * 0.86; y += 30) button(g, cx, y, 4.4, o.placket);
  }
  if (o.tie) { g.fillStyle = o.tie; g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 9, 18); g.lineTo(cx + 9, 18); g.lineTo(cx + 15, H * 0.62); g.lineTo(cx, H * 0.72); g.lineTo(cx - 15, H * 0.62); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 5; for (let y = 50; y < H * 0.62; y += 26) { g.beginPath(); g.moveTo(cx - 12, y); g.lineTo(cx + 12, y - 12); g.stroke(); } }
  if (o.bowtie) { g.fillStyle = o.bowtie; g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, 16); g.lineTo(cx - 34, 2); g.lineTo(cx - 34, 32); g.closePath(); g.moveTo(cx, 16); g.lineTo(cx + 34, 2); g.lineTo(cx + 34, 32); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffffff"; for (const [x, y] of [[-24, 10], [-18, 22], [22, 11], [26, 23]]) { g.beginPath(); g.arc(cx + x, y, 3.2, 0, 7); g.fill(); } }
  if (o.buttons) for (let y = 60; y < H * 0.82; y += 34) button(g, cx, y, 5, o.buttons);
  if (o.badge) { g.fillStyle = o.badge; g.strokeStyle = INK3; g.lineWidth = 1.2; const bx = cx + 44, by = 58; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(bx + r * Math.cos(a), by + r * Math.sin(a)); } g.closePath(); g.fill(); g.stroke(); }
  if (o.pockets) for (const sx of [-1, 1]) {
    const x = cx + sx * 58; g.fillStyle = o.pockets; g.strokeStyle = INK3; g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(x - 26, 56, 52, 50, 5); g.fill(); g.stroke();
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(x - 26, 56, 52, 14); g.beginPath(); g.moveTo(x - 26, 70); g.lineTo(x + 26, 70); g.stroke();
    if (!noStitch) { const pt = threadOf(o.pockets, o); stitch(g, pt, () => { g.moveTo(x - 22, 74); g.lineTo(x - 22, 102); g.lineTo(x + 22, 102); g.lineTo(x + 22, 74); g.moveTo(x - 22, 66); g.lineTo(x + 22, 66); }, 1.0); }
    button(g, x, 66, 3.6, o.buttons ?? "#e8dcc0");
  }
  if (o.apron) { // bib + body of a leather apron, straps over the shoulders and round the waist
    const a = o.apron, ap = () => { g.moveTo(cx - 54, 34); g.lineTo(cx + 54, 34); g.lineTo(cx + 84, H); g.lineTo(cx - 84, H); g.closePath(); };
    g.fillStyle = a; g.strokeStyle = INK3; g.lineWidth = 3;
    g.beginPath(); ap(); g.fill(); weave(g, "leather", ap); g.beginPath(); ap(); g.stroke();
    if (!noStitch) stitch(g, threadOf(a, o), () => { g.moveTo(cx - 48, 40); g.lineTo(cx + 48, 40); g.lineTo(cx + 77, H); g.moveTo(cx - 48, 40); g.lineTo(cx - 77, H); });
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 44, 46); g.lineTo(cx - 70, H); g.stroke();
    g.strokeStyle = a; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 50, 36); g.lineTo(cx - 92, 0); g.moveTo(cx + 50, 36); g.lineTo(cx + 92, 0); g.stroke();
    for (const sx of [-1, 1]) rivet(g, cx + sx * 48, 40, 5.5, "#c9a24a");
    g.fillStyle = a; g.fillRect(0, H * 0.8, W, 12); g.strokeStyle = INK3; g.lineWidth = 2; g.strokeRect(-4, H * 0.8, W + 8, 12);
    g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(cx - 74, H * 0.4); g.lineTo(cx + 74, H * 0.4); g.stroke(); g.setLineDash([]);
  }
  if (o.segs) { // lorica segmentata: metal hoops round the chest (rivets at the front closure) + two shoulder straps (rivets)
    for (let y = 26; y < H * 0.78; y += 30) {
      g.fillStyle = o.segs; g.fillRect(0, y, W, 24);
      const gr = g.createLinearGradient(0, y, 0, y + 24); gr.addColorStop(0, "rgba(255,255,255,0.45)"); gr.addColorStop(0.3, "rgba(255,255,255,0.08)"); gr.addColorStop(1, "rgba(0,0,0,0.18)");
      g.fillStyle = gr; g.fillRect(0, y, W, 24);
      g.strokeStyle = INK3; g.lineWidth = 2.5; g.strokeRect(-4, y, W + 8, 24);
      for (const sx of [-1, 1]) rivet(g, cx + sx * 16, y + 12, 3.2, mixHex(o.segs, "#ffffff", 0.3));
      for (const x of [W * 0.25, W * 0.75]) rivet(g, x, y + 12, 2.8, mixHex(o.segs, "#ffffff", 0.3));
    }
    g.strokeStyle = INK3; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, 26); g.lineTo(cx, H * 0.78); g.stroke();
    for (const sx of [-1, 1]) { g.fillStyle = o.segs; g.fillRect(cx + sx * 58 - 14, 0, 28, H * 0.5); g.strokeStyle = INK3; g.lineWidth = 2.5; g.strokeRect(cx + sx * 58 - 14, -4, 28, H * 0.5 + 4);
      g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(cx + sx * 58 - 11, 0, 4, H * 0.5);
      for (let y = 40; y < H * 0.48; y += 22) rivet(g, cx + sx * 58, y, 3.2, "#c9a24a");
      g.fillStyle = "#c9a24a"; g.strokeStyle = INK3; g.lineWidth = 1.2; g.beginPath(); g.roundRect(cx + sx * 58 - 9, H * 0.5 - 8, 18, 12, 2); g.fill(); g.stroke(); }
  }
  if (o.toga) { // the drape: a broad diagonal band (wearer's left shoulder -> right hip) with fold lines, wrapping round the back
    const t = o.toga, tp = () => { g.moveTo(cx + 150, 0); g.lineTo(cx + 40, 0); g.lineTo(cx - 140, H * 0.92); g.lineTo(cx - 10, H); g.lineTo(cx + 210, H * 0.2); g.closePath(); };
    g.fillStyle = t; g.strokeStyle = INK3; g.lineWidth = 3;
    g.beginPath(); tp(); g.fill(); weave(g, fab, tp); g.beginPath(); tp(); g.stroke();
    // folds: a dark crease + a light ridge beside it
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = "rgba(60,40,70,0.3)"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 70 + k * 30, 6); g.quadraticCurveTo(cx - 10 + k * 26, H * 0.5, cx - 110 + k * 30, H * 0.95); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + 76 + k * 30, 6); g.quadraticCurveTo(cx - 4 + k * 26, H * 0.5, cx - 104 + k * 30, H * 0.95); g.stroke();
    }
    if (o.togaBand) { // a border stripe along the drape's edge (the edge crossing the chest)
      const bp = () => { g.moveTo(cx + 40, 0); g.lineTo(cx - 140, H * 0.92); g.lineTo(cx - 124, H * 0.94); g.lineTo(cx + 56, 0); g.closePath(); };
      g.fillStyle = o.togaBand; g.beginPath(); bp(); g.fill(); g.strokeStyle = INK3; g.lineWidth = 1.4; g.stroke();
      if (!noStitch) stitch(g, threadOf(o.togaBand, o), () => { g.moveTo(cx + 61, 0); g.lineTo(cx - 118, H * 0.94); }, 1.0);
    }
    g.fillStyle = t; g.fillRect(cx + 200, 0, 60, H); g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + 200, 0); g.lineTo(cx + 202, H); g.stroke();
  }
  if (o.patches) { patchAt(g, o.patches, cx + 52, 150, 34, 30, -0.12); patchAt(g, mixHex(o.patches, "#ffffff", 0.18), W * 0.86, 96, 26, 24, 0.2); }
  if (o.emblem) emblemAt(g, o.emblem, cx + 36, 90, 17);
  if (o.torc) { g.strokeStyle = INK3; g.lineWidth = 11.5; g.beginPath(); g.ellipse(cx, -4, 64, 30, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = o.torc; g.lineWidth = 9; g.beginPath(); g.ellipse(cx, -4, 64, 30, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, -6, 63, 28, 0, 0.3, Math.PI - 0.3); g.stroke();
    g.fillStyle = o.torc; g.strokeStyle = INK3; g.lineWidth = 1.3; g.beginPath(); g.arc(cx, 28, 9, 0, 7); g.fill(); g.stroke(); rivet(g, cx, 28, 4, mixHex(o.torc, "#ffffff", 0.3)); }
  if (o.fibula) for (const sx of [-1, 1]) { const x = cx + sx * 64, y = 40; g.fillStyle = o.fibula; g.strokeStyle = INK3; g.lineWidth = 1.3; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.stroke(); rivet(g, x, y, 2.4, mixHex(o.fibula, "#ffffff", 0.35)); }
  // the belt: above the skirt join for robe wearers (the skirt hides y > ~212)
  const beltY = o.robe ? H * 0.765 : H * 0.84, beltH = o.robe ? H * 0.085 : H * 0.09;
  if (o.rope) { ropeBand(g, o.rope, beltY, 10, W); g.fillStyle = o.rope; g.strokeStyle = INK3; g.lineWidth = 1.3; g.beginPath(); g.ellipse(cx - 40, beltY + 5, 9, 7.5, 0.3, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = mixHex(o.rope, "#2a1b26", 0.42); g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 46, beltY + 2); g.quadraticCurveTo(cx - 40, beltY + 8, cx - 33, beltY + 3); g.stroke(); }
  else if (o.belt) beltBand(g, o.belt, o.buckle, beltY, beltH, cx, W);
  if (o.pants) { g.fillStyle = o.pants; g.fillRect(0, H * 0.93, W, H * 0.07); weave(g, "twill", () => g.rect(0, H * 0.93, W, H * 0.07)); }
  return clothOut(c, key);
};
/** the robe skirt below the torso: closure line continued down the front, trim at the hem (v 0 = waist, 1 = hem) */
const skirtTex = (o: Outfit) => {
  const key = "skirt|" + JSON.stringify(o);
  const hit = clothCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256, { c, g } = scaledCanvas(), cx = W / 2, tr = o.trim ?? INK3, noStitch = o.stitch === "none";
  g.fillStyle = o.robe!; g.fillRect(0, 0, W, H);
  if (o.lamellar) { lamellarRows(g, o.lamellar, 0, cx - 30, 0, H * 0.55); lamellarRows(g, o.lamellar, cx + 30, W, 0, H * 0.55); }  // tassets
  weave(g, o.fabric ?? "linen", () => g.rect(0, 0, W, H - 22));
  // folds: a soft dark crease + a light ridge, fanning down the skirt
  for (let x = 20; x < W; x += 46) {
    g.strokeStyle = "rgba(0,0,0,0.13)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x + 8, H); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.16)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, H * 0.2); g.lineTo(x + 15, H); g.stroke();
  }
  const th = threadOf(o.robe!, o);
  if (!noStitch) for (const x of [W * 0.25, W * 0.75]) seam(g, th, x, 0, x + 6, H - 24, 3);
  if (o.closure === "diag" || o.closure === "round") {
    const x = o.closure === "diag" ? cx - 70 : cx - 64;
    g.strokeStyle = tr; g.lineWidth = o.closure === "diag" ? 11 : 0; if (o.closure === "diag") { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 6, H); g.stroke(); }
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 7, 0); g.lineTo(x + 1, H); g.stroke();
  }
  if (o.patches) patchAt(g, o.patches, cx - 62, H * 0.5, 30, 28, 0.1);
  if (o.rope) for (const [dx, len] of [[-42, 64], [-34, 52]] as const) { // the rope belt's hanging ends, frayed tips
    g.strokeStyle = INK3; g.lineWidth = 7.5; g.beginPath(); g.moveTo(cx + dx, 0); g.quadraticCurveTo(cx + dx - 4, len * 0.5, cx + dx + 2, len); g.stroke();
    g.strokeStyle = o.rope; g.lineWidth = 5; g.stroke();
    g.strokeStyle = mixHex(o.rope, "#2a1b26", 0.4); g.lineWidth = 1; for (let y = 4; y < len; y += 5) { g.beginPath(); g.moveTo(cx + dx - 2.5, y); g.lineTo(cx + dx + 2.5, y + 3); g.stroke(); }
    g.strokeStyle = o.rope; g.lineWidth = 1.2; for (const fx of [-2, 0, 2]) { g.beginPath(); g.moveTo(cx + dx + 2, len); g.lineTo(cx + dx + 2 + fx * 1.5, len + 7); g.stroke(); }
  }
  // the hem: trim band + its pattern, an ink line + a stitch row above it
  g.fillStyle = tr; g.fillRect(0, H - 22, W, 22);
  if (o.hem) hemBand(g, o.hem, o.hemCol ?? mixHex(tr, "#2a1b26", 0.45), 0, W, H - 21, H - 1);
  g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, H - 23); g.lineTo(W, H - 23); g.stroke();
  if (!noStitch) stitch(g, th, () => { g.moveTo(0, H - 27); g.lineTo(W, H - 27); });
  if (o.apron) { g.fillStyle = o.apron; g.strokeStyle = INK3; g.lineWidth = 3; const ap = () => { g.moveTo(cx - 70, 0); g.lineTo(cx + 70, 0); g.lineTo(cx + 64, H); g.lineTo(cx - 64, H); g.closePath(); };
    g.beginPath(); ap(); g.fill(); weave(g, "leather", ap); g.beginPath(); ap(); g.stroke();
    if (!noStitch) stitch(g, threadOf(o.apron, o), () => { g.moveTo(cx - 64, 0); g.lineTo(cx - 58, H - 6); g.lineTo(cx + 58, H - 6); g.lineTo(cx + 64, 0); }); }
  return clothOut(c, key);
};
/** the cloak (a lathe shell: u 0 / 1 = the two front edges, v 0 = hem = canvas bottom): wool, folds, a trimmed border */
const cloakTex = (o: Outfit) => {
  const key = "cloak|" + JSON.stringify(o);
  const hit = clothCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256, { c, g } = scaledCanvas(), col = o.cloak!, tr = o.cloakTrim, noStitch = o.stitch === "none";
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  weave(g, o.cloakFabric ?? "wool");
  for (let x = 30; x < W; x += 58) { // long folds from the shoulders
    const gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.16)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - 14, H * 0.12, 28, H);
    g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 16, H * 0.2); g.lineTo(x + 20, H); g.stroke();
  }
  const th = threadOf(col, o);
  if (tr) { // border: hem band (with the pattern) + both front edges
    const bw = 16;
    g.fillStyle = tr; g.fillRect(0, H - bw, W, bw); g.fillRect(0, 0, bw, H); g.fillRect(W - bw, 0, bw, H);
    if (o.hem) { const pc = o.hemCol ?? mixHex(tr, "#2a1b26", 0.45); hemBand(g, o.hem, pc, 0, W, H - bw + 1, H - 1); }
    g.strokeStyle = INK3; g.lineWidth = 2; g.beginPath(); g.moveTo(bw, 0); g.lineTo(bw, H - bw); g.lineTo(W - bw, H - bw); g.lineTo(W - bw, 0); g.stroke();
    if (!noStitch) stitch(g, threadOf(tr, o), () => { g.moveTo(bw - 4, 0); g.lineTo(bw - 4, H - bw + 4); g.lineTo(W - bw + 4, H - bw + 4); g.lineTo(W - bw + 4, 0); }, 1.1);
  }
  if (!noStitch) stitch(g, th, () => { const e = tr ? 21 : 5; g.moveTo(e, 0); g.lineTo(e, H - e); g.lineTo(W - e, H - e); g.lineTo(W - e, 0); });
  return clothOut(c, key);
};
// ------------------------------------------------------------------ hat / hair detail textures (sphere-cap UVs: x = round
// the crown, y 0 = the pole .. y H = the rim; torus: x = along the ring, y = round the tube)
export type HatTexK = "felt" | "panels" | "hair" | "curls" | "turban" | "band" | "metal" | "crest" | "fur" | "diadem" | "straw";
const hatTex = (kind: HatTexK, col: string, n = 6) => {
  const key = `hat|${kind}|${col}|${n}`;
  const hit = clothCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256, { c, g } = scaledCanvas(), th = threadOf(col), dark = mixHex(col, "#1c1218", 0.38), lite = mixHex(col, "#ffffff", 0.3);
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  const r = rng(kind.length * 131 + n);
  if (kind === "felt" || kind === "panels") {
    weave(g, "wool");
    if (kind === "panels") for (let i = 0; i < n; i++) { const x = (i / n) * W; g.strokeStyle = "rgba(25,15,25,0.45)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 6); g.lineTo(x, H); g.stroke();
      stitch(g, th, () => { g.moveTo(x - 4, 14); g.lineTo(x - 4, H); g.moveTo(x + 4, 14); g.lineTo(x + 4, H); }, 1.4, [3.6, 3.4]); }
    stitch(g, th, () => { g.moveTo(0, H - 10); g.lineTo(W, H - 10); }, 1.5, [3.6, 3.4]);
    if (kind === "felt") stitch(g, th, () => { g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); }, 1.4, [3.6, 3.4]);
  } else if (kind === "hair") { // carved strand grooves: a dark groove + a light ridge, + a sheen ring (softer on pale hair)
    const groove = mixHex(col, "#1c1218", lumOf(col) > 0.7 ? 0.16 : 0.38);
    for (let i = 0; i < 56; i++) {
      const x = (i / 56) * W + (r() - 0.5) * 4, y0 = r() * 18, wv = (r() - 0.5) * 10;
      g.strokeStyle = groove; g.lineWidth = 2.0 + r() * 1.2; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + wv, H * 0.5, x + wv * 0.3, H); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 3, y0 + 10); g.quadraticCurveTo(x + 3 + wv, H * 0.5, x + 3 + wv * 0.3, H); g.stroke();
    }
    g.strokeStyle = lite; g.lineWidth = 4; g.setLineDash([12, 9]); g.beginPath(); g.moveTo(0, H * 0.4); g.lineTo(W, H * 0.4); g.stroke(); g.setLineDash([]);
  } else if (kind === "curls") { // a curl ball: a few C-swirls round it
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const x = ((i + 0.5) / 6) * W, y = H * (0.35 + 0.25 * (i % 2)); g.strokeStyle = dark; g.beginPath(); g.arc(x, y, 26, 0.4, 4.6); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1.6; g.beginPath(); g.arc(x - 3, y - 3, 20, 3.4, 4.6); g.stroke(); g.lineWidth = 3; }
  } else if (kind === "turban" || kind === "band") { // wrapped cloth: diagonal creases, a light ridge beside each
    weave(g, "linen");
    const step = kind === "band" ? 34 : 46;
    for (let x = -H; x < W + H; x += step) {
      g.strokeStyle = "rgba(40,24,30,0.28)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + H * 0.3, H * 0.5, x + H * 0.55, H); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 7, 0); g.quadraticCurveTo(x + 7 + H * 0.3, H * 0.5, x + 7 + H * 0.55, H); g.stroke();
    }
  } else if (kind === "metal") { // a broad sheen band + a darker rim zone + faint hammer marks
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(255,255,255,0.1)"); gr.addColorStop(0.42, "rgba(255,255,255,0.38)"); gr.addColorStop(0.55, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0.16)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"; g.beginPath(); g.ellipse(r() * W, r() * H, 2 + r() * 3, 1.5 + r() * 2, 0, 0, TAU); g.fill(); }
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, r() * H * 0.3); g.lineTo(x + (r() - 0.5) * 8, H * (0.5 + r() * 0.4)); g.stroke(); }
  } else if (kind === "crest" || kind === "fur") { // dense strands
    for (let i = 0; i < (kind === "crest" ? 140 : 320); i++) {
      const x = r() * W, y = kind === "crest" ? r() * 10 : r() * H, L = kind === "crest" ? H : 10 + r() * 14;
      g.strokeStyle = r() > 0.5 ? dark : lite; g.lineWidth = kind === "crest" ? 1.6 + r() * 1.4 : 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + L); g.stroke();
    }
  } else if (kind === "diadem") { // a white ribbon with two gold edge lines (they wrap round the tube)
    g.fillStyle = "#e3b84a"; for (const y of [0.16, 0.34, 0.66, 0.84]) g.fillRect(0, H * y - 4, W, 8);
    stitch(g, "#c9a24a", () => { g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); }, 1.4);
  } else if (kind === "straw") {
    for (let y = 0; y < H; y += 6) { g.strokeStyle = (y / 6) % 2 ? dark : lite; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 3); g.stroke(); }
  }
  return clothOut(c, key);
};

// ------------------------------------------------------------------ hats and hair
export type Hat = { k: "none" } | { k: "cap"; col: string; badge?: string } | { k: "bowler"; col: string } | { k: "top"; col: string; band?: string }
  | { k: "hair"; col: string; curly?: boolean } | { k: "newsboy"; col: string; stripe?: string } | { k: "chef" }
  /** Mongol hat: felt cone crown, thick fur brim tipped back, a knob on top, fur ear flaps */
  | { k: "mongol"; col: string; fur?: string; knob?: string }
  /** Jin round iron helmet: dome, brass rim, red horsehair tassel on a spike, lamellar neck-guard flaps */
  | { k: "jinhelm"; col?: string; tassel?: string; guard?: string }
  /** official's black futou: rounded cap, raised rear lobe, two long thin horizontal wings */
  | { k: "futou"; col?: string }
  /** frizzled (blown-up) hair: a cap of short spikes */
  | { k: "frizz"; col: string }
  /** hair shell + a cloth headband round the brow (knot tails at the back) */
  | { k: "headband"; col: string; band: string }
  /** Greek petasos: low felt crown + a wide flat brim (chin cord) */
  | { k: "petasos"; col: string; band?: string }
  /** wide-brimmed field sun hat with a band */
  | { k: "sunhat"; col: string; band?: string }
  /** bald crown with a fringe of hair round the back + sides */
  | { k: "bald"; col: string }
  /** kid's hair: a shell + a top tuft */
  | { k: "tuft"; col: string }
  /** Macedonian kausia: a flat, wide felt beret + a white royal diadem ribbon round it (tails at the back) */
  | { k: "kausia"; col: string; diadem?: string }
  /** bald crown + a fringe of hair (col) + a green laurel wreath */
  | { k: "laurel"; col: string; leaf?: string }
  /** Roman helmet (romhelm: iron, red crest) / Greek bronze helmet (greekhelm): dome, cheek + neck guards, crest */
  | { k: "romhelm" | "greekhelm"; col?: string; crest?: string }
  /** Indian turban: wrapped cloth bands round the head + a knot on top */
  | { k: "turban"; col: string; band?: string };
/** facial hair painted on the face decal (the reference paints moustaches on the face) */
export type Beard = { col: string; droop?: boolean; goatee?: boolean;
  /** short full beard round the jaw + a moustache */
  full?: boolean;
  /** big bushy moustache (Gaul) */
  stache?: boolean;
  /** proud moustache with the ends curled up (king) */
  curl?: boolean;
  /** round glasses painted over the eyes */
  glasses?: boolean;
  /** white bushy eyebrows over the brows (old man) */
  brows?: string;
};

// ------------------------------------------------------------------ the rubber-hose limb (tube rebuilt in place)
const SEG = 18, RAD = 8;
class Limb {
  mesh: THREE.Mesh; private pos: Float32Array; private nor: Float32Array;
  private pts = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  constructor(public r: number, mat: THREE.Material) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((SEG + 1) * RAD * 3); this.nor = new Float32Array((SEG + 1) * RAD * 3);
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c = (i + 1) * RAD + j, d = (i + 1) * RAD + ((j + 1) % RAD);
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true;
  }
  /** smooth curve S -> E -> T: quadratic Bezier whose midpoint is the IK joint E (a soft rubber-hose bend) */
  set(S: THREE.Vector3, E: THREE.Vector3, T: THREE.Vector3) {
    const C = E.clone().multiplyScalar(2).sub(S.clone().add(T).multiplyScalar(0.5));
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, u = 1 - t;
      this.pts[i].set(0, 0, 0).addScaledVector(S, u * u).addScaledVector(C, 2 * u * t).addScaledVector(T, t * t);
    }
    // parallel-transport frames
    const tan = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), prevT = new THREE.Vector3();
    tan.subVectors(this.pts[1], this.pts[0]).normalize();
    n.set(0, 0, 1); if (Math.abs(n.dot(tan)) > 0.9) n.set(1, 0, 0);
    n.sub(tan.clone().multiplyScalar(n.dot(tan))).normalize();
    for (let i = 0; i <= SEG; i++) {
      prevT.copy(tan);
      tan.subVectors(this.pts[Math.min(i + 1, SEG)], this.pts[Math.max(i - 1, 0)]).normalize();
      const ax = new THREE.Vector3().crossVectors(prevT, tan);
      if (ax.lengthSq() > 1e-10) { ax.normalize(); n.applyAxisAngle(ax, Math.acos(THREE.MathUtils.clamp(prevT.dot(tan), -1, 1))); }
      b.crossVectors(tan, n).normalize();
      // taper: full width, very slightly thinner toward the hand/foot
      const r = this.r * (1 - 0.12 * (i / SEG));
      for (let j = 0; j < RAD; j++) {
        const a = (j / RAD) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        const nx = n.x * cs + b.x * sn, ny = n.y * cs + b.y * sn, nz = n.z * cs + b.z * sn, o = (i * RAD + j) * 3;
        this.pos[o] = this.pts[i].x + nx * r; this.pos[o + 1] = this.pts[i].y + ny * r; this.pos[o + 2] = this.pts[i].z + nz * r;
        this.nor[o] = nx; this.nor[o + 1] = ny; this.nor[o + 2] = nz;
      }
    }
    const g = this.mesh.geometry as THREE.BufferGeometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
}

/** 2-bone IK: joint position for root S, target T, bone lengths a, b, bend toward `pole` (direction). No stretch
 *  (the reference has no squash/stretch): past full reach the limb straightens and the hand stops short. */
export const ik = (S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, out = new THREE.Vector3()) => {
  const dir = new THREE.Vector3().subVectors(T, S);
  let d = dir.length(); dir.divideScalar(d || 1);
  const reach = (a + b) * 0.999;
  let k = 1;
  if (d > reach) { k = 1; d = reach; }
  d = Math.max(d, Math.abs(a - b) + 1e-3);
  const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(a * a - along * along, 0));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0); perp.normalize();
  return out.copy(S).addScaledVector(dir, along).addScaledVector(perp, h);
};

// ------------------------------------------------------------------ props
export type PropK = "hammer" | "mallet" | "cane" | "roller" | "stopwatch" | "none"
  | "sledge" | "scroll" | "baton" | "jar" | "patty" | "straw" | "felt" | "rock" | "grain"
  // ---- Skull short ----
  | "smith" | "tongs" | "staff" | "spear" | "shield" | "sword" | "bread" | "brush" | "drill" | "stick" | "camera" | "phone" | "sack" | "bag"
  // ---- Pigs short ----
  | "mop" | "torch" | "torch0" | "pen" | "rope" | "bow" | "bucket";
/** the long pitch brush: grip at the origin, the bristle head's centre MOP_L x hh along +y */
export const MOP_L = 2.0;
/** the torch: grip at the origin, the flame's base TORCH_L x hh along +y */
export const TORCH_L = 0.95;
/** the reed pen: grip at the origin, the nib PEN_L x hh along -y (held nib-down) */
export const PEN_L = 0.32;
/** HDR flame material (unlit; values > 1 bloom) */
export const flameMat = (k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2 * k, 1.9 * k, 0.45 * k), toneMapped: false });
export const flameCore = (k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(6 * k, 5 * k, 2.2 * k), toneMapped: false });
/** the smith's hammer: grip at the origin, handle along +y, the head's centre at SMITH_HEAD x hh along the handle, its long
 *  axis along the prop's local z; the striking face is the +z end (SMITH_HALF x hh from the centre) */
export const SMITH_HEAD = 1.0, SMITH_HALF = 0.24;
/** the tongs: grip at the origin, the jaws' tip TONGS_L x hh along +y */
export const TONGS_L = 0.82;
/** the drill pen: grip at the origin, the bit's tip DRILL_L x hh along +y */
export const DRILL_L = 0.36;
/** the brush: grip at the origin, the bristle tips BRUSH_L x hh along +y */
export const BRUSH_L = 0.42;
/** the open peace scroll: cream paper, brush strokes, a red seal (front = +z) */
let scrollT: THREE.CanvasTexture | null = null;
const scrollTex = () => {
  if (scrollT) return scrollT;
  const c = mk(256, 384), g = c.getContext("2d")!;
  g.fillStyle = "#f4e8c8"; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#2b2430"; g.lineCap = "round"; g.lineJoin = "round";
  const col = (x: number, y0: number, n: number) => { for (let i = 0; i < n; i++) { const y = y0 + i * 58; g.lineWidth = 9; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x + 20, y - 4); g.moveTo(x, y - 18); g.lineTo(x - 4, y + 26); g.moveTo(x - 18, y + 22); g.quadraticCurveTo(x, y + 8, x + 18, y + 24); g.stroke(); } };
  col(170, 70, 4); col(96, 70, 3);
  g.fillStyle = "#c8302a"; g.fillRect(60, 270, 54, 54); g.strokeStyle = "#f4e8c8"; g.lineWidth = 5; g.strokeRect(70, 280, 34, 34);
  g.strokeStyle = "#8a6a3a"; g.lineWidth = 10; g.strokeRect(5, 5, 246, 374);
  scrollT = new THREE.CanvasTexture(c); scrollT.colorSpace = THREE.SRGBColorSpace; scrollT.anisotropy = 8;
  return scrollT;
};
const propGroup = (k: PropK, hh: number, hull: (m: THREE.Mesh, k?: number) => void): THREE.Group => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, col: string, p: V3, r: V3 = [0, 0, 0], ink = 0.6) => {
    const m = new THREE.Mesh(geo, toonMat(col)); m.position.set(...p); m.rotation.set(...r); m.castShadow = true; g.add(m); hull(m, ink); return m;
  };
  // props are built along local +y (the grip at the origin); the hand orients +y along the forearm direction or as posed
  if (k === "hammer" || k === "mallet") {
    add(new THREE.CylinderGeometry(0.035 * hh, 0.04 * hh, 1.3 * hh, 10), "#a8662e", [0, 0.45 * hh, 0]);
    const head = k === "mallet" ? new THREE.CylinderGeometry(0.17 * hh, 0.17 * hh, 0.52 * hh, 16) : new THREE.BoxGeometry(0.5 * hh, 0.22 * hh, 0.22 * hh);
    add(head, k === "mallet" ? "#b8622c" : "#8d939c", [0, 1.12 * hh, 0], k === "mallet" ? [0, 0, Math.PI / 2] : [0, 0, 0]);
  } else if (k === "cane") {
    add(new THREE.CylinderGeometry(0.03 * hh, 0.03 * hh, 2.1 * hh, 8), "#3a2416", [0, -0.9 * hh, 0]);
    add(new THREE.SphereGeometry(0.07 * hh, 12, 8), "#e3b341", [0, 0.12 * hh, 0]);
  } else if (k === "roller") {
    add(new THREE.CylinderGeometry(0.03 * hh, 0.03 * hh, 2.6 * hh, 8), "#6d7480", [0, 1.1 * hh, 0]);
    add(new THREE.CylinderGeometry(0.11 * hh, 0.11 * hh, 0.55 * hh, 14), "#e0287a", [0, 2.45 * hh, 0], [0, 0, Math.PI / 2]);
  } else if (k === "sledge") { // long-handled sledgehammer (the second hand grips lower down the handle)
    add(new THREE.CylinderGeometry(0.042 * hh, 0.05 * hh, 2.4 * hh, 10), "#a8662e", [0, 0.7 * hh, 0]);
    add(new THREE.BoxGeometry(0.78 * hh, 0.36 * hh, 0.36 * hh), "#5d636e", [0, 1.95 * hh, 0]);
    add(new THREE.BoxGeometry(0.16 * hh, 0.4 * hh, 0.4 * hh), "#7d848f", [0.36 * hh, 1.95 * hh, 0], [0, 0, 0], 0.4);
  } else if (k === "scroll") { // open hanging scroll held by its top rod: paper hangs along -y, front +z
    add(new THREE.CylinderGeometry(0.05 * hh, 0.05 * hh, 1.3 * hh, 10), "#7a4a26", [0, 0, 0], [0, 0, Math.PI / 2]);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(1.08 * hh, 1.5 * hh, 0.02 * hh), [toonMat("#f4e8c8"), toonMat("#f4e8c8"), toonMat("#f4e8c8"), toonMat("#f4e8c8"), toonMat("#ffffff", scrollTex()), toonMat("#efe1bd")]);
    paper.position.set(0, -0.8 * hh, 0); paper.castShadow = true; g.add(paper); hull(paper, 0.4);
    add(new THREE.CylinderGeometry(0.055 * hh, 0.055 * hh, 1.2 * hh, 10), "#7a4a26", [0, -1.58 * hh, 0], [0, 0, Math.PI / 2]);
  } else if (k === "baton") { // commander's baton: dark wood, gold caps, red horsetail tassel at the tip
    add(new THREE.CylinderGeometry(0.038 * hh, 0.045 * hh, 1.25 * hh, 10), "#4a2c1a", [0, 0.45 * hh, 0]);
    add(new THREE.SphereGeometry(0.075 * hh, 12, 8), "#e8c45a", [0, 1.1 * hh, 0], [0, 0, 0], 0.5);
    add(new THREE.SphereGeometry(0.065 * hh, 12, 8), "#e8c45a", [0, -0.18 * hh, 0], [0, 0, 0], 0.5);
    add(new THREE.ConeGeometry(0.13 * hh, 0.5 * hh, 12), "#d0342c", [0, 1.38 * hh, 0], [Math.PI, 0, 0], 0.6);
  } else if (k === "jar") { // small clay jar, base at the origin, mouth up (+y); dark inside
    const pr: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pr.push(new THREE.Vector2((0.17 + 0.17 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.87 ? 0.02 : 0)) * hh, t * 0.78 * hh)); }
    pr.push(new THREE.Vector2(0.15 * hh, 0.78 * hh));
    const jm = toonMat("#b8673a"); jm.side = THREE.DoubleSide;
    const j = new THREE.Mesh(new THREE.LatheGeometry(pr, 24), jm); j.castShadow = true; g.add(j); hull(j, 0.6);
    add(new THREE.CylinderGeometry(0.15 * hh, 0.15 * hh, 0.01 * hh, 20), "#2a1b26", [0, 0.72 * hh, 0], [0, 0, 0], 0);
    add(new THREE.CylinderGeometry(0.17 * hh, 0.19 * hh, 0.04 * hh, 20), "#2a1b26", [0, 0.0, 0], [0, 0, 0], 0);
    add(new THREE.TorusGeometry(0.33 * hh, 0.02 * hh, 6, 28), "#e7c08a", [0, 0.42 * hh, 0], [Math.PI / 2, 0, 0], 0);
  } else if (k === "patty") { // a dung patty on the palm
    add(new THREE.SphereGeometry(0.2 * hh, 14, 8), "#6b4a2a", [0, 0.12 * hh, 0], [0, 0, 0], 0.5).scale.set(1, 0.4, 1);
  } else if (k === "straw") { // wheat-straw bundle lying along x, centre at the origin
    add(new THREE.CylinderGeometry(0.3 * hh, 0.33 * hh, 1.5 * hh, 14), "#e3c35a", [0, 0, 0], [0, 0, Math.PI / 2]);
    for (const x of [-0.4, 0.4]) add(new THREE.TorusGeometry(0.32 * hh, 0.045 * hh, 6, 20), "#9a6a2a", [x * hh, 0, 0], [0, Math.PI / 2, 0], 0.3);
    for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.4 * hh, 0.3 * hh, 14, 1), "#f0d478", [sx * 0.85 * hh, 0, 0], [0, 0, sx * Math.PI / 2], 0.3);
  } else if (k === "felt") { // folded felt blanket (off-white, red border), centre at the origin
    add(new THREE.BoxGeometry(1.3 * hh, 0.3 * hh, 0.85 * hh), "#e6dcc4", [0, 0, 0]);
    add(new THREE.BoxGeometry(1.32 * hh, 0.07 * hh, 0.87 * hh), "#b8402e", [0, 0.06 * hh, 0], [0, 0, 0], 0);
  } else if (k === "rock") { // the old emperor's holey Taihu garden rock, centre at the origin
    const ge = new THREE.IcosahedronGeometry(0.62 * hh, 2), pa = ge.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), n = 1 + 0.16 * Math.sin(x * 31 + y * 17) * Math.cos(z * 23 - y * 11); pa.setXYZ(i, x * n, y * n * 1.25, z * n * 0.8); }
    ge.computeVertexNormals();
    add(ge, "#b9b8b0", [0, 0, 0]);
    for (const [x, y, z, r] of [[0.2, 0.25, 0.42, 0.12], [-0.22, -0.12, 0.44, 0.1], [0.05, -0.45, 0.38, 0.08]]) add(new THREE.SphereGeometry(r * hh, 10, 8), "#3a3438", [x * hh, y * hh, z * hh], [0, 0, 0], 0).scale.set(1, 1, 0.35);
  } else if (k === "grain") { // one (exaggerated) grain of millet
    add(new THREE.SphereGeometry(0.05 * hh, 10, 8), "#e8c050", [0, 0, 0], [0, 0, 0], 0.5).scale.set(0.8, 1.1, 0.8);
  } else if (k === "smith") { // blacksmith's cross hammer: ash handle, dark iron head across it (long axis = local z)
    add(new THREE.CylinderGeometry(0.035 * hh, 0.042 * hh, 1.15 * hh, 10), "#b07a3a", [0, 0.42 * hh, 0]);
    add(new THREE.BoxGeometry(0.2 * hh, 0.2 * hh, 0.4 * hh), "#4a4e58", [0, SMITH_HEAD * hh, -0.04 * hh]);
    add(new THREE.CylinderGeometry(0.11 * hh, 0.1 * hh, 0.08 * hh, 14), "#5d636e", [0, SMITH_HEAD * hh, (SMITH_HALF - 0.04) * hh], [Math.PI / 2, 0, 0], 0.5);
  } else if (k === "tongs") { // two long iron arms crossing at a rivet, jaws at +y
    for (const sx of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.02 * hh, 0.022 * hh, 0.62 * hh, 6), "#3f424a", [sx * 0.025 * hh, 0.28 * hh, 0], [0, 0, sx * 0.03], 0.5);
      add(new THREE.CylinderGeometry(0.022 * hh, 0.018 * hh, 0.24 * hh, 6), "#3f424a", [sx * 0.03 * hh, 0.7 * hh, 0], [0, 0, -sx * 0.12], 0.5);
    }
    add(new THREE.SphereGeometry(0.035 * hh, 8, 6), "#6a6e78", [0, 0.58 * hh, 0], [0, 0, 0], 0.4);
  } else if (k === "staff") { // traveller's staff: grip at the origin, 1.7 m of wood down (-y) and a bit up
    add(new THREE.CylinderGeometry(0.03 * hh, 0.034 * hh, 2.75 * hh, 8), "#8a5a2e", [0, -0.72 * hh, 0]);
    add(new THREE.SphereGeometry(0.05 * hh, 8, 6), "#6a4220", [0, 0.66 * hh, 0], [0, 0, 0], 0.5);
  } else if (k === "spear") { // spear (soliferrum-style): long shaft down, an iron leaf blade up
    add(new THREE.CylinderGeometry(0.026 * hh, 0.03 * hh, 4.0 * hh, 8), "#9a6a3a", [0, 0.3 * hh, 0]);
    add(new THREE.ConeGeometry(0.075 * hh, 0.42 * hh, 4), "#c8ced6", [0, 2.5 * hh, 0], [0, Math.PI / 4, 0], 0.5).scale.set(1, 1, 0.35);
    add(new THREE.CylinderGeometry(0.04 * hh, 0.04 * hh, 0.1 * hh, 8), "#5d636e", [0, 2.28 * hh, 0], [0, 0, 0], 0.4);
  } else if (k === "shield") { // small round Iberian caetra: disc in the prop's x-y plane (face +z), boss in the middle
    add(new THREE.CylinderGeometry(0.42 * hh, 0.42 * hh, 0.05 * hh, 28), "#b8402e", [0, 0, 0.04 * hh], [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.4 * hh, 0.03 * hh, 6, 28), "#e8d7a8", [0, 0, 0.07 * hh], [0, 0, 0], 0.3);
    add(new THREE.TorusGeometry(0.24 * hh, 0.02 * hh, 6, 24), "#e8d7a8", [0, 0, 0.07 * hh], [0, 0, 0], 0.2);
    add(new THREE.SphereGeometry(0.1 * hh, 12, 8), "#c9a24a", [0, 0, 0.08 * hh], [0, 0, 0], 0.4).scale.set(1, 1, 0.6);
  } else if (k === "sword") { // a sheathed curved falcata: grip at the origin (hooked pommel), the scabbard along -y, curving
    add(new THREE.TorusGeometry(0.06 * hh, 0.025 * hh, 6, 12, Math.PI * 1.3), "#7a4a26", [0, 0.06 * hh, 0], [0, 0, 0.6], 0.5);
    add(new THREE.CylinderGeometry(0.03 * hh, 0.03 * hh, 0.22 * hh, 8), "#5a3a20", [0, -0.05 * hh, 0], [0, 0, 0], 0.5);
    add(new THREE.BoxGeometry(0.16 * hh, 0.06 * hh, 0.08 * hh), "#c9a24a", [0, -0.17 * hh, 0], [0, 0, 0], 0.4);
    const sc = add(new THREE.CylinderGeometry(0.07 * hh, 0.05 * hh, 0.9 * hh, 10), "#4a3020", [0.04 * hh, -0.62 * hh, 0], [0, 0, 0.12]); sc.scale.set(1, 1, 0.45);
  } else if (k === "bread") { // a round loaf with a bite out of it
    add(new THREE.SphereGeometry(0.24 * hh, 16, 10), "#c98a3e", [0, 0.06 * hh, 0], [0, 0, 0], 0.6).scale.set(1, 0.72, 1);
    add(new THREE.SphereGeometry(0.1 * hh, 10, 8), "#f2dca8", [0.17 * hh, 0.1 * hh, 0.08 * hh], [0, 0, 0], 0).scale.set(0.6, 0.8, 0.7);
  } else if (k === "brush") { // soft archaeologist's brush: wooden handle, a tuft of bristles at +y
    add(new THREE.CylinderGeometry(0.03 * hh, 0.035 * hh, 0.3 * hh, 8), "#b8782e", [0, 0.1 * hh, 0], [0, 0, 0], 0.5);
    add(new THREE.CylinderGeometry(0.06 * hh, 0.045 * hh, 0.16 * hh, 10), "#e8d7a8", [0, 0.33 * hh, 0], [0, 0, 0], 0.5);
  } else if (k === "drill") { // micro-drill pen: a fat grey pen, a thin bit at +y
    add(new THREE.CylinderGeometry(0.045 * hh, 0.05 * hh, 0.32 * hh, 10), "#d8dce2", [0, 0.06 * hh, 0], [0, 0, 0], 0.5);
    add(new THREE.CylinderGeometry(0.05 * hh, 0.05 * hh, 0.06 * hh, 10), "#2f8fd0", [0, -0.06 * hh, 0], [0, 0, 0], 0.4);
    add(new THREE.CylinderGeometry(0.01 * hh, 0.006 * hh, 0.14 * hh, 6), "#9aa0a8", [0, 0.29 * hh, 0], [0, 0, 0], 0.3);
  } else if (k === "stick") { // old man's walking stick: crook handle at the grip, the stick down to the ground (-y)
    add(new THREE.CylinderGeometry(0.03 * hh, 0.03 * hh, 1.75 * hh, 8), "#7a4a26", [0, -0.85 * hh, 0]);
    add(new THREE.TorusGeometry(0.1 * hh, 0.03 * hh, 6, 12, Math.PI), "#7a4a26", [0.1 * hh, 0.02 * hh, 0], [0, 0, 0], 0.6);
  } else if (k === "camera") { // a chunky camera held in front of the face (lens toward +z)
    add(new THREE.BoxGeometry(0.42 * hh, 0.28 * hh, 0.18 * hh), "#2f3036", [0, 0.1 * hh, 0]);
    add(new THREE.CylinderGeometry(0.1 * hh, 0.11 * hh, 0.16 * hh, 14), "#4a4c54", [0.04 * hh, 0.1 * hh, 0.15 * hh], [Math.PI / 2, 0, 0], 0.5);
    add(new THREE.BoxGeometry(0.1 * hh, 0.05 * hh, 0.08 * hh), "#c8ccd2", [-0.12 * hh, 0.26 * hh, 0], [0, 0, 0], 0.3);
  } else if (k === "phone") { // a phone (screen toward -z = the holder, back toward +z)
    add(new THREE.BoxGeometry(0.18 * hh, 0.34 * hh, 0.03 * hh), "#22232a", [0, 0.12 * hh, 0]);
  } else if (k === "sack") { // a TIED cloth sack: held by its tied neck at the origin, the bag hangs along -y (closed, plain)
    add(new THREE.SphereGeometry(0.34 * hh, 16, 12), "#c8b48a", [0, -0.48 * hh, 0], [0, 0, 0], 0.7).scale.set(1, 1.15, 0.85);
    add(new THREE.ConeGeometry(0.1 * hh, 0.22 * hh, 10), "#c8b48a", [0, -0.1 * hh, 0], [Math.PI, 0, 0], 0.5);
    add(new THREE.TorusGeometry(0.075 * hh, 0.025 * hh, 6, 14), "#7a4a26", [0, -0.12 * hh, 0], [Math.PI / 2, 0, 0], 0.3);
    add(new THREE.SphereGeometry(0.06 * hh, 8, 6), "#c8b48a", [0, 0.02 * hh, 0], [0, 0, 0], 0.4);
  } else if (k === "mop") { // long-handled pitch brush: a pole, a black dripping bristle head at +y
    add(new THREE.CylinderGeometry(0.035 * hh, 0.04 * hh, (MOP_L + 0.6) * hh, 8), "#a8743a", [0, (MOP_L - 0.6) * hh / 2, 0]);
    add(new THREE.CylinderGeometry(0.06 * hh, 0.06 * hh, 0.1 * hh, 8), "#5a3a20", [0, (MOP_L - 0.18) * hh, 0], [0, 0, 0], 0.4);
    add(new THREE.SphereGeometry(0.2 * hh, 12, 8), "#1e1a22", [0, MOP_L * hh, 0], [0, 0, 0], 0.5).scale.set(1.2, 0.9, 0.7);
    add(new THREE.ConeGeometry(0.05 * hh, 0.16 * hh, 6), "#1e1a22", [0.06 * hh, (MOP_L + 0.17) * hh, 0], [Math.PI, 0, 0], 0.3);
  } else if (k === "torch" || k === "torch0") { // a wooden torch, pitch-wrapped head; "torch" carries an HDR flame
    add(new THREE.CylinderGeometry(0.04 * hh, 0.05 * hh, 1.2 * hh, 8), "#8a5a2e", [0, 0.3 * hh, 0]);
    add(new THREE.CylinderGeometry(0.1 * hh, 0.08 * hh, 0.26 * hh, 10), "#2a2228", [0, (TORCH_L - 0.08) * hh, 0], [0, 0, 0], 0.5);
    if (k === "torch") {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16 * hh, 0.62 * hh, 10), flameMat()); fl.position.set(0, (TORCH_L + 0.26) * hh, 0); g.add(fl);
      const fb = new THREE.Mesh(new THREE.SphereGeometry(0.15 * hh, 10, 8), flameMat()); fb.position.set(0, (TORCH_L + 0.06) * hh, 0); g.add(fb);
      const fc = new THREE.Mesh(new THREE.ConeGeometry(0.08 * hh, 0.32 * hh, 8), flameCore()); fc.position.set(0, (TORCH_L + 0.16) * hh, 0.02 * hh); g.add(fc);
      fl.renderOrder = fb.renderOrder = 2; fc.renderOrder = 3;
    } else add(new THREE.SphereGeometry(0.09 * hh, 8, 6), "#3a3438", [0, (TORCH_L + 0.04) * hh, 0], [0, 0, 0], 0.3);
  } else if (k === "pen") { // reed pen held nib-down (-y), a dark wet nib
    add(new THREE.CylinderGeometry(0.022 * hh, 0.026 * hh, 0.5 * hh, 6), "#c8a050", [0, -0.05 * hh, 0], [0, 0, 0], 0.4);
    add(new THREE.ConeGeometry(0.022 * hh, 0.08 * hh, 6), "#2a1b26", [0, -(PEN_L - 0.02) * hh, 0], [Math.PI, 0, 0], 0.3);
  } else if (k === "rope") { // a short length of rope in the fist (along +y and -y) + a coil hanging below
    add(new THREE.CylinderGeometry(0.03 * hh, 0.03 * hh, 0.9 * hh, 6), "#cdb88a", [0, 0, 0], [0, 0, 0], 0.4);
    add(new THREE.TorusGeometry(0.2 * hh, 0.03 * hh, 6, 18), "#bba676", [0, -0.62 * hh, 0], [0, 0, 0.3], 0.4);
  } else if (k === "bow") { // a recurved bow held at its grip (vertical along y)
    add(new THREE.TorusGeometry(0.75 * hh, 0.03 * hh, 6, 20, Math.PI * 0.8), "#6a4220", [-0.62 * hh, 0, 0], [0, 0, -Math.PI * 0.4], 0.5);
  } else if (k === "bucket") { // a wooden bucket held by its handle (the pail hangs along -y)
    add(new THREE.CylinderGeometry(0.26 * hh, 0.21 * hh, 0.44 * hh, 14), "#8a5a2e", [0, -0.42 * hh, 0], [0, 0, 0], 0.6);
    add(new THREE.CylinderGeometry(0.235 * hh, 0.235 * hh, 0.02 * hh, 14), "#1e1a22", [0, -0.21 * hh, 0], [0, 0, 0], 0);
    add(new THREE.TorusGeometry(0.24 * hh, 0.015 * hh, 4, 16, Math.PI), "#4a4e58", [0, -0.2 * hh, 0], [0, 0, 0], 0.3);
  } else if (k === "bag") { // traveller's shoulder bag: the strap's anchor at the origin, the bag hangs along -y
    add(new THREE.BoxGeometry(0.4 * hh, 0.34 * hh, 0.16 * hh), "#8a5a32", [0, -0.2 * hh, 0], [0, 0, 0], 0.6);
    add(new THREE.BoxGeometry(0.42 * hh, 0.12 * hh, 0.18 * hh), "#6a4224", [0, -0.08 * hh, 0.01 * hh], [0, 0, 0], 0.4);
  } else if (k === "stopwatch") {
    add(new THREE.CylinderGeometry(0.2 * hh, 0.2 * hh, 0.07 * hh, 24), "#f2f2f2", [0, 0.24 * hh, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.04 * hh, 0.04 * hh, 0.08 * hh, 8), "#c8ccd2", [0, 0.47 * hh, 0]);
  }
  return g;
};

/** a standalone prop (with its ink hulls) for set dressing outside a character (e.g. a mop standing in a bucket) */
export const makeProp = (k: PropK, hh: number): THREE.Group => {
  const g = propGroup(k, hh, (m, kk) => { const h = new THREE.Mesh(m.geometry, hullMat(hh, kk ?? 0.6)); h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale); m.parent!.add(h); });
  g.traverse((o) => o.layers.set(NOINK));
  return g;
};
// ------------------------------------------------------------------ the character
export type CharSpec = {
  build?: keyof typeof BUILDS; head?: string; outfit: Outfit; hat?: Hat; blush?: boolean; prop?: PropK; propHand?: "L" | "R";
  /** hand style when gripping the prop: ink ball (default) or a fingered glove (hero props such as a gun) */
  grip?: "ball" | "glove"; scale?: number;
  /** facial hair painted on the face decal */
  beard?: Beard;
  /** several props, each on a hand (shown only while listed in Pose.props); `spec.prop` stays the always-on legacy prop */
  props?: { k: PropK; hand: "L" | "R" }[];
  /** lab goggles (lens rim colour); Pose.goggles puts them over the eyes or up on the brow */
  goggles?: string;
};
/** hand target in BODY space (default), or in ROOT space (`root: true`: exact for lean / crouch / bob, use for contacts) */
export type ArmPose = { hand: V3; pole?: V3; root?: boolean };
/** a prop's pose: on its hand (dir = axis in body space, or root space with `root`), or placed free at `at` (root space,
 *  `dir` = its up axis) when it is put down / carried two-handed */
export type PropPose = { dir?: V3; ang?: number; roll?: number; spin?: number; at?: V3; root?: boolean };
export type Pose = {
  pos: V3; yaw: number; lean?: number; tilt?: number; bob?: number;
  head?: { yaw?: number; pitch?: number; roll?: number };
  armL?: ArmPose; armR?: ArmPose;
  /** walk phase in cycles (planted feet need stride = speed x frames per cycle) or explicit feet */
  walk?: { phase: number; stride: number; lift?: number };
  feet?: { L: V3; R: V3 };
  crouch?: number;
  face: Expr; headCol?: string;
  /** prop rotation about the hand (radians, around the character's local x): 0 = along +y */
  propAng?: number; propRoll?: number;
  /** explicit prop axis in body space (wins over the forearm + propAng rule), e.g. hand -> target for a hit */
  propDir?: V3;
  /** spec.props shown this frame (absent key = hidden) */
  props?: Partial<Record<PropK, PropPose>>;
  /** the hat lifted off the head (head-local metres) + spun (rad about x / z), e.g. flying off in a take or tipped back */
  hatOff?: { x?: number; y?: number; z?: number; rx?: number; rz?: number; hide?: boolean };
  /** goggles over the eyes (default) or pushed up on the brow */
  goggles?: "eyes" | "up";
};

// ------------------------------------------------------------------ 3D face FX (steam, dizzy stars, tear droplets)
/** secondary FX on the head, switched by the expression (Expr.steam / stars / tears "spray") and animated by its age
 *  Expr.t (frames since the expression started, from exprTrack): they appear with the expression and vanish with it.
 *  Head-local space (origin = head centre, +z = the face). On ones, like the acting. */
class FaceFX {
  readonly group = new THREE.Group();
  // every animated piece is a group holding the mesh + its ink hull (the hull is a sibling with a static transform)
  private puffs: THREE.Group[] = []; private stars: THREE.Group[] = []; private drops: THREE.Group[] = [];
  constructor(private R: number, private W: number, private crown: number, hull: (m: THREE.Mesh, k?: number) => void) {
    const white = toonMat("#ffffff");
    for (let i = 0; i < 6; i++) { // steam: 3 puffs a side, each a cluster of 3 balls
      const p = new THREE.Group(); this.group.add(p);
      for (const [x, y, z, r] of [[0, 0, 0, 1], [0.6, 0.3, 0.12, 0.68], [-0.5, 0.36, -0.12, 0.6]]) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), white); m.position.set(x, y, z); p.add(m); hull(m, 0.42);
      }
      p.visible = false; this.puffs.push(p);
    }
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? 0.46 : 1; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
    eg.center(); eg.deleteAttribute("uv"); eg.deleteAttribute("normal");
    const sg = mergeVertices(eg, 1e-4); sg.computeVertexNormals();
    const gold = toonMat("#ffd23a");
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(), m = new THREE.Mesh(sg, gold); g.add(m); this.group.add(g); hull(m, 0.4); g.visible = false; this.stars.push(g); }
    const tear = toonMat(TEAR), dg = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 6; i++) { const g = new THREE.Group(), m = new THREE.Mesh(dg, tear); g.add(m); this.group.add(g); hull(m, 0.35); g.visible = false; this.drops.push(g); }
  }
  update(e: Expr) {
    const t = e.t ?? 9, R = this.R, W = this.W;
    // steam: vents just above the ear line, puffs jet out sideways then curl up; a 12 f cycle per side, puffs 4 f apart
    for (let i = 0; i < 6; i++) {
      const p = this.puffs[i], s = i < 3 ? -1 : 1, off = (i % 3) * 4 + (s > 0 ? 2 : 0);
      if (!e.steam || t < off) { p.visible = false; continue; }
      const u = ((t - off) % 12) / 12, out = 1.15 * R * (1 - (1 - u) ** 2), up = 0.95 * R * u * u;
      const sc = R * 0.2 * (0.55 + 1.1 * u) * (u > 0.72 ? Math.max(0, (1 - u) / 0.28) : 1);
      p.position.set(s * (0.97 * R * W + out * 0.92), 0.22 * R + out * 0.38 + up, -0.05 * R);
      p.rotation.set(0, 0, s * u * 0.8); p.scale.setScalar(Math.max(sc, 1e-4)); p.visible = sc > R * 0.01;
    }
    // dizzy: 4 stars on a tilted ellipse over the crown, one turn every 22 f, each spinning
    this.stars.forEach((m, i) => {
      m.visible = !!e.stars; if (!e.stars) return;
      const a = (t / 22) * TAU + (i / this.stars.length) * TAU;
      m.position.set(Math.cos(a) * 0.95 * R * W, this.crown + 0.2 * R + Math.sin(a) * 0.14 * R, Math.sin(a) * 0.72 * R);
      m.rotation.set(0.15, 0.55 * Math.sin(t * 0.35 + i * 1.7), t * 0.22 + i); m.scale.setScalar(R * 0.15); // face front, wobble + spin in plane
    });
    // laugh-cry: droplets arc out of the outer eye corners, past the head outline (3 a side, 9 f cycle)
    const lon = (21.5 * Math.PI) / 180, spray = e.tears === "spray";
    this.drops.forEach((m, i) => {
      const s = i < 3 ? -1 : 1, off = (i % 3) * 3;
      if (!spray || t < off) { m.visible = false; return; }
      const u = ((t - off) % 9) / 9;
      m.position.set(s * Math.sin(lon) * R * W * 1.02 + s * 1.15 * R * u, 0.03 * R + 0.6 * R * u - 1.2 * R * u * u, Math.cos(lon) * R * 1.02 + 0.35 * R * u);
      m.scale.set(0.075 * R, 0.1 * R, 0.075 * R).multiplyScalar(1 - 0.35 * u); m.rotation.z = s * (0.6 - 2.2 * u); m.visible = u < 0.92;
    });
  }
}

export class Toon3D {
  readonly root = new THREE.Group();
  readonly B: Build; readonly hh: number;
  /** head FX (steam, stars, tear droplets) */
  private fx!: FaceFX;
  private tintC = new THREE.Color();
  private body = new THREE.Group();      // lean / bob pivot at the hips
  private headG = new THREE.Group();
  /** the hat (or hair) lives in its own group so it can fly off / tip back (Pose.hatOff) */
  private hatG = new THREE.Group();
  private goggles: THREE.Group | null = null;
  private cuffs: THREE.Mesh[] = [];
  private faceMat: THREE.MeshBasicMaterial;
  private headMat: THREE.MeshLambertMaterial;
  private arms: [Limb, Limb]; private legs: [Limb, Limb];
  private hands: [THREE.Mesh, THREE.Mesh]; private feet: [THREE.Mesh, THREE.Mesh];
  private prop: THREE.Group | null = null;
  private extra: { k: PropK; hand: "L" | "R"; g: THREE.Group }[] = [];
  private thumb: THREE.Mesh | null = null;
  private torsoTop: number; private hipY: number; private headY: number;
  constructor(public spec: CharSpec) {
    const B = (this.B = { ...BUILDS[spec.build ?? "adult"] });
    const s = spec.scale ?? 1;
    const hh = (this.hh = B.hh * s);
    const hull = (m: THREE.Mesh, k = 1) => { const h = new THREE.Mesh(m.geometry, hullMat(hh, k)); h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale); h.renderOrder = -1; m.parent!.add(h); };
    this.root.add(this.body);
    this.hipY = B.legL * hh;
    const torsoBot = this.hipY - 0.1 * hh, torsoTop = (this.torsoTop = torsoBot + B.torsoH * hh);
    // torso: lathe bean, wider at the bottom, superellipse-rounded ends, front at +z (u = .5)
    const prof: THREE.Vector2[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = THREE.MathUtils.lerp(B.botW, B.topW, Math.pow(t, 1.3)) * 0.5 * hh;
      const e = Math.pow(Math.max(1 - Math.pow(Math.abs(2 * t - 1), 3.2), 0), 1 / 3.2);
      prof.push(new THREE.Vector2(Math.max(w * e, 1e-4), torsoBot + t * (torsoTop - torsoBot)));
    }
    const tg = new THREE.LatheGeometry(prof, 40, Math.PI, Math.PI * 2);
    tg.scale(1, 1, B.depth);
    const torso = new THREE.Mesh(tg, toonMat("#ffffff", clothTex(spec.outfit)));
    torso.castShadow = true; torso.receiveShadow = true;
    this.body.add(torso); hull(torso);
    // robe skirt: flares from inside the bean's lower part down over the legs to the hem (open, double-sided)
    if (spec.outfit.robe) {
      const t0 = 0.16, y0 = torsoBot + t0 * (torsoTop - torsoBot), r0 = THREE.MathUtils.lerp(B.botW, B.topW, Math.pow(t0, 1.3)) * 0.5 * hh * 0.97;
      const yH = this.hipY - (spec.outfit.robeLen ?? 0.5) * B.legL * hh, rH = B.botW * 0.5 * hh * (1.08 + 0.25 * (spec.outfit.robeLen ?? 0.5));
      const sp: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; sp.push(new THREE.Vector2(r0 + (rH - r0) * Math.pow(t, 0.8), y0 + (yH - y0) * t)); }
      const sg = new THREE.LatheGeometry(sp.reverse(), 40, Math.PI, Math.PI * 2);
      // (points bottom -> top like the torso: uv v 0 = hem = the canvas bottom, where the hem trim is painted)
      sg.scale(1, 1, B.depth * 1.04);
      const sm = toonMat("#ffffff", skirtTex(spec.outfit)); sm.side = THREE.DoubleSide;
      const skirt = new THREE.Mesh(sg, sm); skirt.castShadow = true; skirt.receiveShadow = true;
      this.body.add(skirt); hull(skirt, 0.8);
    }
    // head: squashed sphere on the torso (no neck), face decal patch just above its surface
    this.headY = torsoTop + 0.36 * hh;
    this.headG.position.set(0, this.headY, 0.02 * hh);
    this.body.add(this.headG);
    this.headMat = toonMat(spec.head ?? "#ffffff");
    const hg = new THREE.SphereGeometry(0.5 * hh, 40, 28);
    const head = new THREE.Mesh(hg, this.headMat);
    head.scale.set(B.headW, 1, 0.98); head.castShadow = true; head.receiveShadow = true;
    this.headG.add(head); hull(head);
    const toR = Math.PI / 180;
    const fg = new THREE.SphereGeometry(0.5 * hh * 1.004, 48, 32, Math.PI / 2 - LON * toR, 2 * LON * toR, (90 - LAT0) * toR, (LAT0 - LAT1) * toR);
    this.faceMat = new THREE.MeshBasicMaterial({ map: faceTex(EXPR.neutral), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const face = new THREE.Mesh(fg, this.faceMat);
    face.scale.copy(head.scale); face.renderOrder = 2;
    this.headG.add(face);
    this.headG.add(this.hatG);
    this.buildHat(spec.hat ?? { k: "none" }, hull);
    { // face FX: the stars orbit just over the hat's top (head-local)
      this.root.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(this.hatG), top = bb.isEmpty() ? 0.5 * hh : Math.max(0.5 * hh, bb.max.y - this.headY);
      this.fx = new FaceFX(0.5 * hh, B.headW, top, hull); this.headG.add(this.fx.group);
    }
    if (spec.goggles) { // lab goggles: two lenses + a strap round the head (posed over the eyes or pushed up on the brow)
      const G = (this.goggles = new THREE.Group()); this.headG.add(G);
      const R = 0.5 * hh, W = B.headW;
      const strap = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, R * 0.05, 6, 40), toonMat("#3a3f4a")); strap.rotation.x = Math.PI / 2; strap.scale.set(W, 1, 1); G.add(strap); hull(strap, 0.4);
      for (const sx of [-1, 1]) {
        const ln = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.24, R * 0.26, R * 0.16, 18), toonMat(spec.goggles));
        ln.rotation.x = Math.PI / 2; ln.position.set(sx * R * 0.33, 0, R * 0.96); G.add(ln); hull(ln, 0.5);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(R * 0.2, 18), new THREE.MeshBasicMaterial({ color: "#bfe6f2" })); gl.position.set(sx * R * 0.33, 0, R * 1.05); G.add(gl);
      }
    }
    if (spec.outfit.cloak) { // a cloak: a half shell behind the torso from the shoulders to the knees, open at the front
      const top = torsoTop - 0.12 * hh, bot = this.hipY - 0.55 * B.legL * hh, cp: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; cp.push(new THREE.Vector2((B.topW * 0.5 * hh * 1.08) + t * (B.botW * 0.5 * hh * 1.25 - B.topW * 0.5 * hh * 1.08) + 0.02 * hh, bot + (top - bot) * (1 - t))); }
      const cg = new THREE.LatheGeometry(cp.reverse(), 24, Math.PI * 0.42, Math.PI * 1.16); cg.scale(1, 1, B.depth * 1.15);
      const cm = toonMat("#ffffff", cloakTex(spec.outfit)); cm.side = THREE.DoubleSide;
      const cloak = new THREE.Mesh(cg, cm); cloak.castShadow = true; cloak.receiveShadow = true; this.body.add(cloak); hull(cloak, 0.7);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.06 * hh, 10, 8), toonMat("#c9a24a")); pin.position.set(B.topW * 0.5 * hh * 0.9, top - 0.02 * hh, 0.12 * hh); this.body.add(pin); hull(pin, 0.4);
    }
    // limbs
    const ink = inkBasic();
    const lr = (B.limbW * hh) / 2;
    this.arms = [new Limb(lr, ink), new Limb(lr, ink)];
    this.legs = [new Limb(lr * 1.05, ink), new Limb(lr * 1.05, ink)];
    for (const l of [...this.arms, ...this.legs]) this.body.add(l.mesh);
    const handG = new THREE.SphereGeometry(B.handR * hh, 16, 12);
    this.hands = [new THREE.Mesh(handG, ink), new THREE.Mesh(handG, ink)];
    const footG = new THREE.SphereGeometry(0.5, 16, 10);
    this.feet = [new THREE.Mesh(footG, ink), new THREE.Mesh(footG, ink)];
    for (const m of [...this.hands, ...this.feet]) { m.castShadow = true; this.body.add(m); }
    for (const f of this.feet) f.scale.set(B.footL * hh * 0.55, B.footL * hh * 0.42, B.footL * hh);
    if (spec.outfit.sleeves) for (let i = 0; i < 2; i++) { // short sleeves rolled up: a cloth cuff on each upper arm
      const cf = new THREE.Mesh(new THREE.CylinderGeometry(B.limbW * hh * 1.25, B.limbW * hh * 1.45, 0.3 * hh, 12), toonMat(spec.outfit.sleeves));
      cf.castShadow = true; this.body.add(cf); hull(cf, 0.5); this.cuffs.push(cf);
    }
    if (spec.grip === "glove") { // hero-prop grip: a bigger fist + a thumb wrapped over the handle
      this.thumb = new THREE.Mesh(new THREE.SphereGeometry(B.handR * hh * 0.55, 12, 8), ink); this.thumb.castShadow = true; this.body.add(this.thumb);
    }
    if (spec.prop && spec.prop !== "none") {
      this.prop = propGroup(spec.prop, hh, (m, k) => { const h = new THREE.Mesh(m.geometry, hullMat(hh, k ?? 0.6)); h.position.copy(m.position); h.rotation.copy(m.rotation); m.parent!.add(h); });
      this.body.add(this.prop);
    }
    for (const pr of spec.props ?? []) {
      const g = propGroup(pr.k, hh, (m, k) => { const h = new THREE.Mesh(m.geometry, hullMat(hh, k ?? 0.6)); h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale); m.parent!.add(h); });
      this.body.add(g); this.extra.push({ k: pr.k, hand: pr.hand, g });
    }
    this.root.traverse((o) => o.layers.set(NOINK));
  }
  /** a world point -> this character's ROOT space (after pos + yaw; pair with ArmPose.root / PropPose.root) */
  toRoot(w: V3, pos: V3, yaw: number): V3 {
    const dx = w[0] - pos[0], dz = w[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
    return [dx * c - dz * s, w[1] - pos[1], dx * s + dz * c];
  }
  /** a world direction -> root space */
  dirToRoot(d: V3, yaw: number): V3 { const c = Math.cos(yaw), s = Math.sin(yaw); return [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c]; }

  private buildHat(h: Hat, hull: (m: THREE.Mesh, k?: number) => void) {
    const hh = this.hh, G = this.hatG, W = this.B.headW;
    /** a hat part: colour, or a detail texture (hatTex, already coloured) */
    const mat = (col: string, tex?: HatTexK, n?: number) => (tex ? toonMat("#ffffff", hatTex(tex, col, n)) : toonMat(col));
    const into = (P: THREE.Object3D) => (geo: THREE.BufferGeometry, col: string, p: V3, r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1], k = 0.8, tex?: HatTexK, n?: number) => {
      const m = new THREE.Mesh(geo, mat(col, tex, n)); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; P.add(m); hull(m, k); return m;
    };
    const add = into(G);
    const R = 0.5 * hh;
    /** studs along a ring (the helmet rim): angles round the front (0 = front), in a group's space */
    const studs = (put: ReturnType<typeof into>, col: string, rx: number, rz: number, y: number, n: number, span: number, r = 0.055) => {
      for (let i = 0; i < n; i++) { const a = -span + (2 * span * i) / (n - 1); put(new THREE.SphereGeometry(R * r, 8, 6), col, [Math.sin(a) * rx, y, Math.cos(a) * rz], [0, 0, 0], [1, 1, 1], 0.3); }
    };
    /** the fringe of hair round the back + sides (bald crowns): a sphere band with a wide gap at the front so it never
     *  reaches the face (the old 0.24 pi gap ran over the eyes) */
    const fringe = (col: string) => {
      const gap = Math.PI * 0.36;
      add(new THREE.SphereGeometry(R * 1.04, 40, 10, Math.PI / 2 + gap, Math.PI * 2 - 2 * gap, Math.PI * 0.36, Math.PI * 0.24), col, [0, 0, -0.01 * hh], [0, 0, 0], [W, 1, 1], 0.6, "hair");
    };
    switch (h.k) {
      case "cap": {
        // crown: 6 stitched panels + a top button; front rim at ~0.5 R (just above the brows), back rim lower; short dark visor
        add(new THREE.SphereGeometry(R * 1.05, 36, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), h.col, [0, 0.05 * hh, 0], [-0.1, 0, 0], [W, 1.1, 1.02], 0.8, "panels", 6);
        add(new THREE.SphereGeometry(R * 0.11, 12, 8), h.col, [0, 0.05 * hh + R * 1.15 * Math.cos(0.1), -R * 1.15 * Math.sin(0.1)], [0, 0, 0], [1.1, 0.7, 1.1], 0.4);
        add(new THREE.CylinderGeometry(R * 0.8, R * 0.82, 0.05 * hh, 24, 1, false, -Math.PI / 2, Math.PI), "#1b2340", [0, 0.25 * hh, 0.27 * hh], [0.14, 0, 0], [W * 0.95, 1, 0.85], 0.8, "felt"); // visor
        if (h.badge) add(new THREE.SphereGeometry(0.055 * hh, 10, 8), h.badge, [0, 0.37 * hh, 0.43 * hh], [-0.5, 0, 0], [1, 1, 0.4], 0.5);
        break;
      }
      case "bowler":
        add(new THREE.SphereGeometry(R * 0.86, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), h.col, [0, 0.3 * hh, 0], [0, 0, 0], [W, 0.9, 1], 0.8, "felt");
        add(new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.05 * hh, 28), h.col, [0, 0.3 * hh, 0], [0, 0, 0], [W, 1, 1], 0.8, "felt");
        break;
      case "top":
        add(new THREE.CylinderGeometry(R * 0.62, R * 0.66, 0.85 * hh, 24), h.col, [0, 0.72 * hh, 0], [0, 0, 0], [1, 1, 1], 0.8, "felt");
        add(new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.05 * hh, 28), h.col, [0, 0.32 * hh, 0], [0, 0, 0], [W, 1, 1]);
        if (h.band) add(new THREE.CylinderGeometry(R * 0.665, R * 0.665, 0.12 * hh, 24), h.band, [0, 0.42 * hh, 0], [0, 0, 0], [1, 1, 1], 0.3);
        break;
      case "newsboy":
        add(new THREE.SphereGeometry(R * 1.1, 36, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), h.col, [0, 0.06 * hh, -0.04 * hh], [-0.18, 0, 0], [W * 1.02, 0.85, 1.05], 0.8, "panels", 8);
        add(new THREE.SphereGeometry(R * 0.12, 12, 8), h.col, [0, 0.06 * hh + R * 0.95 * Math.cos(0.18), -0.04 * hh - R * 0.95 * Math.sin(0.18)], [0, 0, 0], [1.1, 0.65, 1.1], 0.4);
        add(new THREE.CylinderGeometry(R * 0.6, R * 0.62, 0.04 * hh, 20, 1, false, -Math.PI / 2, Math.PI), h.col, [0, 0.22 * hh, 0.3 * hh], [0.25, 0, 0], [W * 0.9, 1, 0.55], 0.8, "felt");
        break;
      case "hair":
        add(new THREE.SphereGeometry(R * 1.05, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), h.col, [0, 0.02 * hh, -0.05 * hh], [-0.42, 0, 0], [W, 1, 1], 0.8, "hair");
        if (h.curly) for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new THREE.SphereGeometry(R * 0.26, 14, 10), h.col, [Math.cos(a) * R * 0.62 * W, R * 0.78, Math.sin(a) * R * 0.5 - 0.06 * hh], [0, a, 0], [1, 0.8, 1], 0.6, "curls"); }
        break;
      case "chef":
        add(new THREE.CylinderGeometry(R * 0.78, R * 0.7, 0.55 * hh, 24), "#ffffff", [0, 0.55 * hh, 0], [0, 0, 0], [1, 1, 1], 0.8, "band");
        add(new THREE.SphereGeometry(R * 0.95, 24, 14), "#ffffff", [0, 0.92 * hh, 0], [0, 0, 0], [1.05, 0.7, 1.05]);
        break;
      case "mongol": {
        // everything in a sub-group tipped back 0.14 rad: the fur brim's front rim sits at ~0.55 R (brows at 0.29 R)
        const T = new THREE.Group(); T.position.set(0, 0.47 * R, -0.04 * R); T.rotation.x = -0.14; G.add(T);
        const put = into(T), fur = h.fur ?? "#7a5233";
        const pr: THREE.Vector2[] = [[0.8, 0], [0.84, 0.22], [0.78, 0.5], [0.6, 0.78], [0.34, 0.98], [0.12, 1.08], [0.001, 1.1]].map(([r, y]) => new THREE.Vector2(r * R, y * R));
        put(new THREE.LatheGeometry(pr, 28), h.col, [0, 0.02 * R, 0], [0, 0, 0], [W, 1, 1], 0.8, "panels", 4);
        put(new THREE.TorusGeometry(R * 0.9, R * 0.21, 12, 36), fur, [0, 0, 0], [Math.PI / 2, 0, 0], [W * 1.02, 1.02, 1], 0.8, "fur");
        put(new THREE.SphereGeometry(R * 0.13, 12, 8), h.knob ?? "#e8c45a", [0, 1.14 * R, 0], [0, 0, 0], [1, 1, 1], 0.5);
        for (const sx of [-1, 1]) put(new THREE.SphereGeometry(R, 16, 10), fur, [sx * 1.0 * R * W, -0.62 * R, -0.12 * R], [0.1, 0, sx * 0.08], [0.17, 0.5, 0.36], 0.6, "fur"); // ear flaps
        break;
      }
      case "jinhelm": {
        const T = new THREE.Group(); T.position.set(0, 0.4 * R, -0.03 * R); T.rotation.x = -0.1; G.add(T);
        const put = into(T), iron = h.col ?? "#8d96a3", guard = h.guard ?? "#5b4636";
        put(new THREE.SphereGeometry(R * 1.04, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), iron, [0, 0, 0], [0, 0, 0], [W, 1.0, 1.0], 0.8, "metal");
        put(new THREE.TorusGeometry(R * 1.04, R * 0.075, 8, 36), "#c9a24a", [0, 0.02 * R, 0], [Math.PI / 2, 0, 0], [W, 1, 1], 0.5);
        studs(put, "#e8c45a", R * 1.1 * W, R * 1.1, 0.02 * R, 9, 1.7);
        put(new THREE.CylinderGeometry(0.06 * R, 0.1 * R, 0.4 * R, 8), "#c9a24a", [0, 1.12 * R, 0], [0, 0, 0], [1, 1, 1], 0.5);
        put(new THREE.SphereGeometry(0.4 * R, 16, 10), h.tassel ?? "#d23a2e", [0, 1.12 * R, 0], [0, 0, 0], [1.05, 0.55, 1.05], 0.6, "crest"); // red horsehair tassel
        put(new THREE.SphereGeometry(0.1 * R, 10, 8), "#c9a24a", [0, 1.36 * R, 0], [0, 0, 0], [1, 1, 1], 0.4);
        for (let i = 0; i < 5; i++) { // neck-guard flaps round the back and sides
          const a = Math.PI * (0.62 + (i / 4) * 0.76), x = Math.sin(a) * 1.0 * R * W, z = Math.cos(a) * 1.0 * R;
          const m = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8), toonMat(guard)); m.position.set(x, -0.42 * R, z); m.rotation.set(-0.22, a, 0, "YXZ");
          m.scale.set(0.42, 0.5, 0.09); m.castShadow = true; T.add(m); hull(m, 0.5);
        }
        break;
      }
      case "futou": {
        const col = h.col ?? "#1d1a22";
        const T = new THREE.Group(); T.position.set(0, 0.42 * R, -0.04 * R); T.rotation.x = -0.12; G.add(T);
        const put = into(T);
        put(new THREE.SphereGeometry(R * 1.03, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), col, [0, 0, 0], [0, 0, 0], [W, 0.78, 1.0], 0.8, "felt");
        put(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.16 * R, 32), col, [0, 0.0, 0], [0, 0, 0], [W, 1, 1], 0.6);
        put(new THREE.SphereGeometry(R * 0.55, 20, 12), col, [0, 0.78 * R, -0.25 * R], [0, 0, 0], [W * 1.1, 1.0, 0.8], 0.8, "felt");    // raised rear lobe
        for (const sx of [-1, 1]) put(new THREE.BoxGeometry(1.55 * hh, 0.05 * hh, 0.13 * hh), col, [sx * (0.62 * R * W + 0.78 * hh), 0.62 * R, -0.42 * R], [0, 0, sx * 0.04], [1, 1, 1], 0.45); // wings
        break;
      }
      case "headband": case "tuft": {
        add(new THREE.SphereGeometry(R * 1.05, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), h.col, [0, 0.02 * hh, -0.05 * hh], [-0.42, 0, 0], [W, 1, 1], 0.8, "hair");
        if (h.k === "tuft") { add(new THREE.ConeGeometry(R * 0.2, R * 0.5, 8), h.col, [0.03 * hh, R * 1.12, 0.04 * hh], [0.3, 0, -0.35], [1, 1, 1], 0.5); break; }
        // the band: a squashed torus round the brow line (front rim ~0.5 R), tilted with the hair line; tails at the back
        add(new THREE.TorusGeometry(R * 1.0, R * 0.075, 8, 40), h.band, [0, 0.4 * R, -0.03 * R], [Math.PI / 2 - 0.2, 0, 0], [W * 1.0, 1.0, 1.0], 0.5, "band");
        for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.07 * hh, 0.28 * hh, 0.03 * hh), h.band, [sx * 0.05 * hh, 0.08 * R, -1.0 * R], [-0.25, 0, sx * 0.25], [1, 1, 1], 0.4);
        break;
      }
      case "bald": fringe(h.col); break;
      case "kausia": { // a flat wide beret: a puffy felt disc wider than the head (stitched seam round its rim) + the diadem band
        const T = new THREE.Group(); T.position.set(0, 0.62 * R, -0.06 * R); T.rotation.x = -0.1; G.add(T);
        const put = into(T);
        put(new THREE.SphereGeometry(R * 1.32, 40, 16), h.col, [0, 0.18 * R, 0], [0, 0, 0], [W, 0.36, 1.08], 0.8, "felt");
        put(new THREE.CylinderGeometry(R * 0.98, R * 1.0, 0.3 * R, 32), h.col, [0, -0.04 * R, 0], [0, 0, 0], [W, 1, 1], 0.6, "felt");
        const dc = h.diadem ?? "#f6f2e8";
        put(new THREE.TorusGeometry(R * 1.0, R * 0.075, 8, 48), dc, [0, -0.1 * R, 0], [Math.PI / 2, 0, 0], [W * 1.01, 1.0, 1.0], 0.4, "diadem");
        for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.08 * hh, 0.42 * hh, 0.025 * hh), dc, [sx * 0.07 * hh, -0.42 * R, -1.02 * R], [-0.2, 0, sx * 0.22], [1, 1, 1], 0.4);
        break;
      }
      case "laurel": {
        fringe(h.col);
        const lc = h.leaf ?? "#4f8a3a", n = 22;
        for (let i = 0; i < n; i++) { // leaves round the crown, both sides (a gap at the front); v2: raised to 0.56 R so the
          // wreath sits on the crown above the brows (at 0.42 R its leaves hid the brows in every close-up)
          const a = (i / n) * Math.PI * 2; if (Math.abs(Math.sin(a / 2)) < 0.14) continue;
          add(new THREE.SphereGeometry(R * 0.2, 10, 6), i % 2 ? lc : "#6aa84a", [Math.sin(a) * R * 0.88 * W, 0.56 * R + (i % 2) * 0.05 * R, Math.cos(a) * R * 0.85], [0, a + Math.PI / 2, 0.5 * (i % 2 ? 1 : -1)], [1.0, 0.42, 0.5], 0.4);
        }
        break;
      }
      case "romhelm": case "greekhelm": {
        const T = new THREE.Group(); T.position.set(0, 0.38 * R, -0.03 * R); T.rotation.x = -0.1; G.add(T);
        const put = into(T);
        const rom = h.k === "romhelm", metal = h.col ?? (rom ? "#a9b0ba" : "#c8963a"), crest = h.crest ?? (rom ? "#d2342a" : "#b8302a"), brass = rom ? "#c9a24a" : "#9a6a26";
        put(new THREE.SphereGeometry(R * 1.05, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal, [0, 0, 0], [0, 0, 0], [W, 1.02, 1.04], 0.8, "metal");
        put(new THREE.TorusGeometry(R * 1.05, R * 0.07, 8, 40), brass, [0, 0.02 * R, 0], [Math.PI / 2, 0, 0], [W, 1.04, 1], 0.5, "metal");
        studs(put, mixHex(brass, "#ffffff", 0.3), R * 1.11 * W, R * 1.13, 0.02 * R, 11, 1.9);
        put(new THREE.TorusGeometry(R * 1.06, R * 0.045, 6, 40, Math.PI), brass, [0, 0, 0], [0, 0, 0], [W, 1.02, 1], 0.3); // ear-to-ear reinforcing ridge over the crown
        for (const sx of [-1, 1]) { // cheek guards (two studs each)
          const m = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8), mat(metal, "metal")); m.position.set(sx * 0.9 * R * W, -0.5 * R, 0.25 * R); m.rotation.set(0.1, sx * 0.5, 0, "YXZ");
          m.scale.set(0.12, 0.48, 0.36); m.castShadow = true; T.add(m); hull(m, 0.5);
          for (const dy of [-0.32, -0.62]) put(new THREE.SphereGeometry(R * 0.05, 8, 6), brass, [sx * 0.99 * R * W, dy * R, 0.3 * R], [0, 0, 0], [1, 1, 1], 0.3);
        }
        put(new THREE.SphereGeometry(R, 16, 8), metal, [0, -0.38 * R, -0.92 * R], [-0.5, 0, 0], [0.86 * W, 0.36, 0.2], 0.5, "metal");  // neck guard
        // crest: a half disc of horsehair front-to-back on a short stalk
        put(new THREE.CylinderGeometry(0.06 * R, 0.08 * R, 0.3 * R, 8), brass, [0, 1.1 * R, 0], [0, 0, 0], [1, 1, 1], 0.4);
        put(new THREE.SphereGeometry(R * 0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), crest, [0, 1.18 * R, -0.08 * R], [0, 0, 0], [0.2, 0.75, 1.15], 0.6, "crest");
        break;
      }
      case "turban": { // wrapped cloth: a creased dome, three wound bands, a knot on top
        const T = new THREE.Group(); T.position.set(0, 0.32 * R, -0.04 * R); T.rotation.x = -0.12; G.add(T);
        const put = into(T);
        put(new THREE.SphereGeometry(R * 1.08, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), h.col, [0, 0, 0], [0, 0, 0], [W, 1.12, 1.05], 0.8, "turban");
        for (let i = 0; i < 3; i++) { const bc = i === 1 && h.band ? h.band : h.col;
          put(new THREE.TorusGeometry(R * (1.02 - i * 0.14), R * 0.15, 10, 40), bc, [0, (0.12 + i * 0.3) * R, 0], [Math.PI / 2 + 0.25 * (i % 2 ? 1 : -1), 0, 0], [W, 1, 1], 0.5, "band"); }
        put(new THREE.SphereGeometry(R * 0.3, 14, 10), h.band ?? h.col, [0, 1.04 * R, 0.25 * R], [0, 0, 0], [1, 0.8, 1], 0.5, "band");
        break;
      }
      case "petasos": case "sunhat": {
        const T = new THREE.Group(); T.position.set(0, 0.5 * R, -0.03 * R); T.rotation.x = -0.12; G.add(T);
        const put = into(T), tx: HatTexK = h.k === "sunhat" ? "straw" : "felt";
        const brim = h.k === "petasos" ? 1.95 : 1.75, crownH = h.k === "petasos" ? 0.55 : 0.75;
        const pr: THREE.Vector2[] = [[0.98, 0], [0.96, 0.25 * crownH], [0.86, 0.65 * crownH], [0.6, 0.92 * crownH], [0.25, 1.0 * crownH], [0.001, 1.0 * crownH]].map(([r, y]) => new THREE.Vector2(r * R, y * R));
        put(new THREE.LatheGeometry(pr, 32), h.col, [0, 0, 0], [0, 0, 0], [W, 1, 1], 0.8, tx);
        put(new THREE.CylinderGeometry(R * brim, R * brim, 0.05 * hh, 36), h.col, [0, 0.02 * R, 0], [0, 0, 0], [W, 1, 1], 0.6, tx);
        put(new THREE.CylinderGeometry(R * 0.995, R * 0.995, 0.14 * hh, 32, 1, true), h.band ?? "#7a4a26", [0, 0.12 * R, 0], [0, 0, 0], [W, 1, 1], 0.3, "band");
        break;
      }
      case "frizz": {
        add(new THREE.SphereGeometry(R * 1.04, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), h.col, [0, 0.03 * hh, -0.04 * hh], [-0.35, 0, 0], [W, 1, 1], 0.6, "hair");
        for (let i = 0; i < 16; i++) { // short spikes sticking out of the crown
          const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2, el = i % 2 ? 0.95 : 0.55, d = new THREE.Vector3(Math.cos(el) * Math.sin(a) * W, Math.sin(el), Math.cos(el) * Math.cos(a) * 0.9 - 0.25).normalize();
          const m = new THREE.Mesh(new THREE.ConeGeometry(0.09 * R, 0.42 * R, 6), toonMat(h.col)); m.position.set(d.x * R * 1.02, d.y * R * 1.02 + 0.02 * hh, d.z * R * 1.02 - 0.04 * hh);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); m.castShadow = true; G.add(m); hull(m, 0.5);
        }
        break;
      }
    }
  }

  /** shoulder / hip joints in body space */
  joint(which: "shL" | "shR" | "hipL" | "hipR") {
    const B = this.B, hh = this.hh;
    const sx = (B.topW / 2 - 0.06) * hh, sy = this.torsoTop - 0.2 * hh;
    switch (which) {
      case "shL": return new THREE.Vector3(sx, sy, 0);
      case "shR": return new THREE.Vector3(-sx, sy, 0);
      case "hipL": return new THREE.Vector3(B.hipX * hh, this.hipY, 0);
      case "hipR": return new THREE.Vector3(-B.hipX * hh, this.hipY, 0);
    }
  }

  /** hand presets in body space (HH units scaled): hip, down, point, up, front, wave, think */
  hand(k: "hip" | "down" | "point" | "up" | "front" | "wave" | "fist" | "chest", side: "L" | "R", amt = 1): ArmPose {
    const s = side === "L" ? 1 : -1, hh = this.hh, sh = this.joint(side === "L" ? "shL" : "shR");
    const P = (x: number, y: number, z: number): V3 => [sh.x + s * x * hh, sh.y + y * hh, sh.z + z * hh];
    switch (k) {
      case "hip": return { hand: P(0.12, -0.75, -0.02), pole: [s * 1, 0.1, -0.4] };       // fist on the hip, elbow out
      case "down": return { hand: P(0.16, -1.02, 0.05), pole: [s * 0.3, 0, -1] };
      case "point": return { hand: P(0.55 * amt, 0.12, 0.85 * amt), pole: [s * 0.3, -1, 0] };
      case "up": return { hand: P(0.25, 1.0, 0.1), pole: [s * 1, 0, -0.3] };
      case "front": return { hand: P(-0.05, -0.45, 0.62), pole: [s * 0.6, -1, 0] };
      case "wave": return { hand: P(0.42, 0.55, 0.3), pole: [s * 1, -0.6, 0] };
      case "fist": return { hand: P(0.02, -0.32, 0.66), pole: [s * 1, -1, 0] };          // clear of the torso front
      case "chest": return { hand: P(-0.16, -0.42, 0.6), pole: [s * 1, -0.8, 0] };
    }
  }

  pose(p: Pose) {
    const B = this.B, hh = this.hh;
    this.root.position.set(...p.pos);
    this.root.rotation.set(0, p.yaw, 0);
    // walk: planted stance half, lifted swing half
    let fL = new THREE.Vector3(B.hipX * hh * 0.9, 0.04 * hh, 0.02 * hh), fR = new THREE.Vector3(-B.hipX * hh * 0.9, 0.04 * hh, 0.02 * hh);
    let bob = p.bob ?? 0, walkLean = 0;
    if (p.walk) {
      const step = (ph: number) => {
        const q = ((ph % 1) + 1) % 1, S = p.walk!.stride, L = (p.walk!.lift ?? 0.42) * hh; // high-knee strut
        if (q < 0.5) return { z: S / 2 - (q / 0.5) * S, y: 0 };                       // stance: slides back = planted
        const u = (q - 0.5) / 0.5; return { z: -S / 2 + (1 - Math.cos(Math.PI * u)) * 0.5 * S, y: Math.sin(Math.PI * u) * L };
      };
      const a = step(p.walk.phase), b = step(p.walk.phase + 0.5);
      fL.set(B.hipX * hh * 0.9, 0.04 * hh + a.y, a.z); fR.set(-B.hipX * hh * 0.9, 0.04 * hh + b.y, b.z);
      // contact at phase 0 / 0.5: body LOWEST there (bob 0.2 HH peak to peak = ~6 % of height), lean 1 deg at passing -> 6 at contact
      const contact = Math.abs(Math.cos(Math.PI * 2 * p.walk.phase));
      bob += (0.5 - contact) * 0.2 * hh;
      walkLean = 1 + 5 * contact;
    }
    if (p.feet) { fL.set(...p.feet.L); fR.set(...p.feet.R); }
    const crouch = (p.crouch ?? 0) * 0.35 * B.legL * hh;
    this.body.position.set(0, bob - crouch, 0);
    // lean pivots round the hips
    const lean = (((p.lean ?? 0) + walkLean) * Math.PI) / 180, tilt = ((p.tilt ?? 0) * Math.PI) / 180;
    this.body.rotation.set(0, 0, 0);
    const pivot = new THREE.Matrix4().makeTranslation(0, this.hipY, 0)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lean, 0, tilt)))
      .multiply(new THREE.Matrix4().makeTranslation(0, -this.hipY, 0));
    this.body.matrixAutoUpdate = false;
    this.body.matrix.copy(new THREE.Matrix4().makeTranslation(0, bob - crouch, 0).multiply(pivot));
    // the feet stay in ROOT space (planted), so convert to body space through the inverse of the body matrix
    const inv = this.body.matrix.clone().invert();
    const footBody = [fL.clone().applyMatrix4(inv), fR.clone().applyMatrix4(inv)];
    // legs: knees bend forward
    const hips = [this.joint("hipL"), this.joint("hipR")];
    const lu = B.legL * hh * 0.52, ll = B.legL * hh * 0.52;
    for (let i = 0; i < 2; i++) {
      const ankle = footBody[i].clone().add(new THREE.Vector3(0, 0.05 * hh, -0.03 * hh));
      const knee = ik(hips[i], ankle, lu, ll, new THREE.Vector3(i ? -0.15 : 0.15, 0, 1));
      this.legs[i].set(hips[i], knee, ankle);
      this.feet[i].position.copy(footBody[i]).add(new THREE.Vector3(0, 0.02 * hh, 0.06 * hh));
      this.feet[i].rotation.set(-lean, i ? 0.12 : -0.12, 0);
    }
    // head
    this.headG.rotation.set(p.head?.pitch ?? 0, p.head?.yaw ?? 0, p.head?.roll ?? 0);
    this.faceMat.map = faceTex(p.face, "#ffffff", this.spec.beard);
    const ho = p.hatOff;
    this.hatG.position.set(ho?.x ?? 0, ho?.y ?? 0, ho?.z ?? 0); this.hatG.rotation.set(ho?.rx ?? 0, 0, ho?.rz ?? 0); this.hatG.visible = !ho?.hide;
    if (this.goggles) { const up = p.goggles === "up"; this.goggles.position.set(0, (up ? 0.33 : 0.02) * hh, up ? -0.03 * hh : 0); this.goggles.rotation.x = up ? -0.55 : -0.04; }
    // head colour: an explicit headCol wins; else the expression's tint ramps in over 3 f from its start (Expr.t)
    if (p.headCol) this.headMat.color.set(p.headCol);
    else if (p.face.tint) this.headMat.color.set(this.spec.head ?? "#ffffff").lerp(this.tintC.set(p.face.tint), Math.min(1, ((p.face.t ?? 9) + 1) / 3));
    else this.headMat.color.set(this.spec.head ?? "#ffffff");
    this.fx.update(p.face);
    // arms
    const sides: ["L", "R"] = ["L", "R"];
    const handAt = [new THREE.Vector3(), new THREE.Vector3()], elbowAt = [new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < 2; i++) {
      const side = sides[i], S = this.joint(side === "L" ? "shL" : "shR");
      const ap = (side === "L" ? p.armL : p.armR) ?? this.hand("down", side);
      const T = new THREE.Vector3(...ap.hand), pole = new THREE.Vector3(...(ap.pole ?? [i ? -0.3 : 0.3, 0, -1]));
      if (ap.root) T.applyMatrix4(inv);
      const E = ik(S, T, B.upperArm * hh, B.foreArm * hh, pole);
      // if out of reach the hand stops at the arm's end
      const reach = (B.upperArm + B.foreArm) * hh * 0.999;
      const Tc = S.distanceTo(T) > reach ? S.clone().add(T.clone().sub(S).setLength(reach)) : T;
      this.arms[i].set(S, E, Tc);
      this.hands[i].position.copy(Tc);
      if (this.prop && (this.spec.propHand ?? "R") === side) {
        this.prop.position.copy(Tc);
        // the prop's +y follows the forearm direction, then turns by propAng round the character's x axis
        const fore = p.propDir ? new THREE.Vector3(...p.propDir).normalize() : Tc.clone().sub(E).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fore);
        const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.propAng ?? 0, 0, p.propRoll ?? 0));
        this.prop.quaternion.copy(q.multiply(extra));
        if (this.thumb) {
          this.hands[i].scale.setScalar(1.45);
          const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(this.prop.quaternion), side = new THREE.Vector3().crossVectors(ax, new THREE.Vector3(0, 0, 1)).normalize();
          this.thumb.position.copy(Tc).addScaledVector(ax, B.handR * hh * 1.1).addScaledVector(side, -B.handR * hh * 0.5 * (i ? -1 : 1));
        }
      }
      handAt[i] = Tc.clone(); elbowAt[i] = E.clone();
      const cf = this.cuffs[i];
      if (cf) { const d = E.clone().sub(S); cf.position.copy(S).addScaledVector(d, 0.42); cf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize().negate()); }
    }
    // extra props: on their hand (axis along the forearm or `dir`), or free at `at` (root space)
    const rotInv = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(inv));
    for (const x of this.extra) {
      const pp = p.props?.[x.k];
      x.g.visible = !!pp;
      if (!pp) continue;
      const hi = x.hand === "L" ? 0 : 1;
      let dir: THREE.Vector3;
      if (pp.dir) { dir = new THREE.Vector3(...pp.dir).normalize(); if (pp.root || pp.at) dir.applyQuaternion(rotInv); }
      else dir = pp.at ? new THREE.Vector3(0, 1, 0).applyQuaternion(rotInv) : handAt[hi].clone().sub(elbowAt[hi]).normalize();
      if (pp.at) x.g.position.copy(new THREE.Vector3(...pp.at).applyMatrix4(inv)); else x.g.position.copy(handAt[hi]);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      x.g.quaternion.copy(q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pp.ang ?? 0, pp.spin ?? 0, pp.roll ?? 0))));
    }
  }
}

// ------------------------------------------------------------------ acting helpers (pose-to-pose)
export type Key<T> = { f: number; v: T; ease?: "hold" | "snap" | "ease" | "linear" };
const lerpV = (a: number | number[], b: number | number[], t: number): number | number[] =>
  typeof a === "number" ? a + ((b as number) - a) * t : (a as number[]).map((x, i) => x + ((b as number[])[i] - x) * t);
/** pose-to-pose track: each key is reached at its f; "ease" = hard ease-in-out over the gap (3-5 f attacks),
 *  "snap" = arrives in 1 frame at f (hits), "hold" = steps at f, "linear" = constant speed */
export function track<T extends number | number[]>(f: number, keys: Key<T>[]): T {
  if (f <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (f < b.f) {
      const t = (f - a.f) / (b.f - a.f), e = b.ease ?? "ease";
      if (e === "hold" || e === "snap") return a.v; // the value jumps exactly ON b.f (a 1-frame contact)
      const k = e === "linear" ? t : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return lerpV(a.v, b.v, k) as T;
    }
  }
  return keys[keys.length - 1].v;
}
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** steps take 9-12 f in the reference: one walk cycle (two steps) = 21 f */
export const WALK_CYCLE = 21;
/** turns are snappy: 1-4 f (front -> back ~2 f). Use for yaw / head yaw keys. */
export const TURN_F = 3;
/** lip-sync from the voice: per-frame RMS (templates/scripts/voice_rms.py, p95 = 1). Shapes change on ONES and the mouth
 *  leads the sound by `lead` frames (reference r ~0.47 with the RMS, lead 0-1 f). Silence keeps the expression's mouth. */
export const mouthRms = (f: number, rms: number[], base: Expr, lead = 1): Expr => {
  const i = Math.min(Math.max(f + lead, 0), rms.length - 1), v = rms[i] ?? 0, prev = rms[Math.max(i - 1, 0)] ?? 0;
  if (v < 0.1) return base;
  const m: Mouth = v < 0.3 ? "small" : v < 0.55 ? (v >= prev ? "open" : "o") : v >= prev ? "teeth" : "tongue";
  return { ...base, mouth: m };
};
/** fallback lip-sync when there is no RMS yet: a mouth swap every 3 f inside each spoken word */
export const talk = (f: number, words: [number, number][], base: Expr): Expr => {
  for (const [a, b] of words) if (f >= a && f < b) {
    const slot = Math.floor((f - a) / 3), m = TALK[Math.floor(hash(slot + a * 0.37) * TALK.length)];
    return { ...base, mouth: f >= b - 2 ? "small" : m };
  }
  return base;
};
const LIDS: Eyes[] = ["half", "closed", "closed", "half"];
/** blinks shaped half / shut / shut / half, every 0.5-2.3 s, PLUS one across every expression swap (pass the swap frames:
 *  the swap frame itself is shut, so the change is hidden). Shock ring / wide eyes, "><", spirals and crying arcs never blink. */
const NO_BLINK: Eyes[] = ["ring", "wide", "xx", "spiral", "cry"];
export const blink = (f: number, seed: number, e: Expr, swaps: number[] = []): Expr => {
  if (NO_BLINK.includes(e.eyes)) return e;
  for (const s of swaps) if (f >= s - 2 && f < s + 2) return { ...e, eyes: LIDS[f - (s - 2)] };
  let t = Math.floor(hash(seed) * 30);
  while (t <= f) { if (f < t + 4) return { ...e, eyes: LIDS[f - t] }; t += 15 + Math.floor(hash(t + seed) * 54); }
  return e;
};
/** expression track: [frame, expr] pairs; returns the current expression and the swap frames (feed both to blink) */
/** The returned expression carries `t` = frames since its FX run began (keys in a row with the same FX - tint, steam,
 *  stars, tears - count as one run, so steam does not restart when only the mouth changes): pose() ramps the head tint
 *  in with it and FaceFX animates the steam / stars / droplets from it. */
export const exprTrack = (f: number, keys: [number, Expr][]): { e: Expr; swaps: number[] } => {
  const fxSig = (x: Expr) => `${x.tint ?? ""}|${x.steam ? 1 : 0}|${x.stars ? 1 : 0}|${x.tears ?? ""}`;
  let e = keys[0][1], start = keys[0][0];
  for (let i = 0; i < keys.length; i++) {
    const [k, x] = keys[i];
    if (f < k) break;
    if (i === 0 || fxSig(x) !== fxSig(keys[i - 1][1])) start = k;
    e = x;
  }
  return { e: { ...e, t: Math.max(0, f - start) }, swaps: keys.slice(1).map(([k]) => k) };
};
/** strike timing (reference spear/hammer): raise to READY over `raise` f, pull back to WOUND over 3 f, hold it ~6 f,
 *  CONTACT on `hit` (the word onset) with no in-between, hold contact, recover. Works for V3 hand targets or prop axes. */
export function strikeTrack<T extends number | number[]>(f: number, hit: number, rest: T, ready: T, wound: T, contact: T,
  o: { raise?: number; wind?: number; held?: number; stay?: number; recover?: number; readyHold?: number } = {}): T {
  const wind = o.wind ?? 3, held = o.held ?? 6, raise = o.raise ?? 8, readyHold = o.readyHold ?? 4, stay = o.stay ?? 10, rec = o.recover ?? 10;
  const tw = hit - held - wind, tr = tw - readyHold - raise;
  return track(f, [
    { f: tr, v: rest }, { f: tr + raise, v: ready, ease: "ease" }, { f: tw, v: ready, ease: "hold" },
    { f: tw + wind, v: wound, ease: "ease" }, { f: hit, v: contact, ease: "snap" }, { f: hit + stay, v: contact, ease: "hold" },
    { f: hit + stay + rec, v: rest, ease: "ease" },
  ] as Key<T>[]);
}
