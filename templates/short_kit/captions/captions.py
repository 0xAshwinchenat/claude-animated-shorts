# Word-synced captions for the Kaifeng short: voice/data/words.json -> captions.ass (1440x2560).
# 2-3 words per caption (never across a script line), UPPERCASE, bold white with a black outline, the spoken word
# in yellow, a small pop on each new caption. Burned in with ffmpeg's ass filter.
# Usage: python captions.py <words.json> <out.ass>
import json, re, sys

words = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
W, H = 1440, 2560
MAX_W, MAX_C = 3, 16  # words / characters per caption

def ts(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

# spoken numbers -> written on screen ("two thousand four hundred" -> "2,400", "eighteen fifty" -> "1850")
NUMS = []  # the Kaifeng words are already digits (1232, 16)
key = lambda w: re.sub(r"[^\w]", "", w["w"].lower()).replace("_", "")
merged, i = [], 0
while i < len(words):
    for pat, rep in NUMS:
        seq = words[i:i + len(pat)]
        if len(seq) == len(pat) and [key(x) for x in seq] == pat:
            tail = re.sub(r"^[\w\-]+", "", seq[-1]["w"])
            merged.append({**seq[0], "w": rep + tail, "e": seq[-1]["e"]}); i += len(pat); break
    else:
        merged.append(words[i]); i += 1
words = merged

def clean(w):
    return re.sub(r"(\d)S\b", r"\1s", re.sub(r"[^\w'\-,]", "", w).strip(",").upper())

# group: consecutive words of the same line, up to MAX_W words / MAX_C chars, break after punctuation
groups, cur = [], []
for i, w in enumerate(words):
    if cur and (w["line"] != cur[-1]["line"] or len(cur) >= MAX_W
                or len(" ".join(clean(x["w"]) for x in cur + [w])) > MAX_C
                or re.search(r"[,.:;!?]$", cur[-1]["w"])):
        groups.append(cur); cur = []
    cur.append(w)
if cur: groups.append(cur)

ev = []
for gi, g in enumerate(groups):
    g0 = g[0]["s"] - 0.05
    nxt = groups[gi + 1][0]["s"] - 0.05 if gi + 1 < len(groups) else g[-1]["e"] + 0.6
    g1 = min(nxt, g[-1]["e"] + 0.6)
    for k, w in enumerate(g):
        a = g0 if k == 0 else w["s"] - 0.03
        b = g1 if k == len(g) - 1 else g[k + 1]["s"] - 0.03
        if b <= a: continue
        parts = []
        for j, x in enumerate(g):
            t = clean(x["w"])
            parts.append(r"{\c&H00D9FF&}" + t + r"{\c&HFFFFFF&}" if j == k else t)
        pop = r"{\fscx112\fscy112\t(0,90,\fscx100\fscy100)}" if k == 0 else ""
        ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{pop}{' '.join(parts)}")

head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Arial Black,128,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,1,0,1,11,5,2,70,70,600,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(out, "w", encoding="utf-8").write(head + "\n".join(ev) + "\n")
print(len(groups), "captions,", len(ev), "events ->", out)
