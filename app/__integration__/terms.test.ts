/* 약관 동의 기록(0046·0048)·연결 전 삭제 범위(0049) 통합 테스트(로컬 Supabase). realApi 응답이 계약 검증기를 통과하는지 본다.
 * - 게시 여부는 기록 결과로 안다(서비스 키 불필요, PR #3 리뷰 M1): ok 면 같은 자리에서 정상 경로(기록 → 같은 쌍은 다시 기록 안 함 → 재동의 불필요),
 *   unknown_version 이면 거부 모양과 재동의 필요. 로컬 게시는 시드 supabase/seed_terms_v1.sql(db reset 때). 공유 DB 에 직접 게시하지 않는다.
 * - 게시 여부와 상관없이 my_terms_status(needs_reagree)·삭제 범위 none 은 늘 확인한다. */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {PRIVACY_VERSION, TERMS_VERSION} from '../src/api/contract/terms';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function anonParent() {
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await parent.peekInviteCode('000000'); // 익명 세션을 연다(번호는 틀려도 됨)
  return parent;
}

test('게시 여부와 상관없이: 기록 전 재동의 필요 · 연결 전 삭제 범위 none, 게시돼 있으면(ok) 그 자리에서 정상 경로까지', async () => {
  const parent = await anonParent();
  expect(await parent.myTermsStatus()).toEqual({needsReagree: true}); // 이 계정은 아직 기록 없음
  expect(await parent.deleteScopePreview()).toEqual({scope: 'none'});
  const r = await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION);
  if (r.ok) {
    // 게시돼 있다(시드 seed_terms_v1.sql 또는 운영 게시) → 정상 경로를 여기서 단언(서비스 키 필요 없음, PR #3 리뷰 M1)
    expect(r).toEqual({ok: true, recorded: true});
    expect(await parent.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION)).toEqual({ok: true, recorded: false}); // 같은 쌍은 한 번만
    expect(await parent.myTermsStatus()).toEqual({needsReagree: false});
  } else {
    // 게시 버전이 없는 DB(공유 로컬 DB 는 reset 금지라 시드가 없을 수 있음): 거부 모양과 재동의 필요만
    expect(r).toEqual({ok: false, reason: 'unknown_version'});
    expect(await parent.myTermsStatus()).toEqual({needsReagree: true});
  }
});
