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
