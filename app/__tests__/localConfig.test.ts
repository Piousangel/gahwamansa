import {assertLocalTarget, isLocalSupabaseUrl} from '../src/lib/config';

// 리뷰 H1: 통합 테스트(테스트 계정 생성·service role 로 데이터 삭제)는 로컬 Supabase 에만 붙어야 한다.
// 빌드가 남긴 env.generated.ts(staging/production)를 읽어 원격에 붙는 회귀를 막는다.
describe('isLocalSupabaseUrl', () => {
  test.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://10.0.2.2:54321',
    'http://192.168.0.12:54321',
    'http://10.1.2.3:54321',
    'http://172.20.1.5:54321',
  ])('로컬: %s', url => expect(isLocalSupabaseUrl(url)).toBe(true));

  test.each([
    'https://eigocuecmaapxnmhttwj.supabase.co',
    'https://127.0.0.1.evil.example.com',
    'http://172.32.0.1:54321',
    'http://8.8.8.8:54321',
    '',
    'not a url',
  ])('원격·이상한 값: %s', url => expect(isLocalSupabaseUrl(url)).toBe(false));
});

describe('assertLocalTarget: 통합 테스트 접속 값 검사', () => {
  test('config.local.ts 가 없거나 비면 실패(빌드 생성 값으로 대신하지 않음)', () => {
    expect(() => assertLocalTarget(undefined)).toThrow(/config\.local\.ts/);
    expect(() => assertLocalTarget({SUPABASE_URL: '', SUPABASE_KEY: ''})).toThrow(/config\.local\.ts/);
  });

  test('원격 URL 이면 즉시 실패', () => {
    expect(() =>
      assertLocalTarget({SUPABASE_URL: 'https://eigocuecmaapxnmhttwj.supabase.co', SUPABASE_KEY: 'k'}),
    ).toThrow(/로컬 Supabase/);
  });

  test('service role 키가 원격 URL 과 같이 있으면 실패(원격 데이터 삭제 방지)', () => {
    expect(() =>
      assertLocalTarget({SUPABASE_URL: 'https://eigocuecmaapxnmhttwj.supabase.co', SUPABASE_KEY: 'k'}, 'service-key'),
    ).toThrow(/service role/);
  });

  test('로컬이면 값을 그대로 돌려준다', () => {
    expect(assertLocalTarget({SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_KEY: 'k'}, 'service-key')).toEqual({
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_KEY: 'k',
    });
  });
});

test('통합 테스트는 loadLocalConfig 만 쓴다(loadConfig·getAppEnv 금지)', () => {
  const fs: {readdirSync(d: string): string[]; readFileSync(f: string, e: 'utf8'): string} = require('fs');
  const dir = `${__dirname}/../__integration__`;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.ts'))) {
    const src = fs.readFileSync(`${dir}/${f}`, 'utf8');
    expect(src).not.toMatch(/\bloadConfig\b|getAppEnv/);
    expect(src).toContain('loadLocalConfig(');
  }
});

// @types/node 가 없어 필요한 부분만 선언한다(jest 는 node 에서 돈다)
declare const __dirname: string;
