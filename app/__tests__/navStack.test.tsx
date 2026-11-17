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

test('코스 홈 → 번호 쓰기 → 코스 보기: 새로 쌓지 않고 그 코스 홈으로(뒤로 두 번이면 첫 화면)', async () => {
  const back = captureBack();
  await previewHome();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText(CONNECT));
  await press('코스 보기');
  await waitFor(() => screen.getByTestId(HOME));
  await back(); // [번호, 코스 홈] → 번호
  await waitFor(() => screen.getByText(CONNECT));
  await back(); // 번호(처음) → 역할 선택
  await waitFor(() => screen.getByText(ROLE));
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
  expect(screen.queryByText('번호를 받으면 그때부터 답이 저장돼요')).toBeNull();
  await back();
  await waitFor(() => expect(screen.queryByTestId(HOME)).toBeNull());
  expect(screen.queryByText('고른 답을 가족과 나눠요')).toBeNull();
  expect(screen.getByText(CONNECT)).toBeTruthy(); // 스택: [번호, 코스 홈]
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
  await back();
  await waitFor(() => screen.getByText(CONNECT)); // 처음 번호 화면
  await back();
  await waitFor(() => screen.getByText(ROLE));
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
