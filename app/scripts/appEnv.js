#!/usr/bin/env node
/* eslint-env node */
// 앱 환경 설정 생성·검사(iOS 준비 N2): app/env/<flavor>.env → src/lib/env.generated.ts. Gradle(Android)과 Xcode Build Phase(iOS)가
// 같은 스크립트를 부른다 — 검사 규칙을 한 곳에 둔다(전에는 app/android/app/build.gradle 에만 있었다). node 표준 모듈만.
//
//   node scripts/appEnv.js load-json [--require-real-env]
//       두 flavor 를 읽고 검사한 값(JSON)을 stdout 에. Gradle 이 설정 단계에서 resValue·BuildConfig·매니페스트에 쓴다
//   node scripts/appEnv.js check --flavor staging|production --build-type debug|release [플래그]
//       빌드 전 검사만(예시 값으로 release 금지, production release 앱 정보 빈 값 금지)
//   node scripts/appEnv.js write --flavor … --build-type … [--version-name 1.0.0] [--version-code 132] [--git-sha abc] [--link-host h] [플래그]
//       검사 + env.generated.ts 쓰기. 버전을 주지 않으면 package.json version·git 커밋 수·짧은 sha(iOS Build Phase 용)
//   node scripts/appEnv.js verify-bundle --flavor … <bundle 파일…>
//       release 번들에 개발 전용 코드·테스트 계정 표식이 있으면 실패
//   플래그: --require-real-env(예시 파일 금지, 출시 경로) · --allow-placeholder(확인용 release) · --allow-missing-app-info(확인용, --require-real-env 와 함께면 무시)
// 실패는 exit 1 + stderr 한 줄(한국어), 경고는 stderr 의 '경고:' 줄.
'use strict';
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const APP = path.join(__dirname, '..');
const FLAVORS = ['staging', 'production'];
const REQUIRED = ['APP_ENV', 'API_MODE', 'SUPABASE_PROJECT_REF', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'KAKAO_NATIVE_APP_KEY', 'GOOGLE_WEB_CLIENT_ID'];
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const TEST_HOST_RE = /^(.*\.)?(example\.(com|net|org)|localhost|.*\.(test|invalid|example|localhost|local))$/i;
// 앱 정보(AU-07): 형식이 틀리면 실패, 비면 경고(production release 는 실패)
const APP_INFO_RULES = {
  TERMS_URL: /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/,
  PRIVACY_URL: /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/,
  CONTACT_EMAIL: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  BIZ_NAME: /^[^\n"<>]{1,80}$/,
  BIZ_CEO: /^[^\n"<>]{1,80}$/,
  BIZ_REG_NO: /^\d{3}-\d{2}-\d{5}$/,
  BIZ_ADDRESS: /^[^\n"<>]{1,80}$/,
};
const APP_INFO_KEYS = Object.keys(APP_INFO_RULES);

class EnvError extends Error {}
const fail = msg => {
  throw new EnvError(msg);
};

function readEnvFile(file) {
  const m = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const i = t.indexOf('=');
    if (i <= 0) {
      fail(`${file}: '키=값' 형식이 아닌 줄: ${t}`);
    }
    m[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return m;
}

function loadOne(flavor, {envDir, requireRealEnv}) {
  let file = path.join(envDir, `${flavor}.env`);
  let placeholder = false;
  if (!fs.existsSync(file)) {
    const example = path.join(envDir, `${flavor}.env.example`);
    if (requireRealEnv || !fs.existsSync(example)) {
      fail(`app/env/${flavor}.env 가 없어요. ${flavor}.env.example 을 복사해 실제 공개 값을 채워 주세요(docs/team/RELEASE.md).`);
    }
    file = example;
    placeholder = true;
  }
  const name = path.basename(file);
  const m = readEnvFile(file);
  for (const k of REQUIRED) {
    if (!m[k]) {
      fail(`${name}: ${k} 값이 비어 있어요`);
    }
  }
  // 비밀값 차단: 이 값들은 앱 안에 그대로 들어간다
  for (const [k, v] of Object.entries(m)) {
    if (/secret|service_role|password/i.test(k) || v.startsWith('sb_secret_')) {
      fail(`${name}: 비밀값으로 보이는 ${k} 가 있어요. env 파일에는 공개 값만 둡니다.`);
    }
  }
  if (m.APP_ENV !== flavor) {
    fail(`${name}: APP_ENV=${m.APP_ENV} 가 flavor(${flavor})와 달라요`);
  }
  if (!['fake', 'real'].includes(m.API_MODE)) {
    fail(`${name}: API_MODE 는 fake 또는 real`);
  }
  // production 은 실제 서버만(보안 리뷰 2026-11-18 L2)
  if (flavor === 'production' && m.API_MODE !== 'real') {
    fail(`${name}: production 은 API_MODE=real 만 허용`);
  }
  if (!/^[0-9a-f]{32}$/.test(m.KAKAO_NATIVE_APP_KEY)) {
    fail(`${name}: KAKAO_NATIVE_APP_KEY 형식(32자리 16진수)이 아니에요`);
  }
  if (!/^[a-z0-9-]+$/.test(m.SUPABASE_PROJECT_REF)) {
    fail(`${name}: SUPABASE_PROJECT_REF 형식이 아니에요`);
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(m.SUPABASE_PUBLISHABLE_KEY)) {
    fail(`${name}: SUPABASE_PUBLISHABLE_KEY 는 sb_publishable_ 로 시작하는 키만 넣어요(anon·service_role JWT 금지)`);
  }
  if (m.SUPABASE_URL !== `https://${m.SUPABASE_PROJECT_REF}.supabase.co`) {
    fail(`${name}: SUPABASE_URL 이 https://${m.SUPABASE_PROJECT_REF}.supabase.co 와 달라요`);
  }
  const host = (m.APP_LINK_HOST || '').trim();
  if (host && !HOST_RE.test(host)) {
    fail(`${name}: APP_LINK_HOST 는 소문자 도메인만(스킴·경로 없이): ${host}`);
  }
  m.APP_LINK_HOST = host;
  for (const k of APP_INFO_KEYS) {
    const v = (m[k] || '').trim();
    if (v && !APP_INFO_RULES[k].test(v)) {
      fail(`${name}: ${k} 형식이 아니에요: ${v}`);
    }
    m[k] = v;
  }
  m.SOURCE = name;
  m.PLACEHOLDER = placeholder;
  return m;
}

/** 두 flavor 를 읽고 서로 비교하는 검사까지. {envs, warnings} */
function loadEnvs({envDir = path.join(APP, 'env'), requireRealEnv = false} = {}) {
  const envs = {};
  for (const f of FLAVORS) {
    envs[f] = loadOne(f, {envDir, requireRealEnv});
  }
  const warnings = [];
  if (envs.production.APP_LINK_HOST && TEST_HOST_RE.test(envs.production.APP_LINK_HOST) && !envs.production.PLACEHOLDER) {
    fail(`production.env: APP_LINK_HOST 에 테스트 도메인(${envs.production.APP_LINK_HOST})은 쓸 수 없어요`);
  }
  if (envs.staging.APP_LINK_HOST && envs.staging.APP_LINK_HOST === envs.production.APP_LINK_HOST) {
    fail('APP_LINK_HOST 가 staging 과 production 에서 같아요. staging 은 별도 서브도메인을 써 주세요');
  }
  // 리뷰 M2: 같은 카카오 키면 한 폰에 두 앱을 깔 때 웹 로그인 복귀가 엉킨다
  if (envs.staging.KAKAO_NATIVE_APP_KEY === envs.production.KAKAO_NATIVE_APP_KEY) {
    warnings.push("경고: staging·production 카카오 네이티브 키가 같아요. 두 앱을 한 폰에 같이 설치하면 카카오 웹 로그인 복귀가 엉킬 수 있어요. staging 키 발급·등록은 docs/team/RELEASE.md '외부 콘솔 등록'.");
  }
  return {envs, warnings};
}

const missingAppInfo = e => APP_INFO_KEYS.filter(k => !e[k]);

/** 빌드 전 검사(Gradle preBuild·iOS Build Phase). 경고 목록을 돌려주고, 막을 것은 throw */
function checkBuild(e, {flavor, release, allowPlaceholder = false, allowMissingAppInfo = false, requireRealEnv = false}) {
  const warnings = [];
  if (e.PLACEHOLDER) {
    // 리뷰 L2: 예시 값으로 출시 빌드가 조용히 성공하지 않게
    if (release && !allowPlaceholder) {
      fail(`app/env/${flavor}.env 가 없어 ${flavor} release 를 만들 수 없어요(예시 값 금지). 확인용이면 --allow-placeholder(-PallowPlaceholderEnv)`);
    }
    warnings.push(`경고: app/env/${flavor}.env 가 없어 ${e.SOURCE}(예시 값)로 빌드합니다. 이 앱은 서버에 붙지 못해요.`);
  }
  const missing = missingAppInfo(e);
  if (missing.length) {
    // 리뷰 L4: 출시 경로(--require-real-env)에서는 --allow-missing-app-info 를 무시한다
    const allow = allowMissingAppInfo && !requireRealEnv;
    if (flavor === 'production' && release && !e.PLACEHOLDER && !allow) {
      fail(`production.env: 앱 정보 값이 없어요(설정 화면에서 값 없는 행): ${missing.join(', ')}. G-INT 전 필수(US-03·US-04). 확인용 빌드만 --allow-missing-app-info(-PallowMissingAppInfo, 출시 경로에서는 무시)`);
    }
    warnings.push(`경고: ${e.SOURCE} 에 앱 정보 값이 없어 설정 화면에서 '[설정 필요]'로 보이는 행: ${missing.join(', ')} (AU-07, G-INT 전 필수)`);
  }
  return warnings;
}

/** env.generated.ts 내용(키 순서 고정). BUILD_TYPE 은 Metro 가 release 번들에서 개발 전용 코드를 빼는 근거 */
function renderEnvTs(e, {versionName, versionCode, gitSha, linkHost, release}) {
  const values = {
    APP_ENV: e.APP_ENV,
    API_MODE: e.API_MODE,
    SUPABASE_PROJECT_REF: e.SUPABASE_PROJECT_REF,
    SUPABASE_URL: e.SUPABASE_URL,
    SUPABASE_KEY: e.SUPABASE_PUBLISHABLE_KEY,
    KAKAO_NATIVE_APP_KEY: e.KAKAO_NATIVE_APP_KEY,
    GOOGLE_WEB_CLIENT_ID: e.GOOGLE_WEB_CLIENT_ID,
    APP_LINK_HOST: linkHost,
    VERSION_NAME: versionName,
    VERSION_CODE: versionCode,
    GIT_SHA: gitSha,
    BUILD_TYPE: release ? 'release' : 'debug',
  };
  for (const k of APP_INFO_KEYS) {
    values[k] = e[k] || '';
  }
  return `// 자동 생성(scripts/appEnv.js, app/env/${e.SOURCE}). 직접 고치지 않는다. gitignore.\nexport default ${JSON.stringify(values, null, 4)};\n`;
}

/** 버전 기본값(iOS 처럼 빌드 도구가 주지 않을 때): package.json version · git 커밋 수 · 짧은 sha */
function defaultVersion(appDir = APP) {
  const versionName = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).version;
  const git = args => {
    try {
      return execFileSync('git', args, {cwd: appDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    } catch {
      return '';
    }
  };
  const count = git(['rev-list', '--count', 'HEAD']);
  if (!/^\d+$/.test(count)) {
    fail('버전 코드를 git 커밋 수로 정하지 못했어요(git 없음·저장소 아님). --version-code <숫자> 를 주세요.');
  }
  return {versionName, versionCode: Number(count), gitSha: git(['rev-parse', '--short', 'HEAD'])};
}

// release 번들 검사: Hermes 바이트코드에도 ASCII 문자열은 그대로 담긴다
const RELEASE_EMAIL_ALLOW = ['name@example.com']; // 이메일 입력 칸 예시 문구(copy login.email_placeholder)
function verifyBundle(flavor, bundles, {appDir = APP} = {}) {
  if (!bundles.length) {
    fail('검사할 번들을 찾지 못했어요');
  }
  const markers = ['devTestChild'];
  if (flavor === 'production') {
    markers.push('bumojasik-dev-menu-impl', 'dev_menu_session_', 'createTestFamily');
  }
  const localFile = path.join(appDir, 'src/lib/config.local.ts');
  const localValues = fs.existsSync(localFile)
    ? [...fs.readFileSync(localFile, 'utf8').matchAll(/['"]([^'"]{6,})['"]/g)].map(m => m[1]).filter(v => !['fake', 'real'].includes(v))
    : [];
  const EMAIL = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*(?:example\.(?:test|com|org)|[A-Za-z0-9-]+\.test)/g;
  for (const b of bundles) {
    const text = fs.readFileSync(b).toString('latin1');
    const hit = markers.filter(m => text.includes(m));
    hit.push(...localValues.filter(v => text.includes(v)).map(v => `config.local 값(${v.length}자)`));
    const emails = [...new Set(text.match(EMAIL) || [])].filter(x => !RELEASE_EMAIL_ALLOW.includes(x));
    if (hit.length || emails.length) {
      fail(`${path.basename(b)}(${flavor} release)에 개발 전용 코드·계정 표식이 있어요: ${[...hit, ...emails.map(x => x.replace(/^[^@]+/, '***'))].join(', ')}`);
    }
  }
  return `release 번들 검사 통과(${flavor}): 개발 전용 표식 없음`;
}

function parseArgs(argv) {
  const o = {_: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      o._.push(a);
      continue;
    }
    const k = a.slice(2);
    if (['require-real-env', 'allow-placeholder', 'allow-missing-app-info'].includes(k)) {
      o[k] = true;
    } else {
      o[k] = argv[++i];
    }
  }
  return o;
}

function main(argv, {out = process.stdout, err = process.stderr, appDir = APP} = {}) {
  const [cmd] = argv;
  const o = parseArgs(argv.slice(1));
  const opts = {
    requireRealEnv: !!o['require-real-env'],
    allowPlaceholder: !!o['allow-placeholder'],
    allowMissingAppInfo: !!o['allow-missing-app-info'],
  };
  const warn = ws => ws.forEach(w => err.write(`${w}\n`));
  if (cmd === 'verify-bundle') {
    if (!FLAVORS.includes(o.flavor)) {
      fail('--flavor staging|production 이 필요해요');
    }
    out.write(`${verifyBundle(o.flavor, o._, {appDir})}\n`);
    return;
  }
  const {envs, warnings} = loadEnvs({envDir: path.join(appDir, 'env'), requireRealEnv: opts.requireRealEnv});
  if (cmd === 'load-json') {
    warn(warnings);
    out.write(JSON.stringify(envs));
    return;
  }
  if (cmd !== 'check' && cmd !== 'write') {
    fail(`알 수 없는 명령: ${cmd ?? '(없음)'}. load-json · check · write · verify-bundle`);
  }
  if (!FLAVORS.includes(o.flavor) || !['debug', 'release'].includes(o['build-type'])) {
    fail('--flavor staging|production --build-type debug|release 가 필요해요');
  }
  const e = envs[o.flavor];
  const release = o['build-type'] === 'release';
  warn(checkBuild(e, {flavor: o.flavor, release, ...opts}));
  if (cmd === 'check') {
    return;
  }
  // 리뷰 L1: 버전 이름·코드는 둘 다 주거나 둘 다 빼거나(하나만 오면 조용히 기본값으로 바뀌지 않게)
  if (!!o['version-name'] !== !!o['version-code']) {
    fail('--version-name 과 --version-code 는 함께 주세요(둘 다 빼면 package.json·git 값)');
  }
  const v = o['version-name'] ? {versionName: o['version-name'], versionCode: Number(o['version-code']), gitSha: o['git-sha'] ?? ''} : defaultVersion(appDir);
  if (!Number.isInteger(v.versionCode)) {
    fail('--version-code 는 정수여야 해요');
  }
  // 링크 호스트: release 는 env 값만, debug 는 --link-host 로 덮을 수 있다(로컬 확인용, Gradle -PappLinkHostDebug)
  const linkHost = !release && o['link-host'] ? o['link-host'] : e.APP_LINK_HOST;
  if (linkHost && !HOST_RE.test(linkHost)) {
    fail(`--link-host 는 소문자 도메인만: ${linkHost}`);
  }
  const outFile = o.out ? path.resolve(o.out) : path.join(appDir, 'src/lib/env.generated.ts');
  fs.writeFileSync(outFile, renderEnvTs(e, {...v, linkHost, release}));
}

module.exports = {loadEnvs, checkBuild, renderEnvTs, verifyBundle, defaultVersion, missingAppInfo, parseArgs, main, EnvError, APP_INFO_KEYS, HOST_RE};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    // 리뷰 L2: 예상 못 한 오류도 한 줄로(Gradle 메시지가 스택으로 길어지지 않게). 자세한 건 직접 실행해서 본다
    process.stderr.write(e instanceof EnvError ? `${e.message}\n` : `scripts/appEnv.js 오류: ${e && e.message} (자세히: node scripts/appEnv.js ${process.argv.slice(2).join(' ')})\n`);
    process.exit(1);
  }
}
