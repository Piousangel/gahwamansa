// 스토어 심사용 가족 관리(0025). 번호는 화면에만 출력하고 어디에도 저장하지 않는다.
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (키는 출력하지 않음)
// 사용:
//   node supabase/ops/create-review-access.mjs create <자녀1 user id> <자녀2 user id> [연결 상한, 기본 5]
//       심사 가족 + 재사용 번호(기본 꺼짐). 자녀 계정 2개는 먼저 대시보드 Authentication > Add user로 만든다.
//   node supabase/ops/create-review-access.mjs enable <family id>    심사 제출 직전에 켠다
//   node supabase/ops/create-review-access.mjs disable <family id>   심사가 끝나면 끈다
//   node supabase/ops/create-review-access.mjs cleanup <family id>   심사 어르신 프로필·익명 계정 삭제 + 번호 끔
// 출력된 번호와 계정 정보는 Play 콘솔 "앱 액세스"에만 적는다(저장소·시드·채팅 금지).
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [cmd, ...args] = process.argv.slice(2);
if (!url || !key) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(3);
}
// 대상 확인: app/env/<환경>.env ref와 호스트 대조(production은 호스트 재입력)
const {confirmTarget} = await import('./target-check.mjs');
const {dirname, join} = await import('node:path');
const {fileURLToPath} = await import('node:url');
if (['create', 'enable', 'disable', 'cleanup'].includes(cmd)) {
  await confirmTarget(join(dirname(fileURLToPath(import.meta.url)), '..', '..'), url, `심사 접근 ${cmd}`);
}

async function rpc(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${name} 실패 HTTP ${res.status}`, text.slice(0, 300));
    process.exit(1);
  }
  return JSON.parse(text);
}

if (cmd === 'create') {
  const [c1, c2, max] = args;
  if (!c1 || !c2) {
    console.error('자녀 user id 2개가 필요합니다(한 명이 지워도 가족이 남도록).');
    process.exit(2);
  }
  const {family_id, code} = await rpc('admin_create_review_family', {p_child_users: [c1, c2], p_max_uses: Number(max ?? 5)});
  console.log(`심사 가족: ${family_id}`);
  console.log(`재사용 가입 번호(만료 없음, 지금은 꺼짐): ${code}`);
  console.log('심사 제출 직전에 enable, 끝나면 cleanup 하세요.');
} else if (cmd === 'enable' || cmd === 'disable') {
  const n = await rpc('admin_set_review_code', {p_family: args[0], p_enabled: cmd === 'enable'});
  console.log(`${cmd === 'enable' ? '켬' : '끔'}: 번호 ${n}개`);
} else if (cmd === 'cleanup') {
  console.log(JSON.stringify(await rpc('admin_cleanup_review_family', {p_family: args[0]})));
} else {
  console.error('명령: create | enable | disable | cleanup (파일 머리말 참고)');
  process.exit(2);
}
