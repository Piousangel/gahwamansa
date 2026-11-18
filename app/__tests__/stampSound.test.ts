// AP-02 도장 소리: P7 기본 연결(newStampFeedback)이 공용 오디오 모듈의 '도장' 소리 장치를 실제로 쓴다.
// 못 열면 촉각만, 설정 꺼짐·무음/진동·읽어 주는 중이면 소리 없음(판단은 audioPolicy sfxAllowed 한 곳).
import {createAudio, type SoundHandle, type TtsEngine} from '../src/audio/audioCore';
import {setAudioForTest} from '../src/audio/instance';
import {newStampFeedback} from '../src/features/course/stampFeedback';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

const handle = (): SoundHandle & {play: jest.Mock} => ({play: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), setLoops: jest.fn(), release: jest.fn()});
const tts = (): TtsEngine => ({hasKorean: async () => true, speak: async () => {}, stop: async () => {}, onStart: () => () => {}, onDone: () => () => {}});

afterEach(() => {
  setAudioForTest(null);
  setPrefsForTest(null);
  jest.restoreAllMocks();
});

test('기본 연결: 벨소리 보통 + 도장 소리 켜짐이면 공용 모듈의 stamp 장치로 한 번 낸다', async () => {
  const h = handle();
  const load = jest.fn(() => h);
  setAudioForTest(createAudio({tts: tts(), loadSfx: load}));
  setPrefsForTest(createPrefs(memoryStore()));
  const fb = newStampFeedback();
  expect(await fb.fire()).toEqual({sound: true, haptic: true});
  expect(load).toHaveBeenCalledWith('stamp');
  expect(h.play).toHaveBeenCalledTimes(1);
  expect(await fb.fire()).toEqual({sound: false, haptic: false}); // 한 번의 연출에 한 번
});

test('소리 장치를 못 열면(로드 실패) 촉각만', async () => {
  setAudioForTest(createAudio({tts: tts(), loadSfx: () => null}));
  setPrefsForTest(createPrefs(memoryStore()));
  expect(await newStampFeedback().fire()).toEqual({sound: false, haptic: true});
});

test('설정 도장 소리 꺼짐이면 소리 없음(무음·진동 판단은 audioPolicy 단위 테스트, jest 는 iOS 라 벨소리 = 보통)', async () => {
  const h = handle();
  setAudioForTest(createAudio({tts: tts(), loadSfx: () => h}));
  const p = createPrefs(memoryStore());
  await p.setSfxEnabled(false);
  setPrefsForTest(p);
  expect(await newStampFeedback().fire()).toEqual({sound: false, haptic: true});
  expect(h.play).not.toHaveBeenCalled();
});
