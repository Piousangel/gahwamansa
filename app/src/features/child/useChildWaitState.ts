import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {copy, Message} from '../../copy/copy';
import type {Api, ChildState} from '../types';
import {childErrorMessage} from '../../shared/childError';

export const POLL_MS = 15000;
export type Family = Extract<ChildState, {kind: 'family'}>;

// C3 연결 대기 상태: 처음·포그라운드 복귀·15초마다 확인(화면당 타이머 하나, 겹치는 요청 없음,
// 백그라운드·연결 후·언마운트 시 멈춤). check(force) 는 진행 중 확인이 있어도 새로 부른다(새 번호 직후).
export function useChildWaitState(api: Api) {
  const [state, setState] = useState<Family | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  const check = useCallback(
    async (force = false) => {
      if (inFlight.current && !force) {
        return;
      }
      inFlight.current = true;
      try {
        const s = await api.getChildState();
        if (alive.current && s.kind === 'family') {
          setState(s);
          setError(null);
        }
      } catch (e) {
        if (alive.current) {
          setError(childErrorMessage(e, copy.errors.server));
        }
      } finally {
        inFlight.current = false;
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
    check();
  }, [check]);
  useEffect(() => {
    if (linked) {
      return; // 연결되면 더 확인하지 않는다
    }
    const tick = () => check();
    let timer: ReturnType<typeof setInterval> | null = setInterval(tick, POLL_MS);
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
  }, [check, linked]);

  return {state, error, setError, check};
}
