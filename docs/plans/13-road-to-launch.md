# 13. 출시까지 가는 길: 완료 정의 · 남은 일 전수 · 병렬 웨이브 계획 (PM, 2026-11-18)

- 목적: 빌드 1(Play 내부 테스트 → 비공개 테스트 → 공개)까지 **빠진 것 없이** 가기 위한 단일 실행 문서. 오케스트레이터(리드)가 이 문서만 보고 레인을 나눠 병렬로 돌릴 수 있게 쓴다.
- 기준 시점: main `f1b0568`(2026-11-18). 미병합 브랜치 `p7-motion`(8dcc5fe), `dev-menu`(f7bd1e3). 서버 마이그레이션 0031까지(로컬), staging은 0030까지 반영.
- 원칙: **완성도 > 날짜**(DECISIONS 11-17 "팀 최우선 목표"). 날짜는 목표일 뿐이다. 시간 추정은 모두 **가정**이다(h = 팀 작업 시간, 리뷰 시간은 따로).
- 이 문서가 10-master-plan의 §2 작업표·§3 시간표를 대체한다. 10의 마이그레이션 대장·사용자 몫 표는 이 문서 §2·§4.3으로 옮겼다.
- 상태 표기: **완료** · **진행**(코드·문서 일부 있음) · **미착수** · **사용자**(사용자 몫) · **외부**(외부 응답·업로드 대기) · **결정**(이 문서 §5에서 팀 결정으로 닫음) · **불명→확인**(확인 작업 자체가 할 일).
- 크기: S ≤ 3h, M 3~8h, L 8h 초과.
- 출처 표기 약어(§7 출처 대조표에서 다시 씀): `DEC`=DECISIONS.md, `MP`=10-master-plan, `ENV`=09-environments, `BO`=11-backoffice, `AR`=12-architecture-refactor, `S07`=07-launch-sprint, `S08`=08-social-login, `ARCH`=team/ARCHITECTURE, `REL`=team/RELEASE, `PROG`=.claude/progress.md, `GIT`=git log·branch, `GREP`=app/src TODO grep, `LCC`=legal/compliance-checklist, `LQ`=legal/questions-for-lawyer, `LN`=legal/in-app-notices, `SITE`=site/drafts 3종, `STORE`=store/play-console-draft, `IMPL`=_qa/impl-drift, `INV`=_qa/artifact-inventory, `CPEND`=_qa/copy-pending, `SWP`=_qa/artifact-sweep, `QCH`=_qa/child, `QCM`=_qa/common, `QPA`=_qa/parent, `QFS`=_qa/first-screen, `QFR`=_qa/first-screen-redesign, `DAN`=dev-app-notes, `DSN`=dev-server-notes, `CCON`=dev-app-child-contract, `AUD`=dev-audio-spike, `COPY`=copy-v3-confirmed, `SPK`=spikes/install-referrer, `TODO`=TODO.md, `BEJ`=board ease-and-joy, `BFI`=board feature-ideation, `BPE`=board personalization, `BDM`=board DECISION-MEMO, `BFS`=board first-screen SYNTHESIS, `BGE`=board gemini memo, `COV`=pm/coverage-audit, `PLB`=pm/launch-polish-backlog, `RPL`=pm/replan, `BGM`=pm/bgm-proposal, `SMK`=qa/device-smoke, `AST`=assets-manifest, `OPS`=OPERATING, `REPO`=REPO.md, `WRI`=writer.md, `QAM`=qa.md, `DEVM`=dev.md, `DSG`=designer.md, `POL`=policy.md, `GRO`=growth.md, `PHO`=photo-curator.md, `MKT`=marketing/, `CNT`=content/ 디렉터리. 리뷰는 `R-` 접두(§7 표 참고).

---

> 리드 갱신(11-18): 작성 직후 상태 변화 — p7-motion main 병합(재검토 통과), staging에 0031 반영 완료, dev-menu H1은 브랜치에서 수정·재검토 승인(R2 계정 보호 수정 후 병합 예정), p7-followup-ux(어르신 UX 6건) 리뷰 반영 중.

## 1. 목표 정의 — 완료 조건(Definition of Done)

출시는 세 관문으로 나눈다. 아래 표의 **모든 칸이 체크되어야** 그 관문을 통과한다. "실기기"는 사용자 폰(S25) + 가능하면 저가 안드로이드 1대.

| 관문 | 의미 | 트랙 |
|---|---|---|
| **G-INT** | 내부 테스트 업로드(팀·사용자 가족만, production 서버) | Play 내부 테스트 |
| **G-CLOSED** | 비공개 테스트 시작(테스터 12~20명, 14일) — 사용자 원문 "어느 정도 완성" | Play 비공개 테스트 |
| **G-PUB** | 프로덕션(공개) 신청 | Play 프로덕션 |

### 1.1 관문별 완료 조건

| 영역 | G-INT (내부 테스트) | G-CLOSED (비공개 테스트) | G-PUB (공개) |
|---|---|---|---|
| **기능** | 빌드 1 범위 전 기능 코드 완료(§2의 AP·AC·AU·SV 중 "빌드 1" 표시 전부): 푸시(일 1회·N2·N3), TTS 읽어 주기, BGM, 도장 모션·소리, B1 사진 크게 보기, P13 설정 v2, P15 지난 날, C6 곧 유료, 호칭 겹침, OSS 라이선스 | 내부 테스트에서 나온 치명·높음 결함 0 | 비공개 테스트 결함 중 높음 0, 중간은 처리 또는 사유 기록 |
| **디자인 1:1** | 핵심 흐름(첫 화면·P0~P8·P9·C0~C5·C8) 디자인 QA 승인(`device-review/QA-<화면>.md`) | **전 화면** 디자인 QA 승인(나머지 P13·P15·P16·N1·C6·C7·S1·S2·탭 바 포함) | 비공개 테스트 중 바뀐 화면 재승인 |
| **문구** | `copy.ko.json`에 `_status` 미확정·대기 0건, 11-5 정리 완료, 하드코딩 한글 0(copyBan 테스트) | 금지어 grep 0(아직·못 했·N일째·틀렸·치매·두뇌·안부·안심·칭찬류) | 스토어·마케팅 사실 주장 ↔ 출시 빌드 대조 "일치" |
| **접근성** | 핵심 흐름 TalkBack 순회 통과(읽기 순서·라벨·U+2060 읽기), 200%·동작 줄이기 핵심 흐름 통과 | 전 화면: TalkBack · 150/200% · 320×640 · 동작 줄이기 · 다크(라이트 고정) · 접근성 필수 8개(20sp·64dp·대비 4.5·150% 잘림 0·시간 제한 0·라이트·백 버튼·2초 반응) | 어르신 3가구 관찰에서 막힌 지점 처리 |
| **성능** | 릴리스 빌드 콜드 스타트 크래시 0 ×10, 저가 기기 첫 화면 모션 끊김 없음 | 콜드 스타트 시간·AAB 크기 기록, 사진 장당 ≤150KB | 크래시 없는 사용자 비율 ≥ 99%(Crashlytics, 가정 목표) |
| **보안** | `/code-review high` 전체 + 인증·저장·삭제·푸시·dev-menu `xhigh` 통과, release 번들에 테스트 비밀번호·secret 0(grep 자동), advisors 경고 처리 | Supabase·Firebase·Google·Kakao·Play 콘솔 MFA, 노출 secret 키 교체 완료 | 재검토 1회(비공개 테스트 중 바뀐 코드) |
| **개인정보** | 방침 G1~G7 충족, 동의 문구 ↔ 자녀 노출 1:1 대조표 통과, 31일 파기 배치 production 동작 1회 확인 | 방침·약관·삭제 안내 **게시**(URL 살아 있음), 데이터 보안 양식 = 실제 SDK 동작(AD_ID 실측) | 변호사/KISA 회신 반영 |
| **법률** | 앱 안 고지 위치(in-app-notices) 전 행 반영 | 약관 게시, 사업자 정보 5곳 글자 일치(방침·약관·삭제 안내·Play·앱 설정) | AI 기본법·광고성 알림 판단 회신 반영(또는 사유 기록) |
| **스토어** | 앱 만들기, 내부 테스트 트랙, 앱 서명, 패키지명 확정 | 등록정보·그래픽·스크린샷·데이터 보안·콘텐츠 등급·대상 연령·건강 앱·광고 ID·앱 액세스(심사 가족) 입력 완료 | 14일·12명 충족, 프로덕션 신청 답변 |
| **운영(백오피스 최소)** | Studio 조건부 사용 규칙(MFA·멤버 1명·수기 대장), 지표 SQL 스니펫, 웹 삭제 요청 처리 절차 | admin_delete_* RPC·감사 테이블, 콘텐츠 추가 스크립트 게이트, 재고 경보 뷰 | 06시 지표 루틴 가동 |
| **모니터링** | Crashlytics production 수집 확인(의도적 크래시는 staging), pg_cron 실행 성공 기록 | 푸시 발송 성공·실패·무효 토큰 수 확인 쿼리 | 주간 지표 보고 |
| **콘텐츠** | 14일분 production 업로드 | **30일분**(15~30일 사진·질문·낱말·첫마디) production 반영(14일 테스트 중 반복 방지) | 재고 경보 7일 이상 남음 |
| **실기기 QA** | 핵심 흐름 원격 2대 E2E 1회, 키보드 3종, 오디오 8항목 | 원격 2대 E2E 2회, 15일차 순환·자정 경계·비행기 모드, Install Referrer(내부 트랙) | 비공개 테스트 피드백 반영 후 회귀 1회 |

### 1.2 빌드 1 범위 확정(이 문서 기준)
- **포함**: 위 기능 + 이미 병합된 것(U0, 서버 0019~0031, env 분리, 자녀 C0~C5·C7, 어르신 P1·P1c·P2·P3 v4·P4~P8·P9·P13·P16, 첫 화면 D2-C, 스플래시·런처, App Links·Install Referrer).
- **빌드 2(이 계획 밖)**: 부모님 먼저 흐름, 형제 초대(C10), 결제·7일 체험, 해님 재설계, 개인화(시즌 풀·사진 취향), iOS·iOS 촉각, 토스 미니앱, 관리자 웹(Next.js), 받은 응원 다시 보기, 업데이트 안내·평가 요청, 다크 모드 시안, 공지 배너 구현(자리만), "어디서 보셨어요?" 문항, 이야기 주제 추천 내용(C5는 배지 행만).

---

## 2. 남은 일 전수 목록

열: ID · 항목 · 출처 · 상태 · 크기 · 담당 레인 · 의존 · 검증. 레인 번호는 §3.1. 같은 일이 여러 출처에 있으면 한 행으로 합치고 출처를 모두 적었다.

