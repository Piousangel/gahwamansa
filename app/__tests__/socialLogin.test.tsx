import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
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
  await waitFor(() => screen.getByRole('button', {name: '카카오로 시작하기'}));
}

test('자녀 로그인 첫 화면: 카카오(주, 브랜드 노랑) → 구글 → 이메일로 받기(보조 링크)', async () => {
  await openChildLogin(createFakeApi());
  const kakao = screen.getByRole('button', {name: '카카오로 시작하기'});
  expect(StyleSheet.flatten(kakao.props.style).backgroundColor).toBe('#FEE500');
  expect(screen.getByRole('button', {name: '구글로 시작하기'})).toBeTruthy();
  expect(screen.getByRole('button', {name: '이메일로 받기'})).toBeTruthy();
});

test('카카오 로그인 성공 → 가족 만들기(호칭) 화면', async () => {
  const api = createFakeApi();
  const social = jest.spyOn(api, 'signInWithSocial');
  await openChildLogin(api);
  await press('카카오로 시작하기');
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  expect(social).toHaveBeenCalledWith('kakao');
});

test('구글 로그인 성공 → 가족 만들기', async () => {
  const api = createFakeApi();
  await openChildLogin(api);
  await press('구글로 시작하기');
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
});

test('사용자가 닫으면(취소) 조용히 그대로', async () => {
  await openChildLogin(createFakeApi({socialResult: 'cancelled'}));
  await press('카카오로 시작하기');
  expect(screen.getByRole('button', {name: '카카오로 시작하기'})).toBeTruthy();
  expect(screen.queryByText('로그인이 안 됐어요')).toBeNull();
  expect(screen.queryByText('인터넷이 잠깐 끊겼어요')).toBeNull();
});

test('네트워크 오류는 인터넷 문구, 그 밖은 로그인 실패 문구', async () => {
  await openChildLogin(createFakeApi({socialResult: 'offline'}));
  await press('구글로 시작하기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
});

test('그 밖의 실패는 "로그인이 안 됐어요"', async () => {
  await openChildLogin(createFakeApi({socialResult: 'fail'}));
  await press('카카오로 시작하기');
  await waitFor(() => screen.getByText('로그인이 안 됐어요'));
});

test('이메일로 받기 → 기존 이메일 인증번호 화면, 이전은 로그인 방법 화면', async () => {
  await openChildLogin(createFakeApi());
  await press('이메일로 받기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  await act(async () => fireEvent.press(screen.getByLabelText('이전 화면으로 가기')));
  await waitFor(() => screen.getByRole('button', {name: '카카오로 시작하기'}));
});

test('어르신 폰에서는 소셜 로그인 화면에 들어가지 않는다', async () => {
  const api = createFakeApi({linked: true});
  const social = jest.spyOn(api, 'signInWithSocial');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByText('이 폰은 부모님 휴대폰으로 쓰고 있어요'));
  expect(screen.queryByRole('button', {name: '카카오로 시작하기'})).toBeNull();
  expect(social).not.toHaveBeenCalled();
});

// ---- realApi + 네이티브 래퍼
const fakeSb = () => {
  const signInWithIdToken = jest.fn().mockResolvedValue({data: {}, error: null});
  return {sb: {auth: {signInWithIdToken}} as never, signInWithIdToken};
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

test('안드로이드 카카오 scheme 은 앱 키와 같다(kakao{네이티브 앱 키})', () => {
  const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
  const {KAKAO_NATIVE_APP_KEY} = require('../src/lib/socialConfig');
  const xml = fs.readFileSync(`${__dirname}/../android/app/src/main/res/values/strings.xml`, 'utf8');
  expect(xml).toContain(`>kakao${KAKAO_NATIVE_APP_KEY}<`);
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
