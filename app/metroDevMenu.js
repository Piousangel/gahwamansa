// 개발 전용 코드를 출시 번들에서 빼는 Metro 규칙(보안 리뷰 2026-11-18 H1·M1).
// 판정 근거는 Gradle 이 번들 직전에 쓰는 src/lib/env.generated.ts 하나(APP_ENV·BUILD_TYPE). 환경 변수로 덮어쓰지 않는다.
// 이 규칙은 metro.release.config.js(Gradle bundleConfig)에서만 쓴다. 개발 서버(metro.config.js)는 대역을 걸지 않는다(재검토 R1).
// 모르면 빼는 쪽(fail-closed):
//   - 개발자 메뉴 구현(src/dev/DevMenuHost.tsx): APP_ENV 가 staging·local 일 때만. 그 밖은 DevMenuHost.stub.tsx
//     (구현이 import 하는 sessionSlots·testFamily 도 따라서 빠진다)
//   - config.local.ts(로컬 서버 값·테스트 계정, gitignore): debug 빌드에만. release·불명은 config.local.empty.ts
// 확인: npm run check:dev-menu(직접 번들), Gradle release 번들 뒤 산출물 검사(build.gradle verifyReleaseBundle)
const fs = require('fs');
const path = require('path');

const ENVS = ['local', 'staging', 'production'];
const BUILD_TYPES = ['debug', 'release'];

function bundleAppEnv(appDir, readFile = f => fs.readFileSync(f, 'utf8')) {
  let s;
  try {
    s = readFile(path.join(appDir, 'src/lib/env.generated.ts'));
  } catch {
    return {appEnv: 'unknown', buildType: 'unknown'};
  }
  const pick = (k, allowed) => {
    const m = new RegExp(`"${k}"\\s*:\\s*"(\\w+)"`).exec(s);
    return m && allowed.includes(m[1]) ? m[1] : 'unknown';
  };
  return {appEnv: pick('APP_ENV', ENVS), buildType: pick('BUILD_TYPE', BUILD_TYPES)};
}

function devMenuRedirect(filePath, bundle, appDir) {
  const p = path.resolve(filePath);
  if (p === path.join(appDir, 'src/dev/DevMenuHost.tsx') && !['staging', 'local'].includes(bundle.appEnv)) {
    return path.join(appDir, 'src/dev/DevMenuHost.stub.tsx');
  }
  if (p === path.join(appDir, 'src/lib/config.local.ts') && bundle.buildType !== 'debug') {
    return path.join(appDir, 'src/lib/config.local.empty.ts');
  }
  return null;
}

// release 설정 전용: 파일이 없거나 release 값이 아니면 멈춘다(모르면 진행하지 않음)
function releaseBundleEnv(appDir, readFile) {
  const b = bundleAppEnv(appDir, readFile);
  if (b.appEnv === 'unknown') {
    throw new Error('metro.release.config.js: src/lib/env.generated.ts 가 없거나 APP_ENV 를 모르겠어요(Gradle release 번들 작업이 쓴다)');
  }
  if (b.buildType !== 'release') {
    throw new Error(`metro.release.config.js: env.generated.ts 의 BUILD_TYPE 이 release 가 아니에요(${b.buildType})`);
  }
  return b;
}

module.exports = {bundleAppEnv, devMenuRedirect, releaseBundleEnv};
