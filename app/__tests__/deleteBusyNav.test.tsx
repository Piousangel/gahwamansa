// #198 리뷰 L(두 번째 리뷰): 지우는 중(delete_my_account 응답 대기)에 알림 탭·App Link 로 다른 화면으로 가 버리면
// 계정은 지워지는데 사용자는 '지우는 중'을 떠난 것처럼 보인다. 지금 경로에서 실제로 생기는지 재현으로 고정한다.
// - 어르신: PushHost 가 DeleteAccount 를 '진행 중 화면'(PARENT_BUSY_ROUTES)으로 보고 알림 이동을 미룬다
// - 자녀: 알림 이동은 탭(앨범·지난 날)·대기 화면에서만 — 지우기 화면에서는 이동하지 않는다
// - App Link(초대 링크 https://{APP_LINK_HOST}/c#번호): 번호를 저장소·첫 화면 띠에만 넣고 화면을 옮기지 않는다
// 실패를 먼저 확인한 방법(#205 리뷰, 고장을 일부러 넣고 각 테스트가 실패하는 것을 본 뒤 되돌림 — 커밋하지 않음):
//   ① PushHost PARENT_BUSY_ROUTES 에서 DeleteAccount 를 빼면 → 어르신 알림 테스트 실패
//   ② PushHost 자녀 분기의 '탭·대기 화면에서만' 조건을 없애면 → 자녀 알림 테스트 실패
//   ③ AppRoot 초대 구독에서 번호가 오면 navigate('Connect') 하면 → 어르신 App Link 테스트 실패
//   ④ 같은 자리에서 goBack() 하면 → 어르신·자녀 App Link 테스트 모두 실패
import React from 'react';
import {Linking} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createFakeTokenSource, setTokenSourceForTest} from '../src/push/tokenSource';
import {__resetInviteSourcesForTests} from '../src/lib/linkSources/native';
import {subscribeInvite, type InviteBanner} from '../src/lib/linkSources';
import {confirmDeleteAll, press, toHomeConsented} from '../testUtils/flow';

const never = () => new Promise<never>(() => {});
const HOST = 'example.test';
const LINK = `https://${HOST}/c#123456`; // 파서가 받는 형식(codeFromInviteLink: https://{APP_LINK_HOST}/c#번호)

// 앱이 거는 Linking 'url' 구독을 잡아 둔다(startInviteSources 등 — 링크가 오면 모두에게 보낸다)
let urlHandlers: ((e: {url: string}) => void)[] = [];
beforeEach(() => {
  __resetInviteSourcesForTests({appLinkHost: HOST}); // 렌더 전에(구독자도 비운다)
  urlHandlers = [];
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((type: string, h: (e: {url: string}) => void) => {
    if (type === 'url') {
      urlHandlers.push(h);
    }
    return {remove: () => {}};
  }) as never);
});
afterEach(() => {
  jest.restoreAllMocks();
});

/** 링크를 보내고, 초대 저장소에 번호가 들어갔는지(= 링크를 실제로 받았는지) 돌려준다 */
async function sendAppLink(): Promise<InviteBanner> {
  await waitFor(() => expect(urlHandlers.length).toBeGreaterThan(0));
  await act(async () => {
    urlHandlers.forEach(h => h({url: LINK})); // 'url' 을 듣는 것 모두에게(앱 실행 중 링크를 누른 것과 같음)
  });
  let got: InviteBanner = {visible: false, code: null, source: null};
  await waitFor(() => {
    const off = subscribeInvite(b => {
      got = b;
    });
    off();
    expect(got.code).toBe('123456');
  });
  return got;
}

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
  expect(screen.getByRole('button', {name: '지우고 있어요'})).toBeTruthy(); // 지우는 중 위험 버튼(#206 후속 진행 글자)
  expect(screen.queryByRole('tab', {name: '앨범'})).toBeNull();
});

test('어르신: 지우는 중 초대 링크(App Link)를 받아도(번호는 저장소에 들어감) 화면을 옮기지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount').mockImplementation(never);
  await toHomeConsented(api);
  await press('설정');
  await press('모두 지우기');
  await waitFor(() => screen.getByText('모두 지울까요?'));
  await confirmDeleteAll();
  await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  const b = await sendAppLink(); // 받았다는 증거: 저장소에 번호
  expect(b.source).toBe('app_link');
  await act(async () => {});
  expect(screen.getByText('모두 지울까요?')).toBeTruthy();
  expect(screen.queryByText('가족에게 받은 번호를 써 주세요')).toBeNull();
});

test('자녀: 지우는 중 초대 링크(App Link)를 받아도 화면을 옮기지 않는다(#205 리뷰 L)', async () => {
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
  await sendAppLink();
  await act(async () => {});
  // 설정 화면에도 '내 계정 지우기' 행이 있어 글자 대신 이 화면에만 있는 위험 버튼(지우는 중 글자)·경고로 확인
  expect(screen.getByRole('button', {name: '지우고 있어요'})).toBeTruthy(); // 지우는 중 위험 버튼(#206 후속 진행 글자)
  expect(screen.getByText('되돌릴 수 없어요')).toBeTruthy();
  expect(screen.queryByText('가족에게 받은 번호를 써 주세요')).toBeNull();
});
