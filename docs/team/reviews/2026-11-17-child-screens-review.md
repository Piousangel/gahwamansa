# 자녀 화면 v3 코드 리뷰 (RN·개인정보·접근성) · 2026-11-17
대상: `worktree-agent-a65a1b92e80260723` main 대비 커밋 3개(ecc8ada·9be06e5·51c64af). 워크트리에 **커밋 안 된 수정 11파일**(C2 공유 문구 분해, 알림 줄 3단계 아래, starter가 기본 문장 대체, 빈 상태 심볼)이 있으며 drift 7·8·9·10과 맞다. 아래는 커밋 기준이고, 미커밋분은 커밋 뒤 재확인한다.
검증(워크트리, 미커밋 포함): `npx jest --maxWorkers=2` 관련 12스위트 100/100 통과, `tsc --noEmit` 통과. `__integration__/childFlow`는 config.local 없어 못 돌림. `git merge-tree`: main·U0·서버 브랜치 모두 글자 충돌 없음.
**판정: 조건부 합치기** — 개인정보 누출 없음. 중간 4건(M1~M4)을 고치거나 리드가 수용하면 합친다.

## 개인정보 점검 (통과)
- 참여 빈도·연속·개수·완료 여부 표시 없음(C4 카드, C5 행 = 날짜·질문 짧은 형·답만). 응원 읽음(read_at)은 앱 타입·호출 어디에도 없음. 해님 없음(자녀 화면).
- 동의 철회: 서버가 `shared:false, latest:null, answers:[]`로 주고 앱은 포커스·포그라운드마다 다시 불러온다. 다시 불러오기가 실패하면 이전 값을 그대로 둔다(L1).
- 어르신 여러 명: 카드·지난 답·설정 모두 parentId 키 + 호칭 머리글. 응원은 연결된 분께 한 분씩 보낸다(계약 메모와 같음).

## 중간
- **M1 화면을 떠나도 15초 확인이 계속된다** `features/child/useChildWaitState.ts:56` — 백그라운드·연결·언마운트에서만 멈춘다. 대기 화면 위에 설정·Code·앱 정보를 쌓으면(네이티브 스택, 언마운트 안 됨) 계속 확인한다. → `useIsFocused()`(또는 useFocusEffect)를 interval effect 조건에 더하고 다시 보일 때 한 번 확인.
- **M2 시트·대화상자가 열린 채 실패하면 알림이 안 보인다** `features/child/ChildSettings.tsx:38,155,167,171` — 호칭 저장 실패(시트 유지)·로그아웃 실패(대화상자 유지) 때 `{toast}`가 Modal 밑(안드로이드는 별도 창)에 그려져 사용자·TalkBack 모두 모른다. → 실패 문구를 시트/대화상자 안에 한 줄(polite)로 두거나 닫고 토스트. U0 ToastProvider도 Modal 밖이라 같은 문제 — U0 쪽에도 공유.
- **M3 응원 실패 처리** `features/home/ChildHome.tsx:58-76` — (a) 한 분 성공 뒤 다음 분에서 오프라인 예외가 나면 catch가 성공을 버리고 오류만 보여 준다 → 다시 누르면 첫 분에게 중복(하루 한도 2 소모). 반복 안에서 분마다 try/catch. (b) 모두 `daily_limit`이어도 "잠깐 문제가 생겼어요" → 다시 시도를 부른다. 문구 확정 전이라도 reason별 분기 자리를 만들고 drift #11 문구를 받으면 채운다. (c) 일부 실패는 알리지 않는다(수용 가능, 계약 메모에 이미 적힘).
- **M4 새 번호 직후 늦은 확인이 덮어쓴다** `ChildWaitScreen.tsx:54`·`useChildWaitState.ts:25` — `check(true)`는 진행 중 확인을 무시하고 새로 부르지만, 먼저 출발한 확인(번호 없음)이 나중에 도착하면 state가 "번호 만들기"로 돌아가 또 누르면 방금 번호가 무효가 된다. → useFocusLoad처럼 seq 번호로 늦은 응답 버리기.

