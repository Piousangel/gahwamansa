const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { bundleAppEnv, devMenuRedirect } = require('./metroDevMenu');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = { resolver: {} };

// git worktree 에서 메인 체크아웃의 node_modules 를 심볼릭 링크로 쓸 때: Metro 는 링크 밖 실제 경로를 보지 못하므로 그 경로를 감시·탐색 대상에 더한다
const nodeModules = path.join(__dirname, 'node_modules');
try {
  if (fs.lstatSync(nodeModules).isSymbolicLink()) {
    const real = fs.realpathSync(nodeModules);
    config.watchFolders = [real];
    config.resolver.nodeModulesPaths = [real];
  }
} catch {
  // node_modules 가 없으면 기본 설정
}

// production 번들에는 개발자 메뉴 구현을 넣지 않는다(metroDevMenu.js). 환경은 Metro 가 시작할 때 한 번 읽는다
const APP_ENV = bundleAppEnv(__dirname);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const r = context.resolveRequest(context, moduleName, platform);
  if (r && r.type === 'sourceFile') {
    const stub = devMenuRedirect(r.filePath, APP_ENV, __dirname);
    if (stub) {
      return { ...r, filePath: stub };
    }
  }
  return r;
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
