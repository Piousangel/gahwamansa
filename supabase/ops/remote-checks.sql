-- 원격(staging·production) 반영 전·후 확인 SQL(읽기 전용, 로드맵 W3 SV-09 원격 몫). Studio SQL Editor에서 통째로 붙여 실행.
-- 결과는 표 하나(check, ok, detail). ok=false 줄만 보면 된다. 비밀값은 이름·존재 여부만 보고 값은 읽지 않는다(복호화 뷰 사용 안 함 —
-- `npx supabase db query --remote --read-only`의 읽기 전용 역할로도 전부 나온다).
-- 주의: 읽기 전용 역할이 RLS를 우회하지 못하면 콘텐츠·푸시 문구·응원 문장·재고 줄은 0으로 보인다(앱 RLS 때문 — 값이 없는 것이 아님).
--       그 줄이 false면 Studio SQL Editor(postgres)에서 다시 본다. cron 줄은 이 역할에서 보이지 않으면 판정 보류(빈칸)로 나온다.
-- 반영 순서·명령: docs/team/dev-server-notes.md §18.
with checks(check_name, ok, detail) as (
  -- 1. 마이그레이션 적용 범위
  select '마이그레이션 최신 번호', max(version) >= '20261116000051', max(version)
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
  -- cron.job은 RLS로 "자기 잡"만 보인다 → 읽기 전용 역할이면 0줄(판정 보류, 대시보드 Integrations > Cron에서 확인)
  select 'cron 잡(purge·push-daily·push-events·kakao-unlink)',
         case when (select count(*) from cron.job) = 0 then null
              else (select count(*) from cron.job where jobname in ('purge-expired-data', 'push-daily', 'push-events', 'kakao-unlink')) = 4 end,
         coalesce((select string_agg(jobname || ' ' || schedule, ', ' order by jobname) from cron.job), '이 역할로는 보이지 않음 — 대시보드에서 확인')
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
  select '앱 실행 가능 definer 38개(허용 목록과 같은 수, 0051 기준)',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')) = 38,
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
  -- 복호화 뷰(vault.decrypted_secrets)는 읽지 않는다(읽기 전용 역할로도 실행되게). 호스트가 하나뿐인지·https인지·프로젝트 주소와 같은지는 detail로 눈으로 확인
  select '사진 주소: 모두 https·자리표시 없음·호스트 1개',
         not exists (select 1 from public.content_photos where retired_at is null and (image_url like 'pending://%' or image_url not like 'https://%'))
           and (select count(distinct substring(image_url from '^https?://([^/]+)/')) from public.content_photos where retired_at is null) <= 1,
         (select string_agg(distinct substring(image_url from '^https?://([^/]+)/'), ', ') from public.content_photos where retired_at is null)
           || ' ← <ref>.supabase.co 인지 확인'
  union all
  -- 9. 운영 상태
  -- 0057 연결 전·옛 익명 계정 정리: 파기 배치 소유자(postgres)가 마지막 활동을 보려면 auth.sessions·refresh_tokens를 읽어야 한다
  select '익명 계정 정리 준비(0057): 함수 소유자의 auth 세션 읽기 권한',
         has_table_privilege('postgres', 'auth.sessions', 'select') and has_table_privilege('postgres', 'auth.refresh_tokens', 'select')
           and has_table_privilege('postgres', 'auth.users', 'delete'),
         '정리 대상(90일 넘은 프로필 없는 익명) ' || (select count(*) from public.stale_anonymous_users(now(), 100000))::text || '명 — 다음 파기 배치(00:10 KST)가 최대 500명씩 지움'
  union all
  select '카카오 해제 포기 0건', (select count(*) from public.kakao_unlink_queue where gave_up_at is not null) = 0, null
  union all
  -- 첫 답 알림(0052): 선점(claimed) 뒤 Edge 결과 기록(push_record)이 1시간 넘게 없으면 실제 도달 여부를 모른다(평생 1회라 다시 안 감).
  -- first_answer_notices는 RLS(정책 없음) → RLS를 우회하지 못하는 역할이면 판정 보류(null), 0051 스위치 줄과 같은 방식
  select '첫 답 알림 결과 미기록(claimed 1시간 넘음) 0건(0052)',
         case when (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
              then not exists (select 1 from public.first_answer_notices where status = 'claimed' and created_at < now() - interval '1 hour') end,
         case when not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
              then '이 역할(' || current_user || ')은 RLS를 우회하지 못해 판정 불가 — SQL Editor(postgres)에서 다시 실행'
              else (select count(*)::text from public.first_answer_notices where status = 'claimed' and created_at < now() - interval '1 hour')
                   || '건 — 있으면 push_runs(parent_first_answer)·Edge push-events 로그 확인(dev-server-notes §14-2)' end
  union all
  select '심사 가족 번호 꺼짐(심사 기간이 아니면)', not exists (select 1 from public.invite_codes where reusable and disabled_at is null),
         '심사 제출 중에는 false가 정상'
  union all
  -- 10. 키 관리(보안 회의 E4, 0047)
  select 'profiles.display_name 제거(0047)', not exists (select 1 from information_schema.columns
                                                         where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'), null
  union all
  select '앱·anon은 vault 스키마 못 씀', not has_schema_privilege('authenticated', 'vault', 'usage') and not has_schema_privilege('anon', 'vault', 'usage'), null
  union all
  select 'pg_net을 쓰는 public 함수는 kick 두 개뿐',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.prokind = 'f' and p.proname not in ('push_kick', 'push_daily_kick') and pg_get_functiondef(p.oid) like '%net.http_%'), null
  union all
  select '참고: 앱 역할의 pg_net 권한(플랫폼 기본값, 감시만)',
         null,
         'http_post 실행 ' || has_function_privilege('authenticated', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'execute')::text
           || ' / 요청 큐 insert ' || has_table_privilege('authenticated', 'net.http_request_queue', 'insert')::text
           || ' — net 스키마는 앱 API에 노출되지 않음(Settings > API > Exposed schemas에 net이 없어야 함)'
  union all
  select '참고: pg_graphql(앱 API 두 번째 경로)', null,
         case when exists (select 1 from pg_extension where extname = 'pg_graphql')
              then '설치됨 — anon 사용 ' || has_schema_privilege('anon', 'graphql_public', 'usage')::text
                   || '. 표 권한·RLS가 REST와 같게 적용되지만, 쓰지 않으면 대시보드 Extensions에서 끄는 것을 검토'
              else '설치 안 됨' end
  union all
  select '약관·방침 게시 버전 있음(0048)',
         exists (select 1 from public.terms_versions where kind = 'terms') and exists (select 1 from public.terms_versions where kind = 'privacy'),
         '없으면 앱의 약관 동의가 unknown_version으로 거부됨 — admin_publish_terms_version으로 게시'
  union all
  select 'public 뷰 쓰기 권한 없음(서비스 역할·앱·anon, 0049 M1)',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace,
                            unnest(array['service_role', 'authenticated', 'anon']) r(role), unnest(array['insert', 'update', 'delete', 'truncate']) pr(priv)
                      where n.nspname = 'public' and c.relkind in ('v', 'm') and has_table_privilege(r.role, c.oid, pr.priv)),
         'false면 kakao_unlink_gave_up 등으로 감사 없이 큐를 고치거나 지울 수 있음'
  union all
  -- server_flags는 RLS(정책 없음)라 RLS를 우회하지 못하는 역할로는 행이 안 보여 '꺼짐'으로 잘못(위험한 쪽으로) 나온다 → 그런 역할이면 판정 보류(null)(PR #37 L2)
  select '개발 스위치 꺼짐(dev_reset_enabled, 0051) — production은 반드시 true',
         case when (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
              then not coalesce((select enabled from public.server_flags where name = 'dev_reset_enabled'), false) end,
         case when not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
              then '이 역할(' || current_user || ')은 RLS를 우회하지 못해 판정 불가 — SQL Editor(postgres)에서 다시 실행'
              when coalesce((select enabled from public.server_flags where name = 'dev_reset_enabled'), false)
              then '켜짐 — staging QA 중이면 정상(false 허용), production이면 바로 끄기: update server_flags set enabled = false where name = ''dev_reset_enabled'''
              else '꺼짐' end
  union all
  select '프로필 없는 계정 삭제 경로(0049 P20)',
         has_function_privilege('service_role', 'public.admin_delete_user(uuid,text,text)', 'execute')
           and not has_function_privilege('authenticated', 'public.admin_delete_user(uuid,text,text)', 'execute'), null
  union all
  select '자녀 화면 내부 함수 실행 권한 없음(앱·anon·서비스 역할, 0050)',
         not exists (select 1 from unnest(array['public.family_child_summary(uuid,uuid)', 'public.family_child_history(uuid,uuid)']) f(fn),
                            unnest(array['authenticated', 'anon', 'service_role']) r(role)
                      where has_function_privilege(r.role, f.fn, 'execute')),
         'false면 가족 id를 넘겨 다른 가족의 답을 읽을 수 있음(대시보드 grant 확인)'
  union all
  select '인증 감사 로그 최근 30일 쌓임(auth.audit_log_entries)',
         (select count(*) from auth.audit_log_entries where created_at > now() - interval '30 days') > 0,
         (select count(*)::text from auth.audit_log_entries where created_at > now() - interval '30 days') || '건(보관 기간은 빌드 2 F3)'
)
select check_name as "check", ok, detail from checks order by ok nulls last, check_name;
