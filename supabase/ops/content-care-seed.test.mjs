// 실행: node --test supabase/ops/content-care-seed.test.mjs   (네트워크·DB 없음, 글자만 읽음)
// 보호하는 것(기획 v2.1 콘텐츠 갈래, 설계서 docs/team/2026-11-26-content-axes.md — #283 설계·#285 라이터 확정, 0065):
//   (1) 시드의 '챙겨 드릴 거리' 60줄(care_a·care_b) = 설계서 2절 확정 열, 글자까지 같음(보기 A·B 짝도 같음).
//   (2) 바뀌는 9일(8·9·13·16·18·20·21·22·24)의 ③ 보기·질문 = 설계서 3절, 첫마디 18줄 = 4.1 W2 확정 열.
//   (3) 60줄 모두 다르고 17자 이하(0065 care_line_ok와 같은 상한), 금지어 0 — 독립 목록(설계서 W7·W6)으로 care·바뀐 ③·첫마디까지 본다.
//   (4) 0065의 SQL 금지어 정규식이 독립 목록의 낱말을 모두 잡는다(두 목록 어긋남 방지, recall-options-seed 시험과 같은 방식).
//   (5) 뺀 낱말(온천·스카프·오일장)과 옛 짝이 시드에 남지 않음.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const DOC = read('docs/team/2026-11-26-content-axes.md');
const S14 = read('supabase/seed_content_14d.sql');
const S30 = read('supabase/seed_content_30d.sql');
const MIG = read(`supabase/migrations/${readdirSync(join(root, 'supabase/migrations')).find((f) => f.includes('_content_care_lines'))}`);

const section = (from, to) => DOC.slice(DOC.indexOf(from), DOC.indexOf(to));
const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().replace(/\*\*/g, ''));

// 설계서 2절: | 일 | 사진 | 갈래 | A → careA | B → careB |
const DOC_CARE = new Map();
for (const line of section('## 2. 30일 배치표', '## 3. 기존 시드와 바뀌는 날').split('\n')) {
  const c = cells(line);
  if (c.length === 5 && /^\d+$/.test(c[0]) && c[3].includes(' → ')) {
    const [a, careA] = c[3].split(' → ');
    const [b, careB] = c[4].split(' → ');
    DOC_CARE.set(Number(c[0]), {a, b, careA, careB});
  }
}
// 설계서 3절: 바꿀 보기 · 질문(셋째 칸)
const DOC_CHANGE = new Map();
for (const line of section('## 3. 기존 시드와 바뀌는 날', '## 4. 라이터 확정 필요').split('\n')) {
  const c = cells(line);
  const m = c.length >= 6 && /^\d+$/.test(c[0]) && c[2].match(/^(.+?) \/ (.+?) · '(.+?)'$/);
  if (m) DOC_CHANGE.set(Number(c[0]), {a: m[1], b: m[2], prompt: m[3]});
}
// 4.1 W2: | 일 | 보기 | 지금 | 확정 |
const DOC_STARTER = new Map();
for (const line of section('**W2 첫마디 18줄**', '**W3 챙겨 드릴 거리 60줄**').split('\n')) {
  const c = cells(line);
  if (c.length === 4 && /^\d+$/.test(c[0])) {
    const d = Number(c[0]);
    DOC_STARTER.set(d, [...(DOC_STARTER.get(d) ?? []), {option: c[1], text: c[3]}]);
  }
}

