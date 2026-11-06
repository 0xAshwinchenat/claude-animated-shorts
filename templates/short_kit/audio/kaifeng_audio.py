# Soundtrack of "The Dirt Wall Genghis Khan's Best General Couldn't Break" (Kaifeng 1232): synthesized SFX on the
# picture's events (frames mirrored from src/videos/kaifeng/story.ts), an original score (G major pentatonic with a
# minor turn: war drums, plucked zither, a dizi-like flute theme, gong, comic tuba), ducked under the voice, and the mix.
# Mix standard (cartoon-3d-short skill): music +3 dB = bed 10 LU under the voice, SFX -6 dB, voice gain only.
# Master -15 LUFS integrated, <= -1.2 dBTP, 48 kHz stereo 24-bit, exact picture length (TOTAL frames).
# Lock the picture's time constants before changing anything here; re-run after any timing change.
import json, os, time
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, reson, colored, smooth_noise, ramp, fades, modal, pan, st, place,
                 widen, make_ir, convolve_st, integrated, momentary, short_term, lra, true_peak, read_wav, write_wav)
import instruments as I
from sfxlib import *  # noqa: F401,F403  (thud, creak, whoosh, rope_heave, crumble, splat, rustle, chips, ...)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FPS, TOTAL = 30, 2070
DUR = TOTAL / FPS
N = ns(DUR)
TARGET_LUFS, CEIL_DBTP, DUCK_DB = -15.0, -1.2, -3.0
MUSIC_BED_LU = -10.0       # music level under the voice ("+3 dB music")
SFX_TRIM_DB = -6.0         # "SFX -6 dB"
m2f = I.m2f
F = lambda f: f / FPS      # story frame -> seconds
log = lambda *a: print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)

# ---- picture events (story.ts) ----
HERO_FIRES = [24, 96]
PROJ_HITS = [(72, 0.2, "first boulder hits the wall"), (148, 0.0, "the ridden boulder hits"), (166, -0.3, "impact"), (181, 0.4, "impact"),
             (194, -0.4, "impact"), (207, 0.5, "impact"), (272, 0.1, "never broke: thud")]
VOLLEY1 = (392, 414); VOLLEY2 = (438, 460)
F_SMASH, MILL_F0, MILL_F1 = 560, 596, 646
DENT_F, SMASH_TOWER = 716, 782
DUNG = [834, 839, 844]; STRAW = 850; FELT = [868, 876]
DEF_LOAD, DEF_FIRE, GARDEN_LAND = 935, 962, 998
TENT0, TENT1, CHAIN0, CHAIN1, BOOM_F = 985, 1110, 1062, 1124, 1131
F_PLATE, F_MACRO, F_PUNCH = 1556, 1700, 1790
CUT0, CUT1, GATE0, GATE1 = 1858, 1884, 1962, 1982

# ================================================================ new sounds for Kaifeng
def earth_thud(seed, low=52.0, k=1.0):  # a boulder into rammed earth: a deep dull thump + a crumbly dirt patter, no crack
    r = rng(seed)
    body = thud(seed, low, 0.8, 0.18)
    dirt = crumble(0.7, seed + 1) * 0.35
    y = np.zeros(max(len(body), len(dirt) + ns(0.03)))
    y[:len(body)] += body; y[ns(0.03):ns(0.03) + len(dirt)] += dirt
    return y * k

def gong(seed, f0=110.0, dur=3.2, vel=0.8):  # a bronze gong: inharmonic modes + a slow bloom
    r = rng(seed); t = tt(dur)
    y = modal(dur, [(f0, 1.0, 1.6), (f0 * 1.52, 0.6, 1.1), (f0 * 2.03, 0.45, 0.9), (f0 * 2.74, 0.3, 0.7), (f0 * 3.61, 0.2, 0.5), (f0 * 4.9, 0.12, 0.35)], r)
    bloom = 0.35 + 0.65 * (1 - np.exp(-t / 0.18))
    return fades(y * bloom * vel, 0.002, 0.3)

