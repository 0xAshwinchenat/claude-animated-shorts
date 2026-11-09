# Asset-kit / material lab (2026-11-09)

Test scene for the "match the reference channel's newest look" work: an ancient market street at midday, one 3 s push-in,
the 3D toon cast (merchant, soldier, kid, a walking hero, five shoppers). Sandbox entry `src/sandboxes/assetlab/index.tsx`,
compositions `AssetLab` (30 fps) / `AssetLabHQ` (120 fps, 180 deg shutter). Stills: `D:\youtube\out\assetlab\ab\`.

## Files
- `pbr.ts`: `pbrTone(m)` = PBR material whose diffuse is the world's two-tone light (same lit/shade/terminator/shadow as
  shade.ts) and whose specular stays physically based (sun highlight masked by its shadow, clearcoat, Fresnel, reflections
  of `scene.environment`). `envFromSky(gl, light, sunDir)` = PMREM of our own sky gradient + ground + sun glow.
  `gloss({color, metal, rough, coat})` cached glossy materials; `toneObject(o)` converts an imported GLB (shipped
  roughness/metal maps win; name rules only for flat-colour packs).
- `labworld.ts`: the scene. `mode.pbr` glossy vs matte props; `mode.kit` = asset-kit street (Quaternius prefab houses +
  props, ambientCG PBR cobbles) vs the old procedural street (build.ts houses + Kenney stalls).
- `Lab.tsx`: post chain as the shorts; inputProps `{ post: { ink, lens, bloom, grade }, lab: { pbr, env, envK, kit, cInf,
  sun, shade, lift, sat } }`.

## Results (stats = ref-study-1109/tools/ab.py: lum / p2 / warm R-B / sharp p90 |Laplacian|, caption band masked)
| variant | lum | p2 | warm | sharp |
|---|---|---|---|---|
| A old matte props, procedural street | .508 | .047 | -.069 | .135 |
| B glossy props + sky env | .508 | .046 | -.072 | .136 |
| C = B without world ink | .525 | .138 | -.067 | .098 |
| D = B + bumpify | .505 | .046 | -.073 | .148 |
| K asset-kit street (cInf 6) | .405 | .023 | -.113 | .135 |
| N = K, lighter DOF (cInf 2) | .404 | .013 | -.114 | .204 |
| S = N + CAS 0.4 (as the final) | .403 | .012 | -.114 | .220 |
| Q = S + sun behind-right, shade [.5,.52,.64], sat 1.2 | .392 | .018 | -.067 | .201 |
| reference r1 (newest) | .307 | .069 | -.213 | .217 |
| reference r2 | .399 | .141 | -.196 | .242 |

## Conclusions
- Gloss works (bronze / glaze read as metal / ceramic, `out/assetlab/zoom_AB_45.jpg`) but only shows when props are big
  in frame. Default ON (cheap).
- Dropping world ink makes the PROCEDURAL world soft (C). With kit assets the ink pass still draws silhouettes; keep ink.
- The asset kit is the big step: modelled houses, tiled roofs, normal-mapped cobbles (`out/assetlab/DK_45.jpg`).
- With kit + lighter DOF + CAS the numbers match the reference (S); Q is the best-looking balance (`SPQ_45.jpg`).
- Still behind: density (his frames are packed with props and people), vivid stylised colour (his palette is cooler,
  warm -0.2), and VFX (helper building `src/videos/fxlab`).
- Kit lighting for textured assets: shade [0.5, 0.52, 0.64] (the procedural-world day shade 0.3 crushes textured
  facades), world saturation 1.2, DOF cInf ~2 on wide shots (the game look keeps backgrounds mostly in focus).
