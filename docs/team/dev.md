# dev.md: 풀스택 설계 (가화만사성) · 2026-11-16 · 설계 문서(코드 미생성)
가정: 가족 1개에 자녀 1명 이상, 어르신 1명 이상. 사용자는 가족 1개에만 속함. 1인 개발, Android 먼저. 인터넷 조회를 하지 않았으므로 **모든 라이브러리 버전은 "버전 미확인"**(착수 시 npm에서 최신 안정판 확인).
## 1. 아키텍처
```
App(RN CLI, TS) --supabase-js--> Supabase: Auth(익명+카카오) / Postgres+RLS+RPC / Edge Function(푸시) / pg_cron
                 <--FCM--------- Edge Function (서비스 계정 키는 Supabase secrets, 값은 사용자가 주입)
src/
  app/        App.tsx, navigation/(RootNavigator, ParentStack, ChildTabs), providers/
  features/   auth/(kakaoLogin, anonSession, useSession)  link/(EnterCode, Consent, IssueCode, linkApi=RPC 래퍼)
              course/(PhotoStep, QuestionStep, HangulStep, courseApi)  home/(ChildHome, StreakBadge, CheerPicker)
              report/(ReportScreen, ComingSoonBadge)  push/(fcm, tokenSync)
  modules/    payment/(PaymentProvider, entitlements, FreeProvider)  tts/speak.ts(실패 시 무음 폴백)  time/kst.ts(표시용)
  lib/        supabase.ts, queryClient.ts, analytics.ts, types/db.ts (supabase gen types)
  ui/         BigButton, Text20, tokens.ts   (글자 20sp 이상, 버튼 64 이상)
supabase/     migrations/(0001_core 0002_rls 0003_rpc 0004_seed + 각 down)  tests/rls.test.sql(pgTAP)  functions/send-daily-push/
```
| 영역 | 선택 | 이유 | 대안 1개 |
|---|---|---|---|
| 서버 상태 | TanStack Query (버전 미확인) | 캐시·재시도·포커스 시 refetch로 "1분 내 반영" 충족 | SWR (모바일 포커스 훅 직접 구성 필요) |
| 클라 상태 | Zustand (버전 미확인) | 세션·UI 상태 소량, 보일러플레이트 적음 | Redux Toolkit (1인 개발에 과함) |
| 네비게이션 | @react-navigation/native + native-stack (버전 미확인) | RN CLI 표준, 역할별 스택 분기 쉬움 | react-native-navigation(Wix) (네이티브 설정 부담) |
| 백엔드 SDK | @supabase/supabase-js + AsyncStorage + react-native-url-polyfill | 공식 RN 방식 | 직접 REST (타입·세션 갱신 직접 구현) |
| TTS | react-native-tts (유지보수 상태 미확인) | 기기 내장 TTS, 무료·오프라인 | 사전 녹음/생성 mp3 + react-native-sound. 한국어 TTS 엔진이 없는 저가 기기에 안전, 콘텐츠 90개 분량이라 대안도 현실적 |
| 푸시 | @react-native-firebase/app + messaging (버전 미확인) | FCM 공식 래퍼, Android 13+ 권한 처리 | OneSignal (외부 의존 추가) |
| 카카오 | @react-native-seoul/kakao-login (버전 미확인) → id token → `signInWithIdToken({provider:'kakao'})` | 앱 내 SDK 로그인으로 UX 단순 | `signInWithOAuth` + 딥링크(브라우저 경유). OIDC 활성화 필요 여부와 Supabase의 kakao id token 지원은 **미확인**이므로 1단계에서 먼저 검증, 막히면 대안으로 |
| 테스트 | Jest + RNTL, pgTAP(`supabase test db`, 로컬 Docker) | RLS는 DB에서 직접 검증이 가장 확실 | Jest에서 supabase-js로 로컬 스택 호출 (RPC 통합 테스트에 병행) |
결정: **연속일은 카운터 컬럼 없이 `daily_sessions`에서 계산**(멱등성의 핵심, 5절). 쓰기는 가능한 한 RPC로 모은다.
## 2. 데이터 모델 SQL (0001_core.sql)
```sql
create extension if not exists pgcrypto with schema extensions;

create table families (id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
-- 어르신 신원 = profiles.id (안정). auth uid는 폰 교체 시 바뀌므로 user_id를 재바인딩한다.
create table profiles (id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null, -- 사용자는 프로필 1개
  family_id uuid not null references families(id) on delete cascade,
  role text not null check (role in ('parent','child')), display_name text check (char_length(display_name) <= 20),
  course_start_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  consented_at timestamptz,  -- 어르신 공개 동의 시각
  created_at timestamptz not null default now());
create index on profiles(family_id);
create table invite_codes (id uuid primary key default gen_random_uuid(),
  code char(6) not null check (code ~ '^[0-9]{6}$'),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid not null references profiles(id),
  target_profile_id uuid references profiles(id), -- not null이면 "기존 어르신 재연결" 코드
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz, used_by uuid references auth.users(id));
create unique index invite_codes_active_code on invite_codes(code) where used_at is null;
create index on invite_codes(family_id, used_at);
create table redeem_attempts (id bigserial primary key,  -- 무차별 대입 방어 로그 (클라이언트 접근 불가)
  uid uuid not null, ok boolean not null, at timestamptz not null default now());
create index on redeem_attempts(uid, at desc);
create index on redeem_attempts(at) where not ok;
create table content_photos (id uuid primary key default gen_random_uuid(),
  day_index int not null unique check (day_index between 1 and 30),
  image_url text not null, caption text not null, keyword text not null);
create table content_questions (id uuid primary key default gen_random_uuid(),
  day_index int not null unique check (day_index between 1 and 30), option_a text not null, option_b text not null);
create table answers (id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  parent_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references content_questions(id),
  choice char(1) not null check (choice in ('A','B')), answered_at timestamptz not null default now(),
  unique (parent_id, question_id));  -- 같은 질문 중복 답변 방지
create index on answers(family_id, answered_at desc);
create table daily_sessions (id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade, -- RLS 단순화용 비정규화
  parent_id uuid not null references profiles(id) on delete cascade,
  session_date date not null,  -- 서버가 KST로 계산
  completed_steps text[] not null default '{}' check (completed_steps <@ array['photo','question','hangul']),
  duration_sec int not null default 0 check (duration_sec between 0 and 7200),
  completed_at timestamptz,  -- 3단계 모두 끝난 첫 시각
  unique (parent_id, session_date));  -- 멱등성의 근거
create index on daily_sessions(family_id, session_date desc);
create table cheers (id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  from_child uuid not null references profiles(id), to_parent uuid not null references profiles(id),
  message_key text not null check (message_key ~ '^[a-z_]{1,32}$'), -- 문구 목록은 앱 i18n
  sent_at timestamptz not null default now(), read_at timestamptz);
create index on cheers(to_parent, sent_at desc);
create table plans (id text primary key, name text not null, price_krw int check (price_krw >= 0));
create table entitlements (id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade, plan_id text not null references plans(id),
  source text not null check (source in ('free_period','toss','naver','kakao','manual')),
  valid_until timestamptz,  -- null = 무기한
  created_at timestamptz not null default now());
create index on entitlements(family_id, valid_until);
-- SPEC 목록 밖 추가 제안: 푸시 토큰 (없으면 FCM 발송 불가)
create table device_tokens (user_id uuid not null references auth.users(id) on delete cascade,
  token text not null, platform text not null default 'android',
  updated_at timestamptz not null default now(), primary key (user_id, token));
insert into plans values ('free','무료',0),('premium','프리미엄',null); -- 가격 미확정(3,900원 가정)
```
down: 각 마이그레이션마다 `drop table ... cascade` 역순 파일을 함께 둔다(SPEC 롤백 규칙).

