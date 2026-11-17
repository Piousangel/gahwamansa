import {hanimTextIssues, praiseOrHeart} from '../src/lib/hanimText';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

// 라이터 수정 대기 중인 알려진 위반(DECISIONS 11-17 "칭찬·하트 금지"). 고쳐지면 여기서 지운다 — 남아 있으면 아래 테스트가 알려 준다.
const KNOWN_VIOLATIONS: Record<string, string> = {};

function strings(x: unknown, key = ''): Array<[string, string]> {
  if (typeof x === 'string') return [[key, x]];
  if (Array.isArray(x)) return x.flatMap((v, i) => strings(v, `${key}[${i}]`));
  if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => strings(v, key ? `${key}.${k}` : k));
  return [];
}

describe('hanimText(해님 문구 규칙, lib/ 순수 함수 — 토스·백오피스 재사용)', () => {
  test('칭찬: 띄어쓰기 변형까지 잡는다', () => {
    for (const t of ['잘하셨어요', '잘 하셨어요', '잘  했어요', '훌륭해요', '최고예요', '대단해요', '멋져요', '멋지세요', '장하세요', '똑똑하세요']) {
      expect([t, praiseOrHeart(t)]).toEqual([t, 'praise']);
    }
  });

  test('하트 기호·낱말을 잡는다', () => {
    expect(praiseOrHeart('고마워요 ♥')).toBe('heart');
    expect(praiseOrHeart('하트 보내요')).toBe('heart');
  });

  test('평범한 안내·위로는 통과', () => {
    for (const t of ['오늘도 만나서 반가워요!', '앱이 잠깐 헷갈렸어요', '천천히 해도 충분해요', '고른 답이 잘 전해졌어요', '사진을 잘 보세요']) {
      expect([t, praiseOrHeart(t)]).toEqual([t, null]);
    }
  });

  test('해님 말은 40자 이하', () => {
    expect(hanimTextIssues('가'.repeat(41))).toContain('tooLong');
    expect(hanimTextIssues('오늘도 만나서 반가워요!')).toEqual([]);
  });

  test.each([
    ['원본', '../../docs/team/copy.ko.json'],
    ['앱 사본', '../src/copy/copy.ko.json'],
  ])('문구 전체(%s)에 칭찬·하트가 없다(알려진 위반 제외)', (_name, rel) => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, rel), 'utf8'));
    const bad = strings(data).filter(([k, v]) => praiseOrHeart(v) && KNOWN_VIOLATIONS[k] !== v);
    expect(bad).toEqual([]);
  });

  test('알려진 위반 목록은 실제로 아직 남아 있는 것만(고쳐지면 지우기)', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/team/copy.ko.json'), 'utf8'));
    const all = Object.fromEntries(strings(data));
    for (const [k, v] of Object.entries(KNOWN_VIOLATIONS)) {
      expect([k, all[k]]).toEqual([k, v]);
    }
  });
});
