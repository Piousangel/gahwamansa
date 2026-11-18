# 서버 계약 노트 (0019~0045) · 2026-11-17
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
      "connected_date": "2026-11-12",      // 0041: 처음 연결된 날(KST). 호칭이 겹칠 때 "11월 12일에 연결한 분"처럼 구분(재연결해도 그대로)
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
- `{ok:true}` | `{ok:false, reason:'invalid_title'|'invalid_target'|'duplicate_title'}`. `duplicate_title`(0028) = 같은 가족 다른 어르신이 이미 그 호칭(어르신별 호칭, 없으면 가족 호칭)으로 보임 → 앱은 "다른 호칭을 골라 주세요"류로 안내. 자기 호칭을 다시 정하는 것은 ok.
- `set_parent_title(p_title)`(가족 기본 호칭)도 0035부터 겹치면 `duplicate_title`(호칭 없는 어르신이 있고 다른 어르신이 이미 그 호칭일 때). **폐기 예정**: 앱은 `set_parent_title_for`로 옮기고, 빌드 2 첫 서버 묶음에서 제거한다. 호칭 목록은 서버 `parent_titles()`(authenticated 실행 가능)와 같다.
- 연결(redeem) 때는 기본 호칭이 겹쳐도 막지 않는다. 그래서 child_summary에 같은 title이 둘 보일 수 있다 → 앱은 겹친 어르신에게 호칭 바꾸기를 권한다. 기존 `set_parent_title(p_title)`(가족 기본값)은 그대로.

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

### get_today_content() / start_today() — 오늘 내 답 (0028 확인·보강)
- `answered_choice`('A'|'B'|null, 오늘 KST 저장된 내 답)와 `answered_label`(그 선택지 글자, 0028 추가)을 돌려준다. 동의 전·미저장이면 둘 다 null.

### parent_history(p_days int default 30) → jsonb  (0028, 어르신 지난 날)
```json
{ "days": [ { "session_date": "2026-11-17", "day_index": 3, "completed": true,
    "photo": { "caption": "…", "image_url": "…", "keyword": "나무" },
    "question": { "prompt": "…", "option_a": "봄", "option_b": "가을" },
    "choice_label": "가을" } ] }
```
- 어르신 본인만. p_days는 1~30으로 제한(넘치면 30). 코스를 연 날만(빈 날 없음), 최신순.
- `choice_label`은 그날 저장된 답이 있을 때만, 동의 거부·철회한 날은 null(앱은 "고른 것" 줄을 빼고 보여 줌). 어르신이 친 글자는 저장하지 않아 없다. 0028 이전 행(콘텐츠 id 없음)은 나오지 않는다.
- 낱말은 `photo.keyword`(word_id = 사진 id). 서버 보관이 31일이라 30일 이상은 없다.

### peek_invite_code(p_code text) → jsonb  (0028, 연결 확인 화면 P1c)
- 어르신 기기(익명)만. 번호를 쓰지 않고 `{ok:true, parent_title}`만. 실패 `{ok:false, reason:'invalid'|'expired'|'used'|'rate_limited'(+retry_after_sec)|'busy'|'not_parent_device'}`.
- redeem과 **같은 시도 한도**(기기 10분 5회 실패, 전역 300회)를 공유한다 — peek 실패도 redeem 한도에 들어간다. 꺼진·상한 찬 심사 번호는 invalid.
- 재연결 번호면 그 어르신 호칭, 가입 번호면 가족 호칭. 성공해도 [연결하기]에서 redeem을 따로 불러야 한다(자동 연결 금지).

### parent_family_list() → jsonb  (0030, P16 연결된 가족)
```json
{ "title": "엄마", "family": [ { "seq": 1, "connected_at": "timestamptz", "connected_date": "2026-11-12" } ] }
```
- 어르신 본인만(자녀는 `parent_required`, anon 불가). 같은 가족 자녀 계정마다 순번·연결 시각·KST 날짜만 — **자녀 이름·이메일·id 없음**.
- `connected_at` = 그 자녀와 내가 같은 가족에 함께 있게 된 시각(먼저 있던 자녀는 내가 연결된 시각). 순서는 연결 시각순.
- `title` = 가족이 나를 부르는 호칭(어르신별, 없으면 가족 호칭). 연결 전 기기는 `{title:null, family:[]}`. 심사 가족도 정상 목록(심사자가 P16을 볼 수 있게, 개인정보 없음).
- 연결 끊기 RPC는 없다(P16 시트 두 갈래: `withdraw_consent` 또는 P9 `delete_my_account`).

### get_my_cheers() → jsonb  (0020, P8)
```json
{ "unread_count": 2, "cheers": [ { "id": "uuid", "message_key": "warm_day", "sent_at": "timestamptz" } ] }
```
- 안 읽은 것만, 최신순 최대 20개. 보낸 자녀는 밝히지 않음("가족이 보낸 응원이에요").
### mark_cheers_read(p_ids uuid[] default null) → int
- null이면 안 읽은 응원 전부, 아니면 그중 내 것만. 바뀐 개수.

### give_consent(p_version text) / withdraw_consent()  (0019 변경, 0035 기본값 제거)
- **0035부터 `p_version` 필수**(인자 없이 부르면 함수 없음 오류 42883, null은 `invalid_version`). 앱은 이미 버전을 보낸다.
- `v2` 그대로 보내면 된다(재동의 게이트 없음). 버전이 바뀌면 동의 시각 갱신 + 이력. 같은 버전 반복은 아무것도 안 함.
- 이력 `consent_events(action given|withdrawn, version, at)`은 앱이 읽지 못한다(증빙, 서비스 역할만). 계정 지우기 때 함께 지워짐.
- **정책 결정 필요(리뷰 L4)**: 어르신 본인 삭제·마지막 자녀의 가족 삭제 때 동의 증빙도 cascade로 지워진다. "모두 지워져요" 약속과는 맞지만 증빙 보관 목적과 충돌한다. 남길지(가명화해 일정 기간 보관) 정책·법무가 정해 DECISIONS에 기록할 것. 지금 구현은 함께 삭제. 파기 배치(0023)는 동의 이력을 건드리지 않는다.

