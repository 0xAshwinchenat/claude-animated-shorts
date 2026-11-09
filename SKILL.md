---
name: cartoon-3d-short
description: Make a ~55-70 s vertical cartoon story short in the "cartoon characters in a colourful 3D world" style (3D toon stick figures from toon3d.ts - sphere heads with swapped decal faces, bean torsos, plum ink-tube rubber-hose limbs, ball hands - plus flat cards for crowds, painted 3D town/world with black ink lines, saturated sky, depth-of-field backgrounds, gliding cameras, voice narration, synthesized SFX + march-style music), rendered with three.js inside Remotion. GOLD STANDARD - "The Burning Pigs That Beat an Army of Elephants" (Megara 266 BC + Edessa 544 AD, 2026-11-08; the user: "make videos in the same way like this next time the voice, narration and stuffs") - story-style narration, the ElevenLabs Jesse voice used exactly as generated, follow its GOLDEN PIPELINE section and start from templates/pigs. Earlier standards - Kaifeng 1232 (templates/kaifeng, 2026-11-06), "The Bridge That Fell for a Song" (2026-10-31). Use when the user asks for another video "like the bridge video", "like the soldiers/bridge short", "in that cartoon 3D style", a history/science story short with cartoon characters in 3D, or says "use the cartoon short skill". Also the DEFAULT for any short or video request that is NOT tagged "FC" ("FC" requests use the faceless-shorts skill).
---

# Cartoon 3D story short (three.js + Remotion)

