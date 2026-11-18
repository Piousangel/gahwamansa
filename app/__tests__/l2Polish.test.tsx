import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {press, toHomeConsented} from '../testUtils/flow';

// 로드맵 L2 AP-10·AP-11·AP-12·AP-14 묶음.
let prefs: Prefs;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
});
afterEach(() => {
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  jest.restoreAllMocks();
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function home(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

describe('AP-14 테스트 보강', () => {
  test('설정 상태 문장은 행 이름과 함께 한 덩어리로 읽힌다', async () => {
    await home();
    await press('설정');
    await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주는 중이에요'));
  });
  test('모두 지우기 확인을 두 번 빨리 눌러도 삭제는 한 번', async () => {
    const api = await home();
    const del = jest.spyOn(api, 'deleteMyAccount');
    await press('설정');
    await press('모두 지우기');
    await waitFor(() => screen.getByText('모두 지울까요?'));
    const btn = screen.getByRole('button', {name: '모두 지우기'});
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByText('모두 지웠어요'));
    expect(del).toHaveBeenCalledTimes(1);
  });
  test('동의 철회(설정 확인 버튼)를 두 번 빨리 눌러도 한 번', async () => {
    const api = createFakeApi({consented: true});
    const withdraw = jest.spyOn(api, 'withdrawConsent');
    await toHomeConsented(api);
    await press('설정');
    await press('그만 보여 주기');
    await waitFor(() => screen.getByText('가족에게 그만 보여 줄까요?'));
    const all = screen.getAllByRole('button', {name: '그만 보여 주기'});
    const btn = all[all.length - 1];
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주지 않는 중이에요'));
    expect(withdraw).toHaveBeenCalledTimes(1);
  });
  test('연결된 가족 그만두기 시트의 그만 보여 주기를 두 번 빨리 눌러도 한 번', async () => {
    const api = createFakeApi({consented: true, familyDates: ['2026-11-12']});
    const withdraw = jest.spyOn(api, 'withdrawConsent');
    await toHomeConsented(api);
    await press('설정');
    await press('연결된 가족');
    await press('그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요');
    const btn = screen.getByRole('button', {name: '그만 보여 주기, 지난 답은 지워져요. 연결은 그대로예요'});
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByText('이제 고른 답은 가족에게 안 보여요. 설정에서 다시 보여 줄 수 있어요'));
    expect(withdraw).toHaveBeenCalledTimes(1);
  });
  test('콘텐츠가 없으면(null) "오늘 사진을 준비하고 있어요"와 다시 보기', async () => {
    const api = createFakeApi({linked: true, consented: true, empty: true});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByText('오늘 사진을 준비하고 있어요'));
    expect(screen.getByRole('button', {name: '다시 보기'})).toBeTruthy();
  });
  test('코스 홈을 떠난 뒤 늦게 온 도장 응답이 오류를 내지 않는다(언마운트 뒤 setState 없음)', async () => {
    const api = createFakeApi({linked: true, consented: true});
    let release: (v: {weekStart: string; doneDates: string[]}) => void = () => {};
    jest.spyOn(api, 'getWeekStamps').mockImplementation(() => new Promise(r => (release = r)));
    const errors = jest.spyOn(console, 'error');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    screen.unmount();
    await act(async () => release({weekStart: '2026-11-16', doneDates: []}));
    expect(errors.mock.calls.filter(c => String(c[0]).includes('unmounted'))).toHaveLength(0);
  });
});
