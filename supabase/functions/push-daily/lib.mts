// push-daily 순수 로직(Deno·Node 공용: fetch·WebCrypto만 사용). 진입점은 index.ts, 테스트는 lib.test.mts(node --test).
// 계약: 0033 push_daily_targets()·push_record(). FCM HTTP v1(https://firebase.google.com/docs/cloud-messaging/send/v1-api).

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

/** FCM 오류를 무효 토큰(지울 것)과 일시 실패로 나눈다. */
export function classifyFcmError(status: number, body: unknown): Status {
  const err = (body as { error?: { status?: string; details?: { errorCode?: string }[] } } | null)?.error;
  const codes = [err?.status, ...(err?.details ?? []).map((d) => d.errorCode)];
  if (status === 404 || codes.includes('UNREGISTERED')) return 'invalid_token';
  if (status === 400 && codes.includes('INVALID_ARGUMENT')) return 'invalid_token';
  return 'failed';
}

/** 길이가 같은 문자열 비교(시간 일정). cron 비밀값 확인용. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

/** 대상마다 FCM으로 보낸다(동시 최대 concurrency). 네트워크 예외는 failed. */
export async function sendAll(targets: Target[], copy: Copy, opts: { projectId: string; accessToken: string; fetchFn: typeof fetch; concurrency?: number }): Promise<Result[]> {
  const url = `https://fcm.googleapis.com/v1/projects/${opts.projectId}/messages:send`;
  const results: Result[] = new Array(targets.length);
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const i = next++;
      const t = targets[i];
      let status: Status = 'failed';
      try {
        const res = await opts.fetchFn(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildMessage(t, copy)),
        });
        status = res.ok ? 'sent' : classifyFcmError(res.status, await res.json().catch(() => null));
      } catch {
        status = 'failed';
      }
      results[i] = { profile_id: t.profile_id, token: t.token, status };
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 10, targets.length) }, worker));
  return results;
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
  | { status: 'done'; sent: number; failed: number; invalid: number; excluded: number };

/** 하루 한 번 실행: 대상 조회 → (창 밖·문구 없음·대상 없음이면 기록만) → 발송 → 결과 기록. */
export async function runDaily(deps: RunDeps): Promise<RunSummary> {
  const t = (await deps.rpc('push_daily_targets', {})) as Targets;
  if (!t.window_open) return { status: 'window_closed', excluded: t.excluded };
  if (!t.copy) {
    await deps.rpc('push_record', { p_kind: 'daily', p_results: [], p_excluded: t.excluded });
    return { status: 'no_copy', excluded: t.excluded };
  }
  if (t.targets.length === 0) {
    await deps.rpc('push_record', { p_kind: 'daily', p_results: [], p_excluded: t.excluded });
    return { status: 'no_targets', excluded: t.excluded };
  }
  if (deps.dryRun || !deps.serviceAccount) return { status: 'dry_run', targets: t.targets.length, excluded: t.excluded };
  const accessToken = await getAccessToken(deps.serviceAccount, deps.fetchFn);
  const results = await sendAll(t.targets, t.copy, { projectId: deps.serviceAccount.project_id, accessToken, fetchFn: deps.fetchFn });
  const rec = (await deps.rpc('push_record', { p_kind: 'daily', p_results: results, p_excluded: t.excluded })) as { sent: number; failed: number; invalid: number };
  return { status: 'done', ...rec, excluded: t.excluded };
}
