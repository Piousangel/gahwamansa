-- 3일 시나리오 빈틈 H3(오너 11-25) 확인 시험 (pgTAP): 21시 이후 생긴 응원·첫 답 알림은 버리지 않고 다음 창(KST 08:00)까지 미룬다.
-- 동작은 바꾸지 않는다(0038·0041·0052 그대로) — 지금 동작을 고정한다. 실행: npx supabase test db
-- 보호하는 것: 창 = KST 08:00~20:59(21:00·07:59는 닫힘, 08:00·20:59는 열림), 창 밖에서는 선점하지 않고(큐·응원 그대로) 5분 cron도 함수를 부르지 않음,
--             다음 날 08:00 첫 실행에서 밤사이 응원·첫 답이 함께 나감, 3일이 지난 것은 보내지 않고 처리 표시만.
begin;
select plan(14);
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.notification_queue; delete from public.cheers; delete from public.push_copy; delete from public.cheer_texts;
delete from public.push_runs; delete from public.first_answer_notices;

insert into auth.users (id, aud, role, is_anonymous) values
  ('7b210000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('7b210000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values ('7b21f000-0000-0000-0000-000000000001', '7b210000-0000-0000-0000-0000000000c1', '부모님');
insert into public.profiles (id, user_id, family_id, role, consented_at, parent_title, push_enabled, push_consented_at) values
  ('7b21b000-0000-0000-0000-0000000000c1', '7b210000-0000-0000-0000-0000000000c1', '7b21f000-0000-0000-0000-000000000001', 'child', null, null, true, now() - interval '5 days'),
  ('7b21b000-0000-0000-0000-0000000000a1', '7b210000-0000-0000-0000-0000000000a1', '7b21f000-0000-0000-0000-000000000001', 'parent', now() - interval '5 days', '엄마', true, now() - interval '5 days');
insert into public.device_tokens (user_id, token) values
  ('7b210000-0000-0000-0000-0000000000c1', 'h3_c1_000000000000000001'),
  ('7b210000-0000-0000-0000-0000000000a1', 'h3_a1_000000000000000001');
insert into public.push_copy (kind, title, body, body_fallback, body_many) values
  ('cheer_arrived', '가족이 보낸 응원이 왔어요', '{응원}', null, '응원이 {n}개 왔어요'),
  ('parent_connected', '{호칭} 폰과 연결됐어요', '고른 답을 보여 줄지는 {호칭}께서 정해요', null, null),
  ('parent_reconnected', '{호칭} 폰과 다시 연결됐어요', '새 폰으로 이어졌어요. 지난 답은 그대로 있어요', null, null),
  ('parent_first_answer', '{호칭}께서 답을 고르셨어요', '앨범에서 보고 이야기해 볼까요?', null, null);
insert into public.cheer_texts (message_key, text) values ('love_you', '사랑해요, 오늘도 좋은 하루예요');

-- 어제(KST) 21:30에 딸이 보낸 응원, 21:40에 어르신 첫 답(큐), 그리고 4일 전 응원(정리 대상)
create function pg_temp.kst(p_day date, p_hhmm text) returns timestamptz language sql as $$
  select (p_day::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;
create function pg_temp.yesterday() returns date language sql as $$ select public.kst_today() - 1 $$;
create function pg_temp.today() returns date language sql as $$ select public.kst_today() $$;
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('7b21f000-0000-0000-0000-000000000001', '7b21b000-0000-0000-0000-0000000000c1', '7b21b000-0000-0000-0000-0000000000a1', 'love_you', pg_temp.kst(pg_temp.yesterday(), '21:30')),
  ('7b21f000-0000-0000-0000-000000000001', '7b21b000-0000-0000-0000-0000000000c1', '7b21b000-0000-0000-0000-0000000000a1', 'love_you', pg_temp.kst(pg_temp.today() - 4, '10:00'));
insert into public.notification_queue (family_id, kind, payload, created_at) values
  ('7b21f000-0000-0000-0000-000000000001', 'parent_first_answer', jsonb_build_object('parent_id', '7b21b000-0000-0000-0000-0000000000a1'),
   pg_temp.kst(pg_temp.yesterday(), '21:40'));

create function pg_temp.mine(p jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('to', t ->> 'profile_id', 'kind', t ->> 'kind', 'body', t ->> 'body') order by t ->> 'kind'), '[]'::jsonb)
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '7b21b000%'
$$;
create function pg_temp.pending() returns int language sql as $$
  select (select count(*)::int from public.cheers where to_parent::text like '7b21b000%' and notified_at is null)
       + (select count(*)::int from public.notification_queue where family_id = '7b21f000-0000-0000-0000-000000000001' and sent_at is null)
$$;

-- 창 경계: 20:59 열림, 21:00 닫힘, 07:59 닫힘, 08:00 열림(KST)
select is(public.push_events_claim(pg_temp.kst(pg_temp.yesterday(), '21:00')) ->> 'window_open', 'false', '21:00(KST)은 창 밖');
select is(public.push_events_claim(pg_temp.kst(pg_temp.yesterday(), '23:55')) ->> 'window_open', 'false', '밤(23:55)은 창 밖');
select is(public.push_events_claim(pg_temp.kst(pg_temp.today(), '07:59')) ->> 'window_open', 'false', '07:59(KST)는 창 밖');
select is(pg_temp.pending(), 3, '창 밖에서는 응원·첫 답을 선점하지 않는다 — 버리지 않고 그대로 기다린다');
select is(public.push_events_kick(pg_temp.kst(pg_temp.yesterday(), '21:00')) ->> 'status', 'outside_window', '21시 이후 5분 cron은 함수를 부르지 않는다');
select is(public.push_events_kick(pg_temp.kst(pg_temp.today(), '07:59')) ->> 'status', 'outside_window', '07:59 cron도 부르지 않는다');
select is(public.push_events_kick(pg_temp.kst(pg_temp.today(), '08:00')) ->> 'status', 'not_configured',
  '08:00 cron은 밤사이 쌓인 할 일을 보고 함수를 부르려 한다(설정이 없는 시험 DB라 not_configured)');

-- 다음 날 08:00 첫 실행: 밤사이 응원 1개(문장)와 자녀 첫 답이 함께 나가고, 4일 전 응원은 보내지 않고 처리만
create temp table claimed as select public.push_events_claim(pg_temp.kst(pg_temp.today(), '08:00')) j;
select is((select j ->> 'window_open' from claimed), 'true', '08:00(KST)은 창 안');
select is(pg_temp.mine((select j from claimed)),
  jsonb_build_array(
    jsonb_build_object('to', '7b21b000-0000-0000-0000-0000000000a1', 'kind', 'cheer_arrived', 'body', '사랑해요, 오늘도 좋은 하루예요'),
    jsonb_build_object('to', '7b21b000-0000-0000-0000-0000000000c1', 'kind', 'parent_first_answer', 'body', '앨범에서 보고 이야기해 볼까요?')),
  '전날 21시 이후 응원·첫 답은 다음 날 08:00에 한 번씩 나간다(3일 지난 응원은 빠짐)');
select is(pg_temp.pending(), 0, '나간 것과 3일 지난 것은 처리 표시 — 다시 나가지 않는다');
select is(pg_temp.mine(public.push_events_claim(pg_temp.kst(pg_temp.today(), '08:05'))), '[]'::jsonb, '08:05 두 번째 실행은 같은 알림을 다시 보내지 않는다');
select is((select status from public.first_answer_notices where child_id = '7b21b000-0000-0000-0000-0000000000c1'), 'claimed', '첫 답은 자녀에게 한 번(claimed)으로 기록');

-- 20:59 경계: 창 안
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('7b21f000-0000-0000-0000-000000000001', '7b21b000-0000-0000-0000-0000000000c1', '7b21b000-0000-0000-0000-0000000000a1', 'love_you', pg_temp.kst(pg_temp.today(), '20:50'));
select is(public.push_events_claim(pg_temp.kst(pg_temp.today(), '20:59')) ->> 'window_open', 'true', '20:59(KST)는 창 안');
select is(pg_temp.pending(), 0, '20:59에 생긴 응원은 그때 바로 나간다');

select * from finish();
rollback;
