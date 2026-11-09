# Soundtrack of "The Burning Pigs That Beat an Army of Elephants" (Megara 266 BC, Edessa 544 AD): synthesized SFX on
# the picture's events and an original score, ducked under the voice, and the mix.
# Every cue time comes from the picture's contract: the word frames (voice/data/words.json) and the beat constants of
# src/videos/pigs/story.ts (read by regex below: F_SMASH, F_RAID, F_SMEAR, F_IGNITE, GATE_OPEN, F_RUN, F_SHRIEK,
# F_FREEZE, REAR, TURN, F_STAMPEDE, F_CRASH, F_SQUEAL_ED, F_RUN_ED, CARRY, SPEARS hits, the shot starts). Re-run after
# any timing change. Note the hook (frames 0-118) replays story frames 812-862 at 0.42x speed: its sounds are placed on
# film time and pitched down a touch (slow motion).
# Mix standard (cartoon-3d-short skill): music +3 dB = bed 10 LU under the voice, SFX -6 dB, voice gain only.
# Master -15 LUFS integrated, <= -1.2 dBTP, 48 kHz stereo 24-bit, exact picture length (TOTAL frames).
import json, os, re, time
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, reson, colored, smooth_noise, ramp, fades, modal, pan, st, place,
                 widen, make_ir, convolve_st, integrated, momentary, short_term, lra, true_peak, read_wav, write_wav)
import instruments as I
from sfxlib import *  # noqa: F401,F403

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STORY = open(os.path.join(ROOT, "..", "src", "videos", "pigs", "story.ts"), encoding="utf-8").read()
def C(name):  # a numeric constant from story.ts
    return float(re.search(rf"export const {name} = (-?[\d.]+)", STORY).group(1))
def CL(name):  # a [a, b] constant
    return [float(x) for x in re.search(rf"export const {name} = \[([^\]]+)\]", STORY).group(1).split(",")]
FPS, TOTAL = 30, int(C("TOTAL"))   # TOTAL = the OLD picture length (story.ts frames; the am_michael read)
# ElevenLabs re-time (voice/make_warp.py): the film is FILM_TOTAL new frames, new frame g shows old frame WARP[g].
# Every cue below is still written in OLD picture frames; F() maps an old frame to NEW seconds, D(a, b) is the new
# length of the old span a..b, and W[...] gives the old frame that the new read's word lands on.
_WP = json.load(open(os.path.join(ROOT, "voice", "data", "warp.json")))
FILM_TOTAL, _WARP = int(_WP["film_total"]), np.array(_WP["table"], float)
_G = np.arange(len(_WARP), dtype=float)
DUR = FILM_TOTAL / FPS
N = ns(DUR)
F_SMASH, F_RAID, F_SMEAR, F_IGNITE, F_RUN, F_SHRIEK = C("F_SMASH"), C("F_RAID"), C("F_SMEAR"), C("F_IGNITE"), C("F_RUN"), C("F_SHRIEK")
F_FREEZE, F_STAMPEDE, F_CRASH = C("F_FREEZE"), C("F_STAMPEDE"), C("F_CRASH")
F_SQUEAL_ED, F_RUN_ED = float(re.search(r"F_SQUEAL_ED = ([\d.]+)", STORY).group(1)), float(re.search(r"F_RUN_ED = ([\d.]+)", STORY).group(1))
GATE_OPEN, REAR, TURN, CARRY = CL("GATE_OPEN"), CL("REAR"), CL("TURN"), CL("CARRY")
SPEAR_HITS = [float(x) for x in re.findall(r"hit: (\d+), from", STORY)]
SHOT = [int(x) for x in re.findall(r"^  \[(\d+), \"\w+\", \"\w+\"\],", STORY, re.M)]   # shot starts (SH)
TARGET_LUFS, CEIL_DBTP, DUCK_DB = -15.0, -1.2, -3.0
MUSIC_BED_LU = -10.0       # music level under the voice ("+3 dB music")
SFX_TRIM_DB = -6.0         # "SFX -6 dB"
m2f = I.m2f
F = lambda f: float(np.interp(f, _WARP, _G)) / FPS   # OLD picture frame -> NEW film seconds (a time POINT)
D = lambda a, b: F(b) - F(a)                          # NEW length (s) of the old span a..b
HOOK = lambda st: (st - 812) / 0.42   # story frame inside the hook's slow motion -> film frame
log = lambda *a: print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)

# words: W["word"] = (old) picture frame of the first occurrence, W["word2"] of the second, ...
_words = json.load(open(os.path.join(ROOT, "voice", "data", "words.json"), encoding="utf-8"))
W = {}
for w in _words:
    k = re.sub(r"[^a-z0-9]", "", w["w"].lower()); n = 1
    while (k if n == 1 else f"{k}{n}") in W: n += 1
    W[k if n == 1 else f"{k}{n}"] = float(np.interp(float(w["s"]) * FPS, _G, _WARP))   # old frame of the new word

# ================================================================ new sounds
def mx(*xs):
    n = max(len(np.asarray(x)) for x in xs); y = np.zeros(n)
    for x in xs: x = np.asarray(x, float); y[:len(x)] += x
    return y

