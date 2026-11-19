// 응원 시트 v4(시안 child/C4_cheer_sheet_ds4 #40, UX 깊이 V14): ds Sheet + Choice(action) 1열, 확정 문구 4개.
import React from 'react';
import {StyleSheet, Text as RNText} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {AudienceProvider, Sheet, SHEET_MAX_RATIO} from '../src/ui/ds';
import {roleText} from '../src/ui/ds/roles';
import {press} from '../testUtils/flow';
import {warmAppRoot} from '../testUtils/warm';

const RN = require('react-native');
afterEach(() => {
  jest.restoreAllMocks();
});
jest.setTimeout(20000);
// PR #101 리뷰: 파일의 첫 테스트가 콜드 스타트(모듈 첫 로드·첫 렌더, 4~6초)를 혼자 떠안아 부하 때 흔들렸다(앱 쪽 경합 없음).
// → 파일 시작 때 AppRoot 를 한 번 그렸다 내려 그 비용을 미리 치른다. 대기 시간은 전역 asyncUtilTimeout(10초, #77 규칙) 그대로
beforeAll(warmAppRoot);

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const homeApi = () => createFakeApi({consented: true, parents: [{title: '엄마', latest: {prompt: '봄과 가을', choiceLabel: '봄', answeredDate: today}}]});

async function openSheet() {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
  render(<AppRoot api={homeApi()} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  await press('응원 보내기');
  await waitFor(() => screen.getByText('어떤 말을 보낼까요?'));
}

test('시트 머리: 제목(머리글) + 닫기 48×48 알약, 보조 한 줄, 손잡이 막대 없음(V14 ①)', async () => {
  await openSheet();
  expect(screen.getByText('하나를 누르면 바로 보내요')).toBeTruthy();
  const close = screen.getByRole('button', {name: '닫기'});
  const st = StyleSheet.flatten(typeof close.props.style === 'function' ? close.props.style({pressed: false}) : close.props.style);
  expect(st.minWidth).toBeGreaterThanOrEqual(48);
  expect(st.minHeight).toBeGreaterThanOrEqual(48);
  expect(screen.queryByTestId('sheet-handle', {includeHiddenElements: true})).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId('sheet').props.style).maxHeight).toBe(Math.floor(640 * SHEET_MAX_RATIO));
  await act(async () => fireEvent.press(close));
  await waitFor(() => expect(screen.queryByText('어떤 말을 보낼까요?')).toBeNull());
});

test('선택지: 확정 문구 4개 1열 Choice(action, 버튼), 글자는 bodyLg 역할 상한(150%로 묶지 않음, V14 ③), 누르면 바로 보낸다', async () => {
  await openSheet();
  const list = within(screen.getByTestId('cheer'));
  const items = list.getAllByRole('button');
  expect(items.map(b => b.props.accessibilityLabel)).toEqual(['사랑해요, 오늘도 좋은 하루예요', '덕분에 하루가 따뜻해요', '늘 고마워요', '오늘도 편안한 하루 보내세요']);
  // 사물 아이콘 4종(해·찻잔·새싹·쪽지, 디자인 #92) — 하트·이모지 없음(Q5), 장식이라 읽지 않음
  ['icon-sun', 'icon-teacup', 'icon-sprout', 'icon-note'].forEach((name, i) => {
    expect(within(items[i]).getByTestId(name, {includeHiddenElements: true})).toBeTruthy();
  });
  const label = within(items[0]).UNSAFE_getByType(RNText);
  expect(label.props.maxFontSizeMultiplier).toBe(roleText('bodyLg', 'child').maxFontSizeMultiplier);
  expect(label.props.maxFontSizeMultiplier).toBeGreaterThan(1.5);
  await act(async () => fireEvent.press(items[2]));
  await waitFor(() => expect(screen.queryByText('어떤 말을 보낼까요?')).toBeNull());
});

const sheetProps = {title: '제목', testID: 's'};
const opener = {current: {tag: 'opener'}};

