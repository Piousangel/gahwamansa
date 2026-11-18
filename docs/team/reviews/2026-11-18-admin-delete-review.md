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

---

# 3부. 재검토 — 0041·0042·0043 + SV-12 형제 시나리오 · 커밋 2e02765·00fcffa·4dc5f39·7383c1b

- 검증: 7383c1b의 `supabase/`·`scripts/`만 `git archive`로 꺼내 임시 스택(`bumo-admin-rev3`, 575xx, 공유 54322 미사용)에서 실행. **0001~0043 43개 재생 + 시드 성공, pgTAP Files=43, Tests=668, PASS**(보고 수치와 같음). 단위 테스트(node 26): 게이트 **8/8**, kakao.test **4/4**, push.test **17/17**. 끝나고 스택 제거.
- 추가 재현은 트랜잭션 안에서 실행하고 rollback으로 되돌렸다(아래 K·A·P 항목).

## 판정: **합치기 가능(조건 1)**. 높음 0, 중간 1(카카오 해제 포기 감시: 첫 production 카카오 로그인 공개 전까지), 나머지는 낮음

## 1·2부 지적 반영 확인

| 지적 | 반영 | 재현·테스트로 확인 |
|---|---|---|
| M1 감사 우회 | service_role의 insert·update·delete·truncate와 시퀀스 권한 회수, `purge_expired_data` 미래 시각 거부(`future_now`) | GUC를 켜도 delete·truncate·insert 모두 `permission denied`, 미래 p_now는 `future_now` ✅ |
| M2 코스 이벤트 | `admin_delete_answers`가 `course_step_completed`·`course_completed`·`photo_zoom_opened`도 지움 | 코스와 무관한 이벤트·다른 어르신 답·응원·동의 이력은 유지(admin_followups) ✅ |
| M3 테스트 | definer 함수 허용 목록 전역 단언, core 직접 호출 거부, D-05·events·push_log·push_claims·device_tokens·cheers 삭제 단언 | ✅ (특히 허용 목록 테스트가 좋다) |
| L1 core 직접 호출 | service_role에서도 회수 | `permission denied for function account_delete_core` ✅ |
| L2 동시 삭제 | `families` 행 `for update`로 줄 세움 | 코드 확인. 잠근 뒤 자녀 존재를 다시 판단하므로 맞음 ✅ |
| L4 immutable | volatile ✅ | — |
| C-M1 대상 확인 | `supabase/ops/target-check.mjs`: `app/env/<env>.env` ref ↔ 호스트 대조, production은 호스트 재입력. load-push-copy에도 적용 | 코드 확인 ✅ |
| C-M2 파일 바인딩 | 검수표 `파일`·`sha256` 칸, 이름은 `day-N.jpg`만, 중복 행 거부 | 게이트 8/8. 경로 이탈 차단 ✅ |
| C-M3 전부 은퇴 | 은퇴 뒤 활성 날 7일 미만이면 `too_few_active` | ✅ |
| C-L1·L2·L5·L6·L7 | null 거부·already_retired·인자 순서 (대상, 사유, 처리자) 통일·`v2/day-NN.jpg`·두 표 max | ✅ |
| C-L3 image_url | 경로 형식·길이 상한 반영. **호스트는 아무거나 통과**(아래 R-L1) | 부분 |
| C-L4 직접 insert | insert·delete·truncate 회수, update는 사진 주소 갱신용으로 남김 | insert는 거부 ✅. update로 `image_url` 바꾸기는 가능(R-L2) |

## 0042 카카오 연결 끊기(xhigh)

확인한 것(정상):
- 큐 적재: 공통 함수 안에서 인증 계정을 지우기 **직전에** `auth.identities(provider='kakao').provider_id`를 넣는다. 앱 삭제와 관리자 삭제가 같은 경로를 탄다. 재현 K1에서 카카오 자녀를 관리자 삭제하자 큐 1행이 쌓이고(회원번호, attempts 0) 감사 detail에는 회원번호가 없었다.
- 권한: claim·record·kick·push_kick은 service_role만 실행할 수 있고 전부 definer, `search_path=''`이다. 큐는 anon·authenticated 접근 불가다. cron `kakao-unlink`는 `*/10`이고 할 일이 있을 때만 Edge를 부른다.
- Edge: `verify_jwt=false` + `x-cron-secret` 상수시간 비교이고, `safeEqual`은 빈 값이면 false라서 secret이 없을 때 열리지 않는다. 어드민 키는 Authorization 헤더에만 쓰고, 로그·응답에는 요약 숫자만 남는다. 오류 메시지는 80자로 자르고 특수문자를 치환한다. 키가 없으면 선점하지 않아 시도 횟수를 헛되이 쓰지 않는다.
- 재시도·포기: 선점할 때마다 attempts+1, 다음 시도는 2^n분 뒤(상한 24시간). 10번째 실패를 기록하면 `gave_up_at`이 찍히고 다시 선점되지 않는다(K2: 401을 10번 → gave_up 1, 이틀 뒤 선점도 `[]`). 상태값 이상은 `invalid_status` 예외다. 성공이나 -101·-103이면 행을 바로 지운다.
- 보관: 포기했거나 30일이 지난 행은 파기 배치가 지운다(K3에서 1행 삭제). 10번 시도는 약 34시간 안에 끝나므로 30일 기한과 충돌하지 않는다. 처리방침의 "30일 내 삭제"와 맞는다.

