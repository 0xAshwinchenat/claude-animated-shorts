# SFX building blocks shared by the cartoon shorts (from skara_audio.py, Gobekli/Skara sounds).
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, reson, colored, smooth_noise, ramp, fades, modal, pan, st, place,
                 widen, make_ir, convolve_st, integrated, momentary, short_term, lra, true_peak, read_wav, write_wav)
import instruments as I

# ================================================================ SFX building blocks
def env_ad(n, a, d):
    e = np.ones(n); A = max(1, ns(a)); e[:A] = np.linspace(0, 1, A)
    t = np.arange(n) / SR; e *= np.exp(-np.maximum(0, t - a) / max(d, 1e-3)); return e

def mx(*xs):  # sum of mono sounds of different lengths
    n = max(len(x) for x in xs); y = np.zeros(n)
    for x in xs: y[:len(x)] += x
    return y

def place_m(buf, x, t):
    i = ns(t); a, b = max(0, i), min(len(buf), i + len(x))
    if b > a: buf[a:b] += x[a - i:b - i]

def thud(seed, low=55.0, dur=0.9, bright=0.3):
    r = rng(seed); t = tt(dur)
    body = modal(dur, [(low, 1.0, 0.25), (low * 1.9, 0.5, 0.12), (low * 3.1, 0.25, 0.06)], r)
    nz = lp(r.standard_normal(len(t)), 600 + 3000 * bright) * np.exp(-t / 0.05)
    return fades(body + 0.6 * nz, 0.001, 0.1)

def creak(dur, seed, f0=180.0, glide=0.3):
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    src = r.standard_normal(n) * (0.5 + 0.5 * smooth_noise(n, r, 18.0) ** 2)
    f = f0 * (1 + glide * (t / dur) + 0.06 * np.sin(TAU * 3.1 * t))
    y = np.zeros(n); hop = 512
    for s in range(0, n, hop):
        seg = src[s:s + hop * 2]
        y[s:s + len(seg)] += reson(seg, float(f[s]), 18)[:len(seg)] * np.hanning(len(seg))
    return fades(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6, 0.02, 0.1)

def wash(dur, seed, lo=200, hi=3000, peak=0.5):
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, -0.3), lo, hi, 2) * (0.6 + 0.4 * smooth_noise(n, r, 4.0))
    e = np.interp(t, [0, peak * dur, dur], [0, 1, 0]) ** 1.2
    return x * e

def lapping(dur, seed, rate=0.6):
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, -0.4), 250, 2200, 2)
    e = 0.25 + 0.75 * np.clip(np.sin(TAU * rate * t + r.uniform(0, 6)), 0, 1) ** 2 * (0.7 + 0.3 * smooth_noise(n, r, 0.5))
    return fades(x * e, 0.5, 0.5)

def murmur(dur, seed):
    r = rng(seed); n = ns(dur); x = np.zeros(n)
    for k in range(6):
        v = bp(r.standard_normal(n), 250, 1400, 2) * smooth_noise(n, r, 4.0 + k) ** 3
        x += reson(v, r.uniform(350, 900), 4)
    return fades(x, 0.4, 0.4)

def bird(seed):
    r = rng(seed); out = []
    for k in range(r.integers(3, 6)):
        d = r.uniform(0.05, 0.11); t = tt(d); f = r.uniform(2800, 4200) + 1200 * np.sin(np.pi * t / d)
        out += [np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * t / d) ** 2, np.zeros(ns(r.uniform(0.03, 0.08)))]
    return np.concatenate(out) * 0.4

def crickets(dur, seed):
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    y = np.sin(TAU * 4600 * t) * (np.sin(TAU * 32 * t) > 0.3) * (np.sin(TAU * 1.6 * t + r.uniform(0, 6)) > 0)
    return fades(bp(y, 3500, 6000) * 0.4, 0.05, 0.2)

def wind(dur, seed, k=1.0):
    r = rng(seed); n = ns(dur)
    return fades(bp(colored(n, r, -1.0), 150, 1800, 2) * (0.5 + 0.5 * smooth_noise(n, r, 0.4)) * k, 0.8, 0.8)

def squelch(seed, dur=0.45, f0=240.0):
    r = rng(seed); t = tt(dur)
    f = f0 * (1.6 - 0.9 * t / dur)
    tone = np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / (dur * 0.4))
    nz = bp(r.standard_normal(len(t)), 300, 2500) * np.exp(-t / 0.06)
    return fades(0.7 * tone + 0.8 * nz, 0.002, 0.05)

