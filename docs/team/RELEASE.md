# 빌드·배포 방법 (Android)

- 대상: 사용자(출시·DB 반영 실행), 팀(빌드·확인). 설계: [09-environments.md](../plans/09-environments.md), 결정: DECISIONS 2026-11-17 "환경 분리"
- 준비: 터미널에서 저장소 루트로 이동 → `source scripts/env.sh`(JDK 17·Android SDK 경로)

## 1. 환경 한눈에

| | 로컬 개발 | staging(테스트) | production(실사용) |
|---|---|---|---|
| 앱 이름 / 아이콘 | (빌드한 flavor 따름) | **테스트 가화만사성** / 배지 T | 가화만사성 / 기본 |
| 패키지 | — | `com.bumojasik.app.staging` | `com.bumojasik.app` |
| 서버 | fake 또는 로컬 Docker | 원격 eigocuecmaapxnmhttwj | 새 Pro 프로젝트(생성 예정) |
| 설정 원본 | `app/src/lib/config.local.ts`(개인, gitignore) | `app/env/staging.env`(커밋) | `app/env/production.env`(사용자 맥, gitignore) |
| 배포 | Metro | adb·Firebase App Distribution(**Play 안 올림**) | Play Console |

- 두 앱은 패키지가 달라 **한 폰에 같이 설치**된다.
- env 파일에는 **공개 값만**(Supabase URL·publishable 키, 카카오 네이티브 키, 구글 웹 클라이언트 ID). DB 비밀번호·`sb_secret_`·service_role·Client Secret 은 절대 넣지 않는다. 빌드가 이름에 SECRET/SERVICE_ROLE/PASSWORD 가 들어간 키나 `sb_secret_` 값을 보면 실패한다.

## 2. 설정이 앱에 들어가는 방식

빌드 때 flavor 에 맞는 `app/env/<flavor>.env` 를 읽어 세 곳에 넣는다(새 라이브러리 없음). **읽기·검사·`env.generated.ts` 쓰기·release 번들 검사는 공통 스크립트 `app/scripts/appEnv.js` 한 곳**(iOS 준비 N2) — Gradle 은 이 스크립트를 부르기만 하고, iOS 는 Xcode Build Phase 에서 같은 스크립트를 부른다(아래 'iOS').

1. `app/src/lib/env.generated.ts`(gitignore, 자동 생성 — 손으로 고치지 않음) → JS 가 `getAppEnv()` 로 읽음
2. Android 리소스: `kakao_scheme`(카카오 웹 로그인 복귀), `app_env`, `supabase_url`
3. `BuildConfig.APP_ENV`, `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `ENV_PLACEHOLDER`

JS 쪽 우선순위(뒤가 앞을 덮음): 기본값(로컬+fake) → `env.generated.ts` → `config.local.ts`(**개발 빌드에서만**, release 에는 적용 안 됨).

- env 값 검사: 필수 키, `APP_ENV`=flavor, 카카오 키 32자리 16진수, `SUPABASE_PUBLISHABLE_KEY` 는 `sb_publishable_` 로 시작하는 값만(anon·service_role JWT 금지), `SUPABASE_URL` = `https://<SUPABASE_PROJECT_REF>.supabase.co`. 어기면 빌드 실패.
- 앱 정보 값(AU-07, 선택): `TERMS_URL`·`PRIVACY_URL`(https 만)·`CONTACT_EMAIL`·`BIZ_NAME`·`BIZ_CEO`·`BIZ_REG_NO`(000-00-00000)·`BIZ_ADDRESS`. 형식이 틀리면 빌드 실패, 비어 있으면 설정 화면에서 그 행을 숨기고 **빌드 경고**. **production release 는 하나라도 비면 실패**(G-INT "값이 없어 숨겨진 앱 정보 행 0", 확인용만 `-PallowMissingAppInfo`). 앱은 `src/lib/appInfo.ts`(`readAppInfo`·`missingAppInfo`).
- `production.env` 가 없으면 디버그 빌드는 `production.env.example`(가짜 값)으로 경고와 함께 되지만, **release 빌드는 실패**한다(확인용으로만 `-PallowPlaceholderEnv`). `scripts/build-production.sh` 는 시작 전에 멈춘다.

