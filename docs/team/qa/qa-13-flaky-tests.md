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
