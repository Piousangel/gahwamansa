// 미리 생성 음성 찾기(DECISIONS 11-19 "미리 생성 음성 빌드 1에 넣음"). React·네이티브를 모른다.
// 문장(readText.splitSentences 결과) → 번들 자산 번호. 없으면 null → audioCore 가 기기 TTS 로 읽는다.
// 자산 목록은 scripts/tts/synth.mjs --install 이 voiceClips.generated.ts 로 만든다(문장 원문이 키, 파일 이름은 문장 해시).
import {normalizeSentence} from './readText';
import {VOICE_CLIPS} from './voiceClips.generated';

let table: Record<string, number | string> = VOICE_CLIPS;

export function lookupClip(sentence: string): number | string | null {
  return table[normalizeSentence(sentence)] ?? null;
}

/** 미리 생성 음성이 하나라도 있는가(앱 정보 'AI 음성' 고지를 이때만 보인다) */
export function hasVoiceClips(): boolean {
  return Object.keys(table).length > 0;
}

/** 테스트용: 문장 → 자산 표를 바꾼다(null 이면 생성 파일로 되돌림) */
export function setVoiceClipsForTest(next: Record<string, number | string> | null) {
  table = next ?? VOICE_CLIPS;
}
