# 코드 재검토: 앱 B단계 (2026-11-17)

검토자: 독립 리뷰어. 읽기만 했고 테스트·tsc는 실행하지 않았다. 대상: 작업트리 미커밋 app/ 변경, 서버 0015 대조.
기준: 1차 리뷰 2026-11-17-app-privacy-flow-code.md, 처리 계획 RESPONSE.md 앱 표.

## ① 1차 지적 처리 현황
| 1차 지적 | 상태 | 근거·남은 것 |
|---|---|---|
| 동의 버전 미전달(높음) | 고쳐짐 | copy.ts CONSENT_VERSION='v2'. ConsentScreen·CourseHome·ParentSettings가 전달하고 realApi가 p_version을 보낸다. 문구를 바꿀 때 버전을 올리는 일은 여전히 사람 몫이다(낮음). |
| fake가 미동의 저장 허용(중간) | 고쳐짐 | fakeApi saveAnswer가 consent_required를 던진다. QuestionStep 우회 분기 테스트를 추가했다(previewAndVersion.test). |
| 설정 입구가 흐린 링크(중간) | 고쳐짐 | CourseHome에서 BigButton으로 바꿨고 높이 64 테스트가 있다. |
| 철회 확인에 취소 없음(중간) | 고쳐짐 | ParentSettings에서 stop/resume 모두 keep 버튼이 생겼다. |
| 자녀 홈 오류 시 받은 답 버림(중간) | 고쳐짐 | ChildHome이 `error && !info`일 때만 전체 오류 화면을 보이고, 답이 있으면 오류 줄만 덧붙인다. 테스트도 있다. |
| content가 null이면 동의 반영 무동작(중간) | 안 됨 | AppRoot setConsented가 여전히 `c ? … : c`다. |
| 오류 삼킴 3곳(낮음) | 일부 | AppRoot sync, ConsentScreen, CourseHome 동의는 고쳐짐. useTodayContent.ts가 모든 실패를 failed로 보내 CourseHome이 서버 오류도 "인터넷 끊김"으로 보여 준다. |
| parents[0]만 표시(낮음) | 보류(의도) | realApi.ts:130. 주석으로 가정을 명시하길 권한다. |
| 접근성(낮음) | 일부 | notice에 liveRegion이 생겼다. 제목 header role은 없다. |
| formatDate NaN, 언마운트 setState(낮음) | 안 됨 | 영향 미미하다. |
| `as never` 타입 캐스팅 | 안 됨 | ParentSettings.tsx:69, ChildReport.tsx:14 |
| session.tsx 깨진 주석 | 안 됨 | session.tsx:16 clear 줄에 동의 주석이 붙어 있다. |
| applyConsent·applyWithdraw 이중 구조 | 고쳐짐 | setConsented(v) 하나로 합쳤다. |
| fake 옵션 겹침 | 일부 | shared는 제거했다. parentTitle·latest는 남았다(호칭은 C단계에서 쓴다니 허용). |

## ② 새로 생긴 버그
1. [높음] 처음 설치한 실기기에서는 미연결 열람이 동작하지 않는다. 익명 로그인은 redeemInviteCode(realApi.ts:76)에서만 일어난다. 그런데 ConnectScreen의 "코스 보기"는 세션 없이 CourseHome으로 간다. 그러면 get_today_content가 anon으로 호출되고, 0006:50에서 anon 권한을 revoke했으므로 "permission denied"가 난다. 이 메시지는 정규식 /no_profile|parent_required/에 맞지 않아 preview를 시도하지 않고 fail로 끝나고, CourseHome은 "인터넷이 잠깐 끊겼어요"를 보여 준다(오판). preview_content도 anon 권한이 revoke되어 있다(0015:26). fake는 세션 개념이 없어 이 경로가 항상 통과하므로 테스트가 놓쳤다.
   - 수정: 세션이 없으면 signInAnonymously 후 preview_content를 호출한다. 또는 preview를 anon에 grant한다(콘텐츠는 원래 공개 읽기다). fake에 `session:false`를 넣어 첫 실행을 재현하는 테스트를 추가한다.
2. [중간] 오프라인·서버 오류를 미연결로 착각하는지 확인했다. 착각하지 않는다. 판정은 서버 예외 문자열에만 걸려 있다. preview 호출이 오프라인으로 실패하면 fail이 OfflineError를 만든다. 다만 판정이 error.message의 부분 문자열에 의존해 취약하다. 수정: code(P0001)와 message 일치(===)로 좁힌다.
3. [중간] 자녀 경로는 안전하다. 프로필이 있는 자녀라면 parent_required 다음 preview에서 linked_use_get_today_content가 나고, 원래 오류를 올린다(테스트 있음). 앱의 자녀 탭은 getTodayContent를 부르지도 않는다. 다만 판정 비용으로 매 실패마다 RPC를 2번 왕복한다.
4. [중간] 저장 호출이 정말 없는지 확인했다. 없다. QuestionStep.tsx:29 `consented && content.linked`, useFinishStep의 `!content.linked`면 즉시 반환, CourseHome에서 preview일 때 동의 버튼과 설정이 숨겨져 있다. 구멍은 하나다. preview 중 포그라운드 sync(AppRoot)가 completed_steps를 []로 덮어 화면 진행이 초기화된다(낮음). preview일 때는 sync를 건너뛰거나 로컬 단계를 보존하길 권한다.
5. [중간, 미확인] 연결돼 있던 기기가 끊기면 restore가 CourseHome에서 시작한다. 이때 popTo('Connect')(CourseHome.tsx:69)를 누르면 스택에 Connect가 없다. v7 popTo는 없으면 현재 화면을 교체해 추가하는 것으로 알지만 실기 확인이 필요하다. restoreSession은 프로필이 없으면 unlinked라 Connect에서 시작하므로 앱 실행 중 끊긴 경우에만 해당한다.
6. [낮음] 어르신 삭제가 확인 1단계로 줄었다(DeleteAccountScreen, 2차 확정 P9). 설정의 "모두 지우기"가 첫 단계라 의도대로다. 다만 deleteAccount 테스트가 두 번 누르기를 강제하는지는 보지 못했다(미확인).

## ③ 과한 것
- [중간] 같은 재조회 실패를 세 경로가 따로 다룬다. CourseHome failed(useTodayContent), AppRoot syncError, ConsentScreen error다. CourseHome 안에서 syncError와 failed가 동시에 뜰 수 있다. 하나(세션의 syncError)로 합치기를 권한다.
- [낮음] QuestionStep의 `consented && content.linked`는 이중 가드다. preview는 consented=false로 오므로 linked 검사가 중복이다. 의도를 남기려면 useFinishStep 한 곳에서 linked를 판정하게 모으는 편이 낫다.
- [낮음] DeleteLink에 label 옵션이 남아 있다. 이제 ChildReport만 쓴다. 기본값을 child 문구로 고정하고 옵션을 뺄 수 있다.
