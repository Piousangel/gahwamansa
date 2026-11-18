// 공용 오디오 모듈 입구(AU-03). 화면은 audio().speak · stopSpeaking · playSfx, 배경 음악은 useBgm 만 쓴다.
export {audio, setAudioForTest} from './instance';
export {useAudioInputs, useBgm, useSpeaking} from './hooks';
export type {Audio, SpeakResult, SfxName, SoundHandle} from './audioCore';
