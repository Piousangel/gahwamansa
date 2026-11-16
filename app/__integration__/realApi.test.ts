/* 로컬 Supabase 통합 테스트(14일분 콘텐츠 시드가 들어 있다고 가정). 실행 전 로컬 스택이 켜져 있어야 한다(켜고 끄는 건 이 테스트가 하지 않음).
 * 선택: SUPABASE_SERVICE_ROLE_KEY 환경변수가 있으면 끝에 이번 실행이 만든 데이터를 정리한다. */
import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {loadConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';

declare const process: {env: Record<string, string | undefined>};
const randomUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : 8 + (r % 4)).toString(16);
  });

const {SUPABASE_URL, SUPABASE_KEY} = loadConfig();
const run = randomUUID().slice(0, 8);
const email = `it-${run}@example.test`;
const password = `Pw-${randomUUID()}`;

const childClient = createSupabase(SUPABASE_URL, SUPABASE_KEY);
const parentClient = createSupabase(SUPABASE_URL, SUPABASE_KEY);
const strangerClient = createSupabase(SUPABASE_URL, SUPABASE_KEY);
const child = createRealApi(childClient);
const parent = createRealApi(parentClient);
const stranger = createRealApi(strangerClient);

const state: {familyId?: string; code?: string; parentUid?: string; questionId?: string; strangerUid?: string} = {};

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin: SupabaseClient | null = serviceKey
  ? createClient(SUPABASE_URL, serviceKey, {auth: {persistSession: false}})
  : null;

afterAll(async () => {
  if (!admin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY 없음: 테스트 데이터는 정리하지 않았어요(고유 이메일로 구분됨).');
    return;
  }
  if (state.familyId) await admin.from('families').delete().eq('id', state.familyId);
  const uids = [state.parentUid, state.strangerUid].filter(Boolean) as string[];
  if (uids.length) await admin.from('redeem_attempts').delete().in('uid', uids);
  const {data} = await childClient.auth.getUser();
  const all = [data.user?.id, ...uids].filter(Boolean) as string[];
  for (const id of all) await admin.auth.admin.deleteUser(id);
});

test('자녀 가입 -> 가족 생성 -> 코드 발급', async () => {
  await child.signUpChild(email, password);
  const fam = await child.createFamily();
  expect(fam.family_id).toMatch(/^[0-9a-f-]{36}$/);
  state.familyId = fam.family_id;
  state.code = await child.issueInviteCode();
  expect(state.code).toMatch(/^[0-9]{6}$/);
});

test('잘못된 코드는 invalid', async () => {
  const bad = state.code === '000000' ? '000001' : '000000';
  const r = await stranger.redeemInviteCode(bad);
  expect(r).toMatchObject({ok: false, reason: 'invalid'});
  state.strangerUid = (await strangerClient.auth.getUser()).data.user?.id;
});

test('어르신 익명 로그인 -> redeem 성공', async () => {
  const r = await parent.redeemInviteCode(state.code!);
  expect(r).toMatchObject({ok: true, family_id: state.familyId});
  state.parentUid = (await parentClient.auth.getUser()).data.user?.id;
});

test('같은 기기가 같은 코드를 다시 보내도 ok(응답 유실 대비)', async () => {
  const r = await parent.redeemInviteCode(state.code!);
  expect(r).toMatchObject({ok: true, family_id: state.familyId});
});

test('이미 쓴 코드는 used', async () => {
  const r = await stranger.redeemInviteCode(state.code!);
  expect(r).toMatchObject({ok: false, reason: 'used'});
});

test('어르신은 오늘의 콘텐츠를 받는다(사진·질문)', async () => {
  const c = await parent.getTodayContent();
  expect(c).not.toBeNull();
  expect(c!.day_index).toBeGreaterThanOrEqual(1);
  expect(c!.photo!.caption.length).toBeGreaterThan(0);
  expect(c!.photo!.keyword.length).toBeGreaterThan(0);
  expect(c!.question!.option_a.length).toBeGreaterThan(0);
  expect(c!.question!.prompt).toEqual(expect.any(String));
  expect(c!.photo!.recall_questions).toHaveLength(2);
  expect(c!.answered_choice).toBeNull();
  expect(c!.consented).toBe(false);
  expect(c!.completed_steps).toEqual([]);
  expect(c!.streak).toBe(0);
  state.questionId = c!.question!.id;
});

test('자녀가 get_today_content 를 부르면 parent_required', async () => {
  await expect(child.getTodayContent()).rejects.toThrow(/parent_required/);
});

test('동의 전 답변 저장은 거부된다(consent_required)', async () => {
  await expect(
    parent.saveAnswer({questionId: state.questionId!, choice: 'A'}),
  ).rejects.toThrow(/consent_required/);
  const {data} = await childClient.from('answers').select('id');
  expect(data).toHaveLength(0);
});

test('동의 후 save_answer 성공, 같은 질문에 다시 답하면 갱신된다', async () => {
  await parent.giveConsent();
  expect((await parent.getTodayContent())!.consented).toBe(true);
  await parent.saveAnswer({questionId: state.questionId!, choice: 'A'});
  expect((await parent.getTodayContent())!.answered_choice).toBe('A');
  await parent.saveAnswer({questionId: state.questionId!, choice: 'B'});
  expect((await parent.getTodayContent())!.answered_choice).toBe('B');
  const {data} = await childClient.from('answers').select('choice');
  expect(data).toEqual([{choice: 'B'}]);
});

test('3단계 기록 -> completed, streak 1, 같은 날 재호출해도 streak 유지', async () => {
  const a = await parent.recordSessionStep('photo', 10);
  expect(a.completed).toBe(false);
  await parent.recordSessionStep('question', 20);
  const c = await parent.recordSessionStep('hangul', 30);
  expect(c).toMatchObject({completed: true, streak: 1});
  const again = await parent.recordSessionStep('hangul', 30);
  expect(again.streak).toBe(1);
  const today = await parent.getTodayContent();
  expect([...today!.completed_steps].sort()).toEqual(['hangul', 'photo', 'question']);
  expect(today!.streak).toBe(1);
});

test('자녀 홈: 오늘 참여, 연속 1일', async () => {
  const home = await child.fetchChildHome();
  expect(home).toEqual({participatedToday: true, streak: 1});
});

test('어르신이 삭제하면 scope parent, 이후 get_today_content 는 실패', async () => {
  expect((await parent.deleteScopePreview()).scope).toBe('parent');
  const r = await parent.deleteMyAccount();
  expect(r.scope).toBe('parent');
  await expect(parent.getTodayContent()).rejects.toThrow();
});

test('자녀가 둘이면 child, 혼자면 family(미리보기와 삭제 결과 일치)', async () => {
  // 두 번째 자녀: 서버에 자녀 합류 RPC 가 아직 없어 이 시나리오는 혼자일 때만 검증한다.
  expect((await child.deleteScopePreview()).scope).toBe('family');
  const r = await child.deleteMyAccount();
  expect(r.scope).toBe('family');
  state.familyId = undefined; // 이미 삭제됨
});
