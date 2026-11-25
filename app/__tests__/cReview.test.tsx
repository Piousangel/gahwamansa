import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError, ServerError} from '../src/features/types';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const pressLink = async (name: string) => act(async () => fireEvent.press(screen.getByRole('link', {name})));

test('real 시작: 오프라인이라 whoAmI 가 실패하면 멈추지 않고 다시 하기를 보여 준다', async () => {
  const api = createFakeApi();
  const who = jest.spyOn(api, 'whoAmI').mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  expect(who).toHaveBeenCalledTimes(2);
});

test('real 시작(역할 지정 parent): 연결된 기기는 whoAmI 로 코스 홈', async () => {
  const api = createFakeApi({linked: true, consented: true});
  const who = jest.spyOn(api, 'whoAmI');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  expect(who).toHaveBeenCalled();
});

test('대기 <-> 번호 다시 보기 왕복해도 대기 화면은 하나, 폴링도 하나', async () => {
  jest.useFakeTimers();
  const api = createFakeApi({who: 'child', childFamily: true});
  const get = jest.spyOn(api, 'getChildState');
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByText('연결 기다리는 중'));
  for (let i = 0; i < 2; i++) {
    await press('설정'); // 대기 화면 위로 쌓였다 돌아오기
    await waitFor(() => screen.getByText('부르는 이름'));
    await press('기다리는 화면으로');
    await waitFor(() => screen.getByText('연결 기다리는 중'));
  }
  expect(screen.queryAllByText('연결 기다리는 중', {includeHiddenElements: true})).toHaveLength(1);
  const before = get.mock.calls.length;
  for (let i = 0; i < 2; i++) {
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
  }
  expect(get.mock.calls.length - before).toBe(2); // 15초마다 1번(인스턴스 하나)
});

test('연결되면 폴링을 멈춘다', async () => {
  jest.useFakeTimers();
  const api = createFakeApi({who: 'child', childFamily: true});
  const get = jest.spyOn(api, 'getChildState');
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByText('연결 기다리는 중'));
  await api.redeemInviteCode('123456');
  await act(async () => {
    jest.advanceTimersByTime(15000);
  });
  await waitFor(() => screen.getByText('연결됐어요'));
  const n = get.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(15000 * 3);
  });
  expect(get.mock.calls.length).toBe(n);
});

test('대기 화면: 상태를 불러오기 전에는 번호 보내기를 누를 수 없고, 새 번호를 만들지 않는다', async () => {
  const api = createFakeApi({who: 'child', childFamily: true});
  let release: () => void = () => {};
  const real = api.getChildState.bind(api);
  let n = 0;
  jest.spyOn(api, 'getChildState').mockImplementation(() => {
    n += 1;
    if (n === 1) {
      return real(); // 시작 화면 결정(Gate)
    }
    // 대기 화면의 첫 확인은 아직 돌아오지 않은 상태
    return new Promise(r => (release = () => r({kind: 'family', parentTitle: '부모님', linked: false, code: null}))) as never;
  });
  const issue = jest.spyOn(api, 'issueInviteCode');
  render(<AppRoot api={api} restore />);
  // PR #83 리뷰 L6: 이유 없는 비활성 대신 불러오는 중(loading) — 누를 수 없고 '잠시만요'로 읽힌다
  const dock = await waitFor(() => within(screen.getByTestId('screen-dock')));
  const btn = await waitFor(() => dock.getByRole('button', {name: /잠시만요/}));
  expect(btn).toBeDisabled();
  await act(async () => release());
  expect(issue).not.toHaveBeenCalled();
});

async function toLoginCode(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
}

test('인증번호 다시 받기는 60초 동안 막힌다(숫자 표시 없이)', async () => {
  jest.useFakeTimers();
  const api = createFakeApi();
  const send = jest.spyOn(api, 'sendEmailCode');
  await toLoginCode(api);
  expect(screen.getByText('kid@example.test로 인증번호 6자리를 보냈어요')).toBeTruthy();
  expect(screen.getByRole('button', {name: '인증번호 다시 받기'})).toBeDisabled();
  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  expect(screen.getByRole('button', {name: '인증번호 다시 받기'})).toBeEnabled();
  await press('인증번호 다시 받기');
  expect(send).toHaveBeenCalledTimes(2);
  await waitFor(() => screen.getByText('새 인증번호를 보냈어요. 이전 번호는 쓸 수 없어요'));
});

test('발송 제한·오프라인 문구', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'sendEmailCode')
    .mockRejectedValueOnce(new ServerError('send_email_code', 'rate_limited', '429'))
    .mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('요청이 많았어요. 잠시 뒤에 다시 받아 주세요'));
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
});

test('10분이 지나 틀리면 시간이 지났다고 알린다', async () => {
  jest.useFakeTimers();
  const api = createFakeApi();
  await toLoginCode(api);
  await act(async () => {
    jest.advanceTimersByTime(11 * 60 * 1000);
  });
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '000000');
  await waitFor(() => screen.getByText('인증번호 시간이 지났어요. 다시 받아 주세요'));
});

test('자녀 로그인에서 처음으로 돌아갈 수 있다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  await pressLink('로그인으로'); // C0-b BackLink = 로그인 고르기(소셜) 화면
  await waitFor(() => screen.getByRole('button', {name: '카카오 로그인'}));
  await pressLink('처음으로'); // C0-a BackLink = 역할 선택
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('이미 어르신으로 연결된 폰은 자녀 로그인을 막는다', async () => {
  const api = createFakeApi({linked: true});
  const send = jest.spyOn(api, 'sendEmailCode');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
  expect(screen.queryByLabelText('이메일 주소')).toBeNull();
  expect(send).not.toHaveBeenCalled();
  await press('처음으로');
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('이메일 입력은 자동 수정·대문자 변환을 끈다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  const input = await waitFor(() => screen.getByLabelText('이메일 주소'));
  expect(input.props.autoCorrect).toBe(false);
  expect(input.props.autoCapitalize).toBe('none');
});

test('호칭 화면: 오프라인이면 오프라인 문구', async () => {
  const api = createFakeApi({who: 'child'});
  jest.spyOn(api, 'createFamily').mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  await press('번호 만들기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
});

