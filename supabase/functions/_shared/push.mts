// 푸시 공용 로직(Deno·Node 공용: fetch·WebCrypto만 사용). 진입점 push-daily/index.ts·push-events/index.ts, 테스트 push.test.mts(node --test).
// 0038부터 서버가 대상마다 kind·channel·title·body(자리값 채운 확정 문구)를 준다. copy는 일일 알림의 '문구 있음' 판단용.
// 계약: 0036 push_daily_claim()(선점)·push_record(…, p_note). FCM HTTP v1(https://firebase.google.com/docs/cloud-messaging/send/v1-api).
// 리뷰 반영(2026-11-18-push-tokens-review): M3 무효 토큰은 UNREGISTERED·message.token 오류만, 설정 오류는 즉시 중단·기록, L6 해시 비교.

export type Kind = 'daily' | 'cheer_arrived' | 'parent_connected' | 'parent_reconnected';
export type Target = { profile_id: string; token: string; platform: string; kind?: Kind; channel?: string; title?: string; body?: string | null };
export type Copy = { title: string; body: string };
export type Targets = { window_open: boolean; copy: Copy | null; targets: Target[]; excluded: number };
export type Status = 'sent' | 'failed' | 'invalid_token';
export type Result = { profile_id: string; token: string; status: Status; kind?: Kind };
export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

/** 앱 알림 채널 id(AU-04가 같은 id로 만든다): daily·cheer·family. 서버가 대상마다 channel을 주고, 없으면 daily. */
export const ANDROID_CHANNEL_ID = 'daily';

/** FCM v1 메시지 본문. 대상의 채운 문구(없으면 copy)·채널·종류만(개인 id·번호 없음). 본문이 비면 제목만. */
export function buildMessage(t: Target, copy: Copy | null, kind: Kind = 'daily') {
  const title = t.title ?? copy?.title ?? '';
  const body = t.body === undefined ? copy?.body : t.body ?? undefined;
  return {
    message: {
      token: t.token,
      notification: body ? { title, body } : { title },
      android: { priority: 'normal', notification: { channel_id: t.channel ?? ANDROID_CHANNEL_ID } },
      data: { kind: t.kind ?? kind },
    },
  };
}

export type Verdict = Status | 'config_error';
type FcmErrorBody = { error?: { status?: string; details?: { errorCode?: string; fieldViolations?: { field?: string }[] }[] } } | null;

/**
 * FCM 오류 분류(M3 + 재검토 R-M1). 토큰 단위 오류와 실행 전체 설정 오류를 나눈다.
 *  - invalid_token(그 토큰 삭제): UNREGISTERED, SENDER_ID_MISMATCH(다른 Firebase 프로젝트의 토큰), message.token 필드 오류
 *  - failed(그 토큰만 실패, 삭제 안 함): 필드가 없거나 토큰이 아닌 INVALID_ARGUMENT·400, 429·5xx 같은 일시 오류
 *  - config_error(토큰과 무관): 401, SENDER_ID_MISMATCH가 아닌 403(PERMISSION_DENIED·THIRD_PARTY_AUTH_ERROR), UNREGISTERED 없는 404(프로젝트 오기)
 * 실행 중단은 config_error가 **서로 다른 토큰 3개 이상**에서 날 때만(sendAll) — 토큰 한 개로 그날 알림 전체를 막지 못하게.
 */
export function classifyFcmError(status: number, body: unknown): Verdict {
  const err = (body as FcmErrorBody)?.error;
  const details = err?.details ?? [];
  const codes = [err?.status, ...details.map((d) => d.errorCode)];
  const tokenField = details.some((d) => (d.fieldViolations ?? []).some((f) => f.field === 'message.token'));
  if (codes.includes('UNREGISTERED') || codes.includes('SENDER_ID_MISMATCH')) return 'invalid_token';
  if (codes.includes('INVALID_ARGUMENT') && tokenField) return 'invalid_token';
  if (status === 401 || status === 403 || status === 404) return 'config_error';
  return 'failed';
}

/** 실행을 멈추는 설정 오류 토큰 수(서로 다른 토큰 기준). */
export const CONFIG_ERROR_ABORT_AT = 3;

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

/** 대상마다 FCM으로 보낸다(동시 최대 concurrency). 설정 오류가 서로 다른 토큰 3개에서 나면 남은 발송을 멈추고(aborted), 못 보낸 대상은 failed. */
export async function sendAll(targets: Target[], copy: Copy | null, opts: { projectId: string; accessToken: string; fetchFn: typeof fetch; concurrency?: number }): Promise<{ results: Result[]; aborted: boolean }> {
  const url = `https://fcm.googleapis.com/v1/projects/${opts.projectId}/messages:send`;
  const results: Result[] = targets.map((t) => ({ profile_id: t.profile_id, token: t.token, status: 'failed' as Status, ...(t.kind ? { kind: t.kind } : {}) }));
  let next = 0;
  let aborted = false;
  const configTokens = new Set<string>();
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
        if (v === 'config_error') {
          configTokens.add(t.token);
          if (configTokens.size >= CONFIG_ERROR_ABORT_AT) aborted = true;
        }
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

export type EventsSummary =
  | { status: 'window_closed' | 'no_targets' | 'dry_run' }
  | { status: 'done' | 'config_error'; sent: number; failed: number; invalid: number; note?: string | null };

/**
 * 응원 도착(N2)·연결/재연결(N3) 실행(0038 push_events_claim). 선점(=처리 표시)은 서버가 하므로 dry-run이면 아무것도 부르지 않는다.
 * 결과는 종류별로 push_record에 남긴다. 설정 오류·OAuth 실패 처리는 일일 알림과 같다.
 */
export async function runEvents(deps: RunDeps): Promise<EventsSummary> {
  if (deps.dryRun || !deps.serviceAccount) return { status: 'dry_run' };
  const t = (await deps.rpc('push_events_claim', {})) as { window_open: boolean; targets: Target[] };
  if (!t.window_open) return { status: 'window_closed' };
  if (t.targets.length === 0) return { status: 'no_targets' };
  const sa = deps.serviceAccount;
  let results: Result[];
  let note: string | null = null;
  try {
    const accessToken = await getAccessToken(sa, deps.fetchFn);
    const sent = await sendAll(t.targets, null, { projectId: sa.project_id, accessToken, fetchFn: deps.fetchFn });
    results = sent.results;
    if (sent.aborted) note = 'config_error';
  } catch {
    results = t.targets.map((x) => ({ profile_id: x.profile_id, token: x.token, status: 'failed' as Status, kind: x.kind }));
    note = 'oauth_failed';
  }
  const total = { sent: 0, failed: 0, invalid: 0 };
  const kinds = [...new Set(results.map((r) => r.kind ?? 'daily'))];
  for (const kind of kinds) {
    const part = results.filter((r) => (r.kind ?? 'daily') === kind).map(({ profile_id, token, status }) => ({ profile_id, token, status }));
    const rec = (await deps.rpc('push_record', { p_kind: kind, p_results: part, p_excluded: 0, p_note: note })) as { sent: number; failed: number; invalid: number };
    total.sent += rec.sent;
    total.failed += rec.failed;
    total.invalid += rec.invalid;
  }
  return { status: note ? 'config_error' : 'done', ...total, note };
}
