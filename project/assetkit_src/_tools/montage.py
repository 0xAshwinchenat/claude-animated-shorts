import sys, os
from PIL import Image, ImageDraw
d=sys.argv[1]; out=sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 8
fs=sorted(f for f in os.listdir(d) if f.lower().endswith(('.png','.jpg')))
S=200; rows=(len(fs)+cols-1)//cols
M=Image.new('RGB',(cols*S,rows*(S+16)),(40,40,40)); g=ImageDraw.Draw(M)
for i,f in enumerate(fs):
    im=Image.open(os.path.join(d,f)).convert('RGB').resize((S,S))
    x=(i%cols)*S; y=(i//cols)*(S+16); M.paste(im,(x,y+16)); g.text((x+3,y+2),f.rsplit('.',1)[0],fill=(255,255,255))
M.save(out)