// 시드: 14d (day, a, b, prompt, care_a, care_b) / 30d (day, a, b, prompt, starter_a, starter_b, care_a, care_b) / 30d seed_starters (day, sa, sb)
const s = "'((?:[^']|'')*)'";
const SEED = new Map();
for (const m of S14.matchAll(new RegExp(`\\((\\d+), ${s}, ${s}, ${s}, ${s}, ${s}\\)`, 'g'))) {
  SEED.set(Number(m[1]), {a: m[2], b: m[3], prompt: m[4], careA: m[5], careB: m[6]});
}
for (const m of S30.matchAll(new RegExp(`\\((\\d+), ${s}, ${s}, ${s}, ${s}, ${s}, ${s}, ${s}\\)`, 'g'))) {
  SEED.set(Number(m[1]), {a: m[2], b: m[3], prompt: m[4], starters: [m[5], m[6]], careA: m[7], careB: m[8]});
}
const starterBlock = S30.slice(S30.indexOf('insert into seed_starters values'));
for (const m of starterBlock.slice(0, starterBlock.indexOf('\n;')).matchAll(new RegExp(`\\((\\d+), ${s}, ${s}\\)`, 'g'))) {
  SEED.get(Number(m[1])).starters = [m[2], m[3]];
}

const CHANGED = [8, 9, 13, 16, 18, 20, 21, 22, 24];

test('설계서 표를 읽었다(2절 30일·3절 9일·W2 9일 × 2)', () => {
  assert.equal(DOC_CARE.size, 30);
  assert.deepEqual([...DOC_CHANGE.keys()], CHANGED);
  assert.deepEqual([...DOC_STARTER.keys()].sort((x, y) => x - y), CHANGED);
  for (const d of CHANGED) assert.equal(DOC_STARTER.get(d).length, 2, `${d}일 첫마디`);
});

test('시드 30일 모두 있고, 챙겨 드릴 거리 60줄 = 설계서 2절(보기 짝까지 글자 그대로)', () => {
  assert.equal(SEED.size, 30);
  for (let d = 1; d <= 30; d++) {
    const got = SEED.get(d);
    const want = DOC_CARE.get(d);
    assert.deepEqual({a: got.a, b: got.b, careA: got.careA, careB: got.careB}, want, `${d}일`);
  }
});

test('바뀌는 9일: ③ 보기·질문 = 설계서 3절, 첫마디 = 4.1 W2 확정', () => {
  for (const d of CHANGED) {
    const got = SEED.get(d);
    const want = DOC_CHANGE.get(d);
    assert.deepEqual({a: got.a, b: got.b, prompt: got.prompt}, want, `${d}일 ③`);
    const st = DOC_STARTER.get(d);
    assert.deepEqual(st.map((x) => x.option), [got.a, got.b], `${d}일 첫마디 보기 순서`);
    assert.deepEqual(got.starters, st.map((x) => x.text), `${d}일 첫마디`);
  }
});

const CARE = [...SEED.values()].flatMap((q) => [q.careA, q.careB]);

test('챙겨 드릴 거리 60줄: 모두 다르고 1~17자(0065 care_line_ok 상한)', () => {
  assert.equal(CARE.length, 60);
  assert.equal(new Set(CARE).size, 60);
  for (const c of CARE) assert.ok(c.length >= 1 && [...c].length <= 17, `${c} (${[...c].length}자)`);
});

// 금지어 독립 목록(설계서 W7: copyBan BANNED_EVERYWHERE + guardrails 1절 + 이번 원칙, W6 '몸에 좋'). SQL 정규식을 읽어 쓰지 않는다.
// #286 QA-3 M1: 효능 꼴('~에 좋'·높이/낮추·잘되·되살)·병명·신체 부위·'약'. 검사는 공백을 지운 값으로(띄어 써서 피하기 차단).
const BANNED = ['아직', '못했', '미완료', '일째', '틀렸', '치매', '치료', '예방',
  '효도', '안부', '안심', '건강', '뇌', '노인', '숙제', '잘하셨', '확인', '지켜', '실시간',
  '효능', '좋아하시니까', '기억', '몸에좋',
  '에좋', '높이', '낮추', '낮춰', '잘되', '되살', '혈압', '혈당', '당뇨', '관절', '무릎', '허리', '면역', '소화',
  '변비', '불면', '약', '뼈', '근육', '살빠', '다이어트', '피로'];
