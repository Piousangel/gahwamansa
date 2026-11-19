// 개발자 메뉴 '오늘 코스 다시 하기(테스트 가족만)' — 실제 서버(staging·local) 전용. production 번들에서는 DevMenuHost 가 stub 이라
// 이 파일도 빠진다. 서버 RPC dev_reset_today(0051, dev-server-notes §2): 스위치가 켜진 DB 의 테스터 가족 어르신만, 본인 오늘 기록만 지운다.
// 거절은 {ok:false, reason}(disabled·not_test_family), 역할 위반은 예외 parent_required. 그 밖 오류는 'failed'(내용은 보여 주지 않는다).
export type DevResetReason = 'disabled' | 'not_test_family' | 'parent_required' | 'not_linked' | 'signed_out' | 'failed';
export type DevResetResult = {ok: true; sessions: number; answers: number} | {ok: false; reason: DevResetReason};

type RpcError = {code?: string; message?: string} | null;
export type DevResetRpc = (name: 'dev_reset_today') => PromiseLike<{data: unknown; error: RpcError}>;

export async function devResetToday(rpc: DevResetRpc): Promise<DevResetResult> {
  let res: {data: unknown; error: RpcError};
  try {
    res = await rpc('dev_reset_today');
  } catch {
    return {ok: false, reason: 'failed'};
  }
  const {data, error} = res;
  if (error) {
    return {ok: false, reason: error.code === 'P0001' && error.message === 'parent_required' ? 'parent_required' : 'failed'};
  }
  const d = (data ?? {}) as {ok?: unknown; reason?: unknown; sessions?: unknown; answers?: unknown};
  if (d.ok === true) {
    return {ok: true, sessions: Number(d.sessions) || 0, answers: Number(d.answers) || 0};
  }
  return {ok: false, reason: d.reason === 'disabled' || d.reason === 'not_test_family' ? d.reason : 'failed'};
}

/**
 * 부르기 전 원인 가리기(PR #70 리뷰 L2): 세션이 없으면 signed_out, 연결 전 기기(프로필 없음)면 not_linked, 자녀면 parent_required.
 * 서버도 같은 경우를 parent_required·권한 오류로 막지만, 원인을 한 줄로 바로 알려 주려고 앱에서 먼저 본다.
 */
export async function devResetTodayChecked(d: {
  rpc: DevResetRpc;
  hasSession: () => Promise<boolean>;
  whoAmI: () => Promise<'parent' | 'child' | 'none'>;
}): Promise<DevResetResult> {
  try {
    if (!(await d.hasSession())) {
      return {ok: false, reason: 'signed_out'};
    }
    const who = await d.whoAmI();
    if (who === 'none') {
      return {ok: false, reason: 'not_linked'};
    }
    if (who === 'child') {
      return {ok: false, reason: 'parent_required'};
    }
  } catch {
    return {ok: false, reason: 'failed'};
  }
  return devResetToday(d.rpc);
}

// 메뉴에 한 줄로 보이는 거절 사유(내부 도구라 copy.ko.json 에 두지 않는다)
export const DEV_RESET_REASON_TEXT: Record<DevResetReason, string> = {
  disabled: '이 서버는 다시 하기가 꺼져 있어요(disabled)',
  not_test_family: '테스트 가족만 다시 할 수 있어요(not_test_family)',
  parent_required: '어르신으로 전환한 뒤 눌러 주세요(parent_required)',
  not_linked: '연결 전 기기예요. 번호로 연결하거나 테스트 가족을 만든 뒤 눌러 주세요(not_linked)',
  signed_out: '로그인한 세션이 없어요. 테스트 가족을 만들거나 어르신으로 전환한 뒤 눌러 주세요(signed_out)',
  failed: '실패했어요',
};
