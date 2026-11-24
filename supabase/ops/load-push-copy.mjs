// 확정 푸시 문구를 서버 표(push_copy·cheer_texts, 0033·0038)에 넣는다. 원본은 docs/team/copy.ko.json 한 곳(push.*, cheers.*).
// 문구가 서버에 들어가야 실제 발송이 된다(비어 있으면 함수가 보내지 않음). 법률 리뷰(WR-02, 혜택·유료·재방문 재촉 금지)를 마친 뒤에만 --approved로 실행한다.
// 대상 주소·서버 키: ops-auth.mjs(키 숨김 입력 또는 ops용 secret 키 환경변수, 출력하지 않음)
// 사용: node supabase/ops/load-push-copy.mjs --approved   (대상 DB 확인까지만: --dry-run, 문구 파일만 검사: --check-copy)
// 응원 문장은 법률 승인 키(cheer-legal-approved.mjs)만 적재한다 — 계약 키(CHEER_KEYS)라도 승인 전 문장은 넣지 않는다(#244 QA-3 M1).
// 쓰기 전에 대상 DB가 그 키를 받는지(0060 cheer_key_ok, 없으면 0038 의 4키) 확인하고, 받지 않으면 아무것도 쓰지 않는다(#244 QA-1 M2).
// 적재 순서 cheer_texts → push_copy(앞이 실패하면 뒤는 쓰지 않음). 로직·시험: push-copy-plan.mjs·load-push-copy.test.mjs
// 실행 시 대상 호스트를 보여 주고 환경 이름(local|staging|production)을 다시 입력해야 진행, production은 호스트를 한 번 더(리뷰 L2). 금지어가 있으면 멈춘다.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {confirmTarget} from './target-check.mjs';
import {opsTarget} from './ops-auth.mjs';
import {execFileSync} from 'node:child_process';
import {LEGAL_APPROVED_CHEER_KEYS} from './cheer-legal-approved.mjs';
import {applyPlan, checkTargetAccepts, planCheers, readContractCheerKeys} from './push-copy-plan.mjs';

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
  // 0052 첫 답(자녀, 평생 1회). 자리값은 {호칭}만 — 답 내용·시각을 넣지 않는다(U11 예외 조건). 원본은 라이터 push.first_answer.
  {kind: 'parent_first_answer', title: p.first_answer?.title, body: p.first_answer?.body, body_fallback: null, body_many: null, optional: true},
];
// 응원 키 정본은 앱 계약 한 곳(cheers.ts CHEER_KEYS, 0060 cheer_key_ok 와 cheersContract.test.ts 가 대조). 글자로 읽는다(.ts import 안 함)
const CHEER_KEYS = readContractCheerKeys(root);
const plan = planCheers(copy.cheers, CHEER_KEYS, LEGAL_APPROVED_CHEER_KEYS);
const cheers = plan.cheers;

const problems = [...plan.problems];
// 라이터 문구가 아직 없는 선택 종류는 빼고 적재한다(서버는 문구가 없으면 그 종류를 보내지 않음)
for (const r of rows.filter((x) => x.optional && !x.title && !x.body)) console.log(`push.${r.kind}: 라이터 문구 대기 — 이번에는 적재하지 않아요`);
for (let i = rows.length - 1; i >= 0; i--) if (rows[i].optional && !rows[i].title && !rows[i].body) rows.splice(i, 1);
for (const r of rows) delete r.optional;
// 첫 답 문구에는 {호칭} 외 자리값을 쓰지 않는다(답 내용·시각 금지)
for (const r of rows.filter((x) => x.kind === 'parent_first_answer')) {
  for (const f of [r.title, r.body]) if (/\{(?!호칭\})[^}]*\}/.test(f ?? '')) problems.push(`push.first_answer: {호칭} 외 자리값 금지: ${f}`);
}
for (const r of rows) {
  if (!r.title || !r.body) problems.push(`push.${r.kind}: 제목·본문 없음`);
  if ((r.title ?? '').length > 30) problems.push(`push.${r.kind}: 제목 30자 초과`);
  for (const f of ['body', 'body_fallback', 'body_many']) if ((r[f] ?? '').length > 60) problems.push(`push.${r.kind}.${f}: 60자 초과`);
}
// 금지어(WR-02·법률 체크리스트 #10): 혜택·유료·재방문 재촉·광고 표시가 들어가면 적재하지 않는다
// 서버 check(0046 push_text_clean)와 같은 목록 + 유료(서버는 문구 검사 대상 아님)
const BANNED = ['혜택', '할인', '이벤트', '무료', '쿠폰', '적립', '포인트', '경품', '광고', '다시 오세요', '유료'];
for (const r of [...rows.flatMap((x) => [x.title, x.body, x.body_fallback, x.body_many]), ...CHEER_KEYS.map((k) => copy.cheers?.[k])]) {
  for (const w of BANNED) if ((r ?? '').includes(w)) problems.push(`금지어 "${w}": ${r}`);
}
if (problems.length) {
  console.error('문구 확인 필요:\n- ' + problems.join('\n- '));
  process.exit(2);
}

