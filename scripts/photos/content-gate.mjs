// 콘텐츠 게시 게이트(로드맵 SV-08). publish-content.mjs가 사진을 올리기 **전에** 검사한다(검수 전 사진은 공개 버킷에 올리지 않음).
// 검수표 content/review.md 형식(마크다운 표, 한 줄 = 하루):
//   | day | 검수일 | 검수자 | 글자·사람·현대물건 없음 | AI 표기 | 실제 장소 아님 |
//   | 15  | 2026-11-20 | 홍길동 | ✅ | ✅ | ✅ |
// 확인 칸은 ✅·O·예·yes 중 하나여야 통과. 순수 함수만(파일·네트워크 없음) — 테스트: node --test scripts/photos/content-gate.test.mjs

const OK_MARKS = new Set(['✅', 'o', 'O', '예', 'yes', 'YES', 'Yes']);
const CHECK_COLUMNS = ['글자·사람·현대물건 없음', 'AI 표기', '실제 장소 아님'];

/** 검수표 → Map(day → {date, reviewer, checks{열: bool}}) */
export function parseReview(md) {
  const rows = md.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (rows.length < 2) return new Map();
  const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(rows[0]);
  const idx = (name) => header.indexOf(name);
  const out = new Map();
  for (const l of rows.slice(1)) {
    const c = cells(l);
    if (c.every((x) => /^:?-+:?$/.test(x))) continue; // 구분 줄
    const day = Number(c[idx('day')]);
    if (!Number.isInteger(day)) continue;
    const checks = Object.fromEntries(CHECK_COLUMNS.map((k) => [k, idx(k) >= 0 && OK_MARKS.has(c[idx(k)] ?? '')]));
    out.set(day, { date: c[idx('검수일')] ?? '', reviewer: c[idx('검수자')] ?? '', checks });
  }
  return out;
}

/**
 * 게시할 묶음 검사. entries: [{day_index, photo, caption, keyword, prompt, option_a, option_b, ...}], existingMax: 서버의 지금 최대 day_index.
 * 돌려주는 값: 문제 목록(빈 배열이면 통과).
 */
export function checkBatch(entries, review, existingMax) {
  const problems = [];
  if (!Array.isArray(entries) || entries.length === 0) return ['게시할 날이 없어요'];
  const days = entries.map((e) => e.day_index).sort((a, b) => a - b);
  days.forEach((d, i) => {
    if (d !== existingMax + 1 + i) problems.push(`day ${d}: 끝(${existingMax + 1}부터)에 빈칸 없이 이어야 해요 — 이미 게시된 날을 덮어쓰거나 중간에 끼울 수 없어요`);
  });
  for (const e of entries) {
    const r = review.get(e.day_index);
    if (!r) {
      problems.push(`day ${e.day_index}: 검수표(content/review.md)에 줄이 없어요`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) problems.push(`day ${e.day_index}: 검수일(YYYY-MM-DD)이 없어요`);
    if (!r.reviewer) problems.push(`day ${e.day_index}: 검수자가 없어요`);
    for (const [k, v] of Object.entries(r.checks)) if (!v) problems.push(`day ${e.day_index}: "${k}" 확인이 안 됐어요`);
    if (!e.photo || !/\.jpe?g$/i.test(e.photo)) problems.push(`day ${e.day_index}: 사진은 JPEG 파일이어야 해요(버킷 규칙)`);
    for (const f of ['caption', 'keyword', 'option_a', 'option_b']) if (!String(e[f] ?? '').trim()) problems.push(`day ${e.day_index}: ${f}가 비었어요`);
  }
  return problems;
}
