# PR #70 리뷰 — 개발자 메뉴 '오늘 코스 다시 하기(테스트 가족만)' — 2026-11-19

- 대상: `l2v4-dev-reset-today` 596b37b. main 대비 4파일이다.
  - `src/dev/devResetToday.ts`(새 파일)
  - `src/dev/DevMenuHost.tsx`
  - `__tests__/devResetToday.test.tsx`
  - `__integration__/devMenu.test.ts`
- 서버: 0051 `dev_reset_today()`(어르신 본인, 스위치 `server_flags.dev_reset_enabled`, 테스터 가족 `families.is_test`, 오늘 KST의 answers·daily_sessions만 지움, 감사 행)
- 리뷰어는 작성자가 아니고 코드를 고치지 않았다. 에뮬레이터·원격 DB는 쓰지 않았다.

## 실행 결과
- `npx tsc --noEmit`: exit 0
- `npx eslint src/dev __tests__/devResetToday.test.tsx __integration__/devMenu.test.ts`: 경고·오류 0
- `npx jest devResetToday devMenu devMenuProduction`(`--maxWorkers=2 --cacheDirectory <scratchpad>`): **3 suites / 40 tests 통과**
- release 번들 검사: `scripts/check-dev-menu-bundle.sh`를 scratchpad에 복사해 표식에 `dev_reset_today|not_test_family`를 더하고, 번들마다 `dev_reset_today` 개수를 세도록 고쳐 돌렸다. 작업 트리는 건드리지 않는다.
  - **production 번들 `dev_reset_today` 0개, staging 1개**
  - 기존 검사(테스트 계정·이메일 없음, production에 개발자 메뉴 없음)도 통과했다.
- 통합 테스트(`__integration__`, 로컬 Supabase 필요)는 돌리지 않았다. 내용만 읽었다: 자녀 parent_required, 시드 없는 DB의 disabled, 테스터 가족 표시 뒤 sessions 1 → 오늘 단계 0.

## 판정
**통과.** 높음·중간은 없다. 낮음은 메뉴 안내 문구와 표시 정리 수준이다.

## 확인
- **production 번들에서 완전히 빠지는가: 예.**
  - `devResetToday.ts`를 import하는 곳은 `DevMenuHost.tsx` 하나다(`grep`). `metroDevMenu.js`는 APP_ENV가 staging·local이 아니면 `DevMenuHost.tsx`를 `DevMenuHost.stub.tsx`로 바꾸므로(fail-closed), 구현과 함께 이 파일도 번들에 들어가지 않는다.
  - 버튼 문구, 거절 문구, RPC 이름 모두 production 번들에 없다(위 번들 검사).
  - `getSupabase`는 함수 안에서 `require`로 부르므로, stub 쪽에 의존성을 남기지 않는다.
  - 서버도 production에서는 스위치 행이 없어(마이그레이션이 행을 넣지 않음) `disabled`다. 두 겹으로 막혀 있다.
- **거절 사유 표시: 맞다.**
  - `disabled`·`not_test_family`는 응답 본문의 reason으로, `parent_required`는 예외(P0001 + message)로 오고, 각각 한 줄로 보인다.
  - 그 밖의 오류·예외·모르는 사유는 '실패했어요'로 보이고 내용은 보여 주지 않는다.
  - 거절되면 앱을 다시 시작하지 않는다.
  - 문구는 기존 메뉴 패턴과 같다(굵은 글씨, live region, 메뉴 아래쪽 msg 줄).
- **성공 뒤 다시 시작했을 때 로컬 상태와 서버가 맞는가: 맞다(연결된 어르신 기준).**
  - `restart(role)`은 appKey를 올려 AppRoot를 다시 마운트한다. 코스 홈이 `start_today`·`getTodayContent`를 다시 부르므로 오늘 단계는 서버 값(0단계)으로 시작한다.
  - 도장: 연결된 기기는 `useWeekStamps`가 로컬 도장을 지우고 `getWeekStamps`(daily_sessions)만 쓴다. 오늘 daily_sessions가 지워졌으므로 오늘 도장도 빠진다. 연속 일수(`parent_streak`)도 daily_sessions로 계산되므로 맞다.
  - 콘텐츠 커서는 그대로이고(0051 주석), 같은 날 같은 콘텐츠로 다시 시작한다.
  - record_session_step에는 완료 때 알림·트리거가 없어서, 다시 마쳐도 중복 알림이 생기지 않는다.
- **자녀 계정에서 누르면:** 서버가 `parent_required`를 던지고 메뉴에 '어르신으로 전환한 뒤 눌러 주세요'가 보인다. 앱 상태는 그대로이고, 통합 테스트로도 확인했다.

## 낮음
- L1. 기기 쪽 '한 번만' 기록은 되돌리지 않는다.
  - P7 첫 완료 음악 권유(`pref_bgm_offered`·`pref_p7_first_done_day`), P4 방문 수(`pref_p4_visit_day`), `pref_evt_once_*` 이벤트가 그대로 남는다.
  - 그래서 "처음 마칠 때"에만 나오는 화면·이벤트는 다시 하기로 재현되지 않는다. 서버 기록과 어긋나는 것은 아니지만, QA가 혼동하지 않게 `serverResetHint`에 "기기의 한 번만 안내(음악 권유 등)는 그대로"를 한 줄 더할 것.
  - 필요하면 `prefs`의 해당 키를 함께 지우는 별도 버튼을 둔다.
- L2. 연결 전 어르신(프로필 없음)이나 로그인 안 됨에서도 서버는 `parent_required`를 준다. 이때 '어르신으로 전환한 뒤'라는 안내는 원인과 다르다. 연결 전 기기의 코스는 로컬(미연결 도장)이라 이 버튼 대상이 아니다. 문구를 '연결된 어르신 계정에서만 돼요'로 넓힐 것.
- L3. 버튼은 역할과 상관없이(자녀일 때도) 보인다. 서버가 막으므로 안전하다. 다만 지금 역할을 알면(`role === 'child'`) 버튼을 비활성 + 안내로 두는 편이 덜 헷갈린다.
- L4. 성공하면 지운 개수(`sessions`·`answers`)를 보여 주지 않고 바로 다시 시작한다. 지울 것이 없었을 때(0·0)도 같은 모습이다. QA 기록용으로 다시 시작 전 토스트 한 줄을 고려할 것(선택).
