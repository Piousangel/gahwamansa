# 스파이크: 카톡 링크 → App Links / Play Install Referrer 로 가족 번호 자동 채움 (2026-11-17)

- 관문: SUMMARY(ease-and-joy) A절 "착수 첫날 2~3h 스파이크", DECISIONS 11-17 "연결 쉽게"
- 브랜치: `spike/install-referrer-applinks`
- 링크: `https://<도메인>/c#123456` (번호는 URL 조각 → 서버 접근 기록에 안 남음)

## 판정: **조건부 가능**

| 경로 | 판정 | 조건 |
|---|---|---|
| 앱 있음 · 일반 브라우저/메시지 앱 → App Links 로 앱 열기 + 번호 | 가능(코드 확인됨) | 도메인 확정 + assetlinks.json 게시 + 검증 `verified` |
| 앱 있음 · **카톡 인앱 브라우저** | 조건부 | 인앱 브라우저는 https 링크를 웹뷰 안에서 열 가능성이 높아 App Links 자동 전환을 기대하지 않는다. /c 페이지의 **[가화만사성 앱에서 열기] intent:// 버튼**(사용자 탭)으로 연다. 카톡이 intent:// 를 넘기는지는 **실기기 확인 필요**(공식 문서 없음) |
| 앱 없음 → Play 설치 → 첫 실행 referrer 로 번호 | 조건부 | Play 를 통한 설치에서만 동작(staging 은 Play 에 없어 확인 불가). 카톡 인앱에서 Play 링크가 market 스킴으로 바뀔 때 referrer 보존 여부는 **내부 테스트 트랙에서 확인 필요** |
| 위가 하나라도 실패 | 대안 | **번호 손 입력 + 6자리 자동 확인만**(이미 결정된 보조 경로). 메시지에 번호 단독 줄 "123 456" 이 있으므로 기능 손실 없이 출시 가능 |

결론: 구현 비용이 작고(네이티브 모듈 1개·의존성 1개·순수 함수) 실패해도 손 입력으로 떨어지므로 **빌드1에 넣되, 카톡 실기기 2건(아래 5절)이 통과할 때만 "자동 채움"을 홍보 문구에 쓴다.**

## 1. 조사 결과 (출처)

1. **Install Referrer 동작** — 공식 클라이언트 `com.android.installreferrer:installreferrer:2.2`. `startConnection` 비동기 → `OK` 면 `getInstallReferrer()` 로 `installReferrer`(문자열), `referrerClickTimestampSeconds`, `installBeginTimestampSeconds`. 끝나면 `endConnection()`.
   - "referrer 정보는 **90일** 동안 제공되고 앱을 재설치하지 않는 한 **바뀌지 않는다**. 불필요한 호출을 피하려고 **설치 후 첫 실행에 한 번만** 호출하라." → 우리 구현: 결과 확정 시 기기에 done 저장, 일시 실패만 최대 3회 재시도.
   - Play 스토어 앱 8.3.73+ 기기에서 동작, Play Console 계정 필요. **Play 를 거치지 않은 설치(adb·App Distribution)는 referrer 가 비거나 서비스 응답만 온다.**
   - 출처: https://developer.android.com/google/play/installreferrer/library , https://developer.android.com/google/play/installreferrer
2. **Play 링크 referrer 형식** — `https://play.google.com/store/apps/details?id=<패키지>&referrer=<URL 인코딩한 값>`(512자 이하). 예 `referrer=utm_source%3Dsearch%26...`. → 우리 값 `referrer=code%3D123456`, 앱은 `code=123456` 을 받는다(이중 인코딩도 한 번 풀어 처리).
   - 출처: https://developer.android.com/games/playgames/user-acquisition
