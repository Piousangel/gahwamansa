// P2 동의 v4(시안 P6_P7_N1_P2_ds4b P2 + 전문가 리뷰 N-12·7:42 + #175 리뷰 법률 M1·L, AI 티 M1·M2):
// - 카드 안 줄들(v6 다섯 줄)은 ✓ 대신 점 머리표(V4), 150% 이상은 점 칸 없이 전폭. 안내 두 줄(안심·거절)은 카드 밖, 기본 글자색.
// - 두 버튼은 본문이 Dock 위 창에 들어가면 Dock, 넘치면 본문 끝(실측). 같은 높이·글자.
// - 읽기 순서: 다섯 줄 → 안심 줄 → 거절 안내 → (오류) → 좋아요 → 싫어요. P2 v6(11-26) 문구, 버튼 문구는 법률 확인 전이라 그대로.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError} from '../src/features/types';
import {copy} from '../src/copy/copy';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {enterCode, press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

let mockDims = {width: 411, height: 914, scale: 3, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
beforeEach(() => {
  mockDims = {width: 411, height: 914, scale: 3, fontScale: 1};
});

const NOTE = copy.consent.decline_note;
const H = {includeHiddenElements: true};

async function toConsent(api = createFakeApi()) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText(copy.consent.title));
  return api;
}

// 트리 순서(= 화면 읽기 순서)로 글자 라벨·버튼 이름을 모은다
function order(): string[] {
  const out: string[] = [];
  const walk = (n: {props?: Record<string, unknown>; children?: unknown[]}) => {
    const p = n.props ?? {};
    if (p.accessibilityRole === 'button' && typeof p.accessibilityLabel === 'string') {
      out.push(`[${p.accessibilityLabel}]`);
    }
    (n.children ?? []).forEach(ch => (typeof ch === 'string' ? out.push(ch) : ch && typeof ch === 'object' ? walk(ch as never) : null));
  };
  walk(screen.root as never);
  return out.filter((x, i) => x !== out[i - 1]);
}

const minHeightOf = (name: string) => {
  const b = screen.getByRole('button', {name});
  const st = b.props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight;
};

test('100%: 카드 안 다섯 줄(v6)은 점 머리표(체크 아님), 거절 안내는 카드 밖, 두 버튼은 Dock·같은 높이', async () => {
  await toConsent();
  const card = screen.getByTestId('consent-points');
  const rows = within(card).getAllByTestId('consent-point');
  expect(rows).toHaveLength(5); // P2 v6 다섯 줄
  expect(within(card).getAllByTestId('consent-dot', H)).toHaveLength(5);
  expect(within(card).queryByTestId('icon-check', H)).toBeNull();
  expect(within(card).queryByText(NOTE)).toBeNull();
  expect(screen.getByTestId('consent-decline-note')).toBeTruthy();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getByRole('button', {name: copy.consent.accept})).toBeTruthy();
  expect(within(dock).getByRole('button', {name: copy.consent.decline})).toBeTruthy();
  expect(minHeightOf(copy.consent.decline)).toBe(minHeightOf(copy.consent.accept));
  expect(minHeightOf(copy.consent.accept)).toBe(t.touch.elder.primary);
});

// 실측으로 넘침을 만든다: 본문 창(Dock 위) 300, 본문 묶음 900
async function overflow() {
  await act(async () => {
    fireEvent(screen.getByTestId('screen-body-area'), 'layout', {nativeEvent: {layout: {width: 320, height: 300}}});
    fireEvent(screen.getByTestId('consent-content'), 'layout', {nativeEvent: {layout: {width: 320, height: 900}}});
  });
}

const fontSizeOf = (name: string) => {
  const label = within(screen.getByRole('button', {name})).getByText(name);
  return StyleSheet.flatten(label.props.style).fontSize;
};

test('두 버튼은 같은 높이·같은 글자 크기(even) — 주·보조는 색·모양으로만(#175 리뷰 M1)', async () => {
  await toConsent();
  expect(minHeightOf(copy.consent.decline)).toBe(minHeightOf(copy.consent.accept));
  expect(fontSizeOf(copy.consent.decline)).toBe(fontSizeOf(copy.consent.accept));
});

