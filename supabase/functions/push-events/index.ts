// Edge Function push-events: pg_cron 5분(0038 push_events_kick — 창 안이고 보낼 것이 있을 때만) → 여기 → FCM.
// 응원 도착(N2, 어르신)·연결/재연결(N3, 자녀). x-cron-secret 헤더로만 연다(config.toml verify_jwt=false).
// secrets는 push-daily와 같다: PUSH_CRON_SECRET, FCM_SERVICE_ACCOUNT, 선택 PUSH_DRY_RUN=1. 로그에 토큰·개인 id를 찍지 않는다.
import { runEvents, safeEqual, type ServiceAccount } from '../_shared/push.mts';
import { makeRpc, pickServiceKey } from '../_shared/service.mts';

const env = (k: string) => Deno.env.get(k) ?? '';

// 서버 키: 새 secret 키(SUPABASE_SECRET_KEYS, 이름 edge→default) 우선, 없으면 옛 서비스 키 폴백(보안 회의 D9·E2). 키 값은 로그에 남기지 않는다.
const serviceKey = pickServiceKey((k) => Deno.env.get(k) ?? undefined);
const rpc = serviceKey
  ? makeRpc(env('SUPABASE_URL'), serviceKey)
  : async (): Promise<unknown> => {
      throw new Error('service_key_missing');
    };

class ServiceAccountInvalid extends Error {}
function serviceAccount(): ServiceAccount | null {
  const raw = env('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new ServiceAccountInvalid('service_account_invalid');
  }
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new ServiceAccountInvalid('service_account_invalid');
  return sa;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (!(await safeEqual(req.headers.get('x-cron-secret') ?? '', env('PUSH_CRON_SECRET')))) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const summary = await runEvents({ rpc, serviceAccount: serviceAccount(), dryRun: env('PUSH_DRY_RUN') === '1', fetchFn: fetch });
    console.log(JSON.stringify({ fn: 'push-events', ...summary }));
    return Response.json(summary);
  } catch (e) {
    const msg = e instanceof ServiceAccountInvalid ? 'service_account_invalid' : String((e as Error).message ?? e).slice(0, 80).replace(/[^a-z0-9_:.-]/gi, '_');
    console.error(JSON.stringify({ fn: 'push-events', error: msg }));
    return new Response('error', { status: 500 });
  }
});
