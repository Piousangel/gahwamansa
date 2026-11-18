# child-ux2 독립 리뷰 — 2026-11-18

- 대상: `child-ux2` 4d8253a(U2·U10·U12·C4 호칭 겹침·N3 배너·C0 연령) · 2693baf(duplicate_title·로그아웃 토큰 해제) · 262669f(AC-01 C6·AC-02·AC-04) · 병합 9f4326f, main 대비 36파일 +1272/−47
- 기준: DECISIONS 11-18(U10·U11·U12), 시안 C4_title_dup·N3_connected·C6_paid_sheet·C0_login, copy-v3-confirmed 11-8~11-13, talkback-spec
- 리뷰어는 코드를 고치지 않았다.

## 실행 결과(임시 worktree, 끝난 뒤 제거)
- `tsc --noEmit`: exit 0
- `jest --testPathIgnorePatterns __integration__ --maxWorkers=2 --cacheDirectory=<scratch>`: 77 suites 중 75 통과, `noPlaceholder`·`flow` 2개(3 tests)가 **20초 시간 초과**로 실패. 당시 부하 평균이 22였고 suite 하나가 515초 걸림. 두 suite만 다시 돌리면 **9/9 통과** → 코드 문제가 아니라 부하 때문으로 판단. 합친 전체 결과는 759 중 759 통과
- 통합 테스트(`titleDup.test.ts` 새로 추가)는 돌리지 않음
- merge-tree main(a6cc162) ← child-ux2: **충돌 2파일**. `app/src/api/contract/events.ts`, `app/__tests__/eventsContract.test.ts` — main(B1 병합)이 0034 이름 5개(`paid_sheet_opened … push_opened`)를 이미 넣었고 이 브랜치는 2개만 넣음. **main 쪽을 그대로 쓰면 해결.** copy.ko.json 두 개는 자동 병합됨

## 높음
없음.

## 중간

### M1. AC-04: 매니페스트에 POST_NOTIFICATIONS가 없어 Android 13 이상 모든 기기에서 '꺼짐 + 켜기'가 나오는데, 눌러도 켤 수 없다
- `app/src/features/child/useNotifyPermission.ts`(readNotifyState·open), `AndroidManifest.xml`(INTERNET만 선언, targetSdk 36)
- 선언하지 않은 권한이라 `check`는 늘 false → `denied`. 그래서 C3 대기 화면(`ChildWaitScreen.tsx:178` "연결되면 알려 드릴게요 · 알림 켜기")과 C7 설정 행("알림이 휴대폰 설정에서 꺼져 있어요 · 설정 열기")이 **Android 13 이상 사용자 거의 전부에게** 보인다. `request`는 선언이 없으면 시스템 창 없이 바로 거절(rationale false라 RN은 `never_ask_again`) → 휴대폰 설정으로 보내는데, 거기서 켜도 앱이 권한을 선언하지 않아 계속 '꺼짐'이다. 막다른 길이다. 코드 주석은 "실제로 알림이 오지 않으므로 맞는 표시"라고 하지만, 지금은 푸시 자체가 없어서(토큰 등록 TODO) 사용자가 할 수 있는 일이 없다.
- 권장: AU-04(매니페스트 선언·토큰 등록)가 들어오기 전에는 `denied`여도 켜기 안내를 숨기거나(이전 동작), 이 브랜치에서 `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`를 선언한다. 선언하면 첫 요청에 시스템 창이 뜨므로 N1 안내 시트 순서는 리드가 확인할 것. `granted`일 때 "family_desc"(무엇을 알려 주는지)도 아직 푸시가 없어 사실과 다름 — 같이 숨기는 게 맞다.

