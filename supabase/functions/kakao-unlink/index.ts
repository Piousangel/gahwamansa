// Edge Function kakao-unlink: pg_cron 10분(0042 kakao_unlink_kick — 대기 중인 것이 있을 때만) → 여기 → 카카오 연결 끊기.
// x-cron-secret 헤더로만 연다(config.toml verify_jwt=false). secrets: PUSH_CRON_SECRET(공용 cron 비밀), KAKAO_ADMIN_KEY(카카오 앱 어드민 키, US-12).
// 로그에 회원번호·키를 찍지 않는다(요약 숫자만).
import { safeEqual } from '../_shared/push.mts';
import { makeRpc, pickServiceKey } from '../_shared/service.mts';
import { runUnlink } from '../_shared/kakao.mts';

const env = (k: string) => Deno.env.get(k) ?? '';

// 서버 키: 새 secret 키(SUPABASE_SECRET_KEYS, 이름 edge→default) 우선, 없으면 옛 서비스 키 폴백(보안 회의 D9·E2). 키 값은 로그에 남기지 않는다.
const serviceKey = pickServiceKey((k) => Deno.env.get(k) ?? undefined);
const rpc = serviceKey
  ? makeRpc(env('SUPABASE_URL'), serviceKey)
  : async (): Promise<unknown> => {
      throw new Error('service_key_missing');
    };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (!(await safeEqual(req.headers.get('x-cron-secret') ?? '', env('PUSH_CRON_SECRET')))) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const summary = await runUnlink({ rpc, adminKey: env('KAKAO_ADMIN_KEY'), fetchFn: fetch });
    console.log(JSON.stringify({ fn: 'kakao-unlink', ...summary }));
    return Response.json(summary);
  } catch (e) {
    console.error(JSON.stringify({ fn: 'kakao-unlink', error: String((e as Error).message ?? e).slice(0, 80).replace(/[^a-z0-9_:.-]/gi, '_') }));
    return new Response('error', { status: 500 });
  }
});
