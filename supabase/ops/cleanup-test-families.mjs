// staging·local 전용: 개발자 메뉴로 만든 테스트 가족 정리(로드맵 SV-11, 개발자 메뉴 리뷰 M3).
// 기준: 가족의 **모든** 자녀가 테스트 도메인 메일 계정(test-family-select.mjs)일 때만. 실제(소셜·일반 메일) 자녀가 섞인 가족은 건드리지 않는다.
// 방법: 각 자녀를 admin_delete_account(대상, 사유, 처리자)로 지운다 → 마지막 자녀에서 가족 전체 + 어르신 익명 계정까지(0039·0043 공통 규칙, 감사 행 남음).
// 대상 주소·서버 키: ops-auth.mjs(키는 숨김 입력 또는 ops용 secret 키 환경변수, 출력하지 않음). production이면 멈춘다.
// 사용: node supabase/ops/cleanup-test-families.mjs --operator <처리자>            (미리보기: 몇 가족을 지울지만)
//       node supabase/ops/cleanup-test-families.mjs --operator <처리자> --apply    (실제 삭제)
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {confirmTarget} from './target-check.mjs';
import {selectTestFamilies} from './test-family-select.mjs';
import {opsTarget} from './ops-auth.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const operator = argv[argv.indexOf('--operator') + 1];
const apply = argv.includes('--apply');
if (!operator || argv.indexOf('--operator') < 0) {
  console.error('사용: --operator <처리자> [--apply]  (대상 주소·서버 키는 실행 중 입력, 키는 화면에 안 보임)');
  process.exit(2);
}
const {url, headers: keyH} = await opsTarget();
const env = await confirmTarget(root, url, apply ? '테스트 가족 삭제' : '테스트 가족 미리보기');
if (env === 'production') {
  console.error('production에서는 실행하지 않습니다(테스트 가족은 staging·local에만).');
  process.exit(2);
}
const h = {...keyH, 'Content-Type': 'application/json'};

// 인증 사용자 목록(관리자 API, 페이지 단위). 메일은 화면에 찍지 않는다.
const users = [];
for (let page = 1; page < 100; page++) {
  const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, {headers: h});
  if (!res.ok) {
    console.error(`사용자 목록 실패 HTTP ${res.status}`);
    process.exit(1);
  }
  const batch = (await res.json()).users ?? [];
  users.push(...batch.map((u) => ({id: u.id, email: u.email ?? null, is_anonymous: !!u.is_anonymous})));
  if (batch.length < 1000) break;
}
const cRes = await fetch(`${url}/rest/v1/profiles?select=id,user_id,family_id&role=eq.child`, {headers: h});
if (!cRes.ok) {
  console.error(`자녀 프로필 조회 실패 HTTP ${cRes.status}`);
  process.exit(1);
}
const {families, skipped} = selectTestFamilies(users, await cRes.json());
console.log(`정리 대상 테스트 가족 ${families.length}개(자녀 ${families.reduce((n, f) => n + f.child_profiles.length, 0)}명), 실제 계정이 섞여 건너뛴 가족 ${skipped.length}개`);
if (!apply) {
  console.log('미리보기만 했어요. 지우려면 --apply 를 붙이세요.');
  process.exit(0);
}
let done = 0;
for (const f of families) {
  for (const child of f.child_profiles) {
    const res = await fetch(`${url}/rest/v1/rpc/admin_delete_account`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({p_profile: child, p_reason: `${env} 테스트 가족 정리(개발자 메뉴)`, p_operator: operator}),
    });
    if (!res.ok) {
      console.error(`삭제 실패 HTTP ${res.status} — 멈춥니다(지금까지 ${done}가족 정리)`);
      process.exit(1);
    }
  }
  done++;
}
console.log(`완료: 테스트 가족 ${done}개 정리(감사 기록 남김)`);
