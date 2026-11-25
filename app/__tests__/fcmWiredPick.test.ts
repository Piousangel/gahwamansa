// FCM_WIRED 켬(내부 테스트 N1): real 모드는 Firebase 메시징 모듈이 있으면 FCM 공급자를 쓴다.
// 이 파일은 메시징 모듈을 '있는 것'으로 모의한다(jest.mock 은 파일 단위라 다른 시험과 섞이지 않게 따로 둔다 — #262 리뷰).
// '모듈은 있지만 Firebase 앱이 없는 빌드 → 토큰 없음'은 fcmTokenSource.test(전역 모의 그대로)가 본다.
import {FCM_WIRED} from '../src/push/fcmTokenSource';
import {pickTokenSource} from '../src/push/tokenSource';

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: async () => 'fcm_token_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  onTokenRefresh: () => () => {},
  getInitialNotification: async () => null,
  onNotificationOpenedApp: () => () => {},
  onMessage: () => () => {},
  setAutoInitEnabled: async () => {},
}));

test('real 모드는 FCM 공급자, fake 모드는 그대로 가짜 토큰', () => {
  expect(FCM_WIRED).toBe(true);
  expect(pickTokenSource('real').kind).toBe('fcm');
  expect(pickTokenSource('fake').kind).toBe('fake');
});
