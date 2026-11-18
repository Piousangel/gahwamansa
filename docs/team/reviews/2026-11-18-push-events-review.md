# 2026-11-18 독립 보안 리뷰 — 응원 도착·연결 알림(0038)·push-events

- 대상: 브랜치 `server-l1-launch` 1920f39 (a46a541 대비) — 마이그레이션 0038, Edge Function `push-events`, `_shared/push.mts`(push-daily/lib.mts 이동), 일일 알림 본문 개인화(`{설명}`), `supabase/ops/load-push-copy.mjs`, 다운 파일, config.toml
- 기준: DECISIONS U11(자녀 즉시 알림은 연결·응원 관련만, 부모님 답 알림 없음)·284(08~21시, 혜택·유료 문구 금지), docs/team/legal/compliance-checklist.md #10, publish-drafts/privacy.html 62행(알림 내용 고지), docs/team/copy.ko.json `push.*`·`cheers.*`, 앞 리뷰 2026-11-18-push-tokens-review.md
- 검토자: 독립 보안 리뷰어(작성자 아님). 코드 수정 없음.

## 실행한 검증
- 공유 DB 미사용. 1920f39 스냅숏을 임시 스택(`bumo-jasik-sec-review`, db 56322)에서 0001→0038 재생 + `supabase test db` → **Files=36, Tests=566, Result: PASS**(push_events 신규 포함). `node --test supabase/functions/_shared/push.test.mts` → **16/16 pass**. 스택은 끝나고 삭제.
- 직접 탐침(롤백 트랜잭션, 두 가족):
  - 문구·응원 문장이 비어 있을 때: `push_events_claim` 대상 `[]`, 응원·연결 큐는 **소비하지 않음**. `push_events_kick`은 할 일이 있다고 보고 호출하려 함(로컬은 Vault가 없어서 `not_configured`).
  - 문구를 넣은 뒤: 응원은 **받는 어르신 토큰 하나에만**, 연결 알림은 **그 가족 자녀에게만**. 다른 가족 자녀는 대상이 아님. 응원 문장이 없으면 `body_many`로 "응원이 1개 왔어요"로 대체. 호칭은 가족 호칭 "부모님"으로 채워짐. 처리 뒤 kick → `nothing_to_send`.
  - `families.parent_title`이 NOT NULL이라 `{호칭}`이 빠지는 경우는 생기지 않음.
- tsc·앱 테스트는 범위 밖(서버·Edge)이라 돌리지 않음. Edge Function을 Deno로 실제 서빙하거나 FCM에 실제로 보내 보지는 않음.

## 판정
- **높음 0 / 중간 0 / 낮음 5** → **합치기 가능**. 낮음 L1·L2는 실발송을 켜기 전(US-10 secrets·문구 적재)에 처리 권장, 나머지는 선택.

## 중점 항목 확인

| 중점 | 결과 | 근거 |
|---|---|---|
| 대상: 응원은 받는 어르신만 | 충족 | `0038:131-148` cheers.to_parent → 그 어르신 토큰만, `role='parent'` 조인, `push_reachable`. pgTAP "자녀는 응원 도착 알림을 받지 않는다" + 탐침 |
| 대상: 연결은 그 가족 자녀만 | 충족 | `0038:158-166` `c.family_id = d.family_id and c.role='child'`. pgTAP "어르신은 연결 알림을 받지 않는다" + 탐침(다른 가족 자녀 제외) |
| U11 범위 | 충족 | 자녀에게 가는 즉시 알림은 연결·재연결뿐. 부모님 답 알림 경로 없음 |
| 공통 조건 | 충족 | 알림 켬 + `push_consented_at` + 심사 가족 아님 + 토큰(`push_reachable`, `0038:55-61`) |
| 잠금 화면 노출 | 수용(L3) | 본문에 들어가는 값: 오늘 사진 설명(AI 콘텐츠), 응원 문장(닫힌 4개), 호칭(닫힌 7개). 이름·번호·답 내용 없음. privacy.html 62행 "알림 내용에 부모님이 고른 답은 넣지 않으며, 부모님이 답했다는 알림을 자녀에게 보내지 않습니다"와 일치. FCM `data`는 `kind`만 |
| 법률 #10 | 충족 | 선점·발송 모두 KST 08:00~20:59(`0038:111,118-120`, kick `:207`). 밤 응원·연결은 아침까지 대기. 문구는 copy.ko.json WR-02 확정본(혜택·유료·재방문 재촉 없음) |
| 3일 지난 것 | 충족 | claim이 보내지 않고 처리 표시만(`0038:126-127`). kick도 3일 안 것만 할 일로 봄(`:210-211`). pgTAP "처리한 응원(3일 지난 것 포함)은 다시 나가지 않게 표시된다" |
| 5분 cron 빈 호출 | 대체로 충족(L1) | 창 밖이면 `outside_window`, 할 일 없으면 `nothing_to_send`로 함수를 부르지 않음. 다만 문구가 비었거나 dry-run일 때는 매번 부름 → L1 |
| 중복·선점 | 충족 | `update ... where notified_at is null / sent_at is null returning`이 선점. 동시 실행 시 두 번째는 행 잠금을 기다린 뒤 재평가해 건너뜀(READ COMMITTED). pgTAP "두 번째 실행은 같은 응원을 다시 보내지 않는다". 실패 시 재발송 안 함(일일 알림과 같은 원칙) |
| 템플릿 채움 실패 | 충족 | `push_render`(`0038:31-46`): 남은 자리값이 있으면 fallback, 없으면 자리값만 지움. 응원 문장이 없으면 `body_many`. 일일 사진 설명이 없으면 `body_fallback`. 본문이 null이면 `buildMessage`가 제목만 보냄. 호칭은 NOT NULL이라 항상 채워짐 |
| 권한 | 충족 | `push_events_claim`·`push_events_kick`은 service_role만. `push_kick`·`push_render`·`push_channel`·`push_reachable`은 PUBLIC·anon·authenticated 회수. `cheer_texts`는 정책 없음 + 회수. `push_kick`은 함수 이름 화이트리스트(`:191`) |
| 비밀·로그 | 충족 | push-events/index.ts는 push-daily와 같은 패턴(해시 비교, 서비스 계정 파싱 오류 원문 미기록, 오류 메시지 정규화, 토큰·id 미출력) |

