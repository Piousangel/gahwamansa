# 2026-11-18 독립 보안 리뷰(xhigh) — 앱 푸시 클라이언트 AU-04

- 대상: 브랜치 `worktree-agent-a7d99d6b19b0ddf71` 커밋 **c6bbca9** (main 대비) — 매니페스트 POST_NOTIFICATIONS, 네이티브 `PushModule`·`PushPackage`(Kotlin), `src/push/*`(tokenSource·pushClient·runtime·openRoute·channels·notifyNative·PushPermissionScreen), `api/contract/push.ts`, `app/PushHost.tsx`, `navigation/navRef.ts`, AppRoot·ParentStack 연결, realApi 3 RPC + 계정 삭제 시 토큰 정리, `useNotifyPermission`, accountStore 키 2개
- 기준: main `docs/team/dev-server-notes.md` §2(register/unregister·set_push_enabled·my_push_settings), §3(log_event `push_opened{push_kind}`, `push_permission_result{result}`), 0032~0045 / DECISIONS 284(08~21·끄기 토글)·U11·11-18 채널 3개 / docs/team/legal/compliance-checklist.md #10(빌드1 규칙 ①~④) / 앞 리뷰 2026-11-18-push-tokens-review.md·push-events-review.md
- 검토자: 독립 보안 리뷰어(작성자 아님). 코드 수정 없음.

## 실행한 검증
- 작업 트리(`agent-a7d99d6b19b0ddf71`)에는 다른 줄의 커밋 안 된 변경(WebScreen·appLink·package.json 등)이 있어 그대로 쓰지 않았다. **c6bbca9를 `git archive`로 스크래치에 풀고** main의 `node_modules`를 연결해 실행했다(c6bbca9는 package.json을 바꾸지 않음).
  - `npx tsc --noEmit` → **exit 0**
  - `npx jest --testPathIgnorePatterns __integration__ --maxWorkers=2 --cacheDirectory=<스크래치>` → **Test Suites 88/88, Tests 880/880 pass**(pushClient.test 19건 포함)
  - 통합 테스트(`test:integration`, 로컬 Supabase 필요)는 돌리지 않았다. 실기기·FCM 수신은 Firebase(US-10) 전이라 해당 없음.

## 판정
- **높음 0 / 중간 1 / 낮음 7** → **합치기 가능(조건)**. 조건 M1: Firebase 토큰 공급자(`createFcmTokenSource`)를 붙여 실발송이 가능해지기 **전에** 앱 안 알림 끄기(AP-06 P13 토글, 자녀 C7)가 들어가야 한다. 지금 커밋만으로는 real 빌드 토큰이 null이라 알림이 실제로 나가지 않는다.

## 중점 항목 확인

