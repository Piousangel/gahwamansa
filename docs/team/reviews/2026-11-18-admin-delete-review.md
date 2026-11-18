# 0039 관리자 삭제·감사·content_runway 독립 보안 리뷰 · 2026-11-18

- 대상: `server-l1-launch` 9522f7d (`supabase/migrations/20261116000039_admin_delete_audit.sql`, `supabase/tests/admin_delete.test.sql`, down, dev-server-notes). main(c313134) 대비.
- 기준: DECISIONS(D-05 consent_events 함께 삭제, 11-17 웹 삭제 7일·10일), 13-road-to-launch SV-07, 11-backoffice §2·§4, dev-server-notes §4, legal/internal-management-plan §2·§6·§7, 0017·0023·0026·0036.
- 검토자: 독립 보안 리뷰 에이전트(작성자 아님). 코드 수정 없음.

## 검증 실행
- 임시 스택(project_id `bumo-admin-rev`, 포트 575xx, 공유 54322 미사용, 끝나고 `stop --no-backup`으로 제거): 0001~0039 39개 재생 + 시드 성공, `supabase test db` **Files=37, Tests=588, Result: PASS**(admin_delete.test.sql 포함).
- 추가 재현(트랜잭션 rollback): 권한 조회, 서비스 역할 감사 행 우회, 가족 시나리오 삭제 범위(아래 표).

## 판정: 병합 가능(높음 0). 중간 3건은 병합 전 또는 SV-08 전 후속으로 권장

## 높음
없음.

## 중간

### M1. 서비스 역할이 감사 행을 그대로 지우고 고칠 수 있다(트리거는 GUC 한 줄로 통과) — `0039:23·26-38·190-193`
- 사실: `admin_audit`는 anon·authenticated만 revoke. Supabase 기본 권한으로 **service_role은 SELECT·INSERT·UPDATE·DELETE·TRUNCATE 보유**(has_table_privilege 확인). 트리거는 `bumo.allow_audit_purge='on'`이면 통과하는데, 이 커스텀 GUC는 누구나 `set_config`로 켤 수 있다.
- 재현(service_role):
  ```sql
  set local role service_role;
  select set_config('bumo.allow_audit_purge','on',true);
  delete from public.admin_audit;      -- DELETE 3 (전부)
  truncate public.admin_audit;         -- 성공
  select public.purge_expired_data(now() + interval '2 years'); -- admin_audit 전부 파기(+ 모든 보관 데이터도 함께)
  ```
  `alter table ... disable trigger`는 소유자가 아니라 실패(정상).
- 영향: 감사 대상인 처리자(서비스 역할 스크립트)가 자기 기록을 지울 수 있다. 문서가 "기술적으로 지울 수 있음"을 인정하고 있으나, SV-07 문구는 "update·delete revoke + 변경 감지 트리거"인데 **revoke가 service_role에는 빠졌고 '감지'(흔적 남김)는 없다**. Studio(postgres)는 원래 우회 가능하므로 위험은 스크립트·Edge Function 경로에 한정 → 중간.
- 권장: `revoke update, delete, truncate on public.admin_audit from service_role;`(파기는 postgres 소유 definer인 purge가 하므로 영향 없음). purge의 감사 파기 기준은 `least(p_now, now())`로 고정(미래 p_now로 전체 파기 방지). GUC 대신 `current_user`/소유자 검사도 고려. pgTAP에 service_role 기준 update·delete·truncate 거부 추가.

### M2. "답·참여 기록만" 삭제에 이용 기록(events)의 참여 데이터가 남는다 — `0039:116-136`
- 사실: 삭제 안내(site/delete-account.html:32·41)와 방침(site/index.html:27)은 참여 기록을 "날짜, 완료 단계, 이용 시간, 연속 접속일"로 정의. `admin_delete_answers`는 answers·daily_sessions만 지운다. `events`에는 `profile_id`와 함께 `course_step_completed`·`course_completed`(props `day_index`·`duration_sec`)가 14개월 보관된다.
- 재현: 어르신에게 `course_completed {"day_index":3,"duration_sec":120}` 이벤트를 넣고 `admin_delete_answers` 실행 → 이벤트 그대로 남음(확인).
- 판정: 연결·동의(profiles·consent_events)를 유지하는 범위는 정책·계획 11 §4와 일치. 다만 이벤트의 코스 진행 기록은 정책상 "참여 기록"에 해당할 여지가 크다. **둘 중 하나 결정 필요**: (a) 해당 profile_id의 `course_*` 이벤트도 삭제(또는 profile_id null 처리로 익명화) (b) 방침·삭제 안내에 "서비스 개선용 이용 기록은 14개월 보관"을 분리 명시. 법무·정책 확인 항목. `content_seq`(진행 커서)도 같은 판단 대상(낮음).

