# 코드 검토: 앱 C단계 (2026-11-17)

검토자: 독립 리뷰어. 읽기만 했고 jest·tsc·통합 테스트는 실행하지 않았다. 대상: 작업트리 미커밋 app/ C단계(RoleSelect·ChildGate·ChildLogin·RelationScreen·ChildCodeScreen·ChildWaitScreen·CodeEntry·CodeShow, AppRoot·ChildTabs·realApi·fakeApi·types, supabase/config.toml·templates). 서버 계약은 migrations 0003·0009·0012와 대조했다.
범위 밖: src/ui/*(tokens·BigButton·Screen·SelectCard·Text20·CodeInput·StepRow·koreanText), __tests__/designSystem.test.tsx, 어르신 화면 스타일 변경, bReview·resilience 테스트의 getByLabelText 교체, docs/design/v3.

## ① 놓친 것
| 심각도 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 높음 | AppRoot.tsx:24, 69, 129 | real 모드 시작(role 없음)에서 whoAmI가 실패하면 start만 'offline'이 되고 who는 'loading'으로 남는다. 그런데 렌더 분기가 `start==='loading' \|\| who==='loading'`을 offline보다 먼저 검사하므로 **"불러오는 중"에서 영원히 멈춘다**(다시 시도 버튼이 안 보임). 익명 어르신의 whoAmI는 profiles를 조회하고, 토큰 갱신도 네트워크를 타므로 오프라인으로 앱을 켜면 바로 재현된다. 출시 경로(real)의 첫 화면이다. | catch에서 who를 null로 두거나 offline 분기를 loading보다 위로 올린다. 재시도(tick)할 때 who도 'loading'으로 되돌린다. 테스트도 추가한다. |
| 중간 | ChildWaitScreen.tsx:54, ChildCodeScreen.tsx:21 | 대기 화면에서 "번호 다시 보기"는 navigate('Code')로 [Wait, Code]가 되고, Code의 "연결 기다리기"는 replace('Wait')로 [Wait, Wait]가 된다(RN Navigation v7의 navigate는 이미 있는 화면으로 돌아가지 않는다). 왕복할 때마다 **15초 폴링 인스턴스가 하나씩 늘어나고**, 뒤로 가기도 같은 화면이 쌓인다. | Code에서 canGoBack()이면 goBack(), 아니면 replace하거나, Code를 Wait 안의 상태로 합친다. |
| 중간 | ChildLogin.tsx:96, config.toml:236 | 다시 받기에 클라이언트 대기 시간이 없다. 로컬 max_frequency가 1s라 연타하면 메일이 연속으로 나간다. 원격(기본 60s)에서는 429 문구만 보인다. 이메일 오타로 남의 주소에 반복 발송하는 남용 통로도 된다. | 다시 받기를 60초 동안 막고 남은 초를 보여 준다. 원격 SMTP 설정 때 max_frequency·email_sent를 확인하는 항목을 체크리스트에 넣는다. |
| 중간 | ChildLogin 전체, RoleSelect 흐름 | 자녀 쪽에서 역할 선택으로 **돌아갈 길이 없다**. 어르신이 "자녀"를 잘못 누르면 이메일 화면에 갇힌다(Android 뒤로 가기는 앱 종료, resetRole은 ConnectScreen에서만 부른다). | Login(email 단계)에 "처음으로" 보조 버튼을 두고 resetRole을 부른다. |
| 중간 | realApi.ts:60 (sendEmailCode), 72 (verifyEmailCode) | 익명 세션이 있는 기기(미연결로 "코스 보기"를 하면 ensureSession이 익명 로그인함)에서 자녀로 로그인하면 verifyOtp가 그 세션을 덮어쓰고 **익명 사용자는 고아로 남는다**. 데이터 피해는 없지만, 같은 기기를 나중에 어르신용으로 되돌릴 수 없다는 점(whoAmI가 'child'로 고정, 로그아웃 없음)이 결정 기록에 없다. | 한 기기에 한 역할이라는 가정을 DECISIONS에 적는다. 익명 사용자 정리는 서버 정리 작업 후보로 둔다. |
| 낮음 | ChildWaitScreen.tsx:41, 64 | 연결된 뒤(연결됐어요 화면)에도 폴링이 계속 돈다. 응답이 15초보다 느리면 요청이 겹치고, 백그라운드에서도 타이머가 돈다(Android). | linked가 되면 clearInterval, 진행 중 플래그를 두고, AppState가 background일 때 멈춘다. |
| 낮음 | ChildWaitScreen.tsx:52 | 상태가 아직 null(불러오는 중·오류)일 때 "번호 다시 보기"를 누르면 **새 번호를 발급**하고, 발급 실패는 조용히 무시된다(버튼이 아무 반응 없음). | state가 null이면 버튼을 막고, 실패하면 오류 줄을 보여 준다. |
| 낮음 | RelationScreen.tsx:44 | 오프라인과 서버 실패를 같은 t.failed로 보여 준다. 누를 때마다 새 번호가 발급된다(서버가 최신 5개로 잘라 피해는 작다). | isOffline이면 오프라인 문구를 쓴다. |
| 낮음 | ChildLogin.tsx:62, copy login.expired | 만료와 틀린 번호를 모두 bad_code로 보여 주고 `expired` 문구는 쓰이지 않는다. 10분이 지나면 "번호가 맞지 않아요"만 반복된다. | bad_code 문구에 "다시 받기"를 안내하거나 expired와 합친다. |
| 낮음 | ChildLogin.tsx:74 | 이메일 입력에 autoCorrect={false}·textContentType이 없다. 키보드 자동 수정이 오타를 만든다. 오류 Text20에는 liveRegion이 있지만 Wait 오류(:86)에는 없다. RoleSelect 설명(:16, :18)은 버튼 레이블과 분리돼 TalkBack이 따로 읽는다. | 각각 추가한다. 설명은 accessibilityHint로 옮긴다. |
| 정보 | 개인정보 | 이메일은 코드 화면(:92)에만 보이고 로그·오류 메시지에는 넣지 않는다. 문제없다. 메일 템플릿은 번호만 담고 링크가 없어 적절하다. |  |

## ② 부족한 것(테스트 공백)
- real 시작 + whoAmI 실패 → 다시 시도 화면(위 높음 버그가 테스트로 잡히지 않았다).
- Wait → Code → Wait 왕복 뒤 스택 깊이·폴링 수(가짜 타이머로 getChildState 호출 횟수를 센다), 언마운트 뒤 타이머 정리.
- 15초 폴링 자체(지금은 AppState 핸들러로만 연결을 확인한다), 연결된 뒤 폴링 중단.
- 다시 받기 rate_limited 문구, 오프라인 발송·확인, "다른 이메일 쓰기" 뒤 새 주소로 확인.
- RelationScreen: createFamily 성공 + setParentTitle 실패 → 다시 누르면 already_has_profile을 넘기고 진행.
- realApi.whoAmI: 익명+프로필 없음 → 'none', 익명+parent → 'parent'(단위 테스트 없음).

## ③ 과한 것
- AppRoot에 restoreSession(role='parent') 경로와 whoAmI 경로가 함께 있다. App.tsx는 role을 넘기지 않으므로 restoreSession 분기는 테스트에만 쓰인다. whoAmI로 합치면 분기 하나가 준다.
- ChildGate가 AppRoot에서 이미 부른 whoAmI를 다시 부른다(작은 중복, 지금은 허용할 만하다).
- 남은 주석: RealApi.signUpChild의 "카카오로 대체 예정"은 이제 맞지 않는다. ChildTabs라는 이름이 로그인·대기까지 담는 스택과 맞지 않는다(ChildStack 권장).
- CodeShow·CodeEntry를 역할 중립으로 만든 것은 DECISIONS(빌드 2 비용 절감)에 근거가 있어 과하지 않다.
