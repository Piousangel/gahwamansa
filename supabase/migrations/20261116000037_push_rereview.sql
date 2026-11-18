-- 0037 푸시 재검토 반영(docs/team/reviews/2026-11-18-push-tokens-review.md "재검토" 절). R-M1은 Edge Function(lib)에서 처리.
-- R-L2 set_push_enabled(true)는 이미 받기 시각이 있으면 덮어쓰지 않는다 → 처음 "알림 받기"를 누른 시각이 남는다(법률 체크리스트 #10 ④).
--      끄면(false) 시각을 지우고, 다시 받기로 하면 새 시각. 앱이 앱 시작 때마다 true를 불러도 시각은 바뀌지 않는다.
-- D-L3 parent_titles()의 PUBLIC·anon 실행 권한 회수(0031 원칙: anon 실행 불가). 상수라 노출은 없지만 일관성.

create or replace function public.set_push_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_enabled is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if public.my_profile_id() is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  update public.profiles
     set push_enabled = p_enabled,
         push_consented_at = case when p_enabled then coalesce(push_consented_at, now()) else null end
   where id = public.my_profile_id();
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

revoke execute on function public.parent_titles() from public, anon;
grant execute on function public.parent_titles() to authenticated;
