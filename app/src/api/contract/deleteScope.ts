// 계정 삭제 범위 계약(서버 0017·0049 delete_scope_preview / delete_my_account). 플랫폼 무관 TS만.
// 근거: docs/team/dev-server-notes.md "delete_my_account() / delete_scope_preview() — 가족 연결 전 계정 (0049)".
// 'none' = 가족과 연결하기 전 계정(프로필 없음: 로그인만 한 자녀, 번호 입력 전 어르신 익명 기기). 0049 전에는 no_profile 예외였다.
export const DELETE_SCOPES = ['child', 'parent', 'family', 'none'] as const;
export type DeleteScope = (typeof DELETE_SCOPES)[number];

export function parseDeleteScope(v: unknown): {scope: DeleteScope} | null {
  const s = v && typeof v === 'object' ? (v as Record<string, unknown>).scope : undefined;
  return (DELETE_SCOPES as readonly unknown[]).includes(s) ? {scope: s as DeleteScope} : null;
}
