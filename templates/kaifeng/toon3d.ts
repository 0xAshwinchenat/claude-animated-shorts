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

// ------------------------------------------------------------------ faces (decal on the head front)
export type Eyes = "lid" | "dot" | "ring" | "happy" | "closed" | "half" | "squint" | "angry";
export type Brows = "flat" | "up" | "angry" | "worried" | "raised1" | "none";
export type Mouth = "smirk" | "flat" | "small" | "open" | "o" | "grin" | "grit" | "frown" | "teeth" | "tongue";
export type Expr = { eyes: Eyes; brows: Brows; mouth: Mouth; look?: number; blush?: boolean; sweat?: boolean };
export const EXPR: Record<string, Expr> = {
  neutral: { eyes: "lid", brows: "flat", mouth: "flat" },
  smug: { eyes: "lid", brows: "raised1", mouth: "smirk" },
  stern: { eyes: "dot", brows: "angry", mouth: "flat" },
  shock: { eyes: "ring", brows: "up", mouth: "o" },
  happy: { eyes: "happy", brows: "up", mouth: "grin", blush: true },
  angry: { eyes: "angry", brows: "angry", mouth: "grit" },
  worried: { eyes: "dot", brows: "worried", mouth: "frown", sweat: true },
  grin: { eyes: "lid", brows: "flat", mouth: "teeth" },
};
/** mouths the lip-sync cycles through while a word is spoken */
export const TALK: Mouth[] = ["open", "small", "o", "open", "teeth", "small"];

// decal = sphere patch lon -75..75, lat -55..+50 (degrees); canvas pixel <-> angle
const LON = 75, LAT0 = 50, LAT1 = -55, FW = 512, FH = Math.round((FW * (LAT0 - LAT1)) / (2 * LON));
const ax = (lon: number) => ((lon + LON) / (2 * LON)) * FW;
const ay = (lat: number) => ((LAT0 - lat) / (LAT0 - LAT1)) * FH;
const faceCache = new Map<string, THREE.CanvasTexture>();
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

