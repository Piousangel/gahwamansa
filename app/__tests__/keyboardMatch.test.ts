import {filledCount, isMatch, normalizeWord, syllables} from '../src/features/course/keyboardMatch';

// 자판으로 쓰기(P6) 판정: NFC 정규화 + 공백 제거 후 비교. 조합 중 판정은 하지 않는다(RN에 조합 이벤트가 없음) →
// "목표 음절과 같아진 칸만, 앞에서부터" 채운다. 틀림은 어디에도 표시하지 않으므로 틀린 칸 정보는 만들지 않는다.
const NFD_GAEUL = '가을'.normalize('NFD'); // 자모가 풀린 입력(일부 키보드·붙여넣기)

describe('normalizeWord', () => {
  test('NFC로 합치고 모든 공백(띄어쓰기·줄바꿈·자동 띄어쓰기)을 지운다', () => {
    expect(normalizeWord(NFD_GAEUL)).toBe('가을');
    expect(normalizeWord(' 가 을 ')).toBe('가을');
    expect(normalizeWord('가을\n')).toBe('가을');
    expect(normalizeWord('가을 ')).toBe('가을'); // 줄바꿈 없는 공백(추천 낱말 뒤)
  });
});

describe('syllables', () => {
  test('정규화한 뒤 음절(코드 포인트) 단위로 나눈다', () => {
    expect(syllables(NFD_GAEUL)).toEqual(['가', '을']);
    expect(syllables('')).toEqual([]);
  });
});

describe('filledCount: 앞에서부터 같은 음절 수', () => {
  test('빈 입력은 0', () => {
    expect(filledCount('', '가을')).toBe(0);
  });
  test('조합 중인 마지막 음절은 목표와 같아질 때만 채운다(가 → 가으 → 가을)', () => {
    expect(filledCount('가', '가을')).toBe(1);
    expect(filledCount('가으', '가을')).toBe(1);
    expect(filledCount('가을', '가을')).toBe(2);
  });
  test('천지인 중간 상태(ㄱ, 갸 등)는 채우지 않는다', () => {
    expect(filledCount('ㄱ', '가을')).toBe(0);
    expect(filledCount('갸', '가을')).toBe(0);
  });
  test('앞이 다르면 뒤가 같아도 채우지 않는다(자리별이 아니라 앞에서부터)', () => {
    expect(filledCount('나을', '가을')).toBe(0);
    expect(filledCount('가울', '가을')).toBe(1);
  });
  test('공백·NFD 입력도 같은 규칙', () => {
    expect(filledCount('가 을', '가을')).toBe(2);
    expect(filledCount(NFD_GAEUL, '가을')).toBe(2);
  });
  test('목표보다 길게 써도 목표 칸 수를 넘지 않는다', () => {
    expect(filledCount('가을에', '가을')).toBe(2);
  });
});

describe('isMatch', () => {
  test('정규화 후 정확히 같을 때만 일치', () => {
    expect(isMatch('가을', '가을')).toBe(true);
    expect(isMatch(' 가을 ', '가을')).toBe(true);
    expect(isMatch(NFD_GAEUL, '가을')).toBe(true);
    expect(isMatch('가으', '가을')).toBe(false);
    expect(isMatch('가울', '가을')).toBe(false);
    expect(isMatch('가을에', '가을')).toBe(false);
  });
  test('목표가 비어 있으면 일치로 보지 않는다', () => {
    expect(isMatch('', '')).toBe(false);
    expect(isMatch(' ', ' ')).toBe(false);
  });
});
