// 재발 방지(DV-1 부하 불안정, 2026-11-25): 모의 함수의 호출 기록이 다음 테스트로 새지 않는다(jest.config clearMocks).
// 실제 사고: cheerSheetV4 'ds Sheet 열리면 포커스가 제목으로(300ms 뒤)' 가 부하 때만
//   'expect(jest.fn()).not.toHaveBeenCalled() — Received number of calls: 1' 로 실패했다.
//   preset 의 AccessibilityInfo.sendAccessibilityEvent 는 이미 jest.fn 이라 jest.spyOn 이 그 jest.fn 을 그대로 돌려주고,
//   afterEach 의 restoreAllMocks 는 그 기록을 비우지 않는다. 앞 테스트(응원 보내기 → 시트 닫힘)의 실제 300ms 포커스 타이머가
//   부하로 언마운트 전에 울리면 그 호출이 남아 있었다.
// 이 파일의 두 테스트는 순서대로 돈다(같은 파일 안 테스트는 직렬). clearMocks 를 끄면 두 번째가 실패한다.
import {AccessibilityInfo} from 'react-native';

afterEach(() => {
  jest.restoreAllMocks();
});

test('앞 테스트: preset 모의(sendAccessibilityEvent)를 부른다 — 실제 타이머가 테스트 안에서 울린 경우와 같다', () => {
  const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  AccessibilityInfo.sendAccessibilityEvent({} as never, 'focus');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('다음 테스트: 같은 모의를 spyOn 하면 호출 기록이 비어 있다(앞 테스트의 호출이 새지 않음)', () => {
  const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  expect(spy).not.toHaveBeenCalled();
});

// 재발 방지 2(DV-1): 예열 훅은 전역 hook 제한(20초)이 아니라 WARM_TIMEOUT_MS 로 — 캐시 없는 첫 변환·로드가 부하에서 20초를 넘겼다.
// 예열 훅에 두 번째 인자(제한) 없이 쓰면 여기서 그 파일 이름으로 실패한다.
test('예열(warmAppRoot)을 쓰는 모든 테스트 파일은 beforeAll(warmAppRoot, WARM_TIMEOUT_MS)', () => {
  const fs: {readdirSync(d: string): string[]; readFileSync(p: string, e: 'utf8'): string} = require('fs');
  const dir: string = __dirname;
  const bad = fs
    .readdirSync(dir)
    .filter(f => /\.test\.tsx?$/.test(f))
    .filter(f => {
      const src = fs.readFileSync(`${dir}/${f}`, 'utf8');
      return /beforeAll\(\s*warmAppRoot\s*\)/.test(src);
    });
  expect(bad).toEqual([]);
});
