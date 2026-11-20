#!/usr/bin/env bash
# pr-evidence.sh 의 판정을 고정한다(#180 리뷰). pr-guard 가 먼저 돌린다. 실패하면 exit 1.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
S="$HERE/pr-evidence.sh"
TEMPLATE="$HERE/../pull_request_template.md"
fail=0
check() { # 이름, 기대, 실제
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: 기대 '$2', 실제 '$3'"; fail=1; fi
}

check "템플릿 원문(여러 줄 주석만) → 증거 0" 0 "$(bash "$S" --count-evidence < "$TEMPLATE")"
with_line="$(perl -0777 -pe 's/(## 증거\n)/$1- 전: a.png\n/' "$TEMPLATE")"
check "템플릿 + 실제 한 줄 → 증거 1" 1 "$(printf '%s\n' "$with_line" | bash "$S" --count-evidence)"
check "제목 뒤 글자가 있어도 '## 증거' 로 시작하면 인정" 1 "$(printf '## 증거 (캡처)\n- 녹화 b.mp4\n## 검증\nok\n' | bash "$S" --count-evidence)"
check "증거 절이 없으면 0" 0 "$(printf '## 목적\n무엇\n' | bash "$S" --count-evidence)"
check "한 줄 주석 + 빈 줄만 → 0" 0 "$(printf '## 증거\n<!-- x -->\n\n## 검증\n' | bash "$S" --count-evidence)"

risk="$(printf '%s\n' docs/team/consent-notes.md app/src/features/link/ConsentScreen.tsx app/src/ui/ds/Button.tsx supabase/functions/kakao-unlink/index.ts README.md .github/workflows/app.yml app/src/api/contract/deleteScope.ts | bash "$S" --risk-files | tr '\n' ' ')"
check "위험 영역은 코드 파일만(docs·md 제외), 목록 파일의 경로를 잡는다" \
  "app/src/features/link/ConsentScreen.tsx supabase/functions/kakao-unlink/index.ts .github/workflows/app.yml app/src/api/contract/deleteScope.ts " "$risk"

self="$(printf '%s\n' .github/risk-paths.txt .github/scripts/pr-evidence.sh app/src/features/family/ParentFamilyScreen.tsx app/src/ui/foldPush.ts | bash "$S" --risk-files | tr '\n' ' ')"
check "검사 자신(목록·스크립트)과 가족 화면 지우기 입구도 위험 영역, foldPush 는 아님" \
  ".github/risk-paths.txt .github/scripts/pr-evidence.sh app/src/features/family/ParentFamilyScreen.tsx " "$self"

exit $fail
