/* eslint-env jest */
// 화면 단위 테스트는 앱 시작 스플래시(시작 대기·심볼 이동)가 끝난 상태에서 시작한다.
// 스플래시 자체는 __tests__/splash.test.tsx 가 resetSplash() 로 처음 상태를 만들어 검사한다.
const {finishBoot, finishFlight} = require('./src/app/splash');

beforeEach(() => {
  finishBoot();
  finishFlight();
});

// 가짜 시계를 쓴 테스트가 중간에 실패해도 다음 테스트에 가짜 시계가 남지 않게(부하 정리 2026-11-19: 실제 대기 → 가짜 시계 전환과 함께)
afterEach(() => {
  jest.useRealTimers();
});

// QA-13: waitFor 기본 대기(1초)가 부하에서 모자라 date-line 대기가 가끔 실패 → 5초로(testTimeout 20초 안)
require('@testing-library/react-native').configure({asyncUtilTimeout: 5000});
