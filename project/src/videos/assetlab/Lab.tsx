// Asset-kit / material test scene (2026-11-09): the market street of labworld.ts through the same post chain as the
// shorts (Pigs.tsx): [ink] -> lens blur (thin-lens DOF) -> bloom + NEUTRAL tone map + day grade, MSAA 4; 120 fps HQ
// with the 180 deg shutter. A/B switches (inputProps):
//   { post: { ink, lens, bloom, grade } }                  same as the shorts
//   { lab: { pbr, env, envK, kit, kitFiles: [...] } }      glossy props / sky reflections / asset-kit GLBs
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH } from "./grade";
import { LabWorld, LabKit, loadLabKit, LAB_FRAMES, LAB_SUN } from "./labworld";
import { envFromSky } from "./pbr";
import { TONE } from "./shade";

export { LAB_FRAMES };
const SHUTTER = 0.5;
const useStoryFrame = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const sub = fps / 30;
  if (sub <= 1) return f;
  const n = Math.floor(f / sub), k = f - n * sub;
  return n + (k * SHUTTER) / sub;
};
type Post = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean; dpr?: number };
type LabOpt = { pbr: boolean; env: boolean; envK: number; kit: boolean; kitFiles: string[]; cInf: number; sun?: [number, number, number]; shade?: [number, number, number]; sat?: number; lift?: [number, number, number]; fx?: boolean };
const props = () => getInputProps() as { post?: Partial<Post>; lab?: Partial<LabOpt> };
const postOpt = (): Post => ({ ink: true, lens: true, bloom: true, grade: true, ...(props().post ?? {}) });
const labOpt = (): LabOpt => ({ pbr: true, env: true, envK: 1, kit: false, kitFiles: [], cInf: 6, ...(props().lab ?? {}) });

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass; const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
/** Pigs.tsx bumpify (BUMP_K 8): painted two-tone world textures double as bump maps (relief on cobbles, mortar, planks) */
const BUMP_K = 8.0;
const bumpify = (root: THREE.Object3D, k: number) => {
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material; if (!mats) return;
    for (const m of (Array.isArray(mats) ? mats : [mats]) as (THREE.MeshLambertMaterial & { _bumped?: boolean })[]) {
      if (m._bumped || !m.map || m.transparent || !(m.customProgramCacheKey?.() ?? "").startsWith("twoTone")) continue;
      m.bumpMap = m.map; m.bumpScale = k; m._bumped = true; m.needsUpdate = true;
    }
  });
};
const Composer = EffectComposer as unknown as React.FC<{ multisampling?: number; children?: React.ReactNode }>;
const fwd = new THREE.Vector3();

const Inner: React.FC<{ kit: LabKit }> = ({ kit }) => {
  const f = useStoryFrame();
  const { camera, scene, gl } = useThree();
  const on = useMemo(postOpt, []); const lab = useMemo(labOpt, []);
  const sun = useMemo(() => (lab.sun ? new THREE.Vector3(...lab.sun).normalize() : LAB_SUN.clone()), [lab]);
  const world = useMemo(() => { const w = new LabWorld(kit, { pbr: lab.pbr, kit: lab.kit, sun, fx: lab.fx ?? lab.kit }); bumpify(w.root, BUMP_K); return w; }, [kit, lab, sun]);
  // light-preset overrides for kit tests (two-tone shade colour / lift, world saturation)
  if (lab.shade) TONE.uShadeCol.value.set(...lab.shade);
  if (lab.lift) TONE.uShadeLift.value.set(...lab.lift);
  if (lab.sat) TONE.uSat.value = lab.sat;
  const env = useMemo(() => envFromSky(gl, "day", sun), [gl, sun]);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <Composer multisampling={4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
    </Composer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  const focus = world.update(f, cam);
  scene.environment = lab.env ? env : null;
  scene.environmentIntensity = lab.envK;
  scene.fog = world.fog; scene.background = null;
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = lab.cInf * 0.5; // DOF_K 0.5 (newest-4 study)
  return (<><primitive object={world.root} dispose={null} />{post}</>);
};

export const LabShort: React.FC = () => {
  const [kit, setKit] = useState<LabKit | null>(null);
  const [handle] = useState(() => delayRender("lab kit"));
  useEffect(() => { loadLabKit(labOpt().kitFiles, labOpt().kit).then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  if (!kit) return null;
  const dpr = postOpt().dpr;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas width={1080} height={1920} {...(dpr ? { dpr } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 38, near: 0.1, far: 2400 }}>
        <Inner kit={kit} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
