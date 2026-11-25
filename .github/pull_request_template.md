## 목적
<!-- 무엇을 왜. 안건·리뷰 번호(예: W-09, #150 M1)
     결정을 남길 때는 DECISIONS.md 가 아니라 docs/decisions/YYYY-MM-DD-<slug>.md 새 파일(형식: docs/decisions/README.md) -->

## 변경
<!-- 파일 단위로 짧게 -->

## 증거
<!-- 코드 PR 은 필수(문서만 바꾼 PR 은 생략). pr-guard 가 비어 있으면 경고한다(막지 않음).
     - 화면: 전·후 캡처 또는 녹화(기기·배율·빌드 종류)
     - 버그: 재현 → 수정 → 같은 재현이 통과(수정 전 코드에서 실패한 테스트·캡처)
     - 그 밖: 실행한 명령과 결과
     - 검사(app/__tests__·app/e2e·scripts/audit)를 더하거나 바꿨으면 아래 줄 필수(헛통과 방지, 없으면 pr-guard 경고) -->
- 실패 확인: <!-- 일부러 깨뜨린 변경 → 실패 출력(예: Button 여백 0 → 8 → 'align start' 테스트 Expected 0 Received 8) -->

## 검증
<!-- tsc · eslint · npm test(횟수와 결과) · 빌드. 못 돌린 것은 명시 -->

## 리뷰
<!-- 위험 영역(경로 목록: .github/risk-paths.txt — 삭제·동의·푸시·DB·인증·약관·계측·권한)은 리뷰 2명, 일반 코드 1명, 내부 문서는 리드 확인만 -->
