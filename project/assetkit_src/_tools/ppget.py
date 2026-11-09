# ppget.py <outdir> <publicID>...   : fetch poly.pizza model page (license/creator/title) + its GLB, save meta json
import sys, os, re, json, subprocess
sys.stdout.reconfigure(encoding='utf-8')
out = sys.argv[1]
for pid in sys.argv[2:]:
    d = os.path.join(out, pid); os.makedirs(d, exist_ok=True)
    page = os.path.join(d, 'page.html')
    subprocess.run(['curl', '-sL', '-o', page, f'https://poly.pizza/m/{pid}'])
    h = open(page, encoding='utf8', errors='replace').read()
    i = h.find('window.__SERVER_APP_STATE__ = ')
    st = json.loads(h[i+30:h.find('</script>', i)].rstrip().rstrip(';'))
    m = st['initialData']
    md = m.get('model') or m.get('Model') or m
    # find the dict holding "Licence"
    def find(o):
        if isinstance(o, dict):
            if 'Licence' in o: return o
            for v in o.values():
                r = find(v)
                if r: return r
        elif isinstance(o, list):
            for v in o:
                r = find(v)
                if r: return r
    md = find(st)
    glbs = sorted(set(re.findall(r'https://static.poly.pizza/[0-9a-f-]{36}\.glb', h)))
    meta = {k: md.get(k) for k in ['Title', 'Tris', 'UploadDate', 'Licence', 'Animated', 'Tri Count', 'TriCount', 'Type', 'Tags', 'Category'] if k in md}
    cr = md.get('Creator') or md.get('creator') or {}
    meta['creator'] = cr.get('Username') if isinstance(cr, dict) else cr
    meta['url'] = f'https://poly.pizza/m/{pid}'; meta['glb'] = glbs
    if glbs:
        subprocess.run(['curl', '-sL', '-o', os.path.join(d, 'model.glb'), glbs[0]])
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    print(pid, meta.get('Title'), meta.get('Licence'), meta.get('creator'), meta.get('Animated'), os.path.getsize(os.path.join(d, 'model.glb')) if glbs else 'NO GLB')
