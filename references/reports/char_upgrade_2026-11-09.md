# pigs2 character upgrade (2026-11-09, CHARACTER helper)

Goal: the reference channel's character quality ("his characters and the expressions look really real"), measured in
`D:\youtube\ref-study-1109\FINDINGS.md` > Characters. General rules only: our cast, outfits and faces stay our own.
Files changed: `toon3d.ts`, `chars.ts` (nothing else in pigs2). Backups of both files before the change:
`D:\youtube\out\pigs2\faces\backup_pre\`.

## What changed (toon3d.ts)
1. **Crisp faces.** The face decal is 1536 px over 150 deg (was 512): 10.2 px per degree, crisp on a ~1100 px head in a
   2K close-up. The drawing stays in degree units, so the proportions did not change. Mipmaps on, anisotropy 16. The
   face cache is now an **LRU of 32** (each texture is ~8.8 MB with mips); evicted textures are disposed. The key covers
   only what the decal draws (not `t`), so the 3D FX never bust the cache.
2. **Bolder features.** Eyes ~1.3x bigger, still on the equator; brows 3.2 units thick (was 2.3) and 1.3x longer;
   feature lines ~1.4x heavier in a darker ink (`FACE_INK #1b141e`). Mouths are wider. Open mouths have a dark inside,
   a WHITE TEETH band split by thin lines (shout/shock show both rows), a tongue and an ink rim. Lid / angry / sly eyes
   clip the pupil under the lid line. Eyes are drawn AFTER the mouth and moustaches, so big shock eyes sit cleanly over
   a curled moustache.
3. **Expressions + face FX** (every old EXPR name still works, same look family):
   - On the decal: tear streams (boil every 4 f), laugh-cry spray, a sweat drop, blush with hatching, an anger vein on
     the temple, and gloom lines.
   - In 3D (`FaceFX`, a child of the head): steam puffs, dizzy stars and laugh-cry droplets. They switch on and off with
     the expression and are animated by `Expr.t`.
   - Head tint: `Expr.tint` ramps the head colour in over 3 f.
   - `exprTrack` now returns `t` = frames since the FX run began, so keys in a row with the same FX keep one clock.
   - `blink` skips `wide`, `xx`, `spiral` and `cry` eyes.
4. **Outfits.**
   - Cloth canvases are 3x (1536 x 768, drawn in the old 512 x 256 units).
   - Fabric weave on every cloth layer (`fabric`: linen / wool / twill / leather / none).
   - Dashed stitching: side seams, neckline, raglan seams on modern shirts, hems, pockets, belts, trims, collars, vests,
     the toga border. The thread colour is automatic, or set it with `stitch`.
   - Buttons with a rim, two holes and a highlight. Leather belts with stitched edges, holes and a framed buckle.
   - Lorica: rivets, shading and strap buckles.
   - New Outfit fields: `fabric`, `stitch`, `hem` (key / wave / dots / zigzag / band), `hemCol`, `emblem` (sun / star /
     lotus / wheel / leaf / crescent, shapes only, no letters), `patches`, `rope`, `cloakTrim`, `cloakFabric`,
     `togaBand`, `fibula`, `placket`.
   - The cloak got its own texture: wool, folds, and a trimmed border carrying the hem pattern.
5. **Hats and hair** (`hatTex`):
   - Carved strand grooves + a sheen ring on hair caps (hair, headband, tuft, frizz, the bald/laurel fringe); curl balls
     get C-swirls.
   - Felt + a stitched seam on the kausia, bowler, top hat and futou. Cap / newsboy get 6 / 8 stitched panels + a top
     button.
   - Turban: creased cloth. Diadem: gold edges.
   - Roman / Greek helmet: metal sheen, a stud row on the rim, studs on the cheek guards, an ear-to-ear ridge, a
     horsehair crest. Mongol hat: panels + fur. Sun hat: straw.
6. **Fixes to old bugs.**
   - The bald / laurel hair fringe used to run onto the face, showing as a pale "rectangle" over the writer's eye. It now
     keeps a 130 deg gap at the front.
   - The laurel wreath sat at brow height and hid the brows. It now sits on the crown (0.56 R).
   - The full beard now has a scalloped outer contour only. An ink rim round the mouth read as a giant grin.

## New EXPR list (the 8 old ones unchanged in name and intent)
| key | eyes / brows / mouth | FX | use |
|---|---|---|---|
| laugh | happy / up / laugh | | big open laugh |
| laughCry | xx `><` / up / laugh | tears "spray" + 3D droplets | cracking up |
| crying | cry / worried / wail | tears "stream" | sobbing |
| nervous | dot / worried / wavy | sweat | nervous |
| smugBrow | sly / raised1 / smirk | | smug side-eye, one raised brow |
| sly | sly / angry / slygrin | | scheming lopsided toothy grin |
| shockTeeth | wide / high / shock | | shock with both teeth rows bared |
| scream | wide / high / shout | sweat | terror yell |
| disgusted | squint / disgust / sneer | | lopsided sneer, teeth on one side |
| sleepy | sleepy / low / meh | | droopy lids |
| bored | sleepy / flat / flat | | deadpan boredom |
| furious | angry / furious / shout | tint FURY `#cf5a92`, 3D steam, vein | rage |
| dizzy | spiral / worried / wavy | 3D orbiting stars | stunned after a hit |
| blush | happy / worried / small | blush hatching | bashful / tender |
| dread | wide / worried / wavy | gloom lines, sweat | horror dawning |
| focus | dot / angry / tongueOut | | concentration, tongue out of the corner |

