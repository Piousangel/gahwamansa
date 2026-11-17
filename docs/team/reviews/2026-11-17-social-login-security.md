# 자녀 소셜 로그인 보안 검토 (2026-11-17)

- 검토자: 독립 보안 검토(모바일 인증), 작성자와 다른 에이전트. 대상: 커밋 안 된 변경(socialAuth·sha256·socialConfig·ChildLogin·SocialButton·realApi/fakeApi·Manifest·gradle·jest.setup)
- 실행: `npx tsc --noEmit` 통과(0). `npx jest` 1회차 1건 실패 → 재실행 32/32·254/254 통과(플래키, 어느 테스트인지는 못 잡음). SHA-256은 node crypto와 507개 입력 비교(0~200바이트 경계, 무작위 0~299바이트, 한글 3000자, 이모지) 0건 불일치
- 결론: 막을 만한 결함 없음. nonce 연결은 맞다. 높음 1건(탈퇴 시 인증 계정·식별 정보 남음), 나머지는 중간·낮음

## 확인된 것 (문제 없음)
- ① 카카오 nonce: 32바이트 CSPRNG 원문 → SDK에는 `sha256Hex(raw)`, Supabase에는 원문 (realApi.ts:80-91). 로그인마다 새로 만들고, 난수가 없으면 Math.random으로 대체하지 않고 실패(sha256.ts:85-93). 테스트가 해시 관계를 직접 검증(socialLogin.test.tsx:105-120)
- ② SHA-256: 패딩·길이 필드(hi/lo)·라운드 상수 정상. UTF-8 인코딩은 서로게이트 쌍까지 정확
- ④ 비밀값 없음: 앱에는 카카오 네이티브 앱 키·구글 웹 클라이언트 ID(둘 다 공개 값)만 있다(socialConfig.ts:3,5). config.toml에도 시크릿 없음
- ⑤ 화면 문구는 고정 문구 2종(인터넷/로그인 안 됨)만 쓴다(ChildLogin.tsx:128). SDK·Supabase 메시지는 Error 객체 안에만 있고 화면·로그로 나가지 않음
- ⑦ 새 직접 의존성 4개는 정확한 버전으로 고정. 배포일: kakao core 11-03, user 11-04, google-signin 10-29, get-random-values 2025-10-22(모두 2주 넘음). lock에 추가된 install 스크립트 없음(`prepare`는 레지스트리 설치 때 안 돈다). 하위 의존성 crypto-js 4.2.0은 PBKDF2 CVE가 고쳐진 판

## 지적

