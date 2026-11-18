-- 형제(자녀 2명) 종단 시나리오 (pgTAP, 로드맵 SV-12). 실행: npx supabase test db
-- 합류 RPC가 없어(형제 초대는 빌드 2) 두 번째 자녀는 서비스 역할 시드로 넣는다. DECISIONS 11-17 "자녀 한 명이 나가도 다른 자녀가 남으면 어르신 기록 유지".
-- 보호하는 것: 두 자녀 모두 같은 어르신 요약·지난 답을 본다, 응원 한도는 자녀마다 따로, 한 자녀가 지우면 본인만(scope child)이고 어르신 답·연결·다른 자녀는 그대로,
--             삭제 미리보기가 마지막 자녀에게만 family를 알린다, 마지막 자녀가 지우면 가족 전체(scope family) + 어르신 익명 계정까지.
begin;
select plan(13);
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70120000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70120000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70120000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7012f000-0000-0000-0000-000000000001', '70120000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at) values
  ('7012b000-0000-0000-0000-0000000000c1', '70120000-0000-0000-0000-0000000000c1', '7012f000-0000-0000-0000-000000000001', 'child', null, now() - interval '3 days'),
  ('7012b000-0000-0000-0000-0000000000c2', '70120000-0000-0000-0000-0000000000c2', '7012f000-0000-0000-0000-000000000001', 'child', null, now() - interval '2 days'), -- 시드로 합류
  ('7012b000-0000-0000-0000-0000000000a1', '70120000-0000-0000-0000-0000000000a1', '7012f000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '1 days');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values ('7012c000-0000-0000-0000-000000000001', 1, '봄', '가을', 'p');
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u', 'c', 'k');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70120000-0000-0000-0000-0000000000a1', true);
select public.save_answer('7012c000-0000-0000-0000-000000000001', 'B');

-- 두 자녀 모두 같은 어르신을 본다
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c1', false);
select is(public.child_summary() -> 'parents' -> 0 -> 'latest' ->> 'choice_label', '가을', '첫째 자녀가 어르신 답을 본다');
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c2', false);
select is(public.child_summary() -> 'parents' -> 0 -> 'latest' ->> 'choice_label', '가을', '둘째 자녀도 같은 답을 본다');
select is(jsonb_array_length(public.child_answer_history() -> 'parents' -> 0 -> 'answers'), 1, '둘째 자녀의 지난 답도 같다');

-- 응원 한도는 자녀마다 따로(같은 자녀→같은 어르신 하루 2개)
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c1', false);
select public.send_cheer('7012b000-0000-0000-0000-0000000000a1', 'love_you');
select public.send_cheer('7012b000-0000-0000-0000-0000000000a1', 'warm_day');
select is(public.send_cheer('7012b000-0000-0000-0000-0000000000a1', 'thanks_always') ->> 'reason', 'daily_limit', '첫째는 하루 2개까지');
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c2', false);
select is(public.send_cheer('7012b000-0000-0000-0000-0000000000a1', 'peaceful_day') ->> 'ok', 'true', '둘째의 한도는 따로');

-- 삭제 미리보기: 형제가 있으면 child
select is(public.delete_scope_preview() ->> 'scope', 'child', '형제가 있으면 미리보기는 본인만(child)');

-- 첫째가 지운다 → 본인만
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c1', false);
select is(public.delete_my_account() ->> 'scope', 'child', '형제가 남으면 본인만 지운다');
reset role;
select is((select count(*)::int from public.answers where parent_id = '7012b000-0000-0000-0000-0000000000a1'), 1, '어르신 답은 그대로');
select is((select count(*)::int from auth.users where id in ('70120000-0000-0000-0000-0000000000a1', '70120000-0000-0000-0000-0000000000c2')), 2, '어르신·둘째 계정은 그대로');
select is((select count(*)::int from public.cheers where from_child = '7012b000-0000-0000-0000-0000000000c1'), 0, '첫째가 보낸 응원은 함께 지워진다');

-- 둘째(마지막 자녀) → 미리보기 family, 지우면 가족 전체
select pg_temp.act_as('70120000-0000-0000-0000-0000000000c2', false);
select is(public.delete_scope_preview() ->> 'scope', 'family', '마지막 자녀에게는 가족 전체라고 알린다');
select is(public.delete_my_account() ->> 'scope', 'family', '마지막 자녀가 지우면 가족 전체');
reset role;
select is((select count(*)::int from auth.users where id = '70120000-0000-0000-0000-0000000000a1'), 0, '어르신 익명 계정까지 지워진다');

select * from finish();
rollback;
