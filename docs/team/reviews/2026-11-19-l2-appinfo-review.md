# l2-appinfo 독립 리뷰 (2026-11-19)

- 대상: `git diff main...l2-appinfo` = e43e093(P13 알림 행 → AU-04 `pushReceive`/`setPushReceive`), 9ba0bc0(`features/account/AppInfoRows.tsx` 앱 정보 한 목록, BGM 2곡 `src/assets/bgm` + `lib/bgmAsset.ts` `RELEASED=false` + 개발자 메뉴 미리 듣기), 4bb62a4(main 합침). 15파일 +271/−61.
- 기준: `docs/team/legal/in-app-notices.md` §3, `2026-11-18-app-push-review.md` M1(끄면 다시 묻지 않음·켤 때 권한 있으면 토큰 등록), 디자인 판정 M8(`docs/design/v3/_qa/2026-11-18-independent-ux-audit.md:188`), `2026-11-18-webview-review.md` L5(useInAppWeb).
- 리뷰어: 독립(작성자 아님).

## 판정

**높음 0 / 중간 1 / 낮음 9 → 합치기 가능(조건 없음, M1은 다음 커밋에서 고칠 것을 권함).**
production에서 `[설정 필요]`·개발자 메뉴·BGM이 보이지 않는다는 점은 근거로 확인했다(아래 표). M1은 이 브랜치 전부터 있던 분기지만, "권한 없는 상태에서 켤 때"가 이번 행의 몫이라 지적한다.

## 중점 확인

| 중점 | 결과 | 근거 |
|---|---|---|
| §3 행 순서 | 일치 | `AppInfoRows.tsx` 약관 → 방침 → 오픈소스 → AI(사진·음악) → 병원 아님 → 사업자(펼침) → 문의 → (호출부) 버전. `parentAppInfo.test` 순서 단언 |
| M8 숨기지 않음 | 일치(색만 다름, L1) | 값이 없어도 7행 모두 그린다. 빈 값 표시는 `dev = APP_ENV !== 'production'`일 때만 |
| 끄기/켜기 | M1 규칙 일치 | `setReceive`(pushClient.ts:177): 서버 성공 뒤 N1 기억 `on ? 'yes' : 'off'`, 켤 때 `granted`면 `registerToken`. 실패면 `!next`로 되돌리고 offline/server 문구 구분(NotifyRows.tsx:76-80). 두 번 누름은 `useBusyLatch`(ref) |
| 실패 시 롤백 | 맞음 | `setReceive` 내부(tagOf·writeAnswer·registerToken·readNotifyPermission)가 모두 예외를 삼켜 값으로 돌려준다. NotifyRows에서 `catch`가 빠졌어도 지금은 처리되지 않은 거부가 없다(L5) |
| production `[설정 필요]` | 안 보임 | `getAppEnv().APP_ENV`는 Gradle이 flavor별로 만든 `env.generated.ts`(production flavor → `production`, release 번들 직전 `generate()`, build.gradle:425-437). 값이 비면 production release는 빌드 실패(`-PrequireRealEnv`에서 `allowMissingAppInfo` 무시) |
| production 개발자 메뉴·BGM 미리 듣기 | 안 보임 | 미리 듣기 버튼은 `DevMenuHost.tsx`에만 있고 production은 `metro.release.config.js`가 `DevMenuHost.stub.tsx`로 바꾼다 + `verifyReleaseBundle` 산출물 검사. `setBgmPreview` 호출부는 그 메뉴 하나 |
| production BGM | 안 보임 | `RELEASED=false` + `preview=false` → `bgmAsset()` null → P3·P7·P13 음악 요소와 AI 음악 고지 숨김. 음원 파일은 APK에 들어간다(L7) |
| 음원 크기·출처 | 적절 | 각 310·314KB, 모노 AAC 82kbps, 30.0초(`afinfo`). `content/audio`와 바이트 동일. `docs/team/assets-manifest.md` §8에 모델(lyria-3-clip-preview)·날짜·프롬프트 위치·가공·LUFS·sha256·SynthID·권리 불확실성 기록, 고지 문구 `app_info.ai_music`·`bgm.offer_source`("AI(Google Lyria)가 만든 연주곡이에요") |
| 오프라인 안내 | 있음(L4) | 약관·방침은 `useInAppWeb` → 'offline'이면 화면을 열지 않고 `Banner kind=offline` 한 줄, 확인 동안 sub '불러오는 중'·잠금(webview L5 반영) |
| TalkBack | 대체로 맞음(L2·L3) | 누르지 않는 행은 `accessibilityRole="text"` + 이름·보조 글 한 덩어리, 알림 행은 `switch` + checked/disabled |
| 레이어 기준선 | 지킴 | `AppInfoRows`는 app/를 import하지 않고 라우트 타입을 직접 둔다. 바뀐 파일의 eslint 경고는 ParentSettings의 기존 4건뿐(새로 늘지 않음), `layerBaseline.test` 통과 |

