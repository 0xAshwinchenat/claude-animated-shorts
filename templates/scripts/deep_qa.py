# Deep per-frame QA for blur dips, flicker and stutter (more sensitive than short_qa.py).
# Usage: python deep_qa.py <video.mp4> <shots.json> <out.txt>
import json, subprocess, sys, shutil
import numpy as np

vid, shots_p, outp = sys.argv[1:4]
meta = json.load(open(shots_p))
ff = shutil.which("ffmpeg")
W, H = 360, 640
raw = subprocess.run([ff, "-v", "error", "-i", vid, "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32) / 255
n = len(F)
cuts = set()
for s in meta["shots"]: cuts.update(range(s["a"] - 1, s["a"] + 2))
for a, b in meta.get("xfade", []) + meta.get("planned", []) + [meta["flash"]]: cuts.update(range(a - 1, b + 2))

def lap(x):
    return (x[1:-1, 2:] + x[1:-1, :-2] + x[2:, 1:-1] + x[:-2, 1:-1] - 4 * x[1:-1, 1:-1])
sharp = np.array([lap(f).var() for f in F])
diff = np.r_[0, np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))]
# flicker: brightness of the frame vs neighbours (A-B-A pattern)
lum = F.mean(axis=(1, 2))
out = []
def shot_of(f):
    for s in meta["shots"]:
        if s["a"] <= f < s["b"]: return s["id"]
    return -1
# 1) sharpness dips: < 0.8 x median of the surrounding 31 frames (same shot)
dips = []
for f in range(n):
    if f in cuts: continue
    lo, hi = max(0, f - 15), min(n, f + 16)
    win = [g for g in range(lo, hi) if shot_of(g) == shot_of(f) and g not in cuts]
    m = np.median(sharp[win])
    if sharp[f] < 0.8 * m: dips.append((f, round(float(sharp[f] / m), 2)))
out.append(f"SHARPNESS DIPS (<0.8 x local median): {len(dips)}")
out.append("  " + ", ".join(f"{f}:{r}" for f, r in dips))
# 2) per-shot sharpness median (low = soft shot)
out.append("PER-SHOT median sharpness (x1e4):")
for s in meta["shots"]:
    seg = sharp[s["a"]:s["b"]]
    out.append(f"  shot {s['id']:2d} f{s['a']}-{s['b']-1}: {np.median(seg)*1e4:.2f}  min {seg.min()*1e4:.2f}")
# 3) motion stutter: diff spikes > 1.8x local median, and near-zero diffs inside moving stretches (stepped motion)
spk, held = [], []
for f in range(2, n):
    if f in cuts: continue
    lo, hi = max(1, f - 10), min(n, f + 11)
    m = np.median(diff[lo:hi])
    if m > 0.002 and diff[f] > 1.8 * m: spk.append(f)
    if m > 0.004 and diff[f] < 0.3 * m: held.append(f)
out.append(f"DIFF SPIKES (>1.8x local median): {len(spk)}")
out.append("  " + ", ".join(map(str, spk)))
out.append(f"HELD/STEPPED FRAMES (<0.3x local median in motion): {len(held)}")
out.append("  " + ", ".join(map(str, held)))
# 4) luminance flicker: |l[f] - (l[f-1]+l[f+1])/2| large
fl = [f for f in range(1, n - 1) if f not in cuts and abs(lum[f] - (lum[f - 1] + lum[f + 1]) / 2) > 0.006]
out.append(f"LUMA FLICKER (A-B-A > 0.006): {len(fl)}")
out.append("  " + ", ".join(map(str, fl)))
open(outp, "w").write("\n".join(out) + "\n")
print("\n".join(out))
