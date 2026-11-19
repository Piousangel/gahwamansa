-- 로컬 시드(db reset 때만, supabase/config.toml [db.seed]): 개발용 서버 스위치 켜기(0051 server_flags).
-- dev_reset_enabled: 테스터 가족(is_test) 어르신이 오늘 코스를 다시 할 수 있게(dev_reset_today, staging QA S25).
-- 이 파일은 원격에 적용되지 않는다(db push는 시드를 넣지 않음). staging은 운영자가 대시보드에서 켜고, production은 끈 상태로 둔다
-- (dev-server-notes §15·remote-checks).
insert into public.server_flags (name, enabled) values ('dev_reset_enabled', true)
on conflict (name) do update set enabled = true, updated_at = now();
