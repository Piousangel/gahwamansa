# 임시 스택 띄우기·race 판정 공용 함수(대기열 43·48). 실행하지 않고 source 해서 쓴다:
#   push-lock-race.sh · event-day-race.sh · replay-check.sh
#
# 포트(#275 QA-3 L1): 예전에는 스크립트마다 557xx·559xx·553xx로 고정이라, 같은 스크립트를 두 사람이 동시에 돌리거나
#   다른 임시 스택이 그 대역을 쓰면 `port is already allocated`로 바로 실패했다. 이제는
#   - PORT_BASE(세 자리, 550~599)를 주면 config.toml 의 543xx 를 <PORT_BASE>xx 로 바꿔 그대로 쓴다(비었는지 보지 않음).
#   - 안 주면 스크립트 기본 대역부터 550~599 를 차례로 보며, config.toml 이 쓰는 포트(주석 아닌 543xx 줄)가
#     127.0.0.1 에서 모두 비어 있는 첫 대역을 고른다. 공유 스택(543xx)은 범위 밖이라 고르지 않는다.
#   - 고른 뒤 시작하기까지 다른 실행이 같은 대역을 먼저 잡으면(동시에 시작) 그 스택을 지우고 다음 빈 대역으로 최대 3번 다시 시도한다.

# config.toml 에서 쓰는 543xx 포트의 끝 두 자리(주석 줄 제외)
temp_stack_suffixes() { # config.toml
  grep -E '^[^#]*= *543[0-9]{2}' "$1" | sed -E 's/.*= *543([0-9]{2}).*/\1/' | sort -u
}

# 127.0.0.1 의 그 포트에 아무도 듣고 있지 않으면 0
port_free() { # 포트
  ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# 대역의 모든 포트가 비었으면 0
base_free() { # 대역(세 자리), config.toml
  local s
  for s in $(temp_stack_suffixes "$2"); do
    port_free "$1$s" || return 1
  done
}

# 쓸 대역(세 자리)을 출력한다. TEMP_STACK_SKIP(공백 구분)에 든 대역은 건너뛴다.
pick_port_base() { # 기본 대역, config.toml
  local def=$1 cfg=$2 b
  if [ -n "${PORT_BASE:-}" ]; then
    if ! [[ "$PORT_BASE" =~ ^5[5-9][0-9]$ ]]; then
      echo "PORT_BASE 는 550~599 세 자리여야 한다(지금: $PORT_BASE)" >&2
      return 1
    fi
    echo "$PORT_BASE"
    return 0
  fi
  for b in "$def" $(seq 550 599); do
    case " ${TEMP_STACK_SKIP:-} " in *" $b "*) continue ;; esac
    if base_free "$b" "$cfg"; then
      echo "$b"
      return 0
    fi
  done
  echo "비어 있는 포트 대역이 없다(550~599). 떠 있는 임시 스택(docker ps)을 확인할 것" >&2
  return 1
}

# config.toml 사본: project_id 와 543xx 포트만 바꾼다
write_temp_config() { # 원본 config.toml, 사본 경로, project_id, 대역
  sed -e "s/^project_id = .*/project_id = \"$3\"/" -e "s/= 543\([0-9][0-9]\)/= $4\1/" "$1" >"$2"
}

# 임시 스택 시작. 성공하면 TEMP_STACK_BASE 에 대역을 남긴다. 시작 출력은 $WORK/start.log.
# 쓰기 전에 $WORK/supabase 에 migrations 등을 복사해 둘 것.
temp_stack_start() { # 저장소 ROOT, WORK, project_id, 기본 대역
  local root=$1 work=$2 project=$3 def=$4 try base
  TEMP_STACK_SKIP=""
  for try in 1 2 3; do
    base=$(pick_port_base "$def" "$root/supabase/config.toml") || return 1
    write_temp_config "$root/supabase/config.toml" "$work/supabase/config.toml" "$project" "$base"
    if npx --yes supabase start --workdir "$work" \
      -x realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta >"$work/start.log" 2>&1; then
      TEMP_STACK_BASE=$base
      return 0
    fi
    if [ -z "${PORT_BASE:-}" ] && grep -qiE "port is already allocated|address already in use" "$work/start.log"; then
      echo "== 포트 대역 ${base}xx 를 다른 실행이 먼저 잡음 → 다음 대역으로 다시(${try}/3)"
      npx --yes supabase stop --workdir "$work" --no-backup >/dev/null 2>&1 || true
      TEMP_STACK_SKIP="$TEMP_STACK_SKIP $base"
      continue
    fi
    return 1
  done
  return 1
}

# race 판정(#264 QA-1 L-b·#271 QA-1 L-c·DECISIONS #271 "두 쪽 모두 정상 응답"): 겹쳐 돌린 연결들의 출력 파일을 본다.
#   - 어느 쪽이든 "deadlock detected"면 FAIL(기대 오류로도 봐주지 않음).
#   - 연결마다: ERROR가 있으면 기대 오류 정규식(없으면 -)과 맞을 때만 그 연결의 정상 결과로 친다.
#     ERROR가 없으면 결과 줄(정규식)이 있어야 한다. 결과 줄도 오류도 없으면 FAIL("행이 0"만으로는 PASS 아님).
#   통과하면 0, 아니면 이유 한 줄을 출력하고 1. 남은 행 수 같은 상태 확인은 부르는 쪽이 이어서 한다.
judge_outputs() { # 기대 오류 정규식(-), 결과 줄 정규식, 출력파일들...
  local expect=$1 result_re=$2 f err
  shift 2
  if grep -q "deadlock detected" "$@"; then
    echo "교착(deadlock detected)"
    return 1
  fi
  for f in "$@"; do
    err=$(grep -m1 "ERROR" "$f" || true)
    if [ -n "$err" ]; then
      if [ "$expect" = "-" ] || ! printf '%s' "$err" | grep -qE -- "$expect"; then
        echo "$(basename "$f") 쪽 기대하지 않은 오류 — $err"
        return 1
      fi
    elif ! grep -qE -- "$result_re" "$f"; then
      echo "$(basename "$f") 쪽 결과 줄 없음"
      return 1
    fi
  done
}
