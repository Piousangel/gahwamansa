-- 0015 미연결 열람 모드(P14): 연결이 끊긴(프로필 없는) 기기도 오늘의 코스를 볼 수 있다. 답·동의·세션·연속일은 돌려주지 않는다.
-- 날짜 번호는 개인 시작일이 없으므로 KST 날짜 기준으로 존재하는 콘텐츠 중에서 순환한다. 콘텐츠 표는 원래 로그인 사용자 공개 읽기다.
create or replace function public.preview_content() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_idx int;
begin
  -- 연결된 기기는 개인 시작일 기준 get_today_content를 써야 한다(다른 날 문항에 답이 저장되는 것 방지)
  if public.my_profile_id() is not null then raise exception 'linked_use_get_today_content'; end if;
  with d as (
    select x.day_index, row_number() over (order by x.day_index) rn
      from (select p.day_index from public.content_photos p join public.content_questions q using (day_index)) x
  ), c as (select count(*) n from d)
  select d.day_index into v_idx from d, c
   where c.n > 0 and d.rn = mod(greatest(0, public.kst_today() - date '2026-01-01'), c.n) + 1;
  if v_idx is null then return null; end if;
  return jsonb_build_object(
    'day_index', v_idx,
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword,
                                         'recall_questions', to_jsonb(p.recall_questions))
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b, 'prompt', q.prompt)
                   from public.content_questions q where q.day_index = v_idx),
    'linked', false);
end $$;
revoke execute on function public.preview_content() from public, anon;
grant execute on function public.preview_content() to authenticated;
