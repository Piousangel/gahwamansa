/* 어르신 P13 미리보기(0050 parent_preview_child_view) 통합 테스트(로컬 Supabase): 자녀가 실제로 받는 child_summary·child_answer_history 와
 * 같은 값을 같은 파서로 읽는지 본다(PR #11 리뷰 M1). */
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';

declare const process: {env: Record<string, string | undefined>};
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const rid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test('parent_preview_child_view: 자녀 C4 최근 답·C5 지난 답과 같은 값, 호칭은 parents[0].title, 철회하면 자녀처럼 나누지 않음', async () => {
  const child = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await child.signUpChild(`child-prev-${rid()}@example.test`, `Pw-${rid()}`);
  await child.createFamily();
  await child.setParentTitle('엄마');
  const code = await child.issueInviteCode();
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  const linked = await parent.redeemInviteCode(code);
  if (!linked.ok) {
    throw new Error(`연결 실패: ${linked.reason}`);
  }
  await parent.giveConsent('v5');
  const today = await parent.startToday();
  if (!today || !today.question) {
    throw new Error('로컬 시드 콘텐츠가 없어요(supabase seed)');
  }
  await parent.saveAnswer({questionId: today.question.id, choice: 'B'});

  const preview = await parent.parentPreviewChildView();
  const summary = await child.fetchChildSummary();
  const history = await child.fetchAnswerHistory();
  expect(preview.summary.parents).toHaveLength(1); // 본인 항목만
  const me = preview.summary.parents[0];
  const seen = summary.parents.find(p => p.parentId === me.parentId);
  expect(me.title).toBe('엄마');
  expect(me.shared).toBe(true);
  expect(me.latest).toEqual(seen?.latest);
  expect(me.latest?.choiceLabel).toBe(today.question.option_b);
  expect(preview.history[0].items).toEqual(history.find(h => h.parentId === me.parentId)?.items);

  await parent.withdrawConsent();
  const off = await parent.parentPreviewChildView();
  expect(off.summary.parents[0].shared).toBe(false);
  expect(off.summary.parents[0].latest).toBeNull();
  expect(off.history[0].items).toEqual([]);
});
