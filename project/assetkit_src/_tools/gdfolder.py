# list a public Google Drive folder page: prints id <TAB> tooltip (name + type), from the rendered HTML rows
import re, sys
h = open(sys.argv[1], encoding='utf8').read()
seen = set()
for m in re.finditer(r'data-id="([A-Za-z0-9_-]{20,80})"[^>]*?data-tooltip="([^"]*)"', h):
    if m.group(1) in seen: continue
    seen.add(m.group(1)); print(m.group(1), m.group(2), sep='\t')
