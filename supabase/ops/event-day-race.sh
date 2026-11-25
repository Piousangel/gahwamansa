#!/usr/bin/env bash
# child_home_viewed 하루 1회 경합 재현(#288 리뷰 QA-1 L2). 같은 자녀 계정의 두 연결이 log_event 를 겹쳐 부를 때 한 행만 남는지 본다.
# pgTAP 은 한 연결이라 겹침을 못 만든다 → 두 psql 연결을 실제로 겹친다: A 가 기록한 뒤 커밋 전에 2초 멈추고, 그사이 B 가 같은 호출.
#   잠금(0066 pg_advisory_xact_lock)이 있으면 B 는 A 커밋까지 기다렸다가 오늘 행을 보고 저장 없이 {ok:true} → 1행.
#   잠금이 없으면 B 는 A 의 커밋 전 행을 못 봐서 또 저장 → 2행(FAIL).
#   사용: supabase/ops/event-day-race.sh               → 임시 스택(project bumo-evrace-$$, 559xx)을 띄워 확인하고 지운다
#         NO_LOCK=1 supabase/ops/event-day-race.sh     → 0066 에서 잠금 줄만 뺀 정의를 적용해 FAIL 이 나는지(시험이 잠금을 실제로 보는지) 확인
# 전제: Docker. 공유 로컬 DB(54322)·staging·원격에는 쓰지 않는다(임시 스택 전용). CI 에는 넣지 않음(약 1~2분).
# 판정: 두 연결 모두 {"ok": true}, 오류 없음, 그 계정 child_home_viewed 행 1개 → PASS(종료 0), 아니면 FAIL(종료 1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
PROJECT="bumo-evrace-$$"
C="supabase_db_$PROJECT"
MIG="$ROOT/supabase/migrations/20261116000066_child_home_viewed.sql"

cleanup() {
  npx --yes supabase stop --workdir "$WORK" --no-backup >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/supabase"
cp -R "$ROOT/supabase/migrations" "$ROOT/supabase/templates" "$WORK/supabase/"
cp "$ROOT"/supabase/*.sql "$WORK/supabase/" 2>/dev/null || true
sed -e "s/^project_id = .*/project_id = \"$PROJECT\"/" -e 's/= 543\([0-9][0-9]\)/= 559\1/' \
  "$ROOT/supabase/config.toml" >"$WORK/supabase/config.toml"

echo "== 임시 스택 시작($PROJECT)"
npx --yes supabase start --workdir "$WORK" \
  -x realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta >"$WORK/start.log" 2>&1 \
  || { echo "== 시작 실패"; tail -5 "$WORK/start.log" | grep -v -i -E "eyJ|sb_(secret|publishable)_|secret|key"; exit 1; }
npx --yes supabase db reset --workdir "$WORK" >"$WORK/reset.log" 2>&1 || { echo "== db reset 실패"; tail -15 "$WORK/reset.log"; exit 1; }

P() { docker exec -i "$C" psql -U postgres -X -q -At -v ON_ERROR_STOP=1 "$@"; }
if [ -n "${NO_LOCK:-}" ]; then
  echo "== NO_LOCK: 0066 에서 pg_advisory_xact_lock 줄을 뺀 정의 적용"
  grep -v "pg_advisory_xact_lock" "$MIG" | P
fi

UID_C=72660000-0000-0000-0000-0000000000c1
P <<SQL
insert into auth.users (id, aud, role, is_anonymous) values ('$UID_C', 'authenticated', 'authenticated', false);
insert into public.families (id, created_by) values ('72660000-0000-0000-0000-0000000000f1', '$UID_C');
insert into public.profiles (id, user_id, family_id, role) values
  ('72660000-0000-0000-0000-0000000000b1', '$UID_C', '72660000-0000-0000-0000-0000000000f1', 'child');
SQL

call() { # $1 = 커밋 전 멈춤(초)
  P <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$UID_C', 'role', 'authenticated', 'is_anonymous', false)::text, true);
set local role authenticated;
select public.log_event('child_home_viewed', '{}');
select pg_sleep($1);
commit;
SQL
}

call 2 >"$WORK/a.out" 2>&1 &
A=$!
sleep 0.7 # A 가 기록을 마치고 멈춘 사이에 B
call 0 >"$WORK/b.out" 2>&1 || true
wait "$A" || true

rows=$(P -c "select count(*) from public.events where name = 'child_home_viewed' and profile_id = '72660000-0000-0000-0000-0000000000b1'")
echo "A: $(grep -v '^$' "$WORK/a.out" | tr '\n' ' ')"
echo "B: $(grep -v '^$' "$WORK/b.out" | tr '\n' ' ')"
echo "행: $rows"
if grep -q '{"ok": true}' "$WORK/a.out" && grep -q '{"ok": true}' "$WORK/b.out" \
   && ! grep -qi "error" "$WORK/a.out" "$WORK/b.out" && [ "$rows" = "1" ]; then
  echo "PASS 같은 계정 동시 2회 → 1행"
else
  echo "FAIL 같은 계정 동시 2회 → ${rows}행(기대 1)"
  exit 1
fi
