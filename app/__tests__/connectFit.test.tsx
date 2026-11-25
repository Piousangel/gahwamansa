import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {copy} from '../src/copy/copy';
import {pickStage} from '../src/features/link/p1Stage';
import {createFakeApi} from '../src/features/fakeApi';
import {keypadKeyHeight} from '../src/features/link/keypadFit';
import {wordKeyScaleMax} from '../src/ui/CodeInput';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const RN = require('react-native');
afterEach(() => {
  jest.restoreAllMocks();
});

test('계산: 칸 68(시안) + 키 4줄(키 + 6) + 12 = 4 x 키 + 104', () => {
  expect(keypadKeyHeight(4 * 68 + 104)).toBe(68);
  expect(keypadKeyHeight(4 * 66 + 104)).toBe(66);
  expect(keypadKeyHeight(4 * 64 + 104)).toBe(64);
  expect(keypadKeyHeight(4 * 60 + 104)).toBeNull(); // 64 미만이면 null(다음 단계로)
});

const dims = (width: number, height: number, fontScale = 1) =>
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width, height, scale: 2, fontScale});

async function openConnect() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
}
// 레이아웃 모의: 본문 창 높이(Screen 스크롤 창 onLayout)
const viewport = async (h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: h}}});
  });
const keyH = (label = '숫자 0') => {
  const st = screen.getByLabelText(label).props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight as number;
};
const inDock = (id: string) => {
  const dock = screen.queryByTestId('screen-dock');
  return !!dock && within(dock).queryByTestId(id) !== null;
};

const firstHeight = () => StyleSheet.flatten(screen.getByTestId('connect-first').props.style).minHeight as number | undefined;
const titleSize = () => StyleSheet.flatten(screen.getByRole('header').props.style).fontSize;
// 2단계(하단 고정 = 위 6 + 링크 줄 64 + 아래 max(28, 16+inset))를 뺀 창. 360×640 제스처 내비: 위 116(TopSafe 52 + 이전 바 64)
const FADE = 28;

// 리드 결정(11-19): 단계는 pickStage(창·글자·inset·문구) 한 번으로 정한다. 아래는 화면이 그 결과를 그대로 그리는지,
// 사후 검증(실제 키패드가 넘치면 한 단계, 최대 1회)만 onLayout 을 쓰는지 본다. jest 안전 영역 모의 inset 은 0.
const stageOf = (w: number, h: number, f: number) =>
  pickStage({
    windowH: h,
    windowW: w,
    fontScale: f,
    insets: {top: 0, bottom: 0},
    text: {title: copy.connect.title, safe: copy.safe.money, below: copy.connect.auto_hint, legal: copy.legal.agree_parent, links: [copy.connect.no_code_link, copy.connect.view_course]},
  });

describe('P1 화면 = pickStage 결과(이벤트를 기다리지 않음)', () => {
  for (const [w, h, f] of [
    [411, 914, 1],
    [360, 914, 1.3],
    [411, 740, 1],
    [360, 640, 1],
    [360, 640, 2], // 재확인 3 H4 재현 조건
    [320, 640, 1],
  ] as const) {
    test(`${w}×${h} 글자 ${f}: 첫 렌더부터 판정 단계(onLayout 없이)`, async () => {
      dims(w, h, f);
      await openConnect();
      const st = stageOf(w, h, f);
      expect(titleSize()).toBe(st.level >= 1 ? 22 : 28);
      expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true); // 안전망: 늘 스크롤 가능
      expect(inDock('legal-line')).toBe(st.level < 2);
      expect(inDock('connect-links')).toBe(st.level < 3);
      expect(keyH()).toBe(st.keyH);
      expect(firstHeight()).toEqual(st.level === 2 || st.level === 3 ? expect.any(Number) : undefined);
      // 묶음은 숨기지 않는다(빈 화면 없음)
      expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).opacity).toBeUndefined();
      expect(screen.getByLabelText('숫자 1')).toBeTruthy();
    });
  }

  test('재확인 3 H4: 360×640 글자 200% 는 영역이 0 으로 눌려 onLayout 이 다시 오지 않아도 바로 4단계', async () => {
    dims(360, 640, 2);
    await openConnect();
    expect(stageOf(360, 640, 2).level).toBe(4);
    expect(firstHeight()).toBeUndefined(); // 4단계: 묶음 고정 없음, 보통 배치 + 스크롤
    expect(keyH()).toBe(64);
    expect(within(screen.getByTestId('screen-body')).getByTestId('connect-links')).toBeTruthy();
    expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
  });
});

