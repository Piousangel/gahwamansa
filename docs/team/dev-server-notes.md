# 서버 계약 노트 (0019~0031) · 2026-11-17
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
- `{ok:true}` | `{ok:false, reason:'invalid_title'|'invalid_target'|'duplicate_title'}`. `duplicate_title`(0028) = 같은 가족 다른 어르신이 이미 그 호칭(어르신별 호칭, 없으면 가족 호칭)으로 보임 → 앱은 "다른 호칭을 골라 주세요"류로 안내. 자기 호칭을 다시 정하는 것은 ok.
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

### give_consent(p_version text default 'v1') / withdraw_consent()  (0019 변경)
- `v2` 그대로 보내면 된다(재동의 게이트 없음). 버전이 바뀌면 동의 시각 갱신 + 이력. 같은 버전 반복은 아무것도 안 함.
- 이력 `consent_events(action given|withdrawn, version, at)`은 앱이 읽지 못한다(증빙, 서비스 역할만). 계정 지우기 때 함께 지워짐.
- **정책 결정 필요(리뷰 L4)**: 어르신 본인 삭제·마지막 자녀의 가족 삭제 때 동의 증빙도 cascade로 지워진다. "모두 지워져요" 약속과는 맞지만 증빙 보관 목적과 충돌한다. 남길지(가명화해 일정 기간 보관) 정책·법무가 정해 DECISIONS에 기록할 것. 지금 구현은 함께 삭제. 파기 배치(0023)는 동의 이력을 건드리지 않는다.

## 3. 공통
### log_event(p_name text, p_props jsonb default '{}') → jsonb  (0022)
- 이름(이 목록만): `app_first_open, child_signup_completed, invite_code_issued, parent_code_redeemed, parent_code_failed, consent_shown, parent_consent_accepted, parent_consent_declined, course_step_completed, course_completed, child_report_viewed, invite_share_tapped, consent_revoked, account_deleted, cheer_sent, push_permission_result, link_opened, referrer_found, code_prefilled`(마지막 3개 0029).
- 속성 키(최대 8개, 이 목록만): `role_guess, app_version, install_source, login_method, purpose, ttl_hours, reason, attempt_no, consent_version, step, day_index, duration_sec, tts_used, is_first, days_since_connect, channel, result, message_key, source`(source는 0029).
- 값은 키별 형식만(리뷰 L2, 문장 차단):
  - 숫자(0 이상 정수): `ttl_hours, attempt_no, day_index, duration_sec, days_since_connect` / 참거짓: `tts_used, is_first`
  - `role_guess` parent·child / `login_method` kakao·google·email / `purpose` parent_code·reconnect·sibling / `step` photo·question·hangul
  - `reason` expired·used·locked·invalid·rate_limited·busy·already_linked·not_parent_device / `channel` kakao·sms·copy·share_sheet·other / `result` granted·denied·matched·kept·skipped(뒤 3개 0029, P6 자판 쓰기: 맞게 씀·이대로 마침·넘어감)
  - `message_key` 응원 키 4개 / `consent_version` `v2` 형식 / `app_version` `1.0.0` 또는 `1.0.0-12` / `install_source` 영문 소문자로 시작·숫자 포함 1~16자(0029부터 숫자만은 불가) / `source`(0029) app_link·referrer·manual
- `{ok:true}` | `{ok:false, reason:'invalid_name'|'invalid_props'|'rate_limited'|'no_user'}`(예외 아님 → 계측 실패가 화면을 막지 않음). 가족·역할은 서버가 채움. 프로필 없는 기기(설치 직후 익명 로그인)도 기록 가능.
- 연결 퍼널(0029): `link_opened{source}` 링크로 앱이 열림, `referrer_found{}` 설치 경로에서 번호를 찾음, `code_prefilled{source}` 번호 칸이 채워짐, 연결 성공은 기존 `parent_code_redeemed`. **번호 값은 어떤 키로도 보낼 수 없다**(code 키 없음, source는 3개 값만).
- 호출 상한: 기기(인증 uid의 sha256 가명키)당 24시간 200건(가정값). 지워진 계정의 남은 토큰은 `no_user`. 보관 14개월(0023 배치).
- 미정: C6 "소식 받기" 관심 이벤트 이름(그로스 결정 후 목록 추가), 서버 RPC 안 자동 기록.

## 4. 운영·서버 전용 (앱 호출 불가)
- `notification_queue`(0028): 연결·재연결 성공 시 `kind='parent_connected'`, `payload {parent_id, reconnect}`(번호 값 없음, 심사 가족 제외). 자녀 푸시 발송은 푸시 단위(0032~)가 읽고 `sent_at`을 채운다. 30일 지나면 파기 배치가 지운다. 앱 접근 불가.
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
- **로컬 순차 재생**: `supabase/ops/replay-check.sh` — 공유 DB(54322)를 건드리지 않고 별도 임시 스택(project_id `bumo-jasik-replay`, db 55322)에서 `db reset`(0001→끝 + 시드) → `test db` → 스택 삭제. 로그는 저장소 밖 `${TMPDIR}/bumo-replay-check.log`. 11-18 결과: 마이그레이션 31개 재생 + pgTAP 29파일 **446/446 PASS**(리뷰 M3 해소).
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
