#!/usr/bin/env bash
# Maestro E2E 실행(에뮬레이터, fake API 디버그 빌드). 사용법·전제: app/e2e/README.md
#   app/e2e/run.sh                 # flows/ 전부
#   app/e2e/run.sh flows/f1-parent-connect-course.yaml
# 환경변수: AVD(기본 gahwa_parent) · ANDROID_SERIAL(기기 고정, 예 emulator-5556) · METRO_PORT(기본 8081) · SKIP_INSTALL=1 · SKIP_BUILD=1
# 두 실행을 동시에: 서로 다른 ANDROID_SERIAL·AVD·METRO_PORT 를 준다(README 2절).
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

# 2) 기기 고정: 모든 adb·maestro 호출이 한 기기만 쓰게 한다(다른 사람·감사관이 같은 에뮬레이터를 쓰지 않게)
#    - ANDROID_SERIAL 이 있으면 그 기기만(adb 는 이 환경 변수를 그대로 따른다). emulator-NNNN 이 꺼져 있으면 AVD 를 그 포트로 켠다.
#    - 없으면 연결된 기기가 정확히 하나일 때만 그것을 쓰고, 둘 이상이면 멈춘다(어느 기기인지 모르면 남의 실행을 깰 수 있다).
online() { adb devices | awk 'NR>1 && $2=="device" {print $1}'; }
if [ -n "${ANDROID_SERIAL:-}" ]; then
  if ! online | grep -qx "$ANDROID_SERIAL"; then
    case "$ANDROID_SERIAL" in
      emulator-*)
        PORT="${ANDROID_SERIAL#emulator-}"
        echo "e2e: 에뮬레이터 $AVD 를 $ANDROID_SERIAL 로 시작(화면 없음)"
        # 같은 AVD 가 이미 다른 포트로 떠 있어도 겹쳐 켤 수 있게 읽기 전용
        nohup emulator -avd "$AVD" -port "$PORT" -read-only -no-window -no-audio -no-boot-anim -no-snapshot-save >"$E2E_DIR/out-emulator-$PORT.log" 2>&1 &
        ;;
      *) fail "ANDROID_SERIAL=$ANDROID_SERIAL 기기가 연결돼 있지 않아요." ;;
    esac
  fi
else
  COUNT="$(online | grep -c . || true)"
  if [ "$COUNT" -gt 1 ]; then
    fail "기기가 여러 대 연결돼 있어요($(online | tr '\n' ' ')). ANDROID_SERIAL=<기기> 로 하나를 고르세요."
  fi
  if [ "$COUNT" -eq 0 ]; then
    echo "e2e: 에뮬레이터 $AVD 시작(화면 없음)"
    nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot-save >"$E2E_DIR/out-emulator.log" 2>&1 &
  fi
fi
adb wait-for-device
export ANDROID_SERIAL="${ANDROID_SERIAL:-$(online | head -1)}"
echo "e2e: 기기 $ANDROID_SERIAL"
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
# logcat 버퍼를 넉넉히(기본 256K 면 긴 실행에서 앞쪽 ANR·크래시 기록이 밀려남, 재확인 L)
adb logcat -G 16M >/dev/null 2>&1 || true

# 3) 빌드·설치(stagingDebug = JS 는 Metro 에서 받음)
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  if [ "${SKIP_BUILD:-0}" != "1" ] || [ ! -f "$APK" ]; then
    # 기기 ABI 하나만 빌드(전 ABI 빌드보다 훨씬 빠름)
    ABI="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
    (cd "$APP_DIR/android" && ./gradlew assembleStagingDebug --console=plain -q -PreactNativeArchitectures="$ABI")
  fi
  adb install -r "$APK" >/dev/null
fi

# 4) 정리 함수를 먼저 건다(리뷰 L3: Metro 를 띄운 뒤 실패해도 끄도록, L1: 설정을 바꾸기 전에 되돌리기를 걸도록)
METRO_PID=""
HIDE_CHANGED=0
PREV_HIDE_DIALOGS=""
cleanup() { if [ -n "$METRO_PID" ]; then pkill -P "$METRO_PID" 2>/dev/null || true; kill "$METRO_PID" 2>/dev/null || true; fi; }
restore_dialogs() {
  [ "$HIDE_CHANGED" = "1" ] || return 0
  if [ "$PREV_HIDE_DIALOGS" = "null" ]; then
    adb shell settings delete global hide_error_dialogs >/dev/null 2>&1 || true
  else
    adb shell settings put global hide_error_dialogs "$PREV_HIDE_DIALOGS" >/dev/null 2>&1 || true
  fi
}
trap 'restore_dialogs; cleanup' EXIT

