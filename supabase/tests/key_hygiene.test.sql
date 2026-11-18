-- 0047 테스트 (pgTAP): 보안 회의(2026-11-19 encryption-keys) 서버 몫 E1·E7 + pg_net 권한. 실행: npx supabase test db
-- 보호하는 것: D4 profiles.display_name 없음(가족 읽기 열에서도 빠짐), D5 관리자 사유·처리자에 `@`·9자리 이상 숫자 거부(정상 사유는 통과),
--             D6 앱·anon은 Vault·kick 함수·pg_net(외부 HTTP 요청)을 쓸 수 없다, D2·E7 카카오 포기 행은 회원번호 없이 보고 재시도·처리 완료를 감사와 함께.
begin;
select plan(22);

-- D4
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'),
          'profiles.display_name이 없다');
select ok(has_column_privilege('authenticated', 'public.profiles', 'parent_title', 'select') and has_column_privilege('authenticated', 'public.profiles', 'role', 'select')
      and not has_column_privilege('authenticated', 'public.profiles', 'consented_at', 'select'), '가족 확인용 열만 읽기(0014 grant 재작성)');

-- D5
set local role service_role;
select throws_like($$ select public.admin_delete_answers('7047b000-0000-0000-0000-000000000000', '요청자 mom@gmail.com', 'ops') $$, '%pii_in_args%', '사유에 메일 주소(@)는 거부');
select throws_like($$ select public.admin_delete_answers('7047b000-0000-0000-0000-000000000000', '전화 01012345678 요청', 'ops') $$, '%pii_in_args%', '사유에 9자리 이상 숫자는 거부');
select throws_like($$ select public.admin_delete_answers('7047b000-0000-0000-0000-000000000000', '요청', 'ops@team') $$, '%pii_in_args%', '처리자에 @는 거부');
select is(public.admin_delete_answers('7047b000-0000-0000-0000-000000000000', '메일 요청 #3(11-19 접수)', 'ops-hyun') ->> 'reason', 'not_found', '접수 번호·날짜 사유는 통과');
select is(public.admin_delete_answers('7047b000-0000-0000-0000-000000000000', 'staging 테스트 가족 정리(개발자 메뉴)', 'ops') ->> 'reason', 'not_found', '테스트 가족 정리 사유는 통과');
select is(public.admin_retire_content(99999, '11월 3주차 추가', 'ops') ->> 'reason', 'not_found', '콘텐츠 게시·은퇴 사유는 통과');
reset role;

-- D6: Vault·kick·pg_net
select ok(not has_schema_privilege('authenticated', 'vault', 'usage') and not has_schema_privilege('anon', 'vault', 'usage'), '앱·anon은 vault 스키마를 못 쓴다');
select ok((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%vault.decrypted_secrets%')
          <@ array['admin_publish_content', 'push_daily_kick', 'push_kick'], 'Vault 비밀값을 읽는 public 함수는 kick·게시 함수뿐');
select ok(not (has_function_privilege('authenticated', 'public.push_kick(text)', 'execute') or has_function_privilege('authenticated', 'public.push_daily_kick()', 'execute')
            or has_function_privilege('authenticated', 'public.push_events_kick(timestamptz)', 'execute') or has_function_privilege('authenticated', 'public.kakao_unlink_kick(timestamptz)', 'execute')
            or has_function_privilege('anon', 'public.push_kick(text)', 'execute')), '앱·anon은 kick 함수를 못 부른다');
select ok(not has_function_privilege('service_role', 'public.push_kick(text)', 'execute'), '공용 kick은 서비스 역할도 직접 못 부른다(종류별 kick만)');
-- pg_net 함수의 anon·authenticated 실행 권한은 플랫폼(supabase_admin)이 준 것이라 마이그레이션으로 회수할 수 없다.
-- 앱 API(PostgREST)는 net 스키마를 노출하지 않으므로, public 함수 안에서 pg_net을 부르는 경로가 kick뿐이고 그것을 앱이 못 부르는지를 고정한다.
select ok((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%net.http_%') <@ array['push_daily_kick', 'push_kick'],
          'public에서 pg_net으로 HTTP를 보내는 함수는 kick 두 개뿐(0033 push_daily_kick·0038 push_kick)');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef and pg_get_functiondef(p.oid) ~* 'execute\s'
                         and has_function_privilege('authenticated', p.oid, 'execute')),
          '앱이 부를 수 있는 invoker 함수 중 동적 SQL(execute)을 쓰는 것이 없다(pg_net 우회 경로 차단)');
select ok(has_function_privilege('postgres', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'execute'), 'kick 함수(소유자 postgres)는 계속 보낼 수 있다');

-- D2·E7: 카카오 포기 행 당일 처리
delete from public.kakao_unlink_queue;
insert into public.kakao_unlink_queue (id, kakao_user_id, attempts, gave_up_at, last_http) values (8801, 'kakao-secret-1', 10, now(), 500), (8802, 'kakao-secret-2', 10, now(), 500);
set local role service_role;
select ok(not exists (select 1 from information_schema.columns where table_name = 'kakao_unlink_gave_up' and column_name = 'kakao_user_id'), '포기 목록에는 회원번호 열이 없다');
select is((select count(*)::int from public.kakao_unlink_gave_up), 2, '포기 행을 회원번호 없이 본다');
select throws_ok($$ select kakao_user_id from public.kakao_unlink_queue $$, '42501', null, '서비스 역할도 큐의 회원번호를 직접 못 읽는다');
select is(public.admin_kakao_unlink_retry(8801, '키 교체 뒤 재시도', 'ops') ->> 'ok', 'true', '포기 행 재시도(키 고친 뒤)');
select is(public.admin_kakao_unlink_resolve(8802, '카카오 콘솔에서 수동 해제', 'ops') ->> 'ok', 'true', '수동 해제 뒤 처리 완료');
reset role;
select is((select attempts || '/' || coalesce(gave_up_at::text, 'null') from public.kakao_unlink_queue where id = 8801), '0/null', '재시도는 처음부터 다시 대기');
select is((select array_agg(action order by id) from public.admin_audit where action like 'kakao_%' and detail ->> 'queue_id' in ('8801', '8802')),
          array['kakao_retry', 'kakao_resolve'], '재시도·처리 완료가 감사에 남는다(회원번호 없이)');

select * from finish();
rollback;