// 사후 검증(재확인 4 H5): 내용이 예정 높이보다 크면 ① 넘친 만큼 키를 줄임(64 이상) ② 아니면 한 단계 ③ 그래도 넘치면 4단계. 최대 2회
// 재확인 5 M9: 넘침은 내용 높이(키패드 영역 y + 키패드 실제 높이)로 잰다 — 묶음 컨테이너(minHeight·flexGrow) 높이가 아니다
const AREA_Y = 140;
const content = async (bottom: number, y = AREA_Y) =>
  act(async () => {
    fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: 999}}});
    // 실제 배치처럼 지금 그려진 칸·키 사이 여백(keys-gap)을 내용 높이에 더한다
    fireEvent(screen.getByTestId('keypad-content'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: bottom - y + keysGapNow()}}});
  });
const keysGapNow = () => {
  const g = screen.queryByTestId('keys-gap');
  return g ? (StyleSheet.flatten(g.props.style).height as number) : 0;
};
const block = content; // 아래 테스트의 '묶음 높이' = 내용 아래 끝
const FILL_BOTTOM = 8;

describe('사후 검증(재확인 4 H5, 최대 2회·올리기만)', () => {
  test('넘침이 작으면 같은 단계에서 키를 줄인다(재현 F: 어림 68 → 실제 영역은 64 만 들어감)', async () => {
    dims(411, 914);
    await openConnect();
    const st = stageOf(411, 914, 1);
    expect(st.level).toBe(0);
    await viewport(700);
    const expected = 700 - 4 - FILL_BOTTOM;
    await block(expected + 10); // 10 넘침 → 키 4줄에서 3 씩 덜면 들어감
    expect(titleSize()).toBe(28); // 0단계 유지
    expect(keyH()).toBe(Math.floor(st.keyH - 10 / 4));
  });

  test('64 로도 안 되면 한 단계, 올린 뒤에도 넘치면 곧바로 4단계(잘림 없이 보통 배치 + 스크롤), 더는 없다', async () => {
    dims(411, 914);
    await openConnect();
    await viewport(700);
    await block(700 - 4 - FILL_BOTTOM + 60); // 많이 넘침
    expect(titleSize()).toBe(22); // 1단계
    await block(700 - 4 - FILL_BOTTOM + 40); // 1단계 키로 그린 묶음도 넘침
    expect(firstHeight()).toBeUndefined(); // 4단계: 묶음 고정 없음
    expect(keyH()).toBe(64);
    await block(900);
    expect(keyH()).toBe(64); // 4단계에서 멈춤
  });

  test('다른 단계·다른 키 높이로 잰 묶음은 쓰지 않는다(옛 값으로 판정하지 않음)', async () => {
    dims(411, 914);
    await openConnect();
    await block(2000); // 창을 모를 때
    expect(titleSize()).toBe(28);
  });

  test('안전망: 단계와 상관없이 본문은 늘 스크롤할 수 있다(맞으면 스크롤이 생기지 않음)', async () => {
    for (const [w, h] of [[411, 914], [320, 640]] as const) {
      dims(w, h);
      await openConnect();
      expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true);
      screen.unmount();
      jest.restoreAllMocks();
    }
  });

  test('글자 크기가 바뀌면 판정을 처음부터(사후 조정도 무효)', async () => {
    const spy = dims(411, 914);
    await openConnect();
    await viewport(700);
    await block(700 - 4 - FILL_BOTTOM + 60);
    expect(titleSize()).toBe(22);
    spy.mockReturnValue({width: 411, height: 900, scale: 2, fontScale: 1});
    await act(async () => {
      fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 590}}});
    });
    await waitFor(() => expect(titleSize()).toBe(stageOf(411, 900, 1).level >= 1 ? 22 : 28));
  });
});

