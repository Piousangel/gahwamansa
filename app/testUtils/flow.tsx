import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import type {Api} from '../src/features/types';

// 비동기 API 후 화면 이동까지 act 안에서 끝내기 위한 헬퍼
export async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name}));
  });
}

export async function enterCode(code: string) {
  for (const d of code) {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
  await press('다음');
}

export async function toHome(api: Api, accept = true) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답이 자녀분께 보여요'));
  await press(accept ? '좋아요' : '싫어요');
  if (!accept) {
    await waitFor(() => screen.getByText('대신 고른 답은 저장되지 않아요'));
    await press('알겠어요');
  }
  await waitFor(() => screen.getByText('오늘의 코스'));
}