### M3. pgTAP가 가장 위험한 권한·D-05 정리 범위를 고정하지 않는다 — `tests/admin_delete.test.sql`
- `account_delete_core`(security definer, **임의 profile id로 가족 전체 삭제 가능**)의 anon·authenticated 실행 거부 테스트가 없다. 지금은 revoke로 막혀 있음(has_function_privilege: service_role만)을 확인했지만, 회귀하면 아무 사용자나 아무 계정을 지울 수 있다.
- anon 거부 테스트 없음(authenticated만, 48-51행). 감사 불변성은 postgres로만 검사(80-81행) — service_role·truncate 검사 없음(M1을 놓친 이유).
- D-05(consent_events 함께 삭제)·events·push_log·push_claims·device_tokens·cheers 삭제를 계정 삭제 테스트 어디에서도 단언하지 않는다(rpc_delete는 device_tokens만). 현재는 FK cascade로 정리됨을 재현으로 확인(아래 표)했으나, 새 표가 FK 없이 추가되면 테스트가 잡지 못한다.
- `admin_delete_answers` 테스트가 다른 어르신 답·cheers·consent_events 유지를 단언하지 않는다.
- 권장: 위 항목 단언 추가(대략 8~10개). `pg_proc`에서 `prosecdef and has_function_privilege('authenticated', oid, 'execute')` 목록을 허용 목록과 비교하는 전역 테스트가 있으면 더 좋다.

## 낮음

| # | 파일:줄 | 내용 | 판정 |
|---|---|---|---|
| L1 | 0039:75 | `account_delete_core`가 service_role에 실행 가능 → 서비스 역할 코드가 감사 없이 계정 삭제 가능. `revoke ... from service_role` 해도 delete_my_account·admin_*(postgres 소유 definer)는 동작 | 권장 |
| L2 | 0039:52-58 | 마지막 두 자녀가 동시에 삭제(앱+관리자 경로)하면 둘 다 "다른 자녀 있음"을 보고 scope child → 어르신만 남은 가족·익명 계정 잔존. 0026부터 있던 경쟁, 관리자 경로로 가능성 소폭 증가. `families` 행 `for update` 잠금 권장 | 기존 동작, 후속 |
| L3 | 0039:110·133 | 감사 행에 대상 profile·family **전체 uuid** 1년 보관. 삭제 후엔 단독 식별력 낮으나 내부관리계획 §6 수기 대장 규칙("이용자 식별값은 끝 4자리만")과 다르다. reason은 자유 문자 200자 — 메일 주소·이름을 적지 않도록 dev-server-notes에 한 줄 명시 권장. internal-management-plan §7 파기 목록에 admin_audit 1년 추가 필요 | 문서 정합 |
| L4 | 0039:88-93 | `admin_check_args`가 `immutable`인데 예외를 던진다. 현재 호출 방식에선 문제없으나 `stable`/volatile이 정확. 사유 201자 이상이면 삭제 후 check 위반으로 전체 롤백(원자성은 지켜짐, 오류 메시지만 불친절) | nit |
| L5 | 기존 | 어르신 단독 삭제(scope parent) 후 `notification_queue.payload.parent_id`(삭제된 uuid)와 `redeem_attempts.uid`가 30일 파기까지 남음. 0039가 바꾼 동작 아님 | 참고 |
| L6 | 0039:141-153 | content_runway: content_seq = day_index라 비교는 맞음. 모든 어르신이 한 바퀴 돈 뒤(커서가 앞쪽으로 돌아감)엔 remaining_new_days가 크게 나와 경보가 안 울릴 수 있음 | 운영 참고 |

## 중점 항목별 결론
1. **delete_my_account → account_delete_core 이동**: 0026 본문과 논리 동일(auth.uid()→profiles.user_id, my_family_id/my_role→행 값; my_profile_id가 user_id로 찾으므로 동치). 기존 rpc_delete·family_delete_auth·push_tokens 테스트 통과. 0032~0038 표 정리 재현(admin 경로, 같은 가족에서 delete_answers → 어르신 a2 → 자녀 c2 → 마지막 자녀 c1):

   | 표 | 시작 → answers만 → parent → child → family |
   |---|---|
   | profiles | 4 → 4 → 3 → 3 → 0 |
   | consent_events (D-05) | 2 → 2 → 1 → … → 0 |
   | events / push_log / push_claims / device_tokens | 4 → 4 → 3 → … → 0 |
   | cheers / notification_queue | 1 → 1 → 1 → … → 0 |
   | auth.users(익명 어르신 포함) | 4 → 4 → 3 → … → 0 |
   | redeem_attempts(uid, FK 없음) | 1 → … → 1 (30일 파기, 기존) |

   push_runs는 개인 식별값 없음(집계 정수). 새 표 누락 없음 — 단, 전부 FK cascade 의존이고 테스트로 고정 안 됨(M3).
