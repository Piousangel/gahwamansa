# 결정 기록은 docs/decisions/ 에 파일 하나씩 (DECISIONS.md 붙여 쓰기 중단)

- 날짜: 2026-11-25
- 관련 PR: 이 PR (platform/decisions-per-file, 대기열 42)

- 맥락: 모든 PR이 루트 `DECISIONS.md` 끝에 붙여 써서, 하나가 병합되면 다른 열린 PR이 전부 충돌했다(11-25 하루 6회+). GitHub 병합은 `.gitattributes merge=union` 을 쓰지 않아 설정으로 못 푼다.
- 선택: 새 결정은 `docs/decisions/YYYY-MM-DD-<slug>.md` 파일 하나(머리: 제목·날짜·관련 PR). `DECISIONS.md` 는 지우지 않고 맨 위에 안내만 더하고 그 아래 기존 내용 그대로(지운 파일 0 규칙, 역사 보존). 이 파일 이후 `DECISIONS.md` 에 새 항목을 붙이면 CI `decisions` 가 경고한다(막지 않음, pr-guard 와 같은 원칙).
- 색인: `scripts/decisions-index.sh` 로 필요할 때 만들고 **커밋하지 않는다**(`.gitignore`). 리드 제안은 '색인 커밋 + CI 최신 검사'였지만, 색인을 커밋하면 같은 날 항목 두 개가 색인의 이웃 줄이 되어 두 PR이 다시 충돌한다(최신 검사는 그 충돌을 늦게 알려 줄 뿐). 폴더 목록이 이미 날짜순 색인이다. CI 는 대신 항목 형식(이름·제목·날짜 일치·관련 PR)을 검사한다 — 형식이 틀린 항목은 실패(exit 1).
- 버린 안: ① `.gitattributes merge=union`(GitHub 웹 병합이 무시) ② 리드만 DECISIONS.md 에 쓰기(병목, 결정과 PR이 떨어짐) ③ 색인 커밋 + 최신 검사(위 이유) ④ 날짜별 파일(`2026-11-25.md`, 같은 날 PR끼리 그대로 충돌).
- 약점: 같은 날짜끼리 순서는 slug 알파벳이라 정확한 시간 순서가 아니다. 같은 이름을 두 PR이 만들면 add/add 충돌(드묾, slug를 구체적으로).
