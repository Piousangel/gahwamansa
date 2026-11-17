# 09. 환경 분리 설계: local / staging / production

- 작성: 2026-11-17, 백엔드·모바일 인프라 담당(설계만, 코드 수정 없음). 근거: DECISIONS "환경 분리·백오피스", TODO 20~29, 08-social-login.md
- 현재: 원격 1개(eigocuecmaapxnmhttwj, 서울, 무료 조직 bumo-jasik)에 테스트 계정·데이터 섞임, 카카오·구글 provider·SMTP·OTP 설정 완료. 앱은 `config.local.ts`(gitignore)를 손으로 바꾸고 `App.tsx`의 `API_MODE`('fake'/'real')를 코드에서 바꾸는 방식, 패키지 1개 `com.bumojasik.app`, release도 debug 키로 서명(build.gradle)

## 1. 환경 정의
| | local | staging | production |
|---|---|---|---|
| Supabase | Docker(`supabase start`) | **지금 원격 eigocuecmaapxnmhttwj를 그대로** | **새 프로젝트**(서울 ap-northeast-2) |
| 데이터 | 시드 + 개인 테스트 | 시드 + 테스트 계정(팀·디자인 QA) | 실사용자만(비공개 테스트 어르신 가구 포함) |
| 요금·백업 | 무료 | 무료(1주 미사용 시 일시 정지 감수, 백업 없음) | **Pro**(일 1회 백업 7일 보관, 정지 없음) |
| 앱 | 디버그 빌드, fake 또는 real | stagingRelease | productionRelease(Play) |
- 권고: **현재 원격 → staging, production은 새로 만든다.** 이유: 테스트 계정·익명 사용자·삭제 시험 흔적을 지우는 것보다 빈 프로젝트가 확실히 깨끗함, 노출된 secret 키(TODO 25)도 새 프로젝트에서 자연히 교체, staging의 설정 완료 상태를 그대로 씀. 대가: provider·SMTP·OTP·익명 로그인 설정을 production에 한 번 더(체크리스트로)
- 무료 플랜은 **본인이 Owner/Admin인 모든 조직을 합쳐 활성 프로젝트 2개**, 미사용 1주 시 정지, 자동 백업 없음. production을 Pro 조직에 두면 staging 1개만 무료 한도를 씀(다른 무료 프로젝트가 이미 있으면 한도 초과 — Q3)
- 비밀값: DB 비밀번호·service_role/secret 키·카카오/구글 Client Secret·FCM 서비스 계정은 **환경별로 다르게**, 비밀번호 관리자에 "staging/production" 항목으로 분리 저장, 앱·저장소에 넣지 않음. Edge Function 비밀은 `supabase secrets set --project-ref <ref>`로 환경별 주입
- 출처: https://supabase.com/docs/guides/platform/billing-on-supabase , https://supabase.com/pricing , https://supabase.com/docs/guides/deployment/managing-environments ("You need a *new* project for staging")

## 2. 앱 빌드 분리(Android)
- `productFlavors { staging { applicationIdSuffix ".staging" } production {} }`(dimension `env`) → `com.bumojasik.app.staging`과 `com.bumojasik.app`이 한 폰에 동시 설치. 패키지명 확정(TODO 23)이 먼저
- 구분: `app/android/app/src/staging/res/`에 앱 이름 "가화 STG"와 띠 두른 아이콘, 설정 화면 하단에 "스테이징 · 서버 ref" 작은 표시(production에는 없음)
- 설정 주입: 공개 값만 담은 `app/env/{staging,production}.env`(SUPABASE_URL, publishable 키, 카카오 네이티브 키, 구글 웹 클라이언트 ID)를 커밋, 빌드 시 flavor에 맞는 파일 → JS 설정. 1안 `react-native-config`(flavor별 envfile, RN 0.88 새 아키텍처 호환은 **미확인** → 설치 시 빌드 1회 검증), 2안 Gradle 작업이 번들 직전 `src/lib/env.generated.ts` 생성. `socialConfig.ts` 상수와 `API_MODE` 하드코딩은 이 값으로 대체, `config.local.ts`는 local(맥 LAN IP)에만 남김. 비밀값은 env 파일에 절대 없음
- 서명: local=debug 키, staging·production release=**같은 업로드 키**(release.keystore, 지문 이미 카카오·구글 등록, 키 파일은 사용자 맥에만). Play 앱 서명 키 지문은 production 외부 설정에만 추가
- Play 트랙: 트랙은 앱(패키지)별이라 **staging 패키지는 Play에 올리지 않음**(별도 스토어 앱·심사 불필요). staging은 adb 설치 또는 Firebase App Distribution. production 패키지의 내부 테스트(최대 100명)=출시 후보 검증, 비공개 테스트(12명·14일)·프로덕션=실사용 → 전부 production 서버. 출처: https://support.google.com/googleplay/android-developer/answer/9845334 , https://developer.android.com/build/build-variants

