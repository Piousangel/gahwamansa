// 법률 Q4: P13 '문의하기'에서 열람·정정·삭제 요청 경로(메일 + 제목), 주소가 없으면 행은 보이되 안내.
import {Linking} from 'react-native';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react-native';
import {createFakeApi} from '../src/features/fakeApi';
import {setupWarmAppRoot} from '../testUtils/warm';
import {renderParentScreen} from '../testUtils/parentScreen';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

let mockMail: string | null = null;
jest.mock('../src/lib/appInfo', () => {
  const actual = jest.requireActual('../src/lib/appInfo');
  return {
    ...actual,
    readAppInfo: () => ({...actual.readAppInfo(), contactEmail: mockMail}),
  };
});
afterEach(() => {
  mockMail = null;
  jest.restoreAllMocks();
});

// 설정(P13)만 바로 그린다(대기열 71, 진짜 어르신 스택 — 홈 → 설정 이동은 검사 대상 아님)
async function settings() {
  await renderParentScreen({api: createFakeApi({linked: true, consented: true})});
  return waitFor(() => screen.getByTestId('settings-row-contact'));
}

test('주소가 아직 없으면 행은 보이되 누를 수 없고 "준비하고 있어요"와 요청 안내 한 줄', async () => {
  const row = await settings();
  expect(within(row).getByText(/문의 메일 주소를 준비하고 있어요/)).toBeTruthy();
  expect(within(row).getByText(/내 정보를 보거나 고치거나 지우고 싶을 때도/)).toBeTruthy();
  expect(screen.queryByRole('button', {name: /문의하기/})).toBeNull();
});

test('주소가 있으면 누를 때 메일 앱을 제목 "[가화만사성] 내 정보 보기·지우기 요청"으로 연다', async () => {
  mockMail = 'help@example.test';
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const row = await settings();
  expect(within(row).getByText(/help@example\.test/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(row);
  });
  expect(open).toHaveBeenCalledWith(`mailto:help@example.test?subject=${encodeURIComponent('[가화만사성] 내 정보 보기·지우기 요청')}`);
});
