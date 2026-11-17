import {useEffect} from 'react';
import {useSession} from '../../app/session';

// CourseHome 이 처음 열릴 때 서버 기준으로 불러온다(날짜가 바뀌면 새 콘텐츠). 실패는 세션의 syncError 로만 알린다.
export function useLoadTodayContent() {
  const {startToday} = useSession();
  useEffect(() => {
    startToday(); // start_today(0024): 코스 홈 진입 = 오늘 코스를 연 때
  }, [startToday]);
}
