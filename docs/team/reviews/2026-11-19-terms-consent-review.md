# 0046 약관·처리방침 동의 기록 + 푸시 문구 금지어 + pg_net 노출 점검 · 독립 보안 리뷰(xhigh) · 2026-11-19

- 대상: `server-l1-launch` e60d5c6 — `supabase/migrations/20261116000046_terms_agreement.sql`, `supabase/tests/terms_agreement.test.sql`, `admin_followups.test.sql`(definer 허용 목록), `supabase/ops/load-push-copy.mjs`, `remote-checks.sql`, dev-server-notes.
- 검증: e60d5c6의 `supabase/`·`scripts/`만 꺼내 임시 스택(`bumo-admin-rev6`, 575xx, 공유 54322 미사용)에서 실행. **0001~0046 46개 재생 + 시드 성공, pgTAP Files=46, Tests=705, PASS**. 끝나고 스택 제거. 추가 재현은 rollback 트랜잭션 안에서 실행. 코드 수정 없음.

## 판정: **합치기 가능(조건 1)**. 높음 0, 중간 1(TA-M1: 앱이 이 RPC를 실제로 부르기 전까지), 낮음 4. pg_net 건은 지금 직접 경로 없음, 재발 방지 테스트 권장

## 확인(정상)

| 항목 | 결과 |
|---|---|
| 본인만 | `auth.uid()`로만 기록하고 인자에 사용자 id가 없다. anon 실행 불가, 서비스 역할은 uid가 없어 `auth_required`. 익명 어르신 기기(authenticated + is_anonymous)도 기록 가능(의도) ✅ |
| 표 권한 | anon·authenticated는 select·insert·update·delete 모두 불가(RLS on, 정책 없음). service_role은 **select만**(insert·update·delete·truncate 회수) ✅ |
| 중복 무시 | 같은 사용자 advisory 잠금 → 직전 기록과 두 버전이 같으면 `recorded:false` ✅ |
| 계정 단위·cascade | `user_id → auth.users on delete cascade`. 앱·관리자 삭제 모두 인증 계정까지 지우므로 함께 사라진다(테스트 '계정을 지우면 동의 이력도 지워진다'). D-05와 같은 원칙 ✅ |
| 기록 내용 | user_id·역할·두 버전·시각만 남는다. IP·기기 정보 없음(최소 수집) ✅ |
| definer 허용 목록 | 앱이 실행할 수 있는 public definer 함수는 실측 **36개**이고 테스트 허용 목록과 같다(+`my_terms_status`·`record_terms_agreement`) ✅ |
| Q6 금지어 | `push_copy` 4개 열·`cheer_texts`에 check 제약. `push_text_clean`은 service_role만 실행 가능하고, 적재 스크립트 목록은 서버 목록 + '유료'로 맞다. '할인 안내' insert 거부 재현 ✅ |

## 중간

### TA-M1(조건). 서버가 "어떤 버전이 실제로 게시됐는지"를 모른다. 없는 버전·불가능한 날짜도 동의로 남는다 — `0046:15-16·31-36`
- 재현(authenticated):
  ```sql
  select record_terms_agreement('v999', '2099-12-31');   -- {"ok":true,"recorded":true}
  select record_terms_agreement('v1', '2026-13-45');     -- {"ok":true,"recorded":true}  (13월 45일)
  ```
  `my_terms_status()`는 그대로 `v999`를 돌려준다.
- 영향:
  - ① 법률 Q2의 목적은 "어느 문서에 언제 동의했나" 증빙인데, 이력에 게시된 적 없는 버전이 섞일 수 있다(앱 버그나 오래된 빌드의 문자열 실수 포함).
  - ② 앱이 `my_terms_status`와 현재 버전을 비교해 다시 동의받는 구조라서, 높은 버전 문자열이 한 번 기록되면 재동의 화면이 영영 뜨지 않을 수 있다(본인 계정 한정).
- 조건(앱 AU 연동 전): `terms_documents(kind, version, published_at)` 같은 게시 목록 표를 두고(시드·관리자 RPC + 감사), `record_terms_agreement`는 **게시된 버전만** 받는다(`unknown_version`). 날짜 형식은 `to_date` 왕복 검증, 또는 게시 목록 FK로 대체한다. pgTAP에 없는 버전·13월 날짜 거부를 추가한다.

## 낮음