def squeal(seed, dur=0.7, f0=1150.0, k=1.0):  # a pig squeal: a harsh nasal glide up and down, raspy
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + 0.55 * np.sin(np.pi * t / dur) ** 0.8) * (1 + 0.04 * np.sin(TAU * r.uniform(14, 22) * t))
    ph = TAU * np.cumsum(f) / SR
    y = np.sin(ph) + 0.6 * np.sin(2 * ph) + 0.45 * np.sin(3 * ph) + 0.3 * np.sin(5 * ph)
    y = reson(y, f0 * 2.2, 6) * 0.6 + y * 0.4
    y += 0.25 * bp(r.standard_normal(len(t)), 1800, 5200) * np.abs(np.sin(TAU * 31 * t))   # rasp
    env = np.sin(np.pi * np.minimum(t / dur, 1)) ** 0.6
    return fades(np.tanh(1.6 * y * env) * k, 0.01, 0.06)

def oink(seed, f0=140.0):  # a short grunt
    r = rng(seed); t = tt(0.22)
    f = f0 * (1 + 0.3 * np.exp(-t / 0.05))
    y = np.sin(TAU * np.cumsum(f) / SR) * (1 + 0.8 * np.sign(np.sin(TAU * 38 * t)))
    return fades(lp(y + 0.3 * r.standard_normal(len(t)), 1400) * np.exp(-t / 0.09), 0.005, 0.03)

def trumpet(seed, dur=1.1, f0=380.0, rise=1.4, k=1.0):  # an elephant trumpet: a brassy blare with a rising glide + growl
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + (rise - 1) * np.minimum(t / (dur * 0.35), 1)) * (1 - 0.18 * np.maximum(0, (t - dur * 0.7) / (dur * 0.3)))
    f = f * (1 + 0.012 * np.sin(TAU * 6.5 * t))
    ph = TAU * np.cumsum(f) / SR
    y = sum(np.sin(h * ph) / h ** 0.7 for h in range(1, 9))
    y += 0.35 * bp(r.standard_normal(len(t)), 600, 2600) * (1 + np.sin(TAU * 27 * t))
    env = np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - dur * 0.75) / 0.12)
    return fades(np.tanh(1.4 * y * env) * k, 0.01, 0.08)

def stomp(seed, low=48.0, k=1.0):  # an elephant footfall: a heavy low thud + dirt
    return mx(thud(seed, low, 0.7, 0.25) * k, scratch(0.12, seed + 1) * 0.15 * k)

def gallop(dur, seed, rate=4.2, low=50.0, n_animals=3):  # the line running: many heavy footfalls
    y = np.zeros(ns(dur)); r = rng(seed)
    for a in range(n_animals):
        t = r.uniform(0, 0.2)
        while t < dur - 0.05:
            place_m(y, stomp(seed * 31 + int(t * 100) + a, low * r.uniform(0.85, 1.15), r.uniform(0.6, 1.0)), t)
            t += 1 / rate * r.uniform(0.85, 1.15)
    return y

def trotters(dur, seed, rate=9.0):  # pigs running: quick light patter
    y = np.zeros(ns(dur)); r = rng(seed); t = 0.0
    while t < dur - 0.03:
        place_m(y, knock(seed + int(t * 1000), r.uniform(320, 520)) * r.uniform(0.25, 0.5), t); t += 1 / rate * r.uniform(0.7, 1.3)
    return y

def ignite(seed):  # a pitch fire catching: a deep WHOOMP + roar onset
    r = rng(seed); t = tt(1.2)
    boom = lp(r.standard_normal(len(t)), 220) * np.exp(-t / 0.25) * 2.0
    roar = bp(r.standard_normal(len(t)), 300, 2500) * np.minimum(1, t / 0.08) * np.exp(-t / 0.7)
    return fades(boom + roar, 0.003, 0.1)

def flames(dur, seed, k=1.0):  # moving fire: rumble + crackle
    r = rng(seed); t = tt(dur)
    roar = lp(r.standard_normal(len(t)), 300) * (0.7 + 0.3 * smooth_noise(len(t), r, 4)) * 1.2
    return fades((roar + sizzle(dur, seed + 1)[:len(t)] * 1.0) * k, 0.2, 0.3)

def spear_tink(seed):  # a spear glancing off thick hide: a dull thock + a bright metal ting
    return mx(knock(seed, 210) * 0.7, tink(seed + 1, 2900) * 0.6, I.glock(m2f(91), 0.35, rng(seed + 2), 0.5) * 0.25)

def arrow_whiz(seed, dur=0.5):  # one arrow in flight
    r = rng(seed); t = tt(dur)
    f = r.uniform(2200, 3200) * (1 - 0.35 * t / dur)
    y = bp(r.standard_normal(len(t)), 1500, 6000) * np.sin(np.pi * t / dur) ** 2 + 0.15 * np.sin(TAU * np.cumsum(f) / SR) * np.sin(np.pi * t / dur)
    return fades(y, 0.01, 0.05)

def arrow_thunk(seed):  # an arrow into hide / ground
    return mx(knock(seed, 380) * 0.6, tink(seed + 1, 1700) * 0.15)

