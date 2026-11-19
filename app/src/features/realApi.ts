import type {SupabaseClient} from '@supabase/supabase-js';
import {OfflineError, ServerError} from './types';
import type {SocialAuth} from './socialAuth';
import {makeNonce, sha256Hex} from '../lib/sha256';
import {parseMarkCheersRead, parseMyCheers} from '../api/contract/cheers';
import {parseLogEventResult, type EventName, type EventProps} from '../api/contract/events';
import {clampDays, parseParentHistory} from '../api/contract/history';
import {pairShort} from '../lib/childFormat';
import {parsePeekResult} from '../api/contract/invite';
import {clearPushToken, readPushToken} from '../lib/pushToken';
import {parseParentFamily} from '../api/contract/family';
import {parseMyPushSettings, parseRegisterPushToken, parseSetPushEnabled, type PushPlatform} from '../api/contract/push';
import {parseMyTermsStatus, parseRecordTerms} from '../api/contract/terms';
import {parseDeleteScope} from '../api/contract/deleteScope';
import type {
  Api, ChildParent, PeekResult, ChildState, ChildSummary, CreateFamilyResult, LoginMethod, ParentHistory, RecordStepResult, RedeemResult,
  SendCheerResult, StepName, TodayContent,
} from './types';

export interface RealApi extends Api {
  // 통합 테스트용 이메일·비밀번호 가입(앱의 자녀 로그인은 메일 인증번호: sendEmailCode/verifyEmailCode)
  signUpChild(email: string, password: string): Promise<void>;
}

type SbError = {message: string; code?: string; status?: number; name?: string};
// 서버가 응답한 오류에는 Postgres 코드가 붙는다. 코드가 없는 실패만 네트워크 문제 후보로 본다
// (fetch 실패는 supabase-js 가 코드 없이 TypeError 메시지로 감싼다).
const NETWORK_RE = /network request failed|failed to fetch|fetch failed|timed? ?out|ECONN|ENOTFOUND/i;
const looksOffline = (e: SbError) =>
  !e.code && (e.status === 0 || e.name === 'AuthRetryableFetchError' || NETWORK_RE.test(e.message));
// 서버가 raise 한 예외 이름과 정확히 같은지(P0001 + 메시지 일치)
const isRaised = (e: SbError, reason: string) => e.code === 'P0001' && e.message === reason;

// 자녀 C4 child_summary 모양 → ChildSummary(어르신 미리보기 0050 summary 도 같은 모양이라 같이 쓴다).
// parent_id·title·connected 는 0019·0021(dev-server-notes §1). 옛 서버(필드 없음)면 id 는 ''(보낼 대상 아님, 리뷰 L3)·가족 호칭·연결됨
// shared:false 면 서버가 무엇을 보내도 답을 쓰지 않는다(리뷰 L2)
function parseChildSummary(data: Record<string, any>): ChildSummary {
  const family: string = data.parent_title ?? '부모님';
  const parents: ChildParent[] = (data.parents ?? []).map((p: Record<string, any>) => ({
    parentId: p.parent_id ?? '',
    title: p.title ?? family,
    shared: !!p.shared,
    connected: p.connected ?? true,
    latest: p.shared && p.latest
      ? {prompt: p.latest.prompt ?? null, choiceLabel: p.latest.choice_label, answeredDate: p.latest.answered_date}
      : null,
    starter: p.shared ? (p.latest?.starter ?? null) : null, // 0027 기능 회의 B3
    connectedDate: typeof p.connected_date === 'string' ? p.connected_date : null, // 0041(처음 연결된 날). 옛 서버면 null
  }));
  const first = parents[0];
  return {
    parentTitle: family,
    shared: first ? first.shared : true, // 어르신이 아직 없으면 "나누지 않는 중"이라 하지 않는다
    latest: first?.latest ?? null,
    parents,
  };
}

// 자녀 C5 child_answer_history 모양 → ParentHistory[](어르신 미리보기 0050 history 도 같은 모양). 짧은 질문은 서버 prompt_short 우선
function parseChildHistory(data: Record<string, any>): ParentHistory[] {
  return (data?.parents ?? []).map((p: Record<string, any>) => ({
    parentId: p.parent_id,
    title: p.title ?? '부모님',
    shared: !!p.shared,
    items: (p.shared ? (p.answers ?? []) : []).map((a: Record<string, any>) => ({
      answeredDate: a.session_date,
      promptShort: a.prompt_short ?? pairShort(a.option_a, a.option_b),
      choiceLabel: a.choice_label,
    })),
  }));
}

