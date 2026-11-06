"""Word timings for data/narration.wav: faster-whisper (small.en) word times, aligned to script.json's spelling.
Run with the faceless-shorts venv python (it has faster-whisper):
  ~/.faceless-shorts/venv/Scripts/python.exe align_words.py
Writes data/words_raw.json (what Whisper heard), data/words.json [{w, line, s, e}], data/lines.json, data/words.txt.
"""
import json, re
from difflib import SequenceMatcher
from faster_whisper import WhisperModel

norm = lambda w: re.sub(r"[^a-z0-9]+", "", w.lower())
S = json.load(open("script.json", encoding="utf-8"))
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs, _ = m.transcribe("data/narration.wav", word_timestamps=True, language="en", beam_size=5)
heard = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
json.dump([{"w": h[0], "s": round(h[1], 3), "e": round(h[2], 3)} for h in heard], open("data/words_raw.json", "w"), indent=0)

sw, sl = [], []
for i, L in enumerate(S["lines"]):
    for w in L["text"].split(): sw.append(w); sl.append(i)
a = [norm(w) for w in sw]; b = [norm(h[0]) for h in heard]
times = [None] * len(a)
for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
    for k in range(blk.size): times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
miss = [sw[i] for i in range(len(a)) if times[i] is None]
i = 0
while i < len(a):  # unmatched words share the gap between matched neighbours by length
    if times[i] is not None: i += 1; continue
    j = i
    while j < len(a) and times[j] is None: j += 1
    lo = times[i - 1][1] if i > 0 else 0.0; hi = times[j][0] if j < len(a) else heard[-1][2]
    if hi <= lo: hi = lo + 0.05 * (j - i)
    L = [max(1, len(a[k])) for k in range(i, j)]; tot = sum(L); c = lo
    for k, l in zip(range(i, j), L): d = (hi - lo) * l / tot; times[k] = (c, c + d * 0.9); c += d
    i = j
words = [{"w": w, "line": l, "s": round(t[0], 3), "e": round(t[1], 3)} for w, l, t in zip(sw, sl, times)]
json.dump(words, open("data/words.json", "w"), indent=1)
lines = [{"i": i, "text": L["text"], "start": min(w["s"] for w in words if w["line"] == i),
          "end": max(w["e"] for w in words if w["line"] == i)} for i, L in enumerate(S["lines"])]
json.dump({"lines": lines}, open("data/lines.json", "w"), indent=1)
with open("data/words.txt", "w", encoding="utf-8") as f:
    for w in words: f.write(f"{w['s']:7.2f} {w['e']:7.2f}  L{w['line']:<2} {w['w']}\n")
print(f"{len(sw)} script words, {len(heard)} heard, unmatched script words: {miss}")
for L in lines: print(f"L{L['i']:<2} {L['start']:6.2f}-{L['end']:6.2f}  {L['text'][:70]}")
