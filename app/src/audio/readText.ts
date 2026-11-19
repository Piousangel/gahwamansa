// 읽어 주기 문장 만들기·나누기(순수 함수, React·네이티브·copy 를 모른다).
// 앱(ReadAloud·audioCore)과 미리 생성 음성 스크립트(scripts/tts, node 타입 지우기로 이 파일을 그대로 import)가 같이 쓴다.
// → 앱이 읽는 문장과 스크립트가 만드는 음성 파일의 문장이 글자 하나까지 같아야 파일을 찾는다. 그래서 import 없이,
//   지울 수 있는 타입 문법만 쓴다(enum·namespace·매개변수 속성 금지).

/** copy tts.read 문장 틀 */
export type ReadTemplates = {photo: string; question: string; word: string; cheer: string};

const fill = (tpl: string, vars: Record<string, string>): string =>
  Object.keys(vars).reduce((s, k) => s.split(`{${k}}`).join(vars[k]), tpl);

/** 화면별 읽을 글. 응원은 여러 개면 줄바꿈으로 이어 문장마다 나눠 읽게 한다. */
export function readTextBuilders(t: ReadTemplates) {
  return {
    photo: (qs: string[]) => fill(t.photo, {질문1: qs[0] ?? '', 질문2: qs[1] ?? ''}).trim(),
    question: (prompt: string, a: string, b: string) => fill(t.question, {질문: prompt, 선택지1: a, 선택지2: b}),
    word: (word: string, letters: string[]) => fill(t.word, {낱말: word, 글자들: letters.join(', ')}),
    cheer: (lines: string | string[]) => fill(t.cheer, {응원: Array.isArray(lines) ? lines.join('\n') : lines}),
  };
}

const ENDERS = '.?!。？！…';
const SPACE = /\s/;
/** 글자·숫자가 하나라도 있는 조각만 문장으로 친다(기호만 남은 조각은 버림) */
const HAS_WORD = /[0-9A-Za-zᄀ-ᇿ㄰-㆏가-힣一-鿿]/;

/**
 * 문장 단위로 나눈다(기기 TTS 는 문장마다 따로 말하게 해 쉼을 만들고, 미리 생성 음성은 문장마다 파일 하나).
 * 기준: 줄바꿈, 또는 마침표·물음표·느낌표·말줄임표 뒤의 공백. "한 글자씩, 학, 교, 종." 처럼 쉼표는 나누지 않는다.
 * 각 문장은 공백을 하나로 줄이고 앞뒤를 자른다(normalizeSentence). 정규식 뒤보기·유니코드 속성은 쓰지 않는다(Hermes 호환).
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  const flush = () => {
    const s = normalizeSentence(cur);
    if (HAS_WORD.test(s)) {
      out.push(s);
    }
    cur = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') {
      flush();
      continue;
    }
    cur += ch;
    if (ENDERS.includes(ch) && i + 1 < text.length && SPACE.test(text[i + 1]) && !ENDERS.includes(text[i + 1])) {
      flush();
    }
  }
  flush();
  return out;
}

/** 문장 비교·파일 찾기 기준: 공백을 하나로, 앞뒤 공백 제거 */
export function normalizeSentence(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
