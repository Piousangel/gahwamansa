// 조사 자동(라이터 확정 docs/team/copy/2026-11-25-five-steps-copy.md 2절). React 를 모른다(lib 규칙).
// 값의 마지막 글자가 한글 완성형(가~힣)이면 (code - 0xAC00) % 28 로 받침을 본다. ㄹ 받침도 '을'(으로/로만 ㄹ 을 따로 다룬다).
// 한글로 끝나지 않으면(영문·숫자·빈 값) null — 부르는 쪽은 그 줄을 그리지 않는다('을(를)' 꼴은 쓰지 않는다).
// {호칭} 뒤에는 쓰지 않는다(호칭은 조사 없이 잇는다, copyBan).

const FIRST = 0xac00;
const LAST = 0xd7a3;

/** 마지막 글자에 받침이 있나. 한글 완성형으로 끝나지 않으면 null */
export function hasFinalConsonant(word: string): boolean | null {
  const w = word.normalize('NFC').trim();
  if (!w) {
    return null;
  }
  const code = w.charCodeAt(w.length - 1);
  if (code < FIRST || code > LAST) {
    return null;
  }
  return (code - FIRST) % 28 !== 0;
}

/** 목적격 조사 '을'·'를'. 판정할 수 없으면 null */
export function objectParticle(word: string): '을' | '를' | null {
  const f = hasFinalConsonant(word);
  return f === null ? null : f ? '을' : '를';
}

/**
 * 문장 틀의 {값}{을를} 자리를 채운다. 예: fillObject('사진 보고 {떠올린 것}{을를} 떠올리셨어요', '떠올린 것', '누룽지')
 * → '사진 보고 누룽지를 떠올리셨어요'. 조사를 정할 수 없으면 null(줄 생략)
 */
export function fillObject(template: string, slot: string, value: string): string | null {
  const p = objectParticle(value);
  if (p === null) {
    return null;
  }
  return template.split(`{${slot}}{을를}`).join(`${value.normalize('NFC').trim()}${p}`);
}
