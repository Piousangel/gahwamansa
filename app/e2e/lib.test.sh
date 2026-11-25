#!/usr/bin/env bash
# app/e2e/lib.sh 셸 시험(기기·Metro 없이). 사용: bash app/e2e/lib.test.sh → 실패가 있으면 종료 코드 1
set -uo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

fails=0
ok() { printf '  ✓ %s\n' "$1"; }
no() { printf '  ✕ %s\n' "$1"; fails=$((fails + 1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else no "$1 (기대 '$3', 실제 '$2')"; fi; }

echo '포트 검사'
for p in 1024 8081 8091 65535; do e2e_valid_port "$p" && ok "$p 통과" || no "$p 는 통과해야 함"; done
for p in '' abc 80 1023 65536 08091 '8091 ' '8091;rm' -1 99999; do e2e_valid_port "$p" && no "'$p' 는 막혀야 함" || ok "'$p' 막힘"; done

echo '인자 읽기'
check '--metro-port 8091' "$(e2e_parse_metro_port --metro-port 8091 flows/a.yaml | tr '\n' ' ')" '8091 2 '
check '--metro-port=8091' "$(e2e_parse_metro_port --metro-port=8091 flows/a.yaml | tr '\n' ' ')" '8091 1 '
check '포트 인자 없음' "$(e2e_parse_metro_port flows/a.yaml | tr '\n' ' ')" ' 0 '
check '인자 전혀 없음' "$(e2e_parse_metro_port | tr '\n' ' ')" ' 0 '
e2e_parse_metro_port --metro-port 2>/dev/null && no '--metro-port 뒤 값 없음은 실패해야 함' || ok '--metro-port 뒤 값 없음 → 실패'
e2e_parse_metro_port --metro-port flows/a.yaml 2>/dev/null && no '포트 자리에 파일 이름은 실패해야 함' || ok '포트 자리에 파일 이름 → 실패'
e2e_parse_metro_port --metro-port=abc 2>/dev/null && no '--metro-port=abc 는 실패해야 함' || ok '--metro-port=abc → 실패'
e2e_parse_metro_port --metro-port= 2>/dev/null && no '--metro-port= 는 실패해야 함' || ok '--metro-port= (빈 값) → 실패'
msg="$(e2e_parse_metro_port --metro-port=80 2>&1 >/dev/null)"
case "$msg" in *1024~65535*) ok '잘못된 값은 범위를 알려 줌' ;; *) no "오류 문장: $msg" ;; esac

echo 'reverse 목록 읽기'
LIST_NEW=$'emulator-5554 tcp:8081 tcp:8081\nemulator-5554 tcp:9000 tcp:9001'
LIST_OLD='(reverse) tcp:8091 tcp:8095'
check '같은 대상으로 이미 있음' "$(e2e_reverse_target 8081 "$LIST_NEW")" 'tcp:8081'
check '다른 대상으로 이미 있음(옛 adb 모양)' "$(e2e_reverse_target 8091 "$LIST_OLD")" 'tcp:8095'
check '없음' "$(e2e_reverse_target 8091 "$LIST_NEW")" ''
check '빈 목록' "$(e2e_reverse_target 8081 '')" ''
check '맥 쪽 포트만 같은 줄은 해당 없음' "$(e2e_reverse_target 9001 "$LIST_NEW")" ''

echo "실패 $fails"
[ "$fails" = 0 ]
