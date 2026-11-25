#!/usr/bin/env bash
# collect-decisions.sh 고정 시험(대기열 42). gh 대신 고정 PR 파일을 읽는다. 실패하면 exit 1.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
S="$HERE/collect-decisions.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0
check() { # 이름, 기대, 실제
  if [ "$2" = "$3" ]; then echo "ok   $1"; else printf 'FAIL %s\n--- 기대\n%s\n--- 실제\n%s\n' "$1" "$2" "$3"; fail=1; fi
}
pr() { # 번호, 상태, 날짜, 제목 (표준 입력: 본문)
  printf '%s\t%s\t%s\n' "$2" "$3" "$4" > "$T/$1.meta"; cat > "$T/$1.body"
}
export COLLECT_TEST=1 COLLECT_FIXTURE_DIR="$T" DECISIONS_FILE="$T/DECISIONS.md"
NOSEC="'## 결정' 절 없음(머리 모양 '## 결정' 확인)"
printf '# DECISIONS\n\n## 2026-11-24 옛 결정\n- 옛 본문' > "$DECISIONS_FILE" # 끝 줄바꿈 없음

# 템플릿 주석·CR·다른 절 섞인 본문, '### 제목' 두 개
printf '## 목적\n무엇\r\n\r\n## 결정\r\n<!-- 템플릿 안내\n여러 줄 -->\r\n\r\n### 결정 A\r\n- 선택: a\r\n\r\n### 결정 B\n- 선택: b\n- 버린 안: c\n\n## 증거\n- 캡처\n' | pr 101 MERGED 2026-11-25 'PR 제목 101'
# '### ' 없는 절 → PR 제목으로
printf '## 결정\n- 선택: 하나\n' | pr 102 MERGED 2026-11-26 'feat: 하나 고름'
# 건너뛸 것들
printf '## 결정\n- 선택: x\n' | pr 103 OPEN '' '열린 PR'
printf '## 결정\n<!-- 안내만 -->\n\n## 증거\n- y\n' | pr 104 MERGED 2026-11-26 '빈 절'
printf '## 결정\n없음\n' | pr 105 MERGED 2026-11-26 '없음'
printf '## 목적\n결정 절이 아예 없음\n' | pr 106 MERGED 2026-11-26 '절 없음'

bash "$S" 101 '#102' 103 104 105 106 2> "$T.err"
check "종료 코드 0" 0 "$?"
expected='# DECISIONS

## 2026-11-24 옛 결정
- 옛 본문

## 2026-11-25 결정 A (#101)
<!-- collected: #101 -->
- 선택: a

## 2026-11-25 결정 B (#101)
<!-- collected: #101 -->
- 선택: b
- 버린 안: c

## 2026-11-26 feat: 하나 고름 (#102)
<!-- collected: #102 -->
- 선택: 하나'
check "끝에 붙임: 병합일·제목·번호·표식, '### '마다 항목, 주석·CR·다른 절 제외, 끝 줄바꿈 보정" "$expected" "$(cat "$DECISIONS_FILE")"
check "건너뜀 사유: 열림·빈 절·없음·절 없음" \
  "$(printf '%s\n' '붙임 #101' '붙임 #102' '건너뜀 #103: 병합 안 됨(OPEN)' "건너뜀 #104: $NOSEC" "건너뜀 #105: $NOSEC" "건너뜀 #106: $NOSEC")" \
  "$(cat "$T.err")"

before="$(cat "$DECISIONS_FILE")"
bash "$S" 101 102 2> "$T.err"
check "두 번 돌려도 그대로(이미 붙은 PR 건너뜀)" "$before" "$(cat "$DECISIONS_FILE")"
check "이미 붙음 사유" "$(printf '%s\n' '건너뜀 #101: 이미 붙음' '건너뜀 #102: 이미 붙음' '붙일 결정 없음')" "$(cat "$T.err")"

printf '## 결정\n### 새 것\n- 선택: z\n' | pr 107 MERGED 2026-11-27 '새'
dry="$(bash "$S" --dry-run 107 2>/dev/null)"
check "--dry-run 은 출력만, 파일은 그대로" "$before" "$(cat "$DECISIONS_FILE")"
check "--dry-run 출력" "$(printf '\n## 2026-11-27 새 것 (#107)\n<!-- collected: #107 -->\n- 선택: z')" "$dry"
pr 108 MERGED 2026-11-27 '템플릿 그대로' < "$HERE/../.github/pull_request_template.md"
check "PR 템플릿 원문('## 결정' 은 안내 주석뿐) → 건너뜀" "건너뜀 #108: $NOSEC" "$(bash "$S" --dry-run 108 2>&1 >/dev/null | head -1)"

