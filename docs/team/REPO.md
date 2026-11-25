# 저장소 구조와 분리 규칙 (2026-11-17 확정)

결정: **하나의 저장소(모노레포)를 유지하되, 영역을 엄격히 분리해서 작업한다.** 분리 저장소는 필요해질 때 `git subtree split`로 이력을 유지한 채 뺀다.

## 영역과 소유
| 영역 | 내용 | 소유 | 다른 영역이 건드릴 수 있나 |
|---|---|---|---|
| `supabase/` | 마이그레이션, RLS, RPC, pgTAP, 시드, down 파일 | 리드(서버) | 읽기만. 요청은 리드에게 |
| `app/` | React Native 앱, 앱 문구 사본, 통합 테스트 | 앱 개발 에이전트 | 서버·문서는 읽기만 |
| `toss/` | 토스 미니앱(WebView SDK, React 18, Vite). `npm run build`로 `.ait` 생성(커밋 제외) | 토스 담당(앱 개발 에이전트가 맡을 수 있음, 서버 변경은 리드에게 요청) | 서버·앱은 읽기만 |
| `design-system/` | 토큰·SVG 에셋·컴포넌트 명세 | 디자인팀(담당별 하위 폴더) | 읽기만 |
| `site/` | 정적 안내 페이지(방침·삭제 안내) | 정책 담당 | 값 입력은 사용자 |
| `docs/`, `SPEC.md`, `DECISIONS.md`, `TODO.md` | 계획·결정·팀 문서 | 리드(문서별 역할 담당은 `docs/team/<역할>.md`). DECISIONS.md 는 결정 모음 PR로만(작업 PR은 본문 `## 결정` 절) | 역할별 자기 파일만 |
| 루트(`package.json`, `.gitignore`, `scripts/`) | 도구 설정 | 리드 | 변경 시 알림 |

## 서버와 앱의 계약(인터페이스)
- 서버와 앱은 **RPC 이름, 인자, 반환 JSON 형태**로만 이어진다. 앱은 테이블을 직접 읽는 것(콘텐츠 읽기 등) 외에 서버 내부 구조(컬럼, 함수 본문)에 기대지 않는다.
- 계약이 바뀌면(필드 추가·변경) 같은 날 **서버 → 앱 순서**로 반영하고, `app/__integration__` 통합 테스트가 실제 서버 호출로 깨짐을 잡는다.
- 현재 계약: `create_family`, `issue_invite_code`, `redeem_invite_code`, `give_consent`, `save_answer`, `get_today_content`, `record_session_step`, `delete_my_account`(서버 마이그레이션 0003~0010과 pgTAP이 근거).

## 커밋 규칙
- **커밋은 영역 단위로 쪼갠다.** 한 커밋에 `supabase/`와 `app/`를 섞지 않는다(계약 변경 때만 두 커밋을 연속으로).
- 커밋 메시지 접두사: `feat(supabase)`, `feat(app)`, `fix(supabase)`, `docs`, `chore`, `test(...)`.
- 검증이 실패한 상태의 영역은 커밋하지 않는다(서버=pgTAP, 앱=tsc·lint·jest·통합 테스트).

## 공유 자원 충돌 방지
- 로컬 Supabase DB는 하나를 같이 쓴다. **`db reset`, `stop`, `start`는 리드만 실행**한다. 앱 개발 쪽은 `npx supabase status -o env`만 허용.
- 통합 테스트는 매번 고유 데이터를 만들고 서비스 키 없이 돈다. 테스트가 남긴 데이터는 리드가 `db reset`으로 정리한다(시드는 reset이 자동 적용).
- 비밀값(`config.local.ts`, 키, keystore)은 어떤 영역에서도 커밋하지 않는다(루트 `.gitignore`).

## 분리해야 할 때의 신호와 방법
- 신호: 영역별 배포 주기·담당자가 갈릴 때, 접근 권한을 나눠야 할 때, `site/`를 별도 호스팅에 올릴 때.
- 방법: `git subtree split --prefix=<영역> -b <영역>-only`로 이력을 유지한 채 분리한다. 원격 저장소 생성은 사용자 계정이 필요하다.

## 열려 있는 것
- 원격 저장소(GitHub 등)가 없다. 현재 백업은 로컬뿐이라 **비공개 저장소를 하나 만들어 푸시**하는 것을 권한다(TODO).
