# 앱 개발 노트 (6a: 골격과 어르신 화면, 서버 없음) · 2026-11-17

## 의존성 (공식 문서 확인: reactnavigation.org/docs/getting-started)
- 추가: @react-navigation/native 7.5.2, native-stack 7.21.1, bottom-tabs 7.22.0, react-native-screens 4.30.1 (npm 최신 태그 기준. 위 버전이 RN 0.88과 호환되는지는 공식 문서에 표기가 없어 **미확인**, 빌드·jest로만 확인)
- 개발용: @testing-library/react-native 13.3.3 (14.x는 `test-renderer` 신규 peer 요구라 현재 react-test-renderer 구성과 맞는지 미확인해 13.x 선택)
- 문서 요건: RN 0.72+, TS 5+. Android는 MainActivity에 RNScreensFragmentFactory 설정과 manifest `enableOnBackInvokedCallback=false` 적용함. iOS는 pod 설치 필요(이번엔 미실행).
- 설치 안 함: 카카오 로그인, FCM, supabase-js, TTS, 폰트 파일(Jua 등 번들은 에셋 단계).

## 가정
- record_session_step 의 step 값은 'photo'|'question'|'hangul' 로 가정(서버 허용값 미확인).
- 답변 저장 함수 `saveAnswer` 는 가칭(서버에 대응 RPC 없음, answers insert 가정). 동의 거부 시 호출하지 않음.
- 문구는 src/copy/copy.ko.json(docs/team/copy.ko.json 사본). 원본 갱신 시 덮어쓰기. 모든 문구 접근은 src/copy/copy.ts 한 곳.
- 가짜 API 코드: 123456 성공, 000000 used, 111111 expired, 222222 rate_limited, 333333 busy, 444444 already_linked, 555555 not_parent_device, 그 외 invalid.
- 역할은 App.tsx 에서 'parent' 고정 mock(자녀 확인은 'child'로 변경).
- 한글 따라 쓰기는 자리표시 박스와 "다 썼어요" 버튼만(실제 쓰기 입력 없음). TTS 없음.

## 6b: 실제 Supabase 연결 (2026-11-17)
- 추가 의존성: @supabase/supabase-js 2.119.0, @react-native-async-storage/async-storage 3.1.1, react-native-url-polyfill 4.0.0 (npm 최신 태그). Supabase 공식 RN 퀵스타트는 이 세 패키지를 안내하나 **RN 0.88 호환 요건은 문서에 없어 미확인**. 앱에서의 실제 동작(AsyncStorage 3.x, 폴리필)은 실기기·에뮬레이터 확인 전이라 미확인. async-storage 네이티브 링크로 Android 빌드 재확인 필요.
- 설정: src/lib/config.local.ts(gitignore)에서 URL·키를 읽음. 예시는 config.local.example.ts. 에뮬레이터 http://10.0.2.2:54321, 실기기 맥 LAN IP. 없으면 안내 에러.
- API 교체: App.tsx 의 API_MODE ('fake' 기본 | 'real'). realApi 는 Api 인터페이스 그대로 + 테스트용 signUpChild.
- 통합 테스트: `npm run test:integration` (기본 `npm test` 에서 제외). 로컬 스택이 켜져 있어야 함. 콘텐츠 시드(content_questions 1일차)가 DB에 없으면 답변 저장 2개 테스트는 안내 메시지와 함께 실패한다. 선택 환경변수 SUPABASE_SERVICE_ROLE_KEY 가 있으면 임시 콘텐츠 삽입과 이번 실행 데이터 정리까지 수행(없으면 정리 안 함, 이메일·UUID는 매 실행 고유).
- saveAnswer 는 questionDay 로 content_questions 를 찾는다. 현재 UI 는 1일차 고정이며 실제 연결 시 my_day_index 로 바꿔야 한다(UI 미변경).

## 6c: 오늘의 콘텐츠 (2026-11-17)
- Api 에 `getTodayContent()` 추가(서버 get_today_content). `saveAnswer({questionId, choice})` 는 save_answer RPC 사용(같은 질문 재답변은 서버가 갱신). 직접 insert 제거.
- fake: `createFakeApi({day, empty, answeredChoice})` 로 하루 순환·빈 상태·이미 고른 답을 주입(3일치 샘플, 4일차는 1일차로 순환).
- 화면: CourseHome 이 콘텐츠를 불러와 세션에 담고 사진·질문·한글 단계가 사용. 사진 image_url 이 `pending://` 면 라벨 박스 "[AI 옛날 사진 들어갈 자리]". 한글 단어는 photo.keyword. 동의 거부 시 saveAnswer 호출 안 함(테스트 유지).
- **라이터 확정 필요(임시 문구, src/copy/copy.ts 의 tempCopy)**: 콘텐츠 없음 제목/본문("오늘 사진을 준비하고 있어요"/"조금 뒤에 다시 와 주세요"), 사진 안내, 질문 제목·힌트, 한글 힌트, 로딩 문구. 서버는 질문 본문 문장을 주지 않고 option_a/b 만 주므로 질문 제목은 공통 문장이다(라이터/서버 결정 필요).
- 사진 설명 prompts(회상 질문 2개)는 서버가 주지 않아 화면에서 뺐다.

## 6d: 서버 문구 필드와 확정 문구 (2026-11-17)
- TodayContent 확장: `question.prompt`(string|null), `photo.recall_questions`(string[]). 질문 제목은 prompt, null 이면 `app.question_title`. 사진 아래에 회상 질문을 한 줄씩(글자 24) 표시.
- 문구: docs/team/copy.ko.json 의 `app` 키를 app/src/copy/copy.ko.json 으로 복사해 사용(`appCopy`). tempCopy 삭제. **키가 없어 남은 임시 문구는 없음.**
- 사진 자리표시는 어르신 화면에 "사진을 준비하고 있어요"(app.photo_placeholder)만 보이고 "[AI ...]" 개발용 표기는 없음. 사진 로드 실패(onError)는 app.photo_load_failed. 에셋 레지스트리의 `[아이콘: 이름]` 라벨 박스 컴포넌트는 그대로(아이콘 자리용).
- 콘텐츠 없음 화면에 `app.no_content.button`("다시 보기") 연결: 누르면 getTodayContent 재호출. 오늘 코스 완료 시 `app.course_done_today` 표시.
- 미확인: 사진 이미지 실제 URL 로딩 경로(Image uri, 네트워크 실패 onError)는 단위 테스트 없이 구현만 함.

