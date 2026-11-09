"""GOLD-STANDARD voice prep (pigs short, 2026-11-08): an ElevenLabs read used EXACTLY as generated.
The user: "use the exact voice ... dont tone down or up anything use how it is". So: no pause cuts, no tempo, no EQ;
the mp3 is only decoded to 48 kHz 24-bit for the mix. Word times come straight from ElevenLabs' character alignment
(el.py tts ... -> <out>_align.json), written with script.json's spelling.
Generate first (from the Remotion root, key from HKCU):
  python scripts/el.py tts 4N8zjn9tVNuDEBFWVHAq <name>-short/voice/data/el/script_tts.txt          <name>-short/voice/data/el/jesse.mp3 <name>-short/voice/data/el/jesse_align.json eleven_v4 asis
then, in <name>-short/voice:
  python prep_el.py data/el/jesse.mp3 data/el/jesse_align.json
script_tts.txt = script.json's lines joined with spaces, except numbers spelled the way they should be said
("Greece, two sixty-six BC."); NUMS below folds those spoken tokens back into the script's word ("266").
-> data/narration.wav, data/words.json [{w, line, s, e}], data/lines.json, data/words.txt
"""
import json, re, subprocess, sys

SRC, ALIGN = sys.argv[1], sys.argv[2]
NUMS = [(["two", "sixty-six"], "266")]   # (spoken TTS tokens, script word): edit per short
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s24le", "data/narration.wav"], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "data/narration.wav"],
                           capture_output=True, text=True).stdout)
A = json.load(open(ALIGN))["alignment"]
toks, cur = [], None
for c, a, b in zip(A["characters"], A["character_start_times_seconds"], A["character_end_times_seconds"]):
    if c.isspace():
        if cur: toks.append(cur); cur = None
        continue
    if cur is None: cur = [c, a, b]
    else: cur[0] += c; cur[2] = b
if cur: toks.append(cur)
norm = lambda w: re.sub(r"[^a-z0-9]+", "", w.lower())
for spoken, word in NUMS:
    k = len(spoken)
    for i in range(len(toks) - k + 1):
        if [norm(t[0]) for t in toks[i:i + k]] == [norm(x) for x in spoken]:
            toks[i:i + k] = [[word + re.sub(r"[A-Za-z0-9-]+", "", toks[i + k - 1][0]), toks[i][1], toks[i + k - 1][2]]]; break
S = json.load(open("script.json", encoding="utf-8"))
sw, sl = [], []
for li, L in enumerate(S["lines"]):
    for w in L["text"].split(): sw.append(w); sl.append(li)
bad = [(t[0], w) for t, w in zip(toks, sw) if norm(t[0]) != norm(w)]
assert len(toks) == len(sw) and not bad, (len(toks), len(sw), bad[:5])
words = [{"w": w, "line": l, "s": round(t[1], 3), "e": round(t[2], 3)} for w, l, t in zip(sw, sl, toks)]
json.dump(words, open("data/words.json", "w"), indent=1)
lines = [{"i": li, "text": L["text"], "start": min(w["s"] for w in words if w["line"] == li),
          "end": max(w["e"] for w in words if w["line"] == li)} for li, L in enumerate(S["lines"])]
json.dump({"lines": lines}, open("data/lines.json", "w"), indent=1)
with open("data/words.txt", "w", encoding="utf-8") as f:
    for w in words: f.write(f"{w['s']:7.2f} {w['e']:7.2f}  {w['s'] * 30:7.1f}f  L{w['line']:<2} {w['w']}\n")
print(f"narration.wav {dur:.2f} s; {len(words)} words; last word ends {words[-1]['e']:.2f} s = {len(words) / words[-1]['e']:.2f} w/s; "
      f"TOTAL ~ {round(words[-1]['e'] * 30 + 15)} frames")
