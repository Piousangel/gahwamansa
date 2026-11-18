# 2026-11-18 독립 보안 리뷰 — 푸시 토큰(0032)·일일 푸시(0033)·L1 스크립트

- 대상: 브랜치 `server-l1-launch` (main 대비) — 3b66181 gen-types, daae20c replay-check, e43057a Auth 체크리스트, **6886871 0032 register/unregister_push_token**, (범위 추가) **da4b9e0 0033 일일 푸시 + Edge Function push-daily**
- 기준: docs/plans/13-road-to-launch.md(SV-01·SV-02·§3.5), docs/team/dev-server-notes.md, DECISIONS.md(11-17 "한 기기 한 역할", 284 푸시 08~21시·문구 금지·끄기 토글, 348 자녀 알림 범위, D-07 09시), docs/team/legal/compliance-checklist.md #1·#10, 마이그레이션 0001~0031
- 검토자: 독립 보안 리뷰어(작성자 아님). 관점: 놓침·부족·과함. 코드 수정 없음.

## 실행한 검증
- 공유 DB(54322)는 건드리지 않음. `git archive`로 커밋 스냅숏을 뽑아 별도 임시 스택(project_id `bumo-jasik-sec-review`, db 56322)에서 실행 후 `supabase stop --no-backup`으로 삭제.
  - 6886871 기준: 마이그레이션 0001~0032 재생 + `supabase test db` → **Files=30, Tests=464, Result: PASS** (push_tokens·security_hardening 포함)
  - da4b9e0 기준: 0033 `migration up` 추가 적용 + `test db` → **Files=31, Tests=488, Result: PASS**
  - `node --test supabase/functions/push-daily/lib.test.mts` → **9/9 pass**
- 직접 탐침(psql, 롤백 트랜잭션): 권한 표, 토큰 가로채기, no_profile 등록, TRUNCATE, 발송 창 경계(07:59:59 false / 08:00 true / 20:59:59 true / 21:00 false — 정상).
- 타입체크(tsc)·앱 테스트는 이번 범위(서버 SQL·스크립트·Edge Function) 밖이라 돌리지 않음. Edge Function을 Deno로 실제 서빙하지는 않음(lib 단위 테스트만).

## 판정
- **높음 0 / 중간 6 / 낮음 9** → §3.5 기준 **병합 가능(조건부)**. 중간 M1·M2·M3은 SV-02 실발송(staging 실기기) 전에, M4~M6은 출시 관문(G-INT) 전에 처리 권장.

---

## A. 0032 푸시 토큰 등록·해제

### 중간

**M1. authenticated에 `TRUNCATE`(+REFERENCES·TRIGGER)가 남아 있어 "직접 쓰기 회수"가 불완전 — device_tokens 포함 public 테이블 11개**
- 위치: `supabase/migrations/20261116000032_push_tokens.sql:16` (`revoke insert, update, delete` 만), 근본은 0002(`revoke all ... from anon`만, authenticated는 Supabase 기본 권한 ALL 유지)
- 재현(임시 스택): `information_schema.role_table_grants` → authenticated: `REFERENCES,SELECT,TRIGGER,TRUNCATE`. `set local role authenticated; truncate public.device_tokens;` → 성공(0행). 같은 방식으로 answers·cheers·daily_sessions·invite_codes·redeem_attempts·entitlements, `content_questions, content_photos cascade` 모두 성공. TRUNCATE는 RLS를 타지 않는다.
- 영향: PostgREST·pg_graphql은 TRUNCATE를 노출하지 않아 **현재 앱 API로는 실행 경로가 없음**(그래서 높음 아님). 다만 authenticated로 SQL을 실행하는 경로(향후 함수·확장·security invoker 동적 SQL 등)가 하나라도 생기면 전 사용자 데이터가 지워진다. 0032 주석·테스트("테이블 직접 쓰기 불가")는 insert·delete만 확인해 이 구멍을 놓친다.
- 권장: 0035(SV-05 보안 후속)에서 `revoke truncate, references, trigger on all tables in schema public from authenticated, anon;` + `alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated, anon;`. pgTAP에 `has_table_privilege('authenticated', t, 'truncate') = false`를 전 테이블 루프로 추가. 0032 테스트에 `throws_ok('truncate public.device_tokens', '42501')`.

