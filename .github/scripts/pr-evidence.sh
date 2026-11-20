#!/usr/bin/env bash
# PR 가드: '## 증거' 칸·위험 영역 리뷰 인원(경고만, 막지 않음). DECISIONS 11-20 운영 규칙, #180 리뷰 반영.
#   pr-evidence.sh                    # CI: BASE_SHA·HEAD_SHA·PR_BODY·GITHUB_STEP_SUMMARY 를 env 로
#   pr-evidence.sh --count-evidence   # 표준 입력의 본문에서 증거 줄 수만(테스트용)
#   pr-evidence.sh --risk-files       # 표준 입력의 파일 목록 중 위험 영역(코드 파일만)
#   pr-evidence.sh --test-files       # 표준 입력의 파일 목록 중 검사 파일(app/__tests__·app/e2e·scripts/audit·supabase/tests·app/__integration__·*.test.ts(x)·*.test.sh)
#   pr-evidence.sh --has-fail-check   # 표준 입력의 본문 '## 증거' 절에 '실패 확인 … → …' 줄이 있으면 1, 없으면 0
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RISK_FILE="${RISK_FILE:-$HERE/../risk-paths.txt}"

# '## 증거' 절만 꺼낸다. 주석(<!-- -->)을 먼저 지우고, ``` 코드 블록 안의 '## ' 는 절 끝으로 보지 않는다(#210 리뷰 L)
evidence_section() {
  tr -d '\r' | perl -0777 -pe 's/<!--.*?-->//gs' |
    awk '/^```/{if(f)print; c=!c; next} !c && /^## 증거/{f=1;next} !c && /^## /{f=0} f'
}
# 본문의 '## 증거' 절에서 실제 내용 줄 수. 주석(<!-- -->, 여러 줄 포함)을 **먼저** 지우고 절을 자른다(리뷰 H). 템플릿의 빈 '- 실패 확인:' 줄은 내용으로 치지 않는다
count_evidence() {
  evidence_section |
    grep -v -E '^[[:space:]]*-?[[:space:]]*실패 확인:?[[:space:]]*$' |
    grep -c -v -E '^[[:space:]]*$' || true
}
# '## 증거' 절에 '실패 확인' 줄(형식: 실패 확인: 일부러 깨뜨린 변경 → 실패 출력)이 있는가. 헛통과 테스트 방지(DECISIONS 11-20, #163·#205)
# '실패 확인' 줄은 **긍정 증거**가 있어야 인정한다(#214 리뷰·리드 결정: 부정 낱말 목록으로 막지 않는다).
# 화살표(→·->) 뒤에 실패 출력 표지(Expected·Received·FAIL·✕·Error·exit 1~9·'실패')가 있어야 한다. 예: '여백 0 → 8 → Expected 0 Received 8'
FAIL_MARK='(Expected|Received|FAIL|✕|Error|exit [1-9]|실패)'
has_fail_check() {
  evidence_section |
    grep -c -E "실패 확인.*(→|->).*$FAIL_MARK" || true
}
# 검사를 더하거나 바꾼 파일. 문서(.md)는 뺀다(#210 리뷰 M: 서버 테스트·통합 테스트·어디 있든 *.test.ts(x)·*.test.sh 포함)
test_files() { grep -E '^app/__tests__/|^app/e2e/|(^|/)scripts/audit/|^supabase/tests/|^app/__integration__/|\.test\.(tsx?|sh)$' | grep -v -E '\.md$' || true; }
# 문서(docs/·*.md)를 뺀 코드 파일
code_files() { grep -v -E '^docs/|\.md$' || true; }
risk_patterns() { grep -v -E '^[[:space:]]*(#|$)' "$RISK_FILE"; }
# 위험 영역 판정은 코드 파일로만(리뷰 M1), 경로 목록은 risk-paths.txt 하나(M2)
risk_files() { code_files | grep -E -f <(risk_patterns) || true; }

case "${1:-}" in
  --count-evidence) count_evidence; exit 0 ;;
  --risk-files) risk_files; exit 0 ;;
  --test-files) test_files; exit 0 ;;
  --has-fail-check) has_fail_check; exit 0 ;;
esac

files="$(git diff --name-only "$BASE_SHA...$HEAD_SHA")"
# 지운 파일은 검사 파일 수에서 뺀다(#210 리뷰 L): 테스트를 지우기만 한 PR 은 '실패 확인' 대상이 아니다
kept="$(git diff --name-only --diff-filter=d "$BASE_SHA...$HEAD_SHA")"
code=$(printf '%s\n' "$files" | code_files | grep -c . || true)
risky="$(printf '%s\n' "$files" | risk_files)"
risk=$(printf '%s\n' "$risky" | grep -c . || true)
has_heading=$(printf '%s\n' "${PR_BODY:-}" | tr -d '\r' | grep -c -E '^## 증거' || true)
evidence=$(printf '%s\n' "${PR_BODY:-}" | count_evidence)
tests=$(printf '%s\n' "$kept" | test_files | grep -c . || true)
failcheck=$(printf '%s\n' "${PR_BODY:-}" | has_fail_check)
{
  echo "### PR 가드"
  if [ "$code" -eq 0 ]; then
    echo "- 문서만 바꾼 PR: 증거 칸 검사 생략(리드 확인만)"
  elif [ "$has_heading" -eq 0 ]; then
    echo "- 본문에 '## 증거' 칸이 없어요(캡처·녹화, 재현 → 수정 → 같은 재현 통과)"
  elif [ "$evidence" -eq 0 ]; then
    echo "- '## 증거' 칸이 비어 있어요(템플릿 주석만 있음)"
  else
    echo "- 증거 칸: 있음(${evidence}줄)"
  fi
  if [ "$tests" -gt 0 ]; then
    if [ "$failcheck" -eq 0 ]; then
      echo "- 검사 파일(${tests}개)을 바꿨는데 '## 증거' 에 **'실패 확인' 줄이 없어요**(일부러 깨뜨린 변경 → 실패 출력)"
    else
      echo "- 실패 확인: 있음(검사 파일 ${tests}개)"
    fi
  fi
  if [ "$risk" -gt 0 ]; then
    echo "- 위험 영역(.github/risk-paths.txt)을 건드림: **리뷰 2명 필요**"
    echo '```'
    printf '%s\n' "$risky" | head -30
    echo '```'
  fi
} >> "$GITHUB_STEP_SUMMARY"
if [ "$code" -gt 0 ] && [ "$evidence" -eq 0 ]; then
  echo "::warning title=증거 칸::PR 본문 '## 증거' 칸이 없거나 비어 있어요(캡처·녹화, 재현 → 수정 → 같은 재현 통과)"
fi
if [ "$tests" -gt 0 ] && [ "$failcheck" -eq 0 ]; then
  echo "::warning title=실패 확인::검사 파일(app/__tests__·app/e2e·scripts/audit·supabase/tests·app/__integration__·*.test.*)을 바꾼 PR 은 '## 증거' 에 '실패 확인: 일부러 깨뜨린 변경 → 실패 출력' 줄이 필요해요(헛통과 방지)"
fi
if [ "$risk" -gt 0 ]; then
  echo "::notice title=리뷰 2명::위험 영역 코드 파일 ${risk}개 — 리뷰 2명 필요"
fi
