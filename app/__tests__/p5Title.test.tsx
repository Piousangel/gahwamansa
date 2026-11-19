import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {roleText} from '../src/ui/ds/roles';
import {pressCourseNext} from '../testUtils/flow';

// P5 제목(시안 P3_P4_P5_ds4b): 단계 제목 한 줄 → 질문(title) → '정답은 없어요…'(sub muted, 늘 한 줄). 질문 문장이 없는 날은 공통 문장이 제목.
async function toQuestion(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo'], ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('choice-group'));
}

test('위계(시안 P5 ds4b): 질문이 제목(title 역할), 그 아래 정답은 없어요(보조 muted), 지시문 줄은 없다', async () => {
  await toQuestion();
  const prompt = screen.getByText('더 좋아하는 계절은요?');
  const title = roleText('title', 'elder').style;
  expect(StyleSheet.flatten(prompt.props.style).fontSize).toBe(title.fontSize);
  expect(StyleSheet.flatten(prompt.props.style).fontWeight).toBe('700');
  const hint = screen.getByText('정답은 없어요. 마음 가는 쪽을 눌러 주세요');
  expect(StyleSheet.flatten(hint.props.style).color).toBe(roleText('sub', 'elder', 'muted').style.color);
  expect(screen.queryByText('마음에 드는 쪽을 골라 주세요')).toBeNull();
});

test('질문 문장이 없는 날은 공통 문장이 제목(한 번만)', async () => {
  await toQuestion({promptNull: true});
  expect(screen.getAllByText('마음에 드는 쪽을 골라 주세요')).toHaveLength(1);
});
