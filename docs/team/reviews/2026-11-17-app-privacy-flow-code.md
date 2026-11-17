# 코드 리뷰: 동의 거부·철회, 자녀 홈(child_summary), 어르신 설정 (2026-11-17)

검토자: 독립 리뷰어(작성자 아님). 읽기만 함, 테스트·tsc 미실행. 대상: 커밋 5fde554 + 작업트리.
경로는 app/ 기준. 확신 없으면 "미확인".

## 진행 중(A단계 문구 이관, 아직 확정 아님)
- copy.ts의 tempCopy가 삭제되는 중이다. 이 시점에 tempCopy를 import하는 곳이 남았다(useFinishStep.ts:3, DeleteLink.tsx:4, ChildTabs.tsx:10, DeleteAccountScreen.tsx:9, DeleteDoneScreen.tsx:6, ParentSettings.tsx:7). 작업트리 tsc 실패 가능(미확인, 이관이 끝나면 해소).
- copy.ko.json에 settings·child 키가 새로 생겼다. ParentSettings.tsx:10은 아직 tempCopy.settings를 쓰고, 새 키 withdraw_title·keep(그대로 둘래요)은 화면에 반영되지 않았다.
- copyBan.test.ts는 untracked다. 이관 후 커밋에 포함해야 한다.

## ① 놓친 것
1. [높음] 동의 문구를 바꿨는데 consent_version이 그대로다. 근거: copy.ko.json consent.body 변경, 마이그레이션 0012의 give_consent(p_version default 'v1'), realApi.ts:83이 버전을 보내지 않는다. 새 문구에 동의한 사람과 옛 문구에 동의한 사람이 구별되지 않는다. 수정: 문구 확정 시 버전 상수(예 'v2')를 copy와 함께 두고 giveConsent(version)으로 전달한다.
2. [중간] 설정 진입점이 눈에 안 띈다. CourseHome.tsx:90이 DeleteLink(작은 링크 스타일, "눈에 띄지 않는 작은 링크")를 label="설정"으로 재사용한다. 동의 화면은 "마음이 바뀌면 설정에서 바꿔요"라고 약속하는데 입구는 흐릿한 링크다. 수정: 설정은 secondary BigButton으로 둔다. DeleteLink는 지우기 전용으로 되돌린다.
3. [중간] fakeApi와 realApi의 계약이 어긋난다. 실서버 saveAnswer는 동의가 없으면 consent_required를 던진다(0006:40, 0009:14). fakeApi.ts의 saveAnswer(약 105행)는 동의를 검사하지 않고 항상 저장한다. 그래서 consentFlow 테스트의 "저장 안 함"은 앱이 호출을 건너뛰어서 통과한 것이고, QuestionStep.tsx:34의 consent_required 우회 분기는 테스트되지 않는다. 또 fake의 prompt는 항상 null이라 서버가 prompt를 주는 경로가 비어 있다. 수정: fake가 미동의 시 Error('consent_required')를 던진다. 우회 분기 테스트를 추가한다.
4. [중간] 철회와 재동의 상태 반영이 content가 null이면 무동작이다. AppRoot.tsx:77·79가 `c ? {...} : c`라서 content가 null(get_today_content null)이면 서버는 바뀌었는데 화면은 그대로다. 설정은 CourseHome에서만 들어가므로 실제 확률은 낮다. 수정: 동의 여부를 content와 별도 상태로 둔다. 또는 철회 후 refresh()로 서버 기준으로 맞춘다.
5. [중간] 철회 확인 단계에 "그대로 두기" 버튼이 없다. ParentSettings.tsx:42 근처에서 confirming이면 "네, 철회할게요"와 "돌아가기"(화면 이탈)뿐이다. 새 문구 keep(그대로 둘래요)이 반영되면 해소된다. confirming은 한 번 켜지면 취소할 방법이 없다.
6. [중간] 자녀 홈 오류가 화면 전체를 대체한다. ChildHome.tsx:50 근처에서 error가 있으면 이미 받은 info(최근 답)도 버리고 오류 화면만 보인다. 포그라운드 복귀 시 일시 오프라인이면 있던 답이 사라진다. 수정: info가 있으면 오래된 내용 + 작은 안내를 보여 준다.
7. [낮음] 어르신이 여럿인 가족은 첫 번째 어르신만 보인다. realApi.ts:108 `parents[0]`. 서버는 배열로 준다. 지금 제품은 1명 가정으로 보인다(미확인). 주석으로 가정을 남긴다.
8. [낮음] 조용히 삼키는 곳: AppRoot.tsx:53 refresh().catch(()=>{}), ConsentScreen.tsx:26 .catch(()=>{}), CourseHome.tsx:27 catch가 모든 오류를 "오프라인" 제목으로 보여 준다(서버 오류도). errorMessage를 쓰도록 맞춘다.
9. [낮음] 접근성: ParentSettings의 제목 Text20에 accessibilityRole="header"가 없다. 화면 전환 시 상태 문장("지금은 답을 나누는 중")을 읽어 주는 장치도 없다. DeleteLink.tsx의 accessibilityLabel replace(' · ', ' ')는 label="설정"에서는 무의미하다. 미확인: 스크린리더 실기 테스트는 하지 않았다.
10. [낮음] formatAnswerDate(formatDate.ts)는 형식이 틀린 문자열이면 "NaN월 NaN일"을 만든다. KST 변환 자체(UTC+9h)는 맞고 테스트도 있다. 서버가 date를 주므로 실위험은 낮다.
11. [낮음] 설정 화면에서 await 중 뒤로 가면 언마운트 후 setState가 호출된다(ParentSettings.tsx:20~30). React 18에서는 경고 없음. 영향 미미.
12. [미확인] 같은 질문에 다시 답하면 answers.answered_at이 갱신되는지 서버 코드를 보지 않았다. 안 바뀌면 자녀가 "오늘" 대신 옛 날짜를 보게 된다.