## 6e: 코드 리뷰 반영 (6·7·8·11·12·13·15번, 2026-11-17)
- 동의·완료 단계·연속일은 서버 값(get_today_content의 consented/completed_steps/streak)이 기준. 메모리 consented 제거. 서버가 동의한 상태면 Consent 화면 건너뜀. 거부는 서버 호출 없이 보기만, 코스 홈에 "고른 답이 자녀분께 보여요"+"좋아요" 작은 안내로 나중 동의 가능.
- 기록(recordSessionStep) 실패 시 완료 처리 안 하고 오류+"다시 하기". 답변 저장 실패는 알리고 진행 안 함, consent_required는 저장 없이 진행. duration은 화면 진입부터 초(0~7200).
- Connect: OfflineError(연결 실패·시간 초과 패턴)와 기타 오류 문구 분리. already_linked 버튼은 Consent(서버 동의면 코스 홈)로 이동. 오프라인 판별은 메시지 패턴 기반이라 실기기 확인 필요(미확인).
- 시작 복원: real 모드(App.tsx restore)에서 restoreSession(세션+parent 프로필 확인)으로 첫 화면 결정, 실패 시 "다시 하기". AppState active 시 서버 재조회. 날짜 변경 시 새 콘텐츠는 이 재조회로 반영(실기기 자정 경계 미확인).
- ChildHome: 오류 상태 분리+다시 하기, 포커스·포그라운드 재조회, fetchChildHome 왕복 병렬화. 어르신 여러 명 처리는 미적용(리뷰 12번 후반).
- photo/question null이면 no_content 화면. realApi 세션 읽기 오류면 새 익명 로그인 안 함.
- **라이터 확정 필요 임시 문구**(copy.ts tempCopy): 서버 오류 "앱이 잠깐 헷갈렸어요 / 잠시 뒤에 다시 해 볼까요? / 다시 하기". 코스 홈 나중 동의 안내는 consent 키 재사용.

## 6f: 계정·데이터 삭제 (2026-11-17)
- Api: `deleteScopePreview()`(delete_scope_preview), `deleteMyAccount()`(delete_my_account 후 signOut, RPC 실패면 로그아웃 안 함). 확인 화면은 미리보기 scope로 분기: family=굵은 경고 박스+'삭제' 입력 후 확인, child='내 계정만 지워져요', parent=기록 삭제 경고+확인 2번. 미리보기 실패 시 가장 강한 경고(family)로 대체.
- 성공 후 `DeleteDone` 하나만 남기는 스택 reset, '처음으로'로 어르신은 Connect, 자녀는 Login 자리표시로 이동. 실패는 "아직 지워지지 않았어요" + 다시 하기.
- 진입점: 어르신 코스 홈 하단 작은 링크, 자녀는 리포트 화면 하단 링크. **설정 탭 추가 여부 미결정**. 자녀 쪽은 홈/리포트 탭을 감싸는 stack을 새로 둠. 자녀 로그인 화면은 아직 없어 자리표시(카카오 연동 단계).
- **라이터 확정 필요(tempCopy.del)**: 링크, 경고·확인·취소·실패·결과 문구 전부(copy.ts 참고).
- 통합 테스트는 자녀 둘인 경우(scope child)를 검증하지 못함: 서버에 두 번째 자녀 합류 RPC가 없음. 서버 요청 사항.
- 삭제 후 인증 계정(auth.users)은 서버에 남음(서버 정책). 로컬 캐시(AsyncStorage)는 signOut이 세션만 지우며 그 외 캐시는 앱에 없음.

## 6g: 자녀 노출 축소·동의 흐름 (2026-11-17)
- 자녀 홈은 `child_summary()` 기반(`fetchChildSummary`): 제목 "{호칭}의 최근 답", 선택지·날짜·"{선택지} 이야기를 해 볼까요?", latest 없으면 "고른 답이 생기면 여기에 보여요", shared=false면 "답을 나누지 않는 중이에요". 단계·연속일·참여 여부·"아직" 제거(테스트에 금지어 검사). 날짜는 오래돼도 그대로(경과 일수 안 셈).
- 문구는 writer r2 확정 표 기준이나 copy.ko.json에 child 키가 없어 `tempCopy.child`에 임시 배치(**copy.ko.json 이관 필요**). tempCopy.settings(어르신 설정)도 라이터 확정 필요.
- 동의: 거부·철회한 어르신도 코스는 그대로 진행, consented=false면 saveAnswer 호출 안 함. 코스 홈 '설정' → 어르신 설정(동의 상태에 따라 '다시 동의하기'/'동의 철회'(확인 1단계), '데이터 지우기'). 코스 홈의 삭제 링크는 설정으로 이동. 호칭 설정 UI는 자녀 쪽 미구현(API `setParentTitle`만).
- Text20은 20 미만을 허용하지 않아 날짜도 20(디자이너의 자녀 16 허용은 미적용).
- realApi: 어르신이 아직 없는 가족은 shared=true·latest=null로 취급(미확인 가정). 여러 어르신이면 첫 번째만 사용.

## A단계 (v3 문구 이관, 2026-11-17)
- copy.ko.json에 brand/child/settings/delete/errors.server/app.ai_photo_label 추가, cheers·consent·greeting·photo_load_failed 교체. tempCopy 삭제(copy.ts는 `withTitle`만). 앱 사본 동일. 탭 "앨범"·"지난 답". 마지막 자녀 지우기 확인 단어 '지우기'. 삭제 화면은 "그만둘래요"가 주 버튼, 자녀 호칭은 child_summary에서 가져와 {호칭} 치환.
- PhotoStep "AI가 만든 그림": 실제 사진(비 pending)일 때만 사진 아래 표시. 시안 v3엔 위치·크기 확정이 없고(components.md D9 "개발과 결정") 20 미만 금지 규칙에 따라 Text20(20)로 구현. 시안이 더 작은 크기를 확정하면 조정.
- 철회 확인 본문은 서버가 저장된 답을 지우므로 copy-v3의 "교체안"("…지금까지 고른 답도 지워져요")을 사용(원안 "그대로예요"는 서버 동작과 불일치).
- 금지어 테스트(__tests__/copyBan.test.ts)는 copy.ko.json 전 키 대상(아직·못 했·미완료·N일째·틀렸·치매/치료/예방), "어르신"은 child·delete.child·cheers 키 대상.

## B단계 (미연결 열람·동의 버전·오류 처리, 2026-11-17)
- 미연결 열람: realApi.getTodayContent 가 parent_required/no_profile 이면 preview_content 를 부른다. 서버는 "프로필 없음"도 parent_required 로 알려 주어 자녀와 구분되지 않으므로, preview_content 가 linked_use_get_today_content 를 내면(=프로필 있음, 예: 자녀) **원래 get_today_content 오류를 그대로 올린다**. TodayContent.linked=false면 상단 "번호를 받으면 그때부터 답이 저장돼요"+"번호 쓰기", 저장·기록·동의·설정 없음. Connect 화면에 "코스 보기" 입구.
- 동의 버전 상수 CONSENT_VERSION='v2'(copy.ts)를 give_consent(p_version)에 전달. 문구가 바뀌면 올린다.
- fake 서버도 미동의 save_answer 를 consent_required 로 거부. fake 옵션 정리: shared 제거(동의 여부로), linked 는 "번호 입력 전 미연결"과 restoreSession 공용.
- 세션 정리: applyConsent/applyWithdraw → setConsented(v). 포그라운드 재조회 실패는 syncError(코스는 유지, "다시 하기"). 동의 화면 서버 확인 실패·코스 홈 나중 동의 실패는 오류 문구 표시.
- **버그 수정**: 단계 화면이 navigate('CourseHome')으로 코스 홈을 새로 쌓고 있었다(React Navigation 7 동작). popTo 로 교체. 이전에는 매 단계마다 코스 홈이 다시 마운트되며 재조회했다.
- 문구: 2차 확정(course/done/question/settings 보여 주기 계열/delete.parent "모두 지우기", 한 번 확인) 반영, 연속 일수 표시 제거. errors.not_parent_device 버튼은 역할 선택 경로가 없어 "알겠어요"(본문 "처음 화면에서 다시 골라 주세요"는 C단계 역할 선택 전까지 사실과 다름). P8 응원 화면은 아직 없어 cheer 키만 추가.

