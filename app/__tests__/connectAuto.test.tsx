// P1 v4 자동 확인 + P1c 연결 확인(시안 P1_connect_v4·P1c_confirm, ease-and-joy A④⑤, 문구 copy-v3 11절)
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {RoleSelect} from '../src/features/link/RoleSelect';
import {createFakeApi} from '../src/features/fakeApi';
import {press, typeCode} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const digits = (code: string) => {
  for (const d of code) {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
};

test('"다음" 버튼이 없고, 안심 줄·칸 아래 안내·링크 둘·약관 한 줄이 있다', () => {
  // 기준 기기 글자 100%(0단계). jest 모의 기본 글자 배율 2 는 P1 2단계(창 높이를 잰 뒤에 약관·안내를 그림)라 따로 본다(connectFit)
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 411, height: 914, scale: 2.6, fontScale: 1});
  render(<AppRoot api={createFakeApi()} role="parent" />);
  expect(screen.queryByRole('button', {name: '다음'})).toBeNull();
  expect(screen.getByText('이 앱은 돈이나 통장 번호를 묻지 않아요')).toBeTruthy();
  expect(screen.getByText('6자리를 다 쓰면 바로 확인해요')).toBeTruthy();
  expect(screen.getByRole('button', {name: '번호가 없어요'})).toBeTruthy();
  expect(screen.getByRole('button', {name: '코스 보기'})).toBeTruthy();
  expect(screen.getByTestId('legal-line')).toHaveTextContent('연결하면 이용약관과 개인정보 처리방침에 동의하게 돼요');
  expect(StyleSheet.flatten(screen.getByTestId('connect-links').props.style).columnGap).toBe(24);
});

test('키패드: 숫자 34, 같은 줄 글자 키(모두 지움·지움) 26', () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  expect(StyleSheet.flatten(screen.getByText('0').props.style).fontSize).toBe(34);
  expect(StyleSheet.flatten(screen.getByText('모두 지움').props.style).fontSize).toBe(26);
  expect(StyleSheet.flatten(screen.getByText('지움').props.style).fontSize).toBe(26);
});

test('6번째 숫자 뒤 300ms 에 저절로 확인(그 전에는 부르지 않음) → P1c 에서 사람이 눌러야 연결', async () => {
  jest.useFakeTimers();
  try {
    const api = createFakeApi({parentTitle: '엄마', childFamily: true});
    const peek = jest.spyOn(api, 'peekInviteCode');
    const redeem = jest.spyOn(api, 'redeemInviteCode');
    render(<AppRoot api={api} role="parent" />);
    digits('12345');
    expect(screen.getByLabelText('연결 번호 6자리, 5자리 썼어요')).toBeTruthy();
    digits('6');
    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(peek).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(peek).toHaveBeenCalledWith('123456');
    await waitFor(() => screen.getByText('이 번호가 맞나요?')); // 손 입력 경로 제목(11-19)
    expect(screen.getByText('가족이 이 폰에 쓰라고 만든 번호예요')).toBeTruthy();
    expect(screen.getByLabelText('연결 번호 1 2 3, 4 5 6')).toBeTruthy();
    expect(screen.getByText('이 앱은 돈이나 통장 번호를 묻지 않아요')).toBeTruthy();
    expect(redeem).not.toHaveBeenCalled(); // 자동 연결 금지
    await press('이 번호로 연결하기');
    expect(redeem).toHaveBeenCalledWith('123456');
    await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  } finally {
    jest.useRealTimers();
  }
});

test('맞지 않는 번호: 숫자는 그대로, 칸 아래 한 줄, 고치면 안내가 사라지고 다시 확인', async () => {
  const api = createFakeApi();
  const peek = jest.spyOn(api, 'peekInviteCode');
  render(<AppRoot api={api} role="parent" />);
  await typeCode('999999');
  await waitFor(() => screen.getByText('이 번호로는 연결되지 않아요. 숫자를 한 번 더 봐 주세요'));
  expect(screen.getByLabelText('연결 번호 6자리, 다 썼어요')).toBeTruthy(); // 지우지 않음
  expect(screen.queryByText('번호를 못 알아봤어요')).toBeNull();
  fireEvent.press(screen.getByLabelText('한 칸 지우기'));
  expect(screen.queryByText('이 번호로는 연결되지 않아요. 숫자를 한 번 더 봐 주세요')).toBeNull();
  await typeCode('6');
  await waitFor(() => expect(peek).toHaveBeenLastCalledWith('999996'));
});

