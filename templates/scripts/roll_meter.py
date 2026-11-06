# Camera-roll meter for any vertical video (reference shorts or our renders): per-frame roll from the tilt of near-vertical
# edges (walls, posts, door frames, legs), model tilt(x) = roll + k*x (k = the pitch convergence, ridge-limited),
# robust weighted least squares; plus the per-frame image shift (phase correlation).
# usage: python -I roll_meter.py video.mp4 out.json        (prints a summary over TRUSTED frames)
# Validated 2026-11-06 on the toon3d lab rendered with a known +-9 deg roll wave: corr 0.96, reads 75 % of the true roll
# (K below corrects it), median error ~0.8 deg on trusted frames; a level render reads p90 0.8 deg (the noise floor).
# TRUSTED = >= 1500 supporting edge pixels, edge spread >= 0.17 frame widths, |k| <= 8. Untrusted (and misleading even
# when "trusted"): top-down/aerial shots (no "up"), rails/roads running to the horizon, steep low-angle wide shots
# (3-point perspective), and rocking objects (a ship's masts tilt while the camera stays level). Check big readings by eye:
# a character standing upright in frame means the camera is level.
# Sign: roll > 0 = world verticals lean clockwise in the image (top to the right) = camera rotateZ(+).
import sys, subprocess, json, numpy as np
path, out = sys.argv[1], sys.argv[2]
W, H = 360, 640
p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-pix_fmt", "gray", "-f", "rawvideo", "-"], capture_output=True)
fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W)
n = len(fr)
ys, xs = np.mgrid[0:H, 0:W]
mask = np.ones((H, W), bool)
mask[int(0.57 * H):int(0.79 * H)] = False           # caption band
mask[:, :8] = mask[:, -8:] = False; mask[:8] = mask[-8:] = False
xc = (xs - W / 2) / W
rolls, ks, conf, dxs, dys, spreads = [], [], [], [], [], []
prevF = None
win = np.outer(np.hanning(H // 2), np.hanning(W // 2))
for i in range(n):
    g = fr[i].astype(np.float32)
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[1:-1, 1:-1] = (g[1:-1, 2:] - g[1:-1, :-2]) * 2 + (g[:-2, 2:] - g[:-2, :-2]) + (g[2:, 2:] - g[2:, :-2])
    gy[1:-1, 1:-1] = (g[2:, 1:-1] - g[:-2, 1:-1]) * 2 + (g[2:, :-2] - g[:-2, :-2]) + (g[2:, 2:] - g[:-2, 2:])
    m = np.hypot(gx, gy)
    thr = np.percentile(m[mask], 90)
    sel = mask & (m > max(thr, 40)) & (np.abs(gy) < np.tan(np.radians(25)) * np.abs(gx))
    t = np.degrees(np.arctan(gy[sel] / gx[sel])); x = xc[sel]; w = m[sel]
    r, k, c, spread = np.nan, np.nan, 0, 0.0
    if len(t) > 400:
        A = np.stack([np.ones_like(x), x], 1)
        keep = np.ones(len(t), bool)
        for it in range(4):
            Wt = w * keep
            # ridge on k: pitch convergence is small (|k| <~ 10 deg per frame width); stops k soaking up the roll when the
            # edges sit on one side of the frame
            sw = Wt.sum(); M = (A * Wt[:, None]).T @ A + np.diag([0.0, 0.08 * sw]); v = (A * Wt[:, None]).T @ t
            sol = np.linalg.solve(M, v)
            res = t - A @ sol
            keep = np.abs(res) < (6 if it < 2 else 3)
        r, k = sol; c = int(keep.sum())
        ww = w * keep; mu = (ww * x).sum() / ww.sum(); spread = float(np.sqrt((ww * (x - mu) ** 2).sum() / ww.sum()))
    rolls.append(float(r)); ks.append(float(k)); conf.append(c); spreads.append(spread)
    # image shift (phase correlation at half size)
    F = np.fft.fft2(g[::2, ::2] * win)
    if prevF is not None:
        R = F * np.conj(prevF); R /= np.abs(R) + 1e-6
        cc = np.abs(np.fft.ifft2(R)); yy, xx = np.unravel_index(np.argmax(cc), cc.shape)
        if yy > H // 4: yy -= H // 2
        if xx > W // 4: xx -= W // 2
        dxs.append(float(xx * 2)); dys.append(float(yy * 2))
    else: dxs.append(0.0); dys.append(0.0)
    prevF = F
json.dump({"roll": rolls, "k": ks, "n": conf, "dx": dxs, "dy": dys, "spread": spreads}, open(out, "w"))
r = np.array(rolls); ok = ~np.isnan(r)
print(path.split("/")[-1], "frames", n, "valid", ok.sum(), "median|roll|", round(float(np.median(np.abs(r[ok]))), 2), "p90", round(float(np.percentile(np.abs(r[ok]), 90)), 2), "max", round(float(np.nanmax(np.abs(r))), 1))

K = 1 / 0.75
r = np.array(rolls) * K; kk = np.array(ks); nn = np.array(conf); spd = np.array(spreads)
trust = (nn >= 1500) & (spd >= 0.17) & (np.abs(kk) <= 8) & ~np.isnan(r)
a = np.abs(r[trust])
if len(a):
    print(f"trusted {trust.mean():.0%} of frames | |roll| median {np.median(a):.2f} p90 {np.percentile(a, 90):.2f} max {a.max():.1f} deg | <=1 deg {np.mean(a <= 1):.0%} <=3 deg {np.mean(a <= 3):.0%}")
