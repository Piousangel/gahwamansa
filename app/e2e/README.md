# E2E (Maestro, 에뮬레이터)

결정: 13-road-to-launch §5 D-08 — Maestro CLI(앱 의존성 추가 없음). 화면 단위는 jest, 여기는 **여러 화면을 실제 앱으로 지나가는 흐름**만.

## 1. 설치(한 번, 홈 디렉터리)
공식 설치 스크립트(`https://get.maestro.mobile.dev` → `storage.googleapis.com/mobile.dev/maestro/install.sh`)는 GitHub 릴리스의 `maestro.zip` 을 `~/.maestro` 에 풀고 `~/.zshrc`·`~/.bash_profile` 에 PATH 를 덧붙인다. 이 프로젝트는 전역 셸 설정을 건드리지 않으므로(scripts/env.sh 원칙) **스크립트와 같은 파일을 같은 자리에 손으로** 푼다. 버전은 고정(2주 이상 된 판).

```bash
V=2.12.1   # 2026-11-02 배포
mkdir -p ~/.maestro /tmp/maestro-dl && cd /tmp/maestro-dl
curl -fsSLO "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$V/maestro.zip"
curl -fsSLO "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$V/checksums_sha256.txt"
shasum -a 256 -c checksums_sha256.txt          # maestro.zip: OK 여야 진행
unzip -qo maestro.zip && cp -rf maestro/* ~/.maestro/
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ~/.maestro/bin/maestro --version   # 2.12.1
```
- Java 17 필요(scripts/env.sh 의 openjdk@17). `run.sh` 가 `~/.maestro/bin` 을 PATH 에 넣고 익명 분석을 끈다(`MAESTRO_CLI_NO_ANALYTICS=1`).

## 2. 실행
```bash
cp app/src/lib/config.local.example.ts app/src/lib/config.local.ts   # 처음 한 번. 기본이 API_MODE 'fake'
app/e2e/run.sh                                  # flows/ 전부
app/e2e/run.sh flows/f1-parent-connect-course.yaml   # 하나만
SKIP_BUILD=1 app/e2e/run.sh                      # APK 가 이미 있으면 빌드 생략(설치는 함)
app/e2e/run.sh --metro-port 8091               # 맥 8081 을 다른 Metro 가 쓰고 있을 때(METRO_PORT=8091 과 같음). 포트를 APK 에 넣어 빌드한다 — 아래 'Metro 포트'
SKIP_INSTALL=1 app/e2e/run.sh                    # 이미 설치된 앱으로(JS 만 바뀌었을 때)
# 감사 캡처(끝나면 기기 설정을 되돌림)
DP_SIZE=360x640 app/e2e/run.sh audit/audit-points.yaml   # 화면 크기(dp)
FONT_SCALE=2.0  app/e2e/run.sh audit/audit-points.yaml   # 글자 배율
REDUCE_MOTION=1 app/e2e/run.sh audit/audit-points.yaml   # 애니메이션 0(동작 줄이기 근사)
```
- **기기 고정**: 모든 adb·maestro 호출은 `ANDROID_SERIAL` 한 기기만 쓴다. 없으면 연결된 기기가 하나일 때만 진행하고 둘 이상이면 멈춘다(감사관 등 다른 실행의 에뮬레이터를 깨지 않게).
  ```bash
  adb devices                                            # 지금 기기 확인
  ANDROID_SERIAL=emulator-5554 app/e2e/run.sh            # 이 기기만
  # 두 실행을 동시에: 다른 기기 + 다른 Metro 포트. emulator-NNNN 이 꺼져 있으면 그 포트로 AVD 를 읽기 전용으로 켠다
  ANDROID_SERIAL=emulator-5556 AVD=gahwa_small METRO_PORT=8091 app/e2e/run.sh
  ```
- **run.sh 가 도는 동안 run.sh 를 고치지 않는다**(bash 는 실행 중 스크립트를 이어 읽어, 고친 뒤 엉뚱한 줄을 실행할 수 있다).
`run.sh` 순서: fake 설정 확인 → 기기가 없으면 AVD `gahwa_parent` 를 화면 없이 켬 → `assembleStagingDebug -PreactNativeDevServerPort=$METRO_PORT` → 설치 → `adb reverse tcp:$METRO_PORT tcp:$METRO_PORT`(실기기용, 시작 전에 없었을 때만 걸고 끝나면 그것만 지움) → Metro 없으면 켬(끝나면 끔) → `maestro test` → `e2e/out/<시각>/`(캡처 PNG·`report.xml`, gitignore).

