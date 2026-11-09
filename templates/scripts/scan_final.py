r"""Per-frame luma (and a coarse 4x4 grid) of a 30 fps final vs preview1; prints the bad runs (white, lost textures, or
a camera re-keyed after the preview: look at every run). Usage: python scan_final.py <name>_nocaptions.mp4 preview1.mp4"""
import sys, subprocess, numpy as np
W,H=36,64
def lum(src):
    r=subprocess.run(["ffmpeg","-v","error","-i",src,"-vf",f"scale={W}:{H},format=gray","-f","rawvideo","-"],capture_output=True).stdout
    return np.frombuffer(r,np.uint8).reshape(-1,H,W).astype(float)
a, b = lum(sys.argv[1]), lum(sys.argv[2]); n=min(len(a),len(b)); a,b=a[:n],b[:n]
g = lambda x: x.reshape(n,4,H//4,4,W//4).mean(axis=(2,4)).reshape(n,16)
ga, gb = g(a), g(b)
d = np.abs(ga-gb).mean(axis=1); ma, mb = a.mean(axis=(1,2)), b.mean(axis=(1,2))
bad = (d > 25) | (ma > 245) | (np.abs(ma-mb) > 30)
print("frames", n, "bad", int(bad.sum()), "median grid diff", round(float(np.median(d)),1), "p99", round(float(np.percentile(d,99)),1))
runs=[]; i=0
while i<n:
    if bad[i]:
        j=i
        while j+1<n and bad[j+1]: j+=1
        runs.append((i,j)); i=j+1
    else: i+=1
for s,e in runs: print(f"  {s}-{e}: final {ma[s:e+1].mean():.0f} prev {mb[s:e+1].mean():.0f} griddiff {d[s:e+1].max():.0f}")