## B단계 재검토 반영 (2026-11-17)
- 첫 실행(세션 없음): realApi.getTodayContent 가 먼저 `ensureSession()`(세션 없으면 익명 로그인, 세션을 못 읽으면 OfflineError로 새 사용자 안 만듦). 서버 권한은 그대로(anon 회수). 실서버 통합 테스트로 재현.
- 오류 구분: `ServerError(what, reason, code)`·`isServerError(e, reason)`(P0001 + 예외 이름 일치). 코드가 없는 실패만 네트워크 후보(OfflineError). 42501 등은 서버 오류 문구("잠깐 문제가 생겼어요").
- 재조회 경로 하나로: 세션 `sync()`(throw 안 함, 실패는 syncError). CourseHome·ConsentScreen·포그라운드가 모두 사용. 미연결 열람은 같은 날 재조회 시 화면의 단계 진행을 유지.
- 정리: QuestionStep 이중 가드 제거, DeleteLink 옵션 제거(자녀 전용), `as never` 제거(ParentParams/ChildParams 타입), content 가 없을 때 setConsented 는 sync 로 서버 상태를 다시 받음.
- 동작 변화: 삭제 후 그 기기에서 코스를 열면 새 익명 세션의 미연결 열람이 된다(통합 테스트 반영).

## C단계: 자녀 로그인·가족·번호·연결 대기·역할 선택 (2026-11-17)
- 첫 화면 RoleSelect(P0·C0): "어떻게 쓰실 거예요?" / "받은 번호가 있어요"(어르신) / "자녀예요". real 모드는 whoAmI(연결된 어르신/로그인 자녀/없음)로 복원. errors.not_parent_device 버튼 "처음으로" → 역할 선택.
- 자녀 스택: Gate → Login(이메일 → 메일 6자리, 다시 받기·다른 이메일) → Relation(7개 닫힌 목록, 기본 부모님) → createFamily·setParentTitle·issueInviteCode → Code(큰 숫자 3자리씩, 시스템 공유 "번호 보내기") → Wait(처음·포그라운드·15초마다 확인) → 연결됨(C3 3차 문구) → 앨범.
- 역할에 묶이지 않는 컴포넌트: features/link/CodeShow(번호 보여 주기·공유), CodeEntry(6자리 쓰기, 어르신 번호·메일 인증번호 공용). ui/는 수정하지 않음.
- Api: sendEmailCode·verifyEmailCode(auth 오류는 앱이 reason 분류: rate_limited·invalid_email·otp_expired, `hasReason`), getChildState(child_summary + 미사용 가입 번호 1개 조회), whoAmI.
- **미구현·결정 필요**: "번호 복사하기"는 RN 코어에 클립보드가 없어 의존성(@react-native-clipboard/clipboard 등) 추가가 필요 — 이번엔 공유 시트만(안드로이드 공유 시트에 복사 있음). 로그인 문구(login.*)는 임시, 라이터 확정 필요. 로컬 config.toml email_sent=2/시간이라 OTP 통합 테스트를 자주 돌리면 rate_limited로 실패할 수 있음. 원격은 SMTP·메일 템플릿에 6자리 번호({{ .Token }}) 포함 여부 확인 필요(로컬은 통과).

## C단계 리뷰 반영 (2026-11-17)
- 시작 복원은 whoAmI 하나(restoreSession 삭제). whoAmI 실패는 오프라인 화면이 "불러오는 중"보다 먼저 보이고, 다시 하기가 역할 확인부터 다시 한다.
- 대기 화면: Code의 "연결 기다리기"는 돌아갈 수 있으면 goBack, 아니면 replace(대기 화면이 쌓이지 않음). 폴링은 화면당 interval 하나, 진행 중 요청이 있으면 건너뜀, 백그라운드·연결 후·언마운트 시 멈춤. 상태 불러오기 전 "번호 다시 보기" 비활성, 실패는 오류 줄.
- 로그인: 문구 7절 확정본. 인증번호 다시 받기 60초 대기(숫자 표시 없음), rate_limited·오프라인 문구, 보낸 지 10분 지난 뒤 틀리면 "시간이 지났어요"(서버가 틀림·만료를 같은 코드로 줌), 이메일 autoCorrect·autoCapitalize 끔, "처음으로".
- 리드 결정: whoAmI=parent 인 폰에서 "자녀예요"를 고르면 "이 폰은 부모님 폰으로 쓰고 있어요" + 처음으로(자녀 로그인이 어르신 세션을 덮어쓰지 않게).
- ui 최소 수정: BigButton accessibilityHint(역할 선택 설명을 힌트로). 이름 ChildTabs → ChildStack.

## 실기기 피드백 반영 (갤럭시 S25, 2026-11-17)
- 안전 영역: SafeAreaProvider 에 initialWindowMetrics(첫 프레임 inset 0 방지). link·child 화면의 주 버튼을 Screen 하단 고정 영역(bottom, 하단 inset 패딩)으로 옮김: 역할 선택·번호 쓰기·동의·로그인·호칭·번호·대기·어르신 폰 안내. 탭 화면(앨범·지난 답)은 탭 바가 inset 처리.
- 인증번호: 기본 숫자 키보드(OtpField, number-pad·oneTimeCode·sms-otp, 숫자만 6자리). "확인하기" 하단 고정, 그 위 보조 링크(TextLink) "인증번호 다시 받기"·"다른 이메일 쓰기". 어르신 번호는 큰 키패드(CodeEntry 는 키패드만, 제출은 하단 고정).
- 칸·키 구분(ui/CodeInput 최소 수정): 칸 = paperSoft 면 + 아래 선 4(line), 지금 쓸 칸 = 테두리 4 action + 흰 면, 키 = paperEdge 채움·테두리 없음(글자 대비 5.76), 눌림 actionSoft(6.03).
- 이전 바(app/BackBar): "‹ 이전", 라벨 "이전 화면으로", 64dp. 하드웨어 뒤로가기도 같은 동작(useBackAction). 스택 첫 화면(역할 선택·코스 홈·앨범·대기·결과)에는 없음. 루트 화면은 명시 동작: 어르신 번호·자녀 이메일 → 역할 선택, 인증번호 단계 → 이메일 단계, 코스 단계 → 코스 홈(확인 없음).
- 문구 nav.back·login.code_label 은 임시(라이터 확정 필요). 실기기 재확인 필요(키보드가 하단 고정 영역을 밀어 올리는지, sms-otp 자동 채우기는 메일 번호에는 동작 안 할 수 있음).