| # | 심각도 | 내용 | 근거 | 수정 제안 |
|---|---|---|---|---|
| 1 | 높음 | 계정 지우기를 해도 `auth.users`·`auth.identities`가 남는다. 소셜 로그인부터는 identity_data에 구글 이메일·이름·사진 URL, 카카오 회원번호·닉네임이 저장되므로 탈퇴 뒤에도 개인정보가 남는다. 같은 계정으로 다시 로그인하면 예전 user_id로 그대로 들어온다 | realApi.ts:53-56 주석, migrations/…08_delete_account.sql:20 | Edge Function(service_role)에서 `auth.admin.deleteUser`를 부르거나, 방침에 "인증 기록 보관 기간"을 적는다. 결정이 필요하면 DECISIONS에 남긴다 |
| 2 | 중간 | 카카오 unlink가 기기의 SDK 토큰에 의존한다. 토큰이 만료됐거나 다른 기기에서 탈퇴하면 조용히 실패하고(socialAuth.ts:95-101) 다시 시도하지 않으며 서버도 모른다. 카카오 쪽 "연결된 앱"이 남는다 | realApi.ts:57-70 | 서버에서 Admin 키로 `/v1/user/unlink`(target_id=회원번호) 호출(Admin 키는 Supabase 시크릿에만). 앱 unlink는 보조로만 둔다. 순서(데이터 삭제 성공 → unlink → signOut)는 지금이 맞다 |
| 3 | 중간 | 구글은 nonce 없이 교환한다(realApi.ts:95-100). Supabase 규칙상 "둘 다 없음"이면 통과한다는 건 작성자의 서버 코드 확인에 기댄 것이고, 유효 시간(약 1시간) 안에 새어 나간 ID 토큰을 다시 쓰는 공격은 막지 못한다. aud가 우리 웹 클라이언트로 고정돼 위험은 제한적 | 08-social-login.md:18,25, TODO.md:251 | 실기기에서 교환이 되는지 확인. R5 교체 때 Credential Manager 계열로 nonce를 넣고, Skip nonce는 계속 OFF |
| 4 | 중간 | 어르신 기기 차단은 화면 판정뿐이다(ChildGate.tsx:22-27, `whoAmI`가 parent 프로필이 있을 때만 막음). 익명 세션이지만 아직 연결되지 않은 기기(미리보기·동의 중)는 'none'이 되어 소셜 로그인이 익명 세션을 덮어쓰고, 익명 사용자는 서버에 고아로 남는다. 연결된 기기는 화면 흐름상 막히지만 서버가 강제하지는 않는다(자기 기기 세션만 잃으므로 다른 사람 계정을 건드리는 우회는 아님) | realApi.ts:149-157, ChildGate.tsx:22 | signInWithSocial 직전에 `getSession()`이 익명이면 parent 프로필을 한 번 더 확인해 막는다(가드를 API 쪽에도). 고아 익명 사용자 정리 작업(예: 프로필 없고 30일 지난 익명 계정 삭제)을 TODO에 추가 |
| 5 | 낮음 | 탈퇴 때 provider를 `app_metadata.provider`(처음 가입한 방법)로만 본다. 이메일로 가입한 뒤 같은 메일 구글이 자동으로 합쳐진 사용자는 구글 SDK signOut이 빠진다 | realApi.ts:59-66 | `app_metadata.providers` 배열 전체를 보고 각각 정리 |
| 6 | 낮음 | 앱에 로그아웃이 없다(signOut은 탈퇴 경로에만 있음). 자녀 폰을 넘길 때 카카오·구글 SDK 세션과 Supabase 세션이 남는다 | grep signOut: realApi.ts:66,72뿐 | 설정에 로그아웃 추가 때 `auth.signOut` 후 `socialAuth.signOut(provider)` 순서로 |
| 7 | 낮음 | `AuthCodeHandlerActivity`가 exported·BROWSABLE `kakao{앱키}` scheme이라 다른 앱이 같은 scheme을 등록하면 웹 로그인 인가 코드를 가로챌 수 있다. 카카오 SDK의 PKCE(code_verifier) 사용 여부는 이번에 확인하지 못함. 카카오톡 로그인 경로는 키 해시로 보호된다 | AndroidManifest.xml:28-37 | Kakao SDK 2.25.1 소스에서 PKCE 사용을 확인. 카카오 콘솔 키 해시는 출시 키로만 등록(debug 키 해시는 출시 전 제거) |
| 8 | 낮음 | `sha256Hex`가 짝 없는 서로게이트를 3바이트로 인코딩해 표준 UTF-8(U+FFFD)과 다르다. 지금은 nonce가 hex라 영향 없음 | sha256.ts:15-25 | 주석에 "ASCII/정상 문자열 전용"이라고 적거나 테스트에 명시 |
| 9 | 낮음 | 같은 키가 두 곳에 있다(strings.xml `kakao_scheme`, socialConfig.ts). 어긋나면 웹 로그인 복귀가 안 됨 | strings.xml:3, socialConfig.ts:3 | gradle `resValue`로 한 곳에서 주입하거나, 두 값이 같은지 확인하는 테스트 1개 |

## 테스트가 놓치는 것 (⑧)
- 탈퇴 경로의 소셜 정리(unlink 호출, unlink 실패에도 signOut 진행, 데이터 삭제 실패 시 unlink 안 함) 테스트 없음 → 지적 2·5 회귀를 못 잡는다
- 어르신 차단 테스트는 fakeApi `linked:true`만 확인(socialLogin.test.tsx:73-81). realApi `whoAmI`와 "익명인데 미연결" 상태는 확인 안 함 → 지적 4
- nonce 길이 검사가 `>= 32`로 느슨함(sha256.test.ts:15). `toMatch(/^[0-9a-f]{64}$/)`로 바꾸고, 로그인 두 번 하면 원문 nonce가 서로 다른지도 확인
- SHA-256 벡터는 4개뿐. 448비트(55·56·64바이트) 경계와 NIST 2블록 벡터(`abcdbcdecdef…nopq` → `248d6a61…`) 추가 권장
- 1회차 플래키 실패 원인 확인 필요(이번 변경과 관련 있는지 불명)
