# 보안 리뷰: AU-07 앱 정보 상수·앱 안 웹 화면 (fe6d431) · 2026-11-18

- 대상: 브랜치 `worktree-agent-a7d99d6b19b0ddf71` 커밋 fe6d431. 앞 커밋 c6bbca9(AU-04 푸시)는 다른 리뷰어 몫이라 제외. 기준 main eb1e3e2(merge-base 15f3497).
- 방법: 별도 worktree(fe6d431, `npm ci` 로 자체 node_modules)에서 정적 검토, 탐색 판단 함수 실측, react-native-webview 17.1.0 안드로이드 소스 확인, tsc·jest(별도 캐시)·`assembleStagingDebug` 병합 매니페스트 확인.
- 판정: **조건부 합치기 — M1 수정 후.** 웹뷰 설정 자체(JS·저장소·쿠키·파일·위치 끔, 브리지 없음, 주소는 env 상수에서만)는 좋다. 다만 "같은 호스트만 안에서" 판단이 URL 사용자 정보(`host:x@evil`)로 우회되고, 라이브러리가 판단 응답이 늦으면 허용으로 떨어진다. 지금은 어떤 화면도 Web 라우트로 가지 않으므로(연결은 AP-06·L3 몫) 출시 영향은 아직 없다.

## 실행 결과

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | 통과 |
| `jest --maxWorkers=2 --cacheDirectory <scratchpad>`(통합 제외) | 89 묶음 / 889 테스트 통과 |
| `assembleStagingDebug` 병합 매니페스트 | 성공(11분 23초). 병합 매니페스트 권한은 INTERNET·POST_NOTIFICATIONS(앱), SYSTEM_ALERT_WINDOW·ACCESS_LOCAL_NETWORK(react-android **debug** 전용), DYNAMIC_RECEIVER_NOT_EXPORTED(androidx.core), BIND_GET_INSTALL_REFERRER_SERVICE(installreferrer) — merger 보고서상 **react-native-webview 가 더한 권한 0**. 웹뷰가 더한 것은 `<queries>` 결제 intent 3개(org.chromium.intent.action.PAY·IS_READY_TO_PAY·UPDATE_PAYMENT_DETAILS)와 `RNCWebViewFileProvider`(authorities `com.bumojasik.app.staging.fileprovider`, exported=false) 뿐. `usesCleartextTraffic=true` 는 debug 자리표시자 값(앱 매니페스트 `${usesCleartextTraffic}`)이라 release 와 무관 |
| main(eb1e3e2)과 `git merge-tree` | 충돌 없음 |
| npm `react-native-webview` dist-tags | `latest` 14.0.1(2026-06-20), `next` 17.1.0(2026-11-04), `new-arch` 12.0.0-rc.2. 17.0.0→17.0.1→17.0.2→17.1.0 이 11-03 18:51 ~ 11-04 02:13 UTC 사이 7시간 반에 네 번 나왔다 |

## 발견 사항

### 중간

**M1. 같은 호스트 판단이 URL 사용자 정보로 우회된다 → 다른 사이트가 앱 웹 화면 안에 뜬다**
- 위치: `app/src/ui/WebPage.tsx:12-31`(`hostOf` 정규식 `^https:\/\/([^/?#:]+)`, `decideNavigation`)
- 원인: 호스트를 첫 `:` 까지로 자른다. `https://<허용호스트>:x@evil.test/` 는 실제로는 사용자 정보 `<허용호스트>:x` + 호스트 `evil.test` 인데 `<허용호스트>` 로 읽혀 `load` 가 된다. 포트 다른 같은 호스트(`:8443`)도 `load`.
- 재현(같은 함수를 node 로 실행, 허용 호스트 `bumojasik.example`):
  - `https://bumojasik.example:x@evil.test/p` → **load**(실제 host evil.test)
  - `https://bumojasik.example:@evil.test/` → **load**(실제 host evil.test)
  - `https://bumojasik.example:8443/` → load
  - 대조: `https://bumojasik.example@evil.test/` → external, `https://bumojasik.example.evil.test/` → external, `data:`·`intent:`·`http:` → block, `about:blank` → load
