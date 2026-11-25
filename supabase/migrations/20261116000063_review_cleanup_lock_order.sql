-- 0063 잠금 순서 후속(#264 QA-1 L-a, 대기열 40). 0062가 정한 규칙 "profiles → device_tokens, 여러 프로필은 user_id 순서"에 심사 가족 정리를 맞춘다.
-- 문제: admin_cleanup_review_family(0058)는 어르신 프로필을 created_at 순서로 하나씩 account_delete_core에 넘겨, 앞 프로필을 쥔 채 다음 프로필을 잠근다.
--   register_push_token(0062)은 내 프로필과 같은 토큰의 이전 소유자 프로필을 user_id 순서로 잠근다. 같은 토큰을 거친 심사 어르신 둘과
--   관리자 정리가 겹치면(먼저 만든 쪽의 user_id가 더 클 때) 두 순서가 엇갈려 교착할 수 있다(supabase/ops/push-lock-race.sh C1로 재현).
-- 고침: 본문은 0058 정의 그대로, 잠금 두 줄만 — ① 가족 행을 먼저 잠그고(account_delete_core의 families → profiles와 같은 순서),
--   ② 어르신 프로필을 user_id, id 순서로 for update(반복 시작 때 잠김). 가족을 먼저 잡지 않고 프로필만 잠그면 같은 가족의 자녀 삭제
--   (families → profiles)와 반대 순서가 되므로 ①이 필요하다. 권한은 create or replace라 그대로.
-- 되돌리기: supabase/down/20261116000063_review_cleanup_lock_order.down.sql

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
  perform 1 from public.families where id = p_family for update; -- 0063: 가족 → 프로필 순서(account_delete_core와 같음)
  for v_pid in select id from public.profiles where family_id = p_family and role = 'parent' order by user_id, id for update loop -- 0063: created_at → user_id 순서 + 잠금
    if public.account_delete_core(v_pid) is not null then v_n := v_n + 1; end if;
  end loop;
  update public.invite_codes set disabled_at = now() where family_id = p_family and reusable;
  return jsonb_build_object('ok', true, 'parents_removed', v_n);
end $$;
