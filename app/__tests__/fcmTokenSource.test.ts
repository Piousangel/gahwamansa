// Firebase 연결 준비(AU-04 후속): 모듈이 없어도 깨지지 않고, 있으면 data 는 {kind} 만 넘긴다
import {createFcmTokenSource, createFcmTokenSourceFrom, dataOf, FCM_WIRED} from '../src/push/fcmTokenSource';
import {pickTokenSource} from '../src/push/tokenSource';

function fakeModule(over: Record<string, unknown> = {}) {
  const opened: ((m: unknown) => void)[] = [];
  const mod = {
    getMessaging: jest.fn(() => ({})),
    getToken: jest.fn(async () => 'fcm_token_abcdefghijklmnopqrstuvwxyz'),
    onTokenRefresh: jest.fn(() => () => {}),
    getInitialNotification: jest.fn(async () => ({data: {kind: 'daily', extra: 'x'}})),
    onNotificationOpenedApp: jest.fn((_m: unknown, cb: (m: unknown) => void) => {
      opened.push(cb);
      return () => {};
    }),
    onMessage: jest.fn(() => () => {}),
    setAutoInitEnabled: jest.fn(async () => {}),
    ...over,
  };
  return {mod, opened};
}

test('모듈이 없거나 Firebase 앱이 없으면 null(앱은 토큰 없음으로)', () => {
  expect(createFcmTokenSource()).toBeNull();
  expect(createFcmTokenSourceFrom(null)).toBeNull();
});

test('Firebase 초기화 실패(google-services.json 없는 flavor)면 null', () => {
  const {mod} = fakeModule({
    getMessaging: jest.fn(() => {
      throw new Error('No Firebase App');
    }),
  });
  expect(createFcmTokenSourceFrom(mod as never)).toBeNull();
});

test('토큰은 요청 때 자동 초기화를 켠 뒤 받고, 알림 data 는 kind 만', async () => {
  const {mod, opened} = fakeModule();
  const src = createFcmTokenSourceFrom(mod as never)!;
  expect(src.kind).toBe('fcm');
  expect(await src.getToken()).toBe('fcm_token_abcdefghijklmnopqrstuvwxyz');
  expect(mod.setAutoInitEnabled).toHaveBeenCalledWith(expect.anything(), true);
  expect(await src.getInitialOpen()).toEqual({kind: 'daily'});
  const got: unknown[] = [];
  src.onOpen(d => got.push(d));
  opened[0]({data: {kind: 'cheer_arrived', parent_id: 'p1'}});
  opened[0]({data: {}});
  expect(got).toEqual([{kind: 'cheer_arrived'}]);
  expect(dataOf(null)).toBeNull();
});

test('리뷰 M1: 끄기 토글 전에는 real 모드가 FCM 을 쓰지 않는다', () => {
  expect(FCM_WIRED).toBe(false);
  expect(pickTokenSource('real').kind).toBe('none');
});
