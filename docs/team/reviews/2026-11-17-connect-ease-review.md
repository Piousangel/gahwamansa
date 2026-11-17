# 연결 쉽게(child-ease-joy) 독립 리뷰 — 2026-11-17

- 대상: 브랜치 `child-ease-joy` 796d7b7 · 06f25ff · d549210, main 대비(43파일 +845/−224)
- 기준: 동결 시안 P1_connect_v4 · P1c_confirm · FS_link, ease-and-joy SUMMARY A·E, copy-v3-confirmed 11절(문구 우선), DECISIONS 마지막 항목, ARCHITECTURE, dev-server-notes(peek_invite_code·시도 한도), talkback-spec
- 리뷰어는 코드를 고치지 않았다. 아래 "재현"은 임시 worktree에 넣었다 지운 탐침 테스트 결과다.

## 실행 결과(임시 worktree, 끝난 뒤 제거)
- `npx tsc --noEmit`: 통과(exit 0)
- `jest --testPathIgnorePatterns __integration__ --maxWorkers=2`: **60 suites / 522 tests 통과**
- 통합 테스트(`__integration__`, peek 실서버 1건 추가)는 돌리지 않음
- 병합 확인(`git merge-tree`)
  - main ← child-ease-joy: **충돌 없음**
  - p3-course-home-v4 ↔ child-ease-joy: **충돌 3파일** — `app/src/app/ParentStack.tsx`(ParentParams 같은 줄: `Connect.prefill` vs `PhotoStep.review`), `app/src/copy/copy.ko.json`·`docs/team/copy.ko.json`(둘 다 JSON 끝에 새 묶음 추가: `connect_confirm/safe/legal` vs `review`). 셋 다 양쪽을 합치면 되는 단순 충돌. `testUtils/flow.tsx`·`types.ts`·테스트 7개는 자동 병합됨(p3의 `courseHomeShown`과 이 브랜치의 `enterCode` 변경은 서로 다른 함수라 의미 충돌 없음). 두 브랜치 모두 `ui/tokens.ts`는 건드리지 않음

## 높음

### H1. 맞지 않음(또는 확인 중) 상태에서 숫자 키를 더 누르면 같은 번호로 peek를 다시 불러 시도 한도를 깎는다
- `app/src/features/link/connectMachine.ts:40-42`, `app/src/features/link/useConnectFlow.ts:94-96`, `app/src/ui/codeInputLogic.ts`(`inputDigit`은 6자리면 같은 값을 돌려줌)
- 6자리가 찬 뒤 숫자 키를 누르면 `edit(같은 번호)`가 dispatch되고, 리듀서는 `idle, inline:null`로 돌려 놓는다. 그러면 `shouldAutoCheck`가 다시 참이 되어 300ms 뒤 **같은 번호로 peek**를 또 부른다. 확인 중(peeking)에 누르면 진행 중 요청은 순번으로 버려지지만 서버는 이미 한 번 셌다.
- 재현(탐침): `999999` 입력 → "맞지 않아요" → 숫자 1을 3번 누름 → `peekInviteCode` **4회** 호출(`["999999"]×4`).
- 영향: dev-server-notes상 peek 실패도 redeem과 **같은 한도(기기 10분 5회)**를 쓴다. 어르신이 "안 되네" 하고 키를 몇 번 누르면 곧바로 잠김(`locked`)이 된다. 퍼널 이벤트 `parent_code_failed`도 그만큼 중복된다. 요구 ②("연타에서 중복 호출하지 않는지, 한도 이중 소모")에 걸린다.
- 권장: 리듀서 `edit`에서 `e.code === s.code`면 상태를 그대로 돌려준다(안내 줄 유지, peeking 유지). 훅 `edit`도 값이 같으면 `seq`를 올리지 않는다. 회귀 테스트: "맞지 않음 뒤 숫자 키 연타 → peek 1회", "확인 중 숫자 키 → peek 1회".

## 중간

