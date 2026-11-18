#!/usr/bin/env bash
# 출시(release) 번들에 개발 전용 코드·계정이 없는지 확인한다(보안 리뷰 2026-11-18 H1·M1·R3, metro.release.config.js).
# 작업 트리는 건드리지 않는다(재검토 R3): 앱 소스를 임시 폴더로 복사하고(node_modules 는 링크) 그곳에 release 값의
# env.generated.ts 와 카나리아 config.local.ts 를 써서 Gradle 과 같은 설정(metro.release.config.js)으로 번들한다.
#   - 두 번들 모두: config.local 테스트 계정(devTestChild)·카나리아 값·테스트 도메인 이메일(@*.test, @example.*)이 없어야 한다
#   - production: 개발자 메뉴 표식이 없어야 한다 / staging: 있어야 한다(검사가 살아 있는지)
# 실제 출시물 검사는 Gradle release 번들 작업 뒤 verifyReleaseBundle 이 한다. 사용: (app 폴더에서) npm run check:dev-menu
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
WORK="$TMP/app"
OUT="$TMP/out"
mkdir -p "$WORK" "$OUT"
rsync -a --exclude node_modules --exclude android --exclude ios --exclude __tests__ --exclude __integration__ \
  --exclude 'src/lib/config.local.ts' --exclude 'src/lib/env.generated.ts' "$APP/" "$WORK/"
ln -s "$(cd "$APP/node_modules" && pwd -P)" "$WORK/node_modules"
printf "const local = {};\nexport default local;\nexport const devTestChild = {email: 'canary-leak@leak.test', password: 'CANARY-PW-7f3a'};\n" > "$WORK/src/lib/config.local.ts"

DEV_MARKERS='bumojasik-dev-menu-impl|dev_menu_session_|createTestFamily'
SECRET_MARKERS='devTestChild|CANARY-PW-7f3a|canary-leak'
EMAIL_ALLOW='^name@example\.com$'
TEST_EMAIL='[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*(example\.(test|com|org)|[A-Za-z0-9-]+\.test)'

bundle() {
  printf 'export default {\n  "APP_ENV": "%s",\n  "API_MODE": "real",\n  "BUILD_TYPE": "release"\n};\n' "$1" > "$WORK/src/lib/env.generated.ts"
  (cd "$WORK" && npx react-native bundle --config metro.release.config.js --platform android --dev false --minify true \
    --entry-file index.js --bundle-output "$OUT/$1.bundle.js" --reset-cache >/dev/null 2>&1)
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
echo "통과: release 번들에 테스트 계정·이메일 없음, production 에 개발자 메뉴 없음, staging 에는 있음(작업 트리 변경 없음)"
