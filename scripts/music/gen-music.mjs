// Lyria(Gemini API)로 배경 음악 후보를 만든다. 사용: node scripts/music/gen-music.mjs --track bgm-home [--model lyria-3-clip-preview] [--out 이름]
// 키는 환경변수 GEMINI_API_KEY 또는 저장소 루트 .env.local(커밋 제외)에서만 읽고 출력하지 않는다.
// 출력: content/audio-raw/<이름>.mp3(커밋 제외). 검수·후처리(scripts/music/README 없이 assets-manifest 기록 참고) 뒤 content/audio/ 로 옮긴다.
// API: POST v1beta/interactions, Api-Revision 2026-05-20, 응답 output_audio(base64 MP3 44.1kHz 스테레오). 공식 문서 aistudio.google.com/docs/music-generation
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
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

function findAudio(node) {
  if (!node || typeof node !== 'object') return null;
  if ((node.type === 'audio' || node.mime_type?.startsWith?.('audio/')) && typeof node.data === 'string') return node.data;
  for (const v of Object.values(node)) {
    const r = findAudio(v);
    if (r) return r;
  }
  return null;
}

const {tracks} = JSON.parse(readFileSync(join(root, 'scripts/music/prompts.json'), 'utf8'));
const t = tracks.find((x) => x.id === opt('--track', ''));
if (!t) {
  console.error('대상이 없습니다. --track ' + tracks.map((x) => x.id).join('|'));
  process.exit(2);
}
const key = loadKey();
if (!key) {
  console.error('GEMINI_API_KEY가 없습니다(.env.local에 직접 적어 주세요).');
  process.exit(3);
}
const model = opt('--model', 'lyria-3-clip-preview');
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: {'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20'},
  body: JSON.stringify({model, input: t.prompt}),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`${t.id} 실패 HTTP ${res.status}:`, JSON.stringify(json).slice(0, 600));
  process.exit(1);
}
const b64 = json.output_audio?.data ?? findAudio(json);
if (!b64) {
  console.error(`${t.id}: 응답에서 오디오를 찾지 못했습니다. 응답 키:`, Object.keys(json).join(','));
  process.exit(1);
}
mkdirSync(join(root, 'content/audio-raw'), {recursive: true});
const out = join(root, 'content/audio-raw', `${opt('--out', t.id)}.mp3`);
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`${t.id} 저장: ${out} (${model})`);