## 3. RLS SQL (0002_rls.sql)
```sql
-- 헬퍼: RLS 재귀를 피하려고 security definer. search_path 고정 필수.
create function my_profile_id() returns uuid language sql stable security definer set search_path='' as $$ select id from public.profiles where user_id = auth.uid() $$;
create function my_family_id() returns uuid language sql stable security definer set search_path='' as $$ select family_id from public.profiles where user_id = auth.uid() $$;
create function my_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where user_id = auth.uid() $$;
revoke all on all tables in schema public from anon;   -- 로그인 전 접근 전면 차단
do $$ declare t text; begin
  foreach t in array array['families','profiles','invite_codes','redeem_attempts','content_photos',
    'content_questions','answers','daily_sessions','cheers','plans','entitlements','device_tokens']
  loop execute format('alter table public.%I enable row level security', t); end loop; end $$;
-- 쓰기 정책이 없는 테이블은 클라이언트가 쓸 수 없다(기본 거부). 익명 로그인 사용자도 role=authenticated임에 유의.
-- 같은 가족 구성원만 가족/프로필 조회 (쓰기는 RPC만)
create policy families_read on families for select to authenticated using (id = my_family_id());
create policy profiles_read on profiles for select to authenticated using (family_id = my_family_id());
-- 자녀만 자기 가족 코드 목록 조회(어르신은 코드 못 봄). 발급·사용은 RPC. redeem_attempts는 정책 없음 = 전면 거부
create policy codes_read on invite_codes for select to authenticated using (family_id = my_family_id() and my_role() = 'child');
-- 콘텐츠·플랜: 로그인 사용자 읽기 전용 (쓰기 정책 없음, 입력은 마이그레이션/서비스 롤)
create policy photos_read on content_photos for select to authenticated using (true);
create policy questions_read on content_questions for select to authenticated using (true);
create policy plans_read on plans for select to authenticated using (true);
-- 답변: 가족만 읽되 어르신은 본인 것만, 자녀는 가족 전체. 쓰기는 어르신 본인만, 수정·삭제 불가
create policy answers_read on answers for select to authenticated
  using (family_id = my_family_id() and (my_role() = 'child' or parent_id = my_profile_id()));
create policy answers_insert on answers for insert to authenticated
  with check (my_role() = 'parent' and parent_id = my_profile_id() and family_id = my_family_id());
-- 세션: 가족만 읽기, 쓰기는 record_session_step RPC만 (직접 쓰기 정책 없음)
create policy sessions_read on daily_sessions for select to authenticated
  using (family_id = my_family_id() and (my_role() = 'child' or parent_id = my_profile_id()));
-- 응원: 자녀는 가족 어르신에게만 보내기, 어르신은 자기에게 온 것만 읽고 read_at만 수정
create policy cheers_read on cheers for select to authenticated
  using (family_id = my_family_id() and (my_role() = 'child' or to_parent = my_profile_id()));
create policy cheers_insert on cheers for insert to authenticated
  with check (my_role() = 'child' and from_child = my_profile_id() and family_id = my_family_id()
    and exists (select 1 from profiles p where p.id = to_parent and p.family_id = my_family_id() and p.role='parent'));
revoke update on cheers from authenticated;
grant update (read_at) on cheers to authenticated;
create policy cheers_mark_read on cheers for update to authenticated
  using (to_parent = my_profile_id()) with check (to_parent = my_profile_id());
-- 권한: 가족 구성원이 읽기, 쓰기는 서비스 롤(결제 웹훅)/seed만
create policy ent_read on entitlements for select to authenticated using (family_id = my_family_id());
-- 푸시 토큰: 내 것만
create policy tokens_own on device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```
주의: 자녀가 어르신 답변을 읽는 것은 의도(리포트). 동의(`consented_at`)는 RPC `give_consent()`로 기록하고, 자녀 조회를 동의한 어르신으로 제한하는 `exists` 조건은 5단계 이후 추가(초안 생략, 위험 5).

