# 08. 자녀 소셜 로그인(카카오·구글) 조사와 구현 계획

- 작성: 2026-11-17, 조사 담당(코드 수정 없음)
- 전제: DECISIONS.md 마지막 항목 "자녀 로그인: 카카오·구글 소셜 로그인 + 이메일 인증번호 보조"
- 앱 상태(직접 확인): RN 0.88.1, `newArchEnabled=true`(app/android/gradle.properties:35), `@supabase/supabase-js ^2.119.0`, minSdk 24, compileSdk 37, Kotlin 2.2.0, 패키지 `com.bumojasik.app`, 서명은 debug/release 모두 `debug.keystore`(app/android/app/build.gradle:88~103, 출시 키 아직 없음), Supabase 클라이언트 `detectSessionInUrl:false`(app/src/lib/supabase.ts), 이메일 OTP는 `signInWithOtp`/`verifyOtp`(app/src/features/realApi.ts:61,73), 로컬 `supabase/config.toml`에 `[auth.external.kakao]`·`[auth.external.google]` 블록 없음, `enable_manual_linking=false`, `enable_anonymous_sign_ins=true`

---

## 1. 권장 방식(1개)

**두 공급자 모두 "네이티브 SDK로 ID 토큰 받기 → `supabase.auth.signInWithIdToken` 교환".** 브라우저 리디렉트·딥링크 없음.

| | 카카오 | 구글 |
|---|---|---|
| RN 라이브러리 | **`@react-native-kakao/core` + `@react-native-kakao/user` 3.2.0** | **`@react-native-google-signin/google-signin` 17.0.0(공개 npm판)** |
| 받는 것 | `login({nonce})` → `idToken` (OIDC 켜야 발급) | `GoogleSignin.signIn()` → `data.idToken` |
| Supabase 호출 | `signInWithIdToken({provider:'kakao', token:idToken, nonce:rawNonce})` | `signInWithIdToken({provider:'google', token:idToken})` (nonce 없음) |
| nonce | 앱에서 raw 생성 → **SHA-256 hex**를 카카오에 전달, raw를 Supabase에 전달 | 공개판은 nonce 미지원 → 토큰·요청 둘 다 nonce 없음 = 검사 통과(Skip nonce check 불필요) |

### 근거
1. **Supabase가 `kakao` ID 토큰을 지원한다.** auth 서버 `token_oidc.go`의 `getProvider`에 `case p.Provider == KakaoProvider || p.Issuer == provider.IssuerKakao`가 있고 issuer는 `https://kauth.kakao.com`(provider/kakao.go). Supabase 카카오 문서도 `signInWithIdToken({provider:'kakao', token: id_token})` 예시와 "OpenID Connect Activation ON, scope에 `openid`"를 요구.
   - https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go
   - https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go
   - https://supabase.com/docs/guides/auth/social-login/auth-kakao
