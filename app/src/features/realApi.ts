import type {SupabaseClient} from '@supabase/supabase-js';
import type {
  Api, CreateFamilyResult, RecordStepResult, RedeemResult, StepName, TodayContent,
} from './types';

export interface RealApi extends Api {
  // 로컬 테스트용 이메일 가입(실제 자녀 로그인은 카카오로 대체 예정)
  signUpChild(email: string, password: string): Promise<void>;
}

function fail(what: string, error: {message: string; code?: string}): never {
  const e = new Error(`${what}: ${error.message}`);
  (e as Error & {code?: string}).code = error.code;
  throw e;
}

// 서버 RPC/테이블을 그대로 감싼 구현. reason 같은 도메인 실패는 throw 하지 않고 반환값으로 돌려준다.
export function createRealApi(sb: SupabaseClient): RealApi {
  const myUid = async (): Promise<string> => {
    const {data} = await sb.auth.getSession();
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
      const {data: s} = await sb.auth.getSession();
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
      return {completed: !!data.completed, streak: Number(data.streak ?? 0)};
    },
    async fetchChildHome() {
      const me = await myProfile();
      const {data: today, error: te} = await sb.rpc('kst_today');
      if (te) fail('kst_today', te);
      const {data: parent, error: pe} = await sb
        .from('profiles')
        .select('id')
        .eq('family_id', me.family_id)
        .eq('role', 'parent')
        .limit(1)
        .maybeSingle();
      if (pe) fail('어르신 조회', pe);
      if (!parent) return {participatedToday: false, streak: 0};
      const {data: row, error: se} = await sb
        .from('daily_sessions')
        .select('completed_at')
        .eq('parent_id', parent.id)
        .eq('session_date', today)
        .maybeSingle();
      if (se) fail('세션 조회', se);
      const {data: streak, error: ste} = await sb.rpc('parent_streak', {p_parent: parent.id});
      if (ste) fail('parent_streak', ste);
      return {participatedToday: !!row?.completed_at, streak: Number(streak ?? 0)};
    },
  };
}
