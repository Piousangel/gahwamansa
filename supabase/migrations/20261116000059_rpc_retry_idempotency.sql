-- 0059 쓰기 RPC 재시도(같은 요청 두 번) 대비 — 앱 fetch 시간 제한(쓰기 15초) 도입 전(dev-server-notes §20).
-- 응답만 늦고 서버는 처리한 요청을 사용자가 "다시 하기"로 또 보내도 결과가 한 번만 생기게 한다.
-- (1) send_cheer(p_parent, p_key, p_request_id uuid default null): 앱이 응원 버튼을 누를 때 uuid를 한 번 만들고 재시도 때 같은 값을 보낸다.
--     cheers.request_id + 유일 인덱스(from_child, request_id). 같은 자녀의 같은 id가 이미 있으면 새로 넣지 않고 그 응원의 {ok:true, cheer_id}.
--     한도 검사보다 먼저 확인한다 — 첫 요청이 한도의 마지막 칸을 썼어도 재시도가 daily_limit로 보이지 않게.
--     id 없는 옛 호출은 지금과 같다. 시그니처를 바꾸므로 2인자 판을 지우고 3인자(기본값 null) 판 하나만 둔다(PostgREST 이름 인자 호출이 모호해지지 않게).
-- (2) create_family(): 이미 자녀 프로필이 있으면(첫 요청이 가족을 만들었는데 응답을 못 받은 경우) 예외 대신 그 가족·프로필을 돌려준다.
--     어르신 프로필이면 지금처럼 already_has_profile.

alter table public.cheers add column request_id uuid;
create unique index cheers_request_key on public.cheers (from_child, request_id) where request_id is not null;

drop function public.send_cheer(uuid, text);
create function public.send_cheer(p_parent uuid, p_key text, p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_target public.profiles%rowtype;
  v_id uuid;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_key is null or p_key not in ('love_you', 'warm_day', 'thanks_always', 'peaceful_day') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;
  select * into v_target from public.profiles where id = p_parent and family_id = v_family and role = 'parent';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_target');
  end if;
  if v_target.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'disconnected');
  end if;
  perform 1 from public.profiles where id = v_me for update; -- 같은 자녀의 동시 전송을 줄 세워 한도 우회 방지(재시도 확인도 이 잠금 안에서)
  if p_request_id is not null then
    select id into v_id from public.cheers where from_child = v_me and request_id = p_request_id;
    if found then return jsonb_build_object('ok', true, 'cheer_id', v_id); end if; -- 0059: 같은 요청의 재시도
  end if;
  if (select count(*) from public.cheers
       where from_child = v_me and to_parent = p_parent
         and (sent_at at time zone 'Asia/Seoul')::date = public.kst_today()) >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;
  insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at, request_id)
  values (v_family, v_me, p_parent, p_key, clock_timestamp(), p_request_id)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'cheer_id', v_id);
end $$;
revoke execute on function public.send_cheer(uuid, text, uuid) from public, anon;
grant execute on function public.send_cheer(uuid, text, uuid) to authenticated;

create or replace function public.create_family() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_profile uuid;
  v_role text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'child_required';
  end if;
  select id, family_id, role into v_profile, v_family, v_role from public.profiles where user_id = v_uid;
  if found then
    if v_role = 'child' then -- 0059: 재시도(첫 요청이 이미 가족을 만듦) → 같은 결과
      return jsonb_build_object('family_id', v_family, 'profile_id', v_profile);
    end if;
    raise exception 'already_has_profile';
  end if;

  insert into public.families (created_by) values (v_uid) returning id into v_family;
  insert into public.profiles (user_id, family_id, role) values (v_uid, v_family, 'child') returning id into v_profile;
  -- 무료 기간: 모든 기능 열림. 유료 전환 때 valid_until만 바꾼다.
  insert into public.entitlements (family_id, plan_id, source, valid_until) values (v_family, 'premium', 'free_period', null);

  return jsonb_build_object('family_id', v_family, 'profile_id', v_profile);
end $$;
