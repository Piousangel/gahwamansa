// 자녀 UX 승인안(DECISIONS 11-18, ux-improvements-2026-11-18): U2 토스트 자리, U10 응원 취소, U12 C3 공유 뒤 안내,
// C4 호칭 겹침(시안 C4_title_dup), N3 앱 안 배너(시안 N3_connected), C0 연령 안내
import React from 'react';
import {AccessibilityInfo, AppState, PixelRatio, Share, StyleSheet, Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {ToastProvider, useToast} from '../src/ui/Toast';
import {Screen} from '../src/ui/Screen';
import {BottomSheet} from '../src/ui/BottomSheet';
import {toastBottom} from '../src/ui/toastPlacement';
import {CHEER_UNDO_MS} from '../src/features/home/useSendCheer';
import {toastDurationMs, TOAST_MS} from '../src/ui/ds/Toast';
import {findTitleDup} from '../src/features/home/titleDup';
import {newConnection, parseSeen} from '../src/features/home/newConnection';
import {NewConnectionBanner} from '../src/features/home/NewConnectionBanner';
import {memoryStore} from '../src/lib/kvStore';
import {press, pressWhenEnabled} from '../testUtils/flow';
import type {ChildParent} from '../src/features/types';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

jest.setTimeout(20000);
beforeEach(() => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1); // RN 모의값은 2
});
afterEach(() => {
  jest.restoreAllMocks();
});

const P = (o: Partial<ChildParent>): ChildParent => ({parentId: 'p', title: '부모님', shared: true, connected: true, latest: null, starter: null, ...o});

