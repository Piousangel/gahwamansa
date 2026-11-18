// 자녀 화면 v3 계약(서버 dev-server-notes.md 0019~0021 + ASSUMED(0027) starter): fake 와 realApi 매핑이 같은 모양인지
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {CHEER_FAIL_REASONS, CHILD_CHEER_KEYS} from '../src/features/types';

const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};

function sbWith(rpc: jest.Mock, session: unknown = null) {
  const signOut = jest.fn(() => Promise.resolve({error: null}));
  const sb = {rpc, auth: {getSession: jest.fn(() => Promise.resolve({data: {session}, error: null})), signOut}};
  return {sb: sb as never, signOut};
}

test('응원 키·실패 이유는 서버 목록과 글자까지 같다(dev-server-notes §1 send_cheer)', () => {
  expect([...CHILD_CHEER_KEYS]).toEqual(['love_you', 'warm_day', 'thanks_always', 'peaceful_day']);
  expect([...CHEER_FAIL_REASONS].sort()).toEqual(['daily_limit', 'disconnected', 'invalid_key', 'invalid_target']);
});

test('fake: 어르신 여러 명이면 호칭·연결 상태를 어르신별로, 호칭은 어르신 한 분씩 바꾼다', async () => {
  const api = createFakeApi({
    parents: [
      {title: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: '2026-11-16'}, starter: '가을에 어디 가 보셨어요?'},
      {title: '아빠', connected: false, shared: false},
    ],
  });
  const s = await api.fetchChildSummary();
  expect(s.parents.map(p => [p.title, p.connected, p.shared, p.starter])).toEqual([
    ['엄마', true, true, '가을에 어디 가 보셨어요?'],
    ['아빠', false, false, null],
  ]);
  expect(await api.setParentTitleFor(s.parents[0].parentId, '어머니')).toEqual({ok: true});
  expect(await api.setParentTitleFor('nobody', '엄마')).toEqual({ok: false, reason: 'invalid_target'});
  expect(await api.setParentTitleFor(s.parents[0].parentId, '아빠')).toEqual({ok: false, reason: 'duplicate_title'}); // 0028
  expect((await api.fetchChildSummary()).parents[0].title).toBe('어머니');
});

test('fake: 지난 답은 동의한 어르신 것만, 저장한 답에서 짧은 질문을 만든다', async () => {
  const api = createFakeApi({consented: true});
  expect((await api.fetchAnswerHistory())[0].items).toEqual([]);
  await api.saveAnswer({questionId: 'q-1', choice: 'B'});
  const [h] = await api.fetchAnswerHistory();
  expect(h.items[0]).toMatchObject({promptShort: '봄과 가을 중', choiceLabel: '가을'});
  await api.withdrawConsent();
  expect((await api.fetchAnswerHistory())[0]).toMatchObject({shared: false, items: []});
});

test('fake: 응원은 어르신 한 분에게, 정해진 키만, 끊긴 분·하루 한도는 실패 이유로', async () => {
  const api = createFakeApi();
  expect(await api.sendCheer('parent-1', 'love_you')).toMatchObject({ok: true});
  expect(await api.sendCheer('parent-1', 'stay_healthy' as never)).toEqual({ok: false, reason: 'invalid_key'});
  expect(await api.sendCheer('parent-1', 'warm_day')).toMatchObject({ok: true});
  expect(await api.sendCheer('parent-1', 'warm_day')).toEqual({ok: false, reason: 'daily_limit'}); // 서버 가정 하루 2개
  expect(await createFakeApi({disconnected: true}).sendCheer('parent-1', 'warm_day')).toEqual({ok: false, reason: 'disconnected'});
});

test('fake: 로그아웃하면 whoAmI 가 none', async () => {
  const api = createFakeApi({who: 'child'});
  expect(await api.whoAmI()).toBe('child');
  await api.signOut();
  expect(await api.whoAmI()).toBe('none');
});

test('realApi: child_summary 의 parent_id·title·connected·starter 를 읽고, 없으면(옛 서버) 기본값', async () => {
  const rpc = jest.fn(() =>
    Promise.resolve({
      data: {
        parent_title: '부모님',
        parents: [
          {parent_id: 'p1', title: '엄마', shared: true, connected: false,
            latest: {prompt: null, choice_label: '봄', answered_date: '2026-11-15', starter: '봄나물 뭐 좋아하세요?'}},
          {shared: false, latest: {prompt: null, choice_label: '가을', answered_date: '2026-11-14'}}, // 서버가 잘못 보내도
        ],
      },
      error: null,
    }),
  );
  const s = await createRealApi(sbWith(rpc).sb, social).fetchChildSummary();
  expect(s.parents).toEqual([
    {parentId: 'p1', title: '엄마', shared: true, connected: false, latest: {prompt: null, choiceLabel: '봄', answeredDate: '2026-11-15'}, starter: '봄나물 뭐 좋아하세요?', connectedDate: null},
    {parentId: '', title: '부모님', shared: false, connected: true, latest: null, starter: null, connectedDate: null}, // L2: shared:false 면 답 안 씀, L3: id 없으면 ''
  ]);
});

