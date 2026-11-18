// AP-03 읽어 주기 화면 연결(시안 PX_read_aloud, 문구 tts.*, 오디오 재검토 R1).
import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {NavigationContext} from '@react-navigation/native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createAudio, type TtsEngine} from '../src/audio/audioCore';
import {setAudioForTest} from '../src/audio/instance';
import * as engines from '../src/audio/engines';
import {ReadAloud, ttsText} from '../src/features/course/ReadAloud';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {press, pressCourseNext} from '../testUtils/flow';

type FakeTts = TtsEngine & {speak: jest.Mock; stop: jest.Mock; done: () => void; korean: boolean};
function fakeTts(): FakeTts {
  const doneL = new Set<() => void>();
  const t: FakeTts = {
    korean: true,
    hasKorean: async () => t.korean,
    speak: jest.fn(async () => {}),
    stop: jest.fn(async () => {
      doneL.forEach(f => f());
    }),
    onStart: () => () => {},
    onDone: cb => {
      doneL.add(cb);
      return () => doneL.delete(cb);
    },
    done: () => doneL.forEach(f => f()),
  };
  return t;
}

let tts: FakeTts;
beforeEach(() => {
  tts = fakeTts();
  setAudioForTest(createAudio({tts, loadSfx: () => null}));
  setPrefsForTest(createPrefs(memoryStore()));
  setLocalStampsForTest(createLocalStamps(memoryStore()));
});
afterEach(() => {
  setAudioForTest(null);
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  jest.restoreAllMocks();
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

test('문장 틀(copy tts.read)', () => {
  expect(ttsText.question('어느 계절이 더 좋으세요?', '봄', '가을')).toBe('어느 계절이 더 좋으세요? 봄, 아니면 가을.');
  expect(ttsText.word('나무', ['나', '무'])).toBe('나무. 한 글자씩, 나, 무.');
  expect(ttsText.cheer('사랑해요')).toBe('가족이 보낸 응원이에요. 사랑해요');
  expect(ttsText.photo(['어디일까요?', '가 보셨어요?'])).toBe('어디일까요? 가 보셨어요?');
});

test('기본 → 누르면 읽고 "멈추기" → 다시 누르면 멈춤 → 다 읽으면 저절로 기본', async () => {
  render(<ReadAloud text="안녕하세요" />);
  await press('읽어 주세요');
  expect(tts.speak).toHaveBeenCalledWith('안녕하세요');
  await waitFor(() => screen.getByRole('button', {name: '멈추기'}));
  await press('멈추기');
  expect(tts.stop).toHaveBeenCalled();
  await waitFor(() => screen.getByRole('button', {name: '읽어 주세요'}));
  await press('읽어 주세요');
  await waitFor(() => screen.getByRole('button', {name: '멈추기'}));
  await act(async () => tts.done());
  await waitFor(() => screen.getByRole('button', {name: '읽어 주세요'}));
});

test('자동으로 읽지 않는다, 화면 읽기 켜짐이면 버튼이 없다(R16)', async () => {
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(true));
  render(<ReadAloud text="안녕하세요" />);
  await waitFor(() => expect(screen.queryByRole('button', {name: '읽어 주세요'})).toBeNull());
  expect(tts.speak).not.toHaveBeenCalled();
});

test('예외 3상태: 한국어 음성 없음 상자 · 소리 0 한 줄 · 실패 한 줄', async () => {
  tts.korean = false;
  render(<ReadAloud text="안녕하세요" />);
  await press('읽어 주세요');
  await waitFor(() => screen.getByText('휴대폰에 한국어 읽기 기능이 없어요'));
  expect(screen.getByRole('button', {name: '휴대폰 설정 열기'})).toBeTruthy();
  screen.unmount();

  jest.spyOn(engines, 'getMediaVolume').mockResolvedValue(0);
  tts.korean = true;
  render(<ReadAloud text="안녕하세요" />);
  await press('읽어 주세요');
  await waitFor(() => screen.getByText('휴대폰 소리가 꺼져 있어요. 소리 버튼을 올려 주세요'));
  expect(tts.speak).not.toHaveBeenCalled();
  screen.unmount();

  jest.spyOn(engines, 'getMediaVolume').mockResolvedValue(0.5);
  tts.speak.mockRejectedValueOnce(new Error('tts'));
  render(<ReadAloud text="안녕하세요" />);
  await press('읽어 주세요');
  await waitFor(() => screen.getByText('지금은 읽어 드릴 수 없어요. 잠시 뒤에 다시 눌러 주세요'));
  expect(screen.getByRole('button', {name: '읽어 주세요'})).toBeTruthy();
});

async function toStep(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

test('P4·P5·P6 모두 읽을 글 아래 버튼 하나', async () => {
  await toStep();
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByText('마음에 드는 쪽을 골라 주세요'));
  await press('읽어 주세요');
  expect(tts.speak).toHaveBeenLastCalledWith(expect.stringMatching(/, 아니면 .+\.$/));
});

test('재검토 R1: 읽는 중 화면을 떠나면(blur) 멈춘다 — native-stack 은 이전 화면을 언마운트하지 않는다', async () => {
  const listeners: Record<string, () => void> = {};
  const nav = {
    addListener: (name: string, cb: () => void) => {
      listeners[name] = cb;
      return () => delete listeners[name];
    },
  };
  render(
    <NavigationContext.Provider value={nav as never}>
      <ReadAloud text="안녕하세요" />
    </NavigationContext.Provider>,
  );
  await press('읽어 주세요');
  await waitFor(() => screen.getByRole('button', {name: '멈추기'}));
  tts.stop.mockClear();
  await act(async () => listeners.blur());
  expect(tts.stop).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByRole('button', {name: '읽어 주세요'})); // 화면은 그대로 마운트, 상태는 기본
});