describe('U2 토스트 자리', () => {
  test('규칙: 하단 고정 위 12 → 탭 막대 위 12 → 안전 영역 + 24', () => {
    expect(toastBottom({dock: 100, tabOffset: 0, insetBottom: 20})).toBe(112);
    expect(toastBottom({dock: 100, tabOffset: 68, insetBottom: 20})).toBe(180);
    expect(toastBottom({dock: 0, tabOffset: 68, insetBottom: 20})).toBe(80);
    expect(toastBottom({dock: 0, tabOffset: 0, insetBottom: 20})).toBe(44);
  });

  function Shower({bottom, sheet}: {bottom?: boolean; sheet?: boolean}) {
    const {show} = useToast();
    return (
      <>
        <Screen bottom={bottom ? <Text>주 버튼</Text> : undefined}>
          <Text onPress={() => show({text: '토스트'})}>띄우기</Text>
        </Screen>
        <BottomSheet visible={!!sheet} title="시트" closeLabel="닫기" onClose={() => {}} />
      </>
    );
  }
  const bottomOf = () => StyleSheet.flatten(screen.getByTestId('toast-layer').props.style).bottom;

  test('하단 고정이 있으면 그 위 12(주 버튼을 덮지 않음), 없으면 아래 24', async () => {
    const {unmount} = render(
      <ToastProvider>
        <Shower bottom />
      </ToastProvider>,
    );
    fireEvent(screen.getByTestId('screen-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 120}}});
    fireEvent.press(screen.getByText('띄우기'));
    await waitFor(() => screen.getByTestId('toast-layer'));
    expect(bottomOf()).toBe(132);
    unmount();
    render(
      <ToastProvider>
        <Shower />
      </ToastProvider>,
    );
    fireEvent.press(screen.getByText('띄우기'));
    await waitFor(() => screen.getByTestId('toast-layer'));
    expect(bottomOf()).toBe(24);
  });

  test('시트가 열려 있으면 토스트를 띄우지 않는다', async () => {
    render(
      <ToastProvider>
        <Shower sheet />
      </ToastProvider>,
    );
    fireEvent.press(screen.getByText('띄우기'));
    await act(async () => {});
    expect(screen.queryByTestId('toast-layer')).toBeNull();
  });

  test('토스트마다 표시 시간을 따로 줄 수 있다(durationMs)', async () => {
    jest.useFakeTimers();
    try {
      function Short() {
        const {show} = useToast();
        return <Text onPress={() => show({text: '짧게', durationMs: 1000})}>짧게 띄우기</Text>;
      }
      render(
        <ToastProvider>
          <Short />
        </ToastProvider>,
      );
      fireEvent.press(screen.getByText('짧게 띄우기'));
      expect(screen.getByText('짧게')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(screen.queryByText('짧게')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

// #199 캡처 L: 글자 200%에서 탭 막대가 커지면(고정 68 보다 큼) 토스트 아래 끝이 막대 위로 겹쳤다 → 막대가 실제 높이를 알린다
describe('토스트 아래 끝 ≤ 탭 막대 위 끝(200%)', () => {
  test.each([
    ['100%', 68],
    ['200% 막대 키움', 104],
  ])('%s: 탭 막대 실제 높이 %d 위로 토스트가 뜬다', async (_name, barH) => {
    jest.useFakeTimers();
    try {
      render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마'})} role="child" />);
      await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled()); // 불러오는 중의 꺼진 버튼이 아니라 켜진 버튼(대기열 46)
      await act(async () => {
        fireEvent(screen.getByTestId('child-tab-bar'), 'layout', {nativeEvent: {layout: {x: 0, y: 640 - barH, width: 360, height: barH}}});
      });
      await pressWhenEnabled('응원 보내기');
      await press('늘 고마워요');
      const layer = StyleSheet.flatten(screen.getByTestId('toast-layer').props.style) as {bottom: number};
      // 토스트 층의 아래 끝(화면 아래에서 bottom) ≥ 탭 막대 높이 = 토스트 아래 끝이 막대 위 끝보다 위
      expect(layer.bottom).toBeGreaterThanOrEqual(barH);
      expect(layer.bottom).toBe(toastBottom({dock: 0, tabOffset: barH, insetBottom: 0}));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('U10 응원 취소', () => {
  test('토스트 시간 우선순위(ds Toast 한 곳, D-17·D-17a): 화면 읽기 10초 > 글자 150% 이상 8초 > 기본(응원 되돌리기 4초·일반 6초)', () => {
    expect(CHEER_UNDO_MS).toBe(4000);
    expect(toastDurationMs(CHEER_UNDO_MS, false, 1)).toBe(4000);
    expect(toastDurationMs(CHEER_UNDO_MS, false, 1.3)).toBe(4000);
    expect(toastDurationMs(CHEER_UNDO_MS, false, 1.5)).toBe(8000);
    expect(toastDurationMs(CHEER_UNDO_MS, false, 2)).toBe(8000);
    expect(toastDurationMs(CHEER_UNDO_MS, true, 1)).toBe(10000);
    expect(toastDurationMs(CHEER_UNDO_MS, true, 2)).toBe(10000); // 화면 읽기가 큰 글자보다 앞
    expect(toastDurationMs(TOAST_MS, false, 1)).toBe(6000);
    expect(toastDurationMs(TOAST_MS, false, 2)).toBe(8000);
  });

  test('D-17: 응원 문장 칸 사이는 8 이상(바로 보내는 표적이 붙어 있지 않게, 7:90)', async () => {
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마'})} role="child" />);
    await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled()); // 불러오는 중의 꺼진 버튼이 아니라 켜진 버튼(대기열 46)
    await pressWhenEnabled('응원 보내기');
    const list = StyleSheet.flatten(screen.getByTestId('cheer').props.style);
    expect(list.rowGap ?? list.gap).toBeGreaterThanOrEqual(8);
  });

  async function pickCheer(api: ReturnType<typeof createFakeApi>) {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled()); // 불러오는 중의 꺼진 버튼이 아니라 켜진 버튼(대기열 46)
    await pressWhenEnabled('응원 보내기');
    await press('늘 고마워요');
  }

  test('취소를 누르면 서버로 보내지 않고 "응원을 보내지 않았어요"(한도에 안 셈)', async () => {
    jest.useFakeTimers(); // 4초 '취소' 시간을 실제로 자지 않는다(부하 때 시간 제한, 2026-11-19)
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    await pickCheer(api);
    expect(within(screen.getByTestId('toast')).getByText('엄마께 보냈어요')).toBeTruthy();
    await press('되돌리기');
    await waitFor(() => screen.getByText('응원을 보내지 않았어요'));
    await act(async () => {
      jest.advanceTimersByTime(4200);
    });
    expect(send).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('앱이 백그라운드로 가면 기다리지 않고 바로 보낸다', async () => {
    const handlers: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handlers.push(h);
      return {remove: () => {}};
    }) as never);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    await pickCheer(api);
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      handlers.forEach(h => h('background'));
    });
    expect(send).toHaveBeenCalledWith('parent-1', 'thanks_always', expect.stringMatching(/^[0-9a-f-]{36}$/)); // request_id(서버 0059)
    expect(screen.queryByRole('button', {name: '되돌리기'})?.props.accessibilityState?.disabled ?? true).toBe(true); // 보낸 뒤 취소 없음
  });

  test('리뷰 M2: 토스트가 끝나는 순간 보내고, 그때부터 \'취소\'는 비활성(늦은 취소로 조용히 보내지는 틈 없음)', async () => {
    jest.useFakeTimers();
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    await pickCheer(api);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.props.accessibilityState?.disabled).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(4050);
    });
    expect(send).toHaveBeenCalledTimes(1);
    const late = screen.queryByRole('button', {name: '되돌리기'});
    if (late) {
      expect(late.props.accessibilityState?.disabled).toBe(true); // 사라지는 중에도 누를 수 없음
      fireEvent.press(late);
    }
    expect(screen.queryByText('응원을 보내지 않았어요')).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('D-17a 화면 읽기 켜짐: 응원 보냄 토스트 10초 + 초점 되돌리기', () => {
  async function pickCheerSr(api: ReturnType<typeof createFakeApi>) {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled()); // 불러오는 중의 꺼진 버튼이 아니라 켜진 버튼(대기열 46)
    await pressWhenEnabled('응원 보내기');
    await press('늘 고마워요');
  }

  test('화면 읽기 켜짐: 초점이 "되돌리기"로 가고(따로 읽지 않음), 10초 동안 보내지 않는다', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    say.mockClear(); // RN 모의 함수라 앞 테스트의 호출이 남아 있다
    focus.mockClear();
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    jest.useFakeTimers(); // 10초를 실제로 자지 않는다(다른 U10 테스트와 같게)
    try {
      await pickCheerSr(api);
      const action = screen.getByTestId('toast-action');
      expect(action.props.accessibilityLabel).toBe('엄마께 보냈어요, 되돌리기'); // 한 번에 문구 + 행동
      expect(say).not.toHaveBeenCalledWith('엄마께 보냈어요');
      const focusCalls = () => focus.mock.calls.filter(c => c[1] === 'focus').length;
      await act(async () => {
        jest.advanceTimersByTime(400); // 시트가 닫히며 연 버튼(응원 보내기)으로 가는 초점(300ms)
      });
      const before = focusCalls();
      await act(async () => {
        jest.advanceTimersByTime(300); // 600ms: 토스트 '되돌리기'로(시트 초점보다 뒤라 마지막 초점이 된다)
      });
      expect(focusCalls()).toBe(before + 1);
      expect(focus.mock.calls[focus.mock.calls.length - 1][0]).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(8000); // 8.7초: 아직 되돌릴 수 있다
      });
      expect(send).not.toHaveBeenCalled();
      expect(screen.getByTestId('toast-action').props.accessibilityState?.disabled).toBe(false);
      await act(async () => {
        jest.advanceTimersByTime(1500); // 10.2초: 보냄
      });
      expect(send).toHaveBeenCalledTimes(1);
      // #158 리뷰 M: 토스트가 닫히면 초점을 응원 보내기로(초점을 가진 '되돌리기'가 사라지므로)
      const afterExpire = focusCalls();
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(focusCalls()).toBe(afterExpire + 1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('D-17: 글자 150% 이상이면 응원 되돌리기 토스트가 8초(ds Toast 시간 계산), 화면 읽기는 꺼짐', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    jest.useFakeTimers();
    try {
      await pickCheerSr(api);
      await act(async () => {
        jest.advanceTimersByTime(7500); // 기본 4초는 지났지만 아직 되돌릴 수 있다
      });
      expect(send).not.toHaveBeenCalled();
      expect(screen.getByTestId('toast-action').props.accessibilityState?.disabled).toBe(false);
      await act(async () => {
        jest.advanceTimersByTime(700); // 8.2초: 보냄
      });
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('#158 리뷰 M: 화면 읽기 켜짐에서 되돌리기를 누르면 보내지 않고, 초점은 응원 보내기로 돌아간다', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    jest.useFakeTimers();
    try {
      await pickCheerSr(api);
      await act(async () => {
        jest.advanceTimersByTime(700);
      });
      focus.mockClear();
      await act(async () => {
        fireEvent.press(screen.getByTestId('toast-action'));
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(focus.mock.calls.filter(c => c[1] === 'focus')).toHaveLength(1);
      expect(screen.getByText('응원을 보내지 않았어요')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(11000);
      });
      expect(send).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('화면 읽기 꺼짐: 초점을 옮기지 않고 문구를 한 번 읽고, 라벨은 "되돌리기"', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    say.mockClear();
    await pickCheerSr(createFakeApi({consented: true, parentTitle: '엄마'}));
    expect(screen.getByTestId('toast-action').props.accessibilityLabel).toBe('되돌리기');
    expect(say).toHaveBeenCalledWith('엄마께 보냈어요');
  });
});

describe('Toast onExpire·시트 동안 멈춤(리뷰 M2·L3)', () => {
  function Shower({sheet, onExpire, onAct}: {sheet?: boolean; onExpire: () => void; onAct: () => void}) {
    const {show} = useToast();
    return (
      <>
        <Text onPress={() => show({text: '대기', durationMs: 1000, onExpire, action: {label: '되돌리기', onPress: onAct}})}>띄우기</Text>
        <Text onPress={() => show({text: '다른 것'})}>바꾸기</Text>
        <BottomSheet visible={!!sheet} title="시트" closeLabel="닫기" onClose={() => {}} />
      </>
    );
  }
  test('시간이 끝나면 onExpire 한 번, 행동을 누르면 onExpire 없음, 다른 토스트로 바뀌면 onExpire', async () => {
    jest.useFakeTimers();
    try {
      const onExpire = jest.fn();
      const onAct = jest.fn();
      render(
        <ToastProvider>
          <Shower onExpire={onExpire} onAct={onAct} />
        </ToastProvider>,
      );
      fireEvent.press(screen.getByText('띄우기'));
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });
      expect(onExpire).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByText('띄우기'));
      fireEvent.press(screen.getByRole('button', {name: '되돌리기'}));
      expect(onAct).toHaveBeenCalledTimes(1);
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(onExpire).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByText('띄우기'));
      fireEvent.press(screen.getByText('바꾸기'));
      expect(onExpire).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('시트가 열린 동안은 시간을 세지 않는다(닫히면 그때부터)', async () => {
    jest.useFakeTimers();
    try {
      const onExpire = jest.fn();
      const {rerender} = render(
        <ToastProvider>
          <Shower sheet onExpire={onExpire} onAct={() => {}} />
        </ToastProvider>,
      );
      fireEvent.press(screen.getByText('띄우기'));
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(onExpire).not.toHaveBeenCalled();
      rerender(
        <ToastProvider>
          <Shower onExpire={onExpire} onAct={() => {}} />
        </ToastProvider>,
      );
      expect(screen.getByText('대기')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });
      expect(onExpire).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('U12 C3 공유 뒤', () => {
  test('공유 창에서 돌아오면 칩은 그대로, 안내 한 줄 + 주 버튼이 보조 "다시 보내기"로', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({action: Share.sharedAction} as never);
    render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'})} restore />);
    await waitFor(() => screen.getByRole('button', {name: '번호 보내기'}));
    await press('번호 보내기');
    await waitFor(() => screen.getByTestId('wait-after-share'));
    expect(screen.getByText('번호를 보냈다면 다시 보내지 않아도 돼요')).toBeTruthy();
    expect(screen.getByText('연결 기다리는 중')).toBeTruthy();
    expect(screen.getByRole('button', {name: '다시 보내기'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: '번호 보내기'})).toBeNull();
  });

  test('번호 기간이 지났으면 안내 띠 두 줄 + 새 번호 만들기("새 번호를 만들면…" 줄은 디자인 결정 PR #83 L2 로 뺌)', async () => {
    render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, childCodeExpired: true})} restore />);
    await waitFor(() => screen.getByText('번호 기간이 지났어요'));
    expect(screen.getByText('새 번호를 만들어 다시 보내 주세요')).toBeTruthy();
    expect(screen.getByRole('button', {name: '새 번호 만들기'})).toBeTruthy();
    expect(screen.queryByText('새 번호를 만들면 보낸 번호는 쓸 수 없어요')).toBeNull();
  });
});

describe('C4 호칭 겹침', () => {
  test('겹친 이름 중 나중에 연결된 분이 대상, 다른 분 이름은 고를 수 없다', () => {
    expect(findTitleDup([P({parentId: 'a', title: '엄마'}), P({parentId: 'b', title: '아빠'})])).toBeNull();
    const d = findTitleDup([P({parentId: 'a', title: '부모님'}), P({parentId: 'b', title: '부모님'})]);
    expect(d?.target.parentId).toBe('b');
    expect(d?.taken).toEqual(['부모님']);
  });

  test('안내 줄 → 이름 고르기 시트(연결한 날·이미 쓰는 이름 막힘) → 바꾸면 줄이 사라지고 토스트', async () => {
    const api = createFakeApi({
      parents: [
        {title: '부모님', latest: null},
        {title: '부모님', latest: null, connectedDate: '2026-11-17'},
      ],
    });
    const set = jest.spyOn(api, 'setParentTitleFor');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByText('두 분이 같은 이름으로 보여요. 새로 연결된 분의 이름을 골라 주세요'));
    const chips = screen.getByTestId('title-dup-chips'); // 시안: 칩 줄(부모님 고르기), 새로 연결된 분 칩이 현재
    expect(chips.props.accessibilityLabel).toBe('연결된 분 이름, 부모님, 부모님. 새로 연결된 분은 두 번째예요'); // 라이터 11-14, 한 덩어리
    expect(chips.props.accessible).toBe(true);
    expect(within(chips).getAllByText('부모님')).toHaveLength(2);
    await press('이름 고르기');
    const sheet = screen.getByTestId('title-dup-sheet');
    expect(within(sheet).getByText('새로 연결된 분을 어떻게 부르세요?')).toBeTruthy();
    expect(within(sheet).getByText('11월 17일에 연결된 분이에요. 이 이름으로 화면에 보여요')).toBeTruthy();
    const taken = within(sheet).getByLabelText('부모님, 이미 쓰는 이름, 사용할 수 없음');
    expect(taken.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', {name: '이 이름으로 바꾸기'})).toBeDisabled();
    fireEvent.press(within(sheet).getByLabelText('아빠'));
    await press('이 이름으로 바꾸기');
    expect(set).toHaveBeenCalledWith('parent-2', '아빠');
    await waitFor(() => expect(screen.queryByTestId('title-dup')).toBeNull());
    await waitFor(() => screen.getByText('부르는 이름을 바꿨어요'));
  });

  test('연결한 날을 모르면(옛 서버) 날짜 문장 없이', async () => {
    render(<AppRoot api={createFakeApi({parents: [{title: '엄마'}, {title: '엄마'}]})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '이름 고르기'}));
    await press('이름 고르기');
    expect(within(screen.getByTestId('title-dup-sheet')).getByText('이 이름으로 화면에 보여요')).toBeTruthy();
  });
});

describe('N3 앱 안 배너', () => {
  test('처음에는 띄우지 않고 지금 어르신을 본 것으로, 다음에 새로 연결된 분이 있으면 그분으로', () => {
    const a = P({parentId: 'a', title: '엄마'});
    const b = P({parentId: 'b', title: '아빠'});
    expect(newConnection(null, [a])).toEqual({banner: null, nextSeen: ['a']});
    expect(newConnection(['a'], [a, b])).toEqual({banner: b, nextSeen: ['a', 'b']});
    expect(newConnection(['a', 'b'], [a, b]).banner).toBeNull();
    expect(parseSeen('{oops')).toBeNull();
  });

  test('배너: "{호칭} 폰과 연결됐어요" + 본문 + 보기, 보기를 누르면 닫히고 앨범으로', async () => {
    const store = memoryStore();
    await store.setItem('seen_parent_ids_v1:fake-account', JSON.stringify(['parent-1'])); // 리뷰 M4: 계정별 키
    const api = createFakeApi({parents: [{title: '엄마'}, {title: '아빠'}]});
    const onView = jest.fn();
    render(<NewConnectionBanner api={api} onView={onView} store={store} />);
    await waitFor(() => screen.getByTestId('n3-banner'));
    expect(screen.getByText('아빠 폰과 연결됐어요')).toBeTruthy();
    expect(screen.getByText('고른 답을 보여 줄지는 아빠께서 정해요')).toBeTruthy();
    await press('보기');
    expect(onView).toHaveBeenCalled();
    expect(screen.queryByTestId('n3-banner')).toBeNull();
  });
});

describe('C0 연령 안내', () => {
  test('로그인 첫 화면: 소셜 버튼 아래 약관 한 줄, 그 아래 연령 안내 한 줄', async () => {
    render(<AppRoot api={createFakeApi()} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('legal-child'));
    expect(screen.getByText('로그인하면 이용약관에 동의하고 개인정보 처리방침을 확인하게 돼요')).toBeTruthy();
    expect(screen.getByText('만 14세 이상이 쓰는 앱이에요')).toBeTruthy();
  });
});

describe('호칭 고르기(가족 기본 호칭) D-L1', () => {
  test('서버가 duplicate_title 이면 "같은 이름이 이미 있어요" 안내(일반 오류 아님)', async () => {
    const api = createFakeApi({who: 'child'});
    jest.spyOn(api, 'setParentTitle').mockResolvedValue({ok: false, reason: 'duplicate_title'});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByLabelText('엄마'));
    fireEvent.press(screen.getByLabelText('엄마'));
    await press('번호 만들기');
    await waitFor(() => screen.getByText('같은 이름이 이미 있어요. 다른 이름을 골라 주세요'));
  });
});

describe('AC-01 C6 곧 유료 시트', () => {
  const items = [{answeredDate: '2020-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'}];
  async function openPaid(api: ReturnType<typeof createFakeApi>) {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('tab', {name: '지난 날'}));
    await act(async () => {
      fireEvent.press(screen.getByRole('tab', {name: '지난 날'}));
    });
    await waitFor(() => screen.getByTestId('child-past-topic'));
    await press('이야기 주제 추천, 곧 유료');
    return screen.getByTestId('paid-sheet');
  }

  test('C5 행을 누르면 시트: 제목·본문·법률 문장·예정 가격 3안(누르는 모양 아님), 열림 이벤트', async () => {
    const api = createFakeApi({consented: true, parentTitle: '엄마', history: items});
    const log = jest.spyOn(api, 'logEvent');
    const sheet = await openPaid(api);
    expect(within(sheet).getByText('이야기 주제 추천은 곧 유료예요')).toBeTruthy();
    expect(within(sheet).getByText('고른 답에 맞는 이야기 주제를 추천해요')).toBeTruthy();
    expect(within(sheet).getByText('지금은 결제되지 않아요. 관심만 표시돼요')).toBeTruthy();
    expect(within(sheet).getByText('예정 가격')).toBeTruthy();
    expect(within(sheet).getByText(/^한 달 .+원$/)).toBeTruthy();
    expect(within(sheet).getByText(/^일 년 .+원$/)).toBeTruthy();
    expect(within(sheet).getByText(/^선물 이용권 .+원$/)).toBeTruthy();
    expect(within(sheet).getByText('형제나 친지가 대신 내 줘요')).toBeTruthy();
    expect(within(sheet).queryAllByRole('radio')).toHaveLength(0); // 고르기 없음
    expect(log).toHaveBeenCalledWith('paid_sheet_opened');
  });

  test("'관심 있어요' → 관심 이벤트(plan 없음)·안내 문장·'관심 남김'(비활성), 다시 열어도 남김", async () => {
    const api = createFakeApi({consented: true, parentTitle: '엄마', history: items});
    const log = jest.spyOn(api, 'logEvent');
    await openPaid(api);
    await press('관심 있어요');
    expect(log).toHaveBeenCalledWith('paid_interest_tapped');
    expect(screen.getByText('관심을 남겼어요. 지금은 결제되지 않아요')).toBeTruthy();
    expect(screen.getByRole('button', {name: '관심 남김'})).toBeDisabled();
    await press('닫기');
    await waitFor(() => expect(screen.queryByTestId('paid-sheet')).toBeNull());
    await press('이야기 주제 추천, 곧 유료');
    await waitFor(() => screen.getByRole('button', {name: '관심 남김'}));
    expect(log.mock.calls.filter(c => c[0] === 'paid_interest_tapped')).toHaveLength(1);
  });
});

describe('AC-04 알림 실제 권한 상태(C3 줄·C7 행)', () => {
  const RN = require('react-native');
  const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
  const setPlatform = (OS: string, Version: number) => {
    Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
    Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
  };
  const {notifyFlags} = require('../src/features/child/useNotifyPermission');
  beforeEach(() => {
    notifyFlags.promptReady = true; // AU-04 뒤 동작
  });
  afterAll(() => {
    notifyFlags.promptReady = true;
  });
  function android(version: number, granted: boolean) {
    setPlatform('android', version);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(granted);
    return jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
  }
  afterEach(() => {
    setPlatform(orig.OS, orig.Version);
  });

  async function openSettings() {
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', childFamily: true})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
  }

  test('Android 13+ 꺼짐: C7 알림 행 "알림이 휴대폰 설정에서 꺼져 있어요" + 눌러서 켜기(거절 상태면 휴대폰 설정)', async () => {
    const request = android(34, false);
    const openSettingsSpy = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    await openSettings();
    await waitFor(() => screen.getByTestId('child-notify-row'));
    expect(screen.getByRole('button', {name: '가족 연결, 설정 열기, 알림이 휴대폰 설정에서 꺼져 있어요'})).toBeTruthy();
    fireEvent.press(screen.getByTestId('child-notify-row'));
    await waitFor(() => expect(openSettingsSpy).toHaveBeenCalled());
    expect(request).toHaveBeenCalled();
  });

  test('켜짐: C7 \'가족 연결\' 토글(스위치) — 끄면 set_push_enabled(false), 켜면 (true)', async () => {
    android(34, true);
    const api = createFakeApi({consented: true, parentTitle: '엄마', childFamily: true});
    const set = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}));
    const row = screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'});
    expect(row.props.accessibilityState.checked).toBe(true); // my_push_settings 기본 켬
    fireEvent.press(row);
    await waitFor(() => expect(set).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}).props.accessibilityState.checked).toBe(false));
    fireEvent.press(screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}));
    await waitFor(() => expect(set).toHaveBeenLastCalledWith(true));
    await waitFor(() => expect(screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}).props.accessibilityState.checked).toBe(true));
  });

  test('C7 토글: 실패하면 되돌리고 알린다', async () => {
    android(34, true);
    const api = createFakeApi({consented: true, parentTitle: '엄마', childFamily: true});
    jest.spyOn(api, 'setPushEnabled').mockResolvedValue({ok: false, reason: 'invalid'});
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}));
    fireEvent.press(screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}));
    await waitFor(() => screen.getByTestId('toast'));
    expect(screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}).props.accessibilityState.checked).toBe(true);
  });

  test('C7: 휴대폰에서 \'family\' 채널을 끄면 꺼짐 표시 + 누르면 그 채널 설정', async () => {
    android(34, true);
    const native = require('../src/push/notifyNative');
    jest.spyOn(native, 'channelEnabled').mockResolvedValue(false);
    const openCh = jest.spyOn(native, 'openNotifySettings').mockResolvedValue(undefined);
    await openSettings();
    await waitFor(() => screen.getByRole('button', {name: '가족 연결, 설정 열기, 알림이 휴대폰 설정에서 꺼져 있어요'}));
    fireEvent.press(screen.getByTestId('child-notify-row'));
    expect(openCh).toHaveBeenCalledWith('family');
  });

  test('리드 결정: 권한이 이미 허용돼 있어도 앱을 여는 것만으로는 자녀 받기 동의(set_push_enabled)를 남기지 않는다', async () => {
    android(34, true);
    const api = createFakeApi({consented: true, parentTitle: '엄마', pushEnabled: false, childFamily: true});
    const set = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 300));
    });
    expect(set).not.toHaveBeenCalled();
  });

  test('Android 12 이하는 런타임 권한이 없어 켜짐으로 본다, 상태를 모르면(iOS 등) 행을 숨긴다', async () => {
    const {readNotifyState} = require('../src/features/child/useNotifyPermission');
    android(31, false);
    expect(await readNotifyState()).toBe('granted');
    setPlatform('ios', 17);
    expect(await readNotifyState()).toBe('unknown');
  });

  test('C3: 꺼져 있으면 "연결되면 알려 드릴게요 · 알림 켜기" 줄', async () => {
    android(34, false);
    render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'})} restore />);
    await waitFor(() => screen.getByTestId('wait-notify'));
    expect(screen.getByLabelText('연결되면 알려 드릴게요')).toBeTruthy(); // Android 렌더는 글자 대신 읽기 라벨로 찾는다
    expect(screen.getByRole('button', {name: '알림 켜기'})).toBeTruthy();
  });
});

