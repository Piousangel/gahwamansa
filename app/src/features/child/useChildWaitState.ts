import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {copy, Message} from '../../copy/copy';
import type {Api, ChildState} from '../types';
import {childErrorMessage} from '../../shared/childError';

export const POLL_MS = 15000;
export type Family = Extract<ChildState, {kind: 'family'}>;

// C3 연결 대기 상태. 확인은 처음·화면이 다시 보일 때·포그라운드 복귀·15초마다.
// 타이머는 화면이 보이고(포커스) 앱이 앞에 있을 때만 돈다(리뷰 M1: 위에 설정·번호 화면을 쌓으면 멈춤). 연결되면 멈춘다.
// 응답은 요청 순번으로 가장 최근 것만 반영한다(리뷰 M4: 새 번호 직후 먼저 떠난 확인이 늦게 와서 덮어쓰지 않게).
export function useChildWaitState(api: Api) {
  const [state, setState] = useState<Family | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const inFlight = useRef(false);
  const focused = useIsFocused();

  // force: 진행 중 확인이 있어도 새로 부른다(새 번호 직후). 늦게 온 이전 응답은 순번으로 버린다
  const check = useCallback(
    async (force = false) => {
      if (inFlight.current && !force) {
        return;
      }
      const mine = ++seq.current;
      inFlight.current = true;
      try {
        const s = await api.getChildState();
        if (alive.current && mine === seq.current && s.kind === 'family') {
          setState(s);
          setError(null);
        }
      } catch (e) {
        if (alive.current && mine === seq.current) {
          setError(childErrorMessage(e, copy.errors.server));
        }
      } finally {
        if (mine === seq.current) {
          inFlight.current = false;
        }
      }
    },
    [api],
  );

  const linked = !!state?.linked;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!focused || linked) {
      return; // 다른 화면이 위에 있거나 연결됐으면 확인하지 않는다
    }
    const tick = () => check();
    tick(); // 처음·다시 보일 때 한 번
    let timer: ReturnType<typeof setInterval> | null = AppState.currentState === 'background' ? null : setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        tick();
        if (!timer) {
          timer = setInterval(tick, POLL_MS);
        }
      } else if (timer) {
        clearInterval(timer); // 백그라운드에서는 멈춘다
        timer = null;
      }
    });
    return () => {
      if (timer) {
        clearInterval(timer);
      }
      sub.remove();
    };
  }, [check, linked, focused]);

  return {state, error, setError, check};
}
