-- 0019 되돌리기(수동). give_consent·withdraw_consent는 0014 정의로, child_summary는 0012 정의로 다시 만들어야 한다(해당 파일 참고).
-- 순서(리뷰 L7): 이 파일은 뒤 번호부터 하나씩 되돌린다고 가정한다. **먼저** 아래에 적은 이전 정의 함수를 이전 마이그레이션 파일에서 다시 실행해
--   이 파일이 지울 컬럼·함수에 기대지 않게 만든 뒤, 그다음 이 파일을 실행한다(반대 순서면 남은 함수가 깨진다).
drop function if exists public.set_parent_title_for(uuid, text);
drop table if exists public.consent_events;
revoke select (parent_title) on public.profiles from authenticated;
alter table public.profiles drop column if exists parent_title;