# #270 QA-1 M1: 코드 블록 안의 '## ' 는 절 경계가 아니다
printf '## 결정\n### 코드 있는 결정\n- 선택: 아래 설정\n```md\n## 예시 제목\n\n# 주석 아님\n```\n- 버린 안: 끝까지 붙어야 함\n## 증거\n- x\n' | pr 110 MERGED 2026-11-27 'm1a'
check "M1: 결정 안 코드 블록의 '## '·'# '·빈 줄에서 자르지 않고 코드 블록을 닫힌 채로 붙임" \
  "$(printf '\n## 2026-11-27 코드 있는 결정 (#110)\n<!-- collected: #110 -->\n- 선택: 아래 설정\n```md\n## 예시 제목\n\n# 주석 아님\n```\n- 버린 안: 끝까지 붙어야 함')" \
  "$(bash "$S" --dry-run 110 2>/dev/null)"
printf '## 증거\n```\n## 결정\n- 가짜\n```\n## 검증\nok\n' | pr 111 MERGED 2026-11-27 'm1b'
check "M1: 다른 절 코드 블록 안의 가짜 '## 결정' 은 붙이지 않음" "건너뜀 #111: $NOSEC" "$(bash "$S" --dry-run 111 2>&1 >/dev/null | head -1)"
printf '## 결정\n- 선택: x\n```\n## 닫지 않음\n' | pr 112 MERGED 2026-11-27 'open fence'
check "닫지 않은 \`\`\` → 건너뜀" "건너뜀 #112: '## 결정' 절에 닫지 않은 \`\`\` — PR 본문을 고친 뒤 다시" "$(bash "$S" --dry-run 112 2>&1 >/dev/null | head -1)"
# L1·L2
printf '## 결정\n<!-- 안내를 지우다 반만 남김\n### 제목\n- 선택: x\n' | pr 113 MERGED 2026-11-27 'open comment'
check "L1: 닫지 않은 <!-- → 건너뜀" "건너뜀 #113: '## 결정' 절에 닫지 않은 <!-- — PR 본문을 고친 뒤 다시" "$(bash "$S" --dry-run 113 2>&1 >/dev/null | head -1)"
printf '## 결정:\n# 큰 제목으로 씀\n- 선택: y\n' | pr 114 MERGED 2026-11-27 'h1'
check "L1·L2: '## 결정:' 머리 인정, '# 제목' 은 항목 제목" \
  "$(printf '\n## 2026-11-27 큰 제목으로 씀 (#114)\n<!-- collected: #114 -->\n- 선택: y')" "$(bash "$S" --dry-run 114 2>/dev/null)"
# L3·L4
check "L3: 같은 번호 두 번 → 한 번만" 1 "$(bash "$S" --dry-run 114 '#114' 114 2>/dev/null | grep -c '^## ')"
check "L4: PR 정보를 못 읽으면(gh 실패) 건너뛰지 않고 exit 1" "1 실패 #999: PR 정보를 못 읽음(gh 인증·번호 확인)" \
  "$(bash "$S" --dry-run 114 999 2> "$T.err" >/dev/null; echo $?) $(grep '^실패' "$T.err")"

