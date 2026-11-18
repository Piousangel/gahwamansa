// content/photos/day-NN.jpg 를 Supabase Storage(content-photos)에 올리고 content_photos.image_url을 갱신한다.
// 대상 주소·서버 키는 실행 중 입력(키는 화면에 안 보임). 로컬은 `npx supabase status`의 API URL·secret 키. 키는 출력하지 않는다.
// 사용: node scripts/photos/upload-photos.mjs
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {opsTarget} from '../../supabase/ops/ops-auth.mjs';
import {confirmTarget} from '../../supabase/ops/target-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// 대상 주소·서버 키: ops-auth.mjs(키 숨김 입력 또는 ops용 secret 키 환경변수 SUPABASE_SECRET_KEY, 출력하지 않음), 대상 ref 대조
const {url, headers: auth} = await opsTarget();
await confirmTarget(root, url, '사진 업로드(주소 갱신은 감사 기록)');
const dir = join(root, 'content/photos');
const files = readdirSync(dir).filter((f) => /^day-\d{2}\.jpg$/.test(f)).sort();
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