def bloop(seed, f0=500.0, dur=0.16):
    r = rng(seed); t = tt(dur); f = f0 * (1 + 1.5 * t / dur)
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / (dur * 0.3)), 0.002, 0.02)

def whoosh(seed, dur=0.6, lo=300, hi=3000):
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = colored(n, r, -0.5); y = np.zeros(n); hop = 1024
    for s in range(0, n, hop):
        u = s / n; seg = x[s:s + hop * 2]
        y[s:s + len(seg)] += bp(seg, lo + (hi - lo) * u, lo + (hi - lo) * u * 1.6 + 400, 1) * np.hanning(len(seg))
    return y * np.sin(np.pi * t / dur) ** 2

def splat(seed):
    r = rng(seed); t = tt(0.35)
    return fades(bp(r.standard_normal(len(t)), 200, 3000) * np.exp(-t / 0.05) + 0.8 * thud(seed, 90, 0.35, 0.2)[:len(t)], 0.001, 0.05)

def scratch(dur, seed):  # reed pen on papyrus
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    return hp(r.standard_normal(n), 2500) * (np.sin(TAU * 6.5 * t) > 0.1) * (0.5 + 0.5 * smooth_noise(n, r, 9)) * 0.3

def hum(dur, seed, f0=48):  # far traffic
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    y = sum(np.sin(TAU * f0 * k * t + r.uniform(0, 6)) / k for k in range(1, 9))
    return fades(lp(y, 600) * (0.8 + 0.2 * smooth_noise(n, r, 2)) * 0.3 + 0.2 * lp(colored(n, r, -1.0), 400), 0.5, 0.5)

def clack(seed, f0=1800):  # teeth / wood snapping shut
    r = rng(seed); t = tt(0.12)
    return fades(bp(r.standard_normal(len(t)), f0 * 0.6, f0 * 2.2) * np.exp(-t / 0.012) + 0.4 * np.sin(TAU * f0 * 0.5 * t) * np.exp(-t / 0.02), 0.0005, 0.02)

def pop(seed, f0=700):  # cork pop (jars appear)
    return mx(bloop(seed, f0, 0.12), 0.5 * clack(seed + 1, 2400))

def pour(dur, seed):  # water pouring from a jug
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, -0.2), 600, 4500, 2) * (0.7 + 0.3 * smooth_noise(n, r, 12))
    g = np.zeros(n)
    for k in range(int(dur * 9)): place_m(g, bloop(int(r.integers(1e6)), r.uniform(300, 800), 0.1) * r.uniform(0.3, 0.9), r.uniform(0, dur - 0.12))
    return fades(0.6 * x + g, 0.08, 0.2)

def squeak(seed, f0=900, dur=0.3, glide=0.6):  # metal hook squeak
    r = rng(seed); t = tt(dur); f = f0 * (1 + glide * t / dur) * (1 + 0.03 * np.sin(TAU * 31 * t))
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * t / dur) ** 1.5 * 0.5 + 0.2 * hp(r.standard_normal(len(t)), 3000) * np.sin(np.pi * t / dur), 0.005, 0.03)

def wail(dur, seed, f0=520):  # a mourner's wail, wordless (formant-ish glides)
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    f = f0 * (1 + 0.18 * np.sin(np.pi * t / dur) - 0.12 * t / dur) * (1 + 0.012 * np.sin(TAU * 5.5 * t))
    ph = np.cumsum(TAU * f / SR)
    src = sum(np.sin(k * ph) / k ** 1.2 for k in range(1, 12))
    y = reson(src, 750, 6) + 0.6 * reson(src, 1150, 6)
    return fades(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8 * 0.4, 0.05, 0.2)

def step(seed):  # sneaker on pavement
    r = rng(seed); t = tt(0.09)
    return fades(bp(r.standard_normal(len(t)), 400, 2600) * np.exp(-t / 0.018) * 0.5, 0.001, 0.02)

def heartbeat(seed):  # lub-dub
    a = thud(seed, 48, 0.25, 0.05); b = thud(seed + 1, 56, 0.22, 0.05) * 0.7
    x = np.zeros(ns(0.5)); place_m(x, a, 0); place_m(x, b, 0.17); return x

