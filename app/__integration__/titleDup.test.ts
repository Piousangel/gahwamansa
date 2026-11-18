/* AC-02 호칭 겹침(로컬 Supabase, 서버 0028 redeem 호칭 상속 + 0019/0035 duplicate_title):
 * 두 번째 어르신이 연결되면 가족 기본 호칭을 물려받아 같은 이름이 둘 → 앱 findTitleDup 이 나중 분을 고르고,
 * set_parent_title_for 로 겹친 이름은 막히고 다른 이름은 바뀐다. */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {findTitleDup} from '../src/features/home/titleDup';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const rid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test('redeem 은 가족 기본 호칭을 물려받아 겹치고(막지 않음), 나중 분 호칭은 겹친 이름 막힘·다른 이름 저장', async () => {
  const child = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await child.signUpChild(`child-dup-${rid()}@example.test`, `Pw-${rid()}`);
  await child.createFamily();
  expect(await child.setParentTitle('엄마')).toEqual({ok: true});

  const redeem = async () => {
    const code = await child.issueInviteCode();
    const r = await createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY)).redeemInviteCode(code);
    if (!r.ok) {
      throw new Error(`연결 실패: ${r.reason}`);
    }
    return r.profile_id;
  };
  const first = await redeem();
  const second = await redeem();

  const {parents} = await child.fetchChildSummary();
  expect(parents.map(p => p.title)).toEqual(['엄마', '엄마']); // 연결 때는 겹쳐도 막지 않는다
  const dup = findTitleDup(parents);
  expect(dup?.target.parentId).toBe(second); // 나중에 연결된 분
  expect(dup?.target.parentId).not.toBe(first);

  // 바꾸려는 이름이 다른 어르신 이름과 같으면 서버도 막는다 → 앱은 relation.name_taken
  expect(await child.setParentTitleFor(second, '엄마')).toEqual({ok: false, reason: 'duplicate_title'});
  expect(await child.setParentTitleFor(second, '아빠')).toEqual({ok: true});
  const after = await child.fetchChildSummary();
  expect(after.parents.find(p => p.parentId === second)?.title).toBe('아빠');
  expect(after.parents.find(p => p.parentId === first)?.title).toBe('엄마');
  expect(findTitleDup(after.parents)).toBeNull();
});
