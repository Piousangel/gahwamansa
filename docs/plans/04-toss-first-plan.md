# 토스 우선 계획 (2026-11-17)

사용자 결정: **"일단 토스에 올리는 것을 목표로 작업"**. Google Play는 2순위(병행하되 엔지니어링 집중은 토스). 근거 문서: `03-toss-inapp-analysis.md`와 아래 공식 문서(2026-11-17 직접 확인).

## 1. 새로 확인한 사실
| 항목 | 내용 | 출처 |
|---|---|---|
| **사용자 식별 키 `anonKey`** | 로그인·동의 없이 발급. 같은 미니앱에서 같은 사용자는 **같은 키(기기 변경·앱 재설치에도 유지)**, 토스 탈퇴 후 재가입하면 바뀜. 미니앱별로 고유. 실명·전화번호 등은 받지 않음. 푸시 대상 식별 등에 쓰도록 안내 | [anon-key](https://developers-apps-in-toss.toss.im/guide/authentication/anon-key.md) |
| **보안 연결 방법** | 클라이언트가 보낸 `anonKey`를 서버가 믿으면 안 됨. 미니앱이 `User.createAnonymousKeyAuthCode()`로 **인증 코드(300초, 1회용)** 를 받아 서버로 보내고, 서버가 앱인토스 서버와 **코드를 교환(mTLS)** 해 `anonKey`를 받아야 함 | [인증 코드](https://developers-apps-in-toss.toss.im/guide/authentication/anonymous-key-auth-code.md) |
| 토스 로그인 | 로그인 기능은 토스 로그인만 허용. 항목(이름·이메일·성별 등), 연결 끊기 콜백(`UNLINK`·`WITHDRAWAL_*`), 복호화 키 필요. 이름·이메일·성별 외 항목은 콜백 필수 | [로그인 소개](https://developers-apps-in-toss.toss.im/guide/authentication/intro.md) |
| 서버 API 인증 | mTLS 인증서+개인 키를 요청에 설정. 사용자 단위 API는 `x-anon-key` / `x-toss-user-key` / Bearer. **서버리스 사용 가능 여부는 문서에 없음** | [auth](https://developers-apps-in-toss.toss.im/api/auth.md) |
| WebView SDK | 패키지 `@apps-in-toss/web-framework`, 설정 파일 `apps-in-toss.config.ts`(`appName`은 콘솔 등록과 같아야 업로드 가능), `ait init`, 개발 서버 → 샌드박스 확인 → `npm run build` → 콘솔 업로드 → 토스앱 테스트 후 출시 요청. TDS(`@toss/tds-mobile`, React 18)는 **선택** | [WebView 튜토리얼](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview.md) |
| 테스트 | 샌드박스 앱은 SDK 2.x용(Android 7+·iOS 16+), 3.x는 브라우저 devtools. Android는 `adb reverse`로 로컬 서버 연결. 라이브는 https만, **iOS 서드파티 쿠키 차단**이라 토큰 기반 인증 필요 | [샌드박스](https://developers-apps-in-toss.toss.im/development/test/sandbox.md) |

## 2. 설계에 미치는 영향 (좋아지는 것)
- **어르신 "가입 없음"이 그대로 유지된다**: anonKey가 가입 없는 식별을 대신한다. 토스 로그인이 필요 없고 카카오 로그인 연동도 필요 없어진다(토스 트랙 한정).
- **폰 교체 재연결 문제가 사라진다**: 키가 토스 사용자에 묶이므로 새 폰에서도 같은 사용자다(P14, C2의 재연결 코드는 토스 트랙에서 불필요).
- **푸시**: anonKey로 대상을 식별하는 토스 푸시(기능성 알림)를 쓸 수 있다(서버 API, 동의 필요) — 매일 열게 하는 장치와 맞는다. 세부 명세는 `/api/push.md`에서 확인 필요.

## 3. 새로 생기는 위험 (반드시 읽기)
1. **어르신이 토스 앱 사용자여야 한다.** 토스 가입·본인 인증이 필요한 60~80대가 얼마나 되는지 근거가 없다. **이 한 가지가 토스 우선 전략의 성패를 가른다.** 3가구 어르신에게 "토스 앱이 깔려 있나요"를 가장 먼저 묻는다(사용자 확인).
2. **서버의 mTLS 호출**: 인증 코드 교환에 mTLS가 필수인데 Supabase Edge Function에서 가능한지 미확인. 안 되면 별도 소형 서버(인증서 보관)가 필요하다.
3. **Supabase 세션 발급**: 교환으로 얻은 `anonKey`로 우리가 직접 Supabase 사용자를 매핑하고 세션(JWT)을 발급해야 한다(문서에 권장 흐름 없음). 쿠키는 쓸 수 없고 토큰 방식이어야 한다.
4. **교차 유도 금지**: 토스 안에서 Play 앱 설치·이동 유도 불가(`03` 참고).
5. **검수 불확실성**: 심사 기간·반려 기준, 사업자 등록 필요 여부 미확인. 익명 키만 쓰는 구조가 검수에서 문제없는지는 콘솔에 올려 봐야 안다.
6. **WebView는 CSR/SSG만**, 음성 읽기(TTS)·큰 글씨 접근성이 WebView에서 되는지 미확인.

## 4. 목표 구조
```
[토스 미니앱: toss/ (React 18 + Vite, WebView SDK)]  ── 인증 코드 ──▶ [인증 함수(서버)] ──mTLS──▶ 앱인토스 서버
         │                                                      │ anonKey 확인
         │◀──────── Supabase 세션(JWT) ─────────────────────────┘
         ▼
 [Supabase: 기존 스키마·RLS·RPC 재사용 + anonKey↔user 매핑 테이블]
[안드로이드 RN 앱: app/ (2순위, 기존 유지)] ── 카카오 로그인/익명 ──▶ 같은 Supabase
```
- 기존 서버 자산(RLS, 가족·코드·세션·콘텐츠·삭제 RPC)은 **그대로 재사용**한다. 추가는 `identities` 매핑(provider='toss', anon_key) 정도(설계는 스파이크 후).
- 공유할 코드: 도메인 타입·문구·콘텐츠 규칙은 `packages/core`로 분리하는 것을 제안(앱은 RN, 토스는 웹이라 화면은 공유 불가).
- 디자인: 우리 디자인 시스템 유지(TDS는 선택). 라이트 모드, 토스 네비게이션 바 사용, 자체 뒤로가기 금지(`03`).

## 5. 작업 순서
| 단계 | 내용 | 완료 증거 | 필요한 것 |
|---|---|---|---|
| T0 | **어르신 토스 사용 여부 확인**(3가구) | 3가구 응답 기록 | 사용자 |
| T1 | **기술 스파이크**(로컬): `toss/` 웹 프로젝트 생성, 개발 서버/브라우저 devtools에서 우리 화면 1개 + Supabase 호출(CORS 포함) | 브라우저에서 코스 홈이 로컬 Supabase 데이터로 표시 | 없음(리드 진행) |
| T2 | 콘솔 워크스페이스 생성, `appName` 확정, 샌드박스에서 `createAnonymousKeyAuthCode` 확인 | 코드 발급 로그 | **사용자 계정** |
| T3 | mTLS 인증서 발급 방식 확인, 인증 함수 설계(Edge Function 가능 여부 판정) | 교환 호출 성공 | 사용자(인증서) |
| T4 | 인증 함수 + Supabase 세션 발급 + 매핑 테이블(TDD) | 통합 테스트 | — |
| T5 | 어르신·자녀 화면 구현(디자인 시스템 v3), 푸시, 삭제(연결 해제) 처리 | QA 게이트 | — |
| T6 | 검수 준비(비게임 출시 가이드 체크리스트), 콘솔 업로드, 토스앱 테스트, 출시 요청 | 검수 승인 | 사용자 |

## 6. Play 트랙(2순위)
- 기존 RN 앱과 서버는 유지한다. Play 계정 절차(본인 확인, 테스터 모집)는 비용이 적으니 사용자 쪽에서 계속 진행하고, 엔지니어링은 토스에 집중한다.
- 토스와 Play는 같은 Supabase를 쓰는 독립 제품이다. 같은 가족이 두 채널에 걸치는 경우(예: 자녀는 토스, 어르신은 Play 앱)는 **6자리 번호를 사용자가 직접 전달**하는 방식으로만 연결한다(설치 유도 금지).
