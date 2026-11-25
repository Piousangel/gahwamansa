#!/usr/bin/env bash
# 결정 모음(11-25 대기열 42): 병합된 PR 본문의 '## 결정' 절을 DECISIONS.md 끝에 붙인다.
# 작업 PR은 DECISIONS.md 를 고치지 않고 본문에 '## 결정' 을 쓴다 → 리드가 하루 1~2번 이 스크립트로
# '결정 모음' PR(브랜치 decisions/collect-YYYYMMDD)을 낸다. DECISIONS.md 를 고치는 열린 PR이 하나뿐이라 병합 충돌이 없다.
#   사용: scripts/collect-decisions.sh [--dry-run] <PR번호…>   (병합 순서대로 주면 그 순서로 붙는다, 같은 번호는 한 번)
#   PR 본문 형식:
#     ## 결정
#     ### <결정 제목>          ← 결정마다 하나('# 제목' 도 인정). 없으면 PR 제목을 쓴다
#     - 맥락: … / - 선택: … / - 버린 안: …
#   붙는 모양: '## <병합일(KST)> <제목> (#번호)' + '<!-- collected: #번호 -->' + 본문
#   건너뜀: 이미 붙은 PR(표식 줄), 병합 안 된 PR, '## 결정' 절이 비었거나 '없음', 절에 닫지 않은 <!-- 또는 ```.
#   gh 실패(인증·네트워크·없는 번호)는 건너뛰지 않고 exit 1(파일에 쓰기 전이라 반쯤 붙지 않는다).
#   시험용: COLLECT_FIXTURE_DIR 에 <번호>.meta(상태<TAB>병합일<TAB>제목)·<번호>.body 를 두면 gh 대신 읽는다. DECISIONS_FILE 로 대상 파일을 바꾼다.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${DECISIONS_FILE:-$ROOT/DECISIONS.md}"
REPO="${COLLECT_REPO:-Piousangel/gahwamansa}"
dry=0
[ "${1:-}" = --dry-run ] && { dry=1; shift; }
[ $# -gt 0 ] || { echo "사용: $0 [--dry-run] <PR번호…>" >&2; exit 2; }

meta() { # 번호 → 상태<TAB>병합일(KST)<TAB>제목
  if [ -n "${COLLECT_FIXTURE_DIR:-}" ]; then cat "$COLLECT_FIXTURE_DIR/$1.meta"; return; fi
  gh pr view "$1" --repo "$REPO" --json state,mergedAt,title \
    --jq '[.state, (if .mergedAt then (.mergedAt | fromdate + 32400 | strftime("%Y-%m-%d")) else "" end), .title] | @tsv'
}
body() {
  if [ -n "${COLLECT_FIXTURE_DIR:-}" ]; then cat "$COLLECT_FIXTURE_DIR/$1.body"; return; fi
  gh pr view "$1" --repo "$REPO" --json body --jq .body
}
# 본문 → '## 결정' 절 안쪽(주석·CR 제거, 앞뒤 빈 줄 제거).
# ``` 코드 블록 안의 '## ' 는 절 경계·절 머리로 보지 않는다(#270 QA-1 M1, pr-evidence.sh #210 과 같은 방식).
# 머리 변형 '## 결정:'·'##결정' 도 인정(L2).
section() {
  tr -d '\r' | perl -0777 -pe 's/<!--.*?-->//gs' | awk '
    function keep() { l[++k] = $0; if (NF) { if (!a) a = k; b = k } }
    /^```/ { c = !c; if (insec) keep(); next }
    !c && (/^##[^#]/ || /^##$/) { insec = ($0 ~ /^##[[:space:]]*결정[[:space:]]*:?([[:space:]].*)?$/); next }
    insec { keep() }
    END { for (i = a; a && i <= b; i++) print l[i] }'
}
# 절 → 붙일 글. '### 제목'(또는 '# 제목') 마다 항목 하나, 없으면 PR 제목으로 항목 하나. 코드 블록 안의 '#' 줄은 본문
render() { # 번호, 날짜, PR 제목 (표준 입력: 절)
  awk -v n="$1" -v d="$2" -v t="$3" '
    function head(x) { if (started) print ""; printf "## %s %s (#%s)\n<!-- collected: #%s -->\n", d, x, n, n; started = 1 }
    function emit() { if (!started) head(t); for (; blank > 0; blank--) print ""; print }
    /^```/ { c = !c; emit(); next }
    !c && (/^### / || /^# /) { sub(/^#+ +/, ""); head($0); blank = 0; next } # 항목 사이 빈 줄은 head 가 하나만
    !c && !NF { blank++; next }
    { emit() }'
}

seen=" "
out=""
for n in "$@"; do
  n="${n#\#}"
  case "$seen" in *" $n "*) continue ;; esac # 같은 번호를 두 번 주면 한 번만
  seen+="$n "
  if grep -qF "<!-- collected: #$n -->" "$FILE"; then echo "건너뜀 #$n: 이미 붙음" >&2; continue; fi
  m="$(meta "$n")" && [ -n "$m" ] || { echo "실패 #$n: PR 정보를 못 읽음(gh 인증·번호 확인)" >&2; exit 1; }
  IFS=$'\t' read -r state date title <<< "$m"
  [ "$state" = MERGED ] || { echo "건너뜀 #$n: 병합 안 됨($state)" >&2; continue; }
  b="$(body "$n")" || { echo "실패 #$n: 본문을 못 읽음(gh 인증·번호 확인)" >&2; exit 1; }
  sec="$(printf '%s\n' "$b" | section)"
  if [ -z "$sec" ] || [ "$(printf '%s' "$sec" | tr -d '[:space:]')" = 없음 ]; then
    echo "건너뜀 #$n: '## 결정' 절 없음(머리 모양 '## 결정' 확인)" >&2; continue
  fi
  # 붙이면 DECISIONS.md 뒤쪽 렌더를 통째로 망가뜨리는 것은 붙이지 않는다
  if printf '%s\n' "$sec" | grep -q '<!--'; then
    echo "건너뜀 #$n: '## 결정' 절에 닫지 않은 <!-- — PR 본문을 고친 뒤 다시" >&2; continue
  fi
  if [ $(( $(printf '%s\n' "$sec" | grep -c '^```') % 2 )) = 1 ]; then
    echo "건너뜀 #$n: '## 결정' 절에 닫지 않은 \`\`\` — PR 본문을 고친 뒤 다시" >&2; continue
  fi
  out+=$'\n'"$(printf '%s\n' "$sec" | render "$n" "$date" "$title")"$'\n'
  echo "붙임 #$n" >&2
done

[ -n "$out" ] || { echo "붙일 결정 없음" >&2; exit 0; }
if [ "$dry" = 1 ]; then printf '%s' "$out"; exit 0; fi
[ -z "$(tail -c1 "$FILE")" ] || echo >> "$FILE" # 파일 끝 줄바꿈 보장
printf '%s' "$out" >> "$FILE"