New parts usable in any `X({...})`:
- **Eyes:** `xx`, `spiral`, `sleepy`, `wide`, `cry`, `sly`.
- **Brows:** `furious`, `high`, `disgust`, `low`.
- **Mouths:** `laugh`, `shout`, `shock`, `wavy`, `sneer`, `wail`, `meh`, `slygrin`, `tongueOut`.
- **Flags:** `tears`, `vein`, `gloom`, `tint`, `steam`, `stars`, `t`.

## How chars.ts uses them (same key frames, no timing or camera change)
- **King Antigonus:**
  - Key 814: `shockTeeth` at "freeze" (was ring eyes + open mouth).
  - Keys 884 / 930 / 962: rage = `furious` with grit / shout mouths. The purple-red head now comes from the
    expression's tint, so `headCol: PURPLE` is gone.
  - Outfit: red wool with gold thread, a Greek-key hem, a gold sun emblem, a leather belt + gold buckle, and a cloak
    with a gold border.
- **Hero:**
  - Key 576: `tongue` became `tongueOut` (concentration).
  - Key 668: `scream` at the flare-up.
  - Key 690: `laugh` as the pigs charge.
  - Outfit: linen tunic, two stitched patches, a rope belt with hanging frayed ends, a banded hem.
- **Writer:**
  - Key 1045: `tongueOut`.
  - Outfit: linen, a blue toga border, a blue Greek-key hem, a fluffy beard, the wreath raised.
- **Trainers:**
  - Key 1196: trainer A gets `blush` while patting the piglet; trainer B keeps `happy`.
  - Trainer A: a teal stitched vest. Trainer B: a lotus emblem. Both: dotted hems.
- **Roman:**
  - Key 1459: `bored` at the torch dunk ("don't light anything").
  - Key 1466: `smugBrow` at the shrug.
  - Key 1570: `laughCry` at the squeal.
  - Outfit: wool tunic, a gold-banded hem, a studded helmet.
- **`KING_STEAM_3D = false`.** cast.ts still draws the OLD 2D steam cards from F_STAMPEDE + 6 (the "Antigonus' white
  anger steam" block). To use the 3D steam instead, delete that block in cast.ts and set the flag true. Never both.

## Sheets (all in `D:\youtube\out\pigs2\faces\`)
- **Old vs new, the 3 pigs frames:**
  - `sbs_pigs_240.jpg`, `sbs_pigs_1200.jpg`, `sbs_pigs_1380.jpg` (full res).
  - `sbs_pigs_540.jpg`: all three at 540 px wide, the readability check.
  - Background colour differences come from the lead's concurrent grade / light work, not from this change.
- **FaceSheet** (`src/sandboxes/pigs2faces`, composition `FaceSheet`; one page per frame):
  - `new_0..5.jpg`: every EXPR on each cast member (ant, hero, writer, trainerA, trainerB, roman).
  - `new_6` / `new_7`: full body, front and back. `new_8`: outfit close-ups. `new_9`: a giant 2K head.
    `new_10`: four big FX heads.
  - `old_*.jpg`: the same pages rendered with the old code.
  - Side-by-side pairs: `sbs_faces_king`, `sbs_faces_hero`, `sbs_outfits`, `sbs_giant`, `sbs_fullbody`.
- **Expression beats in the short:**
  - `beats_sheet.jpg` + `beats_zoom.jpg`: film frames 668, 799, 823, 1006, 1066, 1107, 1444, 1733, 1741, 1865.
  - `king_sheet.jpg`: the king at 30, 80, 996, 1029, 1057, 1081, 1119. 996 = shockTeeth.
- **Render commands:**
  - Sheets: `REMOTION_TMP=D:/remotion-tmp BRIDGE_ENTRY=src/sandboxes/pigs2faces/index.tsx COMP=FaceSheet node scripts/stills.mjs out/pigs2/faces/new_ 0,1,2,3,4,5,6,7,8,9,10 1`
  - Pigs frames: the same with `BRIDGE_ENTRY=src/sandboxes/pigs2/index.tsx COMP=Pigs2Short`.

## Known limits / not done
- **The king's furious face is barely seen in the short.** The stampede shots frame him from behind or tiny, so the tint
  and vein mostly show on the sheets.
- **Decal FX stay on the head surface.** Tears and the sweat drop wrap round the head and never cross its outline; the
  laugh-cry spray beyond the outline is the 3D droplets.
- **Eye size is held at the requested 1.3x.** The reference's eyes are ~2x our old size; bigger eyes would change the
  cast's look.
- **The open robe skirts still show dark jagged "teeth" at the hem.** This is the inverted hull seen through the open
  lathe. It was there before this change; it is geometry, not texture, so it was left alone.
- **3D steam is off for the king** (see `KING_STEAM_3D`), because cast.ts owns the old 2D steam.
- **Painted highlights do not move with the light:** the helmet sheen and the button / rivet highlights are fixed on the
  texture. They are kept mild.
- **Memory is bounded but higher:** ~32 face textures at 8.8 MB each, plus 1536 x 768 cloth textures (one per outfit /
  skirt / cloak / hat part).
