/* 약관 동의 기록(0046·0048)·연결 전 삭제 범위(0049) 통합 테스트(로컬 Supabase). realApi 응답이 계약 검증기를 통과하는지 본다.
 * 선택: SUPABASE_SERVICE_ROLE_KEY 가 있으면 v1 을 먼저 게시해 ok 를, 없으면 게시 여부에 따라 ok 또는 unknown_version 을 확인한다. */
import {createClient} from '@supabase/supabase-js';
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {PRIVACY_VERSION, TERMS_VERSION} from '../src/api/contract/terms';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test('어르신 익명 기기(연결 전): 약관 동의 기록 → 같은 쌍은 다시 기록하지 않음, 삭제 범위는 none', async () => {
  if (serviceKey) {
    const admin = createClient(SUPABASE_URL, serviceKey, {auth: {persistSession: false}});
    for (const [kind, v] of [['terms', TERMS_VERSION], ['privacy', PRIVACY_VERSION]]) {
      await admin.rpc('admin_publish_terms_version', {p_kind: kind, p_version: v, p_reason: 'integration test', p_operator: 'jest'});
    }
  }
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await parent.peekInviteCode('000000'); // 익명 세션을 연다(번호는 틀려도 됨)
  const first = await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION);
  if (first.ok) {
    const again = await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION);
    expect(again).toEqual({ok: true, recorded: false});
    expect((await parent.myTermsStatus()).needsReagree).toBe(false);
  } else {
    expect(serviceKey).toBeUndefined(); // 게시 버전이 없는 로컬 DB(서비스 키 없이 실행)
    expect(first.reason).toBe('unknown_version');
  }
  expect(await parent.deleteScopePreview()).toEqual({scope: 'none'});
});
