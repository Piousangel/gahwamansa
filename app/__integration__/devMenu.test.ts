/* 개발자 메뉴(로컬 Supabase): 테스트 가족 한 번에 만들기·역할별 세션 전환이 실제 인증으로 동작하는지.
 * 테스트 계정은 실행마다 새로 만드는 고유 이메일(비밀번호는 이 실행 안에서만 생성, 저장·출력 안 함). */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {memoryStore} from '../src/lib/localStamps';
import {cleanupTestFamily, createTestFamily, supabaseDevAuth} from '../src/dev/testFamily';
import {createSessionSlots} from '../src/dev/sessionSlots';
import {devResetToday} from '../src/dev/devResetToday';
import {createClient} from '@supabase/supabase-js';

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

  // M3 정리: 어르신(익명)·테스트 자녀를 계정 지우기로. 보관 칸도 비워진다
  expect(await cleanupTestFamily({api, auth, store: slotStore})).toEqual({ok: true, parent: true, child: true});
  expect(await slotStore.getItem('dev_menu_session_child_v1')).toBeNull();
  expect(await api.whoAmI()).toBe('none');
  // 지운 자녀 계정으로는 다시 로그인할 수 없다
  const again = await createSupabase(SUPABASE_URL, SUPABASE_KEY).auth.signInWithPassword(creds);
  expect(again.error).toBeTruthy();
});

// S25 오늘 코스 다시 하기(dev_reset_today 0051): 테스터 가족이 아니면 거절, 자녀는 parent_required.
// SUPABASE_SERVICE_ROLE_KEY 가 있으면 가족을 테스터로 표시해 실제로 오늘 기록이 지워지는지까지 본다(스위치는 로컬 시드가 켬).
test('dev_reset_today: 테스터 가족 어르신만 오늘 기록을 지운다', async () => {
  const childSb = createSupabase(SUPABASE_URL, SUPABASE_KEY);
  const childApi = createRealApi(childSb) as ReturnType<typeof createRealApi>;
  await childApi.signUpChild(`dr-${rand()}@example.test`, `Pw-${rand()}-${rand()}`);
  const fam = await childApi.createFamily();
  const code = await childApi.issueInviteCode();
  const parentSb = createSupabase(SUPABASE_URL, SUPABASE_KEY);
  const parentApi = createRealApi(parentSb);
  expect(await parentApi.redeemInviteCode(code)).toMatchObject({ok: true});

  expect(await devResetToday(n => childSb.rpc(n))).toEqual({ok: false, reason: 'parent_required'});
  const before = await devResetToday(n => parentSb.rpc(n));
  expect(before.ok ? 'ok' : before.reason).toMatch(/^(disabled|not_test_family)$/);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY 없음: 테스터 가족 성공 경로는 건너뜀');
    return;
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {auth: {persistSession: false}});
  try {
    const mark = await admin.rpc('admin_set_test_family', {p_family: fam.family_id, p_is_test: true, p_reason: 'integration', p_operator: 'jest'});
    expect(mark.data).toEqual({ok: true, is_test: true});
    await parentApi.startToday();
    await parentApi.recordSessionStep('photo', 3);
    expect((await parentApi.getTodayContent())!.completed_steps).toContain('photo');
    const r = await devResetToday(n => parentSb.rpc(n));
    if (!r.ok) {
      expect(r.reason).toBe('disabled'); // 시드를 넣지 않은 DB(스위치 꺼짐)
      return;
    }
    expect(r.sessions).toBe(1);
    expect((await parentApi.getTodayContent())!.completed_steps).toHaveLength(0);
  } finally {
    await admin.from('families').delete().eq('id', fam.family_id);
  }
});
