// 실행: node --test supabase/ops/load-push-copy.test.mjs   (네트워크·DB 없음)
// 보호하는 것(#244 QA-1 M2·QA-3 M1·L2/L4): 법률 승인 키만 적재, 0060 없는 DB에는 새 키를 쓰지 않고 멈춤, cheer_texts 실패 시 push_copy 안 씀,
// 응원 키 정본(cheers.ts)을 .ts import 없이 정확히 읽음.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEGAL_APPROVED_CHEER_KEYS} from './cheer-legal-approved.mjs';
import {PRE_0060_CHEER_KEYS, applyPlan, checkTargetAccepts, parseCheerKeys, planCheers, readContractCheerKeys} from './push-copy-plan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const copy = JSON.parse(readFileSync(join(root, 'docs/team/copy.ko.json'), 'utf8'));
const CONTRACT = readContractCheerKeys(root);

test('cheers.ts 를 글자로 읽은 CHEER_KEYS = 17키(기존 4 + 새 13, ans_seen 없음)', () => {
  assert.equal(CONTRACT.length, 17);
  assert.deepEqual(CONTRACT.slice(0, 4), PRE_0060_CHEER_KEYS);
  assert.ok(!CONTRACT.includes('ans_seen'));
  assert.deepEqual(Object.keys(copy.cheers).sort(), [...CONTRACT].sort());
});

test('parseCheerKeys: 주석 안의 따옴표는 무시하고, 모양이 바뀌면 예외', () => {
  assert.deepEqual(parseCheerKeys("export const CHEER_KEYS = [\n  'a_b', // 'not_me'\n  \"c\",\n] as const;"), ['a_b', 'c']);
  assert.throws(() => parseCheerKeys('export const CHEER_KEYS: string[] = [];'), /찾지 못했어요/);
  assert.throws(() => parseCheerKeys("export const CHEER_KEYS = ['Bad-Key'] as const;"), /읽지 못했어요/);
});

test('법률 승인 키는 계약 안에 있고, 지금은 기존 4키뿐이다', () => {
  for (const k of LEGAL_APPROVED_CHEER_KEYS) assert.ok(CONTRACT.includes(k), k);
  assert.deepEqual(LEGAL_APPROVED_CHEER_KEYS, PRE_0060_CHEER_KEYS);
});

test('planCheers: 적재는 승인 키만, 나머지는 대기, 문장 검사는 계약 키 전부', () => {
  const p = planCheers(copy.cheers, CONTRACT, LEGAL_APPROVED_CHEER_KEYS);
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.cheers.map((c) => c.message_key), PRE_0060_CHEER_KEYS);
  assert.equal(p.pending.length, 13);
  const broken = planCheers({...copy.cheers, love: '', ans_seen: 'x'}, CONTRACT, [...LEGAL_APPROVED_CHEER_KEYS, 'nope']);
  assert.deepEqual(broken.problems.sort(), ['cheers.ans_seen: 계약(CHEER_KEYS)에 없는 키', 'cheers.love: 없거나 60자 초과', '법률 승인 키 nope: 계약(CHEER_KEYS)에 없음'].sort());
  assert.ok(!broken.cheers.some((c) => c.message_key === 'nope'));
});

const fakeRpc = (impl) => {
  const calls = [];
  return {calls, rpc: async (name, body) => (calls.push([name, body.p_key]), impl(name, body))};
};

test('checkTargetAccepts: 0060 없는 DB(404)는 4키만 통과, 새 키가 있으면 멈춤', async () => {
  const none = fakeRpc(() => ({status: 404, body: {code: 'PGRST202'}}));
  assert.deepEqual(await checkTargetAccepts(none.rpc, PRE_0060_CHEER_KEYS), {has0060: false, problems: []});
  const r = await checkTargetAccepts(none.rpc, ['love_you', 'love', 'miss_you']);
  assert.equal(r.has0060, false);
  assert.match(r.problems[0], /0060\(cheer_key_ok\)이 없어 이 키를 받지 않아요: love, miss_you/);
});

test('checkTargetAccepts: 0060 있는 DB는 키마다 cheer_key_ok, false 가 하나라도 있으면 멈춤, 권한 오류도 멈춤', async () => {
  const ok = fakeRpc((_, b) => ({status: 200, body: b.p_key !== 'ans_seen'}));
  assert.deepEqual(await checkTargetAccepts(ok.rpc, ['love', 'miss_you']), {has0060: true, problems: []});
  assert.deepEqual(ok.calls, [['cheer_key_ok', 'love'], ['cheer_key_ok', 'miss_you']]);
  const bad = await checkTargetAccepts(ok.rpc, ['love', 'ans_seen']);
  assert.deepEqual(bad.problems, ['대상 DB의 cheer_key_ok 가 ans_seen 를 받지 않아요']);
  const denied = fakeRpc(() => ({status: 401, body: null}));
  assert.match((await checkTargetAccepts(denied.rpc, ['love_you'])).problems[0], /HTTP 401/);
});

test('applyPlan: cheer_texts 먼저, 실패하면 push_copy 는 쓰지 않는다(반쪽 적재 없음)', async () => {
  const order = [];
  const okUpsert = async (t) => void order.push(t);
  assert.deepEqual(await applyPlan(okUpsert, {rows: [{kind: 'daily'}], cheers: [{message_key: 'love_you'}]}), ['cheer_texts', 'push_copy']);
  assert.deepEqual(order, ['cheer_texts', 'push_copy']);
  const wrote = [];
  const failCheers = async (t) => {
    if (t === 'cheer_texts') throw new Error('cheer_texts 실패 HTTP 400');
    wrote.push(t);
  };
  await assert.rejects(applyPlan(failCheers, {rows: [{kind: 'daily'}], cheers: [{message_key: 'love'}]}), /cheer_texts 실패/);
  assert.deepEqual(wrote, []);
});
