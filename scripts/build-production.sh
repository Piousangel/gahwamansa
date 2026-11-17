#!/usr/bin/env bash
# production(가화만사성, com.bumojasik.app) Play 업로드용 AAB 와 확인용 APK 를 만든다.
#   사용: scripts/build-production.sh
#   결과: app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab (Play Console 에 올림)
#         app/android/app/build/outputs/apk/production/release/app-production-release.apk
# 멈추는 경우(의도한 안전장치):
#   - app/env/production.env 가 없음(예시 값으로 출시 빌드를 만들지 않음)
#   - release 서명 설정(BUMOJASIK_UPLOAD_*)이 없음(debug 키로 서명된 출시 빌드를 만들지 않음)
#   - 커밋 안 된 변경이 있음(versionCode=커밋 수라 같은 번호로 다른 내용이 나가지 않게)
# 사용법: docs/team/RELEASE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=env.sh
source "$ROOT/scripts/env.sh"

if [[ ! -f "$ROOT/app/env/production.env" ]]; then
  echo "중단: app/env/production.env 가 없어요. production.env.example 을 복사해 실제 공개 값을 채우세요." >&2
  exit 1
fi
if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "중단: 커밋 안 된 변경이 있어요. 커밋한 상태에서 빌드하세요(versionCode = git 커밋 수)." >&2
  exit 1
fi
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "주의: 지금 브랜치는 '$BRANCH' 예요. 출시 빌드는 main 에서 만드는 것이 규칙입니다(versionCode 가 줄어들 수 있음)."
  read -r -p "그래도 계속할까요? (yes 입력): " OK
  [[ "$OK" == "yes" ]] || exit 1
fi

cd "$ROOT/app/android"
./gradlew -PrequireRealEnv -PrequireReleaseSigning bundleProductionRelease assembleProductionRelease "$@"

echo
echo "완료:"
echo "  AAB(Play 업로드): $ROOT/app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab"
echo "  APK(확인용):      $ROOT/app/android/app/build/outputs/apk/production/release/app-production-release.apk"
