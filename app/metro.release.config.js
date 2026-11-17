// 출시(release) 번들 전용 Metro 설정 — Gradle react { bundleConfig } 만 쓴다(재검토 R1). 개발 서버는 metro.config.js.
// 판정은 Gradle 이 번들 직전에 쓴 src/lib/env.generated.ts(APP_ENV·BUILD_TYPE=release)만. 없거나 release 값이 아니면 번들을 멈춘다.
//  - config.local.ts(개발용 서버 값·테스트 계정) → config.local.empty.ts
//  - 개발자 메뉴 구현 → production 이면 DevMenuHost.stub.tsx
// 산출물 검사: build.gradle verifyReleaseBundle, 직접 확인: npm run check:dev-menu
const { mergeConfig } = require('@react-native/metro-config');
const base = require('./metro.config');
const { releaseBundleEnv, devMenuRedirect } = require('./metroDevMenu');

const BUNDLE = releaseBundleEnv(__dirname);

module.exports = mergeConfig(base, {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      const r = context.resolveRequest(context, moduleName, platform);
      if (r && r.type === 'sourceFile') {
        const stub = devMenuRedirect(r.filePath, BUNDLE, __dirname);
        if (stub) {
          return { ...r, filePath: stub };
        }
      }
      return r;
    },
  },
});
