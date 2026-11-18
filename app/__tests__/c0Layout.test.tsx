// 실기기 S25(1080×2340, 411×891dp, 글자 1.0) 버그 11-19: C0 카카오 버튼이 얇은 노란 띠로 잘림.
// 원인: 하단 고정 내용이 기본 상한(화면 40% = 356dp)을 넘어 하단 고정 안에서 스크롤 → 맨 위 카카오 버튼이 잘려 보임(본문은 비어 있음).
// 고침: C0 하단 고정 상한 45%(GUIDELINES.md 자녀 로그인), 버튼은 최소 높이만(내용에 따라 늘어남).
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {SOCIAL_BUTTON_HEIGHT} from '../src/features/child/SocialButton';
import {C0_DOCK_RATIO} from '../src/features/child/ChildLogin';
import {lineHeightFor} from '../src/ui/tokens';
import {press} from '../testUtils/flow';

afterEach(() => {
  jest.restoreAllMocks();
});

async function openC0(w: number, h: number, fontScale = 1) {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: w, height: h, scale: 2.625, fontScale});
  render(<AppRoot api={createFakeApi()} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByTestId('legal-child'));
}

test('S25 411×891 글자 1.0: 하단 고정 상한이 카카오·구글·약관·연령·이메일을 다 담는다(안에서 스크롤해 버튼이 잘리지 않음)', async () => {
  await openC0(411, 891);
  const dock = screen.getByTestId('screen-dock');
  const maxH = StyleSheet.flatten(dock.props.style).maxHeight as number;
  expect(maxH).toBe(Math.floor(891 * C0_DOCK_RATIO));
  // 하단 고정 내용 어림(3버튼 내비 아래 inset 48 — 가장 큰 경우): 위 6 + 소셜 버튼 2개(최소 높이 + 위아래 6) + 약관 두 줄 + 연령 한 줄(각 위아래 4) + 이메일 링크 48 + 아래 max(28, 16+48)
  const legalLine = lineHeightFor(20);
  const content = 6 + 2 * (SOCIAL_BUTTON_HEIGHT + 12) + (2 * legalLine + 8) + (legalLine + 8) + 48 + Math.max(28, 16 + 48);
  expect(content).toBeGreaterThan(Math.floor(891 * 0.4)); // 옛 상한 40% 로는 넘쳤다(버그 재현 조건)
  expect(content).toBeLessThanOrEqual(maxH);
  // 두 버튼 모두 하단 고정 안, 순서는 카카오 → 구글
  const buttons = within(dock).getAllByRole('button');
  expect(buttons[0].props.accessibilityLabel).toMatch(/카카오/);
  expect(buttons[1].props.accessibilityLabel).toMatch(/Google/);
});

test('소셜 버튼은 최소 높이만(고정 높이 없음), 카카오·구글 같은 최소 높이(GUIDELINES: 같은 높이·같은 폭)', async () => {
  await openC0(411, 891);
  const dock = within(screen.getByTestId('screen-dock'));
  const [kakao, google] = dock.getAllByRole('button');
  const st = (n: typeof kakao) => StyleSheet.flatten(typeof n.props.style === 'function' ? n.props.style({pressed: false}) : n.props.style);
  for (const b of [kakao, google]) {
    expect(st(b).minHeight).toBe(SOCIAL_BUTTON_HEIGHT);
    expect(st(b).height).toBeUndefined();
    expect(st(b).flexShrink ?? 0).toBe(0); // 줄어들지 않는다
    expect(st(b).alignSelf).toBe('stretch');
  }
  expect(st(kakao).backgroundColor).toBe('#FEE500'); // 카카오 컨테이너 색 규정
  expect(st(kakao).borderRadius).toBe(12);
});
