/* 약관 동의 기록(0046·0048)·연결 전 삭제 범위(0049) 통합 테스트(로컬 Supabase). realApi 응답이 계약 검증기를 통과하는지 본다.
 * - 정상 경로(기록 → 같은 쌍은 다시 기록 안 함 → 재동의 불필요)는 로컬 시드 supabase/seed_terms_v1.sql(약관·방침 v1 게시)를 전제로 한다.
 *   공유 DB 에 직접 게시하지 않는다(리뷰 M3). 시드는 `npx supabase db reset` 때 들어간다.
 *   서비스 키(SUPABASE_SERVICE_ROLE_KEY)가 없으면 게시 여부를 확인할 수 없어 정상 경로를 명시적으로 건너뛴다.
 * - 게시 여부와 상관없이 my_terms_status(needs_reagree)·삭제 범위 none 은 늘 확인한다. */
import {createClient} from '@supabase/supabase-js';
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {PRIVACY_VERSION, TERMS_VERSION} from '../src/api/contract/terms';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function anonParent() {
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await parent.peekInviteCode('000000'); // 익명 세션을 연다(번호는 틀려도 됨)
  return parent;
}

test('게시 여부와 상관없이: 기록 전 my_terms_status 는 재동의 필요, 기록 결과는 계약 모양, 연결 전 삭제 범위는 none', async () => {
  const parent = await anonParent();
  expect(await parent.myTermsStatus()).toEqual({needsReagree: true}); // 이 계정은 아직 기록 없음
  const r = await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION);
  // 게시돼 있으면 ok, 아니면 unknown_version — 어느 쪽이든 my_terms_status 와 맞아야 한다
  expect(await parent.myTermsStatus()).toEqual({needsReagree: !r.ok});
  if (!r.ok) {
    expect(r.reason).toBe('unknown_version');
  }
  expect(await parent.deleteScopePreview()).toEqual({scope: 'none'});
});

(serviceKey ? test : test.skip)('정상 경로(시드 v1 게시): 기록 → 같은 쌍은 다시 기록하지 않음 → 재동의 불필요', async () => {
  // 시드가 들어갔는지 서비스 역할로 읽기만 한다(게시하지 않음)
  const admin = createClient(SUPABASE_URL, serviceKey as string, {auth: {persistSession: false}});
  const {data, error} = await admin.from('terms_versions').select('kind, version');
  expect(error).toBeNull();
  const published = new Set((data ?? []).map((row: {kind: string; version: string}) => `${row.kind}:${row.version}`));
  if (!published.has(`terms:${TERMS_VERSION}`) || !published.has(`privacy:${PRIVACY_VERSION}`)) {
    throw new Error(`로컬 DB 에 약관·방침 ${TERMS_VERSION}·${PRIVACY_VERSION} 이 게시돼 있지 않아요 — supabase/seed_terms_v1.sql 을 넣으려면 npx supabase db reset`);
  }
  const parent = await anonParent();
  expect(await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION)).toEqual({ok: true, recorded: true});
  expect(await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION)).toEqual({ok: true, recorded: false});
  expect(await parent.myTermsStatus()).toEqual({needsReagree: false});
});
