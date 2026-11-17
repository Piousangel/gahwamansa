# 스파이크: 카톡 링크 → App Links / Play Install Referrer 로 가족 번호 자동 채움 (2026-11-17)

- 관문: SUMMARY(ease-and-joy) A절 "착수 첫날 2~3h 스파이크", DECISIONS 11-17 "연결 쉽게"
- 브랜치: `spike/install-referrer-applinks`
- 링크: `https://<도메인>/c#123456` (번호는 URL 조각 → 서버 접근 기록에 안 남음)

## 판정: **조건부 가능**

| 경로 | 판정 | 조건 |
|---|---|---|
| 앱 있음 · 일반 브라우저/메시지 앱 → App Links 로 앱 열기 + 번호 | 가능(코드 확인됨) | 도메인 확정 + assetlinks.json 게시 + 검증 `verified` |
| 앱 있음 · **카톡 인앱 브라우저** | 조건부 | 인앱 브라우저는 https 링크를 웹뷰 안에서 열 가능성이 높아 App Links 자동 전환을 기대하지 않는다. /c 페이지의 **[앱에서 열기] intent:// 버튼**(사용자 탭)으로 연다. 카톡이 intent:// 를 넘기는지는 **실기기 확인 필요**(공식 문서 없음) |
| 앱 없음 → Play 설치 → 첫 실행 referrer 로 번호 | 조건부 | Play 를 통한 설치에서만 동작(staging 은 Play 에 없어 확인 불가). 카톡 인앱에서 Play 링크가 market 스킴으로 바뀔 때 referrer 보존 여부는 **내부 테스트 트랙에서 확인 필요** |
| 위가 하나라도 실패 | 대안 | **번호 손 입력 + 6자리 자동 확인만**(이미 결정된 보조 경로). 메시지에 번호 단독 줄 "123 456" 이 있으므로 기능 손실 없이 출시 가능 |

결론: 구현 비용이 작고(네이티브 1모듈·의존성 1개·순수 함수) 실패해도 손 입력으로 떨어지므로 **빌드1에 넣되, 카톡 실기기 2건(아래 5절)이 통과할 때만 "자동 채움"을 홍보 문구에 쓴다.**

## 1. 조사 결과 (출처)

1. **Install Referrer 동작** — 공식 클라이언트 `com.android.installreferrer:installreferrer:2.2`. `startConnection` 비동기 → `OK` 면 `getInstallReferrer()` 로 `installReferrer`(문자열), `referrerClickTimestampSeconds`, `installBeginTimestampSeconds`. 끝나면 `endConnection()`.
   - "referrer 정보는 **90일** 동안 제공되고 앱을 재설치하지 않는 한 **바뀌지 않는다**. 불필요한 호출을 피하려고 **설치 후 첫 실행에 한 번만** 호출하라." → 우리 구현: 결과 확정 시 기기에 done 저장, 일시 실패만 최대 3회 재시도.
   - Play 스토어 앱 8.3.73+ 기기에서 동작, Play Console 계정 필요. **Play 를 거치지 않은 설치(adb·App Distribution)는 referrer 가 비거나 서비스 응답만 온다.**
   - 출처: https://developer.android.com/google/play/installreferrer/library , https://developer.android.com/google/play/installreferrer
2. **Play 링크 referrer 형식** — `https://play.google.com/store/apps/details?id=<패키지>&referrer=<URL 인코딩한 값>`(512자 이하). 예 `referrer=utm_source%3Dsearch%26...`. → 우리 값 `referrer=code%3D123456`, 앱은 `code=123456` 을 받는다(이중 인코딩도 한 번 풀어 처리).
   - 출처: https://developer.android.com/games/playgames/user-acquisition