describe('리뷰 M1: 플래그를 끄면 알림 꺼짐 안내를 숨긴다(AU-04 로 기본 켬)', () => {
  test('기본 켬, 끄면 Android 13+ 거절 상태여도 C3 줄 없음', async () => {
    const RN = require('react-native');
    const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
    Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
    Object.defineProperty(RN.Platform, 'Version', {value: 34, configurable: true, writable: true});
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const {readNotifyState, notifyFlags} = require('../src/features/child/useNotifyPermission');
    expect(notifyFlags.promptReady).toBe(true);
    notifyFlags.promptReady = false;
    try {
      expect(await readNotifyState()).toBe('unknown');
      render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'})} restore />);
      await waitFor(() => screen.getByRole('button', {name: '번호 보내기'}));
      await act(async () => {});
      expect(screen.queryByTestId('wait-notify')).toBeNull();
    } finally {
      notifyFlags.promptReady = true;
      Object.defineProperty(RN.Platform, 'OS', {value: orig.OS, configurable: true, writable: true});
      Object.defineProperty(RN.Platform, 'Version', {value: orig.Version, configurable: true, writable: true});
    }
  });
});

describe('리뷰 M4: 기기 기억값은 계정별, 로그아웃 때 정리', () => {
  test('다른 계정은 앞 계정의 본 목록을 쓰지 않는다(처음이면 배너 없음), 계정을 모르면 배너 없음', async () => {
    const store = memoryStore();
    await store.setItem('seen_parent_ids_v1:acc-a', JSON.stringify(['parent-1']));
    const api = createFakeApi({parents: [{title: '엄마'}, {title: '아빠'}], accountTag: 'acc-b'});
    render(<NewConnectionBanner api={api} onView={() => {}} store={store} />);
    await waitFor(async () => expect(await store.getItem('seen_parent_ids_v1:acc-b')).toBe(JSON.stringify(['parent-1', 'parent-2'])));
    expect(screen.queryByTestId('n3-banner')).toBeNull();
    screen.unmount();
    const none = memoryStore();
    render(<NewConnectionBanner api={createFakeApi({parents: [{title: '엄마'}], accountTag: null})} onView={() => {}} store={none} />);
    await act(async () => {});
    expect(screen.queryByTestId('n3-banner')).toBeNull();
  });

  test('C6 관심 남김은 계정별(다른 계정은 다시 \'관심 있어요\')', async () => {
    const {PaidSheet} = require('../src/features/home/PaidSheet');
    const store = memoryStore();
    await store.setItem('paid_interest_v1:acc-a', '1');
    render(<PaidSheet api={createFakeApi({accountTag: 'acc-a'})} visible onClose={() => {}} store={store} />);
    await waitFor(() => screen.getByRole('button', {name: '관심 남김'}));
    screen.unmount();
    render(<PaidSheet api={createFakeApi({accountTag: 'acc-b'})} visible onClose={() => {}} store={store} />);
    await act(async () => {});
    expect(screen.getByRole('button', {name: '관심 있어요'})).toBeTruthy();
  });

  test('clearAccountKeys: 그 계정 키만 지운다', async () => {
    const {clearAccountKeys} = require('../src/lib/accountStore');
    const store = memoryStore();
    await store.setItem('seen_parent_ids_v1:a', '[]');
    await store.setItem('paid_interest_v1:a', '1');
    await store.setItem('paid_interest_v1:b', '1');
    await clearAccountKeys(store, 'a');
    expect(await store.getItem('seen_parent_ids_v1:a')).toBeNull();
    expect(await store.getItem('paid_interest_v1:a')).toBeNull();
    expect(await store.getItem('paid_interest_v1:b')).toBe('1');
  });

  test('자녀 로그아웃: 세션을 지우기 전에 계정 가명값을 받아 두고, 로그아웃 뒤 그 계정 키를 정리', async () => {
    const accountStore = require('../src/lib/accountStore');
    const clear = jest.spyOn(accountStore, 'clearAccountKeys');
    const api = createFakeApi({consented: true, parentTitle: '엄마', accountTag: 'acc-z'});
    const order: string[] = [];
    jest.spyOn(api, 'accountTag').mockImplementation(async () => {
      order.push('tag');
      return 'acc-z';
    });
    const so = api.signOut.bind(api);
    jest.spyOn(api, 'signOut').mockImplementation(async () => {
      order.push('signOut');
      await so();
    });
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByRole('button', {name: '로그아웃'}));
    await press('로그아웃');
    const buttons = screen.getAllByRole('button', {name: '로그아웃'});
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-z'));
    expect(order.indexOf('tag')).toBeLessThan(order.indexOf('signOut'));
  });
});

