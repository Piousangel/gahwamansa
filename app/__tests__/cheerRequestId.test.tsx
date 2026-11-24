// 응원 request_id(서버 0059 send_cheer p_request_id): 보내기 한 번 × 어르신 한 분마다 uuid 하나, '다시 하기'는 같은 값을 다시 보낸다.
// 서버엔 들어갔는데 응답만 끊긴 응원(시간 초과·반쯤 끊긴 연결)을 다시 하기로 두 번 보내지 않게.
import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError} from '../src/features/types';
import {uuidV4} from '../src/lib/uuid';
import {press} from '../testUtils/flow';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const afterUndoWindow = () =>
  act(async () => {
    jest.advanceTimersByTime(4100);
  });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('uuidV4: 버전 4·변형 비트, 난수 출처가 없어도 만든다', () => {
  expect(uuidV4()).toMatch(UUID);
  expect(uuidV4(n => new Uint8Array(n))).toBe('00000000-0000-4000-8000-000000000000');
  expect(uuidV4()).not.toBe(uuidV4());
});

async function sendOnce(api: ReturnType<typeof createFakeApi>, phrase = '늘 고마워요') {
  await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  await press('응원 보내기');
  await press(phrase);
  await afterUndoWindow();
}

test('응답만 끊긴 응원 → 다시 하기는 같은 request_id 로 보내 서버(fake)가 처음 결과를 돌려준다: 어르신은 응원을 하나만 받는다', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마', failCheerAfterSend: 1});
  const send = jest.spyOn(api, 'sendCheer');
  render(<AppRoot api={api} role="child" />);
  await sendOnce(api);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('엄마께 보냈어요'));
  expect(send).toHaveBeenCalledTimes(2);
  const [first, second] = send.mock.calls;
  expect(first[2]).toMatch(UUID);
  expect(second[2]).toBe(first[2]); // 같은 요청의 재시도
  // 두 번 가지 않음: 재시도는 처음(서버에 들어간) 응원 그대로 — 새 응원이면 cheer-parent-1-2 가 된다
  await expect(send.mock.results[1].value).resolves.toEqual({ok: true, cheerId: 'cheer-parent-1-1'});
});

test('새로 누른 보내기는 새 request_id(서로 다른 응원), 어르신 여럿이면 분마다 다른 id', async () => {
  const api = createFakeApi({parents: [{title: '엄마', latest: null}, {title: '아빠', latest: null}], cheerDailyLimit: 5});
  const send = jest.spyOn(api, 'sendCheer');
  render(<AppRoot api={api} role="child" />);
  await sendOnce(api);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  await act(async () => {
    jest.advanceTimersByTime(7000); // 보냄 토스트가 사라질 때까지
  });
  await sendOnce(api, '오늘도 편안한 하루 보내세요');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(4));
  const ids = send.mock.calls.map(c => c[2]);
  expect(new Set(ids).size).toBe(4); // 누름 2번 × 어르신 2분
  ids.forEach(id => expect(id).toMatch(UUID));
});

// #223 리뷰 M: fake 의 같은 id 확인은 서버 0059 순서(키·대상·연결 확인 다음, 하루 한도 앞)
test('fake 순서 = 0059: 같은 id 라도 키가 틀리면 invalid_key(재시도 확인보다 키 확인이 먼저), 하루 한도를 넘겨도 같은 id 재시도는 처음 응원', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마', cheerDailyLimit: 1});
  const id = uuidV4();
  const first = await api.sendCheer('parent-1', 'love_you', id);
  expect(first).toEqual({ok: true, cheerId: 'cheer-parent-1-1'});
  expect(await api.sendCheer('parent-1', 'nope' as never, id)).toEqual({ok: false, reason: 'invalid_key'});
  expect(await api.sendCheer('parent-1', 'love_you', uuidV4())).toEqual({ok: false, reason: 'daily_limit'}); // 한도 1 다 씀
  expect(await api.sendCheer('parent-1', 'love_you', id)).toEqual(first); // 한도 앞에서 재시도 확인
});

// #223 리뷰 L1: 되돌리기 → 다시 보내기는 새 누름이라 새 id, 되돌린 응원은 서버를 부르지 않는다(호출 1번)
test('되돌리기 뒤 다시 보내면 서버 호출은 1번(되돌린 것은 안 부름), 그 id 는 uuid', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마'});
  const send = jest.spyOn(api, 'sendCheer');
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  await press('응원 보내기');
  await press('늘 고마워요');
  await press('되돌리기');
  await waitFor(() => screen.getByText('응원을 보내지 않았어요'));
  await act(async () => {
    jest.advanceTimersByTime(7000);
  });
  expect(send).not.toHaveBeenCalled(); // 되돌린 응원은 서버를 부르지 않는다
  await sendOnce(api);
  await waitFor(() => screen.getByText('엄마께 보냈어요'));
  await act(async () => {
    jest.advanceTimersByTime(7000);
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][2]).toMatch(UUID);
});

// #223 리뷰 L2: 여러 분 중 일부만 실패 → 다시 하기는 실패한 분에게만, 그분의 처음 id 로
test('엄마는 받고 아빠만 끊김 → 다시 하기는 아빠에게만, 아빠의 처음 id 그대로', async () => {
  const api = createFakeApi({parents: [{title: '엄마', latest: null}, {title: '아빠', latest: null}]});
  const real = api.sendCheer.bind(api);
  let failedOnce = false;
  const send = jest.spyOn(api, 'sendCheer').mockImplementation(async (id, key, rid) => {
    if (id === 'parent-2' && !failedOnce) {
      failedOnce = true;
      throw new OfflineError('x');
    }
    return real(id, key, rid);
  });
  render(<AppRoot api={api} role="child" />);
  await sendOnce(api);
  await waitFor(() => screen.getByText('엄마께 보냈어요. 나머지 분께는 잠시 뒤에 다시 보내 주세요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('엄마·아빠께 보냈어요'));
  const calls = send.mock.calls.map(c => [c[0], c[2]]);
  expect(calls.map(c => c[0])).toEqual(['parent-1', 'parent-2', 'parent-2']); // 엄마께 두 번 가지 않음
  expect(calls[2][1]).toBe(calls[1][1]); // 아빠: 처음 id 그대로
  expect(calls[0][1]).not.toBe(calls[1][1]); // 분마다 다른 id
});