**M2. 연결 전 계정(no_profile)이 같은 토큰을 등록하면 이전 계정 행이 남아 오배달**
- 위치: `20261116000032_push_tokens.sql:33-36` — `no_profile` 반환이 `delete ... where token = p_token and user_id <> v_uid` **앞**에 있다.
- 재현(임시 스택): 자녀 c2가 토큰 T 등록 → 같은 기기에서(로그아웃 시 unregister 실패·누락 가정) 새 익명/미연결 계정 e1이 T 등록 → `{"ok":false,"reason":"no_profile"}`, `device_tokens`에는 c2 행 그대로. c2 가족의 응원 도착·연결 알림이 이제 다른 사람이 쓰는 기기로 간다.
- 영향: DECISIONS 11-17 "한 기기 한 역할, 오배달 방지" 의도를 로그아웃 시 앱의 unregister 성공에만 의존. 오프라인 로그아웃·앱 삭제 후 재설치(같은 토큰 유지되는 경우)·탈퇴 외 경로에서 깨진다. 알림 본문은 고정 문구·`data.kind`뿐이라 정보 노출은 작지만, "자녀 응원이 왔어요"류가 남의 기기에 뜨는 것 자체가 신뢰 문제.
- 권장: no_profile이어도 "이 토큰의 다른 계정 행 삭제"는 수행하고(기기 소유 주장), 삽입만 생략. 테스트 추가: "미연결 계정이 같은 토큰을 등록하면 이전 계정 행은 지워지고 새 행은 생기지 않는다". 앱(AU-04)은 `sb.auth.signOut` **전에** unregister 호출(이후엔 auth.uid가 없어 실패).

### 낮음

**L1. 토큰을 아는 공격자의 가로채기(사용자 질문 ②) — 가능하지만 전제가 어렵다**
- 재현(임시 스택): 피해자 c1이 T 등록 → 다른 가족의 자녀 c2가 `register_push_token(T)` → c1 행 삭제, T는 c2 소유. 공격자 측 전제는 "가족에 연결된 계정"뿐이고 자녀는 스스로 가족을 만들 수 있어 쉽다.
- 결과: (a) 피해자는 알림을 못 받음(피해자 앱이 다음 시작 때 재등록하면 회복 — 핑퐁 가능), (b) 공격자 가족의 알림이 피해자 기기에 뜸(문구 고정·닫힌 목록이라 피싱 여지 작음), (c) **피해자 알림을 공격자가 받지는 못함**(FCM은 토큰=기기로 배달). `unregister_push_token`은 본인 행만 지워 남의 행 삭제 불가(테스트 확인).
- 전제: 피해자 FCM 토큰은 tokens_read(본인만)로 막혀 있고 다른 노출 경로 없음(로그·이벤트 속성에도 없음). 표준 FCM "마지막 등록자 우선" 관행과 같다. → 수용 가능.
- 권장: (선택) 사용자당 호출 빈도 제한(예: 분당 10회)으로 대량 토큰 순회 차단, Edge Function·로그에 토큰을 남기지 않는 규칙 유지(0033은 지킴).

**L2. 같은 토큰의 동시 등록 경합 → 토큰 중복 소유 가능(사용자 질문 ③)**
- 위치: `:37-40`. 토큰 단독 유일 제약이 없고(`device_tokens_token_idx`는 일반 인덱스), "다른 계정 행 삭제 → 삽입"이 READ COMMITTED에서 원자적이지 않다. A·B가 동시에 같은 토큰을 등록하면 서로의 미커밋 행을 못 봐 둘 다 남는다.
- 같은 사용자 동시 등록 시 5개 제한도 각자 스냅숏으로 정리해 일시적으로 6개 이상 남을 수 있음(다음 등록 때 정리, 무해).
- 실제로는 한 기기에 세션 하나라 정상 사용에선 거의 안 생김.
- 권장: `create unique index on device_tokens(token)` 로 바꾸고 `insert ... on conflict (token) do update set user_id = v_uid, platform = ..., updated_at = now()` 한 문장으로. 5개 정리는 `pg_advisory_xact_lock(hashtext(v_uid::text))` 뒤에.

