-- 0032 되돌리기(수동). 순서: 앱이 RPC를 더 부르지 않는 빌드인지 먼저 확인 → 이 파일 실행.
drop function if exists public.register_push_token(text, text);
drop function if exists public.unregister_push_token(text);
drop policy if exists tokens_read on public.device_tokens;
grant insert, update, delete on public.device_tokens to authenticated;
create policy tokens_own on public.device_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop index if exists public.device_tokens_token_idx;
alter table public.device_tokens drop constraint if exists device_tokens_platform_check;