describe('재확인 5 M9: 컨테이너가 아니라 내용 높이로 넘침을 잰다', () => {
  test('재현 G: 360×740(3단계·키 68) — 어림 minHeight 로 늘어난 묶음과 더 작은 실제 창을 비교해 4단계로 가지 않는다', async () => {
    dims(360, 740);
    await openConnect();
    const st = stageOf(360, 740, 1);
    expect(st).toEqual({level: 3, keyH: 68});
    const guess = firstHeight() as number; // 어림 묶음 높이(minHeight)
    // 묶음 컨테이너는 어림 minHeight 로 늘어나 있다(옛 판정은 이 값을 썼다)
    await act(async () => {
      fireEvent(screen.getByTestId('connect-first'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: guess}}});
    });
    await viewport(guess + 4 + FADE - 20); // 실제 창은 어림보다 20 작다
    const real = firstHeight() as number;
    expect(real).toBe(guess - 20);
    // 내용(제목·안심 줄 아래 키패드)은 실제 창 안에 들어간다
    await content(real - 5);
    expect(keyH()).toBe(68);
    expect(firstHeight()).toBe(real); // 3단계 그대로(4단계면 minHeight 없음)
    expect(inDock('connect-links')).toBe(false);
  });

  test('0단계에서 하단 고정에 오프라인 Banner 가 생겨 창이 줄어도, 내용이 들어가면 키·단계 그대로', async () => {
    dims(411, 914);
    await openConnect();
    const st = stageOf(411, 914, 1);
    await viewport(700);
    await content(600); // 여유 있게 들어감
    await viewport(640); // Banner 로 하단 고정이 커져 창이 60 줄어듦
    expect(titleSize()).toBe(28);
    expect(keyH()).toBe(st.keyH);
    // 정말로 넘치게 되면(내용 아래 끝 > 예정) 그때 조정한다
    await content(640 - 4 - FILL_BOTTOM + 8);
    expect(keyH()).toBe(st.keyH - 2);
  });

  test('재확인 5 L22: fill 화면이어도 안전망으로 넘치면 아래 \'더 있음\' 흐림이 보인다', async () => {
    dims(411, 914);
    await openConnect();
    const body = screen.getByTestId('screen-body');
    await act(async () => {
      fireEvent(body, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 600}}});
      fireEvent(body, 'scroll', {nativeEvent: {contentOffset: {x: 0, y: 0}, contentSize: {width: 312, height: 900}, layoutMeasurement: {width: 312, height: 600}}});
    });
    expect(screen.getByTestId('screen-more', {includeHiddenElements: true})).toBeTruthy();
  });
});

