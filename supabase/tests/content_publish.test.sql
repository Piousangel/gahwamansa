-- 0040 테스트 (pgTAP): 콘텐츠 게시·은퇴 RPC(서비스 역할 전용). 실행: npx supabase test db
-- 보호하는 것: 새 콘텐츠는 끝에만·빈칸 없이 붙는다, 이미 게시된 day_index는 덮어쓰지 않는다, 자리표시 사진(pending://)·빈 문구는 거부,
--             사진·질문은 한 번에 같이 들어가고 감사 행이 남는다, 은퇴는 retired_at만 찍고 감사 행, 앱은 못 부른다.
begin;
select plan(12);
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'https://x/1.jpg', 'c1', '나무'), (2, 'https://x/2.jpg', 'c2', '감');
insert into public.content_questions (day_index, option_a, option_b, prompt) values (1, '봄', '가을', 'p1'), (2, '단감', '홍시', 'p2');

create function pg_temp.day(p_day int, p_url text default null) returns jsonb language sql as $$
  select jsonb_build_object('day_index', p_day, 'image_url', coalesce(p_url, 'https://ref.supabase.co/storage/v1/object/public/content-photos/v2/day-' || p_day || '.jpg'), 'caption', '설명' || p_day,
                            'keyword', '낱말', 'recall_questions', jsonb_build_array('회상1', '회상2'),
                            'prompt', '질문' || p_day, 'option_a', '가', 'option_b', '나', 'starter_a', null, 'starter_b', '이야기')
$$;

set local role service_role;
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(2)), '추가', 'ops') ->> 'reason', 'day_exists', '이미 게시된 날은 덮어쓰지 않는다');
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(4)), '추가', 'ops') ->> 'reason', 'not_append', '끝(3)을 건너뛰면 거부(빈칸 금지)');
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(3), pg_temp.day(5)), '추가', 'ops') ->> 'reason', 'not_append', '중간이 빠진 묶음도 거부');
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(3, 'pending://day-3')), '추가', 'ops') ->> 'reason', 'invalid_item', '자리표시 사진은 거부');
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(3) - 'caption'), '추가', 'ops') ->> 'reason', 'invalid_item', '빈 문구는 거부');
select throws_like($$ select public.admin_publish_content('[]'::jsonb, '추가', '') $$, '%operator_required%', '처리자 필수');
select is(public.admin_publish_content(jsonb_build_array(pg_temp.day(3), pg_temp.day(4)), '11월 3주차 추가', 'ops'), '{"ok": true, "days": [3, 4]}'::jsonb, '끝에 이어 붙인다');
reset role;
select is((select count(*)::int from public.content_photos p join public.content_questions q using (day_index) where day_index in (3, 4)), 2, '사진·질문이 같이 들어간다');
select is((select starter_b from public.content_questions where day_index = 3), '이야기', '첫마디 문장도 들어간다');
select is((select detail -> 'days' from public.admin_audit where action = 'content_publish' order by id desc limit 1), '[3, 4]'::jsonb, '게시 감사 행이 남는다');

-- 0043부터 은퇴 뒤 활성 날 7일 이상 유지: 날을 더 넣어 둔다
insert into public.content_photos (day_index, image_url, caption, keyword) select d, 'https://x/' || d || '.jpg', 'c', 'k' from generate_series(5, 9) d;
insert into public.content_questions (day_index, option_a, option_b) select d, 'a', 'b' from generate_series(5, 9) d;
set local role service_role;
select is(public.admin_retire_content(1, '오타 발견, 새 날로 교체', 'ops'), '{"ok": true}'::jsonb, '은퇴는 retired_at만(인자: 날, 사유, 처리자)');
reset role;

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
select pg_temp.act_as('70400000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select public.admin_publish_content('[]'::jsonb, 'x', 'y') $$, '42501', null, '앱은 게시 RPC를 못 부른다');

select * from finish();
rollback;
