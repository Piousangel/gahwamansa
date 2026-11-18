// P2 동의 화면 다듬기(디자인 판정: 넷째 줄로 늘어 넘침 대응, 시안 P2_consent):
// - 네 줄은 흰 카드 안 체크 행(간격 8, 체크 32 는 첫 줄에 맞춤), 오류 상자는 본문이 아니라 하단 버튼 바로 위.
// - 150% 이상이면 본문은 스크롤 영역, 버튼은 하단 고정(끝까지 안 읽어도 누를 수 있음), 넘치면 아래 흐림.
// - 읽기 순서(R15): 넷째 줄 → (오류) → 좋아요.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError} from '../src/features/types';
import {enterCode, press} from '../testUtils/flow';

const FOURTH = '싫어요를 누르면 가족은 답을 보여 주지 않는 중인 것만 알아요'; // consent.decline_note(copy 11-19)

async function toConsent(api = createFakeApi()) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  return api;
}

// 트리 순서(= 화면 읽기 순서)로 글자·버튼 이름을 모은다
function order(): string[] {
  const out: string[] = [];
  const walk = (n: {type?: unknown; props?: Record<string, unknown>; children?: unknown[]}) => {
    if (n.props?.accessibilityRole === 'button' && typeof n.props.accessibilityLabel === 'string') {
      out.push(`[${n.props.accessibilityLabel}]`);
    }
    (n.children ?? []).forEach(ch => (typeof ch === 'string' ? out.push(ch) : ch && typeof ch === 'object' ? walk(ch as never) : null));
  };
  walk(screen.root as never);
  return out.filter((x, i) => x !== out[i - 1]);
}

test('체크 카드 3줄(행 간격 8, 체크 32 는 첫 줄 정렬) + 카드 밖 ⓘ 한 줄(싫어요 안내, 디자인 판정 M2 ②)', async () => {
  await toConsent();
  const card = screen.getByTestId('consent-points');
  expect(StyleSheet.flatten(card.props.style).gap).toBe(8);
  const rows = within(card).getAllByTestId('consent-point');
  expect(rows).toHaveLength(3);
  for (const r of rows) {
    expect(StyleSheet.flatten(r.props.style).alignItems).toBe('flex-start');
    expect(within(r).getByTestId('icon-check', {includeHiddenElements: true}).props.width).toBe(32);
  }
  expect(within(screen.getByTestId('consent-info')).getByText(FOURTH)).toBeTruthy();
  expect(within(card).queryByText(FOURTH)).toBeNull();
});

test('동의 실패: 오류 상자는 하단 버튼 바로 위(본문 밖), 읽기 순서는 넷째 줄 → 오류 → 좋아요', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'giveConsent').mockRejectedValueOnce(new OfflineError('x'));
  await toConsent(api);
  await press('좋아요');
  const box = await waitFor(() => screen.getByTestId('consent-error'));
  expect(within(screen.getByTestId('screen-body')).queryByTestId('consent-error')).toBeNull();
  const seq = order();
  const iFourth = seq.indexOf(FOURTH);
  const errTitle = within(box).getAllByText(/./)[0].props.children as string;
  const iErr = seq.indexOf(errTitle);
  const iYes = seq.indexOf('[좋아요]');
  expect(iFourth).toBeGreaterThan(-1);
  expect(iFourth).toBeLessThan(iYes);
  expect(iErr).toBeGreaterThan(iFourth);
  expect(iErr).toBeLessThan(iYes);
});

test('본문은 스크롤 영역(넘치면 아래 흐림), 끝까지 안 읽어도 좋아요를 누를 수 있다', async () => {
  const api = createFakeApi();
  const give = jest.spyOn(api, 'giveConsent');
  await toConsent(api);
  const body = screen.getByTestId('screen-body');
  expect(within(body).getByText(FOURTH)).toBeTruthy();
  expect(within(body).queryByRole('button', {name: '좋아요'})).toBeNull(); // 버튼은 하단 고정
  await act(async () => {
    fireEvent(body, 'layout', {nativeEvent: {layout: {width: 390, height: 300}}});
    fireEvent(body, 'contentSizeChange', 390, 900);
  });
  expect(screen.getByTestId('screen-more', {includeHiddenElements: true})).toBeTruthy();
  await press('좋아요');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(give).toHaveBeenCalledTimes(1);
});
