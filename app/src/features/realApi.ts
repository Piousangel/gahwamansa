import type {SupabaseClient} from '@supabase/supabase-js';
import {OfflineError} from './types';
import type {
  Api, CreateFamilyResult, RecordStepResult, RedeemResult, StepName, TodayContent,
} from './types';

export interface RealApi extends Api {
  // 로컬 테스트용 이메일 가입(실제 자녀 로그인은 카카오로 대체 예정)
  signUpChild(email: string, password: string): Promise<void>;
}

const OFFLINE_RE = /network request failed|failed to fetch|fetch failed|timeout|timed out|offline|ECONN|ENOTFOUND/i;
type SbError = {message: string; code?: string; status?: number; name?: string};
const looksOffline = (e: SbError) =>
  OFFLINE_RE.test(e.message) || e.status === 0 || e.name === 'AuthRetryableFetchError';

function fail(what: string, error: SbError): never {
  const e = looksOffline(error)
    ? new OfflineError(`${what}: ${error.message}`)
    : new Error(`${what}: ${error.message}`);
  (e as Error & {code?: string}).code = error.code;
  throw e;
}

// 서버 RPC/테이블을 그대로 감싼 구현. reason 같은 도메인 실패는 throw 하지 않고 반환값으로 돌려준다.
export function createRealApi(sb: SupabaseClient): RealApi {
  const myUid = async (): Promise<string> => {
    const {data, error} = await sb.auth.getSession();
    if (error) fail('세션 확인', error);
    const id = data.session?.user.id;
    if (!id) throw new Error('로그인 세션이 없어요');
    return id;
  };
  const myProfile = async () => {
    const uid = await myUid();
    const {data, error} = await sb
      .from('profiles')
      .select('id, family_id, role')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) fail('profiles 조회', error);
    if (!data) throw new Error('연결된 프로필이 없어요');
    return data as {id: string; family_id: string; role: 'parent' | 'child'};
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
      const {data: s, error: se} = await sb.auth.getSession();
      // 세션을 못 읽은 것과 세션이 없는 것은 다르다. 못 읽었으면 새 익명 사용자를 만들지 않는다.
      if (se) throw new OfflineError(`세션 확인: ${se.message}`);
      if (!s.session) {
        const {error: e} = await sb.auth.signInAnonymously();
        if (e) fail('익명 로그인', e);
      }
      const {data, error} = await sb.rpc('redeem_invite_code', {p_code: code});
      if (error) fail('redeem_invite_code', error);
      return data as RedeemResult;
    },
    async giveConsent() {
      const {error} = await sb.rpc('give_consent');
      if (error) fail('give_consent', error);
    },
    async getTodayContent(): Promise<TodayContent | null> {
      const {data, error} = await sb.rpc('get_today_content');
      if (error) fail('get_today_content', error);
      return (data ?? null) as TodayContent | null;
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
    async fetchChildHome() {
      const me = await myProfile();
      // 서로 의존하지 않는 조회는 병렬로
      const [todayRes, parentRes] = await Promise.all([
        sb.rpc('kst_today'),
        sb.from('profiles').select('id').eq('family_id', me.family_id).eq('role', 'parent').limit(1).maybeSingle(),
      ]);
      if (todayRes.error) fail('kst_today', todayRes.error);
      if (parentRes.error) fail('어르신 조회', parentRes.error);
      const parent = parentRes.data;
      if (!parent) return {participatedToday: false, streak: 0};
      const [rowRes, streakRes] = await Promise.all([
        sb.from('daily_sessions').select('completed_at').eq('parent_id', parent.id).eq('session_date', todayRes.data).maybeSingle(),
        sb.rpc('parent_streak', {p_parent: parent.id}),
      ]);
      if (rowRes.error) fail('세션 조회', rowRes.error);
      if (streakRes.error) fail('parent_streak', streakRes.error);
      return {participatedToday: !!rowRes.data?.completed_at, streak: Number(streakRes.data ?? 0)};
    },
  };
}
