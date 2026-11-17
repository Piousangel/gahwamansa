const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

// git worktree 에서 메인 체크아웃의 node_modules 를 심볼릭 링크로 쓸 때: Metro 는 링크 밖 실제 경로를 보지 못하므로 그 경로를 감시·탐색 대상에 더한다
const nodeModules = path.join(__dirname, 'node_modules');
try {
  if (fs.lstatSync(nodeModules).isSymbolicLink()) {
    const real = fs.realpathSync(nodeModules);
    config.watchFolders = [real];
    config.resolver = { nodeModulesPaths: [real] };
  }
} catch {
  // node_modules 가 없으면 기본 설정
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
