# Merge a short's helper sandboxes back into the main project by OWNED files (backs main up first).
# Usage (from the Remotion project root): python scripts/short_merge.py <name> [wall,camp,char,venue]
# Sandboxes: src/videos/<name>_<owner>/ ; main: src/videos/<name>/ ; backups: backup/<name>_<time>/
import os, shutil, sys, time, filecmp
ROOT = os.environ.get("PROJECT", os.getcwd())
name = sys.argv[1]
MAIN = os.path.join(ROOT, "src/videos", name)
OWN = {
    "wall": ["siege.ts", "paintw.ts"],                                       # the main place: walls / town / sets
    "camp": ["camp.ts", "paintc.ts"],                                        # the second place: machines, projectiles, fx props
    "char": ["chars.ts", "cast.ts", "toon.ts", "toon3d.ts", "cardshade.ts"], # 3D cast + card crowds + effect cards
    "venue": ["venues.ts", "paintv.ts"],                                     # explanation venues (inserts, macro, cutaways)
}
which = sys.argv[2].split(",") if len(sys.argv) > 2 else list(OWN)
bak = os.path.join(ROOT, "backup", time.strftime(f"{name}_%Y%m%d_%H%M%S"))
shutil.copytree(MAIN, bak); print("backup ->", bak)
for box in which:
    src = os.path.join(ROOT, "src/videos", f"{name}_{box}")
    for f in OWN[box]:
        a, b = os.path.join(src, f), os.path.join(MAIN, f)
        if not os.path.exists(a): print(f"  {box}: {f} missing"); continue
        if os.path.exists(b) and filecmp.cmp(a, b, shallow=False): print(f"  {box}: {f} unchanged"); continue
        shutil.copy2(a, b); print(f"  {box}: {f} -> main")
