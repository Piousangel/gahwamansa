// 자녀 약관·방침 동의 기록(서버 0046·0048 record_terms_agreement, 법률 Q2·PR1 리뷰 M1).
// 자녀는 로그인 화면(C0)의 약관 줄('로그인하면 이용약관과 개인정보 처리방침에 동의하게 돼요')을 본 채 로그인에 성공한 것이 동의다.
// 기다리지 않는다(로그인 흐름을 막지 않음). 실패하면 이 계정에 '다시 보낼 것'을 남기고 다음 앱 시작 때 한 번 다시 보낸다.
// 같은 버전 쌍은 서버가 한 번만 남기므로 다시 불러도 된다. 기록이 없으면 my_terms_status.needs_reagree 가 늘 true 가 된다.
import {PRIVACY_VERSION, TERMS_VERSION} from '../api/contract/terms';
import {accountKey, TERMS_PENDING_KEY} from '../lib/accountStore';
import {defaultStore, type KeyValueStore} from '../lib/kvStore';
import type {Api} from '../features/types';

async function send(api: Api): Promise<boolean> {
  try {
    return (await api.recordTermsAgreement(TERMS_VERSION, PRIVACY_VERSION)).ok;
  } catch {
    return false;
  }
}

/** 로그인 성공 직후(소셜·이메일). 실패하면 이 계정에 다시 보낼 것을 남긴다 */
export async function recordChildTerms(api: Api, store: KeyValueStore = defaultStore()): Promise<boolean> {
  const ok = await send(api);
  const tag = await api.accountTag().catch(() => null);
  if (tag) {
    if (ok) {
      await store.removeItem(accountKey(TERMS_PENDING_KEY, tag)).catch(() => {});
    } else {
      await store.setItem(accountKey(TERMS_PENDING_KEY, tag), '1').catch(() => {});
    }
  }
  return ok;
}

/** 앱 시작(자녀로 판정된 뒤): 남은 것이 있으면 한 번만 다시 보낸다. 또 실패하면 표시를 지운다(재시도는 한 번, 다음 로그인 때 다시 기록) */
export async function retryChildTerms(api: Api, store: KeyValueStore = defaultStore()): Promise<void> {
  const tag = await api.accountTag().catch(() => null);
  if (!tag) {
    return;
  }
  const key = accountKey(TERMS_PENDING_KEY, tag);
  if ((await store.getItem(key).catch(() => null)) !== '1') {
    return;
  }
  await store.removeItem(key).catch(() => {});
  await send(api);
}
