#!/bin/sh
# SVG → PNG (헤드리스 크롬, 투명 배경). 실행: sh render.sh
set -e
B=/Users/hyunseok/Desktop/bumo-jasik/design-system/assets/brand
CH=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
TMP=$(mktemp -d)
png() { # src.svg out.png px
  mkdir -p "$(dirname "$2")"
  printf '<body style="margin:0;background:transparent"><img src="file://%s" width="%s" height="%s" style="display:block">' "$1" "$3" "$3" > "$TMP/p.html"
  "$CH" --headless --hide-scrollbars --allow-file-access-from-files --default-background-color=00000000 \
    --force-device-scale-factor=1 --window-size="$3,$3" --screenshot="$2" "file://$TMP/p.html" >/dev/null 2>&1
}
for d in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  n=${d%%:*}; f=${d##*:}
  px() { echo "$1 * $f" | bc | cut -d. -f1; }
  for v in "" staging/; do
    S=$B/android/${v}src; R=$B/android/${v}res
    png $S/ic_launcher_foreground.svg $R/mipmap-$n/ic_launcher_foreground.png $(px 108)
    png $S/ic_launcher_background.svg $R/mipmap-$n/ic_launcher_background.png $(px 108)
    png $B/android/src/ic_launcher_monochrome.svg $R/mipmap-$n/ic_launcher_monochrome.png $(px 108)
    png $S/ic_launcher.svg $R/mipmap-$n/ic_launcher.png $(px 48)
    png $S/ic_launcher_round.svg $R/mipmap-$n/ic_launcher_round.png $(px 48)
    png $S/splash_icon.svg $R/drawable-$n/splash_icon.png $(px 288)
  done
done
png $B/android/src/play_store_512.svg $B/play-store-512.png 512
png $B/symbol-flat.svg $B/png/symbol-flat-40.png 40
png $B/symbol-flat.svg $B/png/symbol-flat-40@2x.png 80
png $B/symbol-flat.svg $B/png/symbol-flat-40@3x.png 120
png $B/symbol-3d.svg $B/png/symbol-3d-512.png 512
rm -rf "$TMP"
echo rendered