### M1. 연결 중(redeeming)에 '이전'·하드웨어 뒤로가기를 누르면 서버는 연결됐는데 화면은 빈 번호 쓰기로 돌아간다
- `app/src/features/link/ConnectScreen.tsx:172`(`<BackBar onBack={onOther} />`, busy여도 막지 않음), `:178`(링크만 `disabled={busy}`), `useConnectFlow.ts:97-100`(`other`가 seq를 올려 redeem 응답을 버림). `BackBar`는 `hardwareBackPress`도 같은 함수로 묶는다(`app/src/app/BackBar.tsx`).
- 재현(탐침): [이 번호로 연결하기] → 응답 전 "이전 화면으로 가기" → redeem `{ok:true}` 도착 → 동의 화면으로 가지 않고 빈 번호 칸(`연결 번호 6자리 쓰는 칸`).
- 영향: 서버는 이미 연결(번호 사용됨). 어르신이 같은 번호를 다시 쓰면 `already_linked`/`used`가 나와 혼란. 요구 ①("다른 번호 쓰기 중 늦은 응답")의 반대 방향 구멍.
- 권장: `redeeming` 동안 `other`를 무시(리듀서 `other`에서 `s.kind==='redeeming'`이면 그대로)하고 BackBar `onBack`도 no-op으로. 또는 redeem 응답은 seq와 무관하게 `ok`면 반영.

### M2. P1c·안내 패널로 바뀔 때 포커스가 제목으로 가지 않는다(talkback R2), '확인 중' 알림이 기기에서 안 나올 수 있다(R11)
- `ConnectScreen.tsx` ConfirmView(제목 `accessibilityRole="header"`만, `setAccessibilityFocus` 없음), 실패 패널 `:100-101`
- P1→P1c는 내비게이션이 아니라 같은 화면 안의 분기라, 누르던 키패드 키가 사라지면서 TalkBack 포커스가 갈 곳을 잃는다. R2는 "화면에 들어오면 첫 포커스는 제목(300ms 뒤 setAccessibilityFocus)".
- 칸 아래 한 줄(`:113`·`:115`)은 상태마다 **다른 Text를 새로 마운트**하면서 각자 `accessibilityLiveRegion`을 단다. Android는 이미 있는 live region의 내용 변화는 확실히 읽지만 새로 붙은 노드는 기기·버전에 따라 건너뛴다. 11-2 #12는 "다 쓰면 이어서 '번호를 확인하고 있어요'를 한 번 알림"을 요구한다.
- 맞지 않음 때 spec P1 "포커스는 번호 칸 묶음으로"도 구현 없음.
- 권장: 칸 아래 줄은 항상 있는 `View accessibilityLiveRegion="polite"` 하나에 글만 바꾸거나 `AccessibilityInfo.announceForAccessibility` 1회. ConfirmView·실패 패널은 제목 ref에 300ms 뒤 `setAccessibilityFocus`. invalid 때는 칸 묶음 ref로 포커스. 실기기 TalkBack 확인 필요(테스트로는 못 잡음).

### M3. peek 응답을 검증하지 않아 모르는 reason이면 화면이 죽는다
- `app/src/features/realApi.ts:253-255` → `connectMachine.ts:52`(`failKind`가 문자열을 그대로 통과) → `ConnectScreen.tsx:21-28` `reasonToMessage(모르는 값)` = `undefined` → `m.title`에서 TypeError
- 서버가 계약에 없는 reason(예: 이벤트 목록에 있는 `locked`, 앞으로 추가될 값)을 보내거나 `data`가 null이면 렌더 오류. ARCHITECTURE §1은 "RPC별 반환 타입 + 런타임 검증"을 `api/contract/`에 두라고 한다(cheers·events는 이미 그렇게 함).
- 권장: `api/contract/invite.ts`에 `parsePeekResult`(reason은 `REASONS` 목록만, 아니면 `ServerError`)를 두고 realApi에서 사용. `parent_title ?? '부모님'` 기본 문구도 copy로.

