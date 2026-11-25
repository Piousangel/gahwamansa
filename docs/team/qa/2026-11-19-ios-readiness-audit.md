# iOS 준비도 감사 (2026-11-19, 읽기 전용)

- 범위: 빌드 1(Android 우선)에 넣는 코드·결정 중 빌드 2(iOS) 출시를 막거나 재작업을 부르는 곳.
- 방법: 저장소 파일 읽기와 grep만 했다. `pod install`·xcodebuild·시뮬레이터는 돌리지 않았다. 그래서 Pods 안 Privacy Manifest, 라이브러리 iOS 동작, 빌드 성공 여부는 모두 **미확인**이다.
- 근거 표기: `파일:줄`은 저장소 기준(app/ 아래는 `app/` 생략 안 함). 공식 문서 URL은 기억에 기대 적었고 이번 세션에서 다시 열어 보지 않았다. 그래서 [문서·재확인 필요]로 표시했다.
- 구분: **지금** = 빌드 1 안에 하면 재작업이 없거나 빌드 1 사용자에게도 영향이 있음 / **B2** = 빌드 2로 미뤄도 비용이 늘지 않음.

---

## 0. 지금 꼭 해야 할 것 (상위 8개)

| # | 할 일 | 왜 지금 | 레인 | 추정 |
|---|---|---|---|---|
| N1 | **초대 페이지 `site/c/index.html`의 iPhone 분기**: Android가 아니면 지금은 Play 설치 버튼을 보여 준다(`site/c/index.html:94,127-129`). iPhone 부모님은 막다른 길에 선다. "아이폰용은 준비 중이에요"와 번호 크게 보이기(나중에 직접 입력)로 바꾼다 | **빌드 1 사용자에게 바로 영향**. 자녀가 보낸 링크를 아이폰 부모님이 열 수 있다 | 앱(웹)·문구·디자인 | 2h |
| N2 | **env 생성기를 Gradle 밖으로 빼기**: `env.generated.ts`는 Android Gradle만 만든다(`app/src/lib/env.ts:5`, `app/android/app/build.gradle:117-155`). iOS 빌드는 이 파일을 만들지 않아서 **마지막 Android 빌드가 남긴 파일(staging일 수 있음)이 그대로 iOS 번들에 들어간다**. production API_MODE·앱 정보 빈 값 실패·카카오 키 중복 경고 같은 검증(`build.gradle:138-141,185,205-207`)과 release 번들 검사(`build.gradle:244-260`)도 Gradle에만 있다. `scripts/gen-env.js` 하나로 옮기고 Gradle은 그것을 부르게 하면 iOS Build Phase도 같은 스크립트를 쓴다 | Gradle 쪽 검증이 계속 늘고 있다. 늦을수록 두 벌로 옮길 것이 많아진다 | 앱(빌드) | 3~4h |
| N3 | **푸시 토큰 등록의 플랫폼 하드코딩**: `register_push_token(p_platform: 'android')` 고정(`app/src/features/realApi.ts:435`). 서버는 이미 'ios'를 받는다(`supabase/migrations/20261116000032_push_tokens.sql:11,28`). `Platform.OS`로 바꾼다 | 한 줄. iOS 토큰이 'android'로 쌓이면 나중에 발송 분기·지표가 틀린다 | 앱 | 0.5h |
| N4 | **개인정보 처리방침·변호사 문의 묶음에 Apple 항목을 미리 넣기**: Sign in with Apple(이름·이메일·릴레이 이메일), APNs(기기 토큰, Apple 국외 이전). 지금 방침 v2는 Firebase·Supabase만 다룬다(`DECISIONS.md:287`) | 변호사 검토가 진행 중이다. 빌드 2에 다시 맡기면 비용·기간이 두 번 든다 | 법무(policy) | 1h |
| N5 | **자녀 로그인 화면에 세 번째 버튼(Apple) 자리를 디자인에 확정**: 4.8 때문에 카카오·구글을 주면 Apple 로그인(또는 같은 조건의 로그인)이 필요하다. Apple 버튼은 HIG상 다른 버튼과 같은 크기·위치급이어야 한다. 지금 SocialButton은 kakao/google 두 종만 안다(`app/src/features/child/SocialButton.tsx:30`) | 시안 동결 전에 넣으면 디자인 QA 재승인이 없다 | 디자인 | 1h |
| N6 | **Firebase 콘솔에 iOS 앱 2개 등록**(com.bumojasik.app, com.bumojasik.app.staging) → GoogleService-Info.plist 2개를 받아 gitignore 위치에 보관 | 지금 콘솔 작업 중이다(`DECISIONS.md:407`). 등록 자체는 무료이고 Apple 계정이 없어도 된다(APNs 키 업로드만 계정 필요) | 사용자 | 10분 |
| N7 | **번들 ID·앱 이름 고정 원칙 기록**: iOS 번들 ID가 이미 `com.bumojasik.app`(`app/ios/BumoJasik.xcodeproj/project.pbxproj:278,307`)로 Android와 같다. App Store Connect에 앱을 만들면 번들 ID는 바꿀 수 없다. staging은 `.staging`으로 Android와 맞춘다고 DECISIONS에 한 줄 남긴다 | 지금 정하지 않으면 Firebase·카카오·구글 콘솔에 iOS ID를 제각각 등록할 수 있다 | PM | 0.2h |
| N8 | **카카오·구글 콘솔 iOS 플랫폼 등록 계획을 RELEASE.md '외부 콘솔 등록'에 추가**: 카카오 iOS 번들 ID 등록, 구글 iOS OAuth 클라이언트 2개(환경별), Supabase Google provider "Authorized Client IDs"에 iOS 클라이언트 추가 | Android 콘솔 작업을 하는 김에 같은 절차로 적어 두면 빌드 2 때 빠뜨리지 않는다. 실제 등록은 B2도 된다 | 앱·사용자 | 0.5h |

