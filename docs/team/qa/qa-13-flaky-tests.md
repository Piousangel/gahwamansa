# QA-13 불안정 테스트 — 준비와 1차 측정 (L6 QA, 2026-11-18)

- 대상(13 로드맵 QA-13): ① 소셜 로그인 1회차 실패(R-SL `2026-11-17-social-login-security.md:4·33`, 어느 테스트인지 못 잡음) ② P7 부하 시 `waitFor` 시간 초과(R-P7 L6, `2026-11-18-p7-motion-review.md:84·122`).
- 합격 기준(로드맵): **같은 커밋에서 20회 반복 실행 전부 초록**.
- 이미 반영된 것(사실): `app/jest.config.js`에 `testTimeout: 20000`(R-P7 재검토가 지적한 "기본 5초" 원인 제거).

## 1. 1차 측정 (11-18 16:50~17:05, 공유 작업 트리 main, 10회)
- 명령: `cd app && npx jest --testPathIgnorePatterns __integration__ --maxWorkers=2 --json --outputFile=<scratch>/runN.json`
- 기기 부하: load average 8~43(다른 에이전트 병렬 작업 중), CPU 12개. 1회 약 57초.

| 결과 | 회차 | 원인(사실) |
|---|---|---|
| 전부 통과 | 1·2·3·6·7·10 (6회, suites 83→87, tests 788→861) | — |
| 실패 | 4·5·8·9 (4회) | **실행 중 같은 작업 트리에서 리드가 병합 중**: `src/features/child/ChildSettings.tsx`에 충돌 표식(`<<<<<<< HEAD`)이 있는 순간을 읽어 40여 suite가 파싱 실패, `layerBaseline` 위반 수 59↔56 불일치(병합 중간 상태), `devMenu` 3건 같은 파싱 실패. 같은 시각 커밋: `c988af2`(16:56)·`96764d2`(17:02) 등 |
| 판단 보류 1건 | 5회차 `photoZoom.test.tsx` "보기 전용(B2) P4 에서도 같은 크게 보기…" — `testID: date-line` 없음 | 같은 회차가 병합 중이었고 `date-line`은 l2 다듬기 병합(16:56)과 관련된 것으로 보임(추정). 격리 실행으로 재확인 필요 |

- **결론(1차)**: 이번 실패 4회는 불안정 테스트가 아니라 **공유 작업 트리가 실행 중에 바뀐 것**이다. 병합이 없던 6회는 부하 36에서도 전부 통과했다. 소셜(`socialLogin`·`socialSecurity`)과 `p7Motion` 고유 실패는 0건이었다(파싱 실패 제외).
- 느린 suite(최대/평균 초): layerBaseline 45.2/11.1, p7Motion 42.8/8.7, keyboardStep 20.5/12.2, childScreensV3 20.4/13.6, flow 20.0/5.5, childUx 18.6/9.2 — `testTimeout 20000`에 근접한 것은 없음(suite 시간은 테스트 여러 개의 합).

## 2. 본 측정 절차 (다음 단계, 고정 커밋·격리)
1. 격리: `git worktree add ../bumo-qa13 <고정 커밋>` → `cd ../bumo-qa13/app && ln -s ../../bumo-jasik/app/node_modules node_modules`(R-DM 리뷰가 쓴 방식). 공유 트리에서는 돌리지 않는다.
2. 20회 반복(부하 있음 그대로 — 실제 병렬 개발 조건):
   ```
   for i in $(seq 1 20); do npx jest --testPathIgnorePatterns __integration__ --maxWorkers=2 --json --outputFile=$OUT/run$i.json >/dev/null 2>&1; echo "run$i $? $(uptime)"; done
   ```
3. 집계: 실패 테스트 이름별 횟수, suite 최대 시간(1차와 같은 스크립트, 결과 문서에 첨부).
4. 대상 집중 반복: `npx jest socialLogin socialSecurity p7Motion flow keyboardStep courseHomeV4 --maxWorkers=2` 50회. `--runInBand` 1회로 순서 의존 여부 비교.
5. 실패가 나오면: 그 테스트 단독 30회 + `--seed` 기록(jest 30+ `--randomize` 쓰지 않음, 실행 순서 고정 유지), 원인 분류 = 타이머(실제 연출 시간) / 목 누수(테스트 간 상태) / 비동기 setState(언마운트 뒤) / 환경(병합·캐시).
6. 끝나면 `git worktree remove ../bumo-qa13`.

