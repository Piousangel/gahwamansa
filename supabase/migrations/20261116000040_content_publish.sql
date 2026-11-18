-- 0040 콘텐츠 게시·은퇴 RPC(로드맵 SV-08, 백오피스 계획 11 §4 "콘텐츠 추가 스크립트", 리뷰 BO14)
-- scripts/photos/publish-content.mjs(검수표 게이트 → 사진 업로드 → 이 RPC)가 부른다. 서비스 역할 전용.
-- admin_publish_content(p_days, 처리자, 사유): 항목 {day_index, image_url, caption, keyword, recall_questions[], prompt, option_a, option_b, starter_a?, starter_b?}
--   - 끝에만·빈칸 없이(지금 최대 day_index + 1부터 연속) — 0024 커서 원칙("앞에 끼우면 지나간 어르신은 다음 바퀴에").
--   - 이미 있는 day_index는 거부(덮어쓰기 금지, 고칠 땐 새 날 + admin_retire_content). 자리표시(pending://)·빈 문구·60자 넘는 첫마디는 거부.
--   - 사진·질문을 한 트랜잭션으로 넣고 admin_audit(content_publish, 날 목록)을 남긴다.
-- admin_retire_content(p_day, 처리자, 사유): 두 표에 retired_at(되돌릴 수 없음, 0024 트리거) + 감사(content_retire).
-- 실패는 {ok:false, reason: day_exists|not_append|invalid_item, day_index}. 처리자·사유 없음은 예외(0039 admin_check_args).

create function public.admin_publish_content(p_days jsonb, p_operator text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_max int;
  v_days int[];
  v_bad int;
  r jsonb;
begin
  perform public.admin_check_args(p_reason, p_operator);
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_item');
  end if;
  perform pg_advisory_xact_lock(hashtext('content_publish')); -- 동시 게시 줄 세움

  for r in select * from jsonb_array_elements(p_days) loop
    if coalesce(r ->> 'day_index', '') !~ '^[0-9]{1,6}$'
       or coalesce(r ->> 'image_url', '') = '' or (r ->> 'image_url') like 'pending://%'
       or coalesce(btrim(r ->> 'caption'), '') = '' or coalesce(btrim(r ->> 'keyword'), '') = ''
       or coalesce(btrim(r ->> 'option_a'), '') = '' or coalesce(btrim(r ->> 'option_b'), '') = ''
       or coalesce(char_length(r ->> 'starter_a'), 0) > 60 or coalesce(char_length(r ->> 'starter_b'), 0) > 60 then
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
         coalesce(array(select jsonb_array_elements_text(coalesce(x -> 'recall_questions', '[]'::jsonb))), '{}')
    from jsonb_array_elements(p_days) x;
  insert into public.content_questions (day_index, option_a, option_b, prompt, starter_a, starter_b)
  select (x ->> 'day_index')::int, btrim(x ->> 'option_a'), btrim(x ->> 'option_b'), nullif(btrim(x ->> 'prompt'), ''),
         nullif(btrim(x ->> 'starter_a'), ''), nullif(btrim(x ->> 'starter_b'), '')
    from jsonb_array_elements(p_days) x;

  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'content_publish', btrim(p_reason), jsonb_build_object('days', to_jsonb(v_days)));
  return jsonb_build_object('ok', true, 'days', to_jsonb(v_days));
end $$;

create function public.admin_retire_content(p_day int, p_operator text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_check_args(p_reason, p_operator);
  if not exists (select 1 from public.content_photos where day_index = p_day) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  update public.content_photos set retired_at = now() where day_index = p_day and retired_at is null;
  update public.content_questions set retired_at = now() where day_index = p_day and retired_at is null;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'content_retire', btrim(p_reason), jsonb_build_object('day_index', p_day));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_publish_content(jsonb, text, text), public.admin_retire_content(int, text, text) from public, anon, authenticated;
grant execute on function public.admin_publish_content(jsonb, text, text), public.admin_retire_content(int, text, text) to service_role;
