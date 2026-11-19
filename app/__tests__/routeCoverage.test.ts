/**
 * @jest-environment node
 */
// W-09 리뷰: 스택(ParentStack·ChildStack)·자녀 탭에 있는 화면 이름이 모두 뒤로 목적지 표(BACK_TO)에 있다.
// 타입(Record<RouteName, …>)은 ParamList 에 있는 이름만 지킨다 — Stack.Screen 을 ParamList 없이 더하거나 탭을 더하면 여기서 잡는다.
declare const __dirname: string;
const fs: {readFileSync(p: string, e: string): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const {BACK_TO} = require('../src/app/backDestination');

const names = (file: string) =>
  [...fs.readFileSync(path.join(__dirname, '../src/app', file), 'utf8').matchAll(/<(?:Stack|Tab)\.Screen\s+name="(\w+)"/g)].map(m => m[1]);

test('모든 화면 이름이 BACK_TO 에 있다(Tabs 는 안쪽 탭으로 대신)', () => {
  const all = [...names('ParentStack.tsx'), ...names('ChildStack.tsx')];
  expect(all.length).toBeGreaterThan(25);
  expect(all.filter(n => n !== 'Tabs' && !(n in BACK_TO))).toEqual([]);
  expect(all).toEqual(expect.arrayContaining(['Album', 'Past'])); // 탭 이름도 읽혔는지
});

test('뒤로 목적지 문구는 이름 사전(docs/design/NAMES.md)의 쓰지 않는 말을 쓰지 않는다', () => {
  const {copy} = require('../src/copy/copy');
  const BANNED = ['글씨 쓰기', '자판으로 쓰기', '한 단어 쓰기', '따라 쓰기', '지난 답', '최근 답', '코드', '이전'];
  const hits = Object.entries(copy.nav.to as Record<string, string>).filter(([, v]) => BANNED.some(b => v.includes(b)));
  expect(hits).toEqual([]);
});

export {};