def boom(seed, dur=2.6):  # the bomb: a sharp crack, a huge low body, a rumbling tail, debris patter
    r = rng(seed); t = tt(dur)
    crack = hp(r.standard_normal(len(t)), 800) * np.exp(-t / 0.025)
    body = lp(r.standard_normal(len(t)), 180) * np.exp(-t / 0.35) * 4.0
    sub = np.sin(TAU * (38 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.6) * 1.6
    tail = rumble(dur, seed + 1, 34) * 0.6
    y = crack * 0.8 + body + sub + tail[:len(t)]
    return fades(y, 0.0005, 0.4)

def patter(dur, seed, rate=14.0):  # debris / dirt raining down
    r = rng(seed); y = np.zeros(ns(dur)); n = int(dur * rate)
    for k in range(n):
        x = tink(seed * 7 + k, r.uniform(700, 2200)) * r.uniform(0.15, 0.45)
        place_m(y, x, r.uniform(0, dur * 0.85))
    return y

def place_m(buf, x, t):
    i = ns(t); x = x[: max(0, len(buf) - i)]; buf[i:i + len(x)] += x; return buf

def chain(dur, seed, rate=9.0):  # an iron chain paying out over a wooden boom: clinks + a creak bed
    r = rng(seed); y = np.zeros(ns(dur))
    for k in range(int(dur * rate)): place_m(y, clink(seed * 3 + k, r.uniform(1500, 2600)) * r.uniform(0.3, 0.7), k / rate + r.uniform(0, 0.03))
    c = creak(dur, seed + 99, 140, 0.1) * 0.25
    return y + c[:len(y)]

def fizz(dur, seed):  # a burning fuse
    r = rng(seed); t = tt(dur)
    n = bp(r.standard_normal(len(t)), 2500, 7000) * (0.55 + 0.45 * smooth_noise(len(t), r, 18))
    return fades(n * 0.5, 0.02, 0.05)

def splinter(seed, dur=1.1):  # a wooden tower smashed: crack + creak + falling planks
    r = rng(seed)
    y = np.zeros(ns(dur))
    place_m(y, knock(seed, 220) * 1.0, 0.0)
    place_m(y, chips(seed + 1) * 0.8, 0.0)
    place_m(y, creak(0.5, seed + 2, 260, -0.4) * 0.6, 0.05)
    for k in range(5): place_m(y, knock(seed + 10 + k, 160 + 40 * k) * 0.45, 0.25 + 0.13 * k + r.uniform(0, 0.04))
    return y

def shatter(seed, dur=0.9):  # porcelain plate: crack zips across, then the pieces clatter
    r = rng(seed); y = np.zeros(ns(dur))
    t = tt(0.18); zip_ = hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.06) * (1 + np.sin(TAU * 60 * t))
    place_m(y, zip_ * 0.6, 0.0)
    for k in range(7): place_m(y, tink(seed + k, r.uniform(2800, 5200)) * r.uniform(0.4, 0.9), 0.2 + 0.07 * k + r.uniform(0, 0.03))
    return y

def whump(seed, f0=90.0):  # a fist into a pillow / felt thrown over a frame
    r = rng(seed); t = tt(0.35)
    y = lp(r.standard_normal(len(t)), 400) * np.exp(-t / 0.07) + 0.6 * np.sin(TAU * f0 * t) * np.exp(-t / 0.08)
    return fades(y, 0.004, 0.05)

def grains(dur, seed):  # grains crunching and settling
    r = rng(seed); y = np.zeros(ns(dur))
    for k in range(int(dur * 40)): place_m(y, crunch(seed * 5 + k) * r.uniform(0.1, 0.35), r.uniform(0, dur * 0.9))
    return y

def horn(seed, f0=110.0, dur=1.6):  # a long brassy war horn
    return I.brass(f0, dur, 0.75, rng(seed), "soft", rel=0.3)