test('H1 회귀: 맞지 않음 뒤 숫자 키를 연타해도 같은 번호로 다시 확인하지 않는다(시도 한도 보호)', async () => {
  const api = createFakeApi();
  const peek = jest.spyOn(api, 'peekInviteCode');
  render(<AppRoot api={api} role="parent" />);
  await typeCode('999999');
  await waitFor(() => screen.getByText('이 번호로는 연결되지 않아요. 숫자를 한 번 더 봐 주세요'));
  await typeCode('111');
  expect(peek).toHaveBeenCalledTimes(1);
  expect(screen.getByText('이 번호로는 연결되지 않아요. 숫자를 한 번 더 봐 주세요')).toBeTruthy();
});

test('H1 회귀: 확인 중에 숫자 키를 눌러도 확인은 한 번', async () => {
  const api = createFakeApi();
  let release: () => void = () => {};
  const real = api.peekInviteCode.bind(api);
  const peek = jest.spyOn(api, 'peekInviteCode').mockImplementation(async c => {
    await new Promise<void>(r => (release = r));
    return real(c);
  });
  render(<AppRoot api={api} role="parent" />);
  await typeCode('123456');
  await typeCode('7');
  await act(async () => release());
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  expect(peek).toHaveBeenCalledTimes(1);
});

test('M1 회귀: 연결 중 이전(하드웨어 뒤로 포함)은 막고, 결과가 오면 동의 화면으로', async () => {
  const api = createFakeApi();
  let release: () => void = () => {};
  const real = api.redeemInviteCode.bind(api);
  jest.spyOn(api, 'redeemInviteCode').mockImplementation(async c => {
    await new Promise<void>(r => (release = r));
    return real(c);
  });
  render(<AppRoot api={api} role="parent" />);
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('이 번호로 연결하기');
  await press('번호 쓰기로');
  expect(screen.queryByLabelText('연결 번호 6자리 쓰는 칸')).toBeNull(); // 빈 번호 쓰기로 가지 않음
  await act(async () => release());
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
});

test('다른 번호 쓰기: 확인 화면에서 비우고 번호 쓰기로', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('다른 번호 쓰기');
  expect(screen.getByLabelText('연결 번호 6자리 쓰는 칸')).toBeTruthy();
});

test('기간 지남은 안내 패널(5절 문구), 알겠어요 → 비운 번호 쓰기', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await typeCode('111111');
  await waitFor(() => screen.getByText('번호 기간이 지났어요'));
  await press('다른 번호 쓰기');
  expect(screen.getByLabelText('연결 번호 6자리 쓰는 칸')).toBeTruthy();
});

test('연결 중 인터넷이 끊기면 다시 하기로 같은 번호를 다시 연결', async () => {
  const api = createFakeApi();
  const redeem = jest.spyOn(api, 'redeemInviteCode').mockRejectedValueOnce(new (require('../src/features/types').OfflineError)('x'));
  render(<AppRoot api={api} role="parent" />);
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('이 번호로 연결하기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  expect(redeem).toHaveBeenCalledTimes(2);
});

test('#181 리뷰 H1: 서버는 번호를 썼는데 응답이 끊김 → 다시 하기는 같은 계정의 재시도라 연결된다(서버 0028 226~231행 멱등)', async () => {
  const api = createFakeApi();
  const real = api.redeemInviteCode.bind(api);
  const redeem = jest.spyOn(api, 'redeemInviteCode').mockImplementationOnce(async code => {
    await real(code); // 서버에서는 연결이 끝남(used_by = 이 계정)
    throw new (require('../src/features/types').OfflineError)('응답이 끊김');
  });
  render(<AppRoot api={api} role="parent" />);
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('이 번호로 연결하기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요')); // 'used' 로 막히지 않는다
  expect(redeem).toHaveBeenCalledTimes(2);
});

