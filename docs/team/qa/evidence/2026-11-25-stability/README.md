# 안정성 점검 — 내부 테스트 필수 6번 (DV-1, 2026-11-25)

- 기준 문서: `docs/team/2026-11-25-internal-test-done-criteria.md` 1.6 S2·S3·S4·S6, 3.1의 6번
- 기준 코드: main `830b317a`(#263 병합) + 이 PR
- 에뮬레이터·S25는 쓰지 않았다(QA-2 레인이 에뮬레이터 사용 중). 아래는 모두 소스·번들·기존 기록으로 확인한 것이다.

## 요약

| 줄 | 항목 | 판정 | 한 줄 근거 |
|---|---|---|---|
| S4 | 개발 빌드 `ReactNativeJS: Error: undefined` | ✅ 무해 판정, 앱 수정 없음 | RN 개발 도구(Fast Refresh)가 Metro 웹소켓을 잃었을 때 내는 경고의 마지막 줄. release에는 없는 코드. 시험 `devMetroDisconnectWarning`로 고정 |
| S6 | release 번들 비밀값·개발 메뉴 | ⚠️ JS 번들 ✅ / APK 산출물은 출시 빌드 때 | 비밀 키 모양 0건, production 번들에 개발 메뉴 0건. A9 grep의 `localhost`는 라이브러리 기본값 7건이라 식 자체를 고쳐야 함(3절) |
| (6-3) | 로그·이벤트에 개인정보 | ✅ 경로 없음 | console 14곳 모두 고정 문구·열거값. 이벤트는 타입으로 허용 키·값만. 크래시 수집 도구는 아직 없음 |
| S2 | Maestro 5흐름 | ⚠️ 재실행 필요 | 마지막 5개 모두 초록은 11-19 07:46. 그 뒤 gorhom 시트(f6 경로) 등 변경. 선택자 55개는 지금 소스에 모두 있음 |
| S3 | release 콜드 스타트 10회 | ❌ 실기기 몫 | 아래 'S25 확인 목록' 1번으로 넘김 |

---

## 1. S4 — 'Error: undefined'는 어디서 나오나

### 관찰(기존 기록)
- `evidence/2026-11-24-c4-history/README.md` 5번: LogBox 'Open debugger to view warnings' + logcat `ReactNativeJS: Error: undefined`(11-25 00:22·00:43, 시작 화면부터). progress 148 → 대기열 14.

### 추적
1. 앱 소스에서 찾음 — **없음**
   - `reject()`·`reject(undefined)`·`throw undefined`·`new Error(undefined)`·`'Error: ' +` 모양: 0건(`src`·`App.tsx`·`index.js`)
   - `console.error`: 0건. `console.warn` 14곳은 모두 접두어(`[DS]`·`[log_event]`·`[5단계]`·`[tts]`)가 붙어 'Error:'로 시작할 수 없다
   - jest 전체(162 스위트) 출력에 `Error: undefined` 0건(나온 console.error는 모두 `act(...)` 경고)
2. RN 로그 형식에서 좁힘
   - `console.error(err)`(Error 객체)는 `[Error: …]`처럼 대괄호로 찍힌다(`@react-native/js-polyfills/console.js` `formatError`). 그래서 대괄호 없는 `Error: undefined`는 **문자열로 만들어진 줄**이다.
   - 처리 안 된 promise 거절은 `Uncaught (in promise, id: N)…`으로 시작한다(`promiseRejectionTrackingOptions.js`) — 해당 없음.
3. 출처 — RN 개발 도구
   - `react-native/Libraries/WebSocket/WebSocket.js`: 네이티브 `websocketFailed` 를 받으면 `this.dispatchEvent(new Event('error'))` — **message 속성이 없는 Event**를 보낸다(실패 사유는 뒤따르는 close 이벤트의 reason에만 실린다).
   - `metro-runtime/src/modules/HMRClient.js`: `this._ws.onerror = (error) => this.emit("connection-error", error)` — 그 Event를 그대로 넘긴다.
   - `react-native/Libraries/Utilities/HMRClient.js`: `client.on('connection-error', e => …)` 가 "Cannot connect to Metro. Try the following…URL: host:port\n\nError: ${e.message}" 를 만들고, **처음 연결에 성공한 적이 있으면**(`didConnect`) `console.warn(reason)` + 화면 위 'Fast Refresh disconnected. Reload app to reconnect.'
   - 여러 줄 경고는 logcat에서 줄마다 `ReactNativeJS:` 가 붙는다 → 마지막 줄이 `ReactNativeJS: Error: undefined`. LogBox가 '…view **warnings**'라고 한 것도 console.warn과 맞는다.
4. 언제 나나: 앱이 Metro에 붙은 뒤 웹소켓이 끊길 때(맥 부하로 Metro가 멈춤·재시작, `adb reverse` 끊김, 다른 레인이 Metro를 끄고 켬). `app/e2e/README.md` 안정화 기록 '원인 3 — Metro 연결'과 같은 계열. 00:22·00:43 관찰 회차(#239 QA)는 부하 때문에 320×640·200% 캡처를 못 찍은 회차였다(progress 148). 그때 Metro 쪽 로그는 남아 있지 않아 끊김 자체는 직접 확인하지 못했다 — 위 경로 말고 이 모양의 줄을 만드는 곳은 앱·RN 어디에도 찾지 못했다는 것이 판정 근거다.

### 판정
- **무해**: 개발 빌드의 Fast Refresh(HMR) 경고. release 번들에는 HMRClient가 들어가지 않는다(개발 전용 코드). 앱 동작·데이터와 무관.
- **앱 수정 없음**: `LogBox.ignoreLogs`로 숨기면 'Metro 연결 끊김'이라는 쓸모 있는 신호까지 사라진다. 보이면 Metro를 다시 켜고 앱을 Reload 하면 된다.
- **회귀 시험**: `app/__tests__/devMetroDisconnectWarning.test.ts` — 위 세 사실(WebSocket의 message 없는 Event, metro-runtime 전달, RN HMRClient 문구·didConnect 조건)과 'message 없는 Event → 마지막 줄 = Error: undefined'를 고정. RN·Metro를 올려 하나라도 바뀌면 실패하므로 그때 판정을 다시 본다.
  - 실패 확인: 시험 사본에서 기대를 `new ErrorEvent('error')`(message 있는 이벤트)로 바꾸면 1번 시험이 ✕ (1 failed, 3 passed). 사본은 지웠다.
- 남는 확인(선택): 다음 에뮬레이터 회차에서 Metro를 일부러 끄면 같은 줄이 나오는지 logcat 1회. 필수 아님.

## 2. S6 — release 번들 비밀값 grep

### 만든 방법
- 작업 트리를 건드리지 않으려고 앱 소스를 scratchpad로 복사(`node_modules`는 링크, `config.local.ts`·`env.generated.ts`·`android`·`ios`·시험 폴더는 복사 안 함) — `scripts/check-dev-menu-bundle.sh`와 같은 방식.
- `env.generated.ts`는 Gradle과 같은 스크립트로 만듦: `node scripts/appEnv.js write --flavor <staging|production> --build-type release --allow-placeholder --allow-missing-app-info --version-name 0.0.0 --version-code 1`. **env 파일·생성 파일 내용은 열어 보지 않았다**(키 이름 목록만 확인).
- 번들 3개
  1. 지시 명령 그대로: `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output <scratchpad>/index.android.bundle`(staging release 값)
  2. Gradle과 같은 설정 staging: `--config metro.release.config.js --minify true`
  3. Gradle과 같은 설정 production: 위와 같음, `production.env.example`(실제 production.env 없음)
- 검사 스크립트는 **종류·개수·바이트 위치만** 출력한다(값 출력 없음). JWT는 payload의 `role`만 읽게 했다.
- 한계: 실제 APK 속 번들은 Hermes 바이트코드다. 이번 검사는 컴파일 전 JS 번들 기준이다. APK 산출물 검사(A9)는 출시 빌드 때 `build-production.sh` 뒤에 한다.

### 결과 (세 번들 같음, 다른 줄만 따로 표시)

| 찾은 모양 | 1 지시 명령 | 2 staging | 3 production | 판단 |
|---|---|---|---|---|
| JWT `eyJ….eyJ….…`(role=service_role 포함 여부) | 0 | 0 | 0 | 없음. 옛 anon/service_role JWT 모두 없음 |
| `service_role` 글자 | 0 | 0 | 0 | 없음 |
| Supabase 비밀 키 `sb_secret_` | 0 | 0 | 0 | 없음 |
| Supabase 공개 키 `sb_publishable_` | 1 | 1 | 1(example 값) | **허용**: 공개(publishable) 키. 앱에 들어가는 것이 정상이고 권한은 RLS가 막는다(`env.ts` `SUPABASE_KEY` 주석 '비밀 키 아님') |
| PEM `-----BEGIN … -----` | 0 | 0 | 0 | 없음 |
| `private_key`·`client_secret` 글자 | 0 | 0 | 0 | 없음(FCM 서비스 계정은 Edge 함수 Vault에만) |
| `sk_live_`·`sk_test_`·`sk_` 긴 토큰·`sk-`(OpenAI·Anthropic류) | 0 | 0 | 0 | 없음 |
| Google API 키 `AIza…` | 0 | 0 | 0 | 없음. 있더라도 Firebase 앱 키는 공개 키라 허용 대상(google-services.json → 네이티브 리소스로 가고 JS 번들엔 안 들어감) |
| AWS `AKIA…`·GitHub `ghp_`/`github_pat_`·Slack `xox?-`·FCM 옛 서버 키 `AAAA…:APA91…` | 0 | 0 | 0 | 없음 |
| A9 `devTestChild`·카나리아 | 0 | 0 | 0 | 없음(config.local 테스트 계정 안 들어감) |
| A9 `10.0.2.2` | 0 | 0 | 0 | 없음 |
| A9 `bumojasik-dev-menu-impl`·`dev_menu_session_`·`createTestFamily` | 1·4 | 1·4 | **0** | production 0 = 통과. staging에 있는 것은 설계대로(개발자 메뉴는 staging·local만, `metroDevMenu.js`) |
| A9 `localhost` | 7 | 7 | 7 | **모두 라이브러리 기본값**: RN 개발 서버 기본 주소 `http://localhost:8081/` 2건, supabase-js 허용 도메인 목록·`GOTRUE_URL` 기본값·도메인 검사 3건, URL 폴리필 1건, 앱 `env` 로컬 주소 판별 정규식 1건. 우리 설정값이 아님 |

### 3. 제안(리드 결정 필요)
- `release-gates.md` A9 식은 `localhost` 를 넣고 '0건'을 기대하는데, 지금 의존성으로는 **늘 7건**이라 영원히 실패한다. `localhost`를 빼고 `http://localhost:54321`·`127.0.0.1:54321`(로컬 Supabase)처럼 **우리 설정에서만 나올 주소**로 바꾸는 것을 제안. 이 PR에서는 문서 식을 고치지 않았다.
- 비밀 모양 grep(이 문서 2절 표)을 `check-dev-menu-bundle.sh` 에 붙이면 매 PR에서 돌릴 수 있다(값 출력 없이 개수만). 별도 과제로.

## 4. 로그·이벤트에 개인정보가 나가는 길

이름(부르는 이름·자녀 이름)·답 글자(P6 낱말)·전화·이메일·연결 번호가 대상.

| 경로 | 곳 | 싣는 것 | 개인정보 | 근거 |
|---|---|---|---|---|
| `console.warn` 디자인 규칙 | `ui/ds/dismiss.ts:27`·`BackLink.tsx:26`·`Screen.tsx:139`·`audience.tsx:45` | 화면 고정 문구·style 키·숫자 | 없음 | 모두 `__DEV__` 안 |
| `console.warn` 해님 규칙 | `ui/SunBubble.tsx:47` | 말풍선 문구 | 없음 | `__DEV__` 안. 지금 이 컴포넌트를 쓰는 화면 없음 |
| `console.warn` 계측 실패 | `features/track.ts:15`·`home/PaidSheet.tsx:25`·`home/pushOpen.ts:32`·`app/PushHost.tsx:147`·`push/pushClient.ts:65` | 이벤트 이름 + 실패 이유(`invalid_name`·`invalid_props`) | 없음 | 모두 `__DEV__` 안 |
| `console.warn` 5단계 | `course/FiveStepParts.tsx:59·64`·`course/useFinishStep.ts:23` | 실패 이유 열거값·단계 이름(`recall` 등) | 없음 | `__DEV__` 밖(release logcat에도 남음) — 그래도 열거값뿐 |
| `console.warn` TTS | `audio/engines.ts:445` | 고정 문구 | 없음 | `__DEV__` 안 |
| `console.log`·`console.info`·`console.debug`·`console.error` | 앱 `src`·`App.tsx`·`index.js` | — | — | 0건 |
| 초대 번호 경로 | `lib/linkSources/native.ts` | — | 없음 | 파일 머리 '로그·분석 금지, 예외는 삼킨다(메시지에 번호가 실리지 않게)' |
| 계정 가명값 | accountTag | 기기 저장 키에만 | 없음 | 기존 시험 `accountTagGuard.test.ts` 가 logEvent·rpc·console 로 가지 않음을 고정 |
| 이벤트 계약 | `api/contract/events.ts` | 이름 25개 + 허용 속성(열거값·형식·숫자·참거짓) | 없음 | 글자 속성 자리가 타입에 없음, 서버 `event_prop_ok` 가 다시 검사, `eventsContract.test.ts` 가 마이그레이션과 대조. P6 결과는 `finished`·`skipped` 두 값만(정오 기록 금지) |
| 크래시·오류 수집(Sentry·Crashlytics·Bugsnag) | `package.json`·`android/build.gradle` | — | — | **아직 없음**. Crashlytics 설치는 오너 승인 대기(DECISIONS 11-25). 넣을 때 `setUserId`·`setAttribute`·`log`에 이름·이메일·번호를 넣지 않는 규칙과 시험을 같이 |
| 네이티브 로그(Kotlin `Log.*`) | `android/app/src/main/java` | — | — | 0건 |
| Edge 함수 로그 | `supabase/functions/*/index.ts` | 실행 요약(보낸 수·실패 수·상태), 오류는 영숫자만 80자 | 없음 | `RunSummary`·`EventsSummary` 타입이 개수뿐 |
| supabase-js 디버그 로그 | `lib/supabase.ts` | — | — | `debug` 옵션 안 씀(기본 꺼짐) |

## 5. S2 — Maestro 5흐름 상태

| 흐름 | 경로 | 마지막 초록 | 그 뒤 바뀐 것(위험) |
|---|---|---|---|
| `flows/f1-parent-connect-course.yaml` | FS → P1 → P1c → P2 → P3 → P4 → P5 → P6 → P7 → P3 3/3 | 11-20 00:57 (단독) | P4 사진·P5·P7 손질(11-24~25). 5단계는 스위치 기본 꺼짐이라 경로 그대로 |
| `flows/f2-unlinked-course.yaml` | P1 '코스 보기' → 미연결 코스 → P7 | 11-20 00:59 (단독) | 위와 같음 |
| `flows/f5-child-login-wait-home.yaml` | C0 카카오(fake) → C1 → C2 → C3 → (개발자 메뉴) → C4 | 11-19 07:46 (5개 묶음) | C4 지난 날 두 칸(#239), 개발자 메뉴 항목 추가 |
| `flows/f6-cheer-roundtrip.yaml` | C4 → 응원 시트 → 토스트 → 어르신 전환 → P8 | 11-19 07:46 | **응원 시트가 gorhom 으로 바뀜**(11-25 #255). 끌기·탭 판정이 달라져 가장 위험 |
| `flows/f9-parent-delete.yaml` | P13 모두 지우기 → P9 → P10 → P1 | 11-19 07:46 | P13 설정 행 변경 |

- 근거: `~/.maestro/tests/<시각>/maestro.log`(375회 기록) 중 다섯 흐름 이름이 든 것. 5개 묶음이 FAILED 0으로 끝난 마지막은 `2026-11-19_074647`(315 명령 COMPLETED). 저장소 `app/e2e/out/`(gitignore)에는 11-18 두 번만 남아 있다. CI에는 Maestro가 없다.
- 정적 점검(이번): 다섯 흐름 + 공용 조각 5개의 글자 선택자 55개를 '.*'로 나눈 조각 단위로 지금 `src` 문구(tsx·ts·json)에서 찾음 → **못 찾은 것 0**. testID 선택자 4개도 모두 소스에 있음. 선택자 깨짐은 없어 보이나, 화면 동작(gorhom 시트 탭)은 돌려 봐야 안다.
- **지금 main에서 돌리려면**
  1. 에뮬레이터 한 대를 이 실행 전용으로: QA-2 와 겹치지 않게 `ANDROID_SERIAL=emulator-5556 AVD=gahwa_small METRO_PORT=8091`처럼 다른 기기·포트(README 2절). 같은 기기에 두 실행 금지
  2. `app/src/lib/config.local.ts` 가 `API_MODE: 'fake'`(run.sh 가 검사). 메인 checkout 에는 파일 있음, worktree 에는 없으니 메인에서 돌린다
  3. Maestro 2.12.1(`~/.maestro/bin`, 설치 확인함) + Java 17(`/opt/homebrew/opt/openjdk@17`)
  4. `assembleStagingDebug` 빌드(run.sh 가 함, 몇 분) → 설치 → Metro
  5. 맥이 한가할 때(부하 낮을 때). 빌드·jest 와 동시에 돌리면 '시스템 ANR 창'·'Metro 못 찾음'으로 거짓 실패(README 안정화 기록 원인 1·3)
  6. 명령: `app/e2e/run.sh` → `app/e2e/out/<시각>/report.xml` 을 이 폴더에 옮겨 S2 를 ✅로
- 이번에 돌리지 않은 이유: 에뮬레이터는 QA-2 레인이 쓰는 중(리드 지시).

## 6. 오너 S25 확인 목록 (이번 점검에서 넘김)

1. **S3 release 콜드 스타트 10회**: staging release 빌드를 설치하고 ① 앱 아이콘으로 켜기 → 첫 화면 → 최근 앱에서 밀어 강제 종료, 이것을 10회. 그중 2회는 설정 > 앱 > 강제 중지 뒤 켜기. 크래시·멈춤 0이어야 하고, 첫 화면까지 걸린 시간을 대략 적는다(11-19 1회 237ms 기록과 비교). 개발 빌드가 아닌 **release**여야 한다(개발 빌드의 'Error: undefined'·Fast Refresh 경고는 release 에 없다 — 1절).