### M2. U10 취소 토스트: 보낸 뒤에도 '취소'를 누를 수 있는 틈이 있고, 그때는 아무 말 없이 보내진다
- `app/src/features/home/useSendCheer.ts:72-95`, `app/src/ui/Toast.tsx:81-85`
- 보내기 타이머(`setTimeout(fire, ms)`)는 `show()` 전에 시작하고, 토스트를 숨기는 타이머는 렌더 뒤 effect에서 시작한 다음 페이드 아웃(`fadeMs`)까지 한다. 그래서 응원이 이미 나간 뒤에도 토스트와 '취소' 버튼이 몇십~몇백 ms 남는다. 그때 누르면 `pending.current`가 null이라 아무것도 하지 않고 토스트만 닫힌다 → 사용자는 취소한 줄 안다(취소했다는 토스트도 없고 이미 보냈다는 말도 없음).
- 같은 문제: 기다리는 동안 다른 `show()`가 오면 취소 토스트가 일찍 사라지지만, 보내기 타이머는 계속 돈다.
- 권장: `fire`가 불리면 그 토스트를 바로 `hide()`하거나 action을 거둔다. 늦게 누른 '취소'에는 "이미 보냈어요" 한 줄(라이터)을 보인다. 아니면 토스트가 실제로 사라진 시점(onHidden)에 보내도록 순서를 묶는다. 회귀 테스트: 시간이 다 된 직후 '취소' → send_cheer 1회 + 안내.

### M3. C4 호칭 겹침 칩 줄은 화면 읽기에서 묶음 이름과 '현재'가 읽히지 않는다
- `app/src/features/home/TitleDupNotice.tsx:53-61`
- 바깥 View에 `accessibilityLabel`("부모님 고르기")만 있고 `accessible`이 없어 Android는 이 라벨을 읽지 않는다. 칩은 역할이 없는 View이고 `accessibilityState.selected`도 접근성 노드가 아니라 읽히지 않는다 → 칩 글자("엄마", "엄마")만 두 번 읽혀 어느 분이 새로 연결된 분인지 알 수 없다(겹친 상황의 핵심 정보). 시안은 `role="tablist" aria-label="부모님 고르기"`.
- 권장: 칩마다 `accessible` + 라벨 "{이름}, 새로 연결된 분"(현재 칩)·"{이름}"(다른 칩), 묶음은 `accessibilityRole="tablist"`(누를 수 없으면 `"list"`) + `accessible={false}`로 자식이 읽히게. 라벨 문구는 라이터 확인 대상(`_status_title_dup_chips_a11y`가 이미 '라이터 확인 전'). 칩 글자 대비(`inkTitle` 바탕 + `card` 글자)는 문제없음.

### M4. 기기에 저장하는 기억값이 계정을 구분하지 않는다(N3 본 어르신 목록·C6 관심 남김)
- `app/src/features/home/newConnection.ts`(`seen_parent_ids_v1`), `app/src/features/home/PaidSheet.tsx`(`paid_interest_v1`)
- 로그아웃 뒤 다른 자녀 계정으로 들어오면 앞 계정의 '본 목록'이 그대로라, 새 계정의 어르신이 처음 확인할 때 모두 '새로 연결됨' 배너가 될 수 있다(목록이 null일 때만 배너를 건너뛰는 규칙이 무력해짐). C6는 다른 계정에서도 '관심 남김'(비활성)으로 보여 그 계정의 관심 이벤트가 영영 안 나간다(전환 분모 왜곡).
- 권장: 로그아웃 정리(`signOut` 뒤 앱 쪽 정리)에서 두 키를 지우거나, 키에 사용자 id 가명값을 붙인다. C6 '관심 남김' 기억 자체(이 기기 1회, 결제·연락처 없음)는 시안·DECISIONS와 맞다.

