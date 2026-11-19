// 앱 정보(AU-07, 설정 고지 행 한 목록: 법률 in-app-notices §3 순서, copy app_info.*). 값은 app/env/<flavor>.env 공개 값에서(Gradle → env.generated.ts).
// 값이 정해지지 않은(빈·형식이 틀린) 항목은 null → P13 은 행은 숨기지 않고 값 없는 행으로 둔다(개발·staging 빨간 '[설정 필요]', 디자인 판정 M8). 빠진 값은 빌드 경고 + production release 빌드 실패(G-INT).
// React 를 모른다(lib 규칙).
import {APP_INFO_KEYS, getAppEnv, type AppEnv} from './env';

// 형식 검사(Gradle 과 같은 규칙 — 빌드가 먼저 막지만 앱도 다시 본다: 잘못된 값이면 null → 값 없는 행)
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const BIZ_REG_NO = /^\d{3}-\d{2}-\d{5}$/;
const TEXT = /^[^\n"<>]{1,80}$/;

const valid: Record<(typeof APP_INFO_KEYS)[number], RegExp> = {
  TERMS_URL: HTTPS_URL,
  PRIVACY_URL: HTTPS_URL,
  CONTACT_EMAIL: EMAIL,
  BIZ_NAME: TEXT,
  BIZ_CEO: TEXT,
  BIZ_REG_NO: BIZ_REG_NO,
  BIZ_ADDRESS: TEXT,
};

const val = (env: AppEnv, k: (typeof APP_INFO_KEYS)[number]): string | null => {
  const v = (env[k] ?? '').trim();
  return v && valid[k].test(v) ? v : null;
};

export type Business = {name: string; ceo: string; regNo: string; address: string};
export type AppInfo = {
  termsUrl: string | null;
  privacyUrl: string | null;
  contactEmail: string | null;
  /** 사업자 정보는 네 값이 모두 있을 때만(한 줄이라도 비면 null → 펼침 없는 '[설정 필요]' 행) */
  business: Business | null;
  /** 버전 라벨 "1.0.0 (n)" — 네이티브 versionName·versionCode(Gradle). 개발 실행(값 없음)은 '1.0.0' */
  version: string;
};

export function versionText(env: Pick<AppEnv, 'VERSION_NAME' | 'VERSION_CODE'>): string {
  if (!env.VERSION_NAME) {
    return '1.0.0';
  }
  return env.VERSION_CODE !== null ? `${env.VERSION_NAME} (${env.VERSION_CODE})` : env.VERSION_NAME;
}

export function readAppInfo(env: AppEnv = getAppEnv()): AppInfo {
  const name = val(env, 'BIZ_NAME');
  const ceo = val(env, 'BIZ_CEO');
  const regNo = val(env, 'BIZ_REG_NO');
  const address = val(env, 'BIZ_ADDRESS');
  return {
    termsUrl: val(env, 'TERMS_URL'),
    privacyUrl: val(env, 'PRIVACY_URL'),
    contactEmail: val(env, 'CONTACT_EMAIL'),
    business: name && ceo && regNo && address ? {name, ceo, regNo, address} : null,
    version: versionText(env),
  };
}

/** 값이 없거나 형식이 틀린 키(G-INT 점검·개발 경고용) */
export function missingAppInfo(env: AppEnv = getAppEnv()): string[] {
  return APP_INFO_KEYS.filter(k => val(env, k) === null);
}

const info = readAppInfo();
// 기존 호출부 호환(P13·C7). 새 코드는 readAppInfo() 를 쓴다
export const APP_VERSION = info.version;
export const PRIVACY_URL: string | null = info.privacyUrl;
// 약관 줄 링크(LegalText, 감사 M7). 주소가 없거나 형식이 틀리면 null → 링크 모양 없이 글자로
export const TERMS_URL: string | null = info.termsUrl;
export const CONTACT_EMAIL: string | null = info.contactEmail;
// AU-06: 오픈소스 라이선스 화면(라우트 'Oss')이 있다. P13·C7 행은 이 값이 true 면 보인다
export const OSS_LICENSES_READY = true;
