// P4 사진 중심 안(시안 P4_photo_ds4c, 디자인 #95 최종): 사진 124(설명 없는 날)/88(있는 날)/80(200%), 칩 없이 사진 바로 아래 AI 고지 한 줄,
// 설명 줄 자리(100%: 고지 아래 / 200%: 읽어 주세요 아래), 200% 단계 표시 '1 / 3',
// 읽어 주세요는 질문 바로 아래 본문, Dock 은 '다 봤어요' 하나.
import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';
import {PhotoZoom} from '../src/features/course/PhotoZoom';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

async function toPhoto(noCaption = false) {
  const api = createFakeApi({linked: true, consented: true, realImage: true});
  if (noCaption) {
    const get = api.getTodayContent.bind(api);
    api.getTodayContent = async () => {
      const c = await get();
      return c && c.photo ? {...c, photo: {...c.photo, caption: ''}} : c;
    };
  }
  render(<AppRoot api={api} role="parent" restore />);
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

test('100% 설명 있는 날: 사진 88 → AI 고지 → 설명 → 질문 → 읽어 주세요, 칩 없음, Dock 은 다 봤어요 하나', async () => {
  await toPhoto();
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(88);
  expect(order(['photo-polaroid', 'ai-notice', 'photo-caption', 'recall-questions', 'read-aloud'])).toEqual(['photo-polaroid', 'ai-notice', 'photo-caption', 'recall-questions', 'read-aloud']);
  expect(screen.getByTestId('ai-notice')).toHaveTextContent('AI가 만든 그림 · 실제 장소가 아니에요');
  expect(screen.queryByTestId('photo-ai-chip', {includeHiddenElements: true})).toBeNull();
  expect(screen.getByText(/사진 보기 · 1 \/ 3/)).toBeTruthy();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['다 봤어요']);
  expect(screen.queryByTestId('to-course-home')).toBeNull();
});

test('100% 설명 없는 날: 사진 124, 고지는 그대로 사진 바로 아래', async () => {
  await toPhoto(true);
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(124);
  expect(screen.queryByTestId('photo-caption')).toBeNull();
  expect(order(['photo-polaroid', 'ai-notice', 'recall-questions'])).toEqual(['photo-polaroid', 'ai-notice', 'recall-questions']);
});

test('200%: 사진 80, 단계 표시 1 / 3 만(읽기는 그대로), 고지 상한 1.5, 설명 줄은 읽어 주세요 아래', async () => {
  mockFontScale = 2;
  await toPhoto();
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(80);
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(screen.queryByText(/사진 보기 ·/)).toBeNull();
  expect(screen.getByTestId('step-header').props.accessibilityLabel).toBe('사진 보기, 3단계 중 1단계');
  expect(screen.getByTestId('ai-notice').props.maxFontSizeMultiplier).toBe(1.5);
  expect(StyleSheet.flatten(screen.getByTestId('ai-notice').props.style).fontSize).toBe(20);
  expect(order(['photo-polaroid', 'ai-notice', 'photo-caption', 'recall-questions', 'read-aloud'])).toEqual(['photo-polaroid', 'ai-notice', 'recall-questions', 'read-aloud', 'photo-caption']);
});

test('리뷰 M2: 크게 보기(Modal)는 접힘 묶음 밖 — 높이 0 자식에 간격이 붙지 않는다', async () => {
  await toPhoto();
  fireEvent(screen.getByTestId('photo-image'), 'load');
  await waitFor(() => expect(screen.getByTestId('photo-polaroid').props.accessibilityRole).toBe('button'));
  expect(screen.UNSAFE_getAllByType(PhotoZoom)).toHaveLength(1);
  expect(within(screen.getByTestId('p4-body')).UNSAFE_queryAllByType(PhotoZoom)).toHaveLength(0);
});

test('에뮬레이터 실측 11-20: 질문은 100%에서도 문장마다 접힘 단위, 크게 보기 첫 안내는 질문·읽어 주세요 아래(레드라인을 밀지 않게)', async () => {
  await toPhoto();
  fireEvent(screen.getByTestId('photo-image'), 'load');
  await waitFor(() => screen.getByTestId('zoom-hint'));
  expect(order(['ai-notice', 'recall-questions', 'read-aloud', 'zoom-hint'])).toEqual(['ai-notice', 'recall-questions', 'read-aloud', 'zoom-hint']);
  const kids = screen.getByTestId('p4-body').children.length;
  const recall = screen.getAllByText(/\?$/).length; // 회상 질문 문장 수(fake 는 물음표로 끝남)
  expect(kids).toBeGreaterThanOrEqual(recall + 4); // 단계·사진·고지·질문 문장들·읽어 주세요…
});
