import {createAudio, ringerFromNative, type TtsEngine, type SoundHandle} from '../src/audio/audioCore';
import {BGM_DUCK_VOLUME, readAloudAllowed} from '../src/lib/audioPolicy';
import {createPrefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

// 공용 오디오 모듈(AU-03, dev-audio-spike 5절): 화면은 speak·playSfx·bgm 만 부른다.
// 정책: 읽어 주기는 사용자가 직접 누른 소리라 무음·진동 모드에서도 허용, 화면 읽기 켜짐이면 막음(R16).
//       효과음은 설정 켜짐 + 벨소리 모드 + 읽어 주기 중 아님. 읽어 주는 동안 배경 음악 10%(덕킹).

function fakeTts(over: Partial<TtsEngine> = {}) {
  const handlers: {start?: () => void; done?: () => void} = {};
  const engine: TtsEngine & {handlers: typeof handlers} = {
    handlers,
    hasKorean: jest.fn(async () => true),
    speak: jest.fn(async () => {
      handlers.start?.();
    }),
    stop: jest.fn(async () => {
      handlers.done?.();
    }),
    onStart: cb => {
      handlers.start = cb;
      return () => {};
    },
    onDone: cb => {
      handlers.done = cb;
      return () => {};
    },
    ...over,
  };
  return engine;
}
function fakeSound(): SoundHandle & {play: jest.Mock; setVolume: jest.Mock; stop: jest.Mock} {
  return {play: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), setLoops: jest.fn(), release: jest.fn()};
}
function setup(over: {ringer?: Awaited<ReturnType<Parameters<typeof createAudio>[0]['ringer']>>; tts?: TtsEngine | null} = {}) {
  const tts = over.tts === undefined ? fakeTts() : over.tts;
  const stamp = fakeSound();
  const prefs = createPrefs(memoryStore());
  const audio = createAudio({
    tts,
    ringer: async () => over.ringer ?? 'normal',
    loadSfx: () => stamp,
    prefs,
  });
  return {audio, tts: tts as ReturnType<typeof fakeTts> | null, stamp, prefs};
}

describe('벨소리 모드 변환', () => {
  test('0 무음 · 1 진동 · 2 보통, 그 밖은 모름', () => {
    expect(ringerFromNative(0)).toBe('silent');
    expect(ringerFromNative(1)).toBe('vibrate');
    expect(ringerFromNative(2)).toBe('normal');
    expect(ringerFromNative(undefined)).toBe('unknown');
    expect(ringerFromNative(7)).toBe('unknown');
  });
});

describe('읽어 주기(speak)', () => {
  test('화면 읽기가 꺼져 있으면 한국어로 말하고, 말하는 동안 isSpeaking', async () => {
    const {audio, tts} = setup();
    expect(await audio.speak('사진을 보세요', {screenReader: false})).toBe('spoken');
    expect(tts!.speak).toHaveBeenCalledWith('사진을 보세요');
    expect(audio.isSpeaking()).toBe(true);
    tts!.handlers.done?.();
    expect(audio.isSpeaking()).toBe(false);
  });
  test('무음·진동 모드에서도 읽어 준다(사용자가 직접 누른 소리)', async () => {
    for (const ringer of ['silent', 'vibrate', 'unknown'] as const) {
      const {audio} = setup({ringer});
      expect(await audio.speak('글자', {screenReader: false})).toBe('spoken');
    }
  });
  test('화면 읽기가 켜져 있으면 말하지 않는다(R16, SunBubble 과 같은 판단)', async () => {
    const {audio, tts} = setup();
    expect(readAloudAllowed(true)).toBe(false);
    expect(await audio.speak('글자', {screenReader: true})).toBe('blocked');
    expect(tts!.speak).not.toHaveBeenCalled();
  });
  test('엔진이 없거나 한국어 음성이 없으면 이유를 돌려준다(화면이 배너로 안내)', async () => {
    expect(await setup({tts: null}).audio.speak('a', {screenReader: false})).toBe('unavailable');
    const noKo = setup({tts: fakeTts({hasKorean: jest.fn(async () => false)})});
    expect(await noKo.audio.speak('a', {screenReader: false})).toBe('no_korean_voice');
    expect(noKo.audio.isSpeaking()).toBe(false);
  });
  test('엔진이 실패하면 말하는 중 상태를 풀고 failed', async () => {
    const {audio} = setup({tts: fakeTts({speak: jest.fn(async () => Promise.reject(new Error('x')))})});
    expect(await audio.speak('a', {screenReader: false})).toBe('failed');
    expect(audio.isSpeaking()).toBe(false);
  });
  test('stopSpeaking 은 엔진을 멈추고 상태를 푼다', async () => {
    const {audio, tts} = setup();
    await audio.speak('a', {screenReader: false});
    await audio.stopSpeaking();
    expect(tts!.stop).toHaveBeenCalled();
    expect(audio.isSpeaking()).toBe(false);
  });
});

describe('효과음(playSfx)', () => {
  test('설정 켜짐 + 벨소리 보통일 때만 울린다', async () => {
    const a = setup();
    expect(await a.audio.playSfx('stamp')).toBe(true);
    expect(a.stamp.play).toHaveBeenCalledTimes(1);
    for (const ringer of ['silent', 'vibrate', 'unknown'] as const) {
      const b = setup({ringer});
      expect(await b.audio.playSfx('stamp')).toBe(false);
      expect(b.stamp.play).not.toHaveBeenCalled();
    }
    const c = setup();
    await c.prefs.setSfxEnabled(false);
    expect(await c.audio.playSfx('stamp')).toBe(false);
  });
  test('읽어 주는 중에는 울리지 않는다', async () => {
    const {audio, stamp} = setup();
    await audio.speak('a', {screenReader: false});
    expect(await audio.playSfx('stamp')).toBe(false);
    expect(stamp.play).not.toHaveBeenCalled();
  });
  test('소리 파일을 못 읽거나 재생이 실패해도 throw 하지 않는다', async () => {
    const prefs = createPrefs(memoryStore());
    const none = createAudio({tts: null, ringer: async () => 'normal', loadSfx: () => null, prefs});
    expect(await none.playSfx('stamp')).toBe(false);
    const bad = createAudio({
      tts: null,
      ringer: async () => 'normal',
      loadSfx: () => ({...fakeSound(), play: () => { throw new Error('x'); }}),
      prefs,
    });
    expect(await bad.playSfx('stamp')).toBe(false);
  });
});

describe('배경 음악 덕킹(bgm)', () => {
  test('읽어 주는 동안 10%, 끝나면 원래 크기', async () => {
    const {audio, tts} = setup();
    const track = fakeSound();
    const bgm = audio.bgm(track);
    bgm.play();
    expect(track.setLoops).toHaveBeenCalledWith(-1);
    expect(track.setVolume).toHaveBeenLastCalledWith(1);
    await audio.speak('a', {screenReader: false});
    expect(track.setVolume).toHaveBeenLastCalledWith(BGM_DUCK_VOLUME);
    expect(BGM_DUCK_VOLUME).toBe(0.1);
    tts!.handlers.done?.();
    expect(track.setVolume).toHaveBeenLastCalledWith(1);
    bgm.stop();
    expect(track.stop).toHaveBeenCalled();
  });
  test('정지 뒤에는 읽어 주기가 와도 볼륨을 건드리지 않는다', async () => {
    const {audio} = setup();
    const track = fakeSound();
    const bgm = audio.bgm(track);
    bgm.play();
    bgm.stop();
    track.setVolume.mockClear();
    await audio.speak('a', {screenReader: false});
    expect(track.setVolume).not.toHaveBeenCalled();
  });
});
