// 운영 스크립트 공용: 대상 주소와 서버 키 받기(보안 회의 D9·D13·E3).
// - 주소: SUPABASE_URL 환경변수, 없으면 물어본다(비밀 아님).
// - 키: ops 전용 새 secret 키 SUPABASE_SECRET_KEY(sb_secret_…, Edge용 키와 별도 발급), 없으면 옛 SUPABASE_SERVICE_ROLE_KEY,
//   둘 다 없으면 **화면에 보이지 않게** 입력받는다. `KEY=값 node …`처럼 명령줄에 키를 쓰지 않는다(셸 기록에 남음).
//   환경변수로 줄 때는 비밀번호 관리자에서 `read -rs SUPABASE_SECRET_KEY; export SUPABASE_SECRET_KEY` 처럼 입력하고 끝나면 `unset`.
// - 헤더: 새 secret 키는 apikey만, 옛 JWT 키는 apikey + Authorization Bearer.
import {createInterface} from 'node:readline/promises';

/** 화면에 글자를 보이지 않고 한 줄을 읽는다(터미널이 아니면 그냥 한 줄). */
export async function readHidden(prompt) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const rl = createInterface({input: stdin});
    const line = await new Promise((r) => rl.once('line', r));
    rl.close();
    return String(line ?? '').trim();
  }
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
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

/** {url, headers}. 키는 돌려주지 않고 헤더로만(출력 금지). */
export async function opsTarget() {
  let url = process.env.SUPABASE_URL;
  if (!url) {
    const rl = createInterface({input: process.stdin, output: process.stdout});
    url = (await rl.question('대상 주소(SUPABASE_URL, 예 https://<ref>.supabase.co): ')).trim();
    rl.close();
  }
  let key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) key = await readHidden('서버 키(ops용 secret 키, 화면에 보이지 않음): ');
  if (!url || !key) {
    console.error('대상 주소와 서버 키가 필요합니다.');
    process.exit(3);
  }
  return {url, headers: keyHeaders(key)};
}