def door_groan(seed, dur=0.9):
    return mx(creak(dur, seed, 120, 0.25) * 0.8, creak(dur * 0.8, seed + 1, 210, 0.35) * 0.4)

def yell(seed, dur=0.6, f0=190.0):  # a soldier's wordless shout: a vowel glide
    r = rng(seed); t = tt(dur)
    f = f0 * (1 + 0.25 * np.sin(np.pi * t / dur)) * (1 + 0.02 * np.sin(TAU * 5 * t))
    ph = TAU * np.cumsum(f) / SR
    y = sum(np.sin(h * ph) / h for h in range(1, 12))
    y = reson(y, 700, 5) * 0.6 + reson(y, 1150, 6) * 0.4
    return fades(np.tanh(y * np.sin(np.pi * t / dur) ** 0.5), 0.02, 0.1)

def dunk(seed):  # a torch dunked in water: splash + steam hiss
    r = rng(seed); t = tt(0.9)
    hissy = bp(r.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.35) * 0.7
    return mx(splat(seed) * 0.6, hissy)

def reed_pen(dur, seed):  # writing on papyrus
    y = np.zeros(ns(dur)); r = rng(seed); t = 0.0
    while t < dur - 0.2: place_m(y, scratch(r.uniform(0.12, 0.3), seed + int(t * 100)) * r.uniform(0.4, 0.8), t); t += r.uniform(0.2, 0.4)
    return y

def baby_toot(seed):  # a baby elephant's happy little trumpet
    return trumpet(seed, 0.45, 620, 1.25, 0.6)

