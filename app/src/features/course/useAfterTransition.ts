import {useCallback, useEffect, useRef} from 'react';

type Nav = {
  addListener(name: 'transitionEnd' | 'focus', cb: (e: {data?: {closing?: boolean}}) => void): () => void;
};
/** 전환 이벤트가 오지 않을 때(전환 애니메이션 없음·테스트) 포커스 뒤 기다리는 시간 */
export const AFTER_FOCUS_FALLBACK_MS = 600;

// 화면이 다시 드러나는 전환이 끝난 뒤 한 번 실행할 일을 맡긴다(리뷰 M1 후속).
// native-stack 의 transitionEnd(closing=false) = 위 화면이 닫히고 이 화면이 다 보인 순간.
// 그 이벤트가 오지 않는 경우를 위해 focus 뒤 600ms 에도 실행한다(둘 중 먼저, 한 번만).
export function useAfterTransition(navigation: Nav) {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const f = pending.current;
    pending.current = null;
    f?.();
  }, []);
  useEffect(() => {
    const offEnd = navigation.addListener('transitionEnd', e => {
      if (!e.data?.closing && pending.current) {
        run();
      }
    });
    const offFocus = navigation.addListener('focus', () => {
      if (pending.current && !timer.current) {
        timer.current = setTimeout(run, AFTER_FOCUS_FALLBACK_MS);
      }
    });
    return () => {
      offEnd();
      offFocus();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [navigation, run]);
  return useCallback((f: () => void) => {
    pending.current = f;
  }, []);
}
