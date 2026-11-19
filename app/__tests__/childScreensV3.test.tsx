// 자녀 화면 v3(C3 대기·C4 홈·응원·C5 지난 답·C7 설정·탭 바): 시안 C3_wait·C4_home(_states)·C5_history·C7_settings_v2, copy-v3 10절
import React from 'react';
import {AppState, Share} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import * as clipboard from '../src/ui/clipboard';
import {press} from '../testUtils/flow';

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const waitApi = (o: Parameters<typeof createFakeApi>[0] = {}) => createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', ...o});
const openWait = async (api: ReturnType<typeof createFakeApi>) => {
  render(<AppRoot api={api} restore />);
  // 파일 첫 렌더는 모듈 첫 로드(사진·SVG)로 느릴 수 있다
  await waitFor(() => screen.getByTestId('wait-code'), {timeout: 8000});
};
jest.setTimeout(20000);
// U10: 응원은 '취소' 가능 시간(토스트 표시 4초) 뒤에 보낸다. jest 의 RN 모의 PixelRatio 는 글자 배율 2를 돌려주므로 1로(그대로면 6초)
beforeEach(() => {
  jest.spyOn(require('react-native').PixelRatio, 'getFontScale').mockReturnValue(1);
});
// U10 '취소' 시간(4초)이 지나야 실제로 보낸다. 실제로 4초를 자면 부하 때 테스트 제한(20초)에 닿으므로(2026-11-19 측정: 이 4개가 파일에서
// 가장 느린 4.2초씩) 가짜 시계로 넘긴다 — 쓰는 테스트는 맨 앞에서 useCheerClock()
const useCheerClock = () => jest.useFakeTimers();
const afterUndoWindow = () =>
  act(async () => {
    jest.advanceTimersByTime(4100);
  });
const openTab = async (name: string) => {
  await waitFor(() => screen.getByRole('tab', {name}));
  await act(async () => {
    fireEvent.press(screen.getByRole('tab', {name}));
  });
};

