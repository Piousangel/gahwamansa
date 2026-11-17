# 리뷰: 환경 분리(staging/production) — 브랜치 worktree-agent-a5a5f0982c953a055 (커밋 6개)
- 검토자: 독립 리뷰어(빌드·릴리스·보안), 2026-11-17. 정적 검토 + 기존 산출물 aapt2·apksigner·번들 문자열 확인(빌드 재실행 안 함)
- 판정: **조건부 합치기** — H1 수정 후 합치기. M은 첫 production 출시 전까지

## 확인된 것(문제 없음)
- APK: staging `com.bumojasik.app.staging`/`1.0.0-staging`/라벨 "테스트 가화만사성", production `com.bumojasik.app`. 번들 안 env 값이 flavor별로 맞음(staging=eigocuecmaapxnmhttwj, production=placeholder). `sb_secret_`·service_role 값 없음
- provider authority(androidx-startup)는 패키지 접미사로 분리됨. versionCode 두 앱 모두 131
- gitignore: `app/env/*.env`(staging.env 예외), `env.generated.ts`, `*.keystore`/`*.jks` 무시 확인. `supabase db push/dump --remote=<ref>` 는 설치된 CLI 3.1.0 에서 유효한 플래그
- build-production.sh: production.env 없음·서명 없음·dirty 트리에서 멈춤. metro.config 는 node_modules 가 심볼릭 링크일 때만 동작(일반 체크아웃 영향 없음)
- 두 산출 APK 모두 debug 키 서명(CN=Android Debug) — 서명 설정 없는 환경이라 예상대로. Play 업로드용 아님

## 발견
| 심각도 | 위치 | 문제 | 수정 제안 |
|---|---|---|---|
| H1 | app/src/lib/config.ts:7, app/__integration__/realApi.test.ts:15·childFlow.test.ts:7 | 통합 테스트가 `loadConfig()`→`getAppEnv()` 를 쓰고 jest.integration.config 에는 가상 모킹이 없음. config.local.ts 가 없으면 **빌드가 남긴 env.generated.ts(staging, production 빌드 직후엔 production)** 로 원격에 붙어 테스트 계정·데이터를 만든다. `SUPABASE_SERVICE_ROLE_KEY` 가 있으면 원격 데이터 삭제까지. 이전엔 config.local.ts 없으면 실패했음(회귀). 이 worktree 는 지금 config.local.ts 없음 + env.generated.ts=staging 상태 | 통합 테스트는 config.local.ts 만 읽는 함수(예 `loadLocalConfig()`)를 쓰고, URL 이 127.0.0.1/10.0.2.2/LAN 이 아니면 즉시 실패 |
| M1 | app/android/app/build.gradle:231-249, app/src/lib/env.ts:496 | env.generated.ts 는 마지막 빌드 값이 남는다. `build-production.sh` 뒤 `npm start` 로 stagingDebug 앱을 리로드하면 **"테스트" 앱이 production 서버(real)** 로 붙는다(Metro 는 파일만 읽음) | release 번들 작업 doLast 에서 staging(또는 기본) 값으로 되돌리기, 또는 __DEV__ 에서 네이티브 `app_env`/BuildConfig 와 JS APP_ENV 불일치 시 throw |
| M2 | AndroidManifest(scheme=@string/kakao_scheme), app/env/staging.env:310 | 두 앱이 같은 카카오 키 → 같은 `kakao{키}://oauth` 인텐트 필터. 한 폰에 둘 다 설치 시 웹 로그인 복귀가 선택창/엉뚱한 앱으로 갈 수 있음 | staging 키 분리(09 §26)를 동시 설치 배포 전 필수로 RELEASE.md 에 명시 |
| M3 | docs/team/RELEASE.md:51-61,124 | 외부 콘솔 등록이 카카오만 트러블슈팅 한 줄. 구글은 `.staging` 패키지+release/debug SHA-1 Android 클라이언트가 없으면 네이티브 로그인 DEVELOPER_ERROR | "staging 첫 설치 전 체크리스트": 카카오(패키지·키 해시), 구글 Android 클라이언트 2개(09 §27), 계산 명령(keytool) 포함 |
| M4 | scripts/db-push.sh:646-683 | 마이그레이션 원본은 **현재 작업 트리** supabase/migrations. 브랜치·미커밋 마이그레이션이 production 에 나갈 수 있음 | production 이면 main·clean 트리(`git status --porcelain supabase/`)·origin/main 일치 확인 |
| M5 | build.gradle:101-103 | git 실패 시 versionCode 가 조용히 `1`. 비-main 은 "yes" 입력만으로 통과, 이전 출시 번호와 비교 없음 | `-PrequireRealEnv`(출시)면 git 실패를 에러로. 출시 후 `release/<versionCode>` 태그, 스크립트가 새 번호 > 마지막 태그 확인. 비-main 은 `-PversionCode` 명시 요구 |
| L1 | build.gradle:71-75 | 비밀 차단이 키 이름·`sb_secret_` 접두만 봄. `SUPABASE_PUBLISHABLE_KEY` 칸에 레거시 service_role JWT(`eyJ…`)를 넣으면 통과해 APK 에 들어감(다른 임의 키는 APK 로 안 나가므로 이 칸이 실질 경로) | 값 형식 화이트리스트: `^sb_publishable_` (레거시 허용 시 JWT payload role≠service_role 확인), URL `^https://<ref>\.supabase\.co$` 와 ref 일치 |
| L2 | build.gradle:55-65 | production release 를 스크립트 없이 `./gradlew` 로 만들면 placeholder env 로 조용히(경고만) 성공 | release 변형 + PLACEHOLDER 면 실패(로컬 확인은 `-PallowPlaceholderEnv`) |
| L3 | scripts/db-push.sh:629,639 | SUPABASE_PROJECT_REF 줄이 없으면 grep 실패 → pipefail+set -e 로 **메시지 없이** 종료 | `|| true` 후 기존 형식 검사로 안내 메시지 |
| L4 | scripts/db-push.sh:671-678 | 백업은 스키마만(데이터 없음), 권한 기본 umask | 주석·RELEASE.md 에 "데이터는 Pro 일일 백업/PITR" 명시, `umask 077` |
| L5 | RELEASE.md:54 | 키스토어 예시 경로가 저장소 안(gitignore 되지만 iCloud/복사·압축 시 유출 경로) | `~/keys/bumojasik/release.keystore` 처럼 저장소 밖 예시로 |
| L6 | app/src/lib/config.local.example.ts:12 | 예시 기본 `API_MODE:'real'` + 빈 URL → 복사만 하고 안 채우면 조용히 staging 서버로 붙음 | 기본 `'fake'` 또는 real 인데 URL 비면 dev 에서 throw |

## 기타
- jest.setup 가상 모듈은 단위 테스트를 맥 상태와 무관하게 만드는 용도로 적절. resolveAppEnv 는 appEnv.test.ts 가 직접 인자로 검증하므로 실제 동작을 가리지 않음
- 테스트·타입체크는 이 리뷰에서 돌리지 않음(정적 검토)