# Metro: 기기의 localhost:8081 → 맥의 METRO_PORT. 이미 떠 있으면 그대로 쓴다
adb reverse tcp:8081 "tcp:$METRO_PORT" >/dev/null
if ! curl -fs "http://localhost:$METRO_PORT/status" | grep -q running; then
  echo "e2e: Metro 시작(port $METRO_PORT)"
  (cd "$APP_DIR" && nohup npx react-native start --port "$METRO_PORT" >"$E2E_DIR/out-metro.log" 2>&1) &
  METRO_PID=$!
  for _ in $(seq 1 60); do curl -fs "http://localhost:$METRO_PORT/status" | grep -q running && break; sleep 1; done
fi
# 첫 번들은 30초 넘게 걸릴 수 있어 flow 시작 전에 미리 만든다(첫 화면 대기 시간 초과 방지)
curl -fs "http://localhost:$METRO_PORT/index.bundle?platform=android&dev=true&minify=false" -o /dev/null || fail "Metro 번들을 만들지 못했어요(out-metro.log)"

# 시스템 ANR 창("Process system isn't responding") 숨김(HIDE_DIALOGS=0 이면 끔): F6 불안정 원인(2026-11-18 캡처 — 첫 화면을 덮음).
# 바쁜 맥에서 에뮬레이터가 느려지면 뜬다. 모든 앱의 ANR·크래시 창도 숨겨지므로 우리 앱 ANR·크래시는 아래 logcat 검사로 실패 처리한다(리뷰 M1).
# 앞 값을 읽지 못하면 바꾸지 않는다(리뷰 L1: 되돌릴 값을 모르면 건드리지 않음). 같은 기기에 두 실행을 겹치지 않는다(README, 리뷰 L2)
if [ "${HIDE_DIALOGS:-1}" = "1" ]; then
  if PREV_HIDE_DIALOGS="$(adb shell settings get global hide_error_dialogs 2>/dev/null | tr -d '\r')" && [ -n "$PREV_HIDE_DIALOGS" ]; then
    HIDE_CHANGED=1
    adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1 || true
  else
    echo "e2e: hide_error_dialogs 를 읽지 못해 바꾸지 않아요"
  fi
fi

# 5) 감사용 기기 설정(선택, 끝나면 되돌림): DP_SIZE=360x640 · FONT_SCALE=2.0 · REDUCE_MOTION=1
restore_device() {
  adb shell wm size reset >/dev/null 2>&1 || true
  adb shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$k" 1 >/dev/null 2>&1 || true
  done
}
if [ -n "${DP_SIZE:-}" ] || [ -n "${FONT_SCALE:-}" ] || [ "${REDUCE_MOTION:-0}" = "1" ]; then
  trap 'restore_device; restore_dialogs; cleanup' EXIT
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
adb logcat -b all -c >/dev/null 2>&1 || true
set +e
maestro --device "$ANDROID_SERIAL" test "${TARGETS[@]}" --test-output-dir "$OUT_DIR" --format junit --output "$OUT_DIR/report.xml"
RC=$?
set -e
# 우리 앱의 ANR·크래시(창이 숨겨졌거나 회복돼도)는 실패로(리뷰 M1). 다른 앱·시스템 것은 기록만
adb logcat -d -b main -b system -b events -b crash >"$OUT_DIR/logcat.txt" 2>/dev/null || true
grep -E "ANR in |am_anr|FATAL EXCEPTION|Process: " "$OUT_DIR/logcat.txt" >"$OUT_DIR/anr-crash.txt" 2>/dev/null || true
if grep -qE "ANR in $APP_ID|am_anr.*$APP_ID" "$OUT_DIR/logcat.txt" || grep -A3 "FATAL EXCEPTION" "$OUT_DIR/logcat.txt" | grep -q "Process: $APP_ID"; then
  fail "앱 ANR·크래시가 기록됐어요($OUT_DIR/anr-crash.txt). 흐름이 통과해도 실패로 봅니다."
fi
[ "$RC" -eq 0 ] || fail "흐름 실패(rc=$RC). 캡처·보고서: $OUT_DIR"
echo "e2e: 통과(앱 ANR·크래시 0). 캡처·보고서: $OUT_DIR"
