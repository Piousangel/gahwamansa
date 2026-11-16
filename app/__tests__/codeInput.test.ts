import {
  emptyCode,
  inputDigit,
  deleteOne,
  clearAll,
  canSubmit,
  formatCode,
} from '../src/ui/codeInputLogic';

test('숫자만 입력되고 6자리까지만 쌓인다', () => {
  let c = emptyCode;
  c = inputDigit(c, '4');
  c = inputDigit(c, 'a');
  c = inputDigit(c, '8');
  expect(c).toBe('48');
  for (const d of '1234567') c = inputDigit(c, d);
  expect(c).toBe('481234');
});
test('한 칸 지움, 전부 지움', () => {
  expect(deleteOne('482')).toBe('48');
  expect(deleteOne('')).toBe('');
  expect(clearAll()).toBe('');
});
test('6자리가 되어야 제출 가능', () => {
  expect(canSubmit('48291')).toBe(false);
  expect(canSubmit('482915')).toBe(true);
});
test('3자리씩 띄워 보여 준다', () => {
  expect(formatCode('482915')).toBe('482 915');
  expect(formatCode('48')).toBe('48');
});
