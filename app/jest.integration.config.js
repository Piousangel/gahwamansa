// 로컬 Supabase 에 실제로 붙는 통합 테스트. 기본 `npm test` 에는 포함되지 않는다.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__integration__/**/*.test.ts'],
  transform: {'^.+\\.[jt]sx?$': ['babel-jest', {configFile: './babel.config.js'}]},
  testTimeout: 30000,
};
