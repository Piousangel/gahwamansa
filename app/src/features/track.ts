import {isQuietEventFailure, type EventName, type EventProps} from '../api/contract/events';
import {prefs, type DailyEvent, type OnceEvent} from '../lib/prefs';
import {kstDate} from '../lib/localStamps';
import type {Api} from './types';

// 계측(log_event, 0022)을 화면 흐름과 떼어 보낸다: 기다리지 않고, 실패해도 화면은 그대로.
// - rate_limited·no_user·네트워크 오류: 조용히 무시. (세션 전 이벤트는 realApi 가 들고 있다가 세션이 생기면 보낸다)
// - invalid_name·invalid_props: 앱이 계약을 어긴 것이라 개발 빌드에서만 경고(운영에서는 무시).
// 글자 내용(입력 낱말 등)은 props 타입에 자리가 없어 실을 수 없다.
// 기능 폴더 여럿(course·link·child·home·account)이 같이 쓰므로 features 바로 아래에 둔다(기능 간 import 금지).
export function track(api: Api, name: EventName, props?: EventProps): void {
  api
    .logEvent(name, props)
    .then(r => {
      if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
        console.warn(`[log_event] ${name}: ${r.reason}`);
      }
    })
    .catch(() => {});
}

// 한 번만 보내는 이벤트(AC-05). app_first_open 은 기기 기준(역할을 고르기 전이라 계정이 없다),
// child_first_answer_viewed 는 계정(accountTag) 기준 — 같은 기기에서 다른 자녀 계정이 들어와도 그 계정의 첫 답은 센다(PR #61 리뷰 L2).
// 계정 가명값을 모르면(로그인 전·실패) 보내지 않는다. 가명값은 기기 저장 키에만 쓰고 이벤트에는 싣지 않는다.
// 표시를 먼저 남기고 보낸다: 같은 틱 두 번 불려도, 전송이 실패해도 다시 보내지 않는다(분모가 부풀지 않게).
const PER_ACCOUNT: readonly OnceEvent[] = ['child_first_answer_viewed'];
const inflight = new Set<string>();
export async function trackOnce(api: Api, name: OnceEvent, props?: EventProps): Promise<void> {
  let scope: string | undefined;
  if (PER_ACCOUNT.includes(name)) {
    const tag = await api.accountTag().catch(() => null);
    if (!tag) {
      return;
    }
    scope = tag;
  }
  const key = `${name}:${scope ?? ''}`;
  if (inflight.has(key)) {
    return;
  }
  inflight.add(key);
  try {
    if (await prefs().eventOnceSent(name, scope)) {
      return;
    }
    await prefs().markEventOnceSent(name, scope);
    track(api, name, props);
  } finally {
    inflight.delete(key);
  }
}

// 하루 한 번(KST) 보내는 이벤트(기획 v2.1 측정, 0066): child_home_viewed. 계정(accountTag) 기준 — 같은 기기에서 다른 자녀 계정이면 따로.
// 정확한 하루 1회는 서버가 정한다(같은 계정·같은 KST 날짜 두 번째부터 저장 없이 ok). 여기서 거르는 건 요청 수를 줄이려는 것이라
// 기기 시계(KST로 바꾼 날짜)를 써도 된다 — 시계가 틀려 한 번 더 보내도 서버에서 한 행이다.
// trackOnce 와 달리 응답을 받은 뒤 표시한다: 네트워크·서버 오류(예외)면 표시하지 않아 다음 진입·복귀 때 다시 보낸다.
// 응답이 왔으면(ok·한도·지워진 계정·계약 어긋남 모두) 표시한다 — 같은 날 다시 보내도 결과가 같다.
// 가명값은 기기 저장 키에만 쓰고 이벤트에는 싣지 않는다(속성 없음).
export async function trackDaily(api: Api, name: DailyEvent, today: string = kstDate(new Date())): Promise<void> {
  const scope = await api.accountTag().catch(() => null);
  if (!scope) {
    return;
  }
  const key = `day:${name}:${scope}`;
  if (inflight.has(key)) {
    return;
  }
  inflight.add(key);
  try {
    if ((await prefs().eventDaySent(name, scope)) === today) {
      return;
    }
    const r = await api.logEvent(name, {}).catch(() => null);
    if (!r) {
      return; // 오류: 표시 없이 다음에 다시
    }
    if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
      console.warn(`[log_event] ${name}: ${r.reason}`);
    }
    await prefs().markEventDaySent(name, scope, today);
  } finally {
    inflight.delete(key);
  }
}
