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
# 앱 안 심볼(D안 3D, JS 대기 화면·첫 화면 이동·워드마크 옆). "sh render.sh app" 이면 이것만 렌더
# 164dp: 네이티브 스플래시(splash_icon, 288 캔버스에 심볼 64상자를 164dp)와 같은 크기 → 전환 때 그림·크기가 바뀌지 않게
app_pngs() {
  for s in 1 2 3; do
    sfx=$([ $s = 1 ] && echo "" || echo "@${s}x")
    png $B/symbol-3d.svg $B/png/symbol-3d-164$sfx.png $((164 * s))
    png $B/symbol-3d.svg $B/png/symbol-3d-40$sfx.png $((40 * s))
  done
}
if [ "$1" = app ]; then app_pngs; rm -rf "$TMP"; echo rendered app; exit 0; fi
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
app_pngs
rm -rf "$TMP"
echo rendered
