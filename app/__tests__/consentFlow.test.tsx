import {fireEvent, screen, waitFor} from '@testing-library/react-native';
import {createFakeApi} from '../src/features/fakeApi';
import {press, toHome, toHomeConsented} from '../testUtils/flow';

async function runCourse() {
  await press(/사진 보기/);
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await press(/질문 고르기/);
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await press(/글씨 쓰기/);
  await waitFor(() => screen.getByRole('button', {name: '다 썼어요'}));
  await press('다 썼어요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요. 잘하셨어요'));
}

test('거부한 어르신도 코스를 끝까지 하고 답은 저장하지 않는다', async () => {
  const api = createFakeApi();
  const save = jest.spyOn(api, 'saveAnswer');
  const rec = jest.spyOn(api, 'recordSessionStep');
  await toHome(api, false);
  await runCourse();
  expect(save).not.toHaveBeenCalled();
  expect(rec).toHaveBeenCalledTimes(3);
});

test('설정에서 다시 동의하면 그 뒤 답이 저장된다', async () => {
  const api = createFakeApi();
  const save = jest.spyOn(api, 'saveAnswer');
  await toHome(api, false);
  await press('설정');
  await waitFor(() => screen.getByRole('button', {name: '다시 나누기'}));
  await press('다시 나누기');
  await waitFor(() => screen.getByRole('button', {name: '그만 나누기'}));
  await press('돌아가기');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await runCourse();
  expect(save).toHaveBeenCalledTimes(1);
});

test('설정에서 동의 철회는 확인 후에만 호출되고 이후 저장하지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const withdraw = jest.spyOn(api, 'withdrawConsent');
  const save = jest.spyOn(api, 'saveAnswer');
  await toHomeConsented(api);
  await press('설정');
  await press('그만 나누기');
  expect(withdraw).not.toHaveBeenCalled();
  await waitFor(() => screen.getByText('그만 나눌까요?'));
  await press('그만 나누기');
  expect(withdraw).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByRole('button', {name: '다시 나누기'}));
  await press('돌아가기');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await runCourse();
  expect(save).not.toHaveBeenCalled();
});

test('철회 실패는 알리고 동의 상태를 바꾸지 않는다', async () => {
  const api = createFakeApi({consented: true});
  jest.spyOn(api, 'withdrawConsent').mockRejectedValueOnce(new Error('boom'));
  await toHomeConsented(api);
  await press('설정');
  await press('그만 나누기');
  await press('그만 나누기');
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
  expect(screen.queryByRole('button', {name: '다시 나누기'})).toBeNull();
});
