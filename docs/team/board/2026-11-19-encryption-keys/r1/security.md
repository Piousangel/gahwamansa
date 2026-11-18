# r1 보안 엔지니어 — 저장 암호화·키 관리 (2026-11-19)

> 독립 의견(다른 위원 r1을 보지 않음). 근거는 main 마이그레이션 0001~0045, Edge Function 3개, app/src, dev-server-notes, 공식 문서(출처는 SUMMARY §6).

## 1. 위협 모델 (우리 규모·구조 기준)
| # | 위협 | 지금 막는 것 | 남는 구멍 |
|---|---|---|---|
| T1 | Supabase 디스크·백업 매체 탈취 | 플랫폼 AES-256 저장 암호화(공식: security 페이지·DPA) | 없음(플랫폼 몫) |
| T2 | 앱 사용자가 남의 데이터 조회 | RLS, 컬럼 단위 grant, definer RPC, pgTAP | display_name(자유 문자열)이 가족에게 읽기 허용 상태(0014 grant) — 쓰는 곳 0이라 비어 있지만 열려 있음 |
| T3 | 서비스 키 유출(운영자 맥·셸 기록·문서 붙여넣기) | 비밀번호 관리자 규칙, 앱 번들 grep(A9) | **문서 §18 B-7·B-8이 키를 명령줄에 직접 넣는 형태**(`SUPABASE_SERVICE_ROLE_KEY=<…> node …`, `curl -H "x-cron-secret: <값>"`) → zsh 기록에 평문으로 남는다 |
| T4 | SQL Editor로 만든 Vault 값이 쿼리 기록에 남음 | "붙여 넣고 바로 지우기" 규칙 | Studio가 쿼리 기록·스니펫을 보관하는지 미확인 → 대시보드 Vault 화면으로 입력하는 편이 안전 |
| T5 | 데이터 덤프·CSV 유출(운영자 노트북) | FileVault, "내려받은 자료에 식별값 금지" | 카카오 회원번호·이메일이 든 표를 통째로 내보내면 그대로 평문 |
| T6 | 기기 분실·루팅 | Android 파일 기반 암호화(FBE), 앱 전용 저장소, allowBackup=false | Android 12+ 일부 제조사에서 allowBackup=false여도 **기기 간 이전(D2D)은 막히지 않음**(Android 공식 문서) → 세션 토큰·초대 번호가 새 폰으로 복사될 수 있음 |
| T7 | 환경 섞임(staging 키로 production 접근) | env 파일 분리, db-push ref 대조 | 카카오 앱이 staging·production 공용(1653853) → **어드민 키도 공용**. staging 유출이 production 사용자 연결 끊기 권한으로 이어짐 |

## 2. 컬럼 암호화가 실제로 막는 것
- 키를 같은 DB(Vault)에 두는 pgcrypto 방식은 T1(이미 막힘)·T5(덤프 유출)만 추가로 막는다. postgres·service_role이 털리면(T3) 복호화 함수도 같이 쓸 수 있어 효과가 없다.
- 우리 데이터 중 **법정 암호화 대상(고유식별정보·계좌·카드·바이오·비밀번호)은 없다**(법률 위원 확인 요청). 비밀번호는 심사 계정뿐이고 GoTrue가 bcrypt 일방향 저장(추정, GoTrue 구현 기준).
- 그래서 내 1순위는 컬럼 암호화가 아니라 **T3·T6·T7(키가 새는 경로)**를 막는 것이다.

