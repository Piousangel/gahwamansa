# 출시 관문 통과 기준 (QA-08, L6 QA, 2026-11-18)

- 이 문서가 `docs/team/qa.md` §2 "빌드 1 출시 게이트 체크리스트"를 대체한다. qa.md §3~§7(시나리오·접근성·관찰·버그 양식)은 그대로 쓴다.
- 근거: `docs/plans/13-road-to-launch.md` §1.1(관문별 완료 조건)·§4.2(출시 전 최종 체크리스트)·§5.1 D-01~D-20, DECISIONS 11-17~11-18.
- 바뀐 점(qa.md §2 대비)
  1. **연속일 기준 삭제**: 옛 #5 "같은 날 2회 완료 시 연속일 불변"은 "이번 주 도장"(0016, 연속일 대신 그 주에 한 날짜 목록)으로 바뀌었다 → G-04로 교체.
  2. **`npm run verify` 삭제**: 그런 스크립트는 없다(`app/package.json` 확인, 사실). 실제 명령 묶음으로 바꿨다(§1).
  3. 옛 #7 "푸시 발송 자체는 빌드 2" 삭제: 푸시는 빌드 1 필수(DECISIONS 11-17 PM 질문 1).
  4. 옛 #9 "대화 주제 추천 '곧 유료' 배지 2곳" → 빌드 1은 C5 '곧 유료' 배지 행 + C6 시트(D-03).
  5. 13개 항목을 **관문(G-INT·G-CLOSED·G-PUB)별 표**로 나누고, 각 칸을 **자동(A)/수동(M)**으로 구분했다.
- 표기: **A** = 명령이 종료 코드·출력으로 판정(사람 눈 불필요). **M** = 사람이 실기기·콘솔·문서를 보고 판정. **A+M** = 자동 판정 뒤 사람 확인. "(추정)"은 아직 없는 도구·스크립트에 기대는 칸이다.
- 판정: 그 관문 표의 **모든 행이 합격**이어야 통과. 하나라도 불합격이면 qa.md §6 양식으로 버그를 남기고, 고친 뒤 그 행 + §5 회귀 묶음을 다시 돈다.

## 1. 자동 검사 명령 묶음 (A) — 결과 로그를 관문 기록에 첨부

