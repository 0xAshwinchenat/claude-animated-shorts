// Toon3D lab composition: the 3D toon cast in a small set, through the same post chain as the shorts
// (ink -> lens pre/main -> bloom -> NEUTRAL tone map -> grade, MSAA 4).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { LabWorld, LAB_FRAMES } from "./labset";

export { LAB_FRAMES };
const Composer = EffectComposer as unknown as React.FC<{ multisampling?: number; children?: React.ReactNode }>;
const fwd = new THREE.Vector3();

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new LabWorld(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  const focus = world.update(f, cam, scene, Number((getInputProps() as { rollTest?: number }).rollTest ?? 0));
  world.root.updateMatrixWorld(true);
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = 10;
  gradeFor(fx.grade, "day");
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <Composer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </Composer>
    </>
  );
};

export const Toon3DLab: React.FC = () => (
  <AbsoluteFill style={{ background: "#9cc3e6" }}>
    <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.1, far: 400 }}>
      <Inner />
    </ThreeCanvas>
  </AbsoluteFill>
);
