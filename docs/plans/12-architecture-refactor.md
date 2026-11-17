# 12. 아키텍처 리팩터링 계획 (아키텍트, 2026-11-17 · 계획만)

근거: DECISIONS "품질·확장성 원칙", `docs/team/ARCHITECTURE.md`, 감사 `docs/team/reviews/2026-11-17-architecture-audit.md`. 시간은 모두 **추정**.
원칙: ① 병렬 줄이 고치는 파일은 그 줄이 합쳐질 때까지 건드리지 않는다(새 파일 추가만). ② 단계마다 `tsc --noEmit`·lint·`npm test`(+ 해당 시 pgTAP·통합) 초록에서만 커밋. ③ 이동은 동작 변경 없이, 동작 변경은 이동과 다른 커밋.

## 0단계 — 지금, 병렬 줄에 알림 (코드 변경 없음, 0.5h)
- 응원 계약 불일치 정리: 서버 0020 `send_cheer(p_parent, p_key)` 키 `thanks_always` vs 자녀 줄 `sendCheer(key)` 키 `always_thanks`(어르신 지정 없음). **서버 값이 기준**, 자녀·P8 줄은 가정 계약을 한 파일(`app/src/api/contract/cheers.ts`, ASSUMED)로 모은다.
- Toast·Sheet 중복: U0 줄(`ui/Toast.tsx` ToastProvider, 6000ms / `ui/BottomSheet.tsx`)을 표준으로, 자녀 줄의 `ui/Toast.tsx`(3000ms)·`ui/Sheet.tsx`는 합치기 전 제거하고 U0 것을 쓴다. 시간 값은 디자인 명세로 확정.
- 마이그레이션 번호: 푸시용 예정 번호 0024~0025는 쓰지 않고 **0028부터** 발급(0026·0027이 먼저 원격에 가면 0024는 `db push` 거부). 10·11 문서의 번호 정정(리드).
- 문구: 줄 브랜치는 `docs/team/copy.ko.json` 원본만 고치고, 사본은 합칠 때 리드가 동기화.

## 1단계 — 새 파일만 추가(병렬 줄과 충돌 없음, 2~3h)
| # | 작업 | 안전장치 | 추정 |
|---|---|---|---|
| 1-1 | `scripts/sync-copy.sh` + `__tests__/copySync.test.ts`(원본=사본 바이트 비교) | 테스트가 어긋남을 잡음 | 0.5h |
| 1-2 | `scripts/gen-types.sh`: `supabase gen types typescript --local > supabase/types/database.gen.ts`, `--check` 모드(재생성 diff ≠ 0이면 실패) | 서버 줄 합친 뒤 첫 생성 | 0.5~1h |
| 1-3 | `app/.eslintrc.js`에 `no-restricted-imports`(features→app, 기능→기능, ui→copy/api) **warn** | 현재 위반 수를 기준선으로 기록 | 0.5h |
| 1-4 | `app/src/api/contract/` 뼈대 + `zod` 도입 결정(RN·Vite·Next 공통 동작, 번들 영향 확인) | 의존성 추가는 리드 승인 | 1h |

## 2단계 — 병렬 줄 합치기 순서(충돌 최소)
1. U0 공용 컴포넌트(ui 새 파일만) → 2. 서버 0019~0027(supabase만, pgTAP 통과 + 1-2 생성물) → 3. 자녀 화면(U0 컴포넌트로 교체, 응원·호칭 계약을 서버 실제 시그니처로) → 4. P6~P8(응원 수신 계약을 0020 `get_my_cheers`·`mark_cheers_read`에 맞춤) → 5. 환경 분리(App.tsx·config·selectApi; DECISIONS 수정분은 리드가 따로 반영).
- 각 합치기 전 ARCHITECTURE §9 체크리스트 + /code-review(인증·저장 xhigh).

## 3단계 — 계약 계층(모든 줄 합친 직후, 5~6h)
| # | 작업 | 안전장치 | 추정 |
|---|---|---|---|
| 3-1 | `features/types.ts`의 계약 타입을 `api/contract/<도메인>.ts`(family·invite·content·session·child·cheers·account)로 옮기고 `types.ts`는 재수출만 | tsc 0 오류, 테스트 무변경 통과 | 1.5h |
| 3-2 | contract가 copy를 import하지 않게: `FailReason`을 contract에, copy가 contract를 참조 | tsc | 0.5h |
| 3-3 | `realApi`의 `data as X`를 zod 검증으로 교체(실패 시 `ServerError('contract_mismatch')`) | 기존 jest + 통합 테스트 | 2h |
| 3-4 | `__integration__/contract.test.ts`: 모든 RPC 응답을 검증기로 통과 + 서버 키 목록(응원·이벤트·호칭)과 앱 상수 비교 | 로컬 서버 | 1.5h |

## 4단계 — 레이어 정리(짧은 동결 창, 각 이동 = 커밋 1개, 4~5h)
- 4-1 `app/session`·`app/splash` 훅 → `src/state/`(경로 재수출 1회 유지 후 제거) 1h
- 4-2 `BackBar` → `ui/`, 내비 파라미터 타입 → `src/navigation/types.ts`(Stack 파일이 이걸 import) 1h
- 4-3 `errorMessage`(course/useFinishStep) → `shared/errors.ts`, `TextLink`·`CodeShow`·`DeleteLink` → `ui/` 또는 `shared/` 1h
- 4-4 `features/{types,fakeApi,realApi,selectApi,socialAuth}` → `src/api/`, `realApi`를 도메인별 파일로 분할(조립은 `createRealApi`) 1.5h
- 4-5 lint 규칙 warn → **error**. 이후 위반은 CI(로컬 pre-commit)에서 막힘 0.5h
- 동결 창: 앱 줄은 이 시간 동안 새 커밋 대신 rebase 대기(반나절). 일정은 리드가 공지.

## 5단계 — 확장 시점에 할 것(지금 하지 않음)
| 신호 | 작업 | 추정 |
|---|---|---|
| 토스 미니앱이 실제 RPC 호출 시작 | 루트 npm workspaces, `packages/contracts`(3단계 폴더 그대로 이동)·`packages/copy`·`packages/tokens`(JSON→TS 생성), Metro `watchFolders`·Vite alias 검증 | 4~6h |
| 백오피스 착수(11) | `admin/`(Next.js) + `admin_` RPC·`is_admin()`·감사 테이블, contracts 재사용, service_role은 서버 쪽에서만 | 별도 계획 |
| iOS 빌드 | Android 전용 코드(`Platform.OS`·네이티브 모듈) 목록화, 환경 설정(xcconfig) 09와 같은 규칙 | 3~4h |
| 유료 구독 | `entitlements` 테이블 + `my_entitlements()` RPC, 클라이언트는 권한만 읽음(스토어별 영수증 검증은 Edge Function) | 별도 계획 |
| 테스트 이름 정리 | `bReview`·`qaP1P3` 등 회차 이름 → 기능 이름(내용 무변경) | 1h |

## 완료 기준
- lint 레이어 규칙 error 0, contract 검증기 통과율 100%(통합), 문구·토큰·DB 타입 동기 검사 3종이 `npm test`/스크립트에 포함
- 합계(1~4단계) 약 12~15h, 5단계는 신호가 올 때 별도 승인