### register_push_token(p_token text, p_platform text default 'android') / unregister_push_token(p_token text)  (0032, SV-01)
```ts
// 호출: sb.rpc('register_push_token', { p_token: fcmToken, p_platform: 'android' })
type RegisterPushToken = { ok: true } | { ok: false; reason: 'invalid_token' | 'invalid_platform' | 'no_profile' };
// 호출: sb.rpc('unregister_push_token', { p_token: fcmToken })
type UnregisterPushToken = { ok: true; removed: number };
```
- 어르신·자녀 모두(가족에 연결된 사용자). 연결 전 기기는 `no_profile` → 앱은 연결 성공 뒤 다시 등록한다.
- 언제 부르나: 알림 권한 허용 직후·앱 시작 시·FCM 토큰 갱신 시 등록(멱등). 로그아웃·알림 끄기 시 해제. 계정 지우기는 서버가 정리하므로 따로 안 불러도 된다.
- 같은 토큰을 다른 계정이 등록하면 이전 계정의 행은 지워진다(한 기기 한 역할, 오배달 방지). **연결 전 계정이 등록해도(no_profile) 이전 계정 행은 지워진다**(0036). 토큰은 표 전체에서 유일. 사용자당 최근 5개, 270일 넘게 갱신 안 된 토큰은 파기 배치가 지운다.
- 로그아웃 순서: `unregister_push_token` → 그다음 `signOut`(로그아웃 뒤에는 auth.uid가 없어 해제가 실패한다).
- `device_tokens`는 앱이 직접 쓸 수 없다(읽기는 본인 것만). 기존에 직접 insert하던 코드가 있으면 이 RPC로 바꿔야 한다.