// 리드 결정 L25·디자인 #54(RULES-V4 R-15): 4단계 첫 화면 끝이 키 줄을 반쯤 가르면 그 줄 앞에 여백을 넣어 줄째로 접힘 밖으로(키 64 그대로)
describe('4단계 접힘 경계는 줄 경계', () => {
  const rowsAt = async (ys: number[], h = 64) =>
    act(async () => {
      ys.forEach((y, i) => fireEvent(screen.getByTestId(`key-row-${i + 1}`), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}}));
    });
  const areaY = async (y: number) =>
    act(async () => {
      fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: 400}}});
    });
  // 키패드 안 줄 위치: 칸 68 + 12 + 칸 아래 줄 34 = 114 부터 70 간격
  const ROWS = [114, 184, 254, 324];

  test('360×640 1.0: 0·지움 줄이 접힘에 반쯤 걸리면 그 줄 앞에 여백 → 줄 전체가 접힘 밖, 키 64 그대로', async () => {
    dims(360, 640);
    await openConnect();
    expect(stageOf(360, 640, 1).level).toBe(4);
    await viewport(560); // 4단계 창(하단 고정 없음, 모의 inset 0) → 접힘 560, 흐림 532부터
    await areaY(130); // 키패드 위 끝 = 4 + 130 = 134 → 줄 위 끝 248·318·388·458
    await rowsAt(ROWS);
    // 4번째 줄(458~522)은 흐림(532) 위라 걸리지 않는다 → 여백 없음
    expect(screen.queryByTestId('fold-gap')).toBeNull();
    await viewport(500); // 접힘 500, 흐림 472 → 4번째 줄(458~522)이 반쯤
    const gap = screen.getByTestId('fold-gap');
    expect(StyleSheet.flatten(gap.props.style).height).toBe(500 - 458); // 줄 위 끝을 접힘으로
    expect(keyH()).toBe(64);
    // 여백을 넣은 뒤의 줄 위치(여백만큼 아래)로 다시 와도 판정이 흔들리지 않는다
    await rowsAt([ROWS[0], ROWS[1], ROWS[2], ROWS[3] + 42]);
    expect(StyleSheet.flatten(screen.getByTestId('fold-gap').props.style).height).toBe(42);
  });

  test('200%처럼 1~9 줄이 걸리면 그 줄(예: 7·8·9) 앞에서 끊는다(어떤 배율에서도 줄 경계)', async () => {
    dims(360, 640, 2);
    await openConnect();
    await viewport(560);
    await areaY(300); // 큰 글자: 제목·안심 줄이 길다 → 위 끝 304, 줄 418·488·558·628
    await rowsAt(ROWS);
    const gap = screen.getByTestId('fold-gap');
    expect(StyleSheet.flatten(gap.props.style).height).toBe(560 - 488); // 2번째 줄(488~552)이 흐림(532)에 걸림 → 그 앞에서
    const container = screen.getByTestId('key-row-2').parent;
    expect(container).toBeTruthy();
  });

  test('재확인 7 M10: 3버튼 내비(inset 48)는 시스템 버튼에 덮이는 줄도 접힘 밖으로(흐림 28 대신 48)', async () => {
    const SafeArea = require('react-native-safe-area-context');
    const insets = SafeArea.useSafeAreaInsets as jest.Mock;
    const orig = insets.getMockImplementation();
    insets.mockImplementation(() => ({top: 0, bottom: 48, left: 0, right: 0}));
    try {
      dims(360, 640);
      await openConnect();
      await viewport(560); // 접힘 560. 제스처라면 흐림 532 → 4번째 줄(458~522)은 통과
      await areaY(130); // 줄 위 끝 248·318·388·458, 4번째 줄 아래 끝 522
      await rowsAt([114, 184, 254, 324 + 6]); // 4번째 줄 464~528: 532 위지만 560 − 48 = 512 아래 → 버튼 밑
      const gap = screen.getByTestId('fold-gap');
      expect(StyleSheet.flatten(gap.props.style).height).toBe(560 - 464); // 줄 위 끝을 접힘(창 아래 끝)으로
      expect(keyH()).toBe(64);
      // 같은 줄 배치를 inset 0(제스처)에서는 밀지 않는다 — 위 '360×640 1.0' 테스트의 4번째 줄(458~522) 경우와 같음
    } finally {
      screen.unmount();
      insets.mockImplementation(orig);
    }
  });

  test('0~3단계에서는 여백을 넣지 않는다(첫 화면 묶음이 키패드를 담는다)', async () => {
    dims(411, 914);
    await openConnect();
    expect(screen.queryByTestId('fold-gap')).toBeNull();
  });
});

describe('2·3단계 묶음(그리기)', () => {
  test('잰 본문 창이 오면 묶음 = 창 − 위 여백 − 흐림(재리뷰 M1), 판정은 바뀌지 않는다', async () => {
    dims(360, 914, 1.3);
    await openConnect();
    const st = stageOf(360, 914, 1.3);
    expect(st.level === 2 || st.level === 3).toBe(true);
    await viewport(600);
    expect(firstHeight()).toBe(600 - 4 - FADE);
    expect(titleSize()).toBe(22);
    expect(inDock('connect-links')).toBe(st.level < 3);
  });

  test('읽기·시선 순서(3단계 이상): 제목 → 안심 줄 → 키패드 → 링크 → 약관(M5)', async () => {
    dims(320, 640);
    await openConnect();
    const ids = ['connect-safe', 'keypad-area', 'connect-links', 'legal-line'];
    const found = screen.root.findAll((n: {props: {testID?: string}}) => ids.includes(n.props.testID ?? ''), {deep: true});
    expect([...new Set(found.map((n: {props: {testID?: string}}) => n.props.testID))]).toEqual(ids);
  });

  test("재리뷰 L2: 스크롤 단계의 '번호가 없어요' 안내는 묶음 밖(링크 근처)", async () => {
    dims(320, 640);
    await openConnect();
    await press('번호가 없어요');
    expect(screen.getByTestId('connect-help')).toBeTruthy();
    expect(within(screen.getByTestId('connect-first')).queryByTestId('connect-help')).toBeNull();
  });
});