describe('디자인 판정 11-18 ②③(C0 연령 줄·C6 확인 줄)', () => {
  const RN = require('react-native');
  const {color} = require('../src/ui/tokens');
  const {toneColor} = require('../src/ui/ds/roles');
  const inDock = (id: string) => {
    const dock = screen.queryByTestId('screen-dock');
    return !!dock && within(dock).queryByTestId(id) !== null;
  };
  const toEmailStage = async () => {
    await press('이메일로 시작하기');
    await waitFor(() => screen.getByRole('button', {name: '인증번호 받기'}));
  };

  test('C0: 연령 줄은 inkSub, 선택 화면은 본문 끝(v4 Q1: 하단 고정은 타사 버튼 둘만), 이메일 화면은 약관 줄 아래 연령 줄(하단 고정 안)', async () => {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2, fontScale: 1}); // jest 모의 기본 글자 배율은 2
    render(<AppRoot api={createFakeApi()} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('age-notice'));
    expect(StyleSheet.flatten(screen.getByTestId('age-notice').props.style).color).toBe(toneColor('sub', 'muted', 'child')); // v4 sub 보조색
    expect(inDock('age-notice')).toBe(false);
    await toEmailStage();
    expect(screen.getByTestId('legal-child')).toBeTruthy();
    expect(screen.getByTestId('age-notice')).toBeTruthy();
    expect(inDock('legal-child')).toBe(false); // C0 v4: 약관·연령은 본문 끝(Dock 은 인증번호 받기만)
    expect(inDock('age-notice')).toBe(false);
  });

  test('C0: 글자 150% 이상이면 약관·연령 줄을 함께 본문 끝으로', async () => {
    const dims = {width: 360, height: 640, scale: 2, fontScale: 1.5};
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue(dims);
    render(<AppRoot api={createFakeApi()} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('age-notice'));
    expect(inDock('legal-child')).toBe(false);
    expect(inDock('age-notice')).toBe(false);
  });

  test('C6: 누르면 버튼 위 초록 면 + 체크 한 줄, 화면 읽기 1회, 다시 열면 한 줄 없이 관심 남김', async () => {
    const {PaidSheet} = require('../src/features/home/PaidSheet');
    const a11y = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    const store = memoryStore();
    const api = createFakeApi({accountTag: 'acc-c6'});
    const {rerender} = render(<PaidSheet api={api} visible onClose={() => {}} store={store} />);
    await act(async () => {});
    a11y.mockClear();
    await press('관심 있어요');
    const done = screen.getByTestId('paid-done');
    expect(StyleSheet.flatten(done.props.style).backgroundColor).toBe(color.doneSoft);
    expect(within(done).getByText('관심을 남겼어요. 지금은 결제되지 않아요')).toBeTruthy();
    expect(a11y.mock.calls.filter(c => c[0] === '관심을 남겼어요. 지금은 결제되지 않아요')).toHaveLength(1);
    rerender(<PaidSheet api={api} visible={false} onClose={() => {}} store={store} />);
    rerender(<PaidSheet api={api} visible onClose={() => {}} store={store} />);
    await waitFor(() => screen.getByRole('button', {name: '관심 남김'}));
    expect(screen.queryByTestId('paid-done')).toBeNull();
  });
});

