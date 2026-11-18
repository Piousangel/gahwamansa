-- 0046 약관·개인정보처리방침 동의 기록(법률 Q2, DECISIONS 11-19) + 푸시 문구 광고성 금지어 서버 검사(Q6)
-- (1) terms_agreements: 로그인한 사용자(인증 계정) 단위 이력 — 약관 버전·방침 버전·시각·그때 역할.
--     자녀는 로그인 때(가족 만들기 전일 수 있음), 어르신은 연결 화면의 약관 줄 동의 때(프로필 생기기 전일 수 있음) 부른다 → 프로필이 아니라 auth.users에 묶는다.
--     계정을 지우면 함께 지워진다(auth.users on delete cascade — 앱·관리자 삭제 모두 인증 계정까지 지움, D-05 동의 이력과 같은 원칙).
--     앱은 표를 직접 못 읽고 my_terms_status()로 내 최신 동의 버전만 본다(새 버전이면 다시 동의 화면을 띄울지 앱이 판단).
-- (2) record_terms_agreement(p_terms_version, p_privacy_version): 본인만(로그인 필수, anon 불가). 버전 형식 v<n>[.<n>] 또는 YYYY-MM-DD.
--     직전 기록과 두 버전이 같으면 새 이력을 남기지 않는다(앱 재시작마다 불러도 됨). 실패는 {ok:false, reason:'invalid_version'}.
-- (3) Q6: push_copy(제목·본문·대체·여러 개)와 cheer_texts 문장에 광고성 낱말이 들어가면 check 제약으로 거부(적재 스크립트 검사와 이중).
--     낱말 목록: 혜택·할인·이벤트·무료·쿠폰·적립·포인트·경품·광고·"다시 오세요". 정보성 알림 원칙(법률 체크리스트 #10).

create table public.terms_agreements (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'child', 'none')),
  terms_version text not null check (terms_version ~ '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  privacy_version text not null check (privacy_version ~ '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  agreed_at timestamptz not null default now()
);
create index on public.terms_agreements (user_id, agreed_at desc);
alter table public.terms_agreements enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.terms_agreements from public, anon, authenticated;
revoke all on sequence public.terms_agreements_id_seq from public, anon, authenticated;
revoke insert, update, delete, truncate on public.terms_agreements from service_role; -- 증빙: 서비스 역할도 고치지 못함(읽기만)

create function public.record_terms_agreement(p_terms_version text, p_privacy_version text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_last public.terms_agreements%rowtype;
  v_re text := '^(v[0-9]{1,3}(\.[0-9]{1,3})?|[0-9]{4}-[0-9]{2}-[0-9]{2})$';
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_terms_version is null or p_terms_version !~ v_re or p_privacy_version is null or p_privacy_version !~ v_re then
    return jsonb_build_object('ok', false, 'reason', 'invalid_version');
  end if;
  perform pg_advisory_xact_lock(hashtext('terms:' || v_uid::text));
  select * into v_last from public.terms_agreements where user_id = v_uid order by agreed_at desc, id desc limit 1;
  if found and v_last.terms_version = p_terms_version and v_last.privacy_version = p_privacy_version then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;
  insert into public.terms_agreements (user_id, role, terms_version, privacy_version)
  values (v_uid, coalesce(public.my_role(), 'none'), p_terms_version, p_privacy_version);
  return jsonb_build_object('ok', true, 'recorded', true);
end $$;

-- 본인 최신 동의: {terms_version, privacy_version, agreed_at} | {} (기록 없음)
create function public.my_terms_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce((select jsonb_build_object('terms_version', t.terms_version, 'privacy_version', t.privacy_version, 'agreed_at', t.agreed_at)
                     from public.terms_agreements t where t.user_id = auth.uid() order by t.agreed_at desc, t.id desc limit 1), '{}'::jsonb)
$$;

revoke execute on function public.record_terms_agreement(text, text), public.my_terms_status() from public, anon;
grant execute on function public.record_terms_agreement(text, text), public.my_terms_status() to authenticated;

-- Q6: 광고성 낱말 검사
create function public.push_text_clean(p text) returns boolean
language sql immutable set search_path = ''
as $$ select p is null or p !~ '(혜택|할인|이벤트|무료|쿠폰|적립|포인트|경품|광고|다시 오세요)' $$;
revoke execute on function public.push_text_clean(text) from public, anon, authenticated;

alter table public.push_copy
  add constraint push_copy_no_ads check (public.push_text_clean(title) and public.push_text_clean(body)
                                         and public.push_text_clean(body_fallback) and public.push_text_clean(body_many));
alter table public.cheer_texts add constraint cheer_texts_no_ads check (public.push_text_clean(text));
