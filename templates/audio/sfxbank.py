r"""sfxbank: the recorded SFX library (D:\youtube\sfx_lib, made by sfx_lib/build_lib.py with ElevenLabs sound generation)
for the numpy audio pipeline (dsp.py). Every sound comes back at 48 kHz float, normalized by LOUDNESS, so an event's level
is simply "LU re the voice":

    import sfxbank as B
    x = B.get("pig_squeal", seed=7)                  # a random variant of the group, +-0.5 st / +-1.5 dB humanized,
                                                     # mono, momentary-max loudness = 0 LUFS
    place(buf, B.stereo(x * dbg(v_lufs - 12), pan=0.1), t)     # 12 LU under the voice, near-centre
    bed = B.loop("amb_town", 9.5, seed=3)            # a loop tiled to 9.5 s with crossfades, integrated = 0 LUFS
    t_peak = B.peak_time(x)                          # align a whoosh's PEAK (not its start) on a camera move

Names: a single sound ("gate_creak") or a GROUP (a multi-take sliced into "steps_dirt_1".."_6": get("steps_dirt") picks
one by seed). B.names() lists them, B.has(name) tests. A name missing from the library raises KeyError, unless a
stand-in was registered with B.register(name, fn(seed) -> mono array): then the stand-in plays and B.report() lists it,
so a mix built before the library exists says so (pigs_audio_v4 writes *_standin files in that case).
Cache: decoded files are kept in memory and as .npy in sfx_lib/_cache (keyed by file mtime).
"""
import json, os, subprocess
from fractions import Fraction
import numpy as np
from scipy import signal
from dsp import SR, ns, dbg, rng, st, fades, widen, momentary_max, integrated, read_wav

LIB = os.environ.get("SFX_LIB", r"D:\youtube\sfx_lib")
CACHE = os.path.join(LIB, "_cache")
_ix, _groups, _mem = None, None, {}
FALLBACK, USED, MISSING = {}, {}, set()

def _index():
    global _ix, _groups
    if _ix is None:
        p = os.path.join(LIB, "index.json")
        snd = json.load(open(p, encoding="utf-8"))["sounds"] if os.path.exists(p) else []
        _ix = {s["name"]: s for s in snd if os.path.exists(os.path.join(LIB, s["file"]))}
        _groups = {}
        for s in _ix.values(): _groups.setdefault(s.get("group") or s["name"], []).append(s["name"])
        for g in _groups.values(): g.sort()
    return _ix, _groups

def reload():
    global _ix
    _ix = None; _index()

def names():
    ix, gr = _index(); return sorted(set(ix) | set(gr))

def has(name):
    ix, gr = _index(); return name in ix or name in gr

def variants(name):
    ix, gr = _index()
    return gr[name] if name in gr else ([name] if name in ix else [])

def info(name):
    ix, _ = _index(); return ix.get(variants(name)[0]) if variants(name) else None

def _decode(path):
    if path.lower().endswith(".wav"):
        x, sr = read_wav(path)
        if sr != SR:
            g = np.gcd(SR, sr); x = signal.resample_poly(x, SR // g, sr // g, axis=-1)
        return st(x)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(SR), "pipe:1"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)

def load(sound):
    """one library file -> (2, n) float64 at 48 kHz, as stored (no normalization)"""
    if sound in _mem: return _mem[sound]
    ix, _ = _index(); f = os.path.join(LIB, ix[sound]["file"])
    os.makedirs(CACHE, exist_ok=True)
    c = os.path.join(CACHE, f"{sound}_{int(os.path.getmtime(f))}.npy")
    if os.path.exists(c): x = np.load(c)
    else:
        x = _decode(f); np.save(c, x.astype(np.float32))
    _mem[sound] = np.asarray(x, np.float64); return _mem[sound]

def register(name, fn):
    """a synthesized stand-in for a library name: fn(seed) -> mono (n,) or stereo (2, n) array at SR"""
    FALLBACK[name] = fn

def varispeed(x, p):
    """pitch AND speed by p (tape-style, the natural way to vary a recorded SFX)"""
    if abs(p - 1) < 1e-4: return x
    fr = Fraction(1 / p).limit_denominator(96)
    return signal.resample_poly(x, fr.numerator, fr.denominator, axis=-1)

def fit(x, dur, fade=0.08):
    """cut (with a fade-out) or zero-pad x to dur seconds"""
    n = ns(dur); x = np.atleast_2d(x)
    if x.shape[1] >= n: return fades(x[:, :n], 0.0, min(fade, dur / 3))
    return np.pad(x, ((0, 0), (0, n - x.shape[1])))