2. **권한**: admin_delete_account·admin_delete_answers·account_delete_core·admin_check_args 모두 anon·authenticated 실행 불가, admin_* 2개만 service_role grant. 전부 `search_path=''`, 객체 스키마 한정. 사유·처리자 null·공백 거부 확인. delete_my_account는 authenticated 유지·anon 불가(기존과 동일).
3. **admin_audit**: 앱 접근 불가·FK 없음(대상 삭제 후 유지) 정상. 불변성은 service_role에 뚫림(M1). 1년 파기 정상 동작(13개월 행만 삭제), GUC는 purge 후 'off' 복귀 확인.
4. **admin_delete_answers 범위**: 연결·동의 유지는 정책과 일치, 프로필 행 잠금 있음. 이벤트의 코스 기록 잔존이 약속과 어긋날 여지(M2).
5. **content_runway**: security_invoker, anon·authenticated select 불가(42501), service_role만. 앱 노출 없음.
6. **pgTAP**: 22개 단언, 행복 경로는 충실. 위험 권한·D-05·service_role 불변성 단언 부족(M3).

---

# 2부. 0040 콘텐츠 게시·은퇴(SV-08) · 커밋 8956121

- 대상: `supabase/migrations/20261116000040_content_publish.sql`, `supabase/tests/content_publish.test.sql`, `scripts/photos/publish-content.mjs`·`content-gate.mjs`(+test), down, dev-server-notes.
- 검증: 8956121 커밋 내용만 `git archive`로 꺼내 임시 스택(`bumo-admin-rev2`, 575xx)에서 실행. 워크트리에 있는 커밋 안 된 0041·0042는 제외(리뷰 범위 밖). 0001~0040 재생 + 시드 성공, **pgTAP Files=38, Tests=600, PASS**. 첫 reset은 DB 헬스체크 시간 초과로 실패했고 다시 실행해 통과했다(환경 문제, 코드 문제 아님). 게이트 단위 테스트 `node --test` **5/5 통과**. 확인 후 스택 제거.
- 권한(실측): `admin_publish_content`·`admin_retire_content`는 anon·authenticated 실행 불가이고 service_role만 실행 가능. 둘 다 security definer이며 `search_path=''`.
- 서비스 키 출력: 없다. 키는 요청 헤더에만 쓰고, 오류 출력은 HTTP 상태와 RPC 응답 앞 200자뿐이다.

## 판정: 병합 가능(높음 0). 중간 3건은 첫 production 게시 전에 처리 권장

## 높음
없음.

## 중간

### C-M1. 환경 이름을 다시 입력받지만 실제 대상과 대조하지 않는다 — `scripts/photos/publish-content.mjs:57-66`
- 사실: 입력값은 "local인지 아닌지"만 호스트와 비교한다. `SUPABASE_URL`이 production을 가리켜도 `staging`이라고 입력하면 production 확인 단계(호스트 재입력)를 건너뛰고 그대로 게시된다.
- 재현(코드 경로): `SUPABASE_URL=https://<prod-ref>.supabase.co` → 프롬프트에 `staging` 입력 → 59행 조건 통과, 63행은 `env === 'production'`일 때만 실행 → 업로드와 RPC가 실행된다.
- 권장: `scripts/db-push.sh`처럼 `app/env/<env>.env`의 `SUPABASE_PROJECT_REF`를 읽고 `host`가 `<ref>.supabase.co`인지 확인한다. 맞지 않으면 멈춘다.

