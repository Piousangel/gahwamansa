-- 0048 약관 동의 리뷰 반영(docs/team/reviews/2026-11-19-terms-consent-review.md TA-M1·낮음)
-- TA-M1 terms_versions(kind terms|privacy, version, published_at): 게시된 버전 목록. 서비스 역할이 admin_publish_terms_version(종류, 버전, 사유, 처리자)으로만 추가(감사 terms_publish).
--       record_terms_agreement는 게시된 버전만 받는다(unknown_version). my_terms_status는 최신 게시 버전과 비교해 needs_reagree를 준다.
--       최신 = 같은 종류에서 published_at이 가장 늦은 것. 게시를 되돌리지 않는다(지난 동의의 근거).
-- 낮음 ① 같은 사용자·같은 버전 쌍은 한 번만 기록(유일 제약) — 두 쌍을 번갈아 보내도 이력이 늘지 않는다.
-- 낮음 ② 금지어 검사는 공백·폭 없는 공백(U+200B~U+200D·U+2060·U+FEFF)을 지운 뒤. check 제약은 함수만 바꾸면 기존 행을 다시 보지 않으므로
--         제약을 지웠다 다시 만들어 기존 행도 새 규칙으로 재검사한다(앞으로 push_text_clean을 바꿀 때도 같은 방식).

create table public.terms_versions (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null check (version ~ '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  published_at timestamptz not null default now(),
  primary key (kind, version)
);
alter table public.terms_versions enable row level security; -- 정책 없음 = 클라이언트 전면 거부(앱은 my_terms_status로)
revoke all on public.terms_versions from public, anon, authenticated;
revoke insert, update, delete, truncate on public.terms_versions from service_role; -- 게시는 함수로만(감사)

-- 같은 사용자·같은 쌍은 한 줄(이미 쌓인 중복이 있으면 가장 이른 것만 남긴다)
delete from public.terms_agreements t using public.terms_agreements o
 where t.user_id = o.user_id and t.terms_version = o.terms_version and t.privacy_version = o.privacy_version and t.id > o.id;
create unique index terms_agreements_pair_key on public.terms_agreements (user_id, terms_version, privacy_version);

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire',
                                                            'content_image_url', 'test_family_mark', 'kakao_retry', 'kakao_resolve', 'terms_publish'));

create function public.admin_publish_terms_version(p_kind text, p_version text, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_check_args(p_reason, p_operator);
  if p_kind is null or p_kind not in ('terms', 'privacy') then return jsonb_build_object('ok', false, 'reason', 'invalid_kind'); end if;
  if p_version is null or p_version !~ '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_version');
  end if;
  insert into public.terms_versions (kind, version) values (p_kind, p_version) on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'already_published'); end if;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'terms_publish', btrim(p_reason), jsonb_build_object('kind', p_kind, 'version', p_version));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_publish_terms_version(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_publish_terms_version(text, text, text, text) to service_role;

create or replace function public.record_terms_agreement(p_terms_version text, p_privacy_version text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_re text := '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$';
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_terms_version is null or p_terms_version !~ v_re or p_privacy_version is null or p_privacy_version !~ v_re then
    return jsonb_build_object('ok', false, 'reason', 'invalid_version');
  end if;
  if not exists (select 1 from public.terms_versions where kind = 'terms' and version = p_terms_version)
     or not exists (select 1 from public.terms_versions where kind = 'privacy' and version = p_privacy_version) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_version');
  end if;
  insert into public.terms_agreements (user_id, role, terms_version, privacy_version)
  values (v_uid, coalesce(public.my_role(), 'none'), p_terms_version, p_privacy_version)
  on conflict (user_id, terms_version, privacy_version) do nothing;
  return jsonb_build_object('ok', true, 'recorded', found);
end $$;

-- {latest_terms, latest_privacy, needs_reagree[, terms_version, privacy_version, agreed_at]} — 동의 기록이 없으면 needs_reagree=true
create or replace function public.my_terms_status() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_lt text := (select version from public.terms_versions where kind = 'terms' order by published_at desc, version desc limit 1);
  v_lp text := (select version from public.terms_versions where kind = 'privacy' order by published_at desc, version desc limit 1);
  v_last public.terms_agreements%rowtype;
begin
  select * into v_last from public.terms_agreements where user_id = auth.uid() order by agreed_at desc, id desc limit 1;
  if not found then
    return jsonb_strip_nulls(jsonb_build_object('latest_terms', v_lt, 'latest_privacy', v_lp, 'needs_reagree', true));
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'terms_version', v_last.terms_version, 'privacy_version', v_last.privacy_version, 'agreed_at', v_last.agreed_at,
    'latest_terms', v_lt, 'latest_privacy', v_lp,
    'needs_reagree', not exists (select 1 from public.terms_agreements a where a.user_id = auth.uid()
                                  and a.terms_version is not distinct from v_lt and a.privacy_version is not distinct from v_lp)));
end $$;

-- 금지어: 공백·폭 없는 공백 제거 뒤 검사
create or replace function public.push_text_clean(p text) returns boolean
language sql immutable set search_path = ''
as $$
  select p is null
      or regexp_replace(p, '[[:space:]​‌‍⁠﻿]', '', 'g') !~ '(혜택|할인|이벤트|무료|쿠폰|적립|포인트|경품|광고|다시오세요)'
$$;
-- 함수만 바꾸면 기존 행은 다시 검사되지 않는다 → 제약을 다시 만들어 기존 행도 새 규칙으로 검사
alter table public.push_copy drop constraint push_copy_no_ads,
  add constraint push_copy_no_ads check (public.push_text_clean(title) and public.push_text_clean(body)
                                         and public.push_text_clean(body_fallback) and public.push_text_clean(body_many));
alter table public.cheer_texts drop constraint cheer_texts_no_ads,
  add constraint cheer_texts_no_ads check (public.push_text_clean(text));