### 2.1 서버 (L1)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| SV-01 | 푸시 토큰 RPC(`register_push_token`·`unregister_push_token`, 기존 `device_tokens`(0001) 재사용, 역할 검사, 로그아웃·삭제 시 정리) — **0032** | MP:U15, DSN:115, DEVM:9절#5 | 미착수 | M 4~6h | — | pgTAP(권한·anon 거부·삭제 cascade) |
| SV-02 | 일일 푸시 발송: Edge Function(FCM HTTP v1) + pg_cron, **KST 08:00~20:59**, 하루 1회 09:00(§5 D-07), 비동의·연결 끊김·알림 끔·심사 가족 제외, 무효 토큰 정리, 발송 기록(성공·실패·제외 수), 혜택·유료 문구 금지 — **0033** | MP:U15, LCC:#10, DEC:284, PLB:G1, R-MPR:11 | 미착수 | L 10~14h | SV-01, US-10(Firebase 서비스 계정 secrets) | pgTAP(대상 선정 함수) + 함수 단위 테스트 + staging 실기기 수신 |
| SV-03 | `notification_queue`(0028) 소비: N3 연결 성공(자녀), N2 응원 도착(어르신) 발송, `sent_at` 채움 | IMPL:#25, CPEND:#8, BEJ:A⑥, COPY:11-8, DSN:115 | 미착수 | M 4~6h | SV-02 | pgTAP + staging 2대 수신 |
| SV-04 | 이벤트 화이트리스트 추가: `paid_sheet_opened`·`paid_interest_tapped`(C6), `photo_zoom_opened`(B1), `child_first_answer_viewed`(전환 분모), `push_opened` — **0034** | DSN:112, BFI:B1, R-MB:①2, MKT:strategy7 | 미착수 | S 2h | — | pgTAP + 계약 상수 비교 테스트 |
| SV-05 | 보안 후속 — **0035**: authenticated의 content 두 테이블 쓰기 revoke(R1), consent `default 'v1'` 제거, 버킷 "개인 사진 금지" 주석·png 거부, 호칭 RPC 이원화(`set_parent_title`/`_for`) 폐기 일정·reason 반환 통일 | R-S19:R1, R-SPS:①4·①9·③, R-ARC:A9·A19 | 미착수 | M 4~6h | — | pgTAP, advisors "No issues" |
| SV-06 | 카카오 서버 unlink(Admin 키 Edge Function + 재시도 큐), 계정 삭제 시 호출 | R-SL:2, DAN:204, GREP:realApi.ts:95, S08:R10, LCC:§2-5 | 미착수 | M 5~7h | US-12(카카오 Admin 키 secrets) | 함수 테스트 + staging 탈퇴 후 카카오 연결 해제 확인 |
| SV-07 | 백오피스 빌드 1분 — **0036**: `delete_my_account` 본문 공통 내부 함수화 → `admin_delete_account`·`admin_delete_answers`, `admin_audit`(1년 보관, update·delete revoke + 변경 감지 트리거), `content_runway` 뷰 | BO:§4, R-BO:BO6·BO8·BO9 | 미착수 | L 10~14h | — | pgTAP(감사 행·권한·답만 삭제) |
| SV-08 | 콘텐츠 추가 스크립트 게이트: 검수표 미완 사진 업로드 거부, 게시 day_index 덮어쓰기 거부, 감사 행 기록 | BO:§4, R-BO:BO14 | 미착수 | M 4~6h | SV-07 | 스크립트 테스트(거부 사례 3) |
| SV-09 | 0001→끝 순차 재생 검증(db reset + pgTAP 전체), 원격 pg_cron `job_run_details` 성공 1회, 0017·0026 `auth.users` 삭제 권한 원격 확인 | DSN:137, R-S19:정보, DAN:198 | 미착수 | S 1~2h | US-05(staging 0031 push) | 로그 첨부 |
| SV-10 | DB 타입 생성 `scripts/gen-types.sh` + `--check` | AR:1-2, R-ARC:A16, ARCH:§5 | 미착수 | S 1h | — | 재생성 diff 0 |
| SV-11 | dev-menu 테스트 가족 정리 방법(staging 전용 스크립트) | R-DM:M3 | 미착수 | S 2~3h | AU-01 | staging에서 생성→정리 1회 |
| SV-12 | 형제(자녀 2명) 시나리오 통합 테스트: 합류 RPC가 없으므로 service role 시드로 scope child/family 삭제 검증 | DAN:52, R-RS:RS3 | 미착수 | S 2h | — | `test:integration` |
| SV-13 | `login.resent` "이전 번호는 쓸 수 없어요"가 Supabase OTP 재발송 동작과 맞는지 확인 → 라이터에 결과 전달 | COPY:7절 | 미착수 | S 1h | — | 로컬 재현 기록 |
| SV-14 | production Auth 설정 체크리스트 작성(익명 ON·한도, Kakao "Allow users without an email", OTP 6자리 600초, 템플릿 원본, Redirect URI, 유출 비밀번호 보호, CAPTCHA 판단) — 실행은 사용자 | ENV:§3·§7, REL:§9, TODO:5·25 | 미착수 | S 1~2h | — | staging 설정과 대조표 |
| SV-15 | 심사 접근 운영 절차서(`ops/create-review-access.mjs` enable·심사 후 disable·cleanup) | DSN:118, STORE:§8, R-PD:C§8 | 미착수 | S 1h | — | staging 리허설 1회 |
| SV-16 | 지표 SQL 스니펫(퍼널 8단계·DAU·D7·연결률·유료 관심·푸시, `is_test` 제외, 20명 미만 A/B 비율 숨김) | BO:§1·§2, GRO:§6 | 미착수 | M 3~4h | SV-04 | staging 실행 결과 |
| SV-17 | 마이그레이션 대장 갱신(dev-server-notes, 0032~0036) | MP:§2 대장, ARCH:§3 | 진행 | S | 각 SV | 리뷰 체크리스트 |
| — | 이미 닫힌 서버 항목(참고): 0018~0031 전부, 커서(0024), 심사 가족(0025), 익명 계정 삭제(0026), starter(0027), 기록·peek·알림 큐(0028), 퍼널(0029), P16(0030), advisors(0031) | MP:대장, GIT | 완료 | — | — | pgTAP 29파일 |

### 2.2 앱 어르신 (L2)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| AP-01 | `p7-motion` 재검토(L2 원 테두리 280ms·체크 480ms, L6 불안정) → main 병합, R5 띠 바닥선·간격 24 포함 | GIT, PROG, R-P7, IMPL:#19·#14·#24, R-CH:R5, BEJ:C | 진행 | S 2~3h | 리뷰어(xhigh 아님, high) | jest·tsc·lint, 재검토 문서 |
| AP-02 | 도장 소리 실제 재생(react-native-sound 0.13.0 설치 후), 로드 실패 처리, 무음·진동 존중 | DEC:341, R-P7:L5, AUD, PLB:C1 | 미착수 | S 2~3h | AP-01, AU-03 | 오디오 실기기 QA-04 |
| AP-03 | 읽어 주기(TTS): P4·P5·P6·P8 '읽어 주세요' 버튼·읽는 중 상태·멈춤, 한국어 음성 없음 배너, TalkBack 켜짐 시 정책 | INV:§3, IMPL:#3, COV:P4·P5, PLB:A1, RPL:U2, GREP:KeyboardStep:214·CheerDialog:14, AUD, DEVM:#6 | 미착수 | L 10~14h | AU-03, WR-03 | 단위(정책)·화면 테스트, QA-04 |
| AP-04 | BGM: P3 '음악 켜기/끄기', P7 첫 완료 1회 권유·미리 듣기 시트, 설정 토글, 볼륨 30%·2초 페이드, TTS 덕킹 10%, 무음·이어폰·백그라운드·TalkBack 정지, 출처 고지 | DEC:226·297, BGM:§2, INV:§3, IMPL:#18, PLB:C3·F4, COV:§4 | 미착수 | L 10~14h | AU-03, CT-04(음원) | 화면 테스트, QA-04 |
| AP-05 | B1 사진 크게 보기(P4 탭 → 전체 화면, 첫 1회 안내, `photo_zoom_opened`) | BFI:B1, DEC:290 | 미착수 | M 5~7h | DZ-06, SV-04 | 화면 테스트·TalkBack |
| AP-06 | P13 설정 v2: '가족에게 이렇게 보여요' 미리보기, 안심 문구(B4 "가족에게는 고른 답과 그 날짜만"), 알림 토글, 배경 음악·도장 소리 토글, 앱 정보 묶음(약관·방침·OSS·AI 안내·BGM 출처·"병원 앱 아님"·사업자 정보·문의·버전) | INV:§3, COV:P13, R-DS:C, BFI:B4, LN:§3, R-MPR:12, PLB:F2 | 진행(일부 행만) | L 8~12h | AU-06, AU-07, AU-04 | 화면 테스트, 디자인 QA |
| AP-07 | P15 지난 날 30일 목록·한 날 보기(`parent_history` 0028) + 코스 홈 날짜 아래 '지난 날 보기' 링크 | BEJ:B, INV:§12, COPY:11-3, R-CH:④, DEC:309 | 미착수 | L 8~12h | — (§5 D-01로 포함 확정) | 화면 테스트, 디자인 QA |
| AP-08 | P1c 보조 '처음으로' 링크, P1 빈 칸 '여기' 표시, P5 제목 문구 | DAN:260·284 | 미착수 | S 2h | — | 시안 대조 |
| AP-09 | 연결 화면이 떠 있는 동안 새 초대 링크 반영 | GREP:useConnectFlow:20, R-CE:L1, BEJ:A② | 미착수 | S 2h | — | 단위 테스트 |
| AP-10 | 해님 첫 인사 1회(연결 직후 앨범 첫 화면, DEC:187) 구현 여부 확인·구현 | COV:P3, PLB:D4 | 불명→확인 | S 1~2h | — | 화면 테스트 |
| AP-11 | 포커스 정리: '다시 정하기' → 설정 해당 줄 스크롤·포커스, 보기 전용 복귀 시 제목 포커스, goBack 재진입 규칙(§5 D-10) | R-CH:L4·③, R-QAF:Q5 | 미착수 | S 2~3h | — | TalkBack |
| AP-12 | StepRow 테이프 고정 140×28 → 내용 크기, 인사·상태 줄 높이·'다시 보기' 72/64 디자인 확인 반영 | R-CH:L1·L2·L3 | 미착수 | S 1~2h | DZ-05 | 시안 대조 |
| AP-13 | 자체 SkipLink·RetrySheet → U0 컴포넌트 교체 검토 | R-P68:13 | 불명→확인 | S 1~2h | — | 리뷰 |
| AP-14 | 테스트 보강: 언마운트 뒤 setState, 설정 상태 문장 읽기, 삭제 두 번 누르기, 철회→재동의→다시 저장 통합, 콘텐츠 null "오늘 준비 중" 경로 | R-B:B6·B16, R-PF:PF10·PF12·PF14·PF15, R-SP:SP4 | 불명→확인 | M 3~4h | — | jest·통합 |
| AP-15 | P16 BottomSheet 예외 TODO 주석 정리(DEC:334로 결정됨) | GREP:ParentFamilyScreen:26, DEC:334 | 결정 | S 0.2h | — | — |
| AP-16 | P14 별도 화면 대신 코스 홈 띠 유지(§5 D-02) — 시안 P14 보관 표시 | COV:P14, PLB:D1, QCM | 결정 | S 0.5h | DZ | — |

### 2.3 앱 자녀 (L3)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| AC-01 | C6 곧 유료 시트(가격 3안 "예정 가격" + '소식 받기' 1버튼, "지금은 결제되지 않아요. 관심만 표시돼요", 관심 이벤트, 뒤 토스트) + C5 행에서 열기 | DEC:126·148, INV:§4, GREP:ChildReport:61, LN:§2, LCC:#12, R-UX2:②6, RPL:U9, QAM:게이트9 | 미착수 | M 6~8h | SV-04 | 화면 테스트, 디자인 QA |
| AC-02 | C4_title_dup 호칭 겹침(칩·안내 줄·이름 고르기 시트·토스트) + redeem 호칭 상속 서버 동작 확인 | IMPL:#26, CCON:19, COPY:11-8 | 미착수 | M 5~7h | L1 확인 S | 화면·통합 테스트 |
| AC-03 | N3 연결 성공: 앱 안 위쪽 배너 + 푸시 수신 탭 라우팅 | IMPL:#25, INV:§12, PLB:D5 | 미착수 | M 3~5h | SV-03, AU-04 | 2대 실기기 |
| AC-04 | C3 '알림 켜기' 줄, C7 '연결되면 알려 드려요' 알림 행(실제 권한 상태) | CCON:20, GREP:useNotifyPermission:5, COPY:10절, R-V15:V9, R-DS:A | 미착수 | S 2~3h | AU-04 | 화면 테스트 |
| AC-05 | 자녀 이벤트 호출 확인·추가(`cheer_sent`·`child_report_viewed`·`invite_share_tapped`·`child_first_answer_viewed`) | CCON:20, R-MB:①2 | 불명→확인 | S 1~2h | SV-04 | 통합 테스트 |
| AC-06 | 날짜 NaN 방어(formatDate·formatAnswerDate), '부모님' 기본값 상수 하나로, `latest.prompt` 미사용 정리 | R-B:B5, R-PF:PF11·PF16·PF19 | 미착수 | S 2h | — | 단위 테스트 |
| AC-07 | 구글 nonce/Credential Manager 확인, 카카오 PKCE 확인, 같은 이메일 자동 연결 동작(구글·이메일만 허용, 카카오 미수집) 확인, 어르신 여러 명 홈·로그아웃 동작 확인 | R-SL:3·7, DAN:43·206, POL:8.2 | 불명→확인 | S 2h | — | 실기기 QA-06 |
| AC-08 | Clipboard: 코어 유지(§5 D-11), Android 13+ 토스트 중복 방지 | R-CS:L7, GREP:clipboard:2, DAN:88 | 결정+미착수 | S 1h | — | 실기기 |
| AC-09 | C5 이야기 주제 추천: 빌드 1은 '곧 유료' 배지 행만(§5 D-03) | COV:C5, RPL:U7 | 결정 | — | AC-01 | — |