3. **URL 조각(#)은 서버·Play 로 가지 않는다** — 조각은 클라이언트에서만 해석(RFC 3986 §3.5). 따라서 `https://<도메인>/c#123456` 을 Play 로 그대로 보낼 수 없고, **/c 페이지 JS 가 `location.hash` 를 읽어 Play 링크 referrer 로 바꿔야 한다**(구현함). 앱이 App Links 로 받을 때는 Android 가 intent data 에 조각까지 넘기므로 JS(`Linking`)가 읽는다.
   - 출처: https://www.rfc-editor.org/rfc/rfc3986#section-3.5
4. **intent:// (Chrome 계열)** — `intent://<host>/<path>#Intent;scheme=https;package=<패키지>;S.browser_fallback_url=<인코딩 URL>;end`. 앱을 못 열면 fallback URL 로. **사용자 제스처 없이(타이머·자동 이동) 시작하면 앱을 열지 않는다** → /c 페이지는 자동 이동 없이 버튼만. `#Intent` 가 조각 자리를 쓰므로 번호는 엑스트라 `S.code=` 로 싣고 앱이 조각으로 옮긴다(쿼리에 실으면 intent 를 못 읽는 웹뷰가 https 로 로드할 때 서버 기록에 남을 수 있음).
   - 출처: https://developer.chrome.com/docs/android/intents
5. **카카오톡 인앱 브라우저** — 카카오 공식 문서에 인앱 브라우저의 App Links/intent 처리 명세는 **없음**. 데브톡 사례:
   - Android 카톡 인앱 브라우저에서 원링크(딥링크) URL 접근 시 **마켓 스킴으로 301** 되는 동작, 카카오 답변은 "앱 스킴 설정 + fallback 에 마켓 URL"(2025-12) → intent/fallback 방식이 동작하는 사례. https://devtalk.kakao.com/t/topic/147516
   - `kakaotalk://web/openExternal` 로 외부 브라우저 열어 Branch 딥링크 실행이 안 된다는 문의에 카카오는 "데브톡 범위 밖, 고객센터 문의"(2026-08) → 인앱 정책은 공식 답이 없다. https://devtalk.kakao.com/t/branch/151358
   - 카카오 하이브리드 문서: Android 웹뷰에서 앱 실행은 Intent URI 사용. https://developers.kakao.com/docs/latest/ko/javascript/hybrid
   - 결론: **실기기에서 확인해야 하는 항목**(5절). 문서로 확정 불가.
6. **assetlinks.json 요구 사항** — `https://<도메인>/.well-known/assetlinks.json`, `Content-Type: application/json`, **HTTPS**, **리다이렉트 없음(301/302 금지)**, 인증 없이 접근. Play App Signing 을 쓰면 **Play Console 앱 서명 페이지의 SHA-256**(로컬 업로드 키 지문과 다름). 한 파일에 여러 패키지(production·staging) 가능. Android 12+ 는 `pm verify-app-links --re-verify`·`pm get-app-links` 로 확인, Android 15+ 는 최대 7일 간격 재검증.
   - 출처: https://developer.android.com/training/app-links/configure-assetlinks , https://developer.android.com/training/app-links/verify-android-applinks

## 2. 구현 (최소, 리뷰 2026-11-17-spike-referrer-review 반영)

| 파일 | 내용 |
|---|---|
| `app/android/app/build.gradle` | 의존성 `com.android.installreferrer:installreferrer:2.2`(정확 고정). **host 원본은 `app/env/<flavor>.env` 의 `APP_LINK_HOST` 한 곳**(없으면 alias 비활성). production 에 테스트 도메인(.test·.invalid·example.*·localhost 등)이면 실패, staging·production 같은 값이면 실패. 로컬 확인용 `-PappLinkHostDebug=` 는 **debug 빌드 타입에만**(release 매니페스트·env.generated 에는 안 들어감, 확인함). `APP_LINK_HOST` 를 `env.generated.ts` 로 JS 에 넘김(M1·M3) |
| `AndroidManifest.xml` | `activity-alias .InviteLinkActivity` → MainActivity, `enabled="${appLinksEnabled}"`, autoVerify https `${appLinkHost}` path `/c` |
| `invite/InviteModule.kt` | `getReferrerOnce()`: 확정 결과면 done(재호출 안 함), 일시 실패 3회까지, **동시 호출은 한 번에 묶음**(M2), 결과 읽기는 **백그라운드 스레드 + 10초 타임아웃**(L3). `readStore`/`writeStore`: 받은 번호를 **앱 전용 SharedPreferences `invite_store`(MODE_PRIVATE, allowBackup=false)** 에 저장 — AsyncStorage 안 씀(H1). 로그 없음 |
| `invite/InviteIntent.kt`, `MainActivity.kt` | /c 페이지 intent:// 버튼이 보낸 엑스트라 `code`(6자리만)를 `https://<host>/c#<번호>` 조각으로 옮김(onCreate·onNewIntent). 쿼리 `?code=` 는 쓰지 않음(L1) |
| `app/src/lib/linkSources/inviteCode.ts` | **RN 없는 순수 함수**(토스·contracts 는 이것만 import, L6): 6자리 검증, `codeFromInviteLink(url, allowedHost)`(조각만, 허용 도메인만, 도메인 미정이면 끔), `codeFromInstallReferrer`(7일 넘은 클릭 버림), 저장 상태 `InviteStore{pending(번호+만료 시각), handled(처리한 시작 링크의 SHA-256, 번호 원문 아님)}` + `applyInvite`/`consumeInviteStore`/`familyCodeBanner`/`parseInviteStore`(깨진 값·만료 버림), `inviteAnalyticsEvent`(출처만) |
| `app/src/lib/linkSources/native.ts` | RN 연결: `startInviteSources()`(앱 수명 1회, 여러 번 불러도 같은 promise) = 저장 복원 → 시작 링크(처리 ID 면 무시) → referrer. `subscribeInvite`(현재 값 즉시 + 변경), `consumeInvite()`(번호 삭제). 상태 변경은 한 줄 큐로 저장 순서 보장 |
| `app/src/lib/linkSources/index.ts` | 앱용 진입점(RN 의존) |
| `app/__tests__/inviteLinkSources.test.ts` | 71건: 순수 함수·저장/만료/재시작·재구독 재방출 없음·처리 ID·다른 도메인 무시·단일 시작·build.gradle 규칙·/c 페이지 스크립트(가짜 DOM) |
| `site/c/index.html` | 동결 시안 `docs/design/v3/web/C_page.dc.html` 1:1(로고·색·글꼴·문구 "가족이 보낸 연결 번호예요"/"가화만사성 앱에서 열기"/"Play 스토어에서 받기"/안심 줄·방침 링크). Android 는 열기 화면, 누른 뒤 2.5초 지나도 페이지가 보이면 설치 전 화면으로. **기한 문구 없음**(번호 종류마다 서버 만료가 다름 — 기한은 공유 메시지 담당). 번호 없음·JS 꺼짐 상태는 시안 밖 → 라이터 확인 필요 |
| `site/.well-known/assetlinks.{production,staging}.json.template` | 도메인별 분리(L5). 지문은 TODO(사용자) |

화면 연결(다른 줄 몫): 앱 루트에서 `startInviteSources()` 한 번, 어르신 첫 화면은 `subscribeInvite` 로 띠, 띠 탭 → P1c 에 번호 미리 채움(**자동 연결 금지**), 연결 성공·"다른 번호 쓰기" → `consumeInvite()`. 분석은 `inviteAnalyticsEvent` 만. 첫 값은 저장 복원 전 `visible:false` 가 한 번 오고 곧 실제 값이 온다(띠는 깜빡임 없이 늦게 나타나는 쪽으로 그릴 것).
- 알려진 절충: 처리한 "시작 링크"는 해시로 7일 기억해 최근 앱에서 다시 열 때 재전달을 막는다. 그래서 같은 링크를 앱이 꺼진 상태에서 일부러 다시 눌러도 띠가 안 뜬다(실행 중 누르면 뜬다). 번호는 메시지에 단독 줄로 있으므로 손 입력 가능

## 3. 검증 결과 (main 34cebe6 merge 후)

- `tsc --noEmit` 통과, `eslint`(새·바꾼 파일) 통과, `jest --maxWorkers=2`(통합 제외) **59 스위트 / 575 테스트 통과**(새 파일 71건 포함). 테스트를 먼저 쓰고 실패 확인 후 구현
- `./gradlew assembleStagingDebug` 성공. 기본값: alias `enabled=false`, host `applinks.invalid`, `env.generated.ts` `APP_LINK_HOST: ""`
- `processStagingReleaseMainManifest assembleStagingDebug -PappLinkHostDebug=example.test`: **debug 매니페스트만** `enabled=true`·`example.test`, release 매니페스트는 `enabled=false`·`applinks.invalid`(M1 확인)
- 에뮬레이터 `gahwa_parent`(API 35, Play 스토어 있음), debug override 빌드 새로 설치 + Metro, 임시 로그 코드(커밋 안 함):
  - 콜드 스타트 `https://example.test/c#123456` → 띠 `{visible:true, code:"123456"}`. 저장소 `invite_store.xml` 에 pending(번호·만료 시각)과 handled(해시)만
  - **프로세스 종료 후 일반 실행 → 같은 번호 다시 나옴**(H1)
  - pending 을 비운 뒤(consumed 흉내) 같은 시작 링크 재전달 → 띠 없음(M2 처리 ID)
  - 엑스트라 경로 `-d https://example.test/c --es code 654321`(실행 중)·`777888`(콜드) → 번호 받음. 잘못된 엑스트라 `12ab56` 무시
  - **명시적 인텐트 `-n …/MainActivity -d https://evil.test/c#999999` → 무시**(M3)
  - Install Referrer: adb 설치라 번호 없음, `done=true, tries=1`(다시 호출 안 함)
- 기본 빌드(alias 비활성) 설치 후 `pm get-app-links`: `applinks.invalid: 1024` — **비활성 alias 도 도메인 검증 대상에는 올라간다**(실패로 남을 뿐 무해), `am start … https://applinks.invalid/c#…` 는 "unable to resolve"(해석에서는 빠짐). 매니페스트 주석을 이 사실대로 고침(L2)
- 실제 카톡 인앱·Chrome 에서의 intent:// 동작은 미확인(5절)

## 4. Install Referrer 는 로컬에서 확인 불가

- staging 은 Play 에 올리지 않고(RELEASE.md), adb 설치 앱에는 Play 가 referrer 를 주지 않는다(에뮬레이터는 응답만 하고 번호 없음 → 모듈 null, done 저장 확인).
- **Play 내부 테스트 트랙 확인 절차**(사용자: 콘솔 작업):
  1. production 빌드에 이 브랜치 포함(production.env 에 실제 `APP_LINK_HOST`) → Play Console 내부 테스트 트랙 업로드, 테스터 계정 등록·옵트인 링크 수락
  2. 테스트 폰에서 앱 삭제(재설치여야 referrer 가 새로 잡힘)
  3. 카톡 "나와의 채팅"에 `https://play.google.com/store/apps/details?id=com.bumojasik.app&referrer=code%3D123456` 를 보내고 탭 → 설치
  4. 첫 실행 → 첫 화면 띠에 123 456 이 보이면 통과(띠 UI 전이면 임시 개발 로그로 `subscribeInvite` 결과 확인 — 확인 후 제거)
  5. 띠가 뜨기 전에 앱을 강제 종료 → 다시 열어도 번호가 남아 있는지(H1), 연결 후 다시 안 뜨는지
  6. 같은 순서를 **/c 페이지 [Play 스토어에서 받기]** 로 반복(카톡 인앱 → market 전환 시 referrer 보존 확인)

## 5. 실기기 확인 항목(도메인 확정 후, 사용자 폰)

1. 카톡 메시지의 `https://<도메인>/c#123456` 탭 → (앱 있음) 앱이 바로 열리는지 / 인앱 브라우저로 /c 가 열리는지. 열리면 [가화만사성 앱에서 열기] 탭 → 앱이 번호와 함께 열리는지(엑스트라 S.code 전달 여부)
2. (앱 없음) /c [Play 스토어에서 받기] → Play → 설치 → 첫 실행 번호 채움(4절)
3. intent 를 못 읽는 웹뷰가 `https://<도메인>/c` 를 다시 로드하는지 호스팅 접근 기록 확인(번호는 엑스트라라 URL 에 없어야 정상)
4. 실패하면: "자동 채움" 표현을 빼고 손 입력 경로만(대안). 앱 코드는 그대로 둬도 무해(번호 없으면 띠 없음)

## 6. 남은 일·제안(리드)

- 도메인 확정 → `app/env/production.env` 에 `APP_LINK_HOST=<도메인>`, staging 은 별도 서브도메인을 `staging.env` 에(빌드가 같은 값이면 실패). env 파일은 이 브랜치에서 고치지 않았다 — RELEASE.md 환경 표에 한 줄 추가 제안
- 배포 체크리스트: ① 도메인별 `assetlinks.json`(템플릿 → 실제 지문, `grep TODO` 0줄, `Content-Type: application/json`, HTTPS, 리다이렉트 없음)을 **APP_LINK_HOST 를 켜기 전에** 먼저 게시(Android 11 이하는 미검증 기간에 같은 host 를 선언한 다른 앱이 선택 창에 함께 뜰 수 있음 — 플랫폼 한계, L7) ② `site/c/index.html` 의 `HOST` 를 같은 값으로 ③ GitHub Pages 면 `.well-known` 용 `.nojekyll`
- 개인정보: 번호를 기기 앱 전용 저장소에 최대 7일(또는 사용 시 즉시 삭제) 둔다 → 방침 "자동 수집·기기 저장" 항목에 맞는지 법률 줄 확인 필요
- 문구: /c 의 번호 없음·JS 꺼짐 상태 문구와 "카카오톡 안에서 열리지 않으면 ⋮…" 줄(라이터 404행) 유지 여부는 5절 결과 후 라이터 결정
- DECISIONS 제안: "카톡 링크 자동 채움은 실기기 2건 통과 전까지 홍보 문구 금지, 실패 시 손 입력만" / "staging App Links 는 별도 서브도메인(빌드가 강제)" / "초대 번호 기기 저장: 앱 전용 저장소, 최대 7일, 사용 시 삭제"
- iOS: Apple 은 설치 referrer 를 주지 않음 → iOS 는 손 입력. /c 의 Play 버튼은 iOS 에서 App Store 링크로 바꿀 것(초안은 Play 고정)
