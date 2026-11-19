import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {formatAnswerDate} from '../src/features/home/formatDate';

const FORBIDDEN = [/아직/, /못 했/, /안 했/, /일째/, /연속/, /참여/, /미완료/];

function expectNoPressure() {
  for (const re of FORBIDDEN) {
    expect(screen.queryByText(re)).toBeNull();
  }
}

test('최근 답: 호칭 제목, 선택지, 날짜, 대화 제안을 보여 준다', async () => {
  const api = createFakeApi({
    consented: true,
    parentTitle: '엄마',
    latest: {prompt: '더 좋아하는 계절은요?', choiceLabel: '가을', answeredDate: '2020-11-16'},
  });
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByText('엄마의 최근 답'));
  expect(screen.getByText('가을')).toBeTruthy();
  expect(screen.getByText('2020년 11월 16일')).toBeTruthy(); // 오래된 날짜도 그대로
  expect(screen.getByText('이 답으로 이야기를 시작해 봐요')).toBeTruthy(); // 지난 날 답(C4 확정)
  expectNoPressure();
});

test('C4 첫날 빈 상태 안 B(#59): 한 줄 + 흐린 예시 카드 2장(예시 칩·점선, 누르는 것 아님) + 이야기 꺼내기 한 줄', async () => {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '아빠', latest: null})} role="child" />);
  await waitFor(() => screen.getByTestId('child-home-empty'));
  expect(screen.getByText('부모님이 오늘 사진을 보시면 여기에 답이 보여요')).toBeTruthy();
  for (const i of [1, 2]) {
    const card = screen.getByTestId(`child-home-example-${i}`);
    expect(card.props.accessibilityLabel).toMatch(/^예시, /); // 실제 답으로 오인하지 않게 '예시'부터 읽는다
    expect(StyleSheet.flatten(card.props.style).borderStyle).toBe('dashed');
    expect(card.props.accessibilityRole).toBeUndefined(); // 누르는 것 아님
  }
  expect(screen.getByTestId('child-home-example-1').props.accessibilityLabel).toBe('예시, 이렇게 보여요, 산과 바다 중 가을');
  expect(screen.getByTestId('child-home-example-2').props.accessibilityLabel).toBe('예시, 지난 답, 산과 바다 중 바다');
  // 리뷰 M1·디자인 #92(a): 이야기 꺼내기도 예시 — 같은 모양(점선), 읽기 이름 '예시, 이야기 꺼내기, …'
  const starter = screen.getByTestId('child-home-empty-starter');
  expect(starter.props.accessibilityLabel).toBe('예시, 이야기 꺼내기, 가을에 자주 가시던 곳이 있었는지 여쭤봐요');
  expect(StyleSheet.flatten(starter.props.style).borderStyle).toBe('dashed');
  expect(screen.queryByText(/11월 1[56]일/)).toBeNull(); // 디자인 #89: 예시에 실제 날짜 없음
  // 재확인 L7: 읽기 이름에 '○' 기호가 없다(보이는 줄에만 ○월 ○일)
  for (const id of ['child-home-example-1', 'child-home-example-2', 'child-home-empty-starter']) {
    expect(screen.getByTestId(id).props.accessibilityLabel).not.toMatch(/○/);
  }
  // 디자인 #94: 첫 예시 제목은 실제 카드('…의 최근 답')와 다른 '이렇게 보여요', 예시 칩 글자는 자녀 하한 16·줄높이 24(확대 비례)
  expect(screen.getByText('이렇게 보여요')).toBeTruthy();
  expect(screen.queryByText('부모님의 최근 답')).toBeNull();
  const chip = StyleSheet.flatten(screen.getAllByText('예시')[0].props.style);
  expect(chip.fontSize).toBeGreaterThanOrEqual(16);
  expect(chip.lineHeight).toBe(24);
  expect(screen.queryByText('아빠의 최근 답')).toBeNull(); // 예시에는 실제 호칭을 쓰지 않는다(가짜 개인정보 없음)
  expect(screen.queryByText('고른 답이 생기면 여기에 보여요')).toBeNull();
  expectNoPressure();
});

test('C4 빈 상태 접힘 경계(R-15): 첫 화면 끝이 예시 카드를 가르면 그 카드 위에 잰 만큼 간격, 안내 한 줄은 밀지 않는다', async () => {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '아빠', latest: null})} role="child" />);
  await waitFor(() => screen.getByTestId('child-home-empty'));
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
  const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).marginTop;
  await act(async () => {
    lay('screen-body', 0, 328); // C4 홈은 옛 Screen: 접힘 = 스크롤 창 − 아래 흐림 28 = 300(리뷰 L4)
    lay('child-home-empty', 20, 400); // 묶음 위 끝 20, 사이 14
    lay('child-home-empty-line', 0, 112); // 20~132
    lay('child-home-example-1', 0, 120); // 146~266
    lay('child-home-example-2', 0, 120); // 280~400 → 300 에 걸림
    lay('child-home-empty-starter', 0, 90);
  });
  expect(mt('child-home-example-2')).toBe(328 - 280); // 흐림 위(300)에 걸치면 민다, 민 카드는 흐림 밑 창 끝(328)으로
  expect(mt('child-home-example-1')).toBeUndefined();
  // 재확인 L6: 위 끝이 흐림 구간(300~328) 안에서 시작하는 요소도 민다(흐림 속에 테두리가 비치지 않게)
  await act(async () => {
    lay('child-home-example-1', 0, 140); // 146~286 → 카드 2 는 300~420: 위 끝이 흐림 구간(300~328) 안
  });
  expect(mt('child-home-example-2')).toBe(328 - 300);
  // 창이 커져 다 들어가면 간격 없음
  await act(async () => {
    lay('screen-body', 0, 700);
  });
  expect(mt('child-home-example-2')).toBeUndefined();
});

