/**
 * @jest-environment node
 */
// iOS 준비 N2: env 생성·검사 공통 스크립트(scripts/appEnv.js). Gradle·Xcode Build Phase 가 같이 부른다.
declare const __dirname: string;
const fs: {
  mkdtempSync(p: string): string;
  mkdirSync(p: string, o?: {recursive: boolean}): void;
  writeFileSync(p: string, d: string): void;
  readFileSync(p: string, e: 'utf8'): string;
  rmSync(p: string, o: {recursive: boolean; force: boolean}): void;
} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const os: {tmpdir(): string} = require('os');
const {loadEnvs, checkBuild, renderEnvTs, verifyBundle, main, EnvError} = require('../scripts/appEnv.js');

const KAKAO_A = '0123456789abcdef0123456789abcdef';
const KAKAO_B = 'fedcba9876543210fedcba9876543210';
const base = (flavor: string, extra: Record<string, string> = {}) => ({
  APP_ENV: flavor,
  API_MODE: 'real',
  SUPABASE_PROJECT_REF: `${flavor}-ref`,
  SUPABASE_URL: `https://${flavor}-ref.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc_DEF-123',
  KAKAO_NATIVE_APP_KEY: flavor === 'staging' ? KAKAO_A : KAKAO_B,
  GOOGLE_WEB_CLIENT_ID: 'x.apps.googleusercontent.com',
  ...extra,
});
const INFO = {
  TERMS_URL: 'https://gahwa.kr/terms.html',
  PRIVACY_URL: 'https://gahwa.kr/privacy.html',
  CONTACT_EMAIL: 'help@gahwa.kr',
  BIZ_NAME: '가화만사성',
  BIZ_CEO: '홍길동',
  BIZ_REG_NO: '123-45-67890',
  BIZ_ADDRESS: '서울특별시 어딘가 1',
};

let dir = '';
const write = (name: string, m: Record<string, string>) =>
  fs.writeFileSync(path.join(dir, 'env', name), `# 주석\n${Object.entries(m).map(([k, v]) => `${k}=${v}`).join('\n')}\n`);
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appenv-'));
  fs.mkdirSync(path.join(dir, 'env'), {recursive: true});
  fs.mkdirSync(path.join(dir, 'src/lib'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({version: '1.2.3'}));
  write('staging.env', base('staging'));
  write('production.env', base('production', INFO));
});
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));
const load = (o = {}) => loadEnvs({envDir: path.join(dir, 'env'), ...o});
const expectFail = (f: () => unknown, re: RegExp) => {
  expect(f).toThrow(EnvError);
  expect(f).toThrow(re);
};

