r"""Build the reusable SFX library with the ElevenLabs sound-generation API (scripts/el.py sfx).

usage:
  python build_lib.py --dry                 -> the plan, seconds and projected credits per priority (no API call)
  python build_lib.py [--budget 5000] [--max-priority 3] [--only name,name]
                                            -> generates every missing sound, highest priority first, and stops before
                                               the budget would be passed; re-runs skip what exists (idempotent)
  python build_lib.py --limit 1             -> the PROBE: generate one sound only, print the measured credits/second
  python build_lib.py --post                -> re-slice / re-measure every downloaded take (no API call)

Budget: the library's own spend = the sum of the measured credits of its takes (index.json), so re-runs never spend
more than --budget in total and narration generated in between does not count against it. The cost of every take is measured (quota before / after) and
written to index.json. After the first take the measured rate (credits/s) is printed; if the priority-1 set alone
would not fit the budget at that rate the run stops (the brief: "stop and report if unaffordable").

Multi-take prompts ("Four separate knocks ... with a pause between each", split=4) give several variants for the price
of one generation: the take is sliced at its silences into <name>_1.wav ... <name>_n.wav (group = <name>). Loops ask the
API for a seamless loop (loop=true); sfxbank.loop() crossfades anyway.

Files: <category>/<name>_take.mp3 (as generated), <category>/<name>.wav or <name>_<k>.wav (48 kHz 24-bit, trimmed),
index.json (one entry per playable file + one per take), budget.json, build.log.
"""
import argparse, ast, json, os, subprocess, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EL = os.path.join(os.path.dirname(HERE), "scripts", "el.py")
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "pigs-short", "audio"))
from dsp import SR, ns, integrated, momentary_max, true_peak, write_wav, fades  # noqa: E402