### 2.4 앱 공용·인프라 (L4)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| AU-01 | `dev-menu` H1 수정(테스트 자녀 비밀번호가 release 번들에 들어가지 않게, `check-dev-menu-bundle.sh` 표식 추가, example 안내 수정), M1 실패 시 닫힘·release 산출물 자동 grep, M2 보관 세션 정리, L1 버전 줄 읽기, L2 production이면 `API_MODE=real` 강제, L3 ARCHITECTURE 예외 기록, L4 테스트 8건 → 재검토 **xhigh** → 병합 | R-DM, GIT, R-ENV:N1 | 진행(조건부) | M 5~7h | — | 두 flavor release 번들 grep 0, 재검토 문서 |
| AU-02 | Firebase 연동: `@react-native-firebase/app`·`messaging`(정확 버전 고정), flavor별 `google-services.json`(gitignore), `POST_NOTIFICATIONS` | MP:U15, ENV:§3, TODO:13 | 미착수 | M 4~6h | US-10 | 두 flavor 빌드 |
| AU-03 | 오디오 모듈 `src/audio`(useAudioInputs·speak·playSfx·useBgm), `@mhpdev/react-native-speech@1.4.4`·`react-native-sound@0.13.0`·`react-native-volume-manager@2.2.0` 설치, 매니페스트 TTS_SERVICE queries, 정책(audioPolicy) 연결, SunBubble/audioPolicy 이중 판단 정리 | AUD:§4, DEC:296·341, R-U0:11, RPL:U1 | 미착수 | M 6~8h | AP-01 병합 | 단위 테스트, APK 크기 기록 |
| AU-04 | 푸시 클라이언트: P12/N1 권한 안내(앱 안 안내 → 시스템 창, "안 받으셔도 앱은 그대로 써요", 거절 뒤 '휴대폰 설정 열기'), 토큰 등록·갱신·로그아웃 해제, 포그라운드 수신, 알림 탭 라우팅, `push_permission_result` | INV:§3, COV:P12, R-DS:A, LN:N1, LCC:#9, DAN 연동 | 미착수 | L 10~14h | AU-02, SV-01 | 화면 테스트, QA-07 |
| AU-05 | U16 Crashlytics: 도입, staging 의도적 크래시 수집 확인, 출시 AAB 병합 매니페스트에서 `AD_ID`·위치 권한 확인(있으면 `tools:node="remove"`) | MP:U16, R-MPR:1, STORE:§5, LCC:#11, R-PD:C | 미착수 | M 4~6h | AU-02 | 콘솔 수집 화면, 매니페스트 덤프 |
| AU-06 | 오픈소스 라이선스 화면(JS 목록 + Android 네이티브 목록, 빌드마다 생성), P13·C7 공용 | LCC:#20, PLB:F3, GREP:appInfo:7·ChildAppInfo:13 | 미착수 | M 4~6h | — | 화면 테스트, 목록 최신성 검사 |
| AU-07 | 앱 정보 상수 한 파일(사업자 정보·문의·약관·방침 URL), 버전 라벨 네이티브 값("1.0.0 (n)"), P1·C0 약관 한 줄 링크화, 외부 브라우저 열기·오프라인 토스트 | GREP:appInfo:2·4·ConnectScreen:40, LN:§1·§3, PLB:B5·F2, IMPL:#22, COV:§4 | 미착수 | S 3~4h | US-03·US-04 값 | 단위 테스트(값 일치) |
| AU-08 | 아키텍처 1단계: `scripts/sync-copy.sh` + 바이트 비교 테스트, lint 레이어 규칙 warn 기준선, contract zod 결정 | AR:1단계, R-ARC:A7·A17 | 미착수 | S 2~3h | — | 테스트 초록 |
| AU-09 | 아키텍처 3단계(계약): 타입 이관, copy 역의존 제거, zod 검증(`contract_mismatch`), `__integration__/contract.test.ts` | AR:3단계, R-ARC:A1·A2·A13, GREP:realApi:331 | 미착수 | M 5~6h | AU-08, SV-10 | 통합 100% 통과 |
| AU-10 | 아키텍처 4단계(동결 창 반나절): state·navigation 분리, BackBar·TextLink·CodeShow·DeleteLink → ui/shared, errorMessage → shared, api 도메인 분할, lint error, 회차 이름 테스트 정리 | AR:4단계, R-ARC:A3~A6, R-CS, R-CE:N6, R-P68:13, DAN:274, GREP:KeyboardStep:323 | 미착수 | M 5~6h | Wave 2 종료(동결) | lint error 0 |
| AU-11 | 스테이징 앱 안 띠(30dp) 확인·구현 | INV:§2 | 불명→확인 | S 1~2h | — | staging 캡처 |
| AU-12 | E2E 하네스(§5 D-08): Maestro 흐름 5개(어르신 첫 연결→코스 완료, 미연결 열람, 자녀 로그인→번호→대기→홈, 응원 왕복, 삭제), testID 규칙 문서, 에뮬레이터 실행 스크립트 | QAM:7절, R-DSC:D4, 사용자 요구 | 미착수 | M 6~8h | — | 에뮬레이터 초록 |
| AU-13 | Install Referrer 후속: handled 해시 솔트, markDone 창, 네이티브 host 이중 검사, RELEASE.md "debug 덮어쓰기 한 앱만" 한 줄, site/c 스크립트 테스트 | R-SR:R1~R4·테스트 | 미착수 | S 3h | — | 단위 테스트 |
| AU-14 | `APP_LINK_HOST` env 키 추가(staging·production.example·Gradle 검사), assetlinks 템플릿 SHA-256 채우기, `site/c` HOST 교체, `.nojekyll` | SPK:91·92, DEC:335, R-SR:L7 | 미착수 | S 2h | US-03(도메인), US-15(서명 SHA-256) | 링크 열기 실기기 |
| AU-15 | 디자인 시스템 잔여: 비활성 버튼 2px 테두리, 옛 토큰 별칭 제거, 화면 숫자 크기 직접 사용 제거, body 20/22 중복, 배열 children·배지 keepAll, 범위 밖 호출부 점검 | R-DSC:D5·D11·D13·D14, R-CE:L10, BEJ:D | 미착수 | M 3~4h | DZ-05 | 시안 대조 |
| AU-16 | Text20 ref 합성 순서, 오프라인 판별·`_removeSession` 의존 테스트 고정, `StepName` 서버 허용값 가정 주석 제거(계약 상수로) | R-QAF:Q9, DAN:10·41·273, GREP:types.ts:52 | 미착수 | S 2h | — | 단위 테스트 |
| AU-17 | 성능 측정: 릴리스 콜드 스타트·저가 기기 첫 화면 모션·AAB 크기 기록(R8은 §5 D-12) | QAM:2절, QFR | 미착수 | S 2~3h | — | 측정표 |
| AU-18 | 동의 문구 변경 시 `CONSENT_VERSION` 올림 검사 테스트 | R-B:B10 | 미착수 | S 1h | — | 테스트 |
| AU-19 | imageCache 키: 공개 버킷이라 서명 URL 미사용 확인 후 닫기 | R-U0:14 | 불명→확인 | S 0.5h | — | 코드 확인 |
| AU-20 | 출시 빌드 의존성: `npm ci`로 잠금 파일 그대로 설치, caret 의존성 출시 전 고정 여부 확인 | REL:§8 | 미착수 | S 1h | — | 빌드 로그 |

### 2.5 디자인 (L5-D)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| DZ-01 | 디자인 QA 승인(현재 0건): FS·P0·P1·P1c·P2·P3·P4·P5·P6·P7·P8·P9/P10·P13·P15·P16·N1·C0·C1·C2·C3·C4·C5·C6·C7·C8/C9·S1·S2·탭 바·미연결 띠 — 시안 담당이 `device-review/QA-<화면>.md`에 "승인" | OPS:디자인 QA, COV:§0·FS·P1·P3, DEC:193, RPL:U10 | 미착수 | L 20~30h | QA-02 캡처 | 승인 문서 |
| DZ-02 | 웨이브마다 UX 개선 감사(§3.6) | 사용자 요구, OPS | 루프 | 웨이브당 S 2~3h | — | 감사 문서 |
| DZ-03 | 스토어 그래픽: 아이콘 512, 피처 1024×500, 스크린샷 4~8(첫 화면 쓰면 이미지 안 "AI가 만든 그림"), 캡션 6개 | PLB:B3, INV:S5, CPEND:#9·#10, R-FS:FS11, AST:§1, COV:S5 | 진행(시안) | M 6~8h | DZ-01(승인 화면) | 리드 승인 |
| DZ-04 | 미결 판단: 320 상태 그림 크기, P1 320 키패드 마지막 줄, S2_empty 볼터치 잔존, 첫 화면 150·200% 60% 해제 앱 확인, 자녀 날짜 글자 16 허용 여부(지금 Text20 하한 20) | QCM, QPA:5차, QFS, BGE:E, INV:§7-1, DAN:59 | 미착수 | S 2~3h | — | 판정 기록 |
| DZ-05 | 시안 문서 잔여 일괄: P6 노트 '잘 쓰셨어요', V7·V10~V12, r2·1차 UX 불명 항목(R2-7·8·9·11·13·14·15·17, U15~U18·U20), talkback-spec R11 "완료 문장"·칸별 라벨 표, `_manifest/*.json`, 브랜드 README 3D, assets-manifest 낡은 서술, 인사·상태 줄 높이 | R-V15, R-UX2, R-UX, COPY:11-2#19·11-5, R-CE:L5, INV:§8·§11, AST:§2, R-CH:L1·L3 | 미착수 | M 4~6h | — | 감사 체크표 |
| DZ-06 | B1 사진 크게 보기 시안 확인(없으면 작성) | BFI:B1 | 불명→확인 | S~M 2~4h | — | 리뷰 |
| DZ-07 | 런처 아이콘 크기·Android 12+ 모양·48dp 인지, 스플래시→JS 크기 튐 | DAN:210·211·231·237, DEC:258 | 미착수 | S 1~2h | QA-10 | 캡처 |
| DZ-08 | 워드마크 서체 라이선스 확정(OFL만, 원문 URL 기록) | DEC:259, LCC:#15, DSG:10절, DAN:7·128 | 미착수 | S 2h | — | 기록 |
| DZ-09 | 카카오·구글 공식 로고 파일 사용 확인(G 원본 svg) | DAN:183, INV:§7-5, LCC:#23, PLB:D6 | 불명→확인 | S 1h | — | 버튼 대조 |
| DZ-10 | P7_motion 미연결 보드 도장 연출 반영 | COPY:11-7 | 불명→확인 | S 1h | — | 시안 |
| DZ-11 | 화면별 TalkBack 순회 기준표(상태별 라벨 보드) — QA와 공동 | INV:§8, COV:§0 | 미착수 | M 3~4h | — | 기준표 |

