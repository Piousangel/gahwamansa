// 미리 생성 음성(DECISIONS 11-19): 문장마다 파일이 다 있으면 파일 재생, 하나라도 없으면 글 전체를 기기 TTS 로.
import {Image} from 'react-native';
import {createAudio, type ClipPlayer, type TtsEngine} from '../src/audio/audioCore';
import {createClipPlayer} from '../src/audio/engines';
import {hasVoiceClips, lookupClip, setVoiceClipsForTest} from '../src/audio/voiceClips';
import {VOICE_CLIPS} from '../src/audio/voiceClips.generated';

const Sound = require('react-native-sound').default;
const lastSound = () => Sound.__instances[Sound.__instances.length - 1];
const flush = () => new Promise<void>(r => setImmediate(() => r()));

type FakeTts = TtsEngine & {hasKorean: jest.Mock; speak: jest.Mock; stop: jest.Mock; done: () => void; korean: boolean};
function fakeTts(): FakeTts {
  const doneL = new Set<() => void>();
  const t: FakeTts = {
    korean: true,
    hasKorean: jest.fn(async () => t.korean),
    speak: jest.fn(async () => {}),
    stop: jest.fn(async () => {
      doneL.forEach(f => f());
    }),
    onStart: () => () => {},
    onDone: (cb: () => void) => {
      doneL.add(cb);
      return () => {
        doneL.delete(cb);
      };
    },
    done: () => doneL.forEach(f => f()),
  };
  return t;
}

/** 재생을 손으로 끝내는 가짜 재생기 */
function fakeClips(table: Record<string, string>) {
  const pending: {asset: number | string; end: (ok: boolean) => void}[] = [];
  const clips: ClipPlayer & {pending: typeof pending; stop: jest.Mock} = {
    pending,
    lookup: s => table[s] ?? null,
    play: asset => new Promise<boolean>(end => pending.push({asset, end})),
    stop: jest.fn(() => pending.splice(0).forEach(p => p.end(false))),
  };
  return clips;
}

const TABLE = {'가족이 보낸 응원이에요.': 'a.mp3', '늘 고마워요': 'b.mp3'};