describe('C3 연결 대기', () => {
  const RN = require('react-native');
  const dims = (fontScale: number) => jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale});
  beforeEach(() => {
    dims(1); // jest 모의 기본 글자 배율은 2 → 100% 기준으로(200%는 테스트 안에서)
  });

  test('리뷰 M1: 보는 중에 번호가 만료되면 화면 읽기에 한 번 알린다(카드 → 만료 띠)', async () => {
    const handlers: ((st: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (st: string) => void) => {
      handlers.push(h);
      return {remove: () => {}};
    }) as never);
    const said = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    const api = waitApi();
    await openWait(api);
    expect(said).not.toHaveBeenCalledWith(expect.stringContaining('번호 기간이 지났어요'));
    const expiredApi = waitApi({childCodeExpired: true});
    jest.spyOn(api, 'getChildState').mockImplementation(() => expiredApi.getChildState());
    await act(async () => {
      handlers.forEach(h => h('active')); // 앞으로 돌아와 다시 확인 → 만료
    });
    await waitFor(() => screen.getByText('번호 기간이 지났어요'));
    expect(said).toHaveBeenCalledWith('번호 기간이 지났어요. 새 번호를 만들어 다시 보내 주세요');
  });

  test('리뷰 L1: 공유 창에서 돌아오면 안내 줄을 한 번 읽어 준다', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
    const said = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    await openWait(waitApi());
    await press('번호 보내기');
    await waitFor(() => screen.getByTestId('wait-after-share'));
    expect(said).toHaveBeenCalledWith('번호를 보냈다면 다시 보내지 않아도 돼요');
  });

  test('디자인 결정 #83 ①: 번호 카드는 흰 면 + line 1.5 테두리(outlined)', async () => {
    await openWait(waitApi());
    const {StyleSheet} = require('react-native');
    const {ds} = require('../src/ui/ds/roles');
    const st = StyleSheet.flatten(screen.getByTestId('wait-code').props.style);
    expect(st.borderWidth).toBe(1.5);
    expect(st.borderColor).toBe(ds.color.line);
    expect(st.backgroundColor).toBe(ds.color.card);
  });

  test('디자인 결정 #83 ②: 200%에서는 Dock = 주 버튼 하나, 복사하기는 본문 끝·알림 줄은 카드 바로 아래', async () => {
    dims(2);
    const notifyMod = require('../src/features/child/useNotifyPermission');
    jest.spyOn(notifyMod, 'useNotifyPermission').mockReturnValue({denied: true, open: jest.fn()});
    const spy = jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    await openWait(waitApi());
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual([expect.stringMatching(/번호 보내기/)]);
    const body = within(screen.getByTestId('screen-body'));
    expect(within(screen.getByTestId('wait-code')).queryByTestId('wait-notify')).toBeNull();
    expect(body.getByTestId('wait-notify')).toBeTruthy();
    const order = screen.root.findAll(n => typeof n.type === 'string' && ['wait-code', 'wait-notify', 'wait-steps', 'wait-copy'].includes(n.props.testID)).map(n => n.props.testID);
    expect(order).toEqual(['wait-code', 'wait-notify', 'wait-steps', 'wait-copy']);
    await press('복사하기');
    expect(spy).toHaveBeenCalledWith('123456');
    // 재확인 2 L11: '복사했어요' 띠는 본문 끝 복사하기 바로 위(카드 위가 아니라)
    const ids = screen.root.findAll(n => typeof n.type === 'string' && ['wait-code', 'wait-steps', 'wait-copied', 'wait-copy'].includes(n.props.testID)).map(n => n.props.testID);
    expect(ids).toEqual(['wait-code', 'wait-steps', 'wait-copied', 'wait-copy']);
  });

  test('디자인 결정 #83 ③(R-15): 첫 화면 끝이 단계 행을 가르면 그 행 위에 잰 만큼 간격 → 통째로 접힘 밖, 걸치지 않으면 간격 없음', async () => {
    await openWait(waitApi());
    const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
    const {StyleSheet} = require('react-native');
    const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).marginTop;
    await act(async () => {
      lay('screen-body-area', 0, 504); // 본문 영역 504 → 접힘 = 504 − 띠 24 = 480(재확인 H1)
      lay('wait-steps', 300, 300); // 묶음 위 끝 300, 요소 사이 12
      lay('wait-steps-title', 0, 28); // 300~328
      lay('wait-step-1', 0, 32); // 340~372
      lay('wait-step-2', 0, 48); // 384~432
      lay('wait-step-3', 0, 48); // 444~492 → 480 에 걸림
    });
    expect(mt('wait-step-3')).toBe(480 - 444 + 1); // foldPush 공용 계산(PR 91 L1)은 접힘 바로 아래로 1 더
    expect(mt('wait-step-2')).toBeUndefined();
    // 간격이 들어간 뒤 같은 높이로 다시 와도 흔들리지 않는다(높이만으로 계산)
    await act(async () => {
      lay('wait-step-3', 36, 48);
    });
    expect(mt('wait-step-3')).toBe(37);
    // 재확인 H1: 맨 아래로 내려 띠가 사라져 스크롤 창이 커져도(504) 다시 나와도(480) 접힘 기준(본문 영역 − 띠)은 그대로
    await act(async () => {
      lay('screen-body', 0, 504);
    });
    expect(mt('wait-step-3')).toBe(37);
    await act(async () => {
      lay('screen-body', 0, 480);
    });
    expect(mt('wait-step-3')).toBe(37);
    // 본문 영역 자체가 커져 다 들어가면 간격 없음
    await act(async () => {
      lay('screen-body-area', 0, 624);
    });
    expect(mt('wait-step-3')).toBeUndefined();
  });

  test('재확인 L9: 첫 단계가 걸치면 묶음 제목과 함께 민다(첫 화면 끝에 제목만 남지 않게)', async () => {
    await openWait(waitApi());
    const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
    const {StyleSheet} = require('react-native');
    const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).marginTop;
    await act(async () => {
      lay('screen-body-area', 0, 404); // 접힘 380
      lay('wait-steps', 300, 300);
      lay('wait-steps-title', 0, 28); // 300~328
      lay('wait-step-1', 0, 72); // 340~412 → 380 에 걸림
      lay('wait-step-2', 0, 48);
      lay('wait-step-3', 0, 48);
    });
    expect(mt('wait-steps-title')).toBe(380 - 300 + 1); // 제목째 접힘 밖(foldPush +1)
    expect(mt('wait-step-1')).toBeUndefined();
  });

  test('재확인 L7: 처음 열 때부터 만료면 알리지 않는다(제목 읽기와 겹치지 않게)', async () => {
    const said = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    said.mockClear(); // 앞 테스트에서 쌓인 호출 지움
    render(<AppRoot api={waitApi({childCodeExpired: true})} restore />);
    await waitFor(() => screen.getByText('번호 기간이 지났어요'));
    expect(said).not.toHaveBeenCalledWith(expect.stringContaining('번호 기간이 지났어요'));
  });

  test('C3 v4: 제목·설정 → 번호 카드(번호·만료 시각) → 3단계, 연결 칩·예시 카드 없음, 만료 전에는 새 번호 만들기가 없다', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
    await openWait(waitApi());
    expect(screen.getByText('연결 기다리는 중')).toBeTruthy();
    expect(screen.getByText('123 456')).toBeTruthy();
    expect(screen.getByLabelText(/^연결 번호 1 2 3, 4 5 6, .*까지 쓸 수 있어요$/)).toBeTruthy(); // 번호+기한 한 덩어리(L6)
    expect(screen.getByText(/까지 쓸 수 있어요$/)).toBeTruthy();
    expect(screen.getByText('엄마 폰에 가화만사성을 설치하고 열어요')).toBeTruthy();
    expect(screen.getByText("링크로 열면 번호를 확인하고 '이 번호로 연결하기'를 눌러요")).toBeTruthy();
    expect(screen.getByText('답을 보여 줄지 고르면 돼요')).toBeTruthy();
    expect(screen.queryByTestId('wait-example')).toBeNull(); // V9: 예시 카드 없음
    expect(screen.queryByTestId('wait-chip')).toBeNull(); // V9: 연결 칩 삭제
    // Dock = 주 '번호 보내기' + 보조 '복사하기'
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getByRole('button', {name: '번호 보내기'})).toBeTruthy();
    expect(dock.getByRole('button', {name: '복사하기'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: '새 번호 만들기'})).toBeNull();
    expect(screen.queryByTestId('child-tab-bar')).toBeNull(); // 연결 전 탭 바 숨김
    await press('번호 보내기');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('\n123 456\n')}));
    expect(share.mock.calls[0][0]).toMatchObject({message: expect.stringContaining('까지 쓸 수 있어요.')});
  });

  test('V9: 알림 꺼짐이면 알림 줄은 번호 카드 안(3단계 위), 켜져 있으면 줄 없음', async () => {
    const notifyMod = require('../src/features/child/useNotifyPermission');
    const spy = jest.spyOn(notifyMod, 'useNotifyPermission').mockReturnValue({denied: true, open: jest.fn()});
    await openWait(waitApi());
    const card = within(screen.getByTestId('wait-code'));
    expect(card.getByText('연결되면 알려 드릴게요')).toBeTruthy();
    expect(card.getByRole('button', {name: '알림 켜기'})).toBeTruthy();
    const text = JSON.stringify(screen.toJSON());
    expect(text.indexOf('연결되면 알려 드릴게요')).toBeLessThan(text.indexOf('이렇게 하시면 돼요'));
    screen.unmount();
    spy.mockReturnValue({denied: false, open: jest.fn()});
    await openWait(waitApi());
    expect(screen.queryByTestId('wait-notify')).toBeNull();
  });

  test('복사하기 → 번호 카드 위 \'복사했어요\' 띠(감사 L2, 토스트 아님)', async () => {
    const spy = jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    await openWait(waitApi());
    await press('복사하기');
    expect(spy).toHaveBeenCalledWith('123456');
    expect(screen.getByTestId('wait-copied')).toBeTruthy();
  });

  test('번호 기간이 지나면 안내 상자 + 새 번호 만들기, 만들면 토스트와 "전에 보낸 번호" 안내', async () => {
    const api = waitApi({childCodeExpired: true});
    const issue = jest.spyOn(api, 'issueInviteCode');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByText('번호 기간이 지났어요'));
    expect(screen.getByText('새 번호를 만들어 다시 보내 주세요')).toBeTruthy();
    expect(screen.getByText('연결 기다리는 중')).toBeTruthy(); // v4: 제목은 그대로, 번호 카드·3단계 대신 안내 띠
    expect(screen.queryByTestId('wait-steps')).toBeNull();
    expect(screen.queryByText('새 번호를 만들면 보낸 번호는 쓸 수 없어요')).toBeNull(); // 디자인 결정 L2(a)
    await press('새 번호 만들기');
    await waitFor(() => screen.getByText('123 456'));
    expect(issue).toHaveBeenCalledTimes(1);
    expect(screen.getByText('새 번호를 만들었어요')).toBeTruthy();
    expect(screen.getByText('전에 보낸 번호는 이제 쓸 수 없어요')).toBeTruthy();
    expect(screen.getByRole('button', {name: '번호 보내기'})).toBeTruthy();
  });

  test('상단 설정으로 C7 에 갈 수 있다(연결 전: 새 폰 연결 번호 없음)', async () => {
    await openWait(createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', parents: []}));
    await press('설정');
    await waitFor(() => screen.getByText('부르는 이름'));
    expect(screen.queryByText('새 폰 연결 번호')).toBeNull();
    screen.unmount();
  });

  test('M1: 대기 화면 위에 다른 화면이 있으면 15초 확인을 멈추고, 돌아오면 한 번 확인 후 다시 돈다', async () => {
    jest.useFakeTimers();
    try {
      const api = waitApi({parents: []});
      const get = jest.spyOn(api, 'getChildState');
      await openWait(api);
      await press('설정');
      await waitFor(() => screen.getByText('부르는 이름'));
      const n = get.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(15000 * 3);
      });
      expect(get.mock.calls.length).toBe(n); // 가려진 동안 확인 없음
      await press('이전 화면으로 가기');
      await waitFor(() => screen.getByText('연결 기다리는 중'));
      expect(get.mock.calls.length).toBe(n + 1); // 다시 보일 때 한 번
      await act(async () => {
        jest.advanceTimersByTime(15000);
      });
      expect(get.mock.calls.length).toBe(n + 2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('M4: 새 번호 직후 먼저 떠난 확인이 늦게 와도 번호 카드를 덮어쓰지 않는다', async () => {
    const handlers: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handlers.push(h);
      return {remove: () => {}};
    }) as never);
    const api = waitApi({childCodeExpired: true});
    const real = api.getChildState.bind(api);
    let hold = false;
    let release: () => void = () => {};
    jest.spyOn(api, 'getChildState').mockImplementation(async () => {
      const snapshot = await real(); // 떠날 때의 상태(만료)
      if (hold) {
        hold = false;
        await new Promise<void>(r => (release = r)); // 이 확인만 늦게 도착
      }
      return snapshot;
    });
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByRole('button', {name: '새 번호 만들기'}));
    hold = true;
    await act(async () => {
      handlers.forEach(h => h('active')); // 포그라운드 복귀 확인이 떠난다(만료 상태로)
    });
    await press('새 번호 만들기');
    await waitFor(() => screen.getByText('123 456'));
    await act(async () => release()); // 옛 확인이 이제 도착
    expect(screen.getByText('123 456')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '새 번호 만들기'})).toBeNull();
  });
});

