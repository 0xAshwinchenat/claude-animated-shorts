// Sandbox entry: the 3D toon cast lab (toon3d.ts), registers only its own composition.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Toon3DLab, LAB_FRAMES } from "../../videos/toon3d_lab/Lab";

const Root: React.FC = () => <Composition id="Toon3DLab" component={Toon3DLab} durationInFrames={LAB_FRAMES} fps={30} width={1080} height={1920} />;
registerRoot(Root);
