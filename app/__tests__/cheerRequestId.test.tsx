// 응원 request_id(서버 0059 send_cheer p_request_id): 보내기 한 번 × 어르신 한 분마다 uuid 하나, '다시 하기'는 같은 값을 다시 보낸다.
// 서버엔 들어갔는데 응답만 끊긴 응원(시간 초과·반쯤 끊긴 연결)을 다시 하기로 두 번 보내지 않게.
import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
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
