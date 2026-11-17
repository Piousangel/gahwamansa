# 아키텍처 감사 (아키텍트, 2026-11-17 · 코드 수정 없음)

대상: main `3c4170c` + worktree 5줄(아래 §4). 규칙은 `docs/team/ARCHITECTURE.md`, 실행은 `docs/plans/12-architecture-refactor.md`.
심각도: **높음** = 확장(iOS·토스·백오피스·다중 어르신·구독) 또는 병렬 합치기에서 조용히 깨짐, **중간** = 비용이 쌓임, **낮음** = 정리.

## 1. 현 구조 감사
| # | 영역 | 지금 | 확장 시 깨지는 것 | 심각도 |
|---|---|---|---|---|
| A1 | 계약(API 타입) | `app/src/features/types.ts`에 손으로 쓴 타입, `realApi`가 `data as X` 단언(검증 없음). 서버 반환은 거의 `jsonb`라 생성 타입도 `Json`일 뿐 | 클라이언트가 늘면 타입을 각자 복제 → 글자 하나 차이로 조용한 오작동. **이미 발생**: 응원 키 `always_thanks`(앱) vs `thanks_always`(서버 0020), `sendCheer(key)` vs `send_cheer(p_parent, p_key)` | 높음 |
| A2 | 계약 → 문구 역의존 | `types.ts`가 `copy/copy`의 `FailReason`을 import | 토스·백오피스가 계약을 가져가면 RN 문구 파일까지 끌려감 | 중간 |
| A3 | 레이어 경계 | features → app import 40여 곳(`useSession` 15, `BackBar` 11, `ParentStack` 타입 7, `splash` 5). app/ParentStack ↔ features 화면이 서로 import(타입 순환) | 내비 구조(iOS·탭 추가) 바꿀 때 모든 화면 수정, 화면 단위 테스트 어려움 | 높음 |
| A4 | 기능 간 결합 | `errorMessage`가 `course/useFinishStep`에 있고 6개 기능이 가져감. `TextLink`·`CodeShow`·`DeleteLink`도 기능 간 공유 | 코스 기능 수정이 계정·자녀 화면을 깨뜨림 | 중간 |
| A5 | 화면 비대화 | 최대 `realApi` 286, `CourseHome` 268, P6 줄 `KeyboardStep` 299줄. 아직 관리 가능 | `realApi` 하나에 모든 도메인 → 줄마다 같은 파일 충돌 | 중간 |
| A6 | 상태 | `SessionContext` 하나에 api·오늘 코스·동의·삭제·역할 초기화가 모임 | 다중 어르신·자녀 다가족·구독 권한이 같은 객체로 몰리면 재렌더·테스트 비용 증가 | 중간 |
| A7 | 문구 사본 | `docs/team/copy.ko.json`(원본) = `app/src/copy/copy.ko.json`(사본), 지금 동일하나 **동기 검사 테스트 없음**. 자녀·P6 줄이 두 파일을 각각 수기 편집 중 | JSON 합치기 충돌 + 한쪽만 반영 | 높음(병렬 중) |
| A8 | 디자인 토큰 | `design-system/tokens-v3.json` ↔ `ui/tokens.ts`, `designSystem.test.tsx`가 값 비교 | 토스(CSS)·백오피스에서 쓸 출력이 없음(지금은 문제 아님) | 낮음 |
| A9 | RPC 패턴 | definer + `search_path=''` + revoke/grant 일관, 서버 전용 헬퍼 권한 회수 양호. 다만 reason 반환 방식이 섞임(`{ok:false,reason}` vs raise), 명명 혼재(`child_summary`, `my_week_stamps`, `set_parent_title_for`) | 새 클라이언트가 오류 처리 규칙을 RPC마다 다시 배움. 관리자 RPC 규칙 부재 | 중간 |
| A10 | RPC 버전 | 하위 호환 규칙 없음. 0019가 `child_summary` 반환에 필드 추가(호환 필드 유지)는 양호 | 스토어에 깔린 옛 앱이 깨지는 변경을 막을 장치 없음 | 중간(출시 후 높음) |
| A11 | 마이그레이션 번호 | 가짜 타임스탬프 연번, 0024~0025를 푸시용으로 **예약한 채** 0026·0027 작성 | 0026이 원격에 먼저 가면 나중의 0024는 `db push` 거부(`--include-all` 필요, 순서 꼬임) | 높음 |
| A12 | 시드 | `seed_content_14d.sql`가 `on conflict do update`로 게시 콘텐츠 덮어씀(11 기획이 지적, 0026이 불변 가드로 대응 중) | 환경별 시드 재적용 시 과거 답 의미 변경 | 중간(0026으로 해소 예정) |
| A13 | 테스트 구조 | 층(jest 화면·통합·pgTAP)은 좋음. 계약 검증 테스트 없음, 파일명이 리뷰 회차(`bReview`, `qaP1P3`) | 계약 드리프트를 서버·앱 각자 초록으로 통과 | 중간 |
| A14 | 환경·스크립트 | `App.tsx` `API_MODE` 하드코딩, `config.local.ts` 수동(환경 줄이 해결 중). 루트 `package.json` 빈 껍데기, 스크립트 진입점 없음 | staging/production 혼동, 새 사람이 실행 순서 모름 | 중간(환경 줄 합치면 낮음) |
| A15 | 작업 위생 | main 작업 트리에 미커밋 앱 변경 15파일(코스·연결·설정 화면) | worktree 줄과 같은 파일 → 누구 것인지 불명, 합치기 혼선 | 중간 |

