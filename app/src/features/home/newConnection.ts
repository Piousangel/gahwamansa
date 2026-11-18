// N3 앱 안 배너(시안 common/N3_connected): 자녀가 앱을 열었을 때 전에 보지 못한 어르신이 연결돼 있으면 위쪽 배너 한 번.
// 푸시(앱 밖)는 서버 0032~ 이후. 지금은 기기에 '본 어르신 id' 목록만 둔다(이름·답 없음).
// 처음(목록 없음)에는 지금 어르신을 모두 본 것으로 두고 배너를 띄우지 않는다(첫 연결은 C3 '연결됐어요' 화면이 알린다).
import type {ChildParent} from '../types';

export {SEEN_PARENTS_KEY} from '../../lib/accountStore'; // 키는 계정별(accountKey)

export function newConnection(seen: string[] | null, parents: ChildParent[]): {banner: ChildParent | null; nextSeen: string[]} {
  const ids = parents.filter(p => p.parentId).map(p => p.parentId);
  if (seen === null) {
    return {banner: null, nextSeen: ids};
  }
  const banner = parents.find(p => p.parentId && p.connected && !seen.includes(p.parentId)) ?? null;
  return {banner, nextSeen: [...new Set([...seen, ...ids])]};
}

export function parseSeen(raw: string | null): string[] | null {
  if (!raw) {
    return null;
  }
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}
