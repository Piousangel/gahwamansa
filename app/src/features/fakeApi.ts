import {OfflineError, ServerError} from './types';
import {CHILD_CHEER_KEYS, ChildSummary, PARENT_TITLES} from './types';
import type {
  PeekResult,
  Api, ChildParent, HistoryItem, LatestAnswer, LoginMethod, ParentHistory, RedeemResult, SendCheerResult, StepName, TodayContent,
} from './types';
import type {FailReason} from '../copy/copy';
import {pairShort} from '../lib/childFormat';

const FAIL_CODES: Record<string, FailReason> = {
  '000000': 'used', '111111': 'expired', '222222': 'rate_limited', '333333': 'busy',
  '444444': 'already_linked', '555555': 'not_parent_device',
};

// writer.md 1~3일차 샘플. 서버처럼 (day-1) % 개수 로 순환한다.
const FAKE_CONTENT = [
  {caption: '마을 입구 나무', keyword: '나무', a: '봄', b: '가을', prompt: '더 좋아하는 계절은요?',
    recall: ['이 나무 아래서 쉬어 본 적 있으세요?', '어떤 계절의 나무가 떠오르세요?']},
  {caption: '장날 아침', keyword: '바구니', a: '시장 구경', b: '공원 산책', prompt: '나들이를 간다면요?',
    recall: ['장에 가면 제일 먼저 어디를 보셨어요?', '장바구니에 꼭 담던 건 뭐예요?']},
  {caption: '라디오가 있던 방', keyword: '라디오', a: '라디오 듣기', b: '텔레비전 보기', prompt: '편한 쪽은요?',
    recall: ['라디오에서 나오던 소리 중 기억나는 게 있어요?', '어디서 들으셨어요?']},
];

