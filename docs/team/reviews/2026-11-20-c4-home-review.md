# PR #102 리뷰 — C4 홈 나머지 v4 부품 교체 + testUtils/warmAppRoot — 2026-11-20

- 대상: `v4/c4-home` df121bd. main 대비 11파일이다.
  - `features/home/ChildHome.tsx` +56/−37
  - `testUtils/warm.tsx`(새 파일)
  - warmAppRoot를 적용한 5개 테스트(cheerSheetV4·bgm·deleteAccount·codeReuse·notifyRows)
  - dsBaseline, e2e `c4-home.yaml`, 전·후 캡처
- 기준: V4-INDEX C4 '시안 없음, 토큰 효과만 + 회귀 캡처', 토큰 v4 자녀 역할
- 리뷰어는 작성자가 아니고 코드를 고치지 않았다. 에뮬레이터는 쓰지 않았다(전·후 캡처는 직접 봄).

## 실행 결과
- `npx tsc --noEmit`: exit 0
- `npx eslint ChildHome.tsx testUtils/warm.tsx`: 0 errors(경고 5, 기존 DS 규칙)
- `npx jest`(warm 적용 5개 + childHome·childUx·ac05Events·resilience·childScreensV3·dsBaseline, `--maxWorkers=3 --cacheDirectory <scratchpad>`, load 약 24~36): **두 번 모두 11 suites / 197 tests 통과**

## 판정
**통과.** 높음·중간은 없다. 고른 답 크기(72 → display 40)는 C5와 함께 볼 디자인 의견으로 적는다.

## C4 홈 상태별
- **답 있음:**
  - 배치는 그대로다(테이프·호칭·고른 답·날짜·스티치·이야기 줄).
  - 카드 전체 읽기 이름(호칭·답·날짜·이야기 꺼내기 또는 기본 문장)도 바뀌지 않았다.
  - 글자는 호칭 sub(굵게 → 보통), 고른 답 display(72 굵게 → 자녀 display 40 굵게, 상한 1.5), 날짜 body, 이야기 bodyLg로 바뀌었다.
  - 전·후 캡처 100%에서는 오히려 카드가 첫 화면에 더 들어온다.
