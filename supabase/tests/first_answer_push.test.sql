-- 0052 테스트 (pgTAP): 자녀 '첫 답' 알림(DECISIONS 11-19, U11 예외). 실행: npx supabase test db
-- 보호하는 것: 연결 뒤 어르신의 첫 새 답 때 자녀마다 평생 1회(두 번째 답·다른 어르신의 첫 답에는 없음), 답 내용·시각은 문구에 없음,
--             자녀가 알림을 껐거나 받기 동의가 없으면 보내지 않고 그 첫 답은 지나감, 어르신이 동의를 철회했으면 보내지 않음(기록도 안 남김),
--             나중에 연결된 형제 자녀는 다음 새 답 때 1회, 다른 가족 무영향, 같은 날 답 고치기는 새 답이 아님, 5분 cron이 첫 답 큐를 할 일로 셈.
begin;
select plan(18);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;
delete from public.notification_queue; delete from public.cheers; delete from public.push_copy; delete from public.push_runs;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70520000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 받음
  ('70520000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 알림 끔
  ('70520000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', false), -- 받기 동의 없음
  ('70520000-0000-0000-0000-0000000000c4', 'authenticated', 'authenticated', false), -- 나중에 연결되는 형제
  ('70520000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70520000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70520000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', false), -- 다른 가족 자녀
  ('70520000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true),  -- 다른 가족 어르신(답 안 함)
  ('70520000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', false), -- 철회 가족 자녀
  ('70520000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true);  -- 철회 가족 어르신
insert into public.families (id, created_by, parent_title) values
  ('70520000-0000-0000-0000-0000000000f1', '70520000-0000-0000-0000-0000000000c1', '부모님'),
  ('70520000-0000-0000-0000-0000000000f2', '70520000-0000-0000-0000-0000000000d1', '부모님'),
  ('70520000-0000-0000-0000-0000000000f3', '70520000-0000-0000-0000-0000000000e1', '부모님');
insert into public.profiles (id, user_id, family_id, role, consented_at, parent_title, push_enabled, push_consented_at) values
  ('70520000-0000-0000-0000-00000000c001', '70520000-0000-0000-0000-0000000000c1', '70520000-0000-0000-0000-0000000000f1', 'child', null, null, true, now()),
  ('70520000-0000-0000-0000-00000000c002', '70520000-0000-0000-0000-0000000000c2', '70520000-0000-0000-0000-0000000000f1', 'child', null, null, false, now()),
  ('70520000-0000-0000-0000-00000000c003', '70520000-0000-0000-0000-0000000000c3', '70520000-0000-0000-0000-0000000000f1', 'child', null, null, true, null),
  ('70520000-0000-0000-0000-00000000a001', '70520000-0000-0000-0000-0000000000a1', '70520000-0000-0000-0000-0000000000f1', 'parent', now(), '엄마', true, now()),
  ('70520000-0000-0000-0000-00000000a002', '70520000-0000-0000-0000-0000000000a2', '70520000-0000-0000-0000-0000000000f1', 'parent', now(), '아빠', true, now()),
  ('70520000-0000-0000-0000-00000000d001', '70520000-0000-0000-0000-0000000000d1', '70520000-0000-0000-0000-0000000000f2', 'child', null, null, true, now()),
  ('70520000-0000-0000-0000-00000000b001', '70520000-0000-0000-0000-0000000000b1', '70520000-0000-0000-0000-0000000000f2', 'parent', now(), null, true, now()),
  ('70520000-0000-0000-0000-00000000e001', '70520000-0000-0000-0000-0000000000e1', '70520000-0000-0000-0000-0000000000f3', 'child', null, null, true, now()),
  ('70520000-0000-0000-0000-00000000e0a1', '70520000-0000-0000-0000-0000000000a9', '70520000-0000-0000-0000-0000000000f3', 'parent', now(), null, true, now());
insert into public.device_tokens (user_id, token) values
  ('70520000-0000-0000-0000-0000000000c1', 'fa52_c1_00000000000001'), ('70520000-0000-0000-0000-0000000000c2', 'fa52_c2_00000000000001'),
  ('70520000-0000-0000-0000-0000000000c3', 'fa52_c3_00000000000001'), ('70520000-0000-0000-0000-0000000000c4', 'fa52_c4_00000000000001'),
  ('70520000-0000-0000-0000-0000000000d1', 'fa52_d1_00000000000001'), ('70520000-0000-0000-0000-0000000000e1', 'fa52_e1_00000000000001');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('70520000-0000-0000-0000-00000000d0d1', 1, '가을', '봄', 'q1'), ('70520000-0000-0000-0000-00000000d0d2', 2, '바다', '산', 'q2'),
  ('70520000-0000-0000-0000-00000000d0d3', 3, '국수', '밥', 'q3');
-- 라이터 확정 문구(11-19, copy.ko.json push.first_answer → load-push-copy로 적재). 길이·금지어 제약을 통과해야 들어간다.
insert into public.push_copy (kind, title, body) values ('parent_first_answer', '{호칭}께서 첫 답을 고르셨어요', '앨범에서 보고 이야기해 볼까요?');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
-- 창 안(KST 오늘 10:00)에 선점하고, 첫 답 대상만 남긴다
create function pg_temp.first_targets() returns jsonb language sql as $$
  select coalesce(jsonb_agg(t order by t ->> 'profile_id'), '[]'::jsonb)
    from jsonb_array_elements(public.push_events_claim(((public.kst_today()::timestamp + time '10:00') at time zone 'Asia/Seoul')) -> 'targets') t
   where t ->> 'kind' = 'parent_first_answer'
$$;

select ok(public.push_text_clean('{호칭}께서 첫 답을 고르셨어요') and public.push_text_clean('앨범에서 보고 이야기해 볼까요?'),
          '확정 문구는 금지어 검사를 통과한다');
-- 첫 답 → 큐 1줄(답 내용·시각 없음)
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a1', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d1', 'A');
select public.save_answer('70520000-0000-0000-0000-00000000d0d1', 'B'); -- 같은 날 고치기: 새 답 아님
reset role;
select is((select jsonb_agg(payload) from public.notification_queue where kind = 'parent_first_answer'),
          jsonb_build_array(jsonb_build_object('parent_id', '70520000-0000-0000-0000-00000000a001')), '첫 새 답에 큐 1줄, payload는 어르신 id뿐(답·시각 없음)');
select is((select count(*)::int from public.push_events_kick(((public.kst_today()::timestamp + time '10:00') at time zone 'Asia/Seoul')) s
            where s ->> 'status' = 'nothing_to_send'), 0, '5분 cron이 첫 답 큐를 할 일로 센다');

-- 선점: 받을 수 있는 자녀에게만, 문구는 호칭만 채움
create temp table r1 as select pg_temp.first_targets() as v;
select is((select v from r1), jsonb_build_array(jsonb_build_object(
  'profile_id', '70520000-0000-0000-0000-00000000c001', 'token', 'fa52_c1_00000000000001', 'platform', 'android',
  'kind', 'parent_first_answer', 'channel', 'family', 'title', '엄마께서 첫 답을 고르셨어요', 'body', '앨범에서 보고 이야기해 볼까요?')),
  '알림 켬·받기 동의 자녀 한 명에게만, 호칭만 채운 문구');
select is((select jsonb_object_agg(child_id, status) from public.first_answer_notices where family_id = '70520000-0000-0000-0000-0000000000f1'),
          jsonb_build_object('70520000-0000-0000-0000-00000000c001', 'sent', '70520000-0000-0000-0000-00000000c002', 'skipped',
                             '70520000-0000-0000-0000-00000000c003', 'skipped'), '알림 끔·받기 동의 없음 자녀는 skipped로 지나감');
select is((select count(*)::int from public.notification_queue where kind = 'parent_first_answer' and sent_at is null), 0, '큐는 처리 표시');

-- 두 번째 답·다른 어르신의 첫 답: 큐 없음, 대상 없음
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a1', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d2', 'A');
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a2', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d1', 'A');
reset role;
select is((select count(*)::int from public.notification_queue where kind = 'parent_first_answer'), 1, '두 번째 답·다른 어르신의 첫 답에는 큐가 생기지 않는다');
select is(pg_temp.first_targets(), '[]'::jsonb, '두 번째 선점에는 첫 답 대상이 없다');

