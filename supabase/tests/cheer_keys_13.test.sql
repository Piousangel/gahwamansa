-- 0060 테스트 (pgTAP): 응원 키 확대 ② — cheer_key_ok 하나로 send_cheer·cheer_texts check·이벤트 message_key 통합. 실행: npx supabase test db
-- 보호하는 것: 새 13키는 세 곳 모두 통과, 기존 4키(시트에서 숨길 3키 포함)도 그대로 통과, 모르는 키·ans_seen(D-5 제외)·빈 키는 세 곳 모두 거절,
--             응원 문장(copy.ko.json cheers.* 17개, 법률 리뷰 뒤 load-push-copy 가 적재)이 cheer_texts 금지어 check 를 통과하고 금지어 문장은 거부.
-- 키 목록이 앱 계약 CHEER_KEYS 와 같은지는 app/__tests__/cheersContract.test.ts 가 본다(여기 배열은 시험용 기대값).
begin;
select plan(18);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70600000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('70600000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 어르신
insert into public.families (id, created_by) values
  ('706f0000-0000-0000-0000-000000000001', '70600000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('706b0000-0000-0000-0000-0000000000c1', '70600000-0000-0000-0000-0000000000c1', '706f0000-0000-0000-0000-000000000001', 'child'),
  ('706b0000-0000-0000-0000-0000000000a1', '70600000-0000-0000-0000-0000000000a1', '706f0000-0000-0000-0000-000000000001', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

create temp table new_keys (k text primary key);
insert into new_keys values ('ans_me_too'), ('ans_tell_more'), ('old_story'), ('photo_memory'), ('childhood_story'),
  ('call_soon'), ('visit_soon'), ('eat_together'), ('love'), ('miss_you'), ('thought_of_you'), ('doing_well'), ('meal_thought');
create temp table legacy_keys (k text primary key);
insert into legacy_keys values ('love_you'), ('warm_day'), ('thanks_always'), ('peaceful_day');
create temp table bad_keys (k text);
insert into bad_keys values ('ans_seen'), ('well_done'), ('LOVE'), ('love '), (''), ('love_you;'), (null);
grant select on new_keys, legacy_keys, bad_keys to public;

-- 키마다 하루 한도(쌍마다 2개)에 걸리지 않게, 보내기 전에 앞서 보낸 응원을 어제로 옮긴다(postgres 로). 결과: 키·ok·reason
create function pg_temp.send_each(p_keys text[]) returns table (k text, ok text, reason text) language plpgsql as $$
declare
  v text;
  r jsonb;
begin
  foreach v in array p_keys loop
    execute 'reset role';
    update public.cheers set sent_at = sent_at - interval '2 days' where from_child = '706b0000-0000-0000-0000-0000000000c1';
    perform pg_temp.act_as('70600000-0000-0000-0000-0000000000c1', false);
    r := public.send_cheer('706b0000-0000-0000-0000-0000000000a1', v);
    k := v; ok := r ->> 'ok'; reason := r ->> 'reason';
    return next;
  end loop;
  execute 'reset role';
end $$;
grant execute on function pg_temp.send_each(text[]) to public;

-- ---- cheer_key_ok ----
select is((select count(*)::int from new_keys), 13, '새 키는 13개다(라이터 15 − thanks_always 기존 − ans_seen D-5)');
select is(array(select k from new_keys where not public.cheer_key_ok(k) order by k), '{}'::text[], 'cheer_key_ok: 새 13키 통과');
select is(array(select k from legacy_keys where not public.cheer_key_ok(k) order by k), '{}'::text[], 'cheer_key_ok: 기존 4키 그대로 통과(숨김 3키 포함)');
select is(array(select coalesce(k, '<null>') from bad_keys where public.cheer_key_ok(k) order by 1), '{}'::text[],
          'cheer_key_ok: 모르는 키·ans_seen·대소문자·공백·빈 키·null 거절(null 도 false)');

-- ---- send_cheer ----
create temp table sent as select * from pg_temp.send_each(array(select k from new_keys order by k) || array(select k from legacy_keys order by k));
grant select on sent to public;
reset role;
select is((select count(*)::int from sent), 17, 'send_cheer: 17키 모두 시도했다');
select is(array(select s.k || '=' || coalesce(s.ok, '?') || '/' || coalesce(s.reason, '') from sent s where s.ok is distinct from 'true' order by s.k), '{}'::text[],
          'send_cheer: 새 13키 + 기존 4키 모두 보내진다');
select is((select count(*)::int from public.cheers where from_child = '706b0000-0000-0000-0000-0000000000c1' and public.cheer_key_ok(message_key)), 17,
          'send_cheer: 17개가 그 키 그대로 저장됐다');
create temp table rejected as select * from pg_temp.send_each(array(select coalesce(k, '') from bad_keys));
grant select on rejected to public;
reset role;
select is(array(select distinct coalesce(reason, '?') from rejected), array['invalid_key'], 'send_cheer: 모르는 키·ans_seen·빈 키는 invalid_key');
select pg_temp.act_as('70600000-0000-0000-0000-0000000000c1', false);
select is(public.send_cheer('706b0000-0000-0000-0000-0000000000a1', null) ->> 'reason', 'invalid_key', 'send_cheer: null 키는 invalid_key');
reset role;
select is((select count(*)::int from public.cheers where from_child = '706b0000-0000-0000-0000-0000000000c1'), 17, 'send_cheer: 거절한 키는 저장되지 않았다');

-- ---- 이벤트 message_key(log_event → event_prop_ok) ----
select is(array(select k from new_keys where not public.event_prop_ok('message_key', to_jsonb(k)) order by k)
          || array(select k from legacy_keys where not public.event_prop_ok('message_key', to_jsonb(k)) order by k), '{}'::text[],
          'event_prop_ok: 새 13키 + 기존 4키 통과');
select is(array(select coalesce(k, '<null>') from bad_keys where coalesce(public.event_prop_ok('message_key', to_jsonb(k)), true) order by 1), '{}'::text[],
          'event_prop_ok: 모르는 키·ans_seen·빈 키 거절');
select ok(not public.event_prop_ok('message_key', '1'::jsonb), 'event_prop_ok: 문자열이 아닌 message_key 거절');
select pg_temp.act_as('70600000-0000-0000-0000-0000000000c1', false);
select is(public.log_event('cheer_sent', '{"message_key": "miss_you"}'), '{"ok": true}'::jsonb, 'log_event: 새 키 cheer_sent 기록');
select is(public.log_event('cheer_sent', '{"message_key": "ans_seen"}') ->> 'reason', 'invalid_props', 'log_event: ans_seen 은 invalid_props');
reset role;

-- ---- cheer_texts: 키 check + 금지어 check ----
-- 문장 = docs/team/copy.ko.json cheers.*(기존 4개 그대로 + 새 13개). 실제 적재는 법률 리뷰 뒤 load-push-copy.mjs(--approved)
select lives_ok($$ insert into public.cheer_texts (message_key, text) values
  ('love_you', '사랑해요, 오늘도 좋은 하루예요'), ('warm_day', '덕분에 하루가 따뜻해요'), ('thanks_always', '늘 고마워요'),
  ('peaceful_day', '오늘도 편안한 하루 보내세요'),
  ('ans_me_too', '고르신 쪽, 저도 좋아요'), ('ans_tell_more', '고르신 답 얘기 듣고 싶어요'),
  ('old_story', '옛날 얘기 들려주세요'), ('photo_memory', '사진 보니 옛날 생각나요'), ('childhood_story', '어릴 적 얘기 궁금해요'),
  ('call_soon', '곧 전화할게요'), ('visit_soon', '곧 보러 갈게요'), ('eat_together', '같이 맛있는 거 먹어요'),
  ('love', '사랑해요'), ('miss_you', '보고 싶어요'), ('thought_of_you', '생각나서 보내요'),
  ('doing_well', '저는 잘 지내요'), ('meal_thought', '밥 먹다 생각났어요')
  on conflict (message_key) do update set text = excluded.text $$,
  'cheer_texts: 17키 문장이 키 check·금지어 check(push_text_clean)를 통과한다');
select throws_ok($$ insert into public.cheer_texts (message_key, text) values ('ans_seen', '고르신 답 봤어요') $$, '23514', null,
                 'cheer_texts: 목록 밖 키(ans_seen)는 check 로 거부');
select throws_ok($$ update public.cheer_texts set text = '무료 쿠폰 받아 가세요' where message_key = 'love' $$, '23514', null,
                 'cheer_texts: 새 키 자리에도 금지어 문장은 거부(push_text_clean, 0049)');
select * from finish();
rollback;
