import {fireEvent, screen, waitFor} from '@testing-library/react-native';
import {createFakeApi} from '../src/features/fakeApi';
import {press, toHome, toHomeConsented, pressCourseNext} from '../testUtils/flow';
import {pressLast} from '../testUtils/flow';

async function runCourse() {
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 썼어요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
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
  await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주지 않는 중이에요'));
  await press('다시 보여 주기'); // W0 ②: 행 오른쪽 동사 버튼 → 확인 펼침
  await waitFor(() => screen.getByText('오늘부터 고른 답이 가족에게 보여요'));
  await press('좋아요');
  await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주는 중이에요'));
  await press('돌아가기');
  await waitFor(() => screen.getByTestId('date-line'));
  await runCourse();
  expect(save).toHaveBeenCalledTimes(1);
});

test('설정에서 동의 철회는 확인 후에만 호출되고 이후 저장하지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const withdraw = jest.spyOn(api, 'withdrawConsent');
  const save = jest.spyOn(api, 'saveAnswer');
  await toHomeConsented(api);
  await press('설정');
  await press('그만 보여 주기'); // W0 ②: 행 오른쪽 동사 버튼 → 확인 펼침
  expect(withdraw).not.toHaveBeenCalled();
  await waitFor(() => screen.getByText('가족에게 그만 보여 줄까요?'));
  await pressLast('그만 보여 주기'); // 확인 안의 실행 버튼
  expect(withdraw).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('이제 고른 답은 가족에게 안 보여요. 설정에서 다시 보여 줄 수 있어요')); // 11-8 settings.share.stopped 대체
  await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주지 않는 중이에요'));
  await press('돌아가기');
  await waitFor(() => screen.getByTestId('date-line'));
  await runCourse();
  expect(save).not.toHaveBeenCalled();
});

test('철회 실패는 알리고 동의 상태를 바꾸지 않는다', async () => {
  const api = createFakeApi({consented: true});
  jest.spyOn(api, 'withdrawConsent').mockRejectedValueOnce(new Error('boom'));
  await toHomeConsented(api);
  await press('설정');
  await press('그만 보여 주기'); // W0 ②: 행 오른쪽 동사 버튼 → 확인 펼침
  await pressLast('그만 보여 주기'); // 확인 안의 실행 버튼
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
  expect(screen.queryByLabelText('가족에게 답 보여 주기, 보여 주지 않는 중이에요')).toBeNull();
});

test('그만 보여 주기 확인에서 그대로 둘래요를 누르면 철회하지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const withdraw = jest.spyOn(api, 'withdrawConsent');
  await toHomeConsented(api);
  await press('설정');
  await press('그만 보여 주기'); // W0 ②: 행 오른쪽 동사 버튼 → 확인 펼침
  await press('그대로 둘래요');
  expect(withdraw).not.toHaveBeenCalled();
  expect(screen.getByText('보여 주는 중이에요')).toBeTruthy();
});
