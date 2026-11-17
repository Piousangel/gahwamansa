-- 0020 응원 RPC: send_cheer(자녀→어르신), get_my_cheers·mark_cheers_read(받는 어르신 본인만)
-- 근거: docs/team/copy-v3-confirmed.md 6절 C4 cheers "확정 4개, 이 목록만 사용"(키는 docs/design/v3/screens/child/_manifest/child.json),
--       docs/team/reviews/2026-11-17-design-v3-ux.md 11번(응원이 쌓이는 압박 → 하루 1~2회 제한 제안).
-- 결정(서버, 가정): 하루 한도 = 같은 자녀→같은 어르신 KST 하루 2개. 정책 검토 후 상수만 바꾸면 된다.
-- 직접 insert 정책(0002 cheers_insert)을 없애 화이트리스트·한도를 우회하지 못하게 한다. 자녀는 여전히 cheers를 읽지 못한다(0014, read_at 비공개).

drop policy if exists cheers_insert on public.cheers;
revoke insert on public.cheers from authenticated;

-- 자녀만. 실패는 {ok:false, reason}: invalid_key | invalid_target | disconnected | daily_limit
create function public.send_cheer(p_parent uuid, p_key text) returns jsonb
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
  perform 1 from public.profiles where id = v_me for update; -- 같은 자녀의 동시 전송을 줄 세워 한도 우회 방지
  if (select count(*) from public.cheers
       where from_child = v_me and to_parent = p_parent
         and (sent_at at time zone 'Asia/Seoul')::date = public.kst_today()) >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;
  insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at)
  values (v_family, v_me, p_parent, p_key, clock_timestamp())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'cheer_id', v_id);
end $$;

-- 어르신 본인만. 안 읽은 응원(최신순, 최대 20개)과 개수. 보낸 자녀는 밝히지 않는다(문구 "가족이 보낸 응원이에요").
create function public.get_my_cheers() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  return jsonb_build_object(
    'unread_count', (select count(*)::int from public.cheers where to_parent = v_me and read_at is null),
    'cheers', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'message_key', c.message_key, 'sent_at', c.sent_at)
                       order by c.sent_at desc, c.id)
        from (select * from public.cheers where to_parent = v_me and read_at is null
               order by sent_at desc, id limit 20) c), '[]'::jsonb));
end $$;

-- 어르신 본인만. p_ids가 null이면 안 읽은 응원 전부, 아니면 그중 내 것만 읽음 처리. 바뀐 개수를 돌려준다.
create function public.mark_cheers_read(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  update public.cheers set read_at = now()
   where to_parent = public.my_profile_id() and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.send_cheer(uuid, text), public.get_my_cheers(), public.mark_cheers_read(uuid[]) from public, anon;
grant execute on function public.send_cheer(uuid, text), public.get_my_cheers(), public.mark_cheers_read(uuid[]) to authenticated;