console.log(`넣을 문구: push ${rows.length}종, 응원 문장 ${cheers.length}개(법률 승인 키: ${cheers.map((c) => c.message_key).join(', ')})`);
if (plan.pending.length) console.log(`  법률 리뷰 대기라 넣지 않는 응원 키 ${plan.pending.length}개: ${plan.pending.join(', ')}`);
for (const r of rows) console.log(`  ${r.kind}: ${r.title} / ${r.body}`);
if (args.has('--check-copy')) process.exit(0);
const dryRun = args.has('--dry-run');
if (!dryRun && !args.has('--approved')) {
  console.error('법률 리뷰를 마친 문구인지 확인한 뒤 --approved 를 붙여 실행하세요(대상 DB 확인만: --dry-run).');
  process.exit(2);
}

const {url, headers: keyH} = await opsTarget();
// 대상 확인(리뷰 L2·C-M1): 입력한 환경의 app/env/<환경>.env ref와 실제 호스트를 대조한다. production은 호스트를 한 번 더.
// 어떤 네트워크 요청(키를 싣는 대상 DB 확인 포함, --dry-run 도)보다 먼저 한다(#244 QA-3 재확인 M1) — 셸에 남은 다른 환경 키로 엉뚱한 서버에 요청하지 않게.
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();
} catch {}
const host = new URL(url).host;
const envName = await confirmTarget(root, url, `${dryRun ? '대상 DB 확인(dry-run, 쓰지 않음)' : '푸시 문구 적재'}, copy.ko.json 커밋 ${commit}`);
// 대상 DB 상태 확인(읽기만): 적재할 응원 키를 받는지. 받지 않으면 아무것도 쓰지 않고 멈춘다(반쪽 적재 방지)
async function rpc(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {method: 'POST', headers: {...keyH, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {}
  return {status: res.status, body: parsed};
}
const target = await checkTargetAccepts(rpc, cheers.map((c) => c.message_key));
console.log(`대상 ${new URL(url).host}: 0060(cheer_key_ok) ${target.has0060 === true ? '있음' : target.has0060 === false ? '없음(4키만 받음)' : '확인 못 함'}`);
if (target.problems.length) {
  console.error('대상 DB가 받지 않아 아무것도 쓰지 않아요:\n- ' + target.problems.join('\n- '));
  process.exit(4);
}
if (dryRun) {
  console.log('dry-run: 대상 DB가 위 문구를 받을 수 있어요(쓰지 않음)');
  process.exit(0);
}
async function upsert(table, body, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {...keyH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'},
    body: JSON.stringify(body.map((b) => ({...b, updated_at: new Date().toISOString()}))),
  });
  if (!res.ok) throw new Error(`${table} 실패 HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
try {
  await applyPlan(upsert, {rows, cheers}); // cheer_texts → push_copy, 앞이 실패하면 뒤는 쓰지 않음
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
console.log(`완료: ${envName}(${host})에 커밋 ${commit} 문구 적재 — 적재 기록을 운영 대장에 남기세요`);
