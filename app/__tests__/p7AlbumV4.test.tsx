// P7 완료 앨범 배치(시안 P7_album_ds4, 디자인 #95): 마운트 236/272·사진 150/96, 도장은 100% 사진 오른쪽 아래(90)·200% 캡션 위(-2),
// 이번 주 도장 줄은 7칸(찍은 날 ✓ + 읽기는 찍은 요일만), Dock 은 '알겠어요' 하나, 색은 토큰.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, pressCourseNext} from '../testUtils/flow';
import {P7_MOUNT} from '../src/features/course/AlbumMount';
import {WeekStampStrip} from '../src/features/course/WeekStampStrip';
import {SealStamp} from '../src/ui/assets/album';
import {tokensV4} from '../src/ui/tokensV4';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

async function toDone() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
}
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, {includeHiddenElements: true}).props.style);

test('100%: 마운트 236·도장 사진 오른쪽 아래(90), 순서 마운트 → 제목 → 도장 줄 → 둘째 줄, Dock 은 알겠어요 하나', async () => {
  await toDone();
  expect(flat('p7-mount').width).toBe(P7_MOUNT.width.base);
  expect(flat('p7-seal-slot').top).toBe(P7_MOUNT.seal.top.base);
  const ids = screen.UNSAFE_root.findAll(n => ['p7-mount', 'p7-title', 'p7-week', 'p7-text'].includes(n.props?.testID) && typeof n.type === 'string').map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['p7-mount', 'p7-title', 'p7-week', 'p7-text']);
  expect(within(screen.getByTestId('screen-dock')).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['알겠어요']);
  expect(screen.getByTestId('p7-photo', {includeHiddenElements: true})).toBeTruthy();
});

test('200%: 마운트 272·도장은 캡션 위(-2, #95)', async () => {
  mockFontScale = 2;
  await toDone();
  expect(flat('p7-mount').width).toBe(P7_MOUNT.width.large);
  expect(flat('p7-seal-slot').top).toBe(P7_MOUNT.seal.top.large);
});

test('R-15: 첫 화면 끝이 도장 줄을 가르면 그 줄을 통째로 접힘 밖으로(마운트는 밀지 않음)', async () => {
  mockFontScale = 2;
  await toDone();
  const {fireEvent, act} = require('@testing-library/react-native');
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
  const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)?.marginTop;
  await act(async () => {
    lay('screen-body-area', 0, 504); // 접힘 = 504 − 띠 24 = 480
    lay('p7-stage', 8, 600);
    lay('p7-item-mount', 0, 300); // 8~308
    lay('p7-item-title', 0, 132); // 324~456
    lay('p7-item-week', 0, 40); // 472~512 → 480 에 걸림
    lay('p7-item-text', 0, 64);
  });
  expect(mt('p7-item-week')).toBeGreaterThanOrEqual(480 - 472);
  expect(mt('p7-item-mount')).toBeUndefined();
  expect(mt('p7-item-title')).toBeUndefined();
  // 묶음 안 위 여백(padding)은 위치 계산에 안 들어가 판정이 어긋난다(에뮬레이터 실측 11-20) → 묶음에는 padding 을 두지 않는다
  expect(StyleSheet.flatten(screen.getByTestId('p7-stage').props.style).paddingTop).toBeUndefined();
});

test('도장 줄: 7칸, 찍은 날만 ✓, 읽기는 찍은 요일만(개수·빈 날 미언급), 색은 토큰', () => {
  render(<WeekStampStrip days={[true, false, true, false, false, false, false]} />);
  const row = screen.getByTestId('p7-week');
  expect(row.props.accessibilityLabel).toBe('이번 주 도장, 월요일, 수요일에 찍었어요');
  expect(screen.getAllByTestId(/^stamp-(on|empty)-\d$/)).toHaveLength(7);
  expect(StyleSheet.flatten(screen.getByTestId('stamp-on-0').props.style)).toMatchObject({backgroundColor: tokensV4.color.actionSoft, borderColor: tokensV4.color.action});
  expect(StyleSheet.flatten(screen.getByTestId('stamp-empty-1').props.style)).toMatchObject({backgroundColor: tokensV4.color.card, borderColor: tokensV4.color.line});
  expect(within(screen.getByTestId('stamp-on-0')).getByTestId('icon-check', {includeHiddenElements: true})).toBeTruthy();
});

test('인장 색은 토큰(brandSeal·brandSealDeep·brandSealGlyph)에서 — 토큰만 바꾸면 바뀐다', () => {
  render(<SealStamp testID="seal" />);
  const xml: string = screen.getByTestId('seal', {includeHiddenElements: true}).props.xml;
  expect(xml).toContain(tokensV4.color.brandSeal);
  expect(xml).toContain(tokensV4.color.brandSealDeep);
  expect(xml).toContain(tokensV4.color.brandSealGlyph);
});
