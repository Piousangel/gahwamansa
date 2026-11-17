// 개발자 메뉴를 production 번들에서 빼는 Metro 규칙(보안: 역할 전환·세션 보관·테스트 가족 코드가 출시 앱에 없게).
// - 번들 환경: Gradle 이 번들 직전에 쓰는 src/lib/env.generated.ts 의 APP_ENV(없으면 local). 검사 스크립트는 BUMOJASIK_BUNDLE_APP_ENV 로 덮어쓴다.
// - production 이면 src/dev/DevMenuHost.tsx 를 DevMenuHost.stub.tsx 로 바꾼다. 구현이 import 하는 sessionSlots·testFamily 도 따라서 빠진다.
// 확인: scripts/check-dev-menu-bundle.sh(production 번들에 표식 문자열이 없어야 한다)
const fs = require('fs');
const path = require('path');

function bundleAppEnv(appDir, env = process.env, readFile = f => fs.readFileSync(f, 'utf8')) {
  if (env.BUMOJASIK_BUNDLE_APP_ENV) {
    return env.BUMOJASIK_BUNDLE_APP_ENV;
  }
  try {
    const m = /"APP_ENV"\s*:\s*"(\w+)"/.exec(readFile(path.join(appDir, 'src/lib/env.generated.ts')));
    return m ? m[1] : 'local';
  } catch {
    return 'local';
  }
}

function devMenuRedirect(filePath, appEnv, appDir) {
  const impl = path.join(appDir, 'src/dev/DevMenuHost.tsx');
  if (appEnv === 'production' && path.resolve(filePath) === impl) {
    return path.join(appDir, 'src/dev/DevMenuHost.stub.tsx');
  }
  return null;
}

module.exports = {bundleAppEnv, devMenuRedirect};