### set_push_enabled(p_enabled boolean) / my_push_settings()  (0033, 설정 "알림")
```ts
// sb.rpc('set_push_enabled', { p_enabled: true|false }) → { ok: true; enabled: boolean } | { ok: false; reason: 'no_profile' | 'invalid' }
// sb.rpc('my_push_settings') → { enabled: boolean | null }   // = 실제로 받는 상태(켬 + 받기 시각), 연결 전 기기는 null
```
- **0036부터 N1 "알림 받기"를 누를 때 `set_push_enabled(true)`를 꼭 부른다** — 서버가 그 시각(`push_consented_at`)을 남기고, 이 시각이 있는 사람만 일일 알림 대상이다(법률 체크리스트 #10 ④, OS 권한·토큰만으로는 보내지 않음). `false`면 시각이 지워진다. `null`은 `invalid`. 0037부터 이미 받기 시각이 있으면 `true`를 다시 불러도 **처음 시각을 유지**(끄고 다시 켜면 새 시각) — 그래도 앱은 N1에서 사용자가 눌렀을 때만 부르는 것을 원칙으로 한다.
- 서버 쪽 알림 끄기(어르신·자녀 공통, 기기 여러 대에 한 번에 적용). 일일 알림·응원 도착·연결 성공 알림 모두 이 값을 따른다.
- 시스템 알림 권한과는 별개다(권한 거부면 애초에 토큰이 없음). 토큰 해제(`unregister_push_token`)는 로그아웃용.

## 3. 공통
### log_event(p_name text, p_props jsonb default '{}') → jsonb  (0022)
- 이름(이 목록만): `app_first_open, child_signup_completed, invite_code_issued, parent_code_redeemed, parent_code_failed, consent_shown, parent_consent_accepted, parent_consent_declined, course_step_completed, course_completed, child_report_viewed, invite_share_tapped, consent_revoked, account_deleted, cheer_sent, push_permission_result, link_opened, referrer_found, code_prefilled`(마지막 3개 0029), `paid_sheet_opened, paid_interest_tapped, photo_zoom_opened, child_first_answer_viewed, push_opened`(0034).
- 속성 키(최대 8개, 이 목록만): `role_guess, app_version, install_source, login_method, purpose, ttl_hours, reason, attempt_no, consent_version, step, day_index, duration_sec, tts_used, is_first, days_since_connect, channel, result, message_key, source, plan, push_kind`(source는 0029, plan·push_kind는 0034).
- 값은 키별 형식만(리뷰 L2, 문장 차단):
  - 숫자(0 이상 정수): `ttl_hours, attempt_no, day_index, duration_sec, days_since_connect` / 참거짓: `tts_used, is_first`
  - `role_guess` parent·child / `login_method` kakao·google·email / `purpose` parent_code·reconnect·sibling / `step` photo·question·hangul
  - `reason` expired·used·locked·invalid·rate_limited·busy·already_linked·not_parent_device / `channel` kakao·sms·copy·share_sheet·other / `result` granted·denied·matched·kept·skipped(뒤 3개 0029, P6 자판 쓰기: 맞게 씀·이대로 마침·넘어감)
  - `message_key` 응원 키 4개 / `consent_version` `v2` 형식 / `app_version` `1.0.0` 또는 `1.0.0-12` / `install_source` 영문 소문자로 시작·숫자 포함 1~16자(0029부터 숫자만은 불가) / `source`(0029) app_link·referrer·manual / `plan`(0034) monthly·yearly·gift / `push_kind`(0034) daily·cheer_arrived·parent_connected·parent_reconnected
- `{ok:true}` | `{ok:false, reason:'invalid_name'|'invalid_props'|'rate_limited'|'no_user'}`(예외 아님 → 계측 실패가 화면을 막지 않음). 가족·역할은 서버가 채움. 프로필 없는 기기(설치 직후 익명 로그인)도 기록 가능.
- 빌드 1 추가(0034): `paid_sheet_opened{}` C6 시트 열림, `paid_interest_tapped{plan}` C6 소식 받기(관심 표시만), `photo_zoom_opened{day_index}` B1, `child_first_answer_viewed{days_since_connect}` 자녀가 연결 후 처음 답을 봄(전환 분모, 처음 1회만 보내기는 앱 몫), `push_opened{push_kind}` 알림을 눌러 앱을 엶. **앱 계약 `events.ts`(L4)에 이 이름·값을 같은 철자로 추가해야 한다.**
- 연결 퍼널(0029): `link_opened{source}` 링크로 앱이 열림, `referrer_found{}` 설치 경로에서 번호를 찾음, `code_prefilled{source}` 번호 칸이 채워짐, 연결 성공은 기존 `parent_code_redeemed`. **번호 값은 어떤 키로도 보낼 수 없다**(code 키 없음, source는 3개 값만).
- 호출 상한: 기기(인증 uid의 sha256 가명키)당 24시간 200건(가정값). 지워진 계정의 남은 토큰은 `no_user`. 보관 14개월(0023 배치).
- 미정: C6 "소식 받기" 관심 이벤트 이름(그로스 결정 후 목록 추가), 서버 RPC 안 자동 기록.

## 4. 운영·서버 전용 (앱 호출 불가)
- **카카오 연결 끊기(0042, SV-06)**: 계정 삭제(앱 `delete_my_account`·관리자 `admin_delete_account` 공통) 때 카카오 회원번호를 `kakao_unlink_queue`에 넣고, cron `kakao-unlink` 10분마다(대기 중일 때만) → Edge Function `kakao-unlink`가 앱 어드민 키로 `POST kapi.kakao.com/v1/user/unlink`.
  - 성공·이미 해제(-101·-103)는 행 삭제(회원번호 보관 안 함), 실패는 2^n분 뒤 재시도(최대 24시간), 10번 실패하면 `gave_up_at`(운영자 확인) → 30일 뒤 파기.
  - 환경 설정(사용자, US-12): Edge secrets `KAKAO_ADMIN_KEY`(카카오 앱 어드민 키, 저장소·채팅 금지) + 공용 `PUSH_CRON_SECRET`·Vault 값(푸시와 같음), `npx supabase functions deploy kakao-unlink`. 키가 없으면 선점하지 않는다(시도 횟수 보존).
  - 확인: `select count(*), min(enqueued_at), max(attempts), count(gave_up_at) from kakao_unlink_queue;` 앱은 할 일 없음(탈퇴는 서버가 처리).
- **응원·연결 알림 보강(0041)**: 문구가 없는 종류는 cron이 할 일로 세지 않고, 직전 실행이 dry-run이면 1시간 쉰다. 큐의 어르신 프로필이 지워졌으면 연결 알림을 보내지 않는다. 문구 적재 스크립트는 대상 호스트를 보여 주고 환경 이름을 다시 입력받으며(production은 호스트 재입력) 금지어(혜택·무료·할인·유료·이벤트·쿠폰·광고·"다시 오세요")가 있으면 멈춘다. 잠금 화면 내용 숨김(L3)은 앱 AU-04 채널 설정 몫.
- **웹 삭제 요청 처리(0039, SV-07)** — 서비스 역할(Studio SQL Editor·스크립트)만:
  ```sql
  select public.admin_delete_account('<profile_id>', '메일 요청 #번호(접수일)', '<처리자>');  -- {ok, scope: child|parent|family} | {ok:false, reason:'not_found'}
  select public.admin_delete_answers('<profile_id>', '메일 요청 #번호(접수일)', '<처리자>');  -- 어르신 답·코스 기록·코스 이벤트(0043) {ok, answers, sessions, events} | not_found·not_parent
  ```
  - 계정 삭제 규칙은 앱 `delete_my_account`와 같은 공통 함수(`account_delete_core`): 자녀가 남으면 본인만, 마지막 자녀면 가족 전체 + 어르신 익명 인증 계정, 대상 인증 계정까지.
  - 관리자 함수 인자는 모두 **(대상, 사유, 처리자)** 순서(0043 통일). 사유에는 메일 주소·이름 등 개인정보를 적지 말고 접수 번호만(감사 행 1년 보관).
  - 사유·처리자 필수(`reason_required`·`operator_required`). 처리마다 `admin_audit`(처리자·시각·대상·가족·사유) — 대상이 지워져도 남는다. 0043부터 서비스 역할도 감사 표에 쓰기·수정·삭제·비우기 권한이 없고(쓰기는 admin RPC만), 1년 지나면 파기 배치만 지운다. 파기 함수는 미래 기준 시각을 거부(`future_now`). 공통 삭제 함수는 서비스 역할도 직접 못 부른다. 월 1회 점검: `select * from admin_audit where at > now() - interval '1 month' order by at;`
  - 처리 기한: 목표 7일·상한 10일(DECISIONS 11-17). 본인 확인 방법은 정책 문서 기준(삭제 안내 페이지).
- **콘텐츠 추가(0040, SV-08)**: `node scripts/photos/publish-content.mjs <묶음.json> --operator <처리자> [--reason ...]` (`--check`는 게이트만).
  - 순서: 검수표 `content/review.md` 게이트(검수일·검수자·"글자·사람·현대물건 없음"·"AI 표기"·"실제 장소 아님" 모두 ✅) → 끝에만·빈칸 없이 이어지는지 → **통과해야** 사진 업로드(덮어쓰기 금지, JPEG) → `admin_publish_content`(사진·질문·첫마디 한 번에, 감사 `content_publish`).
  - 이미 게시된 day_index는 덮어쓰지 않는다(`day_exists`), 중간 끼우기·건너뛰기 거부(`not_append`), 공개 사진 버킷 주소가 아니거나 길이 초과·빈 문구 거부(`invalid_item`). 고칠 땐 새 날 + `select admin_retire_content(<day>, '<사유>', '<처리자>')` — 이미 은퇴면 `already_retired`, 은퇴 뒤 활성 날이 7일보다 적어지면 `too_few_active`.
  - 서비스 역할은 콘텐츠 표에 직접 insert·delete할 수 없다(0043, 게시는 RPC·감사로만). 사진 주소 갱신만 허용.
  - 검수표에 `파일`·`sha256` 칸(검수한 사진 파일과 묶음), 사진 이름은 `day-<숫자>.jpg`만, 업로드 경로 `v2/day-NN.jpg`. 대상 확인은 `app/env/<환경>.env`의 `SUPABASE_PROJECT_REF`와 호스트 대조(`supabase/ops/target-check.mjs`, 문구 적재 스크립트도 같음).
  - 실행 전에 대상 호스트를 보여 주고 환경 이름을 다시 입력받는다(production은 호스트 재입력). 검수표 형식은 `scripts/photos/content-gate.mjs` 머리말. 게이트 테스트 `node --test scripts/photos/content-gate.test.mjs`.
- **콘텐츠 재고(0039)**: `select * from content_runway;` → `active_days`, `max_cursor`(가장 앞선 어르신 커서, 심사 가족 제외), `remaining_new_days`(그 뒤 남은 새 콘텐츠 날 수). 7일 미만이면 콘텐츠 추가(06시 루틴 경보 PM-07).
- **응원 도착·연결 알림(0038, SV-03)**: cron `push-events` 5분마다 → `push_events_kick()`(창 안이고 처리할 응원·연결 큐가 있을 때만) → Edge Function `push-events` → `push_events_claim()`.
  - N2 응원 도착 → **받는 어르신만**: 처리 안 된 응원(`cheers.notified_at` null)을 어르신별로 묶어 1개면 그 응원 문장, 여러 개면 "응원이 {n}개 왔어요".
  - N3 연결·재연결 → **그 가족 자녀**(DECISIONS U11: 자녀 즉시 알림은 연결·응원 관련만, 부모님 답 알림 없음). 제목·본문 `{호칭}` = 그 어르신 호칭(없으면 가족 호칭).
  - 공통 조건: 알림 켬 + 알림 받기 시각(자녀도 앱이 권한 허용 때 `set_push_enabled(true)`를 불러야 함) + 심사 가족 아님 + 토큰. KST 08:00~20:59에만 처리(밤 것은 아침에), 3일 지난 것은 보내지 않고 처리 표시. 선점 즉시 처리 표시(실패해도 재발송 없음).
  - 문구: 서버가 대상마다 `{설명}`(일일: 그 어르신 오늘 사진 설명, 없으면 `body_fallback`)·`{응원}`·`{n}`·`{호칭}`을 채워 `title`·`body`·`channel`을 준다. 채널 id: daily → `daily`, 응원 → `cheer`, 연결 → `family`(**AU-04가 세 채널을 같은 id로 만든다**, 채널 이름·설명은 copy `push.channel.*`).
  - 문구 넣기: `node supabase/ops/load-push-copy.mjs --approved`(copy.ko.json `push.*`·`cheers.*` → `push_copy`·`cheer_texts`, 법률 리뷰 뒤, 환경마다). `--dry-run`으로 미리 보기.
  - 연결 끊김 알림(`push.disconnected`)은 서버에 발생 지점이 없어 빌드 1 범위 밖(필요하면 별도 결정).
  - Edge 공용 로직은 `supabase/functions/_shared/push.mts`(테스트 `push.test.mts`), 함수 둘 다 secrets 같음.
- **공유 로컬 DB 규칙(11-18 리드)**: 54322에는 main에 들어간 마이그레이션만 둔다. 미병합 번호는 `supabase/ops/replay-check.sh` 임시 스택에서만 검증한다.
- 콘텐츠 표 쓰기(0035): authenticated·anon은 insert·update·delete·truncate 권한 자체가 없다. 콘텐츠는 서비스 역할(시드·스크립트)만.
- 0036: public **모든 표**에서 authenticated·anon의 TRUNCATE·REFERENCES·TRIGGER 회수 + postgres 기본 권한에서도 제거(새 표에 자동 적용). pgTAP이 전 표를 감시.
- 사진 버킷 `content-photos`: **AI 콘텐츠 사진 전용, 가족 개인 사진 금지**(공개 버킷). JPEG만·2MB. 가족 사진(빌드 2)은 비공개 버킷·RLS로 따로.
- **일일 푸시(0033, SV-02)**: cron `push-daily` 00:00 UTC(09:00 KST) → `push_daily_kick()`(pg_net) → Edge Function `supabase/functions/push-daily` → FCM HTTP v1.
  - **0036 선점**: 실제 발송은 `push_daily_claim(p_now)`가 대상을 `push_claims(kind, sent_on, profile_id)`에 먼저 선점하고 그 토큰만 돌려준다 — 동시 실행·재시도·기록 실패에도 같은 날 같은 어르신께 한 번만(실패하면 그날 재시도 안 함). `push_daily_targets`는 선점 없는 미리보기(dry-run·운영 확인용).
  - 대상 조건에 0036 `push_consented_at`(N1 받기 시각) 추가.
  - **오류 처리(0036, 재검토 R-M1 반영)**: 토큰 삭제는 FCM `UNREGISTERED`·`SENDER_ID_MISMATCH`(다른 프로젝트 토큰)·`message.token` 필드 오류일 때만. 필드 없는·토큰 아닌 INVALID_ARGUMENT/400과 429·5xx는 그 토큰만 failed. 401·403(SENDER_ID_MISMATCH 아님)·프로젝트 404는 설정 오류이며, **서로 다른 토큰 3개 이상**에서 나야 발송을 멈추고 선점분 failed, `push_runs.note='config_error'`(OAuth 실패는 `oauth_failed`) — 토큰 하나로 그날 알림 전체를 막지 못한다. 서버도 한 실행의 무효가 5개 이상·절반 초과면 토큰을 지우지 않는다(`invalid_ratio_hold`).
  - 대상 `push_daily_targets(p_now)`: 연결·동의한 어르신, 알림 켬, 심사 가족 아님, 오늘 코스 안 마침, 오늘 아직 안 보냄, 토큰 있음. KST 08:00~20:59 밖이면 빈 목록.
  - 문구 `push_copy(kind: daily·cheer_arrived·parent_connected·parent_reconnected, title ≤30, body ≤60)`: 라이터 확정(WR-02)·법률 리뷰 뒤 서비스 역할로 넣는다. **비어 있으면 보내지 않는다**(no_copy 기록).
  - 기록 `push_record`: 토큰별 `push_log`(31일) + 실행 요약 `push_runs`(대상·보냄·실패·무효·제외, 13개월). 무효 토큰(UNREGISTERED·INVALID_ARGUMENT)은 즉시 삭제.
  - 메시지: `notification{title, body}` + `android.notification.channel_id = 'daily'`(**AU-04가 같은 id로 채널 생성**) + `data{kind}`. 개인 id·번호 없음.
  - 환경 설정(사용자, staging·production 각각): Vault `project_url`·`push_cron_secret`, Edge Function secrets `PUSH_CRON_SECRET`(같은 값)·`FCM_SERVICE_ACCOUNT`(서비스 계정 JSON), 배포 `npx supabase functions deploy push-daily`. 없으면 kick은 `not_configured`, 서비스 계정이 없으면 함수는 dry-run(대상 수만, 기록 안 함).
  - 확인: `select * from push_runs order by id desc limit 5;`, `select * from net._http_response order by id desc limit 5;`(kick 응답).
  - 단위 테스트: `node --test supabase/functions/_shared/push.test.mts`(Node 23.6+). 실기기 수신은 staging에서(US-10 이후).

- `notification_queue`(0028): 연결·재연결 성공 시 `kind='parent_connected'`, `payload {parent_id, reconnect}`(번호 값 없음, 심사 가족 제외). 자녀 푸시 발송은 푸시 발송(SV-03, 0033 기반)가 읽고 `sent_at`을 채운다. 30일 지나면 파기 배치가 지운다. 앱 접근 불가.
- `daily_sessions.photo_id·question_id·word_id`(0028): 그날 받은 콘텐츠. start_today·record_session_step이 채움, 이전 행은 null.
- `purge_expired_data(p_now default now())`(0023): 답·코스 기록 session_date < 오늘-30, 응원 31일, 초대 번호 사용·만료 후 30일, 입력 시도 30일. pg_cron `purge-expired-data` 매일 00:10 KST. 원격 반영 시 pg_cron 확장 켜짐 확인.
- 심사 접근(0025): `admin_create_review_family(uuid[], p_max_uses=5)` → 심사 가족(is_review)+만료 없는 재사용 번호, **기본 꺼짐**. `admin_set_review_code(family, true|false)`로 심사 제출 때만 켜고, 끝나면 `admin_cleanup_review_family(family)`(심사 어르신 프로필·익명 계정 삭제 + 번호 끔). 연결 수가 max_uses에 닿거나 꺼져 있으면 redeem은 일반 `invalid`. 운영: `node supabase/ops/create-review-access.mjs create|enable|disable|cleanup …` — 번호는 출력만, Play 콘솔에만 적는다.
- `delete_my_account()`(0026): 마지막 자녀면 가족 어르신의 **익명 인증 계정도 삭제** → 어르신 기기는 다음 실행 때 세션이 무효(앱은 새 익명 로그인 후 첫 화면/미연결 열람으로).

## 5. 설계 선택과 근거
### 0024 콘텐츠 커서 (백오피스 리뷰 높음 1·3, 리드 결정)
- 문제: `mod(오늘-시작일, n)+1`은 콘텐츠 수 n이 바뀌면 한 바퀴 이상 돈 어르신의 '오늘'이 밀린다. 날짜 차이 기반 공식은 어떤 변형도 같은 문제.
- 선택: 어르신별 커서 `profiles.content_seq`(지금 day_index)·`content_seq_date`(연 날짜). 다음 = 커서보다 큰 활성 day_index 중 최소, 없으면 처음으로. 활성 = 사진·질문 모두 있고 `retired_at` 없음.
- 버린 안: 콘텐츠 seq + 진행일→seq 고정 매핑(진행일이 날짜 차이라 쉰 날도 넘어감 → "놓친 장 없이"와 충돌), get_today_content 안에서 전진(stable 함수에서 쓰기 불가).
- 이행: 기존 어르신은 이전 공식의 오늘 값으로 커서 고정(반영 순간 '오늘' 불변). day_index 30 상한 제거.
- 운영 규칙: 새 콘텐츠는 **끝에만** 추가(앞에 끼우면 이미 지나간 어르신은 다음 바퀴에 본다). 게시된 문항·사진 문구·day_index는 트리거로 수정 금지(`content_immutable`), 고칠 땐 새 행 + 옛 행 `retired_at`(되돌리기 불가). `image_url`은 저장 위치라 변경 허용. **삭제도 금지**(리뷰 M2, before delete 트리거): 지우고 같은 day_index로 다시 넣어 뜻을 바꾸는 우회 차단. 예외는 트랜잭션 한정 `set_config('bumo.allow_content_delete','on',true)`(pgTAP 픽스처·운영자 명시)뿐이고, 파기 배치는 콘텐츠를 지우지 않는다. 시드는 이미 있는 day_index를 건너뛰고 문구가 DB와 다르면 WARNING.
- 충돌 확인: streak(0005)·my_week_stamps(0016)는 daily_sessions만 봄. 31일 파기(0023)는 커서와 무관(답 존재로 '본 날'을 판정하지 않음). 0019 어르신별 구분과 같은 프로필 단위. `daily_sessions.day_index`에 그날 연 번호 기록.
### 기타
- 콘텐츠 선택 규칙(개인화 회의 11-17): `content_next_day`·`get_today_content`·`preview_content` 등 콘텐츠를 고르는 함수는 `parent_title`·호칭·답 등 개인 속성을 읽지 않는다. 빌드 2에서도 입력은 날짜와 어르신 본인의 `photo_pref`만(ARCHITECTURE §4). 시드 태그(season·place·era·city_ok)는 지금 주석·prompts.json에만 있고 서버는 쓰지 않는다.
- 연결 끊김 = 어르신 프로필의 user_id가 null(기기 삭제·재설치 후 재연결 전).
- 0018 무효화 예외: 재사용 번호(reusable)는 새 번호 발급·연결 성공 때 만료되지 않고 사용 처리도 안 된다(심사 가족 전용, 트리거로 강제).
- 하루 응원 한도 2·이벤트 호출 상한 200·이벤트 보관 14개월·심사 번호 상한 5는 가정 — 정책 검토 대상.
- 숫자 와/과: 읽는 소리 기준(0영·1일·3삼·6육·7칠·8팔은 과). 영문 끝은 와(선택지는 한글 원칙).

## 6. 로컬 적용 기록(리뷰 M3 관련)
- 리뷰 반영(11-17)은 아직 원격에 없는 0021·0022·0023·0024·0025·0027 파일을 **직접 고쳤다**. 로컬 DB에는 같은 변경분을 파일에서 잘라 만든 델타로 적용했고(데이터 삭제 없음), `migration repair`로 0021~0027 이력 행을 현재 파일 이름으로 다시 기록했다.
- 따라서 로컬 346→372건 통과는 "지금 DB 상태" 기준이다. 0001→끝 순차 재생 검증은 합칠 때 리드가 `db reset` 후 `test db`로 확인한다(M3).

## 7. SECURITY DEFINER 실행 권한 표 (0031, advisors 경고 정리)
- anon이 실행할 수 있는 public definer 함수: **0개**(0031에서 helper 4개 회수, pgTAP `security_hardening`이 회귀 감시).
- 서비스 역할 전용(authenticated·anon 불가): `purge_expired_data`, `content_next_day`, `advance_content_cursor`, `admin_create_review_family`, `admin_set_review_code`, `admin_cleanup_review_family`.
- authenticated 실행 가능 30개 — advisors `authenticated_security_definer_function_executable` 경고는 **설계상 의도**(바꾸지 않음). 공통: `search_path=''`, 함수 안에서 역할·본인·가족을 검사.

| 함수 | 부르는 쪽 | 의도·안에서 하는 검사 |
|---|---|---|
| my_profile_id · my_family_id · my_role · my_consented | RLS 정책 식(authenticated) | 정책이 쿼리 역할 권한으로 부르므로 authenticated 필수. 자기 것만 돌려줌 |
| create_family | 자녀 가입 직후 | 익명 아님·프로필 없음 |
| issue_invite_code | 자녀 | child 역할, 같은 가족 대상만 |
| redeem_invite_code · peek_invite_code | 어르신 기기 | 익명만, 잠금·시도 한도 |
| discard_anonymous_session | 소셜 로그인 직전 | 프로필 없는 익명 본인 계정만 |
| record_session_step · start_today · get_today_content · my_day_index · save_answer · my_week_stamps · parent_history | 어르신 | parent 역할·본인 행만, save_answer는 동의 확인 |
| give_consent · withdraw_consent | 어르신 | parent 역할·본인, 이력 기록 |
| get_my_cheers · mark_cheers_read | 어르신 | 받는 본인 것만 |
| parent_family_list | 어르신 | 본인 가족, 개인정보 없음 |
| preview_content | 연결 전 기기 | 프로필 있으면 거부 |
| child_summary · child_answer_history | 자녀 | child 역할·같은 가족·동의한 어르신만 |
| set_parent_title · set_parent_title_for | 자녀 | 닫힌 목록·같은 가족·중복 검사 |
| send_cheer | 자녀 | 키 화이트리스트·같은 가족·연결 확인·하루 한도 |
| delete_my_account · delete_scope_preview | 모두 | 본인(마지막 자녀면 가족) |
| log_event | 모두(설치 직후 익명 포함) | 이름·속성 화이트리스트, 기기 상한 |

- 콘솔 경고 2건(익명 로그인 허용·유출 비밀번호 보호)은 DB가 아니라 Auth 설정이라 `docs/team/RELEASE.md` §9 사용자 체크리스트에 적었다.

## 8. 재생 검증·원격 확인 (SV-09)
- **로컬 순차 재생**: `supabase/ops/replay-check.sh` — 공유 DB(54322)를 건드리지 않고 별도 임시 스택(project_id `bumo-jasik-replay-<pid>` 실행마다 고유, db 55322 — 포트가 같아 동시에 두 개는 못 돌림)에서 `db reset`(0001→끝 + 시드) → `test db` → 스택 삭제. 로그는 저장소 밖 `${TMPDIR}/bumo-replay-check.log`. 11-18 결과: 마이그레이션 31개 재생 + pgTAP 29파일 **446/446 PASS**(리뷰 M3 해소).
- **원격 확인(staging, 리드·사용자 실행 — SQL Editor)**:
  ```sql
  -- 파기 배치가 하루 이상 지난 뒤: 성공 1회 이상
  select status, start_time, return_message from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'purge-expired-data') order by start_time desc limit 3;
  -- 0017·0026 함수 소유자의 auth.users 삭제 권한(둘 다 true여야 탈퇴·가족 삭제가 인증 계정까지 지운다)
  select p.proname, pg_get_userbyid(p.proowner) owner,
         has_table_privilege(pg_get_userbyid(p.proowner), 'auth.users', 'delete') can_delete
    from pg_proc p where p.oid in ('public.delete_my_account()'::regprocedure, 'public.discard_anonymous_session()'::regprocedure);
  ```
  결과는 리드가 staging 반영 기록에 붙인다. 실제 탈퇴 1회(staging 테스트 계정)로 auth 사용자 삭제까지 확인하면 더 확실하다.

## 9. production Auth 설정 체크리스트 (SV-14, 실행은 사용자)
새 production 프로젝트는 대시보드 설정이 비어 있다(09-environments §3). 아래를 production에서 설정하고, staging 칸은 같은 화면에서 현재 값을 확인해 적는다(다르면 이유를 적거나 맞춘다).
기준값 = 저장소 `supabase/config.toml`(로컬). 마이그레이션은 Auth 설정을 옮기지 않는다.

| # | 대시보드 위치 | production 값 | 로컬 기준 | staging 확인 | 근거 |
|---|---|---|---|---|---|
| 1 | Authentication > Sign In / Providers > Anonymous | **ON** | `enable_anonymous_sign_ins = true` | ☐ | 어르신 연결이 익명 세션 위에서 동작(DECISIONS 11-16) |
| 2 | Authentication > Rate Limits > Anonymous sign-ins | 시간당 IP당 **30** 이하 | `anonymous_users = 30` | ☐ | advisors 경고 수용 조건(RELEASE §9) |
| 3 | 같은 곳 > Sign-ups·sign-ins / Token verifications / Token refresh | 5분당 30 / 30 / 150 | `sign_in_sign_ups`·`token_verifications`·`token_refresh` | ☐ | 무차별 대입 완화 |
| 4 | Providers > Email | ON, **Confirm email OFF**, OTP 길이 **6**, 만료 **600초** | `otp_length = 6`, `otp_expiry = 600`, `enable_confirmations = false` | ☐ | 자녀 이메일 인증번호 로그인(문구 "6자리") |
| 5 | Email Templates > Magic Link·Confirm signup | 제목 `[가화만사성] 인증번호`, 본문 = `supabase/templates/magic_link.html`·`confirmation.html` 그대로 붙여넣기 | `[auth.email.template.*]` | ☐ | 두 환경 동일 원본 |
| 6 | Authentication > SMTP | 전용 SMTP(발신 이름 "가화만사성", 서비스·한도는 사용자 결정), 이메일 발송 한도 설정 | `email_sent = 60`(로컬은 SMTP 없음) | ☐(staging=Gmail "[스테이징] 가화만사성") | 기본 메일은 한도가 낮음(09 §3) |
| 7 | Providers > Kakao | ON, Client ID = **production 네이티브 앱 키**, Secret, **Allow users without an email ON** | — | ☐(staging 키는 staging 전용) | 카카오 이메일 미수집(DECISIONS 11-17), 토큰 aud가 환경을 넘지 않게 |
| 8 | Providers > Google | ON, Client ID = production **웹** 클라이언트(+Android 클라이언트는 Google Cloud에만), Secret, Skip nonce check **OFF** | — | ☐ | 구글 공개판은 nonce 없음 = 검사 통과(08-social-login) |
| 9 | 카카오·구글 콘솔 Redirect URI | `https://<prod-ref>.supabase.co/auth/v1/callback` | — | ☐ | 각 프로젝트 자기 ref |
| 10 | Authentication > URL Configuration | Site URL = 출시 사이트 도메인(앱은 웹 리다이렉트 안 씀), 추가 URL 없음 | `site_url` 로컬값 | ☐ | 이메일 링크가 엉뚱한 곳으로 가지 않게 |
| 11 | 같은 곳(Advanced) > Manual linking | **OFF** | `enable_manual_linking = false` | ☐ | 계정 자동·수동 합치기 빌드 1 제외(DECISIONS 11-17) |
| 12 | Sessions / JWT | 만료 3600초, refresh token rotation ON, 재사용 간격 10초 | `jwt_expiry`·`enable_refresh_token_rotation`·`refresh_token_reuse_interval` | ☐ | 기본값 유지 |
| 13 | Attack Protection > Leaked password protection | **ON** | — | ☐(요금제에 따라 없을 수 있음, 미확인) | advisors 경고, 심사용 자녀 계정은 비밀번호 로그인 |
| 14 | Providers > Email > Password | 최소 길이 **10** 이상(심사 계정용) | `minimum_password_length = 6` | ☐ | 일반 사용자는 비밀번호 로그인 안 씀 |
| 15 | Attack Protection > CAPTCHA | **출시 시 OFF**(판단) | 없음 | ☐ | 켜면 익명 로그인·OTP 요청에 앱이 captcha 토큰을 보내야 해 앱 작업 필요. 한도(2·3)로 시작하고 남용 징후(익명 가입 급증) 시 켜는 것을 W3 보안 패스에서 재판단 |
| 16 | Database > Extensions | **pg_cron ON** | 로컬 기본 | ☐ | 0023 파기 배치(db push 전에 켤 것) |
| 17 | Database > Vault(Secrets) | **`project_url` = `https://<ref>.supabase.co`(필수)**, `push_cron_secret`(32자 이상 무작위, Edge secrets `PUSH_CRON_SECRET`과 같은 값) | 로컬은 없음 | ☐ | 없으면 cron이 Edge Function을 부르지 않고(not_configured), **콘텐츠 게시의 사진 주소 호스트 검사가 생략돼 https 형식만 본다**(0044 R-L1, 재검토 Q-L2). staging·production 모두 필수 |
| 18 | Database > Extensions | **pg_net ON**(extensions 스키마) | 로컬 기본 | ☐ | 0033 cron→Edge 호출 |

- 다 끝나면 production에서 Advisors(Security) 실행 → 남는 경고가 1(익명 허용, 의도)·13(요금제상 불가 시)뿐인지 확인.

## 10. 이메일 인증번호 재발송 동작 확인 (SV-13, 11-18)
- 질문: 문구 `login.resent` "이전 번호는 쓸 수 없어요"가 실제 동작과 맞는가.
- 재현(로컬 스택, GoTrue v2.198.0, config `otp_length 6`·`otp_expiry 600`·`max_frequency 1s`): 같은 메일로 `/auth/v1/otp` 두 번(2초 간격) → 서로 다른 6자리 2개 → **첫 번호 검증 = 403 `otp_expired`**, 두 번째 = 200(세션 발급).
- 결론: **문구와 동작이 맞다**(재발송하면 이전 번호는 무효). 앱은 첫 번호 입력 시 오는 `otp_expired`를 "번호가 만료됐어요/새 번호로 써 주세요" 계열로 보여 주면 된다(만료와 같은 코드라 구분 불가).
- 한계: staging·production(호스팅 GoTrue) 버전이 다르면 다를 수 있다 → 출시 전 staging에서 같은 순서로 1회 확인(테스트 메일). 재발송 간격(`max_frequency`)은 호스팅 대시보드 값(기본 60초일 수 있음, 미확인)을 따른다 — 앱의 "다시 보내기" 대기 시간과 맞출 것. 라이터 전달용.

## 11. 스토어 심사 접근 운영 절차 (SV-15)
대상: Play 콘솔 "앱 액세스"에 적을 심사용 계정·번호. 서버 0025(재사용 번호, 기본 꺼짐·연결 상한 5) + `supabase/ops/create-review-access.mjs`. 실행은 운영자(서비스 키), 번호·계정 값은 저장소·채팅에 남기지 않는다.
1. **준비(환경마다 1회)**: 대시보드 Authentication > Add user로 심사용 자녀 계정 2개(이메일+비밀번호, 비밀번호 10자 이상 — Auth 체크리스트 #14). 두 user id를 확인한다.
2. **만들기**: `node supabase/ops/create-review-access.mjs create <자녀1 id> <자녀2 id>` → 대상 호스트·환경 확인 → 심사 가족 id와 6자리 재사용 번호 출력(이때는 **꺼진 상태**).
   - 자녀 계정 하나로 앱에서 로그인해 호칭을 정해 둔다(심사자가 보는 화면이 자연스럽게).
3. **콘솔 입력**: Play 콘솔 > 앱 액세스 안내문에 "자녀 계정(이메일·비밀번호)으로 로그인"과 "다른 폰(또는 앱 데이터 삭제 후)에서 '부모님 휴대폰이에요' → 번호 6자리 입력" 두 경로를 적는다. 번호 값은 콘솔에만.
4. **심사 제출 직전**: `... enable <심사 가족 id>`(번호 켬). 상한 5대까지 연결된다.
5. **심사 결과가 나오면**: `... cleanup <심사 가족 id>` — 심사 기기의 어르신 프로필·익명 계정 삭제 + 번호 끔. 자녀 계정·가족은 남는다(다음 심사 때 4부터 다시).
6. 확인: `select is_review, (select count(*) from profiles p where p.family_id = f.id and role = 'parent') parents from families f where id = '<id>';`, 번호 상태 `select disabled_at, max_uses from invite_codes where family_id = '<id>' and reusable;`
- 주의: 심사 가족은 일일·응원·연결 알림 대상이 아니고(0033·0038) 지표에서도 뺀다(§12). 번호가 새면 `disable` 후 새로 `create`(새 가족). 스크립트는 실행 전 `app/env/<환경>.env` ref와 호스트를 대조한다. 리허설: staging에서 1~5를 1회(리드·사용자). 로컬은 0025 pgTAP(review_access)으로 같은 흐름을 검증한다.

## 12. 지표 SQL (SV-16)
- `supabase/ops/metrics.sql`: ① 퍼널 1~7단계 ② DAU(역할별)·어르신 코스 연 수 ③ D7 유지(퍼널 8) ④ 연결률 ⑤ 유료 관심(C6, 안별) ⑥ 푸시 종류별 발송·실패·무효·제외·열기 ⑦ 질문별 A/B 비율(응답 20명 미만 숨김). Studio SQL Editor에서 쿼리 하나씩, 맨 위 날짜만 바꿔 실행(읽기 전용).
- 모두 심사 가족 제외. 보관 기간 때문에 D7·A/B는 최근 31일, 이벤트는 14개월 안에서만 정확. 테스터 제외용 `is_test` 표시는 아직 없다(필요하면 결정 후 추가).

## 13. staging 테스트 가족 정리 (SV-11)
- `node supabase/ops/cleanup-test-families.mjs --operator <처리자>`(미리보기) → 숫자 확인 후 `--apply`. 대상 호스트·환경 확인(app/env ref 대조), **production이면 멈춤**.
- 기준: 가족의 모든 자녀가 테스트 도메인 메일(example.test·example.com·example.org·*.test, 앱 개발자 메뉴와 같은 표식). 실제 계정 자녀가 섞인 가족은 건너뛰고 수만 알린다. 메일·id는 출력하지 않는다.
- 방법: 자녀마다 `admin_delete_account`(공통 삭제 규칙) → 마지막 자녀에서 가족 전체 + 어르신 익명 계정. 처리마다 감사 행(사유 "<환경> 테스트 가족 정리(개발자 메뉴)").
- 로컬 확인(11-18): 공유 스택에서 미리보기만 실행 — 테스트 가족 7개 식별(통합 테스트가 만든 것), 삭제는 하지 않음. 실제 삭제는 0039 반영된 staging에서 리드·사용자가 1회.

## 14. 06시 운영 점검 항목(서버, PM-07 루틴에 붙여 쓰기)
매일(평일) Studio SQL Editor에서 확인하고 이상이 있으면 서버 줄에 알린다.
1. **카카오 연결 끊기**(재검토 R-M1): `supabase/ops/metrics.sql` ⑧ — `gave_up > 0`이면 운영자가 원인(어드민 키·카카오 응답)을 보고 수동 해제 후 행 처리. `config_error_runs_7d > 0`이면 `KAKAO_ADMIN_KEY` secret 확인(키 오류는 시도 횟수를 쓰지 않고 1시간마다 다시 시도). `oldest_waiting`이 하루를 넘으면 cron·함수 배포 확인.
2. **푸시**: ⑥ — `runs_with_note`(config_error·oauth_failed·invalid_ratio_hold)가 있으면 FCM 서비스 계정·프로젝트 확인. 일일 알림 `sent`가 0인데 대상이 있으면 `push_copy` 적재 여부(no_copy) 확인.
3. **콘텐츠 재고**: `select * from content_runway;` — `remaining_new_days < 7`이면 콘텐츠 추가(SV-08 스크립트).
4. **파기 배치**: `select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-expired-data') order by start_time desc limit 1;` — 어제 성공했는지.
5. 월 1회: `admin_audit` 지난 한 달 점검(§4), 사진 주소 변경 감사(`action = 'content_image_url'`)가 업로드 작업과 맞는지.
- 운영 원칙: 사용자 삭제는 Studio에서 인증 사용자를 직접 지우지 말고 `admin_delete_account`로만(카카오 해제 큐·감사가 그 경로에만 있음, 재검토 K-L3).

## 15. 테스터 가족 표시(0045, 리드 결정 is_test)
- `families.is_test`(기본 false): 비공개 테스트 테스터 가족. **지표 SQL에서만 뺀다**(알림·기능은 그대로). 심사 가족(`is_review`)과 별개.
- 표시·해제: `node supabase/ops/mark-test-family.mjs --email <테스터 가입 메일> --operator <처리자> [--unset]`(또는 `--family <id>`). 대상 호스트 대조, 메일·id는 끝 4자리만 출력, 감사 행 `test_family_mark`.
- 앱·서비스 역할 모두 `families`를 직접 UPDATE할 수 없다(0045, 쓰기는 definer 함수만). 가족 없는 설치 이벤트(app_first_open)는 테스터 구분이 안 된다.
- 0045에 재검토 Q-L1 포함: 사진 주소 변경 감사의 처리자 = 실제 호출 역할(`service_role`, Studio는 `postgres`).

## 16. 마이그레이션 대장(서버 기준, SV-17) — 계획 문서 대장(docs/plans/10 §2)은 리드가 이 표로 갱신
| 번호 | 내용 | main | staging |
|---|---|---|---|
| 0019~0030 | 어르신 구분·응원·지난 답·events·파기·커서·심사 접근·익명 정리·starter·기록·peek·퍼널·P16 | 병합 | 반영(11-18 리드) |
| 0031 | advisors 보안(helper·search_path·initplan) | 병합 | 사용자 확인 필요(US-05) |
| 0032 | 푸시 토큰 등록·해제 | 병합 | 미반영 |
| 0033 | 일일 푸시(대상·기록·cron·Edge) | 병합 | 미반영 |
| 0034 | 이벤트 빌드 1 추가 | 병합 | 미반영 |
| 0035 | 보안 후속(content 쓰기·동의 버전·호칭) | 병합 | 미반영 |
| 0036 | 푸시 리뷰(TRUNCATE 회수·선점·받기 시각) | 병합 | 미반영 |
| 0037 | 푸시 재검토(R-M1·받기 시각 유지) | 병합 | 미반영 |
| 0038 | 응원·연결 알림·문구 자리값 | 병합 | 미반영 |
| 0039 | 관리자 삭제·감사·재고 뷰 | 병합 | 미반영 |
| 0040 | 콘텐츠 게시·은퇴 | 병합 | 미반영 |
| 0041 | 알림 낮음·connected_date | 병합 | 미반영 |
| 0042 | 카카오 연결 끊기 | 병합 | 미반영 |
| 0043 | 관리자·게시 리뷰 반영 | 병합 | 미반영 |
| 0044 | 카카오·사진 주소 재검토 | 병합 | 미반영 |
| 0045 | 테스터 표시·Q-L1 | 브랜치(리뷰 대기) | 미반영 |
- staging 반영 전 순서: Vault·확장(§9 #16~18) → `scripts/db-push.sh staging` → `load-push-copy.mjs`(법률 리뷰 뒤) → 함수 배포 3개(push-daily·push-events·kakao-unlink) → secrets. 반영 뒤 §8 원격 확인 SQL.
- 공유 로컬 DB(54322)에는 main에 들어간 번호만 둔다. 미병합 번호는 `supabase/ops/replay-check.sh`로.

## 17. 리뷰 낮음 처리표(W3 일괄, 11-18)
| 출처 | 항목 | 처리 |
|---|---|---|
| push-tokens C | gen-types가 CLI 오류를 숨김 | 반영: 실패 시 오류 끝부분 출력 |
| push-tokens L1 | 토큰 등록 호출 빈도 제한 | 보류(수용): 토큰은 본인 행만 바뀌고 남의 토큰은 비공개라 순회 이득 없음. 남용 징후가 보이면 events 상한처럼 추가 |
| push-tokens L5·admin L5 | down 권한 원상·삭제된 어르신 큐 행 | 기록만(down은 수동 절차, 큐 행은 0041이 보내지 않고 30일 파기) |
| push-events L3 | 잠금 화면 내용 숨김 | 앱 AU-04 채널 몫(서버 변경 없음) |
| admin L3·R-L3 | 감사 행 uuid 전체·사유 자유 문자 | 문서: 사유에 메일·이름 금지(§4). 내부관리계획 §6·§7 정합은 법률 줄 |
| admin L6 | 한 바퀴 뒤 재고 경보 둔감 | 기록: 06시 점검에 `max_cursor`도 함께 봄(§14) |
| 0044 Q-L2 | Vault 미설정 시 호스트 검사 생략 | 반영: §9 #17·RELEASE 필수 설정 |
| 0035 D-L1·D-M1 | 앱 duplicate_title 매핑·staging 이전 APK | 앱·리드 몫 |