**L3. 오래된 토큰 파기 기준 없음**
- `purge_expired_data`(0023/0033)는 device_tokens를 보지 않는다. 앱 삭제 후 발송이 없거나(알림 끔) FCM 오류가 안 나는 경우 토큰이 무기한 남는다. 처리방침 v2는 FCM 토큰을 자동 수집 장치로 적는다(compliance #1).
- 권장: `updated_at < now() - 270 days`(FCM 비활성 만료 기준) 삭제를 파기 배치에 추가, 방침의 보관 기간 문구와 맞추기.

**L4. pgTAP 0032 빈틈**
- `push_tokens.test.sql:62` "남의 토큰은 해제되지 않는다"가 `removed=0`만 보고 자녀 행이 남았는지 확인하지 않음.
- 없음: 길이 상한(4096/4097)·null 토큰·`ios`·null 플랫폼, 함수 `prosecdef`·`search_path` 고정 확인, 가족 삭제(마지막 자녀) 경로의 토큰 정리(헤더 주석은 "계정·가족 삭제"라 적음 — rpc_delete.test가 일부 보완), no_profile 동작(M2), TRUNCATE 거부(M1), 다른 사용자 행 읽기 불가(0032 파일 안에서는 단일 사용자라 증명 안 됨; security_hardening.test가 보완).

**L5. 다운 파일 권한 복원이 원상과 다름**: `down/..0032:5` 는 insert·update·delete만 다시 준다(원래는 기본 ALL). 되돌림 용도로는 문제없음, 기록만.

### 확인됨(문제 없음)
- 두 RPC `SECURITY DEFINER` + `search_path=''`, 모든 객체 스키마 한정(`public.`, `auth.uid()`), anon·PUBLIC 실행 회수(테스트 17·18).
- 입력 검증: 20~4096자 + `^[A-Za-z0-9_:-]+$`(FCM·APNs hex 모두 통과, 공백·따옴표 거부). 플랫폼 android·ios + 테이블 CHECK 추가. `{m,n}` 반복 상한 255 때문에 길이를 따로 검사한 판단 맞음.
- 0031 정합: tokens_own 삭제 → tokens_read(select, `(select auth.uid())` initplan 형태 유지), security_hardening 테스트 갱신 정확.
- 정리 경로: delete_my_account(0026, 본인 / 마지막 자녀 시 가족 전원), discard_anonymous_session(0017), admin_cleanup_review_family(0025), auth.users ON DELETE CASCADE, 0033 무효 토큰 삭제. 동의 철회(withdraw_consent)는 토큰을 남기지만 0033 대상 선정이 `consented_at is not null`로 거름.
- 로그아웃 해제(⑤): 서버 RPC는 준비됨, 앱은 아직 호출 없음(AU-04 범위). M2 권장 순서 참고.

---

## B. 0033 일일 푸시 + Edge Function push-daily

### 중간

**M3. FCM 404·INVALID_ARGUMENT를 모두 "무효 토큰"으로 분류 → 설정 실수 한 번에 전체 토큰 삭제**
- 위치: `supabase/functions/push-daily/lib.mts:30-31`, 삭제는 `20261116000033_push_daily.sql:108-110`
- 재현(논리): FCM v1은 메시지 필드 오류(제목·채널·데이터 형식 등)에도 `400 INVALID_ARGUMENT`를, 잘못된 project_id URL에는 `404 NOT_FOUND`를 준다. 서비스 계정 JSON의 project_id 오기·문구 형식 문제 하나로 모든 대상 결과가 `invalid_token` → `push_record`가 모든 토큰 삭제 → 사용자가 앱을 다시 열 때까지 전원 알림 끊김.
- 권장: `invalid_token`은 `details[].errorCode == 'UNREGISTERED'`(404) 또는 `INVALID_ARGUMENT` 중 `fieldViolations.field == 'message.token'`일 때만. 그 외는 failed. 추가로 한 실행에서 invalid 비율이 임계(예: 50%) 넘으면 삭제를 보류하고 오류로 기록. 단위 테스트에 "프로젝트 404는 failed" 사례.

**M4. 같은 날 중복 발송 경합 — 대상 선정과 기록 사이에 선점(claim)이 없음**
- 위치: `push_daily_targets` 중복 방지(`:71-72`)가 **발송 뒤** `push_record`가 남긴 `sent` 행에만 의존. `lib.mts:118-133`
- 시나리오: cron 실행 중 운영자가 수동 재실행·pg_net 타임아웃(60s) 뒤 재호출·Edge 동시 실행 → 두 실행이 같은 대상 목록을 받아 같은 어르신께 같은 알림 2번. 발송 후 `push_record` RPC가 실패하면 기록이 없어 다음 실행이 다시 보낸다. 대상이 많아 Edge 실행 시간 한도에 걸리면 일부 발송 후 기록 없이 끝남.
- 권장: 대상 선정 시 `push_log`에 `pending` 행을 넣고 `unique (kind, sent_on, profile_id)`로 선점(= `insert ... on conflict do nothing returning`), 결과로 상태 갱신. 또는 최소한 `pg_try_advisory_xact_lock`/`push_runs` 실행 잠금 행. 결과 기록은 배치(예: 500건)마다.

**M5. 법률 빌드 1 규칙 ④ "N1 동의 시각 저장" 미구현**
- 근거: `docs/team/legal/compliance-checklist.md` #10 빌드1 규칙 ①~④. ①창(08:00~20:59) ✓, ②문구 금지는 `push_copy` 승인 전 null로 미발송 ✓, ③끄기 토글 `set_push_enabled` ✓, **④ 없음**. `device_tokens.updated_at`은 재등록마다 덮어써 최초 동의 시각이 남지 않고, `push_permission_result` 이벤트는 14개월 뒤 파기·익명 집계용이다.
- 권장: `profiles.push_opt_in_at`(최초 허용 시각, 끄기·켜기 이력은 `set_push_enabled` 때 갱신) 또는 consent_events와 같은 형태의 이력 표. 담당(SV-01/02 vs 법률) 리드가 정해 DECISIONS에 기록.

**M6. 일일 알림 대상 판단이 "알림 켬" 기본 true + 토큰 존재만 — OS 권한 허용 ≠ 알림 수신 의사 기록**
- 위치: `0033:15`(`push_enabled default true`), `:67`
- M5와 같은 뿌리. 토큰 등록(OS 권한 허용)을 수신 동의로 갈음하는 현재 설계가 KISA "알림 권한 허용≠광고 동의" 지적과 충돌할 여지(정보성 가정이 깨질 때). 빌드 1 가정(정보성)은 체크리스트에 명시돼 있어 중간으로 둠.
- 권장: N1 화면에서 "받기"를 누른 시각을 서버에 남기고(M5), 그 값이 있는 사람만 대상으로. 변호사 질의(questions-for-lawyer)에 한 줄 추가.

### 낮음

**L6. `safeEqual`이 길이 차이를 즉시 드러냄**: `lib.mts:36-41`. 길이만 새고 내용은 상수 시간. 비밀값이 충분히 길면(32바이트 이상 무작위) 실질 위험 없음. 권장: 양쪽을 SHA-256 해시 후 비교(길이 고정) 또는 `crypto.subtle.timingSafeEqual`(Deno std). 비밀값 최소 길이를 운영 문서에 명시.

**L7. 함수 URL 공개 + `verify_jwt=false` 남용**: 비밀 없이 부르면 403(빈 PUSH_CRON_SECRET이면 항상 403 — 안전). 비밀이 새면 아무 때나 실행 가능하지만 발송 창·당일 sent 중복 방지가 있어 하루 추가 발송은 `failed` 대상 재시도뿐(M4 경합 제외). 반복 호출로 FCM·DB 비용 유발 가능 → 권장: 같은 날 실행 횟수 상한(push_runs 기준) 또는 M4 실행 잠금.

**L8. `FCM_SERVICE_ACCOUNT` JSON 파싱 오류 메시지가 로그로 감**: `index.ts:26,40`. V8의 `JSON.parse` 오류 문구는 입력 일부를 담는다(실측: `Unexpected token 'p', "private_ke"... is not valid JSON`). 개인키 조각 몇 글자가 함수 로그에 남을 수 있음. 권장: 파싱을 try로 감싸 `service_account_invalid`만 로그.

**L9. 권한 표기·기타**
- `0033:48` `grant select ... to service_role`이라 적었지만 service_role은 기본 권한으로 insert·delete도 가짐(실측 push_log insert = t). 의도 표기만 맞추면 됨(서비스 역할은 RLS 우회 전권이 정상).
- `set_push_enabled(null)`이 "켬"이 됨(`:127`) — 앱 실수로 null을 보내면 끈 알림이 다시 켜진다. null은 `invalid` 반환 권장.
- `push_record`가 결과의 token-프로필 대응을 검증하지 않고 token만으로 삭제 — 서비스 역할 전용이라 수용.

### 확인됨(문제 없음)
- 대상 선정: 어르신만, `consented_at is not null`(철회 즉시 제외), `push_enabled`, `not f.is_review`, 오늘 완료 제외, 당일 sent 제외. 발송 창 경계 실측 정상(07:59:59 닫힘·08:00 열림·20:59:59 열림·21:00 닫힘), 시간대 `Asia/Seoul` 고정. 자녀 알림 범위(DECISIONS 348)는 SV-03 몫이며 0033은 자녀에게 일일 알림을 보내지 않음.
- `push_daily_targets`·`push_record`·`push_daily_kick`: authenticated·anon 실행 불가(실측), 모두 definer + `search_path=''`. `push_copy`·`push_log`·`push_runs`: authenticated 권한 없음(TRUNCATE 포함 f). `profiles.push_enabled`는 authenticated가 직접 못 읽음(profiles 테이블 select 자체 없음, `my_push_settings`로만).
- Vault: `project_url`·`push_cron_secret`이 없으면 `not_configured`(호출 안 함). 비밀값은 저장소·마이그레이션에 없음.
- FCM 메시지: `notification`(고정 문구) + `data.kind`만, 개인 id·번호 없음. 로그는 요약 숫자·RPC 이름·HTTP 상태만(토큰·profile_id 미출력). 서비스 계정 없으면 dry-run(발송·sent 기록 안 함).
- 파기: push_log 31일, push_runs 13개월, profile 삭제 시 push_log cascade.

---

## C. 스크립트·문서 (3b66181·daae20c·e43057a)

### 낮음
- `scripts/gen-types.sh:26` — `--local`만, 원격 링크·토큰을 쓰지 않음 ✓. 다만 `2>/dev/null`로 CLI 오류를 삼켜 실패 원인이 안 보임(실패 시 빈 파일로 안 덮는 가드는 있음 ✓). 생성물 `database.gen.ts`에 키·비밀 없음(확인).
- `supabase/ops/replay-check.sh` — 원격·비밀 미사용 ✓, `supabase start` 출력(로컬 키)을 `/dev/null`로 버림 ✓, 로그는 저장소 밖 ✓, 종료 시 `stop --no-backup` ✓. 고정 project_id(`bumo-jasik-replay`)라 두 레인이 동시에 돌리면 서로 스택을 지운다 → project_id에 `$$`나 짧은 난수 접미사 권장. config.toml의 `env(...)` 참조는 값이 아닌 이름만 복사됨 ✓.
- dev-server-notes §9(Auth 체크리스트) — 보안상 이견 없음. #15 CAPTCHA OFF는 M1(익명 가입이 곧 authenticated 권한)과 함께 W3 재판단 권장.

---

## 권장 처리 순서
1. SV-02 실발송 전: M3(무효 토큰 분류), M4(선점·잠금), M2(no_profile 삭제 순서) — 각 1~2시간.
2. 0035(SV-05): M1 TRUNCATE·REFERENCES·TRIGGER 회수 + 전 테이블 pgTAP.
3. G-INT 전: M5·M6 동의 시각 저장(법률·리드 결정 후), L3 토큰 파기 기준.
4. 나머지 낮음은 다음 보안 후속 묶음.

---

## D. 0035 보안 후속 (7c9c193, xhigh — 동의 데이터)

### 실행한 검증
- 임시 스택(`bumo-jasik-sec-review`, db 56322)에 7c9c193 스냅숏 0001~0035 재생 + `supabase test db` → **Files=33, Tests=512, Result: PASS** (security_followups 13개, rpc_redeem 갱신분 포함).
- 직접 탐침(롤백 트랜잭션): 기존 `v1` 동의 행(consented_at·consent_version='v1') 어르신이 `give_consent('v2')` → 버전 v2·시각 갱신·consent_events `given v2` 1건(0019와 동일 동작). 함수 시그니처는 `give_consent(p_version text)` 하나만 남음(기본값 없음, 오버로드 없음).
- 앱 확인: `app/src/features/realApi.ts:267`(main 268) `sb.rpc('give_consent', {p_version: version})`, 호출부 `ConsentScreen.tsx:41`·`ParentSettings.tsx`는 `CONSENT_VERSION = 'v2'`(`app/src/copy/copy.ts:21`)를 보냄 → `^v[0-9]{1,3}$` 통과. main·server-l1-launch·다른 앱 브랜치 전부 같음. 통합 테스트(`__integration__/realApi.test.ts:135`, `history.test.ts:34`)도 `'v2'`. 버전 인자 전송은 820714c(11-17)부터.

### 판정: 높음 0 / 중간 1 / 낮음 4 → 병합 가능(중간 D-M1은 staging 반영 전 확인)

### 중간
**D-M1. staging 반영 시 11-17 이전 APK는 동의가 깨진다(확인 필요)**
- `give_consent` drop→create로 무인자 호출이 사라짐(PostgREST는 함수 없음 오류). 820714c(2026-11-17) 이전 realApi는 인자 없이 불렀다. staging(현재 0030까지 반영)에 그 이전 빌드를 설치한 테스터 기기가 있으면 0035 push 뒤 어르신 동의 화면에서 서버 오류로 멈춘다.
- 기존 동의 데이터(profiles.consent_version·consent_events)는 건드리지 않음 — 데이터 호환 문제는 없음(탐침 확인).
- 권장: staging push 전에 배포된 테스트 APK가 820714c 이후 빌드인지 리드가 확인(아니면 재설치 공지). 출시 전이라 production 영향 없음.

### 낮음
- **D-L1. 가족 기본 호칭의 `duplicate_title`이 앱에서 일반 오류로 보임**: `realApi.ts:321-323`(main 329-331) `setParentTitle`이 모든 실패를 `invalid_title`로 바꾸고 `types.ts:123` 타입도 `invalid_title`뿐. `ChildSettings.tsx:74`가 parentId 없는 편집에서 이 경로를 쓰면 "호칭이 겹쳐요"(`relation.name_taken`) 대신 `errors.server.title`이 뜬다. 앱이 `taken`으로 먼저 막아 다른 기기 동시 변경 때만 생김. 권장: realApi에서 `duplicate_title` 통과 + 타입 확장(앱 줄), 또는 폐기 예정이므로 ChildSettings가 항상 `_for`를 쓰게. `RelationScreen`(연결 전)은 어르신이 없어 겹침 불가 — 영향 없음.
- **D-L2. 0035 권한 회수가 content 두 표의 insert·update·delete·truncate만**: REFERENCES·TRIGGER는 남고(실측 t), 앞 절 **M1(device_tokens·answers 등 나머지 public 표 TRUNCATE, 실측 여전히 t)은 미해결**. 권장: M1 권장안(전 테이블 + default privileges 회수, pgTAP 루프)으로 확장.
- **D-L3. `parent_titles()`는 anon도 실행 가능**(실측 t, 함수 기본 PUBLIC 실행 권한). 상수라 정보 노출 없음. 0031 원칙(anon 실행 불가) 일관성만 — `revoke execute ... from public, anon` 한 줄.
- **D-L4. 테스트 품질**: 버킷 감시는 설정값만 보고 storage.objects 정책 0개(앱 업로드 불가)는 확인하지 않음 — 정책이 생기면 "개인 사진 금지" 원칙이 깨져도 테스트는 통과. `has_table_privilege` 단언에 references·trigger 미포함. `set_parent_title` 겹침 테스트가 "호칭 있는 어르신만 있을 때(겹침 아님)" 경우를 안 다룸. 다운 파일 `:8`이 truncate까지 다시 부여(원상 복구로는 맞음).

### 확인됨(문제 없음)
- give_consent 본문은 0019와 동일(역할 검사·형식 검사·`for update`·같은 버전 멱등·이력 기록), 기본값만 제거. 권한 재부여(anon 거부 테스트) ✓, `search_path=''` ✓.
- set_parent_title 겹침 판정: "호칭 없는 어르신이 있고 다른 어르신이 이미 그 호칭"일 때만 거부 — 기본 호칭이 실제로 보이는 경우와 일치. 가족 행 `for update`로 `_for`와 같은 줄 세우기 ✓. set_parent_title_for 동작은 0028과 동일(목록만 함수로).
- parent_titles()와 check 제약 대조 테스트 ✓(profiles.parent_title 제약도 같은 목록이나 테스트는 families 제약만 대조 — 참고).

---

## 재검토 — 0036 푸시 리뷰 반영 (ebd2537)

### 실행한 검증
- 임시 스택(`bumo-jasik-sec-review`)에 ebd2537 스냅숏 **0001→0036 재생** + `supabase test db` → **Files=34, Tests=538, Result: PASS**(push_hardening 신규 포함). `node --test lib.test.mts` → **11/11 pass**. 스택은 끝나고 삭제.
- 직접 탐침(롤백): ① public 전 표에서 authenticated·anon의 TRUNCATE·REFERENCES·TRIGGER **0건** ② `push_daily_claim` 연속 2회 → 대상 1 → **0**(같은 날 중복 없음) ③ 미연결 익명 계정이 어르신 토큰을 등록 → `no_profile` 반환 + 어르신 행 삭제(M2 의도대로) ④ push_claims·push_daily_claim·push_daily_eligible은 authenticated 권한 없음 ⑤ `classifyFcmError` 실호출: UNREGISTERED(404) → invalid_token, **SENDER_ID_MISMATCH(403) → config_error**, 필드 없는 INVALID_ARGUMENT → config_error.

### 지적별 상태
| 지적 | 상태 | 근거 |
|---|---|---|
| M1 TRUNCATE 등 | **해소** | `0036:15-16` 전 표 회수 + postgres 기본 권한 회수, 탐침 0건 |
| M2 no_profile 오배달 | **해소** | `0036:38-42` 삭제를 no_profile 검사 앞으로, 탐침 확인. 로그아웃 순서 계약 노트 반영 |
| M3 대량 토큰 삭제 | **해소(삭제 쪽)** — 단 새 R-M1 참고 | lib `classifyFcmError` UNREGISTERED·message.token만 삭제, `push_record` 대량 무효 보류(`0036:193`) |
| M4 같은 날 중복 | **해소** | `push_claims` PK 선점 + live 실행은 `push_daily_claim`만 사용, 탐침 확인. 실패 시 그날 재시도 안 함(설계 선택, 수용) |
| M5·M6 동의 시각 | **해소** | `profiles.push_consented_at` + 대상 조건, 계약 노트 120행(N1에서 `set_push_enabled(true)` 필수) |
| L2 토큰 유일·경합 | 해소 | 유일 인덱스 + `on conflict (token)`, 5개 정리는 사용자 잠금 뒤 |
| L3 파기 | 해소 | 270일 토큰·선점 31일 |
| L6 비교 | 해소 | SHA-256 후 비교 |
| L8 로그 | 해소 | 파싱 오류 원문 미기록, 오류 메시지 정규화 |
| L9 null | 해소 | `invalid` |
| D-L2(0035 권한 범위) | 해소 | M1과 함께 |
| D-L1 앱 duplicate_title 매핑 · D-L3 parent_titles anon(탐침 여전히 t) · D-M1 staging 이전 APK | **미해결(앱 줄·리드 확인 몫)** | 서버 0036 범위 밖 |

### 새로 생긴 지적

**R-M1(중간). 한 토큰의 SENDER_ID_MISMATCH·필드 없는 INVALID_ARGUMENT가 그날 실행 전체를 중단 → 가입만 하면 누구나 일일 알림을 막을 수 있다**
- 위치: `supabase/functions/push-daily/lib.mts:43-44`(SENDER_ID_MISMATCH·INVALID_ARGUMENT·400 → config_error), `:115`(첫 config_error에서 `aborted=true`로 나머지 중단), 선점분은 failed로 기록돼 그날 재시도 없음(`0036:201-205`).
- 재현(논리): 자녀로 가입해 가족을 만들고(전제 낮음) **다른 Firebase 프로젝트의 정상 FCM 토큰**(자기 앱 아무거나에서 얻음, 정규식 통과)을 `register_push_token`으로 등록 → 매일 09시 그 토큰 발송이 403 SENDER_ID_MISMATCH → 실행 중단 → 아직 안 보낸 어르신 전원이 그날 알림을 못 받음. 대상 순서가 profile_id 정렬이라 매일 같은 위치에서 끊긴다. 공격이 아니어도 staging/production flavor 혼동 빌드 한 대로 같은 일이 생긴다.
- FCM 문서상 SENDER_ID_MISMATCH는 "그 토큰의 발신자가 다르다"는 **토큰 단위** 오류다.
- 권장: SENDER_ID_MISMATCH → invalid_token(삭제). 필드 없는 INVALID_ARGUMENT·400은 그 토큰만 failed. 실행 중단은 토큰과 무관한 오류(401, 403 PERMISSION_DENIED 중 SENDER_ID_MISMATCH 아님, UNREGISTERED 없는 404)가 **서로 다른 토큰 3개 이상**에서 날 때만. 단위 테스트에 "SENDER_ID_MISMATCH 한 건은 나머지 발송을 막지 않는다" 추가.

**R-L1(낮음). 토큰 삭제 전제가 더 낮아짐**: M2 반영으로 가족 연결 없는 익명 계정(앱 설치 직후 누구나)도 남의 토큰을 알면 그 행을 지울 수 있다(탐침 ③). 토큰 비공개가 유지되는 한 수용. 익명 가입 한도(Auth 체크리스트 #2)가 완충.

**R-L2(낮음). `set_push_enabled(true)`가 호출마다 `push_consented_at`을 now()로 덮어씀**: 최초 동의 시각이 아니라 "마지막으로 켠 시각"이 남는다. 증빙으로는 충분하다고 보지만 법률 체크리스트 #10 ④ 표현("N1 동의 시각")과 맞는지 법률 줄 확인 한 줄. 앱이 앱 시작 때마다 true를 부르지 않게 AU-04에 명시 권장.

### 재검토 판정
- **0036: 높음 0 / 중간 1(R-M1) / 낮음 2** → 원 지적 M1~M6 모두 해소. **합치기 가능(조건)**: R-M1은 실제 발송을 켜기 전(US-10 Firebase secrets 등록·staging 실기기 발송)에 고칠 것. 지금은 `push_copy`가 비어 있어 발송이 일어나지 않으므로 병합 자체는 막지 않는다.
- **0035: 높음 0 / 중간 1(D-M1, 리드 확인) / 낮음 4(D-L2 해소, D-L1·D-L3·D-L4 남음)** → 합치기 가능, staging push 전에 테스터 APK가 820714c 이후 빌드인지 확인.
