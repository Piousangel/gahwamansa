// P2 동의 v4(시안 P6_P7_N1_P2_ds4b P2 + 전문가 리뷰 N-12·7:42):
// - 100%: 카드 안 세 줄은 ✓ 대신 점 머리표(V4), 거절 안내는 카드 밖, 두 버튼은 Dock.
// - 150% 이상: 점 칸을 빼 전폭, 두 버튼은 본문 끝(다 읽은 뒤에 닿음), 거절 안내는 '싫어요' 바로 아래.
// - 두 버튼은 같은 높이(주·보조는 색으로만). 문구는 그대로(CONSENT_VERSION·법률 확인 전 버튼 문구).
// - 읽기 순서(R15): 넷째 줄(거절 안내) → (오류) → 좋아요 (100%), 세 줄 → 좋아요 → 싫어요 → 거절 안내 (150% 이상).
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError} from '../src/features/types';
import {copy} from '../src/copy/copy';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {enterCode, press} from '../testUtils/flow';

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

test('100%: 카드 안 세 줄은 점 머리표(체크 아님), 거절 안내는 카드 밖, 두 버튼은 Dock·같은 높이', async () => {
  await toConsent();
  const card = screen.getByTestId('consent-points');
  const rows = within(card).getAllByTestId('consent-point');
  expect(rows).toHaveLength(3);
  expect(within(card).getAllByTestId('consent-dot', H)).toHaveLength(3);
  expect(within(card).queryByTestId('icon-check', H)).toBeNull();
  expect(within(card).queryByText(NOTE)).toBeNull();
  expect(screen.getByTestId('consent-decline-note')).toBeTruthy();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getByRole('button', {name: copy.consent.accept})).toBeTruthy();
  expect(within(dock).getByRole('button', {name: copy.consent.decline})).toBeTruthy();
  expect(minHeightOf(copy.consent.decline)).toBe(minHeightOf(copy.consent.accept));
  expect(minHeightOf(copy.consent.accept)).toBe(t.touch.elder.primary);
});

test('200%(N-12): 점 칸 없이 전폭, 버튼은 본문 끝(세 줄 → 좋아요 → 싫어요 → 거절 안내), 같은 높이', async () => {
  mockDims = {width: 320, height: 640, scale: 3, fontScale: 2};
  await toConsent();
  expect(screen.queryAllByTestId('consent-dot', H)).toHaveLength(0);
  expect(screen.getAllByTestId('consent-point')).toHaveLength(3);
  expect(screen.queryByTestId('screen-dock')).toBeNull();
  const body = screen.getByTestId('screen-body');
  expect(within(body).getByRole('button', {name: copy.consent.accept})).toBeTruthy();
  const seq = order();
  const iLast = seq.indexOf(copy.consent.body[2]);
  const iYes = seq.indexOf(`[${copy.consent.accept}]`);
  const iNo = seq.indexOf(`[${copy.consent.decline}]`);
  const iNote = seq.indexOf(NOTE);
  expect(iLast).toBeGreaterThan(-1);
  expect(iLast).toBeLessThan(iYes);
  expect(iYes).toBeLessThan(iNo);
  expect(iNo).toBeLessThan(iNote);
  expect(minHeightOf(copy.consent.decline)).toBe(minHeightOf(copy.consent.accept));
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
