import type {FailReason} from '../copy/copy';

// 서버 RPC 형태와 맞춤 (리드 확인: 2026-11-17)
export type CreateFamilyResult = {family_id: string; profile_id: string};
export type RedeemResult =
  | {ok: true; family_id: string; profile_id: string}
  | {ok: false; reason: FailReason; retry_after_sec?: number};
export type ChildSummary = {
  parentTitle: string;
  shared: boolean; // 어르신이 답을 나누는 중인가
  latest: {prompt: string | null; choiceLabel: string; answeredDate: string} | null; // YYYY-MM-DD(KST)
};
export const PARENT_TITLES = ['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'] as const;
// 자녀 앱의 현재 단계(로그인 뒤). 번호 1개만 다룬다(빌드 1).
export type ChildState =
  | {kind: 'no_family'}
  | {
      kind: 'family';
      parentTitle: string;
      linked: boolean;
      code: {code: string; expiresAt: string} | null; // 살아 있는 가입 번호(가족당 1개, 0018)
      hadExpired: boolean; // 살아 있는 번호가 없고, 쓰지 않은 지난 번호가 있다(만료·무효화) → "새 번호 받기"
    };
export type WeekStamps = {weekStart: string; doneDates: string[]}; // YYYY-MM-DD(KST)
export type DeleteScope = 'parent' | 'child' | 'family';
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
  // false = 미연결 열람(preview_content). 답·기록을 저장하지 않는다.
  linked: boolean;
};

// 인터넷 문제(연결 실패·시간 초과)를 다른 서버 오류와 구분하기 위한 오류
export class OfflineError extends Error {}
export const isOffline = (e: unknown): boolean => e instanceof OfflineError;

// 서버가 응답한 오류. code 는 Postgres 오류 코드(예: P0001 = raise exception, 42501 = 권한 없음),
// reason 은 서버가 raise 한 예외 이름(예: 'consent_required'). 판별은 부분 문자열이 아니라 이 둘로 한다.
export class ServerError extends Error {
  constructor(what: string, public reason: string, public code?: string) {
    super(`${what}: ${reason}`);
  }
}
export const isServerError = (e: unknown, reason: string): boolean =>
  e instanceof ServerError && e.code === 'P0001' && e.reason === reason;
// 앱이 직접 분류해 붙인 이유(인증 오류 등, DB 예외가 아님)
export const hasReason = (e: unknown, reason: string): boolean => e instanceof ServerError && e.reason === reason;

export interface Api {
  createFamily(): Promise<CreateFamilyResult>;
  issueInviteCode(targetProfileId?: string | null): Promise<string>;
  redeemInviteCode(code: string): Promise<RedeemResult>;
  giveConsent(version: string): Promise<void>; // 동의한 문구 버전(CONSENT_VERSION)
  // 앱 데이터 삭제(delete_my_account) 후 로그아웃까지. scope 는 서버가 알려 준다.
  // 삭제 전 범위 조회(delete_scope_preview). 삭제는 하지 않는다.
  deleteScopePreview(): Promise<{scope: DeleteScope}>;
  deleteMyAccount(): Promise<{scope: DeleteScope}>;
  // 자녀 로그인: 메일 인증번호(Supabase OTP 6자리)
  // 자녀 소셜 로그인(네이티브 SDK ID 토큰 → Supabase signInWithIdToken). 사용자가 닫으면 'cancelled'(조용히)
  signInWithSocial(provider: 'kakao' | 'google'): Promise<'ok' | 'cancelled'>;
  sendEmailCode(email: string): Promise<void>; // 실패: ServerError reason 'rate_limited' | 'invalid_email' | 기타
  verifyEmailCode(email: string, code: string): Promise<void>; // 실패: reason 'otp_expired'(틀림·만료)
  getChildState(): Promise<ChildState>;
  // 이 기기가 누구로 열려 있는지(시작 화면 결정): 연결된 어르신 / 로그인한 자녀 / 없음(역할 선택)
  whoAmI(): Promise<'parent' | 'child' | 'none'>;
  // 이번 주(KST 월요일 시작) 코스를 마친 날짜. 어르신만(자녀는 parent_required). 미연결 열람에서는 부르지 않는다
  getWeekStamps(): Promise<WeekStamps>;
  getTodayContent(): Promise<TodayContent | null>;
  // save_answer RPC. 동의 후에만 호출. 같은 질문에 다시 답하면 서버가 갱신한다.
  saveAnswer(input: {questionId: string; choice: 'A' | 'B'}): Promise<void>;
  recordSessionStep(step: StepName, durationSec: number): Promise<RecordStepResult>;
  // 자녀 홈: 서버 child_summary(). 단계·연속일·참여 여부는 자녀에게 주지 않는다.
  fetchChildSummary(): Promise<ChildSummary>;
  setParentTitle(title: string): Promise<{ok: true} | {ok: false; reason: 'invalid_title'}>;
  withdrawConsent(): Promise<void>; // 어르신. 저장된 답이 지워진다
}