def slide_down(seed, dur=0.4, f0=1600, f1=500):  # falling slide whistle
    t = tt(dur); f = f0 * (f1 / f0) ** (t / dur)
    return fades(np.sin(np.cumsum(TAU * f / SR)) * 0.4 * (1 + 0.1 * np.sin(TAU * 7 * t)), 0.01, 0.04)

def sizzle(dur, seed):  # brazier fire crackle
    r = rng(seed); n = ns(dur); x = 0.15 * lp(colored(n, r, -1.0), 500)
    for k in range(int(dur * 22)): place_m(x, clack(int(r.integers(1e6)), r.uniform(1500, 4000)) * r.uniform(0.05, 0.25), r.uniform(0, dur - 0.13))
    return fades(x, 0.4, 0.4)

def rustle(seed, dur=0.35):  # papyrus unrolled
    r = rng(seed); t = tt(dur)
    return fades(hp(r.standard_normal(len(t)), 1800) * (0.4 + 0.6 * smooth_noise(len(t), r, 30)) * np.sin(np.pi * t / dur) * 0.6, 0.01, 0.05)


def tink(seed, f0=2600.0):  # flint / chisel on stone
    r = rng(seed); t = tt(0.16)
    return fades(bp(r.standard_normal(len(t)), f0 * 0.5, f0 * 1.8) * np.exp(-t / 0.012) + 0.5 * np.sin(TAU * f0 * t) * np.exp(-t / 0.03), 0.0005, 0.03)

def knock(seed, low=140.0):  # stone maul on stone
    return mx(thud(seed, low, 0.35, 0.5), 0.6 * tink(seed + 1, 1500))

def soil_scoop(seed):  # wooden shovel into soil, then a dull pour
    r = rng(seed); t = tt(0.42)
    sc = bp(r.standard_normal(len(t)), 500, 3500) * np.exp(-t / 0.09) * (t < 0.2)
    pr = lp(r.standard_normal(len(t)), 1800) * np.exp(-np.maximum(0, t - 0.15) / 0.12) * (t > 0.15)
    return fades(0.7 * sc + 0.9 * pr, 0.003, 0.05)

def rumble(dur, seed, f0=38):  # earth rumble
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    y = lp(colored(n, r, -1.2), 160) * (0.6 + 0.4 * smooth_noise(n, r, 3.0)) + 0.5 * np.sin(TAU * f0 * t) * (0.7 + 0.3 * smooth_noise(n, r, 2.0))
    return fades(y, 0.4, 0.5)

def growl_belly(seed, dur=0.7):  # stomach growl
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    f = 70 + 40 * np.sin(TAU * 3.0 * t) + 30 * t / dur
    y = np.sin(np.cumsum(TAU * f / SR)) + 0.6 * lp(r.standard_normal(n), 400)
    return fades(y * np.sin(np.pi * t / dur) ** 0.7 * 0.7, 0.05, 0.1)

def hiss(dur, seed):  # snake
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    return fades(hp(r.standard_normal(n), 4500) * np.sin(np.pi * t / dur) * (0.6 + 0.4 * smooth_noise(n, r, 14)) * 0.5, 0.02, 0.05)

def screech(seed, dur=0.7):  # vulture / hawk
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    f = 2200 + 1200 * np.sin(np.pi * t / dur) - 600 * t / dur
    y = np.sin(np.cumsum(TAU * f / SR)) + 0.4 * hp(r.standard_normal(n), 2500)
    return fades(y * np.sin(np.pi * t / dur) ** 1.4 * 0.5, 0.02, 0.06)

def yip(seed):  # fox
    r = rng(seed); out = []
    for k in range(2):
        d = 0.09; t = tt(d); f = 900 + 500 * np.sin(np.pi * t / d)
        out += [np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * t / d) ** 1.5, np.zeros(ns(0.07))]
    return np.concatenate(out) * 0.5

def crowd(dur, seed, k=1.0):  # a crowd roar: many murmurs + swell
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    y = np.zeros(n)
    for j in range(9):
        v = bp(r.standard_normal(n), 300, 2400, 2) * smooth_noise(n, r, 3.0 + j) ** 2
        y += reson(v, r.uniform(400, 1100), 3)
    return fades(y * k * (0.7 + 0.3 * np.sin(np.pi * t / dur)), 0.5, 0.6)