DRY = "close-mic, dry, no reverb, no music, no voice, isolated sound effect"
NOV = "no music, no human voice"
# (name, category, seconds, priority, split, loop, prompt_influence, prompt)
SPEC = [
    # ---- whooshes (camera moves, transitions)
    ("whoosh_fast", "whoosh", 0.8, 1, 0, False, 0.6, f"One very fast short air whoosh, a quick swipe past the microphone, crisp and airy, {DRY}"),
    ("whoosh_medium", "whoosh", 1.2, 1, 0, False, 0.6, f"One medium-speed air swish whoosh passing by, smooth soft rise and fall, {DRY}"),
    ("whoosh_sweep", "whoosh", 1.6, 1, 0, False, 0.6, "One long smooth cinematic air sweep whoosh, slow rise to a peak in the middle then fade out, airy wind texture, no tonal riser, no music, no voice"),
    ("whip_pan", "whoosh", 0.8, 1, 0, False, 0.6, f"A sharp whip-pan swish transition, an extremely fast swoosh of air with a snap at the peak, {DRY}"),
    ("whoosh_heavy", "whoosh", 1.2, 2, 0, False, 0.6, f"A heavy deep whoosh of a large object swinging past, low airy rumble with a fast peak, {DRY}"),
    # ---- impacts
    ("wood_knock", "impact", 2.5, 1, 4, False, 0.6, f"Four separate single knocks of a wooden club hitting a thick wooden plank, each knock followed by half a second of silence, {DRY}"),
    ("wood_break", "impact", 1.5, 1, 0, False, 0.5, f"Wooden shields and a wooden fence smashing and splintering apart in one big hit, crunchy cracks and debris, {DRY}"),
    ("metal_clang", "impact", 2.5, 1, 3, False, 0.6, f"Three separate bronze sword hits on a bronze shield, short metallic clangs with a pause between each, {DRY}"),
    ("body_thud", "impact", 2.5, 1, 3, False, 0.6, f"Three separate body falls, a person falling onto dirt ground with a dull thump and cloth rustle, a pause between each, {DRY}"),
    ("stone_thud", "impact", 1.8, 2, 2, False, 0.6, f"Two separate heavy stone blocks dropped onto packed earth, deep dull thud with grit, a pause between them, {DRY}"),
    ("cartoon_bonk", "impact", 0.7, 2, 0, False, 0.5, "A cartoon bonk, a hollow wooden head-hit with a short comic ring, dry, no music, no voice"),
    ("dust_hit", "impact", 1.0, 2, 0, False, 0.5, f"A soft heavy impact into dry dirt with a puff of dust and pebbles scattering, {DRY}"),
    # ---- footsteps
    ("steps_dirt", "steps", 3.0, 1, 6, False, 0.6, f"Six separate single footsteps of a sandal on dry dirt and gravel, slow even pace with clear gaps, {DRY}"),
    ("steps_stone", "steps", 3.0, 2, 6, False, 0.6, f"Six separate single footsteps of a leather sandal on stone paving, slow even pace with clear gaps, {DRY}"),
    ("steps_wood", "steps", 2.5, 3, 5, False, 0.6, f"Five separate single footsteps on an old wooden floor, slow pace with clear gaps, slight creak, {DRY}"),
    # ---- foley
    ("cloth_move", "foley", 2.5, 1, 4, False, 0.6, f"Four separate quick cloth and leather movement rustles, a person turning and gesturing, short bursts with silence between, {DRY}"),
    ("mud_squelch", "foley", 2.5, 1, 4, False, 0.6, f"Four separate wet sticky squelches, thick tar slapped on with a brush, a pause between each, {DRY}"),
    ("gate_creak", "foley", 1.8, 1, 0, False, 0.5, "A huge heavy wooden city gate creaking open on old iron hinges, deep wood groan, no music, no voice"),
    ("torch_dunk", "foley", 1.5, 1, 0, False, 0.5, "A burning torch plunged into a bucket of water, a quick splash then a loud steam hiss, no music, no voice"),
    ("scroll_rustle", "foley", 1.5, 1, 0, False, 0.6, f"A papyrus scroll unrolled and rustled on a wooden desk, dry crackly paper, {DRY}"),
    ("pen_scratch", "foley", 1.5, 2, 0, False, 0.6, f"A reed pen scratching quickly on papyrus, writing, {DRY}"),
    ("wood_creak", "foley", 1.5, 2, 2, False, 0.5, f"Two separate creaks of a wooden tower straining under weight, a pause between them, {DRY}"),
    ("rope_pulley", "foley", 1.5, 2, 0, False, 0.5, f"A rope running through a squeaky wooden pulley wheel, rope friction, {DRY}"),
    ("metal_click", "foley", 1.5, 2, 3, False, 0.6, f"Three separate small iron hook and latch clicks, a pause between each, {DRY}"),
    ("water_splash", "foley", 1.0, 2, 0, False, 0.5, f"A small object splashing into a bucket of water, one short splash, {DRY}"),
    ("tar_pour", "foley", 1.5, 3, 0, False, 0.5, f"Thick black tar poured from a wooden bucket, gloopy viscous pour, {DRY}"),
    ("harness_jingle", "foley", 2.0, 3, 0, False, 0.5, "Leather harness straps with small bronze rings jingling as a large animal walks, light rhythmic metal jingle, no music, no voice"),
    # ---- crowd / nonverbal voices
    ("crowd_murmur", "crowd", 4.0, 1, 0, True, 0.4, "Ancient town crowd murmur, many people talking softly at a distance, indistinct walla, no clear words, no music, seamless loop"),
    ("crowd_cheer", "crowd", 2.5, 1, 0, False, 0.5, "A crowd of soldiers cheering in victory, a big rising cheer, no clear words, no music"),
    ("crowd_panic", "crowd", 2.0, 1, 0, False, 0.5, "A crowd of soldiers shouting in panic and alarm as they scatter, yells and screams, no clear words, no music"),
    ("male_yell", "crowd", 3.0, 1, 3, False, 0.5, "Three separate short wordless male shouts: an effort grunt, a surprised yell and a pained cry, a pause between each, no words, no music"),
    ("crowd_gasp", "crowd", 1.2, 2, 0, False, 0.5, "A small crowd gasping in surprise at once, one short sharp gasp, no words, no music"),
    ("crowd_laugh", "crowd", 2.0, 3, 0, False, 0.5, "A small group of people laughing heartily, no words, no music"),
    # ---- ambience loops
    ("amb_outdoor_day", "ambience", 4.5, 1, 0, True, 0.4, "Outdoor countryside daytime ambience, gentle wind over dry grass and distant birds chirping, calm, no music, no voice, seamless loop"),
    ("amb_town", "ambience", 4.5, 1, 0, True, 0.4, "Ancient town square daytime ambience, distant footsteps, faint far chatter, a far-off cart, light wind, no clear words, no music, seamless loop"),
    ("amb_room", "ambience", 4.0, 1, 0, True, 0.4, "Quiet indoor room tone of a stone study, faint wind outside and a distant bird, very calm, no music, no voice, seamless loop"),
    ("amb_battle_far", "ambience", 4.5, 1, 0, True, 0.4, "Distant ancient battle ambience, a far-away army shouting and metal clashing, muffled by distance, no music, seamless loop"),
    ("amb_wind_walls", "ambience", 4.5, 1, 0, True, 0.4, "Evening wind blowing over high stone city walls, steady airy wind with gentle gusts, no birds, no music, no voice, seamless loop"),
    ("amb_night", "ambience", 4.0, 3, 0, True, 0.4, "Night ambience, crickets chirping and a light breeze, no music, no voice, seamless loop"),
    # ---- fire
    ("fire_ignite", "fire", 1.5, 1, 0, False, 0.5, "A torch igniting oil, a deep fast WHOOMP of flames catching then a short roar, no music, no voice"),
    ("fire_crackle", "fire", 4.0, 1, 0, True, 0.4, "A burning fire crackling and roaring steadily, close, no music, no voice, seamless loop"),
    ("fire_whoosh", "fire", 1.5, 1, 0, False, 0.5, "A burning torch swung fast past the microphone, a fiery whoosh of flame passing by, no music, no voice"),
    # ---- comic stingers (no record scratch)
    ("pop", "comic", 0.5, 2, 0, False, 0.5, "A short cartoon pop, a cork-like mouth pop, dry, no music"),
    ("boing", "comic", 0.8, 2, 0, False, 0.5, "A cartoon spring boing, comic, dry, no music"),
    ("slide_whistle_down", "comic", 1.0, 2, 0, False, 0.5, "A cartoon slide whistle falling in pitch, a comic fall, dry, no music"),
    ("swoosh_pop", "comic", 0.8, 3, 0, False, 0.5, "A quick cartoon swoosh ending in a pop, dry, no music"),
    ("zip_away", "comic", 0.7, 3, 0, False, 0.5, "A fast cartoon zip of a character running off, dry, no music"),
    # ---- weapons
    ("spear_swish", "weapon", 0.8, 1, 0, False, 0.6, f"A thrown spear flying fast past the microphone, a sharp swish of air, {DRY}"),
    ("arrow_volley", "weapon", 2.0, 1, 0, False, 0.5, "A volley of many arrows released at once, bowstrings twang and a swarm of arrows whooshing overhead, no music, no voice"),
    ("arrow_thunk", "weapon", 2.5, 1, 4, False, 0.6, f"Four separate arrows striking thick leather and wood, short sharp thunks with a pause between each, {DRY}"),
    ("arrow_whiz", "weapon", 1.5, 2, 2, False, 0.6, f"Two separate arrows whizzing past the microphone, fast thin whistling whooshes with a gap, {DRY}"),
    # ---- animals: pigs + elephants (the pigs short; animals are otherwise per story)
    ("pig_squeal", "animal", 3.5, 1, 3, False, 0.6, f"Three separate loud high-pitched pig squeals, a frightened pig squealing, a short pause between each, close-mic, {NOV}"),
    ("pig_squeal_long", "animal", 2.0, 1, 0, False, 0.6, f"One long panicked pig scream, a pig shrieking loudly in terror, close-mic, {NOV}"),
    ("pig_grunt", "animal", 3.0, 1, 5, False, 0.6, f"Five separate short pig grunts and oinks, a pig snorting, with clear gaps, close-mic, {NOV}"),
    ("pig_herd_panic", "animal", 2.5, 1, 0, False, 0.5, f"A herd of pigs squealing and shrieking in panic while running fast on dirt, chaotic, {NOV}"),
    ("elephant_trumpet_a", "animal", 2.0, 1, 0, False, 0.6, f"One loud elephant trumpet call, powerful and brassy, close, {NOV}"),
    ("elephant_trumpet_b", "animal", 2.0, 1, 0, False, 0.6, f"A frightened elephant trumpeting in panic, a shrill high trumpet blast, {NOV}"),
    ("elephant_steps", "animal", 2.5, 1, 4, False, 0.6, "Four separate heavy elephant footsteps on dry earth, deep thuds with clear gaps, no music, no voice"),
    ("elephant_stampede", "animal", 3.5, 1, 0, True, 0.5, "A herd of elephants stampeding, thundering heavy footfalls shaking the ground, rumbling, no music, no voice, seamless loop"),
    ("pig_trotters", "animal", 2.0, 2, 0, True, 0.5, "Several small pigs running fast on hard ground, quick light patter of hooves, no squeals, no music, seamless loop"),
    ("baby_elephant_toot", "animal", 1.0, 2, 0, False, 0.5, "A baby elephant giving a tiny playful trumpet toot, cute, no music"),
]

