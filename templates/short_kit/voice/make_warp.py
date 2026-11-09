"""ONLY when a voice is REPLACED after the picture is built (the pigs short, 2026-11-08). KEY, SYN, HOLD and
CUTS_OLD below are the pigs values: edit them per short. Voice re-time for the pigs short: the picture was built on the Kokoro am_michael read (data/v1_am_michael/words.json,
TOTAL 1645 old film frames). The ElevenLabs read (data/words.json) is shorter, so every NEW film frame g plays the OLD
film frame warp(g). Anchors: new <-> old start frame of every line's first word and of the action words the picture's
beats are keyed to, plus the end of the last word and the tail; a monotone cubic (PCHIP) through them keeps the
picture's speed changes smooth.
Writes data/warp.json {old_total, film_total, table} (table[g] = old frame, g = 0..film_total) and
src/videos/pigs/warp.ts (FILM_TOTAL + warpF(g) with linear interpolation for the 120 fps sub-frames).
  python make_warp.py
"""
import json, re
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter1d
SIGMA = 10.0   # frames: smooths the picture-speed changes (anchors may drift a few frames)

FPS = 30
O = json.load(open("data/v1_am_michael/words.json")); N = json.load(open("data/words.json"))
# the v2 script re-words the lines (same 18 lines, same beats, same order): anchors = each line's first word + the action
# words matched INSIDE the same line by stem (SYN maps old -> new spellings that don't share a 4-letter stem)
assert max(o["line"] for o in O) == max(n["line"] for n in N)
SYN = {"hung": "hang", "ran": "runs"}
OLD_TOTAL = int(re.search(r"export const TOTAL = (\d+)", open("../../src/videos/pigs/story.ts", encoding="utf-8").read()).group(1))
KEY = {"smash", "defenders", "raid", "smear", "fire", "open", "shrieking", "freeze", "spin", "stampede", "crash", "army",
       "swore", "panic", "ordered", "daily", "later", "pushed", "edessa", "light", "hung", "squealed", "ran"}
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
anc = [(0.0, 0.0)]
for li in range(1, max(o["line"] for o in O) + 1):
    ol = [o for o in O if o["line"] == li]; nl = [n for n in N if n["line"] == li]
    if norm(ol[0]["w"]) == norm(nl[0]["w"]):     # pin the line start only when both lines open the same way: an
        anc.append((nl[0]["s"] * FPS, ol[0]["s"] * FPS))   # added lead-in ("Does it work?") must not freeze the picture
    for o in ol:
        k = norm(o["w"])
        if k not in KEY: continue
        want = SYN.get(k, k)
        hit = [n for n in nl if norm(n["w"]) == want or norm(n["w"])[:4] == want[:4]]
        if hit: anc.append((hit[0]["s"] * FPS, o["s"] * FPS))
        else: print(f"  (no match in line {li} for '{k}')")
for li in [0]:   # line 0 (the hook): its action words too
    for o in [o for o in O if o["line"] == 0 and norm(o["w"]) in KEY]:
        hit = [n for n in N if n["line"] == 0 and norm(n["w"])[:4] == norm(o["w"])[:4]]
        if hit: anc.append((hit[0]["s"] * FPS, o["s"] * FPS))
anc = sorted(set(anc))
old_end, new_end = O[-1]["e"] * FPS, N[-1]["e"] * FPS
FILM_TOTAL = int(round(new_end + (OLD_TOTAL - old_end)))
anc.append((FILM_TOTAL, OLD_TOTAL))
# where an added lead-in stretches a beat, put the slow-down on the shot BEFORE the action (a cut / the charge) and keep
# the action itself near PACE: (old frame of the split, old frame of the action word it leads into)
PACE = 0.8
HOLD = [(478.0, "raid"), (800.0, "freeze")]   # 478 = the hard cut into the pen; 800 = the charge -> the frozen elephants
for split, wkey in HOLD:
    o = next(o for o in O if norm(o["w"]) == wkey); n = next(n for n in N if norm(n["w"]) == wkey)
    anc.append((n["s"] * FPS - (o["s"] * FPS - split) / PACE, split))
anc = sorted(set(anc))
a = np.array(sorted(anc)); assert np.all(np.diff(a[:, 0]) > 0) and np.all(np.diff(a[:, 1]) > 0)
p = PchipInterpolator(a[:, 0], a[:, 1])
g = np.arange(FILM_TOTAL + 1); t0 = np.interp(g, a[:, 0], a[:, 1])   # straight segments between anchors (smoothed below)
# smooth the picture speed, but never across a hard CUT (the speed may jump there unseen)
CUTS_OLD = [478.0]
d0 = np.diff(t0); cut_idx = [int(np.searchsorted(t0, c)) for c in CUTS_OLD]
sl = np.empty_like(d0); edges = [0] + cut_idx + [len(d0)]
for lo, hi in zip(edges[:-1], edges[1:]):
    sl[lo:hi] = gaussian_filter1d(d0[lo:hi], SIGMA, mode="nearest")
table = np.concatenate([[0.0], np.cumsum(sl)]); table *= OLD_TOTAL / table[-1]
err = np.interp(a[:, 0], g, table) - a[:, 1]
print("anchor drift (old frames): max |%.2f|, mean |%.2f|" % (np.abs(err).max(), np.abs(err).mean()))
for (gn, go), e in zip(a, err):
    if abs(e) > 2.5: print(f"  anchor new {gn:.0f} old {go:.0f}: drift {e:+.1f}")
slope = np.diff(table)
print(f"{len(a)} anchors; FILM_TOTAL {FILM_TOTAL} f = {FILM_TOTAL / FPS:.2f} s (old {OLD_TOTAL}); "
      f"picture speed old/new: min {slope.min():.2f} max {slope.max():.2f} mean {slope.mean():.3f}; "
      f"max change per frame {np.abs(np.diff(slope)).max():.3f}")
for lo, hi in [(0.75, 0.85), (1.3, 1.45)]:
    idx = np.flatnonzero((slope >= lo) & (slope < hi)); print(f"  frames with speed in [{lo},{hi}): {len(idx)}")
json.dump({"old_total": OLD_TOTAL, "film_total": FILM_TOTAL, "anchors": a.round(2).tolist(),
           "table": [round(float(v), 4) for v in table]}, open("data/warp.json", "w"))
with open("../../src/videos/pigs/warp.ts", "w", encoding="utf-8") as f:
    f.write("// GENERATED by pigs-short/voice/make_warp.py: the ElevenLabs re-time. The picture (story.ts and every rig) is\n"
            "// timed in OLD film frames (the am_michael read, TOTAL). The film is FILM_TOTAL NEW frames; new frame g plays\n"
            "// old frame warpF(g) (monotone, smooth; anchored on the line starts and the action words).\n")
    f.write(f"export const FILM_TOTAL = {FILM_TOTAL};\n")
    f.write("const T: number[] = [" + ",".join(f"{v:.3f}" for v in table) + "];\n")
    f.write("export const warpF = (g: number): number => {\n"
            "  if (g <= 0) return T[0] + (T[1] - T[0]) * g;\n"
            "  const n = T.length - 1;\n"
            "  if (g >= n) return T[n] + (T[n] - T[n - 1]) * (g - n);\n"
            "  const i = Math.floor(g), u = g - i;\n"
            "  return T[i] + (T[i + 1] - T[i]) * u;\n"
            "};\n")
print("wrote data/warp.json + src/videos/pigs/warp.ts")
