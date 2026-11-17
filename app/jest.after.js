/* eslint-env jest */
// 화면 단위 테스트는 앱 시작 스플래시(시작 대기·심볼 이동)가 끝난 상태에서 시작한다.
// 스플래시 자체는 __tests__/splash.test.tsx 가 resetSplash() 로 처음 상태를 만들어 검사한다.
const {finishBoot, finishFlight} = require('./src/app/splash');

beforeEach(() => {
  finishBoot();
  finishFlight();
});