## ② 부족한 것
- 테스트: 철회 후 QuestionStep 재진입 시 이전 선택이 지워졌는지(applyWithdraw의 answered_choice:null) 검증이 없다. 재동의 실패 경로, 철회 후 삭제 화면 이동, 자녀 홈 오류 후 재시도 성공, 어르신 0명(realApi의 shared:true 분기, realApi.ts:111)은 fake로 못 돌린다. realApi 매핑 단위 테스트가 없고 통합 테스트는 실서버에 의존한다.
- 통합 테스트: 철회 뒤 같은 질문 재저장이 되는지(재동의 후 saveAnswer) 순서 검증이 없다.
- 타입: ParentSettings.tsx:56 navigation.navigate('DeleteAccount' as never). ParentParams를 쓰는 useNavigation<NativeStackNavigationProp<ParentParams>>로 바꾼다. ChildReport도 같다.
- 죽은 코드: setParentTitle과 PARENT_TITLES는 UI에서 호출되지 않는다(types.ts, realApi.ts:115, fakeApi.ts:133). ChildSummary.latest.prompt도 화면에서 안 쓴다.
- 문서: session.tsx의 주석이 깨졌다("clear ... // 서버가 동의를 인정한 뒤 반영"이 clear 줄에 붙음). dev-app-notes.md는 settings 키·consent_version 결정이 아직 반영되지 않았을 수 있다(미확인).
- 하드코딩 한글이 copy 밖에 남았다: "알겠어요"(ConsentScreen), "오늘의 코스"·"했어요"·"기다려요"(CourseHome), "정했어요"(QuestionStep).

## ③ 과한 것
1. [중간] setParentTitle·PARENT_TITLES·fake의 parentTitle 옵션: UI가 없는 기능이다. 서버 RPC는 두되 앱 쪽은 호칭 선택 화면을 만들 때 추가한다. 목록이 서버 check와 앱 두 곳에 중복되는 것도 부담이다.
2. [낮음] FakeOptions의 shared·latest·parentTitle이 서로 겹친다(fakeApi.ts:36~38, 약 130행의 shared 추론 `opts.shared ?? (opts.latest ? true : consented)`). 테스트에서 latest만 주면 shared가 true가 되는 암묵 규칙이다. latest 하나로 충분하다.
3. [낮음] applyConsent와 applyWithdraw를 setConsented(boolean) 하나로 합칠 수 있다. 세션 인터페이스 항목이 하나 준다.
4. [낮음] DeleteLink의 label 옵션은 설정 링크용 재사용이다. 이름과 역할이 어긋난다(위 ①-2).
5. [낮음] ChildHome의 `info?.parentTitle ?? '부모님'` 기본값이 realApi.ts, fakeApi.ts, 서버 default와 네 곳에 흩어져 있다. 서버가 항상 주므로 앱에서는 하나로 줄인다.

## 우선순위 요약
1) 동의 문구 버전 2) fake의 consent_required 계약 3) 설정 입구와 철회 취소 4) 자녀 홈 오류 시 기존 답 유지 5) 죽은 코드 정리. tempCopy 이관 후 tsc·lint·jest를 다시 돌려 확인해야 한다(검토자는 미실행).
