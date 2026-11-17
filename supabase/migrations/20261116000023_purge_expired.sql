-- 0023 보관 기간 파기 함수 + 매일 배치(pg_cron)
-- 근거: docs/team/reviews/2026-11-17-design-session-review.md C항(30일 넘은 답 보관은 최소 보유 원칙과 충돌 → 31일 지난 답 파기),
--       DECISIONS 2026-11-17 "보관 기간: 코스 기록 31일, 응원 31일, 초대 번호 30일, 입력 시도 기록 30일".
-- 경계(p_now 기준, KST 날짜 = (p_now at time zone 'Asia/Seoul')::date = D):
--   answers·daily_sessions: session_date < D - 30  (자녀 노출 창은 D-29..D, 하루 여유를 두고 31일째에 지움)
--   cheers: sent_at < p_now - 31일
--   invite_codes: used_at < p_now - 30일, 또는 미사용이면서 expires_at < p_now - 30일
--   redeem_attempts: at < p_now - 30일
--   events: ts < p_now - 14개월(growth.md 3-2 보관 제안, 가족 없는 기기 이벤트 포함, 리뷰 L1)
--   콘텐츠(content_*)와 동의 이력(consent_events)은 지우지 않는다. 콘텐츠 삭제 금지 트리거(0024)와 충돌하지 않음.
-- 실행 권한: 서비스 역할·postgres만(앱 불가). 배치: pg_cron 'purge-expired-data' 매일 15:10 UTC(00:10 KST).
-- pg_cron은 로컬 이미지(shared_preload_libraries)와 Supabase 호스팅 모두 제공. 원격 반영 시 Database > Extensions에서 켜져 있는지 확인.
-- 영향: parent_streak(0005)은 남은 31일 기록으로만 계산된다(연속일 숫자는 화면에서 이미 뺐다, DECISIONS 11-17). 이번 주 도장(0016)은 7일 이내라 영향 없음.

create function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int;
begin
  delete from public.answers where session_date < v_today - 30;
  get diagnostics n_answers = row_count;
  delete from public.daily_sessions where session_date < v_today - 30;
  get diagnostics n_sessions = row_count;
  delete from public.cheers where sent_at < p_now - interval '31 days';
  get diagnostics n_cheers = row_count;
  delete from public.invite_codes
   where used_at < p_now - interval '30 days'
      or (used_at is null and expires_at < p_now - interval '30 days');
  get diagnostics n_codes = row_count;
  delete from public.redeem_attempts where at < p_now - interval '30 days';
  get diagnostics n_attempts = row_count;
  delete from public.events where ts < p_now - interval '14 months';
  get diagnostics n_events = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events);
end $$;

revoke execute on function public.purge_expired_data(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_expired_data(timestamptz) to service_role;

create extension if not exists pg_cron;
-- 같은 이름이면 갱신(멱등)
select cron.schedule('purge-expired-data', '10 15 * * *', 'select public.purge_expired_data()');
