-- 0044 재검토 반영(docs/team/reviews/2026-11-18-admin-delete-review.md 3부: R-M1 조건, K-L1·K-L2, R-L1·R-L2)
-- R-M1 카카오 어드민 키 오류(401·403·-401)는 키 문제라 사용자별 재시도가 아니다 → Edge가 그 회차를 멈추고 kakao_unlink_release로
--      선점을 풀어 시도 횟수를 돌려놓고 1시간 뒤 다시(포기로 가지 않음). 회차마다 push_runs(kind 'kakao_unlink')에 기록 —
--      설정 오류는 note 'config_error', 정상은 완료/재시도/포기 수. 포기 건수는 06시 운영 점검·지표 SQL에서 본다(dev-server-notes §14, metrics ⑧).
-- K-L1 큐에 들어간 뒤 같은 카카오 계정으로 다시 가입했으면(auth.identities 생성 시각 > 큐 적재 시각) 해제하지 않고 행을 지운다.
-- K-L2 service_role의 해제 큐 insert·update·delete·truncate 회수(쓰기는 definer 함수만).
-- R-L1 사진 주소는 https만, Vault project_url이 있으면 그 호스트만.
-- R-L2 content_photos.image_url이 바뀌면(업로드 스크립트·Studio) 감사 행(content_image_url)을 남긴다.

revoke insert, update, delete, truncate on public.kakao_unlink_queue from service_role;
revoke all on sequence public.kakao_unlink_queue_id_seq from service_role;

alter table public.admin_audit drop constraint admin_audit_action_check,
  add constraint admin_audit_action_check check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire', 'content_image_url'));

create function public.content_image_url_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    insert into public.admin_audit (operator, action, reason, detail)
    values (left(current_user, 60), 'content_image_url', '사진 주소 변경',
            jsonb_build_object('day_index', new.day_index, 'host', substring(new.image_url from '^https?://([^/]+)')));
  end if;
  return new;
end $$;
revoke execute on function public.content_image_url_audit() from public, anon, authenticated;
create trigger content_photos_image_url_audit after update of image_url on public.content_photos
  for each row execute function public.content_image_url_audit();

