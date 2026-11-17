-- 0018 남은 가입 번호 무효화 (설계 세션 리뷰 2026-11-17 A항 높음). 실행: npx supabase test db
-- 보호하는 것: 새 번호를 받으면 같은 가족의 이전 미사용 가입 번호는 더 쓸 수 없고,
--             어르신이 연결되면 같은 가족의 남은 가입 번호도 더 쓸 수 없다(다른 사람이 '부모'로 들어오는 것 차단).
--             무효화된 번호는 'expired' 로 답한다(어르신 화면: "가족에게 새 번호를 받아 주세요").
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous) values
  ('91000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족P 자녀
  ('91000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 어르신(정상 연결)
  ('91000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true),  -- 남은 번호를 손에 넣은 다른 사람
  ('92000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 다른 가족Q 자녀
  ('92000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 가족Q 어르신(재연결 대상)
insert into public.families (id, created_by) values
  ('9f100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-0000000000c1'),
  ('9f200000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('9b100000-0000-0000-0000-0000000000c1', '91000000-0000-0000-0000-0000000000c1', '9f100000-0000-0000-0000-000000000001', 'child'),
  ('9b200000-0000-0000-0000-0000000000c1', '92000000-0000-0000-0000-0000000000c1', '9f200000-0000-0000-0000-000000000001', 'child'),
  ('9b200000-0000-0000-0000-0000000000a1', '92000000-0000-0000-0000-0000000000a1', '9f200000-0000-0000-0000-000000000001', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create temp table codes (name text primary key, code text);
grant all on codes to public;

-- 1~3. 새 번호 발급 → 이전 미사용 가입 번호는 만료, 쓸 수 있는 가입 번호는 1개
select pg_temp.act_as('91000000-0000-0000-0000-0000000000c1', false);
insert into codes values ('old', public.issue_invite_code());
insert into codes values ('new', public.issue_invite_code());
reset role;
select is((select count(*)::int from public.invite_codes
            where family_id = '9f100000-0000-0000-0000-000000000001' and used_at is null and expires_at > now()), 1,
          '쓸 수 있는 가입 번호는 가장 새 번호 1개뿐이다');
select is((select code::text from public.invite_codes
            where family_id = '9f100000-0000-0000-0000-000000000001' and used_at is null and expires_at > now()),
          (select code from codes where name = 'new'), '남은 1개는 방금 받은 번호다');
select pg_temp.act_as('91000000-0000-0000-0000-0000000000e1', true);
select is((public.redeem_invite_code((select code from codes where name = 'old'))) ->> 'reason', 'expired',
          '이전 번호로는 들어올 수 없다(expired)');
reset role;

-- 4~7. 어르신이 연결되면 같은 가족의 남은 가입 번호는 무효
insert into public.invite_codes (code, family_id, created_by) values
  ('912345', '9f100000-0000-0000-0000-000000000001', '9b100000-0000-0000-0000-0000000000c1'); -- 0018 이전에 남아 있던 번호(가정)
select pg_temp.act_as('91000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code((select code from codes where name = 'new'))) ->> 'ok', 'true', '어르신은 받은 번호로 연결된다');
reset role;
select is((select count(*)::int from public.invite_codes
            where family_id = '9f100000-0000-0000-0000-000000000001' and used_at is null and expires_at > now()), 0,
          '연결 뒤에는 같은 가족에 쓸 수 있는 가입 번호가 없다');
select pg_temp.act_as('91000000-0000-0000-0000-0000000000e1', true);
select is((public.redeem_invite_code('912345')) ->> 'reason', 'expired', '남아 있던 번호로 다른 사람이 부모로 들어올 수 없다');
reset role;
select is((select count(*)::int from public.profiles where family_id = '9f100000-0000-0000-0000-000000000001' and role = 'parent'), 1,
          '가족의 부모 프로필은 정상 연결한 1명뿐이다');

-- 8. 같은 기기 재시도(응답 유실)는 여전히 성공
select pg_temp.act_as('91000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code((select code from codes where name = 'new'))) ->> 'ok', 'true', '같은 기기 재시도는 성공(멱등)');
reset role;

-- 9. 연결 뒤에도 자녀는 새 번호를 받을 수 있다(두 번째 어르신 등) — 새 번호는 쓸 수 있다
select pg_temp.act_as('91000000-0000-0000-0000-0000000000c1', false);
select matches(public.issue_invite_code(), '^[0-9]{6}$', '연결 뒤 새로 받은 번호는 발급된다');
reset role;

-- 10~11. 다른 가족 번호는 건드리지 않는다 / 재연결 번호(대상 지정)는 가입 번호 발급으로 무효화되지 않는다
insert into public.invite_codes (code, family_id, created_by) values
  ('922222', '9f200000-0000-0000-0000-000000000001', '9b200000-0000-0000-0000-0000000000c1');
select pg_temp.act_as('92000000-0000-0000-0000-0000000000c1', false);
insert into codes values ('reconnect', public.issue_invite_code('9b200000-0000-0000-0000-0000000000a1'));
reset role;
select is((select count(*)::int from public.invite_codes where code = '922222' and expires_at > now()), 1,
          '재연결 번호 발급은 같은 가족의 가입 번호를 무효화하지 않는다(대상이 다름)');
select pg_temp.act_as('91000000-0000-0000-0000-0000000000c1', false);
select public.issue_invite_code();
reset role;
select is((select count(*)::int from public.invite_codes
            where family_id = '9f200000-0000-0000-0000-000000000001' and used_at is null and expires_at > now()), 2,
          '다른 가족의 번호(가입 1 + 재연결 1)는 그대로다');

-- 12. 무효화된 번호는 발급 때 바로 지워지지 않아 'expired' 로 안내된다(하루 지나면 정리)
select is((select count(*)::int from public.invite_codes
            where family_id = '9f100000-0000-0000-0000-000000000001' and used_at is null and expires_at <= now()) >= 1, true,
          '무효화된 번호 행은 남아 있다(expired 안내용)');

select * from finish();
rollback;
