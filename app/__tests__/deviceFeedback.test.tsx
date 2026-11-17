import React from 'react';
import {BackHandler, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import * as SafeArea from 'react-native-safe-area-context';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {CodeInput} from '../src/ui/CodeInput';
import {press, toHomeConsented} from '../testUtils/flow';

afterEach(() => jest.restoreAllMocks());

function captureBack() {
  const handlers: (() => boolean | null | undefined)[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, h: () => boolean) => {
    handlers.push(h);
    return {remove: () => handlers.splice(handlers.indexOf(h), 1)};
  }) as never);
  return async () => {
    await act(async () => {
      // 마지막에 등록된(가장 위 화면) 처리기부터 true 를 돌려줄 때까지
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i]()) {
          break;
        }
      }
    });
  };
}

async function toEmail() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이메일로 시작해요'));
}

async function toOtp() {
  await toEmail();
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
}

test('하단 고정 영역은 안드로이드 내비게이션 바(하단 inset) 위에 놓인다', async () => {
  (SafeArea.useSafeAreaInsets as jest.Mock).mockReturnValue({top: 24, bottom: 48, left: 0, right: 0});
  await toOtp();
  const dock = screen.getByTestId('screen-dock');
  const pad = StyleSheet.flatten(
    (dock.children[0] as unknown as {props: {contentContainerStyle: unknown}}).props.contentContainerStyle as never,
  );
  expect((pad as {paddingBottom: number}).paddingBottom).toBeGreaterThanOrEqual(48);
});

test('인증번호 화면: 자동 확인이라 확인 버튼 없이 다시 받기·다른 이메일이 하단 고정 영역에', async () => {
  await toOtp();
  const dock = within(screen.getByTestId('screen-dock'));
  expect(screen.queryByRole('button', {name: '확인하기'})).toBeNull();
  expect(dock.getByRole('button', {name: '인증번호 다시 받기'})).toBeTruthy();
  expect(dock.getByRole('button', {name: '다른 이메일 쓰기'})).toBeTruthy();
});

test('인증번호는 기본 숫자 키보드(일회용 번호 자동 채우기), 큰 키패드는 없다', async () => {
  await toOtp();
  const input = screen.getByLabelText('인증번호 6자리');
  expect(input.props.keyboardType).toBe('number-pad');
  expect(input.props.textContentType).toBe('oneTimeCode');
  expect(input.props.maxLength).toBe(6);
  expect(screen.queryByLabelText('숫자 1')).toBeNull();
  fireEvent.changeText(input, '24a6810'); // 숫자만 남겨 6자리 -> 자동 확인
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
});

test('어르신 번호 입력은 큰 키패드를 유지한다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByLabelText('숫자 1'));
});

test('번호 칸: 지금 쓸 칸이 강조되고, 키는 볼록(흰 면+테두리)으로 칸(오목)과 다른 모양', () => {
  render(<CodeInput value="12" onDigit={() => {}} onDelete={() => {}} onClear={() => {}} />);
  const cell = (i: number) => StyleSheet.flatten(screen.getByTestId(`code-cell-${i}`).props.style);
  expect(cell(2).borderWidth).toBeGreaterThan(cell(3).borderWidth ?? 0);
  expect(cell(2).borderColor).not.toBe(cell(3).borderColor);
  const key = screen.getByLabelText('숫자 1');
  const ks = StyleSheet.flatten(typeof key.props.style === 'function' ? key.props.style({pressed: false}) : key.props.style);
  expect(ks.borderWidth).toBe(3); // DECISIONS: 키는 흰 면+테두리+그림자
  expect(ks.backgroundColor).not.toBe(cell(3).backgroundColor);
});

test('이전 바: 64 이상, 라벨 "이전 화면으로", 첫 화면에는 없다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  expect(screen.queryByLabelText('이전 화면으로 가기')).toBeNull();
  await press(/자녀 휴대폰이에요/);
  const back = await waitFor(() => screen.getByLabelText('이전 화면으로 가기'));
  expect(StyleSheet.flatten(back.props.style).minHeight).toBeGreaterThanOrEqual(64);
  await act(async () => fireEvent.press(back));
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('하드웨어 뒤로가기도 이전 바와 같다(자녀 이메일 -> 역할 선택)', async () => {
  const back = captureBack();
  await toEmail();
  await back();
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('인증번호 단계의 이전은 이메일 단계로', async () => {
  await toOtp();
  await act(async () => fireEvent.press(screen.getByLabelText('이전 화면으로 가기')));
  await waitFor(() => screen.getByText('이메일로 시작해요'));
});

test('코스 진행 중 이전은 확인 없이 코스 홈으로', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await press('이어서 하기');
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await act(async () => fireEvent.press(screen.getByLabelText('오늘 코스로 돌아가기')));
  await waitFor(() => screen.getByText('오늘의 코스'));
  expect(screen.queryByRole('button', {name: '다 봤어요'})).toBeNull();
});

test('어르신 번호 화면의 이전은 역할 선택으로, 설정의 이전은 코스 홈으로', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await act(async () => fireEvent.press(await waitFor(() => screen.getByLabelText('이전 화면으로 가기'))));
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});

test('설정의 이전은 코스 홈으로', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await press('설정');
  await act(async () => fireEvent.press(await waitFor(() => screen.getByLabelText('이전 화면으로 가기'))));
  await waitFor(() => screen.getByText('오늘의 코스'));
});