2. **nonce 규칙(서버 코드 기준)**: `tokenHasNonce != paramsHasNonce`면 거부, 둘 다 있으면 `sha256(params.nonce)` hex와 토큰의 nonce 비교. 즉 nonce는 선택이지만 한쪽만 있으면 실패. (token_oidc.go) 카카오는 ID 토큰 `nonce`에 "인가 코드 요청 시 전달한 nonce 값과 동일한 값"을 그대로 넣는다(https://developers.kakao.com/docs/ko/kakaologin/rest-api) → 카카오에는 해시값을, Supabase에는 원문을 넘기면 맞는다(구글 문서가 설명하는 것과 같은 패턴: https://supabase.com/docs/guides/auth/social-login/auth-google).
3. **`@react-native-kakao/*` 선택 이유**: 3.2.0(2026-11-04 배포), `codegenConfig`(RNCKakaoUserSpec) 있는 TurboModule, peer `react-native >=0.76`, 문서 호환표 "v3는 React Native 0.76 이상과 새 아키텍처 필요", 안드로이드 최소 API 24(우리 minSdk 24와 일치), Kakao Android SDK 2.25.1. `login()`에 `nonce` 인자가 있고 안드로이드 구현이 카카오톡·카카오계정 로그인 양쪽에 `nonce`를 넘긴다(패키지 소스 `RNCKakaoUserModule.kt`). Expo는 optional peer라 RN CLI에서도 설치 가능.
   - https://github.com/mym0404/react-native-kakao , https://rnkakao.mjstudio.net/docs/intro , https://www.npmjs.com/package/@react-native-kakao/user
4. **구글 공개판 선택 이유**: Supabase RN 가이드의 공식 예시 라이브러리이고, "old·new architecture 모두 지원, 최신판은 RN 0.81+". Firebase·google-services.json 불필요. 단, 공개판 안드로이드는 "deprecated legacy Android Google Sign-In SDK" 기반(위험 항목 참고).
   - https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native
   - https://react-native-google-signin.github.io/docs/install
   - https://react-native-google-signin.github.io/docs/setting-up/get-config-file

### 버린 대안
- **카카오 OAuth 리디렉트(딥링크) 방식**: `signInWithOAuth({provider:'kakao', options:{redirectTo:'com.bumojasik.app://auth-callback', skipBrowserRedirect:true}})` → 인앱 브라우저로 URL 열기 → 딥링크로 돌아온 `code`를 `exchangeCodeForSession` (클라이언트 `flowType:'pkce'` 필요, 대시보드 Redirect URLs에 앱 스킴 추가, AndroidManifest에 스킴 intent-filter 추가). 카카오톡 앱 간편 로그인이 안 되고 웹 로그인 화면을 거쳐 어르신·자녀 모두 이탈이 커서 보조안으로만 둔다. 네이티브 경로가 막힐 때(아래 "aud" 위험) 전환용.
- **`@react-native-seoul/kakao-login` 6.0.4**(2026-08-05): `login({nonce})`·`idToken` 지원은 되나 안드로이드가 `ReactContextBaseJavaModule`(구 아키텍처 모듈, codegen 없음)이라 새 아키텍처에서는 interop 레이어에 기대야 함. RN 0.88에서 interop 동작은 **미확인**. README도 새 아키텍처 언급 없음(https://github.com/react-native-seoul/react-native-kakao-login).
- **`react-native-credentials-manager` 0.9.0**(구글 Credential Manager 기반, TurboModule, `serverClientId`·`nonce` 지원 — 패키지 소스 확인): 별 94개 수준의 작은 프로젝트라 1차 채택은 보류, 구글 공개판이 Play 서비스에서 막힐 때 교체 후보.
- **구글 유료판(Universal Sign In, Credential Manager 기반)**: 라이선스·사설 레지스트리 필요.

---

## 2. 같은 이메일로 여러 방법 로그인 시 동작(⑤)

- Supabase는 **같은 이메일의 identity를 한 사용자로 자동 연결**한다. 미인증 이메일 자동 연결은 계정 선점 공격 위험이라 하지 않고, 새 identity가 연결될 때 같은 사용자의 "unconfirmed" identity는 제거한다. https://supabase.com/docs/guides/auth/auth-identity-linking
- **이메일 OTP**: `verifyOtp` 성공 시 이메일 확인됨 → 자동 연결 대상.
- **구글**: ID 토큰의 `email_verified`를 따름(`claims.IsEmailVerified()`).
- **카카오**: Supabase가 ID 토큰에 `email`이 있으면 **무조건 `Verified: true`로 처리**(provider/oidc.go `parseKakaoIDToken`). 카카오 동의항목에서 이메일을 받지 못하면 ID 토큰에 email이 없고, 이때는 "Allow users without an email"(`email_optional`)을 켜야 로그인 자체가 된다 → 이메일 없는 카카오 사용자는 **별도 계정**이 생기고 다른 방법과 자동 연결되지 않는다.
- 결론(정책 검토용 사실): 카카오 이메일 동의를 받으면 "OTP로 가입한 자녀가 나중에 카카오로 와도 같은 계정". 받지 못하면 같은 사람이 계정 2개가 될 수 있다. 서로 다른 이메일끼리 묶으려면 `linkIdentity`(수동 연결, 베타, `enable_manual_linking`) 필요 — 빌드 1 범위 밖 권장.
- **익명 세션 주의**: 어르신 기기는 익명 세션을 쓴다. DECISIONS "한 기기 한 역할"과 같은 이유로, 소셜 로그인 버튼도 어르신 연결 기기에서는 막아야 한다(signInWithIdToken은 익명 세션을 덮어씀).

---

## 3. 단계별 구현 계획(코드 작업, 리드·구현 담당용)

선행: 아래 4장의 콘솔 작업 완료(키 값 확보).

1. **환경값 추가**: `KAKAO_NATIVE_APP_KEY`, `GOOGLE_WEB_CLIENT_ID`를 앱 설정(현재 Supabase URL 넣는 방식과 같은 곳)에 추가. 비밀값(카카오 Client Secret, 구글 Client Secret)은 앱에 넣지 않는다(Supabase 쪽에만).
2. **패키지 설치**: `@react-native-kakao/core@3.2.0 @react-native-kakao/user@3.2.0 @react-native-google-signin/google-signin@17.0.0`, nonce 해시용으로 SHA-256 구현 필요(예: `expo-crypto`는 Expo 모듈 의존이라 피하고, `react-native-quick-crypto` 또는 순수 JS `js-sha256` 중 택1 — 순수 JS 권장, 네이티브 추가 없음).
3. **안드로이드 설정(카카오)**
   - Kakao Maven 저장소 `https://devrepo.kakao.com/nexus/content/groups/public/` 추가. 우리 프로젝트가 `settings.gradle`에서 저장소를 선언하면 거기, 아니면 `android/build.gradle`의 `allprojects.repositories`(https://rnkakao.mjstudio.net/docs/install-android).
   - AndroidManifest에 `com.kakao.sdk.auth.AuthCodeHandlerActivity`(exported=true, VIEW/DEFAULT/BROWSABLE, `scheme="kakao{NATIVE_APP_KEY}" host="oauth"`) 추가 — 카카오톡 미설치 시 카카오계정(웹) 로그인 복귀용. 근거: 라이브러리 Expo 플러그인이 같은 내용을 주입(`expo-config-plugin/build/withAndroid.js`), seoul README도 같은 요구와 "Android 12+ exported=true 필수" 명시. RN CLI라 수동으로 넣어야 함.
   - 앱 시작 시 `initializeKakaoSDK(KAKAO_NATIVE_APP_KEY)` 1회.
   - R8: core 자동 링크 시 consumer rules 자동 포함(위 문서).
4. **안드로이드 설정(구글)**: `GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })`. google-services.json 불필요.
5. **인증 함수 추가**(realApi.ts 옆 `features/socialAuth.ts` 등):
   ```ts
   // 카카오
   const raw = randomString(32);              // 매 로그인 새로 생성
   const hashed = sha256Hex(raw);
   const t = await KakaoUser.login({ nonce: hashed });
   if (!t.idToken) throw new Error('KAKAO_NO_ID_TOKEN'); // OIDC 꺼짐
   await sb.auth.signInWithIdToken({ provider: 'kakao', token: t.idToken, nonce: raw });
   // 구글
   await GoogleSignin.hasPlayServices();
   const r = await GoogleSignin.signIn();
   if (r.type !== 'success' || !r.data.idToken) return; // 취소
   await sb.auth.signInWithIdToken({ provider: 'google', token: r.data.idToken });
   ```
   - 취소(사용자가 닫음)는 오류 화면이 아니라 조용히 복귀. 카카오톡 설치 여부는 라이브러리가 자동 분기(`isKakaoTalkLoginAvailable` 있음).
6. **로그아웃·탈퇴**: Supabase `signOut` + `KakaoUser.logout()`/`GoogleSignin.signOut()`. 계정 삭제 시 카카오 `unlink` 호출 여부는 방침에 따라(카카오 정책상 연결 끊기 권장 — **미확인**, 개발 단계에서 카카오 문서 확인).
7. **화면**: 자녀 로그인 화면에 [카카오로 시작](주) / [구글로 시작] / "이메일로 받기"(보조 링크). 어르신 연결 기기 차단 문구 재사용.
8. **서버**: 프로필 생성 트리거·RLS가 `auth.users` 생성 경로(OTP·ID 토큰)에 무관하게 동작하는지 확인. 카카오 이메일 없는 사용자(`email` null) 허용 시 이메일 전제 코드가 없는지 점검.
9. **테스트**: 단위(nonce 해시, 취소 처리) + 실기기 4케이스(카카오톡 설치/미설치, 구글 계정 1·2개) + 같은 이메일 OTP→카카오→구글 순서로 `auth.identities`가 한 user_id에 붙는지 SQL 확인.
10. **방침 갱신**: 카카오(이메일·닉네임·프로필 사진·회원번호), 구글(이메일·이름·프로필·sub) 수집 고지(DECISIONS 기존 항목).

---

## 4. 사용자 콘솔 작업 안내(각 칸에 무엇을 넣는지)

### 4-0. 먼저 지문 값 구하기
- **디버그(지금 debug.keystore)**: 프로젝트 `app/android`에서 `./gradlew signingReport` → `Variant: debug`의 `SHA1` 값(구글용). Java가 이 Mac에 없어서(`Unable to locate a Java Runtime`) 이번 조사에서 직접 뽑지 못함 → **미확인**. RN 템플릿 기본 debug.keystore라면 SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, 카카오 키 해시 `Xo8WBi6jzSxKDVR4drqm84yr9iU=`(seoul README가 기본 debug 키 해시로 이 값을 제시, 위 SHA-1을 base64로 바꾸면 같은 값임을 확인) — 반드시 signingReport 값과 대조.
- **카카오 키 해시 = SHA-1 바이트를 base64로**: `keytool -exportcert -alias <별칭> -keystore <키스토어> | openssl sha1 -binary | openssl base64`, 또는 SHA-1 문자열에서 `echo <콜론뺀SHA1> | xxd -r -p | openssl base64`.
- **출시(Play 앱 서명 사용 시)**: Play Console > 설정 > 앱 무결성 > **앱 서명 키 인증서**의 SHA-1(구글용 그대로, 카카오용은 base64 변환), 그리고 **업로드 키 인증서** SHA-1도 같이 등록(내부 테스트 트랙 빌드가 업로드 키로 서명된 것을 직접 설치하는 경우 대비). 출처: https://developers.kakao.com/docs/ko/android/getting-started , https://react-native-google-signin.github.io/docs/setting-up/get-config-file
- 개발자 PC마다 debug 키가 다르면 각각 등록(카카오 문서).

### 4-1. 카카오 디벨로퍼스(https://developers.kakao.com)
1. **앱 만들기**: 앱 > 앱 만들기 → 앱 아이콘, 앱 이름("가화만사성" 등), 회사명, 카테고리, 대표 도메인 → 저장.
2. **앱 키 메모**: 앱 > 플랫폼 키
   - **네이티브 앱 키** → 앱의 `KAKAO_NATIVE_APP_KEY`, AndroidManifest 스킴 `kakao{네이티브앱키}`
   - **REST API 키** → Supabase Kakao Client ID(아래 4-3)
   - **REST API 키 > 클라이언트 시크릿**(카카오 로그인 Client Secret 코드) → Supabase Kakao Client Secret. 활성화 상태 확인.
   - REST API 키 편집 화면의 **카카오 로그인 Redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback` (로컬 테스트용 `http://localhost:54321/auth/v1/callback`도). ID 토큰 방식에선 직접 쓰지 않지만 대체안(OAuth)과 Supabase 안내상 넣어 둔다.
3. **안드로이드 플랫폼 등록**: 앱 > 플랫폼 키 > 네이티브 앱 키(안드로이드) → **패키지명** `com.bumojasik.app`, **키 해시** 4-0의 값들(디버그·업로드·앱 서명 키 각각). 미등록 시 "카카오 API를 호출할 수 없습니다".
4. **카카오 로그인 켜기**: 카카오 로그인 > 사용 설정 > 상태 **ON**(꺼져 있으면 KOE004).
5. **OpenID Connect 켜기**: 카카오 로그인 > OpenID Connect > 상태 **ON**. 끄면 그 시점부터 ID 토큰 발급이 멈춰 로그인 전체가 깨진다.
6. **동의항목**: 카카오 로그인 > 동의항목
   - 닉네임(`profile_nickname`), 프로필 사진(`profile_image`): 기본 제공 → 필요한 것만 "선택 동의"(최소 수집 원칙상 닉네임만 권장, 판단은 정책 담당).
   - 카카오계정(이메일, `account_email`): **비즈 앱(또는 테스트 앱)에서만 설정 가능**. 2장의 자동 연결을 쓰려면 필요.
   - 각 항목 "동의 목적" 문구 입력, "동의 화면 미리보기"로 확인.
7. **비즈 앱 전환(이메일 받으려면)**: 앱 > 일반 > 비즈니스 정보. 사업자등록번호가 없으면 **개인 개발자 비즈 앱 전환** 버튼(본인인증·카카오비즈니스 통합 서비스 약관 동의 필요)이 있다는 포럼 답변이 있으나 공식 문서로는 **미확인**(https://devtalk.kakao.com/t/account-email/151641). 추가 권한이 필요한 항목은 앱 > 추가 기능 신청 > 개인정보 동의항목, 심사 3~5영업일.
8. **일반 사용자 공개 조건**: 카카오 로그인은 상태 ON이면 팀원 외 사용자도 쓸 수 있는지, 별도 "출시/검수" 단계가 있는지 공식 문서에서 **미확인**(설정하기 문서에 공개 조건 언급 없음). 이메일 등 권한 항목만 심사 대상으로 확인됨.

출처: https://developers.kakao.com/docs/ko/kakaologin/prerequisite , https://developers.kakao.com/docs/ko/kakaologin/utilize , https://supabase.com/docs/guides/auth/social-login/auth-kakao

### 4-2. Google Cloud Console(https://console.cloud.google.com)
1. **프로젝트 생성/선택**.
2. **Google Auth Platform(OAuth 동의 화면)**
   - **Branding**: 앱 이름, 사용자 지원 이메일, (로고는 넣으면 이름·로고 검증 대상이 될 수 있음), 개발자 연락처.
   - **Audience**: User type **External**. 게시 상태 **Testing**은 테스트 사용자 100명 한도. 단 email·profile·openid만 쓰면 테스트 사용자 목록·경고·7일 만료 제한이 면제. 출시 전 **Publish app**으로 In production 전환.
   - **Data Access(Scopes)**: `openid` 직접 추가, `userinfo.email`·`userinfo.profile`은 기본. 그 외 범위 추가 금지(검증 필요해짐).
3. **OAuth 클라이언트 ID — Web application** (필수, 이 ID가 `webClientId`이자 토큰의 aud)
   - 이름: `bumojasik-web`
   - Authorized JavaScript origins: 비워도 됨(웹 로그인 안 씀)
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (로컬: `http://127.0.0.1:54321/auth/v1/callback`)
   - 생성 후 **Client ID**(앱 `GOOGLE_WEB_CLIENT_ID` + Supabase) · **Client secret**(Supabase만) 저장.
4. **OAuth 클라이언트 ID — Android** (지문마다 1개)
   - Package name: `com.bumojasik.app`
   - SHA-1 certificate fingerprint: 4-0의 SHA-1(SHA-256 아님). 디버그용, 업로드 키용, Play 앱 서명 키용 각각 생성.
   - 누락 시 앱에서 `DEVELOPER_ERROR`(디버그는 되는데 릴리스가 안 되는 증상).

출처: https://supabase.com/docs/guides/auth/social-login/auth-google , https://react-native-google-signin.github.io/docs/setting-up/get-config-file , https://support.google.com/cloud/answer/15549945

### 4-3. Supabase 대시보드(Authentication > Sign In / Providers)
- **Kakao**
  - Kakao Enabled: ON
  - Kakao Client ID: **`<REST API 키>,<네이티브 앱 키>`** (쉼표 구분). 이유: 서버가 ID 토큰 `aud`를 Client ID 목록과 비교(`acceptableClientIDs = append(..., config.External.Kakao.ClientID...)`, ClientID는 `[]string` 쉼표 분리 — conf/configuration.go), 카카오 `aud`는 "ID 토큰이 발급된 앱의 앱 키"라 네이티브 SDK 로그인이면 네이티브 앱 키일 가능성이 큼(Supabase 커뮤니티 토론 https://github.com/orgs/supabase/discussions/23368 "네이티브 로그인으로 받은 id_token이면 NATIVE APP KEY를 넣어야"). 대시보드 칸이 쉼표 목록을 받는지 **미확인** → 실패 시 네이티브 앱 키만 넣는다(이 경우 OAuth 리디렉트 대체안은 못 씀).
  - Kakao Client Secret: 카카오 클라이언트 시크릿 코드
  - Allow users without an email: 이메일 동의를 못 받으면 **ON 필수**(받으면 OFF 권장)
  - Callback URL(읽기 전용): 카카오 Redirect URI 칸에 복사
- **Google**
  - Enabled: ON
  - Client IDs: **`<Web Client ID>,<Android Client ID들>`** (Web을 맨 앞)
  - Client Secret: Web 클라이언트의 secret
  - Skip nonce check: **OFF 유지**(공개판은 nonce를 안 보내고 토큰에도 없어 통과). Credential Manager 계열로 바꿔도 nonce를 제대로 넘기면 OFF.
  - Callback URL: 구글 Web 클라이언트 redirect URI에 복사
- (선택) Authentication > Settings의 manual linking: 빌드 1은 OFF 유지.

---

## 5. 로컬 Supabase로 테스트(⑧)

가능. CLI가 지원하는 `auth.external.<provider>` 목록에 `kakao`·`google` 포함, 필드 `enabled, client_id, secret, url, redirect_uri, skip_nonce_check`(https://supabase.com/docs/guides/local-development/cli/config), 우리 config.toml 템플릿에는 `email_optional`도 있음.

```toml
[auth.external.kakao]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID)"   # "REST키,네이티브키"
secret = "env(SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET)"
skip_nonce_check = false
email_optional = false   # 이메일 동의 못 받으면 true

[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"  # Web을 맨 앞
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```
- ID 토큰 검증은 로컬 auth 컨테이너가 카카오·구글 JWKS를 인터넷으로 가져오므로 PC 인터넷 필요. 실기기에서 로컬 Supabase에 붙으려면 기존처럼 PC IP 주소로 접속.
- `client_id`의 `env()` 치환 지원 여부는 **미확인**(secret은 문서 예시 있음) → 안 되면 값 직접 기입(키는 비밀 아님, secret만 env).
- 로컬 테스트도 실기기 앱 서명(debug 키)의 해시·SHA-1이 콘솔에 등록돼 있어야 한다.

---

## 6. 위험·미확인

| # | 내용 | 영향 | 대응 |
|---|---|---|---|
| R1 | 카카오 네이티브 로그인 ID 토큰 `aud` = 네이티브 앱 키인지 공식 문서 **미확인**(커뮤니티 근거) | Supabase "audience" 거부로 로그인 실패 | Client ID에 두 키 모두 등록, 첫 실기기 테스트에서 토큰 디코드해 `aud` 확인 |
| R2 | 대시보드 Kakao Client ID 칸의 쉼표 목록 허용 **미확인**(서버 코드는 `[]string`) | R1 대응 불가 | 네이티브 키만 등록으로 후퇴 |
| R3 | 카카오 이메일은 비즈 앱 필요, 개인 개발자 전환 조건 공식 **미확인** | 이메일 없으면 자동 연결 안 됨, `email_optional` 필요 | 사업자 여부 확인 후 전환 신청을 가장 먼저(심사 3~5영업일) |
| R4 | Supabase가 카카오 이메일을 무조건 verified로 처리 | 카카오 계정 이메일 소유가 실제 확인되지 않은 경우 같은 이메일의 기존 계정에 붙을 수 있음(선점 위험) | 정책 검토 항목. 카카오 `is_email_verified` 별도 확인은 서버에서 불가 |
| R5 | 구글 공개판은 deprecated 레거시 SDK 기반, Google이 Play 서비스에서 제거할 수 있음 | 장래 구글 로그인 중단 | 인터페이스를 `socialAuth.ts`로 감싸 `react-native-credentials-manager`(nonce 지원)로 교체 가능하게 |
| R6 | `@react-native-kakao` 문서 일부가 "v3 아직 미배포" 문구(현재 npm엔 3.2.0 배포), 사이트 일부 404 | 문서·코드 불일치 | 패키지 소스 기준으로 구현, RN 0.88에서 빌드 1회 검증(peer는 `>=0.76`) |
| R7 | 출시 서명 키 없음(지금 release도 debug.keystore) | 콘솔 등록을 두 번 해야 함 | 출시 키·Play 앱 서명 먼저 정하고 지문 일괄 등록 |
| R8 | 어르신 익명 세션 덮어쓰기 | 어르신 연결 끊김 | 소셜 버튼도 "한 기기 한 역할" 차단 적용 |
| R9 | 카카오 "일반 사용자 공개"에 별도 검수 단계가 있는지 **미확인** | 출시 직전 차단 가능성 | 콘솔에서 앱 상태 화면 확인(사용자 작업) |
| R10 | 탈퇴 시 카카오 연결 끊기(unlink) 의무 여부 **미확인** | 정책 위반 가능성 | 구현 6단계에서 카카오 운영정책 확인 |
| R11 | 이 Mac에 Java 런타임이 없어 debug SHA-1 직접 확인 못 함 | 잘못된 지문 등록 | `./gradlew signingReport`(Android Studio JBR) 로 확인 |
