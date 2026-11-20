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

# 헛통과 방지: 검사 파일을 바꾼 PR 의 '실패 확인' 줄(DECISIONS 11-20)
tf="$(printf '%s\n' app/__tests__/dsTag.test.tsx app/e2e/common/x.yaml scripts/audit/fold-check.sh app/scripts/audit/a.js app/src/ui/ds/Tag.tsx app/e2e/README.md docs/x.md app/testUtils/flow.tsx | bash "$S" --test-files | tr '\n' ' ')"
check "검사 파일 = app/__tests__·app/e2e·scripts/audit(코드만, README 제외)" \
  "app/__tests__/dsTag.test.tsx app/e2e/common/x.yaml scripts/audit/fold-check.sh app/scripts/audit/a.js " "$tf"
check "템플릿 원문(빈 '실패 확인:' 줄) → 실패 확인 0" 0 "$(bash "$S" --has-fail-check < "$TEMPLATE")"
check "템플릿 원문 → 증거 0(빈 '실패 확인:' 줄은 내용 아님)" 0 "$(bash "$S" --count-evidence < "$TEMPLATE")"
filled="$(perl -0777 -pe 's/- 실패 확인: <!--.*?-->/- 실패 확인: 여백 0 → 8 → align start 테스트 Expected 0 Received 8/s' "$TEMPLATE")"
check "'실패 확인: 깨뜨린 변경 → 실패 출력' 을 채우면 1" 1 "$(printf '%s\n' "$filled" | bash "$S" --has-fail-check)"
check "화살표(→·->) 없이 '실패 확인' 만 쓰면 0" 0 "$(printf '## 증거\n- 실패 확인: 했음\n' | bash "$S" --has-fail-check)"
check "'## 증거' 밖(검증 절)의 실패 확인은 세지 않음" 0 "$(printf '## 증거\n- 캡처 a.png\n## 검증\n- 실패 확인: a -> b\n' | bash "$S" --has-fail-check)"
check "ASCII 화살표 -> 도 인정" 1 "$(printf '## 증거\n실패 확인: x -> y 실패\n' | bash "$S" --has-fail-check)"

# 끝에서 끝: 검사 파일을 바꾼 PR 에 실패 확인이 없으면 경고가 실제로 뜬다(일부러 넣은 위반)
tmp="$(mktemp -d)"
(
  cd "$tmp" && git init -q && git config user.email t@t && git config user.name t &&
    mkdir -p app/__tests__ && echo a > app/__tests__/a.test.ts && git add . && git commit -qm base &&
    echo b >> app/__tests__/a.test.ts && git commit -qam head
) >/dev/null 2>&1
base="$(git -C "$tmp" rev-parse HEAD~1)"; head="$(git -C "$tmp" rev-parse HEAD)"
out_no="$(cd "$tmp" && BASE_SHA=$base HEAD_SHA=$head PR_BODY=$'## 증거\n- jest 통과' GITHUB_STEP_SUMMARY=/dev/null RISK_FILE="$HERE/../risk-paths.txt" bash "$S")"
out_ok="$(cd "$tmp" && BASE_SHA=$base HEAD_SHA=$head PR_BODY=$'## 증거\n- jest 통과\n- 실패 확인: 기대값 1 → 2 → Expected 1 Received 2' GITHUB_STEP_SUMMARY=/dev/null RISK_FILE="$HERE/../risk-paths.txt" bash "$S")"
check "끝에서 끝: 실패 확인 없음 → ::warning 실패 확인" 1 "$(printf '%s\n' "$out_no" | grep -c 'title=실패 확인' || true)"
check "끝에서 끝: 실패 확인 있음 → 경고 없음" 0 "$(printf '%s\n' "$out_ok" | grep -c 'title=실패 확인' || true)"
rm -rf "$tmp"

exit $fail