# ================================================================ SFX events (time s, sound, level dB re voice peak, pan, name)
def events():
    E = []
    add = lambda t, x, db, p=0.0, name="": E.append((t, x, db, p, name))
    # ---- 1-2: the camp, Subutai's trebuchet, boulders on the wall ----
    add(0.0, crowd(10.0, 1, 0.5), -31, 0.2, "siege camp murmur")
    add(0.0, wind(10.0, 2, 0.5), -31, 0, "plain wind")
    for k, r in enumerate(HERO_FIRES):
        add(F(r - 14), rope_heave(0.6, 10 + k), -21, -0.2, "rope crew heaves")
        add(F(r - 3), creak(0.45, 12 + k, 220, 0.5), -20, -0.1, "beam swings")
        add(F(r), whoosh(14 + k, 0.55, 250, 2600), -19, 0.0, "sling release")
        add(F(r + 2), knock(16 + k, 120) * 0.7, -22, -0.1, "beam hits its stop")
    add(F(98), whoosh(18, 1.6, 200, 1800), -24, 0, "riding the boulder")
    for k, (f, p, nm) in enumerate(PROJ_HITS): add(F(f), earth_thud(20 + k, 50 + 3 * k), -14 if f in (148, 272) else -19, p, nm)
    for k, t in enumerate([4.2, 4.7, 5.5, 6.1, 6.6]): add(t, whoosh(30 + k, 0.5, 300, 2400), -27, (k % 3 - 1) * 0.5, "boulders overhead")
    add(F(276), crumble(0.5, 36), -24, 0.1, "dirt trickles from the dent")
    # ---- 3-4: SET PIECE: the army, the four batteries, the volley ----
    add(F(303), crowd(5.5, 40, 1.0), -21, 0, "the army roars")
    add(F(303), hooves(5.0, 41, 8.0), -25, 0.2, "horses")
    add(F(330), horn(42, 98.0, 1.8), -20, -0.2, "war horn")
    for k in range(18): add(F(VOLLEY1[0]) + k * 0.04 + rng(43 + k).uniform(0, 0.4), creak(0.35, 50 + k, 200 + 9 * k, 0.4), -27, rng(70 + k).uniform(-0.8, 0.8), "battery creaks")
    for k in range(36): add(F(VOLLEY2[0]) + k * 0.018, mx(creak(0.3, 90 + k, 180 + 6 * k, 0.5), 0.6 * whoosh(130 + k, 0.4, 300, 2600)), -26, rng(170 + k).uniform(-0.9, 0.9), "THE VOLLEY")
    add(F(VOLLEY2[0]) + 0.1, whoosh(210, 2.0, 120, 1500), -16, 0, "a sky full of rocks")
    for k in range(40): add(F(492) + k * 0.035 + rng(220 + k).uniform(0, 0.2), earth_thud(260 + k, 40 + (k % 7) * 4, 0.7), -27, rng(300 + k).uniform(-0.9, 0.9), "hundreds of impacts")
    # ---- 5: night at the NE battery, millstones ----
    add(F(500), crickets(3.8, 340), -30, 0.3, "night crickets")
    add(F(500), sizzle(3.8, 341), -29, -0.4, "braziers")
    for k, t in enumerate([17.1, 17.9, 19.3, 20.0]): add(t, earth_thud(345 + k, 44, 0.5), -28, 0.6, "distant impacts")
    add(F(536), knock(350, 300) * 0.4, -24, 0.1, "the empty pile: knock")
    add(F(541), tink(351, 3000), -26, 0.1, "one pebble")
    add(F(552), whoosh(352, 0.3, 400, 3000), -24, -0.1, "sledgehammer wind-up")
    add(F(F_SMASH), mx(knock(353, 90), chips(354), 0.6 * thud(355, 70, 0.6, 0.4)), -12, 0, "MILLSTONE SMASH")
    add(F(F_SMASH + 3), scrape(0.4, 356, 300), -24, 0, "thirds slide apart")
    add(F(574), whoosh(361, 0.35, 300, 2200), -24, 0.1, "crewmen toss the wedges up")
    add(F(589), knock(362, 180) * 0.5, -25, 0.0, "wedges drop into the sling")
    add(F(MILL_F0 - 12), rope_heave(0.6, 357), -22, -0.2, "heave")
    add(F(MILL_F0), whoosh(358, 0.6, 250, 2600), -20, 0, "millstones fly")
    add(F(MILL_F1), earth_thud(359, 46, 0.6), -26, 0.4, "they hit the corner")
    # ---- 6: the heap, "The wall? Just dents." ----
    add(F(612), crumble(2.0, 360), -25, 0.2, "rubble settles")
    add(F(612), wind(4.3, 361, 0.5), -31, 0, "day wind")
    add(F(DENT_F), earth_thud(362, 48, 1.0), -15, 0.1, "dent")
    add(F(DENT_F) + 0.2, boing(363, 160, 0.4) * 0.5, -26, 0.1, "deadpan boink")
    # ---- 7-8: the towers, the padding, the garden rock ----
    add(F(SMASH_TOWER), splinter(364), -13, -0.2, "TOWER SMASHED")
    add(F(SMASH_TOWER) + 0.3, patter(1.2, 365, 10), -24, -0.2, "planks rain down")
    for k, f in enumerate(DUNG): add(F(f), splat(366 + k), -18, 0.2 - 0.1 * k, "dung slapped on")
    add(F(STRAW), rustle(369, 0.6), -20, -0.2, "straw bundles")
    add(F(STRAW + 8), rustle(370, 0.5), -22, -0.1, "more straw")
    for k, f in enumerate(FELT): add(F(f), whump(371 + k, 80), -19, 0.1, "felt blanket flops over")
    add(F(DEF_LOAD), creak(0.8, 373, 170, 0.3), -23, 0, "defenders' trebuchet loaded")
    add(F(DEF_LOAD) + 0.4, I.glock(m2f(88), 0.35, rng(374), 1.0), -27, 0, "fancy rock: ding")
    add(F(DEF_FIRE - 12), rope_heave(0.6, 375), -21, 0, "heave")
    add(F(DEF_FIRE), whoosh(376, 0.7, 250, 2800), -19, 0.1, "the garden rock flies")
    add(F(GARDEN_LAND), earth_thud(377, 60, 0.8), -18, 0.2, "it lands by the tents")
    # ---- 9-10: cowhide tents, the bomb on a chain, BOOM ----
    for k in range(int((TENT1 - TENT0) / 9)): add(F(TENT0 + 9 * k), step(380 + k) * 0.5, -30, 0.2, "tents shuffle")
    add(F(CHAIN0), chain(F(CHAIN1 - CHAIN0), 400), -21, -0.1, "chain pays out")
    add(F(CHAIN0), fizz(F(BOOM_F - CHAIN0), 401), -24, 0, "fuse fizzes")
    add(F(BOOM_F), boom(402), -8, 0, "BOOM")
    add(F(BOOM_F) + 0.35, patter(1.6, 403, 16), -22, 0.1, "hide scraps rain down")
    add(F(1150), puff(404), -22, 0.1, "sooty puff")
    add(F(1162), step(405) * 0.7, -24, 0.3, "they run")
    for k in range(5): add(F(1166) + 0.12 * k, step(406 + k) * 0.6, -26, 0.4 + 0.1 * k, "running steps")
    # ---- 11-12: peace, no food ----
    add(F(1178), wind(6.2, 410, 0.4), -31, 0, "wind")
    add(F(1196), horn(411, 130.8, 1.4), -22, 0.2, "peace horn")
    add(F(1240), rustle(412, 0.5), -24, 0.1, "scroll unrolled")
    add(F(1252), cheer(1.6, 413), -23, -0.1, "defenders cheer")
    add(F(1296), whoosh(414, 0.7, 200, 2000), -24, 0, "over the gate tower")
    add(F(1322), knock(415, 260), -20, 0, "empty jar: clonk")
    add(F(1336), tink(416, 4200) * 0.6, -26, 0, "one grain of rice")
    add(F(1349), growl_belly(417, 0.8), -18, 0, "stomach growls")
    # ---- 13: the poke ----
    add(F(1390), tink(418, 900) * 0.6, -24, 0.1, "finger pokes the dent")
    add(F(1398), crumble(0.3, 419) * 0.5, -28, 0.1, "a few grains fall")
    add(F(1440), bloop(420, 380, 0.25), -24, 0, "question bloop")
    # ---- 14-16: the lesson ----
    add(F(1458), wind(11.8, 421, 0.25), -33, 0, "wind outside the yurt")
    add(F(F_PLATE - 6), whoosh(422, 0.25, 600, 4000), -26, 0, "hammer swing")
    add(F(F_PLATE), mx(clink(423, 2400), 0.5 * knock(424, 400)), -15, 0, "hammer on the plate")
    add(F(F_PLATE + 2), shatter(425), -16, 0, "crack + shatter")
    add(F(1600), whoosh(426, 0.5, 200, 1600), -22, 0, "into the dirt")
    add(F(1614), grains(2.0, 427), -27, 0, "a world of grains")
    add(F(F_MACRO - 22), mx(slide_down(428, 0.7, 1600, 300) * 0.4, whoosh(429, 0.7, 150, 1400)), -21, 0, "the boulder falls")
    add(F(F_MACRO), mx(thud(430, 40, 1.2, 0.2), 0.8 * grains(0.9, 431)), -11, 0, "BOULDER INTO THE GRAINS")
    add(F(F_MACRO + 10), grains(1.2, 432), -24, 0, "grains settle")
    add(F(1769), I.glock(m2f(79), 0.35, rng(433), 1.0), -26, 0, "dent: ding")
    add(F(1770), whoosh(434, 0.5, 200, 1800), -24, 0, "back out")
    add(F(F_PUNCH), whump(435, 70), -15, 0, "fist into the pillow")
    add(F(F_PUNCH + 1), puff(436) * 0.7, -24, 0.1, "feathers")
    # ---- 17: the Great Wall ----
    add(F(1813), wind(3.6, 437, 0.6), -28, 0, "ridge wind")
    add(F(CUT0), scrape(F(CUT1 - CUT0), 439, 180), -21, 0, "the wall slides open")
    add(F(1882), gong(440, 98.0, 3.0), -16, 0, "heart: gong")
    # ---- 18: the ending ----
    add(F(1920), crowd(5.0, 441, 0.5), -30, 0.2, "siege camp")
    for k in range(8): add(F(1990) + 0.36 * k, step(442 + k) * 0.7, -26, -0.1, "Subutai strolls in")
    add(F(2004), rustle(451, 0.4) * 0.6, -26, -0.3, "Cui Li bows")
    add(F(1940), knock(454, 130) * 0.8, -20, 0, "the bar lifts: clunk")
    add(F(1948), scrape(0.5, 455, 260), -24, 0, "bar slides out")
    add(F(GATE0), creak(F(GATE1 - GATE0) + 0.3, 452, 110, -0.2), -16, 0, "the gate creaks open")
    add(F(GATE1), knock(453, 90) * 0.6, -22, 0, "doors hit the stops")
    return E

