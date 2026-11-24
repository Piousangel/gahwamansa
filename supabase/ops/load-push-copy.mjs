// 확정 푸시 문구를 서버 표(push_copy·cheer_texts, 0033·0038)에 넣는다. 원본은 docs/team/copy.ko.json 한 곳(push.*, cheers.*).
// 문구가 서버에 들어가야 실제 발송이 된다(비어 있으면 함수가 보내지 않음). 법률 리뷰(WR-02, 혜택·유료·재방문 재촉 금지)를 마친 뒤에만 --approved로 실행한다.
// 대상 주소·서버 키: ops-auth.mjs(키 숨김 입력 또는 ops용 secret 키 환경변수, 출력하지 않음)
// 사용: node supabase/ops/load-push-copy.mjs --approved         (확인만: --dry-run)
// 실행 시 대상 호스트를 보여 주고 환경 이름(local|staging|production)을 다시 입력해야 진행, production은 호스트를 한 번 더(리뷰 L2). 금지어가 있으면 멈춘다.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {confirmTarget} from './target-check.mjs';
import {opsTarget} from './ops-auth.mjs';
import {execFileSync} from 'node:child_process';
// 응원 키 정본은 앱 계약 한 곳(0060 cheer_key_ok 와 cheersContract.test.ts 가 대조). .ts 직접 import = Node 22.18+ 타입 제거(scripts/tts 와 같음)
import {CHEER_KEYS} from '../../app/src/api/contract/cheers.ts';

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
const cheers = CHEER_KEYS.map((k) => ({message_key: k, text: copy.cheers?.[k]}));

const problems = [];
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
for (const c of cheers) if (!c.text || c.text.length > 60) problems.push(`cheers.${c.message_key}: 없거나 60자 초과`);
// copy 에만 있고 계약에 없는 키는 서버 check(cheer_key_ok)가 거부한다 — 적재 전에 멈춘다
for (const k of Object.keys(copy.cheers ?? {})) if (!CHEER_KEYS.includes(k)) problems.push(`cheers.${k}: 계약(CHEER_KEYS)에 없는 키`);
// 금지어(WR-02·법률 체크리스트 #10): 혜택·유료·재방문 재촉·광고 표시가 들어가면 적재하지 않는다
// 서버 check(0046 push_text_clean)와 같은 목록 + 유료(서버는 문구 검사 대상 아님)
const BANNED = ['혜택', '할인', '이벤트', '무료', '쿠폰', '적립', '포인트', '경품', '광고', '다시 오세요', '유료'];
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

const {url, headers: keyH} = await opsTarget();
// 대상 확인(리뷰 L2·C-M1): 입력한 환경의 app/env/<환경>.env ref와 실제 호스트를 대조한다. production은 호스트를 한 번 더.
// 문구가 들어가는 순간 발송 조건이 충족되므로, 셸에 남은 다른 환경 키로 잘못 넣지 않게 한다.
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();
} catch {}
const host = new URL(url).host;
const envName = await confirmTarget(root, url, `푸시 문구 적재, copy.ko.json 커밋 ${commit}`);
async function upsert(table, body, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {...keyH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'},
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