### 2.6 라이터 (L5-W)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| WR-01 | 문구 정리 묶음: push[] 요일별 7문장 폐기, `course.stamps_a11y`("이번 주 도장, {요일들}에 찍었어요")+`weekdays_a11y`, `first.polaroid_a11y` 확정문, `connect_wait.new_code`("새 번호 만들기")·`expired`, `course.continue` 삭제, `family.stop_sheet.hint_one` 확인, `first._status` 정리, 첫 화면 소개 순서(사진→고르기→자판), C0 만 14세 이용 대상 안내, NBSP 묶음 적용 여부 | QCH, COPY:11-5·10절·11-2#13·#18, GREP(copy:503·552), COV:FS, DAN:224·259·267, R-QAF:Q9, R-CE:L9, LN:C0, POL:8.3 | 미착수 | S 3~4h | — | copy 테스트, `_status` 미확정 0 |
| WR-02 | 푸시 문구: 일일 알림, N2 응원 도착, N3 연결/다시 연결, `push.optional` — 혜택·유료·"다시 오세요" 금지 | COPY:11-1#8·#8b·11-8, CPEND:#8, LCC:#10 | 진행 | S 2h | — | 법률 리뷰 |
| WR-03 | 읽어 주기 문장 표(P4·P5·P6·P8), 한국어 음성 없음 배너 문구 | MP:②, AUD:46 | 미착수 | M 3~4h | — | 라이터 리뷰 |
| WR-04 | BGM 권유 시트·출처 고지, 설정 앱 정보 전체 문구, C6 시트 문구 대조 | LN:§2·§3, BGM | 진행 | S 2h | — | 법률 리뷰 |
| WR-05 | 스토어 문구 최종(출시 빌드 대조표 전부 "일치"), 테스터 안내문, 영문 앱 액세스 문구(심사 가족·구글 계정) | STORE:§3·§8·§9, POL:7.4 | 진행 | S 2~3h | 기능 완료 | 대조표 |
| WR-06 | `/c` 페이지 문구(번호 없음·JS 꺼짐·카톡 안내 줄) | SPK:50·94, COPY:11-3·11-6#5, R-SR:L4 | 외부(카톡 실기기) | S 1h | QA-11 | 리뷰 |
| WR-07 | 메일 템플릿(인증번호 메일 제목·"가족에게도 알려 주지 마세요") production 반영본 | COPY:7절 | 불명→확인 | S 1h | US-07 | 수신 메일 캡처 |
| WR-08 | 마케팅 [대조] 문장 ↔ 출시 빌드 1:1, 건강·치매 댓글 응대 문구, D0 직전 가입 방법 문구 | MKT:posts-launch, R-MPO:①, R-MB:①4 | 미착수 | S 2h | G-CLOSED 빌드 | 대조표 |
| WR-09 | 콘텐츠 15~30일: 사진 설명·낱말(2~4음절, 첫 주 쌍자음·겹받침 제외)·회상 질문·밸런스 질문·`starter_a/b` **1~30일 전부** | WRI:2·8절, DSN:18, CNT, BFI(운영), R-DS:B | 미착수 | M 6~8h | CT-01 | 검수표 |

### 2.7 콘텐츠 (L5-C)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| CT-01 | 15~30일 사진 16장 생성(Gemini API, 계절 무관 50% 이상, 중립 규칙, 태그 season·place·era) | PHO:7·9절, BPE:#3, DEVM:#10, AST:§5, WRI:8절 | 미착수 | L 8~12h | US-11(생성 승인·비용) | 검수표 |
| CT-02 | 생성 기록(모델·날짜·프롬프트·검수자), 검수 항목에 실존 인물·상표·간판 글자·유명 건축물 | LCC:#14, DEC:286 | 진행 | S 2h | — | assets-manifest |
| CT-03 | 시드 30일분(starter 포함, `pending://` 0), 업로드는 SV-08 스크립트로, staging 반영 | CNT, DSN:18, PHO:8절 | 미착수 | M 3~4h | CT-01, WR-09, SV-08 | staging 15일차 확인 |
| CT-04 | Lyria BGM 2곡 생성·검수·OGG/AAC 1MB 이하 `res/raw`, 생성 기록, 도장 소리 출처 기록 병합 | BGM:§3·§4, AST(p7 diff), DEC:228 | 사용자 승인 대기 | S 2~3h | US-11 | 파일·기록 |
| CT-05 | 사진 장당 150KB 이하 확인·재인코딩(형식은 JPEG 유지, §5 D-13) | BGE:C | 불명→확인 | S 1h | — | 크기 표 |
| CT-06 | Gemini·Lyria 상업 이용 조건 원문 확인 기록 | BGE:D, LCC:#14, TODO:19, BOARD-gemini | 사용자 | S | — | 기록 |

### 2.8 법률·정책·스토어 (L6-L)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| LG-01 | 방침 v2.1 게시본: G1~G3 문장을 구현 사실로 정리, G4(푸시·Crashlytics 확정 행), G5(메일 업체·로그 국가), G6(P6 글자 미전송 재대조), G7(본인 확인 방법), 자리표시 0, 남은 검토 요청 1~6, 이벤트 기기 가명값·14개월, Install Referrer·초대 번호 기기 저장 한 줄, Supabase 하위 처리자 한 줄, 저장 암호화·Pro 접속 기록 보관 확인 | SITE:privacy 머리·말미, LCC:§2·§3, R-PD:PD4~PD10, R-S19:R3, R-MPO:①MP5, BEJ:정책, R-MPR:2 | 진행 | M 5~7h | AU-05, SV-02, US-04 | 독립 정책 리뷰 |
| LG-02 | 약관 v1 게시본: 자리표시·검토 상자 제거, 부모님 앱 밖 삭제 경로 문구를 삭제 안내 v2.1과 맞춤, 만 14세 문장 통일 | SITE:terms, LCC:#3·#19 | 진행 | S 2~3h | US-04 | 리뷰 |
| LG-03 | 삭제 안내 v2.1 게시본: G7(§5 Q-07), 메뉴 이름 출시 빌드와 대조 | SITE:delete, R-BO:BO4 | 진행 | S 1~2h | US-04 | 대조 |
| LG-04 | 변호사/KISA 질문 패킷 송부(P1 1~10 + 추가 2건) → 회신 반영 | LQ:P1·추가, BDM:§4-5, R-FS:FS14, BO:§5, R-BO:BO5 | 사용자·외부 | 팀 S 1h | US-13 | 회신 반영 기록 |
| LG-05 | 데이터 보안 양식 최종(Kakao·Google SDK 전송분, Firebase 공개 문서, AD_ID 실측), IARC·대상 연령 18+·건강 앱·광고·앱 액세스 | STORE:§4~§8·§10, R-MPR:8, R-PD:PD11, POL:7.3 | 진행 | S 3h | AU-05 | 콘솔 입력 초안 = 실측 |
| LG-06 | 동의 문구 ↔ 자녀 노출 1:1 대조표 + 금지어 grep(출시 게이트) | BDM:§1 A·H, MP:①, LCC:#2 | 미착수 | S 2h | 기능 완료 | 대조표 |
| LG-07 | 앱 안 고지 위치(in-app-notices 1~4절) 전 행 반영 점검 | LN | 진행 | S 1~2h | AP-06, AU-07 | 점검표 |
| LG-08 | 내부관리계획 1쪽, 관리자 접근 기록 방법(Studio 수기 대장), 콘솔 MFA 목록 | LCC:#6, DEC:286, BO:§2 | 미착수 | S 2h | — | 문서 |
| LG-09 | 카카오톡 채널 "(광고)" 표기·수신 거부 필요 여부, 문의 채널 방침 반영 | R-MPO:①MP4·MP10, MKT:guardrails | 미착수 | S 1h | — | 기록 |
| LG-10 | AI 기본법 의무 주체·첫 화면 AI 표시 제거(질문 11), 광고성 알림(질문 1) 회신 → 공개 전 반영 | LQ:P1#1·P2#11, R-FS:FS14, LCC:#10·#13 | 외부 | — | LG-04 | 회신 |
| LG-11 | 상표 KIPRIS 결과 → 이름·아이콘 동결 판단 | LCC:#16, MP:§4, BGE:D, TODO:23 | 사용자 | — | US-14 | 결과 캡처 |
| LG-12 | 테스터 모집 고지(거부 권리·보관 기간 날짜), 테스트 종료 후 명단 삭제 약속 | LCC:§2-2, STORE:§9.1, MKT:guardrails | 진행 | S 1h | — | 리뷰 |

### 2.9 QA (L6-Q)

| ID | 항목 | 출처 | 상태 | 크기 | 의존 | 검증 |
|---|---|---|---|---|---|---|
| QA-01 | 웨이브마다 에뮬레이터 E2E(§3.6): Maestro 흐름 + 폭 320/360/412 × 100/150/200%, 동작 줄이기, 다크(라이트 고정) | 사용자 요구, MP:§1-4 | 루프 | 웨이브당 S 2~3h | AU-12 | 결과 표 |
| QA-02 | 실기기 매트릭스: 전 화면 360·100% + 320·200% + TalkBack(U+2060 읽기), 캡처 → DZ-01 | MP:§1, COV:§0, PLB:E1·E2, SWP, QCH, QCM, QPA, QFS, QFR | 미착수 | L 12~16h | 기능 완료 | device-review 캡처 |
| QA-03 | 키보드 3종(삼성 천지인·두벌식·Gboard): 조합·추천 낱말·자동 띄어쓰기·입력칸 가림·겹받침 순간 빈칸·Hermes normalize | R-P68:14·재검토, IMPL:#1, GREP:KeyboardStep:236·237, R-DS:B | 미착수 | M 3~4h | — | 기록 |
| QA-04 | 오디오 실기기 8항목(한국어 음성·덕킹·무음·유튜브·이어폰·전화·TalkBack·APK 크기·오디오 포커스) | AUD:48~56 | 미착수 | M 3h | AP-02~04 | 기록 |
| QA-05 | 원격 2대 E2E(흐름 1~5, 재연결 P11, 형제 2명, 삭제 범위), 15일차 순환, 자정 경계, 비행기 모드(첫 실행·코스 중), 오프라인 로그아웃 | COV:FLOW·P11·§4, DAN:41·42, PLB:D2, RPL:U19, SMK:재스모크, MP:⑥b | 미착수 | M 4~6h ×2회 | US-09(폰 2대) | 기록 |
| QA-06 | 소셜 로그인 실기기(카카오 두 키 `aud`·구글·이메일 OTP·OTP 자동 채움), staging → production | DAN:102·183, TODO:28, S08:R1·R2, SMK:3', R-SL:SL3 | 미착수 | S 2~3h | US-12 | 기록 |
| QA-07 | 푸시 실기기: 허용·거절·나중에, 08~21 창, 탭 라우팅, 알림 거부 기기의 Firebase 설치 ID 생성 여부 | QAM:게이트7, STORE:§10-2 | 미착수 | S 2~3h | AU-04, SV-02 | 기록 |
| QA-08 | qa.md 출시 게이트 갱신(연속일 기준 제거, `npm run verify` 대신 실제 명령 묶음) 후 13개 수행 | QAM:2절·7절 | 미착수 | S 2h + 수행 | — | 게이트 표 |
| QA-09 | 릴리스 빌드 스모크(콜드 스타트 크래시 0 ×10, 성능 측정 AU-17 확인) | QAM:2절, QFR | 미착수 | S 2~3h | — | 기록 |
| QA-10 | 기존 실기기 미확인 일괄: popTo Connect, 키보드 회피·dock 상한, connect live region, 3버튼 내비 키패드 스크롤, P16·CheerDialog 포커스, 360×780 위 여백, 첫 화면 150·200% 둘째 버튼·색 원 밝기, StepRow 기준선, Dialog 150·200%, 스플래시 OEM 크기, 내비 바 테마, svg Fabric 렌더, 모션 체감·회전, 상태바·다크, 첫 화면 사진 묶음, 런처 아이콘, Android 자동 백업으로 복원된 세션 동작, 캡처 시 헤드업 알림·개인 화면 삭제(OPS 캡처 관문) | DEVM:9#7, OPS, R-RS:RS8·RS9, R-B:B15, R-DSC:D8, R-CE:CE3·CE6, R-P68:P16·P18, R-QAF:Q7, R-FS:FS2·FS6, R-DS:DS7, R-CH:CH23, R-U0:13, DAN:107·114·125·132·152·231·237·246·266, QFR, SWP | 미착수 | M 6~8h | — | 체크표 |
| QA-11 | Install Referrer 6단계(내부 트랙), 카톡 인앱 intent 실기기 2건 → "자동 채움" 홍보 허용 여부 | SPK:12·16·74~84, DEC:326 | 외부(Play 업로드) | S 2h | G-INT | 기록 |
| QA-12 | 어르신 3가구 관찰·자녀 3명 질문(사용자 진행, QA 관찰표 제공) | MP:⑥b, BFI:검증, R-UX:§5, R-UX2:R2-4, TODO:11·20, BDM:§4-7 | 사용자 | 팀 S 2h | — | 관찰 기록 |
| QA-13 | 불안정 테스트 원인(소셜 1회차, P7 부하) | R-SL:SL11, R-P7:L6 | 미착수 | S 2h | — | 반복 실행 20회 초록 |

