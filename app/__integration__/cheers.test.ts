/* 응원 경로 통합 테스트(로컬 Supabase, 서버 0020): 자녀 send_cheer → 어르신 getMyCheers(계약 검증) → markCheersRead.
 * 앱 realApi 의 get_my_cheers·mark_cheers_read 가 서버 응답을 contracts 검증기로 통과하는지 본다. */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {CHEER_KEYS} from '../src/api/contract/cheers';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const rid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test('응원: 자녀가 보낸 확정 키 응원을 어르신이 받아 읽음 처리하면 다시 오지 않는다', async () => {
  const childSb = createSupabase(SUPABASE_URL, SUPABASE_KEY);
  const child = createRealApi(childSb);
  await child.signUpChild(`child-cheer-${rid()}@example.test`, `Pw-${rid()}`);
  await child.createFamily();
  const code = await child.issueInviteCode();
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  const linked = await parent.redeemInviteCode(code);
  if (!linked.ok) {
    throw new Error(`연결 실패: ${linked.reason}`);
  }
  try {
    // 처음엔 없음
    expect(await parent.getMyCheers()).toEqual({unread_count: 0, cheers: []});

    // 자녀 보내기(자녀 화면 API 는 자녀 줄 몫이라 여기선 RPC 직접). 서버 키 = 앱 계약 키
    for (const key of [CHEER_KEYS[0], CHEER_KEYS[2]]) {
      const {data, error} = await childSb.rpc('send_cheer', {p_parent: linked.profile_id, p_key: key});
      expect(error).toBeNull();
      expect(data).toMatchObject({ok: true});
    }
    // 앱 계약에 없는 키는 서버가 거부(키 목록이 글자까지 같은지)
    const bad = await childSb.rpc('send_cheer', {p_parent: linked.profile_id, p_key: 'always_thanks'});
    expect(bad.data).toEqual({ok: false, reason: 'invalid_key'});

    const got = await parent.getMyCheers(); // realApi 가 parseMyCheers 로 검증
    expect(got.unread_count).toBe(2);
    expect(got.cheers.map(c => c.message_key).sort()).toEqual([CHEER_KEYS[0], CHEER_KEYS[2]].sort());

    expect(await parent.markCheersRead(got.cheers.map(c => c.id))).toBe(2);
    expect(await parent.getMyCheers()).toEqual({unread_count: 0, cheers: []});
    expect(await parent.markCheersRead(null)).toBe(0);

    // 계측: 어르신 단계 완료 이벤트는 ok(서버 화이트리스트와 같음), 틀린 값은 invalid_props(예외 아님)
    expect(await parent.logEvent('course_step_completed', {step: 'hangul', duration_sec: 12, attempt_no: 1})).toEqual({ok: true});
    expect(await parent.logEvent('course_step_completed', {step: 'nope' as never})).toEqual({ok: false, reason: 'invalid_props'});
  } finally {
    await parent.deleteMyAccount();
    await child.deleteMyAccount();
  }
});

test('start_today: 연결된 어르신은 오늘 콘텐츠(+advanced)를, 미연결 기기는 미리 보기를 받는다', async () => {
  const fresh = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  const preview = await fresh.startToday();
  expect(preview === null || preview.linked === false).toBe(true);

  const child = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await child.signUpChild(`child-start-${rid()}@example.test`, `Pw-${rid()}`);
  await child.createFamily();
  const code = await child.issueInviteCode();
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await parent.redeemInviteCode(code);
  try {
    const first = await parent.startToday();
    const again = await parent.startToday();
    if (first && again) {
      expect(first.linked).toBe(true);
      expect(again.day_index).toBe(first.day_index); // 같은 날 여러 번 불러도 1칸만
    }
  } finally {
    await parent.deleteMyAccount();
    await child.deleteMyAccount();
  }
});
