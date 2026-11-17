# 보안 리뷰: staging 전용 개발자 메뉴 (dev-menu af65100) · 2026-11-18

- 대상: 브랜치 `dev-menu` af65100 (기준 1bf8ff5). 독립 보안 리뷰, 코드 수정 없음.
- 방법: 분리 worktree(af65100, node_modules 는 메인 체크아웃 심볼릭 링크)에서 정적 검토 + 실제 번들·APK 빌드 후 문자열 검사.
- 판정: **조건부 합치기 — H1 수정 후.** production 번들에서 메뉴 구현을 빼는 장치 자체는 실제 APK 에서도 동작했다. 다만 `config.local.ts` 가 모든 빌드 번들에 들어가는 기존 구조 때문에, 이 브랜치가 그 파일에 두라고 안내한 테스트 자녀 비밀번호가 staging·production APK 에 평문으로 들어간다(재현함).

## 실행 결과

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | 통과(exit 0) |
| `jest --maxWorkers=2 --testPathIgnorePatterns __integration__` | 68 묶음 / 658 테스트 통과 |
| `npm run check:dev-menu` | 통과("production 번들에 개발자 메뉴 없음, staging 번들에는 있음"), 약 20초 |
| Metro 캐시(`--reset-cache` 없이 staging → production 순서로 번들) | staging 표식 9건, production 0건. 리다이렉트 결과는 디스크 캐시에 남지 않음 |
| config.local 유출 재현(가짜 값 `devTestChild` 를 둔 뒤 production·minify 번들) | 비밀번호·이메일·로컬 주소 문자열이 번들에 **있음** |
| `./gradlew assembleProductionRelease -PallowPlaceholderEnv` → APK 의 `assets/index.android.bundle` | 성공(10분 21초, Hermes 바이트코드). `strings` 로 `bumojasik-dev-menu-impl`·`dev_menu_session_`·`createTestFamily`·`sessionSlots`·`testFamily` 모두 **0건** → 메뉴 대역이 실제 APK 에서 쓰임. 같은 APK 에서 가짜 `devTestChild` 비밀번호·이메일·`devTestChild` 각 **1건**(H1). `createBundleProductionReleaseJsAndAssets` 다음 `cleanGeneratedAppEnv` 가 돌아 빌드 뒤 env.generated.ts 가 지워짐(env-split M1 규칙 동작). 한글 문구는 Hermes 가 UTF-16 으로 담아 strings 로는 판단 불가 |
| main(06974ab)과 `git merge-tree` | 충돌 없음 |
| 통합 테스트(`__integration__/devMenu`) | 로컬 Supabase 가 필요해 돌리지 않음 |

## 발견 사항

### 높음

