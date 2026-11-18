// Edge Function 공용: 서버(서비스) 키 고르기·RPC 호출(보안 회의 D9·E2). Deno·Node 공용, 테스트 service.test.mts(node --test).
// 새 API 키: 런타임이 SUPABASE_SECRET_KEYS(JSON {이름: "sb_secret_…"})를 넣어 준다. 이름 "edge"가 있으면 그것, 없으면 "default"만 쓴다.
//   다른 이름의 값(예: ops용 키)으로 내려가지 않는다(D9·D10 키 분리, 리뷰 L3). 둘 다 쓸 수 없으면 옛 키로 폴백.
//   JSON이 깨졌거나 객체가 아니거나 값이 문자열이 아니어도 모듈이 죽지 않고 폴백한다(리뷰 L2).
//   새 secret 키는 JWT가 아니라 apikey 헤더로만 보낸다(Authorization Bearer에 넣지 않음).
// 옛 키(legacy, 2026년 말 폐기): SUPABASE_SERVICE_ROLE_KEY(JWT) → apikey + Authorization Bearer. 새 키가 없을 때만 폴백.
// 키 값은 로그·응답에 절대 남기지 않는다. 기동 로그에는 serviceKeyLog(종류·이름·런타임이 준 키 이름 목록)만.

export type ServiceKey = { kind: 'secret' | 'legacy'; name: string; headers: Record<string, string> };

function secretMap(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function pickServiceKey(get: (k: string) => string | undefined): ServiceKey | null {
  const map = secretMap(get('SUPABASE_SECRET_KEYS'));
  for (const name of ['edge', 'default']) {
    const key = map[name];
    if (typeof key === 'string' && key.startsWith('sb_secret_')) return { kind: 'secret', name, headers: { apikey: key } };
  }
  const legacy = get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return { kind: 'legacy', name: 'service_role', headers: { apikey: legacy, Authorization: `Bearer ${legacy}` } };
  return null;
}

/** 기동 로그 한 줄(값 없음): 어떤 키를 골랐는지와 런타임이 넣어 준 secret 키 이름 목록(staging에서 "edge" 이름 확인용, 리뷰 L3) */
export function serviceKeyLog(get: (k: string) => string | undefined, key: ServiceKey | null): string {
  const names = Object.keys(secretMap(get('SUPABASE_SECRET_KEYS'))).sort().join(',') || '-';
  return `service_key=${key ? `${key.kind}:${key.name}` : 'none'} secret_key_names=${names}`;
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
