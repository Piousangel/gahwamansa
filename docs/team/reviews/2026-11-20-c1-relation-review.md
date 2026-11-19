# PR #115 리뷰 — C1 호칭 v4 + ds Choice columns + C2 생략 + 자녀 스택 AudienceProvider — 2026-11-20

- 대상: `v4/c1-relation` 6f86a65. main 대비 26파일이다.
  - 핵심: `RelationScreen`, `ui/ds/Choice`(columns), `ChildStack`(AudienceProvider), `ChildCodeScreen`, `TitleDupNotice`, `ChildSettings`, `useFoldGap`(onHeights), `Sheet`(shadow.sheet), e2e 3개
- 리뷰어는 작성자가 아니고 코드를 고치지 않았다. 에뮬레이터는 쓰지 않았다(전·후 캡처는 직접 봄).

## 실행 결과
- `npx tsc --noEmit`: exit 0
- `npx eslint`(ui/ds·RelationScreen·TitleDupNotice·ChildStack·ChildCodeScreen): 0 errors(경고 4, 기존 규칙)
- 전체 `npx jest --testPathIgnorePatterns __integration__ --maxWorkers=3 --cacheDirectory <scratchpad>`(load 약 26~42): **124/124 suites, 1275/1275 tests 통과**

## 판정
**통과.** 높음·중간은 없다.

## 확인

### 측정 이벤트·퍼널
- `invite_code_issued{purpose:'parent_code'}`는 C1에서 **새로 발급할 때만 1회** 나간다(다시 쓰는 번호는 세지 않음). 이전과 같은 조건이다.
- 공유·복사(`invite_share_tapped{share_sheet|copy}`)는 C2 대신 C3가 잰다. 같은 이벤트 이름·값이다. 테스트 'V9: C1 → C2 없이 바로 C3'가 발급 1회와 보내기·복사 순서를 확인한다.
- 재연결 C2(`ChildCodeScreen`)의 `invite_share_tapped{share_sheet}`도 그대로다.
- `supabase/ops/metrics.sql` 퍼널은 3칸이 `count(distinct family_id) where name='invite_code_issued'`이고, 화면 이름·순서에 기대지 않는다. 발급 이벤트가 같은 때 같은 값으로 나가므로 **깨지지 않는다.** 공유 이벤트는 퍼널 칸이 아니다.

### 재연결 경로의 C2
- C2로 들어오는 곳은 `ChildSettings`('새 폰 연결 번호')와 `ChildHome` 끊김 배너 두 곳이다(`navigate('Code', {code, title})`). `from: 'relation'`을 넘기던 곳은 없어졌다(grep).
- 주 버튼은 `canGoBack ? goBack : replace('Wait')`로, 온 화면으로 돌아간다.
- 테스트(childScreensV3 '끊김 → 번호 만들기 → 번호가 만들어졌어요', '새 폰 연결 번호 → 재연결 번호 화면')가 통과한다.

### C1 → C3 흐름
- 발급 후 `reset([Wait])`로 C1이 스택에서 내려간다.
- C3는 마운트할 때 `getChildState`로 방금 만든 번호를 읽는다. 다시 쓰는 번호든 새 번호든 같은 경로다.
- 실패하면 항상 붙어 있는 live region 안의 한 줄로 알린다(이전에는 새로 붙는 줄이었다).

### 자녀 스택 루트 AudienceProvider
- `ChildStack`만 감싼다. AppRoot는 `who === 'child'`일 때만 ChildStack을, 아니면 ParentStack·RoleSelect를 그린다. 그래서 **어르신 화면은 기본 elder 그대로**다. 역할을 바꾸면 트리 자체가 바뀌므로 값이 새지 않는다.
- 계정 지우기: ParentStack(`DeleteAccountScreen role="parent"`)과 ChildStack(`role="child"`)에 따로 등록되어 있어서, 어르신 쪽은 영향이 없다. 자녀 쪽은 이제 ds 부품이 자녀 치수다(의도: 패널 r1 H).
- 어르신 '가족에게 이렇게 보여요'(FamilyPreview)는 ParentStack 화면이라 이 변경과 무관하다.
- Sheet·Modal 안도 React context가 이어지므로 자녀 치수가 유지된다.
- v3 부품(Text20·BigButton)은 audience를 읽지 않아 바뀌지 않는다.