# ================================================================ SFX events (time s, sound, level dB re voice peak, pan, name)
def events():
    E = []
    add = lambda t, x, db, p=0.0, name="": E.append((t, x, db, p, name))
    sh = SHOT  # 0 hook, 118 wide, 288 spears, 392 smash, 478 city, 690 gate, 800 freeze, 1005 writer, 1108 stable, 1295 edessa
    # ---- hook (slow motion, st 826-885): flames roar, E3's trumpet as it rears, the scream ----
    add(0.0, flames(F(118) + 0.3, 1, 0.9), -27, 0.1, "hook: the pig's flames")
    add(0.0, gallop(F(118), 2, 2.4, 40, 2) * 0.7, -27, -0.2, "hook: slow heavy footfalls")
    add(F(14), trumpet(3, 1.6, 300, 1.35, 1.0), -19, -0.35, "hook: E3 trumpets as it rears (slow)")
    add(F(HOOK(843)), squeal(4, 0.9, 900, 1.0), -19, 0.05, "hook: squeal")
    add(F(86), squeal(5, 1.0, 1000, 1.0), -16, 0.0, "hook: the SCREAM (88)")
    add(F(112), whoosh(6, 0.5, 300, 2600), -25, 0, "dissolve: Greece")
    # ---- the march: heavy steps, harness jingle, the army behind ----
    add(F(sh[1]), gallop(D(sh[1], 392), 10, 1.6, 42, 3), -26, -0.1, "the line walks: footfalls")
    add(F(sh[1]), crowd(D(sh[1], 392), 11, 0.6), -32, 0.3, "the phalanx murmurs far")
    for k in range(6): add(F(sh[1]) + 0.9 * k + 0.2, clink(12 + k, 1900 + 120 * k) * 0.4, -31, -0.3, "harness jingle")
    add(F(W["antigonus"]) + 0.2, trumpet(18, 0.7, 420, 1.2, 0.5), -27, -0.2, "E3 a short proud trumpet")
    add(F(W["megara"]), whoosh(19, 0.4, 250, 2000), -27, 0, "tilt to the city")
    # ---- spears bounce, the volley ----
    for k, h in enumerate(SPEAR_HITS):
        add(F(h - 14), whoosh(30 + k, 0.45, 600, 4200), -27, 0.2, "spear in flight")
        add(F(h), spear_tink(33 + k), -14, 0.15, "spear BOUNCE: tink")
        add(F(h + 12), knock(36 + k, 260) * 0.5, -27, 0.25, "the spear lands")
    add(F(336), mx(*[arrow_whiz(40 + k, 0.5) for k in range(6)]), -21, 0.0, "the volley looses")
    for k in range(12): add(F(356 + 1.8 * k), arrow_thunk(50 + k), -26, rng(70 + k).uniform(-0.6, 0.6), "arrows stick")
    add(F(W["sting"]), I.glock(m2f(84), 0.25, rng(80), 0.6), -29, 0.1, "barely sting: plink")
    # ---- SET PIECE: the charge, the smash ----
    add(F(378), trumpet(90, 1.3, 360, 1.5, 1.0), -13, -0.2, "the line TRUMPETS into the charge")
    add(F(380), gallop(D(380, 445), 91, 3.8, 46, 5), -16, 0, "the charge thunders")
    add(F(F_SMASH - 3), crowd(2.2, 92, 1.0), -18, 0.1, "the defenders yell")
    add(F(F_SMASH), mx(thud(93, 40, 1.2, 0.5), crash(94, 1.4, 55)), -11, 0, "SMASH")
    for k in range(5): add(F(F_SMASH + 4 + 5 * k), mx(clink(95 + k, 1500), knock(100 + k, 300) * 0.6), -22, rng(110 + k).uniform(-0.7, 0.7), "shields + bodies tumble")
    add(F(F_SMASH + 6), slide_down(115, 0.6, 1400, 400), -26, 0.3, "a defender flies (slide)")
    # ---- inside the city: the pen, the pitch, the fire ----
    add(F(sh[4] - 3), whoosh(120, 0.5, 300, 2000), -26, 0, "cut into the city")
    add(F(sh[4]), murmur(D(sh[4], 690), 121), -30, 0.2, "the city murmurs")
    for k in range(5): add(F(sh[4]) + 0.4 + 0.55 * k, oink(122 + k, 120 + 15 * k), -24, 0.35 - 0.15 * k, "the pen grunts")
    add(F(F_RAID - 3), mx(whoosh(130, 0.25, 500, 2500), squelch(131)), -22, 0.3, "the hero vaults into the mud")
    add(F(F_RAID), squeal(132, 0.8, 1200, 0.9), -14, 0.3, "the grab: SQUEAL")
    add(F(F_RAID + 26), squeal(133, 0.6, 1300, 0.7), -20, 0.1, "the carried pig squeals")
    add(F(560), trotters(D(560, 640), 134, 6.0), -28, 0, "pigs herded to the queue")
    add(F(F_SMEAR - 2), mx(squelch(135, 0.4, 200), splat(136)), -15, 0.1, "SMEAR: a sticky slap")
    for k in range(4): add(F(F_SMEAR + 12 + 9 * k), squelch(137 + k, 0.3, 230 + 20 * k), -23, 0.1, "brushing pitch")
    add(F(F_SMEAR + 4), oink(141, 170), -20, 0.1, "a disgusted oink")
    add(F(600), pour(1.4, 142), -26, -0.2, "pitch poured from buckets")
    add(F(W["set"] - 6), sizzle(1.4, 143), -25, -0.3, "the torch from the brazier")
    add(F(F_IGNITE), ignite(144), -11, 0.05, "IGNITE: whoomp")
    for k in range(6): add(F(F_IGNITE + 4 + 3.2 * k), ignite(150 + k) * 0.6, -21, -0.2 + 0.08 * k, "the flame runs down the queue")
    add(F(F_IGNITE + 6), flames(D(F_IGNITE, GATE_OPEN[1] + 30), 160, 1.0), -19, 0, "the queue burns")
    add(F(F_IGNITE + 3), mx(squeal(161, 0.5, 1250, 0.7), squeal(162, 0.6, 1050, 0.6)), -18, 0, "the pigs squeal at the heat")
    # ---- the gate, the charge out ----
    add(F(GATE_OPEN[0]), door_groan(170, 0.9), -16, 0, "the gate groans open")
    add(F(GATE_OPEN[1]), thud(171, 70, 0.6, 0.4), -18, 0, "the leaves bang open")
    add(F(F_RUN), trotters(D(F_RUN, 820), 172, 11.0), -17, 0, "the pigs bolt: trotters")
    add(F(F_RUN), flames(D(F_RUN, 990), 173, 1.0), -18, 0.05, "the burning pigs run")
    add(F(745), whoosh(174, 1.2, 200, 1800), -22, 0, "ride-along whoosh through the gate")
    for k in range(6): add(F(F_SHRIEK + 3 * k), squeal(180 + k, 0.8, 950 + 90 * k, 0.9), -13 - k, rng(190 + k).uniform(-0.6, 0.6), "SHRIEKING")
    # ---- freeze, spin, stampede, crash ----
    add(F(F_FREEZE), mx(slide_up(200, 0.35, 500, 1600) * 0.6), -24, 0, "the freeze: a held breath")
    add(F(REAR[0] + 2), trumpet(201, 1.4, 330, 1.6, 1.0), -17, -0.3, "E3 rears: panic trumpet")
    add(F(TURN[0]), mx(*[trumpet(202 + k, 1.0, 340 + 40 * k, 1.5, 0.5) for k in range(3)]), -19, 0.1, "the line trumpets in terror")
    add(F(F_STAMPEDE), gallop(D(F_STAMPEDE, 1005), 210, 4.6, 44, 6), -14, 0, "STAMPEDE")
    add(F(F_STAMPEDE), rumble(D(F_STAMPEDE, 1005), 211), -18, 0, "the ground shakes")
    add(F(F_CRASH - 4), crowd(2.2, 212, 1.0), -16, 0.2, "the phalanx: alarm")
    add(F(F_CRASH), mx(crash(213, 1.6, 50), thud(214, 38, 1.0, 0.5)), -11, 0, "CRASH into the phalanx")
    for k in range(6): add(F(F_CRASH + 4 + 6 * k), mx(yell(220 + k, 0.5, 170 + 20 * k) * 0.7, clink(230 + k, 1600)), -20, rng(240 + k).uniform(-0.8, 0.8), "soldiers flung")
    add(F(F_CRASH + 10), slide_down(245, 0.8, 1600, 300), -24, -0.3, "one flies far (slide)")
    add(F(970), yell(246, 0.9, 140), -20, -0.2, "Antigonus bellows")
    # ---- the writer ----
    add(F(sh[7] - 3), whoosh(250, 0.5, 300, 2000), -27, 0, "dissolve: the writer")
    add(F(sh[7]), hum(D(sh[7], sh[8]), 251, 50) * 0.5, -36, 0, "room tone")
    add(F(sh[7]), bird(252), -31, 0.6, "a bird outside")
    add(F(W["swore"]), I.glock(m2f(81), 0.3, rng(253), 0.6), -27, 0, "swore: ding")
    add(F(1046), reed_pen(D(1046, 1088) + 0.3, 254), -21, 0.05, "the reed pen scratches")
    add(F(W["squeal"]), squeal(255, 0.35, 1400, 0.5), -24, 0.1, "a tiny squeal (the drawing)")
    # ---- the stable ----
    add(F(sh[8] - 3), whoosh(260, 0.5, 300, 2000), -27, 0, "dissolve: the stable")
    add(F(sh[8]), wind(D(sh[8], sh[9]), 261, 0.5), -33, 0, "a warm breeze")
    for k, t in enumerate([0.4, 2.1, 4.0]): add(F(sh[8]) + t, bird(262 + k), -32, 0.4 - 0.3 * k, "birds")
    add(F(W["orders"]), whoosh(265, 0.25, 600, 3000), -27, -0.3, "Antigonus points")
    for k in range(int(D(CARRY[0], CARRY[1]) / 0.33)): add(F(CARRY[0]) + 0.33 * k, step(266 + k) * 0.5, -29, -0.2, "trainers' steps")
    for k in range(3): add(F(CARRY[0]) + 0.6 + 0.4 * k, oink(275 + k, 260), -26, -0.1, "piglet snorts")
    add(F(1214), baby_toot(280), -22, 0.2, "a baby elephant toots")
    add(F(W["squeal2"]), squeal(281, 0.55, 1600, 0.7), -16, 0.1, "the piglet squeals")
    add(F(W["squeal2"] + 8), baby_toot(282), -21, 0.15, "the baby just toots back")
    # ---- Edessa ----
    add(F(sh[9] - 3), whoosh(290, 0.6, 250, 1800), -26, 0, "dissolve: Edessa")
    add(F(sh[9]), wind(D(sh[9], TOTAL) , 291, 0.7), -30, 0, "evening wind")
    add(F(sh[9]), crowd(D(sh[9], 1440), 292, 0.5), -31, 0.3, "the Persian army far")
    add(F(1310), gallop(D(1310, 1404), 293, 1.5, 44, 1), -24, -0.1, "the Persian elephant's steps")
    for k in range(5): add(F(W["pushes"] - 6) + 0.5 * k, yell(300 + k, 0.4, 160 + 15 * k) * 0.6, -25, 0.3, "the pushers heave")
    add(F(1405), creak(1.0, 306, 160, 0.3) * 0.6, -25, 0, "the turret creaks")
    add(F(1436), sizzle(1.0, 307), -26, 0.2, "the Roman's torch")
    add(F(W["light"]), dunk(308), -16, 0.2, "the torch DUNKED: hiss")
    add(F(1500), oink(309, 180), -22, 0.1, "the pig grunts in his arms")
    add(F(W["hang"]), mx(squeak(310, 900, 0.3), clack(311, 1400) * 0.5), -21, 0, "the hook clicks on")
    add(F(1508), rope_heave(D(1508, 1558), 312) * 0.7, -24, 0.1, "the rope pays out (pulley)")
    add(F(F_SQUEAL_ED), squeal(320, 1.1, 1100, 1.0), -14, 0.0, "the SQUEAL")
    add(F(F_SQUEAL_ED + 4), trumpet(321, 1.3, 340, 1.65, 1.0), -17, -0.1, "the giant elephant panics")
    add(F(1590), squeal(322, 0.7, 1250, 0.8), -19, 0.05, "squeal again")
    add(F(1585), mx(creak(0.6, 323, 140, 0.4), crash(324, 1.0, 70) * 0.5), -23, 0.2, "the turret lurches, archers tumble")
    add(F(F_RUN_ED), gallop(D(F_RUN_ED, TOTAL), 325, 4.4, 46, 1), -20, 0, "it RUNS")
    add(F(1625), cheer(D(1625, TOTAL) + 0.3, 326), -22, -0.3, "the Romans cheer")
    return E

