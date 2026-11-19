// 미리 생성 음성 — 읽을 문장 목록 만들기(DECISIONS 11-19 "미리 생성 음성 빌드 1에 넣음").
// 앱의 '읽어 주세요'가 읽는 글만 모은다. 출처는 고정 문구뿐:
//   - 콘텐츠 시드 supabase/seed_content_14d.sql·30d.sql 의 seed_photos(회상 질문 2개·낱말)와 seed_questions(질문·선택지 2개)
//     (첫마디 starter_* 는 자녀 화면 글이라 읽지 않음 → 제외)
//   - 게시 묶음 JSON(--batch, publish-content.mjs 입력과 같은 형식)이 있으면 그 날들도
//   - copy.ko.json 의 tts.read 틀 + cheers 4개(서버 확정 키, 자유 입력 아님)
// 문장은 앱과 **같은 함수**(app/src/audio/readText.ts, node 타입 지우기로 그대로 import)로 만들고 나눈다 → 글자 하나까지 같다.
// 개인정보: 사용자 입력·자녀 글·이름·연락처는 출처에 없다. 그래도 privacyProblems 로 숫자 4자리 이상·@·주소·틀 자리표시를 막는다.
// 사용: node scripts/tts/lines.mjs [--batch 묶음.json ...] [--json]   (목록·문자 수만 출력, 네트워크 없음)
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readTextBuilders, splitSentences} from '../../app/src/audio/readText.ts';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SEEDS = ['supabase/seed_content_14d.sql', 'supabase/seed_content_30d.sql'];

/**
 * `insert into <table> values (...), (...);` 묶음의 행을 읽는다. 값은 숫자·'문자열'(''는 따옴표 하나)·array['..', '..'] 만.
 * `-- 주석`은 건너뛴다. 이 시드 형식만 다루는 작은 해석기(일반 SQL 해석기가 아님).
 */
export function parseSeedRows(sql, table) {
  const head = new RegExp(`insert\\s+into\\s+${table}\\s+values`, 'i').exec(sql);
  if (!head) return [];
  const rows = [];
  let i = head.index + head[0].length;
  let depth = 0;
  let row = null;
  let arr = null;
  const push = (v) => (arr ? arr.push(v) : row.push(v));
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === "'") {
      let s = '';
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (sql[i] === "'") {
          i++;
          break;
        } else {
          s += sql[i++];
        }
      }
      push(s);
      continue;
    }
    if (ch === ';' && depth === 0) break;
    if (ch === '(') {
      depth++;
      if (depth === 1) row = [];
    } else if (ch === ')') {
      depth--;
      if (depth === 0) rows.push(row);
    } else if (/[0-9]/.test(ch) && row && !arr) {
      let n = '';
      while (/[0-9]/.test(sql[i])) n += sql[i++];
      row.push(Number(n));
      continue;
    } else if (sql.slice(i, i + 6).toLowerCase() === 'array[') {
      arr = [];
      i += 6;
      continue;
    } else if (ch === ']' && arr) {
      row.push(arr);
      arr = null;
    }
    i++;
  }
  return rows;
}

/** 시드·묶음 → 날별 콘텐츠 {day, recall_questions, keyword, prompt, option_a, option_b} */
export function loadContent({seeds = SEEDS, batches = []} = {}) {
  const days = new Map();
  const at = (d) => days.get(d) ?? days.set(d, {day: d}).get(d);
  for (const f of seeds) {
    const sql = readFileSync(join(root, f), 'utf8');
    for (const [day, , , keyword, recall_questions] of parseSeedRows(sql, 'seed_photos')) {
      Object.assign(at(day), {keyword, recall_questions});
    }
    for (const [day, option_a, option_b, prompt] of parseSeedRows(sql, 'seed_questions')) {
      Object.assign(at(day), {option_a, option_b, prompt});
    }
  }
  for (const b of batches) {
    for (const e of JSON.parse(readFileSync(resolve(b), 'utf8'))) {
      const d = at(e.day_index);
      for (const k of ['keyword', 'recall_questions', 'prompt', 'option_a', 'option_b']) {
        if (e[k] !== undefined) d[k] = e[k];
      }
    }
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

/** 앱 keyboardMatch.syllables 와 같은 규칙(NFC, 공백 제거, 글자 단위) */
const syllables = (s) => Array.from(String(s).normalize('NFC').replace(/\s+/g, ''));

/**
 * 읽을 문장 목록(중복 제거). 각 항목 {text, sources:['day3.photo', 'cheer', ...]}.
 * 화면이 읽는 글(ReadAloud ttsText)을 같은 틀로 만들고 같은 함수로 나눈다.
 */
export function buildLines(copy, content) {
  const b = readTextBuilders(copy.tts.read);
  const map = new Map();
  const add = (text, src) => {
    for (const s of splitSentences(text)) {
      const e = map.get(s) ?? map.set(s, {text: s, sources: []}).get(s);
      e.sources.push(src);
    }
  };
  for (const c of content) {
    if (Array.isArray(c.recall_questions) && c.recall_questions.length > 0) add(b.photo(c.recall_questions), `day${c.day}.photo`);
    if (c.prompt) add(b.question(c.prompt, c.option_a ?? '', c.option_b ?? ''), `day${c.day}.question`);
    if (c.keyword) add(b.word(c.keyword, syllables(c.keyword)), `day${c.day}.word`);
  }
  // 응원: 한 개씩 온 날·여러 개 온 날 모두 머리말 문장 + 응원 문장으로 나뉜다(줄바꿈 이음)
  add(b.cheer(Object.values(copy.cheers)), 'cheer');
  return [...map.values()];
}

/** 보내면 안 되는 글 검사: 틀 자리표시가 남음, 숫자 4자리 이상(전화·번호), @·주소. 문제 목록(빈 배열이면 통과) */
export function privacyProblems(lines) {
  const out = [];
  for (const l of lines) {
    if (/[{}]/.test(l.text)) out.push(`틀 자리표시가 남음: ${l.text}`);
    if (/[0-9]{4,}/.test(l.text.replace(/[\s-]/g, ''))) out.push(`숫자 4자리 이상: ${l.text}`);
    if (/@|https?:|www\./i.test(l.text)) out.push(`메일·주소 모양: ${l.text}`);
  }
  return out;
}

export function loadCopy() {
  return JSON.parse(readFileSync(join(root, 'app/src/copy/copy.ko.json'), 'utf8'));
}

export function allLines({batches = []} = {}) {
  return buildLines(loadCopy(), loadContent({batches}));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const batches = argv.flatMap((a, i) => (argv[i - 1] === '--batch' ? [a] : []));
  const lines = allLines({batches});
  const problems = privacyProblems(lines);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(lines, null, 2));
  } else {
    for (const l of lines) console.log(`${String(l.text.length).padStart(3)}  ${l.text}   ← ${l.sources.join(', ')}`);
    console.log(`\n문장 ${lines.length}개 · ${lines.reduce((n, l) => n + l.text.length, 0)}자`);
  }
  if (problems.length > 0) {
    console.error(`보내면 안 되는 글 ${problems.length}개:\n${problems.join('\n')}`);
    process.exit(1);
  }
}
