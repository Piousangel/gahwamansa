import {useRef, useState} from 'react';
import {useSession} from '../../app/session';
import {copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline, StepName} from '../types';

export const errorMessage = (e: unknown): Message => (isOffline(e) ? offlineMessage : copy.errors.server);

// 단계 완료: 서버가 기록을 인정해야 완료 표시한다. 실패하면 false 와 오류 문구를 돌려주고 진행하지 않는다.
// 소요 시간은 화면에 들어온 시각부터 잰 초(0~7200).
export function useFinishStep() {
  const {api, applyStep} = useSession();
  const startedAt = useRef(Date.now());
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (step: StepName): Promise<boolean> => {
    if (busy) {
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const sec = Math.min(7200, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
      const r = await api.recordSessionStep(step, sec);
      applyStep(step, r.streak);
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