## 3. 리드에게(결정 필요)
1. **공유 작업 트리에서 테스트를 돌리는 리뷰·검증은 병합 창과 겹치면 거짓 실패가 난다** — 리뷰어·QA 검증은 고정 커밋 worktree에서 돌린다는 규칙을 OPERATING/§3.5에 한 줄(제안).
2. 본 측정(§2)은 QA가 다음 차례에 수행, 고정 커밋은 다음 병합 창 직후의 main.
3. R-SL "1회차 실패"는 재현 근거가 없다 — §2에서 20회 0건이면 닫는다.

## 4. 본 측정 결과 (11-18 저녁, 고정 커밋 `15f3497` worktree, `--cacheDirectory` 별도, 같은 node_modules 링크)
- 설정: worktree는 scratchpad에 만들고 끝난 뒤 `git worktree remove`. gitignore 파일 `config.local.ts`·`env.generated.ts`는 main 트리 것을 복사(같은 조건). load average 5~45(다른 에이전트 병행).

| 묶음 | 회수 | 결과 |
|---|---|---|
| 전체(`--testPathIgnorePatterns __integration__ --maxWorkers=2`, 87 suites·861 tests) | 20 | **19회 전부 통과, 1회(run12, load 34) 1건 실패** |
| 대상 집중(socialLogin·socialSecurity·p7Motion·flow·keyboardStep·courseHomeV4·photoZoom, 108 tests) | 30 | 108 tests **30회 모두 통과**. 종료 코드 1은 `flow` 패턴이 통합 테스트 `childFlow.test.ts`까지 잡아 config 검사로 실패한 것(측정 실수, 단위 테스트와 무관) |

### 확정한 불안정 테스트
| 테스트 | 증상 | 원인(근거) |
|---|---|---|
| `cReview.test.tsx` "real 시작(역할 지정 parent): 연결된 기기는 whoAmI 로 코스 홈" | `Unable to find an element with testID: date-line`, 1321ms | `await waitFor(() => screen.getByTestId('date-line'))`(27행)가 Testing Library 기본 `waitFor` 제한 **1000ms**에 걸림. `jest.config.js testTimeout 20000`은 테스트 전체 제한이라 이 1초에는 영향 없음. 1차 측정 5회차 photoZoom 실패도 같은 `date-line` 1초 증상 |
| 같은 패턴을 쓰는 파일 | — | `date-line` 대기를 쓰는 테스트 파일 **23개**(grep). 전역 `configure({asyncUtilTimeout})` 없음(jest.setup·after 확인) → 부하가 크면 어느 파일이든 같은 식으로 실패 가능 |

### 후보 판정
- **photoZoom "사진이 열리면 폴라로이드 전체가 버튼…"(L4 보고: 부하 중 15초 시간 초과 1회)**: 이번 50회(전체 20 + 대상 30) **모두 통과**, 실행 시간 중앙 115ms·최대 1951ms. 15초 초과는 재현 못 함. 같은 파일 33·125·139행이 `date-line` 1초 대기를 써서 위 원인과 같은 계열일 가능성이 있음(추정) — 아래 수정 뒤 재측정으로 닫는다.
- **p7Motion·소셜(R-SL 1회차)**: 50회 실패 0 → **닫음 제안**(testTimeout 20000 반영 이후 재현 없음).
- keyboardStep은 suite 최대 60.8초(대상 묶음)·24.4초(전체)로 가장 느림. 실패는 없음, 관찰 유지.

### 수정 제안 (테스트 코드 = L4 몫, QA는 수정하지 않음)
1. `app/jest.after.js`에 `configure({asyncUtilTimeout: 5000})`(@testing-library/react-native) 한 줄 — 23개 파일 일괄. 또는 공용 헬퍼 `waitForCourseHome()`에 `{timeout: 5000}`.
2. 대상 반복 명령은 `--testPathIgnorePatterns __integration__`를 꼭 붙인다(이번 측정 실수 재발 방지).
3. 수정 뒤 같은 절차로 20회 재측정 → 0건이면 QA-13 완료.
