// P16 행 날짜 문구: 'YYYY-MM-DD'(서버 connected_date, KST) -> "11월 12일에 연결했어요"(문구 틀 {월}·{일})
export function familyDateText(template: string, ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return template.split('{월}').join(String(m)).split('{일}').join(String(d));
}
