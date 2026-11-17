// 자녀 화면 v3 가정 계약(docs/team/dev-app-child-contract.md): fake 와 realApi 매핑이 같은 모양을 돌려주는지
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';

const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};

function sbWith(rpc: jest.Mock, session: unknown = null) {
  const signOut = jest.fn(() => Promise.resolve({error: null}));
  const sb = {rpc, auth: {getSession: jest.fn(() => Promise.resolve({data: {session}, error: null})), signOut}};
  return {sb: sb as never, signOut};
}

test('fake: 어르신 여러 명이면 호칭·연결 상태를 어르신별로 준다', async () => {
  const api = createFakeApi({
    parents: [
      {title: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: '2026-11-16'}},
      {title: '아빠', connected: false, shared: false},
    ],
  });
  const s = await api.fetchChildSummary();
  expect(s.parents.map(p => [p.title, p.connected, p.shared])).toEqual([
    ['엄마', true, true],
    ['아빠', false, false],
  ]);
  expect(s.latest?.choiceLabel).toBe('가을'); // 옛 계약: 첫 어르신
  expect(await api.setParentTitle('어머니', s.parents[0].parentId)).toEqual({ok: true});
  expect((await api.fetchChildSummary()).parents[0].title).toBe('어머니');
});

test('fake: 지난 답은 동의한 어르신 것만, 저장한 답에서 만든다', async () => {
  const api = createFakeApi({consented: true});
  expect((await api.fetchAnswerHistory())[0].items).toEqual([]);
  await api.saveAnswer({questionId: 'q-1', choice: 'B'});
  const [h] = await api.fetchAnswerHistory();
  expect(h.items[0]).toMatchObject({optionA: '봄', optionB: '가을', choiceLabel: '가을'});
  await api.withdrawConsent();
  expect((await api.fetchAnswerHistory())[0]).toMatchObject({shared: false, items: []});
});

test('fake: 응원은 정해진 키만, 연결된 어르신이 없으면 not_connected', async () => {
  expect(await createFakeApi().sendCheer('love_you')).toEqual({ok: true, sentTo: 1});
  expect(await createFakeApi().sendCheer('stay_healthy' as never)).toEqual({ok: false, reason: 'invalid_key'});
  expect(await createFakeApi({disconnected: true}).sendCheer('warm_day')).toEqual({ok: false, reason: 'not_connected'});
});

test('fake: 로그아웃하면 whoAmI 가 none', async () => {
  const api = createFakeApi({who: 'child'});
  expect(await api.whoAmI()).toBe('child');
  await api.signOut();
  expect(await api.whoAmI()).toBe('none');
});

test('realApi: child_summary 의 parent_id·title·connected 를 읽고, 없으면(옛 서버) 기본값', async () => {
  const rpc = jest.fn(() =>
    Promise.resolve({
      data: {
        parent_title: '부모님',
        parents: [
          {parent_id: 'p1', title: '엄마', shared: true, connected: false, latest: {prompt: null, choice_label: '봄', answered_date: '2026-11-15'}},
          {shared: false, latest: null},
        ],
      },
      error: null,
    }),
  );
  const s = await createRealApi(sbWith(rpc).sb, social).fetchChildSummary();
  expect(s.parents).toEqual([
    {parentId: 'p1', title: '엄마', shared: true, connected: false, latest: {prompt: null, choiceLabel: '봄', answeredDate: '2026-11-15'}},
    {parentId: 'parent-2', title: '부모님', shared: false, connected: true, latest: null},
  ]);
});

test('realApi: child_answer_history·send_cheer·set_parent_title(p_parent_id) 호출 모양', async () => {
  const rpc = jest.fn((name: string) =>
    Promise.resolve(
      name === 'child_answer_history'
        ? {data: {parents: [{parent_id: 'p1', title: '엄마', shared: true, answers: [{answered_date: '2026-11-16', option_a: '봄', option_b: '가을', choice_label: '가을'}]}]}, error: null}
        : name === 'send_cheer'
          ? {data: {ok: true, sent_to: 2}, error: null}
          : {data: {ok: true}, error: null},
    ),
  );
  const api = createRealApi(sbWith(rpc).sb, social);
  expect(await api.fetchAnswerHistory()).toEqual([
    {parentId: 'p1', title: '엄마', shared: true, items: [{answeredDate: '2026-11-16', optionA: '봄', optionB: '가을', choiceLabel: '가을'}]},
  ]);
  expect(await api.sendCheer('love_you')).toEqual({ok: true, sentTo: 2});
  expect(rpc).toHaveBeenCalledWith('send_cheer', {p_message_key: 'love_you'});
  await api.setParentTitle('엄마');
  expect(rpc).toHaveBeenLastCalledWith('set_parent_title', {p_title: '엄마'}); // 지금 서버와 호환
  await api.setParentTitle('아빠', 'p1');
  expect(rpc).toHaveBeenLastCalledWith('set_parent_title', {p_title: '아빠', p_parent_id: 'p1'});
});

test('realApi: 로그인 수단은 세션 provider, 로그아웃은 SDK 정리 뒤 이 기기 세션만', async () => {
  const session = {user: {app_metadata: {provider: 'kakao', providers: ['kakao']}}};
  const {sb, signOut} = sbWith(jest.fn(), session);
  const api = createRealApi(sb, social);
  expect(await api.getLoginMethod()).toBe('kakao');
  await api.signOut();
  expect(social.signOut).toHaveBeenCalledWith('kakao');
  expect(signOut).toHaveBeenCalledWith({scope: 'local'});
});
