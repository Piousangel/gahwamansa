// D-3 '오늘 코스 다시 보기' 안 A '오늘 한 장'(DECISIONS 2026-11-24, 시안 docs/design/2026-11-24-d2-d3-c4/d3-course-review.html).
// 한 화면 세로 스크롤: BackLink '오늘 코스로' → 날짜 → 사진(누르면 크게, 원본 비율) → 사진 이름·AI 고지 → 고르신 쪽 노랑 팻말 + '다른 하나 · {안 고른 쪽}'
// → 오늘 낱말. Dock = '읽어 주세요'(돌아가기는 BackLink 하나). D-1 '먼저 떠오른 것' 자리는 아직 없다. 기록·계측 호출 0.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import type {ReactTestInstance} from 'react-test-renderer';
import {appCopy} from '../src/copy/copy';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';
import {roleText} from '../src/ui/ds/roles';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

const kstDateLine = () => {
  const d = new Date(Date.now() + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][d.getUTCDay()]}`;
};

async function review(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'A', realImage: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  const spies = (['recordSessionStep', 'logEvent', 'startToday', 'getTodayContent', 'saveAnswer'] as const).map(k => jest.spyOn(api, k));
  const calls = () => spies.map(s => s.mock.calls.length);
  const beforeEntry = calls(); // 기준점 = 다시 보기 누르기 전(진입 때 호출도 잡는다, QA-1 M1)
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByTestId('today-review'));
  return {api, calls, beforeEntry};
}

function order(ids: string[]): string[] {
  const all = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && ids.includes(n.props.testID) && typeof n.type === 'string');
  return [...new Set(all.map(n => n.props.testID as string))];
}

const PLACEHOLDER = appCopy.photo_placeholder;
const ORDER = ['review-date', 'photo-polaroid', 'review-caption', 'ai-notice', 'review-choice-label', 'sign', 'review-other', 'review-word'];

test('P3 Dock "오늘 코스 다시 보기" → 오늘 한 장: 위에서 아래로 날짜 → 사진 → 이름·AI 고지 → 팻말 + 다른 하나 → 오늘 낱말', async () => {
  await review();
  expect(order(ORDER)).toEqual(ORDER);
  expect(screen.getByRole('link', {name: '오늘 코스로'})).toBeTruthy(); // 위 BackLink
  expect(within(screen.getByTestId('review-date')).getByText(kstDateLine())).toBeTruthy();
  expect(screen.getByText('마을 입구 나무')).toBeTruthy();
  expect(screen.getByTestId('ai-notice')).toHaveTextContent('AI가 만든 그림·실제 장소가 아니에요');
  expect(screen.getByText('더 좋아하는 계절은요? · 고르신 쪽')).toBeTruthy();
  expect(screen.getByText('다른 하나 · 가을')).toBeTruthy();
  expect(screen.getByText('오늘 낱말')).toBeTruthy();
  expect(screen.getByText('나무')).toBeTruthy();
  // D-1 '먼저 떠오른 것' 자리는 아직 없다
  expect(screen.queryByText(/먼저 떠오/)).toBeNull();
});

test('팻말은 화면에 1개(row 크기, 고르신 쪽), 읽기 "오늘 고르신 쪽, 봄" — 안 고른 쪽은 팻말이 아니라 흐린 보조 글자', async () => {
  await review();
  const signs = screen.getAllByTestId('sign');
  expect(signs).toHaveLength(1);
  expect(signs[0].props.accessibilityLabel).toBe('오늘 고르신 쪽, 봄');
  expect(within(signs[0]).getByText('봄', {includeHiddenElements: true})).toBeTruthy();
  const other = screen.getByText('다른 하나 · 가을');
  const st = StyleSheet.flatten(other.props.style);
  expect(st.color).toBe(roleText('sub', 'elder').style.color); // 흐림 = 보조 글자색(불투명도 아님)
  expect(st.opacity ?? 1).toBe(1);
  expect(other.props.maxFontSizeMultiplier).toBe(1.5); // 200%에서 팻말 글자(26×1.5)보다 커지지 않게
});

test('Dock 은 "읽어 주세요" 하나(돌아가기는 위 BackLink 만)', async () => {
  await review();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['읽어 주세요']);
  expect(screen.getAllByRole('link', {name: '오늘 코스로'})).toHaveLength(1);
  expect(screen.queryByRole('button', {name: '오늘 코스로'})).toBeNull();
});

test('기록·계측·다시 불러오기 0: 들어오기 → 사진 크게 보기·닫기 → 읽어 주세요 → BackLink 로 코스 홈까지(기준 = 다시 보기 누르기 전)', async () => {
  const {calls, beforeEntry} = await review();
  fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  await act(async () => fireEvent.press(screen.getByTestId('photo-polaroid')));
  expect(screen.getByTestId('zoom-modal').props.visible).toBe(true);
  await act(async () => fireEvent.press(screen.getByRole('button', {name: '닫기'})));
  await press('읽어 주세요');
  await act(async () => fireEvent.press(screen.getByRole('link', {name: '오늘 코스로'})));
  await waitFor(() => screen.getByTestId('date-line'));
  expect(calls()).toEqual(beforeEntry);
});

// 화면 읽기가 차례로 읽을 글(숨긴 가지는 빼고, accessible 이거나 글자 노드에 이름이 있으면 그 이름 하나로 — TalkBack 은 글자의 이름을 글 대신 읽는다)
function readOut(): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    const p = n.props ?? {};
    if (p.accessibilityElementsHidden === true || p.importantForAccessibility === 'no-hide-descendants' || p['aria-hidden'] === true) {
      return;
    }
    if (typeof n.type === 'string' && (p.accessible || (n.type as unknown) === 'Text') && typeof p.accessibilityLabel === 'string') {
      out.push(p.accessibilityLabel);
      return;
    }
    if ((n.type as unknown) === 'Text') {
      const text = (n.children as unknown[]).map(c => (typeof c === 'string' ? c : '')).join('');
      if (text) {
        out.push(text);
      }
      return;
    }
    for (const c of n.children) {
      if (typeof c !== 'string') {
        walk(c);
      }
    }
  };
  walk(screen.getByTestId('today-review'));
  return out;
}
const countIn = (lines: string[], re: RegExp) => lines.filter(l => re.test(l)).length;

test('화면 읽기 중복 없음(QA-1 L1): 사진 이름·AI 고지·고르신 쪽은 한 번씩, 가운뎃점은 읽기 이름에 없음', async () => {
  await review();
  for (const loaded of [false, true]) {
    if (loaded) {
      fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
    }
    const lines = readOut();
    expect(countIn(lines, /마을 입구 나무/)).toBe(1);
    expect(countIn(lines, /실제 장소가 아니에요/)).toBe(1); // AI 고지는 숨기지 않는다(리드 결정, P4 와 같음)
    expect(countIn(lines, /고르신 쪽/)).toBe(1);
    expect(lines).toContain('더 좋아하는 계절은요?'); // 질문 줄 읽기 = 질문만
    expect(lines).toContain('다른 하나, 가을');
    expect(lines.filter(l => l.includes(' · '))).toEqual([]);
  }
  expect(screen.getByText('다른 하나 · 가을')).toBeTruthy(); // 보이는 글은 그대로
  expect(screen.getByText('더 좋아하는 계절은요? · 고르신 쪽')).toBeTruthy();
});

test('사진 불러오기 실패(QA-1 L2): 실패 안내, 크게 보기 없음, AI 고지는 그대로, 나머지도 그대로', async () => {
  await review();
  fireEvent(screen.getByTestId('photo-image'), 'error');
  await waitFor(() => screen.getByText(appCopy.photo_load_failed));
  expect(screen.queryByTestId('photo-image')).toBeNull();
  expect(screen.getByTestId('photo-polaroid').props.accessibilityRole).toBeUndefined();
  expect(countIn(readOut(), /실제 장소가 아니에요/)).toBe(1);
  expect(countIn(readOut(), /마을 입구 나무/)).toBe(1);
  expect(screen.getByText('마을 입구 나무')).toBeTruthy();
  expect(screen.getAllByTestId('sign')).toHaveLength(1);
  expect(screen.getByText('나무')).toBeTruthy();
});

test("사진 준비 중(pending://, QA-1 L2): 준비 안내, 크게 보기 없음, AI 고지는 그대로", async () => {
  await review({realImage: false});
  expect(screen.queryByTestId('photo-image')).toBeNull();
  expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
  expect(screen.getByTestId('photo-polaroid').props.accessibilityRole).toBeUndefined();
  expect(countIn(readOut(), /실제 장소가 아니에요/)).toBe(1);
  expect(countIn(readOut(), /마을 입구 나무/)).toBe(1);
  expect(screen.getByText('나무')).toBeTruthy();
});

test('사진: 원본 비율 틀(가로 사진 312×251), 다 불러오면 눌러 크게 보기', async () => {
  await review();
  fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  const frame = StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style);
  expect({width: frame.width, height: frame.height}).toEqual({width: 312, height: 251});
  const photo = screen.getByTestId('photo-polaroid');
  expect(photo.props.accessibilityRole).toBe('button');
  await act(async () => fireEvent.press(photo));
  expect(screen.getByTestId('zoom-modal').props.visible).toBe(true);
});

test('저장된 답이 없는 날(동의 거부): 팻말·다른 하나 줄 없이 사진과 낱말만', async () => {
  await review({consented: false, answeredChoice: undefined});
  expect(screen.queryByTestId('sign')).toBeNull();
  expect(screen.queryByTestId('review-other')).toBeNull();
  expect(screen.queryByText(/고르신 쪽/)).toBeNull();
  expect(screen.getByText('나무')).toBeTruthy();
});

test('200%: 같은 순서로 세로 스크롤(사진을 줄이지 않음), Dock 은 그대로 읽어 주세요', async () => {
  mockFontScale = 2;
  await review();
  expect(order(ORDER)).toEqual(ORDER);
  expect(within(screen.getByTestId('screen-dock')).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['읽어 주세요']);
});

test('R-15(에뮬레이터 실측 S25급 200%): 팻말 묶음이 첫 화면 끝에 걸치면 묶음째 접힘 아래로(윗선만 보이지 않게), 사진은 밀지 않는다', async () => {
  mockFontScale = 2;
  await review();
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(`today-review:${id}`).props.style)?.marginTop;
  await act(async () => {
    lay('screen-body-area', 0, 624); // 접힘 = 624 − '더 있음' 띠 24 = 600
    lay('today-review', 0, 800);
    lay('today-review:date', 0, 40); // 0~40
    lay('today-review:photo', 0, 300); // 56~356
    lay('today-review:notice', 0, 80); // 372~452
    lay('today-review:choice', 0, 150); // 468~618 → 600 에 걸림
    lay('today-review:word', 0, 90);
  });
  expect(mt('choice')).toBe(16 + (600 - 468 + 1));
  expect(mt('photo')).toBe(16);
  expect(mt('word')).toBe(16);
});

test('100%(에뮬레이터 실측 360×640): 사진은 첫 화면에 사진 이름·AI 고지까지 들게 줄인다(고지가 접힘 아래로 밀려 사진과 떨어지지 않게, P4 photoFit 과 같은 계산)', async () => {
  await review();
  fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  await act(async () => {
    lay('screen-body-area', 0, 424); // 접힘 400
    lay('today-review', 0, 900);
    lay('today-review:date', 0, 40);
    lay('today-review:photo', 0, 251);
    lay('today-review:notice', 0, 80);
    lay('today-review:choice', 0, 150);
    lay('today-review:word', 0, 90);
  });
  // 사진 위 끝 = 40 + 16 = 56, 높이 = 400 − 56 − 16 − (80 + 16) − 여유 2 = 230
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(230);
});

test('200%는 사진을 줄이지 않는다(같은 측정에서도 원본 비율 높이 251 그대로, 스크롤로 닿음 — QA-1 재확인 L1)', async () => {
  mockFontScale = 2;
  await review();
  fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  await act(async () => {
    lay('screen-body-area', 0, 424);
    lay('today-review', 0, 900);
    lay('today-review:date', 0, 40);
    lay('today-review:photo', 0, 251);
    lay('today-review:notice', 0, 80);
    lay('today-review:choice', 0, 150);
    lay('today-review:word', 0, 90);
  });
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(251);
});

test('읽어 주기 안내가 없으면 낱말 아래 빈 칸(간격 16)을 두지 않는다 — 안내 칸은 안내가 있을 때만(QA-1 재확인 L2)', async () => {
  await review();
  expect(screen.queryByTestId('today-review:read-notice')).toBeNull();
  const ids = (screen.getByTestId('today-review').children as unknown as {props: {testID?: string}}[]).map(c => c.props.testID);
  expect(ids[ids.length - 1]).toBe('today-review:word');
});
