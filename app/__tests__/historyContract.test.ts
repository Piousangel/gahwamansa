import {clampDays, parseParentHistory} from '../src/api/contract/history';

const day = {
  session_date: '2026-11-19',
  day_index: 3,
  completed: true,
  photo: {caption: '감 익는 마당', image_url: 'https://x/3.jpg', keyword: '감나무'},
  question: {prompt: '어느 계절이 더 좋으세요?', option_a: '봄', option_b: '가을'},
  choice_label: '가을',
};

test('parent_history 응답 검증: 맞는 모양만, 동의 거부 날 choice_label null 허용', () => {
  expect(parseParentHistory({days: [day]})).toEqual({days: [day]});
  expect(parseParentHistory({days: [{...day, choice_label: null}]})?.days[0].choice_label).toBeNull();
  expect(parseParentHistory({days: []})).toEqual({days: []});
  expect(parseParentHistory({days: [{...day, photo: {caption: 'c'}}]})).toBeNull();
  expect(parseParentHistory({days: [{...day, session_date: '11월 19일'}]})).toBeNull();
  expect(parseParentHistory([])).toBeNull();
  expect(parseParentHistory(null)).toBeNull();
});

test('p_days 는 1~30', () => {
  expect(clampDays(0)).toBe(1);
  expect(clampDays(45)).toBe(30);
  expect(clampDays(7.9)).toBe(7);
});
