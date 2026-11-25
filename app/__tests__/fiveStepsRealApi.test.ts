// realApi ↔ 서버 0061·0067 계약(api/contract/fiveSteps.ts): record_session_step 인자(한 곳에서 p_course_len 4)·옛 서버 3단계·save_recall/save_pass_on.
import {createRealApi} from '../src/features/realApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';

const FIVE_FIELDS = {
  five_steps_supported: true,
  four_steps_supported: true,
  skipped_steps: [],
  recall: {options: [{slot: 1, label: '그늘'}, {slot: 2, label: '참새'}, {slot: 3, label: '산들바람'}], picked_slot: null},
  pass_on: {enabled: false, picked_key: null},
};
const BASE = {day_index: 1, photo: null, question: null, answered_choice: null, consented: true, completed_steps: [], streak: 0};

function fakeSb(today: object) {
  const rpc = jest.fn(async (name: string, _args?: unknown) => {
    if (name === 'get_today_content' || name === 'start_today') return {data: today, error: null};
    if (name === 'record_session_step') return {data: {completed: false, streak: 0, steps: []}, error: null};
    if (name === 'save_recall') return {data: {ok: true}, error: null};
    if (name === 'save_pass_on') return {data: {ok: false, reason: 'disabled'}, error: null};
    return {data: null, error: null};
  });
  const sb = {auth: {getSession: jest.fn(async () => ({data: {session: {user: {id: 'p'}}}, error: null})), signInAnonymously: jest.fn()}, rpc};
  return {sb, rpc};
}
const recordArgs = (rpc: jest.Mock) => rpc.mock.calls.filter(c => c[0] === 'record_session_step').map(c => c[1]);

afterEach(() => resetFeaturesForTest());

test('스위치 꺼짐: 새 서버(5단계 칸 있음)여도 record_session_step 은 옛 2인자 그대로', async () => {
  const {sb, rpc} = fakeSb({...BASE, ...FIVE_FIELDS});
  const api = createRealApi(sb as never);
  await api.getTodayContent();
  await api.recordSessionStep('photo', 3);
  expect(recordArgs(rpc)).toEqual([{p_step: 'photo', p_duration: 3}]);
});

test('스위치 켜짐 + 서버 지원: 모든 호출에 p_skipped·p_course_len 4(realApi 한 곳, 0067), 여기까지는 p_step stop_here', async () => {
  setFeature('fiveSteps', true);
  const {sb, rpc} = fakeSb({...BASE, ...FIVE_FIELDS});
  const api = createRealApi(sb as never);
  const c = await api.getTodayContent();
  expect(c?.five_steps_supported).toBe(true);
  expect(c?.recall?.options.map(o => o.label)).toEqual(['그늘', '참새', '산들바람']);
  await api.recordSessionStep('photo', 3);
  await api.recordSessionStep('recall', 2, {skipped: true});
  await api.recordSessionStep('stop_here', 0);
  expect(recordArgs(rpc)).toEqual([
    {p_step: 'photo', p_duration: 3, p_skipped: false, p_course_len: 4},
    {p_step: 'recall', p_duration: 2, p_skipped: true, p_course_len: 4},
    {p_step: 'stop_here', p_duration: 0, p_skipped: false, p_course_len: 4},
  ]);
});

test('0067 전 서버(four_steps_supported 없음): 스위치가 켜져 있어도 칸을 빼고(앱은 3단계) p_course_len 4 를 보내지 않는다', async () => {
  setFeature('fiveSteps', true);
  const only0061: Record<string, unknown> = {...FIVE_FIELDS};
  delete only0061.four_steps_supported;
  const {sb, rpc} = fakeSb({...BASE, ...only0061});
  const api = createRealApi(sb as never);
  const c = await api.getTodayContent();
  expect(c && 'five_steps_supported' in c).toBe(false);
  await api.recordSessionStep('photo', 1);
  expect(recordArgs(rpc)).toEqual([{p_step: 'photo', p_duration: 1}]);
});

test('옛 서버(five_steps_supported 없음): 스위치가 켜져 있어도 5단계 칸을 빼고(앱은 3단계) 새 인자를 보내지 않는다', async () => {
  setFeature('fiveSteps', true);
  const {sb, rpc} = fakeSb({...BASE});
  const api = createRealApi(sb as never);
  const c = await api.getTodayContent();
  expect(c && 'five_steps_supported' in c).toBe(false);
  await api.recordSessionStep('photo', 1);
  expect(recordArgs(rpc)).toEqual([{p_step: 'photo', p_duration: 1}]);
});

test('save_recall·save_pass_on: day_index·slot/key 를 보내고 결과를 계약 모양으로', async () => {
  setFeature('fiveSteps', true);
  const {sb, rpc} = fakeSb({...BASE, ...FIVE_FIELDS});
  const api = createRealApi(sb as never);
  await expect(api.saveRecall(7, 2)).resolves.toEqual({ok: true});
  await expect(api.savePassOn(7, 'ask_which')).resolves.toEqual({ok: false, reason: 'disabled'});
  expect(rpc.mock.calls.filter(c => c[0] === 'save_recall').map(c => c[1])).toEqual([{p_day_index: 7, p_slot: 2}]);
  expect(rpc.mock.calls.filter(c => c[0] === 'save_pass_on').map(c => c[1])).toEqual([{p_day_index: 7, p_key: 'ask_which'}]);
});
