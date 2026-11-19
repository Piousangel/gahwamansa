// QA 실기기 스모크(2026-11-17, docs/team/qa/2026-11-17-device-smoke.md) B2·B3·B4·B6·시안 불일치 + 접근성 명세 5절
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import * as SafeArea from 'react-native-safe-area-context';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {Screen} from '../src/ui/Screen';
import {Text20} from '../src/ui/Text20';
import {StampRow} from '../src/features/course/StampRow';
import {SelectCard} from '../src/ui/SelectCard';
import {press, pressBackLink} from '../testUtils/flow';
import {P4_LAYOUT} from '../src/features/course/PhotoStep';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function previewHome() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
}
const texts = (root: ReturnType<typeof screen.getByTestId>) =>
  root.findAll(n => n.type === Text).map(n => [].concat(n.props.children).join(''));

test('B2: 코스 홈 배너 "번호 쓰기" → 번호 화면 → 이전은 코스 홈으로', async () => {
  await previewHome();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  await press('이전 화면으로 가기');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.queryByText('이 휴대폰은 누구 거예요?')).toBeNull();
});

test('B3: 미연결 코스 홈에도 설정이 보이고 눌린다(번호를 받으면 정할 수 있다는 안내 + 번호 쓰기, 지우기 없음)', async () => {
  await previewHome();
  await press('설정');
  await waitFor(() => screen.getByRole('header', {name: '설정'}));
  expect(screen.getByRole('button', {name: '번호 쓰기'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: '모두 지우기'})).toBeNull();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
});

test('B3: 연결된 코스 홈에도 설정이 보이고 눌린다', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByText('가족에게 답 보여 주기'));
});

test('B6: 상단은 상태바 바로 아래에 붙지 않는다(안전 영역 + 여백, 52 이상)', () => {
  const insets = SafeArea.useSafeAreaInsets as jest.Mock;
  const orig = insets.getMockImplementation();
  insets.mockImplementation(() => ({top: 34, bottom: 0, left: 0, right: 0}));
  render(<Screen top={<Text20>위</Text20>}><Text20>본문</Text20></Screen>);
  const pad = StyleSheet.flatten(screen.getByTestId('screen-top').props.style).paddingTop;
  expect(pad).toBeGreaterThanOrEqual(52);
  expect(pad).toBeGreaterThan(34);
  screen.unmount();
  insets.mockImplementation(orig);
});

test('B4: 본문이 넘치면 아래 페이드로 "더 있음"을 보이고, 끝까지 내리면 사라진다', () => {
  render(<Screen bottom={<Text20>버튼</Text20>}><Text20>본문</Text20></Screen>);
  const body = screen.getByTestId('screen-body');
  expect(screen.queryByTestId('screen-more', {includeHiddenElements: true})).toBeNull();
  act(() => {
    fireEvent(body, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
    fireEvent(body, 'contentSizeChange', 360, 600);
  });
  expect(screen.getByTestId('screen-more', {includeHiddenElements: true})).toBeTruthy();
  act(() => {
    fireEvent.scroll(body, {nativeEvent: {contentOffset: {y: 300}, contentSize: {height: 600, width: 360}, layoutMeasurement: {height: 300, width: 360}}});
  });
  expect(screen.queryByTestId('screen-more', {includeHiddenElements: true})).toBeNull();
});

test('B4·ds4c(#95 최종): 사진 높이는 124/88(100%, 설명 없는·있는 날)·80(글자 150% 이상)으로 정해 회상 질문과 읽어 주세요가 첫 화면에 들게 한다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('date-line'));
  await press('사진 보기');
  await waitFor(() => screen.getByTestId('step-header'));
  const {fontScale} = require('react-native').Dimensions.get('window');
  expect(StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style).height).toBe(fontScale >= 1.5 ? P4_LAYOUT.photo.large : P4_LAYOUT.photo.withCaption); // fake 콘텐츠는 설명 있음
});

test('단계 화면: 제목 줄에 "· n / 3", 한 덩어리로 "사진 보기, 3단계 중 1단계"(R4)', async () => {
  await previewHome();
  await press('사진 보기');
  await waitFor(() => screen.getByTestId('step-header'));
  const {fontScale} = require('react-native').Dimensions.get('window');
  expect(screen.getByText(fontScale >= 1.5 ? '1 / 3' : '사진 보기 · 1 / 3')).toBeTruthy(); // v4 단계 제목 한 줄(큰 글자는 '1 / 3'만, #95)
  expect(screen.getByRole('header', {name: '사진 보기, 3단계 중 1단계'})).toBeTruthy();
  await pressBackLink();
  await waitFor(() => screen.getByTestId('date-line'));
});

test('P3: 하단 큰 버튼은 지금 단계 이름(0/3 사진 보기 → 1/3 둘 중 고르기)', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '사진 보기'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: '이어서 하기'})).toBeNull();
  screen.unmount();
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo']})} role="parent" restore />);
  await waitFor(() => screen.getByText('둘 남았어요'));
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '둘 중 고르기'})).toBeTruthy();
});

test('P1 v4: 하단은 번호가 없어요·코스 보기 → 약관 한 줄("다음" 없음, 자동 확인)', async () => {
  // 기준 기기 글자 100%(0단계). jest 모의 기본 글자 배율 2 는 감사 H3 2단계(약관 줄 본문 끝)부터라 따로 본다(connectFit)
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 411, height: 914, scale: 2.6, fontScale: 1});
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  const order = texts(screen.getByTestId('screen-dock'));
  expect(order).not.toContain('다음');
  expect(order.indexOf('번호가 없어요')).toBeLessThan(order.indexOf('코스 보기'));
  expect(order.indexOf('코스 보기')).toBeLessThan(order.indexOf('연결하면 이용약관과 개인정보 처리방침에 동의하게 돼요'));
});

test('a11y R9: 선택 카드는 라디오(checked), 묶음은 radiogroup', async () => {
  render(<SelectCard label="봄" selected onPress={() => {}} />);
  expect(screen.getByRole('radio', {name: '봄', checked: true})).toBeTruthy();
  screen.unmount();
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('date-line'));
  await press('사진 보기');
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await press('둘 중 고르기');
  await waitFor(() => screen.getByTestId('choice-group'));
  expect(screen.getByTestId('choice-group').props.accessibilityRole).toBe('radiogroup');
  expect(within(screen.getByTestId('choice-group')).getAllByRole('radio').length).toBe(2);
});

test('a11y: 이번 주 도장은 개수가 아니라 찍은 요일을 읽는다(빈 날·개수 미언급)', () => {
  render(<StampRow days={[true, true, false, true, false, false, false]} todayIdx={4} />);
  const row = screen.getByLabelText(/이번 주 도장/);
  expect(row.props.accessibilityLabel).toBe('이번 주 도장, 월요일, 화요일, 목요일에 찍었어요');
  expect(row.props.accessibilityLabel).not.toMatch(/[0-9]|개/);
  screen.unmount();
  render(<StampRow days={[false, false, false, false, false, false, false]} todayIdx={0} />);
  expect(screen.getByLabelText(/이번 주 도장/).props.accessibilityLabel).toBe('이번 주 도장');
});

