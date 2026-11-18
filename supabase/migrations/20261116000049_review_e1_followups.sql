-- 0049 xhigh 리뷰(docs/team/reviews/2026-11-19-server-e1-e4-0048-review.md) 후속
-- M1 public 뷰 쓰기 권한 회수: 단순 뷰(kakao_unlink_gave_up)는 자동 갱신 가능하고 소유자(postgres) 권한으로 큐에 쓰인다.
--    Supabase 기본 권한이 새 relation에 service_role 전체 권한을 주므로, 서비스 키로 포기 행을 고치거나 지워 감사(0047 retry·resolve)를 우회할 수 있었다.
--    content_runway(0039)도 같은 기본 권한을 받았다(집계 뷰라 쓰기는 안 되지만 권한 표를 같게 맞춘다). 둘 다 select만 남긴다.
-- M2 admin_check_args: NFKC(전각 ＠·숫자 → 반각) → uuid를 걷어낸 뒤 → 숫자 사이 하이픈·공백·점을 지우고 9자리 이상이면 거부.
--    메일은 `@` 또는 "이름 at 도메인 dot com". 접수 번호 규칙: 숫자 8자리 이하 또는 #n(날짜는 11-19·2026-11-19, 시각은 적지 않음).
-- L1·법률 push_text_clean: 보이지 않는 글자·문장부호를 먼저 지우고(한글·자모·영문·숫자만 남김) NFKC로 합친 뒤, 다시 완성형 한글·영문·숫자만 남겨 검사.
--    NFD로 쪼갠 낱말, soft hyphen·한글 채움·CGJ·보이지 않는 구분자, `혜·택`·`할.인` 모두 거부. "유료" 추가(방침 2절·load-push-copy 목록과 같음).
--    과잉 거부("무료한 오후"·"사진의 포인트"·"가족 생일 이벤트")는 그대로 둔다: 공백을 지우는 이상 "무료 한 달"과 구분할 수 없고, 운영자만 적재하므로
--    문구를 바꿔 쓰는 쪽이 안전하다(낱말 좁히기는 법률 줄 확인 뒤, dev-server-notes §17).

revoke insert, update, delete, truncate, references, trigger on public.kakao_unlink_gave_up, public.content_runway from service_role;

create or replace function public.admin_check_args(p_reason text, p_operator text) returns void
language plpgsql volatile set search_path = ''
as $$
declare
  v text;