test('realApi: child_answer_history·send_cheer(p_parent, p_key)·set_parent_title_for 호출 모양', async () => {
  const rpc = jest.fn((name: string) =>
    Promise.resolve(
      name === 'child_answer_history'
        ? {data: {parents: [{parent_id: 'p1', title: '엄마', connected: true, shared: true,
            answers: [{session_date: '2026-11-16', prompt: '…', prompt_short: '봄과 가을 중', option_a: '봄', option_b: '가을', choice_label: '가을'}]}]}, error: null}
        : name === 'send_cheer'
          ? {data: {ok: false, reason: 'daily_limit'}, error: null}
          : {data: {ok: true}, error: null},
    ),
  );
  const api = createRealApi(sbWith(rpc).sb, social);
  expect(await api.fetchAnswerHistory()).toEqual([
    {parentId: 'p1', title: '엄마', shared: true, items: [{answeredDate: '2026-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'}]},
  ]);
  expect(await api.sendCheer('p1', 'thanks_always')).toEqual({ok: false, reason: 'daily_limit'});
  expect(rpc).toHaveBeenCalledWith('send_cheer', {p_parent: 'p1', p_key: 'thanks_always'});
  await api.setParentTitle('엄마');
  expect(rpc).toHaveBeenLastCalledWith('set_parent_title', {p_title: '엄마'}); // 가족 기본값(기존)
  await api.setParentTitleFor('p1', '아빠');
  expect(rpc).toHaveBeenLastCalledWith('set_parent_title_for', {p_parent: 'p1', p_title: '아빠'});
});

test('realApi L5: 오프라인 로그아웃은 이 기기 저장 세션을 직접 지운다', async () => {
  const removeSession = jest.fn(() => Promise.resolve());
  const signOut = jest.fn(() => Promise.resolve({error: {message: 'Network request failed'}}));
  const sb = {auth: {getSession: jest.fn(() => Promise.resolve({data: {session: null}, error: null})), signOut, _removeSession: removeSession}};
  await createRealApi(sb as never, social).signOut();
  expect(removeSession).toHaveBeenCalledTimes(1);
  const sb2 = {auth: {...sb.auth, signOut: jest.fn(() => Promise.resolve({error: {message: 'boom', code: 'XX'}}))}};
  await expect(createRealApi(sb2 as never, social).signOut()).rejects.toBeTruthy(); // 서버 오류는 그대로 알린다
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

test('realApi 로그아웃(0032): 등록한 푸시 토큰이 있으면 unregister_push_token 을 signOut 보다 먼저, 없으면 부르지 않는다', async () => {
  const {memoryStore} = require('../src/lib/kvStore');
  const push = require('../src/lib/pushToken');
  push.setPushTokenStoreForTest(memoryStore());
  try {
    const order: string[] = [];
    const rpc = jest.fn((name: string) => {
      order.push(name);
      return Promise.resolve({data: {ok: true}, error: null});
    });
    const {sb, signOut} = sbWith(rpc);
    signOut.mockImplementation(() => {
      order.push('signOut');
      return Promise.resolve({error: null});
    });
    await createRealApi(sb, social).signOut();
    expect(rpc).not.toHaveBeenCalled(); // 토큰 등록 전(AU-04 전)
    await push.savePushToken('tok-1');
    await createRealApi(sb, social).signOut();
    expect(order).toEqual(['signOut', 'unregister_push_token', 'signOut']);
    expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: 'tok-1'});
    expect(await push.readPushToken()).toBeNull();
    // 해제가 실패해도 로그아웃은 계속
    await push.savePushToken('tok-2');
    rpc.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await createRealApi(sb, social).signOut();
    expect(signOut).toHaveBeenCalledTimes(3);
  } finally {
    push.setPushTokenStoreForTest(null);
  }
});

test('realApi set_parent_title(0035 D-L1): duplicate_title 은 일반 오류가 아니라 호칭 중복으로', async () => {
  const rpc = jest.fn(() => Promise.resolve({data: {ok: false, reason: 'duplicate_title'}, error: null}));
  expect(await createRealApi(sbWith(rpc).sb, social).setParentTitle('엄마')).toEqual({ok: false, reason: 'duplicate_title'});
  rpc.mockImplementationOnce(() => Promise.resolve({data: {ok: false, reason: 'invalid_title'}, error: null}));
  expect(await createRealApi(sbWith(rpc).sb, social).setParentTitle('x')).toEqual({ok: false, reason: 'invalid_title'});
});
