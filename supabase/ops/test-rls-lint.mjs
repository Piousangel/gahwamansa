// pgTAP 헛통과 방지 결정적 검사(11-20, '헛통과 테스트 → 실패 확인' 규칙 후속).
// 앱 역할(pg_temp.act_as·set local role authenticated|anon) 상태에서 표를 직접 세는 단언(count(*)·exists)은 RLS 때문에
// 서버가 실제로 만든·지운 행이 안 보여 늘 통과할 수 있다(#218 실패 확인에서 실제로 발견). 그런 단언은 둘 중 하나여야 한다:
//   (a) 그 앞에서 reset role(RLS 없이 셈) — 부작용(서버 상태) 확인
//   (b) 줄 끝에 `-- rls:의도` 표시 — "앱 역할에서 이렇게 보여야 한다"는 RLS 확인 자체(또는 고장을 넣어 실패를 확인한 단언)
// 함수 반환값(jsonb)을 세는 단언은 대상이 아니다(표를 직접 읽지 않음).
// 사용: node supabase/ops/test-rls-lint.mjs [테스트 디렉터리]   → 위반 줄을 출력하고, 있으면 종료 코드 1
// 테스트: node --test supabase/ops/test-rls-lint.test.mjs
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

/** 순수 검사: 위반 [{line, text}] */
export function lintSql(sql) {
  const out = [];
  let role = 'postgres';
  sql.split('\n').forEach((raw, idx) => {
    const s = raw.trim().toLowerCase();
    if (s.startsWith('--')) return;
    if (/^select pg_temp\.act_as\(/.test(s)) role = 'authenticated';
    const m = /^set local role (\w+)/.exec(s);
    if (m) role = m[1];
    if (/^reset role/.test(s)) role = 'postgres';
    if ((role === 'authenticated' || role === 'anon')
        && /select (is|ok|cmp_ok)\(/.test(s)
        && /\bfrom public\.\w+/.test(s)
        && /(count\(\*\)|exists\s*\()/.test(s)
        && !/--\s*rls:의도/.test(raw)) {
      out.push({line: idx + 1, text: raw.trim().slice(0, 140)});
    }
  });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', 'tests');
  let bad = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    for (const v of lintSql(readFileSync(join(dir, f), 'utf8'))) {
      console.log(`${f}:${v.line} 앱 역할로 표를 직접 셈 — reset role 뒤에 세거나, RLS 확인이 목적이면 줄 끝에 '-- rls:의도': ${v.text}`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log('test-rls-lint: 위반 없음');
}
