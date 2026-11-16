import {reasonToMessage, REASONS, copy} from '../src/copy/copy';

test('모든 reason에 어르신 문장이 있다', () => {
  expect(REASONS.sort()).toEqual(
    [
      'already_linked',
      'busy',
      'expired',
      'invalid',
      'not_parent_device',
      'rate_limited',
      'used',
    ].sort(),
  );
  for (const r of REASONS) {
    const m = reasonToMessage(r);
    expect(m.title.length).toBeGreaterThan(0);
    expect(m.body.length).toBeGreaterThan(0);
    expect(m.button.length).toBeGreaterThan(0);
  }
});
test('앱 문구에 치매 예방/치료 단정 표현이 없다', () => {
  const all = JSON.stringify(copy);
  expect(all).not.toMatch(/치매|치료|예방/);
});