def cheer(dur, seed):
    return fades(crowd(dur, seed, 1.2) + 0.5 * wash(dur, seed + 1, 800, 5000, 0.4), 0.15, 0.5)

def rope_heave(dur, seed):  # creaking rope under strain with grunts
    r = rng(seed)
    return mx(creak(dur, seed, 220, 0.5), 0.6 * wash(dur, seed + 1, 150, 900, 0.5))

def crunch(seed):  # biting a berry
    r = rng(seed); t = tt(0.18)
    return fades(bp(r.standard_normal(len(t)), 700, 4500) * np.exp(-t / 0.03) * (0.6 + 0.4 * np.sin(TAU * 40 * t) ** 2), 0.001, 0.03)

def trickle(dur, seed):  # water from cupped hands
    r = rng(seed); n = ns(dur)
    x = bp(colored(n, r, -0.2), 900, 5000, 2) * (0.6 + 0.4 * smooth_noise(n, r, 16))
    return fades(x * 0.5, 0.05, 0.2)

def hooves(dur, seed, rate=7.0):
    r = rng(seed); n = ns(dur); x = np.zeros(n)
    for k in range(int(dur * rate)): place_m(x, thud(int(r.integers(1e6)), r.uniform(110, 170), 0.1, 0.5) * r.uniform(0.2, 0.7), k / rate + r.uniform(0, 0.05))
    return fades(x, 0.3, 0.3)

def chips(seed):  # a flurry of flying chips
    r = rng(seed); x = np.zeros(ns(0.5))
    for k in range(7): place_m(x, tink(int(r.integers(1e6)), r.uniform(2000, 4200)) * r.uniform(0.2, 0.6), r.uniform(0, 0.35))
    return x

def sparkle_up(seed, root=84):
    x = np.zeros(ns(1.2))
    for i, d in enumerate((0, 4, 7, 12)): place_m(x, I.glock(m2f(root + d), 0.4, rng(seed + i), 0.7), 0.06 * i)
    return x


# ================================================================ new sounds for Skara Brae
def surf(dur, seed, k=1.0, rate=0.11):  # waves breaking on a beach: slow swells of filtered noise
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, -0.6), 120, 5000, 2)
    sw = np.clip(np.sin(TAU * rate * t + r.uniform(0, 6)), 0, 1) ** 3 * (0.6 + 0.4 * smooth_noise(n, r, 0.3)) + 0.25
    return fades(x * sw * k, 0.6, 0.6)

def crash(seed, dur=1.6, low=60.0):  # a wave hitting the sea wall: boom + spray hiss
    r = rng(seed); t = tt(dur)
    boom = modal(dur, [(low, 1.0, 0.35), (low * 1.6, 0.5, 0.2)], r) * 0.8
    spray = hp(colored(len(t), r, -0.2), 1500) * np.exp(-t / 0.55) * np.clip(t / 0.05, 0, 1)
    return fades(boom + 1.3 * spray, 0.002, 0.3)

def rain(dur, seed, k=1.0):  # steady rain hiss with patter
    r = rng(seed); n = ns(dur)
    hiss_ = hp(colored(n, r, -0.1), 2500) * 0.6
    pat = np.zeros(n); idx = r.integers(0, n, int(dur * 60))
    pat[idx] = r.uniform(-1, 1, len(idx)); pat = bp(pat, 1500, 6000, 2) * 2.0
    return fades((hiss_ + pat) * k, 0.4, 0.4)

def gust(dur, seed, k=1.0):  # storm wind howl: band-passed noise with a moving resonance
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    src = colored(n, r, -0.4)
    f = 300 + 500 * smooth_noise(n, r, 0.6) ** 2
    y = np.zeros(n); hop = 1024
    for s in range(0, n, hop):
        seg = src[s:s + hop * 2]
        y[s:s + len(seg)] += reson(seg, float(f[s]), 6)[:len(seg)] * np.hanning(len(seg))
    return fades(y * (0.5 + 0.5 * smooth_noise(n, r, 0.4)) * k, 0.5, 0.5)

def rip(seed, dur=0.5):  # turf tearing: crackling noise burst
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    cr = np.zeros(n); idx = r.integers(0, n, 140); cr[idx] = r.uniform(-1, 1, len(idx))
    x = bp(cr, 600, 5000, 2) * 3 + bp(r.standard_normal(n), 300, 2500, 2) * 0.5
    return fades(x * np.exp(-t / (dur * 0.6)), 0.003, 0.08)

