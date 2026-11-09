#!/usr/bin/env bash
# DEFAULT 2K final (Git Bash). One long HQ render runs Chrome out of RAM, and long 2K WebGL sessions lose textures
# (black sky / ground) or go pure WHITE at random (babushka, lastride, pigs, 2026-11-08). So:
#   1. render the 120 fps comp <COMP>ShortHQ in short chunks (CHUNK HQ frames, a multiple of 4; a fresh Chrome per
#      chunk is also faster per frame), skipping chunks already rendered;
#   2. check every chunk frame by frame against out/<name>/preview1.mp4 with check_piece.py; re-render a faulty chunk
#      (3 tries);
#   3. decode + concat all chunks INSIDE the one tmix encode (never `-c copy` concat Remotion chunks: seam decode errors)
#      -> tmix=4 motion blur (180 deg shutter: the HQ comp samples n + k/8) -> cas 0.4 sharpen -> 30 fps -> mux mix.wav -> burn captions.
# Env: NAME, COMP, CHUNK (default 320), CONC (default 2), PREV (reference preview, default out/<name>/preview1.mp4; it
# must be the CURRENT timing), CHECK (default 1; 0 skips step 2, e.g. when a camera was
# re-keyed after the preview and check_piece false-flags: then look at that chunk's frames yourself).
# After it finishes, still scan the whole final vs preview1 and look at contact sheets before delivering.
set -uo pipefail
: "${NAME:?set NAME}" "${COMP:?set COMP}"
PROJECT=${PROJECT:-$(pwd -W 2>/dev/null || pwd)}; KIT=${KIT:-$PROJECT/$NAME-short}; BIGTMP=${BIGTMP:-D:/remotion-tmp}
CHROME=${CHROME:-"C:/Program Files/Google/Chrome/Application/chrome.exe"}
cd "$PROJECT"; export TEMP="$BIGTMP" TMP="$BIGTMP"; OUT=out/$NAME; C=$OUT/chunks; mkdir -p $C
# film length: FRAMES, else FILM_TOTAL of a voice re-time (src/videos/<name>/warp.ts), else story.ts TOTAL
WARPTS=src/videos/$NAME/warp.ts
TOTAL=${FRAMES:-$( { [ -f $WARPTS ] && grep -oE "export const FILM_TOTAL = [0-9]+" $WARPTS; } || grep -oE "export const TOTAL = [0-9]+" src/videos/$NAME/story.ts)}
TOTAL=${TOTAL##* }; [ -n "$TOTAL" ] || { echo "cannot read the film length: set FRAMES=<film frames>"; exit 1; }
HQN=$((TOTAL * 4)); echo "film $TOTAL frames -> $HQN HQ frames"
CHUNK=${CHUNK:-320}; CHECK=${CHECK:-1}; PREV=${PREV:-$OUT/preview1.mp4}
[ $((CHUNK % 4)) = 0 ] || { echo "CHUNK must be a multiple of 4"; exit 1; }
if [ "$CHECK" = 1 ] && [ ! -f $PREV ]; then echo "no $PREV: render the preview first or set CHECK=0"; exit 1; fi
check() { [ "$CHECK" = 1 ] || return 0; python "$KIT/check_piece.py" "$1" "$2" $PREV "$3"; }
IN=""; FC=""; L=""; n=0
for ((a = 0; a < HQN; a += CHUNK)); do
  b=$((a + CHUNK - 1)); [ $b -ge $HQN ] && b=$((HQN - 1)); want=$((b - a + 1))
  f=$C/hq_$(printf %05d $a).mp4; ok=0
  if [ -f $f ] && check $f $a $want > /dev/null; then ok=1; fi
  for try in 1 2 3; do
    [ $ok = 1 ] && break
    echo "[$(date +%H:%M:%S)] chunk $a-$b (try $try)"; rm -f $f $f.part.mp4
    npx remotion render src/sandboxes/$NAME/index.tsx ${COMP}ShortHQ $f.part.mp4 --frames=$a-$b --scale 1.3333333333333333 \
      --codec h264 --crf 14 --concurrency ${CONC:-2} --timeout 240000 --gl angle --browser-executable "$CHROME" --log error >> $OUT/render_hq.log 2>&1
    [ -f $f.part.mp4 ] || { echo "  render failed: $(tail -1 $OUT/render_hq.log)"; sleep 20; continue; }
    mv $f.part.mp4 $f
    check $f $a $want && ok=1
  done
  [ $ok = 1 ] || { echo "chunk $a-$b FAILED 3 times"; exit 1; }
  IN="$IN -i $f"; FC="$FC[$n:v]setpts=PTS-STARTPTS[v$n];"; L="$L[v$n]"; n=$((n + 1))
done
echo "[$(date +%H:%M:%S)] assemble $n chunks"
FC="$FC${L}concat=n=$n:v=1:a=0,tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/30/TB,cas=0.4[v]"
ffmpeg -v error -y $IN -filter_complex "$FC" -map "[v]" -r 30 -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -an $OUT/video30.mp4 || exit 1
ffmpeg -v error -y -i $OUT/video30.mp4 -i "$KIT/audio/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest $OUT/${NAME}_nocaptions.mp4 || exit 1
cd "$KIT/captions"
MSYS_NO_PATHCONV=1 ffmpeg -v error -y -i "$PROJECT/$OUT/${NAME}_nocaptions.mp4" -vf "ass=captions.ass:fontsdir=fonts" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a copy "$PROJECT/$OUT/${NAME}_final.mp4" || exit 1
cd "$PROJECT"
ffprobe -v error -count_packets -show_entries stream=codec_type,width,height,nb_read_packets:format=duration -of compact $OUT/${NAME}_final.mp4
echo "[$(date +%H:%M:%S)] DONE"