## 2. 목표 구조와 시점
```
supabase/  migrations · down · tests · types/database.gen.ts(생성)
packages/  contracts(RPC 인자·반환 zod+TS, reason·키 목록) · copy(ko 문구 JSON만, 화면 로직 없음) · tokens(JSON→RN/CSS 출력)
app/       src/{app(조립), navigation, state, features/<기능>, shared, api(fake·real·select), ui, copy, lib}
toss/      웹 화면 + packages/*      admin/(Next.js, 예정) + packages/contracts + admin_ RPC
```
- **지금 꼭 할 것**(12 계획 0~4단계): 계약을 한 폴더(`app/src/api/contract/`)에 플랫폼 무관하게 모으고 런타임 검증, DB 타입 생성·검사, 문구 동기 테스트, 레이어 lint, features→app 의존 제거, 마이그레이션 번호 규칙. 이것들은 클라이언트가 하나여도 지금 드리프트를 막는다.
- **확장 시점에 할 것**: `packages/` + npm workspaces(토스가 실제로 서버를 부를 때), tokens CSS 출력(토스 UI 착수 때), `admin/`(백오피스 착수 때), 구독 `entitlements`(유료 기획 확정 때). 지금 하면 RN Metro 심볼릭 링크·lockfile 3개 재정비가 병렬 줄 전부와 충돌.
- 재사용 범위: 토스·백오피스는 **contracts·copy·tokens·순수 판정 로직**(예: 자판 판정 `keyboardMatch`, 코드 입력 로직)만. RN 화면·내비·네이티브 모듈은 공유하지 않는다. 백오피스는 앱 RPC가 아니라 `admin_` RPC + 감사 기록.
- `supabase gen types`의 한계: 함수 인자 타입은 정확하지만 `jsonb` 반환은 `Json`. 그래서 반환 형태는 contracts(zod)에 손으로 쓰고, **통합 테스트가 실제 서버 응답으로 검증**하는 것이 계약 문서의 실체가 된다(별도 문서 수기 관리보다 신뢰도 높음).

## 3. 과설계 경계
- 하지 않는다: GraphQL·OpenAPI 계층, 상태 라이브러리 교체(Redux/Zustand), 모노레포 빌드 도구(Nx·Turborepo), RPC `_v2` 일괄 버전 접미사. 지금 규모(RPC 20여 개, 클라이언트 1)에 비용 대비 이득 없음.
- 한다: 위 "지금 꼭 할 것"만. 총 12~15h 추정.

## 4. 진행 중 worktree 줄 점검 (main보다 9~10 커밋 뒤)
- **서버 0019~0027** (`worktree-agent-a42c228abb4d805d7`, 6커밋 + 0027 미커밋): RPC 권한 패턴·pgTAP 짝 양호. 위반: 0024~0025 예약 건너뛰기(A11). `set_parent_title_for` 신설로 호칭 RPC가 둘로 갈림(이름 규칙·폐기 계획 필요). `get_my_cheers`는 `{unread_count, ...}` 객체 반환 — P8 줄의 `Cheer[]` 가정과 형태 다름.
- **자녀 화면** (`worktree-agent-a65a1b92e80260723`, 1커밋 + 다수 미커밋): 서버보다 먼저 "가정 계약"을 `types.ts`·`fakeApi`·`realApi`에 흩어 씀 → 응원 키·인자 이미 서버와 불일치(A1). `ui/Toast.tsx`(3000ms)·`ui/Sheet.tsx`를 새로 만들어 U0 줄의 `Toast.tsx`(6000ms, Provider)·`BottomSheet.tsx`와 **같은 경로 충돌·역할 중복**. 문구 원본·사본 동시 수기 편집, `app/ChildChrome.tsx` 추가로 app 레이어 비대 가능성.
- **P6~P8** (`worktree-agent-aa7439cc051c2fc7f`, 4커밋 + 미커밋): `KeyboardStep` 299줄(판정은 `keyboardMatch.ts`로 분리·테스트 — 좋음). 미커밋으로 `types/fakeApi/realApi`에 응원 수신 계약을 자녀 줄과 **따로** 추가(같은 파일 세 개 충돌 예정). 문구 두 파일 동시 편집. features→app(`ParentStack` 타입·`BackBar`) 기존 패턴 그대로 확산.
- **공용 컴포넌트 U0** (`worktree-agent-afa278236a844b00d`, 5커밋 + Photo 미커밋): ui에 새 파일만, 테스트 동반 — 규칙에 가장 잘 맞음. 확인: `ui/`가 copy를 import하지 않는지, `a11y.ts`·`motion.ts`는 `lib`가 아닌 ui 범위로 둘지. 이 줄을 표준으로 먼저 합칠 것.
- **환경 분리** (`worktree-agent-a5a5f0982c953a055`, 커밋 0 · 전부 미커밋): `lib/env.ts` 우선순위·검증 설계 양호. 위반: 리드 소유 공유 파일(`DECISIONS.md`, `.gitignore`, 루트 `scripts/`)을 줄에서 직접 수정. `db-push.sh`가 `app/env/*.env`에서 서버 ref를 읽어 서버 도구가 앱 폴더에 의존(→ ref는 `supabase/`나 루트 `env/`로 옮길 것을 권고). 커밋이 없어 리뷰 단위 불명 — 영역별로 커밋 쪼개기 필요.
