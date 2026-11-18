// 콘텐츠 게시 게이트(로드맵 SV-08, 리뷰 C-M2 반영). publish-content.mjs가 사진을 올리기 **전에** 검사한다(검수 전 사진은 공개 버킷에 올리지 않음).
// 검수표 content/review.md 형식(마크다운 표, 한 줄 = 하루, 검수한 그 파일의 sha256을 적는다):
//   | day | 파일 | sha256 | 검수일 | 검수자 | 글자·사람·현대물건 없음 | AI 표기 | 실제 장소 아님 |
//   | 15  | day-15.jpg | 3a7b…(64자) | 2026-11-20 | 홍길동 | ✅ | ✅ | ✅ |
// sha256 구하기: shasum -a 256 content/photos/day-15.jpg. 확인 칸은 ✅·O·예·yes만 통과. 같은 day 줄이 두 번이면 거부.
// 사진 이름은 day-<숫자>.jpg(.jpeg)만(경로·../ 불가). 순수 함수만 — 테스트: node --test scripts/photos/content-gate.test.mjs

const OK_MARKS = new Set(['✅', 'o', 'O', '예', 'yes', 'YES', 'Yes']);
const CHECK_COLUMNS = ['글자·사람·현대물건 없음', 'AI 표기', '실제 장소 아님'];
export const PHOTO_NAME = /^day-\d{1,6}\.jpe?g$/i;

/** 검수표 → { rows: Map(day → {file, sha256, date, reviewer, checks}), duplicates: day[] } */
export function parseReview(md) {
  const lines = md.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  const rows = new Map();
  const duplicates = [];
  if (lines.length < 2) return { rows, duplicates };
  const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(lines[0]);
  const idx = (name) => header.indexOf(name);
  for (const l of lines.slice(1)) {
    const c = cells(l);
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const day = Number(c[idx('day')]);
    if (!Number.isInteger(day)) continue;
    if (rows.has(day)) duplicates.push(day);
    const checks = Object.fromEntries(CHECK_COLUMNS.map((k) => [k, idx(k) >= 0 && OK_MARKS.has(c[idx(k)] ?? '')]));
    rows.set(day, {
      file: c[idx('파일')] ?? '',
      sha256: (c[idx('sha256')] ?? '').toLowerCase(),
      date: c[idx('검수일')] ?? '',
      reviewer: c[idx('검수자')] ?? '',
      checks,
    });
  }
  return { rows, duplicates };
}

/**
 * 게시할 묶음 검사. entries: [{day_index, photo, caption, keyword, option_a, option_b, ...}],
 * review: parseReview 결과, existingMax: 서버의 지금 최대 day_index, hashes: {photo파일명: sha256}(이름 검사를 통과한 파일만 스크립트가 계산).
 * 돌려주는 값: 문제 목록(빈 배열이면 통과).
 */
export function checkBatch(entries, review, existingMax, hashes = {}) {
  const problems = [];
  if (!Array.isArray(entries) || entries.length === 0) return ['게시할 날이 없어요'];
  for (const d of review.duplicates) problems.push(`day ${d}: 검수표에 같은 날 줄이 두 번 있어요`);
  const days = entries.map((e) => e.day_index).sort((a, b) => a - b);
  days.forEach((d, i) => {
    if (d !== existingMax + 1 + i) problems.push(`day ${d}: 끝(${existingMax + 1}부터)에 빈칸 없이 이어야 해요 — 이미 게시된 날을 덮어쓰거나 중간에 끼울 수 없어요`);
  });
  for (const e of entries) {
    if (!PHOTO_NAME.test(String(e.photo ?? ''))) {
      problems.push(`day ${e.day_index}: 사진은 content/photos 안의 day-<숫자>.jpg 이름만 돼요(경로·다른 확장자 불가)`);
      continue;
    }
    const r = review.rows.get(e.day_index);
    if (!r) {
      problems.push(`day ${e.day_index}: 검수표(content/review.md)에 줄이 없어요`);
      continue;
    }
    if (r.file !== e.photo) problems.push(`day ${e.day_index}: 검수한 파일(${r.file || '없음'})과 올릴 파일(${e.photo})이 달라요`);
    if (!/^[0-9a-f]{64}$/.test(r.sha256) || r.sha256 !== String(hashes[e.photo] ?? '').toLowerCase()) {
      problems.push(`day ${e.day_index}: 파일 내용이 검수한 것과 달라요(sha256 불일치) — 검수 뒤 바뀐 사진은 다시 검수해야 해요`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) problems.push(`day ${e.day_index}: 검수일(YYYY-MM-DD)이 없어요`);
    if (!r.reviewer) problems.push(`day ${e.day_index}: 검수자가 없어요`);
    for (const [k, v] of Object.entries(r.checks)) if (!v) problems.push(`day ${e.day_index}: "${k}" 확인이 안 됐어요`);
    for (const f of ['caption', 'keyword', 'option_a', 'option_b']) if (!String(e[f] ?? '').trim()) problems.push(`day ${e.day_index}: ${f}가 비었어요`);
  }
  return problems;
}
