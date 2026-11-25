// 어르신 행동 높임(PR #291, writer.md 1-3): 문구 원본에 어르신이 한 선택을 낮춰 부르는 '고른'·'골랐'이 다시 들어오면 실패한다.
// 쓸 말: '고르신 답', '고르셨어요', '{호칭}께서 고르신'. 자녀 자신의 선택은 '고른'이 들어갈 자리가 없게 쓴다(예: '이름을 골라 주세요').
// 예외: 동의 거절 뒤 안내 1키(P2 v6 초안 1절 — 동의 범위 밖이라 앱 전체 높임 맞추기 때 함께, 5절 남은 일)와 자리값 이름 {고른 쪽}(보이는 글 아님, 서버 0061과 같은 이름).
// P2 v6(11-26)에서 consent.title·body[0] 은 '고르신'이 되어 예외에서 뺐다.
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

const SRC = path.join(__dirname, '../../docs/team/copy.ko.json');
const LOWERED = /고른|골랐/;
const LEGAL_EXCEPT = new Set(['consent.declined_detail']);

/** 보이는 글(이름이 '_'로 시작하는 메모 키 제외)에서 어르신 행동 낮춤이 남은 키 */
export function loweredKeys(json: unknown): string[] {
  const out: string[] = [];
  const walk = (o: unknown, p: string) => {
    if (typeof o === 'string') {
      if (LOWERED.test(o.replace(/\{[^}]*\}/g, '')) && !LEGAL_EXCEPT.has(p)) out.push(p);
    } else if (Array.isArray(o)) {
      o.forEach((v, i) => walk(v, `${p}[${i}]`));
    } else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) walk(v, p ? `${p}.${k}` : k);
    }
  };
  walk(json, '');
  return out;
}

test("문구 원본에 어르신 행동을 낮춘 '고른·골랐'이 없다(예외: 동의 3키·자리값 이름)", () => {
  expect(loweredKeys(JSON.parse(fs.readFileSync(SRC, 'utf8')))).toEqual([]);
});

test('검사가 실제로 붙잡는다: 보이는 글은 걸리고, 메모 키·자리값 이름·동의 예외는 걸리지 않는다', () => {
  const sample = {
    a: {b: '최근 한 달 고른 답이에요', c: ['괜찮아요', '골랐어요']},
    d: {_status: '고른 답 메모', e: '{고른 쪽}, 그게 좋아요', f: '고르신 답이에요'},
    consent: {title: '고른 답을 가족과 나눠요', declined_detail: '고른 답은 저장되지 않아요'},
  };
  expect(loweredKeys(sample)).toEqual(['a.b', 'a.c[1]', 'consent.title']); // v6 부터 동의 제목은 예외가 아니다
});
