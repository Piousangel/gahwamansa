// 응원 시트 v4(시안 child/C4_cheer_sheet_ds4 #40, UX 깊이 V14): ds Sheet + Choice(action) 1열, 확정 문구 4개.
import React from 'react';
import {StyleSheet, Text as RNText} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {AudienceProvider, Sheet, SHEET_MAX_RATIO} from '../src/ui/ds';
import {roleText} from '../src/ui/ds/roles';
import {press} from '../testUtils/flow';

const RN = require('react-native');
afterEach(() => {
  jest.restoreAllMocks();
});
jest.setTimeout(20000);

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
  const label = within(items[0]).UNSAFE_getByType(RNText);
  expect(label.props.maxFontSizeMultiplier).toBe(roleText('bodyLg', 'child').maxFontSizeMultiplier);
  expect(label.props.maxFontSizeMultiplier).toBeGreaterThan(1.5);
  await act(async () => fireEvent.press(items[2]));
  await waitFor(() => expect(screen.queryByText('어떤 말을 보낼까요?')).toBeNull());
});

test('ds Sheet: 넘칠 때만 아래 더 있음 띠(시트 안에서만 스크롤)', () => {
  render(
    <AudienceProvider value="child">
      <Sheet visible title="제목" closeLabel="닫기" onClose={() => {}} testID="s">
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
});
