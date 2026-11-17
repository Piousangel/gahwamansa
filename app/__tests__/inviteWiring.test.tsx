// 초대 링크(linkSources 스파이크) → 첫 화면 띠(FS_link) → P1c 미리 채움 연결(ease-and-joy A②③④)
import React from 'react';
import {Linking} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {__resetInviteSourcesForTests} from '../src/lib/linkSources/native';
import {subscribeInvite} from '../src/lib/linkSources';
import {press} from '../testUtils/flow';

beforeEach(() => {
  __resetInviteSourcesForTests({appLinkHost: 'example.test'});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const withLink = (url: string | null) => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
  jest.spyOn(Linking, 'addEventListener').mockImplementation((() => ({remove: jest.fn()})) as never);
};

test('링크로 들어온 번호: 첫 화면 띠 → 부모님 → 바로 P1c(자동 연결 없음) → 연결하면 기기에서 번호를 지운다', async () => {
  withLink('https://example.test/c#123456');
  const api = createFakeApi({parentTitle: '엄마', childFamily: true});
  const redeem = jest.spyOn(api, 'redeemInviteCode');
  const log = jest.spyOn(api, 'logEvent');
  render(<AppRoot api={api} />);
  await waitFor(() => screen.getByText('가족이 보낸 번호가 있어요'));
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy(); // 질문은 건너뛰지 않음
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('엄마 폰으로 보낸 번호예요'));
  expect(screen.getByLabelText('연결 번호 1 2 3, 4 5 6')).toBeTruthy();
  expect(redeem).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith('link_opened', {source: 'app_link'});
  expect(log).toHaveBeenCalledWith('code_prefilled', {source: 'app_link'});
  await press('이 번호로 연결하기');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  const seen: boolean[] = [];
  subscribeInvite(b => seen.push(b.visible))();
  expect(seen).toEqual([false]); // 쓴 번호는 지워짐
});

test('다른 번호 쓰기를 고르면 미리 채운 번호를 지우고 빈 번호 칸', async () => {
  withLink('https://example.test/c#123456');
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('가족이 보낸 번호가 있어요'));
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  await press('다른 번호 쓰기');
  expect(screen.getByLabelText('연결 번호 6자리 쓰는 칸')).toBeTruthy();
  const seen: boolean[] = [];
  subscribeInvite(b => seen.push(b.visible))();
  await waitFor(() => expect(seen).toEqual([false]));
});

test('다른 도메인 링크는 무시(띠 없음)', async () => {
  withLink('https://evil.test/c#123456');
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  expect(screen.queryByText('가족이 보낸 번호가 있어요')).toBeNull();
});
