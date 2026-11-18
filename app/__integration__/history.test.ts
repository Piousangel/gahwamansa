/* 어르신 지난 날 통합 테스트(로컬 Supabase, 서버 0028 parent_history). realApi 가 응답을 contracts 검증기로 통과하는지 본다. */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const rid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test('parent_history: 오늘 코스를 연 날이 최신순으로, 동의 전 날은 고른 답 없음, 동의 뒤 저장한 답은 choice_label', async () => {
  const child = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await child.signUpChild(`child-hist-${rid()}@example.test`, `Pw-${rid()}`);
  await child.createFamily();
  const code = await child.issueInviteCode();
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  const linked = await parent.redeemInviteCode(code);
  if (!linked.ok) {
    throw new Error(`연결 실패: ${linked.reason}`);
  }
  try {
    const empty = await parent.parentHistory(30);
    expect(empty.days).toEqual([]); // 코스를 연 날만(빈 날 없음)

    const today = await parent.startToday();
    if (!today || !today.photo || !today.question) {
      throw new Error('로컬 시드 콘텐츠가 없어요(supabase seed)');
    }
    await parent.recordSessionStep('photo', 5);
    let h = await parent.parentHistory(30);
    expect(h.days).toHaveLength(1);
    expect(h.days[0].photo.keyword).toBe(today.photo.keyword);
    expect(h.days[0].choice_label).toBeNull(); // 동의 전: 고른 답 없음

    await parent.giveConsent('v2');
    await parent.saveAnswer({questionId: today.question.id, choice: 'B'});
    h = await parent.parentHistory(30);
    expect(h.days[0].choice_label).toBe(today.question.option_b);
    expect(JSON.stringify(h)).not.toMatch(/typed|input_text/); // 어르신이 친 글자 없음
    expect((await parent.parentHistory(99)).days.length).toBeLessThanOrEqual(30); // p_days 상한
  } finally {
    await parent.deleteMyAccount();
    await child.deleteMyAccount();
  }
});
