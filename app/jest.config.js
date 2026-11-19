module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.after.js'],
  // 흐름 테스트는 여러 화면·모션을 지나므로 부하(병렬 워커)에서 기본 5초를 넘을 수 있다(불안정 원인, P7 리뷰 L6)
  testTimeout: 20000,
  // 가짜 시계는 setImmediate 를 가짜로 만들지 않는다(CI #53 첫 실행 30분 멈춤, 2026-11-19).
  // Node 22(engines 최솟값·CI)에서 가짜 시계 동안 화면을 그린 테스트 뒤에는 진짜 setImmediate 가
  // 다른 타이머가 깰 때까지 돌지 않아, 다음 테스트의 act·waitFor 가 제한 시간까지 멈춘다(Node 26 은 정상).
  fakeTimers: {doNotFake: ['setImmediate']},
  // 소리 자산(react-native preset 의 자산 변환에 없는 확장자) → 자산 번호 자리표시
  moduleNameMapper: {'\\.(wav|mp3|ogg|m4a|aac)$': '<rootDir>/testUtils/soundAssetStub.js'},
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-url-polyfill)/)',
  ],
};