## 중간

**M1. Android 13 이상에서 N1에 '괜찮아요'라고 답한 어르신은 P13에서 알림을 켤 수 없다. "휴대폰 설정에서 꺼져 있어요"만 보인다**
- 위치: `app/src/features/account/NotifyRows.tsx:44`, `:64-66` / `app/src/push/notifyNative.ts:36-46` / `app/src/push/pushClient.ts:191-193`
- 근거: N1 '괜찮아요'는 시스템 창을 띄우지 않는다(pushClient.ts:126 "켜기는 P13 설정에서"). 그래서 13 이상에서는 권한이 묻기 전 상태로 남고, `readNotifyPermission`은 이 상태를 `'denied'`로 돌려준다(주석: 묻기 전과 한 번 거절은 구분할 수 없음). NotifyRows는 `denied`도 `system: 'off'`로 보고 스위치 대신 `SystemOffRow`("휴대폰 설정에서 꺼져 있어요" + [휴대폰 설정 열기])를 그린다. 앱 안에서 켜는 길이 없다. `setReceive`도 켤 때 권한을 묻지 않고 `granted`일 때만 토큰을 등록한다.
- 영향: 아무것도 끈 적 없는 어르신에게 "꺼져 있어요"라는 틀린 안내가 나간다. 켜려면 ① 휴대폰 설정에서 앱 알림을 켜고 ② 앱으로 돌아와 꺼진 스위치를 한 번 더 눌러야 한다(서버는 아직 false). 어르신에게는 두 단계 모두 어렵고, "켜기는 P13에서"라는 N1 약속이 13 이상 기기에서 지켜지지 않는다. 출시 대상 기기는 대부분 13 이상이다.
- 고칠 방향: `'denied'`(다시 물을 수 있음)와 `'blocked'`를 나눈다. 서버 값이 false이고 `denied`면 스위치를 보이고, 켤 때 N1 '알려 주세요'와 같은 순서로 처리한다(set_push_enabled(true) → `requestNotifyPermission()` → granted면 `registerToken`, blocked면 `openNotifySettings()`). `setPushReceive`에 `request` 인자를 주거나 runtime에 `parentEnableFromSettings`를 둔다. `SystemOffRow`는 `blocked`일 때만 쓴다. 테스트에 "13+ 묻기 전(denied) + 서버 false → 스위치 보임 → 켜면 권한 창 → 허용이면 토큰 등록"을 넣는다. 서버가 true인데 denied인 경우는 지금처럼 설정 열기 행을 유지해도 된다.

## 낮음

**L1. `[설정 필요]`가 빨간 글이 아니다(M8 "빨간 '[설정 필요]'")** — `AppInfoRows.tsx:39·45·51·82·98`. 보통 보조 글(`inkSub`)과 같은 색이라 staging QA에서 눈에 덜 띈다. 코드 주석(16·23행)도 "빨간"이라고 적었다. `SettingsRow`에 `subTone="danger"`(dangerInk)를 더하거나 `[설정 필요]`만 따로 `Text20` 위험 색으로 그린다. 문의 행은 `[설정 필요] 준비하고 있어요`가 한 문자열이라 앞부분만 칠하려면 나눠야 한다.

**L2. 사업자 정보 펼침 행에 펼침 상태가 없다** — `AppInfoRows.tsx:65-71`. `onPress`로 여닫지만 `accessibilityState={{expanded: bizOpen}}`가 없어 TalkBack이 "펼쳐짐/접힘"을 읽지 않고, 펼쳐진 내용도 알리지 않는다. `SettingsRow`에 `accessibilityState`를 넘기는 prop을 더한다.

**L3. 약관·방침 확인 중 상태가 힌트로만 읽힌다** — `AppInfoRows.tsx:45·51`. 확인하는 동안 sub가 '불러오는 중'으로 바뀌지만 Pressable에서 sub는 `accessibilityHint`라 다시 읽히지 않고, `accessibilityState.busy`도 없다. 최대 4초 동안 화면 읽기 사용자는 아무 변화도 듣지 못한다. `busy`를 state로 넘기거나 짧게 `announce`한다.

