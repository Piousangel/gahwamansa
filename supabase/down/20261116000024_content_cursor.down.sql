-- 0024 되돌리기(수동). my_day_index는 0009, record_session_step은 0005, preview_content는 0015 정의로 다시 만들어야 한다.
-- 순서(리뷰 L7): 이 파일은 뒤 번호부터 하나씩 되돌린다고 가정한다. **먼저** 아래에 적은 이전 정의 함수를 이전 마이그레이션 파일에서 다시 실행해
--   이 파일이 지울 컬럼·함수에 기대지 않게 만든 뒤, 그다음 이 파일을 실행한다(반대 순서면 남은 함수가 깨진다).
-- day_index 30 상한은 31 이상 행이 없을 때만 되돌릴 수 있다.
drop function if exists public.start_today();
drop function if exists public.advance_content_cursor(uuid);
drop function if exists public.content_next_day(int);
drop trigger if exists content_questions_immutable on public.content_questions;
drop trigger if exists content_photos_immutable on public.content_photos;
drop trigger if exists content_questions_no_delete on public.content_questions;
drop trigger if exists content_photos_no_delete on public.content_photos;
drop function if exists public.content_delete_guard();
drop function if exists public.content_immutable_guard();
alter table public.daily_sessions drop column if exists day_index;
alter table public.profiles drop column if exists content_seq, drop column if exists content_seq_date;
alter table public.content_photos drop column if exists retired_at;
alter table public.content_questions drop column if exists retired_at;
alter table public.content_photos drop constraint content_photos_day_index_check,
  add constraint content_photos_day_index_check check (day_index between 1 and 30);
alter table public.content_questions drop constraint content_questions_day_index_check,
  add constraint content_questions_day_index_check check (day_index between 1 and 30);