begin
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason_required'; end if;
  if p_operator is null or btrim(p_operator) = '' then raise exception 'operator_required'; end if;
  v := lower(normalize(p_reason || ' ' || p_operator, NFKC));
  v := regexp_replace(v, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ' ', 'g');
  if v ~ '@' or v ~ '[a-z0-9._-]+\s*[\(\[]?\s*at\s*[\)\]]?\s+[a-z0-9-]+\s*[\(\[]?\s*(dot|\.)\s*[\)\]]?\s*[a-z]{2,}' then
    raise exception 'pii_in_args'; -- 메일 주소
  end if;
  v := regexp_replace(v, '([0-9])[-. ]+(?=[0-9])', '\1', 'g');
  if v ~ '[0-9]{9,}' then
    raise exception 'pii_in_args'; -- 전화·카드·계좌 번호 등(접수 번호는 8자리 이하 또는 #n)
  end if;
end $$;

create or replace function public.push_text_clean(p text) returns boolean
language sql immutable set search_path = ''
as $$
  select p is null
      or regexp_replace(normalize(regexp_replace(p, '[^가-힣ᄀ-ᇿ㄰-㆏ﾠ-ￜa-zA-Z0-9]', '', 'g'), NFKC), '[^가-힣a-zA-Z0-9]', '', 'g')
         !~ '(혜택|할인|이벤트|무료|유료|쿠폰|적립|포인트|경품|광고|다시오세요)'
$$;
alter table public.push_copy drop constraint push_copy_no_ads,
  add constraint push_copy_no_ads check (public.push_text_clean(title) and public.push_text_clean(body)
                                         and public.push_text_clean(body_fallback) and public.push_text_clean(body_many));
alter table public.cheer_texts drop constraint cheer_texts_no_ads,
  add constraint cheer_texts_no_ads check (public.push_text_clean(text));

-- 법률 리뷰 M1(방침 게시 조건 P20): 가족과 연결하기 전(프로필 없음, 역할 none) 계정도 지울 수 있게 한다.
--    그 사이에도 terms_agreements(0046)·푸시 토큰·소셜 식별 정보가 쌓이는데, delete_my_account는 no_profile을 던지고 admin_delete_account는 프로필 id로만 찾았다.
--    - 앱: delete_my_account()가 프로필이 없으면 본인 인증 계정을 지우고 {scope:'none'}(이전: no_profile 예외). delete_scope_preview()도 {scope:'none'}.
--    - 운영: admin_delete_user(auth 사용자 id, 사유, 처리자) — 프로필 없는 계정만(있으면 has_profile → admin_delete_account를 쓴다). 감사 행(delete_user).
--    공통 내부 함수 user_delete_core: 토큰을 지우고 카카오 회원번호를 해제 큐에 넣은 뒤(0042와 같은 규칙) auth.users 삭제 → terms_agreements·identities cascade.
--    인증 사용자 행을 먼저 잠가(for update) 같은 순간의 연결(redeem: 프로필 insert의 FK key share 잠금)과 줄 세운 뒤 프로필 유무를 본다.

create function public.user_delete_core(p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from auth.users where id = p_user for update;
  if not found then return null; end if;
  if exists (select 1 from public.profiles where user_id = p_user) then return jsonb_build_object('scope', 'has_profile'); end if;
  delete from public.device_tokens where user_id = p_user;
  insert into public.kakao_unlink_queue (kakao_user_id)
  select provider_id from auth.identities where user_id = p_user and provider = 'kakao';
  delete from auth.users where id = p_user;
  return jsonb_build_object('scope', 'none');
end $$;
revoke execute on function public.user_delete_core(uuid) from public, anon, authenticated, service_role;

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_res jsonb;
begin
  if v_me is not null then return public.account_delete_core(v_me); end if;
  if auth.uid() is null then raise exception 'no_profile'; end if;
  v_res := public.user_delete_core(auth.uid());
  if v_res ->> 'scope' = 'has_profile' then -- 확인 직후 연결된 경우: 프로필 기준으로 다시
    return public.account_delete_core(public.my_profile_id());
  end if;
  return jsonb_build_object('scope', 'none'); -- 인증 행이 이미 없어도(null) 같은 답
end $$;

create or replace function public.delete_scope_preview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_role text := public.my_role();
begin
  if v_me is null then
    if auth.uid() is null then raise exception 'no_profile'; end if;
    return jsonb_build_object('scope', 'none'); -- 연결 전 계정: 본인 인증 계정·동의 기록만
  end if;
  if v_role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_family and role = 'child' and id <> v_me
  ) then
    return jsonb_build_object('scope', 'family');
  end if;
  return jsonb_build_object('scope', v_role);
end $$;

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire',
                                                            'content_image_url', 'test_family_mark', 'kakao_retry', 'kakao_resolve',
                                                            'terms_publish', 'delete_user'));

-- 서비스 역할: 프로필 없는 인증 계정 삭제(웹 삭제 요청 중 가족 연결 전 계정). {ok, scope:'none'} | {ok:false, reason:'not_found'|'has_profile'}
create function public.admin_delete_user(p_user uuid, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_res jsonb;
begin
  perform public.admin_check_args(p_reason, p_operator);
  v_res := public.user_delete_core(p_user);
  if v_res is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_res ->> 'scope' = 'has_profile' then return jsonb_build_object('ok', false, 'reason', 'has_profile'); end if;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'delete_user', btrim(p_reason), jsonb_build_object('user_id', p_user, 'scope', 'none'));
  return jsonb_build_object('ok', true, 'scope', 'none');
end $$;
revoke execute on function public.admin_delete_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid, text, text) to service_role;