**H1. 테스트 자녀 계정 비밀번호가 staging·production 번들에 평문으로 들어간다**
- 위치: `app/src/lib/env.ts:90`(`require('./config.local')` 를 빌드 종류와 상관없이 정적으로 require), `app/src/dev/DevMenuHost.tsx:48`, `app/src/lib/config.local.example.ts:16-18`(비밀번호를 이 파일에 두라는 안내), `docs/team/dev-app-notes.md`("staging release 빌드에는 config.local 이 적용되지 않으므로")
- 원인: Metro 는 try 안의 `require` 를 선택적 의존성으로 다룰 뿐, 파일이 있으면 **release 번들에도 그대로 넣는다**. `resolveAppEnv` 는 release 에서 그 값을 *적용하지* 않을 뿐 모듈은 들어간다. Metro 는 쓰이지 않는 export 를 지우지 않으므로 `devTestChild` 객체가 통째로 실린다. 리다이렉트 대상은 DevMenuHost 하나뿐이라 env.ts 경로로 들어오는 것은 막지 못한다. `check-dev-menu-bundle.sh` 표식에도 없다.
- 재현: worktree 에 `config.local.ts` 를 두고 `export const devTestChild = {email: 'leakcheck@example.test', password: 'LEAKCHECK-PW-42'}`(가짜 값) → `BUMOJASIK_BUNDLE_APP_ENV=production npx react-native bundle --platform android --dev false --minify true --entry-file index.js --bundle-output out.js` → `grep LEAKCHECK-PW-42 out.js` 1건, 이메일 1건. 같은 상태로 `source scripts/env.sh && ./gradlew assembleProductionRelease -PallowPlaceholderEnv` 한 APK 의 `assets/index.android.bundle`(Hermes)에서도 `strings | grep LEAKCHECK-PW-42` 1건.
- 영향: 개발 맥에 이 파일이 있는 채로 `build-staging.sh` 로 만든 APK 를 Firebase App Distribution 으로 나눠 주면 받은 사람 누구나 `unzip` + `strings` 로 staging 테스트 자녀 계정을 가져갈 수 있다. production 빌드도 같다(`build-production.sh` 는 커밋 안 된 변경만 막고, gitignore 된 config.local 은 막지 않는다). 그 계정으로 staging 가족·어르신 기록에 접근할 수 있다. 같은 비밀번호를 다른 곳에도 쓰면 더 커진다.
- 권장 수정(하나 이상):
  1. `metro.config.js` 에서 번들 환경이 `staging`·`production` 이면 `src/lib/config.local.ts` 도 빈 모듈(예 `config.local.empty.ts`, `export default {}`)로 바꾼다. config.local 은 local 개발 빌드에만 의미가 있다.
  2. 자격 증명을 config.local 에서 빼서 `src/dev/devCreds.local.ts`(gitignore)로 옮기고 DevMenuHost 에서만 require 한다. production 은 DevMenuHost 가 대역으로 바뀌어 같이 빠지고, staging 은 1번으로 막는다.
  3. `check-dev-menu-bundle.sh` 에 `devTestChild` 와 config.local 의 존재를 표식으로 더하고, staging 번들에도 비밀번호 표식이 없어야 통과하게 한다.
  4. 이미 이 파일에 비밀번호를 둔 채 staging APK 를 만들어 나눠 준 적이 있으면 그 테스트 계정 비밀번호를 바꾼다(지금 메인 체크아웃의 config.local.ts 에는 `devTestChild` 가 없음을 확인했다).

### 중간

**M1. 번들 제외가 "안 되면 열린 쪽으로" 떨어지고, 출시 경로에 자동 검사가 없다**
- 위치: `app/metroDevMenu.js:9-17`, `app/scripts/build-production.sh:51`, `app/android/app/build.gradle:345-359`
- (a) `BUMOJASIK_BUNDLE_APP_ENV` 가 env.generated 보다 우선한다. 셸에 이 변수가 남아 있으면(예: 검사 스크립트를 흉내 내 `export` 한 경우) `build-production.sh`·Gradle 이 만든 production 번들에 메뉴 구현·sessionSlots·testFamily 가 그대로 들어간다. 재현: `export BUMOJASIK_BUNDLE_APP_ENV=staging` 뒤 `assembleProductionRelease` → Gradle 이 띄운 Metro 도 같은 환경을 물려받는다(코드 경로로 확인, 별도 빌드는 하지 않음). 실행 중 관문(devGate)이 APP_ENV=production 이라 메뉴는 열리지 않지만, "번들에 없다"는 1차 방어가 사라진다.
- (b) env.generated.ts 가 없거나 형식이 다르면(정규식 `"APP_ENV"\s*:\s*"(\w+)"`) `local` 로 보고 구현을 넣는다. 지금 Gradle 은 bundle 작업 doFirst 에서 파일을 쓰므로 정상 경로에서는 문제없다. `npx react-native bundle` 을 직접 돌리면 env.generated 가 없을 때 local, 있을 때는 **마지막 빌드가 남긴 값**(지금 메인 체크아웃에 production 값이 남아 있음)을 따른다. 직접 번들은 출시 경로가 아니므로 중간.
- (c) `npm run check:dev-menu` 는 수동이다. 실제 출시물(Gradle 이 만든 번들)을 검사하지 않고 별도로 번들을 다시 만든다.
- 권장: ① 변수 덮어쓰기는 env.generated 가 없을 때만 허용하거나, Gradle 의 release bundle 작업에서 이 변수가 있으면 실패 ② release bundle 작업 doLast(또는 `build-production.sh` 끝)에서 실제 산출물 `build/generated/assets/createBundleProductionReleaseJsAndAssets/index.android.bundle` 을 표식(H1 표식 포함)으로 grep 해 있으면 빌드 실패. 이것 하나로 (a)(b)(c)와 경로 불일치(심볼릭 링크·대소문자) 가능성까지 덮는다.

