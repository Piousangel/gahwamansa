/* 개발자 메뉴(로컬 Supabase): 테스트 가족 한 번에 만들기·역할별 세션 전환이 실제 인증으로 동작하는지.
 * 테스트 계정은 실행마다 새로 만드는 고유 이메일(비밀번호는 이 실행 안에서만 생성, 저장·출력 안 함). */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {memoryStore} from '../src/lib/localStamps';
import {createTestFamily, supabaseDevAuth} from '../src/dev/testFamily';
import {createSessionSlots} from '../src/dev/sessionSlots';

declare const process: {env: Record<string, string | undefined>};
const rand = () => Math.random().toString(36).slice(2, 10);
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);

test('자녀 테스트 계정 → 가족·번호 → 어르신 익명 연결, 그다음 자녀·어르신 세션을 오간다', async () => {
  const authStore = memoryStore(); // supabase 세션 저장소(앱의 AsyncStorage 대신)
  const sb = createSupabase(SUPABASE_URL, SUPABASE_KEY, authStore);
  const api = createRealApi(sb);
  const creds = {email: `dev-${rand()}@example.test`, password: `Pw-${rand()}-${rand()}`};
  await (createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY)) as ReturnType<typeof createRealApi>).signUpChild(creds.email, creds.password);

  const slotStore = memoryStore();
  const auth = supabaseDevAuth(sb.auth);
  const r = await createTestFamily({api, auth, store: slotStore, creds});
  expect(r).toEqual({ok: true});
  expect(await api.whoAmI()).toBe('parent'); // 지금 이 기기는 연결된 어르신
  expect((await api.parentFamilyList()).family).toHaveLength(1);

  const slots = createSessionSlots(auth, slotStore);
  expect(await slots.switchTo('parent', 'child')).toBe('restored');
  expect(await api.whoAmI()).toBe('child');
  expect((await api.getChildState()).kind).toBe('family');
  expect(await slots.switchTo('child', 'parent')).toBe('restored');
  expect(await api.whoAmI()).toBe('parent');
});