### 2.10 PM·리드 (오케스트레이터)

| ID | 항목 | 출처 | 상태 | 크기 |
|---|---|---|---|---|
| PM-01 | 마이그레이션 번호 발급·대장, 합치기 순서 집행(§3.3·§3.4) | ARCH:§3, MP:대장 | 지속 | — |
| PM-02 | 병합된 워크트리·브랜치 정리(`worktree-agent-*`, child-ease-joy, p3-course-home-v4, spike) | GIT | 미착수 | S 0.5h |
| PM-03 | `.claude/progress.md`·DECISIONS 갱신(이 문서 §5 결정 일괄, "열람은 공통 순환", db-push ref 예외, 별칭 제거 일정) | 사용자 CLAUDE.md, R-SP:SP5, R-ARC:A18, R-DSC:D14 | 미착수 | S 1h |
| PM-04 | 낡은 문서 정리: REPO 계약 목록, qa.md 게이트, assets-manifest, 10-master-plan 머리에 "13으로 대체" 표시 | REPO, AST, QAM | 미착수 | S 2h |
| PM-05 | 웨이브마다 구성·흐름 개선 회의(§3.6) | 사용자 요구, OPS | 루프 | 웨이브당 S 1h |
| PM-06 | 빌드 2 백로그 문서(§1.2 목록 + 각 보드의 빌드 2 항목, 부모님 먼저 대비 번호 화면 역할 비종속 확인, 넘어가기 비율 50% 초과 시 P6 재설계 기준, 형제 시나리오, 호칭 RPC 폐기) | COV:C10, BFI, BPE, BEJ:E, BGE, PLB:G, DEC:159, R-DS:B | 미착수 | S 1~2h |
| PM-07 | 운영 06시 루틴 문서(지표 스니펫 SV-16 실행, 재고 경보, 삭제 요청 대장, Studio 수기 대장) | BO:§1·§2, R-BO:BO7 | 미착수 | S 2h |

### 2.11 사용자 몫 — §4.3 체크리스트에 모음(US-01~US-24).

---

## 3. 병렬 실행 설계

### 3.1 레인(동시 최대 6)

| 레인 | 이름 | 소유 파일(이 레인만 수정) | 주 담당 ID |
|---|---|---|---|
| **L1** | 서버 | `supabase/**`, `scripts/db-push.sh`, `scripts/gen-types.sh`, `scripts/photos/**`(업로드 게이트), `docs/team/dev-server-notes.md` | SV-* |
| **L2** | 앱 어르신 | `app/src/features/{course,account(ParentSettings·Delete*),family,link(ConnectScreen·ConsentScreen·CodeEntry)}`, 새 `features/history`(P15), 해당 `__tests__` | AP-* |
| **L3** | 앱 자녀 | `app/src/features/{child,home}`, 해당 `__tests__` | AC-* |
| **L4** | 앱 공용·인프라 | `app/src/{ui,lib,api,shared,state,navigation}`, 새 `app/src/{audio,push}`, `app/android/**`, `app/package.json`·lock, `app/env/*`, `scripts/build-*.sh`, `site/c/**`, `site/.well-known/**`, `.maestro/**`, `docs/team/RELEASE.md` | AU-* |
| **L5** | 디자인·라이터·콘텐츠 | `docs/design/**`, `design-system/**`, `docs/team/copy.ko.json`(**원본**)·`copy-v3-confirmed.md`, `content/**`, `docs/team/assets-manifest.md` | DZ-*, WR-*, CT-* |
| **L6** | QA·법률·스토어 | `docs/team/{qa,legal,store}/**`, `docs/team/qa.md`, `site/drafts/**` → 게시본 `site/{index,delete-account,terms}.html`, `device-review/**`(캡처) | QA-*, LG-* |
| 리드 | 오케스트레이터 | `DECISIONS.md`, `.claude/progress.md`, `docs/plans/**`, 앱 사본 `app/src/copy/copy.ko.json`(동기화만), `app/src/app/{AppRoot,ParentStack,ChildStack}.tsx` 병합 | PM-* |

### 3.2 공용 파일 규칙(충돌 방지)
- **`ui/tokens.ts`**: L4 소유. 다른 레인은 새 토큰이 필요하면 PR 메모에 "토큰 요청(이름·값·근거 시안)"을 적고 화면에서는 임시로 가장 가까운 기존 토큰을 쓴다. L4가 같은 웨이브 첫 합치기 창에 넣고, 요청 레인이 다음 창에 교체한다. 헥스·숫자 직접 사용 금지(ARCH §6).
- **`copy.ko.json`**: 원본 `docs/team/copy.ko.json`만 수정. **새 키 추가는 자기 네임스페이스에 append만**(L2: `course.* consent.* settings.* history.* bgm.* tts.* family.*`, L3: `child.* home.* login.* paid.* relation.*`, L4: `push.* common.* app_info.* oss.*`). **기존 키 문구 변경은 L5 라이터만.** 앱 사본은 리드가 합칠 때 `sync-copy.sh`(AU-08)로만 덮어쓴다. 같은 키를 두 레인이 건드리면 리드가 라이터 결정으로 해결.
- **`ParentStack`·`ChildStack`·`AppRoot`**: 레인 브랜치에서는 **새 화면 등록 한 줄(라우트 + 파라미터 타입)만** 허용, 구조 변경 금지. 리드가 합치기 순서대로 붙인다. AU-10(4단계) 동결 창에는 모든 앱 레인이 이 파일과 import 경로를 건드리지 않는다.
- **`app/package.json`·`build.gradle`·`AndroidManifest`**: L4만. 다른 레인은 의존성 요청을 리드에게(정확 버전·2주 이상 된 버전·근거).
- **`DECISIONS.md`·`progress.md`·`docs/plans`**: 리드만. 레인은 PR 메모의 "결정 필요" 절에 적는다.
- **`site/`**: 초안·게시본은 L6, `site/c`·`.well-known`은 L4. 게시는 사용자(호스팅 계정).

### 3.3 합치기 순서·주기
- **주기**: 하루 2번 합치기 창(오전·저녁, 리드). 그 사이 레인은 자기 브랜치에서 main을 rebase만.
- **순서(한 창 안)**: ① L1 서버(마이그레이션 + pgTAP) → ② 리드: `gen-types` 재생성·커밋 → ③ L4 공용(계약·토큰·컴포넌트·의존성) → ④ L2·L3(서로 독립, 순서 무관) → ⑤ 리드: 문구 사본 동기화 → ⑥ L5·L6 문서.
- **합치기 전 필수**: ARCH §9 체크리스트 + `tsc --noEmit`·`npm run lint`·`npm test -- --maxWorkers=2`·(서버·계약 변경 시) pgTAP·`test:integration` 결과 첨부 + §3.5 리뷰 통과 문서.
- **계약 순서**: 서버가 먼저 main에 들어간 뒤 앱이 그 시그니처로. 서버보다 앱이 먼저면 `api/contract/<도메인>.ts` 한 파일에 `// ASSUMED(00NN)`(ARCH §5).

### 3.4 마이그레이션 번호 배정
- 현재 main 0031까지. 리드가 착수 시점에 아래처럼 **잠정 발급**한다.

| 번호 | 내용 | ID |
|---|---|---|
| 0032 | push_tokens(등록·해제 RPC) | SV-01 |
| 0033 | push_daily(대상 선정 함수·발송 기록·cron, notification_queue 소비) | SV-02·SV-03 |
| 0034 | events_build1(C6·B1·전환 분모·push 이벤트) | SV-04 |
| 0035 | security_followups(content revoke·consent default·버킷 주석·호칭 RPC 정리) | SV-05 |
| 0036 | admin_delete_audit(공통 삭제 함수·admin RPC·admin_audit·content_runway) | SV-07 |
| 0037~ | 비공개 테스트 중 수정분(P2·P3 묶음) | — |

- 규칙: ① **빈 번호 예약 금지·연속**(ARCH §3). ② 잠정 번호는 **main 병합 시 확정**. 앞 번호 작업이 취소·지연되면 뒤 작업은 병합 전에 번호를 당긴다(파일명·down·test 이름 함께). ③ **staging에 push된 번호는 절대 바꾸지 않는다**(고칠 땐 새 마이그레이션). ④ L1은 한 에이전트가 순서대로 처리해 같은 번호를 두 브랜치가 쓰지 않게 한다. ⑤ Edge Function은 번호가 없으므로 `supabase/functions/<이름>`으로, secrets 이름은 dev-server-notes에 기록.
- 원격 반영: staging = 각 웨이브 관문에서 사용자 실행(`scripts/db-push.sh staging`). production P1 = G-INT 직전 1회(0001~0036 + 시드 30일 + 사진), 이후 P2·P3 묶음.

### 3.5 리뷰 관문
- **작성자 ≠ 검토자**(OPS 팀 리뷰 관문). 검토자는 다른 에이전트, 관점 3개(놓침·부족·과함), 결과는 `docs/team/reviews/<날짜>-<주제>.md`, 높음 0이어야 병합. 수정 뒤 **재검토**는 같은 검토자.
- **`/code-review xhigh`(위험 영역)**: 인증·세션(AU-01, AC-07), 데이터 저장·삭제·동의(SV-05, SV-07, AP-14), 푸시 발송·토큰(SV-01~03, AU-04), Edge Function·secrets(SV-02, SV-06), env·서명·번들(AU-01, AU-14, AU-20), Install Referrer(AU-13).
- **`/code-review high`**: 그 밖의 모든 코드.
- **디자인 QA**: 화면 코드는 시안 담당 디자이너가 실기기 캡처로 승인(DZ-01). 승인 없으면 "완료"가 아니라 "개발 완료".
- **문구**: 새 키·변경은 라이터 리뷰, 법적 고지 문구는 법률 리뷰 추가.
- **정책 문서**: 작성자(정책·라이터) ≠ 검토자(법률팀 관점 에이전트).
- **출시 관문(G-INT 전)**: `/code-review high` 전체 diff(마지막 출시 기준 이후) + xhigh 영역 재확인.

### 3.6 지속 개선 루프(웨이브마다 필수)
| 루프 | 언제 | 누가 | 산출 |
|---|---|---|---|
| **PM 구성·흐름 개선 회의** | 각 웨이브 시작 전 30분 + 종료 회고 30분 | 리드(PM) + 각 레인 대표 1줄 보고 | `docs/team/pm/wave-<n>-retro.md`: 막힌 곳, 레인 재배치, 다음 웨이브 조정, 이 문서 갱신 |
| **디자인 UX 개선 감사** | 웨이브 중간(기능이 에뮬레이터에 올라온 직후) | 시안을 만들지 않은 디자이너(UX 감사관) | `docs/design/v3/_qa/<날짜>-wave<n>-ux.md`: 놓침·어색함·우아함, "빼도 되는 것". 동결 화면은 리드 승인 시에만 반영 |
| **QA 에뮬레이터 E2E** | 웨이브 종료 관문 직전 | QA(L6) | `docs/team/qa/<날짜>-wave<n>-e2e.md`: Maestro 결과 + 폭·배율 매트릭스 + 회귀 목록 |

### 3.7 웨이브 계획 (목표일은 처리량 16~24h/일 가정, 실기기·사용자 몫은 평일 월·수·금)

#### Wave 0 — 정리와 토대 (목표 11/18~11/19)
- 시작 조건: 이 문서 승인(리드).
- L1: SV-10 gen-types, SV-09 준비(로컬 재생 검증), SV-14 production Auth 체크리스트, SV-01 착수.
- L2: AP-01 p7-motion 재검토 → 병합.
- L3: AC-06 날짜·기본값 정리, AC-05 이벤트 확인.
- L4: AU-01 dev-menu H1 수정 → xhigh 재검토 → 병합, AU-08 아키텍처 1단계, AU-12 Maestro 하네스 착수.
- L5: WR-01 문구 정리 묶음, DZ-06 B1 시안 확인, DZ-04 미결 판단, CT-01 프롬프트 16개 작성(생성은 승인 후).
- L6: QA-08 게이트 갱신, LG-04 변호사 패킷 정리(송부는 사용자), LG-08 내부관리계획.
- 리드: PM-02·PM-03(이 문서 §5 결정 DECISIONS 기록), PM-05 회의.
- **완료 관문 W0**: p7-motion·dev-menu main 병합, 문구 `_status` 미확정 0, sync-copy·gen-types 동작, Maestro로 흐름 1개 에뮬레이터 통과, 사용자 몫 W0 목록 전달.

