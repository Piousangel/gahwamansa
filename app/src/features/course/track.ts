import {isQuietEventFailure, type EventName, type EventProps} from '../../api/contract/events';
import type {Api} from '../types';

// 계측(log_event, 0022)을 화면 흐름과 떼어 보낸다: 기다리지 않고, 실패해도 화면은 그대로.
// - rate_limited·no_user·네트워크 오류: 조용히 무시.
// - invalid_name·invalid_props: 앱이 계약을 어긴 것이라 개발 빌드에서만 경고(운영에서는 무시).
// 글자 내용(입력 낱말 등)은 props 타입에 자리가 없어 실을 수 없다.
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