describe('읽기·검사(이전 Gradle 규칙과 같다)', () => {
  test('정상 값, 앱 정보 빈 칸은 빈 문자열', () => {
    const {envs, warnings} = load();
    expect(envs.staging.APP_ENV).toBe('staging');
    expect(envs.staging.TERMS_URL).toBe('');
    expect(envs.production.PLACEHOLDER).toBe(false);
    expect(warnings).toEqual([]);
  });
  test('production.env 가 없으면 예시 파일(경고용 표시), 출시 경로(--require-real-env)는 실패', () => {
    fs.rmSync(path.join(dir, 'env/production.env'), {recursive: true, force: true});
    write('production.env.example', base('production'));
    expect(load().envs.production.PLACEHOLDER).toBe(true);
    expectFail(() => load({requireRealEnv: true}), /production\.env 가 없어요/);
  });
  test.each([
    ['비밀값 키', {SUPABASE_SERVICE_ROLE: 'x'}, /비밀값/],
    ['sb_secret_ 값', {SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x'}, /비밀값/],
    ['APP_ENV 불일치', {APP_ENV: 'production'}, /flavor\(staging\)/],
    ['API_MODE', {API_MODE: 'mock'}, /fake 또는 real/],
    ['카카오 키 형식', {KAKAO_NATIVE_APP_KEY: 'XYZ'}, /32자리/],
    ['publishable 키만', {SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi'}, /sb_publishable_/],
    ['URL 과 ref', {SUPABASE_URL: 'https://other.supabase.co'}, /와 달라요/],
    ['링크 호스트 형식', {APP_LINK_HOST: 'https://a.kr/c'}, /소문자 도메인/],
    ['앱 정보 형식', {TERMS_URL: 'http://a.kr'}, /TERMS_URL 형식/],
    ['필수 값', {GOOGLE_WEB_CLIENT_ID: ''}, /비어 있어요/],
  ])('staging %s → 실패', (_n, extra, re) => {
    write('staging.env', base('staging', extra as Record<string, string>));
    expectFail(() => load(), re);
  });
  test('production 은 API_MODE=real 만, 테스트 도메인 금지, staging 과 같은 링크 호스트 금지', () => {
    write('production.env', base('production', {...INFO, API_MODE: 'fake'}));
    expectFail(() => load(), /real 만 허용/);
    write('production.env', base('production', {...INFO, APP_LINK_HOST: 'x.example.com'}));
    expectFail(() => load(), /테스트 도메인/);
    write('production.env', base('production', {...INFO, APP_LINK_HOST: 'gahwa.kr'}));
    write('staging.env', base('staging', {APP_LINK_HOST: 'gahwa.kr'}));
    expectFail(() => load(), /staging 과 production 에서 같아요/);
  });
  test('카카오 키가 같으면 경고(실패 아님)', () => {
    write('staging.env', base('staging', {KAKAO_NATIVE_APP_KEY: KAKAO_B}));
    expect(load().warnings.join()).toMatch(/카카오 네이티브 키가 같아요/);
  });
});

describe('빌드 전 검사', () => {
  test('예시 값으로 release 는 실패(확인용 --allow-placeholder 만 허용), debug 는 경고', () => {
    fs.rmSync(path.join(dir, 'env/production.env'), {recursive: true, force: true});
    write('production.env.example', base('production'));
    const e = load().envs.production;
    expectFail(() => checkBuild(e, {flavor: 'production', release: true}), /예시 값 금지/);
    expect(checkBuild(e, {flavor: 'production', release: true, allowPlaceholder: true}).join()).toMatch(/예시 값/);
    expect(checkBuild(e, {flavor: 'production', release: false}).join()).toMatch(/예시 값/);
  });
  test('production release 앱 정보 빈 값은 실패, --allow-missing-app-info 는 출시 경로(--require-real-env)에서 무시', () => {
    write('production.env', base('production'));
    const e = load().envs.production;
    expectFail(() => checkBuild(e, {flavor: 'production', release: true}), /앱 정보 값이 없어요/);
    expect(checkBuild(e, {flavor: 'production', release: true, allowMissingAppInfo: true}).join()).toMatch(/설정 필요/);
    expectFail(() => checkBuild(e, {flavor: 'production', release: true, allowMissingAppInfo: true, requireRealEnv: true}), /앱 정보/);
    expect(checkBuild(load().envs.staging, {flavor: 'staging', release: true}).join()).toMatch(/설정 필요/);
  });
});

describe('env.generated.ts 쓰기', () => {
  test('키·값(release 는 env 의 링크 호스트만, debug 는 --link-host 로 덮기), 버전은 인자 또는 package.json·git', () => {
    const e = load().envs.staging;
    const ts = renderEnvTs(e, {versionName: '1.0.0', versionCode: 7, gitSha: 'abc', linkHost: '', release: true});
    expect(ts).toMatch(/^\/\/ 자동 생성\(scripts\/appEnv\.js, app\/env\/staging\.env\)/);
    const obj = JSON.parse(ts.slice(ts.indexOf('{'), ts.lastIndexOf('}') + 1));
    expect(Object.keys(obj)).toEqual([
      'APP_ENV', 'API_MODE', 'SUPABASE_PROJECT_REF', 'SUPABASE_URL', 'SUPABASE_KEY', 'KAKAO_NATIVE_APP_KEY', 'GOOGLE_WEB_CLIENT_ID',
      'APP_LINK_HOST', 'VERSION_NAME', 'VERSION_CODE', 'GIT_SHA', 'BUILD_TYPE',
      'TERMS_URL', 'PRIVACY_URL', 'CONTACT_EMAIL', 'BIZ_NAME', 'BIZ_CEO', 'BIZ_REG_NO', 'BIZ_ADDRESS',
    ]);
    expect(obj).toMatchObject({BUILD_TYPE: 'release', VERSION_CODE: 7, SUPABASE_KEY: 'sb_publishable_abc_DEF-123'});

    const err = {write: () => true};
    const out = path.join(dir, 'out.ts');
    main(['write', '--flavor', 'staging', '--build-type', 'debug', '--version-name', '9.9.9', '--version-code', '5', '--link-host', 'dev.gahwa.kr', '--out', out], {appDir: dir, err});
    expect(fs.readFileSync(out, 'utf8')).toMatch(/"APP_LINK_HOST": "dev\.gahwa\.kr"/);
    main(['write', '--flavor', 'staging', '--build-type', 'release', '--version-name', '9.9.9', '--version-code', '5', '--link-host', 'dev.gahwa.kr', '--out', out], {appDir: dir, err});
    expect(fs.readFileSync(out, 'utf8')).toMatch(/"APP_LINK_HOST": ""/);
    expect(() => main(['write', '--flavor', 'staging', '--build-type', 'debug', '--version-name', '1', '--version-code', '1', '--link-host', 'Bad/Host', '--out', out], {appDir: dir, err})).toThrow(/소문자 도메인/);
  });
  test('명령·인자가 틀리면 실패', () => {
    const err = {write: () => true};
    expect(() => main(['nope'], {appDir: dir, err})).toThrow(/알 수 없는 명령/);
    expect(() => main(['check', '--flavor', 'dev', '--build-type', 'debug'], {appDir: dir, err})).toThrow(/--flavor staging\|production/);
  });
});

describe('release 번들 검사', () => {
  const bundle = (text: string) => {
    const p = path.join(dir, `b${Math.random().toString(36).slice(2)}.bundle`);
    fs.writeFileSync(p, text);
    return p;
  };
  test('production 은 개발자 메뉴 표식 금지, staging 은 허용 · 테스트 이메일·config.local 값 금지 · 예시 이메일은 허용', () => {
    expect(() => verifyBundle('production', [bundle('x bumojasik-dev-menu-impl y')], {appDir: dir})).toThrow(/개발 전용/);
    expect(verifyBundle('staging', [bundle('x bumojasik-dev-menu-impl y')], {appDir: dir})).toMatch(/통과/);
    expect(() => verifyBundle('staging', [bundle('kid@example.test')], {appDir: dir})).toThrow(/\*\*\*@example\.test/);
    expect(verifyBundle('production', [bundle('name@example.com')], {appDir: dir})).toMatch(/통과/);
    fs.writeFileSync(path.join(dir, 'src/lib/config.local.ts'), "export default {SUPABASE_KEY: 'local-secret-ish'};");
    expect(() => verifyBundle('staging', [bundle('..local-secret-ish..')], {appDir: dir})).toThrow(/config\.local 값/);
    expect(() => verifyBundle('staging', [], {appDir: dir})).toThrow(/번들을 찾지 못했어요/);
  });
});

test('Gradle 은 규칙을 다시 갖지 않고 스크립트를 부른다', () => {
  const g = fs.readFileSync(path.join(__dirname, '../android/app/build.gradle'), 'utf8');
  for (const gone of ['def readEnvFile', 'def loadAppEnv', 'APP_INFO_RULES', 'def writeEnvTs', 'RELEASE_EMAIL_ALLOW']) {
    expect(g).not.toContain(gone);
  }
  for (const cmd of ['"load-json"', '"check"', '"write"', '"verify-bundle"']) {
    expect(g).toContain(cmd);
  }
});
