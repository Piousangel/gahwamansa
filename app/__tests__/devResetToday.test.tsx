// 개발자 메뉴 '오늘 코스 다시 하기(테스트 가족만)': 실제 서버 dev_reset_today(0051) 결과 해석·메뉴 동작
import React, {useContext} from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {devResetToday, devResetTodayChecked, DEV_RESET_REASON_TEXT} from '../src/dev/devResetToday';
import {DevMenuContext} from '../src/dev/devGate';
import {DevMenuHost} from '../src/dev/DevMenuHost';
import {createFakeApi} from '../src/features/fakeApi';

const mockRpc = jest.fn();
let mockSession: unknown = {access_token: 't'};
jest.mock('../src/lib/supabase', () => ({
  getSupabase: () => ({rpc: (n: string) => mockRpc(n), auth: {getSession: async () => ({data: {session: mockSession}})}}),
}));
jest.mock('../src/lib/env', () => {
  const actual = jest.requireActual('../src/lib/env');
  return {...actual, getAppEnv: () => ({...actual.DEFAULT_ENV, APP_ENV: 'staging', API_MODE: 'real'})};
});

describe('devResetToday 결과 해석', () => {
  const rpcOf = (v: {data: unknown; error: unknown}) => async () => v as never;
  test('성공은 지운 개수', async () => {
    expect(await devResetToday(rpcOf({data: {ok: true, session_date: '2026-11-19', sessions: 1, answers: 1}, error: null}))).toEqual({
      ok: true,
      sessions: 1,
      answers: 1,
    });
  });
  test('거절 사유 disabled·not_test_family 는 그대로, 모르는 사유는 failed', async () => {
    expect(await devResetToday(rpcOf({data: {ok: false, reason: 'disabled'}, error: null}))).toEqual({ok: false, reason: 'disabled'});
    expect(await devResetToday(rpcOf({data: {ok: false, reason: 'not_test_family'}, error: null}))).toEqual({ok: false, reason: 'not_test_family'});
    expect(await devResetToday(rpcOf({data: {ok: false, reason: 'x'}, error: null}))).toEqual({ok: false, reason: 'failed'});
  });
  test('예외 parent_required(P0001)는 사유로, 그 밖 오류·throw 는 failed', async () => {
    expect(await devResetToday(rpcOf({data: null, error: {code: 'P0001', message: 'parent_required'}}))).toEqual({ok: false, reason: 'parent_required'});
    expect(await devResetToday(rpcOf({data: null, error: {code: '42501', message: 'permission denied'}}))).toEqual({ok: false, reason: 'failed'});
    expect(
      await devResetToday(async () => {
        throw new Error('network');
      }),
    ).toEqual({ok: false, reason: 'failed'});
  });
});

function Opener({appKey}: {appKey: number}) {
  const {open} = useContext(DevMenuContext);
  return <Text onPress={open}>{`열기 ${appKey}`}</Text>;
}
// 실제 API 에는 fake 개발 훅(__dev)이 없다
const realLikeApi = (who: 'parent' | 'child' | 'none' = 'parent') => {
  const api = createFakeApi({consented: true, linked: true, who}) as Partial<ReturnType<typeof createFakeApi>>;
  delete api.__dev;
  return api as ReturnType<typeof createFakeApi>;
};
const renderHost = (who?: 'parent' | 'child' | 'none') => render(<DevMenuHost api={realLikeApi(who)}>{({appKey}) => <Opener appKey={appKey} />}</DevMenuHost>);
const openMenu = async () => {
  fireEvent.press(screen.getByText(/^열기/));
  await waitFor(() => screen.getByText('개발자 메뉴'));
};

describe('메뉴(실제 서버 모드)', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockSession = {access_token: 't'};
  });
  test('거절되면 사유 한 줄을 보이고 앱은 그대로', async () => {
    mockRpc.mockResolvedValue({data: {ok: false, reason: 'not_test_family'}, error: null});
    renderHost();
    await openMenu();
    expect(screen.queryByRole('button', {name: '오늘 코스 초기화'})).toBeNull(); // fake 전용 버튼은 없다
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '오늘 코스 다시 하기(테스트 가족만)'}));
    });
    expect(mockRpc).toHaveBeenCalledWith('dev_reset_today');
    expect(screen.getByText(DEV_RESET_REASON_TEXT.not_test_family)).toBeTruthy();
    expect(screen.getByText('열기 0')).toBeTruthy();
  });
  test('성공하면 메뉴를 닫고 앱을 처음부터(다시 마운트)', async () => {
    mockRpc.mockResolvedValue({data: {ok: true, session_date: '2026-11-19', sessions: 1, answers: 0}, error: null});
    renderHost();
    await openMenu();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '오늘 코스 다시 하기(테스트 가족만)'}));
    });
    await waitFor(() => screen.getByText('열기 1'));
    expect(screen.queryByText('개발자 메뉴')).toBeNull();
  });
  test('PR #70 L1: 기기에 한 번 남는 기록(첫 완료·음악 권유)은 되돌리지 않는다고 적혀 있다', async () => {
    renderHost();
    await openMenu();
    expect(screen.getByText('첫 완료 화면처럼 이 기기에 한 번만 남는 기록(음악 권유 등)은 되돌리지 않아요')).toBeTruthy();
  });
  test('PR #70 L3: 자녀 역할이면 버튼이 비활성이고 이유가 한 줄', async () => {
    renderHost('child');
    await openMenu();
    await waitFor(() => screen.getByTestId('dev-reset-child'));
    expect(screen.getByRole('button', {name: '오늘 코스 다시 하기(테스트 가족만)'}).props.accessibilityState?.disabled).toBe(true);
  });
  test('PR #70 L2: 연결 전 기기·세션 없음은 원인대로 한 줄(서버를 부르지 않음)', async () => {
    renderHost('none');
    await openMenu();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '오늘 코스 다시 하기(테스트 가족만)'}));
    });
    expect(screen.getByText(DEV_RESET_REASON_TEXT.not_linked)).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('devResetTodayChecked(PR #70 L2)', () => {
  const rpc = jest.fn(async () => ({data: {ok: true, sessions: 1, answers: 0}, error: null}));
  test('세션 없음 → signed_out, 연결 전 → not_linked, 자녀 → parent_required, 어르신만 서버로', async () => {
    expect(await devResetTodayChecked({rpc, hasSession: async () => false, whoAmI: async () => 'parent'})).toEqual({ok: false, reason: 'signed_out'});
    expect(await devResetTodayChecked({rpc, hasSession: async () => true, whoAmI: async () => 'none'})).toEqual({ok: false, reason: 'not_linked'});
    expect(await devResetTodayChecked({rpc, hasSession: async () => true, whoAmI: async () => 'child'})).toEqual({ok: false, reason: 'parent_required'});
    expect(rpc).not.toHaveBeenCalled();
    expect(await devResetTodayChecked({rpc, hasSession: async () => true, whoAmI: async () => 'parent'})).toEqual({ok: true, sessions: 1, answers: 0});
  });
  test('확인 중 오류는 failed', async () => {
    expect(
      await devResetTodayChecked({
        rpc,
        hasSession: async () => {
          throw new Error('x');
        },
        whoAmI: async () => 'parent',
      }),
    ).toEqual({ok: false, reason: 'failed'});
  });
});