describe('ds Sheet(공용, PR #93 L4)', () => {
  test('닫는 길 3가지: X·밖 누르기·안드로이드 뒤로', () => {
    const onClose = jest.fn();
    render(
      <Sheet visible {...sheetProps} onClose={onClose} returnFocusRef={opener}>
        <RNText>내용</RNText>
      </Sheet>,
    );
    fireEvent.press(screen.getByRole('button', {name: '닫기'}));
    fireEvent.press(screen.getByTestId('sheet-scrim', {includeHiddenElements: true}));
    act(() => screen.UNSAFE_getByType(RN.Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('모달(뒤 화면을 읽지 않음), 열리면 포커스가 제목으로(300ms 뒤)', () => {
    const spy = jest.spyOn(RN.AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    render(
      <Sheet visible {...sheetProps} onClose={() => {}} returnFocusRef={opener}>
        <RNText>내용</RNText>
      </Sheet>,
    );
    expect(screen.getByTestId('s').props.accessibilityViewIsModal).toBe(true);
    jest.useFakeTimers();
    try {
      act(() => screen.UNSAFE_getByType(RN.Modal).props.onShow?.());
      expect(spy).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(300));
      expect(spy).toHaveBeenCalledWith(expect.anything(), 'focus');
    } finally {
      jest.useRealTimers();
    }
  });

  test('R12·M1: 닫히면 연 버튼으로 포커스가 돌아간다(returnFocusRef 필수)', () => {
    jest.useFakeTimers();
    try {
      const spy = jest.spyOn(RN.AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
      render(
        <Sheet visible {...sheetProps} onClose={() => {}} returnFocusRef={opener}>
          <RNText>내용</RNText>
        </Sheet>,
      );
      spy.mockClear();
      screen.rerender(
        <Sheet visible={false} {...sheetProps} onClose={() => {}} returnFocusRef={opener}>
          <RNText>내용</RNText>
        </Sheet>,
      );
      act(() => jest.advanceTimersByTime(300));
      expect(spy).toHaveBeenCalledWith(opener.current, 'focus');
    } finally {
      jest.useRealTimers();
    }
  });

  test('L2: 아래 inset(3버튼 내비 48)은 패널 바닥 여백 → 더 있음 띠·내용이 내비 위', () => {
    const SafeArea = require('react-native-safe-area-context');
    const insets = SafeArea.useSafeAreaInsets as jest.Mock;
    const orig = insets.getMockImplementation();
    insets.mockImplementation(() => ({top: 24, bottom: 48, left: 0, right: 0}));
    try {
      render(
        <Sheet visible {...sheetProps} onClose={() => {}} returnFocusRef={opener}>
          <RNText>내용</RNText>
        </Sheet>,
      );
      expect(StyleSheet.flatten(screen.getByTestId('s').props.style).paddingBottom).toBe(48);
    } finally {
      screen.unmount();
      insets.mockImplementation(orig);
    }
  });
});

test('ds Sheet footer(PR #100 리뷰 L3): 스크롤 밖 아래에 고정(내용이 넘쳐도 스크롤 안에 들어가지 않음), 200%에서도 그대로', () => {
  for (const fontScale of [1, 2]) {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 320, height: 640, scale: 2.75, fontScale});
    render(
      <AudienceProvider value="child">
        <Sheet visible {...sheetProps} onClose={() => {}} returnFocusRef={opener} footer={<RNText testID="foot">저장</RNText>}>
          {Array.from({length: 12}, (_, i) => (
            <RNText key={i}>선택지 {i}</RNText>
          ))}
        </Sheet>
      </AudienceProvider>,
    );
    const scroll = screen.getByTestId('s-scroll');
    act(() => {
      fireEvent(scroll, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 320, height: 300}}});
      fireEvent(scroll, 'contentSizeChange', 320, 900); // 넘침 → 띠
    });
    expect(within(scroll).queryByTestId('foot')).toBeNull(); // 스크롤 내용 안이 아니다
    const footer = screen.getByTestId('s-footer');
    expect(within(footer).getByTestId('foot')).toBeTruthy();
    // 패널 안 순서: 스크롤 → 더 있음 띠 → footer(맨 아래 고정)
    const order = screen.root
      .findAll(n => typeof n.type === 'string' && ['s-scroll', 'more-band', 's-footer'].includes(n.props.testID))
      .map(n => n.props.testID);
    expect(order).toEqual(['s-scroll', 'more-band', 's-footer']);
    screen.unmount();
  }
});

test('ds Sheet: 넘칠 때만 아래 더 있음 띠, 끝까지 내리면 숨김(L1)', () => {
  render(
    <AudienceProvider value="child">
      <Sheet visible {...sheetProps} onClose={() => {}} returnFocusRef={opener}>
        <RNText>내용</RNText>
      </Sheet>
    </AudienceProvider>,
  );
  const scroll = screen.getByTestId('s-scroll');
  act(() => {
    fireEvent(scroll, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 400}}});
    fireEvent(scroll, 'contentSizeChange', 360, 380);
  });
  expect(screen.queryByTestId('more-band', {includeHiddenElements: true})).toBeNull();
  act(() => {
    fireEvent(scroll, 'contentSizeChange', 360, 700);
  });
  expect(screen.getByTestId('more-band', {includeHiddenElements: true})).toBeTruthy();
  act(() => {
    fireEvent.scroll(scroll, {nativeEvent: {contentOffset: {x: 0, y: 300}, contentSize: {width: 360, height: 700}, layoutMeasurement: {width: 360, height: 400}}});
  });
  expect(screen.queryByTestId('more-band', {includeHiddenElements: true})).toBeNull();
});

test('M1: 응원 시트를 닫으면 화면 읽기 포커스가 \'응원 보내기\'로 돌아간다', async () => {
  await openSheet();
  const spy = jest.spyOn(RN.AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  jest.useFakeTimers();
  try {
    await act(async () => fireEvent.press(screen.getByRole('button', {name: '닫기'})));
    act(() => jest.advanceTimersByTime(300));
    // 시트가 받은 returnFocusRef 가 '응원 보내기' 누름 영역에 붙어 있고, 닫힌 뒤 그곳으로 포커스
    const ref = screen.UNSAFE_getByType(Sheet).props.returnFocusRef as {current: unknown};
    expect(ref.current).toBeTruthy();
    const cheer = screen.getByRole('button', {name: '응원 보내기'});
    expect((ref.current as {props?: {accessibilityLabel?: string}}).props?.accessibilityLabel ?? cheer.props.accessibilityLabel).toBe('응원 보내기');
    expect(spy.mock.calls.some(c => c[1] === 'focus' && c[0] === ref.current)).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