**M2. 세션 칸이 로그아웃·계정 삭제와 연결되지 않고, 전환 때 지금 세션을 보관 없이 버리는 경로가 있다**
- 위치: `app/src/dev/sessionSlots.ts:16,37`(칸 키 `dev_menu_session_{role}_v1`), `app/src/dev/testFamily.ts:45-52`, `app/src/dev/DevMenuHost.tsx:100-101,116`, `app/src/features/realApi.ts:357-373`(signOut), `app/src/features/child/ChildSettings.tsx:110`
- 저장: access·refresh 토큰을 AsyncStorage 에 평문 JSON 으로 둔다. supabase-js 가 원래 세션을 두는 곳과 같은 수준(앱 전용 저장소, `allowBackup="false"` 확인)이라 기기 밖 백업 유출은 없다. 다만 **두 번째 신원의 refresh 토큰이 앱 수명 내내 남는다**: 자녀가 설정에서 로그아웃하거나 계정을 지워도 어르신(익명) 칸은 그대로이고, 칸을 비우는 메뉴·만료도 없다. staging 기기를 잃어버리면(루팅·ADB 백업 불가 기기라도 잠금 해제 상태로 분실 시) 앱을 열어 개발자 메뉴로 보관된 신원으로 바로 들어갈 수 있다. 앱 삭제 시에는 저장소가 함께 지워진다.
- 버리는 경로: `createTestFamily` 에 creds 가 있으면 지금 세션을 보관하지 않고 `signInWithPassword` 로 덮는다. creds 가 없고 지금이 parent 면 `slots.restore('child')` 가 어르신 세션을 보관 없이 바꾼다. `switchTo('none', …)` 는 연결 전 익명 세션을 보관 없이 내린다. 익명 사용자는 다시 로그인할 방법이 없어 그 신원과 연결 데이터가 이 기기에서 영영 사라지고, staging 에 고아 익명 사용자가 쌓인다.
- 권장: ① `api.signOut`·계정 지우기 성공 뒤 `dev_menu_session_*` 를 지운다(production 대역에서는 아무것도 하지 않는 훅으로 DevMenuHost 쪽에 둔다) ② 메뉴에 "보관 세션 모두 지우기" 버튼, 칸에 `saved_at` 을 두고 7일 지나면 버림 ③ testFamily·switchTo 시작 전에 `whoAmI` 결과가 parent/none 이고 익명 세션이 있으면 그 칸에 먼저 보관(또는 확인 문구).
- `_removeSession`(비공개) 부작용: auth-js 2.119.0 은 `_sessionRemovalEpoch` 로 진행 중 refresh 가 지운 세션을 되살리지 않게 막는다(확인). `SIGNED_OUT` 이벤트는 나가지 않지만 지금 앱에 `onAuthStateChange` 구독이 없어 영향 없음. 이름 변경은 통합 테스트가 잡는다고 했으나 그 테스트는 로컬 Supabase 가 있어야 돌므로 CI 에서 상시 확인되지 않는다 → `supabaseDevAuth` 단위 테스트로 `typeof GoTrueClient.prototype._removeSession === 'function'` 를 확인하는 한 줄을 권장.