-- 알림을 다시 켜도 지나간 첫 답은 다시 안 보낸다
update public.profiles set push_enabled = true where id = '70520000-0000-0000-0000-00000000c002';
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a1', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d3', 'A');
reset role;
select is((select count(*)::int from public.notification_queue where kind = 'parent_first_answer'), 1, '알림을 다시 켠 자녀에게도 평생 1회(큐 없음)');

-- 나중에 연결된 형제: 다음 새 답 때 1회
insert into public.profiles (id, user_id, family_id, role, push_enabled, push_consented_at) values
  ('70520000-0000-0000-0000-00000000c004', '70520000-0000-0000-0000-0000000000c4', '70520000-0000-0000-0000-0000000000f1', 'child', true, now());
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a2', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d2', 'B');
reset role;
select is((select jsonb_agg(t ->> 'profile_id') from jsonb_array_elements(pg_temp.first_targets()) t),
          jsonb_build_array('70520000-0000-0000-0000-00000000c004'), '나중에 연결된 형제에게만 1회(이미 받은 자녀는 제외)');
select is(pg_temp.first_targets(), '[]'::jsonb, '그 형제에게도 두 번 가지 않는다');

-- 동의 철회: 큐가 있어도 보내지 않고 기록하지 않음
select pg_temp.act_as('70520000-0000-0000-0000-0000000000a9', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d1', 'A');
select public.withdraw_consent();
reset role;
select is(pg_temp.first_targets(), '[]'::jsonb, '어르신이 동의를 철회했으면 첫 답 알림이 없다');
select is((select count(*)::int from public.first_answer_notices where family_id = '70520000-0000-0000-0000-0000000000f3'), 0,
          '철회로 못 보낸 것은 기록하지 않는다(다시 동의하고 답하면 그때가 첫 답)');
select is((select count(*)::int from public.notification_queue where family_id = '70520000-0000-0000-0000-0000000000f3' and sent_at is null), 0, '철회 가족 큐도 처리 표시');

-- 다른 가족 무영향
select is((select count(*)::int from public.notification_queue where family_id = '70520000-0000-0000-0000-0000000000f2')
        + (select count(*)::int from public.first_answer_notices where family_id = '70520000-0000-0000-0000-0000000000f2'), 0, '답하지 않은 다른 가족에는 큐·기록이 없다');

-- 창 밖에서는 소비하지 않음, 권한
select pg_temp.act_as('70520000-0000-0000-0000-0000000000b1', true);
select public.save_answer('70520000-0000-0000-0000-00000000d0d1', 'A');
reset role;
select is(public.push_events_claim(((public.kst_today()::timestamp + time '22:00') at time zone 'Asia/Seoul')) -> 'targets', '[]'::jsonb, '창 밖(22시)에는 선점하지 않는다');
select is((select count(*)::int from public.notification_queue where family_id = '70520000-0000-0000-0000-0000000000f2' and sent_at is null), 1, '창 밖이면 큐가 그대로 기다린다');
select ok(not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r(role), unnest(array['select', 'insert', 'update', 'delete']) p(priv)
                       where has_table_privilege(r.role, 'public.first_answer_notices', p.priv)), '첫 답 기록 표는 앱·anon·서비스 역할이 직접 못 쓴다');

select * from finish();
rollback;
