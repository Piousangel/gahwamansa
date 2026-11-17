-- 0016 이번 주 도장 줄: 어르신 본인의 이번 주(KST 월~일) 완료 날짜 목록. 자녀는 호출 불가(참여 여부 비공개 원칙).
-- 날짜 계산은 내부 함수(week_stamps_for)로 분리해 기준일을 고정해 테스트한다(검토 반영).
create or replace function public.week_stamps_for(p_parent uuid, p_today date) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with w as (select p_today - ((extract(isodow from p_today)::int) - 1) as mon)
  select jsonb_build_object(
    'week_start', w.mon,
    'done_dates', coalesce((select jsonb_agg(ds.session_date order by ds.session_date)
                              from public.daily_sessions ds
                             where ds.parent_id = p_parent and ds.completed_at is not null
                               and ds.session_date between w.mon and w.mon + 6), '[]'::jsonb))
  from w
$$;
revoke execute on function public.week_stamps_for(uuid, date) from public, anon, authenticated;

create or replace function public.my_week_stamps() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  return public.week_stamps_for(public.my_profile_id(), public.kst_today());
end $$;
revoke execute on function public.my_week_stamps() from public, anon;
grant execute on function public.my_week_stamps() to authenticated;