**M3. 테스트 가족이 staging 에 남기는 데이터의 정리 방법이 없다**
- 위치: `app/src/dev/testFamily.ts:54-60`
- 한 번 누를 때마다 새 익명 어르신 사용자 + 프로필이 같은 가족에 붙는다(어르신 수 상한 없음, 미사용 번호만 5개 상한). 가족 정리는 마지막 자녀가 "계정 지우기"를 하면 가족이 지워지지만 어르신 익명 auth 사용자는 남는다(0017 주석). 보관된 소셜 자녀 세션을 쓰면 **실제 개인 계정의 staging 가족**에 테스트 어르신이 붙는다.
- 권장: 가족에 이미 어르신이 있으면 새로 만들지 않고 그 세션 칸을 쓰거나 확인 문구, `supabase/README` 에 staging 테스트 데이터 정리 SQL(테스트 이메일 도메인 기준 가족·고아 익명 사용자) 추가, 테스트 계정은 `@example.test` 같은 표식 도메인만 허용.

### 낮음

**L1. production 어르신·자녀 화면의 버전 줄이 스크린리더에 "사용 안 함"으로 읽힌다**
- 위치: `app/src/features/account/ParentSettings.tsx:112-114`, `app/src/features/child/ChildAppInfo.tsx:29-32`
- `Pressable` 에 `disabled` 를 주면 RN 이 `accessibilityState.disabled=true` 를 붙인다(Pressable.js:260 확인). production 에서 TalkBack 이 "버전 1.0.0, 사용 안 함"처럼 읽어 누를 수 있는 게 고장 난 것처럼 들린다. ParentSettings 쪽은 production 에 새로 생긴 초점 요소이기도 하다.
- 실수 진입: 4초 안 7번이 필요해 일반 사용은 어렵지만, 어르신은 반응 없는 글자를 여러 번 누르는 경향이 있다. staging 에서 어르신 역할 테스터가 열면 "자녀로" 한 번에 지금 익명 세션이 바뀐다(M2 와 연결).
- 권장: 허용 안 될 때는 지금처럼 `View`/`Text` 만 그리고(Pressable 은 허용될 때만), 어르신 화면에서는 진입점을 빼거나 메뉴의 역할 전환에 확인 단계를 둔다.

**L2. fakeApi 의 `__dev` 훅이 production 번들에 남는다 — 위험 낮음**
- 위치: `app/src/features/fakeApi.ts:80-83,131-144`, `app/src/features/selectApi.ts`
- production 에서 fakeApi 가 선택되는 경로: `production.env` 의 `API_MODE=fake`(Gradle 은 `fake|real` 만 검사, build.gradle:121) 또는 env.generated 가 번들에 없을 때 기본값(local+fake). 정상 Gradle 경로에서는 없다. 선택되더라도 `__dev` 는 메모리 상태만 바꾸고, 호출하는 곳은 대역으로 바뀐 DevMenuHost 뿐이라 진입 경로가 없다.
- 권장: Gradle `loadAppEnv` 에서 production 이면 `API_MODE == real` 강제(기존 위험이지만 한 줄).

**L3. ARCHITECTURE 예외가 dev-app-notes 에만 있다**
- 위치: `docs/team/ARCHITECTURE.md:26,84`("supabase-js 호출은 realApi 안에서만"), `app/src/dev/DevMenuHost.tsx:55-59`, `docs/team/dev-app-notes.md`
- 지금 범위는 `src/dev` 의 auth 4개(getSession·setSession·signInWithPassword·_removeSession)와 AsyncStorage 로 좁고 데이터 조회는 Api 를 거친다. 그러나 ARCHITECTURE.md 금지 목록에 예외가 적혀 있지 않아 다음 사람이 `src/dev` 에서 테이블 조회까지 넓힐 수 있다.
- 권장: ARCHITECTURE.md 84행 아래에 "예외: `src/dev`(production 번들 제외)는 auth 세션 조작만, 데이터는 Api 로" 한 줄 + eslint `no-restricted-imports` 로 `lib/supabase` 를 realApi·selectApi·src/dev 밖에서 금지.

