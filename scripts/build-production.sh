#!/usr/bin/env bash
# production(가화만사성, com.bumojasik.app) Play 업로드용 AAB 와 확인용 APK 를 만든다.
#   사용: scripts/build-production.sh
#   결과: app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab (Play Console 에 올림)
#         app/android/app/build/outputs/apk/production/release/app-production-release.apk
# 멈추는 경우(의도한 안전장치):
#   - app/env/production.env 가 없음(예시 값으로 출시 빌드를 만들지 않음)
#   - release 서명 설정(BUMOJASIK_UPLOAD_*)이 없음(debug 키로 서명된 출시 빌드를 만들지 않음)
#   - 커밋 안 된 변경이 있음(versionCode=커밋 수라 같은 번호로 다른 내용이 나가지 않게)
#   - main 이 아닌데 BUMOJASIK_VERSION_CODE 를 주지 않음
#   - 새 versionCode 가 app/android/release-versions.txt 의 마지막 출시 번호보다 크지 않음
# 사용법: docs/team/RELEASE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=env.sh
source "$ROOT/scripts/env.sh"
HISTORY="$ROOT/app/android/release-versions.txt"

if [[ ! -f "$ROOT/app/env/production.env" ]]; then
  echo "중단: app/env/production.env 가 없어요. production.env.example 을 복사해 실제 공개 값을 채우세요." >&2
  exit 1
fi
if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "중단: 커밋 안 된 변경이 있어요. 커밋한 상태에서 빌드하세요(versionCode = git 커밋 수)." >&2
  exit 1
fi

# versionCode: main 은 커밋 수, 그 밖의 브랜치는 번호를 직접 정해야 한다(커밋 수가 작아 역행할 수 있음)
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "main" ]]; then
  CODE="${BUMOJASIK_VERSION_CODE:-$(git -C "$ROOT" rev-list --count HEAD)}"
elif [[ -n "${BUMOJASIK_VERSION_CODE:-}" ]]; then
  CODE="$BUMOJASIK_VERSION_CODE"
  echo "주의: '$BRANCH' 브랜치에서 versionCode=$CODE 로 빌드합니다."
else
  echo "중단: main 이 아니에요('$BRANCH'). 출시 빌드는 main 에서, 꼭 필요하면 BUMOJASIK_VERSION_CODE=<번호> 를 주세요." >&2
  exit 1
fi
if [[ ! "$CODE" =~ ^[0-9]+$ ]]; then
  echo "중단: versionCode 가 숫자가 아니에요: '$CODE'" >&2
  exit 1
fi
LAST="$( (grep -E '^[0-9]+' "$HISTORY" 2>/dev/null || true) | awk '{print $1}' | sort -n | tail -1)"
if [[ -n "$LAST" && "$CODE" -le "$LAST" ]]; then
  echo "중단: 새 versionCode $CODE 가 마지막 출시 번호 $LAST 보다 크지 않아요(Play 가 거부). app/android/release-versions.txt 확인." >&2
  exit 1
fi

cd "$ROOT/app/android"
./gradlew -PrequireRealEnv -PrequireReleaseSigning -PversionCode="$CODE" bundleProductionRelease assembleProductionRelease "$@"

NAME="$(node -p "require('$ROOT/app/package.json').version")"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
echo
echo "완료: versionCode $CODE, versionName $NAME ($SHA)"
echo "  AAB(Play 업로드): $ROOT/app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab"
echo "  APK(확인용):      $ROOT/app/android/app/build/outputs/apk/production/release/app-production-release.apk"
echo
echo "Play Console 에 올린 뒤 출시 기록을 남기고 커밋하세요(다음 빌드가 이 번호보다 커야 함):"
echo "  echo \"$CODE $NAME $(date +%F) $SHA\" >> app/android/release-versions.txt && git add app/android/release-versions.txt && git commit -m \"release: $NAME ($CODE)\""