### R-M1(중간, 조건). 해제를 포기한 회원번호가 아무도 모른 채 30일 뒤 사라진다 — `0042:47-70`, `kakao.mts:9-15`
- 사실: 어드민 키가 틀렸거나 회수됐으면(401, -401) 모든 항목이 `retry`로 분류된다. 그러면 약 34시간 만에 전부 `gave_up`이 되고, 30일 뒤 파기된다. 포기 건수는 Edge 로그 요약(`gave_up`)에만 남고 운영 점검 절차(06시 루틴, 월 점검)에는 없다.
- 영향: 카카오 연결 끊기 의무가 조용히 이행되지 않는다. 키 오류 한 번이면 그동안 탈퇴한 사람 전원이 해당된다.
- 조건(첫 production 카카오 로그인 공개 전까지):
  - ① 06시 루틴이나 dev-server-notes 월 점검에 `select count(*) from kakao_unlink_queue where gave_up_at is not null`을 넣는다.
  - ② 401·403(키 문제)은 시도 횟수를 쓰지 않고 그 회차를 중단하도록 바꾸는 것을 권장한다(재현은 K2).

### 낮음(0042)

| # | 파일:줄 | 내용 |
|---|---|---|
| K-L1 | 0042 전체 | 해제는 최대 10분 늦게 처리된다. 그 사이 같은 카카오 계정으로 다시 가입하면, 뒤늦은 unlink가 **새 계정의 카카오 연결**을 끊는다(다음 로그인 때 동의를 다시 받음). 영향은 작다. 처리 직전에 같은 provider_id가 `auth.identities`에 다시 있는지 확인하고 건너뛰는 방법 권장 |
| K-L2 | 0042:21 | service_role이 `kakao_unlink_queue` 전체 DML을 가진다(대기 건을 지울 수 있음). 감사 대상은 아니지만 0043의 정리 방향에 맞추려면 insert·update·truncate 회수 검토 |
| K-L3 | 운영 | Studio에서 인증 사용자를 직접 지우는 등 공통 함수 밖의 삭제 경로는 큐에 안 들어간다. internal-management-plan §2(Studio 편집은 장애 때만)에 "사용자 삭제는 admin_delete_account로만" 한 줄 추가 권장 |

## 0041(푸시 낮음·connected_date)
- 문구가 없으면 응원을 소비하지 않고, dry-run이면 1시간 쉬고, 지워진 어르신 큐로는 연결 알림을 보내지 않는 것이 테스트로 고정돼 있다. 문제 없다.
- `connected_date` = 어르신 프로필 생성일(KST)이다. 어르신 프로필은 redeem 때 만들어지고(0004·0028 insert 위치 확인) 재연결해도 유지되므로 정의와 맞는다. 같은 가족 자녀에게만 보인다(테스트 3). 새로 드러나는 정보는 연결 날짜뿐이라 노출 범위 문제는 없다.

## 0043 남은 낮음

| # | 파일:줄 | 내용 |
|---|---|---|
| R-L1 | 0043:64 | `image_url` 정규식이 호스트를 제한하지 않는다. `https://evil.example/storage/v1/object/public/content-photos/v2/day-15.jpg`가 게시됐다(P1). http도 허용된다. vault `project_url`과 접두를 비교하고 https만 허용할 것을 권장. 테스트 "공개 사진 버킷 주소만"도 경로만 검사한다 |
| R-L2 | 0043:12·18 | service_role이 `content_photos.image_url`을 update로 아무 주소로 바꿀 수 있다(감사 없음, 재현에서 1행 변경). 의도된 예외라고 문서화돼 있다. upload-photos가 끝나면 update도 회수하거나 주소 변경 RPC + 감사로 옮길 것 |
| R-L3 | 0043:14 | service_role은 `admin_audit` SELECT를 유지한다(월 점검용, 의도). 감사 행에는 uuid 전체가 남는다(1부 L3). 문서 정합 항목은 그대로 열려 있다 |