## 4. 초대 코드 흐름 (0003_rpc.sql)
공통: 모든 RPC는 `security definer set search_path=''`, `revoke execute ... from public, anon; grant execute to authenticated`. 자녀 가입 시 `create_family()` RPC가 families·profiles(child)·무료 기간 entitlements 행을 한 트랜잭션으로 만든다.
**발급 `issue_invite_code(p_target uuid default null) returns text`** (자녀만)
```sql
-- 의사코드
require my_role()='child'; if p_target is not null: require 같은 family의 parent
delete from invite_codes where expires_at < now() and used_at is null;  -- 만료분 정리(유니크 충돌 방지)
require count(active codes of family) < 5                                 -- 남발 방지
loop 최대 5회: code := lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint) % 1000000)::text, 6,'0')
  insert ... on conflict do nothing → 성공 시 return code   -- 암호학적 난수, 활성 코드끼리 유일
raise 'code_generation_failed'
```
**사용 `redeem_invite_code(p_code text) returns jsonb`** (익명 로그인 기기만)
핵심: 실패 기록이 롤백되면 시도 제한이 무력해지므로 **실패는 예외(raise)가 아니라 `{ok:false, reason}` 반환**으로 처리해 `redeem_attempts` insert를 커밋한다.
```sql
-- 의사코드 (한 트랜잭션)
uid := auth.uid(); if not (auth.jwt()->>'is_anonymous')::boolean → {ok:false, reason:'not_parent_device'}
if count(fail where uid=uid and at > now()-'10 min') >= 5          → {reason:'rate_limited', retry_after_sec}
if count(fail where at > now()-'10 min') >= 300                    → {reason:'busy'}   -- 전역 상한(DoS 트레이드오프)
if p_code !~ '^[0-9]{6}$'                                          → log fail, {reason:'invalid'}
select * from invite_codes where code=p_code and used_at is null ... for update  -- 동시 사용 방지
  없음(또는 이미 used) → log fail, {reason:'invalid' | 'used'}
  expires_at < now()   → log fail, {reason:'expired'}
if profile of uid exists and family != code.family                  → {reason:'already_linked'}
if target_profile_id is not null: update profiles set user_id = uid where id = target   -- 재연결: 기록 유지
else insert profiles(user_id=uid, family_id, role='parent')
update invite_codes set used_at=now(), used_by=uid
log ok; return {ok:true, family_id, profile_id}
```
reason은 앱이 어르신용 문장으로 변환("코드가 맞지 않아요. 자녀분께 새 코드를 받아 주세요"). 앱은 reason을 그대로 노출하지 않는다.
**방어 계산(가정)**: 활성 코드 A개일 때 1회 추측 적중 확률 = A/1,000,000. uid당 10분 5회 실패 제한만으로는 익명 계정 무한 생성으로 우회되므로 ①전역 실패 상한 ②Supabase 익명 로그인의 IP당 속도 제한과 CAPTCHA(설정값 **미확인**, 대시보드에서 확인) ③코드 7일 만료·1회용을 겹쳐 쓴다. 전역 상한 초과 시 정상 어르신도 막히는 DoS는 MVP에서 수용(알림은 위험 목록).

