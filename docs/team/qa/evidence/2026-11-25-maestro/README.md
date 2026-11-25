# Maestro 5흐름 재실행 + 200% 공용 흐름 + Metro 포트 (대기열 41·45) · 2026-11-25

마지막으로 5흐름이 모두 초록이었던 때는 11-19 07:46이다. 그 뒤 #255(gorhom 바텀시트) 등이 들어갔다. 지금 main에서 다시 돌렸다.
200%에서 막히던 공용 흐름(#272 README)도 고쳤다. 맥 8081에 다른 Metro가 떠 있으면 앱이 404를 내던 문제도 e2e 스크립트에서 풀었다.

## 조건

- **기기**: 에뮬레이터 gahwa_small(emulator-5556, `-read-only`, 창 없음, run.sh가 켬). S25는 건드리지 않았다.
- **빌드**: main `ae1349e2`(#274 병합 뒤) + 이 브랜치의 e2e 변경.
  - `run.sh --metro-port 8091`이 `assembleStagingDebug -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8091`로 빌드해 에뮬레이터에만 설치했다.
- **Metro**: 8091(run.sh가 켜고 끔). 맥 8081의 다른 Metro는 건드리지 않았다.
- **부하**
  - 작업 시작 때 1분 평균은 1.6이었다. 실행 시작 때는 대부분 1.9~9.4였다.
  - 15를 넘긴 회차가 셋 있다.
    - 200% 첫 회(15.3): 실패했지만, 원인은 부하가 아니라 밀기 횟수 부족이었다(아래).
    - 마지막 100% 전체 회차(18.1): 다른 레인 부하였다.
    - 마지막 200% 회차(15.5).
  - 뒤의 두 회차는 통과했다. 다시 돌려 부하를 더하지 않았다.
- **임시**: `config.local.ts`(fake)는 예시를 복사해 쓰고 끝난 뒤 지웠다. 앱 코드는 바꾸지 않았다.

## 결과 표

| 흐름 | 100% 첫 회 (20:32) | 실패 원인과 고친 것 | 100% 마지막 (21:03) |
|---|---|---|---|
| F1 어르신 연결 → 코스 완료 | 통과 1m22s | — | 통과 1m35s |
| F2 미연결 열람 | **실패**: `'번호를 받으면 그때부터 답이 저장돼요'`가 없음 | **선택자**: 문구가 W-05(`24a8eff6`)에서 `'번호를 받으면 답이 저장돼요'`(`course.disconnected_banner`)로 줄었는데 흐름은 그대로였다 → 흐름 문구를 고침 | 통과 38s |
| F5 자녀 로그인 → 대기 → 홈 | 통과 1m44s. 20:50 회차는 **실패** | **타이밍**: '복사하기'가 개발 경고를 내고, 그 LogBox 알림('Open debugger to view warnings.')이 뜨는 때에 따라 자녀 설정 '앱 정보' 행을 덮었다. 그래서 탭이 알림에 들어갔다 → `common/dismiss-logbox.yaml` | 통과 1m59s |
| F6 응원 왕복(gorhom 시트) | 통과 2m19s | — | 통과 2m23s |
| F9 어르신 모두 지우기 | 통과 1m07s | — | 통과 1m09s |
| 공용 흐름 점검 `audit/common-200.yaml`(새로 만듦) | — | — | 통과 2m30s |

- **마지막 결과**
  - 21:03, 100%: F1·F2·F5·F6·F9와 공용 점검까지 **6/6 통과**했다. 앱 ANR·크래시는 0이었다(`app/e2e/out/20261125-210258`, gitignore).
  - 21:13, 200%(`DP_SIZE=320x640 FONT_SCALE=2.0`): 공용 점검 **통과**, ANR·크래시 0(`out/20261125-211325`).
- F6 응원 시트(#255 gorhom)는 100%에서 그대로 통과했다(시트 열기 → 문장 누르기 → 토스트 → 어르신 전환 → P8). 선택자·시트 탭·타이밍 문제는 없었다. 세 번 돌려 세 번 다 통과했다.
- **앱 레인 몫(이 PR에서 고치지 않음)**: `app/src/ui/clipboard.ts` 9행이 `react-native/Libraries/Components/Clipboard/Clipboard`를 깊게 import한다. 그래서 RN 경고 'Deep imports from the 'react-native' package are deprecated'가 난다(logcat `W/ReactNativeJS`). 이 경고가 F5 LogBox 알림의 출처다. 고치면 `dismiss-logbox.yaml`은 안전망으로만 남는다.

## 200% 공용 흐름 (②)

`audit/common-200.yaml`은 `parent-connect` → `child-to-wait` → `child-linked-home`을 차례로 돈다. 100%와 200%에서 모두 통과했다.

| 막히던 곳 | 고친 곳 | 방법 |
|---|---|---|
| P1 키 4~0 줄이 첫 화면 밖(#272) | `common/parent-connect.yaml`, `common/child-linked-home.yaml` | '3' 뒤에 `edge-scroll.yaml`(TARGET `'0'`)을 넣었다. 왼쪽 9%에서 천천히 민다. 100%는 '0'이 이미 보여 밀지 않는다 |
| P2 '좋아요'가 본문 끝(#272) | 같은 두 파일 | `edge-scroll.yaml`(TARGET `'좋아요'`)로 민 뒤 누른다 |
| 자녀 설정 '앱 정보'가 첫 화면 밖이라 `extendedWaitUntil '앱 정보'`가 실패(#272) | `common/child-linked-home.yaml` | 설정 목록 묶음 `id: c7-block`으로 기다린 뒤, 기존 edge-scroll로 '앱 정보'까지 민다 |
| 개발자 메뉴 상자 안 역할 버튼이 상자 아래(#272) | `common/dev-menu.yaml` | `scrollUntilVisible`(`${ROLE_LABEL}`, 100% 보임)로 민 뒤 누른다 |
| 어르신 설정(P13) 200%에서 8번 밀어도 버전 줄에 닿지 못함(200% 첫 회 실패, step-140 캡처) | `common/dev-menu.yaml` | 밀기 반복을 8에서 20으로 늘렸다(보이면 바로 멈춤) |
| LogBox 개발 경고 알림이 아래 행을 덮음(F5) | `common/dismiss-logbox.yaml`(새로 만듦) | 알림이 보일 때만 오른쪽 X를 좌표(92%, 91%)로 누른다. 알림 본체를 누르면 맥에서 디버거를 열려 하므로 누르지 않는다. X는 라벨이 없어 `rightOf` 선택자로 찾지 못했다(실측) |

- 본문 스크롤은 기존 `edge-scroll`을 썼다. `scrollUntilVisible`은 화면 가운데에서 빠르게 끌어 행을 누를 수 있기 때문이다(e2e README 안정화 원인 2). 개발자 메뉴 상자 안은 누를 것이 역할 버튼뿐이라 `scrollUntilVisible`을 썼다.
- `dismiss-logbox.yaml`의 좌표는 기본 크기(1080×2340, 글자 100%) 실측값이다. 다른 크기에서 알림이 뜨면 좌표가 빗나갈 수 있다. 그때는 다음 단계가 실패해 알려 준다.

캡처(200%, 20:47 통과 회차, `out/20261125-204721`):

| 파일 | 장면 |
|---|---|
| `200-c200-parent-p2.png` | P2 동의(밀기 전) |
| `200-c200-parent-p3.png` | 연결·동의 뒤 P3 |
| `200-c200-child-p1c-from-child.png` | 자녀 → 개발자 메뉴 → 어르신 P1c |
| `200-c200-child-c4.png` | 다시 자녀 → C4 앨범(연결됨, 응원 보내기) |

## Metro 포트 (③)

- **원인**
  - 에뮬레이터의 디버그 앱은 `adb reverse`가 아니라 `10.0.2.2:<포트>`(맥)로 붙는다(RN `AndroidInfoHelpers.getServerIpAddress`: 에뮬레이터 → 10.0.2.2).
  - 포트는 APK 리소스 `react_native_dev_server_port`이고, 기본값은 8081이다.
  - 그래서 예전 run.sh의 `adb reverse tcp:8081 tcp:8091`은 효과가 없었다. 맥 8081에 다른 Metro가 떠 있으면 앱이 그쪽에 붙어 404가 났다(#272에서 발견).
- **고침**(`app/e2e/run.sh`)
  - 맨 앞 인자로 `--metro-port <n>`을 받는다(`METRO_PORT`와 같음).
  - 빌드 때 `-PreactNativeDevServerPort=$METRO_PORT`로 포트를 APK에 넣는다(RN gradle 플러그인 `AgpConfiguratorUtils.configureDevServerLocation`). 앱 코드 기본값은 그대로다.
  - APK 옆 `app-staging-debug.apk.metro-port`에 빌드한 포트를 적는다. `SKIP_BUILD=1`일 때 포트가 다르면 멈춘다.
  - reverse는 실기기용으로 `tcp:$METRO_PORT tcp:$METRO_PORT`를 걸고, 끝나면 지운다.
- **확인**
  - 맥 8081에 다른 Metro가 떠 있는 상태였다. 그래도 위 모든 실행이 8091 Metro에 붙어 통과했다. 공용 흐름은 `clearState`를 쓴다.
  - 개발 메뉴 `debug_http_host`를 손으로 바꾸는 방법(#272에서 쓴 것)은 `clearState`가 지워서 e2e에는 쓸 수 없다.
- **문서**: `app/e2e/README.md` 2절 'Metro 포트', 실행 예, `run.sh` 순서 줄, 안정화 원인 3.

## 끝난 뒤

- 기기 값을 확인했다: size 1080×2340, density 440, 글자 1.0, TalkBack null, hide_error_dialogs null, 애니메이션 1, reverse 없음.
- 에뮬레이터를 껐다(`adb devices` 비어 있음). Metro 8091이 더는 듣지 않는 것을 확인했다. `config.local.ts`는 지웠다.