## 낮음
- L1. 응원 대기 중 앱 종료: 최근 앱에서 밀어 끄면 보통 `background`가 먼저 와서 `fire`가 요청을 시작하지만, 응답 전에 프로세스가 죽으면 응원이 사라질 수 있다(결정 11-18 "백그라운드 즉시"의 남는 위험). 출시 전 실기기 확인 목록에 넣을 것. 화면을 떠날 때(언마운트) `fire`는 로그아웃으로 홈이 사라질 때도 불려 세션이 지워지는 중에 보낼 수 있다 — 로그아웃 시작 때 `pending`을 버리는 쪽이 안전하다. 탭 전환은 홈이 언마운트되지 않아 타이머가 그대로 돈다(정상).
- L2. 두 분에게 보낼 때: 토스트 하나("엄마·아빠께 보냈어요"), 취소하면 두 분 다 취소, 보낼 때는 한 분씩 결과를 따로 받고 '다시 하기'는 받은 분을 건너뜀 — 맞다. 하루 한도는 실제로 보낼 때만 쓰고, 취소한 뒤 바로 다시 보내기도 막지 않는다(`pending` null) — 맞다.
- L3. U2 토스트 숨김(`Toast.tsx:109 modals === 0`): 시트·대화상자가 열려 있어도 자동으로 사라지는 타이머와 `announce`는 그대로 돈다. 시트가 열린 동안 띄운 정보 토스트는 보이지 않은 채 끝나고, 화면 읽기는 보이지 않는 토스트를 읽는다. 지금 호출부는 모두 시트를 닫은 뒤 `show`해서 실제 피해는 없음. 숨긴 동안에는 타이머·알림을 미루는 게 맞다. `durationMs`는 선택값이라 기존 사용처(ChildSettings·ChildWaitScreen·ChildHome·TitleDupNotice)의 6초는 바뀌지 않는다.
- L4. 로그아웃 순서(`realApi.ts signOut`): 토큰 해제 → 소셜 정리 → 세션 삭제 순서이고, 해제가 실패해도 계속한다 — 0032 계약과 맞다. `sb.rpc`는 서버 오류일 때 throw하지 않고 `{error}`를 주므로 try/catch는 네트워크 예외만 잡는다(결과는 같음). 아직 토큰을 등록하는 곳이 없어 지금은 아무 일도 하지 않는다(TODO AU-04). 해제에 실패해도 로컬 토큰을 지우니, 서버 정리 배치가 있다는 전제를 dev-app-notes에 한 줄 남길 것.
- L5. `TitleDupNotice.tsx:78`, `PaidSheet`가 닫기 라벨로 `copy.child.cheer.close`(응원 키)를 다시 쓴다. 공용 키(`common.close` 등)로 옮기는 게 맞다.
- L6. N3 배너: 앱이 앞으로 올 때마다 홈과 따로 `fetchChildSummary`를 한 번 더 부른다(요청 2배). 새로 마운트되는 뷰에 단 live region이라 기기에 따라 안 읽힐 수 있다(앞선 리뷰 M2와 같은 문제) — 늘 있는 컨테이너나 `announce` 권장.
- L7. `paid_interest_tapped`를 `plan` 없이 보낸다. 0034에서 `plan`은 선택 속성이라 서버가 받는다. 시안에 고르기가 없어 맞는 선택이지만, 서버 노트(`paid_interest_tapped{plan}`)와 표기를 맞춰 둘 것. 예정 가격 3안 중 '선물 이용권 3,900원'은 정해지지 않은 값(코드 TODO) → 출시 전 리드·사업 확인 필수.
- L8. C0 연령 안내 줄은 시안에 없어 약관 줄 아래에 둠(코드 주석 '디자인 확인 항목') — 디자인 확인 목록에 올릴 것.

## 확인해서 문제 없던 것
- U12 공유 뒤 상태: `dismissedAction`이 아니면 '보냈어요' 줄 + 주 버튼을 보조 '다시 보내기'로(Android는 보냈는지 알 수 없어 돌아온 것을 기준으로, 단정하지 않는 문구). 새 번호 무효 안내 줄(11-9).
- duplicate_title: `setParentTitle`도 `duplicate_title`을 구분하고 시트 안 오류 줄로 보임. 바꿀 대상은 겹친 이름 중 나중에 연결된 분(`findTitleDup`), 다른 분 이름은 막힌 라디오("이미 쓰는 이름", 사용할 수 없음).
- 이벤트 이름 2개는 0034 화이트리스트와 같은 철자이고 번호·글자 값을 싣지 않음.

## 판정
**조건부 합치기 — M1(알림 켜기 막다른 길)과 M2(늦은 취소)를 고친 뒤 합친다.** M3(칩 읽기)는 이번에 하는 것을 권장하고, M4는 로그아웃 정리와 함께 후속으로 해도 된다. main과의 events.ts·eventsContract 충돌은 main 쪽을 그대로 쓰면 풀린다. 합친 뒤 부하가 낮을 때 전체 jest를 한 번 더 돌려 시간 초과 2건이 재현되지 않는지 볼 것.

---

## 재검토 — 2026-11-18 (74bec6d 리뷰 반영 · 169bf02 디자인 판정 · 병합 5b15bcb·e972af8)