**재연결**: ①새 폰(재설치 포함)은 새 익명 uid로 시작 → ②자녀가 앱에서 "기존 어르신 다시 연결"로 `issue_invite_code(p_target=어르신 profile id)` → ③어르신이 코드 입력 → 같은 `profiles.id`에 `user_id`만 교체되므로 answers·daily_sessions(둘 다 `parent_id=profiles.id`)가 그대로 유지. 이전 uid는 끊김(구 폰은 접근 불가, 분실 폰 보호에도 유리). 구 익명 uid는 주기 작업으로 정리. Android 자동 백업이 세션 토큰을 복원할 수 있는지는 **미확인** → 세션 저장소를 백업 제외 설정하고 실기기 확인.

## 5. 하루 세션과 연속일
**시간대: Asia/Seoul 고정, 날짜는 서버에서 계산.** 이유: ①대상 사용자 전원이 한국 ②기기 시계·시간대 조작/해외 체류로 날짜가 흔들리는 것을 막음 ③푸시 발송 시각(KST 오전)과 날짜 기준 일치 ④"자정에 바뀌는 오늘의 추억"이 어르신 직관과 맞음. 단점: 자정 직후 하던 코스는 다음 날로 넘어감(수용, 3단계는 하루 안에 끝나는 분량).
```sql
create function record_session_step(p_step text, p_duration int) returns jsonb  -- 어르신만
language plpgsql security definer set search_path='' as $$
declare v_today date := (now() at time zone 'Asia/Seoul')::date; v_me uuid := public.my_profile_id(); ...
begin  -- my_role()='parent'·p_step 허용값 확인, duration은 0~7200로 clamp
  insert into public.daily_sessions(family_id, parent_id, session_date, completed_steps, duration_sec)
  values (public.my_family_id(), v_me, v_today, array[p_step], p_duration)
  on conflict (parent_id, session_date) do update set
    completed_steps = (select array_agg(distinct s) from unnest(daily_sessions.completed_steps || p_step) s),
    duration_sec = least(7200, greatest(daily_sessions.duration_sec, excluded.duration_sec)),
    completed_at = coalesce(daily_sessions.completed_at,
      case when cardinality(<병합된 steps>) = 3 then now() end);  -- 최초 1회만 기록
  return jsonb_build_object('completed', ..., 'streak', public.parent_streak(v_me));
end $$;
```
**멱등성**: 같은 날 행은 `unique(parent_id, session_date)`로 1개, 단계는 집합 병합, `completed_at`은 coalesce로 불변. 연속일은 저장하지 않고 계산하므로 두 번 완료해도 증가할 곳이 없다.
```sql
create function parent_streak(p_parent uuid) returns int language sql stable security invoker as $$  -- RLS 적용
  with d as (select session_date from daily_sessions where parent_id = p_parent and completed_at is not null),
  g as (select session_date, session_date - (row_number() over (order by session_date))::int as k from d)
  select case when (select max(session_date) from d) >= (now() at time zone 'Asia/Seoul')::date - 1
    then (select count(*)::int from g where k = (select k from g order by session_date desc limit 1)) else 0 end $$;
```
오늘 안 했어도 어제까지 이어졌으면 연속일 유지(하루 유예). 오늘의 콘텐츠: `day_index = ((today - course_start_date) % 30) + 1`.
자녀 홈 반영(1분): 홈 포커스 시 refetch + 선택적으로 Realtime(daily_sessions 구독, RLS가 적용됨, 설정 **미확인**) 중 하나로 시작하고 폴링 30초를 폴백으로 둔다.