## 첫 화면 확정안 (C 구성 + A 질문, 2026-11-17)
- RoleSelect: 브랜드 심볼(react-native-svg SvgXml, 원본 design-system/assets/symbol-sun-polaroid.svg 사본 문자열) + 워드마크 + 한 줄 설명, 소개 폴라로이드(캡션 "마을 입구 나무" = 실제 사진 day-01 의 seed 제목, "AI가 만든 그림"), 하단 고정 영역에 질문 + 두 줄 버튼 2개(TwoLineButton, 88 이상, 읽기 "제목. 설명"). 첫 화면만 dockMaxRatio 0.6(40% 규칙 예외, ui/Screen 에 선택 prop 추가). 글자 130%면 한 줄 설명, 150%면 폴라로이드까지 숨김.
- 사진은 **번들**: day-01.jpg(1152x928, 579KB)를 480px로 줄여 약 86KB. 원격 URL 은 첫 화면이 네트워크에 의존(2초 규칙·오프라인 첫 실행에 불리)해 제외.
- 의존성 추가: react-native-svg 15.16.1(README 호환표: >=15.16.0 은 RN >=0.80, 새 아키텍처(Fabric) 최신 지원 명시는 표에 없음 → Android debug 빌드 성공으로만 확인, 실기기 렌더 미확인).
- 자녀 인증번호: 6자리를 채우면 자동 확인(진행 중 중복 호출 막음), 틀리면 칸 비우고 오류. "확인하기" 버튼은 없앰(라이터 8절 "6자리를 다 쓰면 바로 확인해요").
- 문구 8절 반영: 이전 바 라벨 "이전 화면으로 가기", 코스 단계 "‹ 오늘 코스"/"오늘 코스로 돌아가기", 어르신 폰 막힘 안내(제목·본문·알겠어요), 번호 읽기 "연결 번호 4 8 2, 9 1 5". 미반영: connect.code_a11y(어르신 키패드 칸별 읽기)는 ui/CodeInput 수정이 필요해 다음 차례.

## 첫 화면 실기기 깨짐 수정 (S25 캡처 06-first-v3.png, 2026-11-17)
- 원인(추정): 폴라로이드 폭 '82%' + 사진 width '100%' + aspectRatio 가 ScrollView 안에서 실기기에 맞게 풀리지 않아 이미지가 고유 크기·세로로 커지고 본문이 스크롤되어 위 글이 밀림. 실기기에서 원인 단정은 못 함.
- 수정: 첫 화면 본문은 스크롤 없이 남은 높이를 채움(ui/Screen `fill` prop 추가: flexGrow 1·스크롤 끔). 사진 영역 onLayout 으로 남은 폭·높이를 재고 `polaroidLayout()`(features/link)이 사진·틀 크기를 **숫자로** 계산: 가로형 비율 고정, -2도 회전한 바깥 상자까지 영역 안, 캡션 두 줄 높이는 글자 배율 반영, 사진 폭 140 미만이면 숨김. 영역은 overflow hidden.
- 테스트: 계산 함수(S25 상당·높이 부족·작은 화면·큰 글자)와 화면(측정값 = 그려진 사진 크기, 스크롤 꺼짐, 작으면 숨김). **실기기 캡처 확인 전에는 완료 아님.**

## 첫 화면 소개·사진 축소, 번호 화면 맞춤, 자리표시 전수 제거, 코스 홈 v3 (2026-11-17)
- 첫 화면: 9절 A(제목 "하루 한 장, 우리 집 앨범" + icon-photo/pencil/family 항목 3줄, 소개는 한 덩어리로 읽힘, 셋째 줄이 두 줄이면 짧은 문구). 사진은 보조: **사진 자체** 최대 폭 화면 50%·높이 22%(캡션 칸은 별도), 공간이 모자라면 사진부터 숨김. 글자 130% 사진 숨김, 150% 소개 항목까지 숨김(제목 유지).
- 어르신 번호 화면: 해님 자리표시·인사 제거, 제목 26. 본문 스크롤 끄고 남은 높이로 키 높이 64~68 계산(keypadFit), 64로도 안 되면 "틀려도 괜찮아요"를 숨기고, 그래도 안 되면 키 64 + 본문 스크롤. ui/CodeInput 에 keyHeight prop.
- 자리표시 전수: AssetPlaceholder 사용처 3곳 제거(번호 화면 해님 → 결정대로 제거, 사진 준비 중 → 옅은 면+icon-photo+안내, 한글 따라 쓰기 칸 → 빌드 1 미구현이라 제거). 정적 테스트(화면 코드에서 AssetPlaceholder 사용 0, 쓰는 registry 에셋 null 아님) + 주요 화면 순회 테스트.
- 코스 홈: 미연결 안내를 얇은 띠 한 줄+작은 링크(48), "오늘 코스예요" 제거, 진행 문구(둘/하나 남았어요), 날짜 줄(KST), 스티치 구분선(album-stitch-wave-long), 이번 주 도장 줄(sun-stamp a/b/c 번갈아, 빈 칸 점선, 오늘 굵은 점선, 숫자 없음). **도장은 서버가 연속일만 주므로 연속 구간만 칠함 — 이번 주의 비연속 날은 표시 못 함. 서버에 주간 완료 날짜 RPC 필요(리드 제안 대상).** stamps_a11y "이번 주 도장 {n}개" 임시.

## 디자인 QA 반영(P1·P3·첫 화면) + 주간 도장 (2026-11-17)
- QA 표 3개(docs/design/device-review/QA-P1-connect.md, QA-P3-course-home.md, QA-first-screen.md)에 항목별 "고침/보류(이유)" 기록.
- 공통 ui 변경: 하단 영역 위 실선 제거, 아래 여백 max(28, 16+inset), 비활성 버튼 테두리 제거+이유 줄을 버튼 위로, 번호 키 볼록(흰 면+테두리 3+그림자, 최소 64)·지금 칸 noticeSoft+커서 막대, StepRow(지금=테이프 라벨, 대기·완료=한 줄·대기 보통 굵기).
- Android 10+ 테마(values-v29): 내비게이션 바 대비 막 끔·종이색·어두운 아이콘. debug 빌드 성공, 실기기 확인 필요.
- 코스 홈: 제목 줄 오른쪽 "설정"(톱니, 64), 날짜 줄 22 굵게, 스티치 2곳, 주 버튼 "이어서 하기". 이번 주 도장은 서버 my_week_stamps(완료 날짜, 띄엄띄엄 포함)로 칠함, 미연결 열람이면 호출 안 하고 줄 숨김, 단계가 바뀌면 다시 받음, 실패 시 줄만 숨김.
- 첫 화면: 셋째 소개 줄 확정문 두 줄 허용(대체 문구 삭제), AI 표기 틀 밖, 틀 반경 3·사진 0, 그림자 여백, 위 여백 16, 워드마크 28.
- 보류: 글꼴(라이선스), 해님 말풍선(결정), P1 번호 칸 모양(DECISIONS 오목 규칙 vs 시안 흰 면 — 조율 필요), P1 "‹ 이전" 바(리드 결정).

