/* eslint-env jest */
// 화면 단위 테스트는 앱 시작 스플래시(시작 대기·심볼 이동)가 끝난 상태에서 시작한다.
// 스플래시 자체는 __tests__/splash.test.tsx 가 resetSplash() 로 처음 상태를 만들어 검사한다.
const {finishBoot, finishFlight} = require('./src/app/splash');
const {coverQueue} = require('./src/ui/ds/coverQueue');

beforeEach(() => {
  finishBoot();
  finishFlight();
  // 덮개 큐(하루 하나, A8)는 앱 전체 하나 — 앞 테스트가 오늘 몫을 쓰면 다음 테스트의 덮개(N1 등)가 거절된다. 테스트마다 빈 기억으로
  let day = null;
  coverQueue.configure({load: async () => day, save: async d => void (day = d)});
});

// 가짜 시계를 쓴 테스트가 중간에 실패해도 다음 테스트에 가짜 시계가 남지 않게(부하 정리 2026-11-19: 실제 대기 → 가짜 시계 전환과 함께)
afterEach(() => {
  jest.useRealTimers();
});

// QA-13: waitFor 기본 대기(1초)가 부하에서 모자라 date-line 대기가 가끔 실패 → 5초로(testTimeout 20초 안)
// 부하 정리 2차(2026-11-19): 전체 2벌 동시(워커 8×2)에서 첫 화면 대기(historyScreen date-line·termsAgreement 동의 화면)가 5초를 넘음 → 10초.
// 조건이 맞는 즉시 끝나므로 통과하는 테스트는 느려지지 않는다. 테스트마다 따로 주던 {timeout: 3000~8000} 은 지웠다(기본이 더 길다).
require('@testing-library/react-native').configure({asyncUtilTimeout: 10000});
