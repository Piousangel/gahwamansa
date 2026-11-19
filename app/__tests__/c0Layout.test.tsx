// 실기기 S25(1080×2340, 411×891dp, 글자 1.0) 버그 11-19: C0 카카오 버튼이 얇은 노란 띠로 잘림.
// 원인: 하단 고정에 카카오·구글·약관 두 줄·연령·이메일까지 두어(≈ 368dp) 상한 40%(356dp)를 넘어 하단 고정 안에서 스크롤 → 맨 위 카카오가 잘림.
// 고침(리드 결정 v4 Q1): 하단 고정은 타사 로그인 버튼 둘만, 약관·연령·이메일은 본문 끝. 상한 40% 그대로.
// 한계: jest 에는 레이아웃 엔진이 없어 아래 '하단 고정 높이'는 컴포넌트 최소 높이로 계산한 값이다. 최종 근거는 에뮬레이터 캡처(e2e/audit/c0-fit.yaml).
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {SOCIAL_BUTTON_HEIGHT} from '../src/features/child/SocialButton';
import {layout} from '../src/ui/tokens';
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

for (const [name, w, h] of [
  ['S25 411×891', 411, 891],
  ['360×640', 360, 640],
] as const) {
  test(`${name} 글자 1.0: 하단 고정에는 카카오·구글 두 버튼만, 약관·연령·이메일은 본문 끝`, async () => {
    await openC0(w, h);
    const dock = screen.getByTestId('screen-dock');
    const inDock = within(dock);
    const buttons = inDock.getAllByRole('button');
    expect(buttons.map(b => b.props.accessibilityLabel)).toEqual([expect.stringMatching(/카카오/), expect.stringMatching(/Google/)]);
    expect(inDock.queryByTestId('legal-child')).toBeNull();
    expect(inDock.queryByTestId('age-notice')).toBeNull();
    expect(inDock.queryByRole('button', {name: '이메일로 시작하기'})).toBeNull();
    const body = within(screen.getByTestId('screen-body'));
    expect(body.getByTestId('legal-child')).toBeTruthy();
    expect(body.getByTestId('age-notice')).toBeTruthy();
    expect(body.getByRole('button', {name: '이메일로 시작하기'})).toBeTruthy();
    // 상한은 기본 40% 그대로. 두 버튼(+ 위 6·아래 최대 max(28, 16+48))이 들어간다 — iOS Apple 버튼이 더해져도 72 × 3
    const maxH = StyleSheet.flatten(dock.props.style).maxHeight as number;
    expect(maxH).toBe(Math.floor(h * layout.dock.maxHeightRatio));
    const two = 6 + 2 * (SOCIAL_BUTTON_HEIGHT + 12) + Math.max(28, 16 + 48);
    expect(two).toBeLessThanOrEqual(maxH);
    if (h >= 740) {
      // iPhone 에서 Apple 버튼까지 셋이어도 들어간다. 640 높이 + 3버튼 내비에서는 286 > 256 이라 Apple 추가 때(B2) 작은 화면 규칙(GUIDELINES: 하단 고정 해제) 필요
      expect(two + (SOCIAL_BUTTON_HEIGHT + 12)).toBeLessThanOrEqual(maxH);
    }
  });
}

test('소셜 버튼은 최소 높이만(고정 높이 없음), 카카오·구글 같은 최소 높이(GUIDELINES: 같은 높이·같은 폭)', async () => {
  await openC0(411, 891);
  const [kakao, google] = within(screen.getByTestId('screen-dock')).getAllByRole('button');
  const st = (n: typeof kakao) => StyleSheet.flatten(typeof n.props.style === 'function' ? n.props.style({pressed: false}) : n.props.style);
  for (const b of [kakao, google]) {
    expect(st(b).minHeight).toBe(SOCIAL_BUTTON_HEIGHT);
    expect(st(b).height).toBeUndefined();
    expect(st(b).flexShrink ?? 0).toBe(0);
    expect(st(b).alignSelf).toBe('stretch');
  }
  expect(st(kakao).backgroundColor).toBe('#FEE500'); // 카카오 컨테이너 색 규정
  expect(st(kakao).borderRadius).toBe(12);
});