## 3. 컬럼별 내 판단(상세표는 SUMMARY)
- `kakao_unlink_queue.kakao_user_id`: 개인 식별자이고 탈퇴 뒤에도 최대 30일 남는 유일한 값. 평문 필요(카카오 API 호출) + `auth.identities.provider_id`와 같은 값 비교(0044 재가입 확인). **나는 빌드 1에 암호화(Vault 키 + pgp_sym_encrypt) + HMAC 비교 열을 원한다**. 근거: 탈퇴한 사람의 식별자를 덤프에서라도 지키는 것이 "삭제했다"는 약속과 맞음.
- `events.device_key` = sha256(uid) 솔트 없음. uid가 무작위 UUID라 역산은 불가능하지만, auth.users를 가진 사람은 즉시 연결 가능. 키드 해시(HMAC, Vault 비밀)로 바꾸면 이벤트 표만 유출됐을 때 연결을 막는다. 출시 전이라 지금이 가장 싸다. **빌드 1 제안(약한 주장)**.
- `device_tokens.token`: 발송에 평문 필요. 그대로. 270일 파기 유지.
- `invite_codes.code`: 6자리라 해시는 무의미(100만 경우 즉시 대입). 만료·시도 제한·RLS가 보호 수단. 그대로.
- `admin_audit.reason/operator`: 규칙만 있고 서버 검사가 없다. `@`·긴 숫자열 거부 CHECK를 제안.
- `profiles.display_name`: 쓰는 곳 0, 가족 읽기 허용. **컬럼 제거**.

## 4. 키 관리 제안
1. 비밀값 대장(이름·환경·보관 위치·만든 날·교체 예정일·쓰는 곳)은 비밀번호 관리자 안에만. 저장소에는 **이름 목록만**.
2. 환경마다 모두 다른 값: 서비스(secret) 키, DB 비밀번호, push_cron_secret, FCM 서비스 계정(별도 Firebase 프로젝트), 카카오 어드민 키(**staging 카카오 앱 분리 필요**).
3. Supabase는 legacy `service_role` JWT 키를 2026년 말까지 폐기 예정(공식 api-keys 문서). production은 처음부터 새 secret 키(`sb_secret_…`)로, **구성 요소마다 별도 키**(Edge Function용·운영 스크립트용)를 만들어 하나가 새면 그것만 교체. 이행 뒤 legacy 키 비활성.
4. 교체 주기: 유출·의심 즉시, 사람·기기 변경 시, 그 밖에는 연 1회(staging에서 먼저 리허설).
5. Vault 루트 키: Supabase가 프로젝트마다 관리하며 Management API로 조회 가능(공식 vault 문서) → **조직 Owner 토큰·CLI 로그인 토큰이 곧 복호화 권한**. MFA 필수, 안 쓰는 access token 폐기. 루트 키는 우리가 꺼내 보관하지 않는다(사본을 늘리지 않음). Vault 값 2개는 비밀번호 관리자에서 다시 만들 수 있다.
6. 직접 DB 접속 SSL 강제(기본 꺼짐, 공식 ssl-enforcement 문서) → production·staging 모두 켠다.

## 5. 로그 점검 결과(읽기만)
- Edge Function 3개: 요약 숫자만 `console.log`, 오류는 영문·숫자 80자로 잘라 남김(비밀 조각 방지). 카카오 회원번호·토큰 출력 없음 — 양호.
- pg_net: 요청 헤더(x-cron-secret)가 `net.http_request_queue`에 실행 전까지 남고(실행 시 삭제), 응답은 6시간 `net._http_response`(공식 pg_net 문서). 응답 본문은 우리 함수 요약(숫자)이라 문제없음. 큐 표 권한이 postgres 전용인지 원격 확인 한 줄 추가.
- 앱: `console.warn`은 reason 코드만. 개발자 메뉴 세션 토큰은 로그 금지 주석 있음.
- 저장소 grep: 실제 비밀값 0건(테스트가 실행 중 만드는 임시 개인키 1건은 고정값 아님).

## 내가 틀릴 수 있는 이유
- 1인 운영에서 덤프 유출(T5) 확률은 매우 낮고, 컬럼 암호화는 장애 시 복구 절차를 복잡하게 만든다(키를 잃으면 큐 처리 불가). 카카오 큐 암호화 주장은 과할 수 있다.
- HMAC device_key도 "이벤트 표만 유출" 시나리오에서만 이득이다.