describe('audioCore + 미리 생성 음성', () => {
  test('모든 문장에 파일이 있으면 차례로 재생하고, 끝나면 말하는 중이 풀린다(기기 TTS 는 안 씀)', async () => {
    const tts = fakeTts();
    const clips = fakeClips(TABLE);
    const a = createAudio({tts, clips, loadSfx: () => null});
    expect(await a.speak('가족이 보낸 응원이에요. 늘 고마워요', {screenReader: false})).toBe('spoken');
    expect(a.isSpeaking()).toBe(true);
    await flush();
    expect(clips.pending.map(p => p.asset)).toEqual(['a.mp3']);
    clips.pending.shift()!.end(true);
    await flush();
    expect(clips.pending.map(p => p.asset)).toEqual(['b.mp3']);
    expect(a.isSpeaking()).toBe(true); // 문장 사이에 덕킹이 풀리지 않음
    clips.pending.shift()!.end(true);
    await flush();
    expect(a.isSpeaking()).toBe(false);
    expect(tts.speak).not.toHaveBeenCalled();
    expect(tts.hasKorean).not.toHaveBeenCalled(); // 한국어 기기 음성이 없어도 파일은 읽는다
  });

  test('한 문장이라도 파일이 없으면 글 전체를 기기 TTS 로(목소리가 섞이지 않게)', async () => {
    const tts = fakeTts();
    const clips = fakeClips(TABLE);
    const a = createAudio({tts, clips, loadSfx: () => null});
    await a.speak('가족이 보낸 응원이에요. 덕분에 하루가 따뜻해요', {screenReader: false});
    expect(tts.speak).toHaveBeenCalledWith('가족이 보낸 응원이에요. 덕분에 하루가 따뜻해요');
    expect(clips.pending).toHaveLength(0);
  });

  test('재생 중 파일이 실패하면 남은 문장을 기기 TTS 로 잇는다', async () => {
    const tts = fakeTts();
    const clips = fakeClips(TABLE);
    const a = createAudio({tts, clips, loadSfx: () => null});
    await a.speak('가족이 보낸 응원이에요. 늘 고마워요', {screenReader: false});
    await flush();
    clips.pending.shift()!.end(true);
    await flush();
    clips.pending.shift()!.end(false);
    await flush();
    expect(tts.speak).toHaveBeenCalledWith('늘 고마워요');
    expect(a.isSpeaking()).toBe(true);
    tts.done();
    expect(a.isSpeaking()).toBe(false);
  });

  test('멈추면 재생기를 멈추고 다음 문장으로 가지 않는다', async () => {
    const tts = fakeTts();
    const clips = fakeClips(TABLE);
    const a = createAudio({tts, clips, loadSfx: () => null});
    await a.speak('가족이 보낸 응원이에요. 늘 고마워요', {screenReader: false});
    await flush();
    await a.stopSpeaking();
    await flush();
    expect(clips.stop).toHaveBeenCalled();
    expect(clips.pending).toHaveLength(0);
    expect(tts.speak).not.toHaveBeenCalled(); // 멈춤을 실패로 보고 TTS 로 잇지 않음
    expect(a.isSpeaking()).toBe(false);
  });

  test('파일 재생 중 새로 읽으면 이전 재생을 끝내고 새 글만 읽는다', async () => {
    const tts = fakeTts();
    const clips = fakeClips(TABLE);
    const a = createAudio({tts, clips, loadSfx: () => null});
    await a.speak('가족이 보낸 응원이에요. 늘 고마워요', {screenReader: false});
    await flush();
    await a.speak('늘 고마워요', {screenReader: false});
    await flush();
    expect(clips.pending.map(p => p.asset)).toEqual(['b.mp3']);
    clips.pending.shift()!.end(true);
    await flush();
    expect(clips.pending).toHaveLength(0);
    expect(a.isSpeaking()).toBe(false);
  });

  test('화면 읽기가 켜져 있으면 파일이 있어도 막는다', async () => {
    const clips = fakeClips(TABLE);
    const a = createAudio({tts: fakeTts(), clips, loadSfx: () => null});
    expect(await a.speak('늘 고마워요', {screenReader: true})).toBe('blocked');
    expect(clips.pending).toHaveLength(0);
  });

  test('기기 TTS 가 없어도 파일이 있으면 읽는다', async () => {
    const a = createAudio({tts: null, clips: fakeClips(TABLE), loadSfx: () => null});
    expect(await a.speak('늘 고마워요', {screenReader: false})).toBe('spoken');
  });
});

describe('문장 → 자산 표(voiceClips)', () => {
  afterEach(() => setVoiceClipsForTest(null));
  test('생성 파일이 비어 있으면 아무것도 없다(보이스를 고르기 전 = 모두 기기 TTS)', () => {
    expect(VOICE_CLIPS).toEqual({});
    expect(hasVoiceClips()).toBe(false);
    expect(lookupClip('늘 고마워요')).toBeNull();
  });
  test('공백을 맞춰 찾는다', () => {
    setVoiceClipsForTest({'늘 고마워요': 7});
    expect(hasVoiceClips()).toBe(true);
    expect(lookupClip('  늘   고마워요 ')).toBe(7);
  });
});

describe('createClipPlayer(react-native-sound)', () => {
  afterEach(() => jest.restoreAllMocks());
  test('자산 번호를 문자열 주소로 열고, 끝 콜백에서 true 와 함께 해제한다', async () => {
    jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({uri: 'src_assets_voice_ab12', width: 0, height: 0, scale: 1});
    const p = createClipPlayer(() => null);
    const done = p.play(3);
    const s = lastSound();
    expect(s.asset).toBe('src_assets_voice_ab12');
    expect(s.basePath).toBeUndefined();
    expect(s.play).toHaveBeenCalledTimes(1);
    s.play.mock.calls[0][0](true);
    expect(await done).toBe(true);
    expect(s.release).toHaveBeenCalled();
  });
  test('멈추면 기다리던 재생은 false', async () => {
    const p = createClipPlayer(() => null);
    const done = p.play('src_assets_voice_cd34');
    p.stop();
    expect(await done).toBe(false);
    expect(lastSound().stop).toHaveBeenCalled();
  });
  test('주소를 못 풀면 false(던지지 않음)', async () => {
    jest.spyOn(Image, 'resolveAssetSource').mockReturnValue(null as never);
    expect(await createClipPlayer(() => null).play(3)).toBe(false);
  });
});
