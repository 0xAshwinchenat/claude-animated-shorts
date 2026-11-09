// Sandbox entry: the VFX lab (src/videos/fxlab/vfx.ts), registers only its own compositions (src/Root.tsx stays untouched).
// inputProps: { fx: "all" | "smoke" | "burst" | "explosion" | "trail" | "fire" | "debris" | "empty" | "stress" | "stress3",
//   nofx?, prof?, cam?, f0?, post?: {...} } (see src/videos/fxlab/Lab.tsx and VFX.md)
import React from "react";
import { Composition, registerRoot } from "remotion";
import { FxLab, LAB_FRAMES } from "../../videos/fxlab/Lab";

const Root: React.FC = () => (
  <>
    <Composition id="FxLab" component={FxLab} durationInFrames={LAB_FRAMES} fps={30} width={1080} height={1920} />
    {/* 4 sub-frames per story frame: ffmpeg tmix averages them into 30 fps with real motion blur */}
    <Composition id="FxLabHQ" component={FxLab} durationInFrames={LAB_FRAMES * 4} fps={120} width={1080} height={1920} />
  </>
);
registerRoot(Root);