function drawFace(g: CanvasRenderingContext2D, e: Expr, headCol: string, beard?: Beard) {
  const k0 = FW / 150, k = k0 * 1.45; // px per degree of longitude; features drawn 1.45x (reference eyes ~0.09 x 0.11 HH)
  const ink = FEATURE;
  g.lineCap = "round"; g.lineJoin = "round";
  const look = (e.look ?? 0) * 4;
  const EX = 16, EY = 2; // eye longitude / latitude (eyes 0.26 head widths apart)
  if (e.blush) {
    for (const s of [-1, 1]) { g.fillStyle = "rgba(255,120,140,0.28)"; g.beginPath(); g.ellipse(ax(s * 23), ay(-9), 5.2 * k, 3 * k, 0, 0, Math.PI * 2); g.fill(); }
  }
  for (const s of [-1, 1]) {
    const x = ax(s * EX + look), y = ay(EY);
    g.fillStyle = ink; g.strokeStyle = ink;
    switch (e.eyes) {
      case "dot": g.beginPath(); g.ellipse(x, y, 1.9 * k, 2.4 * k, 0, 0, Math.PI * 2); g.fill(); break;
      case "lid": // half-lidded: dot pupil under a heavy lid line (the default smug/deadpan look)
        g.beginPath(); g.ellipse(x, y + 0.8 * k, 1.8 * k, 1.7 * k, 0, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(x - 4.2 * k, y - 0.6 * k); g.lineTo(x + 4.2 * k, y - 0.6 * k); g.stroke(); break;
      case "squint": g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(x - 4 * k, y); g.lineTo(x + 4 * k, y); g.stroke(); break;
      case "half": // blink in-between: lid line through the middle, lower half of the pupil
        g.beginPath(); g.ellipse(x, y + 0.6 * k, 1.9 * k, 1.6 * k, 0, 0, Math.PI); g.fill();
        g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(x - 3.8 * k, y + 0.5 * k); g.lineTo(x + 3.8 * k, y + 0.5 * k); g.stroke(); break;
      case "closed": g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(x - 3.8 * k, y + 0.5 * k); g.quadraticCurveTo(x, y + 2.2 * k, x + 3.8 * k, y + 0.5 * k); g.stroke(); break;
      case "happy": g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(x - 3.8 * k, y + 1.5 * k); g.quadraticCurveTo(x, y - 3 * k, x + 3.8 * k, y + 1.5 * k); g.stroke(); break;
      case "ring": // shock: white disc + ink ring + small pupil
        g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x, y, 5.2 * k, 5.6 * k, 0, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1.3 * k; g.stroke();
        g.fillStyle = ink; g.beginPath(); g.ellipse(x + look * 0.5, y + 0.5 * k, 1.7 * k, 1.9 * k, 0, 0, Math.PI * 2); g.fill(); break;
      case "angry":
        g.beginPath(); g.ellipse(x, y + 0.9 * k, 2 * k, 1.8 * k, 0, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1.6 * k; g.beginPath(); g.moveTo(x - s * 4.5 * k, y - 2.2 * k); g.lineTo(x + s * 4 * k, y + 0.2 * k); g.stroke(); break;
    }
    // brows: thick rounded strokes
    g.lineWidth = 2.3 * k; g.strokeStyle = ink;
    const by = ay(EY + 15), bx = ax(s * EX);
    const browAng: Record<Brows, number> = { flat: 0, up: -0.12, angry: 0.42, worried: -0.38, raised1: s < 0 ? -0.2 : 0.05, none: 0 };
    if (e.brows !== "none") {
      const a = browAng[e.brows] * -s, dy = e.brows === "up" ? -2.5 * k : e.brows === "raised1" && s < 0 ? -2.2 * k : 0;
      const L = 4.6 * k;
      g.beginPath(); g.moveTo(bx - L * Math.cos(a), by + dy - L * Math.sin(a) * s * -1); g.quadraticCurveTo(bx, by + dy - 1.2 * k, bx + L * Math.cos(a), by + dy + L * Math.sin(a) * s * -1); g.stroke();
    }
  }
  // mouth
  const mx = ax(look * 0.5), my = ay(-18);
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 1.4 * k;
  const open = (w: number, h: number, teeth = false, tongue = false) => {
    g.fillStyle = "#3a1e2a"; g.beginPath(); g.ellipse(mx, my, w * k, h * k, 0, 0, Math.PI * 2); g.fill();
    if (tongue) { g.fillStyle = "#e0707e"; g.beginPath(); g.ellipse(mx, my + h * 0.45 * k, w * 0.6 * k, h * 0.45 * k, 0, 0, Math.PI * 2); g.fill(); }
    if (teeth) { g.fillStyle = "#ffffff"; g.fillRect(mx - w * 0.8 * k, my - h * 0.9 * k, w * 1.6 * k, h * 0.55 * k); }
    g.strokeStyle = ink; g.lineWidth = 1.1 * k; g.beginPath(); g.ellipse(mx, my, w * k, h * k, 0, 0, Math.PI * 2); g.stroke();
  };
  switch (e.mouth) {
    case "flat": g.beginPath(); g.moveTo(mx - 3.5 * k, my); g.lineTo(mx + 3.5 * k, my); g.stroke(); break;
    case "smirk": g.beginPath(); g.moveTo(mx - 3.5 * k, my + 0.3 * k); g.quadraticCurveTo(mx + 1 * k, my + 1.8 * k, mx + 4.2 * k, my - 1.6 * k); g.stroke(); break;
    case "frown": g.beginPath(); g.moveTo(mx - 4 * k, my + 1.4 * k); g.quadraticCurveTo(mx, my - 2 * k, mx + 4 * k, my + 1.4 * k); g.stroke(); break;
    case "small": open(2.6, 1.6, false, false); break;
    case "open": open(4.2, 3.2, false, true); break;
    case "o": open(2.6, 3.2, false, false); break;
    case "tongue": open(4, 3.6, false, true); break;
    case "grin": { g.fillStyle = "#3a1e2a"; g.beginPath(); g.moveTo(mx - 6 * k, my - 1.5 * k); g.quadraticCurveTo(mx, my + 7 * k, mx + 6 * k, my - 1.5 * k); g.closePath(); g.fill();
      g.fillStyle = "#ffffff"; g.fillRect(mx - 5 * k, my - 1.5 * k, 10 * k, 2 * k); g.lineWidth = 1.1 * k; g.strokeStyle = ink; g.beginPath(); g.moveTo(mx - 6 * k, my - 1.5 * k); g.quadraticCurveTo(mx, my + 7 * k, mx + 6 * k, my - 1.5 * k); g.closePath(); g.stroke(); break; }
    case "teeth": case "grit": { // teeth grid: white bar with ink outline and vertical lines
      const w = e.mouth === "grit" ? 6 : 5, h = e.mouth === "grit" ? 3.4 : 2.8;
      g.fillStyle = "#ffffff"; g.strokeStyle = ink; g.lineWidth = 1.1 * k;
      g.beginPath(); g.roundRect(mx - w * k, my - h * 0.5 * k, 2 * w * k, h * k, 1.2 * k); g.fill(); g.stroke();
      g.lineWidth = 0.7 * k; g.beginPath(); g.moveTo(mx - w * k, my); g.lineTo(mx + w * k, my);
      for (let i = 1; i < 5; i++) { const x = mx - w * k + (2 * w * k * i) / 5; g.moveTo(x, my - h * 0.5 * k); g.lineTo(x, my + h * 0.5 * k); }
      g.stroke(); break; }
  }
  if (beard) { // long drooping moustache from under the nose past the mouth corners + a small goatee
    const bc = beard.col, k1 = k;
    const tp = (pts: [number, number][], w0: number, w1: number) => { // tapered stroke along lon/lat points
      const P = pts.map(([lo, la]) => [ax(lo + look * 0.5), ay(la)] as [number, number]);
      g.fillStyle = bc; g.strokeStyle = bc; g.lineCap = "round";
      for (let i = 0; i < P.length - 1; i++) { const t = i / (P.length - 1); g.lineWidth = (w0 + (w1 - w0) * t) * k1; g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke(); }
    };
    if (beard.droop) for (const s of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; const lo = s * (1.2 + 9.5 * Math.min(1, t * 1.9)), la = -10.5 - 3.5 * Math.min(1, t * 2.2) - 24 * Math.max(0, (t - 0.42) / 0.58) ** 1.3; pts.push([lo + s * 1.2 * Math.max(0, t - 0.5), la]); }
      tp(pts, 5.2, 2.2);
    }
    if (beard.goatee) { const x = ax(look * 0.5); g.fillStyle = bc; g.beginPath(); g.moveTo(x - 3.2 * k, ay(-27)); g.quadraticCurveTo(x, ay(-25.5), x + 3.2 * k, ay(-27)); g.quadraticCurveTo(x + 1.5 * k, ay(-36), x, ay(-41)); g.quadraticCurveTo(x - 1.5 * k, ay(-36), x - 3.2 * k, ay(-27)); g.fill(); }
  }
  if (e.sweat) { g.fillStyle = "#8fd3ff"; g.strokeStyle = ink; g.lineWidth = 0.8 * k; const x = ax(31), y = ay(18);
    g.beginPath(); g.moveTo(x, y - 4 * k); g.quadraticCurveTo(x + 3 * k, y + 1 * k, x, y + 2.5 * k); g.quadraticCurveTo(x - 3 * k, y + 1 * k, x, y - 4 * k); g.fill(); g.stroke(); }
  void headCol;
}
export const faceTex = (e: Expr, headCol = "#ffffff", beard?: Beard) => {
  const key = JSON.stringify(e) + (beard ? JSON.stringify(beard) : "");
  let t = faceCache.get(key);
  if (!t) {
    const c = mk(FW, FH); const g = c.getContext("2d")!;
    drawFace(g, e, headCol, beard);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    faceCache.set(key, t);
  }
  return t;
};

// ------------------------------------------------------------------ clothes (wrapped round the lathe torso)
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
};
const clothCache = new Map<string, THREE.CanvasTexture>();
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
const clothTex = (o: Outfit) => {
  const key = JSON.stringify(o);
  let t = clothCache.get(key);
  if (t) return t;
  const W = 512, H = 256, c = mk(W, H), g = c.getContext("2d")!;
  // u: 0 = back-left .. 0.5 = front .. 1 = back; v (canvas y): 0 = torso top .. H = bottom
  g.fillStyle = o.shirt; g.fillRect(0, 0, W, H);
  if (o.stripes) { g.fillStyle = o.stripes; for (let y = 6; y < H; y += 22) g.fillRect(0, y, W, 9); }
  const cx = W / 2;
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
    g.fillStyle = tr; g.fillRect(0, 0, W, 9);                                   // collar band
    g.fillStyle = tr; g.strokeStyle = INK3; g.lineWidth = 2;                       // toggle knots along the flap
    for (const k of [0.3, 0.62]) { const x = cx + 18 - 88 * k, y = H * 0.46 * k; g.beginPath(); g.arc(x - 4, y + 4, 6, 0, 7); g.fill(); g.stroke(); }
  }
  if (o.closure === "round") { // official robe: round collar
    const tr = o.trim ?? INK3;
    g.strokeStyle = tr; g.lineWidth = 10; g.beginPath(); g.ellipse(cx, -6, 60, 40, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, -6, 66, 46, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.moveTo(cx - 64, 26); g.lineTo(cx - 64, H); g.stroke();
  }
  if (o.sash) {
    g.fillStyle = o.sash; g.fillRect(0, H * 0.74, W, H * 0.16);
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, H * 0.75); g.lineTo(x + 10, H * 0.89); g.stroke(); }
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.strokeRect(-4, H * 0.74, W + 8, H * 0.16);
    g.fillStyle = o.sash; g.beginPath(); g.ellipse(cx + 70, H * 0.82, 16, 13, 0, 0, 7); g.fill(); g.stroke();   // knot
  }
  if (o.vest) { // open vest: shirt panel in front, vest colour round the rest
    g.fillStyle = o.vest; g.beginPath(); g.moveTo(0, 0); g.lineTo(cx - 40, 0); g.lineTo(cx - 4, H * 0.62); g.lineTo(cx - 4, H); g.lineTo(0, H); g.fill();
    g.beginPath(); g.moveTo(W, 0); g.lineTo(cx + 40, 0); g.lineTo(cx + 4, H * 0.62); g.lineTo(cx + 4, H); g.lineTo(W, H); g.fill();
    g.strokeStyle = INK3; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 40, 0); g.lineTo(cx - 4, H * 0.62); g.lineTo(cx - 4, H);
    g.moveTo(cx + 40, 0); g.lineTo(cx + 4, H * 0.62); g.lineTo(cx + 4, H); g.stroke();
    g.fillStyle = "#e8c45a"; for (let y = H * 0.68; y < H * 0.9; y += 22) { g.beginPath(); g.arc(cx - 16, y, 4, 0, 7); g.fill(); }
  }
  if (o.collar) { g.fillStyle = o.collar; g.beginPath(); g.moveTo(cx - 34, 0); g.lineTo(cx, 30); g.lineTo(cx + 34, 0); g.fill(); g.strokeStyle = INK3; g.lineWidth = 2.5; g.stroke(); }
  if (o.tie) { g.fillStyle = o.tie; g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 9, 18); g.lineTo(cx + 9, 18); g.lineTo(cx + 15, H * 0.62); g.lineTo(cx, H * 0.72); g.lineTo(cx - 15, H * 0.62); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 5; for (let y = 50; y < H * 0.62; y += 26) { g.beginPath(); g.moveTo(cx - 12, y); g.lineTo(cx + 12, y - 12); g.stroke(); } }
  if (o.bowtie) { g.fillStyle = o.bowtie; g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, 16); g.lineTo(cx - 34, 2); g.lineTo(cx - 34, 32); g.closePath(); g.moveTo(cx, 16); g.lineTo(cx + 34, 2); g.lineTo(cx + 34, 32); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ffffff"; for (const [x, y] of [[-24, 10], [-18, 22], [22, 11], [26, 23]]) { g.beginPath(); g.arc(cx + x, y, 3.2, 0, 7); g.fill(); } }
  if (o.buttons) { g.fillStyle = o.buttons; for (let y = 60; y < H * 0.82; y += 34) { g.beginPath(); g.arc(cx + (o.tie ? 0 : 0), y, 5, 0, 7); g.fill(); } }
  if (o.badge) { g.fillStyle = o.badge; const bx = cx + 44, by = 58; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(bx + r * Math.cos(a), by + r * Math.sin(a)); } g.closePath(); g.fill(); }
  if (o.belt) { g.fillStyle = o.belt; g.fillRect(0, H * 0.84, W, H * 0.09); if (o.buckle) { g.fillStyle = o.buckle; g.fillRect(cx - 12, H * 0.82, 24, H * 0.13); g.fillStyle = o.belt; g.fillRect(cx - 6, H * 0.855, 12, H * 0.06); } }
  if (o.pants) { g.fillStyle = o.pants; g.fillRect(0, H * 0.93, W, H * 0.07); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
  clothCache.set(key, t);
  return t;
};
/** the robe skirt below the torso: closure line continued down the front, trim at the hem (v 0 = waist, 1 = hem) */
const skirtTex = (o: Outfit) => {
  const key = "skirt|" + JSON.stringify(o);
  let t = clothCache.get(key);
  if (t) return t;
  const W = 512, H = 256, c = mk(W, H), g = c.getContext("2d")!, cx = W / 2, tr = o.trim ?? INK3;
  g.fillStyle = o.robe!; g.fillRect(0, 0, W, H);
  if (o.lamellar) { lamellarRows(g, o.lamellar, 0, cx - 30, 0, H * 0.55); lamellarRows(g, o.lamellar, cx + 30, W, 0, H * 0.55); }  // tassets
  g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 3;
  for (let x = 20; x < W; x += 46) { g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x + 8, H); g.stroke(); }   // folds
  if (o.closure === "diag" || o.closure === "round") {
    const x = o.closure === "diag" ? cx - 70 : cx - 64;
    g.strokeStyle = tr; g.lineWidth = o.closure === "diag" ? 11 : 0; if (o.closure === "diag") { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 6, H); g.stroke(); }
    g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 7, 0); g.lineTo(x + 1, H); g.stroke();
  }
  g.fillStyle = tr; g.fillRect(0, H - 22, W, 22);
  g.strokeStyle = INK3; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, H - 23); g.lineTo(W, H - 23); g.stroke();
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
  clothCache.set(key, t);
  return t;
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
  | { k: "frizz"; col: string };