> 위 8개 말고는 대부분 **B2로 미뤄도 재작업이 늘지 않는다**. 이유는 코드가 이미 플랫폼 분기 함수(notifyNative·linkSources·haptic·engines·koreanText)에 모여 있어서 iOS 구현을 그 파일 안에만 넣으면 되기 때문이다.

---

## 1. 사용자 결정·비용 항목 (팀이 대신할 수 없음)

| # | 결정·비용 | 내용 | 언제까지 |
|---|---|---|---|
| U1 | **Apple Developer Program 가입** | 연 99달러(한국 약 12~13만 원, 미확인 환율). 개인으로 가입하면 App Store 판매자명이 **본인 실명**으로 보인다. 사업자(법인)로 가입하면 D-U-N-S 번호가 필요하다(발급 수일~수주). 개인사업자는 Apple 기준 '개인'으로 분류되는지 **미확인** | 빌드 2 시작 2~3주 전(D-U-N-S면 더 일찍) |
| U2 | **앱 이름 '가화만사성' 선점 여부** | App Store는 앱 이름이 겹치면 못 쓴다. 계정을 일찍 만들고 App Store Connect에 앱 레코드만 만들어 두면 이름을 잡아 둘 수 있다(미사용 레코드가 오래가면 회수될 수 있음, 기간 미확인) | 결정만 지금, 비용은 U1과 같음 |
| U3 | **Sign in with Apple 제공 확정** | 4.8: 카카오·구글 같은 제3자 로그인을 주면, 이름·이메일만 받고 이메일 숨기기를 허용하고 광고 추적을 하지 않는 로그인 하나를 같이 줘야 한다. 이메일 인증번호 로그인은 '이메일 숨기기'가 없어서 대체가 되기 어렵다(추정). DECISIONS에는 "애플은 iOS 출시 때"로만 적혀 있다(`DECISIONS.md:197`) — 확정 기록 필요 | 지금(디자인 N5와 같이) |
| U4 | **iPad 지원 여부** | 지금 프로젝트가 iPhone+iPad(`TARGETED_DEVICE_FAMILY = "1,2"`, `project.pbxproj:283,311`)이고 iPad 가로 회전도 켜져 있다(`app/ios/BumoJasik/Info.plist`의 `UISupportedInterfaceOrientations~ipad`). iPad를 넣으면 iPad 스크린샷·iPad 화면 심사가 따로 붙는다. **iPhone 전용(1) 권장** | B2 시작 때 |
| U5 | **iOS 초대 경로(설치 전 번호 전달)** | iOS에는 Install Referrer가 없다(`app/src/lib/linkSources/native.ts:32`가 Android만 InviteModule을 쓴다). 앱이 없으면 Universal Link도 App Store로만 간다. 선택지: (a) 페이지에 번호를 크게 보이고 앱에서 직접 입력 (b) 앱 첫 실행 때 클립보드 붙여넣기(iOS 16+는 '붙여넣기 허용' 창이 뜬다, 어르신에게 낯섦) (c) 유료 딥링크 서비스. **(a) 권장, 비용 0** | B2 기획 때 |
| U6 | **APNs 인증 키(.p8)** | Apple 계정에서 발급해 Firebase에 올린다. 키는 사용자만 보관(비밀) | B2 |
| U7 | **맥·실기기** | iOS 빌드·서명은 맥과 Xcode가 필요하다(지금 작업 맥 사용 가능, 확인). 실기기 TestFlight 검증용 iPhone 1대 이상(어르신용 큰 글자 확인 포함). 빌려 쓸지 결정 | B2 |
| U8 | **나이 등급 설문** | App Store Connect 새 나이 등급(4+/9+/13+/16+/18+) 설문을 사용자가 입력. Play는 "만 18세 이상 대상"으로 정했다(`docs/team/store/play-console-draft.md:157-159`). Apple 등급은 '대상 연령'이 아니라 '콘텐츠 수위'라 4+가 나올 가능성이 높다(추정). 어린이 카테고리는 선택하지 않는다 | B2 제출 때 |

