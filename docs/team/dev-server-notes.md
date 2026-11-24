# 서버 계약 노트 (0019~0048) · 2026-11-17
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

### send_cheer(p_parent uuid, p_key text, p_request_id uuid default null) → jsonb  (0020, 0059 요청 id)
- 키는 `public.cheer_key_ok(text)` 한 곳(0060): 기존 4개(`love_you`·`warm_day`·`thanks_always`·`peaceful_day`, 지우지도 문장을 바꾸지도 않음) + 새 13개(`ans_me_too`·`ans_tell_more`·`old_story`·`photo_memory`·`childhood_story`·`call_soon`·`visit_soon`·`eat_together`·`love`·`miss_you`·`thought_of_you`·`doing_well`·`meal_thought`, 라이터 docs/team/copy/2026-11-24-cheer-expansion.md 3절 − `ans_seen`(DECISIONS 11-24 D-5)) = 17개.
  - 같은 함수를 `cheer_texts.message_key` check·이벤트 `message_key`(event_prop_ok)도 쓴다. 목록은 함수 본문(행 검사 아님 — 응원 문장 적재 전에도 보내기가 된다).
  - 정본은 앱 계약 `app/src/api/contract/cheers.ts` `CHEER_KEYS` 하나. `load-push-copy.mjs`·`events.ts`는 그 상수를 가져다 쓰고, 마이그레이션 목록은 `cheersContract.test.ts`가 마지막 `cheer_key_ok` 정의를 읽어 대조한다. 다음 확대: 새 마이그레이션의 `cheer_key_ok` + `CHEER_KEYS` + copy.ko.json `cheers.*` 세 곳(시험이 어긋남을 잡는다).
  - 문장이 없는 키(적재 전)의 응원 알림은 `body_many`(n=1)로 나간다 — 보내기·알림 모두 실패하지 않는다. 자녀 시트에 보일 키는 앱 `CHILD_SHEET_KEYS`(서버는 숨긴 키도 받는다).
  - **배포 순서**: 어르신 앱 ①(#236, 모르는 키 기본 문장)이 스토어에 나간 뒤에만 staging/production에 0060 반영(DECISIONS 11-24).
- `{ok:true, cheer_id}` | `{ok:false, reason:'invalid_key'|'invalid_target'|'disconnected'|'daily_limit'}`.
- 하루 한도(가정): 같은 자녀→같은 어르신 KST 하루 **2개**. 정책 확정 시 상수만 변경.
- **0059 재시도 멱등**: 앱은 응원 버튼을 누를 때 uuid를 한 번 만들어 `p_request_id`로 보내고, 시간 초과로 다시 보낼 때 **같은 값**을 쓴다. 같은 자녀의 같은 id가 이미 있으면 새로 넣지 않고 그 응원의 `{ok:true, cheer_id}`(한도 검사보다 먼저 — 재시도가 `daily_limit`으로 보이지 않음). id를 안 보내면 지금과 같다(하위 호환).
  - PostgREST로 두 키(`{p_parent, p_key}`)만 보내는 옛 호출: 0059를 올린 임시 스택에서 앱 통합 테스트 `__integration__/cheers.test.ts` 2건 PASS(11-20, #215 리뷰 L1 실증) — 3인자(기본값) 판 하나로 이름 인자 호출이 그대로 풀린다.
  - **요청 id 계약**(리뷰 L2): id는 버튼 한 번마다 새로 만들고, 같은 시간 초과 재시도 안에서만 다시 쓴다. 같은 id로 **다른 어르신·다른 문장**을 보내면 서버는 처음 응원의 성공을 그대로 돌려준다(조용히 무시, 새 응원 없음) — 앱 버그일 때만 생기므로 지금은 `request_conflict`를 두지 않는다. 응원 행이 31일 파기로 지워진 뒤 같은 id는 새 응원이 된다(한도 2개는 그대로).
  - 연결이 끊긴 뒤의 재시도(리뷰 L3): 대상 확인(`invalid_target`·`disconnected`)이 재시도 확인보다 앞이라, 첫 요청이 성공한 뒤 어르신 연결이 끊기면 재시도는 `disconnected`로 보인다(응원은 이미 한 번 생김, 드묾). 앱은 이 경우를 "보냈어요"로 볼 필요 없음 — 연결 끊김 상태 화면이 우선.
- 테이블 직접 insert는 막혔다(0020). 자녀는 읽음 여부(read_at)를 볼 수 없다.
- **키 값은 서버가 기준**(ARCHITECTURE.md): 앱 copy의 cheers 키를 `CHEER_KEYS`와 같게 맞춘다(옛 키 take_your_time·curious_answer·want_story·stay_healthy·will_call은 서버가 거부).
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

### parent_preview_child_view() → jsonb  (0050, P13 '가족에게 이렇게 보여요', PR #11 리뷰 M1)
```ts
// sb.rpc('parent_preview_child_view') → {
//   summary: { parent_title: string | null, parents: [ChildSummaryParent] },   // child_summary()와 같은 모양, 내 항목 1개만
//   history: { parents: [ChildHistoryParent] }                                // child_answer_history()와 같은 모양, 내 항목 1개만
// }
// ChildSummaryParent = { parent_id, title, connected, connected_date, shared, latest: { prompt, choice_label, starter, answered_date } | null }
// ChildHistoryParent = { parent_id, title, connected, shared, answers: [{ session_date, prompt, prompt_short, option_a, option_b, choice_label }] }
```
- **자녀가 받는 값과 같은 내부 함수**(`family_child_summary`·`family_child_history`)로 계산한다. 그래서 `latest`는 기간 제한이 없고(30일보다 오래된 답도 자녀 홈에 보이는 그대로), C5 지난 답은 최근 30일·최대 30개·서버 `prompt_short`("바다와 산 중")다. 앱은 parent_history를 걸러 흉내 내지 말고 이 값을 자녀 화면 부품(C2 카드·C5 줄)에 그대로 넣는다 — 자녀 쪽 파서(parseChildSummary 류)를 재사용할 수 있다.
- **미리보기 호칭은 `summary.parents[0].title`**(본인 호칭). `summary.parent_title`은 자녀 화면과 같은 가족 기본 호칭이라 어르신이 두 분인 가족에서는 다른 분의 호칭일 수 있다(PR #18 리뷰 L1). 출력 전체는 골든 테스트(`child_view_golden.test.sql`)로 고정 — 내부 함수를 고치면 자녀 화면·미리보기가 함께 바뀌므로 기대값과 이 계약을 같이 바꾼다.
- 동의 안 함·철회: 자녀와 똑같이 `shared=false`, `latest=null`, `answers=[]`(철회 즉시). 미리보기에 "지금은 가족에게 보이지 않아요" 같은 상태를 보여 주는 것은 앱·라이터 몫.
- 본인 항목만: 같은 가족의 다른 어르신 항목은 주지 않는다(그분의 동의는 자녀에게 공개한 것). 자녀 계정 정보(이름·메일·id)는 원래 없다. `parents`가 빈 배열이 되는 경우는 없다(본인 프로필이 있어야 실행됨).
- 어르신 본인만: 자녀·프로필 없는 기기는 `parent_required`, anon은 실행 불가. 내부 함수는 가족 id를 받으므로 앱·anon·서비스 역할 모두 직접 못 부른다.

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
- **0036부터 N1 "알림 받기"를 누를 때 `set_push_enabled(true)`를 꼭 부른다** — 서버가 그 시각(`push_consented_at`)을 남기고, 이 시각이 있는 사람만 일일 알림 대상이다(법률 체크리스트 #10 ④, OS 권한·토큰만으로는 보내지 않음). **0056부터 일일 알림은 답 공유 동의(`consented_at`, P2)를 보지 않는다** — 알림 받기 동의(`push_consented_at`)와 답 공유 동의는 별개라(DECISIONS 11-19), 답을 가족에게 보여 주지 않기로 한 어르신도 알림을 켜면 "오늘의 사진" 알림을 받는다. #10 ④(N1 동의 시각 저장·그 시각이 있는 사람에게만)와 그대로 맞는다: 대상 조건은 알림 켬 + `push_consented_at` + 연결·토큰·심사 아님·08~20시. 자녀에게 가는 알림은 그대로 — 첫 답(0052)은 어르신이 답을 보여 주는 중일 때만, 답 공유 미동의 어르신은 답 저장 자체가 막힌다(`consent_required`). `false`면 시각이 지워진다. `null`은 `invalid`. 0037부터 이미 받기 시각이 있으면 `true`를 다시 불러도 **처음 시각을 유지**(끄고 다시 켜면 새 시각) — 그래도 앱은 N1에서 사용자가 눌렀을 때만 부르는 것을 원칙으로 한다.
- 서버 쪽 알림 끄기(어르신·자녀 공통, 기기 여러 대에 한 번에 적용). 일일 알림·응원 도착·연결 성공 알림 모두 이 값을 따른다.
- 시스템 알림 권한과는 별개다(권한 거부면 애초에 토큰이 없음). 토큰 해제(`unregister_push_token`)는 로그아웃용.

### record_terms_agreement(p_terms_version text, p_privacy_version text) / my_terms_status()  (0046, 법률 Q2)
```ts
// 자녀: 로그인 화면의 약관 줄에 동의할 때(가족 만들기 전이어도 됨). 어르신: 연결 화면의 약관 줄 동의 때(연결 전 익명 기기여도 됨).
// sb.rpc('record_terms_agreement', { p_terms_version: 'v1', p_privacy_version: 'v2' })
//   → { ok: true; recorded: boolean } | { ok: false; reason: 'invalid_version' | 'unknown_version' }   // 0048: 게시된 버전만
// sb.rpc('my_terms_status') → { latest_terms, latest_privacy, needs_reagree, terms_version?, privacy_version?, agreed_at? }
//   needs_reagree = 최신 게시 버전 쌍에 아직 동의하지 않음(기록이 없으면 true). 0046의 {}(기록 없음)는 0048부터 이 모양으로 바뀜
```
- 인증 계정 단위 이력(같은 두 버전 반복은 새 기록 없음 — 앱 시작 때 다시 불러도 됨). 계정을 지우면 함께 지워진다(D-05 원칙). 앱은 표를 직접 못 읽는다.
- 새 약관·방침 버전은 운영자가 `select admin_publish_terms_version('terms'|'privacy', '<버전>', '<사유>', '<처리자>');`로 게시(감사, 되돌리지 않음). 앱은 `needs_reagree`로 다시 동의 화면을 띄울지 정한다(게이트 여부는 법률·리드 결정). 같은 버전 쌍은 한 번만 기록(번갈아 보내도 늘지 않음).
- **게시 버전이 하나도 없으면 동의가 `unknown_version`으로 거부**된다 → 환경마다 출시 전에 약관·방침 버전을 먼저 게시(remote-checks에 확인 줄).
- **앱은 `needs_reagree`만 쓴다**(xhigh 리뷰 L9). `terms_version`·`privacy_version`·`agreed_at`은 "마지막으로 새로 기록된 쌍"이라 A→B→A로 동의하면 B를 보여 준다(같은 쌍은 다시 기록하지 않음). 화면에 "동의한 버전"을 보여 주는 용도로 쓰지 않는다.
- **버전 표기 규칙**(법률 재확인): 서버 값은 `v<정수>`(필요하면 `v1.1`) 또는 `YYYY-MM-DD`. 약관·방침 문서 머리의 "버전 1"·"버전 1.1"이 서버 `v1`·`v1.1`과 같다(문서 머리를 바꾸면 같은 번호로 게시). 한 종류 안에서는 한 가지 형식만 쓰고, 날짜 형식으로 바꾸지 않는다.
- **게시 순서 규칙**(리뷰 L8): "최신 = 가장 늦게 게시한 버전"이다. 옛 버전을 나중에 게시(백필)하지 않는다 — 그 버전이 최신이 되어 모든 사용자가 옛 버전 재동의 대상이 된다. 한 트랜잭션에서 같은 종류를 두 번 게시하지 않는다(게시 시각이 같아 텍스트 정렬로 갈림: `v10` < `v9`).

### delete_my_account() / delete_scope_preview() — 가족 연결 전 계정 (0049, 법률 리뷰 M1·방침 게시 조건 P20)
```ts
// sb.rpc('delete_scope_preview') → { scope: 'child' | 'parent' | 'family' | 'none' }
// sb.rpc('delete_my_account')    → { scope: 'child' | 'parent' | 'family' | 'none' }
//   'none' = 가족과 연결하기 전 계정(프로필 없음: 로그인만 한 자녀, 번호 입력 전 어르신 익명 기기). 0049 전에는 no_profile 예외였다.
```
- `none`이면 본인 인증 계정을 지우고, 그와 함께 약관 동의 이력(terms_agreements)·소셜 식별 정보(identities)가 cascade로, 푸시 토큰은 함수가 지운다. 카카오 로그인이었으면 회원번호를 연결 끊기 큐에 넣는다(0042와 같은 규칙).
- 앱 할 일(앱 줄 몫): P9 삭제 확인 화면이 `none`을 받으면 "가족 기록은 없고, 로그인 정보와 약관 동의 기록만 지워져요" 같은 안내를 보여 준다(문구는 라이터). 삭제 뒤 기기 정리는 기존과 같다. 지금 앱 `deleteMyAccount`는 반환값을 쓰지 않아 깨지지 않는다. `deleteScopePreview`의 `scope` 타입에 `'none'`을 추가해야 한다.
- 연결 직후 경쟁(삭제 확인과 같은 순간 번호 연결): 서버가 인증 사용자 행을 잠근 뒤 프로필을 다시 보고, 그 사이 연결됐으면 프로필 기준 삭제(child·parent·family)로 처리한다.

### dev_reset_today() → jsonb  (0051, staging QA S25 — 오늘 코스 다시 하기)
```ts
// sb.rpc('dev_reset_today')
//   → { ok: true; session_date: 'YYYY-MM-DD'; sessions: number; answers: number }
//   | { ok: false; reason: 'disabled' | 'not_test_family' }
// 어르신(parent) 본인만 — 자녀·연결 전 기기는 예외 parent_required, anon은 실행 불가
```
- 서버 스위치 `server_flags.dev_reset_enabled`가 켜진 DB(로컬 시드·staging 운영자)에서, **테스터 가족(`families.is_test`, §15)** 의 어르신만 동작한다. production은 스위치가 꺼져 있어 항상 `disabled`.
- 본인의 **오늘(KST)** `daily_sessions`·`answers`만 지운다. 어제 이전 기록, 같은 가족의 다른 어르신, 콘텐츠 커서, 응원, 이벤트는 그대로. 커서가 그대로이므로 다시 `start_today`를 부르면 **같은 날 콘텐츠**로 처음부터 시작한다(`advanced=false`).
- 감사 행(`admin_audit` action `dev_reset_today`, 처리자 `self`, 대상 프로필·가족, 지운 개수). 1년 보관 규칙은 다른 감사 행과 같다.
- 앱(개발자 메뉴 등 staging 빌드에서만 노출) 할 일: 성공하면 오늘 코스 화면 상태를 비우고 `start_today`를 다시 부른다. `disabled`·`not_test_family`는 토스트로 이유만.

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
- **`account_deleted`는 서버가 기록한다(0054)**: 앱은 삭제 뒤 사용자가 없어 보낼 수 없다. 삭제 공통 함수(`account_delete_core`: 앱 `delete_my_account`·`admin_delete_account` / `user_delete_core`: 연결 전 계정·`admin_delete_user`)가 삭제마다 1건 — `family_id`·`profile_id`·`device_key` 모두 null, `actor_role` = 지운 사람 역할(연결 전은 none), props `{scope: child|parent|family|none, role}`만. 심사 가족 삭제는 기록하지 않는다. 기록 시각은 시 단위로 자른다(`date_trunc('hour')`, 다른 행과 이어 붙이지 못하게). 측정 기록이 실패해도 삭제는 진행된다(예외 블록, warning `account_deleted_event_failed: <SQLSTATE>`만). 지표는 `name = 'account_deleted' and device_key is null`로 센다(`metrics.sql` ⑨)(scope·role 키는 서버 전용이라 log_event 속성 목록에는 없다). 앱은 이 이벤트를 보내지 않아도 된다.
- 호출 상한: 기기(인증 uid의 sha256 가명키)당 24시간 200건(가정값). 지워진 계정의 남은 토큰은 `no_user`. 보관 14개월(0023 배치).
- 미정: C6 "소식 받기" 관심 이벤트 이름(그로스 결정 후 목록 추가), 서버 RPC 안 자동 기록.

## 4. 운영·서버 전용 (앱 호출 불가)
- **카카오 연결 끊기(0042, SV-06)**: 계정 삭제(앱 `delete_my_account`·관리자 `admin_delete_account` 공통) 때 카카오 회원번호를 `kakao_unlink_queue`에 넣고, cron `kakao-unlink` 10분마다(대기 중일 때만) → Edge Function `kakao-unlink`가 앱 어드민 키로 `POST kapi.kakao.com/v1/user/unlink`.
  - 성공·이미 해제(-101·-103)는 행 삭제(회원번호 보관 안 함), 실패는 2^n분 뒤 재시도(최대 24시간), 10번 실패하면 `gave_up_at`(운영자 확인) → 30일 뒤 파기.
  - 환경 설정(사용자, US-12): Edge secrets `KAKAO_ADMIN_KEY`(카카오 앱 어드민 키, 저장소·채팅 금지) + 공용 `PUSH_CRON_SECRET`·Vault 값(푸시와 같음), `npx supabase functions deploy kakao-unlink`. 키가 없으면 선점하지 않는다(시도 횟수 보존).
  - 확인: `select count(*), min(enqueued_at), max(attempts), count(gave_up_at) from kakao_unlink_queue;` 앱은 할 일 없음(탈퇴는 서버가 처리).
- **응원·연결 알림 보강(0041)**: 문구가 없는 종류는 cron이 할 일로 세지 않고, 직전 실행이 dry-run이면 1시간 쉰다. 큐의 어르신 프로필이 지워졌으면 연결 알림을 보내지 않는다. 문구 적재 스크립트는 대상 호스트를 보여 주고 환경 이름을 다시 입력받으며(production은 호스트 재입력) 금지어(혜택·무료·할인·유료·이벤트·쿠폰·광고·"다시 오세요")가 있으면 멈춘다. 서버 제약(`push_text_clean`, 0049)도 같은 목록(유료 포함, 방침 2절)이고, 보이지 않는 글자·문장부호·공백을 걷어내고 NFKC로 합친 뒤 검사한다(`혜·택`·`할­인`·NFD 분해 모두 거부). "무료한 오후"·"사진의 포인트"·"생일 이벤트"처럼 뜻이 다른 말도 거부된다(공백을 지우는 이상 "무료 한 달"과 구분할 수 없어 일부러 둠 — 문구를 바꿔 쓴다. 낱말 좁히기는 법률 줄 확인 뒤). 잠금 화면 내용 숨김(L3)은 앱 AU-04 채널 설정 몫.
- **자녀 '첫 답' 알림(0052, DECISIONS 11-19 사용자 결정, U11 예외)**: 연결 뒤 어르신의 **첫 새 답** 때 그 가족 자녀마다 **평생 1회**. 종류 `parent_first_answer`, 채널 `family`, FCM data `kind=parent_first_answer`(앱은 눌렀을 때 자녀 홈으로 — 앱 줄 몫).
  - 확정 문구(라이터, 11-19): 제목 `{호칭}께서 첫 답을 고르셨어요`, 본문 `앨범에서 보고 이야기해 볼까요?`(금지어·길이 통과, pgTAP).
  - 문구: 라이터가 `docs/team/copy.ko.json`에 `push.first_answer.title`·`body`를 넣으면 `load-push-copy.mjs`가 적재(없으면 "라이터 문구 대기"로 건너뜀 → 서버는 그 종류를 보내지 않음). 자리값은 `{호칭}`만 허용(스크립트가 다른 자리값을 거부) — **답 내용·고른 답·시각은 넣지 않는다**. 금지어 검사는 push_copy 제약 그대로.
  - 큐: `save_answer`가 새 답(같은 날 같은 질문 고치기는 아님)을 넣을 때, 아직 기록이 없는 자녀가 있고 같은 종류 미처리 큐가 없으면 `notification_queue`에 한 줄(payload `{parent_id}`만). 심사 가족 제외.
  - 선점(push-events, KST 08~20시): 어르신이 **지금도 동의 중**일 때만. 기록 없는 자녀마다 `first_answer_notices`(자녀 PK = 평생 1회)에 한 줄:
    - `claimed` → 대상(받을 수 있음: 알림 켬·받기 동의 시각·심사 아님 + 토큰 있음). Edge가 `push_record`로 결과를 남기면 `sent`(토큰 하나라도 성공) 또는 `failed`로 확정. 재시도 없음.
    - `no_token`(받을 수 있지만 토큰 없음), `skipped`/`not_reachable`(알림 끔·받기 동의 없음) — 그 첫 답은 지나가고 나중에 켜도 다시 안 보냄.
    - 실제 도달 확인: `select status, reason, count(*) from first_answer_notices group by 1, 2;`(`claimed`가 오래 남아 있으면 Edge 결과 기록이 안 된 것).
  - **백필(0052 반영 시 1회)**: 반영 전에 이미 답이 있던 가족의 자녀(자녀 프로필이 생긴 뒤 그 가족 어르신 답이 있음)는 `skipped`/`backfill` — 몇 주째 답해 온 가족에 "첫 답" 알림이 가지 않는다(리뷰 PR #48 M1). down 뒤 다시 올리면 백필이 다시 도니 기록을 내보내 두고 복원한다(down 머리말).
  - 서버 제약 `push_copy_first_answer_vars`: 첫 답 문구는 `{호칭}` 외 자리값 금지, body_fallback·body_many 없음.
  - 라이터 확인 권장(리뷰): 나중에 연결된 형제 자녀도 "첫 답" 문구를 받는데 어르신에게는 첫 답이 아니다 — 문구를 그대로 둘지 라이터 판단. 철회면 아무에게도 안 보내고 기록도 안 남김(다시 동의하고 새로 답하면 그때가 첫 답). 나중에 연결된 형제 자녀는 연결 뒤 다음 새 답 때 1회.
  - `first_answer_notices`는 앱·anon·서비스 역할 접근 불가, 자녀 프로필 삭제 시 함께 삭제. 확인: `select status, count(*) from first_answer_notices group by 1;`, `select * from push_runs where kind = 'parent_first_answer' order by id desc limit 5;`
- **웹 삭제 요청 처리(0039, SV-07)** — 서비스 역할(Studio SQL Editor·스크립트)만:
  ```sql
  select public.admin_delete_account('<profile_id>', '메일 요청 #번호(접수일)', '<처리자>');  -- {ok, scope: child|parent|family} | {ok:false, reason:'not_found'}
  select public.admin_delete_answers('<profile_id>', '메일 요청 #번호(접수일)', '<처리자>');  -- 어르신 답·코스 기록·코스 이벤트(0043) {ok, answers, sessions, events} | not_found·not_parent
  select public.admin_delete_user('<auth user id>', '메일 요청 #번호(접수일)', '<처리자>');   -- 0049: 가족 연결 전(프로필 없는) 계정 {ok, scope:'none'} | not_found·has_profile
  ```
  - 계정 삭제 규칙은 앱 `delete_my_account`와 같은 공통 함수(`account_delete_core`): 자녀가 남으면 본인만, 마지막 자녀면 가족 전체 + 어르신 익명 인증 계정, 대상 인증 계정까지.
  - **이용 기록(events)도 함께(0058, 방침 4절)**: 프로필·가족에 묶인 행은 FK cascade로, 프로필 없이 쌓인 행(연결 전·`device_key` = 인증 uid의 sha256)은 공통 함수가 `device_key`로 지운다 — 대상 본인, 가족 전체 삭제 때 함께 지워지는 어르신 익명 계정, 연결 전 계정(`user_delete_core`: 앱·`admin_delete_user`·0057 자동 정리). 탈퇴·정리 기록(`account_deleted`·`account_purged`)은 식별자가 없어 남는다. **인증 계정을 지우는 길은 공통 함수 두 개뿐**(`account_delete_core`·`user_delete_core(uuid, text)`) — `discard_anonymous_session`(기록 없음으로 user_delete_core)·`admin_cleanup_review_family`(어르신마다 account_delete_core)도 이 함수를 거친다. 새 삭제 경로는 이 둘을 불러야 하며, pgTAP(`delete_events_by_device`)이 `delete from auth.users`가 다른 public 함수에 생기면 실패한다.
  - 프로필이 없는 계정(가족 만들기 전 자녀, 번호 입력 전 어르신 기기)은 `admin_delete_account`가 찾지 못한다(not_found) → `admin_delete_user`(대상은 **auth 사용자 id**). 프로필이 있으면 `has_profile`로 거부하니 `admin_delete_account`를 쓴다. 인증 계정·약관 동의 이력·토큰 삭제, 카카오면 해제 큐, 감사 `delete_user`(detail에 user_id). 대상 계정 찾는 법은 §19 제안 ③(리드 결정 전에는 Studio Authentication에서 사용자를 찾아 id만 복사).
  - 관리자 함수 인자는 모두 **(대상, 사유, 처리자)** 순서(0043 통일). 사유에는 메일 주소·이름 등 개인정보를 적지 말고 접수 번호만(감사 행 1년 보관). 서버가 `pii_in_args`로 거부하는 것(0047·0049): `@`·전각 `＠`·"이름 at 도메인 dot com", 하이픈·공백·점으로 끊어도 이어 붙여 **9자리 이상인 숫자**(전화·카드·계좌). uuid는 먼저 걷어내므로 사유에 가족 id를 적어도 된다.
  - **접수 번호 규칙**: 숫자 8자리 이하(예 `20261119`) 또는 `#n`(예 `#12`). 날짜는 `11-19`·`2026-11-19`로, **시각은 적지 않는다**(`2026-11-19 12:30`은 공백으로 이어 붙어 10자리가 되어 거부).
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
  - 문구 검사(0046 Q6): 서버 check 제약이 `push_copy`·`cheer_texts`에 광고성 낱말(혜택·할인·이벤트·무료·쿠폰·적립·포인트·경품·광고·"다시 오세요")이 들어가면 거부한다. 적재 스크립트도 같은 목록 + 유료로 먼저 멈춘다.
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
| create_family | 자녀 가입 직후 | 익명 아님. 이미 자녀 프로필이 있으면 같은 가족·프로필 반환(0059 재시도), 어르신 프로필이면 already_has_profile |
| issue_invite_code | 자녀 | child 역할, 같은 가족 대상만 |
| redeem_invite_code · peek_invite_code | 어르신 기기 | 익명만, 잠금·시도 한도 |
| discard_anonymous_session | 소셜 로그인 직전 | 프로필 없는 익명 본인 계정만 |
| record_session_step · start_today · get_today_content · my_day_index · save_answer · my_week_stamps · parent_history | 어르신 | parent 역할·본인 행만, save_answer는 동의 확인 |
| parent_preview_child_view | 어르신 | parent 역할·본인 항목만(자녀 화면과 같은 내부 함수, 0050) |
| dev_reset_today | 어르신 | parent 역할·본인 오늘 기록만, 스위치·테스터 가족일 때만(0051) |
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
1. **카카오 연결 끊기**(재검토 R-M1, 보안 회의 D2·E7 — 포기 행은 **당일** 처리): `supabase/ops/metrics.sql` ⑧.
   - `gave_up > 0`이면 `select * from kakao_unlink_gave_up;`(0047, **회원번호 없이** id·시도·마지막 HTTP만)로 확인 → 원인이 어드민 키면 `KAKAO_ADMIN_KEY` 교체 후 `select admin_kakao_unlink_retry(<id>, '<사유: 키 교체 뒤 재시도(날짜)>', '<처리자>');` → 다음 회차(10분)에 다시 해제.
   - 카카오 쪽 문제로 계속 실패하면 카카오 개발자 콘솔에서 수동으로 연결을 끊고 `select admin_kakao_unlink_resolve(<id>, '<사유: 콘솔 수동 해제(날짜)>', '<처리자>');`로 행을 지운다(회원번호 보관 안 함). 둘 다 감사 행이 남는다.
   - 운영 SQL·대장에 회원번호를 출력·기록하지 않는다(서비스 역할도 큐의 회원번호 열을 직접 읽지 못함, 0047). 수동 해제에 번호가 꼭 필요하면 Studio(postgres)에서 그 한 건만 보고 바로 닫는다.
   - `config_error_runs_7d > 0`이면 `KAKAO_ADMIN_KEY` secret 확인(키 오류는 시도 횟수를 쓰지 않고 1시간마다 다시 시도). `oldest_waiting`이 하루를 넘으면 cron·함수 배포 확인.
2. **푸시**: ⑥ — `runs_with_note`(config_error·oauth_failed·invalid_ratio_hold)가 있으면 FCM 서비스 계정·프로젝트 확인. 일일 알림 `sent`가 0인데 대상이 있으면 `push_copy` 적재 여부(no_copy) 확인.
   - **첫 답 알림 결과 미기록**(0052): `select count(*), min(created_at) from first_answer_notices where status = 'claimed' and created_at < now() - interval '1 hour';` — 0이 아니면 선점 뒤 Edge가 결과(`push_record`)를 남기지 못한 것(함수 중단·배포·secrets 문제). `select * from push_runs where kind = 'parent_first_answer' order by id desc limit 5;`와 Edge `push-events` 로그를 본다. 평생 1회라 다시 보내지 않으며, 행은 `claimed`로 둔다(도달 여부 모름으로 집계). remote-checks에도 같은 줄이 있다.
3. **콘텐츠 재고**: `select * from content_runway;` — `remaining_new_days < 7`이면 콘텐츠 추가(SV-08 스크립트). `max_cursor`도 함께 본다: 커서가 마지막 날 근처면 곧 한 바퀴를 돌아 첫 날로 돌아가고(그 뒤엔 `remaining_new_days`가 크게 나와 경보가 둔해짐, 리뷰 admin L6), 새 콘텐츠 없이 반복이 시작된다.
4. **파기 배치**: `select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-expired-data') order by start_time desc limit 1;` — 어제 성공했는지.
   - **연결 전·옛 익명 계정 정리(0057, 90일)**: 같은 배치의 한 단계. 어제 지운 수 `select count(*) from events where name = 'account_purged' and ts > now() - interval '1 day';`(metrics ⑩).
     - 사용자별 실패: `select count(*), max(failures), max(last_failed_at) from stale_purge_failures;` — 0이 아니면 그 사람만 건너뛴 것(다음 실행에서 정렬 뒤로, 나머지는 계속 지워짐). 같은 사람이 여러 날 실패하면(`failures` 증가) `last_sqlstate`로 원인(FK·트리거·권한)을 보고 서버 줄에 알린다. 사용자 id는 출력·대장에 옮기지 않는다.
     - 단계 전체 실패(결과 키 `stale_anonymous` = -1)는 배치는 성공으로 끝나고 Postgres 로그에 warning `purge_stale_anonymous_failed: <SQLSTATE>`뿐이다 → remote-checks **"익명 계정 정리 진행"이 false**(대상이 있는데 최근 2일 `account_purged` 없음)거나 **"익명 계정 정리 준비"가 false**(Supabase Auth 업그레이드로 `auth.sessions.refreshed_at`·`refresh_tokens.user_id` 등 열이 바뀜)면 정리가 멈춘 것 — 서버 줄에 알린다(두 번째 리뷰 L4). `last_sqlstate = '40P01'`(교착)이 반복되면 배치 시각을 옮긴다(L3).
5. 월 1회: `admin_audit` 지난 한 달 점검(§4, `action <> 'dev_reset_today'`로 QA 초기화 행은 따로 — 0051), 사진 주소 변경 감사(`action = 'content_image_url'`)가 업로드 작업과 맞는지.
- 운영 원칙: 사용자 삭제는 Studio에서 인증 사용자를 직접 지우지 말고 `admin_delete_account`(프로필 없는 계정은 `admin_delete_user`, 0049)로만(카카오 해제 큐·감사가 그 경로에만 있음, 재검토 K-L3).
- 감사 사유 규칙(DECISIONS 11-18): `admin_delete_*`의 사유(reason)에는 **요청 번호만**(예: `REQ-2026-012 웹 삭제 요청`), 이름·메일·닉네임·기종 같은 개인정보 금지. 처리자(operator)는 사람 이름 대신 역할명(`owner`). admin_audit는 1년 보관되고 대상이 지워져도 남는다(0039). 요청 번호↔메일 대응은 문의 메일함의 삭제 요청 대장에만(내부관리계획 §6·§7). 0047·0049부터 서버가 `@`·전각 ＠·9자리 이상 숫자(구분자 제거 후)가 든 사유를 `pii_in_args`로 거부한다.

## 15. 테스터 가족 표시(0045, 리드 결정 is_test)
- `families.is_test`(기본 false): 비공개 테스트 테스터 가족. **지표 SQL에서만 뺀다**(알림·기능은 그대로). 심사 가족(`is_review`)과 별개.
- 표시·해제: `node supabase/ops/mark-test-family.mjs --email --operator <처리자> [--unset]` → 메일은 프롬프트로 입력(셸 기록에 남지 않게), 또는 `--family <id>`. 대상 호스트 대조, 메일·id는 끝 4자리만 출력, 감사 행 `test_family_mark`.
- 앱·서비스 역할 모두 `families`를 직접 UPDATE할 수 없다(0045, 쓰기는 definer 함수만). 가족 없는 설치 이벤트(app_first_open)는 테스터 구분이 안 된다.
- 0045에 재검토 Q-L1 포함: 사진 주소 변경 감사의 처리자 = 실제 호출 역할(`service_role`, Studio는 `postgres`).

### 개발 스위치(server_flags, 0051)
- 표 `server_flags(name, enabled, updated_at)` — 지금 이름은 `dev_reset_enabled` 하나. 마이그레이션은 행을 넣지 않는다(= 모든 환경 기본 꺼짐). 앱·anon·서비스 역할은 읽기·쓰기 불가.
- 로컬: `supabase/seed_dev_flags.sql`(db reset 때만)로 켜짐.
- staging: QA 기간에 운영자가 SQL Editor(postgres)에서 켜고, 끝나면 끈다. 값은 비밀이 아니다.
  ```sql
  insert into public.server_flags (name, enabled) values ('dev_reset_enabled', true) on conflict (name) do update set enabled = excluded.enabled, updated_at = now();
  update public.server_flags set enabled = false, updated_at = now() where name = 'dev_reset_enabled';  -- 끄기
  ```
- production: 켜지 않는다. remote-checks "개발 스위치 꺼짐" 줄이 production에서는 반드시 true(staging은 QA 중 false 허용). 표가 RLS(정책 없음)라 RLS를 우회하지 못하는 역할로 돌리면 이 줄은 **판정 보류(null)** 로 나온다 — 그때는 SQL Editor(postgres)에서 다시 본다. 실측(리뷰 PR #37): postgres·service_role·`supabase_read_only_user`(`db query --remote --read-only`)는 모두 RLS를 우회하므로 정상 판정된다.
- 원격 방지: 로컬 시드는 `server_flag_seed_local`을 부르고, 이 함수는 Vault에 `project_url`이 있는 DB(staging·production)에서는 켜지 않는다(pgTAP 확인). 그래도 원격에 시드를 넣는 명령(`db push --include-seed`, `db reset --linked`)은 쓰지 않는다(§18).
- 후속(리뷰 PR #37 L3, 리드 결정 대기): 누가 언제 켰는지 기록이 없다(`updated_at`은 직접 넣어야 바뀜). 안 — 갱신 트리거로 `updated_at = now()`, 켜기·끄기를 `admin_audit`(action `flag_set`)에 남기는 트리거, 또는 remote-checks detail에 `updated_at` 표시.
- 후속(L4): QA가 다시 하기를 반복하면 `dev_reset_today` 감사 행이 쌓인다 → 월 1회 감사 점검(§14-5)은 `action <> 'dev_reset_today'`로 나눠 본다.

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
| 0046 | 약관 동의 이력·금지어 제약 | 병합 | 미반영 |
| 0047 | 키 위생(E1·E7: display_name 제거·pii_in_args·카카오 포기 뷰) | 병합 | 미반영 |
| 0048 | 약관 게시 버전·재동의 판단 | 병합 | 미반영 |
| 0049 | xhigh 리뷰 후속(뷰 쓰기 회수·pii 보강·금지어 정규화·연결 전 계정 삭제) | 병합 | 미반영 |
| 0050 | 어르신 미리보기 parent_preview_child_view(자녀 화면 계산 공통 함수) | 병합 | 미반영 |
| 0051 | 개발 스위치 server_flags + dev_reset_today(테스터 가족 오늘 코스 다시) | 브랜치 server-dev-reset-today | 미반영 |
| 0052 | 자녀 '첫 답' 알림(parent_first_answer, 평생 1회) | 브랜치 server-first-answer-push(0051 위) | 미반영 |
| 0053 | 이벤트 AC-05(course_step_started·finished) | PR #61 | 미반영 |
| 0054 | account_deleted 서버 기록(식별자 없음) | 브랜치 server-account-deleted-event(0053 위) | 미반영 |
| 0056 | 일일 알림 대상에서 답 공유 동의 조건 제거(알림 받기 동의만) | 브랜치 server-daily-push-consent | 미반영 |
| 0057 | 연결 전·옛 익명 계정 90일 자동 정리(account_purged) | 브랜치 server-stale-anon-purge | 미반영 |
| 0058 | 계정 삭제 때 프로필 없이 쌓인 이용 기록(device_key)도 삭제 | 브랜치 server-delete-events-by-device(0057 위) | 미반영 |
| 0060 | 응원 키 확대 ②: cheer_key_ok 하나로 send_cheer·cheer_texts check·이벤트 message_key 통합, 새 13키 | 브랜치 server/cheer-keys-13 | 미반영(어르신 앱 ① 스토어 출시 뒤) |
- staging 반영 전 순서: Vault·확장(§9 #16~18) → `scripts/db-push.sh staging` → `load-push-copy.mjs`(법률 리뷰 뒤) → 함수 배포 3개(push-daily·push-events·kakao-unlink) → secrets. 반영 뒤 §8 원격 확인 SQL.
- 공유 로컬 DB(54322)에는 main에 들어간 번호만 둔다. 미병합 번호는 `supabase/ops/replay-check.sh`로.

## 17. 리뷰 낮음 처리표(W3 일괄, 11-18)
기준: **반영**=코드·테스트로 고침, **문서**=동작은 그대로 두고 운영 규칙·안내로 막음, **보류(수용)**=위험이 작고 근거를 적어 두고 징후가 보이면 다시 봄, **다른 줄 몫**=앱·법률·리드 소유라 전달만.
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
| xhigh 11-19 L1 | 금지어 정규화 우회·과잉 거부 | 반영(0049 정규화·유료 추가). 과잉 거부는 보류(수용): 공백 제거 방식상 "무료한"과 "무료 한 달"을 구분 못 함 → 낱말 좁히기는 법률 줄 확인 뒤 |
| xhigh L2·L3 | SUPABASE_SECRET_KEYS 이상 모양·첫 값 폴백 | 반영: 객체·문자열 검사 후 폴백, `edge`→`default`만(다른 이름 안 씀). 기동 로그에 종류·키 이름 목록(값 없음) — staging에서 `edge` 이름이 실제로 들어오는지 함수 로그로 확인 |
| xhigh L4·L5·L6 | ops 키 파이프 입력·미리 입력 에코·옛 키 조용히 사용 | 반영: 터미널 아니면 키 입력 거부(환경변수만), 프롬프트 직전 남은 입력 버리고 "프롬프트 뒤 붙여 넣기" 안내, 옛 키면 "옛 키 사용" 출력 |
| xhigh L7 | database.gen.ts 0045 기준 | 리드 몫: 합치기 창에서 main 공유 DB에 0046~0049 반영 뒤 `scripts/gen-types.sh`(서버 줄은 미병합 번호를 공유 DB에 올리지 않음) |
| xhigh L8 | 옛 버전 백필 시 최신 뒤바뀜 | 문서: §2 게시 순서 규칙(백필 금지) |
| xhigh L9 | A→B→A 표시 버전 | 문서: §2 앱은 `needs_reagree`만 |
| xhigh L10 | down이 감사 action 제약을 되돌리지 않음 | 문서: down 0047·0048·0049 머리말 |
| xhigh L11 | replay 실패 출력 필터 | 반영: `-i`·`jwt secret`·`secret key`·`access key` |
| xhigh L12 | §18 B 약관 게시 단계 없음 | 반영: B-3a |

## 18. staging 반영 리허설 절차(0031~0045) · production dry-run 점검 (W3, 실행은 사용자·리드 — 서버 줄은 원격 실행 안 함)
비밀값(서비스 키·FCM JSON·카카오 어드민 키·cron 비밀)은 비밀번호 관리자에서 꺼내 쓰고 저장소·채팅·셸 기록에 남기지 않는다.
- **셸 기록 규칙(보안 회의 D13)**: 비밀값은 명령줄 인자·`VAR=값 명령`·curl 헤더 문자열로 쓰지 않는다. 운영 스크립트(ops·photos 6개)는 키를 숨김 입력으로 받는다(ops용 secret 키 `SUPABASE_SECRET_KEY`를 쓸 때도 `read -rs SUPABASE_SECRET_KEY; export SUPABASE_SECRET_KEY` 후 끝나면 `unset`). 불가피하게 명령줄에 쓰면 앞에 공백을 두고 zsh에 `setopt HIST_IGNORE_SPACE`(한 번 `~/.zshrc`에). Edge secrets는 `--env-file <저장소 밖 임시 파일>` 후 바로 삭제.
- **키 분리(D9·D10)**: Edge Function은 런타임이 주는 새 secret 키(`SUPABASE_SECRET_KEYS`, 이름 `edge` 권장)를, 운영 스크립트는 **따로 발급한 ops용 secret 키**를 쓴다. staging·production의 모든 비밀값은 서로 다르다(같으면 출시 관문 실패). 옛 서비스 키(legacy)는 새 키로 옮긴 뒤 비활성화(2026년 말 폐기).

### A. 준비(로컬, 서버 줄·리드)
1. main이 0045까지 포함하는지, `supabase/ops/replay-check.sh` 통과(0001→끝 재생 + pgTAP), `scripts/gen-types.sh --check` 최신.
2. 이번에 올라갈 번호 확인: staging은 0030까지 반영(11-18). 0031(US-05)이 이미 올라갔는지 대시보드 Database > Migrations에서 확인 → 올라갈 범위 0031(또는 0032)~0045.

### B. staging 반영(사용자 — 순서 중요)
1. **확장**: 대시보드 Database > Extensions에서 `pg_cron`, `pg_net` 켜기(0033·0042가 cron·http 호출에 씀). 마이그레이션도 `create extension if not exists`로 켜지만 권한상 대시보드에서 먼저 켜 두는 것이 안전.
2. **Vault — 대시보드 Vault 화면으로만 입력**(보안 회의 D11, SQL Editor에 값을 쓰지 않음: 쿼리 기록에 남는다): Database > Vault > Add new secret으로 `project_url` = `https://<staging-ref>.supabase.co`, `push_cron_secret` = 32자 이상 무작위(비밀번호 관리자의 생성기로 만들고 저장). 루트 키는 꺼내 보관하지 않는다.
3. **마이그레이션**: `scripts/db-push.sh staging` → 화면의 dry-run 목록이 위 범위와 같은지 확인 → 환경 이름·ref 재입력 → push.
   - 3a. **약관·방침 버전 게시**(0048부터, 앱 동의 전에 필수): 법률 확정본의 문서 머리 "버전 n"에 맞춰(§2 버전 표기 규칙) SQL Editor에서 `select admin_publish_terms_version('terms', 'v1', '출시 약관 게시 #n', '<처리자>');`와 `('privacy', 'v1', …)`를 한 번씩, **따로 실행**(한 트랜잭션에 두 번 게시 금지·옛 버전 백필 금지, §2). 감사 행이 남는다.
4. **확인**: SQL Editor에 `supabase/ops/remote-checks.sql`을 붙여 실행. 이 단계에서 false여도 되는 줄: 푸시 문구·응원 문장(아직 안 넣음), 파기 배치 최근 성공(다음 날 00:10 KST 이후 다시), 사진 주소(0044 이전 사진이면 아래 B-9).
5. **함수 secrets**(맥 터미널, 값은 비밀번호 관리자에서 임시 파일로 — 저장소 밖 `~/tmp/staging.secrets`, 끝나면 삭제):
   ```bash
   # ~/tmp/staging.secrets 는 편집기로 만든다(echo·heredoc 금지 — 셸 기록에 남음). 줄마다 PUSH_CRON_SECRET=… / FCM_SERVICE_ACCOUNT=<JSON 한 줄> / KAKAO_ADMIN_KEY=<staging 전용 카카오 앱 어드민 키> / PUSH_DRY_RUN=1
   npx supabase secrets set --project-ref <staging-ref> --env-file ~/tmp/staging.secrets && rm ~/tmp/staging.secrets
   ```
6. **함수 배포**: `npx supabase functions deploy push-daily push-events kakao-unlink --project-ref <staging-ref>` (config.toml의 `verify_jwt = false`가 함께 적용되는지 대시보드 Functions에서 확인).
7. **연기 시험(dry-run)** — 비밀값을 명령줄에 쓰지 않는다(보안 회의 D13):
   ```bash
   read -rs PCS            # 비밀번호 관리자에서 push_cron_secret 붙여 넣기(화면에 안 보임)
   printf 'x-cron-secret: %s\n' "$PCS" | curl -s -X POST https://<staging-ref>.supabase.co/functions/v1/push-daily -H @-
   unset PCS
   ```
   → `{"status":"dry_run" ...}` 또는 창 밖이면 `window_closed`. 비밀 없이 부르면 403이어야 한다. `select * from push_runs order by id desc limit 3;`
8. **문구 적재**(법률 리뷰 WR-02 통과 뒤): `node supabase/ops/load-push-copy.mjs --approved` → 대상 주소 입력(https만) → **ops용 secret 키는 숨김 입력**(화면·셸 기록에 안 남음, **프롬프트가 뜬 뒤 붙여 넣기** — 먼저 붙여 넣으면 터미널이 보여 준다) → 환경 `staging` 입력(ref 대조). `KEY=값 node …`·`echo 키 | node …` 형태로 쓰지 않는다(파이프 입력은 스크립트가 거부). "옛 키 사용"이 출력되면 셸에 남은 `SUPABASE_SERVICE_ROLE_KEY`를 `unset`하고 다시.
   - 모든 ops·photos 스크립트는 주소 검사 → 대상 확인(confirmTarget) → 그 뒤에만 키로 요청한다(xhigh M3, publish-content `--check` 포함).
9. **사진 주소**: B-4의 사진 주소 줄이 false면 0044 이전 주소가 다른 호스트·http인 것 — 게시된 사진은 그대로 두되(이미 보이는 사진), 새 게시는 v2 경로·https만 된다. 필요하면 `scripts/photos/upload-photos.mjs`로 주소 갱신(감사 행 남음).
10. **실발송 켜기**: secrets에서 `PUSH_DRY_RUN` 제거(`npx supabase secrets unset PUSH_DRY_RUN --project-ref <staging-ref>`) → 실기기 2대(어르신·자녀)로 알림 받기 → 다음 날 09:00 일일 알림, 응원 보내기 5분 안 도착, 새 번호 연결 시 자녀 연결 알림, 테스트 계정 탈퇴 10분 안 카카오 해제(`metrics.sql` ⑧ unlinked_7d).
11. **다시 확인**: `remote-checks.sql` 전부 true(심사 기간이면 심사 번호 줄만 예외). 결과를 staging 반영 기록에 붙인다.
- **시드를 원격에 넣지 않는다**: `supabase db push --include-seed`, `supabase db reset --linked` 금지(시드는 로컬 전용 — 콘텐츠·약관·개발 스위치. 약관 게시는 B-3a, 콘텐츠는 publish-content). 개발 스위치 시드는 Vault project_url이 있으면 켜지지 않지만 그것에 기대지 않는다(0051 L1).
- 되돌리기: down 파일은 수동·부분이라 원칙은 **앞으로 고치기**(새 마이그레이션). 함수는 이전 커밋으로 다시 배포, cron은 `select cron.unschedule('<이름>')`로 멈춤.

### C. production dry-run 점검(P1 업로드 직전, 사용자)
- [ ] staging에서 B 전체 완료·실기기 확인 기록 있음
- [ ] production Auth 설정 §9 1~18 완료(특히 Vault 2개, pg_cron·pg_net, 익명 한도, 카카오 "Allow users without an email")
- [ ] `scripts/db-push.sh production` 실행 → **dry-run 목록만 확인하고**, 실제 반영할 때가 아니면 환경 이름 재입력에서 다른 값을 넣어 멈춘다(아무것도 바뀌지 않음). 목록이 0001~0045 + 이후 번호인지, staging과 같은 커밋인지
- [ ] 실제 반영 때(확인 입력 뒤) 스크립트가 만드는 스키마 백업이 `~/bumo-jasik-backups/`에 생겼는지 — dry-run만 보고 멈추면 백업은 생기지 않는다(데이터 백업은 Pro 일일 백업·PITR)
- [ ] production secrets는 staging과 **다른 값**(cron 비밀·카카오 production 앱 어드민 키·FCM production 프로젝트 서비스 계정)
- [ ] 콘텐츠: 시드 + 사진 v2 업로드 계획, 문구 적재는 법률 리뷰 통과본으로
- [ ] 심사 접근(§11): 심사 가족 만들기는 반영 뒤, 번호는 기본 꺼짐 확인
- [ ] 반영 뒤 `remote-checks.sql` + `metrics.sql` ⑧·⑥ 첫날 확인, 06시 점검(§14) 시작

### D. 0057·0058 staging 반영 뒤 확인(11-20 정리, 반영은 사용자 승인 뒤 리드)
범위: 0057 연결 전·옛 익명 계정 90일 자동 정리, 0058 계정 삭제 때 이용 기록(events device_key) 동반 삭제. main에는 병합됨, staging에는 아직 없음.
1. **반영 직후 SQL Editor(postgres)에서 `supabase/ops/remote-checks.sql`** — 아래 줄을 본다.
   - `익명 계정 정리 준비(0057): auth 열·권한` → **true여야 한다**. false면 원인 둘 중 하나:
     - 함수 소유자(postgres)가 `auth.sessions`·`auth.refresh_tokens`를 읽지 못하거나 `auth.users`를 지우지 못함(hosted 권한 — 로컬에서는 true였지만 hosted는 실측 전)
     - Supabase Auth 버전 차이로 열 8개(`users.is_anonymous·last_sign_in_at·updated_at`, `sessions.user_id·updated_at·refreshed_at`, `refresh_tokens.user_id·updated_at`) 중 하나가 없음
     - 어느 쪽이든 정리 단계가 매일 -1로 조용히 멈춘다 → 서버 줄에 알리고, 고칠 때까지 방침 P21 게시를 미룬다.
   - detail의 "정리 대상 N명": 반영 시점에 이미 90일 넘은 연결 전·옛 익명 계정 수. 하루 200명씩 줄어든다(첫 며칠 클 수 있음).
   - `익명 계정 정리 진행(0057)`: **반영 첫날은 false일 수 있다**(대상이 있는데 아직 00:10 KST 배치 전). 다음 날 06시 점검에서 다시 보고, 대상이 있는데 이틀째 false면 정리가 멈춘 것.
   - `마이그레이션 최신 번호` ≥ 0058, `앱 실행 가능 definer` 개수 줄도 true인지.
2. **Studio 권한 확인(읽기만)** — 위 "준비" 줄이 false일 때 원인을 가르는 데 쓴다:
   ```sql
   select has_table_privilege('postgres', 'auth.sessions', 'select') as sessions_read,
          has_table_privilege('postgres', 'auth.refresh_tokens', 'select') as refresh_read,
          has_table_privilege('postgres', 'auth.users', 'delete') as users_delete;
   select table_name, column_name, data_type from information_schema.columns
    where table_schema = 'auth' and (table_name, column_name) in (('sessions', 'refreshed_at'), ('refresh_tokens', 'user_id'), ('users', 'is_anonymous'));
   ```
   - `refreshed_at`이 `timestamp without time zone`이 아니어도 함수는 동작한다(`::timestamp at time zone 'UTC'`로 읽음, 오차는 하루 안 — 90일 기준에 영향 없음).
   - 읽기 전용 역할(`db query --remote --read-only`)로 remote-checks를 돌려도 이 두 줄은 함수 없이 표만 읽어 그대로 나온다.
3. **다음 날(첫 00:10 KST 배치 뒤) 06시 점검** — §14-4:
   - `select count(*) from events where name = 'account_purged' and ts > now() - interval '1 day';`(정리된 수, 대상이 있었다면 0보다 커야 함)
   - `select count(*), max(failures), max(last_failed_at) from stale_purge_failures;`(0이 정상, 있으면 `last_sqlstate`로 원인)
   - `select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-expired-data') order by start_time desc limit 1;`(배치 자체 성공)
4. **0058 확인(테스트 계정으로)** — staging 테스트 가족에서 연결 전 계정 하나를 앱에서 지운 뒤(또는 `admin_delete_user`), 그 계정이 남긴 `app_first_open` 같은 이벤트가 없는지: 지우기 **전에** `select count(*) from events where profile_id is null and family_id is null and ts > now() - interval '1 hour';`를 보고, 지운 뒤 다시 본다(줄어야 함). uid·해시를 대장에 옮기지 않는다.
5. 법률 대조: 반영·확인이 끝나면 P21(방침 4·10절, 삭제 안내 2절 `{연결 전 계정 자동 정리 기간}` = 90일)·P22(방침 4절 이용 기록 행, 삭제 안내 3절)를 법률 줄이 게시 조건 표에서 닫는다.

## 19. 제안(구현 안 함 — 리드·법률 결정 대기, xhigh·법률 재확인 11-19)
### ① 쓰지 않는 연결 전 계정 정리 배치 → **구현(0057, 익명만 90일, 오너 확정 DECISIONS 11-20)**
- 대상: 익명 + 프로필 없음(가족과 연결하지 않은 어르신 기기, 재연결로 프로필이 새 기기로 옮겨 가 비워진 옛 익명 계정) + 마지막 활동(가입·로그인·사용자 갱신·세션 갱신·리프레시 토큰 갱신 중 가장 늦은 것)이 90일 넘음. 기간은 `stale_anon_days()` 한 곳.
- 지울 범위: 연결 전 계정의 `delete_my_account`와 같은 공통 함수(`user_delete_core`) — 토큰·인증 계정 → 약관 확인 기록·identities·세션 cascade. 기록은 식별자 없는 `account_purged`(props `{scope:'stale_anonymous'}`, 시 단위) — 탈퇴(`account_deleted`)와 따로 센다(metrics ⑩).
- 실행: `purge_expired_data`(cron 00:10 KST)의 한 단계, 한 번에 최대 200명(사람당 서브트랜잭션 2개, 두 번째 리뷰 L1). 실패 기록은 마지막 실패 30일 뒤 지운다(L2 — 방침 보관표에 "정리 실패 기록 30일" 한 줄 필요, 법률 줄). 한 명씩 예외 블록 — 실패한 사람만 건너뛰고 `stale_purge_failures`에 횟수를 남겨 다음 실행 정렬에서 뒤로(결과 키 `stale_anonymous_failed`). 삭제 직전에 사용자 행을 잠근 채 마지막 활동(세션 `refreshed_at` 포함)을 다시 본다. 단계 전체가 실패해도 다른 파기는 계속(`stale_anonymous` = -1). 06시 점검 §14-4, remote-checks "익명 계정 정리 준비"(auth 열·권한 — Auth 업그레이드로 열이 바뀌면 false)·"익명 계정 정리 진행"(대상이 있는데 2일째 정리 기록이 없으면 false) — 둘 다 함수를 부르지 않아 읽기 전용 역할로도 돈다.
- **제외**: 제안에 있던 비익명(카카오·구글·메일) 자녀 중 가족을 만들지 않은 계정 1년 정리는 이번 범위가 아니다(오너 결정 범위 밖 — 필요하면 별도 결정).
- 방침: 4절 새 행·10절, 삭제 안내 2절의 `{연결 전 계정 자동 정리 기간}` = 90일(게시 조건 P21, 법률 PR #154).

### ② terms_agreements 보관 기한
- 지금: 계정이 있는 동안 기한 없이 보관, 계정 삭제 때 cascade로 함께 삭제. 같은 버전 쌍은 다시 쌓이지 않아(0048) 사용자당 행 수는 게시한 버전 쌍 수 이하다.
- 안 A(추천): 지금 그대로 "계정 삭제 시까지"로 방침에 적는다. ①이 들어가면 쓰지 않는 계정의 이력도 기한이 생긴다. 동의 입증은 계정이 있는 동안만 필요하다는 전제(삭제 뒤 분쟁 대비 보관이 필요하면 안 C).
- 안 B: 사용자당 최근 2쌍만 남긴다(재동의 판단에는 최신 쌍만 필요). 옛 동의 시점 입증이 약해진다.
- 안 C: 계정 삭제 뒤에도 가명(인증 uid의 sha256) + 버전·시각만 1년 보관. 삭제 약속("모두 지워요")과 충돌하므로 방침 예외 조항이 필요하다(지금 예외는 카카오 큐 30일·감사 1년 두 개뿐).

### ③ 앱이 없어진 분의 메일 삭제 요청 — 계정 찾는 법(법률 재확인 L12)
- 원칙(키 정책 ④): 운영자 화면·터미널·대장·채팅에 회원번호·메일 주소 전체를 출력하지 않는다. **끝 4자리만** 보여 주고(`mark-test-family.mjs`와 같은 규칙), 찾은 id는 화면에 다시 치지 않고 스크립트가 그대로 삭제 RPC에 넘긴다.
- 메일로 가입한 자녀·구글 자녀: 요청 메일의 주소로 찾는다. 안 — `supabase/ops/find-and-delete-account.mjs --operator <처리자> --request '#n'`: 메일을 **숨김 입력**으로 받음 → 서비스 역할 전용 definer `admin_find_user(p_email)`(신설 제안)이 `auth.users.email` 또는 `identities.identity_data->>'email'`을 소문자로 비교해 `{user_id, has_profile, role, provider, created_on(날짜만)}` 목록을 돌려줌 → 스크립트는 "uid 끝 4자리 · provider · 역할 · 가입일 · 메일 끝 4자리 마스킹(`****.com`이 아니라 `…l.com`처럼 4글자)"만 출력 → 운영자가 번호로 골라 확인 입력 → 프로필이 있으면 `admin_delete_account(profile)`, 없으면 `admin_delete_user(uid)`. 감사 사유는 접수 번호만.
- 카카오 자녀: 메일 없이 가입할 수 있어("Allow users without an email") 메일로 못 찾을 수 있다. 두 안 중 택1(둘 다 가능):
  - (a) 요청자에게 카카오 계정 메일을 받아 위 경로로 찾는다(카카오가 메일을 줬을 때만 identity_data에 있음).
  - (b) **카카오 "연결 끊기 알림"(unlink callback)** 을 받는 Edge Function을 둔다: 사용자가 카카오 계정 설정 > 연결된 서비스 관리에서 우리 앱 연결을 끊으면 카카오가 회원번호와 함께 우리 주소를 부른다 → 서버가 그 회원번호의 인증 계정을 같은 공통 규칙으로 삭제(감사 `delete_user`, 사유 "카카오 연결 끊기 알림"). 삭제 안내 페이지에 "카카오로 가입했다면 카카오 설정에서 연결을 끊으면 계정이 지워져요"를 적을 수 있다. 앱 어드민 키로 요청 출처를 검증(카카오 문서 기준), 회원번호는 로그에 남기지 않는다.
- 어르신 익명 기기: 메일·회원번호가 없어 **본인 확인 수단이 없다**. 연결된 어르신은 자녀 계정으로 찾는다(자녀 메일로 가족을 찾고, 어르신 프로필은 `admin_delete_account(어르신 profile)` — 요청자가 그 가족의 자녀인지 확인한 뒤). 연결 전 익명 기기는 지울 대상을 특정할 수 없으므로 ①의 90일 자동 정리로 처리하고, 삭제 안내에 그렇게 적는다.
- 구현 범위(결정 시): 마이그레이션 1(admin_find_user, 출력 열 최소) + ops 스크립트 1 + (b)를 고르면 Edge Function 1·카카오 콘솔 설정(사용자). pgTAP은 "메일·회원번호 전체가 반환값에 없음"을 고정.

## 20. 쓰기 RPC 재시도(같은 요청 두 번) 표 — 앱 fetch 시간 제한(쓰기 15초) 대비(11-20)
배경: 앱이 쓰기 요청에 시간 제한을 두면, 서버는 처리했는데 응답만 늦은 POST를 사용자가 "다시 하기"로 한 번 더 보낼 수 있다. 앱(`app/src`)이 부르는 쓰기 RPC 전부를 main의 최신 정의로 읽었다(읽기 전용 RPC 제외).
판정: **멱등** = 두 번째 호출이 상태를 더 바꾸지 않고 같은(또는 같은 뜻의) 답 / **응답만 다름** = 상태는 그대로인데 답이 달라 앱이 실패로 볼 수 있음 / **중복** = 상태가 한 번 더 바뀜.

| RPC(최신 정의) | 두 번째 호출 결과 | 판정 | SQL 근거 |
|---|---|---|---|
| `send_cheer`(0020) | **응원 행이 하나 더 생김**(하루 2개 한도까지) → 어르신에게 응원·알림이 두 번 | **중복** | `insert into cheers … values (…, clock_timestamp())` — 중복을 막는 키 없음, 한도 검사(`count >= 2`)만 |
| `create_family`(0003) | 예외 `already_has_profile` — 첫 요청이 가족을 만들었는데 앱은 실패로 봄 | 응답만 다름 | `if exists (select 1 from profiles where user_id = v_uid) then raise exception 'already_has_profile'` |
| `delete_my_account`(0049→0054·0058 공통 함수) | 첫 호출이 인증 계정까지 지웠으므로 `my_profile_id()` null → `user_delete_core`가 null(계정 없음) → `{scope:'none'}` | 응답만 다름(상태 그대로) | `if v_me is not null …; v_res := user_delete_core(auth.uid()); … return {scope:'none'}` — JWT는 만료 전까지 유효. 앱 `deleteMyAccount`는 반환값을 쓰지 않아 영향 없음 |
| `log_event`(0053) | 이벤트 행이 하나 더 | 중복(지표만) | `insert into events …` 키 없음. 기기당 하루 200개 상한만 |
| `issue_invite_code`(0025) | 앞 번호를 만료시키고 **새 번호** 발급 | 상태 바뀜(무해) | 일반 번호: 같은 가족의 미사용 번호 `expires_at`를 과거로 → 새 번호 insert. 첫 응답을 못 받았으면 앞 번호는 화면에 없었으므로 실제 피해 없음 |
| `dev_reset_today`(0051) | 지울 것이 없어 0·0, 감사 행 1개 더 | 멱등(감사 행만 +1) | `delete … where session_date = today`, 감사 insert. staging 전용 |
| `save_answer`(0052) | 같은 답으로 덮어쓰기(`answered_at`만 갱신), 첫 답 알림 큐 없음 | 멱등 | `on conflict (parent_id, question_id, session_date) do update set choice = excluded.choice …`, `returning (xmax = 0)`이 false라 큐 안 넣음 |
| `record_session_step`(0024) | 단계 합집합·시간 최댓값, `completed_at`은 처음 한 번만 | 멱등 | `completed_steps = array_agg(distinct …)`, `duration_sec = greatest(…)`, `completed_at is null`일 때만 |
| `start_today`(0024) | 오늘 이미 넘긴 커서는 다시 안 넘김, `advanced=false` | 멱등 | `advance_content_cursor`: `content_seq_date is distinct from today`일 때만 전진, 세션 `on conflict` |
| `redeem_invite_code`(0028) | 같은 번호를 이미 이 uid가 썼고 프로필이 있으면 같은 가족·프로필로 ok | 멱등(설계됨) | `if exists (… code = p_code and used_by = v_uid and used_at is not null) … return {ok, family_id, profile_id}` — 실패 시도로 세지 않음 |
| `record_terms_agreement`(0048) | `recorded=false`(새 행 없음) | 멱등 | `on conflict (user_id, terms_version, privacy_version) do nothing` |
| `give_consent`(0035) | 같은 버전이면 아무것도 안 함 | 멱등 | `if v_prev_at is not null and v_prev_ver is not distinct from p_version then return` |
| `withdraw_consent`(0019) | 지울 답 없음, 철회 이력은 이미 철회 상태라 안 남김 | 멱등 | `if v_prev_at is not null then insert consent_events …` |
| `mark_cheers_read`(0020) | 0개 갱신 | 멱등 | `where read_at is null` |
| `set_parent_title`·`set_parent_title_for`(0035) | 같은 값으로 갱신, 겹침 검사는 자기 자신 제외라 통과 | 멱등 | `update … set parent_title = p_title`, `p.id <> p_parent` |
| `set_push_enabled`(0037) | 받기 시각 유지 | 멱등 | `push_consented_at = coalesce(push_consented_at, now())` |
| `register_push_token`(0036) | 같은 토큰 갱신 | 멱등 | `on conflict (token) do update` |
| `unregister_push_token`(0032) | `removed: 0` | 멱등 | `delete … where token = p_token` |
| `discard_anonymous_session`(0058) | 계정이 이미 없어 `discarded:false` | 응답만 다름(상태 그대로) | `not exists (select 1 from auth.users where id = v_uid and is_anonymous)` → false. 앱은 이어서 소셜 로그인 |

### 고칠 방향(제안)
1. **`send_cheer` — 서버 수정 필요(별도 마이그레이션 PR, 리뷰 2명)**: 클라이언트 요청 id.
   - `send_cheer(p_parent, p_key, p_request_id uuid default null)`. 앱은 사용자가 응원 버튼을 누를 때 uuid를 한 번 만들고, 시간 초과로 다시 보낼 때 **같은 id**를 쓴다.
   - `cheers.request_id uuid` + 유일 인덱스 `(from_child, request_id) where request_id is not null`. 같은 id가 이미 있으면 새로 넣지 않고 그 응원의 `{ok:true, cheer_id}`를 돌려준다(한도 검사보다 먼저 확인 — 두 번째 호출이 `daily_limit`으로 실패해 보이지 않게).
   - id를 안 보내는 옛 앱은 지금과 같다(하위 호환). 앱 줄: U10 대기 뒤 보낼 때 id 생성·재시도 때 재사용.
2. **`create_family` — 서버 수정(같은 PR)**: 호출자가 이미 **자녀 프로필**을 가졌으면 예외 대신 그 가족·프로필 id를 돌려준다(`{family_id, profile_id}` 같은 모양). 어르신 프로필이면 지금처럼 `already_has_profile`.
3. **`delete_my_account`·`discard_anonymous_session` — 앱 처리로 충분**: 재시도 응답이 `{scope:'none'}`·`{discarded:false}`여도 상태는 첫 호출대로다. 앱은 삭제 재시도 뒤 응답 값으로 화면을 바꾸지 말고 "지웠어요"로 처리(이미 `deleteMyAccount`는 반환값을 안 씀).
4. **`log_event` — 앱에서 재시도하지 않기**: 측정은 실패해도 화면을 막지 않는 계약이라(0022) 시간 초과 때 다시 보내지 않는 것이 가장 단순. 서버 키는 넣지 않는다(지표 오차는 작음).
5. **`issue_invite_code` — 수용**: 재시도로 새 번호가 나와도 앞 번호는 화면에 나온 적이 없다. 다만 앱이 첫 응답을 이미 그렸는데 늦게 실패로 처리하는 구조라면 번호가 바뀐다 → 앱은 번호를 그린 뒤에는 재시도하지 않는다.

## 21. pgTAP 헛통과 전수 점검 — 앱 역할로 표를 직접 세는 단언(11-20, '헛통과 테스트 → 실패 확인' 규칙)
배경: #218 실패 확인에서 `create_family` 재시도의 가족 수를 앱 역할(authenticated)로 세 RLS 때문에 중복이 안 보여 늘 통과하던 단언을 찾았다(→ `reset role` 뒤에 세도록 고침). 같은 모양을 `supabase/tests` 전체에서 찾았다.
방법: 줄마다 현재 역할(`pg_temp.act_as`·`set local role`·`reset role`)을 따라가며, 앱 역할(authenticated·anon)에서 `public` 표를 직접 `count(*)`·`exists`로 세는 단언 25개를 뽑았다(함수 반환값을 세는 단언은 제외). "없음(0)"을 기대하는 부작용 확인은 고장을 넣어 실제로 실패하는지 봤다(공유 로컬 DB 한 트랜잭션 → rollback, 고장은 커밋 안 함).

| 분류 | 단언(파일:줄) | 판정 |
|---|---|---|
| RLS 확인 자체(앱 역할에서 이렇게 보여야 함) | `rls` 54·55·57·70·74·94·95, `rpc_privacy` 46·47·51·52, `rpc_privacy_review` 31·37, `rpc_cheers` 51, `rpc_redeem` 73, `push_tokens` 30, `security_hardening` 44 (17개) | 의도대로 — `-- rls:의도 RLS 확인` 표시 |
| 부작용 "없음" 확인 | `rpc_family` 59 '만료된 코드는 정리된다' | **실패 확인: `issue_invite_code`의 만료 코드 삭제를 빼면 → `not ok 11 - 만료된 코드는 정리된다`(have 1, want 0)** — 같은 가족 번호는 RLS로 보여 헛통과 아님 |
| 부작용 "없음" 확인 | `rpc_privacy` 70 '철회하면 저장된 답이 지워진다' | **실패 확인: `withdraw_consent`의 답 삭제를 빼면 → `not ok 17 - 철회하면 저장된 답이 지워진다`(have 1, want 0)** — 본인 답은 동의 여부와 무관하게 RLS로 보여 헛통과 아님 |
| 부작용 "N개" 확인(양수 기대) | `rpc_family` 27·28·44·62, `rpc_content` 48, `rpc_redeem` 48 | 빠지면 0이 되어 실패, 같은 가족·본인 범위의 중복도 RLS로 보여 실패 — 헛통과 아님(표시만) |
| 이미 고침 | `rpc_family` 가족 수(#218, 56c78455) | `reset role` 뒤에 셈. 실패 확인: 재시도 분기가 가족을 새로 만들면 → `not ok 5`(have 2, want 1) |

결론: 이번 점검에서 새 헛통과는 없다(#218의 1건뿐). 고친 테스트 코드 없음 — 표시 주석만 추가.

**결정적 검사(구현)**: `supabase/ops/test-rls-lint.mjs` — 앱 역할 상태에서 `public` 표를 직접 세는 단언에 `reset role`이 앞에 없고 줄 끝 `-- rls:의도` 표시도 없으면 실패. `replay-check.sh`가 스택을 띄우기 전에 먼저 돌린다(바로 실패). 단위 테스트 `node --test supabase/ops/test-rls-lint.test.mjs`(#218 모양을 잡는지 포함).
- 새 단언을 쓸 때: 서버가 만든·지운 행(부작용)을 세려면 `reset role;` 뒤에서 센다. 앱에서 이렇게 보여야 한다는 RLS 확인이면 줄 끝에 `-- rls:의도 <이유>`.
- (#219 리뷰 반영) `-- rls:의도` 뒤에 **이유 글이 없으면 위반**(무엇을 확인하는지: 예 `남의 가족 답 0행`). 단언은 세미콜론까지 모아 한 문장으로 보므로 여러 줄 단언도 잡는다. `set role X`(local 없음)와, 이 파일에서 `set role`·`set local role`을 실행하는 pg_temp 도우미(이름 무관)를 부르면 앱 역할로 본다.
- CI: `.github/workflows/server.yml` pgTAP 잡이 `supabase test db` 전에 `node supabase/ops/test-rls-lint.mjs supabase/tests`를 돈다.
- (#219 2차 리뷰 L, 넓힘) `count(1)`·`count(열)`도, 스키마를 생략한 `from 표`(함수 호출·`pg_` 카탈로그·그 파일의 임시 표 제외)도, 결과 집합 단언(`results_eq`·`results_ne`·`set_eq`·`set_ne`·`bag_eq`·`bag_ne`·`is_empty`·`isnt_empty`·`row_eq`)과 `isnt`도 대상이다.
- 남은 한계: pg_temp 도우미 함수 **안에서** 표를 세는 경우(단언은 `pg_temp.f()`만 부름)는 대상 밖 — 그런 도우미는 `reset role` 뒤에서 부른다.
