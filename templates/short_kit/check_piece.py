r"""Check a re-rendered 120 fps HQ piece frame by frame against preview1 (30 fps) for GPU faults.
usage: python check_piece.py <piece.mp4> <first HQ frame> <preview1.mp4> <expected HQ frames>
Every HQ frame 4k (k = story frame) is compared with preview frame k. Flags: white (mean luma > 230), lost textures
(luma ratio vs preview < 0.6, or > 25 points more near-black pixels than the preview). Exit 1 on any fault."""
import sys, subprocess, numpy as np
piece, a, prev, want = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
W, H = 36, 64
def gray(src, vf):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"{vf}scale={W}:{H},format=gray", "-fps_mode", "passthrough",
                        "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, H, W).astype(float)
allf = gray(piece, "")
n = len(allf)
if n != want:
    print(f"BAD frame count {n} != {want}"); sys.exit(1)
c = allf[[i for i in range(n) if (a + i) % 4 == 0]]
k0 = (a + 3) // 4
import os, json
if os.environ.get("WARP_JSON"):   # voice re-time: film frame g is compared with preview frame round(warp(g))
    T = np.array(json.load(open(os.environ["WARP_JSON"]))["table"]); pa = gray(prev, "")
    p = pa[np.clip(np.round(T[k0:k0 + len(c)]).astype(int), 0, len(pa) - 1)]
else:
    p = gray(prev, rf"select='gte(n\,{k0})',")[: len(c)]
cm, pm = c.mean(axis=(1, 2)), p.mean(axis=(1, 2))
cb, pb = (c < 20).mean(axis=(1, 2)) * 100, (p < 20).mean(axis=(1, 2)) * 100
bad = (cm > 230) | (cm / np.maximum(pm, 1) < 0.6) | (cb - pb > 25)
white = int((allf.mean(axis=(1, 2)) > 230).sum())
for i in np.where(bad)[0]:
    print(f"  story {k0 + i}: piece {cm[i]:.0f} prev {pm[i]:.0f} black {cb[i]:.0f}% vs {pb[i]:.0f}%")
print(f"{'BAD' if bad.any() or white else 'OK'}: {n} HQ frames, story {k0}-{k0 + len(c) - 1}, faults {int(bad.sum())}, "
      f"white HQ frames {white}, luma {cm.min():.0f}-{cm.max():.0f}")
sys.exit(1 if bad.any() or white else 0)
