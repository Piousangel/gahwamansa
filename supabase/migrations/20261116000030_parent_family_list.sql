-- 0030 parent_family_list(): 어르신 설정 P16 "연결된 가족"(docs/design/v3/screens/parent/P16_family.dc.html)
-- 어르신 본인만. 같은 가족의 자녀 계정마다 {seq, connected_at, connected_date}만 — 자녀 이름(display_name)·이메일·id는 주지 않는다.
-- connected_at = greatest(자녀 프로필 생성, 내 프로필 생성): 둘이 같은 가족에 함께 있게 된 시각(먼저 있던 자녀는 내가 연결된 시각).
-- title = 가족이 나를 부르는 호칭(어르신별 호칭, 없으면 가족 호칭). 화면 "이 휴대폰을 {호칭}라고 부르는 가족 n명".
-- 빈 목록: 연결 전(프로필 없는 익명) 기기 → {title:null, family:[]}. 심사 가족(is_review)은 심사 계정이 보이지 않게 빈 목록.
-- 자녀 역할은 parent_required, anon은 실행 권한 없음.

create function public.parent_family_list() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.profiles%rowtype;
  v_family public.families%rowtype;
begin
  select * into v_me from public.profiles where user_id = auth.uid();
  if not found then
    if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
      return jsonb_build_object('title', null, 'family', '[]'::jsonb);
    end if;
    raise exception 'parent_required';
  end if;
  if v_me.role <> 'parent' then raise exception 'parent_required'; end if;
  select * into v_family from public.families where id = v_me.family_id;
  return jsonb_build_object(
    'title', coalesce(v_me.parent_title, v_family.parent_title),
    'family', case when v_family.is_review then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'seq', x.seq,
               'connected_at', x.connected_at,
               'connected_date', (x.connected_at at time zone 'Asia/Seoul')::date) order by x.seq)
        from (select greatest(c.created_at, v_me.created_at) as connected_at,
                     row_number() over (order by greatest(c.created_at, v_me.created_at), c.id) as seq
                from public.profiles c
               where c.family_id = v_me.family_id and c.role = 'child') x), '[]'::jsonb) end);
end $$;

revoke execute on function public.parent_family_list() from public, anon;
grant execute on function public.parent_family_list() to authenticated;