**L4. 테스트 품질**
- 좋은 점: 관문 진리표, 7번/6번 경계, 리다이렉트 함수, 세션 칸 왕복·깨진 값, 테스트 가족 순서·번호 미노출, fake 메뉴 화면 흐름, 대역 소스가 구현을 import 하지 않음을 확인한다. 실제 번들 검사 스크립트가 있다.
- 빈 곳: ① 번들 검사가 jest·CI·빌드 어디에도 묶이지 않음(M1) ② config.local/비밀번호 표식 미검사(H1) ③ `TAP_WINDOW_MS` 4초 경과 시 초기화 미검사 ④ DevMenuHost 가 `allowed=false`(APP_ENV production 을 흉내)일 때 `open()` 이 무시되는지 미검사 — 2차 방어의 유일한 확인이 없음 ⑤ `setSession` 오류 시 칸을 비우는 분기 미검사 ⑥ `createTestFamily` 의 `redeem_failed`·`already_has_profile` 분기 미검사 ⑦ 로그아웃 후 칸 처리(M2) 미검사 ⑧ 세션 전환 테스트가 실제 supabase 대신 흉내라 `_removeSession` 동작은 통합 테스트(로컬 DB 필요)에만 의존.

## 중점 항목별 결론

1. Metro 대역 신뢰성: 정상 Gradle 경로에서는 bundle 작업 doFirst 가 env.generated 를 쓴 뒤 Metro 가 뜨므로 production 값으로 대역이 쓰인다. Metro 디스크 캐시는 해석 결과를 남기지 않아 이전 flavor 가 섞이지 않았다(재현). Gradle 증분은 변형별 산출물·입력(appEnv)이 따로라 문제 없음. 약점은 변수 덮어쓰기·파일 없음이 열린 쪽으로 떨어지는 것과 자동 검사 부재(M1).
2. devGate: production 은 `isDevMenuAllowed` 가 무조건 false, DevMenuHost 의 `open` 도 allowed 일 때만 열린다. 런타임 APP_ENV 는 번들에 박힌 env.generated 에서 오고 release 에서는 config.local 이 적용되지 않아 바꿀 길이 없다. 적절.
3. 세션 보관: AsyncStorage 평문(supabase 기본과 같은 수준, 백업 꺼짐). 로그아웃·삭제 때 미정리, 보관 없이 버리는 경로(M2).
4. testFamily: 정리 경로 없음(M3). 자격 증명은 "적용"은 개발 빌드에서만이지만 **문자열은 모든 번들에 들어감**(H1).
5. fakeApi 훅: 위험 낮음(L2).
6. ARCHITECTURE 예외: 범위는 좁으나 문서화·강제 장치 없음(L3).
7. 7번 탭: production 은 눌리지 않지만 접근성 상태가 "사용 안 함"(L1).
8. 테스트: L4.

## 합치기 판정

**조건부 승인.** H1(config.local 을 staging·production 번들에서 빼고 검사 표식 추가)을 고친 뒤 합친다. M1② (실제 release 산출물 grep 으로 빌드 실패)는 이번에 함께 하길 강하게 권장한다. M2·M3·L 항목은 다음 작업으로 미뤄도 된다.

## 재검토 (f7bd1e3 main 병합 · 4895cea 반영) · 2026-11-18

### 실행 결과

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | 통과 |
| `jest --maxWorkers=2`(통합 제외) | 69 묶음 / 673 테스트 통과 |
| `npm run check:dev-menu` | 통과(release 번들에 테스트 계정·이메일 없음, production 메뉴 없음, staging 있음) |
| 카나리아 `config.local.ts`(devTestChild `canary2@leak.test`·비밀번호·`sb_publishable_CANARYKEY99`·`127.0.0.1:54321`) + `assembleProductionRelease -PallowPlaceholderEnv` | 성공. 로그에 "release 번들 검사 통과(production)". APK Hermes 번들 `strings` 결과: 메뉴 표식·dev_menu_session_·createTestFamily·devTestChild·카나리아 비밀번호·이메일·키·로컬 주소 **모두 0건**. 대조군 `version-tap`·`version-line` 은 1건씩 있어 검사 방법은 유효 |
| 검사 우회 시도 ①: worktree 에서만 metroDevMenu 의 config.local 대역을 꺼서 다시 빌드 | `createBundleProductionReleaseJsAndAssets FAILED`, 메시지 `[devTestChild, config.local 값(22자)…, ***@leak.test]`. 값은 길이·가린 형태로만 찍힌다 |
| 우회 시도 ②: 실패 직후 아무것도 바꾸지 않고 다시 빌드 | 다시 실행돼 또 FAILED. 실패한 작업은 Gradle 기록이 없어 UP-TO-DATE 로 건너뛰지 않는다 |
| 우회 시도 ③: 되돌린 뒤 두 번 빌드 | 1회차는 다시 번들 + 검사 통과, 2회차는 `UP-TO-DATE`(검사 안 돎). 입력 `sources`(app/ 아래, android·ios·build·node_modules 제외)에 config.local.ts·metroDevMenu.js·env.generated.ts 가 들어 있어, 건너뛸 때의 산출물은 이미 검사를 통과한 그것이다. build.gradle 을 고치면 작업 동작이 바뀐 것으로 보아 다시 돈다 |
| release 뒤 env.generated.ts | 지워짐. 그 상태의 `bundleAppEnv` = `{appEnv:'unknown', buildType:'unknown'}` |
| main 과 merge-tree | f7bd1e3 에서 병합 완료(충돌 없음) |