describe('L3 W2: AC-03 푸시 탭·AC-07 여러 어르신 로그아웃·AC-08 복사 확인', () => {
  const RN = require('react-native');
  const setPlatform = (OS: string, Version: number) => {
    Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
    Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
  };

  test('AC-03: 연결 알림 탭 → push_opened{push_kind}·앨범으로, 모르는 kind 는 무시', () => {
    const {handleChildPushOpen, parsePushKind, takeSkipBanner} = require('../src/features/home/pushOpen');
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    const toAlbum = jest.fn();
    expect(handleChildPushOpen(api, {kind: 'parent_reconnected'}, toAlbum)).toBe('parent_reconnected');
    expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'parent_reconnected'});
    expect(toAlbum).toHaveBeenCalledTimes(1);
    expect(takeSkipBanner()).toBe(true);
    expect(takeSkipBanner()).toBe(false); // 한 번만
    expect(handleChildPushOpen(api, {kind: 'parent_id_123'}, toAlbum)).toBeNull();
    expect(parsePushKind(null)).toBeNull();
    expect(toAlbum).toHaveBeenCalledTimes(1);
  });

  test('AC-03: 연결 알림을 눌러 들어오면 앱 안 N3 배너는 건너뛰고 본 목록만 갱신', async () => {
    const {handleChildPushOpen} = require('../src/features/home/pushOpen');
    const store = memoryStore();
    await store.setItem('seen_parent_ids_v1:fake-account', JSON.stringify(['parent-1']));
    const api = createFakeApi({parents: [{title: '엄마'}, {title: '아빠'}]});
    handleChildPushOpen(api, {kind: 'parent_connected'}, () => {});
    render(<NewConnectionBanner api={api} onView={() => {}} store={store} />);
    await waitFor(async () => expect(await store.getItem('seen_parent_ids_v1:fake-account')).toBe(JSON.stringify(['parent-1', 'parent-2'])));
    expect(screen.queryByTestId('n3-banner')).toBeNull();
  });

  test('AC-07: 어르신 두 분인 홈에서 로그아웃하면 첫 화면(역할 선택)으로', async () => {
    const api = createFakeApi({parents: [{title: '엄마'}, {title: '아빠'}]});
    const out = jest.spyOn(api, 'signOut');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByTestId('child-home-empty')); // 두 분 다 아직 답이 없다 → 첫날 빈 상태 안 B
    await press('설정');
    await waitFor(() => screen.getByRole('button', {name: '로그아웃'}));
    await press('로그아웃');
    const buttons = screen.getAllByRole('button', {name: '로그아웃'});
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => screen.getByText(/자녀 휴대폰이에요/));
    expect(out).toHaveBeenCalledTimes(1);
  });

  test('AC-08·감사 L2: 복사하면 토스트 대신 번호 카드 바로 위 인라인 \'복사했어요\' 띠(2초, polite) — 시스템 클립보드 미리보기와 겹치지 않음', async () => {
    const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
    // 100% 기준(카드 바로 위 띠). 큰 글자에서는 복사하기 옆으로 간다(PR #83 재확인 2 L11, childScreensV3)
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    try {
      for (const v of [33, 32]) {
        setPlatform('android', v);
        render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'})} restore />);
        await waitFor(() => screen.getByRole('button', {name: '복사하기'}), {timeout: 8000});
        const said = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
        await press('복사하기');
        expect(screen.queryByTestId('toast')).toBeNull();
        expect(screen.getByTestId('wait-copied')).toBeTruthy();
        expect(said).toHaveBeenCalledWith('복사했어요'); // v4 ds Banner: 나타날 때 한 번 읽어 준다(live region 대신)
        // 번호 카드 바로 위(카드보다 앞)
        const ids = screen.root.findAll(n => typeof n.type === 'string' && ['wait-copied', 'wait-code'].includes(n.props.testID)).map(n => n.props.testID);
        expect(ids).toEqual(['wait-copied', 'wait-code']);
        await act(async () => {
          await new Promise<void>(r => setTimeout(() => r(), 2100));
        });
        expect(screen.queryByTestId('wait-copied')).toBeNull();
        screen.unmount();
      }
    } finally {
      setPlatform(orig.OS, orig.Version);
    }
  });
});

