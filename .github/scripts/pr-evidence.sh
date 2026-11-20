#!/usr/bin/env bash
# PR 가드: '## 증거' 칸·위험 영역 리뷰 인원(경고만, 막지 않음). DECISIONS 11-20 운영 규칙, #180 리뷰 반영.
#   pr-evidence.sh                    # CI: BASE_SHA·HEAD_SHA·PR_BODY·GITHUB_STEP_SUMMARY 를 env 로
#   pr-evidence.sh --count-evidence   # 표준 입력의 본문에서 증거 줄 수만(테스트용)
#   pr-evidence.sh --risk-files       # 표준 입력의 파일 목록 중 위험 영역(코드 파일만)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RISK_FILE="${RISK_FILE:-$HERE/../risk-paths.txt}"

# 본문의 '## 증거' 절에서 실제 내용 줄 수. 주석(<!-- -->, 여러 줄 포함)을 **먼저** 지우고 절을 자른다(리뷰 H)
count_evidence() {
  tr -d '\r' | perl -0777 -pe 's/<!--.*?-->//gs' |
    awk '/^## 증거/{f=1;next} /^## /{f=0} f' |
    grep -c -v -E '^[[:space:]]*$' || true
}
# 문서(docs/·*.md)를 뺀 코드 파일
code_files() { grep -v -E '^docs/|\.md$' || true; }
risk_patterns() { grep -v -E '^[[:space:]]*(#|$)' "$RISK_FILE"; }
# 위험 영역 판정은 코드 파일로만(리뷰 M1), 경로 목록은 risk-paths.txt 하나(M2)
risk_files() { code_files | grep -E -f <(risk_patterns) || true; }

case "${1:-}" in
  --count-evidence) count_evidence; exit 0 ;;
  --risk-files) risk_files; exit 0 ;;
esac

files="$(git diff --name-only "$BASE_SHA...$HEAD_SHA")"
code=$(printf '%s\n' "$files" | code_files | grep -c . || true)
risky="$(printf '%s\n' "$files" | risk_files)"
risk=$(printf '%s\n' "$risky" | grep -c . || true)
has_heading=$(printf '%s\n' "${PR_BODY:-}" | tr -d '\r' | grep -c -E '^## 증거' || true)
evidence=$(printf '%s\n' "${PR_BODY:-}" | count_evidence)
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
if [ "$risk" -gt 0 ]; then
  echo "::notice title=리뷰 2명::위험 영역 코드 파일 ${risk}개 — 리뷰 2명 필요"
fi