const squash = (t) => t.replace(/\s+/g, '');
// 막혀야 할 예시(QA-3가 0065 첫 정규식을 통과시킨 문장 — 고치기 전 통과, 고친 뒤 거부)
const MUST_BLOCK = ['관절에 좋은 산책', '무릎에 좋은 걷기', '당뇨에 좋은 잡곡밥', '혈압 낮추는 나물', '면역력 높이는 차',
  '소화 잘되는 죽', '몸 에 좋은 차', '기 억 되살리기'];

test('금지어 0 — 챙겨 드릴 거리 60줄 + 바뀐 9일 ③ 보기·질문 + 첫마디 18줄', () => {
  const texts = [...CARE];
  for (const d of CHANGED) {
    const q = SEED.get(d);
    texts.push(q.a, q.b, q.prompt, ...q.starters);
  }
  assert.equal(texts.length, 60 + 9 * 5);
  const hits = texts.flatMap((t) => BANNED.filter((w) => squash(t).includes(w)).map((w) => `${t} ← ${w}`));
  assert.deepEqual(hits, []);
});

const SQL_RE = MIG.match(/regexp_replace\(p_line, '\\s\+', '', 'g'\) !~ '([^']*)'/);

test('0065 SQL 금지어 정규식이 독립 목록의 낱말을 모두 잡고, 공백을 지운 값으로 검사한다', () => {
  assert.ok(SQL_RE, 'care_line_ok 정규식(공백 지운 값 검사)을 찾지 못함');
  const sqlBan = new RegExp(SQL_RE[1].replace('[0-9]+일째', '([0-9]+)?일째'));
  assert.deepEqual(BANNED.filter((w) => !sqlBan.test(w)), []);
  assert.ok(new RegExp(SQL_RE[1]).test('3일째'), 'N일째');
  assert.ok(!/ /.test(SQL_RE[1]), '공백을 지운 값과 맞추므로 정규식 낱말에 공백이 없어야 함');
  assert.match(MIG, /char_length\(p_line\) between 1 and 17/);
});

test('효능·풀이 예시는 SQL 정규식(공백 지운 값)에 막히고, 확정 60줄은 통과(#286 QA-3 M1)', () => {
  const sqlBan = new RegExp(SQL_RE[1]);
  assert.deepEqual(MUST_BLOCK.filter((t) => !sqlBan.test(squash(t))), []);
  assert.deepEqual(CARE.filter((t) => sqlBan.test(squash(t))), []);
});

// #286 QA-1 L2: staging 재시드 [5] 첫마디 UPDATE(손으로 옮긴 4줄) = seed_content_30d.sql seed_starters 글자 그대로
test('staging 재시드 SQL의 첫마디 4줄 = 30d 시드 seed_starters(8·9·13·14일)', () => {
  const R = read('supabase/ops/staging-reseed-2026-11-26.sql');
  const block = R.slice(R.indexOf('update public.content_questions c set starter_a'));
  const rows = [...block.slice(0, block.indexOf(') s(day_index')).matchAll(new RegExp(`\\((\\d+), ${s}, ${s}\\)`, 'g'))]
    .map((m) => [Number(m[1]), m[2], m[3]]);
  assert.deepEqual(rows.map((r) => r[0]), [8, 9, 13, 14]);
  for (const [d, a, b] of rows) assert.deepEqual([a, b], SEED.get(d).starters, `${d}일`);
});

test('뺀 낱말·옛 짝이 시드에 남지 않음(온천·스카프·오일장, 바뀐 9일의 옛 보기)', () => {
  const all = S14 + S30;
  for (const w of ['온천', '스카프', '오일장', '편한 슬리퍼', '튼튼한 운동화', '시원한 물', '따뜻한 물', '버스 타고\', \'걸어서',
    '아침에 정리', '조용히 먹기', '도란도란 먹기', '선풍기 바람', '짐은 가볍게', '곱게 차려입기', '일기 쓰기']) {
    assert.ok(!all.includes(`'${w}'`), w);
  }
});