### columns 자동 전환의 경계
- 판정 `fitsTwoColumns`는 글자 150% 미만이고, 모든 이름·보조 줄이 한 칸 폭에서 한 줄(`estimateLines` 어림)일 때만 2열이다. 측정된 글 줄바꿈이 아니라 **폭 어림**이라, 렌더 결과로 열 수가 다시 바뀌는 고리가 없다.
- 입력은 목록 폭(`onLayout` 폭)·창·글자 배율뿐이다. 목록 폭은 부모가 정하므로 열 수와 무관하다. 그래서 반복(진동)은 없다.
- 깜빡임: 첫 렌더는 `창 폭 − 48`로 어림하고, 목록 onLayout 뒤 실제 폭으로 다시 판정한다. 시트 안처럼 실제 폭이 어림과 다르면 1열 ↔ 2열이 **한 번** 바뀔 수 있다(L1).
- 2열 ↔ 1열이 바뀌면 칸 높이가 다시 와서 접힘(useFoldGap `onHeights`, 줄 수 `n`)도 다시 계산된다. 줄이 다 오기 전에는 옛 높이가 섞인 줄 높이를 한 번 보낼 수 있지만, 마지막 칸이 오면 맞는 값으로 수렴한다.

### 2열일 때 radio 읽기 순서
- `flexWrap` 행 우선이라, 화면 읽기 순서는 엄마 → 아빠 → 어머니 → 아버지 → 할머니 → 할아버지 → 부모님이다. 시선 흐름(왼쪽 → 오른쪽, 위 → 아래)과 같다. 테스트가 이 순서와 radiogroup·checked를 확인한다.
- 막힌 칸(겹침 시트)은 `disabled` + 읽기 이름 '아빠, 이미 쓰는 이름'으로 이유를 담는다.

### e2e
- `common/child-to-wait.yaml`·`audit/c3-fit.yaml`에서 C2 단계(번호가 만들어졌어요·연결 기다리기)를 뺐다. `audit/c1-relation.yaml`을 추가했다.
- 빠진 `${PREFIX}-c2` 스크린샷을 참조하는 다른 흐름·문서는 없다(grep).

## 낮음
- L1. 시트 등 본문 여백이 다른 곳에서는 첫 렌더 어림 폭(`창 − 48`)과 실제 목록 폭이 달라, 열 수가 한 번 바뀌는 프레임이 생길 수 있다. 시트는 좌우 20이라 실제 폭이 8 넓다. 첫 판정을 보수적으로(1열) 하고 폭을 잰 뒤에만 2열로 바꾸면, 바뀌는 방향이 늘 1 → 2 하나다. Choice에 `estimatedWidth`를 넘겨도 된다.
- L2. `estimateLines`는 글자 폭 계수 어림이다. P1 pickStage와 같은 한계(삼성 글꼴·글꼴 스타일)가 있다. 2열에서 실제로는 글이 꺾일 수 있지만, 칸 높이가 늘어날 뿐 잘리지 않으므로 안전한 쪽이다. 실기기 확인 항목.
- L3. C1에서 만료 뒤 새 번호를 받는 경우(`hadExpired && !code`)에 C2가 보여 주던 '앞 번호는 쓸 수 없어요' 안내가 C3에는 없다. C3의 `renewed`는 C3 안에서 만들 때만 켜진다. 다만 가족이 있으면 Gate가 C3로 보내므로 C1에서 이 경우는 사실상 오지 않는다. 기록만 남긴다.
- L4. 130%에서도 '할아버지'가 칸에서 꺾인다고 어림해 1열이 된다(테스트 주석). 의도대로지만, 디자인 결정 a('150% 이상이면 1열')보다 이르다. 디자인에 한 줄 알릴 것.
