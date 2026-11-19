/**
 * @jest-environment node
 */
// R-15 접힘 경계 맞춤(ui/ds/foldPush — FoldStack·useFoldGap 공용, PR #91 리뷰 L1): 접힘에 걸치는 첫 요소만 통째로 아래로,
// 다 들어가거나 한 화면보다 큰 요소는 그대로. 경계 동작(첫 요소·큰 요소·제목째 밀기)을 여기서 고정한다
import React from 'react';
import {keyOf} from '../src/ui/FoldStack';
import {foldPush} from '../src/ui/ds/foldPush';

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

describe('경계 동작(리뷰 L1에서 고정)', () => {
  test('첫 요소: 기본은 밀지 않고, allowFirst 면 묶음째 민다(boolean·객체 같은 뜻)', () => {
    expect(foldPush(250, 200, [96], 12)).toBeNull();
    expect(foldPush(250, 200, [96], 12, true)).toEqual({index: 0, space: 51});
    expect(foldPush(250, 200, [96], 12, {allowFirst: true})).toEqual({index: 0, space: 51});
  });
  test('한 화면보다 큰 요소는 allowFirst·from 과 상관없이 밀지 않는다', () => {
    expect(foldPush(250, 0, [100, 250], 10, {allowFirst: true})).toBeNull();
    expect(foldPush(250, 100, [300], 10, {allowFirst: true})).toBeNull();
  });
  test('from 보다 앞 요소가 걸치면 아무것도 밀지 않는다(첫 화면에 남기는 것이 시안)', () => {
    expect(foldPush(250, 0, [100, 200, 80], 10, {allowFirst: true, from: 2})).toBeNull();
    expect(foldPush(250, 0, [100, 100, 80], 10, {allowFirst: true, from: 2})).toEqual({index: 2, space: 31}); // 셋째 220~300
  });
  test('glue: 앞 요소(제목)가 glue 면 제목째 민다, 제목이 from 앞이면 그 요소만', () => {
    // 제목(0~30) · 1단계(40~140) · 2단계(150~250) · 3단계(260~360), 화면 300 → 3단계 걸침, 앞(2단계)이 glue 아님
    expect(foldPush(300, 0, [30, 100, 100, 100], 10, {allowFirst: true, glue: [0]})).toEqual({index: 3, space: 41});
    // 화면 120 → 1단계(40~140) 걸침, 앞 0 이 glue → 제목째(0 위 여백 121)
    expect(foldPush(120, 0, [30, 100, 100], 10, {allowFirst: true, glue: [0]})).toEqual({index: 0, space: 121});
    // 제목째인데 첫 요소라 allowFirst 가 없으면 밀지 않는다
    expect(foldPush(120, 0, [30, 100, 100], 10, {glue: [0]})).toBeNull();
    // 제목이 from 앞이면 걸친 요소만
    expect(foldPush(120, 0, [30, 100, 100], 10, {allowFirst: true, from: 1, glue: [0]})).toEqual({index: 1, space: 81});
  });
  test('pushTo: 판정은 viewport(창 − 흐림), 민 요소는 pushTo(창 끝)로. 흐림 구간 안에서 시작하는 요소도 민다(C4 #87 L4·L6)', () => {
    // 판정 300, 창 끝 328: 둘째(150~270)는 들어가고 셋째(280~400)가 걸침 → 328-280+1
    expect(foldPush(300, 0, [140, 120, 120], 10, {allowFirst: true, pushTo: 328})).toEqual({index: 2, space: 49});
    // 셋째가 흐림 구간(300~328) 안 310 에서 시작 → 그래도 민다(328-310+1)
    expect(foldPush(300, 0, [150, 140, 120], 10, {allowFirst: true, pushTo: 328})).toEqual({index: 2, space: 19});
    // 창 끝(328) 아래에서 시작하면 이미 밖
    expect(foldPush(300, 0, [150, 140], 180, {allowFirst: true, pushTo: 328})).toBeNull(); // 둘째 330 에서 시작
  });
});

test('keyOf: Children.toArray 의 key(.$read, 배열 안 .2:$q0)에서 화면이 준 key 를 되찾는다(PR #91 리뷰)', () => {
  const kids = React.Children.toArray([null, React.createElement('a', {key: 'x'}), [React.createElement('b', {key: 'q0'}), React.createElement('b', {key: 'q1'})], React.createElement('c', {key: 'read'})]);
  expect(kids.map(keyOf)).toEqual(['x', 'q0', 'q1', 'read']);
});