def mx(*xs):
    n = max(len(np.asarray(x)) for x in xs); y = np.zeros(n)
    for x in xs: x = np.asarray(x, float); y[:len(x)] += x
    return y

def render_sfx(v_peak_db):
    buf = np.zeros((2, N)); C = []
    ir = make_ir(1.4, 7, hf=1.4)
    for t, x, db, p, name in events():
        if not name: continue
        x = np.asarray(x, float)
        pk = np.abs(x).max() + 1e-12
        g = dbg(v_peak_db + db) / pk
        y = pan(x, p) if x.ndim == 1 else x
        place(buf, y * g, t)
        C.append((t, name, db))
    wet = convolve_st(buf, ir) * 0.12
    return (buf + wet) * dbg(SFX_TRIM_DB), C

# ================================================================ score (G major pentatonic: G A B D E; a minor turn on E)
BPM = 116.0; BEAT = 60 / BPM
SECTIONS = [("hook", 0.0, F(303)), ("setpiece", F(303), F(500)), ("night", F(500), F(612)), ("heap", F(612), F(742)),
            ("towers", F(742), F(995)), ("tents", F(995), F(1131)), ("boom", F(1131), F(1178)), ("peace", F(1178), F(1292)),
            ("food", F(1292), F(1365)), ("question", F(1365), F(1458)), ("lesson", F(1458), F(1612)), ("macro", F(1612), F(1772)),
            ("pillow", F(1772), F(1813)), ("great", F(1813), F(1920)), ("ending", F(1920), DUR)]
