// #198 리뷰 L(두 번째 리뷰): 지우는 중(delete_my_account 응답 대기)에 알림 탭·App Link 로 다른 화면으로 가 버리면
// 계정은 지워지는데 사용자는 '지우는 중'을 떠난 것처럼 보인다. 지금 경로에서 실제로 생기는지 재현으로 고정한다.
// - 어르신: PushHost 가 DeleteAccount 를 '진행 중 화면'(PARENT_BUSY_ROUTES)으로 보고 알림 이동을 미룬다
// - 자녀: 알림 이동은 탭(앨범·지난 날)·대기 화면에서만 — 지우기 화면에서는 이동하지 않는다
// - App Link(초대 링크): 번호를 저장소·첫 화면 띠에만 넣고 화면을 옮기지 않는다
import React from 'react';
import {Linking} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createFakeTokenSource, setTokenSourceForTest} from '../src/push/tokenSource';
import {confirmDeleteAll, press, toHomeConsented} from '../testUtils/flow';

const never = () => new Promise<never>(() => {});

// 시작 전에 Linking 'url' 구독을 잡아 둔다(startInviteSources 는 모듈마다 한 번 구독)
const urlHandlers: ((e: {url: string}) => void)[] = [];
jest.spyOn(Linking, 'addEventListener').mockImplementation(((type: string, h: (e: {url: string}) => void) => {
  if (type === 'url') {
    urlHandlers.push(h);
  }
  return {remove: () => {}};
}) as never);

test('어르신: 모두 지우는 중 일일 알림을 눌러도 지우기 화면에 머문다(알림 기록도 미룸)', async () => {
  const src = createFakeTokenSource();
  setTokenSourceForTest(src);
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount').mockImplementation(never);
  const log = jest.spyOn(api, 'logEvent');
  await toHomeConsented(api);
  await press('설정');
  await press('모두 지우기');
  await waitFor(() => screen.getByText('모두 지울까요?'));
  await confirmDeleteAll();
  await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  await act(async () => {
    src.emitOpen({kind: 'daily'});
  });
  await act(async () => {});
  expect(screen.getByText('모두 지울까요?')).toBeTruthy();
  expect(screen.queryByTestId('photo-polaroid')).toBeNull();
  expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
});

test('자녀: 계정 지우는 중 연결 알림을 눌러도 지우기 화면에 머문다', async () => {
  const src = createFakeTokenSource();
  setTokenSourceForTest(src);
  const api = createFakeApi({consented: true, parentTitle: '엄마', deleteScope: 'child'});
  const del = jest.spyOn(api, 'deleteMyAccount').mockImplementation(never);
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '설정'}));
  await press('설정');
  await press('내 계정 지우기');
  await waitFor(() => screen.getByText('내 계정 지우기'));
  await press('계정 지우기');
  await press('계정 지우기');
  await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  await act(async () => {
    src.emitOpen({kind: 'parent_connected'});
  });
  await act(async () => {});
  expect(screen.getByText('내 계정 지우기')).toBeTruthy();
  expect(screen.queryByRole('tab', {name: '앨범'})).toBeNull();
});

test('어르신: 지우는 중 초대 링크(App Link)가 와도 화면을 옮기지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount').mockImplementation(never);
  await toHomeConsented(api);
  await press('설정');
  await press('모두 지우기');
  await waitFor(() => screen.getByText('모두 지울까요?'));
  await confirmDeleteAll();
  await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  expect(urlHandlers.length).toBeGreaterThan(0); // 앱이 링크 구독을 걸었다
  await act(async () => {
    urlHandlers.forEach(h => h({url: 'https://example.test/c?code=123456'}));
  });
  await act(async () => {});
  expect(screen.getByText('모두 지울까요?')).toBeTruthy();
  expect(screen.queryByText('가족에게 받은 번호를 써 주세요')).toBeNull();
});
