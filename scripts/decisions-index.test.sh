#!/usr/bin/env bash
# decisions-index.sh 고정 시험(대기열 42). CI decisions 가 먼저 돌린다. 실패하면 exit 1.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
S="$HERE/decisions-index.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T" "$T.out"' EXIT
fail=0
check() { # 이름, 기대, 실제
  if [ "$2" = "$3" ]; then echo "ok   $1"; else printf 'FAIL %s\n  기대: %s\n  실제: %s\n' "$1" "$2" "$3"; fail=1; fi
}
entry() { # 파일, 제목, 날짜, PR
  printf '# %s\n\n- 날짜: %s\n- 관련 PR: %s\n\n- 선택: 본문\n' "$2" "$3" "$4" > "$T/$1"
}

export DECISIONS_DIR="$T"
entry 2026-11-24-old-one.md '옛 결정' 2026-11-24 '#10'
entry 2026-11-25-new-one.md '새 결정 a|b' 2026-11-25 '#11'
echo '# 안내' > "$T/README.md"

rows="$(bash "$S" | grep '^| 2026')"
check "색인: 최신 먼저 2줄, README 제외, 제목의 | 는 이스케이프" \
  "$(printf '%s\n%s' '| 2026-11-25 | 새 결정 a\|b | #11 | [2026-11-25-new-one.md](2026-11-25-new-one.md) |' '| 2026-11-24 | 옛 결정 | #10 | [2026-11-24-old-one.md](2026-11-24-old-one.md) |')" \
  "$rows"
check "색인 머리: 표 머리 줄" "| 날짜 | 제목 | 관련 PR | 파일 |" "$(bash "$S" | grep '^| 날짜')"
check "--recent 1 = 가장 최근 항목만" "--- docs/decisions/2026-11-25-new-one.md" "$(bash "$S" --recent 1 | grep '^--- ')"
check "--recent 3 이 항목 수(2)보다 커도 2개" 2 "$(bash "$S" --recent 3 | grep -c '^--- ')"
check "--check 올바른 항목 → 0" 0 "$(bash "$S" --check > /dev/null; echo $?)"
bash "$S" --write > /dev/null
check "--write 는 INDEX.md 를 쓰고 --check 는 INDEX.md 를 항목으로 보지 않음" "0 yes" "$(bash "$S" --check > /dev/null; echo $?) $([ -f "$T/INDEX.md" ] && echo yes)"

# 실패해야 하는 경우들(헛통과 방지)
entry 2026-11-25-date-mismatch.md '날짜 다름' 2026-11-26 '#12'
check "--check: 머리 날짜 ≠ 파일 이름 날짜 → 1" 1 "$(bash "$S" --check > /dev/null; echo $?)"
rm "$T/2026-11-25-date-mismatch.md"
printf -- '- 날짜: 2026-11-25\n- 관련 PR: #1\n' > "$T/2026-11-25-no-title.md"
check "--check: 제목 없음 → 1" 1 "$(bash "$S" --check > /dev/null; echo $?)"
rm "$T/2026-11-25-no-title.md"
printf '# 제목\n\n- 날짜: 2026-11-25\n' > "$T/2026-11-25-no-pr.md"
check "--check: 관련 PR 줄 없음 → 1" 1 "$(bash "$S" --check > /dev/null; echo $?)"
rm "$T/2026-11-25-no-pr.md"
entry 'Decision Note.md' '이름 틀림' 2026-11-25 '#13'
check "--check: 이름 형식 틀림(대문자·공백) → 1, 그 이름을 보고" "1 FAIL Decision Note.md:" \
  "$(bash "$S" --check > "$T.out"; echo $?) $(grep -o '^FAIL Decision Note.md:' "$T.out")"
rm "$T/Decision Note.md"
check "되돌리면 다시 통과" 0 "$(bash "$S" --check > /dev/null; echo $?)"

entry 'Bad Name.md' '틀림' 2026-11-25 '#14'
check "--check 파일 지정: 지정한 올바른 항목만 보면 0(폴더의 다른 틀린 파일은 안 봄)" 0 "$(bash "$S" --check "docs/decisions/2026-11-25-new-one.md" > /dev/null; echo $?)"
check "--check 파일 지정: 틀린 파일을 지정하면 1" 1 "$(bash "$S" --check 'docs/decisions/Bad Name.md' > /dev/null; echo $?)"
rm "$T/Bad Name.md"

# 저장소의 실제 항목도 형식 통과
check "저장소 docs/decisions 형식 통과" 0 "$(DECISIONS_DIR= bash "$S" --check > /dev/null; echo $?)"

exit "$fail"
