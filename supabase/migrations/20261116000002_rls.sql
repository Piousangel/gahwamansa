-- 0002 RLS: 설계 근거 docs/team/dev.md §3 + 결정(동의 거부 시 답변 저장 안 함)
-- 헬퍼: RLS 재귀를 피하려고 security definer, search_path 고정.
create function public.my_profile_id() returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.profiles where user_id = auth.uid() $$;

create function public.my_family_id() returns uuid language sql stable security definer set search_path = ''
as $$ select family_id from public.profiles where user_id = auth.uid() $$;

create function public.my_role() returns text language sql stable security definer set search_path = ''
as $$ select role from public.profiles where user_id = auth.uid() $$;

-- 어르신이 공개에 동의했는가 (answers 저장 조건)
create function public.my_consented() returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select consented_at is not null from public.profiles where user_id = auth.uid()), false) $$;

-- 로그인 전(anon) 접근 전면 차단. 익명 로그인 사용자도 role=authenticated임에 유의.
revoke all on all tables in schema public from anon;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- 쓰기 정책이 없는 테이블은 클라이언트가 쓸 수 없다(기본 거부). redeem_attempts는 정책 없음 = 전면 거부.

-- 같은 가족 구성원만 가족/프로필 조회 (쓰기는 RPC만)
create policy families_read on public.families for select to authenticated using (id = public.my_family_id());
create policy profiles_read on public.profiles for select to authenticated using (family_id = public.my_family_id());

-- 자녀만 자기 가족 코드 목록 조회(어르신은 코드 못 봄). 발급·사용은 RPC.
create policy codes_read on public.invite_codes for select to authenticated
  using (family_id = public.my_family_id() and public.my_role() = 'child');

-- 콘텐츠·플랜: 로그인 사용자 읽기 전용 (쓰기는 마이그레이션/서비스 롤)
create policy photos_read on public.content_photos for select to authenticated using (true);
create policy questions_read on public.content_questions for select to authenticated using (true);
create policy plans_read on public.plans for select to authenticated using (true);

-- 답변: 가족만 읽되 어르신은 본인 것만, 자녀는 가족 전체. 쓰기는 "동의한" 어르신 본인만, 수정·삭제 불가
create policy answers_read on public.answers for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or parent_id = public.my_profile_id()));
create policy answers_insert on public.answers for insert to authenticated
  with check (
    public.my_role() = 'parent'
    and public.my_consented()
    and parent_id = public.my_profile_id()
    and family_id = public.my_family_id()
  );

-- 세션: 가족만 읽기, 쓰기는 record_session_step RPC만 (직접 쓰기 정책 없음)
create policy sessions_read on public.daily_sessions for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or parent_id = public.my_profile_id()));

-- 응원: 자녀는 가족 어르신에게만 보내기, 어르신은 자기에게 온 것만 읽고 read_at만 수정
create policy cheers_read on public.cheers for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or to_parent = public.my_profile_id()));
create policy cheers_insert on public.cheers for insert to authenticated
  with check (
    public.my_role() = 'child'
    and from_child = public.my_profile_id()
    and family_id = public.my_family_id()
    and exists (select 1 from public.profiles p where p.id = to_parent and p.family_id = public.my_family_id() and p.role = 'parent')
  );
revoke update on public.cheers from authenticated;
grant update (read_at) on public.cheers to authenticated;
create policy cheers_mark_read on public.cheers for update to authenticated
  using (to_parent = public.my_profile_id()) with check (to_parent = public.my_profile_id());

-- 권한: 가족 구성원이 읽기, 쓰기는 서비스 롤(결제 웹훅)/seed만
create policy ent_read on public.entitlements for select to authenticated using (family_id = public.my_family_id());

-- 푸시 토큰: 내 것만
create policy tokens_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
