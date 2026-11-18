// 새 콘텐츠 날 게시(로드맵 SV-08): 검수표 게이트 → 사진 업로드(덮어쓰기 금지) → admin_publish_content RPC(0040, 끝에만·감사 행).
// 검수 전 사진은 공개 버킷에 올리지 않는다(게이트를 통과해야 업로드). 고칠 땐 이 스크립트로 새 날을 추가하고 옛 날은 admin_retire_content.
// 입력: 묶음 JSON(배열) — [{day_index, photo:"day-15.jpg"(content/photos/ 아래), caption, keyword, recall_questions[], prompt, option_a, option_b, starter_a?, starter_b?}]
//       검수표 content/review.md (형식은 content-gate.mjs 머리말)
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (키는 출력하지 않음)
// 사용: node scripts/photos/publish-content.mjs <묶음.json> --operator <처리자> [--reason "11월 3주차 추가"] [--check]
//       --check: 게이트만 검사(업로드·게시 안 함). 실제 실행은 대상 호스트를 보여 주고 환경 이름(staging|production)을 다시 입력해야 진행.
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {checkBatch, parseReview} from './content-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const batchPath = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--operator' && argv[argv.indexOf(a) - 1] !== '--reason');
const operator = opt('--operator');
const reason = opt('--reason') ?? '콘텐츠 추가';
const checkOnly = argv.includes('--check');
if (!batchPath || (!checkOnly && !operator)) {
  console.error('사용: node scripts/photos/publish-content.mjs <묶음.json> --operator <처리자> [--reason ...] [--check]');
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(3);
}
const auth = {Authorization: `Bearer ${key}`, apikey: key};

const entries = JSON.parse(readFileSync(resolve(batchPath), 'utf8'));
const review = parseReview(readFileSync(join(root, 'content/review.md'), 'utf8'));
const maxRes = await fetch(`${url}/rest/v1/content_photos?select=day_index&order=day_index.desc&limit=1`, {headers: auth});
if (!maxRes.ok) {
  console.error(`현재 콘텐츠 조회 실패 HTTP ${maxRes.status}`);
  process.exit(1);
}
const existingMax = (await maxRes.json())[0]?.day_index ?? 0;
const problems = checkBatch(entries, review, existingMax);
if (problems.length) {
  console.error('게시할 수 없어요(사진은 올리지 않았어요):\n- ' + problems.join('\n- '));
  process.exit(2);
}
console.log(`게이트 통과: day ${entries.map((e) => e.day_index).join(', ')} (지금 끝 ${existingMax})`);
if (checkOnly) process.exit(0);

// 대상 확인: 호스트를 보여 주고 환경 이름을 다시 입력받는다(production은 한 번 더)
const host = new URL(url).host;
console.log(`대상: ${host}`);
const rl = createInterface({input: process.stdin, output: process.stdout});
const env = (await rl.question('이 대상의 환경 이름을 입력하세요(local|staging|production): ')).trim();
const expectLocal = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
if (!['local', 'staging', 'production'].includes(env) || (env === 'local') !== expectLocal) {
  console.error('환경 이름이 대상과 맞지 않아 멈춥니다.');
  process.exit(2);
}
if (env === 'production' && (await rl.question('production에 게시합니다. 호스트를 그대로 입력하세요: ')).trim() !== host) {
  console.error('호스트가 달라 멈춥니다.');
  process.exit(2);
}
rl.close();

const days = [];
for (const e of entries) {
  const file = `day-${e.day_index}.jpg`;
  const up = await fetch(`${url}/storage/v1/object/content-photos/${file}`, {
    method: 'POST',
    headers: {...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'false', 'cache-control': 'max-age=3600'},
    body: readFileSync(join(root, 'content/photos', e.photo)),
  });
  if (!up.ok) {
    console.error(`${file} 업로드 실패 HTTP ${up.status} — 같은 이름 파일이 이미 있으면 덮어쓰지 않습니다`);
    process.exit(1);
  }
  const {photo, ...rest} = e;
  days.push({...rest, image_url: `${url}/storage/v1/object/public/content-photos/${file}`});
}
const res = await fetch(`${url}/rest/v1/rpc/admin_publish_content`, {
  method: 'POST',
  headers: {...auth, 'Content-Type': 'application/json'},
  body: JSON.stringify({p_days: days, p_operator: operator, p_reason: reason}),
});
const body = await res.json().catch(() => null);
if (!res.ok || !body?.ok) {
  console.error('게시 실패:', JSON.stringify(body)?.slice(0, 200), '— 올린 사진은 참조되지 않은 채 남습니다(같은 날로 다시 실행하면 업로드 단계에서 멈추니 저장소 대시보드에서 지우세요)');
  process.exit(1);
}
console.log(`게시 완료: day ${body.days.join(', ')} (감사 기록 남김)`);
