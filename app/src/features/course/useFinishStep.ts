import {useEffect, useRef, useState} from 'react';
import {useSession} from '../../app/session';
import {copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline, isServerError, StepName, type Api} from '../types';
import {track} from '../track';
import {localStamps} from '../../lib/localStamps';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {allStepsDone, isLegacyStep} from './fiveSteps';

export type HangulResult = 'finished' | 'skipped';

export const errorMessage = (e: unknown): Message => (isOffline(e) ? offlineMessage : copy.errors.server);

/**
 * 5단계 방어(리드 M1, #254 QA-2): 서버가 새 단계(recall·pass_on) 기록을 invalid_step 으로 거절하면(0061 전 서버 — 보통은
 * five_steps_supported 가 없어 3단계로 돌아 여기 오지 않는다) 화면이 멈추지 않게 이 기기 화면에서만 '했어요'로 두고 진행한다
 * (저장 없음, 콘솔 경고만). 옛 3단계 거절은 지금처럼 오류로 알린다.
 */
export function newStepNotAccepted(step: StepName, e: unknown): boolean {
  if (isLegacyStep(step) || !isServerError(e, 'invalid_step')) {
    return false;
  }
  console.warn(`[5단계] 서버가 '${step}' 기록을 받지 않아요 — 화면에서만 진행`);
  return true;
}

// 단계 시작 계측(AC-05, 0053 course_step_started{step, day_index}): 단계 화면에 들어올 때 한 번. step 값은 0061 에서 다섯 단계.
// course_step_completed 와 같은 모집단이어야 이탈(시작 − 완료)을 셀 수 있어, 완료처럼 연결된 기기의 진행 모드에서만 보낸다
// (미연결 열람·다 마친 뒤 보기 전용·이미 마친 단계는 보내지 않음).
export function useStepStarted(step: StepName, review: boolean) {
  const {api, content, done} = useSession();
  const sent = useRef(false);
  const ready = !review && !!content?.linked && !done.includes(step);
  const dayIndex = content?.day_index;
  useEffect(() => {
    if (ready && !sent.current) {
      sent.current = true;
      track(api, 'course_step_started', dayIndex !== undefined ? {step, day_index: dayIndex} : {step});
    }
  }, [ready, api, step, dayIndex]);
}

/**
 * 4단계(기획 v2.1 Q7): 화면에는 ⑤가 없지만 서버 0061 은 course_len 3|5 만 받고 5단계 세션 완료에 pass_on 기록이 필요하다.
 * 그래서 ①~④를 다 마친 순간 pass_on 을 p_skipped:true 로 한 번 기록해 도장을 찍게 한다(0061 계약 규칙 '⑤ 스위치가 꺼진 날도 넘어감으로 기록'과 같은 길).
 * 사람이 한 단계가 아니라 계측(course_step_completed)은 보내지 않는다. 서버가 course_len 4 를 받게 되면 이 함수를 지운다.
 */
export const completeServerCourse = (api: {recordSessionStep: Api['recordSessionStep']}) => api.recordSessionStep('pass_on', 0, {skipped: true});

export type FinishOptions = {
  hangul?: {attemptNo: number; result: HangulResult};
  /** 5단계 「오늘은 넘어갈게요」(p_skipped). 3단계(five 아님)에서는 서버에 보내지 않는다(realApi 가 옛 2인자로) */
  skipped?: boolean;
};

