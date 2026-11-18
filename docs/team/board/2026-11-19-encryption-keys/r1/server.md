# r1 서버 엔지니어 — 테이블·컬럼 전수와 암호화 비용 (2026-11-19)

> 독립 의견. 0001~0045를 직접 읽어 뽑은 목록. 보관 기간은 0042 `purge_expired_data` 최신 정의 기준.

## 1. 개인정보가 닿는 표 (콘텐츠·문구 표 제외)
| 표 | 개인정보 성격 컬럼 | 클라이언트 접근 | 보관 |
|---|---|---|---|
| auth.users / auth.identities (Supabase 관리) | 이메일, 구글 이름·사진 주소·sub, 카카오 회원번호(provider_id)·닉네임(선택), 심사 계정 비밀번호 해시 | 본인 세션만(GoTrue) | 계정 삭제 시 |
| auth.sessions·refresh_tokens·one_time_tokens·audit_log_entries (관리) | 세션, 인증번호 처리값, 로그인 감사(IP·메일이 들어갈 수 있음) | 없음 | **우리 파기 배치 밖** — audit_log_entries 쌓임 여부 미확인 |
| profiles | user_id, role, display_name(≤20, **쓰는 곳 0**), consented_at·version, parent_title, push_enabled·push_consented_at, content_seq | 컬럼 grant(id·user_id·family_id·role·display_name·created_at·parent_title) | 계정 삭제 |
| families | created_by, parent_title(닫힌 목록), is_review, is_test | RLS | 가족 삭제 |
| invite_codes | code(6자리), created_by, used_by, target_profile_id | RPC만 | 30일 |
| redeem_attempts | uid, ok, at | 없음 | 30일 |
| answers | choice(A/B), session_date | 본인(어르신)만, 자녀는 child_summary RPC | 31일째 |
| daily_sessions | 날짜·단계·시간·콘텐츠 id | 본인만 | 31일째 |
| cheers | from_child, to_parent, message_key(4개 고정) | 받는 어르신만 | 31일 |
| consent_events | 동의·철회·버전·시각 | 없음 | 계정 삭제 cascade |
| device_tokens | user_id, token(FCM), platform | 본인 select만, 쓰기 RPC | 270일 미갱신·5개 상한 |
| push_log / push_claims / push_runs | profile_id·종류·결과(토큰 없음) / 숫자 | 없음 | 31일 / 31일 / 13개월 |
| notification_queue | family_id, payload {parent_id, reconnect} | 없음 | 30일 |
| events | family_id, profile_id, device_key=sha256(uid), actor_role, name, props(화이트리스트) | 쓰기만(log_event) | 14개월 |
| admin_audit | operator, target_profile·family(uuid, FK 없음), reason(1~200자 자유), detail | 없음 | 1년(삭제 후에도) |
| kakao_unlink_queue | kakao_user_id(평문) | 없음, service_role도 쓰기 회수(0044) | 성공 즉시, 최대 30일 |
| entitlements | family_id, plan, source | RLS | 가족 삭제 |
| vault.secrets | project_url, push_cron_secret | (확인 필요: anon·authenticated 권한 0이어야) | — |

## 2. 컬럼 암호화를 넣으면 생기는 일
- **pgcrypto(이미 설치, extensions 스키마) + Vault 키**: `pgp_sym_encrypt(text, key)`는 비결정적 → 같은 값 비교·인덱스 불가. 비교가 필요하면 `hmac(value, key2, 'sha256')` 열을 따로 두고 거기에 인덱스(블라인드 인덱스). 키 두 개(암호·HMAC)를 Vault에 둬야 한다.
- 카카오 큐에 적용 시: 0044 `kakao_unlink_claim`의 재가입 확인(`i.provider_id = q.kakao_user_id`)을 HMAC 비교로 바꾸고, claim이 복호화해서 Edge에 넘겨야 함. 함수 3개(account_delete_core 삽입부·claim·record) 재정의 + pgTAP. 2.5~4h(가정).
- 성능: 우리 규모(큐 수십 행/일, 이벤트 수천 행/일 가정)에서는 무시 가능. 문제는 성능이 아니라 **복잡도·장애 복구**(키 없으면 큐 처리 불가, 로컬·CI에도 키 필요).
- `event_device_key`를 HMAC으로 바꾸면 Vault를 읽어야 해 `immutable` → `stable`로 바꿔야 함. 값은 저장 열이라 인덱스 영향 없음. 키를 교체하면 그날 이후 기기 연결이 끊긴다(14개월 퍼널 분석 단절) → 사실상 교체 불가 키가 된다.
- pgsodium 투명 컬럼 암호화(TCE)는 Supabase가 비권장·폐기 예정으로 명시. 쓰지 않는다.
- **앱·Edge 단 암호화**(DB는 암호문만 보관)는 우리 로직 대부분이 SQL definer 함수라 맞지 않는다. 미래에 정말 민감한 값(예: 실명·전화번호)이 생기면 그 값만 Edge에서 암호화하는 경로가 맞다.

## 3. 내 권고
1. 기존 컬럼에는 컬럼 암호화를 넣지 않는다. 플랫폼 저장 암호화 + RLS·grant + 짧은 보관으로 충분(법정 의무 대상 없음 전제).
2. 대신 **0046(번호 리드 배정)** 으로 작은 정리:
   - `profiles.display_name` 제거(쓰는 곳 0, 가족 읽기 열려 있음 — 저장 안 함 원칙).
   - `admin_check_args`에 reason·operator의 `@` 포함, 9자리 이상 숫자열 거부(메일·전화번호 입력 차단). 테스트 가족 정리 사유("staging 테스트 가족 정리(개발자 메뉴)")·콘텐츠 게시 사유는 통과해야 함.
   - pgTAP: anon·authenticated가 vault 스키마 표·뷰에 권한 0, vault를 읽는 definer 함수(push_daily_kick·push_kick·push_events_kick·kakao_unlink_kick·admin_publish_content 계열)의 anon·authenticated 실행 권한 0.
   - 추정 2~3h.
3. Edge Function 3개가 `SUPABASE_SERVICE_ROLE_KEY`(legacy JWT)를 읽는다. 런타임은 새 키를 `SUPABASE_SECRET_KEYS`(이름별 JSON)로도 넣어 준다(공식 문서). production을 새 키로 시작하려면 빌드 1에서 읽는 쪽을 바꿔야 함: 1.5~2.5h + staging 확인. `@supabase/server` SDK 권장은 의존성 추가라 이번엔 env 읽기만 바꾸자.
4. `remote-checks.sql`에 확인 줄: vault 권한, `auth.audit_log_entries` 최근 30일 건수(쌓이면 보관 결정 필요), pg_net 큐 표 권한. SSL 강제 여부는 대시보드라 체크리스트로.

## 내가 틀릴 수 있는 이유
- auth 스키마 내부 표의 정확한 저장 형태(refresh token 평문 여부, OTP 해시 여부)는 GoTrue 버전마다 다르고 직접 확인하지 않았다.
- legacy 키 폐기 "2026년 말"이 실제로 언제 호출을 끊는지 문서에 날짜가 없다. 서두르는 판단이 과할 수 있으나, 늦으면 운영 중 장애라 비대칭이 크다.
