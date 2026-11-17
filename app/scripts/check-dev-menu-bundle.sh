#!/usr/bin/env bash
# 출시(release) 번들에 개발 전용 코드·계정이 없는지 확인한다(보안 리뷰 2026-11-18 H1·M1, metroDevMenu.js).
# Gradle 처럼 src/lib/env.generated.ts 를 잠시 써서(release) production·staging 번들을 만들고 표식을 찾는다.
#   - 두 번들 모두: config.local 테스트 계정(devTestChild)·테스트 도메인 이메일(@*.test, @example.*)·config.local 의 문자열 값이
#     없어야 한다(라이브러리 package.json 작성자 주소 등 일반 이메일은 보지 않는다). config.local.ts 가 없으면 카나리아 계정을 잠시 둔다
#   - production: 개발자 메뉴 표식이 없어야 한다 / staging: 있어야 한다(검사가 살아 있는지)
# 실제 출시물 검사는 Gradle release 번들 작업 뒤 verifyReleaseBundle 이 한다. 사용: (app 폴더에서) npm run check:dev-menu
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
GEN=src/lib/env.generated.ts
LOCAL=src/lib/config.local.ts
BACKUP="$OUT/env.generated.backup"
CANARY=0
[ -f "$GEN" ] && cp "$GEN" "$BACKUP"
if [ ! -f "$LOCAL" ]; then
  CANARY=1
  printf "const local = {};\nexport default local;\nexport const devTestChild = {email: 'canary-leak@leak.test', password: 'CANARY-PW-7f3a'};\n" > "$LOCAL"
fi
cleanup() {
  if [ -f "$BACKUP" ]; then cp "$BACKUP" "$GEN"; else rm -f "$GEN"; fi
  [ "$CANARY" = 1 ] && rm -f "$LOCAL"
  rm -rf "$OUT"
}
trap cleanup EXIT
# config.local 의 문자열 값(6자 이상) — 서버 주소·키·계정이 번들에 들어가면 안 된다
LOCAL_VALUES=$(grep -Eo "['\"][^'\"]{6,}['\"]" "$LOCAL" | tr -d "'\"" | grep -Ev '^(fake|real)$' || true)

DEV_MARKERS='bumojasik-dev-menu-impl|dev_menu_session_|createTestFamily'
SECRET_MARKERS='devTestChild|CANARY-PW-7f3a|canary-leak'
EMAIL_ALLOW='^name@example\.com$'
TEST_EMAIL='[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*(example\.(test|com|org)|[A-Za-z0-9-]+\.test)'

bundle() {
  printf 'export default {\n  "APP_ENV": "%s",\n  "API_MODE": "real",\n  "BUILD_TYPE": "release"\n};\n' "$1" > "$GEN"
  npx react-native bundle --platform android --dev false --minify true \
    --entry-file index.js --bundle-output "$OUT/$1.bundle.js" --reset-cache >/dev/null 2>&1
}

fail=0
for env in production staging; do
  bundle "$env"
  f="$OUT/$env.bundle.js"
  if grep -Eq "$SECRET_MARKERS" "$f"; then
    echo "실패: $env 번들에 config.local 테스트 계정 표식이 있어요" >&2
    fail=1
  fi
  emails=$(grep -Eao "$TEST_EMAIL" "$f" | sort -u | grep -Ev "$EMAIL_ALLOW" || true)
  while IFS= read -r v; do
    [ -n "$v" ] && grep -Fq -- "$v" "$f" && { echo "실패: $env 번들에 config.local 값이 있어요(${#v}자)" >&2; fail=1; }
  done <<< "$LOCAL_VALUES"
  if [ -n "$emails" ]; then
    echo "실패: $env 번들에 테스트 도메인 이메일이 있어요: $(echo "$emails" | sed 's/^[^@]*/***/' | tr '\n' ' ')" >&2
    fail=1
  fi
done
if grep -Eq "$DEV_MARKERS" "$OUT/production.bundle.js"; then
  echo "실패: production 번들에 개발자 메뉴 코드가 있어요" >&2
  fail=1
fi
if ! grep -Eq "$DEV_MARKERS" "$OUT/staging.bundle.js"; then
  echo "실패: staging 번들에 개발자 메뉴가 없어요(검사 표식이 바뀌었는지 확인)" >&2
  fail=1
fi
[ "$fail" = 0 ] || exit 1
echo "통과: release 번들에 테스트 계정·이메일 없음, production 에 개발자 메뉴 없음, staging 에는 있음"