| 중점 | 결과 | 근거 |
|---|---|---|
| 가짜 토큰이 실서버로 가는가 | **안 감** | `tokenSource.ts:83-85` API 모드로 고름. fake=가짜 토큰, real=`nullTokenSource`(getToken null). `App.tsx:8-9`가 같은 `API_MODE`로 api를 만들어 "fake 토큰 + real api" 조합이 생기지 않음. `registerToken`은 토큰 형식(`isPushTokenShape`)이 아니면 RPC를 부르지 않음(`pushClient.ts:25-27`). 테스트 "토큰이 없거나 형식이 틀리면 서버를 부르지 않는다" |
| 계약 검증기 | 일치 | `contract/push.ts` 반환 모양 3종이 dev-server-notes §2와 같은 철자·reason. 모르는 모양은 `contract_mismatch` 오류. 토큰 정규식은 서버 0032와 같은 범위(20~4096, `[A-Za-z0-9_:-]`). `parsePushKind`는 0034 push_kind 4개만 |
| 매니페스트·요청 시점 | 적절 | POST_NOTIFICATIONS 한 줄. 요청은 N1 '알려 주세요'(어르신)·C3/C7 '알림 켜기'(자녀)에서만, 앱 시작 때 묻지 않음 |
| 네이티브 PushModule | 문제 없음 | 새 의존성 없음. 채널 id·이름은 JS(copy)에서 옴. 잠금 화면 daily=PUBLIC, cheer·family=PRIVATE(push-events 리뷰 L3 반영). 설정 열기 인텐트는 자기 패키지만(`EXTRA_APP_PACKAGE`=packageName), `FLAG_ACTIVITY_NEW_TASK`, 실패하면 false. 외부 입력으로 다른 앱을 여는 경로 없음 |
| N1 순서(set_push_enabled(true) → 시스템 창) | 수용(L1 참고) | 서버 계약 §2 "N1 '알림 받기'를 누를 때 set_push_enabled(true)" + 법률 #10 ④ "N1 동의 시각"과 맞음 — 동의는 앱 안 버튼, OS 권한은 별개(0036 원칙 "OS 권한·토큰만으로는 보내지 않음"). 거절해도 서버 동의가 남지만 토큰이 없어 발송은 안 됨(테스트 "시스템 창에서 거절해도 받기 동의는 남는다"). 0037이 처음 시각을 유지하므로 재호출(yes_pending 재시도)도 시각을 바꾸지 않음 |
| 알림 탭 라우팅 | 정보 노출 없음 | FCM data는 `{kind}`뿐이라 탭이 다른 계정의 정보를 가져오지 않음. 어르신: daily·cheer만 처리하고 `[CourseHome]`으로 reset한 뒤 **현재 계정**의 오늘 콘텐츠로 단계 결정. 자녀: 탭 화면(Album·Past)·Wait에서만 처리. 로그인 전(role null)·다른 역할 종류는 버림(`PushHost.tsx:100-102`) |
| push_opened | 계약대로 | `push_opened{push_kind}`(0034) 어르신·자녀 모두. `push_permission_result{result: granted|denied}`(0022) |
| 로그아웃·계정 삭제 | 계약대로 | signOut: 저장된 토큰이 있으면 `unregister_push_token` → signOut(§2 순서). 계정 삭제: 서버가 행을 지우고(0017/0026) 앱은 기기 기억만 지움(`realApi.ts` deleteMyAccount, RPC 실패 시에는 지우지 않음). 등록에 성공한 토큰만 저장(`pushClient.ts:30-33`) |
| AppRoot 공용 변경 | 영향 작음 | `NavigationContainer`에 ref·onReady·onStateChange만 추가하고 `PushHost`(화면 없음)를 Provider 안에 둠. navRef는 모듈 하나라 AppRoot가 다시 마운트돼도 새 컨테이너에 다시 붙음. jest 전체 880 통과로 회귀 없음 확인 |

## 중간

**M1. 앱 안 알림 끄기가 아직 없다 — 법률 빌드 1 규칙 ③·DECISIONS 284 미충족 상태로 동의 수집이 켜진다**
- 근거: compliance-checklist #10 빌드1 규칙 ③ "앱 안 끄기 토글", dev-server-notes §2 "로그아웃·알림 끄기 시 해제". 이 커밋에서 `setPushEnabled(false)`를 부르는 곳이 없다(`git grep setPushEnabled` → pushClient의 true만). N1 '괜찮아요' 주석은 "켜기는 P13에서"라고 하지만 P13에 알림 행이 없다(ParentSettings 변경 없음, 로드맵 AP-06 "알림 토글" 미완). 자녀 C7 알림 행은 휴대폰 설정 열기뿐이다.
- 영향: 지금은 real 토큰이 null이라 실제 알림이 나가지 않아 위반은 아직 아니다. 그러나 `promptReady = true`(`useNotifyPermission.ts:10`)로 N1·C3이 켜져 서버 동의(push_consented_at)는 지금부터 쌓인다. Firebase 공급자를 붙이는 순간, 끌 방법이 휴대폰 설정뿐인 상태로 발송이 시작된다.
- 권장: `createFcmTokenSource`를 병합하기 전에 AP-06 P13 알림 토글(끄기 = `set_push_enabled(false)`, 켜기 = true)과 자녀 C7 토글이 들어갈 것. 리드가 로드맵에서 AU-04 후속(FCM) 항목의 의존으로 AP-06을 명시. 끄기 때 아래 L2·L3 기억값을 함께 정리할 것.

## 낮음

**L1. 시스템 창에서 거절·blocked여도 안내가 없다**: `PushPermissionScreen` '알려 주세요' → 거절이면 화면만 닫힘. blocked(이미 두 번 거절)면 시스템 창이 뜨지 않아 아무 일도 없는 것처럼 보인다. 서버는 "받는 중"(my_push_settings true)이 되어 N1이 다시 뜨지 않으므로, 휴대폰 설정에서 켤 길이 P13에 생기기 전까지 없다. 로드맵 AU-04 원문 "거절 뒤 '휴대폰 설정 열기'". 권장: blocked면 `openNotifySettings()`(자녀 `useNotifyPermission.open`과 같게), P13에는 `push.system_off` 행.

