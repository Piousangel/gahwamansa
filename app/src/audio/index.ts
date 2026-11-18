// 공용 오디오 모듈 입구(AU-03). 화면은 useReadAloud(읽어 주기)·useBgm(배경 음악), 효과음은 audio().sfx(이름) + lib/audioPolicy sfxAllowed.
export {audio, setAudioForTest, bindAppLifecycle} from './instance';
export {useAudioInputs, useBgm, useReadAloud, useSpeaking} from './hooks';
export {getMediaVolume} from './engines';
export type {Audio, SpeakResult, SfxName, SoundHandle} from './audioCore';