- **Metro 포트**(2026-11-25, #272에서 발견): 에뮬레이터의 디버그 앱은 `adb reverse` 가 아니라 **10.0.2.2:<포트>(맥)** 로 붙는다(RN `AndroidInfoHelpers`: 에뮬레이터 → 10.0.2.2). 그래서 예전 `adb reverse tcp:8081 tcp:8091` 은 효과가 없었고, 맥 8081 에 다른 Metro(다른 worktree·프로젝트)가 떠 있으면 앱이 그쪽에 붙어 **404**('The development server returned response error code: 404')가 났다.
  - 지금은 `--metro-port`(또는 `METRO_PORT`) 값을 빌드 때 `-PreactNativeDevServerPort` 로 APK 리소스(`react_native_dev_server_port`)에 넣는다. 앱 코드 기본값(8081)과 다른 빌드 방법은 그대로다 — e2e 빌드만 바뀐다.
  - 개발 메뉴의 서버 주소(`debug_http_host`)를 손으로 바꾸는 방법은 `clearState` 가 지운다. 빌드에 넣은 포트는 지워지지 않는다.
  - APK 옆 `app-staging-debug.apk.metro-port` 에 빌드한 포트를 적는다. `SKIP_BUILD=1` 로 다른 포트의 APK 를 쓰려 하면 멈춘다(표시가 없으면 8081 로 본다).
  - **같은 worktree 에서 포트만 바꿔 두 실행을 겹치지 않는다**: APK 경로가 포트와 상관없이 하나(`android/app/build/.../app-staging-debug.apk`)라 뒤 실행의 빌드가 앞 실행의 APK·포트 표시를 덮는다. 동시에 돌리려면 worktree 를 나눈다(#278 QA-1 L3).
  - 포트는 `--metro-port 8091`·`--metro-port=8091`·`METRO_PORT=8091` 모두 1024~65535 숫자만 받는다(아니면 빌드 전에 멈춤). `adb reverse` 는 시작 전에 같은 기기 포트가 없을 때만 걸고, 끝나면 **우리가 건 것만** 지운다(#278 QA-1 L1·L2, 판단 도우미 `lib.sh`, 셸 시험 `bash app/e2e/lib.test.sh`).
- 빌드는 **stagingDebug + config.local.ts fake**: 디버그 빌드에서만 config.local.ts 가 env 값을 덮으므로 서버에 붙지 않는다(RELEASE.md 2절). fake 코드 규칙(123456 성공, 000000 used …)은 dev-app-notes 6a.
- 캡처는 Maestro `takeScreenshot`(기기 화면)만 쓴다. 맥 화면 캡처(screencapture 등)는 쓰지 않는다 — 다른 창이 찍힐 수 있다. 에뮬레이터 창을 직접 찍어야 하면 우리 앱이 최상단인지 먼저 확인.
- 실패하면 `~/.maestro/tests/<시각>/` 에 Maestro 자체 로그·실패 캡처가 남는다.

## 3. 흐름 목록
| 파일 | 경로 | 상태 |
|---|---|---|
필수 5개(13 AU-12, `docs/design/v3/_qa/2026-11-18-maestro-candidates.md` F1·F2·F5·F6·F9). 모두 fake API.

| 파일 | 경로 | 감사 캡처 |
|---|---|---|
| `flows/f1-parent-connect-course.yaml` | FS → P1 0·3·6자리 → P1c → P2 동의 → P3 0/3 → P4 → P5 → P6(쓰기 → 이대로 마칠게요) → P7 → P3 3/3 | P1 안심 줄, P3 단계 체크, P7 연출·끝 |
| `flows/f2-unlinked-course.yaml` | P1 '코스 보기' → P3 미연결 띠 → 세 단계(P6 넘어가기) → P7 미연결 둘째 줄 → P3 미연결 3/3 | 띠·P7 미연결 |
| `flows/f5-child-login-wait-home.yaml` | 자녀 → C0 카카오(fake 성공) → C1 엄마 → C2 번호 → C3 대기·복사 토스트 → (개발자 메뉴로 어르신 연결) → C4 | C3 복사 토스트 |
| `flows/f6-cheer-roundtrip.yaml` | F5 의 C4 → 응원 시트 → '늘 고마워요' → 토스트(4~6초 취소 시간) → 어르신 전환 → P8 응원 상자 → 알겠어요 | C4 시트·토스트·P8 |
| `flows/f9-parent-delete.yaml` | 연결 → P13 '모두 지우기' → P9 → (2차 확인) → P10 → 처음으로(P1) | P13·P9·P10 |
| `audit/audit-points.yaml` | 감사 지점 모음(P1 안심 줄, 설정 답 보여 주기, P7 연출) — `DP_SIZE`·`FONT_SCALE`·`REDUCE_MOTION` 과 함께 | 전부 |

- 공용 조각: `common/parent-connect.yaml`(어르신 연결까지), `common/child-to-wait.yaml`(자녀 C3 까지), `common/child-linked-home.yaml`(개발자 메뉴로 어르신 연결 → C4), `common/dev-menu.yaml`(버전 줄 7번 → 역할 전환), `common/dismiss-system-dialogs.yaml`, `common/dismiss-logbox.yaml`(개발 경고 LogBox 알림 닫기, 기본 크기 좌표).
- 공용 조각은 **100%와 200% 모두**에서 끝까지 가야 한다. 첫 화면 밖 요소(200%의 키 4~0 줄, P2 '좋아요', 자녀 설정 '앱 정보', 개발자 메뉴 역할 버튼)는 `edge-scroll.yaml`로 민 뒤 누른다. 점검: `DP_SIZE=320x640 FONT_SCALE=2.0 app/e2e/run.sh --metro-port 8091 audit/common-200.yaml`(100%도 같은 파일). 근거: `docs/team/qa/evidence/2026-11-25-maestro`.
- 두 기기 흐름(F5·F6)은 **개발자 메뉴 역할 전환 + 같은 fake 상태**로 한 기기에서 흉내 낸다(fake `sendCheer` 가 어르신 안 읽은 응원에 쌓임). 역할 전환은 앱을 처음부터 다시 그리므로 C3 '연결됨' 감지 화면은 지나지 않는다(jest 몫). 실제 두 기기 왕복은 QA-05.
- P6 한글 입력: Maestro 의 Android 글자 입력은 ASCII 만 확실해서 'a' 를 쓰고 '이대로 마칠게요'로 끝낸다.
- 전환 중 계속 움직이는 화면에서는 `tapOn` 의 안정 대기가 수 분 걸릴 수 있다 → 그 탭에 `waitToSettleTimeoutMs: 1000`.

## 4. 요소 찾기 규칙(testID)
1. **먼저 사람에게 보이는 글자·화면 읽기 라벨**로 찾는다(TalkBack 이 읽는 것 = 사용자가 보는 것, 라벨 회귀도 함께 잡힘). 정규식이므로 `?`·`.` 등은 `\?` 로. 제목에는 줄바꿈·묶음 문자(NBSP·U+2060)가 섞이므로 띄어쓰기 자리는 `.*` 로(예 `'가족에게 받은.*'`).
   - 막 켠 에뮬레이터의 시스템 ANR 창("Process system …", "System UI isn't responding")은 `common/dismiss-system-dialogs.yaml` 로 닫는다(launchApp 바로 뒤). 우리 앱 ANR 창은 닫지 않는다.
2. 글자가 같은 요소가 여럿이거나, 글자가 없는 요소(아이콘·사진·칸), 문구가 자주 바뀌는 곳만 `testID` 를 단다.
3. 이름: `<화면>-<요소>` 케밥 표기(예 `connect-keypad`, `course-step-photo`). 공용 컴포넌트는 기본 testID 를 갖고 호출부가 덮을 수 있게(`Banner`·`BottomSheet`·`Photo` 방식).
4. testID 는 화면 읽기에 노출되지 않는다(Android `resource-id`) — 라벨 대신 쓰지 않는다.
   - `accessible` 로 묶인 행(예 버전 줄 `version-tap`)은 Maestro 계층에서 resource-id 가 보이지 않을 수 있다 → 그 경우 라벨 글자로 찾는다.
5. 문구 키가 바뀌면 그 문구로 찾는 flow 도 같은 커밋에서 고친다(copy.ko.json 원본 기준).

## 안정화 기록(2026-11-18, F6 불안정 · 감사 하네스 후속)
- **원인 1 — 시스템 ANR 창**: 첫 화면은 떴는데 "Process system isn't responding" 창이 위를 덮어 60초 대기가 실패(맥이 빌드·jest 로 바쁠 때 에뮬레이터가 느려져 뜸). → `run.sh` 가 실행 동안 `settings global hide_error_dialogs=1`(앞 값을 읽은 경우에만 바꾸고 끝나면 되돌림, `HIDE_DIALOGS=0` 으로 끔) + 공용 `common/wait-first-screen.yaml`(10초씩 최대 120초, 사이마다 **시스템 창만** 닫기). 숨김은 모든 앱의 창을 숨기므로 `run.sh` 가 실행 전 `logcat -c`, 끝나면 `ANR in <앱>`·`am_anr`·`FATAL EXCEPTION … Process: <앱>` 이 있으면 **흐름이 통과해도 실패**(`out/<시각>/anr-crash.txt`·`logcat.txt`).
- **같은 기기에 두 실행을 겹치지 않는다**(되돌릴 값이 엉킴, 리뷰 L2). 강제 종료(kill -9)면 되돌리지 못한다 — `-read-only` 로 켠 에뮬레이터는 끌 때 원래대로.
- **원인 2 — 빠른 스크롤이 행을 누름**: `scrollUntilVisible` 이 화면 가운데서 빠르게 끌어 어르신 설정의 '연결된 가족' 행이 눌려 P16 으로 넘어감(그래서 버전 줄을 못 찾음). → `common/edge-scroll.yaml`(왼쪽 9% 에서 600ms 로 천천히 끌기 — 효과는 느린 속도. 9% 는 제스처 내비 뒤로 영역 밖), 개발자 메뉴 진입(`dev-menu.yaml`)도 같은 방식 + 7번 탭은 `waitToSettleTimeoutMs: 200`. gahwa_parent 는 **제스처 내비**(`navbar.gestural`)이고 이 기기에서 검증했다.
- **원인 3 — Metro 연결**: 에뮬레이터가 바쁠 때 앱이 Metro 를 못 찾아 "Unable to load script"(자산 번들 없음). 맥이 한가할 때 다시 돌리면 통과 — E2E 는 빌드·jest 와 동시에 돌리지 않는다. gahwa_parent 는 `adb reverse` 대신 10.0.2.2:8081 로 붙는 것으로 보여(감사 §8) `METRO_PORT` 는 8081 그대로 둔다. → 11-25 확인: 모든 에뮬레이터가 10.0.2.2 로 붙는다. 다른 포트는 `--metro-port` 로 빌드에 넣는다(2절 'Metro 포트').
- F1: 자판이 이미 닫힌 상태의 `hideKeyboard` 가 '뒤로'가 되어 앱을 벗어난 1회 → 버튼이 가려졌을 때만 닫기(자판이 열려 있어도 버튼이 보이면 `f1-p6` 캡처에 자판이 남을 수 있음, 리뷰 L5). F9: 2차 확인 '정말 모두 지울까요?' 를 `extendedWaitUntil` 로 기다린 뒤 누름(필수 단계 — 사라지면 실패, 리뷰 M2).
- `wait-first-screen` 은 앱이 크래시해 런처로 나가도 120초를 다 쓴 뒤 실패한다(거짓 통과는 아님, 리뷰 L4).
- **원인 4 — env.generated.ts 덮어쓰기(빌드)**: `assembleStagingDebug` 그래프에 `:app:preProductionDebugBuild` 가 늘 끼어 나중 쪽이 `env.generated.ts` 를 production 값으로 덮음 → Metro 앱이 production 처럼 동작해 개발자 메뉴가 막힘(F5·F6 '개발자 메뉴' 실패, 그전 통과는 순서 운). → `app/build.gradle` generate 가 요청 작업 이름의 변형만 씀.
- **원인 5 — 설정→앱 정보 전환 경쟁**: 전환 중 설정 행의 '버전 1.0.0' 보조 글을 버전 줄로 눌러 탭이 사라짐 → 앱 정보('AI가 만든 것')가 뜬 뒤 탭.
- 결과(2026-11-19, emulator-5554 gahwa_parent 제스처 내비, read-only, 맥 한가할 때): `HIDE_DIALOGS=0` **5/5 통과**(6분 29초, 앱 ANR·크래시 0) → 숨김 없이도 통과 = 120초 대기 루프와 부하 분리로 충분, 숨김은 안전망. 기본(숨김) **5/5 통과**(6분 41초, ANR·크래시 0).
- 참고: 맥이 바쁠 때(11-18 22:20) F1 실패 순간 logcat 에 **우리 앱 ANR**(P6 자판 'a' 입력 KeyEvent 5초 대기)이 있었다. 부하 없는 위 두 실행에서는 재현 안 됨 — 어르신 레인 전달.