**L4. 오프라인 배너가 연결이 돌아와도 남는다** — `AppInfoRows.tsx:33-37·54`. 다음에 누를 때만 지워진다. Banner 규칙(README §13)은 연결되면 같은 자리에서 success로 바꾼다. 다른 화면의 오프라인 배너와 같은 연결 상태 훅을 쓰거나, 최소한 화면에 다시 들어오면 지운다. `open`이 'busy'나 'unavailable'을 받았을 때도 배너를 지운 채 아무 안내가 없다(`unavailable`은 allowedWebUrl 거부 → 조용히 무반응).

**L5. 알림 토글에서 `catch`가 빠졌다** — `NotifyRows.tsx:74-83`. 지금은 `setReceive`가 모든 예외를 값으로 바꾸므로 문제가 없다. 하지만 나중에 runtime이나 pushClient가 한 줄이라도 던지면 낙관적 값이 남고 처리되지 않은 거부가 생긴다. `catch { setS(prev → !next); setFailed(server) }`를 방어로 되돌려 둔다.

**L6. 앱 복귀 때 다시 읽는 값이 진행 중인 토글을 덮을 수 있다** — `NotifyRows.tsx:30-59`. `AppState 'active'` → `load()`가 토글 요청 중에 서버를 읽고, 토글이 끝난 뒤에 응답이 오면 서버에 쓰기 전 값으로 스위치를 되돌린다(서버는 새 값). 휴대폰 설정에서 돌아오자마자 누를 때만 생긴다. `load` 결과를 반영하기 전에 `isBusy()`를 보거나, 순번(ref) 비교로 늦게 온 응답을 버린다.

**L7. 공개 전 음원도 production APK에 들어간다(+약 620KB)** — `lib/bgmAsset.ts:16-19`. `require`가 정적이라 `RELEASED=false`여도 res/raw에 번들된다. 재생되지는 않지만, 사람이 아직 귀로 확인하지 않은(manifest §8 "사람 귀 확인 필요") 파일이 출시 APK에서 뽑힐 수 있다. 청취 확인 전에 출시한다면 이 점을 받아들일지 정하고 DECISIONS에 적는다(대안: production은 `metro.release.config.js`에서 자산을 빈 대역으로 바꾼다). 저장소에도 `content/audio`와 같은 바이트가 두 벌 있다(원본 위치를 하나로 정하는 것을 권함).

**L8. 문서·주석이 M8 이전 규칙("값이 없으면 숨긴다, 자리표시 금지")을 그대로 말한다** — `lib/appInfo.ts:2·6·32`, `lib/env.ts:26`, `android/app/build.gradle:185·420·422`("설정 화면에서 숨겨짐"), `env/staging.env:22`·`env/production.env.example:22`. 지금은 숨기지 않고 `[설정 필요]`(개발·staging) 또는 누를 수 없는 행(production 확인용 빌드)이다. 문구를 고쳐 다음 작성자가 다시 숨기는 쪽으로 되돌리지 않게 한다. `setBgmAssetForTest` 주석(bgmAsset.ts:35)도 "null이면 숨김"이지만 실제로는 null → 실제 규칙이다. 지금은 RELEASED=false라 같지만, true로 바꾸는 날 null로 숨김을 기대한 테스트가 깨진다. null은 숨김으로 두고 undefined만 실제 규칙으로 쓰기를 권한다.

**L9. 테스트 빈틈** — ① `parentAppInfo.test` 약관 두 번째 누름은 `openInAppWeb` 호출 횟수만 보고 Web 화면이 열렸는지는 보지 않는다. ② 방침·문의 행, 음원 공개(`setBgmPreview(true)`) 때 AI 음악 고지 줄이 보이는지에 대한 단언이 없다. ③ P13 토글로 끈 뒤 N1이 다시 뜨지 않는지(M1 규칙)를 화면 단위로 확인하는 테스트가 없다(pushClient 단위 테스트만 있음). ④ `elderUx.test` 순서 단언이 '앱 정보' 라벨 대신 '오픈소스 라이선스'로 바뀌어 AI 고지가 그 단언에서 빠졌다(`firstScreenReview`가 문구를 따로 보므로 수용).

