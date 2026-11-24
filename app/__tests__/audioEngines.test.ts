declare const __dirname: string;
import {Image, Platform} from 'react-native';
import {createTtsEngine, getRinger, GOOGLE_TTS_ENGINE, loadSfx, loadSound, pickLocalVoice, pickVoice, subscribeRinger, TTS_RATE, TTS_TUNING, ttsVoicePick} from '../src/audio/engines';
import {newStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {setPrefsForTest, createPrefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {setAudioForTest} from '../src/audio/instance';

// 네이티브 라이브러리 연결(jest.setup 의 모의는 실제 API 처럼 엄격: Sound 는 문자열 파일 이름만 받는다).
const vm = require('react-native-volume-manager');
const Speech = require('@mhpdev/react-native-speech').default;
const Sound = require('react-native-sound').default;
const lastSound = () => Sound.__instances[Sound.__instances.length - 1];

const OS = Platform.OS;
beforeEach(() => {
  Platform.OS = 'android';
  setPrefsForTest(createPrefs(memoryStore()));
  setStampFeedbackForTest(null);
  setAudioForTest(null);
  vm.getRingerMode.mockResolvedValue(2);
});
afterAll(() => {
  Platform.OS = OS;
});

test('벨소리: 2 → normal, 0 → silent, 실패 → unknown', async () => {
  vm.getRingerMode.mockResolvedValueOnce(2);
  expect(await getRinger()).toBe('normal');
  vm.getRingerMode.mockResolvedValueOnce(0);
  expect(await getRinger()).toBe('silent');
  vm.getRingerMode.mockRejectedValueOnce(new Error('x'));
  expect(await getRinger()).toBe('unknown');
});

test('벨소리 구독: 구독마다 따로 해제하고, 전역 해제는 마지막 구독이 끝날 때만(리뷰 M6)', () => {
  vm.addRingerListener.mockClear();
  vm.removeRingerListener.mockClear();
  const a = subscribeRinger(() => {});
  const b = subscribeRinger(() => {});
  a();
  expect(vm.removeRingerListener).not.toHaveBeenCalled();
  a(); // 두 번 불러도 한 번만 센다
  b();
  expect(vm.removeRingerListener).toHaveBeenCalledTimes(1);
});

test('TTS: ko-KR·덕킹·플랫폼별 보통 속도(리뷰 M4)로 말한다', async () => {
  jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([{language: 'ko-KR'}]);
  const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
  const tts = createTtsEngine()!;
  await tts.speak('사진');
  expect(speak).toHaveBeenCalledWith('사진', expect.objectContaining({language: 'ko-KR', ducking: true, rate: TTS_RATE.android}));
  expect(TTS_RATE.android).toBeGreaterThanOrEqual(0.9); // Android 1.0 = 보통(0.5 는 절반 속도)
  expect(TTS_RATE.ios).toBeLessThanOrEqual(0.5); // iOS AVSpeech 기본 0.5 = 보통
});

test('TTS: 한국어 음성 있음은 기억하고, 없음은 다시 묻는다(설치하고 돌아온 경우, 리뷰 L1)', async () => {
  const voices = jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValueOnce([]).mockResolvedValue([{language: 'ko-KR'}]);
  const tts = createTtsEngine()!;
  expect(await tts.hasKorean()).toBe(false);
  expect(await tts.hasKorean()).toBe(true);
  expect(await tts.hasKorean()).toBe(true);
  expect(voices).toHaveBeenCalledTimes(2);
});

test('효과음: require 자산 번호를 문자열 주소로 바꿔 연다(0.13.0 은 숫자를 못 받음, 리뷰 H1)', () => {
  const spy = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({uri: 'src_ui_assets_stamp', width: 0, height: 0, scale: 1});
  const h = loadSfx('stamp');
  expect(h).not.toBeNull();
  expect(Sound.setCategory).toHaveBeenCalledWith('Playback', true); // Android 미디어 스트림(D-40)
  expect(typeof lastSound().asset).toBe('string');
  expect(lastSound().asset).toBe('src_ui_assets_stamp');
  expect(lastSound().basePath).toBeUndefined(); // 두 번째 인자가 함수면 0.13.0 이 경로에 함수 글자를 붙인다
  h!.play();
  expect(lastSound().play).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('효과음: 디버그(Metro http 주소)도 그대로 문자열로 넘긴다', () => {
  const spy = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({uri: 'http://localhost:8081/assets/src/ui/assets/stamp.wav', width: 0, height: 0, scale: 1});
  loadSound(7);
  expect(lastSound().asset).toBe('http://localhost:8081/assets/src/ui/assets/stamp.wav');
  spy.mockRestore();
});

test('효과음: 주소를 못 풀면 null(소리 없이 계속)', () => {
  const spy = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue(null as never);
  expect(loadSound(7)).toBeNull();
  spy.mockRestore();
});

test('도장 피드백 기본 연결: 벨소리 보통이면 도장 소리, 무음이면 소리 없음, 소리 장치는 하나만 연다', async () => {
  const spy = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({uri: 'src_ui_assets_stamp', width: 0, height: 0, scale: 1});
  const before = Sound.__instances.length;
  vm.getRingerMode.mockResolvedValue(2);
  expect((await newStampFeedback().fire()).sound).toBe(true);
  vm.getRingerMode.mockResolvedValue(0);
  expect((await newStampFeedback().fire()).sound).toBe(false);
  vm.getRingerMode.mockResolvedValue(2);
  expect((await newStampFeedback().fire()).sound).toBe(true);
  expect(Sound.__instances.length - before).toBe(1);
  spy.mockRestore();
});

describe('기기 TTS 개선(DECISIONS 11-19 V13a)', () => {
  const voices = [
    {identifier: 'ko-kr-x-ism-network', name: 'ko-kr-x-ism-network', quality: 'Enhanced', language: 'ko-KR'},
    {identifier: 'ko-kr-x-kob-local', name: 'ko-kr-x-kob-local', quality: 'Default', language: 'ko-KR'},
    {identifier: 'ko-kr-x-ism-local', name: 'ko-kr-x-ism-local', quality: 'Enhanced', language: 'ko-KR'},
  ];
  afterEach(() => jest.restoreAllMocks());

  /** 라이브러리 모의는 네 이벤트가 같은 jest.fn 이라 spyOn 으로 나눌 수 없다 → 엔진을 만드는 동안만 바꿔 끼운다 */
  function engineWithEvents(opts?: Parameters<typeof createTtsEngine>[0]) {
    const h: Record<string, () => void> = {};
    const names = ['onStart', 'onFinish', 'onError', 'onStopped'] as const;
    const orig = names.map(n => Speech[n]);
    names.forEach(n => {
      Speech[n] = (cb: () => void) => {
        h[n] = cb;
        return {remove: jest.fn()};
      };
    });
    try {
      return {tts: createTtsEngine(opts)!, h};
    } finally {
      names.forEach((n, i) => (Speech[n] = orig[i]));
    }
  }
  const tick = () => new Promise<void>(r => setImmediate(() => r()));

  test('보이스: 네트워크 보이스는 Enhanced 여도 고르지 않는다 → 로컬 Enhanced → local → 아무 비네트워크', () => {
    expect(pickLocalVoice(voices)).toBe('ko-kr-x-ism-local');
    expect(pickLocalVoice([voices[0], voices[1]])).toBe('ko-kr-x-kob-local');
    expect(pickVoice([voices[0], {identifier: 'SMTl01', language: 'ko-KR', quality: 'Default'}])).toEqual({voice: 'SMTl01', kind: 'local'}); // 이름 규칙이 다른 엔진(리뷰 L1)
    expect(pickLocalVoice([{identifier: 'en-us-x-local', quality: 'Enhanced', language: 'en-US'}])).toBeNull();
    expect(pickVoice(null)).toEqual({voice: null, kind: 'none'});
  });

  test('보이스: 한국어가 네트워크 보이스뿐이면 지정하지 않고 network_only 로 기록한다(리뷰 L1)', async () => {
    expect(pickVoice([voices[0]])).toEqual({voice: null, kind: 'network_only'});
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([voices[0]]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const tts = createTtsEngine()!;
    expect(await tts.hasKorean()).toBe(true);
    expect(ttsVoicePick()).toEqual({voice: null, kind: 'network_only'});
    expect(warn).toHaveBeenCalled();
    await tts.speak('사진');
    expect((speak.mock.calls[0][1] as {voice?: string}).voice).toBeUndefined();
  });

  test('엔진: Google 엔진이 있고 기본이 아니면 바꾸고, 고른 로컬 보이스로 한 문장씩 말한다', async () => {
    jest.spyOn(Speech, 'getEngines').mockResolvedValue([
      {name: 'com.samsung.SMT', label: 'Samsung', isDefault: true},
      {name: GOOGLE_TTS_ENGINE, label: 'Google', isDefault: false},
    ]);
    const setEngine = jest.spyOn(Speech, 'setEngine').mockResolvedValue(undefined);
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue(voices);
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const {tts, h} = engineWithEvents();
    expect(await tts.hasKorean()).toBe(true);
    await tts.speak('어디일까요? 가 보셨어요?');
    expect(setEngine).toHaveBeenCalledTimes(1);
    expect(setEngine).toHaveBeenCalledWith(GOOGLE_TTS_ENGINE);
    expect(speak).toHaveBeenCalledTimes(1); // 다음 문장은 앞 문장이 끝난 뒤에 넣는다
    expect(speak).toHaveBeenNthCalledWith(1, '어디일까요?', expect.objectContaining({voice: 'ko-kr-x-ism-local', ducking: true}));
    h.onFinish();
    await tick();
    expect(speak).toHaveBeenNthCalledWith(2, '가 보셨어요?', expect.objectContaining({voice: 'ko-kr-x-ism-local'}));
  });

  test('엔진: Google 엔진에 한국어가 없으면 원래 기본 엔진으로 되돌린다', async () => {
    jest.spyOn(Speech, 'getEngines').mockResolvedValue([
      {name: 'com.samsung.SMT', label: 'Samsung', isDefault: true},
      {name: GOOGLE_TTS_ENGINE, label: 'Google', isDefault: false},
    ]);
    const setEngine = jest.spyOn(Speech, 'setEngine').mockResolvedValue(undefined);
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValueOnce([]).mockResolvedValue(voices);
    const tts = createTtsEngine()!;
    expect(await tts.hasKorean()).toBe(true);
    expect(setEngine.mock.calls.map(c => c[0])).toEqual([GOOGLE_TTS_ENGINE, 'com.samsung.SMT']);
  });

  test('엔진: Google 이 없거나 이미 기본이거나 iOS 면 바꾸지 않는다', async () => {
    const setEngine = jest.spyOn(Speech, 'setEngine').mockResolvedValue(undefined);
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue(voices);
    const engines = jest.spyOn(Speech, 'getEngines').mockResolvedValue([{name: GOOGLE_TTS_ENGINE, label: 'G', isDefault: true}]);
    await createTtsEngine()!.hasKorean();
    engines.mockResolvedValue([{name: 'com.samsung.SMT', label: 'S', isDefault: true}]);
    await createTtsEngine()!.hasKorean();
    Platform.OS = 'ios';
    engines.mockClear();
    await createTtsEngine()!.hasKorean();
    expect(engines).not.toHaveBeenCalled();
    expect(setEngine).not.toHaveBeenCalled();
  });

  test('엔진 조회가 실패해도 기본 엔진으로 읽는다', async () => {
    jest.spyOn(Speech, 'getEngines').mockRejectedValue(new Error('x'));
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue(voices);
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const tts = createTtsEngine()!;
    expect(await tts.hasKorean()).toBe(true);
    await tts.speak('사진');
    expect(speak).toHaveBeenCalledTimes(1);
  });

  test('보이스를 넣어 실패하면 보이스 없이 다시 읽고, 다음부터는 보이스를 쓰지 않는다', async () => {
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue(voices);
    const speak = jest.spyOn(Speech, 'speak').mockRejectedValueOnce(new Error('voice')).mockResolvedValue('id');
    const {tts, h} = engineWithEvents();
    await tts.hasKorean();
    await tts.speak('하나. 둘.');
    h.onFinish();
    await tick();
    expect(speak.mock.calls.map(c => [c[0], (c[1] as {voice?: string}).voice])).toEqual([
      ['하나.', 'ko-kr-x-ism-local'],
      ['하나.', undefined],
      ['둘.', undefined],
    ]);
  });

  test('끝남은 마지막 문장이 끝날 때 한 번만(중간에 덕킹이 풀리지 않게), 멈춤이면 바로', async () => {
    jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const {tts, h} = engineWithEvents();
    const done = jest.fn();
    tts.onDone(done);
    await tts.speak('하나. 둘. 셋.');
    h.onFinish();
    await tick();
    h.onError(); // 한 문장 오류면 다음 문장으로
    await tick();
    expect(done).not.toHaveBeenCalled();
    h.onFinish();
    expect(done).toHaveBeenCalledTimes(1);
    await tts.speak('넷. 다섯.');
    h.onStopped();
    expect(done).toHaveBeenCalledTimes(2);
  });

  test('문장 사이 틈에 멈추면 다음 문장을 넣지 않는다(리뷰 L3: 네이티브 stop 이 무시되는 틈)', async () => {
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const stop = jest.spyOn(Speech, 'stop').mockResolvedValue(undefined); // 틈이라 네이티브는 아무것도 안 함(onStopped 없음)
    const {tts, h} = engineWithEvents();
    await tts.speak('하나. 둘. 셋.');
    await tts.stop();
    h.onFinish(); // 첫 문장 끝 알림이 멈춤 뒤에 도착
    await tick();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('다음 문장을 넣는 도중에 멈추면 넣은 뒤 한 번 더 멈춘다', async () => {
    let release: (v: string) => void = () => {};
    const speak = jest
      .spyOn(Speech, 'speak')
      .mockResolvedValueOnce('id')
      .mockImplementationOnce(() => new Promise<string>(r => (release = r)));
    const stop = jest.spyOn(Speech, 'stop').mockResolvedValue(undefined);
    const {tts, h} = engineWithEvents();
    await tts.speak('하나. 둘. 셋.');
    h.onFinish(); // '둘.'을 넣는 중
    await tick();
    const stopping = tts.stop();
    await tick();
    release('id2');
    await stopping;
    expect(stop).toHaveBeenCalledTimes(2);
    h.onFinish();
    await tick();
    expect(speak).toHaveBeenCalledTimes(2); // '셋.'은 넣지 않음
  });

  test('첫 문장부터 못 넣으면 실패를 돌려준다(화면이 "지금은 읽어 드릴 수 없어요")', async () => {
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([]);
    jest.spyOn(Speech, 'speak').mockRejectedValue(new Error('x'));
    await expect(createTtsEngine()!.speak('하나. 둘.')).rejects.toThrow('x');
  });

  // P-2(오너 S25): 읽기용 문장 변환·문장 사이 쉼
  test('읽기 전에 읽기용 문장으로 바꾼다(AI → 에이아이, 가운뎃점 → 쉼표)', async () => {
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const {tts} = engineWithEvents();
    await tts.speak('AI가 만든 그림·실제 장소가 아니에요');
    expect(speak).toHaveBeenCalledWith('에이아이가 만든 그림, 실제 장소가 아니에요', expect.anything());
  });

  test('한 글자씩은 글자마다 따로 넣는다', async () => {
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const {tts, h} = engineWithEvents();
    await tts.speak('나무. 한 글자씩, 나, 무.');
    for (let i = 0; i < 3; i++) {
      h.onFinish();
      await tick();
    }
    expect(speak.mock.calls.map(c => c[0])).toEqual(['나무.', '한 글자씩.', '나.', '무.']);
  });

  test('문장 사이 쉼: 앞 문장이 끝나고 sentencePauseMs 뒤에 다음 문장을 넣고, 쉬는 사이 멈추면 넣지 않는다', async () => {
    jest.useFakeTimers();
    try {
      const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
      jest.spyOn(Speech, 'stop').mockResolvedValue(undefined);
      const {tts, h} = engineWithEvents({sentencePauseMs: TTS_TUNING.sentencePauseMs});
      const done = jest.fn();
      tts.onDone(done);
      await tts.speak('하나. 둘. 셋.');
      h.onFinish();
      await jest.advanceTimersByTimeAsync(TTS_TUNING.sentencePauseMs - 1);
      expect(speak).toHaveBeenCalledTimes(1); // 아직 쉬는 중
      await jest.advanceTimersByTimeAsync(1);
      expect(speak).toHaveBeenCalledTimes(2);
      h.onFinish();
      await tts.stop(); // 쉬는 사이 멈춤
      await jest.advanceTimersByTimeAsync(TTS_TUNING.sentencePauseMs * 2);
      expect(speak).toHaveBeenCalledTimes(2); // '셋.'은 넣지 않음
      // 마지막 문장 끝은 쉼 없이 바로 끝남
      await tts.speak('넷.');
      h.onFinish();
      expect(done).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('쉬는 사이 새로 읽으면 이전 글의 다음 문장이 끼어들지 않고, 기다리던 타이머는 지운다(#238 리뷰 L4·L5)', async () => {
    jest.useFakeTimers();
    try {
      const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
      const {tts, h} = engineWithEvents({sentencePauseMs: TTS_TUNING.sentencePauseMs});
      await tts.speak('하나. 둘.');
      h.onFinish(); // '둘.'을 기다리는 중
      expect(jest.getTimerCount()).toBe(1);
      await tts.speak('셋. 넷.'); // 쉬는 사이 새 읽기
      expect(jest.getTimerCount()).toBe(0); // 이전 글의 타이머를 지움
      await jest.advanceTimersByTimeAsync(TTS_TUNING.sentencePauseMs * 2);
      expect(speak.mock.calls.map(c => c[0])).toEqual(['하나.', '셋.']); // '둘.'은 넣지 않음
      h.onFinish();
      await jest.advanceTimersByTimeAsync(TTS_TUNING.sentencePauseMs);
      expect(speak.mock.calls.map(c => c[0])).toEqual(['하나.', '셋.', '넷.']);
      h.onFinish();
      await tts.speak('다섯. 여섯.');
      h.onFinish();
      await tts.stop(); // 쉬는 사이 멈춤도 타이머를 지움
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('말 빠르기·높낮이·쉼 기본값은 한 곳(TTS_TUNING)에서, 근거 범위 안', () => {
    expect(TTS_RATE).toBe(TTS_TUNING.rate);
    expect(TTS_TUNING.pitch).toBe(1);
    expect(TTS_TUNING.sentencePauseMs).toBeGreaterThanOrEqual(200);
    expect(TTS_TUNING.sentencePauseMs).toBeLessThanOrEqual(800);
  });
});

test('D-40: 효과음·BGM 은 Android 미디어 스트림(Playback), iOS 는 무음 스위치를 따르는 Ambient — 둘 다 포커스를 잡지 않음', () => {
  const {soundCategory} = require('../src/audio/engines');
  const RN = require('react-native');
  const orig = RN.Platform.OS;
  try {
    Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
    expect(soundCategory()).toBe('Playback');
    Object.defineProperty(RN.Platform, 'OS', {value: 'ios', configurable: true, writable: true});
    expect(soundCategory()).toBe('Ambient');
  } finally {
    Object.defineProperty(RN.Platform, 'OS', {value: orig, configurable: true, writable: true});
  }
  // 라이브러리(0.13.0) Android 대응: Playback = STREAM_MUSIC, mixWithOthers 면 requestAudioFocus 안 함
  const fs = require('fs');
  const path = require('path');
  const kt: string = fs.readFileSync(path.join(__dirname, '../node_modules/react-native-sound/android/src/main/java/com/zmxv/RNSound/Sound.kt'), 'utf8');
  expect(kt).toMatch(/"Playback" -> category = AudioManager\.STREAM_MUSIC/);
  expect(kt).toMatch(/if \(!this\.mixWithOthers\) \{[\s\S]{0,120}requestAudioFocus/);
  const main: string = fs.readFileSync(path.join(__dirname, '../android/app/src/main/java/com/bumojasik/app/MainActivity.kt'), 'utf8');
  expect(main).toContain('volumeControlStream = AudioManager.STREAM_MUSIC');
});

