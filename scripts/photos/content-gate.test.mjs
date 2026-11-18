// 실행: node --test scripts/photos/content-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReview, checkBatch } from './content-gate.mjs';

const md = `# 검수표
| day | 검수일 | 검수자 | 글자·사람·현대물건 없음 | AI 표기 | 실제 장소 아님 |
|---|---|---|---|---|---|
| 15 | 2026-11-20 | 검수자A | ✅ | ✅ | ✅ |
| 16 | 2026-11-20 | 검수자A | ✅ | ✅ |  |
| 17 |  |  | ✅ | ✅ | ✅ |
`;
const entry = (d) => ({ day_index: d, photo: `day-${d}.jpg`, caption: '설명', keyword: '낱말', prompt: '질문', option_a: '가', option_b: '나' });

test('통과: 검수 완료·끝에 이어 붙임', () => {
  assert.deepEqual(checkBatch([entry(15)], parseReview(md), 14), []);
});

test('거부 1: 검수 미완(확인 칸 빈칸·검수일·검수자 없음·줄 없음)', () => {
  const p = checkBatch([entry(15), entry(16), entry(17)], parseReview(md), 14);
  assert.ok(p.some((x) => x.includes('day 16') && x.includes('실제 장소 아님')));
  assert.ok(p.some((x) => x.includes('day 17') && x.includes('검수일')));
  assert.ok(p.some((x) => x.includes('day 17') && x.includes('검수자')));
  assert.ok(checkBatch([entry(15)], parseReview('| day |\n|---|\n'), 14).some((x) => x.includes('줄이 없어요')));
});

test('거부 2: 이미 게시된 day_index 덮어쓰기', () => {
  const p = checkBatch([entry(14)], parseReview(md.replace('| 15 |', '| 14 |')), 14);
  assert.ok(p.some((x) => x.includes('day 14') && x.includes('덮어쓰')));
});

test('거부 3: 중간 끼우기·빈칸(끝에만 이어야 함)', () => {
  assert.ok(checkBatch([entry(16)], parseReview(md), 14).length > 0, '15를 건너뜀');
  assert.ok(checkBatch([entry(10)], parseReview(md.replace('| 15 |', '| 10 |')), 14).length > 0, '중간 끼우기');
});

test('거부 4: JPEG 아닌 사진·빈 문구', () => {
  const p = checkBatch([{ ...entry(15), photo: 'day-15.png', caption: '' }], parseReview(md), 14);
  assert.ok(p.some((x) => x.includes('JPEG')));
  assert.ok(p.some((x) => x.includes('caption')));
});
