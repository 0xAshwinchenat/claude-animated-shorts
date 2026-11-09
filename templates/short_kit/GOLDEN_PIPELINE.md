<!-- copy of the GOLDEN PIPELINE section of SKILL.md (regenerate it from there after any change) -->
## GOLDEN PIPELINE (how the Kaifeng short was built and the pigs short perfected; do it this way every time)
Paths: `<P>` = the Remotion project (the user's is `D:/youtube`), `<name>` = short id (e.g. `pigs`), `<Comp>` =
component prefix (e.g. `Pigs`), `<P>/<name>-short/` = the short's kit folder (copy of `templates/short_kit/`).
Total ~4-5 h after the script is approved.

**0. Setup (once per machine).** Remotion 4 + `@remotion/three`, three 0.170, R3F 9, React 19,
`@react-three/postprocessing` pinned to 3.0.4; Node, Python 3 (numpy, scipy, pillow), ffmpeg with rubberband,
`pip install faster-whisper` (model small.en), Chrome. Copy `templates/scripts/*` to `<P>/scripts/`. Render temp on a
big drive (`TEMP=TMP=D:/remotion-tmp`). Optional Kenney CC0 GLBs in `<P>/public/bridge/kenney/` (missing ones are skipped).

**1. Research + script, then STOP for approval.**
- Find the ONE story with a visible physical cause and effect behind the user's topic; verify the key facts in a primary
  source (Kaifeng: History of Jin ch. 113 on zh.wikisource, quoted in Chinese). Drop weaker popular answers that have
  no story (sticky-rice mortar).
- `<name>-short/SCRIPT.md`: facts + sources, then the **SCRIPT TEMPLATE** output above (Title / Script at 135-150 words: a hook
  under 10 words, one context line, 3 visual steps, a 2-line twist / Visual cues x3). Kaifeng's older ~240-word version is in `templates/short_kit/SCRIPT_kaifeng.md` as a
  file-format example only. **Never put stage directions inside the script
  text** (the user's TTS read "The camera rises to show 400 catapults firing" aloud). Show it; wait for "yes".

**2. Voice (gold standard: ElevenLabs Jesse, UNPROCESSED).** Generate it yourself once the script is approved:
- `voice/script.json` = the approved lines; `voice/data/el/script_tts.txt` = the same text joined with spaces, with
  numbers spelled the way they should be said ("Greece, two sixty-six BC."; at faster speeds the model fumbled "266").
- `python scripts/el.py tts 4N8zjn9tVNuDEBFWVHAq <name>-short/voice/data/el/script_tts.txt <...>/data/el/jesse.mp3
  <...>/data/el/jesse_align.json eleven_v4 asis` (the key comes from `HKCU\Environment\ELEVENLABS_API_KEY`; `asis` sends
  NO voice_settings, so the voice's stored settings apply: stability 0.5, similarity 0.75, style 0, speed 0.98).
  Model `eleven_v4` is what the ElevenLabs site plays; multilingual_v2 and any speed / tempo / pause change made the
  user say the voice "sounds really different". ~900 characters per take (starter plan: 36,404 a month).
- Transcribe it with faster-whisper small.en and compare with the script (Whisper writes "Odessa" for Edessa, "Grease"
  for Greece: spelling only). Regenerate only a real misread.
- `cd <name>-short/voice && python prep_el.py data/el/jesse.mp3 data/el/jesse_align.json` -> `data/narration.wav`
  (a plain decode) + `data/words.json` / `words.txt` from ElevenLabs' character alignment (more exact than Whisper;
  NUMS folds "two sixty-six" back into "266").
- TOTAL = last word end + ~0.5 s. Print every word's frame (s x 30): every beat is planned on these frames.
- The user may also hand over an mp3: same steps from the transcription on (align with `align_words.py`), never
  processed. Kokoro am_michael (`make_voice.py`) is only the fallback when the user asks for it or ElevenLabs is out.

**3. The contract: `story.ts` (lead-owned).** Copy `templates/pigs/*` to `<P>/src/videos/<name>/`, rename
`Pigs.tsx` / `PIGS_FRAMES` / `PigsShort`, make `src/sandboxes/<name>/index.tsx` from `index_entry.tsx`
(`<Comp>Short` 30 fps + `<Comp>ShortHQ` 120 fps). `warp.ts` stays the identity (FILM_TOTAL = TOTAL). The rigs
(`city.ts` / `beasts.ts` / `venues.ts` / `chars.ts` + `cast.ts`) are the pigs ones: replace them per story (for a big
siege or crowd, `templates/kaifeng/siege.ts` + `camp.ts` are the better start). Rewrite story.ts for the new story,
keeping its shape:
- world layout constants (one place = one coordinate frame; venues far away, e.g. z 900 / z 1500 / x -900);
- beat functions in FRAMES from the words (`rampF`, one k-function per action, hit frames `F_*`);
- SHARED TRAJECTORIES as story.ts functions (projectiles `PROJ` / `projAt`, swarms like `battShots`, a bomb path, door
  angles, exact contact points): never let two owners guess the same motion;
- SHOTS (light + set per beat), XFADE (7 f dissolves at place / light changes), `RETENTION = { setPiece: [~303, ~470],
  resolve: <"You see" frame> }`, DOF, KICKS, PATHS (camrig `flow` per place).
world.ts (lead glue: sky, ONE world-fixed sun per place, fog per set / shot, the rigs, the cards; `prof` inputProps
switches for render-cost tests) and `<Comp>.tsx` stay as they are. Stub the rig files (`siege.ts`, `camp.ts`,
`venues.ts`, `chars.ts`) so it compiles; `npx tsc --noEmit -p .` clean. Audio + captions can be written now (they only
need words + beat frames): `audio/<name>_audio.py` (events on story frames + a period score, `sfxlib.py` blocks,
mix -15 LUFS, music +3 dB, SFX -6 dB), `captions/captions.py words.json captions.ass`.

**4. Four helper agents in parallel** (Agent tool, background, one owner per file). Sandboxes
`src/videos/<name>_{wall,camp,char,venue}` (full copies), entries `src/sandboxes/k_<owner>/index.tsx`; merge with
`python scripts/short_merge.py <name> <owners>`. Kaifeng owners: **wall** = the main place (`siege.ts` + `paintw.ts`),
**camp** = the second place, machines, projectiles, fx props (`camp.ts` + `paintc.ts`), **char** = 3D toon cast + card
crowds + effect cards (`chars.ts`, `toon3d.ts`, `cast.ts`, `toon.ts`, `cardshade.ts`), **venue** = the explanation
venues (`venues.ts` + `paintv.ts`). Each brief: the goal, owned files, the contract, a numbered build list with
constants and beat frames, the style rules (this file + STYLE_BIBLE + reference frames, private), determinism (pure in
(sid, f), fractional f, no Math.random) + performance (instancing, < 8 s stills), the stills command
`COMP=<Comp>Short BRIDGE_ENTRY=src/sandboxes/k_<owner>/index.tsx node scripts/stills.mjs out/<name>/<owner>/x_ <frames> 0.5`,
the frames to check, "type-check clean", "<= 150-word final report".
- Contract change mid-build: edit main story.ts, SendMessage the affected helpers the exact new values.
- Finished helpers keep their context: resume them with SendMessage for follow-ups.
- Merge each as it finishes, render merged stills, feed their requests back into the contract.

**5. Camera (lead) while they build.** `node scripts/cam_qa.mjs src/videos/<name>/story.ts --csv out/<name>/cam.csv`
and `python scripts/cam_speed.py out/<name>/cam.csv <from> <to> 4`. What made Kaifeng work:
- frame 0 = the hero facing the lens, low angle, mid-action, the event (his trebuchet) swinging behind him; a whip-pan
  (<= 16 f, <= ~30 deg) onto the moving object, then ride it to the next subject;
- the set piece = a pull-back over the crowd + a climb to a near top-down god's view (9:16 is only ~26 deg wide);
- `KF()` keys (look point 40 m down the ray) everywhere; drift holds between moves; restage any pan > ~40 deg;
- prop push-ins (5-12x zoom) become 7 f match dissolves into the macro set; crane up to people behind parapets;
- the ending matches frame 0's framing (the hero 3/4 close) so the short loops.
Aim for 13+/16 gates; the whip-length and rhythm gates may fail on fast transits (the motion blur covers them).
- **Never change `cam.near` / `cam.far` per shot or set.** postprocessing copies them into its depth reads only once
  (`EffectPass.mainCamera`), so per-set values make the lens blur read depth with a stale range: the focus misses in the
  VIDEO render while stills look fine (tunnel short, 2026-11-07). Use one pair everywhere (tunnel: 0.1 / 6000, also in
  the ThreeCanvas `camera` prop).
- **Camera holds with far look points:** camrig `hold(... push)` moves the lens a FRACTION of the way to the look point; with
  `KF` look points 40 m away that flies the lens through a close subject. Use an explicit metre advance (tunnel story.ts `H`).
- **Re-timing a voice (a new read AFTER the picture is built):** do NOT touch story.ts. The pigs way: keep the old
  words.json (`data/v1_*/`), run `short_kit/voice/make_warp.py` -> `data/warp.json` + `src/videos/<name>/warp.ts`
  (`FILM_TOTAL` + `warpF(g)`: film frame g plays old story frame warpF(g); `<Comp>.tsx`'s `useStoryFrame` applies it, so
  camera, cast, shots, DOF and FX all follow). Anchors: a line's start only where the old and new lines open with the
  same word, plus the action words matched inside each line (SYN for spellings like hung/hang). HOLD moves a lead-in's
  slow-down ("Does it work?") onto the shot BEFORE the action; speed is smoothed per segment, never across a hard cut.
  Check the speed runs it prints (aim 0.6-1.4x; brief 0.3x slow motion only on dramatic content). The audio script
  maps cues with F(old frame) -> new seconds and D(a, b) for lengths; captions come from the new words.json; the
  final's chunk check uses `PREV=preview1 WARP_JSON=<name>-short/voice/data/warp.json`. (Older way: tunnel's `T(v1)`.)

**6. Preview + review.** `npx remotion render src/sandboxes/<name>/index.tsx <Comp>Short out/<name>/preview1.mp4
--scale 0.5 --concurrency 3 --gl angle ...` (~7.5 min); every 15th frame -> 3 labelled contact sheets
(`scripts/sheet.py`); `python scripts/deep_qa.py preview1.mp4 out/<name>/shots.json x` (shots.json needs `shots`,
`flash`, `xfade`, `planned`). Look for cropped heads, subjects too far / small, characters hidden behind walls,
blank-wall holds, focus on the wrong thing. Check fixes with stills only.

**7. Final.** `NAME=<name> COMP=<Comp> bash <name>-short/final_chunked.sh` (the default; 120 fps 2K HQ in 320-frame
chunks, each checked frame by frame vs preview1 by `check_piece.py` and re-rendered if faulty -> decode + concat inside
the one tmix=4 encode -> mux mix.wav -> burn captions; ~1-1.5 h) -> `out/<name>/<name>_final.mp4` + `_nocaptions.mp4`.
Why chunked: one long 2K render runs Chrome out of RAM, and long 2K WebGL sessions lose textures (black sky and
ground) or go pure WHITE at random. Three shorts in a row hit this (babushka, lastride, pigs, 2026-11-08). The old
one-pass `final.sh` is for short renders only. Then, before delivering:
`python scripts/scan_final.py out/<name>/<name>_nocaptions.mp4 out/<name>/preview1.mp4` (every frame; look at
every flagged run: a camera re-keyed after the preview is fine, a fault is not), contact sheets of the whole final,
deep_qa the no-caption file (only intended impacts should flag), loudness (-15 LUFS). Late fixes: re-render only the
touched HQ range (multiples of 4) and `FIXES="a:b:file" NAME=<name> bash <name>-short/splice_final.sh`. Deliver both
paths + the one-subject title, copy the final to `videos to backup`, write UPLOAD.md; upload only when asked.
