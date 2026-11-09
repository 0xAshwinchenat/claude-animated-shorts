// Asset-kit / material test scene (2026-11-09). Own entry: src/Root.tsx stays untouched.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { LabShort, LAB_FRAMES } from "../../videos/assetlab/Lab";

const Root: React.FC = () => (
  <>
    <Composition id="AssetLab" component={LabShort} durationInFrames={LAB_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AssetLabHQ" component={LabShort} durationInFrames={LAB_FRAMES * 4} fps={120} width={1080} height={1920} />
  </>
);
registerRoot(Root);
