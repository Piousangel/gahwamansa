-- 0041 응원·연결 알림 리뷰 낮음 반영(docs/team/reviews/2026-11-18-push-events-review.md L1·L4·L5; L3 잠금 화면 숨김은 앱 AU-04 채널 몫, L2는 ops 스크립트)
-- L1 push_events_kick: 문구(push_copy)가 있는 종류만 할 일로 센다(문구 적재 전 5분마다 빈 호출 방지).
--    직전 응원·연결 실행이 dry-run(서비스 계정 없음)이면 1시간 쉰다(Edge가 dry-run을 push_runs.note='dry_run'으로 남김).
-- (추가) child_summary.parents[].connected_date: 어르신이 처음 연결된 날(KST, 프로필 생성일). 자녀 C4 호칭 겹침 시트에서 "11월 12일에 연결한 분"처럼 구분(재연결해도 그대로).
-- L4 push_events_claim: 연결 알림은 큐의 어르신 프로필이 남아 있을 때만(어르신 삭제 경합 시 "연결됐어요" 오발송 방지). 큐 행은 어느 쪽이든 처리 표시.

create or replace function public.push_events_claim(p_now timestamptz default now()) returns jsonb
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

  return jsonb_build_object('window_open', true, 'targets', v_targets);
end $$;

create or replace function public.push_events_kick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheer boolean := exists (select 1 from public.push_copy where kind = 'cheer_arrived');
  v_conn boolean := exists (select 1 from public.push_copy where kind = 'parent_connected')
                    and exists (select 1 from public.push_copy where kind = 'parent_reconnected');
begin
  if not (extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20) then
    return jsonb_build_object('status', 'outside_window');
  end if;
  if not ((v_cheer and exists (select 1 from public.cheers where notified_at is null and sent_at >= p_now - interval '3 days'))
          or (v_conn and exists (select 1 from public.notification_queue where sent_at is null and created_at >= p_now - interval '3 days'))) then
    return jsonb_build_object('status', 'nothing_to_send');
  end if;
  if (select note from public.push_runs
       where kind in ('cheer_arrived', 'parent_connected', 'parent_reconnected') and run_at <= p_now
       order by run_at desc, id desc limit 1) = 'dry_run'
     and exists (select 1 from public.push_runs
                  where kind in ('cheer_arrived', 'parent_connected', 'parent_reconnected') and note = 'dry_run'
                    and run_at > p_now - interval '1 hour' and run_at <= p_now) then
    return jsonb_build_object('status', 'throttled');
  end if;
  return public.push_kick('push-events');
end $$;

-- child_summary(0027) + connected_date
create or replace function public.child_summary() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_title text;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  select f.parent_title into v_title from public.families f where f.id = v_family;
  return jsonb_build_object(
    'parent_title', v_title,
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, v_title),
        'connected', p.user_id is not null,
        'connected_date', (p.created_at at time zone 'Asia/Seoul')::date, -- 0041: 처음 연결된 날(KST), 호칭이 겹칠 때 구분용
        'shared', p.consented_at is not null,
        'latest', case when p.consented_at is null then null else (
          select jsonb_build_object(
            'prompt', q.prompt,
            'choice_label', case a.choice when 'A' then q.option_a else q.option_b end,
            'starter', case a.choice when 'A' then q.starter_a else q.starter_b end,
            'answered_date', a.session_date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id
          order by a.session_date desc, a.answered_at desc limit 1) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = v_family and p.role = 'parent'), '[]'::jsonb));
end $$;
