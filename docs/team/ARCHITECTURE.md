# 아키텍처 규칙 (2026-11-17, 아키텍트)

근거: DECISIONS "품질·확장성 원칙", REPO.md(영역·소유), 감사 `reviews/2026-11-17-architecture-audit.md`, 실행 계획 `plans/12-architecture-refactor.md`.
전제: 한 서버(Supabase) + 여러 클라이언트(RN Android→iOS, 토스 미니앱(웹), Next.js 백오피스). 화면 코드는 공유하지 않고 **계약·문구·토큰·순수 도메인 로직만** 공유한다.

## 1. 저장소 레이아웃
| 경로 | 내용 | 비고 |
|---|---|---|
| `supabase/` | 마이그레이션·down·pgTAP·시드·`types/database.gen.ts`(생성물) | 계약의 근원 |
| `app/src/api/contract/` → 나중에 `packages/contracts` | RPC별 인자·반환 타입 + 런타임 검증, 오류 이유 목록 | 플랫폼 무관 TS만(React·RN·DOM 금지) |
| `app/` | RN 앱(Android·iOS 한 코드) | |
| `toss/`, `admin/`(예정) | 토스 미니앱, 백오피스 | contracts·copy·tokens만 가져다 쓴다 |
| `design-system/` | 토큰 원본(`tokens-v4.json`, v3는 한 릴리스 병행)·에셋·명세 | 앱 `ui/tokensV4.ts`는 생성물(`node scripts/gen-tokens-v4.js`, `tokensV4.test.ts`가 동기 검증). `ui/tokens.ts`는 v3 사본·별칭 |
| `docs/team/copy.ko.json` | 문구 원본 | 앱 사본은 스크립트로만 덮어쓴다 |
- `packages/` + npm workspaces 전환은 **두 번째 클라이언트가 실제로 서버를 부를 때**(토스 연동 착수 또는 백오피스 착수) 한다. 그 전엔 `app/src/api/contract/`에 같은 규칙으로 둔다(옮기기만 하면 되게).

## 2. app/src 레이어와 의존 방향
```
app(조립: AppRoot·Stack·Provider)  →  features/<기능>  →  api · ui · copy · lib
                                                     └→ shared(기능 간 공용 훅·오류 변환)
```
- 화살표 반대 방향 import 금지. 특히 **features → app 금지**(현재 위반: `useSession`·`BackBar`·`ParentStack` 타입·`splash`).
  - `session`·`splash` 훅 → `src/state/`, `BackBar` → `src/ui/`, 내비 파라미터 타입 → `src/navigation/types.ts`(화면을 import하지 않는 파일).
- **기능 간 import 금지.** 둘 이상이 쓰면 `shared/`나 `ui/`로 올린다(예: `errorMessage`는 `course/useFinishStep`에서 `shared/errors.ts`로).
- `ui/`는 copy·api·features를 모른다(문구·데이터는 props로 받는다). `lib/`는 React를 모른다.
- `api/`(지금 `features/types·fakeApi·realApi·selectApi`): 화면은 `Api` 인터페이스만 쓴다. supabase-js 호출은 `realApi` 안에서만.
- 화면 파일 250줄 넘으면 로직을 `useXxx`(상태)·`xxxLogic.ts`(순수 함수)로 뺀다. 순수 함수는 단위 테스트 필수.

## 3. 명명
- 파일: 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 순수 로직 `camelCase.ts`. 같은 개념은 한 이름(예: 시트는 `BottomSheet` 하나).
- 화면 ID는 디자인 명세 번호(P6, C5…)를 주석에, 파일명은 역할 이름(`KeyboardStep`)으로.
- RPC: `snake_case` 동사_목적어(`send_cheer`, `get_my_cheers`). 호출자 본인 기준은 `my_`, 서버 전용 헬퍼는 `_` 접두 또는 실행 권한 회수.
- 앱 메서드: RPC 이름의 camelCase(`send_cheer` → `sendCheer`). 이름을 바꾸면 계약 변경으로 취급.
- 마이그레이션: `20261116000NNN_<영역>_<내용>.sql` + 같은 이름 `.down.sql` + `tests/<내용>.test.sql`. **번호는 리드가 대장에서 순서대로 발급, 빈 번호 예약 금지**(나중 번호가 먼저 원격에 가면 `db push`가 거부).

## 4. 서버 RPC 규칙
- `security definer set search_path = ''`, `revoke ... from public, anon` 후 필요한 역할에만 `grant`. 서버 전용은 `authenticated`도 회수.
- 반환은 `jsonb` 객체 하나. 도메인 실패는 `{ok:false, reason}`로 돌려주고, 권한·입력 오류만 `raise exception '<reason>'`(P0001). reason은 `contracts`의 목록에 있는 값만.
- 키·이름 목록(응원 키, 이벤트 이름, 호칭)은 **서버 check/화이트리스트와 contracts 상수가 같은 값**이어야 하고, 통합 테스트가 둘을 비교한다.
- 다중 어르신 전제: 어르신을 가리키는 인자는 `p_parent uuid`. "가족 첫 어르신" 같은 암묵 대상 금지(호환 필드는 기한을 적고 남긴다).
- 하위 호환: 배포된 클라이언트가 부르는 RPC의 인자 제거·의미 변경 금지. 바꿔야 하면 새 이름(`_v2` 대신 의미 있는 새 이름) 추가 → 클라이언트 전환 → 다음 릴리스에서 제거.
- 관리자용(백오피스)은 `admin_` 접두 + `is_admin()` 검사 + 감사 기록. 앱용 RPC를 관리자 권한으로 재사용하지 않는다.
- 콘텐츠 선택은 개인 속성을 쓰지 않는다: `parent_title`·호칭·성별·나이·지역·고른 답으로 사진·질문을 고르지 않는다. 빌드 2부터 허용되는 입력은 날짜(계절)와 어르신 본인이 고른 사진 취향 한 값뿐(개인화 회의 2026-11-17-personalization/SUMMARY.md).

