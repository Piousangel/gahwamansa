// 재확인 6 L23·L27: P1 약관 링크 — 연결 확인 중 진행 한 줄, 오프라인 Banner 는 하단 고정이 아니라 본문(하단 고정을 키우지 않음)
import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

jest.mock('../src/shared/legalLinks', () => {
  const actual = jest.requireActual('../src/shared/legalLinks');
  return {...actual, useLegalOpen: () => ({open: () => {}, offline: true, busy: true})};
});

test('0단계(411×914 100%): 오프라인 Banner·확인 중 한 줄은 본문(하단 고정 아님)', async () => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 411, height: 914, scale: 2.6, fontScale: 1});
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByTestId('legal-offline'));
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).queryByTestId('legal-offline')).toBeNull();
  expect(within(screen.getByTestId('screen-body')).getByTestId('legal-offline')).toBeTruthy();
  expect(within(dock).queryByTestId('legal-busy')).toBeNull(); // 확인 중 줄도 본문(하단 고정을 키우지 않음)
  expect(within(screen.getByTestId('screen-body')).getByTestId('legal-busy')).toBeTruthy();
});
