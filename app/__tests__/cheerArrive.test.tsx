import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {press, toHomeConsented} from '../testUtils/flow';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {kstDateLine} from '../src/features/course/stamps';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

// P8 응원 도착(시안 P8_cheer, copy 5·6절). 앱을 열면 코스 홈 위 대화상자, "알겠어요"로만 닫힘(읽음 처리).
// 서버 계약(0020)은 가정: getUnreadCheers / markCheersRead.
// V1(11-19): 해님 첫 인사가 보이는 첫 P3 에서는 묻지 않는다(v1FirstDay.test). 여기서는 첫 인사를 이미 본 기기로 시작한다
beforeEach(async () => {
  const prefs = createPrefs(memoryStore());
  await prefs.markFirstGreetingSeen();
  setPrefsForTest(prefs);
});
afterEach(() => setPrefsForTest(null));
async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  const mark = jest.spyOn(api, 'markCheersRead');
  const get = jest.spyOn(api, 'getMyCheers');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return {api, mark, get};
}

test('응원 1개: 해님(하트 없음)·"가족이 보낸 응원이에요"·글·알겠어요 → 읽음 처리 후 닫힘', async () => {
  const {mark} = await home({cheers: ['love_you']});
  await waitFor(() => screen.getByText('가족이 보낸 응원이에요'));
  expect(screen.getByText('사랑해요, 오늘도 좋은 하루예요')).toBeTruthy();
  expect(screen.getByTestId('cheer-dialog')).toBeTruthy(); // U0 Dialog(해님 없음)
  expect(screen.queryByText('고마워요')).toBeNull(); // 빌드 1 버튼은 "알겠어요"(5절)
  await press('알겠어요');
  await waitFor(() => expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull());
  expect(mark).toHaveBeenCalledWith(['cheer-1']);
});

test('응원 여러 개: "응원이 3개 왔어요" + 글 3줄', async () => {
  await home({cheers: ['love_you', 'warm_day', 'thanks_always']});
  await waitFor(() => screen.getByText('응원이 3개 왔어요'));
  for (const t of ['사랑해요, 오늘도 좋은 하루예요', '덕분에 하루가 따뜻해요', '늘 고마워요']) {
    expect(screen.getByText(new RegExp(t))).toBeTruthy(); // 본문 한 덩어리, 줄마다 한 문장
  }
});

// 키 확대 배포 순서 ①(DECISIONS 11-24): 서버가 이 앱이 모르는 키를 먼저 열어도 한마디를 놓치지 않는다.
// 모르는 키는 문장 대신 기본 줄 하나로 보여 주고, 읽음 처리는 "알겠어요" 뒤에만.
// - 모르는 키만: 제목(가족이 보낸 응원이에요 / 응원이 {n}개 왔어요)과 겹치지 않는 '마음을 담아 보냈어요'(copy.cheer.unknown)
// - 아는 키와 섞임: 아는 문장 아래 '그 밖에 응원이 {n}개 더 왔어요'(copy.cheer.unknown_more) — 제목 개수와 본문이 맞아떨어지게
const ONLY = '마음을 담아 보냈어요';
// 본문은 Text 한 덩어리(줄마다 한 문장, \n 으로 이음). 그 안의 한 줄로 덩어리를 찾아 줄 단위로 나눈다
const bodyLines = (anchor: RegExp) => String(screen.getByText(anchor).props.children).split('\n');

test('모르는 키만 1개: 제목과 다른 기본 문장, 알겠어요 전에는 읽음 처리하지 않는다', async () => {
  const {mark} = await home({cheers: ['miss_you']}); // 확대 뒤 새 키(이 앱 버전은 모름)
  await waitFor(() => screen.getByText('가족이 보낸 응원이에요'));
  expect(bodyLines(new RegExp(ONLY))).toEqual([ONLY]);
  expect(screen.queryByText(/가족이 응원을 보냈어요/)).toBeNull(); // 제목과 같은 말 되풀이 금지(읽어 주기에서 두 번 들림)
  expect(mark).not.toHaveBeenCalled(); // 보기 전에 읽음 처리 금지
  await press('알겠어요');
  await waitFor(() => expect(screen.queryByText(ONLY)).toBeNull());
  expect(mark).toHaveBeenCalledWith(['cheer-1']);
});

