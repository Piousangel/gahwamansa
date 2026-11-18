module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.after.js'],
  // 흐름 테스트는 여러 화면·모션을 지나므로 부하(병렬 워커)에서 기본 5초를 넘을 수 있다(불안정 원인, P7 리뷰 L6)
  testTimeout: 20000,
  // 소리 자산(react-native preset 의 자산 변환에 없는 확장자) → 자산 번호 자리표시
  moduleNameMapper: {'\\.(wav|mp3|ogg|m4a|aac)$': '<rootDir>/testUtils/soundAssetStub.js'},
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-url-polyfill)/)',
  ],
};
