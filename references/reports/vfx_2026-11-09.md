# vfx.ts: stylised-game VFX for the toon world

`src/videos/fxlab/vfx.ts` is a module of frame-pure 3D effects for the shorts' three.js world (Remotion 4 + three 0.170 + R3F 9).
They match the shorts' render pipeline: two-tone sun shading (shade.ts), bloom on emissive values above 1, NEUTRAL tone map and the day grade.

| Effect | What it is |
|---|---|
| `SmokePlume` | Chimney steam, chimney smoke or burning smoke: a column of shaded "cotton ball" puffs that rise, drift with the wind, grow and dissolve |
| `PuffBurst` | One-shot impact dust or smoke burst: a ring (or dome) of puffs thrown out and up from a point |
| `Explosion` | White-hot core flash, a fireball (glowing yellow, then orange, then sooty grey), a rising smoke cloud, a flat shockwave ring, ballistic sparks with one bounce, and a ground dust ring |
| `DustTrail` | Dust kicked up behind a moving point (wheels, hooves); the puffs stay where they were born |
| `Fire` | Stylised flame tongues (white-yellow heart, orange body, red tips, licking erosion), detached licks and rising embers. Sizes: torch, brazier, burning straw pack, bonfire |
| `Debris` | Rigid chunks (box, plank, wedge, stone, or your own geometry) that fly, tumble, bounce and settle ON the ground, with a dust puff on hard first impacts |

Private reference (look only, never copied): `D:\youtube\ref-study-1109\an\r2_vfx.jpg`, `r1_motion.jpg`.

## The contract (every effect)

```ts
import { SmokePlume, Explosion, Debris, Fire, SMOKE_PRESETS } from "./vfx";
const smoke = new SmokePlume({ ...SMOKE_PRESETS.chimney, source: [-6.3, 4.45, -5.1], start: -400, seed: 21 });
world.root.add(smoke.root);       // once, in the World constructor
smoke.update(f);                  // every frame, in World.update(id, f, ...)
smoke.dispose();                  // when the world is torn down
```

- `f` is the STORY FRAME at 30 fps and may be fractional: the 120 fps HQ render samples 4 sub-frames per frame. Pass the same `f` the rest of the world gets (pigs: `warpF(...)` output).
- `update(f)` is a pure function of `f` and the constructor options:
  - Randomness is seeded only (`mulberry32`, `hashInt`). There is no `Math.random`, no clock, and no state carried between calls.
  - Every particle is re-derived each call from its birth index `k`: birth time `tb(k) = start + (k + jitter_k) / rate`.
  - `Debris` runs its physics ONCE in the constructor (fixed 240 Hz step, 8 steps per frame) and only interpolates in `update`.
  - Checked by `vfxcheck.ts`: evaluating frames out of order gives exactly the in-order result.
- A negative `start` pre-rolls a steady emitter, so a chimney is already smoking at frame 0.
- A moving source is a function `f => [x, y, z]`. Particles are born at `pos(tb)` and left behind in world space.
- `root` can go anywhere in the scene, but every position is in WORLD metres, so keep `root` at the origin.

## Effects and options (defaults in brackets)

Shared look options: every puff effect takes `look?: PuffLook`.

