// pgTAP 헛통과 방지 결정적 검사(11-20, '헛통과 테스트 → 실패 확인' 규칙 후속).
// 앱 역할(authenticated·anon) 상태에서 표를 직접 세는 단언(count(*)·exists)은 RLS 때문에
// 서버가 실제로 만든·지운 행이 안 보여 늘 통과할 수 있다(#218 실패 확인에서 실제로 발견). 그런 단언은 둘 중 하나여야 한다:
//   (a) 그 앞에서 reset role(RLS 없이 셈) — 부작용(서버 상태) 확인
//   (b) 단언 안(어느 줄이든)에 `-- rls:의도 <이유>` 표시 — "앱 역할에서 이렇게 보여야 한다"는 RLS 확인 자체.
//       이유 글이 없으면 위반이다(#219 리뷰 M1: 표시만 달고 넘어가지 못하게).
// 역할 추적(#219 리뷰 L2): `set local role X`·`set role X`(local 없음)·`reset role`, pg_temp.act_as, 그리고 이 파일에서
//   `set role`·`set local role`을 실행하는 pg_temp 도우미 함수(이름 무관)를 부르면 앱 역할로 본다.
// 단언은 세미콜론까지 모아 한 문장으로 본다(#219 리뷰 L1: 여러 줄 단언). 함수 반환값(jsonb)만 세는 단언은 대상이 아니다.
// 사용: node supabase/ops/test-rls-lint.mjs [테스트 디렉터리]   → 위반을 출력하고, 있으면 종료 코드 1
// 테스트: node --test supabase/ops/test-rls-lint.test.mjs
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const APP_ROLES = new Set(['authenticated', 'anon']);

/** 이 파일에서 역할을 바꾸는 pg_temp 도우미 이름들 */
function roleHelpers(sql) {
  const names = new Set();
  const re = /create\s+(?:or\s+replace\s+)?function\s+pg_temp\.(\w+)\s*\(([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
  for (const m of sql.matchAll(re)) {
    if (/\bset\s+(?:local\s+)?role\b/i.test(m[3])) names.add(m[1].toLowerCase());
  }
  return names;
}

/** 줄들을 문장(세미콜론까지)으로 묶는다. 주석 줄은 문장 밖이면 건너뛴다. 함수 본문($$…$$)은 한 문장으로. */
function statements(sql) {
  const out = [];
  let buf = [];
  let start = 0;
  let inDollar = false;
  sql.split('\n').forEach((raw, idx) => {
    const code = raw.replace(/--.*$/, '');
    if (!buf.length && !inDollar && !code.trim()) return; // 문장 밖 빈 줄·주석 줄
    if (!buf.length) start = idx + 1;
    buf.push(raw);
    const dollars = (code.match(/\$\$/g) || []).length;
    if (dollars % 2 === 1) inDollar = !inDollar;
    if (!inDollar && /;\s*$/.test(code)) {
      out.push({line: start, text: buf.join('\n')});
      buf = [];
    }
  });
  if (buf.length) out.push({line: start, text: buf.join('\n')});
  return out;
}

/** 순수 검사: 위반 [{line, text, why}] */
export function lintSql(sql) {
  const helpers = roleHelpers(sql);
  const out = [];
  let role = 'postgres';
  for (const st of statements(sql)) {
    const code = st.text.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
    const s = code.trim().toLowerCase();
    if (/^create\s/.test(s) || /^grant\s/.test(s)) continue;
    let m;
    if (/^reset\s+role\b/.test(s)) role = 'postgres';
    else if ((m = /^set\s+(?:local\s+)?role\s+"?(\w+)"?/.exec(s))) role = m[1];
    else if ((m = /^select\s+pg_temp\.(\w+)\s*\(/.exec(s)) && (m[1] === 'act_as' || helpers.has(m[1]))) role = 'authenticated';
    if (!APP_ROLES.has(role)) continue;
    if (!/select\s+(is|ok|cmp_ok)\s*\(/.test(s) || !/\bfrom\s+public\.\w+/.test(s) || !/(count\(\*\)|exists\s*\()/.test(s)) continue;
    const mark = /--\s*rls:의도(.*)$/m.exec(st.text);
    if (!mark) out.push({line: st.line, text: st.text.trim().split('\n')[0].slice(0, 140), why: 'no_mark'});
    else if (!mark[1].trim()) out.push({line: st.line, text: st.text.trim().split('\n')[0].slice(0, 140), why: 'no_reason'});
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', 'tests');
  let bad = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    for (const v of lintSql(readFileSync(join(dir, f), 'utf8'))) {
      const how = v.why === 'no_reason' ? "'-- rls:의도' 뒤에 무엇을 확인하는지 이유를 적으세요"
        : "reset role 뒤에 세거나, RLS 확인이 목적이면 '-- rls:의도 <이유>'";
      console.log(`${f}:${v.line} 앱 역할로 표를 직접 셈 — ${how}: ${v.text}`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log('test-rls-lint: 위반 없음');
}