describe('재검토 R1·R2', () => {
  test('R1: 응원 대기 중 홈이 언마운트되면 보내고, 남은 \'취소\' 토스트를 거둔다', async () => {
    const {useSendCheer} = require('../src/features/home/useSendCheer');
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    function Home() {
      const {send: go} = useSendCheer(api, () => {});
      return <Text onPress={() => go('thanks_always', [P({parentId: 'parent-1', title: '엄마'})])}>보내기</Text>;
    }
    function Root({on}: {on: boolean}) {
      return <ToastProvider>{on ? <Home /> : <Text>다른 화면</Text>}</ToastProvider>;
    }
    const {rerender} = render(<Root on />);
    fireEvent.press(screen.getByText('보내기'));
    expect(screen.getByRole('button', {name: '되돌리기'})).toBeTruthy();
    rerender(<Root on={false} />);
    await act(async () => {});
    expect(send).toHaveBeenCalledWith('parent-1', 'thanks_always', expect.stringMatching(/^[0-9a-f-]{36}$/)); // request_id(서버 0059)
    const undo = screen.queryByRole('button', {name: '되돌리기'});
    expect(undo === null || undo.props.accessibilityState?.disabled === true).toBe(true);
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 400));
    });
    expect(screen.queryByRole('button', {name: '되돌리기'})).toBeNull();
  });

  test('R2: 로그아웃이 실패해도 이 계정의 기기 기억값은 정리', async () => {
    const accountStore = require('../src/lib/accountStore');
    const clear = jest.spyOn(accountStore, 'clearAccountKeys');
    const api = createFakeApi({consented: true, parentTitle: '엄마', accountTag: 'acc-r2'});
    jest.spyOn(api, 'signOut').mockRejectedValue(new Error('boom'));
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByRole('button', {name: '로그아웃'}));
    await press('로그아웃');
    const buttons = screen.getAllByRole('button', {name: '로그아웃'});
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-r2'));
  });
});