---

## 2. 점검표

열: 항목 · 현재 상태(근거) · iOS 영향 · 시기(지금/B2) · 레인 · 추정

### 2.1 App Store 심사 차단 요소

| 항목 | 현재 상태 | iOS 영향 | 시기 | 레인 | 추정 |
|---|---|---|---|---|---|
| 4.8 로그인 | 자녀 로그인 = 카카오·구글 + 이메일 인증번호 보조(`DECISIONS.md:197`, `app/src/features/socialAuth.ts:36-80`). 어르신은 로그인 없음 | Apple 로그인 없으면 **반려 가능성 높음**. 어르신 흐름은 해당 없음 | 결정·디자인 지금(U3·N5), 구현 B2 | 디자인·앱·서버 | 구현 1~1.5일 |
| Apple 로그인 구현 | 없음. Supabase `signInWithIdToken({provider:'apple'})`은 카카오와 같은 nonce 흐름(`app/src/features/realApi.ts:159`)을 재사용할 수 있다. 라이브러리 후보 `@invertase/react-native-apple-authentication`(버전·New Arch 지원 **미확인**) | Supabase Apple provider 설정(Services ID·키), Xcode capability 'Sign in with Apple' | B2 | 앱·서버 | 0.5일 |
| 5.1.1(v) 앱 안 계정 삭제 | 있음: `app/src/features/account/DeleteAccountScreen.tsx`, E2E `app/e2e/flows/f9-parent-delete.yaml`, 웹 `site/delete-account.html`. 카카오 연결 끊기 큐(`supabase/migrations/20261116000042_kakao_unlink.sql:3,141`, `supabase/functions/kakao-unlink`) | 충족(추정). 단 **Apple 로그인 사용자는 삭제 때 Apple 토큰 철회(revoke) 필요** [https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens, 문서·재확인 필요]. 로그인할 때 authorization code로 refresh token을 받아 서버에 보관해야 철회할 수 있다 | B2. 선택: 지금 kakao_unlink_queue를 provider 열이 있는 일반 큐로 바꾸면 B2에 테이블을 새로 만들지 않아도 된다(아직 production 데이터가 없으면 쌈) | 서버 | 지금 선택 2h / B2 0.5일 |
| Privacy Manifest(앱) | 있음: `app/ios/BumoJasik/PrivacyInfo.xcprivacy` — RN 템플릿 기본 3개(FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime 35F9.1). `NSPrivacyCollectedDataTypes` 비어 있음, Tracking false | Required reason API 누락은 업로드 때 ITMS-91053 경고/거절 [https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api, 재확인 필요]. 앱 코드는 네이티브 iOS 코드를 따로 쓰지 않아 추가 사유는 없을 것(추정). 수집 데이터(이메일·사용자 ID·기기 토큰)는 manifest에 적는 것을 권장 | B2 | 앱·법무 | 1h |
| Privacy Manifest(라이브러리) | **미확인**(Pods 없음). 확인할 것: AsyncStorage 3.x, react-native-sound 0.13.0(유지보수 오래됨 → 매니페스트 없을 가능성), volume-manager 2.2.0, @mhpdev/react-native-speech 1.4.4, webview 17.1.0, Kakao iOS SDK, GoogleSignIn iOS, Firebase iOS. 목록상 Apple이 지정한 '흔한 SDK'(Firebase·GoogleSignIn 등)는 매니페스트+서명이 필수 | 없는 라이브러리는 앱 매니페스트에 사유를 대신 적거나 패치 | B2 (`pod install` 뒤 `find Pods -name PrivacyInfo.xcprivacy`, Xcode Archive → Generate Privacy Report) | 앱 | 2h |
| App Privacy 라벨(App Store Connect) | Play 데이터 보안 대조표가 있다(`docs/team/legal/data-safety-form.md:9-55`) | 같은 표를 Apple 분류(연락처 정보·식별자·사용 데이터·진단)로 옮기면 된다. 카카오·구글·Firebase SDK 수집분 포함 | B2(표 원본은 지금 것 재사용) | 법무 | 2h |
| 나이 등급 | Play: 18세 이상 대상(`play-console-draft.md:157-159`) | 설문 입력(U8). 사용자 간 자유 글이 없으면(응원은 정해진 항목으로 보임 — `app/src/api/contract/cheers.ts`, 자유 입력 TextInput은 로그인·삭제·키보드 단계뿐) UGC 신고·차단 기능(1.2) 요구는 해당 없음(추정) | B2 | 사용자·PM | 0.5h |
| AI 생성 콘텐츠 표기 | Play 등록정보·스크린샷에 "AI가 만든 그림" 고지(`play-console-draft.md:63-64,72,87`) | Apple은 별도 AI 라벨 의무 없음(미확인). 같은 문구를 설명·스크린샷에 쓰면 2.3 메타데이터 정확성에 안전. 앱이 개인 정보를 외부 AI로 보내지 않으므로 5.1.2(i)의 제3자 AI 공유 고지는 해당 없음(추정 — 앱 코드에서 AI API 호출 0건, 콘텐츠는 미리 만든 것) | B2(문구 재사용) | 마케팅 | 0.5h |
| 어린이·가족 카테고리 | Play에서 어린이 대상 아님으로 결정 | Kids Category 선택하지 않음. 해님 도장 그림 때문에 심사자가 어린이 앱으로 볼 여지 → 설명에 어르신·가족 맥락 | B2 | 마케팅 | 0 |
| Info.plist 템플릿 잔재 | `NSLocationWhenInUseUsageDescription`이 **빈 문자열**, `CFBundleDisplayName = BumoJasik`, `CFBundleDevelopmentRegion = en`(`app/ios/BumoJasik/Info.plist`). LaunchScreen에 "BumoJasik"·"Powered by React Native" 글자(`LaunchScreen.storyboard`). AppIcon 세트 비어 있음(`Images.xcassets/AppIcon.appiconset`에 Contents.json만) | 위치 미사용인데 키가 있으면 심사 질문·반려 사유가 될 수 있음 → 삭제. 표시 이름 '가화만사성', 지역 ko, 아이콘·런치 화면은 Android 스플래시와 같게 | B2 | 앱·디자인 | 2h |

