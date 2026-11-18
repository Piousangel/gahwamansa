-- 0044 테스트 (pgTAP): 재검토 R-M1·K-L1·K-L2·R-L1·R-L2. 실행: npx supabase test db
-- 보호하는 것: 어드민 키 오류로 멈춘 회차는 시도 횟수를 돌려놓고 1시간 뒤 다시(포기로 가지 않음) + 실행 기록,
--             정상 회차도 실행 기록(완료·재시도·포기), 같은 카카오 계정으로 큐에 들어간 뒤 다시 가입했으면 해제하지 않고 지운다,
--             서비스 역할은 큐를 직접 고치지 못한다, 사진 주소는 https + Vault project_url 호스트만, 사진 주소를 바꾸면 감사 행이 남는다.
begin;
select plan(12);
delete from public.kakao_unlink_queue;
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into public.kakao_unlink_queue (id, kakao_user_id, enqueued_at) values
  (9001, 'kakao-a', now() - interval '1 hour'),
  (9002, 'kakao-b', now() - interval '1 hour'),
  (9003, 'kakao-re', now() - interval '1 hour');
-- kakao-re: 큐에 들어간 뒤(삭제 뒤) 같은 카카오 계정으로 다시 가입
insert into auth.users (id, aud, role, is_anonymous) values ('70440000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false);
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at) values ('kakao-re', '70440000-0000-0000-0000-0000000000c1', '{}', 'kakao', now() - interval '5 minutes');

set local role service_role;
select is((select array_agg(x ->> 'kakao_user_id' order by x ->> 'kakao_user_id') from jsonb_array_elements(public.kakao_unlink_claim(10)) x),
          array['kakao-a', 'kakao-b'], '다시 가입한 카카오 계정은 해제 대상에서 빠진다(새 계정의 연결을 끊지 않게)');
reset role;
select is((select count(*)::int from public.kakao_unlink_queue where kakao_user_id = 'kakao-re'), 0, '그 행은 지운다(회원번호 보관 안 함)');

-- 어드민 키 오류: 시도 횟수 원상, 1시간 뒤 다시, 실행 기록
set local role service_role;
select is(public.kakao_unlink_release(array[9001, 9002]::bigint[], 401) ->> 'released', '2', '키 오류 회차는 선점을 풀어 준다');
reset role;
select is((select array_agg(attempts order by id) from public.kakao_unlink_queue where id in (9001, 9002)), array[0, 0], '시도 횟수를 쓰지 않는다(포기로 가지 않음)');
select ok((select bool_and(next_attempt_at >= now() + interval '59 minutes') from public.kakao_unlink_queue where id in (9001, 9002)), '1시간 뒤에 다시 시도');
select is((select note from public.push_runs where kind = 'kakao_unlink' order by id desc limit 1), 'config_error', '실행 기록에 설정 오류가 남는다(운영 점검)');

-- 정상 회차 기록
update public.kakao_unlink_queue set next_attempt_at = now() where id in (9001, 9002);
set local role service_role;
select public.kakao_unlink_claim(10);
select public.kakao_unlink_record(jsonb_build_array(jsonb_build_object('id', 9001, 'status', 'done'), jsonb_build_object('id', 9002, 'status', 'retry', 'http', 500)));
reset role;
select is((select sent || '/' || failed || '/' || invalid from public.push_runs where kind = 'kakao_unlink' order by id desc limit 1), '1/1/0', '정상 회차도 완료/재시도/포기 수가 남는다');

-- K-L2: 서비스 역할 큐 직접 쓰기 회수
select ok(not (has_table_privilege('service_role', 'public.kakao_unlink_queue', 'insert') or has_table_privilege('service_role', 'public.kakao_unlink_queue', 'update')
            or has_table_privilege('service_role', 'public.kakao_unlink_queue', 'delete') or has_table_privilege('service_role', 'public.kakao_unlink_queue', 'truncate')),
          '서비스 역할은 해제 큐를 직접 고치지 못한다(함수로만)');

-- R-L1: 사진 주소 호스트
insert into public.content_photos (day_index, image_url, caption, keyword) select d, 'https://good.supabase.co/storage/v1/object/public/content-photos/v2/day-0' || d || '.jpg', 'c', 'k' from generate_series(1, 2) d;
insert into public.content_questions (day_index, option_a, option_b) select d, 'a', 'b' from generate_series(1, 2) d;
select vault.create_secret('https://good.supabase.co', 'project_url');
set local role service_role;
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 3, 'image_url', 'https://evil.example/storage/v1/object/public/content-photos/v2/day-03.jpg',
          'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '추가', 'ops') ->> 'reason', 'invalid_item', '다른 호스트 사진 주소는 거부');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 3, 'image_url', 'http://good.supabase.co/storage/v1/object/public/content-photos/v2/day-03.jpg',
          'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '추가', 'ops') ->> 'reason', 'invalid_item', 'http는 거부');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 3, 'image_url', 'https://good.supabase.co/storage/v1/object/public/content-photos/v2/day-03.jpg',
          'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '추가', 'ops') ->> 'ok', 'true', '내 프로젝트 https 주소는 된다');
-- R-L2: 사진 주소 바꾸면 감사
update public.content_photos set image_url = 'https://good.supabase.co/storage/v1/object/public/content-photos/v3/day-01.jpg' where day_index = 1;
reset role;
select is((select detail ->> 'day_index' from public.admin_audit where action = 'content_image_url' order by id desc limit 1), '1', '사진 주소를 바꾸면 감사 행이 남는다');

select * from finish();
rollback;
