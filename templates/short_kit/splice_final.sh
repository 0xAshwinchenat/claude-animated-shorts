#!/usr/bin/env bash
# Like final.sh, but swaps re-rendered 120 fps segments into hq120.mp4 inside the same single tmix encode (no extra
# generation). FIXES = "first:last:file ..." in HQ frames, sorted, non-overlapping; story frame k = HQ frames 4k..4k+3,
# so every first and last+1 must be a multiple of 4.
# Example: NAME=kaifeng FIXES="600:899:hq_fix.mp4 3856:4111:hq_fix2.mp4" bash splice_final.sh
#   (render each fix with: npx remotion render src/sandboxes/<NAME>/index.tsx <COMP>ShortHQ out/<NAME>/hq_fix.mp4 --frames=600-899 ...)
set -euo pipefail
PROJECT=${PROJECT:-$(pwd -W 2>/dev/null || pwd)}; cd "$PROJECT"   # a Windows path (D:/...): ffmpeg cannot open /d/...
: "${NAME:?set NAME}"; KIT=${KIT:-$PROJECT/$NAME-short}; OUT=out/$NAME
FIXES=${FIXES:?set FIXES="first:last:file ..."}
inputs=(); graph=""; labels=""; n=0; pos=0; idx=0
seg() { graph+="[$idx:v]$1setpts=PTS-STARTPTS[s$n];"; labels+="[s$n]"; n=$((n + 1)); idx=$((idx + 1)); }
for fx in $FIXES; do
  IFS=: read -r a b file <<< "$fx"
  (( a % 4 == 0 && (b + 1) % 4 == 0 && a >= pos )) || { echo "bad fix range $fx"; exit 1; }
  got=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 $OUT/$file | tr -dc 0-9)
  [ "$got" = $((b - a + 1)) ] || { echo "$file has $got frames, want $((b - a + 1))"; exit 1; }
  inputs+=(-i $OUT/hq120.mp4); seg "trim=start_frame=$pos:end_frame=$a,"
  inputs+=(-i $OUT/$file); seg ""
  pos=$((b + 1))
done
inputs+=(-i $OUT/hq120.mp4); seg "trim=start_frame=$pos,"
ffmpeg -v error -y "${inputs[@]}" -filter_complex \
  "$graph${labels}concat=n=$n:v=1:a=0,tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/30/TB,cas=0.4[v]" \
  -map "[v]" -r 30 -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -an $OUT/video30.mp4
ffmpeg -v error -y -i $OUT/video30.mp4 -i "$KIT/audio/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest \
  $OUT/${NAME}_nocaptions.mp4
cd "$KIT/captions"
MSYS_NO_PATHCONV=1 ffmpeg -v error -y -i $PROJECT/$OUT/${NAME}_nocaptions.mp4 -vf "ass=captions.ass:fontsdir=fonts" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a copy $PROJECT/$OUT/${NAME}_final.mp4
cd "$PROJECT"
ffprobe -v error -count_packets -show_entries stream=codec_type,width,height,r_frame_rate,nb_read_packets:format=duration -of compact $OUT/${NAME}_final.mp4
