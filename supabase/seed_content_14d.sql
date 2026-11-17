-- 첫 빌드(테스트 트랙)용 콘텐츠 14일분. 공개 전에 30일분으로 늘린다.
-- 원본: docs/team/writer.md 30일 표. 행 끝 주석의 '원본'은 writer.md 일차.
-- 2026-11-17 계절 점검으로 14칸 순서 재배치(9~2월 시작자가 첫 7일 안에 정반대 계절 칸을 보지 않게). 원격 게시 전이라 day_index를 다시 매김.
--   표·근거: docs/team/photo-curator.md 9절. 사진 파일(content/photos/day-NN)도 같은 번호로 이름을 바꿨다.
-- 행 끝 태그(빌드 1 개인화 기반, 서버 미사용): season(계절, 괄호=단서 위치 text|image|none) place era city_ok(도시판 가능). 원본은 scripts/photos/prompts.json tags.
-- image_url은 자리표시(pending://day-N). AI 사진이 완성되면 교체한다.
-- 전제: content_photos.recall_questions(text[], 2개), content_questions.prompt(text) 컬럼이 이미 있어야 한다.
-- 다시 실행해도 안전: 이미 있는 day_index는 건너뛰고(게시 후 수정 금지, 0024 트리거), 시드 문구가 DB와 다르면 WARNING으로 알린다.
-- 문구를 고치려면 이 파일을 고치지 말고 새 day_index 행을 끝에 추가하고 옛 행에 retired_at을 넣는다(docs/team/dev-server-notes.md §5).
begin;


create temp table seed_photos (day_index int, image_url text, caption text, keyword text, recall_questions text[]) on commit drop;
insert into seed_photos values
  (1,  'pending://day-1',  '마을 입구 나무',   '나무',   array['나무 아래서 쉬어 본 적 있으세요?', '어떤 계절의 나무가 떠오르세요?']),  -- 원본 1 · 재배치 전 1 · season=autumn(image) place=country era=7080 city_ok=y
  (2,  'pending://day-2',  '라디오가 있던 방', '라디오', array['라디오에서 나오던 소리 중 기억나는 게 있어요?', '어디서 들으셨어요?']),  -- 원본 3 · 재배치 전 5 · season=any(none) place=any era=7080 city_ok=n
  (3,  'pending://day-3', '시골집 부엌',      '부엌',   array['부엌에서 나던 냄새가 기억나세요?', '불 지피던 모습을 본 적 있어요?']),  -- 원본 23 · 재배치 전 13 · season=winter(image) place=country era=7080 city_ok=y
  (4,  'pending://day-4',  '감 익는 마당',     '감',     array['감을 따 본 적 있으세요?', '곶감이나 홍시 중 뭐가 떠올라요?']),  -- 원본 7 · 재배치 전 2 · season=autumn(text) place=country era=7080 city_ok=y
  (5,  'pending://day-5', '단풍 든 산길',     '단풍잎', array['단풍 구경을 가 보셨어요?', '낙엽을 주워 본 기억이 있어요?']),  -- 원본 27 · 재배치 전 14 · season=autumn(text) place=any era=7080 city_ok=n
  (6,  'pending://day-6',  '송편 빚는 날',     '송편',   array['송편 빚을 때 어떤 모양을 만드셨어요?', '속은 뭘 좋아하세요?']),  -- 원본 13 · 재배치 전 8 · season=autumn(text) place=any era=7080 city_ok=n
  (7,  'pending://day-7',  '한가위 보름달',    '달',     array['달을 보며 빌어 본 적 있어요?', '보름달 밤에 뭘 하셨어요?']),  -- 원본 8 · 재배치 전 3 · season=autumn(text) place=country era=7080 city_ok=y
  (8,  'pending://day-8', '공책과 연필',      '연필',   array['연필을 깎아 본 기억이 있어요?', '공책에 처음 쓴 글자는 뭐였어요?']),  -- 원본 11 · 재배치 전 11 · season=spring(image) place=any era=7080 city_ok=n
  (9,  'pending://day-9',  '툇마루 고무신',    '고무신', array['툇마루에 앉아 본 적 있어요?', '어릴 적 신발 중 기억나는 게 있어요?']),  -- 원본 10 · 재배치 전 7 · season=spring(image) place=country era=7080 city_ok=n
  (10, 'pending://day-10',  '소풍 도시락',      '도시락', array['소풍 때 도시락엔 뭐가 들었어요?', '어디로 소풍 가셨어요?']),  -- 원본 16 · 재배치 전 9 · season=spring(image) place=country era=7080 city_ok=y
  (11, 'pending://day-11',  '비 오는 날 처마',  '우산',   array['비 오는 날 하던 일이 있어요?', '빗소리는 어떻게 들렸어요?']),  -- 원본 5 · 재배치 전 6 · season=summer(image) place=country era=7080 city_ok=y
  (12, 'pending://day-12',  '장독대 아침',      '항아리', array['항아리에 뭐가 들어 있었는지 기억나세요?', '장독대에서 하던 일이 있어요?']),  -- 원본 9 · 재배치 전 4 · season=summer(image) place=country era=7080 city_ok=y
  (13, 'pending://day-13', '우물가 한낮',      '두레박', array['우물물을 길어 본 적 있어요?', '우물가에서 사람들이 뭘 했나요?']),  -- 원본 15 · 재배치 전 12 · season=summer(image) place=country era=7080 city_ok=n
  (14, 'pending://day-14', '여름 저녁 평상',   '평상',   array['평상에 누워 본 적 있어요?', '여름 저녁엔 뭘 드셨어요?'])  -- 원본 18 · 재배치 전 10 · season=summer(text) place=country era=7080 city_ok=y
;
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions)
select * from seed_photos on conflict (day_index) do nothing;