| Option | Default | What it does |
|---|---|---|
| `term` | [-0.1, 0.38] | Soft two-tone terminator, as a smoothstep range over N.L |
| `lift` | 0.2 | Lifts the shade side toward the lit colour (0 = the world's shade colour, 1 = flat) |
| `lambert` | 0.35 | Cosine modelling kept inside the lit side |
| `shadowK` | 0.6 | How dark received sun shadows are, including shadows of other puffs (soft self-shadowing) |
| `heatK` | 1 | Emissive multiplier for heat |
| `depthPull` | 0.03 | Ink and occlusion bias toward the lens (see Ink below) |
| `detail` | 4 | Icosphere subdivision: 4 = 2562 vertices, 3 = 642 for far or tiny puffs |
| `castShadow`, `receiveShadow` | true | Sun shadow casting and receiving |
| `glow` | none | `{ pos, col, r }`: an orange under-light from a fire |

### SmokePlume(opts)
- `source: V3 | f => V3`. Emission window: `start` (0) and `end` (1e9).
- `rate` (0.6 puffs per frame) and `life` (110 frames).
- Motion:
  - `rise` (0.045 m per frame) slows to `riseEnd` (0.25) times that by the end of life.
  - `wind` ([0.012, 0, 0.004] m per frame) is picked up over the first 20 % of life.
  - `spread` (0.12 m) is the emitter disc radius; `widen` (0.006) opens the column; `turb` (0.35 m) is a slow wobble.
- Puffs: `size` ([0.25, 1.1] m radius at birth and at death), `color` / `colorEnd` (sRGB), `lump` (0.32) and `boil` (0.02, how fast the lobes churn).
- Fade and heat: `dissolveAt` (0.5 of life), `heat` with `heatLife` (puffs that leave the source glowing; 0 = off), `seed`, `max`.
- `SMOKE_PRESETS.steam | chimney | burning` hold tested colours, sizes and rates. Spread one and override.

### PuffBurst(opts)
- `pos` and `at` (the impact frame).
- `count` (14 ring puffs) and `inner` (3 centre puffs).
- `speed` (0.12 m per frame outward, drag e-folds over 6 frames) and `up` (0.012).
- `size` ([0.16, 0.52]), `life` (38), `color` (#c8b08c dust), `ring` (true = hugs the ground, false = a dome), `lump`, `seed`, `look`.

### Explosion(opts)
- `pos`, `at`, `size` (1.5 m fireball radius) and `groundY` (0).
- Particle counts: `puffs` (30 fireball), `smoke` (26 cloud) and `sparks` (44).
- `ring` (true) is the flat shockwave ring. It lies on the ground when the blast is near it, otherwise in the blast plane.
- `dust` (automatic when the blast is within 1.5 x size of the ground) adds a ground dust ring.
- Colours: `soot`, `smokeColor`, `dustColor`. Also `seed` and `look`.
- Timeline (t = f - at):
  - t 0-8: white-hot flash (heat 1.65, swells in 2 frames).
  - t 0-3: fireball puffs launch. They glow (heat 1.25, e-fold 3-8 frames), turn orange and then sooty grey by about t 20, and dissolve over 55-90 frames.
  - t 0-16: the ring expands to about 6.5 x size and fades. Its band is widened by its own expansion over half a frame, so in the 120 fps HQ + tmix render it smears into one front instead of 4 stacked rings.
  - t 0-40: sparks fly.
  - t 4-40: smoke-cloud puffs are born and rise, living 85-115 frames.

### DustTrail(opts)
- `pos: f => V3` is the contact point on the ground, for example `[wheelX(f), 0, z]`. Also `start` and `end`.
- `rate` (1 puff per frame at full speed).
- `minSpeed` (0.02 m per frame: no dust below this) and `fullSpeed` (0.12: full-size puffs).
- `life` (42), `size` ([0.14, 0.5]), `spread` (0.15 m sideways), `kick` (0.35 m backward), `rise` (0.008), `color` (#c9b08a), `lump`, `seed`, `look`, `max`.

### Fire(opts)
- `pos: V3 | f => V3` is the base centre.
- `size` is the flame height in metres:

  | Use | size |
  |---|---|
  | Torch | 0.35 |
  | Straw pack on a pig | 0.55 |
  | Brazier | 0.75 |
  | Burning pile | 1.1 |
  | Bonfire | 1.6 |

- `radius` (0.32 x size) and `tongues` (5 + 6 x size, at most 24).
- `start` and `end`, with `grow` (6 frames to ignite) and `fade` (8 frames to die).
- `licks` (0.5 per frame) and `embers` (0.3 + 0.3 x size per frame).
- `wind` (lean). A moving `pos` leans the flames back against the motion automatically.
- `fire.light(f, k)` returns `{ pos, col, r }`. Feed it to shade.ts `GLOW` (world materials) or to `PuffLook.glow` (smoke above the fire):
  `const l = fire.light(f); GLOW.uGlowPos.value.set(...l.pos); GLOW.uGlowCol.value.set(...l.col); GLOW.uGlowR.value = l.r;`

### Debris(opts)
- `pos` and `at`. `volume` ([0.3, 0.3, 0.3] half extents): chunks start scattered inside this box, so match it to the object that breaks.
- Chunks: `count` (24), `shapes` (box, plank, plank, wedge, stone, cycled), `size` ([0.12, 0.34] m), `colors` (wood) and `stoneColors`.
- Or `parts: { geometry, material, mass? }[]` for your own pieces. Centre each geometry on its centre of mass.
- Launch: `dir` ([0, 1, 0]), `cone` (55 degree half-angle), `speed` ([3, 7.5] m/s), `radial` (0.6: how much the direction points away from `pos`) and `spin` (9 rad/s).
- Physics: `groundY` (0), `restitution` (0.32), `friction` (0.62), `gravity` (9.8) and `simSeconds` (6).
- Dust: `dust` (true) puffs on the first hard impact of chunks larger than `dustMin` (0.2 m). `dustColor` sets their colour.
- `showBefore` (false): chunks appear at launch. Hide the intact object yourself at `at`.
- `debris.restFrame` is the frame by which every chunk is frozen.
- How the physics works:
  - Each chunk is a rigid body: a box inertia tensor, plus contact points at its hull vertices.
  - Contacts use sequential impulses (6 iterations) with restitution only on hard hits (below -0.9 m/s) and Coulomb friction.
  - Positional projection means a chunk never goes below the ground. Rolling resistance stops endless rolling.
  - A chunk sleeps (freezes) after 0.25 s of slow contact on 3 or more points. It is then snapped exactly onto the plane, so there is no jitter.
  - Chunks do not collide with each other or with walls; only the ground plane.

## Pipeline choices
- Shading (puffs):
  - A `MeshLambertMaterial` patched like shade.ts `twoTone`: the same `TONE` uniforms (uLitCol, uShadeCol, uSideK) and the same captured sun visibility (`LFB`: the sun is directional light 0 and the only shadow caster).
  - On top: a softer terminator, a shade-side lift, and partial self-shadowing (`shadowK`).
  - The vertex shader displaces a unit icosphere with two octaves of billow value noise and computes the analytic normal, giving lumpy cauliflower puffs with crisp silhouettes.
- No sorted transparency:
  - Puffs are opaque and write depth. They dissolve by scale-down plus a noise-driven vertex EROSION: lobes shrink unevenly, so the puff breaks up as it goes.
  - The first version used a fragment-discard dissolve. It left hollow "eggshell" shards and was replaced.
  - Fire erodes with a scrolling-noise `discard`.
  - The only blended object is one shockwave ring per explosion, so nothing needs sorting.
- Emissive:
  - Explosion heat is a black-body ramp up to about 6x (white-hot).
  - Fire runs about 5x in the heart, about 2-3x in the body, and below 1 at the red tips, so only the hot parts bloom (threshold 1.0).
  - Sparks and embers use HDR instance colours.
  - Everything is linear HDR into the composer (NEUTRAL tone map, then the grade).
- Ink:
  - Puffs, fire, sparks and the ring are on `NOINK`: no world outlines, and they never cut holes in the world's lines.
  - Debris chunks stay on layer 0, so the InkPass outlines them like any other prop.
  - Puffs pull their view depth 3 % toward the lens (`depthPull`). The pixels don't move, but the InkPass then rejects outlines of objects buried in a puff.
  - Outlines of the part of an object that really pokes out of the dust still draw, which is correct.
- Shadows:
  - Puffs cast and receive the sun shadow. Their `customDepthMaterial` runs the same displacement and erosion, so a plume shades itself and the ground under it.
  - Debris casts and receives.
  - Fire, sparks and the ring cast none.
- Fog: puffs, fire and sparks use the scene fog.

## Adding effects to a short's world
1. Copy `vfx.ts` next to the short's `world.ts`. It imports `./shade` (TONE, LFB, twoTone) and `./ink` (NOINK), which every short folder already has.
2. Construct effects in the World constructor with story-frame times, `this.root.add(fx.root)`, and keep them in a list.
3. In `World.update(id, f, ...)`, call `fx.update(f)` for every effect, or `updateAll(list, f)`. Effects outside their time window cost almost nothing: they push 0 instances.
4. A fire near walls: feed `fire.light(f)` into shade.ts `GLOW` (one glow per shot).
5. Breaking an object: hide the intact mesh at `at` and start `Debris` + `Explosion` (or `PuffBurst`) at the same frame.

## Lab
- Entry: `src/sandboxes/fxlab/index.tsx`.
  - Compositions: `FxLab` (30 fps, 1080x1920, 240 frames) and `FxLabHQ` (120 fps, 4 sub-frames per frame, 180-degree shutter).
  - inputProps:
    - `fx`: one of all, smoke, burst, explosion, debris, trail, fire, empty, stress, stress3. Each value picks a stage: camera orbit plus the effects built. `stress` is one ~2000-puff plume (`stress3` uses detail 3).
    - `nofx: true` builds the same stage without effects (perf baseline).
    - `prof: true` logs `FXPROF f=.. gpu=.. cpu=..` per frame in `--log=verbose`.
    - `cam: { look, r, h, a0, da, fov, cInf }` overrides the stage orbit. Example: the debris-at-rest close-up used `{"fx":"debris","cam":{"look":[10.3,0.15,-2.6],"r":4.2,"h":0.55,"a0":30,"da":0}}`.
    - `post: { ink, lens, bloom, grade, shutter, dpr }`.
- Scene, in `labworld.ts`:
  - Dirt and grass ground, a road, the day sky gradient, and a sun with 4096 shadows.
  - A hut with a chimney, columns, crates and a wall, and a 1.7 m grey capsule in every area for scale.
  - A torch, a brazier, a burning pig proxy running laps, a cart on the road, and dropping boulders.
  - Times: explosion and debris at frame 60; boulder impacts at 34, 92 and 150.
- Commands:
  ```
  cd D:\youtube
  TEMP=D:/remotion-tmp TMP=D:/remotion-tmp npx remotion still src/sandboxes/fxlab/index.tsx FxLab out/fxlab/x.png --frame=70 --scale=0.5 --props='{"fx":"explosion"}'
  ```
- Headless checks (no GPU):
  ```
  npx esbuild src/videos/fxlab/vfxcheck.ts --bundle --platform=node --outfile=D:/remotion-tmp/vfxcheck.cjs && node D:/remotion-tmp/vfxcheck.cjs
  ```

## Perf (full 1080x1920, RTX 3050 laptop, ANGLE / D3D11, measured 2026-11-09)

### How it was measured
- GPU: lab `prof: true`. The full main scene render (sun 4096 shadow map plus every mesh, MSAA 4, half-float) runs 8 times into a 1080x1920 target, synced by a readPixels.
- CPU: `world.update` (all effect updates plus props).
- Frames 52-109, each stage with effects vs the same stage and camera without them (`nofx`).
- The post chain (ink, DOF, bloom, tone map, grade) is the same with or without effects, so it is left out.

### Results

| Stage | Main pass GPU, no fx | Main pass GPU, with fx | Ratio | CPU update, with fx |
|---|---|---|---|---|
| smoke: chimney plume (72 puffs) + burning-pile Fire 1.1 m + burning plume (61 puffs) | 1.50 ms | 1.65 ms | 1.10x | 0.54 ms |
| burst: 3 PuffBursts | 1.38 ms | 1.54 ms | 1.12x | 0.29 ms |
| explosion: Explosion size 1.6 + Debris 30 chunks | 1.27 ms | 1.67 ms | 1.31x | 0.57 ms |
| debris: Debris 30 chunks + impact dust | 1.43 ms | 1.38 ms | ~1.0x | 0.37 ms |
| trail: 2 DustTrails | 1.30 ms | 1.51 ms | 1.16x | 0.36 ms |
| fire: torch + brazier + straw-pack Fire, its plume and dust | 1.34 ms | 1.48 ms | 1.10x | 0.40 ms |
| all: 14 effects at once | 1.44 ms | 2.14 ms | 1.49x | 1.09 ms |
| stress: ONE plume of ~2000 puffs, detail 4 (detail 3) | 1.22 ms | 3.03 ms (2.52 ms) | 2.5x (2.1x) | 1.84 ms (1.30 ms) |

### Takeaways
- **Wall clock:** per-frame time through the CLI (concurrency 1, frames 52-109) is 90-145 ms in every stage, with or without effects. It is dominated by readback, encode and the post chain. With-fx vs no-fx differences are inside run-to-run noise (+-20 %), so every effect is far under the 1.5x budget for a whole frame.
- **Headless CPU (node, `vfxcheck.ts`):** update() costs 0.004-0.10 ms per call. Peak instances per effect:

  | Effect | Peak instances |
  |---|---|
  | Chimney plume | 72 |
  | Burning plume | 61 |
  | Burst | 17 |
  | Explosion | 101 |
  | Trail | 47 |
  | Brazier fire | 42 |
  | Debris | 144 (30 chunks + dust) |

  The Debris constructor runs its simulation once: 42 ms for 30 chunks x 6 s.
- **Budget:** keep any one PuffField under about 2000 puffs. Above about 500 puffs, or for far plumes, use `look: { detail: 3 }`.

## Strips and clips (all in `D:\youtube\out\fxlab\`)
- Naming: `<name>_strip.png` is selected frames side by side; `<name>_seq.png` is 8 CONSECUTIVE frames (4x2); `<name>_f<N>.png` is a single still (scale 0.5).

| Effect | Files | Frames |
|---|---|---|
| Smoke | `smoke_strip.png` | 40 / 100 / 160 |
| | `smoke_seq.png` | 100-107 |
| Fire | `fire_strip.png` | 40 / 124 / 150 |
| | `fire_seq.png` | 120-127 |
| Explosion | `boom_strip.png` | 61 / 63 / 66 / 72 / 84 / 110 / 150 |
| | `boom_seq.png` | 60-67 |
| Debris | `deb_strip.png` | 59 / 62 / 66 / 72 / 90 / 200 |
| | `deb_seq.png` | 66-73 |
| | `debris_rest_strip.png` | low close-up at rest, frames 200 and 230: pixel-identical |
| Burst | `burst_strip.png` | 33 / 36 / 40 / 46 / 55 / 70 |
| | `burst_seq.png` | 34-41 |
| Trail | `trail_strip.png` | 60 / 120 / 180 |
| | `trail_seq.png` | 100-107 |
| Everything | `all_strip.png` | 50 / 66 / 90 / 130 |
| Ceiling | `stress_f100.png` | the 2000-puff ceiling |

- Fractional frames come from the 120 fps comp with shutter 1:
  - `hq_all_f100frac_seq.png`: story frames 100 / 100.25 / 100.5 / 100.75.
  - `hq_fire_f120frac_seq.png`: story frames 120-120.75.
- `fxlab_demo.mp4`: the combined moment, story frames 52-163 (3.7 s, 540x960, 30 fps).
  - Rendered with FxLabHQ (120 fps) and tmix 4, so it has the production shutter motion blur.
  - `fxlab_demo_30fps_noblur.mp4` is the same moment straight from FxLab.

## Known weaknesses
- Puffs read as stylised cotton-ball smoke at short-to-mid range. Big dark masses (an explosion's late cloud, a burning plume seen from close) can still look a bit like a lumpy boulder. Keep dark smoke mid-grey (#5e5759 and lighter) and let it rise and dissolve.
- Late-life puffs break into small lobes; at the tail of a dust trail these can read as "crumbs". Shorten `life` or raise `dissolveAt` if they bother you in a shot.
- The young fireball (t 3-10) is mostly emissive orange with little lit/shade modelling; the shading appears as it cools.
- Debris chunks collide only with the ground plane, not with each other or with walls; place breakups away from walls or accept some interpenetration.
- The ink outline of an object that really pokes out of a dust cloud still draws (correct, but it can look busy). `depthPull` only hides outlines of parts that are covered.
- Self-shadowing uses the sun's shadow map, so far from the shadow camera's area (`shadowR` in the world) plumes lose it.
