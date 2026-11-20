-- 0020 테스트 (pgTAP): send_cheer, get_my_cheers, mark_cheers_read. 실행: npx supabase test db
-- 보호하는 것: 응원은 확정 문구 키 4개만, 같은 가족의 연결된 어르신에게만, 자녀·어르신 쌍마다 하루(KST) 2개까지.
--             자녀는 테이블에 직접 넣거나 read_at을 볼 수 없다. 읽기·읽음 처리는 받는 어르신 본인만.
begin;
select plan(24);

insert into auth.users (id, aud, role, is_anonymous) values
  ('74000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('74000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 다른 가족 자녀
  ('74000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 어르신1
  ('74000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- 어르신2(같은 가족)
  ('74000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true);  -- 다른 가족 어르신
insert into public.families (id, created_by) values
  ('74f00000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-0000000000c1'),
  ('74f00000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role) values
  ('74b00000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000c1', '74f00000-0000-0000-0000-000000000001', 'child'),
  ('74b00000-0000-0000-0000-0000000000c2', '74000000-0000-0000-0000-0000000000c2', '74f00000-0000-0000-0000-000000000002', 'child'),
  ('74b00000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000a1', '74f00000-0000-0000-0000-000000000001', 'parent'),
  ('74b00000-0000-0000-0000-0000000000a2', '74000000-0000-0000-0000-0000000000a2', '74f00000-0000-0000-0000-000000000001', 'parent'),
  ('74b00000-0000-0000-0000-0000000000a3', '74000000-0000-0000-0000-0000000000a3', '74f00000-0000-0000-0000-000000000002', 'parent'),
  ('74b00000-0000-0000-0000-0000000000d1', null, '74f00000-0000-0000-0000-000000000001', 'parent'); -- 연결 끊긴 어르신
-- 어제(KST) 보낸 응원은 오늘 한도에 들어가지 않는다
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at, read_at) values
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000c1', '74b00000-0000-0000-0000-0000000000a1', 'love_you', now() - interval '1 day', now() - interval '1 day');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---- 보내기 ----
select pg_temp.act_as('74000000-0000-0000-0000-0000000000c1', false);
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a1', 'love_you')) ->> 'ok', 'true', '자녀가 확정 키로 응원을 보낸다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a1', 'well_done')) ->> 'reason', 'invalid_key', '확정 목록 밖 키는 거부된다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a1', null)) ->> 'reason', 'invalid_key', '키가 없으면 거부된다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a3', 'love_you')) ->> 'reason', 'invalid_target', '다른 가족 어르신에게는 보낼 수 없다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000c1', 'love_you')) ->> 'reason', 'invalid_target', '어르신이 아닌 프로필에는 보낼 수 없다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000d1', 'love_you')) ->> 'reason', 'disconnected', '연결이 끊긴 어르신에게는 보낼 수 없다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a1', 'warm_day')) ->> 'ok', 'true', '하루 두 번째 응원은 보낸다');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a1', 'thanks_always')), '{"ok": false, "reason": "daily_limit"}'::jsonb, '하루 세 번째 응원은 daily_limit');
select is((public.send_cheer('74b00000-0000-0000-0000-0000000000a2', 'peaceful_day')) ->> 'ok', 'true', '한도는 어르신마다 따로 센다');
select is(array(select k from jsonb_object_keys(public.send_cheer('74b00000-0000-0000-0000-0000000000a2', 'love_you')) k order by 1),
          array['cheer_id', 'ok'], '보내기 응답에 read_at 등 읽음 정보가 없다');
select throws_ok($$ insert into public.cheers (family_id, from_child, to_parent, message_key) values
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000c1', '74b00000-0000-0000-0000-0000000000a1', 'anything') $$,
  '42501', null, '자녀는 응원 테이블에 직접 넣지 못한다(화이트리스트 우회 차단)');
select is((select count(*)::int from public.cheers), 0, '자녀는 응원 테이블을 직접 읽지 못한다(read_at 비공개 유지)'); -- rls:의도 RLS 확인: 자녀 cheers 0행
select throws_like($$ select public.get_my_cheers() $$, '%parent_required%', '자녀는 응원 읽기를 호출할 수 없다');
select throws_like($$ select public.mark_cheers_read() $$, '%parent_required%', '자녀는 읽음 처리를 호출할 수 없다');

-- ---- 읽기·읽음 (받는 어르신만) ----
reset role;
create temp table all_cheer_ids as select id from public.cheers; -- 다른 어르신 응원 id까지 포함
grant select on all_cheer_ids to public;
select pg_temp.act_as('74000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.send_cheer('74b00000-0000-0000-0000-0000000000a2', 'love_you') $$, '%child_required%', '어르신은 응원을 보낼 수 없다');
select is(((public.get_my_cheers()) ->> 'unread_count')::int, 2, '어르신1은 안 읽은 응원 2개를 본다(어제 읽은 것 제외)');
select is((public.get_my_cheers()) -> 'cheers' -> 0 ->> 'message_key', 'warm_day', '최신 응원이 먼저 온다');
select is(array(select k from jsonb_object_keys((public.get_my_cheers()) -> 'cheers' -> 0) k order by 1),
          array['id', 'message_key', 'sent_at'], '응원 항목은 id·키·보낸 시각만');
-- 남의 응원 id로 읽음 처리해도 바뀌지 않는다
select is(public.mark_cheers_read(array(select id from pg_temp.all_cheer_ids)), 2, '읽음 처리는 내 응원만 센다');
select is(((public.get_my_cheers()) ->> 'unread_count')::int, 0, '읽음 처리 뒤 안 읽은 응원은 0개');

select pg_temp.act_as('74000000-0000-0000-0000-0000000000a2', true);
reset role;
select is((select count(*)::int from public.cheers where to_parent = '74b00000-0000-0000-0000-0000000000a2' and read_at is null), 2, '다른 어르신의 응원은 읽음 처리되지 않았다');
select pg_temp.act_as('74000000-0000-0000-0000-0000000000a3', true);
select is(((public.get_my_cheers()) ->> 'unread_count')::int, 0, '다른 가족 어르신은 이 가족 응원을 보지 못한다');

-- ---- anon ----
reset role;
set local role anon;
select throws_ok($$ select public.send_cheer('74b00000-0000-0000-0000-0000000000a1', 'love_you') $$, '42501', null, 'anon은 send_cheer를 실행하지 못한다');
select throws_ok($$ select public.get_my_cheers() $$, '42501', null, 'anon은 get_my_cheers를 실행하지 못한다');

select * from finish();
rollback;
