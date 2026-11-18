import {
  EVENT_BOOLEAN_PROPS,
  EVENT_FORMAT_PROPS,
  EVENT_NAMES,
  EVENT_NUMBER_PROPS,
  EVENT_PROP_VALUES,
  isQuietEventFailure,
  parseLogEventResult,
} from '../src/api/contract/events';
import {ANDROID_PUSH_CHANNEL_ID} from '../src/api/contract/push';

// 서버 화이트리스트와 계약 상수 비교(ARCHITECTURE 4절 "서버 check/화이트리스트와 contracts 상수가 같은 값").
// 근원 = supabase/migrations 에서 log_event·event_prop_ok 를 마지막으로 정의한 파일(번호 순). 서버가 바뀌면 이 테스트가 앱 계약을 맞추라고 알린다.
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; readdirSync(d: string): string[]; existsSync(f: string): boolean} = require('fs');
const path: {join(...p: string[]): string} = require('path');

const ROOT = path.join(__dirname, '../..');
const MIG = path.join(ROOT, 'supabase/migrations');

function lastDefinition(fn: string): {file: string; body: string} {
  const files = fs
    .readdirSync(MIG)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
  const re = new RegExp(`create or replace function public\\.${fn}\\(|create function public\\.${fn}\\(`, 'i');
  const hits = files.filter(f => re.test(fs.readFileSync(path.join(MIG, f), 'utf8')));
  const file = hits[hits.length - 1];
  const sql = fs.readFileSync(path.join(MIG, file), 'utf8');
  const start = sql.search(re);
  const end = sql.indexOf('$$;', sql.indexOf('$$', start) + 2);
  return {file, body: sql.slice(start, end)};
}
const sorted = (xs: readonly string[]) => [...xs].sort();
const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

describe('서버 log_event 이름 목록 = EVENT_NAMES', () => {
  test('글자까지 같다', () => {
    const {body} = lastDefinition('log_event');
    const list = /p_name not in \(([\s\S]*?)\) then/.exec(body.replace(/--[^\n]*/g, ''));
    expect(list).not.toBeNull();
    expect(sorted(EVENT_NAMES)).toEqual(sorted(quoted(list![1])));
  });
});

describe('서버 event_prop_ok = 속성 계약', () => {
  const {body: raw} = lastDefinition('event_prop_ok');
  const body = raw.replace(/--[^\n]*/g, '');
  test('숫자·참거짓 키', () => {
    const num = /when p_key in \(([^)]*)\) then\s*jsonb_typeof\(p_val\) = 'number'/.exec(body);
    const bool = /when p_key in \(([^)]*)\) then\s*jsonb_typeof\(p_val\) = 'boolean'/.exec(body);
    expect(sorted(EVENT_NUMBER_PROPS)).toEqual(sorted(quoted(num![1])));
    expect(sorted(EVENT_BOOLEAN_PROPS)).toEqual(sorted(quoted(bool![1])));
  });
  test('값 목록 키는 값까지 같고, 형식 키는 키 이름이 같다', () => {
    const enums: Record<string, string[]> = {};
    const formats: string[] = [];
    for (const m of body.matchAll(/when '([a-z_]+)'\s+then '([^']*)'/g)) {
      const e = /^\^\(([a-z_|]+)\)\$$/.exec(m[2]);
      if (e) {
        enums[m[1]] = e[1].split('|').sort();
      } else {
        formats.push(m[1]);
      }
    }
    const app = Object.fromEntries(Object.entries(EVENT_PROP_VALUES).map(([k, v]) => [k, sorted(v)]));
    expect(app).toEqual(enums);
    expect(sorted(EVENT_FORMAT_PROPS)).toEqual(sorted(formats));
  });
});

test('Android 알림 채널 id 는 서버 push-daily 와 같다(0033)', () => {
  const lib = path.join(ROOT, 'supabase/functions/push-daily/lib.mts');
  expect(fs.existsSync(lib)).toBe(true);
  const m = /ANDROID_CHANNEL_ID\s*=\s*'([^']+)'/.exec(fs.readFileSync(lib, 'utf8'));
  expect(m?.[1]).toBe(ANDROID_PUSH_CHANNEL_ID);
  expect(ANDROID_PUSH_CHANNEL_ID).toBe('daily');
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