# #270 QA-3: 정본에 영구히 남으면 안 되는 것은 건너뛴다. 안내에는 종류만, 값은 내보내지 않는다
skip() { # 번호, 본문(printf 형식), 기대 종류, 시험 이름
  printf "$2" | pr "$1" MERGED 2026-11-28 "qa3-$1"
  local err; err="$(bash "$S" --dry-run "$1" 2>&1 >/dev/null | head -1)"
  check "$4" "건너뜀 #$1: '## 결정' 절에 $3 — PR 본문을 고친 뒤 다시" "$err"
}
skip 120 '## 결정\n- 연락: 010-1234-5678\n' '전화번호 모양' "① 휴대전화 → 건너뜀"
skip 121 '## 결정\n- 담당: 02-123-4567\n' '전화번호 모양' "① 지역 전화(코드 블록 밖) → 건너뜀"
skip 122 '## 결정\n- 문의: someone@example.com\n' '이메일 모양' "① 이메일 → 건너뜀"
skip 123 '## 결정\n- 900101-1234567\n' '주민등록번호 모양' "① 주민번호 모양 → 건너뜀"
skip 124 '## 결정\n```\nKEY=sb_secret_abcdef\n```\n' '비밀값 모양(sb_secret·JWT·개인키 등)' "① 코드 블록 안 sb_secret 도 → 건너뜀"
skip 125 '## 결정\n- eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x\n' '비밀값 모양(sb_secret·JWT·개인키 등)' "① service_role JWT 모양 → 건너뜀"
skip 126 '## 결정\n<script>alert(1)</script>\n' '<script·<img·원격 이미지' "② <script → 건너뜀"
skip 127 '## 결정\n- 화면 ![x](https://evil.example/p.png)\n' '<script·<img·원격 이미지' "② 원격 이미지 마크다운 → 건너뜀"
skip 128 '## 결정\n<IMG src="https://evil.example/t.png">\n' '<script·<img·원격 이미지' "② <img(대문자) → 건너뜀"
skip 129 '## 결정\n<details><summary>접기</summary>\n- 선택: x\n' '짝이 안 맞는 HTML 태그 <details>' "③ 닫지 않은 <details> → 건너뜀"
skip 130 '## 결정\n- 선택: x\n</div>\n' '짝이 안 맞는 HTML 태그 <div>' "③ 닫는 태그만 → 건너뜀"
printf '## 결정\n' > "$T/131.body"; for i in $(seq 1 201); do echo "- 줄 $i" >> "$T/131.body"; done
printf 'MERGED\t2026-11-28\tlong\n' > "$T/131.meta"
check "④ 200줄 초과 → 건너뜀" "건너뜀 #131: '## 결정' 절에 200줄 또는 20KB 초과(줄여서) — PR 본문을 고친 뒤 다시" "$(bash "$S" --dry-run 131 2>&1 >/dev/null | head -1)"
{ printf '## 결정\n- '; head -c 21000 /dev/zero | tr '\0' 'x'; echo; } > "$T/132.body"; printf 'MERGED\t2026-11-28\tbig\n' > "$T/132.meta"
check "④ 20KB 초과(한 줄) → 건너뜀" "건너뜀 #132: '## 결정' 절에 200줄 또는 20KB 초과(줄여서) — PR 본문을 고친 뒤 다시" "$(bash "$S" --dry-run 132 2>&1 >/dev/null | head -1)"
check "건너뜀 안내에 값이 나오지 않음(전화·이메일·비밀값)" 0 "$(bash "$S" --dry-run 120 122 124 2>&1 | grep -cE '010-1234|someone@|sb_secret_abc')"
printf '## 결정\n### 허용되는 것\n- 코드 스팬 `<img>`·`<details>` 와 코드 블록:\n```html\n<div><script>x</script>\n```\n- 링크 [문서](https://example.com) 와 <details><summary>요약</summary>본문</details>\n- 날짜 2026-11-28, 버전 0.10.1\n' | pr 133 MERGED 2026-11-28 'ok'
check "통과: 코드 스팬·코드 블록 안 HTML, 링크, 짝 맞는 <details>, 날짜·버전 숫자" "붙임 #133" "$(bash "$S" --dry-run 133 2>&1 >/dev/null | head -1)"
printf '## 결정\n- 선택: x\n' | pr 134 MERGED 2026-11-28 '제목에 <img src=x>'
check "PR 제목도 같은 검사(<img) → 건너뜀" "건너뜀 #134: PR 제목에 <script·<img·원격 이미지 — 제목을 고친 뒤 다시" "$(bash "$S" --dry-run 134 2>&1 >/dev/null | head -1)"

# L: 번호 숫자 검사, 시험용 env 는 COLLECT_TEST=1 일 때만, perl 실패는 exit 1
check "L: 숫자가 아닌 번호 → exit 2(파일·gh 접근 전)" 2 "$(bash "$S" --dry-run '../../etc/passwd' 2>/dev/null; echo $?)"
mkdir -p "$T/bin"; printf '#!/bin/sh\necho STUB\n' > "$T/bin/gh"; chmod +x "$T/bin/gh"
check "L: COLLECT_TEST 없으면 고정 파일을 무시하고 gh 를 부른다" "건너뜀 #101: 병합 안 됨(STUB)" \
  "$(COLLECT_TEST= PATH="$T/bin:$PATH" bash "$S" --dry-run 101 2>&1 >/dev/null | head -1)"
mkdir -p "$T/bin2"; printf '#!/bin/sh\nexit 3\n' > "$T/bin2/perl"; chmod +x "$T/bin2/perl"
check "L: perl 실패는 '절 없음'이 아니라 exit 1" "1 실패 #107: 본문 절 자르기(perl·awk) 실패" \
  "$(PATH="$T/bin2:$PATH" bash "$S" --dry-run 107 2> "$T.err" >/dev/null; echo $?) $(head -1 "$T.err")"
check "인자 없으면 exit 2" 2 "$(bash "$S" 2>/dev/null; echo $?)"
rm -f "$T.err"
exit "$fail"