### 공통 스크립트 `app/scripts/appEnv.js`(Gradle·iOS 공용)
```bash
node scripts/appEnv.js load-json [--require-real-env]                       # 두 flavor 검사 + 값(JSON) — Gradle 설정 단계
node scripts/appEnv.js check --flavor production --build-type release [플래그] # 빌드 전 검사만
node scripts/appEnv.js write --flavor staging --build-type debug [--version-name 1.0.0 --version-code 132 --git-sha abc] [--link-host h]
node scripts/appEnv.js verify-bundle --flavor production <번들 파일…>         # release 번들 개발 전용 표식 검사
# 플래그: --require-real-env(=-PrequireRealEnv) · --allow-placeholder(=-PallowPlaceholderEnv) · --allow-missing-app-info(=-PallowMissingAppInfo, 출시 경로에서는 무시)
```
- 버전을 주지 않으면 `package.json` version · `git rev-list --count HEAD` · 짧은 sha(iOS 처럼 빌드 도구가 버전을 넘기지 않는 경우). 실패는 종료 코드 1 + 한국어 한 줄, 경고는 `경고:` 줄.
- 규칙 테스트: `__tests__/appEnvScript.test.ts`.
- **node 필수**: Android 빌드·IDE 동기화가 설정 단계에서 이 스크립트를 부른다(원래 JS 번들에도 필요). 찾는 순서: `NODE_BINARY`(환경변수 또는 `~/.gradle/gradle.properties` 의 `NODE_BINARY=/경로/node`) → `~/.nvm/versions/node` 가장 높은 판 → `/opt/homebrew/bin/node` → `/usr/local/bin/node` → PATH. 못 찾으면 "빌드에 node 가 필요해요" 로 멈춘다. Dock 에서 연 Android Studio 는 셸 PATH 가 없으니 터미널에서 `studio .` 로 열거나 `NODE_BINARY` 를 적는다(라이브러리 일부도 PATH 의 node 를 직접 부른다).
  - 증상: 빌드·동기화에 `A problem occurred starting process 'command 'node''` 나 `does not specify compileSdk`(라이브러리 설정이 node 실행 실패로 중간에 멈춘 결과)가 보이면 **그 Gradle 이 쓰는 PATH 에 node 가 없는 것**이다. 다른 곳(GUI 등)에서 켜진 Gradle 데몬이 남아 있어도 같다 → 터미널에서 `./gradlew --stop` 뒤 다시(다른 사람 빌드가 돌고 있으면 `--no-daemon` 으로 한 번).
- **iOS(빌드 2, 아직 프로젝트에 넣지 않음)** — Run Script 두 개:
  1. **맨 앞**(Compile Sources 전) "env 생성": Xcode Run Script 는 PATH 가 거의 없으므로 RN 템플릿처럼 `.xcode.env` 를 먼저 불러 `NODE_BINARY` 를 쓴다. 출시 configuration 은 `--require-real-env`(Android `build-production.sh` 와 같게). 출력 파일이 없어 매번 돌아야 하므로 "Based on dependency analysis" 를 끈다.
     ```sh
     set -e
     [ -f "$PODS_ROOT/../.xcode.env" ] && . "$PODS_ROOT/../.xcode.env"
     [ -f "$PODS_ROOT/../.xcode.env.local" ] && . "$PODS_ROOT/../.xcode.env.local"
     cd "$SRCROOT/.."   # app/
     if [ "$CONFIGURATION" = "Debug" ]; then TYPE=debug; EXTRA=""; else TYPE=release; EXTRA="--require-real-env"; fi
     "$NODE_BINARY" scripts/appEnv.js write --flavor "${APP_FLAVOR:-staging}" --build-type "$TYPE" $EXTRA
     ```
  2. **"Bundle React Native code and images" 뒤**(release 만) "번들 검사": 번들 경로는 `$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/main.jsbundle`.
     ```sh
     set -e
     [ "$CONFIGURATION" = "Debug" ] && exit 0
     [ -f "$PODS_ROOT/../.xcode.env" ] && . "$PODS_ROOT/../.xcode.env"
     cd "$SRCROOT/.."
     "$NODE_BINARY" scripts/appEnv.js verify-bundle --flavor "${APP_FLAVOR:-staging}" "$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/main.jsbundle"
     ```
  - `APP_FLAVOR` 는 xcconfig·scheme 으로 정한다(iOS 감사 flavor 행). 버전 코드 기본값은 git 커밋 수라 얕은 clone CI 에서는 작다(Android 와 같은 한계, release-versions 확인 단계로 막음 — 리뷰 L3).

