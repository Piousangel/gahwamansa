-- 0026 되돌리기(수동). my_day_index는 0009, record_session_step은 0005, preview_content는 0015 정의로 다시 만들어야 한다.
-- day_index 30 상한은 31 이상 행이 없을 때만 되돌릴 수 있다.
drop function if exists public.start_today();
drop function if exists public.advance_content_cursor(uuid);
drop function if exists public.content_next_day(int);
drop trigger if exists content_questions_immutable on public.content_questions;
drop trigger if exists content_photos_immutable on public.content_photos;
drop function if exists public.content_immutable_guard();
alter table public.daily_sessions drop column if exists day_index;
alter table public.profiles drop column if exists content_seq, drop column if exists content_seq_date;
alter table public.content_photos drop column if exists retired_at;
alter table public.content_questions drop column if exists retired_at;
alter table public.content_photos drop constraint content_photos_day_index_check,
  add constraint content_photos_day_index_check check (day_index between 1 and 30);
alter table public.content_questions drop constraint content_questions_day_index_check,
  add constraint content_questions_day_index_check check (day_index between 1 and 30);
