// push-daily 순수 로직(Deno·Node 공용: fetch·WebCrypto만 사용). 진입점은 index.ts, 테스트는 lib.test.mts(node --test).
// 계약: 0036 push_daily_claim()(선점)·push_record(…, p_note). FCM HTTP v1(https://firebase.google.com/docs/cloud-messaging/send/v1-api).
// 리뷰 반영(2026-11-18-push-tokens-review): M3 무효 토큰은 UNREGISTERED·message.token 오류만, 설정 오류는 즉시 중단·기록, L6 해시 비교.

export type Target = { profile_id: string; token: string; platform: string };
export type Copy = { title: string; body: string };
export type Targets = { window_open: boolean; copy: Copy | null; targets: Target[]; excluded: number };
export type Status = 'sent' | 'failed' | 'invalid_token';
export type Result = { profile_id: string; token: string; status: Status };
export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

/** 앱 알림 채널 id(AU-04 푸시 클라이언트가 같은 id로 채널을 만든다). */
export const ANDROID_CHANNEL_ID = 'daily';

/** FCM v1 메시지 본문. 데이터에는 종류만(개인정보·번호 없음). */
export function buildMessage(t: Target, copy: Copy, kind = 'daily') {
  return {
    message: {
      token: t.token,
      notification: { title: copy.title, body: copy.body },
      android: { priority: 'normal', notification: { channel_id: ANDROID_CHANNEL_ID } },
      data: { kind },
    },
  };
}

export type Verdict = Status | 'config_error';
type FcmErrorBody = { error?: { status?: string; details?: { errorCode?: string; fieldViolations?: { field?: string }[] }[] } } | null;

/**
 * FCM 오류 분류(M3). 토큰을 지우는 것은 확실할 때만:
 *  - invalid_token: errorCode UNREGISTERED, 또는 INVALID_ARGUMENT 이면서 fieldViolations가 message.token을 가리킬 때
 *  - config_error: 인증·권한·프로젝트·메시지 형식 문제(401·403, UNREGISTERED 없는 404, 토큰이 아닌 INVALID_ARGUMENT, SENDER_ID_MISMATCH 등) → 실행 중단
 *  - failed: 그 밖(429·5xx 등 일시 오류)
 */
export function classifyFcmError(status: number, body: unknown): Verdict {
  const err = (body as FcmErrorBody)?.error;
  const details = err?.details ?? [];
  const codes = [err?.status, ...details.map((d) => d.errorCode)];
  const tokenField = details.some((d) => (d.fieldViolations ?? []).some((f) => f.field === 'message.token'));
  if (codes.includes('UNREGISTERED')) return 'invalid_token';
  if (codes.includes('INVALID_ARGUMENT') && tokenField) return 'invalid_token';
  if (status === 401 || status === 403 || status === 404 || codes.includes('SENDER_ID_MISMATCH')
      || codes.includes('THIRD_PARTY_AUTH_ERROR') || codes.includes('INVALID_ARGUMENT') || status === 400) return 'config_error';
  return 'failed';
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/** 비밀값 비교(L6): 양쪽을 SHA-256으로 바꿔 길이·내용 모두 일정 시간에 비교. 빈 값은 거짓. 비밀값은 32자 이상 무작위로. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

/** 서비스 계정으로 OAuth2 액세스 토큰(JWT bearer grant, RS256)을 받는다. */
export async function getAccessToken(sa: ServiceAccount, fetchFn: typeof fetch, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  }));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`oauth_token_failed:${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('oauth_token_missing');
  return json.access_token;
}

/** 대상마다 FCM으로 보낸다(동시 최대 concurrency). 설정 오류가 한 번이라도 나면 남은 발송을 멈추고(aborted), 못 보낸 대상은 failed. */
export async function sendAll(targets: Target[], copy: Copy, opts: { projectId: string; accessToken: string; fetchFn: typeof fetch; concurrency?: number }): Promise<{ results: Result[]; aborted: boolean }> {
  const url = `https://fcm.googleapis.com/v1/projects/${opts.projectId}/messages:send`;
  const results: Result[] = targets.map((t) => ({ profile_id: t.profile_id, token: t.token, status: 'failed' as Status }));
  let next = 0;
  let aborted = false;
  const worker = async () => {
    while (next < targets.length && !aborted) {
      const i = next++;
      const t = targets[i];
      try {
        const res = await opts.fetchFn(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildMessage(t, copy)),
        });
        const v: Verdict = res.ok ? 'sent' : classifyFcmError(res.status, await res.json().catch(() => null));
        if (v === 'config_error') aborted = true;
        results[i].status = v === 'config_error' ? 'failed' : v;
      } catch {
        results[i].status = 'failed';
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 10, targets.length) }, worker));
  return { results, aborted };
}

export type RunDeps = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  serviceAccount: ServiceAccount | null; // 없으면 dry-run(보내지도 기록하지도 않음)
  dryRun?: boolean;
  fetchFn: typeof fetch;
};
export type RunSummary =
  | { status: 'window_closed' | 'no_copy' | 'no_targets'; excluded: number }
  | { status: 'dry_run'; targets: number; excluded: number }
  | { status: 'done' | 'config_error'; sent: number; failed: number; invalid: number; excluded: number; note?: string | null };

/**
 * 하루 한 번 실행. dry-run이면 미리보기(push_daily_targets, 선점 안 함)만, 실제 발송이면 push_daily_claim으로 선점(M4)한 뒤 보낸다.
 * 창 밖·문구 없음은 보내지 않는다. 인증 토큰 실패·설정 오류는 실행을 멈추고 선점분을 failed로 기록(note)한다.
 */
export async function runDaily(deps: RunDeps): Promise<RunSummary> {
  const live = !deps.dryRun && !!deps.serviceAccount;
  const t = (await deps.rpc(live ? 'push_daily_claim' : 'push_daily_targets', {})) as Targets;
  if (!t.window_open) return { status: 'window_closed', excluded: t.excluded };
  if (!t.copy) {
    if (live) await deps.rpc('push_record', { p_kind: 'daily', p_results: [], p_excluded: t.excluded, p_note: 'no_copy' });
    return { status: 'no_copy', excluded: t.excluded };
  }
  if (!live) return { status: 'dry_run', targets: t.targets.length, excluded: t.excluded };
  if (t.targets.length === 0) {
    await deps.rpc('push_record', { p_kind: 'daily', p_results: [], p_excluded: t.excluded });
    return { status: 'no_targets', excluded: t.excluded };
  }
  const sa = deps.serviceAccount as ServiceAccount;
  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa, deps.fetchFn);
  } catch {
    const failed = t.targets.map((x) => ({ profile_id: x.profile_id, token: x.token, status: 'failed' as Status }));
    const rec = (await deps.rpc('push_record', { p_kind: 'daily', p_results: failed, p_excluded: t.excluded, p_note: 'oauth_failed' })) as { sent: number; failed: number; invalid: number; note?: string };
    return { status: 'config_error', ...rec, excluded: t.excluded };
  }
  const { results, aborted } = await sendAll(t.targets, t.copy, { projectId: sa.project_id, accessToken, fetchFn: deps.fetchFn });
  const rec = (await deps.rpc('push_record', { p_kind: 'daily', p_results: results, p_excluded: t.excluded, p_note: aborted ? 'config_error' : null })) as { sent: number; failed: number; invalid: number; note?: string };
  return { status: aborted ? 'config_error' : 'done', ...rec, excluded: t.excluded };
}
