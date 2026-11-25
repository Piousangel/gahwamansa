/* eslint-env node */
// jest 실행 동안 맥이 잠들지 않게 하고, 그래도 잠들었으면 끝에 알려 준다(대기열 65, 2026-11-26).
//
// 원인: 밤 루틴이 도는 맥은 DarkWake(약 45~60초) → 'Maintenance Sleep'(약 900~1000초)을 되풀이한다(pmset -g log).
// 이때 떠 있는 caffeinate -i(PreventUserIdleSystemSleep)는 유지보수 잠자기를 막지 못한다. jest 를 깨어 있는 짧은 창에서 시작하면
// 실행 중이던 스위트가 모두 같은 ~900초 동안 멈췄다가 깨어난 뒤 제한 시간(테스트 20초·waitFor 10초)을 넘겼다고 실패한다.
// 그 시간 Docker(OrbStack)가 무응답이었던 것도 맥이 자고 있었기 때문이다. 테스트 코드나 부하의 문제가 아니다.
//
// 막는 법: caffeinate -s(PreventSystemSleep) -i 를 jest 주 프로세스가 끝날 때까지(-w pid) 건다.
// 한계: -s 는 전원 연결 때만 듣는다(배터리면 -i 만 남아 유지보수 잠자기를 못 막음). jest 시작 전(설정·크롤링)과
// jest 밖 명령(supabase·빌드)은 덮지 않는다 — 그건 루틴의 caffeinate 를 -s 로 바꿔야 하고 리드가 판단한다.
// 경고는 globalTeardown 에서 찍으므로 jest 가 밖에서 죽으면(SIGKILL 등) 나오지 않는다. 끄려면 JEST_ALLOW_SLEEP=1.

const SLEEP_GAP_MS = 30000;
const TICK_MS = 1000;

/** 이 플랫폼에서 jest 동안 걸 잠자기 방지 명령. 맥이 아니거나 끄라고 했으면 null */
function keepAwakeCommand(platform, pid, env) {
  if (platform !== 'darwin' || env.JEST_ALLOW_SLEEP === '1') {
    return null;
  }
  return {cmd: '/usr/bin/caffeinate', args: ['-i', '-s', '-w', String(pid)]};
}

/**
 * 1초마다 부르는 tick 사이의 틈이 30초 이상이면 그만큼을 잠든 시간으로 더한다.
 * 벽시계·단조 시계 비교는 쓸 수 없다: 이 맥(Node 26)은 잠자는 동안 hrtime·performance.now 도 벽시계와 똑같이 흐른다
 * (11-26 실측: 942초 잠자기 뒤 wall 1490952ms·hr 1490955ms). 같은 이유로 깨어나면 20초 제한 타이머가 바로 울려 실패했다.
 */
function createGapTracker(startMs) {
  let last = startMs;
  let slept = 0;
  return {
    tick(nowMs) {
      const gap = nowMs - last;
      if (gap >= SLEEP_GAP_MS) {
        slept += gap - TICK_MS; // 원래 1초 간격은 뺀다
      }
      last = nowMs;
    },
    sleptMs: () => slept,
  };
}

/** 잠든 시간이 있으면 끝에 찍을 경고, 없으면 null */
function sleepWarning(ms) {
  if (!ms) {
    return null;
  }
  return (
    `\n[잠자기 감지] 이 jest 실행 중 약 ${Math.round(ms / 1000)}초 동안 jest 주 프로세스가 멈췄습니다(맥 잠자기 또는 --runInBand 의 긴 동기 작업). ` +
    '그 동안 돌던 스위트의 시간 초과 실패는 테스트 문제가 아닐 수 있습니다(대기열 65). ' +
    'pmset -g log | grep "Entering Sleep" 로 잠자기였는지 확인하고, 잠자기 방지가 걸린 상태(전원 연결)에서 다시 돌리세요.\n'
  );
}

module.exports = {keepAwakeCommand, createGapTracker, sleepWarning, SLEEP_GAP_MS, TICK_MS};
