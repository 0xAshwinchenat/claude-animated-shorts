#!/usr/bin/env bash
# Final assembly of a short (Git Bash). Env: NAME (e.g. kaifeng), COMP (e.g. Kaifeng), PROJECT (Remotion root),
# KIT (the short's kit folder with audio/mix.wav + captions/), BIGTMP (temp on a big drive), CHROME (browser exe).
#   1. render the 120 fps comp <COMP>ShortHQ at 2K (1440x2560): 4 sub-frames per story frame
#   2. ffmpeg tmix=4 -> 30 fps with real shutter motion blur
#   3. mux the mix (Remotion writes a silent track: map video from 1, audio from 2)
#   4. burn the word captions (captions.ass, Arial Black copied into captions/fonts)
set -euo pipefail
: "${NAME:?set NAME}" "${COMP:?set COMP}"
PROJECT=${PROJECT:-$PWD}; KIT=${KIT:-$PROJECT/$NAME-short}; BIGTMP=${BIGTMP:-D:/remotion-tmp}
CHROME=${CHROME:-"C:/Program Files/Google/Chrome/Application/chrome.exe"}
cd "$PROJECT"; export TEMP="$BIGTMP" TMP="$BIGTMP"; OUT=out/$NAME; mkdir -p $OUT
if [ ! -f $OUT/hq120.mp4 ] || [ "${FORCE:-0}" = 1 ]; then
  npx remotion render src/sandboxes/$NAME/index.tsx ${COMP}ShortHQ $OUT/hq120.mp4 --scale 1.3333333333333333 --codec h264 --crf 14 \
    --concurrency ${CONC:-3} --timeout 240000 --gl angle --browser-executable "$CHROME" --log error 2>&1 | tee $OUT/render_hq.log | tail -3
fi
ffmpeg -v error -y -i $OUT/hq120.mp4 -vf "tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/30/TB" -r 30 \
  -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -an $OUT/video30.mp4
ffmpeg -v error -y -i $OUT/video30.mp4 -i "$KIT/audio/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest $OUT/${NAME}_nocaptions.mp4
cd "$KIT/captions"
MSYS_NO_PATHCONV=1 ffmpeg -v error -y -i "$PROJECT/$OUT/${NAME}_nocaptions.mp4" -vf "ass=captions.ass:fontsdir=fonts" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a copy "$PROJECT/$OUT/${NAME}_final.mp4"
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate:format=duration -of compact "$PROJECT/$OUT/${NAME}_final.mp4"