- 영향: 약관 페이지(또는 그 리다이렉트·`<meta http-equiv=refresh>` — JS 를 꺼도 동작)에 이런 링크가 들어가면 외부 페이지가 "이용약관" 제목을 단 앱 화면 안에 뜬다(피싱 문구 표시). JS·브리지·저장소가 꺼져 있어 앱 데이터 접근은 없다. 페이지는 우리 정적 사이트라 공격자가 내용을 넣어야 하므로 가능성은 낮지만, 이 함수가 보안 경계로 소개되어 있어 중간.
- 권장: `new URL(u)`(이미 `react-native-url-polyfill` 사용 중)로 `protocol === 'https:' && username === '' && password === '' && port === '' && hostname === allowedHost` 일 때만 load. 테스트에 위 세 URL 추가.

**M2. 라이브러리가 판단을 250ms 안에 못 받으면 "허용"으로 떨어진다(fail-open)**
- 위치: `node_modules/react-native-webview/android/.../RNCWebViewClient.java:39,89-123`(17.1.0) — `SHOULD_OVERRIDE_URL_LOADING_TIMEOUT = 250`, 시간 초과 시 `"defaulting to allow loading"` 으로 `return false`(로드 허용). `RNCWebView` 생성자가 항상 `mMessagingJSModule` 을 잡으므로 브리지를 안 써도 이 동기 경로를 탄다.
- 영향: JS 스레드가 바쁜 순간(화면 전환·저사양 기기 — 어르신 폰)에 누른 다른 호스트 링크·`intent:`·`http:` 가 `onShouldStartLoadWithRequest` 결과와 상관없이 웹뷰 안에서 열린다. `intent:` 는 WebView 가 직접 처리하지 않아 실패 페이지가 되지만, 다른 호스트 https 문서는 뜬다(http 는 앱의 cleartext 설정에 따름 — `mixedContentMode` 는 하위 자원만 본다).
- 권장: 두 번째 관문을 네이티브 결과와 무관하게 둔다 — `onLoadStart`/`onNavigationStateChange` 에서 `nativeEvent.url` 을 M1 의 판단으로 다시 보고 허용이 아니면 `ref.stopLoading()` + 오류 상태(내용 숨김). 근본적으로는 약관·방침이 정적 문서이므로 웹뷰 대신 앱 번들 텍스트(또는 받은 HTML 을 그리는 방식)를 다음 단계 후보로 기록.

### 낮음

**L1. "사용자가 누른 것만 밖으로"가 실제로는 보장되지 않는다**
- 위치: `app/src/ui/WebPage.tsx:44-50`. 안드로이드는 `isTopFrame` 을 항상 `true` 로 보내고(TopShouldStartLoadWithRequestEvent.kt:16, 내부 프레임은 이벤트 자체가 없음) 사용자 제스처 정보가 없다. 서버 리다이렉트·meta refresh 로 다른 https 주소가 오면 누르지 않아도 휴대폰 브라우저가 열린다.
- 권장: 주석을 사실대로 고치고, 밖으로 보내는 주소를 허용 목록(문의 메일·사업자 정보 공개 페이지 등)으로 제한하거나, 열기 전 확인 문구.

**L2. react-native-webview 17.1.0(`next` 태그) 선택**
- 17.x README: 새 아키텍처 전용·RN 0.80+ — RN 0.88.1 새 아키텍처와 맞다. 그러나 npm `latest` 는 14.0.1 이고 17.x 는 하루 사이 네 번 고친 직후의 `next` 판이다(안정성 신호 약함). 배포 14일은 넘었다.
- 판단: 이 화면은 JS 끔·브리지 없음의 아주 좁은 기능만 쓰므로 버전 간 기능 차이는 거의 없다. 14.0.1 이 RN 0.88 에서 빌드·실행되면 `latest` 를 권하고, 안 되면(레거시 의존 등) 17.1.0 유지 + 실기기(안드로이드 9·12·15)에서 로드·뒤로·글자 배율 확인을 출시 체크리스트에 넣는다. 위 M2 의 250ms fail-open 이 14.x 에도 있는지는 확인하지 않았다(버전을 바꾸든 아니든 앱 쪽 두 번째 관문으로 막는 것을 권장).
- 대안: 정적 문서이므로 웹뷰 없이 Custom Tabs(외부 브라우저 UI 지만 앱 위에 뜸)도 있으나 DECISIONS 11-18(앱 안)과 맞는지 리드 판단.

**L3. 라이브러리 FileProvider 가 외부 저장소 전체(`external-path path="."`)를 가리킨다**
- 위치: `react-native-webview/android/src/main/res/xml/file_provider_paths.xml`, 매니페스트 `${applicationId}.fileprovider`(exported=false, grantUriPermissions=true). 파일 업로드(`<input type=file>`) 카메라 촬영용이다. exported=false 라 다른 앱이 직접 쓰지는 못하고, URI 권한은 앱이 넘길 때만 생긴다. 이 앱은 파일 선택을 쓰지 않고 JS 도 꺼서 실사용 경로는 없다. 권한 추가가 없는 것은 확인(아래 매니페스트). 다른 라이브러리가 같은 authority 를 쓰면 병합 충돌이 나므로 그때 `tools:replace` 필요.