PENTA = [55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79]
THEME = [(0, 0.5, 67), (0.5, 0.5, 69), (1, 1, 71), (2, 0.5, 74), (2.5, 0.5, 71), (3, 1, 69), (4, 0.5, 67), (4.5, 0.5, 64), (5, 1, 62),
         (6, 0.5, 64), (6.5, 0.5, 67), (7, 1, 69), (8, 0.5, 71), (8.5, 0.5, 69), (9, 1, 64), (10, 2, 67)]

def score():
    out = np.zeros((2, N))
    def P(x, t, g=1.0, p=0.0):
        if t < 0 or t >= DUR: return
        place(out, (pan(x, p) if np.asarray(x).ndim == 1 else x) * g, t)
    def zither(m, t, vel=0.6, p=0.0, dur=0.8, bright=0.7):   # guzheng-ish: bright pluck near the bridge
        P(I.pluck(m2f(m), vel, rng(int(t * 1000) + m), dur, bright, 0.09), t, 1.0, p)
    def drum(t, vel=0.6, low=True):
        if low: P(I.timpani(m2f(36), vel * 0.7, rng(int(t * 997)), 0.5), t, 0.85)
        else: P(I.snare(vel * 0.35, rng(int(t * 991)), 0.14, 0.8, 0.3), t, 0.5, 0.25)
    def war(t0, t1, vel=0.6):   # war drum pattern (taiko-ish): DUM . dum DUM . . dum .
        t = t0
        while t < t1 - 0.05:
            for d, v, low in [(0, 1.0, True), (1, 0.4, False), (1.5, 0.7, True), (2, 1.0, True), (3, 0.4, False), (3.5, 0.6, True)]:
                if t + d * BEAT < t1: drum(t + d * BEAT, vel * v, low)
            t += 4 * BEAT
    def ostinato(t0, t1, root=55, vel=0.45, p=-0.2):   # running zither eighths
        seq = [0, 2, 3, 2, 4, 3, 2, 1]; t = t0; k = 0
        while t < t1 - 0.05:
            zither(PENTA[(seq[k % 8]) % len(PENTA)] + (root - 55), t, vel, p, 0.35, 0.65); t += BEAT / 2; k += 1
    def theme(t0, t1, shift=0, vel=0.45, p=0.15):
        for (bt, ln, m) in THEME:
            t = t0 + bt * BEAT
            if t + ln * BEAT < t1: P(I.fife(m2f(m + shift + 12), ln * BEAT * 0.9, vel, rng(int(t * 100) + m)), t, 0.45, p)
    def pad(ch, t, d, g=0.4, warm=900, att=0.6, rel=0.8): P(I.pad([m2f(m) for m in ch], d, g, rng(int(t * 10) + 7), att=att, rel=rel, warm=warm), t)
    def tuba(m, t, d=0.35, fall=0.0, g=0.8): P(I.brass(m2f(m), d, 0.7, rng(int(t * 77) + m), "tuba", fall=fall), t, g)
    def brass(m, t, d=0.3, g=0.65): P(I.brass(m2f(m), d, 0.65, rng(int(t * 53) + m), "soft"), t, g)
    def gongP(t, f0=98.0, vel=0.7): P(gong(int(t * 31), f0, 3.0, vel), t, 0.8)
    # ---- hook (0-10.1): war drums + the zither riff, the flute theme enters; tiny stingers on the hits
    pad([43, 50, 55], 0.0, F(303), 0.4, 700, 0.3, 0.6)
    war(0.0, F(303), 0.55)
    ostinato(0.25, F(303), 55, 0.38)
    theme(F(140), F(303), 0, 0.38)
    for t in (F(148), F(272)): P(I.timpani(m2f(31), 0.8, rng(int(t * 10)), 1.2), t, 0.7)
    # ---- SET PIECE (10.1-16.7): the first lift: big drums, brass fanfare, cymbal + gong on the volley
    pad([43, 50, 55, 62, 67], F(303), F(500 - 303), 0.55, 1400, 0.4, 0.8)
    war(F(303), F(500), 0.85)
    for k, m in enumerate([55, 62, 67, 71, 74]): brass(m, F(310) + k * 0.16, 0.26 if k < 4 else 0.9, 0.7)
    theme(F(330), F(500), 0, 0.5, 0.1)
    P(I.cymbal(0.85, rng(500), 2.6, bright=0.8), F(438), 0.7); gongP(F(440), 87.3, 0.9)
    for k, m in enumerate([67, 71, 74, 79]): brass(m, F(445) + k * 0.12, 0.25 if k < 3 else 1.0, 0.75)
    # ---- night (16.7-20.4): low drone, sparse drums, a lonely flute; the smash gets a hit
    pad([40, 47, 52], F(500), F(112), 0.45, 500, 0.6, 0.6)
    for k in range(int(F(112) / (2 * BEAT))): drum(F(500) + k * 2 * BEAT, 0.4, True)
    for k, m in enumerate([64, 62, 59, 57, 59]): P(I.fife(m2f(m + 12), BEAT * 1.6, 0.3, rng(520 + k)), F(504) + k * BEAT * 1.7, 0.4, 0.1)
    P(I.timpani(m2f(31), 0.95, rng(530), 1.4), F(F_SMASH)); P(I.cymbal(0.5, rng(531), 1.2), F(F_SMASH), 0.4)
    # ---- heap (20.4-24.7): comic plucks climbing the heap, deadpan tuba on "Just dents"
    for k in range(10): zither(PENTA[k % len(PENTA)] + 7, F(616) + k * 0.2, 0.5, 0.1, 0.4, 0.6)
    tuba(43, F(713), 0.25); tuba(38, F(DENT_F), 0.5, 0, 0.8)
    # ---- towers (24.7-33.2): a busy comic jig (zither + woodblock), splat stingers, a "ta-da" on the garden rock
    ostinato(F(742), F(995), 55, 0.42, 0.2)
    war(F(742), F(995), 0.4)
    P(I.cymbal(0.6, rng(540), 1.4), F(SMASH_TOWER), 0.5)
    for k, f in enumerate(DUNG): tuba([43, 45, 47][k], F(f), 0.2, 0, 0.6)
    for k, m in enumerate([67, 71, 74, 79]): zither(m, F(937) + k * 0.07, 0.6, 0.2, 0.8, 0.8)
    # ---- tents (33.2-37.7): sneaky tiptoe tuba + pizzicato; tension rises with the fuse; BOOM cuts the music
    for k in range(int(F(BOOM_F - 995) / BEAT)):
        t = F(995) + k * BEAT
        tuba([43, 45, 47, 45][k % 4], t, 0.18, 0, 0.55); zither([67, 71][k % 2], t + BEAT / 2, 0.3, -0.2, 0.2, 0.5)
    for k in range(8): P(I.snare(0.1 + 0.05 * k, rng(560 + k), 0.12), F(CHAIN0) + k * F(CHAIN1 - CHAIN0) / 8, 0.5)
    P(I.timpani(m2f(28), 1.0, rng(570), 2.0), F(BOOM_F)); P(I.cymbal(1.0, rng(571), 2.4), F(BOOM_F), 0.7)
    # ---- peace (39.3-43.1): a grand-but-grudging horn chord; food: a sad sliding zither
    pad([50, 57, 62, 66], F(1178), F(114), 0.45, 1100, 0.4, 0.6)
    for k, m in enumerate([62, 66, 69, 74]): brass(m, F(1192) + k * 0.2, 0.3 if k < 3 else 0.9, 0.6)
    for k, m in enumerate([71, 69, 67, 64, 62, 59]): zither(m, F(1300) + k * 0.28, 0.45 - 0.04 * k, 0.1, 0.5, 0.4)
    tuba(40, F(1349), 0.9, -1.0, 0.7)
    # ---- question (45.5-48.6): curious plucks, unresolved
    for k, m in enumerate([67, 71, 74, 72]): zither(m, F(1372) + k * 0.36, 0.42, 0.2, 0.5, 0.5)
    pad([55, 62, 66], F(1400), 1.8, 0.3, 1000, 0.5, 0.6)
    # ---- lesson (48.6-53.7): "You see": warm explanatory pad + the theme, gentle
    pad([43, 50, 55, 59, 62], F(1458), F(154), 0.5, 1200, 0.6, 0.6)
    theme(F(1470), F(1612), 0, 0.36, 0.1)
    P(I.timpani(m2f(43), 0.6, rng(580), 0.9), F(F_PLATE), 0.6)
    # ---- macro (53.7-59.1): wonder: shimmering music box over a drone; the boulder lands on a low gong
    pad([43, 50, 55, 62], F(1612), F(160), 0.45, 1500, 0.5, 0.6)
    for k in range(14): P(I.musicbox(m2f([79, 83, 86, 81, 79, 76][k % 6]), 0.32, rng(590 + k), 0.6), F(1616) + k * BEAT * 0.5, 0.35, 0.25)
    gongP(F(F_MACRO), 73.4, 0.85)
    # ---- pillow (59.1-60.4): a soft comic plop
    tuba(43, F(F_PUNCH), 0.3, 0, 0.6)
    # ---- great (60.4-64.0): majestic swell, the theme an octave up, gong on "heart"
    pad([43, 50, 55, 62, 67, 71], F(1813), F(107), 0.6, 1600, 0.7, 0.8)
    theme(F(1818), F(1920), 0, 0.48, 0.1)
    war(F(1813), F(1920), 0.5)
    # ---- ending (64.0-69.0): the hook's war drums return, sneaky; the final sting on "gate" + a last chord
    war(F(1920), F(2046), 0.5)
    ostinato(F(1924), F(2046), 55, 0.36)
    for k, m in enumerate([62, 64, 67]): brass(m, F(2020) + k * 0.14, 0.2, 0.6)
    P(I.timpani(m2f(31), 1.0, rng(600), 1.6), F(2047)); P(I.cymbal(0.8, rng(601), 1.4), F(2047), 0.6)
    pad([43, 50, 55, 62, 67], F(2047), DUR - F(2047), 0.5, 1400, 0.02, 0.2)
    ir = make_ir(1.8, 3, hf=1.3)
    return out + convolve_st(out, ir) * 0.22

