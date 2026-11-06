# Per-frame voice loudness for lip-sync (toon3d.ts mouthRms). The reference mouths change on ones and correlate with the
# voice RMS (r ~0.47, mouth leading 0-1 f; references/reports/motion.md), so the mouth is driven by this curve.
# usage: python -I voice_rms.py voice.wav rms.json [fps=30] [start_s=0]
#   -> JSON array, one value per video frame, normalised so the 95th percentile of voiced frames = 1.
#   One file per speaking character: cut each character's lines from voice.wav (or pass start_s and slice in story.ts).
import json
import sys

import numpy as np
from scipy.io import wavfile

src, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0
start = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.ndim > 1:
    x = x.mean(axis=1)
peak = np.abs(x).max() or 1.0
x /= peak
x = x[int(start * sr):]
hop = sr / fps
n = int(len(x) / hop)
rms = np.array([np.sqrt(np.mean(x[int(i * hop):int((i + 1) * hop)] ** 2) + 1e-12) for i in range(n)])
voiced = rms[rms > 0.02]
ref = np.percentile(voiced, 95) if len(voiced) else 1.0
r = np.clip(rms / ref, 0, 1.5)
r = np.convolve(r, [0.25, 0.5, 0.25], mode="same")  # light smoothing: keeps syllables, kills single-frame clicks
json.dump([round(float(v), 3) for v in r], open(out, "w"))
print(f"{src}: {n} frames at {fps} fps, voiced {len(voiced)}, p95 rms {ref:.4f} -> {out}")