**GOLD STANDARD (2026-11-08; the user: "thats a really good one. make sure to make videos in the same way like this
next time the voice, narration and stuffs. make it as gold standard"): "The Burning Pigs That Beat an Army of
Elephants"** - 65 s; Megara 266 BC (burning pigs rout Antigonus' war elephants) + the Edessa 544 twist. What makes it
the standard:
- **Narration:** a told story, not a fact list (SCRIPT TEMPLATE > Narration style): present tense, one so/but chain,
  one rhetorical question, one "You see," explanation, ending on the payoff word. 147 words.
- **Voice:** ElevenLabs **Jesse - Elearning (`4N8zjn9tVNuDEBFWVHAq`), model `eleven_v4`, the voice's own stored
  settings, UNPROCESSED** (no tempo, no pause trim, no EQ; `templates/scripts/el.py` + `short_kit/voice/prep_el.py`).
  The script is sized for the voice (~2.3 words/s), never the voice for the script.
- **Picture:** 3D toon cast (toon3d.ts), elephants + pigs rigs, 4 sets (Megara wall/city, the writer's room, the
  stable, golden-hour Edessa), continuous camera with a level horizon, ONE hard cut (into the pig pen), 7 f dissolves
  at place changes, burned-in word captions, a loop ending (the last shot rhymes with frame 0).
- **Finish:** 120 fps chunked 2K final, every chunk checked against the preview, every frame scanned, -15 LUFS.
Its full source is `templates/pigs/` (the project) + `templates/short_kit/` (voice, sound, captions, final assembly;
SCRIPT_pigs.md / SHOTPLAN_pigs.md / audio/pigs_audio.py are its files). **Make every new short the way the GOLDEN
PIPELINE section below says**; the rest of this file is the detail and the rules behind it.

Earlier standards: **Kaifeng** ("The Dirt Wall Genghis Khan's Best General Couldn't Break", `templates/kaifeng/`,
2026-11-06: ~1000 card extras, 400 instanced trebuchets; still the reference for big crowd/siege scenes) and **The
Bridge That Fell for a Song** (`templates/bridge/`, 2026-10-31).

The style reference is a channel studied privately (`references/`: STYLE_BIBLE.md, reports/*.md, frames/).
- Those videos are private study material. Never upload, publish or send them.
- Never copy their scripts, characters or shots. Story, characters and voice are always OUR OWN.
- Never say the channel's name in a voice-over or description.

User rules that apply:
- Word captions ARE burned in (the user asked for them; no other labels or readable signs in the art).
- English only.
- Voice: one steady tone.
- Jokes are researched real facts.
- Standard mix: music +3 dB, SFX -6 dB, voice unchanged.
- Final export 2K vertical: 1440x2560, `--scale 1.3333`.
- Opus max verifies every check.
- Save after every step.
- "Just do it" once the script is approved.

## SCRIPT STRUCTURE v3 (user rule, 2026-11-09; the newest: wins over v2 below where they clash)
The user's structure for every script from the Tut short on ("Give me one kitchen-object analogy every time"):
- [0:00-0:03] HOOK: a paradox in one line. Formula: [biggest name] + [tried X for Y days] + [failed vs tiny thing].
  Start with the impossible, never with a place or date. (Tut: "Tomb robbers hunted Tutankhamun's gold for three
  thousand years. Trash beat them.")
- [0:03-0:18] SETUP: who / where / when, one line each; who wants what, what stands in the way.
- [0:18-0:42] ESCALATION, 3 beats: a big attack; the defender counters in a weird way; the attacker tries even bigger
  and fails again. A new visual each beat.
- [0:42-0:56] MECHANISM: ONE analogy, a "like a..." line with a KITCHEN OBJECT, every time (Kaifeng pillow, bull
  cardboard tube, Tut "a coin under the toaster").
- [0:56-0:65] TWIST + LOOP: an ironic ending, then a 1-line loop question back to the hook ("So how did trash beat...").
- Checklist before animating: hook has a name + number + failure? 3 different visuals before 0:40? One "like a"
  line? Last line ironic?
- LENGTH: the user wrote "210-240 words for 60-70 sec", but Jesse unprocessed reads 2.1-2.3 words/s (210 words =
  ~95 s). Asked on the Tut script, the user chose to CUT to ~150 words for Jesse's natural pace (Tut: 156 words =
  67.4 s). Default: v3 structure at ~145-160 words. Never speed the voice up instead.
- A topic phrased as a category ("Buried Finds That Were Never Meant to Be Seen") becomes ONE find told as one story
  (the one-subject title rule); offer the list version in one line.

## SCRIPT TEMPLATE (user rule, v2 2026-11-07; use for EVERY new script)
Channel: **Zed Animate**: viral faceless shorts, fast animated storytelling in the reference channel's format. The tone is clear, visual, slightly dramatic and conversational, for curious viewers aged 18-35. This template overrides the older script rules below (the ~240 words, "You see," at ~70 %, the bridge beat formula) wherever they clash. The channel-audit retention rules still apply.

**Length:** 135-150 words for ~60 s. The user restated this in v2, so it stands. Sentences are 8-12 words max, short sentences only.

**Hook (line 1), under 10 words, no intro.** Use ONE of these patterns:
- "This [specific thing] did [surprising / shocking job]."
- "What if [specific scenario] happened to you?"
- "Nobody could [do X] until [unexpected twist]."
- The viewer must know the payoff within 2 s.
- Never start with "Hi guys", "Today", "In history", a date or any context.

**Structure:**
1. **Line 1:** the hook, with the payoff in it.
2. **Line 2:** the context in ONE line: who + when / where. Example: "Sicily, 560 BC. Tyrant Phalaris."
3. **Middle, ~80 words:** explain it in 3 visual steps (step 1 > step 2 > step 3). Each step must be animatable and is action + effect only: no lecture, no backstory.
4. **Last 2 lines:** a twist / irony ending. Give the unexpected result, never a moral or a lesson.

**Retention:**
- A new visual or twist every 12-15 s.
- Active verbs, and specific details over general facts.
- No filler, no subscribe call-to-action, no hashtags in the script.

**Narration style (GOLD STANDARD, pigs 2026-11-08).** The user rejected a fact-list read ("the narration is not to the
point, checkout how [the reference channel's] narration goes"). Write a TOLD STORY:
- Present tense throughout ("Antigonus marches", "the elephants freeze"), one protagonist side at a time.
- One cause-and-effect chain: lines start "So...", "But...", "Then..." so each beat follows from the last.
- One quick rhetorical question at the turn ("Does it work? The elephants freeze.").
- One "You see," line that explains WHY, with a concrete image, kept attributed when the source is old ("You see,
  ancient writers swore elephants panic at a pig's squeal.").
- Concrete verbs and nouns (smash, smear, shrieking, pitch), no date dumps beyond the one context line.
- End on the payoff word (the last word is the punchline; the picture loops).
- Keep the template's limits (135-150 words, 8-12-word sentences, hook pattern, 3 steps, 2-line twist).
- Pigs v2 script, for reference: "Nobody could stop war elephants until pigs started screaming. / Greece, 266 BC. King
  Antigonus marches his elephants on Megara. / Spears bounce off their hides. Arrows barely sting. / So they smash
  through the city's last defenders. / Desperate, the Megarians raid their own pig pens. / ... / Does it work? The
  elephants freeze. / ... / You see, ancient writers swore elephants panic at a pig's squeal. / ... / They just hang
  one pig from the wall. / It squeals, and the giant elephant runs." (full text: `short_kit/SCRIPT_pigs.md`).

**Output when the user gives a topic** (in SCRIPT.md and in chat, then wait for "yes"):
```
Title: <1 title naming ONE specific subject>
Script: <script only, 135-150 words, pure spoken text>
Visual cues: <3 cues, e.g. "show map zooming in">
```
- Count the words and the longest sentence before showing the script.
- Visual cues are shot directions for the animation. They never go inside the script, because the TTS reads anything in it aloud. They are not text overlays: only the word captions are burned in.
- Every fact still comes from a checked source, written at the top of SCRIPT.md.

**How the template maps to the picture and the rules:**
- **Hook frame:** frame 0 shows the payoff the hook promises (the object mid-job, or the "what if" moment), low angle, with the camera already moving.
- **Where the hook resolves:** the hook names the payoff, but HOW and WHY stay open until the steps. Set `RETENTION.resolve` to the frame of the step 1 word.
- **Set piece (10-12 s):** the first full view of the thing at work. That is where step 1 lands at this pace.
- **Twist cadence:** ~12 s step 1, ~25 s step 2, ~38 s step 3, ~52 s the twist. Each one gets a new set or a bigger scale.
- **Ending:** the last shot matches frame 0 so the short loops.
- **Pace (gold standard):** the voice is NEVER sped up, slowed or pause-trimmed. Jesse on eleven_v4 with his stored settings reads ~2.3 words/s with natural pauses (≤ 0.5 s), so 135-150 words = ~59-66 s (pigs: 147 words, 64.4 s). Size the SCRIPT for the runtime; if a short must be shorter, cut words, not tempo.

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

## Pipeline
1. **Topic and facts.** Pick one surprising true story with a physical cause and effect (it should be visual), plus a simple everyday analogy that explains it.
   - Write the facts with their source at the top of `SCRIPT.md`.
2. **Script.** Follow the **SCRIPT TEMPLATE** section at the top: 135-150 words, ~60 s. It replaces the old "~3.7 words/s, pauses ≤ 0.33 s" rule and the bridge beat formula below; the formula stays here only as background.
   **Retention rules from the user's channel audit (2026-11-06). These come first and override the beat formula where they clash.**
   - The channel's own curves show viewers leave at **9-12 s** when the hook resolves early. Atlantis short: 28 % still watching at the end. Medieval jobs short: 58 %.
   - **Nothing resolves before 15 s.** State the puzzle, then hold the answer back. The first two sentences must not answer the hook.
   - **Build three beats that each raise the stakes.** Don't write premise + explanation. Each beat must give a reason to watch the next 5 s ("each job worse than the last").
   - **Put the strongest visual at 10-12 s** (the biggest set piece, the widest reveal, the funniest image). Mark it in SHOTPLAN.md.
   - **End on a payoff that rewards the full watch** (a callback or twist that loops into frame 0).
   - **Title = ONE specific subject** (a person, a single role, a single object or a single event), never a category. Examples: "The WORST Job in History: Medieval Executioner", not "Terrifying Jobs in Medieval Times". "Queen Elizabeth The 1st Was DISGUSTING!", not "Why Rome Was Disgusting". It should imply a story. Propose the title with the script.
   - After upload, tell the user to check the **8-15 s window** of the Studio retention curve.

   Beat formula from the bridge short:
   - **The reveal lands late: "You see," at ~70 % of the runtime.** In the 22-short study, a reveal at ~70 % had a median of 11 M views; explained early, 3.4 M. Everything before it is the fable, everything after is the mechanism + payoff.
   - **Hero = ONE specific subject, never a group or category.** A named person when the story has one ("Queen Elizabeth I", "George Washington"), else one single role ("the executioner", "a blacksmith"). He does something strange in the very first line / frame 0. Someone doubts him. Title and hero are the same subject.
   - **Hook:** the absurd fact in one line, phrased as a PUZZLE, not an answer ("Seventy-four soldiers knocked down an iron bridge just by walking across it." makes you ask "how?"). The second sentence deepens the puzzle. It must not explain it.
   - **Setting:** year, place, pride.
   - **Action:** escalation over three or four beats, each a little bigger.
   - **Snap:** the moment it breaks.
   - **Deadpan double line:** "Luckily ... / Unluckily ...".
   - **Explanation:** one physics idea through an everyday analogy (the kid on a swing).
   - **Consequence:** the rule it created.
   - **Callback twist:** the ending.
   - Never describe on screen what the viewer already sees.
3. **Voice.** Record or generate `voice.wav`, then make its word timings `words.json` (any speech-to-text with word times).
   - Put them in the project folder, e.g. `~/bridge-short/voice/`.
   - Hand-fix the word timings. Everything is timed to words.json.
   - For every on-screen speaker, write per-frame loudness for lip-sync: `python -I templates/scripts/voice_rms.py voice.wav rms_<who>.json 30`. Cut that speaker's lines first, or slice the array in story.ts.
4. **Shot plan** in `story.ts`: copy `templates/bridge/` (the final bridge source, same as `src/videos/bridge/` of your Remotion project) to `src/videos/<name>/`, plus `templates/camrig/camrig.ts`, register a new composition next to `BridgeShort` in `src/Root.tsx`, and rename it.
   - `SHOTS`: id, a/b frames, light day/golden, crowd mode, `tau` story time.
   - `XFADE`: 7-frame dissolves at place changes (that cannot be portals).
   - `FLASH_AT`: a white flash after the hook.
   - **Camera = ONE continuous path per place** with `flow([...FlowKey])` from camrig.ts (see "Continuous camera" below). The old per-shot `CAMS` + `run()` + smootherstep `glide` is retired: it braked to zero at every key and needed a hard cut for every big reframe (bridge: 14 cuts).
   - Plan the shot list as a PATH, not as a list of pictures: every framing is a modest push / pull / pan / orbit / crane from the previous one, ~one every 1.7 s; big changes of view take several beats, a whip (≤ 16 f) or a portal.
   - Export `trackAt(id, f)` (the subject the camera rides with) and, once the cast is placed, `actorsAt(f)` for the gates.
   - **Retention in the animation (channel audit 2026-11-06).** Export `RETENTION = { setPiece: [fa, fb], resolve: f }` (frames): the strongest visual and the first frame where the answer is spoken. cam_qa gate 14 checks it.
     - **0-3 s:** keep the strange opening image (the channel's openings already hold at 1.27-1.45x the expected watch ratio), but save the biggest image for later. Don't spend the widest reveal or the biggest gag here.
     - **8-15 s is the danger window** (viewers left during the second sentence). Change framing at least every ~1.75 s (≥ 4 beats, no gap > 2.3 s). Each beat is visibly BIGGER than the last: more characters, a wider set, a higher crane, a louder hit.
     - **10-12 s = the set piece:** the biggest reveal / crane-up / crowd / collapse / funniest image in the short, with a real camera move (≥ 10 px/f), the music's first lift and the loudest SFX so far. Mark it in SHOTPLAN.md.
     - **Escalation keeps going after 15 s:** each of the three story beats gets its own new set or a bigger scale, so there is always a reason for the next 5 s. Never use a long explanatory hold.
     - **Loop ending:** the last 1-2 s land on a payoff image that matches frame 0's framing and colour, so the loop is seamless and a completion rewatches.
   - `KICKS`: impact flip-shakes.
   - `DOF`/`dofAt`: lens blur per beat.
   - `FOREGROUND`: near framing props.
   - Every visual reaction lands 0-3 frames before its word.
   - **Opening, rhythm and acting (newest-6 study, 2026-11-06; numbers in "Newest-6 study" below):**
     - **Frame 0:** the hero mid-action with a prop (painting, sawing, pouring, aiming), and the voice starts on frame 0. The first EVENT (a smash, a shot, a pour, a passing train) comes by 0.7-1.2 s. The camera rides that event's object (debris, bullet, oil stream) out of the opener to the next subject.
     - **First 6 s:** about 1 new framing per second (reference 0.33-1/s), 0 hard cuts.
     - **Rhythm:** a calm drift of 1-2 s, then a 0.5-1 s fast move on the key word, and repeat. Never two calm beats in a row.
     - **Hits** (`strikeTrack`): raise to READY in ~8 f, pull back to WOUND in 3 f, hold it back ~6 f, then CONTACT exactly on `F_HIT`, which is the word onset. There are no in-betweens and no overshoot. Hold the contact pose ~10 f, then recover. Keep the WOUND pose out to the side, in silhouette: a hammer held directly behind the head vanishes from a front camera. The hit is sold by 3D debris, the camera kick (flips sign every frame, ~3 px at 720p, gone in 6-7 f, and the push-in stops on the hit) and an expression swap on the contact frame, hidden inside a blink.
     - **Speech** (`mouthRms`): the mouth is driven by the voice: `templates/scripts/voice_rms.py` writes per-frame RMS for each speaker. Shapes change on ONES, with the mouth leading the sound by 1 f (reference r ~0.47, lead 0-1 f). `talk()` is only a placeholder until the voice exists.
     - **Faces** (`exprTrack` + `blink`): an expression change on nearly every line, landing 0-3 f BEFORE its word, as an instant 1-frame swap. Blinks go half / shut / shut / half every 0.5-2.3 s, plus one across EVERY expression swap (the swap frame is shut).
     - **Bodies:**
       - Animated on ones.
       - Character holds are DEAD STILL; the camera supplies the motion. No idle loops, sways or breathing; an idle exists only as an acting beat (a head that lolls 10-15° in 8-10 f, holds, returns).
       - No squash/stretch, smears or line boil.
       - Turns take 1-4 f (`TURN_F` = 3; front to back ~2 f).
       - Attacks take 3-5 f with a hard ease.
     - **Walks** (`walk` + `WALK_CYCLE` = 21 f per two steps; reference 9-12 f per step):
       - Planted stance feet (stride = speed x cycle / 2).
       - Body LOWEST at contact, bobbing 3-7 % of the height.
       - Lean swings from 1° at passing to ~6° at contact.
       - A high-knee strut: the thigh nearly level at passing.
     - **Inserts:** facts go on paper props (poster, newspaper, calendar, recipe card) as push-in close-ups, about 1 per 15 s.
     - **Ending:** the payoff lands on the LAST word, followed by ~0.5 s of payoff image. No tail, no outro.
5. **World.**
   - `lights.ts`: LIGHTS plus the LOOK sky/river/cloud palette per light.
   - `shade.ts`: two-tone shading and `untone()`.
   - `build.ts`: town, houses and Kenney CC0 kit props, recoloured, with sight-line culling of anything blocking a camera.
   - `paint.ts`: HD Canvas2D painted textures with seams painted in as dark tints.
   - `world.ts`: sky shader, fog = horizon colour, river, per-frame posing, sun frozen per shot and camera-relative.
6. **Characters.**
   - **Default since 2026-11-06: `toon3d.ts`, real 3D toon stick figures.** Use it for every character the camera gets near, orbits or turns round. The reference characters are 3D: on an orbit the face decal slides off the side of the head (`references/frames/new6_orbit_turnaround.jpg`), which a card can't do.
     - **Build:** `new Toon3D({ build: "adult"|"stout"|"slim"|"kid", outfit: { shirt, tie, collar, buttons, badge, belt, buckle, vest, bowtie, pants, stripes }, hat: { k: "cap"|"bowler"|"top"|"newsboy"|"hair"|"chef" }, head?, prop?: "hammer"|"mallet"|"cane"|"roller"|"stopwatch", propHand, grip?: "ball"|"glove" })`. Add `char.root` to the world.
     - **Every frame, call `char.pose({...})`:**
       - `pos` and `yaw`, plus optional `lean`, `tilt`, `crouch` and `head: { yaw, pitch, roll }`.
       - `armL` / `armR`: hand targets in body space. Presets come from `char.hand("hip"|"down"|"point"|"up"|"front"|"wave"|"fist"|"chest", side)`, or use a world point through `local()`.
       - `walk: { phase, stride }` for planted feet. Stride = speed x cycle / 2.
       - `face`: an `EXPR` entry, wrapped in `talk()` and `blink()`.
       - `propAng` or `propDir` for the prop.
     - **Animate with `track(f, keys)`:** pose-to-pose keys. `"ease"` is a 3-5 f hard-ease attack. `"snap"` / `"hold"` keep the previous value and jump exactly ON the key frame (the 1-frame contact). `"linear"` moves at constant speed.
     - **Acting helpers:** `strikeTrack(f, F_HIT, rest, ready, wound, contact)` for hand targets, prop axes, lean and crouch. `exprTrack(f, [[frame, EXPR.x], ...])` returns the expression plus its swap frames for `blink(f, seed, e, swaps)`. `mouthRms(f, rms, e)` drives the mouth from voice_rms.py. `WALK_CYCLE` and `TURN_F` set walk and turn timing. The lab (`labset.ts`) uses every one of them.
     - **Contract:** set `TOON3D.uSunW` to the world direction toward the sun every frame (it weights the outline). Everything lives on `NOINK`. The plum hull is the character's ink; the world ink never outlines it.
     - **Built in:** squashed-sphere head h/w 0.92, features drawn 1.45x on a decal, eyes 0.26 W apart, plum hull 0.022 HH lit to 0.05 HH in shade, two-tone lavender shade, thin warm rim, bean lathe torso with clothes painted round it, ink tubes 0.06 HH bent through 2-bone IK as one smooth rubber-hose curve (they stretch 12 % for anticipation), ball hands 0.055 HH, ink ellipsoid feet.
     - **Lab:** `templates/toon3d_lab/` (Lab.tsx + labset.ts + index_example.tsx; copy them next to the bridge template files + camrig.ts). It runs an orbit turnaround, a pointing gesture, a hammer snap with debris, lip-sync and a planted walk. The results are `templates/toon3d_lab/lab_result_v1.jpg` (look) and `lab_acting_strips_v2.jpg` (strike frames 84-99, lip-sync on ones); proven in `D:/youtube/src/videos/toon3d_lab` (2026-11-06).
     - **Not used in a full short yet:** run one Opus verifier round of side-by-sides against `references/frames/new6_character_closeups.jpg` on the first short that uses it.
   - **Cards** (`toon.ts` Pen drawing / `cast.ts` billboards / `cardshade.ts` lighting) remain for crowds of more than ~6, people more than ~15 m away, and effect cards: puffs, anger steam, sweat drops, notes, stars, crack veins.
   - **Integration:** create the Toon3D cast once in world.ts. Pose each character in `update()` from story.ts tracks (positions, gestures, `F_HIT`s, word spans from words.json). Keep each character's acting keys next to its camera keys, so a reaction lands 0-3 f before its word.
   - **Readability:**
     - A hand held in front must clear the torso: use the "fist"/"chest" presets with z ≥ 0.6 HH, or the ball pokes into the body.
     - Hats must sit ABOVE the brow line: crown front rim ~0.5 R, visor at ~0.5 R pitched ≤ 0.15 rad. Lower, and the visor reads as sunglasses.
     - A band ring wider than the head at its height shows a gap from behind.
7. **Post** (`Bridge.tsx` + `ink.ts` + `lensblur.ts` + `grade.ts`).
   - Composer order: ink → lens pre → lens main → bloom → NEUTRAL tone map → grade (MSAA 4).
   - Every pixel parameter scales with output height / 1920.
8. **Sound** (`~/bridge-short/audio/`: timeline.py, sfx_gen.py, sfx.py, music.py, instruments.py, dsp.py, mix.py).
   - Event table → synthesized SFX plus an original score ducked under the voice.
   - **Pull the cues from the animation, never time them by ear.** story.ts exports every contact as data (footfalls, hammer contacts, impacts, door slams, whooshes = camera speed peaks from cam.csv); timeline.py reads that list. Hand-timed cues drifted off their hits in the reference study's sword short until 59 cues were extracted from the animation.
   - Output: mix.wav (48 kHz, exact length), stems and cues.md.
   - Lock the picture's time constants before the sound is made. Any later timing change means re-running the sound.
9. **Camera gates, then look checks.** First `node scripts/cam_qa.mjs src/videos/<name>/story.ts --csv out/<name>/cam.csv` (copy `templates/scripts/cam_qa.mjs` to `scripts/`; no render needed, runs in seconds). Fix the path until every gate passes, THEN render stills.
   Run `node scripts/bridge-stills.mjs out/<name>/x_ 100,400 0.5`.
   - **Acting strips** (from a 0.5-scale preview, 30 fps, every frame). For each `F_HIT`: `ffmpeg -ss <(F_HIT-6)/30> -i preview.mp4 -vf "trim=start_frame=0:end_frame=12,scale=270:-1,tile=12x1" -frames:v 1 hit.png`. Make one strip of a spoken line the same way. Compare against `references/frames/new6_hit_snap_30fps.jpg`. Pass when:
     - The anticipation peak is directly followed by the contact frame.
     - The mouth swaps every 2-6 f inside words.
     - Character holds are pixel-still (only the camera moves).
     - The wind-up stays in silhouette.
     - Blinks cover the expression swaps.
     - No hand sits inside a torso and no visor covers the eyes.
   - Set `BRIDGE_ENTRY=src/sandboxes/<n>/index.tsx` to render a sandbox copy.
   - Make side-by-sides against reference frames with `python scripts/sbs_sheet.py out.jpg --ours ... --ref ...`.
   - Send them to an Opus max verifier: 1-3 images, a ≤200-word verdict.
10. **Final render.**
    - `npx remotion render src/index.ts <Comp> out/<name>/video.mp4 --codec h264 --crf 16 --scale 1.3333`
    - Mux with `-map 0:v:0 -map 1:a:0` (Remotion writes a silent audio track).
    - QA: `python scripts/short_qa.py final.mp4 out/<name>/qa shots.json` checks every frame for black, white, frozen and pop frames, plus loudness and sheets.
    - Fix anything it finds, then run a deep Opus audit.
    - **Continuity review with timestamps.** Watch the render (or a 6 fps contact sheet) for the version-1 failures of the reference study: two characters walking through each other, a head poking through a window or wall, a character vanishing or popping, a hammer missing what it hits, the camera spinning on a vertical climb, sounds landing off their hit. Write each as "at 0:10, X walks through Y" (frame-checkable), never "it looks weird"; ask the user for notes in the same form.
11. **Deliver.** SendUserFile the final mp4, update memory, write notes. Give a title built around one specific subject. Give the 1-second still at the set piece as the cover-frame candidate. Tell the user to read the Studio retention curve at 8-15 s once the short has ~500 views, and record what it shows in the short's memory file.

## Final look values (bridge after 4 verifier rounds; all in `templates/bridge/`)
Start every new short from `templates/bridge/` (copy to `src/videos/<name>/`): the look lives in these values, the
story lives in story.ts / build.ts layout / cast.ts roles. Opus max scores at the end: colour day 7, golden 5-6,
lighting 5-6, ink 6, textures 5-6, characters 7, depth 6-7, composition 6-7 (from 5/3/4/5/4/7/4/6 at the start).
- **Light presets** (`lights.ts`, sun camera-relative and frozen per shot):
  - day: az 75 / el 48, lit [1.58,1.5,1.33], shade [.30,.29,.36], lift [.05,.06,.11] (cool tint ONLY in shade), sky
    top #3e7fd2 → horizon #b8d0ec, fog = horizon, 25→300 m, uSat 1.08, ~15 % blue haze past 60 m.
  - golden: az 6 / el 7 (backlit low sun), key toward #FFB36B ×1.5, violet-blue shade (facade ≈ #444380), sky
    #ffc47c → #8a6f8a, peach fog only past 50 m, sun disc #ffcf9e + bloom, contact blobs + real card shadows.
- **Albedos** (`paint.ts`/`build.ts`): muted brick / cream / ochre / terracotta houses with plinth, cornice, sills,
  hoods, door step, chimney + pot, heights 7 / 8.4 / 9.8 m; warm grey/beige stone (saturation −35 % from "storybook");
  ochre wood deck C* ~51-58 with near-black seams; iron dark and desaturated. Never lemon, never lavender lit faces.
- **Ink** (`ink.ts`): #030303, 5.1 px near (6 m) → 3.3 px far (90 m) at 1080x1920, creases ×0.8 from 35°, depth
  jumps from 1 %, fog tint 0.3 only far; character cards on layer `NOINK` (they carry their own plum ink).
- **Lens** (`lensblur.ts` + `dofAt` in story.ts): cInf px at 1080: hook/river CU 15-16, close-ups 12-14, MS 10-12,
  park 7, golden sway 5, wides/aerials 0. Focus on the eyes of the front row.
- **Post** (`Bridge.tsx`): ink → lens pre → lens main → bloom (thr 1.0, int .5, 6 levels, radius .6) → NEUTRAL tone
  map → grade; MSAA 4. Film grain exists but is OFF (reference measures no grain; it quadruples the file size).
- **Characters** (`toon.ts`/`cast.ts`/`cardshade.ts`): bean heads h/w .94, plum ink #241726, eyes .26 W apart, no blush,
  14 expressions; adults 3.5 head-heights; walk bob 5 %, lean 1-7°, planted 0.8 m stride; blinks 0.5-2.3 s; tight
  contact shadow ~.5 under the feet + sun-direction tail by day; golden rim inner only (never an offset outer copy).
- **Camera** (`story.ts`, bridge as shipped): cuts on big jumps, smootherstep glides 18-40 f, every hold creeps,
  flip kicks decaying over 7 f on impacts, 4-4.6° rolls (superseded: the camera stays level, see "Level horizon"),
  foreground props (`FOREGROUND`) in ~1/3 of shots.
  **Superseded by the continuous rig** (next section): the bridge as shipped scores 7/12 camera gates (14 cuts, 3
  brake-restarts); its march re-planned on `flow()` scores 10/10 (`D:/youtube/src/videos/bridge_flow/story.ts`).

## Look targets (measured from the reference; see references/reports/)
- **Ink:**
  - World lines: about 3 px at 1080 wide, near-black #0b0a0c, nearly constant with distance. Silhouettes, depth jumps and normal creases only. No line on wall/floor joins or the horizon. Character cards are never outlined by the world ink.
  - Character ink: dark plum #201628-#2f1d28, thicker on the bottom/shadow side.
- **Colour:**
  - Day median luma ~.57. Non-ink p5 ~.23 (no crushed blacks). Lit chroma C* p90 ~55. Day sky top ~#5e93d9, horizon 1.28x brighter.
  - Golden: peach horizon #ffd08a, violet-blue shadows (never brown), backlit sun.
- **Depth:**
  - DOF on about 1/3 of screen time (CU, MS, inserts), cInf 10-16 px at 1080, focus on the eyes. Establishing and wide shots stay sharp.
  - Fog = horizon colour, 25→420 m day, 20→360 m golden.
  - Bloom only on HDR emissives: threshold 1.0.
- **Camera** (both studies agree; numbers in 720p px/f as cam_qa.mjs measures them):
  - The camera never parks: one continuous flight per place, a new framing every ~1.7 s (26 per minute, first by 1.1 s, 2 in the first 3 s, longest hold ≤ 5.17 s).
  - Hard cuts 0-1 per short. Place changes: portals (fly through a window, door, chimney, porthole, or follow an object) or 7-frame dissolves (~1/3 of changes).
  - Move mix inside a place: push 26 %, pull 16 %, whip 13 %, pan 8 %, tilt 4 % (the rest crane/orbit/track).
  - Speed: median ~3.6, moves peak 14-25 (ease in and out over ~23 f), whips ≤ 93 and ≤ 16 f (with motion blur), drift between moves never below ~2.
  - **Level horizon** (roll study, 2026-11-06; this replaces the old "rolls of 4-5° on emphasis beats" rule). The camera does not roll: median 0.3°, p90 ~2° (the meter's noise floor), and characters always stand upright in frame.
    - No dutch tilts on emphasis beats, and no banking into pans or orbits (corr(roll, pan) ≈ 0).
    - The ONLY real roll is on a ride-along: following a fast object (bullet cam), the camera banks to ~8-10° (verified -6 → -10° over ~1 s) and unrolls to 0 before it lands on the subject.
    - Drama comes from low angles, wide lenses and push-ins instead. A tilted-looking reference frame is perspective, a rocking ship or a top-down shot.
    - Gate 17.
  - No hand-held float. Impact shakes flip sign every frame and decay over 7 f (their ±0.1-0.35° roll is fine).
  - Strong DOF, focus follows the acting character.
- **Characters** (3D since 2026-11-06, `toon3d.ts`):
  - About 3.1-3.5 head-heights tall, legs 1.4 HH.
  - Ink-tube limbs about 0.06 of head height, ink ball hands.
  - Squashed-sphere head (h/w ~0.92).
  - Blush only on happy faces, no eye highlights. Faces at brightness ~.93.
  - Walk bob 3-7 %, lean 1-7°, planted feet.
  - Blinks every 0.5-2.3 s, lasting 4 f.

## Continuous camera (`templates/camrig/camrig.ts` + `templates/scripts/cam_qa.mjs`)
Source: "I Replicated These Viral Shorts With Claude" (What If Animator, 2026-11-04): 22 reference shorts measured
frame by frame, 26 agents, 13 camera gates. Their v1 camera had our exact bug: "the easing curve dropped the speed to zero at every
key, so the camera braked and started again on every single move". Their fix, rebuilt here:
- **`flow(keys)`**: every key is a framing the camera PASSES THROUGH at frame f. Path = centripetal Catmull-Rom through
  [pos, look, zoom, roll] (no loops, no overshoot into walls); timing = monotone cubic, so speed is > 0 and continuous
  through every key (v_in = v_out). Pitch is clamped to ±80° so lookAt never spins on a vertical climb.
- **Keys** `{ f, at: { pos, look, fov?, roll? }, track?: f => V3, join?: "flow" | "cut" | "dissolve" }`. `track` rides
  with a moving subject (a marching column, a cart). Helper `R(f, pos, look, fov, roll)` relative to the subject (see
  bridge_flow) keeps keys readable. `hold(f0, f1, at, { push, side })`, `push()`, `drift()` for living holds.
  `join: "dissolve"` starts a new place's path; `flowLayers()` gives the 7-frame dissolve layers.
- **Planning a path** (what made the bridge march go from 6/12 to 10/10):
  1. One key at each word's framing, arriving ~10 f after the word; the previous key ~12-25 f before the word (the move straddles it).
  2. Between moves, keep drifting: at 3 m from a face, 0.15 m of drift is already ~2 px/f, 1 m is a whip. Scale drifts with distance.
  3. A move reframes 1/4-1/2 frame in 18-45 f. Pull-outs/cranes by ×5 in distance need ~60 f. Bigger changes: several beats, or a whip ≤ 16 f.
  4. Never jump from a close-up to a side view 13 m away (that was a cut): orbit there over 2-3 beats.
  5. Gate 8 brake = speed between two moves < 15 % of their peaks: add drift to that hold, don't loosen the gate.
  6. **Lens clearance along the WHOLE flight, not just at the keys.** Cuts used to skip the space between framings;
     a flight visits it. The first bridge_flow path passed 3 cm from the rail and 6 cm from the hangers (big dark bars
     across the lens on the contact sheet). Rule: ≥ 0.8 m from rails/hangers/chains/walls on every frame (check with a
     per-frame distance script against the set's structure), keep lanes (bridge: |x| ≤ 1.6 inside the hangers), never
     thread a row of posts/hangers while riding with a moving subject, cross a structure plane only above/over it.
  7. Gates first (seconds), then a 6-fps contact sheet of a 0.5-scale render of the sequence, then stills.
- **Portals** (place changes without a cut): build both places in ONE world (forge → up the chimney → over the roofs →
  courtyard), or swap the place on the frame where an opening/dark surface fills the lens, keeping the velocity. Else a 7 f dissolve.
- **Light per place, not per shot:** the bridge sun is camera-relative and frozen per shot; under a continuous camera
  it jumps at every invisible shot change. Freeze it per path (`world.ts shotSun`, see bridge_flow).
- **Sight lines:** the flight between keys passes new places: `sightLines()` samples every frame of camAt, so the culler
  covers it, but check stills mid-move for props/hangers/chains crossing the lens (readability traps below).
- **Whips need motion blur** (reference whips "always carry heavy blur"): use `@remotion/motion-blur`'s
  `CameraMotionBlur` around the whip frames only, or keep moves under ~40 px/f.
- **Gates** (`node scripts/cam_qa.mjs <story.ts> [--from F --to F] [--csv f]`): 1 never parks, 2 framing every ~1.7 s,
  3 first change ≤ 1.5 s, 4 two beats in 3 s, 5 longest hold ≤ 5.17 s, 6 whips ≤ 16 f, 7 dissolves 7 f, 8 v_in = v_out
  (no brake, |dv| ≤ 3 px/f²), 9 parallax (camera travels ≥ 70 % of frames), 10 focus follows the subject, 11 no spin
  (yaw ≤ 3°/f, pitch ≤ 80°, roll ≤ 8.5°), 12 ≤ 1 cut and none between places, 13 no clipping/pops (needs `actorsAt`),
  **17 level horizon**: ≥ 80 % of frames |roll| ≤ 1°, max ≤ 10°, and any roll > 3° only within 12 f of a fast move (a
  ride-along). Roll in camrig keys is in RADIANS (8° = 0.14). Measured on 2026-11-06: Skara passes (83 %, max 2.9°);
  bridge_flow fails (77 %: its whip rolls + emphasis rolls). Drop the `roll` on emphasis keys and the whip-roll term.
  14 retention window (needs `RETENTION`; required for every new short): set piece starts 9.5-12 s and moves ≥ 10 px/f,
  answer ≥ 15 s, ≥ 4 beats in 8-15 s, no gap > 2.3 s. Skara Brae (made before the audit) fails it with 3 beats / 2.4 s.
  **15 opening** (newest-6 study): ≥ 4 beats in the first 6 s and no hard cut before 10 s. **16 rhythm**: the framing
  changes are real moves but not whips (median beat peak 10-30 px/f, ref 14-16), and the camera CALMS between them
  (median speed 2-5 px/f, ref 3.6). Measured on 2026-11-06: Skara Brae fails 16 (median 9.7 px/f: it never calms
  down), and the bridge_flow march fails it too (5.8). Fix it by slowing the drift between moves (shorter
  `hold(... side)` drifts, gentler pushes), not by removing moves.
  Speed = 3x3 grid on the subject plane + a background plane at 3x, |t| + |scale-1|·734 + |rot|·734, the same unit as
  references/reports/motion.md. Gates 3-4 only run from frame 0.

## Lessons from the Skara Brae short (2026-11-06, the first full short on the continuous rig)
Source: `D:/youtube/src/videos/skara` (story.ts = 13 flow paths, cam_qa 12/12), built by the lead + 3 sandbox agents
(bay / venues / char, merged with `scripts/skara_merge.py`), two review rounds on full 0.5-scale previews + deep_qa.
Result: median frame diff 0.050, 76 % of frames > 0.03 (the user's reference: 0.044 / 67 %; Gobekli v2: 0.019).
- **Interiors in 9:16 = the "dollhouse" view.** From inside a 6 m room the subjects on three walls (dresser N, beds
  W/E, a cell W) are 50-90 deg apart: every beat becomes a whip. From ~3.3-3.8 m up, just outside a CUT-DOWN front
  wall (~1 m, a ruined/cutaway wall), they sit within +-20 deg and stack top-to-bottom in the tall frame, so each beat
  is a small tilt/push. Keep the pitch <= ~35 deg: flat character cards look squashed from steep angles.
- **Lay out the set FOR the camera path.** Put the things the voice names in a row the path can sweep (Skara: "another
  house ... and another" became the house straight behind H1 + the one to its left, seen in ONE crane-up). A sea inlet
  let the cliff camera look ACROSS at the layered face (45 deg turn) instead of flying out and turning 180 deg.
- **Long lens for far subjects:** 10-14 m away at fov 28-32 keeps moves small on screen and the subject big.
- **Never stage a character on the camera->subject line** (the geologist stood between the lens and the toilet cell:
  we saw his back). Give every prop beat a "beside it" mark.
- **Never delete a card on one frame.** Exits "behind the south wall" broke when the wall was cut down: mum popped out.
  Keep the character until something real hides it (the inflowing sand buried the family: a better gag).
- **Particle pools must cover the worst overlap.** A 120-sprite spray pool overflowed when bursts overlapped, so the
  hero plume (last in the list) lost its sprites = a one-frame vanish. Size pools generously and list hero effects first.
- **Smoke / spray near the lens** makes characters look see-through: interior smoke rises straight up and fades by ~1.6 m.
- **Depressions are invisible from a low camera.** "Walls poking out of the sand" sat in a 0.45 m moat; from 3.9 m on
  the dune side only sand showed. Crane up (5.5 m) and aim at the walls, with the character at the frame edge.
- **Focus:** glide the DOF focus point between entries (10 f), but switch instantly (`dur: 1`) at place changes, or the
  focus flies across the world during the dissolve.
- **cam_qa** treats whip transitions (both cameras >= 25 px/f at the swap) as joins, not cuts, and skips flash frames.
- **Review loop that worked:** full 0.5-scale preview (~7 min) -> 3 contact sheets of 50 frames with burned frame
  numbers -> deep_qa -> fix lists per owner -> merge -> next preview. Each agent round ~20-30 min; first build ~1.5 h.
- **Final = 120 fps HQ render (~1 h 25 min for 70 s at 1440x2560, concurrency 2) -> tmix.** Don't re-render it for a late
  fix: render only the touched range (`--frames=A-B` on the HQ comp, A and B+1 multiples of 4 so tmix windows stay
  whole; ~3-5 min) and splice it inside the same tmix encode (`skara-short/splice_final.sh`, FIXES="a:b:file ...").
  Check both seam frames against the full render first (mean abs diff ~0.002 = identical).
- **2K GPU faults (2026-11-08, three shorts in a row):** partway through a long Chrome session the 2K WebGL render
  loses its textures (sky, ground and walls go black, only lit characters remain) or turns pure white, with no error.
  A chunk that needed a retry is the usual suspect, but faults also showed up in chunks that rendered first time.
  `final_chunked.sh` checks each chunk with `check_piece.py` (white frames, luma ratio < 0.6 vs preview1, +25 % pixels
  that are near-black); `scan_final.py` then catches what the chunk check can't (a single texture gone black, e.g. an
  elephant blanket). Pigs: 320-frame chunks rendered at ~90 HQ frames/min vs ~60 for 800-frame chunks. Never stream-copy
  (`-c copy`) concat the chunks (decode errors at the seams); join them with the concat filter in the tmix encode.
- **deep_qa on the motion-blurred final flags ~7x more sharpness dips** than on unblurred previews. Join each dip
  run with cam.csv speed: dips on fast moves are the shutter blur doing its job; only look at dips on slow camera.
- **Prop swaps need a carry** (the professor's pipe jumped mouth <-> wagging hand in one frame). The hand travels to
  where the prop goes (5-6 f), the swap happens there, then the arm returns. Posed arms draw BEHIND the head card:
  set `overL`/`overR` while the hand is at the face.
- **Compare frame times at half frames.** `f = t * FPS` lands a hair under the integer (1018 / 30 * 30 < 1018), so
  `f < 1018` is still true on frame 1018. Use `f < K - 0.5` for one-frame switches.

## Lessons from the Tut short (2026-11-09; 5 helpers, 15 shots, 8 eras of one valley)
Source: `D:/youtube/src/videos/tut` + `D:/youtube/tut-short` (valley / tomb / cast3d / crowd / venue helpers).
- **Five helpers, the cast split in two:** cast3d (chars.ts + toon3d.ts: the 3D heroes + their props) and crowd
  (cast.ts + toon.ts + cardshade.ts: every card crowd + effect card). Each could go deep (250-figure funeral, 150
  night robbers); keep their zones apart in the briefs (3D heroes' spots listed, cards keep 1.2 m clear).
- **One place, many eras:** SHOTS carry an `era`; every owner shows the place as it was in that era (k-functions for
  what is built / buried / dug during a shot). Worked cleanly for 1323 BC -> 1922 AD in one valley.
- **One shared ground:** the main-place owner's drawn surface (pile, trench, clearing, pit) must be THE ground every
  owner stands people on. The lead exported a live `groundAt(x, z)` from valley.ts (set in update(), read by the cast
  + cards). Put this in the main-place brief from the start; the cast + crowd owners otherwise guess heights.
- **DOF with far look points:** `KF` keys look 40 m down the ray, so a DOF entry with cInf > 0 and no `focus` focuses
  at 40 m and blurs the subject. Give EVERY DOF entry with blur an explicit focus point (the subject).
- **A camera cannot fly through a doorway a character stands in** (the robber in front of the hole he smashed). Use a
  7 f dissolve into the next set (separate camera paths per shot so each crossfade layer keeps its own camera).
- **Characters inside a deep pit** (1.6 m) are only visible from high above; plan pit beats as top-down shots.
- **Check positions between owners on the first merged stills:** a hut sat exactly on the hero's frame-0 spot; the
  1917 crew stood between Carter and the lady he tips his hat to; Davis faced away from the camera on his key beat.
  Fix by moving the contract constant or turning the character toward the lens on the beat.
- **Tool gotcha:** apostrophes inside a Bash heredoc broke the tool's command wrapper ("unexpected EOF"). Write edit
  scripts to a scratch .py file and run it.

## Lessons from the pigs short (2026-11-08; THE GOLD STANDARD)
Source: `D:/youtube/src/videos/pigs` + `D:/youtube/pigs-short` (city / beast / char / venue helpers, merged with
`scripts/short_merge.py`). Three voices were tried; the user kept the third.
- **Voice = ElevenLabs Jesse, eleven_v4, stored settings, UNPROCESSED.** Kokoro am_michael (v1) was replaced by a
  kyu5ji11 read at speed 1.12 + pause trim + rubberband 1.05 (v2): the user said it "sounds really different" from the
  site. v3 = Jesse with no settings sent and no processing: "a really good one". The model matters too
  (multilingual_v2 also differs from the site). Never time-stretch a voice; size the script.
- **Narration = a told story** (SCRIPT TEMPLATE > Narration style). The fact-list script was "not to the point".
- **No dissolve between two brick-wall shots.** At 16 s a 7 f dissolve laid the pen's wall over the city wall: the
  user saw "walls stutter and glitching". It is a hard CUT on the line change now (the short's only cut).
- **Slow pushes over brick / repeating texture.** The 4-sample tmix shows 3-4 separate ghost copies of every mortar
  line at medium speed (~5-15 px/f at 720p): it reads as stutter. A 16 f push at 9 px/f -> 38 f at 2.3 px/f fixed it.
  Whips (25+ px/f) smear and are fine.
- **2K GPU faults are random:** whole chunks went white or lost their textures (sky and ground black). The chunked
  final with per-chunk checks + a full per-frame scan is mandatory (step 7).
- **Before resuming any render after a session break, list the processes** (node / bash / chrome CommandLine). A hung
  render from an earlier session (and a second copy of its loop) starved the GPU; killing only the render made its
  loop start the next try. Stop the bash script itself (Git Bash children survive `taskkill /T` on the wrapper).
- **Other sessions render too.** With several shorts rendering at once, previews ran ~10x slower and came out white.
  If the user says to wait for another short, wait (a watcher script that polls for that short's final file).
- **Hulls on moved parts:** `addHull` must parent the hull to its mesh (`m.add(h)`), not copy the transform at creation,
  or the outline stays behind as a dark disc where the part started.

## Lessons from the Kaifeng short (2026-11-06; first short with toon3d heroes + 4 parallel helpers)
Source: `D:/youtube/src/videos/kaifeng` (story.ts contract, world.ts glue; siege/camp/chars+cast/venues by 4 helper
agents in sandboxes `kaifeng_{wall,camp,char,venue}`, merged with `scripts/kaifeng_merge.py`). ~4 h from approval to
final render; preview 7.5 min at 0.5 scale; ~0.25 s/frame at 1080p.
- **User-supplied voice (ElevenLabs etc.): transcribe it first.** It read a stage note from the script message aloud
  ("The camera rises to show 400 catapults firing"). Cut it. (Kaifeng then trimmed pauses and rubberband-stretched
  the read to ~3.5 w/s with `prep_voice.py`: SUPERSEDED by the pigs rule, never process the voice.) Never put stage
  directions inline in a script you hand the user for recording.
- **A 9:16 frame is only ~26 deg wide.** A close hero and a far target must sit on nearly one line of sight; a god's view
  of four corner batteries needs a near top-down camera (~430 m up, fov 60, pitch ~76) with the frame's long axis
  along a diagonal.
- **Look points far down the ray** (`far()` / `KF()` in story.ts): when consecutive keys look at things at very
  different distances (a face 3 m away, then a wall 40 m away), the look-point spline makes the rotation spike
  (144 px/f). Same framing, look point 40 m out: clean, even rotation.
- **Whip-pans can't cover big angles**: 45 deg = 164 px/f, 90 deg = 445 px/f even in 16 f. Restage so the two subjects
  are <= ~40 deg apart (step back / up), or dissolve.
- **cam_qa counts a run of >= 10 px/f with a >= 40 peak as a whip (must be <= 16 f)**: after a whip add a key that
  settles below 10 px/f before the next move (else the ride after it extends the "whip").
- **Push into a prop = a 5-12x zoom**: inherently 1000-1800 px. Use a 7 f match dissolve to the macro set instead.
- **Light the hero's face**: pick the world sun so faces turned toward the camera AND the key set are lit (a high sun
  lights a battered wall's face and any south-facing face). Stage frame 0 with the hero facing the lens, the event
  behind him.
- **Vertical crane to people behind a parapet**: from ground level, merlons hide everyone 1 m behind them; crane to their
  head height.
- **Shared trajectories belong in story.ts**, not in an owner's file: battery shots (`battShots`), the bomb's path, door
  angle, exact contact points (`PLATE_HIT`, `PILLOW_TOP`), carry paths. Otherwise each helper guesses and dust lands
  beside the boulders. Resume finished helpers with SendMessage for follow-ups (they keep context).
- **Render-time scares under load**: stills slowed to 17-20 s while 4 helpers rendered; isolated, 40 frames took 25-31 s
  including the bundle. Measure with `prof` inputProps switches in world.ts before optimizing anything.
- **deep_qa shots.json** needs `flash`, `xfade` and `planned` keys (planned = intended whips/impacts to skip).

## What the 22-short study adds (same reference channel; apply on the next short, A/B on stills first)
- **Characters are probably true 3D toon renders** (the study is >95 % sure: the back of a head shows on turnarounds,
  and there's depth parallax), not camera-facing cards. Our billboards always face the lens, so they show it on orbits. Proportions: ~3.1 heads,
  white squashed sphere head h/w 0.92, bean torso 0.6-0.75 HH, ink-tube arms 0.06 H, ink ball hands, no fingers; faces
  are swapped decals (dark oval eyes 0.09x0.11 H, 0.26 apart, always lidded/browed, swap in 0-1 f). **Built
  2026-11-06:** `templates/bridge/toon3d.ts` (sphere/lathe/tube meshes, toon ramp, weighted inverted-hull plum ink,
  decal faces). The newest-6 study confirmed the 3D read on an orbit (see step 6 and the section below).
- **Ink is never pure black**: base #2a1b26, scene-tinted, never below #101010; weighted (thin on the lit side ~0.022 H,
  0.04-0.07 H on the shadow side). Our world ink #030303 breaks this: try ~#1c1420 scene-tinted on stills.
- **Acting is pose-to-pose and snappy**: attacks 3-5 f with a hard ease, holds ≥ 12-14 f with no idle sway.
- **Sets**: 7-10 bespoke sets per 60 s (the bridge had ~4 places), chunky bevelled props in dense grids, every prop inked.
- **Colour by act**: one dominant hue per 10-15 s act (sat ~0.41, value ~0.61), and the reveal/turn goes to saturated blue-green.
- **Mix in the reference**: -14 LUFS, true peak -2 dBTP, music bed static -20 dB under the voice, no ducking (our user's
  standard mix rule still wins).
- **The first test shot scored 4.5/10 from 5 reviewers** until 4 fixes: ink in its own pass before the blur (we
  already do this), no ceiling blocking the key light, ink on every prop, hair as a 3D shell not a beanie.
- **Ask for numbers, not opinions**: measure the render with the same tools as the reference (cam_qa, short_qa,
  reports), and run a skeptic agent over every measurement report before it becomes a rule.

## Newest-6 study (2026-11-06: the reference channel's 6 latest shorts, frame by frame)
The user asked for a breakdown of pace at the start, how the stick figures are drawn and how the arms move, and then asked for it to drive every video. Measured on 1080x1920 / 30 fps downloads with the same tools as `references/reports`. Frames: `references/frames/new6_*.jpg`.

| What | Measured | Rule for our shorts |
|---|---|---|
| Hard cuts | 0-5 per ~64 s (5 of 6 have 0 in the first 10 s; the 6th has one muzzle-flash cut) | ≤ 1 (gate 12) |
| Static frames | 0-2.4 % | never park (gate 1) |
| New framings, first 6 s | 2-6 (0.33-1/s; median ~5) | ~1/s, 0 cuts |
| First big move | 0.7-2.0 s | ≤ 1.5 s (gate 3) |
| Motion rhythm | per-second energy alternates calm ~2-5 ↔ bursts 15-30 (frame-diff units) | drift 1-2 s, burst 0.5-1 s on the key word |
| Transitions | the camera follows an object (bullet, oil stream, debris, passing train); 4-8 f dissolves between places; a train or prop wiping the lens | portals / object-follow first, 7 f dissolve second |
| Hit timing | hammer: 9 f moving hold → 1 f anticipation → contact on the NEXT frame; debris and coins are 3D physics | 1-2 f anticipation + 1 f contact |
| Face swaps | every 2-6 f while talking; a new expression on almost every word | `talk()` + `blink()` + `EXPR` per line |
| Limb width | 6-7 % of the head width (guard 13-15 px legs / 231 px head; close-up 21-26 px / 372 px) | 0.06 HH tubes |
| Outline | plum ~#2A1C2A (RGB 35-45 / 22-29 / 39-45), 0.022 head width on the lit side → 0.054 in shade | hull 0.022 → 0.05 HH |
| Proportions | head ~20-28 % of height, no neck, bean torso ~1 HH, legs ~1.4-1.6 HH | BUILDS in toon3d.ts |
| Hands | ink balls ~1.7x the limb width; a fist when gripping a hero prop (gun) | `grip: "glove"` |
| Emotion FX | white steam puffs from the head sides (anger), sweat drop, face turns purple (rage), red crack veins on the walls | effect cards + `headCol` |
| Palette | one complementary pair per short (prison teal + hot pink, red canyon + sky blue, ocean blue + orange sails) | pick the pair in the shot plan |
| Script | 219-247 words / 56-65 s = 3.4-4.0 w/s; 15-22 words in the first 5 s; "Wait, what?" ~45 %; "You see," ~70-75 % | step 2 |
| Ending | the payoff on the last word + ~0.5 s of payoff image, then the loop | step 4 |
| Audio | -14.0 LUFS integrated on all 6; voice from frame 0 | standard mix rule still wins |
| Captions | 1-3 words at a time, white heavy sans with a thick black stroke, centred at ~70 % of the height | ONLY if the user asks (user rule: no captions) |
| Camera roll | `templates/scripts/roll_meter.py` on trusted frames: median 0.3°, p90 2.1°, ≥ 80 % within 1° (noise alone gives 91 %). Only verified roll: the bullet ride-along, banking -6 → -10° and back to 0 on landing. No link to pans (corr ≈ 0). Big raw readings were perspective, ship heel or top-down shots, checked by eye | level camera; roll only on ride-alongs (≤ 10°, back to 0 before landing); gate 17 |

- **Characters are 3D toon models**, not cards. On the railroad short's orbit (17.5→19.9 s) the boss stays frontal for half the move, then his face decal slides off the side of the sphere and the back of the head shows. A first read of "billboards" from the first half of an orbit was wrong: always check the END of an orbit.
- **Blush** appears only on happy or embarrassed faces (soft pink ovals). There are no eye highlights.

## Newest-4 study + quality upgrade (2026-11-09: the user, "adapt those to our video making ... similar to his quality or better")
The reference channel's 4 newest shorts measured against our pigs gold standard. Full numbers, frames and tools:
`references/reports/newest4_2026-11-09.md` (working copy `D:\youtube\ref-study-1109\FINDINGS.md`). The two newest
moved to a stylised-PBR game-engine world (detailed models, specular, reflections, volumetric smoke, no world ink);
characters stay our family (sphere head, ink tubes) but with bolder faces and detailed outfits.

| What (median per 0.5 s, caption band masked) | his 2 newest | our pigs v3 | rule now |
|---|---|---|---|
| fine detail (p90 abs Laplacian, 540x960) | 0.15-0.19 | 0.044 | 180 deg shutter + DOF_K 0.5 + cas 0.4 + crisp faces |
| warm cast mean(R-B) | -0.10..-0.19 | +0.33 | neutral/cool grade; warm only where the story is (sunset, fire) |
| mean luminance / p2 | 0.39-0.43 / 0.03-0.10 | 0.56 / 0.135 | contrast S-curve, mids neutral; deeper shade |
| motion blur | smooth streaks, fast movers only | 3-4 stepped ghost copies | SHUTTER 0.5 (below) |
| loudness / LRA | -14.0 LUFS / 1.7-3.2 LU | -15.0 / 4.2 | -14 LUFS, LRA <= 3 (pending the user's listen) |
| L/R correlation, side/mid 60-250 Hz | 0.99, -24..-29 dB | 0.95, -12.6 dB | near-mono mix, bass mono < 150 Hz |
| bed in word gaps (400 ms p10 below p95) | 5-7 dB | 10.3 dB | ambience bed per place, never drops out |
| SFX | recorded, broadband, every 1-2 s | synthesized (harmonic arcs) | recorded library (`sfxbank.py`), whoosh on every camera burst |

**Render rules (tested on the pigs2 sandbox; A/B in `D:\youtube\out\pigs2\ab\`, motion test `out\pigs2\mb\mb_compare.jpg`):**
- **Shutter 180 deg:** the HQ comp samples film frame n at `n + k * SHUTTER / 4` (k = 0..3, SHUTTER = 0.5) in
  `useStoryFrame` (Pigs.tsx). Starting AT the frame keeps on-ones poses and face swaps unmixed. The old n + k/4
  (360 deg) gave 3-4 stepped copies of every fast mover; this costs nothing extra. inputProps `post.shutter` overrides.
- **DOF_K = 0.5** multiplies every `dofAt` cInf: backgrounds still soft, mid-ground crisp like the reference.
- **Grade:** day = contrast S `[0, .07, .225, .5, .79, .94, 1]` (mids NEUTRAL; the old `.6` mid knot lifted the whole
  picture), sat [1, 1.08, 1.02], cool shadow tint; golden mids .5.
- **Day light:** lit [1.55, 1.5, 1.42], shade [0.3, 0.31, 0.42], lambert 0.75 (was 0.35: surfaces now shade with their
  angle, volumes read solid), sky stops `#a8c6ee ... #1d58c8`, fog 40-460.
- **Relief:** `bumpify` uses each painted world texture as its own bump map (BUMP_K 8). Cheap, subtle, keep.
- **SSAO:** available (AO_K, NormalPass + SSAOEffect) but OFF: on the toon world it moves 1-2 levels and doubles the
  render time. Try 1.6-2.5 on interiors only.
- **Final encode:** `cas=0.4` after the tmix (all three final scripts).
- **World assets, gloss and VFX:** see the next block (built 2026-11-09 after the user's "yes" to closing the gap).

**World assets + glossy materials + VFX (2026-11-09 lab; report `references/reports/assetlab_2026-11-09.md`, VFX API
`references/reports/vfx_2026-11-09.md`; lab `D:\youtube\src\videos\assetlab`, sandboxes `src/sandboxes/assetlab`, `fxlab`):**
- **Asset kit = the big step.** `D:\youtube\public\assetkit` (631 models, 88 MB; MANIFEST.json + LICENSES.md; contact
  sheets `D:\youtube\out\assetkit\sheet_*.png`). Build every new world from it first, code shapes only for what it lacks:
  Quaternius MegaKits (`q_village` modular + 4 prefab houses, `q_props`, `q_nature`) are on target; KayKit a notch below;
  pirate / older Quaternius / most Poly Pizza = flat low-poly, distance only. 8 Poly Pizza models are CC-BY 3.0
  (catapults, camel, elephant, Greek / Roman temple, pillar, column, arch): avoid unless the user OKs a description credit.
  `templates/pigs/assetkit.ts`: `loadAssetKit(names)` (inside the kit promise / delayRender), `placeKit(root, ak, name,
  x, z, yaw)`, `loadGround(["cobblestone"])` + `groundMat(t, w, d)` (ambientCG PBR tiling sets). Missing in the kit:
  cypress / olive, helmets, baskets, braziers, true amphorae, siege tower / ram, bridges, Egyptian / Asian / mud-brick
  buildings, goat, chicken: model those in code (lathe / extrude) with `gloss()` materials.
- **Gloss:** `templates/pigs/pbr.ts`. `pbrTone(m)` = PBR material whose DIFFUSE is our two-tone light (same lit / shade /
  terminator / shadow) and whose SPECULAR stays physical (sun highlight, clearcoat, Fresnel, sky reflections).
  `gloss({ color, metal, rough, coat })` for code props (bronze `{ "#c8904e", metal 1, rough .3 }`, glaze
  `{ rough .32, coat .9 }`); `toneObject(o)` converts kit GLBs (their own roughness / metal maps win). The template's
  Pigs.tsx sets `scene.environment = envFromSky(gl, light)` per light preset (our own sky: reflections always match).
  Gloss only shows when props are big in frame: put hero props close to the lens.
- **Light for textured kit worlds:** the day shade [0.3, 0.31, 0.42] (tuned for the painted world) crushes textured
  facades. With kit assets use TONE shade [0.5, 0.52, 0.64] and world saturation (TONE.uSat) 1.2, and put the sun
  behind / beside the camera so roofs and facades facing the lens are lit (lab variant Q).
- **DOF on kit worlds:** cInf ~2 on wide shots (x DOF_K 0.5): the game look keeps the background mostly in focus. cInf
  6 cost 30 % of the measured fine detail.
- **World ink stays ON:** dropping it (the reference's newest look) made our world softer (sharp .135 -> .098).
- **Measured (lab, 3 frames, ab.py):** kit street + cInf 2 + cas 0.4 = lum .40 / sharp .220 vs the reference's newest
  .31-.40 / .217-.242. Still behind: density (his frames are packed with props and people) and a cooler, more vivid palette.
- **VFX:** `templates/pigs/vfx.ts` (frame-pure, seeded; update(f) with the story frame, fractional OK): `SmokePlume`
  (+ `SMOKE_PRESETS` steam / chimney / burning), `PuffBurst`, `Explosion` (flash, fireball, smoke cloud, shockwave
  ring, sparks, dust), `DustTrail`, `Fire` (torch .35 / straw pack .55 / brazier .75 / bonfire 1.6; `fire.light(f)` ->
  GLOW uniforms warms the world), `Debris` (rigid bodies simulated once, rest exactly on the ground). Replace every flat
  smoke / fire / dust card with these. Scale smoke to the source: a brazier gets a thin pale `chimney` wisp (rate ~.12,
  size [.1, .42]), never `burning` (that reads as a house fire). Weak spots: big dark smoke masses close up look lumpy
  (use lighter greys), the young fireball is flat orange for ~8 frames.

**Character rules (CHAR helper, toon3d.ts + chars.ts; report `references/reports/char_upgrade_2026-11-09.md`, sheets
`D:/youtube/out/pigs2/faces/sbs_*.jpg`):**
- Face decal at 3x the old resolution (LRU cache of 32 textures): faces stay vector-crisp in 2K close-ups.
- Bolder features: eyes ~1.3x, brows ~1.4x thicker, heavier ink, open mouths with a white teeth band split by lines.
- 24 EXPR (the 8 old names still work): laugh, laughCry, crying, nervous, smugBrow, sly, shockTeeth, scream, disgusted,
  sleepy, bored, furious (head tints purple-red over 3 f + 3D steam puffs), dizzy (orbiting stars), blush, dread, focus.
  Use a new expression on almost every line, as the reference does.
- Outfits read as fabric: woven texture, stitched seams, buttons, belts with buckles, emblem shapes (no letters), hem
  bands (Greek key etc.), patches, armour rivets, trimmed cloaks; hair caps with carved strands; hats with felt,
  stitching or studs. Dress every hero this way; period costumes included.
- Never draw 2D anger steam (cast.ts) and 3D steam on the same head (`KING_STEAM_3D`).

**Sound rules (`D:\youtube\pigs-short\audio\SOUND_UPGRADE.md`, `templates/audio/sfxbank.py`, `el.py sfx`):**
- SFX come from the recorded library `D:\youtube\sfx_lib\` (ElevenLabs sound generation, built by `build_lib.py`,
  budget-guarded) via `sfxbank.get(name, gain_db, pitch, seed)`; story-specific sounds (animals, machines) are generated
  per short. Synthesized SFX only as a fallback. Library BUILT 2026-11-09: 60 sounds (P1 + P2), 1,157 credits (real cost
  ~6-10 credits per second of sound, not the documented 40). Multi-take prompts ("four separate knocks") mostly return
  ONE event: vary repeats with pitch / gain. `crowd_panic` has an audible "go, go, go!": keep it low. The user's rule
  (2026-11-09): "dont use the credits unwantedly": no re-rolls, extras or music generation without asking.
- Whoosh on every camera speed peak (cam.csv), ambience bed per place, foley on visible actions: ~1 onset / 1.5-2 s.
- Duck on the voice's ENERGY, not the word table (ElevenLabs word times leave no gaps, so a word-table duck never opens).
- Voice stem unchanged (gain only). Near-mono, bass mono < 150 Hz.

## Look-match loop (how the bridge look was reached; reuse for any "make it look like X" pass)
1. **Measure the reference first.** One analysis agent per topic (motion, depth, textures, characters, lighting, outlines, grade), each writing numbers, not adjectives, to `references/reports/<topic>.md`. Shared brief: `compare/CONTEXT.md`. Reports are the source of truth for every agent after.
2. **Sandboxes, one owner per file.** Copy the project folder to `src/videos/<name>_{cam,world,mat,char,post}` with entries `src/sandboxes/<n>/index.tsx` (same `index.tsx` as main, only the import path changed). Ownership used for the bridge:
   - cam: story.ts (camera keys, cuts, kicks, DOF table, foreground props)
   - world: world.ts, lights.ts, shade.ts, grade.ts (sun, sky, fog, river, colour, grade)
   - mat: paint.ts, build.ts (painted textures, buildings, props)
   - char: toon.ts, cast.ts, cardshade.ts (character drawing, posing, card lighting, fx cards)
   - post: ink.ts, Bridge.tsx, lensblur.ts (outline pass, composer, lens blur, bloom)
   Agents only edit their own files in their own sandbox and render stills with `BRIDGE_ENTRY=src/sandboxes/<n>/index.tsx node scripts/bridge-stills.mjs out/<name>/<n>/x_ <frames> 0.5`.
3. **Merge** with `python scripts/bridge_merge.py [cam,world,mat,char,post]` (backs main up to `backup/bridge_<time>/`, copies owned files only). Then `npx tsc --noEmit` (filter to the project folder), then **re-sync every sandbox from main** (`cp -f src/videos/<name>/* src/videos/<name>_<n>/`) before the next round.
4. **Verify** with a fresh Opus max agent: side-by-side sheets (`python scripts/sbs_sheet.py out.jpg --ours a b --ref r1 r2`), score each area out of 10 (colour day / golden, lighting, ink, textures, characters, depth, composition) plus a numbered fix list with frame numbers. Map each fix to the file owner and resume that owner's agent with SendMessage (keeps its context). Bridge scores: round 1 5/3/4/5/4/7/4/6 → round 2 5/4/5/6/4/7/6/6 → round 3 see notes.
5. Contracts between owners live in exported constants (e.g. `NOINK` layer from ink.ts, `dofAt`/`FOREGROUND` from story.ts, `LIGHTS`/`LOOK` from lights.ts). Changing a contract means telling every owner that reads it.

## Gotchas
- **2K scale must be exact 4/3:** `--scale 1.3333` gives 1439.96 px and Remotion refuses non-integer sizes. Use `--scale 1.3333333333333333` (= 1440x2560 exactly).
- **Render timeouts at crossfades:** frames where two canvases draw (XFADE) or a new light/shader first compiles can exceed Remotion's 30 s default; render with `--timeout 240000 --concurrency 3`.
- When another session edits `src/Root.tsx` at the same time, give the short its own entry (`src/sandboxes/<name>/index.tsx` registering only its composition) and render and still from that entry.
- **Pin `@react-three/postprocessing` to 3.0.4** (with @react-three/fiber 9, React 19, three 0.170, remotion 4.0.540). 3.2.x creates its composer in an effect one render late; Remotion draws each frame once, before it exists, so every frame renders as the flat background colour with no error. `Bridge.tsx` aliases `EffectComposer` as `Composer` because 3.0.4's types reject null children.
- Kenney nature-kit materials are teal: recolour them by material name in build.ts.
- Cameras end up inside houses: the sight-line culler in build.ts/world.ts removes anything blocking any camera ray.
- Ink in the same merged effect pass as DOF gets overwritten. Ink must be its own pass before the blur.
- Pixel-sized post parameters must scale with resolution: stills are at 0.5, the final at 1.333. R3F clamps dpr to ≥ 1, so `--scale 0.5` stills still render a 1080x1920 buffer.
- **Disk:** every Remotion bundle copies `public/` (~1.3 GB) into `the temp folder\remotion-webpack-bundle-*` and never deletes it. 60+ GB filled the system drive during the bridge passes and a render died with ENOSPC. Always render with `export TEMP='<big drive>/remotion-tmp' TMP='<big drive>/remotion-tmp'` (bridge-stills.mjs sets it itself) and ask the user before deleting old bundle folders in the shared the temp folder (auto mode blocks the sweep). <big drive>/remotion-tmp fills too (~500 folders / 110 GB after the 4 bridge rounds): when a project is finished and nothing is rendering, delete its `remotion-webpack-bundle-*` and `puppeteer_dev_chrome_profile-*` folders there.
- In JS strings write `"<big drive>/remotion-tmp"`, never `"<big drive>\remotion-tmp"` (`\r` becomes a carriage return).
- Remotion writes a silent audio track: mux with `-map 0:v:0 -map 1:a:0`.
- Sub-agents can't write report files in this harness: ask them for a ≤150-word final message and save it yourself to `out/<name>/<n>/REPORT.md`.
- Scratch `.ts` files inside `out/` break `tsc`: name them `.txt`.
- 2K renders run ~4 fps (≈10 min for 67 s). Stills at 0.5 take 3-8 s each after a ~40 s bundle.
- Film grain at 2.5 % made the 2K file 910 MB instead of ~250 MB and will turn to mush on YouTube; the reference has none. Keep it off.

## Readability traps the verifier caught (check every new prop/shot for these)
- **A swing drawn as one rope that disappears behind the kid reads as a HANGING.** Always two ropes to a wide plank
  with the kid between them (`swingKid` in toon.ts), and a frame whose legs clear the arc (A-frame at each end).
- Props or flotsam closer than ~2 m to a lens become huge cut-off blobs at the frame edge. When a camera moves, re-check
  every prop near its new position (the river cameras moved into the floating hats).
- A foreground bush cut by the frame edge reads as a "green ball"; a foreground prop must be recognisable or gone.
- Flags: red + yellow star/diamond reads as Vietnam's. Use a period-correct flag (St George's cross for England 1831).
- Painted signs lit by a side sun go grey-blue and unreadable: give the sign face an unlit material.
- Golden rim light done as an offset outer copy turns every hat into a picture frame: inner rim only, head/torso only.
- Balcony/railing rails at chest height through characters: put the lens ~2.5 m up so rails cross legs, not torsos.
- Flat holds read as freezes in QA (frozen span ≥12 f): every hold needs a creeping push-in.
