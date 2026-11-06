"""Prepare the user's ElevenLabs read (Jesse) for the Kaifeng short.
  python prep_voice.py [tempo]
1. Cut the stage note it read by mistake ("The camera rises to show 400 catapults firing.", 20.62-26.35 s).
2. Shorten every pause: sentence pauses (>= 0.40 s) to PAUSE_S, shorter ones to at most PAUSE_M (5 ms fades at cuts).
3. Time-stretch with ffmpeg rubberband (pitch kept) by `tempo`, resample to 48 kHz -> data/narration.wav.
Writes data/edit_map.json (source-time -> output-time knots) so word times can be mapped without re-transcribing.
"""
import json, subprocess, sys, re
import numpy as np

SR = 48000
SRC = "data/narration_src.wav"
CUTS = [(20.62, 26.35)]          # stage direction read aloud by mistake
PAUSE_S, PAUSE_M = 0.36, 0.24    # kept pause lengths before the tempo change
tempo = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0

x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                                 capture_output=True, check=True).stdout, np.float32).copy()
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", SRC, "-af", "silencedetect=noise=-38dB:d=0.12", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
sil = list(zip(st, en))

# removal intervals in source seconds
rm = list(CUTS)
for a, b in sil:
    if any(c0 - 0.05 <= a and b <= c1 + 0.6 for c0, c1 in CUTS): continue   # inside / at the edge of a cut
    d = b - a
    keep = PAUSE_S if d >= 0.40 else min(d, PAUSE_M)
    if d - keep > 0.01:
        m = (a + b) / 2
        rm.append((m - (d - keep) / 2, m + (d - keep) / 2))
# a cut joins two speech edges: leave PAUSE_S of the surrounding silence across the join
rm.sort()

fade = int(0.005 * SR)
out, knots, t_out, pos = [], [], 0.0, 0.0
for a, b in rm + [(len(x) / SR, len(x) / SR)]:
    seg = x[int(pos * SR):int(a * SR)].copy()
    if len(seg) > 2 * fade:
        seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
    knots.append([pos, t_out]); out.append(seg); t_out += len(seg) / SR
    knots.append([a, t_out]); pos = b
y = np.concatenate(out)
# the CUTS join: make sure a full sentence pause separates the two sides
y.astype(np.float32).tofile("data/_edit.f32")
print(f"source {len(x)/SR:.2f} s -> edited {len(y)/SR:.2f} s ({len(rm)} removals)")
af = f"rubberband=tempo={tempo}:pitchq=quality:transients=smooth:formant=preserved" if tempo != 1 else "anull"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "data/_edit.f32",
                "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", "data/narration.wav"], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            "data/narration.wav"], capture_output=True, text=True).stdout)
json.dump({"tempo": tempo, "knots": [[s, t / tempo] for s, t in knots], "duration": dur},
          open("data/edit_map.json", "w"), indent=0)
print(f"tempo {tempo} -> narration.wav {dur:.2f} s")
