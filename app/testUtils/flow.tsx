import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import type {Api} from '../src/features/types';

// 비동기 API 후 화면 이동까지 act 안에서 끝내기 위한 헬퍼
export async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name}));
  });
}

// 코스 홈의 주 버튼(지금 단계 이름: 사진 보기 / 둘 중 고르기 / 글씨 쓰기, 시안 P3 copy 10절)을 누른다
export async function pressCourseNext() {
  await act(async () => {
    fireEvent.press(within(screen.getByTestId('screen-dock')).getByTestId('big-button').findByProps({accessibilityRole: 'button'}));
  });
}

// P1: 6자리를 쓰면 300ms 뒤 저절로 확인("다음" 없음). 맞는 번호면 P1c 확인 화면이 뜨고,
// confirm=true(기본)면 [이 번호로 연결하기]까지 누른다. 틀린 번호면 확인 화면이 없으니 그대로 돌아온다.
export async function typeCode(code: string) {
  for (const d of code) {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
  // 자동 확인 300ms 를 지나게 한다(가짜 타이머를 쓰는 테스트면 시계를 돌리고, 아니면 실제로 기다린다)
  const fake = typeof (setTimeout as unknown as {clock?: unknown}).clock === 'object';
  await act(async () => {
    if (fake) {
      jest.advanceTimersByTime(350);
    } else {
      await new Promise<void>(r => setTimeout(() => r(), 350));
    }
  });
}

export async function enterCode(code: string, confirm = true) {
  await typeCode(code);
  const yes = screen.queryByRole('button', {name: '이 번호로 연결하기'});
  if (confirm && yes) {
    await press('이 번호로 연결하기');
  }
}

export async function toHome(api: Api, accept = true) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press(accept ? '좋아요' : '싫어요');
  if (!accept) {
    await waitFor(() => screen.getByText('고른 답은 가족에게 안 보여요'));
    await press('알겠어요');
  }
  await waitFor(() => screen.getByText('오늘의 코스'));
}

// 서버가 이미 동의한 상태: 동의 화면을 건너뛰고 코스 홈으로 간다.
export async function toHomeConsented(api: Api) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('오늘의 코스'));
}
