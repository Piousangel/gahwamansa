// content/photos/day-NN.jpg 를 Supabase Storage(content-photos)에 올리고 content_photos.image_url을 갱신한다.
// 환경변수 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (로컬: `npx supabase status -o env`의 API_URL·SERVICE_ROLE_KEY). 키는 출력하지 않는다.
// 사용: node scripts/photos/upload-photos.mjs
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(3);
}
const dir = join(root, 'content/photos');
const files = readdirSync(dir).filter((f) => /^day-\d{2}\.jpg$/.test(f)).sort();
const auth = {Authorization: `Bearer ${key}`, apikey: key};
let fail = 0;
for (const f of files) {
  const day = Number(f.slice(4, 6));
  const up = await fetch(`${url}/storage/v1/object/content-photos/${f}`, {
    method: 'POST',
    headers: {...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': 'max-age=3600'},
    body: readFileSync(join(dir, f)),
  });
  if (!up.ok) {
    console.error(`${f} 업로드 실패 HTTP ${up.status}`, (await up.text()).slice(0, 200));
    fail++;
    continue;
  }
  const publicUrl = `${url}/storage/v1/object/public/content-photos/${f}`;
  const patch = await fetch(`${url}/rest/v1/content_photos?day_index=eq.${day}`, {
    method: 'PATCH',
    headers: {...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal'},
    body: JSON.stringify({image_url: publicUrl}),
  });
  if (!patch.ok) {
    console.error(`${f} image_url 갱신 실패 HTTP ${patch.status}`);
    fail++;
    continue;
  }
  console.log(`day ${day} 완료`);
}
process.exit(fail ? 1 : 0);
