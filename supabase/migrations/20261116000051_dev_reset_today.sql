-- 0051 dev_reset_today: staging QA(S25)에서 어르신이 오늘 코스를 다시 해 P6을 재현할 수 있게 한다.
-- server_flags: 서버 스위치 표(이름·켜짐). 마이그레이션은 행을 넣지 않는다 = 모든 환경에서 기본 꺼짐.
--   로컬은 시드(supabase/seed_dev_flags.sql, db reset 때만)로 켜고, staging은 운영자가 대시보드(Table Editor 또는 SQL Editor, postgres)에서 켠다.
--   production은 끈 상태(행 없음 또는 false)로 둔다 — remote-checks가 확인한다. 앱·anon·서비스 역할은 이 표를 읽거나 쓸 수 없다.
-- dev_reset_today(): 어르신 본인만(그 밖 parent_required 예외 — 역할 오류는 다른 RPC처럼 raise).
--   스위치가 꺼졌으면 {ok:false, reason:'disabled'}, 테스터 가족(families.is_test, 0045)이 아니면 'not_test_family'.
--   본인의 오늘(KST) daily_sessions·answers만 지우고 {ok:true, session_date, sessions, answers}. 감사 행(dev_reset_today, 처리자 'self').
--   콘텐츠 커서(profiles.content_seq·content_seq_date)·응원·이벤트는 건드리지 않는다 → 다시 열면 같은 날 콘텐츠로 시작(advance는 오늘 이미 넘겼으므로 안 넘김).

create table public.server_flags (
  name text primary key check (name in ('dev_reset_enabled')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.server_flags enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.server_flags from public, anon, authenticated, service_role;

create function public.server_flag(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select f.enabled from public.server_flags f where f.name = p_name), false)
$$;
revoke execute on function public.server_flag(text) from public, anon, authenticated, service_role;

-- 로컬 시드 전용(supabase/seed_dev_flags.sql이 부름, 리뷰 PR #37 L1): Vault에 project_url이 있으면(staging·production) 켜지 않는다.
-- `db push --include-seed`·`db reset --linked`로 시드가 원격에 들어가도 스위치가 켜지지 않게 하는 장치. 켰으면 true.
create function public.server_flag_seed_local(p_name text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if exists (select 1 from vault.secrets where name = 'project_url') then
    raise notice 'server_flags %: Vault project_url이 있는 DB(원격)라 시드로 켜지 않습니다', p_name;
    return false;
  end if;
  insert into public.server_flags (name, enabled) values (p_name, true)
  on conflict (name) do update set enabled = true, updated_at = now();
  return true;
end $$;
revoke execute on function public.server_flag_seed_local(text) from public, anon, authenticated, service_role;

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire',
                                                            'content_image_url', 'test_family_mark', 'kakao_retry', 'kakao_resolve',
                                                            'terms_publish', 'delete_user', 'dev_reset_today'));

create function public.dev_reset_today() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid;
  v_today date := public.kst_today();
  v_sessions int;
  v_answers int;
begin
  if v_me is null or public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if not public.server_flag('dev_reset_enabled') then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
  select p.family_id into v_family from public.profiles p join public.families f on f.id = p.family_id where p.id = v_me and f.is_test;
  if v_family is null then return jsonb_build_object('ok', false, 'reason', 'not_test_family'); end if;
  perform 1 from public.profiles where id = v_me for update; -- 저장·코스 기록과 줄 세움(admin_delete_answers와 같은 잠금)
  delete from public.answers where parent_id = v_me and session_date = v_today;
  get diagnostics v_answers = row_count;
  delete from public.daily_sessions where parent_id = v_me and session_date = v_today;
  get diagnostics v_sessions = row_count;
  insert into public.admin_audit (operator, action, target_profile, target_family, reason, detail)
  values ('self', 'dev_reset_today', v_me, v_family, 'staging QA 오늘 코스 다시(테스터 가족)',
          jsonb_build_object('session_date', v_today, 'sessions', v_sessions, 'answers', v_answers));
  return jsonb_build_object('ok', true, 'session_date', v_today, 'sessions', v_sessions, 'answers', v_answers);
end $$;
revoke execute on function public.dev_reset_today() from public, anon, service_role;
grant execute on function public.dev_reset_today() to authenticated;
