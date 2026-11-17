// 소리 정책(U1 오디오 스파이크, docs/team/dev-audio-spike.md). 라이브러리와 무관한 순수 함수:
// 입력 상태 → 음악(BGM)·효과음·읽어 주기(TTS)를 어떻게 할지. 네이티브 연결은 라이브러리 승인 뒤 이 결과만 따른다.
// 근거: DECISIONS 11-17 배경 음악(기본 꺼짐, 코스 홈·완료 화면만, 읽어주기 시 멈춤/줄임), bgm-proposal(무음 모드·이어폰·백그라운드 즉시 정지),
//       TalkBack 명세 R16(화면 읽기 켜짐이면 '읽어 주세요' 숨김, 음악 자동 정지).

export type Ringer = 'normal' | 'vibrate' | 'silent' | 'unknown';

export type AudioInputs = {
  /** 설정의 음악 켜기(기본 false) */
  bgmEnabled: boolean;
  /** 지금 화면이 음악을 트는 화면인가(코스 홈·완료) */
  bgmScreen: boolean;
  /** Android 벨소리 모드. iOS 는 Ambient 카테고리가 무음 스위치를 따르므로 'normal' 로 넘긴다 */
  ringer: Ringer;
  screenReader: boolean;
  ttsSpeaking: boolean;
  appActive: boolean;
  /** 이어폰·블루투스가 빠짐(Android AUDIO_BECOMING_NOISY) */
  outputLost: boolean;
};

export type AudioDecision = {
  bgm: 'play' | 'stop';
  /** 0~1. 읽어 주는 동안 덕킹 */
  bgmVolume: number;
  sfx: boolean;
  /** '읽어 주세요' 버튼을 보여 주고 말할 수 있는가 */
  ttsAllowed: boolean;
};

/** 읽어 주는 동안 음악 크기(bgm-proposal: 10% 이하). */
export const BGM_DUCK_VOLUME = 0.1;

export function audioPolicy(i: AudioInputs): AudioDecision {
  if (!i.appActive) {
    return {bgm: 'stop', bgmVolume: 1, sfx: false, ttsAllowed: false};
  }
  // 모르면 조용한 쪽(공공장소에서 갑자기 소리 나는 것이 가장 큰 위험)
  const quiet = i.ringer !== 'normal';
  const bgmOn = i.bgmEnabled && i.bgmScreen && !quiet && !i.screenReader && !i.outputLost;
  return {
    bgm: bgmOn ? 'play' : 'stop',
    bgmVolume: i.ttsSpeaking ? BGM_DUCK_VOLUME : 1,
    sfx: !quiet,
    // 읽어 주기는 사용자가 직접 누른 소리라 무음 모드에서도 허용. 화면 읽기와는 겹치므로 숨김(R16)
    ttsAllowed: !i.screenReader,
  };
}
