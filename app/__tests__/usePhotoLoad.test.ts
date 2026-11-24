// #234 L2: 사진 주소가 바뀌면 이전 사진의 비율·불러옴·실패 상태가 남지 않는다
import {act, renderHook} from '@testing-library/react-native';
import type {ImageLoadEvent} from 'react-native';
import {usePhotoLoad} from '../src/features/course/usePhotoLoad';

const loadEvent = (width: number, height: number) => ({nativeEvent: {source: {width, height}}}) as unknown as ImageLoadEvent;

test('불러오면 비율·loaded, 주소가 바뀌면 초기화(새 사진을 다 불러오기 전까지 크게 보기 없음)', () => {
  const {result, rerender} = renderHook(({url}: {url: string}) => usePhotoLoad(url), {initialProps: {url: 'a.jpg'}});
  expect(result.current).toMatchObject({aspect: null, loaded: false, failed: false});
  act(() => result.current.onLoad(loadEvent(900, 1600)));
  expect(result.current.aspect).toBeCloseTo(900 / 1600);
  expect(result.current.loaded).toBe(true);
  rerender({url: 'b.jpg'});
  expect(result.current).toMatchObject({aspect: null, loaded: false, failed: false});
});

test('실패도 그 주소에만 묶인다', () => {
  const {result, rerender} = renderHook(({url}: {url: string}) => usePhotoLoad(url), {initialProps: {url: 'a.jpg'}});
  act(() => result.current.onError());
  expect(result.current.failed).toBe(true);
  rerender({url: 'b.jpg'});
  expect(result.current.failed).toBe(false);
});
