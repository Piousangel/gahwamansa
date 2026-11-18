# Maestro 흐름 후보 목록 — 독립 UX 감사관용 (L5 디자인, 2026-11-18)

## 목적과 범위
- **목적**: QA-02 실기기 캡처가 나오기 전에 독립 감사관(§3.6)이 에뮬레이터에서 화면·상태를 순서대로 볼 수 있게, AU-12 하네스로 만들 흐름 후보를 화면·상태별로 정리한다.
- **AU-12 필수 5개와의 관계**: 필수 5개(F1·F2·F5·F6·F9)는 그대로 두고, 감사에 필요한 나머지는 후보로 덧붙였다.

## 공통 규칙
- **찾는 법**: main(c27c829)에 있는 testID를 우선 쓴다. 없으면 accessibilityLabel(확정 문구)로 찾는다.
- **testID가 없는 상태**: "testID 필요" 칸에 적었다. 앱 줄(L2·L3)에 요청할 목록이다.
- **실행 조건**
  - fake API(`API_MODE=fake`) + dev-menu 상태 주입을 쓴다(staging 빌드).
  - 동작 줄이기는 `adb shell settings put global animator_duration_scale 0`과 1을 각각 한 번씩 돌린다.
  - 글자 배율은 `adb shell settings put system font_scale 1.0 / 1.5 / 2.0`로 바꾼다.
  - 폭은 에뮬레이터 프로필 320·360·412로 맞춘다(QA-01 매트릭스와 같음).
- **캡처**
  - 흐름 안 표시 지점마다 `takeScreenshot: <흐름>-<지점>`을 둔다.
  - 파일은 `docs/design/device-review/maestro/<날짜>/`에 둔다.
  - 우리 앱 창이 맨 위일 때만 찍는다. 알림이나 다른 앱이 찍히면 지운다.
- **감사관이 볼 기준**
  - 동결 시안: v27, 로컬 docs/design/v3.
  - `a11y/talkback-checklist.md`
  - `_qa/2026-11-18-w0-design.md`
  - `_qa/ux-improvements-2026-11-18.md`

