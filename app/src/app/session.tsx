import {createContext, useContext} from 'react';
import type {Api, StepName, TodayContent} from '../features/types';

export type Session = {
  api: Api;
  content: TodayContent | null | undefined; // undefined = 불러오는 중
  consented: boolean; // 서버 값(content.consented)
  done: StepName[]; // 서버 값(content.completed_steps)
  streak: number; // 서버 값(content.streak)
  refresh: () => Promise<TodayContent | null>; // 서버에서 다시 불러와 상태를 갈아끼운다(실패 시 throw)
  applyStep: (step: StepName, streak: number) => void; // 서버가 기록을 인정한 뒤 화면 상태에 반영
  applyConsent: () => void;
  applyWithdraw: () => void; // 철회 후: 동의 해제 상태로 반영
  clear: () => void; // 삭제 후 화면 상태를 비운다 // 서버가 동의를 인정한 뒤 반영
};
export const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext 없음');
  return s;
}
