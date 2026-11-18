/* eslint-env jest */
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);

// 환경 설정: 빌드가 만든 env.generated.ts·개인 config.local.ts 가 맥에 있든 없든 테스트는 같은 값(fake + 공개 키 형식)으로 돈다
jest.mock('./src/lib/env.generated', () => ({
  default: {
    APP_ENV: 'local',
    API_MODE: 'fake',
    KAKAO_NATIVE_APP_KEY: '00000000000000000000000000000000',
    GOOGLE_WEB_CLIENT_ID: 'test-web-client.apps.googleusercontent.com',
  },
}), {virtual: true});
jest.mock('./src/lib/config.local', () => ({default: {}}), {virtual: true});

// 오디오 네이티브 모듈 모킹(AU-03, 실기기 확인은 QA-04). speech 는 라이브러리가 주는 jest 모의
jest.mock('@mhpdev/react-native-speech', () => require('@mhpdev/react-native-speech/jest'));
jest.mock('react-native-sound', () => {
  const instances = [];
  class Sound {
    constructor(asset, basePath, cb) {
      this.asset = asset;
      this.play = jest.fn();
      this.stop = jest.fn();
      this.setVolume = jest.fn();
      this.setNumberOfLoops = jest.fn();
      this.release = jest.fn();
      instances.push(this);
      (typeof basePath === 'function' ? basePath : cb)?.(null);
    }
  }
  Sound.MAIN_BUNDLE = 'main';
  Sound.setCategory = jest.fn();
  Sound.__instances = instances;
  return {__esModule: true, default: Sound};
});
jest.mock('react-native-volume-manager', () => ({
  getRingerMode: jest.fn(() => Promise.resolve(2)),
  addRingerListener: jest.fn(() => ({remove: jest.fn()})),
  removeRingerListener: jest.fn(),
}));

// 네이티브 소셜 로그인 모듈 모킹(실기기 로그인은 리드가 확인)
jest.mock('@react-native-kakao/core', () => ({initializeKakaoSDK: jest.fn(() => Promise.resolve())}));
jest.mock('@react-native-kakao/user', () => ({
  login: jest.fn(() => Promise.resolve({idToken: 'kakao-id-token'})),
  logout: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({type: 'success', data: {idToken: 'google-id-token'}})),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
  isCancelledResponse: r => r && r.type === 'cancelled',
  isErrorWithCode: e => !!e && typeof e.code === 'string',
  statusCodes: {SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE'},
}));

// 회귀 방지: 훅 호출 순서가 바뀌었다는 React 경고는 테스트를 실패시킨다(실기기에서 크래시로 이어질 수 있음)
const origError = console.error;
console.error = (...args) => {
  const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
  if (/change in the order of Hooks|Rendered (more|fewer) hooks than/.test(msg)) {
    throw new Error(`[훅 순서] ${msg}`);
  }
  origError(...args);
};
