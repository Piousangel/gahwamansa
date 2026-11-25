-- 첫 빌드(테스트 트랙)용 콘텐츠 14일분. 공개 전에 30일분으로 늘린다.
-- 원본: docs/team/writer.md 30일 표. 행 끝 주석의 '원본'은 writer.md 일차.
-- 2026-11-17 계절 점검으로 14칸 순서 재배치(9~2월 시작자가 첫 7일 안에 정반대 계절 칸을 보지 않게). 원격 게시 전이라 day_index를 다시 매김.
--   표·근거: docs/team/photo-curator.md 9절. 사진 파일(content/photos/day-NN)도 같은 번호로 이름을 바꿨다.
-- 행 끝 태그(빌드 1 개인화 기반, 서버 미사용): season(계절, 괄호=단서 위치 text|image|none) place era city_ok(도시판 가능). 원본은 scripts/photos/prompts.json tags.
-- image_url은 자리표시(pending://day-N). AI 사진이 완성되면 교체한다.
-- 전제: content_photos.recall_questions(text[], 2개), content_questions.prompt(text) 컬럼이 이미 있어야 한다.
-- 다시 실행해도 안전: 이미 있는 day_index는 건너뛰고(게시 후 수정 금지, 0024 트리거), 시드 문구가 DB와 다르면 WARNING으로 알린다.
-- 문구를 고치려면 이 파일을 고치지 말고 새 day_index 행을 끝에 추가하고 옛 행에 retired_at을 넣는다(docs/team/dev-server-notes.md §5).
-- 예외(2026-11-25, DECISIONS '콘텐츠 시드 수정·② 보기 적재' 대기열 25·#261): production 게시 전이라 이 파일에서 직접 고쳤다
--   (라이터 확정 11-25: ① 첫 질문 '기억' 금지(#249로 첫 질문만 보임), 어르신께 묻는 존대 '~보신 적 있으세요?', 숨은 둘째 질문의 '기억'·정답형도 뺌).
-- staging 재시드(오너 승인 필요, #261 QA-1 M1 — DECISIONS·PR 본문과 같은 글):
--   범위: staging 1~14일 중 ① 사진 질문 12일(2·3·4·5·7·8·9·10·11·12·13·14) + ③ 질문 문장 8·14일. 이 시드를 staging에 다시 돌리면 WARNING만 나고 바뀌지 않는다.
--   길 A(같은 day_index 삭제 후 재시드, bumo.allow_content_delete): ③ 행(8·14일)은 answers.question_id FK에 막혀 그날 답을 먼저 지워야 한다(실제 손실).
--     사진 행을 지우면 daily_sessions는 남고 photo_id·word_id가 NULL → 그날 기록에서 사진이 빠진다.
--     ② 보기 적재 뒤라면 사진 삭제가 보기 → 고른 ②(recall_picks) → ⑤ recall_story까지 cascade로 지운다 → A는 ② 적재 전에.
--   길 B(새 day_index 끝에 추가 + 옛 날 retired_at): 손실 없음. 다만 ② 보기 적재 SQL·CSV가 날 1~30 고정이라 31일 이후 날의 ② 보기 확장 작업이 따로 필요.
--   권장: staging 테스트 가족 데이터(8·14일 답·해당 날 세션)가 거의 없으면 A, ② 적재 전에.
-- 2026-11-26(기획 v2.1 콘텐츠 갈래, 설계서 docs/team/2026-11-26-content-axes.md — #283 설계·#285 라이터 확정): production 게시 전이라 이 파일에서 직접 고쳤다.
--   ③ 8·9·13일 보기·질문 교체(행동으로 이어지는 짝으로), 14일분 '챙겨 드릴 거리' care_a·care_b(0065) 추가. 글자는 설계서 2·3절 그대로
--   — supabase/ops/content-care-seed.test.mjs 가 대조한다. staging은 #261 재시드와 한 번에(길 A, 오너 승인 — 범위·순서는 server/content-axes PR 본문).
--   게시된 날의 care는 비어 있고 ③ 보기가 같을 때만 아래 UPDATE가 채운다(care는 0024 수정 금지 대상이 아님).
begin;


create temp table seed_photos (day_index int, image_url text, caption text, keyword text, recall_questions text[]) on commit drop;
insert into seed_photos values
  (1,  'pending://day-1',  '마을 입구 나무',   '나무',   array['나무 아래서 쉬어 본 적 있으세요?', '어떤 계절의 나무가 떠오르세요?']),  -- 원본 1 · 재배치 전 1 · season=autumn(image) place=country era=7080 city_ok=y
  (2,  'pending://day-2',  '라디오가 있던 방', '라디오', array['라디오로 즐겨 들으시던 게 있으세요?', '어디서 들으셨어요?']),  -- 원본 3 · 재배치 전 5 · season=any(none) place=any era=7080 city_ok=n
  (3,  'pending://day-3', '시골집 부엌',      '부엌',   array['아궁이에 불 지피는 걸 보신 적 있으세요?', '부엌 하면 어떤 냄새가 생각나세요?']),  -- 원본 23 · 재배치 전 13 · season=winter(image) place=country era=7080 city_ok=y
  (4,  'pending://day-4',  '감 익는 마당',     '감',     array['감을 따 본 적 있으세요?', '곶감이나 홍시 중 뭐가 떠오르세요?']),  -- 원본 7 · 재배치 전 2 · season=autumn(text) place=country era=7080 city_ok=y
  (5,  'pending://day-5', '단풍 든 산길',     '단풍잎', array['단풍 구경을 가 보셨어요?', '낙엽을 주워 보신 적 있으세요?']),  -- 원본 27 · 재배치 전 14 · season=autumn(text) place=any era=7080 city_ok=n
  (6,  'pending://day-6',  '송편 빚는 날',     '송편',   array['송편 빚을 때 어떤 모양을 만드셨어요?', '속은 뭘 좋아하세요?']),  -- 원본 13 · 재배치 전 8 · season=autumn(text) place=any era=7080 city_ok=n
  (7,  'pending://day-7',  '한가위 보름달',    '달',     array['달을 보며 빌어 보신 적 있으세요?', '보름달 밤에 뭘 하셨어요?']),  -- 원본 8 · 재배치 전 3 · season=autumn(text) place=country era=7080 city_ok=y
  (8,  'pending://day-8', '공책과 연필',      '연필',   array['연필을 깎아 보신 적 있으세요?', '공책에 무엇을 즐겨 쓰셨어요?']),  -- 원본 11 · 재배치 전 11 · season=spring(image) place=any era=7080 city_ok=n
  (9,  'pending://day-9',  '툇마루 고무신',    '고무신', array['툇마루에 앉아 보신 적 있으세요?', '어릴 적 즐겨 신으시던 신발이 있으세요?']),  -- 원본 10 · 재배치 전 7 · season=spring(image) place=country era=7080 city_ok=n
  (10, 'pending://day-10',  '소풍 도시락',      '도시락', array['소풍 도시락엔 뭘 싸 가셨어요?', '어디로 소풍 가셨어요?']),  -- 원본 16 · 재배치 전 9 · season=spring(image) place=country era=7080 city_ok=y
  (11, 'pending://day-11',  '비 오는 날 처마',  '우산',   array['비 오는 날 하시던 일이 있으세요?', '빗소리는 어떻게 들렸어요?']),  -- 원본 5 · 재배치 전 6 · season=summer(image) place=country era=7080 city_ok=y
  (12, 'pending://day-12',  '장독대 아침',      '항아리', array['항아리 뚜껑을 열어 보신 적 있으세요?', '장독대에서 하시던 일이 있으세요?']),  -- 원본 9 · 재배치 전 4 · season=summer(image) place=country era=7080 city_ok=y
  (13, 'pending://day-13', '우물가 한낮',      '두레박', array['우물물을 길어 보신 적 있으세요?', '우물가에서 사람들이 뭘 했나요?']),  -- 원본 15 · 재배치 전 12 · season=summer(image) place=country era=7080 city_ok=n
  (14, 'pending://day-14', '여름 저녁 평상',   '평상',   array['평상에 누워 보신 적 있으세요?', '여름 저녁엔 뭘 드셨어요?'])  -- 원본 18 · 재배치 전 10 · season=summer(text) place=country era=7080 city_ok=y
;
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions)
select * from seed_photos on conflict (day_index) do nothing;

create temp table seed_questions (day_index int, option_a text, option_b text, prompt text, care_a text, care_b text) on commit drop;
-- care_a·care_b = '챙겨 드릴 거리'(0065, 설계서 2절 확정 열 그대로). 8·9·13일 ③ 짝·질문은 2026-11-26 갈래 재설계로 교체(설계서 3절).
insert into seed_questions values
  (1, '봄', '가을', '어느 계절이 더 좋으세요?', '봄꽃 필 때 꽃길 나들이', '가을볕 좋은 날 공원 나들이'),
  (2, '라디오 듣기', '텔레비전 보기', '편하게 즐기는 쪽은요?', '작은 라디오 하나 선물', '옛날 드라마 같이 다시 보기'),
  (3, '구수한 숭늉', '달콤한 식혜', '마시고 싶은 건요?', '누룽지 한 봉지 챙겨 가기', '식혜 한 병 사 가기'),
  (4, '단감', '홍시', '어느 맛이 더 좋으세요?', '단감 한 상자 챙겨 가기', '홍시 한 상자 챙겨 가기'),
  (5, '가을 산', '봄 산', '걷고 싶은 산은요?', '가을에 가까운 산 단풍 구경', '봄에 가까운 산 꽃구경'),
  (6, '떡', '과일', '명절에 먼저 집는 건요?', '명절에 떡 한 접시 챙겨 가기', '명절에 과일 바구니 챙겨 가기'),
  (7, '밤 산책', '낮 산책', '걷고 싶은 때는 언제예요?', '저녁에 동네 한 바퀴 같이 걷기', '볕 좋은 낮에 공원 같이 걷기'),
  (8, '손편지', '사진 앨범', '받으시면 반가운 건요?', '손편지 한 장 부쳐 드리기', '가족사진 뽑아 앨범 만들기'),
  (9, '바닷가 길', '숲길', '걸어 보고 싶으신 길은요?', '가까운 바닷가 길 같이 걷기', '가까운 숲길 같이 걷기'),
  (10, '김밥', '주먹밥', '소풍 도시락은 어느 쪽이요?', '나들이 때 김밥 싸 가기', '나들이 때 주먹밥 싸 가기'),
  (11, '부침개', '따뜻한 차', '비 오는 날 생각나는 건요?', '비 오는 날 부침개 같이 먹기', '차 한 상자 선물'),
  (12, '된장찌개', '김치찌개', '오늘 먹고 싶은 찌개는요?', '된장찌개 집에 같이 가기', '김치찌개 집에 같이 가기'),
  (13, '계곡 물가', '바닷가 모래밭', '더운 날 쉬러 가고 싶으신 곳은요?', '여름에 계곡 그늘로 나들이', '바닷가 모래밭 산책 같이 가기'),
  (14, '수박', '참외', '여름엔 어느 과일이 좋으세요?', '여름에 수박 한 통 사 가기', '여름에 참외 한 봉지 사 가기')
;
insert into public.content_questions (day_index, option_a, option_b, prompt, care_a, care_b)
select * from seed_questions on conflict (day_index) do nothing;
-- 이미 게시된 날: '챙겨 드릴 거리'가 비어 있고 ③ 보기가 시드와 같을 때만 채운다(care는 0024 수정 금지 대상이 아님, 0065). 이미 있으면 건드리지 않는다.
update public.content_questions c set care_a = s.care_a, care_b = s.care_b
  from seed_questions s
 where c.day_index = s.day_index and c.care_a is null and c.care_b is null and (c.option_a, c.option_b) = (s.option_a, s.option_b);

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
