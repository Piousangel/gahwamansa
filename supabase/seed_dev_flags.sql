-- 로컬 시드(db reset 때만, supabase/config.toml [db.seed]): 개발용 서버 스위치 켜기(0051 server_flags).
-- dev_reset_enabled: 테스터 가족(is_test) 어르신이 오늘 코스를 다시 할 수 있게(dev_reset_today, staging QA S25).
-- 원격 방지(리뷰 PR #37 L1): server_flag_seed_local은 Vault에 project_url이 있으면(staging·production) 켜지 않고 notice만 남긴다.
-- 그래도 원격에 시드를 넣지 않는다(`db push --include-seed`·`db reset --linked` 금지, dev-server-notes §18). staging은 운영자가 대시보드에서 켜고,
-- production은 끈 상태로 둔다(dev-server-notes §15·remote-checks).
select public.server_flag_seed_local('dev_reset_enabled');
