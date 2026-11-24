// P4 사진 틀(오너 S25 11-24: 띠처럼 잘림) — 원본 비율, 폭 기준 높이, 긴 사진은 상한 높이 + 같은 비율로 폭 줄임
import {PHOTO_DEFAULT_ASPECT, photoAspect, photoFrame} from '../src/features/course/photoFrame';

const W = 328; // 360 폭 기기의 본문 폭 예
const H = 640; // 창 높이 → 상한 384

test('가로 사진(16:9): 폭을 채우고 높이는 폭 ÷ 비율', () => {
  expect(photoFrame(W, 16 / 9, H)).toEqual({width: 328, height: 185});
});

test('정사각 사진: 폭 = 높이', () => {
  expect(photoFrame(W, 1, H)).toEqual({width: 328, height: 328});
});

test('세로로 긴 사진(9:16): 높이는 창의 60%로 막고 폭을 같은 비율로 줄인다(잘림 없음)', () => {
  const f = photoFrame(W, 9 / 16, H);
  expect(f.height).toBe(384);
  expect(f.width).toBe(216);
  expect(f.width / f.height).toBeCloseTo(9 / 16, 2);
});

test('상한에 딱 맞는 사진은 폭을 줄이지 않는다', () => {
  expect(photoFrame(384, 1, H)).toEqual({width: 384, height: 384});
});

test('비율을 모르면(불러오기 전·준비 중·실패) 기본 4:3 틀', () => {
  expect(photoFrame(W, null, H)).toEqual({width: 328, height: Math.round(W / PHOTO_DEFAULT_ASPECT)});
});

test('폭을 아직 모르면 0(그리기 전)', () => {
  expect(photoFrame(0, 1, H)).toEqual({width: 0, height: 0});
});

test('photoAspect: 크기가 없거나 0이면 null', () => {
  expect(photoAspect(1600, 900)).toBeCloseTo(16 / 9);
  expect(photoAspect(0, 900)).toBeNull();
  expect(photoAspect(undefined, undefined)).toBeNull();
});
