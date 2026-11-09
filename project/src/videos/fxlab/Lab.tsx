// FX lab composition: the vfx.ts effects in a plain day scene, through the shorts' post chain (Pigs.tsx):
//   InkPass -> lens blur pre + main -> bloom (emissive only, threshold 1.0) -> NEUTRAL tone map -> day grade, MSAA 4.
// FxLab = 30 fps; FxLabHQ = 120 fps (4 sub-frames per story frame, 180 deg shutter, like Pigs2ShortHQ: ffmpeg tmix
// averages each group of 4 into one 30 fps frame).
// inputProps: { fx?: StageName, nofx?: true (same stage, no effects), prof?: true (logs FXPROF gpu/cpu ms per frame),
//   cam?: { look, r, h, a0, da, fov, cInf } (override the stage orbit), post?: { ink, lens, bloom, grade, shutter, dpr }, f0?: frame offset }
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { LabWorld, LAB_FRAMES, type StageName } from "./labworld";

export { LAB_FRAMES };
type Props = { fx?: StageName; nofx?: boolean; prof?: boolean; cam?: { look?: [number, number, number]; r?: number; h?: number; a0?: number; da?: number; fov?: number; cInf?: number }; f0?: number; post?: { ink?: boolean; lens?: boolean; bloom?: boolean; grade?: boolean; shutter?: number; dpr?: number } };
const props = () => getInputProps() as Props;
const SHUTTER = 0.5;

/** story frame (30 fps units, fractional in the 120 fps HQ composition) */
const useStoryFrame = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const sub = fps / 30;
  const f0 = props().f0 ?? 0;
  if (sub <= 1) return f + f0;
  const n = Math.floor(f / sub), k = f - n * sub;
  return f0 + n + (k * (props().post?.shutter ?? SHUTTER)) / sub;
};

/** bloom as in Pigs.tsx: MIP chain anchored to 1080x1920 so the glow size is resolution independent */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass; const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const Composer = EffectComposer as unknown as React.FC<{ multisampling?: number; children?: React.ReactNode }>;
const fwd = new THREE.Vector3();

const Inner: React.FC = () => {
  const f = useStoryFrame();
  const { camera, scene, gl } = useThree();
  const p = props(), on = { ink: true, lens: true, bloom: true, grade: true, ...(p.post ?? {}) };
  const world = useMemo(() => new LabWorld(p.fx ?? "all", !p.nofx, p.cam ?? {}), []); // eslint-disable-line react-hooks/exhaustive-deps
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => { fx.ink.dispose(); for (const e of world.fx) e.dispose(); }, [fx, world]);
  const cam = camera as THREE.PerspectiveCamera;
  const t0 = performance.now();
  const focus = world.update(f, cam, scene);
  world.root.updateMatrixWorld(true);
  const cpuMs = performance.now() - t0;
  // profiling only (inputProps prof: true): GPU-synced cost of the MAIN scene render (sun shadow map + every mesh, MSAA 4,
  // 1080x1920) averaged over 8 renders, plus the CPU cost of world.update (all effect updates). The post chain is the
  // same with or without effects, so stage - nofx = what the effects cost. The output image is not meaningful then.
  const profRT = useMemo(() => (p.prof ? new THREE.WebGLRenderTarget(1080, 1920, { samples: 4, type: THREE.HalfFloatType }) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!profRT) return;
    const ctx = gl.getContext(), px = new Uint8Array(4);
    const sync = () => { gl.setRenderTarget(null); ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); };
    gl.setRenderTarget(profRT); gl.render(scene, cam); sync();
    const a = performance.now();
    for (let i = 0; i < 8; i++) { gl.setRenderTarget(profRT); gl.render(scene, cam); }
    sync();
    console.log(`FXPROF f=${f} gpu=${((performance.now() - a) / 8).toFixed(3)} cpu=${cpuMs.toFixed(3)}`);
  });
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = world.stage.cInf;
  gradeFor(fx.grade, "day");
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <Composer multisampling={4}>
        {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
        {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
        {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
        {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
        <primitive object={fx.tone} dispose={null} />
        {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      </Composer>
    </>
  );
};

export const FxLab: React.FC = () => {
  const dpr = props().post?.dpr;
  return (
    <AbsoluteFill style={{ background: "#a8c6ee" }}>
      <ThreeCanvas width={1080} height={1920} {...(dpr ? { dpr } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.1, far: 1200 }}>
        <Inner />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
