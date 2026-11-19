-- 0056 테스트 (pgTAP): 일일 알림은 알림 받기 동의(push_consented_at)만 본다, 답 공유 동의(consented_at)는 보지 않는다(DECISIONS 11-19).
-- 보호하는 것: 답 공유 미동의 + 알림 받기 동의 → 일일 대상, 알림 받기 미동의·알림 끔 → 제외(법률 체크리스트 #10 ④),
--             자녀 쪽 첫 답 알림은 어르신이 답을 보여 주지 않으면(답 공유 미동의) 여전히 없음.
begin;
select plan(6);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;
delete from public.notification_queue; delete from public.push_copy; delete from public.push_claims; delete from public.first_answer_notices;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70560000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70560000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 답 공유 미동의 + 알림 받기 동의
  ('70560000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- 답 공유 동의 + 알림 받기 미동의
  ('70560000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true),  -- 둘 다 동의 + 알림 끔
  ('70560000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true);  -- 둘 다 동의
insert into public.families (id, created_by, parent_title) values ('70560000-0000-0000-0000-0000000000f1', '70560000-0000-0000-0000-0000000000c1', '부모님');
insert into public.profiles (id, user_id, family_id, role, consented_at, push_enabled, push_consented_at) values
  ('70560000-0000-0000-0000-00000000c001', '70560000-0000-0000-0000-0000000000c1', '70560000-0000-0000-0000-0000000000f1', 'child', null, true, now()),
  ('70560000-0000-0000-0000-00000000a001', '70560000-0000-0000-0000-0000000000a1', '70560000-0000-0000-0000-0000000000f1', 'parent', null, true, now()),
  ('70560000-0000-0000-0000-00000000a002', '70560000-0000-0000-0000-0000000000a2', '70560000-0000-0000-0000-0000000000f1', 'parent', now(), true, null),
  ('70560000-0000-0000-0000-00000000a003', '70560000-0000-0000-0000-0000000000a3', '70560000-0000-0000-0000-0000000000f1', 'parent', now(), false, now()),
  ('70560000-0000-0000-0000-00000000a004', '70560000-0000-0000-0000-0000000000a4', '70560000-0000-0000-0000-0000000000f1', 'parent', now(), true, now());
insert into public.device_tokens (user_id, token) values
  ('70560000-0000-0000-0000-0000000000c1', 'dp56_c1_00000000000001'), ('70560000-0000-0000-0000-0000000000a1', 'dp56_a1_00000000000001'),
  ('70560000-0000-0000-0000-0000000000a2', 'dp56_a2_00000000000001'), ('70560000-0000-0000-0000-0000000000a3', 'dp56_a3_00000000000001'),
  ('70560000-0000-0000-0000-0000000000a4', 'dp56_a4_00000000000001');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values ('70560000-0000-0000-0000-00000000d0d1', 1, '가을', '봄', 'q1');
insert into public.push_copy (kind, title, body) values
  ('daily', '오늘의 사진이 왔어요', '편할 때 열어 보세요'),
  ('parent_first_answer', '{호칭}께서 첫 답을 고르셨어요', '앨범에서 보고 이야기해 볼까요?');

create function pg_temp.mine(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(distinct t ->> 'profile_id' order by t ->> 'profile_id'), '{}')
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '70560000%'
$$;
create function pg_temp.at_kst(p_hhmm text) returns timestamptz language sql as $$
  select (public.kst_today()::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;

-- 일일 알림 대상(미리보기·선점 모두 같은 함수)
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('09:00'))),
          array['70560000-0000-0000-0000-00000000a001', '70560000-0000-0000-0000-00000000a004'],
          '답 공유 미동의여도 알림 받기 동의·알림 켬이면 대상, 알림 받기 미동의·알림 끔은 제외');
select ok('70560000-0000-0000-0000-00000000a001' = any (pg_temp.mine(public.push_daily_claim(pg_temp.at_kst('09:00')))),
          '선점(push_daily_claim)도 답 공유 미동의 어르신을 포함');
select ok(not ('70560000-0000-0000-0000-00000000a002' = any (array(select public.push_daily_eligible(public.kst_today())::text))),
          '알림 받기 시각(push_consented_at)이 없으면 답 공유 동의가 있어도 제외(#10 ④)');
select ok(not ('70560000-0000-0000-0000-00000000a003' = any (array(select public.push_daily_eligible(public.kst_today())::text))),
          '알림을 끄면 제외');

-- 자녀 첫 답 알림: 답 공유 미동의 어르신은 답을 저장할 수 없고(consent_required), 큐가 있어도 보내지 않는다
insert into public.notification_queue (family_id, kind, payload)
values ('70560000-0000-0000-0000-0000000000f1', 'parent_first_answer', jsonb_build_object('parent_id', '70560000-0000-0000-0000-00000000a001'));
select is((select coalesce(jsonb_agg(t), '[]'::jsonb) from jsonb_array_elements(public.push_events_claim(pg_temp.at_kst('10:00')) -> 'targets') t
            where t ->> 'kind' = 'parent_first_answer'), '[]'::jsonb, '답 공유 미동의 어르신의 첫 답 알림은 자녀에게 가지 않는다');
select is((select count(*)::int from public.first_answer_notices where family_id = '70560000-0000-0000-0000-0000000000f1'), 0, '그 경우 첫 답 기록도 남지 않는다');

select * from finish();
rollback;
