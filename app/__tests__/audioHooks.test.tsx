import {act, renderHook} from '@testing-library/react-native';
import {AccessibilityInfo, AppState, type AppStateStatus} from 'react-native';
import {createAudio, type SoundHandle, type TtsEngine} from '../src/audio/audioCore';
import {useBgm, useReadAloud} from '../src/audio/hooks';
import {bindAppLifecycle, setAudioForTest} from '../src/audio/instance';

// 리뷰 M1·M2·M5: 앱 뒤로·화면 이탈·화면 읽기 켜짐이면 멈춤, 돌아와도 배경 음악 자동 재생 안 함, 트랙 해제는 useBgm 이.
// 벨소리는 jest.setup 의 volume-manager 모의(보통=2).

let appStateHandler: ((s: AppStateStatus) => void) | null = null;
let srHandler: ((on: boolean) => void) | null = null;

function fakeTts(): TtsEngine & {stop: jest.Mock; speak: jest.Mock} {
  return {
    hasKorean: async () => true,
    speak: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    onStart: () => () => {},
    onDone: () => () => {},
  };
}
function fakeTrack(): SoundHandle & {play: jest.Mock; stop: jest.Mock; release: jest.Mock} {
  return {play: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), setLoops: jest.fn(), release: jest.fn()};
}

let tts: ReturnType<typeof fakeTts>;
let track: ReturnType<typeof fakeTrack>;
beforeEach(() => {
  appStateHandler = null;
  srHandler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: AppStateStatus) => void) => {
    appStateHandler = h;
    return {remove: jest.fn()};
  }) as never);
  Object.defineProperty(AppState, 'currentState', {value: 'active', configurable: true});
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, h: (on: boolean) => void) => {
    srHandler = h;
    return {remove: jest.fn()};
  }) as never);
  tts = fakeTts();
  track = fakeTrack();
  setAudioForTest(createAudio({tts, loadSfx: () => null}));
});
afterEach(() => {
  jest.restoreAllMocks();
  setAudioForTest(null);
});
const flush = () => act(async () => {});

describe('useReadAloud', () => {
  test('읽고, 화면을 떠나면(언마운트) 멈춘다', async () => {
    const {result, unmount} = renderHook(() => useReadAloud());
    await flush();
    await act(async () => {
      expect(await result.current.speak('사진')).toBe('spoken');
    });
    expect(tts.speak).toHaveBeenCalledWith('사진');
    unmount();
    await flush();
    expect(tts.stop).toHaveBeenCalled();
  });
  test('화면 읽기가 켜지면 멈추고 allowed=false', async () => {
    const {result} = renderHook(() => useReadAloud());
    await flush();
    expect(result.current.allowed).toBe(true);
    await act(async () => {
      await result.current.speak('사진');
    });
    await act(async () => srHandler?.(true));
    expect(result.current.allowed).toBe(false);
    expect(tts.stop).toHaveBeenCalled();
  });
});

describe('bindAppLifecycle', () => {
  test('앱이 뒤로 가면 읽기·음악을 모두 멈춘다', async () => {
    const {audio} = require('../src/audio/instance');
    const a = audio();
    const stopAll = jest.spyOn(a, 'stopAll');
    const off = bindAppLifecycle(a);
    appStateHandler?.('background');
    expect(stopAll).toHaveBeenCalledTimes(1);
    appStateHandler?.('active');
    expect(stopAll).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('useBgm', () => {
  const asset = 'bgm_morning';
  const load = () => track;

  test('켜져 있고 음악 화면이면 재생, 화면을 떠나면 멈추고 해제(release)한다', async () => {
    const {unmount} = renderHook(() => useBgm(asset, {enabled: true, screen: true, load}));
    await flush();
    expect(track.play).toHaveBeenCalledTimes(1);
    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(track.release).toHaveBeenCalledTimes(1);
  });

  test('앱이 뒤로 갔다 돌아와도 저절로 다시 틀지 않는다(스파이크 6-5)', async () => {
    renderHook(() => useBgm(asset, {enabled: true, screen: true, load}));
    await flush();
    expect(track.play).toHaveBeenCalledTimes(1);
    await act(async () => appStateHandler?.('background'));
    expect(track.stop).toHaveBeenCalled();
    await act(async () => appStateHandler?.('active'));
    await flush();
    expect(track.play).toHaveBeenCalledTimes(1);
  });

  test('멈춘 뒤 사용자가 끄고 다시 켜면 다시 튼다', async () => {
    const {rerender} = renderHook(({on}: {on: boolean}) => useBgm(asset, {enabled: on, screen: true, load}), {initialProps: {on: true}});
    await flush();
    await act(async () => appStateHandler?.('background'));
    await act(async () => appStateHandler?.('active'));
    rerender({on: false});
    await flush();
    rerender({on: true});
    await flush();
    expect(track.play).toHaveBeenCalledTimes(2);
  });

  test('화면 읽기가 켜져 있으면 틀지 않는다', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    renderHook(() => useBgm(asset, {enabled: true, screen: true, load}));
    await flush();
    expect(track.play).not.toHaveBeenCalled();
  });
});
