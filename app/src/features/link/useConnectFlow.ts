import {useCallback, useEffect, useReducer, useRef} from 'react';
import {isOffline} from '../types';
import type {Api} from '../types';
import type {EventName, EventProps} from '../../api/contract/events';
import {AUTO_CHECK_MS, connectReducer, initialConnect, shouldAutoCheck} from './connectMachine';

// 번호가 밖에서 들어온 경로(ease-and-joy A②). app_link = App Links(…/c#번호), referrer = 설치 직후 Install Referrer
export type Prefill = {code: string; source: 'app_link' | 'referrer'};

// P1·P1c 흐름 훅: 6자리를 다 쓰면 300ms 뒤 peek(번호를 쓰지 않음) → 확인 화면 → [이 번호로 연결하기]에서만 redeem.
// 늦게 온 응답은 순번으로 버린다. 이벤트에 번호 값은 넣지 않는다.
// 계측은 기다리지 않고 실패도 무시한다(번호 값은 넣지 않는다)
function track(api: Api, name: EventName, props?: EventProps) {
  api.logEvent(name, props).catch(() => {});
}

// 밖에서 들어온 번호는 6자리 숫자만 받는다(리뷰 L1). 형식이 다르면 없는 것으로 본다
const validPrefill = (p?: Prefill): Prefill | undefined => (p && /^[0-9]{6}$/.test(p.code) ? p : undefined);

// TODO(App Links): 화면이 떠 있는 동안 새 링크가 열리면(params 변경) 지금은 처음 값만 쓴다
export function useConnectFlow(api: Api, rawPrefill?: Prefill) {
  const prefill = validPrefill(rawPrefill);
  const [state, dispatch] = useReducer(connectReducer, prefill?.code ?? '', initialConnect);
  const seq = useRef(0);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // 밖에서 들어온 번호: 경로 이벤트 + 채움 이벤트(한 번). 확인은 바로(손 입력이 아니므로 기다리지 않음)
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefill || prefilled.current) {
      return;
    }
    prefilled.current = true;
    const source = prefill.source;
    track(api, source === 'app_link' ? 'link_opened' : 'referrer_found', source === 'app_link' ? {source} : undefined);
    track(api, 'code_prefilled', {source});
  }, [api, prefill]);

  const peek = useCallback(
    async (code: string) => {
      const mine = ++seq.current;
      dispatch({type: 'peek'});
      try {
        const result = await api.peekInviteCode(code);
        if (alive.current && mine === seq.current) {
          dispatch({type: 'peeked', result});
          if (!result.ok) {
            track(api, 'parent_code_failed', {reason: result.reason});
          }
        }
      } catch (e) {
        if (alive.current && mine === seq.current) {
          dispatch({type: 'error', offline: isOffline(e)});
        }
      }
    },
    [api],
  );

  const prefilledChecked = useRef(false);
  const auto = shouldAutoCheck(state);
  const code = state.code;
  useEffect(() => {
    if (!auto) {
      return;
    }
    const now = !!prefill && code === prefill.code && !prefilledChecked.current;
    prefilledChecked.current = true;
    const t = setTimeout(() => peek(code), now ? 0 : AUTO_CHECK_MS);
    return () => clearTimeout(t);
  }, [auto, code, peek, prefill]);

  const redeem = useCallback(async () => {
    if (state.kind !== 'confirm' && !(state.kind === 'failed' && state.step === 'redeem')) {
      return;
    }
    const mine = ++seq.current;
    dispatch({type: 'redeem'});
    try {
      const result = await api.redeemInviteCode(state.code);
      if (alive.current && mine === seq.current) {
        dispatch({type: 'redeemed', result});
        track(api, result.ok ? 'parent_code_redeemed' : 'parent_code_failed', result.ok ? undefined : {reason: result.reason});
      }
    } catch (e) {
      if (alive.current && mine === seq.current) {
        dispatch({type: 'error', offline: isOffline(e)});
      }
    }
  }, [api, state]);

  // 같은 값(6자리 뒤 숫자 키)이면 아무것도 하지 않는다: 진행 중 확인도 살린다(리뷰 H1)
  const codeRef = useRef(state.code);
  codeRef.current = state.code;
  const edit = useCallback((next: string) => {
    if (next === codeRef.current) {
      return;
    }
    seq.current += 1; // 진행 중 확인은 버린다
    dispatch({type: 'edit', code: next});
  }, []);
  // 연결 중에는 다른 번호 쓰기·이전을 받지 않는다(응답을 버리면 서버만 연결된다, 리뷰 M1)
  const busyRef = useRef(false);
  busyRef.current = state.kind === 'redeeming';
  const other = useCallback(() => {
    if (busyRef.current) {
      return;
    }
    seq.current += 1;
    dispatch({type: 'other'});
  }, []);
  // 안내 패널 버튼: 인터넷·서버 문제면 같은 단계를 다시 부른다
  const retry = useCallback(() => {
    if (state.kind !== 'failed') {
      return;
    }
    if (state.reason === 'offline' || state.reason === 'server' || state.reason === 'busy') {
      if (state.step === 'peek') {
        peek(state.code);
      } else {
        redeem();
      }
      return;
    }
    dispatch({type: 'retry'});
  }, [peek, redeem, state]);

  return {state, edit, redeem, other, retry};
}
