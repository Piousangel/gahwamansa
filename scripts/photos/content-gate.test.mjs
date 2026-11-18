// 실행: node --test scripts/photos/content-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReview, checkBatch } from './content-gate.mjs';
import { targetProblem } from '../../supabase/ops/target-check.mjs';

const H15 = 'a'.repeat(64);
const H16 = 'b'.repeat(64);
const md = `# 검수표
| day | 파일 | sha256 | 검수일 | 검수자 | 글자·사람·현대물건 없음 | AI 표기 | 실제 장소 아님 |
|---|---|---|---|---|---|---|---|
| 15 | day-15.jpg | ${H15} | 2026-11-20 | 검수자A | ✅ | ✅ | ✅ |
| 16 | day-16.jpg | ${H16} | 2026-11-20 | 검수자A | ✅ | ✅ |  |
| 17 | day-17.jpg |  |  |  | ✅ | ✅ | ✅ |
`;
const entry = (d) => ({ day_index: d, photo: `day-${d}.jpg`, caption: '설명', keyword: '낱말', prompt: '질문', option_a: '가', option_b: '나' });
const hashes = { 'day-15.jpg': H15, 'day-16.jpg': H16, 'day-17.jpg': 'c'.repeat(64) };

test('통과: 검수 완료·파일·해시 일치·끝에 이어 붙임', () => {
  assert.deepEqual(checkBatch([entry(15)], parseReview(md), 14, hashes), []);
});

test('거부 1: 검수 미완(확인 칸 빈칸·검수일·검수자 없음·줄 없음)', () => {
  const p = checkBatch([entry(15), entry(16), entry(17)], parseReview(md), 14, hashes);
  assert.ok(p.some((x) => x.includes('day 16') && x.includes('실제 장소 아님')));
  assert.ok(p.some((x) => x.includes('day 17') && x.includes('검수일')));
  assert.ok(p.some((x) => x.includes('day 17') && x.includes('검수자')));
  assert.ok(checkBatch([entry(15)], parseReview('| day |\n|---|\n'), 14, hashes).some((x) => x.includes('줄이 없어요')));
});

test('거부 2: 이미 게시된 day_index 덮어쓰기', () => {
  const p = checkBatch([entry(14)], parseReview(md.replace('| 15 | day-15.jpg', '| 14 | day-14.jpg')), 14, { 'day-14.jpg': H15 });
  assert.ok(p.some((x) => x.includes('day 14') && x.includes('덮어쓰')));
});

test('거부 3: 중간 끼우기·빈칸(끝에만 이어야 함)', () => {
  assert.ok(checkBatch([entry(16)], parseReview(md), 14, hashes).length > 0, '15를 건너뜀');
  assert.ok(checkBatch([entry(10)], parseReview(md.replace('| 15 | day-15.jpg', '| 10 | day-10.jpg')), 14, { 'day-10.jpg': H15 }).length > 0, '중간 끼우기');
});

test('거부 4(C-M2): 경로 이탈·다른 이름·JPEG 아님', () => {
  for (const photo of ['../../../tmp/unreviewed-draft.JPG', 'sub/day-15.jpg', 'day-15.png', 'other.jpg']) {
    const p = checkBatch([{ ...entry(15), photo }], parseReview(md), 14, hashes);
    assert.ok(p.some((x) => x.includes('day-<숫자>.jpg')), photo);
  }
});

test('거부 5(C-M2): 검수 뒤 파일이 바뀜(해시 불일치)·검수한 파일과 다른 파일', () => {
  assert.ok(checkBatch([entry(15)], parseReview(md), 14, { 'day-15.jpg': 'd'.repeat(64) }).some((x) => x.includes('sha256')));
  assert.ok(checkBatch([entry(15)], parseReview(md.replace('| 15 | day-15.jpg', '| 15 | day-99.jpg')), 14, hashes).some((x) => x.includes('검수한 파일')));
});

test('거부 6(C-M2): 검수표에 같은 날 줄이 두 번', () => {
  const dup = md + `| 15 | day-15.jpg | ${H15} | 2026-11-21 | 검수자B | ✅ | ✅ | ✅ |\n`;
  assert.ok(checkBatch([entry(15)], parseReview(dup), 14, hashes).some((x) => x.includes('두 번')));
});

test('대상 확인(C-M1): 입력한 환경의 ref와 호스트가 같아야 한다', () => {
  const env = 'SUPABASE_PROJECT_REF=stg123\nSUPABASE_URL=https://stg123.supabase.co\n';
  assert.equal(targetProblem('staging', 'stg123.supabase.co', env), null);
  assert.match(targetProblem('staging', 'prod999.supabase.co', env) ?? '', /달라요/, 'production을 staging이라고 입력하면 멈춘다');
  assert.match(targetProblem('production', 'prod999.supabase.co', '') ?? '', /SUPABASE_PROJECT_REF가 없어요/);
  assert.equal(targetProblem('local', '127.0.0.1:54321', ''), null);
  assert.match(targetProblem('staging', '127.0.0.1:54321', env) ?? '', /로컬/);
  assert.match(targetProblem('prod', 'x', '') ?? '', /하나예요/);
});
