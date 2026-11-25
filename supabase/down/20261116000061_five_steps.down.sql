-- 0061 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: ① 새 앱(5단계)이 아무도 안 쓰는 것을 확인 ② get_today_content·parent_history는 0028, preview_content는 0024, family_child_history는 0050,
--       event_prop_ok는 0060 정의를 그 파일에서 복사해 다시 실행 ③ 아래 실행.
-- 주의: ② 고른 것·⑤ 건넨 것(recall_picks·pass_on_picks)이 함께 지워진다(되살릴 수 없음). 5단계 세션 행의 completed_steps에 recall·pass_on이
--       있으면 옛 check를 다시 걸 수 없으므로 그 값을 빼 준다(완료 시각 completed_at은 그대로 둔다 — 도장은 이미 찍힌 것).
drop trigger if exists profiles_consent_withdrawn_picks on public.profiles;
drop function if exists public.save_pass_on(int, text);
drop function if exists public.save_recall(int, int);
drop table if exists public.pass_on_picks;
drop table if exists public.recall_picks;
drop table if exists public.content_recall_options;
drop function if exists public.five_steps_consent_withdrawn();
drop function if exists public.recall_pick_deleted();
drop function if exists public.content_recall_options_guard();
drop function if exists public.five_steps_skipped(uuid, text); -- save_answer를 0052로 되돌린 뒤
drop function if exists public.pass_on_key_ok(text);
delete from public.server_flags where name = 'pass_on_store_enabled';
alter table public.server_flags drop constraint server_flags_name_check,
  add constraint server_flags_name_check check (name in ('dev_reset_enabled'));

drop function public.record_session_step(text, int, boolean, int);
-- 여기서 0024의 record_session_step(p_step text, p_duration int default 0) 정의를 복사해 실행한 뒤 아래 두 줄(새로 만든 함수에는 기본 권한이 붙는다, 리뷰 QA-3 M2):
-- revoke execute on function public.record_session_step(text, int) from public, anon;
-- grant execute on function public.record_session_step(text, int) to authenticated;
-- save_answer는 0052 정의를 다시 실행한다(create or replace라 권한은 그대로).

alter table public.daily_sessions drop constraint daily_sessions_skipped_steps_check,
  drop constraint daily_sessions_course_len_check,
  drop constraint daily_sessions_completed_steps_check;
update public.daily_sessions
   set completed_steps = array(select s from unnest(completed_steps) s where s in ('photo', 'question', 'hangul') order by s)
 where not (completed_steps <@ array['photo', 'question', 'hangul']);
alter table public.daily_sessions drop column skipped_steps, drop column course_len, drop column stopped_here,
  add constraint daily_sessions_completed_steps_check check (completed_steps <@ array['photo', 'question', 'hangul']);