## 실기기 2차(10-p1·09-first) 수정 (2026-11-17)
- P1 원인: 본문 ScrollView 의 contentContainer flexGrow 때문에 keypad-area 가 키패드 자체 높이로 재어져 "들어간다"고 오판 → 실제 보이는 영역 밖이 잘림(스크롤도 꺼짐). 수정: 키패드를 영역 위에 띄워(absolute) 영역 크기를 키패드가 밀지 않게 재고, 단계별로 공간 확보: 1 보조 문구 숨김 → 2 제목 26→22 → 3 링크 두 개를 이전 바 줄로 → 4 키 64 + 본문 스크롤. 링크 두 개는 한 줄, 비활성 "다음"의 이유는 화면 읽기 힌트로만. 번호 칸은 보여 주는 칸이라 52, 줄 간격 6 → 필요 높이 4x키+88.
- 예산 계산(테스트): S25(780dp, 하단 48)는 1단계 안에서 4줄 모두, 360x640 제스처(하단 16)는 3단계까지 줄이면 4줄 모두, 360x640 3버튼(하단 48)은 64 키로 불가 → 4단계 스크롤(잘림은 없음). 실측 아님.
- 첫 화면 원인: 남은 영역(약 328x183dp)에 비해 틀 여백·캡션·AI 줄·그림자 여백을 크게 잡아 최소 폭 미달로 숨김. 여백 축소(틀 8, 그림자 8, 캡션 줄+8, AI 줄+4)와 최소 폭 96 으로 이 영역에서 표시. 셋째 소개 줄은 마지막 세 어절을 붙여 "고른 답으로 자녀가 / 취향을 알아 가요"로만 나뉨. 한 화면 구성(Screen fill)의 본문 아래 여백 24→8.

## 첫 화면 사진 3차(12-first: 여전히 숨김) (2026-11-17)
- 방향 전환(리드): 계산 기반 숨김 제거. 글자 배율 1.3 미만이면 사진을 항상 그림. 크기 = 남은 영역 폭의 50%, 영역 높이 안에 틀·캡션·AI 줄이 들어가게 비율 유지(polaroidLayout.photoSize). 측정 전(0)은 기본 폭 140, 아주 작아도 72 아래로는 줄이지 않음.
- 영역 overflow hidden 제거(영역이 0으로 재어져도 사진이 보이게). 실기기 원인 추정: 영역이 실제보다 작게(또는 0으로) 재어져 숨김 → 개발 빌드에서 `[first-screen] area W H photo {...} win W H fontScale` 로그를 남겨 확인.

## 첫 화면 사진 4차(14-first: 아래가 하단 영역에 가림) (2026-11-17)
- 원인: 사진이 영역 안에 보통 배치라 영역 크기를 밀어 올려, 잰 높이가 실제 남은 공간이 아니었음(P1 키패드와 같은 원인). 수정: 영역 flex 1 + minHeight 0, 사진은 absolute 로 띄운 pinned 안(영역을 밀지 않음).
- 크기: 사진 높이 = 영역 높이 − (틀 위 8 + 캡션 줄 38 + AI 표기 줄 34 + 위아래 여백 합 8 + 기울기 여유), 폭 = 높이 x 비율(영역 폭 50% 이하). 최소 폭 72로도 안 들어가면 숨김(글자 배율 1.3 미만이어도). S25 실측 근처 150/160/175dp → 사진 73/85/102dp 폭, 틀 전체가 영역 안(테스트).

## 첫 화면 캡션 말줄임 제거 (15-first, 2026-11-17)
- 폴라로이드 캡션은 말줄임 금지: 글자 크기 = 사진 폭의 12%(12~18, 글자 배율 미적용), 한 줄 폭 추정(한글 1em, 그 밖 0.5em)이 사진 폭을 넘거나 실제로 두 줄 이상이면 캡션만 숨김(AI 표기는 유지). 어르신 본문 20 규칙의 예외(사진 장식 캡션, 리드 지시).
- "마을 입구 나무"는 7em → 사진 폭 84 이상이면 표시(S25 160dp 영역 근처), 최소 크기(72)면 숨김.

