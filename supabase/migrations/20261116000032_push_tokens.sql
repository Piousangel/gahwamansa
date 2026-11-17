-- 0032 푸시 토큰 등록·해제 RPC (로드맵 SV-01, 마스터 계획 U15). 기존 device_tokens(0001) 재사용.
-- - register_push_token(p_token, p_platform='android'): 가족에 연결된 사용자(프로필 있음: 어르신·자녀)만. 연결 전 기기는 no_profile
--   (보낼 알림이 없고, 연결 후 다시 등록한다). 토큰 형식 ^[A-Za-z0-9_:-]+$ + 길이 20~4096(정규식 반복 상한 255 때문에 길이는 따로), 플랫폼 android·ios.
--   같은 토큰(=같은 기기 앱 설치)을 다른 계정이 등록하면 이전 계정 행을 지운다 — 한 기기 한 역할(DECISIONS 11-17), 남의 알림 오배달 방지.
--   사용자당 최근 5개(updated_at 기준)만 남긴다(재설치·폰 교체로 쌓인 죽은 토큰 정리, 발송 함수의 무효 토큰 정리와 별개).
-- - unregister_push_token(p_token): 본인 행만 지운다(로그아웃·알림 끄기). {ok, removed}.
-- - 테이블 직접 쓰기 회수: tokens_own(for all) → tokens_read(select, 본인만). 쓰기는 이 RPC와 서버 함수만.
-- - 삭제: delete_my_account(0017·0026)가 본인·가족 토큰을 지우고, auth.users 삭제 cascade도 있다.
-- 실패는 {ok:false, reason}: invalid_token | invalid_platform | no_profile. anon 실행 불가.

alter table public.device_tokens add constraint device_tokens_platform_check check (platform in ('android', 'ios'));
create index if not exists device_tokens_token_idx on public.device_tokens (token);

drop policy tokens_own on public.device_tokens;
create policy tokens_read on public.device_tokens for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.device_tokens from authenticated, anon;

create function public.register_push_token(p_token text, p_platform text default 'android') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9_:-]+$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_platform');
  end if;
  if public.my_profile_id() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  delete from public.device_tokens where token = p_token and user_id <> v_uid;
  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (user_id, token) do update set platform = excluded.platform, updated_at = excluded.updated_at;
  delete from public.device_tokens
   where user_id = v_uid
     and token not in (select token from public.device_tokens where user_id = v_uid order by updated_at desc, token limit 5);
  return jsonb_build_object('ok', true);
end $$;

create function public.unregister_push_token(p_token text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  delete from public.device_tokens where user_id = auth.uid() and token = p_token;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'removed', v_n);
end $$;

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;
