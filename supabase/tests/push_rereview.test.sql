-- 0037 테스트 (pgTAP): 푸시 재검토(R-L2·D-L3·D-L4). 실행: npx supabase test db
-- 보호하는 것: 알림 받기 시각은 처음 받기로 한 시각을 유지(다시 true를 불러도 안 바뀜, 끄고 다시 켜면 새 시각),
--             parent_titles()는 anon이 못 부른다, 사진 버킷에는 storage 정책이 하나도 없다(앱 업로드 불가 = 개인 사진 금지 유지),
--             콘텐츠 표 references·trigger 권한도 없다, 호칭 있는 어르신만 있으면 가족 기본 호칭은 겹치지 않는다.
begin;
select plan(8);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70370000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70370000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70370000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7037f000-0000-0000-0000-000000000001', '70370000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, parent_title) values
  ('7037b000-0000-0000-0000-0000000000c1', '70370000-0000-0000-0000-0000000000c1', '7037f000-0000-0000-0000-000000000001', 'child', null),
  ('7037b000-0000-0000-0000-0000000000a1', '70370000-0000-0000-0000-0000000000a1', '7037f000-0000-0000-0000-000000000001', 'parent', '엄마'),
  ('7037b000-0000-0000-0000-0000000000a2', '70370000-0000-0000-0000-0000000000a2', '7037f000-0000-0000-0000-000000000001', 'parent', '아빠');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- R-L2: 최초 받기 시각 유지
update public.profiles set push_consented_at = now() - interval '5 days' where id = '7037b000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('70370000-0000-0000-0000-0000000000a1', true);
select public.set_push_enabled(true);
reset role;
select is((select push_consented_at from public.profiles where id = '7037b000-0000-0000-0000-0000000000a1'), now() - interval '5 days',
          '다시 켜도(앱 시작 때 호출 등) 처음 받기 시각은 그대로');
select pg_temp.act_as('70370000-0000-0000-0000-0000000000a1', true);
select public.set_push_enabled(false);
select public.set_push_enabled(true);
reset role;
select is((select push_consented_at from public.profiles where id = '7037b000-0000-0000-0000-0000000000a1'), now(), '끄고 다시 받으면 새 시각');

-- D-L3
select ok(not has_function_privilege('anon', 'public.parent_titles()', 'execute'), 'anon은 parent_titles를 못 부른다');
select ok(has_function_privilege('authenticated', 'public.parent_titles()', 'execute'), '로그인 사용자는 부른다');

-- D-L4
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and coalesce(qual, '') || coalesce(with_check, '') like '%content-photos%'), 0, '사진 버킷에는 storage 정책이 없다(앱 업로드·목록 불가)');
select ok(not (has_table_privilege('authenticated', 'public.content_photos', 'references') or has_table_privilege('authenticated', 'public.content_photos', 'trigger')
            or has_table_privilege('authenticated', 'public.content_questions', 'references') or has_table_privilege('authenticated', 'public.content_questions', 'trigger')),
          '콘텐츠 표에 references·trigger 권한도 없다');
select pg_temp.act_as('70370000-0000-0000-0000-0000000000c1', false);
select is(public.set_parent_title('엄마') ->> 'ok', 'true', '모든 어르신에게 자기 호칭이 있으면 가족 기본 호칭은 겹치지 않는다');
reset role;
select is((select parent_title from public.families where id = '7037f000-0000-0000-0000-000000000001'), '엄마', '가족 기본 호칭이 바뀐다');

select * from finish();
rollback;