- **여럿 연결:** 호칭 머리(`엄마의 최근 답`)가 sub로 붙는다. 빈·나누지 않음 카드에도 붙는다. 분기는 이전과 같고, 빈 상태 B 분기(#87)도 그대로다.
- **끊김:** 배너는 '연결이 풀렸어요' 제목 + 본문 + 행동 버튼이다(아래).
- **오류(받은 것 없음):** ds StateView error다. 아이콘 + 제목·본문, 나타날 때 한 번 announce, '다시 하기'다. 받은 것이 있을 때의 오류 한 줄(live region)은 그대로다.
- **불러오는 중:** StateView loading(busy) + 하단 '응원 보내기' 비활성 + 이유(`loading_reason`)다. 이전과 같다.
- 하단 고정: 연결된 분이 없으면(`reachable` 0) 하단이 없다. `hasBottom`으로 빈 AudienceProvider가 Dock으로 가지 않게 막았다. 맞다.

## 끊김 배너 — 행동 버튼과 읽기
- 바깥 View의 `accessibilityLiveRegion="polite"`는 유지된다. 그래서 배너가 나타날 때 내용이 읽힌다.
- 안은 `Card tone="notice"` + `Heading level 2`(header) + body + ds Button secondary(`h.disconnected.button`, `loading={making}`)다.
- 버튼 읽기 이름은 보이는 글 그대로다. 제목이 머리글이라 머리글 탐색으로 배너를 찾을 수 있다(전에는 굵은 글자일 뿐이었다).
- 누르면 `makeCode(p)` → `issueInviteCode(parentId)` → `invite_code_issued{purpose:'reconnect'}` → Code 화면이다. 바뀌지 않았다.
- 여러 분이 끊겼을 때 `making` 하나를 함께 써서 모든 버튼이 같이 '진행 중'이 되는 것은 이전과 같다(L2).

## 측정 이벤트
- `child_first_answer_viewed`(trackOnce, 첫 실제 답이 보일 때 한 번, `days_since_connect`), `invite_code_issued{reconnect|parent_code}`, 응원 보내기 이벤트(useSendCheer)는 코드 경로가 그대로다. ac05Events가 통과한다.

## warmAppRoot — 테스트 사이 상태
- 하는 일: `beforeAll`에서 `AppRoot(createFakeApi())`를 그려 역할 선택 화면('이 휴대폰은 누구 거예요?')이 뜨면 unmount한다.
- **prefs:**
  - 역할 선택 화면까지는 prefs를 쓰지 않는다(첫 인사·음악·한 번만 이벤트는 그 뒤 화면).
  - 이 환경에서는 AsyncStorage 네이티브가 없어 `defaultStore`가 메모리로 떨어진다. 그래서 prefs 기본 인스턴스가 파일 동안 남는 것은 warm 전에도 같았다.
  - bgm은 테스트마다 `setPrefsForTest(memoryStore)`로 덮는다.
- **타이머:** 화면 제목 포커스(300ms) 등 컴포넌트 타이머는 unmount 정리로 지워진다. 스플래시 상태는 `jest.after.js`의 `beforeEach(finishBoot/finishFlight)`가 매 테스트 처음 상태를 다시 맞춘다. warm은 이보다 먼저(beforeAll) 돌지만, 첫 테스트 전에 다시 맞춰진다.
- **모의 함수 호출 수:** 5개 파일의 `toHaveBeenCalledTimes`·`not.toHaveBeenCalled`는 모두 테스트 안에서 만든 api 객체 spy나 테스트 안 `jest.spyOn`(PermissionsAndroid·notify 등)이다. warm은 자기 api 객체를 쓰고 spy보다 먼저 끝나므로 숫자에 섞이지 않는다.
- **AppState 리스너:** PushHost·화면들의 AppState·Keyboard 구독은 effect 정리로 unmount 때 지워진다.
- **'처음 1회' 거짓 통과:**
  - 모듈 수준 1회 상태로 `linkSources/native`(`started`, 시작 링크 처리), `RoleSelect.firstScreenPlayed`(첫 화면 모션), `socialAuth.inited`, `pushOpen.skipBanner`를 살폈다.
  - warm이 실제로 바꿀 수 있는 것은 `started`(시작 링크를 한 번 읽음)다. `firstScreenPlayed`는 jest에서 onLayout이 오지 않아 모션이 시작되지 않으므로 바뀌지 않는다.
  - 5개 파일 중 시작 링크·첫 화면 모션·알림으로 앱 열기를 검사하는 테스트는 없다(grep). 그래서 **지금 적용한 파일에는 거짓 통과가 없다.**
  - 다만 warmAppRoot는 범용 도구라, 이런 '처음 1회'를 검사하는 파일(splash·firstScreenIntro·inviteLink·pushOpen 계열)에 붙이면 거짓 통과·실패가 생길 수 있다(L1).

## 디자인 의견 — 고른 답 72 굵게 → display 40
- C5 리뷰(#98)의 의견과 같은 문제다.
  - 홈에서 어르신 답은 화면 주인공이고, 72에서 40이 됐다.
  - 다만 홈은 display(자녀 최대 역할)라 C5(heading 20)만큼 위계가 무너지지는 않는다. 호칭 sub 16·날짜 body 16·이야기 bodyLg 18 대비 2배 이상이다.
- C5를 (a)·(b) 중 하나로 정할 때 홈의 40과 목록의 크기 규칙(예: 홈 display 40 : 목록 26~28)을 같이 정하길 권한다.

## 낮음
- L1. `testUtils/warm.tsx` 주석에 "앱 시작 1회 동작(시작 링크·첫 화면 모션·스플래시·알림으로 열기)을 검사하는 파일에는 쓰지 않는다"를 적을 것. `linkSources/native`의 `started`가 warm에서 소비된다.
- L2. 여러 분이 끊겼을 때 '번호 만들기' 버튼들이 `making` 하나를 함께 쓴다(이전과 같음). 누른 분의 버튼만 진행 표시하면 덜 헷갈린다.
- L3. 전·후 캡처 이미지의 판 순서(전·후, 100%·200%) 설명이 PR 본문·노트에 없어 읽기 어렵다. 이미지에 라벨을 넣거나 노트에 순서를 적을 것.
