// pgTAP 헛통과 방지 결정적 검사(11-20, '헛통과 테스트 → 실패 확인' 규칙 후속).
// 앱 역할(authenticated·anon) 상태에서 표를 직접 세는 단언(count(*)·exists)은 RLS 때문에
// 서버가 실제로 만든·지운 행이 안 보여 늘 통과할 수 있다(#218 실패 확인에서 실제로 발견). 그런 단언은 둘 중 하나여야 한다:
//   (a) 그 앞에서 reset role(RLS 없이 셈) — 부작용(서버 상태) 확인
//   (b) 단언 안(어느 줄이든)에 `-- rls:의도 <이유>` 표시 — "앱 역할에서 이렇게 보여야 한다"는 RLS 확인 자체.
//       이유 글이 없으면 위반이다(#219 리뷰 M1: 표시만 달고 넘어가지 못하게).
// 역할 추적(#219 리뷰 L2): `set local role X`·`set role X`(local 없음)·`reset role`, pg_temp.act_as, 그리고 이 파일에서
//   `set role`·`set local role`을 실행하는 pg_temp 도우미 함수(이름 무관)를 부르면 앱 역할로 본다.
// 단언은 세미콜론까지 모아 한 문장으로 본다(#219 리뷰 L1: 여러 줄 단언). 함수 반환값(jsonb)만 세는 단언은 대상이 아니다.
// 대상 모양(#219 2차 리뷰 L로 넓힘): 값 비교 단언(is·ok·cmp_ok·isnt) 안의 count(*)·count(1)·count(열)·exists,
//   그리고 결과 집합 단언(results_eq·results_ne·set_eq·set_ne·bag_eq·bag_ne·is_empty·isnt_empty·row_eq)이 표를 읽는 경우.
//   표는 from public.X·storage.X와 스키마를 생략한 from X(함수 호출·pg_ 카탈로그·이 파일의 임시 표·CTE 이름·extract(… from …) 등 제외).
//   (#222 리뷰 L) count(distinct 열)도 잡는다.
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

/** 이 파일이 만든 임시 표 이름(create temp table X) — RLS가 없으므로 대상에서 뺀다 */
function tempTables(sql) {
  return new Set([...sql.matchAll(/create\s+(?:local\s+)?temp(?:orary)?\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)].map((m) => m[1].toLowerCase()));
}

// 스키마 없이 쓴 이름 중 표가 아닌 것(시스템 카탈로그·도우미)
const NOT_RLS = /^(pg_\w+|information_schema|jsonb?_\w+|unnest|generate_series|lateral|only|current_date|current_timestamp|current_time|localtime|localtimestamp)$/;

/** 문장이 RLS가 걸릴 수 있는 표를 읽는가: from public.X, 또는 스키마 없는 from X(함수 호출·카탈로그·임시 표 제외) (#219 2차 L) */
function readsTable(s, temps) {
  // (#222 리뷰 L) 표가 아닌 from을 먼저 걷어낸다: extract·substring·trim·overlay·position(… from …)
  const t = s.replace(/\b(extract|substring|trim|overlay|position)\s*\(([^()]|\([^()]*\))*\)/g, '$1()');
  // 이 문장의 CTE 이름(with X as (…), , Y as (…))
  const ctes = new Set([...t.matchAll(/(?:\bwith(?:\s+recursive)?|,)\s+"?(\w+)"?\s*(?:\([^)]*\)\s*)?as\s*(?:not\s+)?(?:materialized\s+)?\(/g)].map((m) => m[1]));
  // 스키마를 붙인 표: public과 RLS를 쓰는 다른 스키마(storage). 뒤에 ( 가 오면 함수 호출이라 뺀다
  for (const m of t.matchAll(/\bfrom\s+(?:only\s+)?"?(public|storage)"?\s*\.\s*"?(\w+)"?(\s*\()?/g)) {
    if (!m[3]) return true;
  }
  for (const m of t.matchAll(/\bfrom\s+(?:only\s+)?"?([a-z_]\w*)\b"?(?!\s*[.(])/g)) {
    const name = m[1];
    if (NOT_RLS.test(name) || temps.has(name) || ctes.has(name)) continue;
    return true;
  }
  return false;
}

/** 순수 검사: 위반 [{line, text, why}] */
export function lintSql(sql) {
  const helpers = roleHelpers(sql);
  const temps = tempTables(sql);
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
    if (!readsTable(s, temps)) continue;
    // 값 비교 단언(is·ok·cmp_ok·isnt)은 개수·존재를 셀 때만, 결과 집합 단언(results_eq 등)은 표를 읽기만 해도 대상
    const countLike = /\bselect\s+(is|ok|cmp_ok|isnt)\s*\(/.test(s) && /(\bcount\s*\(\s*(distinct\s+|all\s+)?(\*|1|"?[\w.]+"?)\s*\)|\bexists\s*\()/.test(s);
    const setLike = /\bselect\s+(results_eq|results_ne|set_eq|set_ne|bag_eq|bag_ne|is_empty|isnt_empty|row_eq)\s*\(/.test(s);
    if (!countLike && !setLike) continue;
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
