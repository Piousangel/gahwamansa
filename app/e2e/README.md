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
app/e2e/run.sh flows/parent-first-connect.yaml   # 하나만
SKIP_BUILD=1 app/e2e/run.sh                      # APK 가 이미 있으면 빌드 생략(설치는 함)
METRO_PORT=8091 app/e2e/run.sh                   # 다른 Metro 가 8081 을 쓰고 있을 때
```
`run.sh` 순서: fake 설정 확인 → 기기가 없으면 AVD `gahwa_parent` 를 화면 없이 켬 → `assembleStagingDebug` → 설치 → `adb reverse tcp:8081 tcp:$METRO_PORT` → Metro 없으면 켬(끝나면 끔) → `maestro test` → `e2e/out/<시각>/`(캡처 PNG·`report.xml`, gitignore).

- 빌드는 **stagingDebug + config.local.ts fake**: 디버그 빌드에서만 config.local.ts 가 env 값을 덮으므로 서버에 붙지 않는다(RELEASE.md 2절). fake 코드 규칙(123456 성공, 000000 used …)은 dev-app-notes 6a.
- 캡처는 Maestro `takeScreenshot`(기기 화면)만 쓴다. 맥 화면 캡처(screencapture 등)는 쓰지 않는다 — 다른 창이 찍힐 수 있다. 에뮬레이터 창을 직접 찍어야 하면 우리 앱이 최상단인지 먼저 확인.
- 실패하면 `~/.maestro/tests/<시각>/` 에 Maestro 자체 로그·실패 캡처가 남는다.

## 3. 흐름 목록
| 파일 | 경로 | 상태 |
|---|---|---|
| `flows/parent-first-connect.yaml` | 첫 화면 → 부모님 → 번호(123456) → 확인(P1c) → 연결 → 동의 화면 | 통과(2026-11-18, gahwa_parent) |
| (AU-12 남은 4개) | 코스 완료, 미연결 열람, 자녀 로그인→번호→대기→홈, 응원 왕복, 삭제 | 미착수 |

## 4. 요소 찾기 규칙(testID)
1. **먼저 사람에게 보이는 글자·화면 읽기 라벨**로 찾는다(TalkBack 이 읽는 것 = 사용자가 보는 것, 라벨 회귀도 함께 잡힘). 정규식이므로 `?`·`.` 등은 `\?` 로. 제목에는 줄바꿈·묶음 문자(NBSP·U+2060)가 섞이므로 띄어쓰기 자리는 `.*` 로(예 `'가족에게 받은.*'`).
   - 막 켠 에뮬레이터의 시스템 ANR 창은 `common/dismiss-system-dialogs.yaml` 로 닫는다(launchApp 바로 뒤).
2. 글자가 같은 요소가 여럿이거나, 글자가 없는 요소(아이콘·사진·칸), 문구가 자주 바뀌는 곳만 `testID` 를 단다.
3. 이름: `<화면>-<요소>` 케밥 표기(예 `connect-keypad`, `course-step-photo`). 공용 컴포넌트는 기본 testID 를 갖고 호출부가 덮을 수 있게(`Banner`·`BottomSheet`·`Photo` 방식).
4. testID 는 화면 읽기에 노출되지 않는다(Android `resource-id`) — 라벨 대신 쓰지 않는다.
5. 문구 키가 바뀌면 그 문구로 찾는 flow 도 같은 커밋에서 고친다(copy.ko.json 원본 기준).