### M4. 시안 1:1 차이(키·칸 모양) — 이번 변경은 글자 크기만 맞췄다
- 시안 P1_connect_v4: 키 `border-radius 14`·`border 2px #A67C5A`, 칸 `height 68`·`radius 12`·아래 선 3. 앱 `ui/CodeInput.tsx`: 키 `radius.card(22)`·테두리 3, 칸 `radius.input(16)`·아래 선 4, 화면 맞춤 때 칸 `minHeight 52`.
- 키 높이 64~68·숫자 34·글자 키 26·링크 가운데 간격 24·약관 줄 위치/색(#744821, 20, 가운데)·P1c 카드(테두리 3, 반경 22, 패딩 20, 간격 10)·번호 52·제목 30/28은 시안과 일치.
- 맞지 않음 줄: 시안은 경고 삼각 아이콘 + `#991B1B` 굵게. 앱은 색·굵기만 같고 아이콘 없음.
- FS_link 띠: 시안 아이콘은 봉투(rect+path), 앱은 `icon-family`(`RoleSelect.tsx:114`). 시안 제목 "부모님 버튼 강조"는 구현 없음(띠만).
- P1c 실패(기간 지남·이미 쓴 번호): 시안은 "번호 직접 쓰기" + "처음으로" 두 개, 앱은 패널 버튼 하나(dev-app-notes에 남은 일로 적혀 있음). 150%·200%에서 약관 줄이 버튼 위로 오는 순서도 미반영.
- 권장: 동결 시안 기준이면 키·칸 모양은 리드 판단(spec §3와 시안이 다름)으로 결정 후 별도 작업, 아이콘 두 개는 이번에 맞추기 쉬움.

## 낮음

- L1. `useConnectFlow.ts:20` prefill 번호를 형식 검사 없이 상태에 넣는다(`'12a'`·10자리 등이 칸에 그대로). App Links·Referrer 연결 전에 `/^\d{6}$/`만 받게. 이미 화면이 떠 있을 때 새 prefill(params 변경)은 무시된다(초기값만 사용) — App Links 연결 때 처리 필요.
- L2. `connectMachine.ts` `redeem` 케이스는 `failed` 상태에서 `s.title`이 참일 때만 redeeming으로 바꾸는데, 훅 `redeem`은 title 확인 없이 API를 부른다. title이 `''`이면 서버 연결은 되고 상태는 `failed`에 남는다(응답이 `redeemed`에서 무시). realApi의 `??`는 빈 문자열을 못 막는다. 조건을 `s.title !== undefined`로 맞추거나 훅과 같은 조건 사용.
- L3. `locked`의 `retryAfterSec`를 받지만 쓰지 않는다(문구 "조금 뒤에"라 지금은 문제 없음). 쓰지 않을 거면 상태에서 빼도 됨.
- L4. 앱 백그라운드: 별도 처리 없음. 300ms 타이머·늦은 응답은 seq로 정리되어 실해는 없음. 확인 화면에서 오래 머문 뒤 만료되면 redeem이 `expired` → 안내 패널로 처리됨(정상).
- L5. `CodeInput.tsx:39` 칸 묶음에 `accessible`을 붙여 칸별 라벨(`connect.code_a11y`, spec "탐색 모드에서만")이 사라졌다. 의도라면 talkback-spec 표를 고칠 것.
- L6. Gradle `SHARE_LINK_BASE`는 형식 검사가 없다(`build.gradle`). 다른 공개 값처럼 허용 목록(`https://[^\s#?]+`)으로 빌드 실패시키면 출시 빌드에서 링크 줄이 조용히 빠지는 일을 막는다. 비밀값 차단·gitignore(production.env 커밋 안 함)·JS 쪽 `clean()`·`shareLink` 검사와는 맞음.
- L7. 테스트 헬퍼 `testUtils/flow.tsx:39-40` `enterCode`는 확인 버튼이 없으면 **조용히 넘어간다**. 지금은 뒤따르는 `waitFor(동의 화면)`이 실패를 잡아 약해진 테스트는 없음(전 테스트 확인). 그래도 `confirm=true`인데 버튼이 없으면 throw하게 하면 원인이 바로 보인다. 가짜 타이머 감지(`setTimeout.clock`)는 modern 타이머만 인식 — legacy 타이머 테스트가 생기면 실제 대기로 빠져 멈춘다.
- L8. `keyboardStep.test.tsx:190`이 `course_*` 이벤트만 보게 바뀌어 다른 이벤트가 끼어도 못 잡는다(완화). `qaDeviceSmoke.test.tsx:121` `expect(fireEvent).toBeTruthy()`는 import 유지용 무의미 단언 — import를 지우는 게 맞다.
- L9. 새 문구 키 중 앱에서 아직 안 쓰는 것: `login.code_group_a11y`, `cheer.disconnected`, `wait.step2_a11y`, `legal.agree_child`. 문제는 아니나 병합 뒤 리드 일괄 반영 목록과 맞춰 둘 것. DECISIONS는 "11-5 기존 문구 정리는 앱 줄 병합 후 리드 일괄"인데 이 브랜치가 일부(errors.invalid·connect.success·offline.body·ai_notice·login·cheer·name_taken)를 먼저 반영했다 — 리드가 남은 것(first.intro[1], course.step.hangul, push[] 폐기 등)만 하도록 알려야 한다.
- L10. `ConnectScreen.tsx` `TITLE`의 NBSP가 `' '` 이스케이프에서 눈에 안 보이는 실제 문자로 바뀌었다(동작은 같음). 이스케이프로 되돌리면 다음 사람이 안 지운다. 화면 안 숫자 크기(30·52·22, 패딩 20 등)는 ARCHITECTURE §6 "숫자 크기 직접 금지"와 어긋나지만 기존 화면도 같은 방식.

## 확인해서 문제 없던 것
- 자동 연결 금지: redeem은 `ConfirmView`의 [이 번호로 연결하기]·안내 패널 "다시 하기"(redeem 단계 인터넷·서버 오류)에서만 불린다. prefill도 peek만(테스트 있음).
- 6자리 연속 입력·빠른 지우기: 타이머는 effect 정리로 취소, 고친 뒤 늦은 응답은 seq로 버림. 6자리 붙여넣기 경로는 키패드만이라 없음(prefill은 0ms 즉시 1회). [연결하기] 빠른 두 번 누름은 탐침에서 redeem 1회.
- peek 성공 → redeem 때 만료·사용됨: `failed(step:'redeem')` → "알겠어요" → 빈 번호 쓰기. 잠김(rate_limited→locked) → rate_limited 문구 → 비우고 처음부터. 인터넷·서버·busy는 같은 단계 재시도.
- 공유 메시지: 11-1 #5 6줄과 글자까지 일치(안심 줄은 `safe.money`를 기한 줄 뒤에 붙임). 링크 없으면 5줄 + 스토어 문장. `shareLink`는 https만, 끝 `/` 정리, 번호는 `#` 뒤에만, `?`·`#`·공백 든 주소는 거부.
- 이벤트: `parent_code_failed`는 `{reason}`만, 성공은 `parent_code_redeemed`(속성 없음). 퍼널 3종은 서버 화이트리스트 전이라 보내지 않음. 번호 값 없음(테스트 있음).
- 문구 파일: app·docs 두 copy.ko.json 동일. 지운 키(`connect.hint/button/need_six`, `settings.name_taken`, `share.step1~3/safe`, `_status`류)는 앱 코드·테스트에 남은 참조 없음. copy는 JSON 타입 import라 tsc 통과 = 점 표기 접근 키 모두 존재, 동적 접근(`errors[reason]`, `cheers[k]`)도 타입으로 묶임.
- Gradle `writeEnvTs`: 선택 값 기본 `""`, 비밀값 차단 규칙 통과, staging.env·production.env.example만 커밋.

## 합치기 판정
**조건부 합치기 — H1·M1을 고친 뒤 main에 합친다.** 둘 다 몇 줄짜리 수정(리듀서 같은 값 무시, redeeming 중 뒤로 막기)과 회귀 테스트 2~3개면 된다. M2(포커스·알림)는 실기기 TalkBack 확인과 함께 이번 브랜치에서 하는 것을 권장, M3·M4와 낮음 항목은 후속 가능. p3-course-home-v4와는 3파일 단순 충돌이 나므로 먼저 들어가는 쪽 뒤에 다른 쪽이 main을 받아 풀 것.
