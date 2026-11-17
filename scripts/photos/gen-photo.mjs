// Gemini(나노바나나) API로 옛날 사진을 생성한다. 사용: node scripts/photos/gen-photo.mjs [--day N] [--all] [--dry-run] [--model ID]
// 키는 환경변수 GEMINI_API_KEY 또는 저장소 루트의 .env.local(커밋 제외)에서만 읽는다. 키를 출력하지 않는다.
// 출력: content/photos-raw/day-NN.png(커밋 제외, 검수 후 승인된 것만 별도로 옮긴다)
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const f = join(root, '.env.local');
  if (existsSync(f)) {
    const m = readFileSync(f, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const {base, photos} = JSON.parse(readFileSync(join(root, 'scripts/photos/prompts.json'), 'utf8'));
const model = opt('--model', 'gemini-nano-banana-2.1'); // 공식 문서(aistudio.google.com/docs/image-generation) 기준, 바뀔 수 있음
const aspect = opt('--aspect', '5:4');
const size = opt('--size', '1K');
const only = opt('--day', null);
const targets = flag('--all') ? photos : photos.filter((p) => String(p.day) === String(only));
if (!targets.length) {
  console.error('대상이 없습니다. --day N 또는 --all 을 지정하세요.');
  process.exit(2);
}

const key = loadKey();
if (!key && !flag('--dry-run')) {
  console.error('GEMINI_API_KEY가 없습니다. 저장소 루트의 .env.local에 GEMINI_API_KEY=... 한 줄을 편집기로 직접 적어 주세요(채팅에 붙이지 마세요).');
  process.exit(3);
}

function findImage(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'image' && typeof node.data === 'string') return node.data;
  for (const v of Object.values(node)) {
    const r = findImage(v);
    if (r) return r;
  }
  return null;
}

mkdirSync(join(root, 'content/photos-raw'), {recursive: true});
for (const p of targets) {
  const text = base.replace('{SUBJECT}', p.subject);
  const body = {model, input: [{type: 'text', text}], response_format: {aspect_ratio: aspect, image_size: size}};
  if (flag('--dry-run')) {
    console.log(`[dry-run] day ${p.day} ${model} ${aspect} ${size}\n${text}\n`);
    continue;
  }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20'},
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`day ${p.day} 실패 HTTP ${res.status}:`, JSON.stringify(json).slice(0, 600));
    continue;
  }
  const b64 = json.output_image?.data ?? findImage(json);
  if (!b64) {
    console.error(`day ${p.day}: 응답에서 이미지를 찾지 못했습니다. 응답 키:`, Object.keys(json).join(','));
    continue;
  }
  const out = join(root, 'content/photos-raw', `day-${String(p.day).padStart(2, '0')}.png`);
  writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`day ${p.day} 저장: ${out}`);
}
