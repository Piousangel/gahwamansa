-- 로컬 시드(db reset 때만, supabase/config.toml [db.seed]): 약관·방침 v1 게시(0048 terms_versions).
-- 왜: 게시 버전이 없으면 record_terms_agreement 가 unknown_version 으로 거부한다(dev-server-notes §2). 로컬 통합 테스트
--     (app/__integration__/terms.test.ts)의 정상 경로가 이 시드를 전제로 한다. 공유 DB 에 직접 게시하지 않는다.
-- 버전 표기 규칙(법률 재확인): 게시본 문서 머리 "버전 1"(docs/team/legal/publish-drafts terms.html·privacy.html) = 'v1'
--     = 앱 상수 app/src/api/contract/terms.ts TERMS_VERSION·PRIVACY_VERSION.
-- 게시 순서 규칙(리뷰 L8): 최신 = 가장 늦게 게시한 버전. 여기는 첫 버전(v1)만 넣는다(옛 버전 백필 아님).
-- 감사 행(admin_audit terms_publish)은 남기지 않으려고 admin_publish_terms_version 대신 표에 바로 넣는다:
--     로컬 전용 시드이고, pgTAP terms_versions.test 가 감사 행 수를 센다. staging·production 게시는 지금처럼 운영자가
--     admin_publish_terms_version 으로(remote-checks 확인 줄) — 이 파일은 원격에 적용되지 않는다.
insert into public.terms_versions (kind, version) values ('terms', 'v1'), ('privacy', 'v1') on conflict do nothing;
