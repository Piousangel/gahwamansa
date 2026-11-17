# 서버 계약 노트 (0019~0027) · 2026-11-17
앱 개발 줄이 쓰는 RPC 시그니처·반환 형태. 모두 `supabase.rpc(name, args)`. anon(로그인 전)은 전부 실행 불가(42501).
역할 위반은 예외(`child_required`·`parent_required`), 사용자 입력 문제는 `{ok:false, reason}`로 돌려준다(앱이 문구로 바꿈).
날짜는 서버 KST(`kst_today()`) 기준, `YYYY-MM-DD` 문자열. 기존 RPC는 하위 호환(키 추가만).

## 1. 자녀
### child_summary() → jsonb  (0012 → 0019·0021 확장)
```json
{ "parent_title": "부모님",               // 가족 호칭(옛 앱 호환)
  "parents": [                             // 연결 순서(created_at)대로, 어르신마다 1개
    { "parent_id": "uuid", "title": "엄마",  // 어르신별 호칭, 없으면 가족 호칭
      "connected": true,                   // false = 연결 끊김(프로필은 있고 기기 없음) → 배너, 응원 버튼 숨김
      "shared": true,                      // 동의 여부. false면 latest=null
      "latest": { "prompt": "…", "choice_label": "가을", "starter": "가을 이야기 들려주세요", "answered_date": "2026-11-16" } } ] }
```
- `latest`는 **session_date(그 답의 날)** 기준 최신 1개. answered_date = session_date(답을 고친 시각 아님).
- 어르신이 2명 이상이면 반드시 parent_id·title로 행을 나눠 보여 준다(섞이면 오표시).
- `starter`(0027, 첫마디 한 줄): 어르신이 **고른 쪽** 선택지의 대화 시작 문장(`content_questions.starter_a/b`). 문장이 아직 없으면 null → 앱은 줄을 숨긴다. 문장은 라이터가 채우며 시드는 비어 있다.

### child_answer_history() → jsonb  (0021, C5 지난 답)
```json
{ "parents": [ { "parent_id": "uuid", "title": "엄마", "connected": true, "shared": true,
    "answers": [ { "session_date": "2026-11-16", "prompt": "…", "prompt_short": "봄과 가을 중",
                   "option_a": "봄", "option_b": "가을", "choice_label": "가을" } ] } ] }
```
- 최근 30일(오늘 포함, session_date ≥ 오늘-29), 최신순, 어르신별 최대 30개, 페이지 없음. 개수·빈 날 집계 없음.
- 동의 안 함/철회 → `shared:false, answers:[]`(철회 즉시). 같은 질문이 순환으로 두 번 나올 수 있다(날짜가 다름).
- `prompt_short` = "A와/과 B 중"(앞 낱말 받침으로 와/과 자동).

### set_parent_title_for(p_parent uuid, p_title text) → jsonb  (0019)
- 어르신 한 분의 호칭. 닫힌 목록 7개(엄마·아빠·어머니·아버지·할머니·할아버지·부모님).
- `{ok:true}` | `{ok:false, reason:'invalid_title'|'invalid_target'}`(다른 가족·어르신 아님). 기존 `set_parent_title(p_title)`(가족 기본값)은 그대로.

### send_cheer(p_parent uuid, p_key text) → jsonb  (0020)
- 키 4개만: `love_you`·`warm_day`·`thanks_always`·`peaceful_day`(copy-v3-confirmed 6절 확정 4개).
- `{ok:true, cheer_id}` | `{ok:false, reason:'invalid_key'|'invalid_target'|'disconnected'|'daily_limit'}`.
- 하루 한도(가정): 같은 자녀→같은 어르신 KST 하루 **2개**. 정책 확정 시 상수만 변경.
- 테이블 직접 insert는 막혔다(0020). 자녀는 읽음 여부(read_at)를 볼 수 없다.
- **키 값은 서버가 기준**(ARCHITECTURE.md): 앱 copy의 cheers 키를 이 4개로 맞춘다(옛 키 take_your_time·curious_answer·want_story·stay_healthy·will_call은 서버가 거부).
```ts
type CheerKey = 'love_you' | 'warm_day' | 'thanks_always' | 'peaceful_day';
// 호출: sb.rpc('send_cheer', { p_parent: string /* parent_id */, p_key: CheerKey })
type SendCheerResult =
  | { ok: true; cheer_id: string }
  | { ok: false; reason: 'invalid_key' | 'invalid_target' | 'disconnected' | 'daily_limit' };
// 호출: sb.rpc('get_my_cheers')  (인자 없음)
type MyCheers = { unread_count: number; cheers: { id: string; message_key: CheerKey; sent_at: string }[] };
// 호출: sb.rpc('mark_cheers_read', { p_ids?: string[] | null }) → number
```

## 2. 어르신
### start_today() → jsonb | null  (0024, 코스 홈 진입 시 호출)
- 반환 = `get_today_content()`와 같은 객체 + `advanced`(오늘 처음 열어 커서가 전진했으면 true). 콘텐츠가 없으면 null.
- KST 날짜가 바뀐 첫 호출에만 1칸 전진, 같은 날 여러 번 불러도 1회. 며칠 쉬어도 1칸(놓친 장 없이). 처음 연결이면 첫 콘텐츠부터.
- `get_today_content()`는 읽기 전용 그대로(호출 순서 무관, 오늘 열 콘텐츠를 미리 보여 줌). `record_session_step`도 같은 전진을 해서 start_today를 빠뜨려도 반복되지 않는다.
- 미연결 열람 `preview_content()`는 날짜 기반 그대로(은퇴 콘텐츠만 제외).

