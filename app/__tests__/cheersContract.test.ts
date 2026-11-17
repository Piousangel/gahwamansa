import {CHEER_KEYS, isCheerKey, parseMarkCheersRead, parseMyCheers} from '../src/api/contract/cheers';
import {copy} from '../src/copy/copy';

test('응원 키 4개는 서버 0020 화이트리스트와 같고, 모두 문구가 있다', () => {
  expect([...CHEER_KEYS]).toEqual(['love_you', 'warm_day', 'thanks_always', 'peaceful_day']);
  for (const k of CHEER_KEYS) {
    expect((copy.cheers as Record<string, string>)[k]).toBeTruthy();
  }
  expect(isCheerKey('will_call')).toBe(false);
});

test('get_my_cheers 응답 검증: 맞는 모양만 통과', () => {
  const ok = {unread_count: 1, cheers: [{id: 'a', message_key: 'warm_day', sent_at: '2026-11-20T00:00:00Z'}]};
  expect(parseMyCheers(ok)).toEqual(ok);
  expect(parseMyCheers({unread_count: 0, cheers: []})).toEqual({unread_count: 0, cheers: []});
  expect(parseMyCheers([])).toBeNull(); // 배열(옛 가정) 거부
  expect(parseMyCheers({unread_count: '1', cheers: []})).toBeNull();
  expect(parseMyCheers({unread_count: 1, cheers: [{id: 1}]})).toBeNull();
  expect(parseMyCheers(null)).toBeNull();
});

test('문구표의 응원 키는 계약 키와 정확히 같다(제외 키 남기지 않음, 리뷰 6)', () => {
  expect(Object.keys(copy.cheers).sort()).toEqual([...CHEER_KEYS].sort());
});

test('mark_cheers_read 응답 검증: 0 이상 정수만', () => {
  expect(parseMarkCheersRead(2)).toBe(2);
  expect(parseMarkCheersRead(0)).toBe(0);
  expect(parseMarkCheersRead('2')).toBeNull();
  expect(parseMarkCheersRead(-1)).toBeNull();
  expect(parseMarkCheersRead(1.5)).toBeNull();
  expect(parseMarkCheersRead(null)).toBeNull();
});
