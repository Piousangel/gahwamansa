import React from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {Screen} from '../src/ui/Screen';

// 접근성 패널 r1(2026-11-20) 스크롤 끝 회귀.
// ① scrollEventThrottle 때문에 끝 무렵 onScroll 이 빠져도, 손을 뗀 때·관성이 멈춘 때의 위치로 '더 있음'을 다시 판단한다.
// ② 옛 화면 Dock 이 넘쳐 안에서 스크롤되면(P1c 200% '다른 번호 쓰기') 아래에 흐림을 보이고, Dock 끝에서는 지운다.
const H_ALL = {includeHiddenElements: true};
const ev = (y: number, content = 900, view = 300) => ({nativeEvent: {contentOffset: {x: 0, y}, contentSize: {width: 360, height: content}, layoutMeasurement: {width: 360, height: view}}});

function renderScreen() {
  render(
    <Screen bottom={<Text>아래 버튼</Text>}>
      <Text>본문</Text>
    </Screen>,
  );
}

test('본문: 마지막 onScroll 이 끝 전에서 멈춰도 관성이 멈춘 위치(끝)로 "더 있음"을 지운다', () => {
  renderScreen();
  const body = screen.getByTestId('screen-body');
  act(() => fireEvent(body, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}}));
  act(() => fireEvent(body, 'contentSizeChange', 360, 900));
  expect(screen.getByTestId('screen-more', H_ALL)).toBeTruthy();
  act(() => fireEvent.scroll(body, ev(480))); // 끝(600) 전에 마지막으로 온 onScroll
  expect(screen.getByTestId('screen-more', H_ALL)).toBeTruthy();
  act(() => fireEvent(body, 'momentumScrollEnd', ev(600)));
  expect(screen.queryByTestId('screen-more', H_ALL)).toBeNull();
});

test('본문: 손을 뗀 위치가 끝이면(관성 없음) 그때 지운다', () => {
  renderScreen();
  const body = screen.getByTestId('screen-body');
  act(() => fireEvent(body, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}}));
  act(() => fireEvent(body, 'contentSizeChange', 360, 900));
  act(() => fireEvent(body, 'scrollEndDrag', ev(600)));
  expect(screen.queryByTestId('screen-more', H_ALL)).toBeNull();
});

test('옛 화면 Dock 이 넘치면 Dock 아래 흐림, Dock 끝까지 내리면 사라진다', () => {
  renderScreen();
  const dock = screen.getByTestId('screen-dock-scroll');
  expect(screen.queryByTestId('screen-dock-more', H_ALL)).toBeNull();
  act(() => fireEvent(dock, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 256}}}));
  act(() => fireEvent(dock, 'contentSizeChange', 360, 310));
  expect(screen.getByTestId('screen-dock-more', H_ALL)).toBeTruthy();
  act(() => fireEvent.scroll(dock, ev(30, 310, 256)));
  expect(screen.getByTestId('screen-dock-more', H_ALL)).toBeTruthy();
  act(() => fireEvent(dock, 'momentumScrollEnd', ev(54, 310, 256)));
  expect(screen.queryByTestId('screen-dock-more', H_ALL)).toBeNull();
});

test('Dock 이 넘치지 않으면 흐림이 없다', () => {
  renderScreen();
  const dock = screen.getByTestId('screen-dock-scroll');
  act(() => fireEvent(dock, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 122}}}));
  act(() => fireEvent(dock, 'contentSizeChange', 360, 122));
  expect(screen.queryByTestId('screen-dock-more', H_ALL)).toBeNull();
});
