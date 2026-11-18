-- 0038 응원 도착(N2)·연결/재연결(N3) 알림 발송 + 확정 문구 자리값(로드맵 SV-03, 결정 U11: 자녀 즉시 알림은 연결·응원 관련만, 부모님 답 알림 없음)
-- 문구: docs/team/copy.ko.json push.*(WR-02)는 {설명}·{응원}·{n}·{호칭} 자리값을 쓴다 → push_copy에 템플릿 그대로 넣고 서버가 대상마다 채운다.
--   push_copy.body_fallback(채울 값이 없을 때, 예: daily "편할 때 열어 보세요"), body_many(여러 개일 때, 예: "응원이 {n}개 왔어요").
--   응원 문장(cheers 4개)은 cheer_texts(message_key → 문장). 둘 다 서비스 역할이 supabase/ops/load-push-copy.mjs로 copy.ko.json에서 넣는다(법률 리뷰 뒤).
-- 채널(앱 AU-04가 같은 id로 만든다): daily → 'daily', cheer_arrived → 'cheer', parent_connected·parent_reconnected → 'family'.
-- 대상:
--   N2 응원 도착 → 받는 어르신만. 처리 안 된 응원(cheers.notified_at null)을 어르신별로 묶어 1개면 그 문장, 여러 개면 개수.
--   N3 연결·재연결 → 그 가족 자녀 전원(notification_queue 0028, 재연결이면 다시 연결 문구). 제목·본문의 {호칭} = 그 어르신 호칭(없으면 가족 호칭).
--   공통: 알림 켬 + 알림 받기 시각(push_consented_at) + 심사 가족 아님 + 토큰 있음. 연결 끊김 알림(push.disconnected)은 발생 지점이 없어 이번 범위 밖.
-- 시간: KST 08:00~20:59에만 선점·발송. 밤에 생긴 응원·연결은 아침까지 기다린다. 3일 지난 것은 보내지 않고 처리 표시만.
-- 한 번만: 선점 시점에 cheers.notified_at·notification_queue.sent_at을 찍는다(발송 실패해도 다시 보내지 않음, 일일 알림 선점과 같은 원칙).
-- 실행: cron 'push-events' 5분마다 → push_events_kick()이 창 안이고 할 일이 있을 때만 Edge Function `push-events`를 부른다.

alter table public.push_copy
  add column body_fallback text check (char_length(body_fallback) between 1 and 60),
  add column body_many text check (char_length(body_many) between 1 and 60);

create table public.cheer_texts (
  message_key text primary key check (message_key in ('love_you', 'warm_day', 'thanks_always', 'peaceful_day')),
  text text not null check (char_length(text) between 1 and 60),
  updated_at timestamptz not null default now()
);
alter table public.cheer_texts enable row level security;
revoke all on public.cheer_texts from public, anon, authenticated;

alter table public.cheers add column notified_at timestamptz;
create index cheers_unnotified_idx on public.cheers (sent_at) where notified_at is null;
create index notification_queue_unsent_idx on public.notification_queue (created_at) where sent_at is null;

-- 자리값 채우기: {키}를 값으로. 남은 자리값이 있으면 p_fallback(없으면 자리값만 지움)
create function public.push_render(p_template text, p_vars jsonb, p_fallback text default null) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := p_template;
  r record;
begin
  if v is null then return p_fallback; end if;
  for r in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    if r.value is not null then v := replace(v, '{' || r.key || '}', r.value); end if;
  end loop;
  if v ~ '\{[^}]*\}' then
    return coalesce(p_fallback, nullif(btrim(regexp_replace(v, '\{[^}]*\}', '', 'g')), ''));
  end if;
  return v;
end $$;
revoke execute on function public.push_render(text, jsonb, text) from public, anon, authenticated;

create function public.push_channel(p_kind text) returns text
language sql immutable set search_path = ''
as $$ select case p_kind when 'daily' then 'daily' when 'cheer_arrived' then 'cheer' else 'family' end $$;
revoke execute on function public.push_channel(text) from public, anon, authenticated;

-- 알림을 받을 수 있는 사람(공통 조건, 역할 무관)
create function public.push_reachable(p_profile uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p join public.families f on f.id = p.family_id
                  where p.id = p_profile and p.user_id is not null and p.push_enabled and p.push_consented_at is not null
                    and not f.is_review)
$$;
revoke execute on function public.push_reachable(uuid) from public, anon, authenticated;

-- 일일 알림 선점(0036) + 대상별 제목·본문({설명} = 그 어르신의 오늘 사진 설명)·종류·채널
create or replace function public.push_daily_claim(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_copy public.push_copy%rowtype;
  v_claimed uuid[];
  v_targets jsonb;
begin
  select * into v_copy from public.push_copy where kind = 'daily';
  if v_open and v_copy.kind is not null then
    with ins as (
      insert into public.push_claims (kind, sent_on, profile_id)
      select 'daily', v_today, e from public.push_daily_eligible(v_today) e
      on conflict do nothing
      returning profile_id)
    select coalesce(array_agg(profile_id), '{}') into v_claimed from ins;
  else
    v_claimed := '{}';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', p.id, 'token', dt.token, 'platform', dt.platform, 'kind', 'daily', 'channel', public.push_channel('daily'),
           'title', public.push_render(v_copy.title, '{}'::jsonb),
           'body', public.push_render(v_copy.body, jsonb_build_object('설명', ph.caption), v_copy.body_fallback))
         order by p.id, dt.token), '[]'::jsonb)
    into v_targets
    from public.profiles p
    join public.device_tokens dt on dt.user_id = p.user_id
    left join public.content_photos ph on ph.day_index =
      case when p.content_seq is not null and p.content_seq_date = v_today then p.content_seq
           else public.content_next_day(p.content_seq) end
   where p.id = any (v_claimed);
  return jsonb_build_object(
    'window_open', v_open,
    'copy', case when v_copy.kind is null then null else jsonb_build_object('title', v_copy.title, 'body', v_copy.body) end,
    'targets', v_targets,
    'excluded', (select count(*)::int from public.profiles p join public.families f on f.id = p.family_id
                  where p.role = 'parent' and not f.is_review) - cardinality(v_claimed));