def render_sfx(v_peak_db):
    buf = np.zeros((2, N)); C_ = []
    ir = make_ir(1.4, 7, hf=1.4)
    for t, x, db, p, name in events():
        if not name or t >= DUR: continue
        x = np.asarray(x, float)
        pk = np.abs(x).max() + 1e-12
        g = dbg(v_peak_db + db) / pk
        y = pan(x, p) if x.ndim == 1 else x
        place(buf, y * g, t)
        C_.append((t, name, db))
    wet = convolve_st(buf, ir) * 0.12
    return (buf + wet) * dbg(SFX_TRIM_DB), C_

# ================================================================ score: a Greek war march in D dorian (pipes = aulos,
# a plucked lyre ostinato, frame drums, brass for the elephants); the city plan goes sneaky pizzicato; the stampede is
# chaos; the writer + stable go warm and playful; Edessa is golden and tense, then a comic slide + tuba gallop.
BPM = 112.0; BEAT = 60 / BPM
def S_(i): return F(SHOT[i])
SECTIONS = [("hook", 0.0, S_(1)), ("march", S_(1), F(380)), ("charge", F(380), S_(4)), ("city", S_(4), F(F_IGNITE)),
            ("fire", F(F_IGNITE), F(F_FREEZE)), ("freeze", F(F_FREEZE), F(F_STAMPEDE)), ("stampede", F(F_STAMPEDE), S_(7)),
            ("writer", S_(7), S_(8)), ("stable", S_(8), S_(9)), ("edessa", S_(9), F(F_SQUEAL_ED)), ("ending", F(F_SQUEAL_ED), DUR)]