def gull(seed):  # herring-gull cries: falling glides with a nasal formant
    r = rng(seed); out = []
    for k in range(r.integers(2, 4)):
        d = r.uniform(0.18, 0.32); t = tt(d); f = r.uniform(1300, 1600) * (1 - 0.35 * t / d)
        x = np.sign(np.sin(np.cumsum(TAU * f / SR))) * np.sin(np.pi * t / d) ** 1.5
        out += [reson(x, 2400, 6) * 0.25 + bp(x, 900, 3000, 2) * 0.2, np.zeros(ns(r.uniform(0.05, 0.12)))]
    return np.concatenate(out)

def baa(seed, f0=330.0, dur=0.7):  # a sheep: buzzy vibrato bleat
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + 0.04 * np.sin(TAU * 6.5 * t)) * (1 - 0.12 * t / dur)
    x = np.sign(np.sin(np.cumsum(TAU * f / SR))) * (0.6 + 0.4 * np.sin(TAU * 31 * t))
    y = reson(x, 900, 4) + reson(x, 2300, 5) * 0.5
    return fades(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7, 0.02, 0.1)

def moo(seed, f0=120.0, dur=1.1):  # a cow
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + 0.25 * np.sin(np.pi * t / dur)) * (1 + 0.01 * np.sin(TAU * 4 * t))
    x = np.sign(np.sin(np.cumsum(TAU * f / SR)))
    y = reson(x, 500, 4) + reson(x, 1100, 5) * 0.4
    return fades(lp(y, 2500) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.5, 0.05, 0.15)

def buzz(dur, seed):  # a fly buzzing about
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    f = 190 * (1 + 0.15 * smooth_noise(n, r, 3.0))
    x = np.sign(np.sin(np.cumsum(TAU * f / SR)))
    return fades(bp(x, 300, 3000, 2) * (0.5 + 0.5 * smooth_noise(n, r, 2.0)), 0.05, 0.1)

def clink(seed, f0=1900.0):  # clay pot on stone
    r = rng(seed); return modal(0.25, [(f0, 1.0, 0.04), (f0 * 1.6, 0.5, 0.025), (f0 * 0.55, 0.6, 0.06)], r)

def boing(seed, f0=220.0, dur=0.45):  # bed bounce
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.08)) * (1 + 0.08 * np.sin(TAU * 14 * t) * np.exp(-t / 0.2))
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / 0.18), 0.002, 0.05)

def scrape(dur, seed, f0=240.0):  # stone slab sliding on stone
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, -0.3), 150, 2500, 2) * (0.6 + 0.4 * smooth_noise(n, r, 25.0))
    return fades(x + 0.4 * creak(dur, seed + 1, f0, 0.1), 0.03, 0.06)

def slide_up(seed, dur=1.0, f0=400, f1=1500):  # rising slide whistle (the needle swings)
    r = rng(seed); t = tt(dur); f = f0 * (f1 / f0) ** (t / dur)
    return fades(np.sin(np.cumsum(TAU * f / SR)) * (0.8 + 0.2 * np.sin(TAU * 6 * t)), 0.02, 0.06)

def beep(seed, f0=1200.0, dur=0.12):
    t = tt(dur); return fades(np.sign(np.sin(TAU * f0 * t)) * 0.5, 0.004, 0.02)

def puff(seed):  # pipe puff
    r = rng(seed); n = ns(0.35); t = np.arange(n) / SR
    return bp(r.standard_normal(n), 400, 2500, 2) * np.sin(np.pi * t / 0.35) ** 2

def crumble(dur, seed):  # rotten wood collapsing into dust
    r = rng(seed); n = ns(dur); t = np.arange(n) / SR
    cr = np.zeros(n); idx = r.integers(0, n, int(90 * dur)); cr[idx] = r.uniform(-1, 1, len(idx))
    return fades(bp(cr, 300, 3500, 2) * 2.5 * (t / dur) ** 0.5 + 0.3 * wash(dur, seed + 2, 200, 1500, 0.8), 0.05, 0.2)

def page_flip(seed):  # a stone "page" lifting: air whoosh + soft stony tok
    return mx(whoosh(seed, 0.35, 600, 4000) * 0.7, np.concatenate([np.zeros(ns(0.3)), knock(seed + 1, 260) * 0.6]))

