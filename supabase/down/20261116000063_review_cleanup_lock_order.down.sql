-- 0063 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- admin_cleanup_review_family를 0058 정의 그대로 되돌린다(create or replace라 권한은 그대로). 데이터 변경 없음.

create or replace function public.admin_cleanup_review_family(p_family uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_pid uuid;
  v_n int := 0;
begin
  if not exists (select 1 from public.families where id = p_family and is_review) then
    return jsonb_build_object('ok', false, 'reason', 'not_review_family');
  end if;
  for v_pid in select id from public.profiles where family_id = p_family and role = 'parent' order by created_at, id loop
    if public.account_delete_core(v_pid) is not null then v_n := v_n + 1; end if;
  end loop;
  update public.invite_codes set disabled_at = now() where family_id = p_family and reusable;
  return jsonb_build_object('ok', true, 'parents_removed', v_n);
end $$;
