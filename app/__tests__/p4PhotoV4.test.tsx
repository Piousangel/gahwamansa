// P4 사진 중심 안(시안 P4_photo_ds4c): 사진 128/100, 사진 안 AI 칩, 설명 줄 자리(100%: 사진 아래 / 200%: 읽어 주세요 아래),
// 읽어 주세요는 질문 바로 아래 본문, Dock 은 '다 봤어요' 하나.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

async function toPhoto() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('photo-polaroid'));
}

// 본문에서 testID 순서(위 → 아래)
function order(ids: string[]): string[] {
  const all = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && ids.includes(n.props.testID) && typeof n.type === 'string');
  return [...new Set(all.map(n => n.props.testID as string))];
}

afterEach(() => {
  mockFontScale = 1;
});

test('100%: 사진 128 → 설명 → 질문 → 읽어 주세요 → 천천히, Dock 은 다 봤어요 하나', async () => {
  await toPhoto();
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(128);
  expect(order(['photo-polaroid', 'photo-caption', 'recall-questions', 'read-aloud'])).toEqual(['photo-polaroid', 'photo-caption', 'recall-questions', 'read-aloud']);
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['다 봤어요']);
  expect(screen.queryByTestId('to-course-home')).toBeNull();
});

test('200%: 사진 100, 설명 줄은 읽어 주세요 아래(질문 첫 문장이 첫 화면에)', async () => {
  mockFontScale = 2;
  await toPhoto();
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(100);
  expect(order(['photo-polaroid', 'photo-caption', 'recall-questions', 'read-aloud'])).toEqual(['photo-polaroid', 'recall-questions', 'read-aloud', 'photo-caption']);
});
