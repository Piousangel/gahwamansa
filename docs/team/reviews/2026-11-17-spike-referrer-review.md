# 리뷰: 설치 경로·앱 링크 스파이크 — `spike/install-referrer-applinks` (c7cb74a) vs main

- 검토자: 독립 코드 리뷰어, 2026-11-17. 정적 검토 + worktree(`.claude/worktrees/agent-a379fc1ed5318d3a4`)에서 타입체크·단위 테스트 실행. 기기·Gradle 빌드는 다시 돌리지 않음
- 기준: docs/team/ARCHITECTURE.md, DECISIONS.md 11-17 마지막 항목들("연결 쉽게", "환경 분리 구현 방식", "설치 경로·앱 링크 스파이크"), SUMMARY(ease-and-joy) A절, reviews/2026-11-17-env-split-review.md
- 판정: **조건부 합치기**
  - 지금 합쳐도 실행 중인 앱에는 영향이 없다. `subscribeInviteCodes`·`getOnce` 를 부르는 화면이 아직 없고, alias 는 기본값으로 비활성이기 때문이다
  - 아래 H1·M1~M3 는 **화면 연결(띠·P1c) 커밋 전에** 고친다. M1 은 합치는 커밋 안에서 고치는 것을 권장(release 빌드 경로)
  - 합치기 전에 main 최신(df0c1c8)으로 rebase 하고 테스트를 다시 돌린다

