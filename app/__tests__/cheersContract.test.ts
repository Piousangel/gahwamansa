import {CHEER_KEYS, CHILD_SHEET_KEYS, isCheerKey, parseMarkCheersRead, parseMyCheers} from '../src/api/contract/cheers';
import {EVENT_PROP_VALUES} from '../src/api/contract/events';
import {copy} from '../src/copy/copy';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; readdirSync(d: string): string[]} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const MIG = path.join(__dirname, '../../supabase/migrations');

// 서버 cheer_key_ok(0060~)를 마지막으로 정의한 마이그레이션의 키 목록. 정본(CHEER_KEYS)과 글자까지 같아야 한다.
function serverCheerKeys(): {file: string; keys: string[]} {
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?cheer_key_ok\s*\(/i;
  const files = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort().filter(f => re.test(fs.readFileSync(path.join(MIG, f), 'utf8')));
  if (files.length === 0) {
    throw new Error('supabase/migrations 에서 cheer_key_ok 정의를 찾지 못했어요.');
  }
  const file = files[files.length - 1];
  const sql = fs.readFileSync(path.join(MIG, file), 'utf8');
  const start = sql.search(re);
  const open = sql.indexOf('$$', start);
  const body = sql.slice(open + 2, sql.indexOf('$$', open + 2)).replace(/--[^\n]*/g, '');
  return {file, keys: [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1])};
}

// 새 13키 = 라이터 문서 3절 15개 − 기존 thanks_always − ans_seen(DECISIONS 11-24 D-5)
const LEGACY = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'];
const NEW_13 = ['ans_me_too', 'ans_tell_more', 'old_story', 'photo_memory', 'childhood_story', 'call_soon', 'visit_soon', 'eat_together', 'love', 'miss_you', 'thought_of_you', 'doing_well', 'meal_thought'];

test('응원 키 정본 = 기존 4키 + 새 13키(ans_seen 없음), 모두 문구가 있다', () => {
  expect([...CHEER_KEYS]).toEqual([...LEGACY, ...NEW_13]);
  expect(NEW_13).toHaveLength(13);
  expect(new Set(CHEER_KEYS).size).toBe(17);
  for (const k of CHEER_KEYS) {
    expect((copy.cheers as Record<string, string>)[k]).toBeTruthy();
    expect(k).toMatch(/^[a-z_]{1,32}$/); // 0001 cheers.message_key check
  }
  expect(isCheerKey('ans_seen')).toBe(false); // D-5 제외
  expect(isCheerKey('will_call')).toBe(false);
});

test('서버 cheer_key_ok 목록 = CHEER_KEYS(글자까지, 복사 1곳만 시험으로 대조)', () => {
  const {file, keys} = serverCheerKeys();
  expect([file, [...keys].sort()]).toEqual([file, [...CHEER_KEYS].sort()]);
});

test('이벤트 message_key 값 = CHEER_KEYS(같은 상수)', () => {
  expect(EVENT_PROP_VALUES.message_key).toBe(CHEER_KEYS);
});

test('자녀 시트 키는 정본 안에 있다(새 시트 전까지 지금 4개)', () => {
  expect([...CHILD_SHEET_KEYS]).toEqual(LEGACY);
  for (const k of CHILD_SHEET_KEYS) {
    expect(isCheerKey(k)).toBe(true);
  }
});

test('새 13키 문장: 칭찬·안부 점검·건강·기억·때·물음표·느낌표 없음, 60자 이하(라이터 1절 기준)', () => {
  const BAN = /잘하셨|역시|대단|멋져|최고|하셨어요\?|드셨|별일|하셨네요|건강|무리하지|기억나|오늘|지금|주말|\?|!|♥|❤/;
  for (const k of NEW_13) {
    const t = (copy.cheers as Record<string, string>)[k];
    expect([k, BAN.test(t), t.length <= 60]).toEqual([k, false, true]);
  }
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
