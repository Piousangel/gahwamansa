import {BACK_TO, backDestination} from '../src/app/backDestination';
import {copy} from '../src/copy/copy';

// W-09: 뒤로 바는 스택 바로 아래 화면 이름으로 간다('‹ 이전' 없음)
const r = (name: string, state?: {index?: number; routes: {name: string}[]}) => ({name, state});

test('스택 바로 아래 화면의 목적지', () => {
  expect(backDestination({index: 1, routes: [r('CourseHome'), r('Settings')]})).toBe(copy.nav.to.CourseHome);
  expect(backDestination({index: 2, routes: [r('CourseHome'), r('Settings'), r('Web')]})).toBe(copy.nav.to.Settings);
  expect(backDestination({index: 1, routes: [r('History'), r('HistoryDay')]})).toBe(copy.nav.to.History);
});

test('탭 위에서 연 화면은 보고 있던 탭으로, 탭 상태가 아직 없으면 첫 탭(앨범)', () => {
  expect(backDestination({index: 1, routes: [r('Tabs', {index: 1, routes: [r('Album'), r('Past')]}), r('Settings')]})).toBe(copy.nav.to.Past);
  expect(backDestination({index: 1, routes: [r('Tabs'), r('Settings')]})).toBe(copy.nav.to.Album);
});

test('아래 화면이 없거나 모르는 화면이면 null(뒤로 바가 숨는다 — "이전"으로 돌아가지 않음)', () => {
  expect(backDestination(undefined)).toBeNull();
  expect(backDestination({index: 0, routes: [r('CourseHome')]})).toBeNull();
  expect(backDestination({index: 1, routes: [r('Unknown'), r('Settings')]})).toBeNull();
});

test('표의 값은 모두 nav.to 문구(…로)', () => {
  for (const v of Object.values(BACK_TO)) {
    expect(Object.values(copy.nav.to)).toContain(v);
  }
});

test('ds 닫기 말(DISMISS_TEXT)은 문구 파일 dismiss 와 같다(ui 는 copy 를 모르므로 사본, A5)', () => {
  const {DISMISS_TEXT} = require('../src/ui/ds/dismiss');
  expect(DISMISS_TEXT).toEqual(copy.dismiss);
});
