import {parsePeekResult} from '../src/api/contract/invite';

test('peek_invite_code 응답 검증(M3): 계약 밖 reason·모양은 거부', () => {
  expect(parsePeekResult({ok: true, parent_title: '엄마'})).toEqual({ok: true, parentTitle: '엄마'});
  expect(parsePeekResult({ok: true})).toEqual({ok: true, parentTitle: null}); // 호칭 없으면 번호만(시안 P1c 둘째 상태)
  expect(parsePeekResult({ok: false, reason: 'expired'})).toEqual({ok: false, reason: 'expired'});
  expect(parsePeekResult({ok: false, reason: 'rate_limited', retry_after_sec: 600})).toEqual({ok: false, reason: 'rate_limited', retry_after_sec: 600});
  expect(parsePeekResult({ok: false, reason: 'locked'})).toBeNull();
  expect(parsePeekResult({ok: true, parent_title: '사장님'})).toBeNull(); // 닫힌 목록 밖 호칭
  expect(parsePeekResult(null)).toBeNull();
});
