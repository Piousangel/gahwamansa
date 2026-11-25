// 대기열 65: 맥 유지보수 잠자기(~900초) 동안 jest 스위트가 한꺼번에 멈췄다 시간 초과로 실패 → 실행 동안 잠자기 방지 + 잠들었으면 경고
const {keepAwakeCommand, createGapTracker, sleepWarning, SLEEP_GAP_MS} = require('../testUtils/keepAwake');
const jestConfig = require('../jest.config');
const integrationConfig = require('../jest.integration.config');

describe('jest 실행 중 맥 잠자기 방지', () => {
  it('맥에서는 유지보수 잠자기까지 막는 caffeinate -s 를 jest 주 프로세스가 끝날 때까지 건다', () => {
    const c = keepAwakeCommand('darwin', 4242, {});
    expect(c.cmd).toBe('/usr/bin/caffeinate');
    // -i(PreventUserIdleSystemSleep)만으로는 DarkWake 뒤 'Maintenance Sleep' 을 못 막았다 — -s 가 핵심
    expect(c.args).toEqual(expect.arrayContaining(['-s', '-i']));
    expect(c.args.slice(-2)).toEqual(['-w', '4242']);
  });

  it('맥이 아니거나(CI 리눅스) JEST_ALLOW_SLEEP=1 이면 아무것도 걸지 않는다', () => {
    expect(keepAwakeCommand('linux', 1, {})).toBeNull();
    expect(keepAwakeCommand('win32', 1, {})).toBeNull();
    expect(keepAwakeCommand('darwin', 1, {JEST_ALLOW_SLEEP: '1'})).toBeNull();
  });

  it('두 jest 설정 모두 globalSetup·globalTeardown 으로 연결돼 있다', () => {
    for (const cfg of [jestConfig, integrationConfig]) {
      expect(cfg.globalSetup).toBe('<rootDir>/testUtils/jestGlobalSetup.js');
      expect(cfg.globalTeardown).toBe('<rootDir>/testUtils/jestGlobalTeardown.js');
    }
  });
});

describe('잠자기 감지(1초 tick 사이 틈)', () => {
  // 맥은 잠자는 동안 hrtime 도 벽시계처럼 흘러(11-26 실측) 두 시계 비교로는 못 잡는다 → 주기 tick 이 건너뛴 틈으로 잰다
  const ticks = (start: number, times: number[]) => {
    const t = createGapTracker(start);
    times.forEach(n => t.tick(n));
    return t.sleptMs();
  };

  it('11-26 재현처럼 tick 사이가 973초 비면 그만큼을 잡아 경고만 한다(실패로 만들지 않음)', () => {
    // 2초 tick 다음 976초 tick: 틈 974초 중 원래 간격 1초를 뺀 973초
    const ms = ticks(0, [1_000, 2_000, 976_000, 977_000]);
    expect(ms).toBe(973_000);
    expect(sleepWarning(ms)).toContain('약 973초 동안 jest 주 프로세스가 멈췄습니다');
  });

  it('여러 번 잠들면 더한다', () => {
    expect(ticks(0, [920_000, 921_000, 1_881_000])).toBe(919_000 + 959_000);
  });

  it('부하로 tick 이 몇 초 밀린 정도(30초 미만)는 잠자기로 치지 않는다', () => {
    expect(ticks(0, [1_000, 8_000, 8_000 + SLEEP_GAP_MS - 1])).toBe(0);
    expect(sleepWarning(0)).toBeNull();
  });
});