// 단계 완료: 서버가 기록을 인정해야 완료 표시한다. 실패하면 false 와 오류 문구를 돌려주고 진행하지 않는다.
// 소요 시간은 화면에 들어온 시각부터 잰 초(0~7200).
// course_completed 는 서버가 completed=true 를 돌려줄 때만(5단계: 다 마친 뒤 다시 하기는 이미 완료라 다시 보내지 않음).
export function useFinishStep() {
  const {api, applyStep, content, done, streak, five} = useSession();
  const startedAt = useRef(Date.now());
  const [error, setError] = useState<Message | null>(null);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)

  // hangul: P6 만 준다. attemptNo = '다 썼어요'를 누른 수(이벤트 attempt_no),
  // result = finished(마치기·이대로 마칠게요) | skipped(넘어갈게요) 두 값만(AC-05, 0053). 맞았는지·글자 내용은 싣지 않는다.
  const finish = async (step: StepName, opts: FinishOptions = {}): Promise<boolean> => {
    const {hangul} = opts;
    const skipped = five ? !!opts.skipped : undefined; // 3단계는 넘긴 목록을 건드리지 않는다
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
        applyStep(step, 0, skipped);
        return true;
      } finally {
        endBusy();
      }
    }
    setError(null);
    const wasAll = five && allStepsDone(done, five);
    try {
      const sec = Math.min(7200, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
      let r = five ? await api.recordSessionStep(step, sec, {skipped: !!skipped}) : await api.recordSessionStep(step, sec);
      if (five && !r.completed && allStepsDone([...done, step], five)) {
        r = await completeServerCourse(api); // 4단계를 다 마쳤는데 서버(course_len 5)는 아직 → ⑤를 넘어감으로 대신 기록
      }
      applyStep(step, r.streak, skipped);
      // 계측(0022): 서버가 기록을 인정한 뒤에만. 미연결 열람은 기록하지 않으므로 보내지 않는다
      track(api, 'course_step_completed', {step, duration_sec: sec, ...(hangul ? {attempt_no: hangul.attemptNo, result: hangul.result} : {})});
      if (r.completed && !wasAll) {
        track(api, 'course_completed', content ? {day_index: content.day_index} : {});
      }
      return true;
    } catch (e) {
      if (newStepNotAccepted(step, e)) {
        applyStep(step, streak, skipped);
        return true;
      }
      setError(errorMessage(e));
      return false;
    } finally {
      endBusy();
    }
  };
  return {finish, error, setError, busy};
}

/**
 * 5단계 '오늘은 여기까지 할게요'(R-3, DECISIONS 5단계 화면): ③을 마친 뒤 record_session_step('stop_here') 한 번 — 서버가 남은 ④·⑤(빠진 ②도)를
 * 넘어감으로 채워 완료한다(확인 대화상자 없음). 넘긴 단계는 서버 skipped_steps 에 남아 다 마친 뒤 홈에서 다시 할 수 있다.
 * 결과: 'done' = P7 로, 'reload' = 서버가 stop_before_question(③ 전, 또는 자정을 넘겨 새 날) → 오늘 콘텐츠를 다시 불러 홈에서 이어 하기(오류 아님),
 * 'error' = 끊김 등(오류 문구 + 다시 하기).
 */
export function useStopHere() {
  const {api, applyStep, content, sync} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const {busy, begin, end} = useBusyLatch();
  const stop = async (rest: readonly StepName[]): Promise<'done' | 'reload' | 'error'> => {
    if (!begin()) {
      return 'error';
    }
    setError(null);
    try {
      if (content && !content.linked) {
        await localStamps().addToday(); // 미연결 열람: 다 마친 날 도장은 기기에(finish 와 같은 규칙)
        rest.forEach(s => applyStep(s, 0, true));
        return 'done';
      }
      const r = await api.recordSessionStep('stop_here', 0);
      rest.forEach(s => applyStep(s, r.streak, true)); // 서버 skipped_steps 와 같게(넘긴 목록은 기록이 인정된 뒤에만, QA-2 L2)
      track(api, 'course_step_completed', {step: 'stop_here', duration_sec: 0});
      if (r.completed) {
        track(api, 'course_completed', content ? {day_index: content.day_index} : {});
      }
      return 'done';
    } catch (e) {
      if (isServerError(e, 'stop_before_question')) {
        await sync(); // 새 날이면 새 콘텐츠·단계로 — 화면은 막히지 않는다
        return 'reload';
      }
      setError(errorMessage(e));
      return 'error';
    } finally {
      end();
    }
  };
  return {stop, error, busy};
}
