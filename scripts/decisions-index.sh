#!/usr/bin/env bash
# 결정 항목(docs/decisions/YYYY-MM-DD-<slug>.md)의 색인·최근 항목·형식 검사(11-25 대기열 42, DECISIONS.md 병합 충돌 제거).
# 색인은 커밋하지 않는다 — 커밋하면 같은 날짜 항목 두 개가 색인의 이웃 줄이 되어 다시 충돌한다. 필요할 때 만든다.
#   사용:
#     scripts/decisions-index.sh            색인(최신 먼저)을 화면에 출력
#     scripts/decisions-index.sh --write    docs/decisions/INDEX.md 로 저장(.gitignore, 커밋 안 함)
#     scripts/decisions-index.sh --recent 3 최근 3개 항목 본문(세션 시작에 보기 — hook 연결은 PR 제안)
#     scripts/decisions-index.sh --check [파일…]  항목 형식 검사. 파일을 주면 그것만(CI는 PR이 더하거나 바꾼 항목만). 틀리면 exit 1
#   DECISIONS_DIR 로 폴더를 바꿀 수 있다(시험용).
set -uo pipefail
export LC_ALL=C # 파일 이름 정렬을 바이트 순으로 고정(로케일마다 달라지지 않게)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${DECISIONS_DIR:-$ROOT/docs/decisions}"
NAME_RE='^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9-]*\.md$'

# 항목 파일 이름(오래된 것 먼저). README·INDEX 같은 대문자 파일은 항목이 아니다.
entries() {
  [ -d "$DIR" ] || return 0
  ls -1 "$DIR" | grep -E '^[0-9]{4}-' | sort
}
field() { # 파일, 머리 이름('날짜'·'관련 PR') → 값
  sed -n "s/^- $2:[[:space:]]*//p" "$1" | head -1 | sed 's/[[:space:]]*$//'
}
title() { sed -n 's/^# //p' "$1" | head -1 | sed 's/[[:space:]]*$//'; }

index() {
  echo '# 결정 색인'
  echo
  echo '자동 생성(`scripts/decisions-index.sh`) — 커밋하지 않는다. 2026-11-25 이전 결정은 루트 `DECISIONS.md`.'
  echo
  echo '| 날짜 | 제목 | 관련 PR | 파일 |'
  echo '|---|---|---|---|'
  entries | sort -r | while IFS= read -r f; do
    p="$DIR/$f"
    t="$(title "$p" | sed 's/|/\\|/g')"
    printf '| %s | %s | %s | [%s](%s) |\n' "$(field "$p" 날짜)" "$t" "$(field "$p" '관련 PR' | sed 's/|/\\|/g')" "$f" "$f"
  done
}

recent() { # 개수
  entries | sort -r | head -n "$1" | while IFS= read -r f; do
    echo "--- docs/decisions/$f"
    cat "$DIR/$f"
    echo
  done
}

check() { # [파일 이름…] 없으면 폴더 전체
  local bad=0 n=0 f p d
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    p="$DIR/$f"
    n=$((n + 1))
    if ! printf '%s' "$f" | grep -qE "$NAME_RE"; then
      echo "FAIL $f: 이름은 YYYY-MM-DD-<영문 소문자·숫자·->.md"; bad=1; continue
    fi
    d="${f:0:10}"
    [ -n "$(title "$p")" ] || { echo "FAIL $f: '# 제목' 줄이 없다"; bad=1; }
    [ "$(field "$p" 날짜)" = "$d" ] || { echo "FAIL $f: '- 날짜: $d' 가 파일 이름 날짜와 같아야 한다(지금 '$(field "$p" 날짜)')"; bad=1; }
    [ -n "$(field "$p" '관련 PR')" ] || { echo "FAIL $f: '- 관련 PR: #번호' 줄이 없다(없으면 '없음')"; bad=1; }
  done < <(if [ $# -gt 0 ]; then for f in "$@"; do basename "$f"; done; else ls -1 "$DIR" 2>/dev/null; fi | grep -v -E '^(README|INDEX)\.md$')
  [ "$bad" = 0 ] && echo "ok   결정 항목 ${n}개 형식 통과"
  return "$bad"
}

case "${1:-}" in
  '') index ;;
  --write) index > "$DIR/INDEX.md" && echo "썼다: ${DIR#$ROOT/}/INDEX.md" ;;
  --recent) recent "${2:-3}" ;;
  --check) shift; check "$@" ;;
  *) echo "사용: $0 [--write | --recent N | --check]" >&2; exit 2 ;;
esac