#### Wave 1 — 기능 완성 A: 푸시·오디오·설정·자녀 (목표 11/19~11/23)
- 시작 조건: W0 관문, US-10 Firebase(없으면 AU-02·AU-04는 fake 토큰으로 진행하고 실수신은 W2로).
- L1: SV-01 → SV-02 → SV-04 → SV-05.
- L2: AP-02 도장 소리, AP-03 읽어 주기, AP-05 B1, AP-08, AP-09.
- L3: AC-01 C6, AC-02 호칭 겹침, AC-04(권한 상태는 AU-04 계약에 ASSUMED).
- L4: AU-03 오디오 모듈(먼저), AU-02, AU-04, AU-06, AU-07(값은 자리 상수).
- L5: WR-02·WR-03·WR-04, DZ-05, CT-02, CT-01(승인 시 생성).
- L6: LG-01·LG-02·LG-03 게시본 초안(값 제외 완성), LG-12, QA-03 키보드 3종(기존 P6), QA-10 일괄 1차.
- 루프: UX 감사(P12/N1·C6·TTS 상태), 에뮬레이터 E2E 2차.
- **완료 관문 W1**: 위 ID 코드 병합(리뷰 통과), pgTAP·jest·통합 초록, staging에 0032~0035 반영(사용자), 에뮬레이터 E2E 결과에 높음 0.

#### Wave 2 — 기능 완성 B: BGM·지난 날·알림 연결·운영·계약 (목표 11/23~11/27)
- 시작 조건: W1 관문, CT-04 음원(없으면 AP-04는 무음 자리 파일로 개발, 음원은 교체만).
- L1: SV-03, SV-06, SV-07, SV-08, SV-11, SV-12, SV-13, SV-15, SV-16.
- L2: AP-04 BGM, AP-06 P13 v2, AP-07 P15, AP-10, AP-11, AP-12, AP-13, AP-14.
- L3: AC-03 N3, AC-04 마무리, AC-07, AC-08.
- L4: AU-05 Crashlytics, AU-09 계약 3단계, AU-11, AU-13, AU-15, AU-16, AU-18, AU-19; 끝에 **AU-10 동결 창(반나절, 다른 앱 레인 대기)**.
- L5: WR-09 + CT-03 30일 시드, CT-05, DZ-07·DZ-08·DZ-09·DZ-10·DZ-11.
- L6: LG-05 데이터 보안(매니페스트 실측 후), LG-07, QA-04 오디오(실기기), QA-07 푸시(실기기).
- 루프: UX 감사(BGM·P15·P13 v2), 에뮬레이터 E2E 3차.
- **완료 관문 W2 = 기능 동결(Feature freeze)**: §1.1 G-INT "기능" 칸 전부 코드 완료, lint 레이어 error 0, 계약 검증 100%, staging 0036까지·30일 콘텐츠 반영.

#### Wave 3 — 품질 패스: 접근성·디자인 QA·보안·문서 (목표 11/27~12/03)
- 시작 조건: W2 기능 동결. 이후 새 기능 금지, 수정만(리드 승인).
- L1: 리뷰 지적 수정, SV-09 원격 확인(staging), SV-17 대장.
- L2·L3: QA·디자인 QA 지적 수정 전담(각 레인 자기 화면).
- L4: AU-14(도메인 정해지면), AU-17 성능, AU-20, 보안 지적 수정, 전체 `/code-review high` + xhigh 영역 재확인 지원.
- L5: DZ-01 디자인 QA 승인(전 화면), DZ-03 스토어 그래픽(승인 화면으로), WR-05 스토어 문구.
- L6: QA-02 실기기 매트릭스, QA-05 원격 2대 E2E 1회차, QA-06, QA-09, QA-10 2차, QA-13, LG-06 대조표, LG-01~03 게시본 확정(사용자 값 들어오면).
- 루프: UX 감사(전 화면 최종), 에뮬레이터 E2E 4차(회귀).
- **완료 관문 W3**: §1.1 G-INT 전 칸 체크(디자인 QA 핵심 흐름 승인, 보안 리뷰 통과, 방침 게시 준비 완료).

#### Wave 4 — 출시 준비 → 내부 테스트 (목표 12/03~12/06)
- 시작 조건: W3 관문 + 사용자 몫 US-01~US-08·US-10·US-15 완료.
- 사용자: production 프로젝트 생성·`production.env`·`db-push.sh production`(P1)·시드·사진 업로드·Auth 설정(SV-14 체크리스트)·Firebase prod·SMTP·`build-production.sh`·내부 트랙 업로드·앱 서명 SHA-1/256을 카카오·구글·assetlinks에.
- L1: production dry-run 출력·백업 덤프 확인, pg_cron 첫 실행 확인, 심사 가족 생성 리허설(SV-15).
- L4: AU-14 assetlinks 게시 확인, release 번들 grep, 버전 기록(`release-versions.txt`).
- L6: production 스모크(로그인 3종·연결·코스·푸시·크래시 수집·삭제), QA-11 Install Referrer, LG-05 콘솔 입력 초안 최종.
- **완료 관문 G-INT**: 내부 테스트 설치·스모크 통과, Crashlytics 수신, 푸시 수신, 30일 콘텐츠 production 확인.

#### Wave 5 — 비공개 테스트(14일) 운영 (목표 12/06~12/20, 14일 요건 적용 시)
- 시작 조건: §1.1 G-CLOSED 전 칸(전 화면 디자인 QA 승인, 방침·약관·삭제 안내 게시, 콘솔 입력 완료, 테스터 12~20명 옵트인).
- 매일: 리드 06시 루틴(PM-07: 지표·크래시·푸시 실패·재고·문의), 결함 분류(치명=당일, 높음=다음 업데이트).
- 주 1~2회 업데이트 빌드(main에서만, versionCode 증가), production P2·P3 마이그레이션 묶음(사용자).
- QA-05 2회차, QA-12 어르신 3가구 관찰(사용자), WR-08 마케팅 대조, LG-10 회신 반영.
- 루프: 웨이브 회고를 주 1회로.
- **완료 관문 G-PUB**: §1.1 G-PUB 전 칸, 14일·12명 충족 확인, 프로덕션 신청 답변 준비.

#### Wave 6 — 공개 신청·출시 후 2주 (목표 12/20~)
- 사용자: 프로덕션 신청·심사 대응. 팀: 심사 거절 대응 빌드, 출시 후 크래시·지표 매일, 빌드 2 착수 회의(PM-06).

---

## 4. 체크리스트

### 4.1 웨이브·레인별 체크박스
(각 칸은 §2 ID. 완료 = 코드 병합 + 리뷰 문서 + 해당 검증 기록.)

**Wave 0**
- [ ] L1: SV-10 · SV-14 · SV-09(로컬) · SV-01 착수
- [ ] L2: AP-01 재검토·병합
- [ ] L3: AC-05 · AC-06
- [ ] L4: AU-01(xhigh 재검토·병합) · AU-08 · AU-12 착수
- [ ] L5: WR-01 · DZ-04 · DZ-06 · CT-01 프롬프트
- [ ] L6: QA-08 · LG-04 패킷 · LG-08
- [ ] 리드: PM-02 · PM-03 · PM-05 회의 · 사용자 몫 W0 전달
- [ ] 관문: 브랜치 2개 병합 · `_status` 미확정 0 · Maestro 1흐름 초록

**Wave 1**
- [ ] L1: SV-01 · SV-02 · SV-04 · SV-05 (pgTAP 첨부)
- [ ] L2: AP-02 · AP-03 · AP-05 · AP-08 · AP-09
- [ ] L3: AC-01 · AC-02 · AC-04(부분)
- [ ] L4: AU-03 · AU-02 · AU-04 · AU-06 · AU-07
- [ ] L5: WR-02 · WR-03 · WR-04 · DZ-05 · CT-02 · CT-01(생성)
- [ ] L6: LG-01~03 초안 · LG-12 · QA-03 · QA-10(1차)
- [ ] 루프: 회의 · UX 감사 · 에뮬레이터 E2E
- [ ] 관문: staging 0032~0035(사용자) · 높음 0

**Wave 2**
- [ ] L1: SV-03 · SV-06 · SV-07 · SV-08 · SV-11 · SV-12 · SV-13 · SV-15 · SV-16
- [ ] L2: AP-04 · AP-06 · AP-07 · AP-10 · AP-11 · AP-12 · AP-13 · AP-14
- [ ] L3: AC-03 · AC-04 · AC-07 · AC-08
- [ ] L4: AU-05 · AU-09 · AU-11 · AU-13 · AU-15 · AU-16 · AU-18 · AU-19 · AU-10(동결 창)
- [ ] L5: WR-09 · CT-03 · CT-05 · DZ-07 · DZ-08 · DZ-09 · DZ-10 · DZ-11
- [ ] L6: LG-05 · LG-07 · QA-04 · QA-07
- [ ] 루프: 회의 · UX 감사 · 에뮬레이터 E2E
- [ ] 관문(기능 동결): staging 0036·30일 콘텐츠 · lint error 0 · 계약 검증 100%

**Wave 3**
- [ ] L1·L2·L3: 리뷰·QA 지적 수정 0건 남김
- [ ] L4: AU-14 · AU-17 · AU-20 · 전체 `/code-review high` + xhigh 재확인
- [ ] L5: DZ-01(전 화면) · DZ-03 · WR-05
- [ ] L6: QA-02 · QA-05(1회) · QA-06 · QA-09 · QA-10(2차) · QA-13 · LG-06 · LG-01~03 확정
- [ ] 루프: 회의 · UX 감사(최종) · 에뮬레이터 E2E(회귀)
- [ ] 관문: §1.1 G-INT 전 칸

**Wave 4**
- [ ] 사용자 몫 US-01~US-08 · US-10 · US-15 완료
- [ ] production P1 push(사용자) · dry-run·백업 확인(L1)
- [ ] 시드 30일 · 사진 업로드 · Auth 설정 대조(L1)
- [ ] AAB 빌드·업로드(사용자) · 버전 기록(L4)
- [ ] SHA-1/256 연쇄(사용자) · assetlinks 게시 확인(L4)
- [ ] production 스모크 · QA-11(L6)
- [ ] 관문 G-INT

**Wave 5**
- [ ] §1.1 G-CLOSED 전 칸 · 테스터 옵트인 12명 이상
- [ ] 매일 06시 루틴 · 주 1회 회고
- [ ] QA-05 2회차 · QA-12 · WR-08 · LG-10
- [ ] 관문 G-PUB