export type FakeOptions = {
  day?: number; // 오늘이 며칠째인지(테스트에서 주입)
  empty?: boolean; // 콘텐츠 없음
  promptNull?: boolean; // 질문 문장이 없는 경우
  answeredChoice?: 'A' | 'B' | null; // 이미 고른 답
  realImage?: boolean; // 실제 사진 URL(자리표시 아님)
  questionNull?: boolean; // 번호 구멍으로 question 이 null
  consented?: boolean; // 서버에 이미 동의한 상태
  linked?: boolean; // 처음부터 연결된 기기(아니면 번호 입력 전까지 미연결 열람 모드)
  completedSteps?: StepName[]; // 오늘 이미 끝낸 단계
  streak?: number;
  failRecord?: number; // recordSessionStep 이 처음 N번 실패
  deleteScope?: 'parent' | 'child' | 'family'; // deleteMyAccount 결과(기본 parent)
  failPreview?: boolean; // deleteScopePreview 실패
  failDelete?: number; // deleteMyAccount 가 처음 N번 실패
  parentTitle?: string; // 자녀 홈 호칭(기본 부모님)
  starter?: string | null; // 기본 어르신 한 명의 첫마디 한 줄(B3)
  latest?: ChildSummary['latest']; // 자녀에게 보일 최근 답(미지정이면 저장한 답에서 만든다)
  who?: 'parent' | 'child' | 'none'; // 시작 시 이 기기의 상태(복원)
  childFamily?: boolean; // 자녀가 이미 가족을 만들었는가(번호 123456 발급된 상태)
  childCodeExpired?: boolean; // 가족은 있는데 보낸 번호가 만료됨(살아 있는 번호 없음)
  childCodeNever?: boolean; // 가족은 있는데 번호를 받은 적 없음
  childLinked?: boolean; // 어르신이 이미 연결됐는가
  weekDone?: number[]; // 이번 주(월=0) 이미 마친 요일(오늘 완료는 따로 더함)
  socialResult?: 'ok' | 'cancelled' | 'offline' | 'fail'; // signInWithSocial 결과(기본 ok)
  failChildHome?: number; // fetchChildHome 이 처음 N번 실패
  // ── 자녀 화면 v3(가정 계약) ──
  disconnected?: boolean; // 기본 어르신 한 명의 연결이 풀림
  history?: HistoryItem[]; // 기본 어르신 한 명의 지난 답(미지정이면 저장한 답에서 만든다)
  cheerDailyLimit?: number; // 같은 어르신에게 하루 보낼 수 있는 응원 수(서버 가정 2)
  parents?: FakeParent[]; // 어르신 여러 명(지정하면 위 한 명 옵션 대신 쓴다)
  failHistory?: number; // fetchAnswerHistory 가 처음 N번 실패(오프라인)
  failHistoryServer?: number; // fetchAnswerHistory 가 처음 N번 서버 오류
  failCheer?: number; // sendCheer 가 처음 N번 실패(오프라인)
  cheerResult?: SendCheerResult; // sendCheer 결과 고정
  loginMethod?: LoginMethod | null; // 기본 kakao
  failPeek?: boolean; // peekInviteCode 가 오프라인으로 실패
};
export type FakeParent = {
  parentId?: string;
  title: string;
  shared?: boolean; // 기본 true
  connected?: boolean; // 기본 true
  latest?: LatestAnswer | null;
  history?: HistoryItem[];
  starter?: string | null;
};
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// in-memory 가짜 구현. '123456' 만 성공, 위 표의 코드는 각 reason, 나머지는 invalid.
export function createFakeApi(opts: FakeOptions = {}): Api {
  let answered: 'A' | 'B' | null = opts.answeredChoice ?? null;
  const steps = new Set<StepName>(opts.completedSteps ?? []);
  let consented = opts.consented ?? false;
  let parentTitle = opts.parentTitle ?? '부모님';
  let savedLabel: string | null = null;
  let linked = opts.linked ?? false;
  let failDelete = opts.failDelete ?? 0;
  let failRecord = opts.failRecord ?? 0;
  let failChildHome = opts.failChildHome ?? 0;
  const baseStreak = opts.streak ?? 0;
  let childFamily = opts.childFamily ?? opts.childLinked ?? false;
  let childLinked = opts.childLinked ?? false;
  // 자녀 가족의 가입 번호: 'live' 살아 있음 / 'expired' 지난 번호만 / null 아직 없음
  let childCode: 'live' | 'expired' | null = childFamily && !opts.childCodeNever ? (opts.childCodeExpired ? 'expired' : 'live') : null;
  let emailVerified = opts.who === 'child';
  let who = opts.who;
  let failHistory = opts.failHistory ?? 0;
  let failHistoryServer = opts.failHistoryServer ?? 0;
  let failCheer = opts.failCheer ?? 0;
  const cheersSent = new Map<string, number>();
  const many = (opts.parents ?? []).map((p, i) => ({...p, parentId: p.parentId ?? `parent-${i + 1}`}));
  // 기본 어르신 한 명(가족 호칭을 그대로 쓴다)
  const single = (): ChildParent => {
    const shared = consented;
    const latest: LatestAnswer | null =
      opts.latest !== undefined
        ? opts.latest
        : shared && savedLabel
          ? {prompt: null, choiceLabel: savedLabel, answeredDate: todayKst()}
          : null;
    const on = shared && !!latest;
    return {parentId: 'parent-1', title: parentTitle, shared, connected: !opts.disconnected, latest: shared ? latest : null, starter: on ? (opts.starter ?? null) : null};
  };
  const parentList = (): ChildParent[] =>
    opts.parents
      ? many.map(p => ({
          parentId: p.parentId,
          title: p.title,
          shared: p.shared ?? true,
          connected: p.connected ?? true,
          latest: (p.shared ?? true) ? (p.latest ?? null) : null,
          starter: (p.shared ?? true) && p.latest ? (p.starter ?? null) : null,
        }))
      : [single()];
  return {
    async signInWithSocial() {
      const r = opts.socialResult ?? 'ok';
      if (r === 'offline') {
        throw new OfflineError('offline');
      }
      if (r === 'fail') {
        throw new ServerError('social', 'social_failed', 'SOCIAL');
      }
      if (r === 'ok') {
        emailVerified = true; // 로그인한 자녀
      }
      return r;
    },
    async sendEmailCode(email) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new ServerError('send_email_code', 'invalid_email', 'validation_failed');
      }
    },
    async verifyEmailCode(_email, code) {
      if (code !== '246810') {
        throw new ServerError('verify_email_code', 'otp_expired', 'otp_expired');
      }
      emailVerified = true;
    },
    async getChildState() {
      if (!childFamily) {
        return {kind: 'no_family'};
      }
      return {
        kind: 'family',
        parentTitle,
        linked: childLinked,
        code: !childLinked && childCode === 'live' ? {code: '123456', expiresAt: '2099-01-01T00:00:00Z'} : null,
        hadExpired: !childLinked && childCode === 'expired',
      };
    },
    async whoAmI() {
      return who ?? (emailVerified ? 'child' : linked ? 'parent' : 'none');
    },
    async getLoginMethod() {
      return opts.loginMethod === undefined ? 'kakao' : opts.loginMethod;
    },
    async signOut() {
      emailVerified = false;
      who = undefined;
    },
    async fetchAnswerHistory(): Promise<ParentHistory[]> {
      if (failHistory > 0) {
        failHistory -= 1;
        throw new OfflineError('offline');
      }
      if (failHistoryServer > 0) {
        failHistoryServer -= 1;
        throw new ServerError('child_answer_history', 'boom', 'XX000');
      }
      if (opts.parents) {
        return many.map(p => ({parentId: p.parentId, title: p.title, shared: p.shared ?? true, items: (p.shared ?? true) ? (p.history ?? []) : []}));
      }
      const s = single();
      const c = FAKE_CONTENT[((opts.day ?? 1) - 1) % FAKE_CONTENT.length];
      const items: HistoryItem[] =
        opts.history ?? (savedLabel ? [{answeredDate: todayKst(), promptShort: pairShort(c.a, c.b), choiceLabel: savedLabel}] : []);
      return [{parentId: s.parentId, title: s.title, shared: s.shared, items: s.shared ? items : []}];
    },
    async sendCheer(parentId, key): Promise<SendCheerResult> {
      if (failCheer > 0) {
        failCheer -= 1;
        throw new OfflineError('offline');
      }
      if (!(CHILD_CHEER_KEYS as readonly string[]).includes(key)) {
        return {ok: false, reason: 'invalid_key'};
      }
      if (opts.cheerResult) {
        return opts.cheerResult;
      }
      const p = parentList().find(x => x.parentId === parentId);
      if (!p) {
        return {ok: false, reason: 'invalid_target'};
      }
      if (!p.connected) {
        return {ok: false, reason: 'disconnected'};
      }
      const n = cheersSent.get(parentId) ?? 0;
      if (n >= (opts.cheerDailyLimit ?? 2)) {
        return {ok: false, reason: 'daily_limit'};
      }
      cheersSent.set(parentId, n + 1);
      return {ok: true, cheerId: `cheer-${parentId}-${n + 1}`};
    },
    async createFamily() {
      childFamily = true;
      return {family_id: 'fam-1', profile_id: 'child-1'};
    },
    async issueInviteCode() {
      childCode = 'live'; // 새 번호를 받으면 이전 번호는 무효(서버 0018)
      return '123456'; // 어르신 쪽 fake redeem 이 받는 번호와 같게
    },
    async redeemInviteCode(code): Promise<RedeemResult> {
      if (code === '123456') {
        linked = true;
        if (childFamily) {
          childLinked = true;
        }
        return {ok: true, family_id: 'fam-1', profile_id: 'parent-1'};
      }
      const reason = FAIL_CODES[code] ?? 'invalid';
      return reason === 'rate_limited'
        ? {ok: false, reason, retry_after_sec: 600}
        : {ok: false, reason};
    },
    async peekInviteCode(code): Promise<PeekResult> {
      if (opts.failPeek) {
        throw new OfflineError('offline');
      }
      if (code === '123456') {
        return {ok: true, parentTitle};
      }
      const reason = FAIL_CODES[code] ?? 'invalid';
      return reason === 'rate_limited' ? {ok: false, reason, retry_after_sec: 600} : {ok: false, reason};
    },
    async logEvent() {
      // 기록만 하고 아무것도 하지 않는다(테스트는 spy 로 확인)
    },
    async deleteScopePreview() {
      if (opts.failPreview) {
        throw new OfflineError('offline');
      }
      return {scope: opts.deleteScope ?? 'parent'};
    },
    async deleteMyAccount() {
      if (failDelete > 0) {
        failDelete -= 1;
        throw new OfflineError('offline');
      }
      steps.clear();
      consented = false;
      return {scope: opts.deleteScope ?? 'parent'};
    },
    async giveConsent(_version: string) {
      consented = true;
    },
    async getWeekStamps() {
      const kst = new Date(Date.now() + 9 * 3600e3);
      const idx = (kst.getUTCDay() + 6) % 7;
      const mon = new Date(kst.getTime() - idx * 86400e3);
      const day = (i: number) => new Date(mon.getTime() + i * 86400e3).toISOString().slice(0, 10);
      const set = new Set((opts.weekDone ?? []).map(day));
      if (steps.size === 3) {
        set.add(day(idx));
      }
      return {weekStart: day(0), doneDates: [...set].sort()};
    },
    async getTodayContent(): Promise<TodayContent | null> {
      if (opts.empty) {
        return null;
      }
      const idx = ((opts.day ?? 1) - 1) % FAKE_CONTENT.length;
      const c = FAKE_CONTENT[idx];
      return {
        day_index: idx + 1,
        photo: {caption: c.caption, image_url: opts.realImage ? `https://example.test/day-${idx + 1}.jpg` : `pending://day-${idx + 1}`, keyword: c.keyword, recall_questions: c.recall},
        question: opts.questionNull ? null : {id: `q-${idx + 1}`, option_a: c.a, option_b: c.b, prompt: opts.promptNull ? null : c.prompt},
        answered_choice: linked ? answered : null,
        consented: linked && consented,
        completed_steps: linked ? [...steps] : [],
        streak: !linked ? 0 : steps.size === 3 ? Math.max(1, baseStreak) : baseStreak,
        linked,
      };
    },
    async saveAnswer({choice}) {
      if (!consented) {
        throw new ServerError('save_answer', 'consent_required', 'P0001'); // 서버와 같게
      }
      answered = choice;
      const c = FAKE_CONTENT[((opts.day ?? 1) - 1) % FAKE_CONTENT.length];
      savedLabel = choice === 'A' ? c.a : c.b;
    },
    async recordSessionStep(step) {
      if (failRecord > 0) {
        failRecord -= 1;
        throw new OfflineError('offline');
      }
      steps.add(step);
      const completed = steps.size === 3;
      return {completed, streak: completed ? Math.max(1, baseStreak) : baseStreak, steps: [...steps]};
    },
    async fetchChildSummary(): Promise<ChildSummary> {
      if (failChildHome > 0) {
        failChildHome -= 1;
        throw new OfflineError('offline');
      }
      const parents = parentList();
      const first = parents[0];
      return {parentTitle, shared: first?.shared ?? true, latest: first?.latest ?? null, parents};
    },
    async setParentTitle(title) {
      if (!(PARENT_TITLES as readonly string[]).includes(title)) {
        return {ok: false, reason: 'invalid_title'};
      }
      parentTitle = title;
      return {ok: true};
    },
    async setParentTitleFor(parentId, title) {
      if (!(PARENT_TITLES as readonly string[]).includes(title)) {
        return {ok: false, reason: 'invalid_title'};
      }
      const p = many.find(x => x.parentId === parentId);
      if (p && many.some(x => x.parentId !== parentId && x.title === title)) {
        return {ok: false, reason: 'duplicate_title'}; // 0028
      }
      if (p) {
        p.title = title;
      } else if (!opts.parents && parentId === 'parent-1') {
        parentTitle = title; // 기본 어르신 한 명은 가족 호칭을 그대로 쓴다
      } else {
        return {ok: false, reason: 'invalid_target'};
      }
      return {ok: true};
    },
    async withdrawConsent() {
      consented = false;
      answered = null;
      savedLabel = null;
    },
  };
}
