r"""Check a piece of the RE-TIMED preview (film frames a..) against preview1 (old timing) through the voice warp.
usage: python check_preview.py <piece.mp4> <first film frame> <preview1.mp4> <warp.json> <expected frames>
Film frame g is compared with preview1 frame round(warp(g)). Flags: white (mean luma > 230), lost textures (luma ratio
< 0.6, or > 25 points more near-black pixels than preview1). Exit 1 on any fault."""
import sys, json, subprocess, numpy as np
piece, a, prev, warp, want = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], int(sys.argv[5])
W, H = 36, 64
def gray(src):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:{H},format=gray", "-fps_mode", "passthrough",
                        "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, H, W).astype(float)
c = gray(piece)
if len(c) != want: print(f"BAD frame count {len(c)} != {want}"); sys.exit(1)
T = np.array(json.load(open(warp))["table"])
p_all = gray(prev)
idx = np.clip(np.round(T[a:a + len(c)]).astype(int), 0, len(p_all) - 1)
p = p_all[idx]
cm, pm = c.mean(axis=(1, 2)), p.mean(axis=(1, 2))
cb, pb = (c < 20).mean(axis=(1, 2)) * 100, (p < 20).mean(axis=(1, 2)) * 100
bad = (cm > 230) | (cm / np.maximum(pm, 1) < 0.6) | (cb - pb > 25)
for i in np.where(bad)[0][:20]:
    print(f"  film {a + i} (old {idx[i]}): piece {cm[i]:.0f} prev {pm[i]:.0f} black {cb[i]:.0f}% vs {pb[i]:.0f}%")
print(f"{'BAD' if bad.any() else 'OK'}: film {a}-{a + len(c) - 1}, faults {int(bad.sum())}, luma {cm.min():.0f}-{cm.max():.0f}")
sys.exit(1 if bad.any() else 0)
