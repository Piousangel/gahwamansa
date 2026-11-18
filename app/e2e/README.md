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
METRO_PORT=8091 app/e2e/run.sh                   # 다른 Metro 가 8081 을 쓰고 있을 때
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
`run.sh` 순서: fake 설정 확인 → 기기가 없으면 AVD `gahwa_parent` 를 화면 없이 켬 → `assembleStagingDebug` → 설치 → `adb reverse tcp:8081 tcp:$METRO_PORT` → Metro 없으면 켬(끝나면 끔) → `maestro test` → `e2e/out/<시각>/`(캡처 PNG·`report.xml`, gitignore).

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

- 공용 조각: `common/parent-connect.yaml`(어르신 연결까지), `common/child-to-wait.yaml`(자녀 C3 까지), `common/child-linked-home.yaml`(개발자 메뉴로 어르신 연결 → C4), `common/dev-menu.yaml`(버전 줄 7번 → 역할 전환), `common/dismiss-system-dialogs.yaml`.
- 두 기기 흐름(F5·F6)은 **개발자 메뉴 역할 전환 + 같은 fake 상태**로 한 기기에서 흉내 낸다(fake `sendCheer` 가 어르신 안 읽은 응원에 쌓임). 역할 전환은 앱을 처음부터 다시 그리므로 C3 '연결됨' 감지 화면은 지나지 않는다(jest 몫). 실제 두 기기 왕복은 QA-05.
- P6 한글 입력: Maestro 의 Android 글자 입력은 ASCII 만 확실해서 'a' 를 쓰고 '이대로 마칠게요'로 끝낸다.
- 전환 중 계속 움직이는 화면에서는 `tapOn` 의 안정 대기가 수 분 걸릴 수 있다 → 그 탭에 `waitToSettleTimeoutMs: 1000`.

## 4. 요소 찾기 규칙(testID)
1. **먼저 사람에게 보이는 글자·화면 읽기 라벨**로 찾는다(TalkBack 이 읽는 것 = 사용자가 보는 것, 라벨 회귀도 함께 잡힘). 정규식이므로 `?`·`.` 등은 `\?` 로. 제목에는 줄바꿈·묶음 문자(NBSP·U+2060)가 섞이므로 띄어쓰기 자리는 `.*` 로(예 `'가족에게 받은.*'`).
   - 막 켠 에뮬레이터의 시스템 ANR 창은 `common/dismiss-system-dialogs.yaml` 로 닫는다(launchApp 바로 뒤).
2. 글자가 같은 요소가 여럿이거나, 글자가 없는 요소(아이콘·사진·칸), 문구가 자주 바뀌는 곳만 `testID` 를 단다.
3. 이름: `<화면>-<요소>` 케밥 표기(예 `connect-keypad`, `course-step-photo`). 공용 컴포넌트는 기본 testID 를 갖고 호출부가 덮을 수 있게(`Banner`·`BottomSheet`·`Photo` 방식).
4. testID 는 화면 읽기에 노출되지 않는다(Android `resource-id`) — 라벨 대신 쓰지 않는다.
   - `accessible` 로 묶인 행(예 버전 줄 `version-tap`)은 Maestro 계층에서 resource-id 가 보이지 않을 수 있다 → 그 경우 라벨 글자로 찾는다.
5. 문구 키가 바뀌면 그 문구로 찾는 flow 도 같은 커밋에서 고친다(copy.ko.json 원본 기준).
