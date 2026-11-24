// load-push-copy.mjs 의 순수 로직(시험용, #244 QA-1 M2·QA-3 M1).
// - 응원 키 정본은 app/src/api/contract/cheers.ts CHEER_KEYS. .ts 를 import 하지 않고 글자로 읽는다(Node 22.11 에서도 돈다, QA L2/L4).
// - 적재하는 응원 문장은 법률 승인 키(cheer-legal-approved.mjs)만.
// - 쓰기 전에 대상 DB가 그 키를 받는지 확인한다(0060 cheer_key_ok, 없으면 0038 의 4키 check). 받지 않으면 아무것도 쓰지 않는다.
// - 적재 순서는 cheer_texts → push_copy. cheer_texts 가 실패하면 push_copy 를 쓰지 않는다
//   (cheer_texts 만 들어간 상태는 무해: push_copy cheer_arrived 문구가 없으면 응원 알림 자체를 보내지 않는다, 0052).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/** 0038 check 가 받던 키(0060 없는 DB 가 받는 전부) */
export const PRE_0060_CHEER_KEYS = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'];

/** cheers.ts 원문에서 CHEER_KEYS 배열을 읽는다. 모양이 바뀌어 못 읽으면 예외(조용히 빈 목록 금지). */
export function parseCheerKeys(tsSource) {
  const m = /export\s+const\s+CHEER_KEYS\s*=\s*\[([\s\S]*?)\]\s*as\s+const\s*;/.exec(tsSource);
  if (!m) throw new Error('cheers.ts 에서 `export const CHEER_KEYS = [...] as const;` 를 찾지 못했어요');
  const body = m[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const keys = [...body.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]);
  if (keys.length === 0 || keys.some((k) => !/^[a-z_]{1,32}$/.test(k))) throw new Error(`cheers.ts CHEER_KEYS 를 읽지 못했어요: ${JSON.stringify(keys)}`);
  return keys;
}

export function readContractCheerKeys(root) {
  return parseCheerKeys(readFileSync(join(root, 'app/src/api/contract/cheers.ts'), 'utf8'));
}

/** 응원 적재 계획: 문장 검사는 계약 키 전부(copy 건강 상태), 적재는 승인 키만. */
export function planCheers(copyCheers, contractKeys, approvedKeys) {
  const problems = [];
  for (const k of approvedKeys) if (!contractKeys.includes(k)) problems.push(`법률 승인 키 ${k}: 계약(CHEER_KEYS)에 없음`);
  for (const k of contractKeys) {
    const t = copyCheers?.[k];
    if (!t || t.length > 60) problems.push(`cheers.${k}: 없거나 60자 초과`);
  }
  // copy 에만 있고 계약에 없는 키는 서버 check(cheer_key_ok)가 거부한다
  for (const k of Object.keys(copyCheers ?? {})) if (!contractKeys.includes(k)) problems.push(`cheers.${k}: 계약(CHEER_KEYS)에 없는 키`);
  const cheers = approvedKeys.filter((k) => contractKeys.includes(k)).map((k) => ({message_key: k, text: copyCheers?.[k]}));
  const pending = contractKeys.filter((k) => !approvedKeys.includes(k));
  return {cheers, pending, problems};
}

/**
 * 대상 DB가 적재할 키를 받는지 확인(읽기만). rpc(name, body) → {status, body}.
 * 0060 이 있으면 cheer_key_ok 로 키마다 확인, 없으면(404) 0038 의 4키만 받는다고 본다.
 * 반환: {has0060, problems}
 */
export async function checkTargetAccepts(rpc, keys) {
  const problems = [];
  if (keys.length === 0) return {has0060: null, problems};
  const first = await rpc('cheer_key_ok', {p_key: keys[0]});
  if (first.status === 404) {
    const bad = keys.filter((k) => !PRE_0060_CHEER_KEYS.includes(k));
    if (bad.length) problems.push(`대상 DB에 0060(cheer_key_ok)이 없어 이 키를 받지 않아요: ${bad.join(', ')} — 0060 반영 뒤 다시`);
    return {has0060: false, problems};
  }
  if (first.status !== 200) {
    problems.push(`대상 DB 확인 실패(cheer_key_ok HTTP ${first.status}) — 키 권한·주소를 확인하세요`);
    return {has0060: null, problems};
  }
  const results = [[keys[0], first.body]];
  for (const k of keys.slice(1)) {
    const r = await rpc('cheer_key_ok', {p_key: k});
    if (r.status !== 200) {
      problems.push(`대상 DB 확인 실패(cheer_key_ok ${k} HTTP ${r.status})`);
      return {has0060: true, problems};
    }
    results.push([k, r.body]);
  }
  for (const [k, ok] of results) if (ok !== true) problems.push(`대상 DB의 cheer_key_ok 가 ${k} 를 받지 않아요`);
  return {has0060: true, problems};
}

/** cheer_texts → push_copy 순서로 쓴다. upsert 가 던지면 그다음은 쓰지 않는다. 쓴 표 이름 목록을 돌려준다. */
export async function applyPlan(upsert, {rows, cheers}) {
  const done = [];
  if (cheers.length) {
    await upsert('cheer_texts', cheers, 'message_key');
    done.push('cheer_texts');
  }
  await upsert('push_copy', rows, 'kind');
  done.push('push_copy');
  return done;
}
