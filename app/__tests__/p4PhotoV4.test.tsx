// P4 사진 중심 안(시안 P4_photo_ds4c, 디자인 #95 최종): 사진은 원본 비율(오너 S25 11-24, photoFrame — 옛 고정 124/88/80 폐기), 칩 없이 사진 바로 아래 AI 고지 한 줄,
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
let mockWin = {width: 360, height: 640};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({...mockWin, scale: 3, fontScale: mockFontScale}),
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

// 360×640 창, 본문 폭은 재기 전 어림(360 − 좌우 24×2 = 312), 사진 높이 상한 = 640 × 0.45 = 288. 콘텐츠 사진 1152×928 → 312×251
const frameOf = () => {
  const st = StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style);
  return {width: st.width, height: st.height};
};
const loadPhoto = (width: number, height: number) => fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width, height}}});

afterEach(() => {
  mockFontScale = 1;
  mockWin = {width: 360, height: 640};
});

test('100% 설명 있는 날: 사진(불러오기 전 콘텐츠 비율 틀) → AI 고지 → 설명 → 질문 → 읽어 주세요, 칩 없음, Dock 은 다 봤어요 하나', async () => {
  await toPhoto();
  expect(frameOf()).toEqual({width: 312, height: 251});
  expect(order(['photo-polaroid', 'ai-notice', 'photo-caption', 'recall-questions', 'read-aloud'])).toEqual(['photo-polaroid', 'ai-notice', 'photo-caption', 'recall-questions', 'read-aloud']);
  expect(screen.getByTestId('ai-notice')).toHaveTextContent('AI가 만든 그림·실제 장소가 아니에요');
  expect(screen.queryByTestId('photo-ai-chip', {includeHiddenElements: true})).toBeNull();
  expect(screen.getByText(/사진 보기 · 1 \/ 3/)).toBeTruthy();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['다 봤어요']);
  expect(screen.queryByTestId('to-course-home')).toBeNull();
});

test('100% 설명 없는 날: 사진 틀은 설명 유무와 상관없음, 고지는 그대로 사진 바로 아래', async () => {
  await toPhoto(true);
  expect(frameOf()).toEqual({width: 312, height: 251});
  expect(screen.queryByTestId('photo-caption')).toBeNull();
  expect(order(['photo-polaroid', 'ai-notice', 'recall-questions'])).toEqual(['photo-polaroid', 'ai-notice', 'recall-questions']);
});

test('오너 S25 11-24(띠처럼 잘림): 불러온 사진의 원본 비율대로 — 가로는 폭을 채우고, 정사각·세로는 상한(창 45%) 높이로 폭을 줄인다. 잘라 내지 않는다(contain)', async () => {
  await toPhoto();
  expect(screen.getByTestId('photo-image').props.resizeMode).toBe('contain');
  loadPhoto(1600, 900);
  await waitFor(() => expect(frameOf()).toEqual({width: 312, height: 176}));
  loadPhoto(1152, 928);
  await waitFor(() => expect(frameOf()).toEqual({width: 312, height: 251}));
  loadPhoto(1024, 1024);
  await waitFor(() => expect(frameOf()).toEqual({width: 288, height: 288}));
  loadPhoto(900, 1600);
  await waitFor(() => expect(frameOf()).toEqual({width: 162, height: 288}));
});

test('200%: 사진은 글자 크기로 줄이지 않는다(100%와 같은 틀, 본문 스크롤)', async () => {
  mockFontScale = 2;
  await toPhoto();
  loadPhoto(1024, 1024);
  await waitFor(() => expect(frameOf()).toEqual({width: 288, height: 288}));
});

test('200%: 단계 표시 1 / 3 만(읽기는 그대로), 고지 상한 1.5, 설명 줄은 읽어 주세요 아래', async () => {
  mockFontScale = 2;
  await toPhoto();
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

// ── 첫 화면 보장(#234 M2, 리드 결정): 레이아웃을 실측값으로 흉내 내 '질문 첫 문장 바닥 ≤ 첫 화면'을 직접 단언한다 ──
// 고정 높이는 11-24 에뮬레이터 캡처(1080×2340 @450)에서 잰 dp: 단계 제목 35, AI 고지 28, 설명 28, 질문 한 문장(312 폭 두 줄) 64,
// 읽어 주세요 64, 그 밖 한 줄 28. 360×640 의 viewport 368 = 640 − 위(상태 바 46 + BackLink 83) − 아래(더 있음 띠·Dock·내비 143).
const H_OF: Record<string, number> = {error: 80, header: 35, ai: 28, caption: 28, q0: 64, q1: 64, q2: 64, read: 64};
const BODY_TOP = 4;
const lay = (id: string, height: number, y = 0, width = 312) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width, height}}});
const wrappers = () =>
  screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && typeof n.props?.testID === 'string' && n.props.testID.startsWith('p4-body:'));
