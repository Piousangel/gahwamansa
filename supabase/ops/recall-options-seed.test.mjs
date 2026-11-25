// 실행: node --test supabase/ops/recall-options-seed.test.mjs   (네트워크·DB 없음, 글자만 읽음)
// 보호하는 것(대기열 25, DECISIONS 11-25 '5단계 문구 확정' 리드 결정):
//   (1) ② 보기 적재 SQL(supabase/seed_recall_options.sql)의 90개 = 라이터 CSV(docs/team/copy/2026-11-25-recall-options.csv) 글자까지 같음.
//   (2) 30일 모두 그날 ③ 두 보기·사진 낱말·사진 이름과 겹치지 않음 — SQL 사전 확인은 DB에 있는 날만 보므로 아직 게시 전인 15~30일은 여기서 본다.
//   (3) 콘텐츠 시드 회귀: ③ 보기가 ⑤ 틀 문장에서 대명사로 읽히는 한 글자('전' 등) 아님, ① 첫 질문(#249로 첫 질문만 보임)이 '기억'을 묻지 않음.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// CSV 한 줄 → 칸(따옴표 안 쉼표 허용)
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const CSV = read('docs/team/copy/2026-11-25-recall-options.csv').trim().split('\n').slice(1).map(parseCsvLine);
const SEED = read('supabase/seed_recall_options.sql');
// insert into seed_recall values … ; 블록의 (day, slot, 'label') 튜플
const seedBlock = SEED.slice(SEED.indexOf('insert into seed_recall values'), SEED.indexOf('\n;', SEED.indexOf('insert into seed_recall values')));
const SEED_ROWS = [...seedBlock.matchAll(/\((\d+), (\d+), '([^']*)'\)/g)].map((m) => [Number(m[1]), Number(m[2]), m[3]]);

// 콘텐츠 시드(1~14 게시본 원본 + 15~30 초안)에서 사진·③ 읽기
const CONTENT = read('supabase/seed_content_14d.sql') + read('supabase/seed_content_30d.sql');
const PHOTOS = new Map(
  [...CONTENT.matchAll(/\((\d+),\s*'pending:\/\/day-\d+',\s*'([^']*)',\s*'([^']*)',\s*array\['([^']*)',\s*'([^']*)'\]\)/g)]
    .map((m) => [Number(m[1]), {caption: m[2], keyword: m[3], recall: [m[4], m[5]]}]),
);
const QUESTIONS = new Map(
  [...CONTENT.matchAll(/\((\d+),\s*'(?!pending:)([^']*)',\s*'([^']*)',\s*'([^']*)'/g)]
    .map((m) => [Number(m[1]), {a: m[2], b: m[3], prompt: m[4]}]),
);

test('CSV 는 30일 × 보기 3 = 90개, 적재 SQL 도 90행', () => {
  assert.equal(CSV.length, 30);
  assert.equal(SEED_ROWS.length, 90);
});

test('적재 SQL 의 보기 = CSV 보기1~3(날·slot·글자까지, 카드 순서 그대로)', () => {
  const fromCsv = CSV.flatMap((c) => [1, 2, 3].map((slot) => [Number(c[0]), slot, c[4 + slot]]));
  assert.deepEqual(SEED_ROWS, fromCsv);
});

test('날 1~30 빠짐없이, 날마다 slot 1·2·3, 같은 날 같은 낱말 없음, 한글 2~4자', () => {
  for (let d = 1; d <= 30; d++) {
    const rows = SEED_ROWS.filter((r) => r[0] === d);
    assert.deepEqual(rows.map((r) => r[1]), [1, 2, 3], `${d}일 slot`);
    assert.equal(new Set(rows.map((r) => r[2])).size, 3, `${d}일 중복`);
    for (const [, , label] of rows) assert.match(label, /^[가-힣]{2,4}$/, `${d}일 ${label}`);
  }
});

test('금지어 0(SQL 사전 확인과 같은 목록, 조약돌의 약은 예외)', () => {
  const sql = SEED.match(/~ '(기억\|[^']+)'/);
  assert.ok(sql, 'SQL 금지어 정규식을 찾지 못함');
  const ban = new RegExp(sql[1]);
  assert.ok(ban.test('기억') && ban.test('약') && ban.test('막걸리'), '금지어 정규식이 기본 낱말을 잡아야 한다');
  for (const [d, , label] of SEED_ROWS) assert.ok(!ban.test(label.replace('조약', '')), `${d}일 ${label}`);
});

test('30일 모두 그날 ③ 두 보기·사진 낱말·사진 이름과 겹치지 않음(콘텐츠 시드 기준)', () => {
  for (let d = 1; d <= 30; d++) {
    const p = PHOTOS.get(d);
    const q = QUESTIONS.get(d);
    assert.ok(p && q, `${d}일 콘텐츠 시드 없음`);
    const words = `${q.a} ${q.b}`.split(/\s+/).filter(Boolean);
    for (const [, , label] of SEED_ROWS.filter((r) => r[0] === d)) {
      for (const w of words) assert.ok(!label.includes(w) && !w.includes(label), `${d}일 ${label} ↔ ③ ${w}`);
      assert.ok(!label.includes(p.keyword) && !p.caption.includes(label), `${d}일 ${label} ↔ 사진 ${p.keyword}/${p.caption}`);
    }
  }
});

test('CSV 의 ③ 두 보기 칸 = 콘텐츠 시드 ③(28일 전 → 빈대떡 반영 확인)', () => {
  for (const c of CSV) {
    const q = QUESTIONS.get(Number(c[0]));
    assert.equal(c[3], `${q.a} / ${q.b}`, `${c[0]}일`);
  }
});

test('③ 보기는 ⑤ 틀 문장에서 대명사로 읽히는 한 글자가 아님(28일 \'전\' → \'저는\', 리드 결정 11-25)', () => {
  const pronounLike = new Set(['전', '저', '난', '넌', '전요']);
  for (const [d, q] of QUESTIONS) {
    for (const o of [q.a, q.b]) assert.ok(!pronounLike.has(o), `${d}일 ③ '${o}'`);
  }
  assert.equal(QUESTIONS.get(28).b, '빈대떡');
});

test('① 첫 질문(#249로 첫 질문만 보임)은 30일 모두 \'기억\'을 묻지 않음', () => {
  assert.equal(PHOTOS.size, 30);
  for (const [d, p] of PHOTOS) assert.ok(!/기억/.test(p.recall[0]), `${d}일 첫 질문: ${p.recall[0]}`);
});

// 라이터 확정 11-25(#261, writer.md 2절): 어르신께 묻는 시드 문장(① 회상 두 질문·③ 질문)은 주체 높임, '기억'을 묻지 않음.
// 둘째 질문은 지금(#249) 화면에 안 보이지만 다시 보이게 될 때를 위해 함께 막는다. 꼴만 보는 좁은 검사다(맞춤법 검사기가 아님).
const NO_HONORIFIC = [
  [/(적|날이?) 있어요\?/, "'~보신 적 있으세요?'"],
  [/떠올라요\?/, "'떠오르세요?'"],
  [/봤어요\?/, "'~보셨어요?'"],
  [/좋아요\?$/, "'좋으세요?'"],
  [/[^시]던 (일|곳|건|게)(?=[ ?])/, "'~하시던'"],
];
test('어르신께 묻는 시드 문장(① 두 질문·③ 질문)은 높임 꼴, \'기억\'을 묻지 않음', () => {
  const asks = [];
  for (const [d, p] of PHOTOS) for (const q of p.recall) asks.push([d, q]);
  for (const [d, q] of QUESTIONS) asks.push([d, q.prompt]);
  assert.equal(asks.length, 90);
  const bad = [];
  for (const [d, q] of asks) {
    if (/기억/.test(q)) bad.push(`${d}일 '기억': ${q}`);
    for (const [re, want] of NO_HONORIFIC) if (re.test(q)) bad.push(`${d}일 높임(${want}): ${q}`);
  }
  assert.deepEqual(bad, []);
});
