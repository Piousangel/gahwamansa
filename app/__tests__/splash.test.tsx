import React from 'react';
import {AccessibilityInfo, Animated, NativeModules} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
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
  resetSplash(); // 이 파일은 스플래시를 처음 상태부터 본다(jest.after.js 가 끝낸 상태를 되돌림)
  (NativeModules as {SplashModule?: unknown}).SplashModule = {hide: jest.fn()};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('안드로이드: core-splashscreen 1.2.0 고정, 스플래시 테마(종이색 + 브랜드 D안 splash_icon PNG)', () => {
  expect(fs.readFileSync(android('build.gradle'), 'utf8')).toContain('androidx.core:core-splashscreen:1.2.0');
  expect(fs.readFileSync(android('src/main/AndroidManifest.xml'), 'utf8')).toContain('android:theme="@style/Theme.App.Starting"');
  const styles = fs.readFileSync(android('src/main/res/values/styles.xml'), 'utf8');
  expect(styles).toContain('<item name="windowSplashScreenBackground">@color/paper</item>');
  expect(styles).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>');
  expect(styles).toContain('<item name="postSplashScreenTheme">@style/AppTheme</item>');
  const main = fs.readFileSync(android('src/main/java/com/bumojasik/app/MainActivity.kt'), 'utf8');
  expect(main).toContain('installSplashScreen()');
  expect(main).toContain('SplashState.SAFETY_MS');
});

// 브랜드 심볼 D안(살구 인장 '家' + 옛날 사진, DECISIONS 2026-11-17). 원본: design-system/assets/brand
const DPIS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const brand = (p: string) => `${__dirname}/../../design-system/assets/brand/${p}`;
const same = (a: string, b: string) => {
  const r: {readFileSync(f: string): {equals(o: unknown): boolean}} = require('fs');
  return r.readFileSync(a).equals(r.readFileSync(b));
};

test('런처 아이콘: 적응형 전경·배경·단색 PNG 레이어 + 레거시 5밀도, 모두 브랜드 원본과 같은 파일', () => {
  for (const n of ['ic_launcher', 'ic_launcher_round']) {
    const xml = fs.readFileSync(android(`src/main/res/mipmap-anydpi-v26/${n}.xml`), 'utf8');
    expect(xml).toContain('@mipmap/ic_launcher_background');
    expect(xml).toContain('@mipmap/ic_launcher_foreground');
    expect(xml).toContain('@mipmap/ic_launcher_monochrome');
  }
  for (const n of ['ic_launcher', 'ic_launcher_round']) {
    expect(same(android(`src/main/res/mipmap-anydpi-v26/${n}.xml`), brand(`android/res/mipmap-anydpi-v26/${n}.xml`))).toBe(true);
  }
  for (const d of DPIS) {
    for (const n of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background', 'ic_launcher_monochrome']) {
      expect(same(android(`src/main/res/mipmap-${d}/${n}.png`), brand(`android/res/mipmap-${d}/${n}.png`))).toBe(true);
    }
    expect(same(android(`src/main/res/drawable-${d}/splash_icon.png`), brand(`android/res/drawable-${d}/splash_icon.png`))).toBe(true);
  }
});

test('예전 해+폴라로이드 리소스는 없고, 스테이징 변형은 아직 연결하지 않는다(09 환경 분리 때)', () => {
  for (const f of ['src/main/res/drawable/ic_launcher_foreground.xml', 'src/main/res/drawable/splash_symbol.xml', 'src/staging']) {
    expect(fs.existsSync(android(f))).toBe(false);
  }
  expect(fs.existsSync(`${__dirname}/../src/ui/assets/symbol-sun-polaroid.svg`)).toBe(false);
});

// 사용자 피드백("D안이랑 좀 달라졌지"): 앱 안도 평면판이 아니라 D안 3D 그대로(네이티브 스플래시와 같은 그림)
test('앱 안 심볼은 D안 3D PNG(164: 대기·이동, 40: 워드마크 옆), 브랜드 폴더 렌더와 같은 파일, 평면판은 쓰지 않는다', () => {
  for (const n of ['symbol-3d-164', 'symbol-3d-40']) {
    for (const sfx of ['', '@2x', '@3x']) {
      expect(same(`${__dirname}/../src/ui/assets/${n}${sfx}.png`, brand(`png/${n}${sfx}.png`))).toBe(true);
    }
  }
  const src = fs.readFileSync(`${__dirname}/../src/ui/assets/brandSymbol.tsx`, 'utf8');
  expect(src).not.toMatch(/symbol-flat|SvgXml/);
});

test('BrandSymbol: 40 이하면 40 PNG, 그보다 크면 164 PNG', () => {
  const {BrandSymbol} = require('../src/ui/assets/brandSymbol');
  const {render: r} = require('@testing-library/react-native');
  const pick = (size: number) => {
    const {getByTestId, unmount} = r(<BrandSymbol size={size} />);
    const node = getByTestId('brand-symbol', {includeHiddenElements: true});
    const out = {src: node.props.source, style: node.props.style};
    unmount();
    return out;
  };
  expect(pick(40).src).toBe(require('../src/ui/assets/symbol-3d-40.png'));
  expect(pick(164).src).toBe(require('../src/ui/assets/symbol-3d-164.png'));
  expect(pick(164).style).toMatchObject({width: 164, height: 164});
});