## 흐름 후보
| # | 흐름 | 시작 상태(주입) | 지나는 화면·상태 → 캡처 지점 | 찾는 요소(main testID) | testID 필요 | 우선 |
|---|---|---|---|---|---|---|
| **F1** | 어르신 첫 연결 → 코스 완료(AU-12 ①) | 새 설치 | 스플래시(`splash-hold`) → FS(`first-dock-content`) → P1 0·3·6자리(`keypad-area`·`connect-safe`·`legal-line`) → P1c(`confirm-card`) → P2 → N1 → P3 0/3(`course-steps`) → P4(`photo-polaroid`) → P3 1/3(`step-check-anim`) → P5 → P6(`kb-input`) → P7(`p7-stage`·`p7-stamp-big`·`p7-skip-hint`) → P3 3/3 | 괄호 안 | P2 동의 버튼, N1 버튼 | 필수 |
| F2 | 미연결 열람(AU-12 ②) | 새 설치, P1 '코스 보기' | P3 미연결 띠(`course-strip`) → 세 단계 → P7 미연결(도장 + 둘째 줄) → P3 미연결 3/3 | `course-strip`, `p7-text` | — | 필수 |
| F3 | 링크로 열림 | dev-menu: 초대 링크 prefill | FS 띠(`code-found-band`) → P1c 호칭 있음·없음(`confirm-from`) → 기간 지남·이미 씀·이미 연결 | `code-found-band`, `confirm-code` | P1c 상태별 제목 | 높음 |
| F4 | P1 오류·잠금 | fake: invalid 응답 | P1 맞지 않음(`connect-below`) → 반복 → 잠금(`connect-failed`) | `connect-below`, `connect-failed` | — | 높음 |
| **F5** | 자녀 로그인 → 번호 → 대기 → 홈(AU-12 ③) | 새 설치(자녀) | C0(`kakao-symbol`·`google-g`·`legal-line`, 연령 줄) → C1 → C2 → C3(`wait-chip`·`wait-code`·`wait-notify`·`wait-example`) → 연결 감지 → C3 연결됨 → C4(`child-home-card`) | 괄호 안 | C0 연령 안내 줄, C1 라디오 | 필수 |
| **F6** | 응원 왕복(AU-12 ④) | 연결된 가족 2기기 또는 fake | C4 응원 시트 → 토스트(`toast`, 위치 규칙) → 어르신 P3 진입 시 P8(`cheer-dialog`) → 닫힌 뒤 날짜 줄 포커스 | `cheer-dialog`, `toast` | 응원 문장 버튼 | 필수 |
| F7 | 응원 실패 | fake: daily_limit / disconnected | C4 하루 한도 토스트 → 끊김 오류 상자 + 번호 만들기 | `toast` | — | 중간 |
| F8 | 보기 전용 3단계 | 오늘 3/3 완료 | P3 3/3 행 '›' 3개 → P4·P5·P6 보기 전용(`kb-review-card`) → 돌아가기 | `course-steps`, `kb-review-card` | P5 보기 카드 | 높음 |
| **F9** | 삭제(AU-12 ⑤) | 연결된 어르신 | P13(`settings-row-delete`) → P9 1차 → 2차 상자(`dialog`) → P10 | `settings-row-delete`, `dialog-actions` | P10 제목 | 필수 |
| F10 | 설정 답 보여 주기 | 연결·동의 | P13 행(`settings-row-share`·`share-verb`) → 펼침 → 그만 보여 주기 → 토스트 → P3 거부 띠(`course-declined`) → 다시 정하기 → 펼친 채 열림 | 괄호 안 | 펼침 패널(`share-panel` 제안) | 높음(w0 ②③) |
| F11 | 연결된 가족 | 가족 1·2명, 빈 | P13(`settings-row-family`) → P16(`family-row`) → 그만두기 시트(`family-stop-sheet`) → 빈 상태 | 괄호 안 | P16 빈 상태 | 중간 |
| F12 | 지난 날 | 30일 시드 | P3 '지난 날 보기' → P15 목록 → 한 날 → 빈 → 거부 날 | — | P15 목록·카드·빈(`history-*` 제안) | 중간 |
| F13 | 사진 크게 보기 | 첫 P4 | P4 첫 안내 칩 → 크게(세로) → 가로 회전 → 닫기 → P4 두 번째 방문(칩 유지) → 크게 연 뒤(칩 없음) | `photo-polaroid` | 크게 보기 화면·닫기·안내 칩 | 높음(AP-05 뒤) |
| F14 | 자녀 호칭 겹침 | fake: 두 번째 어르신 기본 호칭 | C4 칩 2개 + 안내 줄 → 이름 고르기 시트(막힌 이름) → 토스트 | — | 겹침 줄·시트·칩 | 중간(AC 뒤) |
| F15 | 자녀 지난 답·곧 유료 | 30일 시드 | C5(`child-past`·`child-past-item`) → 주제 행(`child-past-topic`) → C6(예정 가격·관심 있어요·토스트) | 괄호 안 | C6 시트·버튼 | 중간 |
| F16 | 앱 정보 | 부모님·자녀 각각 | P13·C7 앱 정보 8항목 → 오프라인에서 링크 → 토스트 | `settings-row-app`, `version-line` | 8항목 행 | 중간 |
| F17 | 오류·로딩·빈 | fake 오프라인·지연 8초·콘텐츠 없음 | S1(제목 1회) → S2 로딩 → '시간이 조금 걸려요' → 빈 | `screen-body` | S1·S2 제목 | 높음 |
| F18 | P7 모션 변형 | 오늘 2/3 | P6 완료 → P7 전체 연출(180·900·1380ms 캡처 3장) → 같은 흐름 동작 줄이기 → 연출 중 화면 누름 | `p7-stamp-big`·`p7-ink`·`p7-skip-hint` | — | 높음(체감은 사람 눈) |
| F19 | 배경 음악 | 첫 코스 완료 | P7 권유 시트(출처 줄) → 미리 듣기 → 켜 둘게요 → P3 '음악 끄기' → 설정 토글 | `sfx-row` | 권유 시트·P3 음악 버튼 | 낮음(AP-04 뒤) |
| F20 | 글자 200% 일주 | font_scale 2.0 | F1 지점만 다시: FS·P1(스크롤 단계)·P3·P5·P7·P13 | 위와 같음 | — | 높음 |

## 감사관이 꼭 볼 지점(흐름 안 표시)
- **F1**
  - P1 360×640 100%: 안심 줄이 보이고 스크롤이 생기는지. 360×740은 스크롤이 없어야 한다.
  - P3 단계 체크: 돌아온 순간 한 번만 움직이는지(리뷰 M1).
  - P7: 해님이 없는지, 인주 색이 맞는지.
- **F5**: C3에서 복사 토스트가 '번호 보내기' 버튼을 덮지 않는지(impl-drift #28).
- **F10**: '›'가 없는지, 거부 상태에서 들어오면 확인이 펼쳐진 채인지.
- **F18·F20**: 모션과 큰 글자에서 하단 독 높이가 튀지 않는지.

## 앱 줄에 요청할 testID(제안 이름)
- **어르신**
  - `consent-yes`
  - `notify-yes`
  - `share-panel`
  - `p16-empty`
  - `history-list`
  - `history-day`
  - `history-empty`
- **자녀**
  - `relation-radio-<이름>`
  - `cheer-option-<n>`
  - `title-dup-line`
  - `title-dup-sheet`
  - `paid-sheet`
  - `paid-interest`
  - `c0-age-notice`
- **공통**
  - `zoom-viewer`
  - `zoom-close`
  - `zoom-hint`
  - `review-chosen`
  - `p10-title`
  - `s1-title`
  - `s2-title`
  - `bgm-offer`
  - `bgm-toggle`
  - `app-info-<항목>`

## 다음
- AU-12가 들어오면 F1·F2·F5·F6·F9부터 YAML로 만든다(L4).
- 감사관은 F3·F8·F10·F17·F18·F20 순으로 본다.
- 감사 결과 반영은 L5(이 레인)가 맡는다.
