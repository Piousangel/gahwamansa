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

빌드 때 Gradle 이 flavor 에 맞는 `app/env/<flavor>.env` 를 읽어 세 곳에 넣는다(새 라이브러리 없음).

1. `app/src/lib/env.generated.ts`(gitignore, 자동 생성 — 손으로 고치지 않음) → JS 가 `getAppEnv()` 로 읽음
2. Android 리소스: `kakao_scheme`(카카오 웹 로그인 복귀), `app_env`, `supabase_url`
3. `BuildConfig.APP_ENV`, `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `ENV_PLACEHOLDER`

JS 쪽 우선순위(뒤가 앞을 덮음): 기본값(로컬+fake) → `env.generated.ts` → `config.local.ts`(**개발 빌드에서만**, release 에는 적용 안 됨).

- `production.env` 가 없으면 Gradle 은 `production.env.example`(가짜 값)으로 빌드하고 경고한다 — 그 앱은 서버에 붙지 못한다. `scripts/build-production.sh` 는 아예 멈춘다.

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
- **versionCode** = `git rev-list --count HEAD`(커밋 수). Play 는 같은 패키지에 더 큰 번호만 받는다 → **출시 빌드는 main 에서만**(브랜치·얕은 clone 은 수가 작을 수 있음). 필요하면 `./gradlew ... -PversionCode=200` 으로 덮는다.
- staging 의 versionName 에는 `-staging` 이 붙는다(예 `1.0.0-staging`).
- 설정 화면용 문자열: `versionLabel()`(`app/src/lib/appVersion.ts`) → production `1.0.0 (132)`, staging `1.0.0 (132) · 테스트 · eigocuecmaapxnmhttwj`.

## 5. 서명(사용자 맥에서 한 번)

업로드 키(`release.keystore`, 지문은 카카오·구글에 이미 등록)는 저장소에 넣지 않는다. 경로·비밀번호는 **`~/.gradle/gradle.properties`**(저장소 밖)에 적는다.

```properties
BUMOJASIK_UPLOAD_STORE_FILE=/Users/<나>/Desktop/bumo-jasik/app/android/app/release.keystore
BUMOJASIK_UPLOAD_STORE_PASSWORD=<키스토어 비밀번호>
BUMOJASIK_UPLOAD_KEY_ALIAS=<키 별칭>
BUMOJASIK_UPLOAD_KEY_PASSWORD=<키 비밀번호>
```

- 파일 권한: `chmod 600 ~/.gradle/gradle.properties`. 같은 이름의 **환경변수**로 줘도 된다(CI 등).
- 설정이 없으면 release 빌드는 **debug 키로 서명되고 경고**가 나온다(테스트용으로만 쓸 것, 카카오·구글 로그인 지문이 안 맞을 수 있음). production 스크립트는 이 경우 멈춘다.
- 별칭 확인: `keytool -list -keystore <경로>`(비밀번호 입력).

## 6. staging 빌드·배포

```bash
source scripts/env.sh
scripts/build-staging.sh
# → app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
adb install -r app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
```

- 앱 이름 "테스트 가화만사성"과 배지 T 아이콘으로 production 과 구분된다.
- 여러 사람에게 줄 때는 Firebase App Distribution(설정 예정, 09 §3)에 같은 APK 를 올린다.

## 7. production 빌드·Play 업로드

1. (처음 한 번) `cp app/env/production.env.example app/env/production.env` → 새 Pro 프로젝트의 ref·URL·publishable 키(대시보드 Project Settings > API), 카카오·구글 production 값 채우기
2. main 브랜치, 커밋된 상태 확인
3. 빌드:
   ```bash
   source scripts/env.sh
   scripts/build-production.sh
   ```
   - `production.env` 없음·서명 설정 없음·커밋 안 된 변경이 있으면 멈춘다(의도한 안전장치)
4. 결과 `app/android/app/build/outputs/bundle/productionRelease/app-production-release.aab` 를 Play Console > 내부 테스트(또는 비공개 테스트) > 새 버전 만들기에 올린다
5. 첫 업로드 후 Play Console > 앱 무결성의 **앱 서명 키 SHA-1** 을 카카오(키 해시)·구글(Android 클라이언트)의 production 설정에 추가(09 §2)

## 8. DB 마이그레이션 반영(사용자 실행)

```bash
scripts/db-push.sh staging      # 먼저 staging
# staging 앱으로 확인 후
scripts/db-push.sh production
```

스크립트가 하는 일:
1. 대상 ref 를 `app/env/<환경>.env` 의 `SUPABASE_PROJECT_REF` 에서만 읽는다(`supabase link` 상태를 쓰지 않음, `--remote=<ref>` 로 지정). staging·production ref 가 같으면 멈춘다
2. 대상 환경·ref 를 크게 보여 주고 `db push --dry-run` 으로 적용될 마이그레이션 목록을 보여 준다
3. **환경 이름과 ref 를 다시 입력**해야 진행(하나라도 다르면 아무것도 하지 않고 종료)
4. production 이면 먼저 스키마 백업(`supabase db dump`) → 저장소 밖 `~/bumo-jasik-backups/`(바꾸려면 `BUMOJASIK_BACKUP_DIR`)
5. `db push`

- DB 비밀번호를 물으면 비밀번호 관리자의 해당 환경 항목을 입력한다.
- 되돌리기·시드는 09 §4.

## 9. 빌드 결과 확인(설치 없이)

```bash
AAPT2=$(ls -d $ANDROID_HOME/build-tools/*/ | tail -1)aapt2
APK=app/android/app/build/outputs/apk/staging/release/app-staging-release.apk
$AAPT2 dump badging $APK | grep -E "package:|application-label:"
$AAPT2 dump resources $APK | grep -A1 -E "string/(app_env|supabase_url|kakao_scheme)"
```

## 10. 자주 막히는 곳

| 증상 | 원인·해결 |
|---|---|
| `app/env/production.env 가 없어요` | 7-1 단계 |
| `release 서명 설정이 필요해요` | 5 단계 |
| 개발 빌드가 staging 이 아니라 로컬 서버로 붙음 | `config.local.ts` 가 있음(개발 빌드에서는 그 값이 우선) |
| `Supabase 접속 값이 없어요` | 빌드 없이 실행했거나 `config.local.ts` 가 비어 있음 |
| 카카오 로그인 후 앱으로 안 돌아옴 | 그 환경 키에 패키지(`.staging` 포함)·키 해시 등록 확인 |
