const fs = require('fs');
const path = require('path');

// 레이어 규칙(ARCHITECTURE 2절, 계획 12 1-3): 지금은 warn 으로 기준선만 잡고, 4단계(AU-10)에서 error 로 올린다.
// 기준선(2026-11-18, main 9284624): 62건 = features·shared→app 54, 기능 간 7, ui→copy 1(SelectCard).
// 11-19 예외 +2: features/account/FamilyPreview 의 app/session·app/BackBar(PR #11 리뷰 L1, 설정 파일 분리 — AU-10 에서 함께 옮김).
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

// 디자인 시스템 v4 강제 장치(SUMMARY 3절 '코드로 강제하는 방법' 2, RULES-V4): features/·app/·push/ 화면에만(ui/ 는 컴포넌트를 만드는 곳이라 제외).
// 처음엔 warn + 위반 수 기준선(__tests__/dsBaseline.test.ts, 늘면 실패·줄면 숫자를 내린다). 동결 창(AU-10)에 error 로 올린다.
// 메시지 앞머리 [DS:종류] 로 기준선 테스트가 종류별로 센다(레이어 기준선 layerBaseline 은 [DS 메시지를 세지 않는다).
const DS_IMPORT_PATHS = [
  {
    name: 'react-native',
    // Touchable* 은 Pressable 대체 우회(PR #31 리뷰 M3)
    importNames: ['Text', 'TextInput', 'Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback'],
    message: '[DS:rnImport] 화면에서 RN Text·TextInput·Pressable·Touchable* 직접 금지 — ui/ds 의 Text·Field·Button·Choice 를 쓴다(SUMMARY 3절).',
  },
];
const LITERAL = "[value.type='Literal']";
const NEG_LITERAL = "[value.type='UnaryExpression'][value.argument.type='Literal']";
const DS_SYNTAX = [
  ...['fontSize', 'fontWeight', 'lineHeight'].map(k => ({
    selector: `Property[key.name='${k}']${LITERAL}`,
    message: `[DS:${k}] ${k} 숫자 직접 금지 — Text role 로 고른다(tokens-v4 typeRoles).`,
  })),
  {
    selector: `Property[key.name=/^(color|backgroundColor|borderColor|tintColor)$/]${LITERAL}`,
    message: '[DS:color] 색 리터럴 직접 금지 — tone 으로 고른다(외부 브랜드 색은 ui/ds SocialButton 안에서만).',
  },
  {
    selector: `Property[key.name=/^(height|maxHeight)$/]${LITERAL}, Property[key.name=/^(height|maxHeight)$/]${NEG_LITERAL}`,
    message: '[DS:height] 고정 height·maxHeight 숫자 금지 — minHeight 만(글자가 커지면 따라 늘어난다).',
  },
  {
    selector: "JSXAttribute[name.name='numberOfLines']",
    message: '[DS:numberOfLines] 말줄임 금지 — 줄바꿈. 예외(낱말 칸·브랜드 버튼·번호 칸)는 ui/ds 안 ellipsisException 으로만.',
  },
  {selector: "JSXAttribute[name.name='maxFontSizeMultiplier']", message: '[DS:fontScale] 확대 상한은 역할 토큰에서만 — 화면이 고르지 않는다.'},
  {selector: "JSXAttribute[name.name='placeholder']", message: '[DS:placeholder] placeholder 금지 — Field label·hint(SUMMARY 2-8, Q6).'},
  {
    selector: "JSXOpeningElement[name.name='Text20'] > JSXAttribute[name.name='size']",
    message: '[DS:text20Size] Text20 size 숫자 금지 — ui/ds Text role(대응표 ui/tokensV4Migration).',
  },
  // R-10: 말줄임 예외는 ui/ 컴포넌트 안에서만(PR #31 리뷰 M2) — 화면이 ellipsisException·ellipsizeMode 를 쓰면 센다
  {
    selector: "JSXAttribute[name.name=/^(ellipsisException|ellipsizeMode)$/]",
    message: '[DS:ellipsis] 말줄임 예외는 ui/ 컴포넌트 안에서만(R-10) — 화면은 줄바꿈.',
  },
  // R-03 우회(리뷰 M3): Animated.Text·TextInput, import * as RN 의 RN.Text 등
  {
    selector: "JSXMemberExpression[object.name='Animated'][property.name=/^(Text|TextInput)$/]",
    message: '[DS:rnImport] Animated.Text 직접 금지 — ui/ds Text 를 Animated.View 로 감싼다.',
  },
  {
    selector: "ImportDeclaration[source.value='react-native'] > ImportNamespaceSpecifier",
    message: '[DS:rnImport] import * as … from react-native 금지 — 필요한 이름만 가져온다(Text·Pressable 우회 차단).',
  },
  // 리뷰 L4: JSX 속성 색 리터럴(<Icon color="#…">, Svg stroke·fill)
  {
    selector: "JSXAttribute[name.name=/^(color|stroke|fill)$/][value.type='Literal'][value.value=/^(#|rgb)/]",
    message: '[DS:color] 색 리터럴 직접 금지 — tone·토큰 이름으로.',
  },
];

const layerRule = patterns => ['warn', {patterns}];
const LOWER_LAYER = [
  NO_APP,
  {group: ['**/features/*', ...API_IN_FEATURES], message: 'features 를 아래 계층에서 import 금지(ARCHITECTURE 2절).'},
];
// features/ 는 같은 규칙(no-restricted-imports)에 RN 원시 import 경고도 얹는다(override 끼리는 규칙 옵션이 합쳐지지 않고 덮이므로 한 곳에)
const featureImportRule = patterns => ['warn', {patterns, paths: DS_IMPORT_PATHS}];

const featureOverrides = FEATURES.map(name => ({
  files: [`src/features/${name}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': featureImportRule([
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
      files: ['src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
      rules: {'no-restricted-syntax': ['warn', ...DS_SYNTAX]},
    },
    {
      // app/ 에는 레이어 import 규칙이 없으니 RN 원시 import 경고만
      files: ['src/app/**/*.{ts,tsx}'],
      rules: {'no-restricted-imports': ['warn', {paths: DS_IMPORT_PATHS}]},
    },
    {
      // push/(AU-04)·navigation/ 도 같은 층: features 아래, app/ 은 모른다(조립은 app/PushHost)
      files: ['src/shared/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}', 'src/api/**/*.{ts,tsx}', 'src/push/**/*.{ts,tsx}', 'src/navigation/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': layerRule(LOWER_LAYER),
      },
    },
    {
      // push/ 의 화면(N1 PushPermissionScreen 등)도 DS 규칙 대상(PR #31 리뷰 L2). 레이어 규칙은 위와 같고 RN 원시 import 경고를 얹는다
      files: ['src/push/**/*.tsx'],
      rules: {
        'no-restricted-imports': ['warn', {patterns: LOWER_LAYER, paths: DS_IMPORT_PATHS}],
        'no-restricted-syntax': ['warn', ...DS_SYNTAX],
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