### C-M2. 검수표가 "날 번호"만 확인하고 실제 사진 파일과 묶여 있지 않다 — `content-gate.mjs:33-51`, `publish-content.mjs:75`
- 사실: 검수 행은 `day`만 키로 쓴다. 묶음의 `photo` 값은 아무 파일명이나 될 수 있고, `..`로 경로를 벗어나는 값도 막지 않는다(`join(root,'content/photos', e.photo)`). 같은 day 행이 두 번 있으면 뒤 행이 이긴다.
- 재현(probe): `{day_index:15, photo:'../../../tmp/unreviewed-draft.JPG'}` + day 15 검수 완료 행 → `checkBatch` 문제 목록 `[]`(통과).
- 영향: "검수 전 사진은 공개 버킷에 올리지 않는다"(계획 11 §4, BO14)를 실수 하나로 깰 수 있다. 검수한 뒤 파일을 바꿔 넣어도 잡지 못한다.
- 권장: 검수표에 `파일`·`sha256` 칸을 추가하고 게이트에서 해시를 대조한다. `photo`는 `^day-\d+\.jpe?g$`만 허용하고 경로 이탈을 거부한다. day 중복 행도 거부한다.

### C-M3. 활성 날을 모두 은퇴시킬 수 있다. 그러면 모든 어르신의 오늘 콘텐츠가 사라진다 — `0040:61-75`
- 재현(service_role): 활성 날 1~3을 모두 `admin_retire_content` → 매번 `{ok:true}` → `content_next_day(0)` = **null**.
- 영향: 운영 실수 한 번(예: 반복문으로 일괄 은퇴)으로 서비스 전체에서 코스가 빈다. 은퇴는 되돌릴 수 없다(0024 트리거).
- 권장: 은퇴한 뒤 남는 활성 날이 일정 수(예: 7, content_runway 경보 기준) 아래로 내려가면 `{ok:false, reason:'too_few_active'}`를 돌려준다. 이미 은퇴한 날이면 `already_retired`를 돌려주고 감사 행을 남기지 않는다(C-L2).

## 낮음

| # | 파일:줄 | 내용 | 판정 |
|---|---|---|---|
| C-L1 | 0040:20 | `p_days = null`이면 `jsonb_typeof(null) <> 'array'`가 null로 평가돼 검사를 통과한다 → **`{ok:true, days:null}`과 빈 감사 행 1건**(재현 R1). `p_days is null or ...`를 추가한다 | 수정 권장 |
| C-L2 | 0040:65-72 | 이미 은퇴한 날을 다시 은퇴해도 `{ok:true}`이고 감사 행이 중복으로 쌓인다(R6, day 1 감사 2건) | 수정 권장 |
| C-L3 | 0040:25-33 | `image_url`의 스킴·호스트를 검사하지 않는다(`javascript:`·외부 추적 픽셀 URL도 게시됨, R3). caption·keyword 길이 제한이 없다(5000자 통과, R4). recall 빈 문자열도 허용한다. 서비스 역할 전용이라 낮음. `<SUPABASE_URL>/storage/v1/object/public/content-photos/` 접두와 길이 상한 검사를 권장 | 권장 |
| C-L4 | 기존 표 권한 | service_role이 `content_photos`·`content_questions`에 직접 insert할 수 있다(R7) → RPC·감사·게이트를 모두 우회한다. 1부 M1(admin_audit)과 같은 구조. `revoke insert on ... from service_role` 검토(시드는 postgres) | 권장 |
| C-L5 | 0039 vs 0040 시그니처 | `admin_delete_*(profile, reason, operator)`와 `admin_*_content(..., operator, reason)`의 인자 순서가 반대다 → Studio에서 SQL로 직접 부를 때 뒤바꿔 넣기 쉽다. 순서 통일 권장 | nit |
| C-L6 | publish-content.mjs:71-82 | 업로드 경로가 `day-N.jpg`(버킷 루트)다. DECISIONS 11-18의 캐시 회피 경로 `v2/day-NN.jpg` 규칙과 다르다. RPC가 실패하면 올린 사진은 공개 버킷에 남는다(안내는 있음) | 확인 |
| C-L7 | publish-content.mjs:39-44 | `existingMax`는 사진 표만 본다(서버는 두 표의 max). `--check`도 서비스 키를 요구한다. 서버가 최종 검사하므로 영향 작음 | nit |

## pgTAP·단위 테스트 품질(0040)
- 덮어쓰기·건너뛰기·중간 끼우기·자리표시·빈 문구·처리자 필수·감사(게시)·authenticated 거부는 잘 고정했다.
- 빠진 것: anon 거부, **authenticated의 `admin_retire_content` 거부**, 은퇴 후 `retired_at`이 실제로 찍혔는지와 은퇴 감사 행, `p_days` null·중복 day, 마지막 활성 날 은퇴 가드(C-M3 반영 시).
- 게이트 테스트: 경로 이탈·파일 바인딩·중복 행 케이스 없음(C-M2).