## 낮음

**L1. 문구가 비었거나 dry-run이면 5분마다 함수를 부른다(최대 3일)**
- 위치: `0038:203-215`(kick은 할 일만 보고 문구 유무는 안 봄), `push_events_claim:130,153`(문구가 없으면 소비하지 않음), `_shared/push.mts` `runEvents`(dry-run이면 claim을 부르지 않음).
- 재현(탐침): `push_copy`가 비어 있고 3일 안의 응원이 있으면 claim 대상은 `[]`이고 큐가 그대로 남음 → kick이 계속 호출함. 0038을 반영하고 문구 적재(load-push-copy)나 FCM secrets(US-10)를 넣기 전이 바로 이 상태다. 응원 하나만 생겨도 창 안에서 5분마다 1회, 하루 약 156회, 3일간 Edge 호출이 일어남. 보안 문제는 아니고 비용·로그 소음.
- 권장: kick에서 `push_copy`에 해당 종류 문구가 있을 때만 그 종류를 할 일로 계산. 또는 `push_runs`에 직전 실행이 `dry_run`·`no_copy`면 1시간 쉬기.

**L2. load-push-copy.mjs의 `--approved`는 자기 신고뿐이고 어느 환경에 쓰는지 보여 주지 않는다**
- 위치: `supabase/ops/load-push-copy.mjs:39-49`. 대상은 환경변수 `SUPABASE_URL` 그대로이고 출력에 호스트가 없음. 확인 절차는 플래그 하나.
- 영향: 셸에 production 키가 남아 있으면 법률 확인 전 문구가 production에 들어가 실발송이 시작될 수 있음(문구가 들어가는 순간 발송 조건이 충족됨). 서비스 키는 출력하지 않음(확인). 실패 시 응답 본문 200자만 출력(키 없음).
- 권장: `scripts/db-push.sh`처럼 호스트(ref)를 출력하고 환경 이름을 다시 입력받기. production이면 추가 확인. 금지어 자동 검사(혜택·무료·할인·유료·이벤트·"다시 오세요"·"(광고)" 없음) 추가. 적재 시각·커밋 해시를 `push_copy.updated_at` 외에 남기면 증빙에 좋음.

**L3. 잠금 화면 내용 숨김을 쓰지 않음(선택)**
- 응원 문장("사랑해요, 오늘도 좋은 하루예요")·호칭("엄마 폰과 연결됐어요")이 잠금 화면에 그대로 보인다. 개인 식별 정보는 아니고 방침 고지와 맞음.
- 권장(선택): 앱 채널(AU-04)에서 `cheer`·`family` 채널의 lockscreenVisibility를 PRIVATE로 두거나, FCM `android.notification.visibility: 'PRIVATE'` 지정. 디자인·라이터와 판단.

**L4. 연결 알림 대상 판단에 어르신 쪽 상태를 쓰지 않음**
- 위치: `0038:163`. `left join profiles par`이라 큐 처리 전에 어르신 프로필이 지워져도(어르신 본인 삭제) 자녀에게 "연결됐어요"가 나갈 수 있음. 호칭은 가족 호칭으로 대체됨. 3일 안, 08~21시 사이의 짧은 경합이라 영향 작음.
- 권장: `join`으로 바꿔 어르신이 남아 있을 때만 보내기(재연결 알림도 같음).

**L5. 테스트 빈틈**
- pgTAP에 "다른 가족 자녀는 연결 알림을 받지 않는다"(탐침으로만 확인), "문구가 없으면 소비하지 않는다", "심사 가족 응원·연결 제외", "동시 두 실행"(순차 두 번만 있음) 단언이 없다.
- `push.test.mts`의 runEvents가 종류별 push_record 분리는 보지만 oauth 실패 시 note를 확인하는지는 이번에 보지 않음(16/16 통과만 확인).

## 참고(문제 아님)
- 응원 하루 한도(0020: 같은 자녀→같은 어르신 하루 2개)가 있어 어르신 기기 알림 폭주는 제한됨. 여러 개면 묶어서 "응원이 {n}개 왔어요" 1건.
- 일일 알림 `{설명}`은 그 어르신의 오늘 사진(`content_seq`) 설명. 사진이 없으면 "편할 때 열어 보세요". 개인정보 아님.
- `push_record`가 종류별로 남아 `push_runs`에서 N2·N3 발송 수를 따로 볼 수 있음.
