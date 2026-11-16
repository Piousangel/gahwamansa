import type {FailReason} from '../copy/copy';

// 서버 RPC 형태와 맞춤 (리드 확인: 2026-11-17)
export type CreateFamilyResult = {family_id: string; profile_id: string};
export type RedeemResult =
  | {ok: true; family_id: string; profile_id: string}
  | {ok: false; reason: FailReason; retry_after_sec?: number};
export type StepName = 'photo' | 'question' | 'hangul'; // 서버 허용 step 값은 미확인(가정)
export type RecordStepResult = {completed: boolean; streak: number; steps?: StepName[]};

// 서버 get_today_content 형태 (null 이면 콘텐츠 없음)
export type TodayContent = {
  day_index: number;
  // 콘텐츠 번호에 구멍이 있으면 null 일 수 있다
  photo: {caption: string; image_url: string; keyword: string; recall_questions: string[]} | null;
  question: {id: string; option_a: string; option_b: string; prompt: string | null} | null;
  answered_choice: 'A' | 'B' | null; // 오늘(KST) 답한 것만
  consented: boolean;
  completed_steps: StepName[];
  streak: number;
};

// 인터넷 문제(연결 실패·시간 초과)를 다른 서버 오류와 구분하기 위한 오류
export class OfflineError extends Error {}
export const isOffline = (e: unknown): boolean => e instanceof OfflineError;

export interface Api {
  createFamily(): Promise<CreateFamilyResult>;
  issueInviteCode(targetProfileId?: string | null): Promise<string>;
  redeemInviteCode(code: string): Promise<RedeemResult>;
  giveConsent(): Promise<void>;
  // 시작 시 복원: 이 기기가 이미 어르신으로 연결돼 있는지
  restoreSession(): Promise<'linked' | 'unlinked'>;
  getTodayContent(): Promise<TodayContent | null>;
  // save_answer RPC. 동의 후에만 호출. 같은 질문에 다시 답하면 서버가 갱신한다.
  saveAnswer(input: {questionId: string; choice: 'A' | 'B'}): Promise<void>;
  recordSessionStep(step: StepName, durationSec: number): Promise<RecordStepResult>;
  fetchChildHome(): Promise<{participatedToday: boolean; streak: number}>;
}
