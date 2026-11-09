#!/usr/bin/env bash
# usage: gddl.sh <listing.tsv> <outdir> <grep -E regex on names>   (public Drive files, anonymous download)
set -e
L=$1; OUT=$2; RX=$3
mkdir -p "$OUT"
grep -E -- "$RX" "$L" | while IFS=$'\t' read ID NAME; do
  SAFE=$(echo -n "$NAME" | tr -c "A-Za-z0-9._-" "_")
  [ -s "$OUT/$SAFE" ] && continue
  curl -sL "https://drive.usercontent.google.com/download?id=$ID&export=download&confirm=t" -o "$OUT/$SAFE"
  echo "$SAFE $(stat -c %s "$OUT/$SAFE")"
done
