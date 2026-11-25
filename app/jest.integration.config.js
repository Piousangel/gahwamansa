// 로컬 Supabase 에 실제로 붙는 통합 테스트. 기본 `npm test` 에는 포함되지 않는다.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__integration__/**/*.test.ts'],
  transform: {'^.+\\.[jt]sx?$': ['babel-jest', {configFile: './babel.config.js'}]},
  testTimeout: 30000,
  // 실행 동안 맥 잠자기 방지·잠들었으면 경고(대기열 65, jest.config.js 와 같음)
  globalSetup: '<rootDir>/testUtils/jestGlobalSetup.js',
  globalTeardown: '<rootDir>/testUtils/jestGlobalTeardown.js',
};
