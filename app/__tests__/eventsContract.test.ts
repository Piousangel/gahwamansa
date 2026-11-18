import {EVENT_NAMES, isQuietEventFailure, parseLogEventResult} from '../src/api/contract/events';

test('이벤트 이름 19개는 서버 0022+0029 log_event 화이트리스트와 같다', () => {
  expect(EVENT_NAMES).toHaveLength(20); // + photo_zoom_opened(0034 임시)
  expect(EVENT_NAMES).toEqual(expect.arrayContaining(['link_opened', 'referrer_found', 'code_prefilled'])); // 0029 연결 퍼널
  expect(EVENT_NAMES).toContain('course_step_completed');
  expect(EVENT_NAMES).toContain('course_completed');
});

test('log_event 응답 검증과 조용한 실패 구분', () => {
  expect(parseLogEventResult({ok: true})).toEqual({ok: true});
  const rl = parseLogEventResult({ok: false, reason: 'rate_limited'});
  expect(rl && isQuietEventFailure(rl)).toBe(true);
  const nu = parseLogEventResult({ok: false, reason: 'no_user'});
  expect(nu && isQuietEventFailure(nu)).toBe(true);
  const ip = parseLogEventResult({ok: false, reason: 'invalid_props'});
  expect(ip && isQuietEventFailure(ip)).toBe(false);
  expect(parseLogEventResult({ok: false, reason: 'weird'})).toBeNull();
  expect(parseLogEventResult(null)).toBeNull();
});
