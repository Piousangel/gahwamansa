// 0018(가입 번호는 가족당 1개 살아 있음)에 맞춘 자녀 번호 흐름:
// 살아 있는 번호가 있으면 다시 쓰고(새로 받으면 이미 보낸 번호가 죽는다), "새 번호 만들기"는 만료됐을 때만(C3 v4).
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {OfflineError} from '../src/features/types';
import {press} from '../testUtils/flow';
import {warmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트를 떠안지 않게 파일 시작 때 한 번 그렸다 내린다(PR #101 리뷰, testUtils/warm)
beforeAll(warmAppRoot);

async function loginAsChild(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기');
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '246810');
}

test('호칭 화면: 이미 살아 있는 번호가 있으면 새로 받지 않고 다시 쓴다(호칭만 갱신)', async () => {
  const api = createFakeApi();
  const real = api.issueInviteCode.bind(api);
  // 첫 시도: 서버에는 번호가 만들어졌지만 응답을 못 받음
  const issue = jest.spyOn(api, 'issueInviteCode').mockImplementationOnce(async () => {
    await real();
    throw new OfflineError('lost');
  });
  const title = jest.spyOn(api, 'setParentTitle');
  await loginAsChild(api);
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  fireEvent.press(screen.getByText('엄마'));
  await press('번호 만들기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  fireEvent.press(screen.getByText('아빠'));
  await press('번호 만들기');
  await waitFor(() => screen.getByText('번호가 만들어졌어요'));
  expect(issue).toHaveBeenCalledTimes(1); // 두 번째는 새로 받지 않음
  expect(title).toHaveBeenLastCalledWith('아빠');
  expect(screen.getByText('123 456')).toBeTruthy();
  expect(screen.getByText('아빠 폰에서 이 번호를 써 주세요')).toBeTruthy();
  expect(screen.queryByText('전에 보낸 번호는 이제 쓸 수 없어요')).toBeNull();
});

test('대기 화면: 번호가 살아 있으면 "새 번호 만들기"가 없다', async () => {
  render(<AppRoot api={createFakeApi({who: 'child', childFamily: true})} restore />);
  await waitFor(() => screen.getByText('123 456'));
  expect(screen.getByRole('button', {name: '번호 보내기'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: '새 번호 만들기'})).toBeNull();
});

test('대기 화면: 번호가 만료됐을 때만 "새 번호 만들기", 만들면 "전에 보낸 번호는 이제 쓸 수 없어요"', async () => {
  const api = createFakeApi({who: 'child', childFamily: true, childCodeExpired: true});
  const issue = jest.spyOn(api, 'issueInviteCode');
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByRole('button', {name: '새 번호 만들기'}));
  expect(screen.getByText('번호 기간이 지났어요')).toBeTruthy();
  expect(screen.queryByRole('button', {name: '번호 보내기'})).toBeNull();
  await press('새 번호 만들기');
  await waitFor(() => screen.getByText('123 456'));
  expect(issue).toHaveBeenCalledTimes(1);
  expect(screen.getByText('전에 보낸 번호는 이제 쓸 수 없어요')).toBeTruthy();
});

test('realApi: 살아 있는 번호가 없고 쓰지 않은 지난 가입 번호가 있으면 hadExpired', async () => {
  const results = [
    {data: {parent_title: '엄마', parents: []}, error: null}, // child_summary
    {data: null, error: null}, // 살아 있는 번호 없음
    {count: 1, data: null, error: null}, // 지난 가입 번호 1개
  ];
  let i = 1;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'is', 'gt', 'order', 'limit']) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = async () => results[i++];
  builder.then = (ok: (v: unknown) => void) => ok(results[i++]);
  const sb = {rpc: async () => results[0], from: () => builder};
  expect(await createRealApi(sb as never).getChildState()).toEqual({
    kind: 'family',
    parentTitle: '엄마',
    linked: false,
    code: null,
    hadExpired: true,
  });
});

test('대기 화면: 번호를 받은 적 없는 가족은 "번호 만들기"(만료 안내 없음), 만들어도 "전에 보낸 번호" 문구 없음', async () => {
  const api = createFakeApi({who: 'child', childFamily: true, childCodeNever: true});
  render(<AppRoot api={api} restore />);
  await waitFor(() => screen.getByRole('button', {name: '번호 만들기'}));
  expect(screen.queryByText('번호 기간이 지났어요')).toBeNull();
  expect(screen.queryByRole('button', {name: '새 번호 만들기'})).toBeNull();
  await press('번호 만들기');
  await waitFor(() => screen.getByText('123 456'));
  expect(screen.queryByText('전에 보낸 번호는 이제 쓸 수 없어요')).toBeNull();
});