test('모르는 키만 2개: 제목은 "응원이 2개 왔어요", 본문은 기본 문장 한 줄, 읽음은 둘 다', async () => {
  const {mark} = await home({cheers: ['miss_you', 'call_soon']});
  await waitFor(() => screen.getByText('응원이 2개 왔어요'));
  expect(bodyLines(new RegExp(ONLY))).toEqual([ONLY]);
  expect(mark).not.toHaveBeenCalled();
  await press('알겠어요');
  expect(mark).toHaveBeenCalledWith(['cheer-1', 'cheer-2']);
});

test('아는 키+모르는 키 섞임: 아는 문장 그대로 + "그 밖에 응원이 2개 더 왔어요", 개수는 전체', async () => {
  const {mark} = await home({cheers: ['miss_you', 'peaceful_day', 'call_soon']});
  await waitFor(() => screen.getByText('응원이 3개 왔어요'));
  expect(bodyLines(/오늘도 편안한/)).toEqual(['오늘도 편안한 하루 보내세요', '그 밖에 응원이 2개 더 왔어요']);
  expect(mark).not.toHaveBeenCalled();
  await press('알겠어요');
  expect(mark).toHaveBeenCalledWith(['cheer-1', 'cheer-2', 'cheer-3']); // 확인한 묶음 전체
});

test('빈 키도 버리지 않고 기본 문장으로 보여 준다', async () => {
  const {mark} = await home({cheers: ['']});
  await waitFor(() => screen.getByText(ONLY));
  expect(mark).not.toHaveBeenCalled();
  await press('알겠어요');
  expect(mark).toHaveBeenCalledWith(['cheer-1']);
});

test('확정 목록 밖의 키(재촉·건강 문구)도 그 문장은 보여 주지 않는다', async () => {
  await home({cheers: ['will_call', 'stay_healthy', 'love_you']});
  await waitFor(() => screen.getByText('응원이 3개 왔어요'));
  expect(screen.queryByText(/전화드릴게요|건강하게/)).toBeNull();
  expect(screen.getByText(/사랑해요, 오늘도 좋은 하루예요/)).toBeTruthy();
});

test('응원이 없으면 대화상자도 읽음 처리도 없다', async () => {
  const {mark, get} = await home({});
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull();
  expect(mark).not.toHaveBeenCalled();
});

test('응원을 못 받아 와도 코스 홈은 그대로(조용히)', async () => {
  const {get} = await home({cheers: ['love_you'], failCheers: true});
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull();
  expect(screen.getByTestId('screen-dock')).toBeTruthy(); // 코스 홈 하단 버튼 그대로
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
  await waitFor(() => screen.getByText('번호를 받으면 답이 저장돼요'));
  expect(get).not.toHaveBeenCalled();
});

test('알겠어요로 닫히면 포커스를 코스 홈 제목으로 돌려준다(R12, 재검토 ②)', async () => {
  const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
  await home({cheers: ['love_you']});
  await waitFor(() => screen.getByText('가족이 보낸 응원이에요'));
  send.mockClear();
  await press('알겠어요');
  const toTitle = () =>
    send.mock.calls.some(c => (c[0] as unknown as {props?: {accessibilityLabel?: string}})?.props?.accessibilityLabel === kstDateLine()); // 코스 홈 제목 = 날짜 줄(P3 v4)
  await waitFor(() => expect(toTitle()).toBe(true));
  send.mockRestore();
});

test('코스 홈 진입은 start_today(0024)를 한 번 부른다', async () => {
  const api = createFakeApi({linked: true, consented: true});
  const start = jest.spyOn(api, 'startToday');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  expect(start).toHaveBeenCalledTimes(1);
});

test('번호로 연결한 직후 코스 홈에서도 응원을 보여 준다', async () => {
  const api = createFakeApi({cheers: ['warm_day'], consented: true});
  // 연결 전에는 서버가 빈 목록, 연결 뒤에 응원이 보인다(fakeApi 는 연결 여부로 거른다)
  await toHomeConsented(api);
  await waitFor(() => screen.getByText('덕분에 하루가 따뜻해요'));
});