describe('독립 UX 감사 11-18(자녀·연결 화면)', () => {
  const RN = require('react-native');
  test('M10·디자인 결정 a: C1 호칭은 ds Choice 2열(7개, 칸 높이 56 이상), 글자 150% 이상이면 1열, BackLink \'처음으로\'는 역할 선택으로', async () => {
    const dims = (fontScale: number) => jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale});
    dims(1);
    render(<AppRoot api={createFakeApi({who: 'child'})} restore />);
    await waitFor(() => screen.getByTestId('title-group'));
    expect(StyleSheet.flatten(screen.getByTestId('title-group').props.style).flexDirection).not.toBe('row'); // #115 L1: 재기 전에는 1열
    fireEvent(screen.getByTestId('title-group'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    const group = screen.getByTestId('title-group');
    expect(StyleSheet.flatten(group.props.style).flexDirection).toBe('row'); // 2열(행 우선 — 읽는 순서 = 시선 흐름)
    expect(StyleSheet.flatten(group.props.style).rowGap).toBe(8); // 디자인 리뷰 11-20 ②: 줄 사이 12 → 8(R-12 8 이상)
    expect(StyleSheet.flatten(group.props.style).columnGap).toBe(12); // 칸 사이(좌우)는 그대로
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님']);
    for (const r of radios) {
      const st = StyleSheet.flatten(typeof r.props.style === 'function' ? r.props.style({pressed: false}) : r.props.style);
      expect(st.minHeight).toBeGreaterThanOrEqual(56);
    }
    expect(within(group).getByRole('radio', {name: '부모님'}).props.accessibilityState).toMatchObject({checked: true});
    // 디자인 시스템 패널 r1: 자녀 스택 루트 AudienceProvider child → 주 버튼은 자녀 56(어르신 72 아님), 선택지는 반경 16·테두리 1.5
    const primary = StyleSheet.flatten(screen.getByRole('button', {name: '번호 만들기'}).props.style);
    expect(primary.minHeight).toBe(56);
    const cell = StyleSheet.flatten(within(group).getByRole('radio', {name: '엄마'}).props.style);
    expect(cell).toMatchObject({borderRadius: 6, borderWidth: 1.5}); // v5 반경 4단: 선택지 6
    screen.unmount();
    dims(2); // 200%: 칸이 좁아 글이 꺾이지 않게 1열
    render(<AppRoot api={createFakeApi({who: 'child'})} restore />);
    await waitFor(() => screen.getByTestId('title-group'));
    expect(StyleSheet.flatten(screen.getByTestId('title-group').props.style).flexDirection).not.toBe('row');
    await act(async () => fireEvent.press(screen.getByRole('link', {name: '처음으로'})));
    await waitFor(() => screen.getByText(/자녀 휴대폰이에요/));
  });

  test('P-12: C1 Dock 에 \'지금은 부모님 폰이 안드로이드일 때만 연결돼요\' 한 줄(번호 만들기 아래, 보내기 전에 안다)', async () => {
    // 100% 기준(jest 기본 글자 배율은 2 — 1.6배 이상이면 안내 줄은 본문 끝으로, 대기열 44 M3 · c1BigText.test)
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    render(<AppRoot api={createFakeApi({who: 'child'})} restore />);
    await waitFor(() => screen.getByTestId('title-group'));
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getByText('지금은 부모님 폰이 안드로이드일 때만 연결돼요')).toBeTruthy();
    expect(dock.getByTestId('dock-note')).toBeTruthy();
  });

  test('#203 리뷰: 줄 사이 8 은 \'자녀 + 2열 지정\' Choice 공통(C1·C7 시트·C4 호칭 겹침), 어르신·1열 지정 목록은 그대로', () => {
    const {AudienceProvider, Choice} = require('../src/ui/ds');
    const {CHOICE_CHILD_GRID_ROW_GAP} = require('../src/ui/ds/Choice');
    expect(CHOICE_CHILD_GRID_ROW_GAP).toBe(8);
    const items = [{key: 'a', label: '엄마'}, {key: 'b', label: '아빠'}];
    const gapOf = (audience: 'child' | 'elder', columns: 1 | 2) => {
      const r = render(
        <AudienceProvider value={audience}>
          <Choice mode="radio" columns={columns} testID="ch" items={items} value="a" onSelect={() => {}} />
        </AudienceProvider>,
      );
      const st = StyleSheet.flatten(screen.getByTestId('ch').props.style);
      r.unmount();
      return st.rowGap;
    };
    expect(gapOf('child', 2)).toBe(8);
    expect(gapOf('child', 1)).toBeUndefined(); // 응원 시트 등 1열 목록은 공통 간격(12)
    expect(gapOf('elder', 2)).toBeUndefined();
    // 쓰는 화면이 모두 '자녀 + columns={2}' 인지(새 화면이 2열을 쓰면 여기 목록을 다시 본다)
    const fs = require('fs');
    const path = require('path');
    const users = ['features/child/RelationScreen.tsx', 'features/child/ChildSettings.tsx', 'features/home/TitleDupNotice.tsx'];
    for (const f of users) {
      expect(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).toMatch(/columns=\{2\}/);
    }
  });

  test('V9: C1 → C2 없이 바로 C3(스택에 C1 이 남지 않음), 측정 이벤트는 C1 번호 발급 1번 + C3 보내기·복사', async () => {
    const api = createFakeApi({who: 'child'});
    const log = jest.spyOn(api, 'logEvent');
    jest.spyOn(RN.Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
    jest.spyOn(require('../src/ui/clipboard'), 'copyText').mockReturnValue(true);
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('title-group'));
    await press('번호 만들기');
    await waitFor(() => screen.getByTestId('wait-code'));
    expect(screen.queryByText('번호가 만들어졌어요')).toBeNull();
    expect(screen.queryByTestId('title-group')).toBeNull(); // C1 은 스택에서 내려감(reset)
    const ev = (name: string) => log.mock.calls.filter(c => c[0] === name).map(c => c[1]);
    expect(ev('invite_code_issued')).toEqual([{purpose: 'parent_code'}]);
    await press('번호 보내기');
    await press('복사하기');
    await waitFor(() => expect(ev('invite_share_tapped')).toEqual([{channel: 'share_sheet'}, {channel: 'copy'}]));
  });

  test('M7: 약관 줄의 두 낱말은 주소가 있으면 링크(굵게·밑줄·읽기 역할 링크), 없으면 일반 글자', () => {
    const {LegalText} = require('../src/ui/LegalText');
    const {legalLinks} = require('../src/shared/legalLinks');
    const open = jest.spyOn(RN.Linking, 'openURL').mockResolvedValue(true);
    render(<LegalText text="연결하면 이용약관에 동의하고 개인정보 처리방침을 확인하게 돼요" links={legalLinks({terms: 'https://t.example', privacy: 'https://p.example'})} />);
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.props.children)).toEqual(['이용약관', '개인정보 처리방침']);
    expect(StyleSheet.flatten(links[0].props.style)).toMatchObject({fontWeight: 'bold', textDecorationLine: 'underline'});
    fireEvent.press(links[1]);
    expect(open).toHaveBeenCalledWith('https://p.example');
    screen.unmount();
    render(<LegalText text="연결하면 이용약관에 동의하고 개인정보 처리방침을 확인하게 돼요" links={legalLinks({terms: null, privacy: null})} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0); // 누를 수 없는데 링크처럼 보이지 않게
  });

  test('리뷰 M2 구조: 링크가 있으면 줄 높이 48(누름 영역), 문장은 한 번 읽고 TalkBack 동작으로 각 링크를 연다, 여는 곳은 주입(앱 안 웹 화면 자리)', () => {
    const {LegalText, LEGAL_LINK_LINE_H} = require('../src/ui/LegalText');
    const {legalLinks} = require('../src/shared/legalLinks');
    const onOpen = jest.fn();
    const text = '연결하면 이용약관에 동의하고 개인정보 처리방침을 확인하게 돼요';
    render(<LegalText testID="legal" text={text} links={legalLinks({terms: 'https://t.example', privacy: 'https://p.example'})} onOpen={onOpen} />);
    const line = screen.getByTestId('legal');
    expect(LEGAL_LINK_LINE_H).toBeGreaterThanOrEqual(48);
    expect(StyleSheet.flatten(line.props.style).lineHeight).toBe(LEGAL_LINK_LINE_H);
    expect(line.props.accessibilityLabel).toBe(text);
    expect(line.props.accessibilityActions.map((x: {label: string}) => x.label)).toEqual(['이용약관', '개인정보 처리방침']); // 순서: 문장 → 이용약관 → 처리방침
    fireEvent(line, 'accessibilityAction', {nativeEvent: {actionName: 'link-0'}});
    expect(onOpen).toHaveBeenCalledWith('https://t.example', '이용약관', 'terms');
    fireEvent.press(screen.getAllByRole('link')[1]);
    expect(onOpen).toHaveBeenLastCalledWith('https://p.example', '개인정보 처리방침', 'privacy');
  });

  test('C4 호칭 겹침 시트도 같은 2열 Choice(막힌 이름 비활성·보조 줄), 글자 100%', async () => {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    render(<AppRoot api={createFakeApi({parents: [{title: '엄마'}, {title: '엄마'}]})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '이름 고르기'}));
    await press('이름 고르기');
    fireEvent(screen.getByTestId('title-dup-options'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    const grid = screen.getByTestId('title-dup-options');
    expect(StyleSheet.flatten(grid.props.style).flexDirection).toBe('row');
    expect(within(grid).getByLabelText('엄마, 이미 쓰는 이름, 사용할 수 없음').props.accessibilityState.disabled).toBe(true);
  });
});