# ================================================================ mix
def speech_spans(words, merge=0.3):
    sp = []
    for w in words:
        s, e = float(w["s"]), float(w["e"])
        if sp and s - sp[-1][1] < merge: sp[-1][1] = max(sp[-1][1], e)
        else: sp.append([s, e])
    return sp

def duck_db(spans, depth=DUCK_DB, pre=0.08, post=0.12, att=0.07, rel=0.45):
    ctrl = 1000; nc = int(DUR * ctrl) + 2; va = np.zeros(nc)
    for s, e in spans: va[max(0, int((s - pre) * ctrl)): int((e + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl)); env = np.zeros(nc); e = 0.0
    for i in range(nc):
        tgt = va[i]; e += (tgt - e) * (ka if tgt > e else kr); env[i] = e
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)

def section_curve(m, v):
    gains = {}
    for name, a, b in SECTIONS:
        seg = slice(ns(a), ns(b)); Lm, Lv = integrated(m[:, seg]), integrated(v[:, seg])
        if not np.isfinite(Lv): Lv = integrated(v)
        target = MUSIC_BED_LU + {"setpiece": 2.0, "boom": 1.0, "great": 1.5, "ending": 1.0, "question": -1.0}.get(name, 0.0)
        gains[name] = float(np.clip(Lv + target - Lm, -40, 6)) if np.isfinite(Lm) else 0.0
    curve = np.zeros(N); t = np.arange(N) / SR
    for name, a, b in SECTIONS: curve[t >= a] = gains[name]
    return ndimage.uniform_filter1d(curve, ns(0.35), mode="nearest"), gains