def log(*a):
    s = f"[{time.strftime('%H:%M:%S')}] " + " ".join(str(x) for x in a)
    print(s, flush=True)
    open(os.path.join(HERE, "build.log"), "a", encoding="utf-8").write(s + "\n")

def quota():
    for i in range(6):      # the user endpoint rate-limits (429): back off instead of quitting
        r = subprocess.run([sys.executable, EL, "user"], capture_output=True, text=True)
        line = r.stdout.strip().splitlines()[-1]
        code, d = line.split(" ", 1)
        if code == "200": break
        if code != "429" or i == 5: sys.exit(f"quota check failed: {line}")
        time.sleep(5 * 2 ** i)
    d = ast.literal_eval(d)
    return int(d["character_count"]), int(d["character_limit"])

def decode(path):
    """mp3/wav -> (2, n) float at 48 kHz"""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(SR), "pipe:1"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)

def env_db(x, win=0.01):
    m = np.abs(x).max(0); w = max(1, ns(win)); n = len(m) // w
    e = m[: n * w].reshape(n, w).max(1)
    return 20 * np.log10(e + 1e-9), w

def trim(x, floor_db=-50.0, pre=0.005, post=0.06):
    """cut leading / trailing silence (relative to the peak)"""
    e, w = env_db(x); on = np.flatnonzero(e > e.max() + floor_db)
    if not len(on): return x
    a = max(0, on[0] * w - ns(pre)); b = min(x.shape[1], (on[-1] + 1) * w + ns(post))
    return fades(x[:, a:b], 0.002, 0.03)

