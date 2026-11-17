import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
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
  expect(screen.getByText('가을 이야기를 해 볼까요?')).toBeTruthy();
  expectNoPressure();
});

test('답이 없으면 안내 한 줄만 보여 준다', async () => {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '아빠', latest: null})} role="child" />);
  await waitFor(() => screen.getByText('고른 답이 생기면 여기에 보여요'));
  expectNoPressure();
});

test('어르신이 답을 나누지 않으면 그렇게 알린다', async () => {
  render(<AppRoot api={createFakeApi({consented: false})} role="child" />);
  await waitFor(() => screen.getByText('답을 나누지 않는 중이에요'));
  expectNoPressure();
});

test('조회 실패는 오류 상태이고 다시 불러올 수 있다', async () => {
  render(<AppRoot api={createFakeApi({failChildHome: 1, consented: true, latest: null})} role="child" />);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.queryByText('고른 답이 생기면 여기에 보여요')).toBeNull();
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
