# r1 · 서버·데이터 엔지니어 — 독립 의견

## 현재 구조에서 개인화가 들어갈 자리
- `content_photos`(day_index unique, image_url, caption, keyword, recall_questions, retired_at)와 `content_questions`(day_index unique, option_a/b, prompt, starter_a/b, retired_at)가 **day_index로 짝**. 커서 `profiles.content_seq`가 "다음 활성 day_index"를 고른다(0024 `content_next_day`).
- 콘텐츠 반환 함수 3개가 day_index로 사진·질문을 조회: `get_today_content`/`start_today`, `preview_content`(0015, 미연결), `parent_history`(0028, photo_id 기준).
- `daily_sessions`에 그날 받은 `photo_id·question_id·word_id·day_index`가 이미 기록(0028). **선택 기록은 이미 있다.** 단 31일 뒤 파기(0023).
- `content_immutable_guard`(0024)는 `(day_index, caption, keyword, recall_questions)`·`(day_index, option_a, option_b, prompt)`만 비교한다 → **새로 추가한 태그 열은 게시 후에도 갱신 가능**. 즉 태그를 빌드 2에 붙여도 기존 행에 소급 가능하다(확인함).

## 설계 선택지
| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| A. 칸 안 변형 | `content_photo_variants(photo_id, place, era, image_url, retired_at)` 추가. 칸(day_index)·글은 그대로, 사진 주소만 변형에서 고름 | 커서·질문·starter·검수 흐름 불변. 반환 형태 불변(image_url 값만 다름) | 변형 이미지 관리(업로드 스크립트 확장) |
| B. 칸 자체에 태그 | day_index별로 place 태그, 커서가 내 태그에 맞는 다음 칸만 고름 | 단순 | 풀이 갈라져 콘텐츠가 2배 필요, "놓친 장 없이" 규칙과 충돌, 태그 바꾸면 커서 위치 꼬임 |
| C. 질문까지 변형 | 질문 문구도 갈래 | 회상 질문 정밀 | 검수 2배, starter 2배, 자녀 지난 답 비교 어려움 |
→ **A 추천.** B·C는 기각.

## 계절은 커서와 따로
계절 칸을 커서로 건너뛰면 "건너뛴 칸을 언제 보여 주나"를 기억해야 하는데, 본 기록(daily_sessions)은 31일 뒤 지워져 기억할 곳이 없다. 따라서 **상시 풀(커서, 계절 무관 장면)과 시즌 풀(날짜 구간으로 서빙, 예: 추석 주간)을 분리**하는 것이 깔끔하다(F23 "특집 끼우기"를 이 형태로). 상시 풀의 계절 칸은 30일 확장 때 계절 무관 장면으로 점차 교체(새 행 + retired_at).

## 선택 규칙 (A안, 빌드 2)
```
image_url = coalesce(
  (select v.image_url from content_photo_variants v
    where v.photo_id = p.id and v.retired_at is null
      and v.place = <내 취향> ),          -- 취향 없으면 이 줄 건너뜀
  p.image_url)                             -- 기본(지금 사진)
```
- 취향 'both'(둘 다)는 day_index 홀짝으로 번갈아(결정적, 재호출해도 같은 사진). 어르신이 같은 날 두 번 열어 다른 사진을 보면 안 된다.
- `daily_sessions`에 `photo_variant_id` 추가(null = 기본) → parent_history가 그날 본 그 사진을 다시 보여 줌(B2 "다시 보기"와 일치).
- `preview_content`(미연결)는 항상 기본.
- 자녀용 함수(child_summary·child_answer_history)는 사진을 돌려주지 않으므로 영향 없음. 빌드 2 F14(자녀도 같은 질문)에 사진이 붙으면 **기본 사진**만(변형으로 취향이 새지 않게).

## 저장
- `profiles.photo_pref text check (photo_pref in ('city','country','both'))`, null = 아직 안 고름. `photo_pref_set_at`은 두지 않는다(필요 없음).
- 0014 열 단위 권한이라 자녀 `select` 불가. 어르신 본인도 직접 select 대신 RPC(`set_photo_pref`, `get_today_content`에 `photo_pref` 키 추가)로.
- 계정 삭제 cascade로 함께 삭제. 파기 배치 대상 아님(상태값, 기록 아님).

## 빌드 1 제안
- 태그 열 3개(`season`, `place`, `era`)를 content_photos에 지금 넣어 prod P1에 태그와 함께 반영: 1.5~2h(pgTAP 포함). 나중 소급이 가능하므로 필수는 아님 — 다만 prod 마이그레이션 묶음(P2·P3)을 하나 줄인다.
- 이벤트: 지금 `course_step_completed{step, day_index}`로 콘텐츠 단위 집계 가능. 변형 속성은 빌드 2.

## 비용 추정 (빌드 2, A안, 가정)
마이그레이션(변형 표·취향 열·set_photo_pref·반환 함수 3개 갱신·daily_sessions 열·이벤트 화이트리스트) + pgTAP 15~20건: **6~9h**. 업로드 스크립트 변형 지원: 1~2h. 시즌 풀(별도 표·날짜 구간·커서와 우선순위): 6~10h.

## 내가 틀릴 수 있는 이유
- 홀짝 번갈아는 "둘 다"를 고른 분께 기대와 다를 수 있다(도시 사진이 반만 나옴). UX 판단 필요.
- 시즌 풀과 커서가 같은 날 겹칠 때 무엇을 먼저 보여 줄지(시즌이 커서를 하루 밀어내는지)는 아직 정하지 않았다.
