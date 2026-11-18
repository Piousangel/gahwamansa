// 카카오 연결 해제 공용 로직(0042, 로드맵 SV-06). 진입점 kakao-unlink/index.ts, 테스트 kakao.test.mts(node --test).
// 카카오 문서: 앱 어드민 키로 "연결 끊기" — POST https://kapi.kakao.com/v1/user/unlink, Authorization: KakaoAK {ADMIN_KEY},
//   본문 target_id_type=user_id&target_id={회원번호}. 이미 끊겼거나 앱 사용자가 아니면(-101 등) 다시 시도해도 소용없으므로 done으로 본다.

export type QueueItem = { id: number; kakao_user_id: string };
export type UnlinkResult = { id: number; status: 'done' | 'retry'; http?: number };

/** 응답을 done(지울 것)·retry(다시)·config(어드민 키 문제 — 사용자와 무관, 회차 중단)로 나눈다. 회원번호·키는 결과에 담지 않는다. */
export function classifyUnlink(status: number, body: unknown): 'done' | 'retry' | 'config' {
  if (status >= 200 && status < 300) return 'done';
  const code = (body as { code?: number } | null)?.code;
  // -101: 앱과 연결되지 않은 사용자(이미 해제됨), -103: 휴면·없는 계정 → 재시도 불필요
  if (code === -101 || code === -103) return 'done';
  // 0044 R-M1: 401·403·-401(앱 키 오류)은 키 문제 → 시도 횟수를 쓰지 않고 회차 중단
  if (status === 401 || status === 403 || code === -401) return 'config';
  return 'retry';
}

export type UnlinkOutcome = { results: UnlinkResult[]; config?: { ids: number[]; http: number } };

/** 큐 항목마다 연결 끊기 요청. 네트워크 예외는 retry. 키 오류(config)를 만나면 멈추고 그 항목부터 못 한 것을 config에 담는다. */
export async function unlinkAll(items: QueueItem[], adminKey: string, fetchFn: typeof fetch): Promise<UnlinkOutcome> {
  const out: UnlinkResult[] = [];
  for (const [i, it] of items.entries()) {
    try {
      const res = await fetchFn('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: { Authorization: `KakaoAK ${adminKey}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: it.kakao_user_id }),
      });
      const status = classifyUnlink(res.status, await res.json().catch(() => null));
      if (status === 'config') return { results: out, config: { ids: items.slice(i).map((x) => x.id), http: res.status } };
      out.push(status === 'done' ? { id: it.id, status } : { id: it.id, status, http: res.status });
    } catch {
      out.push({ id: it.id, status: 'retry', http: 0 });
    }
  }
  return { results: out };
}

export type UnlinkDeps = { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>; adminKey: string; fetchFn: typeof fetch };

/** 선점 → 해제 요청 → 결과 기록. Admin 키가 없으면 선점하지 않는다(시도 횟수를 헛되이 쓰지 않게). */
export async function runUnlink(deps: UnlinkDeps): Promise<
  { status: 'not_configured' } | { status: 'done' | 'config_error'; done: number; retry: number; gave_up: number; released?: number }
> {
  if (!deps.adminKey) return { status: 'not_configured' };
  const items = (await deps.rpc('kakao_unlink_claim', { p_limit: 50 })) as QueueItem[];
  if (items.length === 0) return { status: 'done', done: 0, retry: 0, gave_up: 0 };
  const { results, config } = await unlinkAll(items, deps.adminKey, deps.fetchFn);
  const rec = results.length
    ? ((await deps.rpc('kakao_unlink_record', { p_results: results })) as { done: number; retry: number; gave_up: number })
    : { done: 0, retry: 0, gave_up: 0 };
  if (config) {
    // 키 문제: 못 한 것은 선점을 풀어 시도 횟수를 돌려놓고 1시간 뒤 다시(포기로 가지 않게), 실행 기록에 config_error
    const rel = (await deps.rpc('kakao_unlink_release', { p_ids: config.ids, p_http: config.http })) as { released: number };
    return { status: 'config_error', ...rec, released: rel.released };
  }
  return { status: 'done', ...rec };
}
