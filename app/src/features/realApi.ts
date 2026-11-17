import type {SupabaseClient} from '@supabase/supabase-js';
import {OfflineError, ServerError} from './types';
import type {
  Api, ChildSummary, CreateFamilyResult, RecordStepResult, RedeemResult, StepName, TodayContent,
} from './types';

export interface RealApi extends Api {
  // 로컬 테스트용 이메일 가입(실제 자녀 로그인은 카카오로 대체 예정)
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
export function createRealApi(sb: SupabaseClient): RealApi {
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
      // 서버는 앱 데이터만 지운다. 인증 계정은 남으므로 이 기기의 세션을 끊는다(실패해도 데이터는 이미 지워짐).
      try {
        await sb.auth.signOut();
      } catch {
        // 무시
      }
      return {scope: data.scope};
    },
    async restoreSession() {
      const {data, error} = await sb.auth.getSession();
      if (error) fail('세션 확인', error);
      if (!data.session) return 'unlinked';
      const {data: p, error: pe} = await sb
        .from('profiles')
        .select('id')
        .eq('user_id', data.session.user.id)
        .eq('role', 'parent')
        .maybeSingle();
      if (pe) fail('프로필 조회', pe);
      return p ? 'linked' : 'unlinked';
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
      const first = (data.parents ?? [])[0];
      const l = first?.latest;
      return {
        parentTitle: data.parent_title ?? '부모님',
        shared: first ? !!first.shared : true, // 어르신이 아직 없으면 "나누지 않는 중"이라 하지 않는다
        latest: l ? {prompt: l.prompt ?? null, choiceLabel: l.choice_label, answeredDate: l.answered_date} : null,
      };
    },
    async setParentTitle(title) {
      const {data, error} = await sb.rpc('set_parent_title', {p_title: title});
      if (error) fail('set_parent_title', error);
      return data.ok ? {ok: true} : {ok: false, reason: 'invalid_title'};
    },
    async withdrawConsent() {
      const {error} = await sb.rpc('withdraw_consent');
      if (error) fail('withdraw_consent', error);
    },
  };
}
