import {OfflineError, ServerError} from './types';
import {ChildSummary, PARENT_TITLES} from './types';
import type {
  PeekResult,
  Api, ChildParent, HistoryItem, LatestAnswer, LoginMethod, ParentHistory, RedeemResult, SendCheerResult, StepName, TodayContent,
} from './types';
import {isCheerKey, type MyCheers} from '../api/contract/cheers';
import type {HistoryDay} from '../api/contract/history';
import type {FailReason} from '../copy/copy';
import {pairShort} from '../lib/childFormat';
import {isFeatureOn} from '../lib/features';
import type {PassOnKey, SavePassOnResult, SaveRecallResult} from '../api/contract/fiveSteps';
import {fakeRecallFor} from './fakeRecallOptions';

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
    recall: ['라디오로 즐겨 듣던 게 있어요?', '어디서 들으셨어요?']},
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
  deleteScope?: 'parent' | 'child' | 'family' | 'none'; // deleteMyAccount 결과(기본 parent). none = 가족 연결 전 계정(0049)
  termsResult?: 'ok' | 'unknown_version' | 'offline'; // recordTermsAgreement 결과(기본 ok)
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
  failCheer?: number; // sendCheer 가 처음 N번 실패(오프라인 — 서버에 닿지 않음)
  failCheerAfterSend?: number; // sendCheer 가 처음 N번 '서버는 받았는데 응답이 끊김'(보낸 뒤 오프라인 오류) — request_id 재시도 확인용
  cheerResult?: SendCheerResult; // sendCheer 결과 고정
  loginMethod?: LoginMethod | null; // 기본 kakao
  failPeek?: boolean; // peekInviteCode 가 오프라인으로 실패
  familyDates?: string[]; // parentFamilyList 의 연결 날짜(YYYY-MM-DD). 미지정이면 연결돼 있을 때 오늘 1명
  cheers?: string[]; // 어르신에게 온 읽지 않은 응원의 message_key(최신순, 서버 get_my_cheers 와 같게)
  failCheers?: boolean; // getMyCheers 실패
  failMarkRead?: boolean; // markCheersRead 실패
  eventResult?: 'rate_limited' | 'no_user' | 'invalid_props' | 'offline'; // logEvent 결과(기본 ok)
  parentDays?: HistoryDay[]; // 어르신 지난 날(parent_history, 최신순). 기본 없음
  failParentHistory?: number; // parentHistory 가 처음 N번 실패(오프라인)
  accountTag?: string | null; // 기기 기억값 계정 가명값(기본 'fake-account')
  pushEnabled?: boolean; // 서버 알림 받기 상태(켬 + 받기 시각, 0036). 기본 true, false 면 어르신 N1 이 뜬다
  // ── 5단계(기능 스위치 fiveSteps 가 켜졌을 때만 콘텐츠에 칸이 생긴다 — 서버 계약 api/contract/fiveSteps.ts 제안) ──
  // 서버 0061 흉내(api/contract/fiveSteps.ts). 칸은 늘 준다(새 서버) — fiveStepsSupported:false 면 옛 서버처럼 칸이 없다
  fiveStepsSupported?: boolean; // 기본 true
  recallSlot?: number | null; // 오늘 이미 저장된 ② slot
  passOnKey?: PassOnKey | null; // 오늘 이미 저장된 ⑤ 키
  passOnEnabled?: boolean; // ⑤ 서버 스위치(기본 true — 개발 화면 확인용. false 면 save_pass_on 이 disabled)
  noRecall?: boolean; // 그날 ② 보기가 없음(recall.options = [])
  skippedSteps?: StepName[]; // 오늘 이미 넘긴 단계
  failFiveSave?: number; // saveRecall·savePassOn 이 처음 N번 실패(오프라인)
};
export type FakeParent = {
  parentId?: string;
  title: string;
  shared?: boolean; // 기본 true
  connected?: boolean; // 기본 true
  latest?: LatestAnswer | null;
  history?: HistoryItem[];
  starter?: string | null;
  connectedDate?: string | null;
};
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export type FakeDevHooks = {
  resetToday(): void;
  nextDay(): void;
  /** 테스트용: 어르신 기기의 계정(익명 uid)을 바꾼다 — 서버 redeem 의 '같은 사람 재시도 = ok, 다른 사람 = used' 를 재현(#181 리뷰 H1) */
  switchParentAccount(id: string): void;
};

