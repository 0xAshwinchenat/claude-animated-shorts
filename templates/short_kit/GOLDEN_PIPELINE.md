## GOLDEN PIPELINE (exactly how the Kaifeng short was made; do it this way every time)
Paths: `<P>` = the Remotion project (the user's is `D:/youtube`), `<name>` = short id (e.g. `kaifeng`), `<Comp>` =
component prefix (e.g. `Kaifeng`), `<P>/<name>-short/` = the short's kit folder (copy of `templates/short_kit/`).
Total ~4-5 h after the script is approved.

**0. Setup (once per machine).** Remotion 4 + `@remotion/three`, three 0.170, R3F 9, React 19,
`@react-three/postprocessing` pinned to 3.0.4; Node, Python 3 (numpy, scipy, pillow), ffmpeg with rubberband,
`pip install faster-whisper` (model small.en), Chrome. Copy `templates/scripts/*` to `<P>/scripts/`. Render temp on a
big drive (`TEMP=TMP=D:/remotion-tmp`). Optional Kenney CC0 GLBs in `<P>/public/bridge/kenney/` (missing ones are skipped).

**1. Research + script, then STOP for approval.**
- Find the ONE story with a visible physical cause and effect behind the user's topic; verify the key facts in a primary
  source (Kaifeng: History of Jin ch. 113 on zh.wikisource, quoted in Chinese). Drop weaker popular answers that have
  no story (sticky-rice mortar).
- `<name>-short/SCRIPT.md`: facts + sources, 2 titles naming ONE specific subject, the script (~240 words, ~3.5 w/s,
  "You see," at ~70 %, nothing resolves before 15 s, 3 escalating beats, "Luckily / Unluckily", a loop ending), the
  picture idea. Example: `templates/short_kit/SCRIPT_kaifeng.md`. **Never put stage directions inside the script
  text** (the user's TTS read "The camera rises to show 400 catapults firing" aloud). Show it; wait for "yes".

**2. Voice.** The user may hand over their own TTS file (ElevenLabs). Transcribe it first, then
`voice/prep_voice.py <tempo>` (CUTS removes lines read by mistake, pauses trimmed to 0.36 / 0.24 s, `rubberband` tempo
to ~3.5 words/s, 48 kHz) -> `data/narration.wav`; `voice/align_words.py` (faster-whisper word times aligned to
`script.json`'s spelling; spoken numbers as digits) -> `data/words.json` + `words.txt`; hand-fix mis-heard words.
TOTAL = last word end + ~0.5 s. Print every word's frame (s x 30): every beat is planned on these frames.

**3. The contract: `story.ts` (lead-owned).** Copy `templates/kaifeng/*` to `<P>/src/videos/<name>/`, rename
`Kaifeng.tsx` / `KAIFENG_FRAMES` / `KaifengShort`, make `src/sandboxes/<name>/index.tsx` from `index_entry.tsx`
(`<Comp>Short` 30 fps + `<Comp>ShortHQ` 120 fps). Rewrite story.ts for the new story, keeping its shape:
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

**6. Preview + review.** `npx remotion render src/sandboxes/<name>/index.tsx <Comp>Short out/<name>/preview1.mp4
--scale 0.5 --concurrency 3 --gl angle ...` (~7.5 min); every 15th frame -> 3 labelled contact sheets
(`scripts/sheet.py`); `python scripts/deep_qa.py preview1.mp4 out/<name>/shots.json x` (shots.json needs `shots`,
`flash`, `xfade`, `planned`). Look for cropped heads, subjects too far / small, characters hidden behind walls,
blank-wall holds, focus on the wrong thing. Check fixes with stills only.

**7. Final.** `NAME=<name> COMP=<Comp> bash <name>-short/final.sh` (120 fps 2K HQ ~1 h -> tmix=4 motion blur -> mux
mix.wav -> burn captions) -> `out/<name>/<name>_final.mp4` + `_nocaptions.mp4`; deep_qa the no-caption file (only
intended impacts should flag). Late fixes: re-render only the touched HQ range (multiples of 4) and
`FIXES="a:b:file" NAME=<name> bash <name>-short/splice_final.sh`. Deliver both paths + the one-subject title; upload
only when asked.
