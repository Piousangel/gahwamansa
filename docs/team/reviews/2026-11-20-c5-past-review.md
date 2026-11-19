# PR #98 리뷰 — C5 지난 답(배치 v3 그대로, 부품만 ui/ds) — 2026-11-20

- 대상: `v4/child-list` cf71c51. main 대비 4파일이다(`features/home/ChildReport.tsx` +55/−45, dsBaseline, e2e `audit/c5-past.yaml`, 전·후 캡처).
- 기준: V4-INDEX C5 '시안 없음, 토큰 효과만 + 회귀 캡처', 토큰 v4 자녀 역할(`ui/tokensV4.ts`), v3 시안 C5_history
- 리뷰어는 작성자가 아니고 코드를 고치지 않았다. 에뮬레이터는 쓰지 않았다(전·후 캡처는 직접 봄).

## 실행 결과
- `npm ci` 후 `npx tsc --noEmit`: exit 0
- `npx eslint src/features/home/ChildReport.tsx`: 0 errors, 2 warnings(기존 규칙)
- 전체 `npx jest --testPathIgnorePatterns __integration__ --maxWorkers=3 --cacheDirectory <scratchpad>`를 두 번 돌렸다(load 약 46·41). 두 번 모두 1255개 중 1254개 통과, 1건 실패 → 아래 '부하 실패'
- ChildReport를 쓰는 7개 파일(childUx·childHome·ac05Events·l2Polish·childScreensV3·familyPreview·parentFamily, `--maxWorkers=2`)을 두 번 돌렸다: **두 번 모두 163/163 통과**

## 판정
**통과(디자인 의견 1건 첨부).** 높음·중간은 없다. 고른 답 크기는 디자인 판단 항목으로 남긴다(아래 '디자인 의견').

## 확인
- **전·후 캡처(360×640 100% / 320×640 200%):**
  - 잘림: 행·주제 행·배지 모두 글자가 잘리지 않는다. 200%에서 질문 짧은 형이 두 줄이 되어도 행이 늘어난다(고정 높이 없음). 고른 답은 `maxWidth 50%` 오른쪽 정렬이라 겹치지 않는다.
  - 접힘: 첫 화면 끝이 행을 가르는 것은 **전·후 모두 같다.** v3 시안과 옛 Screen 그대로라 R-15 접힘 맞춤 대상이 아니다. 이번 변경으로 생긴 회귀가 아니다(L3).
  - 읽는 순서: 위 바(제목·설정) → 안내 한 줄 → (여럿이면 호칭 머리글) → 행(날짜·질문·답 한 덩어리) → 이야기 주제 행. 이전과 같다.
- **"목록 안에서 펼쳐지는 답 상세":** 이 화면에는 펼침이 없다(main·PR 모두). 행은 `accessible` 한 덩어리이고, 읽기 이름 `row_a11y`(날짜·질문·답)는 바뀌지 않았다. 안의 고른 답은 role `heading` 글자지만, `accessibilityRole`이 없고 행이 묶고 있어서 따로 머리글로 잡히지 않는다. 호칭 머리글만 `Heading level 2`(header)다. 이전 `accessibilityRole="header"`와 같다.
- **빈 상태·오류·불러오는 중:**
  - 빈 상태(나누지 않음·답 없음): BrandSymbol + 한 줄이고 bodyLg로 바뀌었다. 문구·분기는 그대로다.
  - 오류(받은 것 없음): ds StateView error다. 아이콘 + 제목·본문, 나타날 때 한 번 announce, '다시 하기' 버튼(load). v3에는 announce가 없었으니 나아졌다.
  - 받은 것이 있고 다시 불러오기만 실패하면: live region 한 줄이고, 이전과 같다.
  - 불러오는 중: StateView loading이다. 글자 한 줄 + `busy` 상태다. 다만 제목이 `accessibilityRole="header"`로 나와 '불러오는 중이에요'가 머리글로 읽힌다(L1).
- **측정 이벤트:** `child_report_viewed`(받아 보여 준 뒤 화면에 들어올 때마다)와 C6 시트 열림(`paid_sheet_opened`, PaidSheet 안)은 바뀌지 않았다. 주제 행 라벨·onPress도 같다. ac05Events·childUx C6 테스트가 통과한다.
- **이야기 주제 행:** 최소 높이를 자녀 터치 48로 정했고, 눌림 색(actionSoft)이 추가됐다. 라벨은 '이야기 주제 추천, 곧 유료'로 보이는 글과 같다.

