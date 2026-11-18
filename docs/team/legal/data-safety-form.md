# Play 데이터 보안 양식 초안 + 실제 수집 대조표 (LG-05, L6, 2026-11-18)

> **법률 자문 아님.** Play 양식 분류는 Google 안내(https://support.google.com/googleplay/android-developer/answer/10787469) 기준 실무 판단이며, 콘솔 칸 이름은 입력 때 다시 확인.
> 기준: **main `f876ed6`**(서버 마이그레이션 0001~0043, Edge Function push-daily·push-events·kakao-unlink, 앱 이벤트 계약 `app/src/api/contract/events.ts`). 이전 초안: `docs/team/store/play-console-draft.md` §4·§5(v2.1, 11-17) — 이 문서가 §4·§5를 대체한다(store 문서 반영은 입력 직전 1회).
> 11-19 추가: 서버 브랜치 `server-l1-launch`의 0046~0048(약관·방침 확인 기록, display_name 제거, 감사 사유 개인정보 거부, 카카오 큐 처리)을 반영했다. **main 미병합 → 병합 전까지 해당 칸은 예정**.
> 표기: **사실** = main 코드로 확인 · **예정** = 브랜치·계획만(main에 없음) · **추정** = 판단.
> **제출 조건**: 아래 §4 "실측 필요" 3건을 출시 AAB로 확인한 뒤에만 콘솔에 입력(release-gates C-06).

## 1. 실제 수집 대조표 (서버·앱 → Play 분류)

| # | 데이터 | 어디서(사실 근거) | 서버로 감? | 보관·삭제(사실) | Play 범주 > 유형 | 필수/선택 | 목적 |
|---|---|---|---|---|---|---|---|
| 1 | 익명 로그인 ID(부모님) | Supabase Auth 익명, profiles(이름 열 없음 — `display_name` 제거, 0047 예정) | 예 | 계정 삭제 시 즉시(0017·0026·0039 account_delete_core) | 개인 정보 > 사용자 ID | 필수 | 앱 기능, 계정 관리 |
| 2 | 카카오 회원번호 | auth.identities(provider_id) | 예 | 삭제 시 인증 계정 즉시 삭제. **단 카카오 연결 끊기용으로 `kakao_unlink_queue`에 회원번호를 옮겨 성공 즉시 삭제, 실패 재시도 최대 10회 → 포기 행은 30일 뒤 파기**(0042). 포기 행은 운영자가 재시도(`admin_kakao_unlink_retry`) 또는 콘솔 수동 해제 후 삭제(`admin_kakao_unlink_resolve`), 큐 회원번호는 서비스 역할도 못 읽음(0047 예정) | 개인 정보 > 사용자 ID | 필수(카카오 로그인 시) | 계정 관리 |
| 3 | 카카오 닉네임 | 카카오 동의항목(선택). Supabase Auth 로그인 정보에만 남고 앱 표에 복사하지 않음(`profiles.display_name` 쓰는 곳 0 → 0047 제거 예정) | 예 | 계정 삭제 시 즉시 | 개인 정보 > 이름 | 선택 | 계정 관리 |
| 4 | 구글 고유 번호·이메일·이름·프로필 사진 주소 | Supabase Auth Google | 예 | 계정 삭제 시 즉시 | 사용자 ID / 이메일 주소 / 이름 | 선택(구글 로그인 시) | 계정 관리 |
| 5 | 이메일(인증번호 로그인) | Supabase Auth OTP | 예(+메일 발송 업체) | 계정 삭제 시 즉시 | 개인 정보 > 이메일 주소 | 선택 | 계정 관리 |
| 6 | 호칭(정해진 목록) | profiles / families | 예 | 가족 삭제 시 | 수집 신고 대상 아님(추정: 정해진 선택값, 이름 아님) | — | — |
| 7 | 고른 답(A/B)·날짜 | answers(동의 시만, 0012) | 예 | 31일째 파기(0023), 철회 즉시, 삭제 즉시 | 앱 활동 > 기타 작업 | 선택 | 앱 기능 |
| 8 | 동의 여부·버전·시각, 알림 받기 시각, 약관·방침 확인 기록(버전·시각·그때 역할) | parents·consent_events(0019), profiles.push_consented_at(0036·0037), terms_agreements(0046·0048 예정: 같은 버전 쌍 1줄, 게시된 버전만) | 예 | 계정 삭제 시 cascade(terms_agreements는 auth.users cascade). 시간 기준 파기 없음 | 앱 활동 > 기타 작업(추정: 별도 유형 없음, 7과 함께) | 필수 | 앱 기능 |
| 9 | 코스 기록(날짜·단계·시간·받은 콘텐츠 id) | daily_sessions(0028) | 예 | 31일째 파기 | 앱 활동 > 앱 상호작용 | 필수 | 앱 기능 |
| 10 | 응원(정해진 문구 키) | cheers(0020) | 예 | 31일 파기 | 메시지 > 기타 인앱 메시지 | 선택 | 앱 기능 |
| 11 | 초대 번호·입력 시도 | invite_codes·redeem_attempts | 예 | 30일 파기 | 수집 신고 대상 아님(추정: 앱이 만든 1회용 번호, 사용자 데이터 아님) | — | — |
| 12 | 이용 기록(이벤트 24종) | events(0022·0029·0034), 이름·속성 화이트리스트, `device_key` = 로그인 ID의 SHA-256(방침 표기 "가명값", 보안 회의 D3) | 예 | 14개월, 계정·가족 삭제 시 cascade, 답만 삭제 시 코스 이벤트도 삭제(0043) | 앱 활동 > 앱 상호작용 | 필수 | 분석, 앱 기능 |
| 13 | 푸시 토큰(FCM) | device_tokens(0001·0032·0036): 사용자당 5개, 270일 미갱신 삭제, 로그아웃 시 `unregister_push_token` | 예 | 삭제 시 즉시, 무효 토큰 즉시 | 기기 또는 기타 ID | 필수(추정, §4-2) | 앱 기능 |
| 14 | 알림 발송 기록 | push_log(종류·날짜·profile·결과, **토큰 없음**) 31일, push_runs(숫자만) 13개월, push_claims 31일 | 예(서버 내부) | profile 삭제 시 cascade | 별도 신고 불필요(추정: 12·13의 서버 처리 기록) | — | — |
| 15 | Firebase 설치 ID | Firebase SDK | 예정(AU-02, main 앱에 Firebase 없음 — `app/package.json` 사실) | Google 기준 | 기기 또는 기타 ID | 필수 | 앱 기능, 분석 |
| 16 | 비정상 종료 로그·진단(기기 모델·OS·앱 버전) | Crashlytics | 예정(AU-05) | Google 90일 | 앱 정보 및 성능 > 비정상 종료 로그 / 진단 | 필수 | 분석 |
| 17 | 서버 접속 기록(IP 등) | Supabase 플랫폼 | 예 | Pro 7일(supabase.com/pricing, 11-19) | 신고 안 함(IP 유형 없음, 위치 추정에 안 씀 — 기존 판단 유지) | — | — |
| 18 | 관리자 감사 기록 | admin_audit(0039·0043·0045·0047·0048): 처리자·작업 종류·사유·**대상 profile·family uuid** 또는 detail(카카오 큐 번호, 약관 종류·버전). 사유·처리자에 `@`·9자리 이상 숫자 거부(0047 예정) | 예(서버 내부) | **삭제 뒤에도 1년 보관**(FK 없음, purge 0043) | 신고 판단 필요(추정: 가명 ID만이면 "삭제 후 보관" 설명에 포함) | — | 보안·법적 의무(추정) |
| 19 | 초대 번호(링크·Install Referrer로 받은 것) | 기기 `invite_store`(MODE_PRIVATE, allowBackup=false) | **아니오**(연결할 때 번호만 = 11) | 최대 7일·사용 즉시 삭제 | Play "수집" 아님(기기 밖으로 안 나감) | — | — |
| 20 | 미연결 도장 날짜, 로그인 상태 | 기기 저장 | 아니오 | 7일·로그아웃 | Play "수집" 아님 | — | — |
| 21 | 친 낱말(P6) | 기기 안 비교만 | 아니오(1차 grep: KeyboardStep에 api 호출 0) | — | 신고 안 함 | — | — |
| 22 | 카카오·구글 SDK가 각 사로 보내는 것 | @react-native-kakao 3.2.0, google-signin 17.0.0 | SDK → 카카오·구글 | 각 사 | **실측 필요**(§4-3) | — | — |

이벤트 24종(사실, events.ts): app_first_open, child_signup_completed, invite_code_issued, parent_code_redeemed, parent_code_failed, consent_shown, parent_consent_accepted, parent_consent_declined, course_step_completed, course_completed, child_report_viewed, invite_share_tapped, consent_revoked, account_deleted, cheer_sent, push_permission_result, link_opened, referrer_found, code_prefilled, paid_sheet_opened, paid_interest_tapped, photo_zoom_opened, child_first_answer_viewed, push_opened. 속성은 정해진 값·숫자만(번호·문장 차단, 서버 `event_prop_ok`). `install_source`도 서버가 `^[a-z][a-z0-9]{0,15}$`로 좁혀 숫자 번호가 들어갈 수 없다(사실, 0029·0034).

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
| 기기 또는 기타 ID | 예 | 아니오 | 아니오 | 필수(§4-2 결과로 확정) | 앱 기능, 분석 |
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
1. 병합 매니페스트 권한: `INTERNET`(지금 main 유일, 사실) + `POST_NOTIFICATIONS`·FCM·Crashlytics 필수분만, `AD_ID`·위치 0.
2. 알림 거부 기기에서 Firebase 설치 ID가 생기는지 → 생기면 "기기 ID 필수" 유지, 안 생기면 "선택"으로.
3. Kakao SDK·Google Sign-In이 기기 정보를 각 사로 보내는지: 각 사의 Play 데이터 보안 SDK 안내 문서 대조(문서 미확인). 보내면 위 표에 행 추가.

## 5. 리드에게 올리는 발견(결정 필요)
1. **(해소 11-18, L6)** 방침·삭제 안내 게시본에 예외 2건이 없다: 카카오 회원번호 최대 30일(0042), 관리자 감사 기록 1년(0039). `publish-drafts/privacy.html` 4절·`delete-account.html` 3절에 행 추가가 필요하다(L6가 다음 반영 — 지시 시).
2. **(해소 — 내부관리계획 §6 규칙 + 0047 서버 거부, 이름·닉네임은 규칙에만 의존)** admin_audit.reason은 자유 문자열(1~200자): 운영자가 메일 주소 등을 적으면 삭제 후 1년 남는다. 운영 규칙 "사유에 개인정보 금지(요청 번호만)"를 SV-15/PM-07 절차서와 내부관리계획 §6에 넣을 것을 제안.