MODE = [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74]   # D dorian
THEME = [(0, 0.5, 62), (0.5, 0.5, 64), (1, 1, 65), (2, 0.5, 67), (2.5, 0.5, 69), (3, 1, 67), (4, 1.5, 65),
         (6, 0.5, 64), (6.5, 0.5, 62), (7, 1, 60), (8, 0.5, 62), (8.5, 0.5, 64), (9, 2, 62)]

def score():
    out = np.zeros((2, N))
    def P(x, t, g=1.0, p=0.0):
        if t < 0 or t >= DUR: return
        place(out, (pan(x, p) if np.asarray(x).ndim == 1 else x) * g, t)
    def lyre(m, t, vel=0.5, p=0.0, dur=0.6, bright=0.6): P(I.pluck(m2f(m), vel, rng(int(t * 1000) + m), dur, bright, 0.15), t, 1.0, p)
    def drum(t, vel=0.6, low=True):
        if low: P(I.timpani(m2f(38), vel * 0.6, rng(int(t * 997)), 0.45), t, 0.8)
        else: P(I.brush(vel * 0.6, rng(int(t * 991)), 0.2), t, 0.6, 0.3)
    def march(t0, t1, vel=0.55):   # DUM . tek . DUM DUM tek .
        t = t0
        while t < t1 - 0.05:
            for d, v, low in [(0, 1.0, True), (1, 0.5, False), (2, 0.8, True), (2.5, 0.6, True), (3, 0.5, False)]:
                if t + d * BEAT < t1: drum(t + d * BEAT, vel * v, low)
            t += 4 * BEAT
    def gallop_drums(t0, t1, vel=0.7):
        t = t0
        while t < t1 - 0.05:
            for d, v in [(0, 1.0), (0.33, 0.6), (0.66, 0.7)]: drum(t + d * BEAT, vel * v, True)
            drum(t + 0.5 * BEAT, vel * 0.5, False); t += BEAT
    def ostinato(t0, t1, vel=0.38, p=-0.2, root=0, step=0.5):
        seq = [0, 2, 4, 2, 5, 4, 2, 1]; t = t0; k = 0
        while t < t1 - 0.05:
            lyre(MODE[seq[k % 8]] + root, t, vel, p, 0.3, 0.55); t += BEAT * step; k += 1
    def theme(t0, t1, shift=0, vel=0.42, p=0.15):
        for (bt, ln, m) in THEME:
            t = t0 + bt * BEAT
            if t + ln * BEAT < t1: P(I.fife(m2f(m + shift + 12), ln * BEAT * 0.9, vel, rng(int(t * 100) + m)), t, 0.42, p)
    def pad(ch, t, d, g=0.4, warm=900, att=0.6, rel=0.8): P(I.pad([m2f(m) for m in ch], d, g, rng(int(t * 10) + 7), att=att, rel=rel, warm=warm), t)
    def tuba(m, t, d=0.3, fall=0.0, g=0.8): P(I.brass(m2f(m), d, 0.7, rng(int(t * 77) + m), "tuba", fall=fall), t, g)
    def brass(m, t, d=0.3, g=0.65): P(I.brass(m2f(m), d, 0.65, rng(int(t * 53) + m), "soft"), t, g)
    sec = {n: (a, b) for n, a, b in SECTIONS}
    # hook: a low pad + slow heavy drum (slow motion), the theme's first notes on a pipe
    a, b = sec["hook"]; pad([38, 45, 50], a, b - a, 0.4, 700, 0.3, 0.5)
    for k in range(int((b - a) / (BEAT * 2))): drum(a + k * BEAT * 2, 0.6, True)
    theme(a + 0.6, b, -12, 0.35)
    # march: the war march: drums, lyre, the theme on pipes, tuba steps with the elephants
    a, b = sec["march"]; pad([38, 45, 50, 53, 57], a, b - a, 0.45, 1100, 0.5, 0.6)
    march(a, b, 0.6); ostinato(a, b, 0.36); theme(a + BEAT * 2, b, 0, 0.42)
    for k in range(int((b - a) / BEAT)): tuba([38, 38, 45, 38][k % 4], a + k * BEAT, 0.25, 0, 0.45)
    # charge (SET PIECE): the first lift: gallop drums, brass stabs, cymbal on the smash
    a, b = sec["charge"]; pad([38, 45, 50, 53, 57, 62], a, b - a, 0.55, 1500, 0.2, 0.6)
    gallop_drums(a, b, 0.85); ostinato(a, b, 0.42, -0.2, 0, 0.25)
    for k, m in enumerate([62, 65, 69, 74]): brass(m, a + 0.2 + k * 0.12, 0.25 if k < 3 else 0.8, 0.6)
    P(I.timpani(m2f(31), 1.0, rng(400), 1.6), F(F_SMASH)); P(I.cymbal(0.8, rng(401), 2.0), F(F_SMASH), 0.6)
    # city: the plan: sneaky pizzicato lyre + tuba tiptoe, a rising line into the fire
    a, b = sec["city"]; pad([38, 45, 48], a, b - a, 0.35, 700, 0.6, 0.6)
    for k in range(int((b - a) / (BEAT / 2))):
        lyre([62, 65, 62, 69, 62, 65, 67, 64][k % 8] + (k // 16) * 2, a + k * BEAT / 2, 0.32, 0.2, 0.15, 0.4)
        if k % 4 == 0: tuba([38, 41, 43, 45][(k // 4) % 4], a + k * BEAT / 2, 0.18, 0, 0.5)
    # fire + charge out: big: the theme up an octave, gallop drums, brass
    a, b = sec["fire"]; pad([38, 45, 50, 54, 57, 62], a, b - a, 0.55, 1600, 0.2, 0.4)
    P(I.timpani(m2f(33), 0.9, rng(410), 1.2), F(F_IGNITE)); P(I.cymbal(0.6, rng(411), 1.4), F(F_IGNITE), 0.5)
    gallop_drums(F(GATE_OPEN[1]), b, 0.9); theme(F(GATE_OPEN[1]), b, 12, 0.45)
    for k, m in enumerate([62, 66, 69, 74]): brass(m, F(GATE_OPEN[1]) + k * 0.1, 0.22 if k < 3 else 0.7, 0.6)
    # freeze: everything stops but a held high string tone; a bassoon-ish tuba "uh-oh"
    a, b = sec["freeze"]; pad([74, 75], a, b - a, 0.25, 2200, 0.05, 0.3)
    tuba(45, a + 0.2, 0.4, -0.5, 0.7); tuba(44, a + 0.65, 0.6, -1.5, 0.7)
    # stampede: chaos: fast gallop, frantic lyre, brass falls
    a, b = sec["stampede"]; pad([38, 44, 50, 56], a, b - a, 0.5, 1400, 0.1, 0.5)
    gallop_drums(a, b, 1.0); ostinato(a, b, 0.45, 0.2, 0, 0.25)
    for k in range(4): P(I.brass(m2f(69 - 3 * k), 0.5, 0.7, rng(420 + k), "tuba", fall=-3.0), a + 0.4 + k * 0.6, 0.55)
    P(I.timpani(m2f(31), 1.0, rng(430), 1.6), F(F_CRASH)); P(I.cymbal(0.9, rng(431), 2.0), F(F_CRASH), 0.6)
    # writer: calm and wise: a slow lyre arpeggio + soft pipe
    a, b = sec["writer"]; pad([43, 50, 55, 59], a, b - a, 0.4, 900, 0.5, 0.6)
    for k in range(int((b - a) / BEAT)): lyre([55, 59, 62, 67][k % 4], a + k * BEAT, 0.3, 0.1, 0.8, 0.45)
    # stable: warm + playful: music box + plucks, a bouncy tuba
    a, b = sec["stable"]; pad([45, 52, 57, 61], a, b - a, 0.42, 1100, 0.5, 0.6)
    for k in range(int((b - a) / (BEAT / 2))):
        if k % 2 == 0: P(I.musicbox(m2f([69, 73, 76, 81, 76, 73][(k // 2) % 6] + 12), 0.35, rng(440 + k), 0.6), a + k * BEAT / 2, 0.4, 0.15)
        if k % 4 == 0: tuba([45, 52][(k // 4) % 2], a + k * BEAT / 2, 0.2, 0, 0.45)
    # edessa: golden, tense: low drone, a lone pipe (the theme, slower), tension pulse before the squeal
    a, b = sec["edessa"]; pad([38, 45, 50, 51], a, b - a, 0.45, 800, 0.8, 0.3)
    theme(a + 0.4, F(1505), -12, 0.32, -0.1)
    for k in range(int((b - F(1505)) / (BEAT / 2))): lyre([62, 63][k % 2], F(1505) + k * BEAT / 2, 0.28 + 0.01 * k, 0.2, 0.15, 0.4)
    # ending: the SQUEAL sting (cymbal + brass hit + slide whistle), then the comic tuba gallop out, D major
    a, b = sec["ending"]; P(I.cymbal(0.8, rng(450), 1.8), a, 0.6); brass(62, a, 0.6, 0.7); brass(66, a, 0.6, 0.6); brass(69, a, 0.6, 0.6)
    pad([38, 45, 50, 54, 57, 62], a, b - a, 0.5, 1500, 0.2, 0.2)
    gallop_drums(F(F_RUN_ED), b, 0.7)
    for k in range(int((b - F(F_RUN_ED)) / (BEAT / 2))): tuba([38, 45, 42, 45][k % 4], F(F_RUN_ED) + k * BEAT / 2, 0.15, 0, 0.6)
    ir = make_ir(1.8, 3, hf=1.3)
    return out + convolve_st(out, ir) * 0.22

# ================================================================ mix (same as the Kaifeng gold standard)
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
        target = MUSIC_BED_LU + {"charge": 2.0, "fire": 1.5, "stampede": 1.5, "ending": 2.0, "freeze": -1.0, "writer": -0.5}.get(name, 0.0)
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
    vdir = os.environ.get("VOICE_DIR", os.path.join(ROOT, "voice", "data"))
    words = json.load(open(os.path.join(vdir, "words.json")))
    x, sr = read_wav(os.path.join(vdir, "narration.wav"))
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    if sr != SR: v = signal.resample_poly(v, SR // np.gcd(SR, sr), sr // np.gcd(SR, sr))
    vv = np.zeros(N); vv[: min(N, len(v))] = v[:N]; v = st(vv)
    v_ref, v_pk = lufs(v), 20 * np.log10(np.abs(v).max())
    log(f"voice ({vdir}) {v_ref:.2f} LUFS, peak {v_pk:.2f} dBFS; picture {FILM_TOTAL} film f (old {TOTAL}) = {DUR:.3f} s; shots (old f) {SHOT}")
    m_raw = score(); log("score rendered", f"{lufs(m_raw):.2f} LUFS")
    m_d = m_raw * dbg(duck_db(speech_spans(words)))[None, :]
    cur, gains = section_curve(m_d, v); m = m_d * dbg(cur)[None, :]
    m[:, ns(DUR - 0.05):] *= np.linspace(1, 0, N - ns(DUR - 0.05))[None, :]
    s, C_ = render_sfx(v_pk); log("sfx rendered", f"{lufs(s):.2f} LUFS")
    mix0 = v + m + s; G = TARGET_LUFS - lufs(mix0)
    for it in range(6):
        y, g3 = limiter(mix0 * dbg(G)); L = lufs(y)
        gr = -20 * np.log10(g3)
        log(f"master iter {it}: {G:+.2f} dB -> {L:.2f} LUFS, TP {true_peak(y):.2f} dBTP, max GR {gr.max():.2f} dB; "
            f"time with GR > 0.5 dB {100 * (gr > 0.5).mean():.2f} %, > 1.5 dB {100 * (gr > 1.5).mean():.2f} %")
        if abs(L - TARGET_LUFS) < 0.02: break
        G += TARGET_LUFS - L
    y = fades(y, 0.0, 0.03); assert y.shape == (2, N)
    write_wav(os.path.join(HERE, "mix.wav"), y)
    for nm, z in (("voice", v), ("music", m), ("sfx", s)): write_wav(os.path.join(HERE, f"stem_{nm}.wav"), z * dbg(G))
    I_, TP, LRA = lufs(y), true_peak(y), lra(y)
    rows = []
    for name, a, b in SECTIONS:
        seg = slice(ns(a), ns(b)); rows.append((name, a, b, lufs(v[:, seg] * dbg(G)), lufs(m[:, seg] * dbg(G)), lufs(s[:, seg] * dbg(G))))
    L = ["# Pigs - soundtrack cue sheet", "",
         "All sound is original and synthesized here (`pigs_audio.py`, `sfxlib.py`, `instruments.py`, `dsp.py`). Voice = narration.wav, gain only.", "",
         f"Master: **{I_:.1f} LUFS** integrated, true peak **{TP:.1f} dBTP**, LRA {LRA:.1f} LU, {N} samples = {N / SR:.3f} s @ 48 kHz stereo 24-bit.",
         f"Mix standard: music bed {MUSIC_BED_LU:+.0f} LU re voice (+3 dB standard), ducked {DUCK_DB:+.0f} dB under speech; SFX trimmed {SFX_TRIM_DB:+.0f} dB; voice gain only.", "",
         "## Sections (LUFS at mix gain)", "| section | start | end | voice | music | sfx |", "|---|---|---|---|---|---|"]
    L += [f"| {n} | {a:.2f} | {b:.2f} | {lv:.1f} | {lm:.1f} | {ls:.1f} |" for n, a, b, lv, lm, ls in rows]
    L += ["", "## SFX events", "| t (s) | event | dB re voice peak (before -6 dB trim) |", "|---|---|---|"] + [f"| {t:.2f} | {nm} | {db:+.0f} |" for t, nm, db in sorted(C_)]
    open(os.path.join(HERE, "cues.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    log(f"mix {I_:.2f} LUFS, TP {TP:.2f} dBTP, LRA {LRA:.1f}; done in {time.time() - t_start:.0f} s")
    for r_ in rows: log(f"{r_[0]:<9} voice {r_[3]:6.1f} music {r_[4]:6.1f} sfx {r_[5]:6.1f}")

if __name__ == "__main__":
    main()
