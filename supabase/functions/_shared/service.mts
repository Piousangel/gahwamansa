// Edge Function 공용: 서버(서비스) 키 고르기·RPC 호출(보안 회의 D9·E2). Deno·Node 공용, 테스트 service.test.mts(node --test).
// 새 API 키: 런타임이 SUPABASE_SECRET_KEYS(JSON {이름: "sb_secret_…"})를 넣어 준다. 이름 "edge"가 있으면 그것, 없으면 "default", 없으면 첫 값.
//   새 secret 키는 JWT가 아니라 apikey 헤더로만 보낸다(Authorization Bearer에 넣지 않음).
// 옛 키(legacy, 2026년 말 폐기): SUPABASE_SERVICE_ROLE_KEY(JWT) → apikey + Authorization Bearer. 새 키가 없을 때만 폴백.
// 키 값은 로그·응답에 절대 남기지 않는다.

export type ServiceKey = { kind: 'secret' | 'legacy'; headers: Record<string, string> };

export function pickServiceKey(get: (k: string) => string | undefined): ServiceKey | null {
  const raw = get('SUPABASE_SECRET_KEYS');
  if (raw) {
    let map: Record<string, string> = {};
    try {
      map = JSON.parse(raw) as Record<string, string>;
    } catch {
      map = {};
    }
    const key = map.edge ?? map.default ?? Object.values(map)[0];
    if (key && key.startsWith('sb_secret_')) return { kind: 'secret', headers: { apikey: key } };
  }
  const legacy = get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return { kind: 'legacy', headers: { apikey: legacy, Authorization: `Bearer ${legacy}` } };
  return null;
}

/** PostgREST RPC 호출기. 실패는 이름·HTTP 상태만 담은 오류(키·본문 없음). */
export function makeRpc(baseUrl: string, key: ServiceKey, fetchFn: typeof fetch = fetch) {
  return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const res = await fetchFn(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ...key.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`rpc_failed:${name}:${res.status}`);
    return res.json();
  };
}