/** facial hair painted on the face decal (the reference paints moustaches on the face) */
export type Beard = { col: string; droop?: boolean; goatee?: boolean };

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
  | "sledge" | "scroll" | "baton" | "jar" | "patty" | "straw" | "felt" | "rock" | "grain";
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
  } else if (k === "stopwatch") {
    add(new THREE.CylinderGeometry(0.2 * hh, 0.2 * hh, 0.07 * hh, 24), "#f2f2f2", [0, 0.24 * hh, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.04 * hh, 0.04 * hh, 0.08 * hh, 8), "#c8ccd2", [0, 0.47 * hh, 0]);
  }
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
};

export class Toon3D {
  readonly root = new THREE.Group();
  readonly B: Build; readonly hh: number;
  private body = new THREE.Group();      // lean / bob pivot at the hips
  private headG = new THREE.Group();
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
    this.buildHat(spec.hat ?? { k: "none" }, hull);
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
    const hh = this.hh, G = this.headG, W = this.B.headW;
    const add = (geo: THREE.BufferGeometry, col: string, p: V3, r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1], k = 0.8) => {
      const m = new THREE.Mesh(geo, toonMat(col)); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; G.add(m); hull(m, k); return m;
    };
    const R = 0.5 * hh;
    switch (h.k) {
      case "cap": {
        // crown: front rim at ~0.5 R (just above the brows at 0.29 R), back rim lower; short dark visor; badge on the crown
        add(new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), h.col, [0, 0.05 * hh, 0], [-0.1, 0, 0], [W, 1.1, 1.02]);
        add(new THREE.CylinderGeometry(R * 0.8, R * 0.82, 0.05 * hh, 24, 1, false, -Math.PI / 2, Math.PI), "#1b2340", [0, 0.25 * hh, 0.27 * hh], [0.14, 0, 0], [W * 0.95, 1, 0.85]); // visor
        if (h.badge) add(new THREE.SphereGeometry(0.055 * hh, 10, 8), h.badge, [0, 0.37 * hh, 0.43 * hh], [-0.5, 0, 0], [1, 1, 0.4], 0.5);
        break;
      }
      case "bowler":
        add(new THREE.SphereGeometry(R * 0.86, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), h.col, [0, 0.3 * hh, 0], [0, 0, 0], [W, 0.9, 1]);
        add(new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.05 * hh, 28), h.col, [0, 0.3 * hh, 0], [0, 0, 0], [W, 1, 1]);
        break;
      case "top":
        add(new THREE.CylinderGeometry(R * 0.62, R * 0.66, 0.85 * hh, 24), h.col, [0, 0.72 * hh, 0]);
        add(new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.05 * hh, 28), h.col, [0, 0.32 * hh, 0], [0, 0, 0], [W, 1, 1]);
        if (h.band) add(new THREE.CylinderGeometry(R * 0.665, R * 0.665, 0.12 * hh, 24), h.band, [0, 0.42 * hh, 0], [0, 0, 0], [1, 1, 1], 0.3);
        break;
      case "newsboy":
        add(new THREE.SphereGeometry(R * 1.1, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), h.col, [0, 0.06 * hh, -0.04 * hh], [-0.18, 0, 0], [W * 1.02, 0.85, 1.05]);
        add(new THREE.CylinderGeometry(R * 0.6, R * 0.62, 0.04 * hh, 20, 1, false, -Math.PI / 2, Math.PI), h.col, [0, 0.22 * hh, 0.3 * hh], [0.25, 0, 0], [W * 0.9, 1, 0.55]);
        break;
      case "hair":
        add(new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), h.col, [0, 0.02 * hh, -0.05 * hh], [-0.42, 0, 0], [W, 1, 1]);
        if (h.curly) for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new THREE.SphereGeometry(R * 0.26, 12, 8), h.col, [Math.cos(a) * R * 0.62 * W, R * 0.78, Math.sin(a) * R * 0.5 - 0.06 * hh], [0, 0, 0], [1, 0.8, 1], 0.6); }
        break;
      case "chef":
        add(new THREE.CylinderGeometry(R * 0.78, R * 0.7, 0.55 * hh, 24), "#ffffff", [0, 0.55 * hh, 0]);
        add(new THREE.SphereGeometry(R * 0.95, 24, 14), "#ffffff", [0, 0.92 * hh, 0], [0, 0, 0], [1.05, 0.7, 1.05]);
        break;
      case "mongol": {
        // everything in a sub-group tipped back 0.14 rad: the fur brim's front rim sits at ~0.55 R (brows at 0.29 R)
        const T = new THREE.Group(); T.position.set(0, 0.47 * R, -0.04 * R); T.rotation.x = -0.14; G.add(T);
        const fur = h.fur ?? "#7a5233";
        const put = (geo: THREE.BufferGeometry, col: string, p: V3, r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1], k = 0.8) => {
          const m = new THREE.Mesh(geo, toonMat(col)); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; T.add(m); hull(m, k); return m;
        };
        const pr: THREE.Vector2[] = [[0.8, 0], [0.84, 0.22], [0.78, 0.5], [0.6, 0.78], [0.34, 0.98], [0.12, 1.08], [0.001, 1.1]].map(([r, y]) => new THREE.Vector2(r * R, y * R));
        put(new THREE.LatheGeometry(pr, 28), h.col, [0, 0.02 * R, 0], [0, 0, 0], [W, 1, 1]);
        put(new THREE.TorusGeometry(R * 0.9, R * 0.21, 12, 36), fur, [0, 0, 0], [Math.PI / 2, 0, 0], [W * 1.02, 1.02, 1]);
        put(new THREE.SphereGeometry(R * 0.13, 12, 8), h.knob ?? "#e8c45a", [0, 1.14 * R, 0], [0, 0, 0], [1, 1, 1], 0.5);
        for (const sx of [-1, 1]) put(new THREE.SphereGeometry(R, 16, 10), fur, [sx * 1.0 * R * W, -0.62 * R, -0.12 * R], [0.1, 0, sx * 0.08], [0.17, 0.5, 0.36], 0.6); // ear flaps
        break;
      }
      case "jinhelm": {
        const T = new THREE.Group(); T.position.set(0, 0.4 * R, -0.03 * R); T.rotation.x = -0.1; G.add(T);
        const put = (geo: THREE.BufferGeometry, col: string, p: V3, r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1], k = 0.8) => {
          const m = new THREE.Mesh(geo, toonMat(col)); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; T.add(m); hull(m, k); return m;
        };
        const iron = h.col ?? "#8d96a3", guard = h.guard ?? "#5b4636";
        put(new THREE.SphereGeometry(R * 1.04, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), iron, [0, 0, 0], [0, 0, 0], [W, 1.0, 1.0]);
        put(new THREE.TorusGeometry(R * 1.04, R * 0.075, 8, 36), "#c9a24a", [0, 0.02 * R, 0], [Math.PI / 2, 0, 0], [W, 1, 1], 0.5);
        put(new THREE.CylinderGeometry(0.06 * R, 0.1 * R, 0.4 * R, 8), "#c9a24a", [0, 1.12 * R, 0], [0, 0, 0], [1, 1, 1], 0.5);
        put(new THREE.SphereGeometry(0.4 * R, 16, 10), h.tassel ?? "#d23a2e", [0, 1.12 * R, 0], [0, 0, 0], [1.05, 0.55, 1.05], 0.6); // red horsehair tassel
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
        const put = (geo: THREE.BufferGeometry, p: V3, r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1], k = 0.8) => {
          const m = new THREE.Mesh(geo, toonMat(col)); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; T.add(m); hull(m, k); return m;
        };
        put(new THREE.SphereGeometry(R * 1.03, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 0], [0, 0, 0], [W, 0.78, 1.0]);
        put(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.16 * R, 32), [0, 0.0, 0], [0, 0, 0], [W, 1, 1], 0.6);
        put(new THREE.SphereGeometry(R * 0.55, 20, 12), [0, 0.78 * R, -0.25 * R], [0, 0, 0], [W * 1.1, 1.0, 0.8]);    // raised rear lobe
        for (const sx of [-1, 1]) put(new THREE.BoxGeometry(1.55 * hh, 0.05 * hh, 0.13 * hh), [sx * (0.62 * R * W + 0.78 * hh), 0.62 * R, -0.42 * R], [0, 0, sx * 0.04], [1, 1, 1], 0.45); // wings
        break;
      }
      case "frizz": {
        add(new THREE.SphereGeometry(R * 1.04, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), h.col, [0, 0.03 * hh, -0.04 * hh], [-0.35, 0, 0], [W, 1, 1], 0.6);
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
    if (p.headCol) this.headMat.color.set(p.headCol); else this.headMat.color.set(this.spec.head ?? "#ffffff");
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
 *  the swap frame itself is shut, so the change is hidden). Shock ring eyes never blink. */
export const blink = (f: number, seed: number, e: Expr, swaps: number[] = []): Expr => {
  if (e.eyes === "ring") return e;
  for (const s of swaps) if (f >= s - 2 && f < s + 2) return { ...e, eyes: LIDS[f - (s - 2)] };
  let t = Math.floor(hash(seed) * 30);
  while (t <= f) { if (f < t + 4) return { ...e, eyes: LIDS[f - t] }; t += 15 + Math.floor(hash(t + seed) * 54); }
  return e;
};
/** expression track: [frame, expr] pairs; returns the current expression and the swap frames (feed both to blink) */
export const exprTrack = (f: number, keys: [number, Expr][]): { e: Expr; swaps: number[] } => {
  let e = keys[0][1]; for (const [k, x] of keys) if (f >= k) e = x;
  return { e, swaps: keys.slice(1).map(([k]) => k) };
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
