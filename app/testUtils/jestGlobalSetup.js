/* eslint-env node */
// jest 주 프로세스에서 한 번: 맥이면 실행이 끝날 때까지 잠자기 방지 + 잠자기 감지 시작(대기열 65, testUtils/keepAwake.js)
const {spawn} = require('child_process');
const {keepAwakeCommand, createGapTracker} = require('./keepAwake');

module.exports = async function globalSetup() {
  // 감지는 모든 플랫폼에서(경고만, 실패로 만들지 않음). unref 라 jest 종료를 붙잡지 않는다
  const tracker = createGapTracker(Date.now());
  const timer = setInterval(() => tracker.tick(Date.now()), 1000);
  timer.unref();
  global.__jestSleepWatch = {tracker, timer};

  const c = keepAwakeCommand(process.platform, process.pid, process.env);
  if (!c) {
    return;
  }
  // caffeinate 를 못 띄워도 테스트는 그대로 돈다. 보호가 꺼졌다는 사실만 한 줄 알린다(리뷰: 조용히 삼키면 진단 불가)
  const report = e => process.stderr.write(`[잠자기 방지 꺼짐] ${c.cmd} 실행 실패: ${e?.message ?? e}\n`);
  try {
    const child = spawn(c.cmd, c.args, {stdio: 'ignore'});
    child.on('error', report);
    child.unref();
    global.__jestKeepAwake = child; // -w <jest pid> 라 jest 가 비정상 종료해도 caffeinate 는 스스로 끝난다
  } catch (e) {
    report(e);
  }
};
