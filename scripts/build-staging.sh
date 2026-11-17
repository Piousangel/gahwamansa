#!/usr/bin/env bash
# 스테이징(테스트 가화만사성, com.bumojasik.app.staging) release APK 를 만든다. Play 에는 올리지 않는다(adb·App Distribution).
#   사용: scripts/build-staging.sh
#   결과: app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
# 서명: ~/.gradle/gradle.properties 의 BUMOJASIK_UPLOAD_* (없으면 debug 키 + 경고). 사용법: docs/team/RELEASE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=env.sh
source "$ROOT/scripts/env.sh"

cd "$ROOT/app/android"
./gradlew assembleStagingRelease "$@"

APK="$ROOT/app/android/app/build/outputs/apk/staging/release/app-staging-release.apk"
echo
echo "완료: $APK"
echo "설치(연결된 기기 1대): adb install -r \"$APK\""
