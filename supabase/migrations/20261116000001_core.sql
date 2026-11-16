-- 0001 core: 테이블. 설계 근거: docs/team/dev.md §2, docs/plans/01-build-plan.md
create extension if not exists pgcrypto with schema extensions;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- 어르신 신원 = profiles.id (안정). auth uid는 폰 교체 시 바뀌므로 user_id를 재바인딩한다.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  display_name text check (char_length(display_name) <= 20),
  course_start_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  consented_at timestamptz, -- 어르신이 "자녀에게 공개"에 동의한 시각. null이면 답변 저장 불가
  created_at timestamptz not null default now()
);
create index on public.profiles (family_id);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code char(6) not null check (code ~ '^[0-9]{6}$'),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  target_profile_id uuid references public.profiles(id), -- not null이면 "기존 어르신 재연결" 코드
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users(id)
);
create unique index invite_codes_active_code on public.invite_codes (code) where used_at is null;
create index on public.invite_codes (family_id, used_at);

-- 무차별 대입 방어 로그 (클라이언트 접근 불가: RLS 정책 없음)
create table public.redeem_attempts (
  id bigserial primary key,
  uid uuid not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index on public.redeem_attempts (uid, at desc);
create index on public.redeem_attempts (at) where not ok;

create table public.content_photos (
  id uuid primary key default gen_random_uuid(),
  day_index int not null unique check (day_index between 1 and 30),
  image_url text not null,
  caption text not null,
  keyword text not null
);

create table public.content_questions (
  id uuid primary key default gen_random_uuid(),
  day_index int not null unique check (day_index between 1 and 30),
  option_a text not null,
  option_b text not null
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.content_questions(id),
  choice char(1) not null check (choice in ('A', 'B')),
  answered_at timestamptz not null default now(),
  unique (parent_id, question_id)
);
create index on public.answers (family_id, answered_at desc);

create table public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade, -- RLS 단순화용 비정규화
  parent_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null, -- 서버가 KST로 계산
  completed_steps text[] not null default '{}' check (completed_steps <@ array['photo', 'question', 'hangul']),
  duration_sec int not null default 0 check (duration_sec between 0 and 7200),
  completed_at timestamptz, -- 3단계 모두 끝난 첫 시각
  unique (parent_id, session_date)
);
create index on public.daily_sessions (family_id, session_date desc);

create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_child uuid not null references public.profiles(id),
  to_parent uuid not null references public.profiles(id),
  message_key text not null check (message_key ~ '^[a-z_]{1,32}$'), -- 문구 목록은 앱 쪽 문구 표
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.cheers (to_parent, sent_at desc);

create table public.plans (
  id text primary key,
  name text not null,
  price_krw int check (price_krw >= 0)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  plan_id text not null references public.plans(id),
  source text not null check (source in ('free_period', 'toss', 'naver', 'kakao', 'manual')),
  valid_until timestamptz, -- null = 무기한
  created_at timestamptz not null default now()
);
create index on public.entitlements (family_id, valid_until);

-- 푸시 토큰 (승인됨: FCM 서버 푸시)
create table public.device_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

insert into public.plans (id, name, price_krw) values ('free', '무료', 0), ('premium', '프리미엄', null); -- 가격 미확정
