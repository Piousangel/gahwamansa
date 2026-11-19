// AP-04 배경 음악 연결(시안 PX_music). 음원(CT-04) 전에는 모두 숨김, 음원이 있으면 P3 버튼·P7 첫 완료 권유·P13 행.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {bgmAsset, setBgmAssetForTest, setBgmPreview} from '../src/lib/bgmAsset';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {press, pressCourseNext} from '../testUtils/flow';
import {warmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트를 떠안지 않게 파일 시작 때 한 번 그렸다 내린다(PR #101 리뷰, testUtils/warm)
beforeAll(warmAppRoot);

let prefs: Prefs;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  setStampFeedbackForTest(() => ({fire: async () => ({sound: false, haptic: false})}));
});
afterEach(() => {
  setBgmAssetForTest(undefined);
  setBgmPreview(false);
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  setStampFeedbackForTest(null);
});

async function home(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
}
async function finishCourse() {
  await home({completedSteps: ['photo', 'question']});
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-title'));
}

test('음원(CT-04) 전에는 P3 음악 버튼·P7 권유·P13 행이 모두 없다', async () => {
  await finishCourse();
  await new Promise<void>(r => setTimeout(() => r(), 1200));
  expect(screen.queryByTestId('bgm-offer')).toBeNull();
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.queryByRole('button', {name: '음악 켜기'})).toBeNull();
  await press('설정');
  await waitFor(() => screen.getByText('도장 소리'));
  expect(screen.queryByTestId('bgm-row')).toBeNull();
});

test('음원이 있으면 P3 "음악 켜기" → 누르면 켜지고 "음악 끄기"(기본 꺼짐, 기기에 저장)', async () => {
  setBgmAssetForTest('bgm_test');
  await home();
  await press('음악 켜기');
  await waitFor(() => screen.getByRole('button', {name: '음악 끄기'}));
  expect(await prefs.bgmEnabled()).toBe(true);
  await press('음악 끄기');
  await waitFor(() => screen.getByRole('button', {name: '음악 켜기'}));
  expect(await prefs.bgmEnabled()).toBe(false);
});

test('V1: 처음 코스를 마친 날(첫날)에는 음악 권유가 없고, 그날을 기기에 남긴다', async () => {
  setBgmAssetForTest('bgm_test');
  await finishCourse();
  await act(async () => {
    await new Promise<void>(r => setTimeout(() => r(), 2500)); // 연출이 끝난 뒤(권유가 뜰 시점)까지
  });
  expect(screen.queryByTestId('bgm-offer')).toBeNull();
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  expect(await prefs.noteFirstDoneDay('2000-01-01')).toBe(today);
  expect(await prefs.bgmOffered()).toBe(false); // 다음 완료 때 묻는다
});

test('P7 완료 1회 권유(첫날 다음부터, 출처 줄 포함) → 들어 볼게요 → 미리 듣기 → 끌게요면 꺼짐, 다음 완료에는 묻지 않음', async () => {
  setBgmAssetForTest('bgm_test');
  await prefs.noteFirstDoneDay('2026-01-01'); // 이미 다른 날 코스를 마친 기기
  await finishCourse();
  const ask = await waitFor(() => screen.getByTestId('bgm-offer'));
  expect(within(ask).getByText(/AI\(Google Lyria\)가 만든 연주곡이에요/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(ask).getByRole('button', {name: '들어 볼게요'}));
  });
  expect(await prefs.bgmEnabled()).toBe(true);
  const preview = await waitFor(() => screen.getByTestId('bgm-preview'));
  expect(within(preview).getByText(/지금 나오는 음악이에요/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(preview).getByRole('button', {name: '끌게요'}));
  });
  expect(await prefs.bgmEnabled()).toBe(false);
  expect(await prefs.bgmOffered()).toBe(true);
});

test('P13 "배경 음악" 행: 기본 꺼짐, 누르면 켜짐', async () => {
  setBgmAssetForTest('bgm_test');
  await home();
  await press('설정');
  const row = await waitFor(() => screen.getByRole('switch', {name: '배경 음악'}));
  await waitFor(() => expect(screen.getByRole('switch', {name: '배경 음악'}).props.accessibilityState.checked).toBe(false));
  expect(row.props.accessibilityHint).toBe('오늘 코스 화면과 마친 화면에서만 나와요');
  await act(async () => {
    fireEvent.press(screen.getByTestId('bgm-row'));
  });
  await waitFor(async () => expect(await prefs.bgmEnabled()).toBe(true));
});

test('음원 2곡(content/audio → src/assets/bgm): 공개 전에는 null, 개발자 메뉴 미리 듣기면 이 실행 동안 home·done 자산', () => {
  expect(bgmAsset('home')).toBeNull();
  expect(bgmAsset('done')).toBeNull();
  setBgmPreview(true);
  expect(bgmAsset('home')).not.toBeNull();
  expect(bgmAsset('done')).not.toBeNull();
});
