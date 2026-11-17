import {createContext, useContext} from 'react';
import type {Api, StepName, TodayContent} from '../features/types';
import type {Message} from '../copy/copy';

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
  applyStep: (step: StepName, streak: number) => void; // 서버가 기록을 인정한 뒤 화면 상태에 반영
  setConsented: (v: boolean) => void; // 서버가 동의/철회를 인정한 뒤 반영(철회면 오늘 고른 답도 비움)
  clear: () => void; // 삭제 후 화면 상태를 비운다
  resetRole: () => void; // 첫 화면(역할 선택)으로 돌아간다
};
export const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext 없음');
  return s;
}
