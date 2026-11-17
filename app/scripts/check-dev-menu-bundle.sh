#!/usr/bin/env bash
# 개발자 메뉴가 production JS 번들에 없는지 확인한다(보안 검사, metroDevMenu.js).
# production·staging 번들을 각각 만들어 표식 문자열을 찾는다: production 에는 없어야 하고, staging 에는 있어야 한다(검사가 살아 있는지).
# 사용: (app 폴더에서) npm run check:dev-menu
set -euo pipefail
cd "$(dirname "$0")/.."
# 번들은 저장소 밖 임시 폴더에(lint·git 이 보지 않게), 끝나면 지운다
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
MARKERS='bumojasik-dev-menu-impl|dev_menu_session_|createTestFamily'

bundle() {
  BUMOJASIK_BUNDLE_APP_ENV="$1" npx react-native bundle --platform android --dev false --minify false \
    --entry-file index.js --bundle-output "$OUT/$1.bundle.js" --reset-cache >/dev/null
}

bundle production
bundle staging

if grep -Eq "$MARKERS" "$OUT/production.bundle.js"; then
  echo "실패: production 번들에 개발자 메뉴 코드가 있어요" >&2
  grep -Eo "$MARKERS" "$OUT/production.bundle.js" | sort -u >&2
  exit 1
fi
if ! grep -Eq "$MARKERS" "$OUT/staging.bundle.js"; then
  echo "실패: staging 번들에 개발자 메뉴가 없어요(검사 표식이 바뀌었는지 확인)" >&2
  exit 1
fi
echo "통과: production 번들에 개발자 메뉴 없음, staging 번들에는 있음"
