// 실행: node --test supabase/ops/temp-stack-lib.test.mjs
// temp-stack-lib.sh 의 race 판정(judge_outputs)과 포트 대역 고르기를 Docker 없이 확인한다(대기열 43·48, #275 QA-1 L-b·QA-3 L1).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const LIB = join(dirname(fileURLToPath(import.meta.url)), 'temp-stack-lib.sh');
const CONFIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'config.toml');

const sh = (script, args = [], env = {}) =>
  spawnSync('bash', ['-c', `. "${LIB}"; ${script}`, '_', ...args], {
    encoding: 'utf8',
    env: {...process.env, PORT_BASE: '', ...env},
  });

const withOutputs = (contents, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'race-judge-'));
  try {
    const files = contents.map((c, i) => {
      const f = join(dir, `x.${'ab'[i]}`);
      writeFileSync(f, c);
      return f;
    });
    return fn(files);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
};

const judge = (expect, a, b, re = '^\\{"(ok|scope)') =>
  withOutputs([a, b], (files) => sh('judge_outputs "$@"', [expect, re, ...files]));

const OK = '{"ok": true}\n';
const GONE = 'ERROR:  profile_not_found\nCONTEXT:  PL/pgSQL function ...\n';

test('두 쪽 모두 결과 줄이면 통과', () => {
  assert.equal(judge('-', OK, '{"scope": "family"}\n').status, 0);
});

test('한쪽 결과 줄이 없으면 FAIL — "행이 0"만으로는 PASS 아님(DECISIONS #271)', () => {
  const r = judge('-', OK, '\n');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /x\.b 쪽 결과 줄 없음/);
});

test('기대 오류가 -면 ERROR는 FAIL', () => {
  const r = judge('-', OK, GONE);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /x\.b 쪽 기대하지 않은 오류 — ERROR:  profile_not_found/);
});

test('기대 오류 정규식과 맞는 ERROR는 그 연결의 정상 결과로 친다(#275 QA-1 L-b)', () => {
  assert.equal(judge('profile_not_found|invalid', OK, GONE).status, 0);
});

test('기대 오류 정규식과 다른 ERROR는 FAIL', () => {
  const r = judge('invalid_target', OK, GONE);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /기대하지 않은 오류/);
});

test('교착은 기대 오류에 맞아도 FAIL', () => {
  const r = judge('deadlock|profile_not_found', OK, 'ERROR:  deadlock detected\nDETAIL:  Process 1 waits\n');
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim(), '교착(deadlock detected)');
});

test('event-day-race 결과 줄({"ok": true}만)로도 같은 규칙', () => {
  const re = '^\\{"ok": true\\}';
  assert.equal(judge('-', `{"sub": "x"}\n${OK}`, OK, re).status, 0);
  assert.equal(judge('-', OK, '{"ok": false}\n', re).status, 1);
});

test('config.toml 에서 쓰는 543xx 끝자리만 뽑는다(주석 줄 제외)', () => {
  const r = sh('temp_stack_suffixes "$1"', [CONFIG]);
  assert.equal(r.status, 0);
  const got = r.stdout.trim().split('\n');
  assert.ok(got.includes('22'), 'db 54322');
  assert.ok(!got.includes('25'), '주석 smtp_port 54325는 빼야 함');
});

test('PORT_BASE 를 주면 그대로, 형식이 틀리면 실패', () => {
  assert.equal(sh('pick_port_base 557 "$1"', [CONFIG], {PORT_BASE: '561'}).stdout.trim(), '561');
  const bad = sh('pick_port_base 557 "$1"', [CONFIG], {PORT_BASE: '543'});
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /550~599/);
});

test('기본 대역 포트가 차 있으면 다음 빈 대역을 고른다', async () => {
  // 기본 대역을 "지금 비어 있는 대역"으로 잡고 그 db 포트(xx22)를 직접 점유한다
  const free = sh('pick_port_base 590 "$1"', [CONFIG]).stdout.trim();
  assert.match(free, /^5[5-9]\d$/);
  const server = createServer();
  await new Promise((ok) => server.listen(Number(`${free}22`), '127.0.0.1', ok));
  try {
    const r = sh('pick_port_base "$1" "$2"', [free, CONFIG]);
    assert.equal(r.status, 0);
    assert.notEqual(r.stdout.trim(), free);
    const skip = sh('TEMP_STACK_SKIP="$1"; pick_port_base 550 "$2"', ['550 551', CONFIG]);
    assert.ok(!['550', '551'].includes(skip.stdout.trim()));
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});
