-- ② 떠올려 보기 그날 보기 3개(0061 content_recall_options) — 로컬 시드(db reset, supabase/config.toml [db.seed]) 겸 운영 적재 SQL.
-- 원본: docs/team/copy/2026-11-25-recall-options.csv(라이터 확정 #252, 30일 × 3 = 90개). 값은 CSV와 글자까지 같아야 한다
--   — supabase/ops/recall-options-seed.test.mjs 가 대조(`node --test supabase/ops/*.test.mjs`). CSV를 고치면 이 파일도 같이 고친다.
-- 원격(staging → production) 적재: 오너 승인 뒤 운영자가 postgres(SQL Editor)에서 이 파일 전체를 한 번에 실행한다(docs/team/dev-server-notes.md '② 보기 적재').
--   서비스 역할·앱은 이 표에 쓸 수 없다. `db push --include-seed`·`db reset --linked`는 쓰지 않는다(§18).
--   남은 사람 검수(DECISIONS 11-25 #252): 정답 없음·고증(8·14·10·25일) — 원격 적재 전에 확인. 게시 뒤에는 고칠 수 없다(트리거).
-- 규칙(기획 docs/team/board/2026-11-25-course-five-steps.md 3.2, 서버 check): 하루 slot 1~3, 같은 날 같은 낱말 금지, 한글 2~4자 한 낱말,
--   셋 다 '그럴 법한 것'(정답 하나 + 오답 둘 금지), 「기억 안 나요」류·건강·종교·정치·출신 지역·가족사 금지, 그날 ③ 두 보기와 겹치지 않게.
-- 동작
--   1) 사전 확인(하나라도 어기면 예외 → 아무것도 들어가지 않음): 90행 · 날 1~30 빠짐없이 · 날마다 slot 1·2·3 · 같은 날 같은 낱말 없음 ·
--      한글 2~4자 · 금지어(기억 시험·건강·종교·의례·장례·전쟁·결혼·고향·술·가족 구성원·형편·연속/칭찬) ·
--      DB에 있는 날은 그날 ③ 두 보기(띄어 쓴 낱말 단위)·사진 낱말·사진 이름과 겹치지 않음.
--   2) content_photos 에 있는 날만 넣는다(FK). 아직 게시 안 된 날(예: staging 15~30일)은 건너뛰고 NOTICE로 알린다 → 그날을 게시한 뒤 다시 실행하면 채워진다.
--   3) 사후 확인: 넣은 날마다 DB의 3개가 이 파일과 똑같아야 한다. 이미 다른 보기가 있던 날이 하나라도 있으면 예외 → 이번 실행 전체를 되돌린다
--      (게시 뒤 수정은 트리거가 막는다 — 고치는 길은 dev-server-notes '오타 수정').
--   4) 커밋 뒤 결과 한 행(loaded_days | skipped_days)을 돌려준다.
--   다시 실행해도 안전(on conflict do nothing, 같은 값이면 변화 없음). 한 트랜잭션이라 중간에 실패해도 반쪽만 들어가지 않는다.
begin;

