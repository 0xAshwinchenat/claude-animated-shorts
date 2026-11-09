#!/usr/bin/env bash
# usage: itchdl.sh <user> <game-slug> <outdir> [upload-name-substring]
# free "name your own price" flow (same as clicking "No thanks, just take me to the downloads"); no login
set -e
U=$1; G=$2; OUT=$3; PICK=${4:-Standard}
P=/d/youtube/assetkit_src/_pages; CJ=$P/cj_${U}_$G.txt
mkdir -p "$OUT"
curl -sL "https://$U.itch.io/$G/purchase" -b $CJ -c $CJ -o $P/purchase_${U}_$G.html
TOK=$(grep -o 'name="csrf_token" value="[^"]*"' $P/purchase_${U}_$G.html | head -1 | sed 's/.*value="//;s/"$//')
DURL=$(curl -s -X POST "https://$U.itch.io/$G/download_url" -b $CJ -c $CJ --data-urlencode "csrf_token=$TOK" -H "X-Requested-With: XMLHttpRequest" | python -I -c "import json,sys;print(json.load(sys.stdin)['url'])")
echo "dl page: $DURL"
curl -sL "$DURL" -b $CJ -c $CJ -o $P/dl_${U}_$G.html
KEY=$(echo "$DURL" | sed 's#.*/download/##')
python -I -c "
import re,sys
h=open(sys.argv[1],encoding='utf8').read()
for m in re.finditer(r'data-upload_id=\"(\d+)\"(.*?)file_size\"><span>([^<]*)<',h,re.S):
    nm=re.search(r'class=\"name\"[^>]*>([^<]*)<',m.group(2)) or re.search(r'title=\"([^\"]*)\"',m.group(2))
    print(m.group(1)+'	'+nm.group(1)+'	'+m.group(3))
" $P/dl_${U}_$G.html > $P/uploads_${U}_$G.tsv
cat $P/uploads_${U}_$G.tsv
grep -i -- "$PICK" $P/uploads_${U}_$G.tsv | while IFS=$'\t' read ID NAME SIZE; do
  TOK2=$(grep -o 'name="csrf_token" value="[^"]*"' $P/dl_${U}_$G.html | head -1 | sed 's/.*value="//;s/"$//')
  R=$(curl -s -X POST "https://$U.itch.io/$G/file/$ID?source=game_download" -b $CJ -c $CJ --data-urlencode "csrf_token=$TOK2" -H "X-Requested-With: XMLHttpRequest"); echo "resp: ${R:0:200}"
  FURL=$(echo "$R" | python -I -c "import json,sys;print(json.load(sys.stdin)['url'])")
  echo "downloading $NAME ($SIZE)"
  SAFE=$(echo -n "$NAME" | tr -c "A-Za-z0-9._-" "_"); curl -sL "$FURL" -o "$OUT/$SAFE"
  ls -la "$OUT/$SAFE"
done