## SV-12 형제 시나리오(sibling_scenario.test.sql)
- 두 자녀가 같은 답을 보고, 응원 한도를 따로 쓰고, 미리보기 범위가 child이고, 한 명이 지우면 본인만·마지막이면 가족 전체와 어르신 익명 계정까지 지워지고, 보낸 응원이 함께 지워지는 것까지 종단으로 단언한다. 충분하다.

---

# 재검토 4 — 0044 카카오 해제·콘텐츠 재검토 반영 · 커밋 64ea074

- 검증: 64ea074의 `supabase/`·`scripts/`만 꺼내 임시 스택(`bumo-admin-rev4`, 575xx, 공유 54322 미사용)에서 실행. **0001~0044 44개 재생 + 시드 성공, pgTAP Files=44, Tests=680, PASS**(보고 수치와 같음). kakao 단위 테스트 **5/5**. 끝나고 스택 제거. 추가 재현은 rollback 트랜잭션 안에서 실행.

## 판정: **합치기 가능(조건 없음)**. R-M1 조건 충족, 높음·중간 0, 새 낮음 2

## 반영 확인

| 항목 | 반영 내용 | 확인 |
|---|---|---|
| R-M1 키 오류 | 401·403·-401이면 `config`로 분류해 회차를 멈춘다. 못 한 항목은 `kakao_unlink_release`로 선점을 풀고(attempts −1, 1시간 뒤), `push_runs(kind='kakao_unlink', note='config_error')`에 남긴다. 정상 회차도 완료·재시도·포기 수를 기록한다. 운영 점검 §14-1과 metrics ⑧(대기·포기·가장 오래된 대기·7일 config_error·해제 수) 추가 | 재현 K2: release → attempts 0, 1시간 뒤, last_http 401, push_runs config_error 1행 ✅. 단위 테스트 5/5 ✅ |
| K-L1 재가입 | claim 직전에 같은 provider_id의 identity가 큐 적재 이후에 만들어졌으면 해제하지 않고 행을 지운다 | 재현 K1: 재가입한 회원번호는 선점되지 않고 다른 회원번호만 선점 ✅ |
| K-L2 큐 쓰기 | service_role의 insert·update·delete·truncate·시퀀스 권한 회수(select만 남김) | 직접 delete `permission denied` ✅ |
| R-L1 사진 주소 | https만 허용. Vault `project_url`이 있으면 그 호스트만 허용 | http 거부 ✅, Vault가 있을 때 외부 호스트 거부·`<ref>.supabase.co.evil.example` 같은 닮은 호스트 거부 ✅ |
| R-L2 주소 변경 감사 | `content_photos.image_url` 변경 시 트리거가 `admin_audit(content_image_url, day_index, host)`를 남긴다. 월 점검 §14-5 | 감사 행 생성 ✅. 처리자 값은 아래 Q-L1 |

## 새 낮음

