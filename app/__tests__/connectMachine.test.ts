import {connectReducer, initialConnect, shouldAutoCheck, ConnectState} from '../src/features/link/connectMachine';

const run = (events: Parameters<typeof connectReducer>[1][], from: ConnectState = initialConnect()) => events.reduce(connectReducer, from);

test('6자리 전에는 자동 확인하지 않고, 6자리면 확인 → 누가 보낸 번호인지 → 사람이 눌러야 연결', () => {
  expect(shouldAutoCheck(run([{type: 'edit', code: '12345'}]))).toBe(false);
  const typed = run([{type: 'edit', code: '123456'}]);
  expect(shouldAutoCheck(typed)).toBe(true);
  const confirm = run([{type: 'peek'}, {type: 'peeked', result: {ok: true, parentTitle: '엄마'}}], typed);
  expect(confirm).toEqual({kind: 'confirm', code: '123456', title: '엄마'});
  // 자동 연결 금지: confirm 에서 머문다
  expect(connectReducer(confirm, {type: 'peek'})).toBe(confirm);
  const ok = run([{type: 'redeem'}, {type: 'redeemed', result: {ok: true, family_id: 'f', profile_id: 'p'}}], confirm);
  expect(ok).toEqual({kind: 'ok', code: '123456'});
});

test('없는 번호면 숫자를 그대로 두고 칸 아래 안내, 고치기 전에는 다시 확인하지 않는다', () => {
  const s = run([{type: 'edit', code: '999999'}, {type: 'peek'}, {type: 'peeked', result: {ok: false, reason: 'invalid'}}]);
  expect(s).toEqual({kind: 'idle', code: '999999', inline: 'invalid'});
  expect(shouldAutoCheck(s)).toBe(false);
  const fixed = run([{type: 'edit', code: '99999'}, {type: 'edit', code: '999998'}], s);
  expect(fixed).toEqual({kind: 'idle', code: '999998', inline: null});
  expect(shouldAutoCheck(fixed)).toBe(true);
});

test('기간 지남·쓴 번호·잠김은 안내 패널, 버튼을 누르면 비우고 처음부터', () => {
  const exp = run([{type: 'edit', code: '111111'}, {type: 'peek'}, {type: 'peeked', result: {ok: false, reason: 'expired'}}]);
  expect(exp).toMatchObject({kind: 'failed', reason: 'expired', step: 'peek'});
  expect(connectReducer(exp, {type: 'retry'})).toEqual(initialConnect());
  const locked = run([{type: 'edit', code: '222222'}, {type: 'peek'}, {type: 'peeked', result: {ok: false, reason: 'rate_limited', retry_after_sec: 600}}]);
  expect(locked).toMatchObject({kind: 'failed', reason: 'locked'}); // 문구가 "조금 뒤에"라 남은 초는 들고 있지 않는다(리뷰 L3)
});

test('인터넷 문제는 같은 단계를 다시(확인이면 확인, 연결이면 연결)', () => {
  const p = run([{type: 'edit', code: '123456'}, {type: 'peek'}, {type: 'error', offline: true}]);
  expect(p).toMatchObject({kind: 'failed', reason: 'offline', step: 'peek'});
  expect(connectReducer(p, {type: 'retry'})).toEqual({kind: 'peeking', code: '123456'});
  const r = run([{type: 'redeem'}, {type: 'error', offline: true}], {kind: 'confirm', code: '123456', title: '엄마'});
  expect(r).toMatchObject({kind: 'failed', step: 'redeem', title: '엄마'});
  expect(connectReducer(r, {type: 'retry'})).toEqual({kind: 'redeeming', code: '123456', title: '엄마'});
});

test('확인 중에 숫자를 고치면 그 확인 결과는 버린다', () => {
  const peeking = run([{type: 'edit', code: '123456'}, {type: 'peek'}]);
  const edited = connectReducer(peeking, {type: 'edit', code: '12345'});
  expect(connectReducer(edited, {type: 'peeked', result: {ok: true, parentTitle: '엄마'}})).toEqual(edited);
});

test('다른 번호 쓰기: 확인 화면에서 비우고 처음부터', () => {
  expect(connectReducer({kind: 'confirm', code: '123456', title: '엄마'}, {type: 'other'})).toEqual(initialConnect());
});

test('H1: 6자리가 찬 뒤 같은 번호 edit(키 연타)는 상태를 바꾸지 않는다(안내 줄·확인 중 유지, 재확인 없음)', () => {
  const invalid = run([{type: 'edit', code: '999999'}, {type: 'peek'}, {type: 'peeked', result: {ok: false, reason: 'invalid'}}]);
  const again = connectReducer(invalid, {type: 'edit', code: '999999'});
  expect(again).toBe(invalid);
  expect(shouldAutoCheck(again)).toBe(false);
  const peeking = run([{type: 'edit', code: '123456'}, {type: 'peek'}]);
  expect(connectReducer(peeking, {type: 'edit', code: '123456'})).toBe(peeking);
});

test('M1: 연결 중(redeeming)에는 다른 번호 쓰기·이전으로 상태를 버리지 않는다', () => {
  const r: ConnectState = {kind: 'redeeming', code: '123456', title: '엄마'};
  expect(connectReducer(r, {type: 'other'})).toBe(r);
  expect(connectReducer(r, {type: 'redeemed', result: {ok: true, family_id: 'f', profile_id: 'p'}})).toEqual({kind: 'ok', code: '123456'});
});

test('L2: 호칭 없는 확인(peek 이 호칭을 못 줌)도 연결 실패 뒤 다시 연결할 수 있다', () => {
  const c: ConnectState = {kind: 'confirm', code: '123456', title: null};
  const failed = run([{type: 'redeem'}, {type: 'error', offline: true}], c);
  expect(connectReducer(failed, {type: 'redeem'})).toEqual({kind: 'redeeming', code: '123456', title: null});
});
