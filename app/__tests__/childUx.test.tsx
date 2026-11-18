// 자녀 UX 승인안(DECISIONS 11-18, ux-improvements-2026-11-18): U2 토스트 자리, U10 응원 취소, U12 C3 공유 뒤 안내,
// C4 호칭 겹침(시안 C4_title_dup), N3 앱 안 배너(시안 N3_connected), C0 연령 안내
import React from 'react';
import {AppState, PixelRatio, Share, StyleSheet, Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {ToastProvider, useToast} from '../src/ui/Toast';
import {Screen} from '../src/ui/Screen';
import {BottomSheet} from '../src/ui/BottomSheet';
import {toastBottom} from '../src/ui/toastPlacement';
import {cheerUndoMs} from '../src/features/home/useSendCheer';
import {findTitleDup} from '../src/features/home/titleDup';
import {newConnection, parseSeen} from '../src/features/home/newConnection';
import {NewConnectionBanner} from '../src/features/home/NewConnectionBanner';
import {memoryStore} from '../src/lib/kvStore';
import {press} from '../testUtils/flow';
import type {ChildParent} from '../src/features/types';

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

describe('U10 응원 취소', () => {
  test('취소 가능 시간 = 토스트 표시 시간: 4초, 화면 읽기·글자 200%면 6초', () => {
    expect(cheerUndoMs(false, 1)).toBe(4000);
    expect(cheerUndoMs(true, 1)).toBe(6000);
    expect(cheerUndoMs(false, 2)).toBe(6000);
  });

  async function pickCheer(api: ReturnType<typeof createFakeApi>) {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
  }

  test('취소를 누르면 서버로 보내지 않고 "응원을 보내지 않았어요"(한도에 안 셈)', async () => {
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const send = jest.spyOn(api, 'sendCheer');
    await pickCheer(api);
    expect(within(screen.getByTestId('toast')).getByText('엄마께 보냈어요')).toBeTruthy();
    await press('취소');
    await waitFor(() => screen.getByText('응원을 보내지 않았어요'));
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 4200));
    });
    expect(send).not.toHaveBeenCalled();
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
    expect(send).toHaveBeenCalledWith('parent-1', 'thanks_always');
  });
});

describe('U12 C3 공유 뒤', () => {
  test('공유 창에서 돌아오면 칩은 그대로, 안내 한 줄 + 주 버튼이 보조 "다시 보내기"로', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({action: Share.sharedAction} as never);
    render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'})} restore />);
    await waitFor(() => screen.getByRole('button', {name: '번호 보내기'}), {timeout: 8000});
    await press('번호 보내기');
    await waitFor(() => screen.getByTestId('wait-after-share'));
    expect(screen.getByText('번호를 보냈다면 다시 보내지 않아도 돼요')).toBeTruthy();
    expect(screen.getByText('연결 기다리는 중')).toBeTruthy();
    expect(screen.getByRole('button', {name: '다시 보내기'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: '번호 보내기'})).toBeNull();
  });

  test('번호 기간이 지났으면 새 번호 만들기 근처에 "새 번호를 만들면 보낸 번호는 쓸 수 없어요"', async () => {
    render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, childCodeExpired: true})} restore />);
    await waitFor(() => screen.getByText('새 번호를 만들면 보낸 번호는 쓸 수 없어요'), {timeout: 8000});
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
    expect(chips.props.accessibilityLabel).toBe('부모님 고르기');
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
    await store.setItem('seen_parent_ids_v1', JSON.stringify(['parent-1']));
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
    expect(screen.getByText('로그인하면 이용약관과 개인정보 처리방침에 동의하게 돼요')).toBeTruthy();
    expect(screen.getByText('만 14세 이상이 쓰는 앱이에요')).toBeTruthy();
  });
});

describe('호칭 고르기(가족 기본 호칭) D-L1', () => {
  test('서버가 duplicate_title 이면 "같은 이름이 이미 있어요" 안내(일반 오류 아님)', async () => {
    const api = createFakeApi({who: 'child'});
    jest.spyOn(api, 'setParentTitle').mockResolvedValue({ok: false, reason: 'duplicate_title'});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByLabelText('엄마'), {timeout: 8000});
    fireEvent.press(screen.getByLabelText('엄마'));
    await press('번호 만들기');
    await waitFor(() => screen.getByText('같은 이름이 이미 있어요. 다른 이름을 골라 주세요'));
  });
});

describe('AC-01 C6 곧 유료 시트', () => {
  const items = [{answeredDate: '2020-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'}];
  async function openPaid(api: ReturnType<typeof createFakeApi>) {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('tab', {name: '지난 답'}));
    await act(async () => {
      fireEvent.press(screen.getByRole('tab', {name: '지난 답'}));
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
  function android(version: number, granted: boolean) {
    setPlatform('android', version);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(granted);
    return jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
  }
  afterEach(() => {
    setPlatform(orig.OS, orig.Version);
  });

  async function openSettings() {
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마'})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
  }

  test('Android 13+ 꺼짐: C7 알림 행 "알림이 휴대폰 설정에서 꺼져 있어요" + 눌러서 켜기(거절 상태면 휴대폰 설정)', async () => {
    const request = android(34, false);
    const openSettingsSpy = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    await openSettings();
    await waitFor(() => screen.getByTestId('child-notify-row'));
    expect(screen.getByRole('button', {name: '알림, 설정 열기, 알림이 휴대폰 설정에서 꺼져 있어요'})).toBeTruthy();
    fireEvent.press(screen.getByTestId('child-notify-row'));
    await waitFor(() => expect(openSettingsSpy).toHaveBeenCalled());
    expect(request).toHaveBeenCalled();
  });

  test('켜짐: C7 알림 행은 무엇을 알려 주는지(누르는 행 아님)', async () => {
    android(34, true);
    await openSettings();
    await waitFor(() => screen.getByTestId('child-notify-row'));
    expect(screen.getByLabelText('알림, 가족 휴대폰과 연결되거나 연결이 풀리면 알려 드려요')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /알림이 휴대폰 설정에서/})).toBeNull();
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
    await waitFor(() => screen.getByTestId('wait-notify'), {timeout: 8000});
    expect(screen.getByLabelText('연결되면 알려 드릴게요')).toBeTruthy(); // Android 렌더는 글자 대신 읽기 라벨로 찾는다
    expect(screen.getByRole('button', {name: '알림 켜기'})).toBeTruthy();
  });
});