## 참고(문제 아님)
- 자녀 C7(`features/child/ChildAppInfo.tsx`)은 아직 옛 상수(`PRIVACY_URL`·`CONTACT_EMAIL`)를 쓰고, §3 한 목록(약관·오픈소스·사업자)과 M8 규칙이 들어가지 않았다. 이 브랜치의 범위 밖이지만 §3은 C7에도 적용된다. `AppInfoRows`를 자녀 화면에서도 쓸 수 있게 하면 같은 규칙이 두 번 갈리지 않는다(AI 음악 줄은 부모님만).
- 약관·방침이 `[설정 필요]`인 것은 M8 문구("고정 URL이라 늘 보인다")보다 넓지만, 숨기지 않는다는 취지에 맞아 수용한다.
- `-PallowMissingAppInfo` production 확인용 빌드에서는 빈 행이 보조 글 없이 누를 수 없는 행으로 보인다. 출시 경로에서는 빌드가 막으므로 수용한다.

## 실행 결과 (l2-appinfo 4bb62a4를 이 worktree에서 detached로 체크아웃해 실행)
- `cd app && npm ci`: 성공
- `npx tsc --noEmit`: 오류 0
- `npx eslint .`: 오류 0, 경고 31(모두 기존 no-restricted-imports. 바뀐 파일은 ParentSettings 기존 4건뿐, AppInfoRows·NotifyRows·bgmAsset·DevMenuHost는 0)
- `npx jest --testPathIgnorePatterns __integration__ --cacheDirectory <scratchpad>`: 1회차 99/100 스위트(957/958). `devMenu.test.tsx` "버전 7번 → 어르신으로 전환" 1건 실패. 단독 2회는 32/32 통과, 전체 2회차는 **100/100 스위트, 958/958 통과**. 병렬 부하에서 생기는 시간 문제로 보고, 이번 변경과는 관계가 없다고 판단(DevMenuHost는 버튼 하나만 더함).
- 에뮬레이터·실기기·통합 테스트(`__integration__`)는 돌리지 않았다. TalkBack 판단은 코드 읽기로만 했다.

## 재확인 (2026-11-19, `l2-notify-fix` df2bd22, main f9cdd69에서 분기)

**판정: M1·L1~L9 모두 해소, 새 문제는 낮음 3건(N1~N3) → 합치기 가능.**

| 지적 | 결과 | 근거 |
|---|---|---|
| M1 denied/blocked 분리 | 해소 | `NotifyRows` state `perm: ok/denied/blocked`. `SystemOffRow`는 blocked만. 켜기는 `runtime.parentEnableFromSettings`, 끄기는 `setPushReceive(false)`(N1 기억 'off') |
| └ 순서 | 맞음 | `setReceive(d, true, request)`: set_push_enabled(true) → 성공해야 N1 기억 'yes' → 권한 창 → granted면 `registerToken`. 테스트가 `invocationCallOrder`로 서버 호출이 권한 창보다 먼저인지 확인 |
| └ 실패 시 롤백 | 맞음 | 서버 실패(offline/no_profile)면 권한 창을 띄우지 않고 `!next`로 되돌림 + 문구. 예외는 새 `catch`가 되돌림(L5). 서버 성공 뒤 창에서 거절하면 서버 true가 남는다(N1 '알려 주세요'와 같은 규칙, 이전 리뷰에서 수용) → 아래 denied 줄로 이어짐 |
| └ blocked 결과 | 맞음 | 권한 창 결과가 blocked면 `openNotifySettings()` + 행이 `SystemOffRow`로. 휴대폰 설정에서 켜고 돌아오면 `PushHost` sync(AppState active → granted면 `registerToken`, PushHost.tsx:50-58)가 토큰을 등록한다 |
| 서버 켜짐 + denied | 동작함(N1·N2) | 스위치 아래 `notify-perm-denied`: 문구 `system_off.body` + [알려 주세요] → `requestNotifyPermission` → granted면 `parentEnableFromSettings(async () => perm)`로 토큰 등록(set_push_enabled(true) 재호출은 0037 처음 시각 유지로 멱등). blocked면 `SystemOffRow`로 바뀐다 |
| L1 빨간 `[설정 필요]` | 해소 | `SettingsRow badge`(dangerInk). 테스트가 색을 확인 |
| L2·L3 TalkBack | 해소 | 사업자 `accessibilityState.expanded`, 약관·방침 `busy` + `announce(loading)`. 테스트 있음 |
| L4 오프라인 줄 | 해소 | 화면 focus 때 지움 |
| L5 catch | 해소 | 위 |
| L6 경쟁 | 해소 | `toggles` 순번 ref + `isBusy()`: 읽기 시작 뒤 토글이 있었거나 진행 중이면 읽은 값을 버린다. 권한 창 때문에 앱이 background → active가 되어 생기는 `load`도 이 조건으로 버려지고, 토글 결과가 최종 값을 정한다. 끝난 뒤 다시 읽지는 않지만 토글 결과가 서버 응답 값이라 문제없다. 직접 겨냥한 테스트는 없음(N3) |
| L7 production 음원 제외 | 해소 | `metro.release.config.js:8-17` `resolveRequest` → `metroDevMenu.devMenuRedirect`: `src/lib/bgmAsset.ts`이고 APP_ENV가 staging·local이 아니며(불명 포함) 파일에 `const RELEASED = true`가 없으면 `bgmAsset.stub.ts`(require 없음 → 자산이 번들·res/raw에 안 들어감). stub API(`bgmAsset`·`setBgmPreview`·`bgmPreview`·`setBgmAssetForTest`·`BgmTrack`)가 원본과 같아 tsc 통과. `devMenu.test`가 production·불명·공개 뒤·staging·실제 파일·stub에 `require(` 없음을 단언. 정규식이 틀리면 음악이 빠지는 쪽(fail-closed)이다 |
| L8 주석 | 해소 | appInfo·env·build.gradle·env 예시 갱신, `setBgmAssetForTest(null)` = 숨김 |
| L9 테스트 | 해소 | 방침·busy·AI 음악 고지·펼침·N1 재노출 안 함(화면 단위) 추가 |
| SettingsRow 공용 prop | 영향 없음 | `badge`·`accessibilityState`는 선택 prop이라 넘기지 않는 화면은 출력이 같다. 차이는 Pressable 힌트가 `sub ?? ''`에서 `subText \|\| undefined`(빈 문자열 → undefined)로 바뀐 것뿐이고, 읽히는 내용은 같다. 다른 화면 테스트 모두 통과 |

