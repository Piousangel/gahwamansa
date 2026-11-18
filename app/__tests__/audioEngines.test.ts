import {Platform} from 'react-native';
import {createTtsEngine, getRinger, loadSfx} from '../src/audio/engines';
import {newStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {setPrefsForTest, createPrefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

// 네이티브 라이브러리 연결(jest.setup 의 모의로): 벨소리 값 변환·실패 시 조용한 쪽, TTS 한국어 음성 판정·옵션, 도장 소리 연결.
const vm = require('react-native-volume-manager');
const Speech = require('@mhpdev/react-native-speech').default;
const Sound = require('react-native-sound').default;

beforeEach(() => {
  Platform.OS = 'android';
  setPrefsForTest(createPrefs(memoryStore()));
  setStampFeedbackForTest(null);
});

test('벨소리: 2 → normal, 0 → silent, 실패 → unknown', async () => {
  vm.getRingerMode.mockResolvedValueOnce(2);
  expect(await getRinger()).toBe('normal');
  vm.getRingerMode.mockResolvedValueOnce(0);
  expect(await getRinger()).toBe('silent');
  vm.getRingerMode.mockRejectedValueOnce(new Error('x'));
  expect(await getRinger()).toBe('unknown');
});

test('TTS: 한국어 음성이 있으면 ko-KR·덕킹으로 말하고, 음성 목록은 한 번만 묻는다', async () => {
  const voices = jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([{language: 'ko-KR'}]);
  const speak = jest.spyOn(Speech, 'speak').mockResolvedValue('id');
  const tts = createTtsEngine()!;
  expect(await tts.hasKorean()).toBe(true);
  expect(await tts.hasKorean()).toBe(true);
  expect(voices).toHaveBeenCalledTimes(1);
  expect(voices).toHaveBeenCalledWith('ko');
  await tts.speak('사진');
  expect(speak).toHaveBeenCalledWith('사진', expect.objectContaining({language: 'ko-KR', ducking: true}));
});

test('TTS: 한국어 음성이 없으면 false', async () => {
  jest.spyOn(Speech, 'getAvailableVoices').mockResolvedValue([]);
  expect(await createTtsEngine()!.hasKorean()).toBe(false);
});

test('효과음: Ambient·다른 앱과 섞기로 열고 재생한다', () => {
  const h = loadSfx('stamp')!;
  expect(Sound.setCategory).toHaveBeenCalledWith('Ambient', true);
  h.play();
  const s = Sound.__instances[Sound.__instances.length - 1];
  expect(s.play).toHaveBeenCalledTimes(1);
});

test('도장 피드백 기본 연결: 벨소리 보통이면 도장 소리, 무음이면 소리 없음', async () => {
  vm.getRingerMode.mockResolvedValue(2);
  expect((await newStampFeedback().fire()).sound).toBe(true);
  vm.getRingerMode.mockResolvedValue(0);
  expect((await newStampFeedback().fire()).sound).toBe(false);
  vm.getRingerMode.mockResolvedValue(2);
});