## 6. 모듈 경계 (타입만)
```ts
// modules/payment/PaymentProvider.ts
export type PlanId = 'free' | 'premium';
export type EntitlementSource = 'free_period' | 'toss' | 'naver' | 'kakao' | 'manual';
export interface Entitlement { familyId: string; planId: PlanId; source: EntitlementSource; validUntil: string | null }
export interface CheckoutResult { status: 'success' | 'cancelled' | 'failed'; providerRef?: string }
export interface PaymentProvider { readonly name: EntitlementSource;
  startCheckout(input: { familyId: string; planId: PlanId }): Promise<CheckoutResult>;
  restore(familyId: string): Promise<void>; } // 서버가 entitlements를 갱신, 클라는 재조회
// modules/payment/entitlements.ts
export type Feature = 'basic_report' | 'detail_report' | 'topic_suggestion';
export const FEATURE_MIN_PLAN: Record<Feature, PlanId> = { basic_report: 'free', detail_report: 'premium', topic_suggestion: 'premium' };
export const COMING_SOON_PAID: ReadonlySet<Feature> = new Set(['detail_report', 'topic_suggestion']); // "곧 유료" 배지
export type Access = { allowed: boolean; comingSoonBadge: boolean };
export declare function resolveAccess(feature: Feature, ents: Entitlement[], now: Date): Access;
export declare function useFeature(feature: Feature): Access; // 화면은 이것만 호출, 결제사를 모름
```
원칙: 무료 기간은 가족 생성 시 `source='free_period', plan='premium', valid_until=<출시 설정일>` 행으로 표현해 "모든 기능 열림"과 "곧 유료 배지"를 동시에 만족. 유료 전환 때 새 데이터가 아니라 `valid_until`만 바꿈. 영수증 검증과 entitlements 쓰기는 서비스 롤 Edge Function에서만. 구현은 `FreeProvider`(no-op)만 두고 토스·네이버·카카오는 전환 시 추가.
## 7. 구현 순서 (시간은 모두 추정, 합계는 SPEC 8절 약 65h와 같은 규모)
| # | 단계 | 끝났다는 증거 | 추정 |
|---|---|---|---|
| 1 | RN CLI 셋업 + 로컬 Supabase + 카카오 로그인 사전 검증 | 실기기에서 카카오 로그인 후 `auth.users`에 행 생김(막히면 OAuth 대안 결정 기록), 타입체크·린트 통과 | 5h |
| 2 | 스키마 마이그레이션 + 시드 콘텐츠 3일분 | `supabase db reset` 성공, down 실행 후 재적용 성공, gen types 산출 | 3h |
| 3 | RLS + 헬퍼 + pgTAP | 다른 가족 answers 조회 0행, 자녀 insert 거부 테스트 초록 (완료 조건 3) | 4h |
| 4 | 자녀 가입(가족·프로필 생성 RPC) + 코드 발급 | 로그인 직후 가족 생성, 발급 코드가 6자리·7일·활성 유일(DB 확인) | 4h |
| 5 | 어르신 익명 로그인 + redeem + 재연결 | 두 기기에서 코드 입력 5초 내 연결, 만료·사용·5회 실패 잠금 각각 문장 확인, 재연결 후 기존 답변 유지 (조건 1·2) | 8h |
| 6 | 어르신 코스 3화면 + TTS + 동의 화면 | 실기기에서 3단계 완주, 글자 20sp·버튼 3개 이하 눈으로 확인(조건 6), TTS 불가 기기에서도 진행 | 14h |
| 7 | record_session_step + 연속일 | 같은 날 2회 완료해도 streak 동일(단위·pgTAP), 어제 완료 시 2 (조건 4·5) | 3h |
| 8 | 자녀 홈·응원·리포트 + 권한 게이트(useFeature) | 어르신 완료 후 1분 안에 자녀 홈 반영, "곧 유료" 배지 노출, 무료 기간 전부 열림 (조건 4·9) | 10h |
| 9 | FCM 토큰 저장 + 일일 푸시(Edge Function + pg_cron) | 허용 기기 수신, 거절 기기에서 오류 없이 동작 (조건 7) | 5h |
| 10 | 콘텐츠 30/30/30 입력 + 문구 점검 | 각 30행 존재, 앱 문구 grep으로 "치매 예방/치료" 0건 (조건 8) | 10h |
| 11 | 통합 점검·릴리스 빌드·스토어 자료 | 전 완료 조건 체크리스트 통과, 릴리스 APK 실기기 설치 | 12h |
각 단계는 직전 단계 산출물만 쓰며 단계 3 이후 RLS 테스트를 CI에서 계속 실행. (각 단계는 직전 산출물만 사용)
## 8. 테스트 계획
- **RLS 자동화(pgTAP, `supabase test db`)**: 시드로 가족 A·B(자녀1, 어르신1씩) 생성 → `set local role authenticated; set local request.jwt.claims = '{"sub":"<uid>","is_anonymous":true}'`로 신원 전환. 검증: A 어르신·자녀가 B의 answers/daily_sessions/cheers/profiles/entitlements 0행; A 자녀의 answers insert 거부; A 어르신이 B의 parent_id로 insert 거부; 콘텐츠 insert/update 거부; anon 롤 전 테이블 거부; cheers에서 어르신이 read_at 외 컬럼 update 거부; 어르신끼리 서로의 answers 비공개. 정책 추가 시 "테이블 목록 대비 RLS 활성 여부" 쿼리로 누락 방지(`pg_class.relrowsecurity`).
- **RPC 통합(Jest + 로컬 스택)**: 코드 만료(시간 조작은 `expires_at` 직접 갱신), 재사용, 5회 실패 잠금, 동시 redeem 2건 중 1건만 성공, 재연결 시 기록 유지, record_session_step 2회 호출 시 streak 동일, KST 자정 경계(21:00 UTC 전후).
- **단위(Jest)**: `resolveAccess`(무료 기간·만료·플랜별), redeem reason → 어르신 문장 매핑, 오늘 day_index 계산, TTS 실패 폴백, 푸시 거절 시 no-throw. 완료 조건 10의 타입체크·린트·테스트는 `npm run verify` 한 명령으로 묶는다(스크립트명은 제안).
## 9. 위험·미확인
1. 모든 라이브러리 버전·유지보수 상태 미확인(특히 react-native-tts, kakao-login RN 모듈, RN 최신 버전 호환). Supabase kakao id token 지원·OIDC 설정, 익명 로그인 IP 제한값·CAPTCHA 범위도 미확인.
2. Play 개발자 계정: 본인 확인 미완료, 12명 14일 비공개 테스트 규칙 가능성 → 11월 공개 출시 어려울 수 있음(progress.md 기록과 동일). 이 설계는 영향받지 않으나 일정은 영향.
3. 전역 실패 상한 300회/10분, uid당 5회는 임의 가정값. 공격 시 정상 어르신도 막힘 → 알림 필요. 4. 어르신 동의(`consented_at`)와 자녀 조회 연동은 초안 정책에 미반영(5단계 이후). 답변이 민감정보에 해당하는지는 법률 검토 미확인.
5. device_tokens는 SPEC 데이터 모델에 없는 추가 테이블(승인 필요). 이벤트 분석 저장소(자체 테이블 vs 외부 도구)는 미결정(단계 8 전 결정).
6. 분실 폰의 어르신 세션은 코드 재연결 전까지 유효(자녀의 연결 해제 기능은 MVP 밖). 유료 정책(Play 결제·외부 결제 허용 조건)은 미확인, 전환 직전 확인.
7. Android 자동 백업의 세션 복원 여부, TTS 엔진 부재 기기 비율 미확인(저가 기기 실측 필요).
