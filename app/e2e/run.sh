#!/usr/bin/env bash
# Maestro E2E 실행(에뮬레이터, fake API 디버그 빌드). 사용법·전제: app/e2e/README.md
#   app/e2e/run.sh                 # flows/ 전부
#   app/e2e/run.sh flows/parent-first-connect.yaml
# 환경변수: AVD(기본 gahwa_parent) · METRO_PORT(기본 8081) · SKIP_INSTALL=1 · SKIP_BUILD=1
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$E2E_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"

# shellcheck source=/dev/null
source "$ROOT_DIR/scripts/env.sh"
export PATH="$ANDROID_HOME/emulator:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

AVD="${AVD:-gahwa_parent}"
METRO_PORT="${METRO_PORT:-8081}"
APP_ID="com.bumojasik.app.staging"
APK="$APP_DIR/android/app/build/outputs/apk/staging/debug/app-staging-debug.apk"
OUT_DIR="$E2E_DIR/out/$(date +%Y%m%d-%H%M%S)"

fail() { echo "e2e: $*" >&2; exit 1; }

command -v maestro >/dev/null || fail "maestro 가 없어요. README '설치' 절을 따라 ~/.maestro 에 설치하세요."

# 1) fake 모드 확인: flow 는 fake 코드 규칙(123456 성공)에 기대므로 config.local.ts 가 fake 여야 한다
LOCAL_CFG="$APP_DIR/src/lib/config.local.ts"
[ -f "$LOCAL_CFG" ] || fail "src/lib/config.local.ts 가 없어요: cp src/lib/config.local.example.ts src/lib/config.local.ts (기본 fake)"
grep -Eq "API_MODE:[[:space:]]*'fake'" "$LOCAL_CFG" || fail "config.local.ts 의 API_MODE 가 'fake' 가 아니에요(E2E 는 fake 전용)."

# 2) 기기: 연결된 기기가 없으면 AVD 를 화면 없이 켠다
if ! adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  echo "e2e: 에뮬레이터 $AVD 시작(화면 없음)"
  nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot-save >"$E2E_DIR/out-emulator.log" 2>&1 &
  adb wait-for-device
fi
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

# 3) 빌드·설치(stagingDebug = JS 는 Metro 에서 받음)
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  if [ "${SKIP_BUILD:-0}" != "1" ] || [ ! -f "$APK" ]; then
    # 기기 ABI 하나만 빌드(전 ABI 빌드보다 훨씬 빠름)
    ABI="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
    (cd "$APP_DIR/android" && ./gradlew assembleStagingDebug --console=plain -q -PreactNativeArchitectures="$ABI")
  fi
  adb install -r "$APK" >/dev/null
fi

# 4) Metro: 기기의 localhost:8081 → 맥의 METRO_PORT. 이미 떠 있으면 그대로 쓴다
adb reverse tcp:8081 "tcp:$METRO_PORT" >/dev/null
METRO_PID=""
if ! curl -fs "http://localhost:$METRO_PORT/status" | grep -q running; then
  echo "e2e: Metro 시작(port $METRO_PORT)"
  (cd "$APP_DIR" && nohup npx react-native start --port "$METRO_PORT" >"$E2E_DIR/out-metro.log" 2>&1) &
  METRO_PID=$!
  for _ in $(seq 1 60); do curl -fs "http://localhost:$METRO_PORT/status" | grep -q running && break; sleep 1; done
fi
# 첫 번들은 30초 넘게 걸릴 수 있어 flow 시작 전에 미리 만든다(첫 화면 대기 시간 초과 방지)
curl -fs "http://localhost:$METRO_PORT/index.bundle?platform=android&dev=true&minify=false" -o /dev/null || fail "Metro 번들을 만들지 못했어요(out-metro.log)"
cleanup() { if [ -n "$METRO_PID" ]; then pkill -P "$METRO_PID" 2>/dev/null || true; kill "$METRO_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT

# 5) 감사용 기기 설정(선택, 끝나면 되돌림): DP_SIZE=360x640 · FONT_SCALE=2.0 · REDUCE_MOTION=1
restore_device() {
  adb shell wm size reset >/dev/null 2>&1 || true
  adb shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$k" 1 >/dev/null 2>&1 || true
  done
}
if [ -n "${DP_SIZE:-}" ] || [ -n "${FONT_SCALE:-}" ] || [ "${REDUCE_MOTION:-0}" = "1" ]; then
  trap 'restore_device; cleanup' EXIT
fi
if [ -n "${DP_SIZE:-}" ]; then
  DENSITY="$(adb shell wm density | tail -1 | grep -oE '[0-9]+$')"
  W_DP="${DP_SIZE%x*}"; H_DP="${DP_SIZE#*x}"
  adb shell wm size "$((W_DP * DENSITY / 160))x$((H_DP * DENSITY / 160))"
  echo "e2e: 화면 ${DP_SIZE}dp (density $DENSITY)"
fi
if [ -n "${FONT_SCALE:-}" ]; then
  adb shell settings put system font_scale "$FONT_SCALE"
  echo "e2e: 글자 배율 $FONT_SCALE"
fi
if [ "${REDUCE_MOTION:-0}" = "1" ]; then
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$k" 0
  done
  echo "e2e: 동작 줄이기(애니메이션 0)"
fi

# 6) 실행. 캡처는 기기 화면만(맥 화면을 찍지 않음) → out/<시각>/
mkdir -p "$OUT_DIR"
cd "$E2E_DIR"
TARGETS=("$@")
[ ${#TARGETS[@]} -gt 0 ] || TARGETS=(flows)
maestro test "${TARGETS[@]}" --test-output-dir "$OUT_DIR" --format junit --output "$OUT_DIR/report.xml"
echo "e2e: 통과. 캡처·보고서: $OUT_DIR"
