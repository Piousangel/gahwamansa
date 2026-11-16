import {useEffect, useState} from 'react';
import {useSession} from '../../app/session';

// CourseHome 에서 서버 기준으로 불러온다(날짜가 바뀌면 새 콘텐츠). 단계 화면은 세션에 담긴 값을 쓴다.
export function useLoadTodayContent() {
  const {refresh} = useSession();
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    refresh().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [refresh, tick]);
  return {failed, retry: () => setTick(t => t + 1)};
}
