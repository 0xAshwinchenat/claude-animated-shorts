# Camera speed profile from cam_qa's per-frame CSV: one row per N frames with a bar, to tune flow keys fast.
# Usage: python scripts/cam_speed.py out/<name>/cam.csv [from] [to] [step]
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1])))
a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
b = int(sys.argv[3]) if len(sys.argv) > 3 else len(rows) - 1
st = int(sys.argv[4]) if len(sys.argv) > 4 else 3
for r in rows:
    f = int(r["f"])
    if f < a or f > b or (f - a) % st: continue
    v = float(r["v"]); beat = "*" if r.get("beat", "0") not in ("0", "") else " "
    bar = "#" * min(60, int(v / 2)) + ("+" if v > 120 else "")
    print(f"{f:5d} {v:7.1f} {beat} {bar}")
