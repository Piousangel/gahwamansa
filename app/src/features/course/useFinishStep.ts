import {useSession} from '../../app/session';
import type {StepName} from '../types';

// 단계 완료: 서버 기록(record_session_step) 후 로컬 완료 표시. 실패해도 화면은 이어 간다.
export function useFinishStep() {
  const {api, markDone, setStreak} = useSession();
  return async (step: StepName) => {
    try {
      const r = await api.recordSessionStep(step, 0);
      setStreak(r.streak);
    } catch {
      // 인터넷 문제여도 어르신이 막히지 않게 진행(재시도는 서버 연동 단계에서)
    }
    markDone(step);
  };
}