describe('C4 홈 · 응원', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  test('상단 바·탭 바, 오늘 답이면 "{답} 이야기", 지난 날이면 "이 답으로 이야기를 시작해 봐요"', async () => {
    const {unmount} = render(
      <AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: today}})} role="child" />,
    );
    await waitFor(() => screen.getByText('가을 이야기를 해 볼까요?'));
    expect(screen.getByText('우리 집 앨범')).toBeTruthy();
    expect(screen.getByRole('tab', {name: '앨범', selected: true})).toBeTruthy();
    expect(screen.getByRole('tab', {name: '지난 답'})).toBeTruthy();
    unmount();
    render(<AppRoot api={createFakeApi({consented: true, latest: {prompt: null, choiceLabel: '봄', answeredDate: '2020-01-02'}})} role="child" />);
    await waitFor(() => screen.getByText('이 답으로 이야기를 시작해 봐요'));
  });

  test('응원 보내기: 확정 4개만, 누르면 바로 보내고 "{호칭}께 보냈어요"', async () => {
    useCheerClock();
    const api = createFakeApi({consented: true, parentTitle: '엄마', latest: null});
    const send = jest.spyOn(api, 'sendCheer');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('어떤 말을 보낼까요?')).toBeTruthy();
    expect(within(sheet).getByText('하나를 누르면 바로 보내요')).toBeTruthy();
    const options = ['사랑해요, 오늘도 좋은 하루예요', '덕분에 하루가 따뜻해요', '늘 고마워요', '오늘도 편안한 하루 보내세요'];
    for (const o of options) {
      expect(within(sheet).getByRole('button', {name: o})).toBeTruthy();
    }
    expect(within(sheet).queryByText(/건강|전화|듣고 싶어요|천천히/)).toBeNull();
    await press('늘 고마워요');
    await afterUndoWindow(); // U10: 토스트 '취소' 시간(4초)이 지나야 실제로 보낸다
    expect(send).toHaveBeenCalledWith('parent-1', 'thanks_always');
    await waitFor(() => screen.getByText('엄마께 보냈어요'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  test('첫마디 한 줄(B3): 값이 있으면 "이야기 꺼내기" + 문장, 없으면 줄 전체를 숨긴다', async () => {
    const latest = {prompt: null, choiceLabel: '가을', answeredDate: today};
    const {unmount} = render(<AppRoot api={createFakeApi({consented: true, latest, starter: '가을 하면 뭐가 떠오르세요?'})} role="child" />);
    await waitFor(() => screen.getByTestId('child-home-starter'));
    expect(screen.getByText('이야기 꺼내기')).toBeTruthy();
    expect(screen.getByText('가을 하면 뭐가 떠오르세요?')).toBeTruthy();
    expect(screen.queryByText('가을 이야기를 해 볼까요?')).toBeNull(); // 기본 문장을 대체(둘 중 하나만)
    unmount();
    render(<AppRoot api={createFakeApi({consented: true, latest})} role="child" />);
    await waitFor(() => screen.getByText('가을 이야기를 해 볼까요?'));
    expect(screen.queryByText('이야기 꺼내기')).toBeNull();
  });

  test('하루 한도를 넘으면 보내지 않고 알린다(서버 daily_limit)', async () => {
    useCheerClock();
    render(<AppRoot api={createFakeApi({consented: true, cheerDailyLimit: 0})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await afterUndoWindow(); // U10: 토스트 '취소' 시간(4초)이 지나야 실제로 보낸다
    await waitFor(() => screen.getByText('오늘 보낼 수 있는 응원은 다 보냈어요. 내일 다시 보낼 수 있어요'));
    expect(screen.queryByText(/께 보냈어요/)).toBeNull();
  });

  test('M3: 한 분은 받고 다른 분에서 끊기면 받은 분을 알리고, 다시 하기는 남은 분께만 보낸다', async () => {
    useCheerClock();
    const api = createFakeApi({parents: [{title: '엄마', latest: null}, {title: '아빠', latest: null}]});
    const real = api.sendCheer.bind(api);
    const send = jest.spyOn(api, 'sendCheer').mockImplementation(async (id, key) => {
      if (id === 'parent-2' && send.mock.calls.length === 2) {
        throw new (require('../src/features/types').OfflineError)('x');
      }
      return real(id, key);
    });
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await afterUndoWindow(); // U10: 토스트 '취소' 시간(4초)이 지나야 실제로 보낸다
    await waitFor(() => screen.getByText('엄마께 보냈어요. 나머지 분께는 잠시 뒤에 다시 보내 주세요'));
    await press('다시 하기');
    await waitFor(() => screen.getByText('엄마·아빠께 보냈어요'));
    expect(send.mock.calls.map(c => c[0])).toEqual(['parent-1', 'parent-2', 'parent-2']); // 엄마께 두 번 가지 않음
  });

  test('응원 실패(오프라인)는 토스트로 알린다', async () => {
    useCheerClock();
    render(<AppRoot api={createFakeApi({consented: true, failCheer: 1})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await afterUndoWindow(); // U10: 토스트 '취소' 시간(4초)이 지나야 실제로 보낸다
    await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  });

  test('연결 끊김: 배너 + 최근 답 그대로, 응원 버튼 없음, 번호 만들기 → 그 어르신 재연결 번호', async () => {
    const api = createFakeApi({
      consented: true, parentTitle: '엄마', disconnected: true,
      latest: {prompt: null, choiceLabel: '가을', answeredDate: '2020-11-14'},
    });
    const issue = jest.spyOn(api, 'issueInviteCode');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByText('엄마 폰의 연결이 풀렸어요'));
    expect(screen.getByText('새 번호를 만들어 보내 주세요')).toBeTruthy();
    expect(screen.getByText('가을')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '응원 보내기'})).toBeNull();
    await press('번호 만들기');
    await waitFor(() => screen.getByText('번호가 만들어졌어요'));
    expect(issue).toHaveBeenCalledWith('parent-1');
    expect(screen.getByText('엄마 폰에서 이 번호를 써 주세요')).toBeTruthy();
  });

  test('어르신이 여럿이면 카드마다 호칭, 응원은 연결된 어르신 전부에게', async () => {
    render(
      <AppRoot
        api={createFakeApi({
          parents: [
            {title: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: today}},
            {title: '아빠', latest: null},
          ],
        })}
        role="child"
      />,
    );
    await waitFor(() => screen.getByText('엄마의 최근 답'));
    expect(screen.getByText('아빠의 최근 답')).toBeTruthy();
    await press('응원 보내기');
    await press('늘 고마워요');
    await waitFor(() => screen.getByText('엄마·아빠께 보냈어요'));
  });

  test('서버 오류는 "화면이 열리지 않아요" + 다시 하기', async () => {
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'fetchChildSummary').mockRejectedValueOnce(new Error('boom'));
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByText('화면이 열리지 않아요'));
    await press('다시 하기');
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  });
});

