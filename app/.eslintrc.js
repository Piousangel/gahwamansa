const fs = require('fs');
const path = require('path');

// 레이어 규칙(ARCHITECTURE 2절, 계획 12 1-3): 지금은 warn 으로 기준선만 잡고, 4단계(AU-10)에서 error 로 올린다.
// 기준선(2026-11-18, main 9284624): 62건 = features·shared→app 54, 기능 간 7, ui→copy 1(SelectCard).
// 새 위반을 만들지 않는다(리뷰 체크리스트 9절). 수는 __tests__/layerBaseline.test.ts 가 지킨다(늘면 실패, 줄면 숫자를 내린다).
const FEATURES_DIR = path.join(__dirname, 'src/features');
const FEATURES = fs
  .readdirSync(FEATURES_DIR, {withFileTypes: true})
  .filter(d => d.isDirectory())
  .map(d => d.name);

const NO_APP = {
  group: ['**/app/*', '!**/app.json'],
  message: 'features·shared·ui·lib·api 에서 app/(조립 계층) import 금지(ARCHITECTURE 2절). state/·navigation/·ui/ 로 옮길 대상.',
};

// features/ 바로 아래의 api 계층 파일(4단계 4-4 에서 src/api/ 로 이동 예정)은 아래 계층이 써도 된다
const API_IN_FEATURES = ['types', 'fakeApi', 'realApi', 'selectApi', 'socialAuth'].map(f => `!**/features/${f}`);

const layerRule = patterns => ['warn', {patterns}];

const featureOverrides = FEATURES.map(name => ({
  files: [`src/features/${name}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': layerRule([
      NO_APP,
      {
        group: FEATURES.filter(other => other !== name).flatMap(other => [`../${other}/*`, `**/features/${other}/*`]),
        message: '기능 간 import 금지(ARCHITECTURE 2절). 둘 이상이 쓰면 shared/ 나 ui/ 로 올린다.',
      },
    ]),
  },
}));

module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    ...featureOverrides,
    {
      // push/(AU-04)·navigation/ 도 같은 층: features 아래, app/ 은 모른다(조립은 app/PushHost)
      files: ['src/shared/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}', 'src/api/**/*.{ts,tsx}', 'src/push/**/*.{ts,tsx}', 'src/navigation/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': layerRule([
          NO_APP,
          {group: ['**/features/*', ...API_IN_FEATURES], message: 'features 를 아래 계층에서 import 금지(ARCHITECTURE 2절).'},
        ]),
      },
    },
    {
      // 오디오(공용, 오디오 리뷰 L6): features 아래·ui 위. 화면·문구를 모른다(문구는 호출부가 넘긴다)
      files: ['src/audio/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': layerRule([
          NO_APP,
          {
            group: ['**/features/*', '**/copy/*', ...API_IN_FEATURES],
            message: 'audio/ 는 features·copy 를 모른다(ARCHITECTURE 2절, 오디오 리뷰 L6).',
          },
        ]),
      },
    },
    {
      files: ['src/ui/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': layerRule([
          NO_APP,
          {
            group: ['**/features/*', '**/copy/*', '**/api/*'],
            message: 'ui/ 는 copy·api·features 를 모른다 — 문구·데이터는 props 로(ARCHITECTURE 2절).',
          },
        ]),
      },
    },
    {
      // 계약은 플랫폼 무관 TS 만(React·RN·copy 금지, ARCHITECTURE 1절)
      files: ['src/api/contract/**/*.ts'],
      rules: {
        'no-restricted-imports': layerRule([
          NO_APP,
          {group: ['**/features/*', '**/copy/*', '**/ui/*'], message: 'contract 는 copy·ui·features 를 모른다.'},
          {group: ['react', 'react-native', 'react-native-*', '@react-native*'], message: 'contract 는 플랫폼 무관 TS 만.'},
        ]),
      },
    },
  ],
};
