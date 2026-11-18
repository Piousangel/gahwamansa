// 확정 푸시 문구를 서버 표(push_copy·cheer_texts, 0033·0038)에 넣는다. 원본은 docs/team/copy.ko.json 한 곳(push.*, cheers.*).
// 문구가 서버에 들어가야 실제 발송이 된다(비어 있으면 함수가 보내지 않음). 법률 리뷰(WR-02, 혜택·유료·재방문 재촉 금지)를 마친 뒤에만 --approved로 실행한다.
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (키는 출력하지 않음)
// 사용: node supabase/ops/load-push-copy.mjs --approved         (확인만: --dry-run)
// 실행 시 대상 호스트를 보여 주고 환경 이름(local|staging|production)을 다시 입력해야 진행, production은 호스트를 한 번 더(리뷰 L2). 금지어가 있으면 멈춘다.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {execFileSync} from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const copy = JSON.parse(readFileSync(join(root, 'docs/team/copy.ko.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const p = copy.push ?? {};

// copy.ko.json 키 → 서버 종류. 자리값({설명}·{응원}·{n}·{호칭})은 서버 push_render가 채운다.
const rows = [
  {kind: 'daily', title: p.daily?.title, body: p.daily?.body, body_fallback: p.daily?.body_fallback ?? null, body_many: null},
  {kind: 'cheer_arrived', title: p.cheer?.title, body: p.cheer?.body, body_fallback: null, body_many: p.cheer?.body_many ?? null},
  {kind: 'parent_connected', title: p.connected?.title, body: p.connected?.body, body_fallback: null, body_many: null},
  {kind: 'parent_reconnected', title: p.reconnected?.title, body: p.reconnected?.body, body_fallback: null, body_many: null},
];
const cheerKeys = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'];
const cheers = cheerKeys.map((k) => ({message_key: k, text: copy.cheers?.[k]}));

const problems = [];
for (const r of rows) {
  if (!r.title || !r.body) problems.push(`push.${r.kind}: 제목·본문 없음`);
  if ((r.title ?? '').length > 30) problems.push(`push.${r.kind}: 제목 30자 초과`);
  for (const f of ['body', 'body_fallback', 'body_many']) if ((r[f] ?? '').length > 60) problems.push(`push.${r.kind}.${f}: 60자 초과`);
}
for (const c of cheers) if (!c.text || c.text.length > 60) problems.push(`cheers.${c.message_key}: 없거나 60자 초과`);
// 금지어(WR-02·법률 체크리스트 #10): 혜택·유료·재방문 재촉·광고 표시가 들어가면 적재하지 않는다
const BANNED = ['혜택', '무료', '할인', '유료', '이벤트', '쿠폰', '다시 오세요', '(광고)', '광고'];
for (const r of [...rows.flatMap((x) => [x.title, x.body, x.body_fallback, x.body_many]), ...cheers.map((c) => c.text)]) {
  for (const w of BANNED) if ((r ?? '').includes(w)) problems.push(`금지어 "${w}": ${r}`);
}
if (problems.length) {
  console.error('문구 확인 필요:\n- ' + problems.join('\n- '));
  process.exit(2);
}

console.log(`넣을 문구: push ${rows.length}종, 응원 문장 ${cheers.length}개`);
for (const r of rows) console.log(`  ${r.kind}: ${r.title} / ${r.body}`);
if (args.has('--dry-run')) process.exit(0);
if (!args.has('--approved')) {
  console.error('법률 리뷰를 마친 문구인지 확인한 뒤 --approved 를 붙여 실행하세요.');
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(3);
}
// 대상 확인(리뷰 L2): 호스트를 보여 주고 환경 이름을 다시 입력받는다. production은 호스트를 한 번 더.
// 문구가 들어가는 순간 발송 조건이 충족되므로, 셸에 남은 다른 환경 키로 잘못 넣지 않게 한다.
const host = new URL(url).host;
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();
} catch {}
console.log(`대상: ${host}  (copy.ko.json 커밋 ${commit})`);
const rl = createInterface({input: process.stdin, output: process.stdout});
const envName = (await rl.question('이 대상의 환경 이름을 입력하세요(local|staging|production): ')).trim();
const isLocal = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
if (!['local', 'staging', 'production'].includes(envName) || (envName === 'local') !== isLocal) {
  console.error('환경 이름이 대상과 맞지 않아 멈춥니다.');
  process.exit(2);
}
if (envName === 'production' && (await rl.question('production 실발송이 시작됩니다. 호스트를 그대로 입력하세요: ')).trim() !== host) {
  console.error('호스트가 달라 멈춥니다.');
  process.exit(2);
}
rl.close();
async function upsert(table, body, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'},
    body: JSON.stringify(body.map((b) => ({...b, updated_at: new Date().toISOString()}))),
  });
  if (!res.ok) {
    console.error(`${table} 실패 HTTP ${res.status}`, (await res.text()).slice(0, 200));
    process.exit(1);
  }
}
await upsert('push_copy', rows, 'kind');
await upsert('cheer_texts', cheers, 'message_key');
console.log(`완료: ${envName}(${host})에 커밋 ${commit} 문구 적재 — 적재 기록을 운영 대장에 남기세요`);