-- 서비스 역할(Edge): 키 오류로 멈춘 회차의 선점을 풀어 준다(시도 횟수 원상, 1시간 뒤 다시) + 실행 기록
create function public.kakao_unlink_release(p_ids bigint[], p_http int default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  update public.kakao_unlink_queue
     set attempts = greatest(attempts - 1, 0), next_attempt_at = now() + interval '1 hour', last_http = p_http
   where id = any (coalesce(p_ids, '{}')) and gave_up_at is null;
  get diagnostics v_n = row_count;
  insert into public.push_runs (kind, targets, failed, note) values ('kakao_unlink', coalesce(cardinality(p_ids), 0), v_n, 'config_error');
  return jsonb_build_object('released', v_n);
end $$;
revoke execute on function public.kakao_unlink_release(bigint[], int) from public, anon, authenticated;
grant execute on function public.kakao_unlink_release(bigint[], int) to service_role;

-- kakao_unlink_claim(0042) + 재가입 확인(K-L1)
create or replace function public.kakao_unlink_claim(p_limit int default 50, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  -- K-L1: 큐에 들어간 뒤 같은 카카오 계정으로 다시 가입했으면 해제하지 않고 지운다(새 계정의 연결을 끊지 않게)
  delete from public.kakao_unlink_queue q
   where q.gave_up_at is null
     and exists (select 1 from auth.identities i
                  where i.provider = 'kakao' and i.provider_id = q.kakao_user_id and i.created_at > q.enqueued_at);
  with c as (
    select id from public.kakao_unlink_queue
     where gave_up_at is null and next_attempt_at <= p_now
     order by next_attempt_at, id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
     for update skip locked),
  u as (
    update public.kakao_unlink_queue q
       set attempts = q.attempts + 1,
           next_attempt_at = p_now + least(interval '1 minute' * power(2, q.attempts + 1), interval '24 hours')
      from c where q.id = c.id
    returning q.id, q.kakao_user_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kakao_user_id', kakao_user_id) order by id), '[]'::jsonb) into v from u;
  return v;
end $$;

-- kakao_unlink_record(0042) + 실행 기록
create or replace function public.kakao_unlink_record(p_results jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_done int; v_retry int; v_gave int;
begin
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r where coalesce(r ->> 'status', '') not in ('done', 'retry')) then
    raise exception 'invalid_status';
  end if;
  delete from public.kakao_unlink_queue q using jsonb_array_elements(p_results) r
   where r ->> 'status' = 'done' and q.id = (r ->> 'id')::bigint;
  get diagnostics v_done = row_count;
  update public.kakao_unlink_queue q
     set last_http = nullif(r ->> 'http', '')::int,
         gave_up_at = case when q.attempts >= 10 then now() else null end
    from jsonb_array_elements(p_results) r
   where r ->> 'status' = 'retry' and q.id = (r ->> 'id')::bigint;
  get diagnostics v_retry = row_count;
  select count(*) into v_gave from public.kakao_unlink_queue q, jsonb_array_elements(p_results) r
   where r ->> 'status' = 'retry' and q.id = (r ->> 'id')::bigint and q.gave_up_at is not null;
  -- 실행 기록(운영 점검): sent=완료, failed=재시도, invalid=포기
  insert into public.push_runs (kind, targets, sent, failed, invalid)
  values ('kakao_unlink', jsonb_array_length(p_results), v_done, v_retry - v_gave, v_gave);
  return jsonb_build_object('done', v_done, 'retry', v_retry - v_gave, 'gave_up', v_gave);
end $$;

-- admin_publish_content(0043) + https·호스트 확인(R-L1)
create or replace function public.admin_publish_content(p_days jsonb, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_max int;
  v_days int[];
  v_bad int;
  r jsonb;
  -- R-L1: Vault project_url이 있으면 그 호스트의 사진 주소만(로컬처럼 없으면 https 형식만 검사)
  v_host text := substring((select decrypted_secret from vault.decrypted_secrets where name = 'project_url') from '^https?://([^/]+)');
begin
  perform public.admin_check_args(p_reason, p_operator);
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_item');
  end if;
  perform pg_advisory_xact_lock(hashtext('content_publish'));

  for r in select * from jsonb_array_elements(p_days) loop
    if coalesce(r ->> 'day_index', '') !~ '^[0-9]{1,6}$'
       or coalesce(r ->> 'image_url', '') !~ '^https://[A-Za-z0-9.:-]+/storage/v1/object/public/content-photos/[A-Za-z0-9/_.-]+\.jpe?g$'
       or (v_host is not null and substring(r ->> 'image_url' from '^https://([^/]+)/') is distinct from v_host)
       or coalesce(char_length(btrim(r ->> 'caption')), 0) not between 1 and 60
       or coalesce(char_length(btrim(r ->> 'keyword')), 0) not between 1 and 20
       or coalesce(char_length(btrim(r ->> 'option_a')), 0) not between 1 and 30
       or coalesce(char_length(btrim(r ->> 'option_b')), 0) not between 1 and 30
       or coalesce(char_length(r ->> 'prompt'), 0) > 80
       or coalesce(char_length(r ->> 'starter_a'), 0) > 60 or coalesce(char_length(r ->> 'starter_b'), 0) > 60
       or (r ? 'recall_questions' and (jsonb_typeof(r -> 'recall_questions') <> 'array' or jsonb_array_length(r -> 'recall_questions') > 5
           or exists (select 1 from jsonb_array_elements_text(r -> 'recall_questions') q where char_length(btrim(q)) not between 1 and 80))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_item', 'day_index', r ->> 'day_index');
    end if;
  end loop;

  select array_agg((x ->> 'day_index')::int order by (x ->> 'day_index')::int) into v_days from jsonb_array_elements(p_days) x;
  select (x ->> 'day_index')::int into v_bad from jsonb_array_elements(p_days) x
   where exists (select 1 from public.content_photos where day_index = (x ->> 'day_index')::int)
      or exists (select 1 from public.content_questions where day_index = (x ->> 'day_index')::int)
   limit 1;
  if v_bad is not null then return jsonb_build_object('ok', false, 'reason', 'day_exists', 'day_index', v_bad); end if;

  select greatest(coalesce((select max(day_index) from public.content_photos), 0), coalesce((select max(day_index) from public.content_questions), 0)) into v_max;
  if v_days <> array(select generate_series(v_max + 1, v_max + cardinality(v_days))) then
    return jsonb_build_object('ok', false, 'reason', 'not_append', 'day_index', v_days[1], 'expected_from', v_max + 1);
  end if;

  insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions)
  select (x ->> 'day_index')::int, x ->> 'image_url', btrim(x ->> 'caption'), btrim(x ->> 'keyword'),
         coalesce(array(select btrim(q) from jsonb_array_elements_text(coalesce(x -> 'recall_questions', '[]'::jsonb)) q), '{}')
    from jsonb_array_elements(p_days) x;
  insert into public.content_questions (day_index, option_a, option_b, prompt, starter_a, starter_b)
  select (x ->> 'day_index')::int, btrim(x ->> 'option_a'), btrim(x ->> 'option_b'), nullif(btrim(x ->> 'prompt'), ''),
         nullif(btrim(x ->> 'starter_a'), ''), nullif(btrim(x ->> 'starter_b'), '')
    from jsonb_array_elements(p_days) x;

  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'content_publish', btrim(p_reason), jsonb_build_object('days', to_jsonb(v_days)));
  return jsonb_build_object('ok', true, 'days', to_jsonb(v_days));
end $$;
