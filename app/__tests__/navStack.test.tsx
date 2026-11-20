// 리뷰(2026-11-17 qa-fix-review ③): 코스 홈 → 번호 쓰기 경로에서 스택이 쌓이지 않는다(하드웨어 뒤로로 확인)
import React from 'react';
import {BackHandler} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {enterCode, press} from '../testUtils/flow';

afterEach(() => jest.restoreAllMocks());

function captureBack() {
  const handlers: (() => boolean | null | undefined)[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, h: () => boolean) => {
    handlers.push(h);
    return {remove: () => handlers.splice(handlers.indexOf(h), 1)};
  }) as never);
  return async () => {
    await act(async () => {
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i]()) {
          break;
        }
      }
    });
  };
}
const CONNECT = '가족에게 받은 번호를 써 주세요';
const HOME = 'date-line'; // 코스 홈(시안 P3 v4: 제목 대신 날짜 줄)
const ROLE = '이 휴대폰은 누구 거예요?';

async function previewHome() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId(HOME));
}

test('코스 홈 → 번호 쓰기 → 코스 보기: 새로 쌓지 않고 그 코스 홈으로, 미연결 코스 홈도 뿌리(뒤로는 앱을 나감, PR #133 리뷰 M1)', async () => {
  const back = captureBack();
  await previewHome();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText(CONNECT));
  await press('코스 보기');
  await waitFor(() => screen.getByTestId(HOME));
  await back();
  await back();
  expect(screen.getByTestId(HOME)).toBeTruthy();
  expect(screen.queryByText(CONNECT)).toBeNull();
  expect(screen.queryByText(ROLE)).toBeNull();
});

test('회귀(#133 리뷰 M1): 미연결 처음 번호 화면 → 코스 보기 → 뒤로 → 뒤로 해도 기기 도장이 지워지지 않는다', async () => {
  const {createLocalStamps, setLocalStampsForTest} = require('../src/lib/localStamps');
  const {memoryStore} = require('../src/lib/kvStore');
  const stamps = createLocalStamps(memoryStore());
  setLocalStampsForTest(stamps);
  await stamps.addToday();
  const back = captureBack();
  await previewHome();
  await back();
  await back();
  expect(await stamps.read()).toHaveLength(1);
  expect(screen.getByTestId(HOME)).toBeTruthy();
  setLocalStampsForTest(null);
});

test('회귀(#133 리뷰 M1): 처음 화면으로(resetRole)는 기기 도장을 지우지 않는다 — 번호 화면에서 뒤로', async () => {
  const {createLocalStamps, setLocalStampsForTest} = require('../src/lib/localStamps');
  const {memoryStore} = require('../src/lib/kvStore');
  const stamps = createLocalStamps(memoryStore());
  setLocalStampsForTest(stamps);
  await stamps.addToday();
  const back = captureBack();
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText(CONNECT));
  await back(); // 번호(처음) → 역할 선택(resetRole)
  await waitFor(() => screen.getByText(ROLE));
  expect(await stamps.read()).toHaveLength(1);
  setLocalStampsForTest(null);
});

test('코스 홈 → 번호 쓰기 → 번호 성공 → 동의 → 코스 홈: 뒤로 가도 동의·미리보기 코스 홈이 나오지 않는다', async () => {
  const back = captureBack();
  await previewHome();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText(CONNECT));
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press('좋아요');
  await waitFor(() => screen.getByTestId(HOME));
  expect(screen.queryByText('번호를 받으면 답이 저장돼요')).toBeNull();
  // 리드 결정 11-20(네이버 패널 r1/4): 연결된 어르신에게 P3 는 뿌리 화면 — 뒤로는 앱을 나가고 P1·동의로 가지 않는다
  await back();
  expect(screen.getByTestId(HOME)).toBeTruthy();
  expect(screen.queryByText('고른 답을 가족과 나눠요')).toBeNull();
  expect(screen.queryByText(CONNECT)).toBeNull();
});

test('회귀(r1/4): 연결된 첫날 P3 에서 뒤로를 두 번 눌러도 P1 이 나오지 않고 기기 도장·역할이 지워지지 않는다', async () => {
  const {createLocalStamps, setLocalStampsForTest} = require('../src/lib/localStamps');
  const {memoryStore} = require('../src/lib/kvStore');
  const stamps = createLocalStamps(memoryStore());
  setLocalStampsForTest(stamps);
  const clear = jest.spyOn(stamps, 'clear');
  const back = captureBack();
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press('좋아요');
  await waitFor(() => screen.getByTestId(HOME));
  const before = clear.mock.calls.length; // 연결 상태로 처음 불러올 때 지우는 것(useWeekStamps 설계)은 뺀다
  await back();
  await back();
  expect(screen.getByTestId(HOME)).toBeTruthy();
  expect(screen.queryByText(CONNECT)).toBeNull();
  expect(screen.queryByText(ROLE)).toBeNull();
  expect(clear.mock.calls.length).toBe(before); // resetRole(기기 도장 지움)이 불리지 않는다
  setLocalStampsForTest(null);
});

test('설정 → 번호 쓰기 → 코스 보기는 코스 홈으로(설정·번호가 쌓이지 않음)', async () => {
  const back = captureBack();
  await previewHome();
  await press('설정');
  await waitFor(() => screen.getByRole('header', {name: '설정'}));
  await press('번호 쓰기');
  await waitFor(() => screen.getByText(CONNECT));
  await press('코스 보기');
  await waitFor(() => screen.getByTestId(HOME));
  await back(); // 미연결 코스 홈은 뿌리(#133 M1) — 번호·역할 화면으로 가지 않는다
  expect(screen.getByTestId(HOME)).toBeTruthy();
  expect(screen.queryByText(CONNECT)).toBeNull();
});

test('호칭 화면 선택 카드 묶음은 radiogroup(R9)', async () => {
  const {RelationScreen} = require('../src/features/child/RelationScreen');
  const {NavigationContainer} = require('@react-navigation/native');
  const {SessionContext} = require('../src/app/session');
  render(
    <NavigationContainer>
      <SessionContext.Provider value={{api: createFakeApi()} as never}>
        <RelationScreen />
      </SessionContext.Provider>
    </NavigationContainer>,
  );
  expect(screen.getByTestId('title-group').props.accessibilityRole).toBe('radiogroup');
});
