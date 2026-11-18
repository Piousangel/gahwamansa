# 2026-11-18 b1-photo-zoom 브랜치 리뷰 (독립 리뷰어)

- 대상: 24b6e52(AP-05 사진 크게 보기), 719081d(AP-08 P5 제목), 0d3db56(AP-09 연결 화면이 떠 있는 동안 새 링크). 갈라진 지점 c27c829, 최신 main ed054ef와 대조.
- 기준 문서: 시안 P4_zoom_review·P5_question·P1c_confirm, `docs/design/v3/_qa/2026-11-18-w0-design.md` DZ-06, talkback-spec. 리드 결정대로 P1c '처음으로'·P1 '여기'는 넣지 않음(정상).
- 방법: 별도 worktree에서 실행, 코드 수정 없음.

## 실행 결과

| 항목 | 결과 |
|---|---|
| `git merge-tree main(ed054ef) b1-photo-zoom` | 충돌 없음 |
| 이벤트 계약 | 서버 0034 화이트리스트에 `photo_zoom_opened` 철자가 같고, `day_index`는 숫자 속성으로 허용된다 → 중복·충돌 없음. 앱 쪽 주석 "0034 임시"(`events.ts`·`PhotoStep.tsx` openZoom)와 테스트 이름 "19개"는 이제 맞지 않으니 정리할 것(낮음) |
| `npx tsc --noEmit` | 통과 |
| jest `--maxWorkers=2` | 1회차: 79 suites / 748 tests 통과. 2회차는 실행 중에 리뷰어가 worktree(node_modules 링크)를 지워 55 suites가 모듈을 찾지 못하고 실패했다. 무효이고, 2회 통과는 확인하지 못했다 |

## 높음

### H1. AP-09가 실제 앱에서는 동작하지 않을 가능성이 큼: 새 링크가 `route.params`까지 오지 않는다
- 경로: `AppRoot.tsx:154` → `ParentStack.tsx:31` → `ConnectScreen.tsx:55`
- 새 번호는 `subscribeInvite` → `invite` state → `prefill` prop 순서로 내려가지만, ParentStack은 이를 `Stack.Screen`의 **`initialParams`**로만 넘긴다.
- React Navigation의 `initialParams`는 경로가 처음 만들어질 때만 쓰인다. 이미 떠 있는 Connect 화면의 `route.params.prefill`은 바뀌지 않는다. 앱 어디에도 `setParams`는 없다.
- 그래서 `useConnectFlow`의 새 링크 처리가 실제 흐름에서는 불리지 않는다.
- `connectNewLink.test.tsx`는 `renderHook`으로 훅 인자만 바꾸므로 이 연결 고리를 검증하지 못한다.
- 권장
  - Connect 화면(또는 AppRoot)에서 `subscribeInvite`를 직접 구독하거나, AppRoot에서 `navigationRef`로 `setParams({prefill})`를 호출한다.
  - AppRoot 통합 테스트로 "연결 화면이 떠 있는 동안 invite가 바뀌면 번호가 바뀌고 바로 확인한다"를 단언한다.
- 이번에는 임시 탐침 테스트로 직접 확인하지 못했다. 고치기 전에 한 줄 탐침으로 재확인하길 권장한다.

## 중간

### M1. 연결 중에 온 새 링크는 버려지고, 퍼널 이벤트도 빠진다
- `useConnectFlow.ts`의 prefill effect
- 연결 중(redeeming)에는 `appliedKey`를 바꾸지 않고 바로 return한다. 이 판단 자체는 맞다(서버만 연결되는 구멍 방지).
- 그런데 연결이 **실패**로 끝나도 effect 의존값이 그대로라 다시 실행되지 않는다. 새 링크 B는 영영 적용되지 않는다.
- `link_opened`·`code_prefilled`도 보내지 않아 퍼널 분모가 빠진다.
- 권장: 대기 중인 링크를 ref에 두었다가 `failed`나 `idle`로 돌아오면 적용한다. 이벤트는 링크를 받은 순간 한 번 보낸다.