describe('PR1 리뷰 M1: 자녀 약관·방침 동의 기록', () => {
  test('로그인 성공 직후 record_terms_agreement(v1·v1), 실패하면 이 계정에 남기고 다음 시작 때 한 번만 다시', async () => {
    const {recordChildTerms, retryChildTerms} = require('../src/shared/childTerms');
    const store = memoryStore();
    const api = createFakeApi({accountTag: 'acc-t'});
    const rec = jest.spyOn(api, 'recordTermsAgreement');
    expect(await recordChildTerms(api, store)).toBe(true);
    expect(rec).toHaveBeenCalledWith('v1', 'v1');
    expect(await store.getItem('terms_pending_v1:acc-t')).toBeNull();
    rec.mockRejectedValueOnce(new Error('offline'));
    expect(await recordChildTerms(api, store)).toBe(false);
    expect(await store.getItem('terms_pending_v1:acc-t')).toBe('1');
    rec.mockClear();
    rec.mockRejectedValueOnce(new Error('offline')); // 다시 보내기도 실패하면 표시를 남긴다(재확인 4 M8)
    await retryChildTerms(api, store);
    expect(await store.getItem('terms_pending_v1:acc-t')).toBe('1');
    await retryChildTerms(api, store); // 다음 시작: 성공 → 지움
    expect(rec).toHaveBeenCalledTimes(2);
    expect(await store.getItem('terms_pending_v1:acc-t')).toBeNull();
    await retryChildTerms(api, store); // 남은 것이 없으면 부르지 않는다
    expect(rec).toHaveBeenCalledTimes(2);
  });

  test('C0 소셜 로그인에 성공하면 기록한다(약관 줄을 본 그 로그인)', async () => {
    const api = createFakeApi();
    const rec = jest.spyOn(api, 'recordTermsAgreement');
    jest.spyOn(api, 'signInWithSocial').mockResolvedValue('ok');
    render(<AppRoot api={api} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('legal-child'));
    await press(/카카오/);
    await waitFor(() => expect(rec).toHaveBeenCalledWith('v1', 'v1'));
  });

  test('로그인을 취소하면 기록하지 않는다', async () => {
    const api = createFakeApi();
    const rec = jest.spyOn(api, 'recordTermsAgreement');
    jest.spyOn(api, 'signInWithSocial').mockResolvedValue('cancelled');
    render(<AppRoot api={api} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('legal-child'));
    await press(/카카오/);
    await act(async () => {});
    expect(rec).not.toHaveBeenCalled();
  });

  test('로그아웃·계정 삭제 정리 대상에 다시 보낼 표시도 들어간다', async () => {
    const {clearAccountKeys} = require('../src/lib/accountStore');
    const store = memoryStore();
    await store.setItem('terms_pending_v1:z', '1');
    await clearAccountKeys(store, 'z');
    expect(await store.getItem('terms_pending_v1:z')).toBeNull();
  });
});

describe('CG 자녀 시작 결정(v4 공통 상태, 남은 자녀 화면 6번)', () => {
  test('어르신 폰 막음: 제목 머리글 + 안내 + Dock 처음으로(자녀 56, A5 닫기 말), BackLink 처음으로 → 역할 선택', async () => {
    render(<AppRoot api={createFakeApi({linked: true})} />);
    await act(async () => fireEvent.press(screen.getByText(/자녀 휴대폰이에요/)));
    await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
    expect(screen.getByRole('header', {name: '이 폰은 부모님 휴대폰으로 쓰고 있어요'})).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByRole('button', {name: '처음으로'}).props.style).minHeight).toBe(56);
    await act(async () => fireEvent.press(screen.getByRole('link', {name: '처음으로'})));
    await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  });
  test('확인 실패: StateView 오류(머리글·다시 하기), 다시 하면 결정이 이어진다', async () => {
    const api = createFakeApi({who: 'child'});
    render(<AppRoot api={api} />);
    const who = jest.spyOn(api, 'whoAmI').mockRejectedValue(new Error('network down'));
    await act(async () => fireEvent.press(screen.getByText(/자녀 휴대폰이에요/)));
    await waitFor(() => screen.getByTestId('child-gate-error'));
    who.mockRestore();
    expect(within(screen.getByTestId('child-gate-error')).getByRole('header')).toBeTruthy();
    await act(async () => fireEvent.press(within(screen.getByTestId('child-gate-error')).getByRole('button')));
    await waitFor(() => screen.getByTestId('title-group'));
  });
  test('PR #98 리뷰 L1: 불러오는 중 StateView 제목은 머리글로 읽히지 않는다(빈·오류는 머리글)', () => {
    const {StateView} = require('../src/ui/ds');
    render(<StateView kind="loading" title="잠시만요" />);
    expect(screen.queryByRole('header')).toBeNull();
    screen.unmount();
    render(<StateView kind="error" title="문제가 생겼어요" />);
    expect(screen.getByRole('header', {name: '문제가 생겼어요'})).toBeTruthy();
  });
});
