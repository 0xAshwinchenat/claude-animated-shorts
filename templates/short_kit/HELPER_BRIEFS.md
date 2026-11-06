# Helper-agent briefs (the 4 that built the Kaifeng short) - adapt the build lists to the new story

Launch all four in ONE message (Agent tool, `subagent_type: general-purpose`, `run_in_background: true`). Each brief has
the same skeleton; only "What to build" changes. Replace `<name>`, `<Comp>`, `<owner>`.

## Shared skeleton (paste into every brief)
```
You are the <OWNER> owner on a team making a 69 s vertical cartoon short in Remotion 4 + three.js r170 (R3F 9):
"<title>". <2-3 sentence story>. Script + facts: <P>/<name>-short/SCRIPT.md (read it first)
[+ for timing-heavy owners: word timings <P>/<name>-short/voice/data/words.txt (seconds; frame = s x 30)].

## Your files (ONLY these; in your sandbox)
Sandbox: <P>/src/videos/<name>_<owner> (a full copy of the main project). Entry: src/sandboxes/k_<owner>/index.tsx.
You own <files> (keep the class's constructor/update signature exactly) and may create <paint file> for painted
Canvas2D textures. Everything else is READ-ONLY. story.ts is the contract: layout constants, beat functions (frames),
shared trajectories, shots. If you need a contract change, ask for it in your final report. For inspection only you may
temporarily edit your sandbox's story.ts camera (never merged) but revert it before you finish.

## What to build (+x = east, -z = north; positions from story.ts)
1. ... (numbered, each with the story.ts constants, the k-functions / frames that drive it, and how it must read)

## Style + rules
Read <skill>/SKILL.md (Final look values, Look targets, What the 22-short study adds, Readability traps) and
references/STYLE_BIBLE.md; reference frames references/frames/new6_*.jpg are PRIVATE study material: never upload or
publish them. Pattern library: <P>/src/videos/kaifeng/ (siege.ts, camp.ts, venues.ts, paint*.ts, chars.ts, toon3d.ts):
Canvas2D HD painted textures, twoTone(new THREE.MeshLambertMaterial(...)) from shade.ts, chunky bevelled props; the ink
is a post pass outlining everything not on the NOINK layer. Emissive fire uses HDR colours > 1 (bloom threshold 1.0).
- update(sid, f, cam) must be a pure function of (sid, f); f is a FRACTIONAL story frame (30 fps units; the 120 fps HQ
  render passes quarter frames, so motion must be smooth between frames). No Math.random at render time (story.hash).
  Build geometry once in the constructor; per frame only transforms / instance matrices / visibility.
- Performance: a 1080x1920 still must stay under ~8 s; merge static geometry, InstancedMesh for repeats.

## Checking
Stills: `cd <P> && COMP=<Comp>Short BRIDGE_ENTRY=src/sandboxes/k_<owner>/index.tsx node scripts/stills.mjs
out/<name>/<owner>/x_ <frames> 0.5` (~40 s bundle + ~4 s each); read them with the Read tool. Frames (the camera is a
rough FIRST PASS the lead will refine): <beat frames for this owner>. Type-check: `npx tsc --noEmit -p . 2>&1 | grep
<name>_<owner>` must print nothing before you finish.

Budget: ~60-90 minutes. Finish with a <=150-word final message: what you built, which still files show it, anything
the lead must know (positions to frame, contract requests, known issues). Do not write report files.
```

## The four build lists used for Kaifeng (condensed)
**WALL (siege.ts, paintw.ts) - the main place.** Rammed-earth city wall (battered faces, 8-12 cm pounded layers,
putlog holes, walkway, crenellated parapet, ramps); dents from every PROJ hit + procedural background dents by a
density function; the gate (passage, studded doors opening by gateK, 2-storey gate tower); wooden towers incl. one that
shatters (k-function) and one padded with dung / straw / felt (three k-functions); the defenders' trebuchet + the
garden rock it throws (load, flight via projAt, landing); the bomb on a chain on story.bombAt; the growing rubble heap
(heapK); the city inside (houses, palace, the courtyard with empty jars); the plain; night torches (`glow`); sight-line
culling from the `rays` argument.

**CAMP (camp.ts, paintc.ts) - the second place + machines + projectiles.** The hero traction trebuchet (beamK on its
release frames, boulder in the sling, sling whip); 400 instanced battery trebuchets with animated beams; every
projectile in flight (PROJ + the swarm from story.battShots), dent boulders dropping to the wall foot; the millstone
(whole -> 3 wedges at F_SMASH, carried into a sling, thrown); cowhide tents creeping (tentK) + the explosion
(HDR fireball, toon smoke, flying scraps, scorch); yurts, banners, horse lines, the hero's command post.

**CHAR (chars.ts, toon3d.ts, cast.ts, toon.ts, cardshade.ts) - people + effect cards.** Extend toon3d.ts with the
period hats / facial hair / robes / props; every 3D character's acting per beat (frame 0 mid-action, strikeTrack
contacts on the story hit frames, an expression swap 0-3 f before most words hidden in a blink, dead-still holds,
3-5 f attacks, planted walks); card crowds (the army, rope crews pulling on each release, defenders over the parapet);
effect cards (a dust burst at every impact from PROJ / battShots, splinters, splats, sparks, fuse fizz, soot, feathers).
No lip-sync for a narrator-only short.

**VENUE (venues.ts, paintv.ts) - the explanation.** The yurt lesson (table, a plate that cracks right through and
splits at F_PLATE, a layered earth block whose face matches the macro set, a pillow that dents by pillowDentK); the
macro grain bed (thousands of instanced grains in strata, a boulder landing at F_MACRO crushing only the grains it
touches, a dent); the Great Wall ridge cut open by cutK to show its pounded-earth heart. Report the exact positions to
frame (contact points, the landing point, the cut face's centre + normal).

## Follow-ups that paid off
- "Use story.battShots for targets" (so the dust lands on the boulders), "use bombAt / doorDeg / PLATE_HIT".
- "Your camera sits inside X" -> move the beat to open ground (the millstone moved to the battery's flank).
- Ask the venue owner for exact contact points and put them in story.ts for the char owner.
