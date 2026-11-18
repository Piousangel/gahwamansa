import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {color} from '../src/ui/tokens';
import {pressCourseNext} from '../testUtils/flow';

// AP-08 P5 제목 문구(시안 P5_question): 제목 '마음에 드는 쪽을 골라 주세요'(32) + 보조 '정답은 없어요…'(20, inkSub),
// 그 아래 질문 문장(22 굵게). 질문 문장이 없는 날은 제목·보조만.
async function toQuestion(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo'], ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('choice-group'));
}

test('제목·보조·질문 문장 순서와 크기', async () => {
  await toQuestion();
  const title = screen.getByText('마음에 드는 쪽을 골라 주세요');
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(32);
  const hint = screen.getByText('정답은 없어요. 마음 가는 쪽을 눌러 주세요');
  expect(StyleSheet.flatten(hint.props.style).fontSize).toBe(20);
  expect(StyleSheet.flatten(hint.props.style).color).toBe(color.inkSub);
  const prompt = screen.getByText('더 좋아하는 계절은요?');
  expect(StyleSheet.flatten(prompt.props.style).fontSize).toBe(22);
  expect(StyleSheet.flatten(prompt.props.style).fontWeight).toBe('bold');
});

test('질문 문장이 없는 날은 제목·보조만(제목이 두 번 나오지 않음)', async () => {
  await toQuestion({promptNull: true});
  expect(screen.getAllByText('마음에 드는 쪽을 골라 주세요')).toHaveLength(1);
});