test('읽지 않던 화면이 떠날 때는 다른 화면의 읽기를 멈추지 않는다', async () => {
  const listeners: Record<string, () => void> = {};
  const nav = {
    addListener: (name: string, cb: () => void) => {
      listeners[name] = cb;
      return () => delete listeners[name];
    },
  };
  render(
    <NavigationContext.Provider value={nav as never}>
      <ReadAloud text="안녕하세요" />
    </NavigationContext.Provider>,
  );
  await act(async () => listeners.blur());
  expect(tts.stop).not.toHaveBeenCalled();
});

test('P8 응원: 응원 문장 아래 버튼, 닫으면 읽기도 멈춘다', async () => {
  await toStep({cheers: ['love_you']});
  await waitFor(() => screen.getByTestId('cheer-dialog'));
  await press('읽어 주세요');
  expect(tts.speak).toHaveBeenLastCalledWith(expect.stringMatching(/^가족이 보낸 응원이에요\. /));
  tts.stop.mockClear();
  await press('알겠어요');
  expect(tts.stop).toHaveBeenCalled();
});

describe('리뷰 M1: 누른 즉시 진행 표시·잠금, 소리 크기 확인 중 화면을 떠나면 읽지 않음', () => {
  const navWith = () => {
    const listeners: Record<string, () => void> = {};
    return {
      listeners,
      nav: {
        addListener: (name: string, cb: () => void) => {
          listeners[name] = cb;
          return () => delete listeners[name];
        },
      },
    };
  };
  test('확인 중 두 번 눌러도 읽기는 한 번, 그동안 버튼은 진행 중(busy)', async () => {
    let release: (v: number) => void = () => {};
    jest.spyOn(engines, 'getMediaVolume').mockImplementation(() => new Promise(r => (release = r)));
    render(<ReadAloud text="안녕하세요" />);
    const btn = screen.getByRole('button', {name: '읽어 주세요'});
    await act(async () => {
      fireEvent.press(btn);
    });
    const busy = screen.getByRole('button', {name: '멈추기'});
    expect(busy.props.accessibilityState.busy).toBe(true);
    await act(async () => {
      fireEvent.press(busy);
    });
    await act(async () => release(0.5));
    expect(tts.speak).toHaveBeenCalledTimes(1);
    expect(tts.stop).not.toHaveBeenCalled();
  });
  test('확인 중에 화면을 떠나면(blur) 떠난 화면에서 읽지 않는다', async () => {
    let release: (v: number) => void = () => {};
    jest.spyOn(engines, 'getMediaVolume').mockImplementation(() => new Promise(r => (release = r)));
    const {nav, listeners} = navWith();
    render(
      <NavigationContext.Provider value={nav as never}>
        <ReadAloud text="안녕하세요" />
      </NavigationContext.Provider>,
    );
    await press('읽어 주세요');
    await act(async () => listeners.blur());
    await act(async () => release(0.5));
    expect(tts.speak).not.toHaveBeenCalled();
    await waitFor(() => screen.getByRole('button', {name: '읽어 주세요'}));
  });
});
