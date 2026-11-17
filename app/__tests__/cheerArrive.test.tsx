import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {press, toHomeConsented} from '../testUtils/flow';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';

// P8 응원 도착(시안 P8_cheer, copy 5·6절). 앱을 열면 코스 홈 위 대화상자, "알겠어요"로만 닫힘(읽음 처리).
// 서버 계약(0020)은 가정: getUnreadCheers / markCheersRead.
async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  const mark = jest.spyOn(api, 'markCheersRead');
  const get = jest.spyOn(api, 'getMyCheers');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByText('오늘의 코스'));
  return {api, mark, get};
}

test('응원 1개: 해님(하트 없음)·"가족이 보낸 응원이에요"·글·알겠어요 → 읽음 처리 후 닫힘', async () => {
  const {mark} = await home({cheers: ['love_you']});
  await waitFor(() => screen.getByText('가족이 보낸 응원이에요'));
  expect(screen.getByText('사랑해요, 오늘도 좋은 하루예요')).toBeTruthy();
  expect(screen.getByTestId('sun-smile', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByText('고마워요')).toBeNull(); // 빌드 1 버튼은 "알겠어요"(5절)
  await press('알겠어요');
  await waitFor(() => expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull());
  expect(mark).toHaveBeenCalledWith(['cheer-1']);
});

test('응원 여러 개: "응원이 3개 왔어요" + 글 3줄', async () => {
  await home({cheers: ['love_you', 'warm_day', 'thanks_always']});
  await waitFor(() => screen.getByText('응원이 3개 왔어요'));
  for (const t of ['사랑해요, 오늘도 좋은 하루예요', '덕분에 하루가 따뜻해요', '늘 고마워요']) {
    expect(screen.getByText(t)).toBeTruthy();
  }
});

test('확정 목록(6절) 밖의 키는 보여 주지 않는다(재촉·건강 문구, 모르는 키)', async () => {
  const {mark} = await home({cheers: ['will_call', 'stay_healthy', 'no_such_key', 'peaceful_day']});
  await waitFor(() => screen.getByText('오늘도 편안한 하루 보내세요'));
  expect(screen.getByText('가족이 보낸 응원이에요')).toBeTruthy(); // 보이는 건 1개
  expect(screen.queryByText(/전화드릴게요|건강하게/)).toBeNull();
  await press('알겠어요');
  expect(mark).toHaveBeenCalledWith(['cheer-1', 'cheer-2', 'cheer-3', 'cheer-4']); // 확인한 묶음 전체
});

test('보여 줄 응원이 없으면 대화상자도, 읽음 처리도 없다', async () => {
  const {mark, get} = await home({cheers: ['no_such_key']});
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull();
  expect(mark).not.toHaveBeenCalled();
});

test('응원을 못 받아 와도 코스 홈은 그대로(조용히)', async () => {
  const {get} = await home({cheers: ['love_you'], failCheers: true});
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull();
  expect(screen.getByRole('button', {name: '이어서 하기'})).toBeTruthy();
});

test('읽음 처리가 실패해도 대화상자는 닫힌다(다음에 다시 보임)', async () => {
  await home({cheers: ['love_you'], failMarkRead: true});
  await waitFor(() => screen.getByText('가족이 보낸 응원이에요'));
  await press('알겠어요');
  await waitFor(() => expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull());
});

test('미연결 열람에서는 응원을 묻지 않는다', async () => {
  const api = createFakeApi({cheers: ['love_you']});
  const get = jest.spyOn(api, 'getMyCheers');
  render(<AppRoot api={api} role="parent" />);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
  expect(get).not.toHaveBeenCalled();
});

test('번호로 연결한 직후 코스 홈에서도 응원을 보여 준다', async () => {
  const api = createFakeApi({cheers: ['warm_day'], consented: true});
  // 연결 전에는 서버가 빈 목록, 연결 뒤에 응원이 보인다(fakeApi 는 연결 여부로 거른다)
  await toHomeConsented(api);
  await waitFor(() => screen.getByText('덕분에 하루가 따뜻해요'));
});
