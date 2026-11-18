# 저장 데이터 암호화·키 관리 회의 결론 (2026-11-19)
위원 4명(보안·서버·법률·앱) r1 → r2 표결. 원문 `r1/`, 표결 `r2.md`. 사용자 위임(DECISIONS 11-19). 법률 판단은 자문 아님(2차 자료 기준, 원문 대조·KISA 118 재확인 권고). 시간은 추정. (주재자 보고 부록을 리드가 저장 — 분류표 전체·방식 비교·출처는 주재자 보고 원문 기준으로 요약)

## 한 줄
컬럼 암호화는 넣지 않는다. 법이 저장 암호화를 요구하는 데이터(주민·여권·면허·외국인등록번호, 카드·계좌, 생체, 비밀번호)를 받지 않고, DB·백업은 Supabase가 AES-256으로 이미 암호화한다. 대신 키가 새는 경로를 막는다: 셸 기록·SQL Editor 입력 금지, 환경마다 다른 키(카카오 staging 앱 분리), legacy 서비스 키 → 새 secret 키 이행, DB 직접 접속 SSL 강제, Android 기기 간 이전 차단. 빌드 1 팀 7.5~11h + 사용자 1.5~2h.

## 1. 결정 표
| # | 결정 | 표결 | 빌드 |
|---|---|---|---|
| D1 | 기존 컬럼에 컬럼 암호화 없음(플랫폼 AES-256 + RLS·컬럼 grant + 짧은 보관) | 3:1(보안 반대) | — |
| D2 | 카카오 회원번호 큐 평문 유지. 포기 행은 06시 점검에서 당일 수동 처리·삭제, 운영 SQL에 회원번호 출력 금지 | 3:1 | 1 |
| D3 | events.device_key sha256 유지, 방침 문구 "가명값" | 3:1 / 4:0 | 1 |
| D4 | profiles.display_name 제거(쓰는 곳 0, 가족 읽기 열림) | 4:0 | 1 |
| D5 | admin_audit 사유·처리자에 `@`·9자리 이상 숫자열 서버 거부 | 4:0 | 1 |
| D6 | Vault·kick 함수 권한 pgTAP, remote-checks에 vault 권한·auth.audit_log_entries 건수·pg_net 큐 권한 | 4:0 | 1 |
| D7 | Android data_extraction_rules: 클라우드 백업·기기 간 이전 모두 제외 | 4:0 | 1 |
| D8 | 세션 토큰 Keystore 래핑 안 함(키 무효화 시 부모님 연결 소실 위험) | 3:1 | 2 조사 |
| D9 | Edge Function을 새 secret 키로 이행(legacy 2026년 말 폐기), production은 처음부터 새 키 | 4:0 | 1 |
| D10 | 모든 비밀값 환경별 다른 값(카카오 staging 앱 분리 포함) | 4:0 | 1 |
| D11 | Vault 값은 대시보드 Vault 화면으로만 입력, 루트 키 꺼내 보관 안 함 | 4:0 | 1 |
| D12 | DB 직접 접속 SSL 강제 ON(staging·production) | 4:0 | 1 |
| D13 | 비밀값을 명령줄·셸 기록에 남기지 않음 — 문서 정정 + ops 스크립트 숨김 입력 | 4:0 | 1 |
| D14 | 인증서 고정 안 함(토스 mTLS 때 재검토) | 3:1 | — |
| D15 | 방침 11절 저장 암호화 문구 확정, 내부관리계획 §5 사실 갱신 | 4:0 | 1 |
| D16 | 키 교체 연 1회 + 유출·인원 변경 시 즉시, staging 리허설 선행 | 4:0 | 정책 |
| D17 | 앞으로 제7조② 대상을 받게 되면 저장 안 함 우선, 필요 시 Edge AES-GCM(키 Edge secrets)+HMAC 블라인드 인덱스. pgsodium TCE 금지 | 4:0 | 규칙 |

## 2. 컬럼 분류 요지
- 그대로: auth.users.email·identities(Supabase 관리), device_tokens(본인 RLS·270일), push_log·claims·runs, notification_queue, events(가명·14개월), admin_audit 대상 id(1년), invite_codes(7일·30일 파기), answers·daily_sessions·cheers(31일), 호칭, 동의 증빙, entitlements, vault.secrets(권한 테스트 추가)
- 바꿈: profiles.display_name 제거(D4), admin_audit.reason·operator 서버 거부(D5), kakao 큐 포기 행 당일 처리(D2)
- 확인: auth.audit_log_entries 쌓이는지(D6) → 보관 기간 빌드 2

## 3. 방식 비교(기준)
A pgcrypto+Vault(차선) / B Edge AES-GCM+HMAC(미래 ②대상 시 채택) / C pgsodium TCE(금지 — 폐기 예정) / D 플랫폼 저장 암호화(현행)

