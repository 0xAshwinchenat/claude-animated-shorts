// Own entry for the Kaifeng "dirt wall" short: registers only its compositions (src/Root.tsx stays untouched).
import React from "react";
import { Composition, registerRoot } from "remotion";
import { KaifengShort, KAIFENG_FRAMES } from "../../videos/kaifeng/Kaifeng";

const Root: React.FC = () => (
  <>
    <Composition id="KaifengShort" component={KaifengShort} durationInFrames={KAIFENG_FRAMES} fps={30} width={1080} height={1920} />
    {/* 4 sub-frames per story frame: ffmpeg tmix averages them into 30 fps with real motion blur */}
    <Composition id="KaifengShortHQ" component={KaifengShort} durationInFrames={KAIFENG_FRAMES * 4} fps={120} width={1080} height={1920} />
  </>
);
registerRoot(Root);
