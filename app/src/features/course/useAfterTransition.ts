import {useCallback, useEffect, useRef} from 'react';

type Nav = {
  addListener(name: 'transitionEnd' | 'focus' | 'blur', cb: (e: {data?: {closing?: boolean}}) => void): () => void;
};
/** 전환 이벤트가 오지 않을 때(전환 애니메이션 없음·테스트) 포커스 뒤 기다리는 시간 */
export const AFTER_FOCUS_FALLBACK_MS = 600;

// 화면이 '다 보이는' 때 일을 실행한다(리뷰 M1 두 번째 지적 반영).
// - 다른 화면이 위에 쌓이면(blur) '가려짐'. 위 화면이 닫히는 전환이 끝나면(transitionEnd closing=false) 다시 '보임'.
//   transitionEnd 가 오지 않는 경우를 위해 focus 뒤 600ms 에도 '보임'으로 본다(둘 중 먼저).
// - 가려져 있거나 전환 중에 맡긴 일은 '보임'이 되는 순간 맡긴 순서대로 모두 한 번씩 실행. 이미 보이면 바로 실행.
// - focus 가 지나간 뒤에 맡겨도 폴백 타이머가 이미 돌고 있어 영영 실행되지 않는 빈틈이 없다.
//   (기록 반영 → popTo 순서상 맡기는 시점이 focus 직후일 수 있다: isFocused() 로 판단하면 전환 중에 시작돼 버림)
export function useAfterTransition(navigation: Nav) {
  const covered = useRef(false);
  const pending = useRef<(() => void)[]>([]); // 대기열: 체크 모션과 포커스 복귀가 서로 덮어쓰지 않게(리뷰 l2 M1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    covered.current = false;
    const fs = pending.current;
    pending.current = [];
    fs.forEach(f => f());
  }, []);
  useEffect(() => {
    const offBlur = navigation.addListener('blur', () => {
      covered.current = true;
    });
    const offEnd = navigation.addListener('transitionEnd', e => {
      if (!e.data?.closing && covered.current) {
        reveal();
      }
    });
    const offFocus = navigation.addListener('focus', () => {
      if (covered.current && !timer.current) {
        timer.current = setTimeout(reveal, AFTER_FOCUS_FALLBACK_MS);
      }
    });
    return () => {
      offBlur();
      offEnd();
      offFocus();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [navigation, reveal]);
  return useCallback((f: () => void) => {
    if (covered.current) {
      pending.current.push(f);
    } else {
      f();
    }
  }, []);
}
