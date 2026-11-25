import {createContext, useContext} from 'react';
import type {Api, StepName, TodayContent} from '../features/types';
import type {Message} from '../copy/copy';
import type {CoursePicks} from '../features/course/fiveSteps';
import type {PassOnKey} from '../api/contract/fiveSteps';

export type Session = {
  api: Api;
  content: TodayContent | null | undefined; // undefined = 불러오는 중
  consented: boolean; // 서버 값(content.consented)
  done: StepName[]; // 서버 값(content.completed_steps). 미연결 열람이면 이 기기 화면에서만
  streak: number; // 서버 값(content.streak)
  // 서버에서 오늘 상태를 다시 불러온다. 실패는 syncError 로 알리고 undefined 를 돌려준다(throw 하지 않음).
  sync: () => Promise<TodayContent | null | undefined>;
  // 코스 홈 진입 때 한 번(start_today). 결과·실패 처리는 sync 와 같다.
  startToday: () => Promise<TodayContent | null | undefined>;
  syncError: Message | null;
  // 서버가 기록을 인정한 뒤 화면 상태에 반영. skipped 를 주면(5단계) 넘긴 단계 목록(skipped_steps)도 맞춘다
  applyStep: (step: StepName, streak: number, skipped?: boolean) => void;
  applyAnswer: (choice: 'A' | 'B') => void; // 서버가 답을 저장한 뒤 화면 상태(answered_choice)에 반영
  setConsented: (v: boolean) => void; // 서버가 동의/철회를 인정한 뒤 반영(철회면 오늘 고른 답도 비움)
  // ── 5단계: five = 스위치 켜짐 + 서버 지원(content.five_steps_supported·four_steps_supported). false 면 아래는 아무도 부르지 않는다 ──
  five: boolean;
  picks: CoursePicks; // 이 기기 화면에서 고른 값(오늘 것만, 날이 바뀌면 빈 값)
  setPicks: (patch: Partial<Omit<CoursePicks, 'day'>>) => void;
  applySaved: (patch: {picked_slot?: number | null; picked_key?: PassOnKey | null}) => void; // 서버가 ②·⑤ 저장을 인정한 뒤
  clear: () => void; // 삭제 후 화면 상태를 비운다
  resetRole: () => void; // 첫 화면(역할 선택)으로 돌아간다
};
export const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext 없음');
  return s;
}