| # | 위치 | 내용 | 권장 |
|---|---|---|---|
| TA-L1 | 0046:37-44 | 두 버전을 번갈아 보내면 부를 때마다 새 행이 생긴다(재현: 200번 호출 → 200행). 호출 상한이 없다. 본인 행만 늘지만 표가 부풀 수 있다 | TA-M1의 게시 목록으로 조합 수를 제한하거나, 사용자당 하루 상한(예: 20, events 상한과 같은 방식) |
| TA-L2 | 정책 문서 | 동의 이력의 보관 기간(계정 삭제 시 즉시 삭제)과 익명 어르신 세션 폐기(`discard_anonymous_session`) 때 함께 사라지는 점이 처리방침 보관표·internal-management-plan §7에 아직 없다. 삭제 뒤에는 동의 증빙이 남지 않는다는 점도 법률 줄 확인 필요(Q2 후속) | 방침 보관표에 한 줄, 법률 확인 |
| TA-L3 | 0046:59-61 | 금지어 검사는 부분 문자열 정규식이라 띄어 쓰거나("포 인 트") 폭 없는 공백(ZWSP)을 넣으면 통과한다(재현 2건 insert 성공). 적재 주체는 운영자뿐이라 위험이 낮다 | 비교 전에 공백·서식 문자(`[[:space:]​-‍﻿]`)를 지운 문자열로 검사 |
| TA-L4 | 0046:65·67 | check가 쓰는 함수(`push_text_clean`)를 나중에 `create or replace`로 바꿔도 기존 행은 다시 검사되지 않는다. 목록을 바꿀 때는 `alter table ... validate`가 아니라 drop·add constraint로 교체해야 한다 | 함수 머리말에 한 줄 |

## pg_net 노출(서버 줄 발견 건)에 대한 의견

- 실측: anon·authenticated가 `net` 스키마 USAGE를 갖고 `net.http_post`·`http_get` 등 12개 함수 실행, `net.http_request_queue`·`_http_response` select·insert가 가능하다. 플랫폼 기본값이고 소유자가 supabase_admin이라 마이그레이션으로 회수할 수 없다는 판단에 동의한다.
- 직접 경로: PostgREST 노출 스키마는 `public`, `graphql_public`뿐이다(config.toml). `net`은 REST로 부를 수 없다. 임시 스택에는 pg_graphql이 설치돼 있지 않아 GraphQL 경로는 로컬에서 확인할 수 없다(아래 권장 ②).
- 간접 경로 전수 점검(앱이 실행 가능한 public 함수 44개 = definer 36 + invoker 8):
  - 본문에 `net.http_*`·`push_kick` 사용 **0건**
  - 동적 SQL(`execute`) **0건**
  - dblink·`pg_read_file`·`copy` **0건**
  - pg_net을 쓰는 함수는 `push_kick`과 그것을 부르는 `push_daily_kick`·`push_events_kick`·`kakao_unlink_kick`뿐이고, **전부 앱 실행 불가(service_role·cron만)**이다.
  - `net.http_*`를 쓰는 트리거 0건
  - invoker 8개(`kst_today`·`parent_streak`·`choice_pair_prompt`·`parent_titles`와 트리거 가드 4개)는 net을 부르지 않는다.
- 판정: **지금 앱(anon·authenticated)에서 pg_net에 닿는 경로는 없다.** 남는 위험은 앞으로 생길 함수다(앱 실행 가능한 definer 함수가 사용자 입력으로 `net.http_post`나 `execute format(...)`을 부르게 되는 경우).
- 권장:
  - ① pgTAP 전역 단언 추가: "authenticated가 실행할 수 있는 public 함수의 `prosrc`에 `net.`·`execute`·`dblink`가 없다". 위 점검 쿼리를 그대로 쓰면 된다. definer 허용 목록 테스트 옆에 두면 새 함수가 그 규칙을 어길 때 걸린다.
  - ② staging에서 pg_graphql 상태를 확인한다. 쓰지 않으면 Dashboard에서 비활성화하고, 쓴다면 `net` 스키마가 노출되지 않는지 introspection 1회로 확인한다. 결과를 remote-checks에 한 줄 기록.
  - ③ Advisors(Security)에서 이 항목이 뜨면 "플랫폼 기본값·직접 경로 없음, 테스트로 고정"으로 수용 기록(dev-server-notes §9 남는 경고 목록).
