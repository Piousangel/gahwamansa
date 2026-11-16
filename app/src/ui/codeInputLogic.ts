export const CODE_LENGTH = 6;
export const emptyCode = '';
export const inputDigit = (code: string, d: string) =>
  /^[0-9]$/.test(d) && code.length < CODE_LENGTH ? code + d : code;
export const deleteOne = (code: string) => code.slice(0, -1);
export const clearAll = () => '';
export const canSubmit = (code: string) => /^[0-9]{6}$/.test(code);
export const formatCode = (code: string) =>
  code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
