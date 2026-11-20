import type {FailReason} from '../copy/copy';
import type {CheerKey, MarkCheersReadResult, MyCheers} from '../api/contract/cheers';
import type {ParentHistoryResult} from '../api/contract/history';
import type {EventName, EventProps, LogEventResult} from '../api/contract/events';
import type {MyPushSettings, RegisterPushTokenResult, SetPushEnabledResult} from '../api/contract/push';
import type {MyTermsStatus, RecordTermsResult} from '../api/contract/terms';
import type {DeleteScope} from '../api/contract/deleteScope';
export type {DeleteScope};

// 서버 RPC 형태와 맞춤 (리드 확인: 2026-11-17)
export type CreateFamilyResult = {family_id: string; profile_id: string};
export type RedeemResult =
  | {ok: true; family_id: string; profile_id: string}
  | {ok: false; reason: FailReason; retry_after_sec?: number};
export type LatestAnswer = {prompt: string | null; choiceLabel: string; answeredDate: string}; // YYYY-MM-DD(KST)
// 가족의 어르신 한 명(서버 계약 dev-server-notes.md §1 child_summary, 0019·0021)
export type ChildParent = {
  parentId: string;
  title: string; // 이 어르신의 호칭(닫힌 목록)
  shared: boolean; // 답을 나누는 중인가
  connected: boolean; // false = 연결이 풀림(어르신 폰 교체·삭제 등). 응원을 보낼 수 없다
  latest: LatestAnswer | null;
  // 고른 답에 맞춘 첫마디 한 문장(기능 회의 B3, 서버 0027 child_summary parents[].latest.starter). 없으면 null → 줄 숨김
  starter: string | null;
  // 이 어르신이 가족에 연결된 날(KST). 서버 0041 child_summary parents[].connected_date(처음 연결된 날, 재연결해도 그대로) — 없으면 null(C4 이름 고르기 시트 날짜 줄 생략)
  connectedDate?: string | null;
};
export type ChildSummary = {
  parentTitle: string; // 가족 기본 호칭(어르신이 아직 없을 때·한 명일 때 화면 제목)
  shared: boolean; // 첫 어르신(옛 계약 호환)
  latest: LatestAnswer | null; // 첫 어르신(옛 계약 호환)
  parents: ChildParent[]; // 연결된 적 있는 어르신 전부(만든 순서). 연결 전이면 빈 배열
};
// 지난 답(C5, child_answer_history 0021): 어르신별 최근 30일(session_date), 최신순, 어르신당 최대 30개
// answeredDate = session_date, promptShort = 서버 prompt_short("봄과 가을 중")
export type HistoryItem = {answeredDate: string; promptShort: string; choiceLabel: string};
export type ParentHistory = {parentId: string; title: string; shared: boolean; items: HistoryItem[]};
// 응원 키(send_cheer 0020): 계약 한 곳(api/contract/cheers.ts)의 상수를 그대로 쓴다. CHILD_CHEER_KEYS 는 자녀 화면 호환 이름.
export {CHEER_KEYS as CHILD_CHEER_KEYS} from '../api/contract/cheers';
export type {CheerKey};
export const CHEER_FAIL_REASONS = ['invalid_key', 'invalid_target', 'disconnected', 'daily_limit'] as const;
export type SendCheerResult =
  | {ok: true; cheerId: string}
  | {ok: false; reason: (typeof CHEER_FAIL_REASONS)[number]};
export type LoginMethod = 'kakao' | 'google' | 'email';
export {PARENT_TITLES} from '../api/contract/invite';
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
/** 시간 제한에 걸려 끊은 요청(#208). 끊김(OfflineError)이지만 서버에서는 끝났을 수 있어 화면이 '알 수 없어요'로 구분한다 */
export class TimeoutError extends OfflineError {}
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

export type {PeekResult} from '../api/contract/invite';
import type {ParentFamily} from '../api/contract/family';
import type {PeekResult} from '../api/contract/invite';