// in-memory 가짜 구현. '123456' 만 성공, 위 표의 코드는 각 reason, 나머지는 invalid.
export function createFakeApi(opts: FakeOptions = {}): Api & {__dev: FakeDevHooks} {
  let answered: 'A' | 'B' | null = opts.answeredChoice ?? null;
  const steps = new Set<StepName>(opts.completedSteps ?? []);
  // 서버 완료 판정(0061): 옛 3단계가 모두 있고, 5단계로 기록된 날(course_len 5)이면 ②·⑤까지 있어야 완료
  const supported = opts.fiveStepsSupported ?? true;
  const fiveCalls = () => supported && isFeatureOn('fiveSteps'); // realApi 가 p_course_len 5 를 붙이는 조건과 같다
  let courseLen: 3 | 5 = 3;
  const legacyDone = () =>
    steps.has('photo') && steps.has('question') && steps.has('hangul') && (courseLen === 3 || (steps.has('recall') && steps.has('pass_on')));
  const skipped = new Set<StepName>(opts.skippedSteps ?? []);
  let recallSaved: number | null = opts.recallSlot ?? null;
  let passOnSaved: PassOnKey | null = opts.passOnKey ?? null;
  let failFiveSave = opts.failFiveSave ?? 0;
  const todayRecall = () => (opts.noRecall ? [] : (fakeRecallFor(FAKE_CONTENT[(contentDay - 1) % FAKE_CONTENT.length].caption) ?? []).map((label, i) => ({slot: i + 1, label})));
  const dayIdx = () => ((contentDay - 1) % FAKE_CONTENT.length) + 1;
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
  // '123456' 을 쓴 계정(서버 invite_codes.used_by). 지금 어르신 기기 계정은 me(서버 auth.uid())
  let usedBy: string | null = null;
  let me = 'parent-device-1';
  // 자녀 가족의 가입 번호: 'live' 살아 있음 / 'expired' 지난 번호만 / null 아직 없음
  let childCode: 'live' | 'expired' | null = childFamily && !opts.childCodeNever ? (opts.childCodeExpired ? 'expired' : 'live') : null;
  let emailVerified = opts.who === 'child';
  let failParentHistory = opts.failParentHistory ?? 0;
  // 기본 true(이미 받는 중) — N1 이 다른 화면 테스트를 가리지 않게. N1 을 보려면 pushEnabled:false
  let pushEnabled = opts.pushEnabled ?? true;
  const agreedTerms = new Set<string>(); // 약관 동의 쌍(0046)
  let who = opts.who;
  let failHistory = opts.failHistory ?? 0;
  let failHistoryServer = opts.failHistoryServer ?? 0;
  let failCheer = opts.failCheer ?? 0;
  let failCheerAfterSend = opts.failCheerAfterSend ?? 0;
  const cheersSent = new Map<string, number>();
  // 서버 0059: 같은 자녀의 같은 request_id 면 새로 넣지 않고 처음 결과(성공한 응원)를 돌려준다
  const cheerByRequest = new Map<string, SendCheerResult>();
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
          connectedDate: p.connectedDate ?? null,
        }))
      : [single()];
  // 자녀 C5 지난 답(child_answer_history 모양). 어르신 미리보기(0050)도 같은 값을 쓴다
  const historyList = (): ParentHistory[] => {
    if (opts.parents) {
      return many.map(p => ({parentId: p.parentId, title: p.title, shared: p.shared ?? true, items: (p.shared ?? true) ? (p.history ?? []) : []}));
    }
    const s = single();
    const c = FAKE_CONTENT[(contentDay - 1) % FAKE_CONTENT.length];
    const items: HistoryItem[] =
      opts.history ?? (savedLabel ? [{answeredDate: todayKst(), promptShort: pairShort(c.a, c.b), optionA: c.a, optionB: c.b, choiceLabel: savedLabel}] : []);
    return [{parentId: s.parentId, title: s.title, shared: s.shared, items: s.shared ? items : []}];
  };
  let unread: MyCheers['cheers'] = (opts.cheers ?? []).map((message_key, i) => ({id: `cheer-${i + 1}`, message_key, sent_at: '2026-11-20T00:00:00Z'}));
  let contentDay = opts.day ?? 1; // 개발자 메뉴 "하루 넘기기"가 바꾼다
  // 개발자 메뉴(fake 모드 전용): 오늘 코스 초기화·하루 넘기기. Api 인터페이스 밖이라 realApi 에는 없다
  const devHooks: FakeDevHooks = {
    resetToday() {
      steps.clear();
      answered = null;
      savedLabel = null;
      recallSaved = null;
      passOnSaved = null;
      skipped.clear();
      courseLen = 3;
    },
    nextDay() {
      contentDay += 1;
      steps.clear();
      answered = null;
      recallSaved = null;
      passOnSaved = null;
      skipped.clear();
      courseLen = 3;
    },
    switchParentAccount(id: string) {
      me = id;
    },
  };
  return {
    __dev: devHooks,
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
    async accountTag() {
      return opts.accountTag === undefined ? 'fake-account' : opts.accountTag;
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
      return historyList();
    },
    // 어르신 미리보기(0050): 자녀 child_summary·child_answer_history 와 같은 값에서 본인(첫 어르신) 항목 1개
    async parentPreviewChildView() {
      if (failParentHistory > 0) {
        failParentHistory -= 1;
        throw new OfflineError('offline');
      }
      if (!linked) {
        throw new ServerError('parent_preview_child_view', 'parent_required', 'P0001');
      }
      const me = parentList()[0];
      return {
        summary: {parentTitle, shared: me.shared, latest: me.latest, parents: [me]},
        history: historyList().slice(0, 1),
      };
    },
    async sendCheer(parentId, key, requestId): Promise<SendCheerResult> {
      if (failCheer > 0) {
        failCheer -= 1;
        throw new OfflineError('offline');
      }
      if (!isCheerKey(key)) { // 서버 cheer_key_ok 와 같은 전체 목록(시트에서 숨긴 키도 받음)
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
      // 서버 0059 순서: 키(24~26행) → 대상(27~30행) → 연결(31~33행) → 같은 요청 재시도(35~38행) → 하루 한도(39~43행)
      const seen = requestId ? cheerByRequest.get(requestId) : undefined;
      if (seen) {
        return seen; // 0059 35~38행: 같은 자녀의 같은 request_id 면 새로 넣지 않고 그 응원
      }
      const n = cheersSent.get(parentId) ?? 0;
      if (n >= (opts.cheerDailyLimit ?? 2)) {
        return {ok: false, reason: 'daily_limit'};
      }
      cheersSent.set(parentId, n + 1);
      // 같은 fake 안에서 어르신 쪽이 받게(개발자 메뉴 역할 전환 → P8, Maestro F6 응원 왕복). 서버 send_cheer → get_my_cheers 와 같은 흐름
      const cheerId = `cheer-${parentId}-${n + 1}`;
      unread = [{id: cheerId, message_key: key, sent_at: new Date().toISOString()}, ...unread];
      const res: SendCheerResult = {ok: true, cheerId};
      if (requestId) {
        cheerByRequest.set(requestId, res); // 서버는 성공한 응원만 request_id 로 남긴다(실패 결과는 다시 계산)
      }
      if (failCheerAfterSend > 0) {
        failCheerAfterSend -= 1;
        throw new OfflineError('offline'); // 서버엔 들어갔는데 응답이 끊김
      }
      return res;
    },
    async createFamily() {
      childFamily = true;
      return {family_id: 'fam-1', profile_id: 'child-1'};
    },
    async issueInviteCode() {
      childCode = 'live'; // 새 번호를 받으면 이전 번호는 무효(서버 0018)
      usedBy = null; // 새 번호(같은 '123456' 이지만 fake 에서는 새로 발급된 것으로 본다). 서버 0018: 새 번호면 이전 번호 무효
      return '123456'; // 어르신 쪽 fake redeem 이 받는 번호와 같게
    },
    async redeemInviteCode(code): Promise<RedeemResult> {
      if (code === '123456') {
        // 서버 규칙(supabase/migrations/20261116000028_history_peek_notify.sql redeem_invite_code):
        //  - 226~231행: invite_codes.used_by = auth.uid()(익명 계정 uid — 기기가 아니라 계정)이고 그 uid 의 profiles 행이 있으면 ok(재시도 멱등 — 응답이 끊겨 다시 누른 경우).
        //    fake 에서 usedBy === me 이면 me 는 이 redeem 으로 프로필을 만든 계정이라 두 조건이 함께 성립한다
        //  - 250~255행: 다른 계정이 쓴 번호(used_at 있음)면 'used'
        if (usedBy === me) {
          return {ok: true, family_id: 'fam-1', profile_id: 'parent-1'};
        }
        if (usedBy !== null) {
          return {ok: false, reason: 'used'};
        }
        usedBy = me;
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
    async parentFamilyList() {
      if (!linked) {
        return {title: null, family: []}; // 연결 전 기기
      }
      const dates = opts.familyDates ?? [todayKst()];
      return {title: parentTitle, family: dates.map((d, i) => ({seq: i + 1, connectedAt: `${d}T00:00:00Z`, connectedDate: d}))};
    },
    async peekInviteCode(code): Promise<PeekResult> {
      if (opts.failPeek) {
        throw new OfflineError('offline');
      }
      if (code === '123456') {
        // 서버 같은 파일 peek_invite_code 157~161행: 쓴 번호는 누가 확인하든 'used'(peek 에는 같은 계정 예외가 없다 — 재시도 멱등은 redeem 에만)
        if (usedBy !== null) {
          return {ok: false, reason: 'used'};
        }
        return {ok: true, parentTitle};
      }
      const reason = FAIL_CODES[code] ?? 'invalid';
      return reason === 'rate_limited' ? {ok: false, reason, retry_after_sec: 600} : {ok: false, reason};
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
      // #216 리뷰 L: 지우는 사람이 자녀면 어르신 쪽 상태(어르신 계정·연결·답·동의)는 그대로 — 자녀 계정만 지운다
      const role = who ?? (emailVerified ? 'child' : linked ? 'parent' : 'none');
      if (role === 'child') {
        emailVerified = false;
        who = undefined;
        return {scope: opts.deleteScope ?? 'child'};
      }
      steps.clear();
      consented = false;
      // #181 재확인 L: 서버는 계정을 지우면 profiles 행이 없어 같은 uid 라도 'used'(0028 226~231행은 프로필이 있을 때만 ok).
      // fake 는 지운 뒤 다음 익명 계정으로 바뀐 것으로 본다(me 새 값) + 연결 끊김
      me = `${me}-after-delete`;
      linked = false;
      return {scope: opts.deleteScope ?? 'parent'};
    },
    async giveConsent(version: string) {
      // 서버 supabase/migrations/20261116000035_security_followups.sql 29행: 버전 형식 '^v[0-9]{1,3}$' 아니면 invalid_version(#181 리뷰 M1)
      if (!/^v[0-9]{1,3}$/.test(version)) {
        throw new ServerError('give_consent', 'invalid_version', 'P0001');
      }
      consented = true;
    },
    async getWeekStamps() {
      const kst = new Date(Date.now() + 9 * 3600e3);
      const idx = (kst.getUTCDay() + 6) % 7;
      const mon = new Date(kst.getTime() - idx * 86400e3);
      const day = (i: number) => new Date(mon.getTime() + i * 86400e3).toISOString().slice(0, 10);
      const set = new Set((opts.weekDone ?? []).map(day));
      if (legacyDone()) {
        set.add(day(idx));
      }
      return {weekStart: day(0), doneDates: [...set].sort()};
    },
    async parentHistory(days = 30) {
      if (failParentHistory > 0) {
        failParentHistory -= 1;
        throw new OfflineError('offline');
      }
      if (!linked) {
        throw new ServerError('parent_history', 'parent_required', 'P0001'); // 서버처럼 연결된 어르신만
      }
      return {days: (opts.parentDays ?? []).slice(0, Math.max(1, Math.min(30, days)))};
    },
    async startToday() {
      return this.getTodayContent(); // 가짜는 커서가 없다(day 옵션 고정)
    },
    async logEvent() {
      const r = opts.eventResult;
      if (r === 'offline') {
        throw new OfflineError('offline');
      }
      return r ? {ok: false as const, reason: r} : {ok: true as const};
    },
    async getTodayContent(): Promise<TodayContent | null> {
      if (opts.empty) {
        return null;
      }
      const idx = (contentDay - 1) % FAKE_CONTENT.length;
      const c = FAKE_CONTENT[idx];
      // 5단계 칸(0061): 새 서버는 스위치와 상관없이 늘 준다. 보기는 라이터 CSV(fakeRecallOptions)
      const five = supported
        ? {
            five_steps_supported: true,
            skipped_steps: linked ? [...skipped] : [],
            recall: {options: todayRecall(), picked_slot: linked && consented ? recallSaved : null},
            pass_on: {enabled: opts.passOnEnabled ?? true, picked_key: linked && consented && (opts.passOnEnabled ?? true) ? passOnSaved : null},
          }
        : {};
      return {
        day_index: idx + 1,
        photo: {caption: c.caption, image_url: opts.realImage ? `https://example.test/day-${idx + 1}.jpg` : `pending://day-${idx + 1}`, keyword: c.keyword, recall_questions: c.recall},
        question: opts.questionNull ? null : {id: `q-${idx + 1}`, option_a: c.a, option_b: c.b, prompt: opts.promptNull ? null : c.prompt},
        answered_choice: linked ? answered : null,
        consented: linked && consented,
        completed_steps: linked ? [...steps] : [],
        streak: !linked ? 0 : legacyDone() ? Math.max(1, baseStreak) : baseStreak,
        linked,
        ...five,
      };
    },
    async saveAnswer({choice}) {
      if (!consented) {
        throw new ServerError('save_answer', 'consent_required', 'P0001'); // 서버와 같게
      }
      if (skipped.has('question')) {
        throw new ServerError('save_answer', 'skipped', 'P0001'); // 0061: 넘긴 ③에는 답을 저장하지 않는다
      }
      answered = choice;
      const c = FAKE_CONTENT[(contentDay - 1) % FAKE_CONTENT.length];
      savedLabel = choice === 'A' ? c.a : c.b;
    },
    // record_session_step(0061 흉내): 3단계 호출이면 옛 판정 그대로. 5단계(fiveCalls)면 넘어감·여기까지·course_len 5
    async recordSessionStep(step, _sec, o) {
      if (failRecord > 0) {
        failRecord -= 1;
        throw new OfflineError('offline');
      }
      const five = fiveCalls();
      const skip = five && !!o?.skipped;
      if (!five && step !== 'photo' && step !== 'question' && step !== 'hangul') {
        throw new ServerError('record_session_step', 'invalid_step', 'P0001'); // 옛 서버에 새 단계(방어 시험용)
      }
      if (skip && (step === 'photo' || step === 'stop_here')) {
        throw new ServerError('record_session_step', 'invalid_step', 'P0001');
      }
      if (five || step === 'recall' || step === 'pass_on' || step === 'stop_here') {
        courseLen = 5;
      }
      if (step === 'stop_here') {
        if (!steps.has('question')) {
          throw new ServerError('record_session_step', 'stop_before_question', 'P0001');
        }
        for (const s of ['recall', 'hangul', 'pass_on'] as const) {
          if (!steps.has(s)) {
            steps.add(s);
            skipped.add(s);
          }
        }
      } else {
        steps.add(step);
        if (skip) {
          skipped.add(step);
          // 넘긴 단계의 값은 지운다(넘긴 날 자녀에게 무표시)
          if (step === 'recall') recallSaved = null;
          if (step === 'pass_on') passOnSaved = null;
          if (step === 'question') {
            answered = null;
            savedLabel = null;
            if (passOnSaved === 'choice_like') passOnSaved = null;
          }
        } else {
          skipped.delete(step);
        }
      }
      const completed = legacyDone();
      return {completed, streak: completed ? Math.max(1, baseStreak) : baseStreak, steps: [...steps]};
    },
    // 5단계 ② save_recall·⑤ save_pass_on(0061 흉내): 거절은 값
    async saveRecall(dayIndex, slot): Promise<SaveRecallResult> {
      if (failFiveSave > 0) {
        failFiveSave -= 1;
        throw new OfflineError('offline');
      }
      if (!consented) return {ok: false, reason: 'consent_required'};
      if (todayRecall().length === 0) return {ok: false, reason: 'no_content'};
      if (dayIndex !== dayIdx()) return {ok: false, reason: 'stale_day'};
      if (skipped.has('recall')) return {ok: false, reason: 'skipped'};
      if (!todayRecall().some(x => x.slot === slot)) return {ok: false, reason: 'invalid_option'};
      recallSaved = slot;
      return {ok: true};
    },
    async savePassOn(dayIndex, key): Promise<SavePassOnResult> {
      if (failFiveSave > 0) {
        failFiveSave -= 1;
        throw new OfflineError('offline');
      }
      if (!(opts.passOnEnabled ?? true)) return {ok: false, reason: 'disabled'};
      if (!consented) return {ok: false, reason: 'consent_required'};
      if (dayIndex !== dayIdx()) return {ok: false, reason: 'stale_day'};
      if (skipped.has('pass_on')) return {ok: false, reason: 'skipped'};
      if ((key === 'recall_story' && recallSaved == null) || (key === 'choice_like' && answered == null)) return {ok: false, reason: 'missing_value'};
      passOnSaved = key;
      return {ok: true};
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
      recallSaved = null;
      passOnSaved = null;
    },
    async getMyCheers() {
      if (opts.failCheers) {
        throw new OfflineError('offline');
      }
      if (!linked) {
        throw new ServerError('get_my_cheers', 'parent_required', 'P0001'); // 서버처럼 연결된 어르신만
      }
      return {unread_count: unread.length, cheers: unread.slice(0, 20)};
    },
    async markCheersRead(ids) {
      if (opts.failMarkRead) {
        throw new OfflineError('offline');
      }
      const before = unread.length;
      unread = ids === null ? [] : unread.filter(c => !ids.includes(c.id));
      return before - unread.length;
    },
    // 푸시(0032·0036): 프로필 = 연결된 어르신 또는 가족을 만든 자녀. 없으면 no_profile
    async registerPushToken(token) {
      if (!/^[A-Za-z0-9_:-]{20,4096}$/.test(token)) {
        return {ok: false, reason: 'invalid_token'};
      }
      return linked || childFamily ? {ok: true} : {ok: false, reason: 'no_profile'};
    },
    async setPushEnabled(enabled) {
      if (!(linked || childFamily)) {
        return {ok: false, reason: 'no_profile'};
      }
      pushEnabled = enabled;
      return {ok: true, enabled};
    },
    async myPushSettings() {
      return {enabled: linked || childFamily ? pushEnabled : null};
    },
    // 약관 동의(0046·0048): 같은 쌍은 한 번만 기록
    async recordTermsAgreement(terms, privacy) {
      if (opts.termsResult === 'offline') {
        throw new OfflineError('offline');
      }
      if (opts.termsResult === 'unknown_version') {
        return {ok: false, reason: 'unknown_version'};
      }
      const key = `${terms}|${privacy}`;
      const recorded = !agreedTerms.has(key);
      agreedTerms.add(key);
      return {ok: true, recorded};
    },
    async myTermsStatus() {
      return {needsReagree: agreedTerms.size === 0};
    },
  };
}
