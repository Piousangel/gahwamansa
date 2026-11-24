// 법률 리뷰(WR-02)를 통과한 응원 키 — load-push-copy.mjs 는 이 키의 문장만 cheer_texts 에 적재한다(#244 QA-3 M1).
// 서버가 받는 키(앱 계약 CHEER_KEYS, 0060 cheer_key_ok)와 다르다: 키가 계약에 있어도 법률 리뷰 전 문장은 서버에 넣지 않는다.
// 새 키를 승인하려면 법률 줄 확인 기록(문서·PR)을 남기고 이 배열에만 더한다. 이 목록은 CHEER_KEYS 안에 있어야 한다(시험: load-push-copy.test.mjs).
// 2026-11-25: 기존 4키만 승인. 새 13키(0060)는 법률 리뷰 대기.
export const LEGAL_APPROVED_CHEER_KEYS = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'];