create temp table seed_questions (day_index int, option_a text, option_b text, prompt text) on commit drop;
insert into seed_questions values
  (1,  '봄',          '가을',          '어느 계절이 더 좋으세요?'),
  (2,  '라디오 듣기', '텔레비전 보기', '편하게 즐기는 쪽은요?'),
  (3,  '구수한 숭늉', '달콤한 식혜',   '마시고 싶은 건요?'),
  (4,  '단감',        '홍시',          '어느 맛이 더 좋으세요?'),
  (5,  '가을 산',     '봄 산',         '걷고 싶은 산은요?'),
  (6,  '떡',          '과일',          '명절에 먼저 집는 건요?'),
  (7,  '밤 산책',     '낮 산책',       '걷고 싶은 때는 언제예요?'),
  (8,  '일기 쓰기',   '편지 쓰기',     '쓴다면 어느 쪽이 좋아요?'),
  (9,  '편한 슬리퍼', '튼튼한 운동화', '신고 싶은 신발은요?'),
  (10, '김밥',        '주먹밥',        '소풍 도시락은 어느 쪽이요?'),
  (11, '부침개',      '따뜻한 차',     '비 오는 날 생각나는 건요?'),
  (12, '된장찌개',    '김치찌개',      '오늘 먹고 싶은 찌개는요?'),
  (13, '시원한 물',   '따뜻한 물',     '마시고 싶은 물은요?'),
  (14, '수박',        '참외',          '여름엔 어느 과일이 좋아요?')
;
insert into public.content_questions (day_index, option_a, option_b, prompt)
select * from seed_questions on conflict (day_index) do nothing;

-- 변경 감지: 게시된 행과 시드 문구가 다르면 조용히 무시하지 않고 경고한다(사진 주소는 업로드로 바뀌므로 비교하지 않음)
do $$
declare r record;
begin
  for r in select s.day_index from seed_photos s join public.content_photos c using (day_index)
            where (s.caption, s.keyword, s.recall_questions) is distinct from (c.caption, c.keyword, c.recall_questions) loop
    raise warning 'seed: content_photos day % 문구가 DB와 다릅니다(적용 안 됨). 새 day_index + retired_at으로 고치세요', r.day_index;
  end loop;
  for r in select s.day_index from seed_questions s join public.content_questions c using (day_index)
            where (s.option_a, s.option_b, s.prompt) is distinct from (c.option_a, c.option_b, c.prompt) loop
    raise warning 'seed: content_questions day % 문구가 DB와 다릅니다(적용 안 됨). 새 day_index + retired_at으로 고치세요', r.day_index;
  end loop;
end $$;

commit;
