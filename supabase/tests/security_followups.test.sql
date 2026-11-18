-- 0035 테스트 (pgTAP): 보안 후속(로드맵 SV-05). 실행: npx supabase test db
-- 보호하는 것: 앱 역할은 콘텐츠 표에 쓰기 권한 자체가 없다(R1 다층 방어), 동의는 버전을 꼭 보내야 한다(조용한 v1 기록 방지),
--             사진 버킷은 공개·JPEG만·2MB(개인 사진 금지), 호칭 목록은 한 곳(parent_titles)에서 온다,
--             가족 기본 호칭(set_parent_title)도 겹치면 duplicate_title로 거부(set_parent_title_for와 같은 reason), 폐기 예정 표시.
begin;
select plan(13);

select ok(not (has_table_privilege('authenticated', 'public.content_photos', 'insert') or has_table_privilege('authenticated', 'public.content_photos', 'update')
            or has_table_privilege('authenticated', 'public.content_photos', 'delete') or has_table_privilege('authenticated', 'public.content_photos', 'truncate')),
          '앱 역할은 content_photos에 쓰기 권한이 없다');
select ok(not (has_table_privilege('authenticated', 'public.content_questions', 'insert') or has_table_privilege('authenticated', 'public.content_questions', 'update')
            or has_table_privilege('authenticated', 'public.content_questions', 'delete') or has_table_privilege('authenticated', 'public.content_questions', 'truncate')),
          '앱 역할은 content_questions에 쓰기 권한이 없다');
select ok(has_table_privilege('authenticated', 'public.content_photos', 'select'), '읽기는 그대로');

select is((select array[public::text, array_to_string(allowed_mime_types, ','), file_size_limit::text] from storage.buckets where id = 'content-photos'),
          array['true', 'image/jpeg', '2097152'], '사진 버킷: 공개·JPEG만(png 거부)·2MB');

select is(public.parent_titles(), array['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'], '호칭 목록은 parent_titles() 한 곳');
select ok((select bool_and(pg_get_constraintdef(c.oid) like '%' || t || '%')
             from pg_constraint c, unnest(public.parent_titles()) t
            where c.conname = 'families_parent_title_check'), '가족 호칭 check 제약이 같은 목록이다');

insert into auth.users (id, aud, role, is_anonymous) values
  ('70350000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70350000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70350000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7035f000-0000-0000-0000-000000000001', '70350000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, parent_title) values
  ('7035b000-0000-0000-0000-0000000000c1', '70350000-0000-0000-0000-0000000000c1', '7035f000-0000-0000-0000-000000000001', 'child', null),
  ('7035b000-0000-0000-0000-0000000000a1', '70350000-0000-0000-0000-0000000000a1', '7035f000-0000-0000-0000-000000000001', 'parent', '엄마'),
  ('7035b000-0000-0000-0000-0000000000a2', '70350000-0000-0000-0000-0000000000a2', '7035f000-0000-0000-0000-000000000001', 'parent', null);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 동의: 버전 필수
select pg_temp.act_as('70350000-0000-0000-0000-0000000000a2', true);
select throws_ok($$ select public.give_consent() $$, '42883', null, '버전 없이 동의할 수 없다(기본값 v1 제거)');
select throws_like($$ select public.give_consent(null) $$, '%invalid_version%', 'null 버전은 거부');
select lives_ok($$ select public.give_consent('v2') $$, '버전을 보내면 동의된다');

-- 가족 기본 호칭: 겹치면 duplicate_title
select pg_temp.act_as('70350000-0000-0000-0000-0000000000c1', false);
select is(public.set_parent_title('엄마') ->> 'reason', 'duplicate_title', '기본 호칭이 다른 어르신 호칭과 겹치면 거부(호칭 없는 어르신이 그 호칭이 됨)');
select is(public.set_parent_title('아빠') ->> 'ok', 'true', '겹치지 않으면 된다');
select ok(obj_description('public.set_parent_title(text)'::regprocedure, 'pg_proc') like '%deprecated%', 'set_parent_title에 폐기 예정 표시가 있다');

reset role;
set local role anon;
select throws_ok($$ select public.give_consent('v2') $$, '42501', null, 'anon은 동의 함수를 실행하지 못한다');

select * from finish();
rollback;
