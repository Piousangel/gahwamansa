#!/usr/bin/env bash
# run.sh 가 쓰는 작은 도우미(셸 시험: app/e2e/lib.test.sh). 기기·Metro 를 건드리지 않는 판단만 여기 둔다.
# #278 QA-1 L1~L3(대기열 52): 포트 숫자 검사, --metro-port=8091 꼴, 시작 전 reverse 가 있었는지.

# 포트는 1024~65535 숫자만(앞 0 없음). 아니면 1
e2e_valid_port() {
  [[ "${1:-}" =~ ^[1-9][0-9]{3,4}$ ]] && [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]
}

# 맨 앞 인자에서 Metro 포트를 읽는다: `--metro-port 8091` 또는 `--metro-port=8091`.
# 출력: 첫 줄 = 포트(없으면 빈 줄), 둘째 줄 = 먹은 인자 수(0·1·2). 잘못된 값이면 오류 문장을 stderr 에 쓰고 1
e2e_parse_metro_port() {
  case "${1:-}" in
    --metro-port=*)
      local v="${1#--metro-port=}"
      e2e_valid_port "$v" || { echo "e2e: --metro-port 값은 1024~65535 숫자여야 해요(받은 값: '$v')" >&2; return 1; }
      printf '%s\n1\n' "$v"
      ;;
    --metro-port)
      [ -n "${2:-}" ] || { echo "e2e: --metro-port 뒤에 포트 번호를 주세요" >&2; return 1; }
      e2e_valid_port "$2" || { echo "e2e: --metro-port 값은 1024~65535 숫자여야 해요(받은 값: '$2')" >&2; return 1; }
      printf '%s\n2\n' "$2"
      ;;
    *)
      printf '\n0\n'
      ;;
  esac
}

# `adb reverse --list` 출력에서 기기 쪽 tcp:<포트> 가 이미 있는지. 있으면 그 맥 쪽 대상(tcp:N)을, 없으면 빈 문자열.
# 줄 모양(adb 판마다 다름): "<serial> tcp:8081 tcp:8081" 또는 "(reverse) tcp:8081 tcp:8081"
e2e_reverse_target() {
  local port="$1" list="$2"
  printf '%s\n' "$list" | awk -v p="tcp:$port" '$2 == p {print $3; exit}'
}