## 실행 결과
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit`(worktree app/) | 통과(exit 0) |
| `npx jest --maxWorkers=2 --testPathIgnorePatterns __integration__` | **53 묶음 / 492 테스트 통과**(새 파일 `inviteLinkSources.test.ts` 50건 포함) |
| `npx eslint src/lib/linkSources __tests__/inviteLinkSources.test.ts` | 통과 |
| `jest`(통합 포함) | 통합 2 묶음은 의도대로 "config.local.ts 만 써요" 에러로 멈춤(env-split H1 보호 장치가 동작한 것. 이 브랜치 문제 아님) |
| `git merge-tree --write-tree main spike/...` | **충돌 없음**(c6e3e75). 브랜치는 68adc1c 에서 갈라졌고, main 은 그 뒤 cbabdf5 merge 와 df0c1c8(DECISIONS 스파이크 기록)으로 앞서 있다. 합친 트리에서 테스트는 돌리지 않음 |
| Gradle·실기기 | 돌리지 않음. 스파이크 문서 3절의 assembleStagingDebug·에뮬레이터 결과를 근거로만 봄 |

## 확인된 것(문제 없음)
- **XSS**: site/c/index.html 은 조각 값을 `normalize()`(`^\d{6}$`)로 거른 뒤에만 쓰고, DOM 에는 `textContent` 로만 넣는다(:89). `href` 에 들어가는 값도 6자리 숫자와 상수(HOST·PACKAGE)뿐. 조작한 조각(`#<img onerror>`, `#javascript:`)은 "번호 없음" 안내로 빠진다
- **referrer 인코딩**: Play 링크 `referrer=code%3D123456`, intent fallback 안에서는 한 번 더 인코딩되어 `%253D` → Chrome 이 한 번 풀어 Play 로 넘기면 원래 모양. 앱 쪽 `codeFromInstallReferrer` 가 `code=`·`code%3D` 둘 다 받는다
- **서버 로그**: 기본 링크는 조각(#)이라 서버에 안 간다. `<meta name="referrer" content="no-referrer">`·`noindex` 있음
- **개인정보(앱)**: 새 TS·Kotlin 코드에 로그·`console.*`·분석 호출이 없다. 분석은 `inviteAnalyticsEvent`(출처만)뿐이고 테스트가 6자리 숫자가 없음을 확인. 예외는 모두 삼키고 null(메시지에 번호가 실리지 않음). 기존 앱에도 URL 을 기록하는 Linking 핸들러·크래시 수집기는 없음(grep 확인)
- **번호 검증**: ASCII 6자리만(전각 숫자 거절, JS `\d` 는 u 플래그 없이 ASCII), 공백·하이픈만 허용, 깨진 퍼센트 인코딩은 null, referrer 512자 제한
- **Kotlin 모듈**: `AtomicBoolean` 으로 promise 를 한 번만 resolve, 모든 경로에서 `endConnection`, OK 뒤 늦게 오는 `onInstallReferrerServiceDisconnected` 도 가드에 걸린다. 확정 응답(OK·미지원·개발자·권한 오류)이면 done, 일시 실패만 3회까지 재시도. 저장 위치는 앱 전용 `SharedPreferences("install_referrer", MODE_PRIVATE)` 이고 번호는 저장하지 않는다(→ H1 참고)
- **런처 영향**: alias 에 LAUNCHER 카테고리가 없어 아이콘이 늘지 않는다. MainActivity 는 `singleTask` 이므로 실행 중 새 링크는 `onNewIntent` → JS `url` 이벤트(스파이크 문서에서 확인)
- **다른 앱이 같은 링크를 가로챌 때**: Android 12+ 는 검증되지 않은 앱에 https 링크를 기본으로 주지 않는다. /c 페이지의 intent:// 는 `package=` 로 우리 앱만 지정. Android 11 이하에서 미검증 상태면 선택 창에 다른 앱이 나올 수 있다(플랫폼 한계, 아래 L 참고)
- **의존성**: Google 공식 `installreferrer:2.2` 정확한 버전 고정, 서드파티 npm 없음(DECISIONS 스파이크 항목과 일치)
- **아키텍처**: `inviteCode.ts` 는 React·RN 을 모르는 순수 함수이고 단위 테스트가 있다. RN 의존은 `index.ts` 에만 있다

## 발견

### 높음
| ID | 위치 | 문제 | 재현 | 권장 수정 |
|---|---|---|---|---|
| H1 | InstallReferrerModule.kt:44·:89(`markDone`), linkSources/index.ts:46·:48 | **네이티브가 읽는 순간 done 을 저장하는데, 번호 자체는 JS 메모리(reducer)에만 있다.** 사용자가 띠·P1c 에서 실제로 쓰기 전에 ① 프로세스가 죽거나(첫 실행에 카카오 로그인 앱으로 넘어갔다 오는 사이 저메모리 기기에서 종료, 앱을 그냥 닫음) ② 구독한 Provider 가 resolve 전에 해제되면(`active=false` 라 값을 버림) **번호를 영구히 잃는다**. 다시 읽을 길이 없다. DECISIONS 11-17 "첫 실행 1회 읽고 **기기 저장**"과도 다르다(저장하는 건 done 표시뿐). 설치 경로 자동 채움 기능의 핵심 경로 | Play 경로 설치 → 첫 실행 → 띠가 뜨기 전(또는 온보딩 중) 앱 종료 → 재실행: `getOnce` 는 done 이라 null, 띠 없음. 개발 중에는 Provider 를 StrictMode 로 감싸면 mount→unmount→mount 에서 첫 결과를 버림 | (a) JS 가 받은 `PendingInvite` 를 만료 시각(clickTs+7일, 없으면 받은 시각+7일)과 함께 기기 저장소(앱이 이미 쓰는 저장소)에 두고 `consumed` 또는 만료 때 지운다. 또는 (b) 네이티브가 referrer 문자열을 prefs 에 보관하고 `ack()` 를 JS 가 부를 때 지운다(지금 구조면 (a)가 간단). 어느 쪽이든 "번호를 앱 저장소에 둔다"는 사실을 개인정보 방침 자동 수집 항목에 맞는지 법률 줄과 확인. 테스트: unmount 후 resubscribe·재시작 시 같은 번호가 다시 나오는지 |

### 중간
| ID | 위치 | 문제 | 재현 | 권장 수정 |
|---|---|---|---|---|
| M1 | build.gradle:249·:251 | `-PappLinkHost` 가 env 보다 우선하고 **모든 flavor·모든 빌드 타입**에 적용된다. `project.findProperty` 는 `~/.gradle/gradle.properties` 도 읽는다(서명 값을 두는 바로 그 파일, :193). 로컬 확인용으로 `appLinkHost=example.test` 를 거기 적어 두면 `build-production.sh` 의 production **release 가 조용히 example.test 로 나간다**. 또 staging·production 이 같은 host 를 받아 DECISIONS "staging 은 별도 서브도메인"과 env-split 리뷰의 "값의 원본은 app/env/<flavor>.env 한 곳" 원칙에 어긋난다 | `~/.gradle/gradle.properties` 에 `appLinkHost=example.test` 추가 → `./gradlew bundleProductionRelease` → 병합 매니페스트 host=example.test, enabled=true, 경고 없음 | `-PappLinkHost` 는 debug 작업에서만 허용(요청 작업 이름에 `Release` 가 있거나 `-PrequireRealEnv` 면 GradleException), 아니면 `-PappLinkHostStaging` 처럼 staging 한정. 쓸 때 `logger.warn` 으로 출처 표시. production.env.example·staging.env 에 `# APP_LINK_HOST=` 주석 줄과 RELEASE.md 한 줄 추가 |
| M2 | linkSources/index.ts:43·:46, inviteCode.ts `inviteReducer` | `subscribeInviteCodes` 를 다시 부를 때마다 `getInitialURL()` 이 **같은 시작 링크를 또 보낸다**. `consumed` 로 치운 번호도 Provider 재마운트(연결 성공 뒤 내비 트리 교체, 로그아웃·로그인)마다 띠로 되살아난다. 반대로 Kotlin `getOnce` 는 동시 호출에 원자적이지 않아(:28~38 읽고-쓰기) 두 번 구독하면 두 연결이 동시에 열린다 | 링크로 콜드 스타트 → 연결 성공(`consumed`) → 구독하는 Provider 재마운트 → 띠 재등장. 테스트로는 `subscribeInviteCodes` 두 번 호출 시 `111111` 이 두 번 나옴 | 구독은 앱 루트에서 한 번(모듈 단일 인스턴스로 시작 링크·referrer 결과를 캐시해 재구독에 재방출하지 않기). 처리한 `(code, source)` 를 기억해 같은 시작 링크는 무시(H1 저장소와 같이). Kotlin 은 진행 중 promise 목록을 두고 결과를 함께 resolve 하거나 `@Synchronized` + in-flight 플래그 |
| M3 | inviteCode.ts:47·:55, index.ts:30(`fromUrl`), build.gradle `writeEnvTs` | `allowedHost` 를 받을 수 있는데 아무도 넘기지 않는다. `APP_LINK_HOST` 가 env.generated.ts 에 안 들어가서 JS 는 host 를 알 방법이 없다. MainActivity 는 런처라 exported 이므로, 기기의 다른 앱이 **명시적 인텐트**(필터 무시)로 `ACTION_VIEW https://아무도메인/c#999999` 를 보내면 그 번호가 띠에 채워진다. 같은 이유로 site/c 의 `HOST` 상수(:56)와 앱 host 가 두 군데 원본 | `adb shell am start -n com.bumojasik.app.staging/com.bumojasik.app.MainActivity -a android.intent.action.VIEW -d 'https://evil.test/c#999999'` → JS `{code:'999999'}` | `writeEnvTs` 에 `APP_LINK_HOST`(없으면 빈 값) 추가, `fromUrl` 이 그 값을 `allowedHost` 로 넘기고 빈 값이면 링크 출처를 끔. P1c 가 peek RPC 로 호칭을 보여 주고 자동 연결이 없으니(SUMMARY A④) 영향은 "엉뚱한 가족 번호 미리 채움"까지이지만, 어르신 대상이라 막는 편이 맞다. site HOST 는 배포 시 같은 값으로 바꾸는 체크리스트 한 줄 |

### 낮음
| ID | 위치 | 문제 | 권장 수정 |
|---|---|---|---|
| L1 | site/c/index.html:76 | intent:// 의 `?code=` 는 Chrome 계열에서는 서버로 안 가지만, intent 를 직접 해석하지 못하는 인앱 웹뷰가 `scheme=https` 로 바꿔 `https://<host>/c?code=123456` 을 **로드하면 서버 접근 기록에 번호가 남는다**(카톡 동작은 미확인). 그때 페이지는 쿼리를 읽지 않아 "번호 없음"까지 보인다 | 실기기 확인 항목(스파이크 5절)에 "?code= 요청이 호스팅 로그에 찍히는지" 추가. 페이지가 `?code=` 도 읽고 `history.replaceState` 로 지우기. 가능하면 번호를 URL 대신 intent extra(`S.code=`)로 싣는 안 검토(네이티브에서 extra 읽기 필요) |
| L2 | AndroidManifest.xml:31~42 | 주석 "비활성 alias 의 intent-filter 는 등록·**검증되지 않는다**" 중 검증 부분은 확인 안 됨. 해석(resolve)에서 빠지는 건 맞지만, Android 12+ 도메인 검증 수집기가 컴포넌트 활성 여부를 보지 않으면 `applinks.invalid` 가 검증 대상에 올라간다(실패해도 무해) | 기본 빌드에서 `adb shell pm get-app-links com.bumojasik.app.staging` 결과를 스파이크 문서에 붙이고 주석을 사실대로 고치기 |
| L3 | InstallReferrerModule.kt:54·:60 | 콜백이 메인 스레드에서 오고 `client.installReferrer` 는 동기 Binder 호출이라 첫 실행 메인 스레드를 잠깐 막는다. 서비스가 콜백을 끝내 안 주면 promise 가 영원히 대기(시도 횟수는 이미 소모) | 콜백 안에서 백그라운드 executor 로 `installReferrer` 읽기, 5~10초 타임아웃 후 `finish(null, done=false)` |
| L4 | site/c/index.html 전체 | 동결 디자인 `docs/design/v3/web/C_page.dc.html` 과 다르다: 버튼 "가화만사성 열기"/"Play 스토어에서 설치하기", "카카오톡 안에서 열리지 않으면 ⋮…" 안내, 안심 한 줄·방침 링크가 없고 "앱 설치하기"·"앱에서 열기" 문구는 copy.ko.json 에 없는 하드코딩. "번호는 7일 동안"은 0018 의 대상 지정 재연결 번호(24시간)에는 틀림 | `site/drafts/c.html` 로 옮기거나 파일 머리에 "초안, 배포 금지"를 분명히. 실제 페이지는 C_page·라이터 문구로 다시 만들고 기간 문구는 "며칠 안에"처럼 일반화하거나 링크 종류별로 |
| L5 | site/.well-known/assetlinks.json.template | 한 파일에 production·staging 두 패키지를 둔 구조는 같은 도메인을 둘이 검증하는 모양이라 DECISIONS "staging 은 별도 서브도메인"과 어긋난다. TODO 문자열이 지문 칸에 있어 그대로 복사하면 조용히 검증 실패 | 도메인별 파일 두 개(production 도메인용, staging 서브도메인용)로 나누고, 배포 전 `grep TODO` 로 막는 체크리스트 |
| L6 | linkSources/index.ts | ARCHITECTURE "다중 어르신·iOS·토스에서 깨질 가정"·"`lib/` 는 React 를 모른다" 기준으로, `index.ts` 가 `react-native` 를 import 하면서 순수 함수를 재수출해 토스 쪽이 `linkSources` 를 그대로 import 하면 RN 이 딸려 온다 | 토스·contracts 쪽은 `linkSources/inviteCode` 만 import 하도록 파일 머리 주석에 명시, 또는 RN 부분을 `linkSources/native.ts` 로 분리 |
| L7 | Android 11 이하 | assetlinks 게시 전·검증 실패 기간에는 같은 host 를 선언한 다른 앱이 선택 창에 함께 뜰 수 있고, 거기를 고르면 조각의 번호가 그 앱으로 간다 | 플랫폼 한계. 도메인 확정 전에는 링크를 퍼뜨리지 않는다(이미 문서화됨), assetlinks 를 먼저 올리고 나서 APP_LINK_HOST 를 켠다 |

## 테스트 품질
- 좋은 점: 순수 함수 경계값(5·7자리, 전각, 깨진 인코딩, 다른 경로 `/cx`, http, 카카오 복귀 URL), referrer 이중 인코딩·organic 기본값·7일 경계(정확히 TTL 은 통과, +1초는 거절), reducer 우선순위(링크 > referrer), 구독 해제 후 무시까지 의미 있는 단언
- 빈 곳
  - H1·M2 를 드러낼 테스트가 없다: 재구독 시 시작 링크 재방출, 해제 직후 도착한 referrer, `consumed` 뒤 재구독
  - `allowedHost` 는 함수 단위로만 검증되고 실제 경로(`fromUrl`)에서 쓰이지 않는다(M3)
  - site/c 스크립트는 스파이크에서 node 로 모의 실행했다고 적혀 있지만 그 스크립트가 커밋되지 않아 회귀 확인 불가. `normalize`·`playUrl`·`intentUrl` 을 작은 테스트로 남길 것(jsdom 또는 함수 분리)
  - Kotlin 모듈은 자동 테스트 없음(Play 서비스 의존이라 이해함). 수동 절차가 스파이크 4절에 있음
  - `'분석 이벤트에는 번호 값이 없다'` 는 반환 상수를 그대로 비교하는 수준이라 회귀 방지 효과가 작다(이벤트를 실제로 보내는 화면 줄에서 `track` 호출 인자를 검사하는 테스트가 더 가치 있음)

## 합치기 조건 요약
1. main(df0c1c8) 으로 rebase 후 `tsc`·`jest --testPathIgnorePatterns __integration__` 재실행 결과 첨부
2. M1(release 에서 `-PappLinkHost` 차단) 반영
3. 화면 연결 커밋 전: H1(번호 기기 저장·만료·consumed 삭제), M2(루트 1회 구독·재방출 방지), M3(env.generated 에 APP_LINK_HOST, allowedHost 사용) + 해당 테스트
4. 출시 전: L1·L2 실기기 확인, L4 페이지를 동결 디자인으로, L5 assetlinks 도메인별 분리

## 재검토 (2026-11-17, 커밋 312224c main 합침 · 5d9a312 수정)
- 판정: **합치기 가능**. 아래 R1~R4 는 모두 낮음이라 합치기를 막지 않는다(화면 연결 줄에서 함께 처리 권장)
- 실행 결과(worktree 5d9a312): `tsc --noEmit` 통과, `jest --maxWorkers=2 --testPathIgnorePatterns __integration__` **59 묶음 / 575 테스트 통과**(inviteLinkSources 71건), 새·변경 파일 eslint 통과. `git merge-tree` 로 현재 main(1edb728)과 충돌 없음. 브랜치는 main 보다 21커밋 뒤라 합치기 직전 한 번 더 rebase·테스트. Gradle·실기기는 돌리지 않았다(manifest·도메인 검증 결과는 스파이크 문서 기록을 근거로 봄)

| 지적 | 결과 | 근거 |
|---|---|---|
| H1 번호 유실 | 해결 | `InviteModule.readStore/writeStore`(MODE_PRIVATE, `commit()`), `native.ts` 가 시작 시 저장소부터 복원하고 받은 번호를 `expiresAt`(referrer 는 clickTs 기준, 링크는 받은 시각 기준 +7일)과 함께 저장, `consumeInvite` 로 삭제, `parseInviteStore` 가 만료·깨진 값 버림. 구독 해제와 저장이 분리돼(모듈 단일 store) Provider 재마운트로 잃지 않음. 남은 틈은 R2 |
| M1 host 원본 | 해결 | `-PappLinkHost` 제거 → env 의 `APP_LINK_HOST` 한 곳. 로컬 덮어쓰기는 `-PappLinkHostDebug` 로 바꿔 `buildTypes.debug` 의 placeholder 와 debug 변형의 JS 값에만 적용(release 변형은 `e.APP_LINK_HOST` 고정). production 테스트 도메인(.test·.invalid·example.* 등)·staging=production 같은 host 면 빌드 실패 |
| M2 재방출·동시 호출 | 해결 | `startInviteSources` 는 앱 수명 동안 promise 하나, 시작 링크는 해시(`handled`, 7일)로 한 번만 반영. Kotlin `getReferrerOnce` 는 진행 중 promise 목록에 묶어 한 번만 읽음. 테스트로 재시작·재호출 확인 |
| M3 도메인 강제 | 해결 | `APP_LINK_HOST` 를 env.generated.ts 에 넣고(`clean()` 이 아는 키라 유지됨) `codeFromInviteLink(url, allowedHost)` 가 필수 인자, 빈 값이면 링크 출처 꺼짐. 쿼리 `?code=` 는 더 받지 않음 |
| L1 쿼리 번호 | 해결 | 페이지가 번호를 `S.code` 엑스트라로만 싣고 쿼리를 쓰지 않음 |
| L2 비활성 alias 검증 | 해결(문서) | 매니페스트 주석을 "해석에서 빠짐, 검증 목록에는 applinks.invalid 가 실패로 남음(무해, API 35 확인)"으로 정정 |
| L3 메인 스레드·타임아웃 | 해결 | 결과 읽기는 단일 백그라운드 executor, 10초 타임아웃 후 `finish(null, done=false)` |
| L4 페이지 | 해결 | C_page 시안 구조·문구로 교체, 기간 문구 삭제, 방침 링크·안심 한 줄. 번호 없음 상태는 시안 밖이라 라이터 확인 필요로 표시됨 |
| L5 assetlinks | 해결 | production·staging 템플릿 분리 |
| L6 RN 의존 | 해결 | `native.ts` 분리, 토스·contracts 는 `inviteCode.ts` 만 import 하라고 명시 |

### S.code 엑스트라 경로가 M3 도메인 강제를 우회하는가 — **아니다**
- `InviteIntent.moveCodeExtraToFragment`(InviteIntent.kt:16)는 `ACTION_VIEW` + `https` + 경로 `/c` + 조각 없음일 때만 엑스트라를 **data 의 조각으로 옮길 뿐**이고, host 는 건드리지 않는다. 결과 URL 은 JS 의 `codeFromInviteLink(url, APP_LINK_HOST)` 를 그대로 지나므로, 다른 앱이 명시적 인텐트로 `data=https://evil.test/c` + `S.code=999999` 를 보내면 `https://evil.test/c#999999` 가 되어 **거절**된다. data 없이 `S.code` 만 보내면 `intent.data ?: return` 에서 끝난다
- 남는 것(새 우회가 아니라 원래부터 있던 범위): 다른 앱·웹 페이지가 **우리 도메인**으로 `https://<우리 host>/c` + `S.code=X`(또는 그냥 `https://<우리 host>/c#X`)를 보내면 X 가 미리 채워진다. 엑스트라 경로를 없애도 조각 경로로 똑같이 가능하므로 S.code 가 공격면을 넓히지 않는다. 완화는 기존대로 P1c 의 peek 호칭 확인 + 자동 연결 금지(SUMMARY A④)

### 새로 본 것(모두 낮음)
| ID | 위치 | 내용 | 권장 |
|---|---|---|---|
| R1 | inviteCode.ts `inviteLinkId`, native.ts `update` | `handled` 해시는 `sha256("invite-link:"+URL)` 인데 번호가 6자리(10^6)라 host 를 알면 즉시 역산된다. 주석 "번호 원문 저장 안 함"과 달리 `consumeInvite` 뒤에도 최대 7일 번호를 복원할 수 있는 값이 남는다(같은 앱 전용 저장소라 실제 노출은 작음) | 설치별 무작위 솔트(같은 prefs 에 32바이트)를 섞거나, 주석을 "역산 가능, 앱 전용 저장소라 허용"으로 사실대로. 법률 질문(1edb728)에 같이 적기 |
| R2 | InviteModule.kt `finish`→`markDone`(apply) 후 JS `writeStore` | referrer 를 읽어 done 을 쓴 뒤 JS 가 저장하기 전에 프로세스가 죽으면 그 번호는 여전히 잃는다. 창이 수십 ms 라 실사용 영향은 작다 | 원하면 네이티브가 OK 결과 문자열을 store 에 먼저 넣거나, JS `writeStore` 완료 후 `ackReferrer()` 로 done 표시 |
| R3 | InviteIntent.kt:14 | host 를 네이티브에서 확인하지 않음(주석대로 JS 가 확인). 지금은 문제없지만 JS 쪽 검사가 바뀌면 한 겹뿐 | 방어 겹으로 `BuildConfig`/리소스의 host 와 비교 추가(선택) |
| R4 | build.gradle `-PappLinkHostDebug` | debug 덮어쓰기는 staging·production **두 debug 변형 모두**에 같은 host 를 준다. 두 debug 앱을 한 폰에 깔면 같은 host 선택 창(로컬 확인용이라 허용 범위) | RELEASE.md 또는 주석에 "debug 확인은 한 앱만 설치" 한 줄 |