end $$;

-- 응원 도착·연결 알림 선점: 창 안이면 처리할 것을 표시하고, 받을 수 있는 사람의 토큰마다 채운 문구를 돌려준다
create function public.push_events_claim(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_cheer public.push_copy%rowtype;
  v_conn public.push_copy%rowtype;
  v_reconn public.push_copy%rowtype;
  v_targets jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if not v_open then
    return jsonb_build_object('window_open', false, 'targets', '[]'::jsonb);
  end if;
  select * into v_cheer from public.push_copy where kind = 'cheer_arrived';
  select * into v_conn from public.push_copy where kind = 'parent_connected';
  select * into v_reconn from public.push_copy where kind = 'parent_reconnected';

  -- 3일 지난 것은 보내지 않고 처리 표시만
  update public.cheers set notified_at = p_now where notified_at is null and sent_at < p_now - interval '3 days';
  update public.notification_queue set sent_at = p_now where sent_at is null and created_at < p_now - interval '3 days';

  -- N2 응원 도착(문구가 있을 때만 소비)
  if v_cheer.kind is not null then
    with done as (
      update public.cheers set notified_at = p_now
       where notified_at is null
      returning to_parent, message_key, sent_at),
    per as (
      select to_parent, count(*)::int as n, (array_agg(message_key order by sent_at desc))[1] as last_key from done group by to_parent)
    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', per.to_parent, 'token', dt.token, 'platform', dt.platform, 'kind', 'cheer_arrived', 'channel', public.push_channel('cheer_arrived'),
             'title', public.push_render(v_cheer.title, '{}'::jsonb),
             'body', case when per.n = 1 and ct.text is not null then public.push_render(v_cheer.body, jsonb_build_object('응원', ct.text))
                          else public.push_render(v_cheer.body_many, jsonb_build_object('n', per.n), null) end)
             order by per.to_parent, dt.token), '[]'::jsonb)
      into v_part
      from per
      join public.profiles p on p.id = per.to_parent and p.role = 'parent'
      join public.device_tokens dt on dt.user_id = p.user_id
      left join public.cheer_texts ct on ct.message_key = per.last_key
     where public.push_reachable(per.to_parent);
    v_targets := v_targets || v_part;
  end if;

  -- N3 연결·재연결 → 그 가족 자녀(문구 둘 다 있을 때만 소비)
  if v_conn.kind is not null and v_reconn.kind is not null then
    with done as (
      update public.notification_queue set sent_at = p_now
       where sent_at is null and kind = 'parent_connected'
      returning family_id, (payload ->> 'parent_id')::uuid as parent_id, coalesce((payload ->> 'reconnect')::boolean, false) as reconnect),
    t as (
      select d.reconnect, c.id as child_id, dt.token, dt.platform,
             coalesce(par.parent_title, f.parent_title) as title
        from done d
        join public.families f on f.id = d.family_id and not f.is_review
        left join public.profiles par on par.id = d.parent_id
        join public.profiles c on c.family_id = d.family_id and c.role = 'child'
        join public.device_tokens dt on dt.user_id = c.user_id
       where public.push_reachable(c.id))
    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', t.child_id, 'token', t.token, 'platform', t.platform,
             'kind', case when t.reconnect then 'parent_reconnected' else 'parent_connected' end,
             'channel', public.push_channel('parent_connected'),
             'title', public.push_render(case when t.reconnect then v_reconn.title else v_conn.title end, jsonb_build_object('호칭', t.title)),
             'body', public.push_render(case when t.reconnect then v_reconn.body else v_conn.body end, jsonb_build_object('호칭', t.title)))
             order by t.child_id, t.token), '[]'::jsonb)
      into v_part
      from t;
    v_targets := v_targets || v_part;
  end if;

  return jsonb_build_object('window_open', true, 'targets', v_targets);
end $$;

-- 내부: Vault 설정으로 Edge Function 호출
create function public.push_kick(p_function text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
  v_req bigint;
begin
  if p_function not in ('push-daily', 'push-events') then raise exception 'invalid_function'; end if;
  if v_url is null or v_secret is null then return jsonb_build_object('status', 'not_configured'); end if;
  select net.http_post(
           url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
           body := '{}'::jsonb,
           timeout_milliseconds := 60000)
    into v_req;
  return jsonb_build_object('status', 'requested', 'request_id', v_req);
end $$;

-- cron(5분): 창 안이고 보낼 것이 있을 때만 호출(빈 호출로 비용을 쓰지 않게)
create function public.push_events_kick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not (extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20) then
    return jsonb_build_object('status', 'outside_window');
  end if;
  if not exists (select 1 from public.cheers where notified_at is null and sent_at >= p_now - interval '3 days')
     and not exists (select 1 from public.notification_queue where sent_at is null and created_at >= p_now - interval '3 days') then
    return jsonb_build_object('status', 'nothing_to_send');
  end if;
  return public.push_kick('push-events');
end $$;

revoke execute on function public.push_events_claim(timestamptz), public.push_kick(text), public.push_events_kick(timestamptz)
  from public, anon, authenticated;
grant execute on function public.push_events_claim(timestamptz), public.push_events_kick(timestamptz) to service_role;

select cron.schedule('push-events', '*/5 * * * *', 'select public.push_events_kick()');
