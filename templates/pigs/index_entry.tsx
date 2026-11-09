// Own entry for the pigs short: registers only its compositions (src/Root.tsx stays untouched).
import React from "react";
import { Composition, registerRoot } from "remotion";
import { PigsShort, PIGS_FRAMES } from "../../videos/pigs/Pigs";

const Root: React.FC = () => (
  <>
    <Composition id="PigsShort" component={PigsShort} durationInFrames={PIGS_FRAMES} fps={30} width={1080} height={1920} />
    {/* 4 sub-frames per story frame: ffmpeg tmix averages them into 30 fps with real motion blur */}
    <Composition id="PigsShortHQ" component={PigsShort} durationInFrames={PIGS_FRAMES * 4} fps={120} width={1080} height={1920} />
  </>
);
registerRoot(Root);