3. **URL 조각(#)은 서버·Play 로 가지 않는다** — 조각은 클라이언트에서만 해석(RFC 3986 §3.5). 따라서 `https://<도메인>/c#123456` 을 Play 로 그대로 보낼 수 없고, **/c 페이지 JS 가 `location.hash` 를 읽어 Play 링크 referrer 로 바꿔야 한다**(구현함). 앱이 App Links 로 받을 때는 Android 가 intent data 에 조각까지 넘기므로 JS(`Linking`)가 읽는다.
   - 출처: https://www.rfc-editor.org/rfc/rfc3986#section-3.5
4. **intent:// (Chrome 계열)** — `intent://<host>/<path>#Intent;scheme=https;package=<패키지>;S.browser_fallback_url=<인코딩 URL>;end`. 앱을 못 열면 fallback URL 로. **사용자 제스처 없이(타이머·자동 이동) 시작하면 앱을 열지 않는다** → /c 페이지는 자동 이동 없이 버튼만. `#Intent` 가 조각 자리를 쓰므로 번호는 쿼리 `?code=` 로 싣는다(intent:// 는 서버 요청이 아니라 기록 안 남음).
   - 출처: https://developer.chrome.com/docs/android/intents
5. **카카오톡 인앱 브라우저** — 카카오 공식 문서에 인앱 브라우저의 App Links/intent 처리 명세는 **없음**. 데브톡 사례:
   - Android 카톡 인앱 브라우저에서 원링크(딥링크) URL 접근 시 **마켓 스킴으로 301** 되는 동작, 카카오 답변은 "앱 스킴 설정 + fallback 에 마켓 URL"(2025-12) → intent/fallback 방식이 동작하는 사례. https://devtalk.kakao.com/t/topic/147516
   - `kakaotalk://web/openExternal` 로 외부 브라우저 열어 Branch 딥링크 실행이 안 된다는 문의에 카카오는 "데브톡 범위 밖, 고객센터 문의"(2026-08) → 인앱 정책은 공식 답이 없다. https://devtalk.kakao.com/t/branch/151358
   - 카카오 하이브리드 문서: Android 웹뷰에서 앱 실행은 Intent URI 사용. https://developers.kakao.com/docs/latest/ko/javascript/hybrid
   - 결론: **실기기에서 확인해야 하는 항목**(5절). 문서로 확정 불가.
6. **assetlinks.json 요구 사항** — `https://<도메인>/.well-known/assetlinks.json`, `Content-Type: application/json`, **HTTPS**, **리다이렉트 없음(301/302 금지)**, 인증 없이 접근. Play App Signing 을 쓰면 **Play Console 앱 서명 페이지의 SHA-256**(로컬 업로드 키 지문과 다름). 한 파일에 여러 패키지(production·staging) 가능. Android 12+ 는 `pm verify-app-links --re-verify`·`pm get-app-links` 로 확인, Android 15+ 는 최대 7일 간격 재검증.
   - 출처: https://developer.android.com/training/app-links/configure-assetlinks , https://developer.android.com/training/app-links/verify-android-applinks

## 2. 구현 (최소)

| 파일 | 내용 |
|---|---|
| `app/android/app/build.gradle` | 의존성 `com.android.installreferrer:installreferrer:2.2`(정확 고정). `APP_LINK_HOST`(env, 선택) 또는 `-PappLinkHost=` → manifest placeholder `appLinkHost`·`appLinksEnabled`. **없으면 비활성**, 도메인 형식 검사 |
| `AndroidManifest.xml` | `activity-alias .InviteLinkActivity` → MainActivity, `android:enabled="${appLinksEnabled}"`, intent-filter `autoVerify` https `${appLinkHost}` path `/c`. 비활성 alias 의 필터는 등록·검증되지 않는다 |
| `invite/InstallReferrerModule.kt`, `InvitePackage.kt` | `getOnce()` → `{referrer, clickTs}` 또는 null. 확정 결과면 SharedPreferences done(재사용 방지), 일시 실패 3회까지. 원문 로그 금지 |
| `app/src/lib/linkSources/inviteCode.ts` | 순수 함수: `normalizeInviteCode`(6자리), `codeFromInviteLink`(조각 우선, `?code=` 허용, https·`/c` 만), `codeFromInstallReferrer`(code 파라미터, 7일 넘은 클릭 버림), `inviteReducer`·`familyCodeBanner`(첫 화면 띠 값, 링크가 referrer 보다 우선, consumed 로 치움), `inviteAnalyticsEvent`(출처만, 번호 없음) |
| `app/src/lib/linkSources/index.ts` | `subscribeInviteCodes(listener)`: `Linking.getInitialURL` + `url` 이벤트 + referrer 1회. 화면 연결은 다른 줄 |
| `app/__tests__/inviteLinkSources.test.ts` | 50건 |
| `site/c/index.html` | 안내 페이지 초안: 조각 읽어 번호 크게(3·3), Android 면 [앱에서 열기] intent(fallback=Play+referrer), [앱 설치하기] Play+referrer, 번호 없거나 JS 꺼지면 손 입력 안내. noindex·no-referrer, 번호는 textContent 로만 |
| `site/.well-known/assetlinks.json.template` | production·staging 두 패키지, SHA-256 은 TODO(사용자) |

화면 연결(다른 줄 몫): 앱 루트 Provider 에서 `subscribeInviteCodes` → `inviteReducer`, 어르신 첫 화면은 `familyCodeBanner(state)` 로 띠 표시, 띠 탭 → P1c 에 번호 미리 채움(**자동 연결 금지**), 연결 성공·"다른 번호 쓰기" → `consumed`. 분석은 `inviteAnalyticsEvent` 만.

## 3. 검증 결과

- `tsc --noEmit` 통과, `eslint`(새 파일) 통과, `jest --maxWorkers=2`(통합 제외) **53 스위트 / 492 테스트 통과**(새 파일 50건 포함)
- `./gradlew assembleStagingDebug` 성공(기본값: 병합 매니페스트에서 alias `enabled=false`, host `applinks.invalid` 확인). `-PappLinkHost=example.test` 빌드도 성공(`enabled=true`, host `example.test`)
- 에뮬레이터 `gahwa_parent`(API 35, Play 스토어 있음), example.test 빌드 + Metro, 임시 로그 코드(커밋 안 함)로 확인:
  - 콜드 스타트 `am start -a VIEW -c BROWSABLE -d 'https://example.test/c#123456' com.bumojasik.app.staging` → `InviteLinkActivity`(alias) → MainActivity, intent data 에 `#123456` 보존, JS `{"code":"123456","source":"app_link"}`
  - 실행 중 새 링크 `#654321` → onNewIntent → JS `url` 이벤트로 `654321`
  - `pm set-app-links-user-selection ... true example.test` 후 **패키지 지정 없이** `https://example.test/c?code=111222`(intent:// 버튼 경로) → 앱 열림, `111222`
  - 검증 상태 `example.test: none`(assetlinks 없음, 예상대로). 실제 도메인에서 `verified` 는 도메인 확정 후
  - Install Referrer: 모듈 등록 확인, adb 설치라 번호 없음(띠 안 뜸). SharedPreferences `done=true, tries=1` → 재실행 시 다시 호출하지 않음 확인
- /c 페이지 스크립트를 node 로 모의 실행: `#123456`/Android → intent `intent://example.test/c?code=123456#Intent;scheme=https;package=com.bumojasik.app;S.browser_fallback_url=…referrer%3Dcode%253D123456;end`, Play `…&referrer=code%3D123456`, 번호 표시 "123 456". `#abc`·빈 조각 → 손 입력 안내. 실제 카톡 인앱·Chrome 에서의 intent 동작은 미확인(5절)

## 4. Install Referrer 는 로컬에서 확인 불가

- staging 은 Play 에 올리지 않고(RELEASE.md), adb 설치 앱에는 Play 가 referrer 를 주지 않는다. 에뮬레이터 `gahwa_parent` 도 Play 스토어 이미지가 아니면 `FEATURE_NOT_SUPPORTED`/연결 실패 → 모듈은 null(정상 처리 확인 대상).
- **Play 내부 테스트 트랙 확인 절차**(사용자: 콘솔 작업):
  1. production 빌드에 이 브랜치 포함 → Play Console 내부 테스트 트랙 업로드, 테스터 계정 등록·옵트인 링크 수락
  2. 테스트 폰에서 앱 삭제(재설치여야 referrer 가 새로 잡힘)
  3. 카톡 "나와의 채팅"에 `https://play.google.com/store/apps/details?id=com.bumojasik.app&referrer=code%3D123456` 를 보내고 탭 → 설치(내부 테스트는 옵트인 계정이면 일반 상세 페이지로 설치됨)
  4. 첫 실행 → 첫 화면 띠에 123 456 이 보이면 통과(띠 UI 전이면 개발 메뉴/로그로 `subscribeInviteCodes` 결과 확인 — 번호 값 로그는 확인 후 제거)
  5. 앱을 껐다 켜도 다시 뜨지 않는지(1회) 확인
  6. 같은 순서를 **/c 페이지 [앱 설치하기]** 로 반복(카톡 인앱 → market 전환 시 referrer 보존 확인)

## 5. 실기기 확인 항목(도메인 확정 후, 사용자 폰)

1. 카톡 메시지의 `https://<도메인>/c#123456` 탭 → (앱 있음) 앱이 바로 열리는지 / 인앱 브라우저로 /c 가 열리는지. 열리면 [앱에서 열기] 탭 → 앱이 번호와 함께 열리는지
2. (앱 없음) /c [앱 설치하기] → Play → 설치 → 첫 실행 번호 채움(4절)
3. 둘 다 실패하면: 이 기능의 "자동 채움" 표현을 빼고 손 입력 경로만(대안). 앱 코드는 그대로 둬도 무해(번호 없으면 띠 없음)

## 6. 남은 일·제안(리드)

- 도메인 확정 → `app/env/production.env` 에 `APP_LINK_HOST=<도메인>` (staging 은 별도 서브도메인 권장: 같은 도메인을 두 패키지가 동시에 검증하면 한 폰에 둘 다 깔렸을 때 선택 창이 뜸)
- site 호스팅에 `.well-known/assetlinks.json`(템플릿 → 실제 지문) 을 **리다이렉트 없이** 올리기. GitHub Pages 면 `.well-known` 을 위해 `.nojekyll` 필요할 수 있음
- DECISIONS 제안: "카톡 링크 자동 채움은 실기기 2건 통과 전까지 홍보 문구 금지, 실패 시 손 입력만" / "staging App Links 는 별도 서브도메인"
- iOS: Universal Links + 지연 딥링크는 Apple 이 referrer 를 주지 않음 → iOS 는 손 입력(또는 클립보드는 기각됨). /c 페이지의 Play 버튼은 iOS 에서 App Store 링크로 바꿀 것(초안은 Play 고정)