## 5. 계약 변경 절차 (서버 → 계약 → 클라이언트)
1. 서버 줄: 마이그레이션 + pgTAP(권한·실패 reason 포함) 작성, `docs/team/dev-server-notes.md`에 RPC 시그니처·반환 예시 기록.
2. `supabase gen types typescript --local > supabase/types/database.gen.ts` 재생성·커밋(리드).
3. contracts: 반환 타입 + 런타임 검증 + reason 목록 갱신(서버 커밋 다음 커밋).
4. 클라이언트: `realApi`가 contracts로 검증, `fakeApi`도 같은 타입. 통합 테스트(`app/__integration__`)에 새 RPC 1건 이상.
- 서버가 아직 없을 때 앱이 먼저 가야 하면 **"가정 계약"을 contracts 파일 하나에만** 적고 `// ASSUMED(0020)` 표시, 서버 확정 시 그 파일만 고친다. 앱 `types.ts`·`fakeApi`에 흩어 쓰지 않는다.

## 6. 문구·토큰
- 문구 원본은 `docs/team/copy.ko.json` 하나. 앱 사본은 `scripts/sync-copy.sh`로만 갱신, 테스트가 두 파일 동일성 검사. 병렬 줄은 **원본만** 고치고 사본은 동기화.
- 서버 reason → 문구 변환은 클라이언트(copy)에서. contracts는 copy를 import하지 않는다(지금 `types.ts → copy` 역방향 의존 정리 대상).
- 색·크기는 `ui/tokens` 역할 이름만. 화면에 헥스·숫자 크기 직접 금지(외부 브랜드 색은 `brand`).

## 7. 상태·내비게이션
- 서버 상태의 진실은 서버. 화면 상태는 서버 응답 후에만 갱신(낙관적 갱신은 되돌리기 경로가 있을 때만).
- 전역 상태는 `SessionContext` 하나를 키우지 말고 관심사별 Provider(오늘 코스, 자녀 가족, 토스트)로 나눈다. 새 전역 값은 리뷰에서 근거 필요.
- 화면 이동은 내비 파라미터 타입(`navigation/types.ts`)으로만. 화면끼리 직접 import 금지.

## 8. 테스트 구조
| 층 | 위치 | 언제 |
|---|---|---|
| 순수 로직 단위 | `app/__tests__/<logic>.test.ts` | 모든 `*Logic.ts`·판정 함수 |
| 화면(fake API) | `app/__tests__/<screen>.test.tsx` | 화면 추가·변경 |
| 계약·통합(로컬 서버) | `app/__integration__/` | RPC 추가·변경(반환을 contracts 검증기로 통과) |
| 서버 | `supabase/tests/*.test.sql`(pgTAP) | 모든 마이그레이션(권한·RLS·reason) |
- 테스트 파일은 기능 이름으로(`bReview`, `qaP1P3` 같은 리뷰 회차 이름 금지 — 새로 만들 때부터).

## 9. 병렬 줄 합치기 전 체크리스트 (리뷰어가 확인)
- [ ] main 최신으로 rebase 후 `tsc --noEmit`, `npm run lint`, `npm test`, (서버 관련) pgTAP·통합 테스트 결과 첨부
- [ ] features → app, 기능 → 기능 import를 새로 만들지 않았다
- [ ] `ui/`에 같은 역할의 컴포넌트가 이미 있지 않다(Toast·Sheet·Dialog 중복 확인)
- [ ] 계약을 바꿨다면 5절 순서, 가정 계약은 contracts 한 곳 + `ASSUMED` 표시
- [ ] 서버 키 목록·reason과 앱 상수가 글자까지 같다
- [ ] 문구는 원본만 고치고 사본 동기화, 토큰 하드코딩 없음
- [ ] 마이그레이션 번호가 대장 순서이고 down·pgTAP이 짝지어 있다
- [ ] 공유 파일(DECISIONS.md, 루트 scripts, `.gitignore`)은 리드에게 넘겼다(줄 브랜치에서 직접 수정 금지)
- [ ] 다중 어르신·iOS·토스에서 깨질 가정(첫 어르신 고정, Android 전용 API, RN 전용 코드의 contracts 유입)이 없다
- [ ] 인증·데이터 저장 변경은 /code-review xhigh, 나머지 high

## 10. 금지 패턴
- features에서 `app/` import, 기능 간 import, 화면 간 직접 import
- `realApi` 밖 supabase-js 호출, `data as X` 단언만으로 서버 응답 신뢰(검증기 통과 필수)
  - 예외 1곳: `app/src/dev`(staging·local 개발자 메뉴, production 번들에서 Metro 가 제외)는 auth 세션 조작(getSession·setSession·signInWithPassword·_removeSession)만 직접 한다. 데이터 조회·쓰기는 Api 로.
- 계약 타입을 클라이언트마다 손으로 따로 쓰기, 서버 문자열 상수를 앱에 오타 가능한 리터럴로 복제
- 문구 원본·사본 동시 수기 편집, 화면 안 하드코딩 문구·헥스 색
- 마이그레이션 번호 예약·건너뛰기, 이미 원격에 간 마이그레이션 수정(새 마이그레이션으로 고친다)
- 줄 브랜치에서 `db reset`·원격 push·DECISIONS 수정, 비밀값 커밋
