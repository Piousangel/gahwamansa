// P4 사진 틀(오너 S25 11-24: 띠처럼 잘림) — 원본 비율, 폭 기준 높이, 상한(창 45% · 첫 화면 fit, fit 은 바닥 아래로 안 내림)
import {PHOTO_CONTENT_ASPECT, photoAspect, photoFit, photoFloor, photoFrame} from '../src/features/course/photoFrame';

const W = 328; // 360 폭 기기의 본문 폭 예
const H = 640; // 창 높이 → 상한 288

test('콘텐츠 사진(1152×928): 폭을 채우고 높이는 폭 ÷ 비율 — 45% 상한에 걸리지 않는다', () => {
  expect(photoFrame(W, 1152 / 928, H)).toEqual({width: 328, height: 264});
});

test('가로 사진(16:9): 폭을 채운다', () => {
  expect(photoFrame(W, 16 / 9, H)).toEqual({width: 328, height: 185});
});

test('정사각·세로 사진: 높이는 창의 45%로 막고 폭을 같은 비율로 줄인다(잘림 없음)', () => {
  expect(photoFrame(W, 1, H)).toEqual({width: 288, height: 288});
  const f = photoFrame(W, 9 / 16, H);
  expect(f).toEqual({width: 162, height: 288});
});

test('상한에 딱 맞는 사진은 폭을 줄이지 않는다', () => {
  expect(photoFrame(288, 1, H)).toEqual({width: 288, height: 288});
});

test('비율을 모르면(불러오기 전·준비 중·실패) 콘텐츠 비율 틀 — 불러온 뒤 튀지 않게(#234 L1)', () => {
  expect(photoFrame(W, null, H)).toEqual(photoFrame(W, PHOTO_CONTENT_ASPECT, H));
});

test('폭을 아직 모르면 0(그리기 전)', () => {
  expect(photoFrame(0, 1, H)).toEqual({width: 0, height: 0});
});

test('fit(첫 화면 맞춤)이 더 작으면 그 높이로, 단 바닥(폭 50%·160 중 큰 값) 아래로는 안 내린다', () => {
  expect(photoFrame(W, PHOTO_CONTENT_ASPECT, H, 200)).toEqual({width: Math.round(200 * PHOTO_CONTENT_ASPECT), height: 200});
  expect(photoFloor(W)).toBe(164);
  expect(photoFloor(280)).toBe(160);
  expect(photoFrame(W, PHOTO_CONTENT_ASPECT, H, 90).height).toBe(164); // 바닥: 사진 우선, 질문은 접힘 아래
  expect(photoFrame(W, PHOTO_CONTENT_ASPECT, H, 999)).toEqual({width: 328, height: 264}); // 넉넉하면 그대로
});

test('photoFit: viewport − (사진 위 끝 + 간격 + 고지 + 간격 + 질문 첫 문장), viewport 를 모르면 없음', () => {
  expect(photoFit(400, 50, 8, 28, 32)).toBe(400 - 50 - 8 - 28 - 8 - 32);
  expect(photoFit(400, 50, 8, 0, 32)).toBe(400 - 50 - 8 - 32); // 고지 없음(준비 중)
  expect(photoFit(0, 50, 8, 28, 32)).toBeUndefined();
});

test('photoAspect: 크기가 없거나 0이면 null', () => {
  expect(photoAspect(1600, 900)).toBeCloseTo(16 / 9);
  expect(photoAspect(0, 900)).toBeNull();
  expect(photoAspect(undefined, undefined)).toBeNull();
});
