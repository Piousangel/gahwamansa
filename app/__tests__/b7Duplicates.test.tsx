// B7(접근성 패널 r1 표 B): 같은 목적지가 위(뒤로 바·BackLink)와 아래(Dock)에 같은 이름으로 두 번 있는 화면.
// W-09 로 위 바가 목적지 이름을 쓰게 되면서 이름이 같아졌다. 없애는 방법(위를 숨길지, Dock 문구를 바꿀지)은 디자인 결정이라
// 이 테스트는 **지금 목록만 고정**한다. 화면을 고치면 그 줄을 지운다. 새 화면에 중복이 생기면 여기 더하지 말고 디자인에 묻는다.
import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {enterCode, press, toHomeConsented, typeCode} from '../testUtils/flow';
import {warmAppRoot, WARM_TIMEOUT_MS} from '../testUtils/warm';

// 리뷰 #149 L2: 첫 AppRoot 렌더(콜드 스타트)를 미리 치른다. 첫 실행 상태를 검사하는 파일이 아니라 안전
beforeAll(warmAppRoot, WARM_TIMEOUT_MS);

const count = (name: string) =>
  [...screen.queryAllByRole('button', {name}), ...screen.queryAllByRole('link', {name})].filter(n => n.props.accessibilityLabel === name).length;

async function reviewHome(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul'], ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
}

test.each([
  ['다시 보기 P4(사진)', '사진 보기, 했어요'],
  ['다시 보기 P5(둘 중 고르기)', '둘 중 고르기, 했어요'],
])('B7 알려진 중복: %s — 위 뒤로·아래 Dock 이 둘 다 "오늘 코스로"', async (_n, row) => {
  await reviewHome();
  await press(row);
  await waitFor(() => expect(count('오늘 코스로')).toBe(2));
});

test('B7 알려진 중복: 다시 보기 P6(낱말, 옛 화면) — 위 "‹ 오늘 코스로"와 아래 "오늘 코스로"(보이는 글 중복, 아래 읽기는 "오늘 코스로 돌아가기")', async () => {
  await reviewHome();
  await press('낱말 쓰기, 했어요');
  await waitFor(() => expect(count('오늘 코스로')).toBe(1));
  expect(screen.getByText('‹ 오늘 코스로')).toBeTruthy();
  expect(screen.getByRole('button', {name: '오늘 코스로 돌아가기'})).toBeTruthy();
});

test('B7 알려진 중복: ChildGate 어르신 폰 막음 — BackLink·Dock 둘 다 "처음으로"', async () => {
  render(<AppRoot api={createFakeApi({linked: true})} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
  expect(count('처음으로')).toBe(2);
});

test('B7 알려진 중복: Connect 실패 패널(이 폰에서는 번호를 쓸 수 없음) — 뒤로 바·Dock 둘 다 "처음으로"', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await typeCode('555555');
  await waitFor(() => screen.getByText('이 폰에서는 번호를 쓸 수 없어요'));
  expect(count('처음으로')).toBe(2);
});

test('B7 알려진 중복(리뷰 #149 L1): Connect 연결 단계 rate_limited 패널 — 뒤로 바·Dock 둘 다 "번호 쓰기로"', async () => {
  const api = createFakeApi();
  const real = api.peekInviteCode.bind(api);
  jest.spyOn(api, 'peekInviteCode').mockImplementation(code => real(code === '222222' ? '123456' : code)); // 확인은 통과, 연결(redeem)에서 rate_limited
  render(<AppRoot api={api} />);
  await press(/부모님 휴대폰이에요/);
  await enterCode('222222');
  await waitFor(() => screen.getByText('잠깐 쉬었다 해요'));
  expect(count('번호 쓰기로')).toBe(2);
});

test('B7 아님(리뷰 #149 L1 확인): 확인 단계 rate_limited 패널은 뒤로 바 "처음으로", Dock "번호 쓰기로"(목적지가 다름)', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await typeCode('222222');
  await waitFor(() => screen.getByText('잠깐 쉬었다 해요'));
  expect([count('처음으로'), count('번호 쓰기로')]).toEqual([1, 1]);
});

test('B7 알려진 중복(리뷰 #149 L1): P13 설정 — 뒤로 바·Dock 둘 다 "오늘 코스로"', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await press('설정');
  await waitFor(() => expect(count('오늘 코스로')).toBe(2));
});
