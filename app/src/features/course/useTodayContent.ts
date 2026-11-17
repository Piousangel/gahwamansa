import {useEffect} from 'react';
import {useSession} from '../../app/session';

// CourseHome 이 처음 열릴 때 서버 기준으로 불러온다(날짜가 바뀌면 새 콘텐츠). 실패는 세션의 syncError 로만 알린다.
export function useLoadTodayContent() {
  const {sync} = useSession();
  useEffect(() => {
    sync();
  }, [sync]);
}
