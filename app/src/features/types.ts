import type {FailReason} from '../copy/copy';

// 서버 RPC 형태와 맞춤 (리드 확인: 2026-11-17)
export type CreateFamilyResult = {family_id: string; profile_id: string};
export type RedeemResult =
  | {ok: true; family_id: string; profile_id: string}
  | {ok: false; reason: FailReason; retry_after_sec?: number};
export type StepName = 'photo' | 'question' | 'hangul'; // 서버 허용 step 값은 미확인(가정)
export type RecordStepResult = {completed: boolean; streak: number};

// 서버 get_today_content 형태 (null 이면 콘텐츠 없음)
export type TodayContent = {
  day_index: number;
  photo: {caption: string; image_url: string; keyword: string; recall_questions: string[]};
  question: {id: string; option_a: string; option_b: string; prompt: string | null};
  answered_choice: 'A' | 'B' | null;
};

export interface Api {
  createFamily(): Promise<CreateFamilyResult>;
  issueInviteCode(targetProfileId?: string | null): Promise<string>;
  redeemInviteCode(code: string): Promise<RedeemResult>;
  giveConsent(): Promise<void>;
  getTodayContent(): Promise<TodayContent | null>;
  // save_answer RPC. 동의 후에만 호출. 같은 질문에 다시 답하면 서버가 갱신한다.
  saveAnswer(input: {questionId: string; choice: 'A' | 'B'}): Promise<void>;
  recordSessionStep(step: StepName, durationSec: number): Promise<RecordStepResult>;
  fetchChildHome(): Promise<{participatedToday: boolean; streak: number}>;
}
