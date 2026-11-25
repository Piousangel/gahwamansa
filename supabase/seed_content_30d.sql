-- 콘텐츠 15~30일 초안(WR-09, 라이터 2026-11-18) + 1~14일 첫마디(starter_a/b). seed_content_14d.sql과 같은 구조.
-- 원본: docs/team/writer.md 30일 표(행 끝 '원본' 일차). 사진 프롬프트: scripts/photos/prompts.json day 15~30(CT-01, 생성 전).
-- **아직 실행하지 않는다.** image_url이 자리표시(pending://)라 이대로 넣으면 15~30일이 사진 없이 활성이 된다.
--   실제 게시는 사진 생성·검수(content/review.md) 뒤 scripts/photos/publish-content.mjs → admin_publish_content(0040)로 한다(pending:// 거부).
--   이 파일은 문구 원본 + 로컬 시험용. 로컬에서 쓸 때만 실행.
-- 규칙(copy-v3-confirmed 11-1 #4, 9절, photo-curator §4 13~15): 낱말 2~4음절, 회상 질문 2개, 둘 중 고르기는 정답·평가 없음,
--   기억력 확인·건강·떠난 사람·학교를 다녔다는 전제·결혼 여부 전제 없음, 성별·종교·직업 중립, 계절 무관 우선(14/16).
--   첫마디는 자녀가 읽는 말로 "~는지 여쭤봐요"로 끝내고 60자 이하(0027 check), 고른 쪽 문장만 자녀에게 감.
-- writer.md와 달라진 곳: 6일 낱말 '종'(1음절)→'학교종', 14일 '설빔 걸린 방'→'한복 걸린 방'(계절 무관), 25일 '결혼식 날 꽃'→'탁자 위 꽃다발'(결혼 전제 제거),
--   2026-11-25(대기열 25, 리드 결정·라이터 확인 대상): 28일 ③ '전'→'빈대떡'(⑤ 틀 문장에서 '저는'으로 읽힘), ① 첫 질문이 '기억'을 묻던 25·26·28·30일은 순서를 바꾸거나(30) 다듬음(25·26·28, 라이터 확정 11-25: 어르신께 묻는 존대 '~보신 적 있으세요?', 숨은 둘째 질문의 '기억'도 뺌, 첫 질문에 ② 질문과 닮은 '떠오르세요' 안 씀).
--   학교 장면(17·19·22)의 질문은 학교를 다닌 경험을 전제하지 않게, 21일(밥상) '온 가족이 모이던 때'는 떠난 가족을 떠올리게 해서 교체, 29일 '계란 프라이'→'달걀프라이'(한 낱말로 통일).
--   2026-11-26(콘텐츠 갈래, 설계서 docs/team/2026-11-26-content-axes.md): ③ 16·18·20·21·22·24일 보기·질문·첫마디 교체, 8·9·13일 첫마디 교체,
--   15~30일 '챙겨 드릴 거리' care_a·care_b(0065). 글자는 설계서 2·3절·4.1 W2 그대로(supabase/ops/content-care-seed.test.mjs 대조).
begin;

create temp table seed_photos (day_index int, image_url text, caption text, keyword text, recall_questions text[]) on commit drop;
insert into seed_photos values
  (15, 'pending://day-15', '장날 아침', '바구니', array['장에 가면 제일 먼저 어디를 보셨어요?', '장바구니에 꼭 담으시던 건 뭐예요?']),  -- 원본 2 · season=any(none) place=country era=7080 city_ok=y
  (16, 'pending://day-16', '버스 오는 길', '버스', array['버스를 기다리며 뭘 하셨어요?', '버스 타고 가시던 곳이 있으세요?']),  -- 원본 4 · season=any(none) place=country era=7080 city_ok=n
  (17, 'pending://day-17', '수업 시작 종', '학교종', array['종소리를 들으면 마음이 어떠세요?', '쉬는 시간이나 쉬는 날엔 뭘 하셨어요?']),  -- 원본 6 · season=any(none) place=any era=7080 city_ok=n
  (18, 'pending://day-18', '마당 쓰는 아침', '빗자루', array['아침에 제일 먼저 하시던 일이 뭐예요?', '마당을 쓸어 보신 적 있으세요?']),  -- 원본 17 · season=any(none) place=country era=7080 city_ok=n
  (19, 'pending://day-19', '방과 후 교실', '칠판', array['칠판에 글씨를 써 보신 적 있으세요?', '무언가 배울 때 즐거우셨던 적이 있으세요?']),  -- 원본 12 · season=any(none) place=any era=7080 city_ok=n
  (20, 'pending://day-20', '둥근 밥상', '숟가락', array['밥상에 꼭 오르던 반찬은 뭐였어요?', '둥근 밥상에서 밥을 드셔 보신 적 있으세요?']),  -- 원본 21 · season=any(none) place=any era=7080 city_ok=y
  (21, 'pending://day-21', '대청마루 여름', '선풍기', array['더운 날 어떻게 시원하게 지내셨어요?', '마루에서 낮잠 주무셔 보셨어요?']),  -- 원본 19 · season=summer(text) place=country era=7080 city_ok=n
  (22, 'pending://day-22', '등굣길 책가방', '책가방', array['어디 갈 때 꼭 챙기시는 게 있으세요?', '멀리 가 보신 곳 중 좋았던 데가 있으세요?']),  -- 원본 22 · season=any(none) place=any era=7080 city_ok=n
  (23, 'pending://day-23', '장터 국밥집', '국자', array['장터에서 뭘 드셔 보셨어요?', '따끈한 국물 하면 뭐가 떠오르세요?']),  -- 원본 20 · season=any(none) place=country era=7080 city_ok=y
  (24, 'pending://day-24', '한복 걸린 방', '한복', array['한복을 입어 보신 날이 있으세요?', '좋아하는 색이 있으세요?']),  -- 원본 14 · season=any(none) place=any era=7080 city_ok=n
  (25, 'pending://day-25', '가마솥 김', '가마솥', array['가마솥에 무엇을 끓이면 좋을까요?', '김이 오르는 걸 보면 뭐가 생각나세요?']),  -- 원본 24 · season=any(none) place=country era=7080 city_ok=n
  (26, 'pending://day-26', '냇가 낚시', '낚싯대', array['냇가에서 놀아 보신 적 있으세요?', '물소리는 어떻게 들렸어요?']),  -- 원본 28 · season=summer(image) place=country era=7080 city_ok=n
  (27, 'pending://day-27', '탁자 위 꽃다발', '꽃다발', array['꽃다발을 받아 보신 날이 있으세요?', '꽃 하면 어떤 꽃이 먼저 떠오르세요?']),  -- 원본 25 · season=any(none) place=any era=7080 city_ok=y
  (28, 'pending://day-28', '잔치하는 앞마당', '앞마당', array['마을 잔치에 가 보신 적 있으세요?', '잔치 음식 중 뭐가 먼저 떠오르세요?']),  -- 원본 26 · season=any(none) place=country era=7080 city_ok=n
  (29, 'pending://day-29', '닭장 아침', '닭장', array['아침에 닭 울음소리를 들어 보셨어요?', '달걀을 꺼내 보신 적 있으세요?']),  -- 원본 29 · season=any(none) place=country era=7080 city_ok=n
  (30, 'pending://day-30', '흙담 골목 저녁', '흙담', array['저녁이 되면 어떤 소리가 들렸어요?', '골목에서 놀아 보신 적 있으세요?'])  -- 원본 30 · season=any(none) place=country era=7080 city_ok=n
;
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions)
select * from seed_photos on conflict (day_index) do nothing;

create temp table seed_questions (day_index int, option_a text, option_b text, prompt text, starter_a text, starter_b text, care_a text, care_b text) on commit drop;
-- care_a·care_b = '챙겨 드릴 거리'(0065, 설계서 2절 확정 열 그대로). 16·18·20·21·22·24일 ③ 짝·질문·첫마디는 2026-11-26 갈래 재설계로 교체(설계서 3절·4.1 W2).
insert into seed_questions values
  (15, '시장 구경', '공원 산책', '나들이를 간다면 어느 쪽이요?', '장 구경 가면 제일 먼저 보시던 게 무엇인지 여쭤봐요', '산책하기 좋아하시는 길이 있는지 여쭤봐요', '가까운 시장 같이 구경 가기', '가까운 공원 같이 산책'),
  (16, '호숫가 마을', '산골 마을', '버스 타고 가 보고 싶으신 곳은요?', '가 보고 싶은 호숫가가 있는지 여쭤봐요', '가 보고 싶은 산골 마을이 있는지 여쭤봐요', '가까운 호숫가 당일 나들이', '가까운 산골 마을 당일 나들이'),
  (17, '신나는 노래', '잔잔한 노래', '듣고 싶은 노래는요?', '신나게 부르시던 노래가 있는지 여쭤봐요', '편하게 들으시는 노래가 있는지 여쭤봐요', '흥겨운 옛 노래 틀어 드리기', '잔잔한 옛 노래 틀어 드리기'),
  (18, '이른 아침', '해 질 녘', '밖에 나가시기 좋은 때는요?', '이른 아침에 가 보고 싶은 곳이 있는지 여쭤봐요', '해 질 녘에 걷기 좋은 곳이 어디인지 여쭤봐요', '아침 일찍 동네 같이 걷기', '해 질 녘 공원 같이 걷기'),
  (19, '노래하기', '그림 그리기', '해 보고 싶은 쪽은요?', '좋아하시는 노래가 무엇인지 여쭤봐요', '그려 보고 싶은 게 있는지 여쭤봐요', '노래 교실 같이 가 보기', '색연필과 스케치북 선물'),
  (20, '옛날 가요', '민요 한 가락', '밥상 앞에서 듣고 싶으신 건요?', '즐겨 부르시던 옛날 가요가 무엇인지 여쭤봐요', '좋아하시는 민요가 있는지 여쭤봐요', '옛날 가요 음반 하나 선물', '민요 공연 같이 보러 가기'),
  (21, '빗소리', '풍경 소리', '마루에 앉아 듣고 싶으신 소리는요?', '비 오는 날 하고 싶은 일이 있는지 여쭤봐요', '풍경 소리 들으며 쉬고 싶은 곳이 있는지 여쭤봐요', '빗소리 모음 틀어 드리기', '창가에 걸 작은 풍경 선물'),
  (22, '섬 구경', '수목원 구경', '가방 메고 떠나신다면요?', '가 보고 싶은 섬이 있는지 여쭤봐요', '보고 싶은 나무나 꽃이 있는지 여쭤봐요', '배 타고 가까운 섬 당일 여행', '가까운 수목원 나들이'),
  (23, '국밥', '칼국수', '먹고 싶은 한 그릇은요?', '좋아하시는 국밥집이 있는지 여쭤봐요', '칼국수는 어떤 국물을 좋아하시는지 여쭤봐요', '국밥집에 같이 가기', '칼국수집에 같이 가기'),
  (24, '고운 목도리', '포근한 조끼', '선물로 받으시면 좋은 건요?', '좋아하시는 목도리 색이 있는지 여쭤봐요', '조끼는 어떤 색이 좋으신지 여쭤봐요', '고운 색 목도리 하나 선물', '포근한 조끼 하나 선물'),
  (25, '쌀밥', '잡곡밥', '좋아하는 밥은요?', '쌀밥에 곁들이고 싶은 반찬이 무엇인지 여쭤봐요', '잡곡밥에 넣고 싶은 곡식이 있는지 여쭤봐요', '갓 지은 쌀밥 차려 드리기', '잡곡 한 봉지 챙겨 가기'),
  (26, '바다 구경', '강가 구경', '물가에 간다면요?', '가 보고 싶은 바다가 있는지 여쭤봐요', '좋아하시는 강가나 냇가가 있는지 여쭤봐요', '가까운 바다 당일 나들이', '가까운 강가 같이 산책'),
  (27, '장미', '들꽃', '받고 싶은 꽃은요?', '좋아하시는 장미 색이 무엇인지 여쭤봐요', '길에서 보신 들꽃 중 예쁜 게 있었는지 여쭤봐요', '장미 꽃다발 선물', '들꽃 화분 하나 선물'),
  (28, '국수', '빈대떡', '잔치 음식은요?', '국수는 어떤 국물을 좋아하시는지 여쭤봐요', '빈대떡은 무엇을 넣은 걸 좋아하시는지 여쭤봐요', '국수 한 그릇 같이 먹기', '빈대떡 같이 부쳐 먹기'),
  (29, '달걀프라이', '삶은 달걀', '아침 달걀은요?', '달걀프라이는 어떻게 익힌 걸 좋아하시는지 여쭤봐요', '삶은 달걀과 같이 드시던 게 있는지 여쭤봐요', '아침상에 달걀프라이 올리기', '삶은 달걀 싸서 나들이 가기'),
  (30, '새벽 공기', '저녁 노을', '더 좋아하는 때는요?', '새벽 공기를 마시기 좋은 곳이 있는지 여쭤봐요', '노을이 예쁘던 곳이 어디인지 여쭤봐요', '나들이는 아침 일찍 출발로', '노을 보이는 곳으로 저녁 산책')
;
insert into public.content_questions (day_index, option_a, option_b, prompt, starter_a, starter_b, care_a, care_b)
select * from seed_questions on conflict (day_index) do nothing;

-- 1~14일 첫마디: 게시된 행에 비어 있을 때만 채운다(첫마디는 0024 수정 금지 대상이 아님, 0027). 이미 있으면 건드리지 않는다.
create temp table seed_starters (day_index int, starter_a text, starter_b text) on commit drop;
insert into seed_starters values
  (1, '봄에 가 보고 싶은 곳이 있는지 여쭤봐요', '가을에 자주 가시던 곳이 있었는지 여쭤봐요'),
  (2, '즐겨 들으시는 라디오 방송이 있는지 여쭤봐요', '요즘 즐겨 보시는 방송이 있는지 여쭤봐요'),
  (3, '숭늉 맛이 어땠는지 여쭤봐요', '식혜를 직접 만들어 보신 적 있는지 여쭤봐요'),
  (4, '단감을 어떻게 드시는 걸 좋아하시는지 여쭤봐요', '홍시 하면 떠오르는 곳이 있는지 여쭤봐요'),
  (5, '단풍이 예쁘던 산이 어디인지 여쭤봐요', '봄에 걷고 싶은 산길이 있는지 여쭤봐요'),
  (6, '명절에 좋아하시는 떡이 무엇인지 여쭤봐요', '명절에 즐겨 드시는 과일이 무엇인지 여쭤봐요'),
  (7, '밤에 걷기 좋은 길이 있는지 여쭤봐요', '낮에 산책하기 좋은 곳이 어디인지 여쭤봐요'),
  (8, '손편지에 어떤 이야기를 받고 싶으신지 여쭤봐요', '앨범에 넣고 싶은 사진이 있는지 여쭤봐요'),
  (9, '걸어 보고 싶은 바닷가가 있는지 여쭤봐요', '좋아하시는 산책길이 있는지 여쭤봐요'),
  (10, '김밥에 꼭 넣으시는 재료가 있는지 여쭤봐요', '주먹밥에 넣고 싶은 재료가 있는지 여쭤봐요'),
  (11, '비 오는 날 좋아하시는 부침개가 무엇인지 여쭤봐요', '좋아하시는 차가 무엇인지 여쭤봐요'),
  (12, '된장찌개에 꼭 넣으시는 게 있는지 여쭤봐요', '김치찌개는 어떤 김치로 끓이시는지 여쭤봐요'),
  (13, '가 보고 싶은 계곡이 있는지 여쭤봐요', '바닷가에 가면 하고 싶은 게 있는지 여쭤봐요'),
  (14, '수박을 어떻게 드시는 걸 좋아하시는지 여쭤봐요', '참외 맛있게 고르는 법이 있는지 여쭤봐요')
;
update public.content_questions c set starter_a = s.starter_a, starter_b = s.starter_b
  from seed_starters s where c.day_index = s.day_index and c.starter_a is null and c.starter_b is null;

-- 변경 감지(14d와 같은 방식)
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