## 낮음
- L1 `ChildReport.tsx:59`·`ChildHome` — 다시 불러오기 실패 시 철회 전 답이 오류 줄과 함께 남는다. 정책상 허용인지 리드 확인(대안: 오류면 목록 숨김).
- L2 `realApi.ts:277,308` — `shared:false`인데 latest·answers가 오면 그대로 보인다(서버 신뢰). 방어로 `shared ? … : null/[]`. 한 줄씩.
- L3 `realApi.ts` 옛 서버 대비 `parentId: parent-${i+1}` — ChildHome `reachable`(46행)의 "parent_id 없으면 보낼 대상 없음" 의도와 반대로 걸러지지 않아 uuid 아닌 값을 send_cheer·set_parent_title_for·issue_invite_code에 보낸다. 서버 0019 선반영이면 무해, 아니면 `''`로.
- L4 호칭이 같은 어르신 둘(예: 둘 다 "부모님")은 머리글·토스트("부모님·부모님께")로 구분 불가. 서버 노트 "섞이면 오표시" — 설정에서 호칭 바꾸기 유도 또는 연결 순서 표시는 디자인 결정 필요.
- L5 로그아웃 `realApi.ts:342` — supabase-js `signOut({scope:'local'})`은 네트워크 오류면 세션을 지우지 않고 error를 돌려준다(SDK는 이미 로그아웃). main `deleteMyAccount`와 순서는 같다(SDK→local, 일관). 오프라인 로그아웃을 허용하려면 실패 시 저장소 세션 제거 후 진행 검토.
- L6 접근성(talkback-spec C3·C4) — 번호 카드(라벨·번호·기한)와 예시 카드, C4 최근 답 카드가 한 덩어리로 읽히지 않는다(`accessible`+라벨). 시트 R12(제목 첫 포커스·닫힐 때 복귀)는 대역에 없음 → U0 교체 때 해결.
- L7 복사 `ui/clipboard.ts` — RN 0.88.1에 `Libraries/Components/Clipboard` + Android `ClipboardModule`(MainReactPackage 등록) 있고 package `exports`의 `./Libraries/*`로 해석된다 → **지금 동작, 새 의존성 불필요**. 다만 @deprecated·"future release에서 제거" → RN 올릴 때 `@react-native-clipboard/clipboard`로. Android 13+은 시스템이 복사 알림을 띄워 앱 토스트("복사했어요")와 겹친다(13 미만에서만 토스트 고려).

## 구조·합치기
- ARCHITECTURE §2 위반 새로 생김: features→app `ChildStack` 타입(ChildSettings·ChildHome·ChildReport), `session`(ChildSettings·ChildHome), `BackBar`(ChildSettings·ChildAppInfo), `splash`(ChildHome 기존 유지). 그리고 **shared→app**(`shared/useChildData.ts`가 `app/session`). 정리 계획(12)의 `navigation/types.ts`·`state/`·`ui/BackBar` 이동 커밋에 이 파일들을 목록으로 넘길 것. ASSUMED(0027)이 `types.ts`·`realApi.ts`에 흩어짐(§5는 contracts 한 곳) — contracts 생길 때 옮김.
- u0Overlays → U0 교체는 **"import 경로만 바꾸면 된다"는 파일 주석이 틀림**. U0: `useToast()`는 ToastProvider 필요·`show({text,kind,action})`·`{toast}` 렌더 없음·6초(대역 3초); BottomSheet는 `hint`/`footer` 대신 `body`/`primary`·`secondary`(액션 객체); Dialog는 children 대신 `actions[]`·`onBack`. 호출부 4파일(ChildHome·ChildSettings·ChildWaitScreen + 시트 2·대화상자 1) 수정 필요. 대역 주석을 고치고 교체 커밋 범위에 넣을 것.
- main과 겹치는 파일: `copy.ko.json` 2벌·`childOnboarding.test`·`flow.test`(지금은 자동 병합). 미커밋 copy 변경 뒤 `sync-copy` 동일성 테스트 다시 확인.
