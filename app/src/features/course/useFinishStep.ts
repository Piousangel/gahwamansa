import {useRef, useState} from 'react';
import {useSession} from '../../app/session';
import {copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline, StepName} from '../types';
import {track} from './track';
import {localStamps} from '../../lib/localStamps';

export const errorMessage = (e: unknown): Message => (isOffline(e) ? offlineMessage : copy.errors.server);

// 단계 완료: 서버가 기록을 인정해야 완료 표시한다. 실패하면 false 와 오류 문구를 돌려주고 진행하지 않는다.
// 소요 시간은 화면에 들어온 시각부터 잰 초(0~7200).
export function useFinishStep() {
  const {api, applyStep, content, done} = useSession();
  const startedAt = useRef(Date.now());
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  // attemptNo: P6 '다 썼어요'를 누른 수(이벤트 attempt_no). 다른 단계는 주지 않는다.
  const finish = async (step: StepName, attemptNo?: number): Promise<boolean> => {
    if (busy) {
      return false;
    }
    if (content && !content.linked) {
      // 미연결 열람: 서버에 기록하지 않고 화면에서만 다음 단계로. 오늘 코스를 다 마치면 도장은 기기에 찍는다
      // (리드 결정: 날짜만 기기 로컬, 연결 뒤에는 서버 값만). 기다린 뒤 진행해야 P7·코스 홈이 오늘 도장을 읽는다
      if (new Set([...done, step]).size === 3) {
        await localStamps().addToday();
      }
      applyStep(step, 0);
      return true;
    }
    setBusy(true);
    setError(null);
    try {
      const sec = Math.min(7200, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
      const r = await api.recordSessionStep(step, sec);
      applyStep(step, r.streak);
      // 계측(0022): 서버가 기록을 인정한 뒤에만. 미연결 열람은 기록하지 않으므로 보내지 않는다
      track(api, 'course_step_completed', {step, duration_sec: sec, ...(attemptNo !== undefined ? {attempt_no: attemptNo} : {})});
      if (r.completed) {
        track(api, 'course_completed', content ? {day_index: content.day_index} : {});
      }
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {finish, error, setError, busy};
}
