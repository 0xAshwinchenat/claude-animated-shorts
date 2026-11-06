# the reference channel style bible (study of latest 20 shorts, 2026-10-30)
Private study only. Videos: vids/ (720p, original EN audio), transcripts: tx/, per-video measurements: measure/summary.json,
30 fps contact sheets: measure/<video>_sheets/ (each sheet = 2 s, 60 frames).

## Format
- Vertical 1080x1920, 30 fps, 31-78 s (median ~60 s), voice starts at frame 1-4 (no intro, no logo, no outro, no CTA).
- Voice: one male narrator, fast and steady: 3.5-4.1 words/s (median 3.7), almost no pauses (word gaps >0.25 s total <1 s per video).
- Loudness -14 LUFS integrated, LRA ~2.4 LU (heavily compressed). Music/SFX bed under voice only ~5-10 dB below speech.
- Captions: one word (sometimes 2-3) at a time, white bold sans, thin black outline, lower-middle, hard swaps on each word.
  (OUR RULE: no captions unless the user asks.)

## Script formula (20/20 follow it)
1. **Hook = paradox stated as fact, sentence 1, no setup.** A person did something that sounds dumb/impossible with stakes,
   or "If you X, you'd Y", or "X is illegal, yet ...". ~10-16 words.
2. **Setting in 1-2 lines**, present tense, concrete details (time of day, a named everyman, numbers).
3. **Escalation, 3-6 beats**: others laugh / doubt / mock (short in-character dialogue lines), stakes climb.
   1-2 exaggeration jokes per video (claim vs reality, "so slow X, and X was ...").
4. **Mystery beat**: a question or "Wait, ...?" (~1 per video).
5. **Pivot word "You see,"** (14 of 20 videos) → the real mechanism. It lands at ~70 % of the runtime (22-short study:
   reveal at ~70 % → median 11 M views; explained early → 3.4 M). Often an everyday analogy
   ("Ever ...?", "think about the last time ...", "picture your body as ...").
6. **Ironic payoff** in the last 1-2 sentences, short, lands the twist. Video ends on the last word.
- Two modes: story mode (third person "he", named everyman, present tense) and "Imagine you're..." second person.
- Sentences ~13.5 words median, plain spoken English, contractions, no jargon unless explained in the next clause.

## Picture
- 2D flat cartoon characters (simple outlined faces, thin black outline, flat colors) standing in **3D toon environments**.
  The 22-short study (2026-11-04) is >95 % sure the characters are TRUE 3D toon renders (back of the head on turnarounds,
  depth parallax): ~3.1 heads, sphere head h/w 0.92, ink-tube arms, ball hands, decal faces, plum ink #2a1b26, never #000.
- 3D environments: hand-painted textures, saturated colors, **thin black ink outlines on 3D geometry** (edges + creases),
  soft depth of field on backgrounds, warm key light + blue/purple shadows, light pools (window light) that also tint the characters.
- Characters receive scene light/shadow (they are lit, not pure emission), cast ground shadows.
- Color stats (per video median): lum mean 0.43-0.54, lum std 0.21-0.29, p2 0.03-0.11 (deep darks), p98 0.9-1.0,
  saturation 0.38-0.65 (very saturated). Lighting changes with story beats (noon -> sunset -> night-blue for the explanation).
- Every sentence is illustrated literally; props carry the joke (beers, frogs, milk cart).

## Camera / editing (measured)
- **Hard cuts almost never**: 0-1 per video in 12/20 videos; most "cuts" detected are 4-frame flash effects.
- CORRECTED (reports/motion.md and the 22-short study of 2026-11-04): the camera does NOT hold ~80 % and the moves are
  NOT ease-out bursts (that was an integer-phase artefact). Moves are symmetric ease-in-out ~23 f peaking 14-16 px/f,
  median speed 3.6 px/f, holds < 0.3 px/f only ~10 %. The 22-short study: the camera never stops, a new framing every
  ~1.7 s (26/min, first by 1.1 s), inside a set eased flights (push 26 %, pull 16 %, whip 13 %, pan 8 %, tilt 4 %),
  between sets portals or 7-frame dissolves (~1/3 of changes). See SKILL.md "Continuous camera".
- Transitions = continuous camera moves: follow an object (bullet, oil stream, ball) from one subject to the next,
  whip pans with motion blur, fly-through (window/porthole), or a 6-8 frame crossfade dissolve when changing place.
- Slow push-ins during holds; low camera heights. ~~frequent dutch tilts for drama/falls~~ CORRECTED 2026-11-06 (roll_meter.py
  on the newest 6 shorts): the camera stays LEVEL (median roll 0.3°, p90 ~2°, characters always upright). Tilted-looking
  frames are low-angle wide-lens perspective, rocking ships or top-down shots. Real roll only on a fast ride-along (bullet
  cam banks to ~8-10°, back to 0 before landing).

## Effects
- Muzzle fire, glow/aura bursts, sparkles on impact, splash sprites, speed lines, dust puffs, music notes, stars,
  light shafts; all flat 2D cartoon sprites composited into the 3D scene.