### 이전 지적 처리

| 번호 | 판정 | 근거 |
|---|---|---|
| H1 | **해결** | metroDevMenu.js 가 release·불명이면 config.local.ts → config.local.empty.ts. 실제 APK 에서 카나리아 0건, Gradle `verifyReleaseBundle` 이 대역을 끄면 빌드 실패시키는 것까지 확인 |
| M1 | **해결** | 환경 변수 덮어쓰기 제거, 파일 없음·모르는 값이면 메뉴·config.local 모두 제외(fail-closed). 실제 산출물 검사 doLast(번들 작업 안, finalizer 정리보다 먼저) |
| M2 | **대부분 해결** | 7일 만료, 로그아웃(resetRole)·계정 지우기(clear)·처음으로 때 정리 훅, 익명 세션 보관, `_removeSession` 단위 테스트. 암호화 보류는 staging 전용 + allowBackup=false 라 받아들일 만함. 남은 것: 어르신 칸이 이미 차 있으면 `keepCurrent('none')` 은 지금 익명 세션을 여전히 버림(낮음) |
| M3 | **부분 해결 → R2** | 정리 버튼·테스트 도메인 이메일 제한·`childIsTest` 표시 추가. 그러나 지울 대상을 "만들 때의 신원"이 아니라 "정리할 때 칸에 있는 세션"으로 정한다(아래 R2) |
| L1 | 해결 | 허용 안 되면 Pressable 이 아닌 View/Text, production 테스트 추가 |
| L2 | 해결 | production 은 `API_MODE=real` 강제(build.gradle) |
| L3 | 해결(문서) | ARCHITECTURE.md 금지 패턴에 예외 범위 명시. eslint 강제는 없음(낮음, 선택) |
| L4 | 해결 | 4초 창·allowed=false 무시·setSession 오류·redeem_failed·already_has_profile·정리 훅 테스트 추가 |

### 새 문제

**R1 (중간, 개발 흐름) — release 빌드 뒤 디버그 개발에서 config.local 이 조용히 빠지고, 로컬 서버 대신 staging 에 붙을 수 있다**
- 위치: `app/metroDevMenu.js:19-30`(파일 없음 → unknown → config.local 제외), `app/metro.config.js:27`(Metro 시작 때 한 번만 읽음), `app/android/app/build.gradle` cleanGeneratedAppEnv, `@react-native-community/cli-platform-android` runAndroid index.js:103(Gradle 빌드 **전에** Metro 를 띄움)
- 재현(코드 경로, 위 표에서 release 뒤 unknown 확인): release 빌드(파일 삭제) → `npm run android`(stagingDebug) → Metro 가 먼저 떠서 unknown 으로 고정 → 이어서 preBuild 가 staging·debug 값으로 env.generated 를 씀 → 번들에는 env.generated(staging, real)는 들어가는데 config.local 은 빈 모듈. 결과: config.local 로 로컬 Supabase 를 쓰던 개발자 앱이 **staging 서버**로 붙고, 개발자 메뉴도 사라진다. Metro 를 다시 켜기 전까지 계속된다. Metro 를 먼저 켜 두는 평소 흐름(`npm start` 다음 빌드)도 같다. 안전 방향(출시물 유출 없음)이지만, 이 상태에서 "테스트 가족 만들기"를 누르면 데이터가 로컬이 아니라 staging 에 생기고, env-split 리뷰 H1(의도와 다른 원격 연결)과 같은 종류다. dev-app-notes 에 "debug 빌드 뒤에 Metro"라고 적혀 있지만 run-android 기본 동작과 반대다.
- 권장: 출시 판정을 Metro 개발 서버와 떼기 — `react { bundleConfig = file("../../metro.release.config.js") }` 로 Gradle 번들만 쓰는 설정에서 대역을 걸고(그 설정은 env.generated 가 없으면 실패), 개발 서버 설정(metro.config.js)은 지금처럼 config.local 을 둔다. 최소한 resolveRequest 에서 env.generated 를 mtime 기준으로 다시 읽고, 개발 서버(`context.dev`/요청 dev=true)에서는 config.local 을 막지 않기. RELEASE.md §33 의 "마지막 디버그 flavor" 문장도 이 규칙으로 고친다.