**L4. `-PallowMissingAppInfo` 가 실제 production 빌드에도 먹힌다**
- 위치: `app/android/app/build.gradle`(checkAppInfo), `scripts/build-production.sh:51`(`"$@"` 를 gradlew 에 그대로 넘김). 확인용이라는 설명과 달리 `scripts/build-production.sh -PallowMissingAppInfo` 로 앱 정보 행이 숨겨진 출시 AAB 를 만들 수 있다.
- 권장: `-PrequireRealEnv`(build-production.sh 가 항상 줌)와 같이 오면 `allowMissingAppInfo` 를 무시하거나 실패. 또는 build-production.sh 가 인자에서 이 값을 거부.

**L5. 오프라인 판정(HEAD 4초)**
- 위치: `app/src/shared/appLink.ts:13-31`. 응답이 오면 상태와 상관없이 true(405·404 도 "닿음"), 캡티브 포털도 true → 이 경우 웹뷰 `onHttpError`/`onError` 가 화면 안 한 줄로 보여 주므로 결과는 안전. 어르신은 누른 뒤 최대 4초 아무 변화가 없으므로 호출부(AP-06)에서 누름 피드백(로딩 표시·버튼 잠금)을 같이 둘 것. 타이머·abort 정리는 맞다.

**L6. 기존 내보내기 호환 — 동작 변화 두 가지**
- `APP_VERSION` 이 release 에서 `"1.0.0 (n)"` 로 바뀐다(설정 버전 줄·접근성 라벨). 의도된 변화이고 테스트 환경은 `'1.0.0'` 유지라 기존 테스트 통과.
- `PRIVACY_URL`·`CONTACT_EMAIL` 이 지금까지 항상 null 이었는데 env 에 값을 넣는 순간 자녀 C7 `ChildAppInfo` 가 **외부 브라우저**(`Linking.openURL`)로 방침을 연다 — DECISIONS 11-18(앱 안)과 어긋남. dev-app-notes 에 L3 몫으로 적혀 있으나, US-03 값이 먼저 들어오면 그대로 나간다. 값 투입과 C7 연결을 같은 작업으로 묶을 것.

## 확인된 좋은 점
- Web 라우트 파라미터는 `target: 'terms'|'privacy'` 뿐이고 주소는 `allowedWebUrl` 이 env 상수에서만 꺼낸다. 앱에 내비게이션 `linking` 설정이 없어 딥링크로 라우트를 열 길도 없다(`git grep linking` 0건). 모르는 target 이면 방침 주소로 떨어질 뿐 임의 주소는 불가.
- 웹뷰: `javaScriptEnabled=false`, DOM 저장소·쿠키·캐시 끔+`incognito`, 파일 접근 3종 끔, `mixedContentMode="never"`, `setSupportMultipleWindows=false`(window.open·target=_blank 는 같은 창 이동으로 다시 판단을 거침), 위치 끔, `onMessage`·주입 JS 없음. `data:`·`javascript:`·`intent:`·`file:`·`http:` 는 block.
- IDN 닮은 호스트: 문자열 완전 일치라 punycode 다른 호스트는 external(브라우저가 주소창에 실제 호스트 표시).
- env 값: Gradle·앱 양쪽 형식 검사, JSON 직렬화로 env.generated 에 들어가 따옴표 주입 불가. 값은 BuildConfig·resValue 로 가지 않음.
- production release 앱 정보 누락 실패 게이트(예시 값 빌드는 제외)와 경고.

## 합치기 판정
**조건부 승인.** M1(URL 파싱으로 호스트·사용자 정보·포트 판정)을 고친 뒤 합친다. M2(로드 시작 때 두 번째 확인)는 Web 화면을 실제로 연결하는 AP-06·L3 전에 반드시. L4 는 한 줄이라 이번에 같이 하길 권한다. 나머지는 기록 후 진행.

## AU-06 오픈소스 라이선스 목록·화면 (43d9b62, fe6d431 위) · 가벼운 리뷰

