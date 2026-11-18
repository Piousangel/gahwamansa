-- 0035 보안 후속(로드맵 SV-05). 근거: 서버 리뷰 0019~0026 R1, 개인정보 리뷰(2026-11-17-server-privacy-security) ①4·①9·③, 아키텍처 감사 A9·A19.
-- (1) R1 다층 방어: authenticated·anon의 content 두 표 쓰기 권한(insert·update·delete·truncate, Supabase 기본 grant) 회수. 읽기는 유지.
-- (2) give_consent의 default 'v1' 제거: 인자 없는 호출이 조용히 v1로 기록되던 증빙 오염을 막는다. 앱은 이미 p_version을 보낸다.
--     기본값은 create or replace로 지울 수 없어 drop → create(같은 이름·인자, 권한 다시 부여).
-- (3) 사진 버킷(0013) 원칙 재확인 — 이 버킷은 **AI가 만든 콘텐츠 사진 전용, 가족 개인 사진 금지**(공개 버킷이라 URL을 알면 누구나 읽음).
--     JPEG만·2MB(png 거부)는 0013 설정 그대로이며 pgTAP으로 감시한다. 가족 사진(빌드 2)은 비공개 버킷·RLS로 따로 만든다.
-- (4) 호칭: 목록 상수를 parent_titles() 한 곳으로(함수 검사용, check 제약은 같은 목록을 pgTAP으로 대조).
--     set_parent_title(가족 기본 호칭)도 겹침 검사 → duplicate_title로 set_parent_title_for와 reason을 맞춘다.
--     set_parent_title은 폐기 예정: 앱이 set_parent_title_for(어르신별)로 옮긴 뒤 빌드 2 첫 서버 묶음에서 제거(배포된 빌드 호환 기간).
--     규칙(ARCH §4): 역할 위반은 raise, 사용자 입력 문제는 {ok:false, reason} — 두 호칭 RPC 모두 invalid_title·invalid_target·duplicate_title.

revoke insert, update, delete, truncate on public.content_photos, public.content_questions from authenticated, anon;

create function public.parent_titles() returns text[]
language sql immutable set search_path = ''
as $$ select array['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'] $$;
grant execute on function public.parent_titles() to authenticated;

drop function public.give_consent(text);
create function public.give_consent(p_version text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_prev_at timestamptz;
  v_prev_ver text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if p_version is null or p_version !~ '^v[0-9]{1,3}$' then raise exception 'invalid_version'; end if;
  select consented_at, consent_version into v_prev_at, v_prev_ver from public.profiles where id = v_me for update;
  if v_prev_at is not null and v_prev_ver is not distinct from p_version then
    return;
  end if;
  update public.profiles set consented_at = now(), consent_version = p_version where id = v_me;
  insert into public.consent_events (parent_id, family_id, action, version)
  values (v_me, public.my_family_id(), 'given', p_version);
end $$;
revoke execute on function public.give_consent(text) from public, anon;
grant execute on function public.give_consent(text) to authenticated;

-- set_parent_title(0012) + 목록 상수 + 겹침 검사 + 폐기 예정
create or replace function public.set_parent_title(p_title text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_title is null or not (p_title = any (public.parent_titles())) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_title');
  end if;
  perform 1 from public.families where id = v_family for update;
  -- 기본 호칭은 자기 호칭이 없는 어르신에게 보인다. 그런 어르신이 있고 다른 어르신이 이미 그 호칭이면 겹친다.
  if exists (select 1 from public.profiles where family_id = v_family and role = 'parent' and parent_title is null)
     and exists (select 1 from public.profiles where family_id = v_family and role = 'parent' and parent_title = p_title) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_title');
  end if;
  update public.families set parent_title = p_title where id = v_family;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.set_parent_title(text) is
  'deprecated: 가족 기본 호칭. 앱은 set_parent_title_for(p_parent, p_title)를 쓴다. 빌드 2 첫 서버 묶음에서 제거 예정(0035).';

-- set_parent_title_for(0028) + 목록 상수(동작 동일)
create or replace function public.set_parent_title_for(p_parent uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_title is null or not (p_title = any (public.parent_titles())) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_title');
  end if;
  if not exists (select 1 from public.profiles where id = p_parent and family_id = v_family and role = 'parent') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_target');
  end if;
  perform 1 from public.families where id = v_family for update;
  if exists (
    select 1 from public.profiles p join public.families f on f.id = p.family_id
     where p.family_id = v_family and p.role = 'parent' and p.id <> p_parent
       and coalesce(p.parent_title, f.parent_title) = p_title) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_title');
  end if;
  update public.profiles set parent_title = p_title where id = p_parent;
  return jsonb_build_object('ok', true);
end $$;