## 첫 화면 FS_D "앨범 펼침" 구현 (2026-11-17)
- 소개 아이콘: 지름 36 색 원(사진 accentSun #FFE29A, 연필 sky, 가족 accentPeach #FFD6C2) + 아이콘 22 inkTitle(대비 9.54/9.37/8.99). 토큰 2개를 design-system/tokens-v3.json 과 app ui/tokens.ts 에 함께 추가(designSystem 테스트가 일치 검사).
- 사진 묶음(PolaroidStack): 앞 day-01 + 뒤 day-02(왼쪽 -9°, -31%)·day-09(오른쪽 +8°, +31%), 뒤 사진은 360px 번들(약 33·39KB). 테이프, 틀 아래 흰 띠 30. **캡션·AI 표시 없음**(사용자 결정), 화면 읽기 라벨 "옛날 사진 앨범"(임시). 기존 캡션 코드(captionFont·captionFits, 캡션·AI 문구 키)와 테스트 삭제.
- 크기(stackLayout): 영역 측정·띄워 두기 유지. 앞 틀 폭 ≤ 영역 폭 44%, 기울기·뒤 사진 펼침·테이프 포함 묶음 전체가 영역 안인 최대 크기, 앞 사진 폭 72 미만이면 숨김. S25(312 폭) 150/160/175dp → 앞 사진 85/94/109.
- 모션: RN Animated + useNativeDriver 만. 심볼 450, 항목 3줄 300(150/270/390), 아이콘 원 300(150/230/310, 튀어나옴 이징), 앞 사진 내려앉음 450(200), 뒤 2장 펼침 450(520/580), 인화 덮개 1200(450). 처음 마운트 때 한 번. 동작 줄이기(AccessibilityInfo)면 300ms 페이드만, 뒤 사진은 처음부터 펼친 자리. 버튼은 애니메이션과 무관하게 처음부터 누를 수 있음.
- 실기기 확인 필요: 모션 체감·회전 interpolate 렌더, 그림자(boxShadow) 렌더, 뒤 사진 겹침 순서.

## 첫 화면 D 독립 리뷰 반영 (2026-11-17)
- 크기: 회전한 뒤의 상자로 계산(뒤 사진 9° 상자 높이 + 5% 내려앉음 + 테이프 12 + 여유 8 ≤ 영역). 리뷰 공식으로 S25 150~190dp 검증.
- 모션: 인화 덮개 500ms. 영역을 잰 뒤 시작, 앱 실행당 1회(모듈 플래그, 돌아오면 끝 상태), 스크린리더 켜짐이면 끝 상태로 바로(useMotionMode: none/reduce/full).
- 소개 아이콘 24. 사진 묶음 화면 읽기 "옛날 사진 앨범, AI가 만든 그림"(눈에 보이는 표시 없음).
- 큰 글씨: 130% 이상 하단 높이 상한 해제, 150% 이상 소개(제목·항목)·사진 숨김, 하단 내용이 화면에 안 들어가면(측정) 고정을 풀고 전체 스크롤.
- AI 고지: 코스 사진 "AI가 만든 그림 · 실제 장소가 아니에요", 어르신 설정 "앱 정보 / 오늘의 사진은 AI로 만든 그림이에요", 자녀는 설정 화면이 없어 지난 답 화면 아래 1줄(설정 생기면 이동).
- 남은 리뷰 권고(앱 밖, 미반영): 스토어 이미지 안 AI 표기, 방침·스토어 설명 1줄, DECISIONS에 "첫 화면 소개 이미지 예외" 명시, 앞 사진 onLoad 뒤 시작(저가 기기).

## 첫 화면 D 실기기(17-first-D: 묶음 숨김) 대응 (2026-11-17)
- 숨기기 전 줄이기 순서(stackLayout VARIANTS): 기본(9°/8°, 펼침 31%, 테이프 12, 여유 8, 최소 72) → 회전 5° → 펼침 22% → 테이프 8 → 여유 4 → 최소 56 → 뒤 2장 빼고 앞 1장 → 숨김. 계산상 328폭 140/150/160dp는 기본 그대로 앞 사진 79/89/99(숨김 아님), 120은 5°·22%, 100은 앞 1장.
- **계산으로는 150dp에서 숨지 않으므로 실기기 원인은 다른 곳일 수 있음**(영역이 더 작게 재어짐, 또는 모션 미시작으로 투명). 그래서 ① 릴리스 포함 실행당 한 번 `[first-screen] area W H front FW mode M variant ...` 로그 ② 모션을 2.5초 안에 시작 못 하면 끝 상태로 보이는 안전장치를 넣음.
- 위 여백 재분배: 워드마크~소개를 한 덩어리(간격 10, 소개 줄 6), 워드마크 위 4. 본문 형제 간격 16은 덩어리-사진 영역 사이 한 번만.

## 첫 화면 묶음 투명 원인 확정·수정 (logcat: area 312 161 front 100 mode full, 2026-11-17)
- 확정: 크기·mode·실행당 1회·스크린리더 조건은 모두 정상(로그). 같은 시점에 시작한 소개 줄 애니메이션은 보였고 묶음만 투명 → 차이는 "마운트 시점". 묶음은 영역 측정 커밋에서 처음 마운트되고, 그 커밋의 useEffect 에서 네이티브 드라이버 애니메이션을 바로 시작했다. 새 아키텍처에서 이 시점엔 네이티브 뷰가 아직 붙지 않아 애니메이션 값이 뷰에 적용되지 않고 JS 초기값(opacity 0)이 남았다(소개 줄은 그보다 앞서 마운트돼 있어 정상). 단, 네이티브 내부 동작은 기기에서 직접 계측하지 못한 추론이며, 수정 후 실기기 캡처로 최종 확인 필요.
- 수정: 묶음 자신의 onLayout(네이티브 뷰가 붙고 배치된 뒤)을 받은 다음에 모션 시작. 중간에 멈추면(finished=false) 끝 상태로 맞춤. 2.5초 안전장치는 남기되 정상 경로에서는 시작 플래그가 먼저 서서 발동하지 않음(테스트로 확인).
- 테스트: 영역 측정 커밋에서는 묶음 모션 미시작 → 묶음 onLayout 뒤 시작, 정상 경로에서 안전장치 미발동, onLayout 이 안 오면 2.5초 뒤 끝 상태.

## 훅 순서 경고 원인·회귀 방지 (2026-11-17)
- 원인: 앱 코드가 아니라 테스트. firstScreenIntro 의 하단 여백 테스트가 RoleSelect 를 마운트한 채로 useSafeAreaInsets 모의 구현(useContext 를 쓰지 않는 함수)을 원래 구현(useContext 사용)으로 되돌려, 같은 컴포넌트의 다음 렌더에서 훅 개수가 달라졌다. RoleSelect 의 훅은 모두 무조건·같은 순서(early return 앞)로 호출됨을 확인.
- 수정: 모의 구현을 바꾼 테스트는 먼저 unmount 한 뒤 되돌림(firstScreenIntro, deviceFeedback). jest.setup 에서 "order of Hooks"/"Rendered more|fewer hooks" console.error 를 throw 로 바꿔 회귀 시 테스트 실패.

## 자녀 소셜 로그인(카카오·구글) 구현 (2026-11-17)
- 패키지: @react-native-kakao/core·user 3.2.0(peer RN >=0.76, 새 아키텍처 TurboModule), @react-native-google-signin/google-signin 17.0.0(공개판). expo 는 optional peer. js-sha256 은 최신판(1.0.1)이 오늘 배포돼 공급망 위험으로 쓰지 않고 SHA-256 을 직접 구현(src/lib/sha256.ts, 알려진 값 테스트).
- 흐름: 카카오 login({nonce: sha256(원문)}) → idToken → signInWithIdToken({provider:'kakao', token, nonce: 원문}). 구글 signIn → idToken → signInWithIdToken({provider:'google', token}) (공개판은 nonce 미지원, Skip nonce checks 켜지 않음). 취소(카카오 Cancelled·AccessDenied, 구글 cancelled 응답·SIGN_IN_CANCELLED)는 조용히, 네트워크는 OfflineError, ID 토큰 없음은 no_id_token 오류.
- nonce 난수: crypto.getRandomValues 있으면 사용, 없으면 Math.random 대체(Hermes 기본 제공 여부 미확인 — 실기기에서 확인 필요).
- 공개 값: src/lib/socialConfig.ts(카카오 네이티브 키, 구글 웹 클라이언트 ID). 비밀값 없음. 안드로이드: android/build.gradle allprojects 에 카카오 maven, AndroidManifest 에 AuthCodeHandlerActivity(scheme=@string/kakao_scheme, strings.xml 에 kakao{키}, 테스트로 일치 검사). debug 빌드 성공.
- 화면: 자녀 로그인 첫 단계 = [카카오로 시작하기](노랑 #FEE500/#191919, 시안 C0) → [구글로 시작하기](흰 면·#747775 테두리) → "이메일로 받기"(보조 링크, 기존 인증번호). 이전: 이메일 → 로그인 방법 → 역할 선택. 어르신 연결 폰은 ChildGate 에서 막혀 소셜 화면에 들어가지 않음.
- 계정 지우기: 카카오로 로그인한 자녀면 카카오 unlink + SDK 로그아웃 + Supabase 로그아웃(구글은 SDK 로그아웃). 별도 "로그아웃" 화면은 아직 없음(자녀 설정 C7 미구현).
- 남은 것: 카카오·구글 공식 로고 에셋(버튼에 글자만), 문구 choose_title·google·email_link 라이터 확정, Play App Signing 키 해시를 카카오 콘솔·구글 Android 클라이언트에 등록(출시 시), 실기기 로그인 확인.

## nonce 난수: Math.random 대체 제거 (2026-11-17, 리드 지시)
- react-native-get-random-values 2.0.0(2025-10-22 배포, 정확 고정, TurboModule codegen, peer RN>=0.81)을 index.js 맨 첫 import 로 폴리필. 소셜 패키지 3개도 정확 버전 고정(캐럿 제거).
- makeNonce 는 crypto.getRandomValues 만 사용(32바이트 hex). 없으면 NoSecureRandomError → 카카오 로그인은 SDK 를 부르지 않고 ServerError(no_secure_random) → 화면 "로그인이 안 됐어요". Math.random 경로 삭제(테스트로 호출 0회 확인). debug 빌드 성공.

## 첫 화면 두 버튼 D2-C (2026-11-17)
- RoleChoiceButton(첫 화면 전용, 토큰 예외는 이 컴포넌트에만): 부모님 accentSun·자녀 sky 면, 갈색(ink) 테두리 3 + 아래 7, 반경 24, 최소 88, 패딩 12/12/12/16, 제목 26 굵게 inkTitle(26 상한), 둘째 줄 20 ink, 오른쪽 icon-chevron-right 26. 눌림: 면 actionSoft, 아래 두께 3, translateY 4. 손 떼면 바로 이동. 질문 28 ink + 아래 10, 버튼 사이 14. TwoLineButton 삭제. 150/200% 규칙(상한 해제·소개 숨김·전체 스크롤) 유지.
- 차이: 시안의 › 선 굵기 3.4 → 디자인 시스템 아이콘(2.5) 사용. 굵게 하려면 아이콘 원본 변형 필요(디자이너 확인).

## 2026-11-17 보안 검토 후속 · 스플래시 · 지난 답 버그
### 탈퇴 시 인증 계정 삭제 (검토 #1) — 방식 비교와 선택
- (A) **채택**: `delete_my_account()`(security definer) 끝에서 `delete from auth.users where id = auth.uid()` — 마이그레이션 0017.
  - 앱 데이터 삭제와 같은 트랜잭션: 둘 중 하나만 되는 반쪽 상태가 없다. 서비스 키·Edge Function 불필요. 호출자 본인만 지움(인자 없음).
  - auth.identities·sessions·refresh_tokens 는 auth 스키마의 cascade 로 함께 삭제. public 쪽 FK(families.created_by, invite_codes.used_by)는 0008 에서 on delete set null 처리됨.
  - 확인 필요(미확인): 호스팅 프로젝트에서 함수 소유자(postgres)가 auth.users 를 지울 권한 — 원격 반영 때 확인.
- (B) 보류: Edge Function + service_role `auth.admin.deleteUser`. 공식 API지만 배포·시크릿 관리가 늘고, 앱→RPC→함수 두 번 호출 사이 실패 시 반쪽 상태.
- 앱: 서버가 인증 계정을 지우므로 `signOut({scope:'local'})`. 소셜 SDK 정리는 `app_metadata.providers` 배열 기준(검토 #5), 카카오 unlink 실패해도 다음 정리 계속.
### 고아 익명 정리·어르신 기기 차단 (검토 #4)
- RPC `discard_anonymous_session()`: 익명 + 프로필 없음일 때만 그 인증 계정 삭제. 앱은 소셜 토큰을 받은 **뒤**(취소 시 세션 유지) 호출 → 로컬 로그아웃 → ID 토큰 교환.
- `signInWithSocial` 이 API 단에서도 익명+parent 프로필이면 `ServerError(reason 'parent_device')`, SDK 호출 없음.
### TODO(설계만)
- 카카오 서버 unlink: 기기 토큰이 없으면 앱 unlink 가 실패한다. 서버에서 Admin 키로 `POST /v1/user/unlink`(target_id_type=user_id, target_id=identities.provider_id)를 탈퇴 RPC 뒤 비동기로(Edge Function + 시크릿). **Admin 키는 앱에 넣지 않는다.** 실패 시 재시도 큐.
- 자녀 로그아웃 버튼: 자녀 설정(C7) 화면이 생길 때. 로그아웃 = providers 별 SDK signOut + supabase signOut(global).
### 스플래시 SPL_A
- androidx core-splashscreen **1.2.0** 고정. Theme.App.Starting(paper, splash_symbol 벡터 288/128), MainActivity installSplashScreen + keepOnScreen(SplashModule.hide 또는 3초).
- JS: 루트 onLayout 에서 hide 1회. 복원 대기 = 심볼만(2초 넘으면 "잠시만요"). 첫 화면: 가운데 128 → 워드마크 옆 40 이동 450ms(동작 줄이기 300ms 페이드, 스크린리더 즉시), 목표 못 받으면 1초 안전장치. 실행당 한 번.
- 런처 아이콘: 적응형(paper 바탕 + 심볼 60/108dp, monochrome 포함) + 레거시 PNG 5밀도(같은 구성 렌더). 디자이너 세부 명세가 없어 크기는 가정값 — 디자이너 확인 필요.
- 미확인: 실기기 Android 12+ 아이콘 실제 크기·compat 모습, 심볼 이동 위치 정합(edge-to-edge 기준).
### 지난 답 탭 버그(PM 감사 C5)
- 원인: ChildReport 가 데이터를 조회하지 않고 빈 문구를 고정 출력. 요약 조회를 `useChildSummary` 로 분리해 앨범·지난 답이 함께 쓰고, 지난 답은 최근 답 1개(날짜·질문·고른 답)·빈·나누지 않음·로딩·오류 상태를 보여 준다. 여러 개 목록은 범위 결정(감사 질문 5)과 목록 RPC 가 필요.
### 시작 대기 일원화(실기기 20-splash.png 지적, 11-17)
- 원인: 시작 대기를 AppRoot 의 whoAmI 대기에서만 덮었다. 자녀 세션은 ChildGate, 어르신은 CourseHome 등 다음 화면이 각자 좌상단 "잠시만요"를 그렸다.
- 수정: `splash.ts` 시작 대기(boot) 한 곳. 첫 로딩 중인 화면은 `useBootLoading(true)`(AppRoot·ChildGate·CourseHome·ChildWaitScreen·ChildHome). 로딩 중인 화면이 150ms 동안 없으면 대기 종료.
  - 대기 중에는 AppRoot 가 종이색 SplashHold 를 덮고 뒤 화면은 화면 읽기에서 숨긴다. 2초가 넘으면 심볼 아래에만 "잠시만요". 오프라인 화면은 대기가 아니다.
- 테스트: jest.after.js 가 매 테스트 전 시작 대기·심볼 이동을 끝낸 상태로 만든다(화면 단위 테스트용). splash.test 는 resetSplash 로 처음부터 검사.
- [first-screen] 릴리스 로그 제거(리드 지시).
### 0018 가입 번호 무효화와 앱 번호 흐름(11-17)
- 0018: 새 가입 번호 발급 시 같은 가족의 이전 미사용 가입 번호 만료, 가입 성공 시 나머지 미사용 가입 번호 만료(행은 남겨 'expired' 안내, 하루 뒤 발급 때 정리).
- 재연결 번호(target_profile_id 지정) 제외 근거(리드 동의): 이미 있는 어르신 프로필에만 붙어 새 '부모'를 만들지 못하고, 24시간·대상당 1개·재연결 성공 시 같은 대상 번호 만료 규칙이 이미 있다.
- 앱: 호칭 화면은 살아 있는 번호가 있으면 다시 쓴다(호칭은 set_parent_title 로 갱신 — 서버 경로 있음). 대기 화면은 번호가 살아 있으면 "번호 다시 보기", 없을 때만 "새 번호 받기"; 지난 번호가 있었으면(ChildState.hadExpired) "보낸 번호의 기간이 끝났어요", 새로 받은 번호 화면에 "전에 보낸 번호는 이제 쓸 수 없어요".
- 문구 4개(connect_wait.new_code·get_code("번호 받기", 받은 적 없는 가족)·expired, code.old_invalid)는 임시, 라이터 확인 필요.
- pgTAP rpc_code_revoke: plan 11→12 수정(단언이 12개였음, 테스트 쪽 실수).
### 브랜드 심볼 D안 반영(11-17)
- 런처: design-system/assets/brand/android/res 의 적응형 PNG 레이어(전경·배경·단색) + 레거시 5밀도를 그대로 복사(테스트가 원본과 바이트 비교). 벡터 ic_launcher_foreground.xml·splash_symbol.xml·symbol-sun-polaroid.svg 삭제.
- 스플래시: windowSplashScreenAnimatedIcon=@drawable/splash_icon(3D 상세판 PNG 5밀도). 바탕은 종이색 고정 유지(브랜드 시트의 다크 #2A211B 는 쓰지 않음 — 기존 결정).
- 앱 안: brandSymbol.tsx = symbol-flat.svg(BRAND_SYMBOL_XML, 원본과 같은지 테스트). JS 대기 128 → 워드마크 옆 40 이동 그대로.
- 스테이징 변형(android/staging)은 복사·연결하지 않음(09 환경 분리 때 flavor 에 연결).
- 확인 필요: 네이티브 스플래시(3D)에서 JS 대기 화면(평면판)으로 넘어갈 때 그림이 바뀌어 보이는지(실기기). 두 판의 크기·위치 정합도 미확인.
### 앱 안 심볼도 D안 3D로(사용자 피드백 "D안이랑 좀 달라졌지", 11-17)
- 평면판(symbol-flat) 앱에서 제거. BrandSymbol = symbol-3d.svg 렌더 PNG: 164(시작 대기·이동), 40(워드마크 옆). 40dp @2x·@3x 에서 상세판이 또렷해 단순판 미사용(비교 렌더로 확인).
- 대기 심볼 128 → 164, 2dp 위: 디자이너 생성기의 스플래시 배치 place("3d", 62, 60, 164)와 같게(네이티브 → JS 전환 때 크기·자리 같음). 테스트가 gen.mjs 값을 확인.
- 렌더: design-system/assets/brand/_src/render.sh app (전체 렌더에도 포함).
- 용량: 릴리스 유니버설 APK +238,085 바이트(약 0.23MB). AAB 밀도 분할이면 기기당 더 작음.
- 미확인: 실기기에서 OEM 이 스플래시 아이콘을 다른 크기로 그리는지(그러면 전환 때 크기가 튐), Android 11 이하 compat 크기.
### QA 실기기 스모크 수정·접근성 3건(11-17)
- B2: 코스 홈 배너 "번호 쓰기" = push('Connect', {from:'course'}), 번호 화면 '이전'은 goBack(코스 홈). 설정의 "번호 쓰기"도 같음.
- B3: 설정 입구를 미연결에도 표시. 미연결 설정은 "가족에게 답 보여 주기 / 번호를 받으면 그때부터 답이 저장돼요 / 번호 쓰기"만(보여 주기·지우기 숨김).
- B6: Screen 위 여백 = max(52, 상태바 + 12)(§15 TopSafe 52 이상).
- B4: Screen 본문이 넘치면 아래 28 페이드(끝까지 내리면 사라짐), 사진 단계 사진 높이 ≤ 화면 28%.
- 단계 표시: StepHeader("사진 보기 1 / 3", 화면 읽기 "사진 보기, 3단계 중 1단계") — PhotoStep·QuestionStep만. HangulStep 은 P6 줄 담당이라 손대지 않음(합칠 때 `<StepHeader name={copy.course.step.hangul} n={3} />` 를 top 에 추가하면 됨).
- P3 주 버튼 = 지금 단계 이름(copy 10절). P1 하단 = 이유 줄(6자리 전, 화면 읽기 제외) → 다음 → 번호가 없어요·코스 보기.
- a11y: StampRow "이번 주 도장, 월 화 목 찍었어요"(없으면 "이번 주 도장"), SelectCard role radio + checked(질문 단계 묶음 radiogroup, 호칭 화면 묶음은 자녀 화면이라 미적용), Screen 진입 300ms 뒤 첫 머리글(위 고정 → 본문 순)에 sendAccessibilityEvent focus.
- 문구 임시(라이터 확인): course.stamps_a11y·stamps_a11y_none·step_a11y.
- 미반영: P1 빈 칸 "여기" 표시(키패드 높이 계산 변경 필요), 360x780에서 부제 "틀려도 괜찮아요"는 공간 부족 단계 규칙으로 숨김(설계대로), P3 제목 "오늘 코스예요"(기존 결정·테스트가 "오늘의 코스"), P5 제목 문구, 단계명 "자판으로 쓰기"(P6 줄).
### QA 수정 리뷰 반영(f7e7428 리뷰, 11-17)
- 제목 포커스: 머리글 등록은 useScreenTitleRef 한 경로(Text20 머리글·StepHeader). 등록은 마운트 동안만(ref 정리 함수로 해제), Screen 은 위 고정 영역 → 본문 순서로 지금 마운트된 첫 머리글을 고른다. 화면 읽기가 켜졌을 때만 300ms 타이머. 마운트 때 한 번만(goBack 으로 돌아온 화면 재포커스는 결정 필요 — 리뷰 ④).
- 스택 정리: 번호 성공 → reset [번호, 동의], 동의 → replace 코스 홈, 코스 홈·설정에서 온 번호 화면의 "코스 보기" → popTo 코스 홈. 하드웨어 뒤로 테스트(navStack.test).
- Screen 스크롤: 측정값은 ref, 페이드 boolean 이 바뀔 때만 다시 그림.
- 호칭 화면 선택 카드 묶음 radiogroup.
- **실기기 확인 항목**: 위 여백 max(52, 상태바+12)로 상태바 24 기기에서 모든 화면 +28px → 360x780 에서 번호 화면 키패드 맞춤 단계(level)와 사진 화면 질문 노출을 확인.
- 남김: Text20 ref 합성(rest 의 ref 가 덮을 수 있음, 지금 사용처 없음), 안 쓰는 course.continue 문구 키 정리(라이터 문구 원본과 함께).
