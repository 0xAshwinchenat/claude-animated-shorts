# list a public Drive folder through embeddedfolderview HTML: id <TAB> title  (files and subfolders)
import re, sys
h = open(sys.argv[1], encoding='utf8').read()
for fid, title in re.findall(r'href="https://drive.google.com/(?:file/d/|drive/folders/)([A-Za-z0-9_-]+)[^"]*".*?flip-entry-title">([^<]*)<', h, re.S):
    print(fid, title, sep='\t')
