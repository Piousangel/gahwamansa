-- staging 콘텐츠 재시드 2026-11-26(#261 길 A + 콘텐츠 갈래 0065, PR server/content-axes '오너 승인 필요'). **오너 승인 뒤 운영자가 postgres(SQL Editor)에서 절마다 따로** 실행한다.
-- 한 번에 파일 전체를 돌리지 않는다(절 사이에 확인할 것이 있다). production에는 해당 없음(콘텐츠 없음). 공유 로컬·원격 자동 실행 금지.
-- 순서: [1] 사전 확인 → (db push로 0065까지 반영) → [2] 백업 또는 멈춤 → [3] 첫 답 알림 대기열 확인 → [4] 길 A 삭제
--       → supabase/seed_content_14d.sql 전체 → [5] 첫마디 → supabase/seed_recall_options.sql(② 보기) → [6] 사후 확인.
-- [5]의 첫마디 글자는 seed_content_30d.sql seed_starters와 같아야 한다 — supabase/ops/content-care-seed.test.mjs 가 대조한다.

-- [1] 사전 확인(읽기만): 지울 ③ 행(8·9·13·14일)에 걸린 답·세션 참조, 사진 12일(#261)의 ② 보기·고른 것.
--     recall_options가 0이 아니면 사진 행 삭제(#261 부분)는 길 B(새 day_index + retired_at)로 바꾼다.
select 'answers_on_q' as what, q.day_index, count(a.id) as n
  from public.content_questions q left join public.answers a on a.question_id = q.id
 where q.day_index in (8, 9, 13, 14) group by q.day_index
union all
select 'sessions_ref_q', q.day_index, count(ds.id)
  from public.content_questions q left join public.daily_sessions ds on ds.question_id = q.id
 where q.day_index in (8, 9, 13, 14) group by q.day_index
union all
select 'recall_options', o.day_index, count(*) from public.content_recall_options o
 where o.day_index in (2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14) group by o.day_index
union all
select 'recall_picks', rp.day_index, count(*) from public.recall_picks rp
 where rp.day_index in (2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14) group by rp.day_index
order by 1, 2;

-- [2] 지울 답 백업(#286 QA-3 L2). [1]의 answers_on_q 합이 0이면 건너뛴다. 0이 아니면 이 백업을 만든 뒤에만 [4]로 간다
--     (백업 없이 진행하지 않는다 — 오너가 '버려도 된다'고 한 경우만 예외). 백업 표는 확인 뒤 운영자가 지운다(31일 파기 대상 밖이므로 남기지 않는다).
create table if not exists public._backup_answers_20261126 as
select a.*, q.day_index as backup_day_index
  from public.answers a join public.content_questions q on q.id = a.question_id
 where q.day_index in (8, 9, 13, 14);
revoke all on public._backup_answers_20261126 from public, anon, authenticated, service_role;

-- [3] 첫 답 알림 대기열(#286 QA-3 L3): 지울 답이 어떤 어르신의 첫 답이었으면 그 가족의 미발송 parent_first_answer가 남아
--     지워진 답의 알림이 나간다. 아래가 행을 돌려주면 그 행은 처리 표시(sent_at)로 막는다 — 운영자가 확인 뒤 아래 update를 실행.
select nq.id, nq.family_id, nq.payload, nq.created_at
  from public.notification_queue nq
 where nq.kind = 'parent_first_answer' and nq.sent_at is null
   and exists (select 1 from public.answers a join public.content_questions q on q.id = a.question_id
                where q.day_index in (8, 9, 13, 14) and a.parent_id = (nq.payload ->> 'parent_id')::uuid);
-- update public.notification_queue set sent_at = now() where id in (/* 위에서 나온 id */);

-- [4] 길 A 삭제(한 트랜잭션). daily_sessions.question_id는 FK on delete set null(세션 행은 남음).
begin;
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers where question_id in (select id from public.content_questions where day_index in (8, 9, 13, 14));
delete from public.content_questions where day_index in (8, 9, 13, 14);
-- #261 사진 행(② 보기 적재 전일 때만, [1] recall_options = 0): delete from public.content_photos where day_index in (2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14);
commit;

-- (여기서 supabase/seed_content_14d.sql 전체 실행)

-- [5] 다시 넣은 8·9·13·14일 첫마디(빈 칸만). seed_content_30d.sql 전체는 실행하지 않는다(15~30일 사진이 pending://).
update public.content_questions c set starter_a = s.a, starter_b = s.b
  from (values
    (8, '손편지에 어떤 이야기를 받고 싶으신지 여쭤봐요', '앨범에 넣고 싶은 사진이 있는지 여쭤봐요'),
    (9, '걸어 보고 싶은 바닷가가 있는지 여쭤봐요', '좋아하시는 산책길이 있는지 여쭤봐요'),
    (13, '가 보고 싶은 계곡이 있는지 여쭤봐요', '바닷가에 가면 하고 싶은 게 있는지 여쭤봐요'),
    (14, '수박을 어떻게 드시는 걸 좋아하시는지 여쭤봐요', '참외 맛있게 고르는 법이 있는지 여쭤봐요')
  ) s(day_index, a, b)
 where c.day_index = s.day_index and c.starter_a is null and c.starter_b is null;

-- (여기서 supabase/seed_recall_options.sql — ② 보기 적재, #261)

-- [6] 사후 확인: 기대 14 | 14. 14d 시드를 다시 돌려도 WARNING이 없어야 한다. care_lines_enabled는 켜지 않는다(P2 v6 단계).
select count(*) filter (where care_a is not null and care_b is not null) as care_days, count(*) as days
  from public.content_questions where day_index between 1 and 14;
