-- 0052 자녀에게 '첫 답' 알림(사용자 결정 DECISIONS 11-19, U11 예외): 연결 뒤 어르신의 첫 답 때 자녀마다 평생 1회.
-- 답 내용·시각은 넣지 않는다(문구 자리값은 {호칭}만). 새 알림 종류 parent_first_answer(채널 family). 문구 원본은 라이터(copy.ko.json push.first_answer),
--   push_copy에 load-push-copy.mjs로 적재(금지어 검사 push_text_clean 제약 그대로). 문구가 없으면 큐를 소비하지 않는다(다른 종류와 같음).
-- 흐름: save_answer가 **새 답**(같은 날 같은 질문 고치기 아님)을 넣을 때, 아직 첫 답 알림을 받지 않은 자녀가 그 가족에 있고
--   같은 종류의 미처리 큐가 없으면 notification_queue에 'parent_first_answer' 한 줄(payload {parent_id}만). 심사 가족은 넣지 않는다.
--   push_events_claim(창 08~20시 KST)이 큐를 소비하며, 어르신이 지금도 동의 중일 때만(철회면 아무에게도 안 보내고 기록도 안 남김),
--   아직 기록 없는 자녀마다 first_answer_notices에 한 줄(자녀 PK = 평생 1회, 동시 실행은 on conflict로 한 번만):
--     받을 수 있으면(push_reachable: 알림 켬·받기 동의 시각·토큰 연결·심사 아님) 'sent' → 대상, 아니면 'skipped'(그 첫 답은 지나감 — 나중에 켜도 다시 안 보냄).
--   형제 자녀가 나중에 연결되면 그 자녀는 기록이 없으므로, 연결 뒤 어르신의 다음 새 답이 그 자녀의 '첫 답' 알림이 된다.
-- 표 first_answer_notices: 앱·anon·서비스 역할 접근 불가(definer 함수만). 자녀 프로필이 지워지면 함께 지워진다.

alter table public.notification_queue drop constraint notification_queue_kind_check,
  add constraint notification_queue_kind_check check (kind in ('parent_connected', 'parent_first_answer'));
alter table public.push_copy drop constraint push_copy_kind_check,
  add constraint push_copy_kind_check check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer'));
alter table public.push_log drop constraint push_log_kind_check,
  add constraint push_log_kind_check check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer'));
alter table public.push_claims drop constraint push_claims_kind_check,
  add constraint push_claims_kind_check check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer'));

create table public.first_answer_notices (
  child_id uuid primary key references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  status text not null check (status in ('sent', 'skipped')),
  created_at timestamptz not null default now()
);
alter table public.first_answer_notices enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.first_answer_notices from public, anon, authenticated, service_role;

