import {useEffect, useRef, useState} from 'react';
import {useSession} from '../../app/session';
import {copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline, StepName} from '../types';
import {track} from '../track';
import {localStamps} from '../../lib/localStamps';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {allStepsDone, isLegacyStep, useFiveSteps} from './fiveSteps';

export type HangulResult = 'finished' | 'skipped';

export const errorMessage = (e: unknown): Message => (isOffline(e) ? offlineMessage : copy.errors.server);

// 단계 시작 계측(AC-05, 0053 course_step_started{step, day_index}): 단계 화면에 들어올 때 한 번.
// course_step_completed 와 같은 모집단이어야 이탈(시작 − 완료)을 셀 수 있어, 완료처럼 연결된 기기의 진행 모드에서만 보낸다
// (미연결 열람·다 마친 뒤 보기 전용·이미 마친 단계는 보내지 않음).
export function useStepStarted(step: StepName, review: boolean) {
  const {api, content, done} = useSession();
  const sent = useRef(false);
  const ready = !review && !!content?.linked && !done.includes(step);
  const dayIndex = content?.day_index;
  useEffect(() => {
    // 5단계 새 이름(recall·pass_on)은 서버 이벤트 계약(0053 step 목록)에 아직 없다 — 서버 계약이 더하기 전까지 보내지 않는다
    if (ready && !sent.current && isLegacyStep(step)) {
      sent.current = true;
      track(api, 'course_step_started', dayIndex !== undefined ? {step, day_index: dayIndex} : {step});
    }
  }, [ready, api, step, dayIndex]);
}

// 단계 완료: 서버가 기록을 인정해야 완료 표시한다. 실패하면 false 와 오류 문구를 돌려주고 진행하지 않는다.
// 소요 시간은 화면에 들어온 시각부터 잰 초(0~7200).
export function useFinishStep() {
  const {api, applyStep, content, done} = useSession();
  const five = useFiveSteps();
  const startedAt = useRef(Date.now());
  const [error, setError] = useState<Message | null>(null);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)

  // hangul: P6 만 준다. attemptNo = '다 썼어요'를 누른 수(이벤트 attempt_no),
  // result = finished(마치기·이대로 마칠게요) | skipped(넘어갈게요) 두 값만(AC-05, 0053). 맞았는지·글자 내용은 싣지 않는다.
  const finish = async (step: StepName, hangul?: {attemptNo: number; result: HangulResult}): Promise<boolean> => {
    if (!beginBusy()) {
      return false; // 같은 틱 두 번 누름(AP-14)
    }
    if (content && !content.linked) {
      // 미연결 열람: 서버에 기록하지 않고 화면에서만 다음 단계로. 오늘 코스를 다 마치면 도장은 기기에 찍는다
      // (리드 결정: 날짜만 기기 로컬, 연결 뒤에는 서버 값만). 기다린 뒤 진행해야 P7·코스 홈이 오늘 도장을 읽는다
      try {
        if (allStepsDone([...done, step], five)) {
          await localStamps().addToday();
        }
        applyStep(step, 0);
        return true;
      } finally {
        endBusy();
      }
    }
    setError(null);
    try {
      const sec = Math.min(7200, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
      const r = await api.recordSessionStep(step, sec);
      applyStep(step, r.streak);
      // 계측(0022): 서버가 기록을 인정한 뒤에만. 미연결 열람은 기록하지 않으므로 보내지 않는다
      if (isLegacyStep(step)) { // 새 단계 이름은 이벤트 계약에 아직 없다(위 useStepStarted 와 같음)
        track(api, 'course_step_completed', {step, duration_sec: sec, ...(hangul ? {attempt_no: hangul.attemptNo, result: hangul.result} : {})});
      }
      if (r.completed) {
        track(api, 'course_completed', content ? {day_index: content.day_index} : {});
      }
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      endBusy();
    }
  };
  return {finish, error, setError, busy};
}

// 5단계 '오늘은 여기까지 할게요'(R-3, DECISIONS 5단계 화면): ③을 마친 뒤 남은 단계를 넘어감으로 기록하고 끝낸다(확인 대화상자 없음).
// 넘어감도 '했어요'라 도장 기준(다 했거나 넘김)을 채운다. 남은 단계는 picks.skipped 에 남겨 홈에서 다시 할 수 있게 둔다.
// 서버가 하나라도 인정하지 않으면 false + 오류 문구(이미 인정된 단계는 그대로 '했어요').
export function useStopHere() {
  const {api, applyStep, content, done, picks, setPicks} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const {busy, begin, end} = useBusyLatch();
  const stop = async (rest: readonly StepName[]): Promise<boolean> => {
    if (!begin()) {
      return false;
    }
    setError(null);
    try {
      setPicks({skipped: [...picks.skipped.filter(s => !rest.includes(s)), ...rest]});
      if (content && !content.linked) {
        await localStamps().addToday(); // 미연결 열람: 다 마친 날 도장은 기기에(finish 와 같은 규칙)
        rest.forEach(s => applyStep(s, 0));
        return true;
      }
      for (const s of rest) {
        if (done.includes(s)) {
          continue;
        }
        const r = await api.recordSessionStep(s, 0);
        applyStep(s, r.streak);
        if (isLegacyStep(s)) {
          track(api, 'course_step_completed', {step: s, duration_sec: 0, ...(s === 'hangul' ? {attempt_no: 0, result: 'skipped' as const} : {})});
        }
        if (r.completed) {
          track(api, 'course_completed', content ? {day_index: content.day_index} : {});
        }
      }
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      end();
    }
  };
  return {stop, error, busy};
}