### 4.2 출시 전 최종 체크리스트 (G-INT 업로드 직전 + G-CLOSED·G-PUB에서 다시)
**빌드**
- [ ] main, 작업 트리 깨끗, `origin/main`과 같은 커밋(원격 저장소 US-02)
- [ ] `npm ci`(잠금 파일 그대로) · `tsc --noEmit` · `npm run lint` · `npm test` · `test:integration` · pgTAP 전부 초록, 결과 첨부
- [ ] `scripts/build-production.sh` 성공(서명 설정·production.env·versionCode > 기록)
- [ ] release 번들 grep: 테스트 비밀번호·`sb_secret_`·service_role·`devTestChild`·localhost·10.0.2.2 0건
- [ ] 병합 매니페스트 권한 = `INTERNET`·`POST_NOTIFICATIONS`·(Crashlytics·FCM 필수분)만, `AD_ID`·위치 0
- [ ] 콜드 스타트 크래시 0 ×10, AAB 크기 기록
**서명·버전**
- [ ] 업로드 키 = 카카오·구글에 등록한 키, 키스토어는 저장소 밖(`~/keys/bumojasik/`), 백업 2곳
- [ ] versionName 1.0.0, versionCode 기록 `release-versions.txt` 커밋
- [ ] Play 앱 서명 키 SHA-1 → 구글 Android 클라이언트·카카오 키 해시, SHA-256 → assetlinks
**env·원격 DB**
- [ ] `production.env`: ref·URL·publishable·카카오 production 키·구글 웹 클라이언트·`APP_LINK_HOST`, `API_MODE=real`
- [ ] production Supabase: 0001~최신 push(dry-run 출력 확인·스키마 백업), 시드 30일, 사진 30장, pg_cron 등록·첫 실행 성공
- [ ] Auth: 익명 ON·한도, Kakao "Allow users without an email", Client ID, Google provider, OTP 6자리 600초, 템플릿, SMTP(전용), Redirect URI, 유출 비밀번호 보호
- [ ] Edge Function secrets(FCM 서비스 계정, 카카오 Admin 키) production에 설정
- [ ] advisors 경고 0(의도한 익명 로그인 제외)
- [ ] Pro 요금제·일 백업 확인
**스토어 등록 정보**
- [ ] 앱 이름·짧은 설명·자세한 설명(대조표 전부 "일치", 금지 키워드 0, "의료기기 아님", AI 고지)
- [ ] 카테고리 라이프스타일, 태그, 연락처 메일, 방침 URL
- [ ] 아이콘 512 · 피처 1024×500 · 스크린샷 4~8(첫 화면 AI 표기)
**정책 게시·양식**
- [ ] 방침·약관·삭제 안내 게시(자리표시 0, 시행일, 사업자 정보 5곳 일치), URL 200 응답
- [ ] 데이터 보안 양식 = 실측(SDK 전송분, Crashlytics, FCM, 이벤트)
- [ ] 콘텐츠 등급(IARC) · 대상 연령 18+ · 광고 없음 · 광고 ID 아니오 · 건강 앱 "기능 없음" · 정부·금융·뉴스 아니오
- [ ] 계정 삭제 URL · 앱 안 삭제 경로 설명
- [ ] 앱 액세스: 심사 가족 enable·연결 수 상한·심사용 구글 계정(2단계 끔) 연결 완료, 영문 안내
- [ ] 구글 OAuth 동의 화면 "앱 게시", 카카오 앱 일반 사용자 로그인 가능 확인, 카카오 콘솔 방침 URL
**운영**
- [ ] Crashlytics production 수신, 푸시 발송 기록 쿼리, 지표 스니펫, 삭제 요청 처리 대장·메일함
- [ ] 테스터 명단·안내문 발송, 문의 채널 응답 담당

### 4.3 사용자 몫 체크리스트 (계정·비용·비밀·되돌릴 수 없는 작업)
| ID | 할 일 | 종류 | 필요한 웨이브 | 출처 |
|---|---|---|---|---|
| US-01 | Play Console 본인 확인 4항목, 계정 유형(개인/조직)·생성일 → 12명·14일 요건 확정, 테스트 중 빌드 업데이트가 14일 계산에 영향 주는지 확인 | 계정 | W0 | TODO:1·24, MP:§4, STORE:U-4 |
| US-02 | 비공개 원격 저장소 생성·푸시(백업), keystore·DB 비밀번호 분리 백업 | 비밀·백업 | W0 | TODO:17·백업, REPO, R-MPR:13 |
| US-03 | 도메인·호스팅 결정(방침·약관·삭제 안내·/c·assetlinks), staging 서브도메인 | 비용·계정 | W1 | PROG, SPK:91, TODO:7 |
| US-04 | 운영자 정보: 상호·대표·사업자번호·주소·문의 메일(전용)·보호책임자·시행일 | 공개 정보 | W1 | LCC:#7·#21, STORE:U-1·U-2, SITE |
| US-05 | staging `db-push.sh staging`: 0031 → (W1) 0032~0035 → (W2) 0036, 시드·사진 | 원격 DB | 매 웨이브 | DEC:243, MP:대장 |
| US-06 | production Supabase(서울) 생성 + Pro 결제, DB 비밀번호 | 비용·비밀 | W3 말 | ENV:Q1~Q3, MP:§4 |
| US-07 | production SMTP 업체 결정·계정(발송 한도·도메인 인증) → 업체 법인명·국가 방침에 | 비용·계정 | W2 | ENV:§3, LCC:§3, R-C:C4 |
| US-08 | production Auth 설정 실행(SV-14 체크리스트), Advisors 확인 | 원격 | W4 | REL:§9 |
| US-09 | 폰 2대(평일 월·수·금 USB), 저가 안드로이드 1대 가능 여부 | 장비 | W1~ | MP:§1, RPL:§5 |
| US-10 | Firebase 2개(staging·prod) 생성, `google-services.json` 2개 전달(저장소 밖), FCM 서비스 계정 키 → 각 Supabase secrets | 계정·비밀 | **W1 초** | ENV:§3, TODO:13 |
| US-11 | Gemini 사진 16장 생성 비용 승인, 기존 14장 사용자 검수, Lyria 2곡 생성 승인·비용, 상업 이용 조건 확인 | 비용 | W1 | BGM:§3, PHO:8절, TODO:19 |
| US-12 | 카카오 staging 네이티브 키 추가·키 해시, 구글 staging 웹·Android 클라이언트, 카카오 Admin 키(서버 unlink용) → secrets | 계정·비밀 | W1 | REL:§6, ENV:§3, R-ENV:M2 |
| US-13 | 변호사/KISA(118) 상담 여부·비용 결정, 질문 패킷 송부 | 비용·외부 | W0~W1 | LQ, BDM:§4-5 |
| US-14 | KIPRIS 9·41·42·45류 "가화만사성" 검색 → 결과 공유 | 외부 | W1 | LCC:#16, TODO:23 |
| US-15 | Play 앱 만들기(패키지명 `com.bumojasik.app` 확정 — 이후 변경 불가), 앱 서명, 내부 테스트 트랙 | 되돌릴 수 없음 | W4 | DEC:117, TODO:8 |
| US-16 | 노출된 staging secret 키 교체, dev-menu 이전 staging APK 배포 이력 있으면 테스트 계정 비밀번호 교체 | 비밀 | W0 | TODO:25, R-DM:H1-4 |
| US-17 | 모든 콘솔 MFA(Supabase·Google Cloud·Firebase·Kakao·Play·도메인) | 보안 | W1 | LCC:#6, DEC:286 |
| US-18 | `production.env` 작성(공개 값), `~/.gradle/gradle.properties` 서명 4값 | 비밀 | W4 | REL:§5·§8 |
| US-19 | production `db-push.sh production`(P1), 이후 P2·P3 | 되돌릴 수 없음 | W4·W5 | ENV:§4, MP:대장 |
| US-20 | AAB 업로드·트랙 출시, 콘솔 입력(등록정보·데이터 보안·등급·연령·건강·앱 액세스·삭제 URL) | 외부 공개 | W4~W5 | STORE, TODO:9·10 |
| US-21 | 심사용 구글 계정(2단계 끔) 생성 → 심사 가족 연결(prod), 심사 번호 enable/disable | 계정·비밀 | W4 | STORE:§8, DSN:118 |
| US-22 | 구글 OAuth 동의 화면 "앱 게시", 카카오 일반 사용자 공개 조건 확인, debug 키 해시 정리 | 외부 공개 | W4 | TODO:29, S08:R9, R-SL:7 |
| US-23 | 테스터 12~20명(성인) Gmail 모집·옵트인 확인, 어르신 3가구·자녀 3명 일정 | 사람 | W4~W5 | TODO:2·11·16·20, GRO:§6 |
| US-24 | 마케팅: 계정 4개·지인 명단 50명·D-7 게시물, "일부 유료 예정" 문구 확인, 프로덕션 신청 | 외부 공개 | W5~W6 | MKT, R-MB:①1 |

---

## 5. 리스크·미정 결정과 권고

