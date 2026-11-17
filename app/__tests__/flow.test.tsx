import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react-native';
import {enterCode, press, toHome} from '../testUtils/flow';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';

test('Connect -> Consent -> CourseHome 이동', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press('좋아요');
  await waitFor(() => screen.getByText('오늘의 코스'));
});

test('틀린 번호는 어르신 문장으로 안내한다', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await enterCode('999999');
  await waitFor(() => screen.getByText('번호를 못 알아봤어요'));
});

async function doAllSteps() {
  await press('이어서 하기');
  await waitFor(() => screen.getByText('마을 입구 나무'));
  await press('다 봤어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await press('이어서 하기');
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await press('이어서 하기');
  await waitFor(() => screen.getByText('나무'));
  await press('다 썼어요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
}

test('동의하면 답변이 저장되고 3단계 완료 처리가 호출된다', async () => {
  const api = createFakeApi();
  const rec = jest.spyOn(api, 'recordSessionStep');
  const save = jest.spyOn(api, 'saveAnswer');
  await toHome(api, true);
  await doAllSteps();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({questionId: 'q-1', choice: 'A'});
  expect(rec.mock.calls.map(c => c[0])).toEqual(['photo', 'question', 'hangul']);
  expect(await rec.mock.results[2].value).toMatchObject({completed: true});
});

test('동의 거부해도 코스는 볼 수 있고 답변 저장 API는 호출되지 않는다', async () => {
  const api = createFakeApi();
  const rec = jest.spyOn(api, 'recordSessionStep');
  const save = jest.spyOn(api, 'saveAnswer');
  const consent = jest.spyOn(api, 'giveConsent');
  await toHome(api, false);
  await doAllSteps();
  expect(save).not.toHaveBeenCalled();
  expect(consent).not.toHaveBeenCalled();
  expect(rec).toHaveBeenCalledTimes(3);
});

test('자녀 역할이면 자녀 탭이 보인다', async () => {
  render(<AppRoot api={createFakeApi()} role="child" />);
  await waitFor(() => screen.getByRole('tab', {name: '앨범'}));
  expect(screen.getByRole('tab', {name: '지난 답'})).toBeTruthy();
});
