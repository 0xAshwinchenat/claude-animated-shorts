// "The Burning Pigs That Beat an Army of Elephants" (Megara 266 BC, Edessa 544 AD): our original 55 s short, 3D toon cast in a 3D toon world.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (look-match pass):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames (7 f dissolves).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, NormalPass, SSAOEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { FLASH_AT, SHOTS, layersAt, dofAt } from "./story";
import { FILM_TOTAL, warpF } from "./warp";
import { envFromSky } from "./pbr";
import { LightName } from "./lights";

/** the film is FILM_TOTAL frames; film frame g plays story frame warpF(g). warp.ts is the identity for a new short
 *  (story.ts is built on its own voice); make_warp.py regenerates it if the voice is replaced after the picture. */
export const PIGS_FRAMES = FILM_TOTAL;
/** global depth-of-field scale (2026-11-09 reference study: backgrounds soft, mid-ground crisp) */
export const DOF_K = 0.5;
/** story frame (OLD 30 fps units, fractional): the HQ composition runs at 120 fps (4 sub-frames per film frame) and
 *  ffmpeg averages each group of 4 into one 30 fps frame (true shutter motion blur). */
export const SHUTTER = 0.5; // fraction of the frame the HQ sub-frames span (0.5 = 180 deg; 1 = the old 360 deg = stepped ghost copies)
const useStoryFrame = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const sub = fps / 30;
  if (sub <= 1) return warpF(f);
  const n = Math.floor(f / sub), k = f - n * sub;
  const sh = (getInputProps() as { post?: { shutter?: number } }).post?.shutter ?? SHUTTER;
  return warpF(n + (k * sh) / sub);
};

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean; bump: number; ao: number };
const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false, bump: BUMP_K, ao: AO_K, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();
/** sun glow direction baked into the sky reflection map (only a soft sheen; the real highlight is the sun light's) */
const ENV_SUN = new THREE.Vector3(0.45, 0.75, 0.5).normalize();

/** 2026-11-09 reference study: surface relief. Every painted world material (two-tone Lambert/Phong with a map) uses its
 *  own painted texture as a bump map, so mortar lines, planks, stones and straw catch the sun like modelled detail.
 *  Characters (toon3d / cards) are left alone. */
export const BUMP_K = 8.0;
/** ambient-occlusion strength (SSAO on a normal pass; 0 = off): contact darkening under props, in corners and creases */
export const AO_K = 0; // off by default: on the toon world it changes ~1-2 levels and doubles the render time; try 1.6-2.5 on interiors
const bumpify = (root: THREE.Object3D, k: number) => {
  if (k <= 0) return;
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material; if (!mats) return;
    for (const m of (Array.isArray(mats) ? mats : [mats]) as (THREE.MeshLambertMaterial & { _bumped?: boolean })[]) {
      if (m._bumped || !m.map || m.transparent || !(m.customProgramCacheKey?.() ?? "").startsWith("twoTone")) continue;
      m.bumpMap = m.map; m.bumpScale = k; m._bumped = true; m.needsUpdate = true;
    }
  });
};

// @react-three/postprocessing is pinned to 3.0.4: 3.2.x builds its composer one render late, so Remotion's single
// draw per frame happens before it exists and every frame comes out blank. 3.0.4's types reject null children.
const Composer = EffectComposer as unknown as React.FC<{ multisampling?: number; children?: React.ReactNode }>;

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("pigs kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useStoryFrame();
  const { camera, scene, gl } = useThree();
  // sky reflections for glossy props (pbr.ts gloss / asset-kit models): one PMREM of our own sky per light preset
  const envs = useMemo(() => new Map<LightName, THREE.Texture>(), [gl]);
  const on = useMemo(toggles, []);
  const world = useMemo(() => { const w = new World(kit); bumpify(w.root, on.bump); return w; }, [kit, on]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const fx = useMemo(() => {
    const normal = new NormalPass(scene, camera);
    return {
    normal,
    ao: new SSAOEffect(camera, normal.texture, { blendFunction: BlendFunction.MULTIPLY, samples: 16, rings: 7, radius: 0.05, intensity: on.ao,
      luminanceInfluence: 0.45, bias: 0.03, fade: 0.02, worldDistanceThreshold: 80, worldDistanceFalloff: 20, worldProximityThreshold: 0.5,
      worldProximityFalloff: 0.25, color: new THREE.Color("#1e1430"), resolutionScale: 1 }),
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }; }, [camera, scene, on]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <Composer multisampling={4}>
      {on.ao > 0 ? <primitive object={fx.normal} dispose={null} /> : null}
      {on.ao > 0 ? <primitive object={fx.ao} dispose={null} /> : null}
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      {on.grain ? <primitive object={fx.grain} dispose={null} /> : null}
    </Composer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf * DOF_K;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  { const ln = SHOTS[id - 1].light as LightName; let e = envs.get(ln); if (!e) { e = envFromSky(gl, ln, ENV_SUN); envs.set(ln, e); } scene.environment = e; }
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const PigsShort: React.FC = () => {
  const f = useStoryFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][Math.floor(f - FLASH_AT)] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
