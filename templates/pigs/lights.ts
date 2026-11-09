// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export type LightName = "day" | "golden" | "night" | "storm";
export const LIGHTS: Record<LightName, LightPreset> = {
  day: {
    az: 118, el: 46,
    lit: [1.55, 1.5, 1.42], shade: [0.3, 0.31, 0.42], lift: [0.04, 0.05, 0.1], lambert: 0.75, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#2564d0", hor: "#a8c6ee", skyCurve: [0.0, 0.5, 0.6], fog: "#a8c6ee", fogNear: 40, fogFar: 460, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.45, 0.78, 0.38], shade: [0.36, 0.28, 0.32], lift: [0.06, 0.07, 0.15], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  // moonlight (Helike, winter night 373 BC): cool key from a high moon, deep blue shade, navy sky, short fog
  night: {
    az: 55, el: 38,
    lit: [0.56, 0.66, 1.05], shade: [0.11, 0.125, 0.23], lift: [0.04, 0.05, 0.12], lambert: 0.35, sideK: 0.84, term: 0.15,
    charTint: [0.58, 0.66, 0.95], charShade: 0.8, charGrad: 0.09, bodyGrad: 0.22, sideTint: [0.8, 0.84, 1.0],
    blob: [0.5, 0.52, 0.7], actorShadow: false,
    top: "#0b1430", hor: "#2a3c6a", skyCurve: [0.0, 0.5, 0.6], fog: "#22325a", fogNear: 30, fogFar: 320, sunDisc: "#e6ecff",
    sunCol: "#b9cbff", sunI: 1.6, sky: "#3a4c80", ground: "#2a2a40", hemiI: 0.35,
    bias: -0.00025, normalBias: 0.015,
  },
  // overcast storm (Skara Brae today, shots 31-34): flat grey-blue key, soft shade, low grey sky, short fog (bay owner tunes)
  storm: {
    az: 100, el: 35,
    lit: [0.95, 1.0, 1.08], shade: [0.3, 0.33, 0.4], lift: [0.06, 0.07, 0.1], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [0.88, 0.92, 1.0], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.9, 0.92, 1.0],
    blob: [0.55, 0.57, 0.65], actorShadow: false,
    top: "#4a5568", hor: "#9aa6b8", skyCurve: [0.0, 0.5, 0.6], fog: "#8d99ab", fogNear: 20, fogFar: 220, sunDisc: "#000000",
    sunCol: "#dfe7f2", sunI: 1.6, sky: "#b6c2d4", ground: "#5a5e66", hemiI: 0.7,
    bias: -0.00025, normalBias: 0.015,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightName, WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#a8c6ee", "#80aeea", "#4d8ae0", "#2f6fd8", "#1d58c8"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1c5f86", mid: "#2a7fa0", far: "#6fa6b4", crest: "#ffd9a0", trough: "#123f63", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  night: {
    sky: { c: ["#2a3c6a", "#22335f", "#1a2850", "#121d3d", "#0a1229"], e: [0, 3, 9, 18, 40] },
    water: { near: "#13284e", mid: "#1b3664", far: "#2c4374", crest: "#5f7fb8", trough: "#0a1834", glint: "#d8e4ff", shade: [0.45, 0.5, 0.7] },
    cloud: { lit: "#8a9cc8", mid: "#5d6f9c", shade: "#3c4a74" },
    bounce: [0, 0, 0.01],
    sat: 0.72,
  },
  storm: {
    sky: { c: ["#9aa6b8", "#8794a8", "#717f96", "#5d6a80", "#4a5568"], e: [0, 3, 9, 18, 40] },
    water: { near: "#3f5f68", mid: "#32505c", far: "#52687a", crest: "#7d9ba0", trough: "#1f323c", glint: "#e8eef4", shade: [0.5, 0.55, 0.65] },
    cloud: { lit: "#c3cad6", mid: "#9aa4b4", shade: "#6c7686" },
    bounce: [0, 0, 0],
    sat: 0.8,
  },
};
