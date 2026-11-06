# Labelled contact sheet of stills: python scripts/sheet.py <out.jpg> <prefix> <frames comma-separated> [cols] [width]
# e.g. python scripts/sheet.py out/kaifeng/s.jpg out/kaifeng/p2_ 620,660,700 10 200   (reads <prefix><frame>.jpg)
import sys
from PIL import Image, ImageDraw
out, prefix, frames = sys.argv[1], sys.argv[2], [f for f in sys.argv[3].split(",") if f]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
w = int(sys.argv[5]) if len(sys.argv) > 5 else 200
ims = []
for f in frames:
    im = Image.open(f"{prefix}{f}.jpg").convert("RGB")
    im = im.resize((w, round(im.height * w / im.width)))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 * len(f) + 10, 18], fill=(0, 0, 0)); d.text((5, 3), f, fill=(255, 255, 255))
    ims.append(im)
h = ims[0].height; rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * h), (30, 30, 30))
for k, im in enumerate(ims): S.paste(im, ((k % cols) * w, (k // cols) * h))
S.save(out, quality=88)
print(out, S.size)