create temp table seed_recall (day_index int, slot smallint, label text) on commit drop;
insert into seed_recall values
  (1, 1, '그늘'), (1, 2, '참새'), (1, 3, '산들바람'),  -- 마을 입구 나무
  (2, 1, '노래'), (2, 2, '일기예보'), (2, 3, '창호지'),  -- 라디오가 있던 방
  (3, 1, '아궁이'), (3, 2, '누룽지'), (3, 3, '바가지'),  -- 시골집 부엌
  (4, 1, '까치밥'), (4, 2, '장대'), (4, 3, '늦가을'),  -- 감 익는 마당
  (5, 1, '낙엽'), (5, 2, '오솔길'), (5, 3, '도토리'),  -- 단풍 든 산길
  (6, 1, '솔잎'), (6, 2, '반달'), (6, 3, '참기름'),  -- 송편 빚는 날
  (7, 1, '소원'), (7, 2, '토끼'), (7, 3, '귀뚜라미'),  -- 한가위 보름달
  (8, 1, '지우개'), (8, 2, '필통'), (8, 3, '책받침'),  -- 공책과 연필
  (9, 1, '댓돌'), (9, 2, '봄볕'), (9, 3, '나들이'),  -- 툇마루 고무신
  (10, 1, '보자기'), (10, 2, '풀밭'), (10, 3, '보물찾기'),  -- 소풍 도시락
  (11, 1, '빗소리'), (11, 2, '낙숫물'), (11, 3, '장마'),  -- 비 오는 날 처마
  (12, 1, '고추장'), (12, 2, '물안개'), (12, 3, '돌담'),  -- 장독대 아침
  (13, 1, '이웃'), (13, 2, '한여름'), (13, 3, '밧줄'),  -- 우물가 한낮
  (14, 1, '모깃불'), (14, 2, '옥수수'), (14, 3, '밤하늘'),  -- 여름 저녁 평상
  (15, 1, '대파'), (15, 2, '뻥튀기'), (15, 3, '엿장수'),  -- 장날 아침
  (16, 1, '들판'), (16, 2, '정류장'), (16, 3, '차표'),  -- 버스 오는 길
  (17, 1, '복도'), (17, 2, '마룻바닥'), (17, 3, '운동장'),  -- 수업 시작 종
  (18, 1, '새소리'), (18, 2, '이슬'), (18, 3, '까치'),  -- 마당 쓰는 아침
  (19, 1, '분필'), (19, 2, '난로'), (19, 3, '걸상'),  -- 방과 후 교실
  (20, 1, '놋그릇'), (20, 2, '나물'), (20, 3, '김치'),  -- 둥근 밥상
  (21, 1, '낮잠'), (21, 2, '매미'), (21, 3, '미숫가루'),  -- 대청마루 여름
  (22, 1, '돌계단'), (22, 2, '문지방'), (22, 3, '심부름'),  -- 등굣길 책가방
  (23, 1, '순대'), (23, 2, '뚝배기'), (23, 3, '깍두기'),  -- 장터 국밥집
  (24, 1, '색동'), (24, 2, '옷고름'), (24, 3, '버선'),  -- 한복 걸린 방
  (25, 1, '장작'), (25, 2, '군고구마'), (25, 3, '메주'),  -- 가마솥 김
  (26, 1, '송사리'), (26, 2, '물수제비'), (26, 3, '조약돌'),  -- 냇가 낚시
  (27, 1, '향기'), (27, 2, '선물'), (27, 3, '창가'),  -- 탁자 위 꽃다발
  (28, 1, '천막'), (28, 2, '손님'), (28, 3, '잡채'),  -- 잔치하는 앞마당
  (29, 1, '병아리'), (29, 2, '모이'), (29, 3, '지푸라기'),  -- 닭장 아침
  (30, 1, '숨바꼭질'), (30, 2, '굴뚝'), (30, 3, '초가지붕')  -- 흙담 골목 저녁
;

-- 1) 사전 확인
do $$
declare
  v_bad text;
