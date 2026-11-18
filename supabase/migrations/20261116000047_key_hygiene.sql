-- 0047 보안 회의(docs/team/board/2026-11-19-encryption-keys/SUMMARY.md) 서버 몫 E1·E7
-- D4 profiles.display_name 제거: 쓰는 곳 0, 가족에게 읽기가 열려 있던 열. 0014의 열 단위 읽기 grant를 다시 쓴다(호칭 parent_title 포함).
-- D5 admin_check_args: 사유·처리자에 `@`(메일 주소)·9자리 이상 숫자열(전화·카드·계좌 번호 등)이 있으면 pii_in_args로 거부(감사 행 1년 보관).
--    정상 사유("메일 요청 #3(11-19 접수)"·"staging 테스트 가족 정리(개발자 메뉴)"·"11월 3주차 추가")는 통과.
-- D6 공용 push_kick은 서비스 역할도 직접 못 부른다(종류별 kick만 — kick은 Vault 비밀값을 읽어 외부로 보냄).
--    pg_net(net.*)·vault의 anon·authenticated 권한은 플랫폼(supabase_admin)이 준 것이라 마이그레이션으로 회수할 수 없다 →
--    pgTAP이 "public에서 pg_net을 쓰는 함수는 push_kick뿐·앱이 부를 수 있는 invoker 동적 SQL 없음"을 고정하고, remote-checks가 원격 값을 감시한다.
-- D2·E7 카카오 포기 행: 서비스 역할도 큐의 회원번호를 직접 읽지 못한다(select 회수). 포기 목록은 회원번호 없는 뷰로 보고,
--    키를 고친 뒤 재시도(admin_kakao_unlink_retry) 또는 카카오 콘솔 수동 해제 뒤 처리 완료(admin_kakao_unlink_resolve) — 둘 다 감사(회원번호 없이).

alter table public.profiles drop column display_name;
revoke select on public.profiles from authenticated;
grant select (id, user_id, family_id, role, created_at, parent_title) on public.profiles to authenticated;

create or replace function public.admin_check_args(p_reason text, p_operator text) returns void
language plpgsql volatile set search_path = ''
as $$
begin
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason_required'; end if;
  if p_operator is null or btrim(p_operator) = '' then raise exception 'operator_required'; end if;
  if (p_reason || ' ' || p_operator) ~ '@' or (p_reason || ' ' || p_operator) ~ '[0-9]{9,}' then
    raise exception 'pii_in_args'; -- 메일 주소·긴 번호는 사유·처리자에 적지 않는다(접수 번호·날짜만)
  end if;
end $$;

revoke execute on function public.push_kick(text) from service_role;

revoke select on public.kakao_unlink_queue from service_role;
create view public.kakao_unlink_gave_up as
  select id, enqueued_at, attempts, last_http, gave_up_at from public.kakao_unlink_queue where gave_up_at is not null;
revoke all on public.kakao_unlink_gave_up from public, anon, authenticated;
grant select on public.kakao_unlink_gave_up to service_role;

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire',
                                                            'content_image_url', 'test_family_mark', 'kakao_retry', 'kakao_resolve'));

-- 서비스 역할: 포기 행을 처음부터 다시 대기(어드민 키를 고친 뒤)
create function public.admin_kakao_unlink_retry(p_id bigint, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_check_args(p_reason, p_operator);
  update public.kakao_unlink_queue set attempts = 0, gave_up_at = null, last_http = null, next_attempt_at = now()
   where id = p_id and gave_up_at is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_gave_up'); end if;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'kakao_retry', btrim(p_reason), jsonb_build_object('queue_id', p_id));
  return jsonb_build_object('ok', true);
end $$;

-- 서비스 역할: 카카오 콘솔 등에서 수동 해제를 마친 행을 지운다(회원번호 보관 안 함)
create function public.admin_kakao_unlink_resolve(p_id bigint, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_check_args(p_reason, p_operator);
  delete from public.kakao_unlink_queue where id = p_id and gave_up_at is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_gave_up'); end if;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'kakao_resolve', btrim(p_reason), jsonb_build_object('queue_id', p_id));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_kakao_unlink_retry(bigint, text, text), public.admin_kakao_unlink_resolve(bigint, text, text) from public, anon, authenticated;
grant execute on function public.admin_kakao_unlink_retry(bigint, text, text), public.admin_kakao_unlink_resolve(bigint, text, text) to service_role;