def split(x, n, min_gap=0.12):
    """slice a multi-take at its silences into n pieces (the n loudest if more are found)"""
    from scipy import ndimage
    e, w = env_db(x); best = None; k = max(1, int(round(min_gap / 0.01)))
    for floor in (-30, -26, -34, -22, -38, -18, -42):
        on = ndimage.binary_closing(np.pad(e > e.max() + floor, k), structure=np.ones(k))[k:-k]   # bridge gaps < min_gap
        lab, nl = ndimage.label(on)
        segs = [(sl[0].start, sl[0].stop) for sl in ndimage.find_objects(lab)]
        segs = [s for s in segs if (s[1] - s[0]) * 0.01 >= 0.04]
        if len(segs) == n: best = segs; break
        if len(segs) > n and best is None: best = sorted(sorted(segs, key=lambda s: -e[s[0]:s[1]].max())[:n])
    if best is None: return [trim(x)]
    out = []
    for i, j in best:
        a = max(0, i * w - ns(0.02)); b = min(x.shape[1], j * w + ns(0.08))
        out.append(trim(x[:, a:b]))
    return out

def measure(y):
    return {"peak_dbfs": round(float(20 * np.log10(np.abs(y).max() + 1e-12)), 2), "lufs": round(float(integrated(y)), 2),
            "mmax_lufs": round(float(momentary_max(y)), 2), "true_peak": round(float(true_peak(y)), 2), "len_s": round(y.shape[1] / SR, 3)}

