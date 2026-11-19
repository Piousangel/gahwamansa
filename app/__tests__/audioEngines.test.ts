declare const __dirname: string;
import {Image, Platform} from 'react-native';
import {createTtsEngine, getRinger, GOOGLE_TTS_ENGINE, loadSfx, loadSound, pickLocalVoice, subscribeRinger, TTS_RATE} from '../src/audio/engines';
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

  test('보이스: 네트워크 보이스는 Enhanced 여도 고르지 않는다(문장이 서버로 감) → 로컬 Enhanced', () => {
    expect(pickLocalVoice(voices)).toBe('ko-kr-x-ism-local');
    expect(pickLocalVoice([voices[0], voices[1]])).toBe('ko-kr-x-kob-local');
    expect(pickLocalVoice([voices[0]])).toBeNull(); // 네트워크뿐 → 엔진 기본
    expect(pickLocalVoice([{identifier: 'en-us-x-local', quality: 'Enhanced', language: 'en-US'}])).toBeNull();
    expect(pickLocalVoice(null)).toBeNull();
  });

  test('엔진: Google 엔진이 있고 기본이 아니면 바꾸고, 고른 로컬 보이스로 문장마다 말한다', async () => {
    jest.spyOn(Speech, 'getEngines').mockResolvedValue([
      {name: 'com.samsung.SMT', label: 'Samsung', isDefault: true},
      {name: GOOGLE_TTS_ENGINE, label: 'Google', isDefault: false},
    ]);
    const setEngine = jest.spyOn(Speech, 'setEngine').mockResolvedValue(undefined);
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue(voices);
    const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    const tts = createTtsEngine()!;
    expect(await tts.hasKorean()).toBe(true);
    await tts.speak('어디일까요? 가 보셨어요?');
    expect(setEngine).toHaveBeenCalledTimes(1);
    expect(setEngine).toHaveBeenCalledWith(GOOGLE_TTS_ENGINE);
    expect(speak).toHaveBeenCalledTimes(2); // 문장마다 따로(쉼)
    expect(speak).toHaveBeenNthCalledWith(1, '어디일까요?', expect.objectContaining({voice: 'ko-kr-x-ism-local', ducking: true}));
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
    const tts = createTtsEngine()!;
    await tts.hasKorean();
    await tts.speak('하나. 둘.');
    expect(speak.mock.calls.map(c => [c[0], (c[1] as {voice?: string}).voice])).toEqual([
      ['하나.', 'ko-kr-x-ism-local'],
      ['하나.', undefined],
      ['둘.', undefined],
    ]);
  });

  test('끝남은 마지막 문장이 끝날 때 한 번만(중간에 덕킹이 풀리지 않게), 멈춤이면 바로', async () => {
    // 라이브러리 모의는 네 이벤트가 같은 jest.fn 을 써서 spyOn 으로 나눌 수 없다 → 잠깐 바꿔 끼우고 되돌린다
    const handlers: Record<string, () => void> = {};
    const names = ['onStart', 'onFinish', 'onError', 'onStopped'] as const;
    const orig = names.map(n => Speech[n]);
    names.forEach(n => {
      Speech[n] = (cb: () => void) => {
        handlers[n] = cb;
        return {remove: jest.fn()};
      };
    });
    jest.spyOn(Speech, 'speak').mockResolvedValue('id');
    let tts;
    try {
      tts = createTtsEngine()!;
    } finally {
      names.forEach((n, i) => (Speech[n] = orig[i]));
    }
    const done = jest.fn();
    tts.onDone(done);
    await tts.speak('하나. 둘. 셋.');
    handlers.onFinish();
    handlers.onError(); // 한 문장 오류도 끝난 것으로 센다
    expect(done).not.toHaveBeenCalled();
    handlers.onFinish();
    expect(done).toHaveBeenCalledTimes(1);
    await tts.speak('넷. 다섯.');
    handlers.onStopped();
    expect(done).toHaveBeenCalledTimes(2);
  });

  test('첫 문장부터 못 넣으면 실패를 돌려준다(화면이 "지금은 읽어 드릴 수 없어요")', async () => {
    jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([]);
    jest.spyOn(Speech, 'speak').mockRejectedValue(new Error('x'));
    await expect(createTtsEngine()!.speak('하나. 둘.')).rejects.toThrow('x');
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