// 지금 그려진 순서·높이로 모든 요소에 layout 을 준다(사진은 지금 틀 높이). 사진 높이가 바뀌면 다시 준다
function layoutAll(viewport: number) {
  lay('screen-body-area', viewport + 24); // MORE_BAND_H
  lay('p4-body', 0, BODY_TOP);
  for (const w of wrappers()) {
    const key = w.props.testID.slice('p4-body:'.length);
    lay(w.props.testID, key === 'photo' ? frameOf().height : H_OF[key] ?? 28);
  }
}
// 질문 첫 문장(q0) 위 끝: 묶음 위 + 앞 요소 높이 + 각 요소의 marginTop(간격 + 접힘 여백)
function q0Box() {
  let y = BODY_TOP;
  for (const w of wrappers()) {
    const key = w.props.testID.slice('p4-body:'.length);
    y += Number(StyleSheet.flatten(w.props.style)?.marginTop ?? 0);
    if (key === 'q0') {
      return {top: y, bottom: y + H_OF.q0};
    }
    y += key === 'photo' ? frameOf().height : H_OF[key] ?? 28;
  }
  throw new Error('q0 없음');
}
async function settle(viewport: number) {
  for (let i = 0; i < 4; i++) {
    layoutAll(viewport); // 측정 → (사진 줄임) → 다시 측정
    await waitFor(() => expect(wrappers().length).toBeGreaterThan(0));
  }
}

test('#234 M2: 360×640·100%·콘텐츠 사진(1152×928)에서 질문 첫 문장이 첫 화면 안에 든다(사진은 바닥 위에서 줄어듦)', async () => {
  await toPhoto();
  loadPhoto(1152, 928);
  await settle(368);
  const q0 = q0Box();
  expect(q0.bottom).toBeLessThanOrEqual(368);
  expect(frameOf().height).toBe(368 - (BODY_TOP + 35 + 8) - 8 - 28 - 8 - 64); // fit = 213
  expect(frameOf().height).toBeGreaterThanOrEqual(160); // 바닥 위
});

test('#234 M2: 더 작은 창(viewport 300)에서는 바닥(폭 50%·160)에 닿아 사진을 우선하고 질문은 접힘 아래로 간다', async () => {
  await toPhoto();
  loadPhoto(1152, 928);
  await settle(300);
  expect(frameOf().height).toBe(160);
  expect(q0Box().top).toBeGreaterThanOrEqual(300); // 통째로 접힘 아래(R-15)
});

test('#234 M2: S25급(384×832, viewport 560)에서는 콘텐츠 사진 크기가 그대로(폭 336 × 271)', async () => {
  mockWin = {width: 384, height: 832};
  await toPhoto();
  loadPhoto(1152, 928);
  lay('photo-box', 0, 0, 336);
  await settle(560);
  expect(frameOf()).toEqual({width: 336, height: 271});
  expect(q0Box().bottom).toBeLessThanOrEqual(560);
});

test('#234 M2 조건 2: 줄인 뒤 다시 재도 값이 같으면 다시 계산하지 않는다(반복·튐 없음)', async () => {
  await toPhoto();
  loadPhoto(1152, 928);
  await settle(368);
  const first = frameOf();
  const spy = jest.spyOn(require('../src/features/course/photoFrame'), 'photoFit');
  for (let i = 0; i < 3; i++) {
    layoutAll(368); // 같은 실측을 여러 번
    lay('p4-body:photo', 251 + i); // 사진 칸 높이만 바뀐 측정(줄이기 전·중간 프레임) — 제목·고지·질문은 그대로라 다시 계산할 것이 없다
  }
  await waitFor(() => expect(frameOf()).toEqual(first));
  expect(spy).not.toHaveBeenCalled(); // 화면이 다시 그려지지 않았다(측정 state 가 그대로)
  spy.mockRestore();
});

test('#234 L3: 사진 칸 실측 폭(onLayout)을 쓴다 — 어림 폭(312)이 아니라', async () => {
  await toPhoto();
  loadPhoto(1152, 928);
  lay('photo-box', 0, 0, 300);
  await waitFor(() => expect(frameOf()).toEqual({width: 300, height: 242}));
});

test('#234 M2: 200%는 첫 화면 맞춤을 하지 않는다(사진은 45% 상한만, 본문 스크롤)', async () => {
  mockFontScale = 2;
  await toPhoto();
  loadPhoto(1152, 928);
  await settle(300);
  expect(frameOf()).toEqual({width: 312, height: 251});
});