def _norm(x, mode):
    if mode == "lufs": L = momentary_max(x)      # events: the loudest 400 ms = 0 LUFS
    elif mode == "int": L = integrated(x)        # beds / loops: integrated = 0 LUFS
    elif mode == "peak": return x / (np.abs(x).max() + 1e-12)
    else: return x
    return x * dbg(-L) if np.isfinite(L) else x

def get(name, gain_db=0.0, pitch=1.0, seed=0, vary=True, norm="lufs", mono=True, reverse=False, length=None, variant=None):
    """a library sound (or its registered stand-in), humanized and loudness-normalized.
    vary: random +-0.5 semitone (varispeed) and +-1.5 dB per seed, so repeats never sound identical.
    norm: 'lufs' (momentary max = 0 LUFS, for events), 'int' (integrated = 0 LUFS, for beds), 'peak', None.
    Returns (n,) if mono else (2, n)."""
    r = rng(seed); vs = variants(name)
    if vs:
        x = load(vs[variant % len(vs)] if variant is not None else vs[int(r.integers(len(vs)))]); src = "lib"
    elif name in FALLBACK:
        x = st(np.asarray(FALLBACK[name](seed), float)); src = "standin"; MISSING.add(name)
    else:
        raise KeyError(f"sfxbank: '{name}' is not in {LIB}\\index.json and has no registered stand-in")
    USED.setdefault(name, {"src": src, "n": 0})["n"] += 1
    x = x.mean(0, keepdims=True) if mono else x
    p = pitch * (2 ** (r.uniform(-0.5, 0.5) / 12) if vary else 1.0)
    g = gain_db + (r.uniform(-1.5, 1.5) if vary else 0.0)
    x = varispeed(x, p)
    if reverse: x = fades(x[:, ::-1], 0.01, 0.005)
    x = _norm(x, norm)
    if length: x = fit(x, length)
    x = x * dbg(g)
    return x[0] if mono else x

def loop(name, dur, seed=0, xfade=0.35, mono=False, pitch=1.0, norm="int", fade_in=0.4, fade_out=0.5):
    """a bed of dur seconds: the (loopable) sound from a random start, tiled with equal-power crossfades"""
    x = get(name, pitch=pitch, seed=seed, vary=False, norm=None, mono=False)
    r = rng(seed + 991); n, L, X = ns(dur), x.shape[1], ns(xfade)
    X = min(X, L // 3)
    x = np.roll(x, -int(r.integers(L)), axis=1) if L > 4 * X else x
    out = np.zeros((2, n + L)); w = np.sin(np.linspace(0, np.pi / 2, X)) if X > 0 else np.zeros(0)
    pos = 0
    while pos < n:
        seg = x.copy()
        if X > 0:
            if pos > 0: seg[:, :X] *= w
            seg[:, -X:] *= w[::-1]
        out[:, pos: pos + L] += seg[:, : out.shape[1] - pos]
        pos += L - X
    y = _norm(fades(out[:, :n], fade_in, fade_out), norm)
    return y.mean(0) if mono else y

def env(x, win=0.03):
    """RMS envelope (hop = win) of a mono / stereo sound"""
    m = np.atleast_2d(x).mean(0); w = max(1, ns(win)); k = len(m) // w
    return np.sqrt((m[: k * w].reshape(k, w) ** 2).mean(1) + 1e-20), w

def peak_time(x, win=0.03):
    """seconds from the start of x to its loudest moment (align whooshes / risers by their peak)"""
    e, w = env(x, win); return (int(np.argmax(e)) + 0.5) * w / SR

def onset_time(x, floor_db=-30.0):
    """seconds from the start to the first moment within floor_db of the peak"""
    e, w = env(x, 0.005); on = np.flatnonzero(20 * np.log10(e / e.max()) > floor_db)
    return on[0] * w / SR if len(on) else 0.0

def stereo(x, pan=0.0, width=0.0, seed=0):
    """mono -> (2, n): constant-power pan (keep |pan| <= 0.3 for the near-mono mix) + optional small decorrelation"""
    x = np.asarray(x, float)
    if x.ndim == 2: return x
    th = (float(np.clip(pan, -1, 1)) + 1) * np.pi / 4
    y = np.stack([x * np.cos(th), x * np.sin(th)]) * np.sqrt(2)
    return y if width <= 0 else 0.5 * (y + widen(x, rng(seed), 11.0, width) * np.array([[np.cos(th)], [np.sin(th)]]) * np.sqrt(2))

def report():
    """{'lib': [...], 'standin': [...]} of the names used so far"""
    out = {"lib": [], "standin": []}
    for k, v in sorted(USED.items()): out[v["src"]].append(f"{k} x{v['n']}")
    return out
