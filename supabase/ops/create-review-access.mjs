// 스토어 심사용 가족 + 재사용 가입 번호 만들기(0027 admin_create_review_family). 번호는 화면에만 출력하고 어디에도 저장하지 않는다.
// 준비: 심사용 자녀 계정 2개를 먼저 만든다(대시보드 Authentication > Add user, 이메일+비밀번호). 그 user id 2개를 인자로 넘긴다.
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (키는 출력하지 않음)
// 사용: node supabase/ops/create-review-access.mjs <자녀1 user id> <자녀2 user id>
// 출력된 번호와 계정 정보는 Play 콘솔 "앱 액세스"에만 적는다(저장소·시드·채팅 금지).
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ids = process.argv.slice(2);
if (!url || !key) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(3);
}
if (ids.length < 2) {
  console.error('자녀 user id 2개가 필요합니다(한 명이 지워도 가족이 남도록).');
  process.exit(2);
}
const res = await fetch(`${url}/rest/v1/rpc/admin_create_review_family`, {
  method: 'POST',
  headers: {Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json'},
  body: JSON.stringify({p_child_users: ids}),
});
const body = await res.text();
if (!res.ok) {
  console.error(`실패 HTTP ${res.status}`, body.slice(0, 300));
  process.exit(1);
}
const {family_id, code} = JSON.parse(body);
console.log(`심사 가족: ${family_id}`);
console.log(`재사용 가입 번호(만료 없음): ${code}`);