begin
  if (select count(*) from seed_recall) <> 90 then
    raise exception 'recall seed: 행 수 %(90이어야 함)', (select count(*) from seed_recall);
  end if;
  if exists (select 1 from seed_recall where day_index not between 1 and 30) then
    raise exception 'recall seed: 날 범위는 1~30';
  end if;
  select string_agg(d::text, ',') into v_bad
    from generate_series(1, 30) d
   where (select array_agg(s.slot order by s.slot) from seed_recall s where s.day_index = d) is distinct from array[1, 2, 3]::smallint[];
  if v_bad is not null then
    raise exception 'recall seed: 날마다 slot 1·2·3 세 개여야 함 — 어긋난 날 %', v_bad;
  end if;
  select string_agg(day_index || ':' || label, ', ') into v_bad
    from (select day_index, label from seed_recall group by 1, 2 having count(*) > 1) x;
  if v_bad is not null then
    raise exception 'recall seed: 같은 날 같은 낱말 %', v_bad;
  end if;
  select string_agg(day_index || ':' || label, ', ') into v_bad from seed_recall where label !~ '^[가-힣]{2,4}$';
  if v_bad is not null then
    raise exception 'recall seed: 한글 2~4자 한 낱말이 아님 %', v_bad;
  end if;
  -- 금지어(라이터 문서 6절 민감 소재·팀 규칙 '기억 시험'). '조약돌'의 '약'은 약과 무관(라이터 예외 (?<!조)약)
  select string_agg(day_index || ':' || label, ', ') into v_bad from seed_recall
   where replace(label, '조약', '')
         ~ '기억|모르|안나|건강|병원|아프|치매|약|교회|성당|부처|제사|차례|장례|국화|무덤|산소|피난|전쟁|결혼|환갑|고향|술|막걸리|소주|엄마|아빠|어머니|아버지|할머니|할아버지|남편|아내|형편|연속|최고|잘하';
  if v_bad is not null then
    raise exception 'recall seed: 금지어 %', v_bad;
  end if;
  -- DB에 있는 날: ③ 두 보기(띄어 쓴 낱말 단위)·사진 낱말·사진 이름과 겹침 금지
  select string_agg(s.day_index || ':' || s.label, ', ') into v_bad
    from seed_recall s
    join public.content_questions q on q.day_index = s.day_index
   where exists (select 1 from regexp_split_to_table(q.option_a || ' ' || q.option_b, '\s+') w
                  where w <> '' and (strpos(s.label, w) > 0 or strpos(w, s.label) > 0));
  if v_bad is not null then
    raise exception 'recall seed: 그날 ③ 보기와 겹침 %', v_bad;
  end if;
  select string_agg(s.day_index || ':' || s.label, ', ') into v_bad
    from seed_recall s
    join public.content_photos p on p.day_index = s.day_index
   where strpos(s.label, p.keyword) > 0 or strpos(p.caption, s.label) > 0;
  if v_bad is not null then
    raise exception 'recall seed: 그날 사진 낱말·이름과 겹침 %', v_bad;
  end if;
end $$;

-- 2) 적재: 게시된 날만
insert into public.content_recall_options (day_index, slot, label)
select s.day_index, s.slot, s.label
  from seed_recall s
 where exists (select 1 from public.content_photos p where p.day_index = s.day_index)
 order by s.day_index, s.slot
on conflict do nothing;

-- 3) 사후 확인 + 알림
do $$
declare
  v_bad text;
  v_skip text;
  v_days int;
begin
  select string_agg(distinct s.day_index::text, ',') into v_bad
    from seed_recall s
    join public.content_photos p on p.day_index = s.day_index
    left join public.content_recall_options o on o.day_index = s.day_index and o.slot = s.slot
   where o.label is distinct from s.label;
  if v_bad is not null then
    raise exception 'recall seed: DB의 보기가 이 파일과 다른 날 % — 전체 되돌림(게시 뒤 수정 금지, dev-server-notes ''오타 수정'')', v_bad;
  end if;
  select count(distinct o.day_index) into v_days
    from public.content_recall_options o join seed_recall s on s.day_index = o.day_index and s.slot = o.slot;
  select string_agg(d::text, ',' order by d) into v_skip
    from generate_series(1, 30) d
   where not exists (select 1 from public.content_photos p where p.day_index = d);
  raise notice 'recall seed: % 날 보기 3개씩 있음(이 파일과 같음). 콘텐츠가 없어 건너뛴 날: %', v_days, coalesce(v_skip, '없음');
end $$;

commit;

-- 4) 결과 한 행(#261 QA-1 L1 — SQL Editor 결과 칸에 남는다). 커밋 뒤 DB 기준: 보기 3개가 다 있는 날 수·콘텐츠가 없어 건너뛴 날.
select (select count(*) from (select day_index from public.content_recall_options where day_index between 1 and 30
                               group by day_index having count(*) = 3) d) as loaded_days,
       coalesce((select string_agg(d::text, ',' order by d) from generate_series(1, 30) d
                  where not exists (select 1 from public.content_photos p where p.day_index = d)), '없음') as skipped_days;