-- save_answer(0014) + 첫 답 큐
create or replace function public.save_answer(p_question uuid, p_choice text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_new boolean;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = v_me for update; -- 철회와 직렬화
  if not public.my_consented() then raise exception 'consent_required'; end if;
  if p_choice is null or p_choice not in ('A', 'B') then raise exception 'invalid_choice'; end if;
  insert into public.answers (family_id, parent_id, question_id, choice, session_date)
  values (v_family, v_me, p_question, p_choice, public.kst_today())
  on conflict (parent_id, question_id, session_date) do update set choice = excluded.choice, answered_at = now()
  returning (xmax = 0) into v_new; -- true = 새 답(고치기 아님)
  if v_new
     and not exists (select 1 from public.families f where f.id = v_family and f.is_review)
     and exists (select 1 from public.profiles c where c.family_id = v_family and c.role = 'child'
                  and not exists (select 1 from public.first_answer_notices n where n.child_id = c.id))
     and not exists (select 1 from public.notification_queue q where q.family_id = v_family and q.kind = 'parent_first_answer' and q.sent_at is null) then
    insert into public.notification_queue (family_id, kind, payload) values (v_family, 'parent_first_answer', jsonb_build_object('parent_id', v_me));
  end if;
end $$;

-- push_record(0036) + 새 종류
create or replace function public.push_record(p_kind text, p_results jsonb, p_excluded int default 0, p_now timestamptz default now(), p_note text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_res jsonb := coalesce(p_results, '[]'::jsonb);
  v_sent int; v_failed int; v_invalid int;
  v_note text := p_note;
begin
  if p_kind is null or p_kind not in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer') then
    raise exception 'invalid_kind';
  end if;
  if jsonb_typeof(v_res) <> 'array'
     or exists (select 1 from jsonb_array_elements(v_res) r where coalesce(r ->> 'status', '') not in ('sent', 'failed', 'invalid_token')) then
    raise exception 'invalid_status';
  end if;
  select count(*) filter (where r ->> 'status' = 'sent'), count(*) filter (where r ->> 'status' = 'failed'),
         count(*) filter (where r ->> 'status' = 'invalid_token')
    into v_sent, v_failed, v_invalid
    from jsonb_array_elements(v_res) r;

  insert into public.push_log (kind, sent_on, profile_id, status)
  select p_kind, v_today, (r ->> 'profile_id')::uuid, r ->> 'status'
    from jsonb_array_elements(v_res) r
   where exists (select 1 from public.profiles p where p.id = (r ->> 'profile_id')::uuid);

  -- 무효가 많으면(5개 이상·절반 초과) 설정 오류로 보고 토큰을 지우지 않는다
  if v_invalid >= 5 and v_invalid * 2 > jsonb_array_length(v_res) then
    v_note := coalesce(v_note || ',', '') || 'invalid_ratio_hold';
  else
    delete from public.device_tokens dt
     using jsonb_array_elements(v_res) r
     where r ->> 'status' = 'invalid_token' and dt.token = r ->> 'token';
  end if;

  update public.push_claims c
     set status = case when exists (select 1 from jsonb_array_elements(v_res) r
                                     where (r ->> 'profile_id')::uuid = c.profile_id and r ->> 'status' = 'sent') then 'sent' else 'failed' end
   where c.kind = p_kind and c.sent_on = v_today and c.status = 'pending'
     and c.profile_id in (select (r ->> 'profile_id')::uuid from jsonb_array_elements(v_res) r);

  insert into public.push_runs (kind, run_at, targets, sent, failed, invalid, excluded, note)
  values (p_kind, p_now, jsonb_array_length(v_res), v_sent, v_failed, v_invalid, coalesce(p_excluded, 0), left(v_note, 40));
  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'invalid', v_invalid, 'note', v_note);
end $$;

-- push_events_claim(0041) + N4 첫 답
create or replace function public.push_events_claim(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_cheer public.push_copy%rowtype;
  v_conn public.push_copy%rowtype;
  v_reconn public.push_copy%rowtype;
  v_first public.push_copy%rowtype;
  v_targets jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if not v_open then
    return jsonb_build_object('window_open', false, 'targets', '[]'::jsonb);
  end if;
  select * into v_cheer from public.push_copy where kind = 'cheer_arrived';
  select * into v_conn from public.push_copy where kind = 'parent_connected';
  select * into v_reconn from public.push_copy where kind = 'parent_reconnected';
  select * into v_first from public.push_copy where kind = 'parent_first_answer';

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
        join public.profiles par on par.id = d.parent_id and par.family_id = d.family_id -- L4: 어르신이 남아 있을 때만
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

  -- N4 첫 답(0052) → 아직 첫 답 알림 기록이 없는 자녀. 어르신이 지금도 동의 중일 때만. 문구가 있을 때만 소비.
  if v_first.kind is not null then
    with done as (
      update public.notification_queue set sent_at = p_now
       where sent_at is null and kind = 'parent_first_answer'
      returning family_id, (payload ->> 'parent_id')::uuid as parent_id),
    cand as (
      select distinct on (c.id) c.id as child_id, c.user_id, d.family_id,
             coalesce(par.parent_title, f.parent_title) as title, public.push_reachable(c.id) as reach
        from done d
        join public.families f on f.id = d.family_id and not f.is_review
        join public.profiles par on par.id = d.parent_id and par.family_id = d.family_id and par.role = 'parent'
                                and par.consented_at is not null -- 동의 철회면 보내지 않음(기록도 안 남김)
        join public.profiles c on c.family_id = d.family_id and c.role = 'child'
       where not exists (select 1 from public.first_answer_notices n where n.child_id = c.id)
       order by c.id, d.parent_id),
    ins as (
      insert into public.first_answer_notices (child_id, family_id, status)
      select child_id, family_id, case when reach then 'sent' else 'skipped' end from cand
      on conflict (child_id) do nothing
      returning child_id, status)
    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', cand.child_id, 'token', dt.token, 'platform', dt.platform,
             'kind', 'parent_first_answer', 'channel', public.push_channel('parent_first_answer'),
             'title', public.push_render(v_first.title, jsonb_build_object('호칭', cand.title)),
             'body', public.push_render(v_first.body, jsonb_build_object('호칭', cand.title)))
             order by cand.child_id, dt.token), '[]'::jsonb)
      into v_part
      from ins
      join cand on cand.child_id = ins.child_id
      join public.device_tokens dt on dt.user_id = cand.user_id
     where ins.status = 'sent';
    v_targets := v_targets || v_part;
  end if;

  return jsonb_build_object('window_open', true, 'targets', v_targets);
end $$;

-- push_events_kick(0041) + 첫 답 큐
create or replace function public.push_events_kick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheer boolean := exists (select 1 from public.push_copy where kind = 'cheer_arrived');
  v_conn boolean := exists (select 1 from public.push_copy where kind = 'parent_connected')
                    and exists (select 1 from public.push_copy where kind = 'parent_reconnected');
  v_first boolean := exists (select 1 from public.push_copy where kind = 'parent_first_answer');
begin
  if not (extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20) then
    return jsonb_build_object('status', 'outside_window');
  end if;
  if not ((v_cheer and exists (select 1 from public.cheers where notified_at is null and sent_at >= p_now - interval '3 days'))
          or exists (select 1 from public.notification_queue q
                      where q.sent_at is null and q.created_at >= p_now - interval '3 days'
                        and ((q.kind = 'parent_connected' and v_conn) or (q.kind = 'parent_first_answer' and v_first)))) then
    return jsonb_build_object('status', 'nothing_to_send');
  end if;
  if (select note from public.push_runs
       where kind in ('cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer') and run_at <= p_now
       order by run_at desc, id desc limit 1) = 'dry_run'
     and exists (select 1 from public.push_runs
                  where kind in ('cheer_arrived', 'parent_connected', 'parent_reconnected', 'parent_first_answer') and note = 'dry_run'
                    and run_at > p_now - interval '1 hour' and run_at <= p_now) then
    return jsonb_build_object('status', 'throttled');
  end if;
  return public.push_kick('push-events');
end $$;
