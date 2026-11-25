/* eslint-env node */
// 잠자기 방지를 풀고, 실행 중 맥이 잠들었으면 경고만 한다(대기열 65, testUtils/keepAwake.js)
const {sleepWarning} = require('./keepAwake');

module.exports = async function globalTeardown() {
  global.__jestKeepAwake?.kill();
  const watch = global.__jestSleepWatch;
  if (!watch) {
    return;
  }
  clearInterval(watch.timer);
  watch.tracker.tick(Date.now());
  const warning = sleepWarning(watch.tracker.sleptMs());
  if (warning) {
    process.stderr.write(warning);
  }
};
