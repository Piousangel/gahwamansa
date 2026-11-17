import {createPrefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createStampFeedback, stampSoundAllowed} from '../src/features/course/stampFeedback';

// P7 완료감(시안 P7_motion): 도장이 닿는 순간 시스템 촉각 1회 + 나무 도장 소리 1회.
// 소리는 설정 '효과음'이 켜져 있고, 무음·진동 모드가 아니고, 읽어 주기 중이 아닐 때만. 촉각은 움직임이 아니라 동작 줄이기에서도 유지.

describe('설정 저장(prefs)', () => {
  test('효과음 기본 켜짐, 끄면 저장된다. 건너뛰기 안내는 첫 1회', async () => {
    const p = createPrefs(memoryStore());
    expect(await p.sfxEnabled()).toBe(true);
    await p.setSfxEnabled(false);
    expect(await p.sfxEnabled()).toBe(false);
    expect(await p.skipHintSeen()).toBe(false);
    await p.markSkipHintSeen();
    expect(await p.skipHintSeen()).toBe(true);
  });
  test('손상된 값은 기본값', async () => {
    const s = memoryStore();
    await s.setItem('pref_sfx_enabled', '???');
    expect(await createPrefs(s).sfxEnabled()).toBe(true);
  });
});

describe('소리 허용 판단', () => {
  test('효과음 켜짐 + 벨소리 모드 + 읽어 주기 아님일 때만', () => {
    expect(stampSoundAllowed({sfxEnabled: true, ringer: 'normal', ttsSpeaking: false})).toBe(true);
    expect(stampSoundAllowed({sfxEnabled: false, ringer: 'normal', ttsSpeaking: false})).toBe(false);
    expect(stampSoundAllowed({sfxEnabled: true, ringer: 'silent', ttsSpeaking: false})).toBe(false);
    expect(stampSoundAllowed({sfxEnabled: true, ringer: 'vibrate', ttsSpeaking: false})).toBe(false);
    expect(stampSoundAllowed({sfxEnabled: true, ringer: 'unknown', ttsSpeaking: false})).toBe(false); // 모르면 조용히
    expect(stampSoundAllowed({sfxEnabled: true, ringer: 'normal', ttsSpeaking: true})).toBe(false);
  });
});

describe('도장 피드백 실행', () => {
  function deps(over: Partial<Parameters<typeof createStampFeedback>[0]> = {}) {
    const play = jest.fn();
    const vibrate = jest.fn();
    const prefs = createPrefs(memoryStore());
    const fb = createStampFeedback({
      player: {playStamp: play},
      vibrate,
      ringer: async () => 'normal',
      ttsSpeaking: () => false,
      prefs,
      ...over,
    });
    return {fb, play, vibrate, prefs};
  }
  test('한 번 부르면 촉각 1회 + 소리 1회, 같은 피드백을 두 번 불러도 한 번만', async () => {
    const {fb, play, vibrate} = deps();
    expect(await fb.fire()).toEqual({sound: true, haptic: true});
    await fb.fire();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });
  test('효과음을 끄면 촉각만', async () => {
    const {fb, play, vibrate, prefs} = deps();
    await prefs.setSfxEnabled(false);
    expect(await fb.fire()).toEqual({sound: false, haptic: true});
    expect(play).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
  test('무음 모드·읽어 주기 중이면 소리 없음', async () => {
    const a = deps({ringer: async () => 'silent'});
    expect((await a.fb.fire()).sound).toBe(false);
    const b = deps({ttsSpeaking: () => true});
    expect((await b.fb.fire()).sound).toBe(false);
  });
  test('소리 장치가 없거나(라이브러리 미설치) 실패해도 화면을 막지 않는다', async () => {
    const a = deps({player: null});
    expect(await a.fb.fire()).toEqual({sound: false, haptic: true});
    const b = deps({
      player: {
        playStamp: () => {
          throw new Error('x');
        },
      },
      vibrate: () => {
        throw new Error('y');
      },
    });
    await expect(b.fb.fire()).resolves.toEqual({sound: false, haptic: false});
  });
});
