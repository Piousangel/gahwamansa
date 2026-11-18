import {useCallback, useRef, useState} from 'react';

// 진행 중 표시 + 재진입 막기(AP-14). state 만으로 막으면 다시 그리기 전(같은 틱) 두 번 누름이 둘 다 통과한다.
// ref 가 즉시 잠그고, busy 는 화면(로딩·비활성)용이다.
export function useBusyLatch() {
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);
  /** 지금 진행 중인가(ref 기준, 같은 틱에도 정확) */
  const isBusy = useCallback(() => ref.current, []);
  /** 잠근다. 이미 잠겨 있으면 false */
  const begin = useCallback(() => {
    if (ref.current) {
      return false;
    }
    ref.current = true;
    setBusy(true);
    return true;
  }, []);
  const end = useCallback(() => {
    ref.current = false;
    setBusy(false);
  }, []);
  return {busy, isBusy, begin, end};
}
