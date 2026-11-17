import type {SupabaseClient} from '@supabase/supabase-js';
import {OfflineError, ServerError} from './types';
import type {SocialAuth} from './socialAuth';
import {makeNonce, sha256Hex} from '../lib/sha256';
import type {
  Api, ChildParent, ChildState, ChildSummary, CreateFamilyResult, LoginMethod, ParentHistory, RecordStepResult, RedeemResult,
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

function fail(what: string, error: SbError): never {
  throw looksOffline(error)
    ? new OfflineError(`${what}: ${error.message}`)
    : new ServerError(what, error.message, error.code);
}

// 서버 RPC/테이블을 그대로 감싼 구현. reason 같은 도메인 실패는 throw 하지 않고 반환값으로 돌려준다.
// social: 네이티브 소셜 로그인 모듈(테스트에서 바꿔 끼움). 기본값은 필요할 때 불러온다(통합 테스트(node)는 네이티브 모듈 없이 돈다).
export function createRealApi(sb: SupabaseClient, social?: SocialAuth): RealApi {
  const socialAuth = (): SocialAuth => social ?? require('./socialAuth').nativeSocialAuth;
  // 어르신 기기: 세션이 없으면 익명 로그인한다. 세션을 "못 읽은" 것과 "없는" 것은 다르므로
  // 못 읽었으면(오프라인) 새 익명 사용자를 만들지 않는다.
  const ensureSession = async () => {
    const {data, error} = await sb.auth.getSession();
    if (error) throw new OfflineError(`세션 확인: ${error.message}`);
    if (!data.session) {
      const {error: e} = await sb.auth.signInAnonymously();
      if (e) fail('익명 로그인', e);
    }
  };
  return {
    async signUpChild(email, password) {
      const {error} = await sb.auth.signUp({email, password});
      if (error) fail('가입', error);
    },
    async deleteScopePreview() {
      const {data, error} = await sb.rpc('delete_scope_preview');
      if (error) fail('delete_scope_preview', error);
      return {scope: data.scope};
    },
    async deleteMyAccount() {
      const {data, error} = await sb.rpc('delete_my_account');
      if (error) fail('delete_my_account', error);
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
    async giveConsent(version) {
      const {error} = await sb.rpc('give_consent', {p_version: version});
      if (error) fail('give_consent', error);
    },
    async getWeekStamps() {
      const {data, error} = await sb.rpc('my_week_stamps');
      if (error) fail('my_week_stamps', error);
      return {weekStart: data.week_start, doneDates: data.done_dates ?? []};
    },
    async getTodayContent(): Promise<TodayContent | null> {
      // 처음 설치한 기기는 세션이 없다. anon 은 RPC 권한이 없으므로 먼저 익명 로그인한다(서버 권한은 열지 않음).
      await ensureSession();
      const {data, error} = await sb.rpc('get_today_content');
      if (error) {
        // 프로필이 없는(연결이 풀린) 기기는 미연결 열람 모드로 코스만 보여 준다.
        // 서버는 프로필 없음도 parent_required 로 알려 주어 자녀와 구분되지 않는다. preview_content 가
        // 프로필 유무를 판정하므로(있으면 linked_use_get_today_content) 그 경우 원래 오류를 그대로 올린다.
        if (isRaised(error, 'parent_required') || isRaised(error, 'no_profile')) {
          const {data: pv, error: pe} = await sb.rpc('preview_content');
          if (pe) {
            if (isRaised(pe, 'linked_use_get_today_content')) fail('get_today_content', error);
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
        fail('get_today_content', error);
      }
      return data ? ({...data, linked: true} as TodayContent) : null;
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
      const family: string = data.parent_title ?? '부모님';
      // parent_id·title·connected 는 0019·0021 가정 계약. 옛 서버(필드 없음)면 순번·가족 호칭·연결됨으로 채운다
      const parents: ChildParent[] = (data.parents ?? []).map((p: Record<string, any>, i: number) => ({
        parentId: p.parent_id ?? `parent-${i + 1}`,
        title: p.title ?? family,
        shared: !!p.shared,
        connected: p.connected ?? true,
        latest: p.latest
          ? {prompt: p.latest.prompt ?? null, choiceLabel: p.latest.choice_label, answeredDate: p.latest.answered_date}
          : null,
      }));
      const first = parents[0];
      return {
        parentTitle: family,
        shared: first ? first.shared : true, // 어르신이 아직 없으면 "나누지 않는 중"이라 하지 않는다
        latest: first?.latest ?? null,
        parents,
      };
    },
    async setParentTitle(title, parentId) {
      // p_parent_id 는 0019 가정 계약. 지금 서버(가족 단위)와 호환되게 줄 때만 보낸다
      const args = parentId ? {p_title: title, p_parent_id: parentId} : {p_title: title};
      const {data, error} = await sb.rpc('set_parent_title', args);
      if (error) fail('set_parent_title', error);
      return data.ok ? {ok: true} : {ok: false, reason: 'invalid_title'};
    },
    // TODO(서버 0021): child_answer_history() 반환 형태를 dev-server-notes.md 와 맞춘다(가정: dev-app-child-contract.md §2)
    async fetchAnswerHistory(): Promise<ParentHistory[]> {
      const {data, error} = await sb.rpc('child_answer_history');
      if (error) fail('child_answer_history', error);
      return (data?.parents ?? []).map((p: Record<string, any>) => ({
        parentId: p.parent_id,
        title: p.title ?? '부모님',
        shared: !!p.shared,
        items: (p.answers ?? []).map((a: Record<string, any>) => ({
          answeredDate: a.answered_date,
          optionA: a.option_a,
          optionB: a.option_b,
          choiceLabel: a.choice_label,
        })),
      }));
    },
    // TODO(서버 0020): send_cheer 반환 형태를 dev-server-notes.md 와 맞춘다(가정: dev-app-child-contract.md §3)
    async sendCheer(key): Promise<SendCheerResult> {
      const {data, error} = await sb.rpc('send_cheer', {p_message_key: key});
      if (error) fail('send_cheer', error);
      return data.ok ? {ok: true, sentTo: Number(data.sent_to ?? 1)} : {ok: false, reason: data.reason};
    },
    async getLoginMethod(): Promise<LoginMethod | null> {
      const {data, error} = await sb.auth.getSession();
      if (error) fail('세션 확인', error);
      const p = data.session?.user.app_metadata?.provider;
      return p === 'kakao' || p === 'google' || p === 'email' ? p : null;
    },
    async signOut() {
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
      if (error) fail('로그아웃', error);
    },
    async withdrawConsent() {
      const {error} = await sb.rpc('withdraw_consent');
      if (error) fail('withdraw_consent', error);
    },
  };
}
