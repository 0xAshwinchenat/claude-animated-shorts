import re,sys
h=open(sys.argv[1],encoding='utf8').read()
pat=sys.argv[2]
n=int(sys.argv[3]) if len(sys.argv)>3 else 200
for m in re.finditer(pat,h):
    s=m.start(); print(re.sub(r'\s+',' ',h[max(0,s-n):s+n])); print('----')
