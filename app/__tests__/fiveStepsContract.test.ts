// 오늘 코스 5단계 계약(서버 0061) ↔ 앱 계약 fiveSteps.ts 대조. 마이그레이션 글자를 읽어 목록이 어긋나면 실패한다.
import {
  COURSE_STEPS,
  PASS_ON_KEYS,
  isPassOnKey,
  parseChildFiveSteps,
  parseSavePassOnResult,
  parseSaveRecallResult,
  parseTodayFiveSteps,
} from '../src/api/contract/fiveSteps';
import {EVENT_PROP_VALUES} from '../src/api/contract/events';
import {CHEER_KEYS} from '../src/api/contract/cheers';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; readdirSync(d: string): string[]} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const MIG = path.join(__dirname, '../../supabase/migrations');

function lastFileMatching(re: RegExp): {file: string; sql: string} {
  const files = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort().filter(f => re.test(fs.readFileSync(path.join(MIG, f), 'utf8')));
  if (files.length === 0) {
    throw new Error(`supabase/migrations 에서 ${re} 를 찾지 못했어요.`);
  }
  const file = files[files.length - 1];
  return {file, sql: fs.readFileSync(path.join(MIG, file), 'utf8')};
}

test('서버 pass_on_key_ok 목록 = PASS_ON_KEYS(글자까지)', () => {
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?pass_on_key_ok\s*\(/i;
  const {file, sql} = lastFileMatching(re);
  const start = sql.search(re);
  const open = sql.indexOf('$$', start);
  const body = sql.slice(open + 2, sql.indexOf('$$', open + 2)).replace(/--[^\n]*/g, '');
  const keys = [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  expect([file, keys]).toEqual([file, [...PASS_ON_KEYS]]);
});

test('⑤ 키는 응원 키와 겹치지 않는다(방향·법률 승인이 다른 목록)', () => {
  for (const k of PASS_ON_KEYS) {
    expect((CHEER_KEYS as readonly string[]).includes(k)).toBe(false);
  }
});

test('서버 completed_steps check 단계 = COURSE_STEPS, 이벤트 step 값도 같다', () => {
  const re = /add constraint daily_sessions_completed_steps_check/i;
  const {file, sql} = lastFileMatching(re);
  const at = sql.search(re);
  const arr = sql.slice(at, sql.indexOf(']', at));
  const steps = [...arr.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  expect([file, steps]).toEqual([file, [...COURSE_STEPS]]);
  expect([...EVENT_PROP_VALUES.step]).toEqual([...COURSE_STEPS]);
});

test('get_today_content 5단계 값 파서: 새 서버·옛 서버·틀린 모양', () => {
  expect(
    parseTodayFiveSteps({
      day_index: 3,
      skipped_steps: ['pass_on'],
      recall: {options: [{slot: 1, label: '아궁이'}, {slot: 2, label: '누룽지'}], picked_slot: 2},
      pass_on: {enabled: true, picked_key: 'recall_first'},
    }),
  ).toEqual({
    skipped_steps: ['pass_on'],
    recall: {options: [{slot: 1, label: '아궁이'}, {slot: 2, label: '누룽지'}], picked_slot: 2},
    pass_on: {enabled: true, picked_key: 'recall_first'},
  });
  // 옛 서버(0061 전): 키 없음 → ② 보기 없음, ⑤ 꺼짐
  expect(parseTodayFiveSteps({day_index: 3})).toEqual({
    skipped_steps: [],
    recall: {options: [], picked_slot: null},
    pass_on: {enabled: false, picked_key: null},
  });
  // preview_content(연결 전): pass_on 키 없음
  expect(parseTodayFiveSteps({recall: {options: [], picked_slot: null}})?.pass_on.enabled).toBe(false);
  expect(parseTodayFiveSteps({skipped_steps: ['sound']})).toBeNull();
  expect(parseTodayFiveSteps({pass_on: {enabled: true, picked_key: 'love_you'}})).toBeNull();
  expect(parseTodayFiveSteps({recall: {options: [{slot: '1', label: 'x'}]}})).toBeNull();
  expect(parseTodayFiveSteps(null)).toBeNull();
});

test('저장 결과 파서: 정해진 이유만', () => {
  expect(parseSaveRecallResult({ok: true})).toEqual({ok: true});
  expect(parseSaveRecallResult({ok: false, reason: 'consent_required'})).toEqual({ok: false, reason: 'consent_required'});
  expect(parseSaveRecallResult({ok: false, reason: 'disabled'})).toBeNull(); // ②에는 스위치 없음
  expect(parseSavePassOnResult({ok: false, reason: 'disabled'})).toEqual({ok: false, reason: 'disabled'});
  expect(parseSavePassOnResult({ok: false, reason: 'missing_value'})).toEqual({ok: false, reason: 'missing_value'});
  expect(parseSavePassOnResult({ok: false, reason: 'nope'})).toBeNull();
});

test('자녀 ②·⑤ 파서: 옛 서버는 빈 배열, 모르는 ⑤ 키 줄은 버림, 틀린 모양은 null', () => {
  const v = {
    parents: [
      {
        parent_id: 'p1',
        answers: [],
        recalls: [{session_date: '2026-11-25', label: '누룽지'}],
        pass_ons: [
          {session_date: '2026-11-25', line_key: 'recall_first', recall_label: '누룽지', choice_label: '숭늉', option_a: '숭늉', option_b: '식혜'},
          {session_date: '2026-11-24', line_key: 'future_key', recall_label: null, choice_label: null, option_a: null, option_b: null},
        ],
      },
      {parent_id: 'p2', answers: []}, // 옛 서버 모양
    ],
  };
  expect(parseChildFiveSteps(v)).toEqual([
    {
      parent_id: 'p1',
      recalls: [{session_date: '2026-11-25', label: '누룽지'}],
      pass_ons: [{session_date: '2026-11-25', line_key: 'recall_first', recall_label: '누룽지', choice_label: '숭늉', option_a: '숭늉', option_b: '식혜'}],
    },
    {parent_id: 'p2', recalls: [], pass_ons: []},
  ]);
  expect(parseChildFiveSteps({parents: [{parent_id: 'p1', recalls: [{session_date: '11-25', label: 'x'}]}]})).toBeNull();
  expect(parseChildFiveSteps({parents: [{parent_id: 'p1', recalls: 'x'}]})).toBeNull();
  expect(parseChildFiveSteps({})).toBeNull();
  expect(isPassOnKey('see_together')).toBe(true);
  expect(isPassOnKey('love_you')).toBe(false);
});
