-- 0027 테스트 (pgTAP): 첫마디 한 줄(starter). 실행: npx supabase test db
-- 보호하는 것: child_summary.latest.starter는 어르신이 고른 쪽 문장만 준다(고르지 않은 쪽은 없음),
--             다른 가족 자녀에게는 보이지 않는다, 문장이 아직 없으면 null이다.
begin;
select plan(4);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('7b100000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('7b100000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('7b100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('7b100000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values
  ('7b1f0000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000c1'),
  ('7b1f0000-0000-0000-0000-000000000002', '7b100000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at) values
  ('7b1b0000-0000-0000-0000-0000000000c1', '7b100000-0000-0000-0000-0000000000c1', '7b1f0000-0000-0000-0000-000000000001', 'child', null, now() - interval '3 days'),
  ('7b1b0000-0000-0000-0000-0000000000c2', '7b100000-0000-0000-0000-0000000000c2', '7b1f0000-0000-0000-0000-000000000002', 'child', null, now() - interval '3 days'),
  ('7b1b0000-0000-0000-0000-0000000000a1', '7b100000-0000-0000-0000-0000000000a1', '7b1f0000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '2 days'),
  ('7b1b0000-0000-0000-0000-0000000000a2', '7b100000-0000-0000-0000-0000000000a2', '7b1f0000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '1 days');
insert into public.content_questions (id, day_index, option_a, option_b, prompt, starter_a, starter_b) values
  ('7b1c0000-0000-0000-0000-000000000001', 1, '바다', '산', 'q1', '바다 이야기 들려주세요', '산 이야기 들려주세요'),
  ('7b1c0000-0000-0000-0000-000000000002', 2, '가을', '봄', 'q2', null, null);
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('7b1f0000-0000-0000-0000-000000000001', '7b1b0000-0000-0000-0000-0000000000a1', '7b1c0000-0000-0000-0000-000000000001', 'B', public.kst_today()),
  ('7b1f0000-0000-0000-0000-000000000001', '7b1b0000-0000-0000-0000-0000000000a2', '7b1c0000-0000-0000-0000-000000000002', 'A', public.kst_today());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('7b100000-0000-0000-0000-0000000000c1', false);
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'starter', '산 이야기 들려주세요', '고른 쪽(B) 문장만 starter로 온다');
select is((public.child_summary()) -> 'parents' -> 1 -> 'latest' -> 'starter', 'null'::jsonb, '문장이 없으면 starter는 null');
select pg_temp.act_as('7b100000-0000-0000-0000-0000000000c2', false);
select is(position('이야기 들려주세요' in (public.child_summary())::text), 0, '다른 가족 자녀에게는 starter가 보이지 않는다');

reset role;
select throws_ok($$ update public.content_questions set starter_a = repeat('가', 61) where day_index = 2 $$, '23514', null, '첫마디 문장은 60자를 넘을 수 없다');

select * from finish();
rollback;