### 새 지적(낮음)
- **N1. denied 줄 문구가 버튼과 어긋남** — `NotifyRows.tsx`(`notify-perm-denied`). 문구는 "알림이 휴대폰 설정에서 꺼져 있어요"인데, 버튼 [알려 주세요]는 휴대폰 설정이 아니라 앱 안에서 권한 창을 띄운다. 13 이상에서 묻기 전 상태(N1 '알려 주세요' → 창 닫음)에도 이 줄이 보인다. "알림을 받으려면 허용이 필요해요" 같은 문구(copy 키 신설, 디자인 확인)를 권한다.
- **N2. `askAgain` 결과를 버림** — 허용 뒤 `parentEnableFromSettings` 결과(offline 등)를 보지 않아, 실패해도 `perm: 'ok'`가 되고 아무 안내가 없다(토큰은 다음 PushHost sync에서 등록되므로 영향은 작다). 거절·blocked 결과는 `logPermissionResult`로 기록되지 않는다(허용만 기록). `failed` 줄 표시와 `logPermissionResult(perm)` 호출을 권한다.
- **N3. 테스트 빈틈** — "서버 켜짐 + denied → [알려 주세요] → 허용 → 토큰 등록"과 L6 경쟁(토글 중 active 읽기가 덮지 않음), 켜기 중 서버 실패 → 권한 창 안 뜸 + 되돌림에 대한 단언이 없다.

### 실행 결과 (df2bd22를 이 worktree에서 detached로 체크아웃, package-lock은 l2-appinfo와 같아 기존 node_modules를 씀)
- `npx tsc --noEmit`: 오류 0
- `npx eslint .`: 오류 0, 경고 70(모두 no-restricted-imports. main f9cdd69에서 늘어난 것). 이번 커밋이 바꾼 소스·테스트 13파일만 돌리면 경고 0
- `npx jest --testPathIgnorePatterns __integration__ --cacheDirectory <scratchpad>/jestcache2`: 1회차는 965개 중 956개 통과, 9개 스위트 실패. 실패는 모두 `Exceeded timeout`(15·20초)이었고, 스위트 하나가 130~240초 걸렸다(머신 load average 44). 실패한 9개 + notifyRows·parentAppInfo·bgm을 `-w 2`로 다시 돌리니 단위 테스트 13스위트, 224/224 통과(같은 패턴에 걸린 `__integration__/devMenu.test.ts`는 서버가 필요해 제외 대상)
- 에뮬레이터·실기기는 돌리지 않음. 실제 권한 창 동작과 background→active 순서는 코드를 읽어서만 판단
