// 대기열 66(0069): 앱 CONSENT_VERSION은 서버 허용 목록(consent_versions) 안에 있어야 한다.
// 목록에 없는 버전으로 앱을 올리면 give_consent가 invalid_version으로 거부해 어르신이 동의를 못 한다 —
// 새 문구 버전은 "목록에 더하는 마이그레이션 먼저, 앱 CONSENT_VERSION은 그다음" 순서를 이 검사가 강제한다.
// 실행: node --test supabase/ops/consent-version-sync.test.mjs (CI server.yml '운영 스크립트·콘텐츠 게이트')
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** 마이그레이션 중 consent_versions()를 마지막으로 정의한 파일의 목록 */
function serverList() {
  const dir = join(root, 'supabase/migrations');
  let list = null;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const m = sql.match(/function\s+public\.consent_versions\(\)[\s\S]*?\$\$\s*select\s+array\[([^\]]*)\]\s*\$\$/i);
    if (m) list = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  }
  return list;
}

test('앱 CONSENT_VERSION이 서버 허용 목록 안에 있다', () => {
  const copy = readFileSync(join(root, 'app/src/copy/copy.ts'), 'utf8');
  const app = copy.match(/export const CONSENT_VERSION = '([^']+)'/)?.[1];
  const list = serverList();
  assert.ok(app, 'app/src/copy/copy.ts에서 CONSENT_VERSION을 찾지 못함');
  assert.ok(list && list.length > 0, '마이그레이션에서 consent_versions() 목록을 찾지 못함');
  assert.ok(list.includes(app), `앱 ${app}이 서버 목록 [${list.join(', ')}]에 없음 — 목록에 더하는 마이그레이션을 먼저 넣는다`);
});
