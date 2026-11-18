import React from 'react';
import {AccessibilityInfo, BackHandler} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {EVENT_NAMES} from '../src/api/contract/events';
import {press, pressCourseNext} from '../testUtils/flow';

// AP-05 B1 사진 크게 보기(시안 P4_zoom_review + 디자인 W0 DZ-06):
// 폴라로이드 전체가 누름 영역, '닫기'(64)·시스템 뒤로로만 닫음(사진 다시 눌러 닫기 없음), 첫 안내는 한 번 열 때까지·최대 P4 세 번째 방문,
// 사진을 못 불러왔으면 진입 없음, 이벤트 photo_zoom_opened{day_index}.
let prefs: Prefs;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
});
afterEach(() => {
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  jest.restoreAllMocks();
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

const OPEN = '오늘 사진, 마을 입구 나무, AI가 만든 그림, 두 번 눌러 크게 보기';
async function toPhoto(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, realImage: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  return api;
}
const loadPhoto = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('photo-image'), 'load');
  });
};

test('계약: photo_zoom_opened 이벤트 이름(0034, 같은 철자 임시 추가)', () => {
  expect(EVENT_NAMES).toContain('photo_zoom_opened');
});

test('사진이 열리면 폴라로이드 전체가 버튼(읽기 라벨), 누르면 크게 보기: 닫기·캡션·AI 표기, 이벤트 1회', async () => {
  const api = await toPhoto();
  const log = jest.spyOn(api, 'logEvent');
  expect(screen.queryByRole('button', {name: OPEN})).toBeNull(); // 불러오기 전에는 진입 없음
  await loadPhoto();
  await press(OPEN);
  await waitFor(() => screen.getByTestId('zoom-view'));
  expect(screen.getByLabelText('사진 크게 보기, 마을 입구 나무, AI가 만든 그림')).toBeTruthy();
  expect(screen.getByRole('button', {name: '닫기'})).toBeTruthy();
  expect(log).toHaveBeenCalledWith('photo_zoom_opened', {day_index: 1});
});

test('사진을 다시 눌러도 닫히지 않는다(실수 방지), 닫기·시스템 뒤로로 닫는다', async () => {
  const handlers: (() => boolean)[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, h: () => boolean) => {
    handlers.push(h);
    return {remove: () => handlers.splice(handlers.indexOf(h), 1)};
  }) as never);
  await toPhoto();
  await loadPhoto();
  await press(OPEN);
  await waitFor(() => screen.getByTestId('zoom-view'));
  fireEvent.press(screen.getByTestId('zoom-photo'));
  expect(screen.getByTestId('zoom-view')).toBeTruthy();
  await press('닫기');
  await waitFor(() => expect(screen.queryByTestId('zoom-view')).toBeNull());
  await press(OPEN);
  await waitFor(() => screen.getByTestId('zoom-view'));
  // Modal 의 onRequestClose(안드로이드 뒤로)
  await act(async () => {
    fireEvent(screen.getByTestId('zoom-modal'), 'requestClose');
  });
  await waitFor(() => expect(screen.queryByTestId('zoom-view')).toBeNull());
});

test('사진을 못 불러왔으면 크게 보기 진입이 없다', async () => {
  await toPhoto();
  await act(async () => {
    fireEvent(screen.getByTestId('photo-image'), 'error');
  });
  expect(screen.queryByRole('button', {name: OPEN})).toBeNull();
  expect(screen.queryByText('사진을 누르면 크게 보여요')).toBeNull();
});

test('첫 안내: 한 번 열기 전까지 보이고, 열면 다시 안 보인다', async () => {
  await toPhoto();
  await loadPhoto();
  await waitFor(() => screen.getByText('사진을 누르면 크게 보여요'));
  await press(OPEN);
  await press('닫기');
  await waitFor(() => expect(screen.queryByText('사진을 누르면 크게 보여요')).toBeNull());
  expect(await prefs.zoomOpened()).toBe(true);
});

test('첫 안내: 열지 않으면 P4 세 번째 방문까지만', async () => {
  await prefs.countPhotoVisit();
  await prefs.countPhotoVisit(); // 이미 두 번 방문
  await toPhoto();
  await loadPhoto();
  await waitFor(() => screen.getByText('사진을 누르면 크게 보여요')); // 세 번째
  expect(await prefs.photoVisits()).toBe(3);
  const p2 = createPrefs(memoryStore());
  await p2.countPhotoVisit();
  await p2.countPhotoVisit();
  await p2.countPhotoVisit();
  setPrefsForTest(p2);
  screen.unmount();
  await toPhoto();
  await loadPhoto();
  await new Promise<void>(r => setTimeout(() => r(), 50));
  expect(screen.queryByText('사진을 누르면 크게 보여요')).toBeNull(); // 네 번째
});

test('보기 전용(B2) P4 에서도 같은 크게 보기', async () => {
  const api = createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question', 'hangul']});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByLabelText('사진 보기, 다시 보는 중'));
  await loadPhoto();
  await press(OPEN);
  await waitFor(() => screen.getByTestId('zoom-view'));
});
