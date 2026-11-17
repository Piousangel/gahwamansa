// P1 v4 자동 확인 + P1c 연결 확인(시안 P1_connect_v4·P1c_confirm, ease-and-joy A④⑤, 문구 copy-v3 11절)
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {RoleSelect} from '../src/features/link/RoleSelect';
import {createFakeApi} from '../src/features/fakeApi';
import {press, typeCode} from '../testUtils/flow';

const digits = (code: string) => {
  for (const d of code) {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
};

test('"다음" 버튼이 없고, 안심 줄·칸 아래 안내·링크 둘·약관 한 줄이 있다', () => {
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
    await waitFor(() => screen.getByText('가족이 보낸 번호예요'));
    expect(screen.getByText('엄마 폰으로 보낸 번호예요')).toBeTruthy();
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
  await press('알겠어요');
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

test('이벤트: 연결 성공은 parent_code_redeemed, 실패는 이유만(번호 값 없음), 퍼널 새 이름은 보내지 않음', async () => {
  const api = createFakeApi();
  const log = jest.spyOn(api, 'logEvent');
  render(<AppRoot api={api} role="parent" />);
  await typeCode('111111');
  await waitFor(() => screen.getByText('번호 기간이 지났어요'));
  await press('알겠어요');
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('이 번호로 연결하기');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  expect(log).toHaveBeenCalledWith('parent_code_failed', {reason: 'expired'});
  expect(log).toHaveBeenCalledWith('parent_code_redeemed', undefined);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456|111111/);
  expect(log.mock.calls.map(c => c[0])).not.toContain('code_prefilled');
});

test('밖에서 들어온 번호(prefill)는 기다리지 않고 바로 확인하되, 연결은 하지 않는다', async () => {
  const {renderHook} = require('@testing-library/react-native');
  const {useConnectFlow} = require('../src/features/link/useConnectFlow');
  const api = createFakeApi({parentTitle: '아빠'});
  const redeem = jest.spyOn(api, 'redeemInviteCode');
  const {result} = renderHook(() => useConnectFlow(api, {code: '123456', source: 'link'}));
  await waitFor(() => expect(result.current.state).toEqual({kind: 'confirm', code: '123456', title: '아빠'}));
  expect(redeem).not.toHaveBeenCalled();
});

test('첫 화면 띠(FS_link): 번호가 들어왔을 때만, 질문은 그대로', () => {
  const {rerender} = render(<RoleSelect onChoose={jest.fn()} />);
  expect(screen.queryByTestId('code-found-band')).toBeNull();
  rerender(<RoleSelect onChoose={jest.fn()} codeFound />);
  expect(screen.getByText('가족이 보낸 번호가 있어요')).toBeTruthy();
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy();
});