### M2. 보기 전용(B2)에서 크게 보기를 열면 계측이 1건 생긴다
- `PhotoStep.tsx`의 `openZoom`
- 기존 규칙(리뷰 M7-1, 코스 홈 v4 테스트)은 "보기 전용은 기록·계측·다시 불러오기 0"이다. 시안 B2의 "기록 호출 0"이 계측까지 포함하는지는 정해지지 않았다.
- `photo_zoom_opened`가 B1 사용률 지표라면 보기 전용에서 연 것도 세는 게 맞을 수 있다 → 리드 판단이 필요하다.
- 권장: 결정 결과를 테스트에 단언한다(보낸다면 `{day_index}`만).

## 낮음

- **L1. 포커스 이동·복귀 테스트 없음**
  - 열면 사진 라벨로, 닫으면 폴라로이드로 포커스가 가도록 `focusLater`로 구현돼 있다. 이를 검증하는 테스트가 없다(`sendAccessibilityEvent` 목으로 가능).
  - 읽기 순서: 시안은 "열리면 '사진 크게 보기…' → '닫기'"인데, 구현은 닫기가 DOM에서 앞이다. 사진에서 오른쪽으로 쓸면 다음 요소가 없고, 왼쪽으로 쓸어야 닫기로 간다. 사진을 먼저 두고 닫기를 절대 위치로 배치하는 방식을 권장한다.
- **L2. 닫기 경로**: '닫기'(64)와 Modal `onRequestClose`(뒤로)만 있고, 사진을 다시 눌러도 닫히지 않는다 → DZ-06과 일치(테스트 있음). 닫을 때 페이드 아웃은 없다(시안에 따로 명시 없음).
- **L3. 첫 안내 방문 수**
  - `countPhotoVisit`가 PhotoStep이 마운트될 때마다 1씩 늘린다. 보기 전용 진입과 같은 날 다시 들어오는 것도 방문으로 센다. 읽고 고쳐 쓰는 방식이라 원자적이지 않지만 영향은 미미하다.
  - kvStore에 실패하면 0이나 1을 돌려줘 안내가 다시 보일 수 있다(안전한 쪽 실패라 괜찮음).
  - 시간으로 사라지지 않는 것, 한 번 열면 끝, 세 번째 방문까지는 DZ-06과 일치한다.
- **L4. 동작 줄이기**
  - 줄이기·화면 읽기면 300ms 페이드만, full이면 .96→1 확대가 더해진다 → 시안과 일치.
  - 판정 전(null)이면 페이드만으로 시작한다. 실제로는 PhotoZoom이 미리 마운트돼 있어 열 때쯤 판정이 끝나 있으므로 문제없다.
- **L5. 로드 실패·준비 중**: 진입이 없고 안내도 나오지 않는다(`canZoom = showImage && loaded`) → DZ-06 4와 일치.
- **L6. AP-08 P5**: 제목 '마음에 드는 쪽을 골라 주세요'(32)와 보조(inkSub)를 묶고, 그 아래 질문 문장(22 굵게)을 두었다 → P5_question 시안과 일치. 질문(`q.prompt`)이 없으면 줄을 뺀다.
- **L7. connectMachine `prefill`**
  - 확인·실패·쓰는 중 상태는 새 번호로 처음부터 시작한다. 연결 중·연결됨은 그대로 둔다(리듀서 테스트 있음).
  - `seq++`로 진행 중 확인을 버리고, 늦게 온 응답은 `mine === seq` 검사로 무시된다.
  - 새 번호는 300ms를 기다리지 않고 바로 확인한다. 같은 링크가 다시 오면 아무 일도 없다(source:code 키, 링크당 이벤트 1회).
  - 상태 전이 자체는 맞다(H1·M1만 별도).

## 합치기 판정

**보류(H1 해결 후 합치기).**
- AP-05·AP-08은 시안·DZ-06과 맞아 그대로 합쳐도 된다. AP-09를 분리하면 먼저 합칠 수 있다.
- AP-09는 새 링크를 Connect 화면까지 전달하는 연결(H1)과 통합 테스트를 넣은 뒤 합친다. M1은 함께 고치기를 권장한다.
- M2는 리드가 판단한다.