test('이벤트: 연결 성공은 parent_code_redeemed, 실패는 이유만(번호 값 없음), 손 입력은 채움 이벤트 없음', async () => {
  const api = createFakeApi();
  const log = jest.spyOn(api, 'logEvent');
  render(<AppRoot api={api} role="parent" />);
  await typeCode('111111');
  await waitFor(() => screen.getByText('번호 기간이 지났어요'));
  await press('다른 번호 쓰기');
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('이 번호로 연결하기');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  expect(log).toHaveBeenCalledWith('parent_code_failed', {reason: 'expired'});
  expect(log).toHaveBeenCalledWith('parent_code_redeemed', undefined);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456|111111/);
  expect(log.mock.calls.map(c => c[0])).not.toContain('code_prefilled'); // 손 입력이라 채움 이벤트 없음
});

test('밖에서 들어온 번호(prefill)는 기다리지 않고 바로 확인하되, 연결은 하지 않는다', async () => {
  const {renderHook} = require('@testing-library/react-native');
  const {useConnectFlow} = require('../src/features/link/useConnectFlow');
  const api = createFakeApi({parentTitle: '아빠'});
  const redeem = jest.spyOn(api, 'redeemInviteCode');
  const {result} = renderHook(() => useConnectFlow(api, {code: '123456', source: 'app_link'}));
  await waitFor(() => expect(result.current.state).toEqual({kind: 'confirm', code: '123456', title: '아빠'}));
  expect(redeem).not.toHaveBeenCalled();
});

test('M2·M4: 칸 아래 줄은 늘 있는 live region 하나(글만 바뀜), 맞지 않음에는 경고 아이콘', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  const region = screen.getByTestId('connect-below');
  expect(region.props.accessibilityLiveRegion).toBe('polite');
  await typeCode('999999');
  await waitFor(() => screen.getByText('이 번호로는 연결되지 않아요. 숫자를 한 번 더 봐 주세요'));
  expect(screen.getByTestId('connect-below')).toBe(region); // 같은 노드
  expect(screen.getByTestId('icon-warning', {includeHiddenElements: true})).toBeTruthy();
});

test('L1: 밖에서 들어온 번호가 6자리 숫자가 아니면 무시한다(확인하지 않음)', async () => {
  const {renderHook} = require('@testing-library/react-native');
  const {useConnectFlow} = require('../src/features/link/useConnectFlow');
  const api = createFakeApi();
  const peek = jest.spyOn(api, 'peekInviteCode');
  const {result} = renderHook(() => useConnectFlow(api, {code: '12a456', source: 'app_link'}));
  await act(async () => {
    await new Promise<void>(r => setTimeout(() => r(), 50));
  });
  expect(result.current.state).toEqual({kind: 'idle', code: '', inline: null});
  expect(peek).not.toHaveBeenCalled();
});

test('0029 퍼널: 링크로 들어온 번호는 link_opened{source}·code_prefilled{source}(번호 값 없음)', async () => {
  const {renderHook} = require('@testing-library/react-native');
  const {useConnectFlow} = require('../src/features/link/useConnectFlow');
  const api = createFakeApi();
  const log = jest.spyOn(api, 'logEvent');
  renderHook(() => useConnectFlow(api, {code: '123456', source: 'app_link'}));
  await waitFor(() => expect(log).toHaveBeenCalledWith('code_prefilled', {source: 'app_link'}));
  expect(log).toHaveBeenCalledWith('link_opened', {source: 'app_link'});
  expect(JSON.stringify(log.mock.calls)).not.toContain('123456');
});

test('첫 화면 띠(FS_link): 번호가 들어왔을 때만, 질문은 그대로', () => {
  const {rerender} = render(<RoleSelect onChoose={jest.fn()} />);
  expect(screen.queryByTestId('code-found-band')).toBeNull();
  rerender(<RoleSelect onChoose={jest.fn()} codeFound />);
  expect(screen.getByText('가족이 보낸 번호가 있어요')).toBeTruthy();
  expect(screen.getByTestId('icon-mail', {includeHiddenElements: true})).toBeTruthy(); // 시안 봉투 아이콘
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy();
});

afterEach(() => {
  jest.restoreAllMocks();
});
