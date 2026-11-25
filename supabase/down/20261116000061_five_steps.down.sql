-- 0061 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: ① 새 앱(5단계)이 아무도 안 쓰는 것을 확인 ② get_today_content·parent_history는 0028, preview_content는 0024, family_child_history는 0050,
--       event_prop_ok는 0060, save_answer는 0052 정의를 그 파일에서 복사해 다시 실행(create or replace라 권한은 그대로.
--       parent_history·family_child_history는 원본이 'create function'이라 'create or replace function'으로 바꿔 실행)
--       ③ 아래를 위에서부터 실행(record_session_step 자리에서 0024 정의 붙여 넣기).
-- 줄 순서는 '쓰는 쪽을 먼저 옛 정의로 돌리고 → 쓰이는 것을 지운다'(리뷰 QA-1 L-b). 특히 five_steps_skipped는 0061 save_answer가 부르므로
--   ② save_answer 되돌리기가 먼저다 — 반대로 하면 그 사이 ③ 저장(save_answer)이 '함수 없음'으로 실패한다.
--   pass_on_key_ok는 pass_on_picks의 check가 쓰므로 표 뒤, 트리거 함수는 트리거(표·profiles) 뒤, 새 열은 그 열을 쓰는 함수가 모두 옛 정의로 돌아간 뒤.
-- 주의: ② 고른 것·⑤ 건넨 것(recall_picks·pass_on_picks)이 함께 지워진다(되살릴 수 없음). 5단계 세션 행의 completed_steps에 recall·pass_on이
--       있으면 옛 check를 다시 걸 수 없으므로 그 값을 빼 준다(완료 시각 completed_at은 그대로 둔다 — 도장은 이미 찍힌 것).
-- 검사: ②를 빠뜨렸으면 아무것도 지우지 않고 멈춘다. (가) 0061이 지울 것(아래 drop 대상)을 아직 부르는 다른 public 함수가 있거나
--   (나) event_prop_ok가 아직 0061 정의(step에 stop_here)이면 예외. 제외 대상은 이름이 아니라 인자까지(regprocedure)로 고른다.
do $$
declare v text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.prosrc ~ '(five_steps_skipped|pass_on_key_ok|recall_picks|pass_on_picks|content_recall_options|skipped_steps|course_len|stopped_here|pass_on_store_enabled)'
          or (p.oid = to_regprocedure('public.event_prop_ok(text, jsonb)') and p.prosrc ~ 'stop_here'))
     and p.oid <> all (array_remove(array[
           to_regprocedure('public.save_pass_on(int, text)'), to_regprocedure('public.save_recall(int, int)'),
           to_regprocedure('public.five_steps_consent_withdrawn()'), to_regprocedure('public.recall_pick_deleted()'),
           to_regprocedure('public.content_recall_options_guard()'), to_regprocedure('public.five_steps_skipped(uuid, text)'),
           to_regprocedure('public.pass_on_key_ok(text)'), to_regprocedure('public.record_session_step(text, int, boolean, int)')
         ]::oid[], null));
  if v is not null then raise exception '0061 down: ②를 먼저(옛 정의로 되돌릴 함수): %', v; end if;
end $$;
drop trigger if exists profiles_consent_withdrawn_picks on public.profiles;
drop function if exists public.save_pass_on(int, text);
drop function if exists public.save_recall(int, int);
drop table if exists public.pass_on_picks;
drop table if exists public.recall_picks;
drop table if exists public.content_recall_options;
drop function if exists public.five_steps_consent_withdrawn();
drop function if exists public.recall_pick_deleted();
drop function if exists public.content_recall_options_guard();
drop function if exists public.five_steps_skipped(uuid, text); -- 부르는 곳(save_answer ②, save_recall·save_pass_on 위)이 모두 사라진 뒤
drop function if exists public.pass_on_key_ok(text);
delete from public.server_flags where name = 'pass_on_store_enabled';
alter table public.server_flags drop constraint server_flags_name_check,
  add constraint server_flags_name_check check (name in ('dev_reset_enabled'));

drop function public.record_session_step(text, int, boolean, int);
-- 여기서 0024의 record_session_step(p_step text, p_duration int default 0) 정의를 복사해 실행한 뒤 아래 두 줄(새로 만든 함수에는 기본 권한이 붙는다, 리뷰 QA-3 M2):
-- revoke execute on function public.record_session_step(text, int) from public, anon;
-- grant execute on function public.record_session_step(text, int) to authenticated;

alter table public.daily_sessions drop constraint daily_sessions_skipped_steps_check,
  drop constraint daily_sessions_course_len_check,
  drop constraint daily_sessions_completed_steps_check;
update public.daily_sessions
   set completed_steps = array(select s from unnest(completed_steps) s where s in ('photo', 'question', 'hangul') order by s)
 where not (completed_steps <@ array['photo', 'question', 'hangul']);
alter table public.daily_sessions drop column skipped_steps, drop column course_len, drop column stopped_here,
  add constraint daily_sessions_completed_steps_check check (completed_steps <@ array['photo', 'question', 'hangul']);
