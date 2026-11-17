# 자녀 화면(③) 앱이 가정한 서버 계약 (앱 줄, 2026-11-17)
서버 줄 0019~0023이 만들어지는 중이라 `docs/team/dev-server-notes.md`가 없을 때 앱이 가정한 모양이다.
앱 쪽 근거: `app/src/features/types.ts`(타입), `fakeApi.ts`(동작), `realApi.ts`(호출·매핑, TODO 표시), `__tests__/childContract.test.ts`.
**서버 계약이 다르면 realApi 매핑만 고치면 된다**(화면은 types.ts 모양만 본다). 다른 점은 이 문서에 표시하고 맞춘다.

## 1. child_summary() 확장 (0019 어르신 구분 + 0021 끊김)
기존 반환에 어르신별 필드 3개를 더한다(하위 호환: 필드가 없으면 앱이 기본값으로 채움).
```json
{"parent_title": "부모님",
 "parents": [{"parent_id": "uuid", "title": "엄마", "shared": true, "connected": true,
              "latest": {"prompt": "…|null", "choice_label": "가을", "answered_date": "2026-11-16"}}]}
```
- `parent_id`: 어르신 프로필 id. 없으면 앱이 `parent-N`.
- `title`: 어르신별 호칭(닫힌 목록 7개). 없으면 가족 `parent_title`.
- `connected`: false = 연결이 풀림(어르신 프로필은 있으나 쓸 수 있는 세션이 없음: 폰 교체·앱 삭제·어르신 지우기 전 단계 등, 판정은 서버). 없으면 true.
- `answered_date`는 session_date(KST) 기준(마스터 계획 ③ 서버 선행).
- 순서: 어르신 프로필 만든 순서. 연결 전이면 `parents: []`.

## 2. child_answer_history() (0021, 신규)
자녀만(`child_required`), 같은 가족, 어르신별 최근 30일(`session_date >= kst_today()-29`), 최신순, 어르신당 최대 30개. 집계 값 없음.
```json
{"parents": [{"parent_id": "uuid", "title": "엄마", "shared": true,
              "answers": [{"answered_date": "2026-11-16", "option_a": "봄", "option_b": "가을", "choice_label": "가을"}]}]}
```
- 동의하지 않은 어르신: `shared:false, answers: []`(행은 남겨 화면이 "답을 나누지 않는 중이에요"를 보여 줌).
- 질문 짧은 형("봄과 가을 중")은 앱이 option_a·option_b로 만든다(보드 C §5 "생성 채택", 와/과는 받침으로).

## 3. send_cheer(p_message_key text) (0020, 신규)
```json
{"ok": true, "sent_to": 2}   |   {"ok": false, "reason": "daily_limit" | "not_connected" | "invalid_key"}
```
- 키 화이트리스트: `love_you`, `warm_day`, `always_thanks`, `peaceful_day`(copy-v3 6절 확정 4개). 나머지 키는 `invalid_key`.
- 받는 사람: 같은 가족의 **연결된 어르신 전부**(어르신 선택 UI 없음, 시안 C4). 연결된 어르신이 없으면 `not_connected`.
- 하루 한도: 값은 서버가 정함(앱은 `daily_limit`만 처리). 앱 표시 문구는 아직 없음 → 지금은 일반 서버 오류 문구(라이터 TODO).
- 자녀는 보낸 응원의 read_at을 읽지 못함(0014 유지).

## 4. set_parent_title(p_title text, p_parent_id uuid default null) (0019)
- `p_parent_id` null = 가족 기본 호칭(연결 전, 기존 동작). 값이 있으면 그 어르신의 호칭.
- 앱은 `p_parent_id`를 **줄 때만** 보낸다(지금 서버와 호환). 반환은 기존 `{ok}`.

## 5. 서버 없이 앱만으로 하는 것
- 로그인 수단: 세션 `app_metadata.provider`(kakao·google·email).
- 로그아웃: 소셜 SDK signOut → `auth.signOut({scope:'local'})`. 서버 데이터는 그대로.
- 새 폰 연결 번호(C7)·끊김 배너의 번호 만들기(C4): 기존 `issue_invite_code(p_target = parent_id)`. **확인 필요**: 0018 revoke가 재연결 번호(target 있음)를 가입 번호와 같이 무효화하는지.
- 연결 번호 만료 시각: `invite_codes.expires_at`(기존).

## 6. 앱이 아직 부르지 않는 것
- events(0022, U14 퍼널): 자녀 화면 이벤트 호출은 넣지 않았다(이벤트 이름 목록이 정해지면 추가).
- 31일 파기(0023): 앱 영향 없음.
- 푸시(연결됐어요, 알림 켜기): U15 이후. C3 "알림 켜기" 줄은 권한 상태 훅 자리만 있음.
