import React from 'react';
import {AppState, Share} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {ServerError} from '../src/features/types';
import {press, pressLast} from '../testUtils/flow';

const EMAIL_CODE = '246810'; // fake 의 올바른 메일 인증번호

async function typeDigits(code: string) {
  for (const d of code) {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
}

async function loginAsChild(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), EMAIL_CODE); // 6자리면 자동 확인
}

test('첫 화면은 역할 선택: 받은 번호가 있어요 -> 번호 입력', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
});

test('이메일 형식이 틀리면 보내지 않는다', async () => {
  const api = createFakeApi();
  const send = jest.spyOn(api, 'sendEmailCode');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'not-an-email');
  await press('인증번호 받기');
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText('이메일 주소 형식을 확인해 주세요')).toBeTruthy();
});

test('틀린 인증번호는 안내한다', async () => {
  const api = createFakeApi();
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '000000');
  await waitFor(() => screen.getByText('인증번호가 맞지 않아요. 가장 최근 메일의 번호를 확인해 주세요'));
});

test('가족 만들기 -> 호칭(기본 부모님) -> 번호 만들기 -> 큰 번호와 보내기', async () => {
  const api = createFakeApi();
  const create = jest.spyOn(api, 'createFamily');
  const title = jest.spyOn(api, 'setParentTitle');
  const issue = jest.spyOn(api, 'issueInviteCode');
  const share = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
  await loginAsChild(api);
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  expect(screen.getByRole('radio', {name: '부모님', checked: true})).toBeTruthy();
  fireEvent.press(screen.getByText('엄마'));
  await press('번호 만들기');
  // V9: C2 없이 바로 C3(번호 카드가 맨 위)
  await waitFor(() => screen.getByTestId('wait-code'));
  expect(screen.queryByText('번호가 만들어졌어요')).toBeNull();
  expect(create).toHaveBeenCalledTimes(1);
  expect(title).toHaveBeenCalledWith('엄마');
  expect(issue).toHaveBeenCalledTimes(1);
  expect(screen.getByText('123 456', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByText('엄마 폰에 가화만사성을 설치하고 열어요')).toBeTruthy();
  await press('번호 보내기');
  expect(share).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('123 456')}));
});

test('번호 만들기가 실패하면 알리고 다시 할 수 있다', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'issueInviteCode').mockRejectedValueOnce(new ServerError('issue_invite_code', 'boom', 'XX000'));
  await loginAsChild(api);
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  await press('번호 만들기');
  await waitFor(() => screen.getByText('번호가 만들어지지 않았어요. 잠시 뒤에 다시 해 볼까요?'));
  await press('번호 만들기');
  await waitFor(() => screen.getByTestId('wait-code'));
});

test('연결 대기 -> 어르신이 번호를 쓰면 연결됨(호칭께서 정해요) -> 앨범', async () => {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handlers.push(h);
    return {remove: () => {}};
  }) as never);
  const api = createFakeApi();
  await loginAsChild(api);
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  fireEvent.press(screen.getByText('아빠'));
  await press('번호 만들기');
  await waitFor(() => screen.getByTestId('wait-code')); // C2 없이 바로 C3
  expect(screen.getByText('아빠 폰에 가화만사성을 설치하고 열어요')).toBeTruthy();
  expect(screen.getByText('연결 기다리는 중')).toBeTruthy();
  await api.redeemInviteCode('123456'); // 어르신 폰에서 번호 입력
  await act(async () => {
    handlers.forEach(h => h('active'));
  });
  await waitFor(() => screen.getByText('연결됐어요'));
  expect(screen.getByText('고른 답을 보여 줄지는 아빠께서 정해요')).toBeTruthy();
  await press('앨범으로');
  await waitFor(() => screen.getByText('우리 집 앨범'));
});

test('이미 가족이 있는 자녀는 로그인 뒤 만든 번호를 다시 보여 준다(새로 만들지 않음)', async () => {
  const api = createFakeApi({childFamily: true});
  const issue = jest.spyOn(api, 'issueInviteCode');
  await loginAsChild(api);
  await waitFor(() => screen.getByText('123 456', {includeHiddenElements: true})); // C3 v4: 대기 화면이 번호를 바로 보여 준다
  expect(issue).not.toHaveBeenCalled();
});

test('복원: 로그인돼 있고 연결된 자녀는 바로 앨범', async () => {
  render(<AppRoot api={createFakeApi({who: 'child', childFamily: true, childLinked: true})} restore />);
  await waitFor(() => screen.getByText('우리 집 앨범'));
});

test('어르신 번호 화면에서 not_parent_device 면 처음으로 -> 역할 선택', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await typeDigits('555555'); // 6자리면 저절로 확인("다음" 없음)
  await waitFor(() => screen.getByText('이 폰에서는 번호를 쓸 수 없어요'));
  await pressLast('처음으로');
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('realApi: 메일 인증번호 보내기·확인', async () => {
  const signInWithOtp = jest.fn().mockResolvedValue({error: null});
  const verifyOtp = jest.fn().mockResolvedValue({data: {session: {}}, error: null});
  const api = createRealApi({auth: {signInWithOtp, verifyOtp}} as never);
  await api.sendEmailCode('kid@example.test');
  expect(signInWithOtp).toHaveBeenCalledWith({email: 'kid@example.test', options: {shouldCreateUser: true}});
  await api.verifyEmailCode('kid@example.test', '123456');
  expect(verifyOtp).toHaveBeenCalledWith({email: 'kid@example.test', token: '123456', type: 'email'});
});

test('realApi: 만료·틀린 인증번호는 otp_expired 로, 발송 제한은 rate_limited 로 구분한다', async () => {
  const verifyOtp = jest.fn().mockResolvedValue({data: {session: null}, error: {code: 'otp_expired', status: 403, message: 'Token has expired or is invalid'}});
  const signInWithOtp = jest.fn().mockResolvedValue({error: {code: 'over_email_send_rate_limit', status: 429, message: 'rate'}});
  const api = createRealApi({auth: {signInWithOtp, verifyOtp}} as never);
  await expect(api.verifyEmailCode('a@b.c', '000000')).rejects.toMatchObject({reason: 'otp_expired'});
  await expect(api.sendEmailCode('a@b.c')).rejects.toMatchObject({reason: 'rate_limited'});
});

test('realApi: 자녀 상태 — 가족 없음 / 대기(번호) / 연결됨', async () => {
  const mk = (summary: unknown, codeRow: unknown = null) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'is', 'gt', 'order', 'limit']) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = async () => ({data: codeRow, error: null});
    return createRealApi({
      auth: {getSession: async () => ({data: {session: {user: {id: 'u', is_anonymous: false}}}, error: null})},
      rpc: async () => summary,
      from: () => builder,
    } as never);
  };
  await expect(mk({data: null, error: {code: 'P0001', message: 'child_required'}}).getChildState()).resolves.toEqual({kind: 'no_family'});
  await expect(
    mk({data: {parent_title: '엄마', parents: []}, error: null}, {code: '123456', expires_at: '2026-11-24T00:00:00Z'}).getChildState(),
  ).resolves.toEqual({kind: 'family', parentTitle: '엄마', linked: false, code: {code: '123456', expiresAt: '2026-11-24T00:00:00Z'}, hadExpired: false});
  await expect(
    mk({data: {parent_title: '엄마', parents: [{shared: false, latest: null}]}, error: null}).getChildState(),
  ).resolves.toMatchObject({kind: 'family', linked: true});
});
