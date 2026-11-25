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
#   건너뜀: 이미 붙은 PR(표식 줄), 병합 안 된 PR, '## 결정' 절이 비었거나 '없음', 그리고 정본에 영구히 남으면 안 되는 것
#     (#270 QA-3): 닫지 않은 <!-- · ``` · HTML 블록 태그, 개인정보·비밀값 모양, <script·<img·원격 이미지, 200줄 또는 20KB 초과.
#     건너뜀 안내에는 종류만 쓰고 값은 출력하지 않는다.
#   gh·perl·awk 실패는 건너뛰지 않고 exit 1(파일에 쓰기 전이라 반쯤 붙지 않는다). 번호가 숫자가 아니면 exit 2.
#   시험용(COLLECT_TEST=1 일 때만 먹음): COLLECT_FIXTURE_DIR 에 <번호>.meta(상태<TAB>병합일<TAB>제목)·<번호>.body 를 두면
#     gh 대신 읽는다. DECISIONS_FILE 로 대상 파일, COLLECT_REPO 로 저장소를 바꾼다.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/DECISIONS.md"; REPO=Piousangel/gahwamansa; FIXTURE=""
if [ "${COLLECT_TEST:-}" = 1 ]; then
  FILE="${DECISIONS_FILE:-$FILE}"; REPO="${COLLECT_REPO:-$REPO}"; FIXTURE="${COLLECT_FIXTURE_DIR:-}"
fi
MAX_LINES=200 MAX_BYTES=20480
dry=0
[ "${1:-}" = --dry-run ] && { dry=1; shift; }
[ $# -gt 0 ] || { echo "사용: $0 [--dry-run] <PR번호…>" >&2; exit 2; }
for n in "$@"; do
  printf '%s' "${n#\#}" | grep -qE '^[0-9]+$' || { echo "잘못된 PR 번호(숫자만): $n" >&2; exit 2; }
done

meta() { # 번호 → 상태<TAB>병합일(KST)<TAB>제목
  if [ -n "$FIXTURE" ]; then cat "$FIXTURE/$1.meta"; return; fi
  gh pr view "$1" --repo "$REPO" --json state,mergedAt,title \
    --jq '[.state, (if .mergedAt then (.mergedAt | fromdate + 32400 | strftime("%Y-%m-%d")) else "" end), .title] | @tsv'
}
body() {
  if [ -n "$FIXTURE" ]; then cat "$FIXTURE/$1.body"; return; fi
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
# 절 → 붙이면 안 되는 것의 종류(첫 하나) 또는 빈 출력. 값은 내보내지 않는다(#270 QA-3).
unsafe() {
  local s="$1" o t open close
  if [ $(( $(printf '%s\n' "$s" | wc -l) )) -gt $MAX_LINES ] || [ $(( $(printf '%s' "$s" | wc -c) )) -gt $MAX_BYTES ]; then
    echo "${MAX_LINES}줄 또는 $((MAX_BYTES / 1024))KB 초과(줄여서)"; return
  fi
  # 렌더를 뒤까지 망가뜨리는 것: 닫지 않은 주석·코드 블록
  printf '%s\n' "$s" | grep -q '<!--' && { echo '닫지 않은 <!--'; return; }
  [ $(( $(printf '%s\n' "$s" | grep -c '^```') % 2 )) = 0 ] || { echo '닫지 않은 ```'; return; }
  # 개인정보·비밀값 모양(코드 블록 안도 본다)
  printf '%s\n' "$s" | grep -qE '(^|[^0-9])01[016789][-. ]?[0-9]{3,4}[-. ]?[0-9]{4}([^0-9]|$)|(^|[^0-9])0[2-6][0-9]?-[0-9]{3,4}-[0-9]{4}([^0-9]|$)' \
    && { echo '전화번호 모양'; return; }
  printf '%s\n' "$s" | grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' && { echo '이메일 모양'; return; }
  printf '%s\n' "$s" | grep -qE '(^|[^0-9])[0-9]{6}-[1-4][0-9]{6}([^0-9]|$)' && { echo '주민등록번호 모양'; return; }
  printf '%s\n' "$s" | grep -qE 'sb_secret_|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}' \
    && { echo '비밀값 모양(sb_secret·JWT·개인키 등)'; return; }
  # 코드 블록·코드 스팬 밖의 HTML
  o="$(printf '%s\n' "$s" | awk '/^```/ { c = !c; next } !c' | sed 's/`[^`]*`//g')"
  printf '%s\n' "$o" | grep -qiE '<(script|img|iframe)([[:space:]>/]|$)|!\[[^]]*\]\([[:space:]]*<?https?:' \
    && { echo '<script·<img·원격 이미지'; return; }
  for t in details summary div table thead tbody tr td th pre blockquote section span p a sub sup; do
    open=$(( $(printf '%s\n' "$o" | grep -oiE "<$t([[:space:]][^>]*)?>" | wc -l) ))
    close=$(( $(printf '%s\n' "$o" | grep -oiE "</$t[[:space:]]*>" | wc -l) ))
    [ "$open" = "$close" ] || { echo "짝이 안 맞는 HTML 태그 <$t>"; return; }
  done
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
  sec="$(printf '%s\n' "$b" | section)" || { echo "실패 #$n: 본문 절 자르기(perl·awk) 실패" >&2; exit 1; }
  if [ -z "$sec" ] || [ "$(printf '%s' "$sec" | tr -d '[:space:]')" = 없음 ]; then
    echo "건너뜀 #$n: '## 결정' 절 없음(머리 모양 '## 결정' 확인)" >&2; continue
  fi
  why="$(unsafe "$sec")"
  if [ -n "$why" ]; then echo "건너뜀 #$n: '## 결정' 절에 $why — PR 본문을 고친 뒤 다시" >&2; continue; fi
  why="$(unsafe "$title")" # 제목도 항목 머리로 붙을 수 있는 외부 입력
  if [ -n "$why" ]; then echo "건너뜀 #$n: PR 제목에 $why — 제목을 고친 뒤 다시" >&2; continue; fi
  r="$(printf '%s\n' "$sec" | render "$n" "$date" "$title")" || { echo "실패 #$n: 항목 만들기(awk) 실패" >&2; exit 1; }
  out+=$'\n'"$r"$'\n'
  echo "붙임 #$n" >&2
done

[ -n "$out" ] || { echo "붙일 결정 없음" >&2; exit 0; }
if [ "$dry" = 1 ]; then printf '%s' "$out"; exit 0; fi
[ -z "$(tail -c1 "$FILE")" ] || echo >> "$FILE" # 파일 끝 줄바꿈 보장
printf '%s' "$out" >> "$FILE"
