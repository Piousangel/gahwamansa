// 네이티브 소셜 로그인(카카오·구글) 얇은 래퍼. 결과는 ID 토큰 또는 'cancelled'. 테스트에서는 이 모듈을 통째로 바꿔 끼운다.
import {initializeKakaoSDK} from '@react-native-kakao/core';
import * as KakaoUser from '@react-native-kakao/user';
import {GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes} from '@react-native-google-signin/google-signin';
import {GOOGLE_WEB_CLIENT_ID, KAKAO_NATIVE_APP_KEY} from '../lib/socialConfig';
import {OfflineError, ServerError} from './types';

export type SocialProvider = 'kakao' | 'google';
export type SocialResult = {idToken: string} | 'cancelled';

export interface SocialAuth {
  init(): Promise<void>;
  kakao(nonceHash: string): Promise<SocialResult>;
  google(): Promise<SocialResult>;
  signOut(provider: SocialProvider | null): Promise<void>; // 기기의 SDK 세션 정리(실패해도 무시)
  unlinkKakao(): Promise<void>; // 계정 지우기 때 카카오 연결 끊기(실패해도 무시)
}

const NETWORK = /network|timeout|timed out|unknownhost|connect/i;
// 카카오 SDK 거절 코드: 사용자가 닫음 = Cancelled(ClientError), 동의 거부 = AccessDenied(AuthError)
const KAKAO_CANCEL = new Set(['Cancelled', 'AccessDenied']);

function classify(what: string, e: unknown): never {
  const code = (e as {code?: string})?.code ?? '';
  const msg = (e as {message?: string})?.message ?? String(e);
  if (NETWORK.test(code) || NETWORK.test(msg)) {
    throw new OfflineError(`${what}: ${msg}`);
  }
  throw new ServerError(what, code || 'social_failed', 'SOCIAL');
}

let inited: Promise<void> | null = null;

export const nativeSocialAuth: SocialAuth = {
  init() {
    if (!inited) {
      GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID});
      inited = initializeKakaoSDK(KAKAO_NATIVE_APP_KEY).catch(() => {
        inited = null; // 다음 로그인 때 다시 시도
      });
    }
    return inited ?? Promise.resolve();
  },
  async kakao(nonceHash) {
    await this.init();
    try {
      const t = await KakaoUser.login({nonce: nonceHash});
      if (!t.idToken) {
        throw new ServerError('kakao_login', 'no_id_token', 'SOCIAL'); // 카카오 OIDC 가 꺼져 있으면 ID 토큰이 없다
      }
      return {idToken: t.idToken};
    } catch (e) {
      if (e instanceof ServerError) {
        throw e;
      }
      if (KAKAO_CANCEL.has((e as {code?: string})?.code ?? '')) {
        return 'cancelled';
      }
      return classify('kakao_login', e);
    }
  },
  async google() {
    await this.init();
    try {
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      const r = await GoogleSignin.signIn();
      if (isCancelledResponse(r)) {
        return 'cancelled';
      }
      if (!r.data.idToken) {
        throw new ServerError('google_login', 'no_id_token', 'SOCIAL');
      }
      return {idToken: r.data.idToken};
    } catch (e) {
      if (e instanceof ServerError) {
        throw e;
      }
      if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
        return 'cancelled';
      }
      return classify('google_login', e);
    }
  },
  async signOut(provider) {
    try {
      if (provider === 'kakao') {
        await KakaoUser.logout();
      } else if (provider === 'google') {
        await GoogleSignin.signOut();
      }
    } catch {
      // SDK 세션 정리 실패는 앱 로그아웃을 막지 않는다
    }
  },
  async unlinkKakao() {
    try {
      await KakaoUser.unlink();
    } catch {
      // 이미 끊겼거나 토큰이 없으면 무시
    }
  },
};
