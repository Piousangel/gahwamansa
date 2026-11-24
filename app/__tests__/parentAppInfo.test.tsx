// AP-06 P13 앱 정보 한 목록(법률 in-app-notices §3, 디자인 판정 M8): 약관·방침(앱 안 웹 useInAppWeb)·오픈소스(Oss)·AI·병원 아님·사업자·문의.
import React from 'react';
import {StyleSheet} from 'react-native';
import {color} from '../src/ui/tokens';
import {setBgmPreview} from '../src/lib/bgmAsset';
import {setVoiceClipsForTest} from '../src/audio/voiceClips';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import * as appLink from '../src/shared/appLink';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

type Info = ReturnType<typeof import('../src/lib/appInfo').readAppInfo>;
let mockInfo: Partial<Info> = {};
jest.mock('../src/lib/appInfo', () => {
  const actual = jest.requireActual('../src/lib/appInfo');
  return {...actual, readAppInfo: () => ({...actual.readAppInfo(), ...mockInfo})};
});
afterEach(() => {
  mockInfo = {};
  jest.restoreAllMocks();
});

async function settings() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByTestId('settings-row-oss'));
}
const order = (ids: string[]) => {
  const found = screen.UNSAFE_root.findAll(n => ids.includes(n.props?.testID)).map(n => n.props.testID as string);
  return [...new Set(found)];
};

test('순서: 약관 → 방침 → 오픈소스 → AI → 병원 아님 → 사업자 → 문의하기 → 버전(값이 없어도 숨기지 않음)', async () => {
  await settings();
  const ids = ['settings-row-terms', 'settings-row-privacy', 'settings-row-oss', 'settings-ai-notice', 'settings-not-medical', 'settings-row-business', 'settings-row-contact', 'version-line', 'version-tap'];
  expect(order(ids).filter(x => !x.startsWith('version'))).toEqual(ids.slice(0, 7));
  // 값이 없으면 개발·staging 은 '[설정 필요]'
  expect(within(screen.getByTestId('settings-row-terms')).getByText('[설정 필요]')).toBeTruthy();
  expect(screen.getByText('병원 앱이 아니고, 안부나 안전을 확인하는 서비스가 아니에요')).toBeTruthy();
});

test('오픈소스 라이선스 → Oss 화면', async () => {
  await settings();
  await press('오픈소스 라이선스');
  await waitFor(() => screen.getByText('이 앱을 만드는 데 쓴 공개 소프트웨어예요'));
});

test('약관: 값이 있으면 useInAppWeb 로 열고, 안 닿으면 화면을 열지 않고 한 줄', async () => {
  mockInfo = {termsUrl: 'https://example.test/terms.html'};
  const openWeb = jest.spyOn(appLink, 'openInAppWeb').mockResolvedValueOnce('offline').mockImplementationOnce(async (t, nav) => {
    nav(t);
    return 'opened';
  });
  await settings();
  await press('이용약관');
  await waitFor(() => screen.getByText('인터넷이 연결되면 볼 수 있어요'));
  expect(openWeb).toHaveBeenCalledWith('terms', expect.any(Function), undefined, undefined);
  await press('이용약관');
  await waitFor(() => expect(openWeb).toHaveBeenCalledTimes(2));
  // 리뷰 L9 ①: 두 번째는 실제로 앱 안 웹 화면이 열린다
  await waitFor(() => screen.getByTestId('web-page'));
  // 리뷰 L4: 설정으로 돌아오면 오프라인 한 줄은 지워져 있다
  await press('설정으로');
  await waitFor(() => screen.getByTestId('settings-row-oss'));
  expect(screen.queryByTestId('app-info-offline')).toBeNull();
});

test('리뷰 L9 ②: 방침 행도 같은 경로(useInAppWeb)로 열고, 확인하는 동안 busy(리뷰 L3)', async () => {
  mockInfo = {privacyUrl: 'https://example.test/privacy.html'};
  let release: (v: 'opened') => void = () => {};
  const openWeb = jest.spyOn(appLink, 'openInAppWeb').mockImplementation(() => new Promise(r => (release = r)));
  await settings();
  await press('개인정보 처리방침');
  expect(openWeb).toHaveBeenCalledWith('privacy', expect.any(Function), undefined, undefined);
  expect(screen.getByTestId('settings-row-privacy').props.accessibilityState).toMatchObject({busy: true});
  await act(async () => release('opened'));
  await waitFor(() => expect(screen.getByTestId('settings-row-privacy').props.accessibilityState).toMatchObject({busy: false}));
});

test('리뷰 L1: 값이 빈 행의 [설정 필요]는 위험 색(dangerInk)', async () => {
  await settings();
  const badge = within(screen.getByTestId('settings-row-terms')).getByText('[설정 필요]');
  expect(StyleSheet.flatten(badge.props.style).color).toBe(color.dangerInk);
  // 문의 행은 '[설정 필요]'만 위험 색, 준비 문구는 보조 글
  const contact = screen.getByTestId('settings-row-contact');
  expect(StyleSheet.flatten(within(contact).getByText('[설정 필요] ').props.style).color).toBe(color.dangerInk);
});

test('리뷰 L9 ②: 배경 음악이 공개(미리 듣기)되면 AI 음악 고지 줄이 함께 보인다', async () => {
  await settings();
  expect(screen.queryByText('배경 음악은 AI(Google Lyria)가 만든 연주곡이에요')).toBeNull();
  screen.unmount();
  setBgmPreview(true);
  try {
    await settings();
    expect(within(screen.getByTestId('settings-ai-notice')).getByText('배경 음악은 AI(Google Lyria)가 만든 연주곡이에요')).toBeTruthy();
  } finally {
    setBgmPreview(false);
  }
});

test('AI 음성 고지: 미리 생성 음성이 있을 때만 보인다(DECISIONS 11-19)', async () => {
  const line = '읽어 주는 목소리는 AI가 만든 목소리예요. 사람이 읽은 게 아니에요';
  await settings();
  expect(screen.queryByText(line)).toBeNull();
  screen.unmount();
  setVoiceClipsForTest({'늘 고마워요': 1});
  try {
    await settings();
    expect(within(screen.getByTestId('settings-ai-notice')).getByText(line)).toBeTruthy();
  } finally {
    setVoiceClipsForTest(null);
  }
});

test('사업자 정보: 네 값이 다 있으면 누를 때 펼친다', async () => {
  mockInfo = {business: {name: '행복가게', ceo: '홍길동', regNo: '123-45-67890', address: '서울'}};
  await settings();
  expect(screen.queryByTestId('settings-business')).toBeNull();
  expect(screen.getByTestId('settings-row-business').props.accessibilityState).toMatchObject({expanded: false});
  await act(async () => {
    fireEvent.press(screen.getByTestId('settings-row-business'));
  });
  expect(screen.getByTestId('settings-row-business').props.accessibilityState).toMatchObject({expanded: true}); // 리뷰 L2
  expect(within(screen.getByTestId('settings-business')).getByText('사업자등록번호 123-45-67890')).toBeTruthy();
});
