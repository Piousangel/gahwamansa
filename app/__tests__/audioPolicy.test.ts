import {audioPolicy, AudioInputs, BGM_DUCK_VOLUME} from '../src/lib/audioPolicy';

const base: AudioInputs = {
  bgmEnabled: true,
  bgmScreen: true,
  ringer: 'normal',
  screenReader: false,
  ttsSpeaking: false,
  appActive: true,
  outputLost: false,
};

describe('audioPolicy(소리 정책, 의존성 없는 순수 로직)', () => {
  test('기본: 음악 켬·효과음 켬·읽어 주기 가능', () => {
    expect(audioPolicy(base)).toEqual({bgm: 'play', bgmVolume: 1, sfx: true, ttsAllowed: true});
  });

  test('덕킹: 읽어 주는 동안 음악은 5% 이하로 줄였다가 끝나면 원래대로', () => {
    const p = audioPolicy({...base, ttsSpeaking: true});
    expect(p.bgm).toBe('play');
    expect(p.bgmVolume).toBe(BGM_DUCK_VOLUME);
    expect(BGM_DUCK_VOLUME).toBeLessThanOrEqual(0.05);
    expect(audioPolicy({...base, ttsSpeaking: false}).bgmVolume).toBe(1);
  });

  test('무음·진동 모드: 음악·효과음 끔, 읽어 주기는 사용자가 누른 것이라 허용', () => {
    for (const ringer of ['silent', 'vibrate'] as const) {
      const p = audioPolicy({...base, ringer});
      expect(p.bgm).toBe('stop');
      expect(p.sfx).toBe(false);
      expect(p.ttsAllowed).toBe(true);
    }
  });

  test('화면 읽기 켜짐(TalkBack R16): 음악 자동 정지, 읽어 주기 숨김(소리 겹침), 효과음은 유지', () => {
    const p = audioPolicy({...base, screenReader: true});
    expect(p.bgm).toBe('stop');
    expect(p.ttsAllowed).toBe(false);
    expect(p.sfx).toBe(true);
  });

  test('음악 꺼짐 설정(기본 꺼짐)·음악 없는 화면이면 정지', () => {
    expect(audioPolicy({...base, bgmEnabled: false}).bgm).toBe('stop');
    expect(audioPolicy({...base, bgmScreen: false}).bgm).toBe('stop');
  });

  test('앱이 뒤로 가거나 이어폰이 빠지면 즉시 정지(다시 켜지 않음은 호출부가 bgmEnabled 로)', () => {
    expect(audioPolicy({...base, appActive: false})).toEqual({bgm: 'stop', bgmVolume: 1, sfx: false, ttsAllowed: false});
    expect(audioPolicy({...base, outputLost: true}).bgm).toBe('stop');
  });

  test('벨소리 상태를 모르면(권한·기기 차이) 조용한 쪽으로: 음악·효과음 끔', () => {
    const p = audioPolicy({...base, ringer: 'unknown'});
    expect(p.bgm).toBe('stop');
    expect(p.sfx).toBe(false);
  });
});