### get_my_cheers() → jsonb  (0020, P8)
```json
{ "unread_count": 2, "cheers": [ { "id": "uuid", "message_key": "warm_day", "sent_at": "timestamptz" } ] }
```
- 안 읽은 것만, 최신순 최대 20개. 보낸 자녀는 밝히지 않음("가족이 보낸 응원이에요").
### mark_cheers_read(p_ids uuid[] default null) → int
- null이면 안 읽은 응원 전부, 아니면 그중 내 것만. 바뀐 개수.

### give_consent(p_version text default 'v1') / withdraw_consent()  (0019 변경)
- `v2` 그대로 보내면 된다(재동의 게이트 없음). 버전이 바뀌면 동의 시각 갱신 + 이력. 같은 버전 반복은 아무것도 안 함.
- 이력 `consent_events(action given|withdrawn, version, at)`은 앱이 읽지 못한다(증빙, 서비스 역할만). 계정 지우기 때 함께 지워짐.

## 3. 공통
### log_event(p_name text, p_props jsonb default '{}') → jsonb  (0022)
- 이름(이 목록만): `app_first_open, child_signup_completed, invite_code_issued, parent_code_redeemed, parent_code_failed, consent_shown, parent_consent_accepted, parent_consent_declined, course_step_completed, course_completed, child_report_viewed, invite_share_tapped, consent_revoked, account_deleted, cheer_sent, push_permission_result`.
- 속성 키(최대 8개, 이 목록만): `role_guess, app_version, install_source, login_method, purpose, ttl_hours, reason, attempt_no, consent_version, step, day_index, duration_sec, tts_used, is_first, days_since_connect, channel, result, message_key`.
- 값: 숫자·참거짓·영문 소문자 토큰 `^[a-z0-9][a-z0-9_.-]{0,31}$`만. 한글·띄어쓰기·중첩 불가. 예: `app_version:"1.0.0"`, 빌드 번호는 `"1.0.0-12"`.
- `{ok:true}` | `{ok:false, reason:'invalid_name'|'invalid_props'}`(예외 아님 → 계측 실패가 화면을 막지 않음). 가족·역할은 서버가 채움. 프로필 없는 기기(설치 직후 익명 로그인)도 기록 가능.
- 미정: C6 "소식 받기" 관심 이벤트 이름(그로스 결정 후 목록 추가), 서버 RPC 안 자동 기록, 14개월 파기.

## 4. 운영·서버 전용 (앱 호출 불가)
- `purge_expired_data(p_now default now())`(0023): 답·코스 기록 session_date < 오늘-30, 응원 31일, 초대 번호 사용·만료 후 30일, 입력 시도 30일. pg_cron `purge-expired-data` 매일 00:10 KST. 원격 반영 시 pg_cron 확장 켜짐 확인.
- `admin_create_review_family(uuid[])`(0025): 심사 가족(is_review)+만료 없는 재사용 번호. `node supabase/ops/create-review-access.mjs <자녀1> <자녀2>` — 번호는 출력만, Play 콘솔에만 적는다.
- `delete_my_account()`(0026): 마지막 자녀면 가족 어르신의 **익명 인증 계정도 삭제** → 어르신 기기는 다음 실행 때 세션이 무효(앱은 새 익명 로그인 후 첫 화면/미연결 열람으로).

## 5. 설계 선택과 근거
### 0024 콘텐츠 커서 (백오피스 리뷰 높음 1·3, 리드 결정)
- 문제: `mod(오늘-시작일, n)+1`은 콘텐츠 수 n이 바뀌면 한 바퀴 이상 돈 어르신의 '오늘'이 밀린다. 날짜 차이 기반 공식은 어떤 변형도 같은 문제.
- 선택: 어르신별 커서 `profiles.content_seq`(지금 day_index)·`content_seq_date`(연 날짜). 다음 = 커서보다 큰 활성 day_index 중 최소, 없으면 처음으로. 활성 = 사진·질문 모두 있고 `retired_at` 없음.
- 버린 안: 콘텐츠 seq + 진행일→seq 고정 매핑(진행일이 날짜 차이라 쉰 날도 넘어감 → "놓친 장 없이"와 충돌), get_today_content 안에서 전진(stable 함수에서 쓰기 불가).
- 이행: 기존 어르신은 이전 공식의 오늘 값으로 커서 고정(반영 순간 '오늘' 불변). day_index 30 상한 제거.
- 운영 규칙: 새 콘텐츠는 **끝에만** 추가(앞에 끼우면 이미 지나간 어르신은 다음 바퀴에 본다). 게시된 문항·사진 문구·day_index는 트리거로 수정 금지(`content_immutable`), 고칠 땐 새 행 + 옛 행 `retired_at`(되돌리기 불가). `image_url`은 저장 위치라 변경 허용. 시드는 `on conflict do nothing`으로 바꿈.
- 충돌 확인: streak(0005)·my_week_stamps(0016)는 daily_sessions만 봄. 31일 파기(0023)는 커서와 무관(답 존재로 '본 날'을 판정하지 않음). 0019 어르신별 구분과 같은 프로필 단위. `daily_sessions.day_index`에 그날 연 번호 기록.
### 기타
- 연결 끊김 = 어르신 프로필의 user_id가 null(기기 삭제·재설치 후 재연결 전).
- 0018 무효화 예외: 재사용 번호(reusable)는 새 번호 발급·연결 성공 때 만료되지 않고 사용 처리도 안 된다(심사 가족 전용, 트리거로 강제).
- 하루 응원 한도 2·이벤트 값 규칙·심사 번호 위험 수용은 가정 — 정책 검토 대상.