**R2 (중간, staging 데이터) — 테스트 가족 정리가 칸이 바뀐 뒤 실제 계정을 지울 수 있다**
- 위치: `app/src/dev/testFamily.ts:79-80`(표시에 `childIsTest`·시각만 저장), `:97-112`(칸에서 복원한 세션의 역할만 보고 `deleteMyAccount`), `app/src/dev/sessionSlots.ts`(칸은 7일 만료, `dev_menu_test_family_v1` 은 만료 없음)
- 재현 시나리오: 테스트 계정으로 가족 만들기(`childIsTest:true`) → 7일 지나 칸 만료(또는 "보관 세션 모두 지우기"는 표시도 지우므로 해당 없음, 만료만 해당) → "자녀로"(빈 상태) → 본인 **소셜 계정**으로 로그인 → 메뉴로 역할을 바꾸면 그 소셜 세션이 자녀 칸에 보관됨 → "테스트 가족 정리" → `whoAmI()==='child'` 이므로 그 소셜 계정을 지운다(마지막 자녀면 가족 전체). 어르신 칸도 같은 방식으로 실제 연결한 익명 어르신으로 바뀔 수 있다. 지금 테스트(`devMenu.test.tsx:232-259`)는 칸이 바뀌지 않는 경우만 본다.
- 권장: 만들 때 어르신·자녀 user id(세션 `user.id`)를 표시에 저장하고, 정리 때 복원한 세션의 user id 가 같을 때만 지운다. 자녀는 추가로 `user.email` 이 `isTestEmail` 인지 확인. 표시에도 같은 만료를 두거나, 칸이 만료되면 표시도 지운다. 정리 시작의 `clearLocal()` 전에 `keepCurrent` 로 지금 세션 보관.

**R3 (낮음) — `check:dev-menu` 가 작업 트리의 env.generated.ts·config.local.ts 를 잠시 바꾼다**
- 위치: `app/scripts/check-dev-menu-bundle.sh:171-185`. trap 으로 되돌리지만 SIGKILL·전원 차단이면 release·production 값 env.generated 나 카나리아 config.local 이 남는다. 실행 중에 같은 체크아웃에서 Metro·Gradle 이 돌면 그 값을 읽는다. 권장: 임시 복사본(앱 폴더를 `mktemp -d` 로 rsync, node_modules 링크)에서 번들, 또는 스크립트 시작 때 "Metro 실행 중이면 중단".

### 재검토 판정

**합치기 승인.** 목적(production 앱에 메뉴·세션 보관·테스트 계정이 절대 들어가지 않음)은 실제 APK 와 일부러 우회한 빌드 실패로 확인됐다. 남은 R1·R2 는 개발 흐름·staging 데이터 문제라 출시물 위험은 아니다. R2 는 실제 개인 staging 계정을 지울 수 있으니 다음 작업 첫 순서로, R1 은 개발자 안내(RELEASE.md) 수정만이라도 이번에 함께 하길 권한다.
