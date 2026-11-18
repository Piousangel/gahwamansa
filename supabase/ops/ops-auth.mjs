// 운영 스크립트 공용: 대상 주소와 서버 키 받기(보안 회의 D9·D13·E3, xhigh 리뷰 M3·L4·L5·L6).
// - 주소: SUPABASE_URL 환경변수, 없으면 물어본다(비밀 아님). https만 받는다(local은 http://127.0.0.1·localhost만). 경로는 버리고 origin만 쓴다.
// - 키: ops 전용 새 secret 키 SUPABASE_SECRET_KEY(sb_secret_…, Edge용 키와 별도 발급), 없으면 옛 SUPABASE_SERVICE_ROLE_KEY("옛 키 사용" 한 줄 출력),
//   둘 다 없으면 **화면에 보이지 않게** 입력받는다(터미널에서만 — 파이프·리다이렉트로 키를 넣는 것은 거부, 셸 기록 경로 차단).
//   프롬프트가 뜬 **뒤에** 붙여 넣는다(먼저 붙여 넣으면 터미널이 그대로 보여 준다 — 그래서 프롬프트 직전에 남은 입력을 버린다).
//   `KEY=값 node …`처럼 명령줄에 키를 쓰지 않는다(셸 기록에 남음).
//   환경변수로 줄 때는 비밀번호 관리자에서 `read -rs SUPABASE_SECRET_KEY; export SUPABASE_SECRET_KEY` 처럼 입력하고 끝나면 `unset`.
// - 헤더: 새 secret 키는 apikey만, 옛 JWT 키는 apikey + Authorization Bearer.
// - 순서: 스크립트는 opsTarget() 바로 뒤에 confirmTarget()을 부르고, 그 전에는 키로 요청하지 않는다(M3).
import {createInterface} from 'node:readline/promises';

/** 화면에 글자를 보이지 않고 한 줄을 읽는다. 터미널이 아니면 거부(null). */
export async function readHidden(prompt) {
  const stdin = process.stdin;
  if (!stdin.isTTY) return null;
  // 프롬프트 전에 미리 친 입력 버리기(L5): raw 모드 전 입력은 이미 화면에 보였으므로 키로 쓰지 않는다
  stdin.setRawMode(true);
  let stale = false;
  const drain = () => {
    stale = true;
  };
  stdin.on('data', drain);
  stdin.resume();
  await new Promise((r) => setTimeout(r, 50));
  stdin.off('data', drain);
  if (stale) process.stdout.write('\n(프롬프트 전에 입력된 글자는 버렸어요. 그 키가 화면에 보였다면 키를 다시 발급하세요.)\n');
  process.stdout.write(prompt);
  stdin.setEncoding('utf8');
  let value = '';
  return await new Promise((resolve) => {
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value.trim());
          return;
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === '\u007f') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

/** 키 → 헤더(순수 함수, 테스트용) */
export function keyHeaders(key) {
  return key.startsWith('sb_secret_') ? {apikey: key} : {apikey: key, Authorization: `Bearer ${key}`};
}

/** 주소 검사(순수 함수, 테스트용): {origin} 또는 {problem} */
export function checkTargetUrl(raw) {
  let u;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return {problem: '주소 형식이 아니에요(예 https://<ref>.supabase.co)'};
  }
  const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  if (u.username || u.password) return {problem: '주소에 사용자·비밀번호를 넣지 않아요'};
  if (u.protocol === 'https:') return {origin: u.origin};
  if (u.protocol === 'http:' && local) return {origin: u.origin};
  return {problem: `https 주소만 받아요(로컬만 http://127.0.0.1·localhost): ${u.protocol}//${u.host}`};
}

/** {url, headers}. 키는 돌려주지 않고 헤더로만(출력 금지). 주소 검사는 키를 받기 전에 한다. */
export async function opsTarget() {
  let raw = process.env.SUPABASE_URL;
  if (!raw) {
    const rl = createInterface({input: process.stdin, output: process.stdout});
    raw = await rl.question('대상 주소(SUPABASE_URL, 예 https://<ref>.supabase.co): ');
    rl.close();
  }
  const {origin: url, problem} = checkTargetUrl(raw);
  if (problem) {
    console.error(`멈춥니다: ${problem}`);
    process.exit(3);
  }
  let key = process.env.SUPABASE_SECRET_KEY || '';
  if (!key && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('옛 키 사용(SUPABASE_SERVICE_ROLE_KEY) — 셸에 남은 다른 환경 키일 수 있어요. ops용 secret 키(SUPABASE_SECRET_KEY)로 바꾸세요.');
  }
  if (!key) {
    const typed = await readHidden('서버 키(ops용 secret 키, 화면에 보이지 않음 — 이 프롬프트가 뜬 뒤 붙여 넣기): ');
    if (typed === null) {
      console.error('터미널이 아니라 키를 입력받지 않아요. 파이프로 키를 넣지 말고 SUPABASE_SECRET_KEY 환경변수(read -rs)로 주세요.');
      process.exit(3);
    }
    key = typed;
  }
  if (!key) {
    console.error('서버 키가 필요합니다.');
    process.exit(3);
  }
  return {url, headers: keyHeaders(key)};
}
