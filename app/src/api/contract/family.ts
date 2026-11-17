// 어르신 가족 목록 계약(parent_family_list 0030, P16). 플랫폼 무관 TS만.
// 근거: dev-server-notes "parent_family_list". 자녀 이름·이메일·id 는 없다(순번·연결 시각·KST 날짜만).
import {PARENT_TITLES} from './invite';

export type FamilyMember = {seq: number; connectedAt: string; connectedDate: string}; // connectedDate = YYYY-MM-DD(KST)
export type ParentFamily = {title: string | null; family: FamilyMember[]}; // 연결 전 기기는 {title:null, family:[]}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 런타임 검증: 계약 밖이면 null(호출부가 일반 서버 오류로)
export function parseParentFamily(v: unknown): ParentFamily | null {
  if (!v || typeof v !== 'object') {
    return null;
  }
  const o = v as Record<string, unknown>;
  const title = o.title === null || o.title === undefined ? null : o.title;
  if (title !== null && !(typeof title === 'string' && (PARENT_TITLES as readonly string[]).includes(title))) {
    return null;
  }
  if (!Array.isArray(o.family)) {
    return null;
  }
  const family: FamilyMember[] = [];
  for (const m of o.family) {
    const r = m as Record<string, unknown>;
    if (!r || typeof r.seq !== 'number' || typeof r.connected_at !== 'string' || typeof r.connected_date !== 'string' || !DATE.test(r.connected_date)) {
      return null;
    }
    family.push({seq: r.seq, connectedAt: r.connected_at, connectedDate: r.connected_date});
  }
  return {title: title as string | null, family};
}