def limiter(x, ceil_db=CEIL_DBTP, look=0.003, rel=0.08):
    c = dbg(ceil_db); n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12)); La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest"); g2 = g1.copy(); idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR)); gap = ns(rel * 8); brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]]); ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap); seg = g1[a:e]; o = np.empty(len(seg)); g = 1.0
            for k in range(len(seg)): g = min(seg[k], g + (1 - g) * kr); o[k] = g
            g2[a:e] = o
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :], g3

def lufs(x): return float(integrated(x))

def main():
    t_start = time.time()
    words = json.load(open(os.path.join(ROOT, "voice", "data", "words.json")))
    x, sr = read_wav(os.path.join(ROOT, "voice", "data", "narration.wav"))
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    if sr != SR: v = signal.resample_poly(v, SR // np.gcd(SR, sr), sr // np.gcd(SR, sr))
    vv = np.zeros(N); vv[: min(N, len(v))] = v[:N]; v = st(vv)
    v_ref, v_pk = lufs(v), 20 * np.log10(np.abs(v).max())
    log(f"voice {v_ref:.2f} LUFS, peak {v_pk:.2f} dBFS, {len(v[0]) / SR:.3f} s")
    m_raw = score(); log("score rendered", f"{lufs(m_raw):.2f} LUFS")
    m_d = m_raw * dbg(duck_db(speech_spans(words)))[None, :]
    cur, gains = section_curve(m_d, v); m = m_d * dbg(cur)[None, :]
    m[:, ns(DUR - 0.05):] *= np.linspace(1, 0, N - ns(DUR - 0.05))[None, :]
    s, C = render_sfx(v_pk); log("sfx rendered", f"{lufs(s):.2f} LUFS")
    mix0 = v + m + s; G = TARGET_LUFS - lufs(mix0)
    for it in range(6):
        y, g3 = limiter(mix0 * dbg(G)); L = lufs(y)
        log(f"master iter {it}: {G:+.2f} dB -> {L:.2f} LUFS, TP {true_peak(y):.2f} dBTP, max GR {-20 * np.log10(g3.min()):.2f} dB")
        if abs(L - TARGET_LUFS) < 0.02: break
        G += TARGET_LUFS - L
    y = fades(y, 0.0, 0.03); assert y.shape == (2, N)
    write_wav(os.path.join(HERE, "mix.wav"), y)
    for nm, z in (("voice", v), ("music", m), ("sfx", s)): write_wav(os.path.join(HERE, f"stem_{nm}.wav"), z * dbg(G))
    I_, TP, LRA = lufs(y), true_peak(y), lra(y)
    rows = []
    for name, a, b in SECTIONS:
        seg = slice(ns(a), ns(b)); rows.append((name, a, b, lufs(v[:, seg] * dbg(G)), lufs(m[:, seg] * dbg(G)), lufs(s[:, seg] * dbg(G))))
    L = ["# Kaifeng - soundtrack cue sheet", "",
         "All sound is original and synthesized here (`kaifeng_audio.py`, `sfxlib.py`, `instruments.py`, `dsp.py`). Voice = `voice/data/narration.wav` (user's ElevenLabs read, edited + x1.27), gain only.", "",
         f"Master: **{I_:.1f} LUFS** integrated, true peak **{TP:.1f} dBTP**, LRA {LRA:.1f} LU, {N} samples = {N / SR:.3f} s @ 48 kHz stereo 24-bit.",
         f"Mix standard: music bed {MUSIC_BED_LU:+.0f} LU re voice (+3 dB standard), ducked {DUCK_DB:+.0f} dB under speech; SFX trimmed {SFX_TRIM_DB:+.0f} dB; voice gain only.", "",
         "## Sections (LUFS at mix gain)", "| section | start | end | voice | music | sfx |", "|---|---|---|---|---|---|"]
    L += [f"| {n} | {a:.2f} | {b:.2f} | {lv:.1f} | {lm:.1f} | {ls:.1f} |" for n, a, b, lv, lm, ls in rows]
    L += ["", "## SFX events", "| t (s) | event | dB re voice peak (before -6 dB trim) |", "|---|---|---|"] + [f"| {t:.2f} | {nm} | {db:+.0f} |" for t, nm, db in sorted(C)]
    open(os.path.join(HERE, "cues.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    log(f"mix {I_:.2f} LUFS, TP {TP:.2f} dBTP, LRA {LRA:.1f}; done in {time.time() - t_start:.0f} s")
    for r_ in rows: log(f"{r_[0]:<9} voice {r_[3]:6.1f} music {r_[4]:6.1f} sfx {r_[5]:6.1f}")

if __name__ == "__main__":
    main()