| 항목 | 결과 |
|---|---|
| package-lock 변화 | 없음(fe6d431 과 같음) — 새 의존성·플러그인 없음 확인 |
| `node scripts/ossLicenses.js --check` | "최신" |
| `tsc --noEmit` / `jest --maxWorkers=2`(별도 캐시, 통합 제외) | 통과 / 90 묶음·894 테스트 통과 |
| `./gradlew :app:verifyOssLicenses` | 통과(온라인 7.4초, `--offline` 2.8초 — 이 맥은 POM 이 캐시에 있음) |
| 생성 파일 | js 228,396B(264개, 전문 138종) + android 49,156B(149개, 라이선스 없는 항목 0) = 약 278KB |

**판단**
- 스크립트(`app/scripts/ossLicenses.js`): node 표준 모듈만, 입력은 package-lock(dev·devOptional·optional·link 제외)과 node_modules 의 LICENSE·COPYING·NOTICE. 네트워크·셸 실행 없음. 보안 문제 없음.
- 화면(`app/src/app/OssScreen.tsx`): 전문·주소를 글자로만 보이고 링크를 열지 않는다. 라우트 파라미터 없음. 문제 없음.

**낮음·중간 지적**
- O1(중간, 빌드·CI) `app/android/app/build.gradle` verifyOssLicenses 가 **모든 release preBuild**(staging 포함)에서 의존성 해석 + POM(부모 3단계) 조회 + `node` 실행을 한다. 출력이 없는 작업이라 매번 돈다. 캐시가 빈 CI·새 맥에서 POM 저장소가 잠깐 실패하면 `ossPomLicenses` 가 빈 목록을 돌려주고 JSON 이 달라져 "목록이 낡았어요"로 **엉뚱한 이유의 release 실패**가 난다. Android Studio 처럼 PATH 에 node 가 없는 실행에서도 실패한다(RN 번들도 node 를 쓰므로 실제로는 드묾). 권장: POM 해석 실패는 "낡음"과 다른 메시지로 구분해 실패, 검사를 `build-production.sh`·CI 단계로 옮기거나 `-PskipOssCheck`(staging 만) 허용, 실패 메시지에 달라진 패키지 이름 몇 개를 찍기.
- O2(낮음, 번들) 약 278KB JSON 이 모든 사용자의 JS 번들에 들어간다(`require` 를 함수 안에 둬도 Metro 는 번들에 넣고 실행만 미룬다 — "화면을 열 때 읽는다"는 파싱 시점 얘기). 목록에 metro·hermes-compiler·react-devtools-core 같은 빌드·개발 도구도 섞여 있다(lock 상 dev 표시가 없어서). 크기를 줄이려면 전문은 SPDX 이름별 대표 본문 + 저작권 줄만 두는 방식, 또는 빌드 도구 제외 목록.
- O3(낮음, 고지 완전성) 전문 없는 5개: `@react-native-async-storage/async-storage@3.1.1`(MIT, **앱 런타임에 실제로 들어감**), `fast-base64-decode@1.0.0`(MIT), `boolbase@1.0.0`(ISC), `@react-native/debugger-frontend@0.88.1`(BSD-3, 개발 도구), `fb-dotslash@0.5.8`(MIT OR Apache-2.0, 빌드 도구). MIT·ISC·BSD 는 저작권 고지+허가 문구를 함께 실어야 하므로 이름만 보이는 처리는 부족하다. 권장: 스크립트에 고정 보충 표(패키지 → 저장소 LICENSE 원문)를 두고 개발 도구 둘은 목록에서 빼기. `fb-dotslash` 는 라이선스가 정확히 `MIT` 가 아니라 META_FAMILY 대체가 걸리지 않은 것이다.
- O4(낮음, 고지 완전성) Android 쪽은 POM 의 라이선스 이름·주소만 있다. react-android·hermes-android AAR 안에 정적 링크된 C++ 라이브러리(folly·boost·glog·fmt·double-conversion 등)는 POM 에 안 나와 두 목록 어디에도 없다. Apache-2.0 의 NOTICE 요구도 확인하지 않는다. 출시 전 법률 확인 항목(questions-for-lawyer)에 한 줄 추가를 권장.
- O5(낮음) jest `ossLicenses.test` 가 node_modules 상태로 다시 만들어 비교하므로 lock 과 다른 node_modules(오래된 설치)에서는 코드와 무관하게 jest 가 실패한다. 실패 메시지에 `npm ci` 안내를 넣을 것.

**AU-06 판정: 승인(웹뷰 판정과 별개).** O1 은 다음 CI 정비 때, O3 는 G-INT 전에 처리.
