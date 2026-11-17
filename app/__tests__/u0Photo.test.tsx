import React from 'react';
import {AccessibilityInfo, Animated, Image, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {Photo} from '../src/ui/Photo';
import {prefetchImages, isPrefetched, __resetImageCache} from '../src/ui/imageCache';
import {useReduceMotion, fadeMs} from '../src/ui/motion';

const uri = 'https://example.test/day-01.jpg';

afterEach(() => {
  jest.restoreAllMocks();
  __resetImageCache();
});

describe('Photo(사진 자리표시·페이드 인)', () => {
  test('불러오는 동안 자리표시가 같은 비율로 자리를 지킨다(읽지 않음)', () => {
    render(<Photo source={{uri}} aspectRatio={4 / 3} accessibilityLabel="바닷가 마을 사진" />);
    const ph = screen.getByTestId('photo-placeholder', {includeHiddenElements: true});
    expect(ph.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(StyleSheet.flatten(screen.getByTestId('photo').props.style).aspectRatio).toBeCloseTo(4 / 3);
  });

  test('R6: 뜻이 있는 그림은 image 역할 + 라벨로 한 번 읽는다', () => {
    render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="오늘 사진, 가을 마을, AI가 만든 그림" />);
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'load');
    const img = screen.getByRole('image', {name: '오늘 사진, 가을 마을, AI가 만든 그림'});
    expect(img).toBeTruthy();
    expect(screen.getAllByLabelText('오늘 사진, 가을 마을, AI가 만든 그림')).toHaveLength(1);
  });

  test('사진은 이름으로 읽히고, 다 불러오면 자리표시가 사라진다', () => {
    render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="바닷가 마을 사진" />);
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'load');
    expect(screen.queryByTestId('photo-placeholder', {includeHiddenElements: true})).toBeNull();
    expect(screen.getByLabelText('바닷가 마을 사진')).toBeTruthy();
  });

  test('불러오기 실패면 자리표시를 남기고 onError 를 부른다', () => {
    const onError = jest.fn();
    render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="사진" onError={onError} />);
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'error');
    expect(screen.getByTestId('photo-placeholder', {includeHiddenElements: true})).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  test('리뷰 M2: 사진 주소가 바뀌면 상태를 처음부터(실패 뒤 다음 사진이 투명하게 남지 않음)', () => {
    const {rerender} = render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="사진" />);
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'error');
    rerender(<Photo source={{uri: uri + '?2'}} aspectRatio={1} accessibilityLabel="사진" />);
    expect(screen.getByTestId('photo-placeholder', {includeHiddenElements: true})).toBeTruthy();
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'load');
    expect(screen.queryByTestId('photo-placeholder', {includeHiddenElements: true})).toBeNull();
    expect(screen.getByRole('image', {name: '사진'})).toBeTruthy();
  });

  test('리뷰 L12·R13: 다 불러오기 전에는 사진 라벨 대신 "잠시만요"(호출부 문구)만 읽는다', () => {
    render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="오늘 사진" loadingLabel="잠시만요" />);
    expect(screen.queryByRole('image', {name: '오늘 사진'})).toBeNull();
    expect(screen.getByLabelText('잠시만요')).toBeTruthy();
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'load');
    expect(screen.getByRole('image', {name: '오늘 사진'})).toBeTruthy();
    expect(screen.queryByLabelText('잠시만요')).toBeNull();
  });

  test('페이드 인은 300ms, 동작 줄이기면 0(바로)', () => {
    expect(fadeMs(false)).toBe(300);
    expect(fadeMs(true)).toBe(0);
  });

  test('미리 받아 둔 사진은 페이드 없이 바로 보인다', async () => {
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    await act(() => prefetchImages([uri]));
    const timing = jest.spyOn(Animated, 'timing');
    render(<Photo source={{uri}} aspectRatio={1} accessibilityLabel="사진" />);
    fireEvent(screen.getByTestId('photo-image', {includeHiddenElements: true}), 'load');
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('imageCache', () => {
  test('같은 주소는 한 번만 받는다(동시에 요청해도)', async () => {
    const pf = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    const [a, b] = await Promise.all([prefetchImages([uri]), prefetchImages([uri, uri])]);
    expect(a).toEqual([true]);
    expect(b).toEqual([true, true]);
    expect(pf).toHaveBeenCalledTimes(1);
    expect(isPrefetched(uri)).toBe(true);
  });

  test('실패하면 false, 다음에 다시 시도할 수 있다', async () => {
    const pf = jest.spyOn(Image, 'prefetch').mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(true);
    expect(await prefetchImages([uri])).toEqual([false]);
    expect(isPrefetched(uri)).toBe(false);
    expect(await prefetchImages([uri])).toEqual([true]);
    expect(pf).toHaveBeenCalledTimes(2);
  });
});

describe('useReduceMotion', () => {
  test('시스템 설정을 읽고, 바뀌면 따라간다', async () => {
    let listener: ((v: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, fn: (v: boolean) => void) => {
      listener = fn;
      return {remove: () => {}};
    }) as never);
    let seen = false;
    function Probe() {
      seen = useReduceMotion();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(seen).toBe(true));
    act(() => listener?.(false));
    expect(seen).toBe(false);
  });
});
