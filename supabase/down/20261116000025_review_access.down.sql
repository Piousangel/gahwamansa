-- 0025 되돌리기(수동). issue_invite_code·redeem_invite_code는 0018 정의로 다시 만들어야 한다.
-- 순서(리뷰 L7): 이 파일은 뒤 번호부터 하나씩 되돌린다고 가정한다. **먼저** 아래에 적은 이전 정의 함수를 이전 마이그레이션 파일에서 다시 실행해
--   이 파일이 지울 컬럼·함수에 기대지 않게 만든 뒤, 그다음 이 파일을 실행한다(반대 순서면 남은 함수가 깨진다).
drop function if exists public.admin_create_review_family(uuid[], int);
drop function if exists public.admin_set_review_code(uuid, boolean);
drop function if exists public.admin_cleanup_review_family(uuid);
drop trigger if exists invite_codes_reusable_guard on public.invite_codes;
drop function if exists public.invite_codes_reusable_guard();
delete from public.invite_codes where reusable;
alter table public.invite_codes drop column if exists reusable, drop column if exists max_uses, drop column if exists disabled_at;
alter table public.families drop column if exists is_review;