| # | 파일:줄 | 내용 | 권장 |
|---|---|---|---|
| Q-L1 | 0044:22 | 감사 트리거가 security definer라서 `current_user`가 언제나 함수 소유자 **`postgres`**다. service_role이 주소를 바꿔도 처리자가 `postgres`로 남는다(재현 I1). 같은 definer 안에서 `current_setting('role')`은 `service_role`을 돌려준다(확인). Studio(postgres)에서 바꾸면 `none`이 된다 | `coalesce(nullif(current_setting('role', true), 'none'), session_user)`로 바꾸고 테스트에 처리자 단언 추가 |
| Q-L2 | 0044:113-124 | Vault에 `project_url`이 없으면 https 형식만 검사해서 외부 호스트가 통과한다(재현 P1, 로컬 기준). staging·production은 푸시 cron 때문에 Vault 값이 이미 필요하므로 실제 위험은 작다. 반대로 로컬(http://127.0.0.1)에서는 게시 스크립트가 늘 `invalid_item`이 된다 | dev-server-notes에 "Vault project_url이 없으면 호스트를 검사하지 않음, 로컬 게시는 pgTAP로만 확인" 한 줄 추가 |

## 참고(조치 불필요)
- `kakao_unlink_release`는 반복 호출해도 attempts가 0 아래로 내려가지 않는다(greatest). service_role 전용이라 남용 경로는 없다. 키 오류가 30일 넘게 이어지면 큐 행은 적재 후 30일 파기로 사라진다. 이제는 ⑧ `config_error_runs_7d`와 `oldest_waiting`으로 먼저 드러난다.
- metrics ⑥(푸시 종류별 요약)에 `kakao_unlink` 행이 함께 나온다. 해석할 때 `where kind <> 'kakao_unlink'`를 넣으면 깔끔하다(낮음 미만).

---

# 재검토 5 — 0045 테스터 가족 표시·Q-L1·SV-17 대장·§17 낮음 처리표 · 커밋 32a0d11·cfcb221

- 검증: cfcb221의 `supabase/`·`scripts/`만 꺼내 임시 스택(`bumo-admin-rev5`, 575xx, 공유 54322 미사용)에서 실행. **0001~0045 45개 재생 + 시드 성공, pgTAP Files=45, Tests=690, PASS**(보고 수치와 같음). 끝나고 스택 제거. 추가 재현은 rollback 트랜잭션 안에서 실행.

## 판정: **합치기 가능(조건 없음)**. 높음·중간 0, 낮음 3(문서 2·운영 1)

## 확인

| 항목 | 결과 |
|---|---|
| `admin_set_test_family` | service_role만 실행, definer·`search_path=''`, 사유·처리자 필수(0039 `admin_check_args`), null은 `invalid`, 없는 가족은 `not_found`, 감사 `test_family_mark`(가족 id·값) ✅ |
| families UPDATE 회수 | anon·authenticated·service_role 모두 UPDATE 불가(`is_test` 열 단위도 불가) ✅. service_role 직접 `update families` → `permission denied` ✅ |
| 기존 경로 영향 | families를 쓰거나 잠그는 함수는 `account_delete_core`·`admin_set_test_family`·`set_parent_title`·`set_parent_title_for`뿐이고 **전부 postgres 소유 definer**다. invoker 함수 중 families를 update하거나 `for update`로 잠그는 것은 **0건**(pg_proc 전수). 재현: 앱 `set_parent_title` → `{ok:true}`, 관리자 삭제(families 행 잠금 포함) → `scope family` ✅. FK `created_by on delete set null`은 RI가 소유자 권한으로 실행하므로 영향 없음 |
| 운영 절차 영향 | `supabase/ops`·`scripts`·Edge·앱 어디에도 families REST PATCH 없음(grep). 심사 가족 생성·번호 설정도 definer RPC다. Studio(postgres)는 영향 없음. 영향 없음 ✅ |
| Q-L1 처리자 | `coalesce(nullif(current_setting('role'),'none'), session_user)` → service_role 갱신 시 `service_role`, Studio 갱신 시 `postgres`로 남는 것 재현 ✅. 이 값은 역할 위장이 불가능하다(`role` 설정은 멤버십이 필요) |
| 지표 SQL | ①~⑤·⑦ 모두 `is_review or is_test` 제외. ⑥은 집계 숫자라 뺄 수 없다고 명시. ⑧은 해당 없음 ✅ |
| mark-test-family.mjs | 대상 호스트를 ref와 먼저 대조한 뒤에야 조회한다. 출력은 가족 id 끝 4자리뿐이다. 메일·user id·키는 출력하지 않는다. 실패 출력은 RPC 응답 120자(reason만) ✅ |
| SV-17 대장(§16) | 파일·main 대조: main에 0044까지 있고 0045는 브랜치뿐이다 → 표와 일치 ✅. staging 열은 원격 확인이 불가해 DECISIONS 11-18 기록(0018~0030 반영)과만 맞춤 |

## 낮음

| # | 위치 | 내용 | 권장 |
|---|---|---|---|
| T-L1 | dev-server-notes §17 "admin L6" | "06시 점검에 `max_cursor`도 함께 봄(§14)"이라 적혀 있지만, §14-3에는 `remaining_new_days < 7`만 있고 `max_cursor` 언급이 없다 → 처리표와 본문이 어긋남 | §14-3에 "`max_cursor`가 마지막 day_index에 가까우면 한 바퀴 직전" 한 줄 추가 |
| T-L2 | §17 처리표 범위 | 이 문서 1부 L5(삭제된 어르신 `notification_queue.payload.parent_id`·`redeem_attempts.uid` 30일 잔존)는 "admin L5"로 기록돼 있어 맞다. 2부 C-L6·C-L7과 재검토 3 K-L3은 반영 완료인데 표에 없다(표가 "보류·기록"만 다룬다면 머리말에 그 기준을 한 줄 적기) | 머리말에 "반영 완료 항목은 각 마이그레이션 머리말 참고" 한 줄 |
| T-L3 | mark-test-family.mjs:4·13 | 테스터 메일을 명령줄 인자로 받으므로 셸 history에 남는다. 출력은 가려도 입력 흔적은 남는다 | `--family` 우선 안내, 또는 메일은 프롬프트(표시 안 함)로 받기. history 지우기 안내도 가능 |

## 참고(조치 불필요)
- `authenticated`는 families에 INSERT·DELETE 표 권한이 남아 있지만, 쓰기 RLS 정책이 없어(`families_read`만 있음) 실제로는 막힌다. 0045 이전부터 그랬다. 방어를 겹으로 하려면 다음 정리 때 함께 회수하면 된다.
- `content_runway`는 테스터 가족을 빼지 않는다. 테스터도 실제로 콘텐츠를 소비하므로 재고 판단에는 맞다.