test('리뷰 L3 ①: 동의한 분(답 없음) + 나누지 않는 분이 섞이면 빈 상태 대신 기존 카드', async () => {
  const api = createFakeApi({consented: true, parents: [{title: '엄마'}, {title: '아빠', shared: false}]});
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByText('답을 나누지 않는 중이에요'));
  expect(screen.queryByTestId('child-home-empty')).toBeNull();
});

test('리뷰 L3 ②: 빈 상태에서 다시 불러와 첫 답이 생기면 실제 답 카드로 바뀐다', async () => {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const {AppState} = require('react-native');
  const handlers: ((st: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (st: string) => void) => {
    handlers.push(h);
    return {remove: () => {}};
  }) as never);
  const api = createFakeApi({consented: true, parentTitle: '아빠', latest: null});
  const get = api.fetchChildSummary.bind(api);
  let answered = false;
  jest.spyOn(api, 'fetchChildSummary').mockImplementation(async () => {
    const s = await get();
    return answered ? {...s, parents: s.parents.map(p => ({...p, latest: {prompt: '봄과 가을', choiceLabel: '봄', answeredDate: today}}))} : s;
  });
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByTestId('child-home-empty'));
  answered = true;
  await act(async () => {
    handlers.forEach(h => h('active')); // 앞으로 돌아오면 다시 불러온다(useFocusLoad)
  });
  await waitFor(() => screen.getByText('봄'));
  expect(screen.queryByTestId('child-home-empty')).toBeNull();
});

test('리뷰 L1: 연결 0명(새 계약 parents 빈 배열)이면 빈 상태 B 를 보이지 않는다', async () => {
  const api = createFakeApi({consented: true, parentTitle: '아빠', latest: null});
  const get = api.fetchChildSummary.bind(api);
  jest.spyOn(api, 'fetchChildSummary').mockImplementation(async () => ({...(await get()), parents: []}));
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByText('고른 답이 생기면 여기에 보여요'));
  expect(screen.queryByTestId('child-home-empty')).toBeNull();
});

test('답이 하나라도 있으면 빈 상태 대신 실제 답 카드(첫날 화면은 아무 답도 없을 때만)', async () => {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const api = createFakeApi({consented: true, parents: [{title: '엄마', latest: {prompt: '봄과 가을', choiceLabel: '봄', answeredDate: today}}, {title: '아빠'}]});
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByText('엄마의 최근 답'));
  expect(screen.queryByTestId('child-home-empty')).toBeNull();
});

test('어르신이 답을 나누지 않으면 그렇게 알린다', async () => {
  render(<AppRoot api={createFakeApi({consented: false})} role="child" />);
  await waitFor(() => screen.getByText('답을 나누지 않는 중이에요'));
  expectNoPressure();
});

test('조회 실패는 오류 상태이고 다시 불러올 수 있다', async () => {
  render(<AppRoot api={createFakeApi({failChildHome: 1, consented: true, latest: null})} role="child" />);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.queryByTestId('child-home-empty')).toBeNull();
});

test('날짜 표시: 오늘이면 "오늘", 올해면 월·일, 다른 해는 연도 포함', () => {
  const now = new Date('2026-11-17T03:00:00Z'); // KST 12시
  expect(formatAnswerDate('2026-11-17', now)).toBe('오늘');
  expect(formatAnswerDate('2026-11-16', now)).toBe('11월 16일');
  expect(formatAnswerDate('2025-12-01', now)).toBe('2025년 12월 1일');
});

test('fake: 호칭은 닫힌 목록만, 철회하면 저장된 답이 사라진다', async () => {
  const api = createFakeApi();
  expect(await api.setParentTitle('엄마')).toEqual({ok: true});
  expect(await api.setParentTitle('사장님')).toEqual({ok: false, reason: 'invalid_title'});
  expect((await api.fetchChildSummary()).parentTitle).toBe('엄마');
  await api.giveConsent('v2');
  await api.saveAnswer({questionId: 'q-1', choice: 'A'});
  expect((await api.fetchChildSummary()).latest?.choiceLabel).toBe('봄');
  await api.withdrawConsent();
  const s = await api.fetchChildSummary();
  expect(s.shared).toBe(false);
  expect(s.latest).toBeNull();
});
