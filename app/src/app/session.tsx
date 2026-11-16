import {createContext, useContext} from 'react';
import type {Api, StepName, TodayContent} from '../features/types';

export type Session = {
  api: Api;
  consented: boolean;
  setConsented: (v: boolean) => void;
  done: StepName[];
  markDone: (s: StepName) => void;
  content: TodayContent | null | undefined; // undefined = 불러오는 중
  setContent: (c: TodayContent | null) => void;
  streak: number;
  setStreak: (n: number) => void;
};
export const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext 없음');
  return s;
}