### env.generated.ts 가 남는 규칙(Metro 가 어떤 서버로 붙나)
- 디버그 빌드(`npm run android:staging` 등)는 빌드할 때 **자기 flavor 값**으로 이 파일을 쓴다. 작업 이름에 변형이 있으면(`assembleStagingDebug`) 그 변형만 쓴다 — 네이티브 CMake 설정이 다른 flavor 의 preBuild 를 끌어와도 덮어쓰지 않는다(PR #7·#44). Metro 는 이 파일을 읽으므로, **마지막으로 빌드한 디버그 flavor** 의 서버로 붙는다(stagingDebug 와 productionDebug 를 번갈아 설치했다면 마지막 것).
- release 빌드는 번들 직전에 쓰고 **번들이 끝나면(실패해도) 지운다**. 그래서 `build-production.sh` 뒤에 `npm start` 만 해도 production 값이 남지 않고 기본값(로컬+fake)이 된다.
- 지금 어느 값인지: `head -3 app/src/lib/env.generated.ts`(없으면 로컬+fake).
- Metro 설정은 둘이다(개발자 메뉴 보안 재검토 R1). **개발 서버**(`npm start`·`npm run android`)는 `metro.config.js` 로, `config.local.ts` 와 개발자 메뉴를 그대로 둔다 — release 빌드 뒤 env.generated 가 지워져도 개발 흐름은 바뀌지 않는다. **출시 번들**은 Gradle 이 `react { bundleConfig }` 로 `metro.release.config.js` 를 쓴다: env.generated 의 `BUILD_TYPE=release` 가 없으면 번들을 멈추고, `config.local.ts` 를 빈 모듈로, production 이면 개발자 메뉴를 빈 대역으로 바꾼다. 번들 뒤 `verifyReleaseBundle`(→ `appEnv.js verify-bundle`) 이 산출물에서 테스트 계정·메뉴 표식을 찾으면 빌드를 실패시킨다. 손으로 확인: `npm run check:dev-menu`(임시 폴더 복사본에서, 작업 트리를 바꾸지 않음).

## 3. 로컬 개발

| 하고 싶은 것 | 방법 |
|---|---|
| 서버 없이 화면 개발(fake) | `config.local.ts` 에 `API_MODE: 'fake'` (파일이 없고 빌드도 안 했으면 기본이 fake) |
| 로컬 Docker Supabase | `npx supabase start` → `cp app/src/lib/config.local.example.ts app/src/lib/config.local.ts` → URL(에뮬레이터 `http://10.0.2.2:54321`, 실기기 `http://<맥 LAN IP>:54321`)·KEY 채우기 |
| staging 서버로 개발 | `config.local.ts` 를 지우거나 이름 변경 → `cd app && npm run android:staging` |

- 예전 방식(App.tsx 의 `API_MODE` 를 손으로 바꾸기)은 없어졌다. 전환은 `config.local.ts` 로만.
- flavor 가 생겨서 `npm run android` 는 이제 `stagingDebug`(테스트 앱 패키지)를 띄운다. production 패키지로 보려면 `npm run android:production`.

## 4. 버전 규칙


- **versionName** = `app/package.json` 의 `version`(지금 1.0.0). 출시 내용이 바뀌면 여기만 올린다(1.0.1 버그 수정, 1.1.0 기능 추가).
- **versionCode** = `git rev-list --count HEAD`(커밋 수). Play 는 같은 패키지에 더 큰 번호만 받는다 → **출시 빌드는 main 에서만**(브랜치·얕은 clone 은 수가 작을 수 있음). 필요하면 `./gradlew ... -PversionCode=200` 으로 덮는다. git 을 못 읽으면 빌드가 실패한다(조용히 1 이 되지 않음).
- **출시 기록** `app/android/release-versions.txt`: Play 에 올린 번호를 한 줄씩 남긴다. `build-production.sh` 가 새 번호가 기록의 가장 큰 번호보다 큰지 확인하고, 빌드 끝에 추가할 줄과 커밋 명령을 보여 준다. main 이 아닌 브랜치에서는 `BUMOJASIK_VERSION_CODE=<번호>` 를 직접 줘야만 빌드된다.
- staging 의 versionName 에는 `-staging` 이 붙는다(예 `1.0.0-staging`).
- 설정 화면용 문자열: `versionLabel()`(`app/src/lib/appVersion.ts`) → production `1.0.0 (132)`, staging `1.0.0 (132) · 테스트 · eigocuecmaapxnmhttwj`.

## 5. 서명(사용자 맥에서 한 번)

업로드 키(`release.keystore`, 지문은 카카오·구글에 이미 등록)는 저장소에 넣지 않는다. 경로·비밀번호는 **`~/.gradle/gradle.properties`**(저장소 밖)에 적는다.

```properties
BUMOJASIK_UPLOAD_STORE_FILE=/Users/<나>/keys/bumojasik/release.keystore
BUMOJASIK_UPLOAD_STORE_PASSWORD=<키스토어 비밀번호>
BUMOJASIK_UPLOAD_KEY_ALIAS=<키 별칭>
BUMOJASIK_UPLOAD_KEY_PASSWORD=<키 비밀번호>
```

- 키스토어는 **저장소 밖**(예 `~/keys/bumojasik/`, `chmod 700`)에 둔다. 저장소 안(`app/android/app/release.keystore`)은 gitignore 되더라도 폴더 복사·압축·클라우드 동기화로 새어 나갈 수 있다. 지금 저장소 안에 있으면 옮기고 위 경로를 맞춘다.
- 파일 권한: `chmod 600 ~/.gradle/gradle.properties`. 같은 이름의 **환경변수**로 줘도 된다(CI 등).
- 설정이 없으면 release 빌드는 **debug 키로 서명되고 경고**가 나온다(테스트용으로만 쓸 것, 카카오·구글 로그인 지문이 안 맞을 수 있음). production 스크립트는 이 경우 멈춘다.
- 별칭 확인: `keytool -list -keystore <경로>`(비밀번호 입력).

## 6. 외부 콘솔 등록(staging 첫 설치 전 체크리스트, 사용자 몫)

staging 앱은 패키지가 `com.bumojasik.app.staging` 이라 카카오·구글이 **다른 앱**으로 본다. 아래가 없으면 staging 에서 소셜 로그인이 실패한다(구글은 `DEVELOPER_ERROR`). 설계: 09 §3.

**지문 계산**(키 해시·SHA-1):
```bash
# release(업로드 키) SHA-1
keytool -list -v -keystore ~/keys/bumojasik/release.keystore -alias <별칭> | grep SHA1
# debug SHA-1 (비밀번호 android)
keytool -list -v -keystore app/android/app/debug.keystore -alias androiddebugkey -storepass android | grep SHA1
# 카카오 키 해시 = SHA-1 바이트의 Base64
keytool -exportcert -keystore ~/keys/bumojasik/release.keystore -alias <별칭> | openssl sha1 -binary | openssl base64
keytool -exportcert -keystore app/android/app/debug.keystore -alias androiddebugkey -storepass android | openssl sha1 -binary | openssl base64
```

| # | 어디 | 할 일 | 넣을 곳 |
|---|---|---|---|
| 1 | 카카오 디벨로퍼스 > 앱(1653853) > 앱 키 | **staging 용 네이티브 앱 키 추가 발급**(같은 앱, 동의항목 공유) | `app/env/staging.env` 의 `KAKAO_NATIVE_APP_KEY` |
| 2 | 카카오 > 그 staging 키의 플랫폼 > Android | 패키지 `com.bumojasik.app.staging`, 키 해시(release·debug 둘 다) | — |
| 3 | staging Supabase > Auth > Providers > Kakao | Client ID 를 staging 네이티브 키로(Secret 은 기존) | 대시보드 |
| 4 | Google Cloud(gahwa-mansaseong) > 사용자 인증 정보 | Android 클라이언트 2개: `.staging`+release SHA-1, `.staging`+debug SHA-1 | — |
| 5 | 같은 곳 | staging 용 **웹** 클라이언트 1개 새로 | `staging.env` 의 `GOOGLE_WEB_CLIENT_ID`, staging Supabase Google provider(ID·Secret) |
| 6 | production 첫 업로드 후 Play Console > 앱 무결성 | 앱 서명 키 SHA-1 → 카카오(production 키 해시)·구글(production Android 클라이언트) | — |

- **1~3 전까지 주의(리뷰 M2)**: 지금 `staging.env` 의 카카오 키는 production 과 같다. 두 앱이 같은 `kakao{키}://oauth` 주소를 받으므로, **한 폰에 두 앱을 같이 설치하면** 카카오톡 없이 하는 카카오계정(웹) 로그인 복귀가 선택창이 뜨거나 다른 앱으로 갈 수 있다. 키를 나누기 전에는 staging 을 production 앱이 없는 폰에만 설치한다. 빌드할 때마다 Gradle 이 이 상태를 경고한다.
- 키를 바꾼 뒤 `staging.env` 를 커밋하고 staging 을 다시 빌드한다(카카오 scheme 도 그 키로 바뀜).

### 6.1 iOS 콘솔 등록(빌드 2 — 지금은 계획, iOS 준비 N8)
번들 ID 는 Android 패키지와 같게 고정한다: production `com.bumojasik.app`, staging `com.bumojasik.app.staging`(App Store Connect 에 앱을 만들면 번들 ID 는 바꿀 수 없음, iOS 감사 N7). 아래는 **Apple Developer 계정·Team ID 가 생긴 뒤** 사용자 몫. 값(키·ID)은 env·xcconfig 로만 넣고 커밋할 수 있는 공개 값만 저장소에 둔다.

| # | 어디 | 할 일 | 넣을 곳 |
|---|---|---|---|
| i1 | 카카오 디벨로퍼스 > 앱(1653853) > 플랫폼 > iOS | 번들 ID `com.bumojasik.app`(production 키), staging 키(위 1번에서 나눈 키)에 `com.bumojasik.app.staging` | 앱: Info.plist URL scheme `kakao{네이티브 키}`, `LSApplicationQueriesSchemes`(kakaokompassauth·kakaolink 등). **SceneDelegate 구조라 복귀 URL 은 `scene(_:openURLContexts:)` 에서 처리**(iOS 감사 2.2) |
| i2 | Google Cloud(gahwa-mansaseong) > 사용자 인증 정보 | **iOS OAuth 클라이언트 2개**(번들 ID 별: production·staging). 각 클라이언트의 iOS client ID·reversed client ID 를 받는다 | env(예: `GOOGLE_IOS_CLIENT_ID`, 공개 값) → 앱 `GoogleSignin.configure({iosClientId})`, Info.plist URL scheme = reversed client ID |
| i3 | 각 환경 Supabase > Auth > Providers > Google | **Authorized Client IDs** 에 그 환경의 iOS client ID 추가(웹·Android 와 쉼표로 함께). iOS 구글 ID 토큰 nonce 때문에 'Skip nonce check' 가 필요할 수 있음 — 재확인 후 결정(iOS 감사 2.2) | 대시보드 |
| i4 | 각 환경 Supabase > Auth > Providers > Kakao | Client ID 는 Android 와 같은 네이티브 키(플랫폼만 추가) — 변경 없음 확인 | 대시보드 |
| i5 | Firebase 콘솔(gahwa-mansaseong) > 프로젝트 설정 > 앱 추가 > iOS | 번들 ID 2개 등록(iOS 감사 N6) → `GoogleService-Info.plist` 2개(저장소 밖 보관, gitignore 위치에 복사). **APNs 인증 키(.p8)** 업로드(Apple 계정 필요, U6) | Xcode configuration 별 plist 복사 Build Phase, `FirebaseApp.configure()` |
| i6 | Apple Developer > Identifiers | 두 번들 ID 에 Capability: Push Notifications, Associated Domains(초대 링크), Sign in with Apple(심사 4.8 — 카카오·구글을 주므로 필요) | entitlements 파일(iOS 감사 2.3) |
| i7 | Apple > Sign in with Apple(Services ID·키) + Supabase > Providers > Apple | Supabase Apple provider 설정(Services ID·Team ID·Key ID·.p8) | 대시보드(비밀은 대시보드에만) |

- 순서: i5(번들 ID 등록·plist)는 Apple 계정 없이 지금도 된다(무료). i1~i4 는 iOS 빌드를 시작하는 날, i6·i7·.p8 은 Apple 계정 뒤.
- 환경 값은 env 생성 공통 스크립트(`app/scripts/appEnv.js`, N2 PR)가 env 에서 읽어 iOS 쪽 xcconfig 로도 내보내게 확장한다(키를 env 한 곳에 — 지금 Android 와 같은 원칙).

## 7. staging 빌드·배포

```bash
source scripts/env.sh
scripts/build-staging.sh
# → app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
adb install -r app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
```

- 앱 이름 "테스트 가화만사성"과 배지 T 아이콘으로 production 과 구분된다.
- 여러 사람에게 줄 때는 Firebase App Distribution(설정 예정, 09 §3)에 같은 APK 를 올린다.

## 8. production 빌드·Play 업로드

1. (처음 한 번) `cp app/env/production.env.example app/env/production.env` → 새 Pro 프로젝트의 ref·URL·publishable 키(대시보드 Project Settings > API), 카카오·구글 production 값 채우기
2. main 브랜치, 커밋된 상태 확인
3. 빌드:
   ```bash
   source scripts/env.sh
   scripts/build-production.sh
   ```
   - `production.env` 없음·서명 설정 없음·커밋 안 된 변경·main 아님(번호 미지정)·새 versionCode ≤ 마지막 출시 번호면 멈춘다(의도한 안전장치)
4. 결과 `app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab` 를 Play Console > 내부 테스트(또는 비공개 테스트) > 새 버전 만들기에 올린다
5. 스크립트 끝에 나온 명령으로 `app/android/release-versions.txt` 에 한 줄 추가·커밋(다음 출시 번호 검사용)
6. 첫 업로드 후 Play Console > 앱 무결성의 **앱 서명 키 SHA-1** 을 카카오(키 해시)·구글(Android 클라이언트)의 production 설정에 추가(6절 표 6번)

## 9. DB 마이그레이션 반영(사용자 실행)

```bash
scripts/db-push.sh staging      # 먼저 staging
# staging 앱으로 확인 후
scripts/db-push.sh production
```

스크립트가 하는 일:
0. production 이면 **main·커밋 안 된 변경 없음·origin/main 과 같은 커밋**인지 먼저 확인(반영되는 마이그레이션은 지금 작업 트리의 `supabase/migrations` 이므로). origin 이 없으면 경고만
1. 대상 ref 를 `app/env/<환경>.env` 의 `SUPABASE_PROJECT_REF` 에서만 읽는다(`supabase link` 상태를 쓰지 않음, `--remote=<ref>` 로 지정). staging·production ref 가 같으면 멈춘다
2. 대상 환경·ref 를 크게 보여 주고 `db push --dry-run` 으로 적용될 마이그레이션 목록을 보여 준다
3. **환경 이름과 ref 를 다시 입력**해야 진행(하나라도 다르면 아무것도 하지 않고 종료)
4. production 이면 먼저 **스키마만** 백업(`supabase db dump`) → 저장소 밖 `~/bumo-jasik-backups/`(본인만 읽기, 바꾸려면 `BUMOJASIK_BACKUP_DIR`). **데이터는 이 백업에 없다** — 데이터 복원은 Pro 일일 백업(7일)·PITR
5. `db push`

- DB 비밀번호를 물으면 비밀번호 관리자의 해당 환경 항목을 입력한다.
- 되돌리기·시드는 09 §4.

### Auth 콘솔 점검(advisors 경고 2건, 사용자 몫 · staging·production 각각)
DB 마이그레이션으로 고칠 수 없는 Auth 설정 경고다. `db push` 뒤 대시보드 Advisors에서 확인한다.
- [ ] **익명 로그인 허용(auth_allow_anonymous_sign_ins)**: 어르신 연결이 익명 로그인 위에서 동작하므로 **켠 채로 둔다(의도)**. 대신 Authentication > Rate Limits의 익명 로그인 한도가 기본값 이하인지 확인하고, 남용이 보이면 CAPTCHA(Attack Protection)를 켠다. RLS는 익명 사용자도 authenticated로 보므로 모든 쓰기는 RPC 안에서 역할을 검사한다(서버 노트 §7).
- [ ] **유출 비밀번호 보호(auth_leaked_password_protection)**: Authentication > Attack Protection에서 켠다(비밀번호 로그인을 쓰는 심사용 자녀 계정에도 해당). 요금제에 따라 안 보이면 production(Pro)에서만 켜고 staging은 경고를 받아들인다(미확인).
- [ ] **Vault 비밀값(필수, 0033·0044)**: Database > Vault에 `project_url`(= `https://<ref>.supabase.co`)과 `push_cron_secret`(32자 이상 무작위, 함수 secrets `PUSH_CRON_SECRET`과 같은 값). 없으면 알림·카카오 해제 cron이 함수를 부르지 않고, **콘텐츠 게시 때 사진 주소의 호스트 검사가 생략된다**(https 형식만 확인). 상세는 dev-server-notes §9 #17.
- [ ] 그 밖의 DB 경고가 남아 있으면 서버 줄에 전달(로컬 `npx supabase db advisors`는 0031 기준 "No issues found").

## 10. 빌드 결과 확인(설치 없이)

```bash
AAPT2=$(ls -d $ANDROID_HOME/build-tools/*/ | tail -1)aapt2
APK=app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
$AAPT2 dump badging $APK | grep -E "package:|application-label:"
$AAPT2 dump resources $APK | grep -A1 -E "string/(app_env|supabase_url|kakao_scheme)"
```

## 11. 자주 막히는 곳

| 증상 | 원인·해결 |
|---|---|
| `app/env/production.env 가 없어요` / `예시 값 금지` | 8-1 단계(확인용 빌드만 `-PallowPlaceholderEnv`) |
| `versionCode 를 git 커밋 수로 정하지 못했어요` | git 저장소 안에서 빌드하거나 `-PversionCode=<번호>` |
| `SUPABASE_PUBLISHABLE_KEY 는 sb_publishable_ …` | 대시보드 API 키 화면의 publishable 키를 넣는다(anon·service_role 금지) |
| `release 서명 설정이 필요해요` | 5 단계 |
| 개발 빌드가 staging 이 아니라 로컬 서버로 붙음 | `config.local.ts` 가 있음(개발 빌드에서는 그 값이 우선) |
| `Supabase 접속 값이 없어요` | 빌드 없이 실행했거나 `config.local.ts` 가 비어 있음 |
| 카카오 로그인 후 앱으로 안 돌아옴·엉뚱한 앱으로 감 | 그 환경 키에 패키지(`.staging` 포함)·키 해시 등록 확인. 두 앱이 같은 키면 6절 주의 |
| 구글 로그인 `DEVELOPER_ERROR` | 6절 표 4번(그 패키지+그 서명 SHA-1 Android 클라이언트) |
| 통합 테스트가 `config.local.ts(로컬 Supabase)만` 으로 실패 | 의도된 보호. `config.local.ts` 에 로컬 주소(127.0.0.1 등)를 넣는다. 원격 주소는 거부 |