test('링크 두 개는 한 줄에 나란히', async () => {
  dims(411, 914);
  await openConnect();
  const row = screen.getByTestId('connect-links');
  expect(within(row).getByRole('button', {name: '번호가 없어요'})).toBeTruthy();
  expect(within(row).getByRole('button', {name: '코스 보기'})).toBeTruthy();
  expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
});

test('M6: 글자 키(모두 지움)는 어절 단위로만 줄바꿈(Android 는 음절 사이 WJ), 글자 22 이상', async () => {
  const {keepAllChildren} = require('../src/ui/koreanText');
  expect(keepAllChildren('모두 지움', 'android')).toBe('모⁠두 지⁠움');
  await openConnect();
  const k = screen.getByTestId('key-모두 지움', {includeHiddenElements: true});
  expect(k.props.lineBreakStrategyIOS).toBe('hangul-word');
  expect(StyleSheet.flatten(k.props.style).fontSize).toBeGreaterThanOrEqual(22);
});

// 디자인 결정(11-19, 키패드 남는 높이): 모든 줄 같은 높이·키 64~68. 남는 높이는 칸·키 사이 최대 24 → 나머지는 키패드 위·아래 반씩
describe('키패드 남는 높이', () => {
  const area = async (h: number, contentH: number) =>
    act(async () => {
      fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y: AREA_Y, width: 312, height: h}}});
      fireEvent(screen.getByTestId('keypad-content'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: contentH + keysGapNow()}}});
    });

  test('남는 높이가 24 이하면 전부 칸·키 사이 여백으로, 넘으면 24 까지만(나머지는 영역 가운데 정렬로 위·아래 반씩)', async () => {
    dims(411, 914);
    await openConnect();
    await viewport(700);
    await area(400, 390);
    expect(keysGapNow()).toBe(10);
    await area(500, 390);
    expect(keysGapNow()).toBe(24);
    expect(StyleSheet.flatten(screen.getByTestId('keypad-area').props.style).justifyContent).toBe('center');
    // 여백이 들어간 뒤 다시 재도 내용 높이는 여백을 뺀 값이라 흔들리지 않는다
    await area(500, 390);
    expect(keysGapNow()).toBe(24);
    expect(keyH()).toBeLessThanOrEqual(68);
  });

  test('4단계(넘침)에서는 여백을 더하지 않는다(영역·내용 onLayout 이 와도)', async () => {
    dims(360, 640);
    await openConnect();
    await viewport(560);
    await area(600, 400); // 재확인 8 L34: 남는 높이가 있는 것처럼 재도 4단계는 여백 0
    expect(screen.queryByTestId('keys-gap')).toBeNull();
  });

  test('여백은 버림(Math.floor): 남는 높이 10.6 → 10', async () => {
    dims(411, 914);
    await openConnect();
    await viewport(700);
    await area(400.6, 390);
    expect(keysGapNow()).toBe(10);
  });

  test('모든 줄 같은 높이: 글자 키(모두 지움·지움)는 두 줄이 키 안에 들어가는 줄높이·확대 상한', async () => {
    dims(360, 740);
    await openConnect();
    const k = keyH();
    expect(keyH('모두 지움')).toBe(k);
    expect(keyH('한 칸 지우기')).toBe(k);
    const word = screen.getByTestId('key-모두 지움');
    const st = StyleSheet.flatten(word.props.style);
    const m = word.props.maxFontSizeMultiplier as number;
    expect(2 * st.lineHeight * m + 4).toBeLessThanOrEqual(k + 0.01); // 두 줄 + 테두리 ≤ 키
    expect(st.fontSize).toBe(26); // 글자 크기는 시안 그대로
    expect(wordKeyScaleMax(68)).toBeLessThanOrEqual(1.5);
    expect(wordKeyScaleMax(64)).toBeGreaterThanOrEqual(1);
    // 재확인 8 M11: 한 줄인 '지움'은 1.5 까지(숫자 키와 같은 상한), 두 줄 '모두 지움'만 두 줄 기준
    const del = screen.getByTestId('key-지움');
    expect(del.props.maxFontSizeMultiplier).toBe(1.5);
    expect(wordKeyScaleMax(k, 26, 1)).toBe(1.5);
    const one = StyleSheet.flatten(del.props.style);
    expect(one.lineHeight * del.props.maxFontSizeMultiplier + 4).toBeLessThanOrEqual(k + 0.01);
  });
});

