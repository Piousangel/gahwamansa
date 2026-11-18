// 테스터 가족 표시·해제(0045, 리드 결정 is_test). 지표 SQL(metrics.sql)이 테스터 가족을 뺀다. 알림·기능은 그대로.
// 대상 지정: 자녀 메일(--email, 테스터가 알려 준 가입 메일) 또는 가족 id(--family). 메일·id 전체는 출력하지 않는다(끝 4자리만).
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. 실행 전 대상 호스트를 보여 주고 app/env/<환경>.env ref와 대조(production은 호스트 재입력).
// 사용: node supabase/ops/mark-test-family.mjs --email tester@gmail.com --operator <처리자> [--unset] [--reason "비공개 테스트 테스터"]
//       node supabase/ops/mark-test-family.mjs --family <family id> --operator <처리자> [--unset]
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {confirmTarget} from './target-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
const email = opt('--email');
const familyArg = opt('--family');
const operator = opt('--operator');
const reason = opt('--reason') ?? '비공개 테스트 테스터';
const isTest = !argv.includes('--unset');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !operator || (!email && !familyArg)) {
  console.error('사용: SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY + (--email <메일> | --family <id>) --operator <처리자> [--unset] [--reason ...]');
  process.exit(2);
}
const tail = (s) => `…${String(s).slice(-4)}`;
await confirmTarget(root, url, `테스터 ${isTest ? '표시' : '해제'}`);
const h = {Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json'};

let family = familyArg;
if (!family) {
  // 메일 → 인증 사용자 → 자녀 프로필의 가족
  let userId = null;
  for (let page = 1; page < 100 && !userId; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, {headers: h});
    if (!res.ok) {
      console.error(`사용자 목록 실패 HTTP ${res.status}`);
      process.exit(1);
    }
    const users = (await res.json()).users ?? [];
    userId = users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())?.id ?? null;
    if (users.length < 1000) break;
  }
  if (!userId) {
    console.error('그 메일의 계정이 없어요.');
    process.exit(1);
  }
  const p = await fetch(`${url}/rest/v1/profiles?select=family_id,role&user_id=eq.${userId}`, {headers: h});
  const rows = p.ok ? await p.json() : [];
  family = rows.find((r) => r.role === 'child')?.family_id;
  if (!family) {
    console.error('그 계정은 자녀로 가족에 연결돼 있지 않아요.');
    process.exit(1);
  }
}
const res = await fetch(`${url}/rest/v1/rpc/admin_set_test_family`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({p_family: family, p_is_test: isTest, p_reason: reason, p_operator: operator}),
});
const body = await res.json().catch(() => null);
if (!res.ok || !body?.ok) {
  console.error('실패:', JSON.stringify(body)?.slice(0, 120));
  process.exit(1);
}
console.log(`가족 ${tail(family)}: 테스터 ${isTest ? '표시' : '해제'} 완료(감사 기록 남김)`);
