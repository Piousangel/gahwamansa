// iOS 준비 N3: register_push_token 의 p_platform 은 기기 OS(Platform.OS), 서버 허용값(0032: android·ios)과 같다
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; readdirSync(d: string): string[]} = require('fs');
const path: {join(...p: string[]): string} = require('path');
import {PUSH_PLATFORMS, pushPlatformOf} from '../src/api/contract/push';
import {createRealApi} from '../src/features/realApi';

const TOKEN = 'fcm_token_abcdefghijklmnopqrstuvwxyz';
function fakeSb() {
  const rpc = jest.fn(async () => ({data: {ok: true}, error: null}));
  return {sb: {rpc} as never, rpc};
}

test('Platform.OS → 서버 값: android·ios 만, 그 밖은 null', () => {
  expect(pushPlatformOf('android')).toBe('android');
  expect(pushPlatformOf('ios')).toBe('ios');
  expect(pushPlatformOf('web')).toBeNull();
});

test('서버 register_push_token 허용값과 같다(마지막 정의 기준)', () => {
  const dir = path.join(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort();
  const sql = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).filter(t => /function public\.register_push_token/.test(t)).pop()!;
  const m = /p_platform not in \(([^)]*)\)/.exec(sql)!;
  const allowed = m[1].split(',').map(x => x.trim().replace(/'/g, '')).sort();
  expect(allowed).toEqual([...PUSH_PLATFORMS].sort());
});

test('realApi 는 받은 플랫폼으로 등록하고(기본 android), 모르는 OS 면 부르지 않는다', async () => {
  const ios = fakeSb();
  await createRealApi(ios.sb, undefined, 'ios').registerPushToken(TOKEN);
  expect(ios.rpc).toHaveBeenCalledWith('register_push_token', {p_token: TOKEN, p_platform: 'ios'});

  const def = fakeSb();
  await createRealApi(def.sb).registerPushToken(TOKEN);
  expect(def.rpc).toHaveBeenCalledWith('register_push_token', {p_token: TOKEN, p_platform: 'android'});

  const web = fakeSb();
  expect(await createRealApi(web.sb, undefined, null).registerPushToken(TOKEN)).toEqual({ok: false, reason: 'invalid_platform'});
  expect(web.rpc).not.toHaveBeenCalled();
});

test('createApi(real) 는 Platform.OS 를 넘긴다', async () => {
  const {sb, rpc} = fakeSb();
  jest.resetModules();
  jest.doMock('../src/lib/supabase', () => ({getSupabase: () => sb}));
  const RN = require('react-native');
  const orig = RN.Platform.OS;
  Object.defineProperty(RN.Platform, 'OS', {value: 'ios', configurable: true, writable: true});
  try {
    const {createApi} = require('../src/features/selectApi');
    await createApi('real').registerPushToken(TOKEN);
    expect(rpc).toHaveBeenCalledWith('register_push_token', {p_token: TOKEN, p_platform: 'ios'});
  } finally {
    Object.defineProperty(RN.Platform, 'OS', {value: orig, configurable: true, writable: true});
    jest.dontMock('../src/lib/supabase');
  }
});