export interface Api {
  createFamily(): Promise<CreateFamilyResult>;
  issueInviteCode(targetProfileId?: string | null): Promise<string>;
  redeemInviteCode(code: string): Promise<RedeemResult>;
  peekInviteCode(code: string): Promise<PeekResult>; // 어르신 기기. 연결하지 않는다
  // P16 연결된 가족(parent_family_list 0030): 어르신 본인만. 자녀 이름 없이 순번·연결 날짜만
  parentFamilyList(): Promise<ParentFamily>;
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
  // start_today(0024): 코스 홈 진입 때. KST 날짜가 바뀐 첫 호출에만 콘텐츠 커서를 1칸 전진하고 get_today_content 와 같은 객체를 준다.
  // 미연결 기기는 getTodayContent 와 같게 미리 보기로 떨어진다.
  startToday(): Promise<TodayContent | null>;
  // log_event(0022): 계측. 실패도 값으로 돌려준다(예외는 네트워크 등). 화면을 막지 않게 호출부는 결과를 기다리지 않는다.
  logEvent(name: EventName, props?: EventProps): Promise<LogEventResult>;
  // save_answer RPC. 동의 후에만 호출. 같은 질문에 다시 답하면 서버가 갱신한다.
  saveAnswer(input: {questionId: string; choice: 'A' | 'B'}): Promise<void>;
  recordSessionStep(step: StepName, durationSec: number): Promise<RecordStepResult>;
  // 자녀 홈: 서버 child_summary(). 단계·연속일·참여 여부는 자녀에게 주지 않는다.
  fetchChildSummary(): Promise<ChildSummary>;
  // 가족 기본 호칭(연결 전, 어르신이 아직 없어 set_parent_title_for 를 쓸 수 없을 때만). 0035부터 겹치면 duplicate_title.
  // set_parent_title 은 폐기 예정 — 어르신이 있으면 setParentTitleFor 를 쓴다
  setParentTitle(title: string): Promise<{ok: true} | {ok: false; reason: 'invalid_title' | 'duplicate_title'}>;
  // 어르신 한 분의 호칭: set_parent_title_for(p_parent, p_title)(0019)
  // duplicate_title(0028): 같은 가족 다른 어르신이 이미 그 호칭으로 보임
  setParentTitleFor(parentId: string, title: string): Promise<{ok: true} | {ok: false; reason: 'invalid_title' | 'invalid_target' | 'duplicate_title'}>;
  // C5 지난 답: child_answer_history()(0021)
  fetchAnswerHistory(): Promise<ParentHistory[]>;
  // 어르신 P13 '가족에게 이렇게 보여요'(0050 parent_preview_child_view): 자녀 C4·C5 와 같은 모양, 본인 항목 1개(어르신만)
  parentPreviewChildView(): Promise<{summary: ChildSummary; history: ParentHistory[]}>;
  // 응원 보내기: send_cheer(p_parent, p_key)(0020). 어르신 한 분에게
  sendCheer(parentId: string, key: CheerKey): Promise<SendCheerResult>;
  // 자녀 설정: 이 기기 로그인 수단(세션의 provider). 모르면 null
  getLoginMethod(): Promise<LoginMethod | null>;
  // 기기 기억값을 계정별로 나누는 가명값(auth user id 의 sha256 앞 16자, 리뷰 M4). 로그인 전이면 null
  // 주의(재검토 R3): 솔트 없는 해시라 user id 로 되짚을 수 있다 → 기기 안 저장 키에만 쓴다. 서버·이벤트·로그로 보내지 않는다
  // (accountTagGuard 테스트가 쓰는 파일을 고정한다)
  accountTag(): Promise<string | null>;
  // 로그아웃: 소셜 SDK 세션과 이 기기 세션을 지운다(서버 데이터는 그대로)
  signOut(): Promise<void>;
  withdrawConsent(): Promise<void>; // 어르신. 저장된 답이 지워진다
  // 응원(P8): get_my_cheers / mark_cheers_read(0020, 계약은 api/contract/cheers.ts). 어르신만, 미연결 열람에서는 부르지 않는다
  getMyCheers(): Promise<MyCheers>;
  // 어르신 지난 날(P15, 0028 parent_history, 계약 api/contract/history.ts). 미연결 기기는 부르지 않는다
  parentHistory(days?: number): Promise<ParentHistoryResult>;
  markCheersRead(ids: string[] | null): Promise<MarkCheersReadResult>;
  // 푸시(0032·0036·0037, 계약 api/contract/push.ts). 연결 전 기기는 no_profile(연결 뒤 다시 등록)
  registerPushToken(token: string): Promise<RegisterPushTokenResult>;
  // N1 '알려 주세요'·자녀 권한 허용 때만 true(서버가 받기 시각을 남김, 0037부터 처음 시각 유지). false 면 시각이 지워진다
  setPushEnabled(enabled: boolean): Promise<SetPushEnabledResult>;
  myPushSettings(): Promise<MyPushSettings>;
  // 약관·방침 동의 기록(0046·0048, 계약 api/contract/terms.ts). 어르신은 연결 화면 약관 줄 동의 때(연결 전 익명 기기여도 됨)
  recordTermsAgreement(termsVersion: string, privacyVersion: string): Promise<RecordTermsResult>;
  // needs_reagree 만 쓴다(다시 동의 화면을 띄울지는 법률·리드 결정)
  myTermsStatus(): Promise<MyTermsStatus>;
}
