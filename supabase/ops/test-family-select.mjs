// 테스트 가족 고르기(순수 함수, SV-11). cleanup-test-families.mjs가 쓴다. 테스트: node --test supabase/ops/test-family-select.test.mjs
// 앱 개발자 메뉴(app/src/dev/testFamily.ts)와 같은 표식: 테스트 도메인 메일만 테스트 계정이다.

export const isTestEmail = (email) => /@([a-z0-9-]+\.)*(example\.(test|com|org)|[a-z0-9-]+\.test)$/i.test(String(email ?? '').trim());

/**
 * users: [{id, email, is_anonymous}], children: [{id(profile), user_id, family_id}]
 * 가족의 **모든** 자녀 계정이 테스트 메일일 때만 정리 대상. 하나라도 실제 계정(소셜·일반 메일)이면 건너뛴다.
 * 돌려주는 값: { families: [{family_id, child_profiles:[...]}], skipped: [{family_id, reason}] }
 */
export function selectTestFamilies(users, children) {
  const testIds = new Set(users.filter((u) => !u.is_anonymous && isTestEmail(u.email)).map((u) => u.id));
  const byFamily = new Map();
  for (const c of children) {
    if (!byFamily.has(c.family_id)) byFamily.set(c.family_id, []);
    byFamily.get(c.family_id).push(c);
  }
  const families = [];
  const skipped = [];
  for (const [family_id, kids] of byFamily) {
    const anyTest = kids.some((k) => testIds.has(k.user_id));
    if (!anyTest) continue; // 테스트와 무관한 가족은 보고도 하지 않는다
    if (kids.every((k) => testIds.has(k.user_id))) families.push({ family_id, child_profiles: kids.map((k) => k.id) });
    else skipped.push({ family_id, reason: '실제 계정 자녀가 함께 있어요' });
  }
  return { families, skipped };
}
