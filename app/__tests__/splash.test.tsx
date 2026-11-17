import React from 'react';
import {AccessibilityInfo, Animated, NativeModules} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';
import {resetSplash} from '../src/app/splash';
import {SplashOverlay} from '../src/app/SplashOverlay';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string; existsSync(f: string): boolean} = require('fs');
const android = (p: string) => `${__dirname}/../android/app/${p}`;

beforeEach(() => {
  resetFirstScreenMotion();
  resetSplash();
  (NativeModules as {SplashModule?: unknown}).SplashModule = {hide: jest.fn()};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('안드로이드: core-splashscreen 1.2.0 고정, 스플래시 테마(종이색·벡터 심볼), 적응형 런처 아이콘', () => {
  expect(fs.readFileSync(android('build.gradle'), 'utf8')).toContain('androidx.core:core-splashscreen:1.2.0');
  expect(fs.readFileSync(android('src/main/AndroidManifest.xml'), 'utf8')).toContain('android:theme="@style/Theme.App.Starting"');
  const styles = fs.readFileSync(android('src/main/res/values/styles.xml'), 'utf8');
  expect(styles).toContain('<item name="windowSplashScreenBackground">@color/paper</item>');
  expect(styles).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/splash_symbol</item>');
  expect(styles).toContain('<item name="postSplashScreenTheme">@style/AppTheme</item>');
  expect(fs.readFileSync(android('src/main/res/drawable/splash_symbol.xml'), 'utf8')).toContain('android:viewportWidth="288"');
  const icon = fs.readFileSync(android('src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), 'utf8');
  expect(icon).toContain('@drawable/ic_launcher_foreground');
  expect(icon).toContain('@color/paper');
  const main = fs.readFileSync(android('src/main/java/com/bumojasik/app/MainActivity.kt'), 'utf8');
  expect(main).toContain('installSplashScreen()');
  expect(main).toContain('SplashState.SAFETY_MS');
});

test('JS 첫 화면이 그려지면(루트 onLayout) 네이티브 스플래시를 한 번만 걷는다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  const root = screen.getByTestId('app-root');
  await act(async () => {
    fireEvent(root, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 780}}});
    fireEvent(root, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 780}}});
  });
  expect((NativeModules as {SplashModule: {hide: jest.Mock}}).SplashModule.hide).toHaveBeenCalledTimes(1);
});

test('복원 대기 화면은 "잠시만요" 글자 대신 심볼만, 2초가 넘으면 그때 "잠시만요"', async () => {
  jest.useFakeTimers();
  const api = createFakeApi();
  jest.spyOn(api, 'whoAmI').mockImplementation(() => new Promise(() => {}));
  render(<AppRoot api={api} restore />);
  expect(screen.getByTestId('splash-hold')).toBeTruthy();
  expect(screen.queryByText('잠시만요')).toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(2100);
  });
  expect(screen.getByText('잠시만요')).toBeTruthy();
});

test('첫 실행: 가운데 심볼(128)이 워드마크 옆(40)으로 날아간다(450ms, 네이티브 드라이버)', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const onDone = jest.fn();
  render(<SplashOverlay win={{width: 360, height: 780}} target={{x: 24, y: 60, size: 40}} mode="full" onDone={onDone} />);
  const calls = timing.mock.calls.map(c => c[1] as {duration: number; useNativeDriver: boolean});
  expect(calls.some(c => c.duration === 450 && c.useNativeDriver)).toBe(true);
  expect(screen.getByTestId('splash-flight', {includeHiddenElements: true})).toBeTruthy();
});

test('동작 줄이기: 이동 없이 300ms 페이드아웃만', () => {
  const timing = jest.spyOn(Animated, 'timing');
  render(<SplashOverlay win={{width: 360, height: 780}} target={{x: 24, y: 60, size: 40}} mode="reduce" onDone={() => {}} />);
  const durations = new Set(timing.mock.calls.map(c => (c[1] as {duration: number}).duration));
  expect([...durations]).toEqual([300]);
});

test('첫 실행 오버레이는 목표 위치를 못 받아도 1초 뒤 사라진다(안전장치), 두 번째 첫 화면에서는 없다', async () => {
  jest.useFakeTimers();
  const {unmount} = render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByTestId('splash-flight', {includeHiddenElements: true})).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(screen.queryByTestId('splash-flight', {includeHiddenElements: true})).toBeNull();
  unmount();
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.queryByTestId('splash-flight', {includeHiddenElements: true})).toBeNull();
});

test('날아오는 심볼이 도착하기 전에는 첫 화면의 진짜 심볼을 숨기고, 도착하면 보인다', async () => {
  const {finishFlight} = require('../src/app/splash');
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {});
  expect(screen.getByTestId('brand-symbol-seat', {includeHiddenElements: true})).toHaveStyle({opacity: 0});
  await act(async () => finishFlight());
  expect(screen.queryByTestId('splash-flight', {includeHiddenElements: true})).toBeNull();
  expect(screen.getByTestId('brand-symbol-seat', {includeHiddenElements: true})).not.toHaveStyle({opacity: 0});
});
