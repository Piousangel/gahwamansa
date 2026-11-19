import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {nativeSocialAuth, SocialAuth} from '../src/features/socialAuth';
import {sha256Hex} from '../src/lib/sha256';
import {OfflineError} from '../src/features/types';
import {press} from '../testUtils/flow';

declare const __dirname: string;
const KakaoUser = require('@react-native-kakao/user');
const Google = require('@react-native-google-signin/google-signin');

async function openChildLogin(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByRole('button', {name: '카카오 로그인'}));
}

test('자녀 로그인 첫 화면: 카카오(공식 가이드) → 구글(공식 가이드) → 이메일로 받기(보조 링크)', async () => {
  await openChildLogin(createFakeApi());
  const kakao = screen.getByRole('button', {name: '카카오 로그인'});
  const ks = StyleSheet.flatten(kakao.props.style);
  expect(ks.backgroundColor).toBe('#FEE500');
  expect(ks.borderRadius).toBe(12);
  expect(ks.minHeight).toBeGreaterThanOrEqual(56);
  expect(within(kakao).getByTestId('kakao-symbol', {includeHiddenElements: true})).toBeTruthy();
  const kl = StyleSheet.flatten(within(kakao).getByText('카카오 로그인').props.style);
  expect(kl.color).toBe('rgba(0,0,0,0.85)');
  expect(kl.fontSize * 1).toBeLessThanOrEqual(ks.minHeight / 3); // 레이블 높이 <= 컨테이너 1/3
  const google = screen.getByRole('button', {name: 'Google로 계속하기'});
  const gs = StyleSheet.flatten(google.props.style);
  expect(gs.backgroundColor).toBe('#FFFFFF');
  expect(gs.borderColor).toBe('#747775');
  expect(gs.borderWidth).toBe(1);
  expect(gs.paddingHorizontal).toBe(12);
  expect(gs.minHeight).toBeGreaterThanOrEqual(56);
  expect(within(google).getByTestId('google-g', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByRole('button', {name: '이메일로 시작하기'})).toBeTruthy();
});

test('카카오 로그인 성공 → 가족 만들기(호칭) 화면', async () => {
  const api = createFakeApi();
  const social = jest.spyOn(api, 'signInWithSocial');
  await openChildLogin(api);
  await press('카카오 로그인');
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  expect(social).toHaveBeenCalledWith('kakao');
});

test('구글 로그인 성공 → 가족 만들기', async () => {
  const api = createFakeApi();
  await openChildLogin(api);
  await press('Google로 계속하기');
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
});

test('사용자가 닫으면(취소) 조용히 그대로', async () => {
  await openChildLogin(createFakeApi({socialResult: 'cancelled'}));
  await press('카카오 로그인');
  expect(screen.getByRole('button', {name: '카카오 로그인'})).toBeTruthy();
  expect(screen.queryByText('로그인이 안 됐어요')).toBeNull();
  expect(screen.queryByText('인터넷이 잠깐 끊겼어요')).toBeNull();
});

test('네트워크 오류는 인터넷 문구, 그 밖은 로그인 실패 문구', async () => {
  await openChildLogin(createFakeApi({socialResult: 'offline'}));
  await press('Google로 계속하기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
});

test('그 밖의 실패는 "로그인이 안 됐어요"', async () => {
  await openChildLogin(createFakeApi({socialResult: 'fail'}));
  await press('카카오 로그인');
  await waitFor(() => screen.getByText('로그인이 안 됐어요'));
});

test('이메일로 받기 → 이메일 화면(C0-b), BackLink \'로그인으로\'는 로그인 고르기 화면', async () => {
  await openChildLogin(createFakeApi());
  await press('이메일로 시작하기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  await act(async () => fireEvent.press(screen.getByRole('link', {name: '로그인으로'})));
  await waitFor(() => screen.getByRole('button', {name: '카카오 로그인'}));
});

test('어르신 폰에서는 소셜 로그인 화면에 들어가지 않는다', async () => {
  const api = createFakeApi({linked: true});
  const social = jest.spyOn(api, 'signInWithSocial');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
  expect(screen.queryByRole('button', {name: '카카오 로그인'})).toBeNull();
  expect(social).not.toHaveBeenCalled();
});

// ---- realApi + 네이티브 래퍼
const fakeSb = () => {
  const signInWithIdToken = jest.fn().mockResolvedValue({data: {}, error: null});
  const getSession = async () => ({data: {session: null}, error: null}); // 이 기기에 세션 없음
  return {sb: {auth: {signInWithIdToken, getSession}} as never, signInWithIdToken};
};
const social = (over: Partial<SocialAuth>): SocialAuth => ({
  init: async () => {},
  kakao: async () => ({idToken: 'k'}),
  google: async () => ({idToken: 'g'}),
  signOut: async () => {},
  unlinkKakao: async () => {},
  ...over,
});

test('카카오: SDK 에는 nonce 해시, Supabase 에는 원문 nonce', async () => {
  const {sb, signInWithIdToken} = fakeSb();
  let hashed = '';
  const api = createRealApi(
    sb,
    social({
      kakao: async h => {
        hashed = h;
        return {idToken: 'kakao-token'};
      },
    }),
  );
  expect(await api.signInWithSocial('kakao')).toBe('ok');
  const arg = signInWithIdToken.mock.calls[0][0];
  expect(arg).toMatchObject({provider: 'kakao', token: 'kakao-token'});
  expect(sha256Hex(arg.nonce)).toBe(hashed);
});

test('구글: nonce 없이 ID 토큰 교환', async () => {
  const {sb, signInWithIdToken} = fakeSb();
  const api = createRealApi(sb, social({}));
  await api.signInWithSocial('google');
  expect(signInWithIdToken).toHaveBeenCalledWith({provider: 'google', token: 'g'});
});

test('취소면 Supabase 를 부르지 않고 cancelled', async () => {
  const {sb, signInWithIdToken} = fakeSb();
  const api = createRealApi(sb, social({kakao: async () => 'cancelled'}));
  expect(await api.signInWithSocial('kakao')).toBe('cancelled');
  expect(signInWithIdToken).not.toHaveBeenCalled();
});

test('네이티브 래퍼: 카카오 Cancelled·AccessDenied 는 취소, 네트워크는 OfflineError, ID 토큰 없음은 오류', async () => {
  KakaoUser.login.mockRejectedValueOnce({code: 'Cancelled'});
  expect(await nativeSocialAuth.kakao('h')).toBe('cancelled');
  KakaoUser.login.mockRejectedValueOnce({code: 'AccessDenied'});
  expect(await nativeSocialAuth.kakao('h')).toBe('cancelled');
  KakaoUser.login.mockRejectedValueOnce({code: 'Unknown', message: 'java.net.UnknownHostException'});
  await expect(nativeSocialAuth.kakao('h')).rejects.toBeInstanceOf(OfflineError);
  KakaoUser.login.mockResolvedValueOnce({accessToken: 'a'});
  await expect(nativeSocialAuth.kakao('h')).rejects.toMatchObject({reason: 'no_id_token'});
  expect(KakaoUser.login).toHaveBeenLastCalledWith({nonce: 'h'});
});

test('네이티브 래퍼: 구글 취소 응답·취소 코드는 cancelled, 성공은 ID 토큰', async () => {
  Google.GoogleSignin.signIn.mockResolvedValueOnce({type: 'cancelled', data: null});
  expect(await nativeSocialAuth.google()).toBe('cancelled');
  Google.GoogleSignin.signIn.mockRejectedValueOnce({code: 'SIGN_IN_CANCELLED'});
  expect(await nativeSocialAuth.google()).toBe('cancelled');
  expect(await nativeSocialAuth.google()).toEqual({idToken: 'google-id-token'});
  expect(Google.GoogleSignin.configure).toHaveBeenCalledWith({webClientId: expect.stringContaining('.apps.googleusercontent.com')});
});

test('계정 지우기: 카카오 자녀면 카카오 연결 끊기 + SDK 로그아웃 + Supabase 로그아웃', async () => {
  const calls: string[] = [];
  const sb = {
    rpc: jest.fn().mockResolvedValue({data: {scope: 'child'}, error: null}),
    auth: {
      getSession: async () => ({data: {session: {user: {app_metadata: {provider: 'kakao'}}}}}),
      signOut: jest.fn(async () => calls.push('supabase')),
    },
  };
  const api = createRealApi(
    sb as never,
    social({
      unlinkKakao: async () => {
        calls.push('unlink');
      },
      signOut: async p => {
        calls.push(`sdk:${p}`);
      },
    }),
  );
  await api.deleteMyAccount();
  expect(calls).toEqual(['unlink', 'sdk:kakao', 'supabase']);
});

test('카카오 키는 환경 파일(app/env/<flavor>.env) 한 곳: 안드로이드 scheme 은 빌드가 그 값으로 만든다(strings.xml·TS 에 키 없음)', () => {
  const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
  const xml = fs.readFileSync(`${__dirname}/../android/app/src/main/res/values/strings.xml`, 'utf8');
  expect(xml).not.toMatch(/kakao[0-9a-f]{32}/);
  expect(fs.readFileSync(`${__dirname}/../src/lib/socialConfig.ts`, 'utf8')).not.toMatch(/[0-9a-f]{32}/);
  expect(fs.readFileSync(`${__dirname}/../env/staging.env`, 'utf8')).toMatch(/^KAKAO_NATIVE_APP_KEY=[0-9a-f]{32}$/m);
  const gradle = fs.readFileSync(`${__dirname}/../android/app/build.gradle`, 'utf8');
  expect(fs.readFileSync(`${__dirname}/../scripts/appEnv.js`, 'utf8')).toContain("path.join(APP, 'env')"); // env 파일 원본(공통 스크립트가 읽음)
  expect(gradle).toContain('resValue "string", "kakao_scheme", "kakao" + e.KAKAO_NATIVE_APP_KEY');
  const manifest = fs.readFileSync(`${__dirname}/../android/app/src/main/AndroidManifest.xml`, 'utf8');
  expect(manifest).toContain('android:scheme="@string/kakao_scheme"');
});

test('난수가 없으면 카카오 로그인은 SDK 를 부르지 않고 실패(로그인이 안 됐어요)', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true, writable: true});
  const rnd = jest.spyOn(Math, 'random');
  const kakao = jest.fn();
  try {
    const {sb, signInWithIdToken} = fakeSb();
    const api = createRealApi(sb, social({kakao}));
    rnd.mockClear();
    const err = await api.signInWithSocial('kakao').catch(e => e);
    const calls = rnd.mock.calls.length;
    expect(err).toMatchObject({reason: 'no_secure_random'});
    expect(calls).toBe(0);
    expect(kakao).not.toHaveBeenCalled();
    expect(signInWithIdToken).not.toHaveBeenCalled();
  } finally {
    rnd.mockRestore();
    if (saved) {
      Object.defineProperty(globalThis, 'crypto', saved);
    }
  }
});

test('index.js 는 맨 처음에 난수 폴리필을 불러온다', () => {
  const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
  const src = fs.readFileSync(`${__dirname}/../index.js`, 'utf8');
  const firstImport = src.split('\n').find(l => l.startsWith('import'));
  expect(firstImport).toBe("import 'react-native-get-random-values';");
});

test('카카오·구글 버튼은 같은 높이·같은 폭(같은 줄 너비)·같은 반경', async () => {
  await openChildLogin(createFakeApi());
  const k = StyleSheet.flatten(screen.getByRole('button', {name: '카카오 로그인'}).props.style);
  const g = StyleSheet.flatten(screen.getByRole('button', {name: 'Google로 계속하기'}).props.style);
  expect(k.minHeight).toBe(g.minHeight);
  expect(k.alignSelf).toBe('stretch');
  expect(g.alignSelf).toBe('stretch');
  expect(k.borderRadius).toBe(12);
  expect(g.borderRadius).toBe(12);
});