## 3. 외부 서비스
- 카카오: **같은 앱(1653853)에 staging용 네이티브 앱 키를 하나 더** 만들고 그 키에 `.staging` 패키지 + 키 해시 등록(앱 키는 종류별 최대 5개, 플랫폼 정보는 앱 키별). 동의항목·OIDC 설정은 공유. ID 토큰 aud가 네이티브 키이므로 각 Supabase의 Kakao Client ID에 자기 환경 키만 넣으면 토큰이 환경을 넘지 못함. 별도 앱은 동의항목·검수 이중 관리라 비권장. 출처: https://developers.kakao.com/docs/ko/getting-started/app-key-migration , https://developers.kakao.com/docs/ko/android/getting-started
- 구글(gahwa-mansaseong): 같은 Cloud 프로젝트·동의 화면 공유, Android 클라이언트를 `.staging`+release SHA-1, `.staging`+debug SHA-1로 추가, **웹 클라이언트는 환경별 1개씩**(staging용 신규) — aud로 환경 분리, 각 Supabase Google provider에는 자기 웹 클라이언트 ID·Secret
- Supabase provider·Auth: 환경별 대시보드에서 따로(익명 ON, Kakao "Allow users without an email" ON, OTP 6자리·600초, 템플릿은 `supabase/templates/` 원본을 양쪽에 동일 붙여넣기). Redirect URI(카카오·구글 웹)는 각 프로젝트 `https://<ref>.supabase.co/auth/v1/callback`
- SMTP: staging은 지금 Gmail 앱 비밀번호 유지(발신 이름 "[스테이징] 가화만사성"), production은 발송 한도·도달률 때문에 전용 SMTP(Resend 등, 한도 **미확인**) 권장 — 출시 전 결정
- 푸시(빌드1 필수): Firebase 프로젝트를 **환경별 분리**(bumo-jasik-staging / -prod), `google-services.json`은 `app/src/staging/`·`app/src/production/`에(둘 다 gitignore), FCM 서비스 계정은 각 Supabase secrets. 출처: https://firebase.google.com/docs/projects/dev-workflows/general-best-practices
- site/: 방침·삭제 안내는 하나(production 기준), staging 앱도 같은 URL. 토스 미니앱도 같은 원칙(샌드박스=staging 서버)

## 4. DB 마이그레이션 흐름
1. local: 팀이 `supabase/migrations/` + `supabase/down/` 작성 → `npx supabase db reset`(시드 포함) → `supabase/tests` 통과
2. staging: `scripts/db-push.sh staging`(팀이 작성 예정: ref 파일로 `link` → `db push --dry-run` 출력 확인 → `db push`) → staging 앱으로 확인. DB 비밀번호 입력은 사용자(또는 사용자가 허락하면 팀 맥의 키체인)
3. production: staging 확인 후 **사용자가** `scripts/db-push.sh production` 실행(스크립트가 "production" 입력 확인 요구, 실행 전 `supabase db dump`로 스키마 백업). `supabase link`는 마지막 연결 대상을 기억하므로 손으로 link하지 않는다
- 시드: 콘텐츠(질문·사진 메타, `seed_content_14d.sql`)는 사용자 데이터가 아니라 환경마다 같은 원본을 적용(재실행해도 안전하게 upsert로 정리 필요). 사진은 `scripts/photos`로 각 프로젝트 `content-photos` 버킷에 업로드. 테스트 계정 시드는 local·staging만
- 되돌리기: 기본은 고치는 마이그레이션을 새로 추가(forward fix). 긴급 시 `supabase/down/*.down.sql`을 해당 환경에 적용 후 `supabase migration repair --status reverted <버전>`. 데이터 손상은 Pro 일 백업 복원(최대 7일 전)

## 5. 데이터 분리 원칙
- production 데이터(사진 답·자녀 연결·연락처)를 local·staging으로 복사하지 않는다. 재현이 필요하면 staging에서 같은 상황을 만든다
- 테스트 계정·익명 기기는 staging·local에만. production에서 확인이 필요하면 실제 출시 빌드로 본인 계정 1개만, 확인 후 앱의 계정 삭제로 정리
- production 접근(대시보드 SQL·service 키)은 사용자 1인, 팀은 staging까지. 백업 덤프는 저장소 밖 암호화 위치

## 6. 작업 순서와 몫 (추정은 가정, 실측 아님)
| 순서 | 사용자 몫 | 팀 몫 | 추정 |
|---|---|---|---|
| 1 | Q1~Q3 답, 패키지명 확정 | — | 즉시 |
| 2 | production 프로젝트 생성(서울, DB 비밀번호 본인), Pro 결제 | production 설정 체크리스트 작성 | 사용자 30분 |
| 3 | 카카오 staging 네이티브 키, 구글 staging 웹·Android 클라이언트, 각 Secret을 해당 Supabase에 입력 | 칸별 안내·지문·키 해시 계산 | 사용자 40분 |
| 4 | Firebase 2개 생성·json 2개 내려받기 | — | 사용자 20분 |
| 5 | — | flavor·env 주입·아이콘·db-push 스크립트, 두 빌드 실기기 확인 | 팀 6~10h |
| 6 | production `db push` 실행 | 시드·사진 업로드, 로그인·푸시 스모크 테스트 | 사용자 10분·팀 2h |
- 마감: 비공개 테스트(production 패키지·서버) 업로드 전, 즉 Play 업로드 목표(11/25 전후) 이전에 2~6 완료

## 7. 위험·결정 필요
- 위험: production 설정 누락(provider·SMTP·익명 한도) → 체크리스트로 staging과 대조 / 잘못된 프로젝트에 push → 스크립트 확인 단계 / 무료 staging 1주 정지 → 쓰기 전 대시보드에서 재개
- **Q1.** 현재 원격을 staging으로, production은 새로 만들까요? **추천: 예**(깨끗한 운영 데이터, 키 교체 겸함)
- **Q2.** staging 앱은 Play에 올리지 않고 adb·Firebase App Distribution으로만 배포할까요? **추천: 예**(별도 스토어 앱·심사 불필요, Play 트랙은 모두 production)
- **Q3.** production 생성 시점에 Pro(월 $25부터, 컴퓨트 크레딧 $10으로 Micro 1개 포함 — 가격 페이지 기준. production만 Pro 조직에 두면 추가 컴퓨트 없음) 결제할까요? 다른 무료 Supabase 프로젝트가 이미 있나요? **추천: 생성과 동시에 Pro**(실사용자 데이터 백업·정지 방지), 다른 무료 프로젝트가 있으면 알려 주세요(무료 2개 한도)