function fail(what: string, error: SbError): never {
  throw looksOffline(error)
    ? new OfflineError(`${what}: ${error.message}`)
    : new ServerError(what, error.message, error.code);
}

// 서버 RPC/테이블을 그대로 감싼 구현. reason 같은 도메인 실패는 throw 하지 않고 반환값으로 돌려준다.
// social: 네이티브 소셜 로그인 모듈(테스트에서 바꿔 끼움). 기본값은 필요할 때 불러온다(통합 테스트(node)는 네이티브 모듈 없이 돈다).
// platform: 이 기기 OS(selectApi 가 Platform.OS 로 넘김, iOS 준비 N3). 통합 테스트(node)는 기본 android
export function createRealApi(sb: SupabaseClient, social?: SocialAuth, platform: PushPlatform | null = 'android'): RealApi {
  const socialAuth = (): SocialAuth => social ?? require('./socialAuth').nativeSocialAuth;
  // 어르신 기기: 세션이 없으면 익명 로그인한다. 세션을 "못 읽은" 것과 "없는" 것은 다르므로
  // 못 읽었으면(오프라인) 새 익명 사용자를 만들지 않는다.
  // 세션이 생기기 전에 난 이벤트(AC-05: 역할 고르기의 app_first_open). 서버는 세션 없는 log_event 를 auth_required 로 버리므로
  // 여기 잠깐 들고 있다가 세션이 생긴 뒤 첫 ensureSession·logEvent 때 먼저 보낸다. 앱을 새로 켜면 사라진다(최대 4개).
  const waiting: {name: EventName; props: EventProps}[] = [];
  const flushWaiting = () => {
    for (const x of waiting.splice(0)) {
      Promise.resolve(sb.rpc('log_event', {p_name: x.name, p_props: x.props})).catch(() => {});
    }
  };
  const ensureSession = async () => {
    const {data, error} = await sb.auth.getSession();
    if (error) throw new OfflineError(`세션 확인: ${error.message}`);
    if (!data.session) {
      const {error: e} = await sb.auth.signInAnonymously();
      if (e) fail('익명 로그인', e);
    }
    flushWaiting();
  };
  // get_today_content(읽기 전용)·start_today(0024, 커서 전진 + 같은 객체 + advanced) 공용. 미연결이면 미리 보기.
  const loadToday = async (rpc: 'get_today_content' | 'start_today'): Promise<TodayContent | null> => {
    // 처음 설치한 기기는 세션이 없다. anon 은 RPC 권한이 없으므로 먼저 익명 로그인한다(서버 권한은 열지 않음).
    await ensureSession();
    const {data, error} = await sb.rpc(rpc);
    if (error) {
      // 프로필이 없는(연결이 풀린) 기기는 미연결 열람 모드로 코스만 보여 준다.
      // 서버는 프로필 없음도 parent_required 로 알려 주어 자녀와 구분되지 않는다. preview_content 가
      // 프로필 유무를 판정하므로(있으면 linked_use_get_today_content) 그 경우 원래 오류를 그대로 올린다.
      if (isRaised(error, 'parent_required') || isRaised(error, 'no_profile')) {
        const {data: pv, error: pe} = await sb.rpc('preview_content');
        if (pe) {
          if (isRaised(pe, 'linked_use_get_today_content')) fail(rpc, error);
          fail('preview_content', pe);
        }
        if (!pv) return null;
        return {
          day_index: pv.day_index,
          photo: pv.photo,
          question: pv.question,
          answered_choice: null,
          consented: false,
          completed_steps: [],
          streak: 0,
          linked: false,
        };
      }
      fail(rpc, error);
    }
    return data ? ({...data, linked: true} as TodayContent) : null;
  };
  return {
    async signUpChild(email, password) {
      const {error} = await sb.auth.signUp({email, password});
      if (error) fail('가입', error);
    },
    async deleteScopePreview() {
      const {data, error} = await sb.rpc('delete_scope_preview');
      if (error) fail('delete_scope_preview', error);
      const r = parseDeleteScope(data); // 0049: 가족 연결 전 계정은 'none'
      if (!r) throw new ServerError('delete_scope_preview', 'contract_mismatch');
      return r;
    },
    async deleteMyAccount() {
      const {data, error} = await sb.rpc('delete_my_account');
      if (error) fail('delete_my_account', error);
      await clearPushToken(); // 서버가 토큰 행을 함께 지웠다(0032). 이 기기 기억만 지운다
      // 서버가 앱 데이터와 함께 본인 인증 계정(소셜 식별 정보 포함)까지 지웠다(0017). 이 기기의 정리만 남는다.
      // 소셜 SDK 세션: 연결된 방법 전체(providers, 자동 합쳐진 경우 포함)를 정리하고, 카카오는 연결 끊기(unlink, 기기 토큰 기준).
      // 기기 토큰이 없으면 unlink 는 조용히 실패한다 → 서버(Admin 키) unlink 는 설계만(TODO). 실패해도 다음 정리는 계속.
      try {
        const {data: s} = await sb.auth.getSession();
        const meta = s.session?.user.app_metadata ?? {};
        const list: string[] = Array.isArray(meta.providers) ? meta.providers : meta.provider ? [meta.provider] : [];
        const auth = socialAuth();
        if (list.includes('kakao')) {
          await auth.unlinkKakao().catch(() => {});
          await auth.signOut('kakao');
        }
        if (list.includes('google')) {
          await auth.signOut('google');
        }
      } catch {
        // 무시(데이터는 이미 지워짐)
      }
      try {
        await sb.auth.signOut({scope: 'local'}); // 인증 계정이 이미 없으므로 서버 호출 없이 이 기기 세션만 지운다
      } catch {
        // 무시
      }
      return {scope: data.scope};
    },
    async signInWithSocial(provider) {
      // 어르신 기기 차단을 API 에서도(보안 검토 #4): 익명 세션이 연결된 어르신이면 SDK 를 부르지 않는다.
      const {data: cur, error: se} = await sb.auth.getSession();
      if (se) throw new OfflineError(`세션 확인: ${se.message}`);
      const anon = cur.session?.user.is_anonymous ? cur.session.user : null;
      if (anon) {
        const {data: p, error: pe} = await sb.from('profiles').select('id').eq('user_id', anon.id).eq('role', 'parent').maybeSingle();
        if (pe) fail('프로필 조회', pe);
        if (p) {
          throw new ServerError('social_login', 'parent_device', 'SOCIAL');
        }
      }
      // 소셜 토큰을 받은 뒤에만: 프로필 없는 익명 세션(미연결 열람)은 서버에서 정리하고 이 기기 세션도 지운 다음 교환한다
      // (교환하면 익명 세션이 덮어써져 고아 익명 사용자가 서버에 남기 때문). 정리 실패는 로그인을 막지 않는다.
      const dropAnon = async () => {
        if (!anon) {
          return;
        }
        await sb.rpc('discard_anonymous_session').then(
          () => undefined,
          () => undefined,
        );
        await sb.auth.signOut({scope: 'local'}).catch(() => undefined);
      };
      if (provider === 'kakao') {
        // nonce: 카카오에는 원문의 SHA-256 hex, Supabase 에는 원문(서버가 sha256(원문) 과 토큰 nonce 를 비교)
        let raw: string;
        try {
          raw = makeNonce();
        } catch {
          throw new ServerError('kakao_login', 'no_secure_random', 'SOCIAL'); // 화면: "로그인이 안 됐어요"
        }
        const r = await socialAuth().kakao(sha256Hex(raw));
        if (r === 'cancelled') {
          return 'cancelled';
        }
        await dropAnon();
        const {error} = await sb.auth.signInWithIdToken({provider: 'kakao', token: r.idToken, nonce: raw});
        if (error) fail('kakao_id_token', error);
        return 'ok';
      }
      // 구글 공개판은 nonce 미지원: 토큰·요청 둘 다 nonce 없음(서버 검사 통과, Skip nonce checks 불필요)
      const r = await socialAuth().google();
      if (r === 'cancelled') {
        return 'cancelled';
      }
      await dropAnon();
      const {error} = await sb.auth.signInWithIdToken({provider: 'google', token: r.idToken});
      if (error) fail('google_id_token', error);
      return 'ok';
    },
    async sendEmailCode(email) {
      const {error} = await sb.auth.signInWithOtp({email, options: {shouldCreateUser: true}});
      if (error) {
        if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
          throw new ServerError('send_email_code', 'rate_limited', String(error.status ?? ''));
        }
        if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
          throw new ServerError('send_email_code', 'invalid_email', error.code);
        }
        fail('send_email_code', error);
      }
    },
    async verifyEmailCode(email, code) {
      const {error} = await sb.auth.verifyOtp({email, token: code, type: 'email'});
      if (error) {
        if (error.code === 'otp_expired' || error.status === 403) {
          throw new ServerError('verify_email_code', 'otp_expired', error.code);
        }
        fail('verify_email_code', error);
      }
    },
    async getChildState(): Promise<ChildState> {
      const {data, error} = await sb.rpc('child_summary');
      if (error) {
        if (isRaised(error, 'child_required')) return {kind: 'no_family'}; // 자녀 프로필(가족)이 아직 없음
        fail('child_summary', error);
      }
      const linked = (data.parents ?? []).length > 0;
      let code: {code: string; expiresAt: string} | null = null;
      let hadExpired = false;
      if (!linked) {
        // 아직 쓰지 않은 가입 번호(재연결 번호 제외) 중 가장 늦게 끝나는 것 1개
        const {data: row, error: ce} = await sb
          .from('invite_codes')
          .select('code, expires_at')
          .is('used_at', null)
          .is('target_profile_id', null)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', {ascending: false})
          .limit(1)
          .maybeSingle();
        if (ce) fail('invite_codes', ce);
        code = row ? {code: row.code, expiresAt: row.expires_at} : null;
        if (!code) {
          // 살아 있는 번호가 없으면: 쓰지 않은 지난 가입 번호(만료·새 번호로 무효화)가 있었는지
          const {count, error: pe} = await sb
            .from('invite_codes')
            .select('id', {count: 'exact', head: true})
            .is('used_at', null)
            .is('target_profile_id', null);
          if (pe) fail('invite_codes', pe);
          hadExpired = (count ?? 0) > 0;
        }
      }
      return {kind: 'family', parentTitle: data.parent_title ?? '부모님', linked, code, hadExpired};
    },
    async whoAmI() {
      const {data, error} = await sb.auth.getSession();
      if (error) fail('세션 확인', error);
      const user = data.session?.user;
      if (!user) return 'none';
      if (!user.is_anonymous) return 'child';
      const {data: p, error: pe} = await sb.from('profiles').select('id').eq('user_id', user.id).eq('role', 'parent').maybeSingle();
      if (pe) fail('프로필 조회', pe);
      return p ? 'parent' : 'none';
    },
    async createFamily(): Promise<CreateFamilyResult> {
      const {data, error} = await sb.rpc('create_family');
      if (error) fail('create_family', error);
      return data as CreateFamilyResult;
    },
    async issueInviteCode(target) {
      const {data, error} = await sb.rpc('issue_invite_code', {p_target: target ?? null});
      if (error) fail('issue_invite_code', error);
      return data as string;
    },
    async redeemInviteCode(code): Promise<RedeemResult> {
      await ensureSession();
      const {data, error} = await sb.rpc('redeem_invite_code', {p_code: code});
      if (error) fail('redeem_invite_code', error);
      return data as RedeemResult;
    },
    async parentFamilyList() {
      const {data, error} = await sb.rpc('parent_family_list');
      if (error) fail('parent_family_list', error);
      const r = parseParentFamily(data);
      if (!r) throw new ServerError('parent_family_list', 'contract_mismatch');
      return r;
    },
    async peekInviteCode(code): Promise<PeekResult> {
      await ensureSession();
      const {data, error} = await sb.rpc('peek_invite_code', {p_code: code});
      if (error) fail('peek_invite_code', error);
      const r = parsePeekResult(data); // 계약 밖이면 일반 서버 오류(리뷰 M3)
      if (!r) throw new ServerError('peek_invite_code', 'contract_mismatch');
      return r;
    },
    async giveConsent(version) {
      const {error} = await sb.rpc('give_consent', {p_version: version});
      if (error) fail('give_consent', error);
    },
    async getWeekStamps() {
      const {data, error} = await sb.rpc('my_week_stamps');
      if (error) fail('my_week_stamps', error);
      return {weekStart: data.week_start, doneDates: data.done_dates ?? []};
    },
    getTodayContent: () => loadToday('get_today_content'),
    startToday: () => loadToday('start_today'),
    async parentHistory(days = 30) {
      const {data, error} = await sb.rpc('parent_history', {p_days: clampDays(days)});
      if (error) fail('parent_history', error);
      const r = parseParentHistory(data);
      if (!r) throw new ServerError('parent_history', 'contract_mismatch');
      return r;
    },
    async logEvent(name, props = {}) {
      // 세션 전에는 익명 사용자를 만들지 않는다(자녀는 곧 카카오 등으로 로그인한다). 들고 있다가 세션이 생기면 보낸다
      const {data: cur} = await sb.auth.getSession();
      if (!cur?.session) {
        if (waiting.length < 4) {
          waiting.push({name, props});
        }
        return {ok: false, reason: 'no_user'};
      }
      flushWaiting();
      const {data, error} = await sb.rpc('log_event', {p_name: name, p_props: props});
      if (error) fail('log_event', error);
      const r = parseLogEventResult(data);
      if (!r) throw new ServerError('log_event', 'contract_mismatch');
      return r;
    },
    async saveAnswer({questionId, choice}) {
      const {error} = await sb.rpc('save_answer', {p_question: questionId, p_choice: choice});
      if (error) fail('save_answer', error);
    },
    async recordSessionStep(step: StepName, durationSec: number): Promise<RecordStepResult> {
      const {data, error} = await sb.rpc('record_session_step', {
        p_step: step,
        p_duration: durationSec,
      });
      if (error) fail('record_session_step', error);
      return {completed: !!data.completed, streak: Number(data.streak ?? 0), steps: data.steps};
    },
    async fetchChildSummary(): Promise<ChildSummary> {
      const {data, error} = await sb.rpc('child_summary');
      if (error) fail('child_summary', error);
      return parseChildSummary(data);
    },
    // 어르신 P13 '가족에게 이렇게 보여요'(0050): 자녀 child_summary·child_answer_history 와 같은 내부 함수로 계산한 본인 항목 1개.
    // 자녀 화면과 같은 파서(parseChildSummary·parseChildHistory)를 그대로 쓴다(PR #11 리뷰 M1)
    async parentPreviewChildView() {
      const {data, error} = await sb.rpc('parent_preview_child_view');
      if (error) fail('parent_preview_child_view', error);
      return {summary: parseChildSummary(data?.summary ?? {}), history: parseChildHistory(data?.history ?? {})};
    },
    async setParentTitle(title) {
      const {data, error} = await sb.rpc('set_parent_title', {p_title: title});
      if (error) fail('set_parent_title', error);
      return data.ok ? {ok: true} : {ok: false, reason: data.reason === 'duplicate_title' ? 'duplicate_title' : 'invalid_title'};
    },
    async setParentTitleFor(parentId, title) {
      const {data, error} = await sb.rpc('set_parent_title_for', {p_parent: parentId, p_title: title});
      if (error) fail('set_parent_title_for', error);
      const reason = data.reason === 'invalid_target' || data.reason === 'duplicate_title' ? data.reason : 'invalid_title';
      return data.ok ? {ok: true} : {ok: false, reason};
    },
    // TODO(계약 검증기): ARCHITECTURE §5 contracts 런타임 검증이 생기면 아래 세 매핑을 그 검증기로 통과시킨다
    async fetchAnswerHistory(): Promise<ParentHistory[]> {
      const {data, error} = await sb.rpc('child_answer_history');
      if (error) fail('child_answer_history', error);
      return parseChildHistory(data);
    },
    async sendCheer(parentId, key): Promise<SendCheerResult> {
      const {data, error} = await sb.rpc('send_cheer', {p_parent: parentId, p_key: key});
      if (error) fail('send_cheer', error);
      return data.ok ? {ok: true, cheerId: data.cheer_id} : {ok: false, reason: data.reason};
    },
    async getLoginMethod(): Promise<LoginMethod | null> {
      const {data, error} = await sb.auth.getSession();
      if (error) fail('세션 확인', error);
      const p = data.session?.user.app_metadata?.provider;
      return p === 'kakao' || p === 'google' || p === 'email' ? p : null;
    },
    async accountTag() {
      const {data} = await sb.auth.getSession();
      const id = data.session?.user.id;
      return id ? sha256Hex(id).slice(0, 16) : null;
    },
    async signOut() {
      // 푸시 토큰 해제가 먼저(0032: 로그아웃 뒤에는 auth.uid 가 없어 해제가 실패한다). 등록한 토큰이 없으면 부르지 않는다. 실패해도 로그아웃은 계속
      const token = await readPushToken();
      if (token) {
        try {
          await sb.rpc('unregister_push_token', {p_token: token});
        } catch {
          // 무시(서버 파기 배치가 오래된 토큰을 지운다)
        }
        await clearPushToken();
      }
      // 소셜 SDK 세션 정리(실패해도 계속) → 이 기기 세션만 지운다(다른 기기 로그인은 그대로)
      try {
        const {data} = await sb.auth.getSession();
        const meta = data.session?.user.app_metadata ?? {};
        const list: string[] = Array.isArray(meta.providers) ? meta.providers : meta.provider ? [meta.provider] : [];
        const auth = socialAuth();
        if (list.includes('kakao')) {
          await auth.signOut('kakao');
        }
        if (list.includes('google')) {
          await auth.signOut('google');
        }
      } catch {
        // 무시
      }
      const {error} = await sb.auth.signOut({scope: 'local'});
      if (error) {
        // 리뷰 L5(리드 결정): 오프라인이면 supabase-js 가 세션을 남긴다 → 이 기기 저장 세션을 직접 지운다(서버 토큰은 만료로 정리)
        const removeLocal = (sb.auth as unknown as {_removeSession?: () => Promise<void>})._removeSession;
        if (!looksOffline(error) || !removeLocal) {
          fail('로그아웃', error);
        }
        await removeLocal.call(sb.auth);
      }
    },
    async withdrawConsent() {
      const {error} = await sb.rpc('withdraw_consent');
      if (error) fail('withdraw_consent', error);
    },
    // 0020 응원(계약: api/contract/cheers.ts, 통합 테스트 __integration__/cheers.test.ts)
    async getMyCheers() {
      const {data, error} = await sb.rpc('get_my_cheers');
      if (error) fail('get_my_cheers', error);
      const parsed = parseMyCheers(data);
      if (!parsed) throw new ServerError('get_my_cheers', 'contract_mismatch');
      return parsed;
    },
    async markCheersRead(ids) {
      const {data, error} = await sb.rpc('mark_cheers_read', {p_ids: ids});
      if (error) fail('mark_cheers_read', error);
      const n = parseMarkCheersRead(data);
      if (n === null) throw new ServerError('mark_cheers_read', 'contract_mismatch');
      return n;
    },
    // 0032·0036·0037 푸시(계약 api/contract/push.ts)
    async registerPushToken(token) {
      if (!platform) {
        return {ok: false, reason: 'invalid_platform'}; // 서버가 받지 않는 OS(web 등)는 부르지 않는다
      }
      const {data, error} = await sb.rpc('register_push_token', {p_token: token, p_platform: platform});
      if (error) fail('register_push_token', error);
      const r = parseRegisterPushToken(data);
      if (!r) throw new ServerError('register_push_token', 'contract_mismatch');
      return r;
    },
    async setPushEnabled(enabled) {
      const {data, error} = await sb.rpc('set_push_enabled', {p_enabled: enabled});
      if (error) fail('set_push_enabled', error);
      const r = parseSetPushEnabled(data);
      if (!r) throw new ServerError('set_push_enabled', 'contract_mismatch');
      return r;
    },
    async myPushSettings() {
      const {data, error} = await sb.rpc('my_push_settings');
      if (error) fail('my_push_settings', error);
      const r = parseMyPushSettings(data);
      if (!r) throw new ServerError('my_push_settings', 'contract_mismatch');
      return r;
    },
    async recordTermsAgreement(termsVersion, privacyVersion) {
      const {data, error} = await sb.rpc('record_terms_agreement', {p_terms_version: termsVersion, p_privacy_version: privacyVersion});
      if (error) fail('record_terms_agreement', error);
      const r = parseRecordTerms(data);
      if (!r) throw new ServerError('record_terms_agreement', 'contract_mismatch');
      return r;
    },
    async myTermsStatus() {
      const {data, error} = await sb.rpc('my_terms_status');
      if (error) fail('my_terms_status', error);
      const r = parseMyTermsStatus(data);
      if (!r) throw new ServerError('my_terms_status', 'contract_mismatch');
      return r;
    },
  };
}
