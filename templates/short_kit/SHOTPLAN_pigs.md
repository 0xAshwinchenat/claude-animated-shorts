# Pigs short: shot plan (frames @30 fps; voice = voice/data/narration.wav, 54.76 s; TOTAL 1645)

Contract: `src/videos/pigs/story.ts`. Owners: lead (story/world/Pigs.tsx/camera/audio/captions), city (city.ts), beast
(beasts.ts), char (chars.ts, cast.ts, toon.ts, toon3d.ts, cardshade.ts), venue (venues.ts). Merge:
`python scripts/short_merge.py pigs city,beast,char,venue`. Entry: `src/sandboxes/pigs/index.tsx` (PigsShort + PigsShortHQ).

**SET PIECE (retention 10-12 s): frames 330-470.**
- The camera cranes up off E3's flank as the arrow volley flies and sticks.
- It rises over the whole elephant line as it charges.
- The line smashes Megara's last defenders (F_SMASH 428); the defenders fly.
- The music's first lift, and the loudest SFX so far.

**Answer (resolve) = "So the Megarians raid" at 483 (16.1 s).** The hook names the payoff (pigs beat elephants); the fire and the squeal stay open until then.

**Loop:** the last image (1592-1645) is the Edessa pig at the lens with the elephant behind it. It matches frame 0 (the burning pig at the lens, E3 rearing behind it).

| shot | frames | line | place / light | beat |
|---|---|---|---|---|
| 1 | 0-117 | L0 | Megara plain, day (slow-mo flash-forward, st 826-885) | the burning hero pig sprints at the low lens; E3 rears behind ("war elephants" 31-40); the scream 88 |
| 2 | 118-287 | L1 | Megara, day (dissolve) | over E3 toward the city ("Greece, 266 BC" 125-158); push in on Antigonus, who looks back (203-226); he points at "Megara" 266 |
| 3 | 288-391 | L2 | " | down E3's flank: spears bounce 298 / 308 / 318; SET PIECE crane as the volley sticks (336-377) |
| 4 | 392-477 | L3 | " | up over the charge: the line smashes the last defenders (F_SMASH 428, "defenders" 455) |
| 5 | 478-689 | L4-L6 | inside the city (dissolve) | the pen: the hero grabs P0 (506); the carry; "smear" 565; the queue turns black; the torch: "fire" 671 (F_IGNITE 668), the flame runs down the queue |
| 6 | 690-799 | L7 | " -> out of the gate | the gate swings open (699-722); RIDE-ALONG with the hero pig through the gate ("charge out" 760-770, "shrieking" 780) |
| 7 | 800-1004 | L8-L10 | Megara plain | "freeze" 820 (E3 rears 820-864); the spin (866-880); the stampede (884); the crash through the phalanx (948, "army" 992) |
| 8 | 1005-1107 | L11 | the writer's room (dissolve) | "swore" 1036; the drawing draws itself (1046-1088); the push into the scroll ("squeal" 1090) |
| 9 | 1108-1294 | L12-L13 | the stable (dissolve) | Antigonus points ("ordered" 1137); the trainers carry the piglets (1146-1192); the piglet squeals (1276); the baby just toots back |
| 10 | 1295-1644 | L14-L17 | Edessa, golden (dissolve) | the elephant pushed in ("pushed" 1367, arrives 1405); the Roman dunks his torch ("light" 1458); the pig on the hook ("hung" 1514), lowered to the eye (1508-1558); the SQUEAL 1572; rear, turn, RUN (1614, "ran" 1620); the payoff |

Dissolves (7 f): into shots 2, 5, 8, 9, 10. Portals: the ride-along out of the gate (shot 6).

**Camera:** cam_qa scores 13/16 on the first tuned pass. The fails:
- Gate 6: the ride-along and Edessa rope-follow transits are longer than 16 f (the motion blur covers them).
- Gate 8: 3 small brakes.
- Gate 16: median speed 5.4 against the 2-5 target, because of the tracking shots.