// 대기열 53: 411×914 글자 130%(에뮬레이터 실측 2단계)에서 첫 화면 묶음 아래 약관 줄 첫 줄이 '더 있음' 흐림(28) 안에 12 걸쳐
// 반쯤 잘린 채 보였다(묶음 끝 = 창 − 흐림, 그 뒤 본문 간격 16 → 다음 요소 위 끝 = 창 − 12). 다음 요소는 첫 화면 끝(창 아래 끝)부터 시작해야 한다(R-15)
describe('대기열 53: 2·3단계 묶음 아래 요소(약관 줄·링크)는 첫 화면 밖에서 시작', () => {
  const BODY_GAP = 16;
  const FIRST_PAD = 4;
  const marginBottom = () => (StyleSheet.flatten(screen.getByTestId('connect-first').props.style).marginBottom as number | undefined) ?? 0;
  for (const [w, h, f, lv] of [
    [360, 740, 1, 3],
    [360, 914, 1.3, 2],
  ] as const) {
    test(`${w}×${h} 글자 ${f}(${lv}단계): 묶음 끝 + 여백 + 간격 = 창 아래 끝`, async () => {
      expect(stageOf(w, h, f).level).toBe(lv);
      dims(w, h, f);
      await openConnect();
      await viewport(600);
      const first = firstHeight() as number;
      expect(first).toBe(600 - FIRST_PAD - FADE);
      // 고치기 전: 4 + 568 + 0 + 16 = 588 → 약관(2단계)·링크(3단계) 위 12 가 첫 화면 흐림 안에 보였다
      expect(FIRST_PAD + first + marginBottom() + BODY_GAP).toBe(600);
    });
  }

  // 대기열 55(#294 리뷰 L1): 3단계는 하단 고정이 없어 3버튼 내비(inset 48)가 창 아래를 덮는다 → 묶음·여백에 inset 을 더해야 한다
  test('360×740 글자 1(3단계) 3버튼 내비 inset 48: 여백 = 흐림 28 + 48 − 간격 16 = 60, 위 여백 + 묶음 + 여백 + 간격 = 창', async () => {
    const SafeArea = require('react-native-safe-area-context');
    const insets = SafeArea.useSafeAreaInsets as jest.Mock;
    const orig = insets.getMockImplementation();
    insets.mockImplementation(() => ({top: 0, bottom: 48, left: 0, right: 0}));
    try {
      const st = pickStage({
        windowH: 740,
        windowW: 360,
        fontScale: 1,
        insets: {top: 0, bottom: 48},
        text: {title: copy.connect.title, safe: copy.safe.money, below: copy.connect.auto_hint, legal: copy.legal.agree_parent, links: [copy.connect.no_code_link, copy.connect.view_course]},
      });
      expect(st.level).toBe(3);
      dims(360, 740);
      await openConnect();
      await viewport(600);
      const first = firstHeight() as number;
      expect(first).toBe(600 - FIRST_PAD - FADE - 48);
      expect(marginBottom()).toBe(60);
      expect(FIRST_PAD + first + marginBottom() + BODY_GAP).toBe(600);
    } finally {
      screen.unmount();
      insets.mockImplementation(orig);
    }
  });
});