test('대기 화면 심볼은 네이티브 스플래시와 같은 크기·자리(288 캔버스의 64상자 → 164dp, 중심이 2dp 위)', () => {
  const {SPLASH_SYMBOL, SPLASH_LIFT} = require('../src/app/SplashOverlay');
  expect(SPLASH_SYMBOL).toBe(164);
  expect(SPLASH_LIFT).toBe(2);
  const gen = fs.readFileSync(brand('_src/gen.mjs'), 'utf8');
  expect(gen).toContain('place("3d", 62, 60, 164)'); // 디자이너 생성기의 스플래시 배치가 바뀌면 이 값도 함께
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

test('첫 실행: 가운데 심볼(164)이 워드마크 옆(40)으로 날아간다(450ms, 네이티브 드라이버)', () => {
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

test('첫 실행: 시작 대기(심볼) 뒤 이어서 날아가는 심볼, 목표를 못 받아도 1초 뒤 사라진다, 두 번째 첫 화면에서는 없다', async () => {
  jest.useFakeTimers();
  const {unmount} = render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByTestId('splash-hold')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(200); // 대기 화면 없음 → 시작 대기 끝
  });
  expect(screen.queryByTestId('splash-hold')).toBeNull();
  expect(screen.getByTestId('splash-flight', {includeHiddenElements: true})).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(screen.queryByTestId('splash-flight', {includeHiddenElements: true})).toBeNull();
  unmount();
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.queryByTestId('splash-flight', {includeHiddenElements: true})).toBeNull();
});

// 실기기 지적(20-splash.png): 자녀 세션 복원 중 ChildGate 의 좌상단 "잠시만요"가 보였다.
// 모든 시작 경로에서 처음에는 심볼 대기 화면 하나만, "잠시만요"는 2초가 넘을 때 심볼 아래에만.
const never = () => new Promise<never>(() => {});
describe.each([
  ['첫 실행(복원 확인 중)', () => {
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockImplementation(never);
    return api;
  }],
  ['어르신 세션(코스 불러오는 중)', () => {
    const api = createFakeApi({who: 'parent', linked: true, consented: true});
    jest.spyOn(api, 'getTodayContent').mockImplementation(never);
    return api;
  }],
  ['자녀 세션(자녀 상태 확인 중 = ChildGate)', () => {
    const api = createFakeApi({who: 'child', childFamily: true});
    jest.spyOn(api, 'getChildState').mockImplementation(never);
    return api;
  }],
  ['자녀 세션(연결됨, 앨범 불러오는 중)', () => {
    const api = createFakeApi({who: 'child', childFamily: true, childLinked: true});
    jest.spyOn(api, 'fetchChildSummary').mockImplementation(never);
    return api;
  }],
  ['자녀 세션(연결 대기, 대기 화면 불러오는 중)', () => {
    const api = createFakeApi({who: 'child', childFamily: true});
    let n = 0;
    const real = api.getChildState.bind(api);
    jest.spyOn(api, 'getChildState').mockImplementation(() => (n++ === 0 ? real() : never()));
    return api;
  }],
])('시작 경로 %s', (_name, make) => {
  test('처음에는 심볼 대기 화면만(뒤 화면의 "잠시만요" 없음), 2초가 넘으면 심볼 아래에만 "잠시만요"', async () => {
    jest.useFakeTimers();
    render(<AppRoot api={make()} restore />);
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(100); // 1초: 경로를 따라 화면이 바뀌어도
      });
      expect(screen.getByTestId('splash-hold')).toBeTruthy();
      expect(screen.queryByText('잠시만요')).toBeNull();
    }
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.getAllByText('잠시만요')).toHaveLength(1); // 뒤 화면 것은 화면 읽기·쿼리에서 숨겨짐
    expect(screen.getByTestId('splash-hold')).toHaveTextContent('잠시만요');
  });
});

test('오프라인: 시작 대기가 끝나고 오프라인 화면이 바로 보인다(대기 화면이 덮지 않음)', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'whoAmI').mockRejectedValue(new (require('../src/features/types').OfflineError)('x'));
  render(<AppRoot api={api} restore />);
  expect(screen.getByTestId('splash-hold')).toBeTruthy();
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.queryByTestId('splash-hold')).toBeNull();
});

test('세션 복원이 끝나면 대기 화면이 걷히고 실제 화면(어르신 코스 홈)', async () => {
  render(<AppRoot api={createFakeApi({who: 'parent', linked: true, consented: true})} restore />);
  await waitFor(() => screen.getByText('오늘의 코스'));
  await waitFor(() => expect(screen.queryByTestId('splash-hold')).toBeNull());
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
