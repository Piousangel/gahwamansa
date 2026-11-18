-- 원격(staging·production) 반영 전·후 확인 SQL(읽기 전용, 로드맵 W3 SV-09 원격 몫). Studio SQL Editor에서 통째로 붙여 실행.
-- 결과는 표 하나(check, ok, detail). ok=false 줄만 보면 된다. 비밀값은 이름·존재 여부만 보고 값은 읽지 않는다.
-- 반영 순서·명령: docs/team/dev-server-notes.md §18.
with checks(check_name, ok, detail) as (
  -- 1. 마이그레이션 적용 범위
  select '마이그레이션 최신 번호', max(version) >= '20261116000045', max(version)
    from supabase_migrations.schema_migrations
  union all
  -- 2. 확장
  select '확장 pg_cron', exists (select 1 from pg_extension where extname = 'pg_cron'), null
  union all
  select '확장 pg_net(extensions 스키마)', exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                                                   where e.extname = 'pg_net' and n.nspname = 'extensions'), null
  union all
  -- 3. Vault 비밀값(이름만)
  select 'Vault project_url', exists (select 1 from vault.secrets where name = 'project_url'),
         '없으면 cron이 함수를 안 부르고 사진 주소 호스트 검사가 생략됨'
  union all
  select 'Vault push_cron_secret', exists (select 1 from vault.secrets where name = 'push_cron_secret'), '함수 secrets PUSH_CRON_SECRET과 같은 값'
  union all
  -- 4. cron 잡 4개
  select 'cron 잡(purge·push-daily·push-events·kakao-unlink)',
         (select count(*) from cron.job where jobname in ('purge-expired-data', 'push-daily', 'push-events', 'kakao-unlink')) = 4,
         (select string_agg(jobname || ' ' || schedule, ', ' order by jobname) from cron.job)
  union all
  select '파기 배치 최근 성공(하루 이내)',
         exists (select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                  where j.jobname = 'purge-expired-data' and d.status = 'succeeded' and d.start_time > now() - interval '26 hours'),
         '반영 첫날은 false일 수 있음(00:10 KST 이후 다시 확인)'
  union all
  -- 5. 권한: anon 실행 가능 definer 0개, 앱 실행 가능 definer 수
  select 'anon 실행 가능 definer 0개',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')) = 0, null
  union all
  select '앱 실행 가능 definer 34개(허용 목록과 같은 수)',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')) = 34,
         (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute'))
  union all
  select '앱 역할 TRUNCATE 0개(public 전 표)',
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'truncate')) = 0, null
  union all
  select '감사 표: 서비스 역할 수정·삭제 불가',
         not (has_table_privilege('service_role', 'public.admin_audit', 'update') or has_table_privilege('service_role', 'public.admin_audit', 'delete')), null
  union all
  -- 6. 계정 삭제가 인증 계정까지 지울 수 있는지(0017·0026·0039 함수 소유자)
  select '삭제 함수 소유자의 auth.users 삭제 권한',
         (select bool_and(has_table_privilege(pg_get_userbyid(p.proowner), 'auth.users', 'delete')) from pg_proc p
           where p.oid in ('public.delete_my_account()'::regprocedure, 'public.account_delete_core(uuid)'::regprocedure,
                           'public.discard_anonymous_session()'::regprocedure)), null
  union all
  -- 7. 발송 문구(법률 리뷰 뒤 load-push-copy로 적재). 없으면 알림은 보내지 않는다(의도)
  select '푸시 문구 4종 적재', (select count(*) from public.push_copy) = 4,
         (select coalesce(string_agg(kind, ', ' order by kind), '없음 — 발송 안 함') from public.push_copy)
  union all
  select '응원 문장 4개 적재', (select count(*) from public.cheer_texts) = 4, null
  union all
  -- 8. 콘텐츠
  select '활성 콘텐츠 7일 이상', (select active_days from public.content_runway) >= 7,
         (select active_days || '일, 남은 새 날 ' || remaining_new_days from public.content_runway)
  union all
  select '사진 주소가 모두 이 프로젝트 https(자리표시 없음)',
         not exists (select 1 from public.content_photos where retired_at is null
                      and (image_url like 'pending://%' or image_url not like 'https://%'
                           or substring(image_url from '^https://([^/]+)/') is distinct from
                              substring((select decrypted_secret from vault.decrypted_secrets where name = 'project_url') from '^https?://([^/]+)'))),
         '0044 이전에 올린 사진 주소도 확인'
  union all
  -- 9. 운영 상태
  select '카카오 해제 포기 0건', (select count(*) from public.kakao_unlink_queue where gave_up_at is not null) = 0, null
  union all
  select '심사 가족 번호 꺼짐(심사 기간이 아니면)', not exists (select 1 from public.invite_codes where reusable and disabled_at is null),
         '심사 제출 중에는 false가 정상'
)
select check_name as "check", ok, detail from checks order by ok nulls first, check_name;
