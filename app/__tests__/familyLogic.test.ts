import {familyDateText} from '../src/features/family/familyLogic';

test('P16 행 날짜: KST 날짜를 {월}월 {일}일 로(앞 0 없음)', () => {
  expect(familyDateText('{월}월 {일}일에 연결했어요', '2026-11-12')).toBe('11월 12일에 연결했어요');
  expect(familyDateText('{월}월 {일}일에 연결했어요', '2027-01-05')).toBe('1월 5일에 연결했어요');
});