### 2.2 네이티브 의존성의 iOS 상태 (`app/package.json` dependencies)

| 패키지 | 쓰는 곳 | iOS 지원 | iOS 필요 작업 | 시기 | 추정 |
|---|---|---|---|---|---|
| @mhpdev/react-native-speech 1.4.4 | TTS(`app/src/audio/engines.ts:2,16`) | 지원(AVSpeechSynthesizer, 라이브러리 설명 기준, 미확인) | 권한 없음. `ducking: true`가 iOS AVAudioSession 카테고리를 바꾸면 react-native-sound의 `Ambient`(`engines.ts:99`)를 덮어 **무음 스위치 동작이 바뀔 수 있음**(미확인). ko-KR 음성(Yuna) 기본 설치 여부 실기기 확인. 속도 0.45는 가정값(`engines.ts:15`, `DECISIONS.md:367`) | B2 QA | 0.5일 QA |
| react-native-sound 0.13.0 | 효과음·BGM(`engines.ts:90-117`) | 지원(오래된 라이브러리, New Arch 호환 **미확인**) | `loadSound`가 Android res/raw 이름 규칙을 전제로 주석·로직이 짜여 있다(`engines.ts:86-88`). iOS release에서 `resolveAssetSource(...).uri`가 `file://…/assets/src/...` 경로가 되는데 0.13.0 iOS가 이를 받는지 **미확인** → 도장·BGM 무음 위험 | B2(첫 iOS 빌드 직후 확인) | 2h |
| react-native-volume-manager 2.2.0 | 벨소리 모드·볼륨(`engines.ts:18-80`) | 볼륨 읽기 지원. 벨소리 모드는 Android 전용 → iOS는 `normal` 반환으로 이미 분기(`engines.ts:19-21`) | 없음. 단 iOS '소리 0' 안내(getVolume) 실기기 확인 | B2 | 0.5h |
| react-native-webview 17.1.0 | 약관·방침(`app/src/ui/WebPage.tsx:3,98`) | 지원 | 없음 | — | 0 |
| react-native-url-polyfill, get-random-values | JS·소형 네이티브 | 지원 | 없음 | — | 0 |
| @react-native-kakao/core·user 3.2.0 | 카카오 로그인(`socialAuth.ts:2-3`) | 지원(라이브러리 문서 기준, 미확인) | Info.plist: URL scheme `kakao{네이티브키}`, `LSApplicationQueriesSchemes`(kakaokompassauth, kakaolink 등). **이 프로젝트는 SceneDelegate 구조**(`app/ios/BumoJasik/SceneDelegate.swift:41-47`)라 카카오 복귀 URL 처리를 AppDelegate가 아니라 `scene(_:openURLContexts:)`에 넣어야 한다(라이브러리 문서가 AppDelegate 기준이면 그대로 따라 하면 복귀 실패). 키는 env별(N2 생성기에서 xcconfig로) | B2 | 3h |
| @react-native-google-signin/google-signin 17.0.0 | 구글 로그인(`socialAuth.ts:4,37,61-62`) | 지원 | iOS OAuth 클라이언트(환경별 2개) + `iosClientId` 설정(지금 `configure({webClientId})`만, `socialAuth.ts:37`) + reversed client ID URL scheme. `hasPlayServices`(`socialAuth.ts:61`)는 iOS에서 바로 true라 무해(문서 기준). **Supabase는 iOS 구글 ID 토큰의 nonce 때문에 Google provider에서 'Skip nonce check'를 켜야 할 수 있음** [https://supabase.com/docs/guides/auth/social-login/auth-google, 재확인 필요] | B2 | 3h |
| react-native-screens·safe-area-context·svg·navigation | UI | 지원 | 없음 | — | 0 |
| react-native-reanimated 4.8.0 · react-native-worklets 0.14.0 · react-native-gesture-handler 3.5.0(+ @gorhom/bottom-sheet 5.2.14, JS 전용) — 11-25 #255 추가 | ds Sheet(`app/src/ui/ds/Sheet.tsx`) | 지원(새 아키텍처 전용, 미확인) | 새 Pod 3개(RNReanimated·RNWorklets·RNGestureHandler) → **`pod install` 필요**(아직 안 돌림). 설치본 기준 `PrivacyInfo.xcprivacy` 는 worklets(`apple/PrivacyInfo.xcprivacy`)에만 있음 → 나머지 둘은 앱 매니페스트로 대신하는지 Privacy Report 로 확인(위 2.2.1 행) | B2 첫날 | 0.5h |
| @react-native-async-storage 3.x | kvStore(`app/src/lib/kvStore.ts:2`) | 지원 | Privacy Manifest 포함 여부 미확인(2.2.1 행) | B2 | 포함 |
| @react-native-firebase/app·messaging 27.1.0(계획) | FCM(`app/src/push/fcmTokenSource.ts`) | 지원 | Podfile에 `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true`(rnfirebase iOS 안내, 재확인 필요). 지금 Podfile은 환경변수로만 frameworks를 켠다(`app/ios/Podfile:10-14`) → static frameworks가 다른 Pod(New Arch·kakao·sound)와 충돌하는지 **미확인**. Firebase iOS SDK 최소 iOS 버전 vs 프로젝트 15.1(`project.pbxproj:267`) 확인. `AppDelegate.swift`에 `FirebaseApp.configure()`, 환경별 GoogleService-Info.plist를 configuration별로 복사하는 Build Phase | 설치는 지금 Android로 하되 **버전 고정 시 iOS 빌드 가능 여부를 B2 첫날 확인** | 1일 |
| 앱 자체 Android 네이티브 모듈 5개 | `app/android/app/src/main/java/com/bumojasik/app/`: PushModule·InviteModule·HapticModule·SplashModule(+MainActivity) | iOS 대응 없음. JS는 모두 "모듈 없으면 무시"로 짜여 있어 **iOS에서 죽지는 않음**(`app/src/ui/haptic.ts:7`, `app/src/push/notifyNative.ts:23`, `linkSources/native.ts:32`, `app/src/app/splash.ts:27`) | iOS 필요한 것: 알림 권한·설정 열기(아래 2.3), 스플래시 숨김(LaunchScreen만으로 충분한지 디자인 결정), 촉각(UIImpactFeedbackGenerator, 보류 결정 `DECISIONS.md:341`), Invite는 Universal Link로 대체(Referrer 없음) | B2 | 1~1.5일 |

### 2.3 푸시

| 항목 | 현재 상태 | iOS 영향 | 시기 | 레인 | 추정 |
|---|---|---|---|---|---|
| APNs 키·Firebase iOS 앱 | 없음. Firebase 프로젝트 gahwa-mansaseong에 Android 앱 2개만(`DECISIONS.md:407`) | iOS 앱 등록(N6)·.p8 업로드(U6) | 등록 지금, 키 B2 | 사용자 | 10분+10분 |
| Capability | entitlements 파일 없음(`app/ios/BumoJasik/*.entitlements` 0건) | Push Notifications(aps-environment), 필요하면 Background Modes > Remote notifications, Associated Domains, Sign in with Apple | B2 | 앱 | 1h |
| 권한 상태 모델 | `NotifyPermission = granted/denied/blocked/unknown`(`notifyNative.ts:6`). iOS면 `readNotifyPermission`이 항상 `unknown`(`notifyNative.ts:38-40`), `useNotifyPermission`도 iOS면 `unknown`(`app/src/features/child/useNotifyPermission.ts:16`) | **타입은 iOS에 맞다**: iOS notDetermined → `denied`(시스템 창 가능), denied → `blocked`(설정만). 문제는 동작: iOS의 `open()`이 시스템 창을 띄우지 않고 바로 설정을 연다(`useNotifyPermission.ts:57-58`). **iOS는 앱이 한 번이라도 권한을 요청해야 설정 앱에 '알림' 항목이 생긴다** → 이대로면 iPhone에서 알림을 켤 길이 없다. RN 코어에는 iOS 알림 권한 API가 없으므로 `@react-native-firebase/messaging`의 `requestPermission`/`hasPermission`(AuthorizationStatus)로 구현. provisional(임시 허용)은 쓰지 않는 쪽 권장(어르신에게 조용히 오면 알림 의미 없음) | B2(분기 지점이 두 파일로 모여 있어 재작업 작음) | 앱 | 0.5일 |
| 채널 | Android 채널 daily·cheer·family(`app/src/push/channels.ts`, 서버 `supabase/functions/_shared/push.mts:14,25`) | iOS에 채널 없음. 끄기는 앱 안 토글(P13·C7 → set_push_enabled, `DECISIONS.md:382`)로 이미 서버 쪽이라 iOS에도 그대로 통한다. P13 '그 채널만 꺼짐' 안내(`notifyNative.ts:73-83`의 채널 설정 열기)는 iOS에서 숨겨야 함. 계약 타입 이름 `AndroidPushChannel`은 그대로 둬도 됨 | B2 | 앱 | 2h |
| 발송 페이로드 | `notification{title,body}` + `android{priority, channel_id}`(`push.mts:24-25`) | FCM이 notification 블록을 APNs 알림으로 바꿔 보내므로 기본 동작은 됨(추정). 소리·배지·잠금화면 공개 수준이 필요하면 `apns` 블록 추가. platform 열이 정확해야 분기 가능 → N3 | B2(N3만 지금) | 서버 | 1h |
| firebase.json | `messaging_android_*`만, `messaging_auto_init_enabled false`(`app/firebase.json`) | iOS 자동 초기화도 같은 키로 꺼짐(추정). iOS에서 `getToken` 전에 `registerDeviceForRemoteMessages` 필요 여부 확인(자동 등록 끈 경우) | B2 | 앱 | 포함 |
| 백그라운드 시작·APNs 등록(#262 QA-1 L3, 11-25 추가) | Android는 `index.js`에서 빈 `setBackgroundMessageHandler` 등록(`fcmTokenSource.registerBackgroundHandler`). iOS 미설정 | iOS는 APNs 등록(`registerDeviceForRemoteMessages`·auto-register 확인)과 RNFB가 안내하는 `isHeadless` 시작 속성 처리(백그라운드로 깨어날 때 앱 화면을 그리지 않기, AppDelegate·루트 컴포넌트) 필요 | B2 | 앱 | 0.5일 |

### 2.4 Platform 분기·Android 전용 가정 (grep `Platform.OS`, BackHandler 등)

| 위치 | 현재 | iOS 영향 | 시기 | 추정 |
|---|---|---|---|---|
| `app/src/app/BackBar.tsx:8-21` `useBackAction` | 화면이 정한 뒤로 동작을 하드웨어 back에만 건다 | iOS에는 하드웨어 back이 없고 **스와이프 뒤로(native-stack 기본 켜짐)가 onBack을 우회**해 그냥 이전 화면으로 간다(예: 코스 단계 → '오늘 코스'로 가야 하는데 직전 단계로). `gestureEnabled:false` 또는 `usePreventRemove`를 이 훅 하나에 넣으면 끝. VoiceOver 두 손가락 Z(accessibilityEscape)도 같은 곳에 | B2 (한 파일) | 2h |
| `app/src/lib/linkSources/native.ts:32,64-113` | InviteModule(Android)·Install Referrer·App Links. `Linking` 리스너는 공용 | Universal Links는 같은 `Linking` 경로로 들어오므로 JS는 재사용. SceneDelegate가 `continue userActivity`를 RCTLinkingManager로 넘기고 있음(`SceneDelegate.swift:45-47`) — 좋음. 앱 꺼진 상태에서 열 때 `getInitialURL`이 Scene 구조에서 값을 받는지 확인(`connectionOptions` 전달 `SceneDelegate.swift:32-36`) | B2 | 1h QA |
| AASA | `site/.well-known/`에 assetlinks 템플릿 2개뿐 | `apple-app-site-association`(확장자 없음, JSON, 리다이렉트 없이 https) 필요. appID = `<TeamID>.com.bumojasik.app`, staging 서브도메인은 `.staging`. 경로 `/c`, 번호는 URL 조각(#)이라 경로 매칭에 영향 없음(추정). GitHub Pages 등 정적 호스팅이 확장자 없는 파일을 어떤 Content-Type으로 주는지 **미확인** [https://developer.apple.com/documentation/xcode/supporting-associated-domains]. 템플릿만 지금 만들어 두면 배포 절차(`docs/team/store/2026-11-19-domain-hosting-smtp.md:177`)에 한 줄로 끼울 수 있음 | 템플릿 지금(선택), 실제 B2(Team ID 필요) | 0.5h |
| `site/c/index.html:94,127-129` | Android가 아니면 Play 설치 버튼 | → **N1** | 지금 | 2h |
| 백업 | Android `allowBackup="false"`(`AndroidManifest.xml:12`), data-safety 표 19행이 이것을 근거로 함 | iOS는 AsyncStorage 파일이 iCloud 백업에 들어간다(기본). 초대 번호·로그인 세션이 다른 기기로 복원될 수 있음 → 저장 위치 백업 제외(NSURLIsExcludedFromBackupKey) 또는 Keychain(이것도 복원 규칙 있음). 방침 문구가 "기기 밖으로 안 나감"이면 iOS에서는 거짓이 될 수 있음 | B2(방침 문구는 N4 때 "Android 기준"으로 한정해 적기) | 3h |
| flavor | Android staging/production + `.staging` suffix(`build.gradle:321-327`) | iOS는 configuration 3개(Debug, Release-Staging, Release-Production 등)·scheme 2개·xcconfig(env에서 생성)·bundle id `.staging`·GoogleService-Info.plist·카카오 scheme 환경별. 지금 iOS는 Debug/Release와 scheme 1개(`xcshareddata/xcschemes/BumoJasik.xcscheme`)뿐 | B2(N2가 선행) | 1일 |
| 버전 | Android versionCode = git 커밋 수(`app/src/lib/appVersion.ts:5`) | iOS CFBundleVersion도 같은 규칙으로 Build Phase에서 주입(`project.pbxproj:264`의 1 고정). N2 생성기에 함께 | B2 | 1h |
| `app/src/features/course/ReadAloud.tsx:145-152` | TTS 설정: Android intent, iOS 앱 설정 | iOS에는 TTS 설정 직행 URL이 없다(공식). 앱 설정을 여는 건 안내 문구와 어긋남 → iOS 문구 분기 필요 | B2 | 1h(문구) |
| `app/src/features/child/OtpField.tsx:15` | `one-time-code` | iOS 메일 인증번호 자동 채움 지원 | — | 0 |
| `app/src/ui/clipboard.ts:20` | 13+ 복사 알림 분기 | iOS는 앱 토스트로(이미 false 쪽) | — | 0 |
| 폐기 예정 Clipboard deep import(`clipboard.ts:9`) | RN 코어 내부 경로 | iOS도 같은 위험(RN 업그레이드 때) | — | — |

### 2.5 UI

| 항목 | 현재 | iOS 영향 | 시기 | 추정 |
|---|---|---|---|---|
| SafeArea | safe-area 사용 23곳(grep) | 노치·Dynamic Island·홈 인디케이터는 같은 inset으로 처리됨(추정). iPhone SE(작은 화면) 확인 | B2 QA | 2h |
| 글자 크기 | 상한 본문 2.0·큰 제목 1.5(`app/src/ui/tokens.ts:65-66`, `Text20.tsx:26`) | iOS Dynamic Type 접근성 크기(최대 약 310%)는 200%에서 잘림 — 정책과 일치. QA 관문의 '150/200%'(`docs/plans/13-road-to-launch.md` 접근성 행)를 iOS '더 큰 텍스트' 단계로 대응표 필요 | B2 | 1h |
| VoiceOver | Text20이 Android에서만 원문 라벨을 줌(`Text20.tsx:19-20`, U+2060 때문). `importantForAccessibility`(Android 전용)와 `accessibilityElementsHidden`(iOS)를 함께 쓰는 곳이 대부분(`BottomSheet.tsx:70,108`, `Banner.tsx:80` 등) | 좋음. 단 `BottomSheet.tsx:65`의 스크림은 `importantForAccessibility="no"`만 있고 iOS용 `accessibilityElementsHidden` 없음(Pressable이라 `accessible={false}`로 충분할 수 있음, 미확인). `accessibilityActions` 사용 0건 | B2 QA | VoiceOver 순회 0.5일 |
| 한국어 줄바꿈 | iOS `lineBreakStrategyIOS="hangul-word"`(`app/src/ui/koreanText.ts:41`), Android만 U+2060 | iOS는 이미 준비됨. 실기기 확인만 | B2 QA | 포함 |
| 키보드 회피 | `KeyboardAvoidingView behavior="padding"`(`app/src/ui/Screen.tsx:121`) | iOS에서 padding은 정석. 상단 inset(`topPad`)과 겹쳐 `keyboardVerticalOffset`이 필요한지 KeyboardStep·로그인·삭제 화면에서 확인 | B2 QA | 1h |
| 촉각 | Android HapticModule만, iOS 보류(`app/src/ui/haptic.ts:3-7`, `DECISIONS.md:341`) | iOS 구현 시 UIImpactFeedbackGenerator(light)·UISelectionFeedbackGenerator로 0.4초 진동 규칙 위반 없음. JS 인터페이스 그대로 | B2 | 2h |
| 다크 모드 | 라이트 고정(관문) | iOS Info.plist `UIUserInterfaceStyle = Light` 필요(지금 없음) | B2 | 0.2h |
| 글꼴 | 시스템 글꼴(`app/src/ui/tokens.ts:3`) | iOS는 Apple SD Gothic Neo로 바뀜 → 줄 높이표(`Text20.tsx:14`)로 잘림 확인 | B2 QA | 포함 |

### 2.6 인증

| 항목 | 현재 | iOS 영향 | 시기 | 추정 |
|---|---|---|---|---|
| 카카오 | 네이티브 키 env 공유, Android scheme은 Gradle 리소스(`AndroidManifest.xml` AuthCodeHandlerActivity) | 2.2 카카오 행. 카카오 개발자 콘솔 iOS 플랫폼에 번들 ID 2개 | B2(N8로 문서만 지금) | 3h |
| 구글 | webClientId만 | 2.2 구글 행. iOS 클라이언트 2개 + Supabase Authorized Client IDs + nonce | B2 | 3h |
| Supabase 딥링크 redirect | 소셜은 `signInWithIdToken`(`realApi.ts:159,169`), 이메일은 인증번호 | **딥링크 redirect를 쓰지 않음** → iOS용 redirect URL·URL scheme 등록 불필요. 좋은 결정 | — | 0 |
| Apple | 없음 | 2.1 참고 | 결정 지금 | — |

### 2.7 빌드·운영

| 항목 | 현재 | iOS 영향 | 시기 | 레인 | 추정 |
|---|---|---|---|---|---|
| Apple Developer 계정 | 없음 | U1 | 결정 지금 | 사용자 | — |
| 서명 | `CODE_SIGN_IDENTITY "iPhone Developer"` 템플릿값, DEVELOPMENT_TEAM 없음(`project.pbxproj:345,418`) | 자동 서명 + Team 설정. 인증서·프로비저닝은 사용자 계정 | B2 | 앱·사용자 | 1h |
| release 번들 검사 | Gradle `verifyReleaseBundle`(`build.gradle:244-260`)·`npm run check:dev-menu`(`app/scripts/check-dev-menu-bundle.sh`, ios 폴더 제외 후 번들) | iOS Archive에는 이 검사가 없다 → 개발자 메뉴·테스트 계정이 iOS 출시물에 섞일 위험. N2와 같이 플랫폼 공통 스크립트로 | N2와 함께 지금(설계), B2(연결) | 앱 | N2에 포함 |
| 메트로 release 설정 | `app/metro.release.config.js` | iOS `Bundle React Native code and images` 단계가 이 설정을 쓰게 해야 함(기본은 metro.config.js, 미확인) | B2 | 앱 | 1h |
| TestFlight | 없음 | 내부 테스트(계정 100명, 심사 없음)·외부 테스트(베타 심사 있음). Play 14일·12명 규칙 같은 것은 없음 | B2 | QA | — |
| 도메인 AASA | 2.4 AASA 행 | | B2 | 앱 | 0.5h |
| E2E Maestro | Android 전용: `app/e2e/run.sh:22,37-94`(adb·APK·font_scale), flow의 `appId: com.bumojasik.app.staging`(`app/e2e/common/child-linked-home.yaml:3`) | flow YAML은 대부분 재사용 가능(appId가 번들 ID와 같으면 iOS에도 맞음). run.sh는 iOS 시뮬레이터용(`xcrun simctl`, 글자 크기 `simctl ui ... content_size`) 별도 필요. `dismiss-system-dialogs.yaml`은 iOS 알림 권한 창 문구가 다름. 카카오·구글 로그인은 시뮬레이터에서 자동화 어려움 → 이메일 인증번호 경로로 | B2 | QA | 1일 |
| Crashlytics | 계획(관문 모니터링 행) | iOS dSYM 업로드 Build Phase | B2 | 앱 | 1h |

---

## 3. 빌드 2 iOS 작업 대략 합계 (추정)

| 묶음 | 추정 |
|---|---|
| 환경·빌드(configuration·scheme·xcconfig·버전·번들 검사 연결·서명) | 1.5일 |
| 로그인(카카오·구글 iOS + Apple 로그인 + 철회) | 2일 |
| 푸시(Firebase iOS·권한·채널 UI 분기·capability) | 1일 |
| 네이티브 대응(촉각·스플래시·백업 제외·뒤로 제스처) | 1일 |
| 심사 준비(Privacy Manifest 점검·라벨·Info.plist 정리·아이콘·스크린샷·등급) | 1.5일 |
| QA(VoiceOver·글자 크기·오디오 8항목 iOS판·E2E iOS 러너) | 2일 |
| **합계** | **약 9일 (1인, 막힘 없을 때)** — Apple 계정·D-U-N-S 대기 시간 별도 |

## 4. 확인 못 한 것 (미확인 목록)
- 모든 Pod의 Privacy Manifest 포함 여부, New Arch(0.88) 호환 여부 — `pod install` 금지라 확인 불가.
- react-native-sound 0.13.0 iOS의 `file://` 번들 경로 처리.
- speech 라이브러리 ducking이 AVAudioSession 카테고리를 바꾸는지(무음 스위치 동작).
- static frameworks(@react-native-firebase 요구)와 다른 Pod의 충돌.
- Supabase Google provider의 iOS nonce 처리 필요 여부(문서 재확인 필요).
- 카카오 RN 라이브러리 iOS 설정 세부(SceneDelegate 대응 포함).
- 정적 호스팅의 AASA Content-Type.
- Apple 개인 개발자 가입 시 한국 개인사업자 표시 방식, 앱 이름 선점 유지 기간.
- 위 공식 문서 URL 내용은 이번 세션에서 다시 열어 보지 않았다.
