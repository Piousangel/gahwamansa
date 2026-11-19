# Play 데이터 보안 양식 초안 + 실제 수집 대조표 (LG-05, L6, 2026-11-18)

> **법률 자문 아님.** Play 양식 분류는 Google 안내(https://support.google.com/googleplay/android-developer/answer/10787469) 기준 실무 판단이며, 콘솔 칸 이름은 입력 때 다시 확인.
> 기준: **main**(서버 마이그레이션 0001~0045, 11-19 확인 — 처음 대조는 `f876ed6` 0001~0043, Edge Function push-daily·push-events·kakao-unlink, 앱 이벤트 계약 `app/src/api/contract/events.ts`). 이전 초안: `docs/team/store/play-console-draft.md` §4·§5(v2.1, 11-17) — 이 문서가 §4·§5를 대체한다(store 문서 반영은 입력 직전 1회).
> 11-19 추가: 서버 브랜치 `server-l1-launch`의 0046~0048(약관·방침 확인 기록, display_name 제거, 감사 사유 개인정보 거부, 카카오 큐 처리)을 반영했다. **main 미병합 → 병합 전까지 해당 칸은 예정**.
> 표기: **사실** = main 코드로 확인 · **예정** = 브랜치·계획만(main에 없음) · **추정** = 판단.
> **제출 조건**: 아래 §4 "실측 필요" 3건을 출시 AAB로 확인한 뒤에만 콘솔에 입력(release-gates C-06).

## 1. 실제 수집 대조표 (서버·앱 → Play 분류)

| # | 데이터 | 어디서(사실 근거) | 서버로 감? | 보관·삭제(사실) | Play 범주 > 유형 | 필수/선택 | 목적 |
|---|---|---|---|---|---|---|---|
| 1 | 익명 로그인 ID(부모님) | Supabase Auth 익명, profiles(이름 열 없음 — `display_name` 제거, 0047 예정) | 예 | 계정 삭제 시 즉시(0017·0026·0039 account_delete_core) | 개인 정보 > 사용자 ID | 필수 | 앱 기능, 계정 관리 |
| 2 | 카카오 회원번호 | auth.identities(provider_id) | 예 | 삭제 시 인증 계정 즉시 삭제. **단 카카오 연결 끊기용으로 `kakao_unlink_queue`에 회원번호를 옮겨 성공 즉시 삭제, 실패 재시도 최대 10회 → 포기 행은 30일 뒤 파기**(0042). 포기 행은 운영자가 재시도(`admin_kakao_unlink_retry`) 또는 콘솔 수동 해제 후 삭제(`admin_kakao_unlink_resolve`), 서비스 역할도 큐 표를 직접 읽지 못하고 해제 함수 `kakao_unlink_claim`으로만 회원번호를 받음(0047 예정) | 개인 정보 > 사용자 ID | 필수(카카오 로그인 시) | 계정 관리 |
| 3 | 카카오 닉네임 | 카카오 동의항목(선택). Supabase Auth 로그인 정보에만 남고 앱 표에 복사하지 않음(`profiles.display_name` 쓰는 곳 0 → 0047 제거 예정) | 예 | 계정 삭제 시 즉시 | 개인 정보 > 이름 | 선택 | 계정 관리 |
| 4 | 구글 고유 번호·이메일·이름·프로필 사진 주소 | Supabase Auth Google | 예 | 계정 삭제 시 즉시 | 사용자 ID / 이메일 주소 / 이름 | 선택(구글 로그인 시) | 계정 관리 |
| 5 | 이메일(인증번호 로그인) | Supabase Auth OTP | 예(+메일 발송 업체) | 계정 삭제 시 즉시 | 개인 정보 > 이메일 주소 | 선택 | 계정 관리 |
| 6 | 호칭(정해진 목록) | profiles / families | 예 | 가족 삭제 시 | 수집 신고 대상 아님(추정: 정해진 선택값, 이름 아님) | — | — |
| 7 | 고른 답(A/B)·날짜 | answers(동의 시만, 0012) | 예 | 31일째 파기(0023), 철회 즉시, 삭제 즉시 | 앱 활동 > 기타 작업 | 선택 | 앱 기능 |
| 8 | 동의 여부·버전·시각, 알림 받기 시각, 약관·방침 확인 기록(버전·시각·그때 역할) | parents·consent_events(0019), profiles.push_consented_at(0036·0037), terms_agreements(0046·0048 예정: 같은 버전 쌍 1줄, 게시된 버전만) | 예 | 계정 삭제 시 cascade(terms_agreements는 auth.users cascade). 시간 기준 파기 없음. **가족 연결 전 계정(role none)은 지금 삭제 경로 없음**(no_profile — 서버 요청 중, CHANGES P20) | 앱 활동 > 기타 작업(추정: 별도 유형 없음, 7과 함께) | 필수 | 앱 기능 |
| 9 | 코스 기록(날짜·단계·시간·받은 콘텐츠 id) | daily_sessions(0028) | 예 | 31일째 파기 | 앱 활동 > 앱 상호작용 | 필수 | 앱 기능 |
| 10 | 응원(정해진 문구 키) | cheers(0020) | 예 | 31일 파기 | 메시지 > 기타 인앱 메시지 | 선택 | 앱 기능 |
| 11 | 초대 번호·입력 시도 | invite_codes·redeem_attempts | 예 | 30일 파기 | 수집 신고 대상 아님(추정: 앱이 만든 1회용 번호, 사용자 데이터 아님) | — | — |
| 12 | 이용 기록(이벤트 25종) | events(0022·0029·0034·0053), 이름·속성 화이트리스트, `device_key` = 로그인 ID의 SHA-256(방침 표기 "가명값", 보안 회의 D3) | 예 | 14개월, 계정·가족 삭제 시 cascade, 답만 삭제 시 코스 이벤트도 삭제(0043) | 앱 활동 > 앱 상호작용 | 필수 | 분석, 앱 기능 |
| 13 | 푸시 토큰(FCM) | device_tokens(0001·0032·0036): 사용자당 5개, 270일 미갱신 삭제, 로그아웃 시 `unregister_push_token` | 예 | 삭제 시 즉시, 무효 토큰 즉시 | 기기 또는 기타 ID | 선택(알림 허용 때만, §4-2) | 앱 기능 |
| 14 | 알림 발송 기록 | push_log(종류·날짜·profile·결과, **토큰 없음**) 31일, push_runs(숫자만) 13개월, push_claims 31일 | 예(서버 내부) | profile 삭제 시 cascade | 별도 신고 불필요(추정: 12·13의 서버 처리 기록) | — | — |
| 15 | Firebase 설치 ID | `@react-native-firebase/app`·`messaging` 27.1.0(PR #19, main 포함 — 사실). `app/firebase.json`: 자동 초기화(`messaging_auto_init_enabled`)·설치 ID(`messaging_installation_id_enabled`)·데이터 수집 기본값(`app_data_collection_default_enabled`) 모두 false(사실, 병합 매니페스트로 확인 — reviews/2026-11-19-pr19-review) | 알림 허용 뒤에만 예. 앱은 알림 발송 연결(FCM)이 켜진 빌드에서 사용자가 알림을 허용한 뒤에만 Firebase 설치 ID를 만들고 FCM 토큰을 등록합니다. 알림을 거부하거나 허용하지 않은 기기, 그리고 현재 빌드(발송 연결 꺼짐)에서는 Firebase 설치 ID·토큰이 생성·전송되지 않습니다(2026-11-19 에뮬레이터 관찰). 근거: SDK 로그(FirebaseInstallations·FirebaseMessaging VERBOSE 0줄)와 앱 파일(`no_backup/PersistedInstallation.*.json` 없음), `dev-app-notes.md` "Firebase 리뷰 M2" 표 A·A2·B3·C. **한계: 네트워크 패킷은 잡지 못했다**(에뮬레이터 프록시 미사용). 앱 시작 때 FirebaseApp 로컬 초기화와 기기 안 파일(하트비트 기록 등)은 생긴다. | Google 기준 | 기기 또는 기타 ID | 선택(알림 허용 때만, §4-2) | 앱 기능, 분석(Crashlytics 병합 뒤) |
| 16 | 비정상 종료 로그·진단(기기 모델·OS·앱 버전) | Crashlytics(앱에 아직 없음 — PR #19 구성 요소는 app·Messaging·Installations·Common·Datatransport뿐, 사실) | 예정(AU-05) | Google 90일 | 앱 정보 및 성능 > 비정상 종료 로그 / 진단 | 필수 | 분석 |
| 15-1 | Firebase 알림 전달 지표(datatransport/Firelog) | PR #19로 함께 들어온 Google 전송 라이브러리(`TransportRegistrar`·`CctBackendFactory`, 사실). 전달 지표 내보내기 `messaging_android_notification_delivery_metrics_export_enabled`=false(병합 매니페스트 `delivery_metrics_exported_to_big_query_enabled=false`, 사실) | **아니오(현재 전송 0)** — 내보내기가 꺼져 보낼 대상이 없음(정적 근거. 11-19 에뮬레이터 관찰에서 Messaging 로그 0줄 — Firelog 전송만 따로 본 것은 아니고 패킷도 못 잡음) | — | 신고 안 함(켜지 않는 동안) | — | — |
| 17 | 서버 접속 기록(IP 등) | Supabase 플랫폼 | 예 | Pro 7일(supabase.com/pricing, 11-19) | 신고 안 함(IP 유형 없음, 위치 추정에 안 씀 — 기존 판단 유지) | — | — |
| 18 | 관리자 감사 기록(방침 표기: 운영자 작업 기록) | admin_audit(0039 이후 모든 admin_* RPC — 0039·0040·0043~0048): 처리자·작업 종류·사유·**대상 profile·family uuid** 또는 detail(카카오 큐 번호, 약관 종류·버전). 서버는 사유·처리자에 `@`·연속 9자리 이상 숫자만 거부(0047 예정), 그 밖의 개인정보는 운영 규칙 | 예(서버 내부) | **삭제 뒤에도 1년 보관**(FK 없음, purge 0043) | 신고 판단 필요(추정: 가명 ID만이면 "삭제 후 보관" 설명에 포함) | — | 보안·법적 의무(추정) |
| 19 | 초대 번호(링크·Install Referrer로 받은 것) | 기기 `invite_store`(MODE_PRIVATE, allowBackup=false) | **아니오**(연결할 때 번호만 = 11) | 최대 7일·사용 즉시 삭제 | Play "수집" 아님(기기 밖으로 안 나감) | — | — |
| 20 | 미연결 도장 날짜, 로그인 상태 | 기기 저장 | 아니오 | 7일·로그아웃 | Play "수집" 아님 | — | — |
| 21 | 친 낱말(P6) | 기기 안 비교만 | 아니오(1차 grep: KeyboardStep에 api 호출 0). 서버로 가는 것은 #12의 단계 완료 이벤트(마침/넘어감)뿐, 글자·정오는 안 감(0053) | — | 신고 안 함 | — | — |
| 22 | 카카오·구글 SDK가 각 사로 보내는 것 | @react-native-kakao 3.2.0, google-signin 17.0.0 | SDK → 카카오·구글 | 각 사 | **실측 필요**(§4-3) | — | — |

이벤트 25종(사실, `app/src/api/contract/events.ts` — PR #61 병합 기준): app_first_open, child_signup_completed, invite_code_issued, parent_code_redeemed, parent_code_failed, consent_shown, parent_consent_accepted, parent_consent_declined, course_step_completed, course_completed, child_report_viewed, invite_share_tapped, consent_revoked, account_deleted, cheer_sent, push_permission_result, link_opened, referrer_found, code_prefilled, paid_sheet_opened, paid_interest_tapped, photo_zoom_opened, child_first_answer_viewed, push_opened, **course_step_started**(0053, 단계 시작 — `step`·`day_index`만, 단계별 이탈 = 시작 − 완료). 속성은 정해진 값·숫자만(번호·문장 차단, 서버 `event_prop_ok`). `install_source`도 서버가 `^[a-z][a-z0-9]{0,15}$`로 좁혀 숫자 번호가 들어갈 수 없다(사실, 0029·0034). P6 낱말 쓰기 완료(`course_step_completed` step=hangul)의 `result`는 **finished·skipped 두 값만** 보내고, 맞았는지·글자는 싣지 않는다(사실: 0053 `event_prop_ok`·KeyboardStep 주석, 사람별 정오 기록 금지 AC-05).

## 2. 콘솔 입력 초안

### 2.1 공통 질문
| 질문 | 답 | 근거 |
|---|---|---|
| 필수 사용자 데이터 유형을 수집·공유하나요? | 수집 예 / **공유 아니오** | Supabase·Google Firebase·메일 업체는 서비스 제공자(Play 정의상 공유 아님) |
| 전송 중 암호화 | 예 | HTTPS(사실) |
| 사용자가 삭제를 요청할 수 있나요 | 예 | 앱 안 삭제 + 삭제 안내 URL |
| 계정 생성 | OAuth(카카오·구글) + 기타(익명, 이메일 인증번호) | |
| 계정 삭제 URL | `{도메인}/delete-account.html` | US-03 |
| 데이터만 삭제(계정 유지) | 있음: 부모님 "그만 보여 주기"(답 삭제), 관리자 웹 요청 "답만" | 0012·0039 |
| 독립 보안 검토 | 아니오 | |

### 2.2 데이터 유형 (위 표에서 "신고"인 것만)
| 범주 > 유형 | 수집 | 공유 | 일시적 처리 | 필수/선택 | 목적 |
|---|---|---|---|---|---|
| 개인 정보 > 이름 | 예 | 아니오 | 아니오 | 선택 | 계정 관리 |
| 개인 정보 > 이메일 주소 | 예 | 아니오 | 아니오 | 선택 | 계정 관리 |
| 개인 정보 > 사용자 ID | 예 | 아니오 | 아니오 | 필수 | 앱 기능, 계정 관리 |
| 앱 활동 > 앱 상호작용 | 예 | 아니오 | 아니오 | 필수 | 앱 기능, 분석 |
| 앱 활동 > 기타 작업 | 예 | 아니오 | 아니오 | 선택 | 앱 기능 |
| 메시지 > 기타 인앱 메시지 | 예 | 아니오 | 아니오 | 선택 | 앱 기능 |
| 앱 정보 및 성능 > 비정상 종료 로그 | 예(AU-05 병합 시) | 아니오 | 아니오 | 필수 | 분석 |
| 앱 정보 및 성능 > 진단 | 예(AU-05 병합 시) | 아니오 | 아니오 | 필수 | 분석 |
| 기기 또는 기타 ID | 예 | 아니오 | 아니오 | 선택(§4-2: 알림 허용 때만 생성·등록) | 앱 기능, 분석 |
| 위치·연락처·사진·동영상·오디오·파일·캘린더·금융·건강·SMS·웹 기록·설치된 앱 | 아니오 | | | | |

### 2.3 기타 선언 (store §5 유지·갱신)
| 항목 | 답 | 조건 |
|---|---|---|
| 광고 포함 | 아니오 | |
| 광고 ID | 아니오 | 병합 매니페스트 `AD_ID` 0(D-04, release-gates A10) |
| 건강 앱 | 건강 기능 없음 | |
| 대상 연령 | 18세 이상, 어린이 어필 아니오 | lawyer-packet 5 |
| 정부·금융·뉴스 | 아니오 | |
| 앱 액세스 | 심사 가족 A안(SV-15 절차서, 사용자 US-21) | |

## 3. 삭제 설명(콘솔 "데이터 삭제" 보충 문구 초안)
"계정을 지우면 서버의 계정·답·기록이 즉시 삭제됩니다. 예외: 백업은 7일 안에 사라지고, 카카오 연결 끊기를 위해 카카오 회원번호를 처리될 때까지(최대 30일) 보관하며, 운영자 작업 기록(웹으로 받은 삭제 요청 처리, 카카오 연결 끊기 재시도·수동 처리 — 무작위 식별 번호·요청 번호만)은 1년 보관합니다. 오류 기록은 Google이 90일 뒤 삭제합니다."

## 4. 실측 필요 (출시 AAB, QA-07·AU-05 이후)
1. 병합 매니페스트 권한: PR #19 뒤 stagingRelease 기준 `INTERNET`·`POST_NOTIFICATIONS`·`WAKE_LOCK`·`ACCESS_NETWORK_STATE`·`c2dm.permission.RECEIVE`·`DYNAMIC_RECEIVER_NOT_EXPORTED`·`BIND_GET_INSTALL_REFERRER_SERVICE`, **`AD_ID`·위치 0**(사실, reviews/2026-11-19-pr19-review). Crashlytics(AU-05) 병합 뒤와 출시 AAB에서 다시 확인.
2. **닫음(11-19, L4 에뮬레이터)**: 앱은 알림 발송 연결(FCM)이 켜진 빌드에서 사용자가 알림을 허용한 뒤에만 Firebase 설치 ID를 만들고 FCM 토큰을 등록합니다. 알림을 거부하거나 허용하지 않은 기기, 그리고 현재 빌드(발송 연결 꺼짐)에서는 Firebase 설치 ID·토큰이 생성·전송되지 않습니다(2026-11-19 에뮬레이터 관찰). 근거: SDK 로그(FirebaseInstallations·FirebaseMessaging VERBOSE 0줄)와 앱 파일(`no_backup/PersistedInstallation.*.json` 없음), `dev-app-notes.md` "Firebase 리뷰 M2" 표 A·A2·B3·C. **한계: 네트워크 패킷은 잡지 못했다**(에뮬레이터 프록시 미사용). 앱 시작 때 FirebaseApp 로컬 초기화와 기기 안 파일(하트비트 기록 등)은 생긴다. → #13·#15와 §2.2 "기기 또는 기타 ID"를 **선택**으로 정했다(원래 규칙: 알림 거부 기기에서 안 생기면 선택). 출시 AAB·실기기에서 같은 결과인지 한 번 더 보면 좋다(패킷 포함).
3. Kakao SDK·Google Sign-In이 기기 정보를 각 사로 보내는지: 각 사의 Play 데이터 보안 SDK 안내 문서 대조(문서 미확인). 보내면 위 표에 행 추가.

## 5. 리드에게 올리는 발견(결정 필요)
1. **(해소 11-18, L6)** 방침·삭제 안내 게시본에 예외 2건이 없다: 카카오 회원번호 최대 30일(0042), 관리자 감사 기록 1년(0039). `publish-drafts/privacy.html` 4절·`delete-account.html` 3절에 행 추가가 필요하다(L6가 다음 반영 — 지시 시).
2. **(해소 — 내부관리계획 §6 규칙 + 0047 서버 거부, 이름·닉네임은 규칙에만 의존)** admin_audit.reason은 자유 문자열(1~200자): 운영자가 메일 주소 등을 적으면 삭제 후 1년 남는다. 운영 규칙 "사유에 개인정보 금지(요청 번호만)"를 SV-15/PM-07 절차서와 내부관리계획 §6에 넣을 것을 제안.

## 6. iOS(빌드 2)
- App Store App Privacy 라벨은 이 표의 행 번호를 그대로 써서 `app-privacy-label.md`에 옮겼다(Apple 로그인·APNs 행 i1~i3 추가). 이 표(Play)는 바꾸지 않는다 — Android 앱에는 Apple 로그인이 없다(추정: B2에서 Android에도 Apple 로그인을 넣으면 #4 옆에 행 추가).