## 4. 키 관리 정책 v0.1
- 비밀값 대장: 값은 비밀번호 관리자에만, 저장소엔 이름 목록만(Supabase secret 키 Edge용·ops용 분리, DB 비밀번호, push_cron_secret, project_url, FCM_SERVICE_ACCOUNT, KAKAO_ADMIN_KEY, 카카오·구글 Client Secret, SMTP, 업로드 키스토어, Supabase access token, Gemini 키)
- 규칙: ①production 사용은 보호책임자 1명(Owner, MFA), 앱 역할은 Vault·서비스 키 접근 0 ②staging·production 모든 비밀값 다름(같으면 출시 관문 실패) ③Vault는 대시보드 화면, Edge는 `supabase secrets set --env-file <저장소 밖 임시 파일>` 후 삭제, 명령줄 인자·`VAR=값 명령`·curl 헤더에 비밀 금지(불가피하면 앞 공백 + `setopt HIST_IGNORE_SPACE`) ④로그에 키·토큰·회원번호·이메일·초대 번호 금지, 운영 SQL 식별자는 끝 4자리 ⑤교체: 유출·의심·인원 변경 즉시, 그 외 연 1회, staging 리허설 선행 ⑥백업: Supabase Pro 일일 백업, 새 프로젝트로 덤프 복원 시 Vault 복호화 불가 → 대장 값으로 재생성 ⑦유출 대응 5단계(교체·폐기 → 접근 확인 → 대장 기록 → 내부관리계획 §9 → 같은 경로 정리) ⑧분기 자기 점검(키 노출 grep, 교체일, 환경별 값, MFA)
- push_cron_secret 교체: 새 값 생성 → 09시 피해 Edge secrets 교체 → Vault 교체 → push_runs로 정상화 확인(빌드 2: _NEXT 무중단)

## 5. 점검 결과
- 기기 저장: 법적 의무 없음, 구멍은 Android 12+ 일부 제조사 기기 간 이전(D7). EncryptedSharedPreferences는 폐기 라이브러리라 쓰지 않음
- 전송: HTTP API TLS 1.2/1.3만, release cleartext 금지 확인 1줄 추가, DB 직접 접속 SSL 강제(D12)
- 비밀값: 저장소 실제 비밀 0건. dev-server-notes §18 B-7·B-8이 셸 기록에 남는 형태(D13), env 키 읽는 스크립트 6개 숨김 입력 추가

## 6. 할 일
### 빌드 1
| # | 할 일 | 담당 | 추정 |
|---|---|---|---|
| E1 | 서버 마이그레이션(번호 리드 배정): display_name 제거, admin 인자 `@`·`[0-9]{9,}` 거부, vault·kick 권한 pgTAP | L1 | 2~3h |
| E2 | Edge 3개 `SUPABASE_SECRET_KEYS` 이행(legacy 폴백), ops용 secret 키 별도 | L1 | 1.5~2.5h |
| E3 | ops·photos 스크립트 숨김 입력, dev-server-notes 명령 예시 정정·HIST_IGNORE_SPACE·--env-file 안내 | L1 | 1.5~2h |
| E4 | remote-checks 줄 추가(vault 권한·net 큐 권한·audit_log 30일 건수) | L1 | 0.5~1h |
| E5 | Android data_extraction_rules + 매니페스트, stagingRelease cleartext=false 확인을 release-gates에 | L4 | 1~1.5h |
| E6 | 방침 11절 AES-256 문구, "가명값", 내부관리계획 §3·§5 | L6 | 1h |
| E7 | 06시 점검에 카카오 포기 행 당일 처리 | L1 | 0.2h |
| U1 | (사용자) production 새 API 키·legacy 비활성, DB SSL 강제 ON, Vault 화면 입력, 안 쓰는 access token 폐기 | 사용자 | 0.5~1h |
| U2 | (사용자) staging 전용 카카오 앱 분리, Firebase 환경별 프로젝트 | 사용자 | 0.5h |
| U3 | (사용자) 비밀번호 관리자에 비밀값 대장, zsh 기록 자가 점검, FileVault 확인 | 사용자 | 0.5h |
### 빌드 2
F1 세션 토큰 Keystore 조사, F2 push_cron_secret 무중단 교체, F3 audit_log 보관 기간, F4 앱 lint 토큰 출력 금지, F5 연 1회 교체 리허설, F6 토스 미니앱 키 관리, F7 결제 도입 시 D17 확인

## 7. 근거(요약)
안전성 확보조치 기준 제7조(②저장 암호화 대상, 2차 자료 — law.go.kr 원문 대조 필요), Supabase security(AES-256 at rest), Vault 문서, pgsodium 폐기 예정, API 키(legacy 2026년 말 폐기), SSL enforcement, Android Auto Backup(data_extraction_rules). URL은 r1/·r2.md 참조. KISA 118 질문: L-1 refresh token·인증번호가 ①인증정보인지, L-2 ⑤ FileVault 충족 여부, L-3 최근 개정 반영.

## 8. 한계
원격 staging 조회 안 함(E4·U1로 확인), GoTrue 내부 저장 형태 미확인, 위원 4명 같은 모델(보안 소수 의견은 r2에 보존).
