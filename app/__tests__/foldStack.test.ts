/**
 * @jest-environment node
 */
// R-15 접힘 경계 맞춤(FoldStack.foldPush): 접힘에 걸치는 첫 요소만 통째로 아래로, 다 들어가거나 한 화면보다 큰 요소는 그대로
import {foldPush} from '../src/ui/FoldStack';

test('걸치는 요소 앞에 여백을 넣어 접힘 아래로 민다', () => {
  // top 0, 높이 100·200·80, gap 10, 화면 250 → 둘째(110~310)가 걸침 → 250-110+1 = 141
  expect(foldPush(250, 0, [100, 200, 80], 10)).toEqual({index: 1, space: 141});
});
test('다 들어가면 그대로, 높이를 모르면 계산하지 않는다', () => {
  expect(foldPush(600, 0, [100, 200, 80], 10)).toBeNull();
  expect(foldPush(250, 0, [100, undefined, 80], 10)).toBeNull();
  expect(foldPush(0, 0, [100, 200], 10)).toBeNull();
});
test('한 화면보다 큰 요소·맨 첫 요소는 밀지 않는다(스크롤로 닿음)', () => {
  expect(foldPush(250, 0, [100, 400], 10)).toBeNull();
  expect(foldPush(250, 0, [300], 10)).toBeNull();
});
test('묶음이 스크롤 내용 안에서 내려와 있으면(top) 그만큼 더해 계산한다', () => {
  expect(foldPush(250, 50, [100, 120], 10)).toEqual({index: 1, space: 91}); // 둘째 160~280 이 걸침 → 250-160+1
  expect(foldPush(250, 50, [100, 80, 80], 10)).toBeNull(); // 셋째는 접힘(250)에서 바로 시작 — 걸치지 않음
});
test('묶음 안 하위 줄(allowFirst): 첫 줄이 걸쳐도 민다(P5 선택지 카드마다)', () => {
  expect(foldPush(250, 200, [96, 96], 12, true)).toEqual({index: 0, space: 51});
  expect(foldPush(250, 100, [96, 96], 12, true)).toEqual({index: 1, space: 43}); // 둘째 208~304 걸침
});
