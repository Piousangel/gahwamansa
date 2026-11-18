// Edge Function push-daily: pg_cron(0033 push_daily_kick) → 여기 → FCM. JWT 검증 대신 x-cron-secret 헤더로만 연다(config.toml verify_jwt=false).
// secrets(환경마다, 사용자): PUSH_CRON_SECRET(Vault push_cron_secret과 같은 값), FCM_SERVICE_ACCOUNT(서비스 계정 JSON 전체),
//   선택 PUSH_DRY_RUN=1(보내지 않고 대상 수만). PUSH_CRON_SECRET은 32자 이상 무작위. SUPABASE_URL·SUPABASE_SECRET_KEYS(새 키)·SUPABASE_SERVICE_ROLE_KEY(옛 키)는 런타임이 넣어 준다.
// 로그에 토큰·개인 id를 찍지 않는다(요약 숫자만).
import { runDaily, safeEqual, type ServiceAccount } from '../_shared/push.mts';
import { makeRpc, pickServiceKey, serviceKeyLog } from '../_shared/service.mts';

const env = (k: string) => Deno.env.get(k) ?? '';

// 서버 키: 새 secret 키(SUPABASE_SECRET_KEYS, 이름 edge→default) 우선, 없으면 옛 서비스 키 폴백(보안 회의 D9·E2). 키 값은 로그에 남기지 않는다.
const serviceKey = pickServiceKey((k) => Deno.env.get(k) ?? undefined);
console.log(serviceKeyLog((k) => Deno.env.get(k) ?? undefined, serviceKey)); // 값 없이 종류·키 이름만(리뷰 L3 staging 확인)
const rpc = serviceKey
  ? makeRpc(env('SUPABASE_URL'), serviceKey)
  : async (): Promise<unknown> => {
      throw new Error('service_key_missing');
    };

// 서비스 계정: 없으면 null(dry-run). 형식이 틀리면 오류 — JSON.parse 메시지에는 입력 조각(개인키 일부)이 들어가므로 로그에 원문을 남기지 않는다(L8).
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
    const summary = await runDaily({ rpc, serviceAccount: serviceAccount(), dryRun: env('PUSH_DRY_RUN') === '1', fetchFn: fetch });
    console.log(JSON.stringify({ fn: 'push-daily', ...summary }));
    return Response.json(summary);
  } catch (e) {
    // 알려진 오류 이름만 남긴다(원문 메시지에 비밀 조각이 섞일 수 있음)
    const msg = e instanceof ServiceAccountInvalid ? 'service_account_invalid' : String((e as Error).message ?? e).slice(0, 80).replace(/[^a-z0-9_:.-]/gi, '_');
    console.error(JSON.stringify({ fn: 'push-daily', error: msg }));
    return new Response('error', { status: 500 });
  }
});