def charged(t):
    """credits a take counts against the budget: the measured cost, or the assumed one when the account counter did not move"""
    return max(t.get("credits") or 0, t.get("credits_est") or 0)

def load_index():
    p = os.path.join(HERE, "index.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"sounds": [], "takes": []}

def save_index(ix):
    ix["sounds"].sort(key=lambda s: (s["category"], s["name"])); ix["takes"].sort(key=lambda s: (s["category"], s["name"]))
    json.dump(ix, open(os.path.join(HERE, "index.json"), "w", encoding="utf-8"), indent=1)

# takes whose wavs were cut by hand (see their index notes): --post leaves them alone
HAND_CUT = {"whoosh_medium"}

def post(spec, ix, credits=None):
    """slice + measure one downloaded take, (re)write its wavs and index entries"""
    name, cat, secs, pri, nsplit, loop, infl, prompt = spec
    if name in HAND_CUT and credits is None: return [name]
    d = os.path.join(HERE, cat); take = os.path.join(d, f"{name}_take.mp3")
    x = decode(take)
    parts = split(x, nsplit) if nsplit else [x if loop else trim(x)]
    ix["sounds"] = [s for s in ix["sounds"] if s.get("group") != name]
    files = []
    for k, y in enumerate(parts, 1):
        nm = f"{name}_{k}" if nsplit else name
        f = os.path.join(d, nm + ".wav"); write_wav(f, y)
        files.append(nm)
        ix["sounds"].append({"name": nm, "group": name, "category": cat, "file": os.path.relpath(f, HERE).replace("\\", "/"),
                             "loopable": loop, "prompt": prompt, "notes": (f"slice {k}/{len(parts)} of a {nsplit}-take" if nsplit else ""), **measure(y)})
    old = next((t for t in ix["takes"] if t["name"] == name), {})
    ix["takes"] = [t for t in ix["takes"] if t["name"] != name]
    ix["takes"].append({"name": name, "category": cat, "file": os.path.relpath(take, HERE).replace("\\", "/"), "prompt": prompt,
                        "seconds": secs, "prompt_influence": infl, "loop": loop, "priority": pri, "split": nsplit,
                        "credits": credits if credits is not None else old.get("credits"), "slices": files,
                        "generated": old.get("generated", time.strftime("%Y-%m-%d %H:%M"))})
    if nsplit and len(parts) != nsplit: log(f"  NOTE {name}: asked for {nsplit} takes, found {len(parts)}")
    return files

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=int, default=5000); ap.add_argument("--max-priority", type=int, default=3)
    ap.add_argument("--only", default=""); ap.add_argument("--dry", action="store_true"); ap.add_argument("--post", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="at most this many generations in this run (0 = no limit)")
    ap.add_argument("--rate", type=float, default=40.0, help="assumed credits per second before the first measurement")
    a = ap.parse_args()
    only = set(filter(None, a.only.split(",")))
    todo = [s for s in SPEC if s[3] <= a.max_priority and (not only or s[0] in only)]
    todo.sort(key=lambda s: s[3])
    if a.dry:
        for p in (1, 2, 3):
            ss = [s for s in SPEC if s[3] == p]
            print(f"priority {p}: {len(ss)} generations, {sum(s[2] for s in ss):.1f} s, ~{sum(s[2] for s in ss) * a.rate:.0f} credits at {a.rate:g}/s, "
                  f"{sum(max(1, s[4]) for s in ss)} playable sounds")
        tot = sum(s[2] for s in SPEC)
        print(f"all: {len(SPEC)} generations, {tot:.1f} s, ~{tot * a.rate:.0f} credits; budget {a.budget}")
        return
    ix = load_index()
    if a.post:
        for s in todo:
            if os.path.exists(os.path.join(HERE, s[1], f"{s[0]}_take.mp3")): post(s, ix); save_index(ix); log("re-post", s[0])
        return
    bp = os.path.join(HERE, "budget.json")
    used0, limit = quota()
    if not os.path.exists(bp):
        json.dump({"start_count": used0, "budget": a.budget, "ceiling": used0 + a.budget, "started": time.strftime("%Y-%m-%d %H:%M")}, open(bp, "w"), indent=1)
    B = json.load(open(bp)); ceiling = B["start_count"] + a.budget
    rate = B.get("rate", a.rate)
    log(f"account quota {used0}/{limit}; library budget {a.budget}, spent so far {sum(charged(t) for t in ix['takes'])} (index.json); rate {rate:.1f}/s")
    made = 0
    for s in todo:
        if a.limit and made >= a.limit: log(f"--limit {a.limit} reached"); break
        name, cat, secs, pri, nsplit, loop, infl, prompt = s
        os.makedirs(os.path.join(HERE, cat), exist_ok=True)
        take = os.path.join(HERE, cat, f"{name}_take.mp3")
        if os.path.exists(take): continue
        used, _ = quota()
        spent = sum(charged(t) for t in ix["takes"])      # the library's own spend (measured, or assumed when the counter lags)
        if used + secs * rate * 1.1 > ceiling:
            log(f"STOP: account counter {used} would pass the library ceiling {ceiling}"); break
        if spent + secs * rate * 1.1 > a.budget:
            log(f"SKIP {name} (P{pri}, {secs} s ~{secs * rate:.0f} cr): would pass the budget ({spent}/{a.budget} spent)"); continue
        args = [sys.executable, EL, "sfx", take, str(secs), str(infl), prompt] + (["loop"] if loop else [])
        r = subprocess.run(args, capture_output=True, text=True)
        if r.returncode != 0:
            log(f"FAIL {name}: {(r.stderr or r.stdout).strip()[:300]}")
            if "missing the permission" in (r.stderr + r.stdout) or "quota" in (r.stderr + r.stdout).lower(): sys.exit(1)
            continue
        after = used
        for _ in range(2):      # the counter often lags a take; the assumed-rate charge covers that
            time.sleep(3)
            after, _ = quota()
            if after != used: break
        cr = after - used
        if "rate" not in B and cr > 0:
            B["rate"] = rate = cr / secs; json.dump(B, open(bp, "w"), indent=1)
            p1 = sum(x[2] for x in SPEC if x[3] == 1) * rate
            log(f"MEASURED RATE: {cr} credits for {secs} s = {rate:.1f} credits/s; priority-1 set ~{p1:.0f} credits, all ~{sum(x[2] for x in SPEC) * rate:.0f}")
            if p1 > a.budget: log("STOP: the priority-1 set alone does not fit the budget at this rate"); post(s, ix, cr); save_index(ix); sys.exit(2)
        files = post(s, ix, cr)
        if cr <= 0:      # the counter did not move (lag or free): charge the assumed rate so the budget still holds
            next(t for t in ix["takes"] if t["name"] == name)["credits_est"] = round(secs * rate)
        save_index(ix); made += 1
        log(f"OK {name} (P{pri}, {secs} s{', loop' if loop else ''}) {cr} credits{'' if cr > 0 else f' (counter did not move; charged ~{round(secs * rate)})'} -> {', '.join(files)}; library spent {spent + max(cr, 0 if cr > 0 else round(secs * rate))}/{a.budget}")
    log(f"done: library spent {sum(charged(t) for t in ix['takes'])} of {a.budget} credits; {len(ix['sounds'])} playable sounds from {len(ix['takes'])} takes")

if __name__ == "__main__":
    main()
