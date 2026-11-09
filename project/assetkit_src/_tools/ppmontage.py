# ppmontage.py <all.tsv> <out.jpg> <regex on creator|title> [maxn]
import sys, re, os, subprocess, io
from PIL import Image, ImageDraw
rows=[l.rstrip('\n').split('\t') for l in open(sys.argv[1],encoding='utf8') if l.strip()]
rx=re.compile(sys.argv[3], re.I); maxn=int(sys.argv[4]) if len(sys.argv)>4 else 60
sel=[r for r in rows if len(r)>=5 and rx.search(r[0]+'|'+r[2]+'|'+r[3]+'|'+r[1])][:maxn]
S=180; cols=8; n=len(sel); R=(n+cols-1)//cols
M=Image.new('RGB',(cols*S,R*(S+28)),(235,235,235)); g=ImageDraw.Draw(M)
cache='D:/youtube/assetkit_src/_pages/pp/prev'; os.makedirs(cache,exist_ok=True)
for i,r in enumerate(sel):
    pid,lic,cr,title,url=r[:5]
    fp=os.path.join(cache,pid+'.webp')
    if not os.path.exists(fp):
        subprocess.run(['curl','-s','-f','-o',fp,url])
        if not os.path.exists(fp): print('fail',pid); continue
    try: im=Image.open(fp).convert('RGB'); im.thumbnail((S,S))
    except Exception as e: print('bad',pid,e); continue
    x=(i%cols)*S; y=(i//cols)*(S+28); M.paste(im,(x,y+28))
    g.text((x+2,y+1),f'{i}:{title[:24]}',fill=(0,0,0)); g.text((x+2,y+13),f'{cr[:14]} {lic.replace(" 1.0","").replace(" 3.0","")} {pid}',fill=(120,0,0))
M.save(sys.argv[2],quality=88)
for i,r in enumerate(sel): print(i,*r[:4],sep=' | ')