| ID | 무엇 | 명령(작업 위치) | 합격 | 지금 상태(2026-11-18) |
|---|---|---|---|---|
| A1 | 타입 | `cd app && npx tsc --noEmit` | 종료 코드 0 | 있음 |
| A2 | 린트(레이어 규칙 포함) | `cd app && npm run lint` | error 0 (W2 이후 레이어 규칙 error 승격, AU-10) | 있음, 레이어 규칙은 AU-08 이후 |
| A3 | 단위·화면 테스트 | `cd app && npm test -- --maxWorkers=2` | 실패 0, 건너뜀 사유 기록 | 있음(copyBan·noPlaceholder 포함) |
| A4 | 통합(로컬 Supabase) | `supabase start` 후 `cd app && npm run test:integration` | 실패 0 | 있음 |
| A5 | 서버 RLS·RPC | `supabase db reset && supabase test db` | pgTAP 전부 ok | 있음(29파일) |
| A6 | 문구 금지어 | A3 안 `copyBan.test.ts` + 아래 G-CLOSED 확장 grep | 0건 | **부분**: copyBan은 `아직·못 했·미완료·N일째·틀렸·치매·치료·예방`만 검사. 13 §1.1이 요구하는 `두뇌·안부·안심·칭찬류`는 없음 → §6 제안 1 |
| A7 | 하드코딩 한글 0 | A3 안 `noPlaceholder`·copy 테스트(추정: 하드코딩 검사 범위 확인 필요) | 0건 | 불명 → QA가 W1에 범위 확인 |
| A8 | release 번들 비밀값 | `npm run check:dev-menu`(dev-menu 브랜치 병합 후) + 아래 grep | 0건 | dev-menu 미병합(AU-01). 병합 전에는 grep만 |
| A9 | release 번들 grep | `unzip -p app-production-release.apk assets/index.android.bundle \| strings \| grep -E 'sb_secret_\|service_role\|devTestChild\|:54321\|10\.0\.2\.2\|bumojasik-dev-menu-impl'` | 0건 | 수동 실행. `localhost` 는 빼고 로컬 Supabase 주소 `:54321` 로 바꿈(리드 결정 11-25, #268): RN 개발 서버·supabase-js·URL 폴리필 기본값이라 늘 7건 나옴(`qa/evidence/2026-11-25-stability` 2절). 개발 메뉴 표식은 production APK 에서만 0건(staging 은 설계상 있음). Hermes는 한글을 UTF-16으로 담아 한글 표식은 strings로 못 잡음(R-DM 사실) |
| A10 | 병합 매니페스트 권한 | `bundletool dump manifest --bundle app-production-release.aab \| grep uses-permission` | `INTERNET`·`POST_NOTIFICATIONS`·FCM·Crashlytics 필수분만, `AD_ID`·`ACCESS_*_LOCATION` 0 | AU-05 이후 |
| A11 | 출시 빌드 안전장치 | `scripts/build-production.sh` | 성공(작업 트리 깨끗·서명·versionCode > 기록) | 있음 |
| A12 | 에뮬레이터 흐름 | `maestro test .maestro/` | 흐름 5개 초록 | **없음**(AU-12 W0 착수) |
| A13 | 방침·약관·삭제 URL 살아 있음 | `curl -s -o /dev/null -w '%{http_code}' https://{도메인}/index.html` 등 3개 | 200, 리다이렉트 없음 | 도메인 미정(US-03) |
| A14 | 자리표시 0 | `grep -nE '\{[^}]*\}\|운영자 입력 필요\|불확실' site/index.html site/terms.html site/delete-account.html` | 0건 | 게시본 W1 초안(docs/team/legal/publish-drafts/) |

## 2. G-INT (내부 테스트 업로드) — 팀·가족만, production 서버

| # | 항목 | 구분 | 절차 | 합격 기준 |
|---|---|---|---|---|
| G-01 | 코드 품질 묶음 | A | §1 A1~A5, A11 | 전부 합격, 로그 첨부 |
| G-02 | 5초 연결 | M | 자녀 폰 번호 만들기 → 어르신 폰 6자리 입력(마지막 자리 = 자동 확인 시작)부터 "연결됐어요"까지. Wi-Fi 3회·LTE 3회. P1c(링크로 채운 번호 확인) 경로 1회 추가 | Wi-Fi 3회 모두 ≤ 5.0초, LTE ≤ 8초(경고선, 가정) |
| G-03 | reason 문장 | A+M | A: reason→문장 단위 테스트(invalid·used·expired·rate_limited·busy·already_linked·not_parent_device, peek 포함). M: used·틀린 번호·5회 잠금 실기기 | 영문·코드값·"오류"·"틀렸" 0, 다음 행동이 버튼으로 보임 |
| G-04 | 이번 주 도장 | A+M | A: week_stamps pgTAP. M: 같은 날 코스 2번 완료, 띄엄띄엄 한 날(월·수) 칠해짐, 미연결 도장은 기기에만(7일 정리) | 같은 날 도장 1개, 연결 후 로컬 도장 삭제·서버 값만 |
| G-05 | 다른 가족 답 노출 0 | A+M | A: pgTAP RLS. M: 가족 2팀(A1-B1, A2-B2) 교차 확인 | 노출 0 |
| G-06 | 코스 완료 → 자녀 홈 반영 | M | 홈 켜 둠/다른 앱 갔다 옴/재실행 각 3회 | 60초 이내(재실행 10초) |
| G-07 | 어르신 글자·버튼 | A+M | A: 화면 최소값 테스트(있으면). M: 어르신 화면 캡처, 화면별 버튼 수 표 | 20sp 미만 0, 64dp 미만 0, 주요 버튼 4개 이상 화면 0 |
| G-08 | 푸시 거절·허용 | M | Android 13+ 허용·거절·나중에, Android 12 이하 1대. N1 "안 받으셔도 앱은 그대로 써요" 확인 | 거절해도 크래시·빈 화면 0, 허용 시 09시 1회 수신(D-07), 08~21시 밖 발송 0 |
| G-09 | 효능 단정 0 | A+M | A: A6. M: 실기기 전 화면 눈 확인 | "치매·예방·치료·두뇌·개선·효과" 0 |
| G-10 | 무료·곧 유료 표시 | M | 자녀 홈·지난 답·C5 배지 행·C6 시트 | 막힘 0, C6 "지금은 결제되지 않아요. 관심만 표시돼요", 압박 문구 0 |
| G-11 | 동의 거부 시 저장 0 | A+M | A: pgTAP(동의 없는 answers insert 거부). M: qa.md S4 | answers 0행, 자녀 화면에 답·참여 여부 없음 |
| G-12 | 계정 삭제 | A+M | A: 삭제 pgTAP(cascade·마지막 자녀 → 부모님 익명 계정 삭제 0026). M: 자녀 삭제(형제 있음/없음), 부모님 모두 지우기 | 지운 뒤 상대 화면이 이해되는 문장, 토큰 삭제 |
| G-13 | 콜드 스타트 | M | release 빌드 10회 실행(강제 종료 포함) | 크래시 0, 콜드 스타트 시간·AAB 크기 기록(AU-17) |
| G-14 | release 산출물 | A | §1 A8·A9·A10 | 0건, 권한 목록 일치 |
| G-15 | 보안 리뷰 | M | `/code-review high` 전체 + xhigh 영역(인증·저장·삭제·푸시·dev-menu) 문서 | 높음 0 |
| G-16 | 디자인 QA 핵심 흐름 | M | `device-review/QA-<화면>.md` 첫 화면·P0~P9·C0~C5·C8 | 시안 담당 "승인" |
| G-17 | 접근성 핵심 흐름 | M | TalkBack 순회(U+2060 읽기)·200%·동작 줄이기 | 읽기 순서·라벨 결함 높음 0 |
| G-18 | 개인정보 대조 | M | LG-06 동의 문구 ↔ 자녀 노출 1:1 대조표(`legal/consent-exposure-map.md`), **P2 동의 5요소 점검표(`legal/p2-consent-five-elements.md`, Q1)**, 31일 파기 배치 production 1회 실행 기록 | 대조표 전부 "일치", 5요소 전부 "일치"(문구 바뀌면 `CONSENT_VERSION` 올림), `job_run_details` 성공 |
| G-19 | 모니터링 | M | Crashlytics production 수신(의도적 크래시는 staging만), pg_cron 성공 | 콘솔 캡처 |
| G-20 | 콘텐츠 | M | production 14일분 + 사진 장당 ≤150KB | 15일차 이전 빈 날 0 |
| G-21 | 실기기 흐름 | M | 원격 2대 E2E 1회(qa.md S1·S4·S7·S13), 키보드 3종(QA-03), 오디오 8항목(QA-04) | 높음 0 |
| G-22 | 앱 정보 행 숨김 0 (DECISIONS 11-18) | A+M | A: `app/src/lib/appInfo.ts`의 URL·문의·사업자·OSS 값이 null/false 0(`grep -nE "null\|= false" app/src/lib/appInfo.ts`, AU-07 이후 상수 파일 기준). M: production 빌드 P13·C7 앱 정보 캡처 | 약관·방침·OSS·AI 안내·병원 앱 아님·사업자 정보·문의·버전 8행 모두 보임(in-app-notices §3), 값이 게시본과 글자 일치 |
| G-23 | 약관·방침 동의 기록(Q2, 서버 0046) | A+M | A: pgTAP(연결·로그인 완료 시 약관·방침 버전·시각 기록). M: staging에서 연결 1회·로그인 1회 후 행 확인(L1 조회) | 두 경로 모두 버전·시각 행 1개 |
| G-24 | 푸시 문구 금지어(Q6) | A | push_copy·`copy.ko.json push.*` 테스트: `혜택\|이벤트\|무료\|할인\|유료\|다시 오` 0 | 0건 |
| G-25 | 백업·기기 이전 제외(보안 회의 E5, 2026-11-19-encryption-keys) | A+M | A: `cd app/android && ./gradlew :app:processStagingReleaseMainManifest :app:processProductionReleaseMainManifest` 뒤 병합 매니페스트(`app/build/intermediates/merged_manifest/<variant>/process<Variant>MainManifest/AndroidManifest.xml`)에서 `grep -E 'allowBackup\|dataExtractionRules\|fullBackupContent'`. M: Android 12+ 실기기 1대에서 기기 이전(D2D, 예: 스마트 스위치) 뒤 새 폰이 이전 세션 없이 첫 화면인지 | release 두 변형 모두 `allowBackup="false"`, `dataExtractionRules="@xml/data_extraction_rules"`(cloud-backup·device-transfer 모든 도메인 제외), `fullBackupContent="@xml/backup_rules"`. 기기 이전 뒤 로그인·연결 상태가 따라오지 않음 |
| G-26 | 평문 통신 끔(보안 회의 E5) | A | G-25 와 같은 병합 매니페스트에서 `grep usesCleartextTraffic` | release 두 변형 모두 `usesCleartextTraffic="false"`(RN 플러그인이 release 에 false — debug 만 true) |

## 3. G-CLOSED (비공개 테스트 시작) — G-INT 전 행 유지 + 아래

| # | 항목 | 구분 | 합격 기준 |
|---|---|---|---|
| C-01 | 내부 테스트 결함 | M | 치명·높음 0(버그 대장) |
| C-02 | 디자인 QA 전 화면 | M | P13·P15·P16·N1·C6·C7·S1·S2·탭 바 포함 전부 "승인" |
| C-03 | 접근성 전 화면 | M | TalkBack·150/200%·320×640·동작 줄이기·라이트 고정, 필수 8개(20sp·64dp·대비 4.5·150% 잘림 0·시간 제한 0·라이트·백 버튼·2초 반응) |
| C-04 | 금지어 확장 | A | A6 + `두뇌·안부·안심·칭찬류` grep 0 (§6 제안 1 반영 전엔 수동 grep 결과 첨부) |
| C-05 | 정책 게시 | A+M | A13·A14 합격, 사업자 정보 5곳(방침·약관·삭제 안내·Play·앱 설정) 글자 일치 diff 0 — **업무용 전화번호 포함(Q9)**, 게시 전 조건 `legal/publish-drafts/CHANGES.md` P1~P18 전부 해소 |
| C-06 | 데이터 보안 양식 = 실측 | M | LG-05: SDK 전송분·AD_ID(A10)·알림 거부 기기 Firebase 설치 ID 생성 여부(QA-07) 반영 |
| C-07 | 콘솔·비밀 | M | 모든 콘솔 MFA(US-17), 노출 staging secret 교체(US-16) 확인 |
| C-08 | 실기기 확장 | M | 원격 2대 E2E 2회, 15일차 순환, 자정 경계, 비행기 모드, Install Referrer(내부 트랙, QA-11) |
| C-09 | 콘텐츠 30일 | M | production 30일분(D-18), 재고 경보 뷰 동작 |
| C-10 | 운영 최소 | M | admin_delete_* RPC·감사 테이블, 삭제 요청 대장·메일함, 푸시 발송 성공·실패 쿼리 |
| C-11 | 테스터 고지 | M | LG-12 모집 글(거부 권리·삭제 날짜) 발송본 = 검토본 |
| C-12 | 공식 상담(테스터 전) | M | `legal/official-consult-checklist.md` **C-0(알림 광고성, 118)**·L-1~L-3 회신 기록 또는 "미회신·잠정 유지" 사유 | 테스터 알림 발송 전 C-0 기록 있음 |
| C-13 | 내부관리 의무 이행(Q8) | M | 권한 대장(3년)·접속 대장(1년, 월 PDF·해시)·비밀값 대장(이름·교체일)·모든 콘솔 MFA(의무) — `legal/internal-management-plan.md` §3·§4·§6 | 대장 3종 첫 줄 있음, MFA 날짜 전부 채움 |
| C-14 | 설정 '문의하기'에 열람·삭제 요청 경로(Q4) | M | P13·C7 문의 행이 메일을 열 때 "내 정보 보기·지우기 요청" 선택지 | 실기기 1회 |

## 4. G-PUB (공개 신청) — G-CLOSED 전 행 유지 + 아래

| # | 항목 | 구분 | 합격 기준 |
|---|---|---|---|
| P-01 | 비공개 테스트 결함 | M | 높음 0, 중간은 처리 또는 사유 기록 |
| P-02 | 재리뷰 | M | 비공개 테스트 중 바뀐 코드 `/code-review high` 1회, 바뀐 화면 디자인 재승인 |
| P-03 | 크래시 없는 사용자 | M | Crashlytics ≥ 99%(가정 목표) |
| P-04 | 어르신 관찰 | M | QA-12 3가구에서 막힌 지점 처리 기록 |
| P-05 | 스토어 사실 대조 | M | 스토어·마케팅 문장 ↔ 출시 빌드 대조표 전부 "일치"(WR-05·WR-08) |
| P-06 | 법률 회신·공식 상담 | M | 팀 법률 회신(`legal/replies/2026-11-19-legal-agent-answers.md`) 변경 항목 반영 확인 + 공식 상담 C-1(국외 이전 국가·호스팅)·C-2(통비법 3개월)·C-3(AI 생성물 권리)·C-5(접근성 의무) 회신 반영 또는 미회신 사유 기록 |
| P-07 | 요건 | M | 14일·12명 충족 확인(US-01 계정 유형 결과에 따름) |
| P-08 | 회귀 | A+M | §5 회귀 묶음 1회 |

## 5. 매 빌드 회귀 묶음 (qa.md §6 회귀 목록 갱신판, 약 40분 가정)
1. §1 A1~A5 (자동)
2. A12 Maestro 흐름 5개 (자동, AU-12 이후)
3. 5초 연결 + 5회 잠금·10분 해제 (수동)
4. 동의 거부·허용 저장 여부 (자동 pgTAP + 수동 1회)
5. 코스 완료 → 자녀 홈 60초 (수동)
6. 이번 주 도장: 같은 날 2회 완료 도장 1개 (수동)
7. 재설치 재연결 기록 유지 (수동)
8. 푸시 거절 무오류 + 허용 수신 1회 (수동)
9. 읽어 주기: 한국어 음성 없음에서 코스 완료 (수동)
10. 글자 150%에서 어르신 화면 잘림 0 (수동)
11. release 콜드 스타트 10회 크래시 0 + A9 grep (수동 + 자동)

## 6. QA가 리드에게 올리는 제안(결정 필요, 이 문서에서 결정하지 않음)
1. `copyBan.test.ts`의 `BANNED_EVERYWHERE`에 `두뇌·안부·안심·칭찬` 계열 추가(L4/L5). 단 "안심 줄"(B4) 같은 내부 이름이 화면 문구에 들어가는지 먼저 확인 필요 — 화면 문구에 "안심"이 쓰이면 라이터 판단.
2. A9 grep을 `build-production.sh` 끝에 연결(13 §5.3 리스크 8과 같음, L4 AU-01).
3. A10 권한 검사를 스크립트화(L4 AU-05와 함께).
4. qa.md §2는 이 문서로 대체됐다고 PM-04(낡은 문서 정리)에서 표시.