### 5.1 팀 결정으로 확정(위임 원칙: 사용자 재확인 없이 채택, DECISIONS에 PM-03이 기록)
| ID | 결정 | 근거 |
|---|---|---|
| D-01 | **P15 지난 날은 빌드 1에 포함**(조건이던 라이터 #16·#17 확정 완료, 서버 0028 있음) | DEC:309·327·328, BEJ |
| D-02 | **P14 어르신 별도 화면은 만들지 않음** — 코스 홈 미연결 띠로 대체(이미 구현·동결), 시안 P14는 보관 | DEC:149, COV:P14 |
| D-03 | C5 이야기 주제 추천은 빌드 1에서 '곧 유료' 배지 행만, 내용은 빌드 2 | COV:C5, DEC:127 |
| D-04 | 크래시 모니터링은 **Crashlytics**(Firebase 재사용), `AD_ID`는 매니페스트에서 제거 | MP:U16, STORE:§5 |
| D-05 | `consent_events`는 계정 삭제 때 **함께 삭제**(최소 보관, 지운 데이터의 동의 증빙은 불필요), 변호사 질문에 추가 | DSN:98 |
| D-06 | 가정값(응원 하루 2개, 이벤트 200건/24h·14개월, 심사 상한 5, 시도 제한)은 빌드 1 그대로, 비공개 테스트 데이터로 재검토 | DSN:133, DEVM:9#3 |
| D-07 | 일일 푸시 시각 **오전 9시 고정**(08~21 창 안), 시간 선택은 빌드 2 | LCC:#10 |
| D-08 | E2E 도구는 **Maestro CLI**(앱 의존성 추가 없음, 에뮬레이터 실행, accessibilityLabel·testID로 찾기) | 사용자 요구, R-DSC:D4 |
| D-09 | 효과음은 '도장 소리' 1종, 촉각은 도장 1회만(고르기·오류 햅틱은 빌드 2) | DEC:317·310, PLB:C1·C2 |
| D-10 | 포커스 규칙: 화면에 **새로 들어오면 제목**, 뒤로 돌아오면 **떠날 때 누른 요소**로 | R-QAF:Q5 |
| D-11 | Clipboard는 RN 코어 유지(빌드 1), RN 올릴 때 교체 | R-CS:L7 |
| D-12 | R8(minify)은 빌드 1에서 **끔 유지**(크래시 심볼·회귀 위험 최소), 크기만 측정 | AU-17 |
| D-13 | 사진 형식 JPEG 유지, 장당 150KB 이하로 재인코딩만 | BGE:C |
| D-14 | 카카오 서버 unlink는 빌드 1 포함(Edge Function 인프라를 푸시와 공유) | R-SL:2, S08:R10 |
| D-15 | `preview`/`get_today_content` 본문 합치기(content_payload)는 빌드 2 | R-RS, R-SP |
| D-16 | db-push가 `app/env`에서 ref를 읽는 구조 유지(원본 하나), ARCHITECTURE에 예외 기록 | R-ARC:A18 |
| D-17 | season_cue 8칸 사진 재생성은 빌드 2(시즌 풀과 함께), 빌드 1은 재배치로 충분 | PHO:9절 |
| D-18 | 콘텐츠 30일분은 **G-CLOSED 전 필수**(14일 테스트 중 15일차 반복 방지) | WRI:8절, DEVM:#10 |
| D-19 | 아키텍처 12의 1·3·4단계는 기능 동결 전(W0~W2)에 끝낸다(5단계는 신호 올 때) | AR, DEC:278 |
| D-20 | 효과음·TTS·BGM 패키지 3종은 AUD 승인 버전 그대로 설치(리드 승인 완료로 간주) | DEC:296·341 |

### 5.2 사용자에게 물을 것(사용자 몫만)
| ID | 질문 | 팀 추천 |
|---|---|---|
| Q-01 | Play 계정이 개인인가요, 조직인가요? 생성일이 2023-11-13 이후인가요? | 확인만 부탁. 요건 적용이면 W5 14일 그대로 |
| Q-02 | 방침·/c를 어디에 올릴까요(도메인 구입 여부)? | 저렴한 도메인 1개 + GitHub Pages 또는 Cloudflare Pages(무료), staging은 서브도메인 |
| Q-03 | production SMTP 업체는? | 발송 한도·도달률 기준으로 전용 업체(예: Resend), 도메인 인증 |
| Q-04 | 변호사 상담을 G-CLOSED 전에 할까요? | 먼저 KISA 118 무료 상담으로 P1 1·2·3·7번, 유료 변호사는 G-PUB 전 |
| Q-05 | Gemini 사진 16장·Lyria 2곡 생성 비용 승인 | 승인 권고(빌드 1 필수 범위) |
| Q-06 | production Supabase Pro 결제 시점 | W3 말(G-INT 직전) 생성과 동시 결제 |
| Q-07 | 웹 삭제 요청에서 어르신 본인 확인 방법(G7) | 빌드 1: "앱에서 직접 지우기" 우선 안내 + 앱을 못 열면 연결 자녀 계정에서 삭제 또는 메일로 기기 기종·연결 날짜 확인 후 수동 처리. 앱 안 확인 코드는 빌드 2 |
| Q-08 | 상표 KIPRIS 결과에 따라 이름 유지? | 충돌 없으면 유지, 있으면 변리사 1회 상담 후 Play 앱 만들기 전 결정 |

### 5.3 리스크
| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| 1 | 푸시·Firebase 사용자 준비 지연 | W1 지연, G-INT 막힘 | AU-02·AU-04를 fake 토큰으로 선개발, US-10을 W1 첫날 요청 |
| 2 | 디자인 QA 승인 왕복 병목(현재 0건) | W3 길어짐 | 핵심 흐름 먼저 승인, 웨이브마다 UX 감사로 미리 걸러냄, 버퍼 30% |
| 3 | 실기기 평일 한정·폰 1대 | 2대 E2E·키보드·오디오 지연 | 에뮬레이터 E2E 루프로 1차 판정, 실기기 항목 QA-10에 모아 월·수·금 |
| 4 | 오디오 라이브러리 RN 0.88 새 아키텍처 호환·기기 차이 | TTS·BGM 실패 | AU-03 착수 첫날 실기기 1회 빌드, 실패 시 대안은 스파이크 문서 기준으로 리드 결정 |
| 5 | 법률 회신이 늦거나 "광고성 알림" 판단 | 방침·푸시 문구 변경 | 빌드 1 규칙(08~21·혜택 금지·끄기 토글)으로 위험 축소, 회신 반영은 업데이트로 |
| 6 | production 설정 누락(provider·SMTP·secrets·cron) | 로그인·푸시·파기 실패 | SV-14 대조표, W4 스모크 체크리스트 |
| 7 | 콘텐츠 30일 생성 품질·검수 지연 | G-CLOSED 막힘 | W0에 프롬프트, W1 생성, W2 시드. 미달 시 14일 + 반복 안내(차선) |
| 8 | dev-menu 같은 테스트 도구가 release에 섞임 | 보안 사고 | AU-01 자동 grep을 build-production에 연결 |
| 9 | 레인 간 공용 파일 충돌 | 병합 지연 | §3.2 규칙, 하루 2회 창, 동결 창 공지 |
| 10 | 상표 충돌로 이름 변경 | 아이콘·스토어 재작업 | US-14를 W1에, Play 앱 만들기(US-15) 전 결정 |

---

## 6. 검증 방법 요약
- 서버: pgTAP 전체 + `db reset` 순차 재생 + advisors + staging 반영 후 앱 확인.
- 앱: `tsc --noEmit`, `npm run lint`(레인 규칙 포함), `npm test -- --maxWorkers=2`, `npm run test:integration`(로컬 Supabase), Maestro 에뮬레이터 흐름.
- 디자인: 실기기 캡처 + 디자이너 승인 문서.
- 문서: 독립 리뷰 문서(작성자 ≠ 검토자).
- 이 문서 자체: 웨이브 종료 회고에서 상태 열 갱신(리드).

---

## 7. 출처 대조표 (빠짐 검증)

읽은 문서마다 이 문서로 옮긴 항목 수. "옮긴 수"는 §2·§4.3·§5 표에서 그 출처를 인용한 행 수(같은 행이 여러 출처를 인용하면 각각 셈). 0이면 사유를 적었다.

(표는 아래 부록 A에 자동 집계로 붙인다.)

## 부록 A. 출처 대조표 (§7, 자동 집계)

| 코드 | 문서 | 옮긴 행 수 | 비고·해당 없음 사유 |
|---|---|---|---|
| DEC | DECISIONS.md(전체) | 26 |  |
| MP | docs/plans/10-master-plan.md | 20 |  |
| ENV | docs/plans/09-environments.md | 7 |  |
| BO | docs/plans/11-backoffice.md | 6 |  |
| AR | docs/plans/12-architecture-refactor.md | 5 |  |
| S07 | docs/plans/07-launch-sprint.md | 0 | 해당 없음: 범위·일정이 이후 DECISIONS(디자인 1:1, 푸시·TTS·BGM 빌드 1)와 10-master-plan으로 대체됨. 남은 일은 모두 다른 출처 행에 포함 |
| S08 | docs/plans/08-social-login.md | 4 |  |
| ARCH | docs/team/ARCHITECTURE.md | 3 | 규칙 문서 — §3.2~3.5에 규칙으로 반영 |
| REL | docs/team/RELEASE.md | 5 | §4.2 최종 체크리스트에도 반영 |
| PROG | /.claude/progress.md | 2 |  |
| GIT | git log -80 · branch -a · worktree | 4 |  |
| GREP | app/src TODO·ASSUMED grep(19건, ASSUMED 0) | 14 |  |
| LCC | legal/compliance-checklist.md | 23 |  |
| LQ | legal/questions-for-lawyer.md | 3 | 질문 20개는 LG-04·LG-10 두 행으로 묶음 |
| LN | legal/in-app-notices.md | 7 |  |
| SITE | site/drafts(privacy-v2·terms-v1·delete-account-v2) | 4 | 게시 조건 G1~G7·검토 요청은 LG-01~03에 묶음 |
| STORE | store/play-console-draft.md | 11 | §4.2에도 반영 |
| IMPL | design/v3/_qa/impl-drift.md | 8 | 27행 중 완료 19, 남은 8을 반영 |
| INV | design/v3/_qa/artifact-inventory.md | 13 |  |
| CPEND | design/v3/_qa/copy-pending.md | 3 | 대기 문구 1~17은 확정 완료, 남은 건 앱 반영만 |
| SWP | design/v3/_qa/artifact-sweep.md | 2 |  |
| QCH | design/v3/_qa/2026-11-17-child.md | 2 | 대부분 '수용'으로 닫힘, 실폰 확인만 남음 |
| QCM | design/v3/_qa/2026-11-17-common.md | 3 |  |
| QPA | design/v3/_qa/2026-11-17-parent.md | 2 |  |
| QFS | design/v3/_qa/2026-11-17-first-screen.md | 2 | A·B·C 폐기안이라 대부분 해당 없음 |
| QFR | design/v3/_qa/first-screen-redesign.md | 4 |  |
| DAN | team/dev-app-notes.md | 17 |  |
| DSN | team/dev-server-notes.md | 10 |  |
| CCON | team/dev-app-child-contract.md | 3 |  |
| AUD | team/dev-audio-spike.md | 5 |  |
| COPY | team/copy-v3-confirmed.md(11-5 포함) | 11 | 11-5 9항목 중 8 완료, push[] 폐기만 WR-01 |
| SPK | spikes/install-referrer-applinks.md | 4 |  |
| TODO | TODO.md(사용자 할 일) | 17 | 대부분 §4.3 사용자 몫 |
| BEJ | board/ease-and-joy/SUMMARY | 8 |  |
| BFI | board/feature-ideation/SUMMARY | 7 | 빌드 2 항목은 PM-06으로 |
| BPE | board/personalization/SUMMARY | 2 | 빌드 1 기반 4항목 완료, 빌드 2는 PM-06 |
| BDM | board/DECISION-MEMO | 4 |  |
| BFS | board/first-screen/SYNTHESIS | 0 | 해당 없음: 공통 1~5 모두 구현 완료(D2-C·C0 v4), 실기기 재판정은 QA-02·DZ-01에 포함 |
| BGE | board/gemini/DECISION-MEMO | 6 |  |
| COV | pm/coverage-audit.md | 17 | 56행 중 완료 다수, 남은 행 반영 |
| PLB | pm/launch-polish-backlog.md | 16 |  |
| RPL | pm/replan-2026-11-17.md | 7 |  |
| BGM | pm/bgm-proposal.md | 4 |  |
| SMK | qa/2026-11-17-device-smoke.md | 2 | 버그 B1~B6 완료, 재스모크만 남음 |
| AST | assets-manifest.md | 5 |  |
| OPS | OPERATING.md | 4 | 규칙 문서 — §3.5 리뷰·디자인 QA 관문으로 반영 |
| REPO | REPO.md | 2 | 규칙 — §3.1 소유 경계로 반영 |
| WRI | writer.md | 3 |  |
| QAM | qa.md | 7 |  |
| DEVM | dev.md | 6 |  |
| DSG | designer.md | 1 |  |
| POL | policy.md | 4 |  |
| GRO | growth.md | 2 |  |
| PHO | photo-curator.md | 4 |  |
| MKT | marketing/ 4개 | 5 | 출시 전 필요한 것만 |
| CNT | content/ 디렉터리(14/30일, starter 0) | 2 |  |
| — | docs/team/BOARD-2026-11-17*.md 4개(회의 안건·규칙) | 0 | 해당 없음: 회의 규칙·안건 문서. 결론은 DECISION-MEMO·SUMMARY(BDM·BEJ·BFI·BPE·BGE)로 이미 집계 |
| — | docs/plans/01~06 | 0 | 이번 범위 밖(지시 목록에 없음). 04 토스 계획은 빌드 2 |
| R-RS | reviews/RESPONSE.md | 3 |  |
| R-B | reviews/app-b-stage-code | 4 |  |
| R-C | reviews/app-c-stage-code | 1 | 15건 중 13 완료, SMTP 체크리스트(C4)만 US-07로 |
| R-DSC | reviews/app-design-system-code | 5 |  |
| R-PF | reviews/app-privacy-flow-code | 2 | 남은 8건을 AP-14·AC-06 두 행으로 묶음 |
| R-ARC | reviews/architecture-audit | 7 |  |
| R-BO | reviews/backoffice-plan-review | 5 |  |
| R-CS | reviews/child-screens-review | 3 |  |
| R-CE | reviews/connect-ease-review | 6 |  |
| R-CH | reviews/course-home-v4-review | 6 |  |
| R-DS | reviews/design-session-review | 7 |  |
| R-V15 | reviews/design-v15-review | 2 | 남은 6건을 DZ-05로 묶음 |
| R-UX2 | reviews/design-v3-ux-r2 | 3 | 남은 불명 10건을 DZ-05로 묶음 |
| R-UX | reviews/design-v3-ux | 2 | 남은 불명 항목을 DZ-05·QA-12로 묶음 |
| R-ENV | reviews/env-split-review | 2 |  |
| R-FS | reviews/first-screen-D-review | 4 |  |
| R-MB | reviews/marketing-biz | 4 |  |
| R-MPO | reviews/marketing-policy | 3 |  |
| R-MPR | reviews/master-plan-review | 6 |  |
| R-P68 | reviews/p6-p8-review | 4 |  |
| R-PD | reviews/policy-docs-review | 4 |  |
| R-QAF | reviews/qa-fix-review | 5 |  |
| R-S19 | reviews/server-0019-0026-review | 3 |  |
| R-SP | reviews/server-preview-content | 3 |  |
| R-SPS | reviews/server-privacy-security | 1 | 12건 중 남은 4건을 SV-05 한 행으로 묶음 |
| R-WS | reviews/server-week-stamps | 0 | 해당 없음: 지적 3건 모두 RESPONSE에서 처리(테스트 날짜 고정·anon·다른 가족), definer는 일부 수용으로 종결 |
| R-SL | reviews/social-login-security | 6 |  |
| R-SR | reviews/spike-referrer-review | 3 |  |
| R-U0 | reviews/u0-components-review | 3 |  |
| R-DM | reviews/2026-11-18-dev-menu-security-review | 3 |  |
| R-P7 | reviews/2026-11-18-p7-motion-review | 3 |  |

- 리뷰 31개에서 뽑은 지적 약 330건 중 '완료' 판정 약 120건은 옮기지 않았고, 미반영·부분·불명 약 209건은 §2 행으로 묶어 모두 넣었다(여러 건이 한 행에 들어간 경우 행 수가 지적 수보다 적다). 실기기 미확인 항목은 QA-10 한 행에 모았다.
- 확인 방법: 각 리뷰의 미해결 ID(예: R-DM H1·M1~M3·L1~L4)를 §2 행의 출처 칸과 대조했다. 대조에서 빠진 ID를 발견하면 리드가 §2에 행을 추가하고 이 표를 다시 집계한다(`scratchpad` 스크립트와 같은 방식: 표의 출처 칸에서 코드 등장 행 수).
