# parse a saved poly.pizza search page: prints publicID, licence, creator, title, previewUrl
import re, json, sys
sys.stdout.reconfigure(encoding="utf-8")
h = open(sys.argv[1], encoding='utf8').read()
i = h.find('window.__SERVER_APP_STATE__ = ')
if i < 0: sys.exit(0)
i += len('window.__SERVER_APP_STATE__ = '); j = h.find('</script>', i)
d = json.loads(h[i:j].rstrip().rstrip(';'))
for r in d.get('initialData', {}).get('result', []):
    print(r['publicID'], r.get('licence'), r['creator']['username'], r['title'], r.get('previewUrl'), sep='\t')
