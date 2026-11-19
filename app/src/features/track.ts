import {isQuietEventFailure, type EventName, type EventProps} from '../api/contract/events';
import {prefs, type OnceEvent} from '../lib/prefs';
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

// 이 기기에서 한 번만 보내는 이벤트(AC-05: app_first_open·child_first_answer_viewed).
// 표시를 먼저 남기고 보낸다: 같은 틱 두 번 불려도, 전송이 실패해도 다시 보내지 않는다(분모가 부풀지 않게).
const inflight = new Set<OnceEvent>();
export async function trackOnce(api: Api, name: OnceEvent, props?: EventProps): Promise<void> {
  if (inflight.has(name)) {
    return;
  }
  inflight.add(name);
  try {
    if (await prefs().eventOnceSent(name)) {
      return;
    }
    await prefs().markEventOnceSent(name);
    track(api, name, props);
  } finally {
    inflight.delete(name);
  }
}
