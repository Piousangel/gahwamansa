/* 로컬 Supabase(0061 five_steps) 통합: 스위치 켠 realApi 가 서버 계약대로 부르는지.
 * - record_session_step 4인자(p_skipped·p_course_len 5), stop_here(③ 전 stop_before_question → ③ 뒤 완료·남은 단계 넘어감)
 * - save_recall(day, slot)·save_pass_on(day, key) 결과, 넘긴 ③ 답 저장은 예외 skipped, 넘긴 단계를 p_skipped:false 로 다시 기록
 * 선택: SUPABASE_SERVICE_ROLE_KEY 가 있으면 끝에 만든 데이터를 지운다. */
import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {loadLocalConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';
import {setFeature} from '../src/lib/features';

declare const process: {env: Record<string, string | undefined>};
const run = Math.random().toString(16).slice(2, 10);
const {SUPABASE_URL, SUPABASE_KEY} = loadLocalConfig(process.env.SUPABASE_SERVICE_ROLE_KEY);
const childClient = createSupabase(SUPABASE_URL, SUPABASE_KEY);
const parentClient = createSupabase(SUPABASE_URL, SUPABASE_KEY);
const child = createRealApi(childClient);
const parent = createRealApi(parentClient);
const admin: SupabaseClient | null = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}})
  : null;
const state: {familyId?: string; parentUid?: string; day?: number; questionId?: string} = {};
const rpcSpy = jest.spyOn(parentClient, 'rpc');

beforeAll(async () => {
  setFeature('fiveSteps', true);
  await child.signUpChild(`it5-${run}@example.test`, `Pw-${run}-${run}`);
  state.familyId = (await child.createFamily()).family_id;
  const code = await child.issueInviteCode();
  expect((await parent.redeemInviteCode(code)).ok).toBe(true);
  state.parentUid = (await parentClient.auth.getUser()).data.user?.id;
  await parent.giveConsent('v5');
});

afterAll(async () => {
  if (!admin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY 없음: 테스트 데이터는 정리하지 않았어요(고유 이메일로 구분됨).');
    return;
  }
  if (state.familyId) await admin.from('families').delete().eq('id', state.familyId);
  const {data} = await childClient.auth.getUser();
  for (const id of [data.user?.id, state.parentUid].filter(Boolean) as string[]) await admin.auth.admin.deleteUser(id);
});

test('오늘 콘텐츠: five_steps_supported·skipped_steps·recall{options,picked_slot}·pass_on{enabled,picked_key}', async () => {
  const c = await parent.startToday();
  expect(c?.five_steps_supported).toBe(true);
  expect(c?.skipped_steps).toEqual([]);
  expect(c?.recall?.picked_slot).toBeNull();
  expect(typeof c?.pass_on?.enabled).toBe('boolean');
  state.day = c!.day_index;
  state.questionId = c!.question?.id;
});

test('record_session_step: 스위치 켜짐이면 모든 호출에 p_course_len 5, ① 뒤 ③ 전 stop_here 는 stop_before_question', async () => {
  const r = await parent.recordSessionStep('photo', 3);
  expect(r.completed).toBe(false);
  const args = rpcSpy.mock.calls.filter(c => c[0] === 'record_session_step').map(c => c[1]);
  expect(args).toEqual([{p_step: 'photo', p_duration: 3, p_skipped: false, p_course_len: 5}]);
  await expect(parent.recordSessionStep('stop_here', 0)).rejects.toMatchObject({reason: 'stop_before_question'});
});

test('② save_recall: 보기가 있으면 ok + picked_slot, 없으면 no_content. 지난 day_index 는 stale_day', async () => {
  const c = await parent.getTodayContent();
  const opts = c?.recall?.options ?? [];
  if (opts.length === 0) {
    expect(await parent.saveRecall(state.day!, 1)).toEqual({ok: false, reason: 'no_content'});
  } else {
    expect(await parent.saveRecall(state.day! + 1000, opts[0].slot)).toEqual({ok: false, reason: 'stale_day'});
    expect(await parent.saveRecall(state.day!, opts[0].slot)).toEqual({ok: true});
    expect((await parent.getTodayContent())?.recall?.picked_slot).toBe(opts[0].slot);
  }
  await parent.recordSessionStep('recall', 2);
});

test('③ 넘어감(p_skipped) → 답 저장은 예외 skipped → ③ 뒤 여기까지로 완료, ④·⑤는 넘어감', async () => {
  const r = await parent.recordSessionStep('question', 1, {skipped: true});
  expect(r.completed).toBe(false);
  expect((await parent.getTodayContent())?.skipped_steps).toContain('question');
  await expect(parent.saveAnswer({questionId: state.questionId!, choice: 'A'})).rejects.toMatchObject({reason: 'skipped'});
  const stop = await parent.recordSessionStep('stop_here', 0);
  expect(stop.completed).toBe(true);
  const c = await parent.getTodayContent();
  expect([...(c?.skipped_steps ?? [])].sort()).toEqual(['hangul', 'pass_on', 'question']);
});

test('넘긴 ④를 p_skipped:false 로 다시 기록하면 skipped_steps 에서 빠진다. ⑤ 저장은 서버 스위치 꺼짐이면 disabled', async () => {
  await parent.recordSessionStep('hangul', 5);
  const c = await parent.getTodayContent();
  expect(c?.skipped_steps).not.toContain('hangul');
  if (!c?.pass_on?.enabled) {
    expect(await parent.savePassOn(state.day!, 'photo_like')).toEqual({ok: false, reason: 'disabled'});
  }
});
