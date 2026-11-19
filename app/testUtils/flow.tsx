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
// 같은 이름 버튼이 여럿일 때 마지막 것(예: 설정 동사 버튼과 펼친 확인 안의 실행 버튼, 디자인 W0 ②)
export async function pressLast(name: string | RegExp) {
  await act(async () => {
    const all = screen.getAllByRole('button', {name});
    fireEvent.press(all[all.length - 1]);
  });
}

// v4 단계 화면(P4·P5) 위 BackLink '오늘 코스로'(보이는 글 = 읽기, R-14, role link)
export async function pressBackLink(name: string | RegExp = '오늘 코스로') {
  await act(async () => {
    fireEvent.press(screen.getByRole('link', {name}));
  });
}

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

// confirm=false: 맞지 않는 번호·실패 패널을 보려는 테스트(확인 화면을 기대하지 않음)
export async function enterCode(code: string, confirm = true) {
  await typeCode(code);
  if (!confirm) {
    return;
  }
  const yes = screen.queryByRole('button', {name: '이 번호로 연결하기'});
  if (!yes) {
    throw new Error(`enterCode(${code}): 확인 화면(이 번호로 연결하기)이 없어요. 실패를 보려면 enterCode(code, false)`);
  }
  await press('이 번호로 연결하기');
}

export async function toHome(api: Api, accept = true) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press(accept ? '좋아요' : '싫어요');
  if (!accept) {
    await waitFor(() => screen.getByText('고른 답은 저장되지 않아요'));
    await press('오늘 코스로');
  }
  await waitFor(courseHomeShown);
}

// 서버가 이미 동의한 상태: 동의 화면을 건너뛰고 코스 홈으로 간다.
export async function toHomeConsented(api: Api) {
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(courseHomeShown);
}

// 코스 홈이 보이는지: 코스가 있으면 날짜 줄(시안 P3 v4, 제목 없음), 빈·오류 상태면 '오늘 코스' 제목
export function courseHomeShown() {
  if (!screen.queryByTestId('date-line')) {
    screen.getByText('오늘 코스');
  }
}

// P9 2단계(감사 H1, DECISIONS 153): P9 화면의 '모두 지우기' → 확인 상자 '정말 모두 지울까요?'의 '모두 지우기'
export async function confirmDeleteAll() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '모두 지우기'}));
  });
  const box = await waitFor(() => screen.getByTestId('delete-confirm2'));
  await act(async () => {
    fireEvent.press(within(box).getByRole('button', {name: '모두 지우기'}));
  });
}