## 부하 실패(childUx 1건)
- 리뷰어 전체 실행 두 번(load 약 46·41)에서 각각 1건씩 실패했다. 실패 이름을 남긴 두 번째(`--json`) 실행에서 실패한 것은 **childUx가 아니라 `cheerSheetV4.test.tsx` 'M1: 응원 시트를 닫으면 … 포커스가 응원 보내기로'**다. 원인은 `Unable to find … 어떤 말을 보낼까요?`(`waitFor` 기본 시간 초과)다. 응원 시트는 C4 홈 화면이고 이 PR이 건드리지 않은 파일이다.
- **관련성 판단: 이번 변경과 관련 없다고 본다.**
  - ① 실패하는 테스트가 실행마다 다르다(작성자 실행에서는 childUx, 리뷰어 실행에서는 cheerSheetV4).
  - ② 같은 브랜치에서 ChildReport를 쓰는 7개 파일(childUx 포함)만 두 번 돌리면 매번 163/163 통과한다.
  - ③ 이 PR은 ChildReport의 표시 부품만 바꾸고, 데이터·타이머·비동기 흐름(useAnswerHistory·focus 이벤트·PaidSheet)은 건드리지 않았다.
  - ④ 실패한 것들은 모두 `waitFor` 기본 1초 안에 탭 전환·시트 열림을 기다리는 테스트다. load 40~50에서는 렌더가 1초를 넘을 수 있다.
- 권장(L2): 부하에 약한 `waitFor`에 `{timeout: 8000}`을 주는 것을 해당 테스트들(childUx C6 묶음·cheerSheetV4 등)에 적용할 것. C3 PR(#83)에서 이미 같은 방식을 썼다.

## 디자인 의견 — 고른 답 28 굵게 → heading 20
- **문제가 될 수 있다고 본다.** 이 화면의 주인공은 어르신이 고른 답이다(제목도 "엄마의 지난 답").
- 위계:
  - v3: 날짜(보조) 20 / 질문 20 / **답 28 굵게**. 답이 질문보다 1.4배였다.
  - 지금: 날짜 sub 16 / 질문 body 16 / 답 heading 20 굵게. 1.25배이고, 전·후 캡처에서도 답이 눈에 덜 띈다.
- 혼동:
  - 어르신이 여럿이면 호칭 머리글(Heading 2 = heading 20 굵게)과 고른 답(heading 20 굵게)이 **같은 크기·굵기**가 된다. "엄마"와 "가을"이 같은 위계로 보인다.
  - 같은 앱 C4 홈의 최근 답은 72 굵게다. 홈에서 크게 보던 답이 지난 답에서는 머리글 크기가 되어 화면 사이 일관성도 약하다.
- 규칙 제약: 700은 한 화면 2역할(제목·버튼)이다. 지금 이 화면의 700은 위 바 제목(title)·호칭 머리글(heading)·고른 답(heading)이다. 고른 답을 다른 700 역할로 키워도 '역할 수'는 늘지 않는다(heading 대신 title·numeral을 쓰면 오히려 역할이 하나 바뀐다).
- 선택지(디자인 결정):
  - (a) 고른 답만 `title` 역할 크기(자녀 26/36, 상한 1.5)를 머리글 없이(accessibilityRole 없이) 쓴다. 머리글(20)과 구분되고 v3 28과 가깝다.
  - (b) 자녀 '고른 답' 전용 역할(예: choice 24~28)을 토큰에 하나 둔다. C4 홈 72와 C5 목록 사이 규칙도 함께 정한다.
  - (c) 지금(20) 유지 + 머리글을 bodyLg 굵게 등으로 낮춰 구분한다.
- 리뷰어 의견은 (a) 또는 (b)다. 어르신 답이 주인공이라는 화면 목적상 질문보다 확실히 커야 하고, 호칭 머리글과 같은 모양이면 안 된다.

## 낮음
- L1. 불러오는 중 StateView의 제목이 header 역할이라 '불러오는 중이에요'가 머리글로 읽힌다. ds StateView 공통 동작이라 이 PR 범위 밖이다. loading에서는 header를 빼는 것을 StateView에서 고려할 것.
- L2. 부하에 약한 `waitFor` 기본 1초(위).
- L3. 첫 화면 끝이 행을 가르는 것은 v3부터 같다(R-15 미적용 화면). C5에 v4 list 틀이 생길 때 `useFoldGap`으로 맞출 것.
- L4. `e2e/audit/c5-past.yaml`은 fake 시작 상태를 손으로 바꿔야 재현된다(파일 주석). 다른 감사 흐름처럼 `-e` 인자나 개발자 메뉴로 지난 답 데이터를 넣는 길이 있으면 재실행할 수 있다.
