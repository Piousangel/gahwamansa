module.exports = {
  preset: '@react-native/jest-preset',
  // 제스처 핸들러 공식 jest 설정(네이티브 모듈 목) — gorhom 바텀시트(11-25)
  setupFiles: ['<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js', '<rootDir>/jest.setup.js'],
  // Reanimated 4·worklets 공식 jest 리졸버(네이티브 대신 웹 구현) → RN preset 리졸버 순으로 잇는다(testUtils/jestResolver.js)
  resolver: '<rootDir>/testUtils/jestResolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.after.js'],
  // 흐름 테스트는 여러 화면·모션을 지나므로 부하(병렬 워커)에서 기본 5초를 넘을 수 있다(불안정 원인, P7 리뷰 L6)
  testTimeout: 20000,
  // 테스트마다 모든 모의 함수의 호출 기록을 비운다(DV-1 부하 불안정, 2026-11-25).
  // preset 의 AccessibilityInfo.sendAccessibilityEvent 등은 이미 jest.fn 이라 jest.spyOn 이 새 spy 를 만들지 않고 그 jest.fn 을 그대로 돌려주며,
  // jest 29 의 restoreAllMocks 는 spyOn 으로 만든 것만 되돌리고 이 기록은 비우지 않는다 → 앞 테스트의 실제 300ms 포커스 타이머가
  // 부하로 언마운트 전에 울리면 그 호출이 다음 테스트의 'not.toHaveBeenCalled' 를 깨뜨렸다. 구현(mockImplementation)은 건드리지 않는다.
  clearMocks: true,
  // 가짜 시계는 setImmediate 를 가짜로 만들지 않는다(CI #53 첫 실행 30분 멈춤, 2026-11-19).
  // Node 22(engines 최솟값·CI)에서 가짜 시계 동안 화면을 그린 테스트 뒤에는 진짜 setImmediate 가
  // 다른 타이머가 깰 때까지 돌지 않아, 다음 테스트의 act·waitFor 가 제한 시간까지 멈춘다(Node 26 은 정상).
  fakeTimers: {doNotFake: ['setImmediate']},
  // 소리 자산(react-native preset 의 자산 변환에 없는 확장자) → 자산 번호 자리표시
  moduleNameMapper: {'\\.(wav|mp3|ogg|m4a|aac)$': '<rootDir>/testUtils/soundAssetStub.js'},
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-url-polyfill|react-native-reanimated|react-native-worklets|react-native-gesture-handler|@gorhom)/)',
  ],
};
