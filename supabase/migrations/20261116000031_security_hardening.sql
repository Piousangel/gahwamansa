-- 0031 Supabase advisors 경고 처리(staging 0018~0030 반영 후 리드 요청)
-- (1) anon이 실행할 수 있던 SECURITY DEFINER helper 4개(0002): my_profile_id·my_family_id·my_role·my_consented.
--     anon·PUBLIC 실행 권한을 회수한다. RLS 정책은 모두 `to authenticated`이고 정책 식이 helper를 부르므로(쿼리하는 역할 권한으로 실행)
--     authenticated 실행 권한은 **유지해야 한다**(회수하면 answers·cheers·profiles 등 모든 RLS 조회가 42501로 깨진다).
--     anon은 0002부터 테이블 권한이 없어 helper가 필요 없다. 다른 definer 함수 안에서 부르는 helper는 함수 소유자 권한이라 영향 없음.
-- (2) kst_today(0005): search_path 고정(now()·date는 pg_catalog라 '' 로 충분).
-- (3) auth_rls_initplan: device_tokens.tokens_own의 auth.uid()를 (select auth.uid())로 — 행마다가 아니라 쿼리당 한 번 평가.
-- authenticated가 실행할 수 있는 나머지 definer RPC는 설계상 의도(앱이 부르는 RPC, 함수 안에서 역할·가족 검사) — docs/team/dev-server-notes.md §7 표.

revoke execute on function public.my_profile_id(), public.my_family_id(), public.my_role(), public.my_consented() from public, anon;
grant execute on function public.my_profile_id(), public.my_family_id(), public.my_role(), public.my_consented() to authenticated;

alter function public.kst_today() set search_path = '';

drop policy tokens_own on public.device_tokens;
create policy tokens_own on public.device_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