test('본문이 Dock 위 창에 다 들어가면 Dock 그대로(글자 배율이 아니라 실측, #175 리뷰 M2)', async () => {
  mockDims = {width: 320, height: 640, scale: 3, fontScale: 2};
  await toConsent();
  await act(async () => {
    fireEvent(screen.getByTestId('screen-body-area'), 'layout', {nativeEvent: {layout: {width: 320, height: 900}}});
    fireEvent(screen.getByTestId('consent-content'), 'layout', {nativeEvent: {layout: {width: 320, height: 400}}});
  });
  expect(screen.getByTestId('screen-dock')).toBeTruthy();
});

test('넘치면(N-12) 버튼은 본문 끝 — 순서는 다섯 줄 → 안심 줄 → 거절 안내 → 좋아요 → 싫어요(법률 #175 M1), 200%는 점 칸 없이 전폭', async () => {
  mockDims = {width: 320, height: 640, scale: 3, fontScale: 2};
  await toConsent();
  expect(screen.queryAllByTestId('consent-dot', H)).toHaveLength(0);
  expect(screen.getAllByTestId('consent-point')).toHaveLength(5); // P2 v6 다섯 줄
  await overflow();
  await waitFor(() => expect(screen.queryByTestId('screen-dock')).toBeNull());
  const body = screen.getByTestId('screen-body');
  expect(within(body).getByRole('button', {name: copy.consent.accept})).toBeTruthy();
  const seq = order();
  const iLast = seq.indexOf(copy.consent.body[copy.consent.body.length - 1]);
  const iReassure = seq.indexOf(copy.consent.reassure);
  const iNote = seq.indexOf(NOTE);
  const iYes = seq.indexOf(`[${copy.consent.accept}]`);
  const iNo = seq.indexOf(`[${copy.consent.decline}]`);
  expect(iLast).toBeGreaterThan(-1);
  expect(iLast).toBeLessThan(iReassure);
  expect(iReassure).toBeLessThan(iNote);
  expect(iNote).toBeLessThan(iYes);
  expect(iYes).toBeLessThan(iNo);
  expect(minHeightOf(copy.consent.decline)).toBe(minHeightOf(copy.consent.accept));
  expect(fontSizeOf(copy.consent.decline)).toBe(fontSizeOf(copy.consent.accept));
});

test('본문은 스크롤된다 — 넘쳐 버튼이 본문 끝으로 가도 닿는다(에뮬레이터 320×640 200% 재현: intro 틀은 스크롤을 막아 버튼에 닿지 못했다)', async () => {
  mockDims = {width: 320, height: 640, scale: 3, fontScale: 2};
  await toConsent();
  await overflow();
  await waitFor(() => expect(screen.queryByTestId('screen-dock')).toBeNull());
  expect(screen.getByTestId('screen-body').props.scrollEnabled).not.toBe(false);
  await press(copy.consent.decline);
  await waitFor(() => screen.getByText(copy.consent.declined_notice));
  expect(screen.getByTestId('screen-body').props.scrollEnabled).not.toBe(false);
});

test('안내 두 줄은 기본 글자색(muted 아님 — 어르신 7:1, 법률 L)', async () => {
  await toConsent();
  const ink = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).color;
  expect(ink('consent-decline-note')).toBe(t.color.inkBody);
  expect(ink('consent-reassure')).toBe(t.color.inkBody);
});

test('동의 실패: 오류 띠는 좋아요 앞(읽기 순서 거절 안내 → 오류 → 좋아요), 다시 누를 수 있다', async () => {
  const api = createFakeApi();
  const give = jest.spyOn(api, 'giveConsent').mockRejectedValueOnce(new OfflineError('x'));
  await toConsent(api);
  await press(copy.consent.accept);
  await waitFor(() => screen.getByTestId('consent-error'));
  const seq = order();
  const iNote = seq.indexOf(NOTE);
  const iErr = seq.findIndex(x => x.includes(copy.errors.offline.title));
  const iYes = seq.indexOf(`[${copy.consent.accept}]`);
  expect(iNote).toBeLessThan(iErr);
  expect(iErr).toBeLessThan(iYes);
  await press(copy.consent.accept);
  await waitFor(() => screen.getByTestId('date-line'));
  expect(give).toHaveBeenCalledTimes(2);
});

test('싫어요: 거부 안내 화면 → 오늘 코스로', async () => {
  await toConsent();
  await press(copy.consent.decline);
  await waitFor(() => screen.getByText(copy.consent.declined_notice));
  await press(copy.consent.declined_button);
  await waitFor(() => screen.getByTestId('date-line'));
});
