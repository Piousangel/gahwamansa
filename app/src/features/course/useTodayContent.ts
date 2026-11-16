import {useEffect, useState} from 'react';
import {useSession} from '../../app/session';

// CourseHome 에서 한 번 불러와 세션에 담고, 단계 화면은 담긴 값을 쓴다.
export function useLoadTodayContent() {
  const {api, setContent} = useSession();
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    api
      .getTodayContent()
      .then(c => alive && setContent(c))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [api, setContent, tick]);
  return {failed, retry: () => setTick(t => t + 1)};
}
