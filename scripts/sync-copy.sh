#!/usr/bin/env bash
# 문구 원본 → 앱 사본 동기화(ARCHITECTURE 6절, 계획 12 1-1). 원본만 손으로 고치고 사본은 이 스크립트로만 덮어쓴다.
#   scripts/sync-copy.sh          # 사본을 원본과 같게(바이트 그대로 복사)
#   scripts/sync-copy.sh --check  # 다르면 실패(exit 1), 파일은 바꾸지 않음
# 같은지는 app/__tests__/copySync.test.ts 가 npm test 에서도 검사한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/team/copy.ko.json"
DST="$ROOT/app/src/copy/copy.ko.json"

[ -f "$SRC" ] || { echo "sync-copy: 원본이 없어요: $SRC" >&2; exit 1; }
# 원본이 JSON 으로 읽히지 않으면 복사하지 않는다(깨진 원본이 앱으로 가지 않게)
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$SRC" \
  || { echo "sync-copy: 원본 JSON 이 깨졌어요: $SRC" >&2; exit 1; }

if [ "${1:-}" = "--check" ]; then
  if cmp -s "$SRC" "$DST"; then
    echo "sync-copy: 같음"
    exit 0
  fi
  echo "sync-copy: 사본이 원본과 달라요. scripts/sync-copy.sh 를 실행하세요." >&2
  exit 1
fi

if cmp -s "$SRC" "$DST"; then
  echo "sync-copy: 이미 같음(바꾸지 않음)"
else
  cp "$SRC" "$DST"
  echo "sync-copy: 사본 갱신 → app/src/copy/copy.ko.json"
fi
