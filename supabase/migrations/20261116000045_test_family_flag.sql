-- 0045 테스터 가족 표시(리드 결정 11-18, DECISIONS is_test): 비공개 테스트 테스터 가족을 지표에서 빼기 위한 표시.
-- families.is_test(기본 false). 심사 가족(is_review, 0025)과 별개 — 심사 가족은 알림도 안 가지만 테스터 가족은 알림·기능 모두 그대로, 지표 SQL에서만 뺀다.
-- 앱은 바꿀 수 없다(families에 앱 쓰기 정책 없음 + 이 열 update 권한 회수). 서비스 역할은 admin_set_test_family(대상, 값, 사유, 처리자)로만 — 감사 행(test_family_mark).
-- 운영: supabase/ops/mark-test-family.mjs(자녀 메일 또는 가족 id로 표시/해제, 대상 호스트 대조).

alter table public.families add column is_test boolean not null default false;
-- 표 단위 UPDATE가 남아 있으면 열 단위 회수가 효과가 없다 → families 직접 UPDATE를 앱·서비스 역할 모두에서 회수.
-- families 쓰기는 이미 definer 함수만 한다(set_parent_title·admin_create_review_family·admin_set_review_code 등). RLS도 앱 update 정책이 없다.
revoke update on public.families from authenticated, anon, service_role;

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire', 'content_image_url', 'test_family_mark'));

create function public.admin_set_test_family(p_family uuid, p_is_test boolean, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_check_args(p_reason, p_operator);
  if p_is_test is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  update public.families set is_test = p_is_test where id = p_family;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  insert into public.admin_audit (operator, action, target_family, reason, detail)
  values (btrim(p_operator), 'test_family_mark', p_family, btrim(p_reason), jsonb_build_object('is_test', p_is_test));
  return jsonb_build_object('ok', true, 'is_test', p_is_test);
end $$;
revoke execute on function public.admin_set_test_family(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_test_family(uuid, boolean, text, text) to service_role;

-- 재검토 Q-L1(0044): 사진 주소 변경 감사의 처리자를 실제 호출 역할로. 트리거는 definer라 current_user가 소유자(postgres)로 찍혔다.
-- current_setting('role')은 PostgREST·set role로 바뀐 역할(service_role 등), 없으면 접속 사용자(Studio = postgres).
create or replace function public.content_image_url_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    insert into public.admin_audit (operator, action, reason, detail)
    values (left(coalesce(nullif(current_setting('role', true), 'none'), session_user), 60), 'content_image_url', '사진 주소 변경',
            jsonb_build_object('day_index', new.day_index, 'host', substring(new.image_url from '^https?://([^/]+)')));
  end if;
  return new;
end $$;
