#!/usr/bin/env bash
# 푸시 토큰 잠금 순서 경합 재현(#264 리뷰 QA-3 M1·QA-1 2차 M1). 두 연결을 실제로 겹쳐 돌려 "철회한 계정에 토큰 행이 남지 않는다"와
# "교착(deadlock detected) 없이 줄을 선다"를 확인한다. 잠금 순서 규칙: profiles → device_tokens(0062).
#   사용: supabase/ops/push-lock-race.sh                     → 임시 스택(project bumo-race-$$, 557xx)을 띄워 확인하고 지운다
#         PATCH_SQL=파일 supabase/ops/push-lock-race.sh       → db reset 뒤 그 SQL을 적용하고 확인(예: 잠금을 빼거나 옮긴 정의로 실패하는지)
# 전제: Docker. 공유 로컬 DB(54322)·staging·원격에는 절대 쓰지 않는다(임시 스택 전용 — 시험용 트리거를 설치한다). CI에는 넣지 않음(약 2분).
# 판정: 시나리오마다 PASS/FAIL, 하나라도 FAIL이면 종료 코드 1.
#   R1 등록(커밋 전) ↔ 철회   R2 철회(커밋 전) ↔ 등록         → 철회한 계정 토큰 행 0
#   D1 본인 삭제(account_delete_core, 토큰 지운 뒤 멈춤) ↔ 등록   D2 같은 삭제 ↔ 철회   D3 가족 전체 삭제 ↔ 등록 → 교착 없음 + 행 0
#   D1~D3의 "멈춤"은 시험용 트리거(device_tokens delete 뒤, 세션 설정 race.pause=on일 때만 2초 sleep)로 0058 순서의 교착 창을 넓힌다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
PROJECT="bumo-race-$$"
C="supabase_db_$PROJECT"

cleanup() {
  npx --yes supabase stop --workdir "$WORK" --no-backup >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/supabase"
cp -R "$ROOT/supabase/migrations" "$ROOT/supabase/templates" "$WORK/supabase/"
cp "$ROOT"/supabase/*.sql "$WORK/supabase/" 2>/dev/null || true
sed -e "s/^project_id = .*/project_id = \"$PROJECT\"/" -e 's/= 543\([0-9][0-9]\)/= 557\1/' \
  "$ROOT/supabase/config.toml" >"$WORK/supabase/config.toml"

echo "== 임시 스택 시작($PROJECT)"
npx --yes supabase start --workdir "$WORK" \
  -x realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta >"$WORK/start.log" 2>&1 \
  || { echo "== 시작 실패"; tail -5 "$WORK/start.log" | grep -v -i -E "eyJ|sb_(secret|publishable)_|secret|key"; exit 1; }
npx --yes supabase db reset --workdir "$WORK" >"$WORK/reset.log" 2>&1 || { echo "== db reset 실패"; tail -15 "$WORK/reset.log"; exit 1; }

P() { docker exec -i "$C" psql -U postgres -X -q -At -v ON_ERROR_STOP=1 "$@"; }
if [ -n "${PATCH_SQL:-}" ]; then
  echo "== PATCH_SQL 적용: $PATCH_SQL"
  P <"$PATCH_SQL"
fi

# 시험용 멈춤 트리거(임시 스택에만)
P <<'SQL'
create function public.race_pause() returns trigger language plpgsql as $$
begin
  if current_setting('race.pause', true) = 'on' then perform pg_sleep(2); end if;
  return null;
end $$;
create trigger race_pause after delete on public.device_tokens for each statement execute function public.race_pause();
SQL

CU=71000000-0000-0000-0000-0000000000c1
AU=71000000-0000-0000-0000-0000000000a1
CP=7100b000-0000-0000-0000-0000000000c1
AP=7100b000-0000-0000-0000-0000000000a1
FAM=7100f000-0000-0000-0000-000000000001
TOK=race_tok_a1_xxxxxxxxxxxxxxxxxxxx

seed() {
  P <<SQL
delete from public.families where id = '$FAM';
delete from public.device_tokens where user_id in ('$CU', '$AU');
delete from auth.users where id in ('$CU', '$AU');
insert into auth.users (id, aud, role, is_anonymous) values ('$CU', 'authenticated', 'authenticated', false), ('$AU', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('$FAM', '$CU');
insert into public.profiles (id, user_id, family_id, role, push_enabled, push_consented_at) values
  ('$CP', '$CU', '$FAM', 'child', true, now()), ('$AP', '$AU', '$FAM', 'parent', true, now());
insert into public.device_tokens (user_id, token, platform) values ('$AU', '$TOK', 'android');
SQL
}
as_a1() { echo "select set_config('request.jwt.claims', '{\"sub\":\"$AU\",\"role\":\"authenticated\",\"is_anonymous\":true}', true); set local role authenticated;"; }
rows_a1() { P -c "select count(*) from public.device_tokens where user_id = '$AU'"; }

FAILS=0
judge() { # 이름, 출력파일들...
  local name=$1; shift
  local n; n=$(rows_a1)
  if cat "$@" | grep -q "deadlock detected"; then
    echo "FAIL $name: 교착(deadlock detected)"; FAILS=$((FAILS + 1))
  elif [ "$n" != "0" ]; then
    echo "FAIL $name: 철회·삭제된 계정에 토큰 행 ${n}개가 남음"; FAILS=$((FAILS + 1))
  else
    echo "PASS $name: $(cat "$@" | grep -E '^\{"(ok|scope)' | tr '\n' ' ')"
  fi
}
O="$WORK/out"; mkdir -p "$O"

# 먼저 시작한 연결(A)이 커밋 전 3초를 붙잡는 동안 1초 뒤 두 번째 연결(B)을 돌린다
pair() { # 이름, A sql, B sql
  ( P -c "$2" >"$O/$1.a" 2>&1 || true ) &
  sleep 1
  P -c "$3" >"$O/$1.b" 2>&1 || true
  wait
  judge "$1" "$O/$1.a" "$O/$1.b"
}

seed
pair R1 "begin; $(as_a1) select public.register_push_token('race_new1_xxxxxxxxxxxxxxxxxxxx'); select pg_sleep(3); commit;" \
        "begin; $(as_a1) select public.set_push_enabled(false); commit;"
seed
pair R2 "begin; $(as_a1) select public.set_push_enabled(false); select pg_sleep(3); commit;" \
        "begin; $(as_a1) select public.register_push_token('race_new2_xxxxxxxxxxxxxxxxxxxx'); commit;"
seed
pair D1 "begin; set local race.pause = 'on'; select public.account_delete_core('$AP'); commit;" \
        "begin; $(as_a1) select public.register_push_token('$TOK'); commit;"
seed
pair D2 "begin; set local race.pause = 'on'; select public.account_delete_core('$AP'); commit;" \
        "begin; $(as_a1) select public.set_push_enabled(false); commit;"
seed
pair D3 "begin; set local race.pause = 'on'; select public.account_delete_core('$CP'); commit;" \
        "begin; $(as_a1) select public.register_push_token('$TOK'); commit;"

echo "== 결과: 실패 ${FAILS}"
[ "${FAILS}" -eq 0 ]