### 실행 결과(임시 worktree, jest 캐시 따로, 끝난 뒤 제거)
- `tsc --noEmit` exit 0, `jest --maxWorkers=2`(통합 제외) **80 suites / 788 tests 통과**(시간 초과 없음)
- merge-tree main(a465bfa) ← child-ux2: **충돌 없음**(앞서 난 events 충돌은 병합에서 풀림)

### 1차 지적 해결 여부
| 항목 | 상태 | 근거 |
|---|---|---|
| M1 알림 켜기 막다른 길 | **해결** | `useNotifyPermission.ts:8 notifyFlags.promptReady=false` → 상태 `unknown`, C3 줄·C7 행 숨김. AU-04에서 매니페스트 선언과 함께 켜도록 주석에 남김 |
| M2 늦은 '취소' | **해결** | Toast `onExpire`: `expire()`가 `current`를 먼저 비운 뒤 부르므로 토스트 하나에 최대 1회. 경로별 확인 — 시간 끝(`hide(id)`)·새 토스트로 바뀜(`show`)·제공자 언마운트 → 1회. '취소'(`act`)는 `current`를 비우고 닫아 onExpire 0회 + 발송 0회. 백그라운드는 `fire` 뒤 `hide(toastId)` → 다시 불려도 `done`으로 막혀 1회. 끝나기 시작하면 `leaving`으로 버튼 비활성(`Toast.tsx:180`) |
| L3 시트 동안 토스트 | **해결** | 숨긴 동안에는 읽기·타이머를 멈추고, 닫히면 그때 읽고 처음부터 센다. 응원 대기 중 시트를 열면 발송도 그만큼 미뤄짐(앱이 백그라운드로 가면 즉시) — 결정 취지와 맞음 |
| M3 칩 읽기 | **해결** | 칩 줄을 `accessible` 한 덩어리로, 라벨 "연결된 분 이름, 부모님, 부모님. 새로 연결된 분은 두 번째예요"(라이터 11-14). 칩은 각자 읽지 않음 |
| M4 계정별 기억값 | **해결** | 키 `seen_parent_ids_v1:<tag>`·`paid_interest_v1:<tag>`, tag = `sha256(auth user id)` 앞 16자(16진수 64비트). user id 원문·이름·이메일은 저장하지 않고, tag는 서버·이벤트로 나가지 않는다(로컬 키에만 사용). 로그아웃 때 signOut 전에 tag를 받아 두고 두 키를 지움. 계정을 모르면 배너·기억을 하지 않음 |
| L5 닫기 키 | 해결(`title_sheet.close` 분리) |

### 남은 것(낮음, 합치기를 막지 않음)
- R1. 화면 언마운트 경로(`useSendCheer.ts` 마지막 effect)는 `fire()`만 하고 토스트를 거두지 않는다. 백그라운드 경로와 달리 보낸 뒤에도 '취소'가 남는다(누르면 `done` 때문에 아무 일도 없이 닫힘 = 1차 M2와 같은 착각). 홈이 실제로 언마운트되는 것은 로그아웃·삭제 때뿐이라 드물다. `hide(p.toastId)`를 같이 부르거나, 로그아웃 시작 때 대기 응원을 버리는 쪽 권장.
- R2. 계정 삭제(`DeleteAccountScreen`)에서는 `clearAccountKeys`를 부르지 않는다(주석은 "로그아웃·계정 삭제 때"). 지운 계정의 가명 키와 어르신 id 목록이 기기에 남는다. 로그아웃처럼 삭제 전에 tag를 받아 두고 정리할 것. 또 `signOut`이 예외를 던지면 정리를 건너뛴다(정리를 finally로).
- R3. tag는 솔트 없는 sha256이라 user id를 아는 사람은 같은 값을 만들 수 있다. 기기 안 키 이름으로만 쓰는 지금은 문제없지만, 나중에 서버·로그로 보내면 안 된다는 한 줄을 `accountStore.ts` 주석에 남겨 둘 것.

### 재검토 판정
**합치기 가능.** M1~M4·L3·L5가 테스트와 함께 해결됐고, onExpire는 모든 종료 경로에서 많아야 1회(취소하면 0회)이며 계정 키에 개인정보 원문이 남지 않는다. R1·R2는 후속으로 해도 된다.
