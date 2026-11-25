// 대기열 33: 320×640 200%에서 P7 첫 화면에 제목만 보이던 문제.
// 원인(에뮬레이터 실측, docs/team/qa/evidence/2026-11-25-p7-200): 마운트 274(캡션 3줄 114) + 제목 97 이라 제목 뒤 남는 칸이 30이고,
// 본문(160)·「가족에게 건넸어요」(40)가 R-15 로 통째로 접힘 아래로 갔다.
// 고침: 글자 1.75배 이상이면 제목 → 본문 → 마운트로 순서만 바꾼다. 150% 이하는 시안 순서(마운트 먼저) 그대로.
// jest 에는 레이아웃이 없어 onLayout 을 손으로 보내 접힘 계산을 본다(높이는 에뮬레이터 실측값).
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {press, pressCourseNext} from '../testUtils/flow';
import {P7_MOUNT} from '../src/features/course/AlbumMount';
import {appCopy} from '../src/copy/copy';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 320, height: 640, scale: 2.75, fontScale: mockFontScale}),
}));

beforeEach(async () => {
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
  mockFontScale = 1;
});

/** 3단계(스위치 꺼짐): ③ 쓰기를 넘겨 P7 */
async function toDone3() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
}
/** 5단계: ⑤에서 건넨 날 P7 */
async function toPassedOn() {
  setFeature('fiveSteps', true);
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'recall', 'question', 'hangul']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-choice'));
  fireEvent.press(screen.getAllByRole('radio')[0]);
  await press('건넬게요');
  await waitFor(() => screen.getByText('가족에게 건넸어요'));
}
const ids = () =>
  screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && n.props.testID.startsWith('p7-item-') && typeof n.type === 'string').map(n => n.props.testID as string);
const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
const marginTop = (id: string): number => StyleSheet.flatten(screen.getByTestId(id, {includeHiddenElements: true}).props.style)?.marginTop ?? 0;

describe('배율별 배치', () => {
  test.each([1, 1.5])('글자 %s배: 시안 순서 그대로 — 마운트 → 제목 → 본문, 마운트 위 여백 8', async scale => {
    mockFontScale = scale;
    await toDone3();
    expect(ids()).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-text']);
    expect(marginTop('p7-mount')).toBe(P7_MOUNT.margin.top);
  });

  test.each([1.8, 2])('글자 %s배: 제목 → 본문 → 마운트, 마운트 위 여백은 테이프·기울임 넘침보다 크게(20)', async scale => {
    mockFontScale = scale;
    await toDone3();
    expect(ids()).toEqual(['p7-item-title', 'p7-item-text', 'p7-item-mount']);
    expect(marginTop('p7-mount')).toBe(P7_MOUNT.margin.afterBody);
    expect(P7_MOUNT.margin.afterBody).toBeGreaterThan(-P7_MOUNT.tape.top); // 테이프(-12)가 마운트 칸 위로 나가지 않게
  });

  test('건넨 날 200%: 제목 → 「가족에게 건넸어요」 → 둘째 줄 → 마운트', async () => {
    mockFontScale = 2;
    await toPassedOn();
    expect(ids()).toEqual(['p7-item-title', 'p7-item-passed', 'p7-item-text', 'p7-item-mount']);
  });

  test('200%에서도 마운트 안은 그대로: 272 폭·캡션은 법무 고지 두 문장(AI 표기 → 실제 장소 아님)', async () => {
    mockFontScale = 2;
    await toDone3();
    expect(StyleSheet.flatten(screen.getByTestId('p7-mount').props.style).width).toBe(P7_MOUNT.width.large);
    expect(screen.getByTestId('p7-ai-caption')).toHaveTextContent(new RegExp(`^${appCopy.ai_photo_label}\\s*${appCopy.not_real_place}$`));
  });
});

describe('R-15 (320×640 200% 실측 높이)', () => {
  // 접힘 = 본문 영역 470 − '더 있음' 띠 24 = 446, 묶음 위 끝 12. 높이: 제목 97·본문 160·건넨 줄 40·마운트 287(위 여백 20 포함)
  test('3단계: 제목·본문은 첫 화면에 남고, 접힘에 걸친 마운트만 통째로 민다', async () => {
    mockFontScale = 2;
    await toDone3();
    await act(async () => {
      lay('screen-body-area', 0, 470);
      lay('p7-stage', 12, 0);
      lay('p7-item-title', 0, 97); // 12~109
      lay('p7-item-text', 0, 160); // 125~285 → 첫 화면
      lay('p7-item-mount', 0, 287); // 301~588 → 446 에 걸림
    });
    // 고치기 전(마운트 → 제목 → 본문): 본문이 413~573 으로 걸려 통째로 밀렸다(첫 화면에 제목만)
    expect(marginTop('p7-item-title')).toBe(0);
    expect(marginTop('p7-item-text')).toBe(0);
    expect(marginTop('p7-item-mount')).toBe(446 - 301 + 1); // 에뮬레이터 실측 146 과 같다
  });

  test('건넨 날: 「가족에게 건넸어요」와 둘째 줄이 모두 첫 화면, 마운트만 민다', async () => {
    mockFontScale = 2;
    await toPassedOn();
    await act(async () => {
      lay('screen-body-area', 0, 470);
      lay('p7-stage', 12, 0);
      lay('p7-item-title', 0, 97); // 12~109
      lay('p7-item-passed', 0, 40); // 125~165
      lay('p7-item-text', 0, 160); // 181~341
      lay('p7-item-mount', 0, 287); // 357~644 → 걸림
    });
    expect(marginTop('p7-item-passed')).toBe(0);
    expect(marginTop('p7-item-text')).toBe(0);
    expect(marginTop('p7-item-mount')).toBe(446 - 357 + 1); // 실측 90
  });
});