**L2. 자녀는 권한만 허용돼 있으면 아무것도 누르지 않아도 받기 동의가 기록된다**: `PushHost.tsx:42-44` → `childPermissionGranted`. Android 12 이하는 권한이 기본 허용이라 앱을 처음 열 때 `set_push_enabled(true)`가 자동으로 나간다. 서버 계약 §2 "OS 권한·토큰만으로는 보내지 않음"·`push_consented_at` 정의(N1 받기 시각)와 뜻이 다르다. 자녀 알림은 연결 안내(정보성)라 법적 위험은 낮다고 보지만, 증빙 해석이 어긋나지 않게 DECISIONS에 "자녀의 push_consented_at = 알림 허용을 처음 확인한 시각"으로 적거나 C3/C7 탭 때만 부를 것.

**L3. 다시 설치하면 자녀가 끈 알림이 자동으로 다시 켜질 수 있다(M1 토글이 생긴 뒤)**: `push_child_on_v1`은 기기 저장소라 재설치하면 사라진다. 서버가 false(끔)여도 다음 실행에서 권한이 허용돼 있으면 `set_push_enabled(true)`가 나간다. 어르신 `yes_pending` 재시도(`retryPending`)도 그 사이 P13에서 끈 값을 다시 켤 수 있다. 권장: 토글을 끌 때 두 키를 'off'로 바꾸고, 자동 켜기 전에 `my_push_settings`를 확인. 다만 서버가 "한 번도 안 켬"과 "껐음"을 구분해 주지 않아(둘 다 false) 서버에 끈 시각 같은 표시가 필요할 수 있음 → 서버 줄과 협의.

**L4. 연결 전 어르신 기기는 토큰을 등록하지 않아 0036의 "이전 계정 행 삭제"가 앱에서 쓰이지 않는다**: `ready = role==='child' || (role==='parent' && linked)`(`PushHost.tsx:33`). 서버는 no_profile이어도 같은 토큰의 다른 계정 행을 지우도록 바뀌었다(push-tokens 리뷰 M2). 오프라인 로그아웃 등으로 해제에 실패한 기기를 연결 전 어르신 세션이 쓰면 이전 계정 알림이 계속 올 수 있다. 권장: 권한이 있으면 역할·연결과 상관없이 `registerToken`을 부르기(no_profile은 정상 결과로 무시).

**L5. 처리 못 한 자녀 알림 탭이 다음 계정으로 넘어갈 수 있다**: 자녀 role에서 로그인·대기 전 화면이면 `pending`을 그대로 둔다(`PushHost.tsx:89-98`). 그 기기에서 다른 자녀 계정으로 로그인하면 이전 계정 알림의 탭이 새 계정에서 처리된다(앨범 이동 + `push_opened` 기록). 정보 노출은 없고(데이터는 kind뿐) 이벤트만 잘못 귀속된다. 권장: pending에 받은 시각을 두고 몇 분 지나면 버리거나, 계정 태그가 바뀌면 버리기.

**L6. 어르신 알림 탭이 진행 중인 화면을 끊는다**: 동의 화면·계정 지우기 확인·N1 위에서도 `navRef.reset([CourseHome])`(`PushHost.tsx:114`). 응원 알림은 동의 안 한 어르신에게도 간다(0038 `push_reachable`은 동의를 보지 않음). 그래서 동의 화면에서 응원 알림을 누르면 동의 화면을 건너뛴 코스 홈으로 간다. 서버 RLS가 미동의 저장을 막으므로 데이터 문제는 없고 UX 문제다. 권장: Connect·Consent·DeleteAccount·PushPermission 위에서는 reset 대신 pending을 유지.

**L7. 테스트 빈틈**: 로그인 전(role null) 알림 탭 버림, 다른 역할 kind(자녀 기기의 daily) 처리, signOut 때 unregister 순서, blocked 결과의 N1 동작에 대한 단언이 이번 커밋 테스트에 보이지 않는다(signOut 순서는 기존 테스트에 있을 수 있음 — 미확인). `handleChildPushOpen`은 어르신 종류도 `push_opened`로 기록한다(자녀 기기에 daily가 올 일은 없으나 방어).

## 참고(문제 아님)
- 잠금 화면 PRIVATE는 사용자가 '민감한 알림 내용 숨기기'를 켰을 때만 효과가 있다(Android 기본은 모두 표시). 주석에 그렇게 적혀 있어 기대치가 맞다.
- 채널 중요도·공개 범위는 만든 뒤 앱이 바꿀 수 없다 → 바꾸려면 새 채널 id + 서버 `push_channel` 동시 변경(dev-app-notes에 기록됨).
- Firebase 전 real 빌드에서도 N1이 떠서 OS 권한을 받지만 알림은 오지 않는다. 비공개 테스트 공지에 한 줄 넣으면 혼란이 적다.