describe('C5 지난 답', () => {
  const items = [
    {answeredDate: '2020-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'},
    {answeredDate: '2020-11-15', promptShort: '라디오와 텔레비전 중', choiceLabel: '라디오'},
  ];

  test('어르신 1명: 제목에 호칭, 최근 한 달 안내, 날짜·짧은 질문·고른 답 행, 이야기 주제 추천', async () => {
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', history: items})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('엄마의 지난 답'));
    expect(screen.getByText('최근 한 달 동안 고른 답이에요')).toBeTruthy();
    const rows = screen.getAllByTestId('child-past-item');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/2020년 11월 16일.*봄과 가을 중.*가을/);
    expect(rows[1]).toHaveTextContent(/라디오와 텔레비전 중/);
    expect(screen.getByLabelText('2020년 11월 16일, 봄과 가을 중, 고른 답 가을')).toBeTruthy();
    expect(screen.getByTestId('child-past-topic')).toHaveTextContent(/이야기 주제 추천.*곧 유료/);
    expect(screen.queryByText(/개|번째|연속|일째/)).toBeNull(); // 집계 없음
  });

  test('어르신 2명 이상: 제목 "지난 답", 호칭 머리글로 나눈다', async () => {
    render(
      <AppRoot
        api={createFakeApi({
          parents: [
            {title: '엄마', history: [items[0]]},
            {title: '아빠', shared: false},
          ],
        })}
        role="child"
      />,
    );
    await openTab('지난 답');
    await waitFor(() => screen.getByRole('header', {name: '엄마'}));
    expect(screen.getByRole('header', {name: '아빠'})).toBeTruthy();
    expect(screen.getByRole('header', {name: '지난 답'})).toBeTruthy();
    expect(screen.getByText('답을 나누지 않는 중이에요')).toBeTruthy();
  });

  test('나누지 않는 중이면 그 안내만(이야기 주제 행 없음)', async () => {
    render(<AppRoot api={createFakeApi({consented: false})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('답을 나누지 않는 중이에요'));
    expect(screen.queryByTestId('child-past-topic')).toBeNull();
    expect(within(screen.getByTestId('child-past-empty')).getByTestId('brand-symbol', {includeHiddenElements: true})).toBeTruthy(); // C4 와 같은 심볼(장식)
  });

  test('서버 오류: "목록이 열리지 않아요…" + 다시 하기로 다시 불러온다', async () => {
    render(<AppRoot api={createFakeApi({consented: true, history: items, failHistoryServer: 1})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('목록이 열리지 않아요. 잠시 뒤에 다시 해 볼까요?'));
    await press('다시 하기');
    await waitFor(() => expect(screen.getAllByTestId('child-past-item')).toHaveLength(2));
  });
});

describe('C7 설정 v2', () => {
  const openSettings = async (api = createFakeApi({consented: true, parentTitle: '엄마'})) => {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getAllByText('부르는 이름'));
    return api;
  };

  test('행: 부르는 이름·새 폰 연결 번호·로그인 수단·로그아웃·내 계정 지우기·앱 정보, 하단 안내', async () => {
    await openSettings();
    expect(screen.getByRole('button', {name: '부르는 이름, 엄마'})).toBeTruthy();
    expect(screen.getByText('엄마 폰을 바꿨을 때 써요')).toBeTruthy();
    await waitFor(() => screen.getByText('카카오로 로그인했어요'));
    expect(screen.getByRole('button', {name: '로그아웃'})).toBeTruthy();
    expect(screen.getByRole('button', {name: '내 계정 지우기'})).toBeTruthy();
    expect(screen.getByText('버전 1.0.0')).toBeTruthy();
    expect(screen.getByText('안부나 안전을 확인하는 서비스가 아니에요')).toBeTruthy();
    expect(screen.queryByText(/알려 드려요/)).toBeNull(); // 알림 행은 숨김(copy 10절)
  });

  test('부르는 이름 시트: 7개 중 고르고 저장 → "부르는 이름을 바꿨어요"', async () => {
    const api = await openSettings();
    const set = jest.spyOn(api, 'setParentTitleFor');
    await press('부르는 이름, 엄마');
    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('부모님을 어떻게 부르세요?')).toBeTruthy();
    for (const t of ['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님']) {
      expect(within(sheet).getByText(t)).toBeTruthy();
    }
    fireEvent.press(within(sheet).getByText('어머니'));
    await press('저장');
    expect(set).toHaveBeenCalledWith('parent-1', '어머니');
    await waitFor(() => screen.getByText('부르는 이름을 바꿨어요'));
    await waitFor(() => screen.getByRole('button', {name: '부르는 이름, 어머니'}));
  });

  test('C7 v4: 부르는 이름 시트는 ds Sheet + Choice(radio), 닫히면 연 행으로 포커스(returnFocusRef)', async () => {
    await openSettings();
    await press('부르는 이름, 엄마');
    const group = screen.getByTestId('title-group');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(7);
    expect(within(group).getByRole('radio', {name: '엄마'}).props.accessibilityState).toMatchObject({checked: true});
    const {Sheet} = require('../src/ui/ds');
    const ref = screen.UNSAFE_getAllByType(Sheet).find(x => x.props.title === '부모님을 어떻게 부르세요?')!.props.returnFocusRef as {current: unknown};
    expect(ref.current).toBeTruthy(); // '부르는 이름, 엄마' 행
  });

  test('M2: 호칭 저장 실패는 시트 안 오류 줄로(시트는 열린 채)', async () => {
    const api = await openSettings();
    jest.spyOn(api, 'setParentTitleFor').mockRejectedValueOnce(new (require('../src/features/types').OfflineError)('x'));
    await press('부르는 이름, 엄마');
    fireEvent.press(within(screen.getByTestId('sheet')).getByText('아빠'));
    await press('저장');
    await waitFor(() => screen.getByTestId('sheet-error'));
    expect(within(screen.getByTestId('sheet')).getByText('인터넷이 잠깐 끊겼어요')).toBeTruthy();
  });

  test('L4: 다른 어르신이 쓰는 호칭은 저장할 수 없다', async () => {
    await openSettings(createFakeApi({parents: [{title: '엄마'}, {title: '아빠'}]}));
    await press('부르는 이름, 엄마');
    fireEvent.press(within(screen.getByTestId('sheet')).getByText('아빠'));
    expect(screen.getByRole('button', {name: '저장'})).toBeDisabled();
    expect(screen.getByText('같은 이름이 이미 있어요. 다른 이름을 골라 주세요', {includeHiddenElements: true})).toBeTruthy(); // 이유는 버튼 힌트로 읽힘
  });

  test('새 폰 연결 번호 → 그 어르신 재연결 번호 화면', async () => {
    const api = await openSettings();
    const issue = jest.spyOn(api, 'issueInviteCode');
    await press('새 폰 연결 번호, 엄마 폰을 바꿨을 때 써요');
    await waitFor(() => screen.getByText('번호가 만들어졌어요'));
    expect(issue).toHaveBeenCalledWith('parent-1');
  });

  test('로그아웃: 같은 방법(카카오) 안내 → 그만둘래요는 닫기, 로그아웃은 첫 화면으로', async () => {
    const api = await openSettings(createFakeApi({who: 'child', childFamily: true, childLinked: true, consented: true}));
    const out = jest.spyOn(api, 'signOut');
    await waitFor(() => screen.getByText('카카오로 로그인했어요'));
    await press('로그아웃');
    const dialog = screen.getByTestId('dialog');
    expect(within(dialog).getByText('로그아웃할까요?')).toBeTruthy();
    expect(within(dialog).getByText('같은 방법(카카오)으로 다시 로그인하면 지금 가족과 그대로 이어져요')).toBeTruthy();
    await press('닫기');
    expect(screen.queryByTestId('dialog')).toBeNull();
    await press('로그아웃');
    fireEvent.press(within(screen.getByTestId('dialog')).getByRole('button', {name: '로그아웃'}));
    await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
    expect(out).toHaveBeenCalledTimes(1);
  });

  test('앱 정보: 버전 + AI 고지 상자, 정해지지 않은 행(방침·문의)은 숨긴다', async () => {
    await openSettings();
    await press('앱 정보, 버전 1.0.0');
    await waitFor(() => screen.getByTestId('ai-notice'));
    expect(screen.getByText('AI가 만든 것')).toBeTruthy();
    expect(screen.getByText('앱의 옛날 사진은 AI가 만든 그림이에요. 실제 장소가 아니에요')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.queryByText('[문의 이메일]')).toBeNull();
  });

  test('내 계정 지우기 → 지우기 화면', async () => {
    await openSettings();
    await press('내 계정 지우기');
    await waitFor(() => expect(screen.getAllByText(/되돌릴 수 없어요/).length).toBeGreaterThan(0));
  });
});
