import {act, renderHook} from '@testing-library/react-native';
import {useConnectFlow, type Prefill} from '../src/features/link/useConnectFlow';
import {connectReducer} from '../src/features/link/connectMachine';
import {createFakeApi} from '../src/features/fakeApi';

// AP-09: 연결 화면이 떠 있는 동안 새 초대 링크가 열리면(params.prefill 변경) 그 번호로 바꿔 바로 확인한다.
// 연결 중(redeeming)·연결됨(ok)이면 바꾸지 않는다(서버만 연결되는 구멍 방지). 같은 링크가 다시 와도 한 번만.
test('리듀서 prefill: 쓰는 중·확인·실패 상태는 새 번호로 처음부터, 연결 중·연결됨은 그대로', () => {
  expect(connectReducer({kind: 'idle', code: '12', inline: null}, {type: 'prefill', code: '482915'})).toEqual({kind: 'idle', code: '482915', inline: null});
  expect(connectReducer({kind: 'confirm', code: '111111', title: '엄마'}, {type: 'prefill', code: '482915'})).toEqual({kind: 'idle', code: '482915', inline: null});
  expect(connectReducer({kind: 'failed', code: '111111', reason: 'expired', step: 'peek'}, {type: 'prefill', code: '482915'})).toEqual({kind: 'idle', code: '482915', inline: null});
  const redeeming = {kind: 'redeeming' as const, code: '111111', title: null};
  expect(connectReducer(redeeming, {type: 'prefill', code: '482915'})).toBe(redeeming);
  const ok = {kind: 'ok' as const, code: '111111'};
  expect(connectReducer(ok, {type: 'prefill', code: '482915'})).toBe(ok);
});

test('화면이 떠 있는 동안 새 링크: 번호를 바꾸고 바로 확인, 진행 중 확인은 버림, 이벤트는 새 링크마다 한 번', async () => {
  jest.useFakeTimers();
  try {
    const api = createFakeApi({parentTitle: '엄마', childFamily: true});
    const peek = jest.spyOn(api, 'peekInviteCode');
    const log = jest.spyOn(api, 'logEvent');
    let prefill: Prefill | undefined = {code: '000000', source: 'app_link'};
    const {result, rerender} = renderHook(() => useConnectFlow(api, prefill));
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(peek).toHaveBeenLastCalledWith('000000');
    prefill = {code: '123456', source: 'app_link'};
    rerender({});
    expect(result.current.state.code).toBe('123456');
    await act(async () => {
      jest.advanceTimersByTime(10); // 손 입력이 아니라 300ms 를 기다리지 않음
    });
    expect(peek).toHaveBeenLastCalledWith('123456');
    expect(result.current.state.kind).toBe('confirm');
    expect(log.mock.calls.filter(c => c[0] === 'code_prefilled')).toHaveLength(2);
    rerender({}); // 같은 링크 다시: 아무 일 없음
    expect(log.mock.calls.filter(c => c[0] === 'code_prefilled')).toHaveLength(2);
    expect(result.current.state.kind).toBe('confirm');
  } finally {
    jest.useRealTimers();
  }
});

test('연결 중에 새 링크가 와도 바꾸지 않는다', async () => {
  const api = createFakeApi({parentTitle: '엄마', childFamily: true});
  let release: () => void = () => {};
  jest.spyOn(api, 'redeemInviteCode').mockImplementation(() => new Promise(r => (release = () => r({ok: true, family_id: 'f', profile_id: 'p'}))));
  let prefill: Prefill | undefined = {code: '123456', source: 'referrer'};
  const {result, rerender} = renderHook(() => useConnectFlow(api, prefill));
  await act(async () => {
    await new Promise<void>(r => setTimeout(() => r(), 20));
  });
  expect(result.current.state.kind).toBe('confirm');
  await act(async () => {
    result.current.redeem();
  });
  expect(result.current.state.kind).toBe('redeeming');
  prefill = {code: '654321', source: 'app_link'};
  rerender({});
  expect(result.current.state.code).toBe('123456');
  await act(async () => release());
  expect(result.current.state.kind).toBe('ok');
});

test('형식이 다른 새 링크(6자리 숫자 아님)는 무시', () => {
  const api = createFakeApi();
  let prefill: Prefill | undefined = undefined;
  const {result, rerender} = renderHook(() => useConnectFlow(api, prefill));
  prefill = {code: '12a', source: 'app_link'};
  rerender({});
  expect(result.current.state.code).toBe('');
});
