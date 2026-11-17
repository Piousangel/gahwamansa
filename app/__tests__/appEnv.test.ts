import {DEFAULT_ENV, resolveAppEnv, type AppEnv} from '../src/lib/env';
import {versionLabel} from '../src/lib/appVersion';

// @types/node 가 없어 필요한 부분만 선언한다(jest 는 node 에서 돈다)
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; existsSync(f: string): boolean} = require('fs');
const root = `${__dirname}/..`;

const STAGING: Partial<AppEnv> = {
  APP_ENV: 'staging',
  API_MODE: 'real',
  SUPABASE_PROJECT_REF: 'eigocuecmaapxnmhttwj',
  SUPABASE_URL: 'https://eigocuecmaapxnmhttwj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_x',
  VERSION_NAME: '1.0.0',
  VERSION_CODE: 132,
};

describe('resolveAppEnv: 생성 파일(빌드) → config.local.ts(개발 빌드에서만) 순서로 덮는다', () => {
  test('아무것도 없으면 로컬 + fake(서버 없이 화면 개발)', () => {
    const env = resolveAppEnv(undefined, undefined, true);
    expect(env.APP_ENV).toBe('local');
    expect(env.API_MODE).toBe('fake');
    expect(env).toEqual(DEFAULT_ENV);
  });

  test('빌드가 만든 staging 값을 그대로 쓴다', () => {
    const env = resolveAppEnv(STAGING, undefined, false);
    expect(env.APP_ENV).toBe('staging');
    expect(env.API_MODE).toBe('real');
    expect(env.SUPABASE_URL).toBe('https://eigocuecmaapxnmhttwj.supabase.co');
  });

  test('개발 빌드에서는 config.local.ts 가 덮는다(로컬 Supabase), 서버 주소를 바꾸면 APP_ENV 는 local', () => {
    const env = resolveAppEnv(STAGING, {SUPABASE_URL: 'http://10.0.2.2:54321', SUPABASE_KEY: 'local-key'}, true);
    expect(env.SUPABASE_URL).toBe('http://10.0.2.2:54321');
    expect(env.APP_ENV).toBe('local');
    expect(env.API_MODE).toBe('real');
    expect(env.VERSION_CODE).toBe(132); // 버전은 빌드 값 유지
  });

  test('개발 빌드에서 config.local.ts 로 fake 모드 선택', () => {
    expect(resolveAppEnv(STAGING, {API_MODE: 'fake'}, true).API_MODE).toBe('fake');
  });

  test('release(개발 아님)에서는 config.local.ts 를 무시한다 — 맥에 남은 로컬 설정이 출시 빌드에 섞이지 않게', () => {
    const env = resolveAppEnv(STAGING, {SUPABASE_URL: 'http://10.0.2.2:54321', API_MODE: 'fake'}, false);
    expect(env.SUPABASE_URL).toBe('https://eigocuecmaapxnmhttwj.supabase.co');
    expect(env.API_MODE).toBe('real');
  });

  test('빈 문자열·알 수 없는 값은 무시(기본값 유지)', () => {
    const env = resolveAppEnv({APP_ENV: 'weird' as never, API_MODE: 'x' as never, SUPABASE_URL: ''}, undefined, false);
    expect(env.APP_ENV).toBe('local');
    expect(env.API_MODE).toBe('fake');
  });
});

test('getAppEnv 는 빌드 생성 파일(env.generated)을 읽고, 소셜 설정도 그 값을 쓴다(jest.setup 의 테스트 값)', () => {
  const {getAppEnv} = require('../src/lib/env');
  const social = require('../src/lib/socialConfig');
  expect(getAppEnv().GOOGLE_WEB_CLIENT_ID).toBe('test-web-client.apps.googleusercontent.com');
  expect(social.GOOGLE_WEB_CLIENT_ID).toBe(getAppEnv().GOOGLE_WEB_CLIENT_ID);
  expect(social.KAKAO_NATIVE_APP_KEY).toBe('00000000000000000000000000000000');
  expect(getAppEnv().API_MODE).toBe('fake');
});

describe('versionLabel: 설정 화면에 보여 줄 버전 문자열', () => {
  test('production: "1.0.0 (132)"', () => {
    expect(versionLabel({...DEFAULT_ENV, ...STAGING, APP_ENV: 'production'})).toBe('1.0.0 (132)');
  });
  test('staging: 테스트 표시와 서버 ref', () => {
    expect(versionLabel({...DEFAULT_ENV, ...STAGING})).toBe('1.0.0 (132) · 테스트 · eigocuecmaapxnmhttwj');
  });
  test('로컬·빌드 정보 없음: 개발 빌드 표시', () => {
    expect(versionLabel(DEFAULT_ENV)).toBe('개발 빌드 · 로컬');
    expect(versionLabel({...DEFAULT_ENV, VERSION_NAME: '1.0.0', VERSION_CODE: 7})).toBe('1.0.0 (7) · 로컬');
  });
});

describe('환경 파일·빌드 설정(정적 검사)', () => {
  const parse = (f: string) =>
    Object.fromEntries(
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );

  test.each(['env/staging.env', 'env/production.env.example'])('%s: 필수 공개 키가 있고 비밀값은 없다', f => {
    const env = parse(`${root}/${f}`);
    for (const k of ['APP_ENV', 'API_MODE', 'SUPABASE_PROJECT_REF', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'KAKAO_NATIVE_APP_KEY', 'GOOGLE_WEB_CLIENT_ID']) {
      expect(env[k]).toBeTruthy();
    }
    for (const [k, v] of Object.entries(env)) {
      expect(k).not.toMatch(/secret|service_role|password/i);
      expect(String(v)).not.toMatch(/^sb_secret_/);
    }
  });

  test('staging 은 현재 원격(eigocuecmaapxnmhttwj)', () => {
    const env = parse(`${root}/env/staging.env`);
    expect(env.APP_ENV).toBe('staging');
    expect(env.SUPABASE_URL).toBe(`https://${env.SUPABASE_PROJECT_REF}.supabase.co`);
    expect(env.SUPABASE_PROJECT_REF).toBe('eigocuecmaapxnmhttwj');
  });

  test('build.gradle: flavor 2개, staging 접미사', () => {
    const g = fs.readFileSync(`${root}/android/app/build.gradle`, 'utf8');
    expect(g).toMatch(/staging\s*\{[^}]*applicationIdSuffix "\.staging"/);
    expect(g).toContain('production {');
  });
});
