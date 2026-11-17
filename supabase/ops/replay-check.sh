#!/usr/bin/env bash
# 마이그레이션 0001→끝 순차 재생 검증(로드맵 SV-09, 리뷰 M3).
# 공유 로컬 DB(bumo-jasik, 54322)는 다른 레인 통합 테스트가 쓰므로 reset 금지 → 별도 project_id·포트(553xx)의 임시 스택에서
# `db reset`(마이그레이션 전체 + 시드) 후 `test db`(pgTAP 전체)를 돌리고, 끝나면 그 스택만 지운다(--no-backup).
#   사용: supabase/ops/replay-check.sh            → 결과를 화면과 저장소 밖 로그(${TMPDIR:-/tmp}/bumo-replay-check.log)에 남김(로컬 키는 출력하지 않음)
# 전제: Docker 실행 중. 공유 스택과 동시에 떠도 포트가 겹치지 않는다. 메모리 절약을 위해 재생·테스트에 필요 없는 서비스는 띄우지 않는다
#       (auth·storage 는 필요: 0001 의 auth.users 컬럼은 GoTrue 마이그레이션이, 0013 의 storage.buckets 는 Storage 가 만든다).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
LOG="${TMPDIR:-/tmp}/bumo-replay-check.log"
PROJECT="bumo-jasik-replay"

cleanup() {
  npx --yes supabase stop --workdir "$WORK" --no-backup >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/supabase"
cp -R "$ROOT/supabase/migrations" "$ROOT/supabase/tests" "$ROOT/supabase/templates" "$WORK/supabase/"
cp "$ROOT"/supabase/*.sql "$WORK/supabase/" 2>/dev/null || true
# project_id 와 543xx 포트를 553xx 로 바꾼 설정 사본
sed -e "s/^project_id = .*/project_id = \"$PROJECT\"/" -e 's/= 543\([0-9][0-9]\)/= 553\1/' \
  "$ROOT/supabase/config.toml" >"$WORK/supabase/config.toml"

{
  echo "== replay-check $(date '+%Y-%m-%d %H:%M:%S') HEAD=$(git -C "$ROOT" rev-parse --short HEAD)"
  echo "== 마이그레이션 $(ls "$ROOT/supabase/migrations" | wc -l | tr -d ' ')개, 테스트 $(ls "$ROOT/supabase/tests" | wc -l | tr -d ' ')개"
  npx --yes supabase start --workdir "$WORK" \
    -x realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta >/dev/null 2>&1
  echo "== 임시 스택 시작($PROJECT, db 55322)"
  echo "== db reset(임시 스택만)"
  npx --yes supabase db reset --workdir "$WORK" 2>&1 | grep -E "^Applying migration|^Seeding|ERROR|Finished" | tail -4
  echo "== test db"
  npx --yes supabase test db --workdir "$WORK" 2>&1 | grep -v -i "new version\|recommend" | grep -E "not ok|Failed|Wstat|Tests=|Result|ERROR" || true
} 2>&1 | tee "$LOG"

echo "로그: $LOG"
grep -q "^Result: PASS" "$LOG"
