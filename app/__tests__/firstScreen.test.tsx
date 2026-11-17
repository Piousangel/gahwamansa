import {finishFlight} from '../src/app/splash';
import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, toHomeConsented, pressCourseNext} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});

async function measure(w = 342, h = 360) {
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: w, height: h}}});
  });
}

beforeEach(() => finishFlight()); // 스플래시 심볼 이동은 끝난 상태로(이동은 splash.test)

test('첫 화면: 심볼·워드마크·소개·사진 묶음·질문·두 버튼(둘째 줄 포함), 해님 인사 없음', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure();
  expect(screen.getByTestId('brand-symbol', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByText('가화만사성')).toBeTruthy();
  expect(screen.getByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByLabelText('옛날 사진 앨범, AI가 만든 그림')).toBeTruthy();
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy();
  expect(screen.getByRole('button', {name: '부모님 휴대폰이에요. 가족에게 받은 번호를 써요'})).toBeTruthy();
  expect(screen.getByRole('button', {name: '자녀 휴대폰이에요. 부모님께 보낼 번호를 만들어요'})).toBeTruthy();
  expect(screen.getByText('가족에게 받은 번호를 써요')).toBeTruthy(); // 둘째 줄은 버튼 안
  expect(screen.queryByText('안녕하세요, 해님이에요')).toBeNull();
});

async function toOtp(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기'); // 소셜 버튼 화면에서 이메일 인증번호 경로로
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('6자리를 다 쓰면 바로 확인해요'));
}

test('인증번호 6자리를 채우면 자동 확인(한 번만)', async () => {
  const api = createFakeApi();
  const verify = jest.spyOn(api, 'verifyEmailCode');
  await toOtp(api);
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '24681');
  expect(verify).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '246810');
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '246810');
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  expect(verify).toHaveBeenCalledTimes(1);
});

test('자동 확인이 틀리면 칸을 비우고 오류', async () => {
  const api = createFakeApi();
  await toOtp(api);
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '000000');
  await waitFor(() => screen.getByText('인증번호가 맞지 않아요. 가장 최근 메일의 번호를 확인해 주세요'));
  expect(screen.getByLabelText('인증번호 6자리').props.value).toBe('');
});

test('이전 바 라벨, 코스 중에는 "오늘 코스로 돌아가기"', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('오늘 코스로 돌아가기'));
  expect(screen.getByText('‹ 오늘 코스')).toBeTruthy();
});

test('부모님 폰에서 자녀를 고르면 확정 안내(알겠어요 -> 첫 화면)', async () => {
  render(<AppRoot api={createFakeApi({linked: true})} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
  expect(screen.getByText('자녀 로그인은 자녀 휴대폰에서 해 주세요')).toBeTruthy();
  await press('알겠어요');
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
});
