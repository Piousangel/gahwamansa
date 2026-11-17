-- preview_content 테스트 (pgTAP). 미연결 열람 모드: 연결이 끊긴(프로필 없는) 기기도 오늘 코스를 볼 수 있다. 답·세션은 없다.
begin;
select plan(9);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('73000000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true); -- 프로필 없는 기기(연결 끊김)
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('73c00000-0000-0000-0000-000000000001', 1, 'q1a', 'q1b', 'p1'),
  ('73c00000-0000-0000-0000-000000000002', 2, 'q2a', 'q2b', 'p2');
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions) values
  (1, 'u1', 'cap1', 'k1', array['r1a', 'r1b']), (2, 'u2', 'cap2', 'k2', array['r2a', 'r2b']);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('73000000-0000-0000-0000-0000000000a9', true);
select is(((public.preview_content()) ->> 'day_index')::int, mod(greatest(0, public.kst_today() - date '2026-01-01'), 2) + 1, '프로필이 없어도 KST 날짜 기준 순환 번호를 돌려준다');
select ok((public.preview_content()) -> 'photo' ->> 'caption' in ('cap1', 'cap2'), '사진을 돌려준다');
select ok((public.preview_content()) -> 'question' ->> 'prompt' in ('p1', 'p2'), '질문을 돌려준다');
select is((public.preview_content()) ->> 'linked', 'false', '연결되지 않았다는 표시를 돌려준다');
select is(((public.preview_content()) - 'day_index' - 'photo' - 'question' - 'linked'), '{}'::jsonb, '답·동의·세션·연속일은 포함하지 않는다');

select throws_like($$ select public.save_answer('73c00000-0000-0000-0000-000000000001', 'A') $$, '%parent_required%', '연결 안 된 기기는 답을 저장할 수 없다');

-- 연결된 어르신은 preview_content를 쓰지 못한다(다른 날 문항 오답 저장 방지)
reset role;
insert into auth.users (id, aud, role, is_anonymous) values ('73000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), ('73000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('73f00000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values ('73b00000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-0000000000a1', '73f00000-0000-0000-0000-000000000001', 'parent');
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.preview_content() $$, '%linked_use_get_today_content%', '연결된 어르신은 preview_content 대신 get_today_content를 써야 한다');

-- 콘텐츠가 없으면 null
reset role;
delete from public.content_photos; delete from public.content_questions;
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a9', true);
select is(public.preview_content(), null, '콘텐츠가 없으면 null을 돌려준다');

reset role;
set local role anon;
select throws_ok($$ select public.preview_content() $$, '42501', null, 'anon은 preview_content를 실행하지 못한다');

select * from finish();
rollback;
