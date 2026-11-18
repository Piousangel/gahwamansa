// Edge Function push-daily: pg_cron(0033 push_daily_kick) → 여기 → FCM. JWT 검증 대신 x-cron-secret 헤더로만 연다(config.toml verify_jwt=false).
// secrets(환경마다, 사용자): PUSH_CRON_SECRET(Vault push_cron_secret과 같은 값), FCM_SERVICE_ACCOUNT(서비스 계정 JSON 전체),
//   선택 PUSH_DRY_RUN=1(보내지 않고 대상 수만). SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY는 런타임이 넣어 준다.
// 로그에 토큰·개인 id를 찍지 않는다(요약 숫자만).
import { runDaily, safeEqual, type ServiceAccount } from './lib.mts';

const env = (k: string) => Deno.env.get(k) ?? '';

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc_failed:${name}:${res.status}`);
  return res.json();
}

function serviceAccount(): ServiceAccount | null {
  const raw = env('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  const sa = JSON.parse(raw) as ServiceAccount;
  return sa.client_email && sa.private_key && sa.project_id ? sa : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', env('PUSH_CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const summary = await runDaily({ rpc, serviceAccount: serviceAccount(), dryRun: env('PUSH_DRY_RUN') === '1', fetchFn: fetch });
    console.log(JSON.stringify({ fn: 'push-daily', ...summary }));
    return Response.json(summary);
  } catch (e) {
    console.error(JSON.stringify({ fn: 'push-daily', error: String((e as Error).message ?? e) }));
    return new Response('error', { status: 500 });
  }
});
